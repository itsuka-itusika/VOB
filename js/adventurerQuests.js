import { addStoredResource } from "./domain/resourceLimits.js";
import { getPortraitSpriteHtml } from "./data/portraitAtlas.js";
import { grantSecretTreasure, pickRandomSecretTreasureDefinitions } from "./secretTreasures.js";
import {
  ADVENTURER_QUEST_ACCEPTED_TRAIT,
  ADVENTURER_QUEST_BASE_SUCCESS_RATES,
  ADVENTURER_QUEST_COST,
  ADVENTURER_QUEST_DURATION_MONTHS,
  ADVENTURER_QUEST_STAT_LABELS,
  ADVENTURER_QUEST_TEMPLATES
} from "./data/adventurerQuestData.js";

const QUEST_OFFER_COUNT = 4;
const QUEST_FAILURE_MATERIALS_MIN = 20;
const QUEST_FAILURE_MATERIALS_MAX = 49;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getMonthIndex(year, month) {
  return Math.floor(Number(year) || 0) * 12 + Math.max(0, Math.floor(Number(month) || 1) - 1);
}

function getYearMonthFromIndex(monthIndex) {
  const normalized = Math.max(0, Math.floor(Number(monthIndex) || 0));
  return {
    year: Math.floor(normalized / 12),
    month: normalized % 12 + 1
  };
}

function getQuestTemplate(offer) {
  return ADVENTURER_QUEST_TEMPLATES.find(template => template.id === offer?.templateId) || null;
}

function getQuestBaseSuccessRate(offer) {
  return ADVENTURER_QUEST_BASE_SUCCESS_RATES[offer?.treasureId] ?? 60;
}

export function isAdventurerVisitor(character) {
  const visitorType = String(character?.name || "").match(/^(.+)の/)?.[1] || "";
  return (character?.job === "冒険者" || visitorType === "冒険者")
    && Array.isArray(character.mindTraits)
    && character.mindTraits.includes("訪問者");
}

export function hasAcceptedAdventurerQuest(character) {
  return Array.isArray(character?.mindTraits)
    && character.mindTraits.includes(ADVENTURER_QUEST_ACCEPTED_TRAIT);
}

export function ensureAdventurerQuestOffers(adventurer) {
  if (Array.isArray(adventurer?.adventurerQuestOffers) && adventurer.adventurerQuestOffers.length === QUEST_OFFER_COUNT) {
    return adventurer.adventurerQuestOffers;
  }

  const templates = shuffled(ADVENTURER_QUEST_TEMPLATES).slice(0, QUEST_OFFER_COUNT);
  const treasures = pickRandomSecretTreasureDefinitions(QUEST_OFFER_COUNT);
  adventurer.adventurerQuestOffers = templates.map((template, index) => ({
    id: `${template.id}:${treasures[index].id}`,
    templateId: template.id,
    treasureId: treasures[index].id,
    treasureName: treasures[index].name
  }));
  return adventurer.adventurerQuestOffers;
}

export function getAdventurerQuestSuccessRate(adventurer, offer) {
  const template = getQuestTemplate(offer);
  if (!template) return 5;
  const bodyStat = Math.max(0, Number(adventurer?.[template.bodyStat]) || 0);
  const mindStat = Math.max(0, Number(adventurer?.[template.mindStat]) || 0);
  const rate = getQuestBaseSuccessRate(offer) * (bodyStat / 20) * (mindStat / 20);
  return Math.max(5, Math.min(95, Math.floor(rate)));
}

function isOfferAvailable(adventurer, offer) {
  const template = getQuestTemplate(offer);
  if (!template) return false;
  return !template.requiredBodySex || adventurer.bodySex === template.requiredBodySex;
}

function acceptAdventurerQuest(village, adventurer, offer) {
  if (!Array.isArray(village?.visitors) || !village.visitors.includes(adventurer)) return false;
  if (!isAdventurerVisitor(adventurer) || hasAcceptedAdventurerQuest(adventurer)) return false;
  if (!isOfferAvailable(adventurer, offer) || village.funds < ADVENTURER_QUEST_COST) return false;

  const template = getQuestTemplate(offer);
  const successRate = getAdventurerQuestSuccessRate(adventurer, offer);
  const acceptedMonthIndex = getMonthIndex(village.year, village.month);
  const dueMonthIndex = acceptedMonthIndex + ADVENTURER_QUEST_DURATION_MONTHS;

  village.funds -= ADVENTURER_QUEST_COST;
  adventurer.mindTraits.push(ADVENTURER_QUEST_ACCEPTED_TRAIT);
  adventurer.adventurerQuestOffers = null;
  village.visitors = village.visitors.filter(person => person !== adventurer);
  if (!Array.isArray(village.activeAdventurerQuests)) village.activeAdventurerQuests = [];
  village.activeAdventurerQuests.push({
    adventurer,
    templateId: template.id,
    questTitle: template.title,
    treasureId: offer.treasureId,
    treasureName: offer.treasureName,
    successRate,
    acceptedMonthIndex,
    dueMonthIndex
  });

  const due = getYearMonthFromIndex(dueMonthIndex);
  village.log(`【冒険者クエスト】${adventurer.name}へ「${template.title}」を依頼しました。資金-${ADVENTURER_QUEST_COST}、帰還予定${due.year}年${due.month}月、成功率${successRate}%`);
  return true;
}

function removeQuestModal() {
  document.getElementById("adventurerQuestOverlay")?.remove();
  document.getElementById("adventurerQuestModal")?.remove();
}

export function openAdventurerQuestModal(village, adventurer, { onAccepted } = {}) {
  if (typeof document === "undefined" || !isAdventurerVisitor(adventurer)) return;
  const offers = ensureAdventurerQuestOffers(adventurer);
  removeQuestModal();

  const overlay = document.createElement("div");
  overlay.id = "adventurerQuestOverlay";
  overlay.className = "event-modal-overlay";

  const modal = document.createElement("div");
  modal.id = "adventurerQuestModal";
  modal.className = "event-modal adventurer-quest-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const offerHtml = offers.map((offer, index) => {
    const template = getQuestTemplate(offer);
    const bodyLabel = ADVENTURER_QUEST_STAT_LABELS[template.bodyStat];
    const mindLabel = ADVENTURER_QUEST_STAT_LABELS[template.mindStat];
    const bodyValue = Math.max(0, Number(adventurer[template.bodyStat]) || 0);
    const mindValue = Math.max(0, Number(adventurer[template.mindStat]) || 0);
    const successRate = getAdventurerQuestSuccessRate(adventurer, offer);
    const sexBlocked = !isOfferAvailable(adventurer, offer);
    const fundsBlocked = village.funds < ADVENTURER_QUEST_COST;
    const disabledReason = sexBlocked ? "身体性別が女性の冒険者限定" : (fundsBlocked ? "資金が不足しています" : "");
    return `
      <section class="adventurer-quest-card${sexBlocked ? " is-disabled" : ""}">
        <h4>${index + 1}. ${escapeHtml(template.title)}</h4>
        <p>${escapeHtml(template.description)}</p>
        <dl>
          <div><dt>必要資金</dt><dd>${ADVENTURER_QUEST_COST}</dd></div>
          <div><dt>期間</dt><dd>${ADVENTURER_QUEST_DURATION_MONTHS}か月</dd></div>
          <div><dt>獲得報酬</dt><dd>秘宝「${escapeHtml(offer.treasureName)}」</dd></div>
          <div><dt>参照能力</dt><dd>${bodyLabel}${bodyValue} × ${mindLabel}${mindValue}</dd></div>
          <div><dt>基礎成功率</dt><dd>${getQuestBaseSuccessRate(offer)}%</dd></div>
          <div><dt>成功率</dt><dd>${successRate}%</dd></div>
        </dl>
        ${template.requiredBodySex ? `<p class="adventurer-quest-requirement">身体性別: ${template.requiredBodySex} 限定</p>` : ""}
        <button type="button" data-adventurer-quest-index="${index}" ${sexBlocked || fundsBlocked ? "disabled" : ""}>このクエストを依頼する</button>
        ${disabledReason ? `<p class="adventurer-quest-disabled-reason">${escapeHtml(disabledReason)}</p>` : ""}
      </section>
    `;
  }).join("");

  modal.innerHTML = `
    <div class="event-modal-body">
      <h3>${escapeHtml(adventurer.name)}へのクエスト依頼</h3>
      <p>提示された4件は、この訪問中は変わりません。依頼すると冒険者は出発し、6か月後の月初に帰還します。</p>
      <div class="adventurer-quest-list">${offerHtml}</div>
      <div class="event-modal-buttons">
        <button type="button" data-close-adventurer-quest>閉じる</button>
      </div>
    </div>
  `;

  const close = () => removeQuestModal();
  overlay.addEventListener("click", close);
  modal.querySelector("[data-close-adventurer-quest]")?.addEventListener("click", close);
  modal.querySelectorAll("[data-adventurer-quest-index]").forEach(button => {
    button.addEventListener("click", () => {
      const offer = offers[Number(button.dataset.adventurerQuestIndex)];
      if (!offer) return;
      const template = getQuestTemplate(offer);
      const ok = window.confirm(`資金${ADVENTURER_QUEST_COST}を支払い、「${template.title}」を依頼しますか？`);
      if (!ok) return;
      if (!acceptAdventurerQuest(village, adventurer, offer)) {
        window.alert("このクエストは依頼できませんでした。");
        return;
      }
      close();
      if (typeof onAccepted === "function") onAccepted();
    });
  });

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("button:not([disabled])")?.focus();
}

export function processAdventurerQuestReturns(village) {
  const activeQuests = Array.isArray(village?.activeAdventurerQuests) ? village.activeAdventurerQuests : [];
  const currentMonthIndex = getMonthIndex(village.year, village.month);
  const dueQuests = activeQuests.filter(quest => Number(quest?.dueMonthIndex) <= currentMonthIndex);
  village.activeAdventurerQuests = activeQuests.filter(quest => Number(quest?.dueMonthIndex) > currentMonthIndex);
  if (!Array.isArray(village.visitors)) village.visitors = [];

  return dueQuests.map(quest => {
    const adventurer = quest.adventurer;
    if (!adventurer) return null;
    const success = Math.random() * 100 < Math.max(0, Number(quest.successRate) || 0);
    let rewardText = "";
    let discardedMaterials = 0;

    if (success) {
      const treasure = grantSecretTreasure(village, quest.treasureId);
      rewardText = treasure ? `秘宝「${treasure.name}」` : "秘宝なし";
      village.log(`【冒険者クエスト成功】${adventurer.name}が「${quest.questTitle}」から帰還し、${rewardText}を持ち帰りました`);
    } else {
      const materials = QUEST_FAILURE_MATERIALS_MIN + Math.floor(Math.random() * (QUEST_FAILURE_MATERIALS_MAX - QUEST_FAILURE_MATERIALS_MIN + 1));
      const result = addStoredResource(village, "materials", materials, { log: false });
      const gained = materials - result.discarded;
      discardedMaterials = result.discarded;
      rewardText = result.discarded > 0
        ? `資材+${gained}（保管できない${result.discarded}は冒険者が持ち帰った）`
        : `資材+${gained}`;
      village.log(`【冒険者クエスト失敗】${adventurer.name}が「${quest.questTitle}」から帰還しました。${rewardText}`);
    }

    adventurer.mindTraits = Array.isArray(adventurer.mindTraits)
      ? adventurer.mindTraits.filter(trait => trait !== ADVENTURER_QUEST_ACCEPTED_TRAIT)
      : ["訪問者"];
    if (!adventurer.mindTraits.includes("訪問者")) adventurer.mindTraits.push("訪問者");
    adventurer.adventurerQuestOffers = null;
    adventurer.action = "訪問";
    village.visitors.push(adventurer);

    return {
      adventurer,
      questTitle: quest.questTitle,
      treasureName: quest.treasureName,
      successRate: quest.successRate,
      success,
      discardedMaterials,
      rewardText
    };
  }).filter(Boolean);
}

export function showAdventurerQuestResultModals(reports) {
  if (typeof document === "undefined" || !Array.isArray(reports) || reports.length === 0) return;
  const queue = [...reports];

  const showNext = () => {
    const report = queue.shift();
    if (!report) return;
    document.getElementById("adventurerQuestResultOverlay")?.remove();
    document.getElementById("adventurerQuestResultModal")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "adventurerQuestResultOverlay";
    overlay.className = "event-modal-overlay adventurer-quest-result-overlay";

    const modal = document.createElement("div");
    modal.id = "adventurerQuestResultModal";
    modal.className = "event-modal adventurer-quest-result-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const dialogue = report.success
      ? `「頼まれた品だ。苦労はしたが、持ち帰れてよかった」`
      : report.discardedMaterials > 0
        ? `「倉庫が満杯になったようだ。納まらない資材はこちらで持ち帰るとしよう」`
        : `「秘宝には届かなかった。せめて、道中で得たものを納めさせてくれ」`;
    modal.innerHTML = `
      <div class="event-modal-body">
        <h3>冒険者クエスト結果報告</h3>
        <div class="adventurer-quest-report-person">
          ${getPortraitSpriteHtml(report.adventurer, { alt: report.adventurer.name })}
          <div>
            <p><strong>${escapeHtml(report.adventurer.name)}</strong></p>
            <p>${escapeHtml(dialogue)}</p>
          </div>
        </div>
        <p>クエスト: ${escapeHtml(report.questTitle)}</p>
        <p>成功率: ${Math.floor(Number(report.successRate) || 0)}%</p>
        <p class="event-modal-reward">${report.success ? "成功" : "失敗"} / 獲得報酬: ${escapeHtml(report.rewardText)}</p>
        <p>${escapeHtml(report.adventurer.name)}は、通常の訪問者枠とは別に村へ戻りました。</p>
        <div class="event-modal-buttons">
          <button type="button" data-close-adventurer-quest-result>閉じる</button>
        </div>
      </div>
    `;

    const close = () => {
      overlay.remove();
      modal.remove();
      showNext();
    };
    overlay.addEventListener("click", close);
    modal.querySelector("[data-close-adventurer-quest-result]")?.addEventListener("click", close);
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    modal.querySelector("button")?.focus();
  };

  showNext();
}
