// 会話エンジンが使う実効口調定義。
// 保存データの speechType は変更せず、無垢/萌芽はここで仮想口調として解決する。

export const DEFAULT_MALE_TONE = "普通Ｍ";
export const DEFAULT_FEMALE_TONE = "普通Ｆ";

export const TONE_ALIASES = {
  "無垢": "赤子"
};

export const TONE_PROFILES = {
  "赤子": { family: "infant", gender: "child", fallback: ["baby", "infant", "child", "default"] },
  "無垢": { aliasOf: "赤子", family: "infant", gender: "child", fallback: ["baby", "infant", "child", "default"] },
  "男児": { family: "childMale", gender: "male", fallback: ["childMale", "child", "male", "default"] },
  "女児": { family: "childFemale", gender: "female", fallback: ["childFemale", "child", "female", "default"] },

  "普通Ｍ": { family: "normalMale", gender: "male", fallback: ["male", "default"] },
  "丁寧Ｍ": { family: "polite", gender: "male", fallback: ["polite", "male", "default"] },
  "強気Ｍ": { family: "bold", gender: "male", fallback: ["bold", "male", "default"] },
  "乱暴": { family: "rough", gender: "male", fallback: ["rough", "bold", "male", "default"] },
  "お調子者": { family: "bright", gender: "male", fallback: ["bright", "male", "default"] },
  "陰気": { family: "shy", gender: "male", fallback: ["shy", "male", "default"] },
  "クールＭ": { family: "cool", gender: "male", fallback: ["cool", "male", "default"] },

  "普通Ｆ": { family: "normalFemale", gender: "female", fallback: ["female", "default"] },
  "丁寧Ｆ": { family: "polite", gender: "female", fallback: ["polite", "female", "default"] },
  "お嬢様": { family: "polite", gender: "female", fallback: ["polite", "female", "default"] },
  "快活": { family: "bright", gender: "female", fallback: ["bright", "female", "default"] },
  "内気": { family: "shy", gender: "female", fallback: ["shy", "female", "default"] },
  "強気Ｆ": { family: "bold", gender: "female", fallback: ["bold", "female", "default"] },
  "蓮っ葉": { family: "rough", gender: "female", fallback: ["rough", "bold", "female", "default"] },
  "おっとり": { family: "polite", gender: "female", fallback: ["polite", "female", "default"] },
  "ぶりっこ": { family: "cute", gender: "female", fallback: ["cute", "bright", "female", "default"] },
  "クールＦ": { family: "cool", gender: "female", fallback: ["cool", "female", "default"] },
  "ギャル風": { family: "bright", gender: "female", fallback: ["bright", "female", "default"] },
  "中性的": { family: "neutralFemale", gender: "female", fallback: ["neutralFemale", "female", "default"] },

  "老人": { family: "elder", gender: "male", fallback: ["elder", "male", "default"] }
};

export function normalizeDialogueTone(tone) {
  return TONE_ALIASES[tone] || tone;
}

export function getDefaultToneForCharacter(character) {
  return character?.spiritSex === "女" ? DEFAULT_FEMALE_TONE : DEFAULT_MALE_TONE;
}

export function resolveStoredSpeechType(character) {
  return character?.speechType || getDefaultToneForCharacter(character);
}

export function resolveDialogueTone(character) {
  const mindTraits = Array.isArray(character?.mindTraits) ? character.mindTraits : [];
  const spiritSex = character?.spiritSex || character?.bodySex || "男";

  if (mindTraits.includes("無垢")) return "赤子";
  if (mindTraits.includes("萌芽")) return spiritSex === "女" ? "女児" : "男児";

  return normalizeDialogueTone(character?.speechType) || (spiritSex === "女" ? DEFAULT_FEMALE_TONE : DEFAULT_MALE_TONE);
}

export function getToneLookupKeys(tone, character = null) {
  const normalizedTone = normalizeDialogueTone(tone);
  const profile = TONE_PROFILES[normalizedTone] || TONE_PROFILES[tone];
  const defaultTone = getDefaultToneForCharacter(character);
  const defaultProfile = TONE_PROFILES[defaultTone];
  const fallbackWithoutDefault = (keys = []) => keys.filter(key => key !== "default");
  return uniqueKeys([
    normalizedTone,
    tone,
    profile?.family,
    ...fallbackWithoutDefault(profile?.fallback),
    defaultTone,
    defaultProfile?.family,
    ...fallbackWithoutDefault(defaultProfile?.fallback),
    "default"
  ]);
}

export function isChildlikeDialogueTone(tone) {
  const normalizedTone = normalizeDialogueTone(tone);
  return normalizedTone === "赤子" || normalizedTone === "男児" || normalizedTone === "女児";
}

export function uniqueKeys(keys) {
  return [...new Set(keys.filter(Boolean))];
}
