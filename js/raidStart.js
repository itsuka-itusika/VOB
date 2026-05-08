import { createRandomVillager } from "./createVillagers.js";
import { RAIDER_TYPES } from "./data/raidData.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { showRaidWarningModal } from "./raidWarningModal.js";
import { randChoice, randInt } from "./util.js";

function getAdjustedRaiderWeight(village, raiderType) {
  const baseWeight = raiderType.weight;
  const population = Array.isArray(village.villagers) ? village.villagers.length : 0;
  const scale = Number(village.building) || 0;

  if (raiderType.type === "ハーピー") {
    const bonus = Math.min(10, Math.floor(population / 3) + Math.floor(scale / 40));
    return baseWeight + bonus;
  }

  if (raiderType.type === "キュクロプス") {
    const bonus = Math.min(12, Math.floor(population / 4) + Math.floor(scale / 25));
    return baseWeight + bonus;
  }

  return baseWeight;
}

function selectRaiderType(village) {
  const totalWeight = RAIDER_TYPES.reduce((sum, type) => {
    return sum + getAdjustedRaiderWeight(village, type);
  }, 0);
  let random = Math.random() * totalWeight;
  
  for (const raiderType of RAIDER_TYPES) {
    random -= getAdjustedRaiderWeight(village, raiderType);
    if (random <= 0) {
      return raiderType;
    }
  }
  return RAIDER_TYPES[0]; // フォールバック
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

  const raiderType = selectRaiderType(village);
  const enemyCount = randInt(raiderType.minCount, raiderType.maxCount);
  village.raidEnemies = [];

  for (let i = 0; i < enemyCount; i++) {
    let e = createRandomVillager({
      sex: raiderType.forcedSex || (Math.random() < 0.5 ? "男" : "女"),
      minAge: raiderType.ageRange.min,
      maxAge: raiderType.ageRange.max,
      existingNames: [
        ...village.villagers.map(person => person.name),
        ...village.raidEnemies.map(person => person.name)
      ],
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
      e.mag = randInt(10, Math.min(18, Math.floor(e.str) - 1));
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

    village.raidEnemies.push(e);
  }

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
    village.log(`${raiderType.type}が1体襲来！`);
  } else {
    village.log(`${raiderType.type}(${enemyCount}体)が襲来！`);
  }

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

  showRaidWarningModal({
    raiderType: raiderType.type,
    enemyCount
  });

  const raidSection = document.getElementById("raidEnemiesSection");
  if (raidSection) raidSection.style.display = "block";
}
