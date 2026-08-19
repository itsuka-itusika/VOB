import { OPENING_SCRIPT, OPENING_STAGE_DIRECTION } from "./data/openingScript.js";

const OPENING_SCREEN_FADE_MS = 240;
// 暗転してから最初の声が出るまでの間。
const MESSAGE_START_DELAY_MS = 900;
const CHAR_INTERVAL_MS = 45;
// 句読点の後だけ長めに止めると、読み上げの息継ぎに近い間になる。
const PUNCTUATION_EXTRA_MS = {
  "、": 170,
  "，": 170,
  "。": 280,
  "？": 280,
  "！": 280,
  "…": 220
};

let messageIndex = -1;
let typingState = null;
let messageStartTimerId = null;
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

function stopTyping() {
  if (typingState?.rafId) window.cancelAnimationFrame(typingState.rafId);
  typingState = null;
}

function clearMessageStartTimer() {
  if (messageStartTimerId === null) return false;
  window.clearTimeout(messageStartTimerId);
  messageStartTimerId = null;
  return true;
}

function setWaitingForInput(waiting) {
  const cursor = getElement("openingMessageCursor");
  const continueButton = getElement("openingStoryContinueButton");
  const showContinue = waiting && isLastMessage();
  if (cursor) cursor.hidden = !waiting || showContinue;
  if (continueButton) continueButton.hidden = !showContinue;
  if (showContinue) window.requestAnimationFrame(() => continueButton?.focus());
}

function renderTypedText() {
  const textElement = getElement("openingMessageText");
  if (textElement && typingState) {
    textElement.textContent = typingState.chars.slice(0, typingState.shownCount).join("");
  }
}

function stepTyping(timestamp) {
  if (!typingState) return;
  if (typingState.startTime === null) typingState.startTime = timestamp;

  const elapsed = timestamp - typingState.startTime;
  let shownCount = typingState.shownCount;
  while (shownCount < typingState.timings.length && typingState.timings[shownCount] <= elapsed) {
    shownCount++;
  }
  if (shownCount !== typingState.shownCount) {
    typingState.shownCount = shownCount;
    renderTypedText();
  }

  if (shownCount >= typingState.chars.length) {
    stopTyping();
    setWaitingForInput(true);
    return;
  }
  typingState.rafId = window.requestAnimationFrame(stepTyping);
}

function showFullText(text) {
  const textElement = getElement("openingMessageText");
  if (textElement) textElement.textContent = text;
  setWaitingForInput(true);
}

function startTyping(text) {
  stopTyping();
  setWaitingForInput(false);

  const chars = Array.from(text);
  if (chars.length === 0 || prefersReducedMotion()) {
    showFullText(text);
    return;
  }

  let total = 0;
  const timings = chars.map(char => {
    total += CHAR_INTERVAL_MS + (PUNCTUATION_EXTRA_MS[char] || 0);
    return total;
  });

  const textElement = getElement("openingMessageText");
  if (textElement) textElement.textContent = "";
  typingState = { chars, timings, shownCount: 0, startTime: null, rafId: null };
  typingState.rafId = window.requestAnimationFrame(stepTyping);
}

function completeTyping() {
  if (!typingState) return;
  const fullText = typingState.chars.join("");
  stopTyping();
  showFullText(fullText);
}

function showMessage(index) {
  const message = OPENING_SCRIPT[index];
  if (!message) return;

  messageIndex = index;
  getElement("openingStoryStage")?.classList.remove("is-visible");
  const speaker = getElement("openingMessageSpeaker");
  if (speaker) speaker.textContent = message.speaker;
  // 文字送り中の要素は読み上げが1文字ずつになるため、全文は専用の live 領域へ渡す。
  const screenReaderText = getElement("openingMessageSr");
  if (screenReaderText) screenReaderText.textContent = `${message.speaker} ${message.text}`;
  const messageWindow = getElement("openingMessageWindow");
  if (messageWindow) messageWindow.hidden = false;
  startTyping(message.text);
}

function resetOpeningStory() {
  stopTyping();
  clearMessageStartTimer();
  messageIndex = -1;

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
  messageStartTimerId = window.setTimeout(() => {
    messageStartTimerId = null;
    showMessage(0);
  }, MESSAGE_START_DELAY_MS);
}

function advanceOpeningStory() {
  // 最初の声を待っている間の入力は、待ち時間の短縮として扱う。
  if (clearMessageStartTimer()) {
    showMessage(0);
    return;
  }
  if (typingState) {
    completeTyping();
    return;
  }
  if (messageIndex >= 0 && !isLastMessage()) showMessage(messageIndex + 1);
}

function setOpeningView(view) {
  const screen = getElement("openingScreen");
  if (!screen) return;

  const views = {
    menu: getElement("openingMenu"),
    prompt: getElement("openingNewGamePrompt"),
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
    prompt: getElement("openingWatchButton"),
    story: getElement("openingStoryTitle")
  };
  window.requestAnimationFrame(() => focusTargets[view]?.focus({ preventScroll: view === "story" }));
}

export function enterGame() {
  const screen = getElement("openingScreen");
  document.body.classList.remove("opening-active");
  resetOpeningStory();
  if (!screen || screen.hidden) return;

  screen.classList.add("is-closing");
  screen.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    screen.hidden = true;
    getElement("nextTurnButton")?.focus();
  }, OPENING_SCREEN_FADE_MS);
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

export function initOpeningScreen({ onLoadLocal, onLoadJson } = {}) {
  const screen = getElement("openingScreen");
  if (!screen) return;

  loadHandlers = { onLoadLocal, onLoadJson };
  document.body.classList.add("opening-active");
  getElement("openingNewGameButton")?.addEventListener("click", () => setOpeningView("prompt"));
  getElement("openingWatchButton")?.addEventListener("click", () => setOpeningView("story"));
  getElement("openingSkipButton")?.addEventListener("click", enterGame);
  getElement("openingStorySkipButton")?.addEventListener("click", enterGame);
  getElement("openingStoryContinueButton")?.addEventListener("click", enterGame);
  getElement("openingLoadLocalButton")?.addEventListener("click", () => loadHandlers.onLoadLocal?.());
  getElement("openingLoadJsonButton")?.addEventListener("click", () => loadHandlers.onLoadJson?.());

  const story = getElement("openingStory");
  story?.addEventListener("pointerdown", handleStoryPointerDown);
  story?.addEventListener("keydown", handleStoryKeydown);
  screen.addEventListener("keydown", trapOpeningFocus);
  setOpeningView("menu");
}
