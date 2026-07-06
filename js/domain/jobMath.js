import { hasActiveBuildingFlag } from "./buildingState.js";
import { SENSITIVE_NOSE_TRAIT } from "./speciesTraits.js";
import {
  VILLAGE_ROLE_DOCTOR,
  VILLAGE_ROLE_LIBRARIAN,
  VILLAGE_ROLE_PRIEST,
  getVillageRoleMultiplier
} from "./villageRoles.js";

const ACTION_MASSAGE_MALE = "あんま男";
const ACTION_MASSAGE_FEMALE = "あんま女";
const SWEATY_TRAIT = "汗かき";
const COLD_SENSITIVE_TRAIT = "寒がり";
const WORKAHOLIC_TRAIT = "ワーカホリック";
const SUMMER_TRAIT = "夏";
const WINTER_TRAIT = "冬";
const SEASONAL_COST_MULTIPLIER = 1.2;
// UI 予測ではランダム分岐の期待値を使う。実処理では成功判定後の値を渡す。
const RANDOM_HARVEST_EXPECTED_BASE = 32;
const IMPROVED_HARVEST_EXPECTED_BASE = 35;
const MID_TEEN_TRAIT = "思春期";

export const WORK_COST_TYPES = {
  PHYSICAL: { body: 24, mind: 12 },
  BALANCED: { body: 18, mind: 18 },
  MENTAL: { body: 12, mind: 24 }
};

export const JOB_COST_TYPES = {
  "農作業": WORK_COST_TYPES.PHYSICAL,
  "伐採": WORK_COST_TYPES.PHYSICAL,
  "狩猟": WORK_COST_TYPES.PHYSICAL,
  "漁": WORK_COST_TYPES.PHYSICAL,
  "採集": WORK_COST_TYPES.BALANCED,
  "内職": WORK_COST_TYPES.MENTAL,
  "研究": WORK_COST_TYPES.MENTAL,
  "丁稚": WORK_COST_TYPES.BALANCED,
  "研究助手": WORK_COST_TYPES.MENTAL,
  "警備": WORK_COST_TYPES.PHYSICAL,
  "看護": WORK_COST_TYPES.BALANCED,
  "踊り子": WORK_COST_TYPES.BALANCED,
  "詩人": WORK_COST_TYPES.BALANCED,
  "シスター": WORK_COST_TYPES.MENTAL,
  "神官": WORK_COST_TYPES.MENTAL,
  "行商": WORK_COST_TYPES.BALANCED,
  "あんま": WORK_COST_TYPES.BALANCED,
  "あんま男": WORK_COST_TYPES.BALANCED,
  "あんま女": WORK_COST_TYPES.BALANCED,
  "巫女": WORK_COST_TYPES.BALANCED,
  "バニー": WORK_COST_TYPES.BALANCED,
  "錬金術": WORK_COST_TYPES.BALANCED,
  "写本": WORK_COST_TYPES.MENTAL,
  "機織り": WORK_COST_TYPES.BALANCED,
  "醸造": WORK_COST_TYPES.BALANCED
};

const ABUNDANCE_JOBS = ["農作業", "伐採", "狩猟", "漁", "採集"];
const AUTUMN_JOBS = ["農作業", "採集"];
const COLD_SUMMER_JOBS = ["農作業", "伐採"];
const GREEN_THUMB_JOBS = ["農作業", "伐採", "採集"];
const FLYING_JOBS = ["狩猟", "採集"];
const SWIFT_LEGS_JOBS = ["行商", "採集"];
const HALF_HORSE_JOBS = ["狩猟"];
const YOUTH_WORK_JOBS = ["農作業", "伐採", "狩猟", "漁", "採集", "内職", "丁稚", "研究助手"];

function defaultRandomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function statCostBase(base, statValue) {
  return (Number(base) || 0) * (1 - ((Number(statValue) || 0) / 100));
}

function statProduct(person, left, right) {
  return ((Number(person?.[left]) || 0) / 20) * ((Number(person?.[right]) || 0) / 20);
}

function statTripleProduct(person, first, second, third) {
  return statProduct(person, first, second) * ((Number(person?.[third]) || 0) / 20);
}

function applyVillageRoleMultiplier(amount, person, role) {
  return Math.round(amount * getVillageRoleMultiplier(person, role));
}

export function hasVillageTrait(village, trait) {
  return Array.isArray(village?.villageTraits) && village.villageTraits.includes(trait);
}

export function hasMindTrait(person, trait) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.includes(trait);
}

export function hasBodyTrait(person, trait) {
  return Array.isArray(person?.bodyTraits) && person.bodyTraits.includes(trait);
}

export function getBodyCostMultiplier(person, village) {
  if (hasMindTrait(person, SWEATY_TRAIT) && hasVillageTrait(village, SUMMER_TRAIT)) {
    return SEASONAL_COST_MULTIPLIER;
  }
  return 1;
}

export function getMindCostMultiplier(person, village) {
  if (hasMindTrait(person, WORKAHOLIC_TRAIT)) {
    return 0;
  }
  let mul = 1;
  if (hasMindTrait(person, COLD_SENSITIVE_TRAIT) && hasVillageTrait(village, WINTER_TRAIT)) {
    mul *= SEASONAL_COST_MULTIPLIER;
  }
  return mul;
}

export function estimateBodyCost(base, vit, person = null, village = null) {
  const cost = statCostBase(base, vit) * getBodyCostMultiplier(person, village);
  return Math.round(cost);
}

export function estimateMindCost(base, statValue, person = null, village = null) {
  const cost = statCostBase(base, statValue) * getMindCostMultiplier(person, village);
  return Math.round(cost);
}

export function rollBodyCost(base, vit, person = null, village = null, randomFloat = defaultRandomFloat) {
  const cost = statCostBase(base, vit) * getBodyCostMultiplier(person, village);
  return Math.round(cost * randomFloat(0.9, 1.1));
}

export function rollMindCost(base, statValue, person = null, village = null, randomFloat = defaultRandomFloat) {
  const cost = statCostBase(base, statValue) * getMindCostMultiplier(person, village);
  return Math.round(cost * randomFloat(0.9, 1.1));
}

export function getJobCostType(job) {
  return JOB_COST_TYPES[job] || WORK_COST_TYPES.BALANCED;
}

export function getLaborYieldMultiplier(job, person = null, village = null) {
  let mul = 1;
  if (hasVillageTrait(village, "豊穣") && ABUNDANCE_JOBS.includes(job)) mul *= 2;
  if (hasVillageTrait(village, "秋") && AUTUMN_JOBS.includes(job)) mul *= 1.5;
  if (hasVillageTrait(village, "夏") && job === "漁") mul *= 1.2;
  if (hasVillageTrait(village, "冬") && job === "農作業") mul *= 0.5;
  if (hasVillageTrait(village, "冬") && job === "狩猟") mul *= 1.2;
  if (hasVillageTrait(village, "冷夏") && COLD_SUMMER_JOBS.includes(job)) mul *= 0.5;
  if (hasBodyTrait(person, "緑の指") && GREEN_THUMB_JOBS.includes(job)) mul *= 1.2;
  if (hasMindTrait(person, "熟練農夫") && job === "農作業") mul *= 1.3;
  if (hasMindTrait(person, "達人農夫") && job === "農作業") mul *= 1.5;
  if (hasMindTrait(person, "熟練木樵") && job === "伐採") mul *= 1.3;
  if (hasMindTrait(person, "達人木樵") && job === "伐採") mul *= 1.5;
  if (hasMindTrait(person, "熟練狩人") && job === "狩猟") mul *= 1.3;
  if (hasMindTrait(person, "達人狩人") && job === "狩猟") mul *= 1.5;
  if (hasMindTrait(person, "熟練漁師") && job === "漁") mul *= 1.3;
  if (hasMindTrait(person, "達人漁師") && job === "漁") mul *= 1.5;
  if (hasBodyTrait(person, "飛行") && FLYING_JOBS.includes(job)) mul *= 1.2;
  if (hasBodyTrait(person, "大地の巫女") && job === "農作業") mul *= 1.5;
  if (hasBodyTrait(person, "月の巫女") && job === "狩猟") mul *= 1.5;
  if (hasBodyTrait(person, "月の加護") && job === "狩猟") mul *= 1.2;
  if (hasBodyTrait(person, "夜目") && job === "狩猟") mul *= 1.2;
  if (hasBodyTrait(person, SENSITIVE_NOSE_TRAIT) && job === "採集") mul *= 1.5;
  if (hasBodyTrait(person, SENSITIVE_NOSE_TRAIT) && job === "狩猟") mul *= 1.2;
  if (hasBodyTrait(person, "大地の加護") && job === "農作業") mul *= 1.2;
  if (hasBodyTrait(person, "水中呼吸") && job === "漁") mul *= 2;
  if (hasBodyTrait(person, "健脚") && SWIFT_LEGS_JOBS.includes(job)) mul *= 1.2;
  if (hasBodyTrait(person, "半人半馬") && HALF_HORSE_JOBS.includes(job)) mul *= 1.2;
  if (hasMindTrait(person, "森の知恵") && job === "採集") mul *= 1.2;
  if (hasMindTrait(person, "海の知恵") && job === "漁") mul *= 1.2;
  if ((person?.hobby === "ハンティング" || person?.hobby === "狩猟" || person?.hobby === "狩り") && job === "狩猟") mul *= 1.1;
  if (hasMindTrait(person, MID_TEEN_TRAIT) && YOUTH_WORK_JOBS.includes(job)) mul *= 0.8;
  return mul;
}

export function calculateFarmYield(person, village) {
  const base = 30 * statProduct(person, "vit", "ind");
  return Math.round(base * getLaborYieldMultiplier("農作業", person, village));
}

export function calculateLumberYield(person, village) {
  const base = 30 * statProduct(person, "str", "ind");
  return Math.round(base * getLaborYieldMultiplier("伐採", person, village));
}

function getExpectedHarvestBase(job, village) {
  if (job === "狩猟" && hasActiveBuildingFlag(village, "hasHuntingLodge", "huntingLodge")) return IMPROVED_HARVEST_EXPECTED_BASE;
  if (job === "漁" && hasActiveBuildingFlag(village, "hasDock", "dock")) return IMPROVED_HARVEST_EXPECTED_BASE;
  return RANDOM_HARVEST_EXPECTED_BASE;
}

export function calculateHuntYield(person, village, baseValue = null) {
  const resolvedBaseValue = baseValue ?? getExpectedHarvestBase("狩猟", village);
  const base = (Number(resolvedBaseValue) || 0) * statProduct(person, "str", "cou");
  return Math.round(base * getLaborYieldMultiplier("狩猟", person, village));
}

export function calculateFishYield(person, village, baseValue = null) {
  const resolvedBaseValue = baseValue ?? getExpectedHarvestBase("漁", village);
  const base = (Number(resolvedBaseValue) || 0) * statProduct(person, "vit", "cou");
  return Math.round(base * getLaborYieldMultiplier("漁", person, village));
}

export function calculateGatherYield(person, village, materialBase = null) {
  const mul = getLaborYieldMultiplier("採集", person, village);
  const base = 15 * statProduct(person, "dex", "int");
  return {
    food: Math.round(base * mul),
    materials: Math.round((Number(materialBase) || base) * mul),
  };
}

export function calculateHandiworkYield(person, village) {
  const base = 30 * statProduct(person, "dex", "ind");
  return Math.round(base * getLaborYieldMultiplier("内職", person, village));
}

export function calculateResearchYield(person, village, job = "研究") {
  let amount = Math.round((30 * statProduct(person, "int", "mag")) * getLaborYieldMultiplier(job, person, village));
  if (job === "研究") {
    amount = applyVillageRoleMultiplier(amount, person, VILLAGE_ROLE_LIBRARIAN);
  }
  return amount;
}

export function calculateGuardYield(person) {
  let amount = Math.round(12 * statProduct(person, "str", "eth"));
  if (hasBodyTrait(person, "夜目")) {
    amount = Math.round(amount * 1.2);
  }
  if (hasBodyTrait(person, "半人半馬")) {
    amount = Math.round(amount * 1.2);
  }
  if (hasBodyTrait(person, SENSITIVE_NOSE_TRAIT)) {
    amount = Math.round(amount * 1.5);
  }
  return Math.max(1, amount);
}

export function calculateTradingYield(person, baseValue = RANDOM_HARVEST_EXPECTED_BASE) {
  return calculateTradingLikeYield(person, "行商", baseValue);
}

export function calculateApprenticeYield(person, baseValue = RANDOM_HARVEST_EXPECTED_BASE) {
  return calculateTradingLikeYield(person, "丁稚", baseValue);
}

export function calculateResearchAssistantYield(person, village) {
  return calculateResearchYield(person, village, "研究助手");
}

function calculateTradingLikeYield(person, job, baseValue) {
  const base = (Number(baseValue) || 0) * statProduct(person, "chr", "int");
  return Math.round(base * getLaborYieldMultiplier(job, person, null));
}

export function calculateNurseHeal(person, village) {
  let amount = Math.round(25 * statProduct(person, "mag", "eth"));
  return applyVillageRoleMultiplier(amount, person, VILLAGE_ROLE_DOCTOR);
}

export function calculatePriestMindHeal(person, village) {
  let amount = Math.round(8 * statProduct(person, "chr", "eth"));
  amount = applyVillageRoleMultiplier(amount, person, VILLAGE_ROLE_PRIEST);
  if (hasBodyTrait(person, "澄んだ声") || hasBodyTrait(person, "通る声")) {
    amount = Math.round(amount * 1.2);
  }
  return amount;
}

export function calculateDancerHappiness(person, village) {
  let amount = Math.round(10 * statProduct(person, "chr", "sexdr"));
  if (hasBodyTrait(person, "澄んだ声") || hasBodyTrait(person, "通る声")) {
    amount = Math.round(amount * 1.2);
  }
  if (hasBodyTrait(person, "太陽の巫女")) {
    amount = Math.round(amount * 1.5);
  }
  return amount;
}

export function calculatePoetHappiness(person, village) {
  let amount = Math.round(10 * statProduct(person, "chr", "int"));
  if (hasBodyTrait(person, "澄んだ声") || hasBodyTrait(person, "通る声")) {
    amount = Math.round(amount * 1.2);
  }
  if (hasBodyTrait(person, "太陽の巫女")) {
    amount = Math.round(amount * 1.5);
  }
  if (hasBodyTrait(person, "太陽の加護")) {
    amount = Math.round(amount * 1.2);
  }
  return amount;
}

function isMaleMassageAction(action, person) {
  const value = String(action || "").trim();
  if (value === ACTION_MASSAGE_MALE) return true;
  if (value === ACTION_MASSAGE_FEMALE) return false;
  return person?.bodySex === "男";
}

export function getMassageMindStat(person, action = person?.action) {
  return isMaleMassageAction(action, person) ? "int" : "sexdr";
}

export function calculateMassageHeal(person, action = person?.action) {
  const amount = isMaleMassageAction(action, person)
    ? Math.round(25 * statProduct(person, "str", "int"))
    : Math.round(25 * statProduct(person, "chr", "sexdr"));
  return applyVillageRoleMultiplier(amount, person, VILLAGE_ROLE_DOCTOR);
}

export function calculateMikoMana(person) {
  const amount = Math.round(12 * statTripleProduct(person, "chr", "mag", "sexdr"));
  return applyVillageRoleMultiplier(amount, person, VILLAGE_ROLE_PRIEST);
}

export function calculateBunnySupport(person) {
  return Math.round(8 * statProduct(person, "chr", "sexdr"));
}

export function calculateAlchemyYield(person) {
  const base = statProduct(person, "mag", "int");
  return {
    funds: Math.round(20 * base),
    mana: Math.round(8 * base),
  };
}

export function calculateCopyBookYield(person) {
  const amount = Math.round(20 * statProduct(person, "vit", "int"));
  return applyVillageRoleMultiplier(amount, person, VILLAGE_ROLE_LIBRARIAN);
}

export function calculateWeavingYield(person) {
  let amount = Math.round(42 * statProduct(person, "dex", "ind"));
  if (hasBodyTrait(person, "糸吐き")) {
    amount = Math.round(amount * 2);
  }
  if (hasBodyTrait(person, "梟の巫女")) {
    amount = Math.round(amount * 1.5);
  }
  if (hasBodyTrait(person, "梟の加護")) {
    amount = Math.round(amount * 1.2);
  }
  return amount;
}

export function calculateBrewingYield(person, village) {
  const base = statTripleProduct(person, "mag", "vit", "ind");
  const manaMul = getLaborYieldMultiplier("醸造", person, village);
  const foodMul = getBrewingFoodYieldMultiplier(person, village);
  return {
    food: Math.round(20 * base * foodMul),
    mana: Math.round(6 * base * manaMul),
  };
}

function getBrewingFoodYieldMultiplier(person, village) {
  let mul = getLaborYieldMultiplier("醸造", person, village);
  if (hasVillageTrait(village, "豊穣")) mul *= 2;
  if (hasVillageTrait(village, "秋")) mul *= 1.5;
  if (hasBodyTrait(person, "緑の指")) mul *= 1.2;
  if (hasBodyTrait(person, "大地の巫女")) mul *= 1.5;
  if (hasBodyTrait(person, "大地の加護")) mul *= 1.2;
  return mul;
}
