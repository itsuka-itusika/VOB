import { autoAssignJobs, autoAssignRaidActions } from "./autoAssign.js";
import { openBuildingModal, closeBuildingModal } from "./buildings.js";
import "./dictionary.js";
import { theVillage, onNextTurn } from "./main.js";
import {
  closeExchangeModal,
  closeMiracleModal,
  onSelectMiracleChange,
  openMiracleModal,
  performMiracle
} from "./miracles.js";
import { proceedRaidAction } from "./raid.js";
import {
  loadVillageFromJsonFile,
  loadVillageFromLocalStorage,
  saveVillageToJsonFile,
  saveVillageToLocalStorage
} from "./saveLoad.js";
import { closeSecretTreasureModal, openSecretTreasureModal, useSelectedSecretTreasure } from "./secretTreasures.js";
import { updateUI } from "./ui.js";

const VIEW_MODE_STORAGE_KEY = "vob.viewMode";

function replaceVillageState(nextVillage, loadedMessage) {
  Object.assign(theVillage, nextVillage);
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
  }

  if (select) select.value = "";
}

function setSpiritColumnsVisibility(visible) {
  ["villagersTable", "visitorsTable", "raidEnemiesTable"].forEach(id => {
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
    onSaveAsJsonFile: () => saveVillageToJsonFile(theVillage),
    onSaveToLocalStorage: () => saveVillageToLocalStorage(theVillage),
    onLoadFromJsonFile: openJsonLoadDialog,
    onLoadFromLocalStorage: loadFromLocalStorage,
    runUtilityAction,
    openBuildingModal: () => openBuildingModal(theVillage),
    closeBuildingModal,
    openSecretTreasureModal: () => openSecretTreasureModal(theVillage),
    closeSecretTreasureModal,
    useSelectedSecretTreasure: () => useSelectedSecretTreasure(theVillage),
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
    closeExchangeModal
  });
}

bindGlobalHandlers();
initViewMode();
