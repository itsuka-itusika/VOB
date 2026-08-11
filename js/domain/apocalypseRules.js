export const APOCALYPSE_TRAIT = "黙示録";
export const SALT_PILLAR_TRAIT = "塩の柱";
export const SALT_PILLAR_DURATION_MONTHS = 3;

export function isApocalypseActive(village) {
  return !!village?.apocalypseStarted &&
    Array.isArray(village?.villageTraits) &&
    village.villageTraits.includes(APOCALYPSE_TRAIT);
}

export function isSaltPillar(person) {
  return Array.isArray(person?.bodyTraits) && person.bodyTraits.includes(SALT_PILLAR_TRAIT);
}

export function getActiveVillagers(village) {
  return (Array.isArray(village?.villagers) ? village.villagers : []).filter(person => !isSaltPillar(person));
}
