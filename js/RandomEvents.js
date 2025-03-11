// RandomEvents.js

import { randInt, clampValue } from "./util.js";
import { doLoverCheck } from "./relationships.js";
import { doExchange } from "./raid.js";

/**
 * ランダムイベントを管理するクラス
 */
export class RandomEvents {
  /**
   * ランダムイベントを実行
   * @param {Village} v - 村オブジェクト
   * @param {string} phase - イベントフェーズ("前"/"後")
   */
  static execute(v, phase) {
    let r = randInt(1, 100);
    if (r <= 1) {
      this.doMythicEvent(v);
    } else if (r <= 25) {
      this.doGoodEvent(v);
    } else if (r <= 40) {
      this.doBadEvent(v);
    } else {
      v.log(`[${phase}イベント] 何も起こらず`);
    }
  }

  /**
   * ミシックイベント(1%)
   */
  static doMythicEvent(v) {
    let cands = [];
    v.villagers.forEach(p => {
      if (p.bodySex === "女" && p.bodyAge >= 16 && p.bodyAge <= 25 && p.sexdr <= 5) {
        cands.push({ type: "狩猟神", vill: p });
      }
      if (p.bodySex === "女" && p.bodyAge >= 16 && p.bodyAge <= 25 && p.chr >= 25) {
        cands.push({ type: "太陽神", vill: p });
      }
      if (p.bodySex === "女" && p.bodyAge >= 16 && p.bodyAge <= 28 && p.cou >= 20 && p.int >= 20) {
        cands.push({ type: "戦女神", vill: p });
      }
      if (p.bodySex === "女" && p.bodyAge >= 16 && p.bodyAge <= 28 && p.ind >= 20 && p.eth >= 20) {
        cands.push({ type: "地母神", vill: p });
      }
    });

    if (cands.length === 0) {
      v.log("ミシックイベ:該当者なし");
      return;
    }

    let c = this.randChoice(cands);
    let p = c.vill;
    switch (c.type) {
      case "狩猟神":
        p.bodyTraits.push("月の巫女");
        p.dex += 10; p.chr += 10;
        v.log(`${p.name}は狩女神の祝福を受けた！(器用+10,魅力+10)`);
        break;
      case "太陽神":
        p.bodyTraits.push("太陽の巫女");
        p.str += 15; p.chr += 5;
        v.log(`${p.name}は太陽神の寵愛を受けた！(筋力+15,魅力+5)`);
        break;
      case "戦女神":
        p.bodyTraits.push("梟の巫女");
        p.mag += 10; p.chr += 10;
        v.log(`${p.name}は戦女神の啓示を受けた！(魔力+10,魅力+10)`);
        break;
      case "地母神":
        p.bodyTraits.push("大地の巫女");
        p.vit += 10; p.chr += 10;
        v.log(`${p.name}は地母神の慈愛を受けた！(耐久+10,魅力+10)`);
        break;
    }
  }

  /**
   * グッドイベント(24%)
   */
  static doGoodEvent(v) {
    let pool = ["cat", "gold", "strangeRain", "fireworks", "menFriendship", "lover", "yuri", "tattoo", "fashion", "muscle"];
    let ev = this.randChoice(pool);

    switch (ev) {
      case "cat": {
        if (v.villagers.length > 0) {
          let t = this.randChoice(v.villagers);
          let inc = randInt(20, 30);
          t.happiness = clampValue(t.happiness + inc, 0, 100);
          v.log(`子猫イベント:${t.name}幸福+${inc}`);
        }
        break;
      }
      case "gold": {
        let amt = randInt(50, 100);
        v.funds = clampValue(v.funds + amt, 0, 99999);
        v.log(`金貨発見:資金+${amt}`);
        break;
      }
      case "strangeRain": {
        let amt = randInt(10, 60);
        v.food = clampValue(v.food + amt, 0, 99999);
        v.log(`空から魚が降り注いだ:食料+${amt}`);
        break;
      }
      case "fireworks": {
        let inc = randInt(5, 10);
        v.villagers.forEach(p => {
          p.happiness = clampValue(p.happiness + inc, 0, 100);
        });
        v.log(`花火師来訪:村全体幸福+${inc}`);
        break;
      }
      case "menFriendship": {
        let men = v.villagers.filter(x => x.spiritSex === "男" && x.bodyAge >= 16);
        if (men.length >= 2) {
          let m1 = this.randChoice(men);
          let m2 = this.randChoice(men.filter(x => x !== m1));
          let incc = randInt(10, 15);
          m1.happiness = clampValue(m1.happiness + incc, 0, 100);
          m2.happiness = clampValue(m2.happiness + incc, 0, 100);
          this.addRelationship(m1, `親友:${m2.name}`);
          this.addRelationship(m2, `親友:${m1.name}`);
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
      case "yuri": {
        let candidates = v.villagers.filter(x => 
          x.spiritSex === "男" &&
          x.bodySex === "女" &&
          x.bodyAge >= 12 && x.bodyAge <= 30 &&
          x.spiritAge >= 16 &&
          !x.relationships.some(r => r.includes("既婚") || r.includes("恋人"))
        );

        if (candidates.length >= 2) {
          let a = this.randChoice(candidates);
          let b = this.randChoice(candidates.filter(x => x !== a));

          a.happiness = clampValue(a.happiness + 50, 0, 100);
          b.happiness = clampValue(b.happiness + 50, 0, 100);

          this.addRelationship(a, `恋人:${b.name}`);
          this.addRelationship(b, `恋人:${a.name}`);

          v.log(`百合イベント:${a.name}と${b.name}は百合に目覚めた！ 幸福+50`);
        } else {
          v.log("百合イベント:条件を満たす村人が足りません");
        }
        break;
      }
      case "tattoo": {
        let candidates = v.villagers.filter(x => 
          x.spiritSex === "男" &&
          x.spiritAge >= 16 &&
          x.eth <= 12 &&
          !x.bodyTraits.includes("刺青")
        );

        if (candidates.length > 0) {
          let a = this.randChoice(candidates);
          
          a.bodyTraits.push("刺青");
          a.chr += 1;
          a.happiness = clampValue(a.happiness + 20, 0, 100);

          v.log(`刺青イベント:${a.name}は刺青を入れてみた！ 魅力+1,幸福+20`);
        } else {
          v.log("刺青イベント:条件を満たす村人がいません");
        }
        break;
      }
      case "fashion": {
        let candidates = v.villagers.filter(x => 
          x.spiritSex === "男" &&
          x.bodySex === "女" &&
          x.bodyAge >= 12 && x.bodyAge <= 30 &&
          x.spiritAge >= 16 &&
          x.sexdr >= 20
        );

        if (candidates.length > 0) {
          let a = this.randChoice(candidates);
          
          a.chr += 3;
          a.happiness = clampValue(a.happiness + 20, 0, 100);
          a.hobby = Math.random() < 0.5 ? "オシャレ" : "自家発電";

          v.log(`ファッションイベント:${a.name}は鏡の前でファッションショーを堪能した！ 魅力+3,幸福+20,趣味:${a.hobby}`);
        } else {
          v.log("ファッションイベント:条件を満たす村人がいません");
        }
        break;
      }
      case "muscle": {
        let candidates = v.villagers.filter(x => 
          x.spiritSex === "女" &&
          x.bodySex === "男" &&
          x.spiritAge >= 16 &&
          x.str >= 20
        );

        if (candidates.length > 0) {
          let b = this.randChoice(candidates);
          
          b.str += 3;
          b.hobby = "筋トレ";

          v.log(`筋トレイベント:${b.name}は筋トレにはまった！ 筋力+3,趣味:筋トレ`);
        } else {
          v.log("筋トレイベント:条件を満たす村人がいません");
        }
        break;
      }
    }
  }

  /**
   * バッドイベント(15%)
   */
  static doBadEvent(v) {
    let pool = ["storm", "downpour", "heat", "fire", "thief", "rats", "lightning1", "lightning2", "snow", "fight", "drunk"];
    let ev = this.randChoice(pool);

    switch (ev) {
      case "storm": {
        let loss = Math.floor(v.food * 0.1);
        v.food = clampValue(v.food - loss, 0, 99999);
        v.log(`春の嵐:食料-${loss}`);
        break;
      }
      case "downpour": {
        let loss = Math.floor(v.food * 0.1);
        v.food = clampValue(v.food - loss, 0, 99999);
        v.log(`豪雨:食料-${loss}`);
        break;
      }
      case "heat": {
        v.villagers.forEach(p => {
          p.hp = clampValue(p.hp - 10, 0, 100);
        });
        v.log("猛暑:全員体力-10");
        break;
      }
      case "fire": {
        let loss = Math.floor(v.materials * 0.1);
        v.materials = clampValue(v.materials - loss, 0, 99999);
        v.log(`ボヤ:資材-${loss}`);
        break;
      }
      case "thief": {
        let loss = Math.floor(v.funds * 0.1);
        v.funds = clampValue(v.funds - loss, 0, 99999);
        v.security = clampValue(v.security - 5, 0, 100);
        v.log(`窃盗団:資金-${loss},治安-5`);
        break;
      }
      case "rats": {
        let loss = Math.floor(v.food * 0.3);
        v.food = clampValue(v.food - loss, 0, 99999);
        v.log(`ネズミ大発生:食料-${loss}`);
        break;
      }
      case "lightning1": {
        if (v.villagers.length > 0) {
          let t = this.randChoice(v.villagers);
          t.hp = clampValue(t.hp - 50, 0, 100);
          t.bodyTraits.push("負傷");
          v.log(`落雷1:${t.name}体力-50,負傷`);
        }
        break;
      }
      case "lightning2": {
        if (v.villagers.length >= 2) {
          let a = this.randChoice(v.villagers);
          let b = this.randChoice(v.villagers.filter(x => x !== a));
          doExchange(a, b, v, true);
          v.log(`落雷2:${a.name}と${b.name}の肉体交換`);
        }
        break;
      }
      case "snow": {
        v.villagers.forEach(p => {
          p.hp = clampValue(p.hp - 5, 0, 100);
          p.mp = clampValue(p.mp - 5, 0, 100);
        });
        v.log("大雪:全員体力-5,メンタル-5");
        break;
      }
      case "fight": {
        let candidates = v.villagers.filter(x => 
          x.spiritSex === "男" &&
          x.eth <= 12
        );

        if (candidates.length >= 2) {
          let a = this.randChoice(candidates);
          let b = this.randChoice(candidates.filter(x => x !== a));

          a.hp = clampValue(a.hp - 20, 0, 100);
          b.hp = clampValue(b.hp - 20, 0, 100);

          v.security = clampValue(v.security - 12, 0, 100);

          this.addRelationship(a, `天敵:${b.name}`);
          this.addRelationship(b, `天敵:${a.name}`);

          v.log(`喧嘩イベント:${a.name}と${b.name}は殴り合いの大喧嘩をした！ 体力-20,治安-12`);
        } else {
          v.log("喧嘩イベント:条件を満たす村人が足りません");
        }
        break;
      }
      case "drunk": {
        let candidates = v.villagers.filter(x => 
          x.spiritSex === "男" &&
          x.eth <= 14 &&
          x.spiritAge >= 16
        );

        if (candidates.length > 0) {
          let a = this.randChoice(candidates);
          
          v.security = clampValue(v.security - 12, 0, 100);

          v.log(`飲酒イベント:${a.name}は飲んだくれて騒ぎを起こした！ 治安-12`);
        } else {
          v.log("飲酒イベント:条件を満たす村人がいません");
        }
        break;
      }
    }
  }

  /**
   * 配列からランダムに要素を選択
   */
  static randChoice(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * 人間関係を追加
   */
  static addRelationship(person, rel) {
    if (!person.relationships.includes(rel)) {
      person.relationships.push(rel);
    }
  }
} 