import { clampValue } from "./util.js";

export class HobbyEffects {
  static apply(p, v) {
    let h = p.hobby;
    if (!h) return "";

    let msg = "";
    switch(h) {
      case "喧嘩": 
        msg = this.applyFighting(p, v);
        break;
      case "筋トレ":
        msg = this.applyTraining(p, v);
        break;
      case "ドカ食い":
        msg = this.applyEating(p, v);
        break;
      case "露出":
        msg = this.applyExposure(p, v);
        break;
      case "自家発電":
        msg = this.applySelfPower(p, v);
        break;
      default:
        msg = `(趣味[${h}]:追加効果なし)`;
        break;
    }
    return msg;
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
} 