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
  RAID_ACTIONS,
  canCannonInRaid,
  estimateRaidActionDamage,
  getAverageEnemyAttack,
  getEnemyTotalHp,
  getRaidIncomingDamageMultiplier,
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

// 安全に戦列へ加える目安のターン数と、勝ち目を測るときの想定戦闘ターン数。
const RAID_SAFE_SURVIVAL_TURNS = 2;
const RAID_WIN_ESTIMATE_TURNS = 3;

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

function canUseAction(person, action) {
  return Array.isArray(person.actionTable) && person.actionTable.includes(action);
}

/** 手で火砲に就けた村人か。火砲は自動では選ばないため、割り振りの対象外にする。 */
function isManualCannoneer(person, village) {
  return person?.action === ACTION_CANNON && canCannonInRaid(person, village);
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

/**
 * 迎撃の想定ダメージ。tools/balance の測定からも参照する。
 * useBaseStats は、一時的な増減を除いた素の能力で比べたいときに使う。
 */
export function getExpectedDefenderDamage(person, { useBaseStats = false } = {}) {
  const source = useBaseStats && person?.baseStats
    ? { ...person, ...person.baseStats }
    : person;
  return estimateRaidActionDamage(source, ACTION_DEFEND, null);
}

/** その行動で何ターン耐えられるかの目安。被弾しない罠は常に安全とみなす。 */
function getSurvivableTurns(person, action, village) {
  const incoming = getAverageEnemyAttack(village) * getRaidIncomingDamageMultiplier(action, village);
  if (incoming <= 0) return Number.POSITIVE_INFINITY;
  return (Number(person.hp) || 0) / incoming;
}

/** 安全に就ける行動か。想定ターン数ぶん耐えられることを求める。 */
function canJoinSafely(person, action, village) {
  return getSurvivableTurns(person, action, village) >= RAID_SAFE_SURVIVAL_TURNS;
}

/** 一撃で倒れないか。これを割る者は、勝ち目がどうあれ戦列に加えない。 */
function canJoinAtAll(person, action, village) {
  return getSurvivableTurns(person, action, village) > 1;
}

function getRaidAssignmentProfile(person, village) {
  const currentPreferred = person.preferredAction || person.job || JOB_NONE;
  const currentAction = person.action;
  refreshJobTable(person, village);

  const keptPreferred = Array.isArray(person.jobTable) && person.jobTable.includes(currentPreferred)
    ? currentPreferred
    : (person.preferredAction || JOB_NONE);

  const allowed = {
    [ACTION_DEFEND]: canDefendInRaid(person) && canUseAction(person, ACTION_DEFEND),
    [ACTION_FORTIFY]: canFortifyInRaid(person, village) && canUseAction(person, ACTION_FORTIFY),
    [ACTION_SHOOT]: canShootInRaid(person, village) && canUseAction(person, ACTION_SHOOT),
    [ACTION_CANNON]: canCannonInRaid(person, village) && canUseAction(person, ACTION_CANNON),
    [ACTION_TRAP]: canMakeTrapInRaid(person) && canUseAction(person, ACTION_TRAP)
  };
  const damage = {};
  RAID_ACTIONS.forEach(action => {
    damage[action] = allowed[action] ? estimateRaidActionDamage(person, action, village) : 0;
  });

  return {
    person,
    fallback: {
      preferredAction: keptPreferred,
      action: chooseRaidFallbackAction(person, keptPreferred, currentAction)
    },
    allowed,
    damage
  };
}

/** 罠の合計と、戦闘参加者が想定ターン数で出す火力の合計。 */
function estimateVillageFirepower(village, profiles, assignments) {
  let total = 0;
  profiles.forEach(profile => {
    const action = assignments.get(profile.person)?.action;
    if (!isRaidAction(action)) return;
    const damage = profile.damage[action] || 0;
    total += action === ACTION_TRAP ? damage : damage * RAID_WIN_ESTIMATE_TURNS;
  });
  return total;
}

function hasWinningChance(village, profiles, assignments) {
  return estimateVillageFirepower(village, profiles, assignments) >= getEnemyTotalHp(village);
}

/**
 * 適性の高い者から枠へ埋める。
 * 前衛 → 罠 → 中衛 → 籠城 の順に流し、枠に入れなかった者は通常職へ残す。
 */
function fillRaidRoles(village, profiles, assignments) {
  const enemyCount = Array.isArray(village.raidEnemies) ? village.raidEnemies.length : 0;
  const budget = {
    front: getRaidFrontlinerSlotCount(village),
    middle: getRaidMiddleSlotCount(village),
    trap: getRaidTrapMakerSlotCount(village)
  };
  const frontTarget = Math.min(budget.front, Math.max(1, Math.ceil(enemyCount / 2)));
  const assigned = new Set();

  const eligible = (profile, action) => {
    if (assigned.has(profile.person)) return false;
    if (!profile.allowed[action]) return false;
    if (action !== ACTION_TRAP && profile.damage[action] <= 0) return false;
    return canJoinSafely(profile.person, action, village);
  };

  const take = (action, limit, resolveAction = () => action) => {
    if (limit <= 0) return 0;
    const picked = profiles
      .filter(profile => eligible(profile, action))
      .sort((a, b) => b.damage[action] - a.damage[action])
      .slice(0, limit);
    picked.forEach(profile => {
      assignments.set(profile.person, {
        preferredAction: profile.fallback.preferredAction,
        action: resolveAction(profile)
      });
      assigned.add(profile.person);
    });
    return picked.length;
  };

  budget.front -= take(ACTION_DEFEND, frontTarget);
  budget.trap -= take(ACTION_TRAP, budget.trap);
  // 中衛は射撃と火砲で枠を分け合う。本人がより多く出せる方に就ける。
  budget.middle -= take(ACTION_SHOOT, budget.middle, profile =>
    profile.allowed[ACTION_CANNON] && profile.damage[ACTION_CANNON] > profile.damage[ACTION_SHOOT]
      ? ACTION_CANNON
      : ACTION_SHOOT);
  budget.middle -= take(ACTION_CANNON, budget.middle);
  budget.front -= take(ACTION_FORTIFY, budget.front);
  return assigned;
}

function buildRaidAssignments(village, targets) {
  const profiles = targets.map(person => getRaidAssignmentProfile(person, village));
  const assignments = new Map();
  profiles.forEach(profile => assignments.set(profile.person, profile.fallback));

  // まず安全に戦える者だけで組む。
  const assigned = fillRaidRoles(village, profiles, assignments);
  if (hasWinningChance(village, profiles, assignments)) {
    return { assignments, hasChance: true };
  }

  // 勝ち目が立たないときだけ、危険を承知で1人ずつ足す。立った時点で打ち切る。
  const reserves = profiles
    .filter(profile => !assigned.has(profile.person))
    .sort((a, b) => Math.max(...RAID_ACTIONS.map(action => b.damage[action])) -
      Math.max(...RAID_ACTIONS.map(action => a.damage[action])));
  const added = [];

  for (const profile of reserves) {
    // 被弾の小さい籠城を優先し、就けなければ迎撃で加わる。
    const action = [ACTION_FORTIFY, ACTION_DEFEND].find(candidate =>
      profile.allowed[candidate] &&
      profile.damage[candidate] > 0 &&
      canJoinAtAll(profile.person, candidate, village));
    if (!action) continue;

    assignments.set(profile.person, { preferredAction: profile.fallback.preferredAction, action });
    added.push(profile);
    if (hasWinningChance(village, profiles, assignments)) {
      return { assignments, hasChance: true };
    }
  }

  // 総力でも勝てないなら、危険な増員は損なので取り消す。
  added.forEach(profile => assignments.set(profile.person, profile.fallback));
  return { assignments, hasChance: false };
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
  const { assignments, hasChance } = buildRaidAssignments(village, targets);

  targets.forEach(person => {
    const currentPreferred = person.preferredAction || person.job || JOB_NONE;
    const currentAction = person.action;
    const next = assignments.get(person);
    if (!next) return;

    if (currentAction !== next.action || currentPreferred !== next.preferredAction) {
      changed++;
    }
    setPreferredAction(person, next.preferredAction);
    person.action = next.action;
  });

  const readiness = getRaidReadiness(village);
  const parts = [
    `迎撃${readiness.defenders.length}人`,
    `籠城${readiness.fortifiers.length}人`,
    `射撃${readiness.shooters.length}人`,
    `火砲${readiness.cannoneers.length}人`,
    `罠作成${readiness.trapMakers.length}人`,
    `不参加${Math.max(0, allVillagers.length - readiness.participantCount)}人`
  ];
  const note = hasChance ? "" : "（勝ち目薄。撤退も一考）";
  village.log(`防衛割り振り: ${changed}人を更新しました。${parts.join("、")}${note}`);
}
