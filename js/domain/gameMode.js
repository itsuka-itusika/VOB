// gameMode.js
// ゲームモード。ゴブリンモードは初期村人が全員ゴブリンになり、ゴブリンの訪問者・襲撃・捕虜が増える。
// 保存データに gameMode として持ち、未設定の古いデータはノーマル扱いにする。

export const GAME_MODE_NORMAL = "normal";
export const GAME_MODE_GOBLIN = "goblin";

export function normalizeGameMode(value) {
  return value === GAME_MODE_GOBLIN ? GAME_MODE_GOBLIN : GAME_MODE_NORMAL;
}

export function isGoblinMode(village) {
  return normalizeGameMode(village?.gameMode) === GAME_MODE_GOBLIN;
}

export const GOBLIN_RACE = "ゴブリン";
const GOBLIN_RAIDER_TYPES = new Set(["ゴブリン", "ゴブリンリーダー", "ゴブリン射手"]);

/** ゴブリン系の襲撃者か。捕虜になった後も元の襲撃者の種類で判定する。 */
export function isGoblinRaider(person) {
  return GOBLIN_RAIDER_TYPES.has(String(person?.raiderType || person?.job || ""));
}

/** 出てくる襲撃者がゴブリン系だけの襲撃か。 */
export function isGoblinRaid(enemyGroups) {
  return Array.isArray(enemyGroups)
    && enemyGroups.length > 0
    && enemyGroups.every(group => GOBLIN_RAIDER_TYPES.has(group?.raiderType));
}

// ゴブリンモードの係数。
// 訪問者の抽選表に加えるゴブリンの重み。各表の重みの合計はおよそ100。
export const GOBLIN_MODE_VISITOR_WEIGHT = 20;
// ゴブリンの訪問者の勧誘・誘惑の係数（棄民と同じ）。
export const GOBLIN_VISITOR_RECRUITMENT_COEFFICIENT = 0.9;
// 各襲撃テーブルで、ゴブリン系だけの襲撃の重みに掛ける倍率。
export const GOBLIN_MODE_RAID_WEIGHT_MULTIPLIER = 1.5;
// ゴブリン系の捕虜を懐柔・誘惑する時の係数に掛ける倍率。
export const GOBLIN_MODE_CAPTIVE_SOCIAL_MULTIPLIER = 1.5;

/** 村人の半数以上が種族ゴブリンか。訪問者の反応を切り替えるのに使い、モードは問わない。 */
export function isGoblinMajorityVillage(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  if (villagers.length === 0) return false;
  const goblins = villagers.filter(person => person?.race === GOBLIN_RACE).length;
  return goblins * 2 >= villagers.length;
}
