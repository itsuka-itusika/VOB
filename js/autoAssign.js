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
import { isSaltPillar } from "./domain/apocalypseRules.js";

// 勝ち目を測るときの想定戦闘ターン数。
const RAID_WIN_ESTIMATE_TURNS = 3;
// 前衛は枠いっぱいまで出すが、最も火力のある者に対しこの割合へ届かない者は出さない。
const RAID_FRONTLINE_MIN_DAMAGE_SHARE = 1 / 3;
// 一撃を耐えられない村人でも、この体力があれば前衛・中衛へ加える。
// 数で押されているときは基準を下げ、こちらが上回るときは健康な者だけを出す。
const RAID_JOIN_HP_OUTNUMBERED = 50;
const RAID_JOIN_HP_ADVANTAGE = 65;
// この種族が混じる襲撃は一撃が重く、耐えられる者がほとんど出ないため常に緩い基準を使う。
const RAID_HEAVY_HITTER_RACES = new Set(["キュクロプス", "スフィンクス"]);

// 食料の備蓄が何か月ぶんあれば十分とみなすか。
const FOOD_SUFFICIENT_MONTHS = 3;
// 資材が余っているかを測るときに見込む、建築へ回す分。
// 月々の消費だけで測ると、建築の元手まで余剰とみなしてしまう。
const BUILDING_MATERIAL_RESERVE = 100;

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
// 基礎重みは「重み×その職の平均産出」が次の順になるよう決める。
//   食料・資材＝資金・技術 ≧ 治安 ≧ 他者回復 ≧ 幸福
// 産出の桁が軸ごとに違うため、重み単体の大小は順位と一致しない。
// （警備は8前後、食料・資材・資金・技術の各職は18〜26前後）
const AXIS_BASE_WEIGHTS = {
  food: 1,
  materials: 1.05,
  recovery: 0.67,
  funds: 0.95,
  mana: 0.3,
  security: 2,
  tech: 1.1,
  happiness: 0.25
};
const AXIS_URGENCY = {
  food: 3,
  materials: 2,
  recovery: 2.5,
  funds: 1.5,
  security: 2.5,
  happiness: 3,
  tech: 1.2
};
// 貯め込んでも自然には価値が下がらない軸を、基準量を超えた分だけ減衰させる。
// 回復・幸福・治安は産出側が不足分で頭打ちになるため、ここでは扱わない。
const AXIS_SURPLUS_DAMPING = 0.6;
const AXIS_SURPLUS_FLOOR = 0.25;
// 村全体へ効く職。同じ月に重ねても不足分を食い合うだけなので、2人目からは評価を薄める。
const WHOLE_VILLAGE_JOBS = new Set(["警備", "神官", "シスター", "踊り子", "詩人", "バニー"]);

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

// 備蓄が基準量を超えている度合い。1未満なら余剰なしとして1を返す。
function getSurplusRatio(amount, baseline) {
  if (!(baseline > 0)) return 1;
  return Math.max(1, (Number(amount) || 0) / baseline);
}

// 余っている軸の重みを緩やかに落とす。偏って溜まり続ける技術や資金に効く。
function getSurplusDamping(axis, context) {
  const ratio = context?.surplusByAxis?.[axis];
  if (!ratio || ratio <= 1) return 1;
  return Math.max(AXIS_SURPLUS_FLOOR, 1 / (1 + (ratio - 1) * AXIS_SURPLUS_DAMPING));
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
  // 備蓄3か月ぶんを「十分」とみなす。村の安定条件と同じ基準に揃える。
  const foodBaseline = Math.max(20, monthlyFoodCost * FOOD_SUFFICIENT_MONTHS);
  const foodSeverity = foodProjected < 0
    ? normalizeSeverity(1 + Math.abs(foodProjected) / Math.max(20, monthlyFoodCost))
    : normalizeSeverity((foodBaseline - (Number(village.food) || 0)) / Math.max(20, monthlyFoodCost * 2));
  const recoverySeverity = normalizeSeverity(
    Math.max(0, (62 - avgRecovery) / 18) + Math.max(0, lowConditionRatio - 0.25)
  );
  const materialBaseline = Math.max(20, monthlyMaterialCost + population * 4);
  const materialSurplusBaseline = Math.max(materialBaseline, BUILDING_MATERIAL_RESERVE + population * 8);
  const materialSeverity = normalizeSeverity((materialBaseline - (Number(village.materials) || 0)) / materialBaseline);
  const fundsBaseline = Math.max(40, population * 12 + (Number(village.building) || 0) * 0.5);
  const fundsSeverity = normalizeSeverity((fundsBaseline - (Number(village.funds) || 0)) / fundsBaseline);
  const securityValue = Number(village.security) || 0;
  const securitySeverity = normalizeSeverity(
    (70 - securityValue) / 70 + (village.villageTraits.includes("荒廃") ? 0.35 : 0)
  );
  const avgHappiness = villagers.reduce((sum, person) => sum + (Number(person.happiness) || 0), 0) / population;
  const happinessSeverity = normalizeSeverity((65 - avgHappiness) / 45);
  // 櫓(技術50)や環濠(技術100)まで届く量を基準にする。
  const techBaseline = Math.max(60, population * 8);
  const techSeverity = normalizeSeverity((techBaseline - (Number(village.tech) || 0)) / techBaseline);

  return {
    severityByAxis: {
      food: foodSeverity,
      materials: materialSeverity,
      recovery: recoverySeverity,
      funds: fundsSeverity,
      security: securitySeverity,
      happiness: happinessSeverity,
      tech: techSeverity
    },
    surplusByAxis: {
      food: getSurplusRatio(village.food, foodBaseline),
      materials: getSurplusRatio(village.materials, materialSurplusBaseline),
      funds: getSurplusRatio(village.funds, fundsBaseline),
      tech: getSurplusRatio(village.tech, techBaseline)
    },
    supportAssignCounts: new Map(),
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

// 全体に効く職と回復職は、名目値ではなく「実際に埋まる不足分」で評価する。
// 満たされている村では自然と価値が下がり、困っている村では人数分の効果が乗る。
function sumEffectiveGain(villagers, amount, getCurrent, filter = null) {
  return villagers.reduce((sum, target) => {
    if (isSaltPillar(target)) return sum;
    if (filter && !filter(target)) return sum;
    const deficit = Math.max(0, 100 - (Number(getCurrent(target)) || 0));
    return sum + Math.min(Number(amount) || 0, deficit);
  }, 0);
}

// 看護・あんまは体力が最も低い1人を癒す実処理に合わせ、その不足分を上限にする。
function getLowestHpDeficit(villagers) {
  const alive = villagers.filter(target => !isSaltPillar(target));
  if (alive.length === 0) return 0;
  const lowestHp = Math.min(...alive.map(target => Number(target.hp) || 0));
  return Math.max(0, 100 - lowestHp);
}

/**
 * その職が1か月で生む期待成果を、資源軸ごとに返す。
 * 計算は jobMath.js の実処理と同じ関数へ委ね、ここでは軸へ振り分けるだけにする。
 * 対象外の行動（遊び、休養など）は null を返し、評価から外す。
 */
function getExpectedYield(person, job, village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
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
    case "警備": {
      const securityDeficit = Math.max(0, 100 - (Number(village?.security) || 0));
      return { security: Math.min(calculateGuardYield(person), securityDeficit) };
    }
    case "看護":
      return { recovery: Math.min(calculateNurseHeal(person, village), getLowestHpDeficit(villagers)) };
    case "あんま":
    case ACTION_MASSAGE_MALE:
    case ACTION_MASSAGE_FEMALE:
      return { recovery: Math.min(calculateMassageHeal(person, job), getLowestHpDeficit(villagers)) };
    case "神官":
    case "シスター": {
      const heal = calculatePriestMindHeal(person, village);
      return { recovery: sumEffectiveGain(villagers, heal, target => target.mp) };
    }
    case "踊り子": {
      const gain = calculateDancerHappiness(person, village);
      return { happiness: sumEffectiveGain(villagers, gain, target => target.happiness, target => target.spiritSex === "男") };
    }
    case "詩人": {
      const gain = calculatePoetHappiness(person, village);
      return { happiness: sumEffectiveGain(villagers, gain, target => target.happiness, target => target.spiritSex === "女") };
    }
    case "バニー": {
      const gain = calculateBunnySupport(person);
      const isMaleSpirit = target => target.spiritSex === "男";
      return {
        happiness: sumEffectiveGain(villagers, gain, target => target.happiness, isMaleSpirit),
        recovery: sumEffectiveGain(villagers, gain, target => target.mp, isMaleSpirit)
      };
    }
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
  return base * (1 + severity * urgency) * getSurplusDamping(axis, context);
}

function scoreJob(person, job, context) {
  const yields = getExpectedYield(person, job, context?.village);
  if (!yields) return -Infinity;

  const score = Object.entries(yields).reduce((total, [axis, amount]) => {
    return total + (Number(amount) || 0) * getAxisWeight(axis, context);
  }, 0);
  if (!WHOLE_VILLAGE_JOBS.has(job)) return score;
  const assigned = context?.supportAssignCounts?.get(job) || 0;
  return score / (1 + assigned);
}

// 同じ月に全体系職へ何人就いたかを記録し、以降の評価を薄める。
function recordSupportAssignment(context, job) {
  if (!context?.supportAssignCounts || !WHOLE_VILLAGE_JOBS.has(job)) return;
  context.supportAssignCounts.set(job, (context.supportAssignCounts.get(job) || 0) + 1);
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

/** 一撃で倒れないか。 */
function canJoinAtAll(person, action, village) {
  return getSurvivableTurns(person, action, village) > 1;
}

function hasHeavyHitterEnemy(village) {
  const enemies = Array.isArray(village?.raidEnemies) ? village.raidEnemies : [];
  return enemies.some(enemy => RAID_HEAVY_HITTER_RACES.has(enemy?.race) ||
    RAID_HEAVY_HITTER_RACES.has(enemy?.raiderType));
}

/**
 * 敵が強いか。重い一撃を持つ種族が混じるか、前衛の過半が想定戦闘ターンを耐えられない場合。
 */
function hasStrongRaidEnemies(village, frontProfiles) {
  if (hasHeavyHitterEnemy(village)) return true;
  if (frontProfiles.length === 0) return false;
  const fragile = frontProfiles.filter(profile =>
    getSurvivableTurns(profile.person, ACTION_DEFEND, village) < RAID_WIN_ESTIMATE_TURNS).length;
  return fragile * 2 > frontProfiles.length;
}

/** 前衛・中衛へ加わるのに要る体力。守り手の数が敵に届かないときは基準を下げる。 */
function getRaidJoinHpThreshold(village, profiles) {
  if (hasHeavyHitterEnemy(village)) return RAID_JOIN_HP_OUTNUMBERED;
  const enemyCount = Array.isArray(village?.raidEnemies) ? village.raidEnemies.length : 0;
  const lineCapable = profiles.filter(profile =>
    profile.allowed[ACTION_DEFEND] || profile.allowed[ACTION_FORTIFY] ||
    profile.allowed[ACTION_SHOOT] || profile.allowed[ACTION_CANNON]).length;
  const lineCapacity = Math.min(
    lineCapable,
    getRaidFrontlinerSlotCount(village) + getRaidMiddleSlotCount(village)
  );
  return lineCapacity <= enemyCount ? RAID_JOIN_HP_OUTNUMBERED : RAID_JOIN_HP_ADVANTAGE;
}

/**
 * 戦列へ加えられる体力か。一撃を耐えられるか、基準体力があればよい。
 * 罠作成は狙われないため、体力を問わない。
 */
function canJoinRaidLine(person, action, village, hpThreshold) {
  if (action === ACTION_TRAP) return true;
  return canJoinAtAll(person, action, village) || (Number(person.hp) || 0) >= hpThreshold;
}

function getRaidAssignmentProfile(person, village) {
  const currentPreferred = person.preferredAction || person.job || JOB_NONE;
  const currentAction = person.action;
  refreshJobTable(person, village);

  const keptPreferred = Array.isArray(person.jobTable) && person.jobTable.includes(currentPreferred)
    ? currentPreferred
    : (person.preferredAction || JOB_NONE);

  const allowed = {
    [ACTION_DEFEND]: canDefendInRaid(person, village) && canUseAction(person, ACTION_DEFEND),
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

const RAID_ACTION_SLOTS = {
  [ACTION_DEFEND]: "front",
  [ACTION_FORTIFY]: "front",
  [ACTION_SHOOT]: "middle",
  [ACTION_CANNON]: "middle",
  [ACTION_TRAP]: "trap"
};
// 見込みダメージが並んだときの優先。迎撃は毎ターン攻撃するため籠城より先に埋める。
const RAID_ACTION_TIE_ORDER = [ACTION_SHOOT, ACTION_CANNON, ACTION_TRAP, ACTION_DEFEND, ACTION_FORTIFY];

/**
 * 体力条件を満たす村人を、本人が最も戦果を出せる役へ就ける。
 * 見込みダメージの高い組から順に枠を埋めるため、役の優先順ではなく本人の得意で決まる。
 * 枠に入れなかった者は通常職へ残す。
 */
function fillRaidRoles(village, profiles, assignments) {
  const budget = {
    front: getRaidFrontlinerSlotCount(village),
    middle: getRaidMiddleSlotCount(village),
    trap: getRaidTrapMakerSlotCount(village)
  };
  const hpThreshold = getRaidJoinHpThreshold(village, profiles);
  const assigned = new Set();

  const eligible = (profile, action) => {
    if (!profile.allowed[action]) return false;
    if (action !== ACTION_TRAP && profile.damage[action] <= 0) return false;
    return canJoinRaidLine(profile.person, action, village, hpThreshold);
  };

  // 火力が見劣りする者を無理に前衛へ出すと、戦果より被害の方が大きくなる。
  const frontDamages = profiles.flatMap(profile => [ACTION_DEFEND, ACTION_FORTIFY]
    .filter(action => eligible(profile, action))
    .map(action => profile.damage[action]));
  const frontDamageFloor = Math.max(0, ...frontDamages) * RAID_FRONTLINE_MIN_DAMAGE_SHARE;
  const meetsFrontDamage = (profile, action) => RAID_ACTION_SLOTS[action] !== "front" ||
    profile.damage[action] >= frontDamageFloor;

  const candidates = [];
  profiles.forEach(profile => {
    RAID_ACTIONS.forEach(action => {
      if (!eligible(profile, action) || !meetsFrontDamage(profile, action)) return;
      candidates.push({ profile, action, damage: profile.damage[action] });
    });
  });
  candidates.sort((a, b) => (b.damage - a.damage) ||
    (RAID_ACTION_TIE_ORDER.indexOf(a.action) - RAID_ACTION_TIE_ORDER.indexOf(b.action)));

  const frontPicked = [];
  const place = ({ profile, action }) => {
    const slot = RAID_ACTION_SLOTS[action];
    if (assigned.has(profile.person) || budget[slot] <= 0) return;
    assignments.set(profile.person, {
      preferredAction: profile.fallback.preferredAction,
      action
    });
    assigned.add(profile.person);
    budget[slot] -= 1;
    if (slot === "front") frontPicked.push(profile);
  };

  // 前衛が空だと村人全体が的になるため、最も火力のある1人だけは他の役より先に確保する。
  const firstFront = candidates.find(candidate => RAID_ACTION_SLOTS[candidate.action] === "front");
  if (firstFront) place(firstFront);
  candidates.forEach(place);

  applyFortifyPreference(village, assignments, frontPicked);
  return assigned;
}

/**
 * 守りを固めるべき場面では、前衛を籠城へ回す。
 * 前衛が1人しかいないとき、または人数で押せていても敵が強いときに切り替える。
 */
function applyFortifyPreference(village, assignments, frontPicked) {
  if (frontPicked.length === 0) return;
  const enemyCount = Array.isArray(village?.raidEnemies) ? village.raidEnemies.length : 0;
  const shouldFortify = frontPicked.length === 1 ||
    (frontPicked.length > enemyCount && hasStrongRaidEnemies(village, frontPicked));
  if (!shouldFortify) return;

  frontPicked.forEach(profile => {
    if (!profile.allowed[ACTION_FORTIFY]) return;
    const current = assignments.get(profile.person);
    if (!current || current.action === ACTION_FORTIFY) return;
    assignments.set(profile.person, { ...current, action: ACTION_FORTIFY });
  });
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
    recordSupportAssignment(priorityContext, next.preferredAction);
  });

  const lockedCount = village.villagers.filter(person => person.assignmentLocked).length;
  village.log(`自動割り振り: ${changed}人の行動を更新しました。固定${lockedCount}人は除外`);
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
