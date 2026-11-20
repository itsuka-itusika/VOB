export const APOCALYPSE_TRAIT = "黙示録";
export const SALT_PILLAR_TRAIT = "塩の柱";
// ゴーゴンの邪眼による石化。塩の柱に準じ、石の体で動けず、同じく3か月で元に戻る。
export const PETRIFIED_TRAIT = "石化";
export const SALT_PILLAR_DURATION_MONTHS = 3;

export function isApocalypseActive(village) {
  return !!village?.apocalypseStarted &&
    Array.isArray(village?.villageTraits) &&
    village.villageTraits.includes(APOCALYPSE_TRAIT);
}

/** 塩の柱か、それに準じる石化か。石の体として、行動・消費・会話などを同じに扱う。 */
/** 邪眼による石化か。塩の柱と違い、回復系の奇跡・秘宝で解ける。 */
export function isPetrified(person) {
  return getStoneBodyTrait(person) === PETRIFIED_TRAIT;
}

export function isSaltPillar(person) {
  return getStoneBodyTrait(person) !== "";
}

/** 石の体にしている特性。塩の柱を優先し、どちらもなければ空文字。 */
export function getStoneBodyTrait(person) {
  const bodyTraits = Array.isArray(person?.bodyTraits) ? person.bodyTraits : [];
  if (bodyTraits.includes(SALT_PILLAR_TRAIT)) return SALT_PILLAR_TRAIT;
  if (bodyTraits.includes(PETRIFIED_TRAIT)) return PETRIFIED_TRAIT;
  return "";
}

export function getVillagersIncludingSaltPillar(village) {
  return Array.isArray(village?.villagers) ? village.villagers : [];
}

export function getActiveVillagers(village) {
  return getVillagersIncludingSaltPillar(village).filter(person => !isSaltPillar(person));
}
