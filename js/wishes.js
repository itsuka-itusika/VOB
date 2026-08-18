import {
  WISH_DEFINITION_BY_ID,
  WISH_DURATION_MONTHS,
  WISH_START_CHANCE,
  resolveWishLine
} from "./data/wishData.js";
import { DEFAULT_PORTRAIT_KEY, getPortraitAssetPath } from "./data/portraitPaths.js";
import { addDivineMight } from "./divineMight.js";
import { getActiveVillagers } from "./domain/apocalypseRules.js";
import { hasActiveBuildingFlag } from "./domain/buildingState.js";
import {
  getFriendshipScore,
  getRelationshipTargetName,
  parseRelationship
} from "./relationships.js";
import { clampValue, randChoice } from "./util.js";

const WISH_MODAL_ID = "wishModal";
const WISH_OVERLAY_ID = "wishOverlay";
const WISH_COMPLETE_MODAL_ID = "wishCompleteModal";
const WISH_COMPLETE_OVERLAY_ID = "wishCompleteOverlay";
const CHILD_BODY_TRAITS = new Set(["赤子", "幼児", "少年", "少女"]);
const MONSTER_RACES = new Set(["ゴブリン", "ハーピー", "スフィンクス", "ミノタウロス", "キュクロプス", "サイクロプス"]);
const RARE_RACES = new Set([
  "レア種族",
  "翼人",
  "アルセイド",
  "ネレイド",
  "ドライアド",
  "アラクニド",
  "エクイナ",
  "セントール",
  "サテュロス",
  "サトゥロス",
  "メナド",
  "メナス"
]);
const RESEARCH_MIND_TRAITS = new Set(["マッド", "天才肌", "学者肌", "好奇心旺盛"]);
const WISH_REQUESTER_EXCLUDED_MIND_TRAITS = new Set(["野生", "無垢", "神聖"]);
const HUMANOID_RACES = new Set([
  "人間",
  "ゴブリン",
  "ハーピー",
  "半神",
  "キュクロプス",
  "翼人",
  "アルセイド",
  "ネレイド",
  "ドライアド",
  "アラクニド",
  "エクイナ",
  "サテュロス",
  "メナド",
  "セントール"
]);
const LONG_LIVED_RACES = new Set(["ドライアド", "ネレイド", "アルセイド", "翼人"]);
const PRIORITY_MODAL_SELECTORS = [
  "#actionPhaseModal",
  "#seasonChangeDialog",
  "#festivalModal",
  "#randomEventModal",
  "#raidWarningModal",
  "#buildingRequestModal",
  "#buildingRequestCompleteModal",
  "#heresyInquisitionModal",
  "#inquisitionInsufficientFundsModal",
  "#inquisitionHospitalityResultModal",
  "#inquisitionExpulsionResultModal",
  "#bacchusGoldenStatueEventModal",
  "#apocalypseStartModal",
  "#apocalypseEventModal",
  "#secretTreasureEventModal",
  ".effect-result-modal",
  "#recruitmentModal",
  "#seductionModal",
  "#merchantTradeModal",
  "#miracleModal",
  "#buildingModal",
  "#secretTreasureModal",
  "#historyModal",
  "#personalHistoryModal",
  "#friendshipDetailModal",
  "#conversationModal",
  "#exchangeModal",
  "#panFluteExchangeModal",
  "#raidModal",
  "#villageScaleModal",
  "#divineMightLevelUpModal",
  "#headmanElectionModal",
  "[data-close-relationship-modal]",
  "[data-close-reproduction-modal]"
];

let pendingStartModal = null;
let pendingCompletionModal = null;
let wishModalObserver = null;

export function normalizeWishState(source = null) {
  if (!source || typeof source !== "object") return null;
  const id = String(source.id || "").trim();
  const definition = WISH_DEFINITION_BY_ID.get(id);
  const monthsLeft = Math.floor(Number(source.monthsLeft));
  const requesterName = String(source.requesterName || "").trim();
  if (!definition || !requesterName || !Number.isFinite(monthsLeft) || monthsLeft <= 0) return null;

  const targetName = String(source.targetName || "").trim();
  const context = { targetName };
  const defaultName = id === "get_closer" && targetName
    ? `${targetName}と近づきたい`
    : definition.name;
  return {
    id,
    name: String(source.name || defaultName),
    requesterName,
    requesterRace: String(source.requesterRace || "人間"),
    requesterBodySex: String(source.requesterBodySex || ""),
    requesterBodyAge: normalizeOptionalNumber(source.requesterBodyAge),
    requesterPortraitFile: String(source.requesterPortraitFile || DEFAULT_PORTRAIT_KEY),
    targetName,
    line: String(source.line || resolveWishLine(definition.startLine, context)),
    monthsLeft
  };
}

export function getActiveWish(village) {
  if (!village) return null;
  const wish = normalizeWishState(village.wish);
  village.wish = wish;
  return wish;
}

export function getWishWarnings(village) {
  const wish = getActiveWish(village);
  if (!wish) return [];
  const targetText = wish.targetName && wish.id !== "get_closer" ? `（対象: ${wish.targetName}）` : "";
  return [{
    level: "request",
    text: `願望: ${wish.requesterName}「${wish.name}」${targetText} 残り${wish.monthsLeft}か月。`
  }];
}

export function tryStartWish(village) {
  if (!village || getActiveWish(village)) return null;
  if (!hasActiveBuildingFlag(village, "hasChurch", "church")) return null;

  const candidates = getWishCandidates(village);
  if (candidates.length === 0 || Math.random() >= WISH_START_CHANCE) return null;

  const candidate = randChoice(candidates);
  const definition = WISH_DEFINITION_BY_ID.get(candidate.id);
  const requester = candidate.requester;
  const targetName = candidate.targetName || "";
  const wish = {
    id: definition.id,
    name: definition.id === "get_closer" ? `${targetName}と近づきたい` : definition.name,
    requesterName: requester.name,
    requesterRace: requester.race || "人間",
    requesterBodySex: requester.bodySex || "",
    requesterBodyAge: normalizeOptionalNumber(requester.bodyAge),
    requesterPortraitFile: requester.portraitFile || DEFAULT_PORTRAIT_KEY,
    targetName,
    line: resolveWishLine(definition.startLine, { requester, targetName }, requester, "start"),
    monthsLeft: WISH_DURATION_MONTHS
  };

  village.wish = wish;
  village.log(`願望発生: ${wish.requesterName}「${wish.name}」（${WISH_DURATION_MONTHS}か月）`);
  showWishStartModal(wish);
  return wish;
}

export function advanceWishMonth(village) {
  const wish = getActiveWish(village);
  if (!wish) return null;
  if (checkWishCompletion(village)) return null;

  const requester = getVillageResidents(village).find(person => person.name === wish.requesterName);
  if (!requester) {
    village.wish = null;
    village.log(`願望消失: ${wish.requesterName}が村にいないため「${wish.name}」は消失しました。`);
    return null;
  }

  wish.monthsLeft -= 1;
  if (wish.monthsLeft <= 0) {
    village.wish = null;
    village.log(`願望消失: ${wish.requesterName}の「${wish.name}」は期限を迎えました。`);
    return null;
  }

  village.wish = wish;
  return wish;
}

export function checkWishCompletion(village, context = {}) {
  const wish = getActiveWish(village);
  if (!wish) return null;

  const villagers = getVillageResidents(village);
  const requester = villagers.find(person => person.name === wish.requesterName);
  if (!requester) {
    village.wish = null;
    village.log(`願望消失: ${wish.requesterName}が村にいないため「${wish.name}」は消失しました。`);
    return { wish, requester: null, canceled: true };
  }

  const reason = getWishCompletionReason(wish, requester, villagers, context);
  if (!reason) return null;

  const definition = WISH_DEFINITION_BY_ID.get(wish.id);
  const currentTargetName = wish.id === "want_child"
    ? getSpouse(requester, villagers)?.name || wish.targetName
    : wish.targetName;
  const completionLine = resolveWishLine(definition?.completionLines?.[reason], {
    requester,
    targetName: currentTargetName
  }, requester, "complete");

  requester.happiness = clampValue((Number(requester.happiness) || 0) + 30, 0, 100);
  village.wish = null;
  addDivineMight(village, 10);
  village.log(`願望達成: ${wish.requesterName}「${wish.name}」。幸福度+30、神威+10`);
  showWishCompletionModal({ ...wish, completionLine, reason }, requester);
  return { wish, requester, reason };
}

function getWishCandidates(village) {
  const villagers = getActiveVillagers(village);
  const residents = getVillageResidents(village);
  const candidates = [];
  const hasMonster = residents.some(isMonster);
  const hasRareRace = residents.some(isRareRace);

  villagers.forEach(requester => {
    if (hasAnyMindTrait(requester, WISH_REQUESTER_EXCLUDED_MIND_TRAITS)) return;

    getRelationshipTargets(requester, "天敵")
      .filter(targetName => villagers.some(person => person.name === targetName))
      .forEach(targetName => candidates.push({ id: "avoid_enemy", requester, targetName }));

    if (requester.spiritSex === "男" && Number(requester.sexdr) >= 20 && Number(requester.chr) <= 14) {
      candidates.push({ id: "be_popular", requester });
    }

    villagers.forEach(target => {
      if (target !== requester && isOneSidedAffection(requester, target)) {
        candidates.push({ id: "get_closer", requester, targetName: target.name });
      }
    });

    if (Number(requester.vit) <= 13) candidates.push({ id: "be_healthy", requester });
    if (Number(requester.str) <= 13) candidates.push({ id: "be_strong", requester });
    if (hasMindTrait(requester, "萌芽") && Number(requester.bodyAge) <= 14) {
      candidates.push({ id: "grow_up", requester });
    }
    if (hasMindTrait(requester, "思春期") && Number(requester.bodyAge) <= 14) {
      candidates.push({ id: "be_full_fledged", requester });
    }
    if (Number(requester.bodyAge) >= 16 && Number(requester.ind) <= 14) {
      candidates.push({ id: "be_child_again", requester });
    }
    if (Number(requester.spiritAge) >= 16 && !hasPartner(requester)) {
      candidates.push({ id: "want_partner", requester });
    }
    if (hasAnyBodyTrait(requester, ["中年", "老人"])) {
      candidates.push({ id: "regain_youth", requester });
    }
    if (isResearcher(requester) && !hasMonster) {
      candidates.push({ id: "research_monsters", requester });
    }
    if (isResearcher(requester) && !hasRareRace) {
      candidates.push({ id: "research_rare_races", requester });
    }
    if (hasMindTrait(requester, "酒豪")) {
      candidates.push({ id: "celebrate", requester });
    }

    const spouse = getSpouse(requester, villagers);
    if (spouse && cannotHaveChildByBody(requester, spouse) && !hasPregnancy(requester) && !hasPregnancy(spouse)) {
      candidates.push({ id: "want_child", requester, targetName: spouse.name });
    }
  });

  return candidates;
}

function getWishCompletionReason(wish, requester, villagers, context = {}) {
  const target = villagers.find(person => person.name === wish.targetName);
  switch (wish.id) {
    case "avoid_enemy":
      if (!target) return "targetGone";
      return hasTargetRelationship(requester, "天敵", target.name) ? null : "rivalryResolved";
    case "be_popular":
      if (hasPartner(requester)) return "partner";
      return Number(requester.chr) >= 20 ? "charm" : null;
    case "get_closer":
      if (hasPartnerWith(requester, wish.targetName)) return "partner";
      return requester.bodyOwner === wish.targetName ? "exchangedBody" : null;
    case "be_healthy":
      return Number(requester.vit) >= 20 ? "healthy" : null;
    case "be_strong":
      return Number(requester.str) >= 20 ? "strong" : null;
    case "grow_up":
    case "be_full_fledged":
      return Number(requester.bodyAge) >= 16 ? "adultBody" : null;
    case "be_child_again":
      return hasAnyBodyTrait(requester, CHILD_BODY_TRAITS) ? "childBody" : null;
    case "want_partner":
      return hasPartner(requester) ? "partner" : null;
    case "regain_youth":
      return Number(requester.bodyAge) <= 28 ? "young" : null;
    case "research_monsters":
      return villagers.some(isMonster) ? "monsterPresent" : null;
    case "research_rare_races":
      return villagers.some(isRareRace) ? "rareRacePresent" : null;
    case "celebrate":
      return ["4", "5"].includes(String(context.miracleId || "")) ? "celebration" : null;
    case "want_child": {
      if (hasPregnancy(requester)) return "requesterPregnant";
      const spouse = getSpouse(requester, villagers);
      return spouse && hasPregnancy(spouse) ? "spousePregnant" : null;
    }
    default:
      return null;
  }
}

function normalizeOptionalNumber(value) {
  if (value == null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getVillageResidents(village) {
  return Array.isArray(village?.villagers) ? village.villagers : [];
}

function getRelationshipTargets(person, prefix) {
  if (!Array.isArray(person?.relationships)) return [];
  return person.relationships
    .map(parseRelationship)
    .filter(relationship => relationship?.prefix === prefix && relationship.target)
    .map(relationship => relationship.target);
}

function hasTargetRelationship(person, prefix, targetName) {
  return getRelationshipTargets(person, prefix).includes(targetName);
}

function hasPartner(person) {
  return getRelationshipTargets(person, "恋人").length > 0 ||
    !!getRelationshipTargetName(person, "夫") ||
    !!getRelationshipTargetName(person, "妻");
}

function hasPartnerWith(person, targetName) {
  return ["恋人", "夫", "妻"].some(prefix => hasTargetRelationship(person, prefix, targetName));
}

function getSpouse(person, villagers) {
  const spouseName = getRelationshipTargetName(person, "夫") || getRelationshipTargetName(person, "妻");
  return spouseName ? villagers.find(candidate => candidate.name === spouseName) || null : null;
}

function isOneSidedAffection(requester, target) {
  return getFriendshipScore(requester, target) >= 40 && getFriendshipScore(target, requester) <= 19;
}

function hasMindTrait(person, trait) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.includes(trait);
}

function hasAnyMindTrait(person, traits) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.some(trait => traits.has(trait));
}

function hasAnyBodyTrait(person, traits) {
  const bodyTraits = Array.isArray(person?.bodyTraits) ? person.bodyTraits : [];
  return [...traits].some(trait => bodyTraits.includes(trait));
}

function isResearcher(person) {
  return person?.hobby === "自由研究" ||
    (Array.isArray(person?.mindTraits) && person.mindTraits.some(trait => RESEARCH_MIND_TRAITS.has(trait)));
}

function isMonster(person) {
  return MONSTER_RACES.has(String(person?.race || ""));
}

function isRareRace(person) {
  return RARE_RACES.has(String(person?.race || ""));
}

function canBePregnancyMother(person) {
  const age = Number(person?.bodyAge) || 0;
  return HUMANOID_RACES.has(String(person?.race || "人間")) &&
    person?.bodySex === "女" &&
    age >= 16 &&
    (LONG_LIVED_RACES.has(person.race) || age <= 38);
}

function canBePregnancyFather(person) {
  return HUMANOID_RACES.has(String(person?.race || "人間")) &&
    person?.bodySex === "男" &&
    Number(person.bodyAge) >= 12;
}

function cannotHaveChildByBody(a, b) {
  return !(
    (canBePregnancyMother(a) && canBePregnancyFather(b)) ||
    (canBePregnancyMother(b) && canBePregnancyFather(a))
  );
}

function hasPregnancy(person) {
  return !!person?.pregnancy || hasAnyBodyTrait(person, ["妊娠", "臨月"]);
}

function showWishStartModal(wish) {
  if (typeof document === "undefined") return;
  pendingStartModal = normalizeWishState(wish);
  closeModal(WISH_OVERLAY_ID, WISH_MODAL_ID);
  showPendingWishModalWhenReady();
}

function showWishCompletionModal(wish, requester) {
  if (typeof document === "undefined") return;
  pendingCompletionModal = {
    ...wish,
    requesterRace: requester?.race || wish.requesterRace,
    requesterBodySex: requester?.bodySex || wish.requesterBodySex,
    requesterBodyAge: normalizeOptionalNumber(requester?.bodyAge) ?? wish.requesterBodyAge,
    requesterPortraitFile: requester?.portraitFile || wish.requesterPortraitFile
  };
  closeModal(WISH_COMPLETE_OVERLAY_ID, WISH_COMPLETE_MODAL_ID);
  showPendingWishModalWhenReady();
}

function showPendingWishModalWhenReady() {
  if (!pendingStartModal && !pendingCompletionModal) {
    stopWaitingForPriorityModals();
    return;
  }
  if (isPriorityModalOpen()) {
    waitForPriorityModalsToClose();
    return;
  }

  stopWaitingForPriorityModals();
  if (pendingStartModal) {
    const wish = pendingStartModal;
    pendingStartModal = null;
    renderWishModal(wish, false);
    return;
  }
  const completion = pendingCompletionModal;
  pendingCompletionModal = null;
  renderWishModal(completion, true);
}

function renderWishModal(wish, isCompletion) {
  const overlayId = isCompletion ? WISH_COMPLETE_OVERLAY_ID : WISH_OVERLAY_ID;
  const modalId = isCompletion ? WISH_COMPLETE_MODAL_ID : WISH_MODAL_ID;
  const overlay = document.createElement("div");
  overlay.id = overlayId;

  const modal = document.createElement("div");
  modal.id = modalId;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const title = document.createElement("h2");
  title.textContent = isCompletion ? "願望達成" : "村人の願望";

  const content = document.createElement("div");
  content.className = "conversation-content";
  const portraitArea = document.createElement("div");
  portraitArea.className = "portrait-area";
  const portrait = document.createElement("img");
  portrait.src = getPortraitAssetPath(wish.requesterPortraitFile);
  portrait.alt = "";
  portrait.onerror = () => {
    portrait.src = getPortraitAssetPath(DEFAULT_PORTRAIT_KEY);
  };
  portraitArea.appendChild(portrait);

  const dialogueArea = document.createElement("div");
  dialogueArea.className = "dialogue-area";
  const characterInfo = document.createElement("div");
  characterInfo.className = "character-info";
  const ageText = wish.requesterBodyAge == null ? "" : `｜${wish.requesterBodyAge}歳`;
  characterInfo.textContent = `${wish.requesterName}｜${wish.requesterRace || "村人"}｜${wish.requesterBodySex || "不明"}${ageText}`;

  const text = document.createElement("div");
  text.className = "wish-text";
  const line = document.createElement("p");
  line.textContent = isCompletion ? wish.completionLine : wish.line;
  text.appendChild(line);

  const detail = document.createElement("div");
  detail.className = "wish-detail";
  if (isCompletion) {
    detail.textContent = `願望「${wish.name}」を達成しました。`;
    const reward = document.createElement("div");
    reward.textContent = `${wish.requesterName}の幸福度+30、神威+10`;
    detail.appendChild(reward);
  } else {
    const targetText = wish.targetName && wish.id !== "get_closer" ? ` / 対象: ${wish.targetName}` : "";
    detail.textContent = `願望「${wish.name}」${targetText} / 残り${wish.monthsLeft}か月`;
    const reward = document.createElement("div");
    reward.textContent = `達成時: ${wish.requesterName}の幸福度+30、神威+10`;
    detail.appendChild(reward);
  }

  dialogueArea.appendChild(characterInfo);
  dialogueArea.appendChild(text);
  dialogueArea.appendChild(detail);
  content.appendChild(portraitArea);
  content.appendChild(dialogueArea);

  const buttons = document.createElement("div");
  buttons.className = "modal-buttons";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "閉じる";
  closeButton.addEventListener("click", () => {
    closeModal(overlayId, modalId);
    showPendingWishModalWhenReady();
  });
  buttons.appendChild(closeButton);

  modal.appendChild(title);
  modal.appendChild(content);
  modal.appendChild(buttons);
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  closeButton.focus();
}

function closeModal(overlayId, modalId) {
  document.getElementById(overlayId)?.remove();
  document.getElementById(modalId)?.remove();
}

function isPriorityModalOpen() {
  return PRIORITY_MODAL_SELECTORS.some(selector => {
    return Array.from(document.querySelectorAll(selector)).some(isVisibleElement);
  });
}

function isVisibleElement(element) {
  if (!element || !element.isConnected || typeof window === "undefined") return false;
  let current = element;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    current = current.parentElement;
  }
  return element.getClientRects().length > 0;
}

function waitForPriorityModalsToClose() {
  if (wishModalObserver) return;
  wishModalObserver = new MutationObserver(showPendingWishModalWhenReady);
  wishModalObserver.observe(document.body, { attributes: true, childList: true, subtree: true });
}

function stopWaitingForPriorityModals() {
  if (!wishModalObserver) return;
  wishModalObserver.disconnect();
  wishModalObserver = null;
}
