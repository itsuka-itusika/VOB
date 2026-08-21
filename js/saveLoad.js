// saveLoad.js
import { Village, Villager } from "./classes.js";
import { determineSpeechType, registerUsedName } from "./createVillagers.js";
import { ACTION_NONE, isPreferredActionCandidate, refreshJobTable, setPreferredAction } from "./domain/jobTables.js";
import { getPermanentStat, hydrateStatLayersFromObject, syncEffectiveStats } from "./domain/statLayers.js";
import { syncWolfSpeciesTraits } from "./domain/speciesTraits.js";
import { normalizePastPortraitFiles } from "./domain/portraitHistory.js";
import { createArchiveGapHistoryEvent, HISTORY_EVENT_TYPES, normalizeHistoryEvents } from "./history.js";
import { normalizePortraitKey } from "./data/portraitPaths.js";
import { ensureVillageFriendships, normalizeFriendshipState, normalizeRelationships } from "./relationships.js";
import { ensureTitleState, evaluateTitles } from "./titles.js";
import { normalizeTutorialState } from "./tutorial.js";
import { getInitialScaleStageIndex } from "./villageScale.js";
import { ensureCaptiveReleaseDeadline, normalizeCaptive } from "./captives.js";
import { normalizeBuildingRequestState } from "./buildingRequests.js";
import { normalizeWishState } from "./wishes.js";
import { hasActiveBuildingFlag, normalizeDamagedBuildings, recalculateBuildingDerivedState } from "./domain/buildingState.js";
import { normalizeVillageRoleForPerson, normalizeVillageRoles } from "./domain/villageRoles.js";

const BODY_TRAIT_RENAMES = {
  "子供": "幼児",
  "児童": "幼児",
  "雷霆神の加護": "雷霆の加護"
};

function normalizeBodyTraitName(trait) {
  return BODY_TRAIT_RENAMES[trait] || trait;
}

function normalizeBodyTraitList(traits) {
  if (!Array.isArray(traits)) return [];
  return traits.map(normalizeBodyTraitName);
}

function normalizeRaceName(race) {
  if (race === "巨人" || race === "サイクロプス") return "キュクロプス";
  return race || "人間";
}

function cloneNullableObject(value) {
  return value == null ? null : { ...value };
}

function cloneNullableDeepObject(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function normalizePregnancyState(pregnancy) {
  if (!pregnancy) return null;
  const next = JSON.parse(JSON.stringify(pregnancy));
  if (Array.isArray(next.inheritedBodyTraits)) {
    next.inheritedBodyTraits = normalizeBodyTraitList(next.inheritedBodyTraits);
  }
  if (next.motherSnapshot && Array.isArray(next.motherSnapshot.bodyTraits)) {
    next.motherSnapshot.bodyTraits = normalizeBodyTraitList(next.motherSnapshot.bodyTraits);
  }
  if (next.fatherSnapshot && Array.isArray(next.fatherSnapshot.bodyTraits)) {
    next.fatherSnapshot.bodyTraits = normalizeBodyTraitList(next.fatherSnapshot.bodyTraits);
  }
  if (next.motherSnapshot) {
    next.motherSnapshot.race = normalizeRaceName(next.motherSnapshot.race);
  }
  if (next.fatherSnapshot) {
    next.fatherSnapshot.race = normalizeRaceName(next.fatherSnapshot.race);
  }
  if (next.childRaceFatherSnapshot) {
    next.childRaceFatherSnapshot.race = normalizeRaceName(next.childRaceFatherSnapshot.race);
  }
  return next;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizePortraitFile(fileName) {
  return normalizePortraitKey(fileName);
}

function normalizeOptionalPortraitFile(fileName) {
  return String(fileName || "").trim() ? normalizePortraitKey(fileName) : "";
}

function normalizeFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cloneArray(value) {
  return Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : [];
}

function normalizeSecretTreasures(source) {
  if (Array.isArray(source?.secretTreasures)) return cloneArray(source.secretTreasures);
  if (Array.isArray(source?.treasures)) return cloneArray(source.treasures);
  return [];
}

function normalizeFestivalFlags(source) {
  const flags = source && typeof source === "object" ? { ...source } : {};
  flags.pineconeStaffIntroShown = !!flags.pineconeStaffIntroShown;
  return flags;
}

function migratePreferredAction(obj) {
  const candidates = [obj?.preferredAction, obj?.job, obj?.action];
  const preferred = candidates.find(isPreferredActionCandidate);
  return preferred || ACTION_NONE;
}

/**
 * 村データをJSONファイルとしてダウンロードさせる
 */
export function saveVillageToJsonFile(village) {
  // Villageインスタンスを純粋なオブジェクトに変換
  const dataObj = convertVillageToObject(village);
  const jsonStr = JSON.stringify(dataObj, null, 2);

  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "village_save.json";
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  village.log("JSONファイルとして保存しました");
}

/**
 * JSONファイルを選択してVillageデータをロードする
 *  (ファイルは index.html で <input type="file"> から取得済み)
 */
export async function loadVillageFromJsonFile(file) {
  const text = await file.text();
  const dataObj = JSON.parse(text);
  const loadedVillage = convertObjectToVillage(dataObj);
  return loadedVillage; // Villageインスタンス
}

/**
 * ローカルストレージへ保存
 */
export function saveVillageToLocalStorage(village) {
  const dataObj = convertVillageToObject(village);
  const jsonStr = JSON.stringify(dataObj);
  localStorage.setItem("villageSave", jsonStr);

  village.log("ローカルストレージに保存しました");
}

/**
 * ローカルストレージからロード(なければ null)
 */
export function loadVillageFromLocalStorage() {
  const jsonStr = localStorage.getItem("villageSave");
  if (!jsonStr) return null;

  const dataObj = JSON.parse(jsonStr);
  return convertObjectToVillage(dataObj);
}

/**
 * ローカル保存の概要(なければ null)。
 * 開始メニューの表示に使うため、村の再構築は行わず必要な値だけ読む。
 */
export function getLocalSaveSummary() {
  const jsonStr = localStorage.getItem("villageSave");
  if (!jsonStr) return null;

  try {
    const dataObj = JSON.parse(jsonStr);
    return {
      year: Number(dataObj?.year) || 0,
      month: Number(dataObj?.month) || 0,
      building: Number(dataObj?.building) || 0
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}

/* -------------------------------------------
   以下、保存用データへの変換と読み出し時の再構築
   (Village, Villager) を適切に再生成する
------------------------------------------- */

/**
 * Villageインスタンス → (シリアライズ可能)オブジェクトに変換
 */
function convertVillageToObject(village) {
  return {
    year: village.year,
    month: village.month,
    food: village.food,
    materials: village.materials,
    funds: village.funds,
    mana: village.mana,
    tech: village.tech,
    security: village.security,
    building: village.building,
    divineMight: normalizeFiniteNumber(village.divineMight, 0),
    scaleTitleStage: Number.isInteger(village.scaleTitleStage)
      ? village.scaleTitleStage
      : getInitialScaleStageIndex(village.building),
    lastThunderboltMiracleMonth: String(village.lastThunderboltMiracleMonth || ""),
    apocalypseStarted: !!village.apocalypseStarted,
    apocalypseStage: Math.max(0, Math.min(7, Math.floor(normalizeFiniteNumber(village.apocalypseStage, 0)))),
    apocalypseCleared: !!village.apocalypseCleared,
    apocalypseLocustMonths: village.apocalypseLocustMonths == null
      ? null
      : Math.max(0, Math.floor(normalizeFiniteNumber(village.apocalypseLocustMonths, 0))),
    cleanlinessMonths: village.cleanlinessMonths == null
      ? null
      : Math.max(0, Math.floor(normalizeFiniteNumber(village.cleanlinessMonths, 0))),
    lastHeadmanElectionYear: village.lastHeadmanElectionYear != null && Number.isFinite(Number(village.lastHeadmanElectionYear))
      ? Number(village.lastHeadmanElectionYear)
      : null,
    nextHeadmanElectionYear: village.nextHeadmanElectionYear != null && Number.isFinite(Number(village.nextHeadmanElectionYear))
      ? Number(village.nextHeadmanElectionYear)
      : null,
    popLimit: village.popLimit,
    villageTraits: [...village.villageTraits],
    secretTreasures: normalizeSecretTreasures(village),
    buildingRequest: normalizeBuildingRequestState(village.buildingRequest),
    hasStartedBuildingRequest: !!village.hasStartedBuildingRequest || !!normalizeBuildingRequestState(village.buildingRequest),
    wish: normalizeWishState(village.wish),
    festivalFlags: normalizeFestivalFlags(village.festivalFlags),
    tutorial: normalizeTutorialState(village.tutorial),
    logs: [...village.logs],
    historyEvents: normalizeHistoryEvents(village.historyEvents),
    gameOver: village.gameOver,
    hasDonePreEvent: village.hasDonePreEvent,
    hasDonePostEvent: village.hasDonePostEvent,
    visitorLimit: village.visitorLimit ?? 1,

    // 建築物関連のデータを追加
    buildings: [...village.buildings],
    buildingFlags: { ...village.buildingFlags },
    damagedBuildings: normalizeDamagedBuildings(village),
    nonHousePopLimitBonus: normalizeFiniteNumber(village.nonHousePopLimitBonus, 0),

    // 襲撃系
    isRaidProcessDone: village.isRaidProcessDone,
    raidTurnCount: village.raidTurnCount,
    currentActionIndex: village.currentActionIndex,
    currentRaid: cloneNullableObject(village.currentRaid),
    monthsSinceRaid: normalizeFiniteNumber(village.monthsSinceRaid, 0),
    raidCooldown: normalizeFiniteNumber(village.raidCooldown, 0),
    pendingRaid: cloneNullableDeepObject(village.pendingRaid),
    battleDebugMode: !!village.battleDebugMode,
    // raidEnemies (Villager互換配列)
    raidEnemies: village.raidEnemies.map(vill => convertVillagerToObject(vill)),

    // villagers
    villagers: village.villagers.map(vill => convertVillagerToObject(vill)),
    pendingGoldenRainPregnancies: Array.isArray(village.pendingGoldenRainPregnancies)
      ? JSON.parse(JSON.stringify(village.pendingGoldenRainPregnancies))
      : [],

    // 訪問者情報を追加
    visitors: village.visitors.map(vill => convertVillagerToObject(vill)),
    activeAdventurerQuests: (village.activeAdventurerQuests || []).map(quest => ({
      ...quest,
      adventurer: convertVillagerToObject(quest.adventurer)
    })),
    captives: (village.captives || []).map(vill => convertVillagerToObject(vill))
  };
}

/**
 * villager(Villager) → object
 */
function convertVillagerToObject(vill) {
  syncWolfSpeciesTraits(vill);
  normalizeVillageRoleForPerson(vill);
  syncEffectiveStats(vill);
  const bodyTraits = normalizeBodyTraitList(vill.bodyTraits);
  const mindTraits = Array.isArray(vill.mindTraits) ? [...vill.mindTraits] : [];
  normalizeFriendshipState(vill);
  if (bodyTraits.includes("火星の加護")) {
    bodyTraits.splice(bodyTraits.indexOf("火星の加護"), 1);
    if (!mindTraits.includes("火星の加護")) {
      mindTraits.push("火星の加護");
    }
  }
  return {
    name: vill.name,
    bodySex: vill.bodySex,
    bodyAge: vill.bodyAge,
    hp: vill.hp,
    mp: vill.mp,
    happiness: vill.happiness,
    race: normalizeRaceName(vill.race),

    str: vill.str,
    vit: vill.vit,
    dex: vill.dex,
    mag: vill.mag,
    chr: vill.chr,

    int: vill.int,
    ind: vill.ind,
    eth: vill.eth,
    cou: vill.cou,
    sexdr: vill.sexdr,

    baseStats: vill.baseStats ? { ...vill.baseStats } : undefined,
    acquiredStatMods: vill.acquiredStatMods ? { ...vill.acquiredStatMods } : undefined,
    statLayerVersion: vill.statLayerVersion,

    spiritAge: vill.spiritAge,
    spiritSex: vill.spiritSex,

    bodyTraits,
    mindTraits,
    hobby: vill.hobby,
    relationships: [...normalizeRelationships(vill)],
    friendships: { ...vill.friendships },
    friendshipStats: {
      workTogether: { ...vill.friendshipStats.workTogether },
      frontRaidTogether: { ...vill.friendshipStats.frontRaidTogether }
    },
    socialAttemptedThisMonth: !!vill.socialAttemptedThisMonth,
    titleIds: Array.isArray(vill.titleIds) ? [...vill.titleIds] : [],
    titleStats: vill.titleStats ? { ...vill.titleStats } : {},
    hasBeenCritical: !!vill.hasBeenCritical,
    criticalCause: String(vill.criticalCause || ""),
    pendingEpidemicInfection: !!vill.pendingEpidemicInfection,

    preferredAction: vill.preferredAction || vill.job || "なし",
    job: vill.job,
    jobTable: [...vill.jobTable],
    assignmentLocked: !!vill.assignmentLocked,
    action: vill.action,
    actionTable: [...vill.actionTable],
    villageRole: normalizeVillageRoleForPerson(vill),
    bodyOwner: vill.bodyOwner,

    // 口調タイプと顔グラフィック情報を追加
    speechType: vill.speechType,
    portraitFile: normalizePortraitFile(vill.portraitFile),
    pastPortraitFiles: normalizePastPortraitFiles(vill.pastPortraitFiles),
    ...(vill.rareVisitorType ? { rareVisitorType: vill.rareVisitorType } : {}),
    merchantStock: vill.merchantStock ? { ...vill.merchantStock } : undefined,
    adventurerQuestOffers: Array.isArray(vill.adventurerQuestOffers)
      ? JSON.parse(JSON.stringify(vill.adventurerQuestOffers))
      : null,
    pregnancy: normalizePregnancyState(vill.pregnancy),
    postpartumMonths: vill.postpartumMonths || 0,
    ares: normalizeFiniteNumber(vill.ares, 0),
    nikeMonths: normalizeFiniteNumber(vill.nikeMonths, 0),
    portraitMonths: normalizeFiniteNumber(vill.portraitMonths, 0),
    portraitEthLoss: normalizeFiniteNumber(vill.portraitEthLoss, 0),
    saltPillarMonths: normalizeFiniteNumber(vill.saltPillarMonths, 0),
    exchangeImmune: !!vill.exchangeImmune,
    uncapturable: !!vill.uncapturable,
    potentialStats: vill.potentialStats ? { ...vill.potentialStats } : null,
    bodyPotentialStats: vill.bodyPotentialStats ? { ...vill.bodyPotentialStats } : null,
    mindPotentialStats: vill.mindPotentialStats ? { ...vill.mindPotentialStats } : null,
    ...(Array.isArray(vill.raiderDialogues) ? { raiderDialogues: [...vill.raiderDialogues] } : {}),
    adultBodyTraits: normalizeBodyTraitList(vill.adultBodyTraits),
    adultMindTraits: Array.isArray(vill.adultMindTraits) ? [...vill.adultMindTraits] : [],
    adultHobby: vill.adultHobby || "",
    adultPortraitFile: normalizeOptionalPortraitFile(vill.adultPortraitFile),
    childMindTrait: vill.childMindTrait || "",
    ...(vill.raiderType ? { raiderType: vill.raiderType } : {}),
    ...(vill.raiderRole ? { raiderRole: vill.raiderRole } : {}),
    ...(vill.raidPosition ? { raidPosition: vill.raidPosition } : {}),
    ...(vill.raidTargeting ? { raidTargeting: vill.raidTargeting } : {}),
    ...(vill.raidAttackType ? { raidAttackType: vill.raidAttackType } : {}),
    ...(vill.uiSexDisplay ? { uiSexDisplay: vill.uiSexDisplay } : {}),
    capturedYear: Number.isFinite(Number(vill.capturedYear)) ? Number(vill.capturedYear) : undefined,
    capturedMonth: Number.isFinite(Number(vill.capturedMonth)) ? Number(vill.capturedMonth) : undefined,
    releaseMonthIndex: Number.isFinite(Number(vill.releaseMonthIndex)) ? Number(vill.releaseMonthIndex) : undefined,
    adultBodyReached: vill.adultBodyReached !== undefined
      ? !!vill.adultBodyReached
      : !!(vill.potentialStats && Number(vill.bodyAge) >= 16),
    adultMindReached: vill.adultMindReached !== undefined
      ? !!vill.adultMindReached
      : !!(vill.potentialStats && Number(vill.spiritAge) >= 16),
    adultModalShown: !!vill.adultModalShown
  };
}

/**
 * オブジェクト → Villageインスタンス
 */
function convertObjectToVillage(dataObj) {
  let v = new Village();
  // 基本プロパティ
  v.year = dataObj.year;
  v.month = dataObj.month;
  v.food = dataObj.food;
  v.materials = dataObj.materials;
  v.funds = dataObj.funds;
  v.mana = dataObj.mana;
  v.tech = dataObj.tech;
  v.security = dataObj.security;
  v.building = dataObj.building;
  v.divineMight = hasOwn(dataObj, "divineMight")
    ? normalizeFiniteNumber(dataObj.divineMight, 0)
    : normalizeFiniteNumber(dataObj.heresy, 0);
  v.scaleTitleStage = Number.isInteger(dataObj.scaleTitleStage)
    ? dataObj.scaleTitleStage
    : getInitialScaleStageIndex(v.building);
  v.lastThunderboltMiracleMonth = String(dataObj.lastThunderboltMiracleMonth || "");
  v.lastHeadmanElectionYear = dataObj.lastHeadmanElectionYear != null && Number.isFinite(Number(dataObj.lastHeadmanElectionYear))
    ? Number(dataObj.lastHeadmanElectionYear)
    : null;
  v.nextHeadmanElectionYear = dataObj.nextHeadmanElectionYear != null && Number.isFinite(Number(dataObj.nextHeadmanElectionYear))
    ? Number(dataObj.nextHeadmanElectionYear)
    : null;
  v.popLimit = dataObj.popLimit;
  if (Array.isArray(dataObj.villageTraits)) {
    v.villageTraits = [...dataObj.villageTraits];
  }
  v.secretTreasures = normalizeSecretTreasures(dataObj);
  v.buildingRequest = normalizeBuildingRequestState(dataObj.buildingRequest);
  v.hasStartedBuildingRequest = !!dataObj.hasStartedBuildingRequest || !!v.buildingRequest;
  v.wish = normalizeWishState(dataObj.wish);
  v.festivalFlags = normalizeFestivalFlags(dataObj.festivalFlags);
  v.tutorial = normalizeTutorialState(dataObj.tutorial);
  v.logs = Array.isArray(dataObj.logs) ? [...dataObj.logs] : [];
  if (hasOwn(dataObj, "historyEvents")) {
    v.historyEvents = normalizeHistoryEvents(dataObj.historyEvents);
  } else {
    v.historyEvents = [createArchiveGapHistoryEvent(v.year, v.month)];
  }
  v.apocalypseCleared = !!dataObj.apocalypseCleared || v.historyEvents.some(event => {
    return event.title === "四騎士の退却" ||
      (event.tags.includes("四騎士") && event.tags.includes("仮エンディング"));
  });
  v.gameOver = !!dataObj.gameOver;
  v.hasDonePreEvent = !!dataObj.hasDonePreEvent;
  v.hasDonePostEvent = !!dataObj.hasDonePostEvent;
  v.visitorLimit = Math.max(1, dataObj.visitorLimit ?? 1);

  // 建築物関連のデータを復元
  if (Array.isArray(dataObj.buildings)) {
    v.buildings = [...dataObj.buildings];
  }
  // 黄金像からの推定は、apocalypseStarted を持たない旧セーブの救済に限る。
  // クリア済みの村へ適用すると、像が残っているせいで黙示録が再開してしまう。
  v.apocalypseStarted = hasOwn(dataObj, "apocalypseStarted")
    ? !!dataObj.apocalypseStarted
    : (!v.apocalypseCleared && v.buildings.includes("bacchusGoldenStatue"));
  v.apocalypseStage = Math.max(0, Math.min(7, Math.floor(normalizeFiniteNumber(dataObj.apocalypseStage, 0))));
  const hasLocustTrait = v.villageTraits.includes("飛蝗");
  const inferredLocustMonths = v.apocalypseStarted && v.apocalypseStage >= 2
    ? v.apocalypseStage - 2
    : null;
  v.apocalypseLocustMonths = hasLocustTrait
    ? (dataObj.apocalypseLocustMonths == null
        ? inferredLocustMonths
        : Math.max(0, Math.floor(normalizeFiniteNumber(dataObj.apocalypseLocustMonths, 0))))
    : null;
  if (v.apocalypseLocustMonths != null && v.apocalypseLocustMonths >= 3) {
    v.villageTraits = v.villageTraits.filter(trait => trait !== "飛蝗");
    v.apocalypseLocustMonths = null;
  }
  const hasCleanlinessTrait = v.villageTraits.includes("清浄");
  v.cleanlinessMonths = hasCleanlinessTrait
    ? Math.max(0, Math.min(2, Math.floor(normalizeFiniteNumber(dataObj.cleanlinessMonths, 0))))
    : null;
  if (v.apocalypseStarted && !v.villageTraits.includes("黙示録")) {
    v.villageTraits.push("黙示録");
  }
  if (dataObj.buildingFlags) {
    v.buildingFlags = { ...dataObj.buildingFlags };
  }
  v.damagedBuildings = Array.isArray(dataObj.damagedBuildings) ? [...dataObj.damagedBuildings] : [];
  v.nonHousePopLimitBonus = hasOwn(dataObj, "nonHousePopLimitBonus")
    ? normalizeFiniteNumber(dataObj.nonHousePopLimitBonus, 0)
    : undefined;
  normalizeDamagedBuildings(v);
  recalculateBuildingDerivedState(v);
  const baseVisitorLimit = hasActiveBuildingFlag(v, "hasTavern", "tavern") ? 2 : 1;
  const prosperityVisitorBonus = (Number(v.building) || 0) >= 250 ? 1 : 0;
  v.visitorLimit = Math.max(1, baseVisitorLimit + prosperityVisitorBonus);
  v.pendingGoldenRainPregnancies = Array.isArray(dataObj.pendingGoldenRainPregnancies)
    ? JSON.parse(JSON.stringify(dataObj.pendingGoldenRainPregnancies))
    : [];

  // 襲撃系
  v.isRaidProcessDone = !!dataObj.isRaidProcessDone;
  v.raidTurnCount = dataObj.raidTurnCount ?? 0;
  v.currentActionIndex = dataObj.currentActionIndex ?? 0;
  v.currentRaid = cloneNullableObject(dataObj.currentRaid);
  v.monthsSinceRaid = Math.max(0, Math.floor(normalizeFiniteNumber(dataObj.monthsSinceRaid, 0)));
  v.raidCooldown = Math.max(0, Math.floor(normalizeFiniteNumber(dataObj.raidCooldown, 0)));
  v.pendingRaid = cloneNullableDeepObject(dataObj.pendingRaid);
  v.battleDebugMode = !!dataObj.battleDebugMode;
  if (Array.isArray(dataObj.raidEnemies)) {
    v.raidEnemies = dataObj.raidEnemies.map(o => convertObjectToVillager(o));
  }

  // villagers
  if (Array.isArray(dataObj.villagers)) {
    v.villagers = dataObj.villagers.map(o => convertObjectToVillager(o));
    const hasFriendshipData = dataObj.villagers.some(o => o && hasOwn(o, "friendships"));
    ensureVillageFriendships(v, hasFriendshipData ? 0 : 20);
    // 全村人の行動テーブルを更新
    v.villagers.forEach(villager => {
      refreshJobTable(villager, v);
    });
  }

  // 訪問者情報を復元
  if (Array.isArray(dataObj.visitors)) {
    v.visitors = dataObj.visitors.map(o => convertObjectToVillager(o));
  }
  if (Array.isArray(dataObj.activeAdventurerQuests)) {
    v.activeAdventurerQuests = dataObj.activeAdventurerQuests
      .filter(quest => quest?.adventurer)
      .map(quest => ({
        ...quest,
        adventurer: convertObjectToVillager(quest.adventurer)
      }));
  }
  if (Array.isArray(dataObj.captives)) {
    v.captives = dataObj.captives.map(o => normalizeCaptive(convertObjectToVillager(o)));
    v.captives.forEach(captive => ensureCaptiveReleaseDeadline(v, captive));
  }
  const criticalEvents = v.historyEvents.filter(event => {
    return event.type === HISTORY_EVENT_TYPES.CRITICAL || event.tags.includes("危篤");
  });
  const criticalNames = new Set(criticalEvents.flatMap(event => event.people));
  const criticalCauseByName = new Map();
  criticalEvents.forEach(event => {
    const cause = event.tags.find(tag => tag === "重体" || tag === "老衰") || "";
    event.people.forEach(name => criticalCauseByName.set(name, cause));
  });
  const questAdventurers = v.activeAdventurerQuests.map(quest => quest.adventurer).filter(Boolean);
  [...v.villagers, ...v.visitors, ...v.captives, ...v.raidEnemies, ...questAdventurers].forEach(person => {
    if (criticalNames.has(person.name)) person.hasBeenCritical = true;
    if (!person.criticalCause && person.bodyTraits.includes("危篤")) {
      person.criticalCause = criticalCauseByName.get(person.name) || "";
    }
    evaluateTitles(person, { getPermanentStat });
  });
  normalizeVillageRoles(v);

  return v;
}

/**
 * オブジェクト → Villagerインスタンス
 */
function convertObjectToVillager(obj) {
  let vill = new Villager(obj.name, obj.bodySex, obj.bodyAge);
  vill.hp = obj.hp;
  vill.mp = obj.mp;
  vill.happiness = obj.happiness;

  vill.str = obj.str;
  vill.vit = obj.vit;
  vill.dex = obj.dex;
  vill.mag = obj.mag;
  vill.chr = obj.chr;

  vill.int = obj.int;
  vill.ind = obj.ind;
  vill.eth = obj.eth;
  vill.cou = obj.cou;
  vill.sexdr = obj.sexdr;

  // 精神側の識別子は肉体側とは別に復元する。旧セーブで欠けている場合だけ初期値として肉体側を使う。
  vill.spiritAge = obj.spiritAge ?? obj.bodyAge;
  vill.spiritSex = obj.spiritSex ?? obj.bodySex;
  if (Number.isFinite(Number(obj.capturedYear))) vill.capturedYear = Number(obj.capturedYear);
  if (Number.isFinite(Number(obj.capturedMonth))) vill.capturedMonth = Number(obj.capturedMonth);
  if (Number.isFinite(Number(obj.releaseMonthIndex))) vill.releaseMonthIndex = Number(obj.releaseMonthIndex);

  vill.bodyTraits = normalizeBodyTraitList(obj.bodyTraits);
  vill.mindTraits = Array.isArray(obj.mindTraits) ? [...obj.mindTraits] : [];
  vill.villageRole = obj.villageRole;
  normalizeVillageRoleForPerson(vill);
  const migrateBodyAresToMind = vill.bodyTraits.includes("火星の加護");
  if (vill.bodyTraits.includes("火星の加護")) {
    vill.bodyTraits = vill.bodyTraits.filter(trait => trait !== "火星の加護");
  }
  if (obj.hobby === "大食い") {
    vill.hobby = "ドカ食い";
  } else if (obj.hobby === "狩猟") {
    vill.hobby = "ハンティング";
  } else {
    vill.hobby = obj.hobby;
  }
  vill.relationships = Array.isArray(obj.relationships) ? [...obj.relationships] : [];
  normalizeRelationships(vill);
  vill.friendships = obj.friendships && typeof obj.friendships === "object" && !Array.isArray(obj.friendships)
    ? { ...obj.friendships }
    : {};
  vill.friendshipStats = obj.friendshipStats && typeof obj.friendshipStats === "object" && !Array.isArray(obj.friendshipStats)
    ? JSON.parse(JSON.stringify(obj.friendshipStats))
    : {};
  normalizeFriendshipState(vill);
  vill.socialAttemptedThisMonth = !!obj.socialAttemptedThisMonth;
  vill.titleIds = Array.isArray(obj.titleIds) ? [...obj.titleIds] : [];
  vill.titleStats = obj.titleStats && typeof obj.titleStats === "object" ? { ...obj.titleStats } : {};
  vill.hasBeenCritical = !!obj.hasBeenCritical;
  vill.criticalCause = String(obj.criticalCause || "");
  vill.pendingEpidemicInfection = !!obj.pendingEpidemicInfection;
  ensureTitleState(vill);
  registerUsedName(vill.name);

  setPreferredAction(vill, migratePreferredAction(obj));
  vill.jobTable = Array.isArray(obj.jobTable) ? [...obj.jobTable] : [];
  vill.assignmentLocked = !!obj.assignmentLocked;
  vill.action = obj.action || ACTION_NONE;
  vill.actionTable = Array.isArray(obj.actionTable) ? [...obj.actionTable] : [];
  vill.bodyOwner = obj.bodyOwner || obj.name;

  // 口調タイプを保存・復元するように追加
  vill.speechType = obj.speechType || determineSpeechType(vill);

  // 顔グラフィックのファイル名を復元
  vill.portraitFile = normalizePortraitFile(obj.portraitFile);
  vill.pastPortraitFiles = normalizePastPortraitFiles(obj.pastPortraitFiles);

  // 種族情報を復元
  vill.race = normalizeRaceName(obj.race);
  if (obj.rareVisitorType) {
    vill.rareVisitorType = obj.rareVisitorType;
  }
  if (obj.merchantStock) {
    vill.merchantStock = { ...obj.merchantStock };
  }
  vill.adventurerQuestOffers = Array.isArray(obj.adventurerQuestOffers)
    ? JSON.parse(JSON.stringify(obj.adventurerQuestOffers))
    : null;
  vill.pregnancy = normalizePregnancyState(obj.pregnancy);
  vill.postpartumMonths = obj.postpartumMonths || 0;
  vill.ares = normalizeFiniteNumber(obj.ares, 0);
  vill.nikeMonths = normalizeFiniteNumber(obj.nikeMonths, 0);
  vill.portraitMonths = normalizeFiniteNumber(obj.portraitMonths, 0);
  vill.portraitEthLoss = normalizeFiniteNumber(obj.portraitEthLoss, 0);
  vill.saltPillarMonths = normalizeFiniteNumber(obj.saltPillarMonths, 0);
  vill.exchangeImmune = !!obj.exchangeImmune;
  vill.uncapturable = !!obj.uncapturable;
  vill.potentialStats = obj.potentialStats ? { ...obj.potentialStats } : null;
  vill.bodyPotentialStats = hasOwn(obj, "bodyPotentialStats")
    ? cloneNullableObject(obj.bodyPotentialStats)
    : cloneNullableObject(obj.potentialStats);
  vill.mindPotentialStats = hasOwn(obj, "mindPotentialStats")
    ? cloneNullableObject(obj.mindPotentialStats)
    : cloneNullableObject(obj.potentialStats);
  if (Array.isArray(obj.raiderDialogues)) {
    vill.raiderDialogues = [...obj.raiderDialogues];
  }
  if (obj.raiderType) {
    vill.raiderType = obj.raiderType;
  }
  if (obj.raiderRole) {
    vill.raiderRole = obj.raiderRole;
  }
  if (obj.raidPosition) {
    vill.raidPosition = obj.raidPosition;
  }
  if (obj.raidTargeting) {
    vill.raidTargeting = obj.raidTargeting;
  }
  if (obj.raidAttackType) {
    vill.raidAttackType = obj.raidAttackType;
  }
  if (obj.uiSexDisplay) {
    vill.uiSexDisplay = obj.uiSexDisplay;
  }
  if (["翼人兵", "黙示録の騎士・支配"].includes(vill.raiderType)) {
    vill.raidAttackType = "rangedMagic";
  }
  if (vill.raiderType === "聖女") {
    vill.raidPosition = "front";
    vill.raidTargeting = "frontFirst";
  }
  if (vill.raiderType === "上位翼人") {
    vill.raidPosition = "front";
    vill.raidTargeting = "frontFirst";
    vill.raidAttackType = "";
  }
  if (vill.raiderType === "黙示録の騎士・支配") {
    vill.race = "黙示録の騎士";
    vill.uiSexDisplay = "無性";
    vill.bodyTraits = ["飛行", "光輪", "多翼多眼", "交換無効"];
    vill.mindTraits = ["襲撃者", "狂信", "神聖"];
    vill.hobby = "万象監視";
    vill.exchangeImmune = true;
    vill.uncapturable = true;
  }
  if (vill.raiderType === "黙示録の騎士・戦争") {
    vill.race = "黙示録の騎士";
    vill.uiSexDisplay = "無性";
    vill.raidPosition = "middle";
    vill.raidTargeting = "frontFirst";
    vill.raidAttackType = "";
    vill.bodyTraits = ["飛行", "光輪", "機身", "交換無効"];
    vill.mindTraits = ["襲撃者", "狂信", "神聖"];
    vill.hobby = "異端討滅";
    vill.exchangeImmune = true;
    vill.uncapturable = true;
  }
  vill.adultBodyTraits = normalizeBodyTraitList(obj.adultBodyTraits);
  vill.adultMindTraits = Array.isArray(obj.adultMindTraits) ? [...obj.adultMindTraits] : [];
  vill.adultHobby = obj.adultHobby || "";
  vill.adultPortraitFile = normalizeOptionalPortraitFile(obj.adultPortraitFile);
  vill.childMindTrait = obj.childMindTrait || "";
  vill.adultBodyReached = obj.adultBodyReached !== undefined
    ? !!obj.adultBodyReached
    : !!(vill.potentialStats && Number(vill.bodyAge) >= 16);
  vill.adultMindReached = obj.adultMindReached !== undefined
    ? !!obj.adultMindReached
    : !!(vill.potentialStats && Number(vill.spiritAge) >= 16);
  vill.adultModalShown = !!obj.adultModalShown;

  hydrateStatLayersFromObject(vill, obj);
  if (syncWolfSpeciesTraits(vill)) {
    syncEffectiveStats(vill);
  }
  if (migrateBodyAresToMind && !vill.mindTraits.includes("火星の加護")) {
    vill.mindTraits.push("火星の加護");
    syncEffectiveStats(vill);
  }
  evaluateTitles(vill, { getPermanentStat });

  return vill;
}
