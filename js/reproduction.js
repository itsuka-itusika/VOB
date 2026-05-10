import { Villager } from "./classes.js";
import { randChoice, clampValue, round3, randFloat, getPortraitPath } from "./util.js";
import {
  generateRandomName,
  assignBodyMindTraits,
  assignHobby,
  determineSpeechType,
  selectPortraitByCharacter,
  selectToddlerPortraitByCharacter
} from "./createVillagers.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { addRelationship, checkHasRelationship, getRelationshipTargetName, normalizeRelationship } from "./relationships.js";
import { getDialogueLine } from "./dialogue/dialogueEngine.js";

const HUMANOID_RACES = new Set(["人間", "ハーピー", "半神", "キュクロプス", "サイクロプス", "巨人"]);
const PHYSICAL_STATS = ["str", "vit", "dex", "mag", "chr"];
const MENTAL_STATS = ["int", "ind", "eth", "cou", "sexdr"];
const CHILD_BODY_TRAITS = ["赤子", "子供", "少年", "少女"];
const CHILD_MIND_TRAITS = ["無垢", "萌芽", "思春期"];
const PREGNANCY_FULL_TERM_MONTHS = 10;
const POSTPARTUM_MONTHS = 3;
const THUNDER_BLESSING_TRAIT = "雷霆神の加護";
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
  return HUMANOID_RACES.has(person?.race || "人間");
}

function normalizeChildRace(race) {
  if (race === "サイクロプス" || race === "巨人") return "キュクロプス";
  return race || "人間";
}

function snapshotParent(person) {
  const snap = {
    name: person.name,
    bodyOwner: person.bodyOwner || person.name,
    race: person.race || "人間",
    bodySex: person.bodySex,
    bodyTraits: Array.isArray(person.bodyTraits) ? [...person.bodyTraits] : []
  };
  [...PHYSICAL_STATS, ...MENTAL_STATS].forEach(stat => {
    snap[stat] = Number(person[stat]) || 1;
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

function addBodyStatBonus(child, stat, amount) {
  child[stat] = (Number(child[stat]) || 0) + amount;
  ["potentialStats", "bodyPotentialStats", "mindPotentialStats"].forEach(key => {
    if (child[key]) {
      child[key][stat] = (Number(child[key][stat]) || 0) + amount;
    }
  });
}

function applyInheritedBodyTraits(child, traits) {
  traits.forEach(trait => addUnique(child.bodyTraits, trait));
  if (traits.includes("大地の巫女")) {
    addBodyStatBonus(child, "vit", 10);
    addBodyStatBonus(child, "chr", 10);
  }
  if (traits.includes("月の巫女")) {
    addBodyStatBonus(child, "dex", 10);
    addBodyStatBonus(child, "chr", 10);
  }
  if (traits.includes("太陽の巫女")) {
    addBodyStatBonus(child, "str", 15);
    addBodyStatBonus(child, "chr", 5);
  }
  if (traits.includes("梟の巫女")) {
    addBodyStatBonus(child, "mag", 10);
    addBodyStatBonus(child, "chr", 10);
  }
  if (traits.includes("聖女の輝き")) {
    addBodyStatBonus(child, "mag", 10);
    addBodyStatBonus(child, "chr", 10);
  }
  if (traits.includes("大地の加護")) addBodyStatBonus(child, "vit", 5);
  if (traits.includes("月の加護")) addBodyStatBonus(child, "dex", 5);
  if (traits.includes("太陽の加護")) addBodyStatBonus(child, "str", 5);
  if (traits.includes("梟の加護")) addBodyStatBonus(child, "mag", 5);
  if (traits.includes(THUNDER_BLESSING_TRAIT)) {
    PHYSICAL_STATS.forEach(stat => addBodyStatBonus(child, stat, 3));
  }
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

function canBeMother(person, village) {
  return isHumanoid(person) &&
    person.bodySex === "女" &&
    Number(person.bodyAge) >= 16 &&
    checkHasRelationship(person, "既婚") &&
    !person.pregnancy &&
    !hasTrait(person, "妊娠") &&
    !hasTrait(person, "臨月") &&
    !hasTrait(person, "産褥") &&
    !hasOwnChildInVillage(village, person);
}

function canBeFather(person) {
  return isHumanoid(person) &&
    person.bodySex === "男" &&
    Number(person.bodyAge) >= 12;
}

function canReceiveGoldenRainPregnancy(person) {
  return isHumanoid(person) &&
    person.bodySex === "女" &&
    Number(person.bodyAge) >= 16 &&
    Number(person.bodyAge) <= 29 &&
    !person.pregnancy &&
    !hasTrait(person, "妊娠") &&
    !hasTrait(person, "臨月") &&
    !hasTrait(person, "産褥");
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
  if (!village || !mother || !canReceiveGoldenRainPregnancy(mother)) return false;
  if (!Array.isArray(village.pendingGoldenRainPregnancies)) {
    village.pendingGoldenRainPregnancies = [];
  }
  const due = getNextMonthDate(village);
  village.pendingGoldenRainPregnancies.push({
    targetName: mother.name,
    dueYear: due.year,
    dueMonth: due.month
  });
  village.log(`${mother.name}は黄金の雨を浴びました。来月、神秘の妊娠が訪れるかもしれません。`);
  return true;
}

function decideChildSex(race) {
  if (race === "ハーピー") return "女";
  if (race === "キュクロプス" || race === "サイクロプス" || race === "巨人") return "男";
  return Math.random() < 0.5 ? "男" : "女";
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
      child[stat] = Math.max(1, Math.round(bodyPotential[stat] * getGrowthRatio(bodyAge, stat)));
    });
    if (bodyAge >= 16) child.adultBodyReached = true;
  }
  if (mindPotential && shouldApplyMentalGrowth) {
    MENTAL_STATS.forEach(stat => {
      child[stat] = Math.max(1, Math.round(mindPotential[stat] * getGrowthRatio(spiritAge, stat)));
    });
    if (spiritAge >= 16) child.adultMindReached = true;
  }
}

function buildAdultTemplate(child, potentialStats) {
  const adult = new Villager(child.name, child.bodySex, 16);
  adult.race = child.race;
  Object.assign(adult, potentialStats);
  adult.spiritAge = 16;
  adult.spiritSex = child.spiritSex;
  assignBodyMindTraits(adult);
  adult.bodyTraits = removeTraits(adult.bodyTraits, ["中年", "老人"]);
  adult.mindTraits = removeTraits(adult.mindTraits, CHILD_MIND_TRAITS);
  if (adult.race === "ハーピー") {
    addUnique(adult.bodyTraits, "飛行");
    addUnique(adult.bodyTraits, "澄んだ声");
  }
  assignHobby(adult);
  adult.portraitFile = selectPortraitByCharacter(adult);
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
  if (child.bodyAge < 10) {
    if (child.bodyAge <= 3) {
      child.portraitFile = child.bodySex === "男" ? "../malebaby.png" : "../femalebaby.png";
    } else {
      if (!child.toddlerPortraitFile) {
        child.toddlerPortraitFile = selectToddlerPortraitByCharacter(child);
      }
      child.portraitFile = child.toddlerPortraitFile;
    }
  } else if (child.adultPortraitFile) {
    child.portraitFile = child.adultPortraitFile;
  }
}

export function updateChildGrowthStage(child, village, { announce = false } = {}) {
  const bodyPotential = child.bodyPotentialStats !== undefined ? child.bodyPotentialStats : child.potentialStats;
  const mindPotential = child.mindPotentialStats !== undefined ? child.mindPotentialStats : child.potentialStats;
  if (!child.potentialStats && !bodyPotential && !mindPotential) return;

  applyGrowthStats(child);

  if (child.bodyAge <= 3) {
    child.bodyTraits = removeTraits(child.bodyTraits, CHILD_BODY_TRAITS);
    addUnique(child.bodyTraits, "赤子");
  } else if (child.bodyAge <= 9) {
    child.bodyTraits = removeTraits(child.bodyTraits, ["赤子", "少年", "少女"]);
    addUnique(child.bodyTraits, "子供");
  } else if (child.bodyAge <= 15) {
    child.bodyTraits = removeTraits(child.bodyTraits, ["赤子", "子供"]);
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
  setChildPortrait(child);
  refreshJobTable(child, village);

  if (announce) {
    if (child.bodyAge === 4 || child.spiritAge === 4) {
      village.log(`${child.name}は子供期に入りました`);
    } else if (child.bodyAge === 10 || child.spiritAge === 10) {
      village.log(`${child.name}は少年期に入りました`);
    } else if (child.bodyAge === 16 || child.spiritAge === 16) {
      village.log(`${child.name}は成人しました`);
    }
    if (child.spiritAge === 16 && !child.adultModalShown) {
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
      character[stat] = Math.max(1, Math.round(bodyPotential[stat] * getGrowthRatio(16, stat)));
    });
  }
  character.adultBodyReached = true;

  const currentBodyTraits = removeTraits(character.bodyTraits, CHILD_BODY_TRAITS);
  character.bodyTraits = [...new Set([...(character.adultBodyTraits || []), ...currentBodyTraits])];

  if (!character.adultPortraitFile) {
    character.adultPortraitFile = selectPortraitByCharacter(character);
  }
  setChildPortrait(character);
  refreshJobTable(character, village);
  return true;
}

export function handleBirthAndPostpartum(village) {
  village.villagers.forEach(person => {
    if (Number(person.postpartumMonths) > 0) {
      person.postpartumMonths -= 1;
      if (person.postpartumMonths <= 0 && hasTrait(person, "産褥")) {
        person.bodyTraits = person.bodyTraits.filter(trait => trait !== "産褥");
        person.str = round3(person.str / 0.5);
        person.vit = round3(person.vit / 0.5);
        village.log(`${person.name}は産褥から回復しました`);
      }
    }
  });

  const mothers = [...village.villagers];
  mothers.forEach(mother => {
    if (!mother.pregnancy) return;

    mother.pregnancy.months = (Number(mother.pregnancy.months) || 0) + 1;
    if (mother.pregnancy.months >= 8) {
      const wasFullTerm = hasTrait(mother, "臨月");
      mother.bodyTraits = mother.bodyTraits.filter(trait => trait !== "妊娠");
      addUnique(mother.bodyTraits, "臨月");
      if (!mother.pregnancy.fullTermApplied) {
        mother.str = round3(mother.str * 0.5);
        mother.vit = round3(mother.vit * 0.5);
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
  processPendingGoldenRainPregnancies(village);
  processPregnancyChecks(village);
}

export function handlePregnancyAndBirth(village) {
  handleBirthAndPostpartum(village);
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
    const due = { year: Number(entry.dueYear) || 0, month: Number(entry.dueMonth) || 0 };
    if (!isDue(village, due)) {
      remaining.push(entry);
      return;
    }

    const mother = village.villagers.find(person => person.name === entry.targetName);
    if (!mother || !canReceiveGoldenRainPregnancy(mother)) {
      if (mother) village.log(`${mother.name}への黄金の雨の兆しは、妊娠には至りませんでした。`);
      return;
    }

    startPregnancy(village, mother, null, {
      fatherSnapshot: VIRTUAL_THUNDER_FATHER,
      childRace: "半神",
      inheritedBodyTraits: [THUNDER_BLESSING_TRAIT],
      geneticFatherUnknown: true
    });
  });

  village.pendingGoldenRainPregnancies = remaining;
}

function startPregnancy(village, mother, father, options = {}) {
  const motherSnapshot = snapshotParent(mother);
  const fatherSnapshot = options.fatherSnapshot || snapshotParent(father);
  const childRace = normalizeChildRace(options.childRace || mother.race);
  const childSex = decideChildSex(childRace);
  const potentialStats = buildPotentialStats(motherSnapshot, fatherSnapshot, childSex, childRace);
  const inheritedBodyTraits = [
    ...rollInheritedTraits({ motherSnapshot, fatherSnapshot, childSex }),
    ...(Array.isArray(options.inheritedBodyTraits) ? options.inheritedBodyTraits : [])
  ];

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
    fullTermApplied: false
  };
  addUnique(mother.bodyTraits, "妊娠");
  village.log(`${mother.name}が妊娠しました`);
  showPregnancyModal(village, mother, father);
}

function giveBirth(village, mother) {
  const data = mother.pregnancy;
  if (!data) return;

  if (data.fullTermApplied) {
    mother.str = round3(mother.str / 0.5);
    mother.vit = round3(mother.vit / 0.5);
  }
  mother.bodyTraits = mother.bodyTraits.filter(trait => trait !== "妊娠" && trait !== "臨月");

  const birthParentName = mother.name;
  const childName = generateRandomName(data.childSex, {
    existingNames: village.villagers.map(person => person.name),
    fallbackParentName: birthParentName
  });
  const child = new Villager(childName, data.childSex, 0);
  child.race = normalizeChildRace(data.childRace);
  child.spiritAge = 0;
  child.spiritSex = data.childSex;
  child.potentialStats = { ...data.potentialStats };
  child.bodyPotentialStats = { ...data.potentialStats };
  child.mindPotentialStats = { ...data.potentialStats };
  Object.assign(child, child.potentialStats);
  child.bodyTraits = ["赤子"];
  child.mindTraits = ["無垢"];
  if (child.race === "ハーピー") {
    addUnique(child.bodyTraits, "飛行");
    addUnique(child.bodyTraits, "澄んだ声");
  }
  applyInheritedBodyTraits(child, data.inheritedBodyTraits || []);
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
  mother.str = round3(mother.str * 0.5);
  mother.vit = round3(mother.vit * 0.5);
  mother.job = "なし";
  mother.action = "療養";
  mother.jobTable = ["なし"];
  mother.actionTable = ["療養"];

  if (spouse) {
    spouse.happiness = clampValue(spouse.happiness + 30, 0, 100);
  }

  mother.pregnancy = null;
  village.popLimit = (Number(village.popLimit) || 0) + 1;
  village.villagers.push(child);
  village.log(`${mother.name}が${child.name}を出産しました。人口上限+1`);
  showBirthModal(village, mother, spouse, child);
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

function showBirthModal(village, mother, father, child) {
  enqueueReproductionModal(onClosed => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:520px;width:calc(100% - 32px);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
    modal.innerHTML = `
      <h2>出産</h2>
      <p>${mother.name}が${child.name}を出産しました。</p>
      ${renderPortraitLine(mother, getBirthLine(mother, "母"))}
      ${father ? renderPortraitLine(father, getBirthLine(father, "父")) : ""}
      ${renderPortraitLine(child, "……すやすや眠っている。")}
      <button type="button" data-close-reproduction-modal>閉じる</button>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    modal.querySelector("[data-close-reproduction-modal]").onclick = () => {
      closeQueuedReproductionModal(village, overlay, modal, onClosed);
    };
  });
}

function renderPortraitLine(character, line) {
  return `
    <div style="display:grid;grid-template-columns:72px 1fr;gap:12px;margin:12px 0;align-items:center;">
      <img src="${getPortraitPath(character)}" alt="${character.name}" style="width:72px;height:72px;object-fit:cover;border:1px solid #ddd;background:#f6f0e6;">
      <p><strong>${character.name}</strong>: ${line}</p>
    </div>
  `;
}
