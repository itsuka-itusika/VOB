// events.js

import { randInt, clampValue, round3, getVillagerFoodConsumption, getVillagerWinterMaterialConsumption } from "./util.js";
import { doLoverCheck, doMarriageCheck, clearRelationshipsForDepartedVillager, processMonthlyFriendship } from "./relationships.js";
import { createRandomVillager, createRandomVisitor } from "./createVillagers.js";
import { processRaidScheduleAtMonthStart } from "./raidSchedule.js";
import { RandomEvents } from "./RandomEvents.js";
import { recordCriticalHistory, recordVillagerDeathHistory, recordVillagerLeaveHistory } from "./history.js";
import {
  handleBirthAndPostpartum,
  handlePendingMysticPregnancies,
  handlePregnancyChecks,
  updateChildGrowthStage
} from "./reproduction.js";
import { runAfterFestivalModals, showFestivalModal, showPineconeStaffIntroModal } from "./festivalModal.js";
import { runHeadmanElectionIfDue } from "./headmanElection.js";
import { grantSecretTreasure, PINECONE_STAFF_SECRET_TREASURE_ID } from "./secretTreasures.js";
import {
  ACTION_CRADLE,
  ACTION_HEAL,
  ACTION_LAST_MOMENTS,
  ACTION_NONE,
  ACTION_REST,
  ACTION_LEISURE,
  isTemporaryAction,
  refreshJobTable,
  setPreferredAction,
  applyForcedActionRestriction
} from "./domain/jobTables.js";
import { addStoredResource } from "./domain/resourceLimits.js";
import { hasActiveBuildingFlag } from "./domain/buildingState.js";
import { syncEffectiveStats } from "./domain/statLayers.js";
import { getBalanceSimulationOptions } from "./balance/simulationOptions.js";
import { isWolf, OLD_WOLF_TRAIT, syncWolfSpeciesTraits } from "./domain/speciesTraits.js";
import {
  addDisappointmentState,
  clearDisappointmentIfHappinessRecovered,
  hasDespairState,
  hasHopeLossState,
  promoteDisappointmentToDespair
} from "./domain/despair.js";
import { getVisitorArrivalLine } from "./data/dialogue/visitorLines.js";
import { addDivineMight, getDivineMightGainFromMonthlyMana, runAfterPendingDivineMightLevelUp } from "./divineMight.js";
import { BUILDINGS } from "./buildings.js";
import { advanceBuildingRequestMonth, tryStartBuildingRequest } from "./buildingRequests.js";
import { advanceWishMonth, tryStartWish } from "./wishes.js";
import { tryTriggerHeresyInquisition } from "./heresyInquisition.js";
import { tryTriggerBacchusGoldenStatueEvent } from "./bacchusGoldenStatue.js";
import { advanceApocalypseLocustMonths, advanceSaltPillarMonths, processApocalypseMonthStart } from "./apocalypse.js";
import { getActiveVillagers, isSaltPillar } from "./domain/apocalypseRules.js";
import {
  clearCaptiveFailedTraits,
  getCaptives,
  getPeopleForFoodAndWinterMaterials,
  processCaptiveActionRecovery,
  processCaptiveReleaseDeadlines
} from "./captives.js";
import { processAdventurerQuestReturns, showAdventurerQuestResultModals } from "./adventurerQuests.js";

const OPENING_RAID_GRACE_YEAR = 1195;
const OPENING_RAID_GRACE_LAST_MONTH = 6;
const NO_AGING_BODY_TRAITS = new Set(["光輪", "不老", "光合成"]);

const TRAIT_INJURED = "負傷";
const TRAIT_SERIOUS_INJURY = "重体";
const TRAIT_CRITICAL = "危篤";
const TRAIT_EPIDEMIC = "疫病";
const TRAIT_EXPOSURE = "曝露";
const VILLAGE_TRAIT_CLEANLINESS = "清浄";
const CLEANLINESS_DURATION_MONTHS = 3;
const BATTLE_DEBUG_BODY_TRAITS_TO_REMOVE = new Set([
  "負傷", "重体", "危篤", "疲労", "過労", "飢餓", "凍え", "疫病", "曝露", "産褥"
]);
const BATTLE_DEBUG_MIND_TRAITS_TO_REMOVE = new Set([
  "心労", "抑鬱", "失望", "絶望", "狂乱"
]);

function recoverBattleDebugVillagers(village) {
  if (!village.battleDebugMode) return;

  village.villagers.forEach(person => {
    const hadPostpartum = Array.isArray(person.bodyTraits) && person.bodyTraits.includes("産褥");
    person.bodyTraits = Array.isArray(person.bodyTraits)
      ? person.bodyTraits.filter(trait => !BATTLE_DEBUG_BODY_TRAITS_TO_REMOVE.has(trait))
      : [];
    person.mindTraits = Array.isArray(person.mindTraits)
      ? person.mindTraits.filter(trait => !BATTLE_DEBUG_MIND_TRAITS_TO_REMOVE.has(trait))
      : [];
    if (hadPostpartum) person.postpartumMonths = 0;
    person.hp = 100;
    person.mp = 100;
    syncEffectiveStats(person);
    refreshJobTable(person, village);
  });

  village.log("【デバッグ】全村人の状態・体力・メンタルが全回復しました");
}

function processSeriousInjuryMonthStart(village) {
  const isClean = Array.isArray(village.villageTraits) && village.villageTraits.includes(VILLAGE_TRAIT_CLEANLINESS);
  getPeopleForFoodAndWinterMaterials(village).forEach(person => {
    if (isSaltPillar(person)) return;
    if (!Array.isArray(person.bodyTraits)) person.bodyTraits = [];
    if (!person.bodyTraits.includes(TRAIT_SERIOUS_INJURY)) return;

    person.bodyTraits = person.bodyTraits.filter(trait => trait !== TRAIT_SERIOUS_INJURY);
    if (isClean || Math.random() < 0.8) {
      if (!person.bodyTraits.includes(TRAIT_INJURED)) {
        person.bodyTraits.push(TRAIT_INJURED);
      }
      village.log(`${person.name}の重体は負傷まで回復した`);
    } else {
      if (!person.bodyTraits.includes(TRAIT_CRITICAL)) {
        person.bodyTraits.push(TRAIT_CRITICAL);
        person.criticalCause = TRAIT_SERIOUS_INJURY;
        recordCriticalHistory(village, person, { reason: "重体" });
      }
      village.log(`${person.name}の重体が悪化し、危篤状態になった...`);
    }
    syncEffectiveStats(person);
    refreshJobTable(person, village);
  });
}

function processExposureMonthStart(village) {
  getPeopleForFoodAndWinterMaterials(village).forEach(person => {
    if (isSaltPillar(person)) return;
    if (!Array.isArray(person.bodyTraits) || !person.bodyTraits.includes(TRAIT_EXPOSURE)) return;

    person.bodyTraits = person.bodyTraits.filter(trait => trait !== TRAIT_EXPOSURE);
    if (!person.bodyTraits.includes(TRAIT_CRITICAL)) {
      person.bodyTraits.push(TRAIT_CRITICAL);
    }
    person.criticalCause = TRAIT_EXPOSURE;
    recordCriticalHistory(village, person, { reason: "光の柱への曝露" });
    syncEffectiveStats(person);
    refreshJobTable(person, village);
    village.log(`${person.name}は光の柱への曝露のため、危篤状態になった...`);
  });
}

function processPendingEpidemicInfections(village) {
  const isClean = Array.isArray(village.villageTraits) && village.villageTraits.includes(VILLAGE_TRAIT_CLEANLINESS);
  (village.villagers || []).forEach(person => {
    if (!person.pendingEpidemicInfection) return;
    person.pendingEpidemicInfection = false;
    if (isClean) return;

    if (!Array.isArray(person.bodyTraits)) person.bodyTraits = [];
    if (!person.bodyTraits.includes(TRAIT_EPIDEMIC)) {
      person.bodyTraits.push(TRAIT_EPIDEMIC);
      syncEffectiveStats(person);
      refreshJobTable(person, village);
      village.log(`${person.name}は疫病に感染した`);
    }
  });
}

function processEpidemicSpreadAtMonthEnd(village) {
  if (!Array.isArray(village.villagers) || village.villagers.length === 0) return;
  if (village.villageTraits.includes(VILLAGE_TRAIT_CLEANLINESS)) return;

  const epidemicCount = village.villagers.filter(person => {
    return Array.isArray(person.bodyTraits) && person.bodyTraits.includes(TRAIT_EPIDEMIC);
  }).length;
  if (epidemicCount === 0) return;

  const candidates = village.villagers.filter(person => {
    const bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
    return !bodyTraits.includes(TRAIT_EPIDEMIC) && !person.pendingEpidemicInfection;
  });
  const infectionCount = Math.min(candidates.length, randInt(0, epidemicCount * 2));
  for (let i = 0; i < infectionCount; i++) {
    const selectedIndex = randInt(0, candidates.length - 1);
    const [person] = candidates.splice(selectedIndex, 1);
    person.pendingEpidemicInfection = true;
  }
}

function advanceCleanlinessMonth(village) {
  if (!village.villageTraits.includes(VILLAGE_TRAIT_CLEANLINESS)) {
    village.cleanlinessMonths = null;
    return;
  }

  village.cleanlinessMonths = Math.max(0, Number(village.cleanlinessMonths) || 0) + 1;
  if (village.cleanlinessMonths < CLEANLINESS_DURATION_MONTHS) return;

  village.villageTraits = village.villageTraits.filter(trait => trait !== VILLAGE_TRAIT_CLEANLINESS);
  village.cleanlinessMonths = null;
  village.log("【清拭の奇跡終了】村の清浄効果が切れました");
}

function resetMonthlySocialAttemptFlags(village) {
  (village.villagers || []).forEach(person => {
    person.socialAttemptedThisMonth = false;
  });
  clearCaptiveFailedTraits(village);
}

function applySecurityBaselineDecay(village) {
  const villagers = getActiveVillagers(village);
  const averageEthics = villagers.length > 0
    ? villagers.reduce((sum, person) => sum + (Number(person.eth) || 0), 0) / villagers.length
    : 0;
  const baselineSecurity = round3(averageEthics * 3 + 5);
  const currentSecurity = Math.round(Number(village.security) || 0);
  if (currentSecurity <= baselineSecurity) return;

  const rawSecurityLoss = (currentSecurity - baselineSecurity) / 5;
  if (rawSecurityLoss < 1) return;

  const securityLoss = Math.round(rawSecurityLoss);
  const nextSecurity = clampValue(currentSecurity - securityLoss, 0, 100);
  const actualLoss = currentSecurity - nextSecurity;

  village.security = nextSecurity;
  village.log(`治安自然低下: 基礎値${baselineSecurity}を上回ったため治安-${actualLoss}`);
}

function removeResidentOrCaptive(village, person) {
  const villagerIndex = village.villagers.indexOf(person);
  if (villagerIndex !== -1) {
    village.villagers.splice(villagerIndex, 1);
    return true;
  }

  const captives = getCaptives(village);
  const captiveIndex = captives.indexOf(person);
  if (captiveIndex !== -1) {
    captives.splice(captiveIndex, 1);
    return true;
  }

  return false;
}

/**
 * 固定イベント(前半) - 新年祭など
 */
export function doFixedEventPre(village) {
  if (!village.hasDonePreEvent) {
    switch(village.month) {
      case 1:
        newYearFestival(village);
        village.hasDonePreEvent = true;
        break;
    }
  }
}

/**
 * 固定イベント(後半) - 復活祭,夏至祭,収穫祭,星霜祭など
 */
export function doFixedEventPost(village) {
  if (!village.hasDonePostEvent) {
    switch(village.month) {
      case 3:
        resurrectionFestival(village);
        village.hasDonePostEvent=true;
        break;
      case 6:
        summerSolsticeFestival(village);
        village.hasDonePostEvent=true;
        break;
      case 10:
        harvestFestival(village);
        village.hasDonePostEvent=true;
        break;
      case 12:
        starsFestival(village);
        village.hasDonePostEvent=true;
        break;
    }
  }
}

// -------------------------
// 各祭り
// -------------------------
function newYearFestival(v) {
  showFestivalModal("newYear");
  v.log("【新年祭】体力+20,メンタル+20,幸福+20-30 全員");
  getActiveVillagers(v).forEach(p=>{
    p.hp=clampValue(p.hp+20,0,100);
    p.mp=clampValue(p.mp+20,0,100);
    let inc=randInt(20,30);
    p.happiness=clampValue(p.happiness+inc,0,100);
  });
}

function resurrectionFestival(v) {
  showFestivalModal("resurrection");
  v.log("【復活祭】体力+20,メンタル+20");
  getActiveVillagers(v).forEach(p=>{
    p.hp=clampValue(p.hp+20,0,100);
    p.mp=clampValue(p.mp+20,0,100);
  });
}

function summerSolsticeFestival(v) {
  showFestivalModal("summerSolstice");
  v.log("【夏至祭】体力+20,メンタル+20 +結婚判定");
  getActiveVillagers(v).forEach(p=>{
    p.hp=clampValue(p.hp+20,0,100);
    p.mp=clampValue(p.mp+20,0,100);
  });
  doMarriageCheck(v);
}

function harvestFestival(v) {
  const treasure = grantSecretTreasure(v, PINECONE_STAFF_SECRET_TREASURE_ID);
  showFestivalModal("harvest");
  if (treasure) {
    runAfterFestivalModals(showPineconeStaffIntroModal);
  }
  v.log(`【収穫祭】全員体力+30,メンタル+10${treasure ? `,${treasure.name}+1` : ""}`);
  getActiveVillagers(v).forEach(p=>{
    p.hp=clampValue(p.hp+30,0,100);
    p.mp=clampValue(p.mp+10,0,100);
  });
}

function starsFestival(v) {
  showFestivalModal("stars");
  v.log("【星霜祭】恋人判定");
  doLoverCheck(v, { source: "星霜祭" });
}

// -------------------------
// ランダムイベント
// -------------------------
export function doRandomEventPre(village) {
  RandomEvents.execute(village, "前", { chanceMultiplier: 1.6 });
}
export function doRandomEventPost(village) {
  // 後ランダムイベントは廃止。ランダムイベントは行動前のみ発生する。
}

export function doRaidStartCheck(village, options = {}) {
  if (!options.skipDivineMightDelay && runAfterPendingDivineMightLevelUp(village, () => {
    doRaidStartCheck(village, { skipDivineMightDelay: true });
  })) {
    return;
  }

  processRaidScheduleAtMonthStart(village, {
    suspendReservation: isOpeningRaidGraceActive(village)
  });
}

function isOpeningRaidGraceActive(village) {
  return Number(village.year) === OPENING_RAID_GRACE_YEAR
    && Number(village.month) <= OPENING_RAID_GRACE_LAST_MONTH;
}

function applyMonthStartRestrictions(village) {
  village.villagers.forEach(person => {
    const restriction = applyForcedActionRestriction(person);
    if (restriction.restricted && restriction.changed) {
      village.log(`${person.name}は${restriction.reason}のため、行動を「${restriction.action}」に設定しました`);
    }
  });
}

function restoreRecoveredForcedActions(village) {
  village.villagers.forEach(person => {
    const previousAction = String(person.action || ACTION_NONE).trim() || ACTION_NONE;
    if (previousAction !== ACTION_HEAL && previousAction !== ACTION_LAST_MOMENTS) return;

    const restriction = applyForcedActionRestriction(person);
    if (restriction.restricted) return;

    refreshJobTable(person, village);
    const preferred = String(person.preferredAction || person.job || ACTION_NONE).trim() || ACTION_NONE;
    person.action = preferred !== ACTION_NONE && person.actionTable.includes(preferred)
      ? preferred
      : ACTION_NONE;
  });
}

export function runMonthStartPhase(village) {
  const simulationOptions = getBalanceSimulationOptions(village);
  advanceSaltPillarMonths(village);
  advanceApocalypseLocustMonths(village);
  const monthStartSeason = [3,6,9,12].includes(village.month)
    ? updateSeason(village, { showDialog: false, logChange: false })
    : "";
  doMonthStartProcess(village, simulationOptions);
  if (village.gameOver) return;
  if (monthStartSeason) {
    showSeasonChangeDialog(monthStartSeason);
    village.log(`${monthStartSeason}が訪れた`);
  }
  doFixedEventPre(village);
  handleBirthAndPostpartum(village);
  handlePendingMysticPregnancies(village);
  restoreRecoveredForcedActions(village);
  const apocalypseActive = processApocalypseMonthStart(village);
  if (!apocalypseActive && !simulationOptions.suppressRandomEvents) doRandomEventPre(village);
  if (!simulationOptions.suppressBuildingRequests) tryStartBuildingRequest(village, BUILDINGS);
  tryStartWish(village);
  applyMonthStartRestrictions(village);
  runHeadmanElectionIfDue(village);
  tryTriggerHeresyInquisition(village);
  if (!apocalypseActive && !simulationOptions.suppressRaids) doRaidStartCheck(village);
  tryTriggerBacchusGoldenStatueEvent(village);
  showAdventurerQuestResultModals(village.pendingAdventurerQuestReports);
  village.pendingAdventurerQuestReports = [];
}

function getVisitorLimit(village) {
  const baseLimit = hasActiveBuildingFlag(village, "hasTavern", "tavern") ? 2 : 1;
  const prosperityBonus = (Number(village.building) || 0) >= 250 ? 1 : 0;
  return Math.max(1, baseLimit + prosperityBonus);
}

function getPublicBathMonthlyRecovery(person, village) {
  const flags = village.buildingFlags || {};
  if (!hasActiveBuildingFlag(village, "hasPublicBath", "publicBath")) return 0;
  if (isPublicBathRecoveryBlocked(person)) return 0;
  const traitBonus = Array.isArray(person.mindTraits) && person.mindTraits.includes("風呂好き") ? 2 : 0;
  return 5 + (Number(flags.publicBathRecoveryBonus) || 0) + traitBonus;
}

function isPublicBathRecoveryBlocked(person) {
  const bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  return bodyTraits.includes("過労") || mindTraits.includes("抑鬱");
}

function applyPublicBathMonthlyRecovery(village) {
  if (!hasActiveBuildingFlag(village, "hasPublicBath", "publicBath")) return;

  const baseRecovery = 5 + (Number(village.buildingFlags?.publicBathRecoveryBonus) || 0);
  let bathLoverCount = 0;
  let recoveredCount = 0;
  let blockedCount = 0;
  village.villagers.forEach(person => {
    if (isSaltPillar(person)) return;
    if (isPublicBathRecoveryBlocked(person)) {
      blockedCount++;
      return;
    }
    const recovery = getPublicBathMonthlyRecovery(person, village);
    if (recovery > baseRecovery) bathLoverCount++;
    recoveredCount++;
    person.hp = clampValue(person.hp + recovery, 0, 100);
    person.mp = clampValue(person.mp + recovery, 0, 100);
  });

  if (recoveredCount === 0) {
    village.log("公衆浴場:回復対象者なし（過労・抑鬱は対象外）");
    return;
  }
  const bathLoverText = bathLoverCount > 0 ? `、風呂好き${bathLoverCount}人はさらに+2` : "";
  const blockedText = blockedCount > 0 ? `、過労・抑鬱${blockedCount}人は回復なし` : "";
  village.log(`公衆浴場:${recoveredCount}人体力/メンタル+${baseRecovery}${bathLoverText}${blockedText}`);
}

function hasWatermill(village) {
  return hasActiveBuildingFlag(village, "hasWatermill", "watermill");
}

function applyWatermillMonthlyFood(village) {
  if (!hasWatermill(village)) return;
  addStoredResource(village, "food", 10);
  village.log("水車小屋:食料+10");
}

function hasFountain(village) {
  return hasActiveBuildingFlag(village, "hasFountain", "fountain");
}

function applyFountainMonthlyHappiness(village) {
  if (!hasFountain(village)) return;
  let affectedCount = 0;
  let blockedCount = 0;
  village.villagers.forEach(person => {
    if (isSaltPillar(person)) return;
    if (hasHopeLossState(person)) {
      blockedCount++;
      return;
    }
    const gain = randInt(1, 2);
    person.happiness = clampValue(person.happiness + gain, 0, 100);
    affectedCount++;
  });
  if (affectedCount === 0 && blockedCount > 0) {
    village.log(`噴水:失望・絶望${blockedCount}人は効果なし`);
    return;
  }
  const blockedText = blockedCount > 0 ? `、失望・絶望${blockedCount}人は効果なし` : "";
  village.log(`噴水:対象者幸福度+1〜2${blockedText}`);
}

function leaveVillageByDespair(village, person) {
  recordVillagerLeaveHistory(village, person, { source: "絶望" });
  village.log(`${person.name}は絶望のまま村を去りました`);
  const index = village.villagers.indexOf(person);
  if (index >= 0) {
    clearRelationshipsForDepartedVillager(village, person);
    village.villagers.splice(index, 1);
  }
}

function processHopeLossAtMonthStart(village) {
  const leavingPeople = [];

  village.villagers.forEach(person => {
    if (isSaltPillar(person)) return;
    person.mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];

    if (hasDespairState(person)) {
      leavingPeople.push(person);
      return;
    }

    const recovered = clearDisappointmentIfHappinessRecovered(person);
    if (recovered.length > 0) {
      syncEffectiveStats(person);
      refreshJobTable(person, village);
      village.log(`${person.name}の失望が和らいだ`);
      return;
    }

    if ((Number(person.happiness) || 0) > 0) return;

    if (promoteDisappointmentToDespair(person)) {
      syncEffectiveStats(person);
      refreshJobTable(person, village);
      village.log(`${person.name}は絶望した`);
      return;
    }

    if (addDisappointmentState(person)) {
      syncEffectiveStats(person);
      refreshJobTable(person, village);
      village.log(`${person.name}は失望した`);
    }
  });

  leavingPeople.forEach(person => leaveVillageByDespair(village, person));
  if (village.villagers.length === 0) {
    village.log("村人ゼロ→バッカスは眠りに...(GameOver)");
    village.gameOver = true;
  }
}

// -------------------------
// 月末処理
// -------------------------
export function endOfMonthProcess(v) {
  v.log("【月末処理】");
  processCaptiveActionRecovery(v);
  advanceBuildingRequestMonth(v);

  // 治安31以上で荒廃状態解除
  if (v.security > 30) {
    let index = v.villageTraits.indexOf("荒廃");
    if (index !== -1) {
      v.villageTraits.splice(index, 1);
      v.log("治安が回復し、村の荒廃状態が解消された");
    }
  }

  let totalF=0;
  let totalMat=0;
  let isWinter = v.villageTraits.includes("冬");

  getPeopleForFoodAndWinterMaterials(v).forEach(p=>{
    if (isSaltPillar(p)) return;
    totalF += getVillagerFoodConsumption(p);

    if (isWinter) {
      totalMat += getVillagerWinterMaterialConsumption(p);
      if (Array.isArray(p.bodyTraits) && p.bodyTraits.includes("光合成")) {
        p.hp = clampValue((Number(p.hp) || 0) - 10, 0, 100);
        v.log(`${p.name}は冬の光不足で体力-10`);
      }
    }
  });
  v.food=clampValue(v.food - totalF,0,99999);
  v.materials=clampValue(v.materials - totalMat,0,99999);

  if (totalF>0) v.log(`食料-${totalF}`);
  if (totalMat>0) v.log(`資材-${totalMat}`);

  applySecurityBaselineDecay(v);
  processMonthlyFriendship(v);

  let removeList=["豊穣","訪問者","襲撃者","ミダス"];
  // "襲撃中" はここでは消さない(raid.js 内で完了時に消す)
  v.villageTraits = v.villageTraits.filter(tr=> !removeList.includes(tr));

  recoverBattleDebugVillagers(v);

  // 危篤者の死亡処理（危篤者は必ず死亡）
  let deadPeople = getPeopleForFoodAndWinterMaterials(v).filter(p => !isSaltPillar(p) && p.bodyTraits.includes("危篤"));
  deadPeople.forEach(p => {
    if (removeResidentOrCaptive(v, p)) {
      const deathReason = p.criticalCause === TRAIT_SERIOUS_INJURY
        ? "重体の悪化"
        : p.criticalCause === TRAIT_EXPOSURE
          ? "光の柱への曝露"
          : "老衰";
      recordVillagerDeathHistory(v, p, { reason: deathReason });
      clearRelationshipsForDepartedVillager(v, p);
      v.log(`${p.name}は${deathReason}により死亡した...`);
    }
  });

  handlePregnancyChecks(v);

  // 狂乱・酩酊の解除処理
  getPeopleForFoodAndWinterMaterials(v).forEach(p => {
    if (isSaltPillar(p)) return;
    if (p.mindTraits.includes("狂乱")) {
      p.mindTraits = p.mindTraits.filter(t => t !== "狂乱");
      syncEffectiveStats(p);
      v.log(`${p.name}の狂乱が解除された`);
    }
    if (p.mindTraits.includes("酩酊")) {
      p.mindTraits = p.mindTraits.filter(t => t !== "酩酊");
      syncEffectiveStats(p);
      v.log(`${p.name}の酩酊が解除された`);
    }
  });

  // 火星の加護の効果期間更新 (3ヶ月経過した場合、効果を終了)
  v.villagers.forEach(p => {
    if (isSaltPillar(p)) return;
    p.bodyTraits = Array.isArray(p.bodyTraits) ? p.bodyTraits : [];
    p.mindTraits = Array.isArray(p.mindTraits) ? p.mindTraits : [];
    if (p.bodyTraits.includes("火星の加護") || p.mindTraits.includes("火星の加護")) {
      p.bodyTraits = p.bodyTraits.filter(trait => trait !== "火星の加護");
      if (!p.mindTraits.includes("火星の加護")) {
        p.mindTraits.push("火星の加護");
      }
      if (typeof p.ares !== 'number') {
         p.ares = 0;
      }
      p.ares++;
      if (p.ares >= 3) {
         p.mindTraits = p.mindTraits.filter(trait => trait !== "火星の加護");
         p.ares = 0;
         syncEffectiveStats(p);
         refreshJobTable(p, v);
         v.log(`【戦神の奇跡終了】${p.name}の火星の加護効果が切れました`);
      } else {
         syncEffectiveStats(p);
         refreshJobTable(p, v);
      }
    }
  });

  // ニケの効果期間更新 (1ヶ月経過した場合、効果を終了)
  v.villagers.forEach(p => {
    if (isSaltPillar(p)) return;
    if (p.mindTraits.includes("ニケ")) {
      if (typeof p.nikeMonths !== "number") {
        p.nikeMonths = 0;
      }
      p.nikeMonths++;
      if (p.nikeMonths >= 1) {
        p.mindTraits = p.mindTraits.filter(trait => trait !== "ニケ");
        p.nikeMonths = 0;
        syncEffectiveStats(p);
        v.log(`【ニケ終了】${p.name}のニケ効果が切れました`);
      }
    }
  });

  // 肖像の効果期間更新 (1ヶ月経過した場合、効果を終了)
  v.villagers.forEach(p => {
    if (isSaltPillar(p)) return;
    if (p.mindTraits.includes("肖像")) {
      if (typeof p.portraitMonths !== "number") {
        p.portraitMonths = 0;
      }
      p.portraitMonths++;
      if (p.portraitMonths >= 1) {
        p.mindTraits = p.mindTraits.filter(trait => trait !== "肖像");
        p.portraitMonths = 0;
        p.portraitEthLoss = 0;
        syncEffectiveStats(p);
        refreshJobTable(p, v);
        v.log(`【肖像終了】${p.name}の肖像効果が切れました`);
      }
    }
  });

  processEpidemicSpreadAtMonthEnd(v);
  advanceCleanlinessMonth(v);

  // 状態異常の解除処理
  v.villagers.forEach(p => {
    if (isSaltPillar(p)) return;
    let changed = false;
    let bodyTraitsToRemove = ["飢餓", "凍え", "疲労", "過労", "疫病"];
    bodyTraitsToRemove.forEach(trait => {
      if (p.bodyTraits.includes(trait)) {
        p.bodyTraits = p.bodyTraits.filter(t => t !== trait);
        changed = true;
      }
    });

    let mindTraitsToRemove = ["心労", "抑鬱"];
    mindTraitsToRemove.forEach(trait => {
      if (p.mindTraits.includes(trait)) {
        p.mindTraits = p.mindTraits.filter(t => t !== trait);
        changed = true;
      }
    });

    if (changed) syncEffectiveStats(p);
  });

  advanceWishMonth(v);

  // ログ出力を元に戻す処理を削除
  // v.log = originalLog;

  // 月末サマリーモーダルを表示する処理を削除
  // showMonthEndSummary(monthEndLogs);
}

/**
 * 月初処理
 *  - 魔素増加(幸福度ベース)
 *  - 食料/資材0時のペナルティ
 *  - 幸福度調整
 *  - 訪問者生成
 *  - 行動テーブル再構築
 */
export function doMonthStartProcess(v, simulationOptions = {}) {
  v.log("【月初処理】");
  resetMonthlySocialAttemptFlags(v);
  processCaptiveReleaseDeadlines(v);
  processPendingEpidemicInfections(v);
  processSeriousInjuryMonthStart(v);
  processExposureMonthStart(v);

  // 治安30以下で荒廃状態に
  if (v.security <= 30 && !v.villageTraits.includes("荒廃")) {
    v.villageTraits.push("荒廃");
    v.log("治安悪化により村が荒廃状態になった！");
  }

  // 老人・老狼の危篤化判定（5%）
  getPeopleForFoodAndWinterMaterials(v).forEach(p => {
    if (isSaltPillar(p)) return;
    if ((p.bodyTraits.includes("老人") || p.bodyTraits.includes(OLD_WOLF_TRAIT)) && !p.bodyTraits.includes("危篤")) {
      if (Math.random() < 0.05) {  // 5%の確率
        p.bodyTraits.push("危篤");
        p.criticalCause = "老衰";
        recordCriticalHistory(v, p, { reason: "老衰" });
        v.log(`${p.name}は老衰により危篤状態になった...`);
      }
    }
  });

  // 幸福度由来の魔素増加
  let tot=0;
  getActiveVillagers(v).forEach(p=>{
    let amt=6*(p.happiness/100);
    tot+=amt;
  });
  let gain=Math.floor(tot);
  v.mana=clampValue(v.mana+gain,0,99999);
  v.log(`魔素+${gain}(村人幸福度由来)`);
  const divineGain = getDivineMightGainFromMonthlyMana(gain);
  if (divineGain > 0) {
    addDivineMight(v, divineGain);
    v.log(`神威+${divineGain}(幸福度由来魔素)`);
  }

  // 食料/資材0のペナルティ
  if (v.food<=0) {
    v.log("食料0→飢餓発生");
    getPeopleForFoodAndWinterMaterials(v).forEach(p=>{
      if (isSaltPillar(p)) return;
      if (Array.isArray(p.bodyTraits) && p.bodyTraits.includes("光合成")) {
        v.log(`${p.name}は光合成により飢餓を免れた`);
        return;
      }
      // 飢餓の身体特性を付与（まだ持っていない場合のみ）
      if (!p.bodyTraits.includes("飢餓")) {
        p.bodyTraits.push("飢餓");
      }

      // 各種ステータスにペナルティ
      syncEffectiveStats(p);
      p.hp = Math.floor(p.hp * 0.5);  // 体力を50%に
      p.mp = Math.floor(p.mp * 0.5);  // メンタルを50%に
      p.happiness = clampValue(p.happiness - 30, 0, 100);  // 幸福度-30
    });
  }
  if (v.villageTraits.includes("冬") && v.materials<=0) {
    v.log("冬なのに資材0→凍え");
    getPeopleForFoodAndWinterMaterials(v).forEach(p=>{
      if (isSaltPillar(p)) return;
      if (isWolf(p)) {
        v.log(`${p.name}は狼の耐寒性で凍えを免れた`);
        return;
      }

      // 凍えの身体特性を付与（まだ持っていない場合のみ）
      if (!p.bodyTraits.includes("凍え")) {
        p.bodyTraits.push("凍え");
      }

      // 各種ステータスにペナルティ
      syncEffectiveStats(p);
      p.hp = Math.floor(p.hp * 0.5);  // 体力を50%に
      p.mp = Math.floor(p.mp * 0.5);  // メンタルを50%に
      p.happiness = clampValue(p.happiness - 30, 0, 100);  // 幸福度-30
    });
  }

  // 体力・メンタル状態によるペナルティ
  v.villagers.forEach(p => {
    if (isSaltPillar(p)) return;
    // 体力に関するペナルティ
    if (p.hp <= 0) {
      // 過労状態
      if (!p.bodyTraits.includes("過労")) {
        p.bodyTraits.push("過労");
      }
      syncEffectiveStats(p);
      p.happiness = clampValue(p.happiness - 30, 0, 100);


      v.log(`${p.name}は過労状態になった`);
    } else if (p.hp <= 33) {
      // 疲労状態
      if (!p.bodyTraits.includes("疲労")) {
        p.bodyTraits.push("疲労");
      }
      syncEffectiveStats(p);
      v.log(`${p.name}は疲労状態になった`);
    }

    // メンタルに関するペナルティ
    if (p.mp <= 0) {
      // 抑鬱状態
      if (!p.mindTraits.includes("抑鬱")) {
        p.mindTraits.push("抑鬱");
      }
      syncEffectiveStats(p);
      p.happiness = clampValue(p.happiness - 30, 0, 100);


      v.log(`${p.name}は抑鬱状態になった`);
    } else if (p.mp <= 33) {
      // 心労状態
      if (!p.mindTraits.includes("心労")) {
        p.mindTraits.push("心労");
      }
      syncEffectiveStats(p);
      v.log(`${p.name}は心労状態になった`);
    }
  });

  applyPublicBathMonthlyRecovery(v);
  applyWatermillMonthlyFood(v);
  processHopeLossAtMonthStart(v);
  if (v.gameOver) return;
  applyFountainMonthlyHappiness(v);

  // 幸福度調整
  getActiveVillagers(v).forEach(p=>{
    if (p.happiness>50) {
      let diff = p.happiness-50;
      let dec = Math.floor(diff * randFloat(0.2,0.4));
      p.happiness=clampValue(p.happiness-dec,0,100);
    }
  });
  // 既存の訪問者をクリア
  v.visitors = [];
  v.pendingAdventurerQuestReports = processAdventurerQuestReturns(v);

  const visitorLimit = getVisitorLimit(v);
  v.visitorLimit = visitorLimit;

  // 各訪問者枠ごとに50%の確率で訪問者を生成
  if (!simulationOptions.suppressVisitors) {
    for (let i = 0; i < visitorLimit; i++) {
      if (Math.random() < 0.5) {
        let visitor = createRandomVisitor([
          ...v.villagers.map(person => person.name),
          ...v.visitors.map(person => person.name),
          ...(Array.isArray(v.activeAdventurerQuests)
            ? v.activeAdventurerQuests.map(quest => quest?.adventurer?.name).filter(Boolean)
            : [])
        ], null, v);
        v.visitors.push(visitor);
        v.log(`訪問者 ${visitor.name} が村を訪れました`);
        const arrivalLine = getVisitorArrivalLine(visitor);
        if (arrivalLine) v.log(`${visitor.name}「${arrivalLine}」`);
      }
    }
  }

  // 全村人の行動テーブルを再構築し、一時行動から通常の復帰先へ戻す
  v.villagers.forEach(p=>{
    if (isSaltPillar(p)) return;
    const currentAction = String(p.action || ACTION_NONE).trim() || ACTION_NONE;

    p.actionTable = [];
    p.jobTable = [];

    const restriction = applyForcedActionRestriction(p);
    if (restriction.restricted) {
      v.log(`${p.name}は${restriction.reason}のため、行動を「${restriction.action}」に設定しました`);
      return;
    }

    refreshJobTable(p, v);

    const preferredAction = String(p.preferredAction || p.job || ACTION_NONE).trim() || ACTION_NONE;
    const hasPreferredAction = preferredAction !== ACTION_NONE && p.actionTable.includes(preferredAction);
    const isRaidAction = currentAction === "迎撃" || currentAction === "籠城" || currentAction === "射撃" || currentAction === "罠作成";
    const isFixedAction = [ACTION_CRADLE, ACTION_HEAL, ACTION_LAST_MOMENTS].includes(p.action);

    if (!isFixedAction && (isTemporaryAction(currentAction) || isRaidAction || !p.actionTable.includes(currentAction))) {
      p.action = hasPreferredAction ? preferredAction : ACTION_NONE;
    }

    // 勤勉度および体力・メンタルによる休養判定。
    // 揺籃・療養・臨終などの固定行動は上書きしない。
    let needsRest = false;
    let restReason = "";
    const canSwitchToRest = ![ACTION_CRADLE, ACTION_HEAL, ACTION_LAST_MOMENTS].includes(p.action) &&
      (p.actionTable.includes(ACTION_REST) || p.actionTable.includes(ACTION_LEISURE));
    const chooseRecoveryAction = () => {
      if (p.hp <= p.mp) return p.actionTable.includes(ACTION_REST) ? ACTION_REST : ACTION_LEISURE;
      return p.actionTable.includes(ACTION_LEISURE) ? ACTION_LEISURE : ACTION_REST;
    };

    if (canSwitchToRest) {
      if (p.ind >= 21) {
        if (p.hp <= 33 && p.mp <= 33) {
          needsRest = true;
          restReason = "体力とメンタルが低下";
          p.action = chooseRecoveryAction();
        } else if (p.hp <= 33) {
          needsRest = true;
          restReason = "体力が低下";
          p.action = p.actionTable.includes(ACTION_REST) ? ACTION_REST : ACTION_LEISURE;
        } else if (p.mp <= 33) {
          needsRest = true;
          restReason = "メンタルが低下";
          p.action = p.actionTable.includes(ACTION_LEISURE) ? ACTION_LEISURE : ACTION_REST;
        }
      } else if (p.ind >= 13) {
        if (p.hp <= 50 && p.mp <= 50) {
          needsRest = true;
          restReason = "体力とメンタルが低下";
          p.action = chooseRecoveryAction();
        } else if (p.hp <= 50) {
          needsRest = true;
          restReason = "体力が低下";
          p.action = p.actionTable.includes(ACTION_REST) ? ACTION_REST : ACTION_LEISURE;
        } else if (p.mp <= 50) {
          needsRest = true;
          restReason = "メンタルが低下";
          p.action = p.actionTable.includes(ACTION_LEISURE) ? ACTION_LEISURE : ACTION_REST;
        }
      } else {
        if (p.hp <= 60 && p.mp <= 60) {
          needsRest = true;
          restReason = "体力とメンタルが低下";
          p.action = chooseRecoveryAction();
        } else if (p.hp <= 60) {
          needsRest = true;
          restReason = "体力が低下";
          p.action = p.actionTable.includes(ACTION_REST) ? ACTION_REST : ACTION_LEISURE;
        } else if (p.mp <= 60) {
          needsRest = true;
          restReason = "メンタルが低下";
          p.action = p.actionTable.includes(ACTION_LEISURE) ? ACTION_LEISURE : ACTION_REST;
        }
      }
    }

    if (needsRest) {
      v.log(`${p.name}は${restReason}のため、${p.action}します`);
    }
  });
}

// -------------------------
// 加齢 (年始に呼ばれる)
// -------------------------
export function doAgingProcess(v) {
  v.log("【加齢処理】");
  v.villagers.forEach(p=>{
    if (isSaltPillar(p)) return;
    p.bodyAge++;
    p.spiritAge++;
    const wasOldWolf = p.bodyTraits.includes(OLD_WOLF_TRAIT);
    const ageLimitedTraitsChanged = syncWolfSpeciesTraits(p);
    if (isWolf(p)) {
      if (!wasOldWolf && p.bodyTraits.includes(OLD_WOLF_TRAIT)) {
        v.log(`${p.name}は老狼になった`);
      }
      if (ageLimitedTraitsChanged) syncEffectiveStats(p);
    } else if (p.bodyTraits.some(trait => NO_AGING_BODY_TRAITS.has(trait))) {
      syncEffectiveStats(p);
    } else if (!p.bodyTraits.includes("老人")) {
      if (p.bodyAge>=60) {
        p.bodyTraits.push("老人");
        syncEffectiveStats(p);
        v.log(`${p.name}は老人になった`);
      } else if (!p.bodyTraits.includes("中年") && p.bodyAge>=40) {
        p.bodyTraits.push("中年");
        syncEffectiveStats(p);
        v.log(`${p.name}は中年になった`);
      }
    }
    if (ageLimitedTraitsChanged && !isWolf(p)) {
      syncEffectiveStats(p);
      refreshJobTable(p, v);
    }
    v.log(`${p.name}:${p.bodyAge}歳(精神年齢${p.spiritAge})`);
    updateChildGrowthStage(p, v, { announce: true });
  });
}

// -------------------------
// 季節更新
// -------------------------
export function updateSeason(v, { showDialog = true, logChange = true } = {}) {
  ["春","夏","秋","冬"].forEach(ss=>{
    let i=v.villageTraits.indexOf(ss);
    if (i>=0) v.villageTraits.splice(i,1);
  });
  let newS="";
  switch(v.month) {
    case 3: newS="春"; break;
    case 6: newS="夏"; break;
    case 9: newS="秋"; break;
    case 12:newS="冬"; break;
  }
  if (newS) {
    v.villageTraits.push(newS);
    // 季節変更ダイアログを表示
    if (showDialog) showSeasonChangeDialog(newS);
    if (logChange) v.log(`${newS}が訪れた`);
  }
  return newS;
}

// 季節変更ダイアログを表示する関数
function showSeasonChangeDialog(season) {
  if (typeof document === "undefined") return;
  const seasonData = {
    "春": {
      image: "../images/seasons/spring.jpg",
      message: "暖かな風が吹き、新しい命が芽吹く季節となりました。",
      accent: "#ffd6e7",
      tips: [
        "大きな補正は少ない安定した季節です。",
        "食料や資材を整え、夏以降に備えるのに向いています。"
      ]
    },
    "夏": {
      image: "../images/seasons/summer.jpg",
      message: "太陽が高く昇り、生命力溢れる季節となりました。",
      accent: "#ffe39a",
      tips: [
        "漁の成果が1.2倍になります。",
        "月末の夏至祭では体力・メンタルが回復し、結婚判定があります。",
        "ランダムイベントの猛暑や冷夏には注意してください。"
      ]
    },
    "秋": {
      image: "../images/seasons/autumn.jpg",
      message: "実りの秋を迎え、収穫の季節となりました。",
      accent: "#ffd08a",
      tips: [
        "農作業と採集の生産量が1.5倍になります。",
        "冬に備えて食料と資材を厚めに蓄える好機です。"
      ]
    },
    "冬": {
      image: "../images/seasons/winter.jpg",
      message: "寒さが厳しくなり、静かな季節となりました。",
      accent: "#d5e8ff",
      tips: [
        "農作業の生産量が0.5倍、狩猟の生産量が1.2倍になります。",
        "月末に村人1人あたり資材10を消費します。資材0だと凍えが発生します。",
        "狼は冬の資材消費が0で、凍えが発生しません。"
      ]
    }
  };
  const data = seasonData[season];
  if (!data) return;
  const imageUrl = new URL(data.image, import.meta.url).href;

  let overlay = document.createElement("div");
  overlay.id = "seasonChangeOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(9, 8, 7, 0.45);
    z-index: 1400;
  `;

  let dialog = document.createElement("div");
  dialog.id = "seasonChangeDialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    box-sizing: border-box;
    width: min(720px, 92vw);
    min-height: min(360px, 84vh);
    max-height: 84vh;
    overflow-y: auto;
    color: #fffaf0;
    border: 1px solid rgba(255, 255, 255, 0.42);
    border-radius: 8px;
    text-align: left;
    z-index: 1401;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.48);
    background-image:
      linear-gradient(90deg, rgba(10, 8, 6, 0.88), rgba(10, 8, 6, 0.62) 54%, rgba(10, 8, 6, 0.2)),
      url("${imageUrl}");
    background-size: cover;
    background-position: center;
  `;

  let content = document.createElement("div");
  content.style.cssText = `
    box-sizing: border-box;
    min-height: min(360px, 84vh);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 14px;
    padding: clamp(22px, 5vw, 42px);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.75);
  `;

  let seasonText = document.createElement("h2");
  seasonText.textContent = `${season}の訪れ`;
  seasonText.style.cssText = `
    margin: 0;
    color: ${data.accent};
    font-size: clamp(2rem, 7vw, 3.5rem);
    line-height: 1;
    letter-spacing: 0;
  `;

  let message = document.createElement("p");
  message.textContent = data.message;
  message.style.cssText = `
    max-width: 34rem;
    margin: 0;
    line-height: 1.7;
    font-size: clamp(1rem, 2.8vw, 1.16rem);
  `;

  let tipList = document.createElement("ul");
  tipList.style.cssText = `
    max-width: 36rem;
    margin: 0;
    padding: 11px 13px 11px 2rem;
    text-align: left;
    line-height: 1.55;
    color: #fffaf0;
    background: rgba(255, 248, 225, 0.13);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 6px;
    backdrop-filter: blur(2px);
  `;
  data.tips.forEach(tip => {
    const item = document.createElement("li");
    item.textContent = tip;
    tipList.appendChild(item);
  });

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;justify-content:flex-end;margin-top:4px;";

  let closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "閉じる";
  closeButton.style.cssText = `
    min-width: 88px;
    padding: 8px 16px;
    background: ${data.accent};
    border: 1px solid rgba(255, 255, 255, 0.55);
    color: #241d17;
    border-radius: 5px;
    font-weight: bold;
    cursor: pointer;
  `;
  const closeDialog = () => {
    overlay.remove();
    dialog.remove();
  };
  closeButton.onclick = closeDialog;
  overlay.onclick = closeDialog;

  buttons.appendChild(closeButton);
  content.appendChild(seasonText);
  content.appendChild(message);
  content.appendChild(tipList);
  content.appendChild(buttons);
  dialog.appendChild(content);
  document.body.appendChild(overlay);
  document.body.appendChild(dialog);

  // 5秒後に自動で閉じる
  setTimeout(() => {
    if (document.body.contains(dialog)) {
      closeDialog();
    }
  }, 5000);
}

// 追加で本ファイル内だけで使う randChoice 等
function randChoice(arr) {
  if (!arr||arr.length===0) return null;
  return arr[Math.floor(Math.random()*arr.length)];
}


// randFloat (幸福度自然減衰で使用)
function randFloat(min,max){ return Math.random()*(max-min)+min; }
