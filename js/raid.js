// raid.js

import { randInt, randChoice, clampValue, shuffleArray } from "./util.js";
import { getRaidRulesById } from "./data/raidData.js";
import { endOfMonthProcess, doFixedEventPost, doAgingProcess, runMonthStartPhase } from "./events.js";
import { handleAllVillagerJobs } from "./jobs.js";
import {
  ACTION_DEFEND,
  ACTION_FORTIFY,
  ACTION_SHOOT,
  ACTION_TRAP,
  canPerformRaidAction,
  isRaidCombatAction
} from "./raidRules.js";
import { updateUI } from "./ui.js";

const RAID_CLOSE_DELAY_MS = 500;
const RAID_PHASE_REAR = "rear";
const RAID_PHASE_COMBAT = "combat";
const RAID_POSITION_FRONT = "front";
const RAID_POSITION_MIDDLE = "middle";
const RAID_TARGET_FRONT_FIRST = "frontFirst";
const RAID_TARGET_MIDDLE_FIRST = "middleFirst";
const RAID_TARGET_MIDDLE_ONLY = "middleOnly";
const RAID_TARGET_FRONT_MIDDLE_RANDOM = "frontMiddleRandom";

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

function getActiveRaidRules(village) {
  return getRaidRulesById(village?.currentRaid?.id);
}

function getRaidSurviveTurns(village) {
  const value = Number(getActiveRaidRules(village).defense?.surviveTurns);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

function hasSurvivedRaidTurns(village) {
  const surviveTurns = getRaidSurviveTurns(village);
  return surviveTurns != null && village.raidTurnCount > surviveTurns;
}

function isEnemyUnit(unit, village) {
  return Array.isArray(village?.raidEnemies) && village.raidEnemies.includes(unit);
}

function hasTrait(person, trait) {
  return (Array.isArray(person?.bodyTraits) && person.bodyTraits.includes(trait)) ||
    (Array.isArray(person?.mindTraits) && person.mindTraits.includes(trait));
}

function normalizeEnemyPosition(position) {
  return position === RAID_POSITION_MIDDLE ? RAID_POSITION_MIDDLE : RAID_POSITION_FRONT;
}

function getCombatPosition(unit, village) {
  if (isEnemyUnit(unit, village)) {
    return normalizeEnemyPosition(unit.raidPosition);
  }
  if (unit?.action === ACTION_SHOOT) return RAID_POSITION_MIDDLE;
  if (unit?.action === ACTION_DEFEND || unit?.action === ACTION_FORTIFY) return RAID_POSITION_FRONT;
  return "";
}

function getTrapMakers(village) {
  return village.villagers.filter(p =>
    p.action === ACTION_TRAP &&
    p.hp > 0 &&
    canPerformRaidAction(p, ACTION_TRAP, village)
  );
}

function getVillageCombatants(village) {
  return village.villagers.filter(p =>
    p.hp > 0 &&
    isRaidCombatAction(p.action) &&
    canPerformRaidAction(p, p.action, village)
  );
}

function getAliveEnemies(village) {
  return village.raidEnemies.filter(e => e.hp > 0);
}

function sortByCourage(units) {
  return units.sort((a, b) => {
    if (b.cou === a.cou) return Math.random() < 0.5 ? -1 : 1;
    return b.cou - a.cou;
  });
}

function pickFrontFirst(candidates, village) {
  const front = candidates.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_FRONT);
  const middle = candidates.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_MIDDLE);
  return front.length > 0 ? front : middle;
}

function getTargetCandidates(actor, village) {
  const actorIsEnemy = isEnemyUnit(actor, village);
  const candidates = actorIsEnemy
    ? getVillageCombatants(village)
    : getAliveEnemies(village);
  if (!actorIsEnemy) return pickFrontFirst(candidates, village);

  const targeting = actor.raidTargeting || RAID_TARGET_FRONT_FIRST;
  const front = candidates.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_FRONT);
  const middle = candidates.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_MIDDLE);

  if (targeting === RAID_TARGET_MIDDLE_ONLY) return middle.length > 0 ? middle : [];
  if (targeting === RAID_TARGET_MIDDLE_FIRST) return middle.length > 0 ? middle : front;
  if (targeting === RAID_TARGET_FRONT_MIDDLE_RANDOM) {
    const mixed = front.concat(middle);
    return mixed.length > 0 ? mixed : candidates;
  }
  return front.length > 0 ? front : middle;
}

function selectTarget(actor, village) {
  return randChoice(getTargetCandidates(actor, village));
}

function removeDefeatedEnemy(enemy, village) {
  if (enemy?.hp <= 0) {
    village.raidEnemies = village.raidEnemies.filter(e => e !== enemy);
  }
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

  let trapMakers = getTrapMakers(village);
  let combatants = getVillageCombatants(village);

  if (trapMakers.length===0 && combatants.length===0) {
    rlog.innerHTML+=`<br>戦闘に参加する者がいません！ → 自動的に襲撃成功(敵側)。`;
    village.raidActionQueue=[ {type:"AUTO_FAIL"} ];
    village.currentActionIndex=0;
  } else {
    village.raidTurnCount=0;
    createRearActionQueue(village);
  }
}

/**
 * 後衛(0ターン目)のキューを作成
 */
function createRearActionQueue(village) {
  let trapMakers = getTrapMakers(village);
  trapMakers = shuffleArray(trapMakers);

  village.raidPhase = RAID_PHASE_REAR;
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
    if (village.raidPhase === RAID_PHASE_REAR) {
      setupCombatPhase(village);
      return;
    }
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
      finalizeRaid(false, "戦闘部隊0", village);
      return;
  }
  village.currentActionIndex++;
  checkCombatEndOfActions(village);
}

/** 1件のTRAP行動 */
function doOneTrapAction(action, village) {
  let p=action.actor;
  let logDiv=document.getElementById("raidLogArea");
  if (!p||p.hp<=0 || !canPerformRaidAction(p, ACTION_TRAP, village)) {
    logDiv.innerHTML+=`<br>【罠作成】${p?p.name:"??"} は行動不能`;
    updateRaidTables(village);
    return;
  }
  if (village.raidEnemies.length===0) {
    logDiv.innerHTML+=`<br>【罠作成】敵は既に全滅`;
    updateRaidTables(village);
    return;
  }
  let e=selectTarget(p, village);
  if (!e) {
    logDiv.innerHTML+=`<br>【罠作成】狙える敵がいない`;
    updateRaidTables(village);
    return;
  }
  let dmg = Math.floor((p.dex*p.int/400)*30);
  e.hp = clampValue(e.hp - dmg, 0, 100);
  logDiv.innerHTML+=`<br>【罠作成】${p.name}→${e.name}に${dmg}ダメージ`;
  if (e.hp<=0) {
    logDiv.innerHTML+=`<br>　　→ ${e.name}は倒れた！`;
    removeDefeatedEnemy(e, village);
  }
  updateRaidTables(village);
}

/** 後衛行動後 -> 戦闘フェーズ */
export function setupCombatPhase(village) {
  const logDiv=document.getElementById("raidLogArea");

  village.raidPhase = RAID_PHASE_COMBAT;
  if (!Number.isFinite(Number(village.raidTurnCount)) || village.raidTurnCount < 1) {
    village.raidTurnCount = 1;
  }

  let combatants = getVillageCombatants(village);
  let enemies   = getAliveEnemies(village);

  if (enemies.length===0) {
    finalizeRaid(true, "罠作成だけで撃退", village);
    return;
  }
  if (combatants.length===0) {
    finalizeRaid(false, "戦闘部隊なし(行動不能)", village);
    return;
  }
  if (hasSurvivedRaidTurns(village)) {
    finalizeRaidPartSuccess(village);
    return;
  }

  logDiv.innerHTML+=`<hr><br>【戦闘フェーズ】ターン ${village.raidTurnCount} 開始`;

  village.raidActionQueue=createCombatActions(village);
  village.currentActionIndex=0;
  updateRaidTables(village);
}

/** 行動順: 中衛の勇気降順 -> 前衛の勇気降順 */
function createCombatActions(village) {
  const allUnits = getVillageCombatants(village).concat(getAliveEnemies(village));
  const middleUnits = sortByCourage(allUnits.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_MIDDLE));
  const frontUnits = sortByCourage(allUnits.filter(unit => getCombatPosition(unit, village) === RAID_POSITION_FRONT));
  return middleUnits.concat(frontUnits).map(unit => ({ type:"COMBAT", actor:unit }));
}

/** 1件のCOMBAT行動 */
function doOneCombatAction(action, village) {
  let actor=action.actor;
  let logDiv=document.getElementById("raidLogArea");
  if (!canActInCombat(actor, village)) {
    logDiv.innerHTML+=`<br>【戦闘】${actor?actor.name:"??"}は行動不能`;
    updateRaidTables(village);
    return;
  }

  if (!isEnemyUnit(actor, village) && actor.action === ACTION_FORTIFY) {
    logDiv.innerHTML+=`<br>【籠城】${actor.name}は防壁に身を寄せ、攻撃に備えた`;
    updateRaidTables(village);
    return;
  }

  let target = selectTarget(actor, village);
  if (!target) {
    logDiv.innerHTML+=`<br>【戦闘】${actor.name}が狙える相手はいない`;
    updateRaidTables(village);
    return;
  }

  const actorIsEnemy = isEnemyUnit(actor, village);
  const isRanged = getCombatPosition(actor, village) === RAID_POSITION_MIDDLE;
  const result = isRanged ? calcRangedDamage(actor, target) : calcAttackDamage(actor, target, false);
  const label = getAttackLogLabel(actor, village, isRanged);
  let dmg = result.damage;
  if (!actorIsEnemy) {
    dmg = applyOffensiveTraitModifiers(actor, dmg, label, logDiv);
  }
  dmg = applyIncomingDamageModifiers(dmg, target, village);

  const atkTypeText = result.isMagic ? "魔法攻撃" : result.attackText;
  target.hp = clampValue(target.hp - dmg, 0, 100);
  logDiv.innerHTML+=`<br>${label}${actor.name}の${atkTypeText}→${target.name}に ${dmg}ダメージ`;

  if (target.hp<=0) {
    handleCombatDefeat(target, village, logDiv);
  } else if (!isRanged && canCounterAttack(target, village)) {
    doCounterAttack(target, actor, village, logDiv);
  }
  updateRaidTables(village);
}

function canActInCombat(actor, village) {
  if (!actor || actor.hp <= 0) return false;
  if (isEnemyUnit(actor, village)) return getAliveEnemies(village).includes(actor);
  return isRaidCombatAction(actor.action) && canPerformRaidAction(actor, actor.action, village);
}

function calcRangedDamage(atk, def) {
  const damage = Math.floor(((atk.dex * atk.cou) / 400) * 40 - def.vit * 1.5);
  return {
    damage: Math.max(0, damage),
    isMagic: false,
    attackText: "射撃"
  };
}

function getAttackLogLabel(actor, village, isRanged) {
  if (isEnemyUnit(actor, village)) return isRanged ? "【敵の射撃】" : "【敵の攻撃】";
  return isRanged ? "【射撃】" : "【迎撃】";
}

function applyOffensiveTraitModifiers(actor, damage, label, logDiv) {
  let nextDamage = damage;
  if (hasTrait(actor, "歴戦")) {
    nextDamage = Math.floor(nextDamage * 1.2);
    logDiv.innerHTML+=`<br>${label}${actor.name}は歴戦の経験で強力な攻撃！`;
  }

  if (hasTrait(actor, "非戦主義")) {
    nextDamage = 0;
    logDiv.innerHTML+=`<br>${label}${actor.name}は非戦主義のため攻撃を拒否！`;
  }
  return nextDamage;
}

function applyIncomingDamageModifiers(damage, target, village) {
  let multiplier = 1;
  if (getCombatPosition(target, village) === RAID_POSITION_MIDDLE) {
    multiplier *= 1.2;
  }
  if (!isEnemyUnit(target, village) && target.action === ACTION_FORTIFY) {
    multiplier *= 0.8;
  }
  return Math.max(0, Math.floor(damage * multiplier));
}

function canCounterAttack(target, village) {
  return getCombatPosition(target, village) === RAID_POSITION_FRONT;
}

function doCounterAttack(counterActor, target, village, logDiv) {
  let ret=calcAttackDamage(counterActor, target, true);
  let rdmg=Math.floor(ret.damage*0.5);
  let retTypeText=ret.isMagic? "魔法攻撃":"物理攻撃";
  target.hp = clampValue(target.hp - rdmg, 0, 100);
  logDiv.innerHTML+=`<br>　　→ 反撃(${retTypeText}):${counterActor.name}→${target.name}に${rdmg}ダメージ`;
  if (target.hp<=0) {
    handleCombatDefeat(target, village, logDiv);
  }
}

function handleCombatDefeat(target, village, logDiv) {
  if (isEnemyUnit(target, village)) {
    logDiv.innerHTML+=`<br>　　→ ${target.name}は倒れた！`;
    removeDefeatedEnemy(target, village);
    return;
  }
  logDiv.innerHTML+=`<br>　　→ ${target.name}は負傷離脱(HP0)`;
  if (!target.bodyTraits.includes("負傷")) target.bodyTraits.push("負傷");
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
  return {damage:Math.floor(finalDamage), isMagic:usedMagic, attackText:"物理攻撃"};
}

/** 全アクション完了後にターン終了 */
function finalizeCombatTurn(village) {
  let logDiv=document.getElementById("raidLogArea");

  let combatants = getVillageCombatants(village);
  let enemies   = getAliveEnemies(village);

  if (combatants.length===0) {
    finalizeRaid(false, "戦闘部隊全滅", village);
    return;
  }
  if (enemies.length===0) {
    finalizeRaid(true, "敵全滅", village);
    return;
  }

  village.raidTurnCount++;
  if (hasSurvivedRaidTurns(village)) {
    finalizeRaidPartSuccess(village);
  } else {
    setupCombatPhase(village);
  }
}

/** 全員の行動終了時に敵 or 迎撃側が全滅したかどうか確認 */
function checkCombatEndOfActions(village) {
  let enemies   = getAliveEnemies(village);

  if (enemies.length===0) {
    finalizeRaid(true, "敵全滅", village);
    return;
  }
  if (village.raidPhase === RAID_PHASE_REAR) {
    if (village.currentActionIndex < village.raidActionQueue.length) {
      return;
    }
    setupCombatPhase(village);
    return;
  }

  let combatants = getVillageCombatants(village);
  if (combatants.length===0) {
    finalizeRaid(false, "戦闘部隊全滅", village);
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

/** 指定ターン粘って撤退(部分成功) */
function finalizeRaidPartSuccess(village) {
  const surviveTurns = getRaidSurviveTurns(village) || 5;
  village.log(`【襲撃結果】${surviveTurns}ターン粘って敵撤退→部分的成功`);
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
  village.raidPhase = "";
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

    const raidRules = getActiveRaidRules(village);
    if (isSuccess) {
      const happinessGain = Number(isPartSuccess
        ? raidRules.successRewards?.partialHappiness
        : raidRules.successRewards?.completeHappiness) || 0;
      if (happinessGain !== 0) {
        village.villagers.forEach(p=>{
          p.happiness=clampValue(p.happiness+happinessGain,0,100);
        });
      }
      village.log(isPartSuccess
        ? `防衛成功(部分):村人幸福+${happinessGain}`
        : `防衛成功(敵全滅):村人幸福+${happinessGain}`);
    } else {
      const penalty = raidRules.failurePenalty || {};
      const fLoss=Math.floor(village.food*(Number(penalty.foodRate) || 0));
      const mLoss=Math.floor(village.materials*(Number(penalty.materialsRate) || 0));
      const fundLoss=Math.floor(village.funds*(Number(penalty.fundsRate) || 0));
      const securityLoss=Number(penalty.security) || 0;
      const happinessLoss=Number(penalty.villagerHappiness) || 0;
      const hpRange=Array.isArray(penalty.villagerHpRange) ? penalty.villagerHpRange : null;
      const hpMinRaw=hpRange ? Number(hpRange[0]) || 0 : 0;
      const hpMaxRaw=hpRange ? Number(hpRange[1]) || hpMinRaw : 0;
      const hpMin=Math.min(hpMinRaw, hpMaxRaw);
      const hpMax=Math.max(hpMinRaw, hpMaxRaw);

      village.food=clampValue(village.food - fLoss,0,99999);
      village.materials=clampValue(village.materials - mLoss,0,99999);
      village.funds=clampValue(village.funds - fundLoss,0,99999);
      village.security=clampValue(village.security-securityLoss,0,100);

      village.villagers.forEach(p=>{
        if (hpMax > 0) {
          p.hp=clampValue(p.hp - randInt(hpMin, hpMax),0,100);
        }
        if (happinessLoss !== 0) {
          p.happiness=clampValue(p.happiness-happinessLoss,0,100);
        }
      });

      const penaltyLog = [
        `食料-${fLoss}`,
        `資材-${mLoss}`,
        `資金-${fundLoss}`,
        `治安-${securityLoss}`,
        hpMax > 0 ? `村人HP-${hpMin}~${hpMax}` : "",
        `幸福-${happinessLoss}`
      ].filter(Boolean).join(",");
      village.log(`迎撃失敗:${penaltyLog}`);
    }

    village.isRaidProcessDone=true;
    village.currentRaid = null;

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
    // 村人行動
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
        <td>${getCombatPosition(e, village) === RAID_POSITION_MIDDLE ? "中衛" : "前衛"}</td>
        <td>${Math.floor(e.str)}</td>
        <td>${Math.floor(e.vit)}</td>
        <td>${Math.floor(e.mag)}</td>
        <td>${Math.floor(e.cou)}</td>
      `;
      enemyTbody.appendChild(tr);
    });
  }
  
  // 後衛
  let trapMakers = getTrapMakers(village);
  let defenderTbody = document.querySelector("#defenderTable tbody");
  if (defenderTbody) {
    defenderTbody.innerHTML = "";
    trapMakers.forEach(v => {
      let tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.name}</td>
        <td>${Math.floor(v.hp)}</td>
        <td>${v.action}</td>
        <td>${Math.floor(v.dex)}</td>
        <td>${Math.floor(v.int)}</td>
        <td>${Math.floor(v.cou)}</td>
      `;
      defenderTbody.appendChild(tr);
    });
  }

  // 中衛
  let shooters = village.villagers.filter(v => v.action === ACTION_SHOOT && canPerformRaidAction(v, ACTION_SHOOT, village));
  let shootersTbody = document.querySelector("#shootersTable tbody");
  if (shootersTbody) {
    shootersTbody.innerHTML = "";
    shooters.forEach(v => {
      let tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${v.name}</td>
        <td>${Math.floor(v.hp)}</td>
        <td>${v.action}</td>
        <td>${Math.floor(v.str)}</td>
        <td>${Math.floor(v.vit)}</td>
        <td>${Math.floor(v.dex)}</td>
        <td>${Math.floor(v.cou)}</td>
      `;
      shootersTbody.appendChild(tr);
    });
  }
  
  // 前衛
  let raiders = village.villagers.filter(v =>
    (v.action === ACTION_DEFEND || v.action === ACTION_FORTIFY) &&
    canPerformRaidAction(v, v.action, village)
  );
  let raidersTbody = document.querySelector("#raidersTable tbody");
  if (raidersTbody) {
    raidersTbody.innerHTML = "";
    raiders.forEach(v => {
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
