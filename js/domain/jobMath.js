const SWEATY_TRAIT = "汗かき";
const COLD_SENSITIVE_TRAIT = "寒がり";
const WORKAHOLIC_TRAIT = "ワーカホリック";
const SUMMER_TRAIT = "夏";
const WINTER_TRAIT = "冬";
const SEASONAL_COST_MULTIPLIER = 1.2;
// UI 予測ではランダム分岐の期待値を使う。実処理では成功判定後の値を渡す。
const RANDOM_HARVEST_EXPECTED_BASE = 32;
const MID_TEEN_TRAIT = "思春期";

export const WORK_COST_TYPES = {
  PHYSICAL: { body: 24, mind: 12 },
  BALANCED: { body: 18, mind: 18 },
  MENTAL: { body: 12, mind: 24 }
};

export const JOB_COST_TYPES = {
  "学業": WORK_COST_TYPES.MENTAL,
  "鍛錬": WORK_COST_TYPES.PHYSICAL,
  "農作業": WORK_COST_TYPES.PHYSICAL,
  "伐採": WORK_COST_TYPES.PHYSICAL,
  "狩猟": WORK_COST_TYPES.PHYSICAL,
  "漁": WORK_COST_TYPES.PHYSICAL,
  "採集": WORK_COST_TYPES.BALANCED,
  "内職": WORK_COST_TYPES.MENTAL,
  "魔法細工": WORK_COST_TYPES.MENTAL,
  "研究": WORK_COST_TYPES.MENTAL,
  "教育": WORK_COST_TYPES.MENTAL,
  "警備": WORK_COST_TYPES.PHYSICAL,
  "看護": WORK_COST_TYPES.BALANCED,
  "踊り子": WORK_COST_TYPES.BALANCED,
  "詩人": WORK_COST_TYPES.BALANCED,
  "シスター": WORK_COST_TYPES.MENTAL,
  "神官": WORK_COST_TYPES.MENTAL,
  "行商": WORK_COST_TYPES.BALANCED,
  "あんま": WORK_COST_TYPES.BALANCED,
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
const YOUTH_WORK_JOBS = ["農作業", "伐採", "狩猟", "漁", "採集", "内職"];

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
  if (hasMindTrait(person, COLD_SENSITIVE_TRAIT) && hasVillageTrait(village, WINTER_TRAIT)) {
    return SEASONAL_COST_MULTIPLIER;
  }
  return 1;
}

export function estimateBodyCost(base, vit, person = null, village = null) {
  const cost = statCostBase(base, vit) * getBodyCostMultiplier(person, village);
  return Math.round(cost);
}

export function estimateMindCost(base, statValue, person = null, village = null) {
  if (hasMindTrait(person, WORKAHOLIC_TRAIT)) {
    return 0;
  }
  const cost = statCostBase(base, statValue) * getMindCostMultiplier(person, village);
  return Math.round(cost);
}

export function rollBodyCost(base, vit, person = null, village = null, randomFloat = defaultRandomFloat) {
  const cost = statCostBase(base, vit) * getBodyCostMultiplier(person, village);
  return Math.round(cost * randomFloat(0.9, 1.1));
}

export function rollMindCost(base, statValue, person = null, village = null, randomFloat = defaultRandomFloat) {
  if (hasMindTrait(person, WORKAHOLIC_TRAIT)) {
    return 0;
  }
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
  if (hasBodyTrait(person, "大地の加護") && job === "農作業") mul *= 1.2;
  if (hasBodyTrait(person, "水中呼吸") && job === "漁") mul *= 1.5;
  if (hasMindTrait(person, "森の知恵") && job === "採集") mul *= 1.5;
  if (hasMindTrait(person, "海の知恵") && job === "漁") mul *= 1.5;
  if ((person?.hobby === "ハンティング" || person?.hobby === "狩猟") && job === "狩猟") mul *= 1.2;
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

export function calculateHuntYield(person, village, baseValue = RANDOM_HARVEST_EXPECTED_BASE) {
  const base = (Number(baseValue) || 0) * statProduct(person, "str", "cou");
  return Math.round(base * getLaborYieldMultiplier("狩猟", person, village));
}

export function calculateFishYield(person, village, baseValue = RANDOM_HARVEST_EXPECTED_BASE) {
  const base = (Number(baseValue) || 0) * statProduct(person, "vit", "cou");
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
  const base = 32 * statProduct(person, "dex", "ind");
  return Math.round(base * getLaborYieldMultiplier("内職", person, village));
}

export function calculateResearchYield(person, village) {
  const libraryMultiplier = village?.buildingFlags?.hasLibrary ? 1.2 : 1;
  return Math.round((30 * statProduct(person, "int", "mag")) * libraryMultiplier);
}

export function calculateGuardYield(person) {
  let amount = Math.round(12 * statProduct(person, "str", "eth"));
  if (hasBodyTrait(person, "夜目")) {
    amount = Math.round(amount * 1.2);
  }
  return Math.max(1, amount);
}

export function calculateTradingYield(person) {
  return Math.round(34 * statProduct(person, "chr", "int"));
}

export function calculateMagicCraftYield(person) {
  return Math.round(38 * statProduct(person, "dex", "mag"));
}

export function calculateNurseHeal(person, village) {
  let amount = Math.round(25 * statProduct(person, "mag", "eth"));
  if (village?.buildingFlags?.hasClinic) {
    amount = Math.round(amount * 1.2);
  }
  return amount;
}

export function calculatePriestMindHeal(person, village) {
  let amount = Math.round(8 * statProduct(person, "chr", "eth"));
  if (village?.buildingFlags?.hasChurch) {
    amount = Math.round(amount * 1.2);
  }
  if (hasBodyTrait(person, "澄んだ声") || hasBodyTrait(person, "通る声")) {
    amount = Math.round(amount * 1.2);
  }
  return amount;
}

export function calculateDancerHappiness(person, village) {
  let amount = Math.round(10 * statProduct(person, "chr", "sexdr"));
  if (village?.buildingFlags?.hasTavern) {
    amount = Math.round(amount * 1.2);
  }
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
  if (village?.buildingFlags?.hasTavern) {
    amount = Math.round(amount * 1.2);
  }
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

export function calculateMassageHeal(person) {
  return person?.bodySex === "男"
    ? Math.round(30 * statProduct(person, "str", "eth"))
    : Math.round(30 * statProduct(person, "chr", "sexdr"));
}

export function calculateMikoMana(person) {
  return Math.round(18 * statTripleProduct(person, "chr", "mag", "sexdr"));
}

export function calculateBunnySupport(person) {
  return Math.round(8 * statProduct(person, "chr", "sexdr"));
}

export function calculateAlchemyYield(person) {
  return Math.round(22 * statProduct(person, "mag", "int"));
}

export function calculateCopyBookYield(person) {
  return Math.round(20 * statProduct(person, "dex", "int"));
}

export function calculateWeavingYield(person) {
  let amount = Math.round(42 * statProduct(person, "dex", "ind"));
  if (hasBodyTrait(person, "梟の巫女")) {
    amount = Math.round(amount * 1.5);
  }
  if (hasBodyTrait(person, "梟の加護")) {
    amount = Math.round(amount * 1.2);
  }
  return amount;
}

export function calculateBrewingYield(person) {
  return {
    food: Math.round(34 * statProduct(person, "mag", "ind")),
    mana: Math.round(8 * statProduct(person, "mag", "ind")),
  };
}
