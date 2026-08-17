import { SCENARIOS, SCENARIO_VERSION, getScenario } from "./scenarioDefinitions.js?v=20260818-balance-49";
import { BALANCE_RESULT_SCHEMA_VERSION, summarizeBatch } from "./resultSchema.js?v=20260818-balance-48";
import { installFrameControls } from "./modalDriver.js?v=20260818-balance-25";

const RUNNER_VERSION = 2;
const API_WAIT_MS = 10000;
const timerCapText = new URLSearchParams(window.location.search).get("timerCapMs");
const timerCapParam = Number(timerCapText);
const TIMER_CAP_MS = timerCapText !== null && Number.isFinite(timerCapParam) && timerCapParam >= 0
  ? timerCapParam
  : 2;

const scenarioSelect = document.getElementById("scenario");
const startSeedInput = document.getElementById("startSeed");
const runCountInput = document.getElementById("runCount");
const showFrameInput = document.getElementById("showFrame");
const startButton = document.getElementById("startButton");
const cancelButton = document.getElementById("cancelButton");
const downloadButton = document.getElementById("downloadButton");
const progress = document.getElementById("progress");
const summary = document.getElementById("summary");
const frameHost = document.getElementById("frameHost");

let cancelRequested = false;
let lastBatch = null;

SCENARIOS.forEach(scenario => {
  const option = document.createElement("option");
  option.value = scenario.id;
  option.textContent = scenario.name;
  scenarioSelect.appendChild(option);
});

function parseInteger(input, min, max) {
  const value = Number(input.value);
  if (!Number.isSafeInteger(value) || value < min || value > max) return null;
  return value;
}

function waitForFrameLoad(frame) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("frame_load_timeout")), API_WAIT_MS);
    frame.addEventListener("load", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

async function waitForBalanceApi(frame) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < API_WAIT_MS) {
    const api = frame.contentWindow?.__vobBalance;
    if (api) return api;
    await new Promise(resolve => window.setTimeout(resolve, 20));
  }
  throw new Error("balance_api_timeout");
}

function createFrame(seed) {
  const frame = document.createElement("iframe");
  frame.title = `balance-seed-${seed}`;
  const url = new URL("../../index.html", window.location.href);
  url.searchParams.set("balanceMode", "1");
  url.searchParams.set("balanceSeed", String(seed));
  frame.src = url.href;
  return frame;
}

async function runOne(scenario, seed, runIndex) {
  const frame = createFrame(seed);
  frameHost.replaceChildren(frame);
  const startedAt = performance.now();

  try {
    await waitForFrameLoad(frame);
    const api = await waitForBalanceApi(frame);
    frame.contentWindow.console.log = () => {};
    const controls = installFrameControls(frame, { maxTimerDelayMs: TIMER_CAP_MS });
    api.seed?.reset?.();
    const scenarioResult = await scenario.run({ api, controls, frame, seed, runIndex });
    return {
      schemaVersion: BALANCE_RESULT_SCHEMA_VERSION,
      scenarioVersion: SCENARIO_VERSION,
      runnerVersion: RUNNER_VERSION,
      scenarioId: scenario.id,
      seed,
      durationMs: performance.now() - startedAt,
      random: api.seed ? {
        algorithm: api.seed.algorithm,
        version: api.seed.version,
        seed: api.seed.seed,
        calls: api.seed.calls
      } : null,
      interactions: {
        alerts: controls.alerts.length,
        confirms: controls.confirms.length,
        prompts: controls.prompts.length,
        timerCapMs: TIMER_CAP_MS
      },
      ...scenarioResult
    };
  } catch (error) {
    return {
      schemaVersion: BALANCE_RESULT_SCHEMA_VERSION,
      scenarioVersion: SCENARIO_VERSION,
      runnerVersion: RUNNER_VERSION,
      scenarioId: scenario.id,
      seed,
      durationMs: performance.now() - startedAt,
      status: "error",
      reason: error instanceof Error ? error.message : String(error)
    };
  } finally {
    frame.remove();
  }
}

function setRunning(running) {
  startButton.disabled = running;
  cancelButton.disabled = !running;
  scenarioSelect.disabled = running;
  startSeedInput.disabled = running;
  runCountInput.disabled = running;
}

function updateFrameVisibility() {
  frameHost.classList.toggle("frame-hidden", !showFrameInput.checked);
}

async function runBatch() {
  const scenario = getScenario(scenarioSelect.value);
  const startSeed = parseInteger(startSeedInput, 0, 0xFFFFFFFF);
  const runCount = parseInteger(runCountInput, 1, 10000);
  if (!scenario || startSeed == null || runCount == null || startSeed + runCount - 1 > 0xFFFFFFFF) {
    summary.textContent = "入力値を確認してください。";
    return;
  }

  cancelRequested = false;
  lastBatch = null;
  downloadButton.disabled = true;
  setRunning(true);
  const results = [];
  const batchStartedAt = performance.now();

  try {
    for (let index = 0; index < runCount; index++) {
      if (cancelRequested) break;
      const seed = startSeed + index;
      progress.textContent = `${index + 1}/${runCount} 実行中（seed ${seed}）`;
      results.push(await runOne(scenario, seed, index));
      summary.textContent = JSON.stringify(summarizeBatch(results), null, 2);
    }

    lastBatch = {
      schemaVersion: BALANCE_RESULT_SCHEMA_VERSION,
      runnerVersion: RUNNER_VERSION,
      scenarioVersion: SCENARIO_VERSION,
      createdAt: new Date().toISOString(),
      config: {
        scenarioId: scenario.id,
        startSeed,
        requestedRuns: runCount
      },
      durationMs: performance.now() - batchStartedAt,
      cancelled: cancelRequested,
      summary: summarizeBatch(results),
      results
    };
    summary.textContent = JSON.stringify(lastBatch.summary, null, 2);
    progress.textContent = cancelRequested
      ? `${results.length}/${runCount} で中止しました。`
      : `${results.length}/${runCount} 完了しました。`;
    downloadButton.disabled = results.length === 0;
  } finally {
    frameHost.replaceChildren();
    setRunning(false);
  }
}

function downloadLastBatch() {
  if (!lastBatch) return;
  const blob = new Blob([JSON.stringify(lastBatch, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `vob-balance-${lastBatch.config.scenarioId}-${lastBatch.config.startSeed}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

showFrameInput.addEventListener("change", updateFrameVisibility);
startButton.addEventListener("click", runBatch);
cancelButton.addEventListener("click", () => {
  cancelRequested = true;
  cancelButton.disabled = true;
});
downloadButton.addEventListener("click", downloadLastBatch);
updateFrameVisibility();

Object.defineProperty(window, "__vobBalanceRunner", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: Object.freeze({ getLastBatch: () => lastBatch })
});
