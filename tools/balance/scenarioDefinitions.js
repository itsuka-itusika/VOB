import { Villager } from "../../js/classes.js";
import { BUILDINGS } from "../../js/buildings.js";
import { setBaseStats, syncEffectiveStats } from "../../js/domain/statLayers.js";
import { getVillagerFoodConsumption } from "../../js/util.js";
import { getVillageScaleStage } from "../../js/villageScale.js";
import { createVillageSnapshot } from "./resultSchema.js?v=20260813-balance-23";
import { drainKnownModals, waitUntil } from "./modalDriver.js?v=20260813-balance-23";

export const SCENARIO_VERSION = 14;
export const STANDARD_PLAYER_MODEL_VERSION = 1;
export const RECOVERY_PLAYER_MODEL_VERSION = 1;

const UPPER_RAIDS = [
  { id: "holy-crusade-strong", label: "聖征騎士団（強）" },
  { id: "winged-punishment-strong", label: "翼人兵（強）" }
];
const UPPER_RAID_MONTHS = [2, 4, 7, 9];
const SEASON_BY_MONTH = new Map([
  [2, "冬"],
  [4, "春"],
  [7, "夏"],
  [9, "秋"]
]);
const UPPER_BUILDING_COUNTS = {
  house: 4,
  storehouse: 1,
  watchtower: 4
};
const EXCLUDED_UPPER_BUILDINGS = new Set(["publicBath", "bacchusGoldenStatue"]);
const RECOVERY_OPTIONS = Object.freeze({
  suppressRandomEvents: true,
  suppressVisitors: true,
  suppressBuildingRequests: true,
  suppressRaids: true
});
const UPPER_RAID_SENSITIVITY_CANDIDATES = Object.freeze([
  { id: "hp110", label: "敵HP+10%", enemyHpMultiplier: 1.1, enemyOffenseMultiplier: 1 },
  { id: "offense90", label: "敵攻撃能力-10%", enemyHpMultiplier: 1, enemyOffenseMultiplier: 0.9 },
  { id: "hp110-offense90", label: "敵HP+10%・攻撃能力-10%", enemyHpMultiplier: 1.1, enemyOffenseMultiplier: 0.9 }
]);
function createCompositionCandidate(id, label, enemyGroups, profile = null) {
  return {
    id,
    label,
    enemyGroups,
    ...(profile ? { profile } : {})
  };
}

function createShieldProfile(bodyStatMultipliers) {
  return {
    bodyStatMultipliers,
    addMindTraits: ["秘蹟：盾"]
  };
}

function createHolyGroups([heavy, elite, holy, saint]) {
  return [
    { raiderType: "重装兵", count: heavy },
    { raiderType: "上級騎士", count: elite },
    { raiderType: "聖騎士", count: holy },
    { raiderType: "聖女", count: saint }
  ];
}

const HOLY_COMPOSITION_CANDIDATES = [
  ["fixed-9", "重装4・上級3・聖騎士1・聖女1", [4, 3, 1, 1]],
  ["fixed-10", "重装5・上級3・聖騎士1・聖女1", [5, 3, 1, 1]],
  ["fixed-11", "重装5・上級4・聖騎士1・聖女1", [5, 4, 1, 1]],
  ["fixed-12", "重装6・上級4・聖騎士1・聖女1", [6, 4, 1, 1]],
  ["fixed-13", "重装6・上級5・聖騎士1・聖女1", [6, 5, 1, 1]]
].map(([id, label, counts]) =>
  createCompositionCandidate(id, label, createHolyGroups(counts))
);

HOLY_COMPOSITION_CANDIDATES.push(
  ...[
    ["fixed-10-shield-offense80", "10人・盾付与・身体攻撃能力80%", [5, 3, 1, 1], 0.8],
    ["fixed-11-shield-offense75", "11人・盾付与・身体攻撃能力75%", [5, 4, 1, 1], 0.75],
    ["fixed-12-shield-offense70", "12人・盾付与・身体攻撃能力70%", [6, 4, 1, 1], 0.7],
    ["fixed-14-shield-offense70", "14人・盾付与・身体攻撃能力70%", [7, 5, 1, 1], 0.7],
    ["fixed-16-shield-offense70", "16人・盾付与・身体攻撃能力70%", [8, 6, 1, 1], 0.7],
    ["fixed-18-shield-offense70", "18人・盾付与・身体攻撃能力70%", [9, 7, 1, 1], 0.7],
    ["fixed-15-shield-offense60", "15人・盾付与・身体攻撃能力60%", [7, 6, 1, 1], 0.6],
    ["fixed-16-shield-offense60", "16人・盾付与・身体攻撃能力60%", [8, 6, 1, 1], 0.6],
    ["fixed-18-shield-offense60", "18人・盾付与・身体攻撃能力60%", [9, 7, 1, 1], 0.6],
    ["fixed-20-shield-offense60", "20人・盾付与・身体攻撃能力60%", [10, 8, 1, 1], 0.6],
    ["fixed-20-shield-offense50", "20人・盾付与・身体攻撃能力50%", [10, 8, 1, 1], 0.5],
    ["fixed-22-shield-offense50", "22人・盾付与・身体攻撃能力50%", [11, 9, 1, 1], 0.5],
    ["fixed-20-shield-offense55", "20人・盾付与・身体攻撃能力55%", [10, 8, 1, 1], 0.55],
    ["fixed-22-shield-offense55", "22人・盾付与・身体攻撃能力55%", [11, 9, 1, 1], 0.55]
  ].map(([id, label, counts, multiplier]) =>
    createCompositionCandidate(
      id,
      label,
      createHolyGroups(counts),
      createShieldProfile({ str: multiplier, dex: multiplier, mag: multiplier })
    )
  )
);

const WINGED_COMPOSITION_CANDIDATES = [9, 10, 11, 12, 16, 13, 14, 15]
  .map(count => createCompositionCandidate(
    `winged-${count}`,
    `翼人兵${count}`,
    [{ raiderType: "翼人兵", count }]
  ));

WINGED_COMPOSITION_CANDIDATES.push(
  createCompositionCandidate(
    "upper-1-winged-8",
    "上位翼人1・翼人兵8",
    [{ raiderType: "上位翼人", count: 1 }, { raiderType: "翼人兵", count: 8 }]
  ),
  createCompositionCandidate(
    "upper-1-winged-11",
    "上位翼人1・翼人兵11",
    [{ raiderType: "上位翼人", count: 1 }, { raiderType: "翼人兵", count: 11 }]
  ),
  createCompositionCandidate(
    "upper-1-winged-15",
    "上位翼人1・翼人兵15",
    [{ raiderType: "上位翼人", count: 1 }, { raiderType: "翼人兵", count: 15 }]
  ),
  ...[
    ["winged-11-shield-dex80", "翼人兵11・盾付与・身体器用80%", 11, { dex: 0.8 }],
    ["winged-12-shield-dex70", "翼人兵12・盾付与・身体器用70%", 12, { dex: 0.7 }],
    ["winged-13-shield-dex60", "翼人兵13・盾付与・身体器用60%", 13, { dex: 0.6 }],
    ["winged-16-shield-dex60", "翼人兵16・盾付与・身体器用60%", 16, { dex: 0.6 }],
    ["winged-18-shield-dex60", "翼人兵18・盾付与・身体器用60%", 18, { dex: 0.6 }],
    ["winged-20-shield-dex60", "翼人兵20・盾付与・身体器用60%", 20, { dex: 0.6 }],
    ["winged-18-shield-body75-dex70", "翼人兵18・盾付与・身体筋魔75%・器用70%", 18, { str: 0.75, dex: 0.7, mag: 0.75 }],
    ["winged-20-shield-body75-dex70", "翼人兵20・盾付与・身体筋魔75%・器用70%", 20, { str: 0.75, dex: 0.7, mag: 0.75 }],
    ["winged-22-shield-body75-dex70", "翼人兵22・盾付与・身体筋魔75%・器用70%", 22, { str: 0.75, dex: 0.7, mag: 0.75 }],
    ["winged-19-shield-body75-dex70", "翼人兵19・盾付与・身体筋魔75%・器用70%", 19, { str: 0.75, dex: 0.7, mag: 0.75 }],
    ["winged-20-shield-body75-dex65", "翼人兵20・盾付与・身体筋魔75%・器用65%", 20, { str: 0.75, dex: 0.65, mag: 0.75 }],
    ["winged-21-shield-body75-dex65", "翼人兵21・盾付与・身体筋魔75%・器用65%", 21, { str: 0.75, dex: 0.65, mag: 0.75 }],
    ["winged-22-shield-body75-dex625", "翼人兵22・盾付与・身体筋魔75%・器用62.5%", 22, { str: 0.75, dex: 0.625, mag: 0.75 }],
    ["winged-23-shield-body75-dex60", "翼人兵23・盾付与・身体筋魔75%・器用60%", 23, { str: 0.75, dex: 0.6, mag: 0.75 }],
    ["winged-24-shield-body75-dex60", "翼人兵24・盾付与・身体筋魔75%・器用60%", 24, { str: 0.75, dex: 0.6, mag: 0.75 }],
    ["winged-25-shield-body70-dex55", "翼人兵25・盾付与・身体筋魔70%・器用55%", 25, { str: 0.7, dex: 0.55, mag: 0.7 }]
  ].map(([id, label, count, multipliers]) =>
    createCompositionCandidate(
      id,
      label,
      [{ raiderType: "翼人兵", count }],
      createShieldProfile(multipliers)
    )
  )
);

const UPPER_RAID_COMPOSITION_CANDIDATES = Object.freeze({
  "holy-crusade-strong": HOLY_COMPOSITION_CANDIDATES,
  "winged-punishment-strong": WINGED_COMPOSITION_CANDIDATES
});
const RECRUITMENT_TRAITS = new Set(["達人農夫", "歴戦", "緑の指"]);

function countTrait(people, trait) {
  return people.filter(person =>
    (person.bodyTraits || []).includes(trait) || (person.mindTraits || []).includes(trait)
  ).length;
}

function createPreparedVillager(index) {
  const person = new Villager(`試験村人${String(index + 1).padStart(2, "0")}`, index % 2 === 0 ? "男" : "女", 20 + index);
  const stats = {
    str: 20,
    vit: 20,
    dex: 20,
    mag: 20,
    chr: 20,
    int: 20,
    ind: 20,
    eth: 20,
    cou: 20,
    sexdr: 20
  };
  if (index < 8) {
    stats.str = 25;
    stats.vit = 25;
    stats.cou = 25;
    person.action = "迎撃";
  } else if (index < 12) {
    stats.dex = 25;
    stats.vit = 25;
    stats.cou = 25;
    person.action = "射撃";
  } else {
    stats.dex = 25;
    stats.int = 25;
    person.action = "罠作成";
  }
  setBaseStats(person, stats);
  person.preferredAction = "なし";
  person.job = "なし";
  person.hp = 100;
  person.mp = 100;
  person.happiness = 50;
  person.bodyTraits = [];
  person.mindTraits = [];
  return person;
}

function applyPreparedBuildings(village) {
  village.buildings = [];
  village.damagedBuildings = [];
  village.buildingFlags = {};
  village.building = 0;
  village.nonHousePopLimitBonus = 0;
  village.popLimit = 8;

  BUILDINGS.forEach(building => {
    if (EXCLUDED_UPPER_BUILDINGS.has(building.id)) return;
    const count = UPPER_BUILDING_COUNTS[building.id] || 1;
    for (let index = 0; index < count; index++) {
      village.buildings.push(building.id);
      building.effect(village);
    }
  });
}

function applyUpperRaidFixture(api, month) {
  const village = api.getVillage();
  village.year = 1195;
  village.month = month;
  village.gameOver = false;
  village.villagers = Array.from({ length: 15 }, (_, index) => createPreparedVillager(index));
  village.visitors = [];
  village.captives = [];
  village.secretTreasures = [];
  village.villageTraits = [SEASON_BY_MONTH.get(month)];
  village.pendingRaid = null;
  village.raidEnemies = [];
  village.currentRaid = null;
  village.isRaidProcessDone = false;
  village.isRaidFinalizing = false;
  village.raidTurnCount = 0;
  village.raidActionQueue = [];
  village.raidPhase = "";
  village.currentActionIndex = 0;
  village.defeatedRaidEnemies = [];
  village.apocalypseStarted = false;
  village.apocalypseStage = 0;
  village.apocalypseCleared = false;
  applyPreparedBuildings(village);
  village.scaleTitleStage = getVillageScaleStage(village.building).index;
  village.food = 900;
  village.materials = 450;
  village.funds = 0;
  village.tech = 0;
  village.mana = 0;
  village.divineMight = 0;
  village.security = 60;
  village.logs = [];
  village.historyEvents = [];
  api.refreshUI();
  return village;
}

function assignPreparedRaidActions(village) {
  village.villagers.forEach((person, index) => {
    person.action = index < 8 ? "迎撃" : (index < 12 ? "射撃" : "罠作成");
  });
}

function countBy(values, getKey) {
  return values.reduce((counts, value) => {
    const key = getKey(value) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function summarizeRecoveryState(village) {
  const villagers = village.villagers || [];
  return {
    injured: countTrait(villagers, "負傷"),
    minimumHp: villagers.length > 0 ? Math.min(...villagers.map(person => Number(person.hp) || 0)) : 0,
    minimumMp: villagers.length > 0 ? Math.min(...villagers.map(person => Number(person.mp) || 0)) : 0,
    below80Hp: villagers.filter(person => (Number(person.hp) || 0) < 80).length,
    below80Mp: villagers.filter(person => (Number(person.mp) || 0) < 80).length,
    below80Either: villagers.filter(person =>
      (Number(person.hp) || 0) < 80 || (Number(person.mp) || 0) < 80
    ).length,
    actions: countBy(villagers, person => person.action)
  };
}

function applyUpperRaidSensitivity(village, candidate) {
  if (!candidate) return;
  village.raidEnemies.forEach(enemy => {
    enemy.hp = Math.ceil((Number(enemy.hp) || 0) * candidate.enemyHpMultiplier);
    ["str", "dex", "mag"].forEach(key => {
      enemy[key] = (Number(enemy[key]) || 0) * candidate.enemyOffenseMultiplier;
    });
  });
}

function applyCompositionProfile(village, candidate) {
  const profile = candidate?.profile;
  if (!profile) return;
  village.raidEnemies.forEach(enemy => {
    const bodyStats = {};
    Object.entries(profile.bodyStatMultipliers || {}).forEach(([key, multiplier]) => {
      bodyStats[key] = (Number(enemy.baseStats?.[key]) || 0) * Number(multiplier);
    });
    if (Object.keys(bodyStats).length > 0) setBaseStats(enemy, bodyStats);
    enemy.mindTraits = Array.isArray(enemy.mindTraits) ? enemy.mindTraits : [];
    (profile.addMindTraits || []).forEach(trait => {
      if (!enemy.mindTraits.includes(trait)) enemy.mindTraits.push(trait);
    });
    syncEffectiveStats(enemy);
  });
}

function summarizeEnemyStrength(enemies) {
  const stats = ["hp", "str", "vit", "dex", "mag", "chr"];
  const summarize = getValue => Object.fromEntries(stats.map(stat => {
    const values = enemies.map(enemy => Number(getValue(enemy, stat)) || 0);
    return [stat, {
      average: values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      maximum: values.length > 0 ? Math.max(...values) : 0
    }];
  }));
  return {
    transferableBody: summarize((enemy, stat) => stat === "hp" ? enemy.hp : enemy.baseStats?.[stat]),
    transferableBodyTraits: countBy(
      enemies.flatMap(enemy => enemy.bodyTraits || []),
      trait => trait
    ),
    effective: summarize((enemy, stat) => enemy[stat]),
    mindTraits: countBy(
      enemies.flatMap(enemy => enemy.mindTraits || []),
      trait => trait
    )
  };
}

function applyDirectedRecovery(village) {
  village.villagers.forEach(person => {
    if (person.action === "療養" || (person.hp >= 80 && person.mp >= 80)) return;
    const preferred = person.hp <= person.mp ? "休養" : "余暇";
    const fallback = preferred === "休養" ? "余暇" : "休養";
    if (person.actionTable.includes(preferred)) person.action = preferred;
    else if (person.actionTable.includes(fallback)) person.action = fallback;
  });
}

function getRaidOutcome(village) {
  const resultLog = [...(village.logs || [])]
    .reverse()
    .find(log => String(log).startsWith("[DEBUG] 襲撃結果"));
  if (!resultLog) return null;
  if (resultLog.includes("成功:true 部分成功:true")) return "partial";
  if (resultLog.includes("成功:true 部分成功:false")) return "complete";
  return "failure";
}

function getRaidResultReason(village) {
  return [...(village.logs || [])]
    .reverse()
    .find(log => String(log).startsWith("【襲撃結果】")) || null;
}

async function resolveActiveRaid({ api, frame }) {
  const village = api.getVillage();
  await drainKnownModals(frame);
  api.nextTurn();
  await waitUntil(
    () => frame.contentDocument?.getElementById("raidModal")?.style.display === "block",
    { reason: "raid_modal_timeout" }
  );

  for (let step = 0; step < 1200; step++) {
    if (!village.villageTraits.includes("襲撃中") && !village.isRaidFinalizing) break;
    if (village.isRaidFinalizing) {
      await waitUntil(() => !village.isRaidFinalizing, {
        timeoutMs: 10000,
        reason: "raid_finalization_timeout"
      });
      break;
    }
    api.proceedRaidAction();
    await waitUntil(() => {
      const button = frame.contentDocument?.getElementById("raidStepButton");
      return village.isRaidFinalizing || village.isRaidProcessDone || !button || !button.disabled;
    }, { timeoutMs: 10000, reason: "raid_action_timeout" });
  }

  await waitUntil(
    () => !village.villageTraits.includes("襲撃中") && !village.isRaidFinalizing,
    { timeoutMs: 30000, reason: "raid_resolution_timeout" }
  );
  await drainKnownModals(frame);
  return getRaidOutcome(village);
}

async function runUpperRaid({
  api,
  frame,
  raidId,
  month,
  recovery = false,
  recoveryPolicy = "auto",
  sensitivityCandidate = null,
  compositionCandidate = null
}) {
  const village = applyUpperRaidFixture(api, month);
  const randomCallsAfterFixture = api.seed?.calls ?? null;
  if (recovery) api.setSimulationOptions(RECOVERY_OPTIONS);
  const initial = createVillageSnapshot(village);
  api.startRaidById(raidId, compositionCandidate?.enemyGroups || null);
  applyCompositionProfile(village, compositionCandidate);
  applyUpperRaidSensitivity(village, sensitivityCandidate);
  const randomCallsAfterRaidCreation = api.seed?.calls ?? null;
  assignPreparedRaidActions(village);
  const enemyRefs = village.raidEnemies.slice();
  const villagerRefs = village.villagers.slice();
  const enemyInitial = {
    types: countBy(enemyRefs, enemy => enemy.raiderType),
    hp: enemyRefs.reduce((sum, enemy) => sum + (Number(enemy.hp) || 0), 0),
    strength: summarizeEnemyStrength(enemyRefs)
  };
  const enemyCount = village.raidEnemies.length;
  const assignments = village.villagers.reduce((counts, person) => {
    counts[person.action] = (counts[person.action] || 0) + 1;
    return counts;
  }, {});
  const outcome = await resolveActiveRaid({ api, frame });
  if (!outcome) throw new Error("raid_outcome_missing");

  const postRaid = createVillageSnapshot(village);
  const raidDamage = {
    outcome,
    resultReason: getRaidResultReason(village),
    enemyCount,
    enemyTypes: enemyInitial.types,
    enemyInitialHp: enemyInitial.hp,
    enemyStrength: enemyInitial.strength,
    enemyRemaining: outcome === "complete"
      ? 0
      : enemyRefs.filter(enemy => (Number(enemy.hp) || 0) > 0).length,
    enemyRemainingHp: outcome === "complete"
      ? 0
      : enemyRefs.reduce((sum, enemy) => sum + Math.max(0, Number(enemy.hp) || 0), 0),
    assignments,
    turns: Number(village.raidTurnCount) || 0,
    villagersRemaining: village.villagers.length,
    combatantsDown: villagerRefs.slice(0, 12).filter(person => (Number(person.hp) || 0) <= 0).length,
    defendersDown: villagerRefs.slice(0, 8).filter(person => (Number(person.hp) || 0) <= 0).length,
    shootersDown: villagerRefs.slice(8, 12).filter(person => (Number(person.hp) || 0) <= 0).length,
    injured: countTrait(village.villagers, "負傷"),
    critical: countTrait(village.villagers, "重体"),
    dying: countTrait(village.villagers, "危篤"),
    damagedBuildings: village.damagedBuildings.length,
    averageHp: postRaid.population.averageHp,
    averageMp: postRaid.population.averageMp,
    recoveryState: summarizeRecoveryState(village),
    sensitivityCandidate: sensitivityCandidate?.id || null,
    compositionCandidate: compositionCandidate?.id || null
  };
  const randomCheckpoints = {
    afterFixture: randomCallsAfterFixture,
    afterRaidCreation: randomCallsAfterRaidCreation,
    afterRaid: api.seed?.calls ?? null
  };

  if (!recovery || outcome === "failure") {
    return { initial, postRaid, raidDamage, randomCheckpoints, recovery: null };
  }

  let recoveryMonths = isRecovered(village) ? 0 : null;
  const recoveryCheckpoints = [];
  for (let monthIndex = 1; monthIndex <= 12 && recoveryMonths == null && !village.gameOver; monthIndex++) {
    api.autoAssignJobs();
    if (recoveryPolicy === "directed80") applyDirectedRecovery(village);
    api.nextTurn();
    await drainKnownModals(frame);
    const snapshot = createVillageSnapshot(village);
    recoveryCheckpoints.push({
      elapsedMonths: monthIndex,
      snapshot,
      recoveryState: summarizeRecoveryState(village)
    });
    if (isRecovered(village)) recoveryMonths = monthIndex;
  }

  return {
    initial,
    postRaid,
    raidDamage,
    randomCheckpoints,
    recovery: {
      eligible: true,
      policy: recoveryPolicy,
      playerModelVersion: recoveryPolicy === "directed80" ? RECOVERY_PLAYER_MODEL_VERSION : null,
      recovered: recoveryMonths != null,
      months: recoveryMonths,
      checkpoints: recoveryCheckpoints
    }
  };
}

function isRecovered(village) {
  return countTrait(village.villagers, "負傷") === 0 &&
    village.villagers.every(person => person.hp >= 80 && person.mp >= 80);
}

function hasRecruitmentValue(visitor) {
  if ([...(visitor.bodyTraits || []), ...(visitor.mindTraits || [])].some(trait => RECRUITMENT_TRAITS.has(trait))) {
    return true;
  }
  const major = [visitor.str, visitor.vit, visitor.dex, visitor.int, visitor.ind, visitor.cou]
    .map(value => Number(value) || 0)
    .sort((a, b) => b - a);
  return (major[0] + major[1]) / 2 >= 20;
}

function assignShortageWorkers(village, actionNames, requestedCount, score, assigned) {
  const candidates = village.villagers
    .filter(person => !assigned.has(person) && person.hp > 0 && actionNames.some(action => (person.actionTable || []).includes(action)))
    .sort((a, b) => score(b) - score(a));
  let changed = 0;
  for (const person of candidates) {
    if (changed >= requestedCount) break;
    const action = actionNames.find(candidate => (person.actionTable || []).includes(candidate));
    if (!action || person.action === action) continue;
    person.action = action;
    assigned.add(person);
    changed++;
  }
  return changed;
}

function correctObviousShortages(village) {
  const snapshot = createVillageSnapshot(village);
  const workingAdults = Math.max(1, snapshot.population.workingAdults);
  const assigned = new Set();
  let changed = 0;
  const foodDeficit = Math.max(0, snapshot.stability.foodConsumption * 3 - village.food);
  if (foodDeficit > 0) {
    const requested = Math.min(Math.ceil(workingAdults / 2), Math.max(1, Math.ceil(foodDeficit / 20)));
    changed += assignShortageWorkers(
      village,
      ["農作業", "漁", "狩猟"],
      requested,
      person => (Number(person.str) || 0) + (Number(person.ind) || 0) + (Number(person.dex) || 0),
      assigned
    );
  }

  const materialDeficit = Math.max(0, snapshot.stability.winterMaterialsTarget - village.materials);
  if (materialDeficit > 0) {
    const requested = Math.min(Math.ceil(workingAdults / 2), Math.max(1, Math.ceil(materialDeficit / 20)));
    changed += assignShortageWorkers(
      village,
      ["伐採"],
      requested,
      person => (Number(person.str) || 0) + (Number(person.vit) || 0) + (Number(person.ind) || 0),
      assigned
    );
  }
  return changed;
}

async function tryRecruitUsefulVisitor({ api, frame }) {
  const village = api.getVillage();
  if (village.villagers.length >= village.popLimit) return false;
  const currentFoodCost = village.villagers.reduce((sum, person) => sum + getVillagerFoodConsumption(person), 0);
  const visitor = village.visitors.find(person =>
    !(person.mindTraits || []).includes("勧誘失敗") &&
    hasRecruitmentValue(person) &&
    village.food >= (currentFoodCost + getVillagerFoodConsumption(person)) * 3
  );
  if (!visitor) return false;

  const opened = await api.openVisitorConversation(visitor.name);
  if (!opened) return false;
  const recruitButton = frame.contentDocument.getElementById("recruitButton");
  if (!recruitButton || recruitButton.disabled) {
    frame.contentWindow.closeConversationModal();
    return false;
  }
  recruitButton.click();
  const select = frame.contentDocument.getElementById("recruiterSelect");
  const button = frame.contentDocument.getElementById("doRecruitment");
  if (!select || !button || button.disabled) return false;

  const candidates = village.villagers
    .filter(person => !person.socialAttemptedThisMonth)
    .sort((a, b) => (b.chr + b.int) - (a.chr + a.int));
  if (candidates.length === 0) return false;
  select.value = candidates[0].name;
  select.dispatchEvent(new frame.contentWindow.Event("change", { bubbles: true }));
  button.click();
  await drainKnownModals(frame);
  return true;
}

function getSafeBuildingPriority(village) {
  const builtCount = id => village.buildings.filter(buildingId => buildingId === id).length;
  const populationTight = village.popLimit - village.villagers.length <= 1;
  const priorities = [];
  if (village.pendingRaid || village.villageTraits.includes("襲撃中")) {
    priorities.push("watchtower", "woodenFence", "moat");
  }
  if (populationTight) priorities.push("house");
  priorities.push(
    "barn", "clinic", "huntingLodge", "dock", "market", "watermill",
    "storehouse", "tavern", "church", "library", "assemblyHall",
    "watchtower", "woodenFence", "moat", "weaving", "alchemy", "brewery",
    "holdingCell", "prison", "fountain"
  );
  if (!populationTight && builtCount("house") < 4) priorities.push("house");
  return [...new Set(priorities)];
}

function findBuildingItem(documentRef, buildingName) {
  return [...documentRef.querySelectorAll(".building-item")]
    .find(item => item.querySelector("h4")?.textContent.trim() === buildingName) || null;
}

async function maintainOrBuild({ api, frame }) {
  const village = api.getVillage();
  const snapshot = createVillageSnapshot(village);
  if (!snapshot.stability.hasThreeMonthsFood) return false;
  api.openBuildingModal();
  const documentRef = frame.contentDocument;
  const winterTarget = snapshot.stability.winterMaterialsTarget;

  for (const buildingId of village.damagedBuildings) {
    const definition = BUILDINGS.find(building => building.id === buildingId);
    if (!definition) continue;
    const repairMaterials = Math.ceil((Number(definition.materials) || 0) / 2);
    if (village.materials - repairMaterials < winterTarget) continue;
    const item = findBuildingItem(documentRef, definition.name);
    const repairButton = item?.querySelector(".building-button.repair:not(:disabled)");
    if (repairButton) {
      repairButton.click();
      frame.contentWindow.closeBuildingModal();
      await drainKnownModals(frame);
      return true;
    }
  }

  for (const buildingId of getSafeBuildingPriority(village)) {
    if (EXCLUDED_UPPER_BUILDINGS.has(buildingId)) continue;
    const definition = BUILDINGS.find(building => building.id === buildingId);
    if (!definition || village.materials - (Number(definition.materials) || 0) < winterTarget) continue;
    const item = findBuildingItem(documentRef, definition.name);
    const buildButton = item?.querySelector(".building-button:not(.repair):not(.destroy):not(:disabled)");
    if (buildButton) {
      buildButton.click();
      frame.contentWindow.closeBuildingModal();
      await drainKnownModals(frame);
      return true;
    }
  }

  frame.contentWindow.closeBuildingModal();
  return false;
}

async function runStandardProgression({ api, frame }) {
  const village = api.getVillage();
  const initial = createVillageSnapshot(village);
  const checkpoints = [];
  const counters = {
    raids: 0,
    raidOutcomes: { complete: 0, partial: 0, failure: 0 },
    recruitAttempts: 0,
    buildingActions: 0,
    manualAssignments: 0
  };

  for (let elapsedMonths = 1; elapsedMonths <= 36 && !village.gameOver; elapsedMonths++) {
    await drainKnownModals(frame);
    if (village.villageTraits.includes("襲撃中")) {
      api.autoAssignRaidActions();
      const outcome = await resolveActiveRaid({ api, frame });
      counters.raids++;
      if (outcome) counters.raidOutcomes[outcome]++;
    } else {
      api.autoAssignJobs();
      counters.manualAssignments += correctObviousShortages(village);
      if (await tryRecruitUsefulVisitor({ api, frame })) counters.recruitAttempts++;
      if (await maintainOrBuild({ api, frame })) counters.buildingActions++;
      api.nextTurn();
      await drainKnownModals(frame);
    }

    if ([12, 24, 36].includes(elapsedMonths)) {
      checkpoints.push({ elapsedMonths, snapshot: createVillageSnapshot(village) });
    }
  }

  return {
    status: "completed",
    playerModelVersion: STANDARD_PLAYER_MODEL_VERSION,
    initial,
    checkpoints,
    counters,
    final: createVillageSnapshot(village)
  };
}

function createUpperRaidScenario(raid, month, recovery) {
  const suffix = recovery ? "recovery" : "raid";
  return {
    id: `upper-${suffix}-${raid.id}-${month}`,
    name: `${recovery ? "上位襲撃後復旧" : "上位襲撃"}：${raid.label}・${month}月`,
    async run(context) {
      const result = await runUpperRaid({ ...context, raidId: raid.id, month, recovery });
      return {
        status: "completed",
        raidId: raid.id,
        startMonth: month,
        ...result,
        final: createVillageSnapshot(context.api.getVillage())
      };
    }
  };
}

function createDirectedRecoveryScenario(raid) {
  return {
    id: `upper-recovery-directed-${raid.id}-4`,
    name: `上位襲撃後復旧（80まで休養）：${raid.label}・4月`,
    async run(context) {
      const result = await runUpperRaid({
        ...context,
        raidId: raid.id,
        month: 4,
        recovery: true,
        recoveryPolicy: "directed80"
      });
      return {
        status: "completed",
        raidId: raid.id,
        startMonth: 4,
        ...result,
        final: createVillageSnapshot(context.api.getVillage())
      };
    }
  };
}

function createSensitivityScenario(raid, candidate) {
  return {
    id: `upper-sensitivity-${raid.id}-4-${candidate.id}`,
    name: `上位襲撃感度：${raid.label}・4月・${candidate.label}`,
    async run(context) {
      const result = await runUpperRaid({
        ...context,
        raidId: raid.id,
        month: 4,
        sensitivityCandidate: candidate
      });
      return {
        status: "completed",
        raidId: raid.id,
        startMonth: 4,
        sensitivityCandidate: candidate,
        ...result,
        final: createVillageSnapshot(context.api.getVillage())
      };
    }
  };
}

function createCompositionScenario(raid, candidate) {
  return {
    id: `upper-composition-${raid.id}-4-${candidate.id}`,
    name: `上位襲撃構成探索：${raid.label}・4月・${candidate.label}`,
    async run(context) {
      const result = await runUpperRaid({
        ...context,
        raidId: raid.id,
        month: 4,
        compositionCandidate: candidate
      });
      return {
        status: "completed",
        raidId: raid.id,
        startMonth: 4,
        compositionCandidate: candidate,
        ...result,
        final: createVillageSnapshot(context.api.getVillage())
      };
    }
  };
}

const scenarioList = [
  {
    id: "initial-state",
    name: "初期状態の再現確認",
    async run({ api }) {
      return {
        status: "completed",
        checkpoints: [{ elapsedMonths: 0, snapshot: createVillageSnapshot(api.getVillage()) }],
        final: createVillageSnapshot(api.getVillage())
      };
    }
  },
  {
    id: "normal-standard-36",
    name: "通常進行：標準プレイヤー・36か月",
    run: runStandardProgression
  },
  ...UPPER_RAIDS.flatMap(raid => UPPER_RAID_MONTHS.map(month => createUpperRaidScenario(raid, month, false))),
  ...UPPER_RAIDS.flatMap(raid => UPPER_RAID_MONTHS.map(month => createUpperRaidScenario(raid, month, true))),
  ...UPPER_RAIDS.map(createDirectedRecoveryScenario),
  ...UPPER_RAIDS.flatMap(raid =>
    UPPER_RAID_SENSITIVITY_CANDIDATES.map(candidate => createSensitivityScenario(raid, candidate))
  ),
  ...UPPER_RAIDS.flatMap(raid =>
    (UPPER_RAID_COMPOSITION_CANDIDATES[raid.id] || [])
      .map(candidate => createCompositionScenario(raid, candidate))
  )
];

export const SCENARIOS = Object.freeze(scenarioList);

export function getScenario(id) {
  return SCENARIOS.find(scenario => scenario.id === id) || null;
}
