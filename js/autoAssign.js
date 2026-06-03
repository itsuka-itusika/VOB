import {
  ACTION_CRADLE,
  ACTION_NONE,
  ACTION_REST,
  ACTION_LEISURE,
  isTemporaryAction,
  refreshJobTable,
  setPreferredAction
} from "./domain/jobTables.js";
import { getVillagerFoodConsumption, getVillagerWinterMaterialConsumption } from "./util.js";
import {
  ACTION_DEFEND,
  ACTION_FORTIFY,
  ACTION_SHOOT,
  ACTION_TRAP,
  canFortifyInRaid,
  canDefendInRaid,
  canMakeTrapInRaid,
  canPerformRaidAction,
  canShootInRaid,
  isRaidAction,
  isRaidActive
} from "./raidRules.js";

const JOB_NONE = ACTION_NONE;
const JOB_REST = ACTION_REST;
const JOB_LEISURE = ACTION_LEISURE;
const JOB_HEAL = "\u7642\u990a";
const JOB_LAST_MOMENTS = "\u81e8\u7d42";
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
  "\u884c\u5546",
  "\u4e01\u7a1a",
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
  "\u8fb2\u4f5c\u696d": { vit: 2, ind: 2 },
  "\u4f10\u63a1": { str: 2, ind: 2 },
  "\u72e9\u731f": { str: 2, cou: 2 },
  "\u6f01": { vit: 2, cou: 2 },
  "\u63a1\u96c6": { dex: 2, int: 2 },
  "\u5185\u8077": { dex: 2, ind: 2 },
  "\u7814\u7a76": { int: 2, mag: 2 },
  "\u7814\u7a76\u52a9\u624b": { int: 2, mag: 2 },
  "\u8b66\u5099": { str: 2, eth: 2 },
  "\u770b\u8b77": { mag: 2, eth: 2 },
  "\u8e0a\u308a\u5b50": { chr: 2, sexdr: 2 },
  "\u8a69\u4eba": { chr: 4 },
  "\u30b7\u30b9\u30bf\u30fc": { chr: 2, eth: 2 },
  "\u795e\u5b98": { chr: 2, eth: 2 },
  "\u884c\u5546": { chr: 2, int: 2 },
  "\u4e01\u7a1a": { chr: 2, int: 2 },
  "\u3042\u3093\u307e": { str: 1, dex: 1, chr: 1, sexdr: 1 },
  "\u5deb\u5973": { chr: 1.5, mag: 1.5, sexdr: 1.5 },
  "\u30d0\u30cb\u30fc": { chr: 2, sexdr: 2 },
  "\u932c\u91d1\u8853": { int: 2, mag: 2 },
  "\u5199\u672c": { vit: 2, int: 2 },
  "\u6a5f\u7e54\u308a": { dex: 2, ind: 2 },
  "\u91b8\u9020": { mag: 2, vit: 2, ind: 2 }
};

const JOB_BASE_SCORES = {
  "\u8fb2\u4f5c\u696d": 20,
  "\u4f10\u63a1": 20,
  "\u72e9\u731f": 14,
  "\u6f01": 14,
  "\u63a1\u96c6": 14,
  "\u5185\u8077": 8,
  "\u7814\u7a76": -8,
  "\u7814\u7a76\u52a9\u624b": -8,
  "\u884c\u5546": 8,
  "\u4e01\u7a1a": 8,
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
  if (villageTraits.includes("豊穣") && ["農作業", "伐採", "狩猟", "漁", "採集", "醸造"].includes(job)) mul *= 2;
  if (villageTraits.includes("秋") && ["農作業", "採集", "醸造"].includes(job)) mul *= 1.5;
  if (villageTraits.includes("夏") && job === "漁") mul *= 1.2;
  if (villageTraits.includes("冬") && job === "農作業") mul *= 0.5;
  if (villageTraits.includes("冬") && job === "狩猟") mul *= 1.2;
  if (villageTraits.includes("冷夏") && ["農作業", "伐採"].includes(job)) mul *= 0.5;

  if (hasTrait(person, "緑の指") && ["農作業", "伐採", "採集", "醸造"].includes(job)) mul *= 1.2;
  if (hasTrait(person, "大地の巫女") && ["農作業", "醸造"].includes(job)) mul *= 1.5;
  if (hasTrait(person, "大地の加護") && ["農作業", "醸造"].includes(job)) mul *= 1.2;
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
  if (hasTrait(person, "水中呼吸") && job === "漁") mul *= 2;
  if (hasTrait(person, "森の知恵") && job === "採集") mul *= 1.2;
  if (hasTrait(person, "海の知恵") && job === "漁") mul *= 1.2;
  if ((person.hobby === "ハンティング" || person.hobby === "狩猟") && job === "狩猟") mul *= 1.1;
  if (hasTrait(person, "思春期") && ["農作業", "伐採", "狩猟", "漁", "採集", "内職", "丁稚", "研究助手"].includes(job)) mul *= 0.8;
  return mul;
}

function getJobWeights(person, job) {
  if (job === "\u3042\u3093\u307e") {
    if (person.bodySex === "\u7537") return { str: 2, int: 2 };
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
  const preferredTable = Array.isArray(person.jobTable) ? person.jobTable : [];
  const candidateJobs = preferredTable.filter(job => job !== JOB_NONE);
  const workCandidates = hasLowRecoveryNeed(person)
    ? candidateJobs
    : candidateJobs.filter(job => !RECOVERY_ASSIGNMENT_SET.has(job));
  const candidates = workCandidates.length > 0 ? workCandidates : candidateJobs;
  let bestJob = candidates[0] || JOB_NONE;
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

function chooseWorkAction(person, actionTable, preferredAction) {
  if (actionTable.includes(preferredAction)) return preferredAction;

  const nonRecoveryAction = actionTable.find(action => action !== JOB_NONE && !RECOVERY_ASSIGNMENT_SET.has(action));
  return nonRecoveryAction || actionTable[0] || preferredAction || JOB_NONE;
}

function chooseRecoveryAction(person, actionTable, currentAction) {
  if (isTemporaryAction(currentAction) && actionTable.includes(currentAction)) {
    return currentAction;
  }

  if ((Number(person.hp) || 0) <= (Number(person.mp) || 0)) {
    return firstAvailable([JOB_REST, JOB_LEISURE], actionTable) || currentAction;
  }
  return firstAvailable([JOB_LEISURE, JOB_REST], actionTable) || currentAction;
}

function chooseAssignment(person, village, context) {
  refreshJobTable(person, village || undefined);

  const actionTable = Array.isArray(person.actionTable) ? person.actionTable : [];
  const preferredTable = Array.isArray(person.jobTable) ? person.jobTable : [];
  const currentAction = String(person.action || JOB_NONE).trim() || JOB_NONE;
  const currentPreferred = person.preferredAction ||
    (preferredTable.includes(person.job) ? person.job : JOB_NONE);

  if (actionTable.length === 1 && [ACTION_CRADLE, JOB_HEAL, JOB_LAST_MOMENTS].includes(actionTable[0])) {
    return {
      preferredAction: actionTable[0] === ACTION_CRADLE ? ACTION_CRADLE : currentPreferred,
      action: actionTable[0]
    };
  }

  // 体力・メンタル低下で休養/余暇に落ちている場合、
  // 自動割り振りでは現在行動も復帰先も壊さない。
  if (isTemporaryAction(currentAction) && actionTable.includes(currentAction)) {
    return {
      preferredAction: currentPreferred,
      action: currentAction
    };
  }

  const bestPreferred = chooseBestJob(person, context);
  const nextPreferred = bestPreferred !== JOB_NONE ? bestPreferred : currentPreferred;

  if ((person.hp <= 33 || person.mp <= 33) && (actionTable.includes(JOB_REST) || actionTable.includes(JOB_LEISURE))) {
    return {
      preferredAction: nextPreferred,
      action: chooseRecoveryAction(person, actionTable, currentAction)
    };
  }

  return {
    preferredAction: nextPreferred,
    action: chooseWorkAction(person, actionTable, nextPreferred)
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

function chooseRaidFallbackAction(person, currentPreferred, currentAction) {
  const actionTable = Array.isArray(person.actionTable) ? person.actionTable : [];
  const isCurrentRaidAction = isRaidAction(currentAction);

  if (!isCurrentRaidAction && actionTable.includes(currentAction)) {
    return currentAction;
  }
  if (actionTable.includes(currentPreferred)) {
    return currentPreferred;
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
  let traitMultiplier = 1;
  if (mindTraits.includes("歴戦")) traitMultiplier *= 1.2;
  return Math.max(physical, magical) * traitMultiplier;
}

function getExpectedTrapDamage(person) {
  return ((Number(person.dex) || 0) * (Number(person.int) || 0) / 400) * 30;
}

function getExpectedShootDamage(person, village) {
  const enemies = Array.isArray(village?.raidEnemies)
    ? village.raidEnemies.filter(enemy => (Number(enemy.hp) || 0) > 0)
    : [];
  const avgEnemyVit = enemies.length > 0
    ? enemies.reduce((sum, enemy) => sum + (Number(enemy.vit) || 0), 0) / enemies.length
    : 0;
  const damage = ((Number(person.dex) || 0) * (Number(person.cou) || 0) / 400) * 40 - avgEnemyVit * 1.5;
  return Math.max(0, damage);
}

function isSafeDefender(person) {
  return (Number(person.hp) || 0) >= 55 && (Number(person.mp) || 0) >= 20;
}

function isSafeFortifier(person) {
  return (Number(person.hp) || 0) >= 50 && (Number(person.mp) || 0) >= 15;
}

function isSafeShooter(person) {
  return (Number(person.hp) || 0) >= 35 && (Number(person.mp) || 0) >= 10;
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

function getShooterScore(person, village) {
  const damage = getExpectedShootDamage(person, village);
  if (damage <= 0) return -Infinity;

  return (
    damage * 3.2
    + (Number(person.dex) || 0) * 2.0
    + (Number(person.cou) || 0) * 1.7
    + (Number(person.hp) || 0) * 0.25
  ) * getHealthFactor(person);
}

function getFortifierScore(person) {
  return (
    (Number(person.vit) || 0) * 2.4
    + (Number(person.hp) || 0) * 0.8
    + (Number(person.cou) || 0) * 1.2
    + (Number(person.str) || 0) * 0.6
  ) * getHealthFactor(person);
}

function getRaidAssignmentProfile(person, village) {
  const currentPreferred = person.preferredAction || person.job || JOB_NONE;
  const currentAction = person.action;
  refreshJobTable(person, village);

  const keptPreferred = Array.isArray(person.jobTable) && person.jobTable.includes(currentPreferred)
    ? currentPreferred
    : (person.preferredAction || JOB_NONE);
  const fallbackAction = chooseRaidFallbackAction(person, keptPreferred, currentAction);
  const canDefendByRule = canDefendInRaid(person);
  const canTrapByRule = canMakeTrapInRaid(person);
  const canShootByRule = canShootInRaid(person, village);
  const canFortifyByRule = canFortifyInRaid(person, village);

  const defenderDamage = getExpectedDefenderDamage(person);
  const trapDamage = getExpectedTrapDamage(person);
  const shootDamage = getExpectedShootDamage(person, village);
  const canDefend = canDefendByRule && canUseAction(person, ACTION_DEFEND) && isSafeDefender(person) && defenderDamage >= 8;
  const canTrap = canTrapByRule && canUseAction(person, ACTION_TRAP) && isSafeTrapMaker(person) && trapDamage >= 6;
  const canShoot = canShootByRule && canUseAction(person, ACTION_SHOOT) && isSafeShooter(person) && shootDamage >= 5;
  const canFortify = canFortifyByRule && canUseAction(person, ACTION_FORTIFY) && isSafeFortifier(person);

  return {
    person,
    fallback: { preferredAction: keptPreferred, action: fallbackAction },
    forcedNormal: !canDefendByRule && !canTrapByRule && !canShootByRule && !canFortifyByRule,
    canDefend,
    canTrap,
    canShoot,
    canFortify,
    defenderScore: canDefend ? getDefenderScore(person) : -Infinity,
    trapScore: canTrap ? getTrapScore(person) : -Infinity,
    shooterScore: canShoot ? getShooterScore(person, village) : -Infinity,
    fortifierScore: canFortify ? getFortifierScore(person) : -Infinity,
    defenderDamage: canDefend ? defenderDamage : 0,
    trapDamage: canTrap ? trapDamage : 0,
    shootDamage: canShoot ? shootDamage : 0
  };
}

function getMinimumFrontliners(village, profiles) {
  const enemyCount = Array.isArray(village.raidEnemies) ? village.raidEnemies.length : 0;
  const activeProfiles = profiles.filter(profile => !profile.forcedNormal && (profile.canDefend || profile.canFortify || profile.canShoot || profile.canTrap));
  const frontOptions = activeProfiles.filter(profile =>
    (profile.canDefend && Number.isFinite(profile.defenderScore)) ||
    (profile.canFortify && Number.isFinite(profile.fortifierScore))
  );

  if (frontOptions.length === 0 || activeProfiles.length === 0) {
    return 0;
  }

  return Math.min(
    frontOptions.length,
    Math.max(1, Math.ceil(Math.min(enemyCount || 1, activeProfiles.length) / 2))
  );
}

function buildRaidAssignments(village, targets) {
  const assignments = new Map();
  const profiles = targets.map(person => getRaidAssignmentProfile(person, village));
  const minimumFrontliners = getMinimumFrontliners(village, profiles);
  const frontlinerSlots = new Set(
    profiles
      .filter(profile => !profile.forcedNormal && (
        (profile.canDefend && Number.isFinite(profile.defenderScore)) ||
        (profile.canFortify && Number.isFinite(profile.fortifierScore))
      ))
      .sort((a, b) => Math.max(b.defenderScore, b.fortifierScore) - Math.max(a.defenderScore, a.fortifierScore))
      .slice(0, minimumFrontliners)
      .map(profile => profile.person)
  );

  profiles.forEach(profile => {
    if (profile.forcedNormal || (!profile.canDefend && !profile.canFortify && !profile.canShoot && !profile.canTrap)) {
      assignments.set(profile.person, profile.fallback);
      return;
    }

    if (frontlinerSlots.has(profile.person)) {
      const action = profile.canDefend && profile.defenderScore >= profile.fortifierScore * 0.8
        ? ACTION_DEFEND
        : (profile.canFortify ? ACTION_FORTIFY : ACTION_DEFEND);
      assignments.set(profile.person, { preferredAction: profile.fallback.preferredAction, action });
      return;
    }

    if (profile.canShoot && profile.shooterScore >= Math.max(profile.trapScore, profile.defenderScore) * 0.9) {
      assignments.set(profile.person, { preferredAction: profile.fallback.preferredAction, action: ACTION_SHOOT });
      return;
    }

    if (profile.canTrap && (!profile.canDefend || profile.trapDamage >= profile.defenderDamage * 0.82)) {
      assignments.set(profile.person, { preferredAction: profile.fallback.preferredAction, action: ACTION_TRAP });
      return;
    }

    if (profile.canShoot) {
      assignments.set(profile.person, { preferredAction: profile.fallback.preferredAction, action: ACTION_SHOOT });
      return;
    }

    if (profile.canDefend) {
      assignments.set(profile.person, { preferredAction: profile.fallback.preferredAction, action: ACTION_DEFEND });
      return;
    }

    if (profile.canFortify) {
      assignments.set(profile.person, { preferredAction: profile.fallback.preferredAction, action: ACTION_FORTIFY });
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
    const previousPreferred = person.preferredAction || person.job || JOB_NONE;
    const previousAction = person.action || JOB_NONE;

    if (previousPreferred !== next.preferredAction || previousAction !== next.action) {
      changed++;
    }
    setPreferredAction(person, next.preferredAction);
    person.action = next.action;
  });

  const lockedCount = village.villagers.filter(person => person.assignmentLocked).length;
  village.log(`自動割り振り: ${changed}人の行動を更新しました。固定${lockedCount}人は除外 (食料${priorityContext.foodSeverity.toFixed(2)}, 回復${priorityContext.recoverySeverity.toFixed(2)}, 資材${priorityContext.materialSeverity.toFixed(2)}, 資金${priorityContext.fundsSeverity.toFixed(2)})`);
}

export function autoAssignRaidActions(village) {
  if (!isRaidActive(village)) {
    village.log("襲撃は発生していません。");
    return;
  }

  let changed = 0;
  let defenders = 0;
  let fortifiers = 0;
  let shooters = 0;
  let trapMakers = 0;
  let nonParticipants = 0;
  const targets = Array.isArray(village.villagers) ? village.villagers : [];
  const raidAssignments = buildRaidAssignments(village, targets);

  targets.forEach(person => {
    const currentPreferred = person.preferredAction || person.job || JOB_NONE;
    const currentAction = person.action;
    const next = raidAssignments.get(person);
    if (!next) return;

    if (currentAction !== next.action || currentPreferred !== next.preferredAction) {
      changed++;
    }
    setPreferredAction(person, next.preferredAction);
    person.action = next.action;

    if (person.action === ACTION_DEFEND && canPerformRaidAction(person, ACTION_DEFEND, village)) defenders++;
    else if (person.action === ACTION_FORTIFY && canPerformRaidAction(person, ACTION_FORTIFY, village)) fortifiers++;
    else if (person.action === ACTION_SHOOT && canPerformRaidAction(person, ACTION_SHOOT, village)) shooters++;
    else if (person.action === ACTION_TRAP && canPerformRaidAction(person, ACTION_TRAP, village)) trapMakers++;
    else nonParticipants++;
  });

  village.log(`防衛割り振り: ${changed}人を更新しました。迎撃${defenders}人、籠城${fortifiers}人、射撃${shooters}人、罠作成${trapMakers}人、不参加${nonParticipants}人`);
}
