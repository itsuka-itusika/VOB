import { addStoredResource } from "./domain/resourceLimits.js";
import { MESSENGER_PASS_SECRET_TREASURE_ID, TUTORIAL_TASKS } from "./data/tutorialData.js";
import { clampValue } from "./util.js";

const TUTORIAL_MODAL_ID = "tutorialCompletionModal";
const TUTORIAL_OVERLAY_ID = "tutorialCompletionOverlay";
const PRIORITY_MODAL_SELECTORS = [
  "#actionPhaseModal",
  "#seasonChangeDialog",
  "#festivalModal",
  "#randomEventModal",
  "#raidWarningModal",
  "#secretTreasureEventModal",
  ".effect-result-modal",
  "#recruitmentModal",
  "#seductionModal",
  "#merchantTradeModal",
  "#miracleModal",
  "#buildingModal",
  "#secretTreasureModal",
  "#conversationModal",
  "#exchangeModal",
  "#panFluteExchangeModal",
  "#raidModal",
  "#villageScaleModal",
  "#headmanElectionModal"
];

const taskById = new Map(TUTORIAL_TASKS.map(task => [task.id, task]));
let modalQueue = [];
let modalOpen = false;
let modalObserver = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

export function normalizeTutorialState(source = null) {
  const completed = {};
  TUTORIAL_TASKS.forEach(task => {
    completed[task.id] = !!source?.completed?.[task.id];
  });

  const complete = !!source?.complete || TUTORIAL_TASKS.every(task => completed[task.id]);
  if (complete) {
    TUTORIAL_TASKS.forEach(task => {
      completed[task.id] = true;
    });
  }

  return { completed, complete };
}

export function ensureTutorialState(village) {
  if (!village) return normalizeTutorialState();
  village.tutorial = normalizeTutorialState(village.tutorial);
  return village.tutorial;
}

export function getTutorialWarnings(village) {
  const state = ensureTutorialState(village);
  if (state.complete) return [];

  const nextTask = TUTORIAL_TASKS.find(task => !state.completed[task.id]);
  return nextTask ? [{
    level: "tutorial",
    text: nextTask.warningText
  }] : [];
}

function applyTutorialReward(village, task) {
  const reward = task.reward || {};
  if (reward.resource === "food" || reward.resource === "materials") {
    addStoredResource(village, reward.resource, reward.amount);
    return;
  }
  if (reward.resource === "funds") {
    village.funds = clampValue((Number(village.funds) || 0) + (Number(reward.amount) || 0), 0, 99999);
    return;
  }
  if (reward.secretTreasureId === MESSENGER_PASS_SECRET_TREASURE_ID) {
    if (!Array.isArray(village.secretTreasures)) village.secretTreasures = [];
    village.secretTreasures.push({ id: MESSENGER_PASS_SECRET_TREASURE_ID });
  }
}

export function completeTutorialTask(village, taskId) {
  const task = taskById.get(taskId);
  if (!village || !task) return false;

  const state = ensureTutorialState(village);
  if (state.complete || state.completed[taskId]) return false;

  state.completed[taskId] = true;
  applyTutorialReward(village, task);

  const allComplete = TUTORIAL_TASKS.every(item => state.completed[item.id]);
  state.complete = allComplete;
  village.tutorial = state;

  if (typeof village.log === "function") {
    village.log(`【チュートリアル】${task.title}達成。報酬: ${task.rewardText}`);
    if (allComplete) village.log("【チュートリアル】すべての項目を達成しました。");
  }

  queueTutorialModal(village, task.id);
  return true;
}

function isPriorityModalOpen() {
  if (typeof document === "undefined") return false;
  return PRIORITY_MODAL_SELECTORS.some(selector => {
    return Array.from(document.querySelectorAll(selector)).some(element => {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
    });
  });
}

function waitForPriorityModalsToClose() {
  if (typeof document === "undefined" || modalObserver) return;
  modalObserver = new MutationObserver(showNextTutorialModal);
  modalObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden"],
    childList: true,
    subtree: true
  });
}

function stopWaitingForPriorityModals() {
  if (!modalObserver) return;
  modalObserver.disconnect();
  modalObserver = null;
}

function queueTutorialModal(village, taskId) {
  if (typeof document === "undefined") return;
  modalQueue.push({ village, taskId });
  setTimeout(showNextTutorialModal, 0);
}

function showNextTutorialModal() {
  if (typeof document === "undefined") return;
  if (modalOpen) return;
  if (modalQueue.length === 0) {
    stopWaitingForPriorityModals();
    return;
  }
  if (isPriorityModalOpen()) {
    waitForPriorityModalsToClose();
    return;
  }

  stopWaitingForPriorityModals();
  const item = modalQueue.shift();
  showTutorialCompletionModal(item.village, item.taskId);
}

function buildChecklistHtml(village) {
  const state = ensureTutorialState(village);
  return TUTORIAL_TASKS.map(task => `
    <label class="tutorial-checklist-item">
      <input type="checkbox" disabled ${state.completed[task.id] ? "checked" : ""}>
      <span class="tutorial-checklist-title">${escapeHtml(task.title)}</span>
      <span class="tutorial-checklist-status">${state.completed[task.id] ? "達成済み" : "未達成"}</span>
    </label>
  `).join("");
}

function showTutorialCompletionModal(village, taskId) {
  const task = taskById.get(taskId);
  if (!task) return;

  document.getElementById(TUTORIAL_OVERLAY_ID)?.remove();
  document.getElementById(TUTORIAL_MODAL_ID)?.remove();
  modalOpen = true;

  const state = ensureTutorialState(village);
  const overlay = document.createElement("div");
  overlay.id = TUTORIAL_OVERLAY_ID;
  overlay.className = "tutorial-completion-overlay";

  const modal = document.createElement("div");
  modal.id = TUTORIAL_MODAL_ID;
  modal.className = "effect-result-modal tutorial-completion-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="tutorial-completion-body">
      <h3>チュートリアル達成</h3>
      <p class="tutorial-completion-current">今回達成: ${escapeHtml(task.title)}</p>
      <p class="tutorial-completion-description">${escapeHtml(task.descriptionText || task.conditionText || "")}</p>
      <p class="tutorial-completion-reward">報酬を獲得しました。報酬: ${escapeHtml(task.rewardText)}</p>
    </div>
    <div class="tutorial-checklist">
      <div class="tutorial-checklist-heading">チュートリアル一覧</div>
      ${buildChecklistHtml(village)}
    </div>
    ${state.complete ? '<p class="tutorial-completion-all-done">すべてのチュートリアルを達成しました。</p>' : ""}
    <div class="tutorial-completion-buttons">
      <button type="button" data-close-tutorial-modal>閉じる</button>
    </div>
  `;

  const close = () => {
    overlay.remove();
    modal.remove();
    modalOpen = false;
    setTimeout(showNextTutorialModal, 0);
  };
  overlay.addEventListener("click", close);
  modal.querySelector("[data-close-tutorial-modal]").addEventListener("click", close);

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-tutorial-modal]")?.focus();
}
