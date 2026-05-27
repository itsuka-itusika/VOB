import { clampValue } from "../util.js";

export const BASE_STORAGE_LIMIT = 400;
export const BARN_STORAGE_BONUS = 600;
export const STOREHOUSE_STORAGE_BONUS = 3000;
export const MAX_STOREHOUSES = 3;

const LIMITED_RESOURCE_KEYS = ["food", "materials"];
const RESOURCE_LABELS = {
  food: "食料",
  materials: "資材"
};

function countBuilding(village, buildingId) {
  if (!Array.isArray(village?.buildings)) return 0;
  return village.buildings.filter(id => id === buildingId).length;
}

export function hasBarnStorage(village) {
  return !!(
    countBuilding(village, "barn") > 0 ||
    village?.buildingFlags?.hasBarn ||
    village?.buildingFlags?.canBuildStorehouse
  );
}

export function hasStorehouseStorage(village) {
  return countBuilding(village, "storehouse") > 0;
}

export function getResourceStorageWarningRatio(village) {
  if (hasStorehouseStorage(village)) return 0.9;
  if (hasBarnStorage(village)) return 0.8;
  return 0.75;
}

export function getResourceStorageLimit(village) {
  const barnBonus = hasBarnStorage(village) ? BARN_STORAGE_BONUS : 0;
  const storehouseCount = Math.min(countBuilding(village, "storehouse"), MAX_STOREHOUSES);
  return BASE_STORAGE_LIMIT + barnBonus + storehouseCount * STOREHOUSE_STORAGE_BONUS;
}

export function isLimitedResourceKey(key) {
  return LIMITED_RESOURCE_KEYS.includes(key);
}

function normalizeResourceValue(value) {
  return Math.floor(Number(value) || 0);
}

export function clampStoredResource(village, key, { log = true } = {}) {
  if (!village || !isLimitedResourceKey(key)) {
    return { current: 0, limit: getResourceStorageLimit(village), discarded: 0 };
  }

  const limit = getResourceStorageLimit(village);
  const before = normalizeResourceValue(village[key]);
  const after = clampValue(before, 0, limit);
  village[key] = after;

  const discarded = Math.max(0, before - after);
  if (discarded > 0 && log && typeof village.log === "function") {
    village.log(`${RESOURCE_LABELS[key]}の保管上限を超えたため、${discarded}を廃棄しました。`);
  }

  return { current: after, limit, discarded };
}

export function addStoredResource(village, key, amount, options = {}) {
  const gain = Number(amount) || 0;

  if (!isLimitedResourceKey(key)) {
    village[key] = clampValue(normalizeResourceValue(village[key]) + gain, 0, 99999);
    return { current: village[key], limit: 99999, discarded: 0 };
  }

  const { log = true } = options;
  const limit = getResourceStorageLimit(village);
  const current = normalizeResourceValue(village[key]);

  if (gain <= 0) {
    village[key] = Math.max(0, current + gain);
    return { current: village[key], limit, discarded: 0 };
  }

  const upperBound = Math.max(current, limit);
  const next = current + gain;
  village[key] = Math.max(0, Math.min(next, upperBound));

  const discarded = Math.max(0, next - village[key]);
  if (discarded > 0 && log && typeof village.log === "function") {
    village.log(`${RESOURCE_LABELS[key]}の保管上限を超えたため、${discarded}を廃棄しました。`);
  }

  return { current: village[key], limit, discarded };
}

export function clampStoredResources(village, options = {}) {
  return LIMITED_RESOURCE_KEYS.map(key => clampStoredResource(village, key, options));
}

export function getResourceStorageStatus(village, key) {
  const limit = getResourceStorageLimit(village);
  const current = normalizeResourceValue(village?.[key]);
  return {
    current,
    limit,
    remaining: Math.max(0, limit - current),
    ratio: limit > 0 ? current / limit : 1
  };
}
