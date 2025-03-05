// events.js

import { randInt, clampValue, round3 } from "./util.js";
import { doLoverCheck, doMarriageCheck } from "./relationships.js";
import { createRandomVillager, createRandomVisitor } from "./createVillagers.js";
import { startRaidEvent } from "./raid.js";
import { theVillage } from "./main.js";

/**
 * 固定イベント(前半) - 新年祭など
 */
export function doFixedEventPre(village) {
  if (village.month===1 && !village.hasDonePreEvent) {
    newYearFestival(village);
    village.hasDonePreEvent = true;
  }
}

/**
 * 固定イベント(後半) - 復活祭,夏至祭,収穫祭,星霜祭など
 */
export function doFixedEventPost(village) {
  if (!village.hasDonePostEvent) {
    switch(village.month) {
      case 3:
        resurrectionFestival(village);
        village.hasDonePostEvent=true;
        break;
      case 6:
        summerSolsticeFestival(village);
        village.hasDonePostEvent=true;
        break;
      case 10:
        harvestFestival(village);
        village.hasDonePostEvent=true;
        break;
      case 12:
        starsFestival(village);
        village.hasDonePostEvent=true;
        break;
    }
  }
}

// -------------------------
// 各祭り
// -------------------------
function newYearFestival(v) {
  v.log("【新年祭】体力+20,メンタル+20,幸福+20-30 全員");
  v.villagers.forEach(p=>{
    p.hp=clampValue(p.hp+20,0,100);
    p.mp=clampValue(p.mp+20,0,100);
    let inc=randInt(20,30);
    p.happiness=clampValue(p.happiness+inc,0,100);
  });
}

function resurrectionFestival(v) {
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
  v.log("【収穫祭】全員体力+40,メンタル+20");
  v.villagers.forEach(p=>{
    p.hp=clampValue(p.hp+40,0,100);
    p.mp=clampValue(p.mp+20,0,100);
  });
}

function starsFestival(v) {
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
  doRandomEventMain(village, "前");
}
export function doRandomEventPost(village) {
  doRandomEventMain(village, "後");
}

function doRandomEventMain(v, phase) {
  let r=randInt(1,100);
  if (r<=1) {
    doMythicEvent(v);
  } else if (r<=25) {
    doGoodEvent(v);
  } else if (r<=40) {
    doBadEvent(v);
  } else {
    v.log(`[${phase}イベント] 何も起こらず`);
  }
}

// --- ミシック(1%)
function doMythicEvent(v) {
  let cands=[];
  v.villagers.forEach(p=>{
    if (p.bodySex==="女" && p.bodyAge>=16 && p.bodyAge<=25 && p.sexdr<=5) {
      cands.push({type:"狩猟神", vill:p});
    }
    if (p.bodySex==="女" && p.bodyAge>=16 && p.bodyAge<=25 && p.chr>=25) {
      cands.push({type:"太陽神", vill:p});
    }
    if (p.bodySex==="女" && p.bodyAge>=16 && p.bodyAge<=28 && p.cou>=20 && p.int>=20) {
      cands.push({type:"戦女神", vill:p});
    }
    if (p.bodySex==="女" && p.bodyAge>=16 && p.bodyAge<=28 && p.ind>=20 && p.eth>=20) {
      cands.push({type:"地母神", vill:p});
    }
  });
  if (cands.length===0) {
    v.log("ミシックイベ:該当者なし");
    return;
  }
  let c = randChoice(cands);
  let p = c.vill;
  switch(c.type) {
    case "狩猟神":
      p.bodyTraits.push("月の巫女");
      p.dex+=10; p.chr+=10;
      v.log(`${p.name}は狩女神の祝福を受けた！(器用+10,魅力+10)`);
      break;
    case "太陽神":
      p.bodyTraits.push("太陽の巫女");
      p.str+=15; p.chr+=5;
      v.log(`${p.name}は太陽神の寵愛を受けた！(筋力+15,魅力+5)`);
      break;
    case "戦女神":
      p.bodyTraits.push("梟の巫女");
      p.mag+=10; p.chr+=10;
      v.log(`${p.name}は戦女神の啓示を受けた！(魔力+10,魅力+10)`);
      break;
    case "地母神":
      p.bodyTraits.push("大地の巫女");
      p.vit+=10; p.chr+=10;
      v.log(`${p.name}は地母神の慈愛を受けた！(耐久+10,魅力+10)`);
      break;
  }
}

// --- グッド(24%)
function doGoodEvent(v) {
  let pool=["cat","gold","strangeRain","fireworks","menFriendship","lover"];
  let ev=randChoice(pool);
  switch(ev) {
    case "cat": {
      if (v.villagers.length>0) {
        let t=randChoice(v.villagers);
        let inc=randInt(20,30);
        t.happiness=clampValue(t.happiness+inc,0,100);
        v.log(`子猫イベント:${t.name}幸福+${inc}`);
      }
      break;
    }
    case "gold": {
      let amt=randInt(50,100);
      v.funds=clampValue(v.funds+amt,0,99999);
      v.log(`金貨発見:資金+${amt}`);
      break;
    }
    case "strangeRain": {
      let amt=randInt(10,60);
      v.food=clampValue(v.food+amt,0,99999);
      v.log(`空から魚が降り注いだ:食料+${amt}`);
      break;
    }
    case "fireworks": {
      let inc=randInt(5,10);
      v.villagers.forEach(p=>{
        p.happiness=clampValue(p.happiness+inc,0,100);
      });
      v.log(`花火師来訪:村全体幸福+${inc}`);
      break;
    }
    case "menFriendship": {
      let men=v.villagers.filter(x=> x.spiritSex==="男" && x.bodyAge>=16);
      if (men.length>=2) {
        let m1=randChoice(men);
        let m2=randChoice(men.filter(x=>x!==m1));
        let incc=randInt(10,15);
        m1.happiness=clampValue(m1.happiness+incc,0,100);
        m2.happiness=clampValue(m2.happiness+incc,0,100);
        addRelationship(m1,`親友:${m2.name}`);
        addRelationship(m2,`親友:${m1.name}`);
        v.log(`男の友情:${m1.name}と${m2.name}は酒を酌み交わし友情を深めた。幸福+${incc}`);
      } else {
        v.log("男の友情:該当者(男2名以上)いない");
      }
      break;
    }
    case "lover": {
      doLoverCheck(v);
      break;
    }
  }
}

// --- バッド(15%)
function doBadEvent(v) {
  let pool=["storm","downpour","heat","fire","thief","rats","lightning1","lightning2","snow"];
  let ev=randChoice(pool);
  switch(ev) {
    case "storm": {
      let loss=Math.floor(v.food*0.1);
      v.food=clampValue(v.food-loss,0,99999);
      v.log(`春の嵐:食料-${loss}`);
      break;
    }
    case "downpour": {
      let loss=Math.floor(v.food*0.1);
      v.food=clampValue(v.food-loss,0,99999);
      v.log(`豪雨:食料-${loss}`);
      break;
    }
    case "heat": {
      v.villagers.forEach(p=>{
        p.hp=clampValue(p.hp-10,0,100);
      });
      v.log("猛暑:全員体力-10");
      break;
    }
    case "fire": {
      let loss=Math.floor(v.materials*0.1);
      v.materials=clampValue(v.materials-loss,0,99999);
      v.log(`ボヤ:資材-${loss}`);
      break;
    }
    case "thief": {
      let loss=Math.floor(v.funds*0.1);
      v.funds=clampValue(v.funds-loss,0,99999);
      v.security=clampValue(v.security-5,0,100);
      v.log(`窃盗団:資金-${loss},治安-5`);
      break;
    }
    case "rats": {
      let loss=Math.floor(v.food*0.3);
      v.food=clampValue(v.food-loss,0,99999);
      v.log(`ネズミ大発生:食料-${loss}`);
      break;
    }
    case "lightning1": {
      if (v.villagers.length>0) {
        let t=randChoice(v.villagers);
        t.hp=clampValue(t.hp-50,0,100);
        t.bodyTraits.push("負傷");
        v.log(`落雷1:${t.name}体力-50,負傷`);
      }
      break;
    }
    case "lightning2": {
      if (v.villagers.length>=2) {
        let a=randChoice(v.villagers);
        let b=randChoice(v.villagers.filter(x=>x!==a));
        doExchange(a,b,v,true);
        v.log(`落雷2:${a.name}と${b.name}の肉体交換`);
      }
      break;
    }
    case "snow": {
      v.villagers.forEach(p=>{
        p.hp=clampValue(p.hp-5,0,100);
        p.mp=clampValue(p.mp-5,0,100);
      });
      v.log("大雪:全員体力-5,メンタル-5");
      break;
    }
  }
}

// -------------------------
// 月末処理
// -------------------------
export function endOfMonthProcess(v) {
  v.log("【月末処理】");



  let totalF=0;
  let totalMat=0;
  let isWinter = v.villageTraits.includes("冬");

  v.villagers.forEach(p=>{
    let cost=10;
    if (p.mindTraits.includes("大食い")) cost=12;
    if (p.mindTraits.includes("小食"))  cost=8;
    totalF+=cost;

    if (isWinter) {
      totalMat+=10;
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

  // 状態異常の解除処理
  v.villagers.forEach(p => {
    // 身体特性からの状態異常解除
    let bodyTraitsToRemove = ["飢餓", "凍え", "疲労", "過労", "病気", "産褥"];
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
 *  - jobTable再構築
 *  - 襲撃判定
 */
export function doMonthStartProcess(v) {
  v.log("【月初処理】");



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

  // 50%の確率で訪問者を生成
  if (Math.random() < 0.5) {
    let visitor = createRandomVisitor();
    v.visitors.push(visitor);
    v.log(`訪問者 ${visitor.name} が村を訪れました`);
  }




  // 既に"襲撃中"でなければ、20%で襲撃開始
  if (!v.villageTraits.includes("襲撃中")) {
    if (Math.random()<0.2) {
      startRaidEvent(v);
    }
  }

  // 全村人の行動テーブルを再構築
  v.villagers.forEach(p=>{
    let currentJob = p.job;     // 現在のjobを保存
    let currentAction = p.action; // 現在のactionを保存
    
    // 一旦空にする
    p.actionTable = [];
    p.jobTable = [];  // jobTableも初期化
    
    // ②状態異常特性による行動制限を優先チェック
    if (p.bodyTraits.includes("危篤")) {
      p.actionTable = ["臨終"];
      p.jobTable = ["なし"];
      p.job = "なし";
      p.action = "臨終";
      v.log(`${p.name}は危篤状態のため、行動を「臨終」に設定しました`);
      return;
    } else if (
      p.bodyTraits.includes("病気") || 
      p.bodyTraits.includes("負傷") || 
      p.bodyTraits.includes("過労") ||
      p.bodyTraits.includes("産褥") ||
      p.mindTraits.includes("抑鬱")
    ) {
      p.actionTable = ["療養"];
      p.action = "療養";
      let abnormalities = [];
      if (p.bodyTraits.includes("病気")) abnormalities.push("病気");
      if (p.bodyTraits.includes("負傷")) abnormalities.push("負傷");
      if (p.bodyTraits.includes("過労")) abnormalities.push("過労");
      if (p.bodyTraits.includes("産褥")) abnormalities.push("産褥");
      if (p.mindTraits.includes("抑鬱")) abnormalities.push("抑鬱");
      let selected = randChoice(abnormalities);
      v.log(`${p.name}は${selected}のため、行動を「療養」に設定しました`);
      return;
    }
    
    // 通常の行動テーブル構築
    let sa = p.spiritAge;
    if (sa <= 9) {
      p.jobTable = ["なし"];
      p.actionTable = ["なし"];
    } else if (sa <= 15) {
      p.jobTable = ["学業", "鍛錬", "なし"];
      p.actionTable = ["学業", "鍛錬", "休養", "余暇"];
    } else {
      // 基本の仕事テーブル（共通）
      let commonJobs = [
        "なし",
        "農作業", "狩猟", "漁",
        "伐採",
        "採集", "内職", "行商",
        "研究", "警備", "看護"
      ];

      // 性別に応じた仕事テーブル
      if (p.bodySex === "男") {
        p.jobTable = [
          ...commonJobs,
          "詩人", "神官"
        ];
      } else {
        p.jobTable = [
          ...commonJobs,
          "踊り子", "シスター"
        ];
      }

      // 性別に応じた行動テーブル
      if (p.bodySex === "男") {
        p.actionTable = [
          "休養", "余暇",
          ...p.jobTable
        ];
      } else {
        p.actionTable = [
          "休養", "余暇",
          ...p.jobTable
        ];
      }
    }

    // 襲撃関連の行動追加（状態異常がない場合のみ）
    if (v.villageTraits.includes("襲撃中")) {
      p.actionTable.push("迎撃", "罠作成");
    }

    // jobTableに現在のjobが含まれている場合は維持
    if (p.jobTable.includes(currentJob)) {
      p.job = currentJob;
    }

    // 現在の行動と仕事が一致している場合は維持
    if (currentAction === currentJob) {
      p.action = currentAction;
    } else {
      // 現在の行動と仕事が一致していない場合は仕事と同じにする
      p.action = p.job;
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
  let messages = {
    "春": "暖かな風が吹き、新しい命が芽吹く季節となりました。",
    "夏": "太陽が高く昇り、生命力溢れる季節となりました。",
    "秋": "実りの秋を迎え、収穫の季節となりました。",
    "冬": "寒さが厳しくなり、静かな季節となりました。"
  };

  let dialog = document.createElement("div");
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 2em;
    border-radius: 10px;
    text-align: center;
    z-index: 1000;
    min-width: 300px;
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
  `;

  let seasonText = document.createElement("h2");
  seasonText.textContent = `${season}の訪れ`;
  seasonText.style.cssText = `
    margin: 0 0 1em 0;
    color: #FFD700;
    font-size: 1.5em;
  `;

  let message = document.createElement("p");
  message.textContent = messages[season];
  message.style.cssText = `
    margin: 0 0 1.5em 0;
    line-height: 1.5;
  `;

  let closeButton = document.createElement("button");
  closeButton.textContent = "閉じる";
  closeButton.style.cssText = `
    padding: 0.5em 2em;
    background: #4a4a4a;
    border: 1px solid #666;
    color: white;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.3s;
  `;
  closeButton.onmouseover = () => closeButton.style.background = "#666";
  closeButton.onmouseout = () => closeButton.style.background = "#4a4a4a";
  closeButton.onclick = () => dialog.remove();

  dialog.appendChild(seasonText);
  dialog.appendChild(message);
  dialog.appendChild(closeButton);
  document.body.appendChild(dialog);

  // 5秒後に自動で閉じる
  setTimeout(() => {
    if (document.body.contains(dialog)) {
      dialog.remove();
    }
  }, 5000);
}

// 追加で本ファイル内だけで使う randChoice 等
function randChoice(arr) {
  if (!arr||arr.length===0) return null;
  return arr[Math.floor(Math.random()*arr.length)];
}

// refreshJobTable が events.js 内で必要になったのでimport
import { refreshJobTable } from "./createVillagers.js";
// doExchange が lightning2 で必要
import { doExchange } from "./raid.js";
// randFloat (幸福度自然減衰で使用)
function randFloat(min,max){ return Math.random()*(max-min)+min; }

function finalizeRaid(isSuccess, reason, village) {
  village.log(`【襲撃結果】${isSuccess?"防衛成功":"防衛失敗"} : ${reason}`);
  let rlog=document.getElementById("raidLogArea");
  rlog.innerHTML+=`<br>→ 襲撃結果: ${isSuccess?"防衛成功":"失敗"} (${reason})<br>モーダルを閉じます...`;
  alert(`襲撃結果: ${isSuccess?"防衛成功":"失敗"} (${reason})`);
  endRaidProcess(isSuccess, false, village);
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
    // 確認ダイアログを表示
    if (confirm("迎撃および罠作成の村人が一人もいません。このまま進めると襲撃は自動的に失敗します。続けますか？")) {
      rlog.innerHTML+=`<br>迎撃する者がいません！ → 自動的に襲撃成功(敵側)。`;
      village.raidActionQueue=[ {type:"AUTO_FAIL"} ];
      village.currentActionIndex=0;
    } else {
      // キャンセルした場合はモーダルを閉じる
      closeRaidModal();
      return;
    }
  } else {
    village.raidTurnCount=1;
    createTrapActionQueue(village);
  }
}
