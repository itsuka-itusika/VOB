import { OPENING_SCRIPT, OPENING_STAGE_DIRECTION } from "./data/openingScript.js";

// 読込などで即座にゲームへ移るときの短い暗転。
const OPENING_SCREEN_FADE_MS = 240;
// 導入を見終えたあとは、メッセージを消してからゲーム画面を出す。
const STORY_FADE_OUT_MS = 500;
const STORY_FADE_IN_MS = 500;
// ト書きを見せてから消し、間を空けてから最初の声を出す。
const STAGE_HOLD_MS = 2400;
const STAGE_FADE_OUT_MS = 1000;
const VOICE_START_DELAY_MS = 1100;

// 見直しでは既にゲームが始まっているため、最後のボタンの文言を変える。
let isReplayMode = false;
let messageIndex = -1;
let pendingTimerIds = [];
let loadHandlers = {};

function getElement(id) {
  return document.getElementById(id);
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isLastMessage() {
  return messageIndex >= OPENING_SCRIPT.length - 1;
}

function scheduleOpeningStep(callback, delayMs) {
  pendingTimerIds.push(window.setTimeout(callback, delayMs));
}

function clearPendingTimers() {
  if (pendingTimerIds.length === 0) return false;
  pendingTimerIds.forEach(id => window.clearTimeout(id));
  pendingTimerIds = [];
  return true;
}

function setWaitingForInput(waiting) {
  const cursor = getElement("openingMessageCursor");
  const continueButton = getElement("openingStoryContinueButton");
  const skipButton = getElement("openingStorySkipButton");
  const showContinue = waiting && isLastMessage();
  if (cursor) cursor.hidden = !waiting || showContinue;
  if (continueButton) {
    continueButton.hidden = !showContinue;
    continueButton.textContent = isReplayMode ? "ゲームへ戻る" : "ゲームを始める";
  }
  // 最後の1枚では飛ばす先がないため、スキップは開始ボタンへ置き換える。
  if (skipButton) skipButton.hidden = showContinue;
  if (showContinue) window.requestAnimationFrame(() => continueButton?.focus());
}

function showMessage(index) {
  const message = OPENING_SCRIPT[index];
  if (!message) return;

  messageIndex = index;
  getElement("openingStoryStage")?.classList.remove("is-visible");
  const speaker = getElement("openingMessageSpeaker");
  if (speaker) speaker.textContent = message.speaker;
  const screenReaderText = getElement("openingMessageSr");
  if (screenReaderText) screenReaderText.textContent = `${message.speaker} ${message.text}`;
  const messageWindow = getElement("openingMessageWindow");
  if (messageWindow) messageWindow.hidden = false;
  // 区切りごとに全文を一度に出す。文字送りはしない。
  // 台本の改行は行ごとの要素に分け、行内だけで折り返させる。
  const textElement = getElement("openingMessageText");
  if (textElement) {
    textElement.textContent = "";
    message.text.split("\n").forEach(line => {
      const row = document.createElement("span");
      row.className = "opening-message-line";
      row.textContent = line;
      textElement.appendChild(row);
    });
  }
  setWaitingForInput(true);
}

function resetOpeningStory() {
  clearPendingTimers();
  messageIndex = -1;

  getElement("openingStory")?.classList.remove("is-ending");
  getElement("openingStoryStage")?.classList.remove("is-visible");
  const messageWindow = getElement("openingMessageWindow");
  if (messageWindow) messageWindow.hidden = true;
  const textElement = getElement("openingMessageText");
  if (textElement) textElement.textContent = "";
  const speaker = getElement("openingMessageSpeaker");
  if (speaker) speaker.textContent = "";
  const screenReaderText = getElement("openingMessageSr");
  if (screenReaderText) screenReaderText.textContent = "";
  const cursor = getElement("openingMessageCursor");
  if (cursor) cursor.hidden = true;
  const continueButton = getElement("openingStoryContinueButton");
  if (continueButton) continueButton.hidden = true;
  const skipButton = getElement("openingStorySkipButton");
  if (skipButton) skipButton.hidden = false;
}

function startOpeningStory() {
  resetOpeningStory();
  const stage = getElement("openingStoryStage");
  if (stage) {
    stage.textContent = OPENING_STAGE_DIRECTION;
    window.requestAnimationFrame(() => stage.classList.add("is-visible"));
  }

  if (prefersReducedMotion()) {
    showMessage(0);
    return;
  }
  // ト書きが消えきってから、少し置いて最初の声を出す。
  scheduleOpeningStep(() => stage?.classList.remove("is-visible"), STAGE_HOLD_MS);
  scheduleOpeningStep(() => {
    clearPendingTimers();
    showMessage(0);
  }, STAGE_HOLD_MS + STAGE_FADE_OUT_MS + VOICE_START_DELAY_MS);
}

/** 導入を見終えたあと、メッセージを消してからゲーム画面へ移る。 */
function finishOpeningStory() {
  const story = getElement("openingStory");
  if (!story || prefersReducedMotion()) {
    enterGame();
    return;
  }
  story.classList.add("is-ending");
  scheduleOpeningStep(() => enterGame(STORY_FADE_IN_MS), STORY_FADE_OUT_MS);
}

function advanceOpeningStory() {
  // 最初の声を待っている間の入力は、待ち時間の短縮として扱う。
  if (clearPendingTimers()) {
    showMessage(0);
    return;
  }
  if (messageIndex >= 0 && !isLastMessage()) showMessage(messageIndex + 1);
}

function setOpeningView(view) {
  const screen = getElement("openingScreen");
  if (!screen) return;

  const views = {
    menu: getElement("openingMenu"),
    story: getElement("openingStory")
  };
  Object.entries(views).forEach(([name, element]) => {
    if (element) element.hidden = name !== view;
  });
  screen.dataset.view = view;

  if (view === "story") {
    views.story?.scrollTo?.({ top: 0 });
    startOpeningStory();
  } else {
    resetOpeningStory();
  }

  const focusTargets = {
    menu: getElement("openingNewGameButton"),
    story: getElement("openingStoryTitle")
  };
  window.requestAnimationFrame(() => focusTargets[view]?.focus({ preventScroll: view === "story" }));
}

export function enterGame(fadeMs = OPENING_SCREEN_FADE_MS) {
  const screen = getElement("openingScreen");
  document.body.classList.remove("opening-active");
  if (!screen || screen.hidden) {
    resetOpeningStory();
    return;
  }

  clearPendingTimers();
  screen.style.transitionDuration = `${fadeMs}ms`;
  screen.classList.add("is-closing");
  screen.setAttribute("aria-hidden", "true");
  // 暗転が終わるまで導入の表示を残し、消えたあとに片付ける。
  window.setTimeout(() => {
    screen.hidden = true;
    resetOpeningStory();
    getElement("nextTurnButton")?.focus();
  }, fadeMs);
}

function trapOpeningFocus(event) {
  if (event.key !== "Tab") return;
  const visibleView = event.currentTarget.querySelector(".opening-view:not([hidden])");
  const buttons = Array.from(visibleView?.querySelectorAll("button:not([disabled]):not([hidden])") || []);
  if (buttons.length === 0) return;

  const firstButton = buttons[0];
  const lastButton = buttons[buttons.length - 1];
  const focusStart = visibleView.querySelector('[tabindex="-1"]') || firstButton;
  if (!visibleView.contains(document.activeElement)) {
    event.preventDefault();
    firstButton.focus();
  } else if (event.shiftKey && document.activeElement === focusStart) {
    event.preventDefault();
    lastButton.focus();
  } else if (!event.shiftKey && document.activeElement === lastButton) {
    event.preventDefault();
    firstButton.focus();
  }
}

function isButtonTarget(target) {
  return !!target?.closest?.("button");
}

function handleStoryPointerDown(event) {
  if (isButtonTarget(event.target)) return;
  advanceOpeningStory();
}

function handleStoryKeydown(event) {
  if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
  if (isButtonTarget(event.target)) return;
  event.preventDefault();
  advanceOpeningStory();
}

function applyLocalSaveState(getLocalSaveLabel) {
  const button = getElement("openingLoadLocalButton");
  const note = getElement("openingLoadLocalNote");
  if (!button) return;

  const label = typeof getLocalSaveLabel === "function" ? getLocalSaveLabel() : "";
  button.disabled = !label;
  if (!note) return;
  note.textContent = label || "保存データがありません";
  note.hidden = false;
}

function applyVersionLabel() {
  const version = getElement("openingVersion");
  if (!version) return;
  // 表記が二重にならないよう、ヘッダーのタイトルからバージョンを読み取る。
  version.textContent = getElement("appTitle")?.textContent?.match(/ver\.[\d.]+/)?.[0] || "";
}

/** ゲーム開始後にオープニングを見直す。導入を終えると元のゲーム画面へ戻る。 */
export function replayOpeningStory() {
  const screen = getElement("openingScreen");
  if (!screen) return;

  isReplayMode = true;
  screen.hidden = false;
  screen.classList.remove("is-closing");
  screen.style.transitionDuration = "";
  screen.removeAttribute("aria-hidden");
  document.body.classList.add("opening-active");
  setOpeningView("story");
}

export function initOpeningScreen({ onLoadLocal, onLoadJson, getLocalSaveLabel } = {}) {
  const screen = getElement("openingScreen");
  if (!screen) return;

  loadHandlers = { onLoadLocal, onLoadJson };
  document.body.classList.add("opening-active");
  applyLocalSaveState(getLocalSaveLabel);
  applyVersionLabel();
  getElement("openingNewGameButton")?.addEventListener("click", () => {
    isReplayMode = false;
    setOpeningView("story");
  });
  getElement("openingStorySkipButton")?.addEventListener("click", () => enterGame());
  getElement("openingStoryContinueButton")?.addEventListener("click", finishOpeningStory);
  getElement("openingLoadLocalButton")?.addEventListener("click", () => loadHandlers.onLoadLocal?.());
  getElement("openingLoadJsonButton")?.addEventListener("click", () => loadHandlers.onLoadJson?.());

  const story = getElement("openingStory");
  story?.addEventListener("pointerdown", handleStoryPointerDown);
  story?.addEventListener("keydown", handleStoryKeydown);
  screen.addEventListener("keydown", trapOpeningFocus);
  setOpeningView("menu");
}
