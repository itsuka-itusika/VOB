import { refreshJobTable } from "./domain/jobTables.js";
import { MAX_STOREHOUSES, getResourceStorageLimit } from "./domain/resourceLimits.js";
import { showVillageScaleMilestones } from "./villageScale.js";

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

function hasBuilt(village, buildingId) {
  return Array.isArray(village?.buildings) && village.buildings.includes(buildingId);
}

function canBuildStorehouse(village) {
  return !!(
    village?.buildingFlags?.canBuildStorehouse ||
    village?.buildingFlags?.hasBarn ||
    hasBuilt(village, "barn")
  );
}

function canBuildDefensiveWall(village) {
  return !!(
    village?.buildingFlags?.hasMoat ||
    hasBuilt(village, "moat")
  );
}

/** 建築物の定義 */
export const BUILDINGS = [
  {
    id: "house",
    name: "家屋",
    materials: 100,
    funds: 0,
    tech: 0,
    desc: "村の上限人口が2人増える。規模+10",
    effect: (village) => {
      village.popLimit += 2;
      village.building += 10;
      village.log(`家屋建設: 人口上限+2 (現在${village.popLimit}人), 規模+10`);
    },
    allowMultiple: true
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
    desc: "医療施設。看護の効果1.2倍、「あんま」解放。規模+20",
    effect: standardBuildingEffect({ scale: 20, flag: "hasClinic", log: "診療所建設完了: 看護の効果1.2倍、「あんま」解放、規模+20" })
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
    desc: "酒造施設。「醸造」解放。規模+40",
    effect: standardBuildingEffect({ scale: 40, flag: "hasBrewery", log: "醸造所建設完了: 「醸造」解放、規模+40" })
  },
  {
    id: "alchemy",
    name: "錬金工房",
    materials: 50,
    funds: 100,
    tech: 200,
    desc: "錬金施設。「錬金術」解放。規模+40",
    effect: standardBuildingEffect({ scale: 40, flag: "hasAlchemy", log: "錬金工房建設完了: 「錬金術」解放、規模+40" })
  },
  {
    id: "weaving",
    name: "機織小屋",
    materials: 50,
    funds: 50,
    tech: 100,
    desc: "織物施設。「機織り」解放。規模+20",
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
    desc: "公共施設。毎月、村人全員の幸福度+1〜2。規模+10",
    effect: standardBuildingEffect({ scale: 10, flag: "hasFountain", log: "噴水建設完了: 毎月、村人全員の幸福度+1〜2、規模+10" })
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
    desc: "旅人の立ち寄る村で解放。7月に里長選挙を行う。規模+20",
    isUnlocked: (village) => isScaleAtLeast(village, 120),
    effect: standardBuildingEffect({ scale: 20, flag: "hasAssemblyHall", log: "集会所建設完了: 村人たちが集まり、里長を選ぶ場が整いました、規模+20" })
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
    materials: 100,
    funds: 50,
    tech: 50,
    desc: "豊かな村で解放。見張り台を築く。規模+20",
    isUnlocked: (village) => isScaleAtLeast(village, 180),
    effect: standardBuildingEffect({ scale: 20, flag: "hasWatchtower", log: "櫓建設完了: 見張り台を築きました、規模+20" })
  },
  {
    id: "moat",
    name: "環濠",
    materials: 50,
    funds: 50,
    tech: 100,
    desc: "豊かな村で解放。村の周囲に濠を巡らせる。規模+30",
    isUnlocked: (village) => isScaleAtLeast(village, 180),
    effect: standardBuildingEffect({ scale: 30, flag: "hasMoat", log: "環濠建設完了: 村の周囲に濠を巡らせました、規模+30" })
  },
  {
    id: "defensiveWall",
    name: "防壁",
    materials: 100,
    funds: 50,
    tech: 100,
    desc: "環濠建設後に解放。襲撃中の「籠城」解放。規模+30",
    isUnlocked: canBuildDefensiveWall,
    effect: standardBuildingEffect({ scale: 30, flag: "hasDefensiveWall", log: "防壁建設完了: 籠城が可能になりました、規模+30" })
  },
  {
    id: "prison",
    name: "牢獄",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "繁栄した郷村で解放。罪人や捕虜を閉じ込める施設。規模+20",
    isUnlocked: (village) => isScaleAtLeast(village, 250),
    effect: standardBuildingEffect({ scale: 20, flag: "hasPrison", log: "牢獄建設完了: 牢獄を築きました、規模+20" })
  }
];

function getBuildingCounts(village) {
  return (village.buildings || []).reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
}

function getBuildBlockReason(building, village, { isBuilt = false, reachedLimit = false } = {}) {
  if (isBuilt) return "建設済み";
  if (reachedLimit) return "建設上限";
  const reasons = [];
  if (village.materials < building.materials) reasons.push("資材不足");
  if (village.funds < building.funds) reasons.push("資金不足");
  if (village.tech < building.tech) reasons.push("技術不足");
  return reasons.join(", ");
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
    return `<div class="built-item">${building?.name || id}${count > 1 ? ` x${count}` : ""}</div>`;
  }).join("");
}

function createBuildingItem(building, village) {
  const div = document.createElement("div");
  div.className = "building-item";

  const builtCount = (village.buildings || []).filter(id => id === building.id).length;
  const isBuilt = !building.allowMultiple && builtCount > 0;
  const reachedLimit = Number.isFinite(building.maxCount) && builtCount >= building.maxCount;
  const canBuild = !isBuilt && !reachedLimit &&
    village.materials >= building.materials &&
    village.funds >= building.funds &&
    village.tech >= building.tech;
  const countText = Number.isFinite(building.maxCount)
    ? `${builtCount}/${building.maxCount}`
    : builtCount;
  const reasonText = getBuildBlockReason(building, village, { isBuilt, reachedLimit });

  div.innerHTML = `
    <div class="building-header">
      <h4>${building.name}</h4>
      ${isBuilt ? '<span class="built-mark">建設済</span>' : ""}
      ${(builtCount > 0 || Number.isFinite(building.maxCount)) ? `<span class="built-count">建設数: ${countText}</span>` : ""}
    </div>
    <div class="building-desc">${building.desc}</div>
    <div class="building-cost">
      ${building.materials > 0 ? `<div>資材: ${building.materials}</div>` : ""}
      ${building.funds > 0 ? `<div>資金: ${building.funds}</div>` : ""}
      ${building.tech > 0 ? `<div>技術: ${building.tech}</div>` : ""}
    </div>
    ${!canBuild && !isBuilt ? `<div class="building-reason">${reasonText}</div>` : ""}
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
  return div;
}

/** 建築モーダルを開く */
export function openBuildingModal(village) {
  if (village.gameOver) {
    village.log("ゲームオーバー→建築不可");
    return;
  }

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
    .filter(building => !building.isUnlocked || building.isUnlocked(village))
    .forEach(building => grid.appendChild(createBuildingItem(building, village)));
}

/** 建築モーダルを閉じる */
export function closeBuildingModal() {
  document.getElementById("buildingOverlay").style.display = "none";
  document.getElementById("buildingModal").style.display = "none";
}

function constructBuilding(building, village) {
  village.materials -= building.materials;
  village.funds -= building.funds;
  village.tech -= building.tech;
  if (!Array.isArray(village.buildings)) village.buildings = [];
  village.buildings.push(building.id);

  building.effect(village);
  refreshVillageJobTables(village);
  showVillageScaleMilestones(village);

  import("./ui.js").then(module => module.updateUI(village));
  closeBuildingModal();
}
