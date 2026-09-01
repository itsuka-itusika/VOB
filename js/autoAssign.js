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
  getDefendDamageMultiplier,
  getFortifyDamageMultiplier,
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
import { getAutoAssignSettings, getStageMultiplier, hasStagedStock, resolveStageKey } from "./autoAssignSettings.js";
import { getManagementGoalMultiplier, getManagementGoals } from "./managementGoals.js";

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

// 通常職から外して回復へ回す境目。体力は休養、メンタルは余暇で戻す。
const SELF_RECOVERY_HP_LIMIT = 50;
const SELF_RECOVERY_MP_LIMIT = 50;
// 食料か資材が危険段階の間は、多少弱っていても働いてもらう。従来の基準に戻す。
const SUPPLY_CRISIS_RECOVERY_HP_LIMIT = 33;
const SUPPLY_CRISIS_RECOVERY_MP_LIMIT = 33;
// 襲撃が予見されている月は、戦列に立てるだけの体力を残しておく。
const RAID_WARNING_REST_HP_LIMIT = 60;
// 備蓄が尽きかけていると見なす段階。
const SUPPLY_CRISIS_STAGE = "danger";

// 職の評価は jobMath.js の期待成果をそのまま使う。ここに計算式は持たない。
// 産出する資源軸ごとの基本重みと、村が困っているときの効き幅だけを定める。
// 食料・資材・資金・技術は「重み×その職の平均産出」が横並びになる値にする。
// 資金・技術は食料・資材より一段控えるため 0.9 とする。
const AXIS_BASE_WEIGHTS = {
  food: 1,
  materials: 1,
  recovery: 0.67,
  funds: 0.9,
  mana: 0.3,
  security: 2,
  tech: 0.9,
  happiness: 0.25
};
// 回復・幸福は不足の度合いが連続で効くため、困窮度で押し上げる。
const AXIS_URGENCY = {
  recovery: 2.5,
  happiness: 3
};
// 食料・資材・治安・資金・技術の段階（倍率と区切り）は autoAssignSettings.js が持つ。
// 既定値のままなら、village.autoAssignSettings が無くても従来と同じ重みになる。
// 資材の充足を測る「当面は足りている」段階のキー。
const SUPPLY_ENOUGH_STAGES = new Set(["enough", "excess"]);
// 食料と資材の両方が不足気味のときは資材を少し優先する。食料は狩猟・漁など
// 担い手が多く回復しやすいのに対し、資材は伐採頼みで後手に回りやすいため。
// 乗算のため絶対ではなく、産出がこの倍率を超えて食料へ偏る村人は食料側の仕事に就く。
// 段階差（scarce×4 と low×2）はこの倍率より大きく、食料だけが枯渇寸前なら食料が勝つ。
const MATERIALS_DUAL_SHORTAGE_MULTIPLIER = 1.3;
// 村全体へ効く職。同じ月に重ねても不足分を食い合うだけなので、2人目からは評価を薄める。
const WHOLE_VILLAGE_JOBS = new Set(["警備", "神官", "シスター", "踊り子", "詩人", "バニー"]);
// 同じ不足を埋める職は、薄めと枠を共有する。神官とシスターはどちらもメンタルを癒す。
const WHOLE_VILLAGE_JOB_GROUPS = new Map([
  ["神官", "メンタル回復"],
  ["シスター", "メンタル回復"]
]);
// 村全体へ効く職に、同じ月へ何人まで就けるか。この人数ごとに1人ぶん増える。
// 全体系職は村人全員ぶんの不足を足して評価するため、人数が増えるほど過大に見える。
const WHOLE_VILLAGE_JOB_POPULATION_PER_SLOT = 9;

// 神官・シスターは、村の心が弱っているか、本人の適性が高いときだけ自動で選ぶ。
// 適性は、産出の元になる魅力×倫理の積で見る。
const MIND_HEAL_JOBS = new Set(["神官", "シスター"]);
const MIND_HEAL_VILLAGE_MP_LIMIT = 50;
const MIND_HEAL_APTITUDE_LIMIT = 450;

function getWholeVillageJobGroup(job) {
  return WHOLE_VILLAGE_JOB_GROUPS.get(job) || job;
}

function canAutoAssignMindHealJob(person, context) {
  if ((Number(context?.avgMp) || 0) <= MIND_HEAL_VILLAGE_MP_LIMIT) return true;
  return (Number(person?.chr) || 0) * (Number(person?.eth) || 0) >= MIND_HEAL_APTITUDE_LIMIT;
}

function firstAvailable(candidates, table) {
  return candidates.find(item => table.includes(item)) || null;
}

function estimateMonthlyFoodCost(village) {
  const people = (Array.isArray(village.villagers) ? village.villagers : []).concat(getCaptives(village));
  return people.reduce((sum, person) => {
    return sum + getVillagerFoodConsumption(person);
  }, 0);
}

// 資材は冬を越すための備蓄が本番なので、季節を問わず冬1か月ぶんの消費量を基準にする。
// 冬に入ってから慌てるのではなく、春から一定の備えを進めるための目安。
function estimateMonthlyMaterialCost(village) {
  const people = (Array.isArray(village.villagers) ? village.villagers : []).concat(getCaptives(village));
  return people.reduce((sum, person) => sum + getVillagerWinterMaterialConsumption(person), 0);
}

function normalizeSeverity(value) {
  return Math.max(0, Math.min(1.35, value));
}

// 治安の段階。荒廃の間は治安値によらず最も危険な段階として扱う。
function getSecurityStage(village, settings) {
  const isRuined = Array.isArray(village?.villageTraits) && village.villageTraits.includes("荒廃");
  if (isRuined) return "danger";
  return resolveStageKey("security", Number(village?.security) || 0, settings);
}

// 備蓄が何か月ぶんあるかで段階を決める。1か月ぶんの目安は軸ごとに呼び出し側が渡す。
function getSupplyStage(sectionId, amount, monthlyUnit, settings) {
  const months = (Number(amount) || 0) / Math.max(1, monthlyUnit);
  return resolveStageKey(sectionId, months, settings);
}

function buildVillagePriorityContext(village) {
  const settings = getAutoAssignSettings(village);
  const villagers = Array.isArray(village.villagers) ? village.villagers : [];
  const population = villagers.length || 1;
  const monthlyFoodCost = estimateMonthlyFoodCost(village);
  const monthlyMaterialCost = estimateMonthlyMaterialCost(village);
  const avgHp = villagers.reduce((sum, person) => sum + (Number(person.hp) || 0), 0) / population;
  const avgMp = villagers.reduce((sum, person) => sum + (Number(person.mp) || 0), 0) / population;
  const avgRecovery = avgHp * 0.55 + avgMp * 0.45;
  const lowConditionCount = villagers.filter(person => (Number(person.hp) || 0) <= 55 || (Number(person.mp) || 0) <= 55).length;
  const lowConditionRatio = lowConditionCount / population;
  const recoverySeverity = normalizeSeverity(
    Math.max(0, (62 - avgRecovery) / 18) + Math.max(0, lowConditionRatio - 0.25)
  );
  const avgHappiness = villagers.reduce((sum, person) => sum + (Number(person.happiness) || 0), 0) / population;
  const happinessSeverity = normalizeSeverity((65 - avgHappiness) / 45);
  const materialMonthlyUnit = Math.max(20, monthlyMaterialCost);
  const foodStage = getSupplyStage("food", village.food, Math.max(20, monthlyFoodCost), settings);
  const materialStage = getSupplyStage("materials", village.materials, materialMonthlyUnit, settings);

  return {
    settings,
    managementGoals: getManagementGoals(village),
    severityByAxis: {
      recovery: recoverySeverity,
      happiness: happinessSeverity
    },
    stageByAxis: {
      food: foodStage,
      materials: materialStage,
      security: getSecurityStage(village, settings),
      funds: hasStagedStock("funds", settings)
        ? resolveStageKey("funds", Number(village.funds) || 0, settings)
        : null,
      tech: hasStagedStock("tech", settings)
        ? resolveStageKey("tech", Number(village.tech) || 0, settings)
        : null
    },
    materialsPreferred:
      !SUPPLY_ENOUGH_STAGES.has(foodStage) && !SUPPLY_ENOUGH_STAGES.has(materialStage),
    supportAssignCounts: new Map(),
    wholeVillageJobLimit: Math.max(1, Math.floor(population / WHOLE_VILLAGE_JOB_POPULATION_PER_SLOT)),
    recoverySeverity,
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
  if (!context) return base;

  // 経営目標は段階や困窮度とは別に、目標未達を押し上げ過剰を抑える。
  const goalMultiplier = getManagementGoalMultiplier(
    axis,
    context.village?.[axis],
    context.managementGoals
  );

  const stage = context.stageByAxis?.[axis];
  if (stage) {
    const dualShortageBoost = axis === "materials" && context.materialsPreferred
      ? MATERIALS_DUAL_SHORTAGE_MULTIPLIER
      : 1;
    return base * getStageMultiplier(axis, stage, context.settings) * dualShortageBoost * goalMultiplier;
  }

  const urgency = AXIS_URGENCY[axis];
  if (!urgency) return base * goalMultiplier;
  return base * (1 + (context.severityByAxis[axis] || 0) * urgency) * goalMultiplier;
}

function scoreJob(person, job, context) {
  const yields = getExpectedYield(person, job, context?.village);
  if (!yields) return -Infinity;

  const score = Object.entries(yields).reduce((total, [axis, amount]) => {
    return total + (Number(amount) || 0) * getAxisWeight(axis, context);
  }, 0);
  if (MIND_HEAL_JOBS.has(job) && !canAutoAssignMindHealJob(person, context)) return -Infinity;
  if (!WHOLE_VILLAGE_JOBS.has(job)) return score;
  const group = getWholeVillageJobGroup(job);
  const assigned = context?.supportAssignCounts?.get(group) || 0;
  // 枠を使い切った全体系職は、これ以上増やしても戦力にならないので候補から外す。
  if (assigned >= (context?.wholeVillageJobLimit ?? Number.POSITIVE_INFINITY)) return -Infinity;
  return score / (1 + assigned);
}

// 同じ月に全体系職へ何人就いたかを記録し、以降の評価を薄める。
function recordSupportAssignment(context, job) {
  if (!context?.supportAssignCounts || !WHOLE_VILLAGE_JOBS.has(job)) return;
  const group = getWholeVillageJobGroup(job);
  context.supportAssignCounts.set(group, (context.supportAssignCounts.get(group) || 0) + 1);
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

function chooseRecoveryAction(person, actionTable, currentAction, limits) {
  if (isTemporaryAction(currentAction) && actionTable.includes(currentAction)) {
    return currentAction;
  }

  // 体力が基準を割っていれば休養。体力とメンタルの両方が低い場合も休養から入る。
  if ((Number(person.hp) || 0) <= limits.hp) {
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

  const recoveryLimits = getSelfRecoveryLimits(village, context);
  if ((person.hp <= recoveryLimits.hp || person.mp <= recoveryLimits.mp) &&
    (actionTable.includes(JOB_REST) || actionTable.includes(JOB_LEISURE))) {
    return {
      preferredAction: nextPreferred,
      action: chooseRecoveryAction(person, actionTable, currentAction, recoveryLimits)
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

/** 食料か資材が危険段階か。尽きかけている間は休ませる基準を厳しくする。 */
function isSupplyCrisis(context) {
  const stages = context?.stageByAxis || {};
  return stages.food === SUPPLY_CRISIS_STAGE || stages.materials === SUPPLY_CRISIS_STAGE;
}

/**
 * 来月の襲撃が村へ知らされているか。
 * 予言が出ていない襲撃予約で判断を変えると、画面に出ていない情報が漏れる。
 */
function hasRaidWarning(village) {
  return !!village?.pendingRaid?.prophecyNotified;
}

/** その村人を回復へ回す境目。備蓄の危機と襲撃予告で変わる。 */
function getSelfRecoveryLimits(village, context) {
  if (isSupplyCrisis(context)) {
    return { hp: SUPPLY_CRISIS_RECOVERY_HP_LIMIT, mp: SUPPLY_CRISIS_RECOVERY_MP_LIMIT };
  }
  return {
    hp: hasRaidWarning(village) ? RAID_WARNING_REST_HP_LIMIT : SELF_RECOVERY_HP_LIMIT,
    mp: SELF_RECOVERY_MP_LIMIT
  };
}

/** 手で火砲に就けた村人か。手動の配置を尊重し、割り振りで動かさない。 */
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
 * 迎撃の想定ダメージ。
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

// 籠城は自分から攻撃せず、殴られたときの反撃だけで敵を削る。
// 反撃は威力半分で、狙われた回にしか出ないため、想定ターンぶんをさらに割り引く。
const RAID_FORTIFY_FIREPOWER_RATE = 0.25;

// 防衛割り振りの方針。通常は迎撃中心、堅忍は籠城で持久、省力は勝てる最低限だけ出す。
export const RAID_ASSIGN_MODE = {
  DEFEND: "defend",
  FORTIFY: "fortify",
  ECONOMY: "economy"
};
// 省力で人を減らすときに残す火力の余裕。見込みが外れても押し切れる幅を持たせる。
const RAID_ECONOMY_SAFETY_RATE = 1.8;

/** 想定ターン数ぶんの火力へ均す。罠は1度きりなので、そのまま数える。 */
function toRaidFirepower(action, damage) {
  if (action === ACTION_TRAP) return damage;
  if (action === ACTION_FORTIFY) {
    return damage * RAID_WIN_ESTIMATE_TURNS * RAID_FORTIFY_FIREPOWER_RATE;
  }
  return damage * RAID_WIN_ESTIMATE_TURNS;
}

/** 罠の合計と、戦闘参加者が想定ターン数で出す火力の合計。 */
function estimateVillageFirepower(village, profiles, assignments, reservedFirepower = 0) {
  let total = reservedFirepower;
  profiles.forEach(profile => {
    const action = assignments.get(profile.person)?.action;
    if (!isRaidAction(action)) return;
    total += toRaidFirepower(action, profile.damage[action] || 0);
  });
  return total;
}

/** 割り振り対象と、対象外で既に防衛へ就いている村人を合わせた出撃メンバー。 */
function collectRaidForceMembers(village, profiles, assignments) {
  const targetSet = new Set(profiles.map(profile => profile.person));
  const members = [];
  profiles.forEach(profile => {
    const action = assignments.get(profile.person)?.action;
    if (!isRaidAction(action)) return;
    members.push({ person: profile.person, action, damage: profile.damage[action] || 0 });
  });
  (Array.isArray(village?.villagers) ? village.villagers : []).forEach(person => {
    if (targetSet.has(person) || !isRaidAction(person.action)) return;
    members.push({ person, action: person.action, damage: estimateRaidActionDamage(person, person.action, village) });
  });
  return members;
}

/**
 * 想定ターンぶんの荒い戦闘シミュレーション。
 * 火力の合計だけで判定すると、少人数の前衛が敵の集中攻撃で先に崩れる場合を
 * 見逃すため、敵の削れ具合と前衛の消耗を1ターンずつ突き合わせて勝ち目を測る。
 */
function simulateRaidOutcome(village, members) {
  const enemies = Array.isArray(village?.raidEnemies)
    ? village.raidEnemies.filter(enemy => (Number(enemy.hp) || 0) > 0)
    : [];
  if (enemies.length === 0) return true;

  const perHit = getAverageEnemyAttack(village);
  const averageEnemyHp = Math.max(1, getEnemyTotalHp(village) / enemies.length);
  const fortifyMultiplier = getFortifyDamageMultiplier(village);
  const defendMultiplier = getDefendDamageMultiplier(village);

  let enemyHp = getEnemyTotalHp(village);
  // 行動順に合わせて、先制の射撃・敵の攻撃後に出る前衛と火砲を分けて数える。
  let shootDamage = 0;
  let lateDamage = 0;
  // 前衛の受け皿。敵の攻撃は前衛に集中するため、被弾倍率で割り引いた体力を合算する。
  let frontPool = 0;
  members.forEach(member => {
    if (member.action === ACTION_TRAP) {
      enemyHp -= member.damage;
      return;
    }
    if (member.action === ACTION_SHOOT) {
      shootDamage += member.damage;
      return;
    }
    const rate = member.action === ACTION_FORTIFY ? RAID_FORTIFY_FIREPOWER_RATE : 1;
    lateDamage += member.damage * rate;
    if (member.action === ACTION_DEFEND || member.action === ACTION_FORTIFY) {
      const multiplier = member.action === ACTION_FORTIFY ? fortifyMultiplier : defendMultiplier;
      frontPool += (Number(member.person.hp) || 0) / Math.max(0.1, multiplier);
    }
  });
  if (enemyHp <= 0) return true;
  if (shootDamage + lateDamage <= 0) return false;

  for (let turn = 0; turn < RAID_WIN_ESTIMATE_TURNS; turn++) {
    // 射撃は敵より先に撃つ。
    enemyHp -= shootDamage;
    if (enemyHp <= 0) return true;
    // 生き残った敵が前衛を殴る。前衛が持たなければ中衛が的になり崩れるとみなす。
    frontPool -= Math.ceil(enemyHp / averageEnemyHp) * perHit;
    if (frontPool <= 0) return false;
    // 前衛の攻撃・反撃と火砲は敵の攻撃と前後するため、後段でまとめて数える。
    enemyHp -= lateDamage;
    if (enemyHp <= 0) return true;
  }
  return false;
}

function hasWinningChance(village, profiles, assignments) {
  return simulateRaidOutcome(village, collectRaidForceMembers(village, profiles, assignments));
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
 * 割り振り対象外の村人が、すでに占めている枠と出している火力。
 * 手で火砲に就けた村人は動かせないため、その枠を空きとして数えない。
 */
function getReservedRaidLines(village, targets) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  const targetSet = new Set(targets);
  const used = { front: 0, middle: 0, trap: 0 };
  let firepower = 0;

  villagers.forEach(person => {
    if (targetSet.has(person)) return;
    const slot = RAID_ACTION_SLOTS[person.action];
    if (!slot) return;
    used[slot] += 1;
    firepower += toRaidFirepower(person.action, estimateRaidActionDamage(person, person.action, village));
  });

  return { used, firepower };
}

/**
 * 体力条件を満たす村人を、本人が最も戦果を出せる役へ就ける。
 * 見込みダメージの高い組から順に枠を埋めるため、役の優先順ではなく本人の得意で決まる。
 * 枠に入れなかった者は通常職へ残す。
 */
function fillRaidRoles(village, profiles, assignments, reservedSlots, mode) {
  const budget = {
    front: Math.max(0, getRaidFrontlinerSlotCount(village) - reservedSlots.front),
    middle: Math.max(0, getRaidMiddleSlotCount(village) - reservedSlots.middle),
    trap: Math.max(0, getRaidTrapMakerSlotCount(village) - reservedSlots.trap)
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

  applyFortifyPreference(village, assignments, frontPicked, mode);
  return { assigned, budget };
}

/**
 * 守りを固めるべき場面では、前衛を籠城へ回す。
 * 堅忍は常に籠城。通常は前衛が1人のときだけ切り替え、強敵でも迎撃を続ける。
 * 省力は被害を抑えたいので、通常の条件に敵の強さも加える。
 */
function applyFortifyPreference(village, assignments, frontPicked, mode) {
  if (frontPicked.length === 0) return;
  const enemyCount = Array.isArray(village?.raidEnemies) ? village.raidEnemies.length : 0;
  const shouldFortify = mode === RAID_ASSIGN_MODE.FORTIFY ||
    frontPicked.length === 1 ||
    (mode === RAID_ASSIGN_MODE.ECONOMY &&
      frontPicked.length > enemyCount && hasStrongRaidEnemies(village, frontPicked));
  if (!shouldFortify) return;

  frontPicked.forEach(profile => {
    if (!profile.allowed[ACTION_FORTIFY]) return;
    const current = assignments.get(profile.person);
    if (!current || current.action === ACTION_FORTIFY) return;
    assignments.set(profile.person, { ...current, action: ACTION_FORTIFY });
  });
}

/**
 * 勝てる見込みを保ったまま、火力の小さい者から外す。
 * 前衛が誰もいないと村人全体が的になるため、前衛は最低1人残す。
 */
function trimToMinimumForce(village, profiles, assignments, reserved) {
  const required = getEnemyTotalHp(village) * RAID_ECONOMY_SAFETY_RATE;
  const members = profiles
    .filter(profile => isRaidAction(assignments.get(profile.person)?.action))
    .map(profile => {
      const action = assignments.get(profile.person).action;
      return { profile, action, firepower: toRaidFirepower(action, profile.damage[action] || 0) };
    })
    .sort((a, b) => a.firepower - b.firepower);

  let total = estimateVillageFirepower(village, profiles, assignments, reserved.firepower);
  let frontCount = reserved.used.front +
    members.filter(member => RAID_ACTION_SLOTS[member.action] === "front").length;

  members.forEach(member => {
    if (total - member.firepower < required) return;
    const isFront = RAID_ACTION_SLOTS[member.action] === "front";
    if (isFront && frontCount <= 1) return;
    // 外した結果、前衛が敵の集中攻撃を持ちこたえられなくなるなら取り消す。
    const kept = assignments.get(member.profile.person);
    assignments.set(member.profile.person, member.profile.fallback);
    if (!hasWinningChance(village, profiles, assignments)) {
      assignments.set(member.profile.person, kept);
      return;
    }
    total -= member.firepower;
    if (isFront) frontCount -= 1;
  });
}

function buildRaidAssignments(village, targets, mode) {
  const profiles = targets.map(person => getRaidAssignmentProfile(person, village));
  const assignments = new Map();
  profiles.forEach(profile => assignments.set(profile.person, profile.fallback));
  const reserved = getReservedRaidLines(village, targets);

  // まず安全に戦える者だけで組む。
  const { assigned, budget } = fillRaidRoles(village, profiles, assignments, reserved.used, mode);
  if (hasWinningChance(village, profiles, assignments)) {
    if (mode === RAID_ASSIGN_MODE.ECONOMY) {
      trimToMinimumForce(village, profiles, assignments, reserved);
    }
    return { assignments, hasChance: true };
  }

  // 勝ち目が立たないときだけ、危険を承知で1人ずつ足す。立った時点で打ち切る。
  const reserves = profiles
    .filter(profile => !assigned.has(profile.person))
    .sort((a, b) => Math.max(...RAID_ACTIONS.map(action => b.damage[action])) -
      Math.max(...RAID_ACTIONS.map(action => a.damage[action])));
  const added = [];

  for (const profile of reserves) {
    // 枠を超えて就けても戦列には並べないため、前衛が埋まった時点で増員をやめる。
    if (budget.front <= 0) break;
    // 被弾の小さい籠城を優先し、就けなければ迎撃で加わる。
    const action = [ACTION_FORTIFY, ACTION_DEFEND].find(candidate =>
      profile.allowed[candidate] &&
      profile.damage[candidate] > 0 &&
      canJoinAtAll(profile.person, candidate, village));
    if (!action) continue;

    assignments.set(profile.person, { preferredAction: profile.fallback.preferredAction, action });
    budget.front -= 1;
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

const RAID_ASSIGN_MODE_LABELS = {
  [RAID_ASSIGN_MODE.DEFEND]: "自動割り振り（攻勢）",
  [RAID_ASSIGN_MODE.FORTIFY]: "自動割り振り（堅忍）",
  [RAID_ASSIGN_MODE.ECONOMY]: "自動割り振り（省力）"
};

export function autoAssignRaidActions(village, { mode = RAID_ASSIGN_MODE.DEFEND } = {}) {
  if (!isRaidActive(village)) {
    village.log("襲撃は発生していません。");
    return;
  }

  const resolvedMode = RAID_ASSIGN_MODE_LABELS[mode] ? mode : RAID_ASSIGN_MODE.DEFEND;
  let changed = 0;
  const allVillagers = Array.isArray(village.villagers) ? village.villagers : [];
  // 防衛は村の存亡に関わるため、行動固定中の村人も割り振りの対象にする。
  // 手で火砲に就けた村人だけは、その配置を尊重してそのままにする。
  const targets = allVillagers.filter(person => !isManualCannoneer(person, village));
  const { assignments, hasChance } = buildRaidAssignments(village, targets, resolvedMode);

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
  village.log(`${RAID_ASSIGN_MODE_LABELS[resolvedMode]}: ${changed}人を更新しました。${parts.join("、")}${note}`);
}
