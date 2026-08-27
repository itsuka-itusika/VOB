import { applyPortraitToElement, getPortraitSpriteHtml } from "./data/portraitAtlas.js";
import { getPastPortraitFiles, isOriginalBodyOwner } from "./domain/portraitHistory.js";
import { DEFAULT_PORTRAIT_KEY, isKnownPortraitKey, normalizePortraitKey } from "./data/portraitPaths.js";
import { getPersonTitles } from "./titles.js";
import { SPEECH_TYPE_MAPPING } from "./data/villagerData.js";
import { showDictionaryEntry } from "./dictionary.js";
import { combinedDictionaryData } from "./data/dictionaryData.js";
import { getRelationshipEntries } from "./relationships.js";

export const HISTORY_EVENT_TYPES = Object.freeze({
  ARCHIVE_GAP: "archiveGap",
  FOUNDING: "founding",
  SCALE_TITLE: "scaleTitle",
  HEADMAN_ELECTION: "headmanElection",
  VILLAGER_JOIN: "villagerJoin",
  VILLAGER_LEAVE: "villagerLeave",
  VILLAGER_DEATH: "villagerDeath",
  MARRIAGE: "marriage",
  BIRTH: "birth",
  BODY_EXCHANGE: "bodyExchange",
  DRYAD_FRUIT: "dryadFruit",
  MYTHIC_EVENT: "mythicEvent",
  LOVER: "lover",
  SOCIAL_RELATION: "socialRelation",
  HOBBY_AWAKENING: "hobbyAwakening",
  PREGNANCY: "pregnancy",
  ADULTHOOD: "adulthood",
  CRITICAL: "critical",
  EPIDEMIC: "epidemic",
  APOCALYPSE: "apocalypse"
});

const HISTORY_TYPE_LABELS = Object.freeze({
  [HISTORY_EVENT_TYPES.ARCHIVE_GAP]: "記録欠落",
  [HISTORY_EVENT_TYPES.FOUNDING]: "開村",
  [HISTORY_EVENT_TYPES.SCALE_TITLE]: "村の発展",
  [HISTORY_EVENT_TYPES.HEADMAN_ELECTION]: "里長選挙",
  [HISTORY_EVENT_TYPES.VILLAGER_JOIN]: "加入",
  [HISTORY_EVENT_TYPES.VILLAGER_LEAVE]: "離村",
  [HISTORY_EVENT_TYPES.VILLAGER_DEATH]: "死別",
  [HISTORY_EVENT_TYPES.MARRIAGE]: "婚姻",
  [HISTORY_EVENT_TYPES.BIRTH]: "出生",
  [HISTORY_EVENT_TYPES.BODY_EXCHANGE]: "肉体交換",
  [HISTORY_EVENT_TYPES.DRYAD_FRUIT]: "ドライアド化",
  [HISTORY_EVENT_TYPES.MYTHIC_EVENT]: "怪異",
  [HISTORY_EVENT_TYPES.LOVER]: "恋人",
  [HISTORY_EVENT_TYPES.SOCIAL_RELATION]: "交友",
  [HISTORY_EVENT_TYPES.HOBBY_AWAKENING]: "趣味",
  [HISTORY_EVENT_TYPES.PREGNANCY]: "妊娠",
  [HISTORY_EVENT_TYPES.ADULTHOOD]: "成人",
  [HISTORY_EVENT_TYPES.CRITICAL]: "危篤",
  [HISTORY_EVENT_TYPES.EPIDEMIC]: "疫病",
  [HISTORY_EVENT_TYPES.APOCALYPSE]: "黙示録"
});

const HISTORY_SCOPES = Object.freeze({
  VILLAGE: "village",
  PERSON: "person"
});

// 成狼の記録を成人と区別するタグ。表示側もこの値で文言を切り替える。
const ADULTHOOD_WOLF_TAG = "成狼";
// 里長選挙の得票を残すタグ。「得票:名前0票、…」の形で持つ。
const ELECTION_COUNTS_TAG_PREFIX = "得票:";

// 得票のない選挙（無投票）と、同数のくじ引きを見分けるためのタグ。
const ELECTION_RESULT_TAG_PREFIX = "結果:";
const ELECTION_RESULT_NOTES = Object.freeze({
  uncontested: "候補者は1人で、無投票だった。",
  lottery: "得票が並び、くじ引きで決まった。"
});

function getElectionResultNote(event) {
  const tag = (Array.isArray(event?.tags) ? event.tags : [])
    .find(value => String(value).startsWith(ELECTION_RESULT_TAG_PREFIX));
  const result = tag ? String(tag).slice(ELECTION_RESULT_TAG_PREFIX.length) : "";
  return ELECTION_RESULT_NOTES[result] || "";
}

function getElectionCounts(event) {
  const tag = (Array.isArray(event?.tags) ? event.tags : [])
    .find(value => String(value).startsWith(ELECTION_COUNTS_TAG_PREFIX));
  return tag ? String(tag).slice(ELECTION_COUNTS_TAG_PREFIX.length) : "";
}

const MYTHIC_EVENT_TEXTS = Object.freeze({
  "狩猟神": personName => `${personName}が狩女神の祝福を受けた。`,
  "太陽神": personName => `${personName}が太陽神の寵愛を受けた。`,
  "戦女神": personName => `${personName}が戦女神の啓示を受けた。`,
  "地母神": personName => `${personName}が地母神の慈愛を受けた。`,
  goldenRain: personName => `黄金の雨が降り、${personName}に神秘の兆しが宿った。`,
  strangeGrowthPotion: personName => `怪しい薬により、${personName}の身体が急速に成長した。`,
  timeRipple: personName => `${personName}は時空のうねりに巻き込まれ、成長した姿で現れた。`
});

function ensureHistoryEvents(village) {
  if (!Array.isArray(village.historyEvents)) {
    village.historyEvents = [];
  }
  return village.historyEvents;
}

// people は表示用の名前スナップショット、peopleIds は同順の人物ID（不明は null）。
function normalizePeopleData(people, ids) {
  const names = [];
  const outIds = [];
  if (Array.isArray(people)) {
    people.forEach((person, index) => {
      const name = typeof person === "string" ? person : (person?.name || "");
      if (!name) return;
      const idFromPerson = person && typeof person === "object" && Number.isInteger(person.id) && person.id > 0
        ? person.id
        : null;
      const idFromList = Array.isArray(ids) && Number.isInteger(ids[index]) && ids[index] > 0 ? ids[index] : null;
      names.push(name);
      outIds.push(idFromPerson ?? idFromList);
    });
  }
  return { people: names, peopleIds: outIds };
}

function normalizeTags(tags) {
  return Array.isArray(tags) ? tags.filter(Boolean).map(String) : [];
}

function normalizeHistoryMonth(month) {
  const number = Number(month);
  return Number.isFinite(number) && number >= 1 && number <= 12 ? number : 1;
}

function normalizeHistoryYear(year) {
  const number = Number(year);
  return Number.isFinite(number) ? number : 0;
}

function normalizeHistoryScope(scope) {
  return scope === HISTORY_SCOPES.PERSON ? HISTORY_SCOPES.PERSON : HISTORY_SCOPES.VILLAGE;
}

function makeHistoryId(village, type, year, month) {
  const serial = String(ensureHistoryEvents(village).length + 1).padStart(4, "0");
  return `history_${year}_${String(month).padStart(2, "0")}_${type}_${serial}`;
}

export function normalizeHistoryEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.map((event, index) => {
    const year = normalizeHistoryYear(event?.year);
    const month = normalizeHistoryMonth(event?.month);
    const type = event?.type || HISTORY_EVENT_TYPES.MYTHIC_EVENT;
    return {
      id: event?.id || `history_${year}_${String(month).padStart(2, "0")}_${type}_${String(index + 1).padStart(4, "0")}`,
      year,
      month,
      type,
      title: String(event?.title || HISTORY_TYPE_LABELS[type] || "村史"),
      text: String(event?.text || ""),
      ...normalizePeopleData(event?.people, event?.peopleIds),
      importance: event?.importance || "major",
      scope: normalizeHistoryScope(event?.scope),
      tags: normalizeTags(event?.tags),
      ...(event?.dedupeKey ? { dedupeKey: String(event.dedupeKey) } : {})
    };
  });
}

export function addHistoryEvent(village, entry) {
  if (!village || !entry) return null;
  const events = ensureHistoryEvents(village);
  const dedupeKey = entry.dedupeKey ? String(entry.dedupeKey) : "";
  if (dedupeKey && events.some(event => event.dedupeKey === dedupeKey)) return null;

  const year = normalizeHistoryYear(entry.year ?? village.year);
  const month = normalizeHistoryMonth(entry.month ?? village.month);
  const type = entry.type || HISTORY_EVENT_TYPES.MYTHIC_EVENT;
  const normalized = {
    id: entry.id || makeHistoryId(village, type, year, month),
    year,
    month,
    type,
    title: String(entry.title || HISTORY_TYPE_LABELS[type] || "村史"),
    text: String(entry.text || ""),
    ...normalizePeopleData(entry.people, entry.peopleIds),
    importance: entry.importance || "major",
    scope: normalizeHistoryScope(entry.scope),
    tags: normalizeTags(entry.tags)
  };
  if (dedupeKey) normalized.dedupeKey = dedupeKey;

  events.push(normalized);
  return normalized;
}

export function recordGameStartHistory(village) {
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.FOUNDING,
    title: "古き神、開拓村に目覚める",
    text: "忘れられた豊穣神バッカスが、小さな開拓村に目覚めた。",
    tags: ["開村", "バッカス"],
    dedupeKey: "founding"
  });
}

export function createArchiveGapHistoryEvent(year, month) {
  return {
    id: `history_${normalizeHistoryYear(year)}_${String(normalizeHistoryMonth(month)).padStart(2, "0")}_archiveGap_0001`,
    year: normalizeHistoryYear(year),
    month: normalizeHistoryMonth(month),
    type: HISTORY_EVENT_TYPES.ARCHIVE_GAP,
    title: "古い村史の欠落",
    text: "古い記録は散逸し、この時より前の村史は失われている。",
    people: [],
    importance: "major",
    tags: ["記録欠落"],
    dedupeKey: "archiveGap"
  };
}

export function recordScaleTitleHistory(village, stage) {
  if (!stage) return;
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.SCALE_TITLE,
    title: `村は「${stage.title}」と呼ばれる`,
    text: `「${stage.title}」と呼ばれる規模になった。`,
    tags: ["村の発展", stage.title],
    dedupeKey: `scaleTitle:${stage.index}`
  });
}

export function recordHeadmanElectionHistory(village, winner, options = {}) {
  const countsText = String(options.counts || "").trim();
  const counts = countsText ? ` 得票は${countsText}。` : "";
  const countsTags = countsText ? [`${ELECTION_COUNTS_TAG_PREFIX}${countsText}`] : [];
  const resultTags = options.result ? [`${ELECTION_RESULT_TAG_PREFIX}${options.result}`] : [];
  if (!winner) {
    addHistoryEvent(village, {
      type: HISTORY_EVENT_TYPES.HEADMAN_ELECTION,
      title: "里長選挙、不成立",
      text: "里長選挙は不成立となった。",
      tags: ["里長選挙", ...countsTags, ...resultTags]
    });
    return;
  }

  const continued = options.result === "continued";
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.HEADMAN_ELECTION,
    title: continued ? `${winner.name}、里長を続ける` : `${winner.name}、里長に選ばれる`,
    text: continued
      ? `${winner.name}が里長を続けることになった。`
      : `${winner.name}が里長に選ばれた。${counts}`.trim(),
    people: [winner],
    tags: ["里長選挙", ...countsTags, ...resultTags]
  });
}

export function recordVillagerJoinHistory(village, person, options = {}) {
  if (!person) return;
  const recruiterName = options.recruiter?.name || "";
  const source = normalizeJoinSource(options.source);
  const text = recruiterName
    ? `${recruiterName}に${source}され、${person.name}が村に加わった。`
    : `${person.name}が村に加わった。`;
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.VILLAGER_JOIN,
    title: `${person.name}、村に加わる`,
    text,
    people: [person, options.recruiter].filter(Boolean),
    tags: ["加入", source]
  });
}

export function recordVillagerLeaveHistory(village, person, options = {}) {
  if (!person) return;
  const source = options.source || "離村";
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.VILLAGER_LEAVE,
    title: `${person.name}、村を去る`,
    text: `${person.name}が村を去った。`,
    people: [person],
    tags: ["離村", source]
  });
}

export function recordVillagerDeathHistory(village, person, options = {}) {
  if (!person) return;
  const reason = options.reason || "死亡";
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.VILLAGER_DEATH,
    title: `${person.name}、逝く`,
    text: reason === "死亡"
      ? `${person.name}が村での生を終えた。`
      : `${person.name}が${reason}により村での生を終えた。`,
    people: [person],
    tags: ["死別", reason]
  });
}

export function recordMarriageHistory(village, personA, personB, options = {}) {
  if (!personA || !personB) return;
  const source = options.source || "婚姻";
  const text = source.includes("奇跡")
    ? `奇跡の導きにより、${personA.name}と${personB.name}が夫婦となった。`
    : `${personA.name}と${personB.name}が夫婦となった。`;
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.MARRIAGE,
    title: `${personA.name}と${personB.name}、夫婦となる`,
    text,
    people: [personA, personB],
    tags: ["婚姻", source]
  });
}

export function recordLoverHistory(village, personA, personB, options = {}) {
  if (!personA || !personB) return;
  const source = options.source || "縁結び";
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.LOVER,
    title: `${personA.name}と${personB.name}、恋人となる`,
    text: `${personA.name}と${personB.name}が恋人となった。`,
    people: [personA, personB],
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: ["恋人", source]
  });
}

export function recordSocialRelationHistory(village, personA, personB, relation, options = {}) {
  if (!personA || !personB || !relation) return;
  const hobby = options.hobby || "";
  const source = options.source || "ランダムイベント";
  const relationText = relation === "趣味仲間" && hobby ? `${hobby}の趣味仲間` : relation;
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.SOCIAL_RELATION,
    title: `${personA.name}と${personB.name}、${relationText}となる`,
    text: `${personA.name}と${personB.name}が${relationText}になった。`,
    people: [personA, personB],
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: ["交友", relation, hobby, source].filter(Boolean)
  });
}

export function recordHobbyAwakeningHistory(village, person, hobby, options = {}) {
  if (!person || !hobby) return;
  const source = options.source || "ランダムイベント";
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.HOBBY_AWAKENING,
    title: `${person.name}、${hobby}に目覚める`,
    text: `${person.name}が${hobby}の趣味に目覚めた。`,
    people: [person],
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: ["趣味", hobby, source]
  });
}

export function recordPregnancyHistory(village, mother, father, options = {}) {
  if (!mother) return;
  const special = !!options.geneticFatherUnknown;
  const source = options.source || (special ? "神秘の妊娠" : "妊娠");
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.PREGNANCY,
    title: special ? `${mother.name}、神秘の子を宿す` : `${mother.name}、子を宿す`,
    text: special
      ? `${mother.name}に神秘の子が宿った。`
      : father
        ? `${mother.name}が${father.name}との子を身ごもった。`
        : `${mother.name}が子を身ごもった。`,
    people: [mother, father].filter(Boolean),
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: ["妊娠", source]
  });
}

export function recordBirthHistory(village, mother, child, options = {}) {
  if (!mother || !child) return;
  const special = options.geneticFatherUnknown || child.race === "半神";
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.BIRTH,
    title: special ? `${child.name}、神秘の子として生まれる` : `${child.name}、生まれる`,
    text: special
      ? `${mother.name}が${child.name}を産み、神秘の子が生まれた。`
      : `${mother.name}が${child.name}を産んだ。`,
    people: [mother, options.spouse, child].filter(Boolean),
    tags: special ? ["出生", "神秘の出生"] : ["出生"]
  });
}

export function recordAdulthoodHistory(village, person, options = {}) {
  if (!person) return;
  const source = options.source || "成長";
  // 狼は「成人」ではなく「成狼」として記録する。表示側もこのタグで文言を分ける。
  const isWolfMaturity = options.label === ADULTHOOD_WOLF_TAG;
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.ADULTHOOD,
    title: isWolfMaturity ? `${person.name}、成狼になる` : `${person.name}、成人する`,
    text: isWolfMaturity ? `${person.name}が成狼になった。` : `${person.name}が成人した。`,
    people: [person],
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: [isWolfMaturity ? ADULTHOOD_WOLF_TAG : "成人", source],
    dedupeKey: `adulthood:${person.name}`
  });
}

export function recordBodyExchangeHistory(village, personA, personB, options = {}) {
  if (!personA || !personB) return;
  const includesOutsider = !village.villagers?.includes(personA) || !village.villagers?.includes(personB);
  const source = options.source || "奇跡";
  let text = `奇跡の光によって、${personA.name}と${personB.name}の身体が入れ替わった。`;
  if (source === "落雷") {
    text = `雷に打たれて、${personA.name}と${personB.name}の身体が入れ替わった。`;
  } else if (includesOutsider) {
    text = `村の境が揺らぎ、${personA.name}と${personB.name}の身体が入れ替わった。`;
  } else {
    text = `奇跡の光によって、${personA.name}と${personB.name}の身体が入れ替わった。`;
  }
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.BODY_EXCHANGE,
    title: includesOutsider
      ? `${personA.name}と${personB.name}、境を越えて肉体を交換する`
      : `${personA.name}と${personB.name}、肉体を交換する`,
    text,
    people: [personA, personB],
    tags: ["肉体交換", source]
  });
}

export function recordDryadFruitHistory(village, person, options = {}) {
  if (!person) return;
  const previousRace = options.previousRace || "人間";
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.DRYAD_FRUIT,
    title: `${person.name}、ドライアドの身体となる`,
    text: `${person.name}がドライアドの果実を食べ、${previousRace}の身体からドライアドの身体となった。`,
    people: [person],
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: ["ドライアドの果実", previousRace, "ドライアド"]
  });
}

export function recordCriticalHistory(village, person, options = {}) {
  if (!person) return;
  person.hasBeenCritical = true;
  const reason = options.reason || "老衰";
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.CRITICAL,
    title: `${person.name}、危篤となる`,
    text: `${person.name}が危篤となった。`,
    people: [person],
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: ["危篤", reason]
  });
}

export function recordEpidemicHistory(village, person, options = {}) {
  if (!person) return;
  const source = options.source || "感染";
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.EPIDEMIC,
    title: `${person.name}、病に倒れる`,
    text: `${person.name}が病に倒れた。`,
    people: [person],
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: ["疫病", source]
  });
}

export function recordMythicEventHistory(village, eventKey, person, options = {}) {
  const title = options.title || options.subject || "怪異";
  const personName = person?.name || "村人";
  const textFactory = MYTHIC_EVENT_TEXTS[eventKey];
  const text = options.text || (textFactory ? textFactory(personName) : `${title}が村に起こった。`);
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.MYTHIC_EVENT,
    title,
    text,
    people: person ? [person] : [],
    tags: ["怪異", title]
  });
}

export function recordApocalypsePersonalHistory(village, person, text, options = {}) {
  if (!person || !text) return;
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.APOCALYPSE,
    title: options.title || "黙示録",
    text,
    people: [person],
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: ["黙示録", ...(Array.isArray(options.tags) ? options.tags : [])]
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getDictionaryTermTitle(term) {
  const entry = combinedDictionaryData[term];
  return entry?.description || `${term}の辞書を表示`;
}

function renderDictionaryTerm(term) {
  const label = String(term || "").trim();
  if (!label) return "";
  return `<span class="dictionary-term" tabindex="0" data-dictionary-term="${escapeHtml(label)}" title="${escapeHtml(getDictionaryTermTitle(label))}">${escapeHtml(label)}</span>`;
}

function bindDictionaryTerms(content) {
  content.querySelectorAll("[data-dictionary-term]").forEach(element => {
    const label = (element.dataset.dictionaryTerm || element.textContent || "").trim();
    if (!label) return;
    const showEntry = () => showDictionaryEntry(label);
    element.addEventListener("mouseenter", showEntry);
    element.addEventListener("focus", showEntry);
  });
}

function formatHistoryDate(event) {
  return `${event.year}年${event.month}月`;
}

function cleanRecordText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getOtherPersonName(event, personName, personId = null) {
  if (personId != null && Array.isArray(event.peopleIds)) {
    const index = event.people.findIndex((_, i) => event.peopleIds[i] != null && event.peopleIds[i] !== personId);
    if (index >= 0) return event.people[index];
  }
  return event.people.find(name => name !== personName) || "";
}

// 指定位置の登場人物が本人か。ID優先で、旧データは名前で照合する。
function eventPersonAtIs(event, index, personName, personId = null) {
  const normalizedIndex = index < 0 ? event.people.length + index : index;
  if (personId != null && Array.isArray(event.peopleIds) && event.peopleIds[normalizedIndex] != null) {
    return event.peopleIds[normalizedIndex] === personId;
  }
  return event.people[normalizedIndex] === personName;
}

function getEventSource(event) {
  return event.tags.find((tag, index) => index > 0 && tag) || "";
}

function normalizeJoinSource(source) {
  if (source === "誘惑") return "誘惑";
  if (source === "保護") return "保護";
  return "勧誘";
}

function getBodyExchangeVillageText(event) {
  const [personA, personB] = event.people;
  const source = getEventSource(event);
  if (source === "落雷" || event.text.includes("落雷")) {
    return `雷に打たれて、${personA}と${personB}の身体が入れ替わった。`;
  }
  if (source === "秘宝") {
    return `秘宝の力によって、${personA}と${personB}の身体が入れ替わった。`;
  }
  if (event.text.includes("境")) {
    return `村の境が揺らぎ、${personA}と${personB}の身体が入れ替わった。`;
  }
  return `奇跡の光によって、${personA}と${personB}の身体が入れ替わった。`;
}

function getBodyExchangePersonalText(event, otherName) {
  const source = getEventSource(event);
  if (source === "落雷" || event.text.includes("落雷")) {
    return otherName ? `雷に打たれて、${otherName}と身体が入れ替わった。` : cleanRecordText(event.text);
  }
  if (source === "秘宝") {
    return otherName ? `秘宝の力により、${otherName}と身体が入れ替わった。` : cleanRecordText(event.text);
  }
  if (event.text.includes("境")) {
    return otherName ? `村の境が揺らぎ、${otherName}と身体が入れ替わった。` : cleanRecordText(event.text);
  }
  return otherName ? `奇跡の光により、${otherName}と身体が入れ替わった。` : cleanRecordText(event.text);
}

function getVillageHistoryText(event) {
  const [personA, personB, personC] = event.people;
  switch (event.type) {
    case HISTORY_EVENT_TYPES.ARCHIVE_GAP:
      return "古い記録は散逸し、この時より前の村史は失われている。";
    case HISTORY_EVENT_TYPES.FOUNDING:
      return "忘れられた豊穣神バッカスが、小さな開拓村に目覚めた。";
    case HISTORY_EVENT_TYPES.SCALE_TITLE: {
      const scaleTitle = event.tags[1] || event.title.match(/「(.+)」/)?.[1] || "";
      return scaleTitle ? `「${scaleTitle}」と呼ばれる規模になった。` : cleanRecordText(event.text || event.title);
    }
    case HISTORY_EVENT_TYPES.HEADMAN_ELECTION: {
      if (!personA) return "里長選挙は不成立となった。";
      const base = event.title.includes("続ける")
        ? `${personA}が里長を続けることになった。`
        : `${personA}が里長に選ばれた。`;
      const counts = getElectionCounts(event);
      const note = getElectionResultNote(event);
      return [base, counts ? `得票は${counts}。` : "", note].filter(Boolean).join(" ");
    }
    case HISTORY_EVENT_TYPES.VILLAGER_JOIN: {
      const source = normalizeJoinSource(getEventSource(event));
      if (personA && personB) return `${personB}の${source}で、${personA}が村に加わった。`;
      if (personA) return `${personA}が村に加わった。`;
      break;
    }
    case HISTORY_EVENT_TYPES.VILLAGER_LEAVE:
      if (personA) return `${personA}が村を去った。`;
      break;
    case HISTORY_EVENT_TYPES.VILLAGER_DEATH:
      if (personA) {
        const reason = getEventSource(event);
        return reason && reason !== "死亡"
          ? `${personA}が${reason}により村での生を終えた。`
          : `${personA}が村での生を終えた。`;
      }
      break;
    case HISTORY_EVENT_TYPES.MARRIAGE:
      if (personA && personB) return `${personA}と${personB}が夫婦となった。`;
      break;
    case HISTORY_EVENT_TYPES.BIRTH: {
      const childName = event.people[event.people.length - 1] || "";
      if (event.tags.includes("神秘の出生") && personA && childName) return `${personA}が${childName}を産み、神秘の子が生まれた。`;
      if (personA && childName) return `${personA}が${childName}を産んだ。`;
      break;
    }
    case HISTORY_EVENT_TYPES.BODY_EXCHANGE:
      if (personA && personB) return getBodyExchangeVillageText(event);
      break;
    case HISTORY_EVENT_TYPES.DRYAD_FRUIT:
      return cleanRecordText(event.text || event.title);
    case HISTORY_EVENT_TYPES.MYTHIC_EVENT:
      return cleanRecordText(event.text || event.title);
    case HISTORY_EVENT_TYPES.LOVER:
      if (personA && personB) return `${personA}と${personB}が恋人となった。`;
      break;
    case HISTORY_EVENT_TYPES.PREGNANCY:
      if (personA && personB) return `${personA}が${personB}との子を身ごもった。`;
      if (personA) return event.text.includes("神秘") ? `${personA}に神秘の子が宿った。` : `${personA}が子を身ごもった。`;
      break;
    case HISTORY_EVENT_TYPES.ADULTHOOD:
      if (personA) {
        return event.tags.includes(ADULTHOOD_WOLF_TAG)
          ? `${personA}が成狼になった。`
          : `${personA}が成人した。`;
      }
      break;
    case HISTORY_EVENT_TYPES.CRITICAL:
      if (personA) return `${personA}が危篤となった。`;
      break;
    default:
      break;
  }
  return cleanRecordText(event.text || event.title);
}

function getPersonalHistoryText(event, personName, personId = null) {
  const otherName = getOtherPersonName(event, personName, personId);
  switch (event.type) {
    case HISTORY_EVENT_TYPES.BODY_EXCHANGE:
      return getBodyExchangePersonalText(event, otherName);
    case HISTORY_EVENT_TYPES.DRYAD_FRUIT:
      return cleanRecordText(event.text).replace(`${personName}が`, "").trim() || "ドライアドの身体となった。";
    case HISTORY_EVENT_TYPES.MARRIAGE:
      return otherName ? `${otherName}と夫婦となった。` : cleanRecordText(event.text);
    case HISTORY_EVENT_TYPES.LOVER:
      return otherName ? `${otherName}と恋人になった。` : cleanRecordText(event.text);
    case HISTORY_EVENT_TYPES.SOCIAL_RELATION: {
      const relation = event.tags[1] || "関係";
      const hobby = event.tags[2] || "";
      if (relation === "趣味仲間") {
        return otherName
          ? `${otherName}と${hobby ? `${hobby}の` : ""}趣味仲間になった。`
          : cleanRecordText(event.text);
      }
      return otherName ? `${otherName}と${relation}になった。` : cleanRecordText(event.text);
    }
    case HISTORY_EVENT_TYPES.HOBBY_AWAKENING: {
      const hobby = event.tags[1] || "";
      return hobby ? `${hobby}の趣味に目覚めた。` : cleanRecordText(event.text);
    }
    case HISTORY_EVENT_TYPES.PREGNANCY: {
      const motherName = event.people[0] || personName;
      if (!eventPersonAtIs(event, 0, personName, personId) && event.people[0]) return `${motherName}が子を身ごもった。`;
      return event.text.includes("神秘") ? "神秘の子を身ごもった。" : otherName ? `${otherName}との子を身ごもった。` : "子を身ごもった。";
    }
    case HISTORY_EVENT_TYPES.BIRTH: {
      const motherName = event.people[0] || "";
      const childName = event.people[event.people.length - 1] || "";
      if (eventPersonAtIs(event, -1, personName, personId) && motherName) return `${motherName}の子として生まれた。`;
      if (eventPersonAtIs(event, 0, personName, personId) && childName) return `${childName}を産んだ。`;
      return cleanRecordText(event.text);
    }
    case HISTORY_EVENT_TYPES.VILLAGER_JOIN: {
      const source = normalizeJoinSource(getEventSource(event));
      if (eventPersonAtIs(event, 0, personName, personId)) {
        return otherName ? `${otherName}に${source}され村に加わった。` : "村に加わった。";
      }
      return event.people[0] ? `${event.people[0]}を${source}し、村に迎えた。` : cleanRecordText(event.text);
    }
    case HISTORY_EVENT_TYPES.VILLAGER_LEAVE:
      return "村を去った。";
    case HISTORY_EVENT_TYPES.VILLAGER_DEATH:
      return getEventSource(event) && getEventSource(event) !== "死亡"
        ? `${getEventSource(event)}により村での生を終えた。`
        : "村での生を終えた。";
    case HISTORY_EVENT_TYPES.ADULTHOOD:
      return event.tags.includes(ADULTHOOD_WOLF_TAG) ? "成狼になった。" : "成人した。";
    case HISTORY_EVENT_TYPES.CRITICAL:
      return "危篤となった。";
    case HISTORY_EVENT_TYPES.EPIDEMIC:
      return "病に倒れた。";
    case HISTORY_EVENT_TYPES.MYTHIC_EVENT:
      return cleanRecordText(event.text).replace(`${personName}が`, "").trim() || cleanRecordText(event.text || event.title);
    default:
      return cleanRecordText(event.text || event.title);
  }
}

export function renderHistoryEntry(event, options = {}) {
  const text = options.personName
    ? getPersonalHistoryText(event, options.personName, options.personId ?? null)
    : getVillageHistoryText(event);
  return `
    <article class="history-entry history-entry-${escapeHtml(event.type)}">
      <p class="history-record-line">
        <time class="history-date">${escapeHtml(formatHistoryDate(event))}</time>
        <span class="history-record-text">${escapeHtml(text)}</span>
      </p>
    </article>
  `;
}

function includesPerson(event, personName, personId = null) {
  const eventHasIds = Array.isArray(event.peopleIds) && event.peopleIds.some(id => id != null);
  if (personId != null && eventHasIds) return event.peopleIds.includes(personId);
  return Boolean(personName) && event.people.includes(personName);
}

export function getPersonalHistoryEvents(village, person) {
  const personName = typeof person === "string" ? person : person?.name;
  const personId = typeof person === "object" && Number.isInteger(person?.id) && person.id > 0 ? person.id : null;
  return normalizeHistoryEvents(village?.historyEvents).filter(event => includesPerson(event, personName, personId));
}

function hasArchiveGap(village) {
  return normalizeHistoryEvents(village?.historyEvents).some(event => event.type === HISTORY_EVENT_TYPES.ARCHIVE_GAP);
}

function parsePersonalRelationship(entry) {
  const prefix = String(entry?.prefix || "").trim();
  if (!prefix) return null;
  if (prefix === "既婚") return { category: "family", label: "既婚" };

  const target = String(entry?.targetName || "").trim();
  const label = target ? `${prefix}：${target}` : prefix;

  if (["夫", "妻", "母", "父", "子"].includes(prefix)) {
    return { category: "family", label };
  }
  if (["遺伝母", "遺伝父"].includes(prefix)) {
    return { category: "genetic", label };
  }
  return { category: "social", label };
}

function formatRelationshipCategory(person, category) {
  const labels = getRelationshipEntries(person)
    .map(parsePersonalRelationship)
    .filter(item => item?.category === category && !item.label.startsWith("村設立の同志："))
    .map(item => item.label);
  return labels.length > 0 ? [...new Set(labels)].join("、") : "なし";
}

function renderPersonalTitleSummary(person) {
  const titles = getPersonTitles(person);
  if (titles.length === 0) return "なし";
  return titles.map(title => (
    `<span class="dictionary-term" title="${escapeHtml(title.description || "")}">${escapeHtml(title.name)}</span>`
  )).join("、");
}

function getPersonalityTrait(person) {
  const mindTraits = Array.isArray(person?.mindTraits) ? person.mindTraits : [];
  return mindTraits.find(trait => Object.prototype.hasOwnProperty.call(SPEECH_TYPE_MAPPING, trait)) || "特徴なし";
}

const BODY_EXCHANGE_PORTRAIT_SOURCES = new Set(["奇跡", "落雷", "秘宝", "生成時交換"]);

function hasPortraitImage(portraitFile) {
  const portraitKey = normalizePortraitKey(portraitFile);
  return portraitKey !== DEFAULT_PORTRAIT_KEY && isKnownPortraitKey(portraitKey);
}

function isLegacyOriginalBodyEntry(entry) {
  if (typeof entry.isOriginalBody === "boolean" || entry.bodyOwner) return false;
  return entry.caption === "元の身体" || (!entry.caption && BODY_EXCHANGE_PORTRAIT_SOURCES.has(entry.source));
}

function getPastPortraitCaption(entry, person, index, legacyOriginalBodyIndex) {
  if (entry.isOriginalBody === true) return "元の身体";
  if (entry.isOriginalBody === false) return entry.caption && entry.caption !== "元の身体" ? entry.caption : "過去の姿";
  if (entry.bodyOwner) {
    return isOriginalBodyOwner(person?.name, entry.bodyOwner) ? "元の身体" : "過去の姿";
  }
  if (isLegacyOriginalBodyEntry(entry)) {
    return index === legacyOriginalBodyIndex ? "元の身体" : "過去の姿";
  }
  if (entry.caption) return entry.caption;
  return "過去の姿";
}

function makePortraitStep(portraitFile, caption) {
  return {
    portraitFile: normalizePortraitKey(portraitFile),
    hasImage: hasPortraitImage(portraitFile),
    caption
  };
}

// 過去帳の人物はもう村にいないため、今の姿ではなく去った時点の姿として見せる。
const CURRENT_PORTRAIT_CAPTION = "現在の姿";
const ARCHIVED_PORTRAIT_CAPTION = "往時の姿";

function makeCurrentPortraitStep(person, { archived = false } = {}) {
  return {
    ...makePortraitStep(person?.portraitFile, archived ? ARCHIVED_PORTRAIT_CAPTION : CURRENT_PORTRAIT_CAPTION),
    character: {
      name: person?.name,
      portraitFile: person?.portraitFile,
      adultPortraitFile: person?.adultPortraitFile,
      bodyTraits: Array.isArray(person?.bodyTraits) ? [...person.bodyTraits] : []
    }
  };
}

function getPastPortraitSequence(person) {
  const currentKey = makeCurrentPortraitStep(person).portraitFile;
  const entries = getPastPortraitFiles(person);
  const legacyOriginalBodyIndex = entries.findIndex(isLegacyOriginalBodyEntry);
  const pastPortraits = entries
    .map((entry, index) => makePortraitStep(
      entry.portraitFile,
      getPastPortraitCaption(entry, person, index, legacyOriginalBodyIndex)
    ));
  return pastPortraits.some(step => step.portraitFile !== currentKey) ? pastPortraits.reverse() : [];
}

function renderPastPortraitControls(person, options = {}) {
  const currentPortrait = makeCurrentPortraitStep(person, options);
  const pastPortraits = getPastPortraitSequence(person);
  if (pastPortraits.length === 0) return "";

  return `
    <div
      class="personal-history-portrait-controls"
      data-portrait-controls
      data-current-portrait="${escapeHtml(JSON.stringify(currentPortrait))}"
      data-past-portraits="${escapeHtml(JSON.stringify(pastPortraits))}"
    >
      <button type="button" class="personal-history-portrait-nav-button" data-portrait-step="older" aria-label="過去の肖像へ">&lt;&lt;</button>
      <span class="personal-history-portrait-caption" data-portrait-caption>${escapeHtml(currentPortrait.caption)}</span>
      <button type="button" class="personal-history-portrait-nav-button" data-portrait-step="newer" aria-label="現在に近い肖像へ">&gt;&gt;</button>
    </div>
  `;
}

function renderPortraitFrame(person, options = {}) {
  const currentPortrait = makeCurrentPortraitStep(person, options);
  const hiddenAttr = currentPortrait.hasImage ? "" : " hidden";
  const unknownHiddenAttr = currentPortrait.hasImage ? " hidden" : "";
  const unknownClass = currentPortrait.hasImage ? "" : " is-unknown";
  return `
    <div class="personal-history-portrait-frame${unknownClass}" data-personal-history-portrait-frame>
      <div class="portrait-sprite" role="img" aria-label="${escapeHtml(person.name)}" data-personal-history-portrait${hiddenAttr}></div>
      <span class="personal-history-portrait-unknown" data-personal-history-portrait-unknown${unknownHiddenAttr}>不明</span>
    </div>
  `;
}

function setPersonalHistoryPortrait(frame, portrait, unknown, step) {
  if (!frame || !portrait || !unknown || !step) return;
  if (!step.hasImage) {
    portrait.hidden = true;
    unknown.hidden = false;
    frame.classList.add("is-unknown");
    return;
  }
  frame.classList.remove("is-unknown");
  unknown.hidden = true;
  portrait.hidden = false;
  applyPortraitToElement(portrait, step.character || { portraitFile: step.portraitFile });
}

function bindPersonalHistoryPortrait(content, person) {
  const frame = content.querySelector("[data-personal-history-portrait-frame]");
  const portrait = content.querySelector("[data-personal-history-portrait]");
  const unknown = content.querySelector("[data-personal-history-portrait-unknown]");
  if (!frame || !portrait || !unknown) return;
  setPersonalHistoryPortrait(frame, portrait, unknown, makeCurrentPortraitStep(person));
}

function bindPastPortraitControls(content) {
  const controls = content.querySelector("[data-portrait-controls]");
  const portrait = content.querySelector("[data-personal-history-portrait]");
  const frame = content.querySelector("[data-personal-history-portrait-frame]");
  const unknown = content.querySelector("[data-personal-history-portrait-unknown]");
  const caption = content.querySelector("[data-portrait-caption]");
  const olderButton = content.querySelector('[data-portrait-step="older"]');
  const newerButton = content.querySelector('[data-portrait-step="newer"]');
  if (!controls || !portrait || !frame || !unknown || !caption || !olderButton || !newerButton) return;

  let currentPortrait = null;
  let pastPortraits = [];
  try {
    currentPortrait = JSON.parse(controls.dataset.currentPortrait || "null");
    pastPortraits = JSON.parse(controls.dataset.pastPortraits || "[]");
  } catch (error) {
    currentPortrait = null;
    pastPortraits = [];
  }
  if (!currentPortrait?.portraitFile) return;
  pastPortraits = pastPortraits.filter(step => step?.portraitFile);

  const portraitSteps = [currentPortrait, ...pastPortraits];
  let portraitIndex = 0;
  const renderPortraitStep = () => {
    const step = portraitSteps[portraitIndex];
    setPersonalHistoryPortrait(frame, portrait, unknown, step);
    caption.textContent = step.caption ||
      (portraitIndex === 0 ? currentPortrait.caption || CURRENT_PORTRAIT_CAPTION : "過去の姿");
    olderButton.disabled = portraitIndex >= portraitSteps.length - 1;
    newerButton.disabled = portraitIndex <= 0;
  };

  olderButton.addEventListener("click", () => {
    if (portraitIndex >= portraitSteps.length - 1) return;
    portraitIndex += 1;
    renderPortraitStep();
  });
  newerButton.addEventListener("click", () => {
    if (portraitIndex <= 0) return;
    portraitIndex -= 1;
    renderPortraitStep();
  });
  renderPortraitStep();
}

function renderPersonalHistorySummary(person, options = {}) {
  const profileFields = [
    { label: "名前", value: person.name || "不明", className: "is-name" },
    { label: "種族", valueHtml: renderDictionaryTerm(person.race || "人間"), className: "is-race" },
    { label: "肉体", value: `${person.bodyAge ?? "?"}歳/${person.bodySex || "不明"}`, className: "is-body" },
    { label: "精神", value: `${person.spiritAge ?? "?"}歳/${person.spiritSex || "不明"}`, className: "is-spirit" },
    { label: "性格", value: getPersonalityTrait(person), className: "is-personality" },
    { label: "趣味", value: person.hobby || "なし", className: "is-hobby" }
  ];
  const familyRelations = formatRelationshipCategory(person, "family");
  const socialRelations = formatRelationshipCategory(person, "social");
  // 過去帳の人物は好感度が残っていないため、詳細ボタンを出さない。
  const detailButtonHtml = options.archived ? "" : `
        <span class="personal-history-detail-row">
          <button type="button" class="personal-history-detail-button" data-open-friendship-detail>詳細</button>
        </span>`;
  const relationshipFields = [
    { label: "家族関係", value: familyRelations },
    {
      label: "人間関係",
      valueHtml: `
        <span class="personal-history-relationship-text">${escapeHtml(socialRelations)}</span>${detailButtonHtml}
      `
    }
  ];
  const detailFields = [
    ...relationshipFields,
    { label: "称号", valueHtml: renderPersonalTitleSummary(person) },
    ...(person.departure ? [{
      label: "離村",
      value: formatDepartureSentence(person.departure)
    }] : [])
  ];
  return `
    <section class="personal-history-summary">
      <div class="personal-history-portrait-area">
        ${renderPortraitFrame(person, options)}
        ${renderPastPortraitControls(person, options)}
      </div>
      <div class="personal-history-profile">
        <div class="personal-history-profile-grid">
          <div class="personal-history-profile-table">
            ${profileFields.map(field => `<span class="personal-history-profile-label ${escapeHtml(field.className)}">${escapeHtml(field.label)}</span>`).join("")}
            ${profileFields.map(field => `<strong class="personal-history-profile-value ${escapeHtml(field.className)}">${field.valueHtml ?? escapeHtml(field.value)}</strong>`).join("")}
          </div>
          ${detailFields.map(field => `
            <div class="personal-history-profile-field is-detail">
              <span>${escapeHtml(field.label)}</span>
              <strong>${field.valueHtml ?? escapeHtml(field.value)}</strong>
            </div>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

export function openPersonalHistoryModal(village, person, options = {}) {
  const overlay = document.getElementById("personalHistoryOverlay");
  const modal = document.getElementById("personalHistoryModal");
  const title = document.getElementById("personalHistoryTitle");
  const content = document.getElementById("personalHistoryContent");
  if (!overlay || !modal || !title || !content || !person) return;

  const events = getPersonalHistoryEvents(village, person);
  const archiveGapNote = hasArchiveGap(village)
    ? `<div class="personal-history-note">古い村史の欠落以前の個人記録は残っていません。</div>`
    : "";

  title.textContent = `${person.name}の記録`;
  content.innerHTML = `
    ${renderPersonalHistorySummary(person, options)}
    ${archiveGapNote}
    ${events.length > 0
      ? `<div class="history-list">${events.map(event => renderHistoryEntry(event, { personName: person.name, personId: person.id ?? null })).join("")}</div>`
      : `<div class="history-empty">この人物の歩みは、まだ村の帳面には記されていない。</div>`}
  `;
  bindPersonalHistoryPortrait(content, person);
  bindPastPortraitControls(content);
  bindDictionaryTerms(content);
  content.querySelector("[data-open-friendship-detail]")?.addEventListener("click", async () => {
    const { openFriendshipDetailModal } = await import("./relationships.js");
    openFriendshipDetailModal(village, person);
  });

  overlay.style.display = "block";
  modal.style.display = "block";
}

// 過去帳と個人史に載せる、去り方の一文。
const DEPARTURE_SENTENCES = {
  "出立の奇跡": "出立の奇跡で村を発った",
  "絶望": "絶望して村を離れた",
  "老衰": "老衰により死亡した",
  "重体の悪化": "重体の悪化により死亡した",
  "光の柱への曝露": "光の柱への曝露により死亡した"
};

function formatDepartureSentence(departure) {
  const reason = departure?.reason || "離村";
  const body = DEPARTURE_SENTENCES[reason] || `${reason}により村を去った`;
  return `${departure?.year ?? "?"}年${departure?.month ?? "?"}月に${body}`;
}

/**
 * 離村・死亡した村人を過去帳へ記す。姿や特性は去った時点のまま残す。
 */
export function recordDepartedVillager(village, person, reason) {
  if (!village || !person) return;
  if (!Array.isArray(village.departedVillagers)) village.departedVillagers = [];
  const snapshot = JSON.parse(JSON.stringify(person));
  snapshot.departure = {
    year: normalizeHistoryYear(village.year),
    month: normalizeHistoryMonth(village.month),
    reason: String(reason || "離村")
  };
  village.departedVillagers.push(snapshot);
}

export function openPastBookModal(village, { onBack = null } = {}) {
  if (typeof document === "undefined" || !village) return;
  document.getElementById("pastBookOverlay")?.remove();
  document.getElementById("pastBookModal")?.remove();

  const departed = Array.isArray(village.departedVillagers) ? [...village.departedVillagers].reverse() : [];
  const rows = departed.map((person, index) => `
    <tr>
      <td class="friendship-detail-person">
        <button type="button" class="friendship-detail-portrait-button" data-open-past-person="${index}" aria-label="${escapeHtml(person.name)}の個人史を見る">
          ${getPortraitSpriteHtml(person, { alt: person.name })}
        </button>
        <span>${escapeHtml(person.name)}</span>
      </td>
      <td>${escapeHtml(formatDepartureSentence(person.departure))}</td>
    </tr>
  `).join("");

  const overlay = document.createElement("div");
  overlay.id = "pastBookOverlay";
  overlay.className = "friendship-detail-overlay";
  const modal = document.createElement("div");
  modal.id = "pastBookModal";
  modal.className = "friendship-detail-modal";
  modal.innerHTML = `
    <div class="modal-header">過去帳</div>
    <div class="friendship-detail-content">
      <table class="friendship-detail-table">
        <colgroup>
          <col class="friendship-detail-col-person">
          <col class="friendship-detail-col-relation">
        </colgroup>
        <thead>
          <tr>
            <th>人物</th>
            <th>記録</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="2" class="friendship-detail-empty">村を去った者は、まだ帳面に記されていない。</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="modal-buttons">
      <button type="button" data-past-book-back>台帳へ戻る</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  const close = () => {
    overlay.remove();
    modal.remove();
  };
  modal.querySelectorAll("[data-open-past-person]").forEach(button => {
    button.addEventListener("click", () => {
      const person = departed[Number(button.dataset.openPastPerson)];
      if (!person) return;
      close();
      openPersonalHistoryModal(village, person, { archived: true });
    });
  });
  // ボタンは台帳へ戻し、オーバーレイのクリックは閉じるだけにする。
  modal.querySelector("[data-past-book-back]").addEventListener("click", () => {
    close();
    if (typeof onBack === "function") onBack();
  });
  overlay.addEventListener("click", close);
}

export function openHistoryModal(village, { onBack = null } = {}) {
  const overlay = document.getElementById("historyOverlay");
  const modal = document.getElementById("historyModal");
  const content = document.getElementById("historyContent");
  if (!overlay || !modal || !content) return;

  const events = normalizeHistoryEvents(village?.historyEvents)
    .filter(event => event.scope !== HISTORY_SCOPES.PERSON);
  content.innerHTML = events.length > 0
    ? `<div class="history-list">${events.map(renderHistoryEntry).join("")}</div>`
    : `<div class="history-empty">この村について記すべき出来事は、まだ帳面には残されていない。</div>`;

  // ボタンは台帳へ戻し、オーバーレイのクリックは閉じるだけにする。
  const backButton = modal.querySelector("[data-history-back]");
  if (backButton) {
    backButton.onclick = () => {
      closeHistoryModal();
      if (typeof onBack === "function") onBack();
    };
  }

  overlay.style.display = "block";
  modal.style.display = "block";
}

export function closeHistoryModal() {
  const overlay = document.getElementById("historyOverlay");
  const modal = document.getElementById("historyModal");
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
}

export function closePersonalHistoryModal() {
  const overlay = document.getElementById("personalHistoryOverlay");
  const modal = document.getElementById("personalHistoryModal");
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
}
