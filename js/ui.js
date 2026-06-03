// ui.js

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
  estimateBodyCost,
  estimateMindCost,
  getJobCostType,
} from "./domain/jobMath.js";
import {
  ACTION_CRADLE,
  ACTION_HEAL,
  ACTION_LAST_MOMENTS,
  ACTION_NONE,
  isPreferredActionCandidate,
  setPreferredAction,
  refreshJobTable
} from "./domain/jobTables.js";
import { getResourceStorageStatus, getResourceStorageWarningRatio } from "./domain/resourceLimits.js";
import { isUnassignedActionVillager } from "./domain/rules.js";
import { showDictionaryEntry } from "./dictionary.js";
import { combinedDictionaryData } from "./data/dictionaryData.js";
import { getPortraitPath, getVillagerFoodConsumption, getVillagerWinterMaterialConsumption } from "./util.js";
import { openPersonalHistoryModal } from "./history.js";
import { formatRelationshipsForDisplay, normalizeRelationship } from "./relationships.js";
import { applyVillageScaleArtClass, getVillageScaleTitle } from "./villageScale.js";


function openConversationFor(person) {
  import("./conversation.js").then(({ openConversationModal }) => {
    openConversationModal(person);
  });
}

const STAT_EFFECT_TOOLTIP_EXCEPTIONS = new Set(["本の虫", "巨躯", "箱入り", "内向的"]);
const STAT_EFFECT_NAMES = ["筋力", "耐久", "器用", "魔力", "魅力", "知力", "勤勉", "倫理", "勇気", "好色"];
const DYNAMIC_STAT_EFFECT_NAMES = ["幸福", "体力", "メンタル"];

function getDictionaryEntryForTooltip(label, category) {
  if (category === "hobby") {
    return combinedDictionaryData[`趣味:${label}`] || combinedDictionaryData[label] || null;
  }
  return combinedDictionaryData[label] || null;
}

function extractStatEffectParts(details) {
  return details
    .flatMap(detail => String(detail || "")
      .replace(/^ステータス補正:\s*/, "")
      .replace(/^影響:\s*/, "")
      .split(/[。、,]/))
    .map(part => DYNAMIC_STAT_EFFECT_NAMES.reduce((text, stat) => text
      .replaceAll(`${stat}・`, "")
      .replaceAll(`・${stat}`, "")
      .replaceAll(stat, ""), part.trim().replace(/^付与時に/, ""))
      .replace(/^・|・$/g, "")
      .trim())
    .filter(part => {
      if (!part || part.includes("直接補正なし") || part.includes("補正なし")) return false;
      if (!STAT_EFFECT_NAMES.some(stat => part.includes(stat))) return false;
      return /[+\-]\d|\*\d|×\d|\d+(?:\.\d+)?倍|低下|上昇/.test(part);
    });
}

function getTermTooltip(label, category) {
  const entry = getDictionaryEntryForTooltip(label, category);
  if (!entry) return `${label}の辞書を表示`;

  const lines = [entry.description].filter(Boolean);
  const details = Array.isArray(entry.details) ? entry.details : [];
  if (category === "trait" && !STAT_EFFECT_TOOLTIP_EXCEPTIONS.has(label)) {
    const statEffects = [...new Set(extractStatEffectParts(details))];
    if (statEffects.length > 0) {
      lines.push(`ステータス: ${statEffects.join("、")}`);
    }
  } else if (category === "hobby") {
    const hobbyEffect = details
      .map(detail => String(detail || ""))
      .find(detail => detail.startsWith("趣味効果:"));
    if (hobbyEffect) lines.push(hobbyEffect);
  }
  return lines.join("\n");
}

function appendDictionaryTerm(parent, term, options = {}) {
  const label = String(term || "").trim();
  if (!label) return;

  const span = document.createElement("span");
  span.className = "dictionary-term";
  span.tabIndex = 0;
  span.textContent = label;
  span.title = getTermTooltip(label, options.category);
  span.onmouseenter = () => showDictionaryEntry(label);
  span.onfocus = () => showDictionaryEntry(label);
  parent.appendChild(span);
}

function setDictionaryTerms(cell, terms, options = {}) {
  cell.textContent = "";
  const list = Array.isArray(terms) ? terms.filter(Boolean) : [];
  if (list.length === 0) return;

  list.forEach((term, index) => {
    if (index > 0) cell.appendChild(document.createTextNode(","));
    appendDictionaryTerm(cell, term, options);
  });
}

function getMonthlyFoodCost(village) {
  return village.villagers.reduce((sum, person) => {
    return sum + getVillagerFoodConsumption(person);
  }, 0);
}

function getWinterMonthsToPrepare(month) {
  if ([12, 1, 2].includes(month)) {
    if (month === 12) return 3;
    if (month === 1) return 2;
    return 1;
  }
  return 3;
}

function buildWarningMessages(village) {
  const warnings = [];
  const villagers = Array.isArray(village.villagers) ? village.villagers : [];
  const foodStorage = getResourceStorageStatus(village, "food");
  const materialStorage = getResourceStorageStatus(village, "materials");
  const storageWarningRatio = getResourceStorageWarningRatio(village);
  const foodCost = getMonthlyFoodCost(village);
  const monthsOfFood = foodCost > 0 ? village.food / foodCost : Infinity;
  const winterNeed = villagers.reduce((sum, person) => sum + getVillagerWinterMaterialConsumption(person), 0) * getWinterMonthsToPrepare(village.month);
  const lowHpCount = villagers.filter(person => Number(person.hp) <= 33).length;
  const lowMpCount = villagers.filter(person => Number(person.mp) <= 33).length;
  const noActionCount = villagers.filter(isUnassignedActionVillager).length;
  const assemblyHallBuilt = !!(
    village.buildingFlags?.hasAssemblyHall ||
    (Array.isArray(village.buildings) && village.buildings.includes("assemblyHall"))
  );

  if (foodCost > 0 && monthsOfFood <= 3) {
    warnings.push({
      level: monthsOfFood <= 1 ? "danger" : "warning",
      text: `食料が尽きそうです。このペースでは約${Math.max(0, monthsOfFood).toFixed(1)}か月で枯渇する可能性があります。`
    });
  }

  if (foodStorage.ratio >= 1) {
    warnings.push({
      level: "danger",
      text: `食料が保管上限に達しています。現在${foodStorage.current}/${foodStorage.limit}です。これ以上の余剰分は廃棄されます。`
    });
  } else if (foodStorage.ratio >= storageWarningRatio) {
    warnings.push({
      level: "warning",
      text: `食料の保管上限が近づいています。現在${foodStorage.current}/${foodStorage.limit}です。余剰分は廃棄されます。`
    });
  }

  if (materialStorage.ratio >= 1) {
    warnings.push({
      level: "danger",
      text: `資材が保管上限に達しています。現在${materialStorage.current}/${materialStorage.limit}です。これ以上の余剰分は廃棄されます。`
    });
  } else if (materialStorage.ratio >= storageWarningRatio) {
    warnings.push({
      level: "warning",
      text: `資材の保管上限が近づいています。現在${materialStorage.current}/${materialStorage.limit}です。余剰分は廃棄されます。`
    });
  }

  if (winterNeed > 0 && village.materials < winterNeed) {
    warnings.push({
      level: [12, 1, 2].includes(village.month) ? "danger" : "warning",
      text: `冬の資材備蓄が不足気味です。目安${winterNeed}に対して現在${village.materials}です。`
    });
  }

  if (village.security <= 30) {
    warnings.push({
      level: "danger",
      text: "治安が危険域です。荒廃や襲撃リスクに注意してください。"
    });
  } else if (village.security < 40) {
    warnings.push({
      level: "warning",
      text: "治安が低下しています。警備や治安回復を検討してください。"
    });
  }

  if (villagers.length >= village.popLimit) {
    warnings.push({
      level: "warning",
      text: "人口が上限に達しています。新規加入には家屋が必要です。"
    });
  }

  if (lowHpCount > 0 || lowMpCount > 0) {
    warnings.push({
      level: lowHpCount + lowMpCount >= Math.max(2, Math.ceil(villagers.length / 3)) ? "danger" : "warning",
      text: `消耗している村人がいます。体力低下${lowHpCount}人、メンタル低下${lowMpCount}人。`
    });
  }

  if (noActionCount > 0) {
    warnings.push({
      level: "warning",
      text: `行動が未設定の村人が${noActionCount}人います。必要なら自動割り振りを使えます。`
    });
  }

  if ((Number(village.building) || 0) >= 120 && !assemblyHallBuilt) {
    warnings.push({
      level: "warning",
      text: "旅人が足を止める規模になりました。村の声を一つに束ねる集会所を建てれば、里長を選べるようになります。"
    });
  }

  if (village.pendingRaid?.prophecyNotified) {
    const raidName = village.pendingRaid.warningName || village.pendingRaid.raidName || "襲撃者";
    warnings.push({
      level: "danger",
      text: `太陽神の予言: 来月、${raidName}の襲撃が予見されています。防衛準備を確認してください。`
    });
  }

  if (village.villageTraits.includes("襲撃中")) {
    warnings.push({
      level: "danger",
      text: "襲撃中です。前衛・中衛・後衛の行動割り振りを確認してください。"
    });
  }

  return warnings;
}

function updateMessageWindow(village) {
  const windowEl = document.getElementById("messageWindow");
  if (!windowEl) return;

  const messages = buildWarningMessages(village);
  const body = messages.length > 0
    ? messages.map(item => `<div class="message-item ${item.level}">${item.text}</div>`).join("")
    : '<div class="message-empty">警告はありません</div>';

  windowEl.innerHTML = `
    ${body}
  `;
}

function hasTrait(person, trait) {
  return (Array.isArray(person.bodyTraits) && person.bodyTraits.includes(trait))
    || (Array.isArray(person.mindTraits) && person.mindTraits.includes(trait));
}

const STAT_CELL_INDEXES = {
  str: 12,
  vit: 13,
  dex: 14,
  mag: 15,
  chr: 16,
  int: 18,
  ind: 19,
  eth: 20,
  cou: 21,
  sexdr: 22
};

function getDebuffedStats(person) {
  const debuffed = new Set();
  const add = (...stats) => stats.forEach(stat => debuffed.add(stat));

  if (hasTrait(person, "飢餓")) add("str", "vit", "dex");
  if (hasTrait(person, "凍え")) add("str", "vit", "dex");
  if (hasTrait(person, "疲労")) add("str", "vit", "dex");
  if (hasTrait(person, "過労")) add("str", "vit", "dex");
  if (hasTrait(person, "臨月")) add("str", "vit");
  if (hasTrait(person, "産褥")) add("str", "vit");
  if (hasTrait(person, "心労")) add("int", "ind", "eth", "cou", "sexdr");
  if (hasTrait(person, "抑鬱")) add("int", "ind", "eth", "cou", "sexdr");

  return debuffed;
}

function applyStatusHighlights(row, person) {
  const debuffedStats = getDebuffedStats(person);
  Object.entries(STAT_CELL_INDEXES).forEach(([stat, cellIndex]) => {
    const cell = row.cells[cellIndex];
    if (!cell) return;
    const value = parseInt(cell.textContent, 10);
    if (debuffedStats.has(stat)) {
      cell.classList.add("status-debuff");
    } else if (value >= 20) {
      cell.classList.add("bold-value");
    }
  });

  const happinessCell = row.cells[10];
  if (happinessCell) happinessCell.style.color = "#000";
}

function bodyCost(base, person, village) {
  return estimateBodyCost(base, person?.vit, person, village);
}

function mindCost(base, stat, person, village) {
  return estimateMindCost(base, person?.[stat], person, village);
}

function jobBodyCost(job, person, village) {
  return bodyCost(getJobCostType(job).body, person, village);
}

function jobMindCost(job, stat, person, village) {
  return mindCost(getJobCostType(job).mind, stat, person, village);
}

function ageRestMultiplier(person) {
  if (hasTrait(person, "老人")) return 0.7;
  if (hasTrait(person, "中年")) return 0.9;
  return 1;
}

function hasCurrentHobbyMate(person) {
  if (!person.hobby || !Array.isArray(person.relationships)) return false;
  return person.relationships.some(rel => {
    const normalized = normalizeRelationship(rel);
    return normalized.includes(`${person.hobby}仲間：`);
  });
}

function formatEstimate(parts) {
  return parts
    .filter(Boolean)
    .filter(part => !/^体力-\d+/.test(part) && !/^メンタル-\d+/.test(part))
    .join(", ");
}

function isMobileViewMode() {
  return document.body && document.body.classList.contains("mobile-mode");
}

function getStorageClass(status, warningRatio) {
  if (status.current >= status.limit) return " resource-at-limit";
  if (status.ratio >= warningRatio) return " resource-near-limit";
  return "";
}

function compactEstimateText(text) {
  return text
    .replaceAll("想定ダメージ", "想定")
    .replace(/（大成功[^）]*）/g, "")
    .replace(/(幸福|メンタル|体力)([+-]\d+)/g, "$1 $2")
    .replaceAll("幸福", "幸")
    .replaceAll("メンタル", "ﾒﾝﾀﾙ")
    .replaceAll(", ", ",");
}

function compactStatText(text) {
  return text
    .replaceAll("筋力", "筋")
    .replaceAll("耐久", "耐")
    .replaceAll("器用", "器")
    .replaceAll("魔力", "魔")
    .replaceAll("魅力", "魅")
    .replaceAll("知力", "知")
    .replaceAll("勤勉", "勤")
    .replaceAll("倫理", "倫")
    .replaceAll("勇気", "勇")
    .replaceAll("好色", "色");
}

function resourceName(village, normalName) {
  return village.villageTraits.includes("ミダス") && normalName === "食料" ? "資金" : normalName;
}

function formatRandomHarvestReward(resource, successAmount, criticalAmount, failureAmount = 0) {
  return `${resource}+${successAmount}（大成功+${criticalAmount},失敗+${failureAmount}）`;
}

function getRandomHarvestRewardPart(person, village, action) {
  const resource = resourceName(village, "食料");
  const calc = action === "漁" ? calculateFishYield : calculateHuntYield;
  return formatRandomHarvestReward(resource, calc(person, village, 30), calc(person, village, 70), calc(person, village, 0));
}

function getRandomTradingRewardPart(person, calculateYield = calculateTradingYield) {
  return formatRandomHarvestReward("資金", calculateYield(person, 30), calculateYield(person, 70), calculateYield(person, 0));
}

function estimateDefendDamage(person, village) {
  if (hasTrait(person, "非戦主義")) return 0;

  const enemies = Array.isArray(village.raidEnemies)
    ? village.raidEnemies.filter(enemy => Number(enemy.hp) > 0)
    : [];
  const avgEnemyVit = enemies.length > 0
    ? enemies.reduce((sum, enemy) => sum + (Number(enemy.vit) || 0), 0) / enemies.length
    : 0;
  const physical = Math.max(0, Math.floor((((Number(person.str) || 0) * (Number(person.cou) || 0)) / 400) * 50 - avgEnemyVit));
  const magical = Math.max(0, Math.floor((((Number(person.mag) || 0) * (Number(person.cou) || 0)) / 400) * 25));
  let damage = Math.max(physical, magical);
  if (hasTrait(person, "歴戦")) {
    damage = Math.floor(damage * 1.2);
  }
  return damage;
}

function estimateTrapDamage(person) {
  return Math.floor(((Number(person.dex) || 0) * (Number(person.int) || 0) / 400) * 30);
}

function estimateShootDamage(person, village) {
  const enemies = Array.isArray(village.raidEnemies)
    ? village.raidEnemies.filter(enemy => Number(enemy.hp) > 0)
    : [];
  const avgEnemyVit = enemies.length > 0
    ? enemies.reduce((sum, enemy) => sum + (Number(enemy.vit) || 0), 0) / enemies.length
    : 0;
  return Math.max(0, Math.floor((((Number(person.dex) || 0) * (Number(person.cou) || 0)) / 400) * 40 - avgEnemyVit * 1.5));
}

function getTaskEstimateParts(person, task, village) {
  const chr = Number(person.chr) || 0;
  const cou = Number(person.cou) || 0;
  const dex = Number(person.dex) || 0;
  const eth = Number(person.eth) || 0;
  const ind = Number(person.ind) || 0;
  const intv = Number(person.int) || 0;
  const mag = Number(person.mag) || 0;
  const sexdr = Number(person.sexdr) || 0;
  const str = Number(person.str) || 0;
  const vit = Number(person.vit) || 0;
  const church = village.buildingFlags && village.buildingFlags.hasChurch;
  const clinic = village.buildingFlags && village.buildingFlags.hasClinic;
  const library = village.buildingFlags && village.buildingFlags.hasLibrary;
  const tavern = village.buildingFlags && village.buildingFlags.hasTavern;
  const voice = hasTrait(person, "澄んだ声") || hasTrait(person, "通る声");
  const affectedMen = village.villagers.filter(v => v.spiritSex === "男").length;
  const affectedWomen = village.villagers.filter(v => v.spiritSex === "女").length;
  const affectedAll = village.villagers.length;
  let gain = 0;
  let parts = [];

  // jobMath.js と共有していない表示計算は、対象選択やランダム分岐を単純化した目安用です。
  // 実処理の成果量まで安全に共有できる行動は、下の各 case から jobMath.js を参照します。
  switch (task) {
    case "揺籃":
      parts = ["体力+30", "メンタル+30", "幸福+30"];
      break;
    case "休養": {
      let hp = person.mindTraits.includes("ワーカホリック") ? 30 : 54;
      let mp = person.mindTraits.includes("ワーカホリック") ? -10 : 21;
      hp = Math.floor(hp * ageRestMultiplier(person));
      mp = Math.floor(mp * ageRestMultiplier(person));
      parts = [`体力+${hp}`, `メンタル${mp >= 0 ? "+" : ""}${mp}`];
      break;
    }
    case "余暇": {
      let mp = person.mindTraits.includes("ニート") ? 100 : 50;
      if (hasCurrentHobbyMate(person)) mp = Math.round(mp * 1.5);
      parts = [`メンタル+${mp}`];
      break;
    }
    case "遊び":
      parts = [`体力-${bodyCost(5, person, village)}`, "メンタル+20", "幸福+15"];
      break;
    case "お手伝い":
      parts = ["食料+3〜6", "資材+3〜6", `体力-${bodyCost(10, person, village)}`];
      break;
    case "療養":
      parts = [`体力+${Math.floor(20 * (hasTrait(person, "老人") ? 0.6 : hasTrait(person, "中年") ? 0.8 : 1))}`, `メンタル+${Math.floor(20 * (hasTrait(person, "老人") ? 0.6 : hasTrait(person, "中年") ? 0.8 : 1))}`];
      break;
    case "農作業":
      gain = calculateFarmYield(person, village);
      parts = [`${resourceName(village, "食料")}+${gain}`, `体力-${jobBodyCost("農作業", person, village)}`, `メンタル-${jobMindCost("農作業", "ind", person, village)}`];
      break;
    case "伐採":
      gain = calculateLumberYield(person, village);
      parts = [`資材+${gain}`, `体力-${jobBodyCost("伐採", person, village)}`, `メンタル-${jobMindCost("伐採", "ind", person, village)}`];
      break;
    case "狩猟":
      parts = [getRandomHarvestRewardPart(person, village, "狩猟"), `体力-${jobBodyCost("狩猟", person, village)}`, `メンタル-${jobMindCost("狩猟", "cou", person, village)}`];
      break;
    case "漁":
      parts = [getRandomHarvestRewardPart(person, village, "漁"), `体力-${jobBodyCost("漁", person, village)}`, `メンタル-${jobMindCost("漁", "cou", person, village)}`];
      break;
    case "採集": {
      const gatherYield = calculateGatherYield(person, village);
      parts = [`${resourceName(village, "食料")}+${gatherYield.food}`, `資材+${gatherYield.materials}`, `体力-${jobBodyCost("採集", person, village)}`, `メンタル-${jobMindCost("採集", "ind", person, village)}`];
      break;
    }
    case "内職":
      parts = [`資金+${calculateHandiworkYield(person, village)}`, `体力-${jobBodyCost("内職", person, village)}`, `メンタル-${jobMindCost("内職", "ind", person, village)}`];
      break;
    case "行商":
      parts = [getRandomTradingRewardPart(person), `体力-${jobBodyCost("行商", person, village)}`, `メンタル-${jobMindCost("行商", "int", person, village)}`];
      break;
    case "丁稚":
      parts = [getRandomTradingRewardPart(person, calculateApprenticeYield), `体力-${jobBodyCost("丁稚", person, village)}`, `メンタル-${jobMindCost("丁稚", "int", person, village)}`];
      break;
    case "研究":
      gain = calculateResearchYield(person, village);
      parts = [`技術+${gain}`, `体力-${jobBodyCost("研究", person, village)}`, `メンタル-${jobMindCost("研究", "int", person, village)}`];
      break;
    case "研究助手":
      gain = calculateResearchAssistantYield(person, village);
      parts = [`技術+${gain}`, `体力-${jobBodyCost("研究助手", person, village)}`, `メンタル-${jobMindCost("研究助手", "int", person, village)}`];
      break;
    case "警備":
      parts = [`治安+${calculateGuardYield(person)}`, `体力-${jobBodyCost("警備", person, village)}`, `メンタル-${jobMindCost("警備", "cou", person, village)}`];
      break;
    case "看護":
      gain = calculateNurseHeal(person, village);
      parts = [`体力回復+${gain}`, `体力-${jobBodyCost("看護", person, village)}`, `メンタル-${jobMindCost("看護", "eth", person, village)}`];
      break;
    case "あんま":
      gain = calculateMassageHeal(person);
      parts = [`体力回復+${gain}`, `体力-${jobBodyCost("あんま", person, village)}`, `メンタル-${jobMindCost("あんま", person.bodySex === "男" ? "int" : "sexdr", person, village)}`];
      break;
    case "シスター":
    case "神官":
      gain = calculatePriestMindHeal(person, village);
      parts = [`全員メンタル+${gain}`, `体力-${jobBodyCost(task, person, village)}`, `メンタル-${jobMindCost(task, "eth", person, village)}`];
      break;
    case "踊り子":
      gain = calculateDancerHappiness(person, village);
      parts = [`男性${affectedMen}人幸福+${gain}`, `体力-${jobBodyCost("踊り子", person, village)}`, `メンタル-${jobMindCost("踊り子", "sexdr", person, village)}`];
      break;
    case "詩人":
      gain = calculatePoetHappiness(person, village);
      parts = [`女性${affectedWomen}人幸福+${gain}`, `体力-${jobBodyCost("詩人", person, village)}`, `メンタル-${jobMindCost("詩人", "int", person, village)}`];
      break;
    case "バニー":
      gain = calculateBunnySupport(person);
      parts = [`男性${affectedMen}人幸福/メンタル+${gain}`, `体力-${jobBodyCost("バニー", person, village)}`, `メンタル-${jobMindCost("バニー", "sexdr", person, village)}`];
      break;
    case "巫女":
      parts = [`魔素+${calculateMikoMana(person)}`, `体力-${jobBodyCost("巫女", person, village)}`, `メンタル-${jobMindCost("巫女", "sexdr", person, village)}`];
      break;
    case "錬金術":
      gain = calculateAlchemyYield(person);
      parts = [`資金+${gain.funds}`, `魔素+${gain.mana}`, `体力-${jobBodyCost("錬金術", person, village)}`, `メンタル-${jobMindCost("錬金術", "int", person, village)}`];
      break;
    case "写本":
      gain = calculateCopyBookYield(person);
      parts = [`資金/技術+${gain}`, `体力-${jobBodyCost("写本", person, village)}`, `メンタル-${jobMindCost("写本", "int", person, village)}`];
      break;
    case "機織り":
      parts = [`資金+${calculateWeavingYield(person)}`, `体力-${jobBodyCost("機織り", person, village)}`, `メンタル-${jobMindCost("機織り", "ind", person, village)}`];
      break;
    case "醸造": {
      const brewingYield = calculateBrewingYield(person, village);
      parts = [`${resourceName(village, "食料")}+${brewingYield.food}`, `魔素+${brewingYield.mana}`, `体力-${jobBodyCost("醸造", person, village)}`, `メンタル-${jobMindCost("醸造", "ind", person, village)}`];
      break;
    }
    case "迎撃":
      parts = [`想定ダメージ${estimateDefendDamage(person, village)}`];
      break;
    case "籠城":
      parts = ["攻撃なし", "被ダメージ0.8倍", "反撃あり"];
      break;
    case "射撃":
      parts = [`想定ダメージ${estimateShootDamage(person, village)}`, "反撃なし"];
      break;
    case "罠作成":
      parts = [`想定ダメージ${estimateTrapDamage(person)}`];
      break;
  }

  return parts;
}

function getTaskRewardEstimate(person, task, village) {
  return formatEstimate(getTaskEstimateParts(person, task, village));
}

function getTaskCostEstimate(person, task, village) {
  return getTaskEstimateParts(person, task, village)
    .filter(part => /^体力-\d+/.test(part) || /^メンタル-\d+/.test(part))
    .join(", ");
}

function getTaskEstimate(person, task, village) {
  const estimate = getTaskRewardEstimate(person, task, village);
  if (!estimate) return task;
  return isMobileViewMode()
    ? `${task}(${compactEstimateText(estimate)})`
    : `${task} (${estimate})`;
}

const ACTION_DESCRIPTIONS = {
  "揺籃": "無垢な精神が揺籃の中で守られ、成長を待つ行動。",
  "休養": "体力の回復を優先する一時行動。",
  "余暇": "趣味や息抜きでメンタルを回復する一時行動。",
  "療養": "負傷・病気・産褥などで行動不能のときに固定される回復行動。",
  "臨終": "危篤状態の固定行動。通常の作業には参加できない。",
  "遊び": "幼い精神が遊びを通じて心身を整える成長段階の行動。",
  "お手伝い": "幼い精神が村の作業を少し手伝い、食料と資材を得る行動。",
  "農作業": "畑を耕し、村の食料を支える基礎的な生産行動。",
  "伐採": "木材を切り出し、建築や冬支度に必要な資材を得る生産行動。",
  "狩猟": "野に出て、危険を伴いながら食料を得る行動。",
  "漁": "水辺で食料を得る行動。",
  "採集": "野山から食料や資材を集める柔軟な生産行動。",
  "内職": "小さな手仕事で資金を得る生産系の行動。",
  "行商": "外部と取引し、成功すれば資金を得る行動。",
  "丁稚": "思春期の精神が商いを手伝い、成功すれば資金を得る行動。",
  "研究": "知識を蓄積し、村の技術を高める行動。",
  "研究助手": "思春期の精神が研究を手伝い、村の技術を高める行動。",
  "警備": "村を見回り、治安を支える防衛行動。",
  "看護": "負傷者や消耗した村人を支える回復行動。",
  "あんま": "身体感覚や対人能力を活かして村人の体力回復を支える行動。",
  "シスター": "村人の心を支える信仰系の回復行動。",
  "神官": "村人の心を支える信仰系の回復行動。",
  "踊り子": "娯楽を通じて村人の幸福を高める行動。",
  "詩人": "詩や歌で村人の幸福を高める行動。",
  "バニー": "酒場で男性村人の幸福とメンタルを支える行動。",
  "巫女": "信仰と儀式を通じて魔素を得る行動。",
  "錬金術": "資金や魔素を生み出す高度な生産行動。",
  "写本": "写本を行い、資金や技術を得る行動。",
  "機織り": "布を織り、資金を得る生産行動。",
  "醸造": "酒を仕込み、食料と魔素を得る行動。",
  "迎撃": "襲撃中に敵へ直接攻撃する一時行動。",
  "籠城": "襲撃中に前衛で守りを固め、攻撃された時に反撃する一時行動。",
  "射撃": "襲撃中に中衛から攻撃し、反撃を受けない一時行動。",
  "罠作成": "襲撃中に罠を作り、敵へ事前ダメージを与える一時行動。"
};

function getActionDescription(action) {
  return ACTION_DESCRIPTIONS[action] || "この行動を実行します。";
}

function getActionOptionTitle(person, action, village) {
  const reward = getTaskRewardEstimate(person, action, village) || "なし";
  const cost = getTaskCostEstimate(person, action, village) || "なし";
  const stats = JOB_KEY_STATS[action];
  const lines = [getActionDescription(action)];
  if (stats) lines.push(`判定能力:${stats}`);
  lines.push(`予想獲得報酬: ${reward}`);
  lines.push(`予想体力・メンタル消費: ${cost}`);
  return lines.join("\n");
}

const JOB_KEY_STATS = {
  "農作業": "耐久×勤勉",
  "伐採": "筋力×勤勉",
  "狩猟": "筋力×勇気",
  "漁": "耐久×勇気",
  "採集": "器用×知力",
  "内職": "器用×勤勉",
  "研究": "魔力×知力",
  "研究助手": "魔力×知力",
  "警備": "筋力×倫理",
  "看護": "魔力×倫理",
  "踊り子": "魅力×好色",
  "詩人": "魅力×知力",
  "シスター": "魅力×倫理",
  "神官": "魅力×倫理",
  "行商": "魅力×知力",
  "丁稚": "魅力×知力",
  "あんま": "男性:筋力×知力/女性:魅力×好色",
  "巫女": "魅力×魔力×好色",
  "バニー": "魅力×好色",
  "錬金術": "魔力×知力",
  "写本": "耐久×知力",
  "機織り": "器用×勤勉",
  "醸造": "魔力×耐久×勤勉",
  "迎撃": "筋力/魔力×勇気",
  "籠城": "耐久×勇気",
  "射撃": "器用×勇気",
  "罠作成": "器用×知力"
};

function getJobLabel(job, compact = false) {
  if (!JOB_KEY_STATS[job]) return job;
  const stats = compact ? compactStatText(JOB_KEY_STATS[job]) : JOB_KEY_STATS[job];
  return compact ? `${job}(${stats})` : `${job}（${stats}）`;
}

function getActionRewardLabel(person, action, village) {
  return getTaskRewardEstimate(person, action, village) || "";
}

function getActionOptionLabel(person, action, village) {
  const statLabel = getJobLabel(action, true);
  const reward = getActionRewardLabel(person, action, village);
  const compactReward = reward ? compactEstimateText(reward) : "";
  if (statLabel !== action && compactReward) {
    return `${statLabel} ${compactReward}`;
  }
  if (statLabel !== action) return statLabel;
  if (compactReward) return `${action} ${compactReward}`;
  return action;
}

function appendTextCell(row, value, className = "") {
  const cell = document.createElement("td");
  if (className) cell.classList.add(className);
  cell.textContent = value ?? "";
  row.appendChild(cell);
  return cell;
}

function appendNumberCell(row, value) {
  return appendTextCell(row, Math.floor(Number(value) || 0));
}

function appendPortraitCell(row, person) {
  const cell = document.createElement("td");
  cell.classList.add("villager-portrait-cell");
  cell.style.cursor = "pointer";
  cell.onclick = () => openConversationFor(person);

  const frame = document.createElement("div");
  frame.classList.add("villager-portrait-frame");

  const portrait = document.createElement("img");
  portrait.classList.add("villager-portrait");
  portrait.src = getPortraitPath(person);
  portrait.alt = person.name;
  portrait.loading = "lazy";

  frame.appendChild(portrait);
  cell.appendChild(frame);
  row.appendChild(cell);
}

function appendDictionaryCell(row, terms, options = {}) {
  const cell = document.createElement("td");
  setDictionaryTerms(cell, terms, options);
  row.appendChild(cell);
}

function appendIdentityCells(row, person) {
  appendPortraitCell(row, person);

  const nameCell = appendTextCell(row, person.name);
  nameCell.style.cursor = "pointer";
  nameCell.onclick = () => openConversationFor(person);

  appendTextCell(row, person.bodyOwner);
  appendTextCell(row, person.race);
  // bodySex/bodyAge と spiritSex/spiritAge は別仕様。表示時も統合しない。
  appendTextCell(row, person.bodySex);
  appendTextCell(row, person.bodyAge);
  const spiritSexCell = appendTextCell(row, person.spiritSex, "spirit-column");
  if (person.spiritSex === "男") {
    spiritSexCell.classList.add("male-basic");
  } else if (person.spiritSex === "女") {
    spiritSexCell.classList.add("female-basic");
  }
  appendTextCell(row, person.spiritAge, "spirit-column");
  appendNumberCell(row, person.hp);
  appendNumberCell(row, person.mp);
  appendTextCell(row, Math.floor(Number(person.happiness) || 0), "happiness-cell");
}

function appendActionCell(row, person, village, editable) {
  const cell = document.createElement("td");
  cell.classList.add("action-cell");
  if (!editable) {
    cell.textContent = person.action;
    cell.title = person.action || "";
    row.appendChild(cell);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "action-cell-controls";

  const select = document.createElement("select");
  const currentAction = String(person.action || ACTION_NONE).trim() || ACTION_NONE;
  const actionTable = Array.isArray(person.actionTable) ? person.actionTable : [];
  const isFixedAction = actionTable.length === 1 && [ACTION_CRADLE, ACTION_HEAL, ACTION_LAST_MOMENTS].includes(actionTable[0]);
  if (currentAction !== ACTION_NONE) {
    select.title = getActionOptionTitle(person, currentAction, village);
  }

  if (currentAction === ACTION_NONE && !actionTable.includes(ACTION_NONE)) {
    const option = document.createElement("option");
    option.value = ACTION_NONE;
    option.textContent = "未設定";
    option.title = "未設定。行動を選ぶか、自動割り振りを使ってください。";
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
  }

  actionTable.forEach(action => {
    if (action === ACTION_NONE) return;
    const option = document.createElement("option");
    const label = getActionOptionLabel(person, action, village);
    option.value = action;
    option.textContent = label;
    option.title = getActionOptionTitle(person, action, village);
    if (action === currentAction) option.selected = true;
    select.appendChild(option);
  });

  select.disabled = isFixedAction;
  select.onchange = () => {
    const newAction = select.value;
    if (newAction === ACTION_NONE) return;
    person.action = newAction;
    if (isPreferredActionCandidate(newAction)) {
      setPreferredAction(person, newAction);
    }
    showDictionaryEntry(newAction);
    refreshJobTable(person, village);
    updateUI(village);
  };

  const lockButton = document.createElement("button");
  lockButton.type = "button";
  lockButton.className = `assignment-lock-toggle ${person.assignmentLocked ? "is-locked" : "is-auto"}`;
  lockButton.title = "通常行動を固定します。自動割り振りで変更されません。";
  lockButton.setAttribute("aria-label", person.assignmentLocked ? "固定中" : "自動割り振り対象");
  lockButton.setAttribute("aria-pressed", person.assignmentLocked ? "true" : "false");
  const lockIcon = document.createElement("span");
  lockIcon.className = "assignment-lock-icon";
  lockIcon.setAttribute("aria-hidden", "true");
  lockButton.appendChild(lockIcon);
  lockButton.onclick = () => {
    person.assignmentLocked = !person.assignmentLocked;
    updateUI(village);
  };

  wrapper.appendChild(select);
  wrapper.appendChild(lockButton);
  cell.appendChild(wrapper);
  row.appendChild(cell);
}

function appendPersonalHistoryCell(row, person, village) {
  const cell = document.createElement("td");
  cell.classList.add("foldable-info");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "person-history-button";
  button.textContent = "記録";
  button.title = `${person.name}の記録を見る`;
  button.onclick = () => openPersonalHistoryModal(village, person, {
    relationships: formatRelationshipsForDisplay(person)
  });

  cell.appendChild(button);
  row.appendChild(cell);
}

function appendStatCells(row, person, village) {
  ["str", "vit", "dex", "mag", "chr"].forEach(stat => appendNumberCell(row, person[stat]));
  appendDictionaryCell(row, person.bodyTraits, { category: "trait" });
  ["int", "ind", "eth", "cou", "sexdr"].forEach(stat => appendNumberCell(row, person[stat]));
  appendDictionaryCell(row, person.mindTraits, { category: "trait" });
  appendDictionaryCell(row, [person.hobby], { category: "hobby" });
  appendPersonalHistoryCell(row, person, village);
}

function applyPersonRowStyle(row, person) {
  for (let i = 0; i <= 13; i++) {
    const cell = row.cells[i];
    if (!cell) continue;
    cell.classList.add(person.bodySex === "男" ? "male-basic" : "female-basic");
  }
  const spiritSexCell = row.cells[6];
  if (spiritSexCell) {
    spiritSexCell.classList.remove("male-basic", "female-basic");
    if (person.spiritSex === "男") {
      spiritSexCell.classList.add("male-basic");
    } else if (person.spiritSex === "女") {
      spiritSexCell.classList.add("female-basic");
    }
  }
  if (person.hp <= 33 && row.cells[8]) row.cells[8].classList.add("low-hpmp");
  if (person.mp <= 33 && row.cells[9]) row.cells[9].classList.add("low-hpmp");
  applyStatusHighlights(row, person);
}

function createPersonRow(person, village, { editable = false } = {}) {
  const row = document.createElement("tr");
  if (editable) {
    refreshJobTable(person, village);
  }
  appendIdentityCells(row, person);
  appendActionCell(row, person, village, editable);
  appendStatCells(row, person, village);
  applyPersonRowStyle(row, person);
  return row;
}

function renderPeopleTable(tbody, people, village, options = {}) {
  if (!tbody) return;
  tbody.innerHTML = "";
  people.forEach(person => tbody.appendChild(createPersonRow(person, village, options)));
}

function setSectionVisible(section, visible) {
  if (section) section.style.display = visible ? "block" : "none";
}

/**
 * メイン画面(村人一覧,資源パネルなど)を更新
 */
export function updateUI(v) {
  const rp = document.getElementById("resourcePanel");
  if (!rp) return;
  applyVillageScaleArtClass(v.building);
  const villageInfoHeading = document.getElementById("villageInfoHeading");
  if (villageInfoHeading) {
    villageInfoHeading.textContent = getVillageScaleTitle(v.building);
  }
  const mobileScaleTitleBox = isMobileViewMode()
    ? `<div class="resource-box village-scale-title"><span class="resource-value">${getVillageScaleTitle(v.building)}</span></div>`
    : "";
  const foodStorage = getResourceStorageStatus(v, "food");
  const materialStorage = getResourceStorageStatus(v, "materials");
  const storageWarningRatio = getResourceStorageWarningRatio(v);

  // 季節に応じた背景色を設定
  let seasonColor = "#ffffff"; // デフォルトは白
  if (v.villageTraits.includes("春")) {
    seasonColor = "#e8f5e9"; // 薄い黄緑
  } else if (v.villageTraits.includes("夏")) {
    seasonColor = "#e3f2fd"; // 薄い水色
  } else if (v.villageTraits.includes("秋")) {
    seasonColor = "#fff3e0"; // 薄いだいだい色
  } else if (v.villageTraits.includes("冬")) {
    seasonColor = "#f5f5f5"; // 薄いグレー
  }
  rp.style.backgroundColor = seasonColor;

  rp.innerHTML = `
    ${mobileScaleTitleBox}
    <div class="resource-box"><span class="resource-label">年/月</span><span class="resource-value">${v.year}年${v.month}月</span></div>
    <div class="resource-box${getStorageClass(foodStorage, storageWarningRatio)}"><span class="resource-label">食料</span><span class="resource-value">${foodStorage.current}/${foodStorage.limit}</span></div>
    <div class="resource-box${getStorageClass(materialStorage, storageWarningRatio)}"><span class="resource-label">資材</span><span class="resource-value">${materialStorage.current}/${materialStorage.limit}</span></div>
    <div class="resource-box"><span class="resource-label">資金</span><span class="resource-value">${v.funds}</span></div>
    <div class="resource-box"><span class="resource-label">魔素</span><span class="resource-value">${v.mana}</span></div>
    <div class="resource-box"><span class="resource-label">技術</span><span class="resource-value">${v.tech}</span></div>
    <div class="resource-box"><span class="resource-label">治安</span><span class="resource-value">${v.security}</span></div>
    <div class="resource-box"><span class="resource-label">規模</span><span class="resource-value">${v.building}</span></div>
    <div class="resource-box"><span class="resource-label">異端</span><span class="resource-value">${v.heresy || 0}</span></div>
    <div class="resource-box"><span class="resource-label">人口/上限</span><span class="resource-value">${v.villagers.length}/${v.popLimit}</span></div>
    <div class="resource-box resource-traits"><span class="resource-label">村特性</span><span class="resource-value" id="villageTraitsTerms"></span></div>
  `;
  const villageTraitsTerms = document.getElementById("villageTraitsTerms");
  if (villageTraitsTerms) {
    setDictionaryTerms(villageTraitsTerms, v.villageTraits);
  }

  updateMessageWindow(v);

  const autoAssignButton = document.getElementById("autoAssignButton");
  if (autoAssignButton) {
    const raidMode = v.villageTraits.includes("襲撃中")
      && !v.isRaidProcessDone
      && Array.isArray(v.raidEnemies)
      && v.raidEnemies.length > 0;
    const actionButtons = autoAssignButton.closest(".action-buttons");
    if (actionButtons) {
      actionButtons.classList.toggle("is-raid-mode", raidMode);
    }
    autoAssignButton.textContent = "自動割り振り";
    const raidAssignButton = document.getElementById("raidAssignButton");
    if (raidAssignButton) {
      raidAssignButton.style.display = raidMode ? "" : "none";
    }
  }

  const tb = document.querySelector("#villagersTable tbody");
  renderPeopleTable(tb, v.villagers || [], v, { editable: true });

  const visitors = Array.isArray(v.visitors) ? v.visitors : [];
  setSectionVisible(document.getElementById("visitorsSection"), visitors.length > 0);
  renderPeopleTable(document.querySelector("#visitorsTable tbody"), visitors, v);

  const raidEnemies = Array.isArray(v.raidEnemies) ? v.raidEnemies : [];
  const showRaidEnemies = v.villageTraits.includes("襲撃中") && raidEnemies.length > 0;
  setSectionVisible(document.getElementById("raidEnemiesSection"), showRaidEnemies);
  renderPeopleTable(document.querySelector("#raidEnemiesTable tbody"), showRaidEnemies ? raidEnemies : [], v);

  // テーブル更新後にソート機能をセットアップ
  setupTableSort();
  
  // もし現在ソート中の列があれば、その状態を維持
  if (sortState.column !== null) {
    sortVillagerTable(sortState.column, sortState.isAsc);
  }
}

/**
 * テーブルのソート状態を管理
 */
let sortState = {
  column: null,  // ソート中の列
  isAsc: true    // 昇順ならtrue
};

/**
 * テーブルヘッダーにソート機能を追加
 */
function setupTableSort() {
  const table = document.getElementById("villagersTable");
  if (!table) return;
  const headers = table.querySelectorAll("thead th");

  const sortableColumns = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22];

  sortableColumns.forEach(colIndex => {
    const header = headers[colIndex];
    if (!header || header.dataset.sortBound === "true") return;
    header.dataset.sortBound = "true";
    header.style.cursor = "pointer";
    header.addEventListener("click", () => {
      if (sortState.column === colIndex) {
        sortState.isAsc = !sortState.isAsc;
      } else {
        sortState.column = colIndex;
        sortState.isAsc = true;
      }

      sortVillagerTable(colIndex, sortState.isAsc);
      headers.forEach(h => h.textContent = h.textContent.replace(" ▲", "").replace(" ▼", ""));
      header.textContent += sortState.isAsc ? " ▲" : " ▼";
    });
  });
}

/**
 * テーブルのソート実行
 */
function sortVillagerTable(colIndex, isAsc) {
  const table = document.getElementById("villagersTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll("tr"));

  rows.sort((a, b) => {
    let aVal = a.cells[colIndex]?.textContent ?? "";
    let bVal = b.cells[colIndex]?.textContent ?? "";

    // 数値の場合は数値としてソート
    if ([5,7,8,9,10,12,13,14,15,16,18,19,20,21,22].includes(colIndex)) {
      aVal = Number(aVal);
      bVal = Number(bVal);
    }

    if (aVal < bVal) return isAsc ? -1 : 1;
    if (aVal > bVal) return isAsc ? 1 : -1;
    return 0;
  });

  // ソート後のテーブルを再構築
  tbody.innerHTML = "";
  rows.forEach(row => tbody.appendChild(row));
}
