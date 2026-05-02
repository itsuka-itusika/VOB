// RandomEvents.js

import { randInt, clampValue } from "./util.js";
import { doLoverCheck } from "./relationships.js";
import { doExchange } from "./exchange.js";
import { showRandomEventModal } from "./randomEventModal.js";

/**
 * ランダムイベントを管理するクラス
 */
export class RandomEvents {
  static _forcedSpeakers = [];

  static announce(title, message, participants = []) {
    showRandomEventModal({ title, message, participants });
  }

  static participant(character, line) {
    return { character, line };
  }

  static captureVillagerState(village) {
    return new Map(village.villagers.map(p => [p, JSON.stringify({
      hp: p.hp,
      mp: p.mp,
      happiness: p.happiness,
      str: p.str,
      vit: p.vit,
      dex: p.dex,
      mag: p.mag,
      chr: p.chr,
      int: p.int,
      ind: p.ind,
      eth: p.eth,
      cou: p.cou,
      sexdr: p.sexdr,
      bodyTraits: p.bodyTraits,
      mindTraits: p.mindTraits,
      relationships: p.relationships,
      hobby: p.hobby,
      bodySex: p.bodySex,
      bodyAge: p.bodyAge,
      bodyOwner: p.bodyOwner,
      race: p.race,
      portraitFile: p.portraitFile
    })]));
  }

  static collectChangedVillagers(village, beforeState) {
    return village.villagers.filter(p => beforeState.get(p) !== JSON.stringify({
      hp: p.hp,
      mp: p.mp,
      happiness: p.happiness,
      str: p.str,
      vit: p.vit,
      dex: p.dex,
      mag: p.mag,
      chr: p.chr,
      int: p.int,
      ind: p.ind,
      eth: p.eth,
      cou: p.cou,
      sexdr: p.sexdr,
      bodyTraits: p.bodyTraits,
      mindTraits: p.mindTraits,
      relationships: p.relationships,
      hobby: p.hobby,
      bodySex: p.bodySex,
      bodyAge: p.bodyAge,
      bodyOwner: p.bodyOwner,
      race: p.race,
      portraitFile: p.portraitFile
    }));
  }

  static createEventLine(kind) {
    if (kind === "mythic") return "……いまのは、ただごとではなかった。";
    if (kind === "good") return "少し、村の空気が明るくなった気がする。";
    return "これは放っておけないな……。";
  }

  static getEventSubject(eventKey, kind) {
    const subjects = {
      "狩猟神": "狩女神の祝福",
      "太陽神": "太陽神の寵愛",
      "戦女神": "戦女神の啓示",
      "地母神": "地母神の慈愛",
      cat: "猫との出会い",
      gold: "金貨の発見",
      strangeRain: "不思議な雨",
      fireworks: "花火師の来訪",
      menFriendship: "男同士の友情",
      lover: "恋の気配",
      yuri: "百合の恋",
      tattoo: "刺青",
      fashion: "ファッションショー",
      muscle: "筋トレ",
      storm: "春の嵐",
      downpour: "豪雨",
      heat: "猛暑",
      fire: "ボヤ",
      thief: "盗賊団",
      rats: "ネズミの大発生",
      lightning1: "落雷",
      lightning2: "落雷による肉体交換",
      snow: "大雪",
      fight: "喧嘩",
      drunk: "飲酒騒ぎ"
    };

    if (subjects[eventKey]) return subjects[eventKey];
    if (kind === "mythic") return "神の祝福";
    if (kind === "good") return "良い出来事";
    return "悪い出来事";
  }

  static getEventMood(eventKey, kind) {
    const moods = {
      "狩猟神": "mythic",
      "太陽神": "mythic",
      "戦女神": "mythic",
      "地母神": "mythic",
      cat: "happy",
      gold: "gain",
      strangeRain: "gain",
      fireworks: "happy",
      menFriendship: "friendship",
      lover: "romance",
      yuri: "romance",
      tattoo: "selfChange",
      fashion: "selfChange",
      muscle: "selfChange",
      storm: "loss",
      downpour: "loss",
      heat: "hardship",
      fire: "loss",
      thief: "threat",
      rats: "loss",
      lightning1: "injury",
      lightning2: "shock",
      snow: "hardship",
      fight: "conflict",
      drunk: "conflict"
    };

    if (moods[eventKey]) return moods[eventKey];
    if (kind === "mythic") return "mythic";
    return kind === "good" ? "happy" : "hardship";
  }

  static getSpeechStyle(character) {
    const spiritSex = character.spiritSex || character.bodySex || "女";
    const speechType = character.speechType || (spiritSex === "男" ? "普通Ｍ" : "普通Ｆ");
    const mindTraits = Array.isArray(character.mindTraits) ? character.mindTraits : [];

    // conversation.js の口調分類をベースに、精神特性で補正
    if (speechType.includes("丁寧") || speechType === "お嬢様" || mindTraits.some(t => ["善人", "マジメ", "優等生", "古風"].includes(t))) return "polite";
    if (speechType.includes("クール") || speechType === "中性的" || mindTraits.some(t => ["独善的", "策士", "現実主義", "計算高い"].includes(t))) return "cool";
    if (["乱暴", "蓮っ葉", "強気Ｍ", "強気Ｆ"].includes(speechType) || mindTraits.some(t => ["強気", "怒りっぽい", "粗暴", "好戦的"].includes(t))) return "bold";
    if (["陰気", "内気"].includes(speechType) || mindTraits.some(t => ["内向的", "臆病", "根暗", "無気力"].includes(t))) return "shy";
    if (["お調子者", "快活", "ギャル風", "ぶりっこ"].includes(speechType) || mindTraits.some(t => ["おしゃべり", "好奇心旺盛", "チャラい", "問題児"].includes(t))) return "bright";
    return spiritSex === "男" ? "male" : "female";
  }

  static createEventLine(kind, character, eventKey) {
    const subject = this.getEventSubject(eventKey, kind);
    const mood = this.getEventMood(eventKey, kind);
    const style = this.getSpeechStyle(character);
    const lines = {
      mythic: {
        polite: `${subject}……これは、軽々しく語ってよい出来事ではありませんね。`,
        cool: `${subject}か。記録しておく価値はありそうだ。`,
        bold: `${subject}だと？ すげえな、体が熱くなるぜ！`,
        shy: `${subject}……こ、怖いけど、少しだけ綺麗でした……`,
        bright: `${subject}ってすごいね！ なんだか特別な日になったよ！`,
        male: `${subject}か……ただごとじゃなかったな。`,
        female: `${subject}……不思議なこともあるものですね。`
      },
      happy: {
        polite: `${subject}のおかげで、村の空気が少し和らぎましたね。`,
        cool: `${subject}か。悪くない結果だ。`,
        bold: `${subject}だ！ こういう景気のいい話は歓迎だな！`,
        shy: `${subject}……少し、うれしいです。`,
        bright: `${subject}だよ！ 今日はいい日になりそう！`,
        male: `${subject}か。少し気分が明るくなるな。`,
        female: `${subject}ですね。村が明るくなった気がします。`
      },
      gain: {
        polite: `${subject}はありがたいですね。大切に使いましょう。`,
        cool: `${subject}で余裕ができた。使い道は考えるべきだな。`,
        bold: `${subject}だ！ これで一息つけるな！`,
        shy: `${subject}……む、無駄にしないようにします。`,
        bright: `${subject}だって！ ちょっと得した気分！`,
        male: `${subject}は助かるな。`,
        female: `${subject}は助かりますね。`
      },
      friendship: {
        polite: `${subject}ですか。人の縁は村の力になりますね。`,
        cool: `${subject}か。信頼関係は実利にもなる。`,
        bold: `${subject}だな！ 仲間ってのはいいもんだ！`,
        shy: `${subject}……仲良くできるの、うらやましいです。`,
        bright: `${subject}っていいね！ みんなで飲みたい気分！`,
        male: `${subject}か。悪くないな。`,
        female: `${subject}ですね。少し微笑ましいです。`
      },
      romance: {
        polite: `${subject}……そっと見守るのがよさそうですね。`,
        cool: `${subject}か。感情の動きは予測しづらいな。`,
        bold: `${subject}だと？ ははっ、熱いじゃないか！`,
        shy: `${subject}……な、なんだか照れます……`,
        bright: `${subject}だよ！ きゃー、いい感じじゃない？`,
        male: `${subject}か。人の心は不思議だな。`,
        female: `${subject}ですね。少し胸が騒ぎます。`
      },
      selfChange: {
        polite: `${subject}ですか。新しい自分を試すのも悪くありませんね。`,
        cool: `${subject}か。変化が能力に出るなら意味はある。`,
        bold: `${subject}だ！ もっと派手にやってやろうぜ！`,
        shy: `${subject}……ちょっと恥ずかしいけど、変われるなら……`,
        bright: `${subject}だよ！ なんか楽しくなってきた！`,
        male: `${subject}か。気分転換にはなるな。`,
        female: `${subject}ですね。少し新鮮な気持ちです。`
      },
      loss: {
        polite: `${subject}の被害は痛いですね。早めに立て直しましょう。`,
        cool: `${subject}か。損失を計算して次に備えるべきだ。`,
        bold: `${subject}だと？ くそ、すぐ取り返すぞ！`,
        shy: `${subject}……こ、困りましたね……`,
        bright: `${subject}は大変だけど、まだなんとかなるよ！`,
        male: `${subject}は痛いな。対策しないと。`,
        female: `${subject}は困りますね。備えが必要です。`
      },
      hardship: {
        polite: `${subject}は体に堪えますね。無理は禁物です。`,
        cool: `${subject}か。消耗を抑えて動こう。`,
        bold: `${subject}くらいでへばってられないな！`,
        shy: `${subject}……今日は休んだ方がいいかも……`,
        bright: `${subject}はきついけど、がんばって乗り切ろう！`,
        male: `${subject}はこたえるな。`,
        female: `${subject}はつらいですね。`
      },
      threat: {
        polite: `${subject}とは物騒ですね。警戒を強めましょう。`,
        cool: `${subject}か。治安の低下は見過ごせない。`,
        bold: `${subject}だと？ 見つけたらただじゃおかない！`,
        shy: `${subject}……こ、怖いです……戸締まりします。`,
        bright: `${subject}！？ みんな、気をつけようね！`,
        male: `${subject}か。警戒が必要だな。`,
        female: `${subject}なんて、物騒ですね。`
      },
      injury: {
        polite: `${subject}で負傷者が出ました。すぐ手当てを。`,
        cool: `${subject}か。被害者の治療を優先しよう。`,
        bold: `${subject}だと？ すぐ助けに行くぞ！`,
        shy: `${subject}……だ、大丈夫でしょうか……`,
        bright: `${subject}！？ 早く手当てしなきゃ！`,
        male: `${subject}で怪我か。放っておけないな。`,
        female: `${subject}で怪我なんて……手当てしましょう。`
      },
      shock: {
        polite: `${subject}……常識では測れない出来事ですね。`,
        cool: `${subject}か。状況確認を急ぐべきだ。`,
        bold: `${subject}だと！？ 何がどうなってるんだ！`,
        shy: `${subject}……え、えっと、私たち大丈夫ですか……？`,
        bright: `${subject}！？ びっくりした、すごいことになってる！`,
        male: `${subject}だと？ 混乱するな。`,
        female: `${subject}なんて……驚きました。`
      },
      conflict: {
        polite: `${subject}はよくありませんね。落ち着いて話し合いましょう。`,
        cool: `${subject}か。感情的な衝突は損失が大きい。`,
        bold: `${subject}だと？ 暴れるなら外でやれってんだ！`,
        shy: `${subject}……け、喧嘩は苦手です……`,
        bright: `${subject}はだめだよ！ みんな落ち着いて！`,
        male: `${subject}か。仲裁が要りそうだ。`,
        female: `${subject}は困りますね。止めないと。`
      }
    };

    const group = lines[mood] || lines[kind] || lines.happy;
    const spiritSex = character.spiritSex || character.bodySex || "女";
    return group[style] || group[spiritSex === "男" ? "male" : "female"] || group.female;
  }

  static addForcedSpeaker(character) {
    if (!character) return;
    if (!Array.isArray(this._forcedSpeakers)) this._forcedSpeakers = [];
    if (!this._forcedSpeakers.includes(character)) {
      this._forcedSpeakers.push(character);
    }
  }

  static runWithAnnouncement(village, phase, kind, runEvent) {
    const beforeState = this.captureVillagerState(village);
    const originalLog = village.log.bind(village);
    const logs = [];
    this._forcedSpeakers = [];

    village.log = (msg) => {
      logs.push(String(msg));
      originalLog(msg);
    };

    let eventKey = null;
    try {
      eventKey = runEvent();
    } finally {
      village.log = originalLog;
    }

    const changedVillagers = this.collectChangedVillagers(village, beforeState);
    const speakers = [...new Set([...changedVillagers, ...this._forcedSpeakers])];
    const participants = speakers
      .map(p => this.participant(p, this.createEventLine(kind, p, eventKey)));
    const title = kind === "mythic" ? "神秘的なランダムイベント" :
      kind === "good" ? "良いランダムイベント" : "悪いランダムイベント";
    const message = logs.length > 0 ? logs.join("\n") : `${phase}ランダムイベントが発生しました。`;

    this.announce(title, message, participants);
  }

  /**
   * ランダムイベントを実行
   * @param {Village} v - 村オブジェクト
   * @param {string} phase - イベントフェーズ("前"/"後")
   */
  static execute(v, phase) {
    let r = randInt(1, 100);
    if (r <= 1) {
      this.runWithAnnouncement(v, phase, "mythic", () => this.doMythicEvent(v));
    } else if (r <= 25) {
      this.runWithAnnouncement(v, phase, "good", () => this.doGoodEvent(v));
    } else if (r <= 40) {
      this.runWithAnnouncement(v, phase, "bad", () => this.doBadEvent(v));
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
      if (p.bodySex === "女" && p.bodyAge >= 16 && p.bodyAge <= 25 && p.sexdr <= 5 && 
          !p.bodyTraits.includes("月の巫女")) {
        cands.push({ type: "狩猟神", vill: p });
      }
      if (p.bodySex === "女" && p.bodyAge >= 16 && p.bodyAge <= 25 && p.chr >= 25 && 
          !p.bodyTraits.includes("太陽の巫女")) {
        cands.push({ type: "太陽神", vill: p });
      }
      if (p.bodySex === "女" && p.bodyAge >= 16 && p.bodyAge <= 28 && p.cou >= 20 && p.int >= 20 && 
          !p.bodyTraits.includes("梟の巫女")) {
        cands.push({ type: "戦女神", vill: p });
      }
      if (p.bodySex === "女" && p.bodyAge >= 16 && p.bodyAge <= 28 && p.ind >= 20 && p.eth >= 20 && 
          !p.bodyTraits.includes("大地の巫女")) {
        cands.push({ type: "地母神", vill: p });
      }
    });

    if (cands.length === 0) {
      v.log("ミシックイベ:該当者なし");
      return "mythic_none";
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
    return c.type;
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
    return ev;
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
          this.addForcedSpeaker(a);
          
          v.security = clampValue(v.security - 12, 0, 100);

          v.log(`飲酒イベント:${a.name}は飲んだくれて騒ぎを起こした！ 治安-12`);
        } else {
          v.log("飲酒イベント:条件を満たす村人がいません");
        }
        break;
      }
    }
    return ev;
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
