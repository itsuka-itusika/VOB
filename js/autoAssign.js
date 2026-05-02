import { refreshJobTable } from "./createVillagers.js";

const JOB_NONE = "\u306a\u3057";
const JOB_REST = "\u4f11\u990a";
const JOB_LEISURE = "\u4f59\u6687";
const JOB_HEAL = "\u7642\u990a";
const JOB_LAST_MOMENTS = "\u81e8\u7d42";
const TRAIT_CRITICAL = "\u5371\u7be4";
const TRAIT_WOUNDED = "\u8ca0\u50b7";
const TRAIT_PACIFIST = "\u975e\u6226\u4e3b\u7fa9";
const TRAIT_UNDER_RAID = "\u8972\u6483\u4e2d";
const ACTION_DEFEND = "\u8fce\u6483";
const ACTION_TRAP = "\u7f60\u4f5c\u6210";
const JOB_FOOD_SET = new Set([
  "\u8fb2\u4f5c\u696d",
  "\u72e9\u731f",
  "\u6f01",
  "\u63a1\u96c6",
  "\u91b8\u9020"
]);
const JOB_FOOD_PRIORITY = {
  "\u8fb2\u4f5c\u696d": 1.15,
  "\u63a1\u96c6": 1.05,
  "\u91b8\u9020": 1.0,
  "\u72e9\u731f": 0.82,
  "\u6f01": 0.8
};
const JOB_MATERIAL_SET = new Set([
  "\u4f10\u63a1",
  "\u63a1\u96c6"
]);
const JOB_FUNDS_SET = new Set([
  "\u5185\u8077",
  "\u9b54\u6cd5\u7d30\u5de5",
  "\u884c\u5546",
  "\u932c\u91d1\u8853",
  "\u5199\u672c",
  "\u6a5f\u7e54\u308a"
]);
const JOB_RECOVERY_SET = new Set([
  "\u770b\u8b77"
]);
const ACTION_RECOVERY_SET = [
  "\u7642\u990a",
  "\u4f11\u990a",
  "\u4f59\u6687",
  "\u770b\u8b77",
  "\u3042\u3093\u307e"
];

const JOB_WEIGHTS = {
  "\u5b66\u696d": { int: 2, ind: 2, eth: 0.5 },
  "\u935b\u932c": { str: 2, vit: 1.5, cou: 1.5 },
  "\u8fb2\u4f5c\u696d": { vit: 2.1, str: 1.1, ind: 1.1 },
  "\u4f10\u63a1": { str: 2.05, vit: 1.55, cou: 0.5 },
  "\u72e9\u731f": { str: 2.1, cou: 2.1, vit: 0.35 },
  "\u6f01": { vit: 2.15, cou: 1.85, int: 0.35 },
  "\u63a1\u96c6": { dex: 1.7, int: 1.7, ind: 1.1 },
  "\u5185\u8077": { dex: 2, ind: 1.5, int: 0.5 },
  "\u9b54\u6cd5\u7d30\u5de5": { mag: 2, dex: 1.5, int: 1 },
  "\u7814\u7a76": { int: 2, mag: 1.5, ind: 1 },
  "\u6559\u80b2": { int: 1.5, chr: 1.5, eth: 1.5 },
  "\u8b66\u5099": { str: 1.5, vit: 1.5, cou: 2 },
  "\u770b\u8b77": { eth: 2, mag: 1.5, int: 1 },
  "\u8e0a\u308a\u5b50": { chr: 2, dex: 1.5, sexdr: 1 },
  "\u8a69\u4eba": { chr: 2, mag: 1, int: 1 },
  "\u30b7\u30b9\u30bf\u30fc": { eth: 2, mag: 1.5, chr: 1 },
  "\u795e\u5b98": { mag: 2, eth: 1.5, chr: 1 },
  "\u884c\u5546": { chr: 2, ind: 1.5, int: 1 },
  "\u3042\u3093\u307e": { dex: 2, eth: 1.5, chr: 1 },
  "\u5deb\u5973": { mag: 2, eth: 1.5, chr: 1.5 },
  "\u30d0\u30cb\u30fc": { chr: 2, sexdr: 1.5, dex: 1 },
  "\u932c\u91d1\u8853": { int: 2, mag: 1.5, dex: 1 },
  "\u5199\u672c": { int: 2, ind: 1.5, dex: 1 },
  "\u6a5f\u7e54\u308a": { dex: 2, ind: 1.5, chr: 0.5 },
  "\u91b8\u9020": { dex: 1.5, int: 1.5, ind: 1 }
};

const JOB_BASE_SCORES = {
  "\u8fb2\u4f5c\u696d": 20,
  "\u4f10\u63a1": 18,
  "\u72e9\u731f": 14,
  "\u6f01": 14,
  "\u63a1\u96c6": 18,
  "\u5185\u8077": 14,
  "\u9b54\u6cd5\u7d30\u5de5": 12,
  "\u884c\u5546": 12,
  "\u932c\u91d1\u8853": 12,
  "\u5199\u672c": 12,
  "\u6a5f\u7e54\u308a": 14,
  "\u91b8\u9020": 14,
  "\u8b66\u5099": -8,
  "\u8e0a\u308a\u5b50": -8,
  "\u30b7\u30b9\u30bf\u30fc": -8
};

function firstAvailable(candidates, table) {
  return candidates.find(item => table.includes(item)) || null;
}

function estimateMonthlyFoodCost(village) {
  const villagers = Array.isArray(village.villagers) ? village.villagers : [];
  return villagers.reduce((sum, person) => {
    const traits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
    if (traits.includes("\u5927\u98df\u3044")) return sum + 12;
    if (traits.includes("\u5c11\u98df")) return sum + 8;
    return sum + 10;
  }, 0);
}

function estimateMonthlyMaterialCost(village) {
  const villagers = Array.isArray(village.villagers) ? village.villagers : [];
  return village.villageTraits.includes("\u51ac") ? villagers.length * 10 : 0;
}

function normalizeSeverity(value) {
  return Math.max(0, Math.min(1.35, value));
}

function buildVillagePriorityContext(village) {
  const villagers = Array.isArray(village.villagers) ? village.villagers : [];
  const population = villagers.length || 1;
  const monthlyFoodCost = estimateMonthlyFoodCost(village);
  const monthlyMaterialCost = estimateMonthlyMaterialCost(village);
  const avgHp = villagers.reduce((sum, person) => sum + (Number(person.hp) || 0), 0) / population;
  const avgMp = villagers.reduce((sum, person) => sum + (Number(person.mp) || 0), 0) / population;
  const avgRecovery = avgHp * 0.55 + avgMp * 0.45;
  const lowConditionCount = villagers.filter(person => (Number(person.hp) || 0) <= 55 || (Number(person.mp) || 0) <= 55).length;
  const lowConditionRatio = lowConditionCount / population;
  const foodProjected = (Number(village.food) || 0) - monthlyFoodCost;
  const foodSeverity = foodProjected < 0
    ? normalizeSeverity(1 + Math.abs(foodProjected) / Math.max(20, monthlyFoodCost))
    : normalizeSeverity((monthlyFoodCost * 1.3 - (Number(village.food) || 0)) / Math.max(20, monthlyFoodCost));
  const recoverySeverity = normalizeSeverity(
    Math.max(0, (62 - avgRecovery) / 18) + Math.max(0, lowConditionRatio - 0.25)
  );
  const materialBaseline = Math.max(20, monthlyMaterialCost + population * 4);
  const materialSeverity = normalizeSeverity((materialBaseline - (Number(village.materials) || 0)) / materialBaseline);
  const fundsBaseline = Math.max(40, population * 12 + (Number(village.building) || 0) * 0.5);
  const fundsSeverity = normalizeSeverity((fundsBaseline - (Number(village.funds) || 0)) / fundsBaseline);

  return {
    foodSeverity,
    recoverySeverity,
    materialSeverity,
    fundsSeverity,
    avgHp,
    avgMp,
    avgRecovery,
    monthlyFoodCost,
    monthlyMaterialCost
  };
}

function getPriorityBonus(job, context) {
  let bonus = 0;

  if (JOB_FOOD_SET.has(job)) {
    bonus += context.foodSeverity * 120 * (JOB_FOOD_PRIORITY[job] || 1);
  }
  if (JOB_RECOVERY_SET.has(job)) {
    bonus += context.recoverySeverity * 85;
  }

  return bonus;
}

function scoreJob(person, job, context) {
  const weights = JOB_WEIGHTS[job];
  if (!weights) return -Infinity;

  const baseScore = JOB_BASE_SCORES[job] || 0;
  const priorityBonus = context ? getPriorityBonus(job, context) : 0;

  return Object.entries(weights).reduce((score, [stat, weight]) => {
    return score + (Number(person[stat]) || 0) * weight;
  }, baseScore + priorityBonus);
}

function chooseBestJob(person, context) {
  let bestJob = firstAvailable([JOB_NONE], person.jobTable) || person.jobTable[0] || JOB_NONE;
  let bestScore = -Infinity;

  person.jobTable.forEach(job => {
    if (job === JOB_NONE) return;
    const score = scoreJob(person, job, context);
    if (score > bestScore) {
      bestScore = score;
      bestJob = job;
    }
  });

  return bestJob;
}

function chooseRecoveryAction(person, actionTable, context) {
  if (!context || context.recoverySeverity <= 0) return null;

  if ((Number(person.hp) || 0) <= 45 || (Number(person.mp) || 0) <= 45) {
    if ((Number(person.hp) || 0) <= (Number(person.mp) || 0)) {
      return firstAvailable(["\u7642\u990a", "\u4f11\u990a", "\u4f59\u6687"], actionTable);
    }
    return firstAvailable(["\u4f59\u6687", "\u7642\u990a", "\u4f11\u990a"], actionTable);
  }

  if (context.recoverySeverity >= 0.9 && ((Number(person.hp) || 0) <= 60 || (Number(person.mp) || 0) <= 60)) {
    return firstAvailable(ACTION_RECOVERY_SET, actionTable);
  }

  if (context.recoverySeverity >= 1.1 && ((Number(person.eth) || 0) >= 16 || (Number(person.mag) || 0) >= 16)) {
    return firstAvailable(["\u770b\u8b77", "\u3042\u3093\u307e"], actionTable);
  }

  return null;
}

function chooseAssignment(person, village, context) {
  refreshJobTable(person);

  const jobTable = Array.isArray(person.jobTable) ? person.jobTable : [];
  const actionTable = Array.isArray(person.actionTable) ? person.actionTable : [];
  const currentJob = jobTable.includes(person.job) ? person.job : firstAvailable([JOB_NONE], jobTable) || jobTable[0] || JOB_NONE;

  if (person.bodyTraits.includes(TRAIT_CRITICAL)) {
    return {
      job: firstAvailable([JOB_LAST_MOMENTS, JOB_NONE], jobTable) || currentJob,
      action: firstAvailable([JOB_LAST_MOMENTS, JOB_HEAL, JOB_REST, JOB_NONE], actionTable) || currentJob
    };
  }

  if (person.hp <= 33) {
    return {
      job: firstAvailable([JOB_NONE], jobTable) || currentJob,
      action: firstAvailable([JOB_HEAL, JOB_REST, JOB_LEISURE, JOB_NONE], actionTable) || currentJob
    };
  }

  if (person.mp <= 33) {
    return {
      job: firstAvailable([JOB_NONE], jobTable) || currentJob,
      action: firstAvailable([JOB_REST, JOB_LEISURE, JOB_HEAL, JOB_NONE], actionTable) || currentJob
    };
  }

  const recoveryAction = chooseRecoveryAction(person, actionTable, context);
  const job = chooseBestJob(person, context);
  return {
    job,
    action: recoveryAction || (actionTable.includes(job) ? job : firstAvailable([JOB_REST, JOB_LEISURE, JOB_NONE], actionTable) || job)
  };
}

function isRaidActive(village) {
  return village.villageTraits.includes(TRAIT_UNDER_RAID)
    && !village.isRaidProcessDone
    && Array.isArray(village.raidEnemies)
    && village.raidEnemies.length > 0;
}

function getHealthFactor(person) {
  const hp = Number(person.hp) || 0;
  const mp = Number(person.mp) || 0;
  return Math.max(0, Math.min(1.2, ((hp * 0.75) + (mp * 0.25)) / 100));
}

function canUseAction(person, action) {
  return Array.isArray(person.actionTable) && person.actionTable.includes(action);
}

function getDefenderScore(person) {
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  if (mindTraits.includes(TRAIT_PACIFIST)) return -Infinity;

  const physical = ((Number(person.str) || 0) * (Number(person.cou) || 0) / 400) * 50;
  const magical = ((Number(person.mag) || 0) * (Number(person.cou) || 0) / 400) * 25;
  const attack = Math.max(physical, magical);

  return (
    attack * 2.2
    + (Number(person.vit) || 0) * 1.4
    + (Number(person.cou) || 0) * 1.8
    + (Number(person.hp) || 0) * 0.45
  ) * getHealthFactor(person);
}

function getTrapScore(person) {
  return (
    (Number(person.dex) || 0) * 2.4
    + (Number(person.int) || 0) * 2.2
    + (Number(person.ind) || 0) * 0.9
    + (Number(person.cou) || 0) * 0.4
    + (Number(person.hp) || 0) * 0.2
  ) * getHealthFactor(person);
}

function chooseRaidAssignment(person) {
  refreshJobTable(person);

  const normal = chooseAssignment(person, null, null);
  const bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];

  if (bodyTraits.includes(TRAIT_CRITICAL) || person.hp <= 33) {
    return normal;
  }

  if (bodyTraits.includes(TRAIT_WOUNDED) && person.hp <= 55) {
    return normal;
  }

  if (!canUseAction(person, ACTION_DEFEND) && !canUseAction(person, ACTION_TRAP)) {
    return normal;
  }

  const defenderScore = canUseAction(person, ACTION_DEFEND) ? getDefenderScore(person) : -Infinity;
  const trapScore = canUseAction(person, ACTION_TRAP) ? getTrapScore(person) : -Infinity;

  if (person.hp <= 48 || person.mp <= 20) {
    if (trapScore >= 90 && trapScore > defenderScore) {
      return { job: normal.job, action: ACTION_TRAP };
    }
    return normal;
  }

  if (trapScore >= 74 && trapScore >= defenderScore * 0.88) {
    return { job: normal.job, action: ACTION_TRAP };
  }

  if (defenderScore >= 82) {
    return { job: normal.job, action: ACTION_DEFEND };
  }

  return normal;
}

export function autoAssignJobs(village) {
  let changed = 0;
  const raidMode = isRaidActive(village);
  const priorityContext = buildVillagePriorityContext(village);
  let defenders = 0;
  let trapMakers = 0;
  let nonParticipants = 0;

  village.villagers.forEach(person => {
    const next = raidMode ? chooseRaidAssignment(person) : chooseAssignment(person, village, priorityContext);
    if (person.job !== next.job || person.action !== next.action) {
      changed++;
    }
    person.job = next.job;
    person.action = next.action;

    if (raidMode) {
      if (person.action === ACTION_DEFEND) defenders++;
      else if (person.action === ACTION_TRAP) trapMakers++;
      else nonParticipants++;
    }
  });

  if (raidMode) {
    village.log(`\u81ea\u52d5\u5272\u308a\u632f\u308a(\u8fce\u6483): ${changed}\u4eba\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f\u3002\u8fce\u6483${defenders}\u4eba\u3001\u7f60\u4f5c\u6210${trapMakers}\u4eba\u3001\u4e0d\u53c2\u52a0${nonParticipants}\u4eba`);
  } else {
    village.log(`\u81ea\u52d5\u5272\u308a\u632f\u308a: ${changed}\u4eba\u306e\u4ed5\u4e8b/\u884c\u52d5\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f (食料${priorityContext.foodSeverity.toFixed(2)}, 回復${priorityContext.recoverySeverity.toFixed(2)}, 資材${priorityContext.materialSeverity.toFixed(2)}, 資金${priorityContext.fundsSeverity.toFixed(2)})`);
  }
}
