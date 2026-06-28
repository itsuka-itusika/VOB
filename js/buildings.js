import { refreshJobTable } from "./domain/jobTables.js";
import { MAX_STOREHOUSES, clampStoredResources, getResourceStorageLimit } from "./domain/resourceLimits.js";
import {
  countActiveBuildings,
  countBuiltBuildings,
  countDamagedBuildings,
  damageBuilding,
  getActiveBuildingIds,
  hasActiveBuilding,
  recalculateBuildingDerivedState,
  repairDamagedBuilding
} from "./domain/buildingState.js";
import { completeTutorialTask } from "./tutorial.js";
import { showVillageScaleMilestones } from "./villageScale.js";
import { fulfillBuildingRequest, getBuildingCostForVillage } from "./buildingRequests.js";

function ensureBuildingFlags(village) {
  if (!village.buildingFlags) village.buildingFlags = {};
  return village.buildingFlags;
}

function refreshVillageJobTables(village) {
  (village.villagers || []).forEach(villager => refreshJobTable(villager, village));
}

function standardBuildingEffect({ scale, flag, log, after }) {
  return (village) => {
    village.building += scale;
    if (flag) ensureBuildingFlags(village)[flag] = true;
    if (after) after(village);
    village.log(log);
  };
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

function canBuildHoldingCell(village) {
  return isScaleAtLeast(village, 70) && hasActiveBuilding(village, "barn");
}

function canBuildMoat(village) {
  return isScaleAtLeast(village, 180) && hasActiveBuilding(village, "woodenFence");
}

function canBuildPrison(village) {
  return isScaleAtLeast(village, 250) && hasActiveBuilding(village, "holdingCell");
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
    desc: "食料と資材の所持上限+600。貯蔵庫建築を解放。規模+20",
    effect: standardBuildingEffect({
      scale: 20,
      flag: "hasBarn",
      after: (village) => {
        ensureBuildingFlags(village).canBuildStorehouse = true;
      },
      log: "納屋建設完了: 食料と資材の所持上限+600、貯蔵庫建築解放、規模+20"
    })
  },
  {
    id: "storehouse",
    name: "貯蔵庫",
    materials: 100,
    funds: 100,
    tech: 50,
    desc: "食料と資材の所持上限+3000。最大3つまで建設可能。規模+30",
    allowMultiple: true,
    maxCount: MAX_STOREHOUSES,
    isUnlocked: canBuildStorehouse,
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
    desc: "娯楽施設。詩人・踊り子の効果1.2倍、毎月の訪問者判定枠が最大2人、女性限定「バニー」解放。規模+20",
    effect: standardBuildingEffect({
      scale: 20,
      flag: "hasTavern",
      after: (village) => { village.visitorLimit = 2; },
      log: "酒場建設完了: 詩人・踊り子の効果1.2倍、毎月の訪問者判定枠が最大2人、女性限定「バニー」解放、規模+20"
    })
  },
  {
    id: "church",
    name: "礼拝堂",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "信仰施設。シスター・神官の効果1.2倍、女性限定「巫女」解放。規模+30",
    effect: standardBuildingEffect({
      scale: 30,
      flag: "hasChurch",
      log: "礼拝堂建設完了: シスター・神官の効果1.2倍、女性限定「巫女」解放、規模+30"
    })
  },
  {
    id: "clinic",
    name: "診療所",
    materials: 50,
    funds: 0,
    tech: 100,
    desc: "医療施設。休養の成功率改善、看護の効果1.2倍、「あんま男」「あんま女」解放。規模+20",
    effect: standardBuildingEffect({ scale: 20, flag: "hasClinic", log: "診療所建設完了: 休養の成功率改善、看護の効果1.2倍、「あんま男」「あんま女」解放、規模+20" })
  },
  {
    id: "library",
    name: "図書館",
    materials: 50,
    funds: 50,
    tech: 100,
    desc: "教育施設。研究の効果1.2倍、「写本」解放。規模+30",
    effect: standardBuildingEffect({ scale: 30, flag: "hasLibrary", log: "図書館建設完了: 研究の効果1.2倍、「写本」解放、規模+30" })
  },
  {
    id: "brewery",
    name: "醸造所",
    materials: 50,
    funds: 100,
    tech: 300,
    desc: "豊かな村で解放。酒造施設。「醸造」解放。規模+40",
    isUnlocked: (village) => isScaleAtLeast(village, 180),
    effect: standardBuildingEffect({ scale: 40, flag: "hasBrewery", log: "醸造所建設完了: 「醸造」解放、規模+40" })
  },
  {
    id: "alchemy",
    name: "錬金工房",
    materials: 50,
    funds: 100,
    tech: 200,
    desc: "豊かな村で解放。錬金施設。「錬金術」解放。規模+40",
    isUnlocked: (village) => isScaleAtLeast(village, 180),
    effect: standardBuildingEffect({ scale: 40, flag: "hasAlchemy", log: "錬金工房建設完了: 「錬金術」解放、規模+40" })
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
    isUnlocked: canBuildHoldingCell,
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
    desc: "旅人の立ち寄る村で解放。襲撃中の「射撃」解放、中衛枠+1。最大3つまで建設可能。規模+10",
    allowMultiple: true,
    maxCount: 3,
    isUnlocked: (village) => isScaleAtLeast(village, 120),
    effect: standardBuildingEffect({ scale: 10, flag: "hasWatchtower", log: "櫓建設完了: 射撃の中衛枠+1、規模+10" })
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
    isUnlocked: canBuildMoat,
    effect: standardBuildingEffect({ scale: 30, flag: "hasMoat", log: "環濠建設完了: 籠城時のダメージ軽減率が0.7になりました、規模+30" })
  },
  {
    id: "prison",
    name: "牢獄",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "繁栄した郷村で解放。営倉建設後に建設可能。捕虜を最大3名まで収容できる。規模+20",
    isUnlocked: canBuildPrison,
    effect: standardBuildingEffect({ scale: 20, flag: "hasPrison", log: "牢獄建設完了: 捕虜を最大3名まで収容可能、規模+20" })
  }
];

function getBuildingCounts(village) {
  return (village.buildings || []).reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
}

function getBuildBlockReason(building, village, { isBuilt = false, reachedLimit = false, costs = null } = {}) {
  if (isBuilt) return "建設済み";
  if (reachedLimit) return "建設上限";
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
  const reachedLimit = Number.isFinite(building.maxCount) && builtCount >= building.maxCount;
  const costs = getBuildingCostForVillage(building, village);
  const repairCosts = getBuildingRepairCosts(building);
  const canRepair = damagedCount > 0 && canAffordRepair(village, repairCosts);
  const canBuild = !isBuilt && !reachedLimit &&
    village.materials >= costs.materials &&
    village.funds >= costs.funds &&
    village.tech >= costs.tech;
  const countText = Number.isFinite(building.maxCount)
    ? `${builtCount}/${building.maxCount}`
    : builtCount;
  const reasonText = getBuildBlockReason(building, village, { isBuilt, reachedLimit, costs });
  const repairReasonText = getRepairBlockReason(village, repairCosts);

  div.innerHTML = `
    <div class="building-header">
      <h4>${building.name}</h4>
      ${costs.isDiscounted ? '<span class="building-request-mark">要望 -20%</span>' : ""}
      ${isBuilt ? '<span class="built-mark">建設済</span>' : ""}
      ${damagedCount > 0 ? `<span class="damaged-mark">損壊中: ${damagedCount}</span>` : ""}
      ${(builtCount > 0 || Number.isFinite(building.maxCount)) ? `<span class="built-count">建設数: ${countText}</span>` : ""}
    </div>
    <div class="building-desc">${building.desc}</div>
    ${builtCount > 0 ? `<div class="building-status">有効数: ${activeCount}${damagedCount > 0 ? ` / 損壊: ${damagedCount}` : ""}</div>` : ""}
    <div class="building-cost">
      ${renderCostLine("資材", costs.originalMaterials, costs.materials, costs.isDiscounted)}
      ${renderCostLine("資金", costs.originalFunds, costs.funds, costs.isDiscounted)}
      ${renderCostLine("技術", costs.originalTech, costs.tech, costs.isDiscounted)}
    </div>
    ${!canBuild && !isBuilt ? `<div class="building-reason">${reasonText}</div>` : ""}
    ${damagedCount > 0 ? `<div class="building-repair-cost">修繕費: ${renderRepairCost(repairCosts)}</div>` : ""}
    ${damagedCount > 0 && !canRepair ? `<div class="building-reason">${repairReasonText}</div>` : ""}
  `;

  const button = document.createElement("button");
  button.className = `building-button${isBuilt ? " built" : ""}`;
  button.textContent = isBuilt ? "建設済" : (reachedLimit ? "上限到達" : (canBuild ? "建設" : "建設不可"));
  button.disabled = isBuilt || reachedLimit || !canBuild;
  if (canBuild) {
    button.onclick = () => {
      if (confirm(`${building.name}を建設しますか？`)) constructBuilding(building, village);
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
    .filter(building => countBuiltBuildings(village, building.id) > 0 || !building.isUnlocked || building.isUnlocked(village))
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
}

export function damageRandomBuilding(village) {
  const candidates = getActiveBuildingIds(village);
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
