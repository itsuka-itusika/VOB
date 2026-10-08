// familyTree.js
// 家系図モーダル。本人を中心に、祖父母・父母・本人（きょうだい・配偶者）・子を並べる。
// 家系は「母・父・子」の関係を、過去帳も含めて createLineageIndex でたどる。
// 年齢は顔グラに合わせて肉体年齢で表示し、精神年齢が違う人だけ「肉体/精神」で並べる。
// 顔を押すとその人物の個人記録（去った者は過去帳の記録）を開く。

import { getPortraitSpriteHtml } from "./data/portraitAtlas.js";
import { openPersonalHistoryModal } from "./history.js";
import { createLineageIndex, getRelationshipEntries } from "./relationships.js";

// 図に並べる人数。超えたぶんは「他N人」から一覧で開く。
const SPOUSE_LIMIT = 2;
const SIBLING_LIMIT = 2;
const CHILD_LIMIT = 4;
const SPOUSE_PREFIXES = new Set(["夫", "妻"]);
// 過去帳の去り方のうち死去にあたるもの。ほかは村を離れただけとして扱う。
const DEATH_REASONS = new Set(["老衰", "重体の悪化", "光の柱への曝露"]);
const LIST_TITLES = {
  spouses: "配偶者",
  fullSiblings: "きょうだい",
  halfSiblings: "異母・異父きょうだい",
  children: "子"
};

// 開いている家系図の村・中心人物・戻り先。
let current = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]
  ));
}

// 今の村人を優先し、去った者は過去帳の姿で引く。
function createPersonIndex(village) {
  const people = new Map();
  [...(village?.departedVillagers || []), ...(village?.villagers || [])].forEach(person => {
    if (person?.id != null) people.set(person.id, person);
  });
  return people;
}

// 存命を先に、同じなら生まれの早い（IDの小さい）順に並べる。
function compareByLifeAndBirth(a, b) {
  return Number(Boolean(a.departure)) - Number(Boolean(b.departure)) || a.id - b.id;
}

function collectFamily(village, person, people) {
  const lineage = createLineageIndex(village);
  const children = new Map();
  lineage.parents.forEach((parentIds, childId) => parentIds.forEach(parentId => {
    if (!children.has(parentId)) children.set(parentId, new Set());
    children.get(parentId).add(childId);
  }));
  const resolve = ids => [...(ids || [])].map(id => people.get(id)).filter(Boolean);
  // 父を左、母を右に置く。続柄は出生時の肉体で付くため、肉体の性別で並べる。
  const parentsOf = target => resolve(lineage.parents.get(target.id))
    .sort((a, b) => Number(a.bodySex !== "男") - Number(b.bodySex !== "男") || a.id - b.id);
  const childrenOf = target => resolve(children.get(target.id));

  const parents = parentsOf(person);
  const parentIds = new Set(parents.map(parent => parent.id));
  const siblings = [...new Set(parents.flatMap(childrenOf))].filter(sibling => sibling.id !== person.id);
  const isFullSibling = sibling => {
    const ids = parentsOf(sibling).map(parent => parent.id);
    return ids.length === parentIds.size && ids.every(id => parentIds.has(id));
  };
  const childList = childrenOf(person).sort(compareByLifeAndBirth);

  // 先に去った配偶者は本人側の関係から消えるため、過去帳に残る関係から拾い直す。
  const spouseIds = new Set(getRelationshipEntries(person)
    .filter(entry => SPOUSE_PREFIXES.has(entry.prefix) && entry.targetId != null)
    .map(entry => entry.targetId));
  (village?.departedVillagers || []).forEach(departed => {
    if (getRelationshipEntries(departed).some(entry => SPOUSE_PREFIXES.has(entry.prefix) && entry.targetId === person.id)) {
      spouseIds.add(departed.id);
    }
  });
  spouseIds.delete(person.id);
  // 重婚では、本人との子が多い配偶者から並べる。
  const sharedChildCount = spouse => childList.filter(child => lineage.parents.get(child.id)?.has(spouse.id)).length;
  const spouses = resolve(spouseIds)
    .sort((a, b) => sharedChildCount(b) - sharedChildCount(a) || compareByLifeAndBirth(a, b));

  // 肉体交換などで家系と食い違う遺伝上の親だけを添える。
  const geneticParents = getRelationshipEntries(person)
    .filter(entry => (entry.prefix === "遺伝母" || entry.prefix === "遺伝父") && !parentIds.has(entry.targetId))
    .map(entry => ({
      label: entry.prefix === "遺伝母" ? "母" : "父",
      person: people.get(entry.targetId) || null,
      name: entry.targetName || "不明"
    }));

  return {
    parents,
    grandparents: parents.map(parentsOf),
    spouses,
    fullSiblings: siblings.filter(isFullSibling).sort(compareByLifeAndBirth),
    halfSiblings: siblings.filter(sibling => !isFullSibling(sibling)).sort(compareByLifeAndBirth),
    children: childList,
    geneticParents
  };
}

// 年齢と去り方はそれぞれ途中で折り返さず、1行に収まらない時は去り方だけを次の行へ送る。
function renderAgeMeta(person) {
  const bodyAge = `${person.bodyAge ?? "?"}歳`;
  const spiritAge = person.spiritAge ?? person.bodyAge;
  const parts = [spiritAge === person.bodyAge ? bodyAge : `${bodyAge}/${spiritAge}歳`];
  if (person.departure) parts.push(DEATH_REASONS.has(person.departure.reason) ? "没" : "離村");
  return `<span class="family-tree-meta">${parts.map(part => `<span>${escapeHtml(part)}</span>`).join(" ")}</span>`;
}

function renderCard(person, node, { self = false } = {}) {
  const className = `family-tree-card${self ? " is-self" : ""}${person.departure ? " is-departed" : ""}`;
  const body = `
    ${getPortraitSpriteHtml(person, { alt: person.name })}
    <span class="family-tree-name">${escapeHtml(person.name)}</span>
    ${renderAgeMeta(person)}`;
  return `<button type="button" class="${className}" data-family-tree-node="${node}" data-family-tree-person="${person.id}" title="${escapeHtml(person.name)}の個人記録を開く">${body}</button>`;
}

function renderMarriage(node = "") {
  return `<span class="family-tree-marriage"${node ? ` data-family-tree-node="${node}"` : ""} aria-label="夫婦">═</span>`;
}

function renderCouple(people, key) {
  if (people.length === 0) return "";
  return `<div class="family-tree-couple">${people.map((person, index) => renderCard(person, `${key}-${index}`)).join(renderMarriage(`${key}-m`))}</div>`;
}

function renderMore(people, limit, kind, node) {
  const rest = people.length - limit;
  if (rest <= 0) return "";
  return `<button type="button" class="family-tree-more" data-family-tree-node="${node}" data-family-tree-list="${kind}">
    <span>${LIST_TITLES[kind]}</span><b>他${rest}人</b><span>一覧 ▾</span>
  </button>`;
}

function renderRow(label, left, center, right) {
  return `
    <div class="family-tree-row">
      <span class="family-tree-gen-label">${label}</span>
      <div class="family-tree-side is-left">${left}</div>
      <div class="family-tree-center">${center}</div>
      <div class="family-tree-side is-right">${right}</div>
    </div>`;
}

function renderTree(person, family) {
  const { parents, grandparents, spouses, fullSiblings, halfSiblings, children } = family;
  const empty = text => `<span class="family-tree-empty">${text}</span>`;

  // 親が2人なら左右へ、1人なら本人の真上へ置き、祖父母はそれぞれの親の上に並べる。
  const grandparentRow = !grandparents.some(list => list.length > 0)
    ? renderRow("祖父母", "", empty("記録なし"), "")
    : parents.length >= 2
      ? renderRow("祖父母", renderCouple(grandparents[0], "gp0"), "", renderCouple(grandparents[1], "gp1"))
      : renderRow("祖父母", "", renderCouple(grandparents[0], "gp0"), "");
  const parentRow = parents.length === 0
    ? renderRow("父母", "", empty("記録なし"), "")
    : parents.length === 1
      ? renderRow("父母", "", renderCard(parents[0], "parent0"), "")
      : renderRow("父母", renderCard(parents[0], "parent0"), renderMarriage("parents-m"), renderCard(parents[1], "parent1"));

  // きょうだいは本人に近い側から並べるため、左側は逆順にする。
  const siblingCards = [
    renderMore(fullSiblings, SIBLING_LIMIT, "fullSiblings", "sib-more"),
    ...fullSiblings.slice(0, SIBLING_LIMIT).map((sibling, index) => renderCard(sibling, `sib${index}`)).reverse()
  ].join("");
  const halfChip = halfSiblings.length > 0
    ? `<button type="button" class="family-tree-half" data-family-tree-list="halfSiblings">異母・異父きょうだい ${halfSiblings.length}人 ▾</button>`
    : "";
  const siblingSide = siblingCards || halfChip
    ? `<div class="family-tree-siblings"><div class="family-tree-sibling-cards">${siblingCards}</div>${halfChip}</div>`
    : "";
  const spouseSide = spouses.length > 0
    ? `${renderMarriage()}${spouses.slice(0, SPOUSE_LIMIT).map((spouse, index) => renderCard(spouse, `spouse${index}`)).join("")}${renderMore(spouses, SPOUSE_LIMIT, "spouses", "spouse-more")}`
    : "";
  const childCards = children.length > 0
    ? `${children.slice(0, CHILD_LIMIT).map((child, index) => renderCard(child, `kid${index}`)).join("")}${renderMore(children, CHILD_LIMIT, "children", "kid-more")}`
    : empty("なし");

  return `
    ${grandparentRow}
    ${parentRow}
    ${renderRow("本人", siblingSide, renderCard(person, "self", { self: true }), spouseSide)}
    <div class="family-tree-row">
      <span class="family-tree-gen-label">子</span>
      <div class="family-tree-children">${childCards}</div>
    </div>`;
}

function renderGeneticNote(family) {
  if (family.geneticParents.length === 0) return "";
  const parents = family.geneticParents.map(({ label, person, name }) => `${label} ${person
    ? `<button type="button" class="family-tree-link" data-family-tree-person="${person.id}">${escapeHtml(person.name)}</button>`
    : escapeHtml(name)}`);
  return `<p class="family-tree-note">遺伝上の親：${parents.join("／")}</p>`;
}

function renderPicker(village, personId) {
  const seen = new Set();
  const options = people => people
    .filter(person => person?.id != null && !seen.has(person.id) && seen.add(person.id))
    .map(person => `<option value="${person.id}"${person.id === personId ? " selected" : ""}>${escapeHtml(person.name)}</option>`)
    .join("");
  const villagerOptions = options(village?.villagers || []);
  // 過去帳は新しく去った者から並べる。
  const departedOptions = options([...(village?.departedVillagers || [])].reverse());
  return `
    <label class="family-tree-picker">人物
      <select data-family-tree-select>
        <optgroup label="村人">${villagerOptions}</optgroup>
        ${departedOptions ? `<optgroup label="過去帳">${departedOptions}</optgroup>` : ""}
      </select>
    </label>`;
}

function toggleList(content, family, kind) {
  const panel = content.querySelector("[data-family-tree-list-panel]");
  if (!panel) return;
  if (!panel.hidden && panel.dataset.kind === kind) {
    panel.hidden = true;
    return;
  }
  const people = family[kind] || [];
  panel.dataset.kind = kind;
  panel.innerHTML = `
    <h4 class="family-tree-list-title">${LIST_TITLES[kind]}（${people.length}人）</h4>
    <div class="family-tree-list-items">
      ${people.map(person => `
        <button type="button" class="family-tree-list-person${person.departure ? " is-departed" : ""}" data-family-tree-person="${person.id}" title="${escapeHtml(person.name)}の個人記録を開く">
          ${getPortraitSpriteHtml(person, { alt: person.name })}
          <span class="family-tree-name">${escapeHtml(person.name)}</span>
          ${renderAgeMeta(person)}
        </button>`).join("")}
    </div>`;
  panel.hidden = false;
  panel.scrollIntoView({ block: "nearest" });
}

// 線はカードを並べた後に位置を測って引く。開き直しや画面幅の変化のたびに呼ぶ。
function layoutFamilyTree(content) {
  const scroller = content.querySelector(".family-tree-scroll");
  const canvas = content.querySelector(".family-tree-canvas");
  const svg = content.querySelector(".family-tree-lines");
  if (!scroller || !canvas || !svg) return;

  // 左右の列幅が違うと本人の列が中央からずれるため、広い側に合わせた幅を取る。
  const widest = selector => Math.max(0, ...[...canvas.querySelectorAll(selector)].map(element => element.offsetWidth));
  const canvasStyle = getComputedStyle(canvas);
  const padding = parseFloat(canvasStyle.paddingLeft) + parseFloat(canvasStyle.paddingRight);
  canvas.style.minWidth = `max(100%, ${widest(".family-tree-side") * 2 + widest(".family-tree-center") + padding}px)`;

  const base = canvas.getBoundingClientRect();
  const box = node => {
    const element = canvas.querySelector(`[data-family-tree-node="${node}"]`);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left - base.left + rect.width / 2,
      top: rect.top - base.top,
      bottom: rect.bottom - base.top,
      middle: rect.top - base.top + rect.height / 2
    };
  };
  // 夫婦なら ═ の真下から、1人ならその人のカードの下から線を下ろす。
  const origin = (marriageNode, cardNode) => {
    const marriage = box(marriageNode);
    return marriage ? { x: marriage.x, bottom: marriage.middle + 8 } : box(cardNode);
  };
  const paths = [];
  const connect = (from, targets) => {
    targets = targets.filter(Boolean);
    if (!from || targets.length === 0) return;
    const busY = (from.bottom + Math.min(...targets.map(target => target.top))) / 2;
    const xs = [from.x, ...targets.map(target => target.x)];
    paths.push(`M${from.x},${from.bottom}V${busY}`, `M${Math.min(...xs)},${busY}H${Math.max(...xs)}`);
    targets.forEach(target => paths.push(`M${target.x},${busY}V${target.top}`));
  };
  connect(origin("gp0-m", "gp0-0"), [box("parent0")]);
  connect(origin("gp1-m", "gp1-0"), [box("parent1")]);
  connect(origin("parents-m", "parent0"), ["self", "sib0", "sib1", "sib-more"].map(box));
  connect(box("self"), ["kid0", "kid1", "kid2", "kid3", "kid-more"].map(box));
  svg.innerHTML = paths.map(d => `<path d="${d}"/>`).join("");

  // 横に収まらない家系図は、本人が見える位置まで寄せる。
  const self = box("self");
  if (self) scroller.scrollLeft = Math.max(0, self.x - scroller.clientWidth / 2);
}

function renderFamilyTree() {
  const title = document.getElementById("familyTreeTitle");
  const content = document.getElementById("familyTreeContent");
  const modal = document.getElementById("familyTreeModal");
  if (!current || !title || !content || !modal) return;

  const people = createPersonIndex(current.village);
  const person = people.get(current.personId) || current.fallbackPerson;
  const family = collectFamily(current.village, person, people);
  title.textContent = `${person.name}の家系図`;
  content.innerHTML = `
    ${renderPicker(current.village, person.id)}
    <div class="family-tree-scroll">
      <div class="family-tree-canvas">
        <svg class="family-tree-lines" aria-hidden="true"></svg>
        ${renderTree(person, family)}
      </div>
    </div>
    ${renderGeneticNote(family)}
    <div class="family-tree-legend">
      <span>═ 夫婦</span><span>線：親子</span><span>灰色：過去帳の人物</span><span>顔を押すとその人物の個人記録を開く</span>
    </div>
    <div class="family-tree-list" data-family-tree-list-panel hidden></div>`;

  content.onclick = event => {
    const personButton = event.target.closest("[data-family-tree-person]");
    if (personButton) {
      openPersonalRecord(Number(personButton.dataset.familyTreePerson));
      return;
    }
    const listButton = event.target.closest("[data-family-tree-list]");
    if (listButton) toggleList(content, family, listButton.dataset.familyTreeList);
  };
  const select = content.querySelector("[data-family-tree-select]");
  if (select) select.onchange = () => showFamilyTreeOf(Number(select.value));

  modal.scrollTop = 0;
  layoutFamilyTree(content);
}

// 家系図を閉じて、その人物の個人記録を開く。去った者は過去帳の記録として開く。
function openPersonalRecord(personId) {
  if (!current) return;
  const { village } = current;
  const person = createPersonIndex(village).get(personId);
  if (!person) return;
  closeFamilyTreeModal();
  openPersonalHistoryModal(village, person, { archived: Boolean(person.departure) });
}

function showFamilyTreeOf(personId) {
  if (!current) return;
  current.personId = personId;
  renderFamilyTree();
}

export function openFamilyTreeModal(village, person, { onBack = null } = {}) {
  const overlay = document.getElementById("familyTreeOverlay");
  const modal = document.getElementById("familyTreeModal");
  if (!overlay || !modal || !village || !person) return;
  current = { village, personId: person.id, fallbackPerson: person };

  // 台帳から開いたときだけ、台帳へ戻るボタンを出す。
  const backButton = modal.querySelector("[data-family-tree-back]");
  if (backButton) {
    backButton.hidden = typeof onBack !== "function";
    backButton.onclick = () => {
      closeFamilyTreeModal();
      if (typeof onBack === "function") onBack();
    };
  }

  overlay.style.display = "block";
  modal.style.display = "block";
  renderFamilyTree();
}

export function closeFamilyTreeModal() {
  const overlay = document.getElementById("familyTreeOverlay");
  const modal = document.getElementById("familyTreeModal");
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
  current = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    const content = document.getElementById("familyTreeContent");
    if (current && content) layoutFamilyTree(content);
  });
}
