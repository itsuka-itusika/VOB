// raid.js

import { randInt, randChoice, clampValue, shuffleArray } from "./util.js";
import { endOfMonthProcess, doFixedEventPost, doAgingProcess, runMonthStartPhase } from "./events.js";
import { handleAllVillagerJobs } from "./jobs.js";
import { canPerformRaidAction } from "./raidRules.js";
import { updateUI } from "./ui.js";

const RAID_CLOSE_DELAY_MS = 500;

function getRaidStepButton() {
  return document.getElementById("raidStepButton") ||
    document.querySelector("#raidModal .raid-buttons button");
}

function setRaidStepButtonState(disabled, text = "") {
  const button = getRaidStepButton();
  if (!button) return;
  button.disabled = disabled;
  if (text) button.textContent = text;
}

/**
 * 襲撃者タイプの定義
 */

/**
 * 重み付き抽選で襲撃者タイプを選択
 */


/**
 * 迎撃モーダルを開く (nextTurnから呼ばれる)
 */
export function openRaidModal(village) {
  document.getElementById("raidOverlay").style.display="block";
  document.getElementById("raidModal").style.display="block";
  setRaidStepButtonState(false, "次のステップ");

  updateRaidTables(village);
  const rlog=document.getElementById("raidLogArea");
  rlog.innerHTML="襲撃が始まります。<br>「次のステップ」ボタンを押して進めてください。";

  let trapMakers = village.villagers.filter(p=> p.action==="罠作成" && canPerformRaidAction(p, "罠作成"));
  let defenders  = village.villagers.filter(p=> p.action==="迎撃" && canPerformRaidAction(p, "迎撃"));

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
  let trapMakers = village.villagers.filter(p=>p.action==="罠作成" && p.hp>0 && canPerformRaidAction(p, "罠作成"));
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
  if (village.isRaidFinalizing || village.isRaidProcessDone) return;

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
  if (!p||p.hp<=0 || !canPerformRaidAction(p, "罠作成")) {
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
  e.hp = clampValue(e.hp - dmg, 0, 100);
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

  let defenders = village.villagers.filter(p=> p.action==="迎撃" && p.hp>0 && canPerformRaidAction(p, "迎撃"));
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
  if (!actor||actor.hp<=0 || (!village.raidEnemies.includes(actor) && !canPerformRaidAction(actor, "迎撃"))) {
    logDiv.innerHTML+=`<br>【迎撃】${actor?actor.name:"??"}は行動不能`;
    updateRaidTables(village);
    return;
  }
  let isEnemy = village.raidEnemies.includes(actor);

  let defenders = village.villagers.filter(p=> p.action==="迎撃" && p.hp>0 && canPerformRaidAction(p, "迎撃"));
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
    target.hp = clampValue(target.hp - dmg, 0, 100);
    logDiv.innerHTML+=`<br>【敵の攻撃】${actor.name}の${atkTypeText}→${target.name}に ${dmg}ダメージ`;
    if (target.hp<=0) {
      logDiv.innerHTML+=`<br>　　→ ${target.name}は負傷離脱(HP0)`;
      if (!target.bodyTraits.includes("負傷")) target.bodyTraits.push("負傷");
    } else {
      // 反撃
      let ret=calcAttackDamage(target, actor, true);
      let rdmg=Math.floor(ret.damage*0.5);
      let retTypeText=ret.isMagic? "魔法攻撃":"物理攻撃";
      actor.hp = clampValue(actor.hp - rdmg, 0, 100);
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
    
    // 精神特性による修正
    if (actor.mindTraits.includes("歴戦")) {
      dmg = Math.floor(dmg * 1.2);
      logDiv.innerHTML+=`<br>【迎撃】${actor.name}は歴戦の経験で強力な攻撃！`;
    }
    
    if (actor.mindTraits.includes("非戦主義")) {
      dmg = 0;
      logDiv.innerHTML+=`<br>【迎撃】${actor.name}は非戦主義のため攻撃を拒否！`;
    }
    
    let atkTypeText=result.isMagic? "魔法攻撃":"物理攻撃";
    target.hp = clampValue(target.hp - dmg, 0, 100);
    logDiv.innerHTML+=`<br>【迎撃】${actor.name}の${atkTypeText}→${target.name}に ${dmg}ダメージ`;
    if (target.hp<=0) {
      logDiv.innerHTML+=`<br>　　→ ${target.name}は倒れた！`;
      village.raidEnemies=village.raidEnemies.filter(e=> e!==target);
    } else {
      // 敵の反撃
      let ret=calcAttackDamage(target, actor, true);
      let rdmg=Math.floor(ret.damage*0.5);
      let retTypeText=ret.isMagic? "魔法攻撃":"物理攻撃";
      actor.hp = clampValue(actor.hp - rdmg, 0, 100);
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

  let defenders = village.villagers.filter(p=> p.action==="迎撃" && p.hp>0 && canPerformRaidAction(p, "迎撃"));
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
  let defenders = village.villagers.filter(p=> p.action==="迎撃" && p.hp>0 && canPerformRaidAction(p, "迎撃"));
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
  if (village.isRaidFinalizing || village.isRaidProcessDone) return;

  village.isRaidFinalizing = true;
  village.isRaidProcessDone = true;
  village.raidActionQueue = [];
  village.currentActionIndex = 0;
  setRaidStepButtonState(true, "終了処理中...");
  const nextTurnButton = document.getElementById("nextTurnButton");
  if (nextTurnButton) {
    nextTurnButton.disabled = true;
  }

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
        village.log("防衛成功(部分):村人幸福+10");
      } else {
        // 完全成功
        village.villagers.forEach(p=>{
          p.happiness=clampValue(p.happiness+20,0,100);
        });
        village.log("防衛成功(敵全滅):村人幸福+20");
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
      btn.disabled = false;
    }
    let autoAssignBtn = document.getElementById("autoAssignButton");
    if (autoAssignBtn) {
      autoAssignBtn.textContent = "自動割り振り";
    }
    const raidAssignBtn = document.getElementById("raidAssignButton");
    if (raidAssignBtn) {
      raidAssignBtn.style.display = "none";
    }

    // 襲撃終了後、その月の残り処理を実行→次月へ
    // 村人仕事
    handleAllVillagerJobs(village);
    doFixedEventPost(village);
    // 月末
    endOfMonthProcess(village);

    if (village.villagers.length===0) {
      village.log("村人全滅→ゲームオーバー");
      village.gameOver=true;
      village.isRaidFinalizing = false;
      updateUI(village);
      return;
    }

    village.month++;
    if (village.month>12) {
      village.month=1;
      village.year++;
    }

    village.hasDonePreEvent=false;
    village.hasDonePostEvent=false;
    village.log(`=== ${village.year}年${village.month}月 ===`);

    if (village.month===1) {
      doAgingProcess(village);
    }
    runMonthStartPhase(village);

    village.isRaidFinalizing = false;
    updateUI(village);

  }, RAID_CLOSE_DELAY_MS);
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
  let trapMakers = village.villagers.filter(v => v.action === "罠作成" && canPerformRaidAction(v, "罠作成"));
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
  let raiders = village.villagers.filter(v => v.action === "迎撃" && canPerformRaidAction(v, "迎撃"));
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
