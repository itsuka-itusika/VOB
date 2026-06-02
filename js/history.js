import { getPortraitPath } from "./util.js";
import { getPersonTitles } from "./titles.js";

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
  MYTHIC_EVENT: "mythicEvent",
  LOVER: "lover",
  SOCIAL_RELATION: "socialRelation",
  HOBBY_AWAKENING: "hobbyAwakening",
  PREGNANCY: "pregnancy",
  ADULTHOOD: "adulthood",
  CRITICAL: "critical"
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
  [HISTORY_EVENT_TYPES.MYTHIC_EVENT]: "怪異",
  [HISTORY_EVENT_TYPES.LOVER]: "恋人",
  [HISTORY_EVENT_TYPES.SOCIAL_RELATION]: "交友",
  [HISTORY_EVENT_TYPES.HOBBY_AWAKENING]: "趣味",
  [HISTORY_EVENT_TYPES.PREGNANCY]: "妊娠",
  [HISTORY_EVENT_TYPES.ADULTHOOD]: "成人",
  [HISTORY_EVENT_TYPES.CRITICAL]: "危篤"
});

const HISTORY_SCOPES = Object.freeze({
  VILLAGE: "village",
  PERSON: "person"
});

const MYTHIC_EVENT_TEXTS = Object.freeze({
  "狩猟神": personName => `${personName}が狩女神の祝福を受けた。`,
  "太陽神": personName => `${personName}が太陽神の寵愛を受けた。`,
  "戦女神": personName => `${personName}が戦女神の啓示を受けた。`,
  "地母神": personName => `${personName}が地母神の慈愛を受けた。`,
  goldenRain: personName => `黄金の雨が降り、${personName}に神秘の兆しが宿った。`,
  strangeGrowthPotion: personName => `怪しい薬により、${personName}の身体が急速に成長した。`
});

function ensureHistoryEvents(village) {
  if (!Array.isArray(village.historyEvents)) {
    village.historyEvents = [];
  }
  return village.historyEvents;
}

function normalizePeople(people) {
  if (!Array.isArray(people)) return [];
  return people
    .map(person => {
      if (typeof person === "string") return person;
      return person?.name || "";
    })
    .filter(Boolean);
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
      people: normalizePeople(event?.people),
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
    people: normalizePeople(entry.people),
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
  const counts = options.counts ? ` 得票は${options.counts}。` : "";
  if (!winner) {
    addHistoryEvent(village, {
      type: HISTORY_EVENT_TYPES.HEADMAN_ELECTION,
      title: "里長選挙、不成立",
      text: "里長選挙は不成立となった。",
      tags: ["里長選挙"]
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
    tags: ["里長選挙"]
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
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.VILLAGER_DEATH,
    title: `${person.name}、逝く`,
    text: `${person.name}が村での生を終えた。`,
    people: [person],
    tags: ["死別", options.reason || "死亡"]
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
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.ADULTHOOD,
    title: `${person.name}、成人する`,
    text: `${person.name}が成人した。`,
    people: [person],
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: ["成人", source],
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

export function recordCriticalHistory(village, person, options = {}) {
  if (!person) return;
  const reason = options.reason || "老衰";
  addHistoryEvent(village, {
    type: HISTORY_EVENT_TYPES.CRITICAL,
    title: `${person.name}、危篤となる`,
    text: `${person.name}が危篤となった。`,
    people: [person],
    importance: "minor",
    scope: HISTORY_SCOPES.PERSON,
    tags: ["危篤", reason],
    dedupeKey: `critical:${person.name}`
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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatHistoryDate(event) {
  return `${event.year}年${event.month}月`;
}

function cleanRecordText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getOtherPersonName(event, personName) {
  return event.people.find(name => name !== personName) || "";
}

function getEventSource(event) {
  return event.tags.find((tag, index) => index > 0 && tag) || "";
}

function normalizeJoinSource(source) {
  return source === "誘惑" ? "誘惑" : "勧誘";
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
    case HISTORY_EVENT_TYPES.HEADMAN_ELECTION:
      if (!personA) return "里長選挙は不成立となった。";
      return event.title.includes("続ける")
        ? `${personA}が里長を続けることになった。`
        : `${personA}が里長に選ばれた。`;
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
      if (personA) return `${personA}が村での生を終えた。`;
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
      if (personA) return `${personA}が成人した。`;
      break;
    case HISTORY_EVENT_TYPES.CRITICAL:
      if (personA) return `${personA}が危篤となった。`;
      break;
    default:
      break;
  }
  return cleanRecordText(event.text || event.title);
}

function getPersonalHistoryText(event, personName) {
  const otherName = getOtherPersonName(event, personName);
  switch (event.type) {
    case HISTORY_EVENT_TYPES.BODY_EXCHANGE:
      return getBodyExchangePersonalText(event, otherName);
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
      if (motherName !== personName) return `${motherName}が子を身ごもった。`;
      return event.text.includes("神秘") ? "神秘の子を身ごもった。" : otherName ? `${otherName}との子を身ごもった。` : "子を身ごもった。";
    }
    case HISTORY_EVENT_TYPES.BIRTH: {
      const motherName = event.people[0] || "";
      const childName = event.people[event.people.length - 1] || "";
      if (childName === personName && motherName) return `${motherName}の子として生まれた。`;
      if (motherName === personName && childName) return `${childName}を産んだ。`;
      return cleanRecordText(event.text);
    }
    case HISTORY_EVENT_TYPES.VILLAGER_JOIN: {
      const source = normalizeJoinSource(getEventSource(event));
      if (event.people[0] === personName) {
        return otherName ? `${otherName}に${source}され村に加わった。` : "村に加わった。";
      }
      return event.people[0] ? `${event.people[0]}を${source}し、村に迎えた。` : cleanRecordText(event.text);
    }
    case HISTORY_EVENT_TYPES.VILLAGER_LEAVE:
      return "村を去った。";
    case HISTORY_EVENT_TYPES.VILLAGER_DEATH:
      return "村での生を終えた。";
    case HISTORY_EVENT_TYPES.ADULTHOOD:
      return "成人した。";
    case HISTORY_EVENT_TYPES.CRITICAL:
      return "危篤となった。";
    case HISTORY_EVENT_TYPES.MYTHIC_EVENT:
      return cleanRecordText(event.text).replace(`${personName}が`, "").trim() || cleanRecordText(event.text || event.title);
    default:
      return cleanRecordText(event.text || event.title);
  }
}

function renderHistoryEntry(event, options = {}) {
  const text = options.personName
    ? getPersonalHistoryText(event, options.personName)
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

function includesPerson(event, personName) {
  return Boolean(personName) && event.people.includes(personName);
}

export function getPersonalHistoryEvents(village, person) {
  const personName = typeof person === "string" ? person : person?.name;
  return normalizeHistoryEvents(village?.historyEvents).filter(event => includesPerson(event, personName));
}

function hasArchiveGap(village) {
  return normalizeHistoryEvents(village?.historyEvents).some(event => event.type === HISTORY_EVENT_TYPES.ARCHIVE_GAP);
}

function parsePersonalRelationship(rawRelationship) {
  const raw = String(rawRelationship || "").trim();
  if (!raw) return null;
  if (raw === "既婚") return { category: "family", label: "既婚" };

  const oldParent = raw.match(/^(.+)の(母|父)$/);
  if (oldParent) return { category: "family", label: `子：${oldParent[1]}` };

  const oldChild = raw.match(/^(.+)の(息子|娘)$/);
  if (oldChild) return { category: "family", label: `母：${oldChild[1]}` };

  const categorized = raw.match(/^【([^】]+)】(.+)$/);
  const categoryText = categorized ? categorized[1] : "";
  const body = categorized ? categorized[2] : raw;
  const separator = body.includes("：") ? "：" : ":";
  const separatorIndex = body.indexOf(separator);
  const prefix = separatorIndex >= 0 ? body.slice(0, separatorIndex).trim() : body;
  const target = separatorIndex >= 0 ? body.slice(separatorIndex + 1).trim() : "";
  const label = target ? `${prefix}：${target}` : prefix;

  if (categoryText === "家族関係" || ["夫", "妻", "母", "父", "子"].includes(prefix)) {
    return { category: "family", label };
  }
  if (categoryText === "遺伝関係" || ["遺伝母", "遺伝父"].includes(prefix)) {
    return { category: "genetic", label };
  }
  if (categoryText === "交友関係" || ["恋人", "親友", "天敵"].includes(prefix) || prefix.endsWith("仲間")) {
    return { category: "social", label };
  }
  return { category: "social", label };
}

function formatRelationshipCategory(person, category) {
  const relationships = Array.isArray(person.relationships) ? person.relationships : [];
  const labels = relationships
    .map(parsePersonalRelationship)
    .filter(item => item?.category === category)
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

function renderPersonalHistorySummary(person) {
  const profileFields = [
    { label: "名前", value: person.name || "不明", className: "is-name" },
    { label: "種族", value: person.race || "人間", className: "is-race" },
    { label: "肉体", value: `${person.bodyAge ?? "?"}歳/${person.bodySex || "不明"}`, className: "is-body" },
    { label: "精神", value: `${person.spiritAge ?? "?"}歳/${person.spiritSex || "不明"}`, className: "is-spirit" },
    { label: "趣味", value: person.hobby || "なし", className: "is-hobby" }
  ];
  const relationshipFields = [
    { label: "家族関係", value: formatRelationshipCategory(person, "family") },
    { label: "人間関係", value: formatRelationshipCategory(person, "social") }
  ];
  const detailFields = [
    ...relationshipFields,
    { label: "称号", valueHtml: renderPersonalTitleSummary(person) }
  ];
  return `
    <section class="personal-history-summary">
      <div class="personal-history-portrait-frame">
        <img src="${escapeHtml(getPortraitPath(person))}" alt="${escapeHtml(person.name)}">
      </div>
      <div class="personal-history-profile">
        <div class="personal-history-profile-grid">
          <div class="personal-history-profile-table">
            ${profileFields.map(field => `<span class="personal-history-profile-label ${escapeHtml(field.className)}">${escapeHtml(field.label)}</span>`).join("")}
            ${profileFields.map(field => `<strong class="personal-history-profile-value ${escapeHtml(field.className)}">${escapeHtml(field.value)}</strong>`).join("")}
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
      ? `<div class="history-list">${events.map(event => renderHistoryEntry(event, { personName: person.name })).join("")}</div>`
      : `<div class="history-empty">この人物の歩みは、まだ村の帳面には記されていない。</div>`}
  `;

  overlay.style.display = "block";
  modal.style.display = "block";
}

export function openHistoryModal(village) {
  const overlay = document.getElementById("historyOverlay");
  const modal = document.getElementById("historyModal");
  const content = document.getElementById("historyContent");
  if (!overlay || !modal || !content) return;

  const events = normalizeHistoryEvents(village?.historyEvents)
    .filter(event => event.scope !== HISTORY_SCOPES.PERSON);
  content.innerHTML = events.length > 0
    ? `<div class="history-list">${events.map(renderHistoryEntry).join("")}</div>`
    : `<div class="history-empty">この村について記すべき出来事は、まだ帳面には残されていない。</div>`;

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
