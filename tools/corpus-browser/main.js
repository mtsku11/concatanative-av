import { GrainEngine } from "./grain-engine.js";
import { AtlasVideoRenderer, CorpusAssetCache, UnitAudioPreview } from "./media-runtime.js";
import {
  DISTANCE_MODES,
  buildAxisOptions,
  computeNearestRows,
  getAxisValue,
  getDistanceWeights,
  getRawDescriptorValue,
  unitPassesPitchGate,
} from "./retrieval.js";

const state = {
  config: null,
  corpus: null,
  sourcesById: new Map(),
  unitsById: new Map(),
  selectedUnitId: null,
  nearestUnitIds: [],
  nearestRows: [],
  distanceMode: "balanced",
  pitchConfidenceMin: 0,
  plotAxes: {
    x: "embedding:x",
    y: "embedding:y",
  },
  scatterPoints: [],
  draggingScatter: false,
  lastDragSelectionAt: 0,
  grainTargetUnitId: null,
  lastGrainUnitId: null,
  assetCache: null,
  audioPreview: null,
  videoRenderer: null,
  grainEngine: null,
};

const elements = {
  statusLine: document.querySelector("#status-line"),
  videoStatus: document.querySelector("#video-status"),
  selectionSummary: document.querySelector("#selection-summary"),
  nearestList: document.querySelector("#nearest-list"),
  nearestModeSummary: document.querySelector("#nearest-mode-summary"),
  descriptorTables: document.querySelector("#descriptor-tables"),
  scatterCanvas: document.querySelector("#scatter-canvas"),
  videoCanvas: document.querySelector("#video-canvas"),
  videoFadeCanvas: document.querySelector("#video-fade-canvas"),
  distanceModeSelect: document.querySelector("#distance-mode-select"),
  videoCrossfadeInput: document.querySelector("#video-crossfade-input"),
  videoCrossfadeOutput: document.querySelector("#video-crossfade-output"),
  pitchConfidenceInput: document.querySelector("#pitch-confidence-input"),
  pitchConfidenceOutput: document.querySelector("#pitch-confidence-output"),
  xAxisSelect: document.querySelector("#x-axis-select"),
  yAxisSelect: document.querySelector("#y-axis-select"),
  grainRateInput: document.querySelector("#grain-rate-input"),
  grainRateOutput: document.querySelector("#grain-rate-output"),
  grainDurationInput: document.querySelector("#grain-duration-input"),
  grainDurationOutput: document.querySelector("#grain-duration-output"),
  grainBlendModeSelect: document.querySelector("#grain-blend-mode-select"),
  grainModeSelect: document.querySelector("#grain-mode-select"),
  grainFeedbackInput: document.querySelector("#grain-feedback-input"),
  grainFeedbackOutput: document.querySelector("#grain-feedback-output"),
  grainDecayInput: document.querySelector("#grain-decay-input"),
  grainDecayOutput: document.querySelector("#grain-decay-output"),
  grainAttackInput: document.querySelector("#grain-attack-input"),
  grainAttackOutput: document.querySelector("#grain-attack-output"),
  grainReleaseInput: document.querySelector("#grain-release-input"),
  grainReleaseOutput: document.querySelector("#grain-release-output"),
  grainGainInput: document.querySelector("#grain-gain-input"),
  grainGainOutput: document.querySelector("#grain-gain-output"),
  grainPitchInput: document.querySelector("#grain-pitch-input"),
  grainPitchOutput: document.querySelector("#grain-pitch-output"),
  grainPitchRandomInput: document.querySelector("#grain-pitch-random-input"),
  grainPitchRandomOutput: document.querySelector("#grain-pitch-random-output"),
  grainJitterInput: document.querySelector("#grain-jitter-input"),
  grainJitterOutput: document.querySelector("#grain-jitter-output"),
  grainContinuityInput: document.querySelector("#grain-continuity-input"),
  grainContinuityOutput: document.querySelector("#grain-continuity-output"),
  grainRepetitionPenaltyInput: document.querySelector("#grain-repetition-penalty-input"),
  grainRepetitionPenaltyOutput: document.querySelector("#grain-repetition-penalty-output"),
  grainSourceSwitchPenaltyInput: document.querySelector("#grain-source-switch-penalty-input"),
  grainSourceSwitchPenaltyOutput: document.querySelector("#grain-source-switch-penalty-output"),
  grainStutterCountInput: document.querySelector("#grain-stutter-count-input"),
  grainStutterCountOutput: document.querySelector("#grain-stutter-count-output"),
  grainVoicesInput: document.querySelector("#grain-voices-input"),
  grainVoicesOutput: document.querySelector("#grain-voices-output"),
};

const scatterContext = elements.scatterCanvas.getContext("2d");

async function boot() {
  bindEvents();
  updateGrainControlOutputs();
  updateVideoControlOutputs();
  updatePitchGateOutput();
  setControlsEnabled(false);

  try {
    state.config = await fetchJson("./__browser-config.json");
    state.corpus = await fetchJson(`${state.config.corpusBaseUrl}/corpus.json`);
    indexCorpus(state.corpus);
    createRuntime();
    populateAxisControls();

    if (!state.corpus.units.length) {
      elements.statusLine.textContent = "Corpus loaded, but it contains zero units.";
      state.videoRenderer.clear("No units");
      return;
    }

    selectUnit(state.corpus.units[0].id, { autoplay: false });
    renderScatterplot();
    setControlsEnabled(true);
    elements.statusLine.textContent = `${state.corpus.units.length} unit(s) across ${state.corpus.sources.length} source(s) from ${state.config.corpusPath}`;
  } catch (error) {
    console.error(error);
    elements.statusLine.textContent = `Failed to load corpus: ${String(error.message || error)}`;
    if (state.videoRenderer) {
      state.videoRenderer.clear("Load failed");
    }
  }
}

function createRuntime() {
  state.assetCache = new CorpusAssetCache(state.config);
  state.videoRenderer = new AtlasVideoRenderer({
    corpus: state.corpus,
    assetCache: state.assetCache,
    canvas: elements.videoCanvas,
    fadeCanvas: elements.videoFadeCanvas,
    getControls: getVideoControls,
    statusElement: elements.videoStatus,
  });
  state.audioPreview = new UnitAudioPreview({
    assetCache: state.assetCache,
    sourcesById: state.sourcesById,
    statusElement: elements.videoStatus,
  });
  state.grainEngine = new GrainEngine({
    assetCache: state.assetCache,
    sourcesById: state.sourcesById,
    unitsById: state.unitsById,
    getTargetUnitId: () => state.grainTargetUnitId || state.selectedUnitId,
    getNearestRows: () => state.nearestRows,
    getControls: getGrainControls,
    getDragging: () => state.draggingScatter,
    isUnitAllowed: (unit) => isPitchEligible(unit),
    setLastGrainUnitId: (unitId) => {
      state.lastGrainUnitId = unitId;
    },
    getLastGrainUnitId: () => state.lastGrainUnitId,
    videoRenderer: state.videoRenderer,
    statusElement: elements.videoStatus,
  });
}

function bindEvents() {
  elements.scatterCanvas.addEventListener("pointerdown", onScatterPointerDown);
  elements.scatterCanvas.addEventListener("pointermove", onScatterPointerMove);
  elements.scatterCanvas.addEventListener("pointerup", onScatterPointerEnd);
  elements.scatterCanvas.addEventListener("pointercancel", onScatterPointerEnd);
  elements.distanceModeSelect.addEventListener("change", () => {
    state.distanceMode = elements.distanceModeSelect.value;
    recomputeNearestUnits();
    updateNearestList();
    renderScatterplot();
  });
  elements.xAxisSelect.addEventListener("change", () => {
    state.plotAxes.x = elements.xAxisSelect.value;
    renderScatterplot();
  });
  elements.yAxisSelect.addEventListener("change", () => {
    state.plotAxes.y = elements.yAxisSelect.value;
    renderScatterplot();
  });
  elements.videoCrossfadeInput.addEventListener("input", updateVideoControlOutputs);
  elements.pitchConfidenceInput.addEventListener("input", () => {
    state.pitchConfidenceMin = getPitchConfidenceMin();
    updatePitchGateOutput();
    recomputeNearestUnits();
    updateNearestList();
    renderScatterplot();
  });
  for (const input of getGrainInputs()) {
    input.addEventListener("input", updateGrainControlOutputs);
  }
  window.addEventListener("resize", () => renderScatterplot());
  window.addEventListener("keydown", (event) => {
    if (!state.selectedUnitId) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectAdjacentUnit("prevUnitId");
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      selectAdjacentUnit("nextUnitId");
    } else if (event.key === " ") {
      event.preventDefault();
      playSelectedUnit();
    }
  });
}

function indexCorpus(corpus) {
  for (const source of corpus.sources) {
    state.sourcesById.set(source.id, source);
  }
  for (const unit of corpus.units) {
    state.unitsById.set(unit.id, unit);
  }
}

function setControlsEnabled(enabled) {
  for (const element of [
    elements.distanceModeSelect,
    elements.videoCrossfadeInput,
    elements.pitchConfidenceInput,
    elements.xAxisSelect,
    elements.yAxisSelect,
    ...getGrainInputs(),
  ]) {
    element.disabled = !enabled;
  }
}

function getGrainInputs() {
  return [
    elements.grainRateInput,
    elements.grainDurationInput,
    elements.grainBlendModeSelect,
    elements.grainModeSelect,
    elements.grainFeedbackInput,
    elements.grainDecayInput,
    elements.grainAttackInput,
    elements.grainReleaseInput,
    elements.grainGainInput,
    elements.grainPitchInput,
    elements.grainPitchRandomInput,
    elements.grainJitterInput,
    elements.grainContinuityInput,
    elements.grainRepetitionPenaltyInput,
    elements.grainSourceSwitchPenaltyInput,
    elements.grainStutterCountInput,
    elements.grainVoicesInput,
  ];
}

function updateGrainControlOutputs() {
  const controls = getGrainControls();
  elements.grainRateOutput.textContent = `${controls.rateHz} Hz`;
  elements.grainDurationOutput.textContent = `${controls.durationMs} ms`;
  elements.grainFeedbackOutput.textContent = controls.feedback.toFixed(2);
  elements.grainDecayOutput.textContent = `${controls.decayMs} ms`;
  elements.grainAttackOutput.textContent = `${controls.attackMs} ms`;
  elements.grainReleaseOutput.textContent = `${controls.releaseMs} ms`;
  elements.grainGainOutput.textContent = controls.gain.toFixed(2);
  elements.grainPitchOutput.textContent = `${formatSigned(controls.pitchSemitones)} st`;
  elements.grainPitchRandomOutput.textContent = `+/-${controls.pitchRandomSemitones} st`;
  elements.grainJitterOutput.textContent = controls.neighborJitter === 0 ? "0" : `top ${controls.neighborJitter * 8}`;
  elements.grainContinuityOutput.textContent = `${Math.round(controls.continuity * 100)}%`;
  elements.grainRepetitionPenaltyOutput.textContent = controls.repetitionPenalty.toFixed(2);
  elements.grainSourceSwitchPenaltyOutput.textContent = controls.sourceSwitchPenalty.toFixed(2);
  elements.grainStutterCountOutput.textContent = `${controls.stutterCount}x`;
  elements.grainVoicesOutput.textContent = String(controls.maxVoices);
}

function updateVideoControlOutputs() {
  const controls = getVideoControls();
  elements.videoCrossfadeOutput.textContent = `${controls.crossfadeMs} ms`;
}

function updatePitchGateOutput() {
  const minConfidence = getPitchConfidenceMin();
  elements.pitchConfidenceOutput.textContent = minConfidence <= 0 ? "Off" : `>= ${minConfidence.toFixed(2)}`;
}

function getVideoControls() {
  return {
    crossfadeMs: readNumber(elements.videoCrossfadeInput, 60),
  };
}

function getPitchConfidenceMin() {
  return readNumber(elements.pitchConfidenceInput, 0);
}

function getGrainControls() {
  return {
    rateHz: readNumber(elements.grainRateInput, 14),
    durationMs: readNumber(elements.grainDurationInput, 120),
    blendMode: elements.grainBlendModeSelect.value || "source-over",
    mode: elements.grainModeSelect.value || "explore",
    feedback: readNumber(elements.grainFeedbackInput, 0),
    decayMs: readNumber(elements.grainDecayInput, 450),
    attackMs: readNumber(elements.grainAttackInput, 8),
    releaseMs: readNumber(elements.grainReleaseInput, 35),
    gain: readNumber(elements.grainGainInput, 0.75),
    pitchSemitones: readNumber(elements.grainPitchInput, 0),
    pitchRandomSemitones: readNumber(elements.grainPitchRandomInput, 0),
    neighborJitter: readNumber(elements.grainJitterInput, 0),
    continuity: readNumber(elements.grainContinuityInput, 0.15),
    repetitionPenalty: readNumber(elements.grainRepetitionPenaltyInput, 0),
    sourceSwitchPenalty: readNumber(elements.grainSourceSwitchPenaltyInput, 0),
    stutterCount: readNumber(elements.grainStutterCountInput, 4),
    maxVoices: readNumber(elements.grainVoicesInput, 32),
  };
}

function populateAxisControls() {
  const options = buildAxisOptions(state.corpus.descriptorSchema);
  for (const select of [elements.xAxisSelect, elements.yAxisSelect]) {
    select.innerHTML = options
      .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
      .join("");
  }
  elements.xAxisSelect.value = state.plotAxes.x;
  elements.yAxisSelect.value = state.plotAxes.y;
}

function selectUnit(unitId, options = { autoplay: false, showPoster: true }) {
  const unit = state.unitsById.get(unitId);
  if (!unit) {
    return;
  }

  state.selectedUnitId = unitId;
  state.grainTargetUnitId = unitId;
  recomputeNearestUnits();
  updateSelectionSummary(unit);
  updateNearestList();
  updateDescriptorTables(unit);
  renderScatterplot();
  if (options.showPoster !== false) {
    state.videoRenderer.drawPosterFrame(unit);
  }

  if (options.autoplay) {
    playSelectedUnit();
  }
}

function recomputeNearestUnits() {
  const target = state.unitsById.get(state.selectedUnitId);
  state.nearestRows = computeNearestRows(
    getPitchEligibleUnits(),
    target,
    getDistanceWeights(state.distanceMode),
    64,
    state.corpus.descriptorSchema,
  );
  state.nearestUnitIds = state.nearestRows.map((row) => row.id);
}

function updateSelectionSummary(unit) {
  const source = state.sourcesById.get(unit.sourceId);
  const fields = [
    ["Unit", unit.id],
    ["Source", source ? source.label : unit.sourceId],
    ["Start", `${formatMs(unit.startMs)} (${formatSeconds(unit.startMs / 1000)})`],
    ["Duration", `${formatMs(unit.durationMs)} / ${unit.audioSampleCount} samples`],
    ["Frames", `${unit.videoStartFrame}..${unit.videoStartFrame + unit.videoFrameCount - 1}`],
    ["Pitch", formatPitchSummary(unit)],
    ["Atlas Spans", String(unit.videoAtlasSpans.length)],
    ["Prev", unit.prevUnitId || "None"],
    ["Next", unit.nextUnitId || "None"],
  ];

  elements.selectionSummary.innerHTML = fields
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");
}

function updateNearestList() {
  elements.nearestList.innerHTML = "";
  const mode = DISTANCE_MODES[state.distanceMode] || DISTANCE_MODES.balanced;
  const weights = mode.weights;
  const gateSummary = state.pitchConfidenceMin > 0 ? ` · pitch confidence >= ${state.pitchConfidenceMin.toFixed(2)}` : "";
  elements.nearestModeSummary.textContent = `${mode.label}: audio ${formatWeight(weights.audio)}, video ${formatWeight(weights.video)}, joint ${formatWeight(weights.joint)}${gateSummary}`;

  if (!state.nearestRows.length) {
    elements.nearestList.innerHTML = "<li>No neighbors yet.</li>";
    return;
  }

  for (const row of state.nearestRows.slice(0, 8)) {
    const unit = state.unitsById.get(row.id);
    if (!unit) {
      continue;
    }
    const source = state.sourcesById.get(unit.sourceId);
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `${escapeHtml(unit.id)}<br /><span class="hint">${escapeHtml(source ? source.label : unit.sourceId)} · ${escapeHtml(formatMs(unit.durationMs))} · d=${escapeHtml(formatNumber(row.distance))}</span>`;
    button.addEventListener("click", () => selectUnit(unit.id, { autoplay: true }));
    item.appendChild(button);
    elements.nearestList.appendChild(item);
  }
}

function updateDescriptorTables(unit) {
  const schema = state.corpus.descriptorSchema;
  const groups = ["audio", "video", "joint"];
  elements.descriptorTables.innerHTML = groups
    .map((group) => renderDescriptorGroup(group, schema[group], unit.descriptors[group], unit.rawDescriptors?.[group]))
    .join("");
}

function renderDescriptorGroup(group, fields, normalizedValues, rawValues) {
  const rows = fields
    .map((field, index) => {
      const normalizedValue = normalizedValues?.[index];
      const rawValue = rawValues?.[index];
      return `<tr>
        <th>
          <span class="descriptor-field">${escapeHtml(field)} <span class="descriptor-chip">${escapeHtml(group)}</span></span>
        </th>
        <td>${formatNumber(normalizedValue)}</td>
        <td>${formatNumber(rawValue)}</td>
      </tr>`;
    })
    .join("");

  return `<section class="descriptor-group">
    <header><h3>${escapeHtml(group)}</h3></header>
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>Normalized</th>
          <th>Raw</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

function renderScatterplot() {
  if (!scatterContext || !state.corpus?.units?.length) {
    return;
  }

  resizeCanvasForDisplay(elements.scatterCanvas, scatterContext);

  const width = elements.scatterCanvas.width;
  const height = elements.scatterCanvas.height;
  const padding = 32;
  const points = getPitchEligibleUnits()
    .map((unit) => ({
      unit,
      x: getAxisValue(unit, state.plotAxes.x, state.corpus.descriptorSchema),
      y: getAxisValue(unit, state.plotAxes.y, state.corpus.descriptorSchema),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (!points.length) {
    state.scatterPoints = [];
    scatterContext.save();
    scatterContext.globalAlpha = 1;
    scatterContext.globalCompositeOperation = "source-over";
    scatterContext.setTransform(1, 0, 0, 1, 0, 0);
    scatterContext.clearRect(0, 0, width, height);
    scatterContext.fillStyle = "#f8f1e4";
    scatterContext.fillRect(0, 0, width, height);
    scatterContext.fillStyle = "#6f6659";
    scatterContext.font = `${Math.max(14, width * 0.018)}px Avenir Next, Avenir, sans-serif`;
    scatterContext.textAlign = "center";
    scatterContext.textBaseline = "middle";
    scatterContext.fillText("No units pass the current axis/gate settings", width / 2, height / 2);
    scatterContext.restore();
    return;
  }

  const bounds = computeBounds(points);
  state.scatterPoints = points.map((point) => ({
    unitId: point.unit.id,
    x: remap(point.x, bounds.minX, bounds.maxX, padding, width - padding),
    y: remap(point.y, bounds.minY, bounds.maxY, height - padding, padding),
  }));

  scatterContext.save();
  scatterContext.globalAlpha = 1;
  scatterContext.globalCompositeOperation = "source-over";
  scatterContext.setTransform(1, 0, 0, 1, 0, 0);
  scatterContext.clearRect(0, 0, width, height);
  scatterContext.fillStyle = "#f8f1e4";
  scatterContext.fillRect(0, 0, width, height);
  scatterContext.restore();
  drawScatterBackground(scatterContext, width, height, padding);

  for (const point of state.scatterPoints) {
    const isSelected = point.unitId === state.selectedUnitId;
    const isNearest = state.nearestUnitIds.includes(point.unitId);
    const radius = isSelected ? 9 : isNearest ? 6 : 4.4;

    scatterContext.beginPath();
    scatterContext.fillStyle = isSelected ? "#c74f2f" : isNearest ? "#3b6c7c" : "rgba(47, 36, 22, 0.72)";
    scatterContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
    scatterContext.fill();

    if (isSelected) {
      scatterContext.strokeStyle = "rgba(199, 79, 47, 0.2)";
      scatterContext.lineWidth = 14;
      scatterContext.beginPath();
      scatterContext.arc(point.x, point.y, 16, 0, Math.PI * 2);
      scatterContext.stroke();
    }
  }
}

function getPitchEligibleUnits() {
  return state.corpus.units.filter((unit) => isPitchEligible(unit));
}

function isPitchEligible(unit) {
  return unitPassesPitchGate(unit, state.corpus.descriptorSchema, state.pitchConfidenceMin);
}

function drawScatterBackground(context, width, height, padding) {
  context.save();
  context.strokeStyle = "rgba(67, 52, 34, 0.12)";
  context.lineWidth = 1;

  for (let step = 0; step < 5; step += 1) {
    const x = remap(step, 0, 4, padding, width - padding);
    const y = remap(step, 0, 4, padding, height - padding);

    context.beginPath();
    context.moveTo(x, padding);
    context.lineTo(x, height - padding);
    context.stroke();

    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  context.restore();
}

function computeBounds(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX,
    maxX: maxX === minX ? maxX + 1 : maxX,
    minY,
    maxY: maxY === minY ? maxY + 1 : maxY,
  };
}

function onScatterPointerDown(event) {
  if (!state.scatterPoints.length) {
    return;
  }

  elements.scatterCanvas.setPointerCapture(event.pointerId);
  state.draggingScatter = true;
  state.lastDragSelectionAt = 0;
  selectClosestScatterPoint(event, { force: true, autoplay: false, showPoster: false });
  state.grainEngine.start();
}

function onScatterPointerMove(event) {
  if (!state.draggingScatter) {
    return;
  }

  const now = performance.now();
  if (now - (state.lastDragSelectionAt || 0) < 45) {
    return;
  }

  state.lastDragSelectionAt = now;
  selectClosestScatterPoint(event, { force: true, autoplay: false, showPoster: false });
}

function onScatterPointerEnd(event) {
  state.draggingScatter = false;
  state.grainEngine.stop();
  if (elements.scatterCanvas.hasPointerCapture(event.pointerId)) {
    elements.scatterCanvas.releasePointerCapture(event.pointerId);
  }
}

function selectClosestScatterPoint(event, options = { force: false }) {
  if (!state.scatterPoints.length) {
    return;
  }

  const rect = elements.scatterCanvas.getBoundingClientRect();
  const scaleX = elements.scatterCanvas.width / rect.width;
  const scaleY = elements.scatterCanvas.height / rect.height;
  const mouseX = (event.clientX - rect.left) * scaleX;
  const mouseY = (event.clientY - rect.top) * scaleY;
  let bestPoint = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const point of state.scatterPoints) {
    const dx = point.x - mouseX;
    const dy = point.y - mouseY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = point;
    }
  }

  if (bestPoint && bestPoint.unitId !== state.selectedUnitId && (options.force || bestDistance <= 20)) {
    selectUnit(bestPoint.unitId, {
      autoplay: options.autoplay ?? true,
      showPoster: options.showPoster ?? true,
    });
  }
}

function selectAdjacentUnit(directionKey) {
  const current = state.unitsById.get(state.selectedUnitId);
  const nextUnitId = current?.[directionKey];
  if (nextUnitId) {
    selectUnit(nextUnitId, { autoplay: true });
  }
}

async function playSelectedUnit() {
  const unit = state.unitsById.get(state.selectedUnitId);
  const playback = await state.audioPreview.play(unit);
  if (playback) {
    state.videoRenderer.schedulePlayback(unit, playback.source.frameRate, playback.startTime);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
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

function remap(value, inMin, inMax, outMin, outMax) {
  const normalized = (value - inMin) / (inMax - inMin || 1);
  return outMin + normalized * (outMax - outMin);
}

function formatMs(value) {
  return `${value.toFixed(1)} ms`;
}

function formatSeconds(value) {
  return `${value.toFixed(3)} s`;
}

function formatPitchSummary(unit) {
  const schema = state.corpus.descriptorSchema;
  const pitchHz = getRawDescriptorValue(unit, schema, "audio", "pitchHz");
  const confidence = getRawDescriptorValue(unit, schema, "audio", "pitchConfidence");
  const pitchLabel = Number.isFinite(pitchHz) && pitchHz > 0 ? `${pitchHz.toFixed(1)} Hz` : "unpitched";
  const confidenceLabel = Number.isFinite(confidence) ? confidence.toFixed(2) : "-";
  return `${pitchLabel} / conf ${confidenceLabel}`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(4);
}

function formatWeight(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatSigned(value) {
  if (!Number.isFinite(value) || value === 0) {
    return "0";
  }
  return value > 0 ? `+${value}` : String(value);
}

function readNumber(input, fallback) {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

boot();
