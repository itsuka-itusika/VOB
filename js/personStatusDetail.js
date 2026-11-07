// personStatusDetail.js
// 村の外の人物（ラケシスの帳簿の記録、過去帳の故人）や奇跡・秘宝の対象の詳細ステータスを見る画面。
// 個人記録そのものに、人物欄と個人史の間へステータスと特性を挟んだもの。閉じると元の選択画面に戻る。

import { bindPersonalRecordContent, renderDictionaryTermList, renderPersonalRecordHtml } from "./history.js";

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

// 詳細ステータスの上から開いた個人記録・家系図・好感度の画面を、さらに上へ出すための印。
const OPEN_BODY_CLASS = "status-detail-open";

export function closePersonStatusDetailModal() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
  document.body?.classList.remove(OPEN_BODY_CLASS);
}

/**
 * 人物の詳細ステータスを開く。person は村人と同じ形の記録（保存形式でよい）。
 * 個人史は village から引く。村の外の人物（帳簿の記録）は village を渡さず、写しておいた historyEvents を渡す。
 * @param {object} person
 * @param {{ name?: string, village?: object|null, historyEvents?: object[]|null }} options name は表示名（帳簿の素の名など）
 */
export function openPersonStatusDetailModal(person, { name = "", village = null, historyEvents = null } = {}) {
  if (typeof document === "undefined" || !person) return;
  closePersonStatusDetailModal();
  const shown = name ? { ...person, name } : person;
  const statsHtml = `
    <table class="status-detail-stats">
      <colgroup>
        ${BODY_STATS.map(() => `<col class="status-detail-stat-col">`).join("")}
        <col>
      </colgroup>
      ${renderStatRows(person, BODY_STATS, "身体特性", person.bodyTraits)}
      ${renderStatRows(person, MIND_STATS, "精神特性", person.mindTraits)}
    </table>
  `;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "status-detail-overlay";
  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "friendship-detail-modal status-detail-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="modal-header"></div>
    <div class="status-detail-body"></div>
    <div class="modal-buttons">
      <button type="button" data-close-status-detail>閉じる</button>
    </div>
  `;
  modal.querySelector(".modal-header").textContent = `${shown.name || "不明"}の記録`;
  const body = modal.querySelector(".status-detail-body");
  body.innerHTML = renderPersonalRecordHtml(village, shown, {
    archived: Boolean(person.departure),
    historyEvents,
    afterSummaryHtml: statsHtml
  });
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  document.body.classList.add(OPEN_BODY_CLASS);
  bindPersonalRecordContent(body, village, shown);
  modal.querySelector("[data-close-status-detail]").addEventListener("click", closePersonStatusDetailModal);
  overlay.addEventListener("click", closePersonStatusDetailModal);
}

/**
 * 対象を選ぶプルダウンの右に「詳細」ボタンを並べた行を作る。select はこの行の中へ移し、
 * すでに画面の部品に入っていれば、その位置に行を置く。
 * @param {HTMLSelectElement} select
 * @param {() => object|null} getPerson 今選ばれている人物を返す
 * @param {object} village 個人史を引く村
 */
export function createStatusDetailSelectRow(select, getPerson, village) {
  const row = document.createElement("div");
  row.className = "status-detail-select-row";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "詳細";
  const sync = () => { button.disabled = !getPerson(); };
  button.addEventListener("click", event => {
    event.preventDefault();
    const person = getPerson();
    if (person) openPersonStatusDetailModal(person, { village });
  });
  select.addEventListener("change", sync);
  if (select.parentNode) select.before(row);
  row.append(select, button);
  sync();
  return row;
}
