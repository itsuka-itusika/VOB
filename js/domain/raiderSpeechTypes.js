const ROUGH_RAIDER_TYPES = new Set([
  "野盗",
  "傭兵団",
  "傭兵射手",
  "キュクロプス",
  "遊牧民",
  "強遊牧民",
  "セントール",
  "傭兵",
  "騎馬兵団兵"
]);
const POLITE_MALE_RAIDER_TYPES = new Set([
  "下級騎士",
  "重装兵",
  "上級騎士",
  "聖騎士"
]);
const POLITE_FEMALE_RAIDER_TYPES = new Set([
  "聖女",
  "翼人兵",
  "上位翼人"
]);
const HARPY_RAIDER_TYPES = new Set(["ハーピー", "ハーピーの長"]);
// 種族そのものに結びついた口調。精神側に残るため、身体が変わっても引き継がれる。
const SPECIES_SPEECH_TYPES = new Set(["狼", "ゴブリン", "ハーピー", "スフィンクス"]);

/** 種族に結びついた口調か。成長処理で人間の口調へ書き換えないために使う。 */
export function isSpeciesSpeechType(speechType) {
  return SPECIES_SPEECH_TYPES.has(String(speechType || ""));
}

export function getRaiderSpeechType(person) {
  const raiderType = typeof person === "string"
    ? person
    : String(person?.raiderType || person?.job || person?.type || "");
  if (raiderType === "狼" || raiderType === "餓狼") return "狼";
  if (["ゴブリン", "ゴブリンリーダー", "ゴブリン射手"].includes(raiderType)) return "ゴブリン";
  if (ROUGH_RAIDER_TYPES.has(raiderType)) return "乱暴";
  if (POLITE_MALE_RAIDER_TYPES.has(raiderType)) return "丁寧Ｍ";
  if (POLITE_FEMALE_RAIDER_TYPES.has(raiderType)) return "丁寧Ｆ";
  if (HARPY_RAIDER_TYPES.has(raiderType)) return "ハーピー";
  if (raiderType === "スフィンクス") return "スフィンクス";
  return "";
}
