// personStatusDetail.js
// 村の外の人物（ラケシスの帳簿の記録、過去帳の故人）や秘宝の対象の詳細ステータスを見る画面。
// 個人記録の顔写真と人物欄の下に、ステータスと特性を並べる。閉じると元の選択画面に戻る。

import { bindPersonProfileSummary, renderDictionaryTermList, renderPersonProfileSummary } from "./history.js";

const OVERLAY_ID = "personStatusDetailOverlay";
const MODAL_ID = "personStatusDetailModal";

const BODY_STATS = [["str", "筋力"], ["vit", "耐久"], ["dex", "器用"], ["mag", "魔力"], ["chr", "魅力"]];
const MIND_STATS = [["int", "知力"], ["ind", "勤勉"], ["eth", "倫理"], ["cou", "勇気"], ["sexdr", "好色"]];

// 5つのステータスと特性を同じ横列に置く。見出しの行と値の行で1組。
function renderStatRows(person, stats, traitLabel, traits) {
  return `
    <tr>${stats.map(([, label]) => `<th>${label}</th>`).join("")}<th class="status-detail-trait-cell">${traitLabel}</th></tr>
    <tr>${stats.map(([stat]) => `<td>${Math.floor(Number(person?.[stat]) || 0)}</td>`).join("")}<td class="status-detail-trait-cell">${renderDictionaryTermList(traits)}</td></tr>
  `;
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
  const shown = { ...person, name: name || person.name || "不明" };

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
      ${renderPersonProfileSummary(shown, { archived: !!person.departure })}
      <table class="status-detail-stats">
        <colgroup>
          ${BODY_STATS.map(() => `<col class="status-detail-stat-col">`).join("")}
          <col>
        </colgroup>
        ${renderStatRows(person, BODY_STATS, "身体特性", person.bodyTraits)}
        ${renderStatRows(person, MIND_STATS, "精神特性", person.mindTraits)}
      </table>
    </div>
    <div class="modal-buttons">
      <button type="button" data-close-status-detail>閉じる</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  bindPersonProfileSummary(modal, shown);
  modal.querySelector("[data-close-status-detail]").addEventListener("click", closePersonStatusDetailModal);
  overlay.addEventListener("click", closePersonStatusDetailModal);
}

/**
 * 対象を選ぶプルダウンの右に「詳細」ボタンを並べた行を作る。select はこの行の中へ移し、
 * すでに画面の部品に入っていれば、その位置に行を置く。
 * @param {HTMLSelectElement} select
 * @param {() => object|null} getPerson 今選ばれている人物を返す
 */
export function createStatusDetailSelectRow(select, getPerson) {
  const row = document.createElement("div");
  row.className = "status-detail-select-row";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "詳細";
  const sync = () => { button.disabled = !getPerson(); };
  button.addEventListener("click", event => {
    event.preventDefault();
    const person = getPerson();
    if (person) openPersonStatusDetailModal(person);
  });
  select.addEventListener("change", sync);
  if (select.parentNode) select.before(row);
  row.append(select, button);
  sync();
  return row;
}
