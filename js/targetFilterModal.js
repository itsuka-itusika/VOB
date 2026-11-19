// targetFilterModal.js
// 奇跡・秘宝の対象の「検索」画面。村人一覧と同じ条件で絞り込み、名前で探して選ぶ。
// 元のプルダウンの選択肢をそのまま並べ、選んだ値をプルダウンへ戻して change を送る。

import { applyPortraitToElement } from "./data/portraitAtlas.js";
import { openPersonStatusDetailModal } from "./personStatusDetail.js";
import { getPresentPersonMarks, getVillagerJobLabel, MARK_FILTER_ANY, matchesVillagerFilter } from "./domain/villagerFilter.js";
import { PERSON_MARK_CHANGE_EVENT } from "./personMarks.js";

const OVERLAY_ID = "targetFilterOverlay";
const MODAL_ID = "targetFilterModal";

/**
 * 「対象を選択:」などの見出し。右端に「検索」ボタンを置く。resolvePerson は選択肢の値から人物を引く。
 * village は各候補の「詳細」から開く詳細ステータスに渡す。
 */
export function createTargetLabelHeader(text, select, resolvePerson, village) {
  const header = document.createElement("div");
  header.className = "target-label-header";
  const span = document.createElement("span");
  span.textContent = text;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "target-filter-button";
  button.textContent = "検索";
  button.addEventListener("click", event => {
    event.preventDefault();
    openTargetFilterModal(select, resolvePerson, village);
  });
  header.append(span, button);
  return header;
}

// 開いている間だけ、マークの付け替えで一覧を書き直す。
let removeMarkChangeListener = null;

export function closeTargetFilterModal() {
  removeMarkChangeListener?.();
  removeMarkChangeListener = null;
  document.getElementById(OVERLAY_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
}

function createFilterSelect(label, allLabel, choices) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  [["", allLabel], ...choices].forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  });
  return select;
}

function createFilterCheckbox(text) {
  const label = document.createElement("label");
  const box = document.createElement("input");
  box.type = "checkbox";
  label.append(box, ` ${text}`);
  return { label, box };
}

function getSortedValues(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
}

export function openTargetFilterModal(select, resolvePerson, village = null) {
  if (typeof document === "undefined" || !select) return;
  closeTargetFilterModal();

  const entries = [...select.options]
    .filter(option => option.value !== "" && !option.disabled)
    .map(option => ({ value: option.value, option, person: resolvePerson(option.value) }))
    .filter(entry => entry.person);
  const people = entries.map(entry => entry.person);

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "target-filter-overlay";
  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "target-filter-modal silver-ledger-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const header = document.createElement("div");
  header.className = "modal-header";
  header.textContent = "対象の検索";

  // 村人一覧の絞り込みと同じ並び。選択肢は候補にいる人物から作る。
  const bodySex = createFilterSelect("肉体性別で絞り込み", "肉体：すべて", [["男", "肉体：男"], ["女", "肉体：女"]]);
  const spiritSex = createFilterSelect("精神性別で絞り込み", "精神：すべて", [["男", "精神：男"], ["女", "精神：女"]]);
  const race = createFilterSelect("種族で絞り込み", "種族：すべて",
    getSortedValues(people.map(person => person.race || "人間")).map(value => [value, value]));
  const job = createFilterSelect("仕事で絞り込み", "仕事：すべて",
    getSortedValues(people.map(getVillagerJobLabel)).map(value => [value, value]));
  const getMarkChoices = () =>
    [[MARK_FILTER_ANY, "マーク：あり"], ...getPresentPersonMarks(people).map(value => [value, `マーク：${value}`])];
  const mark = createFilterSelect("マークで絞り込み", "マーク：すべて", getMarkChoices());
  const trait = document.createElement("input");
  trait.type = "search";
  trait.placeholder = "特性を検索";
  trait.setAttribute("aria-label", "肉体特性・精神特性で絞り込み");
  const name = document.createElement("input");
  name.type = "search";
  name.placeholder = "名前を検索";
  name.setAttribute("aria-label", "名前で検索");
  const ailment = createFilterCheckbox("傷病");
  const lover = createFilterCheckbox("恋人あり");
  const married = createFilterCheckbox("既婚");
  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.textContent = "解除";
  const count = document.createElement("span");
  count.className = "target-filter-count";

  const filterRow = document.createElement("div");
  filterRow.className = "target-filter-controls";
  filterRow.append(bodySex, spiritSex, race, job, mark, trait, name, ailment.label, lover.label, married.label, clearButton, count);

  const list = document.createElement("div");
  list.className = "target-filter-list";

  const buttons = document.createElement("div");
  buttons.className = "modal-buttons";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "閉じる";
  buttons.appendChild(closeButton);

  modal.append(header, filterRow, list, buttons);
  document.body.append(overlay, modal);

  const pick = value => {
    select.value = value;
    select.dispatchEvent(new Event("change"));
    closeTargetFilterModal();
  };

  const render = () => {
    const criteria = {
      bodySex: bodySex.value,
      spiritSex: spiritSex.value,
      race: race.value,
      job: job.value,
      mark: mark.value,
      traitQuery: trait.value.trim(),
      ailment: ailment.box.checked,
      lover: lover.box.checked,
      married: married.box.checked
    };
    const nameQuery = name.value.trim();
    const shown = entries.filter(entry =>
      matchesVillagerFilter(entry.person, criteria) &&
      (!nameQuery || String(entry.person.name || "").includes(nameQuery)));
    count.textContent = `${shown.length}/${entries.length}人`;
    if (shown.length === 0) {
      list.textContent = "条件に合う対象がいません。";
      return;
    }
    list.replaceChildren(...shown.map(entry => {
      // 右端の「詳細」で詳細ステータスを開く。この画面は閉じずに上へ重ねる。
      const row = document.createElement("div");
      row.className = "target-filter-row";
      const detailButton = document.createElement("button");
      detailButton.type = "button";
      detailButton.className = "target-filter-detail-button";
      detailButton.textContent = "詳細";
      detailButton.addEventListener("click", () => openPersonStatusDetailModal(entry.person, { village }));
      const button = document.createElement("button");
      button.type = "button";
      button.className = `target-filter-choice${entry.value === select.value ? " is-selected" : ""}`;
      // 名前の左に小さな顔を添える。
      const portrait = document.createElement("span");
      portrait.className = "target-filter-portrait";
      applyPortraitToElement(portrait, entry.person);
      const text = document.createElement("span");
      // 表示名は元の選択肢から毎回読む。マークを付け替えると選択肢の側が書き直される。
      text.textContent = entry.option.textContent;
      button.append(portrait, text);
      button.addEventListener("click", () => pick(entry.value));
      row.append(button, detailButton);
      return row;
    }));
  };

  [bodySex, spiritSex, race, job, mark, ailment.box, lover.box, married.box]
    .forEach(control => control.addEventListener("change", render));
  [trait, name].forEach(input => input.addEventListener("input", render));
  clearButton.addEventListener("click", () => {
    [bodySex, spiritSex, race, job, mark].forEach(control => { control.value = ""; });
    [trait, name].forEach(input => { input.value = ""; });
    [ailment.box, lover.box, married.box].forEach(box => { box.checked = false; });
    render();
  });
  closeButton.addEventListener("click", closeTargetFilterModal);
  overlay.addEventListener("click", closeTargetFilterModal);

  // マークの絞り込みの選択肢も、今いる人物のマークで作り直す。選んでいた値は残せる時だけ残す。
  const onMarkChange = () => {
    const selected = mark.value;
    const fresh = createFilterSelect("", "マーク：すべて", getMarkChoices());
    mark.replaceChildren(...fresh.options);
    mark.value = [...mark.options].some(option => option.value === selected) ? selected : "";
    render();
  };
  document.addEventListener(PERSON_MARK_CHANGE_EVENT, onMarkChange);
  removeMarkChangeListener = () => document.removeEventListener(PERSON_MARK_CHANGE_EVENT, onMarkChange);

  render();
  name.focus();
}
