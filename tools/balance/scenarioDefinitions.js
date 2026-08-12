import { Villager } from "../../js/classes.js";
import { BUILDINGS } from "../../js/buildings.js";
import { setBaseStats } from "../../js/domain/statLayers.js";
import { getVillagerFoodConsumption } from "../../js/util.js";
import { getVillageScaleStage } from "../../js/villageScale.js";
import { createVillageSnapshot } from "./resultSchema.js?v=20260813-balance-13";
import { drainKnownModals, waitUntil } from "./modalDriver.js?v=20260813-balance-13";

export const SCENARIO_VERSION = 4;
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
  sensitivityCandidate = null
}) {
  const village = applyUpperRaidFixture(api, month);
  const randomCallsAfterFixture = api.seed?.calls ?? null;
  if (recovery) api.setSimulationOptions(RECOVERY_OPTIONS);
  const initial = createVillageSnapshot(village);
  api.startRaidById(raidId);
  applyUpperRaidSensitivity(village, sensitivityCandidate);
  const randomCallsAfterRaidCreation = api.seed?.calls ?? null;
  assignPreparedRaidActions(village);
  const enemyRefs = village.raidEnemies.slice();
  const villagerRefs = village.villagers.slice();
  const enemyInitial = {
    types: countBy(enemyRefs, enemy => enemy.raiderType),
    hp: enemyRefs.reduce((sum, enemy) => sum + (Number(enemy.hp) || 0), 0)
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
    sensitivityCandidate: sensitivityCandidate?.id || null
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
  )
];

export const SCENARIOS = Object.freeze(scenarioList);

export function getScenario(id) {
  return SCENARIOS.find(scenario => scenario.id === id) || null;
}
