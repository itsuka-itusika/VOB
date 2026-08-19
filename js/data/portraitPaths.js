export const DEFAULT_PORTRAIT_KEY = "default.png";
export const BABY_MALE_PORTRAIT_KEY = "malebaby.png";
export const BABY_FEMALE_PORTRAIT_KEY = "femalebaby.png";
export const WOLF_PUP_PORTRAIT_KEY = "WOLF_PUP.png";
export const WAR_PORTRAIT_KEY = "WAR.png";
export const ALIGNMENT_PORTRAIT_KEY = "ALIGNMENT.png";
const LEGACY_ARACHNID_PORTRAIT_FILES = [
  "Arachnid/ChatGPT Image 2026年6月4日 01_41_09.png",
  "Arachnid/ChatGPT Image 2026年6月4日 01_41_23.png",
  "Arachnid/ChatGPT Image 2026年6月4日 01_41_50.png",
  "Arachnid/ChatGPT Image 2026年6月4日 01_44_46.png",
  "Arachnid/ChatGPT Image 2026年6月4日 01_44_58.png"
];
export const ARACHNID_PORTRAIT_FILES = Array.from({ length: 5 }, (_, index) => `ARACHNID${index + 1}.png`);
export const HARPY_PORTRAIT_FILES = Array.from({ length: 12 }, (_, index) => `HARPY${index + 1}.png`);
export const CYCLOPS_PORTRAIT_FILES = Array.from({ length: 4 }, (_, index) => `CYCLOPS${index + 1}.png`);
export const WINGED_PORTRAIT_FILES = Array.from({ length: 16 }, (_, index) => `ANGEL${index + 1}.png`);
export const ALSEID_PORTRAIT_FILES = Array.from({ length: 13 }, (_, index) => `ALSEID${index + 1}.png`);
export const NEREID_PORTRAIT_FILES = Array.from({ length: 15 }, (_, index) => `NEREID${index + 1}.png`);
export const DRYAD_PORTRAIT_FILES = Array.from({ length: 18 }, (_, index) => `DRYAD${index + 1}.png`);
export const INQUISITOR_PORTRAIT_FILES = Array.from({ length: 11 }, (_, index) => `INQUISITOR${index + 1}.png`);
export const EQUINA_PORTRAIT_FILES = Array.from({ length: 18 }, (_, index) => `EQUINA${index + 1}.png`);
export const CENTAUR_PORTRAIT_FILES = Array.from({ length: 9 }, (_, index) => `CENTAUR${index + 1}.png`);
export const SATYR_PORTRAIT_FILES = Array.from({ length: 12 }, (_, index) => `SATYR${index + 1}.png`);
export const MAENAD_PORTRAIT_FILES = Array.from({ length: 16 }, (_, index) => `MAENAD${index + 1}.png`);
export const GOBLIN_PORTRAIT_FILES = Array.from({ length: 13 }, (_, index) => `GOB${index + 1}.png`);

const PORTRAIT_ROOT = "images/portraits";
const CHILD_SHADOW_PORTRAIT_KEYS = new Set(["CHILD_SHADOW.svg", "CHILD_SHADOW_BABY.svg"]);
const SYSTEM_PORTRAIT_KEYS = new Set([
  DEFAULT_PORTRAIT_KEY,
  WAR_PORTRAIT_KEY,
  ALIGNMENT_PORTRAIT_KEY,
  ...CHILD_SHADOW_PORTRAIT_KEYS
]);
const BABY_PORTRAIT_KEYS = new Set([BABY_MALE_PORTRAIT_KEY, BABY_FEMALE_PORTRAIT_KEY]);
const LEGACY_ARACHNID_PORTRAIT_KEY_MAP = new Map();
LEGACY_ARACHNID_PORTRAIT_FILES.forEach((key, index) => {
  const normalizedKey = ARACHNID_PORTRAIT_FILES[index];
  const fileName = key.split("/").pop();
  LEGACY_ARACHNID_PORTRAIT_KEY_MAP.set(key, normalizedKey);
  LEGACY_ARACHNID_PORTRAIT_KEY_MAP.set(fileName, normalizedKey);
});

const NUMBERED_PORTRAIT_LIMITS = new Map([
  ["MA", 16],
  ["MB", 24],
  ["MC", 55],
  ["MD", 30],
  ["ME", 22],
  ["A", 32],
  ["BB", 29],
  ["C", 33],
  ["D", 62],
  ["GG", 28],
  ["BAN", 21],
  ["GOB", 13],
  ["HARPY", 12],
  ["WOLF", 6],
  ["CYCLOPS", 4],
  ["ANGEL_FIGHTER", 16],
  ["ARCHANGEL", 13],
  ["CENTAUR", 9],
  ["MINOTAUR", 4],
  ["NOMAD", 20],
  ["KNIGHT", 26],
  ["ELITE_NOMAD", 20],
  ["ARMORED", 8],
  ["ELITE", 22],
  ["HOLY_KNIGHT", 8],
  ["INQUISITOR", 11],
  ["ARACHNID", 5],
  ["ANGEL", 16],
  ["ALSEID", 13],
  ["DRYAD", 18],
  ["EQUINA", 18],
  ["SATYR", 12],
  ["MAENAD", 16],
  ["NEREID", 15],
  ["SAINT", 21],
  ["SPHINX_M", 6],
  ["SPHINX_F", 7]
]);

const AGE_VARIANT_PORTRAIT_LIMITS = {
  old: new Map([
    ["MA", 16], ["MB", 24], ["MC", 55], ["MD", 30], ["ME", 22],
    ["A", 32], ["BB", 29], ["C", 33], ["D", 62],
    ["BAN", 21], ["NOMAD", 20], ["KNIGHT", 26], ["ELITE_NOMAD", 20],
    ["ELITE", 22], ["HOLY_KNIGHT", 8], ["EQUINA", 18], ["SAINT", 21]
  ]),
  young: new Map([
    ["MA", 16], ["MB", 24], ["MC", 55], ["MD", 30], ["ME", 22],
    ["A", 32], ["BB", 29], ["C", 33], ["D", 62], ["EQUINA", 18]
  ])
};

const PORTRAIT_GROUP_FOLDERS = new Map([
  ["MA", "MA"],
  ["MB", "MB"],
  ["MC", "MC"],
  ["MD", "MD"],
  ["ME", "ME"],
  ["A", "A"],
  ["BB", "BB"],
  ["C", "C"],
  ["D", "D"],
  ["GG", "GG"],
  ["BAN", "bandit"],
  ["GOB", "goblin"],
  ["HARPY", "harpy"],
  ["WOLF", "wolf"],
  ["CYCLOPS", "cyclops"],
  ["ANGEL_FIGHTER", "angel_fighter"],
  ["ARCHANGEL", "archangel"],
  ["CENTAUR", "centaur"],
  ["MINOTAUR", "minotaur"],
  ["NOMAD", "nomad"],
  ["KNIGHT", "knight"],
  ["ELITE_NOMAD", "elite_nomad"],
  ["ARMORED", "armored"],
  ["ELITE", "elite"],
  ["HOLY_KNIGHT", "holy_knight"],
  ["INQUISITOR", "Inquisitor"],
  ["ARACHNID", "arachnid"],
  ["ANGEL", "angel"],
  ["ALSEID", "alseid"],
  ["DRYAD", "dryad"],
  ["EQUINA", "equina"],
  ["SATYR", "satyr"],
  ["MAENAD", "maenad"],
  ["NEREID", "nereid"],
  ["SAINT", "saint"],
  ["SPHINX_M", "sphinx_M"],
  ["SPHINX_F", "sphinx_F"]
]);

function getFileName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop() || "";
}

function getLegacyArachnidPortraitKey(value) {
  const segments = String(value ?? "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);

  const fileName = segments[segments.length - 1];
  const folder = segments.length >= 2 ? segments[segments.length - 2] : "";
  const key = folder ? `${folder}/${fileName}` : fileName;
  return LEGACY_ARACHNID_PORTRAIT_KEY_MAP.get(key) || LEGACY_ARACHNID_PORTRAIT_KEY_MAP.get(fileName) || "";
}

function getNumberedPortraitParts(key) {
  const match = key.match(/^(ANGEL_FIGHTER|HOLY_KNIGHT|ELITE_NOMAD|INQUISITOR|ARCHANGEL|SPHINX_M|SPHINX_F|MINOTAUR|CENTAUR|ARMORED|ARACHNID|CYCLOPS|KNIGHT|ALSEID|EQUINA|SATYR|MAENAD|NEREID|DRYAD|SAINT|ELITE|HARPY|ANGEL|NOMAD|BAN|GOB|WOLF|GG|MA|MB|MC|MD|ME|BB|A|C|D)(\d+)\.png$/i);
  if (!match) return null;

  return {
    type: "numbered",
    group: match[1].toUpperCase(),
    number: Number(match[2])
  };
}

export function isKnownPortraitKey(key) {
  if (SYSTEM_PORTRAIT_KEYS.has(key) || BABY_PORTRAIT_KEYS.has(key) || key === WOLF_PUP_PORTRAIT_KEY) return true;

  const parts = getNumberedPortraitParts(key);
  if (!parts || !Number.isInteger(parts.number) || parts.number < 1) return false;

  const max = NUMBERED_PORTRAIT_LIMITS.get(parts.group);
  return Number.isInteger(max) && parts.number <= max;
}

export function normalizePortraitKey(value) {
  const arachnidKey = getLegacyArachnidPortraitKey(value);
  if (arachnidKey) return arachnidKey;

  const fileName = getFileName(value);
  if (!fileName) return DEFAULT_PORTRAIT_KEY;

  const lowerFileName = fileName.toLowerCase();
  if (lowerFileName === DEFAULT_PORTRAIT_KEY) return DEFAULT_PORTRAIT_KEY;
  if (lowerFileName === BABY_MALE_PORTRAIT_KEY) return BABY_MALE_PORTRAIT_KEY;
  if (lowerFileName === BABY_FEMALE_PORTRAIT_KEY) return BABY_FEMALE_PORTRAIT_KEY;
  if (lowerFileName === "revelation.png" || lowerFileName === ALIGNMENT_PORTRAIT_KEY.toLowerCase()) {
    return ALIGNMENT_PORTRAIT_KEY;
  }
  if (lowerFileName === "child_shadow.svg") return "CHILD_SHADOW.svg";
  if (lowerFileName === "child_shadow_baby.svg") return "CHILD_SHADOW_BABY.svg";

  const legacyToddlerMatch = fileName.match(/^T_(MA|MB|MC|MD|ME|GG|A|BB|C|D)(\d+)\.png$/i);
  if (legacyToddlerMatch) {
    return `${legacyToddlerMatch[1].toUpperCase()}${Number(legacyToddlerMatch[2])}.png`;
  }

  const parts = getNumberedPortraitParts(fileName);
  if (parts?.type === "numbered") return `${parts.group}${parts.number}.png`;

  return /\.(png|svg)$/i.test(fileName) ? fileName : DEFAULT_PORTRAIT_KEY;
}

export function getPortraitGroupKey(value) {
  const key = normalizePortraitKey(value);
  if (BABY_PORTRAIT_KEYS.has(key)) return "baby";
  if (key === WOLF_PUP_PORTRAIT_KEY) return "WOLF";
  if (SYSTEM_PORTRAIT_KEYS.has(key)) return "system";

  const parts = getNumberedPortraitParts(key);
  return parts?.group || "";
}

export function getPortraitAssetPath(value) {
  const key = normalizePortraitKey(value);
  if (!isKnownPortraitKey(key)) return `${PORTRAIT_ROOT}/system/${DEFAULT_PORTRAIT_KEY}`;

  if (BABY_PORTRAIT_KEYS.has(key)) return `${PORTRAIT_ROOT}/babies/${key}`;
  if (key === WOLF_PUP_PORTRAIT_KEY) return `${PORTRAIT_ROOT}/wolf/${key}`;
  if (SYSTEM_PORTRAIT_KEYS.has(key)) return `${PORTRAIT_ROOT}/system/${key}`;

  const parts = getNumberedPortraitParts(key);
  const folder = PORTRAIT_GROUP_FOLDERS.get(parts?.group);
  if (!folder) return `${PORTRAIT_ROOT}/system/${DEFAULT_PORTRAIT_KEY}`;
  return `${PORTRAIT_ROOT}/${folder}/${key}`;
}

function getBodyAgePortraitVariant(character) {
  const bodyTraits = Array.isArray(character?.bodyTraits) ? character.bodyTraits : [];
  if (bodyTraits.includes("赤子")) return "";
  if (bodyTraits.includes("老人")) return "old";
  if (bodyTraits.includes("幼児")) return "young";
  return "";
}

function selectFallbackPortraitKey(group, limit) {
  const number = Math.floor(Math.random() * limit) + 1;
  return `${group}${number}.png`;
}

function replaceCharacterPortraitKey(character, field, key) {
  if (!character || typeof character !== "object") return;
  character[field] = key;
}

export function getPortraitAssetPathForCharacter(character) {
  const variant = getBodyAgePortraitVariant(character);
  let portraitField = variant === "young" && character?.adultPortraitFile
    ? "adultPortraitFile"
    : "portraitFile";
  let key = normalizePortraitKey(character?.[portraitField]);
  let parts = getNumberedPortraitParts(key);

  if (parts?.type !== "numbered") return getPortraitAssetPath(key);

  const baseLimit = NUMBERED_PORTRAIT_LIMITS.get(parts.group);
  if (!isKnownPortraitKey(key) && Number.isInteger(baseLimit) && baseLimit > 0) {
    key = selectFallbackPortraitKey(parts.group, baseLimit);
    replaceCharacterPortraitKey(character, portraitField, key);
    parts = getNumberedPortraitParts(key);
  }

  const variantLimit = variant ? AGE_VARIANT_PORTRAIT_LIMITS[variant]?.get(parts.group) : null;
  if (!Number.isInteger(variantLimit) || variantLimit <= 0) {
    return getPortraitAssetPath(key);
  }

  if (parts.number > variantLimit) {
    key = selectFallbackPortraitKey(parts.group, variantLimit);
    replaceCharacterPortraitKey(character, portraitField, key);
    parts = getNumberedPortraitParts(key);
  }

  const folder = PORTRAIT_GROUP_FOLDERS.get(parts.group);
  if (!folder) return getPortraitAssetPath(key);
  const variantFile = key.replace(/\.png$/i, `_${variant}.png`);
  return `${PORTRAIT_ROOT}/${folder}/${variant}/${variantFile}`;
}
