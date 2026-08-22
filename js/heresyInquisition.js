import { getDivineMightLevel, runAfterPendingDivineMightLevelUp } from "./divineMight.js";
import { getPortraitAssetPath, INQUISITOR_PORTRAIT_FILES } from "./data/portraitPaths.js";
import { getPortraitSpriteHtml } from "./data/portraitAtlas.js";
import { pickInquisitorSpeechSet } from "./data/dialogue/inquisitorLines.js";
import { isHeadmanElectionModalPendingOrOpen } from "./headmanElection.js";
import { updateUI } from "./ui.js";
import { getVillageScaleStage } from "./villageScale.js";

export const HERESY_INQUISITION_CHANCE = 0.25;
export const HERESY_TRAIT = "異端";

const MIN_SCALE_STAGE_INDEX = 5;
const MIN_DIVINE_MIGHT_LEVEL = 3;
const PRIORITY_MODAL_SELECTORS = [
  "#actionPhaseModal",
  "#seasonChangeDialog",
  "#festivalModal",
  "#randomEventModal",
  "#raidWarningModal",
  "#buildingRequestModal",
  "#buildingRequestCompleteModal",
  "#wishModal",
  "#wishCompleteModal",
  "#secretTreasureEventModal",
  ".effect-result-modal",
  "#villageScaleModal",
  "#divineMightLevelUpModal"
];

let pendingVillage = null;
let priorityModalObserver = null;

export function getHeresyInquisitionHospitalityCost(village) {
  const scale = Math.max(0, Number(village?.building) || 0);
  const divineMight = Math.max(0, Number(village?.divineMight) || 0);
  return Math.ceil(600 * (scale / 250) * (divineMight / 180));
}

export function canTriggerHeresyInquisition(village) {
  if (!village || village.gameOver) return false;
  const villageTraits = Array.isArray(village.villageTraits) ? village.villageTraits : [];
  return getVillageScaleStage(village.building).index >= MIN_SCALE_STAGE_INDEX
    && getDivineMightLevel(village) >= MIN_DIVINE_MIGHT_LEVEL
    && village.apocalypseCleared !== true
    && !villageTraits.includes(HERESY_TRAIT);
}

export function tryTriggerHeresyInquisition(village, options = {}) {
  if (!canTriggerHeresyInquisition(village)) return false;

  if (!options.skipDivineMightDelay && runAfterPendingDivineMightLevelUp(village, () => {
    tryTriggerHeresyInquisition(village, { ...options, skipDivineMightDelay: true });
  })) {
    return true;
  }

  const random = typeof options.random === "function" ? options.random : Math.random;
  if (!options.force && random() >= HERESY_INQUISITION_CHANCE) return false;

  pendingVillage = village;
  showInquisitionWhenReady();
  return true;
}

function isPriorityModalOpen() {
  return isHeadmanElectionModalPendingOrOpen()
    || PRIORITY_MODAL_SELECTORS.some(selector => document.querySelector(selector));
}

function waitForPriorityModalsToClose() {
  if (priorityModalObserver) return;
  priorityModalObserver = new MutationObserver(showInquisitionWhenReady);
  priorityModalObserver.observe(document.body, { childList: true, subtree: true });
}

function stopWaitingForPriorityModals() {
  if (!priorityModalObserver) return;
  priorityModalObserver.disconnect();
  priorityModalObserver = null;
}

function showInquisitionWhenReady() {
  if (!pendingVillage || typeof document === "undefined") {
    stopWaitingForPriorityModals();
    return;
  }
  if (isPriorityModalOpen()) {
    waitForPriorityModalsToClose();
    return;
  }

  stopWaitingForPriorityModals();
  const village = pendingVillage;
  pendingVillage = null;
  showInquisitionChoiceModal(village);
}

function createModalLayer({ overlayId, modalId, title, bodyHtml, buttons }) {
  const overlay = document.createElement("div");
  overlay.id = overlayId;
  overlay.className = "event-modal-overlay heresy-inquisition-overlay";

  const modal = document.createElement("div");
  modal.id = modalId;
  modal.className = "event-modal heresy-inquisition-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", `${modalId}Title`);
  modal.innerHTML = `
    <div class="heresy-inquisition-body">
      <h2 id="${modalId}Title">${title}</h2>
      ${bodyHtml}
      <div class="heresy-inquisition-buttons"></div>
    </div>
  `;

  const buttonArea = modal.querySelector(".heresy-inquisition-buttons");
  buttons.forEach(({ label, onClick, className = "", disabledReason = "" }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (className) button.className = className;
    if (disabledReason) {
      button.disabled = true;
      button.title = disabledReason;
    } else {
      button.onclick = onClick;
    }
    buttonArea.appendChild(button);
  });

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  buttonArea.querySelector("button:not([disabled])")?.focus();
  return { overlay, modal };
}

function removeModalLayer(overlayId, modalId) {
  document.getElementById(overlayId)?.remove();
  document.getElementById(modalId)?.remove();
}

export function getRandomInquisitorPortraitPath(random = Math.random) {
  const portraitFile = INQUISITOR_PORTRAIT_FILES[Math.floor(random() * INQUISITOR_PORTRAIT_FILES.length)];
  return getPortraitAssetPath(portraitFile);
}

function getInquisitorBody(contentHtml, portraitPath) {
  return `
    <div class="heresy-inquisition-speaker">
      <div class="heresy-inquisition-portrait">
        ${getPortraitSpriteHtml({ portraitFile: portraitPath }, { alt: "異端審問官" })}
      </div>
      <div class="heresy-inquisition-dialogue">
        <div class="heresy-inquisition-name">異端審問官｜新しき神の教会</div>
        ${contentHtml}
      </div>
    </div>
  `;
}

function showInquisitionChoiceModal(village) {
  const cost = getHeresyInquisitionHospitalityCost(village);
  const funds = Math.max(0, Number(village.funds) || 0);
  const portraitPath = getRandomInquisitorPortraitPath();
  const speech = pickInquisitorSpeechSet();
  const canAfford = funds >= cost;

  createModalLayer({
    overlayId: "heresyInquisitionOverlay",
    modalId: "heresyInquisitionModal",
    title: "異端審問",
    bodyHtml: getInquisitorBody(`<p>${speech.opening}</p>`, portraitPath),
    buttons: [
      {
        // 費用は独立した欄を作らず、選択肢そのものに添えて読ませる。
        label: `もてなす（費用${cost}/所持${funds}）`,
        className: "heresy-hospitality-button",
        disabledReason: canAfford ? "" : `もてなしには資金${cost}が必要です（所持${funds}）`,
        onClick: () => handleHospitality(village, cost, portraitPath, speech)
      },
      {
        label: "追い払う",
        className: "heresy-expulsion-button",
        onClick: () => confirmExpulsion(village, portraitPath, speech)
      }
    ]
  });
}

// 取り消せない選択なので、リスクは選択モーダルへ並べず、実行の直前に確かめる。
function confirmExpulsion(village, portraitPath, speech) {
  const message = [
    "異端審問官を追い払いますか？",
    "",
    "村特性「異端」が付き、襲撃が異端専用のものへ切り替わります。",
    "一度付いた「異端」は取り消せません。"
  ].join("\n");
  if (!confirm(message)) return;
  handleExpulsion(village, portraitPath, speech);
}

function handleHospitality(village, cost, portraitPath, speech) {
  village.funds = Math.max(0, (Number(village.funds) || 0) - cost);
  village.log(`【異端審問】異端審問官をもてなし、資金${cost}を支払って調査を切り抜けた。`);
  updateUI(village);
  removeModalLayer("heresyInquisitionOverlay", "heresyInquisitionModal");
  showHospitalityResultModal(cost, portraitPath, speech);
}

function handleExpulsion(village, portraitPath, speech) {
  const villageTraits = Array.isArray(village.villageTraits)
    ? village.villageTraits
    : (village.villageTraits = []);
  if (!villageTraits.includes(HERESY_TRAIT)) villageTraits.push(HERESY_TRAIT);

  village.log("【異端審問】異端審問官を追い払い、村は異端として記録された。");
  updateUI(village);
  removeModalLayer("heresyInquisitionOverlay", "heresyInquisitionModal");
  showExpulsionResultModal(portraitPath, speech);
}

function showHospitalityResultModal(cost, portraitPath, speech) {
  const ids = {
    overlayId: "inquisitionHospitalityResultOverlay",
    modalId: "inquisitionHospitalityResultModal"
  };
  createModalLayer({
    ...ids,
    title: "異端審問：もてなし",
    bodyHtml: getInquisitorBody(`
      <p>${speech.hospitality}</p>
      <p class="heresy-inquisition-result">資金 -${cost}</p>
    `, portraitPath),
    buttons: [{
      label: "閉じる",
      onClick: () => removeModalLayer(ids.overlayId, ids.modalId)
    }]
  });
}

function showExpulsionResultModal(portraitPath, speech) {
  const ids = {
    overlayId: "inquisitionExpulsionResultOverlay",
    modalId: "inquisitionExpulsionResultModal"
  };
  createModalLayer({
    ...ids,
    title: "異端審問：追放",
    bodyHtml: getInquisitorBody(`
      <p>${speech.expulsion}</p>
      <p class="heresy-inquisition-result">村特性「異端」が付いた</p>
    `, portraitPath),
    buttons: [{
      label: "閉じる",
      onClick: () => removeModalLayer(ids.overlayId, ids.modalId)
    }]
  });
}
