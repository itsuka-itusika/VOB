// bookOfTheDead.js
// 秘宝「死者の書」。妊娠・臨月の村人のお腹の子へ、過去帳に記された故人の魂を宿らせる。
// 故人は意識を保ったまま転生する。子は生まれた時から、故人の名前・精神性別・精神年齢・口調・
// 精神ステータス・精神特性・趣味を持つ（reproduction.js の出産処理で反映）。
// 顔・肉体の性別・身体特性・身体ステータスは、本来の赤子のまま。

import { formatDepartureSentence } from "./history.js";
import { getPortraitSpriteHtml } from "./data/portraitAtlas.js";
import { showMiracleResultModal } from "./miracles.js";
import { getVillagersIncludingSaltPillar } from "./domain/apocalypseRules.js";
import { updateUI } from "./ui.js";
import { openPersonStatusDetailModal } from "./personStatusDetail.js";

const OVERLAY_ID = "bookOfTheDeadOverlay";
const MODAL_ID = "bookOfTheDeadModal";
const MENTAL_STATS = ["int", "ind", "eth", "cou", "sexdr"];

// 来世へ持ち越さない精神特性。発達段階（精神年齢から成長処理が付け直す）、一時的な状態、村での立場を表すもの。
const NON_INHERITED_MIND_TRAITS = new Set([
  "無垢", "萌芽", "思春期", "未成熟",
  "心労", "抑鬱", "失望", "絶望", "狂乱",
  "訪問者", "襲撃者", "捕虜", "懐柔失敗", "勧誘失敗", "肖像", "ニケ"
]);

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

/** 死者の書を使える母体か。すでに転生先として選ばれたお腹には重ねない。 */
export function canUseBookOfTheDeadOn(person) {
  return !!person?.pregnancy && hasPregnancyTrait(person) && !person.pregnancy.reincarnation;
}

/** 故人がすでに転生しているか、転生を待つお腹があるか。 */
export function isDepartedReincarnated(village, departedId) {
  if (departedId == null) return true;
  const people = [
    ...getVillagersIncludingSaltPillar(village),
    ...(Array.isArray(village?.captives) ? village.captives : []),
    ...(Array.isArray(village?.visitors) ? village.visitors : []),
    ...(Array.isArray(village?.departedVillagers) ? village.departedVillagers : [])
  ];
  return people.some(person =>
    person?.reincarnatedFromId === departedId ||
    person?.pregnancy?.reincarnation?.departedId === departedId
  );
}

export function getReincarnationCandidates(village) {
  const departed = Array.isArray(village?.departedVillagers) ? village.departedVillagers : [];
  return departed.filter(person => !isDepartedReincarnated(village, person.id));
}

function pickMentalStats(source, fallback = null) {
  return Object.fromEntries(MENTAL_STATS.map(stat => {
    const value = Number(source?.[stat]);
    return [stat, Number.isFinite(value) ? value : (Number(fallback?.[stat]) || 0)];
  }));
}

/**
 * お腹の子へ渡す前世の精神。精神ステータスは特性補正を除いた基礎値と獲得値で持ち、
 * 生まれた時点で完成した値として使う。まだ育ち切っていない子どもの精神なら、伸びしろも引き継ぐ。
 */
function buildReincarnation(departed) {
  const mindPotential = departed.mindPotentialStats !== undefined ? departed.mindPotentialStats : departed.potentialStats;
  return {
    departedId: departed.id,
    name: departed.name,
    previousRace: departed.race || "人間",
    spiritAge: Number(departed.spiritAge) || 0,
    spiritSex: departed.spiritSex || departed.bodySex || "男",
    speechType: departed.speechType || "",
    hobby: departed.hobby || "",
    mentalBase: pickMentalStats(departed.baseStats, departed),
    mentalAcquired: pickMentalStats(departed.acquiredStatMods),
    mindPotentialStats: mindPotential ? pickMentalStats(mindPotential) : null,
    mindTraits: (Array.isArray(departed.mindTraits) ? departed.mindTraits : [])
      .filter(trait => !NON_INHERITED_MIND_TRAITS.has(trait)),
    childMindTrait: departed.childMindTrait || "",
    adultMindTraits: Array.isArray(departed.adultMindTraits) ? [...departed.adultMindTraits] : [],
    adultHobby: departed.adultHobby || "",
    adultMindReached: !!departed.adultMindReached
  };
}

function describeDeparted(person) {
  return `${person.race || "人間"}・肉体${person.bodySex || "-"}${person.bodyAge ?? "-"}歳／精神${person.spiritSex || "-"}${person.spiritAge ?? "-"}歳`;
}

export function closeBookOfTheDeadModal() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
}

function applyReincarnation(village, mother, departed) {
  mother.pregnancy.reincarnation = buildReincarnation(departed);
  village.log(`【秘宝】死者の書により、${mother.name}のお腹の子に${departed.name}の魂が宿りました`);
  showMiracleResultModal(
    village,
    "死者の書",
    `死者の書の頁がひとりでにめくれ、${departed.name}の名が光りました。`,
    [mother],
    { dialogue: { scene: "secretTreasure", key: "bookOfTheDead", context: { departedName: departed.name } } }
  );
  updateUI(village);
}

/**
 * 故人の一覧を開く。選んだ時だけ onChosen を呼ぶ。
 */
export function openBookOfTheDeadModal(village, mother, { onChosen = null } = {}) {
  if (typeof document === "undefined" || !mother) return;
  closeBookOfTheDeadModal();
  const departed = Array.isArray(village?.departedVillagers) ? [...village.departedVillagers].reverse() : [];
  const cards = departed.map((person, index) => {
    const taken = isDepartedReincarnated(village, person.id);
    return `
      <div class="gs-card rebirth-card fate-card">
        ${getPortraitSpriteHtml(person, { size: 56, alt: person.name })}
        <div class="rebirth-card-body">
          <h4>${escapeHtml(person.name)}</h4>
          <p>${escapeHtml(describeDeparted(person))}<br><span class="fate-picker-note">${escapeHtml(formatDepartureSentence(person.departure))}</span></p>
          <div class="fate-card-actions">
            <button type="button" class="rebirth-detail-button" data-book-detail="${index}">詳細</button>
            <button type="button" class="rebirth-detail-button" data-reincarnate="${index}" ${taken ? "disabled" : ""}>転生させる</button>
          </div>
          ${taken ? `<p class="fate-picker-note">転生済み</p>` : ""}
        </div>
      </div>
    `;
  }).join("");

  // 見た目は「はじめから（転生）」の選択画面と揃える。
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "gs-overlay";
  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "gs-modal silver-ledger-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", `${MODAL_ID}Title`);
  modal.innerHTML = `
    <h2 id="${MODAL_ID}Title" class="gs-title">死者の書</h2>
    <p class="gs-note">${escapeHtml(mother.name)}のお腹の子に宿す魂を選びます。</p>
    ${cards
      ? `<div class="rebirth-grid">${cards}</div>`
      : `<p class="gs-note">村を去った者は、まだ帳面に記されていない。</p>`}
    <div class="gs-buttons">
      <button type="button" data-close-book-of-the-dead>やめる</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  modal.querySelectorAll("[data-book-detail]").forEach(button => {
    button.addEventListener("click", () => {
      const person = departed[Number(button.dataset.bookDetail)];
      if (person) openPersonStatusDetailModal(person, { village });
    });
  });
  modal.querySelectorAll("[data-reincarnate]").forEach(button => {
    button.addEventListener("click", () => {
      const person = departed[Number(button.dataset.reincarnate)];
      if (!person || isDepartedReincarnated(village, person.id) || !canUseBookOfTheDeadOn(mother)) return;
      if (!window.confirm(`${mother.name}のお腹の子に、${person.name}の魂を宿しますか？`)) return;
      closeBookOfTheDeadModal();
      if (typeof onChosen === "function") onChosen();
      applyReincarnation(village, mother, person);
    });
  });
  modal.querySelector("[data-close-book-of-the-dead]").addEventListener("click", closeBookOfTheDeadModal);
  overlay.addEventListener("click", closeBookOfTheDeadModal);
}
