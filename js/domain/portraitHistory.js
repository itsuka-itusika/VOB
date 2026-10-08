import { DEFAULT_PORTRAIT_KEY, normalizePortraitKey } from "../data/portraitPaths.js";

function normalizeText(value) {
  return String(value || "").trim();
}

export function isOriginalBodyOwner(personName, bodyOwner) {
  const name = normalizeText(personName);
  const owner = normalizeText(bodyOwner);
  if (!name || !owner) return false;
  return owner === name || name.endsWith(`の${owner}`);
}

export function isOriginalBodyPortrait(person) {
  if (person?.id != null && person?.bodyOwnerId != null) {
    return person.bodyOwnerId === person.id;
  }
  return isOriginalBodyOwner(person?.name, person?.bodyOwner);
}

// 同じ顔番号でも、肉体が幼児や老人なら絵が変わる。肖像を残すときは当時の年頃も控える。
const PORTRAIT_AGE_TRAITS = ["幼児", "老人"];

function normalizePortraitHistoryEntry(entry) {
  const rawFile = typeof entry === "string" ? entry : entry?.portraitFile;
  const portraitFile = normalizePortraitKey(rawFile || DEFAULT_PORTRAIT_KEY);
  if (!portraitFile || portraitFile === DEFAULT_PORTRAIT_KEY) return null;
  const normalized = {
    portraitFile,
    source: typeof entry === "string" ? "" : String(entry?.source || ""),
    caption: typeof entry === "string" ? "" : String(entry?.caption || "")
  };
  if (typeof entry?.isOriginalBody === "boolean") {
    normalized.isOriginalBody = entry.isOriginalBody;
  }
  if (normalizeText(entry?.bodyOwner)) {
    normalized.bodyOwner = normalizeText(entry.bodyOwner);
  }
  const ageTraits = Array.isArray(entry?.bodyTraits)
    ? entry.bodyTraits.filter(trait => PORTRAIT_AGE_TRAITS.includes(trait))
    : [];
  if (ageTraits.length > 0) normalized.bodyTraits = ageTraits;
  return normalized;
}

export function normalizePastPortraitFiles(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map(normalizePortraitHistoryEntry)
    .filter(Boolean);
}

export function getPastPortraitFiles(person) {
  return normalizePastPortraitFiles(person?.pastPortraitFiles);
}

export function rememberCurrentPortrait(person, source = "", options = {}) {
  if (!person) return;
  const current = normalizePortraitHistoryEntry({
    portraitFile: person.portraitFile,
    source,
    caption: options.caption || "",
    isOriginalBody: typeof options.isOriginalBody === "boolean" ? options.isOriginalBody : undefined,
    bodyOwner: options.bodyOwner || person.bodyOwner || "",
    bodyTraits: person.bodyTraits
  });
  if (!current) return;

  const history = normalizePastPortraitFiles(person.pastPortraitFiles);
  const last = history[history.length - 1];
  if (!last || last.portraitFile !== current.portraitFile) {
    history.push(current);
  }
  person.pastPortraitFiles = history;
}
