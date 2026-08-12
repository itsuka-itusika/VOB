const BLOCKING_MODAL_SELECTORS = [
  "#actionPhaseModal",
  "#randomEventModal",
  "#festivalModal",
  "#seasonChangeDialog",
  "#raidWarningModal",
  "#buildingRequestModal",
  "#buildingRequestCompleteModal",
  "#heresyInquisitionModal",
  "#inquisitionInsufficientFundsModal",
  "#inquisitionHospitalityResultModal",
  "#inquisitionExpulsionResultModal",
  "#bacchusGoldenStatueEventModal",
  "#apocalypseStartModal",
  "#apocalypseEventModal",
  "#secretTreasureEventModal",
  ".effect-result-modal",
  "#villageScaleModal",
  "#divineMightLevelUpModal",
  "#headmanElectionModal",
  "[data-close-relationship-modal]",
  "[data-close-reproduction-modal]"
];

const CLOSE_LABELS = new Set(["閉じる", "戻る", "確認", "OK"]);

function delay(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function isVisible(frameWindow, element) {
  if (!element || !element.isConnected) return false;
  let current = element;
  while (current && current !== element.ownerDocument.body) {
    const style = frameWindow.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    current = current.parentElement;
  }
  return true;
}

function getModalElement(frame, selector) {
  const element = frame.contentDocument?.querySelector(selector);
  if (!element || !isVisible(frame.contentWindow, element)) return null;
  if (selector.startsWith("[data-close-")) return element.closest("[role=dialog], div") || element;
  return element;
}

function findVisibleModal(frame) {
  for (const selector of BLOCKING_MODAL_SELECTORS) {
    const modal = getModalElement(frame, selector);
    if (modal) return { modal, selector };
  }
  return null;
}

function getEnabledButtons(frameWindow, modal) {
  return [...modal.querySelectorAll("button")]
    .filter(button => !button.disabled && isVisible(frameWindow, button));
}

function buttonLabel(button) {
  return String(button?.textContent || "").trim();
}

function findButton(buttons, labels) {
  return buttons.find(button => labels.includes(buttonLabel(button))) || null;
}

function describeModal(modal, selector, buttons) {
  const key = modal.id ? `#${modal.id}` : selector;
  const labels = buttons.map(buttonLabel).filter(Boolean).join("|");
  return `${key}:${labels || "no_buttons"}`;
}

function chooseKnownButton(frameWindow, modal, selector) {
  const buttons = getEnabledButtons(frameWindow, modal);
  const id = modal.id || "";

  if (id === "raidWarningModal") return findButton(buttons, ["防衛する"]);
  if (id === "heresyInquisitionModal") {
    return modal.querySelector(".heresy-inquisition-warning")
      ? findButton(buttons, ["追い払う"])
      : findButton(buttons, ["もてなす"]);
  }
  if (id === "randomEventModal") {
    if (buttons.length === 1) return buttons[0];
    return findButton(buttons, ["森に返す"]);
  }

  const explicitClose = buttons.find(button =>
    CLOSE_LABELS.has(buttonLabel(button)) ||
    [...button.attributes].some(attribute => attribute.name.startsWith("data-close-"))
  );
  if (explicitClose) return explicitClose;
  if (buttons.length === 1) return buttons[0];

  throw new Error(`unhandled_modal:${describeModal(modal, selector, buttons)}`);
}

export function installFrameControls(frame, { maxTimerDelayMs = 2 } = {}) {
  const frameWindow = frame.contentWindow;
  const nativeSetTimeout = frameWindow.setTimeout.bind(frameWindow);
  const controls = {
    alerts: [],
    confirms: [],
    prompts: []
  };

  frameWindow.alert = message => controls.alerts.push(String(message));
  frameWindow.confirm = message => {
    controls.confirms.push(String(message));
    return true;
  };
  frameWindow.prompt = (message, defaultValue = "") => {
    controls.prompts.push(String(message));
    return String(defaultValue || "");
  };
  frameWindow.setTimeout = (callback, delayValue = 0, ...args) => {
    const delayMs = Math.min(Math.max(0, Number(delayValue) || 0), maxTimerDelayMs);
    return nativeSetTimeout(callback, delayMs, ...args);
  };

  return controls;
}

export async function drainKnownModals(frame, { maxActions = 100 } = {}) {
  let actions = 0;
  let idlePasses = 0;
  const trace = [];

  while (actions < maxActions && idlePasses < 3) {
    const entry = findVisibleModal(frame);
    if (!entry) {
      idlePasses++;
      await delay(2);
      continue;
    }
    idlePasses = 0;
    const button = chooseKnownButton(frame.contentWindow, entry.modal, entry.selector);
    if (!button) {
      throw new Error(`unhandled_modal:${describeModal(entry.modal, entry.selector, [])}`);
    }
    trace.push(describeModal(entry.modal, entry.selector, getEnabledButtons(frame.contentWindow, entry.modal)));
    button.click();
    actions++;
    await delay(2);
  }

  if (actions >= maxActions) throw new Error(`modal_drain_limit:${trace.slice(-5).join(",")}`);
  return actions;
}

export async function waitUntil(predicate, { timeoutMs = 10000, intervalMs = 2, reason = "timeout" } = {}) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await delay(intervalMs);
  }
  throw new Error(reason);
}
