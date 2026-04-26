export type AVCorpus = {
  version: 1;
  sources: CorpusSource[];
  units: AVUnit[];
  descriptorSchema: DescriptorSchema;
};

export type CorpusSource = {
  id: string;
  label: string;
  audioAsset: string;
  videoAsset: string;
  atlasAsset?: string;
};

export type AVUnit = {
  id: string;
  sourceId: string;
  startMs: number;
  durationMs: number;
  audioStartSample: number;
  audioSampleCount: number;
  videoStartFrame: number;
  videoFrameCount: number;
  descriptors: {
    audio: number[];
    video: number[];
    joint: number[];
  };
  embedding2D?: [number, number];
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
  | "pitchConfidence";

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
  audio: ["rms", "spectralCentroid", "spectralFlatness", "spectralFlux", "pitchConfidence"],
  video: ["motionMagnitude", "frameDiffEnergy", "edgeDensity", "luminance", "saturation"],
  joint: ["activity", "attackness", "avRoughnessProxy"],
};
