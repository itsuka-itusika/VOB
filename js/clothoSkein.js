// clothoSkein.js
// 秘宝「クロトの糸束」。妊娠・臨月の村人のお腹の子の性別と、双子かどうかを定める選択画面。
// 胎児の書き換えは reproduction.js の applyClothoFate が行う。

import { applyClothoFate, TWIN_TYPE_FRATERNAL, TWIN_TYPE_IDENTICAL } from "./reproduction.js";
import { showMiracleResultModal } from "./miracles.js";
import { updateUI } from "./ui.js";

const OVERLAY_ID = "clothoSkeinOverlay";
const MODAL_ID = "clothoSkeinModal";

const BIRTH_CHOICES = [
  { value: "", label: "通常" },
  { value: TWIN_TYPE_IDENTICAL, label: "一卵性双生児" },
  { value: TWIN_TYPE_FRATERNAL, label: "二卵性双生児" }
];
const SEX_CHOICES = [
  { value: "男", label: "男" },
  { value: "女", label: "女" }
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function hasPregnancyTrait(person) {
  const bodyTraits = Array.isArray(person?.bodyTraits) ? person.bodyTraits : [];
  return bodyTraits.includes("妊娠") || bodyTraits.includes("臨月");
}

/** クロトの糸束を使える母体か。 */
export function canUseClothoSkeinOn(person) {
  return !!person?.pregnancy && hasPregnancyTrait(person);
}

export function closeClothoSkeinModal() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
}

/** 結果とセリフで使う呼び方（男の子／女の子の双子 など）。 */
function getChildLabel(childSex, twinType) {
  const child = childSex === "男" ? "男の子" : "女の子";
  return twinType ? `${child}の双子` : child;
}

function getFateText(childSex, twinType) {
  const child = childSex === "男" ? "男の子" : "女の子";
  if (twinType === TWIN_TYPE_IDENTICAL) return `一卵性の双子の${child}`;
  if (twinType === TWIN_TYPE_FRATERNAL) return `二卵性の双子の${child}`;
  return child;
}

function renderChoiceGroup(name, legend, choices, checkedValue) {
  return `
    <fieldset class="clotho-choice-group">
      <legend>${legend}</legend>
      ${choices.map(choice => `
        <label><input type="radio" name="${name}" value="${choice.value}" ${choice.value === checkedValue ? "checked" : ""}> ${choice.label}</label>
      `).join("")}
    </fieldset>
  `;
}

function applyFate(village, mother, childSex, twinType) {
  if (!applyClothoFate(mother, { childSex, twinType })) return false;
  const fateText = getFateText(childSex, twinType);
  village.log(`【秘宝】クロトの糸束により、${mother.name}のお腹の子は${fateText}として生まれる定めとなりました`);
  showMiracleResultModal(
    village,
    "クロトの糸束",
    `糸束がほどけて${mother.name}のお腹へ吸い込まれ、${fateText}として生まれる定めが紡がれました。`,
    [mother],
    { dialogue: { scene: "secretTreasure", key: "clothoSkein", context: { childLabel: getChildLabel(childSex, twinType) } } }
  );
  updateUI(village);
  return true;
}

/**
 * 生まれ方と性別を選ぶ画面を開く。定めた時だけ onChosen を呼ぶ。
 * 双子かどうかは出産まで伏せるため、いまの胎児の様子は見せず、初期値は「通常」にする。
 */
export function openClothoSkeinModal(village, mother, { onChosen = null } = {}) {
  if (typeof document === "undefined" || !canUseClothoSkeinOn(mother)) return;
  closeClothoSkeinModal();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "gs-overlay";
  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "gs-modal silver-ledger-modal clotho-skein-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", `${MODAL_ID}Title`);
  modal.innerHTML = `
    <h2 id="${MODAL_ID}Title" class="gs-title">クロトの糸束</h2>
    <p class="gs-note">${escapeHtml(mother.name)}のお腹の子の生まれ方と性別を定めます。</p>
    ${renderChoiceGroup("clothoBirth", "生まれ方", BIRTH_CHOICES, "")}
    ${renderChoiceGroup("clothoSex", "性別", SEX_CHOICES, null)}
    <div class="gs-buttons">
      <button type="button" data-clotho-confirm disabled>定める</button>
      <button type="button" data-clotho-cancel>やめる</button>
    </div>
  `;
  document.body.append(overlay, modal);

  const confirmButton = modal.querySelector("[data-clotho-confirm]");
  const getChecked = name => modal.querySelector(`input[name="${name}"]:checked`)?.value ?? null;
  modal.querySelectorAll('input[name="clothoSex"]').forEach(input => {
    input.addEventListener("change", () => { confirmButton.disabled = !getChecked("clothoSex"); });
  });
  confirmButton.addEventListener("click", () => {
    const childSex = getChecked("clothoSex");
    const twinType = getChecked("clothoBirth") || "";
    if (!childSex || !canUseClothoSkeinOn(mother)) return;
    closeClothoSkeinModal();
    if (!applyFate(village, mother, childSex, twinType)) return;
    if (typeof onChosen === "function") onChosen();
  });
  modal.querySelector("[data-clotho-cancel]").addEventListener("click", closeClothoSkeinModal);
  overlay.addEventListener("click", closeClothoSkeinModal);
}
