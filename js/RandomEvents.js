// RandomEvents.js

import { randInt, clampValue, round3 } from "./util.js";
import { doLoverCheck, addRelationship as addCategorizedRelationship } from "./relationships.js";
import { doExchange } from "./exchange.js";
import { showRandomEventModal } from "./randomEventModal.js";
import { matureBodyToAdultOnly, scheduleGoldenRainPregnancy } from "./reproduction.js";
import { refreshJobTable } from "./domain/jobTables.js";
import {
  getChildlikeRandomEventLine,
  getDialogueLine,
  pickDialogueLine,
  resolveStoredSpeechType,
  selectRandomEventLineBySpeechType
} from "./dialogue/dialogueEngine.js";

import {
  EVENT_KIND_TABLE,
  EVENT_KIND_TITLES,
  EVENT_MOODS,
  EVENT_POOLS,
  EVENT_SECOND_LINE_BASES,
  EVENT_SUBJECTS,
  GOLDEN_RAIN_RACES
} from "./data/randomEventData.js";

const VILLAGER_STATE_KEYS = [
  "hp", "mp", "happiness",
  "str", "vit", "dex", "mag", "chr", "int", "ind", "eth", "cou", "sexdr",
  "bodyTraits", "mindTraits", "relationships", "hobby",
  "bodySex", "bodyAge", "bodyOwner", "race", "portraitFile"
];

function snapshotVillager(person) {
  return JSON.stringify(Object.fromEntries(VILLAGER_STATE_KEYS.map(key => [key, person[key]])));
}

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
    return new Map(village.villagers.map(p => [p, snapshotVillager(p)]));
  }

  static collectChangedVillagers(village, beforeState) {
    return village.villagers.filter(p => beforeState.get(p) !== snapshotVillager(p));
  }

  static getEventSubject(eventKey, kind) {
    if (EVENT_SUBJECTS[eventKey]) return EVENT_SUBJECTS[eventKey];
    if (kind === "mythic") return "神の祝福";
    if (kind === "good") return "良い出来事";
    return "悪い出来事";
  }

  static getEventMood(eventKey, kind) {
    if (EVENT_MOODS[eventKey]) return EVENT_MOODS[eventKey];
    if (kind === "mythic") return "mythic";
    return kind === "good" ? "happy" : "hardship";
  }

  static getSpeechType(character) {
    return resolveStoredSpeechType(character);
  }

  static getChildlikeEventLine(character, eventKey = null, kind = null) {
    const mood = eventKey ? this.getEventMood(eventKey, kind) : "default";
    return getChildlikeRandomEventLine(character, { eventKey, kind, mood });
  }

  static createEventLine(kind, character, eventKey) {
    return getDialogueLine({
      character,
      scene: "randomEvent",
      key: eventKey,
      context: {
        kind,
        subject: this.getEventSubject(eventKey, kind),
        mood: this.getEventMood(eventKey, kind)
      }
    }) || "...";
  }

  static getLineBySpeechType(group, speechType, character) {
    return selectRandomEventLineBySpeechType(group, speechType, character);
  }

  static resolveLineValue(value) {
    return pickDialogueLine(value);
  }

  static createSecondEventLine(eventKey, speechType, character) {
    return getDialogueLine({
      character,
      scene: "randomEventSecond",
      key: eventKey,
      context: {
        base: EVENT_SECOND_LINE_BASES[eventKey],
        speechType,
        mood: this.getEventMood(eventKey, null)
      }
    });
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
    if (!eventKey) return;
    if (this.shouldSuppressRandomEventAnnouncement(eventKey)) return;

    const changedVillagers = this.collectChangedVillagers(village, beforeState);
    const speakers = [...new Set([...changedVillagers, ...this._forcedSpeakers])];
    if (speakers.length === 0 && village.villagers.length > 0) {
      // 資源のみが変化したイベントでも代表者のセリフを表示
      const rep = this.randChoice(village.villagers);
      if (rep) speakers.push(rep);
    }
    const title = EVENT_SUBJECTS[eventKey] || EVENT_KIND_TITLES[kind] || "ランダムイベント";
    const message = logs.length > 0 ? logs.join("\n") : `${phase}ランダムイベントが発生しました。`;

    try {
      const participants = speakers
        .map(p => this.participant(p, this.createEventLine(kind, p, eventKey)));
      this.announce(title, message, participants);
    } catch (error) {
      console.error("Random event announcement failed", error);
      originalLog("ランダムイベント通知の表示に失敗しましたが、処理を継続します。");
    }
  }

  static shouldSuppressRandomEventAnnouncement(eventKey) {
    // doLoverCheck 側で恋人成立専用モーダルを出すため、汎用ランダムイベントモーダルは重ねない。
    return eventKey === "lover";
  }

  static chooseEventKind({ chanceMultiplier = 1 } = {}) {
    const multiplier = Number.isFinite(chanceMultiplier) ? Math.max(0, chanceMultiplier) : 1;
    const roll = Math.random() * 100;
    const match = EVENT_KIND_TABLE.find(item => roll < Math.min(100, item.maxRoll * multiplier));
    return match ? match.kind : null;
  }

  static runEventByKind(village, kind) {
    if (kind === "mythic") return this.doMythicEvent(village);
    if (kind === "good") return this.doGoodEvent(village);
    if (kind === "bad") return this.doBadEvent(village);
    return null;
  }

  /**
   * ランダムイベントを実行
   * @param {Village} v - 村オブジェクト
   * @param {string} phase - イベントフェーズ("前"/"後")
   * @param {{ chanceMultiplier?: number }} options - 発生率倍率
   */
  static execute(v, phase, options = {}) {
    const kind = this.chooseEventKind(options);
    if (kind) {
      this.runWithAnnouncement(v, phase, kind, () => this.runEventByKind(v, kind));
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
      if (p.bodySex === "女" &&
          Number(p.bodyAge) >= 16 &&
          Number(p.bodyAge) <= 29 &&
          Number(p.chr) >= 25 &&
          GOLDEN_RAIN_RACES.has(p.race || "人間") &&
          !p.pregnancy &&
          !p.bodyTraits.includes("妊娠") &&
          !p.bodyTraits.includes("臨月") &&
          !p.bodyTraits.includes("産褥")) {
        cands.push({ type: "goldenRain", vill: p });
      }
    });

    const growthPotionCandidates = v.villagers.filter(person => Number(person.bodyAge) <= 9);
    if (growthPotionCandidates.length > 0 && Math.random() < 0.2) {
      cands.push({ type: "strangeGrowthPotion", vill: this.randChoice(growthPotionCandidates) });
    }

    if (cands.length === 0) {
      return null;
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
      case "goldenRain":
        if (!scheduleGoldenRainPregnancy(v, p)) return null;
        this.addForcedSpeaker(p);
        break;
      case "strangeGrowthPotion": {
        const beforeAge = Number(p.bodyAge) || 0;
        if (!matureBodyToAdultOnly(p, v)) return null;
        this.addForcedSpeaker(p);
        v.log(`怪しい薬:${p.name}は怪しい薬を頭からかぶり、肉体だけが急成長した。肉体年齢${beforeAge}歳→16歳、肉体能力が潜在値まで成長`);
        break;
      }
    }
    return c.type;
  }

  /**
   * グッドイベント(24%)
   */
  static doGoodEvent(v) {
    let ev = this.randChoice(EVENT_POOLS.good);

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
      case "hotSpring": {
        const hpGain = 10;
        v.villagers.forEach(p => {
          p.hp = clampValue(p.hp + hpGain, 0, 100);
        });
        if (!v.buildingFlags) v.buildingFlags = {};
        v.buildingFlags.canBuildPublicBath = true;
        v.log(`秘湯発見:全員体力+${hpGain},公衆浴場建設解放`);
        break;
      }
      case "hobbyFriends": {
        const pairs = [];
        v.villagers.forEach((a, i) => {
          if (!a.hobby) return;
          v.villagers.slice(i + 1).forEach(b => {
            if (a.hobby !== b.hobby) return;
            const relA = `${a.hobby}仲間:${b.name}`;
            const relB = `${b.hobby}仲間:${a.name}`;
            if (a.relationships.includes(relA) && b.relationships.includes(relB)) return;
            pairs.push({ a, b, hobby: a.hobby, relA, relB });
          });
        });

        if (pairs.length > 0) {
          const pair = this.randChoice(pairs);
          pair.a.happiness = clampValue(pair.a.happiness + 10, 0, 100);
          pair.b.happiness = clampValue(pair.b.happiness + 10, 0, 100);
          this.addRelationship(pair.a, pair.relA);
          this.addRelationship(pair.b, pair.relB);
          v.log(`趣味仲間:${pair.a.name}と${pair.b.name}は${pair.hobby}の話で盛り上がった。幸福+10、${pair.hobby}の余暇メンタル回復1.5倍`);
        } else {
          return null;
        }
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
          v.log(`男の友情:${m1.name}と${m2.name}は夜通し語り合い、友情を深めた。幸福+${incc}`);
        } else {
          return null;
        }
        break;
      }
      case "lover": {
        if (!doLoverCheck(v)) {
          return null;
        }
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

          v.log(`百合イベント:${a.name}と${b.name}は互いに惹かれ合い、恋人になった。幸福+50`);
        } else {
          return null;
        }
        break;
      }
      case "tattoo": {
        let candidates = v.villagers.filter(x => 
          x.spiritSex === "男" &&
          x.bodyAge >= 12 &&
          x.spiritAge >= 16 &&
          x.eth <= 12 &&
          !x.bodyTraits.includes("刺青")
        );

        if (candidates.length > 0) {
          let a = this.randChoice(candidates);
          
          a.bodyTraits.push("刺青");
          a.chr += 1;
          a.happiness = clampValue(a.happiness + 20, 0, 100);

          v.log(`刺青イベント:${a.name}は刺青を入れ、新しい自分に少し胸を張った。魅力+1,幸福+20`);
        } else {
          return null;
        }
        break;
      }
      case "fashion": {
        let candidates = v.villagers.filter(x => 
          x.spiritSex === "男" &&
          x.bodySex === "女" &&
          x.bodyAge >= 12 && x.bodyAge <= 30 &&
          x.spiritAge >= 16 &&
          x.sexdr >= 20 &&
          x.hobby !== "オシャレ"
        );

        if (candidates.length > 0) {
          let a = this.randChoice(candidates);
          
          a.chr += 3;
          a.happiness = clampValue(a.happiness + 20, 0, 100);
          a.hobby = "オシャレ";

          v.log(`ファッションイベント:${a.name}は鏡の前で衣装を試し、気分が上がった。魅力+3,幸福+20,趣味:${a.hobby}`);
        } else {
          return null;
        }
        break;
      }
      case "muscle": {
        let candidates = v.villagers.filter(x => 
          x.spiritSex === "女" &&
          x.bodySex === "男" &&
          x.spiritAge >= 16 &&
          x.str >= 20 &&
          x.hobby !== "筋トレ"
        );

        if (candidates.length > 0) {
          let b = this.randChoice(candidates);
          
          b.str += 3;
          b.hobby = "筋トレ";

          v.log(`筋トレイベント:${b.name}は筋トレに打ち込むようになった。筋力+3,趣味:筋トレ`);
        } else {
          return null;
        }
        break;
      }
      case "selfPleasure": {
        let candidates = v.villagers.filter(x =>
          x.spiritSex === "男" &&
          x.bodySex === "女" &&
          x.spiritAge >= 16 &&
          x.bodyAge >= 12 &&
          x.bodyAge <= 30 &&
          x.chr >= 16 &&
          x.sexdr >= 20 &&
          x.hobby !== "自家発電"
        );

        if (candidates.length > 0) {
          let a = this.randChoice(candidates);

          v.mana = clampValue(v.mana + 20, 0, 99999);
          a.happiness = clampValue(a.happiness + 20, 0, 100);
          a.chr += 2;
          a.sexdr += 2;
          a.hobby = "自家発電";

          v.log(`${a.name}は自家発電にはまった。魔素+20,幸福+20,魅力+2,好色+2,趣味:自家発電`);
        } else {
          return null;
        }
        break;
      }
    }
    return ev;
  }

  static getCurrentSeason(village) {
    const traits = Array.isArray(village?.villageTraits) ? village.villageTraits : [];
    const season = ["春", "夏", "秋", "冬"].find(value => traits.includes(value));
    if (season) return season;

    const month = Number(village?.month) || 0;
    if ([3, 4, 5].includes(month)) return "春";
    if ([6, 7, 8].includes(month)) return "夏";
    if ([9, 10, 11].includes(month)) return "秋";
    if ([12, 1, 2].includes(month)) return "冬";
    return "";
  }

  static getBadEventWeight(eventKey, season) {
    switch (eventKey) {
      case "storm":
        return season === "春" ? 1 : 0;
      case "downpour":
        return season === "夏" || season === "秋" ? 1 : 0;
      case "heat":
        return season === "夏" ? 1 : 0;
      case "fire":
        return season === "冬" ? 2.5 : 1;
      case "lightning1":
      case "lightning2":
        return season === "夏" ? 2.5 : 1;
      case "snow":
        return season === "冬" || season === "春" ? 1 : 0;
      case "epidemic":
        return season === "冬" ? 0.35 : 0;
      default:
        return 1;
    }
  }

  static chooseWeightedEvent(entries) {
    const weighted = entries.filter(entry => entry.weight > 0);
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) return null;

    let roll = Math.random() * total;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) return entry.key;
    }
    return weighted[weighted.length - 1].key;
  }

  static chooseBadEvent(village) {
    const season = this.getCurrentSeason(village);
    return this.chooseWeightedEvent(EVENT_POOLS.bad.map(key => ({
      key,
      weight: this.getBadEventWeight(key, season)
    })));
  }

  /**
   * バッドイベント(15%)
   */
  static doBadEvent(v) {
    let ev = this.chooseBadEvent(v);
    if (!ev) return null;

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
          x.spiritAge >= 12 &&
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
          return null;
        }
        break;
      }
      case "drunk": {
        let candidates = v.villagers.filter(x => 
          x.spiritSex === "男" &&
          x.bodyAge >= 12 &&
          x.eth <= 14 &&
          x.spiritAge >= 16
        );

        if (candidates.length > 0) {
          let a = this.randChoice(candidates);
          this.addForcedSpeaker(a);
          
          v.security = clampValue(v.security - 12, 0, 100);

          v.log(`飲酒イベント:${a.name}は飲んだくれて騒ぎを起こした！ 治安-12`);
        } else {
          return null;
        }
        break;
      }
      case "epidemic": {
        const candidates = v.villagers.filter(x =>
          Array.isArray(x.bodyTraits) && !x.bodyTraits.includes("疫病")
        );

        if (candidates.length >= 2) {
          const pool = [...candidates];
          const count = Math.min(randInt(2, 3), pool.length);
          const infected = [];

          for (let i = 0; i < count; i++) {
            const index = randInt(0, pool.length - 1);
            const person = pool.splice(index, 1)[0];
            infected.push(person);

            person.bodyTraits.push("疫病");
            person.hp = clampValue(round3((Number(person.hp) || 0) * 0.5), 0, 100);
            person.str = round3((Number(person.str) || 0) * 0.5);
            person.vit = round3((Number(person.vit) || 0) * 0.5);
            person.dex = round3((Number(person.dex) || 0) * 0.5);
            refreshJobTable(person, v);
            this.addForcedSpeaker(person);
          }

          const villageTraits = Array.isArray(v.villageTraits) ? v.villageTraits : (v.villageTraits = []);
          if (!villageTraits.includes("疫病流行")) {
            villageTraits.push("疫病流行");
          }

          const names = infected.map(person => person.name).join("、");
          v.log(`疫病の流行:${names}が疫病に倒れた。体力・筋力・耐久・器用0.5倍`);
        } else {
          return null;
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
    addCategorizedRelationship(person, rel);
  }
} 
