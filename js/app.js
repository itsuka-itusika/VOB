import { autoAssignJobs, autoAssignRaidActions } from "./autoAssign.js";
import { openBuildingModal, closeBuildingModal } from "./buildings.js";
import { createRandomVisitor, getVisitorTypeChoices } from "./createVillagers.js";
import "./dictionary.js";
import { closeHistoryModal, closePersonalHistoryModal, openHistoryModal } from "./history.js";
import { theVillage, onNextTurn } from "./main.js";
import {
  closeExchangeModal,
  closeMiracleModal,
  closePanFluteExchangeModal,
  onSelectMiracleChange,
  openMiracleModal,
  performMiracle
} from "./miracles.js";
import { proceedRaidAction, retreatRaid } from "./raid.js";
import { startRaidEvent } from "./raidStart.js";
import {
  loadVillageFromJsonFile,
  loadVillageFromLocalStorage,
  saveVillageToJsonFile,
  saveVillageToLocalStorage
} from "./saveLoad.js";
import { closeDryadFruitModal, closeSecretTreasureModal, openSecretTreasureModal, SECRET_TREASURES, sellSelectedSecretTreasure, useSelectedSecretTreasure } from "./secretTreasures.js";
import { RAID_MODULES } from "./data/raidData.js";
import { updateUI } from "./ui.js";
import { getCaptives } from "./captives.js";
import { setBalanceSimulationOptions } from "./balance/simulationOptions.js";

const VIEW_MODE_STORAGE_KEY = "vob.viewMode";
let debugTitleActionsEnabled = false;

function replaceVillageState(nextVillage, loadedMessage) {
  Object.assign(theVillage, nextVillage);
  if (theVillage.battleDebugMode) debugTitleActionsEnabled = true;
  theVillage.log(loadedMessage);
  updateUI(theVillage);
}

async function loadFromSelectedJsonFile(file) {
  if (!file) return;
  const loadedVillage = await loadVillageFromJsonFile(file);
  if (loadedVillage) {
    replaceVillageState(loadedVillage, "JSONファイルからロードしました");
  }
}

function openJsonLoadDialog() {
  const fileInput = document.getElementById("fileInput");
  if (!fileInput) return;

  fileInput.value = "";
  fileInput.onchange = (event) => loadFromSelectedJsonFile(event.target.files?.[0]);
  fileInput.click();
}

function loadFromLocalStorage() {
  const loadedVillage = loadVillageFromLocalStorage();
  if (!loadedVillage) {
    alert("ローカルストレージにセーブデータがありません。");
    return;
  }
  replaceVillageState(loadedVillage, "ローカルストレージからロードしました");
}

function grantAllSecretTreasures(village) {
  if (!Array.isArray(village.secretTreasures)) village.secretTreasures = [];
  const ownedTreasureKeys = new Set(village.secretTreasures.flatMap(entry => {
    if (typeof entry === "string") return [entry];
    return [entry?.id, entry?.name].filter(Boolean);
  }));
  let addedCount = 0;
  SECRET_TREASURES.forEach(secretTreasure => {
    if (!ownedTreasureKeys.has(secretTreasure.id) && !ownedTreasureKeys.has(secretTreasure.name)) {
      village.secretTreasures.push({ id: secretTreasure.id });
      ownedTreasureKeys.add(secretTreasure.id);
      addedCount++;
    }
  });
  return addedCount;
}

function unlockVobDebugFeatures() {
  theVillage.food = 10000;
  theVillage.materials = 10000;
  theVillage.funds = 10000;
  theVillage.tech = 10000;

  grantAllSecretTreasures(theVillage);
  debugTitleActionsEnabled = true;
}

function runDebugAction() {
  const command = window.prompt("パスワードを入力してください")?.trim().toUpperCase();
  if (command === "END") {
    theVillage.battleDebugMode = false;
    theVillage.log("【デバッグ】BATTLEモードを解除しました");
    updateUI(theVillage);
    return;
  }

  if (command !== "VOB" && command !== "BATTLE") {
    alert("パスワードが違います。");
    return;
  }

  unlockVobDebugFeatures();

  if (command === "BATTLE") {
    theVillage.battleDebugMode = true;
    theVillage.raidCooldown = 0;
    theVillage.log("【デバッグ】BATTLEモードを開始しました。毎月襲撃が発生し、月末に全村人の状態・体力・メンタルが全回復します");
  }

  theVillage.log("【デバッグ】食料・資材・資金・技術を10000にし、全秘宝を入手しました。タイトルのV/B/末尾sクリックを有効化しました");
  updateUI(theVillage);
}

function getExistingNames() {
  return [
    ...(Array.isArray(theVillage.villagers) ? theVillage.villagers : []),
    ...getCaptives(theVillage),
    ...(Array.isArray(theVillage.visitors) ? theVillage.visitors : []),
    ...(Array.isArray(theVillage.activeAdventurerQuests)
      ? theVillage.activeAdventurerQuests.map(quest => quest?.adventurer).filter(Boolean)
      : []),
    ...(Array.isArray(theVillage.raidEnemies) ? theVillage.raidEnemies : [])
  ].map(person => person.name).filter(Boolean);
}

function promptChoice(title, choices, formatChoice, matchesChoice) {
  const list = choices.map((choice, index) => `${index + 1}: ${formatChoice(choice)}`).join("\n");
  const answer = window.prompt(`${title}\n${list}\n番号・ID・名前のいずれかを入力してください`);
  if (answer === null) return null;

  const trimmed = answer.trim();
  const number = Number(trimmed);
  if (Number.isInteger(number) && number >= 1 && number <= choices.length) {
    return choices[number - 1];
  }
  return choices.find(choice => matchesChoice(choice, trimmed)) || null;
}

function runDebugRaidTitleAction() {
  if (
    theVillage.villageTraits?.includes("襲撃中") ||
    theVillage.currentRaid ||
    (Array.isArray(theVillage.raidEnemies) && theVillage.raidEnemies.length > 0)
  ) {
    theVillage.log("【デバッグ】襲撃者がすでにいるため、追加の襲撃は発生させませんでした");
    updateUI(theVillage);
    return;
  }

  const raidDefinition = promptChoice(
    "発生させる襲撃者テーブルを選んでください",
    RAID_MODULES,
    raid => `${raid.id} / ${raid.name}`,
    (raid, value) => raid.id === value || raid.name === value || raid.warningName === value
  );
  if (!raidDefinition) return;

  theVillage.log(`【デバッグ】${raidDefinition.name}を発生させます`);
  startRaidEvent(theVillage, { raidDefinition });
  updateUI(theVillage);
}

function runDebugVisitorTitleAction() {
  const visitorType = promptChoice(
    "発生させる訪問者タイプを選んでください",
    getVisitorTypeChoices(),
    type => type,
    (type, value) => type === value
  );
  if (!visitorType) return;

  const visitor = createRandomVisitor(getExistingNames(), visitorType, theVillage);
  if (!Array.isArray(theVillage.visitors)) theVillage.visitors = [];
  theVillage.visitors.push(visitor);
  theVillage.log(`【デバッグ】${visitor.name}が村を訪れました`);
  updateUI(theVillage);
}

function runDebugTreasureTitleAction() {
  const addedCount = grantAllSecretTreasures(theVillage);
  theVillage.log(`【デバッグ】全秘宝を再取得しました（追加${addedCount}個）`);
  updateUI(theVillage);
}

function bindDebugTitleActions() {
  const title = document.getElementById("appTitle");
  if (!title) return;

  title.addEventListener("click", event => {
    const action = event.target?.dataset?.debugTitleAction;
    if (!action || !debugTitleActionsEnabled) return;

    if (action === "raid") {
      runDebugRaidTitleAction();
    } else if (action === "visitor") {
      runDebugVisitorTitleAction();
    } else if (action === "treasures") {
      runDebugTreasureTitleAction();
    }
  });
}

function runUtilityAction() {
  const select = document.getElementById("utilityActionSelect");
  const action = select ? select.value : "";
  if (!action) return;

  if (action === "save-json") {
    saveVillageToJsonFile(theVillage);
  } else if (action === "load-json") {
    openJsonLoadDialog();
  } else if (action === "save-local") {
    if (window.confirm("現在の状態をローカル保存に上書きしますか？")) {
      saveVillageToLocalStorage(theVillage);
    }
  } else if (action === "load-local") {
    if (window.confirm("ローカル保存を読み込み、現在の状態を置き換えますか？")) {
      loadFromLocalStorage();
    }
  } else if (action === "readme") {
    window.open("Readme.txt", "_blank");
  } else if (action === "debug") {
    runDebugAction();
  }

  if (select) select.value = "";
}

function setSpiritColumnsVisibility(visible) {
  ["villagersTable", "captivesTable", "visitorsTable", "raidEnemiesTable"].forEach(id => {
    const table = document.getElementById(id);
    if (table) table.classList.toggle("show-spirit-columns", Boolean(visible));
  });
  ["spiritColumnsToggle", "mobileSpiritColumnsToggle"].forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) checkbox.checked = Boolean(visible);
  });
}

function readSavedViewMode() {
  try {
    return localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveViewMode(mode) {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // 保存できない環境でも表示切替自体は動かす。
  }
}

function setViewMode(mode) {
  const normalizedMode = mode === "mobile" ? "mobile" : "pc";
  const isMobileMode = normalizedMode === "mobile";

  document.body.classList.toggle("mobile-mode", isMobileMode);
  document.body.dataset.viewMode = normalizedMode;

  const pcButton = document.getElementById("pcModeButton");
  const mobileButton = document.getElementById("mobileModeButton");
  if (pcButton) {
    pcButton.classList.toggle("is-active", !isMobileMode);
    pcButton.setAttribute("aria-pressed", String(!isMobileMode));
  }
  if (mobileButton) {
    mobileButton.classList.toggle("is-active", isMobileMode);
    mobileButton.setAttribute("aria-pressed", String(isMobileMode));
  }

  saveViewMode(normalizedMode);
  updateUI(theVillage);
}

function initViewMode() {
  setViewMode(readSavedViewMode() === "mobile" ? "mobile" : "pc");
}

function bindGlobalHandlers() {
  Object.assign(window, {
    onNextTurn,
    openMiracleModal: () => openMiracleModal(theVillage),
    closeMiracleModal,
    onSelectMiracleChange: () => onSelectMiracleChange(theVillage),
    performMiracle: () => performMiracle(theVillage),
    proceedRaidAction: () => proceedRaidAction(theVillage),
    retreatRaid: () => retreatRaid(theVillage),
    onSaveAsJsonFile: () => saveVillageToJsonFile(theVillage),
    onSaveToLocalStorage: () => saveVillageToLocalStorage(theVillage),
    onLoadFromJsonFile: openJsonLoadDialog,
    onLoadFromLocalStorage: loadFromLocalStorage,
    runUtilityAction,
    openBuildingModal: () => openBuildingModal(theVillage),
    closeBuildingModal,
    openSecretTreasureModal: () => openSecretTreasureModal(theVillage),
    closeSecretTreasureModal,
    closeDryadFruitModal,
    openHistoryModal: () => openHistoryModal(theVillage),
    closeHistoryModal,
    closePersonalHistoryModal,
    useSelectedSecretTreasure: () => useSelectedSecretTreasure(theVillage),
    sellSelectedSecretTreasure: () => sellSelectedSecretTreasure(theVillage),
    onAutoAssignJobs: () => {
      autoAssignJobs(theVillage);
      updateUI(theVillage);
    },
    onAutoAssignRaidActions: () => {
      autoAssignRaidActions(theVillage);
      updateUI(theVillage);
    },
    toggleSpiritColumns: setSpiritColumnsVisibility,
    setViewMode,
    closeConversationModal: async () => {
      const { closeConversationModal } = await import("./conversation.js");
      closeConversationModal();
    },
    closeExchangeModal,
    closePanFluteExchangeModal
  });
}

function exposeBalanceApi() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("balanceMode") !== "1" || !window.__vobBalanceSeed) return;

  Object.defineProperty(window, "__vobBalance", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      version: 3,
      seed: window.__vobBalanceSeed || null,
      getVillage: () => theVillage,
      refreshUI: () => updateUI(theVillage),
      setSimulationOptions: options => setBalanceSimulationOptions(theVillage, options),
      autoAssignJobs: () => autoAssignJobs(theVillage),
      autoAssignRaidActions: () => autoAssignRaidActions(theVillage),
      openMiracleModal: () => openMiracleModal(theVillage),
      closeMiracleModal,
      onSelectMiracleChange: () => onSelectMiracleChange(theVillage),
      performMiracle: () => performMiracle(theVillage),
      nextTurn: onNextTurn,
      openBuildingModal: () => openBuildingModal(theVillage),
      openVisitorConversation: async visitorName => {
        const visitor = theVillage.visitors.find(person => person.name === visitorName);
        if (!visitor) return false;
        const { openConversationModal } = await import("./conversation.js");
        openConversationModal(visitor);
        return true;
      },
      proceedRaidAction: () => proceedRaidAction(theVillage),
      retreatRaid: () => retreatRaid(theVillage),
      startRaidById: (raidId, enemyGroups = null) => {
        const raidDefinition = RAID_MODULES.find(raid => raid.id === raidId);
        if (!raidDefinition) throw new Error(`Unknown raid id: ${raidId}`);
        const pendingRaid = Array.isArray(enemyGroups)
          ? { raidId, enemyGroups }
          : null;
        startRaidEvent(theVillage, { raidDefinition, pendingRaid });
      },
      getRaidDefinitions: () => RAID_MODULES.slice()
    })
  });
}

function bindOverlayClickClose(overlayId, close) {
  const overlay = document.getElementById(overlayId);
  if (!overlay) return;
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });
}

function bindModalOverlayClickClose() {
  bindOverlayClickClose("modalOverlay", closeMiracleModal);
  bindOverlayClickClose("buildingOverlay", closeBuildingModal);
  bindOverlayClickClose("secretTreasureOverlay", closeSecretTreasureModal);
  bindOverlayClickClose("dryadFruitOverlay", closeDryadFruitModal);
  bindOverlayClickClose("historyOverlay", closeHistoryModal);
  bindOverlayClickClose("personalHistoryOverlay", closePersonalHistoryModal);
}

bindGlobalHandlers();
exposeBalanceApi();
bindModalOverlayClickClose();
bindDebugTitleActions();
initViewMode();
