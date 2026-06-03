import { isForcedHealingAction } from "../util.js";
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

export const ACTION_NONE = "なし";
export const ACTION_REST = "休養";
export const ACTION_LEISURE = "余暇";
export const ACTION_HEAL = "療養";
export const ACTION_LAST_MOMENTS = "臨終";
export const ACTION_CRADLE = "揺籃";

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
  "襲撃"
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

function traitList(person, key) {
  return Array.isArray(person?.[key]) ? person[key] : [];
}

function hasInfantMind(person) {
  const mindTraits = traitList(person, "mindTraits");
  return mindTraits.includes("無垢") || (Number(person?.spiritAge) || 0) <= 3;
}

function hasInfantBody(person) {
  const bodyTraits = traitList(person, "bodyTraits");
  return bodyTraits.includes("赤子") || (Number(person?.bodyAge) || 0) <= 3;
}

function getRawPreferredAction(person) {
  const explicit = String(person?.preferredAction || "").trim();
  if (explicit) return explicit;

  const legacyJob = String(person?.job || "").trim();
  if (isPreferredActionCandidate(legacyJob)) return legacyJob;

  const currentAction = String(person?.action || "").trim();
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
  const next = isPreferredActionCandidate(action) ? action : ACTION_NONE;
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
  const preferred = String(person.preferredAction || ACTION_NONE).trim() || ACTION_NONE;
  const current = String(person.action || ACTION_NONE).trim() || ACTION_NONE;

  if (actionTable.includes(current)) return;
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
  const buildingFlags = village?.buildingFlags || {};
  const common = [
    "農作業", "狩猟", "漁",
    "伐採",
    "採集", "内職", "行商",
    "研究", "警備", "看護"
  ];

  if (buildingFlags.hasClinic) common.push("あんま");
  if (buildingFlags.hasLibrary) common.push("写本");
  if (buildingFlags.hasBrewery) common.push("醸造");
  if (buildingFlags.hasAlchemy) common.push("錬金術");
  if (buildingFlags.hasWeaving) common.push("機織り");

  if (person.bodySex === "男") {
    return [...common, "詩人", "神官"];
  }

  const actions = [...common, "踊り子", "シスター"];
  if (buildingFlags.hasTavern) actions.push("バニー");
  if (buildingFlags.hasChurch) actions.push("巫女");
  return actions;
}

export function refreshJobTable(v, village = {}) {
  syncEffectiveStats(v);

  if (applyForcedActionRestriction(v).restricted) {
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
    applyInfantBodyActionFilter(v);
    normalizePreferredForTable(v, v.jobTable, { defaultPreferred: "遊び" });
    addRaidActionsIfAllowed(v, village);
    normalizeCurrentAction(v);
    return;
  }

  if (isAdolescentStage) {
    const preferredTable = ["遊び", "農作業", "伐採", "狩猟", "漁", "採集", "内職", "丁稚", "研究助手"];
    setTables(v, preferredTable, [ACTION_REST, ...preferredTable]);
    applyInfantBodyActionFilter(v);
    normalizePreferredForTable(v, v.jobTable, { defaultPreferred: "遊び" });
    addRaidActionsIfAllowed(v, village);
    normalizeCurrentAction(v);
    return;
  }

  const preferredTable = buildAdultPersistentActions(v, village);
  setTables(v, preferredTable, [ACTION_REST, ACTION_LEISURE, ...preferredTable]);
  applyInfantBodyActionFilter(v);
  normalizePreferredForTable(v, v.jobTable);
  addRaidActionsIfAllowed(v, village);
  normalizeCurrentAction(v);
}
