import { getDivineMightLevel } from "./divineMight.js";
import { countBuiltBuildings } from "./domain/buildingState.js";
import { updateUI } from "./ui.js";
import { getVillageScaleStage } from "./villageScale.js";

export const BACCHUS_GOLDEN_STATUE_BUILDING_ID = "bacchusGoldenStatue";
export const BACCHUS_GOLDEN_STATUE_UNLOCK_FLAG = "canBuildBacchusGoldenStatue";
export const BACCHUS_GOLDEN_STATUE_BUILT_FLAG = "hasBacchusGoldenStatue";
export const BACCHUS_GOLDEN_STATUE_EVENT_CHANCE = 0.25;

const AUTONOMOUS_SETTLEMENT_STAGE_INDEX = 6;
const REQUIRED_DIVINE_MIGHT_LEVEL = 5;
const EVENT_MODAL_ID = "bacchusGoldenStatueEventModal";
const EVENT_OVERLAY_ID = "bacchusGoldenStatueEventOverlay";
const BUILD_CONFIRM_MODAL_ID = "bacchusGoldenStatueConfirmModal";
const BUILD_CONFIRM_OVERLAY_ID = "bacchusGoldenStatueConfirmOverlay";
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
  "#heresyInquisitionModal",
  "#inquisitionHospitalityResultModal",
  "#inquisitionExpulsionResultModal",
  "#secretTreasureEventModal",
  ".effect-result-modal",
  "#villageScaleModal",
  "#divineMightLevelUpModal",
  "#headmanElectionModal"
];

let pendingVillage = null;
let priorityModalObserver = null;

function ensureBuildingFlags(village) {
  if (!village.buildingFlags || typeof village.buildingFlags !== "object") {
    village.buildingFlags = {};
  }
  return village.buildingFlags;
}

function hasHeresyTrait(village) {
  return Array.isArray(village?.villageTraits) && village.villageTraits.includes("異端");
}

export function canTriggerBacchusGoldenStatueEvent(village) {
  if (!village || village.gameOver) return false;
  const flags = ensureBuildingFlags(village);
  return hasHeresyTrait(village)
    && getVillageScaleStage(village.building).index >= AUTONOMOUS_SETTLEMENT_STAGE_INDEX
    && getDivineMightLevel(village) >= REQUIRED_DIVINE_MIGHT_LEVEL
    && !flags[BACCHUS_GOLDEN_STATUE_UNLOCK_FLAG]
    && countBuiltBuildings(village, BACCHUS_GOLDEN_STATUE_BUILDING_ID) === 0;
}

export function tryTriggerBacchusGoldenStatueEvent(village, options = {}) {
  if (!canTriggerBacchusGoldenStatueEvent(village)) return false;

  const random = typeof options.random === "function" ? options.random : Math.random;
  if (!options.force && random() >= BACCHUS_GOLDEN_STATUE_EVENT_CHANCE) return false;

  ensureBuildingFlags(village)[BACCHUS_GOLDEN_STATUE_UNLOCK_FLAG] = true;
  village.log("【黄金像建立の機運】バッカスの黄金像が建築可能になりました。");
  updateUI(village);

  pendingVillage = village;
  showEventWhenReady();
  return true;
}

function isVisibleElement(element) {
  if (!element || !element.isConnected || typeof window === "undefined") return false;
  let current = element;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    current = current.parentElement;
  }
  return true;
}

function isPriorityModalOpen() {
  return PRIORITY_MODAL_SELECTORS.some(selector => {
    return Array.from(document.querySelectorAll(selector)).some(isVisibleElement);
  });
}

function waitForPriorityModalsToClose() {
  if (priorityModalObserver) return;
  priorityModalObserver = new MutationObserver(showEventWhenReady);
  priorityModalObserver.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true
  });
}

function stopWaitingForPriorityModals() {
  if (!priorityModalObserver) return;
  priorityModalObserver.disconnect();
  priorityModalObserver = null;
}

function showEventWhenReady() {
  if (!pendingVillage || typeof document === "undefined") {
    stopWaitingForPriorityModals();
    return;
  }
  if (isPriorityModalOpen()) {
    waitForPriorityModalsToClose();
    return;
  }

  stopWaitingForPriorityModals();
  pendingVillage = null;
  showEventModal();
}

function createEventModal({ overlayId, modalId, title, bodyHtml }) {
  document.getElementById(overlayId)?.remove();
  document.getElementById(modalId)?.remove();

  const overlay = document.createElement("div");
  overlay.id = overlayId;
  overlay.className = "event-modal-overlay";

  const modal = document.createElement("div");
  modal.id = modalId;
  modal.className = "event-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", `${modalId}Title`);
  modal.innerHTML = `
    <div class="event-modal-body">
      <h3 id="${modalId}Title">${title}</h3>
      ${bodyHtml}
      <div class="event-modal-buttons">
        <button type="button" data-close-event-modal>閉じる</button>
      </div>
    </div>
  `;

  const close = () => {
    overlay.remove();
    modal.remove();
  };
  modal.querySelector("[data-close-event-modal]").onclick = close;
  overlay.onclick = close;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-event-modal]")?.focus();
}

function showEventModal() {
  createEventModal({
    overlayId: EVENT_OVERLAY_ID,
    modalId: EVENT_MODAL_ID,
    title: "黄金像建立の機運",
    bodyHtml: `
      <p>村人たちはもはや古き神への信仰を隠そうとはしなかった。</p>
      <p>「バッカスを称え、その御姿を黄金に刻もう。われらの村が、誰の恵みで満ちたのかを世に示すのだ」</p>
      <p class="event-modal-reward">バッカスの黄金像が建築可能になりました。</p>
    `
  });
}

/**
 * 黄金像の建設確認。黙示録の入口となる決断のため、
 * ブラウザ標準の確認ではなく専用モーダルで警告する。
 */
export function confirmBacchusGoldenStatueBuild({ warningText = "", onConfirm }) {
  document.getElementById(BUILD_CONFIRM_OVERLAY_ID)?.remove();
  document.getElementById(BUILD_CONFIRM_MODAL_ID)?.remove();

  const overlay = document.createElement("div");
  overlay.id = BUILD_CONFIRM_OVERLAY_ID;
  overlay.className = "event-modal-overlay";

  const modal = document.createElement("div");
  modal.id = BUILD_CONFIRM_MODAL_ID;
  modal.className = "event-modal golden-statue-confirm-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", `${BUILD_CONFIRM_MODAL_ID}Title`);
  modal.innerHTML = `
    <div class="event-modal-body">
      <h3 id="${BUILD_CONFIRM_MODAL_ID}Title">黄金像の建設</h3>
      <p>村人たちは槌を手に、黄金の御姿を仰ぐ日を待っている。</p>
      <p class="golden-statue-confirm-warning">
        警告：黄金像の建設は新しき神の逆鱗に触れます。<br>
        神の怒りは黙示録を招き、七つの大いなる災厄が村を襲うでしょう。
      </p>
      ${warningText ? `<p class="golden-statue-confirm-note">【冬越し資材警告】${warningText}</p>` : ""}
      <div class="event-modal-buttons golden-statue-confirm-buttons">
        <button type="button" data-cancel-golden-statue>やめておく</button>
        <button type="button" class="golden-statue-confirm-button" data-confirm-golden-statue>それでも建設する</button>
      </div>
    </div>
  `;

  const close = () => {
    overlay.remove();
    modal.remove();
  };
  modal.querySelector("[data-cancel-golden-statue]").onclick = close;
  modal.querySelector("[data-confirm-golden-statue]").onclick = () => {
    close();
    if (typeof onConfirm === "function") onConfirm();
  };
  overlay.onclick = close;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  // 取り返しのつかない選択のため、既定の焦点は中止側へ置く。
  modal.querySelector("[data-cancel-golden-statue]")?.focus();
}

export { startApocalypseFromGoldenStatue } from "./apocalypse.js";
