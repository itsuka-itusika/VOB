// classes.js

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
    this.fame = 0;
    this.tech = 0;
    this.security = 60;
    this.building = 0;

    this.villagers = [];
    this.popLimit = 6;
    this.villageTraits = ["春"];

    this.logs = [];
    this.gameOver = false;
    this.hasDonePreEvent = false;
    this.hasDonePostEvent = false;

    // 襲撃イベント用フラグ/データ
    this.raidEnemies = [];
    this.isRaidProcessDone = false;
    this.raidTurnCount = 0;
    this.raidActionQueue = [];
    this.currentActionIndex = 0;

    // 訪問者配列を追加
    this.visitors = [];

    // 建築物配列を追加
    this.buildings = [];

    // ソート状態の保存
    this.tableSort = {
      column: null,
      isAsc: true
    };

    // 各種モーダルの状態
    this.modalStates = {
      miracle: false,
      building: false,
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
    this.bodySex = bodySex;
    this.bodyAge = bodyAge;
    this.race = "人間";  // 種族パラメータを追加

    this.hp = 100;
    this.mp = 100;
    this.happiness = 50;

    /** 肉体パラメーター */
    this.str = 10;
    this.vit = 10;
    this.dex = 10;
    this.mag = 10;
    this.chr = 10;

    /** 精神パラメーター */
    this.int = 10;
    this.ind = 10;
    this.eth = 10;
    this.cou = 10;
    this.sexdr = 10;

    /** 精神情報(魂側) */
    this.spiritAge = bodyAge;
    this.spiritSex = bodySex;

    /** 特性や趣味 */
    this.bodyTraits = [];
    this.mindTraits = [];
    this.hobby = "";

    /** 人間関係(文字列格納) */
    this.relationships = [];

    /** 仕事関連 */
    this.job = "休養";
    this.jobTable = [];

    /** 行動関連 */
    this.action = "休養";
    this.actionTable = [];

    /** この肉体の元の持ち主 */
    this.bodyOwner = name;
    // アレス変数を初期化（戦神の加護効果期間管理用）
    this.ares = 0;

    /** 顔グラフィックのファイル名 */
    this.portraitFile = "DEFAULT.png";

    /** 口調タイプ */
    this.speechType = "";
  }

  setPortrait(portraitFile) {
    // setPortraitメソッドを削除または無効化
    // 代わりに直接設定を使用
    this.portraitFile = portraitFile;
  }
}
