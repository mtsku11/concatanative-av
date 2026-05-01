import type { AVCorpus, AVUnit, DescriptorVectors } from "../../src/corpus/corpus-types";

declare function require(specifier: string): any;
declare const process: {
  argv: string[];
  exitCode?: number;
};
declare const console: {
  error(...data: unknown[]): void;
  log(...data: unknown[]): void;
  warn(...data: unknown[]): void;
};

type CliOptions = {
  sourcesDir: string;
  corpusDir: string;
  outDir: string;
  queryCount: number;
  matchCount: number;
};

type ProbeStream = {
  codec_name?: string;
  codec_type?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  sample_rate?: string;
  channels?: string | number;
  width?: string | number;
  height?: string | number;
};

type ProbePayload = {
  format?: {
    duration?: string;
    format_name?: string;
    format_long_name?: string;
  };
  streams?: ProbeStream[];
};

type SourceHealth = {
  id?: string;
  label: string;
  path: string;
  exists: boolean;
  metadata?: {
    durationMs: number;
    frameRate: number;
    width: number;
    height: number;
    sampleRate: number;
    channelCount: number;
    container: string;
    videoCodec: string;
    audioCodec: string;
  };
  issues: string[];
};

type SourceMetadata = NonNullable<SourceHealth["metadata"]>;

type UnitHealth = {
  sourceId: string;
  sourceLabel: string;
  unitCount: number;
  invalidDurationCount: number;
  outOfBoundsCount: number;
  audioBoundaryMismatchCount: number;
  videoBoundaryMismatchCount: number;
  missingAtlasSpanCount: number;
  firstUnitId?: string;
  lastUnitId?: string;
};

type DescriptorStats = {
  group: keyof DescriptorVectors;
  field: string;
  vector: "normalized" | "raw";
  count: number;
  finiteCount: number;
  invalidCount: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  standardDeviation: number | null;
  zeroVariance: boolean;
  normalizedOutOfRangeCount?: number;
};

type TopMatch = {
  unitId: string;
  sourceId: string;
  startMs: number;
  durationMs: number;
  distance: number;
};

type QuerySnapshot = {
  queryUnitId: string;
  sourceId: string;
  startMs: number;
  matches: TopMatch[];
  previewAsset?: string;
};

type HealthReport = {
  generatedAt: string;
  corpusPath: string;
  sourcesPath: string;
  summary: {
    sourceCount: number;
    unitCount: number;
    issueCount: number;
    warningCount: number;
  };
  sources: SourceHealth[];
  unitExtraction: UnitHealth[];
  descriptorStats: DescriptorStats[];
  fixedQueryRegression: QuerySnapshot[];
  assets: {
    contactSheets: string[];
    unreferencedAtlasAssets: string[];
    missingAtlasAssets: string[];
    missingAudioAssets: string[];
  };
  issues: string[];
  warnings: string[];
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

type DirentLike = {
  name: string;
  isFile(): boolean;
};

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const SUPPORTED_VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"]);
const DEFAULT_DISTANCE_CONFIG = {
  weights: { audio: 1, video: 1, joint: 1 },
};
const BOUNDARY_TOLERANCE_MS = 12;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourcesDir = path.resolve(options.sourcesDir);
  const corpusDir = path.resolve(options.corpusDir);
  const outDir = path.resolve(options.outDir);
  const contactSheetDir = path.join(outDir, "contact-sheets");
  const matchPreviewDir = path.join(outDir, "match-previews");

  await fs.rm(contactSheetDir, { recursive: true, force: true });
  await fs.rm(matchPreviewDir, { recursive: true, force: true });
  await fs.mkdir(contactSheetDir, { recursive: true });
  await fs.mkdir(matchPreviewDir, { recursive: true });

  const corpus = await readCorpus(corpusDir);
  const sourceFiles = await discoverSourceFiles(sourcesDir);
  const issues: string[] = [];
  const warnings: string[] = [];

  const sources = await buildSourceHealth(corpus, sourceFiles, issues);
  const unitExtraction = buildUnitHealth(corpus, issues);
  const descriptorStats = buildDescriptorStats(corpus, issues, warnings);
  const fixedQueryRegression = await buildFixedQueryRegression(corpus, sourceFiles, matchPreviewDir, options, warnings);
  const assets = await buildAssetHealth(corpus, corpusDir, contactSheetDir, sourceFiles, sources, issues, warnings);

  const report: HealthReport = {
    generatedAt: new Date().toISOString(),
    corpusPath: path.join(corpusDir, "corpus.json"),
    sourcesPath: sourcesDir,
    summary: {
      sourceCount: corpus.sources.length,
      unitCount: corpus.units.length,
      issueCount: issues.length,
      warningCount: warnings.length,
    },
    sources,
    unitExtraction,
    descriptorStats,
    fixedQueryRegression,
    assets,
    issues,
    warnings,
  };

  await fs.writeFile(path.join(outDir, "health-summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(outDir, "health-report.md"), renderMarkdownReport(report), "utf8");

  console.log(`Wrote ${path.join(outDir, "health-report.md")}`);
  console.log(`Wrote ${path.join(outDir, "health-summary.json")}`);
  console.log(`Corpus health: ${issues.length} issue(s), ${warnings.length} warning(s).`);

  if (issues.length > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    sourcesDir: "./sources",
    corpusDir: "./corpus",
    outDir: "./reports/corpus-health",
    queryCount: 5,
    matchCount: 10,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (key === "help") {
      printHelp();
      return options;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;

    switch (key) {
      case "sources":
        options.sourcesDir = value;
        break;
      case "corpus":
        options.corpusDir = value;
        break;
      case "out":
        options.outDir = value;
        break;
      case "query-count":
        options.queryCount = parsePositiveInteger(value, key);
        break;
      case "match-count":
        options.matchCount = parsePositiveInteger(value, key);
        break;
      default:
        throw new Error(`Unknown flag: --${key}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run health:corpus -- --sources ./sources --corpus ./corpus --out ./reports/corpus-health

Options:
  --sources <dir>       Source video directory
  --corpus <dir>        Built corpus directory containing corpus.json
  --out <dir>           Report output directory
  --query-count <n>     Number of deterministic query units to snapshot
  --match-count <n>     Number of top matches per query
  --help                Print this message`);
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${flag} must be a positive integer`);
  }
  return parsed;
}

async function readCorpus(corpusDir: string): Promise<AVCorpus> {
  const corpusPath = path.join(corpusDir, "corpus.json");
  const raw = await fs.readFile(corpusPath, "utf8");
  return JSON.parse(raw) as AVCorpus;
}

async function discoverSourceFiles(sourcesDir: string): Promise<Map<string, string>> {
  const entries: DirentLike[] = await fs.readdir(sourcesDir, { withFileTypes: true });
  const files = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (SUPPORTED_VIDEO_EXTENSIONS.has(extension)) {
      files.set(entry.name, path.join(sourcesDir, entry.name));
    }
  }
  return files;
}

async function buildSourceHealth(
  corpus: AVCorpus,
  sourceFiles: Map<string, string>,
  issues: string[],
): Promise<SourceHealth[]> {
  const report: SourceHealth[] = [];
  const labelsInCorpus = new Set(corpus.sources.map((source) => source.label));

  for (const source of corpus.sources) {
    const sourcePath = sourceFiles.get(source.label) || "";
    const sourceHealth: SourceHealth = {
      id: source.id,
      label: source.label,
      path: sourcePath,
      exists: Boolean(sourcePath),
      issues: [],
    };

    if (!sourcePath) {
      addIssue(sourceHealth, issues, `Missing source file for corpus source ${source.label}`);
      report.push(sourceHealth);
      continue;
    }

    try {
      const metadata = await probeSource(sourcePath);
      sourceHealth.metadata = metadata;
      if (metadata.durationMs <= 0) addIssue(sourceHealth, issues, `${source.label} has invalid duration`);
      if (metadata.frameRate <= 0) addIssue(sourceHealth, issues, `${source.label} has invalid frame rate`);
      if (metadata.width <= 0 || metadata.height <= 0) addIssue(sourceHealth, issues, `${source.label} has invalid resolution`);
      if (metadata.sampleRate <= 0) addIssue(sourceHealth, issues, `${source.label} has invalid audio sample rate`);
      if (metadata.channelCount <= 0) addIssue(sourceHealth, issues, `${source.label} has invalid channel count`);
      if (metadata.videoCodec === "missing") addIssue(sourceHealth, issues, `${source.label} has no readable video stream`);
      if (metadata.audioCodec === "missing") addIssue(sourceHealth, issues, `${source.label} has no readable audio stream`);
    } catch (error) {
      addIssue(sourceHealth, issues, `ffprobe failed for ${source.label}: ${String(error instanceof Error ? error.message : error)}`);
    }

    report.push(sourceHealth);
  }

  for (const label of sourceFiles.keys()) {
    if (!labelsInCorpus.has(label)) {
      issues.push(`Source file ${label} exists in sources directory but is not represented in corpus.json`);
      report.push({
        label,
        path: sourceFiles.get(label) || "",
        exists: true,
        issues: ["Not represented in corpus.json"],
      });
    }
  }

  return report;
}

async function probeSource(sourcePath: string): Promise<SourceMetadata> {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    sourcePath,
  ]);
  const payload = JSON.parse(stdout) as ProbePayload;
  const streams = Array.isArray(payload.streams) ? payload.streams : [];
  const audioStream = streams.find((stream) => stream.codec_type === "audio");
  const videoStream = streams.find((stream) => stream.codec_type === "video");

  return {
    durationMs: Math.round(Number.parseFloat(payload.format?.duration || "0") * 1000),
    frameRate: videoStream ? parseFps(videoStream.avg_frame_rate || videoStream.r_frame_rate || "0/1") : 0,
    width: Number.parseInt(String(videoStream?.width || "0"), 10),
    height: Number.parseInt(String(videoStream?.height || "0"), 10),
    sampleRate: Number.parseInt(audioStream?.sample_rate || "0", 10),
    channelCount: Number.parseInt(String(audioStream?.channels || "0"), 10),
    container: payload.format?.format_name || "unknown",
    videoCodec: videoStream?.codec_name || "missing",
    audioCodec: audioStream?.codec_name || "missing",
  };
}

function buildUnitHealth(corpus: AVCorpus, issues: string[]): UnitHealth[] {
  const unitsBySource = new Map<string, AVUnit[]>();
  for (const unit of corpus.units) {
    const units = unitsBySource.get(unit.sourceId) || [];
    units.push(unit);
    unitsBySource.set(unit.sourceId, units);
  }

  return corpus.sources.map((source) => {
    const units = unitsBySource.get(source.id) || [];
    const sourceFrameMs = 1000 / Math.max(source.frameRate, 1);
    const toleranceMs = Math.max(BOUNDARY_TOLERANCE_MS, sourceFrameMs * 1.5);
    const health: UnitHealth = {
      sourceId: source.id,
      sourceLabel: source.label,
      unitCount: units.length,
      invalidDurationCount: 0,
      outOfBoundsCount: 0,
      audioBoundaryMismatchCount: 0,
      videoBoundaryMismatchCount: 0,
      missingAtlasSpanCount: 0,
      firstUnitId: units[0]?.id,
      lastUnitId: units[units.length - 1]?.id,
    };

    for (const unit of units) {
      if (unit.durationMs <= 0 || unit.audioSampleCount <= 0 || unit.videoFrameCount <= 0) {
        health.invalidDurationCount += 1;
      }
      if (unit.startMs < -toleranceMs || unit.startMs + unit.durationMs > source.durationMs + toleranceMs) {
        health.outOfBoundsCount += 1;
      }
      const audioStartMs = (unit.audioStartSample / source.sampleRate) * 1000;
      const audioDurationMs = (unit.audioSampleCount / source.sampleRate) * 1000;
      if (Math.abs(audioStartMs - unit.startMs) > toleranceMs || Math.abs(audioDurationMs - unit.durationMs) > toleranceMs) {
        health.audioBoundaryMismatchCount += 1;
      }
      const videoStartMs = (unit.videoStartFrame / source.frameRate) * 1000;
      const videoDurationMs = (unit.videoFrameCount / source.frameRate) * 1000;
      if (Math.abs(videoStartMs - unit.startMs) > toleranceMs || Math.abs(videoDurationMs - unit.durationMs) > toleranceMs * 2) {
        health.videoBoundaryMismatchCount += 1;
      }
      if (!unit.videoAtlasSpans.length) {
        health.missingAtlasSpanCount += 1;
      }
    }

    if (health.unitCount <= 0) issues.push(`${source.label} has zero extracted units`);
    if (health.invalidDurationCount > 0) issues.push(`${source.label} has ${health.invalidDurationCount} invalid unit duration(s)`);
    if (health.outOfBoundsCount > 0) issues.push(`${source.label} has ${health.outOfBoundsCount} out-of-bounds unit(s)`);
    if (health.audioBoundaryMismatchCount > 0) issues.push(`${source.label} has ${health.audioBoundaryMismatchCount} audio boundary mismatch(es)`);
    if (health.videoBoundaryMismatchCount > 0) issues.push(`${source.label} has ${health.videoBoundaryMismatchCount} video boundary mismatch(es)`);
    if (health.missingAtlasSpanCount > 0) issues.push(`${source.label} has ${health.missingAtlasSpanCount} unit(s) with no atlas spans`);

    return health;
  });
}

function buildDescriptorStats(corpus: AVCorpus, issues: string[], warnings: string[]): DescriptorStats[] {
  const stats: DescriptorStats[] = [];
  for (const group of ["audio", "video", "joint"] as Array<keyof DescriptorVectors>) {
    const fields = corpus.descriptorSchema[group];
    for (let index = 0; index < fields.length; index += 1) {
      const field = fields[index];
      stats.push(summarizeDescriptor(corpus.units, group, field, index, "normalized", true));
      stats.push(summarizeDescriptor(corpus.units, group, field, index, "raw", false));
    }
  }

  for (const unit of corpus.units) {
    for (const group of ["audio", "video", "joint"] as Array<keyof DescriptorVectors>) {
      const expected = corpus.descriptorSchema[group].length;
      const normalizedLength = unit.descriptors[group]?.length || 0;
      const rawLength = unit.rawDescriptors?.[group]?.length || 0;
      if (normalizedLength !== expected) {
        issues.push(`${unit.id} has ${normalizedLength} normalized ${group} descriptor(s), expected ${expected}`);
      }
      if (rawLength !== expected) {
        issues.push(`${unit.id} has ${rawLength} raw ${group} descriptor(s), expected ${expected}`);
      }
    }
  }

  for (const stat of stats) {
    if (stat.invalidCount > 0) {
      issues.push(`${stat.vector} ${stat.group}.${stat.field} has ${stat.invalidCount} invalid value(s)`);
    }
    if (stat.normalizedOutOfRangeCount && stat.normalizedOutOfRangeCount > 0) {
      issues.push(`${stat.group}.${stat.field} has ${stat.normalizedOutOfRangeCount} normalized value(s) outside 0..1`);
    }
    if (stat.vector === "normalized" && stat.zeroVariance) {
      warnings.push(`${stat.group}.${stat.field} has zero normalized variance`);
    }
  }

  return stats;
}

function summarizeDescriptor(
  units: AVUnit[],
  group: keyof DescriptorVectors,
  field: string,
  index: number,
  vector: "normalized" | "raw",
  checkNormalizedRange: boolean,
): DescriptorStats {
  const values = units.map((unit) => {
    const source = vector === "raw" ? unit.rawDescriptors : unit.descriptors;
    return source?.[group]?.[index] ?? Number.NaN;
  });
  const finite = values.filter((value) => Number.isFinite(value));
  const mean = finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
  const variance = mean === null
    ? null
    : finite.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) / finite.length;
  const min = finite.length ? Math.min(...finite) : null;
  const max = finite.length ? Math.max(...finite) : null;
  const normalizedOutOfRangeCount = checkNormalizedRange
    ? finite.filter((value) => value < -1e-6 || value > 1 + 1e-6).length
    : undefined;

  return {
    group,
    field,
    vector,
    count: values.length,
    finiteCount: finite.length,
    invalidCount: values.length - finite.length,
    min,
    max,
    mean,
    standardDeviation: variance === null ? null : Math.sqrt(variance),
    zeroVariance: min !== null && max !== null && Math.abs(max - min) <= 1e-9,
    normalizedOutOfRangeCount,
  };
}

async function buildFixedQueryRegression(
  corpus: AVCorpus,
  sourceFiles: Map<string, string>,
  matchPreviewDir: string,
  options: CliOptions,
  warnings: string[],
): Promise<QuerySnapshot[]> {
  const queryUnits = chooseQueryUnits(corpus.units, options.queryCount);
  const snapshots: QuerySnapshot[] = queryUnits.map((query) => ({
    queryUnitId: query.id,
    sourceId: query.sourceId,
    startMs: query.startMs,
    matches: computeNearestRows(corpus, query, options.matchCount),
  }));

  for (const snapshot of snapshots) {
    try {
      const previewAsset = await generateMatchPreview(corpus, sourceFiles, snapshot, matchPreviewDir);
      snapshot.previewAsset = previewAsset;
    } catch (error) {
      warnings.push(`Failed to generate match preview for ${snapshot.queryUnitId}: ${String(error instanceof Error ? error.message : error)}`);
    }
  }

  return snapshots;
}

function chooseQueryUnits(units: AVUnit[], queryCount: number): AVUnit[] {
  if (units.length <= queryCount) {
    return [...units];
  }
  const selected: AVUnit[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < queryCount; index += 1) {
    const unitIndex = Math.round((index * (units.length - 1)) / Math.max(1, queryCount - 1));
    const unit = units[unitIndex];
    if (unit && !seen.has(unit.id)) {
      selected.push(unit);
      seen.add(unit.id);
    }
  }
  return selected;
}

function computeNearestRows(corpus: AVCorpus, target: AVUnit, limit: number): TopMatch[] {
  return corpus.units
    .filter((unit) => unit.id !== target.id)
    .map((unit) => ({
      unitId: unit.id,
      sourceId: unit.sourceId,
      startMs: unit.startMs,
      durationMs: unit.durationMs,
      distance: descriptorDistance(target.descriptors, unit.descriptors, corpus),
    }))
    .sort((left, right) => left.distance - right.distance || left.unitId.localeCompare(right.unitId))
    .slice(0, limit);
}

function descriptorDistance(left: DescriptorVectors, right: DescriptorVectors, corpus: AVCorpus): number {
  let sum = 0;
  for (const group of ["audio", "video", "joint"] as Array<keyof DescriptorVectors>) {
    const weight = DEFAULT_DISTANCE_CONFIG.weights[group];
    const leftValues = left[group] || [];
    const rightValues = right[group] || [];
    const count = Math.min(leftValues.length, rightValues.length, corpus.descriptorSchema[group].length);
    for (let index = 0; index < count; index += 1) {
      const delta = leftValues[index] - rightValues[index];
      sum += weight * delta * delta;
    }
  }
  return Math.sqrt(sum);
}

async function buildAssetHealth(
  corpus: AVCorpus,
  corpusDir: string,
  contactSheetDir: string,
  sourceFiles: Map<string, string>,
  sources: SourceHealth[],
  issues: string[],
  warnings: string[],
): Promise<HealthReport["assets"]> {
  const contactSheets: string[] = [];
  const missingAtlasAssets: string[] = [];
  const missingAudioAssets: string[] = [];
  const referencedAtlasAssets = new Set<string>();

  for (const source of corpus.sources) {
    const audioAssetPath = path.join(corpusDir, source.audioAsset);
    if (!(await fileExists(audioAssetPath))) {
      missingAudioAssets.push(source.audioAsset);
      issues.push(`Missing audio asset ${source.audioAsset}`);
    }
    for (const atlasAsset of source.atlasAssets) {
      referencedAtlasAssets.add(atlasAsset);
      if (!(await fileExists(path.join(corpusDir, atlasAsset)))) {
        missingAtlasAssets.push(atlasAsset);
        issues.push(`Missing atlas asset ${atlasAsset}`);
      }
    }
  }

  for (const source of sources) {
    if (!source.id || !source.exists || !source.metadata) {
      continue;
    }
    try {
      const outputPath = path.join(contactSheetDir, `${source.id}.png`);
      await generateSourceContactSheet(source.path, source.metadata.durationMs, outputPath);
      contactSheets.push(path.relative(path.dirname(contactSheetDir), outputPath));
    } catch (error) {
      warnings.push(`Failed to generate contact sheet for ${source.label}: ${String(error instanceof Error ? error.message : error)}`);
    }
  }

  const unreferencedAtlasAssets: string[] = [];
  const atlasesDir = path.join(corpusDir, "atlases");
  const atlasEntries: DirentLike[] = await fs.readdir(atlasesDir, { withFileTypes: true }).catch(() => []);
  for (const entry of atlasEntries) {
    if (!entry.isFile()) {
      continue;
    }
    const relativePath = `atlases/${entry.name}`;
    if (!referencedAtlasAssets.has(relativePath)) {
      unreferencedAtlasAssets.push(relativePath);
    }
  }

  for (const label of sourceFiles.keys()) {
    const source = corpus.sources.find((candidate) => candidate.label === label);
    if (!source) {
      continue;
    }
  }

  return {
    contactSheets,
    unreferencedAtlasAssets,
    missingAtlasAssets,
    missingAudioAssets,
  };
}

async function generateSourceContactSheet(sourcePath: string, durationMs: number, outputPath: string) {
  const intervalSeconds = Math.max(0.1, durationMs / 1000 / 20);
  await runCommand("ffmpeg", [
    "-y",
    "-i",
    sourcePath,
    "-vf",
    `fps=1/${formatFfmpegNumber(intervalSeconds)},scale=160:-1,tile=5x4`,
    "-frames:v",
    "1",
    outputPath,
  ]);
}

async function generateMatchPreview(
  corpus: AVCorpus,
  sourceFiles: Map<string, string>,
  snapshot: QuerySnapshot,
  matchPreviewDir: string,
): Promise<string> {
  const tempDir = path.join(matchPreviewDir, `.tmp-${snapshot.queryUnitId}`);
  await fs.mkdir(tempDir, { recursive: true });
  const unitsById = new Map(corpus.units.map((unit) => [unit.id, unit]));
  const units = [
    unitsById.get(snapshot.queryUnitId),
    ...snapshot.matches.map((match) => unitsById.get(match.unitId)),
  ].filter((unit): unit is AVUnit => Boolean(unit));

  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    const source = corpus.sources.find((candidate) => candidate.id === unit.sourceId);
    const sourcePath = source ? sourceFiles.get(source.label) : null;
    if (!sourcePath) {
      continue;
    }
    await runCommand("ffmpeg", [
      "-y",
      "-ss",
      formatFfmpegNumber(unit.startMs / 1000),
      "-i",
      sourcePath,
      "-frames:v",
      "1",
      "-vf",
      "scale=160:-1",
      path.join(tempDir, `${String(index).padStart(2, "0")}.png`),
    ]);
  }

  const outputPath = path.join(matchPreviewDir, `${snapshot.queryUnitId}.png`);
  await runCommand("ffmpeg", [
    "-y",
    "-framerate",
    "1",
    "-i",
    path.join(tempDir, "%02d.png"),
    "-vf",
    "tile=4x3",
    "-frames:v",
    "1",
    outputPath,
  ]);
  await fs.rm(tempDir, { recursive: true, force: true });
  return path.relative(path.dirname(matchPreviewDir), outputPath);
}

function renderMarkdownReport(report: HealthReport): string {
  const lines: string[] = [];
  lines.push("# Corpus Health Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Corpus: \`${report.corpusPath}\``);
  lines.push(`Sources: \`${report.sourcesPath}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Sources: ${report.summary.sourceCount}`);
  lines.push(`- Units: ${report.summary.unitCount}`);
  lines.push(`- Issues: ${report.summary.issueCount}`);
  lines.push(`- Warnings: ${report.summary.warningCount}`);
  lines.push("");
  lines.push("## Source Metadata");
  lines.push("");
  lines.push("| Source | Duration | FPS | Resolution | Audio | Codec / Container | Issues |");
  lines.push("| --- | ---: | ---: | --- | --- | --- | --- |");
  for (const source of report.sources) {
    const metadata = source.metadata;
    const cells = [
      escapeMarkdown(source.label),
      metadata ? formatMs(metadata.durationMs) : "-",
      metadata ? metadata.frameRate.toFixed(3) : "-",
      metadata ? `${metadata.width}x${metadata.height}` : "-",
      metadata ? `${metadata.sampleRate} Hz / ${metadata.channelCount} ch` : "-",
      metadata ? `${metadata.videoCodec}+${metadata.audioCodec} / ${metadata.container}` : "-",
      source.issues.length ? source.issues.map(escapeMarkdown).join("; ") : "OK",
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Unit Extraction");
  lines.push("");
  lines.push("| Source | Units | Invalid Durations | Out Of Bounds | Audio Mismatch | Video Mismatch | Missing Atlas |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const unitHealth of report.unitExtraction) {
    lines.push(`| ${escapeMarkdown(unitHealth.sourceLabel)} | ${unitHealth.unitCount} | ${unitHealth.invalidDurationCount} | ${unitHealth.outOfBoundsCount} | ${unitHealth.audioBoundaryMismatchCount} | ${unitHealth.videoBoundaryMismatchCount} | ${unitHealth.missingAtlasSpanCount} |`);
  }
  lines.push("");
  lines.push("## Descriptor Health");
  lines.push("");
  lines.push("| Vector | Descriptor | Min | Max | Mean | Std Dev | Invalid |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: |");
  for (const stat of report.descriptorStats.filter((entry) => entry.vector === "normalized")) {
    lines.push(`| ${stat.vector} | ${stat.group}.${stat.field} | ${formatNullable(stat.min)} | ${formatNullable(stat.max)} | ${formatNullable(stat.mean)} | ${formatNullable(stat.standardDeviation)} | ${stat.invalidCount} |`);
  }
  lines.push("");
  lines.push("## Fixed Query Regression");
  lines.push("");
  for (const snapshot of report.fixedQueryRegression) {
    lines.push(`### ${snapshot.queryUnitId}`);
    lines.push("");
    lines.push(`Query start: ${formatMs(snapshot.startMs)}`);
    if (snapshot.previewAsset) {
      lines.push(`Preview: \`${snapshot.previewAsset}\``);
    }
    lines.push("");
    lines.push("| Rank | Unit | Source | Start | Duration | Distance |");
    lines.push("| ---: | --- | --- | ---: | ---: | ---: |");
    snapshot.matches.forEach((match, index) => {
      lines.push(`| ${index + 1} | ${match.unitId} | ${match.sourceId} | ${formatMs(match.startMs)} | ${formatMs(match.durationMs)} | ${match.distance.toFixed(6)} |`);
    });
    lines.push("");
  }
  lines.push("## Assets");
  lines.push("");
  lines.push(`- Contact sheets: ${report.assets.contactSheets.length}`);
  lines.push(`- Missing audio assets: ${report.assets.missingAudioAssets.length}`);
  lines.push(`- Missing atlas assets: ${report.assets.missingAtlasAssets.length}`);
  lines.push(`- Unreferenced atlas assets: ${report.assets.unreferencedAtlasAssets.length}`);
  lines.push("");
  if (report.issues.length) {
    lines.push("## Issues");
    lines.push("");
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
    lines.push("");
  }
  if (report.warnings.length) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of report.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function addIssue(sourceHealth: SourceHealth, issues: string[], issue: string) {
  sourceHealth.issues.push(issue);
  issues.push(issue);
}

function parseFps(value: string): number {
  const [rawNumerator, rawDenominator] = value.split("/");
  const numerator = Number.parseFloat(rawNumerator || "0");
  const denominator = Number.parseFloat(rawDenominator || "1");
  if (!numerator || !denominator) {
    return 0;
  }
  return numerator / denominator;
}

async function runCommand(commandName: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Uint8Array) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk: Uint8Array) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code: number) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${commandName} ${args.join(" ")} failed with code ${code}: ${stderr}`));
      }
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs
    .stat(filePath)
    .then((stats: { isFile(): boolean }) => stats.isFile())
    .catch(() => false);
}

function formatMs(value: number): string {
  return `${value.toFixed(1)} ms`;
}

function formatNullable(value: number | null): string {
  return value === null ? "-" : value.toFixed(6);
}

function formatFfmpegNumber(value: number): string {
  return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function escapeMarkdown(value: string): string {
  return value.replace(/[|\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
