// miracles.js

import { clampValue, getPortraitPath } from "./util.js";
import { addRelationship, removeRelationship, checkHasRelationship, getRelationshipTargetName, clearRelationshipsForDepartedVillager, addSpouseRelationships, raiseMutualFriendshipTo } from "./relationships.js";
import { updateUI } from "./ui.js";  // 実行後にUIを更新する
import { canExchangeBody, doExchange } from "./exchange.js";
import { createRandomVisitor, createRandomVisitorOfType, determineSpeechType } from "./createVillagers.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { addStoredResource } from "./domain/resourceLimits.js";
import { syncEffectiveStats } from "./domain/statLayers.js";
import { recordMarriageHistory, recordVillagerLeaveHistory } from "./history.js";
import { DEFAULT_PORTRAIT_KEY, getPortraitAssetPath } from "./data/portraitPaths.js";
import { clearHopeLossTraits, DESPAIR_TRAIT, DISAPPOINTMENT_TRAIT } from "./domain/despair.js";
import { resolveDialogueTone } from "./data/dialogue/toneProfiles.js";
import { BODY_EXCHANGE_SOURCE_RACE_LINE_KEYS, BODY_EXCHANGE_REACTION_LINES } from "./data/dialogue/exchangeLines.js";
import { getVisitorArrivalLine } from "./data/dialogue/visitorLines.js";
import { getActiveVillagers, isSaltPillar } from "./domain/apocalypseRules.js";
import { completeTutorialTask } from "./tutorial.js";
import { getCaptives } from "./captives.js";
import { hasActiveBuildingFlag } from "./domain/buildingState.js";
import {
  addDivineMight,
  DIVINE_MIGHT_LEVELS,
  getDivineMightGainFromMiracleCost,
  getDivineMightStatus,
  getMiracleUnlockInfo,
  getMiracleUnlockReason,
  showPendingDivineMightLevelUpModal,
  subtractDivineMight
} from "./divineMight.js";

const DEFAULT_PORTRAIT_PATH = getPortraitAssetPath(DEFAULT_PORTRAIT_KEY);
const AUTONOMOUS_SETTLEMENT_SCALE = 350;
const THUNDERBOLT_MIRACLE_DAMAGE = 80;
let pendingExchangeResultVillage = null;
/**
 * 奇跡リスト
 */
export const MIRACLES = [
  {id:"12", name:"交換の奇跡(20)", cost:20, desc:"2人の肉体を交換"},
  {id:"13", name:"交換の奇跡・強(100)", cost:100, desc:"村外含む2人交換"},
  {id:"1",  name:"豊穣の奇跡(100)", cost:100, desc:"今月のみ、農作業・伐採・狩猟・漁・採集の成果と醸造の食料獲得2倍"},
  {id:"2",  name:"マナの奇跡(40)",  cost:40,  desc:"食料+80"},
  {id:"3",  name:"クピドの奇跡(80)", cost:80, desc:"2人を強制結婚(条件無視)"},
  {id:"4",  name:"宴会の奇跡(人数×15)", cost:-1, desc:"全員体力/メンタル+20,幸福+20,失望/絶望解除 (資金×人数分も要)"},
  {id:"5",  name:"狂宴の奇跡(人数×30)", cost:-2, desc:"全員体力/メンタル+60,幸福+50,失望/絶望解除,倫理↓,好色+15"},
  {id:"6",  name:"癒しの奇跡(80)", cost:80, desc:"1人の負傷/重体/疫病/疲労等回復,体力+50"},
  {id:"16", name:"酒杯の奇跡(50)", cost:50, desc:"1人の心労/抑鬱/失望/絶望回復,メンタル+50,幸福+30,酩酊付与"},
  {id:"7",  name:"戦神の奇跡(80)", cost:80, desc:"1人に火星の加護(3ヶ月,筋力/耐久/勇気+7,知力/勤勉/倫理*0.2)"},
  {id:"8",  name:"竈女神の奇跡(40)", cost:40, desc:"恋人を結婚100%(対象なしなら使用不可)"},
  {id:"9",  name:"常春の奇跡(300)", cost:300,desc:"村特性→春に固定。次の季節まで継続"},
  {id:"10", name:"旅人の奇跡(60)", cost:60, desc:"ランダム来訪者(訪問者付与)"},
  {id:"11", name:"出立の奇跡(50)", cost:50, desc:"1人離脱→幸福度分の魔素獲得"},
  {id:"14", name:"ミダスの奇跡(100)", cost:100, desc:"1ヶ月間、食料を得る代わりに資金を得る"},
  {id:"15", name:"市場の奇跡(120)", cost:120, desc:"行商人の訪問者を3人生成"},
  {id:"17", name:"雷霆の奇跡(150)", cost:150, desc:"月1回。襲撃者1体の体力を80減らす。最低1で止まる"}
];

const MIRACLE_UNLOCK_ORDER = DIVINE_MIGHT_LEVELS.flatMap(entry => entry.miracleIds);

function getMiraclesForModal() {
  const byId = new Map(MIRACLES.map(miracle => [miracle.id, miracle]));
  const ordered = MIRACLE_UNLOCK_ORDER
    .map(id => byId.get(id))
    .filter(Boolean);
  const listedIds = new Set(MIRACLE_UNLOCK_ORDER);
  return ordered.concat(MIRACLES.filter(miracle => !listedIds.has(miracle.id)));
}

/**
 * 奇跡モーダルを開く
 */
export function openMiracleModal(village) {
  if (village.gameOver) {
    village.log("ゲームオーバー→奇跡不可");
    return;
  }
  document.getElementById("modalOverlay").style.display = "block";
  document.getElementById("miracleModal").style.display = "block";

  let sel = document.getElementById("miracleSelect");
  if (sel.parentElement) sel.parentElement.style.display = "none";
  sel.innerHTML="";
  getMiraclesForModal().forEach(m=>{
    let op=document.createElement("option");
    op.value=m.id;
    op.textContent=m.name;
    sel.appendChild(op);
  });
  sel.value="12"; // デフォルト
  onSelectMiracleChange(village);
}

/**
 * 奇跡モーダルを閉じる
 */
export function closeMiracleModal() {
  document.getElementById("modalOverlay").style.display="none";
  document.getElementById("miracleModal").style.display="none";
}

/**
 * 選択した奇跡に応じて詳細UIを変える
 */
export function onSelectMiracleChange(village) {
  let selected = document.getElementById("miracleSelect");
  renderMiracleCards(village, selected ? selected.value : "12");
  return;

  let sel = document.getElementById("miracleSelect");
  let mid = sel.value;
  let info = MIRACLES.find(x=> x.id===mid);

  let div = document.getElementById("miracleOptions");
  div.innerHTML = `<p>${info.desc}</p>`;

  // 特定のIDは対象選択が必要
  if (["3","6","7","11","12","13","16"].includes(mid)) {
    if (mid==="3"||mid==="12"||mid==="13") {
      const selectOptions = mid === "12" ? { normalExchangeOnly: true } : (mid === "3" ? { villagersOnly: true } : {});
      div.appendChild(createVillagerSelect("targetA", village, selectOptions));
      div.appendChild(createVillagerSelect("targetB", village, selectOptions));
    } else {
      div.appendChild(createVillagerSelect("targetA", village, { villagersOnly: true }));
    }
  }
}

function getMiracleCostInfo(miracle, village) {
  const peopleCount = village.villagers.length;
  if (miracle.cost === -1) {
    const amount = peopleCount * 15;
    return { mana: amount, funds: amount, label: `魔素: ${amount} / 資金: ${amount}` };
  }
  if (miracle.cost === -2) {
    const amount = peopleCount * 30;
    return { mana: amount, funds: amount, label: `魔素: ${amount} / 資金: ${amount}` };
  }
  const hasGoldenStatue = hasActiveBuildingFlag(village, "hasBacchusGoldenStatue", "bacchusGoldenStatue");
  const mana = hasGoldenStatue && ["12", "13"].includes(miracle.id)
    ? Math.ceil(miracle.cost / 2)
    : miracle.cost;
  return { mana, funds: 0, label: `魔素: ${mana}` };
}

function getMiracleBlockReason(costInfo, village, miracleId = "") {
  const reasons = [];
  const unlockReason = getMiracleUnlockReason(miracleId, village);
  if (unlockReason) reasons.push(unlockReason);
  if (village.mana < costInfo.mana) reasons.push("魔素不足");
  if (village.funds < costInfo.funds) reasons.push("資金不足");
  if (miracleId === "8" && !hasHearthMiracleTarget(village)) reasons.push("対象村人なし");
  if (miracleId === "17" && hasUsedThunderboltMiracleThisMonth(village)) reasons.push("今月は使用済み");
  return reasons.join(", ");
}

function spendMiracleMana(village, cost) {
  village.mana = clampValue(village.mana - cost, 0, 99999);
  addDivineMight(village, getDivineMightGainFromMiracleCost(cost));
}

function refundMiracleMana(village, cost) {
  village.mana = clampValue(village.mana + cost, 0, 99999);
  subtractDivineMight(village, getDivineMightGainFromMiracleCost(cost));
}

function clearHopeLossByMiracle(person, village) {
  const recovered = clearHopeLossTraits(person);
  if (recovered.length > 0) {
    syncEffectiveStats(person);
    refreshJobTable(person, village);
  }
  return recovered;
}

function getVillageMonthKey(village) {
  return `${Number(village?.year) || 0}-${Number(village?.month) || 0}`;
}

function hasUsedThunderboltMiracleThisMonth(village) {
  return village?.lastThunderboltMiracleMonth === getVillageMonthKey(village);
}

function getHearthMiraclePairs(village) {
  const pairs = [];
  const done = new Set();
  village.villagers.forEach(a => {
    if (done.has(a) || !checkHasRelationship(a, "恋人") || checkHasRelationship(a, "既婚")) return;
    const bName = getRelationshipTargetName(a, "恋人");
    const b = bName ? village.villagers.find(person => person.name === bName) : null;
    if (!b || done.has(b) || checkHasRelationship(b, "既婚")) return;
    pairs.push([a, b]);
    done.add(a);
    done.add(b);
  });
  return pairs;
}

function hasHearthMiracleTarget(village) {
  return getHearthMiraclePairs(village).length > 0;
}

function getMiracleTargetCount(mid) {
  if (["3", "12", "13"].includes(mid)) return 2;
  if (["6", "7", "11", "16", "17"].includes(mid)) return 1;
  return 0;
}

function getMiracleTargetOptions(mid) {
  if (mid === "17") return { raidersOnly: true };
  if (mid === "12") return { normalExchangeOnly: true };
  if (mid === "6") return { villagersOnly: true, includeSaltPillar: true };
  if (mid === "3" || mid === "7" || mid === "11" || mid === "16") return { villagersOnly: true };
  if (mid === "13") return { excludeExchangeImmune: true };
  return {};
}

function findMiracleTargetByName(name, village) {
  if (!name) return null;
  return village.villagers.find(x => x.name === name) ||
    getCaptives(village).find(x => x.name === name) ||
    village.visitors.find(x => x.name === name) ||
    village.raidEnemies.find(x => x.name === name) ||
    null;
}

function areMiracleTargetsReady(mid) {
  const count = getMiracleTargetCount(mid);
  if (count === 0) return true;
  const targetA = document.getElementById("targetA");
  const targetB = document.getElementById("targetB");
  if (count === 1) return Boolean(targetA && targetA.value);
  return Boolean(targetA && targetB && targetA.value && targetB.value && targetA.value !== targetB.value);
}

function describeMiracleTarget(person) {
  if (!person) return "";
  const sex = person.bodySex || person.sex || "-";
  const age = person.bodyAge ?? person.age ?? "-";
  return `${person.name}: ${person.race || "-"} / ${sex} / ${age}歳 / 筋${person.str} 耐${person.vit} 器${person.dex} 魔${person.mag} 魅${person.chr}`;
}

function updateMiraclePreview(mid, village, preview) {
  if (!preview) return;
  const targetA = document.getElementById("targetA");
  const targetB = document.getElementById("targetB");
  const personA = findMiracleTargetByName(targetA?.value, village);
  const personB = findMiracleTargetByName(targetB?.value, village);

  if (["12", "13"].includes(mid)) {
    if (personA && personB && personA !== personB) {
      preview.innerHTML = `
        <div>名前と精神は残り、肉体名・種族・年齢・身体能力が入れ替わります。</div>
        <div>${personA.name} ← ${describeMiracleTarget(personB)}</div>
        <div>${personB.name} ← ${describeMiracleTarget(personA)}</div>
      `;
    } else {
      preview.textContent = "2人を選ぶと、交換後の肉体プレビューを表示します。";
    }
    return;
  }

  if (personA) {
    preview.textContent = describeMiracleTarget(personA);
  } else if (getMiracleTargetCount(mid) > 0) {
    preview.textContent = "対象を選択してください。";
  } else {
    preview.textContent = "";
  }
}

function updateMiracleActionButton(mid, button, village, costInfo, preview) {
  const reason = getMiracleBlockReason(costInfo, village, mid);
  const targetsReady = areMiracleTargetsReady(mid);
  button.disabled = Boolean(reason) || !targetsReady;
  button.textContent = reason || (targetsReady ? "行使" : "対象を選んでください");
  updateMiraclePreview(mid, village, preview);
}

function createMiracleTargetControls(miracle, village, button, costInfo) {
  const targetCount = getMiracleTargetCount(miracle.id);
  if (targetCount === 0) return null;

  const controls = document.createElement("div");
  controls.className = "miracle-targets";

  const options = getMiracleTargetOptions(miracle.id);
  const targetA = createVillagerSelect("targetA", village, options);
  const targetB = targetCount === 2 ? createVillagerSelect("targetB", village, options) : null;

  const preview = document.createElement("div");
  preview.className = "miracle-preview";

  const addControl = (labelText, select) => {
    const label = document.createElement("label");
    label.className = "miracle-target";
    const span = document.createElement("span");
    span.textContent = labelText;
    label.appendChild(span);
    label.appendChild(select);
    controls.appendChild(label);
  };

  addControl(targetCount === 2 ? "対象A" : "対象", targetA);
  if (targetB) addControl("対象B", targetB);
  controls.appendChild(preview);

  [targetA, targetB].filter(Boolean).forEach(select => {
    select.addEventListener("change", () => updateMiracleActionButton(miracle.id, button, village, costInfo, preview));
  });

  updateMiracleActionButton(miracle.id, button, village, costInfo, preview);
  return controls;
}

function setSelectedMiracle(id, village) {
  const select = document.getElementById("miracleSelect");
  if (select) select.value = id;
  renderMiracleCards(village, id);
}

function createMiracleItem(miracle, village, selectedId) {
  const div = document.createElement("div");
  const isActive = miracle.id === selectedId;
  const unlockInfo = getMiracleUnlockInfo(miracle.id, village);
  const isLocked = !unlockInfo.unlocked;
  const costInfo = getMiracleCostInfo(miracle, village);
  const reasonText = getMiracleBlockReason(costInfo, village, miracle.id);
  const targetCount = getMiracleTargetCount(miracle.id);
  const needsTarget = targetCount > 0;

  div.className = `miracle-item${isActive ? " active" : ""}${isLocked ? " locked" : ""}`;
  div.innerHTML = `
    <div class="miracle-header">
      <h4>${getMiracleDisplayName(miracle, costInfo)}</h4>
      ${isLocked ? '<span class="miracle-mark locked">未解放</span>' : (isActive ? '<span class="miracle-mark">選択中</span>' : "")}
    </div>
    <div class="miracle-desc">${miracle.desc}</div>
    <div class="miracle-cost"><div>${costInfo.label}</div></div>
    ${reasonText ? `<div class="miracle-reason">${reasonText}</div>` : ""}
  `;

  const button = document.createElement("button");
  button.className = "miracle-button";

  if (isLocked) {
    button.disabled = true;
    button.textContent = unlockInfo.reason;
  } else if (reasonText) {
    button.disabled = true;
    button.textContent = "行使不可";
  } else if (!isActive && needsTarget) {
    button.textContent = "対象選択";
    button.onclick = () => setSelectedMiracle(miracle.id, village);
  } else {
    button.textContent = "行使";
    button.onclick = () => {
      const select = document.getElementById("miracleSelect");
      if (select) select.value = miracle.id;
      performMiracle(village);
    };
  }

  if (isActive) {
    const controls = createMiracleTargetControls(miracle, village, button, costInfo);
    if (controls) div.appendChild(controls);
  }

  div.appendChild(button);
  div.onclick = (event) => {
    if (isLocked) return;
    if (event.target.closest("button") || event.target.closest("select")) return;
    if (!isActive) setSelectedMiracle(miracle.id, village);
  };
  return div;
}

function getMiracleDisplayName(miracle, costInfo) {
  if (!["12", "13"].includes(miracle.id) || costInfo.mana === miracle.cost) return miracle.name;
  return miracle.name.replace(/\([^)]*\)$/, `(${costInfo.mana})`);
}

function renderMiracleCards(village, selectedId = "12") {
  const content = document.getElementById("miracleOptions");
  if (!content) return;
  const miraclesForModal = getMiraclesForModal();
  const fallbackId = miraclesForModal.find(m => getMiracleUnlockInfo(m.id, village).unlocked)?.id || "12";
  const selectedMiracle = MIRACLES.find(m => m.id === selectedId);
  const currentId = selectedMiracle && getMiracleUnlockInfo(selectedMiracle.id, village).unlocked
    ? selectedId
    : fallbackId;
  const select = document.getElementById("miracleSelect");
  if (select) select.value = currentId;
  const divineStatus = getDivineMightStatus(village);
  const nextDivineText = divineStatus.next
    ? `次Lv${divineStatus.next.level}: 神威${divineStatus.next.threshold}まで残り${Math.ceil(divineStatus.remaining)}`
    : "すべて解放済み";

  content.innerHTML = `
    <div class="miracle-resources">
      <div>魔素: ${village.mana}</div>
      <div>資金: ${village.funds}</div>
      <div>神威: Lv${divineStatus.level} / ${divineStatus.amountLabel}</div>
      <div>${nextDivineText}</div>
      <div>村人: ${village.villagers.length}</div>
    </div>
    <div class="miracle-list">
      <h3>奇跡</h3>
      <div class="miracle-grid"></div>
    </div>
  `;

  const grid = content.querySelector(".miracle-grid");
  miraclesForModal.forEach(miracle => grid.appendChild(createMiracleItem(miracle, village, currentId)));
}

function createVillagerSelect(id, village, options = {}) {
  let sel=document.createElement("select");
  sel.id=id;
  let op0=document.createElement("option");
  op0.value="";
  op0.textContent="(選択)";
  sel.appendChild(op0);

  // 村人を追加
  if (!options.raidersOnly) {
    village.villagers
      .filter(vv => options.includeSaltPillar || !isSaltPillar(vv))
      .filter(vv => !options.normalExchangeOnly || isNormalExchangeCandidate(vv, village))
      .forEach(vv=>{
      let opp=document.createElement("option");
      opp.value=vv.name;
      opp.textContent=vv.name;
      sel.appendChild(opp);
    });
  }

  if (!options.raidersOnly && options.normalExchangeOnly) {
    getCaptives(village).forEach(vv=>{
      let opp=document.createElement("option");
      opp.value=vv.name;
      opp.textContent=`${vv.name}(捕虜)`;
      sel.appendChild(opp);
    });
  }

  if (options.normalExchangeOnly || options.villagersOnly) {
    return sel;
  }

  // 訪問者を追加
  if (!options.raidersOnly) {
    getCaptives(village).forEach(vv=>{
      let opp=document.createElement("option");
      opp.value=vv.name;
      opp.textContent=`${vv.name}(捕虜)`;
      sel.appendChild(opp);
    });
    village.visitors.forEach(vv=>{
      let opp=document.createElement("option");
      opp.value=vv.name;
      opp.textContent=`${vv.name}(訪問者)`;
      sel.appendChild(opp);
    });
  }

  // 襲撃者を追加
  village.raidEnemies
    .filter(vv => (!options.raidersOnly || Number(vv.hp) > 0) && (!options.excludeExchangeImmune || canExchangeBody(vv)))
    .forEach(vv=>{
    let opp=document.createElement("option");
    opp.value=vv.name;
    opp.textContent=`${vv.name}(襲撃者)`;
    sel.appendChild(opp);
  });

  return sel;
}

function isNormalExchangeCandidate(person, village) {
  return village.villagers.includes(person) || getCaptives(village).includes(person);
}

/**
 * 奇跡実行
 */
export function performMiracle(village) {
  let sel=document.getElementById("miracleSelect");
  let mid=sel.value;
  let info=MIRACLES.find(x=>x.id===mid);
  if (!info) return;
  const unlockReason = getMiracleUnlockReason(info.id, village);
  if (unlockReason) {
    village.log(`【奇跡】${info.name}は${unlockReason}`);
    return;
  }

  // コスト計算
  let cost = getMiracleCostInfo(info, village).mana;
  let vc = village.villagers.length;
  if (info.cost===-1) {
    // 宴会(人数×15)
    cost = vc * 15;
    if (village.mana<cost || village.funds<cost) {
      village.log(`魔素or資金不足(必要:${cost})`);
      return;
    }
  } else if (info.cost===-2) {
    // 狂宴(人数×30)
    cost = vc * 30;
    if (village.mana<cost || village.funds<cost) {
      village.log(`魔素or資金不足(必要:${cost})`);
      return;
    }
  } else {
    if (village.mana<cost) {
      village.log(`魔素不足(必要:${cost}, 所持:${village.mana})`);
      return;
    }
  }

  let ta=document.getElementById("targetA");
  let tb=document.getElementById("targetB");
  let vA=null;
  let vB=null;
  if (ta && ta.value) {
    // 村人、捕虜、訪問者、襲撃者から対象を検索
    vA = village.villagers.find(x=>x.name===ta.value) ||
         getCaptives(village).find(x=>x.name===ta.value) ||
         village.visitors.find(x=>x.name===ta.value) ||
         village.raidEnemies.find(x=>x.name===ta.value);
  }
  if (tb && tb.value) {
    // 村人、捕虜、訪問者、襲撃者から対象を検索
    vB = village.villagers.find(x=>x.name===tb.value) ||
         getCaptives(village).find(x=>x.name===tb.value) ||
         village.visitors.find(x=>x.name===tb.value) ||
         village.raidEnemies.find(x=>x.name===tb.value);
  }

  if (mid === "8" && !hasHearthMiracleTarget(village)) {
    village.log("【竈女神の奇跡】対象村人なし");
    return;
  }

  // 実行
  switch(mid) {
    case "4": // 宴会
      spendMiracleMana(village, cost);
      village.funds-=cost;
      let feastRecoveredCount = 0;
      village.villagers.forEach(p=>{
        if (isSaltPillar(p)) return;
        p.hp=clampValue(p.hp+20,0,100);
        p.mp=clampValue(p.mp+20,0,100);
        p.happiness=clampValue(p.happiness+20,0,100);
        if (clearHopeLossByMiracle(p, village).length > 0) feastRecoveredCount++;
      });
      village.log(`【宴会】全員体力/メンタル+20,幸福+20(費用:${cost})${feastRecoveredCount > 0 ? `,失望・絶望${feastRecoveredCount}人解除` : ""}`);
      showMiracleResultModal(village, "宴会の奇跡", "村中に賑やかな宴が開かれました。", getActiveVillagers(village));
      break;

    case "5": // 狂宴
      spendMiracleMana(village, cost);
      village.funds-=cost;
      let revelRecoveredCount = 0;
      village.villagers.forEach(p=>{
        if (isSaltPillar(p)) return;
        p.hp=clampValue(p.hp+60,0,100);
        p.mp=clampValue(p.mp+60,0,100);
        p.happiness=clampValue(p.happiness+50,0,100);
        if (clearHopeLossByMiracle(p, village).length > 0) revelRecoveredCount++;
        // 狂乱特性を付与（まだ持っていない場合のみ）
        if (!p.mindTraits.includes("狂乱")) {
          p.mindTraits.push("狂乱");
          syncEffectiveStats(p);
        }
      });
      village.log(`【狂宴】全員体力/メンタル+60,幸福+50,狂乱付与(倫理*0.2,好色+15)${revelRecoveredCount > 0 ? `,失望・絶望${revelRecoveredCount}人解除` : ""}`);
      showMiracleResultModal(village, "狂宴の奇跡", "理性を揺らす熱気が村を満たしました。", getActiveVillagers(village));
      break;

    default:
      // 通常コスト (mana消費)
      spendMiracleMana(village, cost);
      switch(mid) {
        case "1": // 豊穣
          village.villageTraits.push("豊穣");
          village.log("【豊穣の奇跡】対象生産の成果と醸造の食料獲得2倍を1ヶ月付与");
          showMiracleResultModal(village, "豊穣の奇跡", "畑と森、水辺と蔵に豊かな気配が満ちました。", village.villagers);
          break;
        case "2": // マナの奇跡
          addStoredResource(village, "food", 80);
          village.log("【マナの奇跡】食料+80");
          showMiracleResultModal(village, "マナの奇跡", "食料庫に恵みが満ちました。", village.villagers);
          break;
        case "3": // クピド(2人強制結婚)
          if (!vA||!vB||vA===vB) {
            village.log("【クピド】2人を選択してください");
            refundMiracleMana(village, cost); // 戻す
            return;
          }
          if (!village.villagers.includes(vA) || !village.villagers.includes(vB)) {
            village.log("【クピド】村人以外は対象外です");
            refundMiracleMana(village, cost);
            return;
          }
          forceMarriage(vA,vB,village);
          break;
        case "6": // 癒し(1人回復)
          if (!vA || !village.villagers.includes(vA)) {
            village.log("【癒し】対象1人を選択");
            refundMiracleMana(village, cost);
            return;
          }
          healMiracle(vA,village);
          break;
        case "16": // 酒杯(1人回復)
          if (!vA || !village.villagers.includes(vA)) {
            village.log("【酒杯】対象1人を選択");
            refundMiracleMana(village, cost);
            return;
          }
          gobletMiracle(vA,village);
          break;
        case "7": // 戦神(1人)
          if (!vA || !village.villagers.includes(vA)) {
            village.log("【戦神】対象1人を選択");
            refundMiracleMana(village, cost);
            return;
          }
          warMiracle(vA,village);
          break;
        case "17": // 雷霆(襲撃者1体)
          if (hasUsedThunderboltMiracleThisMonth(village)) {
            village.log("【雷霆の奇跡】今月はすでに使用済みです");
            refundMiracleMana(village, cost);
            return;
          }
          if (!vA || !village.raidEnemies.includes(vA)) {
            village.log("【雷霆の奇跡】襲撃者1体を選択");
            refundMiracleMana(village, cost);
            return;
          }
          thunderboltMiracle(vA, village);
          break;
        case "8": // 竈女神
          hearthMiracle(village);
          break;
        case "9": // 常春
          let rm=["夏","秋","冬","冷夏","飛蝗","厳冬","疫病流行"];
          village.villageTraits=village.villageTraits.filter(x=>!rm.includes(x));
          if (!village.villageTraits.includes("春")) {
            village.villageTraits.push("春");
          }
          village.log("【常春の奇跡】春に固定");
          showMiracleResultModal(village, "常春の奇跡", "村に穏やかな春の気配が定着しました。", village.villagers);
          break;
        case "10": // 旅人
          travelerMiracle(village);
          break;
        case "11": // 出立
          if (!vA || !village.villagers.includes(vA)) {
            village.log("【出立の奇跡】対象1人を選択");
            refundMiracleMana(village, cost);
            return;
          }
          departureMiracle(vA,village);
          break;
        case "12": // 交換
          if (!vA||!vB||vA===vB) {
            village.log("【交換の奇跡】2人を選択");
            refundMiracleMana(village, cost);
            return;
          }
          // 通常の交換は村人同士のみ
          if (!isNormalExchangeCandidate(vA, village) || !isNormalExchangeCandidate(vB, village)) {
            village.log("【交換の奇跡】村人・捕虜以外は対象外です");
            refundMiracleMana(village, cost);
            return;
          }
          doExchange(vA,vB,village,false);
          village.log(`【交換の奇跡】${vA.name}と${vB.name}が肉体交換`);

          // 交換専用モーダルを表示
          openExchangeModal(vA, vB, { village });
          break;
        case "13": // 交換(強)
          if (!vA||!vB||vA===vB) {
            village.log("【交換の奇跡・強】2人を選択");
            refundMiracleMana(village, cost);
            return;
          }
          doExchange(vA,vB,village,false);
          village.log(`【交換の奇跡・強】${vA.name}と${vB.name}が肉体交換`);

          // 交換専用モーダルを表示
          openExchangeModal(vA, vB, { village });
          break;
        case "14": // ミダスの奇跡
          if (!village.villageTraits.includes("ミダス")) {
            village.villageTraits.push("ミダス");
          }
          village.log("【ミダスの奇跡】1ヶ月間、食料を得る行動が資金を得る");
          showMiracleResultModal(village, "ミダスの奇跡", "収穫の価値が黄金へと傾きました。", village.villagers);
          break;
        case "15": // 市場の奇跡
          marketMiracle(village);
          break;
      }
      break;
  }

  completeTutorialTask(village, "use_miracle");
  updateUI(village);
  closeMiracleModal();
}

/** クピド: 強制結婚 */
function forceMarriage(a,b,v) {
  removeRelationship(a,`恋人:${b.name}`);
  removeRelationship(b,`恋人:${a.name}`);
  addRelationship(a,"既婚");
  addRelationship(b,"既婚");
  a.happiness=clampValue(a.happiness+50,0,100);
  b.happiness=clampValue(b.happiness+50,0,100);
  raiseMutualFriendshipTo(a, b, 60);

  addSpouseRelationships(a, b);
  recordMarriageHistory(v, a, b, { source: "クピドの奇跡" });

  v.log(`【クピドの奇跡】${a.name}と${b.name}強制結婚`);
  showMarriageMiracleModal(v, "クピドの奇跡", [[a, b]]);
}

/** 癒し: 負傷など回復 */
function healMiracle(p,v) {
  let arr=["負傷","重体","疲労","過労","飢餓","疫病","産褥","凍え","塩の柱"];
  let recoveredTraits = [];

  arr.forEach(trait => {
    if (p.bodyTraits.includes(trait)) {
      recoveredTraits.push(trait);
      p.bodyTraits = p.bodyTraits.filter(t => t !== trait);
      if (trait === "産褥") p.postpartumMonths = 0;
      if (trait === "塩の柱") p.saltPillarMonths = 0;
    }
  });

  syncEffectiveStats(p);
  refreshJobTable(p, v);

  p.hp=clampValue(p.hp+50,0,100);

  let recoveryMsg = recoveredTraits.length > 0 ?
    `${recoveredTraits.join(",")}を回復,` : "";
  v.log(`【癒しの奇跡】${p.name}${recoveryMsg}体力+50`);
  showMiracleResultModal(v, "癒しの奇跡", `${p.name}の傷と身体の疲れが癒されました。`, [p]);
}

/** 酒杯: 心を満たし、当月だけ酩酊を付与 */
function gobletMiracle(p,v) {
  const recoveredTraits = [];

  ["心労","抑鬱", DISAPPOINTMENT_TRAIT, DESPAIR_TRAIT].forEach(trait => {
    if (p.mindTraits.includes(trait)) {
      recoveredTraits.push(trait);
      p.mindTraits = p.mindTraits.filter(t => t !== trait);
    }
  });

  p.mp=clampValue(p.mp+50,0,100);
  p.happiness=clampValue(p.happiness+30,0,100);
  if (!p.mindTraits.includes("酩酊")) {
    p.mindTraits.push("酩酊");
  }

  syncEffectiveStats(p);
  refreshJobTable(p, v);

  const recoveryMsg = recoveredTraits.length > 0 ?
    `${recoveredTraits.join(",")}を回復,` : "";
  v.log(`【酒杯の奇跡】${p.name}${recoveryMsg}メンタル+50,幸福+30,酩酊付与`);
  showMiracleResultModal(v, "酒杯の奇跡", `${p.name}の心に甘い酔いが満ちました。`, [p]);
}

/** 戦神(戦神の加護) */
function warMiracle(p, v) {
  p.ares = 0;
  p.bodyTraits = Array.isArray(p.bodyTraits) ? p.bodyTraits.filter(trait => trait !== "火星の加護") : [];
  p.mindTraits = Array.isArray(p.mindTraits) ? p.mindTraits : [];
  if (!p.mindTraits.includes("火星の加護")) {
    p.mindTraits.push("火星の加護");
  }
  syncEffectiveStats(p);
  refreshJobTable(p, v);
  v.log(`【戦神の奇跡】${p.name}に火星の加護付与(筋力+7,耐久+7,勇気+7,知力/勤勉/倫理*0.2)3ヶ月継続`);
  showMiracleResultModal(v, "戦神の奇跡", `${p.name}に戦神の加護が宿りました。`, [p]);
}

function thunderboltMiracle(target, village) {
  const beforeHp = Number(target.hp) || 0;
  target.hp = beforeHp <= 1 ? beforeHp : Math.max(1, beforeHp - THUNDERBOLT_MIRACLE_DAMAGE);
  village.lastThunderboltMiracleMonth = getVillageMonthKey(village);
  const actualDamage = Math.max(0, beforeHp - target.hp);
  village.log(`【雷霆の奇跡】${target.name}に雷霆を落としました。体力-${actualDamage}`);
  showMiracleResultModal(village, "雷霆の奇跡", `${target.name}を雷光が打ちました。`, [target]);
}

/** 竈女神(恋人を結婚100%) */
function hearthMiracle(v) {
  const pairs = getHearthMiraclePairs(v);
  if (pairs.length===0) {
    v.log("【竈女神の奇跡】対象村人なし");
    return;
  }
  pairs.forEach(([a, b]) => {
    removeRelationship(a,`恋人:${b.name}`);
    removeRelationship(b,`恋人:${a.name}`);
    addRelationship(a,"既婚");
    addRelationship(b,"既婚");
    a.happiness=clampValue(a.happiness+50,0,100);
    b.happiness=clampValue(b.happiness+50,0,100);

    addSpouseRelationships(a, b);
    recordMarriageHistory(v, a, b, { source: "竈女神の奇跡" });

    v.log(`【竈女神の奇跡】${a.name}と${b.name}結婚100%`);
  });
  showMarriageMiracleModal(v, "竈女神の奇跡", pairs);
}

/** 旅人の奇跡(1名来訪) */
function travelerMiracle(v) {
  const visitorTableVillage = {
    ...v,
    building: AUTONOMOUS_SETTLEMENT_SCALE
  };
  let newV = createRandomVisitor([
    ...v.villagers.map(person => person.name),
    ...v.visitors.map(person => person.name)
  ], null, visitorTableVillage);
  v.visitors.push(newV);
  v.log(`【旅人の奇跡】${newV.name}が来訪(訪問者)`);
  const arrivalLine = getVisitorArrivalLine(newV);
  if (arrivalLine) v.log(`${newV.name}「${arrivalLine}」`);
  const message = arrivalLine
    ? `${newV.name}が村を訪れました。<br>「${arrivalLine}」`
    : `${newV.name}が村を訪れました。`;
  showMiracleResultModal(v, "旅人の奇跡", message, [newV]);
}

/** 市場の奇跡(行商人3名来訪) */
function marketMiracle(v) {
  const newVisitors = [];
  for (let i = 0; i < 3; i++) {
    const existingNames = [
      ...v.villagers.map(person => person.name),
      ...v.visitors.map(person => person.name),
      ...newVisitors.map(person => person.name)
    ];
    const merchant = createRandomVisitorOfType("行商人", existingNames);
    newVisitors.push(merchant);
    v.visitors.push(merchant);
  }
  v.log(`【市場の奇跡】行商人3人が村を訪れました`);
  showMiracleResultModal(v, "市場の奇跡", "行商人たちが市を開くために村を訪れました。", newVisitors);
}

/** 出立の奇跡(対象を離脱→幸福度分魔素取得) */
function departureMiracle(p,v) {
  let bonus = p.happiness;
  v.mana=clampValue(v.mana+bonus,0,99999);
  recordVillagerLeaveHistory(v, p, { source: "出立の奇跡" });
  v.log(`【出立の奇跡】${p.name}離脱,魔素+${bonus}`);
  let idx=v.villagers.indexOf(p);
  if (idx>=0) {
    clearRelationshipsForDepartedVillager(v, p);
    v.villagers.splice(idx,1);
  }
  showMiracleResultModal(v, "出立の奇跡", `${p.name}は村を去りました。`, [p]);
}

function getChildlikeMiracleLine(person) {
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  if (mindTraits.includes("無垢")) return randFrom(["あうー。", "んま。", "ばぶ。", "すやすや……"]);
  if (mindTraits.includes("萌芽")) {
    const lines = person.spiritSex === "女"
      ? ["わあ……きらきらしてる。", "これ、なあに？", "わたし、ふしぎでどきどきする。"]
      : ["わあ……きらきらしてる。", "これ、なあに？", "ぼく、ふしぎでどきどきする。"];
    return randFrom(lines);
  }
  return null;
}

function getGrotesquePortraitLine(person) {
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  if (mindTraits.includes("無垢")) return randFrom(["あ……こわい。", "ん……いや。"]);
  if (mindTraits.includes("萌芽")) {
    const lines = person.spiritSex === "女"
      ? ["この絵、なんだかこわい……わたしの顔なの？", "胸がざわざわする。見ちゃだめな気がする。"]
      : ["この絵、なんだかこわい……ぼくの顔なの？", "胸がざわざわする。見ちゃだめな気がする。"];
    return randFrom(lines);
  }
  const type = person.speechType || determineSpeechType(person);
  const lines = {
    "普通Ｍ": ["……この絵、俺に似ているのか。見ていると、胸の奥がざわつくな。", "顔を描かれただけなのに、何かを置いてきた気がする。"],
    "普通Ｆ": ["この絵、私の中の暗いところまで映しているみたいです。", "見つめていると、少し怖いのに目を離せません。"],
    "強気Ｍ": ["上等だ。この不気味な絵ごと、俺の力にしてやる。", "清らかさなんて、今は邪魔になるだけだ。"],
    "強気Ｆ": ["気味が悪い絵ね。でも、この艶だけは悪くないわ。", "私の影まで描くなら、その影も使ってみせる。"],
    "内気": ["こ、これ……私なんですか？ 見ていると心まで汚れるみたいで……。", "怖いです。でも、目をそらせないんです……。"],
    "陰気": ["……よく描けている。俺の嫌なところまでな。", "この絵の目、俺より正直だ。……不愉快なくらいに。"],
    "お調子者": ["うわ、怖い絵っすね……でも妙に色気が出てないっすか？", "これ本当に自分っすか？ なんか危ない感じがするっす。"],
    "快活": ["なんだか怖い絵だね。でも、今の私、少し強く見えるかも。", "胸がざわざわする……これも私の顔なんだね。"],
    "お嬢様": ["まあ……なんて禍々しい筆致ですの。でも、目を離せませんわ。", "この肖像、私の影まで飾り立ててしまうのですわね。"],
    "クールＭ": ["肖像の影響を確認した。ためらいが薄れ、印象が強まっている。", "不快な絵だが、変化は明確だ。利用価値はある。"],
    "クールＦ": ["肖像の影響を確認したわ。ためらいが薄れて、印象だけが強く残る。", "気味は悪いけれど、変化は認めるしかないわね。"],
    "老人": ["なんとも悍ましい絵じゃ。わしの業まで塗り込めたようじゃな。", "長く生きた影が、顔に浮いたかのう。目をそらせんわい。"]
  };
  return randFrom(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function getGenericMiracleLine(person, miracleName) {
  if (miracleName === "悍ましい肖像画") return getGrotesquePortraitLine(person);
  const childLine = getChildlikeMiracleLine(person);
  if (childLine) return childLine;
  if (miracleName === "市場の奇跡") return getMarketMiracleLine(person);
  if (miracleName === "旅人の奇跡") return getTravelerMiracleLine(person);
  if (miracleName === "出立の奇跡") return getDepartureMiracleLine(person);
  const type = person.speechType || determineSpeechType(person);
  const lines = {
    "普通Ｍ": [`${miracleName}か……本当に不思議な力だな。`, "今の光、見えたか？"],
    "普通Ｆ": [`${miracleName}ですね。不思議で、少し温かい感じがします。`, "これが奇跡の力なんですね。"],
    "強気Ｍ": ["すごい力だな。これならやれる。", "神の力だろうが、使えるものは使うさ。"],
    "強気Ｆ": ["悪くないわね。これで前に進める。", "奇跡に頼った分、結果を出すわよ。"],
    "内気": ["す、すごいです……少し怖いくらい。", "今のが奇跡……なんですね。"],
    "陰気": ["……眩しいな。", "……奇跡なんてものも、あるんだな。"],
    "お調子者": ["うわー、すごいっすね！奇跡って感じっす！", "これは効いてるっすよ、たぶん！"],
    "快活": ["すごいね！なんだか元気が出る！", "奇跡って本当にあるんだね！"],
    "お嬢様": ["まあ……神々しい輝きですわ。", "この恵みに感謝いたしますわ。"],
    "クールＭ": ["現象を確認した。効果は明確だ。", "奇跡の発動を確認した。"],
    "クールＦ": ["発動したわね。効果を見極めましょう。", "不思議だけれど、結果は確かね。"],
    "老人": ["ありがたいことじゃのう。", "長く生きても、奇跡には驚かされるわい。"]
  };
  return randFrom(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function getTravelerMiracleLine(person) {
  const type = person.speechType || determineSpeechType(person);
  const lines = {
    "普通Ｍ": ["不思議な導きで、この村に足が向いたんだ。しばらく世話になるよ。", "道を選んだつもりが、道に選ばれたみたいだな。ここがその先か。"],
    "普通Ｆ": ["なぜかこの村へ来なければと思ったんです。少し、休ませてください。", "旅の途中で光を見たんです。気づいたら、この村へ向かっていました。"],
    "丁寧Ｍ": ["旅の途中、不思議な導きを受けました。しばし滞在をお許しください。", "この村に寄るべきだと感じまして。ご迷惑でなければ、少し休ませていただきます。"],
    "丁寧Ｆ": ["奇跡のお導きでしょうか。この村へ参るべきだと感じました。", "旅路の途中で不思議な気配に導かれました。どうぞよろしくお願いいたします。"],
    "強気Ｍ": ["妙な力に引かれて来た。だが、来たからには役に立つつもりだ。", "道に迷ったわけじゃない。ここへ来るべきだと、はっきり感じたんだ。"],
    "強気Ｆ": ["呼ばれた気がしたの。理由は後で考えるわ。まずはこの村を見せて。", "奇跡に背中を押されたなら、受けて立つだけよ。しばらく世話になるわ。"],
    "内気": ["あ、あの……気づいたらこの村の近くまで来ていて……。", "不思議な光が見えて……怖かったけど、ここなら大丈夫な気がしたんです。"],
    "陰気": ["……呼ばれた気がした。俺には似合わない話だが、ここに着いた。", "……道がこちらへ曲がった。偶然ではないんだろうな。"],
    "お調子者": ["いやー、不思議な旅になったっす！ここに来れば何かある気がしたっすよ！", "奇跡に呼ばれて登場っす！しばらくよろしくお願いするっす！"],
    "快活": ["ここだ！って思ったんだ。なんだか胸がわくわくする！", "旅の途中で光が見えてね。この村に来られてよかった！"],
    "お嬢様": ["この村へ導かれるとは、きっと意味のある巡り合わせですわ。", "旅路に奇跡が差すなんて、物語の一節のようですわね。"],
    "クールＭ": ["移動経路に不可解な偏りがあった。だが到着地点はこの村で間違いない。", "導きの原因は不明だ。しばらく観察と滞在を希望する。"],
    "クールＦ": ["理由は説明できないけれど、この村に来る必要があった。そう判断しているわ。", "旅程は狂ったけれど、結果としてここへ着いた。悪くないわね。"],
    "老人": ["足が勝手にこちらへ向いてのう。奇跡とは年寄りにも容赦がないわい。", "長旅の途中で、不思議な光に導かれたわい。少し腰を下ろさせておくれ。"]
  };
  return randFrom(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function getMarketMiracleLine(person) {
  const type = person.speechType || determineSpeechType(person);
  const lines = {
    "普通Ｍ": ["呼ばれた気がして来てみれば、よい市が開けそうだ。品を見ていってくれ。", "奇跡に招かれる商いとは珍しいな。まずは値を確かめてくれ。"],
    "普通Ｆ": ["不思議な導きで参りました。よい品を揃えていますので、どうぞご覧ください。", "この村に市を開けるとは光栄です。必要なものがあれば声をかけてください。"],
    "丁寧Ｍ": ["お招きにあずかったようです。食料も資材も、きちんとお売りいたします。", "市の支度は整っております。ご入り用のものをお申し付けください。"],
    "丁寧Ｆ": ["奇跡のお導きでしょうか。食料と資材をお持ちしましたので、ご覧くださいませ。", "市を開く支度はできております。村のお役に立てましたら幸いです。"],
    "強気Ｍ": ["奇跡に呼ばれたなら、商いで応えるだけだ。いい品を持ってきたぞ。", "値切りはほどほどにな。だが品の良さは保証する。"],
    "強気Ｆ": ["呼ばれたからには、半端な商いはしないわ。必要なものを選びなさい。", "いい市にしましょう。こちらも村の特産には期待しているわ。"],
    "内気": ["あ、あの……品物を持ってきました。よければ見てください。", "不思議な光に導かれて……ここで市を開けばいいんですよね。"],
    "陰気": ["……奇跡で呼ばれる商いか。妙な縁だが、品は確かだ。", "……食料と資材はある。必要なら買っていけ。"],
    "お調子者": ["いやー、奇跡で出店とは景気がいいっすね！どんどん見てってほしいっす！", "市が立つなら声出していくっすよ！食料も資材もありますって！"],
    "快活": ["市だね！いい品を持ってきたから、みんなで見に来て！", "奇跡で呼ばれるなんて楽しいね。今日はにぎやかに売るよ！"],
    "お嬢様": ["まあ、奇跡に招かれて市を開くとは、なんとも優雅ですわ。品定めをどうぞ。", "村の皆様のお役に立てる品を揃えておりますわ。"],
    "クールＭ": ["市場形成の機会と判断した。食料と資材を取引可能だ。", "招致の経緯は不明だが、商取引は成立する。品目を確認してくれ。"],
    "クールＦ": ["市場の成立を確認したわ。食料と資材、どちらも取引できる。", "奇跡の経路は不明だけれど、商いには支障ないわ。品を見て。"],
    "老人": ["ほう、奇跡に呼ばれて市を開くとはのう。古い品も新しい品も見ていきなされ。", "長く商いをしてきたが、神に呼ばれる市は珍しいわい。さあ、見ておくれ。"]
  };
  return randFrom(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function getDepartureMiracleLine(person) {
  const type = person.speechType || determineSpeechType(person);
  const lines = {
    "普通Ｍ": ["行かなきゃならない気がするんだ。怖いけど、足はもう前を向いてる。", "世話になったな。いつか胸を張って、この旅の意味を話せるようにするよ。"],
    "普通Ｆ": ["急でごめんなさい。でも、遠くから呼ばれているみたいなんです。", "別れは寂しいですけど、この旅にはきっと意味があるんだと思います。"],
    "強気Ｍ": ["理由はうまく言えない。だが行く。止めても無駄だ。", "別れは苦手だが、俺には俺の道ができた。必ず生きて進む。"],
    "強気Ｆ": ["胸の奥がうるさいの。行けって言うなら、行ってやるわ。", "泣かないで。私が選んだ旅よ。半端な覚悟で出ていくわけじゃない。"],
    "内気": ["こ、怖いです……でも、ここにいたらいけない気がして……。", "皆さんと離れるのはつらいです。でも、行かなきゃって、ずっと聞こえるんです。"],
    "陰気": ["……妙な衝動だ。俺らしくもないのに、外へ出ろと急かされる。", "別れの言葉は得意じゃない。……世話になった。"],
    "お調子者": ["いやー、急に旅立ちっすよ。自分でもびっくりしてるっす。", "寂しくなるっすけど、土産話を山ほど抱えて戻るつもりっす！"],
    "快活": ["わからないけど、行きたいんだ。胸がどきどきして止まらない！", "みんな、ありがとう！この先で何か見つけてくるね！"],
    "お嬢様": ["名残惜しいですわ。けれど、この胸の導きを無視できませんの。", "皆様のご恩は忘れませんわ。私の旅路に、どうか祝福を。"],
    "クールＭ": ["衝動の発生源は不明だ。だが、進むべき方向だけは明確だ。", "村を離れる。感傷はあるが、使命を優先する。"],
    "クールＦ": ["説明しきれない感覚ね。けれど、行くべきだと判断したわ。", "別れは惜しいけれど、迷っている時間はない。旅立つわ。"],
    "老人": ["この年でまた旅支度とはのう。奇跡とは人を落ち着かせてくれん。", "世話になったのう。残りの道を、もう少し歩いてみるとするか。"]
  };
  return randFrom(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

export function showMiracleResultModal(village, miracleName, message, people = [], options = {}) {
  if (typeof document === "undefined") return;
  const entries = (people || []).filter(Boolean);
  if (entries.length === 0 && !options.allowEmpty) return;
  const overlay = document.createElement("div");
  overlay.className = "effect-result-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
  const modal = document.createElement("div");
  modal.className = "effect-result-modal";
  modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:620px;width:calc(100% - 32px);max-height:min(80vh,720px);overflow:auto;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
  const rows = entries.map(person => `
    <div style="display:grid;grid-template-columns:72px 1fr;gap:12px;margin:12px 0;align-items:center;">
      <img src="${getPortraitPath(person)}" alt="${person.name}" style="width:72px;height:72px;object-fit:cover;border:1px solid #ddd;background:#f6f0e6;">
      <p><strong>${person.name}</strong>: ${getGenericMiracleLine(person, miracleName)}</p>
    </div>
  `).join("");
  modal.innerHTML = `
    <h2>${miracleName}</h2>
    <p>${message}</p>
    ${rows}
    <button type="button" data-close-miracle-result-modal>閉じる</button>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-miracle-result-modal]").onclick = () => {
    overlay.remove();
    modal.remove();
    updateUI(village);
    showPendingDivineMightLevelUpModal(village);
  };
}

function getMarriageMiracleLine(person, partner, miracleName) {
  const childLine = getChildlikeMiracleLine(person);
  if (childLine) return childLine;
  const type = person.speechType || determineSpeechType(person);
  const lines = {
    "普通Ｍ": [`${partner.name}と夫婦か……不思議だけど、悪くないな。`, "急な話だけど、ちゃんと向き合うよ。"],
    "普通Ｆ": [`${partner.name}さんと夫婦になるんですね。大切にします。`, "驚きましたけど、嬉しいです。"],
    "強気Ｍ": [`${partner.name}を守る。それだけだ。`, "奇跡だろうが何だろうが、覚悟は決めた。"],
    "強気Ｆ": [`${partner.name}となら悪くないわ。私が支えるから。`, "いきなりだけど、逃げる気はないわ。"],
    "内気": [`${partner.name}さんと……緊張します。でも、頑張ります。`, "急でびっくりしました……でも、嫌ではないです。"],
    "陰気": [`……${partner.name}と夫婦か。奇跡とは妙なものだ。`, "……こうなったなら、捨て置けないな。"],
    "お調子者": [`${partner.name}と結婚っすか！？いやー、奇跡ってすごいっすね！`, "これはもう盛り上げるしかないっす！"],
    "快活": [`${partner.name}と夫婦だね！よろしく！`, "びっくりしたけど、なんだか楽しくなってきた！"],
    "お嬢様": [`${partner.name}様と結ばれるとは……奇跡とは優雅なものですわ。`, "突然ではありますけれど、心を込めて歩みますわ。"],
    "クールＭ": [`${miracleName}の結果は理解した。${partner.name}との関係を大切にする。`, "状況は急だが、責任は果たす。"],
    "クールＦ": [`${partner.name}と夫婦ね。冷静に受け止めるわ。`, "奇跡の結果なら、これからを考えるだけよ。"],
    "老人": [`${partner.name}と夫婦になるとはのう。奇跡に導かれた縁、大事にしよう。`, "新たな家族を得るとはな。わしも心を決めよう。"]
  };
  return randFrom(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

export function showMarriageMiracleModal(village, miracleName, pairs, options = {}) {
  if (typeof document === "undefined" || !pairs.length) return;

  const overlay = document.createElement("div");
  overlay.className = "effect-result-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
  const modal = document.createElement("div");
  modal.className = "effect-result-modal";
  modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:620px;width:calc(100% - 32px);max-height:min(80vh,720px);overflow:auto;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
  const message = options.message || "奇跡により新たな夫婦が結ばれました。";

  const rows = pairs.map(([a, b]) => `
    <div style="display:grid;grid-template-columns:72px 1fr;gap:12px;margin:12px 0;padding-bottom:12px;border-bottom:1px solid #ddd;align-items:center;">
      <img src="${getPortraitPath(a)}" alt="${a.name}" style="width:72px;height:72px;object-fit:cover;">
      <p><strong>${a.name}</strong>: ${getMarriageMiracleLine(a, b, miracleName)}</p>
      <img src="${getPortraitPath(b)}" alt="${b.name}" style="width:72px;height:72px;object-fit:cover;">
      <div>
        <p><strong>${b.name}</strong>: ${getMarriageMiracleLine(b, a, miracleName)}</p>
      </div>
    </div>
  `).join("");

  modal.innerHTML = `
    <h2>${miracleName}</h2>
    <p>${message}</p>
    ${rows}
    <button type="button" data-close-marriage-miracle-modal>閉じる</button>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-marriage-miracle-modal]").onclick = () => {
    overlay.remove();
    modal.remove();
    updateUI(village);
  };
}

function randFrom(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

function getBodyExchangeLineKey(person) {
  const raiderTypes = ["野盗", "ゴブリン", "狼", "キュクロプス", "ハーピー"];
  if (person.mindTraits && person.mindTraits.includes("襲撃者")) {
    const raiderType = raiderTypes.find(type => person.name.includes(type));
    if (raiderType) return raiderType;
  }
  const sourceRace = person.lastBodyExchangeSourceRace;
  if (sourceRace && sourceRace !== person.race) {
    const sourceRaceKey = BODY_EXCHANGE_SOURCE_RACE_LINE_KEYS[sourceRace];
    if (sourceRaceKey) return sourceRaceKey;
  }
  return resolveDialogueTone(person);
}

function getBodyExchangeReactionLine(person) {
  const type = getBodyExchangeLineKey(person);
  const fallbackType = person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ";
  return randFrom(BODY_EXCHANGE_REACTION_LINES[type] || BODY_EXCHANGE_REACTION_LINES[fallbackType] || BODY_EXCHANGE_REACTION_LINES["普通Ｍ"]);
}

function createPanFluteExchangePerson(person) {
  const wrapper = document.createElement("div");
  wrapper.className = "pan-flute-person";

  const portraitArea = document.createElement("div");
  portraitArea.className = "pan-flute-portrait";
  const img = document.createElement("img");
  try {
    img.src = getPortraitPath(person);
  } catch {
    img.src = DEFAULT_PORTRAIT_PATH;
  }
  img.alt = `${person.name} portrait`;
  img.onerror = () => {
    img.src = DEFAULT_PORTRAIT_PATH;
  };
  portraitArea.appendChild(img);

  const dialogue = document.createElement("div");
  dialogue.className = "pan-flute-dialogue";
  const name = document.createElement("strong");
  name.textContent = `${person.name}:`;
  const line = document.createElement("span");
  line.textContent = getBodyExchangeReactionLine(person);
  dialogue.appendChild(name);
  dialogue.appendChild(line);

  wrapper.appendChild(portraitArea);
  wrapper.appendChild(dialogue);
  return wrapper;
}

export function openPanFluteExchangeModal(pairs, options = {}) {
  const overlay = document.getElementById("panFluteExchangeOverlay");
  const modal = document.getElementById("panFluteExchangeModal");
  const list = document.getElementById("panFluteExchangePairs");
  if (!overlay || !modal || !list) return;

  const title = modal.querySelector(".exchange-title h3");
  const message = modal.querySelector(".exchange-title p");
  if (title) title.textContent = options.title || "牧神の管笛";
  if (message) message.textContent = options.message || "笛の音に誘われ、魂たちは互いの体を見てざわめいている...";

  list.innerHTML = "";
  pairs.forEach(([personA, personB], index) => {
    const item = document.createElement("div");
    item.className = "pan-flute-pair";

    const label = document.createElement("div");
    label.className = "pan-flute-pair-label";
    label.textContent = `${index + 1}組目`;

    const body = document.createElement("div");
    body.className = "pan-flute-pair-body";
    body.appendChild(createPanFluteExchangePerson(personA));

    const arrow = document.createElement("div");
    arrow.className = "pan-flute-arrow";
    arrow.textContent = "⇄";
    body.appendChild(arrow);

    body.appendChild(createPanFluteExchangePerson(personB));
    item.appendChild(label);
    item.appendChild(body);
    list.appendChild(item);
  });

  overlay.style.display = "block";
  modal.style.display = "block";
}

export function closePanFluteExchangeModal() {
  const overlay = document.getElementById("panFluteExchangeOverlay");
  const modal = document.getElementById("panFluteExchangeModal");
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
}

/**
 * 肉体交換(雷/奇跡)
 */
/**
 * 交換の奇跡モーダルを開く
 */
export function openExchangeModal(personA, personB, options = {}) {
  pendingExchangeResultVillage = options.village || null;
  const overlay = document.getElementById("exchangeOverlay");
  const modal = document.getElementById("exchangeModal");
  const portraitA = document.getElementById("exchangePortraitA");
  const portraitB = document.getElementById("exchangePortraitB");
  const textA = document.getElementById("exchangeTextA");
  const textB = document.getElementById("exchangeTextB");

  if (!overlay || !modal || !portraitA || !portraitB || !textA || !textB) return;

  const title = modal.querySelector(".exchange-title h3");
  const message = modal.querySelector(".exchange-title p");
  if (title) title.textContent = options.title || "交換の奇跡";
  if (message) message.textContent = options.message || "二人の魂は互いの体を見て驚いている...";

  // 顔グラフィックを設定（エラーハンドリング付き）
  try {
    // 共通関数を使用して顔グラフィックのパスを取得
    // 注意: 交換後の状態を表示するため、personAの体はpersonBの顔グラフィックを表示
    portraitA.src = getPortraitPath(personA);
    portraitA.onerror = () => {
      console.error(`Portrait image not found: ${portraitA.src}`);
      portraitA.src = DEFAULT_PORTRAIT_PATH;
    };

    // 同様に、personBの体はpersonAの顔グラフィックを表示
    portraitB.src = getPortraitPath(personB);
    portraitB.onerror = () => {
      console.error(`Portrait image not found: ${portraitB.src}`);
      portraitB.src = DEFAULT_PORTRAIT_PATH;
    };
  } catch (error) {
    console.error('Error loading portraits:', error);
    portraitA.src = DEFAULT_PORTRAIT_PATH;
    portraitB.src = DEFAULT_PORTRAIT_PATH;
  }

  const speechTypeA = getBodyExchangeLineKey(personA);
  const speechTypeB = getBodyExchangeLineKey(personB);

  // 入れ替わり時のセリフをランダムに選択
  const getRandomLine = (patterns, type, person) => {
    const fallbackType = person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ";
    return randFrom(patterns[type] || patterns[fallbackType] || patterns["普通Ｍ"]);
  };

  // 会話テキストを設定
  textA.innerHTML = `
    <p><strong>${personA.name}:</strong> ${getRandomLine(BODY_EXCHANGE_REACTION_LINES, speechTypeA, personA)}</p>
  `;

  textB.innerHTML = `
    <p><strong>${personB.name}:</strong> ${getRandomLine(BODY_EXCHANGE_REACTION_LINES, speechTypeB, personB)}</p>
  `;

  overlay.style.display = "block";
  modal.style.display = "block";
}

/**
 * 交換の奇跡モーダルを閉じる
 */
export function closeExchangeModal() {
  const overlay = document.getElementById("exchangeOverlay");
  const modal = document.getElementById("exchangeModal");
  const village = pendingExchangeResultVillage;
  pendingExchangeResultVillage = null;

  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
  if (village) showPendingDivineMightLevelUpModal(village);
}
