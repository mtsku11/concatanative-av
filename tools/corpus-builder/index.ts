import type {
  AVCorpus,
  AVUnit,
  CorpusSource,
  DescriptorFieldNormalization,
  DescriptorNormalization,
  DescriptorSchema,
  CorpusSegmentationSpec,
  VideoAtlasSpan,
} from "../../src/corpus/corpus-types";

declare function require(specifier: string): any;
declare const process: {
  argv: string[];
  exit(code?: number): never;
};
declare const console: {
  error(...data: unknown[]): void;
  log(...data: unknown[]): void;
  warn(...data: unknown[]): void;
};

type AtlasFormat = "png" | "webp" | "jpg";

type CliOptions = {
  sourcesDir: string;
  outDir: string;
  atlasFormat: AtlasFormat;
  atlasColumns: number;
  atlasRows: number;
  atlasFrameWidth: number | null;
  atlasFrameHeight: number | null;
  atlasFrameSizeExplicit: boolean;
  segmentation: CorpusSegmentationSpec;
  overwrite: boolean;
  audioOnly: boolean;
  atlasesOnly: boolean;
};

type SourceCandidate = {
  id: string;
  label: string;
  inputPath: string;
  audioAssetPath: string;
  atlasAssetPattern: string;
};

type ProbedSource = {
  durationMs: number;
  sampleRate: number;
  channelCount: number;
  frameRate: number;
  width: number;
  height: number;
};

type AudioAnalysisFrame = {
  centerMs: number;
  rms: number;
  spectralCentroid: number;
  spectralFlatness: number;
  spectralFlux: number;
  pitchConfidence: number;
  pitchHz: number;
  onsetStrength: number;
};

type VideoAnalysisFrame = {
  luminance: number;
  saturation: number;
  frameDiffEnergy: number;
  motionMagnitude: number;
  edgeDensity: number;
};

type SourceAnalysis = {
  monoSamples: Float32Array;
  audioFrames: AudioAnalysisFrame[];
  videoFrames: VideoAnalysisFrame[];
  totalDurationMs: number;
  totalFrameCount: number;
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

type BufferCommandResult = {
  stdout: Uint8Array;
  stderr: string;
};

type DirentLike = {
  name: string;
  isFile(): boolean;
};

type ProbeStream = {
  codec_type?: string;
  duration?: string;
  sample_rate?: string;
  channels?: string | number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  width?: string | number;
  height?: string | number;
};

type FieldNormalization = DescriptorFieldNormalization<string>;

type NormalizedUnit = AVUnit & {
  rawDescriptors: {
    audio: number[];
    video: number[];
    joint: number[];
  };
};

type UnitDraft = {
  id: string;
  sourceId: string;
  sourceUnitIndex: number;
  startMs: number;
  durationMs: number;
  audioStartSample: number;
  audioSampleCount: number;
  videoStartFrame: number;
  videoFrameCount: number;
  videoAtlasSpans: {
    asset: string;
    startTileIndex: number;
    frameCount: number;
    sourceStartFrame: number;
  }[];
  prevUnitId?: string;
  nextUnitId?: string;
  rawAudioDescriptors: number[];
  rawVideoDescriptors: number[];
  rawJointDescriptors?: number[];
};

const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { Buffer } = require("node:buffer");

const {
  DEFAULT_DESCRIPTOR_SCHEMA,
  DEFAULT_SEGMENTATION_SPEC,
} = require("../../src/corpus/corpus-types.ts") as {
  DEFAULT_DESCRIPTOR_SCHEMA: DescriptorSchema;
  DEFAULT_SEGMENTATION_SPEC: CorpusSegmentationSpec;
};

const SUPPORTED_VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".mkv",
  ".webm",
  ".avi",
]);

const AUDIO_WINDOW_SIZE = 1024;
const AUDIO_HOP_SIZE = 512;
const MIN_PITCH_HZ = 50;
const MAX_PITCH_HZ = 2000;
const YIN_THRESHOLD = 0.18;
const MAX_YIN_FALLBACK = 0.45;
const VIDEO_ANALYSIS_WIDTH = 32;
const VIDEO_ANALYSIS_HEIGHT = 18;
const MOTION_DIFF_THRESHOLD = 24;
const EDGE_DIFF_THRESHOLD = 18;
const EPSILON = 1e-9;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourcesDir = path.resolve(options.sourcesDir);
  const outDir = path.resolve(options.outDir);
  const audioDir = path.join(outDir, "audio");
  const atlasesDir = path.join(outDir, "atlases");

  await ensureCommandAvailable("ffprobe");
  await ensureCommandAvailable("ffmpeg");
  await ensureReadableDirectory(sourcesDir);
  await ensureOutDir(outDir, options.overwrite);
  await fs.mkdir(audioDir, { recursive: true });
  await fs.mkdir(atlasesDir, { recursive: true });

  const candidates = await discoverSources(sourcesDir, outDir, options.atlasFormat);
  if (candidates.length === 0) {
    throw new Error(`No supported source videos found in ${sourcesDir}`);
  }

  console.log(`Found ${candidates.length} source video(s) in ${sourcesDir}`);

  const corpusSources: CorpusSource[] = [];
  const unitDrafts: UnitDraft[] = [];
  const tilesPerAtlas = options.atlasColumns * options.atlasRows;

  for (const candidate of candidates) {
    try {
      console.log(`\n${candidate.label}`);
      logStep("Probing media");
      const probe = await probeSource(candidate.inputPath);
      resolveAtlasFrameSize(options, probe, candidate.label);

      logStep("Analyzing descriptors");
      const analysis = await analyzeSource(candidate.inputPath, probe);

      if (!options.atlasesOnly) {
        logStep("Exporting source WAV");
        await exportAudioAsset(candidate.inputPath, candidate.audioAssetPath, options.overwrite);
      }

      let relativeAtlasAssets: string[] = [];
      if (!options.audioOnly) {
        logStep("Exporting frame atlases");
        const atlasAssets = await exportAtlasAssets(candidate, analysis.totalFrameCount, probe.frameRate, atlasesDir, options);
        relativeAtlasAssets = atlasAssets.map((assetPath) => toPosixRelativePath(assetPath, outDir));
      }

      logStep("Segmenting units");
      const sourceUnits = buildUnitsForSource({
        analysis,
        atlasAssets: relativeAtlasAssets,
        probe,
        schema: DEFAULT_DESCRIPTOR_SCHEMA,
        segmentation: options.segmentation,
        sourceId: candidate.id,
        tilesPerAtlas,
      });

      corpusSources.push({
        id: candidate.id,
        label: candidate.label,
        durationMs: probe.durationMs,
        sampleRate: probe.sampleRate,
        channelCount: probe.channelCount,
        frameRate: probe.frameRate,
        width: probe.width,
        height: probe.height,
        audioAsset: toPosixRelativePath(candidate.audioAssetPath, outDir),
        atlasAssets: relativeAtlasAssets,
      });

      unitDrafts.push(...sourceUnits);
      logStep(`Emitted ${sourceUnits.length} unit(s)`);
    } catch (error) {
      console.warn(
        `  Warning: skipped ${candidate.label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (corpusSources.length === 0) {
    throw new Error("No sources could be processed successfully.");
  }

  const descriptorNormalization = buildDescriptorNormalization(unitDrafts, DEFAULT_DESCRIPTOR_SCHEMA);
  const units = finalizeUnits(unitDrafts, DEFAULT_DESCRIPTOR_SCHEMA, descriptorNormalization);
  const embedding = computeEmbedding2D(units);
  for (let index = 0; index < units.length; index += 1) {
    units[index].embedding2D = embedding[index];
  }

  const corpus: AVCorpus = {
    version: 1,
    sources: corpusSources,
    units,
    descriptorSchema: DEFAULT_DESCRIPTOR_SCHEMA,
    descriptorNormalization,
    media: {
      audio: {
        strategy: "source-file",
        format: "wav",
      },
      video: {
        strategy: "atlas",
        format: options.atlasFormat,
        frameWidth: requireAtlasDimension(options.atlasFrameWidth, "width"),
        frameHeight: requireAtlasDimension(options.atlasFrameHeight, "height"),
        columns: options.atlasColumns,
        rows: options.atlasRows,
      },
    },
    segmentation: options.segmentation,
    embedding: {
      method: "pca",
      source: "normalized-descriptors",
    },
  };

  const corpusPath = path.join(outDir, "corpus.json");
  await fs.writeFile(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`, "utf8");

  console.log(`Wrote ${corpusPath}`);
  console.log(`Corpus contains ${units.length} unit(s) across ${corpusSources.length} source(s).`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    sourcesDir: "./sources",
    outDir: "./corpus",
    atlasFormat: "png",
    atlasColumns: 8,
    atlasRows: 8,
    atlasFrameWidth: null,
    atlasFrameHeight: null,
    atlasFrameSizeExplicit: false,
    segmentation: { ...DEFAULT_SEGMENTATION_SPEC },
    overwrite: false,
    audioOnly: false,
    atlasesOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (key === "overwrite") {
      options.overwrite = true;
      continue;
    }
    if (key === "audio-only") {
      options.audioOnly = true;
      continue;
    }
    if (key === "atlases-only") {
      options.atlasesOnly = true;
      continue;
    }
    if (key === "help") {
      printHelpAndExit();
    }

    const rawValue = argv[index + 1];
    if (!rawValue || rawValue.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;

    switch (key) {
      case "sources":
        options.sourcesDir = rawValue;
        break;
      case "out":
        options.outDir = rawValue;
        break;
      case "atlas-format":
        if (rawValue !== "png" && rawValue !== "webp" && rawValue !== "jpg") {
          throw new Error(`Unsupported atlas format: ${rawValue}`);
        }
        options.atlasFormat = rawValue;
        break;
      case "atlas-columns":
        options.atlasColumns = parsePositiveInteger(rawValue, key);
        break;
      case "atlas-rows":
        options.atlasRows = parsePositiveInteger(rawValue, key);
        break;
      case "atlas-frame-width":
        options.atlasFrameWidth = parsePositiveInteger(rawValue, key);
        options.atlasFrameSizeExplicit = true;
        break;
      case "atlas-frame-height":
        options.atlasFrameHeight = parsePositiveInteger(rawValue, key);
        options.atlasFrameSizeExplicit = true;
        break;
      case "min-duration-ms":
        options.segmentation.minDurationMs = parsePositiveInteger(rawValue, key);
        break;
      case "target-duration-ms":
        options.segmentation.targetDurationMs = parsePositiveInteger(rawValue, key);
        break;
      case "max-duration-ms":
        options.segmentation.maxDurationMs = parsePositiveInteger(rawValue, key);
        break;
      default:
        throw new Error(`Unknown flag: --${key}`);
    }
  }

  if (options.audioOnly && options.atlasesOnly) {
    throw new Error("Use either --audio-only or --atlases-only, not both.");
  }
  if ((options.atlasFrameWidth === null) !== (options.atlasFrameHeight === null)) {
    throw new Error("Use --atlas-frame-width and --atlas-frame-height together.");
  }
  if (
    options.segmentation.minDurationMs > options.segmentation.targetDurationMs ||
    options.segmentation.targetDurationMs > options.segmentation.maxDurationMs
  ) {
    throw new Error("--min-duration-ms must be <= --target-duration-ms, and --target-duration-ms must be <= --max-duration-ms");
  }

  return options;
}

function printHelpAndExit(): never {
  console.log(`Usage:
  npm run build:corpus -- --sources ./sources --out ./corpus

Options:
  --sources <dir>               Source video directory
  --out <dir>                   Output corpus directory
  --atlas-format <png|webp|jpg> Atlas image format
  --atlas-columns <n>           Tiles per atlas row
  --atlas-rows <n>              Tiles per atlas column
  --atlas-frame-width <n>       Atlas frame width in pixels (default: first source width)
  --atlas-frame-height <n>      Atlas frame height in pixels (default: first source height)
  --min-duration-ms <n>         Minimum unit duration in milliseconds
  --target-duration-ms <n>      Preferred unit duration in milliseconds
  --max-duration-ms <n>         Maximum unit duration in milliseconds
  --overwrite                   Replace existing exported assets
  --audio-only                  Export WAV assets without atlases
  --atlases-only                Export atlases without WAV assets
  --help                        Print this message`);
  process.exit(0);
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${flag} must be a positive integer`);
  }
  return parsed;
}

function logStep(message: string) {
  console.log(`  ${message}`);
}

function resolveAtlasFrameSize(options: CliOptions, probe: ProbedSource, label: string) {
  if (options.atlasFrameWidth === null && options.atlasFrameHeight === null) {
    options.atlasFrameWidth = probe.width;
    options.atlasFrameHeight = probe.height;
    logStep(`Using native atlas frame size ${probe.width}x${probe.height}`);
    return;
  }

  if (!options.atlasFrameSizeExplicit && (options.atlasFrameWidth !== probe.width || options.atlasFrameHeight !== probe.height)) {
    console.warn(
      `  Warning: ${label} is ${probe.width}x${probe.height}; corpus v1 uses shared ` +
        `${options.atlasFrameWidth}x${options.atlasFrameHeight} atlas tiles, preserving aspect with padding.`,
    );
  }
}

function requireAtlasDimension(value: number | null, label: string): number {
  if (value === null) {
    throw new Error(`Atlas frame ${label} was not resolved.`);
  }
  return value;
}

async function ensureCommandAvailable(commandName: string) {
  await runCommand(commandName, ["-version"]);
}

async function ensureReadableDirectory(directoryPath: string) {
  const stats = await fs.stat(directoryPath).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new Error(`Sources directory does not exist: ${directoryPath}`);
  }
}

async function ensureOutDir(outDir: string, overwrite: boolean) {
  const stats = await fs.stat(outDir).catch(() => null);
  if (!stats) {
    await fs.mkdir(outDir, { recursive: true });
    return;
  }

  if (!stats.isDirectory()) {
    throw new Error(`Output path exists but is not a directory: ${outDir}`);
  }

  if (!overwrite) {
    return;
  }

  await fs.rm(path.join(outDir, "audio"), { recursive: true, force: true });
  await fs.rm(path.join(outDir, "atlases"), { recursive: true, force: true });
  await fs.rm(path.join(outDir, "corpus.json"), { force: true });
}

async function discoverSources(
  sourcesDir: string,
  outDir: string,
  atlasFormat: AtlasFormat,
): Promise<SourceCandidate[]> {
  const entries = (await fs.readdir(sourcesDir, { withFileTypes: true })) as DirentLike[];
  const files = entries
    .filter((entry) => entry.isFile())
    .filter((entry) => SUPPORTED_VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .sort((left, right) => left.name.localeCompare(right.name));

  const usedIds = new Set<string>();

  return files.map((file) => {
    const label = file.name;
    const idBase = slugify(path.parse(file.name).name);
    const id = makeUniqueSourceId(idBase, usedIds);
    return {
      id,
      label,
      inputPath: path.join(sourcesDir, file.name),
      audioAssetPath: path.join(outDir, "audio", `${id}.wav`),
      atlasAssetPattern: path.join(outDir, "atlases", `${id}-%03d.${atlasFormat}`),
    };
  });
}

async function probeSource(inputPath: string): Promise<ProbedSource> {
  const { stdout } = await runCommand("ffprobe", [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    inputPath,
  ]);

  const payload = JSON.parse(stdout);
  const streams: ProbeStream[] = Array.isArray(payload.streams) ? payload.streams : [];
  const format = payload.format ?? {};
  const audioStream = streams.find((stream) => stream.codec_type === "audio");
  const videoStream = streams.find((stream) => stream.codec_type === "video");

  if (!audioStream) {
    throw new Error(`No audio stream found in ${inputPath}`);
  }
  if (!videoStream) {
    throw new Error(`No video stream found in ${inputPath}`);
  }

  const durationSeconds = Number.parseFloat(format.duration ?? videoStream.duration ?? audioStream.duration ?? "0");
  const sampleRate = Number.parseInt(audioStream.sample_rate ?? "0", 10);
  const channelCount = Number.parseInt(String(audioStream.channels ?? "0"), 10);
  const frameRate = parseFps(videoStream.avg_frame_rate ?? videoStream.r_frame_rate ?? "0/1");
  const width = Number.parseInt(String(videoStream.width ?? "0"), 10);
  const height = Number.parseInt(String(videoStream.height ?? "0"), 10);

  if (!durationSeconds || !sampleRate || !channelCount || !frameRate || !width || !height) {
    throw new Error(`Incomplete media metadata for ${inputPath}`);
  }

  return {
    durationMs: Math.round(durationSeconds * 1000),
    sampleRate,
    channelCount,
    frameRate,
    width,
    height,
  };
}

async function analyzeSource(inputPath: string, probe: ProbedSource): Promise<SourceAnalysis> {
  const monoSamples = await extractMonoAudioSamples(inputPath, probe.sampleRate);
  const audioFrames = analyzeAudioFrames(monoSamples, probe.sampleRate);
  const videoFrames = await extractVideoAnalysisFrames(inputPath, probe.frameRate);
  const totalDurationMs = Math.round((monoSamples.length / probe.sampleRate) * 1000);

  return {
    monoSamples,
    audioFrames,
    videoFrames,
    totalDurationMs: Math.max(totalDurationMs, probe.durationMs),
    totalFrameCount: videoFrames.length,
  };
}

async function exportAudioAsset(inputPath: string, outputPath: string, overwrite: boolean) {
  const args = [
    overwrite ? "-y" : "-n",
    "-i",
    inputPath,
    "-vn",
    "-acodec",
    "pcm_s16le",
    outputPath,
  ];
  await runCommand("ffmpeg", args);
}

async function exportAtlasAssets(
  candidate: SourceCandidate,
  totalFrameCount: number,
  frameRate: number,
  atlasesDir: string,
  options: CliOptions,
): Promise<string[]> {
  const tilesPerAtlas = options.atlasColumns * options.atlasRows;
  const atlasCount = Math.max(1, Math.ceil(totalFrameCount / tilesPerAtlas));

  const args = [
    options.overwrite ? "-y" : "-n",
    "-i",
    candidate.inputPath,
    "-an",
    "-vf",
    [
      `fps=${formatFps(frameRate)}`,
      `scale=${requireAtlasDimension(options.atlasFrameWidth, "width")}:${requireAtlasDimension(options.atlasFrameHeight, "height")}:force_original_aspect_ratio=decrease`,
      `pad=${requireAtlasDimension(options.atlasFrameWidth, "width")}:${requireAtlasDimension(options.atlasFrameHeight, "height")}:(ow-iw)/2:(oh-ih)/2`,
      `tile=${options.atlasColumns}x${options.atlasRows}:padding=0:margin=0`,
    ].join(","),
    "-frames:v",
    String(atlasCount),
    candidate.atlasAssetPattern,
  ];
  await runCommand("ffmpeg", args);

  const atlasAssets: string[] = [];
  for (let index = 1; index <= atlasCount; index += 1) {
    const assetName = `${candidate.id}-${String(index).padStart(3, "0")}.${options.atlasFormat}`;
    const assetPath = path.join(atlasesDir, assetName);
    const exists = await fs
      .stat(assetPath)
      .then((stats: { isFile(): boolean }) => stats.isFile())
      .catch(() => false);
    if (exists) {
      atlasAssets.push(assetPath);
    }
  }
  return atlasAssets;
}

function buildUnitsForSource(params: {
  analysis: SourceAnalysis;
  atlasAssets: string[];
  probe: ProbedSource;
  schema: typeof DEFAULT_DESCRIPTOR_SCHEMA;
  segmentation: typeof DEFAULT_SEGMENTATION_SPEC;
  sourceId: string;
  tilesPerAtlas: number;
}): UnitDraft[] {
  const { analysis, atlasAssets, probe, sourceId, segmentation, tilesPerAtlas } = params;
  const boundaries = computeSegmentationBoundaries(analysis.audioFrames, analysis.totalDurationMs, segmentation);
  const units: UnitDraft[] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startMs = boundaries[index];
    const endMs = boundaries[index + 1];
    const durationMs = Math.max(1, endMs - startMs);
    const audioStartSample = clamp(
      Math.round((startMs / 1000) * probe.sampleRate),
      0,
      Math.max(0, analysis.monoSamples.length - 1),
    );
    const audioEndSample = clamp(
      Math.round((endMs / 1000) * probe.sampleRate),
      audioStartSample + 1,
      analysis.monoSamples.length,
    );
    const videoStartFrame = clamp(
      Math.floor((startMs / 1000) * probe.frameRate),
      0,
      Math.max(0, analysis.totalFrameCount - 1),
    );
    const videoEndFrame = clamp(
      Math.ceil((endMs / 1000) * probe.frameRate),
      videoStartFrame + 1,
      analysis.totalFrameCount,
    );

    const unitId = `${sourceId}-u${String(index).padStart(4, "0")}`;
    const rawAudioDescriptors = aggregateAudioDescriptors(analysis.audioFrames, startMs, endMs);
    const rawVideoDescriptors = aggregateVideoDescriptors(
      analysis.videoFrames,
      videoStartFrame,
      videoEndFrame,
    );

    units.push({
      id: unitId,
      sourceId,
      sourceUnitIndex: index,
      startMs,
      durationMs,
      audioStartSample,
      audioSampleCount: Math.max(1, audioEndSample - audioStartSample),
      videoStartFrame,
      videoFrameCount: Math.max(1, videoEndFrame - videoStartFrame),
      videoAtlasSpans: buildAtlasSpans(videoStartFrame, Math.max(1, videoEndFrame - videoStartFrame), atlasAssets, tilesPerAtlas),
      rawAudioDescriptors,
      rawVideoDescriptors,
    });
  }

  for (let index = 0; index < units.length; index += 1) {
    if (index > 0) {
      units[index].prevUnitId = units[index - 1].id;
    }
    if (index < units.length - 1) {
      units[index].nextUnitId = units[index + 1].id;
    }
  }

  return units;
}

function computeSegmentationBoundaries(
  audioFrames: AudioAnalysisFrame[],
  totalDurationMs: number,
  segmentation: CorpusSegmentationSpec,
): number[] {
  if (totalDurationMs <= segmentation.maxDurationMs) {
    return [0, totalDurationMs];
  }

  const onsetTimes = detectOnsetTimes(audioFrames);
  const boundaries: number[] = [0];
  let cursor = 0;

  while (totalDurationMs - cursor > segmentation.maxDurationMs) {
    const minBoundary = cursor + segmentation.minDurationMs;
    const targetBoundary = cursor + segmentation.targetDurationMs;
    const maxBoundary = Math.min(cursor + segmentation.maxDurationMs, totalDurationMs);
    const candidates = onsetTimes.filter((timeMs) => timeMs >= minBoundary && timeMs <= maxBoundary);

    let boundary = maxBoundary;
    if (candidates.length > 0) {
      boundary = candidates.reduce((best, current) => {
        if (Math.abs(current - targetBoundary) < Math.abs(best - targetBoundary)) {
          return current;
        }
        return best;
      }, candidates[0]);
    }

    if (totalDurationMs - boundary < segmentation.minDurationMs) {
      boundary = totalDurationMs;
    }

    if (boundary <= cursor) {
      boundary = maxBoundary;
    }

    boundaries.push(boundary);
    cursor = boundary;
  }

  if (boundaries[boundaries.length - 1] !== totalDurationMs) {
    boundaries.push(totalDurationMs);
  }

  if (
    boundaries.length > 2 &&
    boundaries[boundaries.length - 1] - boundaries[boundaries.length - 2] < segmentation.minDurationMs
  ) {
    boundaries.splice(boundaries.length - 2, 1);
  }

  return boundaries;
}

function detectOnsetTimes(audioFrames: AudioAnalysisFrame[]): number[] {
  if (audioFrames.length < 3) {
    return [];
  }

  const strengths = audioFrames.map((frame) => frame.onsetStrength);
  const mean = average(strengths);
  const std = Math.sqrt(average(strengths.map((value) => (value - mean) ** 2)));
  const threshold = mean + std * 0.6;
  const onsets: number[] = [];

  for (let index = 1; index < audioFrames.length - 1; index += 1) {
    const current = audioFrames[index];
    const previous = audioFrames[index - 1];
    const next = audioFrames[index + 1];
    if (
      current.onsetStrength >= threshold &&
      current.onsetStrength >= previous.onsetStrength &&
      current.onsetStrength > next.onsetStrength
    ) {
      onsets.push(current.centerMs);
    }
  }

  return onsets;
}

function aggregateAudioDescriptors(audioFrames: AudioAnalysisFrame[], startMs: number, endMs: number): number[] {
  const slice = audioFrames.filter((frame) => frame.centerMs >= startMs && frame.centerMs < endMs);
  const frames = slice.length > 0 ? slice : [audioFrames[findClosestAudioFrameIndex(audioFrames, startMs)]];
  const pitchSummary = summarizePitchFrames(frames);

  return [
    average(frames.map((frame) => frame.rms)),
    average(frames.map((frame) => frame.spectralCentroid)),
    average(frames.map((frame) => frame.spectralFlatness)),
    average(frames.map((frame) => frame.spectralFlux)),
    pitchSummary.confidence,
    pitchSummary.hz,
  ];
}

function summarizePitchFrames(frames: AudioAnalysisFrame[]): { hz: number; confidence: number } {
  const candidates: { logHz: number; confidence: number; rms: number; weight: number }[] = [];
  const totalRms = frames.reduce((sum, frame) => sum + Math.max(frame.rms, 0), 0);

  for (const frame of frames) {
    if (frame.pitchHz <= 0 || frame.pitchConfidence <= 0) {
      continue;
    }
    const rms = Math.max(frame.rms, 0);
    const confidence = clamp(frame.pitchConfidence, 0, 1);
    candidates.push({
      logHz: Math.log2(frame.pitchHz),
      confidence,
      rms,
      weight: Math.max(rms * confidence * confidence, EPSILON),
    });
  }

  const weightSum = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (candidates.length === 0 || weightSum <= EPSILON) {
    return { hz: 0, confidence: 0 };
  }

  const logHz = weightedMedian(candidates, weightSum);
  const confidence = candidates.reduce((sum, candidate) => sum + candidate.confidence * candidate.weight, 0) / weightSum;
  const variance = candidates.reduce((sum, candidate) => {
    const delta = candidate.logHz - logHz;
    return sum + delta * delta * candidate.weight;
  }, 0) / weightSum;
  const spreadOctaves = Math.sqrt(variance);
  const pitchedRms = candidates.reduce((sum, candidate) => sum + candidate.rms, 0);
  const support = totalRms <= EPSILON ? 0 : clamp(pitchedRms / totalRms, 0, 1);
  const stability = clamp(1 - spreadOctaves / 0.35, 0, 1);
  const finalConfidence = confidence * support * stability;

  return {
    hz: finalConfidence <= 0.1 ? 0 : 2 ** logHz,
    confidence: finalConfidence,
  };
}

function weightedMedian(candidates: { logHz: number; weight: number }[], weightSum: number) {
  const sorted = [...candidates].sort((left, right) => left.logHz - right.logHz);
  let cumulative = 0;
  for (const candidate of sorted) {
    cumulative += candidate.weight;
    if (cumulative >= weightSum / 2) {
      return candidate.logHz;
    }
  }
  return sorted[sorted.length - 1]?.logHz ?? 0;
}

function aggregateVideoDescriptors(videoFrames: VideoAnalysisFrame[], startFrame: number, endFrame: number): number[] {
  if (videoFrames.length === 0) {
    return [0, 0, 0, 0, 0];
  }

  const slice = videoFrames.slice(startFrame, endFrame);
  const frames = slice.length > 0 ? slice : [videoFrames[Math.min(startFrame, videoFrames.length - 1)]];

  return [
    average(frames.map((frame) => frame.motionMagnitude)),
    average(frames.map((frame) => frame.frameDiffEnergy)),
    average(frames.map((frame) => frame.edgeDensity)),
    average(frames.map((frame) => frame.luminance)),
    average(frames.map((frame) => frame.saturation)),
  ];
}

function buildAtlasSpans(
  startFrame: number,
  frameCount: number,
  atlasAssets: string[],
  tilesPerAtlas: number,
): VideoAtlasSpan[] {
  if (atlasAssets.length === 0 || frameCount <= 0) {
    return [];
  }

  const spans: VideoAtlasSpan[] = [];
  let remaining = frameCount;
  let currentFrame = startFrame;

  while (remaining > 0) {
    const atlasIndex = Math.floor(currentFrame / tilesPerAtlas);
    const asset = atlasAssets[atlasIndex];
    if (!asset) {
      break;
    }

    const startTileIndex = currentFrame % tilesPerAtlas;
    const chunkFrameCount = Math.min(remaining, tilesPerAtlas - startTileIndex);
    spans.push({
      asset,
      startTileIndex,
      frameCount: chunkFrameCount,
      sourceStartFrame: currentFrame,
    });

    currentFrame += chunkFrameCount;
    remaining -= chunkFrameCount;
  }

  return spans;
}

function buildDescriptorNormalization(
  unitDrafts: UnitDraft[],
  schema: DescriptorSchema,
): DescriptorNormalization {
  const audio = buildFieldNormalization(schema.audio, unitDrafts.map((unit) => unit.rawAudioDescriptors));
  const video = buildFieldNormalization(schema.video, unitDrafts.map((unit) => unit.rawVideoDescriptors));

  const normalizedAudioVideo = unitDrafts.map((unit) => ({
    audio: normalizeVector(unit.rawAudioDescriptors, audio),
    video: normalizeVector(unit.rawVideoDescriptors, video),
  }));

  for (let index = 0; index < unitDrafts.length; index += 1) {
    unitDrafts[index].rawJointDescriptors = computeJointDescriptors(
      normalizedAudioVideo[index].audio,
      normalizedAudioVideo[index].video,
    );
  }

  const joint = buildFieldNormalization(
    schema.joint,
    unitDrafts.map((unit) => unit.rawJointDescriptors ?? [0, 0, 0]),
  );

  return {
    method: "min-max",
    descriptors: {
      audio,
      video,
      joint,
    },
  };
}

function finalizeUnits(
  unitDrafts: UnitDraft[],
  schema: DescriptorSchema,
  normalization: DescriptorNormalization,
): NormalizedUnit[] {
  return unitDrafts.map((unit) => {
    const normalizedAudio = normalizeVector(unit.rawAudioDescriptors, normalization.descriptors.audio);
    const normalizedVideo = normalizeVector(unit.rawVideoDescriptors, normalization.descriptors.video);
    const rawJoint = unit.rawJointDescriptors ?? computeJointDescriptors(normalizedAudio, normalizedVideo);
    const normalizedJoint = normalizeVector(rawJoint, normalization.descriptors.joint);

    return {
      id: unit.id,
      sourceId: unit.sourceId,
      sourceUnitIndex: unit.sourceUnitIndex,
      startMs: unit.startMs,
      durationMs: unit.durationMs,
      audioStartSample: unit.audioStartSample,
      audioSampleCount: unit.audioSampleCount,
      videoStartFrame: unit.videoStartFrame,
      videoFrameCount: unit.videoFrameCount,
      videoAtlasSpans: unit.videoAtlasSpans,
      prevUnitId: unit.prevUnitId,
      nextUnitId: unit.nextUnitId,
      rawDescriptors: {
        audio: unit.rawAudioDescriptors,
        video: unit.rawVideoDescriptors,
        joint: rawJoint,
      },
      descriptors: {
        audio: normalizedAudio,
        video: normalizedVideo,
        joint: normalizedJoint,
      },
    };
  });
}

function buildFieldNormalization<Field extends string>(
  fields: Field[],
  vectors: number[][],
): DescriptorFieldNormalization<Field>[] {
  return fields.map((field, fieldIndex) => {
    const values = vectors.map((vector) => vector[fieldIndex] ?? 0);
    let min = Math.min(...values);
    let max = Math.max(...values);

    if (!Number.isFinite(min)) {
      min = 0;
    }
    if (!Number.isFinite(max)) {
      max = 1;
    }
    if (Math.abs(max - min) < EPSILON) {
      max = min + 1;
    }

    return {
      field,
      min,
      max,
      clip: true,
    };
  });
}

function normalizeVector(vector: number[], fieldNormalization: FieldNormalization[]): number[] {
  return vector.map((value, index) => {
    const normalization = fieldNormalization[index];
    const range = normalization.max - normalization.min;
    const normalized = range <= EPSILON ? 0 : (value - normalization.min) / range;
    return clamp(normalized, 0, 1);
  });
}

function computeJointDescriptors(normalizedAudio: number[], normalizedVideo: number[]): number[] {
  return [
    (normalizedAudio[0] + normalizedVideo[0]) / 2,
    (normalizedAudio[3] + normalizedVideo[1]) / 2,
    (normalizedAudio[2] + normalizedVideo[2]) / 2,
  ];
}

function computeEmbedding2D(units: NormalizedUnit[]): [number, number][] {
  if (units.length === 0) {
    return [];
  }

  if (units.length === 1) {
    return [[0.5, 0.5]];
  }

  const matrix = units.map((unit) => [
    ...unit.descriptors.audio,
    ...unit.descriptors.video,
    ...unit.descriptors.joint,
  ]);
  const dimensionCount = matrix[0].length;
  const means = Array.from({ length: dimensionCount }, (_, dim) => average(matrix.map((row) => row[dim])));
  const centered = matrix.map((row) => row.map((value, dim) => value - means[dim]));
  const covariance = Array.from({ length: dimensionCount }, () => Array.from({ length: dimensionCount }, () => 0));

  for (const row of centered) {
    for (let left = 0; left < dimensionCount; left += 1) {
      for (let right = left; right < dimensionCount; right += 1) {
        covariance[left][right] += row[left] * row[right];
      }
    }
  }

  const scale = 1 / Math.max(1, centered.length - 1);
  for (let row = 0; row < dimensionCount; row += 1) {
    for (let col = row; col < dimensionCount; col += 1) {
      covariance[row][col] *= scale;
      covariance[col][row] = covariance[row][col];
    }
  }

  const firstComponent = powerIteration(covariance);
  const firstEigenvalue = dot(firstComponent, multiplyMatrixVector(covariance, firstComponent));
  const deflated = covariance.map((row, rowIndex) =>
    row.map((value, colIndex) => value - firstEigenvalue * firstComponent[rowIndex] * firstComponent[colIndex]),
  );
  const secondComponent = powerIteration(deflated);

  const projected = centered.map((row) => [dot(row, firstComponent), dot(row, secondComponent)]);
  const axisX = projected.map((value) => value[0]);
  const axisY = projected.map((value) => value[1]);
  const xMin = Math.min(...axisX);
  const xMax = Math.max(...axisX);
  const yMin = Math.min(...axisY);
  const yMax = Math.max(...axisY);

  return projected.map(([x, y]) => [
    xMax - xMin < EPSILON ? 0.5 : (x - xMin) / (xMax - xMin),
    yMax - yMin < EPSILON ? 0.5 : (y - yMin) / (yMax - yMin),
  ]);
}

function powerIteration(matrix: number[][], iterations = 32) {
  const dimensionCount = matrix.length;
  let vector = Array.from({ length: dimensionCount }, (_, index) => 1 / Math.sqrt(dimensionCount + index));

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const nextVector = multiplyMatrixVector(matrix, vector);
    const magnitude = Math.sqrt(dot(nextVector, nextVector));
    if (magnitude < EPSILON) {
      break;
    }
    vector = nextVector.map((value) => value / magnitude);
  }

  return vector;
}

function multiplyMatrixVector(matrix: number[][], vector: number[]) {
  return matrix.map((row) => dot(row, vector));
}

function dot(left: number[], right: number[]) {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] * right[index];
  }
  return sum;
}

async function extractMonoAudioSamples(inputPath: string, sampleRate: number): Promise<Float32Array> {
  const { stdout } = await runCommandBuffer("ffmpeg", [
    "-v",
    "error",
    "-i",
    inputPath,
    "-vn",
    "-ac",
    "1",
    "-ar",
    String(sampleRate),
    "-f",
    "f32le",
    "pipe:1",
  ]);

  if (stdout.byteLength % 4 !== 0) {
    throw new Error(`Unexpected PCM byte length while analyzing ${inputPath}`);
  }

  const sampleCount = stdout.byteLength / 4;
  return new Float32Array(stdout.buffer.slice(stdout.byteOffset, stdout.byteOffset + sampleCount * 4));
}

function analyzeAudioFrames(samples: Float32Array, sampleRate: number): AudioAnalysisFrame[] {
  const frames: AudioAnalysisFrame[] = [];
  const windowSize = AUDIO_WINDOW_SIZE;
  const hopSize = AUDIO_HOP_SIZE;
  const paddedLength = Math.max(samples.length, windowSize);
  let previousMagnitudes: number[] | null = null;
  let previousRms = 0;

  for (let startSample = 0; startSample < paddedLength; startSample += hopSize) {
    const real = new Array(windowSize).fill(0);
    const imag = new Array(windowSize).fill(0);

    for (let offset = 0; offset < windowSize; offset += 1) {
      const sampleIndex = startSample + offset;
      const sample = sampleIndex < samples.length ? samples[sampleIndex] : 0;
      real[offset] = sample * hann(offset, windowSize);
    }

    const rms = Math.sqrt(real.reduce((sum, value) => sum + value * value, 0) / windowSize);
    const pitch = estimatePitch(real, sampleRate, rms);
    fftInPlace(real, imag);

    const magnitudes: number[] = [];
    let sumMagnitude = 0;
    let weightedFrequencySum = 0;
    let logMagnitudeSum = 0;

    for (let bin = 1; bin < windowSize / 2; bin += 1) {
      const magnitude = Math.hypot(real[bin], imag[bin]);
      magnitudes.push(magnitude);
      sumMagnitude += magnitude;
      weightedFrequencySum += magnitude * ((bin * sampleRate) / windowSize);
      logMagnitudeSum += Math.log(Math.max(magnitude, EPSILON));
    }

    const spectralCentroid = sumMagnitude <= EPSILON ? 0 : weightedFrequencySum / sumMagnitude;
    const spectralFlatness =
      sumMagnitude <= EPSILON
        ? 0
        : Math.exp(logMagnitudeSum / magnitudes.length) / (sumMagnitude / magnitudes.length);

    let spectralFlux = 0;
    if (previousMagnitudes) {
      for (let bin = 0; bin < magnitudes.length; bin += 1) {
        spectralFlux += Math.max(0, magnitudes[bin] - previousMagnitudes[bin]);
      }
      spectralFlux /= magnitudes.length;
    }

    const rmsDelta = Math.max(0, rms - previousRms);
    const onsetStrength = spectralFlux * 0.7 + rmsDelta * 0.3;

    frames.push({
      centerMs: ((startSample + windowSize / 2) / sampleRate) * 1000,
      rms,
      spectralCentroid,
      spectralFlatness,
      spectralFlux,
      pitchConfidence: pitch.confidence,
      pitchHz: pitch.hz,
      onsetStrength,
    });

    previousMagnitudes = magnitudes;
    previousRms = rms;

    if (startSample + windowSize >= paddedLength) {
      break;
    }
  }

  return frames;
}

function estimatePitch(samples: number[], sampleRate: number, rms: number): { hz: number; confidence: number } {
  if (rms <= EPSILON) {
    return { hz: 0, confidence: 0 };
  }

  const minLag = Math.max(1, Math.floor(sampleRate / MAX_PITCH_HZ));
  const maxLag = Math.min(samples.length - 1, Math.ceil(sampleRate / MIN_PITCH_HZ));
  if (maxLag <= minLag) {
    return { hz: 0, confidence: 0 };
  }

  const differences = Array.from({ length: maxLag + 1 }, () => 0);
  for (let lag = 1; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let index = 0; index < samples.length - lag; index += 1) {
      const delta = samples[index] - samples[index + lag];
      sum += delta * delta;
    }
    differences[lag] = sum;
  }

  const normalized = Array.from({ length: maxLag + 1 }, () => 1);
  let runningSum = 0;
  for (let lag = 1; lag <= maxLag; lag += 1) {
    runningSum += differences[lag];
    normalized[lag] = runningSum <= EPSILON ? 1 : (differences[lag] * lag) / runningSum;
  }

  let bestLag = 0;
  let bestValue = Number.POSITIVE_INFINITY;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (normalized[lag] >= YIN_THRESHOLD) {
      continue;
    }
    while (lag + 1 <= maxLag && normalized[lag + 1] < normalized[lag]) {
      lag += 1;
    }
    bestLag = lag;
    bestValue = normalized[lag];
    break;
  }

  if (bestLag <= 0) {
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      if (normalized[lag] < bestValue) {
        bestValue = normalized[lag];
        bestLag = lag;
      }
    }
    if (bestValue > MAX_YIN_FALLBACK) {
      return { hz: 0, confidence: 0 };
    }
  }

  const refinedLag = clamp(refinePitchLag(normalized, bestLag), minLag, maxLag);
  return {
    hz: sampleRate / refinedLag,
    confidence: clamp(1 - bestValue, 0, 1),
  };
}

function refinePitchLag(values: number[], lag: number) {
  const previous = lag > 1 ? values[lag - 1] : values[lag];
  const current = values[lag];
  const next = lag + 1 < values.length ? values[lag + 1] : values[lag];
  const denominator = previous - 2 * current + next;
  if (Math.abs(denominator) <= EPSILON) {
    return lag;
  }

  return Math.max(1, lag + 0.5 * ((previous - next) / denominator));
}

async function extractVideoAnalysisFrames(inputPath: string, frameRate: number): Promise<VideoAnalysisFrame[]> {
  const { stdout } = await runCommandBuffer("ffmpeg", [
    "-v",
    "error",
    "-i",
    inputPath,
    "-an",
    "-vf",
    `fps=${formatFps(frameRate)},scale=${VIDEO_ANALYSIS_WIDTH}:${VIDEO_ANALYSIS_HEIGHT}`,
    "-pix_fmt",
    "rgb24",
    "-f",
    "rawvideo",
    "pipe:1",
  ]);

  const frameSize = VIDEO_ANALYSIS_WIDTH * VIDEO_ANALYSIS_HEIGHT * 3;
  if (stdout.byteLength % frameSize !== 0) {
    throw new Error(`Unexpected rawvideo byte length while analyzing ${inputPath}`);
  }

  const bytes = new Uint8Array(stdout.buffer, stdout.byteOffset, stdout.byteLength);
  const frameCount = stdout.byteLength / frameSize;
  const frames: VideoAnalysisFrame[] = [];
  let previousLuma: Float32Array | null = null;

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const frameOffset = frameIndex * frameSize;
    const pixelCount = VIDEO_ANALYSIS_WIDTH * VIDEO_ANALYSIS_HEIGHT;
    const currentLuma = new Float32Array(pixelCount);
    let luminanceSum = 0;
    let saturationSum = 0;

    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
      const rgbOffset = frameOffset + pixelIndex * 3;
      const red = bytes[rgbOffset];
      const green = bytes[rgbOffset + 1];
      const blue = bytes[rgbOffset + 2];
      const maxChannel = Math.max(red, green, blue);
      const minChannel = Math.min(red, green, blue);
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      currentLuma[pixelIndex] = luminance;
      luminanceSum += luminance / 255;
      saturationSum += maxChannel === 0 ? 0 : (maxChannel - minChannel) / maxChannel;
    }

    let frameDiffEnergy = 0;
    let motionPixelCount = 0;
    if (previousLuma) {
      for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
        const diff = Math.abs(currentLuma[pixelIndex] - previousLuma[pixelIndex]);
        frameDiffEnergy += diff / 255;
        if (diff >= MOTION_DIFF_THRESHOLD) {
          motionPixelCount += 1;
        }
      }
      frameDiffEnergy /= pixelCount;
    }

    let edgeHits = 0;
    let edgeComparisons = 0;
    for (let y = 0; y < VIDEO_ANALYSIS_HEIGHT; y += 1) {
      for (let x = 0; x < VIDEO_ANALYSIS_WIDTH; x += 1) {
        const index = y * VIDEO_ANALYSIS_WIDTH + x;
        if (x + 1 < VIDEO_ANALYSIS_WIDTH) {
          edgeComparisons += 1;
          if (Math.abs(currentLuma[index] - currentLuma[index + 1]) >= EDGE_DIFF_THRESHOLD) {
            edgeHits += 1;
          }
        }
        if (y + 1 < VIDEO_ANALYSIS_HEIGHT) {
          edgeComparisons += 1;
          if (
            Math.abs(currentLuma[index] - currentLuma[index + VIDEO_ANALYSIS_WIDTH]) >= EDGE_DIFF_THRESHOLD
          ) {
            edgeHits += 1;
          }
        }
      }
    }

    frames.push({
      luminance: luminanceSum / pixelCount,
      saturation: saturationSum / pixelCount,
      frameDiffEnergy,
      motionMagnitude: motionPixelCount / pixelCount,
      edgeDensity: edgeComparisons === 0 ? 0 : edgeHits / edgeComparisons,
    });

    previousLuma = currentLuma;
  }

  return frames;
}

function fftInPlace(real: number[], imag: number[]) {
  const size = real.length;
  if (size !== imag.length) {
    throw new Error("FFT real and imaginary buffers must have the same length");
  }
  if (size === 0 || (size & (size - 1)) !== 0) {
    throw new Error(`FFT size must be a power of two, got ${size}`);
  }

  let j = 0;

  for (let index = 0; index < size; index += 1) {
    if (index < j) {
      [real[index], real[j]] = [real[j], real[index]];
      [imag[index], imag[j]] = [imag[j], imag[index]];
    }

    let bit = size >> 1;
    while (bit > 0 && (j & bit) !== 0) {
      j &= ~bit;
      bit >>= 1;
    }
    j |= bit;
  }

  for (let length = 2; length <= size; length <<= 1) {
    const halfLength = length >> 1;
    const angleStep = (-2 * Math.PI) / length;
    for (let start = 0; start < size; start += length) {
      for (let offset = 0; offset < halfLength; offset += 1) {
        const angle = angleStep * offset;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const evenIndex = start + offset;
        const oddIndex = evenIndex + halfLength;
        const tempReal = real[oddIndex] * cos - imag[oddIndex] * sin;
        const tempImag = real[oddIndex] * sin + imag[oddIndex] * cos;

        real[oddIndex] = real[evenIndex] - tempReal;
        imag[oddIndex] = imag[evenIndex] - tempImag;
        real[evenIndex] += tempReal;
        imag[evenIndex] += tempImag;
      }
    }
  }
}

function hann(index: number, length: number) {
  return 0.5 * (1 - Math.cos((2 * Math.PI * index) / Math.max(1, length - 1)));
}

function findClosestAudioFrameIndex(audioFrames: AudioAnalysisFrame[], targetMs: number) {
  if (audioFrames.length === 0) {
    return 0;
  }

  let bestIndex = 0;
  let bestDistance = Math.abs(audioFrames[0].centerMs - targetMs);
  for (let index = 1; index < audioFrames.length; index += 1) {
    const distance = Math.abs(audioFrames[index].centerMs - targetMs);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }
  return bestIndex;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseFps(rawFps: string): number {
  if (!rawFps.includes("/")) {
    return Number.parseFloat(rawFps);
  }

  const [numeratorText, denominatorText] = rawFps.split("/");
  const numerator = Number.parseFloat(numeratorText);
  const denominator = Number.parseFloat(denominatorText);
  if (!numerator || !denominator) {
    return 0;
  }
  return numerator / denominator;
}

function formatFps(frameRate: number) {
  return Number.isInteger(frameRate) ? String(frameRate) : frameRate.toFixed(6);
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "source";
}

function makeUniqueSourceId(idBase: string, usedIds: Set<string>): string {
  let id = idBase;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${idBase}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function toPosixRelativePath(targetPath: string, fromDir: string): string {
  return path.relative(fromDir, targetPath).split(path.sep).join("/");
}

function runCommand(
  command: string,
  args: string[],
  options: { shell?: boolean } = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: options.shell ?? false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: { toString(): string }) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: { toString(): string }) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: unknown) => {
      reject(error);
    });

    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          [`Command failed: ${command} ${args.join(" ")}`, stderr.trim(), stdout.trim()]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    });
  });
}

function runCommandBuffer(
  command: string,
  args: string[],
  options: { shell?: boolean } = {},
): Promise<BufferCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: options.shell ?? false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stdoutChunks: Uint8Array[] = [];
    let stderr = "";

    child.stdout.on("data", (chunk: Uint8Array) => {
      stdoutChunks.push(Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk: { toString(): string }) => {
      stderr += chunk.toString();
    });

    child.on("error", (error: unknown) => {
      reject(error);
    });

    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve({ stdout: Buffer.concat(stdoutChunks), stderr });
        return;
      }

      reject(
        new Error(
          [`Command failed: ${command} ${args.join(" ")}`, stderr.trim()]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    });
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
