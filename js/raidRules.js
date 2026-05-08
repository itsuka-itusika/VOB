import { isForcedHealingAction } from "./util.js";

export const ACTION_DEFEND = "迎撃";
export const ACTION_TRAP = "罠作成";
export const TRAIT_UNDER_RAID = "襲撃中";

const RAID_UNABLE_BODY_TRAITS = ["赤子", "子供", "少年", "少女"];
const RAID_UNABLE_MIND_TRAITS = ["無垢", "萌芽", "思春期"];

function traitList(person, key) {
  return Array.isArray(person?.[key]) ? person[key] : [];
}

export function hasRaidBlockingTrait(person) {
  const bodyTraits = traitList(person, "bodyTraits");
  const mindTraits = traitList(person, "mindTraits");

  return RAID_UNABLE_BODY_TRAITS.some(trait => bodyTraits.includes(trait)) ||
    RAID_UNABLE_MIND_TRAITS.some(trait => mindTraits.includes(trait)) ||
    (Number(person?.spiritAge) || 0) <= 15 ||
    mindTraits.includes("襲撃者") ||
    mindTraits.includes("訪問者");
}

export function isRaidActionAssignable(person) {
  if (!person || isForcedHealingAction(person) || hasRaidBlockingTrait(person)) {
    return false;
  }
  return (Number(person.hp) || 0) > 0;
}

export function canPerformRaidAction(person, action) {
  return isRaidActionAssignable(person) &&
    Array.isArray(person.actionTable) &&
    person.actionTable.includes(action);
}

export function isRaidActive(village) {
  return Array.isArray(village?.villageTraits) &&
    village.villageTraits.includes(TRAIT_UNDER_RAID) &&
    !village.isRaidProcessDone &&
    Array.isArray(village.raidEnemies) &&
    village.raidEnemies.length > 0;
}

export function getRaidReadiness(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  const defenders = villagers.filter(person => {
    return person.action === ACTION_DEFEND && canPerformRaidAction(person, ACTION_DEFEND);
  });
  const trapMakers = villagers.filter(person => {
    return person.action === ACTION_TRAP && canPerformRaidAction(person, ACTION_TRAP);
  });

  return {
    defenders,
    trapMakers,
    participantCount: defenders.length + trapMakers.length
  };
}
