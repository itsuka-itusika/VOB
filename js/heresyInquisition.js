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
  const shortageText = canAfford
    ? ""
    : `<p class="heresy-inquisition-warning">現在の資金では、もてなしに必要な費用を用意できません。</p>`;

  createModalLayer({
    overlayId: "heresyInquisitionOverlay",
    modalId: "heresyInquisitionModal",
    title: "異端審問",
    bodyHtml: getInquisitorBody(`
      <p>${speech.opening}</p>
      <div class="heresy-inquisition-cost">
        <span>もてなし費用</span>
        <strong>資金 ${cost}</strong>
        <small>現在の資金 ${funds}</small>
      </div>
      ${shortageText}
      <ul class="heresy-inquisition-choices">
        <li><strong>もてなす</strong>資金${cost}を支払います。村に変化はありません。</li>
        <li><strong>追い払う</strong>村に「異端」が記録され、襲撃の傾向が変わります。取り消しはできません。</li>
      </ul>
    `, portraitPath),
    buttons: [
      {
        label: "もてなす",
        className: "heresy-hospitality-button",
        disabledReason: canAfford ? "" : `もてなしには資金${cost}が必要です（現在${funds}）`,
        onClick: () => handleHospitality(village, cost, portraitPath, speech)
      },
      {
        label: "追い払う",
        className: "heresy-expulsion-button",
        onClick: () => handleExpulsion(village, portraitPath, speech)
      }
    ]
  });
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
      <p class="heresy-inquisition-result">資金-${cost}。村に「異端」は付きませんでした。</p>
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
      <p>村人たちは異端審問官を村の外へ追い立てた。</p>
      <p>${speech.expulsion}</p>
      <p class="heresy-inquisition-result">村特性「異端」が付き、異端専用の襲撃テーブルへ切り替わりました。</p>
    `, portraitPath),
    buttons: [{
      label: "閉じる",
      onClick: () => removeModalLayer(ids.overlayId, ids.modalId)
    }]
  });
}
