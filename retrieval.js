export const DISTANCE_MODES = {
  balanced: {
    label: "Balanced",
    weights: { audio: 1, video: 1, joint: 1 },
  },
  audio: {
    label: "Audio Focus",
    weights: { audio: 1, video: 0.25, joint: 0.5 },
  },
  video: {
    label: "Video Focus",
    weights: { audio: 0.25, video: 1, joint: 0.5 },
  },
  joint: {
    label: "Joint Focus",
    weights: { audio: 0.35, video: 0.35, joint: 1 },
  },
  pitch: {
    label: "Pitch Focus",
    weights: { audio: 1, video: 0, joint: 0 },
    descriptorWeights: {
      audio: {
        rms: 0.15,
        spectralCentroid: 0.25,
        spectralFlatness: 0.15,
        spectralFlux: 0.1,
        pitchConfidence: 0.75,
        pitchHz: 6,
      },
    },
  },
};

export function getDistanceWeights(mode) {
  return DISTANCE_MODES[mode] || DISTANCE_MODES.balanced;
}

export function computeNearestRows(units, target, distanceConfig, limit, schema) {
  if (!target) {
    return [];
  }

  return units
    .filter((unit) => unit.id !== target.id)
    .map((unit) => ({
      id: unit.id,
      distance: descriptorDistance(target.descriptors, unit.descriptors, distanceConfig, schema),
    }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, limit);
}

export function descriptorDistance(left, right, distanceConfig, schema) {
  const weights = distanceConfig.weights || distanceConfig;
  const descriptorWeights = distanceConfig.descriptorWeights || {};
  let sum = 0;
  for (const key of ["audio", "video", "joint"]) {
    const weight = weights[key] ?? 0;
    if (weight <= 0) {
      continue;
    }
    const leftValues = left[key] || [];
    const rightValues = right[key] || [];
    const count = Math.min(leftValues.length, rightValues.length);
    for (let index = 0; index < count; index += 1) {
      const delta = leftValues[index] - rightValues[index];
      const field = schema?.[key]?.[index];
      const fieldWeight = field ? descriptorWeights[key]?.[field] ?? 1 : 1;
      if (fieldWeight <= 0) {
        continue;
      }
      sum += weight * fieldWeight * delta * delta;
    }
  }
  return Math.sqrt(sum);
}

export function buildAxisOptions(schema) {
  const options = [
    { value: "embedding:x", label: "PCA 1" },
    { value: "embedding:y", label: "PCA 2" },
    { value: "unit:durationMs", label: "Unit / duration" },
  ];

  for (const group of ["audio", "video", "joint"]) {
    for (const field of schema[group] || []) {
      options.push({
        value: `${group}:${field}`,
        label: `${titleCase(group)} / ${field}`,
      });
      if (field === "pitchHz") {
        options.push({
          value: `${group}:${field}:midi`,
          label: `${titleCase(group)} / pitchHz (log raw)`,
        });
        options.push({
          value: `${group}:${field}:raw`,
          label: `${titleCase(group)} / pitchHz (raw Hz)`,
        });
      } else if (field === "pitchConfidence") {
        options.push({
          value: `${group}:${field}:raw`,
          label: `${titleCase(group)} / pitchConfidence (raw)`,
        });
      }
    }
  }

  return options;
}

export function getAxisValue(unit, axisKey, schema) {
  if (axisKey === "embedding:x") {
    return unit.embedding2D?.[0] ?? 0;
  }
  if (axisKey === "embedding:y") {
    return unit.embedding2D?.[1] ?? 0;
  }
  if (axisKey === "unit:durationMs") {
    return unit.durationMs;
  }

  const [group, field, transform] = axisKey.split(":");
  const fields = schema[group] || [];
  const index = fields.indexOf(field);
  if (index < 0) {
    return Number.NaN;
  }
  if (transform === "raw") {
    return unit.rawDescriptors?.[group]?.[index] ?? Number.NaN;
  }
  if (transform === "midi") {
    return hzToMidi(unit.rawDescriptors?.[group]?.[index] ?? Number.NaN);
  }
  return unit.descriptors?.[group]?.[index] ?? Number.NaN;
}

export function getRawDescriptorValue(unit, schema, group, field) {
  const fields = schema[group] || [];
  const index = fields.indexOf(field);
  if (index < 0) {
    return Number.NaN;
  }
  return unit.rawDescriptors?.[group]?.[index] ?? Number.NaN;
}

export function unitPassesPitchGate(unit, schema, minConfidence) {
  if (!minConfidence || minConfidence <= 0) {
    return true;
  }
  const confidence = getRawDescriptorValue(unit, schema, "audio", "pitchConfidence");
  return Number.isFinite(confidence) && confidence >= minConfidence;
}

function hzToMidi(hz) {
  if (!Number.isFinite(hz) || hz <= 0) {
    return Number.NaN;
  }
  return 69 + 12 * Math.log2(hz / 440);
}

function titleCase(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
