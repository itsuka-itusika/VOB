// personMarks.js
// 人物に付けるマーク（⭐や♥などの目印）。会話モーダルと個人記録の「マーク」ボタンから付け外しする。
// マークは人物の mark に保存し、会話・個人記録・詳細ステータスの名前の横と、奇跡・秘宝の対象の選択肢に出す。

import { PERSON_MARK_ALIASES, PERSON_MARKS } from "./data/personMarkData.js";

const OVERLAY_ID = "personMarkOverlay";
const MODAL_ID = "personMarkModal";

/** 付いているマーク。以前の文字の記号は絵文字に読み替え、一覧に無い値は出さない。 */
export function getPersonMark(person) {
  const raw = String(person?.mark || "");
  const mark = PERSON_MARK_ALIASES[raw] || raw;
  return PERSON_MARKS.includes(mark) ? mark : "";
}

/** 「〇〇の記録」の見出しを書き、マークがあれば右に添える。 */
export function renderRecordTitle(element, name, person) {
  if (!element) return;
  element.textContent = `${name}の記録`;
  const mark = getPersonMark(person);
  if (!mark) return;
  const span = document.createElement("span");
  span.className = "person-mark";
  span.textContent = mark;
  element.appendChild(span);
}

export function closePersonMarkPicker() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
}

/** マークを選ぶ小さな画面。付け替えた時だけ onChange を呼ぶ。 */
export function openPersonMarkPicker(person, { onChange = null } = {}) {
  if (typeof document === "undefined" || !person) return;
  closePersonMarkPicker();
  const current = getPersonMark(person);

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "person-mark-overlay";
  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "person-mark-modal silver-ledger-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="modal-header"></div>
    <div class="person-mark-grid">
      ${PERSON_MARKS.map(mark => `
        <button type="button" class="person-mark-choice${mark === current ? " is-selected" : ""}" data-person-mark="${mark}" aria-pressed="${mark === current}">${mark}</button>
      `).join("")}
    </div>
    <div class="modal-buttons">
      <button type="button" data-clear-person-mark ${current ? "" : "disabled"}>外す</button>
      <button type="button" data-close-person-mark>閉じる</button>
    </div>
  `;
  modal.querySelector(".modal-header").textContent = `${person.name}のマーク`;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  const apply = mark => {
    person.mark = mark;
    closePersonMarkPicker();
    if (typeof onChange === "function") onChange();
  };
  modal.querySelectorAll("[data-person-mark]").forEach(button => {
    button.addEventListener("click", () => apply(button.dataset.personMark));
  });
  modal.querySelector("[data-clear-person-mark]").addEventListener("click", () => apply(""));
  modal.querySelector("[data-close-person-mark]").addEventListener("click", closePersonMarkPicker);
  overlay.addEventListener("click", closePersonMarkPicker);
}
