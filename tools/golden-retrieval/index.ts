const fs = require("node:fs/promises");
const path = require("node:path");

type CliOptions = {
  healthPath: string;
  snapshotPath: string;
  write: boolean;
  distanceTolerance: number;
};

type HealthSummary = {
  generatedAt?: string;
  corpusPath: string;
  sourcesPath: string;
  summary: {
    sourceCount: number;
    unitCount: number;
    issueCount: number;
    warningCount: number;
  };
  sources: Array<{
    id?: string;
    label: string;
    metadata?: {
      durationMs: number;
      frameRate: number;
      width: number;
      height: number;
      sampleRate: number;
      channelCount: number;
      videoCodec: string;
      audioCodec: string;
      container: string;
    };
  }>;
  fixedQueryRegression: Array<{
    queryUnitId: string;
    sourceId: string;
    startMs: number;
    matches: Array<{
      unitId: string;
      sourceId: string;
      startMs: number;
      durationMs: number;
      distance: number;
    }>;
  }>;
};

type GoldenSnapshot = {
  version: 1;
  name: string;
  createdAt: string;
  sourceLabels: string[];
  sourceMetadata: Array<{
    label: string;
    durationMs?: number;
    frameRate?: number;
    width?: number;
    height?: number;
    sampleRate?: number;
    channelCount?: number;
    videoCodec?: string;
    audioCodec?: string;
    container?: string;
  }>;
  unitCount: number;
  queries: Array<{
    queryUnitId: string;
    sourceId: string;
    startMs: number;
    matches: Array<{
      rank: number;
      unitId: string;
      sourceId: string;
      startMs: number;
      durationMs: number;
      distance: number;
    }>;
  }>;
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const health = JSON.parse(await fs.readFile(path.resolve(options.healthPath), "utf8")) as HealthSummary;
  const snapshot = buildSnapshot(health);

  if (options.write) {
    const snapshotPath = path.resolve(options.snapshotPath);
    await fs.mkdir(path.dirname(snapshotPath), { recursive: true });
    await fs.writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.log(`Wrote ${snapshotPath}`);
    return;
  }

  const expected = JSON.parse(await fs.readFile(path.resolve(options.snapshotPath), "utf8")) as GoldenSnapshot;
  const failures = compareSnapshots(expected, snapshot, options.distanceTolerance);
  if (failures.length) {
    console.error(`Golden retrieval comparison failed with ${failures.length} mismatch(es):`);
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Golden retrieval comparison passed: ${snapshot.queries.length} query snapshot(s).`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    healthPath: "./reports/corpus-health/health-summary.json",
    snapshotPath: "./test-fixtures/golden/canaries/retrieval-snapshot.json",
    write: false,
    distanceTolerance: 1e-6,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--help") {
      printHelp();
      return options;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;

    switch (key) {
      case "health":
        options.healthPath = value;
        break;
      case "snapshot":
        options.snapshotPath = value;
        break;
      case "distance-tolerance":
        options.distanceTolerance = parseNonNegativeNumber(value, key);
        break;
      default:
        throw new Error(`Unknown flag: --${key}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  npm run golden:canaries:write
  npm run test:golden:canaries

Options:
  --health <file>              health-summary.json path
  --snapshot <file>            golden snapshot path
  --distance-tolerance <n>     allowed distance drift when comparing
  --write                      write snapshot instead of comparing
  --help                       print this message`);
}

function buildSnapshot(health: HealthSummary): GoldenSnapshot {
  return {
    version: 1,
    name: "canaries",
    createdAt: health.generatedAt || new Date().toISOString(),
    sourceLabels: health.sources.map((source) => source.label),
    sourceMetadata: health.sources.map((source) => ({
      label: source.label,
      durationMs: source.metadata?.durationMs,
      frameRate: source.metadata?.frameRate,
      width: source.metadata?.width,
      height: source.metadata?.height,
      sampleRate: source.metadata?.sampleRate,
      channelCount: source.metadata?.channelCount,
      videoCodec: source.metadata?.videoCodec,
      audioCodec: source.metadata?.audioCodec,
      container: source.metadata?.container,
    })),
    unitCount: health.summary.unitCount,
    queries: health.fixedQueryRegression.map((query) => ({
      queryUnitId: query.queryUnitId,
      sourceId: query.sourceId,
      startMs: roundForSnapshot(query.startMs),
      matches: query.matches.map((match, index) => ({
        rank: index + 1,
        unitId: match.unitId,
        sourceId: match.sourceId,
        startMs: roundForSnapshot(match.startMs),
        durationMs: roundForSnapshot(match.durationMs),
        distance: roundForSnapshot(match.distance),
      })),
    })),
  };
}

function compareSnapshots(expected: GoldenSnapshot, actual: GoldenSnapshot, distanceTolerance: number): string[] {
  const failures: string[] = [];
  if (expected.unitCount !== actual.unitCount) {
    failures.push(`unit count changed: expected ${expected.unitCount}, got ${actual.unitCount}`);
  }
  if (expected.sourceLabels.join("|") !== actual.sourceLabels.join("|")) {
    failures.push(`source labels changed: expected ${expected.sourceLabels.join(", ")}, got ${actual.sourceLabels.join(", ")}`);
  }
  if (expected.queries.length !== actual.queries.length) {
    failures.push(`query count changed: expected ${expected.queries.length}, got ${actual.queries.length}`);
  }

  const queryCount = Math.min(expected.queries.length, actual.queries.length);
  for (let queryIndex = 0; queryIndex < queryCount; queryIndex += 1) {
    const expectedQuery = expected.queries[queryIndex];
    const actualQuery = actual.queries[queryIndex];
    if (expectedQuery.queryUnitId !== actualQuery.queryUnitId) {
      failures.push(`query ${queryIndex + 1} changed: expected ${expectedQuery.queryUnitId}, got ${actualQuery.queryUnitId}`);
      continue;
    }

    const matchCount = Math.min(expectedQuery.matches.length, actualQuery.matches.length);
    if (expectedQuery.matches.length !== actualQuery.matches.length) {
      failures.push(`${expectedQuery.queryUnitId} match count changed: expected ${expectedQuery.matches.length}, got ${actualQuery.matches.length}`);
    }
    for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
      const expectedMatch = expectedQuery.matches[matchIndex];
      const actualMatch = actualQuery.matches[matchIndex];
      const rank = matchIndex + 1;
      if (expectedMatch.unitId !== actualMatch.unitId) {
        failures.push(`${expectedQuery.queryUnitId} rank ${rank} changed: expected ${expectedMatch.unitId}, got ${actualMatch.unitId}`);
      }
      if (Math.abs(expectedMatch.distance - actualMatch.distance) > distanceTolerance) {
        failures.push(
          `${expectedQuery.queryUnitId} rank ${rank} distance changed: expected ${expectedMatch.distance}, got ${actualMatch.distance}`,
        );
      }
    }
  }

  return failures;
}

function parseNonNegativeNumber(value: string, flag: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${flag} must be a non-negative number`);
  }
  return parsed;
}

function roundForSnapshot(value: number): number {
  return Number(value.toFixed(6));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
