// gameSettings.js
// オープニングの「設定」画面と、その内容（難易度・オートセーブ）の保存。
// 設定は localStorage に保存する。難易度は「はじめから」の開始時に村へ適用され、
// 以後はセーブデータ側の値に従う（途中変更はできない）。

import { DIFFICULTY_HARD, DIFFICULTY_NORMAL, normalizeDifficulty } from "./domain/difficulty.js";
import { saveVillageToJsonFile, saveVillageToLocalStorage } from "./saveLoad.js";

const STORAGE_KEY = "vobGameSettings";
const OVERLAY_ID = "gameSettingsOverlay";
const MODAL_ID = "gameSettingsModal";

export const AUTOSAVE_NONE = "none";
export const AUTOSAVE_MONTHLY_LOCAL = "monthly-local";
export const AUTOSAVE_YEARLY_LOCAL = "yearly-local";
export const AUTOSAVE_YEARLY_JSON = "yearly-json";
const AUTOSAVE_MODES = [AUTOSAVE_NONE, AUTOSAVE_MONTHLY_LOCAL, AUTOSAVE_YEARLY_LOCAL, AUTOSAVE_YEARLY_JSON];
const AUTOSAVE_LABELS = {
  [AUTOSAVE_NONE]: "なし",
  [AUTOSAVE_MONTHLY_LOCAL]: "毎月（ローカル）",
  [AUTOSAVE_YEARLY_LOCAL]: "毎年1月（ローカル）",
  [AUTOSAVE_YEARLY_JSON]: "毎年1月（json）"
};

function normalizeAutosaveMode(value) {
  return AUTOSAVE_MODES.includes(value) ? value : AUTOSAVE_NONE;
}

export function loadGameSettings() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    stored = null;
  }
  return {
    difficulty: normalizeDifficulty(stored?.difficulty),
    autosave: normalizeAutosaveMode(stored?.autosave)
  };
}

function saveGameSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      difficulty: normalizeDifficulty(settings?.difficulty),
      autosave: normalizeAutosaveMode(settings?.autosave)
    }));
  } catch {
    // 保存できなくても遊べるので黙って続行する。
  }
}

/** 「はじめから」で使う難易度。 */
export function getStartingDifficulty() {
  return loadGameSettings().difficulty;
}

/** 月が進み切ったタイミングで呼び、設定に応じて自動保存する。 */
export function runAutosave(village) {
  const mode = loadGameSettings().autosave;
  if (mode === AUTOSAVE_NONE || !village) return;
  const isJanuary = Number(village.month) === 1;

  if (mode === AUTOSAVE_MONTHLY_LOCAL || (isJanuary && mode === AUTOSAVE_YEARLY_LOCAL)) {
    village.log("【オートセーブ】");
    saveVillageToLocalStorage(village);
    return;
  }
  if (isJanuary && mode === AUTOSAVE_YEARLY_JSON) {
    village.log("【オートセーブ】");
    saveVillageToJsonFile(village);
  }
}

/* -------------------------------------------
   設定画面（カード選択式）
------------------------------------------- */

export function closeGameSettingsModal() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
}

export function openGameSettingsModal() {
  if (typeof document === "undefined") return;
  closeGameSettingsModal();
  const editing = loadGameSettings();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "gs-overlay";

  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "gs-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", `${MODAL_ID}Title`);
  modal.innerHTML = `
    <h2 id="${MODAL_ID}Title" class="gs-title">設定</h2>
    <div class="gs-section">難易度</div>
    <p class="gs-note">「はじめから」で開始する時に適用されます。開始後は変更できません。</p>
    <div class="gs-cards">
      <div class="gs-card" data-gs-difficulty="${DIFFICULTY_NORMAL}" role="button" tabindex="0">
        <h4>ノーマル<span class="gs-badge">推奨</span></h4>
        <p>これまでどおりのバランスで遊べます。はじめての方はこちら。</p>
      </div>
      <div class="gs-card is-hard" data-gs-difficulty="${DIFFICULTY_HARD}" role="button" tabindex="0">
        <h4>難しい</h4>
        <p><b>襲撃が起こりやすくなります。</b>襲撃で体力0になった時に<b>重体になりやすく</b>、低確率で<b>危篤</b>や<b>後遺症</b>が発生します。</p>
      </div>
    </div>
    <div class="gs-section">オートセーブ</div>
    <div class="gs-seg">
      ${AUTOSAVE_MODES.map(mode =>
        `<span data-gs-autosave="${mode}" role="button" tabindex="0">${AUTOSAVE_LABELS[mode]}</span>`
      ).join("")}
    </div>
    <p class="gs-note">ローカル＝ブラウザ保存へ自動上書き。json＝毎年1月にセーブファイルを自動ダウンロード。</p>
    <div class="gs-buttons">
      <button type="button" data-gs-cancel>取り消す</button>
      <button type="button" class="gs-apply" data-gs-apply>適用する</button>
    </div>
  `;

  const refresh = () => {
    modal.querySelectorAll("[data-gs-difficulty]").forEach(card => {
      card.classList.toggle("is-selected", card.dataset.gsDifficulty === editing.difficulty);
    });
    modal.querySelectorAll("[data-gs-autosave]").forEach(seg => {
      seg.classList.toggle("is-on", seg.dataset.gsAutosave === editing.autosave);
    });
  };

  const bindPress = (element, onPress) => {
    element.addEventListener("click", onPress);
    element.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onPress();
      }
    });
  };

  modal.querySelectorAll("[data-gs-difficulty]").forEach(card => {
    bindPress(card, () => {
      editing.difficulty = normalizeDifficulty(card.dataset.gsDifficulty);
      refresh();
    });
  });
  modal.querySelectorAll("[data-gs-autosave]").forEach(seg => {
    bindPress(seg, () => {
      editing.autosave = normalizeAutosaveMode(seg.dataset.gsAutosave);
      refresh();
    });
  });
  modal.querySelector("[data-gs-cancel]").onclick = closeGameSettingsModal;
  overlay.onclick = closeGameSettingsModal;
  modal.querySelector("[data-gs-apply]").onclick = () => {
    saveGameSettings(editing);
    closeGameSettingsModal();
  };

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  refresh();
  modal.querySelector("[data-gs-apply]")?.focus();
}
