import { Villager } from "./classes.js";
import { randChoice, clampValue, round3, randFloat, getPortraitPath } from "./util.js";
import {
  generateRandomName,
  assignBodyMindTraits,
  assignHobby,
  determineSpeechType,
  refreshJobTable,
  selectPortraitByCharacter
} from "./createVillagers.js";
import { addRelationship, checkHasRelationship, getRelationshipTargetName } from "./relationships.js";

const HUMANOID_RACES = new Set(["人間", "ハーピー", "キュクロプス", "サイクロプス", "巨人"]);
const PHYSICAL_STATS = ["str", "vit", "dex", "mag", "chr"];
const MENTAL_STATS = ["int", "ind", "eth", "cou", "sexdr"];
const CHILD_BODY_TRAITS = ["赤子", "幼児", "少年", "少女"];
const CHILD_MIND_TRAITS = ["無垢", "萌芽", "思春期"];
const PREGNANCY_FULL_TERM_MONTHS = 10;
const POSTPARTUM_MONTHS = 3;

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
    race: person.race || "人間",
    bodySex: person.bodySex
  };
  [...PHYSICAL_STATS, ...MENTAL_STATS].forEach(stat => {
    snap[stat] = Number(person[stat]) || 1;
  });
  return snap;
}

function childRelationshipSuffix(child) {
  return child.bodySex === "男" ? "息子" : "娘";
}

function hasOwnChildInVillage(village, parent) {
  const parentName = parent.name;
  return village.villagers.some(person => {
    if (person === parent || !Array.isArray(person.relationships)) return false;
    return person.relationships.includes(`${parentName}の息子`) ||
      person.relationships.includes(`${parentName}の娘`);
  });
}

function getSpouse(person, village) {
  const spouseName = getRelationshipTargetName(person, "夫") || getRelationshipTargetName(person, "妻");
  if (!spouseName) return null;
  return village.villagers.find(candidate => candidate.name === spouseName) || null;
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
    child.portraitFile = child.bodyAge <= 3 ? "CHILD_SHADOW_BABY.svg" : "CHILD_SHADOW.svg";
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
      child.adultModalShown = true;
      showAdultModal(village, child);
    }
  }
}

export function handlePregnancyAndBirth(village) {
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

  processPregnancyChecks(village);
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

function startPregnancy(village, mother, father) {
  const motherSnapshot = snapshotParent(mother);
  const fatherSnapshot = snapshotParent(father);
  const childRace = normalizeChildRace(mother.race);
  const childSex = decideChildSex(childRace);
  const potentialStats = buildPotentialStats(motherSnapshot, fatherSnapshot, childSex, childRace);

  mother.pregnancy = {
    months: 0,
    motherName: mother.name,
    geneticFatherName: father.name,
    motherSnapshot,
    fatherSnapshot,
    childRace,
    childSex,
    potentialStats,
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

  const child = new Villager(generateRandomName(data.childSex), data.childSex, 0);
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

  addRelationship(child, `${mother.name}の${childRelationshipSuffix(child)}`);
  addRelationship(mother, `${child.name}の母`);
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

  const father = village.villagers.find(person => person.name === data.geneticFatherName);
  if (father) {
    addRelationship(father, `${child.name}の父`);
    father.happiness = clampValue(father.happiness + 30, 0, 100);
  }

  mother.pregnancy = null;
  village.popLimit = (Number(village.popLimit) || 0) + 1;
  village.villagers.push(child);
  village.log(`${mother.name}が${child.name}を出産しました。人口上限+1`);
  showBirthModal(village, mother, father, child);
}

export function getReproductiveStatusLine(character) {
  if (hasTrait(character, "臨月")) return getPregnancyLine(character, true);
  if (hasTrait(character, "妊娠")) return getPregnancyLine(character, false);
  if (hasMindTrait(character, "無垢")) return randChoice(["あうー。", "んま。", "ばぶ。", "きゃっ。", "すやすや……"]);
  if (hasMindTrait(character, "萌芽")) return randChoice(["えへへ、きょうもあそぶ？", "ねえねえ、あれなあに？", "ぼく、ちょっとできるよ！", "わたしもおてつだいする！", "おそと、いきたいな。"]);
  return null;
}

function getPregnancyLine(character, fullTerm) {
  const type = character.speechType || determineSpeechType(character);
  const lines = {
    "普通Ｍ": fullTerm ? ["体が重いな……もうすぐなのか。", "落ち着かないけど、迎える準備はできているよ。"] : ["まだ実感が追いつかないな。", "大事に過ごさないとね。"],
    "普通Ｆ": fullTerm ? ["もうすぐ会えるんですね。少し緊張します。", "体は重いですが、楽しみです。"] : ["新しい命がいるんですね。大切にします。", "無理はしないようにします。"],
    "強気Ｍ": fullTerm ? ["このくらいで音を上げるものか。", "もうすぐだな。腹をくくるさ。"] : ["戸惑いはあるが、守るものが増えたな。", "やれることをやるだけだ。"],
    "強気Ｆ": fullTerm ? ["もうすぐね。弱音なんて吐かないわ。", "大丈夫、ちゃんと産んでみせる。"] : ["驚いたけど、覚悟はできてるわ。", "私がしっかりしないとね。"],
    "内気": fullTerm ? ["こ、怖いです……でも、会いたいです。", "もうすぐなんですね……どきどきします。"] : ["まだ少し、信じられません……。", "ちゃんとできるか、不安です……。"],
    "陰気": fullTerm ? ["……重い。けど、ここまで来た。", "……終わりじゃなくて、始まりか。"] : ["……妙な気分だ。", "……自分に務まるのか。"],
    "お調子者": fullTerm ? ["いよいよっすね、さすがに緊張するっす！", "もうすぐ会えるとか、すごいっすね。"] : ["いやー、びっくりっすね！", "これは頑張らないとっすね。"],
    "快活": fullTerm ? ["もうすぐだね！ちょっと怖いけど楽しみ！", "元気な子だといいな！"] : ["びっくりしたけど、なんだか嬉しい！", "無理せず元気にいこう！"],
    "お嬢様": fullTerm ? ["いよいよですわね……心を整えますわ。", "少し怖いですけれど、楽しみですわ。"] : ["まあ……不思議な気持ちですわ。", "大切に過ごしますわ。"],
    "クールＭ": fullTerm ? ["出産が近い。準備を確認しておこう。", "体調管理を最優先にする。"] : ["状況は理解した。無理は避ける。", "冷静に備えるべきだな。"],
    "クールＦ": fullTerm ? ["もうすぐね。落ち着いて臨むわ。", "体は重いけれど、問題ないわ。"] : ["理解したわ。慎重に過ごす。", "少し不思議な感覚ね。"],
    "老人": fullTerm ? ["この年で命を迎えるとは、不思議なものじゃ。", "もうすぐじゃな……静かに待とう。"] : ["命とは巡るものじゃのう。", "大事にせねばならんのう。"]
  };
  return randChoice(lines[type] || lines[character.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function getPregnancyNoticeLine(character, role, partner) {
  const type = character.speechType || determineSpeechType(character);
  const lines = {
    "普通Ｍ": role === "mother" ? ["まだ実感が追いつかないな。でも、大事にするよ。", "驚いたけど、守るものが増えたんだな。"] : [`${partner.name}を支えないとな。`, "無事に育ってほしい。できることをするよ。"],
    "普通Ｆ": role === "mother" ? ["新しい命がいるんですね。大切にします。", "少し不思議ですけど、嬉しいです。"] : [`${partner.name}さんを支えます。`, "無事に産まれてきてほしいですね。"],
    "強気Ｍ": role === "mother" ? ["戸惑いはあるが、守り抜く。", "腹をくくるしかないな。"] : [`${partner.name}は俺が支える。`, "子も親も守ってみせる。"],
    "強気Ｆ": role === "mother" ? ["驚いたけど、覚悟はできてるわ。", "大丈夫、私がしっかりする。"] : [`${partner.name}を支えるわ。任せて。`, "無事に迎える準備をするわよ。"],
    "内気": role === "mother" ? ["まだ少し、信じられません……。", "ちゃんとできるか、不安です……でも嬉しいです。"] : [`${partner.name}さんの力に、なりたいです……。`, "こ、これから大切にしないと……。"],
    "陰気": role === "mother" ? ["……妙な気分だ。", "……自分に務まるのか。"] : [`……${partner.name}を放ってはおけないな。`, "……無事なら、それでいい。"],
    "お調子者": role === "mother" ? ["いやー、びっくりっすね！", "これは頑張らないとっすね！"] : [`${partner.name}を全力で支えるっす！`, "いやー、急に責任重大っすね！"],
    "快活": role === "mother" ? ["びっくりしたけど、なんだか嬉しい！", "無理せず元気にいこう！"] : [`${partner.name}、一緒に頑張ろう！`, "元気な子だといいね！"],
    "お嬢様": role === "mother" ? ["まあ……不思議な気持ちですわ。", "大切に過ごしますわ。"] : [`${partner.name}様を丁寧に支えますわ。`, "新たな命に祝福がありますように。"],
    "クールＭ": role === "mother" ? ["状況は理解した。無理は避ける。", "冷静に備えるべきだな。"] : [`${partner.name}の体調管理を優先する。`, "必要な準備を始めよう。"],
    "クールＦ": role === "mother" ? ["理解したわ。慎重に過ごす。", "少し不思議な感覚ね。"] : [`${partner.name}を支える。今はそれが最優先ね。`, "落ち着いて準備しましょう。"],
    "老人": role === "mother" ? ["命とは巡るものじゃのう。", "大事にせねばならんのう。"] : [`${partner.name}を労わらねばのう。`, "新しい命とは、めでたいものじゃ。"]
  };
  return randChoice(lines[type] || lines[character.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function showPregnancyModal(village, mother, father) {
  if (typeof document === "undefined") return;
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:560px;width:calc(100% - 32px);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
  modal.innerHTML = `
    <h2>妊娠</h2>
    <p>${mother.name}が妊娠しました。</p>
    ${renderPortraitLine(mother, getPregnancyNoticeLine(mother, "mother", father))}
    ${father ? renderPortraitLine(father, getPregnancyNoticeLine(father, "father", mother)) : ""}
    <button id="closePregnancyModal">閉じる</button>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  document.getElementById("closePregnancyModal").onclick = () => {
    overlay.remove();
    modal.remove();
    import("./ui.js").then(module => module.updateUI(village));
  };
}

function getAdultLine(character) {
  const type = character.speechType || determineSpeechType(character);
  const lines = {
    "普通Ｍ": ["今日から大人か。できることを一つずつやっていくよ。", "少し背筋が伸びるな。これからもよろしく。"],
    "普通Ｆ": ["成人したんですね。これからも頑張ります。", "少し緊張しますけど、しっかりやっていきます。"],
    "強気Ｍ": ["ようやく一人前だな。任せておけ。", "ここからが本番だ。しっかり働くさ。"],
    "強気Ｆ": ["成人したからには、遠慮なく頼っていいわ。", "もう子供扱いはなしよ。私が支えるわ。"],
    "内気": ["お、大人になったんですね……頑張ります。", "まだ不安ですけど、少しずつ慣れていきます。"],
    "陰気": ["……成人か。逃げ場はないな。", "……まあ、やるべきことはやる。"],
    "お調子者": ["ついに大人っすね！見ててくださいよ！", "いやー、これで一人前っす！たぶん！"],
    "快活": ["成人だね！いっぱい頑張るよ！", "今日からもっと村の力になるね！"],
    "お嬢様": ["成人いたしましたわ。皆様のお力になります。", "一人前として、恥じぬよう努めますわ。"],
    "クールＭ": ["成人した。役割を果たそう。", "これからは大人として判断する。"],
    "クールＦ": ["成人ね。落ち着いて役目を果たすわ。", "一人前として扱ってもらって構わないわ。"],
    "老人": ["成人とはめでたいのう。若い力は村の宝じゃ。", "これからが人生の始まりじゃな。"]
  };
  return randChoice(lines[type] || lines[character.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function showAdultModal(village, character) {
  if (typeof document === "undefined") return;
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:560px;width:calc(100% - 32px);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
  modal.innerHTML = `
    <h2>成人</h2>
    <p>${character.name}が成人しました。</p>
    ${renderPortraitLine(character, getAdultLine(character))}
    <button id="closeAdultModal">閉じる</button>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  document.getElementById("closeAdultModal").onclick = () => {
    overlay.remove();
    modal.remove();
    import("./ui.js").then(module => module.updateUI(village));
  };
}

function getBirthLine(character, role) {
  if (!character) return "";
  const type = character.speechType || determineSpeechType(character);
  const lines = {
    "普通Ｍ": [`${role}になったんだな……大切にしよう。`, "無事でよかった。本当に。"],
    "普通Ｆ": [`${role}になったんですね……嬉しいです。`, "小さくて、あたたかいですね。"],
    "強気Ｍ": ["よく来たな。俺が守ってやる。", "無事に産まれてくれて何よりだ。"],
    "強気Ｆ": ["よく来たわね。絶対守るから。", "大丈夫、ここから一緒に生きていくのよ。"],
    "内気": ["ち、小さい……かわいいです……。", "無事で……よかった……。"],
    "陰気": ["……産まれたのか。", "……守る理由ができたな。"],
    "お調子者": ["うわ、ちっちゃいっすね！かわいいっす！", "これはもう、頑張るしかないっすね！"],
    "快活": ["やった！元気に産まれたね！", "かわいい！これからよろしくね！"],
    "お嬢様": ["まあ……なんて愛らしいのでしょう。", "この子の未来が明るいものでありますように。"],
    "クールＭ": ["無事に出生した。まずは安心だ。", "この子を守る責任がある。"],
    "クールＦ": ["無事ね。よかった。", "小さいけれど、確かな命ね。"],
    "老人": ["新しい命じゃ……めでたいのう。", "この村にも未来が生まれたのじゃな。"]
  };
  return randChoice(lines[type] || lines[character.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function showBirthModal(village, mother, father, child) {
  if (typeof document === "undefined") return;
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
    <button id="closeBirthModal">閉じる</button>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  document.getElementById("closeBirthModal").onclick = () => {
    overlay.remove();
    modal.remove();
    import("./ui.js").then(module => module.updateUI(village));
  };
}

function renderPortraitLine(character, line) {
  return `
    <div style="display:grid;grid-template-columns:72px 1fr;gap:12px;margin:12px 0;align-items:center;">
      <img src="${getPortraitPath(character)}" alt="${character.name}" style="width:72px;height:72px;object-fit:cover;border:1px solid #ddd;background:#f6f0e6;">
      <p><strong>${character.name}</strong>: ${line}</p>
    </div>
  `;
}
