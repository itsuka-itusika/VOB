// records.js
// 台帳の「殿堂」に出す歴代記録。村人が死亡・出立しても残るよう、
// 人物ではなく村の側へ精神ID（person.id）ごとに積む。

import { getPortraitSpriteHtml } from "./data/portraitAtlas.js";
import { getPersonTitles } from "./titles.js";

/** 記録の種類。表示順もこの並びに従う。 */
export const RECORD_CATEGORIES = [
  { id: "bestFriends", label: "親友の数", unit: "人", mode: "max" },
  { id: "titleCount", label: "称号の数", unit: "個", mode: "max" },
  { id: "heartbreak", label: "失恋回数", unit: "回", mode: "sum" },
  { id: "recruitment", label: "勧誘成功回数", unit: "回", mode: "sum" },
  { id: "seduction", label: "誘惑成功回数", unit: "回", mode: "sum" },
  { id: "headmanTerms", label: "里長当選回数", unit: "回", mode: "sum" },
  { id: "raidWins", label: "迎撃勝利回数", unit: "回", mode: "sum" },
  { id: "distinguished", label: "殊勲回数", unit: "回", mode: "sum" },
  { id: "raidDamage", label: "累積与ダメージ", unit: "", mode: "sum" },
  { id: "food", label: "累積食料生産", unit: "", mode: "sum" },
  { id: "materials", label: "累積資材生産", unit: "", mode: "sum" },
  { id: "funds", label: "累積資金生産", unit: "", mode: "sum" },
  { id: "tech", label: "累積技術生産", unit: "", mode: "sum" },
  { id: "healedHp", label: "累積体力回復", unit: "", mode: "sum" },
  { id: "healedMp", label: "累積メンタル回復", unit: "", mode: "sum" }
];

const CATEGORY_BY_ID = new Map(RECORD_CATEGORIES.map(category => [category.id, category]));
export const RECORD_RANKING_LIMIT = 3;

function getRecordStore(village) {
  if (!village) return null;
  if (!village.villageRecords || typeof village.villageRecords !== "object") {
    village.villageRecords = {};
  }
  return village.villageRecords;
}

/** 記録用の見出し。名前と姿は書き込むたびに最新へ更新する。 */
function touchRecordEntry(village, person) {
  const store = getRecordStore(village);
  if (!store || !person || person.id == null) return null;
  const key = String(person.id);
  const entry = store[key] || { values: {} };
  entry.name = String(person.name || entry.name || "");
  entry.portraitFile = String(person.portraitFile || entry.portraitFile || "");
  if (!entry.values || typeof entry.values !== "object") entry.values = {};
  store[key] = entry;
  return entry;
}

/** 積み上げ式の記録を加える。 */
export function addVillageRecord(village, person, categoryId, amount) {
  const value = Math.floor(Number(amount) || 0);
  if (value <= 0 || !CATEGORY_BY_ID.has(categoryId)) return;
  const entry = touchRecordEntry(village, person);
  if (!entry) return;
  entry.values[categoryId] = (Number(entry.values[categoryId]) || 0) + value;
}

/** その時々の数を見る記録。過去の最高だけを残す。 */
export function updateVillageRecordMax(village, person, categoryId, value) {
  const next = Math.floor(Number(value) || 0);
  if (next <= 0 || !CATEGORY_BY_ID.has(categoryId)) return;
  const entry = touchRecordEntry(village, person);
  if (!entry) return;
  if (next > (Number(entry.values[categoryId]) || 0)) entry.values[categoryId] = next;
}

/** 称号は各所で贈られるため、記録は一覧を開いたときと離村時に取り直す。 */
export function syncTitleCountRecord(village, person) {
  updateVillageRecordMax(village, person, "titleCount", getPersonTitles(person).length);
}

export function normalizeVillageRecords(source) {
  if (!source || typeof source !== "object") return {};
  const records = {};
  Object.entries(source).forEach(([key, entry]) => {
    const id = String(key || "").trim();
    if (!id || !entry || typeof entry !== "object") return;
    const values = {};
    RECORD_CATEGORIES.forEach(category => {
      const value = Math.floor(Number(entry.values?.[category.id]));
      if (Number.isFinite(value) && value > 0) values[category.id] = value;
    });
    if (Object.keys(values).length === 0) return;
    records[id] = {
      name: String(entry.name || ""),
      portraitFile: String(entry.portraitFile || ""),
      values
    };
  });
  return records;
}

/** その記録の上位。同値は先に記録された順で並ぶ。 */
export function getVillageRecordRanking(village, categoryId, limit = RECORD_RANKING_LIMIT) {
  const store = getRecordStore(village);
  if (!store) return [];
  return Object.entries(store)
    .map(([id, entry]) => ({
      id,
      name: entry.name || "",
      portraitFile: entry.portraitFile || "",
      value: Number(entry.values?.[categoryId]) || 0
    }))
    .filter(row => row.name && row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, Math.max(0, limit));
}

export function getRecordPortraitHtml(row, size = 32) {
  return getPortraitSpriteHtml(
    { name: row.name, portraitFile: row.portraitFile, bodyTraits: [] },
    { size, alt: row.name }
  );
}
