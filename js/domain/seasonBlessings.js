// seasonBlessings.js
// 妖精が生まれ持つ四風の加護。加護ごとに力の満ちる季節と、顔グラフィックの系統が決まる。

import { FAIRY_RACE } from "./speciesTraits.js";

export { FAIRY_RACE };

function fairyPortraits(first, last) {
  return Array.from({ length: last - first + 1 }, (_, index) => `FAIRY${first + index}.png`);
}

const SEASON_BLESSINGS = [
  { trait: "北風の加護", seasons: ["冬", "厳冬"], portraits: fairyPortraits(13, 16) },
  { trait: "西風の加護", seasons: ["春"], portraits: fairyPortraits(1, 4) },
  { trait: "南風の加護", seasons: ["夏", "冷夏"], portraits: fairyPortraits(5, 8) },
  { trait: "東風の加護", seasons: ["秋"], portraits: fairyPortraits(9, 12) }
];

export const SEASON_BLESSING_TRAITS = SEASON_BLESSINGS.map(blessing => blessing.trait);
// 加護の季節には魔力が増し、毎月体力・メンタル・村の魔素が満ちる。
export const SEASON_BLESSING_MAG_RATE = 1.5;
export const SEASON_BLESSING_MONTHLY_RECOVERY = 10;

function findBlessing(person) {
  const bodyTraits = Array.isArray(person?.bodyTraits) ? person.bodyTraits : [];
  return SEASON_BLESSINGS.find(blessing => bodyTraits.includes(blessing.trait)) || null;
}

/** 加護の季節が、いまの村の季節に当たっているか。 */
export function isSeasonBlessingActive(person, villageTraits) {
  const blessing = findBlessing(person);
  if (!blessing || !Array.isArray(villageTraits)) return false;
  return blessing.seasons.some(season => villageTraits.includes(season));
}

/**
 * 四風の加護のどれか1つと、その加護に合う顔グラフィックを与える。
 * 既に加護を持つ場合は、その加護に合う顔だけを選び直す。
 */
export function applyFairyBlessing(person) {
  if (!Array.isArray(person.bodyTraits)) person.bodyTraits = [];
  let blessing = findBlessing(person);
  if (!blessing) {
    blessing = SEASON_BLESSINGS[Math.floor(Math.random() * SEASON_BLESSINGS.length)];
    person.bodyTraits.push(blessing.trait);
  }
  person.portraitFile = blessing.portraits[Math.floor(Math.random() * blessing.portraits.length)];
}

// 能力計算は村を受け取らないため、加護の判定に使う季節をここで持つ。
// 季節が変わる所（月初・常春・読込）で js/domain/statLayers.js の syncSeasonBlessingStats から更新する。
let blessingSeasonTraits = ["春"];

export function setBlessingSeasonTraits(villageTraits) {
  blessingSeasonTraits = Array.isArray(villageTraits) ? [...villageTraits] : [];
}

/** いまの季節で、その人の加護の力が満ちているか。 */
export function isSeasonBlessingInEffect(person) {
  return isSeasonBlessingActive(person, blessingSeasonTraits);
}

export function hasSeasonBlessing(person) {
  return findBlessing(person) !== null;
}

/** 加護を from にそろえる。子と、その子が育った後の体で加護が食い違わないようにする。 */
export function copySeasonBlessing(from, to) {
  const blessing = findBlessing(from);
  if (!blessing || !Array.isArray(to?.bodyTraits)) return;
  to.bodyTraits = to.bodyTraits.filter(trait => !SEASON_BLESSING_TRAITS.includes(trait));
  to.bodyTraits.push(blessing.trait);
}
