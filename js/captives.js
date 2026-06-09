import { clampValue } from "./util.js";
import { syncEffectiveStats } from "./domain/statLayers.js";

export const ACTION_CAPTIVE = "虜囚";
export const CAPTIVE_TRAIT = "捕虜";
export const CAPTIVE_FAILED_TRAIT = "懐柔失敗";
export const CAPTIVE_SOCIAL_COEFFICIENT = 0.1;
export const MAX_CAPTIVES = 3;

const BEAST_RAIDER_RACES = new Set(["狼"]);
const BEAST_RAIDER_TYPES = new Set(["狼", "餓狼"]);

export function getCaptives(village) {
  if (!village) return [];
  if (!Array.isArray(village.captives)) {
    village.captives = [];
  }
  return village.captives;
}

export function hasPrison(village) {
  return !!(
    village?.buildingFlags?.hasPrison ||
    (Array.isArray(village?.buildings) && village.buildings.includes("prison"))
  );
}

export function canHoldMoreCaptives(village) {
  return getCaptives(village).length < MAX_CAPTIVES;
}

export function isCaptive(person, village) {
  return !!person && (
    getCaptives(village).includes(person) ||
    (Array.isArray(person.mindTraits) && person.mindTraits.includes(CAPTIVE_TRAIT))
  );
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
  person.action = ACTION_CAPTIVE;
  person.actionTable = [ACTION_CAPTIVE];
  person.assignmentLocked = true;
  syncEffectiveStats(person);
  return person;
}

export function normalizeFormerCaptive(person) {
  if (!person) return person;
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

export function isCapturableRaider(person) {
  if (!person) return false;
  const raiderType = String(person.raiderType || person.job || "");
  const race = String(person.race || "");
  if (BEAST_RAIDER_TYPES.has(raiderType) || BEAST_RAIDER_RACES.has(race)) return false;
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
    village.log(`牢獄は満員です。捕虜は最大${MAX_CAPTIVES}名までです`);
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
  getCaptives(village).push(captive);
  village.log(`牢獄に${captive.name}を捕虜として収容しました`);
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
