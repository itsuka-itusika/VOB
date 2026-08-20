import { clampValue, randInt } from "./util.js";
import { addStoredResource } from "./domain/resourceLimits.js";
import { addAcquiredStat } from "./domain/statLayers.js";
import { getActiveVillagers } from "./domain/apocalypseRules.js";
import { addDivineMight } from "./divineMight.js";
import {
  addRelationship,
  adjustFriendshipScore,
  getFriendshipScore,
  getPartnerVillagers,
  hasCloseOrHostileRelationship,
  isSingle
} from "./relationships.js";
import { recordLoverHistory } from "./history.js";

// 趣味によるステータス変動の発生率倍率。全趣味に一律で掛かる。
const HOBBY_STAT_CHANGE_RATE = 0.4;

export class HobbyEffects {
  static apply(p, v) {
    let h = p.hobby;
    if (!h) return "";

    if (this.isAgeRestrictedHobby(p, h)) {
      return `(趣味[${h}]:肉体年齢12歳未満のため効果なし)`;
    }

    let msg = "";
    switch(h) {
      case "喧嘩":
        msg = this.applyFighting(p, v);
        break;
      case "筋トレ":
        msg = this.applyTraining(p, v);
        break;
      case "ドカ食い":
      case "大食い":
        p.hobby = "ドカ食い";
        msg = this.applyEating(p, v);
        break;
      case "露出":
        msg = this.applyExposure(p, v);
        break;
      case "自家発電":
        msg = this.applySelfPower(p, v);
        break;
      case "ギャンブル":
        msg = this.applyGamble(p, v);
        break;
      case "ナンパ":
        msg = this.applyPickupOnWoman(p, v);
        break;
      case "逆ナン":
        msg = this.applyPickup(p, v, "女");
        break;
      case "滝行":
        msg = this.applyAsceticTraining(p);
        break;
      case "祈り":
        msg = this.applyPrayer(p, v);
        break;
      case "手芸":
        msg = this.applyCraftHobby(p, v);
        break;
      case "自由研究":
        msg = this.applyResearchHobby(p, v);
        break;
      case "瞑想":
        msg = this.applyMeditation(p, v);
        break;
      case "美食":
        msg = this.applyFineDining(p, v);
        break;
      case "釣り":
        msg = this.applyFishingHobby(p, v);
        break;
      case "読書":
        msg = this.applyReading(p);
        break;
      case "ショッピング":
        msg = this.applyShopping(p, v);
        break;
      case "散歩":
        msg = this.applyWalk(p);
        break;
      case "噂話":
        msg = this.applyGossip(p, v);
        break;
      case "園芸":
        msg = this.applyGardening(p, v);
        break;
      case "詩作":
        msg = this.applyPoetry(p, v);
        break;
      case "推し活":
        msg = this.applyFanActivity(p, v);
        break;
      case "飲酒":
        msg = this.applyDrinking(p, v);
        break;
      case "投資":
        msg = this.applyInvestment(p, v);
        break;
      case "天体観測":
        msg = this.applyStargazing(p, v);
        break;
      case "狩猟":
      case "ハンティング":
        p.hobby = "ハンティング";
        msg = this.applyHuntingHobby(p, v);
        break;
      case "狩り":
        msg = this.applyHuntingHobby(p, v, "狩り");
        break;
      case "お茶会":
        msg = this.applyTeaParty(p, v);
        break;
      case "オシャレ":
        msg = this.applyFashionHobby(p);
        break;
      case "占い":
        msg = this.applyFortuneTelling(p, v);
        break;
      case "ダンス":
        msg = this.applyDance(p, v);
        break;
      case "遠乗り":
        msg = this.applyLongRide(p);
        break;
      case "毛づくろい":
        msg = this.applyGrooming(p, "毛づくろい");
        break;
      case "羽づくろい":
        msg = this.applyGrooming(p, "羽づくろい");
        break;
      case "繁殖":
        msg = this.applyBreedingHobby(p);
        break;
      case "子育て":
        msg = this.applyChildcareHobby(p, v);
        break;
      case "日光浴":
        msg = this.applySunbathing(p);
        break;
      case "歌唱":
        msg = this.applySinging(p, v);
        break;
      case "月光浴":
        msg = this.applyMoonbathing(p, v);
        break;
      case "謎掛け":
        msg = this.applyRiddleHobby(p, v);
        break;
      case "人間観察":
        msg = this.applyPeopleWatching(p);
        break;
      default:
        msg = `(趣味[${h}]:追加効果なし)`;
        break;
    }
    return msg;
  }

  static isAgeRestrictedHobby(p, hobby) {
    const bodyAge = Number(p.bodyAge) || 0;
    return bodyAge < 12 && ["自家発電", "飲酒"].includes(hobby);
  }

  static applyFighting(p, v) {
    p.hp = clampValue(p.hp-10, 0, 100);
    v.security = clampValue(v.security-10, 0, 100);
    if (this.rollHobbyStatChange(0.5)) {
      addAcquiredStat(p, "cou", 1);
      return "(喧嘩:体力-10,治安-10,勇気+1)";
    }
    return "(喧嘩:体力-10,治安-10)";
  }

  static applyTraining(p, v) {
    p.hp = clampValue(p.hp-10, 0, 100);
    if (this.rollHobbyStatChange(0.5)) {
      addAcquiredStat(p, "str", 1);
      return "(筋トレ:体力-10,筋力+1)";
    }
    return "(筋トレ:体力-10)";
  }

  static applyEating(p, v) {
    if (v.food >= 10) {
      v.food -= 10;
      p.hp = clampValue(p.hp+50, 0, 100);
      if (this.rollHobbyStatChange(0.5)) {
        addAcquiredStat(p, "vit", 1);
        return "(ドカ食い:食料-10,体力+50,耐久+1)";
      }
      return "(ドカ食い:食料-10,体力+50)";
    }
    return "(ドカ食いしたが食料不足)";
  }

  static applyExposure(p, v) {
    p.hp = clampValue(p.hp-10, 0, 100);
    v.security = clampValue(v.security-10, 0, 100);

    if (p.bodySex === "男") {
      getActiveVillagers(v).forEach(x => {
        x.happiness = clampValue(x.happiness-5, 0, 100);
      });
      return "(露出[男]:体力-10,治安-10,全体幸福-5)";
    } else {
      let msg = "(露出[女]:体力-10,治安-10";
      if (p.chr >= 15) {
        let men = getActiveVillagers(v).filter(x => x.spiritSex === "男");
        men.forEach(mm => {
          mm.happiness = clampValue(mm.happiness+5, 0, 100);
        });
        let gain = Math.floor(p.mag * p.chr/40);
        v.mana = clampValue(v.mana+gain, 0, 99999);
        msg += `,男性幸福+5,魔素+${gain}`;
      }
      if (this.rollHobbyStatChange(0.5)) {
        addAcquiredStat(p, "sexdr", 1);
      }
      if (this.rollHobbyStatChange(0.5)) {
        addAcquiredStat(p, "eth", -1);
      }
      return msg + ")";
    }
  }

  static applySelfPower(p, v) {
    p.hp = clampValue(p.hp-20, 0, 100);
    if (p.bodySex === "女") {
      let men = getActiveVillagers(v).filter(x => x.spiritSex === "男");
      men.forEach(mm => {
        mm.happiness = clampValue(mm.happiness+3, 0, 100);
      });
      let g = Math.floor(p.mag * p.chr/40);
      v.mana = clampValue(v.mana+g, 0, 99999);
      if (this.rollHobbyStatChange(0.5)) {
        addAcquiredStat(p, "sexdr", 1);
      }
      return `(自家発電[女]:体力-20,男性幸福+3,魔素+${g})`;
    }
    return "(自家発電[男]:体力-20,効果小)";
  }

  static rollHobbyStatChange(chance) {
    return Math.random() < (Number(chance) || 0) * HOBBY_STAT_CHANGE_RATE;
  }

  static maybeRaiseStat(p, stat, chance, amount = 1) {
    if (this.rollHobbyStatChange(chance)) {
      addAcquiredStat(p, stat, amount);
      return `,${this.statLabel(stat)}${amount >= 0 ? "+" : ""}${amount}`;
    }
    return "";
  }

  static statLabel(stat) {
    const labels = {
      str: "筋力",
      vit: "耐久",
      dex: "器用",
      mag: "魔力",
      chr: "魅力",
      int: "知力",
      ind: "勤勉",
      eth: "倫理",
      cou: "勇気",
      sexdr: "好色"
    };
    return labels[stat] || stat;
  }

  static applyGamble(p, v) {
    const amount = randInt(8, 24);
    if (Math.random() < 0.5) {
      v.funds = clampValue(v.funds + amount, 0, 99999);
      return `(ギャンブル:資金+${amount}${this.maybeRaiseStat(p, "cou", 0.35)})`;
    }
    v.funds = clampValue(v.funds - amount, 0, 99999);
    return `(ギャンブル:資金-${amount}${this.maybeRaiseStat(p, "cou", 0.2)})`;
  }

  // 塩の柱は getActiveVillagers が除外するため、ここでは判定しない。
  static isPickupTargetCandidate(a, b) {
    if (!b || b === a) return false;
    if (!isSingle(b)) return false;
    if (hasCloseOrHostileRelationship(a, b)) return false;
    const bodyTraits = Array.isArray(b.bodyTraits) ? b.bodyTraits : [];
    if (bodyTraits.includes("四足歩行") || bodyTraits.includes("人面獣身")) return false;
    if (b.bodySex !== "女") return false;
    const bodyAge = Number(b.bodyAge) || 0;
    if (bodyAge < 16 || bodyAge > (Number(a.spiritAge) || 0) + 8) return false;
    if ((Number(b.chr) || 0) < 16) return false;
    return getFriendshipScore(a, b) >= 0;
  }

  static rejectsPickup(a, b) {
    const mindTraits = Array.isArray(b.mindTraits) ? b.mindTraits : [];
    if (mindTraits.includes("神聖")) return true;
    if (mindTraits.includes("男嫌い") && a.bodySex === "男") return true;
    return getFriendshipScore(b, a) <= -1;
  }

  // B→Aの好感度が0〜39のときだけ通る成否判定。
  static rollPickupAcceptance(a, b) {
    if ((Number(a.chr) || 0) < (Number(b.chr) || 0) - 4) return false;
    const chance = (Number(b.sexdr) || 0) * 5 - (Number(b.eth) || 0) * 3;
    return Math.random() * 100 < chance;
  }

  static resolvePickupSuccess(a, b, v) {
    adjustFriendshipScore(a, b, 10);
    adjustFriendshipScore(b, a, 10);
    [a, b].forEach(person => {
      person.mp = clampValue(person.mp + 10, 0, 100);
      person.happiness = clampValue(person.happiness + 10, 0, 100);
    });

    const partners = getPartnerVillagers(v, a);
    partners.forEach(partner => adjustFriendshipScore(partner, a, -20));
    const jealousy = partners.length > 0
      ? `,${partners.map(partner => partner.name).join("・")}の好感度-20`
      : "";

    let loverText = "";
    if (isSingle(a) && getFriendshipScore(a, b) >= 40) {
      addRelationship(a, `恋人:${b.name}`);
      addRelationship(b, `恋人:${a.name}`);
      a.happiness = clampValue(a.happiness + 20, 0, 100);
      b.happiness = clampValue(b.happiness + 20, 0, 100);
      recordLoverHistory(v, a, b, { source: "ナンパ" });
      v.log(`${a.name}と${b.name}はナンパをきっかけに恋人になった`);
      loverText = ",恋人成立,双方幸福+20";
    }

    return `${b.name}と意気投合,双方好感度+10,双方メンタル+10,幸福+10${jealousy}${loverText}`;
  }

  static applyPickupOnWoman(p, v) {
    const targets = getActiveVillagers(v).filter(x => this.isPickupTargetCandidate(p, x));
    if (targets.length === 0) {
      return "(ナンパ:めぼしい相手がいなかった…)";
    }

    const target = targets[randInt(0, targets.length - 1)];
    const outcome = this.resolvePickup(p, target, v);
    // 魅力上昇が同じナンパの成否へ影響しないよう、能力上昇は判定後に処理する。
    const statGrowth = `${this.maybeRaiseStat(p, "chr", 0.3)}${this.maybeRaiseStat(p, "sexdr", 0.25)}`;
    return `(ナンパ:${outcome}${statGrowth})`;
  }

  static resolvePickup(a, b, v) {
    if (this.rejectsPickup(a, b)) {
      adjustFriendshipScore(b, a, -20);
      return `${b.name}に相手にされなかった,好感度-20`;
    }
    if (getFriendshipScore(b, a) < 40 && !this.rollPickupAcceptance(a, b)) {
      adjustFriendshipScore(b, a, -20);
      return `${b.name}に振られた,好感度-20`;
    }
    return this.resolvePickupSuccess(a, b, v);
  }

  static applyPickup(p, v, targetSpiritSex) {
    p.mp = clampValue(p.mp + 10, 0, 100);
    const targets = getActiveVillagers(v).filter(x => x !== p && x.spiritSex === targetSpiritSex);
    if (targets.length > 0) {
      const target = targets[randInt(0, targets.length - 1)];
      target.happiness = clampValue(target.happiness + 4, 0, 100);
    }
    return `(ナンパ系:メンタル+10${this.maybeRaiseStat(p, "chr", 0.3)}${this.maybeRaiseStat(p, "sexdr", 0.25)})`;
  }

  static applyAsceticTraining(p) {
    p.hp = clampValue(p.hp - 10, 0, 100);
    p.mp = clampValue(p.mp + 20, 0, 100);
    return `(滝行:体力-10,メンタル+20${this.maybeRaiseStat(p, "eth", 0.35)}${this.maybeRaiseStat(p, "cou", 0.2)})`;
  }

  static applyPrayer(p, v) {
    const gain = randInt(4, 10);
    p.mp = clampValue(p.mp + 15, 0, 100);
    v.mana = clampValue(v.mana + gain, 0, 99999);
    return `(祈り:メンタル+15,魔素+${gain}${this.maybeRaiseStat(p, "eth", 0.3)}${this.maybeRaiseStat(p, "mag", 0.2)})`;
  }

  static applyCraftHobby(p, v) {
    const gain = randInt(4, 10);
    v.funds = clampValue(v.funds + gain, 0, 99999);
    return `(手芸:資金+${gain}${this.maybeRaiseStat(p, "dex", 0.35)}${this.maybeRaiseStat(p, "ind", 0.2)})`;
  }

  static applyResearchHobby(p, v) {
    const gain = randInt(4, 10);
    p.mp = clampValue(p.mp - 5, 0, 100);
    v.tech = clampValue(v.tech + gain, 0, 99999);
    return `(自由研究:メンタル-5,技術+${gain}${this.maybeRaiseStat(p, "int", 0.35)}${this.maybeRaiseStat(p, "mag", 0.15)})`;
  }

  static applyMeditation(p, v) {
    const gain = randInt(3, 8);
    p.mp = clampValue(p.mp + 25, 0, 100);
    v.mana = clampValue(v.mana + gain, 0, 99999);
    return `(瞑想:メンタル+25,魔素+${gain}${this.maybeRaiseStat(p, "mag", 0.3)})`;
  }

  static applyFineDining(p, v) {
    if (v.food < 8) return "(美食を楽しみたかったが食料不足)";
    v.food -= 8;
    p.happiness = clampValue(p.happiness + 15, 0, 100);
    p.mp = clampValue(p.mp + 10, 0, 100);
    return `(美食:食料-8,幸福+15,メンタル+10${this.maybeRaiseStat(p, "chr", 0.3)})`;
  }

  static applyFishingHobby(p, v) {
    const gain = randInt(6, 14);
    p.hp = clampValue(p.hp - 5, 0, 100);
    addStoredResource(v, "food", gain);
    return `(釣り:体力-5,食料+${gain}${this.maybeRaiseStat(p, "dex", 0.25)}${this.maybeRaiseStat(p, "cou", 0.15)})`;
  }

  static applyReading(p) {
    p.mp = clampValue(p.mp + 20, 0, 100);
    return `(読書:メンタル+20${this.maybeRaiseStat(p, "int", 0.35)})`;
  }

  static applyShopping(p, v) {
    if (v.funds < 10) return "(ショッピングしたかったが資金不足)";
    v.funds -= 10;
    p.happiness = clampValue(p.happiness + 18, 0, 100);
    return `(ショッピング:資金-10,幸福+18${this.maybeRaiseStat(p, "chr", 0.25)})`;
  }

  static applyWalk(p) {
    p.hp = clampValue(p.hp + 10, 0, 100);
    p.happiness = clampValue(p.happiness + 8, 0, 100);
    return `(散歩:体力+10,幸福+8${this.maybeRaiseStat(p, "vit", 0.15)})`;
  }

  static applyGossip(p, v) {
    p.mp = clampValue(p.mp + 12, 0, 100);
    v.security = clampValue(v.security - 2, 0, 100);
    return `(噂話:メンタル+12,治安-2${this.maybeRaiseStat(p, "chr", 0.2)}${this.maybeRaiseStat(p, "eth", 0.15, -1)})`;
  }

  static applyGardening(p, v) {
    const gain = randInt(4, 10);
    addStoredResource(v, "food", gain);
    p.happiness = clampValue(p.happiness + 6, 0, 100);
    return `(園芸:食料+${gain},幸福+6${this.maybeRaiseStat(p, "eth", 0.2)}${this.maybeRaiseStat(p, "dex", 0.15)})`;
  }

  static applyPoetry(p, v) {
    p.mp = clampValue(p.mp + 10, 0, 100);
    return `(詩作:メンタル+10${this.maybeRaiseStat(p, "chr", 0.25)}${this.maybeRaiseStat(p, "mag", 0.15)})`;
  }

  static applyFanActivity(p, v) {
    const spent = v.funds >= 5;
    if (spent) v.funds -= 5;
    p.mp = clampValue(p.mp + 25, 0, 100);
    p.happiness = clampValue(p.happiness + 15, 0, 100);
    return `(推し活:${spent ? "資金-5," : ""}メンタル+25,幸福+15${this.maybeRaiseStat(p, "chr", 0.15)})`;
  }

  static applyDrinking(p, v) {
    p.mp = clampValue(p.mp + 20, 0, 100);
    p.happiness = clampValue(p.happiness + 10, 0, 100);
    v.security = clampValue(v.security - 3, 0, 100);
    addDivineMight(v, 1);
    return `(飲酒:メンタル+20,幸福+10,治安-3,神威+1${this.maybeRaiseStat(p, "cou", 0.2)})`;
  }

  static applyInvestment(p, v) {
    const amount = randInt(10, 24);
    if (v.funds < amount) return "(投資したかったが資金不足)";
    v.funds -= amount;
    if (Math.random() < 0.55) {
      const gain = amount + randInt(6, 18);
      v.funds = clampValue(v.funds + gain, 0, 99999);
      return `(投資:資金-${amount},回収+${gain}${this.maybeRaiseStat(p, "int", 0.3)})`;
    }
    return `(投資:資金-${amount}${this.maybeRaiseStat(p, "int", 0.15)})`;
  }

  static applyStargazing(p, v) {
    const gain = randInt(4, 10);
    p.mp = clampValue(p.mp + 15, 0, 100);
    v.mana = clampValue(v.mana + gain, 0, 99999);
    return `(天体観測:メンタル+15,魔素+${gain}${this.maybeRaiseStat(p, "int", 0.2)}${this.maybeRaiseStat(p, "mag", 0.2)})`;
  }

  static applyHuntingHobby(p, v, label = "ハンティング") {
    const gain = randInt(8, 16);
    p.hp = clampValue(p.hp - 8, 0, 100);
    addStoredResource(v, "food", gain);
    return `(${label}:体力-8,食料+${gain}${this.maybeRaiseStat(p, "cou", 0.25)}${this.maybeRaiseStat(p, "dex", 0.15)})`;
  }

  static applyTeaParty(p, v) {
    p.mp = clampValue(p.mp + 18, 0, 100);
    p.happiness = clampValue(p.happiness + 10, 0, 100);
    return `(お茶会:メンタル+18,幸福+10${this.maybeRaiseStat(p, "chr", 0.2)})`;
  }

  static applyFashionHobby(p) {
    p.happiness = clampValue(p.happiness + 12, 0, 100);
    return `(オシャレ:幸福+12${this.maybeRaiseStat(p, "chr", 0.35)})`;
  }

  static applyFortuneTelling(p, v) {
    const gain = randInt(3, 7);
    p.mp = clampValue(p.mp + 12, 0, 100);
    v.mana = clampValue(v.mana + gain, 0, 99999);
    return `(占い:メンタル+12,魔素+${gain}${this.maybeRaiseStat(p, "int", 0.2)}${this.maybeRaiseStat(p, "mag", 0.15)})`;
  }

  static applyDance(p, v) {
    p.hp = clampValue(p.hp - 5, 0, 100);
    p.happiness = clampValue(p.happiness + 12, 0, 100);
    const men = getActiveVillagers(v).filter(x => x !== p && x.spiritSex === "男");
    men.forEach(mm => {
      mm.happiness = clampValue(mm.happiness + 2, 0, 100);
    });
    return `(ダンス:体力-5,幸福+12,男性幸福+2${this.maybeRaiseStat(p, "dex", 0.2)}${this.maybeRaiseStat(p, "chr", 0.2)})`;
  }

  static applyLongRide(p) {
    p.hp = clampValue(p.hp - 8, 0, 100);
    p.happiness = clampValue(p.happiness + 12, 0, 100);
    return `(遠乗り:体力-8,幸福+12${this.maybeRaiseStat(p, "cou", 0.2)}${this.maybeRaiseStat(p, "vit", 0.15)})`;
  }

  static applyGrooming(p, label) {
    p.mp = clampValue(p.mp + 8, 0, 100);
    p.happiness = clampValue(p.happiness + 10, 0, 100);
    return `(${label}:メンタル+8,幸福+10${this.maybeRaiseStat(p, "chr", 0.25)})`;
  }

  static applyBreedingHobby(p) {
    p.mp = clampValue(p.mp + 8, 0, 100);
    p.happiness = clampValue(p.happiness + 12, 0, 100);
    return `(繁殖:メンタル+8,幸福+12${this.maybeRaiseStat(p, "sexdr", 0.25)})`;
  }

  static applyChildcareHobby(p, v) {
    p.mp = clampValue(p.mp + 10, 0, 100);
    p.happiness = clampValue(p.happiness + 8, 0, 100);
    const children = Array.isArray(v?.villagers)
      ? getActiveVillagers(v).filter(x => x !== p && Number(x.bodyAge) < 12)
      : [];
    if (children.length > 0) {
      const child = children[randInt(0, children.length - 1)];
      child.happiness = clampValue(child.happiness + 4, 0, 100);
      return `(子育て:メンタル+10,幸福+8,子ども幸福+4${this.maybeRaiseStat(p, "eth", 0.2)})`;
    }
    return `(子育て:メンタル+10,幸福+8${this.maybeRaiseStat(p, "eth", 0.2)})`;
  }

  static applySunbathing(p) {
    p.hp = clampValue(p.hp + 8, 0, 100);
    p.happiness = clampValue(p.happiness + 8, 0, 100);
    return `(日光浴:体力+8,幸福+8${this.maybeRaiseStat(p, "vit", 0.15)})`;
  }

  static applySinging(p, v) {
    p.mp = clampValue(p.mp + 12, 0, 100);
    const listeners = Array.isArray(v?.villagers) ? getActiveVillagers(v).filter(x => x !== p) : [];
    listeners.forEach(person => {
      person.happiness = clampValue(person.happiness + 2, 0, 100);
    });
    return `(歌唱:メンタル+12,他者幸福+2${this.maybeRaiseStat(p, "chr", 0.25)}${this.maybeRaiseStat(p, "mag", 0.15)})`;
  }

  static applyMoonbathing(p, v) {
    const gain = randInt(3, 8);
    p.mp = clampValue(p.mp + 15, 0, 100);
    v.mana = clampValue(v.mana + gain, 0, 99999);
    return `(月光浴:メンタル+15,魔素+${gain}${this.maybeRaiseStat(p, "mag", 0.25)})`;
  }

  static applyRiddleHobby(p, v) {
    const gain = randInt(3, 8);
    p.mp = clampValue(p.mp + 8, 0, 100);
    v.tech = clampValue(v.tech + gain, 0, 99999);
    return `(謎掛け:メンタル+8,技術+${gain}${this.maybeRaiseStat(p, "int", 0.3)})`;
  }

  static applyPeopleWatching(p) {
    p.mp = clampValue(p.mp + 10, 0, 100);
    return `(人間観察:メンタル+10${this.maybeRaiseStat(p, "int", 0.25)}${this.maybeRaiseStat(p, "chr", 0.15)})`;
  }
}
