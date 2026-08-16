import { Villager } from "../../js/classes.js";
import { getExpectedDefenderDamage } from "../../js/autoAssign.js";
import { BUILDINGS } from "../../js/buildings.js";
import { getRaidModuleById, getRaidRulesById, RAID_SCALE_TABLES } from "../../js/data/raidData.js";
import { isSaltPillar } from "../../js/domain/apocalypseRules.js";
import { isWolf } from "../../js/domain/speciesTraits.js";
import { setBaseStats, syncEffectiveStats } from "../../js/domain/statLayers.js";
import { canDefendInRaid, getRaidActionBlockReason } from "../../js/raidRules.js";
import { getVillagerFoodConsumption, getVillagerWinterMaterialConsumption } from "../../js/util.js";
import { getVillageScaleStage } from "../../js/villageScale.js";
import { createVillageSnapshot } from "./resultSchema.js?v=20260815-balance-37";
import { drainKnownModals, waitUntil } from "./modalDriver.js?v=20260814-balance-24";

export const SCENARIO_VERSION = 23;
export const BEGINNER_PLAYER_MODEL_VERSION = 2;
export const STANDARD_PLAYER_MODEL_VERSION = 3;
export const EXPERT_PLAYER_MODEL_VERSION = 4;
export const RECOVERY_PLAYER_MODEL_VERSION = 1;

const ECONOMIC_BREAKDOWN_MAX_POPULATION = 12;
const ECONOMIC_BREAKDOWN_DESPAIR_DEPARTURES = 3;

const UPPER_RAIDS = [
  { id: "holy-crusade-strong", label: "聖征騎士団（強）" },
  { id: "winged-punishment-strong", label: "翼人兵（強）" }
];
const UPPER_RAID_MONTHS = [2, 4, 7, 9];
const RAID_STRESS_SCALES = Object.freeze([
  { id: "mapped-village", label: "旅人の立ち寄る村", stage: 3, scale: 120, heresy: false },
  { id: "rich-village", label: "豊かな村", stage: 4, scale: 180, heresy: false },
  { id: "prosperous-village", label: "繁栄した郷村", stage: 5, scale: 250, heresy: false },
  { id: "autonomous-settlement", label: "自治集落", stage: 6, scale: 350, heresy: false },
  { id: "heresy-prosperous-village", label: "繁栄した郷村（異端）", stage: 5, scale: 250, heresy: true },
  { id: "heresy-autonomous-settlement", label: "自治集落（異端）", stage: 6, scale: 350, heresy: true }
]);
const RAID_STRESS_PREPARATIONS = Object.freeze({
  full: {
    id: "full",
    label: "万全",
    hpRange: [70, 100],
    mpRange: [70, 100],
    foodMonths: 6,
    materialMonths: 6,
    fundsPerVillager: 100
  },
  normal: {
    id: "normal",
    label: "普通",
    hpRange: [50, 80],
    mpRange: [50, 80],
    foodMonths: 3,
    materialMonths: 3,
    fundsPerVillager: 50
  }
});
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

function getStressRoleCounts(scale, preparation) {
  const maximumShooters = scale.stage - 2;
  if (preparation.id === "full") {
    return {
      front: scale.stage === 3 ? 7 : 8,
      middle: maximumShooters,
      rear: 3
    };
  }
  return {
    front: scale.stage === 3 ? 5 : 6,
    middle: Math.max(1, maximumShooters - 1),
    rear: 2
  };
}

function getStressValue(range, index, offset) {
  const [minimum, maximum] = range;
  return minimum + ((index * 5 + offset * 3) % (maximum - minimum + 1));
}

function createRaidStressVillager(index, role, preparation) {
  const person = new Villager(
    `負荷試験${role === "front" ? "前衛" : (role === "middle" ? "中衛" : "後衛")}${String(index + 1).padStart(2, "0")}`,
    index % 2 === 0 ? "男" : "女",
    20 + (index % 20)
  );
  const stats = {
    str: 18,
    vit: 18,
    dex: 18,
    mag: 18,
    chr: 18,
    int: 18,
    ind: 18,
    eth: 18,
    cou: 18,
    sexdr: 18
  };
  const relatedStats = role === "front"
    ? ["str", "vit", "cou"]
    : (role === "middle" ? ["dex", "vit", "cou"] : ["dex", "int"]);
  relatedStats.forEach((stat, statIndex) => {
    stats[stat] = 18 + ((index * 2 + statIndex * 3) % 7);
  });
  setBaseStats(person, stats);
  person.action = role === "front" ? "迎撃" : (role === "middle" ? "射撃" : "罠作成");
  person.preferredAction = "なし";
  person.job = "なし";
  person.hp = getStressValue(preparation.hpRange, index, role === "front" ? 0 : (role === "middle" ? 1 : 2));
  person.mp = getStressValue(preparation.mpRange, index, role === "front" ? 2 : (role === "middle" ? 1 : 0));
  person.happiness = 50;
  person.bodyTraits = [];
  person.mindTraits = [];
  return person;
}

function applyRaidStressBuildings(village, scale, preparation) {
  const maximumWatchtowers = scale.stage - 2;
  const watchtowerCount = preparation.id === "full"
    ? maximumWatchtowers
    : Math.max(1, maximumWatchtowers - 1);
  village.buildings = ["woodenFence"];
  if (scale.stage >= 4) village.buildings.push("moat");
  for (let index = 0; index < watchtowerCount; index++) village.buildings.push("watchtower");
  village.damagedBuildings = [];
  village.buildingFlags = {
    hasWoodenFence: true,
    hasMoat: scale.stage >= 4,
    hasWatchtower: watchtowerCount > 0
  };
  village.building = scale.scale;
  village.scaleTitleStage = scale.stage;
  village.nonHousePopLimitBonus = 0;
}

function applyRaidStressFixture(api, scale, preparation) {
  const village = api.getVillage();
  const roleCounts = getStressRoleCounts(scale, preparation);
  const roles = [
    ...Array.from({ length: roleCounts.front }, () => "front"),
    ...Array.from({ length: roleCounts.middle }, () => "middle"),
    ...Array.from({ length: roleCounts.rear }, () => "rear")
  ];
  village.year = 1195;
  village.month = 4;
  village.gameOver = false;
  village.villagers = roles.map((role, index) => createRaidStressVillager(index, role, preparation));
  village.visitors = [];
  village.captives = [];
  village.secretTreasures = [];
  village.villageTraits = scale.heresy ? ["春", "異端"] : ["春"];
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
  applyRaidStressBuildings(village, scale, preparation);
  village.popLimit = village.villagers.length;
  const foodConsumption = village.villagers.reduce(
    (sum, person) => sum + getVillagerFoodConsumption(person),
    0
  );
  const materialConsumption = village.villagers.reduce(
    (sum, person) => sum + getVillagerWinterMaterialConsumption(person),
    0
  );
  village.food = foodConsumption * preparation.foodMonths;
  village.materials = materialConsumption * preparation.materialMonths;
  village.funds = village.villagers.length * preparation.fundsPerVillager;
  village.tech = 0;
  village.mana = 0;
  village.divineMight = 0;
  village.security = 60;
  village.logs = [];
  village.historyEvents = [];
  api.refreshUI();
  return { village, roleCounts };
}

function assignRaidStressActions(village, roleCounts) {
  village.villagers.forEach((person, index) => {
    person.action = index < roleCounts.front
      ? "迎撃"
      : (index < roleCounts.front + roleCounts.middle ? "射撃" : "罠作成");
  });
}

function sumUnitHp(units) {
  return units.reduce((sum, unit) => sum + Math.max(0, Number(unit?.hp) || 0), 0);
}

function captureRoleHp(telemetry) {
  return Object.fromEntries(["front", "middle", "rear"].map(role => [
    role,
    sumUnitHp(telemetry.villagerRefs.filter(person => telemetry.roleByVillager.get(person) === role))
  ]));
}

function recordRaidStressStep(telemetry, actor, enemyHpBefore, roleHpBefore) {
  const enemyHpLost = Math.max(0, enemyHpBefore - sumUnitHp(telemetry.enemyRefs));
  if (enemyHpLost > 0) {
    const actorRole = telemetry.roleByVillager.get(actor);
    const role = actorRole || (actor?.raiderType ? "front" : null);
    if (role) {
      telemetry.damageByRole[role] += enemyHpLost;
      telemetry.actionsByRole[role]++;
    }
  }
  const roleHpAfter = captureRoleHp(telemetry);
  ["front", "middle", "rear"].forEach(role => {
    telemetry.hpLossByRole[role] += Math.max(0, roleHpBefore[role] - roleHpAfter[role]);
  });
}

function createRaidStressTelemetry(villagerRefs, enemyRefs) {
  const roleByVillager = new Map(villagerRefs.map(person => [
    person,
    person.action === "迎撃" ? "front" : (person.action === "射撃" ? "middle" : "rear")
  ]));
  return {
    villagerRefs,
    enemyRefs,
    roleByVillager,
    damageByRole: { front: 0, middle: 0, rear: 0 },
    hpLossByRole: { front: 0, middle: 0, rear: 0 },
    actionsByRole: { front: 0, middle: 0, rear: 0 }
  };
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

async function resolveActiveRaid({ api, frame, telemetry = null }) {
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
    const action = village.raidActionQueue[village.currentActionIndex];
    const enemyHpBefore = telemetry ? sumUnitHp(telemetry.enemyRefs) : 0;
    const roleHpBefore = telemetry ? captureRoleHp(telemetry) : null;
    api.proceedRaidAction();
    await waitUntil(() => {
      const button = frame.contentDocument?.getElementById("raidStepButton");
      return village.isRaidFinalizing || village.isRaidProcessDone || !button || !button.disabled;
    }, { timeoutMs: 10000, reason: "raid_action_timeout" });
    if (telemetry) recordRaidStressStep(telemetry, action?.actor, enemyHpBefore, roleHpBefore);
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

function summarizeStressRole(role, telemetry, villagerRefs, initialRoleHp) {
  const roleVillagers = villagerRefs.filter(person => telemetry.roleByVillager.get(person) === role);
  const effectiveDamage = telemetry.damageByRole[role];
  const totalDamage = Object.values(telemetry.damageByRole).reduce((sum, value) => sum + value, 0);
  return {
    participants: roleVillagers.length,
    effectiveDamage,
    damageShare: totalDamage > 0 ? effectiveDamage / totalDamage : 0,
    damagingActions: telemetry.actionsByRole[role],
    hpLost: Math.max(telemetry.hpLossByRole[role], initialRoleHp - sumUnitHp(roleVillagers)),
    down: roleVillagers.filter(person => (Number(person.hp) || 0) <= 0).length
  };
}

async function runRaidStressModule({ api, frame, scale, preparation, entry }) {
  api.seed?.reset?.();
  const { village, roleCounts } = applyRaidStressFixture(api, scale, preparation);
  const initial = createVillageSnapshot(village);
  api.seed?.reset?.();
  api.startRaidById(entry.raidId);
  assignRaidStressActions(village, roleCounts);
  const enemyRefs = village.raidEnemies.slice();
  const villagerRefs = village.villagers.slice();
  const telemetry = createRaidStressTelemetry(villagerRefs, enemyRefs);
  const initialRoleHp = captureRoleHp(telemetry);
  const enemyInitialHp = sumUnitHp(enemyRefs);
  const enemyTypes = countBy(enemyRefs, enemy => enemy.raiderType);
  const enemyStrength = summarizeEnemyStrength(enemyRefs);
  const outcome = await resolveActiveRaid({ api, frame, telemetry });
  if (!outcome) throw new Error(`raid_outcome_missing:${entry.raidId}`);
  const postRaid = createVillageSnapshot(village);
  const failurePenalty = getRaidRulesById(entry.raidId).failurePenalty || {};
  const lostResource = (resource, rate) => outcome === "failure"
    ? Math.floor((Number(initial.resources[resource]) || 0) * (Number(rate) || 0))
    : 0;
  const roles = Object.fromEntries(["front", "middle", "rear"].map(role => [
    role,
    summarizeStressRole(role, telemetry, villagerRefs, initialRoleHp[role])
  ]));
  const raidDefinition = getRaidModuleById(entry.raidId);
  return {
    raidId: entry.raidId,
    raidName: raidDefinition?.name || entry.raidId,
    tableWeight: entry.weight,
    outcome,
    resultReason: getRaidResultReason(village),
    roleCounts,
    enemyCount: enemyRefs.length,
    enemyTypes,
    enemyInitialHp,
    enemyRemaining: enemyRefs.filter(enemy => (Number(enemy.hp) || 0) > 0).length,
    enemyRemainingHp: sumUnitHp(enemyRefs),
    enemyStrength,
    turns: Number(village.raidTurnCount) || 0,
    damageContribution: {
      definition: "各行動で実際に減少した敵HP。前衛は反撃分を含む。",
      total: Object.values(telemetry.damageByRole).reduce((sum, value) => sum + value, 0),
      roles
    },
    damageTaken: {
      definition: "戦闘開始から襲撃終了処理後までの役割別HP損失。敗北時の全村被害を含む。",
      totalHpLost: Object.values(roles).reduce((sum, role) => sum + role.hpLost, 0),
      roles: Object.fromEntries(Object.entries(roles).map(([role, values]) => [role, {
        hpLost: values.hpLost,
        down: values.down
      }]))
    },
    casualties: {
      injured: countTrait(village.villagers, "負傷"),
      critical: countTrait(village.villagers, "重体"),
      dying: countTrait(village.villagers, "危篤"),
      villagersRemaining: village.villagers.length
    },
    losses: {
      definition: "襲撃失敗ペナルティだけを記録し、通常の月末消費は含めない。",
      food: lostResource("food", failurePenalty.foodRate),
      materials: lostResource("materials", failurePenalty.materialsRate),
      funds: lostResource("funds", failurePenalty.fundsRate),
      security: outcome === "failure" ? (Number(failurePenalty.security) || 0) : 0,
      happinessPerVillager: outcome === "failure" ? (Number(failurePenalty.villagerHappiness) || 0) : 0,
      damagedBuildings: postRaid.damagedBuildings.length
    },
    initial,
    postRaid,
    randomCalls: api.seed?.calls ?? null
  };
}

async function runRaidStress(context, scale, preparation) {
  const table = RAID_SCALE_TABLES.find(candidate => candidate.id === scale.id);
  if (!table) throw new Error(`raid_scale_table_missing:${scale.id}`);
  const entries = table.entries.filter(entry => Number(entry.weight) > 0);
  const modules = [];
  for (const entry of entries) {
    modules.push(await runRaidStressModule({
      ...context,
      scale,
      preparation,
      entry
    }));
  }
  return {
    status: "completed",
    raidStress: {
      scaleId: scale.id,
      scaleLabel: scale.label,
      scaleStage: scale.stage,
      heresy: scale.heresy,
      preparation: preparation.id,
      preparationLabel: preparation.label,
      relatedStatRange: [18, 24],
      modules
    },
    final: createVillageSnapshot(context.api.getVillage())
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

function correctObviousShortages(village, { foodMonths = 3, workerShare = 0.5 } = {}) {
  const snapshot = createVillageSnapshot(village);
  const workingAdults = Math.max(1, snapshot.population.workingAdults);
  const assigned = new Set();
  let changed = 0;
  const foodDeficit = Math.max(0, snapshot.stability.foodConsumption * foodMonths - village.food);
  if (foodDeficit > 0) {
    const requested = Math.min(Math.ceil(workingAdults * workerShare), Math.max(1, Math.ceil(foodDeficit / 20)));
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
    const requested = Math.min(Math.ceil(workingAdults * workerShare), Math.max(1, Math.ceil(materialDeficit / 20)));
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

function getVisibleShortageWarnings(village, foodMonths = 3) {
  const snapshot = createVillageSnapshot(village);
  return {
    food: village.food < snapshot.stability.foodConsumption * foodMonths,
    materials: village.materials < snapshot.stability.winterMaterialsTarget
  };
}

function assignExpertRecovery(village, { hpThreshold, mpThreshold, maxAssignments }) {
  let changed = 0;
  for (const person of village.villagers) {
    if (changed >= maxAssignments) break;
    if (person.hp <= 0 || person.action === "療養") continue;
    const nextAction = person.hp < hpThreshold ? "休養" : (person.mp < mpThreshold ? "余暇" : null);
    if (!nextAction || !(person.actionTable || []).includes(nextAction) || person.action === nextAction) continue;
    person.action = nextAction;
    changed++;
  }
  return changed;
}

const RAID_PREPARATION_TARGET = 3;
const RAID_DEFENDER_HP = 55;
const RAID_DEFENDER_MP = 20;
const RAID_RECOVERY_MIRACLES = Object.freeze({
  feast: { id: "4", label: "宴会の奇跡", hp: 20, mp: 20 },
  revel: { id: "5", label: "狂宴の奇跡", hp: 60, mp: 60 },
  heal: { id: "6", label: "癒しの奇跡" },
  goblet: { id: "16", label: "酒杯の奇跡" }
});
const ROUTINE_MIRACLES = Object.freeze({
  abundance: { id: "1", label: "豊穣の奇跡", mana: 100 },
  mana: { id: "2", label: "マナの奇跡", mana: 40 },
  feast: RAID_RECOVERY_MIRACLES.feast,
  heal: RAID_RECOVERY_MIRACLES.heal,
  goblet: RAID_RECOVERY_MIRACLES.goblet
});
const ABUNDANCE_FOOD_ACTIONS = new Set(["農作業", "狩猟", "漁", "採集", "醸造"]);
const ABUNDANCE_MATERIAL_ACTIONS = new Set(["伐採", "採集"]);
const RAID_HEALABLE_BODY_TRAITS = new Set(["負傷", "重体", "疲労", "過労", "飢餓", "疫病", "産褥", "凍え"]);
const RAID_HEALABLE_MIND_TRAITS = new Set(["心労", "抑鬱", "失望", "絶望"]);
const RAID_HEALABLE_BLOCK_REASONS = new Set(["体力尽き", "負傷", "重体", "過労", "疫病", "産褥", "抑鬱"]);

function isPotentialRaidDefender(person) {
  const blockReason = getRaidActionBlockReason(person, "迎撃");
  return (!blockReason || RAID_HEALABLE_BLOCK_REASONS.has(blockReason)) &&
    getExpectedDefenderDamage(person, { useBaseStats: true }) >= 8;
}

function isReadyRaidDefender(person, hpGain = 0, mpGain = 0) {
  return canDefendInRaid(person) && getExpectedDefenderDamage(person) >= 8 &&
    (Number(person.hp) || 0) + hpGain >= RAID_DEFENDER_HP &&
    (Number(person.mp) || 0) + mpGain >= RAID_DEFENDER_MP;
}

function hasAnyTrait(person, key, traits) {
  return (person[key] || []).some(trait => traits.has(trait));
}

function getReadyRaidDefenders(village, hpGain = 0, mpGain = 0) {
  return village.villagers.filter(person => isReadyRaidDefender(person, hpGain, mpGain));
}

function getFatiguedRaidDefenders(village) {
  return village.villagers
    .filter(person => isPotentialRaidDefender(person) && !isReadyRaidDefender(person))
    .sort((a, b) => {
      const damage = getExpectedDefenderDamage(b, { useBaseStats: true }) -
        getExpectedDefenderDamage(a, { useBaseStats: true });
      if (damage !== 0) return damage;
      return ((Number(b.hp) || 0) + (Number(b.mp) || 0)) -
        ((Number(a.hp) || 0) + (Number(a.mp) || 0));
    });
}

function summarizeRaidPreparation(village) {
  const villagers = village.villagers || [];
  const average = key => villagers.length > 0
    ? villagers.reduce((sum, person) => sum + (Number(person[key]) || 0), 0) / villagers.length
    : 0;
  return {
    readyDefenders: getReadyRaidDefenders(village).length,
    fatiguedDefenders: getFatiguedRaidDefenders(village).length,
    averageHp: average("hp"),
    averageMp: average("mp"),
    mana: Number(village.mana) || 0,
    funds: Number(village.funds) || 0
  };
}

function assignRaidWarningRecovery(village) {
  const readyCount = getReadyRaidDefenders(village).length;
  const needed = Math.max(0, RAID_PREPARATION_TARGET - readyCount);
  const targets = [];
  let changed = 0;

  for (const person of getFatiguedRaidDefenders(village).slice(0, needed)) {
    const actions = person.actionTable || [];
    const recoveryAction = (Number(person.hp) || 0) < RAID_DEFENDER_HP && actions.includes("休養")
      ? "休養"
      : ((Number(person.mp) || 0) < RAID_DEFENDER_MP && actions.includes("余暇") ? "余暇" : null);
    if (!recoveryAction) continue;
    targets.push(person.name);
    if (person.action !== recoveryAction) {
      person.action = recoveryAction;
      changed++;
    }
  }
  return { changed, targets };
}

function closeMiracleModalIfOpen(api, frame) {
  const modal = frame.contentDocument?.getElementById("miracleModal");
  if (modal && modal.style.display !== "none") api.closeMiracleModal();
}

async function tryPerformMiracle({ api, frame }, miracle, target = null) {
  const village = api.getVillage();
  const manaBefore = Number(village.mana) || 0;
  const fundsBefore = Number(village.funds) || 0;
  api.openMiracleModal();
  const select = frame.contentDocument.getElementById("miracleSelect");
  if (!select) {
    closeMiracleModalIfOpen(api, frame);
    return null;
  }
  select.value = miracle.id;
  api.onSelectMiracleChange();

  const targetSelect = frame.contentDocument.getElementById("targetA");
  if (target && targetSelect) {
    targetSelect.value = target.name;
    targetSelect.dispatchEvent(new frame.contentWindow.Event("change", { bubbles: true }));
  }

  const button = frame.contentDocument.querySelector(".miracle-item.active .miracle-button");
  if (!button || button.disabled) {
    closeMiracleModalIfOpen(api, frame);
    return null;
  }

  api.performMiracle();
  await drainKnownModals(frame);
  closeMiracleModalIfOpen(api, frame);
  const manaSpent = Math.max(0, manaBefore - (Number(village.mana) || 0));
  const fundsSpent = Math.max(0, fundsBefore - (Number(village.funds) || 0));
  if (manaSpent === 0 && fundsSpent === 0) return null;
  return {
    id: miracle.id,
    name: miracle.label,
    target: target?.name || null,
    manaSpent,
    fundsSpent,
    manaBefore,
    manaAfter: Number(village.mana) || 0
  };
}

async function tryUseRaidRecoveryMiracle(context, miracle, target = null) {
  const village = context.api.getVillage();
  const before = summarizeRaidPreparation(village);
  const used = await tryPerformMiracle(context, miracle, target);
  return used ? { ...used, before, after: summarizeRaidPreparation(village) } : null;
}

function canSpendSurplusMana(village, cost, reserve, fundsCost = 0) {
  return (Number(village.mana) || 0) - cost >= reserve &&
    (Number(village.funds) || 0) >= fundsCost;
}

function recoveryNeedScore(person, traitKey, traits, statKey) {
  return (hasAnyTrait(person, traitKey, traits) ? 100 : 0) +
    Math.max(0, 100 - (Number(person[statKey]) || 0));
}

async function useRoutineRecoveryMiracle(context, reserve) {
  const village = context.api.getVillage();
  const villagers = village.villagers.filter(person => !isSaltPillar(person));
  const bodyTarget = villagers
    .filter(person => hasAnyTrait(person, "bodyTraits", RAID_HEALABLE_BODY_TRAITS) || (Number(person.hp) || 0) < 40)
    .sort((a, b) => recoveryNeedScore(b, "bodyTraits", RAID_HEALABLE_BODY_TRAITS, "hp") -
      recoveryNeedScore(a, "bodyTraits", RAID_HEALABLE_BODY_TRAITS, "hp"))[0];
  const mindTarget = villagers
    .filter(person => hasAnyTrait(person, "mindTraits", RAID_HEALABLE_MIND_TRAITS) || (Number(person.mp) || 0) < 35)
    .sort((a, b) => recoveryNeedScore(b, "mindTraits", RAID_HEALABLE_MIND_TRAITS, "mp") -
      recoveryNeedScore(a, "mindTraits", RAID_HEALABLE_MIND_TRAITS, "mp"))[0];

  if (bodyTarget && canSpendSurplusMana(village, 80, reserve)) {
    const used = await tryPerformMiracle(context, ROUTINE_MIRACLES.heal, bodyTarget);
    if (used) return used;
  }
  if (mindTarget && canSpendSurplusMana(village, 50, reserve)) {
    const used = await tryPerformMiracle(context, ROUTINE_MIRACLES.goblet, mindTarget);
    if (used) return used;
  }

  const strained = villagers.filter(person =>
    (Number(person.hp) || 0) < 60 || (Number(person.mp) || 0) < 50
  );
  const feastCost = village.villagers.length * 15;
  if (strained.length >= 3 && canSpendSurplusMana(village, feastCost, reserve, feastCost)) {
    return tryPerformMiracle(context, ROUTINE_MIRACLES.feast);
  }
  return null;
}

async function useRoutineFoodMiracle(context, reserve, foodMonths) {
  const village = context.api.getVillage();
  const snapshot = createVillageSnapshot(village);
  if (snapshot.stability.foodConsumption === 0 ||
      village.food >= snapshot.stability.foodConsumption * foodMonths ||
      !canSpendSurplusMana(village, ROUTINE_MIRACLES.mana.mana, reserve)) {
    return null;
  }
  return tryPerformMiracle(context, ROUTINE_MIRACLES.mana);
}

async function useRoutineAbundanceMiracle(context, reserve) {
  const village = context.api.getVillage();
  const snapshot = createVillageSnapshot(village);
  const foodWorkers = village.villagers.filter(person => ABUNDANCE_FOOD_ACTIONS.has(person.action)).length;
  const materialWorkers = village.villagers.filter(person => ABUNDANCE_MATERIAL_ACTIONS.has(person.action)).length;
  const needsFoodBoost = snapshot.stability.foodConsumption > 0 &&
    village.food < snapshot.stability.foodConsumption * 4 && foodWorkers >= 2;
  const needsMaterialBoost = village.materials < snapshot.stability.winterMaterialsTarget && materialWorkers >= 2;
  if (village.villageTraits.includes("豊穣") || (!needsFoodBoost && !needsMaterialBoost) ||
      !canSpendSurplusMana(village, ROUTINE_MIRACLES.abundance.mana, reserve)) {
    return null;
  }
  return tryPerformMiracle(context, ROUTINE_MIRACLES.abundance);
}

async function useRaidPreparationMiracles(context) {
  const village = context.api.getVillage();
  const uses = [];
  if (getReadyRaidDefenders(village).length >= RAID_PREPARATION_TARGET) return uses;

  const fatiguedCount = getFatiguedRaidDefenders(village).length;
  const groupCandidates = [RAID_RECOVERY_MIRACLES.feast, RAID_RECOVERY_MIRACLES.revel];
  for (const miracle of groupCandidates) {
    const projected = getReadyRaidDefenders(village, miracle.hp, miracle.mp).length;
    if (fatiguedCount < 2 || projected < RAID_PREPARATION_TARGET) continue;
    const used = await tryUseRaidRecoveryMiracle(context, miracle);
    if (used) uses.push(used);
    if (getReadyRaidDefenders(village).length >= RAID_PREPARATION_TARGET) return uses;
  }

  const attempted = new Set();
  while (getReadyRaidDefenders(village).length < RAID_PREPARATION_TARGET) {
    const target = getFatiguedRaidDefenders(village).find(person => !attempted.has(person));
    if (!target) break;
    attempted.add(target);
    if ((Number(target.hp) || 0) < RAID_DEFENDER_HP || hasAnyTrait(target, "bodyTraits", RAID_HEALABLE_BODY_TRAITS)) {
      const used = await tryUseRaidRecoveryMiracle(context, RAID_RECOVERY_MIRACLES.heal, target);
      if (used) uses.push(used);
    }
    if (!isReadyRaidDefender(target) && (
      (Number(target.mp) || 0) < RAID_DEFENDER_MP ||
      hasAnyTrait(target, "mindTraits", RAID_HEALABLE_MIND_TRAITS)
    )) {
      const used = await tryUseRaidRecoveryMiracle(context, RAID_RECOVERY_MIRACLES.goblet, target);
      if (used) uses.push(used);
    }
  }
  return uses;
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

async function maintainOrBuild({ api, frame }, {
  foodMonths = 3,
  priorityOverride = null
} = {}) {
  const village = api.getVillage();
  const snapshot = createVillageSnapshot(village);
  if (village.food < snapshot.stability.foodConsumption * foodMonths) return false;
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

  const buildingPriority = priorityOverride
    ? [...new Set([...priorityOverride, ...getSafeBuildingPriority(village)])]
    : getSafeBuildingPriority(village);
  for (const buildingId of buildingPriority) {
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

export function observeCrisisState(village) {
  const villagers = Array.isArray(village.villagers) ? village.villagers : [];
  return {
    historyIndex: Array.isArray(village.historyEvents) ? village.historyEvents.length : 0,
    logIndex: Array.isArray(village.logs) ? village.logs.length : 0,
    populationBefore: villagers.length,
    year: Number(village.year) || 0,
    month: Number(village.month) || 0,
    snapshotBefore: createVillageSnapshot(village),
    villagersBefore: villagers.map(person => ({
      person,
      name: person.name,
      freezing: Array.isArray(person.bodyTraits) && person.bodyTraits.includes("凍え"),
      starvation: Array.isArray(person.bodyTraits) && person.bodyTraits.includes("飢餓"),
      freezingEligible: !isSaltPillar(person) && !isWolf(person),
      starvationEligible: !isSaltPillar(person) &&
        !(Array.isArray(person.bodyTraits) && person.bodyTraits.includes("光合成"))
    }))
  };
}

export function collectCrisisState(village, observation, elapsedMonths) {
  if (!observation) return { departureCount: 0, checkpoints: [], breakdown: null };
  const historyEvents = Array.isArray(village.historyEvents) ? village.historyEvents : [];
  const newLogs = (Array.isArray(village.logs) ? village.logs : []).slice(observation.logIndex);
  const villagers = Array.isArray(village.villagers) ? village.villagers : [];
  const departures = historyEvents.slice(observation.historyIndex).filter(event =>
    event?.type === "villagerLeave" &&
    Array.isArray(event.tags) &&
    event.tags.includes("絶望")
  );
  const departureCount = departures.length;
  const freezingEventOccurred = newLogs.some(log => String(log).includes("冬なのに資材0→凍え"));
  const starvationEventOccurred = newLogs.some(log => String(log).includes("食料0→飢餓発生"));
  const newlyFreezing = freezingEventOccurred
    ? observation.villagersBefore.filter(entry => entry.freezingEligible && !entry.freezing)
    : villagers
      .filter(person => Array.isArray(person.bodyTraits) && person.bodyTraits.includes("凍え"))
      .map(person => ({ person, name: person.name }))
      .filter(entry => !observation.villagersBefore.find(before => before.person === entry.person)?.freezing);
  const newlyStarving = starvationEventOccurred
    ? observation.villagersBefore.filter(entry => entry.starvationEligible && !entry.starvation)
    : villagers
      .filter(person => Array.isArray(person.bodyTraits) && person.bodyTraits.includes("飢餓"))
      .map(person => ({ person, name: person.name }))
      .filter(entry => !observation.villagersBefore.find(before => before.person === entry.person)?.starvation);
  const snapshot = departureCount > 0 || newlyFreezing.length > 0 || newlyStarving.length > 0
    ? createVillageSnapshot(village)
    : null;
  const common = {
    elapsedMonths,
    year: observation.year,
    month: observation.month,
    populationBefore: observation.populationBefore,
    populationAfter: villagers.length
  };
  const departureCommon = {
    ...common,
    year: Number(departures[0]?.year) || common.year,
    month: Number(departures[0]?.month) || common.month
  };
  const checkpoints = [];
  if (departureCount > 0) {
    checkpoints.push({
      ...departureCommon,
      type: "despairDeparture",
      affectedCount: departureCount,
      affectedVillagers: departures.flatMap(event => Array.isArray(event.people) ? event.people : []),
      before: observation.snapshotBefore,
      after: snapshot
    });
  }
  if (newlyFreezing.length > 0) {
    checkpoints.push({
      ...common,
      type: "freezing",
      affectedCount: newlyFreezing.length,
      affectedVillagers: newlyFreezing.map(entry => entry.name),
      before: observation.snapshotBefore,
      after: snapshot
    });
  }
  if (newlyStarving.length > 0) {
    checkpoints.push({
      ...common,
      type: "starvation",
      affectedCount: newlyStarving.length,
      affectedVillagers: newlyStarving.map(entry => entry.name),
      before: observation.snapshotBefore,
      after: snapshot
    });
  }
  const isBreakdown = observation.populationBefore <= ECONOMIC_BREAKDOWN_MAX_POPULATION &&
    departureCount >= ECONOMIC_BREAKDOWN_DESPAIR_DEPARTURES;

  return {
    departureCount,
    checkpoints,
    breakdown: isBreakdown ? {
      ...departureCommon,
      despairDepartureCount: departureCount,
      departedVillagers: departures.flatMap(event => Array.isArray(event.people) ? event.people : []),
      before: observation.snapshotBefore,
      after: snapshot,
      definition: {
        maximumPopulation: ECONOMIC_BREAKDOWN_MAX_POPULATION,
        minimumSameMonthDespairDepartures: ECONOMIC_BREAKDOWN_DESPAIR_DEPARTURES
      }
    } : null
  };
}

export function collectPopulationChanges(village, historyIndex, elapsedMonths) {
  const historyEvents = Array.isArray(village.historyEvents) ? village.historyEvents : [];
  const counts = {
    recruitmentSuccesses: 0,
    seductionSuccesses: 0,
    births: 0,
    deaths: 0,
    departures: 0,
    otherJoins: 0
  };
  const events = [];

  historyEvents.slice(historyIndex).forEach(event => {
    const tags = Array.isArray(event?.tags) ? event.tags : [];
    const people = Array.isArray(event?.people) ? event.people.slice() : [];
    const source = tags.find((tag, index) => index > 0 && tag) || null;
    let category = null;

    if (event?.type === "villagerJoin") {
      if (tags.includes("勧誘")) {
        category = "recruitmentSuccess";
        counts.recruitmentSuccesses++;
      } else if (tags.includes("誘惑")) {
        category = "seductionSuccess";
        counts.seductionSuccesses++;
      } else {
        category = "otherJoin";
        counts.otherJoins++;
      }
    } else if (event?.type === "birth") {
      category = "birth";
      counts.births++;
    } else if (event?.type === "villagerDeath") {
      category = "death";
      counts.deaths++;
    } else if (event?.type === "villagerLeave") {
      category = "departure";
      counts.departures++;
    }

    if (!category) return;
    events.push({
      elapsedMonths,
      year: Number(event.year) || 0,
      month: Number(event.month) || 0,
      category,
      source,
      person: category === "birth" ? people.at(-1) || null : people[0] || null,
      people
    });
  });

  return {
    historyIndex: historyEvents.length,
    counts,
    events
  };
}

const PROGRESSION_MODELS = Object.freeze({
  beginner: {
    version: BEGINNER_PLAYER_MODEL_VERSION,
    label: "初心者",
    shortageFoodMonths: 3,
    shortageWorkerShare: 0.5,
    delayShortageWarnings: true,
    buildingFoodMonths: 3,
    unnecessaryBuildMonths: new Set([6, 18, 30]),
    surplusManaReserve: 300
  },
  standard: {
    version: STANDARD_PLAYER_MODEL_VERSION,
    label: "標準プレイヤー",
    shortageFoodMonths: 3,
    shortageWorkerShare: 0.5,
    delayShortageWarnings: false,
    buildingFoodMonths: 3,
    unnecessaryBuildMonths: new Set(),
    raidPreparation: true,
    surplusManaReserve: 300
  },
  expert: {
    version: EXPERT_PLAYER_MODEL_VERSION,
    label: "熟練者",
    shortageFoodMonths: 3.5,
    shortageWorkerShare: 0.5,
    delayShortageWarnings: false,
    buildingFoodMonths: 3.5,
    unnecessaryBuildMonths: new Set(),
    directedRecovery: { hpThreshold: 35, mpThreshold: 25, maxAssignments: 1 },
    raidPreparation: true,
    surplusManaReserve: 600
  }
});

async function runProgression({ api, frame }, modelId) {
  const model = PROGRESSION_MODELS[modelId];
  if (!model) throw new Error(`Unknown progression model: ${modelId}`);
  const village = api.getVillage();
  const initial = createVillageSnapshot(village);
  const checkpoints = [];
  const raidPreparations = [];
  const routineMiracles = [];
  const crisisCheckpoints = [];
  const economicBreakdowns = [];
  const populationChanges = [];
  let populationHistoryIndex = Array.isArray(village.historyEvents) ? village.historyEvents.length : 0;
  let previousWarnings = { food: false, materials: false };
  const counters = {
    raids: 0,
    raidOutcomes: { complete: 0, partial: 0, failure: 0 },
    recruitAttempts: 0,
    recruitmentSuccesses: 0,
    seductionSuccesses: 0,
    births: 0,
    deaths: 0,
    departures: 0,
    otherJoins: 0,
    buildingActions: 0,
    unnecessaryBuildingActions: 0,
    manualAssignments: 0,
    recoveryAssignments: 0,
    raidPreparationAssignments: 0,
    raidHealingMiracles: 0,
    raidHealingManaSpent: 0,
    raidHealingFundsSpent: 0,
    routineMiracles: 0,
    routineHealingMiracles: 0,
    routineManaMiracles: 0,
    routineAbundanceMiracles: 0,
    routineMiracleManaSpent: 0,
    routineMiracleFundsSpent: 0,
    despairDepartures: 0,
    crisisCheckpoints: 0,
    despairDepartureCrisisPoints: 0,
    freezingCrisisPoints: 0,
    starvationCrisisPoints: 0,
    economicBreakdowns: 0,
    delayedWarnings: 0
  };

  for (let elapsedMonths = 1; elapsedMonths <= 36 && !village.gameOver; elapsedMonths++) {
    await drainKnownModals(frame);
    let crisisObservation = null;
    if (village.villageTraits.includes("襲撃中")) {
      const preparationBefore = summarizeRaidPreparation(village);
      const miracles = model.raidPreparation
        ? await useRaidPreparationMiracles({ api, frame })
        : [];
      counters.raidHealingMiracles += miracles.length;
      counters.raidHealingManaSpent += miracles.reduce((sum, miracle) => sum + miracle.manaSpent, 0);
      counters.raidHealingFundsSpent += miracles.reduce((sum, miracle) => sum + miracle.fundsSpent, 0);
      api.autoAssignRaidActions();
      raidPreparations.push({
        elapsedMonths,
        phase: "active",
        raidId: village.currentRaid?.id || null,
        before: preparationBefore,
        recoveryAssignments: 0,
        recoveryTargets: [],
        miracles,
        after: summarizeRaidPreparation(village),
        assignedCombatants: village.villagers.filter(person => ["迎撃", "籠城", "射撃"].includes(person.action)).length,
        assignedTrapMakers: village.villagers.filter(person => person.action === "罠作成").length
      });
      crisisObservation = observeCrisisState(village);
      const outcome = await resolveActiveRaid({ api, frame });
      counters.raids++;
      if (outcome) counters.raidOutcomes[outcome]++;
    } else {
      const recordRoutineMiracle = (used, category) => {
        if (!used) return;
        routineMiracles.push({ elapsedMonths, category, ...used });
        counters.routineMiracles++;
        counters.routineMiracleManaSpent += used.manaSpent;
        counters.routineMiracleFundsSpent += used.fundsSpent;
        counters[category]++;
      };
      recordRoutineMiracle(
        await useRoutineRecoveryMiracle({ api, frame }, model.surplusManaReserve),
        "routineHealingMiracles"
      );
      api.autoAssignJobs();
      recordRoutineMiracle(
        await useRoutineFoodMiracle({ api, frame }, model.surplusManaReserve, model.shortageFoodMonths),
        "routineManaMiracles"
      );
      const warnings = getVisibleShortageWarnings(village, model.shortageFoodMonths);
      const shouldCorrect = !model.delayShortageWarnings ||
        (warnings.food && previousWarnings.food) ||
        (warnings.materials && previousWarnings.materials);
      if (shouldCorrect) {
        counters.manualAssignments += correctObviousShortages(village, {
          foodMonths: model.shortageFoodMonths,
          workerShare: model.shortageWorkerShare
        });
      } else if (warnings.food || warnings.materials) {
        counters.delayedWarnings++;
      }
      previousWarnings = warnings;
      if (model.directedRecovery && !warnings.food && !warnings.materials) {
        counters.recoveryAssignments += assignExpertRecovery(village, model.directedRecovery);
      }
      let defensePriority = false;
      if (model.raidPreparation && village.pendingRaid) {
        const preparationBefore = summarizeRaidPreparation(village);
        defensePriority = preparationBefore.readyDefenders < RAID_PREPARATION_TARGET;
        const recovery = defensePriority
          ? assignRaidWarningRecovery(village)
          : { changed: 0, targets: [] };
        counters.raidPreparationAssignments += recovery.changed;
        raidPreparations.push({
          elapsedMonths,
          phase: "warning",
          raidId: village.pendingRaid?.raidId || village.pendingRaid?.id || null,
          before: preparationBefore,
          recoveryAssignments: recovery.changed,
          recoveryTargets: recovery.targets,
          miracles: [],
          after: summarizeRaidPreparation(village),
          assignedCombatants: null,
          assignedTrapMakers: null
        });
      }
      recordRoutineMiracle(
        await useRoutineAbundanceMiracle({ api, frame }, model.surplusManaReserve),
        "routineAbundanceMiracles"
      );
      if (!defensePriority && await tryRecruitUsefulVisitor({ api, frame })) counters.recruitAttempts++;
      const unnecessaryBuild = model.unnecessaryBuildMonths.has(elapsedMonths);
      const built = await maintainOrBuild({ api, frame }, {
        foodMonths: model.buildingFoodMonths,
        priorityOverride: unnecessaryBuild ? ["tavern", "fountain", "library", "church"] : null
      });
      if (built) {
        counters.buildingActions++;
        if (unnecessaryBuild) counters.unnecessaryBuildingActions++;
      }
      crisisObservation = observeCrisisState(village);
      api.nextTurn();
      await drainKnownModals(frame);
    }

    const crisisResult = collectCrisisState(village, crisisObservation, elapsedMonths);
    counters.despairDepartures += crisisResult.departureCount;
    counters.crisisCheckpoints += crisisResult.checkpoints.length;
    counters.despairDepartureCrisisPoints += crisisResult.checkpoints.filter(point => point.type === "despairDeparture").length;
    counters.freezingCrisisPoints += crisisResult.checkpoints.filter(point => point.type === "freezing").length;
    counters.starvationCrisisPoints += crisisResult.checkpoints.filter(point => point.type === "starvation").length;
    crisisCheckpoints.push(...crisisResult.checkpoints);
    if (crisisResult.breakdown) {
      counters.economicBreakdowns++;
      economicBreakdowns.push(crisisResult.breakdown);
    }

    const populationResult = collectPopulationChanges(village, populationHistoryIndex, elapsedMonths);
    populationHistoryIndex = populationResult.historyIndex;
    Object.entries(populationResult.counts).forEach(([key, count]) => {
      counters[key] += count;
    });
    populationChanges.push(...populationResult.events);

    if ([12, 24, 36].includes(elapsedMonths)) {
      checkpoints.push({ elapsedMonths, snapshot: createVillageSnapshot(village) });
    }
  }

  return {
    status: "completed",
    playerModel: modelId,
    playerModelVersion: model.version,
    initial,
    checkpoints,
    counters,
    raidPreparations,
    routineMiracles,
    crisisCheckpoints,
    economicBreakdowns,
    populationChanges,
    final: createVillageSnapshot(village)
  };
}

function createProgressionScenario(modelId) {
  const model = PROGRESSION_MODELS[modelId];
  return {
    id: `normal-${modelId}-36`,
    name: `通常進行：${model.label}・36か月`,
    run: context => runProgression(context, modelId)
  };
}

function createRaidStressScenario(scale, preparation) {
  return {
    id: `raid-stress-${scale.id}-${preparation.id}`,
    name: `規模別襲撃ストレス：${scale.label}・${preparation.label}`,
    run: context => runRaidStress(context, scale, preparation)
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
  ...Object.keys(PROGRESSION_MODELS).map(createProgressionScenario),
  ...RAID_STRESS_SCALES.flatMap(scale =>
    Object.values(RAID_STRESS_PREPARATIONS).map(preparation => createRaidStressScenario(scale, preparation))
  ),
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
