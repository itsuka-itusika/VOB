import { getCaptives } from "../captives.js";
import { getVillagerWinterMaterialConsumption } from "../util.js";

const AUTUMN_MONTHS = new Set([9, 10, 11]);
const WINTER_MONTHS = new Set([12, 1, 2]);

export function getWinterMonthsToPrepare(month) {
  const value = Number(month);
  if (value === 12) return 3;
  if (value === 1) return 2;
  if (value === 2) return 1;
  return 3;
}

export function getWinterMaterialRequirement(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  const people = villagers.concat(getCaptives(village));
  const monthlyNeed = people.reduce((sum, person) => {
    return sum + getVillagerWinterMaterialConsumption(person);
  }, 0);
  return monthlyNeed * getWinterMonthsToPrepare(village?.month);
}

export function getPostBuildWinterMaterialWarning(village, materialCost) {
  const month = Number(village?.month);
  if (!AUTUMN_MONTHS.has(month) && !WINTER_MONTHS.has(month)) return null;

  const requiredMaterials = getWinterMaterialRequirement(village);
  const remainingMaterials = Math.max(0, (Number(village?.materials) || 0) - Math.max(0, Number(materialCost) || 0));
  if (requiredMaterials <= 0 || remainingMaterials >= requiredMaterials) return null;

  return {
    remainingMaterials,
    requiredMaterials,
    shortfall: requiredMaterials - remainingMaterials,
    periodLabel: WINTER_MONTHS.has(month) ? "現時点の冬越し必要量" : "直近の冬越し必要量"
  };
}
