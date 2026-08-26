// autoAssignSettings.js
// 自動割り振りの段階（倍率と閾値）をプレイヤーが調整するための設定と、その編集画面。
// 既定値のままなら、これまでの自動割り振りとまったく同じ重みになる。

import { AUTO_ASSIGN_SECTIONS, AUTO_ASSIGN_SECTION_BY_ID } from "./data/autoAssignSettingsData.js";

const OVERLAY_ID = "autoAssignSettingsOverlay";
const MODAL_ID = "autoAssignSettingsModal";
const MULTIPLIER_MIN = 0;
const MULTIPLIER_MAX = 20;
const THRESHOLD_MIN = 0;
const THRESHOLD_MAX = 99999;

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/** 段階の閾値は昇順でなければ意味をなさないため、前の段階を下回らないように整える。 */
function sortThresholds(section, thresholds) {
  const result = {};
  let previous = THRESHOLD_MIN;
  section.stageKeys.slice(0, -1).forEach(key => {
    const value = Math.max(previous, clampNumber(thresholds?.[key], THRESHOLD_MIN, THRESHOLD_MAX, section.defaultThresholds[key]));
    result[key] = value;
    previous = value;
  });
  return result;
}

function normalizeSection(section, source) {
  const multipliers = {};
  section.stageKeys.forEach(key => {
    multipliers[key] = clampNumber(
      source?.multipliers?.[key],
      MULTIPLIER_MIN,
      MULTIPLIER_MAX,
      section.defaultMultipliers[key]
    );
  });
  return {
    manualMultipliers: !!source?.manualMultipliers,
    manualThresholds: !!source?.manualThresholds,
    multipliers,
    thresholds: sortThresholds(section, source?.thresholds)
  };
}

/** 保存データや未設定の状態から、扱える形の設定へ整える。 */
export function normalizeAutoAssignSettings(source = null) {
  const settings = {};
  AUTO_ASSIGN_SECTIONS.forEach(section => {
    settings[section.id] = normalizeSection(section, source?.[section.id]);
  });
  return settings;
}

export function getAutoAssignSettings(village) {
  const normalized = normalizeAutoAssignSettings(village?.autoAssignSettings);
  if (village) village.autoAssignSettings = normalized;
  return normalized;
}

function getSectionValues(section, settings) {
  const entry = settings?.[section.id];
  return {
    multipliers: entry?.manualMultipliers ? entry.multipliers : section.defaultMultipliers,
    thresholds: entry?.manualThresholds ? entry.thresholds : section.defaultThresholds,
    manualMultipliers: !!entry?.manualMultipliers,
    manualThresholds: !!entry?.manualThresholds
  };
}

/**
 * 値がどの段階に入るかを返す。閾値は「この値以下ならその段階」として扱う。
 */
export function resolveStageKey(sectionId, value, settings) {
  const section = AUTO_ASSIGN_SECTION_BY_ID.get(sectionId);
  if (!section) return null;
  const { thresholds } = getSectionValues(section, settings);
  const boundedKeys = section.stageKeys.slice(0, -1);
  const matched = boundedKeys.find(key => Number(value) <= Number(thresholds[key]));
  return matched || section.stageKeys[section.stageKeys.length - 1];
}

/** 段階に対応する倍率。段階を持たない設定（資金・技術の既定）は1倍。 */
export function getStageMultiplier(sectionId, stageKey, settings) {
  const section = AUTO_ASSIGN_SECTION_BY_ID.get(sectionId);
  if (!section || !stageKey) return 1;
  const values = getSectionValues(section, settings);
  // 資金・技術は手動設定を入れるまで段階を作らず、基本重みのまま扱う。
  if (section.optionalStages && !values.manualMultipliers) return 1;
  const multiplier = values.multipliers[stageKey];
  return Number.isFinite(Number(multiplier)) ? Number(multiplier) : 1;
}

/** その軸が段階を持つか。持たない場合、呼び出し側は段階判定そのものを省ける。 */
export function hasStagedStock(sectionId, settings) {
  const section = AUTO_ASSIGN_SECTION_BY_ID.get(sectionId);
  if (!section) return false;
  if (!section.optionalStages) return true;
  return getSectionValues(section, settings).manualMultipliers;
}

/* -------------------------------------------
   設定画面
------------------------------------------- */

let editingSettings = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatThresholdCell(section, stageKey, thresholds, index) {
  const unit = section.thresholdUnit;
  if (index === section.stageKeys.length - 1) {
    const previous = section.stageKeys[index - 1];
    return `${thresholds[previous]}${unit} を超える`;
  }
  return `${thresholds[stageKey]}${unit} 以下`;
}

function renderSectionRows(section, settings) {
  const values = getSectionValues(section, settings);
  const entry = settings[section.id];
  const headers = section.stageKeys.map(key => {
    const multiplier = values.multipliers[key];
    return `<th><span class="aas-stage-name">${escapeHtml(section.stageLabels[key])}</span><span class="aas-stage-mul">×${multiplier}</span></th>`;
  }).join("");

  const multiplierInputs = section.stageKeys.map(key => `
    <td><input type="number" step="0.1" min="${MULTIPLIER_MIN}" max="${MULTIPLIER_MAX}"
      data-aas-field="multiplier" data-aas-section="${section.id}" data-aas-stage="${key}"
      value="${entry.multipliers[key]}" ${values.manualMultipliers ? "" : "disabled"}></td>
  `).join("");

  const thresholdInputs = section.stageKeys.map((key, index) => {
    if (index === section.stageKeys.length - 1) {
      const previous = section.stageKeys[index - 1];
      return `<td class="aas-readonly">（${escapeHtml(section.stageLabels[previous])}の上限＋）以上</td>`;
    }
    return `<td><input type="number" step="1" min="${THRESHOLD_MIN}" max="${THRESHOLD_MAX}"
      data-aas-field="threshold" data-aas-section="${section.id}" data-aas-stage="${key}"
      value="${entry.thresholds[key]}" ${values.manualThresholds ? "" : "disabled"}></td>`;
  }).join("");

  const currentRow = section.stageKeys.map((key, index) => (
    `<td class="aas-current">${escapeHtml(formatThresholdCell(section, key, values.thresholds, index))}</td>`
  )).join("");

  return `
    <section class="aas-section">
      <h3>${escapeHtml(section.label)}<span class="aas-base">基本重み ${section.baseWeight}</span></h3>
      <p class="aas-hint">${escapeHtml(section.thresholdHint)}</p>
      <table class="aas-table">
        <thead><tr><th class="aas-row-label"></th>${headers}</tr></thead>
        <tbody>
          <tr>
            <th class="aas-row-label">
              <label><input type="checkbox" data-aas-field="manualMultipliers" data-aas-section="${section.id}"
                ${values.manualMultipliers ? "checked" : ""}>倍率を手動</label>
            </th>
            ${multiplierInputs}
          </tr>
          <tr>
            <th class="aas-row-label">
              <label><input type="checkbox" data-aas-field="manualThresholds" data-aas-section="${section.id}"
                ${values.manualThresholds ? "checked" : ""}>区切りを手動</label>
            </th>
            ${thresholdInputs}
          </tr>
          <tr class="aas-current-row">
            <th class="aas-row-label">適用される範囲</th>
            ${currentRow}
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

function renderModalBody(settings) {
  return AUTO_ASSIGN_SECTIONS.map(section => renderSectionRows(section, settings)).join("");
}

function refreshModalBody() {
  const content = document.querySelector(`#${MODAL_ID} .aas-content`);
  if (!content) return;
  content.innerHTML = renderModalBody(editingSettings);
  bindModalInputs();
}

function bindModalInputs() {
  const content = document.querySelector(`#${MODAL_ID} .aas-content`);
  if (!content) return;

  content.querySelectorAll("[data-aas-field='manualMultipliers'], [data-aas-field='manualThresholds']").forEach(box => {
    box.addEventListener("change", () => {
      editingSettings[box.dataset.aasSection][box.dataset.aasField] = box.checked;
      refreshModalBody();
    });
  });

  content.querySelectorAll("[data-aas-field='multiplier']").forEach(input => {
    input.addEventListener("change", () => {
      const section = AUTO_ASSIGN_SECTION_BY_ID.get(input.dataset.aasSection);
      const stage = input.dataset.aasStage;
      editingSettings[section.id].multipliers[stage] =
        clampNumber(input.value, MULTIPLIER_MIN, MULTIPLIER_MAX, section.defaultMultipliers[stage]);
      refreshModalBody();
    });
  });

  content.querySelectorAll("[data-aas-field='threshold']").forEach(input => {
    input.addEventListener("change", () => {
      const section = AUTO_ASSIGN_SECTION_BY_ID.get(input.dataset.aasSection);
      const stage = input.dataset.aasStage;
      const next = { ...editingSettings[section.id].thresholds, [stage]: input.value };
      editingSettings[section.id].thresholds = sortThresholds(section, next);
      refreshModalBody();
    });
  });
}

export function closeAutoAssignSettingsModal() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
  editingSettings = null;
}

export function openAutoAssignSettingsModal(village, { onApplied = null } = {}) {
  if (typeof document === "undefined" || !village) return;
  closeAutoAssignSettingsModal();
  editingSettings = normalizeAutoAssignSettings(getAutoAssignSettings(village));

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "aas-overlay";

  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "aas-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", `${MODAL_ID}Title`);
  modal.innerHTML = `
    <div class="modal-header" id="${MODAL_ID}Title">自動割り振り詳細設定</div>
    <p class="aas-lead">村の状況ごとに、どの資源をどれだけ優先するかを決めます。手動のチェックを入れた行だけ入力が効き、外すと既定値に戻ります。</p>
    <div class="aas-content">${renderModalBody(editingSettings)}</div>
    <div class="modal-buttons aas-buttons">
      <button type="button" data-aas-default>デフォルトに戻す</button>
      <button type="button" data-aas-cancel>取り消す</button>
      <button type="button" class="aas-apply" data-aas-apply>適用する</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  bindModalInputs();

  modal.querySelector("[data-aas-default]").onclick = () => {
    editingSettings = normalizeAutoAssignSettings(null);
    refreshModalBody();
  };
  modal.querySelector("[data-aas-cancel]").onclick = closeAutoAssignSettingsModal;
  overlay.onclick = closeAutoAssignSettingsModal;
  modal.querySelector("[data-aas-apply]").onclick = () => {
    village.autoAssignSettings = normalizeAutoAssignSettings(editingSettings);
    village.log("【自動割り振り】詳細設定を更新しました");
    closeAutoAssignSettingsModal();
    if (typeof onApplied === "function") onApplied();
  };
  modal.querySelector("[data-aas-apply]")?.focus();
}
