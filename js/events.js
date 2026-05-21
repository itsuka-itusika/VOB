// events.js

import { randInt, clampValue, round3, getVillagerFoodConsumption, getVillagerWinterMaterialConsumption } from "./util.js";
import { doLoverCheck, doMarriageCheck, clearRelationshipsForDepartedVillager } from "./relationships.js";
import { createRandomVillager, createRandomVisitor } from "./createVillagers.js";
import { startRaidEvent } from "./raidStart.js";
import { RandomEvents } from "./RandomEvents.js";
import { handleBirthAndPostpartum, handlePregnancyChecks, updateChildGrowthStage } from "./reproduction.js";
import { showFestivalModal } from "./festivalModal.js";
import { applyForcedActionRestriction, refreshJobTable } from "./domain/jobTables.js";

/**
 * 固定イベント(前半) - 新年祭,夏至祭,星霜祭など
 */
export function doFixedEventPre(village) {
  if (!village.hasDonePreEvent) {
    switch(village.month) {
      case 1:
        newYearFestival(village);
        village.hasDonePreEvent = true;
        break;
      case 6:
        summerSolsticeFestival(village);
        village.hasDonePreEvent = true;
        break;
      case 12:
        starsFestival(village);
        village.hasDonePreEvent = true;
        break;
    }
  }
}

/**
 * 固定イベント(後半) - 復活祭,収穫祭など
 */
export function doFixedEventPost(village) {
  if (!village.hasDonePostEvent) {
    switch(village.month) {
      case 3:
        resurrectionFestival(village);
        village.hasDonePostEvent=true;
        break;
      case 10:
        harvestFestival(village);
        village.hasDonePostEvent=true;
        break;
    }
  }
}

// -------------------------
// 各祭り
// -------------------------
function newYearFestival(v) {
  showFestivalModal("newYear");
  v.log("【新年祭】体力+20,メンタル+20,幸福+20-30 全員");
  v.villagers.forEach(p=>{
    p.hp=clampValue(p.hp+20,0,100);
    p.mp=clampValue(p.mp+20,0,100);
    let inc=randInt(20,30);
    p.happiness=clampValue(p.happiness+inc,0,100);
  });
}

function resurrectionFestival(v) {
  showFestivalModal("resurrection");
  v.log("【復活祭】体力+20,メンタル+20 +追加魔素");
  v.villagers.forEach(p=>{
    p.hp=clampValue(p.hp+20,0,100);
    p.mp=clampValue(p.mp+20,0,100);
  });
  let total=0;
  v.villagers.forEach(p=>{
    let amt=10*(p.happiness/100);
    total+=amt;
  });
  let g=Math.floor(total);
  v.mana=clampValue(v.mana+g,0,99999);
  v.log(`復活祭:魔素+${g}`);
}

function summerSolsticeFestival(v) {
  showFestivalModal("summerSolstice");
  v.log("【夏至祭】体力+20,メンタル+20,幸福+20-30 +結婚判定");
  v.villagers.forEach(p=>{
    p.hp=clampValue(p.hp+20,0,100);
    p.mp=clampValue(p.mp+20,0,100);
    let inc=randInt(20,30);
    p.happiness=clampValue(p.happiness+inc,0,100);
  });
  doMarriageCheck(v);
}

function harvestFestival(v) {
  showFestivalModal("harvest");
  v.log("【収穫祭】全員体力+40,メンタル+20");
  v.villagers.forEach(p=>{
    p.hp=clampValue(p.hp+40,0,100);
    p.mp=clampValue(p.mp+20,0,100);
  });
}

function starsFestival(v) {
  showFestivalModal("stars");
  v.log("【星霜祭】体力+20,メンタル+20 +追加魔素 +恋人判定");
  v.villagers.forEach(p=>{
    p.hp=clampValue(p.hp+20,0,100);
    p.mp=clampValue(p.mp+20,0,100);
  });
  let total=0;
  v.villagers.forEach(p=>{
    let amt=10*(p.happiness/100);
    total+=amt;
  });
  let g=Math.floor(total);
  v.mana=clampValue(v.mana+g,0,99999);
  v.log(`星霜祭:魔素+${g}`);
  doLoverCheck(v);
}

// -------------------------
// ランダムイベント
// -------------------------
export function doRandomEventPre(village) {
  RandomEvents.execute(village, "前", { chanceMultiplier: 1.6 });
}
export function doRandomEventPost(village) {
  // 後ランダムイベントは廃止。ランダムイベントは行動前のみ発生する。
}

export function doRaidStartCheck(village) {
  const raidProb = village.villageTraits.includes("荒廃") ? 0.4 : 0.2;
  if (Math.random() < raidProb) {
    startRaidEvent(village);
  }
}

function applyMonthStartRestrictions(village) {
  village.villagers.forEach(person => {
    const restriction = applyForcedActionRestriction(person);
    if (restriction.restricted && restriction.changed) {
      village.log(`${person.name}は${restriction.reason}のため、行動を「${restriction.action}」に設定しました`);
    }
  });
}

export function runMonthStartPhase(village) {
  doMonthStartProcess(village);
  if ([3,6,9,12].includes(village.month)) {
    updateSeason(village);
  }
  doFixedEventPre(village);
  handleBirthAndPostpartum(village);
  doRandomEventPre(village);
  applyMonthStartRestrictions(village);
  doRaidStartCheck(village);
}

function getVisitorLimit(village) {
  const savedLimit = Number(village.visitorLimit) || 1;
  const tavernLimit = village.buildingFlags && village.buildingFlags.hasTavern ? 2 : 1;
  return Math.max(1, savedLimit, tavernLimit);
}

// -------------------------
// 月末処理
// -------------------------
export function endOfMonthProcess(v) {
  v.log("【月末処理】");

  // 治安31以上で荒廃状態解除
  if (v.security > 30) {
    let index = v.villageTraits.indexOf("荒廃");
    if (index !== -1) {
      v.villageTraits.splice(index, 1);
      v.log("治安が回復し、村の荒廃状態が解消された");
    }
  }

  let totalF=0;
  let totalMat=0;
  let isWinter = v.villageTraits.includes("冬");

  v.villagers.forEach(p=>{
    totalF += getVillagerFoodConsumption(p);

    if (isWinter) {
      totalMat += getVillagerWinterMaterialConsumption(p);
    }
  });
  v.food=clampValue(v.food - totalF,0,99999);
  v.materials=clampValue(v.materials - totalMat,0,99999);

  if (totalF>0) v.log(`食料-${totalF}`);
  if (totalMat>0) v.log(`資材-${totalMat}`);

  let removeList=["豊穣","訪問者","襲撃者","ミダス"];
  // "襲撃中" はここでは消さない(raid.js 内で完了時に消す)
  v.villageTraits = v.villageTraits.filter(tr=> !removeList.includes(tr));

  // 狂乱の解除処理を最初に行う
  v.villagers.forEach(p => {
    if (p.mindTraits.includes("狂乱")) {
      p.mindTraits = p.mindTraits.filter(t => t !== "狂乱");
      // 倫理値と好色値を元に戻す
      p.eth = round3(p.eth / 0.2);
      p.sexdr = clampValue(p.sexdr - 15, 0, 100);  // 加算した15を引く
      v.log(`${p.name}の狂乱が解除された`);
    }
  });

  // 火星の加護の効果期間更新 (3ヶ月経過した場合、効果を終了)
  v.villagers.forEach(p => {
    if (p.bodyTraits.includes("火星の加護")) {
      if (typeof p.ares !== 'number') {
         p.ares = 0;
      }
      p.ares++;
      if (p.ares >= 3) {
         // 3ヶ月経過したら、効果を終了
         p.bodyTraits = p.bodyTraits.filter(trait => trait !== "火星の加護");
         // 効果を元に戻す（付与時の逆の計算を行う）
         p.str = round3(p.str / 1.6);
         p.vit = round3(p.vit / 1.6);
         p.cou = round3(p.cou / 1.6);
         p.int = round3(p.int / 0.2);
         p.eth = round3(p.eth / 0.2);
         p.ind = round3(p.ind / 0.2);
         p.ares = 0;
         v.log(`【戦神の奇跡終了】${p.name}の火星の加護効果が切れました`);
      }
    }
  });

  // ニケの効果期間更新 (1ヶ月経過した場合、効果を終了)
  v.villagers.forEach(p => {
    if (p.mindTraits.includes("ニケ")) {
      if (typeof p.nikeMonths !== "number") {
        p.nikeMonths = 0;
      }
      p.nikeMonths++;
      if (p.nikeMonths >= 1) {
        p.mindTraits = p.mindTraits.filter(trait => trait !== "ニケ");
        p.cou = clampValue(p.cou - 10, 0, 100);
        p.nikeMonths = 0;
        v.log(`【ニケ終了】${p.name}のニケ効果が切れました`);
      }
    }
  });

  // 状態異常の解除処理
  v.villagers.forEach(p => {
    // 身体特性からの状態異常解除
    let bodyTraitsToRemove = ["飢餓", "凍え", "疲労", "過労", "病気", "疫病"];
    bodyTraitsToRemove.forEach(trait => {
      if (p.bodyTraits.includes(trait)) {
        // 特性を解除
        p.bodyTraits = p.bodyTraits.filter(t => t !== trait);
        
        // ステータス回復
        switch(trait) {
          case "飢餓":
            p.str = round3(p.str / 0.5);  // 50%から回復
            p.vit = round3(p.vit / 0.5);
            p.dex = round3(p.dex / 0.5);
                        break;
          case "凍え":
            p.str = round3(p.str / 0.8);  // 80%から回復
            p.vit = round3(p.vit / 0.8);
            p.dex = round3(p.dex / 0.8);
                        break;
          case "疲労":
            p.str = round3(p.str / 0.8);  // 80%から回復
            p.vit = round3(p.vit / 0.8);
            p.dex = round3(p.dex / 0.8);
                        break;
          case "過労":
            p.str = round3(p.str / 0.25);  // 25%から回復
            p.vit = round3(p.vit / 0.25);
            p.dex = round3(p.dex / 0.25);
                        break;
          case "疫病":
            p.hp = clampValue(round3(p.hp / 0.5), 0, 100);
            p.str = round3(p.str / 0.5);
            p.vit = round3(p.vit / 0.5);
            p.dex = round3(p.dex / 0.5);
                        break;
          default:
            
        }
      }
    });

    // 精神特性からの状態異常解除
    let mindTraitsToRemove = ["心労", "抑鬱"];
    mindTraitsToRemove.forEach(trait => {
      if (p.mindTraits.includes(trait)) {
        // 特性を解除
        p.mindTraits = p.mindTraits.filter(t => t !== trait);
        
        // ステータス回復
        switch(trait) {
          case "心労":
            p.int = round3(p.int / 0.8);  // 80%から回復
            p.cou = round3(p.cou / 0.8);
            p.ind = round3(p.ind / 0.8);
            p.eth = round3(p.eth / 0.8);
            p.sexdr = round3(p.sexdr / 0.8);
                        break;
          case "抑鬱":
            p.int = round3(p.int / 0.25);  // 25%から回復
            p.cou = round3(p.cou / 0.25);
            p.ind = round3(p.ind / 0.25);
            p.eth = round3(p.eth / 0.25);
            p.sexdr = round3(p.sexdr / 0.25);
                        break;
        }
      }
    });
  });

  // 危篤者の死亡処理（危篤者は必ず死亡）
  let deadPeople = v.villagers.filter(p => p.bodyTraits.includes("危篤"));
  deadPeople.forEach(p => {
    let index = v.villagers.indexOf(p);
    if (index !== -1) {
      clearRelationshipsForDepartedVillager(v, p);
      v.villagers.splice(index, 1);
      v.log(`${p.name}は老衰により死亡した...`);
    }
  });

  handlePregnancyChecks(v);

  // ログ出力を元に戻す処理を削除
  // v.log = originalLog;

  // 月末サマリーモーダルを表示する処理を削除
  // showMonthEndSummary(monthEndLogs);
}

/**
 * 月初処理
 *  - 魔素増加(幸福度ベース)
 *  - 食料/資材0時のペナルティ
 *  - 幸福度調整
 *  - 訪問者生成
 *  - jobTable再構築
 */
export function doMonthStartProcess(v) {
  v.log("【月初処理】");

  // 治安30以下で荒廃状態に
  if (v.security <= 30 && !v.villageTraits.includes("荒廃")) {
    v.villageTraits.push("荒廃");
    v.log("治安悪化により村が荒廃状態になった！");
  }

  // 老人の危篤化判定（5%）
  v.villagers.forEach(p => {
    if (p.bodyTraits.includes("老人") && !p.bodyTraits.includes("危篤")) {
      if (Math.random() < 0.05) {  // 5%の確率
        p.bodyTraits.push("危篤");
        v.log(`${p.name}は老衰により危篤状態になった...`);
      }
    }
  });

  // 幸福度由来の魔素増加
  let tot=0;
  v.villagers.forEach(p=>{
    let amt=10*(p.happiness/100);
    tot+=amt;
  });
  let gain=Math.floor(tot);
  v.mana=clampValue(v.mana+gain,0,99999);
  v.log(`魔素+${gain}(村人幸福度由来)`);

  // 食料/資材0のペナルティ
  if (v.food<=0) {
    v.log("食料0→飢餓発生");
    v.villagers.forEach(p=>{
      // 飢餓の身体特性を付与（まだ持っていない場合のみ）
      if (!p.bodyTraits.includes("飢餓")) {
        p.bodyTraits.push("飢餓");
      }
      
      // 各種ステータスにペナルティ
      p.str = round3(p.str * 0.5);  // 筋力を50%に
      p.vit = round3(p.vit * 0.5);  // 耐久を50%に
      p.dex = round3(p.dex * 0.5);  // 器用を50%に
      p.hp = Math.floor(p.hp * 0.5);  // 体力を50%に
      p.mp = Math.floor(p.mp * 0.5);  // メンタルを50%に
      p.happiness = clampValue(p.happiness - 30, 0, 100);  // 幸福度-30
    });
  }
  if (v.villageTraits.includes("冬") && v.materials<=0) {
    v.log("冬なのに資材0→凍え");
    v.villagers.forEach(p=>{
      if (p.bodyTraits.includes("モフモフ")) {
        v.log(`${p.name}はモフモフに守られて凍えを免れた`);
        return;
      }

      // 凍えの身体特性を付与（まだ持っていない場合のみ）
      if (!p.bodyTraits.includes("凍え")) {
        p.bodyTraits.push("凍え");
      }
      
      // 各種ステータスにペナルティ
      p.str = round3(p.str * 0.8);  // 筋力を80%に
      p.vit = round3(p.vit * 0.8);  // 耐久を80%に
      p.dex = round3(p.dex * 0.8);  // 器用を80%に
      p.hp = Math.floor(p.hp * 0.5);  // 体力を50%に
      p.mp = Math.floor(p.mp * 0.5);  // メンタルを50%に
      p.happiness = clampValue(p.happiness - 30, 0, 100);  // 幸福度-30
    });
  }


  // 体力・メンタル状態によるペナルティ
  v.villagers.forEach(p => {
    // 体力に関するペナルティ
    if (p.hp <= 0) {
      // 過労状態
      if (!p.bodyTraits.includes("過労")) {
        p.bodyTraits.push("過労");
      }
      p.str = round3(p.str * 0.25);
      p.vit = round3(p.vit * 0.25);
      p.dex = round3(p.dex * 0.25);
      p.happiness = clampValue(p.happiness - 30, 0, 100);
      

      v.log(`${p.name}は過労状態になった`);
    } else if (p.hp <= 33) {
      // 疲労状態
      if (!p.bodyTraits.includes("疲労")) {
        p.bodyTraits.push("疲労");
      }
      p.str = round3(p.str * 0.8);
      p.vit = round3(p.vit * 0.8);
      p.dex = round3(p.dex * 0.8);
      v.log(`${p.name}は疲労状態になった`);
    }
    
    // メンタルに関するペナルティ
    if (p.mp <= 0) {
      // 抑鬱状態
      if (!p.mindTraits.includes("抑鬱")) {
        p.mindTraits.push("抑鬱");
      }
      p.int = round3(p.int * 0.25);
      p.cou = round3(p.cou * 0.25);
      p.ind = round3(p.ind * 0.25);
      p.eth = round3(p.eth * 0.25);
      p.sexdr = round3(p.sexdr * 0.25);
      p.happiness = clampValue(p.happiness - 30, 0, 100);


      v.log(`${p.name}は抑鬱状態になった`);
    } else if (p.mp <= 33) {
      // 心労状態
      if (!p.mindTraits.includes("心労")) {
        p.mindTraits.push("心労");
      }
      p.int = round3(p.int * 0.8);
      p.cou = round3(p.cou * 0.8);
      p.ind = round3(p.ind * 0.8);
      p.eth = round3(p.eth * 0.8);
      p.sexdr = round3(p.sexdr * 0.8);
      v.log(`${p.name}は心労状態になった`);
    }
  });
  // 幸福度調整
  v.villagers.forEach(p=>{
    if (p.happiness>50) {
      let diff = p.happiness-50;
      let dec = Math.floor(diff * randFloat(0.2,0.4));
      p.happiness=clampValue(p.happiness-dec,0,100);
    }
  });
  // 既存の訪問者をクリア
  v.visitors = [];

  const visitorLimit = getVisitorLimit(v);
  v.visitorLimit = visitorLimit;

  // 各訪問者枠ごとに50%の確率で訪問者を生成
  for (let i = 0; i < visitorLimit; i++) {
    if (Math.random() < 0.5) {
      let visitor = createRandomVisitor([
        ...v.villagers.map(person => person.name),
        ...v.visitors.map(person => person.name)
      ]);
      v.visitors.push(visitor);
      v.log(`訪問者 ${visitor.name} が村を訪れました`);
    }
  }

  // 全村人の行動テーブルを再構築
  v.villagers.forEach(p=>{
    let currentAction = p.action; // 現在のactionを保存
    
    // 一旦空にする
    p.actionTable = [];
    p.jobTable = [];  // jobTableも初期化
    
    const restriction = applyForcedActionRestriction(p);
    if (restriction.restricted) {
      v.log(`${p.name}は${restriction.reason}のため、行動を「${restriction.action}」に設定しました`);
      return;
    }
    
    refreshJobTable(p, v);

    // 月ごとの一時的な行動変更は翌月まで持ち越さず、基本は仕事と同じ行動へ戻す。
    // 仕事が行動として選べない村人は、休養などの有効な行動まで「なし」に戻さない。
    const refreshedAction = p.action;
    if (p.actionTable.includes(p.job)) {
      p.action = p.job;
    } else if (p.actionTable.includes(currentAction)) {
      p.action = currentAction;
    } else if (p.actionTable.includes(refreshedAction)) {
      p.action = refreshedAction;
    } else {
      p.action = p.actionTable.includes("休養") ? "休養" : (p.actionTable[0] || "なし");
    }

    // 勤勉度および体力・メンタルによる休養判定
    let needsRest = false;
    let restReason = "";

    if (p.ind >= 21) {
      // 高勤勉の場合、体力かメンタルが33以下なら休養
      if (p.hp <= 33 && p.mp <= 33) {
        needsRest = true;
        restReason = "体力とメンタルが低下";
        p.action = p.hp <= p.mp ? "休養" : "余暇";
      } else if (p.hp <= 33) {

        needsRest = true;
        restReason = "体力が低下";
        p.action = "休養";
      } else if (p.mp <= 33) {
        needsRest = true;
        restReason = "メンタルが低下";
        p.action = "余暇";
      }
    } else if (p.ind >= 13) {
      // 中勤勉の場合、体力かメンタルが50以下なら休養
      if (p.hp <= 50 && p.mp <= 50) {
        needsRest = true;
        restReason = "体力とメンタルが低下";
        p.action = p.hp <= p.mp ? "休養" : "余暇";
      } else if (p.hp <= 50) {
        needsRest = true;
        restReason = "体力が低下";
        p.action = "休養";
      } else if (p.mp <= 50) {
        needsRest = true;
        restReason = "メンタルが低下";
        p.action = "余暇";
      }
    } else {
      // 低勤勉の場合、体力かメンタルが60以下なら休養
      if (p.hp <= 60 && p.mp <= 60) {
        needsRest = true;
        restReason = "体力とメンタルが低下";
        p.action = p.hp <= p.mp ? "休養" : "余暇";
      } else if (p.hp <= 60) {
        needsRest = true;
        restReason = "体力が低下";
        p.action = "休養";
      } else if (p.mp <= 60) {
        needsRest = true;
        restReason = "メンタルが低下";
        p.action = "余暇";
      }
    }

    // 休養が必要な場合はログに表示
    if (needsRest) {
      v.log(`${p.name}は${restReason}のため、${p.action}します`);
    }
  });
}

// -------------------------
// 加齢 (年始に呼ばれる)
// -------------------------
export function doAgingProcess(v) {
  v.log("【加齢処理】");
  v.villagers.forEach(p=>{
    p.bodyAge++;
    p.spiritAge++;
    if (!p.bodyTraits.includes("老人")) {
      if (p.bodyAge>=60) {
        p.bodyTraits.push("老人");
        p.str = round3(p.str * 0.5);
        p.vit = round3(p.vit * 0.5);
        p.chr = round3(p.chr * 0.5);
        v.log(`${p.name}は老人になった`);
      } else if (!p.bodyTraits.includes("中年") && p.bodyAge>=40) {
        p.bodyTraits.push("中年");
        p.str = round3(p.str * 0.75);
        p.vit = round3(p.vit * 0.75);
        p.chr = round3(p.chr * 0.75);
        v.log(`${p.name}は中年になった`);
      }
    }
    v.log(`${p.name}:${p.bodyAge}歳(精神年齢${p.spiritAge})`);
    updateChildGrowthStage(p, v, { announce: true });
  });
}

// -------------------------
// 季節更新
// -------------------------
export function updateSeason(v) {
  ["春","夏","秋","冬"].forEach(ss=>{
    let i=v.villageTraits.indexOf(ss);
    if (i>=0) v.villageTraits.splice(i,1);
  });
  let newS="";
  switch(v.month) {
    case 3: newS="春"; break;
    case 6: newS="夏"; break;
    case 9: newS="秋"; break;
    case 12:newS="冬"; break;
  }
  if (newS) {
    v.villageTraits.push(newS);
    // 季節変更ダイアログを表示
    showSeasonChangeDialog(newS);
    v.log(`${newS}が訪れた`);
  }
}

// 季節変更ダイアログを表示する関数
function showSeasonChangeDialog(season) {
  const seasonData = {
    "春": {
      image: "../images/seasons/spring.png",
      message: "暖かな風が吹き、新しい命が芽吹く季節となりました。",
      accent: "#ffd6e7",
      tips: [
        "大きな補正は少ない安定した季節です。",
        "食料や資材を整え、夏以降に備えるのに向いています。"
      ]
    },
    "夏": {
      image: "../images/seasons/summer.png",
      message: "太陽が高く昇り、生命力溢れる季節となりました。",
      accent: "#ffe39a",
      tips: [
        "夏至祭では体力・メンタル・幸福が回復し、結婚判定があります。",
        "ランダムイベントの猛暑や冷夏には注意してください。"
      ]
    },
    "秋": {
      image: "../images/seasons/autumn.png",
      message: "実りの秋を迎え、収穫の季節となりました。",
      accent: "#ffd08a",
      tips: [
        "農作業と採集の生産量が1.5倍になります。",
        "冬に備えて食料と資材を厚めに蓄える好機です。"
      ]
    },
    "冬": {
      image: "../images/seasons/winter.png",
      message: "寒さが厳しくなり、静かな季節となりました。",
      accent: "#d5e8ff",
      tips: [
        "農作業の生産量が0.5倍、狩猟の生産量が1.2倍になります。",
        "月末に村人1人あたり資材10を消費します。資材0だと凍えが発生します。"
      ]
    }
  };
  const data = seasonData[season];
  if (!data) return;
  const imageUrl = new URL(data.image, import.meta.url).href;

  let overlay = document.createElement("div");
  overlay.id = "seasonChangeOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(9, 8, 7, 0.45);
    z-index: 1400;
  `;

  let dialog = document.createElement("div");
  dialog.id = "seasonChangeDialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    box-sizing: border-box;
    width: min(720px, 92vw);
    min-height: min(360px, 84vh);
    max-height: 84vh;
    overflow-y: auto;
    color: #fffaf0;
    border: 1px solid rgba(255, 255, 255, 0.42);
    border-radius: 8px;
    text-align: left;
    z-index: 1401;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.48);
    background-image:
      linear-gradient(90deg, rgba(10, 8, 6, 0.88), rgba(10, 8, 6, 0.62) 54%, rgba(10, 8, 6, 0.2)),
      url("${imageUrl}");
    background-size: cover;
    background-position: center;
  `;

  let content = document.createElement("div");
  content.style.cssText = `
    box-sizing: border-box;
    min-height: min(360px, 84vh);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 14px;
    padding: clamp(22px, 5vw, 42px);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.75);
  `;

  let seasonText = document.createElement("h2");
  seasonText.textContent = `${season}の訪れ`;
  seasonText.style.cssText = `
    margin: 0;
    color: ${data.accent};
    font-size: clamp(2rem, 7vw, 3.5rem);
    line-height: 1;
    letter-spacing: 0;
  `;

  let message = document.createElement("p");
  message.textContent = data.message;
  message.style.cssText = `
    max-width: 34rem;
    margin: 0;
    line-height: 1.7;
    font-size: clamp(1rem, 2.8vw, 1.16rem);
  `;

  let tipList = document.createElement("ul");
  tipList.style.cssText = `
    max-width: 36rem;
    margin: 0;
    padding: 11px 13px 11px 2rem;
    text-align: left;
    line-height: 1.55;
    color: #fffaf0;
    background: rgba(255, 248, 225, 0.13);
    border: 1px solid rgba(255, 255, 255, 0.28);
    border-radius: 6px;
    backdrop-filter: blur(2px);
  `;
  data.tips.forEach(tip => {
    const item = document.createElement("li");
    item.textContent = tip;
    tipList.appendChild(item);
  });

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;justify-content:flex-end;margin-top:4px;";

  let closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "閉じる";
  closeButton.style.cssText = `
    min-width: 88px;
    padding: 8px 16px;
    background: ${data.accent};
    border: 1px solid rgba(255, 255, 255, 0.55);
    color: #241d17;
    border-radius: 5px;
    font-weight: bold;
    cursor: pointer;
  `;
  const closeDialog = () => {
    overlay.remove();
    dialog.remove();
  };
  closeButton.onclick = closeDialog;
  overlay.onclick = closeDialog;

  buttons.appendChild(closeButton);
  content.appendChild(seasonText);
  content.appendChild(message);
  content.appendChild(tipList);
  content.appendChild(buttons);
  dialog.appendChild(content);
  document.body.appendChild(overlay);
  document.body.appendChild(dialog);

  // 5秒後に自動で閉じる
  setTimeout(() => {
    if (document.body.contains(dialog)) {
      closeDialog();
    }
  }, 5000);
}

// 追加で本ファイル内だけで使う randChoice 等
function randChoice(arr) {
  if (!arr||arr.length===0) return null;
  return arr[Math.floor(Math.random()*arr.length)];
}


// randFloat (幸福度自然減衰で使用)
function randFloat(min,max){ return Math.random()*(max-min)+min; }
