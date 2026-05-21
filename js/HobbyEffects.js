import { clampValue, randInt } from "./util.js";

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
        msg = this.applyPickup(p, v, "男");
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
      default:
        msg = `(趣味[${h}]:追加効果なし)`;
        break;
    }
    return msg;
  }

  static isAgeRestrictedHobby(p, hobby) {
    const bodyAge = Number(p.bodyAge) || 0;
    return bodyAge < 12 && ["自家発電", "飲酒", "ハンティング", "狩猟"].includes(hobby);
  }

  static applyFighting(p, v) {
    p.hp = clampValue(p.hp-10, 0, 100);
    v.security = clampValue(v.security-10, 0, 100);
    if (Math.random() < 0.5) {
      p.cou++;
      return "(喧嘩:体力-10,治安-10,勇気+1)";
    }
    return "(喧嘩:体力-10,治安-10)";
  }

  static applyTraining(p, v) {
    p.hp = clampValue(p.hp-10, 0, 100);
    if (Math.random() < 0.5) {
      p.str++;
      return "(筋トレ:体力-10,筋力+1)";
    }
    return "(筋トレ:体力-10)";
  }

  static applyEating(p, v) {
    if (v.food >= 10) {
      v.food -= 10;
      p.hp = clampValue(p.hp+50, 0, 100);
      if (Math.random() < 0.5) {
        p.vit++;
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
      v.villagers.forEach(x => {
        x.happiness = clampValue(x.happiness-5, 0, 100);
      });
      return "(露出[男]:体力-10,治安-10,全体幸福-5)";
    } else {
      let msg = "(露出[女]:体力-10,治安-10";
      if (p.chr >= 15) {
        let men = v.villagers.filter(x => x.spiritSex === "男");
        men.forEach(mm => {
          mm.happiness = clampValue(mm.happiness+5, 0, 100);
        });
        let gain = Math.floor(p.mag * p.chr/40);
        v.mana = clampValue(v.mana+gain, 0, 99999);
        msg += `,男性幸福+5,魔素+${gain}`;
      }
      if (Math.random() < 0.5) {
        p.sexdr = clampValue(p.sexdr+1, 0, 100);
      }
      if (Math.random() < 0.5) {
        p.eth = clampValue(p.eth-1, 0, 100);
      }
      return msg + ")";
    }
  }

  static applySelfPower(p, v) {
    p.hp = clampValue(p.hp-20, 0, 100);
    if (p.bodySex === "女") {
      let men = v.villagers.filter(x => x.spiritSex === "男");
      men.forEach(mm => {
        mm.happiness = clampValue(mm.happiness+3, 0, 100);
      });
      let g = Math.floor(p.mag * p.chr/40);
      v.mana = clampValue(v.mana+g, 0, 99999);
      if (Math.random() < 0.5) {
        p.sexdr = clampValue(p.sexdr+1, 0, 100);
      }
      return `(自家発電[女]:体力-20,男性幸福+3,魔素+${g})`;
    }
    return "(自家発電[男]:体力-20,効果小)";
  }

  static maybeRaiseStat(p, stat, chance, amount = 1) {
    if (Math.random() < chance) {
      p[stat] = clampValue((p[stat] || 0) + amount, 0, 100);
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

  static applyPickup(p, v, targetSpiritSex) {
    p.mp = clampValue(p.mp + 10, 0, 100);
    const targets = v.villagers.filter(x => x !== p && x.spiritSex === targetSpiritSex);
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
    v.food = clampValue(v.food + gain, 0, 99999);
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
    v.food = clampValue(v.food + gain, 0, 99999);
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
    return `(飲酒:メンタル+20,幸福+10,治安-3${this.maybeRaiseStat(p, "cou", 0.2)})`;
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

  static applyHuntingHobby(p, v) {
    const gain = randInt(8, 16);
    p.hp = clampValue(p.hp - 8, 0, 100);
    v.food = clampValue(v.food + gain, 0, 99999);
    return `(ハンティング:体力-8,食料+${gain}${this.maybeRaiseStat(p, "cou", 0.25)}${this.maybeRaiseStat(p, "dex", 0.15)})`;
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
    const men = v.villagers.filter(x => x !== p && x.spiritSex === "男");
    men.forEach(mm => {
      mm.happiness = clampValue(mm.happiness + 2, 0, 100);
    });
    return `(ダンス:体力-5,幸福+12,男性幸福+2${this.maybeRaiseStat(p, "dex", 0.2)}${this.maybeRaiseStat(p, "chr", 0.2)})`;
  }
}
