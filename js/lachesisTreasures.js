// lachesisTreasures.js
// 秘宝「ラケシスの糸車」（帳簿への登録）と「ラケシスの神籤」（帳簿の村人の呼び出し）の処理と画面。
// 帳簿そのものの保存と人物の作り直しは lachesisLedger.js が受け持つ。

import {
  createLachesisVisitor,
  getLachesisEntryBlockedReason,
  loadLachesisLedger,
  registerToLachesisLedger
} from "./lachesisLedger.js";
import { getPortraitSpriteHtml } from "./data/portraitAtlas.js";
import { showMiracleResultModal } from "./miracles.js";
import { updateUI } from "./ui.js";
import { openPersonStatusDetailModal } from "./personStatusDetail.js";

const LOT_OVERLAY_ID = "lachesisLotOverlay";
const LOT_MODAL_ID = "lachesisLotModal";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

/** ラケシスの糸車: 村人を帳簿へ登録する。糸車は使ってもなくならない。 */
export function applyLachesisLedger(village, target) {
  const { overwritten, saved } = registerToLachesisLedger(village, target);
  if (!saved) {
    village.log("【秘宝】ラケシスの帳簿へ書き込めませんでした。ブラウザの保存領域を確認してください");
    window.alert("ラケシスの帳簿へ書き込めませんでした。ブラウザの保存領域を確認してください。");
    return false;
  }
  village.log(`【秘宝】ラケシスの糸車により、${target.name}をラケシスの帳簿に${overwritten ? "記し直しました" : "記しました"}`);
  showMiracleResultModal(
    village,
    "ラケシスの糸車",
    overwritten
      ? `ラケシスの糸車が回り、${target.name}の運命の糸が紡ぎ直されました。`
      : `ラケシスの糸車が回り、${target.name}の運命の糸が紡ぎ込まれました。`,
    [target]
  );
  return true;
}

function describeEntry(entry, village) {
  const person = entry.person || {};
  const origin = !village
    ? "登録"
    : (entry.originVillageUid && entry.originVillageUid === village.villageUid ? "この村で登録" : "別の村で登録");
  return `${person.race || "人間"}・肉体${person.bodySex || "-"}${person.bodyAge ?? "-"}歳／精神${person.spiritSex || "-"}${person.spiritAge ?? "-"}歳`
    + `<br><span class="fate-picker-note">${entry.registeredYear}年${entry.registeredMonth}月に${origin}</span>`;
}

export function closeLachesisLotModal() {
  document.getElementById(LOT_OVERLAY_ID)?.remove();
  document.getElementById(LOT_MODAL_ID)?.remove();
}

/** 呼び出した村人を訪問者として迎え、専用の会話モーダルで第一声を見せる。 */
function summonLachesisEntry(village, entry) {
  const visitor = createLachesisVisitor(entry, { summoned: true });
  if (!Array.isArray(village.visitors)) village.visitors = [];
  village.visitors.push(visitor);
  village.log(`【秘宝】ラケシスの神籤により、${visitor.name}が村を訪れました`);
  showMiracleResultModal(
    village,
    "ラケシスの神籤",
    `運命の糸が手繰られ、${entry.name}が旅人として村を訪れました。`,
    [visitor]
  );
  updateUI(village);
}

/**
 * ラケシスの神籤: 帳簿の村人を選ぶ画面を開く。呼び出した時だけ onSummoned を呼ぶ。
 */
export function openLachesisLotModal(village, { onSummoned = null } = {}) {
  if (typeof document === "undefined") return;
  closeLachesisLotModal();
  const entries = loadLachesisLedger();
  const rows = entries.map((entry, index) => {
    const reason = getLachesisEntryBlockedReason(village, entry);
    return `
      <tr>
        <td>
          <div class="friendship-detail-person">
            ${getPortraitSpriteHtml(entry.person, { alt: entry.name })}
            <span>${escapeHtml(entry.name)}</span>
          </div>
        </td>
        <td>${describeEntry(entry, village)}</td>
        <td>
          <div class="fate-picker-actions">
            <button type="button" data-lachesis-detail="${index}">詳細</button>
            <button type="button" data-summon-lachesis="${index}" ${reason ? "disabled" : ""}>呼び出す</button>
          </div>
          ${reason ? `<div class="fate-picker-note">${escapeHtml(reason)}</div>` : ""}
        </td>
      </tr>
    `;
  }).join("");

  const overlay = document.createElement("div");
  overlay.id = LOT_OVERLAY_ID;
  overlay.className = "friendship-detail-overlay";
  const modal = document.createElement("div");
  modal.id = LOT_MODAL_ID;
  modal.className = "friendship-detail-modal silver-ledger-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="modal-header">ラケシスの帳簿</div>
    <div class="friendship-detail-content">
      <table class="friendship-detail-table fate-picker-table">
        <colgroup>
          <col class="friendship-detail-col-person">
          <col class="friendship-detail-col-relation">
          <col class="fate-picker-col-action">
        </colgroup>
        <thead>
          <tr><th>人物</th><th>記録</th><th></th></tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="3" class="friendship-detail-empty">帳簿には、まだ誰の名も記されていない。</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="modal-buttons">
      <button type="button" data-close-lachesis-lot>やめる</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  modal.querySelectorAll("[data-lachesis-detail]").forEach(button => {
    button.addEventListener("click", () => {
      const entry = entries[Number(button.dataset.lachesisDetail)];
      if (entry) openPersonStatusDetailModal(entry.person, { name: entry.name, historyEvents: entry.history || [] });
    });
  });
  modal.querySelectorAll("[data-summon-lachesis]").forEach(button => {
    button.addEventListener("click", () => {
      const entry = entries[Number(button.dataset.summonLachesis)];
      if (!entry || getLachesisEntryBlockedReason(village, entry)) return;
      if (!window.confirm(`${entry.name}を呼び出しますか？`)) return;
      closeLachesisLotModal();
      if (typeof onSummoned === "function") onSummoned();
      summonLachesisEntry(village, entry);
    });
  });
  modal.querySelector("[data-close-lachesis-lot]").addEventListener("click", closeLachesisLotModal);
  overlay.addEventListener("click", closeLachesisLotModal);
}

const REBIRTH_OVERLAY_ID = "lachesisRebirthOverlay";
const REBIRTH_MODAL_ID = "lachesisRebirthModal";
export const LACHESIS_REBIRTH_MAX_FOUNDERS = 2;

export function closeLachesisRebirthModal() {
  document.getElementById(REBIRTH_OVERLAY_ID)?.remove();
  document.getElementById(REBIRTH_MODAL_ID)?.remove();
}

/**
 * 「はじめから（転生）」: 帳簿の村人を1〜2人選ぶ画面。決めた時に onConfirm(選んだ記録) を呼ぶ。
 */
export function openLachesisRebirthModal({ onConfirm = null } = {}) {
  if (typeof document === "undefined") return;
  closeLachesisRebirthModal();
  const entries = loadLachesisLedger();
  const selected = new Set();

  const overlay = document.createElement("div");
  overlay.id = REBIRTH_OVERLAY_ID;
  overlay.className = "gs-overlay";
  const modal = document.createElement("div");
  modal.id = REBIRTH_MODAL_ID;
  modal.className = "gs-modal silver-ledger-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", `${REBIRTH_MODAL_ID}Title`);
  modal.innerHTML = `
    <h2 id="${REBIRTH_MODAL_ID}Title" class="gs-title">はじめから（転生）</h2>
    <p class="gs-note">新しい村の初期村人になる者を1〜2人選びます。</p>
    <div class="rebirth-grid">
      ${entries.map((entry, index) => `
        <div class="gs-card rebirth-card" data-rebirth-entry="${index}" role="button" tabindex="0" aria-pressed="false">
          ${getPortraitSpriteHtml(entry.person, { size: 56, alt: entry.name })}
          <div class="rebirth-card-body">
            <h4>${escapeHtml(entry.name)}</h4>
            <p>${describeEntry(entry, null)}</p>
            <button type="button" class="rebirth-detail-button" data-rebirth-detail="${index}">詳細</button>
          </div>
        </div>
      `).join("")}
    </div>
    <p class="gs-note" data-rebirth-count>0人を選択中（1〜2人）</p>
    <div class="gs-buttons">
      <button type="button" data-rebirth-cancel>やめる</button>
      <button type="button" class="gs-apply" data-rebirth-start disabled>この顔ぶれで始める</button>
    </div>
  `;

  const startButton = modal.querySelector("[data-rebirth-start]");
  const countText = modal.querySelector("[data-rebirth-count]");
  const refresh = () => {
    modal.querySelectorAll("[data-rebirth-entry]").forEach(card => {
      const isSelected = selected.has(Number(card.dataset.rebirthEntry));
      card.classList.toggle("is-selected", isSelected);
      card.setAttribute("aria-pressed", String(isSelected));
    });
    countText.textContent = `${selected.size}人を選択中（1〜${LACHESIS_REBIRTH_MAX_FOUNDERS}人）`;
    startButton.disabled = selected.size === 0;
  };
  const toggle = index => {
    if (selected.has(index)) selected.delete(index);
    else if (selected.size < LACHESIS_REBIRTH_MAX_FOUNDERS) selected.add(index);
    refresh();
  };
  // 詳細ボタンはカードの選択を切り替えずに、その人物のステータスだけを開く。
  modal.querySelectorAll("[data-rebirth-detail]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const entry = entries[Number(button.dataset.rebirthDetail)];
      if (entry) openPersonStatusDetailModal(entry.person, { name: entry.name, historyEvents: entry.history || [] });
    });
    button.addEventListener("keydown", event => event.stopPropagation());
  });
  modal.querySelectorAll("[data-rebirth-entry]").forEach(card => {
    const index = Number(card.dataset.rebirthEntry);
    card.addEventListener("click", () => toggle(index));
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle(index);
      }
    });
  });
  modal.querySelector("[data-rebirth-cancel]").onclick = closeLachesisRebirthModal;
  overlay.onclick = closeLachesisRebirthModal;
  startButton.onclick = () => {
    const chosen = [...selected].sort((a, b) => a - b).map(index => entries[index]).filter(Boolean);
    if (chosen.length === 0) return;
    closeLachesisRebirthModal();
    if (typeof onConfirm === "function") onConfirm(chosen);
  };

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  refresh();
}
