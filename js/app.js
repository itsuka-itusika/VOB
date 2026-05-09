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

function setSpiritColumnsVisibility(visible) {
  ["villagersTable", "visitorsTable", "raidEnemiesTable"].forEach(id => {
    const table = document.getElementById(id);
    if (table) table.classList.toggle("show-spirit-columns", Boolean(visible));
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
    openBuildingModal: () => openBuildingModal(theVillage),
    closeBuildingModal,
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
