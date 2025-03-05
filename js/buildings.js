/**
 * 建築物の定義
 */
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
    // 家屋専用: 複数建設可能フラグ
    allowMultiple: true
  },
  {
    id: "tavern",
    name: "酒場",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "娯楽施設。詩人・踊り子の効果1.2倍、訪問者最大2人、女性限定「バニー」解放。規模+20",
    effect: (village) => {
      village.building += 20;
      // 訪問者の最大人数を2人に設定
      village.visitorLimit = 2;
      // 酒場建設フラグを設定
      if (!village.buildingFlags) village.buildingFlags = {};
      village.buildingFlags.hasTavern = true;
      // 村人の仕事テーブルを更新
      village.villagers.forEach(v => refreshJobTable(v));
      village.log("酒場建設完了: 詩人・踊り子の効果1.2倍、訪問者最大2人、女性限定「バニー」解放、規模+20");
    }
  },
  {
    id: "church",
    name: "礼拝堂",
    materials: 50,
    funds: 50,
    tech: 0,
    desc: "信仰施設。シスター・神官の効果1.2倍、女性限定「巫女」解放。規模+30",
    effect: (village) => {
      village.building += 30;
      // 礼拝堂建設フラグを設定
      if (!village.buildingFlags) village.buildingFlags = {};
      village.buildingFlags.hasChurch = true;
      // 村人の仕事テーブルを更新
      village.villagers.forEach(v => refreshJobTable(v));
      village.log("礼拝堂建設完了: シスター・神官の効果1.2倍、女性限定「巫女」解放、規模+30");
    }
  },
  {
    id: "clinic",
    name: "診療所",
    materials: 50,
    funds: 0,
    tech: 100,
    desc: "医療施設。看護の効果1.2倍、「あんま」解放。規模+20",
    effect: (village) => {
      village.building += 20;
      // 診療所建設フラグを設定
      if (!village.buildingFlags) village.buildingFlags = {};
      village.buildingFlags.hasClinic = true;
      // 村人の仕事テーブルを更新
      village.villagers.forEach(v => refreshJobTable(v));
      village.log("診療所建設完了: 看護の効果1.2倍、「あんま」解放、規模+20");
    }
  },
  {
    id: "library",
    name: "図書館",
    materials: 50,
    funds: 50,
    tech: 100,
    desc: "教育施設。研究の効果1.2倍、「写本」解放。規模+30",
    effect: (village) => {
      village.building += 30;
      // 図書館建設フラグを設定
      if (!village.buildingFlags) village.buildingFlags = {};
      village.buildingFlags.hasLibrary = true;
      // 村人の仕事テーブルを更新
      village.villagers.forEach(v => refreshJobTable(v));
      village.log("図書館建設完了: 研究の効果1.2倍、「写本」解放、規模+30");
    }
  },
  {
    id: "brewery",
    name: "醸造所",
    materials: 50,
    funds: 100,
    tech: 300,
    desc: "酒造施設。「醸造」解放。規模+40",
    effect: (village) => {
      village.building += 40;
      // 醸造所建設フラグを設定
      if (!village.buildingFlags) village.buildingFlags = {};
      village.buildingFlags.hasBrewery = true;
      // 村人の仕事テーブルを更新
      village.villagers.forEach(v => refreshJobTable(v));
      village.log("醸造所建設完了: 「醸造」解放、規模+40");
    }
  },
  {
    id: "alchemy",
    name: "錬金工房",
    materials: 50,
    funds: 100,
    tech: 200,
    desc: "錬金施設。「錬金術」解放。規模+40",
    effect: (village) => {
      village.building += 40;
      // 錬金工房建設フラグを設定
      if (!village.buildingFlags) village.buildingFlags = {};
      village.buildingFlags.hasAlchemy = true;
      // 村人の仕事テーブルを更新
      village.villagers.forEach(v => refreshJobTable(v));
      village.log("錬金工房建設完了: 「錬金術」解放、規模+40");
    }
  },
  {
    id: "weaving",
    name: "機織小屋",
    materials: 50,
    funds: 50,
    tech: 100,
    desc: "織物施設。「機織り」解放。規模+20",
    effect: (village) => {
      village.building += 20;
      // 機織小屋建設フラグを設定
      if (!village.buildingFlags) village.buildingFlags = {};
      village.buildingFlags.hasWeaving = true;
      // 村人の仕事テーブルを更新
      village.villagers.forEach(v => refreshJobTable(v));
      village.log("機織小屋建設完了: 「機織り」解放、規模+20");
    }
  },
  {
    id: "watermill",
    name: "水車小屋",
    materials: 50,
    funds: 0,
    tech: 100,
    desc: "水力施設。規模+20",
    effect: (village) => {
      village.building += 20;
      village.log("水車小屋建設完了: 規模+20");
    }
  }
];

/**
 * 建築モーダルを開く
 */
export function openBuildingModal(village) {
  if (village.gameOver) {
    village.log("ゲームオーバー→建築不可");
    return;
  }
  document.getElementById("buildingOverlay").style.display = "block";
  document.getElementById("buildingModal").style.display = "block";

  // 建築物リストを表示
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

  const grid = content.querySelector(".building-grid");
  const builtList = content.querySelector(".built-list");

  // 建設済み建築物を表示
  if (village.buildings.length === 0) {
    builtList.innerHTML = "<p>まだ建設された建築物はありません</p>";
  } else {
    // 建築物をカウントして表示
    const buildingCounts = village.buildings.reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});

    builtList.innerHTML = Object.entries(buildingCounts).map(([id, count]) => {
      const b = BUILDINGS.find(b => b.id === id);
      return `<div class="built-item">${b.name}${count > 1 ? ` x${count}` : ''}</div>`;
    }).join("");
  }

  // 建築物リストを表示
  BUILDINGS.forEach(b => {
    const div = document.createElement("div");
    div.className = "building-item";
    
    // 建設済みかチェック（allowMultipleの場合は常にfalse）
    const isBuilt = !b.allowMultiple && village.buildings.includes(b.id);
    
    // 建設可能かチェック
    const canBuild = !isBuilt && 
                     village.materials >= b.materials && 
                     village.funds >= b.funds && 
                     village.tech >= b.tech;

    // 建設不可の理由を表示
    let reasonText = "";
    if (isBuilt) {
      reasonText = "建設済み";
    } else if (!canBuild) {
      const reasons = [];
      if (village.materials < b.materials) reasons.push("資材不足");
      if (village.funds < b.funds) reasons.push("資金不足");
      if (village.tech < b.tech) reasons.push("技術不足");
      reasonText = reasons.join(", ");
    }

    // 建設済み数を取得（家屋用）
    const builtCount = b.allowMultiple ? 
      village.buildings.filter(id => id === b.id).length : 0;

    div.innerHTML = `
      <div class="building-header">
        <h4>${b.name}</h4>
        ${isBuilt ? '<span class="built-mark">建設済</span>' : ''}
        ${builtCount > 0 ? `<span class="built-count">建設数: ${builtCount}</span>` : ''}
      </div>
      <div class="building-desc">${b.desc}</div>
      <div class="building-cost">
        ${b.materials > 0 ? `<div>資材: ${b.materials}</div>` : ''}
        ${b.funds > 0 ? `<div>資金: ${b.funds}</div>` : ''}
        ${b.tech > 0 ? `<div>技術: ${b.tech}</div>` : ''}
      </div>
      ${!canBuild && !isBuilt ? `<div class="building-reason">${reasonText}</div>` : ''}
    `;

    const btn = document.createElement("button");
    btn.className = "building-button";
    if (isBuilt) {
      btn.textContent = "建設済";
      btn.disabled = true;
      btn.className += " built";
    } else {
      btn.textContent = canBuild ? "建設" : "建設不可";
      btn.disabled = !canBuild;
      if (canBuild) {
        btn.onclick = () => {
          if (confirm(`${b.name}を建設しますか？`)) {
            constructBuilding(b, village);
          }
        };
      }
    }
    div.appendChild(btn);
    grid.appendChild(div);
  });
}

/**
 * 建築モーダルを閉じる
 */
export function closeBuildingModal() {
  document.getElementById("buildingOverlay").style.display = "none";
  document.getElementById("buildingModal").style.display = "none";
}

/**
 * 建築物を建設
 */
function constructBuilding(building, village) {
  // 資源を消費
  village.materials -= building.materials;
  village.funds -= building.funds;
  
  // 建築物リストに追加
  village.buildings.push(building.id);
  
  // 効果を適用
  building.effect(village);
  
  // UIを更新して閉じる
  import("./ui.js").then(m => m.updateUI(village));
  closeBuildingModal();
}

// createVillagers.jsからrefreshJobTableをインポート
import { refreshJobTable } from "./createVillagers.js"; 