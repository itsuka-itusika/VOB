import { isForcedHealingAction } from "./util.js";

export const ACTION_DEFEND = "迎撃";
export const ACTION_TRAP = "罠作成";
export const TRAIT_UNDER_RAID = "襲撃中";

const RAID_COMMON_UNABLE_BODY_TRAITS = ["赤子", "危篤"];
const RAID_COMMON_UNABLE_MIND_TRAITS = ["無垢", "萌芽", "襲撃者", "訪問者"];
const RAID_DEFEND_UNABLE_MIND_TRAITS = [...RAID_COMMON_UNABLE_MIND_TRAITS, "思春期"];

function traitList(person, key) {
  return Array.isArray(person?.[key]) ? person[key] : [];
}

function hasAnyTrait(traits, unableTraits) {
  return unableTraits.some(trait => traits.includes(trait));
}

function hasCommonRaidBlockingCondition(person) {
  if (!person || isForcedHealingAction(person) || (Number(person.hp) || 0) <= 0) {
    return true;
  }

  const bodyTraits = traitList(person, "bodyTraits");
  const mindTraits = traitList(person, "mindTraits");

  return hasAnyTrait(bodyTraits, RAID_COMMON_UNABLE_BODY_TRAITS) ||
    hasAnyTrait(mindTraits, RAID_COMMON_UNABLE_MIND_TRAITS);
}

export function canDefendInRaid(person) {
  if (hasCommonRaidBlockingCondition(person)) return false;
  return !hasAnyTrait(traitList(person, "mindTraits"), RAID_DEFEND_UNABLE_MIND_TRAITS);
}

export function canMakeTrapInRaid(person) {
  return !hasCommonRaidBlockingCondition(person);
}

export function canPerformRaidAction(person, action) {
  const canPerformByRole = action === ACTION_DEFEND
    ? canDefendInRaid(person)
    : action === ACTION_TRAP
      ? canMakeTrapInRaid(person)
      : false;

  return canPerformByRole &&
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
