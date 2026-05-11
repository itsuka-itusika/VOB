import { refreshJobTable } from "./domain/jobTables.js";
import { getVillagerFoodConsumption, getVillagerWinterMaterialConsumption } from "./util.js";
import {
  ACTION_DEFEND,
  ACTION_TRAP,
  canPerformRaidAction,
  isRaidActionAssignable,
  isRaidActive
} from "./raidRules.js";

const JOB_NONE = "\u306a\u3057";
const JOB_REST = "\u4f11\u990a";
const JOB_LEISURE = "\u4f59\u6687";
const JOB_HEAL = "\u7642\u990a";
const JOB_LAST_MOMENTS = "\u81e8\u7d42";
const TRAIT_CRITICAL = "\u5371\u7be4";
const TRAIT_PACIFIST = "\u975e\u6226\u4e3b\u7fa9";
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
  "\u770b\u8b77",
  "\u3042\u3093\u307e"
]);
const RECOVERY_ASSIGNMENT_SET = new Set([
  "\u7642\u990a",
  "\u4f11\u990a",
  "\u4f59\u6687",
  "\u770b\u8b77",
  "\u3042\u3093\u307e"
]);

const JOB_WEIGHTS = {
  "\u5b66\u696d": { int: 2, ind: 2 },
  "\u935b\u932c": { str: 2, vit: 1.5, cou: 1 },
  "\u8fb2\u4f5c\u696d": { vit: 2, ind: 2 },
  "\u4f10\u63a1": { str: 2, ind: 2 },
  "\u72e9\u731f": { str: 2, cou: 2 },
  "\u6f01": { vit: 2, cou: 2 },
  "\u63a1\u96c6": { dex: 2, int: 2 },
  "\u5185\u8077": { dex: 2, ind: 2 },
  "\u9b54\u6cd5\u7d30\u5de5": { dex: 2, mag: 2 },
  "\u7814\u7a76": { int: 2, mag: 2 },
  "\u6559\u80b2": { int: 1.5, ind: 1.5, eth: 1.5, cou: 1.5 },
  "\u8b66\u5099": { str: 2, eth: 2 },
  "\u770b\u8b77": { mag: 2, eth: 2 },
  "\u8e0a\u308a\u5b50": { chr: 2, sexdr: 2 },
  "\u8a69\u4eba": { chr: 4 },
  "\u30b7\u30b9\u30bf\u30fc": { chr: 2, eth: 2 },
  "\u795e\u5b98": { chr: 2, eth: 2 },
  "\u884c\u5546": { chr: 2, int: 2 },
  "\u3042\u3093\u307e": { str: 1, dex: 1, chr: 1, sexdr: 1 },
  "\u5deb\u5973": { chr: 1.5, mag: 1.5, sexdr: 1.5 },
  "\u30d0\u30cb\u30fc": { chr: 2, sexdr: 2 },
  "\u932c\u91d1\u8853": { int: 2, mag: 2 },
  "\u5199\u672c": { dex: 2, int: 2 },
  "\u6a5f\u7e54\u308a": { dex: 2, ind: 2 },
  "\u91b8\u9020": { mag: 2, ind: 2 }
};

const JOB_BASE_SCORES = {
  "\u8fb2\u4f5c\u696d": 20,
  "\u4f10\u63a1": 20,
  "\u72e9\u731f": 14,
  "\u6f01": 14,
  "\u63a1\u96c6": 14,
  "\u5185\u8077": 8,
  "\u9b54\u6cd5\u7d30\u5de5": 0,
  "\u7814\u7a76": -8,
  "\u884c\u5546": 8,
  "\u932c\u91d1\u8853": 0,
  "\u5199\u672c": 8,
  "\u6a5f\u7e54\u308a": 8,
  "\u91b8\u9020": 14,
  "\u8b66\u5099": -8,
  "\u770b\u8b77": 8,
  "\u8e0a\u308a\u5b50": -8,
  "\u30b7\u30b9\u30bf\u30fc": -8,
  "\u3042\u3093\u307e": 8,
  "\u30d0\u30cb\u30fc": 8
};

function firstAvailable(candidates, table) {
  return candidates.find(item => table.includes(item)) || null;
}

function estimateMonthlyFoodCost(village) {
  const villagers = Array.isArray(village.villagers) ? village.villagers : [];
  return villagers.reduce((sum, person) => {
    return sum + getVillagerFoodConsumption(person);
  }, 0);
}

function estimateMonthlyMaterialCost(village) {
  const villagers = Array.isArray(village.villagers) ? village.villagers : [];
  return village.villageTraits.includes("\u51ac")
    ? villagers.reduce((sum, person) => sum + getVillagerWinterMaterialConsumption(person), 0)
    : 0;
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
    monthlyMaterialCost,
    village
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
  if (JOB_MATERIAL_SET.has(job)) {
    bonus += context.materialSeverity * 55;
  }
  if (JOB_FUNDS_SET.has(job)) {
    bonus -= 24;
    bonus += Math.max(0, context.fundsSeverity - 1.05) * 45;
    if (context.foodSeverity > 0.35 || context.materialSeverity > 0.35 || context.recoverySeverity > 0.35) {
      bonus -= 18;
    }
  }

  return bonus;
}

function hasTrait(person, trait) {
  return (Array.isArray(person.bodyTraits) && person.bodyTraits.includes(trait))
    || (Array.isArray(person.mindTraits) && person.mindTraits.includes(trait));
}

function getJobTraitMultiplier(person, job, village) {
  let mul = 1;
  const villageTraits = Array.isArray(village?.villageTraits) ? village.villageTraits : [];
  if (villageTraits.includes("豊穣") && ["農作業", "伐採", "狩猟", "漁", "採集"].includes(job)) mul *= 2;
  if (villageTraits.includes("秋") && ["農作業", "採集"].includes(job)) mul *= 1.5;
  if (villageTraits.includes("冬") && job === "農作業") mul *= 0.5;
  if (villageTraits.includes("冬") && job === "狩猟") mul *= 1.2;
  if (villageTraits.includes("冷夏") && ["農作業", "伐採"].includes(job)) mul *= 0.5;

  if (hasTrait(person, "緑の指") && ["農作業", "伐採", "採集"].includes(job)) mul *= 1.2;
  if (hasTrait(person, "大地の巫女") && job === "農作業") mul *= 1.5;
  if (hasTrait(person, "大地の加護") && job === "農作業") mul *= 1.2;
  if (hasTrait(person, "熟練農夫") && job === "農作業") mul *= 1.3;
  if (hasTrait(person, "達人農夫") && job === "農作業") mul *= 1.5;
  if (hasTrait(person, "熟練木樵") && job === "伐採") mul *= 1.3;
  if (hasTrait(person, "達人木樵") && job === "伐採") mul *= 1.5;
  if (hasTrait(person, "熟練狩人") && job === "狩猟") mul *= 1.3;
  if (hasTrait(person, "達人狩人") && job === "狩猟") mul *= 1.5;
  if (hasTrait(person, "熟練漁師") && job === "漁") mul *= 1.3;
  if (hasTrait(person, "達人漁師") && job === "漁") mul *= 1.5;
  if (hasTrait(person, "飛行") && ["狩猟", "採集"].includes(job)) mul *= 1.2;
  if (hasTrait(person, "月の巫女") && job === "狩猟") mul *= 1.5;
  if (hasTrait(person, "月の加護") && job === "狩猟") mul *= 1.2;
  if (hasTrait(person, "夜目") && ["警備", "狩猟"].includes(job)) mul *= 1.2;
  if (hasTrait(person, "水中呼吸") && job === "漁") mul *= 1.5;
  if (hasTrait(person, "森の知恵") && job === "採集") mul *= 1.5;
  if (hasTrait(person, "海の知恵") && job === "漁") mul *= 1.5;
  if ((person.hobby === "ハンティング" || person.hobby === "狩猟") && job === "狩猟") mul *= 1.2;
  if (hasTrait(person, "思春期") && ["農作業", "伐採", "狩猟", "漁", "採集", "内職"].includes(job)) mul *= 0.8;
  return mul;
}

function getJobWeights(person, job) {
  if (job === "\u3042\u3093\u307e") {
    if (person.bodySex === "\u7537") return { str: 2, dex: 2 };
    if (person.bodySex === "\u5973") return { chr: 2, sexdr: 2 };
  }
  return JOB_WEIGHTS[job];
}

function scoreJob(person, job, context) {
  const weights = getJobWeights(person, job);
  if (!weights) return -Infinity;

  const baseScore = JOB_BASE_SCORES[job] || 0;
  const priorityBonus = context ? getPriorityBonus(job, context) : 0;

  const rawScore = Object.entries(weights).reduce((score, [stat, weight]) => {
    return score + (Number(person[stat]) || 0) * weight;
  }, baseScore + priorityBonus);
  return rawScore * getJobTraitMultiplier(person, job, context?.village);
}

function hasLowRecoveryNeed(person) {
  return (Number(person.hp) || 0) <= 33 || (Number(person.mp) || 0) <= 33;
}

function chooseBestJob(person, context) {
  const jobTable = Array.isArray(person.jobTable) ? person.jobTable : [];
  const candidateJobs = jobTable.filter(job => job !== JOB_NONE);
  const workCandidates = hasLowRecoveryNeed(person)
    ? candidateJobs
    : candidateJobs.filter(job => !RECOVERY_ASSIGNMENT_SET.has(job));
  const candidates = workCandidates.length > 0 ? workCandidates : candidateJobs;
  let bestJob = firstAvailable([JOB_NONE], jobTable) || jobTable[0] || JOB_NONE;
  let bestScore = -Infinity;

  candidates.forEach(job => {
    const score = scoreJob(person, job, context);
    if (score > bestScore) {
      bestScore = score;
      bestJob = job;
    }
  });

  return bestJob;
}

function chooseWorkAction(person, actionTable, job) {
  if (actionTable.includes(job)) return job;

  const nonRecoveryAction = actionTable.find(action => action !== JOB_NONE && !RECOVERY_ASSIGNMENT_SET.has(action));
  return nonRecoveryAction || firstAvailable([JOB_NONE], actionTable) || actionTable[0] || job;
}

function chooseAssignment(person, village, context) {
  refreshJobTable(person, village || undefined);

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
      job: currentJob,
      action: firstAvailable([JOB_HEAL, JOB_REST, JOB_LEISURE, JOB_NONE], actionTable) || currentJob
    };
  }

  if (person.mp <= 33) {
    return {
      job: currentJob,
      action: firstAvailable([JOB_REST, JOB_LEISURE, JOB_HEAL, JOB_NONE], actionTable) || currentJob
    };
  }

  const job = chooseBestJob(person, context);
  return {
    job,
    action: chooseWorkAction(person, actionTable, job)
  };
}

function getHealthFactor(person) {
  const hp = Number(person.hp) || 0;
  const mp = Number(person.mp) || 0;
  return Math.max(0, Math.min(1.2, ((hp * 0.75) + (mp * 0.25)) / 100));
}

function canUseAction(person, action) {
  return Array.isArray(person.actionTable) && person.actionTable.includes(action);
}

function chooseRaidFallbackAction(person, currentJob, currentAction) {
  const actionTable = Array.isArray(person.actionTable) ? person.actionTable : [];
  const isRaidAction = currentAction === ACTION_DEFEND || currentAction === ACTION_TRAP;

  if (!isRaidAction && actionTable.includes(currentAction)) {
    return currentAction;
  }
  if (actionTable.includes(currentJob)) {
    return currentJob;
  }
  return firstAvailable([JOB_REST, JOB_LEISURE, JOB_HEAL, JOB_NONE], actionTable) ||
    actionTable[0] ||
    JOB_NONE;
}

function getExpectedDefenderDamage(person) {
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  if (mindTraits.includes(TRAIT_PACIFIST)) return 0;

  const physical = ((Number(person.str) || 0) * (Number(person.cou) || 0) / 400) * 50;
  const magical = ((Number(person.mag) || 0) * (Number(person.cou) || 0) / 400) * 25;
  const traitMultiplier = mindTraits.includes("歴戦") ? 1.2 : 1;
  return Math.max(physical, magical) * traitMultiplier;
}

function getExpectedTrapDamage(person) {
  return ((Number(person.dex) || 0) * (Number(person.int) || 0) / 400) * 30;
}

function isSafeDefender(person) {
  return (Number(person.hp) || 0) >= 55 && (Number(person.mp) || 0) >= 20;
}

function isSafeTrapMaker(person) {
  return (Number(person.hp) || 0) >= 35 && (Number(person.mp) || 0) >= 10;
}

function getDefenderScore(person) {
  const attack = getExpectedDefenderDamage(person);
  if (attack <= 0) return -Infinity;

  return (
    attack * 2.2
    + (Number(person.vit) || 0) * 1.4
    + (Number(person.cou) || 0) * 1.8
    + (Number(person.hp) || 0) * 0.45
  ) * getHealthFactor(person);
}

function getTrapScore(person) {
  const damage = getExpectedTrapDamage(person);
  return (
    damage * 4
    + (Number(person.dex) || 0) * 2.65
    + (Number(person.int) || 0) * 2.45
    + (Number(person.ind) || 0) * 1.0
    + (Number(person.cou) || 0) * 0.4
    + (Number(person.mp) || 0) * 0.1
  );
}

function getRaidAssignmentProfile(person, village) {
  const currentJob = person.job;
  const currentAction = person.action;
  refreshJobTable(person, village);

  const keptJob = Array.isArray(person.jobTable) && person.jobTable.includes(currentJob)
    ? currentJob
    : person.job;
  const fallbackAction = chooseRaidFallbackAction(person, keptJob, currentAction);
  const bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
  const assignable = isRaidActionAssignable(person);

  const defenderDamage = getExpectedDefenderDamage(person);
  const trapDamage = getExpectedTrapDamage(person);
  const canDefend = assignable && canUseAction(person, ACTION_DEFEND) && isSafeDefender(person) && defenderDamage >= 8;
  const canTrap = assignable && canUseAction(person, ACTION_TRAP) && isSafeTrapMaker(person) && trapDamage >= 6;

  return {
    person,
    fallback: { job: keptJob, action: fallbackAction },
    forcedNormal: bodyTraits.includes(TRAIT_CRITICAL) || !assignable,
    canDefend,
    canTrap,
    defenderScore: canDefend ? getDefenderScore(person) : -Infinity,
    trapScore: canTrap ? getTrapScore(person) : -Infinity,
    defenderDamage: canDefend ? defenderDamage : 0,
    trapDamage: canTrap ? trapDamage : 0
  };
}

function getMinimumDefenders(village, profiles) {
  const enemyCount = Array.isArray(village.raidEnemies) ? village.raidEnemies.length : 0;
  const activeProfiles = profiles.filter(profile => !profile.forcedNormal && (profile.canDefend || profile.canTrap));
  const defenderOptions = activeProfiles.filter(profile => profile.canDefend && Number.isFinite(profile.defenderScore));

  if (defenderOptions.length === 0 || activeProfiles.length === 0) {
    return 0;
  }

  return Math.min(
    defenderOptions.length,
    Math.max(1, Math.ceil(Math.min(enemyCount || 1, activeProfiles.length) / 2))
  );
}

function buildRaidAssignments(village, targets) {
  const assignments = new Map();
  const profiles = targets.map(person => getRaidAssignmentProfile(person, village));
  const minimumDefenders = getMinimumDefenders(village, profiles);
  const defenderSlots = new Set(
    profiles
      .filter(profile => !profile.forcedNormal && profile.canDefend && Number.isFinite(profile.defenderScore))
      .sort((a, b) => b.defenderScore - a.defenderScore)
      .slice(0, minimumDefenders)
      .map(profile => profile.person)
  );

  profiles.forEach(profile => {
    if (profile.forcedNormal || (!profile.canDefend && !profile.canTrap)) {
      assignments.set(profile.person, profile.fallback);
      return;
    }

    if (defenderSlots.has(profile.person)) {
      assignments.set(profile.person, { job: profile.fallback.job, action: ACTION_DEFEND });
      return;
    }

    if (profile.canTrap && (!profile.canDefend || profile.trapDamage >= profile.defenderDamage * 0.82)) {
      assignments.set(profile.person, { job: profile.fallback.job, action: ACTION_TRAP });
      return;
    }

    if (profile.canDefend) {
      assignments.set(profile.person, { job: profile.fallback.job, action: ACTION_DEFEND });
      return;
    }

    assignments.set(profile.person, profile.fallback);
  });

  return assignments;
}

export function autoAssignJobs(village) {
  let changed = 0;
  const priorityContext = buildVillagePriorityContext(village);
  const targets = village.villagers.filter(person => !person.assignmentLocked);

  targets.forEach(person => {
    const next = chooseAssignment(person, village, priorityContext);

    if (person.job !== next.job || person.action !== next.action) {
      changed++;
    }
    person.job = next.job;
    person.action = next.action;
  });

  const lockedCount = village.villagers.filter(person => person.assignmentLocked).length;
  village.log(`自動割り振り: ${changed}人の仕事/行動を更新しました。固定${lockedCount}人は除外 (食料${priorityContext.foodSeverity.toFixed(2)}, 回復${priorityContext.recoverySeverity.toFixed(2)}, 資材${priorityContext.materialSeverity.toFixed(2)}, 資金${priorityContext.fundsSeverity.toFixed(2)})`);
}

export function autoAssignRaidActions(village) {
  if (!isRaidActive(village)) {
    village.log("襲撃は発生していません。");
    return;
  }

  let changed = 0;
  let defenders = 0;
  let trapMakers = 0;
  let nonParticipants = 0;
  const targets = Array.isArray(village.villagers) ? village.villagers : [];
  const raidAssignments = buildRaidAssignments(village, targets);

  targets.forEach(person => {
    const currentJob = person.job;
    const currentAction = person.action;
    const next = raidAssignments.get(person);
    if (!next) return;

    if (currentAction !== next.action || currentJob !== next.job) {
      changed++;
    }
    person.job = next.job;
    person.action = next.action;

    if (person.action === ACTION_DEFEND && canPerformRaidAction(person, ACTION_DEFEND)) defenders++;
    else if (person.action === ACTION_TRAP && canPerformRaidAction(person, ACTION_TRAP)) trapMakers++;
    else nonParticipants++;
  });

  village.log(`迎撃割り振り: ${changed}人を更新しました。迎撃${defenders}人、罠作成${trapMakers}人、不参加${nonParticipants}人`);
}
