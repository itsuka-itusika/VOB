// classes.js

import { createStatMap, STAT_LAYER_VERSION } from "./domain/statLayers.js";

/**
 * VillageクラスとVillagerクラス
 * - データ構造を持つクラス
 * - ゲームロジックは他ファイルへ分割
 */

export class Village {
  constructor() {
    this.year = 1091;
    this.month = 4;

    this.food = 200;
    this.materials = 120;
    this.funds = 0;
    this.mana = 40;
    this.tech = 0;
    this.security = 60;
    this.building = 0;
    this.heresy = 0;
    this.scaleTitleStage = 0;
    this.lastHeadmanElectionYear = null;
    this.nextHeadmanElectionYear = null;

    this.villagers = [];
    this.pendingGoldenRainPregnancies = [];
    this.popLimit = 8;
    this.villageTraits = ["春"];
    this.secretTreasures = [];

    this.logs = [];
    this.historyEvents = [];
    this.gameOver = false;
    this.hasDonePreEvent = false;
    this.hasDonePostEvent = false;

    // 襲撃イベント用フラグ/データ
    this.raidEnemies = [];
    this.currentRaid = null;
    this.monthsSinceRaid = 0;
    this.raidCooldown = 0;
    this.pendingRaid = null;
    this.isRaidProcessDone = false;
    this.isRaidFinalizing = false;
    this.raidTurnCount = 0;
    this.raidActionQueue = [];
    this.raidPhase = "";
    this.currentActionIndex = 0;

    // 訪問者配列を追加
    this.visitors = [];
    this.visitorLimit = 1;

    // 建築物配列を追加
    this.buildings = [];
    // 建築物フラグを追加
    this.buildingFlags = {};

    // ソート状態の保存
    this.tableSort = {
      column: null,
      isAsc: true
    };

    // 各種モーダルの状態
    this.modalStates = {
      miracle: false,
      building: false,
      secretTreasure: false,
      conversation: false,
      exchange: false,
      raid: false
    };
  }

  /**
   * ログ出力(配列保管＋DOMへの追記)
   */
  log(msg) {
    this.logs.push(msg);
    const la = document.getElementById("logArea");
    if (la) {
      la.innerHTML += `<div>${msg}</div>`;
      la.scrollTop = la.scrollHeight;
    }
    console.log(msg);
  }
}

export class Villager {
  constructor(name, bodySex, bodyAge) {
    /** 基本情報 */
    this.name = name;
    // 肉体側の識別子。精神側の spiritSex/spiritAge とは統合しない。
    this.bodySex = bodySex;
    this.bodyAge = bodyAge;
    this.race = "人間";  // 種族パラメータを追加

    this.hp = 100;
    this.mp = 100;
    this.happiness = 50;

    this.baseStats = createStatMap(10);
    this.acquiredStatMods = createStatMap(0);
    this.statLayerVersion = STAT_LAYER_VERSION;

    /** 肉体パラメーター（実効値キャッシュ） */
    this.str = 10;
    this.vit = 10;
    this.dex = 10;
    this.mag = 10;
    this.chr = 10;

    /** 精神パラメーター（実効値キャッシュ） */
    this.int = 10;
    this.ind = 10;
    this.eth = 10;
    this.cou = 10;
    this.sexdr = 10;

    /** 精神情報(魂側)。bodyAge/bodySex とは別軸のゲーム仕様。 */
    this.spiritAge = bodyAge;
    this.spiritSex = bodySex;

    /** 特性や趣味 */
    this.bodyTraits = [];
    this.mindTraits = [];
    this.hobby = "";

    /** 人間関係(文字列格納) */
    this.relationships = [];
    this.socialAttemptedThisMonth = false;
    this.titleIds = [];
    this.titleStats = {};

    /** 行動割り当て関連 */
    // preferredAction は通常時の復帰先。job は旧セーブ・旧コード互換の別名として同期する。
    this.preferredAction = "なし";
    this.job = "なし";
    this.jobTable = [];
    this.assignmentLocked = false;

    /** 今月実行する行動 */
    this.action = "なし";
    this.actionTable = [];

    /** この肉体の元の持ち主 */
    this.bodyOwner = name;
    // アレス変数を初期化（戦神の加護効果期間管理用）
    this.ares = 0;
    // ニケ効果期間管理用
    this.nikeMonths = 0;
    // 肖像効果期間・倫理低下量管理用
    this.portraitMonths = 0;
    this.portraitEthLoss = 0;

    /** 顔グラフィックのファイル名 */
    this.portraitFile = "default.png";

    /** 口調タイプ */
    this.speechType = "";

    /** 妊娠・出産・成長関連 */
    this.pregnancy = null;
    this.postpartumMonths = 0;
    this.potentialStats = null;
    this.bodyPotentialStats = null;
    this.mindPotentialStats = null;
    this.adultBodyTraits = [];
    this.adultMindTraits = [];
    this.adultHobby = "";
    this.adultPortraitFile = "";
    this.toddlerPortraitFile = "";
    this.toddlerPortraitGroup = "";
    this.childMindTrait = "";
    this.adultBodyReached = false;
    this.adultMindReached = false;
    this.adultModalShown = false;
  }

  setPortrait(portraitFile) {
    // setPortraitメソッドを削除または無効化
    // 代わりに直接設定を使用
    this.portraitFile = portraitFile;
  }
}
