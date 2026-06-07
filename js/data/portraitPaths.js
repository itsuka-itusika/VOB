export const DEFAULT_PORTRAIT_KEY = "default.png";
export const BABY_MALE_PORTRAIT_KEY = "malebaby.png";
export const BABY_FEMALE_PORTRAIT_KEY = "femalebaby.png";
const LEGACY_ARACHNID_PORTRAIT_FILES = [
  "Arachnid/ChatGPT Image 2026年6月4日 01_41_09.png",
  "Arachnid/ChatGPT Image 2026年6月4日 01_41_23.png",
  "Arachnid/ChatGPT Image 2026年6月4日 01_41_50.png",
  "Arachnid/ChatGPT Image 2026年6月4日 01_44_46.png",
  "Arachnid/ChatGPT Image 2026年6月4日 01_44_58.png"
];
export const ARACHNID_PORTRAIT_FILES = Array.from({ length: 5 }, (_, index) => `ARACHNID${index + 1}.png`);

const PORTRAIT_ROOT = "images/portraits";
const CHILD_SHADOW_PORTRAIT_KEYS = new Set(["CHILD_SHADOW.svg", "CHILD_SHADOW_BABY.svg"]);
const SYSTEM_PORTRAIT_KEYS = new Set([DEFAULT_PORTRAIT_KEY, ...CHILD_SHADOW_PORTRAIT_KEYS]);
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
  ["A", 58],
  ["BB", 46],
  ["C", 74],
  ["D", 39],
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
  ["KNIGHT", 26],
  ["ELITE", 22],
  ["HOLY_KNIGHT", 8],
  ["ARACHNID", 5],
  ["ANGEL", 16],
  ["ALSEID", 13],
  ["DRYAD", 18],
  ["NEREID", 15],
  ["SAINT", 21]
]);

const TODDLER_PORTRAIT_GROUPS = new Set(["MA", "MB", "MC", "MD", "ME", "GG", "A", "BB", "C", "D"]);
const TODDLER_PORTRAIT_LIMIT = 2;

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
  ["KNIGHT", "knight"],
  ["ELITE", "elite"],
  ["HOLY_KNIGHT", "holy_knight"],
  ["ARACHNID", "arachnid"],
  ["ANGEL", "angel"],
  ["ALSEID", "alseid"],
  ["DRYAD", "dryad"],
  ["NEREID", "nereid"],
  ["SAINT", "saint"]
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
  const toddlerMatch = key.match(/^T_(MA|MB|MC|MD|ME|GG|A|BB|C|D)(\d+)\.png$/i);
  if (toddlerMatch) {
    return {
      type: "toddler",
      group: toddlerMatch[1].toUpperCase(),
      number: Number(toddlerMatch[2])
    };
  }

  const match = key.match(/^(ANGEL_FIGHTER|HOLY_KNIGHT|ARCHANGEL|MINOTAUR|CENTAUR|ARACHNID|CYCLOPS|KNIGHT|ALSEID|NEREID|DRYAD|SAINT|ELITE|HARPY|ANGEL|BAN|GOB|WOLF|GG|MA|MB|MC|MD|ME|BB|A|C|D)(\d+)\.png$/i);
  if (!match) return null;

  return {
    type: "numbered",
    group: match[1].toUpperCase(),
    number: Number(match[2])
  };
}

function isKnownPortraitKey(key) {
  if (SYSTEM_PORTRAIT_KEYS.has(key) || BABY_PORTRAIT_KEYS.has(key)) return true;

  const parts = getNumberedPortraitParts(key);
  if (!parts || !Number.isInteger(parts.number) || parts.number < 1) return false;

  if (parts.type === "toddler") {
    return TODDLER_PORTRAIT_GROUPS.has(parts.group) && parts.number <= TODDLER_PORTRAIT_LIMIT;
  }

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
  if (lowerFileName === "child_shadow.svg") return "CHILD_SHADOW.svg";
  if (lowerFileName === "child_shadow_baby.svg") return "CHILD_SHADOW_BABY.svg";

  const parts = getNumberedPortraitParts(fileName);
  if (parts?.type === "toddler") return `T_${parts.group}${parts.number}.png`;
  if (parts?.type === "numbered") return `${parts.group}${parts.number}.png`;

  return /\.(png|svg)$/i.test(fileName) ? fileName : DEFAULT_PORTRAIT_KEY;
}

export function getPortraitGroupKey(value) {
  const key = normalizePortraitKey(value);
  if (BABY_PORTRAIT_KEYS.has(key)) return "baby";
  if (SYSTEM_PORTRAIT_KEYS.has(key)) return "system";

  const parts = getNumberedPortraitParts(key);
  return parts?.group || "";
}

export function getPortraitAssetPath(value) {
  const key = normalizePortraitKey(value);
  if (!isKnownPortraitKey(key)) return `${PORTRAIT_ROOT}/system/${DEFAULT_PORTRAIT_KEY}`;

  if (BABY_PORTRAIT_KEYS.has(key)) return `${PORTRAIT_ROOT}/babies/${key}`;
  if (SYSTEM_PORTRAIT_KEYS.has(key)) return `${PORTRAIT_ROOT}/system/${key}`;

  const parts = getNumberedPortraitParts(key);
  if (parts?.type === "toddler") {
    return `${PORTRAIT_ROOT}/children/${parts.group}/${key}`;
  }

  const folder = PORTRAIT_GROUP_FOLDERS.get(parts?.group);
  if (!folder) return `${PORTRAIT_ROOT}/system/${DEFAULT_PORTRAIT_KEY}`;
  return `${PORTRAIT_ROOT}/${folder}/${key}`;
}
