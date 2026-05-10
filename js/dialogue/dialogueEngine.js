import {
  getDefaultToneForCharacter,
  isChildlikeDialogueTone,
  resolveDialogueTone,
  resolveStoredSpeechType,
  uniqueKeys
} from "../data/dialogue/toneProfiles.js";
import { CHILDLIKE_STATUS_LINES, LAZY_LINES, STATUS_LINES } from "../data/dialogue/statusLines.js";
import { SEASONAL_LINES } from "../data/dialogue/seasonLines.js";
import { VISITOR_GENERIC_LINES, VISITOR_LINES } from "../data/dialogue/visitorLines.js";
import {
  BUDDING_EVENT_LINES,
  EVENT_LINES_BY_SPEECH_TYPE,
  INFANT_EVENT_LINES,
  SPEECH_TYPE_LINE_FALLBACKS,
  SPEECH_TYPE_TONES,
  createRandomEventFallbackLines,
  expandEventVillagerLines,
  findLineByKeys
} from "../data/dialogue/randomEventLines.js";

export { resolveDialogueTone, resolveStoredSpeechType } from "../data/dialogue/toneProfiles.js";

export function pickDialogueLine(value, context = {}) {
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return pickDialogueLine(value[Math.floor(Math.random() * value.length)], context);
  }
  if (typeof value === "function") return value(context);
  return value || null;
}

function asLineArray(value, context = {}) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => pickDialogueLine(item, context)).filter(Boolean);
  const line = pickDialogueLine(value, context);
  return line ? [line] : [];
}

function selectToneLines(group, character) {
  if (!group) return [];
  const tone = resolveDialogueTone(character);
  const defaultTone = getDefaultToneForCharacter(character);
  const keys = uniqueKeys([tone, defaultTone]);
  const key = keys.find(candidate => group[candidate]);
  return key ? asLineArray(group[key]) : [];
}

function getChildlikeStatusLines(character, status) {
  const tone = resolveDialogueTone(character);
  if (!isChildlikeDialogueTone(tone)) return [];

  if (tone === "無垢") {
    const lines = CHILDLIKE_STATUS_LINES["無垢"];
    return asLineArray(lines?.[status] || lines?.healthy);
  }

  const sexKey = tone === "女児" ? "female" : "male";
  const lines = CHILDLIKE_STATUS_LINES["萌芽"]?.[sexKey] || CHILDLIKE_STATUS_LINES["萌芽"]?.male;
  return asLineArray(lines?.[status] || lines?.healthy);
}

function getStatusLines(character, status) {
  const childLines = getChildlikeStatusLines(character, status);
  if (childLines.length > 0) return childLines;
  return selectToneLines(STATUS_LINES[status], character);
}

function getVisitorLines(visitorType) {
  return asLineArray(VISITOR_LINES[visitorType] || VISITOR_GENERIC_LINES);
}

function getRandomEventMood(eventKey, kind) {
  const mood = kind === "mythic" ? "mythic" : kind === "good" ? "happy" : "hardship";
  return eventKey ? mood : "default";
}

export function getChildlikeRandomEventLine(character, { eventKey = null, kind = null, mood = null } = {}) {
  const tone = resolveDialogueTone(character);
  if (tone === "無垢") return pickDialogueLine(INFANT_EVENT_LINES);

  if (tone === "男児" || tone === "女児") {
    const sexKey = tone === "女児" ? "female" : "male";
    const eventMood = mood || getRandomEventMood(eventKey, kind);
    const lines = BUDDING_EVENT_LINES[sexKey] || BUDDING_EVENT_LINES.male;
    return pickDialogueLine(lines[eventMood] || lines.default);
  }

  return null;
}

export function selectRandomEventLineBySpeechType(group, speechType, character) {
  if (!group) return null;
  const genderFallback = character?.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ";
  const keys = uniqueKeys([
    speechType,
    ...(SPEECH_TYPE_LINE_FALLBACKS[speechType] || []),
    genderFallback,
    ...(SPEECH_TYPE_LINE_FALLBACKS[genderFallback] || []),
    "普通Ｆ",
    "普通Ｍ",
    "female",
    "male"
  ]);
  return findLineByKeys(group, keys);
}

function getRandomEventLine(character, eventKey, { kind = null, subject = null, mood = null } = {}) {
  const childLine = getChildlikeRandomEventLine(character, { eventKey, kind, mood });
  if (childLine) return childLine;

  const speechType = resolveStoredSpeechType(character);
  const eventLine = selectRandomEventLineBySpeechType(EVENT_LINES_BY_SPEECH_TYPE[eventKey], speechType, character);
  if (eventLine) return pickDialogueLine(eventLine);

  const fallbackLines = createRandomEventFallbackLines(subject || "出来事");
  const eventMood = mood || getRandomEventMood(eventKey, kind);
  const group = fallbackLines[eventMood] || fallbackLines[kind] || fallbackLines.happy;
  const selected = selectRandomEventLineBySpeechType(expandEventVillagerLines(group), speechType, character);
  return pickDialogueLine(selected);
}

function getRandomEventSecondLine(character, eventKey, { base = null, speechType = null, kind = null, mood = null } = {}) {
  const childLine = getChildlikeRandomEventLine(character, { eventKey, kind, mood });
  if (childLine) return childLine;
  if (!base) return null;

  const resolvedSpeechType = speechType || resolveStoredSpeechType(character);
  const style = SPEECH_TYPE_TONES[resolvedSpeechType] || (character?.spiritSex === "女" ? "female" : "male");
  const isMale = character?.spiritSex !== "女";

  if (eventKey === "fight") {
    if (style === "polite") return `${base}のです。そこをどいてください。`;
    if (style === "cool") return `${base}。ここで引く気はない。`;
    if (style === "bold") return isMale ? `${base}んだよ。やるなら来い！` : `${base}わ。やるなら来なさい！`;
    if (style === "shy") return `${base}です……もう黙っていられません……`;
    if (style === "bright") return `${base}よ！ さすがに怒るからね！`;
    return isMale ? `${base}。もう黙っていられない。` : `${base}わ。もう黙っていられません。`;
  }

  if (eventKey === "drunk") {
    if (style === "polite") return `${base}ようですが、まだ席は立ちませんよ。`;
    if (style === "cool") return `${base}。だが問題はない、たぶん。`;
    if (style === "bold") return isMale ? `${base}んだよ！ もっと酒を持ってこい！` : `${base}のよ！ もっと飲ませなさい！`;
    if (style === "shy") return `${base}みたいです……えへへ、変ですね……`;
    if (style === "bright") return `${base}よ！ 今日はもっと楽しくしよう！`;
    return isMale ? `${base}。まだ飲める。` : `${base}みたいです。まだ平気です。`;
  }

  if (style === "polite") return `${base}ようです。丁寧に受け止めたいですね。`;
  if (style === "cool") return `${base}。状況を見極めよう。`;
  if (style === "bold") return isMale ? `${base}！ この勢い、無駄にしねえ！` : `${base}！ この勢い、無駄にしないわ！`;
  if (style === "shy") return `${base}みたいです……まだ少し落ち着きません……`;
  if (style === "bright") return `${base}！ なんだか胸が騒ぐね！`;
  return isMale ? `${base}な。少し様子を見よう。` : `${base}ようです。少し様子を見ましょう。`;
}

export function getDialogueLines({ character, scene, key }) {
  switch (scene) {
    case "status":
      return getStatusLines(character, key);
    case "lazy":
      return selectToneLines(LAZY_LINES, character);
    case "season":
      return selectToneLines(SEASONAL_LINES[key], character);
    case "visitor":
      return getVisitorLines(key);
    default:
      return [];
  }
}

export function getDialogueLine({ character, scene, key, context = {} }) {
  if (scene === "randomEvent") {
    return getRandomEventLine(character, key, context);
  }
  if (scene === "randomEventSecond") {
    return getRandomEventSecondLine(character, key, context);
  }
  return pickDialogueLine(getDialogueLines({ character, scene, key }), context);
}
