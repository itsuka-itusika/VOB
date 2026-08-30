// miracles.js

import { clampValue, shuffleArray } from "./util.js";
import { applyPortraitToElement, getPortraitSpriteHtml } from "./data/portraitAtlas.js";
import { addRelationship, removeRelationship, checkHasRelationship, hasLoverRelationship, getRelationshipTargetId, clearRelationshipsForDepartedVillager, addSpouseRelationships, raiseMutualFriendshipTo } from "./relationships.js";
import { updateUI } from "./ui.js";  // 実行後にUIを更新する
import { canExchangeBody, doExchange } from "./exchange.js";
import { createRandomVisitor, createRandomVisitorOfType, isRareVisitorTypeAvailable, EXCLUSIVE_BODY_TRAITS, EXCLUSIVE_MIND_TRAITS } from "./createVillagers.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { addStoredResource } from "./domain/resourceLimits.js";
import { syncEffectiveStats } from "./domain/statLayers.js";
import { recordDepartedVillager, recordMarriageHistory, recordVillagerLeaveHistory } from "./history.js";
import { clearHopeLossTraits, DESPAIR_TRAIT, DISAPPOINTMENT_TRAIT } from "./domain/despair.js";
import { resolveDialogueTone } from "./data/dialogue/toneProfiles.js";
import { getDialogueLine } from "./dialogue/dialogueEngine.js";
import { BODY_EXCHANGE_SOURCE_RACE_LINE_KEYS, BODY_EXCHANGE_REACTION_LINES } from "./data/dialogue/exchangeLines.js";
import { getVisitorArrivalLine } from "./data/dialogue/visitorLines.js";
import { getActiveVillagers, isSaltPillar, SALT_PILLAR_TRAIT } from "./domain/apocalypseRules.js";
import { getSelectableRaidTables, startRaidEvent } from "./raidStart.js";
import { getRaiderIncomingDamageMultiplier } from "./raidRules.js";
import { completeTutorialTask } from "./tutorial.js";
import { getCaptives, normalizeCaptive } from "./captives.js";
import { hasActiveBuildingFlag } from "./domain/buildingState.js";
import { getVillageRole, VILLAGE_ROLE_DOCTOR } from "./domain/villageRoles.js";
import { checkWishCompletion } from "./wishes.js";
import {
  addDivineMight,
  DIVINE_MIGHT_LEVELS,
  getDivineMightGainFromMiracleCost,
  getDivineMightStatus,
  getMiracleUnlockInfo,
  showPendingDivineMightLevelUpModal,
  subtractDivineMight
} from "./divineMight.js";

const AUTONOMOUS_SETTLEMENT_SCALE = 350;
const THUNDERBOLT_MIRACLE_DAMAGE = 80;
const HEAVY_DRINKER_TRAIT = "酒豪";
let pendingExchangeResultVillage = null;
const POST_CLEAR_MIRACLE_IDS = new Set(["18", "19"]);
const EFFECT_RESULT_DIALOGUES = {
  "清拭の奇跡": { scene: "miracle", key: "cleanliness" },
  "常春の奇跡": { scene: "miracle", key: "everSpring" },
  "冥王妃の神像": { scene: "miracle", key: "everSpring" },
  "宴会の奇跡": { scene: "miracle", key: "feast" },
  "狂宴の奇跡": { scene: "miracle", key: "revel" },
  "酒杯の奇跡": { scene: "miracle", key: "goblet" },
  "戦神の奇跡": { scene: "miracle", key: "warGod" },
  "雷霆の奇跡": { scene: "miracle", key: "thunderbolt" },
  "豊穣の奇跡": { scene: "miracle", key: "abundance" },
  "豊穣の角": { scene: "miracle", key: "abundance" },
  "マナの奇跡": { scene: "miracle", key: "mana" },
  "ミダスの奇跡": { scene: "miracle", key: "midas" },
  "アンブロシア": { scene: "secretTreasure", key: "ambrosia" },
  "告天使の絵画": { scene: "secretTreasure", key: "annunciationPainting" },
  "ネクタル": { scene: "secretTreasure", key: "nectar" },
  "奇妙な計算機械": { scene: "secretTreasure", key: "strangeCalculator" },
  "蛇の巻き付いた杖": { scene: "secretTreasure", key: "serpentStaff" },
  "クロノスの秘薬": { scene: "secretTreasure", key: "chronosElixir" },
  "腕の無い天使像": { scene: "secretTreasure", key: "armlessAngel" },
  "悍ましい肖像画": { scene: "miracle", key: "grotesquePortrait" },
  "旅人の奇跡": { scene: "miracle", key: "traveler" },
  "市場の奇跡": { scene: "miracle", key: "market" },
  "出立の奇跡": { scene: "miracle", key: "departure" }
};

function getAlcoholMiracleRecoveryAmount(person, baseAmount) {
  const mindTraits = Array.isArray(person?.mindTraits) ? person.mindTraits : [];
  const multiplier = mindTraits.includes(HEAVY_DRINKER_TRAIT) ? 1.5 : 1;
  return Math.round((Number(baseAmount) || 0) * multiplier);
}
/**
 * 奇跡リスト
 */
// 宴会・狂宴の費用は在籍人数に比例し、魔素と資金を同額ずつ消費する。
export const FEAST_COST_PER_PERSON = 10;
export const REVEL_COST_PER_PERSON = 20;

export const MIRACLES = [
  {id:"12", name:"交換の奇跡(20)", cost:20, desc:"2人の肉体を交換"},
  {id:"13", name:"交換の奇跡・強(200)", cost:200, desc:"村外含む2人交換"},
  {id:"1",  name:"豊穣の奇跡(100)", cost:100, desc:"今月のみ、農作業・伐採・狩猟・漁・採集の成果と醸造の食料獲得2倍"},
  {id:"2",  name:"マナの奇跡(40)",  cost:40,  desc:"食料+80"},
  {id:"3",  name:"クピドの奇跡(80)", cost:80, desc:"2人を強制結婚(条件無視)"},
  {id:"4",  name:`宴会の奇跡(人数×${FEAST_COST_PER_PERSON})`, cost:-1, desc:"全員体力/メンタル+20,幸福+20,飢餓/凍え/失望/絶望解除 (資金×人数分も要)"},
  {id:"5",  name:`狂宴の奇跡(人数×${REVEL_COST_PER_PERSON})`, cost:-2, desc:"全員体力/メンタル全回復,幸福+50,飢餓/凍え/失望/絶望解除,倫理↓,好色+15"},
  {id:"6",  name:"癒しの奇跡(80)", cost:80, desc:"1人の負傷/重体/疫病/疲労等回復,体力+50"},
  {id:"20", name:"清拭の奇跡(60)", cost:60, desc:"3ヶ月間、村特性「清浄」を付与し、疫病の感染と重体の危篤化を防ぐ"},
  {id:"16", name:"酒杯の奇跡(50)", cost:50, desc:"1人の心労/抑鬱/失望/絶望回復,メンタル+50,幸福+30,酩酊付与"},
  {id:"7",  name:"戦神の奇跡(80)", cost:80, desc:"1人に火星の加護(3ヶ月,筋力/耐久/勇気+7,知力/勤勉/倫理*0.2)"},
  {id:"8",  name:"竈女神の奇跡(40)", cost:40, desc:"恋人を結婚100%(対象なしなら使用不可)"},
  {id:"9",  name:"常春の奇跡(300)", cost:300,desc:"村特性→春に固定。次の季節まで継続"},
  {id:"10", name:"旅人の奇跡(40)", cost:40, desc:"ランダム来訪者(訪問者付与)"},
  {id:"11", name:"出立の奇跡(50)", cost:50, desc:"1人離脱→幸福度分の魔素獲得"},
  {id:"14", name:"ミダスの奇跡(100)", cost:100, desc:"1ヶ月間、食料を得る代わりに資金を得る"},
  {id:"15", name:"市場の奇跡(100)", cost:100, desc:"行商人の訪問者を3人生成"},
  {id:"17", name:"雷霆の奇跡(150)", cost:150, desc:"月1回。襲撃者1体の体力を80減らす。最低1で止まる"},
  {id:"18", name:"騒擾の奇跡(100)", cost:100, desc:"襲撃中でない時、選んだ規模（異端を含む）の襲撃テーブルから、ただちに襲撃を発生させる"},
  {id:"19", name:"稀人の奇跡(300)", cost:300, desc:"翼人、アルセイド、ネレイド、ドライアド、アラクニド、エクイナ、サテュロス、メナドの訪問者を1人呼ぶ"}
];

const MIRACLE_UNLOCK_ORDER = DIVINE_MIGHT_LEVELS.flatMap(entry => entry.miracleIds);

function getVillageMiracleUnlockInfo(miracleId, village) {
  const unlockInfo = getMiracleUnlockInfo(miracleId, village);
  if (!unlockInfo.unlocked || miracleId !== "20") return unlockInfo;
  if (hasActiveBuildingFlag(village, "hasBrewery", "brewery")) return unlockInfo;
  return { ...unlockInfo, unlocked: false, reason: "醸造所建設で解放" };
}

function getMiraclesForModal(village) {
  const byId = new Map(MIRACLES.map(miracle => [miracle.id, miracle]));
  const ordered = MIRACLE_UNLOCK_ORDER
    .map(id => byId.get(id))
    .filter(Boolean);
  const listedIds = new Set(MIRACLE_UNLOCK_ORDER);
  return ordered
    .concat(MIRACLES.filter(miracle => !listedIds.has(miracle.id)))
    .filter(miracle => village?.apocalypseCleared || !POST_CLEAR_MIRACLE_IDS.has(miracle.id));
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
  getMiraclesForModal(village).forEach(m=>{
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
      const selectOptions = mid === "12"
        ? { normalExchangeOnly: true, includeSaltPillar: true }
        : (mid === "13" ? { includeSaltPillar: true, excludeExchangeImmune: true } : { villagersOnly: true });
      div.appendChild(createVillagerSelect("targetA", village, selectOptions));
      div.appendChild(createVillagerSelect("targetB", village, selectOptions));
    } else {
      div.appendChild(createVillagerSelect("targetA", village, { villagersOnly: true }));
    }
  }
}

/** 宴会・狂宴の費用を数える人数。効果が届かない塩の柱は数えない。 */
function countFeastCostTargets(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  return villagers.filter(person => !isSaltPillar(person)).length;
}

function getMiracleCostInfo(miracle, village) {
  const peopleCount = countFeastCostTargets(village);
  if (miracle.cost === -1) {
    const amount = peopleCount * FEAST_COST_PER_PERSON;
    return { mana: amount, funds: amount, label: `魔素: ${amount} / 資金: ${amount}` };
  }
  if (miracle.cost === -2) {
    const amount = peopleCount * REVEL_COST_PER_PERSON;
    return { mana: amount, funds: amount, label: `魔素: ${amount} / 資金: ${amount}` };
  }
  const hasGoldenStatue = hasActiveBuildingFlag(village, "hasBacchusGoldenStatue", "bacchusGoldenStatue");
  const mana = hasGoldenStatue && ["12", "13"].includes(miracle.id)
    ? Math.ceil(miracle.cost / 4)
    : miracle.cost;
  return { mana, funds: 0, label: `魔素: ${mana}` };
}

function getMiracleBlockReason(costInfo, village, miracleId = "") {
  const reasons = [];
  const unlockReason = getVillageMiracleUnlockInfo(miracleId, village).reason;
  if (unlockReason) reasons.push(unlockReason);
  if (village.mana < costInfo.mana) reasons.push("魔素不足");
  if (village.funds < costInfo.funds) reasons.push("資金不足");
  if (miracleId === "8" && !hasHearthMiracleTarget(village)) reasons.push("対象村人なし");
  if (miracleId === "17" && hasUsedThunderboltMiracleThisMonth(village)) reasons.push("今月は使用済み");
  if (miracleId === "18" && village.villageTraits.includes("襲撃中")) reasons.push("襲撃中は使用不可");
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

// 宴会・狂宴で振る舞う飲食が癒す、欠乏由来の状態異常。
const BANQUET_MIRACLE_BODY_TRAITS = ["飢餓", "凍え"];

/** 宴会・狂宴で飢餓と凍えを取り除く。1つでも取り除けたら true。 */
function clearBanquetBodyTraits(person, village) {
  if (!BANQUET_MIRACLE_BODY_TRAITS.some(trait => person.bodyTraits.includes(trait))) return false;
  person.bodyTraits = person.bodyTraits.filter(trait => !BANQUET_MIRACLE_BODY_TRAITS.includes(trait));
  syncEffectiveStats(person);
  refreshJobTable(person, village);
  return true;
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
    if (done.has(a) || isSaltPillar(a) || !hasLoverRelationship(a) || checkHasRelationship(a, "既婚")) return;
    const bId = getRelationshipTargetId(a, "恋人");
    const b = bId != null ? village.villagers.find(person => person.id === bId) : null;
    if (!b || done.has(b) || isSaltPillar(b) || checkHasRelationship(b, "既婚")) return;
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

// まとめて行使できる奇跡。1人ぶんの効果と費用を、選んだ人数へそのまま掛ける。
const MULTI_TARGET_MIRACLE_IDS = new Set(["6", "16", "11"]);

/** 複数選択のチェックが入っているか。対象を1人しか取らない奇跡では常に false。 */
function isMiracleMultiMode(mid) {
  if (!MULTI_TARGET_MIRACLE_IDS.has(mid)) return false;
  return Boolean(document.getElementById("miracleMultiToggle")?.checked);
}

/** 複数選択で選ばれている人物ID。単数モードなら空配列。 */
function getMiracleMultiTargetIds(mid) {
  if (!isMiracleMultiMode(mid)) return [];
  const list = document.getElementById("miracleMultiList");
  if (!list) return [];
  return [...list.querySelectorAll("input[type=\"checkbox\"]:checked")].map(box => box.value);
}

// 癒し・酒杯が取り除くデバフ特性。選択リストの表示と効果処理で同じ並びを使う。
const HEAL_MIRACLE_BODY_TRAITS = ["負傷", "重体", "疲労", "過労", "飢餓", "疫病", "産褥", "凍え"];
const GOBLET_MIRACLE_MIND_TRAITS = ["心労", "抑鬱", DISAPPOINTMENT_TRAIT, DESPAIR_TRAIT];
const NECTAR_BODY_TRAITS = ["負傷", "重体", "疲労", "過労", "疫病"];
const NECTAR_MIND_TRAITS = ["心労", "抑鬱"];
const SERPENT_STAFF_BODY_TRAITS = ["負傷", "重体", "疲労", "過労", "飢餓", "疫病", "産褥", "凍え", "危篤"];
const SERPENT_STAFF_MIND_TRAITS = ["心労", "抑鬱", DISAPPOINTMENT_TRAIT, DESPAIR_TRAIT];

const MIRACLE_CONDITION_SORTS = {
  body: { traits: HEAL_MIRACLE_BODY_TRAITS, traitKey: "bodyTraits", statKey: "hp", statLabel: "体力" },
  mind: { traits: GOBLET_MIRACLE_MIND_TRAITS, traitKey: "mindTraits", statKey: "mp", statLabel: "ﾒﾝﾀﾙ" }
};

// 名前の後ろへ出す立場。捕虜・訪問者・襲撃者は同時には持たない。
const POSITION_MIND_TRAITS = ["捕虜", "訪問者", "襲撃者"];
// 交換の奇跡の選択リストに出す、肉体側の状態異常。重い順に並べる。
const EXCHANGE_MIRACLE_BODY_TRAITS = [
  "塩の柱", "危篤", "重体", "疫病", "負傷", "臨月", "産褥", "過労", "疲労", "飢餓", "凍え", "曝露"
];
// 奇跡ごとに、選択リストとプレビューへ出す情報の種類。指定がない奇跡は種族・性別・年齢だけを出す。
const MIRACLE_TARGET_DETAIL_KINDS = {
  "3": "cupid",
  "6": "body",
  "11": "departure",
  "12": "exchange",
  "13": "exchange",
  "16": "mind"
};

/** 選択リストの並び順。取り除ける特性が多い順、次に対象の値が低い順。 */
function sortByMiracleCondition(people, sort) {
  return [...people].sort((a, b) => {
    const traitDiff = getMiracleConditionTraits(b, sort).length - getMiracleConditionTraits(a, sort).length;
    if (traitDiff !== 0) return traitDiff;
    return (Number(a[sort.statKey]) || 0) - (Number(b[sort.statKey]) || 0);
  });
}

function getMiracleConditionTraits(person, sort) {
  const traits = Array.isArray(person?.[sort.traitKey]) ? person[sort.traitKey] : [];
  return sort.traits.filter(trait => traits.includes(trait));
}

function getPositionTrait(person) {
  const mindTraits = Array.isArray(person?.mindTraits) ? person.mindTraits : [];
  return POSITION_MIND_TRAITS.find(trait => mindTraits.includes(trait)) || "";
}

// 排他特性は循環参照を避けるため、モジュール初期化時ではなく呼び出し時に参照する。
function getExclusiveTrait(person, traitKey, exclusiveTraits) {
  const traits = Array.isArray(person?.[traitKey]) ? person[traitKey] : [];
  return traits.find(trait => exclusiveTraits.includes(trait)) || "";
}

function pickTraits(person, traitKey, order) {
  const traits = Array.isArray(person?.[traitKey]) ? person[traitKey] : [];
  return order.filter(trait => traits.includes(trait));
}

/** 奇跡ごとに、選択の判断へ要る分だけを名前の後ろへ並べる。 */
function getMiracleTargetDetails(person, detailKind, { forPreview = false } = {}) {
  if (detailKind === "nectar" || detailKind === "serpentStaff") {
    const bodyOrder = detailKind === "nectar" ? NECTAR_BODY_TRAITS : SERPENT_STAFF_BODY_TRAITS;
    const mindOrder = detailKind === "nectar" ? NECTAR_MIND_TRAITS : SERPENT_STAFF_MIND_TRAITS;
    const bodyTraits = pickTraits(person, "bodyTraits", bodyOrder);
    const mindTraits = pickTraits(person, "mindTraits", mindOrder);
    // 癒し・酒杯と同じく、該当する特性がない枠は出さない。
    return [
      `体力${Math.floor(Number(person.hp) || 0)}`,
      `ﾒﾝﾀﾙ${Math.floor(Number(person.mp) || 0)}`,
      bodyTraits.join("・"),
      mindTraits.join("・")
    ];
  }
  if (detailKind === "exchange") {
    return [
      `体力${Math.floor(Number(person.hp) || 0)}`,
      pickTraits(person, "bodyTraits", EXCHANGE_MIRACLE_BODY_TRAITS).join("・")
    ];
  }
  if (detailKind === "cupid") {
    // 結婚相手を選ぶ場面なので、プレビューでは中身の人柄まで見せる。
    const traits = [getExclusiveTrait(person, "bodyTraits", EXCLUSIVE_BODY_TRAITS)];
    if (forPreview) traits.push(getExclusiveTrait(person, "mindTraits", EXCLUSIVE_MIND_TRAITS));
    return [traits.filter(Boolean).join("・")];
  }
  if (detailKind === "departure") {
    return [`幸福${Math.floor(Number(person.happiness) || 0)}`];
  }
  const sort = MIRACLE_CONDITION_SORTS[detailKind];
  if (!sort) return [];
  return [
    `${sort.statLabel}${Math.floor(Number(person[sort.statKey]) || 0)}`,
    getMiracleConditionTraits(person, sort).join("・")
  ];
}

function getMiracleTargetParts(person, detailKind, options = {}) {
  const identityParts = [
    person.uiSexDisplay || person.bodySex || person.sex || "-",
    `${person.bodyAge ?? person.age ?? "-"}歳`
  ];
  if (detailKind !== "nectar" && detailKind !== "serpentStaff") {
    identityParts.unshift(person.race || "-");
  }
  return [
    ...identityParts,
    ...getMiracleTargetDetails(person, detailKind, options)
  ].filter(Boolean);
}

function formatMiracleTargetName(person) {
  const position = getPositionTrait(person);
  return `${person.name}${position ? `(${position})` : ""}`;
}

function formatMiracleOptionLabel(person, detailKind) {
  return `${formatMiracleTargetName(person)}　${getMiracleTargetParts(person, detailKind).join("/")}`;
}

function getMiracleTargetOptions(mid) {
  if (mid === "17") return { raidersOnly: true };
  if (mid === "12") return { normalExchangeOnly: true, includeSaltPillar: true };
  if (mid === "6") return { villagersOnly: true, includeCaptives: true, conditionSort: "body" };
  if (mid === "16") return { villagersOnly: true, includeCaptives: true, conditionSort: "mind" };
  if (mid === "3" || mid === "7" || mid === "11") return { villagersOnly: true };
  if (mid === "13") return { includeSaltPillar: true, excludeExchangeImmune: true };
  return {};
}

function findMiracleTargetById(value, village) {
  const id = Number(value);
  if (!value || !Number.isFinite(id)) return null;
  return village.villagers.find(x => x.id === id) ||
    getCaptives(village).find(x => x.id === id) ||
    village.visitors.find(x => x.id === id) ||
    village.raidEnemies.find(x => x.id === id) ||
    null;
}

function areMiracleTargetsReady(mid) {
  if (mid === "18") {
    return Boolean(document.getElementById("riotRaidTable")?.value);
  }
  if (isMiracleMultiMode(mid)) return getMiracleMultiTargetIds(mid).length > 0;
  const count = getMiracleTargetCount(mid);
  if (count === 0) return true;
  const targetA = document.getElementById("targetA");
  const targetB = document.getElementById("targetB");
  if (count === 1) return Boolean(targetA && targetA.value);
  return Boolean(targetA && targetB && targetA.value && targetB.value && targetA.value !== targetB.value);
}

// 交換・戦神・雷霆のプレビューで見せる層。肉体を丸ごと見せたい奇跡で使う。
const MIRACLE_PREVIEW_LAYERS = {
  body: {
    statKey: "hp",
    statLabel: "体力",
    traitKey: "bodyTraits",
    stats: [["str", "筋"], ["vit", "耐"], ["dex", "器"], ["mag", "魔"], ["chr", "魅"]]
  }
};

function createMiraclePreviewRow(person) {
  const row = document.createElement("div");
  row.className = "miracle-preview-person";

  const portrait = document.createElement("div");
  portrait.className = "miracle-preview-portrait";
  applyPortraitToElement(portrait, person);

  const details = document.createElement("div");
  row.appendChild(portrait);
  row.appendChild(details);
  return { row, details };
}

/** 交換のように、肉体の中身をすべて見せるプレビュー。 */
function createMiracleFullPreviewPerson(person, layer) {
  const { row, details } = createMiraclePreviewRow(person);
  const traits = Array.isArray(person[layer.traitKey]) ? person[layer.traitKey] : [];
  const stats = layer.stats
    .map(([key, label]) => `${label}${Math.floor(Number(person[key]) || 0)}`)
    .join(" ");
  details.textContent = `${formatMiracleTargetName(person)}：${person.race || "-"} / ${person.uiSexDisplay || person.bodySex || person.sex || "-"} / ${person.bodyAge ?? person.age ?? "-"}歳 / ${layer.statLabel}${Math.floor(Number(person[layer.statKey]) || 0)} / ${stats} /（${traits.length > 0 ? traits.join("・") : "-"}）`;
  return row;
}

/** 選択リストの項目と同じ内容を見せるプレビュー。 */
function createMiracleTargetPreviewPerson(person, detailKind) {
  const { row, details } = createMiraclePreviewRow(person);
  const parts = getMiracleTargetParts(person, detailKind, { forPreview: true });
  details.textContent = `${formatMiracleTargetName(person)}：${parts.join(" / ")}`;
  return row;
}

function createMiraclePreviewPerson(person, mid) {
  const detailKind = MIRACLE_TARGET_DETAIL_KINDS[mid] || "";
  if (!detailKind || isExchangeMiracle(mid)) {
    return createMiracleFullPreviewPerson(person, MIRACLE_PREVIEW_LAYERS.body);
  }
  return createMiracleTargetPreviewPerson(person, detailKind);
}

function isExchangeMiracle(mid) {
  return mid === "12" || mid === "13";
}

function updateMiraclePreview(mid, village, preview) {
  if (!preview) return;
  const targetCount = getMiracleTargetCount(mid);
  if (targetCount === 0) {
    preview.textContent = "";
    return;
  }

  // 複数選択では一覧側に各自の状態が出ているため、ここは人数だけを添える。
  if (isMiracleMultiMode(mid)) {
    const chosen = getMiracleMultiTargetIds(mid).length;
    preview.textContent = chosen === 0 ? "対象を選択してください。" : `${chosen}人を選択中。`;
    return;
  }

  const personA = findMiracleTargetById(document.getElementById("targetA")?.value, village);

  if (targetCount === 2) {
    const personB = findMiracleTargetById(document.getElementById("targetB")?.value, village);
    if (!personA || !personB || personA === personB) {
      preview.textContent = "2人を選ぶと、対象の情報を表示します。";
      return;
    }
    const rows = [];
    if (isExchangeMiracle(mid)) {
      const description = document.createElement("div");
      description.className = "miracle-preview-description";
      description.textContent = "種族・性別・年齢・体力・身体能力・身体特性が入れ替わります。";
      rows.push(description);
    }
    rows.push(createMiraclePreviewPerson(personA, mid), createMiraclePreviewPerson(personB, mid));
    preview.replaceChildren(...rows);
    return;
  }

  if (!personA) {
    preview.textContent = "対象を選択してください。";
    return;
  }
  preview.replaceChildren(createMiraclePreviewPerson(personA, mid));
}

function updateMiracleActionButton(mid, button, village, costInfo, preview) {
  const chosenCount = getMiracleMultiTargetIds(mid).length;
  const totalCost = costInfo.mana * Math.max(1, chosenCount);
  const multiCostInfo = chosenCount > 1 ? { ...costInfo, mana: totalCost } : costInfo;
  const reason = getMiracleBlockReason(multiCostInfo, village, mid);
  const targetsReady = areMiracleTargetsReady(mid);
  button.disabled = Boolean(reason) || !targetsReady;
  button.textContent = reason ||
    (targetsReady
      ? (chosenCount > 1 ? `${chosenCount}人へ行使（魔素${totalCost}）` : "行使")
      : "対象を選んでください");
  updateMiraclePreview(mid, village, preview);
}

/*
 * 以下は奇跡以外のUI(秘宝など)から、奇跡と同じ対象選択の表示部品を使うための入口。
 * detailKind は MIRACLE_TARGET_DETAIL_KINDS と同じ語("exchange"、"body"など)を渡す。
 */

export function formatMiracleStyleOptionLabel(person, detailKind) {
  return formatMiracleOptionLabel(person, detailKind);
}

/** 状態ソートを持つ種別("body"、"mind")なら重い順に並べ替える。 */
export function sortMiracleStyleTargets(people, detailKind) {
  const sort = MIRACLE_CONDITION_SORTS[detailKind];
  return sort ? sortByMiracleCondition(people, sort) : [...people];
}

/** people は選択枠ぶんの配列。未選択の枠は null を渡す。 */
export function renderMiracleStylePreview(preview, people, detailKind) {
  if (!preview) return;
  const selected = people.filter(Boolean);
  if (people.length >= 2 && selected.length < people.length) {
    preview.textContent = "2人を選ぶと、対象の情報を表示します。";
    return;
  }
  if (selected.length === 0) {
    preview.textContent = "対象を選択してください。";
    return;
  }
  const rows = [];
  if (detailKind === "exchange" && selected.length >= 2) {
    const description = document.createElement("div");
    description.className = "miracle-preview-description";
    description.textContent = "種族・性別・年齢・体力・身体能力・身体特性が入れ替わります。";
    rows.push(description);
  }
  selected.forEach(person => {
    rows.push(detailKind === "exchange"
      ? createMiracleFullPreviewPerson(person, MIRACLE_PREVIEW_LAYERS.body)
      : createMiracleTargetPreviewPerson(person, detailKind));
  });
  preview.replaceChildren(...rows);
}

function createMiracleTargetControls(miracle, village, button, costInfo) {
  if (miracle.id === "18") {
    const controls = document.createElement("div");
    controls.className = "miracle-targets";

    const label = document.createElement("label");
    label.className = "miracle-target";
    const labelText = document.createElement("span");
    labelText.textContent = "襲撃テーブル";

    const select = document.createElement("select");
    select.id = "riotRaidTable";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "(規模・異端を選択)";
    select.appendChild(placeholder);
    getSelectableRaidTables().forEach(table => {
      const option = document.createElement("option");
      option.value = table.id;
      option.textContent = table.label;
      select.appendChild(option);
    });

    const preview = document.createElement("div");
    preview.className = "miracle-preview";
    preview.textContent = "選んだ襲撃テーブルから、重みに従って襲撃を1件抽選します。";

    const updateButton = () => {
      const reason = getMiracleBlockReason(costInfo, village, miracle.id);
      const ready = Boolean(select.value);
      button.disabled = Boolean(reason) || !ready;
      button.textContent = reason || (ready ? "行使" : "襲撃テーブルを選んでください");
    };
    select.addEventListener("change", updateButton);

    label.append(labelText, select);
    controls.append(label, preview);
    updateButton();
    return controls;
  }

  const targetCount = getMiracleTargetCount(miracle.id);
  if (targetCount === 0) return null;

  const controls = document.createElement("div");
  controls.className = "miracle-targets";

  const options = { ...getMiracleTargetOptions(miracle.id), miracleId: miracle.id };
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
    return label;
  };

  const singleRow = addControl(targetCount === 2 ? "対象A" : "対象", targetA);
  if (targetB) addControl("対象B", targetB);

  const refresh = () => updateMiracleActionButton(miracle.id, button, village, costInfo, preview);

  if (MULTI_TARGET_MIRACLE_IDS.has(miracle.id)) {
    const multiList = createMiracleMultiTargetList(targetA, refresh);
    multiList.hidden = true;
    controls.appendChild(multiList);
    controls.appendChild(createMiracleMultiToggleRow(preview, singleRow, multiList, refresh));
  } else {
    controls.appendChild(preview);
  }

  [targetA, targetB].filter(Boolean).forEach(select => {
    select.addEventListener("change", refresh);
  });

  refresh();
  return controls;
}

/** 単数用の select と同じ候補・同じ表記で、チェックボックスの一覧を作る。 */
function createMiracleMultiTargetList(select, onChange) {
  const list = document.createElement("div");
  list.className = "miracle-multi-list";
  list.id = "miracleMultiList";

  [...select.options].filter(option => option.value).forEach(option => {
    const item = document.createElement("label");
    item.className = "miracle-multi-item";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = option.value;
    box.addEventListener("change", onChange);
    const text = document.createElement("span");
    text.textContent = option.textContent;
    item.append(box, text);
    list.appendChild(item);
  });

  return list;
}

/** 「対象を選択してください」の右に置く複数選択の切り替え。 */
function createMiracleMultiToggleRow(preview, singleRow, multiList, onChange) {
  const row = document.createElement("div");
  row.className = "miracle-multi-row";

  const toggleLabel = document.createElement("label");
  toggleLabel.className = "miracle-multi-toggle";
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.id = "miracleMultiToggle";
  const toggleText = document.createElement("span");
  toggleText.textContent = "複数選択";
  toggleLabel.append(toggle, toggleText);

  toggle.addEventListener("change", () => {
    singleRow.hidden = toggle.checked;
    multiList.hidden = !toggle.checked;
    onChange();
  });

  row.append(preview, toggleLabel);
  return row;
}

function setSelectedMiracle(id, village) {
  const select = document.getElementById("miracleSelect");
  if (select) select.value = id;
  renderMiracleCards(village, id);
}

function createMiracleItem(miracle, village, selectedId) {
  const div = document.createElement("div");
  const isActive = miracle.id === selectedId;
  const unlockInfo = getVillageMiracleUnlockInfo(miracle.id, village);
  const isLocked = !unlockInfo.unlocked;
  const costInfo = getMiracleCostInfo(miracle, village);
  const reasonText = getMiracleBlockReason(costInfo, village, miracle.id);
  const targetCount = getMiracleTargetCount(miracle.id);
  const needsTarget = targetCount > 0 || miracle.id === "18";

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
    button.textContent = miracle.id === "18" ? "襲撃テーブル選択" : "対象選択";
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
  const miraclesForModal = getMiraclesForModal(village);
  const fallbackId = miraclesForModal.find(m => getVillageMiracleUnlockInfo(m.id, village).unlocked)?.id || "12";
  const selectedMiracle = MIRACLES.find(m => m.id === selectedId);
  const currentId = selectedMiracle && getVillageMiracleUnlockInfo(selectedMiracle.id, village).unlocked
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

  const detailKind = MIRACLE_TARGET_DETAIL_KINDS[options.miracleId] || "";
  const addOption = (person) => {
    const opp = document.createElement("option");
    opp.value = person.id;
    opp.textContent = formatMiracleOptionLabel(person, detailKind);
    sel.appendChild(opp);
  };

  // 状態で並べ替える奇跡は、村人と捕虜をまとめて一覧にする。
  const conditionSort = MIRACLE_CONDITION_SORTS[options.conditionSort];
  if (conditionSort) {
    const targets = village.villagers
      .concat(getCaptives(village))
      .filter(vv => !isSaltPillar(vv));
    sortByMiracleCondition(targets, conditionSort).forEach(addOption);
    return sel;
  }

  // 村人を追加
  if (!options.raidersOnly) {
    village.villagers
      .filter(vv => options.includeSaltPillar || !isSaltPillar(vv))
      .filter(vv => !options.normalExchangeOnly || isNormalExchangeCandidate(vv, village))
      .forEach(addOption);
  }

  if (!options.raidersOnly && options.normalExchangeOnly) {
    getCaptives(village).forEach(addOption);
  }

  if (options.includeCaptives) {
    getCaptives(village)
      .filter(vv => options.includeSaltPillar || !isSaltPillar(vv))
      .forEach(addOption);
  }

  if (options.normalExchangeOnly || options.villagersOnly) {
    return sel;
  }

  // 訪問者を追加
  if (!options.raidersOnly) {
    getCaptives(village).forEach(addOption);
    village.visitors.forEach(addOption);
  }

  // 襲撃者を追加
  village.raidEnemies
    .filter(vv => (!options.raidersOnly || Number(vv.hp) > 0) && (!options.excludeExchangeImmune || canExchangeBody(vv)))
    .forEach(addOption);

  return sel;
}

function isNormalExchangeCandidate(person, village) {
  return village.villagers.includes(person) || getCaptives(village).includes(person);
}

// まとめて行使したときの、効果と結び文。1人ぶんの処理をそのまま人数分呼ぶ。
const MULTI_TARGET_MIRACLE_HANDLERS = {
  "6": {
    name: "癒しの奇跡",
    apply: (person, village) => healMiracle(person, village, { showModal: false }),
    message: names => `${names}の傷と身体の疲れが癒されました。`
  },
  "16": {
    name: "酒杯の奇跡",
    apply: (person, village) => gobletMiracle(person, village, { showModal: false }),
    message: names => `${names}の心に甘い酔いが満ちました。`
  },
  "11": {
    name: "出立の奇跡",
    apply: (person, village) => departureMiracle(person, village, { showModal: false }),
    message: names => `${names}は村を去りました。`
  }
};

function isMiracleMultiTargetValid(mid, person, village) {
  if (!person || isSaltPillar(person)) return false;
  if (mid === "11") return village.villagers.includes(person);
  return village.villagers.includes(person) || getCaptives(village).includes(person);
}

/** 結び文に出す名前。多いときは頭から並べ、残りは人数で添える。 */
function formatMultiTargetNames(people) {
  const shown = people.slice(0, MIRACLE_RESULT_MAX_SPEAKERS).map(person => person.name).join("、");
  const rest = people.length - Math.min(people.length, MIRACLE_RESULT_MAX_SPEAKERS);
  return rest > 0 ? `${shown}ほか${rest}人` : shown;
}

/** 選ばれた全員へまとめて行使する。1人でも対象外がいれば行使せず魔素を戻す。 */
function applyMultiTargetMiracle(village, mid, people, cost) {
  const handler = MULTI_TARGET_MIRACLE_HANDLERS[mid];
  if (!handler) return false;

  if (people.length === 0 || people.some(person => !isMiracleMultiTargetValid(mid, person, village))) {
    village.log(`【${handler.name}】対象にできない相手が含まれています`);
    refundMiracleMana(village, cost);
    return false;
  }

  people.forEach(person => handler.apply(person, village));
  showMiracleResultModal(
    village,
    handler.name,
    handler.message(formatMultiTargetNames(people)),
    people,
    { noteOmitted: true }
  );
  return true;
}

/**
 * 奇跡実行
 */
export function performMiracle(village) {
  let sel=document.getElementById("miracleSelect");
  let mid=sel.value;
  let info=MIRACLES.find(x=>x.id===mid);
  if (!info) return;
  const unlockReason = getVillageMiracleUnlockInfo(info.id, village).reason;
  if (unlockReason) {
    village.log(`【奇跡】${info.name}は${unlockReason}`);
    return;
  }

  // コスト計算
  let cost = getMiracleCostInfo(info, village).mana;
  // まとめて行使するときは、1人ぶんの費用を人数分そのまま掛ける。
  const multiTargets = getMiracleMultiTargetIds(mid)
    .map(id => findMiracleTargetById(id, village))
    .filter(Boolean);
  if (multiTargets.length > 0) cost *= multiTargets.length;
  const vc = countFeastCostTargets(village);
  if (info.cost===-1) {
    // 宴会
    cost = vc * FEAST_COST_PER_PERSON;
    if (village.mana<cost || village.funds<cost) {
      village.log(`魔素or資金不足(必要:${cost})`);
      return;
    }
  } else if (info.cost===-2) {
    // 狂宴
    cost = vc * REVEL_COST_PER_PERSON;
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
    vA = findMiracleTargetById(ta.value, village);
  }
  if (tb && tb.value) {
    // 村人、捕虜、訪問者、襲撃者から対象を検索
    vB = findMiracleTargetById(tb.value, village);
  }

  if (mid === "8" && !hasHearthMiracleTarget(village)) {
    village.log("【竈女神の奇跡】対象村人なし");
    return;
  }
  if (mid === "18" && village.villageTraits.includes("襲撃中")) {
    village.log("【騒擾の奇跡】襲撃中は使用できません");
    return;
  }
  const selectableRaidTables = mid === "18" ? getSelectableRaidTables() : [];
  const riotRaidTableId = mid === "18"
    ? (document.getElementById("riotRaidTable")?.value || "")
    : "";
  const riotRaidTable = selectableRaidTables.find(table => table.id === riotRaidTableId);
  if (mid === "18" && !riotRaidTable) {
    village.log("【騒擾の奇跡】襲撃テーブルを選択してください");
    return;
  }

  // 実行
  switch(mid) {
    case "4": // 宴会
      spendMiracleMana(village, cost);
      village.funds-=cost;
      let feastRecoveredCount = 0;
      let feastHeavyDrinkerCount = 0;
      let feastNeedRecoveredCount = 0;
      village.villagers.forEach(p=>{
        if (isSaltPillar(p)) return;
        const hpRecovery = getAlcoholMiracleRecoveryAmount(p, 20);
        const mpRecovery = getAlcoholMiracleRecoveryAmount(p, 20);
        const happinessRecovery = getAlcoholMiracleRecoveryAmount(p, 20);
        p.hp=clampValue(p.hp+hpRecovery,0,100);
        p.mp=clampValue(p.mp+mpRecovery,0,100);
        p.happiness=clampValue(p.happiness+happinessRecovery,0,100);
        if (hpRecovery > 20) feastHeavyDrinkerCount++;
        if (clearBanquetBodyTraits(p, village)) feastNeedRecoveredCount++;
        if (clearHopeLossByMiracle(p, village).length > 0) feastRecoveredCount++;
      });
      village.log(`【宴会】全員体力/メンタル+20,幸福+20(費用:${cost})${feastHeavyDrinkerCount > 0 ? `,酒豪${feastHeavyDrinkerCount}人は回復量1.5倍` : ""}${feastNeedRecoveredCount > 0 ? `,飢餓・凍え${feastNeedRecoveredCount}人解除` : ""}${feastRecoveredCount > 0 ? `,失望・絶望${feastRecoveredCount}人解除` : ""}`);
      showMiracleResultModal(village, "宴会の奇跡", "村中に賑やかな宴が開かれました。", getActiveVillagers(village));
      break;

    case "5": // 狂宴
      spendMiracleMana(village, cost);
      village.funds-=cost;
      let revelRecoveredCount = 0;
      let revelHeavyDrinkerCount = 0;
      let revelNeedRecoveredCount = 0;
      village.villagers.forEach(p=>{
        if (isSaltPillar(p)) return;
        // 体力とメンタルは全回復するため、酒豪の倍率は幸福度にだけ効く。
        const happinessRecovery = getAlcoholMiracleRecoveryAmount(p, 50);
        p.hp=100;
        p.mp=100;
        p.happiness=clampValue(p.happiness+happinessRecovery,0,100);
        if (happinessRecovery > 50) revelHeavyDrinkerCount++;
        if (clearBanquetBodyTraits(p, village)) revelNeedRecoveredCount++;
        if (clearHopeLossByMiracle(p, village).length > 0) revelRecoveredCount++;
        // 狂乱特性を付与（まだ持っていない場合のみ）
        if (!p.mindTraits.includes("狂乱")) {
          p.mindTraits.push("狂乱");
          syncEffectiveStats(p);
        }
      });
      village.log(`【狂宴】全員体力/メンタル全回復,幸福+50,狂乱付与(倫理*0.2,好色+15)${revelHeavyDrinkerCount > 0 ? `,酒豪${revelHeavyDrinkerCount}人は幸福度の回復量1.5倍` : ""}${revelNeedRecoveredCount > 0 ? `,飢餓・凍え${revelNeedRecoveredCount}人解除` : ""}${revelRecoveredCount > 0 ? `,失望・絶望${revelRecoveredCount}人解除` : ""}`);
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
          if (isSaltPillar(vA) || isSaltPillar(vB)) {
            village.log("【クピド】塩の柱状態の村人は対象外です");
            refundMiracleMana(village, cost);
            return;
          }
          forceMarriage(vA,vB,village);
          break;
        case "6": // 癒し(1人回復)
          if (multiTargets.length > 0) {
            if (!applyMultiTargetMiracle(village, mid, multiTargets, cost)) return;
            break;
          }
          if (!vA || (!village.villagers.includes(vA) && !getCaptives(village).includes(vA))) {
            village.log("【癒し】対象1人を選択");
            refundMiracleMana(village, cost);
            return;
          }
          if (isSaltPillar(vA)) {
            village.log("【癒しの奇跡】塩の柱は治療できません");
            refundMiracleMana(village, cost);
            return;
          }
          healMiracle(vA,village);
          break;
        case "20": // 清拭
          if (!village.villageTraits.includes("清浄")) {
            village.villageTraits.push("清浄");
          }
          village.cleanlinessMonths = 0;
          village.log("【清拭の奇跡】3ヶ月間、村特性「清浄」を付与");
          {
            const speaker = getCleanlinessMiracleSpeaker(village);
            showMiracleResultModal(
              village,
              "清拭の奇跡",
              "清めの酒の強い匂いが村を満たしました。",
              speaker ? [speaker] : [],
              { allowEmpty: true }
            );
          }
          break;
        case "16": // 酒杯(1人回復)
          if (multiTargets.length > 0) {
            if (!applyMultiTargetMiracle(village, mid, multiTargets, cost)) return;
            break;
          }
          if (!vA || (!village.villagers.includes(vA) && !getCaptives(village).includes(vA))) {
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
          let rm=["夏","秋","冬","冷夏","飛蝗","厳冬"];
          village.villageTraits=village.villageTraits.filter(x=>!rm.includes(x));
          village.apocalypseLocustMonths = null;
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
          if (multiTargets.length > 0) {
            if (!applyMultiTargetMiracle(village, mid, multiTargets, cost)) return;
            break;
          }
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
        case "18": // 騒擾の奇跡
          village.log(`【騒擾の奇跡】「${riotRaidTable.label}」の襲撃テーブルから、村へ騒乱が引き寄せられた`);
          startRaidEvent(village, { raidTableId: riotRaidTable.id });
          break;
        case "19": // 稀人の奇跡
          rareGuestMiracle(village);
          break;
      }
      break;
  }

  checkWishCompletion(village, { miracleId: mid });
  completeTutorialTask(village, "use_miracle");
  updateUI(village);
  closeMiracleModal();
}

/** クピド: 強制結婚 */
function forceMarriage(a,b,v) {
  removeRelationship(a, "恋人", b);
  removeRelationship(b, "恋人", a);
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
function healMiracle(p,v,{ showModal = true } = {}) {
  let recoveredTraits = [];

  HEAL_MIRACLE_BODY_TRAITS.forEach(trait => {
    if (p.bodyTraits.includes(trait)) {
      recoveredTraits.push(trait);
      p.bodyTraits = p.bodyTraits.filter(t => t !== trait);
      if (trait === "産褥") p.postpartumMonths = 0;
    }
  });

  syncEffectiveStats(p);
  if (getCaptives(v).includes(p)) normalizeCaptive(p);
  else refreshJobTable(p, v);

  p.hp=clampValue(p.hp+50,0,100);

  let recoveryMsg = recoveredTraits.length > 0 ?
    `${recoveredTraits.join(",")}を回復,` : "";
  v.log(`【癒しの奇跡】${p.name}${recoveryMsg}体力+50`);
  if (showModal) showMiracleResultModal(v, "癒しの奇跡", `${p.name}の傷と身体の疲れが癒されました。`, [p]);
}

/** 酒杯: 心を満たし、当月だけ酩酊を付与 */
function gobletMiracle(p,v,{ showModal = true } = {}) {
  const recoveredTraits = [];

  GOBLET_MIRACLE_MIND_TRAITS.forEach(trait => {
    if (p.mindTraits.includes(trait)) {
      recoveredTraits.push(trait);
      p.mindTraits = p.mindTraits.filter(t => t !== trait);
    }
  });

  const mentalRecovery = getAlcoholMiracleRecoveryAmount(p, 50);
  const happinessRecovery = getAlcoholMiracleRecoveryAmount(p, 30);
  p.mp=clampValue(p.mp+mentalRecovery,0,100);
  p.happiness=clampValue(p.happiness+happinessRecovery,0,100);
  if (!p.mindTraits.includes("酩酊")) {
    p.mindTraits.push("酩酊");
  }

  syncEffectiveStats(p);
  if (getCaptives(v).includes(p)) normalizeCaptive(p);
  else refreshJobTable(p, v);

  const recoveryMsg = recoveredTraits.length > 0 ?
    `${recoveredTraits.join(",")}を回復,` : "";
  v.log(`【酒杯の奇跡】${p.name}${recoveryMsg}メンタル+${mentalRecovery},幸福+${happinessRecovery},酩酊付与`);
  if (showModal) showMiracleResultModal(v, "酒杯の奇跡", `${p.name}の心に甘い酔いが満ちました。`, [p]);
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
  const damage = Math.floor(THUNDERBOLT_MIRACLE_DAMAGE * getRaiderIncomingDamageMultiplier(target));
  target.hp = beforeHp <= 1 ? beforeHp : Math.max(1, beforeHp - damage);
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
    removeRelationship(a, "恋人", b);
    removeRelationship(b, "恋人", a);
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

// 稀人の奇跡が呼ぶ種族。どれも同じくらいの確率で来るよう、種族を名指しで等確率に選ぶ。
const RARE_GUEST_MIRACLE_TYPES = [
  "翼人",
  "アルセイド",
  "ネレイド",
  "ドライアド",
  "アラクニド",
  "エクイナ",
  "サテュロス",
  "メナド"
];

function rareGuestMiracle(v) {
  // 呼べない種族（同族制限に掛かるもの）は外したうえで等確率に選ぶ。
  const types = RARE_GUEST_MIRACLE_TYPES.filter(type => isRareVisitorTypeAvailable(type, v));
  const type = types[Math.floor(Math.random() * types.length)];
  const existingNames = [
    ...v.villagers.map(person => person.name),
    ...v.visitors.map(person => person.name)
  ];
  const newVisitor = createRandomVisitor(existingNames, type, v);
  v.visitors.push(newVisitor);
  v.log(`【稀人の奇跡】${newVisitor.name}が来訪(訪問者)`);
  const arrivalLine = getVisitorArrivalLine(newVisitor);
  if (arrivalLine) v.log(`${newVisitor.name}「${arrivalLine}」`);
  const message = arrivalLine
    ? `${newVisitor.name}が村を訪れました。<br>「${arrivalLine}」`
    : `${newVisitor.name}が村を訪れました。`;
  showMiracleResultModal(v, "稀人の奇跡", message, [newVisitor]);
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
function departureMiracle(p,v,{ showModal = true } = {}) {
  let bonus = p.happiness;
  v.mana=clampValue(v.mana+bonus,0,99999);
  recordVillagerLeaveHistory(v, p, { source: "出立の奇跡" });
  recordDepartedVillager(v, p, "出立の奇跡");
  v.log(`【出立の奇跡】${p.name}離脱,魔素+${bonus}`);
  let idx=v.villagers.indexOf(p);
  if (idx>=0) {
    clearRelationshipsForDepartedVillager(v, p);
    v.villagers.splice(idx,1);
  }
  if (showModal) showMiracleResultModal(v, "出立の奇跡", `${p.name}は村を去りました。`, [p]);
}



function getGenericMiracleLine(person, miracleName) {
  const dedicatedDialogue = EFFECT_RESULT_DIALOGUES[miracleName];
  if (dedicatedDialogue) {
    return getDialogueLine({ character: person, ...dedicatedDialogue });
  }
  return getDialogueLine({ character: person, scene: "miracle", key: "generic", context: { miracleName } });
}

function getCleanlinessMiracleSpeaker(village) {
  const villagers = getActiveVillagers(village);
  const doctor = villagers.find(person => getVillageRole(person) === VILLAGE_ROLE_DOCTOR);
  if (doctor) return doctor;
  return villagers.reduce((best, person) => {
    if (!best) return person;
    return (Number(person.eth) || 0) > (Number(best.eth) || 0) ? person : best;
  }, null);
}




// 反応を並べる人数の上限。村人全員を対象にする奇跡でも、この人数までを代表として表示する。
const MIRACLE_RESULT_MAX_SPEAKERS = 4;

// 代表を選ぶ際、同じセリフになる相手は後回しにしてセリフの重複を避ける。
function pickMiracleResultSpeakers(targets, miracleName) {
  const picked = [];
  const usedLines = new Set();
  // 上限より多いときだけ、誰が代表になるかを毎回変える。
  const candidates = targets.length > MIRACLE_RESULT_MAX_SPEAKERS ? shuffleArray(targets) : targets;
  candidates.forEach(person => {
    if (picked.length >= MIRACLE_RESULT_MAX_SPEAKERS) return;
    const line = getGenericMiracleLine(person, miracleName);
    if (line && usedLines.has(line)) return;
    if (line) usedLines.add(line);
    picked.push({ person, line });
  });
  return picked;
}

export function showMiracleResultModal(village, miracleName, message, people = [], options = {}) {
  if (typeof document === "undefined") return;
  const targets = (people || []).filter(Boolean);
  if (targets.length === 0 && !options.allowEmpty) return;
  const entries = pickMiracleResultSpeakers(targets, miracleName);
  const overlay = document.createElement("div");
  overlay.className = "effect-result-overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
  const modal = document.createElement("div");
  modal.className = "effect-result-modal";
  modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);box-sizing:border-box;background:#fff;padding:20px;max-width:620px;width:calc(100% - 32px);max-height:min(80vh,720px);overflow:auto;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
  const rows = entries.map(({ person, line }) => `
    <div style="display:grid;grid-template-columns:72px 1fr;gap:12px;margin:12px 0;align-items:center;">
      ${getPortraitSpriteHtml(person, { size: 72, alt: person.name, extraStyle: "border:1px solid #ddd;background-color:#f6f0e6;" })}
      <p><strong>${person.name}</strong>: ${line}</p>
    </div>
  `).join("");
  const omitted = options.noteOmitted ? Math.max(0, targets.length - entries.length) : 0;
  modal.innerHTML = `
    <h2>${miracleName}</h2>
    <p>${message}</p>
    ${rows}
    ${omitted > 0 ? `<p>ほか${omitted}人は省略しました。</p>` : ""}
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
  return getDialogueLine({
    character: person,
    scene: "miracle",
    key: "marriage",
    context: { partnerName: partner.name, miracleName }
  });
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
      ${getPortraitSpriteHtml(a, { size: 72, alt: a.name })}
      <p><strong>${a.name}</strong>: ${getMarriageMiracleLine(a, b, miracleName)}</p>
      ${getPortraitSpriteHtml(b, { size: 72, alt: b.name })}
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
  if (isSaltPillar(person)) return SALT_PILLAR_TRAIT;
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

/**
 * 同じ画面に並ぶ人物へ、まだ使っていないセリフを優先して配る。
 * 候補を使い切った場合は重複を許し、誰かの発言が欠けないようにする。
 */
function pickLineAvoidingUsed(lines, usedLines) {
  const list = Array.isArray(lines) ? lines : [];
  if (!usedLines) return randFrom(list);
  const unused = list.filter(line => !usedLines.has(line));
  const line = randFrom(unused.length > 0 ? unused : list);
  if (line) usedLines.add(line);
  return line;
}

function getBodyExchangeReactionLine(person, usedLines = null) {
  const type = getBodyExchangeLineKey(person);
  const fallbackType = person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ";
  const lines = BODY_EXCHANGE_REACTION_LINES[type] ||
    BODY_EXCHANGE_REACTION_LINES[fallbackType] ||
    BODY_EXCHANGE_REACTION_LINES["普通Ｍ"];
  return pickLineAvoidingUsed(lines, usedLines);
}

function createPanFluteExchangePerson(person, line) {
  const wrapper = document.createElement("div");
  wrapper.className = "pan-flute-person";

  const portraitArea = document.createElement("div");
  portraitArea.className = "pan-flute-portrait";
  const img = document.createElement("div");
  applyPortraitToElement(img, person);
  portraitArea.appendChild(img);

  const dialogue = document.createElement("div");
  dialogue.className = "pan-flute-dialogue";
  const name = document.createElement("strong");
  name.textContent = `${person.name}:`;
  const lineElement = document.createElement("span");
  lineElement.textContent = line;
  dialogue.appendChild(name);
  dialogue.appendChild(lineElement);

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
  // 3組6人が同時に並ぶため、セリフは画面全体で重複を避けて先に決める。
  const usedLines = new Set();
  const lineByPerson = new Map();
  pairs.forEach(pair => {
    (Array.isArray(pair) ? pair : []).forEach(person => {
      if (person) lineByPerson.set(person, getBodyExchangeReactionLine(person, usedLines));
    });
  });
  pairs.forEach(([personA, personB], index) => {
    const item = document.createElement("div");
    item.className = "pan-flute-pair";

    const label = document.createElement("div");
    label.className = "pan-flute-pair-label";
    label.textContent = `${index + 1}組目`;

    const body = document.createElement("div");
    body.className = "pan-flute-pair-body";
    body.appendChild(createPanFluteExchangePerson(personA, lineByPerson.get(personA)));

    const arrow = document.createElement("div");
    arrow.className = "pan-flute-arrow";
    arrow.textContent = "⇄";
    body.appendChild(arrow);

    body.appendChild(createPanFluteExchangePerson(personB, lineByPerson.get(personB)));
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

  portraitA.setAttribute("aria-label", personA.name || "肖像");
  portraitB.setAttribute("aria-label", personB.name || "肖像");
  applyPortraitToElement(portraitA, personA);
  applyPortraitToElement(portraitB, personB);

  // 入れ替わり時のセリフを選ぶ。二人が並ぶため、同じ文にならないようにする。
  const usedLines = new Set();
  const lineA = getBodyExchangeReactionLine(personA, usedLines);
  const lineB = getBodyExchangeReactionLine(personB, usedLines);

  // 会話テキストを設定
  textA.innerHTML = `
    <p><strong>${personA.name}:</strong> ${lineA}</p>
  `;

  textB.innerHTML = `
    <p><strong>${personB.name}:</strong> ${lineB}</p>
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
