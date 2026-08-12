const optionsByVillage = new WeakMap();

const DEFAULT_OPTIONS = Object.freeze({
  suppressRandomEvents: false,
  suppressVisitors: false,
  suppressBuildingRequests: false,
  suppressRaids: false
});

export function setBalanceSimulationOptions(village, options = {}) {
  if (!village || typeof village !== "object") return DEFAULT_OPTIONS;
  const normalized = Object.freeze({
    suppressRandomEvents: options.suppressRandomEvents === true,
    suppressVisitors: options.suppressVisitors === true,
    suppressBuildingRequests: options.suppressBuildingRequests === true,
    suppressRaids: options.suppressRaids === true
  });
  optionsByVillage.set(village, normalized);
  return normalized;
}

export function getBalanceSimulationOptions(village) {
  return optionsByVillage.get(village) || DEFAULT_OPTIONS;
}
