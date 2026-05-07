// miracles.js

import { clampValue, round3, getPortraitPath } from "./util.js";
import { addRelationship, removeRelationship, checkHasRelationship, getRelationshipTargetName, clearRelationshipsForDepartedVillager, addSpouseRelationships } from "./relationships.js";
import { updateUI } from "./ui.js";  // 実行後にUIを更新する
import { doExchange } from "./exchange.js";
import { createRandomVisitor, determineSpeechType, refreshJobTable } from "./createVillagers.js";
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
      const selectOptions = mid === "12" ? { normalExchangeOnly: true } : (mid === "3" ? { villagersOnly: true } : {});
      div.appendChild(createVillagerSelect("targetA", village, selectOptions));
      div.appendChild(createVillagerSelect("targetB", village, selectOptions));
    } else {
      div.appendChild(createVillagerSelect("targetA", village, { villagersOnly: true }));
    }
  }
}

function createVillagerSelect(id, village, options = {}) {
  let sel=document.createElement("select");
  sel.id=id;
  let op0=document.createElement("option");
  op0.value="";
  op0.textContent="(選択)";
  sel.appendChild(op0);

  // 村人を追加
  village.villagers
    .filter(vv => !options.normalExchangeOnly || isNormalExchangeCandidate(vv, village))
    .forEach(vv=>{
    let opp=document.createElement("option");
    opp.value=vv.name;
    opp.textContent=vv.name;
    sel.appendChild(opp);
  });

  if (options.normalExchangeOnly || options.villagersOnly) {
    return sel;
  }

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

function isNormalExchangeCandidate(person, village) {
  return village.villagers.includes(person);
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
      showMiracleResultModal(village, "宴会の奇跡", "村中に賑やかな宴が開かれました。", village.villagers);
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
      showMiracleResultModal(village, "狂宴の奇跡", "理性を揺らす熱気が村を満たしました。", village.villagers);
      break;

    default:
      // 通常コスト (mana消費)
      village.mana-=cost;
      switch(mid) {
        case "1": // 豊穣
          village.villageTraits.push("豊穣");
          village.log("【豊穣の奇跡】収穫2倍1ヶ月付与");
          showMiracleResultModal(village, "豊穣の奇跡", "畑と森に豊かな気配が満ちました。", village.villagers);
          break;
        case "2": // マナの奇跡
          village.food=clampValue(village.food+80,0,99999);
          village.log("【マナの奇跡】食料+80");
          showMiracleResultModal(village, "マナの奇跡", "食料庫に恵みが満ちました。", village.villagers);
          break;
        case "3": // クピド(2人強制結婚)
          if (!vA||!vB||vA===vB) {
            village.log("【クピド】2人を選択してください");
            village.mana+=cost; // 戻す
            return;
          }
          if (!village.villagers.includes(vA) || !village.villagers.includes(vB)) {
            village.log("【クピド】村人以外は対象外です");
            village.mana+=cost;
            return;
          }
          forceMarriage(vA,vB,village);
          break;
        case "6": // 癒し(1人回復)
          if (!vA || !village.villagers.includes(vA)) {
            village.log("【癒し】対象1人を選択");
            village.mana+=cost; 
            return;
          }
          healMiracle(vA,village);
          break;
        case "7": // 戦神(1人)
          if (!vA || !village.villagers.includes(vA)) {
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
          showMiracleResultModal(village, "常春の奇跡", "村に穏やかな春の気配が定着しました。", village.villagers);
          break;
        case "10": // 旅人
          travelerMiracle(village);
          break;
        case "11": // 出立
          if (!vA || !village.villagers.includes(vA)) {
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
          if (!isNormalExchangeCandidate(vA, village) || !isNormalExchangeCandidate(vB, village)) {
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
          if (!village.villageTraits.includes("ミダス")) {
            village.villageTraits.push("ミダス");
          }
          village.log("【ミダスの奇跡】1ヶ月間、食料を得る行動が資金を得る");
          showMiracleResultModal(village, "ミダスの奇跡", "収穫の価値が黄金へと傾きました。", village.villagers);
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

  addSpouseRelationships(a, b);

  v.log(`【クピドの奇跡】${a.name}と${b.name}強制結婚`);
  showMarriageMiracleModal(v, "クピドの奇跡", [[a, b]]);
}

/** 癒し: 負傷など回復 */
function healMiracle(p,v) {
  p.hp=clampValue(p.hp+50,0,100);
  p.mp=clampValue(p.mp+50,0,100);

  let arr=["負傷","疲労","過労","飢餓","産褥","心労","抑鬱"];
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
        case "産褥":
          p.str = round3(p.str / 0.5);
          p.vit = round3(p.vit / 0.5);
          p.postpartumMonths = 0;
          refreshJobTable(p, v);
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
  showMiracleResultModal(v, "癒しの奇跡", `${p.name}の傷と疲れが癒されました。`, [p]);
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
  showMiracleResultModal(v, "戦神の奇跡", `${p.name}に戦神の加護が宿りました。`, [p]);
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

          addSpouseRelationships(a, b);

          v.log(`【竈女神の奇跡】${a.name}と${b.name}結婚100%`);
          done.push(a,b);
        }
      }
    }
  });
  if (done.length > 0) {
    const pairs = [];
    for (let i = 0; i < done.length; i += 2) {
      pairs.push([done[i], done[i + 1]]);
    }
    showMarriageMiracleModal(v, "竈女神の奇跡", pairs);
  }
}

/** 旅人の奇跡(1名来訪) */
function travelerMiracle(v) {
  let newV = createRandomVisitor();
  v.visitors.push(newV);
  v.log(`【旅人の奇跡】${newV.name}が来訪(訪問者)`);
  showMiracleResultModal(v, "旅人の奇跡", `${newV.name}が村を訪れました。`, [newV]);
}

/** 出立の奇跡(対象を離脱→幸福度分魔素取得) */
function departureMiracle(p,v) {
  let bonus = p.happiness;
  v.mana=clampValue(v.mana+bonus,0,99999);
  v.log(`【出立の奇跡】${p.name}離脱,魔素+${bonus}`);
  let idx=v.villagers.indexOf(p);
  if (idx>=0) {
    clearRelationshipsForDepartedVillager(v, p);
    v.villagers.splice(idx,1);
  }
  showMiracleResultModal(v, "出立の奇跡", `${p.name}は村を去りました。`, [p]);
}

function getChildlikeMiracleLine(person) {
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  if (mindTraits.includes("無垢")) return randFrom(["あうー。", "んま。", "ばぶ。", "すやすや……"]);
  if (mindTraits.includes("萌芽")) return randFrom(["わあ……きらきらしてる。", "これ、なあに？", "えへへ、ふしぎだね。"]);
  return null;
}

function getGenericMiracleLine(person, miracleName) {
  const childLine = getChildlikeMiracleLine(person);
  if (childLine) return childLine;
  if (miracleName === "出立の奇跡") return getDepartureMiracleLine(person);
  const type = person.speechType || determineSpeechType(person);
  const lines = {
    "普通Ｍ": [`${miracleName}か……本当に不思議な力だな。`, "今の光、見えたか？"],
    "普通Ｆ": [`${miracleName}ですね。不思議で、少し温かい感じがします。`, "これが奇跡の力なんですね。"],
    "強気Ｍ": ["すごい力だな。これならやれる。", "神の力だろうが、使えるものは使うさ。"],
    "強気Ｆ": ["悪くないわね。これで前に進める。", "奇跡に頼った分、結果を出すわよ。"],
    "内気": ["す、すごいです……少し怖いくらい。", "今のが奇跡……なんですね。"],
    "陰気": ["……眩しいな。", "……奇跡なんてものも、あるんだな。"],
    "お調子者": ["うわー、すごいっすね！奇跡って感じっす！", "これは効いてるっすよ、たぶん！"],
    "快活": ["すごいね！なんだか元気が出る！", "奇跡って本当にあるんだね！"],
    "お嬢様": ["まあ……神々しい輝きですわ。", "この恵みに感謝いたしますわ。"],
    "クールＭ": ["現象を確認した。効果は明確だ。", "奇跡の発動を確認した。"],
    "クールＦ": ["発動したわね。効果を見極めましょう。", "不思議だけれど、結果は確かね。"],
    "老人": ["ありがたいことじゃのう。", "長く生きても、奇跡には驚かされるわい。"]
  };
  return randFrom(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function getDepartureMiracleLine(person) {
  const type = person.speechType || determineSpeechType(person);
  const lines = {
    "普通Ｍ": ["行かなきゃならない気がするんだ。怖いけど、足はもう前を向いてる。", "世話になったな。いつか胸を張って、この旅の意味を話せるようにするよ。"],
    "普通Ｆ": ["急でごめんなさい。でも、遠くから呼ばれているみたいなんです。", "別れは寂しいですけど、この旅にはきっと意味があるんだと思います。"],
    "強気Ｍ": ["理由はうまく言えない。だが行く。止めても無駄だ。", "別れは苦手だが、俺には俺の道ができた。必ず生きて進む。"],
    "強気Ｆ": ["胸の奥がうるさいの。行けって言うなら、行ってやるわ。", "泣かないで。私が選んだ旅よ。半端な覚悟で出ていくわけじゃない。"],
    "内気": ["こ、怖いです……でも、ここにいたらいけない気がして……。", "皆さんと離れるのはつらいです。でも、行かなきゃって、ずっと聞こえるんです。"],
    "陰気": ["……妙な衝動だ。俺らしくもないのに、外へ出ろと急かされる。", "別れの言葉は得意じゃない。……世話になった。"],
    "お調子者": ["いやー、急に旅立ちっすよ。自分でもびっくりしてるっす。", "寂しくなるっすけど、土産話を山ほど抱えて戻るつもりっす！"],
    "快活": ["わからないけど、行きたいんだ。胸がどきどきして止まらない！", "みんな、ありがとう！この先で何か見つけてくるね！"],
    "お嬢様": ["名残惜しいですわ。けれど、この胸の導きを無視できませんの。", "皆様のご恩は忘れませんわ。私の旅路に、どうか祝福を。"],
    "クールＭ": ["衝動の発生源は不明だ。だが、進むべき方向だけは明確だ。", "村を離れる。感傷はあるが、使命を優先する。"],
    "クールＦ": ["説明しきれない感覚ね。けれど、行くべきだと判断したわ。", "別れは惜しいけれど、迷っている時間はない。旅立つわ。"],
    "老人": ["この年でまた旅支度とはのう。奇跡とは人を落ち着かせてくれん。", "世話になったのう。残りの道を、もう少し歩いてみるとするか。"]
  };
  return randFrom(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function showMiracleResultModal(village, miracleName, message, people) {
  if (typeof document === "undefined") return;
  const entries = (people || []).filter(Boolean);
  if (entries.length === 0) return;
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:620px;width:calc(100% - 32px);max-height:min(80vh,720px);overflow:auto;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
  const rows = entries.map(person => `
    <div style="display:grid;grid-template-columns:72px 1fr;gap:12px;margin:12px 0;align-items:center;">
      <img src="${getPortraitPath(person)}" alt="${person.name}" style="width:72px;height:72px;object-fit:cover;border:1px solid #ddd;background:#f6f0e6;">
      <p><strong>${person.name}</strong>: ${getGenericMiracleLine(person, miracleName)}</p>
    </div>
  `).join("");
  modal.innerHTML = `
    <h2>${miracleName}</h2>
    <p>${message}</p>
    ${rows}
    <button id="closeMiracleResultModal">閉じる</button>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  document.getElementById("closeMiracleResultModal").onclick = () => {
    overlay.remove();
    modal.remove();
    updateUI(village);
  };
}

function getMarriageMiracleLine(person, partner, miracleName) {
  const childLine = getChildlikeMiracleLine(person);
  if (childLine) return childLine;
  const type = person.speechType || determineSpeechType(person);
  const lines = {
    "普通Ｍ": [`${partner.name}と夫婦か……不思議だけど、悪くないな。`, "急な話だけど、ちゃんと向き合うよ。"],
    "普通Ｆ": [`${partner.name}さんと夫婦になるんですね。大切にします。`, "驚きましたけど、嬉しいです。"],
    "強気Ｍ": [`${partner.name}を守る。それだけだ。`, "奇跡だろうが何だろうが、覚悟は決めた。"],
    "強気Ｆ": [`${partner.name}となら悪くないわ。私が支えるから。`, "いきなりだけど、逃げる気はないわ。"],
    "内気": [`${partner.name}さんと……緊張します。でも、頑張ります。`, "急でびっくりしました……でも、嫌ではないです。"],
    "陰気": [`……${partner.name}と夫婦か。奇跡とは妙なものだ。`, "……こうなったなら、捨て置けないな。"],
    "お調子者": [`${partner.name}と結婚っすか！？いやー、奇跡ってすごいっすね！`, "これはもう盛り上げるしかないっす！"],
    "快活": [`${partner.name}と夫婦だね！よろしく！`, "びっくりしたけど、なんだか楽しくなってきた！"],
    "お嬢様": [`${partner.name}様と結ばれるとは……奇跡とは優雅なものですわ。`, "突然ではありますけれど、心を込めて歩みますわ。"],
    "クールＭ": [`${miracleName}の結果は理解した。${partner.name}との関係を大切にする。`, "状況は急だが、責任は果たす。"],
    "クールＦ": [`${partner.name}と夫婦ね。冷静に受け止めるわ。`, "奇跡の結果なら、これからを考えるだけよ。"],
    "老人": [`ほう、${partner.name}と夫婦とはのう。長く生きても驚きは尽きん。`, "奇跡とはまこと不思議なものじゃな。"]
  };
  return randFrom(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function showMarriageMiracleModal(village, miracleName, pairs) {
  if (typeof document === "undefined" || !pairs.length) return;

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:620px;width:calc(100% - 32px);max-height:min(80vh,720px);overflow:auto;border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";

  const rows = pairs.map(([a, b]) => `
    <div style="display:grid;grid-template-columns:72px 1fr;gap:12px;margin:12px 0;padding-bottom:12px;border-bottom:1px solid #ddd;align-items:center;">
      <img src="${getPortraitPath(a)}" alt="${a.name}" style="width:72px;height:72px;object-fit:cover;">
      <p><strong>${a.name}</strong>: ${getMarriageMiracleLine(a, b, miracleName)}</p>
      <img src="${getPortraitPath(b)}" alt="${b.name}" style="width:72px;height:72px;object-fit:cover;">
      <div>
        <p><strong>${b.name}</strong>: ${getMarriageMiracleLine(b, a, miracleName)}</p>
      </div>
    </div>
  `).join("");

  modal.innerHTML = `
    <h2>${miracleName}</h2>
    <p>奇跡により新たな夫婦が結ばれました。</p>
    ${rows}
    <button id="closeMarriageMiracleModal">閉じる</button>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  document.getElementById("closeMarriageMiracleModal").onclick = () => {
    overlay.remove();
    modal.remove();
    updateUI(village);
  };
}

function randFrom(lines) {
  return lines[Math.floor(Math.random() * lines.length)];
}

/**
 * 肉体交換(雷/奇跡)
 */
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
    return person.speechType || (person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ");
  };

  const speechTypeA = getSpeechType(personA);
  const speechTypeB = getSpeechType(personB);
  
  // 入れ替わり時のセリフをランダムに選択
  const getRandomLine = (patterns, type, person) => {
    const childLine = getChildlikeMiracleLine(person);
    if (childLine) return childLine;
    const lines = patterns[type] || patterns[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"];
    return lines[Math.floor(Math.random() * lines.length)];
  };
  
  // 会話テキストを設定
  textA.innerHTML = `
    <p><strong>${personA.name}:</strong> ${getRandomLine(EXCHANGE_SPEECH_PATTERNS, speechTypeA, personA)}</p>
  `;
  
  textB.innerHTML = `
    <p><strong>${personB.name}:</strong> ${getRandomLine(EXCHANGE_SPEECH_PATTERNS, speechTypeB, personB)}</p>
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
  ],
  "老人": [
    "おおっと...わしの体はどこへ行ってしもうたのう...",
    "むむ...若返ったような...いや、体が入れ替わっておるのか...",
    "この体は...なんとも不思議な感覚じゃ...",
    "年寄りには刺激が強すぎるのう...こんな奇跡があるとは...",
    "昔の体を思い出すようじゃ...しかし、これは別人の体なのじゃな..."
  ]
};
