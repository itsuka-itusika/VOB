import { Villager } from "./classes.js";
import { randChoice, randInt, clampValue, randFloat } from "./util.js";
import { getPortraitSpriteHtml } from "./data/portraitAtlas.js";
import {
  generateRandomName,
  registerUsedName,
  isNameReserved,
  createRandomVillager,
  assignBodyMindTraits,
  assignHobby,
  determineSpeechType,
  selectPortraitByCharacter
} from "./createVillagers.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { addNonHousePopLimitBonus } from "./domain/buildingState.js";
import {
  ALSEID_PORTRAIT_FILES,
  ARACHNID_PORTRAIT_FILES,
  BABY_FEMALE_PORTRAIT_KEY,
  BABY_MALE_PORTRAIT_KEY,
  CENTAUR_PORTRAIT_FILES,
  CYCLOPS_PORTRAIT_FILES,
  DRYAD_PORTRAIT_FILES,
  EQUINA_PORTRAIT_FILES,
  GOBLIN_PORTRAIT_FILES,
  HARPY_PORTRAIT_FILES,
  MAENAD_PORTRAIT_FILES,
  NEREID_PORTRAIT_FILES,
  SATYR_PORTRAIT_FILES,
  WOLF_PUP_PORTRAIT_KEY,
  WINGED_PORTRAIT_FILES
} from "./data/portraitPaths.js";
import { getRaiderTypeByType } from "./data/raidData.js";
import { getBaseStat, setBaseStat, setBaseStatsFromEffective, syncEffectiveStats } from "./domain/statLayers.js";
import { IMMATURE_MIND_TRAIT, OLD_WOLF_TRAIT, syncWolfSpeciesTraits, WILD_MIND_TRAIT, YOUNG_WOLF_TRAIT } from "./domain/speciesTraits.js";
import { getRaiderSpeechType } from "./domain/raiderSpeechTypes.js";
import { recordAdulthoodHistory, recordBirthHistory, recordPregnancyHistory } from "./history.js";
import { addRelationship, checkHasRelationship, getRelationshipTargetName, normalizeRelationship } from "./relationships.js";
import { getDialogueLine } from "./dialogue/dialogueEngine.js";
import { isSaltPillar } from "./domain/apocalypseRules.js";

const HUMANOID_RACES = new Set(["人間", "ゴブリン", "ハーピー", "半神", "キュクロプス", "翼人", "アルセイド", "ネレイド", "ドライアド", "アラクニド", "エクイナ", "サテュロス", "メナド", "セントール"]);
const FEMALE_FIXED_RACES = new Set(["ハーピー", "翼人", "アルセイド", "ネレイド", "ドライアド", "アラクニド", "エクイナ", "メナド"]);
const LONG_LIVED_RACES = new Set(["ドライアド", "ネレイド", "アルセイド", "翼人"]);
const RACE_BODY_TRAITS = {
  "翼人": ["飛行", "光輪"],
  "アルセイド": ["緑の指", "不老"],
  "ネレイド": ["水中呼吸", "不老"],
  "ドライアド": ["緑の指", "光合成"],
  "アラクニド": ["糸吐き"],
  "キュクロプス": ["巨人", "単眼"],
  "ハーピー": ["飛行", "澄んだ声"],
  "エクイナ": ["健脚"],
  "サテュロス": ["山羊角", "通る声"],
  "メナド": ["山羊角", "澄んだ声"],
  "セントール": ["半人半馬"]
};
const CHILD_ADULT_PORTRAITS_BY_RACE = new Map([
  ["ゴブリン", GOBLIN_PORTRAIT_FILES],
  ["ハーピー", HARPY_PORTRAIT_FILES],
  ["キュクロプス", CYCLOPS_PORTRAIT_FILES],
  ["翼人", WINGED_PORTRAIT_FILES],
  ["アルセイド", ALSEID_PORTRAIT_FILES],
  ["ネレイド", NEREID_PORTRAIT_FILES],
  ["ドライアド", DRYAD_PORTRAIT_FILES],
  ["アラクニド", ARACHNID_PORTRAIT_FILES],
  ["エクイナ", EQUINA_PORTRAIT_FILES],
  ["サテュロス", SATYR_PORTRAIT_FILES],
  ["メナド", MAENAD_PORTRAIT_FILES],
  ["セントール", CENTAUR_PORTRAIT_FILES],
  ["狼", Array.from({ length: 6 }, (_, index) => `WOLF${index + 1}.png`)]
]);
const PHYSICAL_STATS = ["str", "vit", "dex", "mag", "chr"];
const MENTAL_STATS = ["int", "ind", "eth", "cou", "sexdr"];
const CHILD_BODY_TRAITS = ["赤子", "幼児", "少年", "少女"];
const CHILD_MIND_TRAITS = ["無垢", "萌芽", "思春期"];
const PREGNANCY_FULL_TERM_MONTHS = 10;
const POSTPARTUM_MONTHS = 3;
const THUNDER_BLESSING_TRAIT = "雷霆の加護";
const HOLY_SPIRIT_BLESSING_TRAIT = "聖霊の加護";
const GOLDEN_RAIN_PREGNANCY_KIND = "goldenRain";
const ANNUNCIATION_PREGNANCY_KIND = "annunciationPainting";
const GENETIC_EXCLUDED_BODY_TRAITS = new Set([
  "火星の加護",
  "飢餓",
  "凍え",
  "疲労",
  "過労",
  "疫病",
  "産褥",
  "中年",
  "老人",
  YOUNG_WOLF_TRAIT,
  OLD_WOLF_TRAIT
]);
const VIRTUAL_THUNDER_FATHER = {
  name: "不明",
  bodyOwner: "不明",
  race: "半神",
  bodySex: "男",
  bodyTraits: [],
  str: 30,
  vit: 30,
  dex: 30,
  mag: 30,
  chr: 30,
  int: 30,
  ind: 30,
  eth: 30,
  cou: 30,
  sexdr: 40
};
const VIRTUAL_ANNUNCIATION_FATHER = {
  name: "不明",
  bodyOwner: "不明",
  race: "人間",
  bodySex: "男",
  bodyTraits: [],
  str: 30,
  vit: 30,
  dex: 30,
  mag: 30,
  chr: 30,
  int: 30,
  ind: 30,
  eth: 40,
  cou: 30,
  sexdr: 20
};

function hasTrait(person, trait) {
  return Array.isArray(person?.bodyTraits) && person.bodyTraits.includes(trait);
}

function hasMindTrait(person, trait) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.includes(trait);
}

function addUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function removeTraits(list, traits) {
  return Array.isArray(list) ? list.filter(trait => !traits.includes(trait)) : [];
}

function isHumanoid(person) {
  return HUMANOID_RACES.has(normalizeChildRace(person?.race));
}

function normalizeChildRace(race) {
  if (race === "サイクロプス" || race === "巨人") return "キュクロプス";
  return race || "人間";
}

function isFemaleFixedRace(race) {
  return FEMALE_FIXED_RACES.has(normalizeChildRace(race));
}

function isLongLivedRace(race) {
  return LONG_LIVED_RACES.has(normalizeChildRace(race));
}

function snapshotParent(person) {
  const snap = {
    name: person.name,
    bodyOwner: person.bodyOwner || person.name,
    race: person.race || "人間",
    bodySex: person.bodySex,
    bodyTraits: Array.isArray(person.bodyTraits)
      ? person.bodyTraits.filter(trait => !GENETIC_EXCLUDED_BODY_TRAITS.has(trait))
      : []
  };
  [...PHYSICAL_STATS, ...MENTAL_STATS].forEach(stat => {
    snap[stat] = getBaseStat(person, stat) || 1;
  });
  return snap;
}

function snapshotHasBodyTrait(snapshot, trait) {
  return Array.isArray(snapshot?.bodyTraits) && snapshot.bodyTraits.includes(trait);
}

function rollInheritedTraits(data) {
  const mother = data.motherSnapshot;
  const father = data.fatherSnapshot;
  const inherited = [];
  const addIfRolled = (trait) => {
    if (Math.random() < 0.3) inherited.push(trait);
  };

  ["緑の指", "夜目", "澄んだ声", "通る声"].forEach(trait => {
    if (snapshotHasBodyTrait(mother, trait) || snapshotHasBodyTrait(father, trait)) {
      addIfRolled(trait);
    }
  });

  if (data.childSex === "女") {
    ["大地の巫女", "月の巫女", "太陽の巫女", "梟の巫女", "聖女の輝き"].forEach(trait => {
      if (snapshotHasBodyTrait(mother, trait)) {
        addIfRolled(trait);
      }
    });
  } else {
    [
      ["大地の巫女", "大地の加護"],
      ["月の巫女", "月の加護"],
      ["太陽の巫女", "太陽の加護"],
      ["梟の巫女", "梟の加護"]
    ].forEach(([motherTrait, childTrait]) => {
      if (snapshotHasBodyTrait(mother, motherTrait)) {
        addIfRolled(childTrait);
      }
    });
  }

  return inherited;
}

function applyInheritedBodyTraits(child, traits) {
  traits.forEach(trait => addUnique(child.bodyTraits, trait));
  syncEffectiveStats(child);
}

function applyInheritedMindTraits(child, traits) {
  traits.forEach(trait => addUnique(child.mindTraits, trait));
  syncEffectiveStats(child);
}

function applyRaceBodyTraits(character) {
  (RACE_BODY_TRAITS[normalizeChildRace(character?.race)] || [])
    .forEach(trait => addUnique(character.bodyTraits, trait));
  syncWolfSpeciesTraits(character);
  syncEffectiveStats(character);
}

function selectAdultPortraitForChild(child, adult) {
  const portraits = CHILD_ADULT_PORTRAITS_BY_RACE.get(normalizeChildRace(child?.race));
  return Array.isArray(portraits) && portraits.length > 0
    ? randChoice(portraits)
    : selectPortraitByCharacter(adult);
}

function hasOwnChildInVillage(village, parent) {
  if (!Array.isArray(parent?.relationships)) return false;
  return parent.relationships.some(rel => normalizeRelationship(rel).startsWith("【家族関係】子："));
}

function getSpouse(person, village) {
  const spouseName = getRelationshipTargetName(person, "夫") || getRelationshipTargetName(person, "妻");
  if (!spouseName) return null;
  return village.villagers.find(candidate => candidate.name === spouseName) || null;
}

function getBuddingStatusLine(character) {
  const maleLines = ["えへへ、きょうもあそぶ？", "ねえねえ、あれなあに？", "ぼく、ちょっとできるよ！", "おそと、いきたいな。"];
  const femaleLines = ["えへへ、きょうもあそぶ？", "ねえねえ、あれなあに？", "わたしもおてつだいする！", "おそと、いきたいな。"];
  return randChoice(character?.spiritSex === "女" ? femaleLines : maleLines);
}

function isPregnancyAge(person, maxAge) {
  const age = Number(person?.bodyAge) || 0;
  return age >= 16 && (isLongLivedRace(person?.race) || age <= maxAge);
}

function canBeMother(person, village) {
  return isHumanoid(person) &&
    !isSaltPillar(person) &&
    person.bodySex === "女" &&
    isPregnancyAge(person, 38) &&
    !hasMindTrait(person, "神聖") &&
    checkHasRelationship(person, "既婚") &&
    !person.pregnancy &&
    !hasTrait(person, "妊娠") &&
    !hasTrait(person, "臨月") &&
    !hasTrait(person, "産褥") &&
    !hasOwnChildInVillage(village, person);
}

function canBeFather(person) {
  return isHumanoid(person) &&
    !isSaltPillar(person) &&
    person.bodySex === "男" &&
    Number(person.bodyAge) >= 12;
}

function canReceiveMysticPregnancy(person) {
  return !isSaltPillar(person) &&
    person.bodySex === "女" &&
    !person.pregnancy &&
    !hasTrait(person, "妊娠") &&
    !hasTrait(person, "臨月") &&
    !hasTrait(person, "産褥");
}

export function canReceiveGoldenRainPregnancy(person) {
  return isHumanoid(person) && canReceiveMysticPregnancy(person) && isPregnancyAge(person, 29);
}

function canReceiveAnnunciationPregnancy(person) {
  return isHumanoid(person) && canReceiveMysticPregnancy(person);
}

// 神秘の妊娠の予約は肉体に紐づく。肉体交換が起きた場合は、その身体を得た人物へ移る。
function getBodyIdentity(person) {
  return person?.bodyOwner || person?.name || "";
}

function matchesPendingMysticTarget(entry, person) {
  // targetName は肉体紐づけ以前の保存データ向けの読み替え。
  const target = entry?.targetBodyOwner || entry?.targetName;
  return !!target && target === getBodyIdentity(person);
}

function hasPendingMysticPregnancy(village, person) {
  return Array.isArray(village?.pendingGoldenRainPregnancies) &&
    village.pendingGoldenRainPregnancies.some(entry => matchesPendingMysticTarget(entry, person));
}

export function canUseAnnunciationPaintingOn(person, village) {
  if (!canReceiveAnnunciationPregnancy(person) || hasPendingMysticPregnancy(village, person)) return false;
  const age = Number(person.bodyAge) || 0;
  return age >= 16;
}

function getNextMonthDate(village) {
  const month = Number(village.month) || 1;
  const year = Number(village.year) || 1;
  return month >= 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function isDue(village, due) {
  const year = Number(village.year) || 0;
  const month = Number(village.month) || 0;
  return year > due.year || (year === due.year && month >= due.month);
}

export function scheduleGoldenRainPregnancy(village, mother) {
  if (!village || !mother || !canReceiveGoldenRainPregnancy(mother) || hasPendingMysticPregnancy(village, mother)) return false;
  if (!Array.isArray(village.pendingGoldenRainPregnancies)) {
    village.pendingGoldenRainPregnancies = [];
  }
  const due = getNextMonthDate(village);
  village.pendingGoldenRainPregnancies.push({
    targetBodyOwner: getBodyIdentity(mother),
    dueYear: due.year,
    dueMonth: due.month,
    kind: GOLDEN_RAIN_PREGNANCY_KIND
  });
  village.log(`${mother.name}は黄金の雨を浴びました。来月、神秘の妊娠が訪れるかもしれません。`);
  return true;
}

export function scheduleAnnunciationPaintingPregnancy(village, mother) {
  if (!village || !mother || !canUseAnnunciationPaintingOn(mother, village)) return false;
  if (!Array.isArray(village.pendingGoldenRainPregnancies)) {
    village.pendingGoldenRainPregnancies = [];
  }
  const due = getNextMonthDate(village);
  village.pendingGoldenRainPregnancies.push({
    targetBodyOwner: getBodyIdentity(mother),
    dueYear: due.year,
    dueMonth: due.month,
    kind: ANNUNCIATION_PREGNANCY_KIND
  });
  village.log(`【秘宝】${mother.name}は告天使の絵画から降り注ぐ光を受けました。翌月、神秘の妊娠が訪れます。`);
  return true;
}

function decideChildSex() {
  return Math.random() < 0.5 ? "男" : "女";
}

function decideChildRace(childSex, motherSnapshot, fatherSnapshot, explicitRace = null) {
  if (explicitRace) return normalizeChildRace(explicitRace);
  const motherRace = normalizeChildRace(motherSnapshot?.race);
  if (motherRace === "エクイナ") {
    return childSex === "男" ? "セントール" : "エクイナ";
  }
  if (motherRace === "メナド") {
    return childSex === "男" ? "サテュロス" : "メナド";
  }
  if (childSex === "男" && isFemaleFixedRace(motherSnapshot?.race)) {
    return "人間";
  }
  return motherRace;
}

function decidePregnancyChildRace(childSex, motherSnapshot, fatherSnapshot, options = {}) {
  const raceFatherSnapshot = options.childRaceFatherSnapshot || fatherSnapshot;
  const childRace = decideChildRace(childSex, motherSnapshot, raceFatherSnapshot, options.childRace);
  if (options.humanChildRace && childRace === "人間") {
    return normalizeChildRace(options.humanChildRace);
  }
  return childRace;
}

function inheritStat(mother, father, stat, variance) {
  const base = ((Number(mother[stat]) || 1) + (Number(father[stat]) || 1)) / 2;
  return Math.max(1, Math.round(base * randFloat(1 - variance, 1 + variance)));
}

function buildPotentialStats(motherSnapshot, fatherSnapshot, childSex, race) {
  const stats = {};
  PHYSICAL_STATS.forEach(stat => {
    stats[stat] = inheritStat(motherSnapshot, fatherSnapshot, stat, 0.2);
  });
  MENTAL_STATS.forEach(stat => {
    stats[stat] = inheritStat(motherSnapshot, fatherSnapshot, stat, 0.4);
  });

  if (childSex === "男") {
    stats.str = Math.round(stats.str * 1.12);
    stats.vit = Math.round(stats.vit * 1.12);
    stats.cou = Math.round(stats.cou * 1.12);
    stats.sexdr = Math.round(stats.sexdr * 1.12);
  } else {
    stats.mag = Math.round(stats.mag * 1.12);
    stats.chr = Math.round(stats.chr * 1.12);
    stats.eth = Math.round(stats.eth * 1.12);
  }

  if (race === "ハーピー") {
    stats.dex = Math.max(1, Math.round(stats.dex * 0.55));
  }

  [...PHYSICAL_STATS, ...MENTAL_STATS].forEach(stat => {
    stats[stat] = clampValue(stats[stat], 1, 60);
  });
  return stats;
}

function getGrowthRatio(age, stat) {
  const a = clampValue(Number(age) || 0, 0, 16);
  if (stat === "mag" || stat === "chr") {
    return 0.6 + 0.4 * (a / 16);
  }
  if (["dex", "eth", "cou"].includes(stat)) {
    if (a < 4) return 0.1;
    if (a <= 9) return 0.1 + (0.5 * ((a - 4) / 5));
    return 0.6 + (0.4 * ((a - 9) / 7));
  }
  if (a <= 9) {
    return 0.1 + (0.2 * (a / 9));
  }
  return 0.3 + (0.7 * ((a - 9) / 7));
}

function applyGrowthStats(child) {
  const bodyPotential = child.bodyPotentialStats !== undefined ? child.bodyPotentialStats : child.potentialStats;
  const mindPotential = child.mindPotentialStats !== undefined ? child.mindPotentialStats : child.potentialStats;
  if (!bodyPotential && !mindPotential) return;
  const bodyAge = Number(child.bodyAge) || 0;
  const spiritAge = Number(child.spiritAge) || 0;
  const shouldApplyPhysicalGrowth = bodyAge <= 16 || !child.adultBodyReached;
  const shouldApplyMentalGrowth = spiritAge <= 16 || !child.adultMindReached;

  if (bodyPotential && shouldApplyPhysicalGrowth) {
    PHYSICAL_STATS.forEach(stat => {
      setBaseStat(child, stat, Math.max(1, Math.round(bodyPotential[stat] * getGrowthRatio(bodyAge, stat))), { sync: false });
    });
    if (bodyAge >= 16) child.adultBodyReached = true;
  }
  if (mindPotential && shouldApplyMentalGrowth) {
    MENTAL_STATS.forEach(stat => {
      setBaseStat(child, stat, Math.max(1, Math.round(mindPotential[stat] * getGrowthRatio(spiritAge, stat))), { sync: false });
    });
    if (spiritAge >= 16) child.adultMindReached = true;
  }
  syncEffectiveStats(child);
}

function buildAdultTemplate(child, potentialStats) {
  const adult = new Villager(child.name, child.bodySex, 16);
  adult.race = child.race;
  Object.assign(adult, potentialStats);
  setBaseStatsFromEffective(adult);
  adult.spiritAge = 16;
  adult.spiritSex = child.spiritSex;
  assignBodyMindTraits(adult);
  adult.bodyTraits = removeTraits(adult.bodyTraits, ["中年", "老人"]);
  adult.mindTraits = removeTraits(adult.mindTraits, CHILD_MIND_TRAITS);
  applyRaceBodyTraits(adult);
  assignHobby(adult);
  adult.portraitFile = selectAdultPortraitForChild(child, adult);
  return adult;
}

function chooseChildMindTrait(child) {
  const s = child;
  const defs = [
    { name: "純真", condition: () => s.eth >= 14 && s.sexdr <= 8 },
    { name: "ませてる", condition: () => s.chr >= 14 && s.sexdr >= 12 },
    { name: "悪ガキ", condition: () => s.spiritSex === "男" && s.eth <= 8 && s.cou >= 12 },
    { name: "悪戯っ子", condition: () => s.dex >= 13 && s.cou >= 11 },
    { name: "優等生", condition: () => s.int >= 14 && s.ind >= 13 && s.eth >= 12 },
    { name: "大人しい", condition: () => s.cou <= 8 && s.eth >= 11 },
    { name: "目立たない", condition: () => s.chr <= 8 && s.cou <= 10 },
    { name: "ガキ大将", condition: () => s.spiritSex === "男" && s.str >= 13 && s.cou >= 14 },
    { name: "麒麟児", condition: () => s.int >= 16 && s.mag >= 15 },
    { name: "ヤンチャ", condition: () => s.cou >= 13 && s.ind <= 10 },
    { name: "問題児", condition: () => s.eth <= 8 && s.ind <= 9 },
    { name: "野生児", condition: () => s.vit >= 14 && s.int <= 9 },
    { name: "メスガキ", condition: () => s.spiritSex === "女" && s.cou >= 13 && s.eth <= 11 },
    { name: "静か", condition: () => s.chr <= 10 && s.cou <= 9 },
    { name: "マイペース", condition: () => s.ind <= 9 && s.eth >= 10 },
    { name: "まじめ", condition: () => s.ind >= 13 && s.eth >= 12 },
    { name: "地味", condition: () => s.chr <= 9 && s.dex <= 11 },
    { name: "堅実", condition: () => s.ind >= 13 && s.cou <= 11 },
    { name: "甘えん坊", condition: () => s.cou <= 9 && s.chr >= 11 },
    { name: "さみしがり", condition: () => s.cou <= 8 && s.eth >= 10 },
    { name: "天真爛漫", condition: () => s.chr >= 13 && s.cou >= 12 && s.eth >= 10 },
    { name: "無邪気", condition: () => s.eth >= 12 && s.int <= 11 },
    { name: "人懐っこい", condition: () => s.chr >= 13 && s.eth >= 10 },
    { name: "お調子者", condition: () => s.chr >= 12 && s.ind <= 10 },
    { name: "ムードメーカー", condition: () => s.chr >= 14 && s.cou >= 12 },
    { name: "にぎやか", condition: () => s.chr >= 12 && s.cou >= 12 },
    { name: "おしゃべり", condition: () => s.chr >= 12 && s.dex >= 11 },
    { name: "人見知り", condition: () => s.cou <= 8 && s.chr <= 12 },
    { name: "臆病", condition: () => s.cou <= 7 },
    { name: "怖がり", condition: () => s.cou <= 8 && s.eth <= 12 },
    { name: "泣き虫", condition: () => s.cou <= 7 && s.chr >= 10 },
    { name: "控えめ", condition: () => s.chr <= 11 && s.eth >= 12 },
    { name: "奥手", condition: () => s.sexdr <= 7 && s.chr >= 10 },
    { name: "無口", condition: () => s.chr <= 8 },
    { name: "目ざとい", condition: () => s.dex >= 13 && s.int >= 11 },
    { name: "物知り", condition: () => s.int >= 14 },
    { name: "しっかり者", condition: () => s.ind >= 14 && s.eth >= 12 },
    { name: "わがまま", condition: () => s.ind <= 8 && s.chr >= 12 },
    { name: "好奇心旺盛", condition: () => s.int >= 12 && s.cou >= 12 },
    { name: "神童", condition: () => s.int >= 16 && s.ind >= 14 }
  ];
  const candidates = defs.filter(def => def.condition()).map(def => def.name);
  return candidates.length > 0 ? randChoice(candidates) : "無邪気";
}

function setChildPortrait(child) {
  if (child.race === "狼") {
    child.portraitFile = child.bodyAge === 0
      ? WOLF_PUP_PORTRAIT_KEY
      : (child.adultPortraitFile || "WOLF1.png");
    return;
  }

  if (child.bodyAge <= 3) {
    child.portraitFile = child.bodySex === "男" ? BABY_MALE_PORTRAIT_KEY : BABY_FEMALE_PORTRAIT_KEY;
  } else if (child.adultPortraitFile) {
    child.portraitFile = child.adultPortraitFile;
  }
}

export function createWolfFoundling(village) {
  const sex = Math.random() < 0.5 ? "男" : "女";
  const wolfType = getRaiderTypeByType("狼");
  const child = createRandomVillager({
    sex,
    minAge: 0,
    maxAge: 0,
    existingNames: village.villagers.map(person => person.name),
    params: {
      ...wolfType.params,
      race: wolfType.race
    },
    ranges: wolfType.ranges
  });
  child.spiritAge = 0;
  child.spiritSex = sex;
  const exclusiveMindTrait = child.mindTraits[0];
  child.bodyTraits = [randChoice(wolfType.bodyTraits), ...wolfType.forcedBodyTraits, YOUNG_WOLF_TRAIT];
  child.mindTraits = [exclusiveMindTrait, WILD_MIND_TRAIT, IMMATURE_MIND_TRAIT].filter(Boolean);
  child.hobby = randChoice(wolfType.hobbies);
  child.speechType = getRaiderSpeechType(wolfType.type);
  child.portraitFile = WOLF_PUP_PORTRAIT_KEY;
  child.adultPortraitFile = randChoice(wolfType.portraits);
  syncWolfSpeciesTraits(child, { includeWildMindTrait: true });
  syncEffectiveStats(child);
  updateChildGrowthStage(child, village);
  return child;
}

export function updateChildGrowthStage(child, village, { announce = false } = {}) {
  const bodyPotential = child.bodyPotentialStats !== undefined ? child.bodyPotentialStats : child.potentialStats;
  const mindPotential = child.mindPotentialStats !== undefined ? child.mindPotentialStats : child.potentialStats;
  if (!child.potentialStats && !bodyPotential && !mindPotential) {
    if (child.race === "狼") {
      syncWolfSpeciesTraits(child);
      syncEffectiveStats(child);
      setChildPortrait(child);
      refreshJobTable(child, village);
    }
    return;
  }

  applyGrowthStats(child);

  if (child.bodyAge <= 3) {
    child.bodyTraits = removeTraits(child.bodyTraits, CHILD_BODY_TRAITS);
    addUnique(child.bodyTraits, "赤子");
  } else if (child.bodyAge <= 9) {
    child.bodyTraits = removeTraits(child.bodyTraits, ["赤子", "少年", "少女"]);
    addUnique(child.bodyTraits, "幼児");
  } else if (child.bodyAge <= 15) {
    child.bodyTraits = removeTraits(child.bodyTraits, ["赤子", "幼児"]);
    addUnique(child.bodyTraits, child.bodySex === "男" ? "少年" : "少女");
  } else {
    const currentBodyTraits = removeTraits(child.bodyTraits, CHILD_BODY_TRAITS);
    child.bodyTraits = [...new Set([...(child.adultBodyTraits || []), ...currentBodyTraits])];
  }

  if (child.spiritAge <= 3) {
    child.mindTraits = removeTraits(child.mindTraits, CHILD_MIND_TRAITS);
    addUnique(child.mindTraits, "無垢");
    child.hobby = "";
  } else if (child.spiritAge <= 9) {
    child.mindTraits = removeTraits(child.mindTraits, ["無垢", "思春期"]);
    addUnique(child.mindTraits, "萌芽");
    if (!child.childMindTrait) {
      child.childMindTrait = chooseChildMindTrait(child);
    }
    addUnique(child.mindTraits, child.childMindTrait);
    child.hobby = "";
  } else if (child.spiritAge <= 15) {
    child.mindTraits = removeTraits(child.mindTraits, ["無垢", "萌芽"]);
    addUnique(child.mindTraits, "思春期");
    child.hobby = "";
  } else {
    const childTraitsToRemove = [...CHILD_MIND_TRAITS];
    if (child.childMindTrait) childTraitsToRemove.push(child.childMindTrait);
    const currentMindTraits = removeTraits(child.mindTraits, childTraitsToRemove);
    child.mindTraits = [...new Set([...(child.adultMindTraits || []), ...currentMindTraits])];
    child.hobby = child.adultHobby || child.hobby || "";
  }

  child.speechType = determineSpeechType(child);
  syncWolfSpeciesTraits(child);
  syncEffectiveStats(child);
  setChildPortrait(child);
  refreshJobTable(child, village);

  if (announce) {
    if (child.bodyAge === 4 || child.spiritAge === 4) {
      village.log(`${child.name}は幼児期に入りました`);
    } else if (child.bodyAge === 10 || child.spiritAge === 10) {
      village.log(`${child.name}は少年期に入りました`);
    } else if (child.bodyAge === 16 || child.spiritAge === 16) {
      village.log(`${child.name}は成人しました`);
    }
    if (child.spiritAge === 16 && !child.adultModalShown) {
      recordAdulthoodHistory(village, child);
      child.adultModalShown = true;
      showAdultModal(village, child);
    }
  }
}

export function matureBodyToAdultOnly(character, village) {
  if (!character || Number(character.bodyAge) >= 16) return false;

  character.bodyAge = 16;

  const bodyPotential = character.bodyPotentialStats !== undefined
    ? character.bodyPotentialStats
    : character.potentialStats;
  if (bodyPotential) {
    PHYSICAL_STATS.forEach(stat => {
      setBaseStat(character, stat, Math.max(1, Math.round(bodyPotential[stat] * getGrowthRatio(16, stat))), { sync: false });
    });
  }
  character.adultBodyReached = true;
  syncEffectiveStats(character);

  const currentBodyTraits = removeTraits(character.bodyTraits, CHILD_BODY_TRAITS);
  character.bodyTraits = [...new Set([...(character.adultBodyTraits || []), ...currentBodyTraits])];
  syncWolfSpeciesTraits(character);
  syncEffectiveStats(character);

  if (!character.adultPortraitFile) {
    character.adultPortraitFile = selectPortraitByCharacter(character);
  }
  setChildPortrait(character);
  refreshJobTable(character, village);
  return true;
}

export function handleBirthAndPostpartum(village) {
  village.villagers.forEach(person => {
    if (isSaltPillar(person)) return;
    if (Number(person.postpartumMonths) > 0) {
      person.postpartumMonths -= 1;
      if (person.postpartumMonths <= 0 && hasTrait(person, "産褥")) {
        person.bodyTraits = person.bodyTraits.filter(trait => trait !== "産褥");
        syncEffectiveStats(person);
        village.log(`${person.name}は産褥から回復しました`);
      }
    }
  });

  const mothers = [...village.villagers];
  mothers.forEach(mother => {
    if (!mother.pregnancy) return;
    if (isSaltPillar(mother)) return;

    mother.pregnancy.months = (Number(mother.pregnancy.months) || 0) + 1;
    if (mother.pregnancy.months >= 8) {
      const wasFullTerm = hasTrait(mother, "臨月");
      mother.bodyTraits = mother.bodyTraits.filter(trait => trait !== "妊娠");
      addUnique(mother.bodyTraits, "臨月");
      if (!mother.pregnancy.fullTermApplied) {
        syncEffectiveStats(mother);
        mother.pregnancy.fullTermApplied = true;
      }
      if (!wasFullTerm) {
        village.log(`${mother.name}は臨月に入りました`);
      }
    } else if (mother.pregnancy.months < 8) {
      addUnique(mother.bodyTraits, "妊娠");
    }

    if (mother.pregnancy.months >= PREGNANCY_FULL_TERM_MONTHS) {
      giveBirth(village, mother);
    }
  });
}

export function handlePregnancyChecks(village) {
  processPregnancyChecks(village);
}

export function handlePendingMysticPregnancies(village) {
  processPendingGoldenRainPregnancies(village);
}

export function handlePregnancyAndBirth(village) {
  handleBirthAndPostpartum(village);
  handlePendingMysticPregnancies(village);
  handlePregnancyChecks(village);
}

function processPregnancyChecks(village) {
  village.villagers.forEach(mother => {
    if (!canBeMother(mother, village)) return;
    const father = getSpouse(mother, village);
    if (!father || !canBeFather(father)) return;

    const baseChance = ((Number(mother.sexdr) || 0) / 30) * ((Number(father.sexdr) || 0) / 30);
    const chance = clampValue(baseChance * 0.5, 0.05, 0.5);
    if (Math.random() <= chance) {
      startPregnancy(village, mother, father);
    }
  });
}

function processPendingGoldenRainPregnancies(village) {
  if (!Array.isArray(village.pendingGoldenRainPregnancies)) {
    village.pendingGoldenRainPregnancies = [];
    return;
  }

  const remaining = [];
  village.pendingGoldenRainPregnancies.forEach(entry => {
    const isAnnunciation = entry?.kind === ANNUNCIATION_PREGNANCY_KIND;
    const due = { year: Number(entry.dueYear) || 0, month: Number(entry.dueMonth) || 0 };
    if (!isDue(village, due)) {
      remaining.push(entry);
      return;
    }

    const mother = village.villagers.find(person => matchesPendingMysticTarget(entry, person));
    // 対象が死亡・離脱していれば予約ごと消える。判定関数へ渡す前に外す。
    if (!mother) return;
    if (isSaltPillar(mother)) {
      remaining.push(entry);
      return;
    }
    const canReceive = isAnnunciation
      ? canReceiveAnnunciationPregnancy(mother)
      : canReceiveGoldenRainPregnancy(mother);
    if (!canReceive) {
      const sourceName = isAnnunciation ? "告天使の絵画の光" : "黄金の雨の兆し";
      village.log(`${mother.name}への${sourceName}は、妊娠には至りませんでした。`);
      return;
    }

    if (isAnnunciation) {
      startPregnancy(village, mother, null, {
        fatherSnapshot: VIRTUAL_ANNUNCIATION_FATHER,
        humanChildRace: "半神",
        inheritedMindTraits: [HOLY_SPIRIT_BLESSING_TRAIT],
        geneticFatherUnknown: true,
        source: "告天使の絵画"
      });
    } else {
      startPregnancy(village, mother, null, {
        fatherSnapshot: VIRTUAL_THUNDER_FATHER,
        childRaceFatherSnapshot: { race: "人間" },
        humanChildRace: "半神",
        inheritedBodyTraits: [THUNDER_BLESSING_TRAIT],
        geneticFatherUnknown: true,
        source: "黄金の雨"
      });
    }
  });

  village.pendingGoldenRainPregnancies = remaining;
}

function startPregnancy(village, mother, father, options = {}) {
  const motherSnapshot = snapshotParent(mother);
  const fatherSnapshot = options.fatherSnapshot || snapshotParent(father);
  const childSex = decideChildSex();
  const childRace = decidePregnancyChildRace(childSex, motherSnapshot, fatherSnapshot, options);
  const potentialStats = buildPotentialStats(motherSnapshot, fatherSnapshot, childSex, childRace);
  const inheritedBodyTraits = [
    ...rollInheritedTraits({ motherSnapshot, fatherSnapshot, childSex }),
    ...(Array.isArray(options.inheritedBodyTraits) ? options.inheritedBodyTraits : [])
  ];
  const inheritedMindTraits = Array.isArray(options.inheritedMindTraits)
    ? [...new Set(options.inheritedMindTraits)]
    : [];

  mother.pregnancy = {
    months: 0,
    motherName: mother.name,
    geneticFatherName: father?.name || null,
    geneticFatherUnknown: !!options.geneticFatherUnknown,
    motherSnapshot,
    fatherSnapshot,
    childRace,
    childSex,
    potentialStats,
    inheritedBodyTraits,
    inheritedMindTraits,
    fullTermApplied: false
  };
  addUnique(mother.bodyTraits, "妊娠");
  recordPregnancyHistory(village, mother, father, {
    geneticFatherUnknown: !!options.geneticFatherUnknown,
    source: options.source || (options.geneticFatherUnknown ? "神秘の妊娠" : "妊娠")
  });
  village.log(`${mother.name}が妊娠しました`);
  showPregnancyModal(village, mother, father);
}

function giveBirth(village, mother) {
  const data = mother.pregnancy;
  if (!data) return;

  // 命名が決まるまで村へは加えない。母側の出産処理も finalizeBirth へまとめる。
  const child = createNewbornChild(village, data);
  showBirthModal(village, mother, getSpouse(mother, village), child, childName => {
    finalizeBirth(village, mother, data, child, childName);
  });
}

/** 赤子を名前なしで生成する。名前と bodyOwner は命名確定時に入れる。 */
function createNewbornChild(village, data) {
  const child = new Villager("", data.childSex, 0);
  child.race = normalizeChildRace(data.childRace);
  child.spiritAge = 0;
  child.spiritSex = data.childSex;
  child.potentialStats = { ...data.potentialStats };
  child.bodyPotentialStats = { ...data.potentialStats };
  child.mindPotentialStats = { ...data.potentialStats };
  Object.assign(child, child.potentialStats);
  setBaseStatsFromEffective(child);
  child.bodyTraits = ["赤子"];
  child.mindTraits = ["無垢"];
  applyRaceBodyTraits(child);
  applyInheritedBodyTraits(child, data.inheritedBodyTraits || []);
  applyInheritedMindTraits(child, data.inheritedMindTraits || []);
  child.hobby = "";
  child.hp = 100;
  child.mp = 100;
  child.happiness = 50;

  const adult = buildAdultTemplate(child, child.potentialStats);
  child.adultBodyTraits = adult.bodyTraits;
  child.adultMindTraits = adult.mindTraits;
  child.adultHobby = adult.hobby;
  child.adultPortraitFile = adult.portraitFile;
  updateChildGrowthStage(child, village);
  return child;
}

/** 命名確定後の出産処理。ここで初めて子が村へ加わる。 */
function finalizeBirth(village, mother, data, child, childName) {
  child.name = childName;
  child.bodyOwner = childName;
  registerUsedName(childName);

  mother.bodyTraits = mother.bodyTraits.filter(trait => trait !== "妊娠" && trait !== "臨月");
  syncEffectiveStats(mother);

  const birthParentName = mother.name;
  addRelationship(child, `母:${birthParentName}`);
  addRelationship(mother, `子:${child.name}`);
  addRelationship(child, `遺伝母:${data.motherSnapshot?.bodyOwner || data.motherSnapshot?.name || "不明"}`);
  addRelationship(child, `遺伝父:${data.geneticFatherUnknown ? "不明" : (data.fatherSnapshot?.bodyOwner || data.fatherSnapshot?.name || "不明")}`);

  const spouse = getSpouse(mother, village);
  if (spouse) {
    const spouseParentPrefix = spouse.bodySex === "女" ? "母" : "父";
    addRelationship(child, `${spouseParentPrefix}:${spouse.name}`);
    addRelationship(spouse, `子:${child.name}`);
  }

  mother.happiness = clampValue(mother.happiness + 50, 0, 100);
  mother.hp = Math.floor(mother.hp * 0.25);
  addUnique(mother.bodyTraits, "産褥");
  mother.postpartumMonths = POSTPARTUM_MONTHS;
  syncEffectiveStats(mother);
  mother.action = "療養";
  mother.actionTable = ["療養"];

  if (spouse) {
    spouse.happiness = clampValue(spouse.happiness + 30, 0, 100);
  }

  mother.pregnancy = null;
  addNonHousePopLimitBonus(village, 1);
  village.villagers.push(child);
  recordBirthHistory(village, mother, child, {
    spouse,
    geneticFatherUnknown: !!data.geneticFatherUnknown
  });
  village.log(`${mother.name}が${child.name}を出産しました。人口上限+1`);
}

export function getReproductiveStatusLine(character) {
  if (hasTrait(character, "臨月")) {
    return getDialogueLine({ character, scene: "reproduction", key: "fullTermConversation" });
  }
  if (hasTrait(character, "妊娠")) {
    return getDialogueLine({ character, scene: "reproduction", key: "pregnantConversation" });
  }
  if (hasTrait(character, "産褥")) {
    return getDialogueLine({ character, scene: "reproduction", key: "postpartumConversation" });
  }
  if (hasMindTrait(character, "無垢") || hasMindTrait(character, "萌芽")) {
    return getDialogueLine({ character, scene: "status", key: "healthy" });
  }
  return null;
}

function getPregnancyNoticeLine(character, role, partner) {
  const key = role === "mother" ? "pregnancyNoticeParent" : "pregnancyNoticePartner";
  return getDialogueLine({
    character,
    scene: "reproduction",
    key,
    context: { partner }
  }) || "";
}

const reproductionModalQueue = [];
let isShowingReproductionModal = false;

function enqueueReproductionModal(renderModal) {
  if (typeof document === "undefined") return;
  reproductionModalQueue.push(renderModal);
  if (isShowingReproductionModal) return;
  showNextReproductionModal();
}

function showNextReproductionModal() {
  const renderModal = reproductionModalQueue.shift();
  if (!renderModal) {
    isShowingReproductionModal = false;
    return;
  }
  isShowingReproductionModal = true;
  renderModal(() => {
    isShowingReproductionModal = false;
    showNextReproductionModal();
  });
}

function closeQueuedReproductionModal(village, overlay, modal, onClosed) {
  overlay.remove();
  modal.remove();
  import("./ui.js").then(module => module.updateUI(village));
  onClosed();
}

function showPregnancyModal(village, mother, father) {
  enqueueReproductionModal(onClosed => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:560px;width:calc(100% - 32px);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
    modal.innerHTML = `
      <h2>妊娠</h2>
      <p>${mother.name}が妊娠しました。</p>
      ${renderPortraitLine(mother, getPregnancyNoticeLine(mother, "mother", father))}
      ${father ? renderPortraitLine(father, getPregnancyNoticeLine(father, "father", mother)) : ""}
      <button type="button" data-close-reproduction-modal>閉じる</button>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    modal.querySelector("[data-close-reproduction-modal]").onclick = () => {
      closeQueuedReproductionModal(village, overlay, modal, onClosed);
    };
  });
}

function getAdultLine(character) {
  return getDialogueLine({ character, scene: "reproduction", key: "adult" }) || "";
}

function showAdultModal(village, character) {
  enqueueReproductionModal(onClosed => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:560px;width:calc(100% - 32px);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
    modal.innerHTML = `
      <h2>成人</h2>
      <p>${character.name}が成人しました。</p>
      ${renderPortraitLine(character, getAdultLine(character))}
      <button type="button" data-close-reproduction-modal>閉じる</button>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    modal.querySelector("[data-close-reproduction-modal]").onclick = () => {
      closeQueuedReproductionModal(village, overlay, modal, onClosed);
    };
  });
}

function getBirthLine(character, role) {
  if (!character) return "";
  const key = role === "母" ? "birthParent" : "birthPartner";
  return getDialogueLine({
    character,
    scene: "reproduction",
    key,
    context: { roleLabel: role }
  }) || "";
}

const CHILD_NAME_MAX_LENGTH = 8;
// 関係文字列とログが名前をそのまま埋め込むため、使える文字を絞る。
const CHILD_NAME_PATTERN = /^[0-9A-Za-z\u3041-\u3096\u30A1-\u30FA\u30FC\u4E00-\u9FFF々・]+$/;

/** 未命名の赤子の呼び名 */
function getUnnamedChildLabel(child) {
  return child.bodySex === "男" ? "男の子" : "女の子";
}

/** オートネームの候補。確定するまで使用済みには登録しない。 */
function rollChildName(village, mother, child, excludedName = "") {
  return generateRandomName(child.bodySex, {
    existingNames: [...village.villagers.map(person => person.name), excludedName].filter(Boolean),
    fallbackParentName: mother.name,
    register: false
  });
}

/** プレイヤーが入力した名前の可否。使えない場合は理由を返す。 */
function getChildNameError(name, village) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "名を入力してください。";
  if ([...trimmed].length > CHILD_NAME_MAX_LENGTH) return `名は${CHILD_NAME_MAX_LENGTH}文字までです。`;
  if (!CHILD_NAME_PATTERN.test(trimmed)) return "使えるのは かな・カタカナ・漢字・英数字・「ー」「・」だけです。";
  if (/の(母|父|息子|娘)$/.test(trimmed)) return "「〜の母」「〜の娘」などで終わる名は、続柄と紛れるため使えません。";
  if (trimmed === "既婚") return "その名は使えません。";
  const taken = isNameReserved(trimmed) ||
    village.villagers.some(person => person.name === trimmed);
  if (taken) return "同じ名の者がすでにいます。";
  return "";
}

function showBirthModal(village, mother, father, child, onNamed) {
  enqueueReproductionModal(onClosed => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:520px;width:calc(100% - 32px);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
    modal.innerHTML = `
      <h2>出産</h2>
      <p>${mother.name}が${child.bodySex === "男" ? "男児" : "女児"}を産みました。</p>
      ${renderPortraitLine(mother, getBirthLine(mother, "母"))}
      ${father ? renderPortraitLine(father, getBirthLine(father, "父")) : ""}
      ${renderPortraitLine(child, "……すやすや眠っている。", getUnnamedChildLabel(child))}
      <div data-birth-choice>
        <button type="button" data-name-child>バッカスが命名する</button>
        <button type="button" data-leave-name>村人に任せる</button>
      </div>
      <div data-birth-naming hidden>
        <input type="text" data-child-name maxlength="${CHILD_NAME_MAX_LENGTH}" style="width:12em;">
        <button type="button" data-auto-name>自動命名</button>
        <button type="button" data-confirm-name>決定</button>
        <p data-name-error style="color:#b3261e;margin:6px 0 0;" hidden></p>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const choiceArea = modal.querySelector("[data-birth-choice]");
    const namingArea = modal.querySelector("[data-birth-naming]");
    const nameInput = modal.querySelector("[data-child-name]");
    const errorText = modal.querySelector("[data-name-error]");

    const decideName = name => {
      // 先に村へ加えてから閉じる。次の出産モーダルが同じ名前を候補に出さないため。
      onNamed(name);
      closeQueuedReproductionModal(village, overlay, modal, onClosed);
    };

    modal.querySelector("[data-leave-name]").onclick = () => {
      decideName(rollChildName(village, mother, child));
    };
    modal.querySelector("[data-name-child]").onclick = () => {
      choiceArea.hidden = true;
      namingArea.hidden = false;
      nameInput.focus();
    };
    // 押すたびに、今入っている名前とは別の候補を入れる。
    modal.querySelector("[data-auto-name]").onclick = () => {
      nameInput.value = rollChildName(village, mother, child, nameInput.value.trim());
      errorText.hidden = true;
      nameInput.focus();
    };
    modal.querySelector("[data-confirm-name]").onclick = () => {
      const name = nameInput.value.trim();
      const error = getChildNameError(name, village);
      if (error) {
        errorText.textContent = error;
        errorText.hidden = false;
        nameInput.focus();
        return;
      }
      decideName(name);
    };
  });
}

function renderPortraitLine(character, line, displayName = "") {
  return `
    <div style="display:grid;grid-template-columns:72px 1fr;gap:12px;margin:12px 0;align-items:center;">
      ${getPortraitSpriteHtml(character, { size: 72, alt: displayName || character.name, extraStyle: "border:1px solid #ddd;background-color:#f6f0e6;" })}
      <p><strong>${displayName || character.name}</strong>: ${line}</p>
    </div>
  `;
}
