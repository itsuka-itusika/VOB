// difficulty.js
// 難易度設定。高難易度（難しい）は襲撃まわりの被害が重くなる。
// 保存データに difficulty として持ち、未設定の古いデータはノーマル扱いにする。

export const DIFFICULTY_NORMAL = "normal";
export const DIFFICULTY_HARD = "hard";

export function normalizeDifficulty(value) {
  return value === DIFFICULTY_HARD ? DIFFICULTY_HARD : DIFFICULTY_NORMAL;
}

export function isHardMode(village) {
  return normalizeDifficulty(village?.difficulty) === DIFFICULTY_HARD;
}

// 高難易度の係数。
// 襲撃・重体まわりは確率の底上げではなく、
// 「連続襲撃の猶予なし」「全襲撃で重体判定」という形で実装する。
export const HARD_FATAL_WOUND_CHANCE = 0.1; // 負傷離脱時に致命傷が残る確率
export const HARD_AFTEREFFECT_CHANCE = 0.1; // 負傷離脱時に後遺症が残る確率
