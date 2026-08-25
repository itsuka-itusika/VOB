// personId.js
// 人物（村人・訪問者・捕虜・襲撃者）の一意ID採番。
// 同名の別人による参照混線を防ぐため、人物参照は名前ではなくIDで行う。

let nextPersonId = 1;

/** 新しい人物IDを採番する。 */
export function allocatePersonId() {
  return nextPersonId++;
}

/** IDを持たない人物へIDを割り当てる。既にあればそのまま返す。 */
export function ensurePersonId(person) {
  if (!person || typeof person !== "object") return null;
  if (!Number.isInteger(person.id) || person.id <= 0) {
    person.id = allocatePersonId();
  }
  return person.id;
}

/** 保存データ読込後に、採番カウンタを既存IDと衝突しない値まで進める。 */
export function syncNextPersonId(minNext) {
  const value = Math.floor(Number(minNext) || 0);
  if (value > nextPersonId) nextPersonId = value;
}

/** 保存用に現在の採番カウンタを返す。 */
export function peekNextPersonId() {
  return nextPersonId;
}

/** 人物IDとして妥当な値へ正規化する。不正値は null。 */
export function normalizePersonId(value) {
  const id = Math.floor(Number(value));
  return Number.isFinite(id) && id > 0 ? id : null;
}

const PERSON_POOL_KEYS = ["villagers", "visitors", "captives", "raidEnemies"];

/** 村の現役プール（村人・訪問者・捕虜・襲撃者・依頼中冒険者）からIDで人物を探す。 */
export function getPersonById(village, id) {
  const personId = normalizePersonId(id);
  if (!village || personId == null) return null;
  for (const key of PERSON_POOL_KEYS) {
    const pool = Array.isArray(village[key]) ? village[key] : [];
    const found = pool.find(person => person?.id === personId);
    if (found) return found;
  }
  const quests = Array.isArray(village.activeAdventurerQuests) ? village.activeAdventurerQuests : [];
  const quest = quests.find(entry => entry?.adventurer?.id === personId);
  return quest ? quest.adventurer : null;
}

/** 過去帳（離村・死亡者）も含めてIDで人物を探す。表示名の解決などに使う。 */
export function findPersonEverywhereById(village, id) {
  const personId = normalizePersonId(id);
  if (personId == null) return null;
  const active = getPersonById(village, personId);
  if (active) return active;
  const departed = Array.isArray(village?.departedVillagers) ? village.departedVillagers : [];
  return departed.find(person => person?.id === personId) || null;
}
