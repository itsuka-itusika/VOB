import { clampValue } from "./util.js";

export const DIVINE_MIGHT_LEVELS = [
  { level: 0, threshold: 0, miracleIds: ["12", "2", "16", "6", "11"] },
  { level: 1, threshold: 20, miracleIds: ["4", "10", "8"] },
  { level: 2, threshold: 60, miracleIds: ["1", "15", "3"] },
  { level: 3, threshold: 120, miracleIds: ["5", "7", "14"] },
  { level: 4, threshold: 200, miracleIds: ["9", "17"] },
  { level: 5, threshold: 300, miracleIds: ["13"] }
];

const DIVINE_MIGHT_MAX = 99999;
const scheduledLevelUpVillages = new WeakSet();

const MIRACLE_SHORT_NAMES = {
  "1": "豊穣",
  "2": "マナ",
  "3": "クピド",
  "4": "宴会",
  "5": "狂宴",
  "6": "癒し",
  "7": "戦神",
  "8": "竈女神",
  "9": "常春",
  "10": "旅人",
  "11": "出立",
  "12": "交換",
  "13": "交換強",
  "14": "ミダス",
  "15": "市場",
  "16": "酒杯",
  "17": "雷霆"
};

export function getDivineMightAmount(village) {
  const amount = Number(village?.divineMight) || 0;
  return Math.max(0, amount);
}

export function formatDivineMightAmount(amount) {
  const value = Number(amount) || 0;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}

export function getDivineMightLevelForAmount(amount) {
  const value = Number(amount) || 0;
  return DIVINE_MIGHT_LEVELS.reduce((current, entry) => {
    return value >= entry.threshold ? entry.level : current;
  }, 0);
}

export function getDivineMightLevel(village) {
  return getDivineMightLevelForAmount(getDivineMightAmount(village));
}

export function getNextDivineMightLevelInfo(level) {
  return DIVINE_MIGHT_LEVELS.find(entry => entry.level > level) || null;
}

export function getDivineMightStatus(village) {
  const amount = getDivineMightAmount(village);
  const level = getDivineMightLevelForAmount(amount);
  const next = getNextDivineMightLevelInfo(level);
  const displayThreshold = next
    ? next.threshold
    : DIVINE_MIGHT_LEVELS[DIVINE_MIGHT_LEVELS.length - 1].threshold;
  return {
    amount,
    amountLabel: `${formatDivineMightAmount(amount)}/${formatDivineMightAmount(displayThreshold)}`,
    level,
    next,
    remaining: next ? Math.max(0, next.threshold - amount) : 0
  };
}

export function getUnlockedMiracleIdsForLevel(level) {
  return new Set(DIVINE_MIGHT_LEVELS
    .filter(entry => entry.level <= level)
    .flatMap(entry => entry.miracleIds));
}

function getUnlockLevelForMiracle(miracleId) {
  return DIVINE_MIGHT_LEVELS.find(entry => entry.miracleIds.includes(String(miracleId))) || null;
}

export function getMiracleUnlockInfo(miracleId, village) {
  const required = getUnlockLevelForMiracle(miracleId);
  if (!required) return { unlocked: true, required: null, reason: "" };

  const level = getDivineMightLevel(village);
  if (level >= required.level) return { unlocked: true, required, reason: "" };

  return {
    unlocked: false,
    required,
    reason: `神威Lv${required.level}で解放`
  };
}

export function getMiracleUnlockReason(miracleId, village) {
  return getMiracleUnlockInfo(miracleId, village).reason;
}

export function getDivineMightGainFromMiracleCost(cost) {
  return Math.ceil(Math.max(0, Number(cost) || 0) / 10);
}

export function getDivineMightGainFromMonthlyMana(manaGain) {
  return Math.ceil(Math.max(0, Number(manaGain) || 0) / 5);
}

function queueDivineMightLevelUp(village, beforeLevel, afterLevel) {
  if (!village || afterLevel <= beforeLevel) return;
  const pending = village.pendingDivineMightLevelUp;
  village.pendingDivineMightLevelUp = pending
    ? {
        fromLevel: Math.min(pending.fromLevel, beforeLevel),
        toLevel: Math.max(pending.toLevel, afterLevel)
      }
    : { fromLevel: beforeLevel, toLevel: afterLevel };
}

function trimPendingDivineMightLevelUp(village) {
  const pending = village?.pendingDivineMightLevelUp;
  if (!pending) return;
  const currentLevel = getDivineMightLevel(village);
  if (currentLevel <= pending.fromLevel) {
    village.pendingDivineMightLevelUp = null;
    return;
  }
  if (pending.toLevel > currentLevel) {
    village.pendingDivineMightLevelUp = {
      fromLevel: pending.fromLevel,
      toLevel: currentLevel
    };
  }
}

function scheduleDivineMightLevelUpModal(village) {
  if (!village || typeof document === "undefined" || scheduledLevelUpVillages.has(village)) return;
  scheduledLevelUpVillages.add(village);
  const attempt = () => {
    if (!village.pendingDivineMightLevelUp || showPendingDivineMightLevelUpModal(village)) {
      scheduledLevelUpVillages.delete(village);
      return;
    }
    setTimeout(attempt, 300);
  };
  setTimeout(attempt, 0);
}

function isVisibleElement(element) {
  if (!element || !element.isConnected || typeof window === "undefined") return false;
  let current = element;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    current = current.parentElement;
  }
  return true;
}

function isDivineMightModalBlocked() {
  const selectors = [
    "#actionPhaseModal",
    ".effect-result-modal",
    "#exchangeModal",
    "#panFluteExchangeModal",
    "#miracleModal",
    "#buildingModal",
    "#buildingRequestModal",
    "#raidModal",
    "#raidWarningModal",
    "#secretTreasureEventModal",
    "#randomEventModal",
    "#festivalModal",
    "#seasonChangeDialog"
  ];
  return selectors.some(selector => isVisibleElement(document.querySelector(selector)));
}

export function addDivineMight(village, amount) {
  const gain = Math.max(0, Number(amount) || 0);
  if (!village || gain <= 0) return { gain: 0, levelUp: false };

  const beforeAmount = getDivineMightAmount(village);
  const beforeLevel = getDivineMightLevelForAmount(beforeAmount);
  village.divineMight = clampValue(beforeAmount + gain, 0, DIVINE_MIGHT_MAX);
  const afterLevel = getDivineMightLevel(village);

  if (afterLevel > beforeLevel) {
    queueDivineMightLevelUp(village, beforeLevel, afterLevel);
    scheduleDivineMightLevelUpModal(village);
  }

  return { gain, levelUp: afterLevel > beforeLevel, beforeLevel, afterLevel };
}

export function subtractDivineMight(village, amount) {
  const loss = Math.max(0, Number(amount) || 0);
  if (!village || loss <= 0) return;

  village.divineMight = clampValue(getDivineMightAmount(village) - loss, 0, DIVINE_MIGHT_MAX);
  trimPendingDivineMightLevelUp(village);
}

function getMiracleNames(ids) {
  return ids.map(id => MIRACLE_SHORT_NAMES[id] || id);
}

function getUnlockedMiracleNamesBetween(fromLevel, toLevel) {
  return DIVINE_MIGHT_LEVELS
    .filter(entry => entry.level >= fromLevel && entry.level <= toLevel)
    .flatMap(entry => getMiracleNames(entry.miracleIds));
}

export function showPendingDivineMightLevelUpModal(village, afterClose = null) {
  if (typeof document === "undefined" || !village?.pendingDivineMightLevelUp) return false;
  if (document.getElementById("divineMightLevelUpModal")) return false;
  if (isDivineMightModalBlocked()) return false;

  const pending = village.pendingDivineMightLevelUp;
  village.pendingDivineMightLevelUp = null;

  const unlockedNames = getUnlockedMiracleNamesBetween(pending.fromLevel + 1, pending.toLevel);
  const next = getNextDivineMightLevelInfo(pending.toLevel);
  const nextNames = next ? getMiracleNames(next.miracleIds) : [];

  const overlay = document.createElement("div");
  overlay.id = "divineMightLevelUpOverlay";
  overlay.className = "divine-might-level-overlay";

  const modal = document.createElement("div");
  modal.id = "divineMightLevelUpModal";
  modal.className = "divine-might-level-modal";

  const unlockedText = unlockedNames.length > 0 ? unlockedNames.join("、") : "なし";
  const nextText = next
    ? `Lv${next.level}（神威${next.threshold}）: ${nextNames.join("、")}`
    : "すべての奇跡が解放済み";

  modal.innerHTML = `
    <h2>神威Lv${pending.toLevel}に到達</h2>
    <p>村に満ちる神威が高まりました。</p>
    <dl>
      <dt>今回解放された奇跡</dt>
      <dd>${unlockedText}</dd>
      <dt>次のレベルで解放される奇跡</dt>
      <dd>${nextText}</dd>
    </dl>
    <button type="button" data-close-divine-might-level-up>閉じる</button>
  `;

  const close = () => {
    overlay.remove();
    modal.remove();
    if (village.pendingDivineMightLevelUp) {
      showPendingDivineMightLevelUpModal(village, afterClose);
      return;
    }
    if (typeof afterClose === "function") afterClose();
  };
  overlay.onclick = close;
  modal.querySelector("[data-close-divine-might-level-up]").onclick = close;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-divine-might-level-up]")?.focus();
  return true;
}
