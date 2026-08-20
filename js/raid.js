// raid.js

import { randInt, randChoice, clampValue, shuffleArray, getPortraitPath } from "./util.js";
import { getRaidRulesById } from "./data/raidData.js";
import { damageRandomBuilding } from "./buildings.js";
import { hasActiveBuildingFlag } from "./domain/buildingState.js";
import { endOfMonthProcess, doFixedEventPost, doAgingProcess, runMonthStartPhase } from "./events.js";
import { handleAllVillagerJobs } from "./jobs.js";
import { addDivineMight } from "./divineMight.js";
import {
  clearDefeatedRaidEnemies,
  recordDefeatedRaidEnemy,
  tryCaptureRaidPrisoner
} from "./captives.js";
import {
  ACTION_CANNON,
  ACTION_DEFEND,
  ACTION_FORTIFY,
  ACTION_TRAP,
  RAID_MIDDLE_ACTIONS,
  canPerformRaidAction,
  getRaidActionBlockReason,
  getRaidActionSkipMessage,
  getRaiderIncomingDamageMultiplier,
  getActiveRaidFrontliners,
  getActiveRaidMiddleliners,
  getActiveRaidTrapMakers,
  isRaidCombatAction
} from "./raidRules.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { updateUI } from "./ui.js";
import { applyRaidFriendshipResults, recordRaidFriendshipDamage, startRaidFriendshipTracking } from "./relationships.js";
import { handleApocalypseRaidResult } from "./apocalypse.js";
import { isSaltPillar } from "./domain/apocalypseRules.js";

const RAID_CLOSE_DELAY_MS = 700;
const RAID_ACTION_SETTLE_DELAY_MS = 780;
const RAID_ACTOR_FOCUS_DELAY_MS = 460;
const RAID_DAMAGE_EFFECT_DELAY_MS = 430;
const RAID_DEFEAT_POP_REMOVE_DELAY_MS = 720;
const RAID_PHASE_REAR = "rear";
const RAID_PHASE_COMBAT = "combat";
const RAID_POSITION_FRONT = "front";
const RAID_POSITION_MIDDLE = "middle";
const RAID_TARGET_WEAKEST_HIGH_CHANCE = "weakestHighChance";
const RAID_ATTACK_RANGED_MAGIC = "rangedMagic";
const RAID_WEAKEST_TARGET_CHANCE = 0.8;
const APOCALYPSE_GRAND_CRUSADE_ID = "apocalypse-grand-crusade";
const APOCALYPSE_UPPER_WINGED_ID = "apocalypse-upper-winged";
const APOCALYPSE_WAR_RAIDER_TYPE = "黙示録の騎士・戦争";
const APOCALYPSE_CONQUEST_RAIDER_TYPE = "黙示録の騎士・支配";
const WAR_LIGHT_PILLAR_TURN = 7;
const WAR_LIGHT_PILLAR_DAMAGE = 666;
const CONQUEST_JUDGMENT_LIGHT_TURNS = new Set([1, 3]);
const CONQUEST_JUDGMENT_LIGHT_DAMAGE = 200;
const HOLY_ATTACK_IMMUNITY_TRAIT = "光輪";
const TRAIT_INJURED = "負傷";
const TRAIT_SERIOUS_INJURY = "重体";
const TRAIT_CRITICAL = "危篤";
const TRAIT_EXPOSURE = "曝露";
const pendingRaidDepartures = new WeakSet();
const settlingRaidVillages = new WeakSet();
const raidUnitRenderIds = new WeakMap();
let nextRaidUnitRenderId = 1;

function getRaidStepButton() {
  return document.getElementById("raidStepButton") ||
    document.querySelector("#raidModal .raid-buttons button");
}

function getRaidRetreatButton() {
  return document.getElementById("raidRetreatButton");
}

function setRaidStepButtonState(disabled, text = "") {
  const stepButton = getRaidStepButton();
  if (stepButton) {
    stepButton.disabled = disabled;
    if (text) stepButton.textContent = text;
  }
}

function setRaidRetreatButtonState(disabled) {
  const retreatButton = getRaidRetreatButton();
  if (retreatButton) retreatButton.disabled = disabled;
}

function setRaidActionButtonState(disabled, text = "") {
  setRaidRetreatButtonState(disabled);
  setRaidStepButtonState(disabled, text);
}

function scrollRaidLogToLatest() {
  const logDiv = document.getElementById("raidLogArea");
  if (!logDiv) return;
  logDiv.scrollTop = logDiv.scrollHeight;
}

function waitRaidActionSettle() {
  return new Promise(resolve => setTimeout(resolve, RAID_ACTION_SETTLE_DELAY_MS));
}

function waitRaidAnimation(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRaidActionSettling(village) {
  return Boolean(village) && settlingRaidVillages.has(village);
}

function markRaidDeparture(unit) {
  if (unit && typeof unit === "object") pendingRaidDepartures.add(unit);
}

function isPendingRaidDeparture(unit) {
  return Boolean(unit) && pendingRaidDepartures.has(unit);
}

function clearPendingRaidDepartures(village) {
  if (Array.isArray(village?.raidEnemies)) {
    village.raidEnemies = village.raidEnemies.filter(enemy => {
      const shouldRemove = enemy?.hp <= 0 && isPendingRaidDeparture(enemy);
      if (shouldRemove) pendingRaidDepartures.delete(enemy);
      return !shouldRemove;
    });
  }
  if (Array.isArray(village?.villagers)) {
    village.villagers.forEach(villager => {
      if (villager?.hp <= 0 && isPendingRaidDeparture(villager)) {
        pendingRaidDepartures.delete(villager);
      }
    });
  }
}

function getRaidUnitRenderId(unit) {
  if (!unit || typeof unit !== "object") return "";
  if (!raidUnitRenderIds.has(unit)) {
    raidUnitRenderIds.set(unit, `raid-unit-${nextRaidUnitRenderId++}`);
  }
  return raidUnitRenderIds.get(unit);
}

function getRaidUnitRow(unit) {
  const renderId = getRaidUnitRenderId(unit);
  if (!renderId) return null;
  return document.querySelector(`#raidModal tr[data-raid-unit-id="${renderId}"]`);
}

function createRaidActionResult(actor = null) {
  return {
    actor,
    animations: [],
    logs: []
  };
}

function addRaidActionLog(result, log) {
  if (result && log) result.logs.push(log);
}

function addRaidActionAnimation(result, actor, actionLabel, isCounter = false) {
  if (!result || !actor) return;
  result.animations.push({ actor, actionLabel, isCounter });
}

function addRaidDepartureAnimation(result, actor, actionLabel) {
  if (!result || !actor || !actionLabel) return;
  result.animations.push({ actor, actionLabel, isDeparture: true });
}

function addRaidDamageAnimation(result, actor, target, damage, isCounter = false, actionLabel = "") {
  if (!result || !actor) return;
  result.animations.push({ actor, target, damage, isCounter, actionLabel });
}

function appendRaidActionLogs(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return;
  const logDiv = document.getElementById("raidLogArea");
  if (!logDiv) return;
  logDiv.innerHTML += logs.map(log => `<br>${log}`).join("");
  scrollRaidLogToLatest();
}

function clearRaidAnimationClasses(...rows) {
  rows.forEach(row => {
    if (!row) return;
    row.classList.remove("is-acting", "is-countering", "is-hit", "is-retreating");
  });
}

function getRaidDamageLabel(damage) {
  return `${Math.floor(Number(damage) || 0)}ダメージ`;
}

function getRaidHpDamageLabel(damage) {
  return `-${Math.floor(Number(damage) || 0)}`;
}

function showRaidDamagePop(row, damage) {
  if (!row || damage == null) return;
  const anchor = row.querySelector(".raid-unit-hp") || row.querySelector(".raid-unit-name") || row.lastElementChild;
  if (!anchor) return;
  const pop = document.createElement("span");
  pop.className = "raid-damage-pop";
  pop.textContent = getRaidHpDamageLabel(damage);
  anchor.appendChild(pop);
  setTimeout(() => pop.remove(), RAID_DAMAGE_EFFECT_DELAY_MS + 220);
}

function isRaidRetreatLabel(label) {
  const text = String(label || "").trim();
  return text === "離脱" || text === "撤退" || text === "撤収";
}

function isRaidDefeatLabel(label) {
  return String(label || "").trim() === "撃退";
}

function getRaidActionPopClass(label, isDeparture = false, popType = "") {
  const classes = ["raid-action-pop"];
  if (popType) {
    classes.push(`is-${popType}`);
  }
  if (isDeparture && isRaidRetreatLabel(label)) {
    classes.push("is-retreat");
  }
  if (isRaidDefeatLabel(label)) {
    classes.push("is-defeat");
  }
  return classes.join(" ");
}

function getRaidActionPopRemoveDelay(label, isDeparture = false) {
  if (isRaidDefeatLabel(label)) return RAID_DEFEAT_POP_REMOVE_DELAY_MS;
  return isDeparture
    ? RAID_ACTOR_FOCUS_DELAY_MS + 120
    : RAID_ACTOR_FOCUS_DELAY_MS + RAID_DAMAGE_EFFECT_DELAY_MS + 220;
}

function showRaidActionPop(row, label, isDeparture = false, popType = "") {
  if (!row || !label) return;
  const anchor = row.querySelector(".raid-unit-name") || row.querySelector(".raid-portrait-cell") || row.lastElementChild;
  if (!anchor) return;
  anchor.querySelector(".raid-action-pop")?.remove();
  const pop = document.createElement("span");
  pop.className = getRaidActionPopClass(label, isDeparture, popType);
  pop.textContent = label;
  anchor.appendChild(pop);
  setTimeout(() => pop.remove(), getRaidActionPopRemoveDelay(label, isDeparture));
}

function showRaidDamageActionPop(row, damage) {
  if (!row || damage == null) return;
  showRaidActionPop(row, getRaidDamageLabel(damage), false, "damage");
}

async function playRearDepartureAnimations(village) {
  const rearUnits = getVisibleTrapMakers(village);
  if (rearUnits.length === 0) return;
  updateRaidTables(village);
  rearUnits.forEach(unit => {
    const row = getRaidUnitRow(unit);
    if (!row) return;
    row.classList.add("is-leaving");
    row.classList.add("is-retreating");
    showRaidActionPop(row, "離脱", true);
  });
  await waitRaidAnimation(RAID_ACTOR_FOCUS_DELAY_MS + RAID_DAMAGE_EFFECT_DELAY_MS);
}

async function playRaidAnimationStep(step) {
  const actorRow = getRaidUnitRow(step?.actor);
  const targetRow = getRaidUnitRow(step?.target);

  if (actorRow) {
    if (step.isDeparture) {
      actorRow.classList.add("is-leaving");
      if (isRaidRetreatLabel(step.actionLabel)) actorRow.classList.add("is-retreating");
    } else {
      actorRow.classList.add(step.isCounter ? "is-countering" : "is-acting");
    }
    showRaidActionPop(actorRow, step.actionLabel, step.isDeparture);
  }
  await waitRaidAnimation(RAID_ACTOR_FOCUS_DELAY_MS);

  if (targetRow) {
    targetRow.classList.add("is-hit");
    showRaidDamagePop(targetRow, step.damage);
    showRaidDamageActionPop(targetRow, step.damage);
  }
  await waitRaidAnimation(RAID_DAMAGE_EFFECT_DELAY_MS);
  clearRaidAnimationClasses(actorRow, targetRow);
}

async function playRaidActionAnimations(result) {
  const animations = Array.isArray(result?.animations) ? result.animations : [];
  for (const animation of animations) {
    await playRaidAnimationStep(animation);
  }
}

function getActiveRaidRules(village) {
  return getRaidRulesById(village?.currentRaid?.id);
}

function getRaidSurviveTurns(village) {
  const value = Number(getActiveRaidRules(village).defense?.surviveTurns);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function calculateRaidFailurePenalty(village) {
  const raidRules = getActiveRaidRules(village);
  const penalty = raidRules.failurePenalty || {};
  const hpRange = Array.isArray(penalty.villagerHpRange) ? penalty.villagerHpRange : null;
  const hpMinRaw = hpRange ? Number(hpRange[0]) || 0 : 0;
  const hpMaxRaw = hpRange ? Number(hpRange[1]) || hpMinRaw : 0;
  const hpMin = Math.min(hpMinRaw, hpMaxRaw);
  const hpMax = Math.max(hpMinRaw, hpMaxRaw);

  return {
    foodLoss: Math.floor((Number(village.food) || 0) * (Number(penalty.foodRate) || 0)),
    materialsLoss: Math.floor((Number(village.materials) || 0) * (Number(penalty.materialsRate) || 0)),
    fundsLoss: Math.floor((Number(village.funds) || 0) * (Number(penalty.fundsRate) || 0)),
    manaLoss: Math.floor((Number(village.mana) || 0) * (Number(penalty.manaRate) || 0)),
    securityLoss: Number(penalty.security) || 0,
    happinessLoss: Number(penalty.villagerHappiness) || 0,
    hpMin,
    hpMax,
    buildingDamage: penalty.buildingDamage === true,
    goldenStatueDamage: penalty.goldenStatueDamage === true,
    severeInjury: penalty.severeInjury === true
  };
}

function formatRaidFailurePenaltyLines(village) {
  const penalty = calculateRaidFailurePenalty(village);
  const hpText = penalty.hpMax > 0
    ? `村人HP: -${penalty.hpMin}〜-${penalty.hpMax}`
    : "村人HP: 被害なし";

  return [
    `食料: -${penalty.foodLoss}`,
    `資材: -${penalty.materialsLoss}`,
    `資金: -${penalty.fundsLoss}`,
    `魔素: -${penalty.manaLoss}`,
    `治安: -${penalty.securityLoss}`,
    hpText,
    `村人幸福: -${penalty.happinessLoss}`,
    penalty.buildingDamage ? "建築損壊: あり" : "建築損壊: なし",
    ...(penalty.goldenStatueDamage ? ["バッカスの黄金像損壊: あり"] : []),
    penalty.severeInjury ? "重体判定: あり" : "重体判定: なし"
  ];
}

function getSevereInjuryChance(person) {
  const bodyAge = Number(person?.bodyAge);
  return Number.isFinite(bodyAge) && bodyAge >= 50 ? 0.5 : 0.3;
}

function normalizeBodyTraits(person) {
  if (!Array.isArray(person.bodyTraits)) person.bodyTraits = [];
  return person.bodyTraits;
}

function rollRaidSevereInjuryCheck(village, raidRules) {
  if (raidRules.failurePenalty?.severeInjury !== true) return null;

  const candidates = (village.villagers || []).filter(person => {
    if (isSaltPillar(person)) return false;
    const bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
    return (Number(person.hp) || 0) <= 0 &&
      !bodyTraits.includes(TRAIT_SERIOUS_INJURY) &&
      !bodyTraits.includes(TRAIT_CRITICAL);
  });
  if (candidates.length === 0) return null;

  const target = randChoice(candidates);
  return {
    target,
    isSevere: Math.random() < getSevereInjuryChance(target)
  };
}

function applyRaidSevereInjuryResult(village, result) {
  if (!result || !(village.villagers || []).includes(result.target)) return;

  const target = result.target;
  const bodyTraits = normalizeBodyTraits(target);
  if (result.isSevere) {
    target.bodyTraits = bodyTraits.filter(trait => trait !== TRAIT_INJURED);
    if (!target.bodyTraits.includes(TRAIT_SERIOUS_INJURY)) {
      target.bodyTraits.push(TRAIT_SERIOUS_INJURY);
    }
    village.log(`重体判定:${target.name}は重体になった`);
  } else {
    if (!bodyTraits.includes(TRAIT_INJURED)) bodyTraits.push(TRAIT_INJURED);
    village.log(`重体判定:${target.name}は重体を免れ、負傷に留まった`);
  }
  refreshJobTable(target, village);
}

function hasSurvivedRaidTurns(village) {
  const surviveTurns = getRaidSurviveTurns(village);
  return surviveTurns != null && village.raidTurnCount > surviveTurns;
}

function isEnemyUnit(unit, village) {
  return Array.isArray(village?.raidEnemies) && village.raidEnemies.includes(unit);
}

function hasTrait(person, trait) {
  return (Array.isArray(person?.bodyTraits) && person.bodyTraits.includes(trait)) ||
    (Array.isArray(person?.mindTraits) && person.mindTraits.includes(trait));
}

function hasMoatDefense(village) {
  return hasActiveBuildingFlag(village, "hasMoat", "moat");
}

function normalizeEnemyPosition(position) {
  return position === RAID_POSITION_MIDDLE ? RAID_POSITION_MIDDLE : RAID_POSITION_FRONT;
}

function getCombatPosition(unit, village) {
  if (isEnemyUnit(unit, village)) {
    return normalizeEnemyPosition(unit.raidPosition);
  }
  if (RAID_MIDDLE_ACTIONS.includes(unit?.action)) return RAID_POSITION_MIDDLE;
  if (unit?.action === ACTION_DEFEND || unit?.action === ACTION_FORTIFY) return RAID_POSITION_FRONT;
  return "";
}

function getTrapMakers(village) {
  return getActiveRaidTrapMakers(village).filter(person => person.hp > 0);
}

function getVisibleTrapMakers(village) {
  if (village.raidPhase !== RAID_PHASE_REAR) return [];
  const activeTrapMakers = getActiveRaidTrapMakers(village);
  return village.villagers.filter(p =>
    (
      activeTrapMakers.includes(p) &&
      p.hp > 0 &&
      canPerformRaidAction(p, ACTION_TRAP, village)
    ) ||
    (isPendingRaidDeparture(p) && p.action === ACTION_TRAP)
  );
}

function getPendingTrapMakers(village) {
  if (village.raidPhase !== RAID_PHASE_REAR) return [];
  const queue = Array.isArray(village.raidActionQueue) ? village.raidActionQueue : [];
  const currentIndex = Math.max(0, Number(village.currentActionIndex) || 0);
  return queue
    .slice(currentIndex)
    .filter(action => action?.type === "TRAP")
    .map(action => action.actor)
    .filter(p => p && p.hp > 0 && canPerformRaidAction(p, ACTION_TRAP, village));
}

function isRearRetreatingUnit(unit, village) {
  if (village?.raidPhase !== RAID_PHASE_REAR || unit?.action !== ACTION_TRAP) return false;
  const queue = Array.isArray(village.raidActionQueue) ? village.raidActionQueue : [];
  if (queue.length === 0) return false;
  const currentIndex = Math.max(0, Number(village.currentActionIndex) || 0);
  return currentIndex >= queue.length;
}

function getVillageCombatants(village) {
  const frontliners = getActiveRaidFrontliners(village).filter(person => person.hp > 0);
  return frontliners.concat(getActiveRaidMiddleliners(village));
}

/** 火砲はターンの最後に撃つため、行動順と被ダメージ倍率を射撃と分けて扱う。 */
function isCannonUnit(unit, village) {
  return !isEnemyUnit(unit, village) && unit?.action === ACTION_CANNON;
}

function getAliveEnemies(village) {
  return village.raidEnemies.filter(e => e.hp > 0);
}

function sortByCourage(units) {
  return units.sort((a, b) => {
    if (b.cou === a.cou) return Math.random() < 0.5 ? -1 : 1;
    return b.cou - a.cou;
  });
}

function getRaidPhaseLabel(village) {
  if (village.isRaidProcessDone) return "終了";
  if (village.raidPhase === RAID_PHASE_REAR) return "後衛準備";
  if (village.raidPhase === RAID_PHASE_COMBAT) return `戦闘 ${Math.max(1, Number(village.raidTurnCount) || 1)}ターン目`;
  return "開始前";
}

function updateRaidStatusLine(village) {
  const statusLine = document.getElementById("raidStatusLine");
  if (!statusLine) return;

  const frontliners = getActiveRaidFrontliners(village).filter(person => person.hp > 0).length;
  const middleliners = getActiveRaidMiddleliners(village).length;
  const pendingTraps = getPendingTrapMakers(village).length;
  const enemyCount = getAliveEnemies(village).length;
  const surviveTurns = getRaidSurviveTurns(village);
  let surviveText = "";
  if (surviveTurns) {
    // 戦闘中は残りターン数を数え、あと何手粘れば敵が引き揚げるか分かるようにする。
    surviveText = village.raidPhase === RAID_PHASE_COMBAT
      ? ` / 敵撤退まで残り${surviveTurns + 1 - Math.max(1, Number(village.raidTurnCount) || 1)}ターン`
      : ` / 敵撤退目安 ${surviveTurns}ターン`;
  }

  statusLine.textContent = `フェーズ: ${getRaidPhaseLabel(village)}${surviveText} / 前衛${frontliners}・中衛${middleliners}・後衛残り${pendingTraps} / 襲撃者${enemyCount}`;
}

function pickFrontFirst(candidates, village) {
  const front = candidates.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_FRONT);
  const middle = candidates.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_MIDDLE);
  return front.length > 0 ? front : middle;
}

// 通常攻撃は、攻撃側が中衛であっても前衛が残っている間は前衛だけを狙う。
// 黙示録の裁きの光と光の柱は専用処理で対象を選ぶため、この制限を受けない。
function getTargetCandidates(actor, village) {
  const candidates = isEnemyUnit(actor, village)
    ? getVillageCombatants(village)
    : getAliveEnemies(village);
  return pickFrontFirst(candidates, village);
}

function selectTarget(actor, village) {
  const candidates = getTargetCandidates(actor, village);
  if (
    isEnemyUnit(actor, village) &&
    actor.raidTargeting === RAID_TARGET_WEAKEST_HIGH_CHANCE &&
    candidates.length > 0 &&
    Math.random() < RAID_WEAKEST_TARGET_CHANCE
  ) {
    const lowestHp = Math.min(...candidates.map(target => Number(target.hp) || 0));
    return randChoice(candidates.filter(target => (Number(target.hp) || 0) === lowestHp));
  }
  return randChoice(candidates);
}

function applyRaidDamage(target, damage) {
  const amount = Math.max(0, Math.floor(Number(damage) || 0));
  const saltPillarShattered = amount > 0 && isSaltPillar(target);
  target.hp = saltPillarShattered ? 0 : Math.max(0, (Number(target.hp) || 0) - amount);
  return saltPillarShattered;
}

function addSaltPillarShatterLog(result, target) {
  addRaidActionLog(result, `【塩の柱】${target.name}の塩の柱は砕け散った！`);
}

function scheduleDefeatedEnemyDeparture(enemy) {
  if (enemy?.hp <= 0) {
    markRaidDeparture(enemy);
  }
}

function isRaidEnemyActionActor(actor, village) {
  return isEnemyUnit(actor, village) || Boolean(actor?.raiderType);
}

function shouldSkipDefeatedEnemyAction(actor, village) {
  return Boolean(actor) && actor.hp <= 0 && isRaidEnemyActionActor(actor, village);
}

/**
 * 襲撃者タイプの定義
 */

/**
 * 重み付き抽選で襲撃者タイプを選択
 */


/**
 * 迎撃モーダルを開く (nextTurnから呼ばれる)
 */
export function openRaidModal(village) {
  document.getElementById("raidOverlay").style.display="block";
  document.getElementById("raidModal").style.display="block";
  setRaidActionButtonState(false, "次のステップ");
  const rlog=document.getElementById("raidLogArea");
  rlog.innerHTML="襲撃が始まります。<br>「次のステップ」ボタンを押して進めてください。";

  let trapMakers = getTrapMakers(village);
  let combatants = getVillageCombatants(village);
  const frontliners = getActiveRaidFrontliners(village).filter(person => person.hp > 0);
  startRaidFriendshipTracking(village, {
    participants: trapMakers.concat(combatants),
    frontliners
  });

  if (trapMakers.length===0 && combatants.length===0) {
    rlog.innerHTML+=`<br>戦闘に参加する者がいません！ → 自動的に襲撃成功(敵側)。`;
    village.raidActionQueue=[ {type:"AUTO_FAIL"} ];
    village.currentActionIndex=0;
  } else {
    village.raidTurnCount=0;
    createRearActionQueue(village);
  }
  updateRaidTables(village);
}

/**
 * 後衛(0ターン目)のキューを作成
 */
function createRearActionQueue(village) {
  let trapMakers = getTrapMakers(village);
  trapMakers = shuffleArray(trapMakers);

  village.raidPhase = RAID_PHASE_REAR;
  village.raidActionQueue=[];
  trapMakers.forEach(p=>{
    village.raidActionQueue.push({
      type:"TRAP",
      actor:p
    });
  });
  village.currentActionIndex=0;
}

/**
 * 「次のステップ」ボタン
 */
export function proceedRaidAction(village) {
  if (village.isRaidFinalizing || village.isRaidProcessDone || isRaidActionSettling(village)) return;

  let action = village.raidActionQueue[village.currentActionIndex];

  if (!action) {
    if (village.raidPhase === RAID_PHASE_REAR) {
      setupCombatPhase(village);
      return;
    }
    finalizeCombatTurn(village);
    return;
  }
  setRaidActionButtonState(true, "処理中...");
  let actionResult = createRaidActionResult(action.actor);
  switch(action.type) {
    case "TRAP":
      actionResult = doOneTrapAction(action, village);
      break;
    case "COMBAT":
      actionResult = doOneCombatAction(action, village);
      break;
    case "WAR_LIGHT_PILLAR":
      actionResult = doWarLightPillarAction(action, village);
      break;
    case "CONQUEST_JUDGMENT_LIGHT":
      actionResult = doConquestJudgmentLightAction(action, village);
      break;
    case "AUTO_FAIL":
      finalizeRaid(false, "戦闘部隊0", village);
      return;
  }
  village.currentActionIndex++;
  settleRaidAction(village, actionResult);
}

export function retreatRaid(village) {
  if (village.isRaidFinalizing || village.isRaidProcessDone || isRaidActionSettling(village)) return;

  const penaltyText = formatRaidFailurePenaltyLines(village)
    .map(line => `・${line}`)
    .join("\n");
  const message = [
    "撤退すると迎撃失敗になります。",
    "",
    "この襲撃の迎撃失敗ペナルティ:",
    penaltyText,
    "",
    "OKを押すと迎撃モーダルを終了し、防衛失敗として処理します。",
    "これ以上迎撃を続けていた時の追加被害は防げます。",
    "",
    "撤退しますか？"
  ].join("\n");

  if (typeof window !== "undefined" && !window.confirm(message)) return;

  setRaidActionButtonState(true, "終了処理中...");
  finalizeRaid(false, "撤退", village, { closeDelayMs: 0 });
}

async function settleRaidAction(village, actionResult = null) {
  settlingRaidVillages.add(village);
  try {
    updateRaidTables(village);
    await playRaidActionAnimations(actionResult);
    clearPendingRaidDepartures(village);
    updateRaidTables(village);
    appendRaidActionLogs(actionResult?.logs);
    await waitRaidActionSettle();
    await checkCombatEndOfActions(village);
    updateRaidTables(village);
  } finally {
    settlingRaidVillages.delete(village);
    if (!village.isRaidFinalizing && !village.isRaidProcessDone) {
      setRaidActionButtonState(false, "次のステップ");
    }
  }
}

/** 1件のTRAP行動 */
function doOneTrapAction(action, village) {
  let p=action.actor;
  const result = createRaidActionResult(p);
  if (!p||p.hp<=0 || !canPerformRaidAction(p, ACTION_TRAP, village)) {
    addRaidActionLog(result, getRaidActionSkipMessage(p, ACTION_TRAP));
    return result;
  }
  if (village.raidEnemies.length===0) {
    addRaidActionLog(result, "【罠作成】敵は既に全滅");
    return result;
  }
  let e=selectTarget(p, village);
  if (!e) {
    addRaidActionLog(result, "【罠作成】狙える敵がいない");
    return result;
  }
  let dmg = Math.floor((p.dex*p.int/400)*30);
  dmg = applyIncomingDamageModifiers(dmg, e, village);
  const saltPillarShattered = applyRaidDamage(e, dmg);
  recordRaidFriendshipDamage(village, p, dmg);
  addRaidDamageAnimation(result, p, e, dmg, false, "罠発動");
  addRaidActionLog(result, `【罠作成】${p.name}→${e.name}に${dmg}ダメージ`);
  if (saltPillarShattered) addSaltPillarShatterLog(result, e);
  if (e.hp<=0) {
    addRaidActionLog(result, `　　→ ${e.name}は倒れた！`);
    addRaidDepartureAnimation(result, e, "撃退");
    recordDefeatedRaidEnemy(village, e);
    scheduleDefeatedEnemyDeparture(e);
  }
  return result;
}

/** 後衛行動後 -> 戦闘フェーズ */
export function setupCombatPhase(village) {
  const logDiv=document.getElementById("raidLogArea");

  village.raidPhase = RAID_PHASE_COMBAT;
  const isCombatStarting = !Number.isFinite(Number(village.raidTurnCount)) || village.raidTurnCount < 1;
  if (isCombatStarting) {
    village.raidTurnCount = 1;
  }

  let combatants = getVillageCombatants(village);
  let enemies   = getAliveEnemies(village);

  if (enemies.length===0) {
    finalizeRaid(true, "罠作成だけで撃退", village);
    return;
  }
  if (combatants.length===0) {
    finalizeRaid(false, "戦闘部隊なし(行動不能)", village);
    return;
  }
  if (hasSurvivedRaidTurns(village)) {
    finalizeRaidPartSuccess(village);
    return;
  }

  logDiv.innerHTML+=`<hr><br>【戦闘フェーズ】ターン ${village.raidTurnCount} 開始`;
  if (isCombatStarting) {
    getAliveEnemies(village)
      .filter(enemy => enemy.raidTargeting === RAID_TARGET_WEAKEST_HIGH_CHANCE)
      .forEach(enemy => {
        logDiv.innerHTML += `<br>【弱者狙い】${enemy.name}は体力の低い村人へ狙いを定めた！`;
      });
  }

  village.raidActionQueue=createCombatActions(village);
  village.currentActionIndex=0;
  updateRaidTables(village);
}

/** 行動順: 中衛の勇気降順 -> 前衛の勇気降順 -> 火砲の勇気降順 */
function createCombatActions(village) {
  const allUnits = getVillageCombatants(village).concat(getAliveEnemies(village));
  const middleUnits = sortByCourage(allUnits.filter(unit =>
    getCombatPosition(unit, village) === RAID_POSITION_MIDDLE && !isCannonUnit(unit, village)
  ));
  const frontUnits = sortByCourage(allUnits.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_FRONT));
  const cannonUnits = sortByCourage(allUnits.filter(unit => isCannonUnit(unit, village)));
  return middleUnits.concat(frontUnits, cannonUnits).map(unit => {
    const isWarLightPillar = village.currentRaid?.id === APOCALYPSE_GRAND_CRUSADE_ID &&
      village.raidTurnCount === WAR_LIGHT_PILLAR_TURN &&
      unit?.raiderType === APOCALYPSE_WAR_RAIDER_TYPE;
    const isConquestJudgmentLight = village.currentRaid?.id === APOCALYPSE_UPPER_WINGED_ID &&
      CONQUEST_JUDGMENT_LIGHT_TURNS.has(village.raidTurnCount) &&
      unit?.raiderType === APOCALYPSE_CONQUEST_RAIDER_TYPE;
    const type = isWarLightPillar
      ? "WAR_LIGHT_PILLAR"
      : (isConquestJudgmentLight ? "CONQUEST_JUDGMENT_LIGHT" : "COMBAT");
    return { type, actor:unit };
  });
}

/** 第六の災厄・7ターン目の《戦争》専用行動 */
function doWarLightPillarAction(action, village) {
  const actor = action.actor;
  const result = createRaidActionResult(actor);
  if (shouldSkipDefeatedEnemyAction(actor, village)) return result;

  const candidates = getVillageCombatants(village).filter(person => {
    const bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
    return Number(person.hp) > 0 &&
      !isSaltPillar(person) &&
      !bodyTraits.includes(TRAIT_CRITICAL) &&
      !bodyTraits.includes(TRAIT_EXPOSURE);
  });
  const target = randChoice(candidates);
  if (!target) {
    addRaidActionLog(result, `【光の柱】${actor.name}が裁きを下すべき村人は残っていない`);
    return result;
  }

  if (!Array.isArray(target.bodyTraits)) target.bodyTraits = [];
  applyRaidDamage(target, WAR_LIGHT_PILLAR_DAMAGE);
  target.bodyTraits.push(TRAIT_EXPOSURE);
  refreshJobTable(target, village);

  addRaidDamageAnimation(result, actor, target, WAR_LIGHT_PILLAR_DAMAGE, false, "光の柱");
  addRaidActionLog(result, `【光の柱】${actor.name}は天より光の柱を降ろし、${target.name}を焼いた！`);
  addRaidActionLog(result, `　　→ ${target.name}に固定${WAR_LIGHT_PILLAR_DAMAGE}ダメージ、身体特性「${TRAIT_EXPOSURE}」を付与`);
  if (target.hp <= 0) handleCombatDefeat(target, village, result);
  return result;
}

/** 第七の災厄・1／3ターン目の《支配》専用行動 */
function doConquestJudgmentLightAction(action, village) {
  const actor = action.actor;
  const result = createRaidActionResult(actor);
  if (shouldSkipDefeatedEnemyAction(actor, village)) return result;

  const isEthicsJudgment = village.raidTurnCount === 1;
  const statKey = isEthicsJudgment ? "eth" : "sexdr";
  const candidates = getVillageCombatants(village);
  if (candidates.length === 0) {
    addRaidActionLog(result, `【裁きの光】${actor.name}が裁きを下すべき村人は残っていない`);
    return result;
  }

  const values = candidates.map(person => Number(person?.[statKey]) || 0);
  const targetValue = isEthicsJudgment ? Math.min(...values) : Math.max(...values);
  const target = randChoice(candidates.filter(person => (Number(person?.[statKey]) || 0) === targetValue));
  const hasHolyAttackImmunity = Array.isArray(target?.bodyTraits) &&
    target.bodyTraits.includes(HOLY_ATTACK_IMMUNITY_TRAIT);
  const damage = hasHolyAttackImmunity ? 0 : CONQUEST_JUDGMENT_LIGHT_DAMAGE;

  applyRaidDamage(target, damage);
  addRaidDamageAnimation(result, actor, target, damage, false, "裁きの光");
  addRaidActionLog(result, `【裁きの光】「${isEthicsJudgment ? "邪悪なる者、滅ぶべし" : "姦淫する者、滅ぶべし"}」`);
  addRaidActionLog(result, isEthicsJudgment
    ? "最も倫理の低い村人に天の裁き！"
    : "最も好色の高い村人に天の裁き！");
  addRaidActionLog(result, hasHolyAttackImmunity
    ? `　　→ ${target.name}の光輪が聖なる攻撃を退け、ダメージを0にした`
    : `　　→ ${target.name}に固定${CONQUEST_JUDGMENT_LIGHT_DAMAGE}ダメージ`);
  if (target.hp <= 0) handleCombatDefeat(target, village, result);
  return result;
}

/** 1件のCOMBAT行動 */
function doOneCombatAction(action, village) {
  let actor=action.actor;
  const result = createRaidActionResult(actor);
  if (shouldSkipDefeatedEnemyAction(actor, village)) {
    return result;
  }
  if (!canActInCombat(actor, village)) {
    const actionLabel = isEnemyUnit(actor, village) ? "襲撃" : (actor?.action || "戦闘");
    addRaidActionLog(result, getRaidActionSkipMessage(actor, actionLabel, {
      ignoreRoleTraits: isEnemyUnit(actor, village)
    }));
    return result;
  }

  if (!isEnemyUnit(actor, village) && actor.action === ACTION_FORTIFY) {
    addRaidActionAnimation(result, actor, "籠城");
    addRaidActionLog(result, `【籠城】${actor.name}は木柵に身を寄せ、攻撃に備えた`);
    return result;
  }

  let target = selectTarget(actor, village);
  if (!target) {
    addRaidActionLog(result, `【戦闘】${actor.name}が狙える相手はいない`);
    return result;
  }

  const isRanged = getCombatPosition(actor, village) === RAID_POSITION_MIDDLE;
  const attackResult = isRanged ? calcRangedDamage(actor, target) : calcAttackDamage(actor, target, false);
  const label = getAttackLogLabel(actor, village, attackResult, isRanged);
  let dmg = attackResult.damage;
  dmg = applyOffensiveTraitModifiers(actor, dmg, label, result);
  dmg = applyIncomingDamageModifiers(dmg, target, village);

  const atkTypeText = attackResult.attackText;
  const saltPillarShattered = applyRaidDamage(target, dmg);
  if (!isEnemyUnit(actor, village)) {
    recordRaidFriendshipDamage(village, actor, dmg);
  }
  addRaidDamageAnimation(result, actor, target, dmg, false, getAttackActionPopLabel(attackResult, isRanged));
  addRaidActionLog(result, `${label}${actor.name}の${atkTypeText}→${target.name}に ${dmg}ダメージ`);
  if (saltPillarShattered) addSaltPillarShatterLog(result, target);

  if (target.hp<=0) {
    handleCombatDefeat(target, village, result);
  } else if (!isRanged && canCounterAttack(target, village)) {
    doCounterAttack(target, actor, village, result);
  }
  return result;
}

function canActInCombat(actor, village) {
  if (!actor || actor.hp <= 0) return false;
  if (isEnemyUnit(actor, village)) {
    return getAliveEnemies(village).includes(actor) &&
      !getRaidActionBlockReason(actor, "襲撃", { ignoreRoleTraits: true });
  }
  return isRaidCombatAction(actor.action) && canPerformRaidAction(actor, actor.action, village);
}

function calcRangedDamage(atk, def) {
  if (atk?.action === ACTION_CANNON) {
    return {
      damage: Math.max(0, Math.floor(((atk.mag * atk.int) / 400) * 20)),
      isMagic: true,
      attackText: ACTION_CANNON
    };
  }
  if (atk?.raidAttackType === RAID_ATTACK_RANGED_MAGIC) {
    return {
      damage: Math.max(0, Math.floor(((atk.mag * atk.cou) / 400) * 20)),
      isMagic: true,
      attackText: "遠距離魔法"
    };
  }
  const damage = Math.floor(((atk.dex * atk.cou) / 400) * 40 - def.vit * 1.5);
  return {
    damage: Math.max(0, damage),
    isMagic: false,
    attackText: "射撃"
  };
}

function getAttackLogLabel(actor, village, attackResult, isRanged) {
  if (isEnemyUnit(actor, village) && attackResult?.attackText === "遠距離魔法") return "【敵の攻撃】";
  if (isEnemyUnit(actor, village)) return isRanged ? "【敵の射撃】" : "【敵の攻撃】";
  if (attackResult?.attackText === ACTION_CANNON) return `【${ACTION_CANNON}】`;
  return isRanged ? "【射撃】" : "【迎撃】";
}

function getAttackActionPopLabel(attackResult, isRanged) {
  if (attackResult?.attackText === "遠距離魔法") return "遠距離魔法";
  if (attackResult?.attackText === ACTION_CANNON) return ACTION_CANNON;
  if (attackResult?.isMagic) return "魔法で攻撃";
  return isRanged ? "射撃" : "攻撃";
}

function applyOffensiveTraitModifiers(actor, damage, label, result) {
  let nextDamage = damage;
  if (hasTrait(actor, "歴戦")) {
    nextDamage = Math.floor(nextDamage * 1.2);
    addRaidActionLog(result, `${label}${actor.name}は歴戦の経験で強力な攻撃！`);
  } else if (hasTrait(actor, "戦慣れ")) {
    nextDamage = Math.floor(nextDamage * 1.1);
    addRaidActionLog(result, `${label}${actor.name}は戦慣れした動きで攻め込む！`);
  }

  if (hasTrait(actor, "非戦主義")) {
    nextDamage = 0;
    addRaidActionLog(result, `${label}${actor.name}は非戦主義のため攻撃を拒否！`);
  }
  if (hasTrait(actor, "不殺")) {
    nextDamage = 0;
    addRaidActionLog(result, `${label}${actor.name}は不殺の誓いにより攻撃を止めた！`);
  }
  return nextDamage;
}

/** 籠城の被ダメージ倍率。表示と計算で同じ値を使う。 */
function getFortifyDamageMultiplier(village) {
  return hasMoatDefense(village) ? 0.7 : 0.8;
}

function applyIncomingDamageModifiers(damage, target, village) {
  let multiplier = 1;
  if (isEnemyUnit(target, village)) {
    multiplier *= getRaiderIncomingDamageMultiplier(target);
  }
  if (getCombatPosition(target, village) === RAID_POSITION_MIDDLE) {
    multiplier *= isCannonUnit(target, village) ? 1.5 : 1.2;
  }
  if (!isEnemyUnit(target, village) && target.action === ACTION_FORTIFY) {
    multiplier *= getFortifyDamageMultiplier(village);
  }
  return Math.max(0, Math.floor(damage * multiplier));
}

function canCounterAttack(target, village) {
  return getCombatPosition(target, village) === RAID_POSITION_FRONT;
}

function doCounterAttack(counterActor, target, village, result) {
  let ret=calcAttackDamage(counterActor, target, true);
  let rdmg=Math.floor(ret.damage*0.5);
  rdmg = applyIncomingDamageModifiers(rdmg, target, village);
  let retTypeText=ret.isMagic? "魔法攻撃":"物理攻撃";
  const saltPillarShattered = applyRaidDamage(target, rdmg);
  addRaidDamageAnimation(result, counterActor, target, rdmg, true, ret.isMagic ? "魔法で反撃" : "反撃");
  addRaidActionLog(result, `　　→ 反撃(${retTypeText}):${counterActor.name}→${target.name}に${rdmg}ダメージ`);
  if (saltPillarShattered) addSaltPillarShatterLog(result, target);
  if (target.hp<=0) {
    handleCombatDefeat(target, village, result);
  }
}

function handleCombatDefeat(target, village, result) {
  if (isEnemyUnit(target, village)) {
    addRaidActionLog(result, `　　→ ${target.name}は倒れた！`);
    addRaidDepartureAnimation(result, target, "撃退");
    recordDefeatedRaidEnemy(village, target);
    scheduleDefeatedEnemyDeparture(target);
    return;
  }
  addRaidActionLog(result, `　　→ ${target.name}は負傷離脱(HP0)`);
  if (!target.bodyTraits.includes(TRAIT_INJURED)) target.bodyTraits.push(TRAIT_INJURED);
  addRaidDepartureAnimation(result, target, "負傷離脱");
  markRaidDeparture(target);
}

function calcAttackDamage(atk, def, isCounter) {
  let phys = ((atk.str*atk.cou)/400)*50 - def.vit;
  let mag  = ((atk.mag*atk.cou)/400)*25;
  phys=Math.floor(phys);
  mag=Math.floor(mag);
  if (phys<0) phys=0;
  if (mag<0) mag=0;

  let finalDamage=0;
  let usedMagic=false;
  if (phys>=mag) {
    finalDamage=phys;
  } else {
    finalDamage=mag;
    usedMagic=true;
  }
  return {
    damage: Math.floor(finalDamage),
    isMagic: usedMagic,
    attackText: usedMagic ? "魔法攻撃" : "物理攻撃"
  };
}

/** 全アクション完了後にターン終了 */
function finalizeCombatTurn(village) {
  let logDiv=document.getElementById("raidLogArea");

  let combatants = getVillageCombatants(village);
  let enemies   = getAliveEnemies(village);

  if (combatants.length===0) {
    finalizeRaid(false, "戦闘部隊全滅", village);
    return;
  }
  if (enemies.length===0) {
    finalizeRaid(true, "敵全滅", village);
    return;
  }

  village.raidTurnCount++;
  if (hasSurvivedRaidTurns(village)) {
    finalizeRaidPartSuccess(village);
  } else {
    setupCombatPhase(village);
  }
}

/** 全員の行動終了時に敵 or 迎撃側が全滅したかどうか確認 */
async function checkCombatEndOfActions(village) {
  let enemies   = getAliveEnemies(village);
  const rearPhaseComplete = village.raidPhase === RAID_PHASE_REAR &&
    village.currentActionIndex >= village.raidActionQueue.length;

  if (rearPhaseComplete) {
    await playRearDepartureAnimations(village);
  }

  if (enemies.length===0) {
    finalizeRaid(true, "敵全滅", village);
    return;
  }
  if (village.raidPhase === RAID_PHASE_REAR) {
    if (village.currentActionIndex < village.raidActionQueue.length) {
      return;
    }
    setupCombatPhase(village);
    return;
  }

  let combatants = getVillageCombatants(village);
  if (combatants.length===0) {
    finalizeRaid(false, "戦闘部隊全滅", village);
    return;
  }

  if (village.currentActionIndex < village.raidActionQueue.length) {
    return; // まだ行動が残ってる
  }
  finalizeCombatTurn(village);
}

/** (完全)成功 or 失敗 */
function finalizeRaid(isSuccess, reason, village, options = {}) {
  village.log(`【襲撃結果】${isSuccess?"防衛成功":"防衛失敗"} : ${reason}`);
  let rlog=document.getElementById("raidLogArea");
  rlog.innerHTML+=`<br>→ 襲撃結果: ${isSuccess?"防衛成功":"失敗"} (${reason})<br>モーダルを閉じます...`;
  scrollRaidLogToLatest();

  endRaidProcess(isSuccess, false, village, { ...options, resultReason: reason });
}

/** 指定ターン粘って撤退(部分成功) */
function finalizeRaidPartSuccess(village) {
  const surviveTurns = getRaidSurviveTurns(village) || 5;
  village.log(`【襲撃結果】${surviveTurns}ターン粘って敵撤退→部分的成功`);
  let rlog=document.getElementById("raidLogArea");
  rlog.innerHTML+=`<br>→ 襲撃結果: 敵撤退(部分成功)<br>モーダルを閉じます...`;
  scrollRaidLogToLatest();

  endRaidProcess(true, true, village, { resultReason: "敵撤退" });
}

/** 襲撃終了処理 */
function endRaidProcess(isSuccess, isPartSuccess, village, options = {}) {
  if (village.isRaidFinalizing || village.isRaidProcessDone) return;

  const completedRaidId = village.currentRaid?.id || "";
  village.isRaidFinalizing = true;
  village.isRaidProcessDone = true;
  village.raidActionQueue = [];
  village.raidPhase = "";
  village.currentActionIndex = 0;
  setRaidActionButtonState(true, "終了処理中...");
  const nextTurnButton = document.getElementById("nextTurnButton");
  if (nextTurnButton) {
    nextTurnButton.disabled = true;
  }

  village.log(`[DEBUG] 襲撃結果 成功:${isSuccess} 部分成功:${isPartSuccess}`);
  const closeDelayMs = Number.isFinite(Number(options.closeDelayMs))
    ? Math.max(0, Number(options.closeDelayMs))
    : RAID_CLOSE_DELAY_MS;

  setTimeout(()=>{
    closeRaidModal();
    let idx=village.villageTraits.indexOf("襲撃中");
    if (idx>=0) {
      village.villageTraits.splice(idx,1);
    }
    // 結果モーダル用の集計。敵リストの破棄や敗北ペナルティで情報が消える前に行う。
    const resultInfo = collectRaidResultInfo(village, isSuccess, isPartSuccess, options.resultReason);
    if (isSuccess && !isPartSuccess) {
      resultInfo.capturedName = tryCaptureRaidPrisoner(village)?.name || "";
    }
    village.raidEnemies=[];
    clearDefeatedRaidEnemies(village);

    // 襲撃者一覧セクションを非表示に
    const raidSection = document.getElementById("raidEnemiesSection");
    if (raidSection) {
      raidSection.style.display = "none";
    }

    const raidRules = getActiveRaidRules(village);
    if (isSuccess) {
      const happinessGain = Number(isPartSuccess
        ? raidRules.successRewards?.partialHappiness
        : raidRules.successRewards?.completeHappiness) || 0;
      if (happinessGain !== 0) {
        village.villagers.forEach(p=>{
          if (isSaltPillar(p)) return;
          p.happiness=clampValue(p.happiness+happinessGain,0,100);
        });
      }
      const divineGain = isPartSuccess ? 1 : 5;
      addDivineMight(village, divineGain);
      resultInfo.happinessGain = happinessGain;
      resultInfo.divineGain = divineGain;
      village.log(isPartSuccess
        ? `防衛成功(部分):村人幸福+${happinessGain},神威+${divineGain}`
        : `防衛成功(敵全滅):村人幸福+${happinessGain},神威+${divineGain}`);
    } else {
      const penalty = calculateRaidFailurePenalty(village);

      village.food=clampValue(village.food - penalty.foodLoss,0,99999);
      village.materials=clampValue(village.materials - penalty.materialsLoss,0,99999);
      village.funds=clampValue(village.funds - penalty.fundsLoss,0,99999);
      village.mana=clampValue(village.mana - penalty.manaLoss,0,99999);
      village.security=clampValue(village.security - penalty.securityLoss,0,100);

      village.villagers.forEach(p=>{
        if (isSaltPillar(p)) return;
        if (penalty.hpMax > 0) {
          p.hp=clampValue(p.hp - randInt(penalty.hpMin, penalty.hpMax),0,100);
        }
        if (penalty.happinessLoss !== 0) {
          p.happiness=clampValue(p.happiness - penalty.happinessLoss,0,100);
        }
      });

      resultInfo.penaltyLines = [
        penalty.foodLoss > 0 ? `食料-${penalty.foodLoss}` : "",
        penalty.materialsLoss > 0 ? `資材-${penalty.materialsLoss}` : "",
        penalty.fundsLoss > 0 ? `資金-${penalty.fundsLoss}` : "",
        penalty.manaLoss > 0 ? `魔素-${penalty.manaLoss}` : "",
        penalty.securityLoss > 0 ? `治安-${penalty.securityLoss}` : "",
        penalty.hpMax > 0 ? `村人HP-${penalty.hpMin}~${penalty.hpMax}` : "",
        penalty.happinessLoss > 0 ? `幸福-${penalty.happinessLoss}` : "",
        penalty.buildingDamage ? "建築損壊あり" : "",
        penalty.goldenStatueDamage ? "バッカスの黄金像損壊" : "",
        penalty.severeInjury ? "重体判定あり" : ""
      ].filter(Boolean);
      const penaltyLog = resultInfo.penaltyLines.join(",") || "追加被害なし";
      village.log(`迎撃失敗:${penaltyLog}`);
      if (penalty.buildingDamage) {
        damageRandomBuilding(village);
      }
    }

    const severeInjuryResult = rollRaidSevereInjuryCheck(village, raidRules);
    applyRaidFriendshipResults(village);
    handleApocalypseRaidResult(village, completedRaidId, isSuccess);
    village.isRaidProcessDone=true;
    village.currentRaid = null;

    // nextTurnButton の表示を戻す
    let btn=document.getElementById("nextTurnButton");
    if (btn) {
      btn.textContent="次の月へ";
      btn.disabled = false;
    }
    let autoAssignBtn = document.getElementById("autoAssignButton");
    if (autoAssignBtn) {
      autoAssignBtn.textContent = "自動割り振り";
    }
    const raidAssignBtn = document.getElementById("raidAssignButton");
    if (raidAssignBtn) {
      raidAssignBtn.style.display = "none";
    }

    // 襲撃終了後、その月の残り処理を実行→次月へ
    // 村人行動
    handleAllVillagerJobs(village);
    doFixedEventPost(village);
    // 月末
    endOfMonthProcess(village);

    if (village.villagers.length===0) {
      village.log("村人全滅→ゲームオーバー");
      village.gameOver=true;
      village.isRaidFinalizing = false;
      updateUI(village);
      showRaidResultModal(resultInfo);
      return;
    }

    village.month++;
    if (village.month>12) {
      village.month=1;
      village.year++;
    }

    village.hasDonePreEvent=false;
    village.hasDonePostEvent=false;
    village.log(`=== ${village.year}年${village.month}月 ===`);

    if (village.month===1) {
      doAgingProcess(village);
    }
    runMonthStartPhase(village);
    if (!village.battleDebugMode) {
      applyRaidSevereInjuryResult(village, severeInjuryResult);
    }

    village.isRaidFinalizing = false;
    updateUI(village);
    showRaidResultModal(resultInfo);

  }, closeDelayMs);
}

/** 結果モーダル用の集計。敵リスト破棄・敗北ペナルティ適用の前に呼ぶこと。 */
function collectRaidResultInfo(village, isSuccess, isPartSuccess, resultReason = "") {
  const enemies = Array.isArray(village.raidEnemies) ? village.raidEnemies : [];
  const defeatedEnemies = [...new Set([
    ...(Array.isArray(village.defeatedRaidEnemies) ? village.defeatedRaidEnemies : []),
    ...enemies.filter(enemy => Number(enemy.hp) <= 0)
  ])];
  const survivingCount = enemies.filter(enemy => Number(enemy.hp) > 0).length;

  const participantNames = Array.isArray(village.raidFriendshipParticipants)
    ? village.raidFriendshipParticipants
    : [];
  const fallenNames = participantNames.filter(name => {
    const person = village.villagers.find(v => v.name === name);
    return person && Number(person.hp) <= 0;
  });

  let mvp = null;
  if (isSuccess) {
    const damageEntries = Object.entries(village.raidFriendshipDamage || {})
      .filter(([, damage]) => Number(damage) > 0);
    if (damageEntries.length > 0) {
      const topDamage = Math.max(...damageEntries.map(([, damage]) => Number(damage)));
      const topNames = damageEntries
        .filter(([, damage]) => Number(damage) === topDamage)
        .map(([name]) => name);
      mvp = {
        damage: topDamage,
        people: topNames.map(name => {
          const person = village.villagers.find(v => v.name === name);
          return { name, portrait: person ? getPortraitPath(person) : "" };
        })
      };
    }
  }

  return {
    isSuccess,
    isPartSuccess,
    resultReason: String(resultReason || ""),
    defeatedCount: defeatedEnemies.length,
    survivingCount,
    fallenNames,
    mvp,
    capturedName: "",
    happinessGain: 0,
    divineGain: 0,
    penaltyLines: []
  };
}

const RAID_RESULT_MODAL_ID = "raidResultModal";
const RAID_RESULT_OVERLAY_ID = "raidResultOverlay";

// ログ用の内部理由を、そのままプレイヤーへ見せられる言い回しへ置き換える。
const RAID_RESULT_REASON_TEXTS = {
  "敵全滅": "襲撃者を全滅させた",
  "罠作成だけで撃退": "罠だけで追い払った",
  "敵撤退": "襲撃者が引き揚げた",
  "戦闘部隊0": "迎撃できる村人がいなかった",
  "戦闘部隊なし(行動不能)": "戦える村人がいなくなった",
  "戦闘部隊全滅": "迎撃隊が壊滅した",
  "撤退": "撤退を選んだ"
};

function escapeRaidResultText(value) {
  return String(value ?? "").replace(/[&<>"]/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]
  ));
}

/** 襲撃の結末をまとめて示すモーダル。閉じるだけで、状態は一切変更しない。 */
function showRaidResultModal(info) {
  if (!info || typeof document === "undefined") return;
  document.getElementById(RAID_RESULT_OVERLAY_ID)?.remove();
  document.getElementById(RAID_RESULT_MODAL_ID)?.remove();

  const title = !info.isSuccess
    ? "防衛失敗"
    : (info.isPartSuccess ? "防衛成功（敵撤退）" : "防衛成功");
  const reasonText = RAID_RESULT_REASON_TEXTS[info.resultReason] || info.resultReason;
  const lines = [];

  let enemyText;
  if (!info.isSuccess) {
    // 失敗時は残った敵が引き揚げたわけではないので、撃退できなかった側を主語にする。
    enemyText = info.survivingCount > 0
      ? (info.defeatedCount > 0
        ? `襲撃者${info.defeatedCount}体を撃退したが、${info.survivingCount}体を防ぎきれなかった`
        : `襲撃者${info.survivingCount}体を防ぎきれなかった`)
      : `襲撃者${info.defeatedCount}体を撃退したが、村を守りきれなかった`;
  } else {
    enemyText = info.survivingCount > 0
      ? `襲撃者${info.defeatedCount}体を撃退し、${info.survivingCount}体が引き揚げた`
      : `襲撃者${info.defeatedCount}体を撃退した`;
  }
  lines.push(escapeRaidResultText(enemyText));

  if (info.fallenNames.length > 0) {
    lines.push(escapeRaidResultText(`負傷離脱: ${info.fallenNames.join("、")}`));
  }
  if (info.isSuccess) {
    lines.push(escapeRaidResultText(`村人の幸福+${info.happinessGain}、神威+${info.divineGain}`));
  }
  if (info.capturedName) {
    lines.push(escapeRaidResultText(`${info.capturedName}を捕虜として収容した`));
  }
  info.penaltyLines.forEach(line => lines.push(escapeRaidResultText(line)));

  const mvpHtml = info.mvp
    ? `<div class="raid-result-mvp">
        <div class="raid-result-mvp-label">殊勲</div>
        ${info.mvp.people.map(person => `
          <div class="raid-result-mvp-person">
            ${person.portrait ? `<img src="${escapeRaidResultText(person.portrait)}" alt="">` : ""}
            <span>${escapeRaidResultText(person.name)}</span>
          </div>`).join("")}
        <div class="raid-result-mvp-damage">与ダメージ ${Math.floor(info.mvp.damage)}</div>
      </div>`
    : "";

  const overlay = document.createElement("div");
  overlay.id = RAID_RESULT_OVERLAY_ID;
  overlay.className = "event-modal-overlay raid-result-overlay";

  const modal = document.createElement("div");
  modal.id = RAID_RESULT_MODAL_ID;
  modal.className = "event-modal raid-result-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="event-modal-body">
      <h3>${escapeRaidResultText(title)}${reasonText ? `<span class="raid-result-reason">${escapeRaidResultText(reasonText)}</span>` : ""}</h3>
      ${mvpHtml}
      ${lines.map(line => `<p>${line}</p>`).join("")}
      <div class="event-modal-buttons">
        <button type="button" data-close-raid-result>閉じる</button>
      </div>
    </div>
  `;

  const close = () => {
    overlay.remove();
    modal.remove();
  };
  modal.querySelector("[data-close-raid-result]").onclick = close;
  overlay.onclick = close;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-raid-result]")?.focus();
}

/** モーダルを閉じる */
export function closeRaidModal() {
  document.getElementById("raidOverlay").style.display="none";
  document.getElementById("raidModal").style.display="none";
}

/**
 * 肉体交換(雷/奇跡)
 *  - isLightning=true の場合はログを簡略化
 */
/** 迎撃画面更新 */
export function updateRaidTables(village) {
  const trapMakers = getVisibleTrapMakers(village);
  const activeMiddleliners = getActiveRaidMiddleliners(village);
  const pendingMiddleliners = village.villagers.filter(v =>
    isPendingRaidDeparture(v) && RAID_MIDDLE_ACTIONS.includes(v.action)
  );
  const middleliners = activeMiddleliners.concat(pendingMiddleliners.filter(v => !activeMiddleliners.includes(v)));
  const activeFrontliners = getActiveRaidFrontliners(village);
  const pendingFrontliners = village.villagers.filter(v =>
    isPendingRaidDeparture(v) && (v.action === ACTION_DEFEND || v.action === ACTION_FORTIFY)
  );
  const frontliners = activeFrontliners.concat(pendingFrontliners.filter(v => !activeFrontliners.includes(v)));

  renderRaidUnits({
    tableSelector: "#defenderTable tbody",
    sectionId: "raidRearSection",
    units: trapMakers,
    village
  });
  renderRaidUnits({
    tableSelector: "#shootersTable tbody",
    sectionId: "raidMiddleSection",
    units: middleliners,
    village
  });
  renderRaidUnits({
    tableSelector: "#raidersTable tbody",
    sectionId: "raidFrontSection",
    units: frontliners,
    village
  });
  renderEnemyRaidUnits(village);
  updateRaidStatusLine(village);
  scrollRaidLogToLatest();
}

function setRaidSectionVisible(sectionId, visible) {
  const section = document.getElementById(sectionId);
  if (section) section.style.display = visible ? "" : "none";
}

function renderRaidUnits({ tableSelector, sectionId = "", units, village }) {
  const tbody = document.querySelector(tableSelector);
  if (!tbody) return;

  const rows = Array.isArray(units) ? units : [];
  if (sectionId) setRaidSectionVisible(sectionId, rows.length > 0);
  tbody.innerHTML = "";
  rows.forEach(unit => {
    tbody.appendChild(createRaidUnitRow(unit, village));
  });
}

function renderEnemyRaidUnits(village) {
  const rows = Array.isArray(village?.raidEnemies)
    ? village.raidEnemies.filter(unit => unit.hp > 0 || isPendingRaidDeparture(unit))
    : [];
  const front = rows.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_FRONT);
  const middle = rows.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_MIDDLE);
  renderRaidUnits({
    tableSelector: "#enemyFrontTable tbody",
    sectionId: "enemyFrontSection",
    units: front,
    village
  });
  renderRaidUnits({
    tableSelector: "#enemyMiddleTable tbody",
    sectionId: "enemyMiddleSection",
    units: middle,
    village
  });
}

function createRaidUnitRow(unit, village = null) {
  const row = document.createElement("tr");
  if (unit?.raiderType === "黙示録の騎士・支配") row.classList.add("apocalypse-conquest-row");
  if (unit?.raiderType === "黙示録の騎士・戦争") row.classList.add("apocalypse-war-row");
  row.dataset.raidUnitId = getRaidUnitRenderId(unit);
  if (isPendingRaidDeparture(unit)) row.classList.add("is-leaving");
  if (isRearRetreatingUnit(unit, village)) {
    row.classList.add("is-leaving", "is-retreating");
  }
  appendRaidPortraitCell(row, unit);
  appendRaidNameCell(row, unit, village);
  appendRaidValueCell(row, unit?.hp, "raid-unit-hp", Number(unit?.hp) <= 33);
  appendRaidValueCell(row, unit?.mp, "raid-unit-mp", Number(unit?.mp) <= 33);
  appendRaidStatSummaryCell(row, unit);
  return row;
}

function appendRaidPortraitCell(row, unit) {
  const cell = document.createElement("td");
  cell.className = "raid-portrait-cell";

  const frame = document.createElement("div");
  frame.className = "raid-portrait-frame";

  const portrait = document.createElement("img");
  portrait.src = getPortraitPath(unit);
  portrait.alt = unit?.name || "";
  portrait.loading = "lazy";

  frame.appendChild(portrait);
  cell.appendChild(frame);
  row.appendChild(cell);
}

function appendRaidNameCell(row, unit, village = null) {
  const cell = document.createElement("td");
  cell.className = "raid-unit-name";

  const title = document.createElement("span");
  title.className = "raid-unit-title";
  title.textContent = unit?.name || "";
  cell.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "raid-unit-meta";

  if (unit?.action) {
    const action = document.createElement("span");
    action.className = "raid-unit-action";
    action.textContent = unit.action;
    meta.appendChild(action);
  }

  // 籠城・火砲は見た目に効果が出ないため、実際の被ダメージ倍率を添える。
  if (unit?.action === ACTION_FORTIFY && village && !isEnemyUnit(unit, village)) {
    const note = document.createElement("span");
    note.className = "raid-unit-action-note";
    note.textContent = `被弾${getFortifyDamageMultiplier(village)}倍`;
    meta.appendChild(note);
  }
  if (village && isCannonUnit(unit, village)) {
    const note = document.createElement("span");
    note.className = "raid-unit-action-note";
    note.textContent = "被弾1.5倍";
    meta.appendChild(note);
  }

  getRaidVisibleEffects(unit).forEach(effectName => {
    const effect = document.createElement("span");
    effect.className = "raid-unit-effect";
    effect.textContent = effectName;
    meta.appendChild(effect);
  });

  cell.appendChild(meta);
  row.appendChild(cell);
}

function getRaidVisibleEffects(unit) {
  const sources = [unit?.raidEffects, unit?.statusEffects, unit?.buffs, unit?.debuffs];
  const names = [];
  if (unit?.raidTargeting === RAID_TARGET_WEAKEST_HIGH_CHANCE) names.push("弱者狙い");
  sources.forEach(source => {
    if (!Array.isArray(source)) return;
    source.forEach(effect => {
      const name = typeof effect === "string" ? effect : effect?.name || effect?.label;
      if (name && !names.includes(name)) names.push(name);
    });
  });
  return names;
}

function appendRaidValueCell(row, value, className = "", isLow = false) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  if (isLow) cell.classList.add("is-low");
  cell.textContent = Math.floor(Number(value) || 0);
  row.appendChild(cell);
}

function formatRaidStat(label, value) {
  return `${label}${Math.floor(Number(value) || 0)}`;
}

function appendRaidStatValue(line, label, value) {
  if (line.childNodes.length > 0) line.appendChild(document.createTextNode(" "));
  const stat = document.createElement("span");
  stat.className = "raid-stat-value";
  if (Number(value) >= 20) stat.classList.add("is-high");
  stat.textContent = formatRaidStat(label, value);
  line.appendChild(stat);
}

function appendRaidStatLine(line, stats) {
  stats.forEach(([label, value]) => {
    appendRaidStatValue(line, label, value);
  });
}

function appendRaidStatSummaryCell(row, unit) {
  const cell = document.createElement("td");
  cell.className = "raid-stat-summary";

  const bodyLine = document.createElement("span");
  bodyLine.className = "raid-stat-line";
  appendRaidStatLine(bodyLine, [
    ["筋", unit?.str],
    ["耐", unit?.vit],
    ["器", unit?.dex],
    ["魔", unit?.mag],
    ["魅", unit?.chr]
  ]);

  const mindLine = document.createElement("span");
  mindLine.className = "raid-stat-line";
  appendRaidStatLine(mindLine, [
    ["知", unit?.int],
    ["勤", unit?.ind],
    ["倫", unit?.eth],
    ["勇", unit?.cou],
    ["色", unit?.sexdr]
  ]);

  cell.appendChild(bodyLine);
  cell.appendChild(mindLine);
  row.appendChild(cell);
}

// 戦闘ダメージを受けた際の処理を追加
function applyDamage(target, damage, village) {
  target.hp = Math.max(0, target.hp - damage);

  // HP0以下になった場合の処理
  if (target.hp <= 0) {
    // 村人の場合（襲撃者でない場合）の処理
    if (!target.mindTraits.includes("襲撃者")) {
      // 負傷特性を追加
      if (!target.bodyTraits.includes("負傷")) {
        target.bodyTraits.push("負傷");
      }
      // ログ出力
      village.log(`${target.name}は重傷を負い、戦闘から離脱した`);
    }
  }
}

// 戦闘処理の部分を修正
function executeCombatAction(action, village) {
  let rlog = document.getElementById("raidLogArea");

  switch(action.type) {
    case "ATTACK": {
      let atk = action.attacker;
      let def = action.defender;
      let dmg = calcDamage(atk, def);

      // ダメージ適用を関数化した処理に変更
      applyDamage(def, dmg.damage, village);

      rlog.innerHTML += `<br>${atk.name} → ${def.name} : ${dmg.damage}ダメージ`;
      if (def.hp <= 0) {
        rlog.innerHTML += `<br>${def.name}は戦闘不能！`;
      }
      break;
    }
    // ... 他のケース ...
  }

  updateRaidTables(village);
  checkCombatEndOfActions(village);
}
