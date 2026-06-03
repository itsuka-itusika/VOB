import { createRandomVillager } from "./createVillagers.js";
import {
  getRaiderTypeByType,
  getRaidModuleById,
  getRaidRepresentative,
  RAID_MODULES,
  RAID_SCALE_TABLES
} from "./data/raidData.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { syncEffectiveStats } from "./domain/statLayers.js";
import { showRaidWarningModal } from "./raidWarningModal.js";
import { updateUI } from "./ui.js";
import { randChoice, randInt } from "./util.js";
import { getVillageScaleStage } from "./villageScale.js";

const AVOIDANCE_RESOURCE_LABELS = {
  food: "食料",
  materials: "資材",
  funds: "資金",
  mana: "魔素",
  fame: "名声",
  tech: "技術"
};

function getRaidTableForVillage(village) {
  const stageIndex = getVillageScaleStage(village.building).index;
  return RAID_SCALE_TABLES.find(table => {
    if (Array.isArray(table.scaleStageIndexes)) {
      return table.scaleStageIndexes.includes(stageIndex);
    }
    const min = Number.isFinite(table.minScaleStageIndex) ? table.minScaleStageIndex : 0;
    const max = Number.isFinite(table.maxScaleStageIndex) ? table.maxScaleStageIndex : Infinity;
    return stageIndex >= min && stageIndex <= max;
  }) || RAID_SCALE_TABLES[0];
}

function raidIncludesRaiderType(raidDefinition, raiderTypeName) {
  return Array.isArray(raidDefinition.enemyGroups) &&
    raidDefinition.enemyGroups.some(group => group.raiderType === raiderTypeName);
}

function hasValidEnemyGroup(raidDefinition) {
  return Array.isArray(raidDefinition.enemyGroups) &&
    raidDefinition.enemyGroups.some(group => getRaiderTypeByType(group.raiderType));
}

function getAdjustedRaidWeight(village, tableEntry, raidDefinition) {
  const baseWeight = Number(tableEntry.weight ?? raidDefinition.weight) || 0;
  if (tableEntry.disableScaleWeightBonus || raidDefinition.disableScaleWeightBonus) {
    return baseWeight;
  }

  const population = Array.isArray(village.villagers) ? village.villagers.length : 0;
  const scale = Number(village.building) || 0;

  if (raidIncludesRaiderType(raidDefinition, "ハーピー")) {
    const bonus = Math.min(10, Math.floor(population / 3) + Math.floor(scale / 40));
    return baseWeight + bonus;
  }

  if (raidIncludesRaiderType(raidDefinition, "キュクロプス")) {
    const bonus = Math.min(12, Math.floor(population / 4) + Math.floor(scale / 25));
    return baseWeight + bonus;
  }

  return baseWeight;
}

function selectRaidDefinition(village) {
  const raidTable = getRaidTableForVillage(village);
  const candidates = raidTable.entries
    .map(entry => {
      const raidDefinition = getRaidModuleById(entry.raidId);
      if (!raidDefinition || !hasValidEnemyGroup(raidDefinition)) return null;
      return {
        entry,
        raidDefinition,
        weight: getAdjustedRaidWeight(village, entry, raidDefinition)
      };
    })
    .filter(candidate => candidate && candidate.weight > 0);

  const totalWeight = candidates.reduce((sum, candidate) => {
    return sum + candidate.weight;
  }, 0);
  let random = Math.random() * totalWeight;
  
  for (const candidate of candidates) {
    random -= candidate.weight;
    if (random <= 0) {
      return candidate.raidDefinition;
    }
  }
  return RAID_MODULES[0]; // フォールバック
}

function createRaidState(raidDefinition) {
  return {
    id: raidDefinition.id,
    name: raidDefinition.name
  };
}

function createPendingRaidEnemyGroups(raidDefinition) {
  return raidDefinition.enemyGroups.map(group => {
    const raiderType = getRaiderTypeByType(group.raiderType);
    if (!raiderType) return null;

    const minCount = group.minCount ?? raiderType.minCount;
    const maxCount = group.maxCount ?? raiderType.maxCount;
    return {
      raiderType: group.raiderType,
      count: randInt(minCount, maxCount)
    };
  }).filter(Boolean);
}

export function createPendingRaidReservation(village, monthsUntil = 1) {
  const raidDefinition = selectRaidDefinition(village);
  return {
    raidId: raidDefinition.id,
    raidName: raidDefinition.name,
    warningName: raidDefinition.warningName || raidDefinition.name,
    enemyGroups: createPendingRaidEnemyGroups(raidDefinition),
    monthsUntil: Math.max(1, Math.floor(Number(monthsUntil) || 1)),
    prophecyNotified: false
  };
}

function getRaidDefinitionFromPendingRaid(pendingRaid) {
  const raidId = pendingRaid?.raidId || pendingRaid?.id;
  return raidId ? getRaidModuleById(raidId) : null;
}

function getResolvedEnemyGroups(raidDefinition, pendingRaid = null) {
  if (Array.isArray(pendingRaid?.enemyGroups) && pendingRaid.enemyGroups.length > 0) {
    return pendingRaid.enemyGroups
      .map(group => {
        const raiderType = getRaiderTypeByType(group.raiderType);
        if (!raiderType) return null;
        const count = Math.max(0, Math.floor(Number(group.count) || 0));
        return count > 0 ? { raiderType, count } : null;
      })
      .filter(Boolean);
  }

  return raidDefinition.enemyGroups
    .map(group => {
      const raiderType = getRaiderTypeByType(group.raiderType);
      if (!raiderType) return null;

      const minCount = group.minCount ?? raiderType.minCount;
      const maxCount = group.maxCount ?? raiderType.maxCount;
      return {
        raiderType,
        count: randInt(minCount, maxCount)
      };
    })
    .filter(Boolean);
}

function createRaidEnemy(village, raiderType, existingNames) {
  const displayType = raiderType.displayType || raiderType.type;
  let e = createRandomVillager({
    sex: raiderType.forcedSex || (Math.random() < 0.5 ? "男" : "女"),
    minAge: raiderType.ageRange.min,
    maxAge: raiderType.ageRange.max,
    existingNames,
    params: {
      ...raiderType.params,
      race: raiderType.race
    },
    ranges: raiderType.ranges
  });

  // 襲撃者の特性とダイアログを設定
  e.mindTraits.push("襲撃者");
  if (Array.isArray(raiderType.mindTraits)) {
    raiderType.mindTraits.forEach(trait => {
      if (!e.mindTraits.includes(trait)) {
        e.mindTraits.push(trait);
      }
    });
  }
  e.raiderDialogues = raiderType.dialogues || [];

  // 顔グラフィックの設定（直接portraitFileを設定）
  if (raiderType.portraits) {
    e.portraitFile = randChoice(raiderType.portraits);
    console.log('Set portrait for raider:', {
      name: e.name,
      type: raiderType.type,
      portrait: e.portraitFile,
      mindTraits: e.mindTraits
    });
  }

  // 狼の場合は肉体特性を上書き
  if (displayType === "狼") {
    e.bodyTraits = [
      ...raiderType.forcedBodyTraits,
      randChoice(raiderType.bodyTraits)
    ];
    // 狼の趣味を設定
    e.hobby = randChoice(raiderType.hobbies);
  }
  // その他の種族の場合は従来通りの処理
  else {
    // 強制的な肉体特性を追加
    if (raiderType.forcedBodyTraits) {
      // キュクロプスの場合は強制的な特性のみを持つ
      if (raiderType.type === "キュクロプス") {
        e.bodyTraits = [...raiderType.forcedBodyTraits];
      } else {
        raiderType.forcedBodyTraits.forEach(trait => {
          if (!e.bodyTraits.includes(trait)) {
            e.bodyTraits.push(trait);
          }
        });
      }
    }

    // 特定の種族用のランダム肉体特性
    if (raiderType.bodyTraits) {
      const randomTrait = randChoice(raiderType.bodyTraits);
      if (!e.bodyTraits.includes(randomTrait)) {
        e.bodyTraits.push(randomTrait);
      }
    }

    // 特定の種族用の趣味
    if (raiderType.hobbies) {
      e.hobby = randChoice(raiderType.hobbies);
    }
  }

  e.jobTable = [raiderType.params.job];
  e.actionTable = ["襲撃"];
  e.job = raiderType.params.job;
  e.action = "襲撃";
  e.raiderType = raiderType.type;
  e.raiderRole = raiderType.role || "";
  e.raidPosition = raiderType.raidPosition || "front";
  e.raidTargeting = raiderType.raidTargeting || "frontFirst";
  e.name = `${displayType}の${e.name}`;

  // ニート特性は不要なので削除
  if (e.mindTraits.includes("ニート")) {
    e.mindTraits = e.mindTraits.filter(trait => trait !== "ニート");
  }

  syncEffectiveStats(e);
  return e;
}

function calculateAvoidanceAmount(village, avoidance) {
  const resource = avoidance?.resource;
  if (!resource) return 0;

  const currentAmount = Number(village[resource]) || 0;
  const rateAmount = Math.ceil(currentAmount * (Number(avoidance.rate) || 0));
  const minAmount = Math.floor(Number(avoidance.minAmount) || 0);
  return Math.max(minAmount, rateAmount);
}

function createAvoidanceOption(village, avoidance) {
  if (!avoidance || avoidance.type !== "resourcePayment" || !avoidance.resource) return null;

  const resource = avoidance.resource;
  const resourceLabel = AVOIDANCE_RESOURCE_LABELS[resource] || resource;
  const currentAmount = Math.floor(Number(village[resource]) || 0);
  const amount = calculateAvoidanceAmount(village, avoidance);
  const disabled = currentAmount < amount;

  return {
    label: avoidance.label || `${resourceLabel}を払う`,
    detail: `要求額: ${resourceLabel}${amount}（所持 ${currentAmount}）`,
    disabled,
    disabledReason: disabled ? `${resourceLabel}が不足しています` : "",
    amount,
    resource,
    resourceLabel
  };
}

function resetRaidUiAfterAvoidance() {
  if (typeof document === "undefined") return;

  const raidSection = document.getElementById("raidEnemiesSection");
  if (raidSection) raidSection.style.display = "none";

  const nextBtn = document.getElementById("nextTurnButton");
  if (nextBtn) {
    nextBtn.textContent = "次の月へ";
    nextBtn.disabled = false;
  }

  const autoAssignBtn = document.getElementById("autoAssignButton");
  if (autoAssignBtn) {
    autoAssignBtn.textContent = "自動割り振り";
  }

  const raidAssignBtn = document.getElementById("raidAssignButton");
  if (raidAssignBtn) {
    raidAssignBtn.style.display = "none";
  }
}

function endRaidByAvoidance(village, raidDefinition, option) {
  village.isRaidProcessDone = true;
  village.isRaidFinalizing = false;
  village.raidTurnCount = 0;
  village.currentActionIndex = 0;
  village.raidActionQueue = [];
  village.raidPhase = "";
  village.currentRaid = null;
  village.raidEnemies = [];

  const raidTraitIndex = village.villageTraits.indexOf("襲撃中");
  if (raidTraitIndex >= 0) {
    village.villageTraits.splice(raidTraitIndex, 1);
  }

  village.villagers.forEach(person => refreshJobTable(person, village));
  village.log(`${raidDefinition.name}: ${option.resourceLabel}${option.amount}を支払い、襲撃者は去っていった。`);

  resetRaidUiAfterAvoidance();
  updateUI(village);
}

function executeRaidAvoidance(village, raidDefinition) {
  const avoidance = raidDefinition.avoidance;
  const option = createAvoidanceOption(village, avoidance);
  if (!option || option.disabled) {
    if (option?.disabledReason) village.log(`${raidDefinition.name}: ${option.disabledReason}`);
    return false;
  }

  const currentAmount = Number(village[option.resource]) || 0;
  village[option.resource] = Math.max(0, currentAmount - option.amount);
  endRaidByAvoidance(village, raidDefinition, option);
  return true;
}

/**
 * 襲撃イベント開始を修正
 */
export function startRaidEvent(village, options = {}) {
  const pendingRaid = options.pendingRaid || null;
  const raidDefinition = options.raidDefinition ||
    getRaidDefinitionFromPendingRaid(pendingRaid) ||
    selectRaidDefinition(village);
  village.log(pendingRaid
    ? `【襲撃発生】予兆のあった${raidDefinition.name}が村へ押し寄せました。`
    : `【襲撃発生】${raidDefinition.name}が村へ押し寄せました。`);
  if (!village.villageTraits.includes("襲撃中")) {
    village.villageTraits.push("襲撃中");
  }

  village.monthsSinceRaid = 0;
  village.raidCooldown = 1;
  village.pendingRaid = null;
  village.raidEnemies = [];
  village.currentRaid = createRaidState(raidDefinition);

  getResolvedEnemyGroups(raidDefinition, pendingRaid).forEach(group => {
    for (let i = 0; i < group.count; i++) {
      const existingNames = [
        ...village.villagers.map(person => person.name),
        ...village.raidEnemies.map(person => person.name)
      ];
      village.raidEnemies.push(createRaidEnemy(village, group.raiderType, existingNames));
    }
  });

  const enemyCount = village.raidEnemies.length;

  // 生成された敵全体の確認ログ
  console.log('Created raiders:', village.raidEnemies.map(e => ({
    name: e.name,
    type: e.job,
    portrait: e.portraitFile
  })));

  village.isRaidProcessDone = false;
  village.isRaidFinalizing = false;
  village.raidTurnCount = 0;
  village.currentActionIndex = 0;
  village.raidActionQueue = [];
  village.raidPhase = "";
  village.villagers.forEach(person => refreshJobTable(person, village));

  // 襲撃者の数に応じてメッセージを変更
  if (enemyCount === 1) {
    village.log(`${raidDefinition.name}: 1体が襲来！`);
  } else {
    village.log(`${raidDefinition.name}: ${enemyCount}体が襲来！`);
  }

  if (typeof document !== "undefined") {
    let nextBtn = document.getElementById("nextTurnButton");
    if (nextBtn) {
      nextBtn.innerHTML = `<b style="color:red;">防衛開始</b>`;
    }
    let autoAssignBtn = document.getElementById("autoAssignButton");
    if (autoAssignBtn) {
      autoAssignBtn.textContent = "自動割り振り";
    }
    const raidAssignBtn = document.getElementById("raidAssignButton");
    if (raidAssignBtn) {
      raidAssignBtn.style.display = "";
    }
  }

  const representative = getRaidRepresentative(raidDefinition, village.raidEnemies);
  showRaidWarningModal({
    raidName: raidDefinition.warningName || raidDefinition.name,
    representative,
    introDialogues: raidDefinition.introDialogues,
    enemyCount,
    avoidanceOption: createAvoidanceOption(village, raidDefinition.avoidance),
    onAvoidance: () => executeRaidAvoidance(village, raidDefinition)
  });

  if (typeof document !== "undefined") {
    const raidSection = document.getElementById("raidEnemiesSection");
    if (raidSection) raidSection.style.display = "block";
  }
}
