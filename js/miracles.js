// miracles.js

import { clampValue, round3, getPortraitPath } from "./util.js";
import { addRelationship, removeRelationship, checkHasRelationship, getRelationshipTargetName } from "./relationships.js";
import { updateUI } from "./ui.js";  // 実行後にUIを更新する
import { refreshJobTable } from "./createVillagers.js";

/**
 * 奇跡リスト
 */
export const MIRACLES = [
  {id:"12", name:"交換の奇跡(20)", cost:20, desc:"2人の肉体を交換"},
  {id:"13", name:"交換の奇跡・強(80)", cost:80, desc:"村外含む2人交換"},
  {id:"1",  name:"豊穣の奇跡(100)", cost:100, desc:"今月のみ収穫2倍(豊穣)"},
  {id:"2",  name:"マナの奇跡(40)",  cost:40,  desc:"食料+80"},
  {id:"3",  name:"クピドの奇跡(80)", cost:80, desc:"2人を強制結婚(条件無視)"},
  {id:"4",  name:"宴会の奇跡(人数×15)", cost:-1, desc:"全員体力/メンタル+30,幸福+20 (資金×人数分も要)"},
  {id:"5",  name:"狂宴の奇跡(人数×30)", cost:-2, desc:"全員体力/メンタル+100,幸福+50,倫理↓,好色+15"},
  {id:"6",  name:"癒しの奇跡(80)", cost:80, desc:"1人の負傷/疲労等回復,体力/メンタル+50"},
  {id:"7",  name:"戦神の奇跡(80)", cost:80, desc:"1人に火星の加護(3ヶ月)"},
  {id:"8",  name:"竈女神の奇跡(60)", cost:60, desc:"恋人を結婚100%(いなければ30返還)"},
  {id:"9",  name:"常春の奇跡(300)", cost:300,desc:"村特性→春に固定。次の季節まで継続"},
  {id:"10", name:"旅人の奇跡(60)", cost:60, desc:"ランダム来訪者(訪問者付与)"},
  {id:"11", name:"出立の奇跡(20)", cost:20, desc:"1人離脱→幸福度分の魔素獲得"},
  {id:"14", name:"ミダスの奇跡(100)", cost:100, desc:"1ヶ月間、食料を得る代わりに資金を得る"}
];

/**
 * 奇跡モーダルを開く
 */
export function openMiracleModal(village) {
  if (village.gameOver) {
    village.log("ゲームオーバー→奇跡不可");
    return;
  }
  document.getElementById("modalOverlay").style.display = "block";
  document.getElementById("miracleModal").style.display = "block";

  let sel = document.getElementById("miracleSelect");
  sel.innerHTML="";
  MIRACLES.forEach(m=>{
    let op=document.createElement("option");
    op.value=m.id;
    op.textContent=m.name;
    sel.appendChild(op);
  });
  sel.value="12"; // デフォルト
  onSelectMiracleChange(village);
}

/**
 * 奇跡モーダルを閉じる
 */
export function closeMiracleModal() {
  document.getElementById("modalOverlay").style.display="none";
  document.getElementById("miracleModal").style.display="none";
}

/**
 * 選択した奇跡に応じて詳細UIを変える
 */
export function onSelectMiracleChange(village) {
  let sel = document.getElementById("miracleSelect");
  let mid = sel.value;
  let info = MIRACLES.find(x=> x.id===mid);

  let div = document.getElementById("miracleOptions");
  div.innerHTML = `<p>${info.desc}</p>`;

  // 特定のIDは対象選択が必要
  if (["3","6","7","11","12","13"].includes(mid)) {
    if (mid==="3"||mid==="12"||mid==="13") {
      div.appendChild(createVillagerSelect("targetA", village));
      div.appendChild(createVillagerSelect("targetB", village));
    } else {
      div.appendChild(createVillagerSelect("targetA", village));
    }
  }
}

function createVillagerSelect(id, village) {
  let sel=document.createElement("select");
  sel.id=id;
  let op0=document.createElement("option");
  op0.value="";
  op0.textContent="(選択)";
  sel.appendChild(op0);

  // 村人を追加
  village.villagers.forEach(vv=>{
    let opp=document.createElement("option");
    opp.value=vv.name;
    opp.textContent=vv.name;
    sel.appendChild(opp);
  });

  // 訪問者を追加
  village.visitors.forEach(vv=>{
    let opp=document.createElement("option");
    opp.value=vv.name;
    opp.textContent=`${vv.name}(訪問者)`;
    sel.appendChild(opp);
  });

  // 襲撃者を追加
  village.raidEnemies.forEach(vv=>{
    let opp=document.createElement("option");
    opp.value=vv.name;
    opp.textContent=`${vv.name}(襲撃者)`;
    sel.appendChild(opp);
  });

  return sel;
}

/**
 * 奇跡実行
 */
export function performMiracle(village) {
  let sel=document.getElementById("miracleSelect");
  let mid=sel.value;
  let info=MIRACLES.find(x=>x.id===mid);
  if (!info) return;

  // コスト計算
  let cost = info.cost;
  let vc = village.villagers.length;
  if (cost===-1) {
    // 宴会(人数×15)
    cost = vc * 15;
    if (village.mana<cost || village.funds<cost) {
      village.log(`魔素or資金不足(必要:${cost})`);
      return;
    }
  } else if (cost===-2) {
    // 狂宴(人数×30)
    cost = vc * 30;
    if (village.mana<cost || village.funds<cost) {
      village.log(`魔素or資金不足(必要:${cost})`);
      return;
    }
  } else {
    if (village.mana<cost) {
      village.log(`魔素不足(必要:${cost}, 所持:${village.mana})`);
      return;
    }
  }

  let ta=document.getElementById("targetA");
  let tb=document.getElementById("targetB");
  let vA=null;
  let vB=null;
  if (ta && ta.value) {
    // 村人、訪問者、襲撃者から対象を検索
    vA = village.villagers.find(x=>x.name===ta.value) ||
         village.visitors.find(x=>x.name===ta.value) ||
         village.raidEnemies.find(x=>x.name===ta.value);
  }
  if (tb && tb.value) {
    // 村人、訪問者、襲撃者から対象を検索
    vB = village.villagers.find(x=>x.name===tb.value) ||
         village.visitors.find(x=>x.name===tb.value) ||
         village.raidEnemies.find(x=>x.name===tb.value);
  }

  // 実行
  switch(mid) {
    case "4": // 宴会
      village.mana-=cost;
      village.funds-=cost;
      village.villagers.forEach(p=>{
        p.hp=clampValue(p.hp+30,0,100);
        p.mp=clampValue(p.mp+30,0,100);
        p.happiness=clampValue(p.happiness+20,0,100);
      });
      village.log(`【宴会】全員体力/メンタル+30,幸福+20(費用:${cost})`);
      break;

    case "5": // 狂宴
      village.mana-=cost;
      village.funds-=cost;
      village.villagers.forEach(p=>{
        p.hp=clampValue(p.hp+100,0,100);
        p.mp=clampValue(p.mp+100,0,100);
        p.happiness=clampValue(p.happiness+50,0,100);
        // 狂乱特性を付与（まだ持っていない場合のみ）
        if (!p.mindTraits.includes("狂乱")) {
          p.mindTraits.push("狂乱");
          p.eth=Math.floor(p.eth*0.2);
          p.sexdr=clampValue(p.sexdr+15,0,100);
        }
      });
      village.log(`【狂宴】全員体力/メンタル+100,幸福+50,狂乱付与(倫理*0.2,好色+15)`);
      break;

    default:
      // 通常コスト (mana消費)
      village.mana-=cost;
      switch(mid) {
        case "1": // 豊穣
          village.villageTraits.push("豊穣");
          village.log("【豊穣の奇跡】収穫2倍1ヶ月付与");
          break;
        case "2": // マナの奇跡
          village.food=clampValue(village.food+80,0,99999);
          village.log("【マナの奇跡】食料+80");
          break;
        case "3": // クピド(2人強制結婚)
          if (!vA||!vB||vA===vB) {
            village.log("【クピド】2人を選択してください");
            village.mana+=cost; // 戻す
            return;
          }
          forceMarriage(vA,vB,village);
          break;
        case "6": // 癒し(1人回復)
          if (!vA) {
            village.log("【癒し】対象1人を選択");
            village.mana+=cost; 
            return;
          }
          healMiracle(vA,village);
          break;
        case "7": // 戦神(1人)
          if (!vA) {
            village.log("【戦神】対象1人を選択");
            village.mana+=cost;
            return;
          }
          warMiracle(vA,village);
          break;
        case "8": // 竈女神
          hearthMiracle(village);
          break;
        case "9": // 常春
          let rm=["夏","秋","冬","冷夏","飛蝗","厳冬","疫病流行"];
          village.villageTraits=village.villageTraits.filter(x=>!rm.includes(x));
          if (!village.villageTraits.includes("春")) {
            village.villageTraits.push("春");
          }
          village.log("【常春の奇跡】春に固定");
          break;
        case "10": // 旅人
          travelerMiracle(village);
          break;
        case "11": // 出立
          if (!vA) {
            village.log("【出立の奇跡】対象1人を選択");
            village.mana+=cost;
            return;
          }
          departureMiracle(vA,village);
          break;
        case "12": // 交換
          if (!vA||!vB||vA===vB) {
            village.log("【交換の奇跡】2人を選択");
            village.mana+=cost;
            return;
          }
          // 通常の交換は村人同士のみ
          if (!village.villagers.includes(vA) || !village.villagers.includes(vB)) {
            village.log("【交換の奇跡】村人以外は対象外です");
            village.mana+=cost;
            return;
          }
          doExchange(vA,vB,village,false);
          village.log(`【交換の奇跡】${vA.name}と${vB.name}が肉体交換`);
          
          // 交換専用モーダルを表示
          openExchangeModal(vA, vB);
          break;
        case "13": // 交換(強)
          if (!vA||!vB||vA===vB) {
            village.log("【交換の奇跡・強】2人を選択");
            village.mana+=cost;
            return;
          }
          doExchange(vA,vB,village,false);
          village.log(`【交換の奇跡・強】${vA.name}と${vB.name}が肉体交換`);
          
          // 交換専用モーダルを表示
          openExchangeModal(vA, vB);
          break;
        case "14": // ミダスの奇跡
          village.mana -= cost;
          if (!village.villageTraits.includes("ミダス")) {
            village.villageTraits.push("ミダス");
          }
          village.log("【ミダスの奇跡】1ヶ月間、食料を得る行動が資金を得る");
          break;
      }
      break;
  }

  updateUI(village);
  closeMiracleModal();
}

/** クピド: 強制結婚 */
function forceMarriage(a,b,v) {
  removeRelationship(a,`恋人:${b.name}`);
  removeRelationship(b,`恋人:${a.name}`);
  addRelationship(a,"既婚");
  addRelationship(b,"既婚");
  a.happiness=clampValue(a.happiness+50,0,100);
  b.happiness=clampValue(b.happiness+50,0,100);

  if (a.spiritSex==="男") addRelationship(a,`夫:${b.name}`);
  else if (a.spiritSex==="女") addRelationship(a,`妻:${b.name}`);
  if (b.spiritSex==="男") addRelationship(b,`夫:${a.name}`);
  else if (b.spiritSex==="女") addRelationship(b,`妻:${a.name}`);

  v.log(`【クピドの奇跡】${a.name}と${b.name}強制結婚`);
}

/** 癒し: 負傷など回復 */
function healMiracle(p,v) {
  p.hp=clampValue(p.hp+50,0,100);
  p.mp=clampValue(p.mp+50,0,100);

  let arr=["負傷","疲労","過労","飢餓","心労","抑鬱"];
  let recoveredTraits = [];

  // 身体特性からの状態異常回復
  arr.forEach(trait => {
    if (p.bodyTraits.includes(trait)) {
      recoveredTraits.push(trait);
      p.bodyTraits = p.bodyTraits.filter(t => t !== trait);
      
      // ステータス回復
      switch(trait) {
        case "飢餓":
          p.str = round3(p.str / 0.5);  // 50%から回復
          p.vit = round3(p.vit / 0.5);
          p.dex = round3(p.dex / 0.5);
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
      }
    }
  });

  // 精神特性からの状態異常回復
  arr.forEach(trait => {
    if (p.mindTraits.includes(trait)) {
      recoveredTraits.push(trait);
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

  let recoveryMsg = recoveredTraits.length > 0 ? 
    `${recoveredTraits.join(",")}を回復,` : "";
  v.log(`【癒しの奇跡】${p.name}${recoveryMsg}体力/メンタル+50`);
}

/** 戦神(戦神の加護) */
function warMiracle(p, v) {
  // 戦神の奇跡の開始時に、アレス変数を初期化
  p.ares = 0;
  v.log(`【戦神の奇跡】${p.name}に火星の加護付与(筋力・耐久・勇気が1.6倍、知力・勤勉・倫理が0.2倍)3ヶ月継続`);
  p.bodyTraits.push("火星の加護");
  // 筋力・耐久・勇気は1.6倍に、知力・勤勉・倫理は0.2倍に変更し、round3で丸める
  p.str = round3(p.str * 1.6);
  p.vit = round3(p.vit * 1.6);
  p.cou = round3(p.cou * 1.6);
  p.int = round3(p.int * 0.2);
  p.eth = round3(p.eth * 0.2);
  p.ind = round3(p.ind * 0.2);
}

/** 竈女神(恋人を結婚100%) */
function hearthMiracle(v) {
  let c=v.villagers.filter(x=> x.spiritAge>=18 && checkHasRelationship(x,"恋人") && !checkHasRelationship(x,"既婚"));
  if (c.length===0) {
    v.log("【竈女神の奇跡】結婚すべき恋人なし→30魔素返還");
    v.mana=clampValue(v.mana+30,0,99999);
    return;
  }
  let done=[];
  c.forEach(a=>{
    if (!done.includes(a)) {
      let bName=getRelationshipTargetName(a,"恋人");
      if (bName) {
        let b=v.villagers.find(xx=>xx.name===bName);
        if (b && !done.includes(b) && !checkHasRelationship(a,"既婚") && !checkHasRelationship(b,"既婚")) {
          removeRelationship(a,`恋人:${b.name}`);
          removeRelationship(b,`恋人:${a.name}`);
          addRelationship(a,"既婚");
          addRelationship(b,"既婚");
          a.happiness=clampValue(a.happiness+50,0,100);
          b.happiness=clampValue(b.happiness+50,0,100);

          if (a.spiritSex==="男") addRelationship(a,`夫:${b.name}`);
          else if (a.spiritSex==="女") addRelationship(a,`妻:${b.name}`);
          if (b.spiritSex==="男") addRelationship(b,`夫:${a.name}`);
          else if (b.spiritSex==="女") addRelationship(b,`妻:${a.name}`);

          v.log(`【竈女神の奇跡】${a.name}と${b.name}結婚100%`);
          done.push(a,b);
        }
      }
    }
  });
}

/** 旅人の奇跡(1名来訪) */
import { createRandomVillager } from "./createVillagers.js";
function travelerMiracle(v) {
  let newV = createRandomVillager();
  v.log(`【旅人の奇跡】${newV.name}が来訪(訪問者)`);
  v.villageTraits.push("訪問者");
  // ★ここでは村に追加するか不明(訪問のみ?)
  // もし本当に村に加えるなら: v.villagers.push(newV); など
}

/** 出立の奇跡(対象を離脱→幸福度分魔素取得) */
function departureMiracle(p,v) {
  let bonus = p.happiness;
  v.mana=clampValue(v.mana+bonus,0,99999);
  v.log(`【出立の奇跡】${p.name}離脱,魔素+${bonus}`);
  let idx=v.villagers.indexOf(p);
  if (idx>=0) {
    v.villagers.splice(idx,1);
  }
}

/**
 * 肉体交換(雷/奇跡)
 */
export function doExchange(a, b, v, isLightning) {
  // 交換されるパラメータ（肉体に関連する要素）
  let exchangeParams = {
    // 基本情報
    bodySex: a.bodySex,
    bodyAge: a.bodyAge,
    bodyOwner: a.bodyOwner,
    race: a.race,  // 種族も交換
    portraitFile: a.portraitFile,  // 顔グラフィック情報を追加
    raiderPortrait: a.raiderPortrait, // 襲撃者用の顔グラフィック
    visitorPortrait: a.visitorPortrait, // 訪問者用の顔グラフィック

    // 肉体パラメータ
    hp: a.hp,
    str: a.str,
    vit: a.vit,
    dex: a.dex,
    mag: a.mag,
    chr: a.chr,

    // 肉体特性
    bodyTraits: [...a.bodyTraits]
  };

  // Aの肉体パラメータをBのものに
  a.bodySex = b.bodySex;
  a.bodyAge = b.bodyAge;
  a.bodyOwner = b.bodyOwner;
  a.race = b.race;
  a.portraitFile = b.portraitFile;  // 顔グラフィック情報を交換
  a.raiderPortrait = b.raiderPortrait; // 襲撃者用の顔グラフィック
  a.visitorPortrait = b.visitorPortrait; // 訪問者用の顔グラフィック
  a.hp = b.hp;
  a.str = b.str;
  a.vit = b.vit;
  a.dex = b.dex;
  a.mag = b.mag;
  a.chr = b.chr;
  a.bodyTraits = [...b.bodyTraits];

  // Bの肉体パラメータをAのものに（一時保存したもの）
  b.bodySex = exchangeParams.bodySex;
  b.bodyAge = exchangeParams.bodyAge;
  b.bodyOwner = exchangeParams.bodyOwner;
  b.race = exchangeParams.race;
  b.portraitFile = exchangeParams.portraitFile;  // 顔グラフィック情報を交換
  b.raiderPortrait = exchangeParams.raiderPortrait; // 襲撃者用の顔グラフィック
  b.visitorPortrait = exchangeParams.visitorPortrait; // 訪問者用の顔グラフィック
  b.hp = exchangeParams.hp;
  b.str = exchangeParams.str;
  b.vit = exchangeParams.vit;
  b.dex = exchangeParams.dex;
  b.mag = exchangeParams.mag;
  b.chr = exchangeParams.chr;
  b.bodyTraits = [...exchangeParams.bodyTraits];

  // 交換後に両者の仕事テーブルを更新
  refreshJobTable(a);
  refreshJobTable(b);
  
  // 現在の仕事と行動が新しいテーブルに含まれていない場合は「なし」に
  if (!a.jobTable.includes(a.job)) a.job = "なし";
  if (!a.actionTable.includes(a.action)) a.action = a.job;
  if (!b.jobTable.includes(b.job)) b.job = "なし";
  if (!b.actionTable.includes(b.action)) b.action = b.job;

  // 交換のログ出力（雷の場合は簡略化）
  if (!isLightning) {
    v.log(`【交換の奇跡】${a.name}と${b.name}の肉体を交換しました`);
  }
}

/**
 * 交換の奇跡モーダルを開く
 */
function openExchangeModal(personA, personB) {
  const overlay = document.getElementById("exchangeOverlay");
  const modal = document.getElementById("exchangeModal");
  const portraitA = document.getElementById("exchangePortraitA");
  const portraitB = document.getElementById("exchangePortraitB");
  const textA = document.getElementById("exchangeTextA");
  const textB = document.getElementById("exchangeTextB");
  
  if (!overlay || !modal || !portraitA || !portraitB || !textA || !textB) return;
  
  // 顔グラフィックを設定（エラーハンドリング付き）
  try {
    // 共通関数を使用して顔グラフィックのパスを取得
    // 注意: 交換後の状態を表示するため、personAの体はpersonBの顔グラフィックを表示
    portraitA.src = getPortraitPath(personA);
    portraitA.onerror = () => {
      console.error(`Portrait image not found: ${portraitA.src}`);
      portraitA.src = 'images/portraits/DEFAULT.png';
    };
    
    // 同様に、personBの体はpersonAの顔グラフィックを表示
    portraitB.src = getPortraitPath(personB);
    portraitB.onerror = () => {
      console.error(`Portrait image not found: ${portraitB.src}`);
      portraitB.src = 'images/portraits/DEFAULT.png';
    };
  } catch (error) {
    console.error('Error loading portraits:', error);
    portraitA.src = 'images/portraits/DEFAULT.png';
    portraitB.src = 'images/portraits/DEFAULT.png';
  }
  
  // 口調タイプの決定を修正
  const getSpeechType = (person) => {
    // 襲撃者の場合は襲撃者タイプを使用
    if (person.mindTraits && person.mindTraits.includes("襲撃者")) {
      // 名前から襲撃者タイプを抽出
      const raiderTypes = ["野盗", "ゴブリン", "狼", "キュクロプス", "ハーピー"];
      for (const type of raiderTypes) {
        if (person.name.includes(type)) {
          return type;
        }
      }
    }
    // 通常のキャラクターは既存の口調を使用
    return person.speechType || (person.bodySex === "男" ? "普通Ｍ" : "普通Ｆ");
  };

  const speechTypeA = getSpeechType(personA);
  const speechTypeB = getSpeechType(personB);
  
  // 入れ替わり時のセリフをランダムに選択
  const getRandomLine = (patterns, type) => {
    const lines = patterns[type] || patterns[personA.bodySex === "男" ? "普通Ｍ" : "普通Ｆ"];
    return lines[Math.floor(Math.random() * lines.length)];
  };
  
  // 会話テキストを設定
  textA.innerHTML = `
    <p><strong>${personA.name}:</strong> ${getRandomLine(EXCHANGE_SPEECH_PATTERNS, speechTypeA)}</p>
    <p><small>体の持ち主: ${personB.name}</small></p>
  `;
  
  textB.innerHTML = `
    <p><strong>${personB.name}:</strong> ${getRandomLine(EXCHANGE_SPEECH_PATTERNS, speechTypeB)}</p>
    <p><small>体の持ち主: ${personA.name}</small></p>
  `;
  
  overlay.style.display = "block";
  modal.style.display = "block";
}

/**
 * 交換の奇跡モーダルを閉じる
 */
export function closeExchangeModal() {
  const overlay = document.getElementById("exchangeOverlay");
  const modal = document.getElementById("exchangeModal");
  
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
}

/**
 * 交換の奇跡実行時のセリフパターン
 */
const EXCHANGE_SPEECH_PATTERNS = {
  "普通Ｍ": [
    "なんだこれは...これが俺の体なのか？",
    "体が入れ替わってしまった！どうしよう...",
    "まさか本当に交換されるとは...どうすれば..."
  ],
  "丁寧Ｍ": [
    "これは...私の体が変わってしまったようです。大変な事態ですね。",
    "体が入れ替わるとは...心の準備ができておりませんでした。",
    "これはいったいどうしたものでしょうか。戸惑いを隠せません。"
  ],
  "強気Ｍ": [
    "おいおい、何が起きた？俺の体はどこだ！",
    "くそっ、本当に入れ替わるとはな！だが、これも経験だ！",
    "ふん、この体もなかなか悪くないぜ！すぐに慣れてやる！"
  ],
  "乱暴": [
    "ふざけんな！元に戻せ！こんな体は嫌だ！",
    "クソッ！何が起きやがった！この体はなんだ！",
    "冗談じゃねぇ！誰だよこんなことしたのは！"
  ],
  "お調子者": [
    "うわー！マジで入れ替わった！面白いっすね～",
    "これって夢じゃないっすよね？凄いっす！どうなるんすかね～",
    "新しい体、なかなか良さそうっすね！楽しませてもらいますよ～"
  ],
  "陰気": [
    "な...何が...起きたんだ...",
    "体が違う...一体どうすれば...",
    "これは...夢...ではないよな..."
  ],
  "クールＭ": [
    "ふむ、交換が成立したようだな。興味深い現象だ。",
    "面白いじゃないか。この体で何ができるか試してみよう。",
    "体の交換か。まあ、対処できないことではない。"
  ],
  
  "普通Ｆ": [
    "あら...これは私の体じゃありません！どうなってるの？",
    "体が入れ替わってしまったの？信じられないわ...",
    "これが交換の奇跡...想像以上のことが起きたわね..."
  ],
  "丁寧Ｆ": [
    "まあ...これは驚きです。体が入れ替わってしまいましたわ。",
    "どうしましょう、体が違うものになっています。慣れるには時間がかかりそうです。",
    "これは想定外の事態です。どのように対処すべきでしょうか..."
  ],
  "お嬢様": [
    "まあ！これはいったいどういうことかしら？私の体ではありませんわ！",
    "なんということでしょう...体が入れ替わるなんて...心の準備ができておりませんでしたわ。",
    "これは夢ではないのですね？現実に起きていることなのですわね？"
  ],
  "快活": [
    "わー！本当に入れ替わっちゃったんだね！すごーい！",
    "新しい体だー！どんな感じかな？ドキドキするね！",
    "こんなことが本当にあるのね..."
  ],
  "内気": [
    "あ...あの...体が...違います...ど、どうしよう...",
    "こ、これは...私の体...ではないです...怖いです...",
    "だ、誰か...助けて...ください...元に...戻りたいです..."
  ],
  "強気Ｆ": [
    "何これ？本気で入れ替わったの？面白いじゃない！",
    "ふん、この程度で動揺するわけないわ！すぐに慣れてやるわよ！",
    "予想外ね...何とかこの体を使いこなさないと"
  ],
  "蓮っ葉": [
    "ちょっと！マジで入れ替わっちゃったじゃん！どうなってんの？",
    "うわ～、これが交換の奇跡？冗談でしょ～？",
    "新しい体かぁ～。まあ、悪くないかもね～。楽しんじゃおっかな～"
  ],
  "おっとり": [
    "あら...これは驚きですね。体が入れ替わってしまいましたわ。",
    "どうしましょう...穏やかに受け入れるべきでしょうか...戸惑いますね。",
    "思いがけない出来事ですが...きっと意味があるのでしょうね..."
  ],
  "クールＦ": [
    "予想通りの結果ね。冷静に対処するだけよ。",
    "交換が成立したわ。この状況を分析する必要があるわね。",
    "興味深い現象ね。この体の特性を把握しておくべきね。"
  ],
  "ぶりっこ": [
    "きゃー！体が変わっちゃったよ～！どうしよう～？",
    "これってホントに交換されちゃったの～？信じられないよ～♪",
    "新しい体だよ～。どんな感じかな～？ドキドキするね～♪"
  ],
  "中性的": [
    "これは...体が入れ替わったみたいだね。不思議な感覚だ。",
    "まさか本当に交換されるとは...どう対処すべきか考えないと。",
    "新しい体、慣れるには時間がかかりそうだね。"
  ],
  "ギャル風": [
    "マジ!?体入れ替わってるじゃん！ヤバくない？",
    "うわー！これって入れ替わり！？信じらんない～！",
    "新しい体ゲットしちゃった！どんな感じか試してみよっと！"
  ],
  // 襲撃者用のパターンを追加
  "野盗": [
    "くそっ、なんだこの体は！戦いづらいじゃねえか！",
    "おい、どうなってやがる！元の体に戻せ！",
    "ちっ、こんな体でも襲撃は続けるぜ！"
  ],
  "ゴブリン": [
    "ゴブゴブ！体が変わったのだ！",
    "キヒヒ！面白い体になったのだ！",
    "この体でも人間をやっつけるのだ！"
  ],
  "狼": [
    "グルル...（体が変わってしまった...）",
    "ウゥゥ...（この体では狩りがしづらい...）",
    "ガウッ！（それでも獲物は逃がさない！）"
  ],
  "キュクロプス": [
    "なんだと！？この小さな体では力が出せん！",
    "我が巨体はどこへ行った！返せ！",
    "この体でも全てを踏み潰してやる！"
  ],
  "ハーピー": [
    "あら、この体では空が飛べないじゃない！",
    "私の美しい羽はどこへ行ったの！？",
    "この姿でも村は襲ってあげるわ！"
  ]
};
