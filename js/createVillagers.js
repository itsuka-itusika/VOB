// createVillagers.js

import { Villager } from "./classes.js";
import { randInt, randChoice, randNormalInRange } from "./util.js";
import { ACTION_NONE, refreshJobTable, setPreferredAction } from "./domain/jobTables.js";
import { isOriginalBodyPortrait, rememberCurrentPortrait } from "./domain/portraitHistory.js";
import {
  ALSEID_PORTRAIT_FILES,
  ARACHNID_PORTRAIT_FILES,
  DRYAD_PORTRAIT_FILES,
  EQUINA_PORTRAIT_FILES,
  MAENAD_PORTRAIT_FILES,
  NEREID_PORTRAIT_FILES,
  SATYR_PORTRAIT_FILES,
  WINGED_PORTRAIT_FILES,
  getPortraitGroupKey,
  normalizePortraitKey
} from "./data/portraitPaths.js";
import { applyGenerationBaseTraitBonuses, setBaseStatsFromEffective, syncEffectiveStats } from "./domain/statLayers.js";
import { PHYSICAL_ABILITY_STATS } from "./domain/personSchema.js";
import { getVillageScaleStage } from "./villageScale.js";
import { initializeFoundingFriendships } from "./relationships.js";
import {
  FEMALE_PORTRAIT_FILES,
  MALE_PORTRAIT_FILES,
  SPEECH_TYPE_MAPPING,
  TODDLER_PORTRAIT_FILES,
  VISITOR_TYPES
} from "./data/villagerData.js";
import { MERCHANT_SECRET_TREASURE_CHANCE } from "./secretTreasureEvents.js";
export { MALE_PORTRAIT_FILES, TODDLER_PORTRAIT_FILES } from "./data/villagerData.js";

/**
 * 初期村人の人数設定
 */
const INITIAL_MALE_COUNT = 3;   // 初期男性の人数
const INITIAL_FEMALE_COUNT = 3; // 初期女性の人数

const VISITOR_TABLES_BY_SCALE = [
  {
    maxStageIndex: 1,
    entries: [
      { type: "流民", weight: 35 },
      { type: "旅人", weight: 30 },
      { type: "巡礼者", weight: 15 },
      { type: "行商人", weight: 15 },
      { type: "棄民", weight: 5 }
    ]
  },
  {
    maxStageIndex: 4,
    entries: [
      { type: "流民", weight: 20 },
      { type: "旅人", weight: 16 },
      { type: "棄民", weight: 5 },
      { type: "巡礼者", weight: 15 },
      { type: "行商人", weight: 15 },
      { type: "冒険者", weight: 12 },
      { type: "学者", weight: 12 },
      { type: "レア種族", weight: 5 },
      { type: "エクイナ", weight: 5 }
    ]
  },
  {
    maxStageIndex: Infinity,
    // 将来的にお忍び5、遍歴騎士5を追加予定。現時点では未実装のため現行タイプだけで抽選する。
    entries: [
      { type: "流民", weight: 15 },
      { type: "旅人", weight: 10 },
      { type: "棄民", weight: 5 },
      { type: "観光客", weight: 10 },
      { type: "巡礼者", weight: 15 },
      { type: "行商人", weight: 15 },
      { type: "冒険者", weight: 15 },
      { type: "学者", weight: 15 },
      { type: "レア種族", weight: 10 },
      { type: "エクイナ", weight: 10 },
      { type: "サテュロス", weight: 5 },
      { type: "メナド", weight: 5 }
    ]
  }
];

const RARE_VISITOR_TYPE = "レア種族";
const RARE_VISITOR_TYPES = [
  {
    type: "翼人",
    weight: 2,
    implemented: true,
    visitor: {
      type: "翼人",
      displayType: "旅人",
      forcedSex: "女",
      ageRange: { min: 18, max: 25 },
      params: {
        job: "旅人",
        action: "訪問",
        race: "翼人"
      },
      ranges: {
        int: [10, 20],
        ind: [10, 20],
        cou: [8, 20],
        eth: [20, 30],
        sexdr: [3, 8]
      },
      forcedBodyTraits: ["飛行", "光輪"],
      forcedMindTraits: ["神聖"],
      chanceMindTraits: [{ trait: "非戦主義", chance: 0.5 }],
      portraits: WINGED_PORTRAIT_FILES
    }
  },
  {
    type: "アルセイド",
    weight: 2,
    implemented: true,
    visitor: {
      type: "アルセイド",
      displayType: "旅人",
      forcedSex: "女",
      ageRange: { min: 18, max: 25 },
      params: {
        job: "旅人",
        action: "訪問",
        race: "アルセイド"
      },
      ranges: {
        str: [5, 20],
        vit: [5, 20],
        chr: [18, 27],
        mag: [18, 27],
        int: [5, 25],
        ind: [5, 20],
        cou: [3, 25],
        eth: [12, 25],
        sexdr: [3, 15]
      },
      forcedBodyTraits: ["緑の指", "不老"],
      forcedMindTraits: ["文明忌避"],
      chanceMindTraits: [{ trait: "非戦主義", chance: 0.5 }],
      portraits: ALSEID_PORTRAIT_FILES
    }
  },
  {
    type: "ネレイド",
    weight: 2,
    implemented: true,
    visitor: {
      type: "ネレイド",
      displayType: "旅人",
      forcedSex: "女",
      ageRange: { min: 18, max: 25 },
      params: {
        job: "旅人",
        action: "訪問",
        race: "ネレイド"
      },
      ranges: {
        str: [5, 20],
        vit: [5, 20],
        chr: [18, 27],
        mag: [18, 27],
        int: [5, 20],
        cou: [3, 14]
      },
      forcedBodyTraits: ["水中呼吸", "不老"],
      chanceMindTraits: [{ trait: "非戦主義", chance: 0.5 }],
      portraits: NEREID_PORTRAIT_FILES
    }
  },
  {
    type: "ドライアド",
    weight: 1,
    implemented: true,
    visitor: {
      type: "ドライアド",
      displayType: "旅人",
      forcedSex: "女",
      ageRange: { min: 18, max: 25 },
      params: {
        job: "旅人",
        action: "訪問",
        race: "ドライアド"
      },
      ranges: {
        str: [5, 20],
        vit: [5, 20],
        chr: [18, 27],
        mag: [20, 30],
        int: [5, 16],
        ind: [5, 16],
        eth: [12, 20],
        cou: [12, 16],
        sexdr: [3, 8]
      },
      forcedBodyTraits: ["緑の指", "光合成"],
      forcedMindTraits: ["不殺"],
      portraits: DRYAD_PORTRAIT_FILES
    }
  },
  {
    type: "アラクニド",
    weight: 1,
    implemented: true,
    uniqueRace: true,
    visitor: {
      type: "アラクニド",
      displayType: "旅人",
      forcedSex: "女",
      ageRange: { min: 18, max: 28 },
      params: {
        job: "旅人",
        action: "訪問",
        race: "アラクニド"
      },
      ranges: {
        int: [5, 16],
        ind: [5, 16],
        eth: [5, 18],
        dex: [18, 25]
      },
      forcedBodyTraits: ["糸吐き"],
      portraits: ARACHNID_PORTRAIT_FILES
    }
  }
];

const EQUINA_VISITOR_TYPE = {
  type: "エクイナ",
  displayTypes: [
    { type: "行商人", weight: 50 },
    { type: "流民", weight: 30 },
    { type: "旅人", weight: 20 }
  ],
  useDisplayTypeAsJob: true,
  forcedSex: "女",
  ageRange: { min: 18, max: 25 },
  params: {
    job: "旅人",
    action: "訪問",
    race: "エクイナ"
  },
  ranges: {
    str: [11, 25],
    vit: [11, 25],
    dex: [11, 25],
    mag: [15, 27],
    chr: [18, 27],
    int: [5, 20],
    ind: [5, 20],
    eth: [8, 20],
    cou: [11, 25],
    sexdr: [8, 25]
  },
  forcedBodyTraits: ["健脚"],
  portraits: EQUINA_PORTRAIT_FILES
};

const GOAT_PAIR_DISPLAY_TYPES = [
  { type: "吟遊詩人", weight: 50 },
  { type: "巡礼者", weight: 50 }
];

const SATYR_VISITOR_TYPE = {
  type: "サテュロス",
  displayTypes: GOAT_PAIR_DISPLAY_TYPES,
  useDisplayTypeAsJob: true,
  forcedSex: "男",
  ageRange: { min: 18, max: 28 },
  params: {
    job: "旅人",
    action: "訪問",
    race: "サテュロス"
  },
  ranges: {
    mag: [11, 25],
    chr: [15, 25],
    int: [5, 25],
    ind: [5, 18],
    eth: [5, 18],
    cou: [8, 30],
    sexdr: [18, 30]
  },
  forcedBodyTraits: ["通る声", "山羊角"],
  portraits: SATYR_PORTRAIT_FILES,
  rareVisitorType: "サテュロス"
};

const MAENAD_VISITOR_TYPE = {
  type: "メナド",
  displayTypes: GOAT_PAIR_DISPLAY_TYPES,
  useDisplayTypeAsJob: true,
  forcedSex: "女",
  ageRange: { min: 16, max: 25 },
  params: {
    job: "旅人",
    action: "訪問",
    race: "メナド"
  },
  ranges: {
    mag: [20, 27],
    chr: [20, 27],
    int: [5, 25],
    ind: [5, 18],
    eth: [8, 18],
    cou: [3, 25],
    sexdr: [15, 25]
  },
  forcedBodyTraits: ["澄んだ声", "山羊角"],
  portraits: MAENAD_PORTRAIT_FILES,
  rareVisitorType: "メナド"
};

const GOAT_PAIR_VISITOR_TYPES = new Map([
  [SATYR_VISITOR_TYPE.type, SATYR_VISITOR_TYPE],
  [MAENAD_VISITOR_TYPE.type, MAENAD_VISITOR_TYPE]
]);

// 使用済みの名前を追跡する Set を追加
const usedNames = new Set();
const NO_AGING_BODY_TRAITS = new Set(["光輪", "不老", "光合成"]);
const NO_AGING_RACES = new Set(["翼人", "アルセイド", "ネレイド", "ドライアド"]);

export function registerUsedName(name) {
  const normalized = String(name || "").trim();
  if (normalized) usedNames.add(normalized);
}

function getReservedNames(extraNames = []) {
  return new Set([
    ...usedNames,
    ...Array.from(extraNames || []).map(name => String(name || "").trim()).filter(Boolean)
  ]);
}

function buildFallbackChildName(baseName, reservedNames) {
  const base = String(baseName || "").trim() || "誰か";
  for (let i = 1; i <= 9999; i++) {
    const suffix = String(i).padStart(2, "0");
    const candidate = `${base}の子${suffix}`;
    if (!reservedNames.has(candidate)) return candidate;
  }
  return `${base}の子${Date.now()}`;
}

// 使用済みの顔グラフィックを追跡するSetを追加
export const usedPortraits = {
  male: new Set(),
  female: new Set()
};

// 顔グラフィックのファイル名リストを上部に移動し、グループ分けを明確に

// 顔グラフィックのファイル名リストに女性用を追加

/**
 * 性別と能力値に応じて顔グラフィックを選択
 */

function getPortraitGroupKeyFromFile(portraitFile) {
  const groupKey = getPortraitGroupKey(normalizePortraitKey(portraitFile));
  return TODDLER_PORTRAIT_FILES[groupKey] ? groupKey : "";
}

function hasNoAgingBodyTrait(v) {
  return NO_AGING_RACES.has(v?.race)
    || (Array.isArray(v?.bodyTraits) && v.bodyTraits.some(trait => NO_AGING_BODY_TRAITS.has(trait)));
}

function getFallbackToddlerPortraitGroup(character) {
  if ((character.bodySex || character.spiritSex) === "男") {
    if (character.chr >= 15) return "MC";
    if (character.chr <= 14 && character.vit >= 15) return "MD";
    if (character.chr <= 14 && character.vit <= 14) return "ME";
    return "ME";
  }
  return "D";
}

export function selectToddlerPortraitByCharacter(character) {
  const groupKey =
    character.toddlerPortraitGroup ||
    getPortraitGroupKeyFromFile(character.adultPortraitFile) ||
    getFallbackToddlerPortraitGroup(character);
  const portraits = TODDLER_PORTRAIT_FILES[groupKey] || TODDLER_PORTRAIT_FILES.D;
  character.toddlerPortraitGroup = groupKey;
  return randChoice(portraits);
}

export function selectPortraitByCharacter(character) {
  // グループから選択する前に、使用可能な顔グラフィックをフィルタリング
  const filterUnusedPortraits = (portraitList) => {
    return portraitList.filter(portrait => !usedPortraits[character.bodySex === "男" ? "male" : "female"].has(portrait));
  };

  // 棄民の場合は特別な顔グラフィックグループを使用（最優先）
  if (character.name && typeof character.name === 'string' && character.name.includes("棄民の")) {
    const availablePortraits = filterUnusedPortraits(MALE_PORTRAIT_FILES.GROUP_G);
    if (availablePortraits.length > 0) {
      const selected = randChoice(availablePortraits);
      usedPortraits.male.add(selected);
      return selected;
    }
    // 使用可能な顔グラフィックがない場合は使用済みリストをクリアして再選択
    usedPortraits.male.clear();
    const selected = randChoice(MALE_PORTRAIT_FILES.GROUP_G);
    usedPortraits.male.add(selected);
    return selected;
  }

  if (character.bodySex === "男") {
    const bodyTraits = character.bodyTraits;
    let selectedGroup = null;
    
    // 1. まず特性による判定を行う
    if (bodyTraits.some(trait => [
      "巨漢", "怪力", "マッチョ", "筋骨隆々",
      "巨躯", "巨人"
    ].includes(trait))) {
      selectedGroup = MALE_PORTRAIT_FILES.GROUP_A;
    } 
    else if (bodyTraits.some(trait => [
      "美形", "スマート", "中性的", "眉目秀麗", "優男",
      "色男", "ミステリアス", "クール"
    ].includes(trait))) {
      selectedGroup = MALE_PORTRAIT_FILES.GROUP_B;
    }
    
    // 2. 特性がない場合はステータスで判定
    if (!selectedGroup) {
      if (character.chr >= 15) {
        selectedGroup = MALE_PORTRAIT_FILES.GROUP_C;
      }
      else if (character.chr <= 14 && character.vit >= 15) {
        selectedGroup = MALE_PORTRAIT_FILES.GROUP_D;
      }
      else if (character.chr <= 14 && character.vit <= 14) {
        selectedGroup = MALE_PORTRAIT_FILES.GROUP_E;
      }
      else {
        // どの条件にも当てはまらない場合
        selectedGroup = MALE_PORTRAIT_FILES.GROUP_E;
      }
    }

    // 3. 選択されたグループから使用可能な顔グラフィックを選択
    let availablePortraits = filterUnusedPortraits(selectedGroup);
    if (availablePortraits.length > 0) {
      const selected = randChoice(availablePortraits);
      usedPortraits.male.add(selected);
      return selected;
    }
    
    // 4. 使用可能な顔グラフィックがない場合は使用済みリストをクリアして再選択
    usedPortraits.male.clear();
    const selected = randChoice(selectedGroup);
    usedPortraits.male.add(selected);
    return selected;
  }
  
  // 女性の場合も同様の処理
  const bodyTraits = character.bodyTraits;
  
  // グループA: 清楚・神秘系
  if (bodyTraits.some(trait => [
    "癒し系", "清楚", "神秘的", "ミステリアス",
    "華奢", "薄倖"
  ].includes(trait))) {
    const availablePortraits = filterUnusedPortraits(FEMALE_PORTRAIT_FILES.GROUP_A);
    if (availablePortraits.length > 0) {
      const selected = randChoice(availablePortraits);
      usedPortraits.female.add(selected);
      return selected;
    }
  }
  
  // グループB: 華やか・魅惑系
  if (bodyTraits.some(trait => [
    "華やか", "魔性", "豊満", "スタイル抜群", "絶世の美女"
  ].includes(trait))) {
    const availablePortraits = filterUnusedPortraits(FEMALE_PORTRAIT_FILES.GROUP_B);
    if (availablePortraits.length > 0) {
      const selected = randChoice(availablePortraits);
      usedPortraits.female.add(selected);
      return selected;
    }
  }
  
  // グループC: 凛々しい・健康的系
  if (bodyTraits.some(trait => [
    "凛々しい", "クール", "しなやか",
    "健康的", "スレンダー", "筋肉質", "大柄", "ふくよか"
  ].includes(trait))) {
    const availablePortraits = filterUnusedPortraits(FEMALE_PORTRAIT_FILES.GROUP_C);
    if (availablePortraits.length > 0) {
      const selected = randChoice(availablePortraits);
      usedPortraits.female.add(selected);
      return selected;
    }
  }
  
  // グループD: 普通・地味系
  if (bodyTraits.some(trait => [
    "虚弱", "やせ型", "小柄", "平凡",
    "地味", "目立たない", "素朴", "童顔"
  ].includes(trait))) {
    const availablePortraits = filterUnusedPortraits(FEMALE_PORTRAIT_FILES.GROUP_D);
    if (availablePortraits.length > 0) {
      const selected = randChoice(availablePortraits);
      usedPortraits.female.add(selected);
      return selected;
    }
  }
  
  // デフォルト: 特徴がない場合は普通グループから
  const availablePortraits = filterUnusedPortraits(FEMALE_PORTRAIT_FILES.GROUP_D);
  if (availablePortraits.length > 0) {
    const selected = randChoice(availablePortraits);
    usedPortraits.female.add(selected);
    return selected;
  }
  
  // 全ての顔グラフィックが使用済みの場合、使用済みリストをクリアして再選択
  usedPortraits.female.clear();
  const selected = randChoice(FEMALE_PORTRAIT_FILES.GROUP_D);
  usedPortraits.female.add(selected);
  return selected;
}

/**
 * 初期村人を生成して返す
 */
export function createInitialVillagers() {
  let villagers = [];
  const totalCount = INITIAL_MALE_COUNT + INITIAL_FEMALE_COUNT;
  let maleCount = 0;
  let femaleCount = 0;

  // 男女交互に生成
  for (let i = 0; i < totalCount; i++) {
    let isMale = i % 2 === 0;
    if (maleCount >= INITIAL_MALE_COUNT) isMale = false;
    if (femaleCount >= INITIAL_FEMALE_COUNT) isMale = true;

    if (isMale) {
      let male = new Villager(generateRandomName("男", { existingNames: villagers.map(v => v.name) }), "男", randInt(18, 29));
      initRandomParams(male);
      assignBodyMindTraits(male);
      applyTraitParameterBonuses(male);
      assignHobby(male);
      refreshJobTable(male);
      male.portraitFile = selectPortraitByCharacter(male);
      villagers.push(male);
      maleCount++;
    } else {
      let female = new Villager(generateRandomName("女", { existingNames: villagers.map(v => v.name) }), "女", randInt(18, 25));
      initRandomParams(female);
      assignBodyMindTraits(female);
      applyTraitParameterBonuses(female);
      assignHobby(female);
      refreshJobTable(female);
      female.portraitFile = selectPortraitByCharacter(female);
      villagers.push(female);
      femaleCount++;
    }
  }

  initializeFoundingFriendships(villagers);
  return villagers;
}

/**
 * ランダム村人を生成
 * @param {Object} options - 生成オプション
 * @param {string} [options.sex] - 性別 ("男"/"女")
 * @param {number} [options.minAge] - 最小年齢
 * @param {number} [options.maxAge] - 最大年齢
 * @param {Object} [options.params] - 固定パラメータ設定
 * @param {Object} [options.ranges] - パラメータ範囲設定 { param: [min, max] }
 */
export function createRandomVillager({ sex, minAge, maxAge, params = {}, ranges = {}, existingNames = [], fallbackParentName = "" }) {
  let age = randInt(minAge, maxAge);

  let nm = generateRandomName(sex, {
    existingNames,
    fallbackParentName,
    race: params.race,
    job: params.job
  });
  let vill = new Villager(nm, sex, age);
  
  if (params || ranges) {
    // デフォルトのランダム値で初期化
    initRandomParams(vill);

    // 固定値のパラメータを上書き
    if (params) {
      Object.assign(vill, params);
    }

    // 範囲指定のパラメータを生成して上書き
    if (ranges) {
      Object.entries(ranges).forEach(([param, [min, max]]) => {
        if (Array.isArray([min, max]) && min <= max) {
          vill[param] = randNormalInRange(min, max);
        }
      });
    }
    setBaseStatsFromEffective(vill);
  } else {
    // 通常のランダム初期化
    initRandomParams(vill);
  }

  assignBodyMindTraits(vill);
  applyTraitParameterBonuses(vill);
  assignHobby(vill);
  refreshJobTable(vill);
  
  // 顔グラフィックの設定
  // 棄民の場合は専用グループから選択
  if (vill.name && typeof vill.name === 'string' && vill.name.includes("棄民の")) {
    vill.portraitFile = selectPortraitByCharacter(vill);
  }
  // 襲撃者でない場合のみ顔グラフィックを設定
  else if (!params.job || !["野盗", "ゴブリン", "狼", "キュクロプス", "ハーピー"].includes(params.job)) {
    vill.portraitFile = selectPortraitByCharacter(vill);
  }

  return vill;
}

/**
 * ランダム名前生成(男/女)を修正
 */
export function generateRandomName(sex, options = {}) {
  const maleNames = [
    "アルフ","ガルド","レオン","エルネスト","ヨハン","ハイン","グレン","ディルク","ロベルト","シュテファン",
    "オスカー","フィン","ルーカス","ヴィクトール","ベルトラン","ライオネル","ガブリエル","セルジオ","ミハエル","リッツ",
    "クライド","アードルフ","ダリオ","フリード","ハンツ","フェリクス","マキシム","オーウェン","バーン","タイラー",
    "ビルヘルム","イングラム","ジャスパー","レザルド","ガストン","ヘルマン","トリスタン","ファビアン","ヘリオス","アルドール",
    "ローエン","カロル","マルコ","アギル","ボリス","イライアス","サムソン","ブラッド","シモン","エリク",
    "ギルベルト","エドムント",
    "ロタール","バルタザール","テオドール","ラインハルト","ヴォルフガング","アーサー","ランスロット","ガウェイン",
    "パーシヴァル","ベディヴィア","ケイ","トリストラム",
    "アストラル","ファイアル","ソラリス","ルミナス","セレスト","ドラゴ","エオス","オリオン","クロノス",
    "アイオロス","テラス","ブラギ"
  ];
  const femaleNames = [
    "ルナ","エマ","エリー","リサ","フローレ","ナギサ","ミレイ","フェリシア","ユリア","エリシア",
    "マルレーネ","アデル","クラリス","オリガ","シルヴィ","ローザ","フランカ","ロゼッタ","グレース","サラ",
    "ティナ","マリー","ネリア","ディアナ","レティシア","クロエ","イリーナ","ミリア","リンリン","ファナ",
    "エステラ","セルフィ","ベアトリス","フィオナ","フローラ","アンナ","オデット","アメリア","ユナ","ルイネ",
    "シェリル","カトレア","エルディア","ラミア","ミスティ","サリナ","ベルト","クラウディア","カレン","ユリエ",
    "アデルハイト","イゾルデ","ジークリンデ",
    "モルガナ","ヴィヴィアン","エレイン","イグレイン","リノア","エーデルリート",
    "ヘレナ","セシリア",
    "ルミエール","セレスティア","アストリア","エテリア","アウローラ","ノヴァ","アイリス","リリス","アテナ",
    "アルテミシア","フレイヤ","イドゥン","スカディ","エイル","ナンナ","シグリド","ヘル","フリッグ","セレーネ","エオウィン"
  ];
  const steppeFemaleNames = [
    "アルタンナ", "アリグナ", "アヤラ", "バヤルマ", "ボルテ", "ボルガナ", "チャガナ", "チメグ", "ダリカ", "エルデネ",
    "エセンナ", "ガンチメグ", "ハラナ", "ハルガナ", "ホラン", "イルガ", "ジャルガ", "カラナ", "カスミラ", "ケレナ",
    "クラン", "クルミシュ", "クトルナ", "マラル", "メルゲナ", "ナランナ", "ノミン", "オユン", "オルダナ", "サイハナ",
    "サラナ", "サリナイ", "セチェナ", "シベナ", "ソロンゴ", "タミラ", "タルカナ", "テムリナ", "トヤナ", "ウルガナ",
    "ウリナ", "ヤラナ", "ユルドゥナ", "ザラナ", "ズラガナ", "アルシャナ", "アスパラ", "バフラナ", "ファルナ", "ミフリ",
    "ロクサナ", "サカラ", "スパラ", "ヴァルカナ", "アラシナ", "バルシナ", "イルテリナ", "ビルゲナ", "キュルナ", "トルグナ",
    "アイスル", "アイヌル", "アイチュレク", "アクチュレク", "アルズ", "アスリ", "バイサル", "ベグミラ", "チョルパナ", "エルキナ",
    "グルバハル", "グルナズ", "カラグル", "クムリ", "メレク", "ミナラ", "ナズグル", "ヌルアイ", "サビラ", "セヴィル",
    "トマリス", "トゥラン", "ウルミラ", "ヤスミラ", "ザリナ", "ゼリハ", "アムリタ", "アナヒタ", "アタナ", "フラワル",
    "マフリナ", "ラナク", "ロシャナ", "スリヤナ", "タパナ", "ヴァルジナ", "ヤシュナ", "アラティ", "バヌカ", "ミトラナ"
  ];
  const steppeMaleNames = [
    "アラト", "アルタン", "アルグン", "バトゥ", "バトル", "ベルグテイ", "ボロル", "ボルカン", "ボルテイ", "ブカ",
    "チャガン", "チャガタイ", "チルゲン", "チョルン", "ダヤン", "エルデン", "エセン", "ガンバル", "ガントゥル", "ガルサン",
    "ハラル", "ハルガイ", "ハルタン", "ホルチ", "ホルムズ", "イルベル", "イルハン", "イナル", "ジャライ", "ジェベ",
    "ジェルメ", "カダン", "カイドゥ", "カイラト", "カラチ", "カラハン", "カスカイ", "カシュガル", "ケレイ", "クチュル",
    "クルタイ", "クルガン", "クトルグ", "マングダイ", "メルゲン", "ムカリ", "ナラン", "ノガイ", "オグル", "オグズ",
    "オルダ", "オルホン", "オルクン", "オトチ", "サイハン", "サルバン", "サルタク", "サリク", "セチェン", "シベグ",
    "シデイ", "ソヨン", "スブタイ", "タバル", "タムガ", "タルカン", "テムゲ", "テムル", "トグリル", "トクトア",
    "トルイ", "トゥメン", "ウルス", "ウルグ", "ウリャン", "ウズベク", "ヤブグ", "ヤガン", "ヤルカン", "ユルドゥズ",
    "ザバン", "ザラン", "ズラガ", "アスパル", "アルシャク", "バフラム", "ファルナク", "ミフラク", "ロスタム", "サカール",
    "スパーダ", "ヴァルカ", "アショク", "アラシュ", "バルス", "イルテリシュ", "クテイ", "トニュクク", "ビルゲ", "キュル"
  ];

  // 性別に応じた名前リストを選択
  let nameList = sex === "男" ? maleNames : femaleNames;
  if (options.race === "エクイナ") {
    nameList = steppeFemaleNames;
  } else if (options.race === "セントール" || options.job === "セントール" || options.job === "遊牧民" || options.job === "騎馬兵団") {
    nameList = steppeMaleNames;
  }
  
  const reservedNames = getReservedNames(options.existingNames);
  const availableNames = nameList.filter(name => !reservedNames.has(name));
  
  if (availableNames.length === 0) {
    const baseName = options.fallbackParentName || randChoice(nameList);
    const fallbackName = buildFallbackChildName(baseName, reservedNames);
    registerUsedName(fallbackName);
    return fallbackName;
  }
  
  // ランダムに名前を選択して使用済みとしてマーク
  const chosenName = randChoice(availableNames);
  registerUsedName(chosenName);
  return chosenName;
}

/**
 * パラメータ初期化
 */
export function initRandomParams(v) {
  // 性別別にある程度初期値の振れ幅を設定
  if (v.bodySex === "男") {
    v.vit = randNormalInRange(8, 30);
    let mx = Math.min(30, v.vit * 1.5);
    if (mx < 12) mx = 12;
    v.str = randNormalInRange(12, Math.floor(mx));
    v.dex = randNormalInRange(5, 25);
    v.mag = randNormalInRange(5, 25);
    v.chr = randNormalInRange(6, 25);
    v.int = randNormalInRange(5, 25);
    v.ind = randNormalInRange(5, 25);
    let me = Math.min(25, Math.floor(v.ind * 1.5));
    if (me < 5) me = 5;
    v.eth = randNormalInRange(5, me);
    v.cou = randNormalInRange(8, 30);
    v.sexdr = randNormalInRange(8, 30);
  } else {
    v.vit = randNormalInRange(5, 25);
    let mx = Math.min(25, v.vit * 1.5);
    if (mx < 5) mx = 5;
    v.str = randNormalInRange(5, Math.floor(mx));
    v.dex = randNormalInRange(5, 25);
    v.mag = randNormalInRange(15, 27);
    v.chr = randNormalInRange(15, 27);
    v.int = randNormalInRange(5, 25);
    v.ind = randNormalInRange(5, 25);
    let me = Math.min(30, Math.floor(v.ind * 1.8));
    if (me < 8) me = 8;
    v.eth = randNormalInRange(8, me);
    v.cou = randNormalInRange(3, 25);
    v.sexdr = randNormalInRange(3, 25);
  }

  setBaseStatsFromEffective(v);
}

// 精神特性と口調タイプのマッピング

/**
 * 精神特性から口調タイプを決定
 */
export function determineSpeechType(character) {  // export を追加
  // デフォルトの口調
  const defaultSpeechType = (character.spiritSex || character.bodySex) === "男" ? "普通Ｍ" : "普通Ｆ";
  
  // 精神特性がない場合はデフォルトを返す
  if (!character.mindTraits || character.mindTraits.length === 0) {
    return defaultSpeechType;
  }

  // 最初の精神特性を使用して口調を決定
  const trait = character.mindTraits[0];
  const speechTypes = SPEECH_TYPE_MAPPING[trait];
  
  if (!speechTypes) {
    return defaultSpeechType;
  }

  return (character.spiritSex || character.bodySex) === "男" ? speechTypes.male : speechTypes.female;
}

/**
 * 肉体/精神特性を判定して付与
 */
export function assignBodyMindTraits(v) {
  // 例: "病弱","華奢" など
  const bodyTraitDefinitions = [
    { name: "虚弱", condition: (v) => v.vit <= 10 && v.chr <= 16 },
    { name: "華やか", condition: (v) => v.bodySex === "女" && v.dex >= 20 && v.chr >= 20 },
    { name: "やせ型", condition: (v) => v.vit <= 12 && v.vit >= 10 && v.chr <= 16 },
    { name: "スレンダー", condition: (v) => v.bodySex === "女" && v.vit <= 15 && v.vit >= 11 && v.chr >= 17 && v.chr <= 23},
    { name: "小太り", condition: (v) => v.vit >= 18 && v.chr <= 12 },
    { name: "筋肉質", condition: (v) => v.str >= 20 && v.str <= 23 && v.chr <= 20},
    { name: "平凡", condition: (v) => ["vit","str","chr"].every(param => v[param] >= 15 && v[param] <= 18) },
    { name: "巨躯", condition: (v) => v.vit >= 28 },
    { name: "巨漢", condition: (v) => v.bodySex === "男" && v.vit >= 24 && v.chr <= 17 },
    { name: "美形", condition: (v) => v.bodySex === "男" && v.chr >= 24 },
    { name: "太りすぎ", condition: (v) => v.bodySex === "男" && v.vit >= 26 && v.chr <= 10 },
    { name: "美丈夫", condition: (v) => v.bodySex === "男" && v.vit >= 21 && v.chr >= 20 },
    { name: "たくましい", condition: (v) => v.bodySex === "男" && v.str >= 18 && v.chr >= 18 },
    { name: "長身", condition: (v) => v.bodySex === "男" && v.vit >= 18 && v.chr >= 18 },
    { name: "がっしり", condition: (v) => v.bodySex === "男" && v.vit >= 19  && v.vit <= 23 && v.chr <= 19 && v.chr >= 11 },
    { name: "中肉中背", condition: (v) => v.bodySex === "男" && v.vit <= 18 && v.vit >= 15 && v.chr <= 19 && v.chr >= 11 },
    { name: "痩身", condition: (v) => v.bodySex === "男" && v.vit <= 14 && v.chr <= 17 && v.chr >= 13 },
    { name: "痩せぎす", condition: (v) => v.bodySex === "男" && v.vit <= 14 && v.chr <= 12 },
    { name: "細身", condition: (v) => v.bodySex === "男" && v.vit <= 16 && v.chr >= 15 &&v.chr <= 19 },
    { name: "スマート", condition: (v) => v.bodySex === "男" && v.vit <= 16 && v.chr >= 19 && v.vit >= 11 },
    { name: "中性的", condition: (v) => v.bodySex === "男" && v.vit <= 15 &&v.chr >= 23 },
    { name: "眉目秀麗", condition: (v) => v.bodySex === "男" && v.int >= 20 &&v.chr >= 20 },
    { name: "強面", condition: (v) => v.bodySex === "男" && v.str >= 20 && v.cou >= 20 },
    { name: "小柄", condition: (v) => v.vit >= 9 && v.vit <= 11  && v.chr <= 16},
    { name: "癒し系", condition: (v) => v.bodySex === "女" && v.chr >= 20 && v.eth >= 20 },
    { name: "ガリガリ", condition: (v) => v.bodySex === "男" && v.vit <= 10 && v.chr <= 10 },
    { name: "大柄", condition: (v) => v.vit >= 20 && v.str >= 18 && v.vit <= 22  && v.chr <= 20},
    { name: "スタイル抜群", condition: (v) => v.bodySex === "女" && v.vit >= 13 && v.chr >= 24 },
    { name: "豊満", condition: (v) => v.bodySex === "女" && v.vit >= 16 && v.chr >= 22 },
    { name: "優男", condition: (v) => v.bodySex === "男" && v.chr >= 20 && v.sexdr >= 18 && v.vit <= 18 },
    { name: "地味", condition: (v) => v.vit <= 17 && v.chr <= 15 },
    { name: "魔性", condition: (v) => v.bodySex === "女" && v.chr >= 24 && v.sexdr >= 18 && v.int >= 16 },
    { name: "薄倖", condition: (v) => v.bodySex === "女" && v.vit <= 11 && v.chr >= 20 },
    { name: "健康的", condition: (v) => v.bodySex === "女" && v.vit >= 16 && v.chr >= 16  && v.chr <= 22 },
    { name: "神秘的", condition: (v) => v.bodySex === "女" && v.mag >= 20 && v.chr >= 23 && v.sexdr <= 17 },
    { name: "絶世の美女", condition: (v) => v.bodySex === "女" && v.chr >= 27 },
    { name: "ミステリアス", condition: (v) => v.mag >= 20 && v.chr >= 21 && v.chr <= 27},
    { name: "クール", condition: (v) => v.sexdr <= 10 && v.chr >= 20},
    { name: "あやしげ", condition: (v) => v.bodySex === "男" && v.mag >= 22 && v.chr <= 15 },
    { name: "色男", condition: (v) => v.bodySex === "男" && v.mag >= 20 && v.chr >= 20 },
    { name: "怪力", condition: (v) => v.bodySex === "男" && v.str >= 27 },
    { name: "胡散臭い", condition: (v) => v.bodySex === "男" && v.dex >= 20 && v.eth <= 15 && v.chr <= 12 },
    { name: "悪人顔", condition: (v) => v.bodySex === "男" && v.eth <= 12 && v.chr <= 15 },
    { name: "マッチョ", condition: (v) => v.bodySex === "男" && v.str >= 24 && v.chr <= 18 },
    { name: "筋骨隆々", condition: (v) => v.bodySex === "男" && v.str >= 24 && v.chr >= 19 },
    { name: "威圧的", condition: (v) => v.bodySex === "男" && v.eth <= 12 && v.cou >= 20 && v.str >= 20 },
    { name: "精悍", condition: (v) => v.bodySex === "男" && v.str >= 20 && v.cou >= 18 && v.chr >= 18 },
    { name: "凛々しい", condition: (v) => v.bodySex === "女" && v.str >= 16 && v.cou >= 18 && v.chr >= 17 && v.chr <= 22},
    { name: "素朴", condition: (v) => v.eth >= 16 && v.chr <= 18 && v.chr >= 16 },
    { name: "清楚", condition: (v) => v.bodySex === "女" && v.chr >= 18 && v.eth >= 20 },
    { name: "しなやか", condition: (v) => v.bodySex === "女" && v.vit <= 17 && v.vit >= 14 && v.chr <= 20 && v.chr >= 16 },
    { name: "童顔", condition: (v) => v.chr >= 18 && v.sexdr <= 16 && v.vit <= 13 && v.chr <= 27 },
    { name: "華奢", condition: (v) => v.bodySex === "女" && v.vit <= 12 && v.chr >= 17 },
    { name: "ふくよか", condition: (v) => v.bodySex === "女" && v.vit >= 18 && v.chr <= 15},
    { name: "目立たない", condition: (v) => v.bodySex === "女" && v.vit <= 17 && v.chr <= 16},
    { name: "目立たない", condition: (v) => v.bodySex === "男" && v.vit <= 19 && v.chr <= 15},
    { name: "小汚い", condition: (v) => v.bodySex === "男" && v.int <=3 && v.chr <= 11 },
    { name: "冴えない", condition: (v) => v.bodySex === "男" && v.int <= 14 && v.chr <= 13 },
  ];
  let bodyTraitCandidates = [];
  bodyTraitDefinitions.forEach(def => {
    if (def.condition(v)) {
      bodyTraitCandidates.push(def.name);
    }
  });
  if (bodyTraitCandidates.length>0) {
    let chosen = randChoice(bodyTraitCandidates);
    v.bodyTraits.push(chosen);
  }

  // 精神特性例: "独善的","才女"など
  const mindTraitDefinitions = [
    { name: "独善的", condition: (v) => v.chr <= 13 && v.eth >= 22 },
    { name: "読書家", condition: (v) => v.int >= 20 && v.ind >= 18 },
    { name: "小市民", condition: (v) => v.cou <= 16 && v.ind >= 17 && v.eth >= 17  && v.eth <= 22 },
    { name: "善人", condition: (v) => v.eth >= 20 && v.eth <= 21},
    { name: "強気", condition: (v) => v.cou >= 20 && v.cou <= 21},
    { name: "無鉄砲", condition: (v) => v.cou >= 22 && v.int <= 16},
    { name: "知性派", condition: (v) => v.int >= 20 && v.int <= 21},
    { name: "働き者", condition: (v) => v.ind >= 20 && v.ind <= 22},
    { name: "普通", condition: (v) => ["int","ind","eth","cou","sexdr"].every(param => v[param] <= 17) },
    { name: "庶民的", condition: (v) => ["int","ind","eth","cou","sexdr"].every(param => v[param] <= 19) },
    { name: "内向的", condition: (v) => ["int","ind","eth","cou","sexdr"].every(param => v[param] <= 17) },
    { name: "本の虫", condition: (v) => ["int","ind","eth","cou","sexdr"].every(param => v[param] <= 17) },
    { name: "勉強苦手", condition: (v) => ["cou","eth","ind","sexdr"].every(param => v[param] <= 18) && v.int <= 10 },
    { name: "天才肌", condition: (v) => v.int >= 24 && v.ind <= 16 },
    { name: "学者肌", condition: (v) => v.int >= 22 && v.ind >= 18 && v.eth >= 18 },
    { name: "我慢強い", condition: (v) => v.vit >= 18 && v.ind >= 16 && v.eth >= 16 },
    { name: "正直者", condition: (v) => v.int <= 16 && v.eth >= 20 },
    { name: "天然", condition: (v) => v.chr >= 22 && v.int <= 16 && v.eth >= 16 },
    { name: "おしゃべり", condition: (v) => v.chr >= 16 && v.ind <= 18 && v.sexdr >= 16 && v.dex >= 18 },
    { name: "怒りっぽい", condition: (v) => v.eth <= 12 && v.cou >= 18 },
    { name: "残忍", condition: (v) => v.eth <= 4 && v.cou >= 18 },
    { name: "酷薄", condition: (v) => v.eth <= 4 && v.int >= 16 },
    { name: "昼行燈", condition: (v) => v.int >= 20 && v.ind <= 14 && v.cou >= 20 },
    { name: "戦闘狂", condition: (v) => v.str >= 20 && v.ind <= 12 && v.cou >= 22 },
    { name: "根暗", condition: (v) => v.chr <= 14 && v.sexdr <= 14 && v.cou <= 15 },
    { name: "無気力", condition: (v) => v.int <= 14 && v.ind <= 14 && v.eth <= 14 && v.cou <= 14 && v.sexdr <= 14 },
    { name: "マジメ", condition: (v) => v.ind >= 20 && v.eth >= 16 && v.sexdr <= 16 },
    { name: "怠け者", condition: (v) => ["int","eth","cou","sexdr"].every(param => v[param] <= 18) && v.ind <= 11 },
    { name: "ろくでなし", condition: (v) => v.bodySex === "男" && v.ind <= 12 && v.eth <= 12 },
    { name: "ワル", condition: (v) => v.bodySex === "男" && v.eth <= 9 && v.cou >= 16 },
    { name: "インテリヤクザ", condition: (v) => v.bodySex === "男" && v.eth <= 9 && v.ind >= 20 },
    { name: "守銭奴", condition: (v) => v.eth <= 9 && v.ind >= 20 },
    { name: "優等生", condition: (v) => v.int >= 18 && v.ind >= 18 && v.eth >= 18 },
    { name: "策士", condition: (v) => v.int >= 20 && v.cou >= 20 },
    { name: "神経質", condition: (v) => v.vit <= 14 && v.chr <= 12 },
    { name: "女好き", condition: (v) => v.bodySex === "男" && v.sexdr >= 24 },
    { name: "チャラい", condition: (v) => v.bodySex === "男" && v.sexdr >= 18 && v.chr >=18 },
    { name: "情熱的", condition: (v) => v.sexdr >= 19 && v.cou >= 19},
    { name: "男嫌い", condition: (v) => v.bodySex === "女" && v.sexdr <= 7 },
    { name: "夢見がち", condition: (v) => v.bodySex === "女" && v.sexdr >= 18 && v.int <= 15 },
    { name: "好奇心旺盛", condition: (v) => v.int >= 17 && v.sexdr >= 17 && v.dex >= 17 },
    { name: "冒険好き", condition: (v) => v.int >= 18 && v.cou >= 20 },
    { name: "陰キャ", condition: (v) => v.chr <= 17 && v.cou <= 15 && v.str <= 16 },
    { name: "計算高い", condition: (v) => v.int >= 22 && v.eth <= 14 },
    { name: "姉御肌", condition: (v) => v.bodySex === "女" && v.str >= 17 && v.eth >= 16 && v.cou >= 18 },
    { name: "古風", condition: (v) => v.bodySex === "女" && v.ind >= 18 && v.eth >= 18 && v.sexdr <= 14 },
    { name: "大雑把", condition: (v) => v.vit >= 20 && v.dex <= 12 },
    { name: "臆病", condition: (v) => ["int","eth","ind","sexdr"].every(param => v[param] <= 19) && v.cou <= 10 },
    { name: "寡黙", condition: (v) => v.dex <= 15 && v.chr <= 15 && v.sexdr <= 17 },
    { name: "不器用", condition: (v) => ["int","eth","ind","sexdr","cou"].every(param => v[param] <= 19) && v.dex <= 10 },
    { name: "ぶっきらぼう", condition: (v) => v.dex <= 12 && v.chr <= 16 && v.sexdr <= 12 },
    { name: "偏屈", condition: (v) => v.dex <= 15 && v.chr <= 12 && v.int >= 18 },
    { name: "利発", condition: (v) => v.dex >= 18 && v.int >= 20 && v.eth >= 18 },
    { name: "抜け目がない", condition: (v) => v.dex >= 20 && v.chr >= 16 && v.int >= 18 && v.eth <= 16 },
    { name: "職人気質", condition: (v) => v.dex >= 20 && v.ind >= 20 },
    { name: "狡猾", condition: (v) => v.int >= 20 && v.eth <= 9 },
    { name: "あざとい", condition: (v) => v.bodySex === "女" && v.dex >= 16 && v.chr >= 20 && v.int >= 16 && v.sexdr >= 17 },
    { name: "鈍感", condition: (v) => v.vit >= 18 && v.mag <= 12 && v.chr <= 16 },
    { name: "泣き虫", condition: (v) => v.bodySex === "女" && v.vit <= 16 && v.cou <= 9 },
    { name: "おしゃれ", condition: (v) => v.bodySex === "女" && v.chr >= 20 && v.sexdr >= 16 },
    { name: "粗暴", condition: (v) => v.str >= 26 && v.eth <= 10 },
    { name: "男勝り", condition: (v) => v.bodySex === "女" && v.str >= 16 && v.cou >= 20 },
    { name: "潔癖", condition: (v) => v.eth >= 22 && v.sexdr <= 10 },
    { name: "綺麗好き", condition: (v) => v.eth >= 18 && v.sexdr <= 16 },
    { name: "暴れ者", condition: (v) => v.bodySex === "男" && v.str >= 20 && v.eth <= 12 && v.cou >= 20 },
    { name: "好戦的", condition: (v) => v.str >= 20 && v.eth <= 16 && v.cou >= 20 },
    { name: "問題児", condition: (v) => v.bodySex === "男" && v.ind <= 12 && v.eth <= 12 },
    { name: "草食系", condition: (v) => v.bodySex === "男" && v.sexdr <= 12 },
    { name: "スケベ", condition: (v) => v.bodySex === "男" && v.int <= 18 && v.eth <= 16 && v.sexdr >= 20 },
    { name: "遊び人", condition: (v) => v.bodySex === "男" && v.chr >= 18 && v.eth <= 12 && v.sexdr >= 20 },
    { name: "むっつり", condition: (v) => v.eth >= 20 && v.sexdr >= 20 },
    { name: "勇敢", condition: (v) => v.str >= 20 && v.cou >= 22 },
    { name: "勇猛果敢", condition: (v) => v.cou >= 28 },
    { name: "豪傑", condition: (v) => v.str >= 24 && v.cou >= 24 },
    { name: "箱入り", condition: (v) => v.bodySex === "女" && v.str <= 16 && v.eth >= 20 && v.sexdr <= 12 },
    { name: "惚れっぽい", condition: (v) => v.bodySex === "女" && v.int <= 18 && v.chr <= 23 && v.sexdr >= 19 },
    { name: "惚れっぽい", condition: (v) => v.bodySex === "男" && v.sexdr <= 24 && v.sexdr >= 19 },
    { name: "愚直", condition: (v) => v.int <= 10 && v.ind >= 20 },
    { name: "夢想家", condition: (v) => v.int >= 18 && v.chr >= 16 && v.ind <= 12 },
    { name: "堅物", condition: (v) => v.ind >= 18 && v.eth >= 20 && v.sexdr <= 15 },
    { name: "ストイック", condition: (v) => v.ind >= 20 && v.eth >= 16 && v.sexdr <= 15 },
    { name: "仕事好き", condition: (v) => v.ind >= 23},
    { name: "仕事の鬼", condition: (v) => v.ind >= 24},
    { name: "頭脳派", condition: (v) => v.int >= 20 && v.dex >= 18 },
    { name: "聡明", condition: (v) => v.int >= 20 && v.chr >= 16 && v.dex >= 16 },
    { name: "才気煥発", condition: (v) => v.int >= 24 && v.dex >= 18 },
    { name: "マッド", condition: (v) => v.int >= 24 && v.eth <= 9 },
    { name: "享楽的", condition: (v) => v.ind <= 16 && v.eth <= 16 && v.sexdr >= 18 && v.int <= 19 },
    { name: "悪女", condition: (v) => v.bodySex === "女" && v.chr >= 20 && v.eth <= 9 },
    { name: "筋肉馬鹿", condition: (v) => v.int <= 12 && v.str >= 24 },
    { name: "熱血", condition: (v) => v.int <= 14 && v.cou >= 24 },
    { name: "世渡り上手", condition: (v) => v.chr >= 18 && v.dex >= 18 && v.int >= 18 },
    { name: "文武両道", condition: (v) => v.str >= 20 && v.int >= 20 },
    { name: "愚鈍", condition: (v) => v.eth <= 4 && v.int <= 11 },
    { name: "強欲", condition: (v) => v.eth <= 4 && v.ind >= 10 },
    { name: "現実主義", condition: (v) => v.mag <= 10 && v.ind >= 20 },
    { name: "才女", condition: (v) => v.bodySex === "女" && v.int >= 20 && v.ind >= 18 && v.eth >= 16 },
    { name: "才色兼備", condition: (v) => v.bodySex === "女" && v.int >= 20 && v.chr >= 22 },
    { name: "肉食系", condition: (v) => v.bodySex === "女" && v.chr <= 23 && v.sexdr >= 20},
  ];
  let mindTraitCandidates = [];
  mindTraitDefinitions.forEach(def => {
    if (def.condition(v)) {
      mindTraitCandidates.push(def.name);
    }
  });
  if (mindTraitCandidates.length>0) {
    let chosen = randChoice(mindTraitCandidates);
    v.mindTraits.push(chosen);
  }

  // 非排他特性
  const nonExclusiveTraits = [
    { name: "ニート", condition: (v)=>(v.ind<=10), chance:0.3, target:"mind" },
    { name: "ワーカホリック", condition: (v)=>(v.ind>=23), chance:0.2, target:"mind" },
    { name: "澄んだ声", condition: (v)=>(v.bodySex==="女" && v.chr>=25), chance:0.1, target:"body" },
    { name: "通る声", condition: (v)=>(v.chr>=20 && v.cou>=20 && v.eth>=20), chance:0.3, target:"body" },
    { name: "非戦主義", condition: (v)=>(v.eth>=25), chance:0.5, target:"mind" },
    { name: "聖女の輝き", condition: (v)=>(v.bodySex==="女" && v.eth>=23 && v.sexdr<=12), chance:0.5, target:"body" },
    { name: "酒豪", condition: (v)=>(v.vit>=25 && v.chr>=16 && v.sexdr>=18), chance:0.1, target:"body" },
    { name: "繊細な指", condition: (v)=>(v.dex>=22 && v.chr>=22), chance:0.1, target:"body" },
    { name: "緑の指", condition: (v)=>(v.mag>=21), chance:0.15, target:"body" },
    { name: "夜目", condition: (v)=>(v.mag>=18 && v.cou>=20), chance:0.1, target:"body" },
    { name: "色白", condition: (v)=>(v.vit<=12 && v.chr>=25), chance:0.1, target:"body" },
    { name: "寒がり", condition: (v)=>(v.str<=12 && v.vit<=12), chance:0.1, target:"mind" },
    { name: "大食い", condition: (v) =>(v.vit >= 22 && v.chr<=16), chance:0.1, target:"mind" },
    { name: "小食", condition: (v) =>(v.vit <= 12), chance:0.1, target:"mind" },
    { name: "汗かき", condition: (v)=>(v.vit>=24 && v.chr<=12), chance:0.2, target:"mind" },
    { name: "風呂好き", condition: (v)=>(v.bodySex==="女" && v.chr>=18 && v.eth>=12), chance:0.05, target:"mind" },
  ];
  nonExclusiveTraits.forEach(def => {
    if (def.condition(v)) {
      if (Math.random() < def.chance) {
        if (def.target==="body") {
          v.bodyTraits.push(def.name);
        } else {
          v.mindTraits.push(def.name);
        }
      }
    }
  });

  // 年齢由来
  if (!hasNoAgingBodyTrait(v)) {
    if (v.bodyAge >= 60) {
      v.bodyTraits.push("老人");
    } else if (v.bodyAge >= 40) {
      v.bodyTraits.push("中年");
    }
  }

  // 精神特性が決定した後に口調タイプを設定
  v.speechType = determineSpeechType(v);
}

/**
 * 特性によるパラメーター修正
 */
export function applyTraitParameterBonuses(v) {
  applyGenerationBaseTraitBonuses(v);

  // 加齢
  if (!hasNoAgingBodyTrait(v)) {
    if (v.bodyAge >= 60) {
      if (!v.bodyTraits.includes("老人")) v.bodyTraits.push("老人");
    } else if (v.bodyAge >= 40) {
      if (!v.bodyTraits.includes("中年")) v.bodyTraits.push("中年");
    }
  }

  syncEffectiveStats(v);
}

/**
 * 趣味をランダム付与
 */
export function assignHobby(v) {
  const specialHobbyDefs = [
    { name: "ギャンブル",  condition: (v)=>(v.cou>=20 && v.eth<=15), chance:0.15 },
    { name: "喧嘩",        condition: (v)=>(v.str>=20 && v.cou>=20 && v.eth<=10), chance:0.15 },
    { name: "筋トレ",      condition: (v)=>(v.str>=24), chance:0.15 },
    { name: "ドカ食い",    condition: (v)=>(v.vit>=25), chance:0.1 },
    { name: "ナンパ",      condition: (v)=>(v.bodySex==="男" && v.eth<=15 && v.sexdr>=25), chance:0.15 },
    { name: "逆ナン",      condition: (v)=>(v.bodySex==="女" && v.eth<=12 && v.sexdr>=20), chance:0.1 },
    { name: "滝行",        condition: (v)=>(v.vit>=25), chance:0.15 },
    { name: "祈り",        condition: (v)=>(v.eth>=25), chance:0.25 },
    { name: "手芸",        condition: (v)=>(v.dex>=20), chance:0.1 },
    { name: "自由研究",    condition: (v)=>(v.int>=20), chance:0.15 },
    { name: "瞑想",        condition: (v)=>(v.mag>=25), chance:0.15 },
    { name: "自家発電",    condition: (v)=>(v.sexdr>=27), chance:0.1 },
    { name: "露出",        condition: (v)=>(v.bodySex==="男" && v.eth<=10 && v.sexdr>=25), chance:0.2 },
  ];
  let cands = [];
  specialHobbyDefs.forEach(def => {
    if (def.condition(v)) {
      if (Math.random()<def.chance) {
        cands.push(def.name);
      }
    }
  });
  if (cands.length>0) {
    v.hobby = randChoice(cands);
    return;
  }

  // 上記に該当しない場合、汎用リストからランダム
  if (v.bodySex==="男") {
    let maleH = [
      "ドカ食い","美食","筋トレ","滝行","自由研究","釣り","自家発電","読書",
      "祈り","ナンパ","ショッピング","散歩","噂話","園芸","詩作","推し活",
      "瞑想","飲酒","ギャンブル","投資","天体観測","ハンティング"
    ];
    v.hobby = randChoice(maleH);
  } else {
    let femaleH = [
      "自由研究","釣り","読書","祈り","ショッピング","散歩","噂話","園芸",
      "お茶会","オシャレ","詩作","推し活","手芸","瞑想","飲酒","美食",
      "占い","投資","天体観測","ダンス"
    ];
    v.hobby = randChoice(femaleH);
  }
}

/**
 * 精神年齢に応じて jobTable を組み立てる
 */


/**
 * 訪問者タイプの定義
 */

/**
 * 重み付き抽選で訪問者タイプを選択
 */
function hasRaceInVillage(village, race) {
  const people = [
    ...(Array.isArray(village?.villagers) ? village.villagers : []),
    ...(Array.isArray(village?.visitors) ? village.visitors : [])
  ];
  return people.some(person => person?.race === race);
}

function getRareVisitorWeight(entry, village = null) {
  if (!entry.implemented) return 0;
  if (entry.uniqueRace && hasRaceInVillage(village, entry.type)) return 0;
  return entry.weight;
}

function buildRareVisitorType(entry) {
  return {
    ...entry.visitor,
    rareVisitorType: entry.type
  };
}

function selectRareVisitorType(village = null) {
  const entries = RARE_VISITOR_TYPES
    .map(entry => ({ entry, weight: getRareVisitorWeight(entry, village) }))
    .filter(item => item.weight > 0);
  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of entries) {
    random -= item.weight;
    if (random <= 0) {
      return buildRareVisitorType(item.entry);
    }
  }
  return buildRareVisitorType(entries[0].entry);
}

function hasAvailableRareVisitorType(village = null) {
  return RARE_VISITOR_TYPES.some(entry => getRareVisitorWeight(entry, village) > 0);
}

function selectWeightedVisitorOption(options = []) {
  const entries = options
    .map(option => ({ option, weight: Number(option?.weight) || 0 }))
    .filter(item => item.weight > 0);
  if (entries.length === 0) return null;

  const totalWeight = entries.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  for (const item of entries) {
    random -= item.weight;
    if (random <= 0) return item.option;
  }
  return entries[0].option;
}

function getVisitorDisplayType(visitorType) {
  const selected = selectWeightedVisitorOption(visitorType.displayTypes);
  return selected?.type || visitorType.displayType || visitorType.type;
}

function resolveForcedVisitorType(forcedType, village = null) {
  if (!forcedType) return null;
  if (forcedType === RARE_VISITOR_TYPE) return selectRareVisitorType(village);

  if (forcedType === EQUINA_VISITOR_TYPE.type) return EQUINA_VISITOR_TYPE;
  if (GOAT_PAIR_VISITOR_TYPES.has(forcedType)) return GOAT_PAIR_VISITOR_TYPES.get(forcedType);

  const visitorType = VISITOR_TYPES.find(type => type.type === forcedType);
  if (visitorType) return visitorType;

  const rareEntry = RARE_VISITOR_TYPES.find(entry => entry.type === forcedType && entry.implemented);
  return rareEntry ? buildRareVisitorType(rareEntry) : null;
}

export function getVisitorTypeChoices() {
  return [
    ...VISITOR_TYPES.map(type => type.type),
    EQUINA_VISITOR_TYPE.type,
    SATYR_VISITOR_TYPE.type,
    MAENAD_VISITOR_TYPE.type,
    RARE_VISITOR_TYPE,
    ...RARE_VISITOR_TYPES.filter(entry => entry.implemented).map(entry => entry.type)
  ];
}

function resolveVisitorTable(village = null) {
  const table = village
    ? VISITOR_TABLES_BY_SCALE.find(entry => getVillageScaleStage(village.building).index <= entry.maxStageIndex)
    : VISITOR_TABLES_BY_SCALE[0];
  if (!table) return VISITOR_TYPES;

  return table.entries
    .map(entry => {
      if (entry.type === RARE_VISITOR_TYPE) {
        return hasAvailableRareVisitorType(village) ? { type: RARE_VISITOR_TYPE, weight: entry.weight } : null;
      }
      if (entry.type === EQUINA_VISITOR_TYPE.type) {
        return { ...EQUINA_VISITOR_TYPE, weight: entry.weight };
      }
      if (GOAT_PAIR_VISITOR_TYPES.has(entry.type)) {
        return { ...GOAT_PAIR_VISITOR_TYPES.get(entry.type), weight: entry.weight };
      }
      const visitorType = VISITOR_TYPES.find(type => type.type === entry.type);
      return visitorType ? { ...visitorType, weight: entry.weight } : null;
    })
    .filter(Boolean);
}

function selectVisitorType(village = null) {
  const visitorTable = resolveVisitorTable(village);
  const totalWeight = visitorTable.reduce((sum, type) => sum + type.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const visitorType of visitorTable) {
    random -= visitorType.weight;
    if (random <= 0) {
      return visitorType.type === RARE_VISITOR_TYPE
        ? (selectRareVisitorType(village) || VISITOR_TYPES[0])
        : visitorType;
    }
  }
  return visitorTable[0] || VISITOR_TYPES[0]; // フォールバック
}

function addUniqueTrait(traits, trait) {
  if (Array.isArray(traits) && !traits.includes(trait)) {
    traits.push(trait);
  }
}

function applyVisitorTypeTraits(visitor, visitorType) {
  (visitorType.forcedBodyTraits || []).forEach(trait => addUniqueTrait(visitor.bodyTraits, trait));
  (visitorType.forcedMindTraits || []).forEach(trait => addUniqueTrait(visitor.mindTraits, trait));
  (visitorType.chanceMindTraits || []).forEach(({ trait, chance }) => {
    if (Math.random() < chance) {
      addUniqueTrait(visitor.mindTraits, trait);
    }
  });
  visitor.speechType = determineSpeechType(visitor);
  syncEffectiveStats(visitor);
}

function cloneNullableObject(value) {
  return value == null ? null : { ...value };
}

function pickStats(source, stats) {
  return Object.fromEntries(stats.map(stat => [stat, source?.[stat] ?? 0]));
}

function applyStats(target, stats) {
  Object.entries(stats || {}).forEach(([stat, value]) => {
    target[stat] = value;
  });
}

function markGeneratedBodyExchange(person, fromRace, toRace) {
  Object.defineProperties(person, {
    lastBodyExchangeSourceRace: {
      configurable: true,
      value: fromRace || "人間",
      writable: true
    },
    lastBodyExchangeTargetRace: {
      configurable: true,
      value: toRace || "人間",
      writable: true
    }
  });
}

function exchangeGeneratedVisitorBodies(a, b) {
  const sourceRaceA = a.race || "人間";
  const sourceRaceB = b.race || "人間";
  if (a.portraitFile !== b.portraitFile) {
    const isOriginalBodyA = isOriginalBodyPortrait(a);
    const isOriginalBodyB = isOriginalBodyPortrait(b);
    rememberCurrentPortrait(a, "生成時交換", {
      caption: isOriginalBodyA ? "元の身体" : "過去の姿",
      isOriginalBody: isOriginalBodyA
    });
    rememberCurrentPortrait(b, "生成時交換", {
      caption: isOriginalBodyB ? "元の身体" : "過去の姿",
      isOriginalBody: isOriginalBodyB
    });
  }
  const body = {
    bodySex: a.bodySex,
    bodyAge: a.bodyAge,
    bodyOwner: a.bodyOwner,
    race: a.race,
    portraitFile: a.portraitFile,
    raiderPortrait: a.raiderPortrait,
    visitorPortrait: a.visitorPortrait,
    hp: a.hp,
    baseStats: pickStats(a.baseStats, PHYSICAL_ABILITY_STATS),
    acquiredStatMods: pickStats(a.acquiredStatMods, PHYSICAL_ABILITY_STATS),
    bodyTraits: Array.isArray(a.bodyTraits) ? [...a.bodyTraits] : [],
    pregnancy: a.pregnancy ? JSON.parse(JSON.stringify(a.pregnancy)) : null,
    postpartumMonths: a.postpartumMonths || 0,
    bodyPotentialStats: cloneNullableObject(a.bodyPotentialStats),
    adultBodyTraits: Array.isArray(a.adultBodyTraits) ? [...a.adultBodyTraits] : [],
    adultBodyReached: !!a.adultBodyReached,
    adultPortraitFile: a.adultPortraitFile || "",
    toddlerPortraitFile: a.toddlerPortraitFile || "",
    toddlerPortraitGroup: a.toddlerPortraitGroup || ""
  };

  a.bodySex = b.bodySex;
  a.bodyAge = b.bodyAge;
  a.bodyOwner = b.bodyOwner;
  a.race = b.race;
  a.portraitFile = b.portraitFile;
  a.raiderPortrait = b.raiderPortrait;
  a.visitorPortrait = b.visitorPortrait;
  a.hp = b.hp;
  applyStats(a.baseStats, pickStats(b.baseStats, PHYSICAL_ABILITY_STATS));
  applyStats(a.acquiredStatMods, pickStats(b.acquiredStatMods, PHYSICAL_ABILITY_STATS));
  a.bodyTraits = Array.isArray(b.bodyTraits) ? [...b.bodyTraits] : [];
  a.pregnancy = b.pregnancy ? JSON.parse(JSON.stringify(b.pregnancy)) : null;
  a.postpartumMonths = b.postpartumMonths || 0;
  a.bodyPotentialStats = cloneNullableObject(b.bodyPotentialStats);
  a.adultBodyTraits = Array.isArray(b.adultBodyTraits) ? [...b.adultBodyTraits] : [];
  a.adultBodyReached = !!b.adultBodyReached;
  a.adultPortraitFile = b.adultPortraitFile || "";
  a.toddlerPortraitFile = b.toddlerPortraitFile || "";
  a.toddlerPortraitGroup = b.toddlerPortraitGroup || "";

  b.bodySex = body.bodySex;
  b.bodyAge = body.bodyAge;
  b.bodyOwner = body.bodyOwner;
  b.race = body.race;
  b.portraitFile = body.portraitFile;
  b.raiderPortrait = body.raiderPortrait;
  b.visitorPortrait = body.visitorPortrait;
  b.hp = body.hp;
  applyStats(b.baseStats, body.baseStats);
  applyStats(b.acquiredStatMods, body.acquiredStatMods);
  b.bodyTraits = [...body.bodyTraits];
  b.pregnancy = body.pregnancy ? JSON.parse(JSON.stringify(body.pregnancy)) : null;
  b.postpartumMonths = body.postpartumMonths;
  b.bodyPotentialStats = cloneNullableObject(body.bodyPotentialStats);
  b.adultBodyTraits = [...body.adultBodyTraits];
  b.adultBodyReached = body.adultBodyReached;
  b.adultPortraitFile = body.adultPortraitFile;
  b.toddlerPortraitFile = body.toddlerPortraitFile;
  b.toddlerPortraitGroup = body.toddlerPortraitGroup;

  syncEffectiveStats(a);
  syncEffectiveStats(b);
  markGeneratedBodyExchange(a, sourceRaceA, a.race);
  markGeneratedBodyExchange(b, sourceRaceB, b.race);
}

function isGoatPairVisitorType(visitorType) {
  return !!visitorType && GOAT_PAIR_VISITOR_TYPES.has(visitorType.type);
}

/**
 * 訪問者を生成する関数
 */
function buildVisitorFromType(visitorType, existingNames = [], options = {}) {
  const displayType = getVisitorDisplayType(visitorType);
  
  // 性別を明示的に設定（visitorTypeに指定がなければランダム）
  const bodySex = visitorType.forcedSex || (Math.random() < 0.5 ? "男" : "女");
  const visitorParams = {
    ...visitorType.params,
    ...(visitorType.useDisplayTypeAsJob ? { job: displayType } : {})
  };
  
  const visitor = createRandomVillager({
    sex: bodySex,  // 肉体性別を明示的に設定
    minAge: visitorType.ageRange.min,
    maxAge: visitorType.ageRange.max,
    params: visitorParams,
    ranges: visitorType.ranges,
    existingNames
  });

  // 訪問者の名前を修正
  const visitorName = `${displayType}の${visitor.name}`;
  const reservedNames = getReservedNames(existingNames);
  visitor.name = reservedNames.has(visitorName)
    ? buildFallbackChildName(visitorName, reservedNames)
    : visitorName;
  if (options.registerName !== false) {
    registerUsedName(visitor.name);
  }
  
  // 訪問者は村人化するまで訪問固定。通常時の復帰先は持たない。
  setPreferredAction(visitor, ACTION_NONE);
  visitor.jobTable = [];
  visitor.action = "訪問";
  visitor.actionTable = ["訪問"];
  
  // 精神特性に訪問者を追加（1回のみ）
  visitor.mindTraits.push("訪問者");
  if (visitorType.rareVisitorType) {
    visitor.rareVisitorType = visitorType.rareVisitorType;
  }
  applyVisitorTypeTraits(visitor, visitorType);

  if (visitorType.type === "行商人") {
    visitor.merchantStock = {
      food: 100,
      materials: 80,
      secretTreasure: Math.random() < MERCHANT_SECRET_TREASURE_CHANCE
    };
  }

  // 棄民に特別な特性を追加
  if (visitorType.type === "棄民") {
    // 特別な精神特性をランダムで追加
    const specialTraits = [
      "達人農夫", "達人木樵", "達人狩人", "達人漁師", 
      "森の知恵", "海の知恵", "歴戦"
    ];
    const randomTrait = specialTraits[Math.floor(Math.random() * specialTraits.length)];
    visitor.mindTraits.push(randomTrait);
  }

  // 顔グラフィックを設定
  visitor.portraitFile = Array.isArray(visitorType.portraits) && visitorType.portraits.length > 0
    ? randChoice(visitorType.portraits)
    : selectPortraitByCharacter(visitor);
  
  // 精神性別が設定されていない場合は肉体性別と同じに設定
  if (!visitor.spiritSex) {
    visitor.spiritSex = visitor.bodySex;
  }

  return visitor;
}

function createBodyExchangedPairVisitor(selectedType, existingNames = []) {
  const satyr = buildVisitorFromType(SATYR_VISITOR_TYPE, existingNames, { registerName: false });
  const maenad = buildVisitorFromType(MAENAD_VISITOR_TYPE, [...existingNames, satyr.name], { registerName: false });
  exchangeGeneratedVisitorBodies(satyr, maenad);

  const visitor = selectedType === MAENAD_VISITOR_TYPE.type ? maenad : satyr;
  registerUsedName(visitor.name);
  return visitor;
}

export function createRandomVisitor(existingNames = [], forcedType = null, village = null) {
  const visitorType = forcedType
    ? (resolveForcedVisitorType(forcedType, village) || selectVisitorType(village))
    : selectVisitorType(village);

  if (isGoatPairVisitorType(visitorType)) {
    return createBodyExchangedPairVisitor(visitorType.type, existingNames);
  }

  return buildVisitorFromType(visitorType, existingNames);
}

export function createRandomVisitorOfType(type, existingNames = []) {
  return createRandomVisitor(existingNames, type);
}
