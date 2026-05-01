export type AVCorpus = {
  version: 1;
  sources: CorpusSource[];
  units: AVUnit[];
  descriptorSchema: DescriptorSchema;
  descriptorNormalization: DescriptorNormalization;
  media: CorpusMediaSpec;
  segmentation: CorpusSegmentationSpec;
  embedding?: CorpusEmbeddingSpec;
};

export type CorpusSource = {
  id: string;
  label: string;
  durationMs: number;
  sampleRate: number;
  channelCount: number;
  frameRate: number;
  width: number;
  height: number;
  originalAsset?: string;
  audioAsset: string;
  videoAsset?: string;
  atlasAssets: string[];
};

export type AVUnit = {
  id: string;
  sourceId: string;
  sourceUnitIndex: number;
  startMs: number;
  durationMs: number;
  audioStartSample: number;
  audioSampleCount: number;
  videoStartFrame: number;
  videoFrameCount: number;
  videoAtlasSpans: VideoAtlasSpan[];
  prevUnitId?: string;
  nextUnitId?: string;
  rawDescriptors?: DescriptorVectors;
  // Normalized retrieval-space values. Indices match descriptorSchema.
  descriptors: DescriptorVectors;
  embedding2D?: [number, number];
};

export type DescriptorVectors = {
  audio: number[];
  video: number[];
  joint: number[];
};

export type CorpusMediaSpec = {
  audio: {
    strategy: "source-file";
    format: "wav";
  };
  video: {
    strategy: "atlas";
    format: "png" | "webp" | "jpg";
    frameWidth: number;
    frameHeight: number;
    columns: number;
    rows: number;
  };
};

export type VideoAtlasSpan = {
  asset: string;
  startTileIndex: number;
  frameCount: number;
  sourceStartFrame: number;
};

export type CorpusSegmentationSpec = {
  strategy: "hybrid-onset";
  minDurationMs: number;
  targetDurationMs: number;
  maxDurationMs: number;
};

export type CorpusEmbeddingSpec = {
  method: "pca";
  source: "normalized-descriptors";
};

export type DescriptorNormalization = {
  method: "min-max";
  descriptors: {
    audio: DescriptorFieldNormalization<AudioDescriptorField>[];
    video: DescriptorFieldNormalization<VideoDescriptorField>[];
    joint: DescriptorFieldNormalization<JointDescriptorField>[];
  };
};

export type DescriptorFieldNormalization<Field extends string> = {
  field: Field;
  min: number;
  max: number;
  clip: boolean;
};

// Ordered field names — indices match the descriptor arrays above.
export type DescriptorSchema = {
  audio: AudioDescriptorField[];
  video: VideoDescriptorField[];
  joint: JointDescriptorField[];
};

export type AudioDescriptorField =
  | "rms"
  | "spectralCentroid"
  | "spectralFlatness"
  | "spectralFlux"
  | "pitchConfidence"
  | "pitchHz";

export type VideoDescriptorField =
  | "motionMagnitude"
  | "frameDiffEnergy"
  | "edgeDensity"
  | "luminance"
  | "saturation";

export type JointDescriptorField =
  | "activity"
  | "attackness"
  | "avRoughnessProxy";

export const DEFAULT_DESCRIPTOR_SCHEMA: DescriptorSchema = {
  audio: ["rms", "spectralCentroid", "spectralFlatness", "spectralFlux", "pitchConfidence", "pitchHz"],
  video: ["motionMagnitude", "frameDiffEnergy", "edgeDensity", "luminance", "saturation"],
  joint: ["activity", "attackness", "avRoughnessProxy"],
};

export const DEFAULT_SEGMENTATION_SPEC: CorpusSegmentationSpec = {
  strategy: "hybrid-onset",
  minDurationMs: 60,
  targetDurationMs: 120,
  maxDurationMs: 240,
};
