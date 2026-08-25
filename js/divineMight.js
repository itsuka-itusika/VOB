import { clampValue } from "./util.js";

export const DIVINE_MIGHT_LEVELS = [
  { level: 0, threshold: 0, miracleIds: ["12", "2", "16", "6", "20", "11"] },
  { level: 1, threshold: 30, miracleIds: ["4", "10", "8"] },
  { level: 2, threshold: 90, miracleIds: ["1", "15", "3"] },
  { level: 3, threshold: 180, miracleIds: ["5", "7", "14"] },
  { level: 4, threshold: 320, miracleIds: ["9", "17"] },
  { level: 5, threshold: 500, miracleIds: ["13"] },
  { level: 6, threshold: 500, miracleIds: ["18", "19"], requiresApocalypseClear: true }
];

const DIVINE_MIGHT_MAX = 99999;
const scheduledLevelUpVillages = new WeakSet();
const levelUpAfterCloseCallbacks = new WeakMap();

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
  "17": "雷霆",
  "18": "騒擾",
  "19": "稀人",
  "20": "清拭"
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

function isDivineMightLevelAvailable(entry, village = null) {
  return !entry.requiresApocalypseClear || !!village?.apocalypseCleared;
}

export function getDivineMightLevelForAmount(amount, village = null) {
  const value = Number(amount) || 0;
  return DIVINE_MIGHT_LEVELS.reduce((current, entry) => {
    return value >= entry.threshold && isDivineMightLevelAvailable(entry, village) ? entry.level : current;
  }, 0);
}

export function getDivineMightLevel(village) {
  return getDivineMightLevelForAmount(getDivineMightAmount(village), village);
}

// 黙示録踏破が条件のレベルは、踏破するまで伏せる。存在を先に見せるとネタバレになる。
export function getNextDivineMightLevelInfo(level, village = null) {
  return DIVINE_MIGHT_LEVELS.find(entry => entry.level > level && isDivineMightLevelAvailable(entry, village)) || null;
}

export function getDivineMightStatus(village) {
  const amount = getDivineMightAmount(village);
  const level = getDivineMightLevelForAmount(amount, village);
  const next = getNextDivineMightLevelInfo(level, village);
  // 最高レベル到達後は次の閾値がないため、数値ではなく max と表示する。
  const thresholdLabel = next ? formatDivineMightAmount(next.threshold) : "max";
  return {
    amount,
    amountLabel: `${formatDivineMightAmount(amount)}/${thresholdLabel}`,
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

  if (required.requiresApocalypseClear && !village?.apocalypseCleared) {
    return {
      unlocked: false,
      required,
      reason: "黙示録の四騎士撃退後に解放"
    };
  }

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
    if (!village.pendingDivineMightLevelUp) {
      scheduledLevelUpVillages.delete(village);
      // 表示待ちの間に神威消費でレベルアップが取り消された場合も、
      // 繰延中の処理（異端審問・襲撃予約チェックなど）を漏らさず実行する。
      runDivineMightLevelUpAfterClose(village, null);
      return;
    }
    if (showPendingDivineMightLevelUpModal(village)) {
      scheduledLevelUpVillages.delete(village);
      return;
    }
    setTimeout(attempt, 300);
  };
  setTimeout(attempt, 0);
}

function queueDivineMightLevelUpAfterClose(village, callback) {
  if (!village || typeof callback !== "function") return;
  const callbacks = levelUpAfterCloseCallbacks.get(village) || [];
  callbacks.push(callback);
  levelUpAfterCloseCallbacks.set(village, callbacks);
}

function runDivineMightLevelUpAfterClose(village, afterClose) {
  const callbacks = levelUpAfterCloseCallbacks.get(village) || [];
  levelUpAfterCloseCallbacks.delete(village);
  [...callbacks, afterClose].forEach(callback => {
    if (typeof callback === "function") callback();
  });
}

export function runAfterPendingDivineMightLevelUp(village, callback) {
  if (typeof document === "undefined" || !village?.pendingDivineMightLevelUp) return false;
  queueDivineMightLevelUpAfterClose(village, callback);
  scheduleDivineMightLevelUpModal(village);
  return true;
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
    "#buildingRequestCompleteModal",
    "#wishModal",
    "#wishCompleteModal",
    "#heresyInquisitionModal",
      "#inquisitionHospitalityResultModal",
    "#inquisitionExpulsionResultModal",
    "#raidModal",
    "#raidWarningModal",
    "#secretTreasureEventModal",
    "#randomEventModal",
    "#festivalModal",
    "#seasonChangeDialog",
    "#apocalypseEventModal"
  ];
  return selectors.some(selector => isVisibleElement(document.querySelector(selector)));
}

export function addDivineMight(village, amount) {
  const gain = Math.max(0, Number(amount) || 0);
  if (!village || gain <= 0) return { gain: 0, levelUp: false };

  const beforeAmount = getDivineMightAmount(village);
  const beforeLevel = getDivineMightLevelForAmount(beforeAmount, village);
  village.divineMight = clampValue(beforeAmount + gain, 0, DIVINE_MIGHT_MAX);
  const afterLevel = getDivineMightLevel(village);

  if (afterLevel > beforeLevel) {
    queueDivineMightLevelUp(village, beforeLevel, afterLevel);
    scheduleDivineMightLevelUpModal(village);
  }

  return { gain, levelUp: afterLevel > beforeLevel, beforeLevel, afterLevel };
}

export function refreshDivineMightLevelUnlock(village, beforeLevel = null) {
  if (!village) return false;
  const previousLevel = Number.isFinite(Number(beforeLevel))
    ? Number(beforeLevel)
    : getDivineMightLevelForAmount(getDivineMightAmount(village));
  const afterLevel = getDivineMightLevel(village);
  if (afterLevel <= previousLevel) return false;
  queueDivineMightLevelUp(village, previousLevel, afterLevel);
  scheduleDivineMightLevelUpModal(village);
  return true;
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
  const next = getNextDivineMightLevelInfo(pending.toLevel, village);
  const nextNames = next ? getMiracleNames(next.miracleIds) : [];

  const overlay = document.createElement("div");
  overlay.id = "divineMightLevelUpOverlay";
  overlay.className = "divine-might-level-overlay";

  const modal = document.createElement("div");
  modal.id = "divineMightLevelUpModal";
  modal.className = "divine-might-level-modal";

  const unlockedText = unlockedNames.length > 0 ? unlockedNames.join("、") : "なし";
  const nextText = next
    ? (next.requiresApocalypseClear
        ? `Lv${next.level}（四騎士撃退後）: ${nextNames.join("、")}`
        : `Lv${next.level}（神威${next.threshold}）: ${nextNames.join("、")}`)
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
      // 直後に表示できない場合も、繰延コールバックを失わないよう再スケジュールする。
      if (!showPendingDivineMightLevelUpModal(village, afterClose)) {
        queueDivineMightLevelUpAfterClose(village, afterClose);
        scheduleDivineMightLevelUpModal(village);
      }
      return;
    }
    runDivineMightLevelUpAfterClose(village, afterClose);
  };
  overlay.onclick = close;
  modal.querySelector("[data-close-divine-might-level-up]").onclick = close;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-divine-might-level-up]")?.focus();
  return true;
}
