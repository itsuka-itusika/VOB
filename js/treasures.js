import { clampValue } from "./util.js";
import { updateUI } from "./ui.js";

export const TREASURES = [
  {
    id: "grain_charm",
    name: "豊穣の種",
    desc: "使うと食料+100。",
    use: (village) => {
      village.food = clampValue(village.food + 100, 0, 99999);
      village.log("【宝物】豊穣の種を使いました。食料+100");
    }
  },
  {
    id: "timber_charm",
    name: "古い建材",
    desc: "使うと資材+100。",
    use: (village) => {
      village.materials = clampValue(village.materials + 100, 0, 99999);
      village.log("【宝物】古い建材を使いました。資材+100");
    }
  },
  {
    id: "merchant_coin",
    name: "旅商の金貨",
    desc: "使うと資金+100。",
    use: (village) => {
      village.funds = clampValue(village.funds + 100, 0, 99999);
      village.log("【宝物】旅商の金貨を使いました。資金+100");
    }
  },
  {
    id: "mana_crystal",
    name: "魔素結晶",
    desc: "使うと魔素+80。",
    use: (village) => {
      village.mana = clampValue(village.mana + 80, 0, 99999);
      village.log("【宝物】魔素結晶を使いました。魔素+80");
    }
  },
  {
    id: "healing_balm",
    name: "癒しの香油",
    desc: "使うと村人全員の体力・メンタル+30。",
    use: (village) => {
      (village.villagers || []).forEach(person => {
        person.hp = clampValue(person.hp + 30, 0, 100);
        person.mp = clampValue(person.mp + 30, 0, 100);
      });
      village.log("【宝物】癒しの香油を使いました。村人全員の体力・メンタル+30");
    }
  }
];

function getTreasureDefinition(entry) {
  const id = typeof entry === "string" ? entry : entry?.id;
  const name = typeof entry === "string" ? entry : entry?.name;
  return TREASURES.find(treasure => treasure.id === id || treasure.name === id || treasure.name === name) || null;
}

function getTreasureLabel(entry) {
  const definition = getTreasureDefinition(entry);
  if (definition) return definition.name;
  if (typeof entry === "string") return entry;
  return entry?.name || entry?.id || "不明な宝物";
}

function renderTreasureModal(village) {
  const content = document.getElementById("treasureContent");
  if (!content) return;

  const treasures = Array.isArray(village.treasures) ? village.treasures : [];
  if (treasures.length === 0) {
    content.innerHTML = "<p>所持している宝物はありません。</p>";
    return;
  }

  content.innerHTML = `
    <label class="treasure-select-label">
      <span>宝物を選択:</span>
      <select id="treasureSelect"></select>
    </label>
    <div id="treasureDescription" class="treasure-description"></div>
  `;

  const select = content.querySelector("#treasureSelect");
  treasures.forEach((entry, index) => {
    const definition = getTreasureDefinition(entry);
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = definition ? definition.name : `${getTreasureLabel(entry)}（利用不可）`;
    option.disabled = !definition;
    select.appendChild(option);
  });

  const updateDescription = () => {
    const definition = getTreasureDefinition(treasures[Number(select.value)]);
    const description = content.querySelector("#treasureDescription");
    if (description) {
      description.textContent = definition
        ? definition.desc
        : "この宝物はまだ利用効果が定義されていません。";
    }
  };
  select.addEventListener("change", updateDescription);
  updateDescription();
}

export function openTreasureModal(village) {
  if (village.gameOver) {
    village.log("ゲームオーバー→宝物利用不可");
    return;
  }
  if (!Array.isArray(village.treasures)) village.treasures = [];

  const overlay = document.getElementById("treasureOverlay");
  const modal = document.getElementById("treasureModal");
  if (!overlay || !modal) return;

  renderTreasureModal(village);
  overlay.style.display = "block";
  modal.style.display = "block";
}

export function closeTreasureModal() {
  const overlay = document.getElementById("treasureOverlay");
  const modal = document.getElementById("treasureModal");
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
}

export function useSelectedTreasure(village) {
  const select = document.getElementById("treasureSelect");
  if (!select) return;
  const treasures = Array.isArray(village.treasures) ? village.treasures : [];
  const index = Number(select.value);
  const definition = getTreasureDefinition(treasures[index]);
  if (!definition) {
    village.log("【宝物】利用できる宝物が選択されていません");
    return;
  }

  if (!window.confirm(`${definition.name}を使いますか？`)) return;
  definition.use(village);
  treasures.splice(index, 1);
  village.treasures = treasures;
  renderTreasureModal(village);
  updateUI(village);
}
