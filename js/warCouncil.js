// warCouncil.js
// 襲撃中の「作戦会議」画面。前衛・中衛・後衛の配置をチェックで決め、
// 想定ダメージと被弾のしやすさを見比べてから迎撃を始めるための画面。

import { getPortraitSpriteHtml } from "./data/portraitAtlas.js";
import { ACTION_NONE, refreshJobTable } from "./domain/jobTables.js";
import { isSaltPillar } from "./domain/apocalypseRules.js";
import { hasActiveBuildingFlag } from "./domain/buildingState.js";
import {
  ACTION_CANNON,
  ACTION_DEFEND,
  ACTION_FORTIFY,
  ACTION_SHOOT,
  ACTION_TRAP,
  canCannonInRaid,
  canDefendInRaid,
  canFortifyInRaid,
  canMakeTrapInRaid,
  canShootInRaid,
  estimateRaidActionDamage,
  getFortifyDamageMultiplier,
  getRaidActionBlockReason,
  getRaidActionStatLabel,
  getRaidFrontlinerSlotCount,
  getRaidMiddleSlotCount,
  getRaidTrapMakerSlotCount,
  getRaidIncomingDamageMultiplier,
  isPacifistFighter
} from "./raidRules.js";

// 予想欄に出す、行動そのものの性質。参照ステと予想値は村人ごとに算出する。
const COUNCIL_ACTION_NOTES = {
  [ACTION_DEFEND]: { order: "", counterOnly: false, note: "反撃あり" },
  // 籠城は自分から攻撃せず、前衛として反撃だけを返す。
  [ACTION_FORTIFY]: { order: "攻撃なし", counterOnly: true, note: "" },
  [ACTION_SHOOT]: { order: "先制", counterOnly: false, note: "反撃なし" },
  [ACTION_CANNON]: { order: "後手", counterOnly: false, note: "反撃なし" },
  [ACTION_TRAP]: { order: "0ターン目に攻撃して離脱", counterOnly: false, note: "" }
};

const OVERLAY_ID = "warCouncilOverlay";
const MODAL_ID = "warCouncilModal";

// 列の並びは戦列順。1人が就けるのは1つだけで、外すと通常業務へ戻る。
const COUNCIL_LINES = [
  {
    id: "front",
    label: "前衛",
    slots: getRaidFrontlinerSlotCount,
    actions: [
      { action: ACTION_DEFEND, label: "迎撃", can: canDefendInRaid },
      {
        action: ACTION_FORTIFY, label: "籠城", can: canFortifyInRaid,
        unlocked: village => hasActiveBuildingFlag(village, "hasWoodenFence", "woodenFence")
      }
    ]
  },
  {
    id: "middle",
    label: "中衛",
    slots: getRaidMiddleSlotCount,
    actions: [
      {
        action: ACTION_SHOOT, label: "射撃", can: canShootInRaid,
        unlocked: village => getRaidMiddleSlotCount(village) > 0
      },
      {
        action: ACTION_CANNON, label: "火砲", can: canCannonInRaid,
        unlocked: village => getRaidMiddleSlotCount(village) > 0 &&
          hasActiveBuildingFlag(village, "hasArcaneFoundry", "arcaneFoundry")
      }
    ]
  },
  {
    id: "rear",
    label: "後衛",
    slots: getRaidTrapMakerSlotCount,
    actions: [
      { action: ACTION_TRAP, label: "罠作成", can: (person) => canMakeTrapInRaid(person) }
    ]
  }
];

const ALL_COUNCIL_ACTIONS = COUNCIL_LINES.flatMap(line => line.actions.map(entry => entry.action));

let councilVillage = null;
let onCouncilStart = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getCouncilVillagers(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  return villagers.filter(person => !isSaltPillar(person));
}

/** その戦列に今何人就いているか。枠と突き合わせて表示する。 */
function countLineAssigned(village, line) {
  const actions = new Set(line.actions.map(entry => entry.action));
  return getCouncilVillagers(village).filter(person => actions.has(person.action)).length;
}

function getLineSlots(village, line) {
  const slots = line.slots(village);
  return Number.isFinite(slots) ? slots : 0;
}

/**
 * 予想ダメージ、参照する能力、被弾倍率、行動順。
 * 行の右端とホバーで同じ文言を使う。
 */
export function getCouncilActionEstimate(person, action, village) {
  if (!person || !action) return "";
  const meta = COUNCIL_ACTION_NOTES[action];
  if (!meta) return "";
  const incoming = action === ACTION_FORTIFY
    ? getFortifyDamageMultiplier(village)
    : getRaidIncomingDamageMultiplier(action, village);

  // 被弾倍率は等倍から外れている時だけ出す。
  const incomingLabel = incoming > 0 && incoming !== 1 ? `被弾${incoming}倍` : "";

  // 不殺・非戦主義は前衛に立っても攻撃も反撃もしない。
  if (isPacifistFighter(person) && (action === ACTION_DEFEND || action === ACTION_FORTIFY)) {
    return [["攻撃なし", incomingLabel].filter(Boolean).join("　"), "攻撃も反撃も行わない"].join("\n");
  }

  const damage = estimateRaidActionDamage(person, action, village);
  const statLabel = getRaidActionStatLabel(person, action, village);
  const head = [meta.order, incomingLabel].filter(Boolean).join("　");
  const damageLabel = meta.counterOnly ? "予想反撃ダメージ" : "予想ダメージ";
  const body = [`${damageLabel}${damage}${statLabel ? `（${statLabel}）` : ""}`, meta.note]
    .filter(Boolean).join("　");
  return [head, body].filter(Boolean).join("\n");
}

function getNormalTask(person) {
  const preferred = String(person?.preferredAction || person?.job || ACTION_NONE).trim();
  return preferred && preferred !== ACTION_NONE ? preferred : "なし";
}

function renderStatSummary(person) {
  const body = [["筋", "str"], ["耐", "vit"], ["器", "dex"], ["魔", "mag"], ["魅", "chr"]];
  const mind = [["知", "int"], ["勤", "ind"], ["倫", "eth"], ["勇", "cou"], ["色", "sexdr"]];
  const line = pairs => pairs
    .map(([label, key]) => `${label}${Math.floor(Number(person?.[key]) || 0)}`)
    .join(" ");
  return `<span class="wc-stat-line">${escapeHtml(line(body))}</span><span class="wc-stat-line">${escapeHtml(line(mind))}</span>`;
}

// 肉体特性と精神特性は色で分け、同じ側は「・」、肉体と精神の間は「/」で区切る。
function renderTraits(person) {
  const body = Array.isArray(person?.bodyTraits) ? person.bodyTraits : [];
  const mind = Array.isArray(person?.mindTraits) ? person.mindTraits : [];
  const groups = [];
  if (body.length > 0) {
    groups.push(`<span class="wc-body-trait">${escapeHtml(body.join("・"))}</span>`);
  }
  if (mind.length > 0) {
    groups.push(`<span class="wc-mind-trait">${escapeHtml(mind.join("・"))}</span>`);
  }
  return groups.length > 0 ? groups.join('<span class="wc-trait-sep">/</span>') : "—";
}

/**
 * チェックを入れられない理由。空文字なら選べる。
 * 枠の埋まり具合ではグレーアウトせず、超過は枠行の警告と迎撃開始時の判定で扱う。
 */
function getCheckboxBlockReason(person, entry, line, village) {
  if (person.action === entry.action) return "";
  if (!entry.can(person, village)) {
    return getRaidActionBlockReason(person, entry.action) || `${entry.label}を選べません`;
  }
  if (getLineSlots(village, line) <= 0) return `${line.label}の枠がありません`;
  return "";
}

/** 常に見える場所に出す枠の使用状況。超過した戦列は赤字にする。 */
function renderSlotSummary(village) {
  return COUNCIL_LINES.map(line => {
    const assigned = countLineAssigned(village, line);
    const slots = getLineSlots(village, line);
    const text = `${line.label} ${assigned}/${slots}`;
    return assigned > slots ? `<span class="is-over">${escapeHtml(text)}</span>` : escapeHtml(text);
  }).join("　");
}

/** 枠を超えている戦列。空配列なら迎撃を始められる。 */
function getOverCapacityLines(village) {
  return COUNCIL_LINES
    .map(line => ({ label: line.label, assigned: countLineAssigned(village, line), slots: getLineSlots(village, line) }))
    .filter(item => item.assigned > item.slots);
}

function renderVillagerRow(person, village) {
  const cells = COUNCIL_LINES.flatMap(line => line.actions.map(entry => {
    // 未解放の行動はネタバレ防止のため、名称をツールチップ等にも出さない。
    if (entry.unlocked && !entry.unlocked(village)) {
      return `
      <td class="wc-check-cell is-blocked">
        <input type="checkbox" disabled aria-label="未解放の行動">
      </td>`;
    }
    const checked = person.action === entry.action;
    const reason = getCheckboxBlockReason(person, entry, line, village);
    const title = reason || getCouncilActionEstimate(person, entry.action, village);
    return `
      <td class="wc-check-cell${reason ? " is-blocked" : ""}" title="${escapeHtml(title)}">
        <input type="checkbox" data-wc-person="${person.id}" data-wc-action="${escapeHtml(entry.action)}"
          ${checked ? "checked" : ""} ${reason ? "disabled" : ""}
          aria-label="${escapeHtml(`${person.name}を${entry.label}に就ける`)}">
      </td>`;
  })).join("");

  const onCouncilDuty = ALL_COUNCIL_ACTIONS.includes(person.action);
  const estimate = onCouncilDuty
    ? getCouncilActionEstimate(person, person.action, village)
    : "";

  return `
    <tr data-wc-row="${person.id}">
      <td class="wc-portrait-cell" data-wc-face="${person.id}" title="クリックで会話">${getPortraitSpriteHtml(person, { size: 40, alt: person.name })}</td>
      <td class="wc-name-cell">
        <div class="wc-name">${escapeHtml(person.name)}</div>
        <div class="wc-traits">${renderTraits(person)}</div>
      </td>
      <td class="wc-hp">${Math.floor(Number(person.hp) || 0)}</td>
      <td class="wc-stats">${renderStatSummary(person)}</td>
      ${cells}
      <td class="wc-task${onCouncilDuty ? " is-suspended" : ""}">${escapeHtml(getNormalTask(person))}</td>
      <td class="wc-estimate">${escapeHtml(estimate).replace(/\n/g, "<br>")}</td>
    </tr>`;
}

function renderSlotRow(village) {
  const cells = COUNCIL_LINES.map(line => {
    const assigned = countLineAssigned(village, line);
    const slots = getLineSlots(village, line);
    const over = assigned > slots;
    return `
      <td class="wc-slot-cell${over ? " is-over" : ""}" colspan="${line.actions.length}">
        <span class="wc-slot-count">${assigned}/${slots}</span>
        ${over ? '<span class="wc-slot-over">出撃枠超過</span>' : ""}
      </td>`;
  }).join("");
  return `<tr class="wc-slot-row"><td colspan="4"></td>${cells}<td colspan="2"></td></tr>`;
}

function renderEnemyRow(enemy) {
  return `
    <tr>
      <td class="wc-portrait-cell" data-wc-face="${enemy.id}" title="クリックで会話">${getPortraitSpriteHtml(enemy, { size: 40, alt: enemy.name })}</td>
      <td class="wc-name-cell">
        <div class="wc-name">${escapeHtml(enemy.name)}</div>
        <div class="wc-traits">${renderTraits(enemy)}</div>
      </td>
      <td class="wc-hp">${Math.floor(Number(enemy.hp) || 0)}</td>
      <td class="wc-stats">${renderStatSummary(enemy)}</td>
    </tr>`;
}

function renderBody(village) {
  const lineHeaders = COUNCIL_LINES
    .map(line => `<th colspan="${line.actions.length}" class="wc-line-head">${escapeHtml(line.label)}</th>`)
    .join("");
  // 建築で解放されていない行動は、列名を「-」にして未解放であることを示す。
  const actionHeaders = COUNCIL_LINES
    .flatMap(line => line.actions.map(entry => {
      const locked = entry.unlocked && !entry.unlocked(village);
      return locked
        ? '<th class="wc-action-head is-locked">-</th>'
        : `<th class="wc-action-head">${escapeHtml(entry.label)}</th>`;
    }))
    .join("");
  const rows = getCouncilVillagers(village).map(person => renderVillagerRow(person, village)).join("");
  const enemies = Array.isArray(village.raidEnemies) ? village.raidEnemies : [];

  return `
    <table class="wc-table">
      <thead>
        <tr>
          <th rowspan="2" class="wc-col-portrait">顔</th>
          <th rowspan="2" class="wc-col-name">名前<br>特性</th>
          <th rowspan="2" class="wc-col-hp">体力</th>
          <th rowspan="2" class="wc-col-stats">能力</th>
          ${lineHeaders}
          <th rowspan="2" class="wc-col-task">通常行動</th>
          <th rowspan="2" class="wc-col-estimate">予想</th>
        </tr>
        <tr>${actionHeaders}</tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="11" class="wc-empty">配置できる村人がいません。</td></tr>'}
        ${renderSlotRow(village)}
      </tbody>
    </table>

    <h3 class="wc-enemy-heading">襲撃者</h3>
    <table class="wc-table wc-enemy-table">
      <thead>
        <tr>
          <th class="wc-col-portrait">顔</th>
          <th class="wc-col-name">名前<br>特性</th>
          <th class="wc-col-hp">体力</th>
          <th class="wc-col-stats">能力</th>
        </tr>
      </thead>
      <tbody>
        ${enemies.map(renderEnemyRow).join("") || '<tr><td colspan="4" class="wc-empty">襲撃者はいません。</td></tr>'}
      </tbody>
    </table>
  `;
}

function refreshCouncilBody() {
  const content = document.querySelector(`#${MODAL_ID} .wc-content`);
  if (!content || !councilVillage) return;
  content.innerHTML = renderBody(councilVillage);
  const summary = document.querySelector(`#${MODAL_ID} [data-wc-summary]`);
  if (summary) summary.innerHTML = renderSlotSummary(councilVillage);
  bindCouncilInputs();
}

function setPersonAction(person, action, village) {
  // 1人が就けるのは1つだけ。外した場合は通常業務へ戻す。
  person.action = action || getNormalTask(person);
  if (!action) refreshJobTable(person, village);
}

function bindCouncilInputs() {
  const content = document.querySelector(`#${MODAL_ID} .wc-content`);
  if (!content || !councilVillage) return;
  content.querySelectorAll("[data-wc-person]").forEach(box => {
    box.addEventListener("change", () => {
      const person = getCouncilVillagers(councilVillage)
        .find(item => String(item.id) === box.dataset.wcPerson);
      if (!person) return;
      setPersonAction(person, box.checked ? box.dataset.wcAction : "", councilVillage);
      refreshCouncilBody();
    });
  });

  content.querySelectorAll("[data-wc-face]").forEach(cell => {
    cell.addEventListener("click", () => {
      const enemies = Array.isArray(councilVillage?.raidEnemies) ? councilVillage.raidEnemies : [];
      const person = [...getCouncilVillagers(councilVillage), ...enemies]
        .find(item => String(item.id) === cell.dataset.wcFace);
      if (!person) return;
      // 循環importを避けるため、会話モーダルは使う時にだけ読み込む。
      import("./conversation.js").then(({ openConversationModal }) => {
        openConversationModal(person);
      });
    });
  });
}

export function closeWarCouncilModal() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
  councilVillage = null;
  onCouncilStart = null;
}

export function isWarCouncilOpen() {
  return typeof document !== "undefined" && !!document.getElementById(MODAL_ID);
}

/** 画面を開いたまま配置だけ引き直す。防衛割り振りボタンから使う。 */
export function refreshWarCouncil() {
  refreshCouncilBody();
}

export function openWarCouncilModal(village, { onStart = null, onAutoAssign = null, onMiracle = null } = {}) {
  if (typeof document === "undefined" || !village) return;
  closeWarCouncilModal();
  councilVillage = village;
  onCouncilStart = onStart;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "wc-overlay";

  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "wc-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", `${MODAL_ID}Title`);
  modal.innerHTML = `
    <div class="wc-header">
      <h2 id="${MODAL_ID}Title">作戦会議</h2>
      <div class="wc-header-buttons">
        <button type="button" class="wc-start" data-wc-start>迎撃開始</button>
        <button type="button" data-wc-auto>防衛割り振り</button>
        <button type="button" data-wc-clear>全員解除</button>
        <button type="button" data-wc-miracle>奇跡の行使</button>
        <button type="button" data-wc-close>戻る</button>
      </div>
    </div>
    <p class="wc-lead">
      <span>チェックで配置を決めます。チェック欄にマウスを合わせると、予想ダメージと被弾のしやすさが出ます。</span>
      <span class="wc-slot-summary" data-wc-summary>${renderSlotSummary(village)}</span>
    </p>
    <div class="wc-content">${renderBody(village)}</div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  bindCouncilInputs();

  modal.querySelector("[data-wc-close]").onclick = closeWarCouncilModal;
  modal.querySelector("[data-wc-auto]").onclick = () => {
    if (typeof onAutoAssign === "function") onAutoAssign();
    refreshCouncilBody();
  };
  modal.querySelector("[data-wc-clear]").onclick = () => {
    getCouncilVillagers(councilVillage)
      .filter(person => ALL_COUNCIL_ACTIONS.includes(person.action))
      .forEach(person => setPersonAction(person, "", councilVillage));
    refreshCouncilBody();
  };
  modal.querySelector("[data-wc-miracle]").onclick = () => {
    if (typeof onMiracle === "function") onMiracle();
  };
  modal.querySelector("[data-wc-start]").onclick = () => {
    const over = getOverCapacityLines(councilVillage);
    if (over.length > 0) {
      window.alert(`出撃枠を超えています。\n${over.map(item => `${item.label} ${item.assigned}/${item.slots}`).join("\n")}\n配置を減らしてから迎撃を始めてください。`);
      return;
    }
    const fighters = COUNCIL_LINES
      .filter(line => line.id !== "rear")
      .reduce((sum, line) => sum + countLineAssigned(councilVillage, line), 0);
    if (fighters === 0 &&
      !window.confirm("前衛・中衛に誰も配置されていません。このまま迎撃を開始しますか？")) {
      return;
    }
    const start = onCouncilStart;
    closeWarCouncilModal();
    if (typeof start === "function") start();
  };
  modal.querySelector("[data-wc-start]")?.focus();
}
