import { addHistoryEvent } from "./history.js";
import { startRaidEvent } from "./raidStart.js";
import { clearRaidWarningModal } from "./raidWarningModal.js";
import { refreshJobTable } from "./domain/jobTables.js";
import {
  APOCALYPSE_TRAIT,
  SALT_PILLAR_DURATION_MONTHS,
  SALT_PILLAR_TRAIT,
  getActiveVillagers,
  isApocalypseActive,
  isSaltPillar
} from "./domain/apocalypseRules.js";
import { clampValue } from "./util.js";
import { syncEffectiveStats } from "./domain/statLayers.js";
import {
  damageBuilding,
  getActiveBuildingIds,
  recalculateBuildingDerivedState
} from "./domain/buildingState.js";
import { getRaidModuleById } from "./data/raidData.js";
import { updateUI } from "./ui.js";
import { getDivineMightLevel, refreshDivineMightLevelUnlock } from "./divineMight.js";

export const APOCALYPSE_RAID_IDS = {
  SIXTH: "apocalypse-grand-crusade",
  SEVENTH: "apocalypse-upper-winged",
  LEGACY_SEVENTH: "apocalypse-four-horsemen"
};

const GOLDEN_STATUE_ID = "bacchusGoldenStatue";
const GOLDEN_STATUE_BUILT_FLAG = "hasBacchusGoldenStatue";
const APOCALYPSE_MODAL_ID = "apocalypseEventModal";
const APOCALYPSE_OVERLAY_ID = "apocalypseEventOverlay";
const PRIORITY_MODAL_SELECTORS = [
  "#actionPhaseModal",
  "#seasonChangeDialog",
  "#festivalModal",
  "#randomEventModal",
  "#raidWarningModal",
  "#buildingRequestModal",
  "#buildingRequestCompleteModal",
  "#heresyInquisitionModal",
  "#bacchusGoldenStatueEventModal",
  "#apocalypseStartModal",
  "#secretTreasureEventModal",
  ".effect-result-modal",
  "#villageScaleModal",
  "#divineMightLevelUpModal",
  "#headmanElectionModal"
];

let pendingModal = null;
let modalObserver = null;

function addVillageTrait(village, trait) {
  if (!Array.isArray(village.villageTraits)) village.villageTraits = [];
  if (!village.villageTraits.includes(trait)) village.villageTraits.push(trait);
}

function removeVillageTrait(village, trait) {
  village.villageTraits = (Array.isArray(village.villageTraits) ? village.villageTraits : [])
    .filter(value => value !== trait);
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

function stopWaitingForModal() {
  if (!modalObserver) return;
  modalObserver.disconnect();
  modalObserver = null;
}

function showPendingModalWhenReady() {
  if (!pendingModal || typeof document === "undefined") {
    stopWaitingForModal();
    return;
  }
  if (isPriorityModalOpen()) {
    if (!modalObserver) {
      modalObserver = new MutationObserver(showPendingModalWhenReady);
      modalObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
    }
    return;
  }

  stopWaitingForModal();
  const modalData = pendingModal;
  pendingModal = null;
  renderApocalypseModal(modalData);
}

function queueApocalypseModal(data) {
  pendingModal = data;
  showPendingModalWhenReady();
}

function renderApocalypseModal({ title, message, effect, image, onClose }) {
  document.getElementById(APOCALYPSE_OVERLAY_ID)?.remove();
  document.getElementById(APOCALYPSE_MODAL_ID)?.remove();

  const overlay = document.createElement("div");
  overlay.id = APOCALYPSE_OVERLAY_ID;
  overlay.className = "event-modal-overlay";

  const modal = document.createElement("div");
  modal.id = APOCALYPSE_MODAL_ID;
  modal.className = "event-modal apocalypse-event-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", `${APOCALYPSE_MODAL_ID}Title`);
  modal.innerHTML = `
    <div class="event-modal-body">
      <h3 id="${APOCALYPSE_MODAL_ID}Title">${title}</h3>
      ${image ? `<img class="event-modal-image apocalypse-event-image" src="${image}" alt="${title}">` : ""}
      <p>${message}</p>
      ${effect ? `<p class="event-modal-reward">${effect}</p>` : ""}
      <div class="event-modal-buttons">
        <button type="button" data-close-apocalypse-modal>閉じる</button>
      </div>
    </div>
  `;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    modal.remove();
    if (typeof onClose === "function") onClose();
  };
  modal.querySelector("[data-close-apocalypse-modal]").onclick = close;
  overlay.onclick = close;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-apocalypse-modal]")?.focus();
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function chooseRandom(items, count) {
  return shuffle(items).slice(0, Math.max(0, count));
}

function stageImage(stage) {
  return `images/events/apocalypse/apocalypse-${stage}.png`;
}

function recordStage(village, stage, title, text) {
  village.apocalypseStage = stage;
  village.log(`【黙示録・第${stage}の災厄】${title}`);
  addHistoryEvent(village, {
    title,
    text,
    tags: ["黙示録", `第${stage}の災厄`]
  });
}

function startScriptedRaid(village, raidId) {
  if (!isApocalypseActive(village)) return;
  const raidDefinition = getRaidModuleById(raidId);
  if (!raidDefinition) {
    village.log(`【黙示録】専用襲撃「${raidId}」を開始できませんでした。`);
    return;
  }
  startRaidEvent(village, { raidDefinition });
  updateUI(village);
}

function applyFirstCalamity(village) {
  const targets = getActiveVillagers(village);
  targets.forEach(person => {
    person.mp = clampValue((Number(person.mp) || 0) - 10, 0, 100);
  });
  recordStage(village, 1, "第一の角笛が吹かれた", "川が血のように染まり、村人たちの心を恐怖が蝕んだ。");
  queueApocalypseModal({
    title: "第一の角笛が吹かれた",
    message: "川が血のように染まった。",
    effect: `塩の柱ではない村人${targets.length}人のメンタルが10低下しました。`,
    image: stageImage(1)
  });
}

function applySecondCalamity(village) {
  const before = Math.max(0, Number(village.food) || 0);
  const loss = Math.floor(before * 0.8);
  village.food = Math.max(0, before - loss);
  recordStage(village, 2, "第二の角笛が吹かれた", "天を覆う蝗とともに黒き騎士・飢餓が現れ、蓄えを食い尽くした。");
  queueApocalypseModal({
    title: "第二の角笛が吹かれた",
    message: "天を覆う蝗の向こうに、黒き騎士・飢餓が姿を現し、空になった倉を見届けると天へ消えた。",
    effect: `食料の8割、${loss}が失われました。`,
    image: stageImage(2)
  });
}

function applyThirdCalamity(village) {
  const candidates = getActiveBuildingIds(village).filter(id => id !== GOLDEN_STATUE_ID);
  const targets = chooseRandom(candidates, 2);
  const damagedCount = targets.reduce((count, buildingId) => {
    return count + (damageBuilding(village, buildingId) ? 1 : 0);
  }, 0);
  if (damagedCount > 0) {
    recalculateBuildingDerivedState(village);
    (village.villagers || []).forEach(person => refreshJobTable(person, village));
  }
  recordStage(village, 3, "第三の角笛が吹かれた", `硫黄の火が村へ降り注ぎ、建築物${damagedCount}基が損壊した。`);
  queueApocalypseModal({
    title: "第三の角笛が吹かれた",
    message: "裂けた空から燃える硫黄が降り注ぎ、村の建物を焼いた。",
    effect: damagedCount > 0
      ? `建築物${damagedCount}基が損壊しました。建築画面から修繕できます。`
      : "損壊する有効な建築物はありませんでした。",
    image: stageImage(3)
  });
}

function applyFourthCalamity(village) {
  const candidates = getActiveVillagers(village).filter(person => {
    return !Array.isArray(person.bodyTraits) || !person.bodyTraits.includes("疫病");
  });
  const targets = chooseRandom(candidates, 2);
  targets.forEach(person => {
    if (!Array.isArray(person.bodyTraits)) person.bodyTraits = [];
    person.bodyTraits.push("疫病");
    syncEffectiveStats(person);
    refreshJobTable(person, village);
  });
  const targetNames = targets.map(person => person.name).join("、") || "対象者なし";
  recordStage(village, 4, "第四の角笛が吹かれた", `青白き騎士・疫病が現れ、${targetNames}へ病の息を吹きかけた。`);
  queueApocalypseModal({
    title: "第四の角笛が吹かれた",
    message: "青白き騎士・疫病が村を見下ろし、病の息と咳の響きを残して天へ消えた。",
    effect: targets.length > 0
      ? `${targetNames}に身体特性「疫病」が付与されました。`
      : "疫病になる新たな村人はいませんでした。",
    image: stageImage(7)
  });
}

function getBraveSaltPillarTargets(village) {
  const candidates = getActiveVillagers(village)
    .sort((a, b) => (Number(b.cou) || 0) - (Number(a.cou) || 0));
  const poolSize = Math.min(candidates.length, Math.max(2, Math.ceil(candidates.length / 2)));
  return chooseRandom(candidates.slice(0, poolSize), 2);
}

function applyFifthCalamity(village) {
  const targets = getBraveSaltPillarTargets(village);
  targets.forEach(person => {
    if (!Array.isArray(person.bodyTraits)) person.bodyTraits = [];
    if (!person.bodyTraits.includes(SALT_PILLAR_TRAIT)) person.bodyTraits.push(SALT_PILLAR_TRAIT);
    person.saltPillarMonths = 0;
    syncEffectiveStats(person);
    refreshJobTable(person, village);
  });
  const targetNames = targets.map(person => person.name).join("、") || "対象者なし";
  recordStage(village, 5, "第五の角笛が吹かれた", `天の光が勇気ある者を射抜き、${targetNames}の身体を塩へ変えた。`);
  queueApocalypseModal({
    title: "第五の角笛が吹かれた",
    message: "天の光を振り仰いだ勇気ある者たちの身体が、白い塩へと変わった。",
    effect: targets.length > 0 ? `${targetNames}に身体特性「塩の柱」が付与されました。` : "塩の柱になる村人はいませんでした。",
    image: stageImage(4)
  });
}

function applyRaidCalamity(village, { stage, title, message, effect, raidId, image = stageImage(stage) }) {
  recordStage(village, stage, title, message);
  queueApocalypseModal({
    title,
    message,
    effect,
    image,
    onClose: () => startScriptedRaid(village, raidId)
  });
}

export function startApocalypseFromGoldenStatue(village) {
  village.apocalypseStarted = true;
  village.apocalypseStage = 0;
  village.pendingRaid = null;
  addVillageTrait(village, APOCALYPSE_TRAIT);
  village.log("【黙示録】天に怒りの声が響いた。次月から七つの災厄が村を襲う。");
  addHistoryEvent(village, {
    title: "黄金像と天の怒り",
    text: "バッカスの黄金像が建ち、天に怒りの声が響いた。次月から七つの災厄が村を襲う。",
    tags: ["バッカス", "黄金像", "黙示録"]
  });
  queueApocalypseModal({
    title: "天より響く怒り",
    message: "黄金像が完成した瞬間、晴れていた空が暗く閉ざされ、雷鳴にも似た怒りの声が天より響いた。",
    effect: "黙示録が始まりました。次月から、村へ七つの災厄が順に降りかかります。",
    image: "images/events/apocalypse/apocalypse-start.png"
  });
  updateUI(village);
}

export function processApocalypseMonthStart(village) {
  if (!isApocalypseActive(village)) return false;
  if (village.currentRaid || (Array.isArray(village.raidEnemies) && village.raidEnemies.length > 0)) return true;

  const nextStage = Math.min(7, Math.max(0, Number(village.apocalypseStage) || 0) + 1);
  switch (nextStage) {
    case 1:
      applyFirstCalamity(village);
      break;
    case 2:
      applySecondCalamity(village);
      break;
    case 3:
      applyThirdCalamity(village);
      break;
    case 4:
      applyFourthCalamity(village);
      break;
    case 5:
      applyFifthCalamity(village);
      break;
    case 6:
      applyRaidCalamity(village, {
        stage: 6,
        title: "第六の角笛が吹かれた",
        message: "赤き騎士・戦争が、地平を埋め尽くす大規模聖征軍団を率いて進軍した。",
        effect: "大規模聖征軍団と赤き騎士・戦争の襲撃が始まります。戦争のみ交換の奇跡が効きません。敗北すれば黄金像は破壊され、黙示録は終了します。",
        raidId: APOCALYPSE_RAID_IDS.SIXTH
      });
      break;
    case 7:
      applyRaidCalamity(village, {
        stage: 7,
        title: "第七の角笛が吹かれた",
        message: "白き騎士・支配が、雲を裂いて降り立つ上位翼人兵を従え、最後の裁きを告げた。",
        effect: "上位翼人兵と白き騎士・支配の襲撃が始まります。支配のみ交換の奇跡が効きません。敗北すれば黄金像は破壊され、黙示録は終了します。",
        raidId: APOCALYPSE_RAID_IDS.SEVENTH,
        image: stageImage(5)
      });
      break;
  }
  updateUI(village);
  return true;
}

function clearApocalypseRaid(village) {
  if (!Object.values(APOCALYPSE_RAID_IDS).includes(village?.currentRaid?.id)) return;
  village.currentRaid = null;
  village.raidEnemies = [];
  village.isRaidProcessDone = true;
  village.isRaidFinalizing = false;
  village.raidTurnCount = 0;
  village.currentActionIndex = 0;
  village.raidActionQueue = [];
  village.raidPhase = "";
  removeVillageTrait(village, "襲撃中");
  clearRaidWarningModal();
  (village.villagers || []).forEach(person => refreshJobTable(person, village));
  if (typeof document !== "undefined") {
    const raidOverlay = document.getElementById("raidOverlay");
    const raidModal = document.getElementById("raidModal");
    if (raidOverlay) raidOverlay.style.display = "none";
    if (raidModal) raidModal.style.display = "none";
  }
}

function removeGoldenStatueBuilding(village) {
  const buildings = Array.isArray(village.buildings) ? village.buildings : [];
  const index = buildings.indexOf(GOLDEN_STATUE_ID);
  if (index >= 0) buildings.splice(index, 1);
  village.buildings = buildings;
  village.damagedBuildings = (Array.isArray(village.damagedBuildings) ? village.damagedBuildings : [])
    .filter(id => id !== GOLDEN_STATUE_ID);
  if (!village.buildingFlags || typeof village.buildingFlags !== "object") village.buildingFlags = {};
  village.buildingFlags[GOLDEN_STATUE_BUILT_FLAG] = false;
}

export function destroyBacchusGoldenStatue(village, options = {}) {
  const wasBuilt = Array.isArray(village?.buildings) && village.buildings.includes(GOLDEN_STATUE_ID);
  if (!wasBuilt) return false;

  if (!options.skipRaidCleanup) clearApocalypseRaid(village);
  removeGoldenStatueBuilding(village);
  removeVillageTrait(village, APOCALYPSE_TRAIT);
  village.apocalypseStarted = false;
  village.apocalypseStage = 0;
  const forced = !!options.forced;
  const reason = options.reason || (forced ? "天の軍勢に敗れた" : "人々が畏れ反省した");
  village.log(`【黙示録中断】${reason}ため、バッカスの黄金像は${forced ? "打ち砕かれた" : "引き倒された"}。`);
  addHistoryEvent(village, {
    title: "黄金像の崩壊",
    text: `${reason}ため、バッカスの黄金像は${forced ? "打ち砕かれ" : "引き倒され"}、黙示録は中断された。`,
    tags: ["バッカス", "黄金像", "黙示録"]
  });
  queueApocalypseModal({
    title: forced ? "黄金像は打ち砕かれた" : "人々は黄金像を引き倒した",
    message: forced
      ? "敗北した村へ天の軍勢が雪崩れ込み、バッカスの黄金像を打ち砕いた。"
      : "畏れと悔いに突き動かされた人々は、自ら綱を掛けてバッカスの黄金像を引き倒した。",
    effect: "村特性「黙示録」が解除されました。建築解放は残るため、黄金像を再建すると第一の災厄から再開します。"
  });
  updateUI(village);
  return true;
}

function completeApocalypse(village) {
  const beforeDivineMightLevel = getDivineMightLevel(village);
  removeVillageTrait(village, APOCALYPSE_TRAIT);
  removeVillageTrait(village, "異端");
  village.apocalypseStarted = false;
  village.apocalypseStage = 0;
  village.apocalypseCleared = true;
  const restoredSaltPillars = (village.villagers || []).filter(isSaltPillar);
  restoredSaltPillars.forEach(person => {
    person.bodyTraits = person.bodyTraits.filter(trait => trait !== SALT_PILLAR_TRAIT);
    person.saltPillarMonths = 0;
    syncEffectiveStats(person);
    refreshJobTable(person, village);
  });
  refreshDivineMightLevelUnlock(village, beforeDivineMightLevel);
  village.log("【仮エンディング】黙示録の四騎士を退け、天の怒りと異端の記録は消え去った。");
  if (restoredSaltPillars.length > 0) {
    village.log(`塩の柱となっていた${restoredSaltPillars.length}人が元の姿へ戻った。`);
  }
  addHistoryEvent(village, {
    title: "四騎士の退却",
    text: "黙示録の四騎士を退け、村は七つの災厄を越えた。天の怒りと異端の記録は消え去った。",
    tags: ["黙示録", "四騎士", "仮エンディング"]
  });
  queueApocalypseModal({
    title: "七つの災厄を越えて",
    message: "四騎士は傷ついた翼を翻し、割れた天の彼方へ退いていった。村には、長い災厄の後の静寂が戻った。",
    effect: "仮エンディングに到達しました。村特性「黙示録」と「異端」、身体特性「塩の柱」が解除され、神威Lv6が解放されました。"
  });
}

export function handleApocalypseRaidResult(village, raidId, isSuccess) {
  if (!Object.values(APOCALYPSE_RAID_IDS).includes(raidId)) return false;
  if (!isSuccess) {
    destroyBacchusGoldenStatue(village, {
      forced: true,
      skipRaidCleanup: true,
      reason: "天の軍勢との戦いに敗れた"
    });
    return true;
  }
  if ((Number(village.apocalypseStage) || 0) >= 7) {
    completeApocalypse(village);
  }
  return true;
}

export function advanceSaltPillarMonths(village) {
  (village.villagers || []).forEach(person => {
    if (!isSaltPillar(person)) return;
    person.saltPillarMonths = Math.max(0, Number(person.saltPillarMonths) || 0) + 1;
    if (person.saltPillarMonths < SALT_PILLAR_DURATION_MONTHS) return;
    person.bodyTraits = person.bodyTraits.filter(trait => trait !== SALT_PILLAR_TRAIT);
    person.saltPillarMonths = 0;
    syncEffectiveStats(person);
    refreshJobTable(person, village);
    village.log(`${person.name}の塩の身体が崩れ、人の姿へ戻った。`);
  });
}
