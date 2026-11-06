// lachesisLedger.js
// ラケシスの帳簿。秘宝「ラケシスの台帳」で登録した村人を、セーブデータの外（localStorage）に残す。
// 登録した村人は、別の村へ訪問者として現れたり、秘宝「ラケシスの神籤」や「はじめから（転生）」で呼び出せる。
// 帳簿はブラウザごとの記録で、セーブデータ（JSON・ローカル保存）には含めない。

import { convertObjectToVillager, convertVillagerToObject } from "./saveLoad.js";
import { ACTION_NONE, refreshJobTable, setPreferredAction } from "./domain/jobTables.js";
import { allocatePersonId, normalizePersonId } from "./domain/personId.js";
import { normalizeFriendshipState } from "./relationships.js";
import { syncEffectiveStats } from "./domain/statLayers.js";
import { getVillagersIncludingSaltPillar } from "./domain/apocalypseRules.js";
import { VILLAGE_ROLE_NONE, setVillageRole } from "./domain/villageRoles.js";

const STORAGE_KEY = "vobLachesisLedger";
export const LACHESIS_NATURAL_VISIT_CHANCE = 0.05;
const LACHESIS_VISITOR_DISPLAY_TYPE = "旅人";

// 帳簿へ写さない一時的な状態。村ごとの事情なので、別の村では持ち越さない。
const TRANSIENT_BODY_TRAITS = new Set([
  "負傷", "重体", "疲労", "過労", "飢餓", "凍え", "疫病", "産褥", "危篤", "致命傷", "妊娠", "臨月"
]);
const TRANSIENT_MIND_TRAITS = new Set([
  "心労", "抑鬱", "失望", "絶望", "狂乱", "訪問者", "襲撃者", "捕虜", "懐柔失敗", "勧誘失敗", "肖像", "ニケ"
]);

function createLachesisId() {
  return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function loadLachesisLedger() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(entry => entry?.lachesisId && entry?.person) : [];
  } catch {
    return [];
  }
}

function saveLachesisLedger(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function hasLachesisEntries() {
  return loadLachesisLedger().length > 0;
}

/** 素の名前。訪問者の肩書（旅人の など）は帳簿に残さない。 */
function getGivenName(person) {
  if (person?.givenName) return String(person.givenName);
  const name = String(person?.name || "");
  return person?.mindTraits?.includes("訪問者") && name.includes("の")
    ? name.slice(name.indexOf("の") + 1)
    : name;
}

/**
 * 村人を帳簿へ登録する。登録済みの村人なら、その時点の姿で記録を上書きする。
 * @returns {{ overwritten: boolean, saved: boolean }}
 */
export function registerToLachesisLedger(village, person) {
  if (!person.lachesisId) person.lachesisId = createLachesisId();
  const entries = loadLachesisLedger();
  const index = entries.findIndex(entry => entry.lachesisId === person.lachesisId);
  const entry = {
    lachesisId: person.lachesisId,
    name: getGivenName(person),
    registeredYear: Number(village?.year) || 1,
    registeredMonth: Number(village?.month) || 1,
    originVillageUid: String(village?.villageUid || ""),
    person: convertVillagerToObject(person)
  };
  if (index >= 0) entries[index] = entry;
  else entries.push(entry);
  return { overwritten: index >= 0, saved: saveLachesisLedger(entries) };
}

function getVillagePeople(village) {
  return [
    ...getVillagersIncludingSaltPillar(village),
    ...(Array.isArray(village?.visitors) ? village.visitors : []),
    ...(Array.isArray(village?.captives) ? village.captives : []),
    ...(Array.isArray(village?.raidEnemies) ? village.raidEnemies : []),
    ...(Array.isArray(village?.activeAdventurerQuests)
      ? village.activeAdventurerQuests.map(quest => quest?.adventurer).filter(Boolean)
      : [])
  ];
}

/** 同じ登録村人が、いま村にいる（訪問者・捕虜・依頼中の冒険者を含む）か。 */
export function isLachesisPersonInVillage(village, lachesisId) {
  return getVillagePeople(village).some(person => person?.lachesisId === lachesisId);
}

/** 呼び出せない理由。呼び出せるなら空文字。 */
export function getLachesisEntryBlockedReason(village, entry) {
  if (isLachesisPersonInVillage(village, entry.lachesisId)) return "すでに村にいます";
  const names = new Set(getVillagePeople(village).map(person => getGivenName(person)));
  if (names.has(entry.name)) return "同じ名の者が村にいます";
  return "";
}

export function getSummonableLachesisEntries(village) {
  return loadLachesisLedger().filter(entry => !getLachesisEntryBlockedReason(village, entry));
}

/** 帳簿の記録から人物を作り直す。別の村の人物IDや関係は持ち込まない。 */
function rebuildPersonFromEntry(entry) {
  const source = entry.person;
  const person = convertObjectToVillager(source);
  const oldId = normalizePersonId(source.id);
  person.id = allocatePersonId();
  person.bodyOwnerId = normalizePersonId(source.bodyOwnerId) === oldId ? person.id : null;
  person.name = entry.name;
  person.givenName = "";
  person.lachesisId = entry.lachesisId;
  person.lachesisSummoned = false;
  person.reincarnatedFromId = null;
  person.relationships = [];
  person.friendships = {};
  person.friendshipStats = {};
  normalizeFriendshipState(person);
  setVillageRole(person, VILLAGE_ROLE_NONE);
  person.pregnancy = null;
  person.postpartumMonths = 0;
  person.socialAttemptedThisMonth = false;
  person.assignmentLocked = false;
  person.bodyTraits = person.bodyTraits.filter(trait => !TRANSIENT_BODY_TRAITS.has(trait));
  person.mindTraits = person.mindTraits.filter(trait => !TRANSIENT_MIND_TRAITS.has(trait));
  person.hp = 100;
  person.mp = 100;
  setPreferredAction(person, ACTION_NONE);
  person.action = ACTION_NONE;
  person.jobTable = [];
  person.actionTable = [];
  syncEffectiveStats(person);
  return person;
}

/** 帳簿の村人を、職業「旅人」の訪問者として作る。 */
export function createLachesisVisitor(entry, { summoned = false } = {}) {
  const visitor = rebuildPersonFromEntry(entry);
  visitor.givenName = entry.name;
  visitor.name = `${LACHESIS_VISITOR_DISPLAY_TYPE}の${entry.name}`;
  visitor.job = LACHESIS_VISITOR_DISPLAY_TYPE;
  visitor.action = "訪問";
  visitor.actionTable = ["訪問"];
  visitor.mindTraits.push("訪問者");
  visitor.lachesisSummoned = !!summoned;
  return visitor;
}

/** 「はじめから（転生）」で、帳簿の村人を初期村人として作る。 */
export function createLachesisFounder(entry, village = null) {
  const founder = rebuildPersonFromEntry(entry);
  refreshJobTable(founder, village);
  return founder;
}

/**
 * 訪問者が来るときに、別の村で登録された村人へ置き換えるかを判定する。
 * 置き換えるなら訪問者を返す。
 */
export function rollLachesisNaturalVisitor(village) {
  if (Math.random() >= LACHESIS_NATURAL_VISIT_CHANCE) return null;
  const candidates = getSummonableLachesisEntries(village)
    .filter(entry => entry.originVillageUid !== String(village?.villageUid || ""));
  if (candidates.length === 0) return null;
  const entry = candidates[Math.floor(Math.random() * candidates.length)];
  return createLachesisVisitor(entry);
}
