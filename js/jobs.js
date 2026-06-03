// jobs.js

import { randInt, randFloat, clampValue, round3 } from "./util.js";
import { HobbyEffects } from "./HobbyEffects.js";
import {
  calculateAlchemyYield,
  calculateApprenticeYield,
  calculateBrewingYield,
  calculateBunnySupport,
  calculateCopyBookYield,
  calculateDancerHappiness,
  calculateFarmYield,
  calculateFishYield,
  calculateGatherYield,
  calculateGuardYield,
  calculateHandiworkYield,
  calculateHuntYield,
  calculateLumberYield,
  calculateMassageHeal,
  calculateMikoMana,
  calculateNurseHeal,
  calculatePoetHappiness,
  calculatePriestMindHeal,
  calculateResearchAssistantYield,
  calculateResearchYield,
  calculateTradingYield,
  calculateWeavingYield,
  getJobCostType,
  rollBodyCost,
  rollMindCost,
} from "./domain/jobMath.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { addStoredResource } from "./domain/resourceLimits.js";
import { addAcquiredStat, getPermanentStat, syncEffectiveStats } from "./domain/statLayers.js";
import { rollSecretTreasureJobEvents, showSecretTreasureEventModals } from "./secretTreasureEvents.js";
import { incrementTitleCounter, TITLE_COUNTER_KEYS } from "./titles.js";

const HEALING_RECOVERABLE_BODY_TRAITS = ["負傷", "疫病"];
const BASE_JOB_STAT_GROWTH_CHANCE = 0.05;
const PHYSICAL_JOB_GROWTH_STATS = new Set(["str", "vit", "dex", "mag", "chr"]);
const MENTAL_JOB_GROWTH_STATS = new Set(["int", "ind", "eth", "cou", "sexdr"]);
const HELP_JOB_GROWTH_STATS = [
  { key: "dex", label: "器用" },
  { key: "int", label: "知力" },
  { key: "ind", label: "勤勉" },
  { key: "cou", label: "勇気" },
  { key: "eth", label: "倫理" }
];

function hasBodyTrait(person, trait) {
  return Array.isArray(person?.bodyTraits) && person.bodyTraits.includes(trait);
}

function hasMindTrait(person, trait) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.includes(trait);
}

function getJobStatGrowthChance(person, stat, baseChance = BASE_JOB_STAT_GROWTH_CHANCE) {
  let chance = baseChance;
  if (MENTAL_JOB_GROWTH_STATS.has(stat) && hasMindTrait(person, "思春期")) {
    chance *= 1.5;
  }
  if (PHYSICAL_JOB_GROWTH_STATS.has(stat) && (hasBodyTrait(person, "少年") || hasBodyTrait(person, "少女"))) {
    chance *= 1.5;
  }
  return chance;
}

function rollJobStatGrowth(person, stat, baseChance = BASE_JOB_STAT_GROWTH_CHANCE) {
  return Math.random() < getJobStatGrowthChance(person, stat, baseChance);
}

function restoreRecoveredBodyTraitStats(person, trait) {
  if (trait !== "疫病") return;
  person.hp = clampValue(round3((Number(person.hp) || 0) / 0.5), 0, 100);
}

/**
 * 全村人の「行動」を実行する
 */
export function handleAllVillagerJobs(village) {
  village.log("【村人の行動フェーズ】");

  const actionLogs = [];
  const secretTreasureFlags = { field: false, fishing: false };
  let secretTreasureEvents = [];
  const originalLog = village.log;
  const writeLog = originalLog.bind(village);

  village.log = (msg) => {
    writeLog(msg);
    actionLogs.push(String(msg));
  };

  try {
    village.villagers.forEach(p => {
      let saboProb = 40 - p.ind * 2;
      if (saboProb < 0) saboProb = 0;

      let roll = randInt(1, 100);
      // サボり判定
      if (roll <= saboProb && p.action !== "休養" && p.action !== "余暇" && p.action !== "なし" && p.action !== "揺籃" && p.action !== "迎撃" && p.action !== "籠城" && p.action !== "射撃" && p.action !== "罠作成" && p.action !== "療養" && p.action !== "臨終") {
        doSabori(p, village);
      } else {
        doJobAction(p, village, secretTreasureFlags);
      }
    });
    secretTreasureEvents = rollSecretTreasureJobEvents(village, secretTreasureFlags);
  } finally {
    village.log = originalLog;
  }

  showActionPhaseResultModal(village, actionLogs, () => showSecretTreasureEventModals(secretTreasureEvents));
}

function showActionPhaseResultModal(village, messages, afterClose = null) {
  if (typeof document === "undefined" || messages.length === 0) return;

  document.getElementById("actionPhaseOverlay")?.remove();
  document.getElementById("actionPhaseModal")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "actionPhaseOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 2200;
  `;

  const modal = document.createElement("div");
  modal.id = "actionPhaseModal";
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(720px, calc(100vw - 32px));
    max-height: min(76vh, 720px);
    display: flex;
    flex-direction: column;
    background: #fff;
    color: #222;
    border: 1px solid #7a5c32;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    z-index: 2201;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    padding: 12px 16px;
    font-weight: bold;
    border-bottom: 1px solid #d8c7a8;
    background: #f5ead7;
  `;
  header.textContent = `${village.year}年${village.month}月 行動フェーズ結果`;

  const list = document.createElement("div");
  list.style.cssText = `
    padding: 10px 16px;
    overflow-y: auto;
    line-height: 1.55;
  `;

  messages.forEach(msg => {
    const row = document.createElement("div");
    row.style.cssText = `
      padding: 6px 0;
      border-bottom: 1px dotted #d8c7a8;
      word-break: break-word;
    `;
    row.textContent = msg;
    list.appendChild(row);
  });

  const footer = document.createElement("div");
  footer.style.cssText = `
    padding: 10px 16px;
    text-align: right;
    border-top: 1px solid #d8c7a8;
    background: #faf6ee;
  `;

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "閉じる";
  closeButton.style.cssText = `
    padding: 6px 18px;
    cursor: pointer;
  `;

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.remove();
    modal.remove();
    if (typeof afterClose === "function") afterClose();
  };
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", close);

  footer.appendChild(closeButton);
  modal.appendChild(header);
  modal.appendChild(list);
  modal.appendChild(footer);
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  closeButton.focus();
}

function doSabori(p, v) {
  if (p.mindTraits.includes("ニート")) {
    p.hp = clampValue(p.hp+40, 0, 100);
    p.mp = clampValue(p.mp+40, 0, 100);
    p.happiness = clampValue(p.happiness+20, 0, 100);
    v.log(`${p.name}はニート:サボり 体力+40,メンタル+40,幸福+20`);
  } else {
    p.hp = clampValue(p.hp+20, 0, 100);
    p.mp = clampValue(p.mp+20, 0, 100);
    v.log(`${p.name}サボり:体力+20,メンタル+20`);
  }
}

function doJobAction(p, v, secretTreasureFlags = null) {
  switch(p.action) {
    case "なし":
      v.log(`${p.name}は行動がない`);
      break;
    case "休養":
      doRestJob(p, v);
      break;
    case "揺籃":
      doCradleJob(p, v);
      break;
    case "余暇":
      doLeisureJob(p, v);
      break;
    case "遊び":
      doPlayJob(p, v);
      break;
    case "お手伝い":
      doHelpJob(p, v);
      break;
    case "農作業":
      doFarm(p, v);
      if (secretTreasureFlags) secretTreasureFlags.field = true;
      break;
    case "伐採":
      doLumber(p, v);
      break;
    case "狩猟":
      doHunt(p, v);
      break;
    case "漁":
      doFish(p, v);
      if (secretTreasureFlags) secretTreasureFlags.fishing = true;
      break;
    case "採集":
      doGather(p, v);
      break;
    case "内職":
      doHandiwork(p, v);
      break;
    case "丁稚":
      doApprentice(p, v);
      break;
    case "研究":
      doResearchJob(p, v);
      break;
    case "研究助手":
      doResearchAssistantJob(p, v);
      break;
    case "警備":
      doGuardJob(p, v);
      break;
    case "療養":
      doHealingJob(p, v);
      break;
    case "臨終":
      doLastMomentsJob(p, v);
      break;
    case "踊り子":
      doDancer(p, v);
      break;
    case "詩人":
      doPoet(p, v);
      break;
    case "看護":
      doNurse(p, v);
      break;
    case "シスター":
      doSister(p, v);
      break;
    case "神官":
      doPriest(p, v);
      break;
    case "行商":
      doTrading(p, v);
      break;
    case "あんま":
      doMassage(p, v);
      break;
    case "巫女":
      doMiko(p, v);
      break;
    case "バニー":
      doBunny(p, v);
      break;
    case "錬金術":
      doAlchemy(p, v);
      break;
    case "写本":
      doCopyBook(p, v);
      break;
    case "機織り":
      doWeaving(p, v);
      break;
    case "醸造":
      doBrewing(p, v);
      if (secretTreasureFlags) secretTreasureFlags.field = true;
      break;
    // "罠作成", "射撃", "迎撃", "籠城" は襲撃専用(raid.js)で処理するので、ここはログだけ
    case "罠作成":
    case "射撃":
    case "迎撃":
    case "籠城":
      v.log(`${p.name}は${p.action}(襲撃専用フェーズで実行)`);
      break;

    default:
      v.log(`${p.name}の行動[${p.action}]未定義`);
      break;
  }
}

function calcBodyCost(base, vit, person = null, village = null) {
  return rollBodyCost(base, vit, person, village, randFloat);
}
function calcMindCost(base, stat, person = null, village = null) {
  return rollMindCost(base, stat, person, village, randFloat);
}

function calcJobBodyCost(job, person, village) {
  return calcBodyCost(getJobCostType(job).body, person.vit, person, village);
}

function calcJobMindCost(job, stat, person, village) {
  return calcMindCost(getJobCostType(job).mind, stat, person, village);
}

// -------------------------
// 各ジョブの具体処理
// -------------------------

function doCradleJob(p, v) {
  p.hp = clampValue(p.hp + 30, 0, 100);
  p.mp = clampValue(p.mp + 30, 0, 100);
  p.happiness = clampValue(p.happiness + 30, 0, 100);
  v.log(`${p.name}揺籃:体力+30,メンタル+30,幸福+30`);
}

function doRestJob(p, v) {
  let r = randInt(1,100);
  let hpG = 0;
  let mpG = 0;
  let msg = "";
  if (p.mindTraits.includes("ワーカホリック")) {
    hpG = 30; 
    mpG = -10; 
    msg = "(ワーカホリック)";
  } else if (r<=30) {
    hpG = 70; mpG=30; msg="大成功";
  } else if (r<=90) {
    hpG = 50; mpG=20; msg="成功";
  } else {
    hpG = 30; mpG=0; msg="失敗";
  }
  // 中年/老人で効率補正
  let multi=1;
  if (p.bodyTraits.includes("老人")) multi=0.7;
  else if (p.bodyTraits.includes("中年")) multi=0.9;

  hpG=Math.floor(hpG*multi);
  mpG=Math.floor(mpG*multi);

  p.hp=clampValue(p.hp+hpG,0,100);
  p.mp=clampValue(p.mp+mpG,0,100);

  // ニート特性の場合、幸福度も上昇
  if (p.mindTraits.includes("ニート")) {
    p.happiness = clampValue(p.happiness + 20, 0, 100);
    msg += "(ニート:幸福+20)";
  }

  v.log(`${p.name}休養:${msg} 体力+${hpG},メンタル+${mpG}`);
}

function hasCurrentHobbyMate(p) {
  if (!p.hobby || !Array.isArray(p.relationships)) return false;
  return p.relationships.some(rel => rel.startsWith(`${p.hobby}仲間:`));
}

function doLeisureJob(p, v) {
  let base=50;
  let hobbyMateMsg = "";
  if (p.mindTraits.includes("ニート")) {
    base=100;
    p.happiness=clampValue(p.happiness+20,0,100);
  }
  if (hasCurrentHobbyMate(p)) {
    base = Math.round(base * 1.5);
    hobbyMateMsg = ",趣味仲間効果";
  }
  p.mp=clampValue(p.mp+base,0,100);

  let hobbyMsg = HobbyEffects.apply(p, v);
  v.log(`${p.name}余暇:メンタル+${base}${hobbyMateMsg}${hobbyMsg}`);
}

function doPlayJob(p, v) {
  const tc = calcBodyCost(5, p.vit, p, v);
  p.hp = clampValue(p.hp - tc, 0, 100);
  p.mp = clampValue(p.mp + 20, 0, 100);
  p.happiness = clampValue(p.happiness + 15, 0, 100);
  v.log(`${p.name}遊び:体力-${tc},メンタル+20,幸福+15`);
}

function doHelpJob(p, v) {
  const tc = calcBodyCost(10, p.vit, p, v);
  const foodGain = randInt(3, 6);
  const materialGain = randInt(3, 6);
  p.hp = clampValue(p.hp - tc, 0, 100);
  addStoredResource(v, "food", foodGain);
  addStoredResource(v, "materials", materialGain);

  let logMsg = `${p.name}お手伝い:食料+${foodGain},資材+${materialGain},体力-${tc}`;
  if (Math.random() < 0.01) {
    const stat = HELP_JOB_GROWTH_STATS[randInt(0, HELP_JOB_GROWTH_STATS.length - 1)];
    addAcquiredStat(p, stat.key, 1);
    logMsg += `,${stat.label}+1`;
  }

  v.log(logMsg);
}

function doFarm(p, v) {
  let tc=calcJobBodyCost("農作業", p, v);
  let mc=calcJobMindCost("農作業", p.ind, p, v);
  p.hp=clampValue(p.hp-tc,0,100);
  p.mp=clampValue(p.mp-mc,0,100);

  let amt=calculateFarmYield(p, v);
  let resourceLabel = "食料";
  
  // ミダスの奇跡の効果
  if (v.villageTraits.includes("ミダス")) {
    v.funds = clampValue(v.funds+amt, 0, 99999);
    resourceLabel = "資金";
  } else {
    addStoredResource(v, "food", amt);
  }

  let logMsg = `${p.name}農作業:${resourceLabel}+${amt},体力-${tc},メンタル-${mc}`;

  // ステータス上昇判定
  if (rollJobStatGrowth(p, "vit")) {
    addAcquiredStat(p, "vit", 1);
    logMsg += ",耐久+1";
  }
  if (rollJobStatGrowth(p, "ind")) {
    addAcquiredStat(p, "ind", 1);
    logMsg += ",勤勉+1";
  }

  // 特性取得判定
  if (p.spiritAge >= 30 && Math.random() < 0.01 && !p.mindTraits.includes("熟練農夫") && !p.mindTraits.includes("達人農夫")) {
    p.mindTraits.push("熟練農夫");
    logMsg += ",特性[熟練農夫]獲得";
  }
  if (p.mindTraits.includes("熟練農夫") && Math.random() < 0.01) {
    p.mindTraits = p.mindTraits.filter(t => t !== "熟練農夫");
    p.mindTraits.push("達人農夫");
    logMsg += ",特性[達人農夫]獲得";
  }

  v.log(logMsg);
}

function doLumber(p, v) {
  let tc=calcJobBodyCost("伐採", p, v);
  let mc=calcJobMindCost("伐採", p.ind, p, v);
  p.hp=clampValue(p.hp-tc,0,100);
  p.mp=clampValue(p.mp-mc,0,100);

  let amt=calculateLumberYield(p, v);
  addStoredResource(v, "materials", amt);

  let logMsg = `${p.name}伐採:資材+${amt},体力-${tc},メンタル-${mc}`;

  // ステータス上昇判定
  if (rollJobStatGrowth(p, "str")) {
    addAcquiredStat(p, "str", 1);
    logMsg += ",筋力+1";
  }
  if (rollJobStatGrowth(p, "ind")) {
    addAcquiredStat(p, "ind", 1);
    logMsg += ",勤勉+1";
  }

  // 特性取得判定
  if (p.spiritAge >= 30 && Math.random() < 0.01 && !p.mindTraits.includes("熟練木樵") && !p.mindTraits.includes("達人木樵")) {
    p.mindTraits.push("熟練木樵");
    logMsg += ",特性[熟練木樵]獲得";
  }
  if (p.mindTraits.includes("熟練木樵") && Math.random() < 0.01) {
    p.mindTraits = p.mindTraits.filter(t => t !== "熟練木樵");
    p.mindTraits.push("達人木樵");
    logMsg += ",特性[達人木樵]獲得";
  }

  v.log(logMsg);
}

function doHunt(p, v) {
  let tc=calcJobBodyCost("狩猟", p, v);
  let mc=calcJobMindCost("狩猟", p.cou, p, v);
  p.hp=clampValue(p.hp-tc,0,100);
  p.mp=clampValue(p.mp-mc,0,100);

  // 成功判定と基本値(X)の決定
  let r = randInt(1,100);
  let x = 0;
  let result = "";
  const failureThreshold = v.buildingFlags?.hasHuntingLodge ? 10 : 20;
  const successThreshold = v.buildingFlags?.hasHuntingLodge ? 80 : 80;
  if (r <= failureThreshold) {
    x = 0;
    result = "失敗";
  } else if (r <= successThreshold) {
    x = 30;
    result = "成功";
  } else {
    x = 70;
    result = "大成功";
  }
  
  let amt = calculateHuntYield(p, v, x);

  // ミダスの奇跡の効果
  if (v.villageTraits.includes("ミダス")) {
    v.funds = clampValue(v.funds+amt, 0, 99999);
    v.log(`${p.name}狩猟:${result} 資金+${amt},体力-${tc},メンタル-${mc}`);
  } else {
    addStoredResource(v, "food", amt);
    v.log(`${p.name}狩猟:${result} 食料+${amt},体力-${tc},メンタル-${mc}`);
  }
  if (result === "大成功") {
    incrementTitleCounter(p, TITLE_COUNTER_KEYS.HUNT_CRITICAL, 1, { getPermanentStat });
  }

  // ステータス上昇判定
  if (rollJobStatGrowth(p, "str")) {
    addAcquiredStat(p, "str", 1);
    v.log(`${p.name}狩猟:${result} 筋力+1`);
  }
  if (rollJobStatGrowth(p, "cou")) {
    addAcquiredStat(p, "cou", 1);
    v.log(`${p.name}狩猟:${result} 勇気+1`);
  }

  // 特性取得判定
  if (p.spiritAge >= 30 && Math.random() < 0.01 && !p.mindTraits.includes("熟練狩人") && !p.mindTraits.includes("達人狩人")) {
    p.mindTraits.push("熟練狩人");
    v.log(`${p.name}狩猟:${result} 特性[熟練狩人]獲得`);
  }
  if (p.mindTraits.includes("熟練狩人") && Math.random() < 0.01) {
    p.mindTraits = p.mindTraits.filter(t => t !== "熟練狩人");
    p.mindTraits.push("達人狩人");
    v.log(`${p.name}狩猟:${result} 特性[達人狩人]獲得`);
  }

}

function doFish(p, v) {
  let tc=calcJobBodyCost("漁", p, v);
  let mc=calcJobMindCost("漁", p.cou, p, v);
  p.hp=clampValue(p.hp-tc,0,100);
  p.mp=clampValue(p.mp-mc,0,100);

  // 成功判定と基本値(X)の決定
  let r = randInt(1,100);
  let x = 0;
  let result = "";
  const failureThreshold = v.buildingFlags?.hasDock ? 10 : 20;
  const successThreshold = v.buildingFlags?.hasDock ? 80 : 80;
  if (r <= failureThreshold) {
    x = 0;
    result = "失敗";
  } else if (r <= successThreshold) {
    x = 30;
    result = "成功";
  } else {
    x = 70;
    result = "大成功";
  }
  
  let amt = calculateFishYield(p, v, x);

  // ミダスの奇跡の効果
  if (v.villageTraits.includes("ミダス")) {
    v.funds = clampValue(v.funds+amt, 0, 99999);
    v.log(`${p.name}漁:${result} 資金+${amt},体力-${tc},メンタル-${mc}`);
  } else {
    addStoredResource(v, "food", amt);
    v.log(`${p.name}漁:${result} 食料+${amt},体力-${tc},メンタル-${mc}`);
  }
  if (result === "大成功") {
    incrementTitleCounter(p, TITLE_COUNTER_KEYS.FISH_CRITICAL, 1, { getPermanentStat });
  }

  // ステータス上昇判定
  if (rollJobStatGrowth(p, "vit")) {
    addAcquiredStat(p, "vit", 1);
    v.log(`${p.name}漁:${result} 耐久+1`);
  }
  if (rollJobStatGrowth(p, "cou")) {
    addAcquiredStat(p, "cou", 1);
    v.log(`${p.name}漁:${result} 勇気+1`);
  }

  // 特性取得判定
  if (p.int >= 20 && Math.random() < 0.03 && !p.mindTraits.includes("海の知恵")) {
    p.mindTraits.push("海の知恵");
    v.log(`${p.name}漁:${result} 特性[海の知恵]獲得`);
  }
  if (p.spiritAge >= 30 && Math.random() < 0.01 && !p.mindTraits.includes("熟練漁師") && !p.mindTraits.includes("達人漁師")) {
    p.mindTraits.push("熟練漁師");
    v.log(`${p.name}漁:${result} 特性[熟練漁師]獲得`);
  }
  if (p.mindTraits.includes("熟練漁師") && Math.random() < 0.01) {
    p.mindTraits = p.mindTraits.filter(t => t !== "熟練漁師");
    p.mindTraits.push("達人漁師");
    v.log(`${p.name}漁:${result} 特性[達人漁師]獲得`);
  }

}

function doGather(p, v) {
  let tc=calcJobBodyCost("採集", p, v);
  let mc=calcJobMindCost("採集", p.ind, p, v);
  p.hp=clampValue(p.hp-tc,0,100);
  p.mp=clampValue(p.mp-mc,0,100);

  let gatherYield = calculateGatherYield(p, v);
  let f = gatherYield.food;
  let mm= gatherYield.materials;

  // ミダスの奇跡の効果
  if (v.villageTraits.includes("ミダス")) {
    v.funds = clampValue(v.funds+f, 0, 99999);
    addStoredResource(v, "materials", mm);
    v.log(`${p.name}採集:資金+${f},資材+${mm},体力-${tc},メンタル-${mc}`);
  } else {
    addStoredResource(v, "food", f);
    addStoredResource(v, "materials", mm);
    v.log(`${p.name}採集:食料+${f},資材+${mm},体力-${tc},メンタル-${mc}`);
  }

  // ステータス上昇判定
  if (rollJobStatGrowth(p, "int")) {
    addAcquiredStat(p, "int", 1);
    v.log(`${p.name}採集:知力+1`);
  }
  if (rollJobStatGrowth(p, "dex")) {
    addAcquiredStat(p, "dex", 1);
    v.log(`${p.name}採集:器用+1`);
  }

  // 特性取得判定
  if (p.int >= 20 && Math.random() < 0.03 && !p.mindTraits.includes("森の知恵")) {
    p.mindTraits.push("森の知恵");
    v.log(`${p.name}採集:特性[森の知恵]獲得`);
  }
}

function doHandiwork(p, v) {
  let tc = calcJobBodyCost("内職", p, v);
  let mc = calcJobMindCost("内職", p.ind, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let amt = calculateHandiworkYield(p, v);
  v.funds = clampValue(v.funds+amt, 0, 99999);

  let logMsg = `${p.name}内職:資金+${amt},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "dex")) {
    addAcquiredStat(p, "dex", 1);
    logMsg += ",器用+1";
  }
  if (rollJobStatGrowth(p, "ind")) {
    addAcquiredStat(p, "ind", 1);
    logMsg += ",勤勉+1";
  }

  v.log(logMsg);
}

function doResearchJob(p, v) {
  doResearchLikeJob(p, v, "研究", calculateResearchYield);
}

function doResearchAssistantJob(p, v) {
  doResearchLikeJob(p, v, "研究助手", calculateResearchAssistantYield);
}

function doResearchLikeJob(p, v, jobName, calculateYield) {
  let tc = calcJobBodyCost(jobName, p, v);
  let mc = calcJobMindCost(jobName, p.int, p, v);

  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let gain = calculateYield(p, v);

  v.tech = clampValue(v.tech+gain, 0, 99999);

  let logMsg = `${p.name}${jobName}:技術+${gain},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "mag")) {
    addAcquiredStat(p, "mag", 1);
    logMsg += ",魔力+1";
  }
  if (rollJobStatGrowth(p, "int")) {
    addAcquiredStat(p, "int", 1);
    logMsg += ",知力+1";
  }

  v.log(logMsg);
}

function doGuardJob(p, v) {
  let tc = calcJobBodyCost("警備", p, v);
  let mc = calcJobMindCost("警備", p.cou, p, v);

  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let inc = calculateGuardYield(p);

  v.security = clampValue(v.security+inc, 0, 100);

  let logMsg = `${p.name}警備:治安+${inc},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "str")) {
    addAcquiredStat(p, "str", 1);
    logMsg += ",筋力+1";
  }
  if (rollJobStatGrowth(p, "eth")) {
    addAcquiredStat(p, "eth", 1);
    logMsg += ",倫理+1";
  }

  v.log(logMsg);
}

function doHealingJob(p, v) {
  let hpG = 20;
  let mpG = 20;
  
  // 中年/老人で効率補正
  if (p.bodyTraits.includes("中年")) {
    hpG = Math.floor(hpG * 0.8);
    mpG = Math.floor(mpG * 0.8);
  } else if (p.bodyTraits.includes("老人")) {
    hpG = Math.floor(hpG * 0.6);
    mpG = Math.floor(mpG * 0.6);
  }
  
  const recoveredTraits = HEALING_RECOVERABLE_BODY_TRAITS.filter(trait => p.bodyTraits.includes(trait));
  if (recoveredTraits.length > 0) {
    recoveredTraits.forEach(trait => restoreRecoveredBodyTraitStats(p, trait));
    p.bodyTraits = p.bodyTraits.filter(trait => !HEALING_RECOVERABLE_BODY_TRAITS.includes(trait));
    syncEffectiveStats(p);
    refreshJobTable(p, v);
  }

  const currentHp = Math.max(0, Number(p.hp) || 0);
  const currentMp = Math.max(0, Number(p.mp) || 0);
  p.hp = clampValue(currentHp + hpG, 0, 100);
  p.mp = clampValue(currentMp + mpG, 0, 100);

  let logMsg = `${p.name}療養:体力+${hpG},メンタル+${mpG}`;
  if (recoveredTraits.length > 0) {
    logMsg += `,${recoveredTraits.join(",")}が回復`;
  }
  
  v.log(logMsg);
}

function doLastMomentsJob(p, v) {
  v.log(`${p.name}は静かに迎えの時を待った`);
}

function doDancer(p, v) {
  let tc = calcJobBodyCost("踊り子", p, v);
  let mc = calcJobMindCost("踊り子", p.sexdr, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let inc = calculateDancerHappiness(p, v);
  
  let affected = 0;
  v.villagers.forEach(target => {
    if (target.spiritSex === "男") {
      target.happiness = clampValue(target.happiness + inc, 0, 100);
      affected++;
    }
  });

  let logMsg = `${p.name}踊り子:男性${affected}人の幸福+${inc},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "chr")) {
    addAcquiredStat(p, "chr", 1);
    logMsg += ",魅力+1";
  }
  if (rollJobStatGrowth(p, "sexdr")) {
    addAcquiredStat(p, "sexdr", 1);
    logMsg += ",好色+1";
  }

  v.log(logMsg);
}

function doPoet(p, v) {
  let tc = calcJobBodyCost("詩人", p, v);
  let mc = calcJobMindCost("詩人", p.int, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let inc = calculatePoetHappiness(p, v);
  
  let affected = 0;
  v.villagers.forEach(target => {
    if (target.spiritSex === "女") {
      target.happiness = clampValue(target.happiness + inc, 0, 100);
      affected++;
    }
  });

  let logMsg = `${p.name}詩人:女性${affected}人の幸福+${inc},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "chr")) {
    addAcquiredStat(p, "chr", 1);
    logMsg += ",魅力+1";
  }
  if (rollJobStatGrowth(p, "int")) {
    addAcquiredStat(p, "int", 1);
    logMsg += ",知力+1";
  }

  v.log(logMsg);
}

function doNurse(p, v) {
  let tc = calcJobBodyCost("看護", p, v);
  let mc = calcJobMindCost("看護", p.eth, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let lowestHP = 100;
  let targets = [];
  v.villagers.forEach(target => {
    if (target.hp < lowestHP) {
      lowestHP = target.hp;
      targets = [target];
    } else if (target.hp === lowestHP) {
      targets.push(target);
    }
  });

  let logMsg;
  if (targets.length > 0) {
    let target = targets[Math.floor(Math.random() * targets.length)];
    let heal = calculateNurseHeal(p, v);
    
    target.hp = clampValue(target.hp + heal, 0, 100);
    logMsg = `${p.name}看護:${target.name}の体力+${heal},体力-${tc},メンタル-${mc}`;
  } else {
    logMsg = `${p.name}看護:対象なし,体力-${tc},メンタル-${mc}`;
  }
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "mag")) {
    addAcquiredStat(p, "mag", 1);
    logMsg += ",魔力+1";
  }
  if (rollJobStatGrowth(p, "eth")) {
    addAcquiredStat(p, "eth", 1);
    logMsg += ",倫理+1";
  }

  v.log(logMsg);
}

function doSister(p, v) {
  let tc = calcJobBodyCost("シスター", p, v);
  let mc = calcJobMindCost("シスター", p.eth, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let heal = calculatePriestMindHeal(p, v);
  
  let affected = 0;
  v.villagers.forEach(target => {
    target.mp = clampValue(target.mp + heal, 0, 100);
    affected++;
  });

  let logMsg = `${p.name}シスター:全${affected}人のメンタル+${heal},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "chr")) {
    addAcquiredStat(p, "chr", 1);
    logMsg += ",魅力+1";
  }
  if (rollJobStatGrowth(p, "eth")) {
    addAcquiredStat(p, "eth", 1);
    logMsg += ",倫理+1";
  }

  v.log(logMsg);
}

function doPriest(p, v) {
  let tc = calcJobBodyCost("神官", p, v);
  let mc = calcJobMindCost("神官", p.eth, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let heal = calculatePriestMindHeal(p, v);
  
  let affected = 0;
  v.villagers.forEach(target => {
    target.mp = clampValue(target.mp + heal, 0, 100);
    affected++;
  });

  let logMsg = `${p.name}神官:全${affected}人のメンタル+${heal},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "chr")) {
    addAcquiredStat(p, "chr", 1);
    logMsg += ",魅力+1";
  }
  if (rollJobStatGrowth(p, "eth")) {
    addAcquiredStat(p, "eth", 1);
    logMsg += ",倫理+1";
  }

  v.log(logMsg);
}

function doTrading(p, v) {
  doTradingLike(p, v, "行商", calculateTradingYield);
}

function doApprentice(p, v) {
  doTradingLike(p, v, "丁稚", calculateApprenticeYield);
}

function doTradingLike(p, v, jobName, calculateYield) {
  let tc = calcJobBodyCost(jobName, p, v);
  let mc = calcJobMindCost(jobName, p.int, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  const r = randInt(1, 100);
  let x = 0;
  let result = "";
  const receivesMarketBonus = jobName === "行商" || jobName === "丁稚";
  const failureThreshold = receivesMarketBonus && v.buildingFlags?.hasMarket ? 10 : 20;
  const successThreshold = 80;
  if (r <= failureThreshold) {
    x = 0;
    result = "失敗";
  } else if (r <= successThreshold) {
    x = 30;
    result = "成功";
  } else {
    x = 70;
    result = "大成功";
  }

  let amt = calculateYield(p, x);

  v.funds = clampValue(v.funds+amt, 0, 99999);

  let logMsg = `${p.name}${jobName}:${result} 資金+${amt},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "chr")) {
    addAcquiredStat(p, "chr", 1);
    logMsg += ",魅力+1";
  }
  if (rollJobStatGrowth(p, "int")) {
    addAcquiredStat(p, "int", 1);
    logMsg += ",知力+1";
  }
  if (jobName === "行商" && result === "大成功") {
    incrementTitleCounter(p, TITLE_COUNTER_KEYS.TRADING_CRITICAL, 1, { getPermanentStat });
  }

  v.log(logMsg);
}

function doMassage(p, v) {
  let tc = calcJobBodyCost("あんま", p, v);
  let mc;
  let heal;
  let logMsg;

  if (p.bodySex === "男") {
    mc = calcJobMindCost("あんま", p.int, p, v);
    heal = calculateMassageHeal(p);
    logMsg = `${p.name}あんま:体力-${tc},メンタル-${mc}`;
    
    // ステータス上昇判定
    if (rollJobStatGrowth(p, "str")) {
      addAcquiredStat(p, "str", 1);
      logMsg += ",筋力+1";
    }
    if (rollJobStatGrowth(p, "int")) {
      addAcquiredStat(p, "int", 1);
      logMsg += ",知力+1";
    }
  } else {
    mc = calcJobMindCost("あんま", p.sexdr, p, v);
    heal = calculateMassageHeal(p);
    logMsg = `${p.name}あんま:体力-${tc},メンタル-${mc}`;
    
    // ステータス上昇判定
    if (rollJobStatGrowth(p, "chr")) {
      addAcquiredStat(p, "chr", 1);
      logMsg += ",魅力+1";
    }
    if (rollJobStatGrowth(p, "sexdr")) {
      addAcquiredStat(p, "sexdr", 1);
      logMsg += ",好色+1";
    }
  }

  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  // 体力が最も低い村人を探して回復
  let lowestHP = 100;
  let targets = [];
  v.villagers.forEach(target => {
    if (target.hp < lowestHP) {
      lowestHP = target.hp;
      targets = [target];
    } else if (target.hp === lowestHP) {
      targets.push(target);
    }
  });

  if (targets.length > 0) {
    let target = targets[Math.floor(Math.random() * targets.length)];
    target.hp = clampValue(target.hp + heal, 0, 100);
    logMsg += `,${target.name}の体力+${heal}`;
  }

  v.log(logMsg);
}

function doMiko(p, v) {
  let tc = calcJobBodyCost("巫女", p, v);
  let mc = calcJobMindCost("巫女", p.sexdr, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let manaGain = calculateMikoMana(p);
  v.mana = clampValue(v.mana + manaGain, 0, 99999);

  let logMsg = `${p.name}巫女:体力-${tc},メンタル-${mc},魔素+${manaGain}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "chr")) {
    addAcquiredStat(p, "chr", 1);
    logMsg += ",魅力+1";
  }
  if (rollJobStatGrowth(p, "sexdr")) {
    addAcquiredStat(p, "sexdr", 1);
    logMsg += ",好色+1";
  }

  v.log(logMsg);
}

function doBunny(p, v) {
  let tc = calcJobBodyCost("バニー", p, v);
  let mc = calcJobMindCost("バニー", p.sexdr, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let happinessInc = calculateBunnySupport(p);
  let mentalHeal = calculateBunnySupport(p);
  let affected = 0;

  v.villagers.forEach(target => {
    if (target.spiritSex === "男") {
      target.happiness = clampValue(target.happiness + happinessInc, 0, 100);
      target.mp = clampValue(target.mp + mentalHeal, 0, 100);
      affected++;
    }
  });

  let logMsg = `${p.name}バニー:男性${affected}人の幸福+${happinessInc},メンタル+${mentalHeal},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "chr")) {
    addAcquiredStat(p, "chr", 1);
    logMsg += ",魅力+1";
  }
  if (rollJobStatGrowth(p, "sexdr")) {
    addAcquiredStat(p, "sexdr", 1);
    logMsg += ",好色+1";
  }

  v.log(logMsg);
}

function doAlchemy(p, v) {
  let tc = calcJobBodyCost("錬金術", p, v);
  let mc = calcJobMindCost("錬金術", p.int, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  const alchemyYield = calculateAlchemyYield(p);
  let fundsGain = alchemyYield.funds;
  let manaGain = alchemyYield.mana;
  
  v.funds = clampValue(v.funds + fundsGain, 0, 99999);
  v.mana = clampValue(v.mana + manaGain, 0, 99999);

  let logMsg = `${p.name}錬金:資金+${fundsGain},魔素+${manaGain},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "mag")) {
    addAcquiredStat(p, "mag", 1);
    logMsg += ",魔力+1";
  }
  if (rollJobStatGrowth(p, "int")) {
    addAcquiredStat(p, "int", 1);
    logMsg += ",知力+1";
  }

  v.log(logMsg);
}

function doCopyBook(p, v) {
  let tc = calcJobBodyCost("写本", p, v);
  let mc = calcJobMindCost("写本", p.int, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let fundsGain = calculateCopyBookYield(p);
  let techGain = calculateCopyBookYield(p);
  
  v.funds = clampValue(v.funds + fundsGain, 0, 99999);
  v.tech = clampValue(v.tech + techGain, 0, 99999);

  let logMsg = `${p.name}写本:資金+${fundsGain},技術+${techGain},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "vit")) {
    addAcquiredStat(p, "vit", 1);
    logMsg += ",耐久+1";
  }
  if (rollJobStatGrowth(p, "int")) {
    addAcquiredStat(p, "int", 1);
    logMsg += ",知力+1";
  }

  v.log(logMsg);
}

function doWeaving(p, v) {
  let tc = calcJobBodyCost("機織り", p, v);
  let mc = calcJobMindCost("機織り", p.ind, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let fundsGain = calculateWeavingYield(p);
  v.funds = clampValue(v.funds + fundsGain, 0, 99999);

  let logMsg = `${p.name}機織り:資金+${fundsGain},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "dex")) {
    addAcquiredStat(p, "dex", 1);
    logMsg += ",器用+1";
  }
  if (rollJobStatGrowth(p, "ind")) {
    addAcquiredStat(p, "ind", 1);
    logMsg += ",勤勉+1";
  }

  v.log(logMsg);
}

function doBrewing(p, v) {
  let tc = calcJobBodyCost("醸造", p, v);
  let mc = calcJobMindCost("醸造", p.ind, p, v);
  p.hp = clampValue(p.hp-tc, 0, 100);
  p.mp = clampValue(p.mp-mc, 0, 100);

  let brewingYield = calculateBrewingYield(p, v);
  let foodGain = brewingYield.food;
  let manaGain = brewingYield.mana;

  const foodResourceName = v.villageTraits.includes("ミダス") ? "資金" : "食料";
  if (v.villageTraits.includes("ミダス")) {
    v.funds = clampValue(v.funds + foodGain, 0, 99999);
  } else {
    addStoredResource(v, "food", foodGain);
  }
  v.mana = clampValue(v.mana + manaGain, 0, 99999);

  let logMsg = `${p.name}醸造:${foodResourceName}+${foodGain},魔素+${manaGain},体力-${tc},メンタル-${mc}`;
  
  // ステータス上昇判定
  if (rollJobStatGrowth(p, "mag")) {
    addAcquiredStat(p, "mag", 1);
    logMsg += ",魔力+1";
  }
  if (rollJobStatGrowth(p, "vit")) {
    addAcquiredStat(p, "vit", 1);
    logMsg += ",耐久+1";
  }
  if (rollJobStatGrowth(p, "ind")) {
    addAcquiredStat(p, "ind", 1);
    logMsg += ",勤勉+1";
  }

  v.log(logMsg);
}
