export const DEFAULT_PORTRAIT_KEY = "default.png";
export const BABY_MALE_PORTRAIT_KEY = "malebaby.png";
export const BABY_FEMALE_PORTRAIT_KEY = "femalebaby.png";

const PORTRAIT_ROOT = "images/portraits";
const CHILD_SHADOW_PORTRAIT_KEYS = new Set(["CHILD_SHADOW.svg", "CHILD_SHADOW_BABY.svg"]);
const SYSTEM_PORTRAIT_KEYS = new Set([DEFAULT_PORTRAIT_KEY, ...CHILD_SHADOW_PORTRAIT_KEYS]);
const BABY_PORTRAIT_KEYS = new Set([BABY_MALE_PORTRAIT_KEY, BABY_FEMALE_PORTRAIT_KEY]);

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
  ["ANGEL", 16],
  ["ALSEID", 13],
  ["DRYAD", 18],
  ["NEREID", 15],
  ["SAINT", 9]
]);

const TODDLER_PORTRAIT_GROUPS = new Set(["MA", "MB", "MC", "MD", "ME", "GG", "A", "BB", "C", "D"]);
const TODDLER_PORTRAIT_LIMIT = 2;

const PORTRAIT_ROUTES = [
  { pattern: /^CYCLOPS\d+\.png$/, path: `${PORTRAIT_ROOT}/raiders/cyclops` },
  { pattern: /^T_(MA|MB|MC|MD|ME|GG|A|BB|C|D)\d+\.png$/, path: `${PORTRAIT_ROOT}/children`, groupFromKey: true },
  { pattern: /^MA\d+\.png$/, path: `${PORTRAIT_ROOT}/villagers/male/MA` },
  { pattern: /^MB\d+\.png$/, path: `${PORTRAIT_ROOT}/villagers/male/MB` },
  { pattern: /^MC\d+\.png$/, path: `${PORTRAIT_ROOT}/villagers/male/MC` },
  { pattern: /^MD\d+\.png$/, path: `${PORTRAIT_ROOT}/villagers/male/MD` },
  { pattern: /^ME\d+\.png$/, path: `${PORTRAIT_ROOT}/villagers/male/ME` },
  { pattern: /^BB\d+\.png$/, path: `${PORTRAIT_ROOT}/villagers/female/BB` },
  { pattern: /^A\d+\.png$/, path: `${PORTRAIT_ROOT}/villagers/female/A` },
  { pattern: /^C\d+\.png$/, path: `${PORTRAIT_ROOT}/villagers/female/C` },
  { pattern: /^D\d+\.png$/, path: `${PORTRAIT_ROOT}/villagers/female/D` },
  { pattern: /^GG\d+\.png$/, path: `${PORTRAIT_ROOT}/villagers/outcast/GG` },
  { pattern: /^BAN\d+\.png$/, path: `${PORTRAIT_ROOT}/raiders/bandit` },
  { pattern: /^GOB\d+\.png$/, path: `${PORTRAIT_ROOT}/raiders/goblin` },
  { pattern: /^HARPY\d+\.png$/, path: `${PORTRAIT_ROOT}/raiders/harpy` },
  { pattern: /^WOLF\d+\.png$/, path: `${PORTRAIT_ROOT}/raiders/wolf` },
  { pattern: /^ANGEL_FIGHTER\d+\.png$/, path: `${PORTRAIT_ROOT}/angel_fighter` },
  { pattern: /^ARCHANGEL\d+\.png$/, path: `${PORTRAIT_ROOT}/archangel` },
  { pattern: /^ANGEL\d+\.png$/, path: `${PORTRAIT_ROOT}/angel` },
  { pattern: /^ALSEID\d+\.png$/, path: `${PORTRAIT_ROOT}/alseid` },
  { pattern: /^DRYAD\d+\.png$/, path: `${PORTRAIT_ROOT}/dryad` },
  { pattern: /^NEREID\d+\.png$/, path: `${PORTRAIT_ROOT}/nereid` },
  { pattern: /^SAINT\d+\.png$/, path: `${PORTRAIT_ROOT}/saint` }
];

function getFileName(value) {
  return String(value ?? "")
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop() || "";
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

  const match = key.match(/^(ANGEL_FIGHTER|ARCHANGEL|CYCLOPS|HARPY|ALSEID|NEREID|DRYAD|SAINT|ANGEL|BAN|GOB|WOLF|GG|MA|MB|MC|MD|ME|BB|A|C|D)(\d+)\.png$/i);
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

  const route = PORTRAIT_ROUTES.find(item => item.pattern.test(key));
  if (!route) return `${PORTRAIT_ROOT}/system/${DEFAULT_PORTRAIT_KEY}`;

  const childGroup = route.groupFromKey ? `/${getPortraitGroupKey(key)}` : "";
  return `${route.path}${childGroup}/${key}`;
}
