import { clampValue } from "./util.js";
import { syncEffectiveStats } from "./domain/statLayers.js";
import { hasActiveBuildingFlag } from "./domain/buildingState.js";
import { getRaiderSpeechType } from "./domain/raiderSpeechTypes.js";
import { ACTION_SALT_PILLAR } from "./domain/jobTables.js";
import { isSaltPillar } from "./domain/apocalypseRules.js";

export const ACTION_CAPTIVE = "虜囚";
export const CAPTIVE_TRAIT = "捕虜";
export const CAPTIVE_FAILED_TRAIT = "懐柔失敗";
export const CAPTIVE_SOCIAL_COEFFICIENT = 0.1;
export const CAPTIVE_SOCIAL_COEFFICIENTS = Object.freeze({
  "野盗": 0.3,
  "傭兵団": 0.3,
  "傭兵射手": 0.2,
  "ゴブリン": 0.4,
  "ゴブリン射手": 0.3,
  "ゴブリンリーダー": 0.2,
  "狼": 0.4,
  "餓狼": 0.2,
  "キュクロプス": 0.2,
  "ハーピー": 0.3,
  "ハーピーの長": 0.2,
  "遊牧民": 0.3,
  "強遊牧民": 0.08,
  "セントール": 0.2,
  "下級騎士": 0.2,
  "重装兵": 0.08,
  "上級騎士": 0.08,
  "聖騎士": 0.06,
  "聖女": 0.06,
  "スフィンクス": 0.2,
  "翼人兵": 0.06,
  "上位翼人": 0.04,
  "騎馬兵団兵": 0.06
});
export const MAX_CAPTIVES = 3;
export const HOLDING_CELL_MAX_CAPTIVES = 1;
export const CAPTIVE_RELEASE_MONTHS = 6;

function getMonthIndex(year, month) {
  return (Number(year) || 0) * 12 + Math.max(0, (Number(month) || 1) - 1);
}

function getVillageMonthIndex(village) {
  return getMonthIndex(village?.year, village?.month);
}

function monthIndexToDate(monthIndex) {
  const index = Math.max(0, Math.floor(Number(monthIndex) || 0));
  return {
    year: Math.floor(index / 12),
    month: (index % 12) + 1
  };
}

export function getCaptives(village) {
  if (!village) return [];
  if (!Array.isArray(village.captives)) {
    village.captives = [];
  }
  return village.captives;
}

export function hasPrison(village) {
  return getCaptiveLimit(village) > 0;
}

export function getCaptiveLimit(village) {
  if (hasActiveBuildingFlag(village, "hasPrison", "prison")) return MAX_CAPTIVES;
  if (hasActiveBuildingFlag(village, "hasHoldingCell", "holdingCell")) return HOLDING_CELL_MAX_CAPTIVES;
  return 0;
}

export function canHoldMoreCaptives(village) {
  return getCaptives(village).length < getCaptiveLimit(village);
}

export function isCaptive(person, village) {
  return !!person && (
    getCaptives(village).includes(person) ||
    (Array.isArray(person.mindTraits) && person.mindTraits.includes(CAPTIVE_TRAIT))
  );
}

export function getCaptiveSocialCoefficient(person) {
  const mindTraits = Array.isArray(person?.mindTraits) ? person.mindTraits : [];
  const blocksSocialAttempts = mindTraits.some(trait => (
    trait === "狂信" || String(trait).startsWith("秘蹟：")
  ));
  if (blocksSocialAttempts) return 0;

  const raiderType = String(person?.raiderType || person?.job || "");
  return CAPTIVE_SOCIAL_COEFFICIENTS[raiderType] ?? CAPTIVE_SOCIAL_COEFFICIENT;
}

export function normalizeCaptive(person) {
  if (!person) return person;
  person.mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  person.bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
  person.mindTraits = person.mindTraits.filter(trait => trait !== "襲撃者" && trait !== "訪問者");
  if (!person.mindTraits.includes(CAPTIVE_TRAIT)) {
    person.mindTraits.push(CAPTIVE_TRAIT);
  }
  person.job = ACTION_CAPTIVE;
  person.preferredAction = ACTION_CAPTIVE;
  person.jobTable = [ACTION_CAPTIVE];
  person.action = isSaltPillar(person) ? ACTION_SALT_PILLAR : ACTION_CAPTIVE;
  person.actionTable = [person.action];
  person.assignmentLocked = true;
  syncEffectiveStats(person);
  return person;
}

export function normalizeFormerCaptive(person) {
  if (!person) return person;
  const speechType = getRaiderSpeechType(person);
  if (speechType) {
    person.speechType = speechType;
  }
  person.mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  person.mindTraits = person.mindTraits.filter(trait =>
    trait !== CAPTIVE_TRAIT &&
    trait !== CAPTIVE_FAILED_TRAIT &&
    trait !== "襲撃者"
  );
  person.assignmentLocked = false;
  delete person.raiderType;
  delete person.raiderRole;
  delete person.raidPosition;
  delete person.raidTargeting;
  delete person.raiderDialogues;
  const separatorIndex = String(person.name || "").indexOf("の");
  if (separatorIndex >= 0) {
    person.name = person.name.slice(separatorIndex + 1);
  }
  return person;
}

export function releaseCaptive(village, captive) {
  const captives = getCaptives(village);
  const index = captives.indexOf(captive);
  if (index >= 0) {
    captives.splice(index, 1);
  }
}

export function setCaptiveReleaseDeadline(village, captive) {
  if (!village || !captive) return captive;
  captive.capturedYear = Number(village.year) || 0;
  captive.capturedMonth = Number(village.month) || 1;
  captive.releaseMonthIndex = getVillageMonthIndex(village) + CAPTIVE_RELEASE_MONTHS;
  return captive;
}

export function ensureCaptiveReleaseDeadline(village, captive) {
  if (!village || !captive) return captive;
  const releaseIndex = Math.floor(Number(captive.releaseMonthIndex));
  if (Number.isFinite(releaseIndex) && releaseIndex > 0) return captive;
  const capturedYear = Number(captive.capturedYear);
  const capturedMonth = Number(captive.capturedMonth);
  const baseIndex = Number.isFinite(capturedYear) && Number.isFinite(capturedMonth)
    ? getMonthIndex(capturedYear, capturedMonth)
    : getVillageMonthIndex(village);
  captive.releaseMonthIndex = baseIndex + CAPTIVE_RELEASE_MONTHS;
  if (!Number.isFinite(capturedYear)) captive.capturedYear = Number(village.year) || 0;
  if (!Number.isFinite(capturedMonth)) captive.capturedMonth = Number(village.month) || 1;
  return captive;
}

export function getCaptiveMonthsUntilRelease(village, captive) {
  ensureCaptiveReleaseDeadline(village, captive);
  return Math.max(0, Math.floor(Number(captive.releaseMonthIndex) || 0) - getVillageMonthIndex(village));
}

export function formatCaptiveReleaseDeadline(village, captive) {
  ensureCaptiveReleaseDeadline(village, captive);
  const releaseDate = monthIndexToDate(captive.releaseMonthIndex);
  const monthsLeft = getCaptiveMonthsUntilRelease(village, captive);
  const remainingText = monthsLeft <= 0 ? "今月解放" : `残り${monthsLeft}ヶ月`;
  return `解放期限: ${releaseDate.year}年${releaseDate.month}月（${remainingText}）`;
}

export function processCaptiveReleaseDeadlines(village) {
  const currentMonthIndex = getVillageMonthIndex(village);
  const dueCaptives = getCaptives(village).filter(captive => {
    ensureCaptiveReleaseDeadline(village, captive);
    return Math.floor(Number(captive.releaseMonthIndex) || 0) <= currentMonthIndex;
  });
  dueCaptives.forEach(captive => {
    releaseCaptive(village, captive);
    village.log(`${captive.name}は収監期限を終えたため解放されました`);
  });
  return dueCaptives;
}

export function isCapturableRaider(person) {
  if (!person) return false;
  if (person.uncapturable) return false;
  return Array.isArray(person.mindTraits) && person.mindTraits.includes("襲撃者");
}

export function recordDefeatedRaidEnemy(village, enemy) {
  if (!village || !enemy || !isCapturableRaider(enemy)) return;
  if (!Array.isArray(village.defeatedRaidEnemies)) {
    village.defeatedRaidEnemies = [];
  }
  if (!village.defeatedRaidEnemies.includes(enemy)) {
    village.defeatedRaidEnemies.push(enemy);
  }
}

export function tryCaptureRaidPrisoner(village) {
  if (!hasPrison(village)) return null;
  if (!canHoldMoreCaptives(village)) {
    village.log(`捕虜の収容施設は満員です。捕虜は最大${getCaptiveLimit(village)}名までです`);
    return null;
  }

  const defeated = Array.isArray(village.defeatedRaidEnemies)
    ? village.defeatedRaidEnemies
    : [];
  const remainingDefeated = Array.isArray(village.raidEnemies)
    ? village.raidEnemies.filter(enemy => Number(enemy.hp) <= 0)
    : [];
  const candidates = defeated.concat(remainingDefeated)
    .filter((enemy, index, list) => list.indexOf(enemy) === index)
    .filter(isCapturableRaider);

  if (candidates.length === 0) {
    village.log("捕虜にできる襲撃者はいませんでした");
    return null;
  }
  if (Math.random() >= 0.5) {
    village.log("捕虜を取る機会はありましたが、逃しました");
    return null;
  }

  const captive = candidates[Math.floor(Math.random() * candidates.length)];
  captive.hp = clampValue(Math.max(1, Number(captive.hp) || 0), 0, 100);
  captive.mp = clampValue(Number(captive.mp) || 0, 0, 100);
  normalizeCaptive(captive);
  setCaptiveReleaseDeadline(village, captive);
  getCaptives(village).push(captive);
  village.log(`収容施設に${captive.name}を捕虜として収容しました`);
  return captive;
}

export function clearDefeatedRaidEnemies(village) {
  if (village) {
    village.defeatedRaidEnemies = [];
  }
}

export function getPeopleForFoodAndWinterMaterials(village) {
  return (village?.villagers || []).concat(getCaptives(village));
}

export function processCaptiveActionRecovery(village) {
  const captives = getCaptives(village);
  captives.forEach(captive => {
    if (isSaltPillar(captive)) return;
    captive.hp = clampValue((Number(captive.hp) || 0) + 10, 0, 100);
    captive.mp = clampValue((Number(captive.mp) || 0) + 10, 0, 100);
  });
  if (captives.length > 0) {
    village.log(`虜囚:${captives.length}名 体力+10,メンタル+10`);
  }
}

export function clearCaptiveFailedTraits(village) {
  getCaptives(village).forEach(captive => {
    if (!Array.isArray(captive.mindTraits)) return;
    captive.mindTraits = captive.mindTraits.filter(trait => trait !== CAPTIVE_FAILED_TRAIT);
  });
}
