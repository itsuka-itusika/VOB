import { showRandomEventModal } from "./randomEventModal.js";
import { isApocalypseActive } from "./domain/apocalypseRules.js";
import { clampValue } from "./util.js";

export const BACCHUS_PROTECTION_TRAIT = "加護";
export const BACCHUS_PROTECTION_MONTHS = 6;
const EARNEST_PRAYER_COOLDOWN_MONTHS = 12;
const EARNEST_PRAYER_MANA_LIMIT = 100;
const EARNEST_PRAYER_MANA_GAIN = 300;

function getAbsoluteMonth(village) {
  return Number(village?.year) * 12 + Number(village?.month) - 1;
}

export function advanceBacchusProtectionMonth(village) {
  if (!village?.villageTraits?.includes(BACCHUS_PROTECTION_TRAIT)) return;
  village.bacchusProtectionMonths = Math.max(0, Math.floor(Number(village.bacchusProtectionMonths) || 0) - 1);
  if (village.bacchusProtectionMonths > 0) return;
  village.villageTraits = village.villageTraits.filter(trait => trait !== BACCHUS_PROTECTION_TRAIT);
  village.bacchusProtectionMonths = 0;
  village.log("【加護】バッカスの加護が消え、村の周囲に再び不穏な気配が戻った。");
}

export function tryTriggerEarnestPrayer(village) {
  if (!village || isApocalypseActive(village)) return false;
  const population = Array.isArray(village.villagers) ? village.villagers.length : 0;
  if (population < 1 || population > 3 || Number(village.mana) > EARNEST_PRAYER_MANA_LIMIT) return false;

  const currentMonth = getAbsoluteMonth(village);
  const lastMonth = village.lastEarnestPrayerMonth == null
    ? null
    : Number(village.lastEarnestPrayerMonth);
  if (lastMonth != null && Number.isFinite(lastMonth) && currentMonth - lastMonth < EARNEST_PRAYER_COOLDOWN_MONTHS) return false;

  const canceledRaid = !!village.pendingRaid;
  village.pendingRaid = null;
  village.mana = clampValue(Number(village.mana) + EARNEST_PRAYER_MANA_GAIN, 0, 99999);
  village.villageTraits = Array.isArray(village.villageTraits) ? village.villageTraits : [];
  if (!village.villageTraits.includes(BACCHUS_PROTECTION_TRAIT)) {
    village.villageTraits.push(BACCHUS_PROTECTION_TRAIT);
  }
  village.bacchusProtectionMonths = BACCHUS_PROTECTION_MONTHS;
  village.lastEarnestPrayerMonth = currentMonth;

  village.log(`【切なる祈り】魔素+${EARNEST_PRAYER_MANA_GAIN}、村特性「加護」を${BACCHUS_PROTECTION_MONTHS}か月付与${canceledRaid ? "、襲撃予約を解除" : ""}`);
  if (typeof document !== "undefined") {
    showRandomEventModal({
      title: "切なる祈り",
      message: `苦境に陥った村人達は切なる祈りをバッカスに捧げた。\n\n魔素+${EARNEST_PRAYER_MANA_GAIN}\n村特性「加護」を${BACCHUS_PROTECTION_MONTHS}か月獲得${canceledRaid ? "\n予約されていた襲撃は消え去った" : ""}`,
      image: "images/events/earnest-prayer.png"
    });
  }
  return true;
}