// main.js

// (従来の import群。ここでは例示のみ)
import { runAutosave } from "./gameSettings.js";
import { Village } from "./classes.js";
import { createInitialVillagers } from "./createVillagers.js";
import { updateUI } from "./ui.js";
import { doFixedEventPost, endOfMonthProcess, doAgingProcess, runMonthStartPhase } from "./events.js";
import { applyForcedActionRestriction, refreshJobTable } from "./domain/jobTables.js";
import { handleAllVillagerJobs } from "./jobs.js";
import { recordGameStartHistory } from "./history.js";
import { isUnassignedActionVillager } from "./domain/rules.js";
import { getRaidReadiness } from "./raidRules.js";
import { hasDespairState } from "./domain/despair.js";
import { getActiveVillagers } from "./domain/apocalypseRules.js";

// Villageインスタンスを生成
export const theVillage = new Village();
theVillage.villagers = createInitialVillagers();
recordGameStartHistory(theVillage);
updateUI(theVillage);

function applyTurnStartRestrictions(village) {
  village.villagers.forEach(person => {
    const restriction = applyForcedActionRestriction(person);
    if (restriction.restricted && restriction.changed) {
      village.log(`${person.name}は${restriction.reason}のため、行動を「${restriction.action}」に設定しました`);
    }
  });
}

const TURN_BLOCKING_MODAL_SELECTORS = [
  "#actionPhaseModal",
  "#randomEventModal",
  "#festivalModal",
  "#seasonChangeDialog",
  "#raidWarningModal",
  "#buildingRequestModal",
  "#buildingRequestCompleteModal",
  "#wishModal",
  "#wishCompleteModal",
  "#heresyInquisitionModal",
  "#inquisitionHospitalityResultModal",
  "#inquisitionExpulsionResultModal",
  "#bacchusGoldenStatueEventModal",
  "#apocalypseStartModal",
  "#apocalypseEventModal",
  "#secretTreasureEventModal",
  "#adventurerQuestModal",
  "#adventurerQuestResultModal",
  ".effect-result-modal",
  "#recruitmentModal",
  "#seductionModal",
  "#merchantTradeModal",
  "#miracleModal",
  "#buildingModal",
  "#secretTreasureModal",
  "#historyModal",
  "#personalHistoryModal",
  "#friendshipDetailModal",
  "#conversationModal",
  "#exchangeModal",
  "#panFluteExchangeModal",
  "#raidModal",
  "#villageScaleModal",
  "#divineMightLevelUpModal",
  "#headmanElectionModal",
  "[data-close-relationship-modal]",
  "[data-close-reproduction-modal]"
];

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

function isTurnBlockingModalOpen() {
  if (typeof document === "undefined") return false;
  return TURN_BLOCKING_MODAL_SELECTORS.some(selector => {
    const element = document.querySelector(selector);
    return isVisibleElement(element);
  });
}

function formatPersonNamesForConfirm(people) {
  const visibleNames = people.slice(0, 5).map(person => person.name).join("、");
  return people.length > 5 ? `${visibleNames} ほか${people.length - 5}人` : visibleNames;
}

function confirmDespairingVillagersBeforeTurn(village) {
  const despairingVillagers = getActiveVillagers(village).filter(hasDespairState);
  if (despairingVillagers.length === 0 || typeof window === "undefined") return true;

  const names = formatPersonNamesForConfirm(despairingVillagers);
  return window.confirm(`絶望している村人がいます。\n${names}\n解除しないまま次の月を迎えると村を去ります。\nこのまま月を進めますか？`);
}

/**
 * 「次の月へ」ボタン
 */
export function onNextTurn() {
  if (isTurnBlockingModalOpen()) return;

  if (theVillage.gameOver) {
    theVillage.log("ゲームオーバー済みです。操作不可");
    return;
  }
  if (theVillage.isRaidFinalizing) {
    theVillage.log("迎撃結果を処理中です。");
    return;
  }
  // もし襲撃中かつ未完了なら先に迎撃モーダル
  if (theVillage.villageTraits.includes("襲撃中") && !theVillage.isRaidProcessDone) {
    theVillage.villagers.forEach(person => refreshJobTable(person, theVillage));
    const raidReadiness = getRaidReadiness(theVillage);
    if (raidReadiness.combatants.length === 0 && typeof window !== "undefined") {
      const message = raidReadiness.trapMakers.length > 0
        ? `戦闘に残る村人がいません。\n罠作成だけでは敵を倒しきれない場合、防衛失敗になります。\nこのまま防衛を開始しますか？`
        : `戦闘に残る村人がいません。\nこのまま開始すると防衛失敗になります。\nこのまま防衛を開始しますか？`;
      if (!window.confirm(message)) return;
    }
    import("./raid.js").then(m=>{
      m.openRaidModal(theVillage);
    });
    return;
  }

  if (!confirmDespairingVillagersBeforeTurn(theVillage)) return;

  applyTurnStartRestrictions(theVillage);

  const noActionVillagers = theVillage.villagers.filter(isUnassignedActionVillager);
  if (noActionVillagers.length > 0 && typeof window !== "undefined") {
    const names = noActionVillagers.map(person => person.name).join("、");
    const ok = window.confirm(`行動が未設定の村人がいます。\n${names}\nこのまま月を進めますか？`);
    if (!ok) return;
  }

  // 通常ターン進行
  handleAllVillagerJobs(theVillage);
  doFixedEventPost(theVillage);
  endOfMonthProcess(theVillage);

  if (theVillage.villagers.length===0) {
    theVillage.log("村人ゼロ→バッカスは眠りに...(GameOver)");
    theVillage.gameOver=true;
    updateUI(theVillage);
    return;
  }
  theVillage.month++;
  if (theVillage.month>12) {
    theVillage.month=1;
    theVillage.year++;
  }
  theVillage.hasDonePreEvent=false;
  theVillage.hasDonePostEvent=false;
  theVillage.log(`=== ${theVillage.year}年${theVillage.month}月 ===`);

  if (theVillage.month===1) {
    doAgingProcess(theVillage);
  }
  runMonthStartPhase(theVillage);

  updateUI(theVillage);
  runAutosave(theVillage);
}
