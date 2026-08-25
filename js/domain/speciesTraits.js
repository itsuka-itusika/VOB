export const WOLF_RACE = "狼";
export const GOBLIN_RACE = "ゴブリン";
export const FOUR_LEGGED_TRAIT = "四足歩行";
export const SENSITIVE_NOSE_TRAIT = "嗅覚鋭敏";
export const WILD_MIND_TRAIT = "野生";
export const YOUNG_WOLF_TRAIT = "幼狼";
export const IMMATURE_MIND_TRAIT = "未成熟";
export const OLD_WOLF_TRAIT = "老狼";
export const SHORT_BODY_TRAIT = "短躯";

function ensureTraitArray(person, key) {
  if (!Array.isArray(person[key])) person[key] = [];
  return person[key];
}

function addUniqueTrait(traits, trait) {
  if (traits.includes(trait)) return false;
  traits.push(trait);
  return true;
}

function removeTrait(traits, trait) {
  const next = traits.filter(item => item !== trait);
  const changed = next.length !== traits.length;
  return { next, changed };
}

export function isWolf(person) {
  return person?.race === WOLF_RACE;
}

export function isGoblin(person) {
  return person?.race === GOBLIN_RACE;
}

export function countsTowardPopulation(person) {
  return !isWolf(person);
}

function toVillagerList(villageOrVillagers) {
  const villagers = Array.isArray(villageOrVillagers)
    ? villageOrVillagers
    : villageOrVillagers?.villagers;
  return Array.isArray(villagers) ? villagers : [];
}

export function getPopulationCount(villageOrVillagers) {
  return toVillagerList(villageOrVillagers).filter(countsTowardPopulation).length;
}

/** 人口上限に数えない村人（狼）の頭数。人口表示の括弧内に出す。 */
export function getUncountedPopulationCount(villageOrVillagers) {
  return toVillagerList(villageOrVillagers).filter(person => !countsTowardPopulation(person)).length;
}

export function isAtPopulationLimit(village, incomingPerson = null) {
  if (incomingPerson && !countsTowardPopulation(incomingPerson)) return false;
  const popLimit = Number(village?.popLimit);
  return Number.isFinite(popLimit) && getPopulationCount(village) >= popLimit;
}

/** ゴブリンへ肉体特性「短躯」を付与する。食料・冬資材の消費はこの特性が担う。 */
export function syncGoblinSpeciesTraits(person) {
  if (!isGoblin(person)) return false;
  return addUniqueTrait(ensureTraitArray(person, "bodyTraits"), SHORT_BODY_TRAIT);
}

export function syncWolfSpeciesTraits(person, { includeWildMindTrait = false } = {}) {
  if (!person) return false;

  let changed = false;
  let mindTraits = ensureTraitArray(person, "mindTraits");
  if ((Number(person.spiritAge) || 0) >= 1) {
    const result = removeTrait(mindTraits, IMMATURE_MIND_TRAIT);
    person.mindTraits = result.next;
    mindTraits = result.next;
    changed = result.changed || changed;
  }

  if (!isWolf(person)) return changed;

  const bodyTraits = ensureTraitArray(person, "bodyTraits");

  [FOUR_LEGGED_TRAIT, SENSITIVE_NOSE_TRAIT].forEach(trait => {
    changed = addUniqueTrait(bodyTraits, trait) || changed;
  });
  if (includeWildMindTrait) {
    changed = addUniqueTrait(mindTraits, WILD_MIND_TRAIT) || changed;
  }

  const bodyAge = Number(person.bodyAge) || 0;
  if (bodyAge === 0) {
    changed = addUniqueTrait(bodyTraits, YOUNG_WOLF_TRAIT) || changed;
  } else {
    const result = removeTrait(bodyTraits, YOUNG_WOLF_TRAIT);
    person.bodyTraits = result.next;
    changed = result.changed || changed;
  }

  if (bodyAge >= 13) {
    changed = addUniqueTrait(person.bodyTraits, OLD_WOLF_TRAIT) || changed;
  } else {
    const result = removeTrait(person.bodyTraits, OLD_WOLF_TRAIT);
    person.bodyTraits = result.next;
    changed = result.changed || changed;
  }

  return changed;
}
