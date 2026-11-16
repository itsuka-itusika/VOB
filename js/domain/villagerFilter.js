// 村人一覧の絞り込み条件。村人一覧と、奇跡・秘宝の対象の絞り込み画面で同じ基準を使う。

import { hasLoverRelationship, hasSpouseRelationship } from "../relationships.js";
import { getPersonMark } from "../personMarks.js";
import { PERSON_MARKS } from "../data/personMarkData.js";
import { getActionDisplayName } from "./jobTables.js";
import { IMPAIRING_TRAITS, INCAPACITATING_TRAITS } from "./traitEmphasis.js";

// 傷病は、赤と青で強調している状態異常をまとめて拾う。
const AILMENT_FILTER_TRAITS = new Set([...INCAPACITATING_TRAITS, ...IMPAIRING_TRAITS]);

// マークの絞り込みで「マークあり」を表す値。個別のマークは記号そのものを値にする。
export const MARK_FILTER_ANY = "any";

function hasAilmentTrait(person) {
  const traits = [...(person?.bodyTraits || []), ...(person?.mindTraits || [])];
  return traits.some(trait => AILMENT_FILTER_TRAITS.has(trait));
}

/** 自由入力の特性検索。肉体特性と精神特性のどれかに含まれれば拾う。 */
function matchesTraitQuery(person, query) {
  const traits = [...(person?.bodyTraits || []), ...(person?.mindTraits || [])];
  return traits.some(trait => String(trait).includes(query));
}

export function getVillagerJobLabel(person) {
  return getActionDisplayName(person?.action) || "なし";
}

function matchesMarkFilter(person, markFilter) {
  const mark = getPersonMark(person);
  if (markFilter === MARK_FILTER_ANY) return Boolean(mark);
  return mark === markFilter;
}

/** 今いる人物に付いているマークを、選択画面と同じ並びで返す。 */
export function getPresentPersonMarks(people) {
  const present = new Set(people.map(getPersonMark).filter(Boolean));
  return PERSON_MARKS.filter(mark => present.has(mark));
}

/**
 * criteria の空の項目は条件にしない。
 * { bodySex, spiritSex, race, job, traitQuery, mark, ailment, lover, married }
 */
export function matchesVillagerFilter(person, criteria) {
  const { bodySex, spiritSex, race, job, traitQuery, mark, ailment, lover, married } = criteria;
  if (bodySex && person.bodySex !== bodySex) return false;
  if (spiritSex && person.spiritSex !== spiritSex) return false;
  if (race && (person.race || "人間") !== race) return false;
  if (job && getVillagerJobLabel(person) !== job) return false;
  if (traitQuery && !matchesTraitQuery(person, traitQuery)) return false;
  if (mark && !matchesMarkFilter(person, mark)) return false;
  if (ailment && !hasAilmentTrait(person)) return false;
  if (lover && !hasLoverRelationship(person)) return false;
  if (married && !hasSpouseRelationship(person)) return false;
  return true;
}
