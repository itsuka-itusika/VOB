import {
  getVillagerFoodConsumption,
  getVillagerWinterMaterialConsumption,
  isForcedHealingAction
} from "../../js/util.js";

export const BALANCE_RESULT_SCHEMA_VERSION = 9;

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
      averageHappiness: average(villagers, "happiness"),
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

function summarizeRaidStressResults(completed) {
  const moduleResults = completed.flatMap(result => asArray(result.raidStress?.modules));
  if (moduleResults.length === 0) return null;
  const groups = new Map();
  moduleResults.forEach(module => {
    if (!groups.has(module.raidId)) groups.set(module.raidId, []);
    groups.get(module.raidId).push(module);
  });
  return {
    scaleId: completed.find(result => result.raidStress)?.raidStress?.scaleId || null,
    scaleLabel: completed.find(result => result.raidStress)?.raidStress?.scaleLabel || null,
    preparation: completed.find(result => result.raidStress)?.raidStress?.preparation || null,
    preparationLabel: completed.find(result => result.raidStress)?.raidStress?.preparationLabel || null,
    modules: Array.from(groups.values()).map(values => {
      const outcomeCounts = values.reduce((counts, value) => {
        counts[value.outcome] = (counts[value.outcome] || 0) + 1;
        return counts;
      }, { complete: 0, partial: 0, failure: 0 });
      const totalEffectiveDamage = values.reduce(
        (sum, value) => sum + (Number(value.damageContribution?.total) || 0),
        0
      );
      const roles = Object.fromEntries(["front", "middle", "rear"].map(role => {
        const effectiveDamage = values.reduce(
          (sum, value) => sum + (Number(value.damageContribution?.roles?.[role]?.effectiveDamage) || 0),
          0
        );
        return [role, {
          effectiveDamage,
          damageShare: totalEffectiveDamage > 0 ? effectiveDamage / totalEffectiveDamage : 0,
          averageHpLost: values.reduce(
            (sum, value) => sum + (Number(value.damageTaken?.roles?.[role]?.hpLost) || 0),
            0
          ) / values.length,
          averageDown: values.reduce(
            (sum, value) => sum + (Number(value.damageTaken?.roles?.[role]?.down) || 0),
            0
          ) / values.length
        }];
      }));
      return {
        raidId: values[0].raidId,
        raidName: values[0].raidName,
        tableWeight: values[0].tableWeight,
        trials: values.length,
        outcomes: outcomeCounts,
        outcomeRates: Object.fromEntries(Object.entries(outcomeCounts).map(([key, count]) => [
          key,
          count / values.length
        ])),
        averageEnemyCount: values.reduce((sum, value) => sum + (Number(value.enemyCount) || 0), 0) / values.length,
        averageTurns: values.reduce((sum, value) => sum + (Number(value.turns) || 0), 0) / values.length,
        averageEnemyRemainingHp: values.reduce(
          (sum, value) => sum + (Number(value.enemyRemainingHp) || 0),
          0
        ) / values.length,
        damageContribution: {
          totalEffectiveDamage,
          roles
        },
        damageTaken: {
          averageTotalHpLost: values.reduce(
            (sum, value) => sum + (Number(value.damageTaken?.totalHpLost) || 0),
            0
          ) / values.length
        },
        casualties: {
          averageInjured: values.reduce(
            (sum, value) => sum + (Number(value.casualties?.injured) || 0),
            0
          ) / values.length,
          averageCritical: values.reduce(
            (sum, value) => sum + (Number(value.casualties?.critical) || 0),
            0
          ) / values.length,
          averageDying: values.reduce(
            (sum, value) => sum + (Number(value.casualties?.dying) || 0),
            0
          ) / values.length
        },
        losses: {
          averageFood: values.reduce((sum, value) => sum + (Number(value.losses?.food) || 0), 0) / values.length,
          averageMaterials: values.reduce((sum, value) => sum + (Number(value.losses?.materials) || 0), 0) / values.length,
          averageFunds: values.reduce((sum, value) => sum + (Number(value.losses?.funds) || 0), 0) / values.length,
          averageSecurity: values.reduce((sum, value) => sum + (Number(value.losses?.security) || 0), 0) / values.length,
          damagedBuildingTrials: values.filter(value => (Number(value.losses?.damagedBuildings) || 0) > 0).length
        }
      };
    })
  };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function summarizeRelationshipResults(completed) {
  const tracked = completed.filter(result => result.relationships);
  if (tracked.length === 0) return null;
  const categories = [
    "bestFriend",
    "nemesis",
    "nemesisResolved",
    "lover",
    "breakup",
    "marriage",
    "birth"
  ];
  const eventSummary = Object.fromEntries(categories.map(category => {
    const counts = tracked.map(result =>
      asArray(result.relationships?.events).filter(event => event.category === category).length
    );
    const firstMonths = tracked
      .map(result => asArray(result.relationships?.events).find(event => event.category === category)?.elapsedMonths)
      .filter(value => Number.isFinite(Number(value)))
      .map(Number);
    const monthlyCounts = {};
    tracked.forEach(result => {
      asArray(result.relationships?.events)
        .filter(event => event.category === category)
        .forEach(event => {
          const month = String(Number(event.elapsedMonths) || 0);
          monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
        });
    });
    const total = counts.reduce((sum, value) => sum + value, 0);
    return [category, {
      total,
      averagePerRun: total / tracked.length,
      runsWithEvent: counts.filter(value => value > 0).length,
      runRate: counts.filter(value => value > 0).length / tracked.length,
      firstOccurrence: {
        averageMonth: firstMonths.length > 0
          ? firstMonths.reduce((sum, value) => sum + value, 0) / firstMonths.length
          : null,
        medianMonth: median(firstMonths),
        minimumMonth: firstMonths.length > 0 ? Math.min(...firstMonths) : null,
        maximumMonth: firstMonths.length > 0 ? Math.max(...firstMonths) : null
      },
      monthlyCounts
    }];
  }));

  const monthGroups = new Map();
  tracked.forEach(result => {
    asArray(result.relationships?.timeline).forEach(snapshot => {
      const elapsedMonths = Number(snapshot.elapsedMonths) || 0;
      if (!monthGroups.has(elapsedMonths)) monthGroups.set(elapsedMonths, []);
      monthGroups.get(elapsedMonths).push(snapshot);
    });
  });
  const timeline = Array.from(monthGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([elapsedMonths, snapshots]) => {
      const averageField = key => {
        const values = snapshots
          .map(snapshot => snapshot[key])
          .filter(value => value != null && Number.isFinite(Number(value)))
          .map(Number);
        return values.length > 0
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null;
      };
      const averageActive = key => snapshots.reduce(
        (sum, snapshot) => sum + (Number(snapshot.activeRelationships?.[key]) || 0),
        0
      ) / snapshots.length;
      return {
        elapsedMonths,
        runs: snapshots.length,
        averageVillagers: averageField("villagers"),
        averagePairCount: averageField("pairCount"),
        averageFriendship: averageField("averageFriendship"),
        averagePairMinimum: averageField("averagePairMinimum"),
        averageFoundingPairMinimum: averageField("foundingAveragePairMinimum"),
        activeRelationships: {
          averageBestFriends: averageActive("bestFriends"),
          averageNemeses: averageActive("nemeses"),
          averageLovers: averageActive("lovers"),
          averageSpouses: averageActive("spouses")
        }
      };
    });

  return {
    runs: tracked.length,
    reached60Months: tracked.filter(result => (Number(result.monthsSimulated) || 0) >= 60).length,
    events: eventSummary,
    timeline
  };
}

function summarizeProgressionRaids(completed) {
  const raids = completed.flatMap(result => asArray(result.raidResults));
  const failedRaids = raids.filter(raid => raid?.outcome === "failure");
  const outcomes = raids.reduce((counts, raid) => {
    const outcome = raid?.outcome || "unknown";
    counts[outcome] = (counts[outcome] || 0) + 1;
    return counts;
  }, { complete: 0, partial: 0, failure: 0 });
  const total = raids.length;
  const sumField = (section, key) => raids.reduce(
    (sum, raid) => sum + (Number(raid?.[section]?.[key]) || 0),
    0
  );
  const averageField = (section, key) => total > 0 ? sumField(section, key) / total : 0;
  const failuresByModule = Array.from(failedRaids.reduce((groups, raid) => {
    const raidId = raid?.raidId || "unknown";
    if (!groups.has(raidId)) groups.set(raidId, []);
    groups.get(raidId).push(raid);
    return groups;
  }, new Map()).entries()).map(([raidId, failures]) => {
    const participantValues = failures.map(raid => Number(raid?.participation?.total) || 0);
    const averageParticipants = key => failures.reduce(
      (sum, raid) => sum + (Number(raid?.participation?.[key]) || 0),
      0
    ) / failures.length;
    return {
      raidId,
      raidName: failures.find(raid => raid?.raidName)?.raidName || raidId,
      failures: failures.length,
      participation: {
        average: averageParticipants("total"),
        minimum: Math.min(...participantValues),
        maximum: Math.max(...participantValues),
        averageFront: averageParticipants("front"),
        averageMiddle: averageParticipants("middle"),
        averageRear: averageParticipants("rear")
      }
    };
  }).sort((a, b) => b.failures - a.failures || a.raidId.localeCompare(b.raidId));

  return {
    total,
    runsWithRaid: completed.filter(result => asArray(result.raidResults).length > 0).length,
    runRate: completed.length > 0
      ? completed.filter(result => asArray(result.raidResults).length > 0).length / completed.length
      : null,
    averagePerRun: completed.length > 0 ? total / completed.length : null,
    outcomes,
    outcomeRates: Object.fromEntries(Object.entries(outcomes).map(([key, count]) => [
      key,
      total > 0 ? count / total : null
    ])),
    failuresByModule,
    losses: {
      averagePerRaid: {
        food: averageField("losses", "food"),
        materials: averageField("losses", "materials"),
        funds: averageField("losses", "funds"),
        mana: averageField("losses", "mana"),
        security: averageField("losses", "security"),
        happiness: averageField("losses", "happiness"),
        totalHp: averageField("losses", "totalHp"),
        damagedBuildings: averageField("losses", "damagedBuildings")
      },
      raidsWithBuildingDamage: raids.filter(raid => (Number(raid.losses?.damagedBuildings) || 0) > 0).length
    },
    casualties: {
      averageInjured: averageField("casualties", "injured"),
      averageCritical: averageField("casualties", "critical"),
      averageDying: averageField("casualties", "dying"),
      averageDown: averageField("casualties", "down")
    }
  };
}

function summarizeFinalProgression(completed) {
  const definitions = {
    mana: result => result.final?.resources?.mana,
    scale: result => result.final?.resources?.scale,
    villagers: result => result.final?.population?.villagers
  };
  return Object.fromEntries(Object.entries(definitions).map(([key, getter]) => {
    const values = completed.map(getter).filter(value => Number.isFinite(Number(value))).map(Number);
    return [key, {
      average: values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      median: median(values),
      minimum: values.length > 0 ? Math.min(...values) : null,
      maximum: values.length > 0 ? Math.max(...values) : null
    }];
  }));
}

function summarizeProgressionTimeline(completed) {
  const groups = new Map();
  completed.forEach(result => {
    asArray(result.checkpoints).forEach(checkpoint => {
      const elapsedMonths = Number(checkpoint?.elapsedMonths) || 0;
      if (!groups.has(elapsedMonths)) groups.set(elapsedMonths, []);
      groups.get(elapsedMonths).push(checkpoint.snapshot);
    });
  });
  return Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([elapsedMonths, snapshots]) => {
      const averageField = getter => {
        const values = snapshots.map(getter).filter(value => Number.isFinite(Number(value))).map(Number);
        return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      };
      return {
        elapsedMonths,
        runs: snapshots.length,
        mana: averageField(snapshot => snapshot.resources?.mana),
        scale: averageField(snapshot => snapshot.resources?.scale),
        villagers: averageField(snapshot => snapshot.population?.villagers)
      };
    });
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
  const miracleUsage = completed.reduce((summary, result) => {
    const counters = result.counters || {};
    summary.raidHealingUses += Number(counters.raidHealingMiracles) || 0;
    summary.raidHealingManaSpent += Number(counters.raidHealingManaSpent) || 0;
    summary.routineUses += Number(counters.routineMiracles) || 0;
    summary.routineHealingUses += Number(counters.routineHealingMiracles) || 0;
    summary.routineManaUses += Number(counters.routineManaMiracles) || 0;
    summary.routineAbundanceUses += Number(counters.routineAbundanceMiracles) || 0;
    summary.routineManaSpent += Number(counters.routineMiracleManaSpent) || 0;
    summary.routineFundsSpent += Number(counters.routineMiracleFundsSpent) || 0;
    return summary;
  }, {
    raidHealingUses: 0,
    raidHealingManaSpent: 0,
    routineUses: 0,
    routineHealingUses: 0,
    routineManaUses: 0,
    routineAbundanceUses: 0,
    routineManaSpent: 0,
    routineFundsSpent: 0
  });
  const finalMana = completed.map(result => Number(result.final?.resources?.mana) || 0);
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
    miracleUsage,
    mana: {
      averageFinal: finalMana.length > 0
        ? finalMana.reduce((sum, value) => sum + value, 0) / finalMana.length
        : null,
      minimumFinal: finalMana.length > 0 ? Math.min(...finalMana) : null,
      maximumFinal: finalMana.length > 0 ? Math.max(...finalMana) : null
    },
    raidOutcomes: outcomes,
    progressionRaids: summarizeProgressionRaids(completed),
    finalProgression: summarizeFinalProgression(completed),
    progressionTimeline: summarizeProgressionTimeline(completed),
    raidStress: summarizeRaidStressResults(completed),
    relationships: summarizeRelationshipResults(completed),
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
