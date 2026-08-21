// relationships.js

import { randInt, clampValue, getPortraitPath } from "./util.js";
import { recordLoverHistory, recordMarriageHistory, recordSocialRelationHistory } from "./history.js";
import { runAfterFestivalModals } from "./festivalModal.js";
import { isSaltPillar } from "./domain/apocalypseRules.js";

const FRIENDSHIP_MIN = -100;
const FRIENDSHIP_MAX = 100;
const FRIENDSHIP_FOUNDING_VALUE = 20;
const FRIENDSHIP_LABELS = [
  { min: -100, max: -60, label: "憎悪" },
  { min: -59, max: -30, label: "嫌悪" },
  { min: -29, max: -1, label: "敬遠" },
  { min: 0, max: 19, label: "普通" },
  { min: 20, max: 39, label: "友好的" },
  { min: 40, max: 59, label: "好意的" },
  { min: 60, max: 79, label: "親愛" },
  { min: 80, max: 100, label: "魂の友" }
];
const FRIENDSHIP_WORK_EXCLUDED_ACTIONS = new Set([
  "なし",
  "休養",
  "余暇",
  "遊び",
  "療養",
  "揺籃",
  "臨終",
  "迎撃",
  "籠城",
  "射撃",
  "火砲",
  "罠作成"
]);
const FRIENDSHIP_MAIN_RELATED_PREFIXES = new Set(["恋人", "夫", "妻", "親友"]);
const FRIENDSHIP_MAIN_RELATED_BOUNDS = { min: 65, max: 75 };
const FRIENDSHIP_DEFAULT_BOUNDS = { min: -30, max: 30 };

/**
 * 恋人チェック (星霜祭などで呼ばれる)
 */
export function doLoverCheck(village, options = {}) {
  let candidatesA = village.villagers.filter(x=>
    x.spiritAge >= 16
    && !isSaltPillar(x)
    && isSingle(x)
    && !hasMindTrait(x, "神聖")
    && !hasMindTrait(x, "野生")
  );
  if (candidatesA.length===0) {
    village.log("恋人判定:対象者なし");
    return false;
  }

  let a = randChoice(candidatesA);
  let candidatesB = village.villagers.filter(b=>isLoverCandidate(a, b));
  if (candidatesB.length===0) {
    village.log(`恋人判定:${a.name}の相手候補なし`);
    return false;
  }

  let b = randChoice(candidatesB);
  let sc = getLoverSuccessRate(a, b);
  if (Math.random()<=sc) {
    addRelationship(a, `恋人:${b.name}`);
    addRelationship(b, `恋人:${a.name}`);
    raiseMutualFriendshipTo(a, b, 50);
    a.happiness=clampValue(a.happiness+50,0,100);
    b.happiness=clampValue(b.happiness+50,0,100);
    recordLoverHistory(village, a, b, { source: options.source || "縁結び" });
    village.log(`${a.name}と${b.name}恋人成立(成功率${(sc*100).toFixed(1)}%)`);
    showRelationshipModal("恋人成立", `${a.name}と${b.name}が恋人になりました。`, [
      [a, getLoverLine(a, b)],
      [b, getLoverLine(b, a)]
    ]);
    return true;
  } else {
    village.log(`${a.name}と${b.name}恋愛失敗`);
    return false;
  }
}

export function isSingle(person) {
  return !checkHasRelationship(person,"既婚") &&
    !hasLoverRelationship(person) &&
    !hasRelationshipPrefix(person, SPOUSE_RELATION_PREFIXES);
}

/** 恋人がいるか。「元恋人」を恋人と誤判定しないよう、前置きで判定する。 */
export function hasLoverRelationship(person) {
  return hasRelationshipPrefix(person, LOVER_RELATION_PREFIXES);
}

function getOppositeSex(sex) {
  if (sex === "男") return "女";
  if (sex === "女") return "男";
  return null;
}

function isLoverCandidate(a, b) {
  if (!a || !b || a === b) return false;
  if (isSaltPillar(a) || isSaltPillar(b)) return false;
  if (hasMindTrait(a, "神聖") || hasMindTrait(b, "神聖")) return false;
  const expectedBodySex = getOppositeSex(a.spiritSex);
  if (!expectedBodySex) return false;
  return isSingle(b)
    && !hasLoverBlockingRelationship(a, b)
    && !hasBodyTrait(b, "四足歩行")
    && !hasBodyTrait(b, "人面獣身")
    && getPairFriendshipMinimum(a, b) >= 30
    && b.bodySex === expectedBodySex
    && b.bodyAge >= 16
    && b.bodyAge >= a.bodyAge - 10
    && b.bodyAge <= a.spiritAge + 8;
}

function getLoverSuccessRate(a, b) {
  let pA=Math.min(100, (Number(a.sexdr) || 0)*4);
  let pB=Math.min(100, (Number(b.sexdr) || 0)*4);
  return clampValue((pA*pB)/10000, 0.2, 1);
}

function hasMindTrait(person, trait) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.includes(trait);
}

function hasBodyTrait(person, trait) {
  return Array.isArray(person?.bodyTraits) && person.bodyTraits.includes(trait);
}

/**
 * 結婚チェック (夏至祭などで呼ばれる)
 */
export function doMarriageCheck(village) {
  let c = village.villagers.filter(x=>
    x.spiritAge>=18
    && !isSaltPillar(x)
    && hasLoverRelationship(x)
    && !checkHasRelationship(x,"既婚")
  );
  if (c.length===0) {
    village.log("結婚判定:該当者なし");
    return;
  }
  let a = randChoice(c);
  let bName = getRelationshipTargetName(a, "恋人");
  if (!bName) return;

  let b = village.villagers.find(xx=>xx.name===bName);
  if (!b || isSaltPillar(b)) return;
  if (!b) return;

  let rA = Math.min(100, (a.ind+a.eth)*2);
  let rB = Math.min(100, (b.ind+b.eth)*2);
  let sc = clampValue((rA*rB)/10000, 0.2, 1);

  if (Math.random()<=sc) {
    removeRelationship(a,`恋人:${b.name}`);
    removeRelationship(b,`恋人:${a.name}`);
    addRelationship(a,"既婚");
    addRelationship(b,"既婚");
    a.happiness=clampValue(a.happiness+50,0,100);
    b.happiness=clampValue(b.happiness+50,0,100);

    addSpouseRelationships(a, b);
    recordMarriageHistory(village, a, b, { source: "夏至祭" });

    village.log(`${a.name}と${b.name}結婚成功`);
    showRelationshipModal("結婚", `${a.name}と${b.name}が結婚しました。`, [
      [a, getMarriageLine(a, b)],
      [b, getMarriageLine(b, a)]
    ]);
  } else {
    village.log(`${a.name}と${b.name}結婚失敗`);
  }
}

/**
 * 関係追加 (重複しない)
 */
const FRIEND_RELATION_PREFIXES = new Set([
  "村設立の同志",
  "恋人",
  "親友",
  "仕事仲間",
  "戦友",
  "元恋人",
  "天敵",
  "かつての天敵"
]);
const FAMILY_RELATION_PREFIXES = new Set(["夫", "妻", "母", "父", "子"]);
const GENETIC_RELATION_PREFIXES = new Set(["遺伝母", "遺伝父"]);
const LOVER_RELATION_PREFIXES = new Set(["恋人"]);
const SPOUSE_RELATION_PREFIXES = new Set(["夫", "妻"]);
const PARENT_CHILD_RELATION_PREFIXES = new Set(["母", "父", "子"]);
const LOVER_BLOCKING_RELATION_PREFIXES = new Set([
  ...SPOUSE_RELATION_PREFIXES,
  ...PARENT_CHILD_RELATION_PREFIXES,
  "天敵"
]);

function getRelationshipCategory(prefix) {
  if (FRIEND_RELATION_PREFIXES.has(prefix) || String(prefix).endsWith("仲間")) return "交友関係";
  if (FAMILY_RELATION_PREFIXES.has(prefix)) return "家族関係";
  if (GENETIC_RELATION_PREFIXES.has(prefix)) return "遺伝関係";
  return null;
}

export function parseRelationship(rel) {
  const raw = String(rel ?? "").trim();
  if (!raw) return null;
  if (raw === "既婚") return { raw, flag: "既婚", category: null, prefix: "既婚", target: null };

  const oldParent = raw.match(/^(.+)の(母|父)$/);
  if (oldParent) return { raw, category: "家族関係", prefix: "子", target: oldParent[1] };

  const oldChild = raw.match(/^(.+)の(息子|娘)$/);
  if (oldChild) return { raw, category: "家族関係", prefix: "母", target: oldChild[1] };

  const categorized = raw.match(/^【([^】]+)】(.+)$/);
  const categoryFromText = categorized ? categorized[1] : null;
  const body = categorized ? categorized[2] : raw;
  const separator = body.includes("：") ? "：" : ":";
  const idx = body.indexOf(separator);
  if (idx < 0) return { raw, category: null, prefix: body, target: null };

  const prefix = body.slice(0, idx).trim();
  const target = body.slice(idx + 1).trim();
  const category = categoryFromText || getRelationshipCategory(prefix);
  return { raw, category, prefix, target };
}

export function normalizeRelationship(rel) {
  const parsed = parseRelationship(rel);
  if (!parsed) return "";
  if (parsed.flag) return parsed.flag;
  if (!parsed.target) return parsed.raw;
  const category = parsed.category || getRelationshipCategory(parsed.prefix);
  const body = `${parsed.prefix}：${parsed.target}`;
  return category ? `【${category}】${body}` : body;
}

export function normalizeRelationships(person) {
  if (!person) return [];
  const source = Array.isArray(person.relationships) ? person.relationships : [];
  person.relationships = [...new Set(source.map(normalizeRelationship).filter(Boolean))];
  return person.relationships;
}

function getParsedRelationships(person) {
  return normalizeRelationships(person)
    .map(parseRelationship)
    .filter(Boolean);
}

function hasRelationshipPrefix(person, prefixes) {
  return getParsedRelationships(person).some(parsed => prefixes.has(parsed.prefix));
}

function hasRelationshipTo(person, targetName, prefixes) {
  return getParsedRelationships(person).some(parsed =>
    parsed.target === targetName && prefixes.has(parsed.prefix)
  );
}

// 恋人、夫婦、親子、天敵のいずれかで結ばれているか。ナンパの対象外判定に使う。
const CLOSE_OR_HOSTILE_RELATION_PREFIXES = new Set([
  "恋人",
  ...LOVER_BLOCKING_RELATION_PREFIXES
]);
const PARTNER_RELATION_PREFIXES = new Set(["恋人", ...SPOUSE_RELATION_PREFIXES]);

export function hasCloseOrHostileRelationship(a, b) {
  if (!a || !b || !a.name || !b.name) return false;
  return hasRelationshipTo(a, b.name, CLOSE_OR_HOSTILE_RELATION_PREFIXES) ||
    hasRelationshipTo(b, a.name, CLOSE_OR_HOSTILE_RELATION_PREFIXES);
}

// 恋人と配偶者をまとめて返す。相手が複数いる場合もすべて含む。
export function getPartnerVillagers(village, person) {
  const names = new Set(getParsedRelationships(person)
    .filter(parsed => PARTNER_RELATION_PREFIXES.has(parsed.prefix))
    .map(parsed => parsed.target)
    .filter(Boolean));
  if (names.size === 0) return [];
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  return villagers.filter(other => other !== person && names.has(other.name));
}

function hasLoverBlockingRelationship(a, b) {
  return hasRelationshipTo(a, b.name, LOVER_BLOCKING_RELATION_PREFIXES) ||
    hasRelationshipTo(b, a.name, LOVER_BLOCKING_RELATION_PREFIXES);
}

function normalizeFriendshipValue(value, fallback = 0) {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : fallback;
  return clampValue(Math.round(safe), FRIENDSHIP_MIN, FRIENDSHIP_MAX);
}

function hasStoredFriendshipValue(person, targetName) {
  if (!person || !targetName) return false;
  const map = ensureFriendshipMap(person);
  return Object.prototype.hasOwnProperty.call(map, targetName) &&
    Number.isFinite(Number(map[targetName]));
}

function ensureFriendshipMap(person) {
  if (!person || typeof person !== "object") return {};
  if (!person.friendships || typeof person.friendships !== "object" || Array.isArray(person.friendships)) {
    person.friendships = {};
  }
  Object.entries(person.friendships).forEach(([name, value]) => {
    const key = String(name || "").trim();
    if (!key || key === person.name) {
      delete person.friendships[name];
      return;
    }
    if (key !== name) {
      delete person.friendships[name];
    }
    person.friendships[key] = normalizeFriendshipValue(value);
  });
  return person.friendships;
}

function normalizeCounterMap(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  Object.entries(value).forEach(([name, count]) => {
    const key = String(name || "").trim();
    const number = Math.max(0, Math.floor(Number(count) || 0));
    if (key && number > 0) result[key] = number;
  });
  return result;
}

function ensureFriendshipStats(person) {
  if (!person || typeof person !== "object") return { workTogether: {}, frontRaidTogether: {} };
  if (!person.friendshipStats || typeof person.friendshipStats !== "object" || Array.isArray(person.friendshipStats)) {
    person.friendshipStats = {};
  }
  person.friendshipStats.workTogether = normalizeCounterMap(person.friendshipStats.workTogether);
  person.friendshipStats.frontRaidTogether = normalizeCounterMap(person.friendshipStats.frontRaidTogether);
  return person.friendshipStats;
}

export function normalizeFriendshipState(person) {
  ensureFriendshipMap(person);
  ensureFriendshipStats(person);
  return person;
}

export function getFriendshipLabel(score) {
  const value = normalizeFriendshipValue(score);
  const item = FRIENDSHIP_LABELS.find(entry => value >= entry.min && value <= entry.max);
  return item ? item.label : "普通";
}

function formatFriendshipScore(score) {
  const value = normalizeFriendshipValue(score);
  return `${getFriendshipLabel(value)}(${value})`;
}

export function getFriendshipScore(a, b, fallback = 0) {
  if (!a || !b || a === b || !a.name || !b.name) return 0;
  const mapA = ensureFriendshipMap(a);
  const valueA = mapA[b.name];
  if (Number.isFinite(Number(valueA))) {
    return normalizeFriendshipValue(valueA, fallback);
  }
  const mapB = ensureFriendshipMap(b);
  const valueB = mapB[a.name];
  return normalizeFriendshipValue(Number.isFinite(Number(valueB)) ? valueB : fallback, fallback);
}

export function getPairFriendshipMinimum(a, b, fallback = 0) {
  return Math.min(getFriendshipScore(a, b, fallback), getFriendshipScore(b, a, fallback));
}

export function getPairFriendshipMaximum(a, b, fallback = 0) {
  return Math.max(getFriendshipScore(a, b, fallback), getFriendshipScore(b, a, fallback));
}

export function setFriendshipScore(a, b, value) {
  if (!a || !b || a === b || !a.name || !b.name) return 0;
  const next = normalizeFriendshipValue(value);
  ensureFriendshipMap(a)[b.name] = next;
  return next;
}

export function adjustFriendshipScore(a, b, delta) {
  if (!a || !b || a === b) return 0;
  return setFriendshipScore(a, b, getFriendshipScore(a, b) + (Number(delta) || 0));
}

export function setMutualFriendship(a, b, value) {
  if (!a || !b || a === b || !a.name || !b.name) return 0;
  const next = normalizeFriendshipValue(value);
  setFriendshipScore(a, b, next);
  setFriendshipScore(b, a, next);
  return next;
}

export function adjustMutualFriendship(a, b, delta) {
  if (!a || !b || a === b) return 0;
  const amount = Number(delta) || 0;
  const nextA = adjustFriendshipScore(a, b, amount);
  const nextB = adjustFriendshipScore(b, a, amount);
  return Math.min(nextA, nextB);
}

export function raiseMutualFriendshipTo(a, b, minimum) {
  const target = normalizeFriendshipValue(minimum);
  if (getFriendshipScore(a, b) < target) setFriendshipScore(a, b, target);
  if (getFriendshipScore(b, a) < target) setFriendshipScore(b, a, target);
  return getPairFriendshipMinimum(a, b);
}

function forEachVillagerPair(village, callback) {
  const villagers = Array.isArray(village?.villagers)
    ? village.villagers.filter(person => !isSaltPillar(person))
    : [];
  for (let i = 0; i < villagers.length; i++) {
    for (let j = i + 1; j < villagers.length; j++) {
      callback(villagers[i], villagers[j]);
    }
  }
}

export function ensureVillageFriendships(village, fallback = 0) {
  if (!village || !Array.isArray(village.villagers)) return;
  village.villagers.forEach(normalizeFriendshipState);
  forEachVillagerPair(village, (a, b) => {
    const aHas = hasStoredFriendshipValue(a, b.name);
    const bHas = hasStoredFriendshipValue(b, a.name);
    if (!aHas && !bHas) {
      setMutualFriendship(a, b, fallback);
    } else if (!aHas) {
      setFriendshipScore(a, b, getFriendshipScore(b, a, fallback));
    } else if (!bHas) {
      setFriendshipScore(b, a, getFriendshipScore(a, b, fallback));
    }
  });
}

export function initializeFoundingFriendships(villagers) {
  if (!Array.isArray(villagers)) return;
  villagers.forEach(normalizeFriendshipState);
  villagers.forEach((a, index) => {
    villagers.slice(index + 1).forEach(b => {
      setMutualFriendship(a, b, FRIENDSHIP_FOUNDING_VALUE);
      addRelationship(a, `村設立の同志:${b.name}`);
      addRelationship(b, `村設立の同志:${a.name}`);
    });
  });
}

export function initializeNewVillagerFriendships(village, newcomer, actor, options = {}) {
  if (!village || !newcomer || !Array.isArray(village.villagers)) return;
  const actorValue = normalizeFriendshipValue(options.actorValue, 0);
  const otherValue = normalizeFriendshipValue(options.otherValue, 0);
  normalizeFriendshipState(newcomer);
  village.villagers.forEach(person => {
    if (person === newcomer) return;
    const value = actor && person === actor ? actorValue : otherValue;
    setMutualFriendship(newcomer, person, value);
  });
}

function incrementMutualPairCounter(a, b, key) {
  const statsA = ensureFriendshipStats(a);
  const statsB = ensureFriendshipStats(b);
  const current = Math.max(Number(statsA[key]?.[b.name]) || 0, Number(statsB[key]?.[a.name]) || 0);
  const next = current + 1;
  statsA[key][b.name] = next;
  statsB[key][a.name] = next;
  return next;
}

function isFriendshipWorkAction(action) {
  const value = String(action || "").trim();
  return !!value && !FRIENDSHIP_WORK_EXCLUDED_ACTIONS.has(value);
}

function rollTwoStepChange(negative = false) {
  const roll = Math.random();
  if (roll < 0.25) return negative ? -2 : 2;
  if (roll < 0.5) return negative ? -1 : 1;
  return 0;
}

function hasMainRelatedRelationship(person, other) {
  return getParsedRelationships(person).some(parsed =>
    parsed.target === other.name && FRIENDSHIP_MAIN_RELATED_PREFIXES.has(parsed.prefix)
  );
}

function getFriendshipBoundsForDirection(person, other) {
  return hasMainRelatedRelationship(person, other)
    ? FRIENDSHIP_MAIN_RELATED_BOUNDS
    : FRIENDSHIP_DEFAULT_BOUNDS;
}

function applyFriendshipBoundsForDirection(person, other) {
  const bounds = getFriendshipBoundsForDirection(person, other);
  const score = getFriendshipScore(person, other);
  if (score < bounds.min) {
    setFriendshipScore(person, other, score + 1);
  } else if (score > bounds.max) {
    setFriendshipScore(person, other, score - 1);
  }
}

function applyFriendshipBounds(a, b) {
  applyFriendshipBoundsForDirection(a, b);
  applyFriendshipBoundsForDirection(b, a);
}

function processSameWorkFriendship(a, b) {
  const action = String(a.action || "").trim();
  if (action !== String(b.action || "").trim() || !isFriendshipWorkAction(action)) return;
  processSameWorkFriendshipDirection(a, b);
  processSameWorkFriendshipDirection(b, a);
  const workCount = incrementMutualPairCounter(a, b, "workTogether");
  if (workCount >= 6) {
    addRelationship(a, `仕事仲間:${b.name}`);
    addRelationship(b, `仕事仲間:${a.name}`);
  }
}

function processSameWorkFriendshipDirection(a, b) {
  const score = getFriendshipScore(a, b);
  if (score >= -10 && score <= 39) {
    adjustFriendshipScore(a, b, 1);
  } else if (score <= -26) {
    adjustFriendshipScore(a, b, -1);
  }
}

function areSpiritAdults(a, b) {
  return Number(a?.spiritAge) >= 16 && Number(b?.spiritAge) >= 16;
}

function processCharmAffinityForDirection(a, b) {
  const score = getFriendshipScore(a, b);
  if (Number(b.chr) >= 20 && score <= 25 && Math.random() < 0.5) {
    adjustFriendshipScore(a, b, 1);
  }
  if (Number(b.chr) <= 10 && getFriendshipScore(a, b) >= -5 && Math.random() < 0.5) {
    adjustFriendshipScore(a, b, -1);
  }
}

function processValueAffinityForDirection(a, b) {
  if (!areSpiritAdults(a, b)) return;
  if (Math.abs(Math.min(20, Number(a.ind) || 0) - Math.min(20, Number(b.ind) || 0)) >= 8 && getFriendshipScore(a, b) >= -55) {
    adjustFriendshipScore(a, b, rollTwoStepChange(true));
  }
  if (Math.abs(Math.min(20, Number(a.eth) || 0) - Math.min(20, Number(b.eth) || 0)) >= 8 && getFriendshipScore(a, b) >= -55) {
    adjustFriendshipScore(a, b, rollTwoStepChange(true));
  }

  if (Math.abs((Number(a.ind) || 0) - (Number(b.ind) || 0)) <= 4 && getFriendshipScore(a, b) <= 59) {
    adjustFriendshipScore(a, b, rollTwoStepChange(false));
  }
  if (Math.abs((Number(a.eth) || 0) - (Number(b.eth) || 0)) <= 4 && getFriendshipScore(a, b) <= 59) {
    adjustFriendshipScore(a, b, rollTwoStepChange(false));
  }
}

function processDesireAffinityForDirection(a, b) {
  if (Number(a.sexdr) >= 20 &&
      Number(a.spiritAge) >= 16 &&
      Number(b.bodyAge) >= 16 &&
      Number(b.chr) >= 16 &&
      a.spiritSex !== b.bodySex &&
      getFriendshipScore(a, b) <= 55 &&
      Math.random() < 0.5) {
    adjustFriendshipScore(a, b, 1);
  }
}

function processAffinityFriendshipDirection(a, b) {
  processCharmAffinityForDirection(a, b);
  processValueAffinityForDirection(a, b);
  processDesireAffinityForDirection(a, b);
}

function processAffinityFriendship(a, b) {
  processAffinityFriendshipDirection(a, b);
  processAffinityFriendshipDirection(b, a);
}

export function processMonthlyFriendship(village) {
  ensureVillageFriendships(village, 0);
  processFriendshipRelationChanges(village);
  forEachVillagerPair(village, (a, b) => {
    processSameWorkFriendship(a, b);
    processAffinityFriendship(a, b);
  });
  processFriendshipRelationChanges(village);
  forEachVillagerPair(village, (a, b) => {
    applyFriendshipBounds(a, b);
  });
}

export function startRaidFriendshipTracking(village, options = {}) {
  if (!village) return;
  const participants = Array.isArray(options.participants) ? options.participants : [];
  const frontliners = Array.isArray(options.frontliners) ? options.frontliners : [];
  village.raidFriendshipParticipants = [...new Set(participants.map(person => person?.name).filter(Boolean))];
  village.raidFriendshipFrontliners = [...new Set(frontliners.map(person => person?.name).filter(Boolean))];
  village.raidFriendshipDamage = {};
}

export function recordRaidFriendshipDamage(village, actor, damage) {
  if (!village || !actor || !actor.name || !Array.isArray(village.villagers) || !village.villagers.includes(actor)) return;
  const amount = Math.max(0, Math.floor(Number(damage) || 0));
  if (amount <= 0) return;
  if (!village.raidFriendshipDamage || typeof village.raidFriendshipDamage !== "object") {
    village.raidFriendshipDamage = {};
  }
  village.raidFriendshipDamage[actor.name] = (Number(village.raidFriendshipDamage[actor.name]) || 0) + amount;
}

export function applyRaidFriendshipResults(village) {
  if (!village || !Array.isArray(village.villagers)) return;
  const nameToVillager = new Map(village.villagers.map(person => [person.name, person]));
  const participantNames = Array.isArray(village.raidFriendshipParticipants)
    ? village.raidFriendshipParticipants
    : village.villagers
      .filter(person => ["迎撃", "籠城", "射撃", "火砲", "罠作成"].includes(person.action))
      .map(person => person.name);
  const participants = [...new Set(participantNames)]
    .map(name => nameToVillager.get(name))
    .filter(Boolean);

  participants.forEach((a, index) => {
    participants.slice(index + 1).forEach(b => {
      adjustMutualFriendship(a, b, 5);
    });
  });

  const frontlinerNames = Array.isArray(village.raidFriendshipFrontliners)
    ? village.raidFriendshipFrontliners
    : village.villagers
      .filter(person => ["迎撃", "籠城"].includes(person.action))
      .map(person => person.name);
  const frontliners = [...new Set(frontlinerNames)]
    .map(name => nameToVillager.get(name))
    .filter(Boolean);
  frontliners.forEach((a, index) => {
    frontliners.slice(index + 1).forEach(b => {
      const count = incrementMutualPairCounter(a, b, "frontRaidTogether");
      if (count >= 3 && getPairFriendshipMinimum(a, b) >= 20) {
        addRelationship(a, `戦友:${b.name}`);
        addRelationship(b, `戦友:${a.name}`);
      }
    });
  });

  const damageEntries = Object.entries(village.raidFriendshipDamage || {})
    .map(([name, damage]) => ({ name, damage: Number(damage) || 0 }))
    .filter(entry => entry.damage > 0 && nameToVillager.has(entry.name))
    .sort((a, b) => b.damage - a.damage);
  const distinguished = damageEntries[0] ? nameToVillager.get(damageEntries[0].name) : null;
  if (distinguished) {
    participants.forEach(person => {
      if (person !== distinguished) adjustMutualFriendship(distinguished, person, 5);
    });
  }

  delete village.raidFriendshipParticipants;
  delete village.raidFriendshipFrontliners;
  delete village.raidFriendshipDamage;
}

export function formatRelationshipsForDisplay(person) {
  const groups = new Map();
  normalizeRelationships(person).forEach(rel => {
    if (rel === "既婚") return;
    const parsed = parseRelationship(rel);
    if (!parsed?.target) return;
    const category = parsed.category || getRelationshipCategory(parsed.prefix) || "その他";
    const item = `${parsed.prefix}：${parsed.target}`;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  if (groups.size === 0) return "なし";
  return Array.from(groups.entries())
    .map(([category, items]) => `【${category}】${items.join("、")}`)
    .join("、");
}

export function addRelationship(p, rel) {
  if (!p) return;
  if (!Array.isArray(p.relationships)) p.relationships = [];
  const normalized = normalizeRelationship(rel);
  if (normalized && !p.relationships.some(existing => normalizeRelationship(existing) === normalized)) {
    p.relationships.push(normalized);
  }
}

/**
 * 関係削除
 */
export function removeRelationship(p, rel) {
  if (!p || !Array.isArray(p.relationships)) return;
  const normalized = normalizeRelationship(rel);
  p.relationships = p.relationships.filter(existing =>
    existing !== rel && normalizeRelationship(existing) !== normalized
  );
}

export function getSpouseRelationshipPrefix(spouse) {
  return spouse?.bodySex === "女" ? "妻" : "夫";
}

export function addSpouseRelationships(a, b) {
  addRelationship(a, `${getSpouseRelationshipPrefix(b)}:${b.name}`);
  addRelationship(b, `${getSpouseRelationshipPrefix(a)}:${a.name}`);
}

function getSpeechType(person) {
  return person.speechType || (person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ");
}

function getChildlikeRelationshipLine(person) {
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  if (mindTraits.includes("無垢")) return randChoice(["あうー。", "んま。", "ばぶ。", "すやすや……"]);
  if (mindTraits.includes("萌芽")) {
    const lines = person.spiritSex === "女"
      ? ["わあ……。", "えへへ、わたしもうれしい。", "これ、なあに？"]
      : ["わあ……。", "えへへ、ぼくもうれしい。", "これ、なあに？"];
    return randChoice(lines);
  }
  return null;
}

function getLoverLine(person, partner) {
  const childLine = getChildlikeRelationshipLine(person);
  if (childLine) return childLine;
  const type = getSpeechType(person);
  const lines = {
    "普通Ｍ": [`${partner.name}と恋人か。大事にしたいな。`, "少し照れるけど、嬉しいよ。"],
    "普通Ｆ": [`${partner.name}さんと恋人なんですね。嬉しいです。`, "これから、もっと一緒にいられたらいいですね。"],
    "強気Ｍ": [`${partner.name}を泣かせるような真似はしない。`, "恋人か。悪くないな。"],
    "強気Ｆ": [`${partner.name}、ちゃんと私を見てなさいよ。`, "恋人になったからには、半端は許さないわ。"],
    "内気": [`${partner.name}さんと……恋人……。どきどきします。`, "う、嬉しいです……。"],
    "陰気": [`……${partner.name}と恋人か。妙な気分だ。`, "……悪くはない。たぶん。"],
    "お調子者": [`${partner.name}と恋人っすか！やったっす！`, "これはもう毎日楽しくなるっすね！"],
    "快活": [`${partner.name}と恋人だね！嬉しい！`, "これからいっぱい話そうね！"],
    "お嬢様": [`${partner.name}様と恋人に……胸が高鳴りますわ。`, "このご縁を大切にいたしますわ。"],
    "クールＭ": [`${partner.name}との関係を大切にする。`, "恋人か。冷静に、誠実に向き合う。"],
    "クールＦ": [`${partner.name}と恋人ね。悪くないわ。`, "浮かれすぎず、大切にするわ。"],
    "老人": [`${partner.name}と恋仲とは、若いものは良いのう。`, "縁とは不思議なものじゃな。"]
  };
  return randChoice(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function getMarriageLine(person, partner) {
  const childLine = getChildlikeRelationshipLine(person);
  if (childLine) return childLine;
  const type = getSpeechType(person);
  const lines = {
    "普通Ｍ": [`${partner.name}と夫婦か……大切にしよう。`, "今日から家族だな。よろしく。"],
    "普通Ｆ": [`${partner.name}さんと夫婦になるんですね。大切にします。`, "今日から家族ですね。嬉しいです。"],
    "強気Ｍ": [`${partner.name}は俺が支える。`, "夫婦になったからには、守り抜く。"],
    "強気Ｆ": [`${partner.name}、これからは私の家族よ。`, "夫婦になったからには、遠慮はなしよ。"],
    "内気": [`${partner.name}さんと夫婦……緊張します。`, "頼りないかもしれませんが、頑張ります。"],
    "陰気": [`……${partner.name}と家族か。`, "……こうなったなら、捨て置けないな。"],
    "お調子者": [`${partner.name}と結婚っすね！いやー、めでたいっす！`, "これはもう頑張るしかないっすね！"],
    "快活": [`${partner.name}、これからよろしくね！`, "夫婦だね！一緒に頑張ろう！"],
    "お嬢様": [`${partner.name}様と夫婦に……末永くよろしくお願いいたしますわ。`, "このご縁を、生涯大切にいたしますわ。"],
    "クールＭ": [`${partner.name}との婚姻を受け止めた。責任を果たす。`, "夫婦として、現実的に支え合おう。"],
    "クールＦ": [`${partner.name}と夫婦ね。落ち着いて歩みましょう。`, "今日から家族。大切にするわ。"],
    "老人": [`${partner.name}と夫婦になるとはのう。残りの日々、大事に歩もう。`, "新しい家族を得たのじゃな。わしも心を尽くそう。"]
  };
  return randChoice(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function showRelationshipModal(title, message, entries) {
  runAfterFestivalModals(() => showRelationshipModalNow(title, message, entries));
}

function showRelationshipModalNow(title, message, entries) {
  if (typeof document === "undefined") return;
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:580px;width:calc(100% - 32px);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
  const rows = entries.map(([person, line]) => `
    <div style="display:grid;grid-template-columns:72px 1fr;gap:12px;margin:12px 0;align-items:center;">
      <img src="${getPortraitPath(person)}" alt="${person.name}" style="width:72px;height:72px;object-fit:cover;border:1px solid #ddd;background:#f6f0e6;">
      <p><strong>${person.name}</strong>: ${line}</p>
    </div>
  `).join("");
  modal.innerHTML = `
    <h2>${title}</h2>
    <p>${message}</p>
    ${rows}
    <button type="button" data-close-relationship-modal>閉じる</button>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-relationship-modal]").onclick = () => {
    overlay.remove();
    modal.remove();
  };
}

function removePairRelationshipsWhere(person, targetName, predicate) {
  if (!person || !targetName || !Array.isArray(person.relationships)) return false;
  const before = person.relationships.length;
  person.relationships = person.relationships.filter(rel => {
    const parsed = parseRelationship(rel);
    return !(parsed?.target === targetName && predicate(parsed));
  });
  return person.relationships.length !== before;
}

function removePairRelationshipByPrefix(a, b, prefix) {
  const removedA = removePairRelationshipsWhere(a, b.name, parsed => parsed.prefix === prefix);
  const removedB = removePairRelationshipsWhere(b, a.name, parsed => parsed.prefix === prefix);
  return removedA || removedB;
}

function getBreakupLine(person, partner) {
  const childLine = getChildlikeRelationshipLine(person);
  if (childLine) return childLine;
  const type = getSpeechType(person);
  const lines = {
    "普通Ｍ": [`${partner.name}とは、もう恋人ではいられない。`, "悪いけど、ここで終わりにしよう。"],
    "普通Ｆ": [`${partner.name}さんとは、もう恋人ではいられません。`, "つらいですが、ここで終わりにします。"],
    "強気Ｍ": [`${partner.name}、ここまでだ。未練は残さない。`, "恋人としては、もう無理だ。"],
    "強気Ｆ": [`${partner.name}、もう終わりよ。これ以上は続けられない。`, "私の気持ちは決まったわ。"],
    "内気": [`${partner.name}さん……ごめんなさい。もう、無理です。`, "泣きたくないのに、涙が出ます……。"],
    "陰気": [`……終わりだ。こうなる気はしていた。`, `……${partner.name}とは、もう戻れない。`],
    "お調子者": [`${partner.name}とは、もう笑ってごまかせないっす。`, "ここで終わりにするっす……。"],
    "快活": [`ごめん、${partner.name}。もう恋人ではいられない。`, "ちゃんと言うね。ここで終わりにしよう。"],
    "お嬢様": [`${partner.name}様、これ以上は続けられませんわ。`, "つらい決断ですが、お別れいたしますわ。"],
    "クールＭ": [`${partner.name}との関係は維持できない。結論は出た。`, "感情ではなく、現実として終わりだ。"],
    "クールＦ": [`${partner.name}とは終わりね。無理に続ける意味はないわ。`, "冷たいようだけれど、ここで区切りましょう。"],
    "老人": [`${partner.name}とは縁が続かなんだか。残念じゃ。`, "長くは保たぬ縁もあるものじゃな。"]
  };
  return randChoice(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function showBreakupModal(village, a, b) {
  village.log(`${a.name}と${b.name}は破局しました`);
  showRelationshipModal("破局", `${a.name}と${b.name}は恋人関係を解消しました。`, [
    [a, getBreakupLine(a, b)],
    [b, getBreakupLine(b, a)]
  ]);
}

export function processFriendshipRelationChanges(village) {
  if (!village || !Array.isArray(village.villagers)) return;
  const handledBreakups = new Set();

  forEachVillagerPair(village, (a, b) => {
    const pairMinimum = getPairFriendshipMinimum(a, b);
    const pairKey = [a.name, b.name].sort().join("\u0000");

    if (pairMinimum <= 39 && !handledBreakups.has(pairKey) && removePairRelationshipByPrefix(a, b, "恋人")) {
      handledBreakups.add(pairKey);
      adjustMutualFriendship(a, b, -20);
      a.happiness = clampValue(a.happiness - 30, 0, 100);
      b.happiness = clampValue(b.happiness - 30, 0, 100);
      addRelationship(a, `元恋人:${b.name}`);
      addRelationship(b, `元恋人:${a.name}`);
      recordSocialRelationHistory(village, a, b, "元恋人", { source: "破局" });
      showBreakupModal(village, a, b);
    }

    if (getPairFriendshipMinimum(a, b) <= 39) {
      removePairRelationshipByPrefix(a, b, "親友");
    }
    if (getPairFriendshipMinimum(a, b) <= 19) {
      removePairRelationshipsWhere(a, b.name, parsed => parsed.prefix === "戦友" || (parsed.prefix.endsWith("仲間") && parsed.prefix !== "仕事仲間"));
      removePairRelationshipsWhere(b, a.name, parsed => parsed.prefix === "戦友" || (parsed.prefix.endsWith("仲間") && parsed.prefix !== "仕事仲間"));
    }
    if (getPairFriendshipMinimum(a, b) >= 0 && removePairRelationshipByPrefix(a, b, "天敵")) {
      addRelationship(a, `かつての天敵:${b.name}`);
      addRelationship(b, `かつての天敵:${a.name}`);
    }
  });
}

function getPersonByName(village, name) {
  return Array.isArray(village?.villagers)
    ? village.villagers.find(person => person.name === name)
    : null;
}

function getRelationshipDisplayLabel(person, other, parsed) {
  switch (parsed.prefix) {
    case "子":
      return other.bodySex === "女" ? "娘" : "息子";
    case "母":
      return "母";
    case "父":
      return "父";
    case "遺伝母":
      return "遺伝上の母";
    case "遺伝父":
      return "遺伝上の父";
    default:
      return parsed.prefix;
  }
}

function collectRelationshipLabels(village, person, other) {
  const labels = [];
  getParsedRelationships(person).forEach(parsed => {
    if (parsed.target === other.name) labels.push(getRelationshipDisplayLabel(person, other, parsed));
  });

  const spouseName = getRelationshipTargetName(person, "夫") || getRelationshipTargetName(person, "妻");
  const spouse = spouseName ? getPersonByName(village, spouseName) : null;
  if (spouse) {
    getParsedRelationships(spouse).forEach(parsed => {
      if (parsed.target === other.name && (parsed.prefix === "母" || parsed.prefix === "父")) {
        labels.push(parsed.prefix === "母" ? "義理の母" : "義理の父");
      }
    });
  }

  return [...new Set(labels)];
}

function collectExchangeLabels(person, other) {
  if (person.bodyOwner === other.name && other.bodyOwner === person.name) return ["入れ替わり関係"];
  const labels = [];
  if (person.bodyOwner === other.name) labels.push("体の本来の持ち主");
  if (other.bodyOwner === person.name) labels.push("かつての身体");
  return [...new Set(labels)];
}

function getFriendshipLabelKind(score) {
  switch (getFriendshipLabel(score)) {
    case "憎悪":
      return "hatred";
    case "嫌悪":
      return "dislike";
    case "敬遠":
      return "avoid";
    case "普通":
      return "neutral";
    case "好意的":
      return "favor";
    case "親愛":
    case "魂の友":
      return "deep";
    default:
      return "none";
  }
}

function hasLabelKindPair(kinds, first, second) {
  return (kinds[0] === first && kinds[1] === second) ||
    (kinds[0] === second && kinds[1] === first);
}

function collectSpecialRelationshipLabels(person, other) {
  const kinds = [
    getFriendshipLabelKind(getFriendshipScore(person, other)),
    getFriendshipLabelKind(getFriendshipScore(other, person))
  ];

  if (hasLabelKindPair(kinds, "hatred", "hatred")) return ["不倶戴天の敵"];
  if (hasLabelKindPair(kinds, "hatred", "dislike") || hasLabelKindPair(kinds, "dislike", "dislike")) return ["犬猿の仲"];
  if (hasLabelKindPair(kinds, "hatred", "avoid") || hasLabelKindPair(kinds, "dislike", "avoid")) return ["苦手意識"];
  if (hasLabelKindPair(kinds, "avoid", "avoid")) return ["よそよそしい仲"];

  if ((kinds.includes("hatred") || kinds.includes("dislike")) && kinds.includes("deep")) return ["一方的な愛"];
  if ((kinds.includes("hatred") || kinds.includes("dislike")) && kinds.includes("favor")) return ["一方的な好意"];
  if ((kinds.includes("avoid") || kinds.includes("neutral")) && kinds.includes("deep")) return ["届かない愛"];
  if ((kinds.includes("avoid") || kinds.includes("neutral")) && kinds.includes("favor")) return ["届かない好意"];
  if (hasLabelKindPair(kinds, "favor", "favor")) return ["仲良し"];
  return [];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function openFriendshipDetailModal(village, person) {
  if (typeof document === "undefined" || !village || !person) return;
  ensureVillageFriendships(village, 0);
  document.getElementById("friendshipDetailOverlay")?.remove();
  document.getElementById("friendshipDetailModal")?.remove();

  const others = (Array.isArray(village.villagers) ? village.villagers : []).filter(other => other !== person);
  const rows = others.map((other, index) => {
    const score = getFriendshipScore(person, other);
    const relationLabels = collectRelationshipLabels(village, person, other);
    const specialLabels = collectSpecialRelationshipLabels(person, other);
    const exchangeLabels = collectExchangeLabels(person, other);
    const friendshipLabel = formatFriendshipScore(score);
    const fixedRelationLabels = relationLabels.length > 0 ? relationLabels : ["村の一員"];
    const labels = [...fixedRelationLabels, ...specialLabels, ...exchangeLabels].join(" / ");
    return `
      <tr>
        <td class="friendship-detail-person">
          <button type="button" class="friendship-detail-portrait-button" data-open-friendship-person="${index}" aria-label="${escapeHtml(other.name)}の個人記録を見る">
            <img src="${escapeHtml(getPortraitPath(other))}" alt="${escapeHtml(other.name)}">
          </button>
          <span>${escapeHtml(other.name)}</span>
        </td>
        <td>${escapeHtml(friendshipLabel)}</td>
        <td>${escapeHtml(labels)}</td>
      </tr>
    `;
  }).join("");

  const overlay = document.createElement("div");
  overlay.id = "friendshipDetailOverlay";
  overlay.className = "friendship-detail-overlay";
  const modal = document.createElement("div");
  modal.id = "friendshipDetailModal";
  modal.className = "friendship-detail-modal";
  modal.innerHTML = `
    <div class="modal-header">${escapeHtml(person.name)}の好感度</div>
    <div class="friendship-detail-content">
      <table class="friendship-detail-table">
        <colgroup>
          <col class="friendship-detail-col-person">
          <col class="friendship-detail-col-score">
          <col class="friendship-detail-col-relation">
        </colgroup>
        <thead>
          <tr>
            <th>相手</th>
            <th>好感度</th>
            <th>関係</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="3" class="friendship-detail-empty">表示できる相手がいません。</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="modal-buttons">
      <button type="button" data-close-friendship-detail>閉じる</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  const close = () => {
    overlay.remove();
    modal.remove();
  };
  modal.querySelectorAll("[data-open-friendship-person]").forEach(button => {
    button.addEventListener("click", async () => {
      const target = others[Number(button.dataset.openFriendshipPerson)];
      if (!target) return;
      const { openPersonalHistoryModal } = await import("./history.js");
      close();
      openPersonalHistoryModal(village, target);
    });
  });
  modal.querySelector("[data-close-friendship-detail]").addEventListener("click", close);
  overlay.addEventListener("click", close);
}

/**
 * 村人が死亡・出立などで村を去る時、残った村人側の関係を整理する
 */
export function clearRelationshipsForDepartedVillager(village, departed) {
  if (!village || !Array.isArray(village.villagers) || !departed) return;

  const departedName = departed.name;
  if (!departedName) return;

  village.villagers.forEach(person => {
    if (person === departed || !Array.isArray(person.relationships)) return;

    let removedSpouse = false;
    const friendships = ensureFriendshipMap(person);
    delete friendships[departedName];
    const stats = ensureFriendshipStats(person);
    delete stats.workTogether[departedName];
    delete stats.frontRaidTogether[departedName];
    normalizeRelationships(person);
    person.relationships = person.relationships.filter(rel => {
      if (rel === "既婚") return true;

      const parsed = parseRelationship(rel);
      const referencesDeparted = parsed?.target === departedName || String(rel).startsWith(`${departedName}の`);
      const isSpouseReference = parsed?.prefix === "夫" ||
        parsed?.prefix === "妻" ||
        rel === `${departedName}の夫` ||
        rel === `${departedName}の妻`;
      if (referencesDeparted && isSpouseReference) {
        removedSpouse = true;
      }
      return !referencesDeparted;
    });

    if (removedSpouse) {
      person.relationships = person.relationships.filter(rel => rel !== "既婚");
    }
  });
}

/**
 * 特定キーワードを含む関係を持っているか
 */
export function checkHasRelationship(p, kw) {
  if (!p || !Array.isArray(p.relationships)) return false;
  return normalizeRelationships(p).some(r => r.includes(kw));
}

/**
 * "prefix:相手名" の相手名を返す
 */
export function getRelationshipTargetName(p, prefix) {
  if (!p || !Array.isArray(p.relationships)) return null;
  let r = normalizeRelationships(p)
    .map(parseRelationship)
    .find(parsed => parsed?.prefix === prefix && parsed.target);
  if (r) return r.target;
  return null;
}

/**
 * ランダムチョイス (本ファイルで使うために再import)
 */
function randChoice(arr) {
  if (!arr || arr.length===0) return null;
  return arr[Math.floor(Math.random()*arr.length)];
}
