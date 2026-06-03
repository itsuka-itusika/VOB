import { isHeadmanElectionModalPendingOrOpen } from "./headmanElection.js";
import { getConversationLine } from "./dialogue/dialogueEngine.js";
import { getPortraitPath } from "./util.js";

const MODAL_OVERLAY_ID = "raidWarningOverlay";
const MODAL_ID = "raidWarningModal";
const PRIORITY_MODAL_SELECTORS = [
  "#actionPhaseModal",
  "#seasonChangeDialog",
  "#festivalModal",
  "#randomEventModal",
  ".effect-result-modal",
  "#secretTreasureEventModal"
];

let pendingRaidWarning = null;
let priorityModalObserver = null;

export function showRaidWarningModal({
  raidName,
  representative,
  introDialogues = [],
  enemyCount,
  avoidanceOption = null,
  onAvoidance = null
}) {
  if (typeof document === "undefined") return;

  pendingRaidWarning = {
    raidName,
    representative,
    introDialogues,
    enemyCount,
    avoidanceOption,
    onAvoidance
  };
  closeRaidWarningModal();
  showRaidWarningWhenReady();
}

function isPriorityModalOpen() {
  return isHeadmanElectionModalPendingOrOpen() ||
    PRIORITY_MODAL_SELECTORS.some(selector => document.querySelector(selector));
}

function waitForPriorityModalsToClose() {
  if (priorityModalObserver) return;
  priorityModalObserver = new MutationObserver(showRaidWarningWhenReady);
  priorityModalObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function stopWaitingForPriorityModals() {
  if (!priorityModalObserver) return;
  priorityModalObserver.disconnect();
  priorityModalObserver = null;
}

function showRaidWarningWhenReady() {
  if (!pendingRaidWarning) {
    stopWaitingForPriorityModals();
    return;
  }

  if (isPriorityModalOpen()) {
    waitForPriorityModalsToClose();
    return;
  }

  stopWaitingForPriorityModals();
  const {
    raidName,
    representative,
    introDialogues,
    enemyCount,
    avoidanceOption,
    onAvoidance
  } = pendingRaidWarning;
  pendingRaidWarning = null;

  const isSingleEnemy = enemyCount === 1;
  const countText = isSingleEnemy ? "1体" : `${enemyCount}体`;
  const speakerName = getRepresentativeDisplayName(representative, raidName);
  const line = getRaidWarningLine({ representative, introDialogues, raidName });

  const overlay = document.createElement("div");
  overlay.id = MODAL_OVERLAY_ID;

  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "raidWarningTitle");

  const title = document.createElement("h2");
  title.id = "raidWarningTitle";
  title.textContent = "襲撃発生";

  const content = document.createElement("div");
  content.className = "conversation-content";

  const portraitArea = document.createElement("div");
  portraitArea.className = "portrait-area";
  const portrait = document.createElement("img");
  portrait.src = representative ? getPortraitPath(representative) : "images/portraits/default.png";
  portrait.alt = "";
  portrait.onerror = () => {
    portrait.src = "images/portraits/default.png";
  };
  portraitArea.appendChild(portrait);

  const dialogueArea = document.createElement("div");
  dialogueArea.className = "dialogue-area";

  const characterInfo = document.createElement("div");
  characterInfo.className = "character-info";
  characterInfo.textContent = representative
    ? `${speakerName}｜${raidName}`
    : `${raidName || "襲撃者"}｜${countText}`;

  const text = document.createElement("div");
  text.className = "raid-warning-text";
  const lineElement = document.createElement("p");
  lineElement.textContent = line;
  text.appendChild(lineElement);

  const detail = document.createElement("div");
  detail.className = "raid-warning-detail";
  detail.textContent = `${raidName || "襲撃"} / ${countText}`;
  if (avoidanceOption?.detail) {
    const avoidanceDetail = document.createElement("div");
    avoidanceDetail.textContent = avoidanceOption.detail;
    detail.appendChild(avoidanceDetail);
  }

  dialogueArea.appendChild(characterInfo);
  dialogueArea.appendChild(text);
  dialogueArea.appendChild(detail);
  content.appendChild(portraitArea);
  content.appendChild(dialogueArea);

  const buttons = document.createElement("div");
  buttons.className = "modal-buttons";

  if (avoidanceOption) {
    const avoidanceButton = document.createElement("button");
    avoidanceButton.type = "button";
    avoidanceButton.textContent = avoidanceOption.label;
    avoidanceButton.disabled = !!avoidanceOption.disabled;
    if (avoidanceOption.disabledReason) {
      avoidanceButton.title = avoidanceOption.disabledReason;
    }
    avoidanceButton.onclick = () => {
      if (typeof onAvoidance === "function" && onAvoidance()) {
        closeRaidWarningModal();
      }
    };
    buttons.appendChild(avoidanceButton);
  }

  const interceptButton = document.createElement("button");
  interceptButton.type = "button";
  interceptButton.textContent = "防衛する";
  interceptButton.onclick = closeRaidWarningModal;

  modal.appendChild(title);
  modal.appendChild(content);
  modal.appendChild(buttons);
  buttons.appendChild(interceptButton);

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  const focusTarget = buttons.querySelector("button:not(:disabled)") || interceptButton;
  focusTarget.focus();
}

export function closeRaidWarningModal() {
  const overlay = document.getElementById(MODAL_OVERLAY_ID);
  const modal = document.getElementById(MODAL_ID);
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function getRaidWarningLine({ representative, introDialogues, raidName }) {
  if (Array.isArray(introDialogues) && introDialogues.length > 0) {
    return introDialogues[Math.floor(Math.random() * introDialogues.length)];
  }

  if (representative) {
    return getConversationLine({ character: representative, village: null }) || "...";
  }

  return `${raidName || "襲撃者"}が村に近づいています。`;
}

function getRepresentativeDisplayName(representative, fallbackName) {
  const name = representative?.name || fallbackName || "襲撃者";
  const raiderType = String(representative?.raiderType || "").trim();
  if (!raiderType || name === raiderType || name.startsWith(`${raiderType}の`)) {
    return name;
  }
  return `${raiderType}（${name}）`;
}
