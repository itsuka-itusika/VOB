// ledger.js
// 村の記録をまとめる「台帳」。村史・過去帳・選挙記録・願望・経営目標への入口を持つ。
// 各画面は台帳から開き、閉じると台帳へ戻る。

import { HISTORY_EVENT_TYPES, openHistoryModal, openPastBookModal, renderHistoryEntry } from "./history.js";
import {
  MANAGEMENT_GOAL_AXES,
  MANAGEMENT_GOAL_LABELS,
  MANAGEMENT_GOAL_MAX,
  MANAGEMENT_GOAL_MIN,
  getManagementGoals,
  setManagementGoals
} from "./managementGoals.js";
import { MAX_ACTIVE_WISHES, getActiveWishes, getWishLog, openWishStartModal } from "./wishes.js";
import {
  RECORD_CATEGORIES,
  RECORD_RANKING_LIMIT,
  getRecordPortraitHtml,
  getVillageRecordRanking
} from "./records.js";
import { getPortraitSpriteHtml } from "./data/portraitAtlas.js";

// 台帳を開いた村。各画面を閉じたときに台帳へ戻すため覚えておく。
let ledgerVillage = null;

const WISH_OUTCOME_LABELS = Object.freeze({
  achieved: "達成",
  expired: "期限切れ",
  lost: "消失"
});

const LEDGER_CARDS = [
  { id: "history", title: "村史", note: "村に起きた出来事の年代記" },
  { id: "pastbook", title: "過去帳", note: "村を去った者たちの記録" },
  { id: "election", title: "選挙記録", note: "里長選挙の結果と得票" },
  { id: "wish", title: "願望", note: "村人が神へ託した望み" },
  { id: "ranking", title: "殿堂", note: "村に残る歴代の記録" },
  { id: "goals", title: "経営目標", note: "資金と技術の目標を定める" }
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]
  ));
}

function setModalVisible(id, visible) {
  const overlay = document.getElementById(`${id}Overlay`);
  const modal = document.getElementById(`${id}Modal`);
  if (overlay) overlay.style.display = visible ? "block" : "none";
  if (modal) modal.style.display = visible ? "block" : "none";
}

function formatYearMonth(year, month) {
  return `${Number(year) || 0}年${Number(month) || 1}月`;
}

/* ------------------------------ 台帳 ------------------------------ */

export function openLedgerModal(village) {
  const content = document.getElementById("ledgerContent");
  if (!content || !village) return;
  ledgerVillage = village;

  content.innerHTML = `
    <p class="ledger-lead">村の帳面を開く。</p>
    <div class="ledger-card-grid">
      ${LEDGER_CARDS.map(card => `
        <button type="button" class="ledger-card" data-ledger-card="${card.id}">
          <span class="ledger-card-body">
            <span class="ledger-card-title">${escapeHtml(card.title)}</span>
            <span class="ledger-card-note">${escapeHtml(card.note)}</span>
          </span>
        </button>
      `).join("")}
    </div>
  `;

  content.querySelectorAll("[data-ledger-card]").forEach(button => {
    button.addEventListener("click", () => openLedgerPage(village, button.dataset.ledgerCard));
  });

  setModalVisible("ledger", true);
}

export function closeLedgerModal() {
  setModalVisible("ledger", false);
}

function openLedgerPage(village, cardId) {
  // 台帳は開いたままにせず、選んだ画面だけを表示する。
  closeLedgerModal();
  switch (cardId) {
    case "history": openHistoryModal(village, { onBack: () => openLedgerModal(village) }); break;
    case "pastbook": openPastBookModal(village, { onBack: () => openLedgerModal(village) }); break;
    case "election": openElectionRecordModal(village); break;
    case "wish": openWishLedgerModal(village); break;
    case "ranking": openRankingModal(village); break;
    case "goals": openManagementGoalsModal(village); break;
    default: openLedgerModal(village); break;
  }
}

/** 各画面の「戻る」で台帳へ返す。 */
function backToLedger(closeCurrent) {
  closeCurrent();
  if (ledgerVillage) openLedgerModal(ledgerVillage);
}

/* --------------------------- 選挙記録 --------------------------- */

export function openElectionRecordModal(village) {
  const content = document.getElementById("electionRecordContent");
  if (!content || !village) return;
  ledgerVillage = village;

  const events = (Array.isArray(village.historyEvents) ? village.historyEvents : [])
    .filter(event => event.type === HISTORY_EVENT_TYPES.HEADMAN_ELECTION)
    .slice()
    .reverse();

  content.innerHTML = `
    ${events.length > 0
      ? `<div class="history-list">${events.map(event => renderHistoryEntry(event)).join("")}</div>`
      : `<div class="history-empty">里長選挙はまだ行われていない。</div>`}
    <div class="ledger-back-row"><button type="button" data-ledger-back>台帳へ戻る</button></div>
  `;
  content.querySelector("[data-ledger-back]")
    ?.addEventListener("click", () => backToLedger(closeElectionRecordModal));

  setModalVisible("electionRecord", true);
}

export function closeElectionRecordModal() {
  setModalVisible("electionRecord", false);
}

/* ----------------------------- 願望 ----------------------------- */

function renderWishCard(wish, { active, index }) {
  const portraitHtml = getPortraitSpriteHtml(
    { name: wish.requesterName, portraitFile: wish.requesterPortraitFile, bodyTraits: [] },
    { size: 44, alt: wish.requesterName }
  );
  // 発生時のセリフが残っている願望だけ、顔から発生時のモーダルを開ける。
  const canReopen = !!String(wish.line || "").trim();
  const portrait = canReopen
    ? `<button type="button" class="ledger-wish-portrait" data-wish-open="${active ? "active" : "log"}"
        data-wish-index="${index}" title="願望が起きたときの様子を見る"
        aria-label="${escapeHtml(wish.requesterName)}の願望が起きたときの様子を見る">${portraitHtml}</button>`
    : portraitHtml;
  const targetText = wish.targetName && wish.id !== "get_closer"
    ? `<span class="ledger-wish-target">対象: ${escapeHtml(wish.targetName)}</span>`
    : "";
  const status = active
    ? `<span class="ledger-wish-status is-active">残り${wish.monthsLeft}か月</span>`
    : `<span class="ledger-wish-status is-${escapeHtml(wish.outcome)}">${escapeHtml(WISH_OUTCOME_LABELS[wish.outcome] || wish.outcome)}</span>`;
  const when = active ? "" : `<span class="ledger-wish-when">${escapeHtml(formatYearMonth(wish.year, wish.month))}</span>`;

  return `
    <div class="ledger-wish-row">
      ${portrait}
      <div class="ledger-wish-body">
        <div class="ledger-wish-head">
          <strong>${escapeHtml(wish.requesterName)}</strong>
          <span class="ledger-wish-name">「${escapeHtml(wish.name)}」</span>
        </div>
        <div class="ledger-wish-meta">${status}${when}${targetText}</div>
      </div>
    </div>
  `;
}

export function openWishLedgerModal(village) {
  const content = document.getElementById("wishLedgerContent");
  if (!content || !village) return;
  ledgerVillage = village;

  const active = getActiveWishes(village);
  const log = getWishLog(village).slice().reverse();

  content.innerHTML = `
    <section class="ledger-section">
      <h3 class="ledger-section-title">いま抱えている願望（${active.length}/${MAX_ACTIVE_WISHES}）</h3>
      ${active.length > 0
        ? active.map((wish, index) => renderWishCard(wish, { active: true, index })).join("")
        : `<div class="history-empty">神へ託された望みは、いまはない。</div>`}
    </section>
    <section class="ledger-section">
      <h3 class="ledger-section-title">これまでの願望</h3>
      ${log.length > 0
        ? log.map((wish, index) => renderWishCard(wish, { active: false, index })).join("")
        : `<div class="history-empty">決着した願望はまだ記されていない。</div>`}
    </section>
    <div class="ledger-back-row"><button type="button" data-ledger-back>台帳へ戻る</button></div>
  `;
  content.querySelectorAll("[data-wish-open]").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.wishIndex);
      const isActive = button.dataset.wishOpen === "active";
      const wish = isActive ? active[index] : log[index];
      if (!wish) return;
      openWishStartModal(wish, {
        detailText: isActive
          ? `残り${wish.monthsLeft}か月`
          : `${WISH_OUTCOME_LABELS[wish.outcome] || wish.outcome} ${formatYearMonth(wish.year, wish.month)}`
      });
    });
  });

  content.querySelector("[data-ledger-back]")
    ?.addEventListener("click", () => backToLedger(closeWishLedgerModal));

  setModalVisible("wishLedger", true);
}

export function closeWishLedgerModal() {
  setModalVisible("wishLedger", false);
}

/* ---------------------------- 殿堂 ---------------------------- */

function renderRankingCategory(village, category) {
  const rows = getVillageRecordRanking(village, category.id, RECORD_RANKING_LIMIT);
  const body = rows.length > 0
    ? rows.map((row, index) => `
        <li class="ledger-rank-row">
          <span class="ledger-rank-place is-${index + 1}">${index + 1}</span>
          ${getRecordPortraitHtml(row)}
          <span class="ledger-rank-name">${escapeHtml(row.name)}</span>
          <span class="ledger-rank-value">${row.value}${escapeHtml(category.unit)}</span>
        </li>`).join("")
    : `<li class="ledger-rank-empty">まだ記録がない。</li>`;
  return `
    <section class="ledger-rank-card">
      <h3 class="ledger-rank-title">${escapeHtml(category.label)}</h3>
      <ol class="ledger-rank-list">${body}</ol>
    </section>`;
}

export function openRankingModal(village) {
  const content = document.getElementById("rankingContent");
  if (!content || !village) return;
  ledgerVillage = village;

  content.innerHTML = `
    <p class="ledger-lead">村を去った者の記録も、そのまま帳面に残る。</p>
    <div class="ledger-rank-grid">
      ${RECORD_CATEGORIES.map(category => renderRankingCategory(village, category)).join("")}
    </div>
    <div class="ledger-back-row"><button type="button" data-ledger-back>台帳へ戻る</button></div>
  `;
  content.querySelector("[data-ledger-back]")
    ?.addEventListener("click", () => backToLedger(closeRankingModal));

  setModalVisible("ranking", true);
}

export function closeRankingModal() {
  setModalVisible("ranking", false);
}

/* --------------------------- 経営目標 --------------------------- */

export function openManagementGoalsModal(village, { onApplied = null } = {}) {
  const content = document.getElementById("managementGoalsContent");
  if (!content || !village) return;
  ledgerVillage = village;

  const goals = getManagementGoals(village);
  const numberField = (axis, key, value) => `
    <input type="number" class="ledger-goal-input" data-goal-axis="${axis}" data-goal-key="${key}"
      value="${Number(value) || 0}" min="${MANAGEMENT_GOAL_MIN}" max="${MANAGEMENT_GOAL_MAX}" step="1"
      aria-label="${escapeHtml(MANAGEMENT_GOAL_LABELS[axis])}の${key === "target" ? "目標" : "過剰"}">`;

  content.innerHTML = `
    <table class="ledger-goal-table">
      <thead>
        <tr><th></th><th>目標</th><th>過剰</th><th class="ledger-goal-current">現在</th></tr>
      </thead>
      <tbody>
        ${MANAGEMENT_GOAL_AXES.map(axis => `
          <tr>
            <th scope="row">${escapeHtml(MANAGEMENT_GOAL_LABELS[axis])}</th>
            <td>${numberField(axis, "target", goals[axis].target)}</td>
            <td>${numberField(axis, "excess", goals[axis].excess)}<span class="ledger-goal-suffix">以上</span></td>
            <td class="ledger-goal-current">${Math.floor(Number(village[axis]) || 0)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="ledger-goal-actions">
      <button type="button" data-goal-apply>適用</button>
    </div>
    <p class="ledger-goal-note">
      目標未達成の資源は自動割り振り時に優先されます。<br>
      過剰になった資源は優先度が下がります。
    </p>
    <p class="ledger-goal-status" data-goal-status></p>
    <div class="ledger-back-row"><button type="button" data-ledger-back>台帳へ戻る</button></div>
  `;

  const statusEl = content.querySelector("[data-goal-status]");
  content.querySelector("[data-goal-apply]")?.addEventListener("click", () => {
    const next = {};
    MANAGEMENT_GOAL_AXES.forEach(axis => { next[axis] = { target: 0, excess: 0 }; });
    content.querySelectorAll("[data-goal-axis]").forEach(input => {
      next[input.dataset.goalAxis][input.dataset.goalKey] = input.value;
    });
    const applied = setManagementGoals(village, next);
    // 過剰が目標を下回る入力は補正されるため、確定値を欄へ戻す。
    content.querySelectorAll("[data-goal-axis]").forEach(input => {
      input.value = applied[input.dataset.goalAxis][input.dataset.goalKey];
    });
    if (statusEl) {
      statusEl.textContent = MANAGEMENT_GOAL_AXES
        .map(axis => `${MANAGEMENT_GOAL_LABELS[axis]} 目標${applied[axis].target} / 過剰${applied[axis].excess}`)
        .join("　");
    }
    village.log?.(`経営目標を更新: ${MANAGEMENT_GOAL_AXES
      .map(axis => `${MANAGEMENT_GOAL_LABELS[axis]}(目標${applied[axis].target}/過剰${applied[axis].excess})`)
      .join("、")}`);
    if (typeof onApplied === "function") onApplied(applied);
  });

  content.querySelector("[data-ledger-back]")
    ?.addEventListener("click", () => backToLedger(closeManagementGoalsModal));

  setModalVisible("managementGoals", true);
}

export function closeManagementGoalsModal() {
  setModalVisible("managementGoals", false);
}
