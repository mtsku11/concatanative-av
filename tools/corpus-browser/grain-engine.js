import { disconnectVoice, stopVoice } from "./media-runtime.js";

export class GrainEngine {
  constructor({
    assetCache,
    sourcesById,
    unitsById,
    getTargetUnitId,
    getNearestRows,
    getControls,
    getDragging,
    isUnitAllowed,
    setLastGrainUnitId,
    getLastGrainUnitId,
    videoRenderer,
    statusElement,
  }) {
    this.assetCache = assetCache;
    this.sourcesById = sourcesById;
    this.unitsById = unitsById;
    this.getTargetUnitId = getTargetUnitId;
    this.getNearestRows = getNearestRows;
    this.getControls = getControls;
    this.getDragging = getDragging;
    this.isUnitAllowed = isUnitAllowed || (() => true);
    this.setLastGrainUnitId = setLastGrainUnitId;
    this.getLastGrainUnitId = getLastGrainUnitId;
    this.videoRenderer = videoRenderer;
    this.statusElement = statusElement;
    this.timerId = 0;
    this.activeGrains = new Set();
    this.audioFeedbackBus = null;
    this.recentUnitIds = [];
    this.stutterUnitId = null;
    this.stutterRemaining = 0;
    this.lastTargetUnitId = null;
    this.lastMode = null;
  }

  start() {
    if (this.timerId) {
      return;
    }
    this.scheduleNext(0);
  }

  stop() {
    if (this.timerId) {
      window.clearTimeout(this.timerId);
      this.timerId = 0;
    }
  }

  stopAll() {
    this.stop();
    for (const voice of this.activeGrains) {
      stopVoice(voice);
    }
    this.activeGrains.clear();
    this.audioFeedbackBus?.mute();
    this.videoRenderer.stopGrainPlayback();
    this.stutterUnitId = null;
    this.stutterRemaining = 0;
  }

  scheduleNext(delayMs) {
    this.timerId = window.setTimeout(async () => {
      this.timerId = 0;
      await this.fire().catch((error) => {
        console.error(error);
        this.statusElement.textContent = `Grain failed: ${String(error.message || error)}`;
      });

      if (this.getDragging()) {
        const controls = this.getControls();
        this.scheduleNext(1000 / Math.max(1, controls.rateHz));
      }
    }, delayMs);
  }

  async fire() {
    const unit = this.chooseUnit();
    if (!unit) {
      return;
    }

    const controls = this.getControls();
    this.pruneActiveGrains(controls.maxVoices);

    const audioContext = await this.assetCache.getAudioContext();
    const source = this.sourcesById.get(unit.sourceId);
    if (!source) {
      throw new Error(`Missing source: ${unit.sourceId}`);
    }

    const buffer = await this.assetCache.getAudioBuffer(source);
    const pitchRandom = controls.pitchRandomSemitones > 0
      ? (Math.random() * 2 - 1) * controls.pitchRandomSemitones
      : 0;
    const playbackRate = Math.pow(2, (controls.pitchSemitones + pitchRandom) / 12);
    const requestedDurationSeconds = Math.max(0, controls.durationMs / 1000);
    const offsetSeconds = unit.audioStartSample / source.sampleRate;
    const loopStartSeconds = offsetSeconds;
    const loopEndSeconds = Math.min(buffer.duration, offsetSeconds + unit.audioSampleCount / source.sampleRate);
    const unitDurationSeconds = Math.max(0, loopEndSeconds - loopStartSeconds);
    const audibleDurationSeconds = requestedDurationSeconds;
    const visualDurationSeconds = requestedDurationSeconds;
    const onePassAudibleDurationSeconds = unitDurationSeconds / playbackRate;
    const shouldLoopSource = audibleDurationSeconds > onePassAudibleDurationSeconds + 0.002;
    const sourceDurationSeconds = Math.min(unitDurationSeconds, audibleDurationSeconds * playbackRate);
    if (audibleDurationSeconds <= 0 || sourceDurationSeconds <= 0) {
      return;
    }

    const startTime = audioContext.currentTime + 0.005;
    const endTime = startTime + audibleDurationSeconds;
    const attackSeconds = Math.min(controls.attackMs / 1000, audibleDurationSeconds / 2);
    const releaseSeconds = Math.min(controls.releaseMs / 1000, audibleDurationSeconds / 2);
    const visualAttackSeconds = Math.min(controls.attackMs / 1000, visualDurationSeconds / 2);
    const visualReleaseSeconds = Math.min(controls.releaseMs / 1000, visualDurationSeconds / 2);
    const bufferSource = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    bufferSource.buffer = buffer;
    bufferSource.playbackRate.setValueAtTime(playbackRate, startTime);
    if (shouldLoopSource && loopEndSeconds > loopStartSeconds) {
      bufferSource.loop = true;
      bufferSource.loopStart = loopStartSeconds;
      bufferSource.loopEnd = loopEndSeconds;
    }
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(controls.gain, startTime + attackSeconds);
    gainNode.gain.setValueAtTime(controls.gain, Math.max(startTime + attackSeconds, endTime - releaseSeconds));
    gainNode.gain.linearRampToValueAtTime(0, endTime);
    bufferSource.connect(gainNode);
    gainNode.connect(this.getAudioOutput(audioContext, controls));

    const voice = { source: bufferSource, gainNode };
    this.activeGrains.add(voice);
    bufferSource.onended = () => {
      disconnectVoice(voice);
      this.activeGrains.delete(voice);
    };
    if (shouldLoopSource) {
      bufferSource.start(startTime, offsetSeconds);
    } else {
      bufferSource.start(startTime, offsetSeconds, sourceDurationSeconds);
    }
    bufferSource.stop(endTime + 0.005);

    this.setLastGrainUnitId(unit.id);
    this.rememberUnit(unit.id);
    this.statusElement.textContent = `Grain ${unit.id}`;
    this.videoRenderer.scheduleGrainPlayback(unit, source.frameRate, startTime, {
      durationSeconds: visualDurationSeconds,
      attackSeconds: visualAttackSeconds,
      releaseSeconds: visualReleaseSeconds,
      opacity: Math.min(0.9, Math.max(0.2, controls.gain)),
      blendMode: controls.blendMode,
      feedback: controls.feedback,
      decayMs: controls.decayMs,
      maxVoices: controls.maxVoices,
      loopFrames: visualDurationSeconds > onePassAudibleDurationSeconds + 0.002,
    });
  }

  getAudioOutput(audioContext, controls) {
    if (!this.audioFeedbackBus || this.audioFeedbackBus.audioContext !== audioContext) {
      this.audioFeedbackBus = new GrainAudioFeedbackBus(audioContext);
    }
    this.audioFeedbackBus.update(controls);
    return this.audioFeedbackBus.input;
  }

  chooseUnit() {
    const controls = this.getControls();
    const targetUnitId = this.getTargetUnitId();
    const target = this.unitsById.get(targetUnitId);
    if (!target) {
      return null;
    }

    if (this.lastTargetUnitId !== targetUnitId) {
      this.stutterUnitId = null;
      this.stutterRemaining = 0;
      this.lastTargetUnitId = targetUnitId;
    }
    if (this.lastMode !== controls.mode) {
      this.stutterUnitId = null;
      this.stutterRemaining = 0;
      this.lastMode = controls.mode;
    }

    if (controls.mode === "freeze") {
      return target;
    }

    if (controls.mode === "stutter") {
      const stutterUnit = this.unitsById.get(this.stutterUnitId);
      if (stutterUnit && this.isUnitAllowed(stutterUnit) && this.stutterRemaining > 0) {
        this.stutterRemaining -= 1;
        return stutterUnit;
      }

      const nextStutterUnit = this.chooseExploratoryUnit(target, controls);
      this.stutterUnitId = nextStutterUnit?.id || null;
      this.stutterRemaining = Math.max(0, Math.round(controls.stutterCount || 4) - 1);
      return nextStutterUnit;
    }

    return this.chooseExploratoryUnit(target, controls);
  }

  chooseExploratoryUnit(target, controls) {
    const previous = this.unitsById.get(this.getLastGrainUnitId());
    const next = previous?.nextUnitId ? this.unitsById.get(previous.nextUnitId) : null;
    if (next && this.isUnitAllowed(next) && Math.random() < controls.continuity) {
      return next;
    }

    const jitterPoolSize = Math.max(0, controls.neighborJitter) * 8;
    const candidateRows = [
      { id: target.id, distance: 0 },
      ...this.getNearestRows().slice(0, jitterPoolSize),
    ];
    const candidates = candidateRows
      .map((row) => ({
        unit: this.unitsById.get(row.id),
        distance: Number.isFinite(row.distance) ? row.distance : 0,
      }))
      .filter((candidate) => candidate.unit && this.isUnitAllowed(candidate.unit));
    if (!candidates.length) {
      return target;
    }

    return this.chooseWeightedCandidate(candidates, previous, controls).unit;
  }

  chooseWeightedCandidate(candidates, previous, controls) {
    const maxDistance = Math.max(...candidates.map((candidate) => candidate.distance), 0.001);
    const distanceScale = Math.max(maxDistance, 0.25);
    const scored = candidates.map((candidate) => ({
      ...candidate,
      adjustedDistance: candidate.distance
        + this.getRepetitionPenalty(candidate.unit.id, controls.repetitionPenalty) * distanceScale
        + this.getSourceSwitchPenalty(candidate.unit, previous, controls.sourceSwitchPenalty) * distanceScale,
    }));
    const temperature = distanceScale * (0.25 + Math.max(0, controls.neighborJitter) * 0.09);
    const weighted = scored.map((candidate) => ({
      candidate,
      weight: Math.exp(-candidate.adjustedDistance / Math.max(temperature, 0.001)),
    }));
    const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      return scored[0];
    }

    let threshold = Math.random() * totalWeight;
    for (const row of weighted) {
      threshold -= row.weight;
      if (threshold <= 0) {
        return row.candidate;
      }
    }
    return weighted[weighted.length - 1].candidate;
  }

  getRepetitionPenalty(unitId, amount) {
    const penaltyAmount = clamp(amount ?? 0, 0, 1);
    if (penaltyAmount <= 0) {
      return 0;
    }

    const recentIndex = this.recentUnitIds.lastIndexOf(unitId);
    if (recentIndex < 0) {
      return 0;
    }

    const recency = (recentIndex + 1) / this.recentUnitIds.length;
    return penaltyAmount * recency;
  }

  getSourceSwitchPenalty(unit, previous, amount) {
    const penaltyAmount = clamp(amount ?? 0, 0, 1);
    if (penaltyAmount <= 0 || !previous || unit.sourceId === previous.sourceId) {
      return 0;
    }
    return penaltyAmount;
  }

  rememberUnit(unitId) {
    this.recentUnitIds.push(unitId);
    while (this.recentUnitIds.length > 16) {
      this.recentUnitIds.shift();
    }
  }

  pruneActiveGrains(maxVoices) {
    while (this.activeGrains.size >= maxVoices) {
      const voice = this.activeGrains.values().next().value;
      if (!voice) {
        return;
      }
      stopVoice(voice);
      this.activeGrains.delete(voice);
    }
  }
}

class GrainAudioFeedbackBus {
  constructor(audioContext) {
    this.audioContext = audioContext;
    this.input = audioContext.createGain();
    this.dry = audioContext.createGain();
    this.delay = audioContext.createDelay(2.2);
    this.feedback = audioContext.createGain();
    this.wet = audioContext.createGain();
    this.filter = audioContext.createBiquadFilter();

    this.filter.type = "lowpass";
    this.filter.frequency.value = 7000;
    this.dry.gain.value = 1;
    this.wet.gain.value = 0;
    this.feedback.gain.value = 0;
    this.delay.delayTime.value = 0.18;

    this.input.connect(this.dry);
    this.dry.connect(audioContext.destination);
    this.input.connect(this.delay);
    this.delay.connect(this.wet);
    this.wet.connect(audioContext.destination);
    this.delay.connect(this.filter);
    this.filter.connect(this.feedback);
    this.feedback.connect(this.delay);
  }

  update(controls) {
    const now = this.audioContext.currentTime;
    const feedbackAmount = clamp(controls.feedback ?? 0, 0, 0.9);
    const decaySeconds = clamp((controls.decayMs ?? 450) / 1000, 0.04, 2);
    const delaySeconds = clamp(decaySeconds / 6, 0.025, 0.18);
    const wetGain = feedbackAmount * 0.55;
    const decayFeedback = Math.pow(0.001, delaySeconds / Math.max(decaySeconds, delaySeconds));
    const feedbackGain = Math.min(0.88, feedbackAmount * decayFeedback);

    this.delay.delayTime.setTargetAtTime(delaySeconds, now, 0.025);
    this.wet.gain.setTargetAtTime(wetGain, now, 0.02);
    this.feedback.gain.setTargetAtTime(feedbackGain, now, 0.02);
  }

  mute() {
    const now = this.audioContext.currentTime;
    this.wet.gain.cancelScheduledValues(now);
    this.feedback.gain.cancelScheduledValues(now);
    this.wet.gain.setTargetAtTime(0, now, 0.015);
    this.feedback.gain.setTargetAtTime(0, now, 0.015);
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
