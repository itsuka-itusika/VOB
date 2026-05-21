// ui.js

import {
  calculateAlchemyYield,
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
  calculateMagicCraftYield,
  calculateMassageHeal,
  calculateMikoMana,
  calculateNurseHeal,
  calculatePoetHappiness,
  calculatePriestMindHeal,
  calculateResearchYield,
  calculateTradingYield,
  calculateWeavingYield,
  estimateBodyCost,
  estimateMindCost,
  getJobCostType,
} from "./domain/jobMath.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { isRestrictedNoJobVillager } from "./domain/rules.js";
import { showDictionaryEntry } from "./dictionary.js";
import { getPortraitPath, getVillagerFoodConsumption, getVillagerWinterMaterialConsumption } from "./util.js";
import { formatRelationshipsForDisplay, normalizeRelationship } from "./relationships.js";
import { applyVillageScaleArtClass, getVillageScaleTitle } from "./villageScale.js";


function openConversationFor(person) {
  import("./conversation.js").then(({ openConversationModal }) => {
    openConversationModal(person);
  });
}

function appendDictionaryTerm(parent, term) {
  const label = String(term || "").trim();
  if (!label) return;

  const span = document.createElement("span");
  span.className = "dictionary-term";
  span.tabIndex = 0;
  span.textContent = label;
  span.title = `${label}の辞書を表示`;
  span.onmouseenter = () => showDictionaryEntry(label);
  span.onfocus = () => showDictionaryEntry(label);
  parent.appendChild(span);
}

function setDictionaryTerms(cell, terms) {
  cell.textContent = "";
  const list = Array.isArray(terms) ? terms.filter(Boolean) : [];
  if (list.length === 0) return;

  list.forEach((term, index) => {
    if (index > 0) cell.appendChild(document.createTextNode(","));
    appendDictionaryTerm(cell, term);
  });
}

function renderFoldableDetails(person) {
  const relationships = formatRelationshipsForDisplay(person);
  const relationshipLine = relationships === "なし" ? "" : `<div>${relationships}</div>`;
  return `
    <details>
      <summary>詳細</summary>
      <div>精神性別: ${person.spiritSex}</div>
      <div>精神年齢: ${person.spiritAge}</div>
      ${relationshipLine}
    </details>
  `;
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
  const foodCost = getMonthlyFoodCost(village);
  const monthsOfFood = foodCost > 0 ? village.food / foodCost : Infinity;
  const winterNeed = villagers.reduce((sum, person) => sum + getVillagerWinterMaterialConsumption(person), 0) * getWinterMonthsToPrepare(village.month);
  const lowHpCount = villagers.filter(person => Number(person.hp) <= 33).length;
  const lowMpCount = villagers.filter(person => Number(person.mp) <= 33).length;
  const noActionCount = villagers.filter(person => {
    const action = String(person.action || "").trim();
    return (action === "" || action === "なし") && !isRestrictedNoJobVillager(person);
  }).length;

  if (foodCost > 0 && monthsOfFood <= 3) {
    warnings.push({
      level: monthsOfFood <= 1 ? "danger" : "warning",
      text: `食料が尽きそうです。このペースでは約${Math.max(0, monthsOfFood).toFixed(1)}か月で枯渇する可能性があります。`
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
  } else if (village.security <= 45) {
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

  if (village.villageTraits.includes("襲撃中")) {
    warnings.push({
      level: "danger",
      text: "襲撃中です。迎撃や罠作成の行動割り振りを確認してください。"
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
  str: 13,
  vit: 14,
  dex: 15,
  mag: 16,
  chr: 17,
  int: 19,
  ind: 20,
  eth: 21,
  cou: 22,
  sexdr: 23
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

function compactEstimateText(text) {
  return text
    .replaceAll("体力回復", "HP回復")
    .replaceAll("体力", "HP")
    .replaceAll("メンタル", "MP")
    .replaceAll("幸福", "幸")
    .replaceAll("想定ダメージ", "想定")
    .replaceAll("男性", "男")
    .replaceAll("女性", "女")
    .replaceAll("全員", "全")
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

function getTaskEstimate(person, task, village) {
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
  const bath = village.buildingFlags && village.buildingFlags.hasPublicBath;
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
  // 実処理の成果量まで安全に共有できる仕事は、下の各 case から jobMath.js を参照します。
  switch (task) {
    case "休養": {
      let hp = person.mindTraits.includes("ワーカホリック") ? 30 : 54;
      let mp = person.mindTraits.includes("ワーカホリック") ? -10 : 21;
      hp = Math.floor(hp * ageRestMultiplier(person));
      mp = Math.floor(mp * ageRestMultiplier(person));
      if (bath) { hp += 10; mp += 10; }
      parts = [`体力+${hp}`, `メンタル${mp >= 0 ? "+" : ""}${mp}`];
      break;
    }
    case "余暇": {
      let mp = (person.mindTraits.includes("ニート") ? 100 : 50) + (bath ? 10 : 0);
      if (hasCurrentHobbyMate(person)) mp = Math.round(mp * 1.5);
      parts = [bath ? "体力+10" : "", `メンタル+${mp}`];
      break;
    }
    case "遊び":
      parts = [`体力-${bodyCost(5, person, village)}`, "メンタル+20", "幸福+15"];
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
      gain = calculateHuntYield(person, village);
      parts = [`${resourceName(village, "食料")}+${gain}`, `体力-${jobBodyCost("狩猟", person, village)}`, `メンタル-${jobMindCost("狩猟", "ind", person, village)}`];
      break;
    case "漁":
      gain = calculateFishYield(person, village);
      parts = [`${resourceName(village, "食料")}+${gain}`, `体力-${jobBodyCost("漁", person, village)}`, `メンタル-${jobMindCost("漁", "ind", person, village)}`];
      break;
    case "採集": {
      const gatherYield = calculateGatherYield(person, village);
      parts = [`${resourceName(village, "食料")}+${gatherYield.food}`, `資材+${gatherYield.materials}`, `体力-${jobBodyCost("採集", person, village)}`, `メンタル-${jobMindCost("採集", "ind", person, village)}`];
      break;
    }
    case "内職":
      parts = [`資金+${calculateHandiworkYield(person, village)}`, `体力-${jobBodyCost("内職", person, village)}`, `メンタル-${jobMindCost("内職", "ind", person, village)}`];
      break;
    case "魔法細工":
      parts = [`資金+${calculateMagicCraftYield(person)}`, `体力-${jobBodyCost("魔法細工", person, village)}`, `メンタル-${jobMindCost("魔法細工", "ind", person, village)}`];
      break;
    case "行商":
      parts = [`資金+${calculateTradingYield(person)}`, `体力-${jobBodyCost("行商", person, village)}`, `メンタル-${jobMindCost("行商", "ind", person, village)}`];
      break;
    case "研究":
      gain = calculateResearchYield(person, village);
      parts = [`技術+${gain}`, `体力-${jobBodyCost("研究", person, village)}`, `メンタル-${jobMindCost("研究", "int", person, village)}`];
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
      parts = [`体力回復+${gain}`, `体力-${jobBodyCost("あんま", person, village)}`, `メンタル-${jobMindCost("あんま", person.bodySex === "男" ? "eth" : "sexdr", person, village)}`];
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
      parts = [`資金/魔素+${gain}`, `体力-${jobBodyCost("錬金術", person, village)}`, `メンタル-${jobMindCost("錬金術", "int", person, village)}`];
      break;
    case "写本":
      gain = calculateCopyBookYield(person);
      parts = [`資金/技術+${gain}`, `体力-${jobBodyCost("写本", person, village)}`, `メンタル-${jobMindCost("写本", "ind", person, village)}`];
      break;
    case "機織り":
      parts = [`資金+${calculateWeavingYield(person)}`, `体力-${jobBodyCost("機織り", person, village)}`, `メンタル-${jobMindCost("機織り", "ind", person, village)}`];
      break;
    case "醸造": {
      const brewingYield = calculateBrewingYield(person);
      parts = [`食料+${brewingYield.food}`, `魔素+${brewingYield.mana}`, `体力-${jobBodyCost("醸造", person, village)}`, `メンタル-${jobMindCost("醸造", "ind", person, village)}`];
      break;
    }
    case "学業":
      parts = [`体力-${jobBodyCost("学業", person, village)}`, `メンタル-${jobMindCost("学業", "ind", person, village)}`];
      break;
    case "鍛錬":
      parts = [`体力-${jobBodyCost("鍛錬", person, village)}`, `メンタル-${jobMindCost("鍛錬", "ind", person, village)}`];
      break;
    case "迎撃":
      parts = [`想定ダメージ${estimateDefendDamage(person, village)}`];
      break;
    case "罠作成":
      parts = [`想定ダメージ${estimateTrapDamage(person)}`];
      break;
  }

  const estimate = formatEstimate(parts);
  if (!estimate) return task;
  return isMobileViewMode()
    ? `${task}(${compactEstimateText(estimate)})`
    : `${task} (${estimate})`;
}

const JOB_KEY_STATS = {
  "学業": "知力×勤勉",
  "鍛錬": "筋力×耐久",
  "農作業": "耐久×勤勉",
  "伐採": "筋力×勤勉",
  "狩猟": "筋力×勇気",
  "漁": "耐久×勇気",
  "採集": "器用×知力",
  "内職": "器用×勤勉",
  "魔法細工": "魔力×器用",
  "研究": "知力×魔力",
  "教育": "知力×魅力×倫理",
  "警備": "筋力×倫理",
  "看護": "魔力×倫理",
  "踊り子": "魅力×好色",
  "詩人": "魅力×知力",
  "シスター": "魅力×倫理",
  "神官": "魅力×倫理",
  "行商": "魅力×知力",
  "あんま": "男性:筋力×倫理/女性:魅力×好色",
  "巫女": "魅力×魔力×好色",
  "バニー": "魅力×好色",
  "錬金術": "魔力×知力",
  "写本": "器用×知力",
  "機織り": "器用×勤勉",
  "醸造": "魔力×勤勉"
};

function getJobLabel(job, compact = false) {
  if (!JOB_KEY_STATS[job]) return job;
  const stats = compact ? compactStatText(JOB_KEY_STATS[job]) : JOB_KEY_STATS[job];
  return compact ? `${job}(${stats})` : `${job}（${stats}）`;
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

function appendDictionaryCell(row, terms) {
  const cell = document.createElement("td");
  setDictionaryTerms(cell, terms);
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
  if (!editable) {
    cell.textContent = person.action;
    row.appendChild(cell);
    return;
  }

  const select = document.createElement("select");
  select.onchange = () => {
    person.action = select.value;
    showDictionaryEntry(select.value);
  };
  (person.actionTable || []).forEach(action => {
    const option = document.createElement("option");
    const label = getTaskEstimate(person, action, village);
    option.value = action;
    option.textContent = label;
    option.title = label;
    if (action === person.action) option.selected = true;
    select.appendChild(option);
  });
  cell.appendChild(select);
  row.appendChild(cell);
}

function appendJobCell(row, person, village, editable) {
  const cell = document.createElement("td");
  if (!editable) {
    cell.textContent = person.job;
    row.appendChild(cell);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "job-cell-controls";

  const select = document.createElement("select");
  (person.jobTable || []).forEach(job => {
    const option = document.createElement("option");
    const fullLabel = getJobLabel(job);
    option.value = job;
    option.textContent = getJobLabel(job, isMobileViewMode());
    option.title = fullLabel;
    if (job === person.job) option.selected = true;
    select.appendChild(option);
  });
  select.onchange = function() {
    const newJob = this.value;
    person.job = newJob;
    person.action = newJob;
    showDictionaryEntry(newJob);
    refreshJobTable(person, village);
    updateUI(village);
  };

  const lockButton = document.createElement("button");
  lockButton.type = "button";
  lockButton.className = `assignment-lock-toggle ${person.assignmentLocked ? "is-locked" : "is-auto"}`;
  lockButton.title = person.assignmentLocked
    ? "自動割り振りから除外中。クリックで自動対象に戻す"
    : "自動割り振りの対象。クリックで固定する";
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

function appendStatCells(row, person) {
  ["str", "vit", "dex", "mag", "chr"].forEach(stat => appendNumberCell(row, person[stat]));
  appendDictionaryCell(row, person.bodyTraits);
  ["int", "ind", "eth", "cou", "sexdr"].forEach(stat => appendNumberCell(row, person[stat]));
  appendDictionaryCell(row, person.mindTraits);
  appendDictionaryCell(row, [person.hobby]);

  const detailsCell = document.createElement("td");
  detailsCell.classList.add("foldable-info");
  detailsCell.innerHTML = renderFoldableDetails(person);
  row.appendChild(detailsCell);
}

function applyPersonRowStyle(row, person) {
  for (let i = 0; i <= 14; i++) {
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
  appendJobCell(row, person, village, editable);
  appendStatCells(row, person);
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
    <div class="resource-box"><span class="resource-label">食料</span><span class="resource-value">${v.food}</span></div>
    <div class="resource-box"><span class="resource-label">資材</span><span class="resource-value">${v.materials}</span></div>
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

  const sortableColumns = [4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23];

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
    if ([5,7,8,9,10,13,14,15,16,17,19,20,21,22,23].includes(colIndex)) {
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
