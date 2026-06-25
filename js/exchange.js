// exchange.js

import { refreshJobTable } from "./domain/jobTables.js";
import { PHYSICAL_ABILITY_STATS } from "./domain/personSchema.js";
import { ensureStatLayers, getPermanentStat, syncEffectiveStats } from "./domain/statLayers.js";
import { isOriginalBodyPortrait, rememberCurrentPortrait } from "./domain/portraitHistory.js";
import { recordBodyExchangeHistory } from "./history.js";
import { evaluateTitles } from "./titles.js";
import { isCaptive, normalizeCaptive } from "./captives.js";

const RAID_JOBS = ["野盗", "ゴブリン", "狼", "キュクロプス", "ハーピー"];

function cloneNullableObject(value) {
  return value == null ? null : { ...value };
}

function isRaidEnemy(person, village) {
  return Array.isArray(village?.raidEnemies) && village.raidEnemies.includes(person);
}

function inferRaidJob(person) {
  if (RAID_JOBS.includes(person?.job)) return person.job;

  const tableJob = Array.isArray(person?.jobTable)
    ? person.jobTable.find(job => RAID_JOBS.includes(job))
    : "";
  if (tableJob) return tableJob;

  const name = String(person?.name || "");
  const prefixJob = RAID_JOBS.find(job => name.startsWith(`${job}の`));
  if (prefixJob) return prefixJob;

  return person?.job || "なし";
}

function pickStats(source, stats) {
  return Object.fromEntries(stats.map(stat => [stat, source?.[stat] ?? 0]));
}

function applyStats(target, stats) {
  Object.entries(stats || {}).forEach(([stat, value]) => {
    target[stat] = value;
  });
}

function normalizeRaidEnemyAssignment(person) {
  const raidJob = inferRaidJob(person);
  person.job = raidJob;
  person.jobTable = [raidJob];
  person.action = "襲撃";
  person.actionTable = ["襲撃"];
}

function refreshAssignmentAfterExchange(person, village) {
  if (isRaidEnemy(person, village)) {
    normalizeRaidEnemyAssignment(person);
    return;
  }
  if (isCaptive(person, village)) {
    normalizeCaptive(person);
    return;
  }

  // refreshJobTable が、肉体/精神の組み合わせに応じて
  // preferredAction の妥当性と現在行動を正規化する。
  // 特に大人肉体/赤子精神の「揺籃」固定、強制療養の「療養」固定をここで壊さない。
  refreshJobTable(person, village);
}

function markBodyExchangeSourceRace(person, fromRace, toRace) {
  Object.defineProperties(person, {
    lastBodyExchangeSourceRace: {
      configurable: true,
      value: fromRace || "人間",
      writable: true
    },
    lastBodyExchangeTargetRace: {
      configurable: true,
      value: toRace || "人間",
      writable: true
    }
  });
}

/**
 * Swap body-related parameters between two characters.
 */
export function doExchange(a, b, v, isLightning = false, historySource = null) {
  ensureStatLayers(a);
  ensureStatLayers(b);
  const sourceRaceA = a.race || "人間";
  const sourceRaceB = b.race || "人間";
  const exchangeSource = historySource || (isLightning ? "落雷" : "奇跡");
  if (a.portraitFile !== b.portraitFile) {
    const isOriginalBodyA = isOriginalBodyPortrait(a);
    const isOriginalBodyB = isOriginalBodyPortrait(b);
    rememberCurrentPortrait(a, exchangeSource, {
      caption: isOriginalBodyA ? "元の身体" : "過去の姿",
      isOriginalBody: isOriginalBodyA
    });
    rememberCurrentPortrait(b, exchangeSource, {
      caption: isOriginalBodyB ? "元の身体" : "過去の姿",
      isOriginalBody: isOriginalBodyB
    });
  }
  const exchangeParams = {
    bodySex: a.bodySex,
    bodyAge: a.bodyAge,
    bodyOwner: a.bodyOwner,
    race: a.race,
    portraitFile: a.portraitFile,
    raiderPortrait: a.raiderPortrait,
    visitorPortrait: a.visitorPortrait,
    hp: a.hp,
    baseStats: pickStats(a.baseStats, PHYSICAL_ABILITY_STATS),
    acquiredStatMods: pickStats(a.acquiredStatMods, PHYSICAL_ABILITY_STATS),
    bodyTraits: [...a.bodyTraits],
    pregnancy: a.pregnancy ? JSON.parse(JSON.stringify(a.pregnancy)) : null,
    postpartumMonths: a.postpartumMonths || 0,
    bodyPotentialStats: cloneNullableObject(a.bodyPotentialStats),
    adultBodyTraits: Array.isArray(a.adultBodyTraits) ? [...a.adultBodyTraits] : [],
    adultBodyReached: !!a.adultBodyReached,
    adultPortraitFile: a.adultPortraitFile || "",
    toddlerPortraitFile: a.toddlerPortraitFile || "",
    toddlerPortraitGroup: a.toddlerPortraitGroup || ""
  };

  a.bodySex = b.bodySex;
  a.bodyAge = b.bodyAge;
  a.bodyOwner = b.bodyOwner;
  a.race = b.race;
  a.portraitFile = b.portraitFile;
  a.raiderPortrait = b.raiderPortrait;
  a.visitorPortrait = b.visitorPortrait;
  a.hp = b.hp;
  applyStats(a.baseStats, pickStats(b.baseStats, PHYSICAL_ABILITY_STATS));
  applyStats(a.acquiredStatMods, pickStats(b.acquiredStatMods, PHYSICAL_ABILITY_STATS));
  a.bodyTraits = [...b.bodyTraits];
  a.pregnancy = b.pregnancy ? JSON.parse(JSON.stringify(b.pregnancy)) : null;
  a.postpartumMonths = b.postpartumMonths || 0;
  a.bodyPotentialStats = cloneNullableObject(b.bodyPotentialStats);
  a.adultBodyTraits = Array.isArray(b.adultBodyTraits) ? [...b.adultBodyTraits] : [];
  a.adultBodyReached = !!b.adultBodyReached;
  a.adultPortraitFile = b.adultPortraitFile || "";
  a.toddlerPortraitFile = b.toddlerPortraitFile || "";
  a.toddlerPortraitGroup = b.toddlerPortraitGroup || "";

  b.bodySex = exchangeParams.bodySex;
  b.bodyAge = exchangeParams.bodyAge;
  b.bodyOwner = exchangeParams.bodyOwner;
  b.race = exchangeParams.race;
  b.portraitFile = exchangeParams.portraitFile;
  b.raiderPortrait = exchangeParams.raiderPortrait;
  b.visitorPortrait = exchangeParams.visitorPortrait;
  b.hp = exchangeParams.hp;
  applyStats(b.baseStats, exchangeParams.baseStats);
  applyStats(b.acquiredStatMods, exchangeParams.acquiredStatMods);
  b.bodyTraits = [...exchangeParams.bodyTraits];
  b.pregnancy = exchangeParams.pregnancy ? JSON.parse(JSON.stringify(exchangeParams.pregnancy)) : null;
  b.postpartumMonths = exchangeParams.postpartumMonths;
  b.bodyPotentialStats = cloneNullableObject(exchangeParams.bodyPotentialStats);
  b.adultBodyTraits = [...exchangeParams.adultBodyTraits];
  b.adultBodyReached = exchangeParams.adultBodyReached;
  b.adultPortraitFile = exchangeParams.adultPortraitFile;
  b.toddlerPortraitFile = exchangeParams.toddlerPortraitFile;
  b.toddlerPortraitGroup = exchangeParams.toddlerPortraitGroup;

  syncEffectiveStats(a);
  syncEffectiveStats(b);
  evaluateTitles(a, { getPermanentStat });
  evaluateTitles(b, { getPermanentStat });
  refreshAssignmentAfterExchange(a, v);
  refreshAssignmentAfterExchange(b, v);
  markBodyExchangeSourceRace(a, sourceRaceA, a.race);
  markBodyExchangeSourceRace(b, sourceRaceB, b.race);

  if (!isLightning) {
    v.log(`【交換の奇跡】${a.name}と${b.name}の肉体を交換しました`);
  }
  recordBodyExchangeHistory(v, a, b, { source: exchangeSource });
}
