// managementGoals.js
// 台帳の「経営目標」で決める、資金と技術の目標値と過剰ライン。
// 自動割り振りは、目標に届かない資源を優先し、過剰な資源の優先度を下げる。

export const MANAGEMENT_GOAL_AXES = ["funds", "tech"];
export const MANAGEMENT_GOAL_LABELS = Object.freeze({ funds: "資金", tech: "技術" });

// 目標未達の資源はこの倍率で優先され、過剰な資源はこの倍率まで下がる。
export const MANAGEMENT_GOAL_SHORTAGE_MULTIPLIER = 1.5;
export const MANAGEMENT_GOAL_EXCESS_MULTIPLIER = 0.3;

export const MANAGEMENT_GOAL_MIN = 0;
export const MANAGEMENT_GOAL_MAX = 99999;
const DEFAULT_TARGET = 0;
const DEFAULT_EXCESS = 9999;

function normalizeAmount(value, fallback) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(MANAGEMENT_GOAL_MIN, Math.min(MANAGEMENT_GOAL_MAX, number));
}

function normalizeAxisGoal(source) {
  const target = normalizeAmount(source?.target, DEFAULT_TARGET);
  const excess = normalizeAmount(source?.excess, DEFAULT_EXCESS);
  // 過剰ラインが目標を下回ると「未達かつ過剰」になってしまうため、目標以上へ押し上げる。
  return { target, excess: Math.max(target, excess) };
}

export function normalizeManagementGoals(source = null) {
  const goals = {};
  MANAGEMENT_GOAL_AXES.forEach(axis => {
    goals[axis] = normalizeAxisGoal(source?.[axis]);
  });
  return goals;
}

export function getManagementGoals(village) {
  const goals = normalizeManagementGoals(village?.managementGoals);
  if (village) village.managementGoals = goals;
  return goals;
}

export function setManagementGoals(village, source) {
  if (!village) return normalizeManagementGoals(source);
  village.managementGoals = normalizeManagementGoals(source);
  return village.managementGoals;
}

/**
 * その資源軸の重み倍率。目標未達なら上げ、過剰なら下げる。
 * 目標0・過剰9999の初期値では、どちらにも当たらず等倍のままになる。
 */
export function getManagementGoalMultiplier(axis, amount, goals) {
  const goal = goals?.[axis];
  if (!goal) return 1;
  const current = Number(amount) || 0;
  if (current < goal.target) return MANAGEMENT_GOAL_SHORTAGE_MULTIPLIER;
  if (current >= goal.excess) return MANAGEMENT_GOAL_EXCESS_MULTIPLIER;
  return 1;
}
