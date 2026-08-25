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
const ROUGH_FEMALE_RAIDER_TYPES = new Set(["ハーピー", "ハーピーの長"]);

export function getRaiderSpeechType(person) {
  const raiderType = typeof person === "string"
    ? person
    : String(person?.raiderType || person?.job || person?.type || "");
  if (raiderType === "狼" || raiderType === "餓狼") return "狼";
  if (["ゴブリン", "ゴブリンリーダー", "ゴブリン射手"].includes(raiderType)) return "ゴブリン";
  if (ROUGH_RAIDER_TYPES.has(raiderType)) return "乱暴";
  if (POLITE_MALE_RAIDER_TYPES.has(raiderType)) return "丁寧Ｍ";
  if (POLITE_FEMALE_RAIDER_TYPES.has(raiderType)) return "丁寧Ｆ";
  if (ROUGH_FEMALE_RAIDER_TYPES.has(raiderType)) return "蓮っ葉";
  if (raiderType === "スフィンクス") {
    const sex = person?.spiritSex || person?.bodySex;
    return sex === "女" ? "中性的" : "クールＭ";
  }
  return "";
}
