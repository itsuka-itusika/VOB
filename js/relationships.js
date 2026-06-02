// relationships.js

import { randInt, clampValue, getPortraitPath } from "./util.js";
import { recordLoverHistory, recordMarriageHistory } from "./history.js";
import { runAfterFestivalModals } from "./festivalModal.js";

/**
 * 恋人チェック (星霜祭などで呼ばれる)
 */
export function doLoverCheck(village, options = {}) {
  let candidatesA = village.villagers.filter(x=>
    x.spiritAge >= 16
    && isSingle(x)
  );
  if (candidatesA.length===0) {
    village.log("恋人判定:対象者なし");
    return false;
  }

  let a = randChoice(candidatesA);
  let candidatesB = village.villagers.filter(b=>isLoverCandidate(a, b));
  if (candidatesB.length===0) {
    village.log(`恋人判定:${a.name}の相手候補なし`);
    return false;
  }

  let b = randChoice(candidatesB);
  let sc = getLoverSuccessRate(a, b);
  if (Math.random()<=sc) {
    addRelationship(a, `恋人:${b.name}`);
    addRelationship(b, `恋人:${a.name}`);
    a.happiness=clampValue(a.happiness+50,0,100);
    b.happiness=clampValue(b.happiness+50,0,100);
    recordLoverHistory(village, a, b, { source: options.source || "縁結び" });
    village.log(`${a.name}と${b.name}恋人成立(成功率${(sc*100).toFixed(1)}%)`);
    showRelationshipModal("恋人成立", `${a.name}と${b.name}が恋人になりました。`, [
      [a, getLoverLine(a, b)],
      [b, getLoverLine(b, a)]
    ]);
    return true;
  } else {
    village.log(`${a.name}と${b.name}恋愛失敗`);
    return false;
  }
}

function isSingle(person) {
  return !checkHasRelationship(person,"既婚") &&
    !checkHasRelationship(person,"恋人") &&
    !hasRelationshipPrefix(person, SPOUSE_RELATION_PREFIXES);
}

function getOppositeSex(sex) {
  if (sex === "男") return "女";
  if (sex === "女") return "男";
  return null;
}

function isLoverCandidate(a, b) {
  if (!a || !b || a === b) return false;
  const expectedBodySex = getOppositeSex(a.spiritSex);
  if (!expectedBodySex) return false;
  return isSingle(b)
    && !hasLoverBlockingRelationship(a, b)
    && b.bodySex === expectedBodySex
    && b.bodyAge >= 16
    && b.bodyAge >= a.bodyAge - 10
    && b.bodyAge <= a.spiritAge + 8
    && Math.abs(a.eth - b.eth) + Math.abs(a.chr - b.chr) <= 16;
}

function getLoverSuccessRate(a, b) {
  let pA=Math.min(100, (Number(a.sexdr) || 0)*4);
  let pB=Math.min(100, (Number(b.sexdr) || 0)*4);
  return clampValue((pA*pB)/10000, 0.1, 0.5);
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

    addSpouseRelationships(a, b);
    recordMarriageHistory(village, a, b, { source: "夏至祭" });

    village.log(`${a.name}と${b.name}結婚成功`);
    showRelationshipModal("結婚", `${a.name}と${b.name}が結婚しました。`, [
      [a, getMarriageLine(a, b)],
      [b, getMarriageLine(b, a)]
    ]);
  } else {
    village.log(`${a.name}と${b.name}結婚失敗`);
  }
}

/**
 * 関係追加 (重複しない)
 */
const FRIEND_RELATION_PREFIXES = new Set(["恋人", "親友", "天敵"]);
const FAMILY_RELATION_PREFIXES = new Set(["夫", "妻", "母", "父", "子"]);
const GENETIC_RELATION_PREFIXES = new Set(["遺伝母", "遺伝父"]);
const SPOUSE_RELATION_PREFIXES = new Set(["夫", "妻"]);
const PARENT_CHILD_RELATION_PREFIXES = new Set(["母", "父", "子"]);
const LOVER_BLOCKING_RELATION_PREFIXES = new Set([
  ...SPOUSE_RELATION_PREFIXES,
  ...PARENT_CHILD_RELATION_PREFIXES,
  "天敵"
]);

function getRelationshipCategory(prefix) {
  if (FRIEND_RELATION_PREFIXES.has(prefix) || String(prefix).endsWith("仲間")) return "交友関係";
  if (FAMILY_RELATION_PREFIXES.has(prefix)) return "家族関係";
  if (GENETIC_RELATION_PREFIXES.has(prefix)) return "遺伝関係";
  return null;
}

export function parseRelationship(rel) {
  const raw = String(rel ?? "").trim();
  if (!raw) return null;
  if (raw === "既婚") return { raw, flag: "既婚", category: null, prefix: "既婚", target: null };

  const oldParent = raw.match(/^(.+)の(母|父)$/);
  if (oldParent) return { raw, category: "家族関係", prefix: "子", target: oldParent[1] };

  const oldChild = raw.match(/^(.+)の(息子|娘)$/);
  if (oldChild) return { raw, category: "家族関係", prefix: "母", target: oldChild[1] };

  const categorized = raw.match(/^【([^】]+)】(.+)$/);
  const categoryFromText = categorized ? categorized[1] : null;
  const body = categorized ? categorized[2] : raw;
  const separator = body.includes("：") ? "：" : ":";
  const idx = body.indexOf(separator);
  if (idx < 0) return { raw, category: null, prefix: body, target: null };

  const prefix = body.slice(0, idx).trim();
  const target = body.slice(idx + 1).trim();
  const category = categoryFromText || getRelationshipCategory(prefix);
  return { raw, category, prefix, target };
}

export function normalizeRelationship(rel) {
  const parsed = parseRelationship(rel);
  if (!parsed) return "";
  if (parsed.flag) return parsed.flag;
  if (!parsed.target) return parsed.raw;
  const category = parsed.category || getRelationshipCategory(parsed.prefix);
  const body = `${parsed.prefix}：${parsed.target}`;
  return category ? `【${category}】${body}` : body;
}

export function normalizeRelationships(person) {
  if (!person) return [];
  const source = Array.isArray(person.relationships) ? person.relationships : [];
  person.relationships = [...new Set(source.map(normalizeRelationship).filter(Boolean))];
  return person.relationships;
}

function getParsedRelationships(person) {
  return normalizeRelationships(person)
    .map(parseRelationship)
    .filter(Boolean);
}

function hasRelationshipPrefix(person, prefixes) {
  return getParsedRelationships(person).some(parsed => prefixes.has(parsed.prefix));
}

function hasRelationshipTo(person, targetName, prefixes) {
  return getParsedRelationships(person).some(parsed =>
    parsed.target === targetName && prefixes.has(parsed.prefix)
  );
}

function hasLoverBlockingRelationship(a, b) {
  return hasRelationshipTo(a, b.name, LOVER_BLOCKING_RELATION_PREFIXES) ||
    hasRelationshipTo(b, a.name, LOVER_BLOCKING_RELATION_PREFIXES);
}

export function hasNonEnemyRelationship(person) {
  return getParsedRelationships(person).some(parsed => {
    if (parsed.prefix === "天敵") return false;
    if (parsed.flag === "既婚") return true;
    return Boolean(parsed.raw);
  });
}

export function formatRelationshipsForDisplay(person) {
  const groups = new Map();
  normalizeRelationships(person).forEach(rel => {
    if (rel === "既婚") return;
    const parsed = parseRelationship(rel);
    if (!parsed?.target) return;
    const category = parsed.category || getRelationshipCategory(parsed.prefix) || "その他";
    const item = `${parsed.prefix}：${parsed.target}`;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(item);
  });
  if (groups.size === 0) return "なし";
  return Array.from(groups.entries())
    .map(([category, items]) => `【${category}】${items.join("、")}`)
    .join("、");
}

export function addRelationship(p, rel) {
  if (!p) return;
  if (!Array.isArray(p.relationships)) p.relationships = [];
  const normalized = normalizeRelationship(rel);
  if (normalized && !p.relationships.some(existing => normalizeRelationship(existing) === normalized)) {
    p.relationships.push(normalized);
  }
}

/**
 * 関係削除
 */
export function removeRelationship(p, rel) {
  if (!p || !Array.isArray(p.relationships)) return;
  const normalized = normalizeRelationship(rel);
  p.relationships = p.relationships.filter(existing =>
    existing !== rel && normalizeRelationship(existing) !== normalized
  );
}

export function getSpouseRelationshipPrefix(spouse) {
  return spouse?.bodySex === "女" ? "妻" : "夫";
}

export function addSpouseRelationships(a, b) {
  addRelationship(a, `${getSpouseRelationshipPrefix(b)}:${b.name}`);
  addRelationship(b, `${getSpouseRelationshipPrefix(a)}:${a.name}`);
}

function getSpeechType(person) {
  return person.speechType || (person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ");
}

function getChildlikeRelationshipLine(person) {
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  if (mindTraits.includes("無垢")) return randChoice(["あうー。", "んま。", "ばぶ。", "すやすや……"]);
  if (mindTraits.includes("萌芽")) {
    const lines = person.spiritSex === "女"
      ? ["わあ……。", "えへへ、わたしもうれしい。", "これ、なあに？"]
      : ["わあ……。", "えへへ、ぼくもうれしい。", "これ、なあに？"];
    return randChoice(lines);
  }
  return null;
}

function getLoverLine(person, partner) {
  const childLine = getChildlikeRelationshipLine(person);
  if (childLine) return childLine;
  const type = getSpeechType(person);
  const lines = {
    "普通Ｍ": [`${partner.name}と恋人か。大事にしたいな。`, "少し照れるけど、嬉しいよ。"],
    "普通Ｆ": [`${partner.name}さんと恋人なんですね。嬉しいです。`, "これから、もっと一緒にいられたらいいですね。"],
    "強気Ｍ": [`${partner.name}を泣かせるような真似はしない。`, "恋人か。悪くないな。"],
    "強気Ｆ": [`${partner.name}、ちゃんと私を見てなさいよ。`, "恋人になったからには、半端は許さないわ。"],
    "内気": [`${partner.name}さんと……恋人……。どきどきします。`, "う、嬉しいです……。"],
    "陰気": [`……${partner.name}と恋人か。妙な気分だ。`, "……悪くはない。たぶん。"],
    "お調子者": [`${partner.name}と恋人っすか！やったっす！`, "これはもう毎日楽しくなるっすね！"],
    "快活": [`${partner.name}と恋人だね！嬉しい！`, "これからいっぱい話そうね！"],
    "お嬢様": [`${partner.name}様と恋人に……胸が高鳴りますわ。`, "このご縁を大切にいたしますわ。"],
    "クールＭ": [`${partner.name}との関係を大切にする。`, "恋人か。冷静に、誠実に向き合う。"],
    "クールＦ": [`${partner.name}と恋人ね。悪くないわ。`, "浮かれすぎず、大切にするわ。"],
    "老人": [`${partner.name}と恋仲とは、若いものは良いのう。`, "縁とは不思議なものじゃな。"]
  };
  return randChoice(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function getMarriageLine(person, partner) {
  const childLine = getChildlikeRelationshipLine(person);
  if (childLine) return childLine;
  const type = getSpeechType(person);
  const lines = {
    "普通Ｍ": [`${partner.name}と夫婦か……大切にしよう。`, "今日から家族だな。よろしく。"],
    "普通Ｆ": [`${partner.name}さんと夫婦になるんですね。大切にします。`, "今日から家族ですね。嬉しいです。"],
    "強気Ｍ": [`${partner.name}は俺が支える。`, "夫婦になったからには、守り抜く。"],
    "強気Ｆ": [`${partner.name}、これからは私の家族よ。`, "夫婦になったからには、遠慮はなしよ。"],
    "内気": [`${partner.name}さんと夫婦……緊張します。`, "頼りないかもしれませんが、頑張ります。"],
    "陰気": [`……${partner.name}と家族か。`, "……こうなったなら、捨て置けないな。"],
    "お調子者": [`${partner.name}と結婚っすね！いやー、めでたいっす！`, "これはもう頑張るしかないっすね！"],
    "快活": [`${partner.name}、これからよろしくね！`, "夫婦だね！一緒に頑張ろう！"],
    "お嬢様": [`${partner.name}様と夫婦に……末永くよろしくお願いいたしますわ。`, "このご縁を、生涯大切にいたしますわ。"],
    "クールＭ": [`${partner.name}との婚姻を受け止めた。責任を果たす。`, "夫婦として、現実的に支え合おう。"],
    "クールＦ": [`${partner.name}と夫婦ね。落ち着いて歩みましょう。`, "今日から家族。大切にするわ。"],
    "老人": [`夫婦とはよいものじゃ。${partner.name}を大切にな。`, "新しい家族じゃな。めでたいことじゃ。"]
  };
  return randChoice(lines[type] || lines[person.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"]);
}

function showRelationshipModal(title, message, entries) {
  runAfterFestivalModals(() => showRelationshipModalNow(title, message, entries));
}

function showRelationshipModalNow(title, message, entries) {
  if (typeof document === "undefined") return;
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9998;";
  const modal = document.createElement("div");
  modal.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;padding:20px;max-width:580px;width:calc(100% - 32px);border-radius:8px;box-shadow:0 12px 40px rgba(0,0,0,0.35);z-index:9999;";
  const rows = entries.map(([person, line]) => `
    <div style="display:grid;grid-template-columns:72px 1fr;gap:12px;margin:12px 0;align-items:center;">
      <img src="${getPortraitPath(person)}" alt="${person.name}" style="width:72px;height:72px;object-fit:cover;border:1px solid #ddd;background:#f6f0e6;">
      <p><strong>${person.name}</strong>: ${line}</p>
    </div>
  `).join("");
  modal.innerHTML = `
    <h2>${title}</h2>
    <p>${message}</p>
    ${rows}
    <button type="button" data-close-relationship-modal>閉じる</button>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  modal.querySelector("[data-close-relationship-modal]").onclick = () => {
    overlay.remove();
    modal.remove();
  };
}

/**
 * 村人が死亡・出立などで村を去る時、残った村人側の関係を整理する
 */
export function clearRelationshipsForDepartedVillager(village, departed) {
  if (!village || !Array.isArray(village.villagers) || !departed) return;

  const departedName = departed.name;
  if (!departedName) return;

  village.villagers.forEach(person => {
    if (person === departed || !Array.isArray(person.relationships)) return;

    let removedSpouse = false;
    normalizeRelationships(person);
    person.relationships = person.relationships.filter(rel => {
      if (rel === "既婚") return true;

      const parsed = parseRelationship(rel);
      const referencesDeparted = parsed?.target === departedName || String(rel).startsWith(`${departedName}の`);
      const isSpouseReference = parsed?.prefix === "夫" ||
        parsed?.prefix === "妻" ||
        rel === `${departedName}の夫` ||
        rel === `${departedName}の妻`;
      if (referencesDeparted && isSpouseReference) {
        removedSpouse = true;
      }
      return !referencesDeparted;
    });

    if (removedSpouse) {
      person.relationships = person.relationships.filter(rel => rel !== "既婚");
    }
  });
}

/**
 * 特定キーワードを含む関係を持っているか
 */
export function checkHasRelationship(p, kw) {
  if (!p || !Array.isArray(p.relationships)) return false;
  return normalizeRelationships(p).some(r => r.includes(kw));
}

/**
 * "prefix:相手名" の相手名を返す
 */
export function getRelationshipTargetName(p, prefix) {
  if (!p || !Array.isArray(p.relationships)) return null;
  let r = normalizeRelationships(p)
    .map(parseRelationship)
    .find(parsed => parsed?.prefix === prefix && parsed.target);
  if (r) return r.target;
  return null;
}

/**
 * ランダムチョイス (本ファイルで使うために再import)
 */
function randChoice(arr) {
  if (!arr || arr.length===0) return null;
  return arr[Math.floor(Math.random()*arr.length)];
}
