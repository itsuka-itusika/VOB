import {
  getToneLookupKeys,
  getSpecialDialogueToneFallbackLines,
  getSpecialToneLookupKeys,
  isChildlikeDialogueTone,
  isSpecialDialogueTone,
  normalizeDialogueTone,
  resolveDialogueTone,
  resolveStoredSpeechType,
  uniqueKeys
} from "../data/dialogue/toneProfiles.js";
import { LAZY_LINES, STATUS_LINES } from "../data/dialogue/statusLines.js";
import { SEASONAL_LINES } from "../data/dialogue/seasonLines.js";
import { CONDITION_LINES } from "../data/dialogue/conditionLines.js";
import { JOB_LINES } from "../data/dialogue/jobLines.js";
import { REPRODUCTION_LINES } from "../data/dialogue/reproductionLines.js";
import { EXCHANGE_SITUATION_LINES } from "../data/dialogue/exchangeSituationLines.js";
import { SECRET_TREASURE_LINES } from "../data/dialogue/secretTreasureLines.js";
import { getVisitorLineKey, VISITOR_GENERIC_LINES, VISITOR_LINES } from "../data/dialogue/visitorLines.js";
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
import { BODY_EXCHANGE_SOURCE_RACE_LINE_KEYS } from "../data/dialogue/exchangeLines.js";

export { resolveDialogueTone, resolveStoredSpeechType } from "../data/dialogue/toneProfiles.js";

export const CONVERSATION_PRIORITY = {
  NORMAL: 1,
  SEVERE: 2,
  EMERGENCY: 3,
  CRITICAL: 4
};

const SEASON_TRAITS = ["春", "夏", "秋", "冬"];
const NON_HUMANOID_EXCHANGE_RACES = new Set(["狼", "スフィンクス"]);

const BODY_CONDITION_CANDIDATES = [
  { trait: "危篤", scene: "condition", key: "critical", priority: CONVERSATION_PRIORITY.CRITICAL },
  { trait: "負傷", scene: "condition", key: "injured", priority: CONVERSATION_PRIORITY.SEVERE },
  { trait: "疫病", scene: "condition", key: "epidemic", priority: CONVERSATION_PRIORITY.SEVERE },
  { trait: "病気", scene: "condition", key: "sickness", priority: CONVERSATION_PRIORITY.SEVERE },
  { trait: "過労", scene: "condition", key: "overwork", priority: CONVERSATION_PRIORITY.SEVERE },
  { trait: "産褥", scene: "reproduction", key: "postpartumConversation", priority: CONVERSATION_PRIORITY.NORMAL },
  { trait: "飢餓", scene: "condition", key: "hunger", priority: CONVERSATION_PRIORITY.SEVERE },
  { trait: "凍え", scene: "condition", key: "cold", priority: CONVERSATION_PRIORITY.SEVERE },
  { trait: "疲労", scene: "status", key: "tired", priority: CONVERSATION_PRIORITY.NORMAL }
];

const MIND_CONDITION_CANDIDATES = [
  { trait: "抑鬱", scene: "condition", key: "depression", priority: CONVERSATION_PRIORITY.SEVERE },
  { trait: "狂乱", scene: "condition", key: "madness", priority: CONVERSATION_PRIORITY.EMERGENCY },
  { trait: "心労", scene: "condition", key: "mentalStress", priority: CONVERSATION_PRIORITY.NORMAL }
];

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

function selectToneLines(group, character, context = {}) {
  if (!group) return [];
  const tone = resolveDialogueTone(character);
  if (isSpecialDialogueTone(tone)) {
    const keys = getSpecialToneLookupKeys(tone);
    const key = keys.find(candidate => group[candidate]);
    return key
      ? asLineArray(group[key], context)
      : asLineArray(getSpecialDialogueToneFallbackLines(tone), context);
  }
  const keys = getToneLookupKeys(tone, character);
  const key = keys.find(candidate => group[candidate]);
  return key ? asLineArray(group[key], context) : [];
}

function getStatusLines(character, status, context = {}) {
  return selectToneLines(STATUS_LINES[status], character, context);
}

function getVisitorLines(visitorType) {
  return asLineArray(VISITOR_LINES[visitorType] || VISITOR_GENERIC_LINES);
}

function getRandomEventMood(eventKey, kind) {
  const mood = kind === "mythic" ? "mythic" : kind === "good" ? "happy" : "hardship";
  return eventKey ? mood : "default";
}

export function getChildlikeRandomEventLine(character, { eventKey = null, kind = null, mood = null } = {}) {
  const tone = normalizeDialogueTone(resolveDialogueTone(character));
  if (eventKey && isChildlikeDialogueTone(tone)) {
    const eventLine = findLineByKeys(EVENT_LINES_BY_SPEECH_TYPE[eventKey], getToneLookupKeys(tone, character));
    if (eventLine) return pickDialogueLine(eventLine);
  }

  if (tone === "赤子") return pickDialogueLine(INFANT_EVENT_LINES);

  if (tone === "男児" || tone === "女児") {
    const sexKey = tone === "女児" ? "female" : "male";
    const eventMood = mood || getRandomEventMood(eventKey, kind);
    const lines = BUDDING_EVENT_LINES[sexKey] || BUDDING_EVENT_LINES.male;
    return pickDialogueLine(lines[eventMood] || lines.default);
  }

  return null;
}

export function selectRandomEventLineBySpeechType(group, speechType, character, options = {}) {
  if (!group) return null;
  const extraKeys = Array.isArray(options.extraKeys) ? options.extraKeys : [];
  if (isSpecialDialogueTone(speechType)) {
    const keys = getSpecialToneLookupKeys(speechType);
    return findLineByKeys(group, keys) || getSpecialDialogueToneFallbackLines(speechType);
  }

  const genderFallback = character?.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ";
  const keys = uniqueKeys([
    ...extraKeys,
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
  const isBodyExchangeEvent = eventKey === "lightning2";
  if (!isBodyExchangeEvent) {
    const childLine = getChildlikeRandomEventLine(character, { eventKey, kind, mood });
    if (childLine) return childLine;
  }

  const speechType = isBodyExchangeEvent ? resolveDialogueTone(character) : resolveStoredSpeechType(character);
  const sourceRace = character?.lastBodyExchangeSourceRace;
  const sourceRaceLineKey = sourceRace && sourceRace !== character?.race
    ? BODY_EXCHANGE_SOURCE_RACE_LINE_KEYS[sourceRace]
    : null;
  const eventLine = selectRandomEventLineBySpeechType(EVENT_LINES_BY_SPEECH_TYPE[eventKey], speechType, character, {
    extraKeys: isBodyExchangeEvent && !isChildlikeDialogueTone(speechType) ? [sourceRaceLineKey] : []
  });
  if (eventLine) return pickDialogueLine(eventLine);

  if (isBodyExchangeEvent) {
    const childLine = getChildlikeRandomEventLine(character, { eventKey, kind, mood });
    if (childLine) return childLine;
  }

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
  if (isSpecialDialogueTone(resolvedSpeechType)) {
    return pickDialogueLine(getSpecialDialogueToneFallbackLines(resolvedSpeechType));
  }
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

export function getDialogueLines({ character, scene, key, context = {} }) {
  switch (scene) {
    case "status":
      return getStatusLines(character, key, context);
    case "lazy":
      return selectToneLines(LAZY_LINES, character, context);
    case "season":
      return selectToneLines(SEASONAL_LINES[key], character, context);
    case "condition":
      return selectToneLines(CONDITION_LINES[key], character, context);
    case "job":
      return selectToneLines(JOB_LINES[key], character, context);
    case "reproduction":
      return selectToneLines(REPRODUCTION_LINES[key], character, context);
    case "exchangeSituation":
      return selectToneLines(EXCHANGE_SITUATION_LINES[key], character, context);
    case "secretTreasure":
      return selectToneLines(SECRET_TREASURE_LINES[key], character, context);
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
  return pickDialogueLine(getDialogueLines({ character, scene, key, context }), context);
}

function hasTrait(character, trait, property) {
  return Array.isArray(character?.[property]) && character[property].includes(trait);
}

function addCandidate(candidates, character, candidate, context) {
  const id = `${candidate.scene}:${candidate.key}`;
  if (candidates.some(existing => `${existing.scene}:${existing.key}` === id)) return;
  if (getDialogueLines({ character, scene: candidate.scene, key: candidate.key, context }).length === 0) return;
  candidates.push(candidate);
}

function getStatOrDefault(value, defaultValue) {
  const number = Number(value);
  return Number.isFinite(number) ? number : defaultValue;
}

function getHealthStatus(character) {
  const hp = getStatOrDefault(character?.hp, 100);
  const mp = getStatOrDefault(character?.mp, 100);
  if (hp <= 33 || mp <= 33) return { key: "exhausted", priority: CONVERSATION_PRIORITY.SEVERE };
  if ((hp > 33 && hp <= 59) || (mp > 33 && mp <= 59)) return { key: "tired", priority: CONVERSATION_PRIORITY.NORMAL };
  return { key: "healthy", priority: CONVERSATION_PRIORITY.NORMAL };
}

function getCurrentSeason(village) {
  const traits = Array.isArray(village?.villageTraits) ? village.villageTraits : [];
  return SEASON_TRAITS.find(trait => traits.includes(trait)) || "";
}

function hasDifferentBodyOwner(character) {
  const name = String(character?.name || "").trim();
  const bodyOwner = String(character?.bodyOwner || "").trim();
  return name !== "" && bodyOwner !== "" && name !== bodyOwner;
}

function isHumanoidExchangeBody(character) {
  return !NON_HUMANOID_EXCHANGE_RACES.has(character?.race || "人間");
}

function getAbsoluteMonth(year, month) {
  const normalizedYear = Number(year);
  const normalizedMonth = Number(month);
  if (!Number.isFinite(normalizedYear) || !Number.isFinite(normalizedMonth)) return null;
  return normalizedYear * 12 + normalizedMonth - 1;
}

function hasRecentBodyExchange(character, village) {
  const currentMonth = getAbsoluteMonth(village?.year, village?.month);
  if (currentMonth === null || !Array.isArray(village?.historyEvents)) return false;
  return village.historyEvents.some(event => {
    if (event?.type !== "bodyExchange" || !Array.isArray(event.people) || !event.people.includes(character?.name)) return false;
    const eventMonth = getAbsoluteMonth(event.year, event.month);
    if (eventMonth === null) return false;
    const elapsedMonths = currentMonth - eventMonth;
    return elapsedMonths >= 0 && elapsedMonths <= 6;
  });
}

function hasExchangeSituationLines(character, key) {
  const tone = resolveDialogueTone(character);
  return Array.isArray(EXCHANGE_SITUATION_LINES[key]?.[tone]) && EXCHANGE_SITUATION_LINES[key][tone].length > 0;
}

export function getExchangeSituationKey(character, village) {
  if (!hasDifferentBodyOwner(character)) return "";

  const tone = resolveDialogueTone(character);
  const bodyAge = Number(character?.bodyAge);
  const spiritAge = Number(character?.spiritAge);
  const isYoungAdultBody = bodyAge >= 16 && bodyAge <= 30;
  const isHumanoidBody = isHumanoidExchangeBody(character);

  if (
    character?.spiritSex === "男"
    && spiritAge >= 16
    && Number(character?.sexdr) >= 18
    && character?.bodySex === "女"
    && isYoungAdultBody
    && isHumanoidBody
    && hasExchangeSituationLines(character, "roleBenefit")
  ) return "roleBenefit";

  if (tone === "老人" && character?.bodySex === "女" && isYoungAdultBody && isHumanoidBody) return "rejuvenatedFemale";
  if (tone === "老人" && character?.bodySex === "男" && isYoungAdultBody && isHumanoidBody) return "rejuvenatedMale";
  if (bodyAge <= 9) return "youngChildBody";
  if (tone !== "狼" && character?.race === "狼") return "wolfBody";

  if (
    character?.spiritSex === "女"
    && spiritAge >= 16
    && character?.bodySex === "男"
    && Number(character?.str) >= 20
    && hasExchangeSituationLines(character, "strongMaleBody")
  ) return "strongMaleBody";

  return hasRecentBodyExchange(character, village) ? "discomfort" : "";
}

function getVisitorType(visitor) {
  return getVisitorLineKey(visitor, VISITOR_LINES);
}

export function collectConversationCandidates({ character, village, context = {} }) {
  const candidates = [];
  const villageTraits = Array.isArray(village?.villageTraits) ? village.villageTraits : [];
  const sharedContext = {
    ...context,
    bodyTraits: Array.isArray(character?.bodyTraits) ? [...character.bodyTraits] : [],
    mindTraits: Array.isArray(character?.mindTraits) ? [...character.mindTraits] : [],
    villageTraits: [...villageTraits]
  };

  if (villageTraits.includes("襲撃中")) {
    addCandidate(candidates, character, {
      scene: "status",
      key: "raid",
      priority: CONVERSATION_PRIORITY.EMERGENCY
    }, sharedContext);
  }

  BODY_CONDITION_CANDIDATES.forEach(candidate => {
    if (hasTrait(character, candidate.trait, "bodyTraits")) {
      addCandidate(candidates, character, candidate, sharedContext);
    }
  });

  MIND_CONDITION_CANDIDATES.forEach(candidate => {
    if (hasTrait(character, candidate.trait, "mindTraits")) {
      addCandidate(candidates, character, candidate, sharedContext);
    }
  });

  const healthStatus = getHealthStatus(character);
  addCandidate(candidates, character, {
    scene: "status",
    key: healthStatus.key,
    priority: healthStatus.priority
  }, sharedContext);

  const exchangeSituationKey = getExchangeSituationKey(character, village);
  if (exchangeSituationKey) {
    addCandidate(candidates, character, {
      scene: "exchangeSituation",
      key: exchangeSituationKey,
      priority: CONVERSATION_PRIORITY.NORMAL
    }, sharedContext);
  }

  if (hasTrait(character, "臨月", "bodyTraits")) {
    addCandidate(candidates, character, {
      scene: "reproduction",
      key: "fullTermConversation",
      priority: CONVERSATION_PRIORITY.NORMAL
    }, sharedContext);
  } else if (hasTrait(character, "妊娠", "bodyTraits")) {
    addCandidate(candidates, character, {
      scene: "reproduction",
      key: "pregnantConversation",
      priority: CONVERSATION_PRIORITY.NORMAL
    }, sharedContext);
  }

  // 低勤勉の会話は、行動への抵抗感として成立する精神年齢からだけ候補にする。
  // 子供系口調が混入した場合は LAZY_LINES 側の通常fallbackで受ける。
  if (Number(character?.ind) <= 10 && Number(character?.spiritAge) >= 10) {
    addCandidate(candidates, character, {
      scene: "lazy",
      key: "lowDiligence",
      priority: CONVERSATION_PRIORITY.NORMAL
    }, sharedContext);
  }

  const jobKey = String(character?.preferredAction || character?.job || "").trim();
  if (JOB_LINES[jobKey]) {
    addCandidate(candidates, character, {
      scene: "job",
      key: jobKey,
      priority: CONVERSATION_PRIORITY.NORMAL
    }, sharedContext);
  }

  const season = getCurrentSeason(village);
  if (season) {
    addCandidate(candidates, character, {
      scene: "season",
      key: season,
      priority: CONVERSATION_PRIORITY.NORMAL
    }, sharedContext);
  }

  return candidates;
}

export function selectConversationCandidate(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const maxPriority = Math.max(...candidates.map(candidate => candidate.priority));
  const topCandidates = candidates.filter(candidate => candidate.priority === maxPriority);
  return topCandidates[Math.floor(Math.random() * topCandidates.length)] || null;
}

export function getConversationLine({ character, village, context = {} }) {
  if (hasTrait(character, "訪問者", "mindTraits")) {
    return getDialogueLine({ character, scene: "visitor", key: getVisitorType(character), context }) || "...";
  }

  if (hasTrait(character, "襲撃者", "mindTraits") && Array.isArray(character?.raiderDialogues) && character.raiderDialogues.length > 0) {
    return pickDialogueLine(character.raiderDialogues, context) || "...";
  }

  const candidates = collectConversationCandidates({ character, village, context });
  const selected = selectConversationCandidate(candidates);
  if (!selected) return "...";
  return getDialogueLine({ character, scene: selected.scene, key: selected.key, context }) || "...";
}
