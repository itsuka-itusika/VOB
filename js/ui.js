// ui.js

import { theVillage } from "./main.js"; // 注意: これにより循環参照に注意
// ただし updateUI() の中で theVillage を参照するかどうかによっては構成要再検討
import { refreshJobTable } from "./createVillagers.js";  // 追加
import { openConversationModal } from "./conversation.js";
import { showDictionaryEntry } from "./dictionary.js";
import { getPortraitPath, getVillagerFoodConsumption, getVillagerWinterMaterialConsumption } from "./util.js";

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
  const noJobCount = villagers.filter(person => person.job === "なし").length;

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

  if (noJobCount > 0) {
    warnings.push({
      level: "warning",
      text: `仕事が「なし」の村人が${noJobCount}人います。必要なら自動割り振りを使えます。`
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

function bodyCost(base, person) {
  return Math.round(base * (1 - ((Number(person.vit) || 0) / 100)));
}

function mindCost(base, stat, person) {
  if (Array.isArray(person.mindTraits) && person.mindTraits.includes("ワーカホリック")) return 0;
  return Math.round(base * (1 - ((Number(person[stat]) || 0) / 100)));
}

function ageRestMultiplier(person) {
  if (hasTrait(person, "老人")) return 0.7;
  if (hasTrait(person, "中年")) return 0.9;
  return 1;
}

function hasCurrentHobbyMate(person) {
  if (!person.hobby || !Array.isArray(person.relationships)) return false;
  return person.relationships.some(rel => rel.startsWith(`${person.hobby}仲間:`));
}

function seasonWorkMultiplier(village, job, person) {
  let mul = 1;
  if (village.villageTraits.includes("豊穣") && ["農作業", "伐採", "狩猟", "漁", "採集"].includes(job)) mul *= 2;
  if (village.villageTraits.includes("秋") && ["農作業", "採集"].includes(job)) mul *= 1.5;
  if (village.villageTraits.includes("冬") && job === "農作業") mul *= 0.5;
  if (village.villageTraits.includes("冬") && job === "狩猟") mul *= 1.2;
  if (village.villageTraits.includes("冷夏") && ["農作業", "伐採"].includes(job)) mul *= 0.5;
  if (hasTrait(person, "緑の指") && ["農作業", "伐採", "採集"].includes(job)) mul *= 1.2;
  if (hasTrait(person, "飛行") && ["狩猟", "採集"].includes(job)) mul *= 1.2;
  if (hasTrait(person, "月の巫女") && job === "狩猟") mul *= 1.5;
  if (hasTrait(person, "水中呼吸") && job === "漁") mul *= 1.5;
  if (hasTrait(person, "森の知恵") && job === "採集") mul *= 1.5;
  if (hasTrait(person, "海の知恵") && job === "漁") mul *= 1.5;
  if (person.hobby === "ハンティング" && job === "狩猟") mul *= 1.2;
  if (person.hobby === "狩猟" && job === "狩猟") mul *= 1.2;
  if ((Array.isArray(person.mindTraits) && person.mindTraits.includes("思春期")) &&
    ["農作業", "伐採", "狩猟", "漁", "採集", "内職"].includes(job)) {
    mul *= 0.8;
  }
  return mul;
}

function formatEstimate(parts) {
  return parts
    .filter(Boolean)
    .filter(part => !/^体力-\d+/.test(part) && !/^メンタル-\d+/.test(part))
    .join(", ");
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
      parts = [`体力-${bodyCost(5, person)}`, "メンタル+20", "幸福+15"];
      break;
    case "療養":
      parts = [`体力+${Math.floor(20 * (hasTrait(person, "老人") ? 0.6 : hasTrait(person, "中年") ? 0.8 : 1))}`, `メンタル+${Math.floor(20 * (hasTrait(person, "老人") ? 0.6 : hasTrait(person, "中年") ? 0.8 : 1))}`];
      break;
    case "農作業":
      gain = Math.round((10 + 20 * ((vit / 20) * (ind / 20))) * seasonWorkMultiplier(village, task, person));
      parts = [`${resourceName(village, "食料")}+${gain}`, `体力-${bodyCost(30, person)}`, `メンタル-${mindCost(15, "ind", person)}`];
      break;
    case "伐採":
      gain = Math.round((10 + 20 * ((str / 20) * (ind / 20))) * seasonWorkMultiplier(village, task, person));
      parts = [`資材+${gain}`, `体力-${bodyCost(30, person)}`, `メンタル-${mindCost(15, "ind", person)}`];
      break;
    case "狩猟":
      gain = Math.round((22 * ((str / 20) * (cou / 20))) * seasonWorkMultiplier(village, task, person));
      parts = [`${resourceName(village, "食料")}+${gain}`, `体力-${bodyCost(30, person)}`, `メンタル-${mindCost(15, "ind", person)}`];
      break;
    case "漁":
      gain = Math.round((22 * ((vit / 20) * (cou / 20))) * seasonWorkMultiplier(village, task, person));
      parts = [`${resourceName(village, "食料")}+${gain}`, `体力-${bodyCost(30, person)}`, `メンタル-${mindCost(15, "ind", person)}`];
      break;
    case "採集":
      gain = Math.round((5 + 10 * ((dex / 20) * (intv / 20))) * seasonWorkMultiplier(village, task, person));
      parts = [`${resourceName(village, "食料")}+${gain}`, `資材+${Math.round(2 * seasonWorkMultiplier(village, task, person))}`, `体力-${bodyCost(15, person)}`, `メンタル-${mindCost(15, "ind", person)}`];
      break;
    case "内職":
      parts = [`資金+${Math.round((5 + 10 * ((dex / 20) * (ind / 20))) * seasonWorkMultiplier(village, task, person))}`, `体力-${bodyCost(15, person)}`, `メンタル-${mindCost(15, "ind", person)}`];
      break;
    case "行商":
      parts = [`資金+${Math.round(20 * ((chr / 20) * (intv / 20)))}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, "ind", person)}`];
      break;
    case "研究":
      gain = Math.round((15 + 30 * ((intv / 20) * (mag / 20))) * (library ? 1.2 : 1));
      parts = [`技術+${gain}`, `体力-${bodyCost(15, person)}`, `メンタル-${mindCost(30, "int", person)}`];
      break;
    case "警備":
      parts = [`治安+${Math.max(1, Math.round(10 * (str / 20) * (eth / 20)))}`, `体力-${bodyCost(15, person)}`, `メンタル-${mindCost(30, "cou", person)}`];
      break;
    case "看護":
      gain = Math.round(20 * mag * eth / 400 * (clinic ? 1.2 : 1));
      parts = [`体力回復+${gain}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, "eth", person)}`];
      break;
    case "あんま":
      gain = person.bodySex === "男" ? Math.round(20 * str / 20 * dex / 20) : Math.round(20 * chr / 20 * sexdr / 20);
      parts = [`体力回復+${gain}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, person.bodySex === "男" ? "ind" : "sexdr", person)}`];
      break;
    case "シスター":
    case "神官":
      gain = Math.round(5 * chr * eth / 400 * (church ? 1.2 : 1) * (voice ? 1.2 : 1));
      parts = [`全員メンタル+${gain}`, `体力-${bodyCost(10, person)}`, `メンタル-${mindCost(30, "eth", person)}`];
      break;
    case "踊り子":
      gain = Math.round(5 * chr * sexdr / 400 * (tavern ? 1.2 : 1) * (voice ? 1.2 : 1));
      parts = [`男性${affectedMen}人幸福+${gain}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, "sexdr", person)}`];
      break;
    case "詩人":
      gain = Math.round(5 * chr * chr / 400 * (tavern ? 1.2 : 1) * (voice ? 1.2 : 1));
      parts = [`女性${affectedWomen}人幸福+${gain}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, "ind", person)}`];
      break;
    case "バニー":
      gain = Math.round(6 * chr / 20 * sexdr / 20);
      parts = [`男性${affectedMen}人幸福/メンタル+${gain}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, "sexdr", person)}`];
      break;
    case "巫女":
      parts = [`魔素+${Math.round(10 * chr / 20 * mag / 20 * sexdr / 20)}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, "sexdr", person)}`];
      break;
    case "錬金術":
      gain = Math.round(24 * mag / 20 * intv / 20);
      parts = [`資金/技術+${gain}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, "int", person)}`];
      break;
    case "写本":
      gain = Math.round(24 * dex / 20 * intv / 20);
      parts = [`資金/技術+${gain}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, "ind", person)}`];
      break;
    case "機織り":
      parts = [`資金+${Math.round(30 * dex / 20 * ind / 20)}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, "ind", person)}`];
      break;
    case "醸造":
      parts = [`食料+${Math.round(24 * mag / 20 * ind / 20)}`, `魔素+${Math.round(5 * mag / 20 * ind / 20)}`, `体力-${bodyCost(20, person)}`, `メンタル-${mindCost(20, "ind", person)}`];
      break;
    case "学業":
      parts = [`体力-${bodyCost(10, person)}`, `メンタル-${mindCost(10, "ind", person)}`];
      break;
    case "鍛錬":
      parts = [`体力-${bodyCost(20, person)}`, `メンタル-${mindCost(15, "ind", person)}`];
      break;
    case "迎撃":
      parts = [`想定ダメージ${estimateDefendDamage(person, village)}`];
      break;
    case "罠作成":
      parts = [`想定ダメージ${estimateTrapDamage(person)}`];
      break;
  }

  const estimate = formatEstimate(parts);
  return estimate ? `${task} (${estimate})` : task;
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
  "詩人": "魅力",
  "シスター": "魅力×倫理",
  "神官": "魅力×倫理",
  "行商": "魅力×知力",
  "あんま": "体格別",
  "巫女": "魅力×魔力×好色",
  "バニー": "魅力×好色",
  "錬金術": "魔力×知力",
  "写本": "器用×知力",
  "機織り": "器用×勤勉",
  "醸造": "魔力×勤勉"
};

function getJobLabel(job) {
  return JOB_KEY_STATS[job] ? `${job}（${JOB_KEY_STATS[job]}）` : job;
}

/**
 * メイン画面(村人一覧,資源パネルなど)を更新
 */
export function updateUI(v) {
  const rp = document.getElementById("resourcePanel");
  if (!rp) return;

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
    <div class="resource-box">年/月<br>${v.year}年${v.month}月</div>
    <div class="resource-box">食料<br>${v.food}</div>
    <div class="resource-box">資材<br>${v.materials}</div>
    <div class="resource-box">資金<br>${v.funds}</div>
    <div class="resource-box">魔素<br>${v.mana}</div>
    <div class="resource-box">名声<br>${v.fame}</div>
    <div class="resource-box">技術<br>${v.tech}</div>
    <div class="resource-box">治安<br>${v.security}</div>
    <div class="resource-box">規模<br>${v.building}</div>
    <div class="resource-box">人口/上限<br>${v.villagers.length}/${v.popLimit}</div>
    <div class="resource-box">村特性<br>${v.villageTraits.join(",")}</div>
  `;

  updateMessageWindow(v);

  const autoAssignButton = document.getElementById("autoAssignButton");
  if (autoAssignButton) {
    const raidMode = v.villageTraits.includes("襲撃中")
      && !v.isRaidProcessDone
      && Array.isArray(v.raidEnemies)
      && v.raidEnemies.length > 0;
    autoAssignButton.textContent = raidMode ? "自動割り振り（迎撃）" : "自動割り振り";
  }

  const tb = document.querySelector("#villagersTable tbody");
  if (!tb) return;
  tb.innerHTML="";

  v.villagers.forEach(person=>{
    let tr=document.createElement("tr");

    let tdPortrait = document.createElement("td");
    tdPortrait.classList.add("villager-portrait-cell");
    tdPortrait.style.cursor = "pointer";
    tdPortrait.onclick = () => openConversationModal(person);
    let portraitFrame = document.createElement("div");
    portraitFrame.classList.add("villager-portrait-frame");
    let portrait = document.createElement("img");
    portrait.classList.add("villager-portrait");
    portrait.src = getPortraitPath(person);
    portrait.alt = person.name;
    portrait.loading = "lazy";
    portraitFrame.appendChild(portrait);
    tdPortrait.appendChild(portraitFrame);
    tr.appendChild(tdPortrait);

    // 名前
    let tdName=document.createElement("td");
    tdName.textContent=person.name;
    tdName.style.cursor = "pointer";
    tdName.onclick = () => openConversationModal(person);
    tr.appendChild(tdName);

    // 体の持ち主
    let tdOwn=document.createElement("td");
    tdOwn.textContent=person.bodyOwner;
    tr.appendChild(tdOwn);

    // 種族を追加
    let tdRace = document.createElement("td");
    tdRace.textContent = person.race;
    tr.appendChild(tdRace);

    // 性別
    let tdSex=document.createElement("td");
    tdSex.textContent=person.bodySex;
    tr.appendChild(tdSex);

    // 年齢
    let tdAge=document.createElement("td");
    tdAge.textContent=person.bodyAge;
    tr.appendChild(tdAge);

    // hp
    let tdHP=document.createElement("td");
    tdHP.textContent=Math.floor(person.hp);
    tr.appendChild(tdHP);

    // mp
    let tdMP=document.createElement("td");
    tdMP.textContent=Math.floor(person.mp);
    tr.appendChild(tdMP);

    // happiness
    let tdHap=document.createElement("td");
    tdHap.textContent=Math.floor(person.happiness);
    tr.appendChild(tdHap);

    // 幸福度の後に行動を追加
    let tdAction = document.createElement("td");
    let selAction = document.createElement("select");
    selAction.onchange = () => {
      person.action = selAction.value;
      showDictionaryEntry(selAction.value);
    };
    person.actionTable.forEach(act => {
      let op = document.createElement("option");
      op.value = act;
      op.textContent = getTaskEstimate(person, act, v);
      op.title = op.textContent;
      if (act === person.action) op.selected = true;
      selAction.appendChild(op);
    });
    tdAction.appendChild(selAction);
    tr.appendChild(tdAction);

    // 仕事
    let tdJob=document.createElement("td");
    let sel=document.createElement("select");
    person.jobTable.forEach(j=>{
      let op=document.createElement("option");
      op.value=j;
      op.textContent=getJobLabel(j);
      op.title = op.textContent;
      if (j===person.job) op.selected=true;
      sel.appendChild(op);
    });
    sel.onchange = function() {
      const newJob = this.value;
      person.job = newJob;
      person.action = newJob;
      showDictionaryEntry(newJob);
      refreshJobTable(person);  // 仕事テーブルを更新
      updateUI(v);  // UI全体を更新
    };
    tdJob.appendChild(sel);
    tr.appendChild(tdJob);

    // 筋力
    let tdStr=document.createElement("td");
    tdStr.textContent=Math.floor(person.str);
    tr.appendChild(tdStr);

    // 耐久
    let tdVit=document.createElement("td");
    tdVit.textContent=Math.floor(person.vit);
    tr.appendChild(tdVit);

    // 器用
    let tdDex=document.createElement("td");
    tdDex.textContent=Math.floor(person.dex);
    tr.appendChild(tdDex);

    // 魔力
    let tdMag=document.createElement("td");
    tdMag.textContent=Math.floor(person.mag);
    tr.appendChild(tdMag);

    // 魅力
    let tdChr=document.createElement("td");
    tdChr.textContent=Math.floor(person.chr);
    tr.appendChild(tdChr);

    // 肉体特性
    let tdBod=document.createElement("td");
    setDictionaryTerms(tdBod, person.bodyTraits);
    tr.appendChild(tdBod);

    // 知力
    let tdInt=document.createElement("td");
    tdInt.textContent=Math.floor(person.int);
    tr.appendChild(tdInt);

    // 勤勉
    let tdInd=document.createElement("td");
    tdInd.textContent=Math.floor(person.ind);
    tr.appendChild(tdInd);

    // 倫理
    let tdEth=document.createElement("td");
    tdEth.textContent=Math.floor(person.eth);
    tr.appendChild(tdEth);

    // 勇気
    let tdCou=document.createElement("td");
    tdCou.textContent=Math.floor(person.cou);
    tr.appendChild(tdCou);

    // 好色
    let tdSexdr=document.createElement("td");
    tdSexdr.textContent=Math.floor(person.sexdr);
    tr.appendChild(tdSexdr);

    // 精神特性
    let tdMind=document.createElement("td");
    setDictionaryTerms(tdMind, person.mindTraits);
    tr.appendChild(tdMind);

    // 趣味
    let tdHobby=document.createElement("td");
    setDictionaryTerms(tdHobby, [person.hobby]);
    tr.appendChild(tdHobby);

    // 詳細(折り畳み)
    let tdFold=document.createElement("td");
    tdFold.classList.add("foldable-info");
    tdFold.innerHTML=`
      <details>
        <summary>詳細</summary>
        <div>精神性別: ${person.spiritSex}</div>
        <div>精神年齢: ${person.spiritAge}</div>
        <div>人間関係: ${person.relationships}</div>
      </details>
    `;
    tr.appendChild(tdFold);

    // 行スタイル等(例: 性別により色分け)
    for (let i=0; i<=12; i++) {
      if (person.bodySex==="男") {
        tr.cells[i].classList.add("male-basic");
      } else {
        tr.cells[i].classList.add("female-basic");
      }
    }

    // 体力とメンタルが33以下の時赤字
    if (person.hp <= 33) {
      tr.cells[6].classList.add("low-hpmp");
    }
    if (person.mp <= 33) {
      tr.cells[7].classList.add("low-hpmp");
    }

    // 数値パラメータチェック（魅力と好色が20以上の時太字）
    let checkCols = [11, 12, 13, 14, 15, 17, 18, 19, 20, 21];
    checkCols.forEach(ci => {
      let val = parseInt(tr.cells[ci].textContent);
      // 魅力（14列目）と好色（20列目）は20以上で太字
      if ((ci === 15 || ci === 21) && val >= 20) {
        tr.cells[ci].classList.add("bold-value");
      }
      // その他のパラメータは従来通り
      else if (ci !== 15 && ci !== 21 && val >= 20) {
        tr.cells[ci].classList.add("bold-value");
      }
    });

    tb.appendChild(tr);
  });

  // 訪問者テーブルの更新
  const visitorSection = document.getElementById("visitorsSection");
  const visitorTb = document.querySelector("#visitorsTable tbody");

  // 訪問者セクション表示制御
  if (visitorSection) {
    if (v.visitors.length > 0) {
      visitorSection.style.display = "block";
    } else {
      visitorSection.style.display = "none";
    }
  }

  // 訪問者テーブル更新
  if (visitorTb && v.visitors.length > 0) {
    visitorTb.innerHTML = "";
    v.visitors.forEach(person => {
      let tr = document.createElement("tr");

      let tdPortrait = document.createElement("td");
      tdPortrait.classList.add("villager-portrait-cell");
      tdPortrait.style.cursor = "pointer";
      tdPortrait.onclick = () => openConversationModal(person);
      let portraitFrame = document.createElement("div");
      portraitFrame.classList.add("villager-portrait-frame");
      let portrait = document.createElement("img");
      portrait.classList.add("villager-portrait");
      portrait.src = getPortraitPath(person);
      portrait.alt = person.name;
      portrait.loading = "lazy";
      portraitFrame.appendChild(portrait);
      tdPortrait.appendChild(portraitFrame);
      tr.appendChild(tdPortrait);

      // 名前
      let tdName = document.createElement("td");
      tdName.textContent = person.name;
      tdName.style.cursor = "pointer";
      tdName.onclick = () => openConversationModal(person);
      tr.appendChild(tdName);

      // 体の持ち主
      let tdOwn = document.createElement("td");
      tdOwn.textContent = person.bodyOwner;
      tr.appendChild(tdOwn);

      // 種族を追加
      let tdRace = document.createElement("td");
      tdRace.textContent = person.race;
      tr.appendChild(tdRace);

      // 性別
      let tdSex = document.createElement("td");
      tdSex.textContent = person.bodySex;
      tr.appendChild(tdSex);

      // 年齢
      let tdAge = document.createElement("td");
      tdAge.textContent = person.bodyAge;
      tr.appendChild(tdAge);

      // hp
      let tdHP = document.createElement("td");
      tdHP.textContent = Math.floor(person.hp);
      tr.appendChild(tdHP);

      // mp
      let tdMP = document.createElement("td");
      tdMP.textContent = Math.floor(person.mp);
      tr.appendChild(tdMP);

      // happiness
      let tdHap = document.createElement("td");
      tdHap.textContent = Math.floor(person.happiness);
      tr.appendChild(tdHap);

      // 行動
      let tdAction = document.createElement("td");
      tdAction.textContent = person.action;
      tr.appendChild(tdAction);

      // 仕事
      let tdJob = document.createElement("td");
      tdJob.textContent = person.job;
      tr.appendChild(tdJob);

      // 筋力
      let tdStr = document.createElement("td");
      tdStr.textContent = Math.floor(person.str);
      tr.appendChild(tdStr);

      // 耐久
      let tdVit = document.createElement("td");
      tdVit.textContent = Math.floor(person.vit);
      tr.appendChild(tdVit);

      // 器用
      let tdDex = document.createElement("td");
      tdDex.textContent = Math.floor(person.dex);
      tr.appendChild(tdDex);

      // 魔力
      let tdMag = document.createElement("td");
      tdMag.textContent = Math.floor(person.mag);
      tr.appendChild(tdMag);

      // 魅力
      let tdChr = document.createElement("td");
      tdChr.textContent = Math.floor(person.chr);
      tr.appendChild(tdChr);

      // 肉体特性
      let tdBod = document.createElement("td");
      setDictionaryTerms(tdBod, person.bodyTraits);
      tr.appendChild(tdBod);

      // 知力
      let tdInt = document.createElement("td");
      tdInt.textContent = Math.floor(person.int);
      tr.appendChild(tdInt);

      // 勤勉
      let tdInd = document.createElement("td");
      tdInd.textContent = Math.floor(person.ind);
      tr.appendChild(tdInd);

      // 倫理
      let tdEth = document.createElement("td");
      tdEth.textContent = Math.floor(person.eth);
      tr.appendChild(tdEth);

      // 勇気
      let tdCou = document.createElement("td");
      tdCou.textContent = Math.floor(person.cou);
      tr.appendChild(tdCou);

      // 好色
      let tdSexdr = document.createElement("td");
      tdSexdr.textContent = Math.floor(person.sexdr);
      tr.appendChild(tdSexdr);

      // 精神特性
      let tdMind = document.createElement("td");
      setDictionaryTerms(tdMind, person.mindTraits);
      tr.appendChild(tdMind);

      // 趣味
      let tdHobby = document.createElement("td");
      setDictionaryTerms(tdHobby, [person.hobby]);
      tr.appendChild(tdHobby);

      // 詳細(折り畳み)
      let tdFold = document.createElement("td");
      tdFold.classList.add("foldable-info");
      tdFold.innerHTML = `
        <details>
          <summary>詳細</summary>
          <div>精神性別: ${person.spiritSex}</div>
          <div>精神年齢: ${person.spiritAge}</div>
          <div>人間関係: ${person.relationships}</div>
        </details>
      `;
      tr.appendChild(tdFold);

      // スタイル適用
      for (let i = 0; i <= 12; i++) {
        if (person.bodySex === "男") {
          tr.cells[i].classList.add("male-basic");
        } else {
          tr.cells[i].classList.add("female-basic");
        }
      }
      if (person.hp <= 33) {
        tr.cells[6].classList.add("low-hpmp");
      }
      if (person.mp <= 33) {
        tr.cells[7].classList.add("low-hpmp");
      }

      // 数値パラメータチェック
      let checkCols = [11, 12, 13, 14, 15, 17, 18, 19, 20, 21];
      checkCols.forEach(ci => {
        let val = parseInt(tr.cells[ci].textContent);
        if (val >= 20) tr.cells[ci].classList.add("bold-value");
      });

      visitorTb.appendChild(tr);
    });
  }

  // 襲撃者一覧テーブル更新
  const raidTb = document.querySelector("#raidEnemiesTable tbody");

  // 襲撃者セクション表示制御
  const raidSection = document.getElementById("raidEnemiesSection");
  if (raidSection) {
    if (v.villageTraits.includes("襲撃中") && v.raidEnemies.length > 0) {
      raidSection.style.display = "block";
    } else {
      raidSection.style.display = "none";
    }
  }

  // 襲撃者テーブル更新
  if (raidTb) {
    raidTb.innerHTML="";

    // 襲撃中の場合のみ表示
    if (v.villageTraits.includes("襲撃中") && v.raidEnemies.length > 0) {
      v.raidEnemies.forEach(person=>{
        let tr=document.createElement("tr");

        let tdPortrait = document.createElement("td");
        tdPortrait.classList.add("villager-portrait-cell");
        tdPortrait.style.cursor = "pointer";
        tdPortrait.onclick = () => openConversationModal(person);
        let portraitFrame = document.createElement("div");
        portraitFrame.classList.add("villager-portrait-frame");
        let portrait = document.createElement("img");
        portrait.classList.add("villager-portrait");
        portrait.src = getPortraitPath(person);
        portrait.alt = person.name;
        portrait.loading = "lazy";
        portraitFrame.appendChild(portrait);
        tdPortrait.appendChild(portraitFrame);
        tr.appendChild(tdPortrait);

        // 名前
        let tdName=document.createElement("td");
        tdName.textContent=person.name;
        tdName.style.cursor = "pointer";
        tdName.onclick = () => {
          openConversationModal(person);
        };
        tr.appendChild(tdName);

        // 体の持ち主
        let tdOwn=document.createElement("td");
        tdOwn.textContent=person.bodyOwner;
        tr.appendChild(tdOwn);

        // 種族を追加
        let tdRace = document.createElement("td");
        tdRace.textContent = person.race;
        tr.appendChild(tdRace);

        // 性別
        let tdSex=document.createElement("td");
        tdSex.textContent=person.bodySex;
        tr.appendChild(tdSex);

        // 年齢
        let tdAge=document.createElement("td");
        tdAge.textContent=person.bodyAge;
        tr.appendChild(tdAge);

        // hp
        let tdHP=document.createElement("td");
        tdHP.textContent=Math.floor(person.hp);
        tr.appendChild(tdHP);

        // mp
        let tdMP=document.createElement("td");
        tdMP.textContent=Math.floor(person.mp);
        tr.appendChild(tdMP);

        // happiness
        let tdHap=document.createElement("td");
        tdHap.textContent=Math.floor(person.happiness);
        tr.appendChild(tdHap);

        // 行動
        let tdAction = document.createElement("td");
        tdAction.textContent=person.action;
        tr.appendChild(tdAction);

        // 仕事
        let tdJob=document.createElement("td");
        tdJob.textContent=person.job;
        tr.appendChild(tdJob);

        // 筋力
        let tdStr=document.createElement("td");
        tdStr.textContent=Math.floor(person.str);
        tr.appendChild(tdStr);

        // 耐久
        let tdVit=document.createElement("td");
        tdVit.textContent=Math.floor(person.vit);
        tr.appendChild(tdVit);

        // 器用
        let tdDex=document.createElement("td");
        tdDex.textContent=Math.floor(person.dex);
        tr.appendChild(tdDex);

        // 魔力
        let tdMag=document.createElement("td");
        tdMag.textContent=Math.floor(person.mag);
        tr.appendChild(tdMag);

        // 魅力
        let tdChr=document.createElement("td");
        tdChr.textContent=Math.floor(person.chr);
        tr.appendChild(tdChr);

        // 肉体特性
        let tdBod=document.createElement("td");
        setDictionaryTerms(tdBod, person.bodyTraits);
        tr.appendChild(tdBod);

        // 知力
        let tdInt=document.createElement("td");
        tdInt.textContent=Math.floor(person.int);
        tr.appendChild(tdInt);

        // 勤勉
        let tdInd=document.createElement("td");
        tdInd.textContent=Math.floor(person.ind);
        tr.appendChild(tdInd);

        // 倫理
        let tdEth=document.createElement("td");
        tdEth.textContent=Math.floor(person.eth);
        tr.appendChild(tdEth);

        // 勇気
        let tdCou=document.createElement("td");
        tdCou.textContent=Math.floor(person.cou);
        tr.appendChild(tdCou);

        // 好色
        let tdSexdr=document.createElement("td");
        tdSexdr.textContent=Math.floor(person.sexdr);
        tr.appendChild(tdSexdr);

        // 精神特性
        let tdMind=document.createElement("td");
        setDictionaryTerms(tdMind, person.mindTraits);
        tr.appendChild(tdMind);

        // 趣味
        let tdHobby=document.createElement("td");
        setDictionaryTerms(tdHobby, [person.hobby]);
        tr.appendChild(tdHobby);

        // 詳細(折り畳み)
        let tdFold=document.createElement("td");
        tdFold.classList.add("foldable-info");
        tdFold.innerHTML=`
          <details>
            <summary>詳細</summary>
            <div>精神性別: ${person.spiritSex}</div>
            <div>精神年齢: ${person.spiritAge}</div>
            <div>人間関係: ${person.relationships}</div>
          </details>
        `;
        tr.appendChild(tdFold);

        // 行スタイル等(例: 性別により色分け)
        for (let i=0; i<=12; i++) {
          if (person.bodySex==="男") {
            tr.cells[i].classList.add("male-basic");
          } else {
            tr.cells[i].classList.add("female-basic");
          }
        }
        if (person.hp<=33) {
          tr.cells[6].classList.add("low-hpmp");
        }
        if (person.mp<=33) {
          tr.cells[7].classList.add("low-hpmp");
        }

        let checkCols=[11,12,13,14,15,17,18,19,20,21];
        checkCols.forEach(ci=>{
          let val=parseInt(tr.cells[ci].textContent);
          if (val>=20) tr.cells[ci].classList.add("bold-value");
        });

        raidTb.appendChild(tr);
      });
    }
  }

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
  const headers = table.querySelectorAll("thead th");
  
  // ソート可能な列のインデックス
  const sortableColumns = [
    4,  // 性別
    5,  // 年齢
    6,  // 体力
    7,  // メンタル
    8,  // 幸福
    10, // 仕事
    11, // 筋力
    12, // 耐久
    13, // 器用
    14, // 魔力
    15, // 魅力
    17, // 知力
    18, // 勤勉
    19, // 倫理
    20, // 勇気
    21  // 好色
  ];

  sortableColumns.forEach(colIndex => {
    const header = headers[colIndex];
    header.style.cursor = "pointer";
    header.addEventListener("click", () => {
      // 同じ列をクリックした場合は昇順/降順を切り替え
      if (sortState.column === colIndex) {
        sortState.isAsc = !sortState.isAsc;
      } else {
        sortState.column = colIndex;
        sortState.isAsc = true;
      }
      
      sortVillagerTable(colIndex, sortState.isAsc);
      
      // ソート方向を表示
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
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  rows.sort((a, b) => {
    let aVal = a.cells[colIndex].textContent;
    let bVal = b.cells[colIndex].textContent;

    // 数値の場合は数値としてソート
    if ([5,6,7,8,11,12,13,14,15,17,18,19,20,21].includes(colIndex)) {
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
