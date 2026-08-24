import { refreshJobTable } from "./domain/jobTables.js";
import { MAX_STOREHOUSES, clampStoredResources, getResourceStorageLimit } from "./domain/resourceLimits.js";
import {
  countActiveBuildings,
  countBuiltBuildings,
  countDamagedBuildings,
  damageBuilding,
  getActiveBuildingIds,
  hasActiveBuilding,
  isBuildingDamageable,
  recalculateBuildingDerivedState,
  repairDamagedBuilding
} from "./domain/buildingState.js";
import { completeTutorialTask } from "./tutorial.js";
import { getVillageScaleStage, showVillageScaleMilestones } from "./villageScale.js";
import { fulfillBuildingRequest, getBuildingCostForVillage } from "./buildingRequests.js";
import { getPostBuildWinterMaterialWarning } from "./domain/winterMaterials.js";
import {
  BACCHUS_GOLDEN_STATUE_BUILDING_ID,
  BACCHUS_GOLDEN_STATUE_BUILT_FLAG,
  BACCHUS_GOLDEN_STATUE_UNLOCK_FLAG,
  confirmBacchusGoldenStatueBuild,
  startApocalypseFromGoldenStatue
} from "./bacchusGoldenStatue.js";
import { destroyBacchusGoldenStatue } from "./apocalypse.js";

function ensureBuildingFlags(village) {
  if (!village.buildingFlags) village.buildingFlags = {};
  return village.buildingFlags;
}

function refreshVillageJobTables(village) {
  (village.villagers || []).forEach(villager => refreshJobTable(villager, village));
}

function standardBuildingEffect({ scale, flag, log, after }) {
  const effect = (village) => {
    village.building += scale;
    if (flag) ensureBuildingFlags(village)[flag] = true;
    if (after) after(village);
    village.log(log);
  };
  // デバッグでまとめてフラグを立てられるよう、立てるフラグ名を残す。
  effect.buildingFlag = flag || "";
  return effect;
}

function isScaleAtLeast(village, threshold) {
  return (Number(village?.building) || 0) >= threshold;
}

function canBuildStorehouse(village) {
  if (countBuiltBuildings(village, "barn") > 0) {
    return hasActiveBuilding(village, "barn");
  }
  return !!(
    village?.buildingFlags?.hasBarn ||
    village?.buildingFlags?.canBuildStorehouse
  );
}

/**
 * 規模と前提建築の両方を要求する建築物の解放条件。
 * 一覧への表示は規模だけで決め、前提建築が揃っていない間は建設不可として理由を出す。
 */
function requireScaleAndBuildings(scale, requiredBuildingIds, isBuildingsReady = null) {
  const buildingsReady = isBuildingsReady ||
    ((village) => requiredBuildingIds.every(id => hasActiveBuilding(village, id)));
  return {
    requiredScale: scale,
    requiredBuildingIds,
    isRevealed: (village) => isScaleAtLeast(village, scale),
    isUnlocked: (village) => isScaleAtLeast(village, scale) && buildingsReady(village)
  };
}

/** 建築物の定義 */
export const BUILDINGS = [
  {
    id: "house",
    name: "家屋",
    materials: 100,
    funds: 0,
    tech: 0,
    desc: "村の上限人口が2人増える。最大6つまで建設可能。規模+15",
    effect: (village) => {
      village.building += 15;
      recalculateBuildingDerivedState(village);
      village.log(`家屋建設: 人口上限+2 (現在${village.popLimit}人), 規模+15`);
    },
    allowMultiple: true,
    maxCount: 6
  },
  {
    id: "barn",
    name: "納屋",
    materials: 50,
    funds: 0,
    tech: 0,
    desc: "食料と資材の所持上限+600。規模70以上で貯蔵庫建築を解放。規模+20",
    effect: standardBuildingEffect({
      scale: 20,
      flag: "hasBarn",
      after: (village) => {
        ensureBuildingFlags(village).canBuildStorehouse = true;
      },
      log: "納屋建設完了: 食料と資材の所持上限+600、規模70以上で貯蔵庫建築解放、規模+20"
    })
  },
  {
    id: "storehouse",
    name: "貯蔵庫",
    materials: 100,
    funds: 100,
    tech: 50,
    desc: "辺境の村で解放。納屋建設後に建設可能。食料と資材の所持上限+3000。最大3つまで建設可能。規模+30",
    allowMultiple: true,
    maxCount: MAX_STOREHOUSES,
    // 納屋の判定は古い保存データの建築フラグも見るため、canBuildStorehouse を使う。
    ...requireScaleAndBuildings(70, ["barn"], canBuildStorehouse),
    effect: standardBuildingEffect({
      scale: 30,
      log: "貯蔵庫建設完了: 食料と資材の所持上限+3000、規模+30"
    })
  },
  {
    id: "tavern",
    name: "酒場",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "娯楽施設。毎月の訪問者判定枠が最大2人、女性限定行動「バニー」解放。規模+20",
    effect: standardBuildingEffect({
      scale: 20,
      flag: "hasTavern",
      log: "酒場建設完了: 毎月の訪問者判定枠が最大2人、女性限定行動「バニー」解放、規模+20"
    })
  },
  {
    id: "church",
    name: "礼拝堂",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "信仰施設。役職「司祭」、女性限定行動「巫女」、村人の願望を解放。規模+20",
    effect: standardBuildingEffect({
      scale: 20,
      flag: "hasChurch",
      log: "礼拝堂建設完了: 役職「司祭」、女性限定行動「巫女」、村人の願望を解放、規模+20"
    })
  },
  {
    id: "clinic",
    name: "診療所",
    materials: 50,
    funds: 0,
    tech: 100,
    desc: "医療施設。休養の失敗率-10%、成功率+10%、役職「村医」解放、行動「あんま」解放。規模+20",
    effect: standardBuildingEffect({ scale: 20, flag: "hasClinic", log: "診療所建設完了: 休養の失敗率-10%、成功率+10%、役職「村医」解放、行動「あんま」解放、規模+20" })
  },
  {
    id: "library",
    name: "図書館",
    materials: 50,
    funds: 50,
    tech: 100,
    desc: "教育施設。役職「司書」解放、行動「写本」解放。規模+30",
    effect: standardBuildingEffect({ scale: 30, flag: "hasLibrary", log: "図書館建設完了: 役職「司書」解放、行動「写本」解放、規模+30" })
  },
  {
    id: "brewery",
    name: "醸造所",
    materials: 100,
    funds: 100,
    tech: 200,
    desc: "豊かな村で解放。酒造施設。「醸造」解放。規模+30",
    isUnlocked: (village) => isScaleAtLeast(village, 180),
    effect: standardBuildingEffect({ scale: 30, flag: "hasBrewery", log: "醸造所建設完了: 「醸造」解放、規模+30" })
  },
  {
    id: "alchemy",
    name: "錬金工房",
    materials: 50,
    funds: 100,
    tech: 250,
    desc: "豊かな村で解放。錬金施設。「錬金術」解放。規模+30",
    isUnlocked: (village) => isScaleAtLeast(village, 180),
    effect: standardBuildingEffect({ scale: 30, flag: "hasAlchemy", log: "錬金工房建設完了: 「錬金術」解放、規模+30" })
  },
  {
    id: "weaving",
    name: "機織小屋",
    materials: 50,
    funds: 50,
    tech: 100,
    desc: "豊かな村で解放。織物施設。「機織り」解放。規模+20",
    isUnlocked: (village) => isScaleAtLeast(village, 180),
    effect: standardBuildingEffect({ scale: 20, flag: "hasWeaving", log: "機織小屋建設完了: 「機織り」解放、規模+20" })
  },
  {
    id: "watermill",
    name: "水車小屋",
    materials: 50,
    funds: 0,
    tech: 100,
    desc: "水力施設。毎月食料+10。規模+20",
    effect: standardBuildingEffect({ scale: 20, flag: "hasWatermill", log: "水車小屋建設完了: 毎月食料+10、規模+20" })
  },
  {
    id: "fountain",
    name: "噴水",
    materials: 20,
    funds: 30,
    tech: 0,
    desc: "公共施設。毎月、失望・絶望でない村人全員の幸福度+1〜2。規模+10",
    effect: standardBuildingEffect({ scale: 10, flag: "hasFountain", log: "噴水建設完了: 毎月、失望・絶望でない村人全員の幸福度+1〜2、規模+10" })
  },
  {
    id: "huntingLodge",
    name: "狩猟小屋",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "狩猟の失敗率-10%、成功率+10%。規模+20",
    effect: standardBuildingEffect({ scale: 20, flag: "hasHuntingLodge", log: "狩猟小屋建設完了: 狩猟の失敗率-10%、成功率+10%、規模+20" })
  },
  {
    id: "dock",
    name: "網干場",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "漁の失敗率-10%、成功率+10%。規模+20",
    effect: standardBuildingEffect({ scale: 20, flag: "hasDock", log: "網干場建設完了: 漁の失敗率-10%、成功率+10%、規模+20" })
  },
  {
    id: "market",
    name: "市場",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "行商の失敗率-10%、成功率+10%。規模+20",
    effect: standardBuildingEffect({ scale: 20, flag: "hasMarket", log: "市場建設完了: 行商の失敗率-10%、成功率+10%、規模+20" })
  },
  {
    id: "assemblyHall",
    name: "集会所",
    materials: 50,
    funds: 50,
    tech: 50,
    desc: "辺境の村で解放。7月に里長選挙を行う。規模+20",
    isUnlocked: (village) => isScaleAtLeast(village, 70),
    effect: standardBuildingEffect({ scale: 20, flag: "hasAssemblyHall", log: "集会所建設完了: 村人たちが集まり、里長を選ぶ場が整いました、規模+20" })
  },
  {
    id: "holdingCell",
    name: "営倉",
    materials: 50,
    funds: 20,
    tech: 0,
    desc: "辺境の村で解放。納屋建設後に建設可能。捕虜を最大1名まで収容できる。規模+10",
    ...requireScaleAndBuildings(70, ["barn"]),
    effect: standardBuildingEffect({ scale: 10, flag: "hasHoldingCell", log: "営倉建設完了: 捕虜を最大1名まで収容可能、規模+10" })
  },
  {
    id: "publicBath",
    name: "公衆浴場",
    materials: 80,
    funds: 80,
    tech: 50,
    desc: "秘湯発見で解放。毎月、全員の体力とメンタルが少し回復する。規模+20",
    isUnlocked: (village) => !!(village.buildingFlags && village.buildingFlags.canBuildPublicBath),
    effect: standardBuildingEffect({ scale: 20, flag: "hasPublicBath", log: "公衆浴場建設完了: 毎月の体力・メンタル回復、規模+20" })
  },
  {
    id: "watchtower",
    name: "櫓",
    materials: 50,
    funds: 50,
    tech: 50,
    desc: "旅人の立ち寄る村で解放。襲撃中の「射撃」解放、中衛枠+1。設置上限は村の発展段階で1〜4。規模+10",
    allowMultiple: true,
    maxCount: village => Math.min(4, 1 + Math.max(0, getVillageScaleStage(village.building).index - 3)),
    isUnlocked: (village) => isScaleAtLeast(village, 120),
    effect: standardBuildingEffect({ scale: 10, flag: "hasWatchtower", log: "櫓建設完了: 中衛枠+1、規模+10" })
  },
  {
    id: "woodenFence",
    name: "木柵",
    materials: 100,
    funds: 100,
    tech: 0,
    desc: "旅人の立ち寄る村で解放。襲撃中の「籠城」解放。規模+30",
    isUnlocked: (village) => isScaleAtLeast(village, 120),
    effect: standardBuildingEffect({ scale: 30, flag: "hasWoodenFence", log: "木柵建設完了: 籠城が可能になりました、規模+30" })
  },
  {
    id: "moat",
    name: "環濠",
    materials: 50,
    funds: 50,
    tech: 100,
    desc: "豊かな村で解放。木柵建設後に建設可能。籠城時のダメージ軽減率を0.7にする。規模+30",
    ...requireScaleAndBuildings(180, ["woodenFence"]),
    effect: standardBuildingEffect({ scale: 30, flag: "hasMoat", log: "環濠建設完了: 籠城時のダメージ軽減率が0.7になりました、規模+30" })
  },
  {
    id: "arcaneFoundry",
    name: "魔導工廠",
    materials: 100,
    funds: 200,
    tech: 300,
    desc: "繁栄した郷村で解放。錬金工房と醸造所の建設後に建設可能。襲撃中の中衛行動「火砲」解放。規模+40",
    ...requireScaleAndBuildings(250, ["alchemy", "brewery"]),
    effect: standardBuildingEffect({
      scale: 40,
      flag: "hasArcaneFoundry",
      log: "魔導工廠建設完了: 襲撃中の中衛行動「火砲」解放、規模+40"
    })
  },
  {
    id: "prison",
    name: "牢獄",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "繁栄した郷村で解放。営倉建設後に建設可能。捕虜を最大3名まで収容できる。規模+20",
    ...requireScaleAndBuildings(250, ["holdingCell"]),
    effect: standardBuildingEffect({ scale: 20, flag: "hasPrison", log: "牢獄建設完了: 捕虜を最大3名まで収容可能、規模+20" })
  },
  {
    id: "poorhouse",
    name: "救貧院",
    materials: 50,
    funds: 200,
    tech: 0,
    desc: "繁栄した郷村で解放。毎月、棄民20%・移民80%の専用訪問者判定枠を1つ追加する。規模+30",
    isUnlocked: (village) => isScaleAtLeast(village, 250),
    effect: standardBuildingEffect({ scale: 30, flag: "hasPoorhouse", log: "救貧院建設完了: 棄民20%・移民80%の専用訪問者判定枠+1、規模+30" })
  },
  {
    id: BACCHUS_GOLDEN_STATUE_BUILDING_ID,
    name: "バッカスの黄金像",
    materials: 300,
    funds: 1500,
    tech: 300,
    desc: "黄金像建立イベントで解放。交換の奇跡と交換の奇跡・強の消費魔素を半分にする。建設すると次月から七つの災厄が始まる。建設後は破壊可能。",
    isUnlocked: (village) => !!village?.buildingFlags?.[BACCHUS_GOLDEN_STATUE_UNLOCK_FLAG],
    confirmWith: confirmBacchusGoldenStatueBuild,
    effect: (village) => {
      ensureBuildingFlags(village)[BACCHUS_GOLDEN_STATUE_BUILT_FLAG] = true;
      village.log("バッカスの黄金像建設完了: 交換の奇跡と交換の奇跡・強の消費魔素が半分になりました");
    },
    onConstructed: startApocalypseFromGoldenStatue
  }
];

// イベントでしか立たない建築の解放フラグ。黄金像は建立イベントの解放フラグを持つ。
const BUILDING_UNLOCK_FLAGS = ["canBuildPublicBath", "canBuildStorehouse", BACCHUS_GOLDEN_STATUE_UNLOCK_FLAG];

/**
 * デバッグ用。建築の解放フラグを立て、黄金像を除くすべての建築を上限数まで建てた状態にする。
 * 効果はフラグと派生値の再計算で賄うため、各建築の effect は呼ばない。
 * 黄金像は、実際に建てて黙示録を始める導線を残すため建てない。
 * 上限数は規模で決まる建築があるため、規模を上げたあとに呼ぶこと。
 * @returns {number} 新たに建てた棟数
 */
export function unlockAllBuildings(village) {
  const flags = ensureBuildingFlags(village);
  BUILDINGS.forEach(building => {
    const flag = building.effect?.buildingFlag;
    if (flag) flags[flag] = true;
  });
  BUILDING_UNLOCK_FLAGS.forEach(flag => { flags[flag] = true; });

  if (!Array.isArray(village.buildings)) village.buildings = [];
  let builtCount = 0;
  BUILDINGS.forEach(building => {
    if (building.id === BACCHUS_GOLDEN_STATUE_BUILDING_ID) return;
    const limit = building.allowMultiple ? getBuildingMaxCount(building, village) : 1;
    const target = Number.isFinite(limit) ? limit : 1;
    const shortfall = target - countBuiltBuildings(village, building.id);
    for (let i = 0; i < shortfall; i++) {
      village.buildings.push(building.id);
      builtCount++;
    }
  });

  recalculateBuildingDerivedState(village);
  refreshVillageJobTables(village);
  return builtCount;
}

function getBuildingNameById(buildingId) {
  return BUILDINGS.find(building => building.id === buildingId)?.name || buildingId;
}

function isBuildingUnlocked(building, village) {
  return typeof building.isUnlocked !== "function" || building.isUnlocked(village);
}

/** 建築モーダルへ表示するか。前提建築が未達でも、規模を満たしていれば表示する。 */
function isBuildingListed(building, village) {
  if (countBuiltBuildings(village, building.id) > 0) return true;
  if (typeof building.isRevealed === "function") return building.isRevealed(village);
  return isBuildingUnlocked(building, village);
}

function getUnlockBlockReason(building, village) {
  if (isBuildingUnlocked(building, village)) return "";
  const requiredScale = Number(building.requiredScale) || 0;
  if (requiredScale > 0 && !isScaleAtLeast(village, requiredScale)) {
    return `規模${requiredScale}以上が必要`;
  }
  const missing = (building.requiredBuildingIds || [])
    .filter(id => !hasActiveBuilding(village, id))
    .map(id => `「${getBuildingNameById(id)}」`);
  return missing.length > 0 ? `${missing.join("")}が必要` : "解放条件未達";
}

function getBuildingCounts(village) {
  return (village.buildings || []).reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
}

export function getBuildingMaxCount(building, village) {
  const value = typeof building?.maxCount === "function"
    ? building.maxCount(village)
    : building?.maxCount;
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : Number.POSITIVE_INFINITY;
}

function getBuildBlockReason(building, village, { isBuilt = false, reachedLimit = false, costs = null } = {}) {
  if (isBuilt) return "建設済み";
  if (reachedLimit) return "建設上限";
  const unlockReason = getUnlockBlockReason(building, village);
  if (unlockReason) return unlockReason;
  const buildCosts = costs || getBuildingCostForVillage(building, village);
  const reasons = [];
  if (village.materials < buildCosts.materials) reasons.push("資材不足");
  if (village.funds < buildCosts.funds) reasons.push("資金不足");
  if (village.tech < buildCosts.tech) reasons.push("技術不足");
  return reasons.join(", ");
}

function renderCostLine(label, originalCost, currentCost, isDiscounted) {
  if (originalCost <= 0) return "";
  if (!isDiscounted || originalCost === currentCost) return `<div>${label}: ${originalCost}</div>`;
  return `<div>${label}: <span class="building-cost-original">${originalCost}</span><span class="building-cost-arrow">→</span><strong class="building-cost-discounted">${currentCost}</strong></div>`;
}

function getBuildingRepairCosts(building) {
  return {
    materials: Math.ceil((Number(building.materials) || 0) / 2),
    funds: Math.ceil((Number(building.funds) || 0) / 2),
    tech: Math.ceil((Number(building.tech) || 0) / 2)
  };
}

function canAffordRepair(village, costs) {
  return village.materials >= costs.materials &&
    village.funds >= costs.funds &&
    village.tech >= costs.tech;
}

function getRepairBlockReason(village, costs) {
  const reasons = [];
  if (village.materials < costs.materials) reasons.push("資材不足");
  if (village.funds < costs.funds) reasons.push("資金不足");
  if (village.tech < costs.tech) reasons.push("技術不足");
  return reasons.join(", ");
}

function renderRepairCost(costs) {
  return [
    costs.materials > 0 ? `資材:${costs.materials}` : "",
    costs.funds > 0 ? `資金:${costs.funds}` : "",
    costs.tech > 0 ? `技術:${costs.tech}` : ""
  ].filter(Boolean).join(" / ") || "費用なし";
}

function formatPostBuildWinterWarning(warning) {
  if (!warning) return "";
  return `建設後の資材は${warning.remainingMaterials}となり、${warning.periodLabel}${warning.requiredMaterials}に対して${warning.shortfall}不足します。`;
}

function renderBuiltBuildings(builtList, village) {
  const buildings = village.buildings || [];
  if (buildings.length === 0) {
    builtList.innerHTML = "<p>まだ建設された建築物はありません</p>";
    return;
  }

  const buildingCounts = getBuildingCounts(village);
  builtList.innerHTML = Object.entries(buildingCounts).map(([id, count]) => {
    const building = BUILDINGS.find(item => item.id === id);
    const damagedCount = countDamagedBuildings(village, id);
    const damageText = damagedCount > 0 ? ` / 損壊${damagedCount}` : "";
    const className = damagedCount > 0 ? "built-item damaged" : "built-item";
    return `<div class="${className}">${building?.name || id}${count > 1 ? ` x${count}` : ""}${damageText}</div>`;
  }).join("");
}

function createBuildingItem(building, village) {
  const div = document.createElement("div");
  div.className = "building-item";

  const builtCount = countBuiltBuildings(village, building.id);
  const activeCount = countActiveBuildings(village, building.id);
  const damagedCount = countDamagedBuildings(village, building.id);
  const isBuilt = !building.allowMultiple && builtCount > 0;
  const maxCount = getBuildingMaxCount(building, village);
  const reachedLimit = Number.isFinite(maxCount) && builtCount >= maxCount;
  const costs = getBuildingCostForVillage(building, village);
  const repairCosts = getBuildingRepairCosts(building);
  const canRepair = damagedCount > 0 && canAffordRepair(village, repairCosts);
  const canBuild = !isBuilt && !reachedLimit && isBuildingUnlocked(building, village) &&
    village.materials >= costs.materials &&
    village.funds >= costs.funds &&
    village.tech >= costs.tech;
  const countText = Number.isFinite(maxCount)
    ? `${builtCount}/${maxCount}`
    : builtCount;
  const reasonText = getBuildBlockReason(building, village, { isBuilt, reachedLimit, costs });
  const repairReasonText = getRepairBlockReason(village, repairCosts);
  const winterWarning = canBuild ? getPostBuildWinterMaterialWarning(village, costs.materials) : null;

  div.innerHTML = `
    <div class="building-header">
      <h4>${building.name}</h4>
      ${costs.isDiscounted ? '<span class="building-request-mark">要望 -20%</span>' : ""}
      ${isBuilt ? '<span class="built-mark">建設済</span>' : ""}
      ${damagedCount > 0 ? `<span class="damaged-mark">損壊中: ${damagedCount}</span>` : ""}
      ${(builtCount > 0 || Number.isFinite(maxCount)) ? `<span class="built-count">建設数: ${countText}</span>` : ""}
    </div>
    <div class="building-desc">${building.desc}</div>
    ${builtCount > 0 ? `<div class="building-status">有効数: ${activeCount}${damagedCount > 0 ? ` / 損壊: ${damagedCount}` : ""}</div>` : ""}
    <div class="building-cost">
      ${renderCostLine("資材", costs.originalMaterials, costs.materials, costs.isDiscounted)}
      ${renderCostLine("資金", costs.originalFunds, costs.funds, costs.isDiscounted)}
      ${renderCostLine("技術", costs.originalTech, costs.tech, costs.isDiscounted)}
    </div>
    ${!canBuild && !isBuilt ? `<div class="building-reason">${reasonText}</div>` : ""}
    ${winterWarning ? `<div class="building-winter-warning">冬越し資材警告: ${formatPostBuildWinterWarning(winterWarning)}</div>` : ""}
    ${damagedCount > 0 ? `<div class="building-repair-cost">修繕費: ${renderRepairCost(repairCosts)}</div>` : ""}
    ${damagedCount > 0 && !canRepair ? `<div class="building-reason">${repairReasonText}</div>` : ""}
  `;

  const button = document.createElement("button");
  button.className = `building-button${isBuilt ? " built" : ""}`;
  button.textContent = isBuilt ? "建設済" : (reachedLimit ? "上限到達" : (canBuild ? "建設" : "建設不可"));
  button.disabled = isBuilt || reachedLimit || !canBuild;
  if (canBuild) {
    button.onclick = () => {
      const currentWarning = getPostBuildWinterMaterialWarning(village, getBuildingCostForVillage(building, village).materials);
      const warningText = currentWarning ? formatPostBuildWinterWarning(currentWarning) : "";
      if (typeof building.confirmWith === "function") {
        building.confirmWith({ warningText, onConfirm: () => constructBuilding(building, village) });
        return;
      }
      const confirmMessage = warningText
        ? `${building.name}を建設しますか？\n\n【冬越し資材警告】\n${warningText}\nそれでも建設しますか？`
        : `${building.name}を建設しますか？`;
      if (confirm(confirmMessage)) constructBuilding(building, village);
    };
  }
  div.appendChild(button);

  if (damagedCount > 0) {
    const repairButton = document.createElement("button");
    repairButton.className = "building-button repair";
    repairButton.textContent = canRepair ? "修繕" : "修繕不可";
    repairButton.disabled = !canRepair;
    if (canRepair) {
      repairButton.onclick = () => {
        if (confirm(`${building.name}を修繕しますか？`)) repairBuilding(building, village);
      };
    }
    div.appendChild(repairButton);
  }
  if (building.id === BACCHUS_GOLDEN_STATUE_BUILDING_ID && builtCount > 0) {
    const destroyButton = document.createElement("button");
    destroyButton.className = "building-button destroy";
    destroyButton.textContent = "黄金像を破壊";
    destroyButton.onclick = () => {
      const message = "バッカスの黄金像を破壊しますか？\n黙示録は中断され、交換の奇跡の消費魔素半減効果も失われます。\nこの後もう一度建築できます。";
      if (!confirm(message)) return;
      if (destroyBacchusGoldenStatue(village)) openBuildingModal(village);
    };
    div.appendChild(destroyButton);
  }
  return div;
}

/** 建築モーダルを開く */
export function openBuildingModal(village) {
  if (village.gameOver) {
    village.log("ゲームオーバー→建築不可");
    return;
  }
  recalculateBuildingDerivedState(village);

  document.getElementById("buildingOverlay").style.display = "block";
  document.getElementById("buildingModal").style.display = "block";

  const content = document.getElementById("buildingContent");
  content.innerHTML = `
    <div class="building-resources">
      <div>資材: ${village.materials}</div>
      <div>資金: ${village.funds}</div>
      <div>技術: ${village.tech}</div>
      <div>保管上限: ${getResourceStorageLimit(village)}</div>
    </div>
    <div class="building-list">
      <h3>建設可能な建築物</h3>
      <div class="building-grid"></div>
    </div>
    <div class="building-info">
      <h3>建設済み建築物</h3>
      <div class="built-list"></div>
    </div>
  `;

  renderBuiltBuildings(content.querySelector(".built-list"), village);
  const grid = content.querySelector(".building-grid");
  BUILDINGS
    .filter(building => isBuildingListed(building, village))
    .forEach(building => grid.appendChild(createBuildingItem(building, village)));
}

/** 建築モーダルを閉じる */
export function closeBuildingModal() {
  document.getElementById("buildingOverlay").style.display = "none";
  document.getElementById("buildingModal").style.display = "none";
}

function refreshAfterBuildingStateChange(village) {
  recalculateBuildingDerivedState(village);
  clampStoredResources(village);
  refreshVillageJobTables(village);
}

function repairBuilding(building, village) {
  const costs = getBuildingRepairCosts(building);
  if (!canAffordRepair(village, costs)) return;
  if (!repairDamagedBuilding(village, building.id)) return;

  village.materials -= costs.materials;
  village.funds -= costs.funds;
  village.tech -= costs.tech;

  refreshAfterBuildingStateChange(village);
  village.log(`${building.name}を修繕しました。建築効果が復旧しました`);
  import("./ui.js").then(module => module.updateUI(village));
  openBuildingModal(village);
}

function constructBuilding(building, village) {
  if (countBuiltBuildings(village, building.id) >= getBuildingMaxCount(building, village)) return;
  const costs = getBuildingCostForVillage(building, village);
  village.materials -= costs.materials;
  village.funds -= costs.funds;
  village.tech -= costs.tech;
  if (!Array.isArray(village.buildings)) village.buildings = [];
  village.buildings.push(building.id);

  building.effect(village);
  fulfillBuildingRequest(village, building.id);
  if (building.id === "barn") {
    completeTutorialTask(village, "build_barn");
  }
  recalculateBuildingDerivedState(village);
  refreshVillageJobTables(village);
  showVillageScaleMilestones(village);

  import("./ui.js").then(module => module.updateUI(village));
  closeBuildingModal();
  if (typeof building.onConstructed === "function") {
    building.onConstructed(village);
  }
}

export function damageRandomBuilding(village) {
  const candidates = getActiveBuildingIds(village).filter(isBuildingDamageable);
  if (candidates.length === 0) {
    village.log("損壊する建築物はありませんでした");
    return null;
  }

  const buildingId = candidates[Math.floor(Math.random() * candidates.length)];
  if (!damageBuilding(village, buildingId)) return null;

  refreshAfterBuildingStateChange(village);
  const building = BUILDINGS.find(item => item.id === buildingId);
  const name = building?.name || buildingId;
  village.log(`建築損壊:${name}の効果が失われました。建築画面から修繕できます`);
  return buildingId;
}
