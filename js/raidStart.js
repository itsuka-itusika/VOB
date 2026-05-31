import { createRandomVillager } from "./createVillagers.js";
import {
  getRaiderTypeByType,
  getRaidModuleById,
  RAID_MODULES,
  RAID_SCALE_TABLES
} from "./data/raidData.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { setBaseStat, syncEffectiveStats } from "./domain/statLayers.js";
import { showRaidWarningModal } from "./raidWarningModal.js";
import { randChoice, randInt } from "./util.js";
import { getVillageScaleStage } from "./villageScale.js";

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

function createRaidEnemy(village, raiderType, existingNames) {
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
  if (raiderType.type === "狼") {
    e.bodyTraits = [
      ...raiderType.forcedBodyTraits,
      randChoice(raiderType.bodyTraits)
    ];
    setBaseStat(e, "mag", randInt(10, Math.min(18, Math.floor(e.str) - 1)));
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
  e.name = `${raiderType.type}の${e.name}`;

  // ニート特性は不要なので削除
  if (e.mindTraits.includes("ニート")) {
    e.mindTraits = e.mindTraits.filter(trait => trait !== "ニート");
  }

  syncEffectiveStats(e);
  return e;
}

/**
 * 襲撃イベント開始を修正
 */
export function startRaidEvent(village) {
  // 荒廃状態かどうかでメッセージを変える
  if (village.villageTraits.includes("荒廃")) {
    village.log("【襲撃イベント発生】40%判定により発生(荒廃状態)");
  } else {
    village.log("【襲撃イベント発生】20%判定により発生");
  }
  if (!village.villageTraits.includes("襲撃中")) {
    village.villageTraits.push("襲撃中");
  }

  const raidDefinition = selectRaidDefinition(village);
  village.raidEnemies = [];
  village.currentRaid = createRaidState(raidDefinition);

  raidDefinition.enemyGroups.forEach(group => {
    const raiderType = getRaiderTypeByType(group.raiderType);
    if (!raiderType) return;

    const minCount = group.minCount ?? raiderType.minCount;
    const maxCount = group.maxCount ?? raiderType.maxCount;
    const enemyCount = randInt(minCount, maxCount);

    for (let i = 0; i < enemyCount; i++) {
      const existingNames = [
        ...village.villagers.map(person => person.name),
        ...village.raidEnemies.map(person => person.name)
      ];
      village.raidEnemies.push(createRaidEnemy(village, raiderType, existingNames));
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
      nextBtn.innerHTML = `<b style="color:red;">迎撃開始</b>`;
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

  showRaidWarningModal({
    raiderType: raidDefinition.warningName || raidDefinition.name,
    enemyCount
  });

  if (typeof document !== "undefined") {
    const raidSection = document.getElementById("raidEnemiesSection");
    if (raidSection) raidSection.style.display = "block";
  }
}
