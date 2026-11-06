// personStatusDetail.js
// 村の外の人物（ラケシスの帳簿の記録、過去帳の故人）の詳細ステータスを見る小さな画面。
// 神籤や死者の書の選択画面から開き、閉じると元の選択画面に戻る。

import { getPortraitSpriteHtml } from "./data/portraitAtlas.js";

const OVERLAY_ID = "personStatusDetailOverlay";
const MODAL_ID = "personStatusDetailModal";

const BODY_STATS = [["str", "筋力"], ["vit", "耐久"], ["dex", "器用"], ["mag", "魔力"], ["chr", "魅力"]];
const MIND_STATS = [["int", "知力"], ["ind", "勤勉"], ["eth", "倫理"], ["cou", "勇気"], ["sexdr", "好色"]];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function renderStatRow(person, stats) {
  return `
    <tr>${stats.map(([, label]) => `<th>${label}</th>`).join("")}</tr>
    <tr>${stats.map(([stat]) => `<td>${Math.floor(Number(person?.[stat]) || 0)}</td>`).join("")}</tr>
  `;
}

function renderTraitList(traits) {
  const list = Array.isArray(traits) ? traits.filter(Boolean) : [];
  return list.length > 0 ? list.map(escapeHtml).join("、") : "なし";
}

export function closePersonStatusDetailModal() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
}

/**
 * 人物の詳細ステータスを開く。person は村人と同じ形の記録（保存形式でよい）。
 * @param {object} person
 * @param {{ name?: string }} options name は表示名（帳簿の素の名など）
 */
export function openPersonStatusDetailModal(person, { name = "" } = {}) {
  if (typeof document === "undefined" || !person) return;
  closePersonStatusDetailModal();
  const displayName = name || person.name || "不明";
  const profile = [
    ["種族", person.race || "人間"],
    ["肉体", `${person.bodySex || "-"} / ${person.bodyAge ?? "-"}歳`],
    ["精神", `${person.spiritSex || "-"} / ${person.spiritAge ?? "-"}歳`],
    ["口調", person.speechType || "-"],
    ["趣味", person.hobby || "なし"]
  ];

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "status-detail-overlay";
  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "friendship-detail-modal status-detail-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="modal-header">詳細ステータス</div>
    <div class="status-detail-body">
      <div class="status-detail-head">
        ${getPortraitSpriteHtml(person, { size: 96, alt: displayName })}
        <div>
          <h3>${escapeHtml(displayName)}</h3>
          <dl class="status-detail-profile">
            ${profile.map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`).join("")}
          </dl>
        </div>
      </div>
      <table class="status-detail-stats">
        <caption>身体</caption>
        ${renderStatRow(person, BODY_STATS)}
      </table>
      <table class="status-detail-stats">
        <caption>精神</caption>
        ${renderStatRow(person, MIND_STATS)}
      </table>
      <dl class="status-detail-traits">
        <dt>肉体特性</dt><dd>${renderTraitList(person.bodyTraits)}</dd>
        <dt>精神特性</dt><dd>${renderTraitList(person.mindTraits)}</dd>
      </dl>
    </div>
    <div class="modal-buttons">
      <button type="button" data-close-status-detail>閉じる</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-status-detail]").addEventListener("click", closePersonStatusDetailModal);
  overlay.addEventListener("click", closePersonStatusDetailModal);
}
