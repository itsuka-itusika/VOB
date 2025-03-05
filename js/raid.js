// raid.js

import { createRandomVillager } from "./createVillagers.js";
import { randInt, randChoice, clampValue, shuffleArray } from "./util.js";
import { endOfMonthProcess, doFixedEventPre, doFixedEventPost, doRandomEventPre, doRandomEventPost, doMonthStartProcess, doAgingProcess, updateSeason } from "./events.js";
import { handleAllVillagerJobs } from "./jobs.js";
import { updateUI } from "./ui.js";
import { MALE_PORTRAIT_FILES, usedPortraits } from "./createVillagers.js";

/**
 * 襲撃者タイプの定義
 */
const RAIDER_TYPES = [
  {
    type: "野盗",
    weight: 30,  // 出現率30%
    minCount: 2,
    maxCount: 3,
    race: "人間",
    forcedSex: "男",  // 性別を男に固定
    ageRange: { min: 18, max: 45 },  // 青年～中年
    params: {
      job: "野盗",
      action: "襲撃"
    },
    portraits: [
      "BAN1.png", "BAN2.png", "BAN3.png", "BAN4.png", "BAN5.png",
      "BAN6.png", "BAN7.png", "BAN8.png", "BAN9.png", "BAN10.png",
      "BAN11.png", "BAN12.png", "BAN13.png", "BAN14.png", "BAN15.png",
      "BAN16.png", "BAN17.png", "BAN18.png", "BAN19.png", "BAN20.png", "BAN20.png"
    ],
    ranges: {
      hp: [80, 100],
      str: [15, 25],
      vit: [8, 30],
      dex: [10, 20],
      mag: [5, 15],
      chr: [3, 19],
      int: [5, 18],
      ind: [3, 16],
      eth: [1, 9],
      cou: [12, 25],
      sexdr: [10, 20]
    },
    dialogues: [
      "金と食料を出せば命だけは助けてやる！",
      "おとなしく全財産を差し出せ！抵抗するなら容赦しないぞ！",
      "この村は今から俺たちのものだ。抵抗は無駄だ！",
      "女も寄越せ！さもなくば皆殺しだ！",
      "ここの村長を出せ！交渉したい事がある。",
      "俺たちは飢えているんだ。食料を分けてくれないか？断れば襲撃するぞ！"
    ]
  },
  {
    type: "ゴブリン",
    weight: 25,
    minCount: 4,
    maxCount: 5,
    race: "ゴブリン",
    forcedSex: "男",
    ageRange: { min: 15, max: 30 },  // 若いゴブリン
    params: {
      job: "ゴブリン",
      action: "襲撃"
    },
    portraits: [
      "GOB1.png", "GOB2.png", "GOB3.png", "GOB4.png", "GOB5.png",
      "GOB6.png", "GOB7.png", "GOB8.png", "GOB9.png", "GOB10.png", "GOB11.png", "GOB12.png", "GOB13.png"
    ],
    ranges: {
      hp: [30, 50],
      str: [10, 18],
      vit: [5, 15],
      dex: [18, 25],
      mag: [5, 15],
      chr: [3, 12],
      int: [5, 12],
      ind: [5, 12],
      eth: [1, 5],
      cou: [5, 12],
      sexdr: [18, 25]
    },
    dialogues: [
      "キヒヒ！村の宝物をよこすのだ！",
      "ゴブゴブ！人間は弱いから殺して食べるのだ！",
      "キャッキャッ！女を連れて帰るのだ！",
      "ゴブリン族の力を思い知るのだ！",
      "人間の村を奪うのだ！ここはゴブリンの新しい巣になるのだ！",
      "食料をよこせ！さもなくば皆殺しにするのだ！"
    ]
  },
  {
    type: "狼",
    weight: 20,
    minCount: 2,
    maxCount: 3,
    race: "狼",
    ageRange: { min: 3, max: 8 },  // 若い～成熟した狼
    params: {
      job: "狼",
      action: "襲撃"
    },
    ranges: {
      hp: [40, 60],
      str: [20, 30],
      vit: [5, 15],
      dex: [3, 8],
      mag: [3, 12],
      chr: [3, 12],
      int: [1, 5],
      ind: [1, 5],
      eth: [5, 15],
      cou: [20, 25],
      sexdr: [10, 20]
    },
    bodyTraits: ["筋肉質", "毛艶がいい", "精悍", "痩せぎす", "細身", "強面"],
    forcedBodyTraits: ["モフモフ"],
    hobbies: ["散歩", "狩り", "毛づくろい", "繁殖", "子育て", "喧嘩", "日光浴"],
    dialogues: [
      "グルルル...（獲物を見つけたようだ）",
      "ウゥゥ...ガウッ！（空腹で凶暴になっている）",
      "キャンキャン...（仲間を呼んでいるようだ）",
      "フンフン...（村の匂いを嗅いでいる）",
      "ハァハァ...（獲物を前に興奮している）",
      "ウォォォン！（襲撃の合図を出している）"
    ],
    portraits: [
      "WOLF1.png", "WOLF2.png", "WOLF3.png", "WOLF4.png", "WOLF5.png",
      "WOLF6.png"
    ],
  },
  {
    type: "キュクロプス",
    weight: 10,
    minCount: 1,
    maxCount: 1,
    race: "巨人",
    forcedSex: "男",
    ageRange: { min: 30, max: 60 },  // 成熟～老齢の巨人
    params: {
      job: "キュクロプス",
      action: "襲撃"
    },
    ranges: {
      hp: [90, 120],
      str: [25, 35],
      vit: [25, 35],
      dex: [5, 15],
      mag: [5, 15],
      chr: [3, 12],
      int: [3, 8],
      ind: [5, 15],
      eth: [5, 15],
      cou: [20, 25],
      sexdr: [10, 20]
    },
    forcedBodyTraits: ["巨躯", "単眼"],
    dialogues: [
      "ウオォォ！小さい人間ども、潰してやる！",
      "腹が減った...人間を食べる...！",
      "この村を平らにしてやる！逃げられると思うな！",
      "お前たちの家畜をよこせ！抵抗するなら踏み潰す！",
      "キュクロプスの怒りを知るがいい！",
      "人間は弱すぎる...簡単に潰せる..."
    ],
    portraits: [
      "CYCLOPS1.png", "CYCLOPS2.png", "CYCLOPS3.png", "CYCLOPS4.png"
    ],
  },
  {
    type: "ハーピー",
    weight: 15,
    minCount: 2,
    maxCount: 3,
    race: "ハーピー",
    forcedSex: "女",
    ageRange: { min: 16, max: 25 },  // 若い～成熟したハーピー
    params: {
      job: "ハーピー",
      action: "襲撃"
    },
    portraits: [
      "HARPY1.png", "HARPY2.png", "HARPY3.png", "HARPY4.png", 
      "HARPY5.png", "HARPY6.png", "HARPY7.png", "HARPY8.png",
      "HARPY9.png", "HARPY10.png", "HARPY11.png", "HARPY12.png"
      
    ],
    ranges: {
      hp: [70, 90],
      str: [16, 22],
      vit: [8, 18],
      dex: [1, 5],
      mag: [15, 20],
      chr: [18, 25],
      int: [5, 12],
      ind: [5, 12],
      eth: [5, 12],
      cou: [15, 22],
      sexdr: [10, 20]
    },
    forcedBodyTraits: ["飛行", "澄んだ声"],
    hobbies: ["遠乗り", "狩り", "羽づくろい", "繁殖", "子育て", "喧嘩", "日光浴", "歌唱"],
    dialogues: [
      "キャハハ！素敵なものを見つけたわ！",
      "あら、可愛い村ね。頂いちゃうわ！",
      "私たちの歌声で魅了してあげる♪",
      "空から襲えば逃げ場なんてないのよ！",
      "宝物は全部私のもの！さあ、出しなさい！",
      "美しいものが大好き！あなたの持っているキラキラしたものを全部頂戴！"
    ]
  }

];

/**
 * 重み付き抽選で襲撃者タイプを選択
 */
function selectRaiderType() {
  const totalWeight = RAIDER_TYPES.reduce((sum, type) => sum + type.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const raiderType of RAIDER_TYPES) {
    random -= raiderType.weight;
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
  village.log("【襲撃イベント発生】20%判定により発生");
  if (!village.villageTraits.includes("襲撃中")) {
    village.villageTraits.push("襲撃中");
  }

  const raiderType = selectRaiderType();
  const enemyCount = randInt(raiderType.minCount, raiderType.maxCount);
  village.raidEnemies = [];

  for (let i = 0; i < enemyCount; i++) {
    let e = createRandomVillager({
      sex: raiderType.forcedSex || (Math.random() < 0.5 ? "男" : "女"),
      minAge: raiderType.ageRange.min,
      maxAge: raiderType.ageRange.max,
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
  village.raidTurnCount = 0;
  village.currentActionIndex = 0;
  village.raidActionQueue = [];

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

  // アラートメッセージも数に応じて変更
  if (enemyCount === 1) {
    alert(`【襲撃発生】${raiderType.type}が村に近づいています。迎撃してください！`);
  } else {
    alert(`【襲撃発生】${raiderType.type}の集団が村に近づいています。迎撃してください！`);
  }

  const raidSection = document.getElementById("raidEnemiesSection");
  if (raidSection) raidSection.style.display = "block";
}

/**
 * 迎撃モーダルを開く (nextTurnから呼ばれる)
 */
export function openRaidModal(village) {
  document.getElementById("raidOverlay").style.display="block";
  document.getElementById("raidModal").style.display="block";

  updateRaidTables(village);
  const rlog=document.getElementById("raidLogArea");
  rlog.innerHTML="襲撃が始まります。<br>「次のステップ」ボタンを押して進めてください。";

  let trapMakers = village.villagers.filter(p=> p.action==="罠作成");
  let defenders  = village.villagers.filter(p=> p.action==="迎撃");

  if (trapMakers.length===0 && defenders.length===0) {
    rlog.innerHTML+=`<br>迎撃する者がいません！ → 自動的に襲撃成功(敵側)。`;
    village.raidActionQueue=[ {type:"AUTO_FAIL"} ];
    village.currentActionIndex=0;
  } else {
    village.raidTurnCount=1;
    createTrapActionQueue(village);
  }
}

/**
 * 罠作成(最初の行動)のキューを作成
 */
function createTrapActionQueue(village) {
  let trapMakers = village.villagers.filter(p=>p.action==="罠作成" && p.hp>0);
  trapMakers = shuffleArray(trapMakers);

  village.raidActionQueue=[];
  trapMakers.forEach(p=>{
    village.raidActionQueue.push({
      type:"TRAP",
      actor:p
    });
  });
  village.currentActionIndex=0;
}

/**
 * 「次のステップ」ボタン
 */
export function proceedRaidAction(village) {
  const logDiv = document.getElementById("raidLogArea");
  let action = village.raidActionQueue[village.currentActionIndex];

  if (!action) {
    finalizeCombatTurn(village);
    return;
  }
  switch(action.type) {
    case "TRAP":
      doOneTrapAction(action, village);
      break;
    case "COMBAT":
      doOneCombatAction(action, village);
      break;
    case "AUTO_FAIL":
      finalizeRaid(false, "迎撃部隊0", village);
      return;
  }
  village.currentActionIndex++;
  checkCombatEndOfActions(village);
}

/** 1件のTRAP行動 */
function doOneTrapAction(action, village) {
  let p=action.actor;
  let logDiv=document.getElementById("raidLogArea");
  if (!p||p.hp<=0) {
    logDiv.innerHTML+=`<br>【罠作成】${p?p.name:"??"} は行動不能`;
    updateRaidTables(village);
    return;
  }
  if (village.raidEnemies.length===0) {
    logDiv.innerHTML+=`<br>【罠作成】敵は既に全滅`;
    updateRaidTables(village);
    return;
  }
  let e=randChoice(village.raidEnemies);
  let dmg = Math.floor((p.dex*p.int/400)*30);
  e.hp-=dmg;
  logDiv.innerHTML+=`<br>【罠作成】${p.name}→${e.name}に${dmg}ダメージ`;
  if (e.hp<=0) {
    logDiv.innerHTML+=`<br>　　→ ${e.name}は倒れた！`;
    village.raidEnemies=village.raidEnemies.filter(x=> x!==e);
  }
  updateRaidTables(village);
}

/** 罠作成後 -> 迎撃フェーズ(3ターン) */
export function setupCombatPhase(village) {
  const logDiv=document.getElementById("raidLogArea");

  let defenders = village.villagers.filter(p=> p.action==="迎撃" && p.hp>0);
  let enemies   = village.raidEnemies.filter(e=> e.hp>0);

  if (enemies.length===0) {
    finalizeRaid(true, "罠作成だけで撃退", village);
    return;
  }
  if (defenders.length===0) {
    finalizeRaid(false, "迎撃部隊なし(行動不能)", village);
    return;
  }
  if (village.raidTurnCount>3) {
    finalizeRaidPartSuccess(village);
    return;
  }

  logDiv.innerHTML+=`<hr><br>【迎撃フェーズ】ターン ${village.raidTurnCount} 開始`;

  village.raidActionQueue=createCombatActions(defenders, village.raidEnemies);
  village.currentActionIndex=0;
  updateRaidTables(village);
}

/** 行動順(勇気降順) */
function createCombatActions(defenders, enemies) {
  let allUnits = defenders.concat(enemies);
  allUnits.sort((a,b)=>{
    if (b.cou===a.cou) return Math.random()<0.5 ? -1:1;
    return b.cou - a.cou;
  });
  let arr=[];
  allUnits.forEach(u=>{
    arr.push({type:"COMBAT", actor:u});
  });
  return arr;
}

/** 1件のCOMBAT行動 */
function doOneCombatAction(action, village) {
  let actor=action.actor;
  let logDiv=document.getElementById("raidLogArea");
  if (!actor||actor.hp<=0) {
    logDiv.innerHTML+=`<br>【迎撃】${actor?actor.name:"??"}は行動不能`;
    updateRaidTables(village);
    return;
  }
  let isEnemy = village.raidEnemies.includes(actor);

  let defenders = village.villagers.filter(p=> p.action==="迎撃" && p.hp>0);
  let enemies   = village.raidEnemies.filter(e=> e.hp>0);

  if (isEnemy) {
    // 敵の攻撃
    if (defenders.length===0) {
      logDiv.innerHTML+=`<br>【敵の攻撃】迎撃側は全滅...`;
      updateRaidTables(village);
      return;
    }
    let target=randChoice(defenders);
    let result=calcAttackDamage(actor,target,false);
    let dmg=result.damage;
    let atkTypeText = result.isMagic? "魔法攻撃":"物理攻撃";
    target.hp-=dmg;
    logDiv.innerHTML+=`<br>【敵の攻撃】${actor.name}の${atkTypeText}→${target.name}に ${dmg}ダメージ`;
    if (target.hp<=0) {
      logDiv.innerHTML+=`<br>　　→ ${target.name}は負傷離脱(HP0)`;
      if (!target.bodyTraits.includes("負傷")) target.bodyTraits.push("負傷");
    } else {
      // 反撃
      let ret=calcAttackDamage(target, actor, true);
      let rdmg=Math.floor(ret.damage*0.5);
      let retTypeText=ret.isMagic? "魔法攻撃":"物理攻撃";
      actor.hp-=rdmg;
      logDiv.innerHTML+=`<br>　　→ 反撃(${retTypeText}):${target.name}→${actor.name}に${rdmg}ダメージ`;
      if (actor.hp<=0) {
        logDiv.innerHTML+=`<br>　　→ ${actor.name}は倒れた！`;
        village.raidEnemies=village.raidEnemies.filter(e=> e!==actor);
      }
    }
  } else {
    // 村人の攻撃
    if (village.raidEnemies.length===0) {
      logDiv.innerHTML+=`<br>【村人の攻撃】敵は既に全滅`;
      updateRaidTables(village);
      return;
    }
    let target=randChoice(village.raidEnemies);
    let result=calcAttackDamage(actor,target,false);
    let dmg=result.damage;
    let atkTypeText=result.isMagic? "魔法攻撃":"物理攻撃";
    target.hp-=dmg;
    logDiv.innerHTML+=`<br>【迎撃】${actor.name}の${atkTypeText}→${target.name}に ${dmg}ダメージ`;
    if (target.hp<=0) {
      logDiv.innerHTML+=`<br>　　→ ${target.name}は倒れた！`;
      village.raidEnemies=village.raidEnemies.filter(e=> e!==target);
    } else {
      // 敵の反撃
      let ret=calcAttackDamage(target, actor, true);
      let rdmg=Math.floor(ret.damage*0.5);
      let retTypeText=ret.isMagic? "魔法攻撃":"物理攻撃";
      actor.hp-=rdmg;
      logDiv.innerHTML+=`<br>　　→ 反撃(${retTypeText}):${target.name}→${actor.name}に${rdmg}ダメージ`;
      if (actor.hp<=0) {
        logDiv.innerHTML+=`<br>　　→ ${actor.name}は負傷離脱(HP0)`;
        if (!actor.bodyTraits.includes("負傷")) actor.bodyTraits.push("負傷");
      }
    }
  }
  updateRaidTables(village);
}

function calcAttackDamage(atk, def, isCounter) {
  let phys = ((atk.str*atk.cou)/400)*50 - def.vit;
  let mag  = ((atk.mag*atk.cou)/400)*25;
  phys=Math.floor(phys);
  mag=Math.floor(mag);
  if (phys<0) phys=0;
  if (mag<0) mag=0;

  let finalDamage=0;
  let usedMagic=false;
  if (phys>=mag) {
    finalDamage=phys;
  } else {
    finalDamage=mag;
    usedMagic=true;
  }
  return {damage:Math.floor(finalDamage), isMagic:usedMagic};
}

/** 全アクション完了後にターン終了 */
function finalizeCombatTurn(village) {
  let logDiv=document.getElementById("raidLogArea");

  let defenders = village.villagers.filter(p=> p.action==="迎撃" && p.hp>0);
  let enemies   = village.raidEnemies.filter(e=> e.hp>0);

  if (defenders.length===0) {
    finalizeRaid(false, "迎撃部隊全滅", village);
    return;
  }
  if (enemies.length===0) {
    finalizeRaid(true, "敵全滅", village);
    return;
  }

  village.raidTurnCount++;
  if (village.raidTurnCount>3) {
    finalizeRaidPartSuccess(village);
  } else {
    setupCombatPhase(village);
  }
}

/** 全員の行動終了時に敵 or 迎撃側が全滅したかどうか確認 */
function checkCombatEndOfActions(village) {
  let defenders = village.villagers.filter(p=> p.action==="迎撃" && p.hp>0);
  let enemies   = village.raidEnemies.filter(e=> e.hp>0);

  if (defenders.length===0) {
    finalizeRaid(false, "迎撃部隊全滅", village);
    return;
  }
  if (enemies.length===0) {
    finalizeRaid(true, "敵全滅", village);
    return;
  }

  if (village.currentActionIndex < village.raidActionQueue.length) {
    return; // まだ行動が残ってる
  }
  finalizeCombatTurn(village);
}

/** (完全)成功 or 失敗 */
function finalizeRaid(isSuccess, reason, village) {
  village.log(`【襲撃結果】${isSuccess?"防衛成功":"防衛失敗"} : ${reason}`);
  let rlog=document.getElementById("raidLogArea");
  rlog.innerHTML+=`<br>→ 襲撃結果: ${isSuccess?"防衛成功":"失敗"} (${reason})<br>モーダルを閉じます...`;

  endRaidProcess(isSuccess, false, village);
}

/** 3ターン粘って撤退(部分成功) */
function finalizeRaidPartSuccess(village) {
  village.log("【襲撃結果】3ターン粘って敵撤退→部分的成功");
  let rlog=document.getElementById("raidLogArea");
  rlog.innerHTML+=`<br>→ 襲撃結果: 敵撤退(部分成功)<br>モーダルを閉じます...`;

  endRaidProcess(true,true,village);
}

/** 襲撃終了処理 */
function endRaidProcess(isSuccess, isPartSuccess, village) {
  village.log(`[DEBUG] 襲撃結果 成功:${isSuccess} 部分成功:${isPartSuccess}`);
  setTimeout(()=>{
    closeRaidModal();
    let idx=village.villageTraits.indexOf("襲撃中");
    if (idx>=0) {
      village.villageTraits.splice(idx,1);
    }
    village.raidEnemies=[];

    // 襲撃者一覧セクションを非表示に
    const raidSection = document.getElementById("raidEnemiesSection");
    if (raidSection) {
      raidSection.style.display = "none";
    }

    if (isSuccess) {
      if (isPartSuccess) {
        // 部分成功
        village.villagers.forEach(p=>{
          p.happiness=clampValue(p.happiness+10,0,100);
        });
        village.fame+=10;
        village.log("防衛成功(部分):村人幸福+10,名声+10");
      } else {
        // 完全成功
        village.villagers.forEach(p=>{
          p.happiness=clampValue(p.happiness+20,0,100);
        });
        village.fame+=20;
        village.log("防衛成功(敵全滅):村人幸福+20,名声+20");
      }
    } else {
      // 失敗
      let fLoss=Math.floor(village.food*0.2);
      let mLoss=Math.floor(village.materials*0.2);
      let fundLoss=Math.floor(village.funds*0.2);
      village.food=clampValue(village.food - fLoss,0,99999);
      village.materials=clampValue(village.materials - mLoss,0,99999);
      village.funds=clampValue(village.funds - fundLoss,0,99999);
      village.security=clampValue(village.security-10,0,100);

      village.villagers.forEach(p=>{
        p.hp=clampValue(p.hp - randInt(5,15),0,100);
        p.happiness=clampValue(p.happiness-30,0,100);
      });
      village.log(`迎撃失敗:食料-${fLoss},資材-${mLoss},資金-${fundLoss},治安-10,村人HP-5~15,幸福-30`);
    }

    village.isRaidProcessDone=true;

    // nextTurnButton の表示を戻す
    let btn=document.getElementById("nextTurnButton");
    if (btn) {
      btn.textContent="次の月へ";
    }

    // 襲撃終了後、その月の残り処理を実行→次月へ
    village.hasDonePreEvent=false;
    village.hasDonePostEvent=false;

    // 月前半
    doFixedEventPre(village);
    doRandomEventPre(village);
    // 村人仕事
    handleAllVillagerJobs(village);
    // 月後半
    doFixedEventPost(village);
    doRandomEventPost(village);
    // 月末
    endOfMonthProcess(village);

    if (village.villagers.length===0) {
      village.log("村人全滅→ゲームオーバー");
      village.gameOver=true;
      updateUI(village);
      return;
    }

    village.month++;
    if (village.month>12) {
      village.month=1;
      village.year++;
    }

    // 季節更新を月初処理の前に実行
    if ([3,6,9,12].includes(village.month)) {
      updateSeason(village);
    }

    if (village.month===1) {
      doAgingProcess(village);
    }
    doMonthStartProcess(village);

    updateUI(village);

  }, 1500);
}

/** モーダルを閉じる */
export function closeRaidModal() {
  document.getElementById("raidOverlay").style.display="none";
  document.getElementById("raidModal").style.display="none";
}

/**
 * 肉体交換(雷/奇跡)
 *  - isLightning=true の場合はログを簡略化
 */
export function doExchange(a, b, v, isLightning) {
  let tmp={
    bodySex: a.bodySex,
    bodyAge: a.bodyAge,
    hp: a.hp,
    str: a.str, vit:a.vit, dex:a.dex, mag:a.mag, chr:a.chr,
    bodyTraits: [...a.bodyTraits],
    bodyOwner: a.bodyOwner,
    race: a.race,  // 種族も交換
    portraitFile: a.portraitFile,  // 顔グラフィック情報
    raiderPortrait: a.raiderPortrait, // 襲撃者用の顔グラフィック
    visitorPortrait: a.visitorPortrait // 訪問者用の顔グラフィック
  };
  a.bodySex=b.bodySex; 
  a.bodyAge=b.bodyAge;
  a.hp=b.hp;
  a.str=b.str; a.vit=b.vit; a.dex=b.dex; a.mag=b.mag; a.chr=b.chr;
  a.bodyTraits=[...b.bodyTraits];
  a.bodyOwner=b.bodyOwner;
  a.race=b.race;
  a.portraitFile=b.portraitFile;
  a.raiderPortrait=b.raiderPortrait;
  a.visitorPortrait=b.visitorPortrait;

  b.bodySex=tmp.bodySex;
  b.bodyAge=tmp.bodyAge;
  b.hp=tmp.hp;
  b.str=tmp.str; b.vit=tmp.vit; b.dex=tmp.dex; b.mag=tmp.mag; b.chr=tmp.chr;
  b.bodyTraits=[...tmp.bodyTraits];
  b.bodyOwner=tmp.bodyOwner;
  b.race=tmp.race;
  b.portraitFile=tmp.portraitFile;
  b.raiderPortrait=tmp.raiderPortrait;
  b.visitorPortrait=tmp.visitorPortrait;
}

/** 迎撃画面更新 */
export function updateRaidTables(village) {
  // 敵側
  let enemyTbody = document.querySelector("#enemyTable tbody");
  if (enemyTbody) {
    enemyTbody.innerHTML = "";
    village.raidEnemies.forEach(e => {
      let tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.name}</td>
        <td>${Math.floor(e.hp)}</td>
        <td>${e.action}</td>
        <td>${Math.floor(e.str)}</td>
        <td>${Math.floor(e.vit)}</td>
        <td>${Math.floor(e.mag)}</td>
        <td>${Math.floor(e.cou)}</td>
      `;
      enemyTbody.appendChild(tr);
    });
  }
  
  // 罠作成部隊
  let trapMakers = village.villagers.filter(v => v.action === "罠作成");
  let defenderTbody = document.querySelector("#defenderTable tbody");
  if (defenderTbody) {
    defenderTbody.innerHTML = "";
    trapMakers.forEach(v => {
      let tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.name}</td>
        <td>${Math.floor(v.hp)}</td>
        <td>${v.action}</td>
        <td>${Math.floor(v.str)}</td>
        <td>${Math.floor(v.vit)}</td>
        <td>${Math.floor(v.mag)}</td>
        <td>${Math.floor(v.cou)}</td>
      `;
      defenderTbody.appendChild(tr);
    });
  }
  
  // 迎撃部隊
  let raiders = village.villagers.filter(v => v.action === "迎撃");
  let raidersTbody = document.querySelector("#raidersTable tbody");
  if (raidersTbody) {
    raidersTbody.innerHTML = "";
    raiders.forEach(v => {
      let tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.name}</td>
        <td>${Math.floor(v.hp)}</td>
        <td>${Math.floor(v.str)}</td>
        <td>${Math.floor(v.vit)}</td>
        <td>${Math.floor(v.mag)}</td>
        <td>${Math.floor(v.cou)}</td>
      `;
      raidersTbody.appendChild(tr);
    });
  }
}

// 戦闘ダメージを受けた際の処理を追加
function applyDamage(target, damage, village) {
  target.hp = clampValue(target.hp - damage, 0, 100);
  
  // HP0以下になった場合の処理
  if (target.hp <= 0) {
    // 村人の場合（襲撃者でない場合）の処理
    if (!target.mindTraits.includes("襲撃者")) {
      // 負傷特性を追加
      if (!target.bodyTraits.includes("負傷")) {
        target.bodyTraits.push("負傷");
      }
      // ログ出力
      village.log(`${target.name}は重傷を負い、戦闘から離脱した`);
    }
  }
}

// 戦闘処理の部分を修正
function executeCombatAction(action, village) {
  let rlog = document.getElementById("raidLogArea");
  
  switch(action.type) {
    case "ATTACK": {
      let atk = action.attacker;
      let def = action.defender;
      let dmg = calcDamage(atk, def);
      
      // ダメージ適用を関数化した処理に変更
      applyDamage(def, dmg.damage, village);
      
      rlog.innerHTML += `<br>${atk.name} → ${def.name} : ${dmg.damage}ダメージ`;
      if (def.hp <= 0) {
        rlog.innerHTML += `<br>${def.name}は戦闘不能！`;
      }
      break;
    }
    // ... 他のケース ...
  }
  
  updateRaidTables(village);
  checkCombatEndOfActions(village);
}

function filterUnusedPortraits(portraitList) {
  if (!portraitList) return [];
  return portraitList.filter(portrait => !usedPortraits.male.has(portrait));
}
