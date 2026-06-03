import { clampValue, round3 } from "../util.js";
import { ABILITY_STATS, PHYSICAL_ABILITY_STATS } from "./personSchema.js";
import { evaluateTitles } from "../titles.js";

export const STAT_LAYER_VERSION = 1;

const ZERO_STAT_MAP = Object.freeze(Object.fromEntries(ABILITY_STATS.map(stat => [stat, 0])));

const PERMANENT_BODY_TRAIT_ADDS = Object.freeze({
  "聖女の輝き": { mag: 10, chr: 10 },
  "大地の巫女": { vit: 10, chr: 10 },
  "月の巫女": { dex: 10, chr: 10 },
  "太陽の巫女": { str: 15, chr: 5 },
  "梟の巫女": { mag: 10, chr: 10 },
  "大地の加護": { vit: 5 },
  "月の加護": { dex: 5 },
  "太陽の加護": { str: 5 },
  "梟の加護": { mag: 5 },
  "雷霆神の加護": Object.freeze(Object.fromEntries(PHYSICAL_ABILITY_STATS.map(stat => [stat, 3])))
});

const PERMANENT_MIND_TRAIT_ADDS = Object.freeze({
  "ニート": { ind: -2 },
  "里長": { ind: 3, eth: 3, cou: 3 }
});

const TEMP_BODY_TRAIT_EFFECTS = Object.freeze({
  "飢餓": { mul: { str: 0.5, vit: 0.5, dex: 0.5 } },
  "凍え": { mul: { str: 0.8, vit: 0.8, dex: 0.8 } },
  "疲労": { mul: { str: 0.8, vit: 0.8, dex: 0.8 } },
  "過労": { mul: { str: 0.25, vit: 0.25, dex: 0.25 } },
  "疫病": { mul: { str: 0.5, vit: 0.5, dex: 0.5 } },
  "臨月": { mul: { str: 0.5, vit: 0.5 } },
  "産褥": { mul: { str: 0.5, vit: 0.5 } }
});

const TEMP_MIND_TRAIT_EFFECTS = Object.freeze({
  "心労": { mul: { int: 0.8, ind: 0.8, eth: 0.8, cou: 0.8, sexdr: 0.8 } },
  "抑鬱": { mul: { int: 0.25, ind: 0.25, eth: 0.25, cou: 0.25, sexdr: 0.25 } },
  "狂乱": { mul: { eth: 0.2 }, add: { sexdr: 15 } },
  "酩酊": { mul: { ind: 0.2, eth: 0.2 }, add: { sexdr: 10 } },
  "火星の加護": { mul: { mag: 0.2, int: 0.2, ind: 0.2, eth: 0.2 }, add: { str: 7, vit: 7, cou: 7 } },
  "ニケ": { add: { cou: 10 } }
});

const LEGACY_TEMP_BODY_TRAIT_EFFECTS = Object.freeze({
  ...TEMP_BODY_TRAIT_EFFECTS,
  "火星の加護": { mul: { str: 1.6, vit: 1.6, cou: 1.6, int: 0.2, ind: 0.2, eth: 0.2 } }
});

function getPortraitEffect(person) {
  const mindTraits = Array.isArray(person?.mindTraits) ? person.mindTraits : [];
  if (!mindTraits.includes("肖像")) return null;
  const ethLoss = clampValue(round3(numberOr(person.portraitEthLoss, 0)), 0, 100);
  return ethLoss > 0 ? { add: { eth: -ethLoss, chr: ethLoss } } : null;
}

export function createStatMap(initialValue = 0) {
  return Object.fromEntries(ABILITY_STATS.map(stat => [stat, initialValue]));
}

function numberOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeStatMap(map, fallbackMap = null, fallbackValue = 0) {
  return Object.fromEntries(ABILITY_STATS.map(stat => [
    stat,
    numberOr(map?.[stat], fallbackMap ? numberOr(fallbackMap[stat], fallbackValue) : fallbackValue)
  ]));
}

function addStats(target, source) {
  Object.entries(source || {}).forEach(([stat, amount]) => {
    if (stat in target) target[stat] += numberOr(amount, 0);
  });
}

function getTraitAdditions(person) {
  const additions = createStatMap(0);
  const bodyTraits = Array.isArray(person?.bodyTraits) ? person.bodyTraits : [];
  const mindTraits = Array.isArray(person?.mindTraits) ? person.mindTraits : [];

  [...new Set(bodyTraits)].forEach(trait => addStats(additions, PERMANENT_BODY_TRAIT_ADDS[trait]));
  [...new Set(mindTraits)].forEach(trait => addStats(additions, PERMANENT_MIND_TRAIT_ADDS[trait]));
  return additions;
}

function getTemporaryEffect(person, { includeLegacyAres = false } = {}) {
  const mul = Object.fromEntries(ABILITY_STATS.map(stat => [stat, 1]));
  const add = createStatMap(0);
  const bodyTraits = Array.isArray(person?.bodyTraits) ? person.bodyTraits : [];
  const mindTraits = Array.isArray(person?.mindTraits) ? person.mindTraits : [];
  const bodyEffects = includeLegacyAres ? LEGACY_TEMP_BODY_TRAIT_EFFECTS : TEMP_BODY_TRAIT_EFFECTS;

  const applyEffect = (effect) => {
    Object.entries(effect?.mul || {}).forEach(([stat, factor]) => {
      if (stat in mul) mul[stat] *= numberOr(factor, 1);
    });
    Object.entries(effect?.add || {}).forEach(([stat, amount]) => {
      if (stat in add) add[stat] += numberOr(amount, 0);
    });
  };

  bodyTraits.forEach(trait => applyEffect(bodyEffects[trait]));
  mindTraits.forEach(trait => applyEffect(TEMP_MIND_TRAIT_EFFECTS[trait]));
  applyEffect(getPortraitEffect(person));
  return { mul, add };
}

function getAgeMultiplier(person, stat) {
  if (!["str", "vit", "chr"].includes(stat)) return 1;
  const bodyTraits = Array.isArray(person?.bodyTraits) ? person.bodyTraits : [];
  if (bodyTraits.includes("老人")) return 0.375;
  if (bodyTraits.includes("中年")) return 0.75;
  return 1;
}

function inferLegacyBaseStats(person) {
  const traitAdds = getTraitAdditions(person);
  const temp = getTemporaryEffect(person, { includeLegacyAres: true });
  const baseStats = createStatMap(0);

  ABILITY_STATS.forEach(stat => {
    const effective = numberOr(person?.[stat], 10);
    const withoutTemporary = (effective - temp.add[stat]) / (temp.mul[stat] || 1);
    const withoutAge = withoutTemporary / getAgeMultiplier(person, stat);
    baseStats[stat] = clampValue(round3(withoutAge - traitAdds[stat]), 0, 100);
  });

  return baseStats;
}

export function hasStatLayerData(source) {
  return !!source && typeof source.baseStats === "object" && source.baseStats !== null;
}

export function ensureStatLayers(person) {
  if (!person) return person;
  if (!hasStatLayerData(person)) {
    person.baseStats = inferLegacyBaseStats(person);
    person.acquiredStatMods = createStatMap(0);
  } else {
    person.baseStats = normalizeStatMap(person.baseStats, person, 10);
    person.acquiredStatMods = normalizeStatMap(person.acquiredStatMods, ZERO_STAT_MAP, 0);
  }
  person.statLayerVersion = STAT_LAYER_VERSION;
  return person;
}

export function hydrateStatLayersFromObject(person, source) {
  if (!person) return person;
  if (hasStatLayerData(source)) {
    person.baseStats = normalizeStatMap(source.baseStats, source, 10);
    person.acquiredStatMods = normalizeStatMap(source.acquiredStatMods, ZERO_STAT_MAP, 0);
  } else {
    person.baseStats = inferLegacyBaseStats(person);
    person.acquiredStatMods = createStatMap(0);
  }
  person.statLayerVersion = STAT_LAYER_VERSION;
  syncEffectiveStats(person);
  return person;
}

export function setBaseStats(person, values) {
  ensureStatLayers(person);
  ABILITY_STATS.forEach(stat => {
    if (Object.prototype.hasOwnProperty.call(values || {}, stat)) {
      person.baseStats[stat] = clampValue(round3(numberOr(values[stat], person.baseStats[stat])), 0, 100);
    }
  });
  syncEffectiveStats(person);
}

export function setBaseStatsFromCurrent(person) {
  ensureStatLayers(person);
  ABILITY_STATS.forEach(stat => {
    person.baseStats[stat] = clampValue(round3(numberOr(person[stat], person.baseStats[stat])), 0, 100);
  });
  syncEffectiveStats(person);
}

export function setBaseStat(person, stat, value, { sync = true } = {}) {
  if (!ABILITY_STATS.includes(stat)) return;
  ensureStatLayers(person);
  person.baseStats[stat] = clampValue(round3(numberOr(value, person.baseStats[stat])), 0, 100);
  if (sync) syncEffectiveStats(person);
}

export function addBaseStat(person, stat, amount) {
  if (!ABILITY_STATS.includes(stat)) return;
  ensureStatLayers(person);
  person.baseStats[stat] = clampValue(round3(person.baseStats[stat] + numberOr(amount, 0)), 0, 100);
  syncEffectiveStats(person);
}

export function addAcquiredStat(person, stat, amount) {
  if (!ABILITY_STATS.includes(stat)) return;
  ensureStatLayers(person);
  person.acquiredStatMods[stat] = round3(person.acquiredStatMods[stat] + numberOr(amount, 0));
  syncEffectiveStats(person);
  evaluateTitles(person, { getPermanentStat });
}

export function getBaseStat(person, stat) {
  ensureStatLayers(person);
  return numberOr(person.baseStats?.[stat], 0);
}

export function getPermanentStat(person, stat) {
  ensureStatLayers(person);
  const traitAdds = getTraitAdditions(person);
  return round3((person.baseStats[stat] + person.acquiredStatMods[stat] + traitAdds[stat]) * getAgeMultiplier(person, stat));
}

export function syncEffectiveStats(person) {
  if (!person) return person;
  ensureStatLayers(person);
  const traitAdds = getTraitAdditions(person);
  const temp = getTemporaryEffect(person);

  ABILITY_STATS.forEach(stat => {
    const permanent = (person.baseStats[stat] + person.acquiredStatMods[stat] + traitAdds[stat]) * getAgeMultiplier(person, stat);
    const effective = permanent * temp.mul[stat] + temp.add[stat];
    person[stat] = clampValue(round3(effective), 0, 100);
  });

  return person;
}

export function setBaseStatsFromEffective(person) {
  setBaseStatsFromCurrent(person);
}

export function applyGenerationBaseTraitBonuses(person) {
  if (Array.isArray(person?.bodyTraits) && person.bodyTraits.includes("巨躯")) {
    addBaseStat(person, "str", 10);
  }
  if (Array.isArray(person?.mindTraits) && person.mindTraits.includes("箱入り")) {
    addBaseStat(person, "chr", 5);
  }
  if (Array.isArray(person?.mindTraits) && person.mindTraits.includes("内向的")) {
    addBaseStat(person, "int", 4);
    addBaseStat(person, "ind", 6);
    addBaseStat(person, "eth", 4);
  }
  if (Array.isArray(person?.mindTraits) && person.mindTraits.includes("本の虫")) {
    addBaseStat(person, "int", 8);
  }
}
