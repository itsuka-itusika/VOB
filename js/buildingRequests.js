import {
  BUILDING_REQUEST_COMPLETION_LINES,
  BUILDING_REQUEST_DEFINITIONS,
  BUILDING_REQUEST_DISCOUNT_RATE,
  BUILDING_REQUEST_DURATION_MONTHS
} from "./data/buildingRequestData.js";
import { getToneLookupKeys, resolveDialogueTone } from "./data/dialogue/toneProfiles.js";
import { applyPortraitToElement } from "./data/portraitAtlas.js";
import { DEFAULT_PORTRAIT_KEY } from "./data/portraitPaths.js";
import { addDivineMight } from "./divineMight.js";
import { getCaptives } from "./captives.js";
import { getActiveVillagers } from "./domain/apocalypseRules.js";
import { clampValue, getVillagerFoodConsumption, getVillagerWinterMaterialConsumption, randChoice } from "./util.js";

const REQUEST_MODAL_ID = "buildingRequestModal";
const REQUEST_OVERLAY_ID = "buildingRequestOverlay";
const REQUEST_COMPLETE_MODAL_ID = "buildingRequestCompleteModal";
const REQUEST_COMPLETE_OVERLAY_ID = "buildingRequestCompleteOverlay";
const FIRST_BUILDING_REQUEST_IDS = new Set(["tavern", "church", "library", "clinic"]);
const PRIORITY_MODAL_SELECTORS = [
  "#actionPhaseModal",
  "#seasonChangeDialog",
  "#festivalModal",
  "#randomEventModal",
  "#raidWarningModal",
  "#secretTreasureEventModal",
  ".effect-result-modal",
  "#recruitmentModal",
  "#seductionModal",
  "#merchantTradeModal",
  "#miracleModal",
  "#buildingModal",
  "#buildingRequestCompleteModal",
  "#wishModal",
  "#wishCompleteModal",
  "#secretTreasureModal",
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

const definitionByBuildingId = new Map(
  BUILDING_REQUEST_DEFINITIONS.map(definition => [definition.buildingId, definition])
);

let pendingRequestModal = null;
let pendingRequestCompletionModal = null;
let requestModalObserver = null;

function normalizeOptionalNumber(value) {
  if (value == null || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function normalizeBuildingRequestState(source = null) {
  if (!source || typeof source !== "object") return null;
  const buildingId = String(source.buildingId || "").trim();
  const monthsLeft = Math.floor(Number(source.monthsLeft));
  if (!buildingId || !Number.isFinite(monthsLeft) || monthsLeft <= 0) return null;

  const definition = definitionByBuildingId.get(buildingId);
  return {
    buildingId,
    buildingName: String(source.buildingName || definition?.name || buildingId),
    requesterName: String(source.requesterName || ""),
    requesterRace: String(source.requesterRace || ""),
    requesterBodySex: String(source.requesterBodySex || ""),
    requesterBodyAge: normalizeOptionalNumber(source.requesterBodyAge),
    requesterPortraitFile: String(source.requesterPortraitFile || DEFAULT_PORTRAIT_KEY),
    line: String(source.line || `村に${definition?.name || buildingId}がほしいです。`),
    monthsLeft: Math.min(monthsLeft, BUILDING_REQUEST_DURATION_MONTHS)
  };
}

export function getActiveBuildingRequest(village) {
  const request = normalizeBuildingRequestState(village?.buildingRequest);
  if (village) {
    village.buildingRequest = request;
    if (request) village.hasStartedBuildingRequest = true;
  }
  return request;
}

export function getBuildingRequestWarnings(village) {
  const request = getActiveBuildingRequest(village);
  if (!request) return [];
  return [{
    level: "request",
    text: `要望: ${request.requesterName}が${request.buildingName}を望んでいます。残り${request.monthsLeft}か月、建設費20%引き。`
  }];
}

export function tryStartBuildingRequest(village, buildings) {
  if (!village || getActiveBuildingRequest(village)) return null;
  if (hasResourceShortageWarning(village)) return null;
  if (Math.random() >= 0.5) return null;

  const candidates = getBuildingRequestCandidates(village, buildings);
  const requestCandidates = village.hasStartedBuildingRequest
    ? candidates
    : candidates.filter(candidate => FIRST_BUILDING_REQUEST_IDS.has(candidate.definition.buildingId));
  const candidate = randChoice(requestCandidates);
  if (!candidate) return null;

  const match = randChoice(candidate.matches);
  if (!match) return null;

  const line = randChoice(getBuildingRequestRuleLines(match.rule, match.person)) || `村に${candidate.definition.name}がほしいです。`;
  const request = {
    buildingId: candidate.definition.buildingId,
    buildingName: candidate.definition.name,
    requesterName: match.person.name,
    requesterRace: match.person.race || "人間",
    requesterBodySex: match.person.bodySex || "",
    requesterBodyAge: Number(match.person.bodyAge) || null,
    requesterPortraitFile: match.person.portraitFile || DEFAULT_PORTRAIT_KEY,
    line,
    monthsLeft: BUILDING_REQUEST_DURATION_MONTHS
  };

  village.buildingRequest = request;
  village.hasStartedBuildingRequest = true;
  village.log(`要望発生: ${request.requesterName}が${request.buildingName}を望んでいます（${BUILDING_REQUEST_DURATION_MONTHS}か月、建設費20%引き）`);
  showBuildingRequestModal(request);
  return request;
}

export function advanceBuildingRequestMonth(village) {
  const request = getActiveBuildingRequest(village);
  if (!request) return null;

  request.monthsLeft -= 1;
  if (request.monthsLeft <= 0) {
    village.buildingRequest = null;
    village.log(`要望取り下げ: ${request.requesterName}の${request.buildingName}への要望は取り下げられました。`);
    return null;
  }

  village.buildingRequest = request;
  return request;
}

export function getBuildingCostForVillage(building, village) {
  const originalMaterials = Math.max(0, Number(building?.materials) || 0);
  const originalFunds = Math.max(0, Number(building?.funds) || 0);
  const originalTech = Math.max(0, Number(building?.tech) || 0);
  const request = getActiveBuildingRequest(village);
  const isDiscounted = !!(request && request.buildingId === building?.id);

  return {
    materials: isDiscounted ? getDiscountedCost(originalMaterials) : originalMaterials,
    funds: isDiscounted ? getDiscountedCost(originalFunds) : originalFunds,
    tech: isDiscounted ? getDiscountedCost(originalTech) : originalTech,
    originalMaterials,
    originalFunds,
    originalTech,
    isDiscounted,
    request
  };
}

export function fulfillBuildingRequest(village, buildingId) {
  const request = getActiveBuildingRequest(village);
  if (!request || request.buildingId !== buildingId) return null;

  const requester = getActiveVillagers(village).find(person => person.name === request.requesterName);
  if (requester) {
    requester.happiness = clampValue((Number(requester.happiness) || 0) + 30, 0, 100);
  }
  addDivineMight(village, 10);
  village.buildingRequest = null;

  const happinessText = requester ? `${request.requesterName}の幸福+30、` : "";
  village.log(`要望達成: ${request.buildingName}を建設しました。${happinessText}神威+10`);
  showBuildingRequestCompleteModal(request, requester);
  return { request, requester };
}

function getDiscountedCost(cost) {
  if (cost <= 0) return 0;
  return Math.ceil(cost * (1 - BUILDING_REQUEST_DISCOUNT_RATE));
}

function getBuildingRequestRuleLines(rule, person) {
  const sexKey = person?.spiritSex === "女" ? "female" : "male";
  return rule?.linesBySpiritSex?.[sexKey] || rule?.lines || [];
}

function getBuildingRequestCandidates(village, buildings = []) {
  const villagers = getActiveVillagers(village);
  const buildingById = new Map(buildings.map(building => [building.id, building]));
  const builtIds = new Set(Array.isArray(village.buildings) ? village.buildings : []);

  return BUILDING_REQUEST_DEFINITIONS.flatMap(definition => {
    const building = buildingById.get(definition.buildingId);
    if (!building || builtIds.has(definition.buildingId)) return [];
    if (typeof building.isUnlocked === "function" && !building.isUnlocked(village)) return [];

    const matches = villagers.flatMap(person => {
      return definition.rules
        .filter(rule => doesRuleMatch(rule.id, person))
        .map(rule => ({ person, rule }));
    });
    return matches.length > 0 ? [{ definition, building, matches }] : [];
  });
}

function hasResourceShortageWarning(village) {
  const people = (Array.isArray(village.villagers) ? village.villagers : []).concat(getCaptives(village));
  const foodCost = people.reduce((sum, person) => sum + getVillagerFoodConsumption(person), 0);
  const monthsOfFood = foodCost > 0 ? (Number(village.food) || 0) / foodCost : Infinity;
  if (foodCost > 0 && monthsOfFood <= 3) return true;

  const winterNeed = people.reduce((sum, person) => sum + getVillagerWinterMaterialConsumption(person), 0) *
    getWinterMonthsToPrepare(village.month);
  return winterNeed > 0 && (Number(village.materials) || 0) < winterNeed;
}

function getWinterMonthsToPrepare(month) {
  if ([12, 1, 2].includes(month)) {
    if (month === 12) return 3;
    if (month === 1) return 2;
    return 1;
  }
  return 3;
}

// 火砲を選べない者が魔導兵器を望むのは筋が通らないため、工廠の要望からは外す。
const ARCANE_FOUNDRY_BLOCKING_MIND_TRAITS = ["文明忌避", "不殺"];

function doesRuleMatch(ruleId, person) {
  if (ruleId.startsWith("arcaneFoundry_") &&
      hasMindTrait(person, ARCANE_FOUNDRY_BLOCKING_MIND_TRAITS)) {
    return false;
  }
  switch (ruleId) {
    case "tavern_playful_trait":
      return hasMindTrait(person, ["チャラい", "女好き", "遊び人", "享楽的"]);
    case "tavern_poet":
      return isDoingAction(person, ["詩人"]);
    case "tavern_dancer":
      return isDoingAction(person, ["踊り子"]);
    case "tavern_drinker":
      return hasAnyTrait(person, ["酒豪"]) || hasHobby(person, ["飲酒"]);
    case "tavern_lustful":
      return (Number(person.sexdr) || 0) >= 21;

    case "fountain_lover":
      return hasRelationship(person, "恋人");
    case "fountain_child":
      return hasAnyTrait(person, ["幼児", "萌芽"]);
    case "fountain_nereid":
      return person.race === "ネレイド";
    case "fountain_waterfall":
      return hasHobby(person, ["滝行"]);

    case "church_priest":
      return isDoingAction(person, ["神官", "神父", "シスター"]);
    case "church_distressed":
      return hasMindTrait(person, ["心労", "抑鬱"]);
    case "church_prayer":
      return hasHobby(person, ["祈り"]);
    case "church_ethical":
      return (Number(person.eth) || 0) >= 21;

    case "clinic_nurse":
      return isDoingAction(person, ["看護"]);
    case "clinic_injured":
      return hasAnyTrait(person, ["負傷"]);
    case "clinic_pregnant":
      return !!person.pregnancy;

    case "bath_clean":
      return hasAnyTrait(person, ["綺麗好き", "潔癖"]);
    case "bath_lover":
      return hasAnyTrait(person, ["風呂好き"]);
    case "bath_sweaty":
      return hasAnyTrait(person, ["汗かき"]);
    case "bath_cold":
      return hasAnyTrait(person, ["寒がり"]);
    case "bath_cross_lustful":
      return person.spiritSex === "男" && person.bodySex === "女" && (Number(person.sexdr) || 0) >= 21;

    case "library_research":
      return isDoingAction(person, ["研究"]);
    case "library_books":
      return hasAnyTrait(person, ["読書家", "本の虫"]) || hasHobby(person, ["読書"]);

    case "market_trader":
      return isDoingAction(person, ["行商"]);
    case "market_shrewd":
      return hasAnyTrait(person, ["世渡り上手", "抜け目がない", "計算高い"]);
    case "market_investment":
      return hasHobby(person, ["投資"]);

    case "dock_fishing":
      return hasHobby(person, ["釣り"]);
    case "dock_gourmet":
      return hasHobby(person, ["美食"]);

    case "hunting_hobby":
      return hasHobby(person, ["ハンティング"]);
    case "hunting_gourmet":
      return hasHobby(person, ["美食"]);

    case "watermill_scholar":
      return hasAnyTrait(person, ["マッド", "天才肌", "学者肌", "頭脳派", "好奇心旺盛"]);

    case "brewery_shrewd":
      return hasHobby(person, ["投資"]) || hasAnyTrait(person, ["世渡り上手", "抜け目がない", "計算高い", "才気煥発"]);
    case "brewery_drinker":
      return hasAnyTrait(person, ["酒豪"]) || hasHobby(person, ["飲酒"]);
    case "brewery_gourmet":
      return hasHobby(person, ["美食"]);
    case "brewery_miser":
      return hasAnyTrait(person, ["守銭奴", "インテリヤクザ", "策士", "狡猾", "胡散臭い"]);

    case "alchemy_scholar":
      return hasAnyTrait(person, ["マッド", "天才肌", "学者肌", "頭脳派", "好奇心旺盛"]);
    case "alchemy_meditation":
      return hasHobby(person, ["占い", "瞑想"]);
    case "alchemy_mystic":
      return hasAnyTrait(person, ["神秘的", "ミステリアス", "あやしげ", "胡散臭い", "天然", "夢想家"]);
    case "alchemy_free_research":
      return hasHobby(person, ["自由研究"]);

    case "arcaneFoundry_alchemist":
      return isDoingAction(person, ["錬金術"]);
    case "arcaneFoundry_mad":
      return hasAnyTrait(person, ["マッド", "天才肌", "頭脳派", "才気煥発"]);
    case "arcaneFoundry_veteran":
      return hasAnyTrait(person, ["負傷"]) || hasRelationship(person, "戦友");
    case "arcaneFoundry_craftsman":
      return hasAnyTrait(person, ["職人気質", "仕事の鬼", "仕事好き"]);

    case "weaving_arachnid":
      return person.race === "アラクニド" || hasAnyTrait(person, ["糸吐き"]);
    case "weaving_fashion":
      return hasAnyTrait(person, ["おしゃれ"]) || hasHobby(person, ["オシャレ"]);
    case "weaving_worker":
      return hasAnyTrait(person, ["職人気質", "働き者", "マジメ", "仕事好き", "仕事の鬼", "ワーカホリック"]);
    case "weaving_shrewd":
      return hasHobby(person, ["投資"]) || hasAnyTrait(person, ["世渡り上手", "抜け目がない", "計算高い", "才気煥発"]);
    default:
      return false;
  }
}

function hasMindTrait(person, traits) {
  const list = Array.isArray(person?.mindTraits) ? person.mindTraits : [];
  return traits.some(trait => list.includes(trait));
}

function hasAnyTrait(person, traits) {
  const bodyTraits = Array.isArray(person?.bodyTraits) ? person.bodyTraits : [];
  const mindTraits = Array.isArray(person?.mindTraits) ? person.mindTraits : [];
  return traits.some(trait => bodyTraits.includes(trait) || mindTraits.includes(trait));
}

function hasHobby(person, hobbies) {
  return hobbies.includes(String(person?.hobby || ""));
}

function hasRelationship(person, keyword) {
  const relationships = Array.isArray(person?.relationships) ? person.relationships : [];
  return relationships.some(relationship => String(relationship || "").includes(keyword));
}

function isDoingAction(person, actions) {
  return [person?.action, person?.preferredAction, person?.job].some(action => actions.includes(String(action || "")));
}

function showBuildingRequestModal(request) {
  if (typeof document === "undefined") return;
  pendingRequestModal = normalizeBuildingRequestState(request);
  closeBuildingRequestModal();
  showBuildingRequestWhenReady();
}

function showBuildingRequestCompleteModal(request, requester) {
  if (typeof document === "undefined") return;
  pendingRequestCompletionModal = createBuildingRequestCompletionState(request, requester);
  closeBuildingRequestCompleteModal();
  showBuildingRequestWhenReady();
}

function showBuildingRequestWhenReady() {
  if (!pendingRequestModal && !pendingRequestCompletionModal) {
    stopWaitingForPriorityModals();
    return;
  }
  if (isPriorityModalOpen()) {
    waitForPriorityModalsToClose();
    return;
  }

  stopWaitingForPriorityModals();
  const request = pendingRequestModal;
  if (request) {
    pendingRequestModal = null;
    renderBuildingRequestModal(request);
    return;
  }

  const completion = pendingRequestCompletionModal;
  pendingRequestCompletionModal = null;
  renderBuildingRequestCompleteModal(completion);
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
  if (requestModalObserver) return;
  requestModalObserver = new MutationObserver(showBuildingRequestWhenReady);
  requestModalObserver.observe(document.body, {
    attributes: true,
    childList: true,
    subtree: true
  });
}

function stopWaitingForPriorityModals() {
  if (!requestModalObserver) return;
  requestModalObserver.disconnect();
  requestModalObserver = null;
}

function createBuildingRequestCompletionState(request, requester) {
  const normalized = normalizeBuildingRequestState(request);
  if (!normalized) return null;
  const requesterBodyAge = normalizeOptionalNumber(requester?.bodyAge);
  return {
    ...normalized,
    requesterName: requester?.name || normalized.requesterName || "要望者",
    requesterRace: requester?.race || normalized.requesterRace || "村人",
    requesterBodySex: requester?.bodySex || normalized.requesterBodySex || "不明",
    requesterBodyAge: requesterBodyAge == null ? normalized.requesterBodyAge : requesterBodyAge,
    requesterPortraitFile: requester?.portraitFile || normalized.requesterPortraitFile || DEFAULT_PORTRAIT_KEY,
    completionLine: getBuildingRequestCompletionLine(normalized, requester)
  };
}

function resolveCompletionLine(line, context) {
  return typeof line === "function" ? line(context) : line;
}

function getBuildingRequestCompletionLine(request, requester = null) {
  const buildingName = request?.buildingName || "願いの場所";
  const context = { buildingName };
  const keys = requester
    ? getToneLookupKeys(resolveDialogueTone(requester), requester)
    : ["default"];
  const lines = keys.map(key => BUILDING_REQUEST_COMPLETION_LINES[key]).find(Boolean) ||
    BUILDING_REQUEST_COMPLETION_LINES.default;
  return resolveCompletionLine(randChoice(lines), context) || `${buildingName}を建ててくださってありがとうございます。`;
}

function renderBuildingRequestModal(request) {
  const overlay = document.createElement("div");
  overlay.id = REQUEST_OVERLAY_ID;

  const modal = document.createElement("div");
  modal.id = REQUEST_MODAL_ID;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "buildingRequestTitle");

  const title = document.createElement("h2");
  title.id = "buildingRequestTitle";
  title.textContent = "村人の要望";

  const content = document.createElement("div");
  content.className = "conversation-content";

  const portraitArea = document.createElement("div");
  portraitArea.className = "portrait-area";
  const portrait = document.createElement("div");
  applyPortraitToElement(portrait, {
    name: request.requesterName,
    portraitFile: request.requesterPortraitFile
  });
  portraitArea.appendChild(portrait);

  const dialogueArea = document.createElement("div");
  dialogueArea.className = "dialogue-area";

  const characterInfo = document.createElement("div");
  characterInfo.className = "character-info";
  const ageText = request.requesterBodyAge == null ? "" : `｜${request.requesterBodyAge}歳`;
  characterInfo.textContent = `${request.requesterName}｜${request.requesterRace || "村人"}｜${request.requesterBodySex || "不明"}${ageText}`;

  const text = document.createElement("div");
  text.className = "building-request-text";
  const line = document.createElement("p");
  line.textContent = request.line;
  text.appendChild(line);

  const detail = document.createElement("div");
  detail.className = "building-request-detail";
  detail.textContent = `${request.buildingName} / 建設費20%引き / 残り${request.monthsLeft}か月`;
  const reward = document.createElement("div");
  reward.textContent = `建設時: ${request.requesterName}の幸福+30、神威+10`;
  detail.appendChild(reward);

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
  closeButton.addEventListener("click", closeBuildingRequestModal);
  buttons.appendChild(closeButton);

  modal.appendChild(title);
  modal.appendChild(content);
  modal.appendChild(buttons);
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  closeButton.focus();
}

function renderBuildingRequestCompleteModal(completion) {
  if (!completion) return;

  const overlay = document.createElement("div");
  overlay.id = REQUEST_COMPLETE_OVERLAY_ID;

  const modal = document.createElement("div");
  modal.id = REQUEST_COMPLETE_MODAL_ID;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "buildingRequestCompleteTitle");

  const title = document.createElement("h2");
  title.id = "buildingRequestCompleteTitle";
  title.textContent = "要望達成";

  const content = document.createElement("div");
  content.className = "conversation-content";

  const portraitArea = document.createElement("div");
  portraitArea.className = "portrait-area";
  const portrait = document.createElement("div");
  applyPortraitToElement(portrait, {
    name: completion.requesterName,
    portraitFile: completion.requesterPortraitFile
  });
  portraitArea.appendChild(portrait);

  const dialogueArea = document.createElement("div");
  dialogueArea.className = "dialogue-area";

  const characterInfo = document.createElement("div");
  characterInfo.className = "character-info";
  const ageText = completion.requesterBodyAge == null ? "" : `｜${completion.requesterBodyAge}歳`;
  characterInfo.textContent = `${completion.requesterName}｜${completion.requesterRace || "村人"}｜${completion.requesterBodySex || "不明"}${ageText}`;

  const text = document.createElement("div");
  text.className = "building-request-text";
  const line = document.createElement("p");
  line.textContent = completion.completionLine;
  text.appendChild(line);

  const detail = document.createElement("div");
  detail.className = "building-request-detail";
  const achieved = document.createElement("div");
  achieved.textContent = `${completion.buildingName}を建設し、要望が達成されました。`;
  const happiness = document.createElement("div");
  happiness.textContent = `${completion.requesterName}の幸福度+30`;
  const divineMight = document.createElement("div");
  divineMight.textContent = "神威+10";
  detail.appendChild(achieved);
  detail.appendChild(happiness);
  detail.appendChild(divineMight);

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
  closeButton.addEventListener("click", closeBuildingRequestCompleteModal);
  buttons.appendChild(closeButton);

  modal.appendChild(title);
  modal.appendChild(content);
  modal.appendChild(buttons);
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  closeButton.focus();
}

function closeBuildingRequestModal() {
  const overlay = document.getElementById(REQUEST_OVERLAY_ID);
  const modal = document.getElementById(REQUEST_MODAL_ID);
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function closeBuildingRequestCompleteModal() {
  const overlay = document.getElementById(REQUEST_COMPLETE_OVERLAY_ID);
  const modal = document.getElementById(REQUEST_COMPLETE_MODAL_ID);
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}
