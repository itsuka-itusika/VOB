import {
  getVillagerFoodConsumption,
  getVillagerWinterMaterialConsumption,
  isForcedHealingAction
} from "../../js/util.js";

export const BALANCE_RESULT_SCHEMA_VERSION = 4;

const CHILD_BODY_TRAITS = new Set(["赤子", "幼児", "少年", "少女"]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasAnyTrait(person, traits) {
  return asArray(person?.bodyTraits).some(trait => traits.has(trait));
}

function isWorkingAdult(person) {
  if (!person || hasAnyTrait(person, CHILD_BODY_TRAITS)) return false;
  if (isForcedHealingAction(person)) return false;
  return (Number(person.hp) || 0) > 0;
}

function countTrait(people, trait) {
  return people.filter(person =>
    asArray(person?.bodyTraits).includes(trait) || asArray(person?.mindTraits).includes(trait)
  ).length;
}

function average(people, key) {
  if (people.length === 0) return 0;
  return people.reduce((sum, person) => sum + (Number(person?.[key]) || 0), 0) / people.length;
}

function minimum(people, key) {
  if (people.length === 0) return 0;
  return Math.min(...people.map(person => Number(person?.[key]) || 0));
}

function normalizeBuildingEntry(entry) {
  if (typeof entry === "string") return entry;
  return entry?.id || entry?.name || "unknown";
}

function getCurrentRaidId(village) {
  return village?.currentRaid?.id || village?.currentRaid?.raidId || village?.currentRaid?.name || null;
}

export function createVillageSnapshot(village) {
  const villagers = asArray(village?.villagers);
  const captives = asArray(village?.captives);
  const residents = villagers.concat(captives);
  const foodConsumption = residents.reduce((sum, person) => sum + getVillagerFoodConsumption(person), 0);
  const winterMaterialConsumption = residents.reduce(
    (sum, person) => sum + getVillagerWinterMaterialConsumption(person),
    0
  );

  return {
    year: Number(village?.year) || 0,
    month: Number(village?.month) || 0,
    gameOver: village?.gameOver === true,
    resources: {
      food: Number(village?.food) || 0,
      materials: Number(village?.materials) || 0,
      funds: Number(village?.funds) || 0,
      tech: Number(village?.tech) || 0,
      mana: Number(village?.mana) || 0,
      security: Number(village?.security) || 0,
      divineMight: Number(village?.divineMight) || 0,
      scale: Number(village?.building) || 0,
      foodLimit: Number(village?.foodLimit) || null,
      materialsLimit: Number(village?.materialsLimit) || null
    },
    population: {
      villagers: villagers.length,
      captives: captives.length,
      visitors: asArray(village?.visitors).length,
      limit: Number(village?.popLimit) || 0,
      workingAdults: villagers.filter(isWorkingAdult).length,
      injured: countTrait(villagers, "負傷"),
      critical: countTrait(villagers, "重体"),
      dying: countTrait(villagers, "危篤"),
      averageHp: average(villagers, "hp"),
      averageMp: average(villagers, "mp"),
      minimumHp: minimum(villagers, "hp"),
      minimumMp: minimum(villagers, "mp"),
      below80Hp: villagers.filter(person => (Number(person?.hp) || 0) < 80).length,
      below80Mp: villagers.filter(person => (Number(person?.mp) || 0) < 80).length,
      below80Either: villagers.filter(person =>
        (Number(person?.hp) || 0) < 80 || (Number(person?.mp) || 0) < 80
      ).length
    },
    stability: {
      foodConsumption,
      foodMonths: foodConsumption > 0 ? (Number(village?.food) || 0) / foodConsumption : null,
      winterMaterialsTarget: winterMaterialConsumption * 3,
      hasThreeMonthsFood: foodConsumption === 0 || (Number(village?.food) || 0) >= foodConsumption * 3,
      hasWinterMaterials: (Number(village?.materials) || 0) >= winterMaterialConsumption * 3,
      noCritical: countTrait(villagers, "重体") === 0,
      hasFourWorkingAdults: villagers.filter(isWorkingAdult).length >= 4
    },
    buildings: asArray(village?.buildings).map(normalizeBuildingEntry).sort(),
    damagedBuildings: asArray(village?.damagedBuildings).map(normalizeBuildingEntry).sort(),
    villageTraits: asArray(village?.villageTraits).slice().sort(),
    raid: {
      active: asArray(village?.villageTraits).includes("襲撃中"),
      id: getCurrentRaidId(village),
      enemies: asArray(village?.raidEnemies).filter(enemy => (Number(enemy?.hp) || 0) > 0).length,
      turn: Number(village?.raidTurnCount) || 0,
      processDone: village?.isRaidProcessDone === true
    },
    apocalypse: {
      started: village?.apocalypseStarted === true,
      stage: Number(village?.apocalypseStage) || 0,
      cleared: village?.apocalypseCleared === true
    }
  };
}

export function summarizeBatch(results) {
  const completed = results.filter(result => result.status === "completed");
  const errors = results.filter(result => result.status !== "completed");
  const outcomes = completed.reduce((counts, result) => {
    const outcome = result.raidDamage?.outcome;
    if (outcome) counts[outcome] = (counts[outcome] || 0) + 1;
    return counts;
  }, {});
  const recovered = completed.filter(result => result.recovery?.recovered);
  const populationChanges = completed.reduce((counts, result) => {
    const counters = result.counters || {};
    counts.recruitmentSuccesses += Number(counters.recruitmentSuccesses) || 0;
    counts.seductionSuccesses += Number(counters.seductionSuccesses) || 0;
    counts.births += Number(counters.births) || 0;
    counts.deaths += Number(counters.deaths) || 0;
    counts.departures += Number(counters.departures) || 0;
    counts.otherJoins += Number(counters.otherJoins) || 0;
    return counts;
  }, {
    recruitmentSuccesses: 0,
    seductionSuccesses: 0,
    births: 0,
    deaths: 0,
    departures: 0,
    otherJoins: 0
  });
  return {
    requested: results.length,
    completed: completed.length,
    errors: errors.length,
    gameOvers: completed.filter(result => result.final?.gameOver).length,
    economicBreakdowns: completed.filter(result =>
      Array.isArray(result.economicBreakdowns) && result.economicBreakdowns.length > 0
    ).length,
    crisisCheckpoints: completed.reduce((counts, result) => {
      asArray(result.crisisCheckpoints).forEach(point => {
        const type = point?.type || "unknown";
        counts[type] = (counts[type] || 0) + 1;
      });
      return counts;
    }, {}),
    populationChanges,
    raidOutcomes: outcomes,
    recovery: {
      eligible: completed.filter(result => result.recovery?.eligible).length,
      recovered: recovered.length,
      averageMonths: recovered.length > 0
        ? recovered.reduce((sum, result) => sum + result.recovery.months, 0) / recovered.length
        : null
    },
    errorReasons: errors.reduce((counts, result) => {
      const reason = result.reason || result.status;
      counts[reason] = (counts[reason] || 0) + 1;
      return counts;
    }, {})
  };
}
