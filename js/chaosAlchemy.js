// chaosAlchemy.js
// 混沌錬金窯の「錬金」。技術を消費して秘宝を錬成する。
// 窯は黙示録クリアで建てられるようになり、建てるとメニューに「錬金」ボタンが出る。

import {
  CHAOS_ALCHEMY_KILN_BUILDING_ID,
  CHAOS_ALCHEMY_KILN_FLAG,
  CHAOS_ALCHEMY_RECIPES
} from "./data/chaosAlchemyData.js";
import { hasActiveBuildingFlag } from "./domain/buildingState.js";
import { SECRET_TREASURES, grantSecretTreasure, isAlchemyOnlySecretTreasure } from "./secretTreasures.js";
import { updateUI } from "./ui.js";

let lastCraftMessage = "";

export function isChaosAlchemyAvailable(village) {
  return hasActiveBuildingFlag(village, CHAOS_ALCHEMY_KILN_FLAG, CHAOS_ALCHEMY_KILN_BUILDING_ID);
}

function getOwnedCount(village, treasureId) {
  const owned = Array.isArray(village?.secretTreasures) ? village.secretTreasures : [];
  return owned.filter(entry => (typeof entry === "string" ? entry : entry?.id) === treasureId).length;
}

function createRecipeCard(village, definition, techCost) {
  const tech = Number(village.tech) || 0;
  const affordable = tech >= techCost;
  const owned = getOwnedCount(village, definition.id);
  const card = document.createElement("div");
  card.className = "secret-treasure-item";
  card.innerHTML = `
    <div class="secret-treasure-item-header">
      <h4>${definition.name}</h4>
      ${isAlchemyOnlySecretTreasure(definition.id) ? `<span class="secret-treasure-count">錬金窯限定</span>` : ""}
    </div>
    <div class="secret-treasure-desc">${definition.desc}</div>
    <div class="secret-treasure-price">消費: 技術${techCost}${owned > 0 ? `　／　所持数: ${owned}` : ""}</div>
    ${affordable ? "" : `<div class="secret-treasure-reason">錬成不可: 技術が${techCost - tech}足りません</div>`}
  `;
  const actions = document.createElement("div");
  actions.className = "secret-treasure-actions";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "錬成する";
  button.disabled = !affordable;
  button.onclick = () => craftSecretTreasure(village, definition, techCost);
  actions.appendChild(button);
  card.appendChild(actions);
  return card;
}

function renderAlchemyModal(village) {
  const content = document.getElementById("alchemyContent");
  if (!content) return;
  content.innerHTML = `
    <p class="alchemy-lead">混沌の炎で技術を練り上げ、秘宝を錬成する。現在の技術: <strong>${Math.floor(Number(village.tech) || 0)}</strong></p>
    ${lastCraftMessage ? `<p class="alchemy-result">${lastCraftMessage}</p>` : ""}
  `;
  CHAOS_ALCHEMY_RECIPES.forEach(({ techCost, treasureIds }) => {
    const heading = document.createElement("h3");
    heading.className = "alchemy-tier-heading";
    heading.textContent = `技術${techCost}`;
    content.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "secret-treasure-grid";
    treasureIds.forEach(id => {
      const definition = SECRET_TREASURES.find(treasure => treasure.id === id);
      if (definition) grid.appendChild(createRecipeCard(village, definition, techCost));
    });
    content.appendChild(grid);
  });
}

function craftSecretTreasure(village, definition, techCost) {
  if ((Number(village.tech) || 0) < techCost) return;
  if (!window.confirm(`技術${techCost}を消費して、${definition.name}を錬成しますか？`)) return;
  village.tech = (Number(village.tech) || 0) - techCost;
  grantSecretTreasure(village, definition.id);
  village.log(`【錬金】技術-${techCost}、秘宝「${definition.name}」を錬成しました`);
  lastCraftMessage = `${definition.name}を錬成しました。`;
  renderAlchemyModal(village);
  updateUI(village);
}

export function openAlchemyModal(village) {
  if (village.gameOver) {
    village.log("ゲームオーバー→錬金不可");
    return;
  }
  if (!isChaosAlchemyAvailable(village)) {
    village.log("【錬金】混沌錬金窯がないため錬金できません");
    return;
  }
  const overlay = document.getElementById("alchemyOverlay");
  const modal = document.getElementById("alchemyModal");
  if (!overlay || !modal) return;
  lastCraftMessage = "";
  renderAlchemyModal(village);
  overlay.style.display = "block";
  modal.style.display = "block";
}

export function closeAlchemyModal() {
  const overlay = document.getElementById("alchemyOverlay");
  const modal = document.getElementById("alchemyModal");
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
}
