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

  return TUTORIAL_TASKS
    .filter(task => !state.completed[task.id])
    .map(task => ({
      level: "warning",
      text: task.warningText
    }));
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
  return PRIORITY_MODAL_SELECTORS.some(selector => document.querySelector(selector));
}

function waitForPriorityModalsToClose() {
  if (typeof document === "undefined" || modalObserver) return;
  modalObserver = new MutationObserver(showNextTutorialModal);
  modalObserver.observe(document.body, { childList: true, subtree: true });
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
    <label style="display:block;padding:4px 0;">
      <input type="checkbox" disabled ${state.completed[task.id] ? "checked" : ""}>
      ${escapeHtml(task.title)}
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
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9998;";

  const modal = document.createElement("div");
  modal.id = TUTORIAL_MODAL_ID;
  modal.className = "effect-result-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:520px;width:calc(100% - 32px);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
  modal.innerHTML = `
    <h3 style="margin:0 0 12px;">チュートリアル達成</h3>
    <p style="margin:0 0 8px;">今回達成: ${escapeHtml(task.title)}</p>
    <p style="margin:0 0 12px;">獲得報酬: ${escapeHtml(task.rewardText)}</p>
    <div style="margin:0 0 12px;">
      <div style="font-weight:bold;margin-bottom:4px;">達成状況</div>
      ${buildChecklistHtml(village)}
    </div>
    ${state.complete ? '<p style="margin:0 0 12px;">すべてのチュートリアルを達成しました。</p>' : ""}
    <div style="text-align:right;">
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
