// relationships.js

import { randInt, clampValue } from "./util.js";

/**
 * 恋人チェック (星霜祭などで呼ばれる)
 */
export function doLoverCheck(village) {
  let candF = village.villagers.filter(x=>
    x.bodySex==="女" && x.bodyAge>=16 && x.bodyAge<=30 
    && !checkHasRelationship(x,"既婚")
    && !checkHasRelationship(x,"恋人")
  );
  let candM = village.villagers.filter(x=>
    x.bodySex==="男" && x.bodyAge>=16 && x.bodyAge<=39
    && !checkHasRelationship(x,"既婚")
    && !checkHasRelationship(x,"恋人")
  );
  if (candF.length===0||candM.length===0) {
    village.log("恋人判定:未婚男女なし");
    return;
  }
  let f = randChoice(candF);
  let m = randChoice(candM);

  let dAge = m.bodyAge - f.bodyAge;
  if (dAge < -5 || dAge>9) {
    village.log("年齢差大きすぎ:恋人失敗");
    return;
  }
  let dEth = m.eth - f.eth;
  if (dEth<-9||dEth>9) {
    village.log("倫理差大きすぎ:恋人失敗");
    return;
  }
  let dChr = f.chr - m.chr;
  if (dChr<-12||dChr>12) {
    village.log("魅力差大きすぎ:恋人失敗");
    return;
  }
  let p1=Math.min(100, m.sexdr*4);
  let p2=Math.min(100, f.sexdr*4);
  let sc = (p1*p2)/10000;  // 例: p1=80, p2=40 => sc= (80*40)/10000=0.32
  if (Math.random()<=sc) {
    addRelationship(f, `恋人:${m.name}`);
    addRelationship(m, `恋人:${f.name}`);
    f.happiness=clampValue(f.happiness+50,0,100);
    m.happiness=clampValue(m.happiness+50,0,100);
    village.log(`${f.name}と${m.name}恋人成立(成功率${(sc*100).toFixed(1)}%)`);
  } else {
    village.log(`${f.name}と${m.name}恋愛失敗`);
  }
}

/**
 * 結婚チェック (夏至祭などで呼ばれる)
 */
export function doMarriageCheck(village) {
  let c = village.villagers.filter(x=>
    x.spiritAge>=18
    && checkHasRelationship(x,"恋人")
    && !checkHasRelationship(x,"既婚")
  );
  if (c.length===0) {
    village.log("結婚判定:該当者なし");
    return;
  }
  let a = randChoice(c);
  let bName = getRelationshipTargetName(a, "恋人");
  if (!bName) return;

  let b = village.villagers.find(xx=>xx.name===bName);
  if (!b) return;

  let rA = Math.min(100, (a.ind+a.eth)*2);
  let rB = Math.min(100, (b.ind+b.eth)*2);
  let sc = (rA*rB)/10000;

  if (Math.random()<=sc) {
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

    village.log(`${a.name}と${b.name}結婚成功`);
  } else {
    village.log(`${a.name}と${b.name}結婚失敗`);
  }
}

/**
 * 関係追加 (重複しない)
 */
export function addRelationship(p, rel) {
  if (!p.relationships.includes(rel)) {
    p.relationships.push(rel);
  }
}

/**
 * 関係削除
 */
export function removeRelationship(p, rel) {
  let i = p.relationships.indexOf(rel);
  if (i>=0) p.relationships.splice(i,1);
}

/**
 * 特定キーワードを含む関係を持っているか
 */
export function checkHasRelationship(p, kw) {
  return p.relationships.some(r => r.includes(kw));
}

/**
 * "prefix:相手名" の相手名を返す
 */
export function getRelationshipTargetName(p, prefix) {
  let r = p.relationships.find(rr => rr.startsWith(prefix+":"));
  if (r) {
    let arr = r.split(":");
    if (arr.length===2) return arr[1];
  }
  return null;
}

/**
 * ランダムチョイス (本ファイルで使うために再import)
 */
function randChoice(arr) {
  if (!arr || arr.length===0) return null;
  return arr[Math.floor(Math.random()*arr.length)];
}
