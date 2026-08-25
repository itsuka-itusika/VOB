// RandomEvents.js

import { randInt, clampValue, round3 } from "./util.js";
import { adjustMutualFriendship, areSiblings, doHitItOffEvent, doLoverCheck, addRelationship as addCategorizedRelationship, getFriendshipScore, getPairFriendshipMaximum, getPairFriendshipMinimum, isSingle, normalizeRelationship, parseRelationship, setFriendshipScore } from "./relationships.js";
import { canExchangeBody, doExchange } from "./exchange.js";
import { showRandomEventModal } from "./randomEventModal.js";
import { HobbyEffects } from "./HobbyEffects.js";
import {
  canReceiveGoldenRainPregnancy,
  createWolfFoundling,
  matureBodyToAdultOnly,
  scheduleGoldenRainPregnancy
} from "./reproduction.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { addStoredResource } from "./domain/resourceLimits.js";
import { hasActiveBuildingFlag } from "./domain/buildingState.js";
import { getActiveVillagers, getVillagersIncludingSaltPillar } from "./domain/apocalypseRules.js";
import { addAcquiredStat, syncEffectiveStats } from "./domain/statLayers.js";
import { recordEpidemicHistory, recordHobbyAwakeningHistory, recordLoverHistory, recordMythicEventHistory, recordSocialRelationHistory, recordVillagerJoinHistory } from "./history.js";
import { updateUI } from "./ui.js";
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
  SINGLE_SPEAKER_EVENTS
} from "./data/randomEventData.js";
import { WOLF_FOUNDLING_LINES } from "./data/dialogue/randomEventLines.js";

const VILLAGER_STATE_KEYS = [
  "hp", "mp", "happiness",
  "str", "vit", "dex", "mag", "chr", "int", "ind", "eth", "cou", "sexdr",
  "bodyTraits", "mindTraits", "relationships", "friendships", "friendshipStats", "hobby",
  "bodySex", "bodyAge", "bodyOwner", "race", "portraitFile"
];
const YURI_BLOCKING_RELATION_PREFIXES = ["天敵", "母", "父", "子", "夫", "妻", "恋人"];
const THUNDERBOLT_LOVE_BLOCKING_RELATION_PREFIXES = ["恋人", "夫", "妻", "母", "父", "子"];
const FIGHT_ALLOWED_RELATION_PREFIXES = new Set(["村設立の同志", "仕事仲間"]);

function hasMindTrait(person, trait) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.includes(trait);
}

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
    return new Map(getActiveVillagers(village).map(p => [p, snapshotVillager(p)]));
  }

  static collectChangedVillagers(village, beforeState) {
    return getActiveVillagers(village).filter(p => beforeState.get(p) !== snapshotVillager(p));
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

  static hasBuilding(village, flagName, buildingId) {
    return hasActiveBuildingFlag(village, flagName, buildingId);
  }

  static getSpeechType(character) {
    return resolveStoredSpeechType(character);
  }

  static getChildlikeEventLine(character, eventKey = null, kind = null) {
    const mood = eventKey ? this.getEventMood(eventKey, kind) : "default";
    return getChildlikeRandomEventLine(character, { eventKey, kind, mood });
  }

  static createEventLine(kind, character, eventKey, variantIndex = null) {
    return getDialogueLine({
      character,
      scene: "randomEvent",
      key: eventKey,
      context: {
        kind,
        subject: this.getEventSubject(eventKey, kind),
        mood: this.getEventMood(eventKey, kind),
        variantIndex
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
    if (!eventKey) return null;
    if (this.shouldSuppressRandomEventAnnouncement(eventKey)) return eventKey;

    const changedVillagers = this.collectChangedVillagers(village, beforeState);
    let speakers = [...new Set([...changedVillagers, ...this._forcedSpeakers])];
    if (speakers.length === 0 && getActiveVillagers(village).length > 0) {
      // 資源のみが変化したイベントでも代表者のセリフを表示
      const rep = this.randChoice(getActiveVillagers(village));
      if (rep) speakers.push(rep);
    }
    if (SINGLE_SPEAKER_EVENTS.has(eventKey) && speakers.length > 1) {
      speakers = [this.randChoice(speakers)];
    }
    const title = EVENT_SUBJECTS[eventKey] || EVENT_KIND_TITLES[kind] || "ランダムイベント";
    const message = logs.length > 0 ? logs.join("\n") : `${phase}ランダムイベントが発生しました。`;

    try {
      // 複数人が話すイベントでは、話者ごとに別の候補を割り当ててセリフの重複を避ける。
      const participants = speakers
        .map((p, index) => this.participant(
          p,
          this.createEventLine(kind, p, eventKey, speakers.length > 1 ? index : null)
        ));
      this.announce(title, message, participants);
    } catch (error) {
      console.error("Random event announcement failed", error);
      originalLog("ランダムイベント通知の表示に失敗しましたが、処理を継続します。");
    }
    return eventKey;
  }

  static shouldSuppressRandomEventAnnouncement(eventKey) {
    // doLoverCheck 側で恋人成立専用モーダルを出すため、汎用ランダムイベントモーダルは重ねない。
    return eventKey === "lover" || eventKey === "hitItOff" || eventKey === "wolfChild";
  }

  static chooseEventKind({ chanceMultiplier = 1 } = {}) {
    const multiplier = Number.isFinite(chanceMultiplier) ? Math.max(0, chanceMultiplier) : 1;
    const roll = Math.random() * 100;
    const match = EVENT_KIND_TABLE.find(item => roll < Math.min(100, item.maxRoll * multiplier));
    return match ? match.kind : null;
  }

  static runEventByKind(village, kind) {
    if (kind === "mythic") return this.doMythicEvent(village);
    if (kind === "good" || kind === "bad") return this.runPooledEvent(village, kind);
    return null;
  }

  /**
   * 抽選で選んだイベントが条件を満たさず不発だった場合、その種類を除いて引き直す。
   * 不発の分岐はいずれも副作用の前に抜けるため、引き直しても二重に適用されない。
   */
  static runPooledEvent(village, kind) {
    const excluded = new Set();
    const poolSize = (EVENT_POOLS[kind] || []).length;
    for (let attempt = 0; attempt < poolSize; attempt++) {
      const eventKey = kind === "good"
        ? this.chooseGoodEvent(excluded)
        : this.chooseBadEvent(village, excluded);
      if (!eventKey) return null;
      excluded.add(eventKey);
      const result = kind === "good"
        ? this.doGoodEvent(village, eventKey)
        : this.doBadEvent(village, eventKey);
      if (result) return result;
    }
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
    const eventKey = kind
      ? this.runWithAnnouncement(v, phase, kind, () => this.runEventByKind(v, kind))
      : null;
    if (!eventKey) {
      v.log(`[${phase}イベント] 何も起こらず`);
    }
  }

  /**
   * 突然の恋の候補ペアを列挙する。
   * 本人は独り身で精神年齢12以上、相手は近親や伴侶でなく、本人から見た好感度がまだ低い者に限る。
   */
  static collectThunderboltLovePairs(v) {
    const villagers = getActiveVillagers(v);
    const pairs = [];
    villagers.forEach(a => {
      if (!isSingle(a) || Number(a.spiritAge) < 12) return;
      villagers.forEach(b => {
        if (a === b) return;
        if (b.bodySex === a.spiritSex) return;
        if (Number(b.bodyAge) < 16) return;
        if (getFriendshipScore(a, b) > 19) return;
        if (this.hasPairRelationship(a, b, THUNDERBOLT_LOVE_BLOCKING_RELATION_PREFIXES)) return;
        if (areSiblings(a, b)) return;
        pairs.push([a, b]);
      });
    });
    return pairs;
  }

  /**
   * ミシックイベント(1%)
   */
  static doMythicEvent(v) {
    let cands = [];
    const mythicVillagers = getActiveVillagers(v).filter(p => (p.race || "人間") === "人間");
    mythicVillagers.forEach(p => {
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

    // 黄金の雨は巫女系と違い、人間に限らず人型種族へ起こる。
    getActiveVillagers(v).forEach(p => {
      if (Number(p.chr) >= 25 && canReceiveGoldenRainPregnancy(p)) {
        cands.push({ type: "goldenRain", vill: p });
      }
    });

    // 怪しい薬は巫女系と違い、狼以外の全種族が対象。
    const growthPotionCandidates = getActiveVillagers(v)
      .filter(person => (person.race || "人間") !== "狼" && Number(person.bodyAge) <= 9);
    if (growthPotionCandidates.length > 0 && Math.random() < 0.2) {
      cands.push({ type: "strangeGrowthPotion", vill: this.randChoice(growthPotionCandidates) });
    }

    // 突然の恋は2人組で成立するため、成立し得る組を1つだけ候補に載せる。
    const thunderboltLovePairs = this.collectThunderboltLovePairs(v);
    if (thunderboltLovePairs.length > 0) {
      const [lover, beloved] = this.randChoice(thunderboltLovePairs);
      cands.push({ type: "thunderboltLove", vill: lover, target: beloved });
    }

    if (cands.length === 0) {
      return null;
    }

    let c = this.randChoice(cands);
    let p = c.vill;
    switch (c.type) {
      case "狩猟神":
        p.bodyTraits.push("月の巫女");
        syncEffectiveStats(p);
        v.log(`${p.name}は狩女神の祝福を受けた！(器用+10,魅力+10)`);
        break;
      case "太陽神":
        p.bodyTraits.push("太陽の巫女");
        syncEffectiveStats(p);
        v.log(`${p.name}は太陽神の寵愛を受けた！(筋力+15,魅力+5)`);
        break;
      case "戦女神":
        p.bodyTraits.push("梟の巫女");
        syncEffectiveStats(p);
        v.log(`${p.name}は戦女神の啓示を受けた！(魔力+10,魅力+10)`);
        break;
      case "地母神":
        p.bodyTraits.push("大地の巫女");
        syncEffectiveStats(p);
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
      case "thunderboltLove": {
        setFriendshipScore(p, c.target, 59);
        v.log(`突然の恋:${p.name}は心臓を射貫かれたような衝撃を受け恋に落ちた。${c.target.name}への好感度が59になった`);
        break;
      }
    }
    recordMythicEventHistory(v, c.type, p, {
      subject: EVENT_SUBJECTS[c.type],
      text: c.type === "thunderboltLove"
        ? `${p.name}は${c.target.name}に心臓を射貫かれ、一目で恋に落ちた。`
        : undefined
    });
    return c.type;
  }

  /**
   * グッドイベント(24%)
   */
  static doGoodEvent(v, eventKey = null) {
    let ev = eventKey || this.chooseGoodEvent();

    switch (ev) {
      case "wolfChild": {
        if (v.villagers.some(person => person.race === "狼")) return null;

        // 姿を見せてから選ばせるため、村へ迎える前に子狼を作る。森へ返す場合は破棄する。
        const wolf = createWolfFoundling(v);
        v.log("狼の子供が村に迷い込んできた。");
        showRandomEventModal({
          title: "狼の子供",
          message: "森の端から、まだ幼い狼の子供が一匹、村へ迷い込んできました。どうしますか？",
          closeOnOverlay: false,
          participants: [this.participant(wolf, this.resolveLineValue(WOLF_FOUNDLING_LINES))],
          actions: [
            {
              label: "村で飼う",
              onSelect: () => {
                v.villagers.push(wolf);
                recordVillagerJoinHistory(v, wolf, { source: "保護" });
                v.log(`${wolf.name}（0歳の狼）を村で飼うことにした。`);
                updateUI(v);
              }
            },
            {
              label: "森に返す",
              onSelect: () => {
                v.log("狼の子供を森へ返した。");
              }
            }
          ]
        });
        break;
      }
      case "cat": {
        if (getActiveVillagers(v).length > 0) {
          let t = this.randChoice(getActiveVillagers(v));
          let inc = randInt(20, 30);
          t.happiness = clampValue(t.happiness + inc, 0, 100);
          v.log(`猫との出会い:${t.name}幸福+${inc}`);
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
        addStoredResource(v, "food", amt);
        v.log(`空から魚が降り注いだ:食料+${amt}`);
        break;
      }
      case "fireworks": {
        let inc = randInt(5, 10);
        getActiveVillagers(v).forEach(p => {
          p.happiness = clampValue(p.happiness + inc, 0, 100);
        });
        v.log(`花火師来訪:村全体幸福+${inc}`);
        break;
      }
      case "hotSpring": {
        const hpGain = 10;
        getActiveVillagers(v).forEach(p => {
          p.hp = clampValue(p.hp + hpGain, 0, 100);
        });
        if (!v.buildingFlags) v.buildingFlags = {};
        v.buildingFlags.canBuildPublicBath = true;
        v.log(`秘湯発見:全員体力+${hpGain},公衆浴場建設解放`);
        break;
      }
      case "bathPerk": {
        if (!this.hasBuilding(v, "hasPublicBath", "publicBath")) {
          return null;
        }

        const candidates = getActiveVillagers(v).filter(person =>
          Number(person.eth) <= 14 &&
          Number(person.sexdr) >= 20 &&
          person.bodySex === "女" &&
          person.spiritSex === "男" &&
          Number(person.spiritAge) >= 12 &&
          !hasMindTrait(person, "野生")
        );

        if (candidates.length === 0) {
          return null;
        }

        const person = this.randChoice(candidates);
        v.security = clampValue(v.security - 5, 0, 100);
        person.happiness = clampValue(person.happiness + 30, 0, 100);
        person.mp = clampValue(person.mp + 20, 0, 100);
        if (!person.mindTraits.includes("風呂好き")) {
          person.mindTraits.push("風呂好き");
        }
        this.addForcedSpeaker(person);
        v.log(`${person.name}は長風呂を楽しんだ`);
        break;
      }
      case "hobbyFriends": {
        const pairs = [];
        getActiveVillagers(v).forEach((a, i) => {
          if (!a.hobby) return;
          getActiveVillagers(v).slice(i + 1).forEach(b => {
            if (a.hobby !== b.hobby) return;
            const relA = `${a.hobby}仲間:${b.name}`;
            const relB = `${b.hobby}仲間:${a.name}`;
            if (getPairFriendshipMinimum(a, b) < 0) return;
            if (this.hasPairRelationship(a, b, ["天敵", `${a.hobby}仲間`])) return;
            pairs.push({ a, b, hobby: a.hobby, relA, relB });
          });
        });

        if (pairs.length > 0) {
          const pair = this.randChoice(pairs);
          pair.a.happiness = clampValue(pair.a.happiness + 10, 0, 100);
          pair.b.happiness = clampValue(pair.b.happiness + 10, 0, 100);
          adjustMutualFriendship(pair.a, pair.b, 30);
          this.addRelationship(pair.a, pair.relA);
          this.addRelationship(pair.b, pair.relB);
          recordSocialRelationHistory(v, pair.a, pair.b, "趣味仲間", { hobby: pair.hobby });
          v.log(`趣味仲間:${pair.a.name}と${pair.b.name}は${pair.hobby}の話で盛り上がった。幸福+10、好感度+30、${pair.hobby}の余暇メンタル回復1.5倍`);
        } else {
          return null;
        }
        break;
      }
      case "thaw": {
        const villagers = getActiveVillagers(v);
        const pairs = [];
        villagers.forEach((a, index) => {
          villagers.slice(index + 1).forEach(b => {
            if (getPairFriendshipMaximum(a, b) <= -30) pairs.push([a, b]);
          });
        });
        if (pairs.length === 0) {
          return null;
        }

        const [a, b] = this.randChoice(pairs);
        adjustMutualFriendship(a, b, 30);
        this.addForcedSpeaker(a);
        this.addForcedSpeaker(b);
        v.log(`雪解け:${a.name}と${b.name}のわだかまりがほどけた。好感度+30`);
        break;
      }
      case "menFriendship": {
        let men = getActiveVillagers(v).filter(x => x.spiritSex === "男" && x.bodyAge >= 16);
        const pairs = [];
        men.forEach((a, index) => {
          men.slice(index + 1).forEach(b => {
            if (getPairFriendshipMinimum(a, b) >= 10 && !this.hasPairRelationship(a, b, ["天敵", "親友"])) pairs.push([a, b]);
          });
        });
        if (pairs.length > 0) {
          let [m1, m2] = this.randChoice(pairs);
          let incc = randInt(10, 15);
          m1.happiness = clampValue(m1.happiness + incc, 0, 100);
          m2.happiness = clampValue(m2.happiness + incc, 0, 100);
          const friendship = adjustMutualFriendship(m1, m2, 30);
          if (friendship >= 50) {
            this.addRelationship(m1, `親友:${m2.name}`);
            this.addRelationship(m2, `親友:${m1.name}`);
            recordSocialRelationHistory(v, m1, m2, "親友");
          }
          v.log(`男の友情:${m1.name}と${m2.name}は夜通し語り合い、友情を深めた。幸福+${incc},好感度+30`);
        } else {
          return null;
        }
        break;
      }
      case "lover": {
        if (!doLoverCheck(v, { source: "ランダムイベント" })) {
          return null;
        }
        break;
      }
      case "hitItOff": {
        if (!doHitItOffEvent(v)) {
          return null;
        }
        break;
      }
      case "yuri": {
        let candidates = getActiveVillagers(v).filter(x =>
          x.spiritSex === "男" &&
          x.bodySex === "女" &&
          x.bodyAge >= 12 && x.bodyAge <= 30 &&
          x.spiritAge >= 16 &&
          !hasMindTrait(x, "神聖") &&
          isSingle(x)
        );

        if (candidates.length >= 2) {
          const pairs = [];
          candidates.forEach((a, index) => {
            candidates.slice(index + 1).forEach(b => {
              if (getPairFriendshipMinimum(a, b) >= 20 && !this.hasPairRelationship(a, b, YURI_BLOCKING_RELATION_PREFIXES)) pairs.push([a, b]);
            });
          });

          if (pairs.length === 0) {
            return null;
          }

          let [a, b] = this.randChoice(pairs);

          a.happiness = clampValue(a.happiness + 50, 0, 100);
          b.happiness = clampValue(b.happiness + 50, 0, 100);
          adjustMutualFriendship(a, b, 30);

          this.addRelationship(a, `恋人:${b.name}`);
          this.addRelationship(b, `恋人:${a.name}`);
          recordLoverHistory(v, a, b, { source: "百合の恋" });

          v.log(`百合イベント:${a.name}と${b.name}は互いに惹かれ合い、恋人になった。幸福+50`);
        } else {
          return null;
        }
        break;
      }
      case "tattoo": {
        let candidates = getActiveVillagers(v).filter(x =>
          x.spiritSex === "男" &&
          x.bodyAge >= 12 &&
          x.spiritAge >= 16 &&
          x.eth <= 12 &&
          !hasMindTrait(x, "野生") &&
          !this.hasBodyTrait(x, "刺青")
        );

        if (candidates.length > 0) {
          let a = this.randChoice(candidates);

          a.bodyTraits.push("刺青");
          addAcquiredStat(a, "chr", 1);
          a.happiness = clampValue(a.happiness + 20, 0, 100);

          v.log(`刺青イベント:${a.name}は刺青を入れ、新しい自分に少し胸を張った。魅力+1,幸福+20`);
        } else {
          return null;
        }
        break;
      }
      case "fashion": {
        let candidates = getActiveVillagers(v).filter(x =>
          x.spiritSex === "男" &&
          x.bodySex === "女" &&
          x.bodyAge >= 12 && x.bodyAge <= 30 &&
          x.spiritAge >= 16 &&
          x.sexdr >= 20 &&
          !hasMindTrait(x, "野生") &&
          !this.hasHobby(x, "オシャレ")
        );

        if (candidates.length > 0) {
          let a = this.randChoice(candidates);

          addAcquiredStat(a, "chr", 3);
          a.happiness = clampValue(a.happiness + 20, 0, 100);
          a.hobby = "オシャレ";
          recordHobbyAwakeningHistory(v, a, "オシャレ");

          v.log(`ファッションイベント:${a.name}は鏡の前で衣装を試し、気分が上がった。魅力+3,幸福+20,趣味:${a.hobby}`);
        } else {
          return null;
        }
        break;
      }
      case "muscle": {
        let candidates = getActiveVillagers(v).filter(x =>
          x.spiritSex === "女" &&
          x.bodySex === "男" &&
          x.spiritAge >= 16 &&
          x.str >= 20 &&
          !this.hasHobby(x, "筋トレ")
        );

        if (candidates.length > 0) {
          let b = this.randChoice(candidates);

          addAcquiredStat(b, "str", 3);
          b.hobby = "筋トレ";
          recordHobbyAwakeningHistory(v, b, "筋トレ");

          v.log(`筋トレイベント:${b.name}は筋トレに打ち込むようになった。筋力+3,趣味:筋トレ`);
        } else {
          return null;
        }
        break;
      }
      case "pickup": {
        const rules = HobbyEffects.getPickupRules("ナンパ");
        const candidates = getActiveVillagers(v).filter(a => {
          if (a.spiritSex !== "男" || Number(a.spiritAge) < 16) return false;
          // 相手がいる者は、より強い好色と低い倫理でなければ声をかけない。
          const meetsDesire = isSingle(a)
            ? Number(a.sexdr) >= 18
            : Number(a.sexdr) >= 20 && Number(a.eth) <= 14;
          return meetsDesire && HobbyEffects.hasPickupTarget(a, v, rules);
        });
        if (candidates.length === 0) return null;

        const a = this.randChoice(candidates);
        v.log(`ナンパイベント:${a.name}${HobbyEffects.applyPickup(a, v, rules)}`);
        this.addForcedSpeaker(a);
        break;
      }
      case "selfPleasure": {
        let candidates = getActiveVillagers(v).filter(x =>
          x.spiritSex === "男" &&
          x.bodySex === "女" &&
          x.spiritAge >= 16 &&
          x.bodyAge >= 12 &&
          x.bodyAge <= 30 &&
          x.chr >= 16 &&
          x.sexdr >= 20 &&
          !this.hasHobby(x, "自家発電")
        );

        if (candidates.length > 0) {
          let a = this.randChoice(candidates);

          v.mana = clampValue(v.mana + 20, 0, 99999);
          a.happiness = clampValue(a.happiness + 20, 0, 100);
          addAcquiredStat(a, "chr", 2);
          addAcquiredStat(a, "sexdr", 2);
          a.hobby = "自家発電";
          recordHobbyAwakeningHistory(v, a, "自家発電");

          v.log(`${a.name}は自家発電にはまった。魔素+20,幸福+20,魅力+2,好色+2,趣味:自家発電`);
        } else {
          return null;
        }
        break;
      }
    }
    return ev;
  }

  static chooseGoodEvent(excluded = null) {
    const events = excluded && excluded.size > 0
      ? EVENT_POOLS.good.filter(key => !excluded.has(key))
      : EVENT_POOLS.good;
    if (events.length === 0) return null;
    const otherEvents = events.filter(key => key !== "lover");
    if (!events.includes("lover") || otherEvents.length === 0) {
      return this.randChoice(events);
    }

    // 通常の均等抽選（1 / events.length）に対し、「恋の気配」だけを正確に2倍にする。
    const loverChance = Math.min(1, 2 / events.length);
    const roll = Math.random();
    if (roll < loverChance) return "lover";

    const otherIndex = Math.min(
      otherEvents.length - 1,
      Math.floor(((roll - loverChance) / (1 - loverChance)) * otherEvents.length)
    );
    return otherEvents[otherIndex];
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

  static chooseBadEvent(village, excluded = null) {
    const season = this.getCurrentSeason(village);
    return this.chooseWeightedEvent(EVENT_POOLS.bad
      .filter(key => !excluded || !excluded.has(key))
      .map(key => ({
        key,
        weight: this.getBadEventWeight(key, season)
      })));
  }

  /**
   * バッドイベント(15%)
   */
  static doBadEvent(v, eventKey = null) {
    let ev = eventKey || this.chooseBadEvent(v);
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
        getActiveVillagers(v).forEach(p => {
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
        v.log(`盗賊団:資金-${loss},治安-5`);
        break;
      }
      case "rats": {
        let loss = Math.floor(v.food * 0.3);
        v.food = clampValue(v.food - loss, 0, 99999);
        v.log(`ネズミ大発生:食料-${loss}`);
        break;
      }
      case "lightning1": {
        if (getActiveVillagers(v).length > 0) {
          let t = this.randChoice(getActiveVillagers(v));
          t.hp = clampValue(t.hp - 50, 0, 100);
          if (!t.bodyTraits.includes("負傷")) t.bodyTraits.push("負傷");
          v.log(`落雷1:${t.name}体力-50,負傷`);
        }
        break;
      }
      case "lightning2": {
        const candidates = getVillagersIncludingSaltPillar(v).filter(canExchangeBody);
        if (candidates.length >= 2) {
          let a = this.randChoice(candidates);
          let b = this.randChoice(candidates.filter(x => x !== a));
          doExchange(a, b, v, true);
          v.log(`落雷2:${a.name}と${b.name}の肉体交換`);
        }
        break;
      }
      case "snow": {
        getActiveVillagers(v).forEach(p => {
          p.hp = clampValue(p.hp - 5, 0, 100);
          p.mp = clampValue(p.mp - 5, 0, 100);
        });
        v.log("大雪:全員体力-5,メンタル-5");
        break;
      }
      case "fight": {
        let candidates = getActiveVillagers(v).filter(x =>
          x.spiritAge >= 12 &&
          (x.eth <= 14 || (x.eth <= 18 && x.mp <= 40))
        );

        const pairs = [];
        candidates.forEach((a, index) => {
          candidates.slice(index + 1).forEach(b => {
            if (a.spiritSex === b.spiritSex &&
                getPairFriendshipMinimum(a, b) <= 19 &&
                !this.hasMutualRelationship(a, b, "天敵") &&
                !this.hasFightBlockingRelationship(a, b)) {
              pairs.push([a, b]);
            }
          });
        });

        if (pairs.length > 0) {
          let [a, b] = this.randChoice(pairs);

          a.hp = clampValue(a.hp - 20, 0, 100);
          b.hp = clampValue(b.hp - 20, 0, 100);

          v.security = clampValue(v.security - 12, 0, 100);

          const friendship = adjustMutualFriendship(a, b, -30);
          let friendshipLoss = 30;
          if (friendship <= -1) {
            this.addRelationship(a, `天敵:${b.name}`);
            this.addRelationship(b, `天敵:${a.name}`);
            adjustMutualFriendship(a, b, -30);
            friendshipLoss += 30;
            recordSocialRelationHistory(v, a, b, "天敵");
          }

          v.log(`喧嘩イベント:${a.name}と${b.name}は殴り合いの大喧嘩をした！ 体力-20,治安-12,好感度-${friendshipLoss}`);
        } else {
          return null;
        }
        break;
      }
      case "loverArgument": {
        const villagers = getActiveVillagers(v);
        const pairs = [];
        villagers.forEach((a, index) => {
          villagers.slice(index + 1).forEach(b => {
            if (this.hasMutualRelationship(a, b, "恋人")) {
              pairs.push([a, b]);
            }
          });
        });
        if (pairs.length === 0) {
          return null;
        }

        const [a, b] = this.randChoice(pairs);
        adjustMutualFriendship(a, b, -20);
        this.addForcedSpeaker(a);
        this.addForcedSpeaker(b);
        v.log(`痴話喧嘩:${a.name}と${b.name}は言葉をぶつけ合った。好感度-20`);
        break;
      }
      case "argument": {
        const pairs = [];
        getActiveVillagers(v).forEach((a, index) => {
          getActiveVillagers(v).slice(index + 1).forEach(b => {
            pairs.push([a, b]);
          });
        });
        if (pairs.length === 0) {
          return null;
        }

        const [a, b] = this.randChoice(pairs);
        const friendship = adjustMutualFriendship(a, b, -20);
        let friendshipLoss = 20;
        if (friendship <= -1 && !this.hasMutualRelationship(a, b, "天敵")) {
          this.addRelationship(a, `天敵:${b.name}`);
          this.addRelationship(b, `天敵:${a.name}`);
          adjustMutualFriendship(a, b, -30);
          friendshipLoss += 30;
          recordSocialRelationHistory(v, a, b, "天敵");
        }
        a.happiness = clampValue(a.happiness - 10, 0, 100);
        b.happiness = clampValue(b.happiness - 10, 0, 100);
        this.addForcedSpeaker(a);
        this.addForcedSpeaker(b);
        v.log(`言い争い:${a.name}と${b.name}は言葉をぶつけ合った。好感度-${friendshipLoss},幸福-10`);
        break;
      }
      case "drunk": {
        let candidates = getActiveVillagers(v).filter(x =>
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
        const candidates = getActiveVillagers(v).filter(x =>
          Array.isArray(x.bodyTraits) && !x.bodyTraits.includes("疫病")
        );

        if (candidates.length > 0) {
          const person = this.randChoice(candidates);

          person.bodyTraits.push("疫病");
          person.hp = clampValue(round3((Number(person.hp) || 0) * 0.5), 0, 100);
          syncEffectiveStats(person);
          refreshJobTable(person, v);
          recordEpidemicHistory(v, person, { source: "疫病の流行" });
          this.addForcedSpeaker(person);

          const villageTraits = Array.isArray(v.villageTraits) ? v.villageTraits : (v.villageTraits = []);
          if (!villageTraits.includes("疫病流行")) {
            villageTraits.push("疫病流行");
          }

          v.log(`疫病の流行:${person.name}が疫病に倒れた。体力・筋力・耐久・器用0.5倍`);
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

  static hasRelationship(person, rel) {
    if (!person || !Array.isArray(person.relationships)) return false;
    const normalized = normalizeRelationship(rel);
    return person.relationships.some(existing => normalizeRelationship(existing) === normalized);
  }

  static hasMutualRelationship(a, b, prefix) {
    return this.hasRelationship(a, `${prefix}:${b.name}`) &&
      this.hasRelationship(b, `${prefix}:${a.name}`);
  }

  static hasRelationshipTo(person, target, prefixes) {
    if (!person || !target?.name || !Array.isArray(person.relationships)) return false;
    return person.relationships.some(existing => {
      const parsed = parseRelationship(normalizeRelationship(existing));
      return parsed?.target === target.name && prefixes.includes(parsed.prefix);
    });
  }

  static hasPairRelationship(a, b, prefixes) {
    return this.hasRelationshipTo(a, b, prefixes) ||
      this.hasRelationshipTo(b, a, prefixes);
  }

  static getPairRelationshipPrefixes(a, b) {
    const prefixes = [];
    [
      [a, b],
      [b, a]
    ].forEach(([person, target]) => {
      if (!person || !target?.name || !Array.isArray(person.relationships)) return;
      person.relationships.forEach(existing => {
        const parsed = parseRelationship(normalizeRelationship(existing));
        if (parsed?.target === target.name) prefixes.push(parsed.prefix);
      });
    });
    return [...new Set(prefixes)];
  }

  static isFightAllowedRelationshipPrefix(prefix) {
    return FIGHT_ALLOWED_RELATION_PREFIXES.has(prefix) || String(prefix || "").endsWith("仲間");
  }

  static hasFightBlockingRelationship(a, b) {
    return this.getPairRelationshipPrefixes(a, b).some(prefix =>
      prefix !== "天敵" && !this.isFightAllowedRelationshipPrefix(prefix)
    );
  }

  static hasHobby(person, hobby) {
    return String(person?.hobby || "") === hobby;
  }

  static hasBodyTrait(person, trait) {
    return Array.isArray(person?.bodyTraits) && person.bodyTraits.includes(trait);
  }

  /**
   * 人間関係を追加
   */
  static addRelationship(person, rel) {
    addCategorizedRelationship(person, rel);
  }
}
