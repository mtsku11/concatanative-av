export class CorpusAssetCache {
  constructor(config) {
    this.config = config;
    this.audioContext = null;
    this.audioBuffers = new Map();
    this.atlasImages = new Map();
  }

  async getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  async getAudioBuffer(source) {
    if (this.audioBuffers.has(source.id)) {
      return this.audioBuffers.get(source.id);
    }

    const response = await fetch(`${this.config.corpusBaseUrl}/${source.audioAsset}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio asset: ${source.audioAsset}`);
    }
    const data = await response.arrayBuffer();
    const audioContext = await this.getAudioContext();
    const decoded = await audioContext.decodeAudioData(data.slice(0));
    this.audioBuffers.set(source.id, decoded);
    return decoded;
  }

  async getAtlasImage(assetPath) {
    if (this.atlasImages.has(assetPath)) {
      return this.atlasImages.get(assetPath);
    }

    const image = new Image();
    image.decoding = "async";
    image.src = `${this.config.corpusBaseUrl}/${assetPath}`;
    await image.decode();
    this.atlasImages.set(assetPath, image);
    return image;
  }
}

export class UnitAudioPreview {
  constructor({ assetCache, sourcesById, statusElement }) {
    this.assetCache = assetCache;
    this.sourcesById = sourcesById;
    this.statusElement = statusElement;
    this.playbackToken = 0;
    this.currentBufferSource = null;
    this.currentGainNode = null;
  }

  async play(unit, options = {}) {
    if (!unit) {
      return;
    }

    this.stop({ redraw: false, fadeOutSeconds: options.fadeOutSeconds ?? 0.025 });
    const token = ++this.playbackToken;

    try {
      const audioContext = await this.assetCache.getAudioContext();
      const source = this.sourcesById.get(unit.sourceId);
      if (!source) {
        throw new Error(`Missing source: ${unit.sourceId}`);
      }

      const buffer = await this.assetCache.getAudioBuffer(source);
      const offsetSeconds = unit.audioStartSample / source.sampleRate;
      const durationSeconds = unit.audioSampleCount / source.sampleRate;
      const leadTimeSeconds = options.leadTimeSeconds ?? 0.005;
      const startTime = audioContext.currentTime + leadTimeSeconds;
      const bufferSource = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      bufferSource.buffer = buffer;
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, startTime + 0.01);
      bufferSource.connect(gainNode);
      gainNode.connect(audioContext.destination);
      this.currentBufferSource = bufferSource;
      this.currentGainNode = gainNode;
      bufferSource.start(startTime, offsetSeconds, durationSeconds);

      this.statusElement.textContent = `Playing ${unit.id}`;
      bufferSource.onended = () => {
        if (token !== this.playbackToken) {
          return;
        }
        disconnectVoice({ source: bufferSource, gainNode });
        this.currentBufferSource = null;
        this.currentGainNode = null;
        this.statusElement.textContent = `Finished ${unit.id}`;
      };

      return { startTime, source, token };
    } catch (error) {
      console.error(error);
      this.statusElement.textContent = `Playback failed: ${String(error.message || error)}`;
      return null;
    }
  }

  stop(options = {}) {
    this.playbackToken += 1;
    if (!this.currentBufferSource) {
      return;
    }

    const source = this.currentBufferSource;
    const gainNode = this.currentGainNode;
    const fadeOutSeconds = options.fadeOutSeconds ?? 0;
    const audioContext = this.assetCache.audioContext;
    if (fadeOutSeconds > 0 && gainNode && audioContext) {
      const stopTime = audioContext.currentTime + fadeOutSeconds;
      gainNode.gain.cancelScheduledValues(audioContext.currentTime);
      gainNode.gain.setTargetAtTime(0, audioContext.currentTime, fadeOutSeconds / 3);
      source.stop(stopTime);
      window.setTimeout(() => disconnectVoice({ source, gainNode }), fadeOutSeconds * 1000 + 25);
    } else {
      stopVoice({ source, gainNode });
    }
    this.currentBufferSource = null;
    this.currentGainNode = null;
  }
}

export class AtlasVideoRenderer {
  constructor({ corpus, assetCache, canvas, fadeCanvas, getControls, statusElement }) {
    this.corpus = corpus;
    this.assetCache = assetCache;
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.canvasStack = canvas.parentElement;
    this.fadeCanvas = fadeCanvas;
    this.fadeContext = fadeCanvas?.getContext("2d") || null;
    this.getControls = getControls || (() => ({ crossfadeMs: 0 }));
    this.statusElement = statusElement;
    this.rafId = 0;
    this.visualGrainRafId = 0;
    this.playbackToken = 0;
    this.visualGrainId = 0;
    this.visualGrains = [];
    this.visualFeedback = { amount: 0, decaySeconds: 0.45 };
    this.visualFeedbackUntil = 0;
    this.lastVisualRenderAt = 0;
    this.configureCanvasAspectRatio();
  }

  async drawPosterFrame(unit, statusLabel = null) {
    const token = ++this.playbackToken;
    this.stopFrameLoop();
    this.stopGrainPlayback();
    const firstFrame = await this.buildFrameList(unit).then((frames) => frames[0]).catch(() => null);
    if (token !== this.playbackToken) {
      return;
    }
    if (!firstFrame) {
      this.clear("No atlas frames");
      return;
    }
    this.drawAtlasTile(firstFrame.image, firstFrame.tileIndex, { crossfade: true });
    this.statusElement.textContent = statusLabel || `Poster frame from ${unit.id}`;
  }

  schedulePlayback(unit, frameRate, audioStartTime) {
    const token = ++this.playbackToken;
    this.stopFrameLoop();
    this.stopGrainPlayback();
    this.scheduleFrames(unit, frameRate, audioStartTime, () => token === this.playbackToken, true);
  }

  scheduleGrainPlayback(unit, frameRate, audioStartTime, options = {}) {
    this.stopFrameLoop();
    this.resetFadeLayer();
    this.playbackToken += 1;
    this.buildFrameList(unit)
      .then((frames) => {
        if (!frames.length) {
          return;
        }

        const audioContext = this.assetCache.audioContext;
        if (!audioContext) {
          return;
        }

        const durationSeconds = Math.max(0, options.durationSeconds ?? unit.durationMs / 1000);
        if (durationSeconds <= 0 || audioContext.currentTime > audioStartTime + durationSeconds) {
          return;
        }

        if (!this.visualGrains.length && !this.visualGrainRafId) {
          this.clearVideoSurface();
        }

        const feedbackAmount = clamp(options.feedback ?? 0, 0, 0.9);
        const decaySeconds = clamp((options.decayMs ?? 450) / 1000, 0.04, 2);
        const visualGrain = {
          id: ++this.visualGrainId,
          frames,
          frameRate,
          startTime: audioStartTime,
          endTime: audioStartTime + durationSeconds,
          durationSeconds,
          attackSeconds: Math.max(0, options.attackSeconds ?? 0.008),
          releaseSeconds: Math.max(0, options.releaseSeconds ?? 0.035),
          opacity: clamp(options.opacity ?? 0.75, 0, 1),
          blendMode: options.blendMode || "source-over",
          feedback: feedbackAmount,
          decaySeconds,
          loopFrames: Boolean(options.loopFrames),
        };

        this.visualGrains.push(visualGrain);
        this.visualFeedback = { amount: feedbackAmount, decaySeconds };
        if (feedbackAmount > 0) {
          const tailSeconds = decaySeconds * (1 + feedbackAmount * 4);
          this.visualFeedbackUntil = Math.max(this.visualFeedbackUntil, visualGrain.endTime + tailSeconds);
        }
        this.pruneVisualGrains(options.maxVoices ?? 12);
        this.ensureVisualGrainLoop();
      })
      .catch((error) => {
        console.error(error);
        this.statusElement.textContent = `Video grain failed: ${String(error.message || error)}`;
      });
  }

  scheduleFrames(unit, frameRate, audioStartTime, isCurrent, trackRaf) {
    this.buildFrameList(unit)
      .then((frames) => {
        if (!frames.length || !isCurrent()) {
          return;
        }

        const audioContext = this.assetCache.audioContext;
        const frameDurationSeconds = frameRate > 0 ? 1 / frameRate : unit.durationMs / 1000 / frames.length;
        const wallClockStart = performance.now() + Math.max(0, audioStartTime - audioContext.currentTime) * 1000;
        let previousFrameIndex = -1;

        const tick = () => {
          if (!isCurrent()) {
            return;
          }

          const elapsedSeconds = Math.max(0, (performance.now() - wallClockStart) / 1000);
          const frameIndex = Math.min(frames.length - 1, Math.floor(elapsedSeconds / frameDurationSeconds));
          const frame = frames[frameIndex];
          if (frameIndex !== previousFrameIndex) {
            this.drawAtlasTile(frame.image, frame.tileIndex, { crossfade: previousFrameIndex === -1 });
            previousFrameIndex = frameIndex;
          }

          if (frameIndex < frames.length - 1) {
            const rafId = requestAnimationFrame(tick);
            if (trackRaf) {
              this.rafId = rafId;
            }
          }
        };

        tick();
      })
      .catch((error) => {
        console.error(error);
        this.statusElement.textContent = `Video preview failed: ${String(error.message || error)}`;
      });
  }

  stopPreview() {
    this.playbackToken += 1;
    this.stopFrameLoop();
  }

  stopFrameLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.resetFadeLayer();
  }

  stopGrainPlayback() {
    this.visualGrains = [];
    if (this.visualGrainRafId) {
      cancelAnimationFrame(this.visualGrainRafId);
      this.visualGrainRafId = 0;
    }
    this.clearVideoSurface();
  }

  pruneVisualGrains(maxVoices) {
    while (this.visualGrains.length > maxVoices) {
      this.visualGrains.shift();
    }
  }

  ensureVisualGrainLoop() {
    if (this.visualGrainRafId) {
      return;
    }
    this.visualGrainRafId = requestAnimationFrame(() => this.renderVisualGrains());
  }

  renderVisualGrains() {
    this.visualGrainRafId = 0;
    const audioContext = this.assetCache.audioContext;
    if (!audioContext) {
      return;
    }

    const now = audioContext.currentTime;
    this.visualGrains = this.visualGrains.filter((grain) => now <= grain.endTime && grain.frames.length);
    const hasFeedbackTail = this.visualFeedback.amount > 0 && now <= this.visualFeedbackUntil;
    if (!this.visualGrains.length && !hasFeedbackTail) {
      this.clearVideoSurface();
      return;
    }

    this.resizeCanvasesForDisplay();
    if (this.visualFeedback.amount > 0) {
      this.fadeVideoSurface(this.visualFeedback.amount, this.visualFeedback.decaySeconds);
    } else {
      this.paintBlackBackdrop(this.context, this.canvas);
    }

    let drawnGrainCount = 0;
    for (const grain of this.visualGrains) {
      if (now < grain.startTime) {
        continue;
      }

      const localTime = Math.min(grain.durationSeconds, now - grain.startTime);
      const frameDurationSeconds = grain.frameRate > 0
        ? 1 / grain.frameRate
        : grain.durationSeconds / grain.frames.length;
      const rawFrameIndex = Math.floor(localTime / Math.max(frameDurationSeconds, 0.001));
      const frameIndex = grain.loopFrames
        ? rawFrameIndex % grain.frames.length
        : Math.min(grain.frames.length - 1, rawFrameIndex);
      const frame = grain.frames[frameIndex];
      const envelope = computeEnvelope(localTime, grain.durationSeconds, grain.attackSeconds, grain.releaseSeconds);
      const opacity = grain.opacity * envelope;
      if (opacity <= 0) {
        continue;
      }

      this.context.save();
      this.context.globalAlpha = opacity;
      this.context.globalCompositeOperation = drawnGrainCount === 0
        ? "source-over"
        : compositeOperationForBlendMode(grain.blendMode);
      this.drawAtlasTileToContext(this.context, frame.image, frame.tileIndex);
      this.context.restore();
      drawnGrainCount += 1;
    }

    this.visualGrainRafId = requestAnimationFrame(() => this.renderVisualGrains());
  }

  async buildFrameList(unit) {
    const frames = [];
    for (const span of unit.videoAtlasSpans || []) {
      const image = await this.assetCache.getAtlasImage(span.asset);
      for (let index = 0; index < span.frameCount; index += 1) {
        frames.push({
          image,
          tileIndex: span.startTileIndex + index,
        });
      }
    }
    return frames;
  }

  drawAtlasTile(image, tileIndex, options = {}) {
    const crossfadeMs = this.getControls().crossfadeMs ?? 0;
    if (options.crossfade && crossfadeMs > 0) {
      this.beginCrossfade(crossfadeMs);
    }
    this.resizeCanvasesForDisplay();
    this.paintBlackBackdrop(this.context, this.canvas);
    this.drawAtlasTileToContext(this.context, image, tileIndex);
  }

  drawAtlasTileToContext(context, image, tileIndex) {
    const media = this.corpus.media.video;
    const sourceX = (tileIndex % media.columns) * media.frameWidth;
    const sourceY = Math.floor(tileIndex / media.columns) * media.frameHeight;
    const destination = containedRect(
      media.frameWidth,
      media.frameHeight,
      context.canvas.width,
      context.canvas.height,
    );
    context.drawImage(
      image,
      sourceX,
      sourceY,
      media.frameWidth,
      media.frameHeight,
      destination.x,
      destination.y,
      destination.width,
      destination.height,
    );
  }

  configureCanvasAspectRatio() {
    const media = this.corpus.media.video;
    if (!this.canvasStack || !media.frameWidth || !media.frameHeight) {
      return;
    }

    const aspectNumber = media.frameWidth / media.frameHeight;
    this.canvasStack.style.setProperty("--video-aspect-ratio", `${media.frameWidth} / ${media.frameHeight}`);
    this.canvasStack.style.setProperty("--video-aspect-number", String(aspectNumber));
  }

  beginCrossfade(durationMs) {
    if (!this.fadeCanvas || !this.fadeContext) {
      return;
    }

    this.resizeCanvasesForDisplay();
    this.fadeContext.clearRect(0, 0, this.fadeCanvas.width, this.fadeCanvas.height);
    this.fadeContext.drawImage(this.canvas, 0, 0, this.fadeCanvas.width, this.fadeCanvas.height);
    this.fadeCanvas.style.transition = "none";
    this.fadeCanvas.style.opacity = "1";
    this.fadeCanvas.getBoundingClientRect();
    this.fadeCanvas.style.transition = `opacity ${durationMs}ms linear`;
    this.fadeCanvas.style.opacity = "0";
  }

  resizeCanvasesForDisplay() {
    resizeCanvasForDisplay(this.canvas, this.context);
    if (this.fadeCanvas && this.fadeContext) {
      resizeCanvasForDisplay(this.fadeCanvas, this.fadeContext);
    }
  }

  clear(label) {
    this.stopPreview();
    this.stopGrainPlayback();
    this.resizeCanvasesForDisplay();
    this.paintBlackBackdrop(this.context, this.canvas);
    this.context.fillStyle = "#d8d0c2";
    this.context.font = `${Math.max(18, this.canvas.width * 0.04)}px Avenir Next, Avenir, sans-serif`;
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    this.context.fillText(label, this.canvas.width / 2, this.canvas.height / 2);
    this.resetFadeLayer();
  }

  clearVideoSurface() {
    this.resizeCanvasesForDisplay();
    this.paintBlackBackdrop(this.context, this.canvas);
    this.resetFadeLayer();
    this.visualFeedbackUntil = 0;
    this.lastVisualRenderAt = 0;
  }

  paintBlackBackdrop(context, canvas) {
    context.save();
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }

  fadeVideoSurface(feedbackAmount, decaySeconds) {
    const now = performance.now();
    const elapsedSeconds = this.lastVisualRenderAt
      ? Math.max(0.001, (now - this.lastVisualRenderAt) / 1000)
      : 1 / 60;
    this.lastVisualRenderAt = now;

    const effectiveDecaySeconds = Math.max(0.04, decaySeconds / Math.max(0.12, feedbackAmount));
    const fadeAlpha = clamp(elapsedSeconds / effectiveDecaySeconds, 0.006, 1);
    this.context.save();
    this.context.globalAlpha = fadeAlpha;
    this.context.globalCompositeOperation = "source-over";
    this.context.fillStyle = "#000000";
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.restore();
  }

  resetFadeLayer() {
    if (!this.fadeCanvas || !this.fadeContext) {
      return;
    }

    this.fadeCanvas.style.transition = "none";
    this.fadeCanvas.style.opacity = "0";
    this.fadeContext.clearRect(0, 0, this.fadeCanvas.width, this.fadeCanvas.height);
  }
}

export function stopVoice(voice) {
  try {
    voice.source.stop();
  } catch {
    // The voice may already have ended naturally.
  }
  disconnectVoice(voice);
}

export function disconnectVoice(voice) {
  try {
    voice.source.disconnect();
  } catch {
    // Ignore already-disconnected nodes.
  }
  try {
    voice.gainNode.disconnect();
  } catch {
    // Ignore already-disconnected nodes.
  }
}

function computeEnvelope(localTime, durationSeconds, attackSeconds, releaseSeconds) {
  if (localTime < 0 || localTime > durationSeconds) {
    return 0;
  }
  if (attackSeconds > 0 && localTime < attackSeconds) {
    return clamp(localTime / attackSeconds, 0, 1);
  }
  const releaseStart = durationSeconds - releaseSeconds;
  if (releaseSeconds > 0 && localTime > releaseStart) {
    return clamp((durationSeconds - localTime) / releaseSeconds, 0, 1);
  }
  return 1;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function containedRect(sourceWidth, sourceHeight, destinationWidth, destinationHeight) {
  const scale = Math.min(destinationWidth / sourceWidth, destinationHeight / sourceHeight);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  return {
    x: Math.round((destinationWidth - width) / 2),
    y: Math.round((destinationHeight - height) / 2),
    width,
    height,
  };
}

function compositeOperationForBlendMode(blendMode) {
  if (blendMode === "divide") {
    return "color-dodge";
  }
  return blendMode || "source-over";
}

function resizeCanvasForDisplay(canvas, context) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    context.setTransform(1, 0, 0, 1, 0, 0);
  }
}
