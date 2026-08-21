import {
  ACTION_CRADLE,
  ACTION_NONE,
  ACTION_REST,
  ACTION_LEISURE,
  ACTION_MASSAGE_FEMALE,
  ACTION_MASSAGE_MALE,
  ACTION_SALT_PILLAR,
  isTemporaryAction,
  refreshJobTable,
  setPreferredAction
} from "./domain/jobTables.js";
import { getVillagerFoodConsumption, getVillagerWinterMaterialConsumption } from "./util.js";
import {
  calculateAlchemyYield,
  calculateApprenticeYield,
  calculateBrewingYield,
  calculateBunnySupport,
  calculateCopyBookYield,
  calculateDancerHappiness,
  calculateFarmYield,
  calculateFishYield,
  calculateGatherYield,
  calculateGuardYield,
  calculateHandiworkYield,
  calculateHuntYield,
  calculateLumberYield,
  calculateMassageHeal,
  calculateMikoMana,
  calculateNurseHeal,
  calculatePoetHappiness,
  calculatePriestMindHeal,
  calculateResearchAssistantYield,
  calculateResearchYield,
  calculateTradingYield,
  calculateWeavingYield
} from "./domain/jobMath.js";
import {
  ACTION_CANNON,
  ACTION_DEFEND,
  ACTION_FORTIFY,
  ACTION_SHOOT,
  ACTION_TRAP,
  canCannonInRaid,
  estimateRaidActionDamage,
  canFortifyInRaid,
  canDefendInRaid,
  canMakeTrapInRaid,
  canShootInRaid,
  getRaidFrontlinerSlotCount,
  getRaidReadiness,
  getRaidMiddleSlotCount,
  getRaidTrapMakerSlotCount,
  isRaidAction,
  isRaidActive
} from "./raidRules.js";
import { getCaptives } from "./captives.js";

const JOB_NONE = ACTION_NONE;
const JOB_REST = ACTION_REST;
const JOB_LEISURE = ACTION_LEISURE;
const JOB_HEAL = "\u7642\u990a";
const JOB_LAST_MOMENTS = "\u81e8\u7d42";
const SELF_RECOVERY_ACTION_SET = new Set([
  "\u7642\u990a",
  "\u4f11\u990a",
  "\u4f59\u6687"
]);

// 職の評価は jobMath.js の期待成果をそのまま使う。ここに計算式は持たない。
// 産出する資源軸ごとの基本重みと、村が困っているときの効き幅だけを定める。
const AXIS_BASE_WEIGHTS = {
  food: 1,
  materials: 0.9,
  recovery: 0.8,
  funds: 0.35,
  mana: 0.3,
  security: 0.3,
  tech: 0.25,
  happiness: 0.25
};
const AXIS_URGENCY = {
  food: 3,
  materials: 2,
  recovery: 2.5,
  funds: 1.5
};

function firstAvailable(candidates, table) {
  return candidates.find(item => table.includes(item)) || null;
}

function estimateMonthlyFoodCost(village) {
  const people = (Array.isArray(village.villagers) ? village.villagers : []).concat(getCaptives(village));
  return people.reduce((sum, person) => {
    return sum + getVillagerFoodConsumption(person);
  }, 0);
}

function estimateMonthlyMaterialCost(village) {
  const people = (Array.isArray(village.villagers) ? village.villagers : []).concat(getCaptives(village));
  return village.villageTraits.includes("\u51ac")
    ? people.reduce((sum, person) => sum + getVillagerWinterMaterialConsumption(person), 0)
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
    severityByAxis: {
      food: foodSeverity,
      materials: materialSeverity,
      recovery: recoverySeverity,
      funds: fundsSeverity
    },
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

/**
 * その職が1か月で生む期待成果を、資源軸ごとに返す。
 * 計算は jobMath.js の実処理と同じ関数へ委ね、ここでは軸へ振り分けるだけにする。
 * 対象外の行動（遊び、休養など）は null を返し、評価から外す。
 */
function getExpectedYield(person, job, village) {
  switch (job) {
    case "農作業": return { food: calculateFarmYield(person, village) };
    case "狩猟": return { food: calculateHuntYield(person, village) };
    case "漁": return { food: calculateFishYield(person, village) };
    case "伐採": return { materials: calculateLumberYield(person, village) };
    case "採集": {
      const yields = calculateGatherYield(person, village);
      return { food: yields.food, materials: yields.materials };
    }
    case "醸造": {
      const yields = calculateBrewingYield(person, village);
      return { food: yields.food, mana: yields.mana };
    }
    case "内職": return { funds: calculateHandiworkYield(person, village) };
    case "行商": return { funds: calculateTradingYield(person) };
    case "丁稚": return { funds: calculateApprenticeYield(person) };
    case "機織り": return { funds: calculateWeavingYield(person) };
    case "写本": {
      const amount = calculateCopyBookYield(person);
      return { funds: amount, tech: amount };
    }
    case "錬金術": {
      const yields = calculateAlchemyYield(person);
      return { funds: yields.funds, mana: yields.mana };
    }
    case "研究": return { tech: calculateResearchYield(person, village) };
    case "研究助手": return { tech: calculateResearchAssistantYield(person, village) };
    case "警備": return { security: calculateGuardYield(person) };
    case "看護": return { recovery: calculateNurseHeal(person, village) };
    case "あんま":
    case ACTION_MASSAGE_MALE:
    case ACTION_MASSAGE_FEMALE:
      return { recovery: calculateMassageHeal(person, job) };
    case "神官":
    case "シスター":
      return { recovery: calculatePriestMindHeal(person, village) };
    case "踊り子": return { happiness: calculateDancerHappiness(person, village) };
    case "詩人": return { happiness: calculatePoetHappiness(person, village) };
    case "バニー": return { happiness: calculateBunnySupport(person) };
    case "巫女": return { mana: calculateMikoMana(person) };
    default: return null;
  }
}

/** 資源軸ごとの重み。村が困っている軸ほど大きくなる。 */
function getAxisWeight(axis, context) {
  const base = AXIS_BASE_WEIGHTS[axis] || 0;
  const urgency = AXIS_URGENCY[axis];
  if (!urgency || !context) return base;
  const severity = context.severityByAxis[axis] || 0;
  return base * (1 + severity * urgency);
}

function scoreJob(person, job, context) {
  const yields = getExpectedYield(person, job, context?.village);
  if (!yields) return -Infinity;

  return Object.entries(yields).reduce((score, [axis, amount]) => {
    return score + (Number(amount) || 0) * getAxisWeight(axis, context);
  }, 0);
}

function chooseBestJob(person, context) {
  const preferredTable = Array.isArray(person.jobTable) ? person.jobTable : [];
  const candidateJobs = preferredTable.filter(job => job !== JOB_NONE);
  const workCandidates = candidateJobs.filter(job => !SELF_RECOVERY_ACTION_SET.has(job));
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

  const nonRecoveryAction = actionTable.find(action => action !== JOB_NONE && !SELF_RECOVERY_ACTION_SET.has(action));
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

  if (actionTable.length === 1 && [ACTION_CRADLE, JOB_HEAL, JOB_LAST_MOMENTS, ACTION_SALT_PILLAR].includes(actionTable[0])) {
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

/** 手で火砲に就けた村人か。火砲は自動では選ばないため、割り振りの対象外にする。 */
function isManualCannoneer(person, village) {
  return person?.action === ACTION_CANNON && canCannonInRaid(person, village);
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

export function getExpectedDefenderDamage(person, village = null) {
  return estimateRaidActionDamage(person, ACTION_DEFEND, village);
}

function getExpectedTrapDamage(person) {
  return estimateRaidActionDamage(person, ACTION_TRAP, null);
}

function getExpectedShootDamage(person, village) {
  return estimateRaidActionDamage(person, ACTION_SHOOT, village);
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

function getDefenderScore(person, village) {
  const attack = getExpectedDefenderDamage(person, village);
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

  const defenderDamage = getExpectedDefenderDamage(person, village);
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
    defenderScore: canDefend ? getDefenderScore(person, village) : -Infinity,
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
    getRaidFrontlinerSlotCount(village),
    Math.max(1, Math.ceil(Math.min(enemyCount || 1, activeProfiles.length) / 2))
  );
}

function enforceShooterSlots(village, profiles, assignments) {
  const shooterSlots = getRaidMiddleSlotCount(village);
  if (!Number.isFinite(shooterSlots)) return;

  const assignedShooters = profiles
    .filter(profile => assignments.get(profile.person)?.action === ACTION_SHOOT)
    .sort((a, b) => b.shooterScore - a.shooterScore);

  assignedShooters.slice(shooterSlots).forEach(profile => {
    assignments.set(profile.person, profile.fallback);
  });
}

function enforceTrapMakerSlots(village, profiles, assignments) {
  const assignedTrapMakers = profiles
    .filter(profile => assignments.get(profile.person)?.action === ACTION_TRAP)
    .sort((a, b) => b.trapScore - a.trapScore);
  assignedTrapMakers.slice(getRaidTrapMakerSlotCount(village)).forEach(profile => {
    assignments.set(profile.person, profile.fallback);
  });
}

function enforceFrontlinerSlots(village, profiles, assignments) {
  const assignedFrontliners = profiles
    .filter(profile => [ACTION_DEFEND, ACTION_FORTIFY].includes(assignments.get(profile.person)?.action))
    .sort((a, b) => Math.max(b.defenderScore, b.fortifierScore) - Math.max(a.defenderScore, a.fortifierScore));
  assignedFrontliners.slice(getRaidFrontlinerSlotCount(village)).forEach(profile => {
    assignments.set(profile.person, profile.fallback);
  });
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

  enforceShooterSlots(village, profiles, assignments);
  enforceTrapMakerSlots(village, profiles, assignments);
  enforceFrontlinerSlots(village, profiles, assignments);

  return assignments;
}

export function autoAssignJobs(village) {
  let changed = 0;
  const priorityContext = buildVillagePriorityContext(village);
  // 襲撃中は、防衛に就いている村人の配置を通常職で上書きしない。
  const raidActive = isRaidActive(village);
  const targets = village.villagers.filter(person => {
    if (person.assignmentLocked) return false;
    return !(raidActive && isRaidAction(person.action));
  });

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
  const allVillagers = Array.isArray(village.villagers) ? village.villagers : [];
  // 固定中の村人と、手で火砲に就けた村人はそのままにする。
  const targets = allVillagers.filter(person => !person.assignmentLocked && !isManualCannoneer(person, village));
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
  });

  const readiness = getRaidReadiness(village);
  const defenders = readiness.defenders.length;
  const fortifiers = readiness.fortifiers.length;
  const shooters = readiness.shooters.length;
  const trapMakers = readiness.trapMakers.length;
  const nonParticipants = Math.max(0, targets.length - readiness.participantCount);
  village.log(`防衛割り振り: ${changed}人を更新しました。迎撃${defenders}人、籠城${fortifiers}人、射撃${shooters}人、罠作成${trapMakers}人、不参加${nonParticipants}人`);
}
