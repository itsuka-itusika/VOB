import { refreshJobTable } from "./domain/jobTables.js";
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
    desc: "水力施設。規模+20",
    effect: standardBuildingEffect({ scale: 20, log: "水車小屋建設完了: 規模+20" })
  },
  {
    id: "publicBath",
    name: "公衆浴場",
    materials: 80,
    funds: 80,
    tech: 50,
    desc: "秘湯発見で解放。休養と余暇の回復量が上がる。規模+20",
    isUnlocked: (village) => !!(village.buildingFlags && village.buildingFlags.canBuildPublicBath),
    effect: standardBuildingEffect({ scale: 20, flag: "hasPublicBath", log: "公衆浴場建設完了: 休養と余暇の回復量上昇、規模+20" })
  }
];

function getBuildingCounts(village) {
  return (village.buildings || []).reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});
}

function getBuildBlockReason(building, village, isBuilt) {
  if (isBuilt) return "建設済み";
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

  const isBuilt = !building.allowMultiple && (village.buildings || []).includes(building.id);
  const canBuild = !isBuilt &&
    village.materials >= building.materials &&
    village.funds >= building.funds &&
    village.tech >= building.tech;
  const builtCount = building.allowMultiple
    ? (village.buildings || []).filter(id => id === building.id).length
    : 0;
  const reasonText = getBuildBlockReason(building, village, isBuilt);

  div.innerHTML = `
    <div class="building-header">
      <h4>${building.name}</h4>
      ${isBuilt ? '<span class="built-mark">建設済</span>' : ""}
      ${builtCount > 0 ? `<span class="built-count">建設数: ${builtCount}</span>` : ""}
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
  button.textContent = isBuilt ? "建設済" : (canBuild ? "建設" : "建設不可");
  button.disabled = isBuilt || !canBuild;
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
  if (!Array.isArray(village.buildings)) village.buildings = [];
  village.buildings.push(building.id);

  building.effect(village);
  refreshVillageJobTables(village);
  showVillageScaleMilestones(village);

  import("./ui.js").then(module => module.updateUI(village));
  closeBuildingModal();
}
