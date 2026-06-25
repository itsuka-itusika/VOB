import { isForcedHealingAction } from "../util.js";
import { hasActiveBuildingFlag } from "./buildingState.js";
import {
  ACTION_DEFEND,
  ACTION_FORTIFY,
  ACTION_SHOOT,
  ACTION_TRAP,
  RAID_ACTIONS,
  canDefendInRaid,
  canFortifyInRaid,
  canMakeTrapInRaid,
  canShootInRaid
} from "../raidRules.js";
import { syncEffectiveStats } from "./statLayers.js";
import { FOUR_LEGGED_TRAIT, isWolf, WILD_MIND_TRAIT, YOUNG_WOLF_TRAIT } from "./speciesTraits.js";

export const ACTION_NONE = "なし";
export const ACTION_REST = "休養";
export const ACTION_LEISURE = "余暇";
export const ACTION_HEAL = "療養";
export const ACTION_LAST_MOMENTS = "臨終";
export const ACTION_CRADLE = "揺籃";
export const ACTION_MASSAGE_MALE = "あんま男";
export const ACTION_MASSAGE_FEMALE = "あんま女";
export const MASSAGE_ACTIONS = [ACTION_MASSAGE_MALE, ACTION_MASSAGE_FEMALE];

const TEMPORARY_ACTIONS = new Set([ACTION_REST, ACTION_LEISURE]);
const FORCED_ACTIONS = new Set([ACTION_HEAL, ACTION_LAST_MOMENTS]);
const NON_PREFERRED_ACTIONS = new Set([
  ACTION_NONE,
  ACTION_REST,
  ACTION_LEISURE,
  ACTION_HEAL,
  ACTION_LAST_MOMENTS,
  ACTION_DEFEND,
  ACTION_FORTIFY,
  ACTION_SHOOT,
  ACTION_TRAP,
  "訪問",
  "襲撃",
  "虜囚"
]);
const INFANT_BODY_ALLOWED_ACTIONS = new Set([
  ACTION_REST,
  ACTION_LEISURE,
  "遊び",
  "お手伝い",
  "採集",
  "内職",
  "研究",
  "研究助手"
]);
const SACRED_BLOCKED_ADULT_ACTIONS = new Set(["踊り子", "バニー", ...MASSAGE_ACTIONS, "巫女"]);
const CIVILIZATION_AVOIDANT_BLOCKED_ACTIONS = new Set([
  "内職",
  "行商",
  "研究",
  "写本",
  "錬金術",
  "醸造",
  "機織り",
  "バニー"
]);
const NO_KILLING_BLOCKED_ACTIONS = new Set([
  "農作業",
  "狩猟",
  "漁",
  "伐採",
  "醸造"
]);
const HALF_HORSE_BLOCKED_ACTIONS = new Set([
  "内職",
  "写本",
  "機織り",
  ...MASSAGE_ACTIONS
]);
const FOUR_LEGGED_BLOCKED_ACTIONS = new Set([
  "農作業",
  "伐採",
  "漁",
  "内職",
  "行商",
  "丁稚",
  "研究",
  "研究助手",
  "写本",
  "機織り",
  "錬金術",
  "看護",
  ...MASSAGE_ACTIONS,
  "踊り子",
  "バニー",
  "巫女",
  "醸造"
]);
const WILD_BLOCKED_ACTIONS = new Set([
  "農作業",
  "採集",
  "伐採",
  "漁",
  "内職",
  "行商",
  "丁稚",
  "研究",
  "研究助手",
  "写本",
  "機織り",
  "錬金術",
  "醸造",
  "看護",
  ACTION_MASSAGE_MALE,
  "シスター",
  "神官",
  "詩人"
]);

function traitList(person, key) {
  return Array.isArray(person?.[key]) ? person[key] : [];
}

export function getMassageActionForPerson(person) {
  return person?.bodySex === "男" ? ACTION_MASSAGE_MALE : ACTION_MASSAGE_FEMALE;
}

export function normalizeActionForPerson(action, person) {
  const value = String(action || "").trim();
  return value === "あんま" ? getMassageActionForPerson(person) : value;
}

function hasInfantMind(person) {
  const mindTraits = traitList(person, "mindTraits");
  return mindTraits.includes("無垢") || (Number(person?.spiritAge) || 0) <= 3;
}

function hasInfantBody(person) {
  const bodyTraits = traitList(person, "bodyTraits");
  if (bodyTraits.includes("赤子")) return true;
  if (isWolf(person)) return false;
  return (Number(person?.bodyAge) || 0) <= 3;
}

function getRawPreferredAction(person) {
  const explicit = normalizeActionForPerson(person?.preferredAction, person);
  if (explicit) return explicit;

  const legacyJob = normalizeActionForPerson(person?.job, person);
  if (isPreferredActionCandidate(legacyJob)) return legacyJob;

  const currentAction = normalizeActionForPerson(person?.action, person);
  if (isPreferredActionCandidate(currentAction)) return currentAction;

  return ACTION_NONE;
}

export function isTemporaryAction(action) {
  return TEMPORARY_ACTIONS.has(action);
}

export function isForcedFixedAction(action) {
  return FORCED_ACTIONS.has(action) || action === ACTION_CRADLE;
}

export function isPreferredActionCandidate(action) {
  const value = String(action || "").trim();
  return !!value && !NON_PREFERRED_ACTIONS.has(value);
}

export function setPreferredAction(person, action) {
  if (!person) return;
  const normalizedAction = normalizeActionForPerson(action, person);
  const next = isPreferredActionCandidate(normalizedAction) ? normalizedAction : ACTION_NONE;
  person.preferredAction = next;
  // 旧セーブ・旧コード互換。UI上の「仕事」は廃止するが、内部参照の退避先として同期する。
  person.job = next;
}

function setTables(person, preferredTable, actionTable) {
  person.jobTable = [...preferredTable];
  person.actionTable = [...actionTable];
}

function applyInfantBodyActionFilter(person) {
  if (!hasInfantBody(person)) return;
  person.jobTable = person.jobTable.filter(action => INFANT_BODY_ALLOWED_ACTIONS.has(action));
  person.actionTable = person.actionTable.filter(action => INFANT_BODY_ALLOWED_ACTIONS.has(action));
}

function applyCivilizationAvoidanceFilter(person) {
  if (!traitList(person, "mindTraits").includes("文明忌避")) return;
  person.jobTable = person.jobTable.filter(action => !CIVILIZATION_AVOIDANT_BLOCKED_ACTIONS.has(action));
  person.actionTable = person.actionTable.filter(action => !CIVILIZATION_AVOIDANT_BLOCKED_ACTIONS.has(action));
}

function applyNoKillingFilter(person) {
  if (!traitList(person, "mindTraits").includes("不殺")) return;
  person.jobTable = person.jobTable.filter(action => !NO_KILLING_BLOCKED_ACTIONS.has(action));
  person.actionTable = person.actionTable.filter(action => !NO_KILLING_BLOCKED_ACTIONS.has(action));
}

function applyHalfHorseBodyFilter(person) {
  if (!traitList(person, "bodyTraits").includes("半人半馬")) return;
  person.jobTable = person.jobTable.filter(action => !HALF_HORSE_BLOCKED_ACTIONS.has(action));
  person.actionTable = person.actionTable.filter(action => !HALF_HORSE_BLOCKED_ACTIONS.has(action));
}

function applyFourLeggedBodyFilter(person) {
  if (!traitList(person, "bodyTraits").includes(FOUR_LEGGED_TRAIT)) return;
  person.jobTable = person.jobTable.filter(action => !FOUR_LEGGED_BLOCKED_ACTIONS.has(action));
  person.actionTable = person.actionTable.filter(action => !FOUR_LEGGED_BLOCKED_ACTIONS.has(action));
}

function applyWildMindFilter(person) {
  if (!traitList(person, "mindTraits").includes(WILD_MIND_TRAIT)) return;
  person.jobTable = person.jobTable.filter(action => !WILD_BLOCKED_ACTIONS.has(action));
  person.actionTable = person.actionTable.filter(action => !WILD_BLOCKED_ACTIONS.has(action));
}

function addRaidActionsIfAllowed(person, village) {
  const villageTraits = Array.isArray(village?.villageTraits) ? village.villageTraits : [];
  if (!villageTraits.includes("襲撃中")) return;

  const raidActions = [];
  if (canDefendInRaid(person)) raidActions.push(ACTION_DEFEND);
  if (canFortifyInRaid(person, village)) raidActions.push(ACTION_FORTIFY);
  if (canShootInRaid(person, village)) raidActions.push(ACTION_SHOOT);
  if (canMakeTrapInRaid(person)) raidActions.push(ACTION_TRAP);
  if (raidActions.length === 0) return;

  person.actionTable = person.actionTable.filter(action => !RAID_ACTIONS.includes(action));
  person.actionTable.unshift(...raidActions);
}

function normalizePreferredForTable(person, preferredTable, { defaultPreferred = ACTION_NONE } = {}) {
  let preferred = getRawPreferredAction(person);
  if (!preferredTable.includes(preferred)) {
    preferred = preferredTable.includes(defaultPreferred) ? defaultPreferred : ACTION_NONE;
  }
  setPreferredAction(person, preferred);
  return preferred;
}

function normalizeCurrentAction(person) {
  const actionTable = Array.isArray(person.actionTable) ? person.actionTable : [];
  const preferred = normalizeActionForPerson(person.preferredAction || ACTION_NONE, person) || ACTION_NONE;
  const current = normalizeActionForPerson(person.action || ACTION_NONE, person) || ACTION_NONE;

  if (actionTable.includes(current)) {
    person.action = current;
    return;
  }
  if (preferred !== ACTION_NONE && actionTable.includes(preferred)) {
    person.action = preferred;
    return;
  }
  person.action = ACTION_NONE;
}

function preservePreferredBeforeRestriction(person) {
  if (hasInfantMind(person)) {
    setPreferredAction(person, ACTION_CRADLE);
    return;
  }

  const preferred = getRawPreferredAction(person);
  if (isPreferredActionCandidate(preferred)) {
    setPreferredAction(person, preferred);
  } else {
    setPreferredAction(person, ACTION_NONE);
  }
}

export function applyForcedActionRestriction(person) {
  if (!person) return { restricted: false, changed: false, reason: "" };

  const beforePreferred = person.preferredAction;
  const beforeJob = person.job;
  const beforeAction = person.action;
  const beforeJobTable = Array.isArray(person.jobTable) ? person.jobTable.join("\u0001") : "";
  const beforeActionTable = Array.isArray(person.actionTable) ? person.actionTable.join("\u0001") : "";
  const bodyTraits = traitList(person, "bodyTraits");
  const mindTraits = traitList(person, "mindTraits");

  if (bodyTraits.includes("危篤")) {
    preservePreferredBeforeRestriction(person);
    setTables(person, [], [ACTION_LAST_MOMENTS]);
    person.action = ACTION_LAST_MOMENTS;
    return {
      restricted: true,
      changed: beforePreferred !== person.preferredAction ||
        beforeJob !== person.job ||
        beforeAction !== person.action ||
        beforeJobTable !== person.jobTable.join("\u0001") ||
        beforeActionTable !== person.actionTable.join("\u0001"),
      reason: "危篤",
      action: ACTION_LAST_MOMENTS
    };
  }

  if (isForcedHealingAction(person)) {
    const reasons = [];
    ["病気", "疫病", "負傷", "過労", "産褥"].forEach(trait => {
      if (bodyTraits.includes(trait)) reasons.push(trait);
    });
    if (mindTraits.includes("抑鬱")) reasons.push("抑鬱");

    preservePreferredBeforeRestriction(person);
    setTables(person, [], [ACTION_HEAL]);
    person.action = ACTION_HEAL;
    return {
      restricted: true,
      changed: beforePreferred !== person.preferredAction ||
        beforeJob !== person.job ||
        beforeAction !== person.action ||
        beforeJobTable !== person.jobTable.join("\u0001") ||
        beforeActionTable !== person.actionTable.join("\u0001"),
      reason: reasons[0] || "状態異常",
      action: ACTION_HEAL
    };
  }

  return { restricted: false, changed: false, reason: "" };
}

function buildAdultPersistentActions(person, village) {
  const common = [
    "農作業", "狩猟", "漁",
    "伐採",
    "採集", "内職", "行商",
    "研究", "警備", "看護"
  ];

  if (hasActiveBuildingFlag(village, "hasClinic", "clinic")) common.push(getMassageActionForPerson(person));
  if (hasActiveBuildingFlag(village, "hasLibrary", "library")) common.push("写本");
  if (hasActiveBuildingFlag(village, "hasBrewery", "brewery")) common.push("醸造");
  if (hasActiveBuildingFlag(village, "hasAlchemy", "alchemy")) common.push("錬金術");
  if (hasActiveBuildingFlag(village, "hasWeaving", "weaving")) common.push("機織り");

  const actions = person.bodySex === "男"
    ? [...common, "詩人", "神官"]
    : [...common, "踊り子", "シスター"];
  if (person.bodySex !== "男") {
    if (hasActiveBuildingFlag(village, "hasTavern", "tavern")) actions.push("バニー");
    if (hasActiveBuildingFlag(village, "hasChurch", "church")) actions.push("巫女");
  }

  if (!traitList(person, "mindTraits").includes("神聖")) return actions;
  return actions.filter(action => !SACRED_BLOCKED_ADULT_ACTIONS.has(action));
}

export function refreshJobTable(v, village = {}) {
  syncEffectiveStats(v);

  if (applyForcedActionRestriction(v).restricted) {
    return;
  }

  if (traitList(v, "bodyTraits").includes(YOUNG_WOLF_TRAIT)) {
    const preferredTable = ["遊び"];
    setTables(v, preferredTable, [ACTION_REST, ACTION_LEISURE, "遊び"]);
    normalizePreferredForTable(v, v.jobTable, { defaultPreferred: "遊び" });
    normalizeCurrentAction(v);
    return;
  }

  const sa = Number(v.spiritAge) || 0;
  const mindTraits = traitList(v, "mindTraits");
  const infantMind = hasInfantMind(v);
  const isToddlerStage = !infantMind && (mindTraits.includes("萌芽") || sa <= 9);
  const isAdolescentStage = !infantMind && !isToddlerStage && (mindTraits.includes("思春期") || sa <= 15);

  if (infantMind) {
    setTables(v, [ACTION_CRADLE], [ACTION_CRADLE]);
    setPreferredAction(v, ACTION_CRADLE);
    addRaidActionsIfAllowed(v, village);
    normalizeCurrentAction(v);
    return;
  }

  if (isToddlerStage) {
    const preferredTable = ["遊び", "お手伝い"];
    setTables(v, preferredTable, [ACTION_REST, "遊び", "お手伝い"]);
    applyCivilizationAvoidanceFilter(v);
    applyNoKillingFilter(v);
    applyInfantBodyActionFilter(v);
    applyHalfHorseBodyFilter(v);
    applyFourLeggedBodyFilter(v);
    applyWildMindFilter(v);
    normalizePreferredForTable(v, v.jobTable, { defaultPreferred: "遊び" });
    addRaidActionsIfAllowed(v, village);
    normalizeCurrentAction(v);
    return;
  }

  if (isAdolescentStage) {
    const preferredTable = ["遊び", "農作業", "伐採", "狩猟", "漁", "採集", "内職", "丁稚", "研究助手"];
    setTables(v, preferredTable, [ACTION_REST, ...preferredTable]);
    applyCivilizationAvoidanceFilter(v);
    applyNoKillingFilter(v);
    applyInfantBodyActionFilter(v);
    applyHalfHorseBodyFilter(v);
    applyFourLeggedBodyFilter(v);
    applyWildMindFilter(v);
    normalizePreferredForTable(v, v.jobTable, { defaultPreferred: "遊び" });
    addRaidActionsIfAllowed(v, village);
    normalizeCurrentAction(v);
    return;
  }

  const preferredTable = buildAdultPersistentActions(v, village);
  setTables(v, preferredTable, [ACTION_REST, ACTION_LEISURE, ...preferredTable]);
  applyCivilizationAvoidanceFilter(v);
  applyNoKillingFilter(v);
  applyInfantBodyActionFilter(v);
  applyHalfHorseBodyFilter(v);
  applyFourLeggedBodyFilter(v);
  applyWildMindFilter(v);
  normalizePreferredForTable(v, v.jobTable);
  addRaidActionsIfAllowed(v, village);
  normalizeCurrentAction(v);
}
