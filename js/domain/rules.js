const ACTION_NONE = "なし";
const FIXED_NON_ASSIGNMENT_ACTIONS = new Set(["揺籃", "療養", "臨終", "訪問", "襲撃"]);

function traitList(person, key) {
  return Array.isArray(person?.[key]) ? person[key] : [];
}

function hasInfantMind(person) {
  const mindTraits = traitList(person, "mindTraits");
  return mindTraits.includes("無垢") || (Number(person?.spiritAge) || 0) <= 3;
}

export function isRestrictedNoActionVillager(person) {
  const bodyTraits = traitList(person, "bodyTraits");
  const mindTraits = traitList(person, "mindTraits");
  const action = String(person?.action || "").trim();
  const actionTable = Array.isArray(person?.actionTable) ? person.actionTable : [];

  return bodyTraits.includes("危篤") ||
    hasInfantMind(person) ||
    mindTraits.includes("訪問者") ||
    mindTraits.includes("襲撃者") ||
    FIXED_NON_ASSIGNMENT_ACTIONS.has(action) ||
    (actionTable.length === 1 && FIXED_NON_ASSIGNMENT_ACTIONS.has(actionTable[0]));
}

export function isUnassignedActionVillager(person) {
  if (!person || isRestrictedNoActionVillager(person)) return false;
  const action = String(person.action || "").trim() || ACTION_NONE;
  const preferred = String(person.preferredAction || person.job || "").trim() || ACTION_NONE;
  return action === ACTION_NONE && preferred === ACTION_NONE;
}

// 旧名互換。仕事概念はUIから廃止し、未割当判定は行動へ一本化する。
export const isRestrictedNoJobVillager = isRestrictedNoActionVillager;
