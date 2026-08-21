const BASE_POP_LIMIT = 8;
const HOUSE_POP_LIMIT_BONUS = 2;
// 訪問者判定枠。酒場で2人になり、自治集落の規模でさらに1人増える。
const BASE_VISITOR_LIMIT = 1;
const TAVERN_VISITOR_LIMIT = 2;
const AUTONOMOUS_SETTLEMENT_SCALE = 350;
const DAMAGE_PROTECTED_BUILDING_IDS = new Set(["bacchusGoldenStatue"]);

function normalizeBuildingId(id) {
  return String(id || "").trim();
}

export function countBuiltBuildings(village, buildingId) {
  const id = normalizeBuildingId(buildingId);
  if (!id || !Array.isArray(village?.buildings)) return 0;
  return village.buildings.filter(item => item === id).length;
}

export function normalizeDamagedBuildings(village) {
  if (!village) return [];
  const source = Array.isArray(village.damagedBuildings)
    ? village.damagedBuildings
    : [];
  const used = {};
  village.damagedBuildings = source
    .map(normalizeBuildingId)
    .filter(id => {
      if (!id) return false;
      const nextCount = (used[id] || 0) + 1;
      if (nextCount > countBuiltBuildings(village, id)) return false;
      used[id] = nextCount;
      return true;
    });
  return village.damagedBuildings;
}

export function countDamagedBuildings(village, buildingId) {
  const id = normalizeBuildingId(buildingId);
  if (!id) return 0;
  return normalizeDamagedBuildings(village).filter(item => item === id).length;
}

export function countActiveBuildings(village, buildingId) {
  return Math.max(0, countBuiltBuildings(village, buildingId) - countDamagedBuildings(village, buildingId));
}

export function hasActiveBuilding(village, buildingId) {
  return countActiveBuildings(village, buildingId) > 0;
}

export function hasActiveBuildingFlag(village, flagName, buildingId) {
  if (!village) return false;
  if (countBuiltBuildings(village, buildingId) > 0) {
    return hasActiveBuilding(village, buildingId);
  }
  return !!village.buildingFlags?.[flagName];
}

export function getActiveBuildingIds(village) {
  if (!Array.isArray(village?.buildings)) return [];
  const ids = [...new Set(village.buildings.map(normalizeBuildingId).filter(Boolean))];
  return ids.flatMap(id => Array(countActiveBuildings(village, id)).fill(id));
}

export function damageBuilding(village, buildingId) {
  const id = normalizeBuildingId(buildingId);
  if (!id || DAMAGE_PROTECTED_BUILDING_IDS.has(id) || countActiveBuildings(village, id) <= 0) return false;
  normalizeDamagedBuildings(village).push(id);
  return true;
}

export function isBuildingDamageable(buildingId) {
  const id = normalizeBuildingId(buildingId);
  return !!id && !DAMAGE_PROTECTED_BUILDING_IDS.has(id);
}

export function repairDamagedBuilding(village, buildingId) {
  const id = normalizeBuildingId(buildingId);
  if (!id) return false;
  const damaged = normalizeDamagedBuildings(village);
  const index = damaged.indexOf(id);
  if (index < 0) return false;
  damaged.splice(index, 1);
  return true;
}

function ensureNonHousePopLimitBonus(village) {
  if (!village) return 0;
  const current = Number(village.nonHousePopLimitBonus);
  if (Number.isFinite(current)) {
    village.nonHousePopLimitBonus = Math.max(0, Math.floor(current));
    return village.nonHousePopLimitBonus;
  }

  const rawPopLimit = Number(village.popLimit);
  const builtHouseBonus = countBuiltBuildings(village, "house") * HOUSE_POP_LIMIT_BONUS;
  village.nonHousePopLimitBonus = Math.max(
    0,
    Math.floor((Number.isFinite(rawPopLimit) ? rawPopLimit : BASE_POP_LIMIT) - BASE_POP_LIMIT - builtHouseBonus)
  );
  return village.nonHousePopLimitBonus;
}

export function getVisitorLimit(village) {
  const baseLimit = hasActiveBuildingFlag(village, "hasTavern", "tavern")
    ? TAVERN_VISITOR_LIMIT
    : BASE_VISITOR_LIMIT;
  const prosperityBonus = (Number(village?.building) || 0) >= AUTONOMOUS_SETTLEMENT_SCALE ? 1 : 0;
  return Math.max(1, baseLimit + prosperityBonus);
}

export function recalculateBuildingDerivedState(village) {
  if (!village) return;
  normalizeDamagedBuildings(village);
  const nonHouseBonus = ensureNonHousePopLimitBonus(village);
  village.popLimit = BASE_POP_LIMIT + nonHouseBonus + countActiveBuildings(village, "house") * HOUSE_POP_LIMIT_BONUS;
  village.visitorLimit = getVisitorLimit(village);
}

export function addNonHousePopLimitBonus(village, amount) {
  if (!village) return;
  const bonus = ensureNonHousePopLimitBonus(village);
  village.nonHousePopLimitBonus = Math.max(0, bonus + Math.floor(Number(amount) || 0));
  recalculateBuildingDerivedState(village);
}
