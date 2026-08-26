import { isForcedHealingAction } from "./util.js";
import { countActiveBuildings, hasActiveBuildingFlag } from "./domain/buildingState.js";
import { FOUR_LEGGED_TRAIT, WILD_MIND_TRAIT, YOUNG_WOLF_TRAIT } from "./domain/speciesTraits.js";

export const ACTION_DEFEND = "迎撃";
export const ACTION_TRAP = "罠作成";
export const ACTION_SHOOT = "射撃";
export const ACTION_CANNON = "火砲";
export const ACTION_FORTIFY = "籠城";
export const TRAIT_UNDER_RAID = "襲撃中";
// 襲撃者の兵科。中衛の攻撃式を決める。
export const RAID_ATTACK_RANGED_MAGIC = "rangedMagic";
export const RAID_ATTACK_CANNON = "cannon";
// 罠で付与する一時状態。付与された次の戦闘ターンだけ行動できない。
export const RAID_STUN_EFFECT = "足止め";
export const RAID_MIDDLE_ACTIONS = [ACTION_SHOOT, ACTION_CANNON];
export const RAID_ACTIONS = [ACTION_DEFEND, ACTION_FORTIFY, ACTION_SHOOT, ACTION_CANNON, ACTION_TRAP];
export const RAID_COMBAT_ACTIONS = [ACTION_DEFEND, ACTION_FORTIFY, ACTION_SHOOT, ACTION_CANNON];
export const RAID_BASE_FRONTLINER_SLOTS = 6;
export const RAID_TRAP_MAKER_SLOTS = 3;
export const RAID_MIDDLE_INCOMING_DAMAGE_MULTIPLIER = 1.2;
export const RAID_CANNON_INCOMING_DAMAGE_MULTIPLIER = 1.5;

const RAID_COMMON_UNABLE_MIND_TRAITS = ["無垢", "萌芽", "襲撃者", "訪問者"];
const RAID_DEFEND_UNABLE_MIND_TRAITS = [...RAID_COMMON_UNABLE_MIND_TRAITS, "思春期"];
const RAID_BODY_BLOCK_REASONS = [
  "塩の柱",
  "赤子",
  YOUNG_WOLF_TRAIT,
  "危篤",
  "重体",
  "疫病",
  "負傷",
  "過労",
  "産褥"
];
const RAID_TRIPLE_DAMAGE_BODY_TRAITS = ["赤子", YOUNG_WOLF_TRAIT, "危篤", "重体"];
const RAID_DOUBLE_DAMAGE_BODY_TRAITS = ["疫病", "負傷", "過労", "産褥"];
const HUMAN_BEAST_TRAIT = "人面獣身";
const RAID_LINE_LABELS = {
  [ACTION_DEFEND]: "前衛",
  [ACTION_FORTIFY]: "前衛",
  [ACTION_SHOOT]: "中衛",
  [ACTION_CANNON]: "中衛",
  [ACTION_TRAP]: "後衛"
};
const CANNON_BLOCKED_MIND_TRAITS = ["文明忌避"];
// 戦いそのものを拒む精神特性。身を守る籠城だけは選べる。
const PACIFIST_MIND_TRAITS = ["不殺", "非戦主義"];

export function hasRaidStunEffect(person) {
  return Array.isArray(person?.raidEffects) && person.raidEffects.includes(RAID_STUN_EFFECT);
}

export function applyRaidStunEffect(person) {
  if (!person || hasRaidStunEffect(person)) return false;
  if (!Array.isArray(person.raidEffects)) person.raidEffects = [];
  person.raidEffects.push(RAID_STUN_EFFECT);
  return true;
}

export function clearRaidStunEffect(person) {
  if (!Array.isArray(person?.raidEffects)) return;
  person.raidEffects = person.raidEffects.filter(effect => effect !== RAID_STUN_EFFECT);
}

function traitList(person, key) {
  return Array.isArray(person?.[key]) ? person[key] : [];
}

function hasAnyTrait(traits, unableTraits) {
  return unableTraits.some(trait => traits.includes(trait));
}

function hasCommonRaidBlockingCondition(person) {
  return Boolean(getRaidActionBlockReason(person));
}

export function getRaidActionBlockReason(person, action = "", { ignoreRoleTraits = false } = {}) {
  if (!person) return "不在";
  if ((Number(person.hp) || 0) <= 0) return "体力尽き";
  if (hasRaidStunEffect(person)) return RAID_STUN_EFFECT;

  const bodyTraits = traitList(person, "bodyTraits");
  const mindTraits = traitList(person, "mindTraits");
  const bodyReason = RAID_BODY_BLOCK_REASONS.find(trait => bodyTraits.includes(trait));
  if (bodyReason) return bodyReason;
  if (mindTraits.includes("抑鬱")) return "抑鬱";
  if (isForcedHealingAction(person)) return "状態異常";
  if (mindTraits.includes("無垢")) return "無垢";
  if (mindTraits.includes("萌芽")) return "萌芽";
  if (!ignoreRoleTraits && mindTraits.includes("襲撃者")) return "襲撃者";
  if (!ignoreRoleTraits && mindTraits.includes("訪問者")) return "訪問者";
  if (action === ACTION_DEFEND && mindTraits.includes("思春期")) return "思春期";
  if (action && action !== ACTION_FORTIFY) {
    const pacifistReason = PACIFIST_MIND_TRAITS.find(trait => mindTraits.includes(trait));
    if (pacifistReason) return pacifistReason;
  }
  const usesRaidTools = action === ACTION_TRAP || RAID_MIDDLE_ACTIONS.includes(action);
  if (usesRaidTools && bodyTraits.includes(FOUR_LEGGED_TRAIT)) {
    return FOUR_LEGGED_TRAIT;
  }
  if (usesRaidTools && bodyTraits.includes(HUMAN_BEAST_TRAIT)) {
    return HUMAN_BEAST_TRAIT;
  }
  if ((usesRaidTools || action === ACTION_FORTIFY) && mindTraits.includes(WILD_MIND_TRAIT)) {
    return WILD_MIND_TRAIT;
  }
  if (action === ACTION_CANNON) {
    const cannonReason = CANNON_BLOCKED_MIND_TRAITS.find(trait => mindTraits.includes(trait));
    if (cannonReason) return cannonReason;
  }
  return "";
}

export function getRaidActionSkipMessage(person, action = "戦闘", options = {}) {
  const name = person?.name || "??";
  const label = action || "戦闘";
  const reason = getRaidActionBlockReason(person, action, options);
  const messages = {
    "塩の柱": `${name}は塩の柱と化した身体を動かせず、行動できない。`,
    "赤子": `${name}は赤子の身体では戦えず、泣き声を上げた。`,
    [YOUNG_WOLF_TRAIT]: `${name}はまだ幼く、身を伏せて戦いをやり過ごした。`,
    "危篤": `${name}は危篤状態で身動きが取れない。`,
    "重体": `${name}は重体のため立ち上がれず、行動できない。`,
    "疫病": `${name}は疫病に冒され、行動できない。`,
    "負傷": `${name}は負傷の痛みで動けず、行動を断念した。`,
    "過労": `${name}は過労で立っていられず、行動できない。`,
    "産褥": `${name}は産褥の身体のため、行動できない。`,
    "抑鬱": `${name}は心を奮い立たせられず、行動できない。`,
    "無垢": `${name}は戦いを理解できず、行動しない。`,
    "萌芽": `${name}はまだ幼く、戦いに参加できない。`,
    "思春期": `${name}は前衛で迎撃できず、行動しない。`,
    [FOUR_LEGGED_TRAIT]: `${name}は四足の身体で${label}の道具を扱えない。`,
    [HUMAN_BEAST_TRAIT]: `${name}は獣身では${label}の道具を扱えない。`,
    [WILD_MIND_TRAIT]: `${name}は野生の本能に従い、${label}の指示を受け付けない。`,
    "文明忌避": `${name}は文明の産物である${label}に触れようとしない。`,
    "不殺": `${name}は不殺の誓いを守り、${label}に加わらない。`,
    "非戦主義": `${name}は戦いを望まず、${label}に加わらない。`,
    "体力尽き": `${name}は体力が尽きており、行動できない。`,
    [RAID_STUN_EFFECT]: `${name}は足を取られ、身動きが取れない。`
  };
  return `【${label}】${messages[reason] || `${name}は行動不能。`}`;
}

export function getRaiderIncomingDamageMultiplier(person) {
  const bodyTraits = traitList(person, "bodyTraits");
  if (hasAnyTrait(bodyTraits, RAID_TRIPLE_DAMAGE_BODY_TRAITS)) return 3;
  if (hasAnyTrait(bodyTraits, RAID_DOUBLE_DAMAGE_BODY_TRAITS)) return 2;
  return 1;
}

/** 戦いを拒む精神特性を持つか。籠城以外の襲撃行動を選べない。 */
export function isPacifistFighter(person) {
  return hasAnyTrait(traitList(person, "mindTraits"), PACIFIST_MIND_TRAITS);
}

/** 攻撃特性による与ダメージ補正。想定ダメージ表示と実戦闘で同じ値を使う。 */
export function applyOffensiveTraitDamage(person, damage) {
  const base = Math.max(0, Math.floor(Number(damage) || 0));
  if (isPacifistFighter(person)) return 0;
  const traits = [...traitList(person, "bodyTraits"), ...traitList(person, "mindTraits")];
  if (traits.includes("歴戦")) return Math.floor(base * 1.2);
  if (traits.includes("戦慣れ")) return Math.floor(base * 1.1);
  return base;
}

/** 生存中の襲撃者の平均耐久。想定ダメージの見積もりに使う。 */
export function getAverageEnemyVitality(village) {
  const enemies = Array.isArray(village?.raidEnemies)
    ? village.raidEnemies.filter(enemy => (Number(enemy.hp) || 0) > 0)
    : [];
  if (enemies.length === 0) return 0;
  return enemies.reduce((sum, enemy) => sum + (Number(enemy.vit) || 0), 0) / enemies.length;
}

/**
 * 襲撃行動1回あたりの想定ダメージ。
 * 想定ダメージ表示と自動割り振りで同じ値を使うため、ここに集約する。
 * 籠城は迎撃と同じ近接攻撃を行う。罠は攻撃特性の影響を受けない。
 */
export function estimateRaidActionDamage(person, action, village = null) {
  if (!person) return 0;
  const stat = key => Number(person[key]) || 0;
  const averageVitality = getAverageEnemyVitality(village);

  if (action === ACTION_TRAP) {
    return Math.max(0, Math.floor((stat("dex") * stat("int") / 400) * 25));
  }

  let base = 0;
  if (action === ACTION_DEFEND || action === ACTION_FORTIFY) {
    const physical = Math.max(0, Math.floor((stat("str") * stat("cou") / 400) * 50 - averageVitality));
    const magical = Math.max(0, Math.floor((stat("mag") * stat("cou") / 400) * 25));
    base = Math.max(physical, magical);
  } else if (action === ACTION_SHOOT) {
    base = Math.max(0, Math.floor((stat("dex") * stat("cou") / 400) * 40 - averageVitality * 1.2));
  } else if (action === ACTION_CANNON) {
    base = Math.max(0, Math.floor((stat("mag") * stat("int") / 400) * 20));
  } else {
    return 0;
  }
  return applyOffensiveTraitDamage(person, base);
}

// 予想ダメージがどの能力から出ているか。作戦会議の表示に使う。
const RAID_ACTION_STAT_LABELS = Object.freeze({
  physical: "筋＊勇",
  magical: "魔＊勇",
  [ACTION_SHOOT]: "器＊勇",
  [ACTION_CANNON]: "魔＊知",
  [ACTION_TRAP]: "器＊知"
});

/**
 * その行動の予想ダメージが参照する能力の組。
 * 迎撃・籠城は物理と魔法の高い方を採るため、実際に採用される側を返す。
 */
export function getRaidActionStatLabel(person, action, village = null) {
  if (!person) return "";
  if (action === ACTION_DEFEND || action === ACTION_FORTIFY) {
    const stat = key => Number(person[key]) || 0;
    const averageVitality = getAverageEnemyVitality(village);
    const physical = Math.max(0, Math.floor((stat("str") * stat("cou") / 400) * 50 - averageVitality));
    const magical = Math.max(0, Math.floor((stat("mag") * stat("cou") / 400) * 25));
    return physical >= magical ? RAID_ACTION_STAT_LABELS.physical : RAID_ACTION_STAT_LABELS.magical;
  }
  return RAID_ACTION_STAT_LABELS[action] || "";
}

/** 生存中の襲撃者の総体力。防衛の勝ち目を測るのに使う。 */
export function getEnemyTotalHp(village) {
  const enemies = Array.isArray(village?.raidEnemies) ? village.raidEnemies : [];
  return enemies.reduce((sum, enemy) => sum + Math.max(0, Number(enemy.hp) || 0), 0);
}

/**
 * 襲撃者1体あたりの平均的な一撃。前衛の消耗を見積もるのに使う。
 * 実際の被弾は相手の耐久で減るため、村人の平均耐久を差し引く。
 */
export function getAverageEnemyAttack(village) {
  const enemies = Array.isArray(village?.raidEnemies)
    ? village.raidEnemies.filter(enemy => (Number(enemy.hp) || 0) > 0)
    : [];
  if (enemies.length === 0) return 0;

  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  const averageVitality = villagers.length > 0
    ? villagers.reduce((sum, person) => sum + (Number(person.vit) || 0), 0) / villagers.length
    : 0;

  const total = enemies.reduce((sum, enemy) => {
    const stat = key => Number(enemy[key]) || 0;
    // 中衛は隊列ごとの攻撃式に合わせる。近接式で一律に見ると火砲や遠距離魔法を過大評価する。
    if (enemy.raidPosition === "middle") {
      if (enemy.raidAttackType === RAID_ATTACK_CANNON) {
        return sum + Math.max(0, (stat("mag") * stat("int") / 400) * 20);
      }
      if (enemy.raidAttackType === RAID_ATTACK_RANGED_MAGIC) {
        return sum + Math.max(0, (stat("mag") * stat("cou") / 400) * 20);
      }
      return sum + Math.max(0, (stat("dex") * stat("cou") / 400) * 40 - averageVitality * 1.2);
    }
    const physical = Math.max(0, (stat("str") * stat("cou") / 400) * 50 - averageVitality);
    const magical = Math.max(0, (stat("mag") * stat("cou") / 400) * 25);
    return sum + Math.max(physical, magical);
  }, 0);
  return total / enemies.length;
}

/** その襲撃行動でどれだけ被弾しやすいか。罠は狙われないため0。 */
export function getRaidIncomingDamageMultiplier(action, village = null) {
  if (action === ACTION_DEFEND) return 1;
  if (action === ACTION_FORTIFY) return getFortifyDamageMultiplier(village);
  if (action === ACTION_SHOOT) return RAID_MIDDLE_INCOMING_DAMAGE_MULTIPLIER;
  if (action === ACTION_CANNON) return RAID_CANNON_INCOMING_DAMAGE_MULTIPLIER;
  return 0;
}

/** 前衛に立てるか。迎撃と籠城で共通する条件。 */
function canJoinRaidFrontLine(person) {
  if (hasCommonRaidBlockingCondition(person)) return false;
  return !hasAnyTrait(traitList(person, "mindTraits"), RAID_DEFEND_UNABLE_MIND_TRAITS);
}

export function canDefendInRaid(person, village = null) {
  if (!canJoinRaidFrontLine(person)) return false;
  // 戦いを拒む者も、籠城が使えるまでは前衛に立って身を挺することはできる。
  // 攻撃は加えないため、木柵が建った後は被弾の軽い籠城だけを選ばせる。
  if (isPacifistFighter(person)) return !canFortifyInRaid(person, village);
  return true;
}

export function canMakeTrapInRaid(person) {
  if (hasCommonRaidBlockingCondition(person) || isPacifistFighter(person)) return false;
  return !traitList(person, "bodyTraits").includes(FOUR_LEGGED_TRAIT) &&
    !traitList(person, "bodyTraits").includes(HUMAN_BEAST_TRAIT) &&
    !traitList(person, "mindTraits").includes(WILD_MIND_TRAIT);
}

function hasRaidUnlock(village, flag, buildingId) {
  if (!village) return true;
  return hasActiveBuildingFlag(village, flag, buildingId);
}

function sortRaidMiddlelinersByPriority(middleliners) {
  return [...middleliners].sort((a, b) => {
    const courageDiff = (Number(b?.cou) || 0) - (Number(a?.cou) || 0);
    if (courageDiff !== 0) return courageDiff;
    return (Number(b?.dex) || 0) - (Number(a?.dex) || 0);
  });
}

function sortRaidFrontlinersByPriority(frontliners) {
  return [...frontliners].sort((a, b) => {
    const courageDiff = (Number(b?.cou) || 0) - (Number(a?.cou) || 0);
    if (courageDiff !== 0) return courageDiff;
    return (Number(b?.hp) || 0) - (Number(a?.hp) || 0);
  });
}

function sortRaidTrapMakersByPriority(trapMakers) {
  return [...trapMakers].sort((a, b) => {
    const scoreA = (Number(a?.dex) || 0) * (Number(a?.int) || 0);
    const scoreB = (Number(b?.dex) || 0) * (Number(b?.int) || 0);
    return scoreB - scoreA;
  });
}

/** 籠城の被ダメージ倍率。環濠の有無で変わるため、表示と計算で同じ値を使う。 */
export function getFortifyDamageMultiplier(village) {
  return hasActiveBuildingFlag(village, "hasMoat", "moat") ? 0.7 : 0.8;
}

export function getRaidFrontlinerSlotCount(village = null) {
  if (!village) return Number.POSITIVE_INFINITY;
  const woodenFenceBonus = hasActiveBuildingFlag(village, "hasWoodenFence", "woodenFence") ? 1 : 0;
  const moatBonus = hasActiveBuildingFlag(village, "hasMoat", "moat") ? 1 : 0;
  return RAID_BASE_FRONTLINER_SLOTS + woodenFenceBonus + moatBonus;
}

export function getRaidTrapMakerSlotCount(village = null) {
  return village ? RAID_TRAP_MAKER_SLOTS : Number.POSITIVE_INFINITY;
}

/** 中衛枠は射撃と火砲で共有し、有効な櫓1基につき1人ぶん増える。 */
export function getRaidMiddleSlotCount(village = null) {
  if (!village) return Number.POSITIVE_INFINITY;
  return countActiveBuildings(village, "watchtower");
}

function canJoinRaidMiddleLine(person, village) {
  return canDefendInRaid(person, village) &&
    getRaidMiddleSlotCount(village) > 0 &&
    !traitList(person, "bodyTraits").includes(FOUR_LEGGED_TRAIT) &&
    !traitList(person, "bodyTraits").includes(HUMAN_BEAST_TRAIT) &&
    !traitList(person, "mindTraits").includes(WILD_MIND_TRAIT);
}

export function canShootInRaid(person, village = null) {
  return canJoinRaidMiddleLine(person, village);
}

export function canCannonInRaid(person, village = null) {
  return canJoinRaidMiddleLine(person, village) &&
    !hasAnyTrait(traitList(person, "mindTraits"), CANNON_BLOCKED_MIND_TRAITS) &&
    hasRaidUnlock(village, "hasArcaneFoundry", "arcaneFoundry");
}

export function canFortifyInRaid(person, village = null) {
  return canJoinRaidFrontLine(person) &&
    !traitList(person, "mindTraits").includes(WILD_MIND_TRAIT) &&
    hasRaidUnlock(village, "hasWoodenFence", "woodenFence");
}

export function isRaidAction(action) {
  return RAID_ACTIONS.includes(action);
}

export function isRaidCombatAction(action) {
  return RAID_COMBAT_ACTIONS.includes(action);
}

export function canPerformRaidAction(person, action, village = null) {
  const canPerformByRole = action === ACTION_DEFEND
    ? canDefendInRaid(person, village)
    : action === ACTION_FORTIFY
      ? canFortifyInRaid(person, village)
      : action === ACTION_SHOOT
        ? canShootInRaid(person, village)
        : action === ACTION_CANNON
          ? canCannonInRaid(person, village)
          : action === ACTION_TRAP
            ? canMakeTrapInRaid(person)
            : false;

  return canPerformByRole &&
    Array.isArray(person.actionTable) &&
    person.actionTable.includes(action);
}

export function isRaidActive(village) {
  return Array.isArray(village?.villageTraits) &&
    village.villageTraits.includes(TRAIT_UNDER_RAID) &&
    !village.isRaidProcessDone &&
    Array.isArray(village.raidEnemies) &&
    village.raidEnemies.length > 0;
}

export function getActiveRaidMiddleliners(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  const middleliners = villagers.filter(person => {
    return RAID_MIDDLE_ACTIONS.includes(person.action) &&
      canPerformRaidAction(person, person.action, village);
  });
  const slots = getRaidMiddleSlotCount(village);
  return Number.isFinite(slots)
    ? sortRaidMiddlelinersByPriority(middleliners).slice(0, slots)
    : middleliners;
}

export function getActiveRaidFrontliners(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  const frontliners = villagers.filter(person => {
    return (person.action === ACTION_DEFEND || person.action === ACTION_FORTIFY) &&
      canPerformRaidAction(person, person.action, village);
  });
  return sortRaidFrontlinersByPriority(frontliners).slice(0, getRaidFrontlinerSlotCount(village));
}

export function getActiveRaidTrapMakers(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  const trapMakers = villagers.filter(person => {
    return person.action === ACTION_TRAP && canPerformRaidAction(person, ACTION_TRAP, village);
  });
  return sortRaidTrapMakersByPriority(trapMakers).slice(0, getRaidTrapMakerSlotCount(village));
}

function getRaidActionSlotUsage(village, action, person = null) {
  if (!village || !RAID_ACTIONS.includes(action)) return null;
  const villagers = Array.isArray(village.villagers) ? village.villagers : [];
  const isMiddleAction = RAID_MIDDLE_ACTIONS.includes(action);
  const assigned = isMiddleAction
    ? villagers.filter(item => item !== person && RAID_MIDDLE_ACTIONS.includes(item.action)).length
    : action === ACTION_TRAP
      ? villagers.filter(item => item !== person && item.action === ACTION_TRAP).length
      : villagers.filter(item => item !== person && (item.action === ACTION_DEFEND || item.action === ACTION_FORTIFY)).length;
  const slots = isMiddleAction
    ? getRaidMiddleSlotCount(village)
    : action === ACTION_TRAP
      ? getRaidTrapMakerSlotCount(village)
      : getRaidFrontlinerSlotCount(village);
  return { label: RAID_LINE_LABELS[action], assigned, slots };
}

export function isRaidActionSlotAvailable(village, action, person = null) {
  const usage = getRaidActionSlotUsage(village, action, person);
  return !usage || usage.assigned < usage.slots;
}

/** 枠が埋まって選べない理由。選べる場合は空文字を返す。 */
export function getRaidSlotLimitMessage(village, action, person = null) {
  const usage = getRaidActionSlotUsage(village, action, person);
  if (!usage || usage.assigned < usage.slots) return "";
  return `${usage.label}枠が上限に達しています（${usage.assigned}/${usage.slots}）`;
}

export function getRaidReadiness(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  const frontliners = getActiveRaidFrontliners(village);
  const defenders = frontliners.filter(person => person.action === ACTION_DEFEND);
  const fortifiers = frontliners.filter(person => person.action === ACTION_FORTIFY);
  const middleliners = getActiveRaidMiddleliners(village);
  const shooters = middleliners.filter(person => person.action === ACTION_SHOOT);
  const cannoneers = middleliners.filter(person => person.action === ACTION_CANNON);
  const trapMakers = getActiveRaidTrapMakers(village);
  const combatants = frontliners.concat(middleliners);

  return {
    defenders,
    fortifiers,
    shooters,
    cannoneers,
    middleliners,
    trapMakers,
    frontliners,
    combatants,
    participantCount: combatants.length + trapMakers.length
  };
}
