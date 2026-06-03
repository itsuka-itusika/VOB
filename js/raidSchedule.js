import { showRandomEventModal } from "./randomEventModal.js";
import { createPendingRaidReservation, startRaidEvent } from "./raidStart.js";

export const RAID_BASE_RESERVATION_CHANCE = 0.10;
export const RAID_RESERVATION_GROWTH = 1.45;
export const RAID_MAX_RESERVATION_CHANCE = 0.75;
export const RAID_RUINED_RESERVATION_MULTIPLIER = 2;
export const RAID_RUINED_MAX_RESERVATION_CHANCE = 1;
export const RAID_AFTER_RAID_COOLDOWN_MONTHS = 1;
export const RAID_RESERVATION_LEAD_MONTHS = 1;
export const RAID_PROPHECY_CHANCE = 0.60;

const RAID_ACTIVE_TRAIT = "襲撃中";
const RAID_PROPHECY_TRAIT = "太陽の巫女";
const RAID_RUINED_TRAIT = "荒廃";

function normalizeNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function normalizePendingRaid(pendingRaid) {
  if (!pendingRaid || typeof pendingRaid !== "object") return null;

  const monthsUntil = normalizeNonNegativeInteger(
    pendingRaid.monthsUntil ?? pendingRaid.remainingMonths,
    RAID_RESERVATION_LEAD_MONTHS
  );
  return {
    ...pendingRaid,
    monthsUntil,
    prophecyNotified: !!pendingRaid.prophecyNotified
  };
}

export function normalizeRaidScheduleState(village) {
  village.monthsSinceRaid = normalizeNonNegativeInteger(village.monthsSinceRaid, 0);
  village.raidCooldown = normalizeNonNegativeInteger(village.raidCooldown, 0);
  village.pendingRaid = normalizePendingRaid(village.pendingRaid);
}

function isRaidActive(village) {
  return !!(
    village?.villageTraits?.includes(RAID_ACTIVE_TRAIT) ||
    (Array.isArray(village?.raidEnemies) && village.raidEnemies.length > 0)
  );
}

export function getRaidReservationChance(village) {
  const monthsSinceRaid = normalizeNonNegativeInteger(village?.monthsSinceRaid, 0);
  if (monthsSinceRaid < 2) return 0;

  const baseChance = Math.min(
    RAID_MAX_RESERVATION_CHANCE,
    RAID_BASE_RESERVATION_CHANCE * Math.pow(RAID_RESERVATION_GROWTH, monthsSinceRaid - 2)
  );
  if (Array.isArray(village?.villageTraits) && village.villageTraits.includes(RAID_RUINED_TRAIT)) {
    return Math.min(RAID_RUINED_MAX_RESERVATION_CHANCE, baseChance * RAID_RUINED_RESERVATION_MULTIPLIER);
  }
  return baseChance;
}

function findRaidProphet(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  return villagers.find(person => Array.isArray(person.bodyTraits) && person.bodyTraits.includes(RAID_PROPHECY_TRAIT)) || null;
}

function getPendingRaidName(pendingRaid) {
  return pendingRaid?.warningName || pendingRaid?.raidName || "襲撃者";
}

function showRaidProphecyModal(village, prophet, pendingRaid) {
  if (typeof document === "undefined") return;

  showRandomEventModal({
    title: "太陽神の予言",
    message: `太陽神の光が、来月の襲撃を告げました。\n${getPendingRaidName(pendingRaid)}が村へ迫っています。`,
    participants: prophet ? [{
      character: prophet,
      line: "光の中に、武器を掲げる影が見えます。来月、襲撃が来ます。"
    }] : []
  });
}

function tryNotifyRaidProphecy(village) {
  const pendingRaid = village.pendingRaid;
  if (!pendingRaid || pendingRaid.prophecyNotified) return false;

  const prophet = findRaidProphet(village);
  if (!prophet) return false;
  if (Math.random() >= RAID_PROPHECY_CHANCE) return false;

  pendingRaid.prophecyNotified = true;
  pendingRaid.prophecySource = prophet.name || "";
  village.log(`【太陽神の予言】${getPendingRaidName(pendingRaid)}の襲撃が来月に迫っています。`);
  showRaidProphecyModal(village, prophet, pendingRaid);
  return true;
}

function advancePendingRaid(village) {
  const pendingRaid = normalizePendingRaid(village.pendingRaid);
  if (!pendingRaid) {
    village.pendingRaid = null;
    return false;
  }

  pendingRaid.monthsUntil -= 1;
  if (pendingRaid.monthsUntil <= 0) {
    village.pendingRaid = null;
    startRaidEvent(village, { pendingRaid });
    return true;
  }

  village.pendingRaid = pendingRaid;
  tryNotifyRaidProphecy(village);
  return true;
}

function reserveNextRaid(village) {
  village.pendingRaid = createPendingRaidReservation(village, RAID_RESERVATION_LEAD_MONTHS);
  village.raidCooldown = Math.max(village.raidCooldown, RAID_RESERVATION_LEAD_MONTHS);
  tryNotifyRaidProphecy(village);
}

export function processRaidScheduleAtMonthStart(village, options = {}) {
  normalizeRaidScheduleState(village);
  village.monthsSinceRaid += 1;

  if (advancePendingRaid(village)) return;
  if (isRaidActive(village)) return;

  if (village.raidCooldown > 0) {
    village.raidCooldown = Math.max(0, village.raidCooldown - 1);
    return;
  }

  if (options.suspendReservation) return;

  const raidChance = getRaidReservationChance(village);
  if (raidChance <= 0) return;
  if (Math.random() < raidChance) {
    reserveNextRaid(village);
  }
}
