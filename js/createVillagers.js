// createVillagers.js

import { Villager } from "./classes.js";
import { randInt, randChoice, randNormalInRange } from "./util.js";
import { theVillage } from "./main.js";

/**
 * 初期村人の人数設定
 */
const INITIAL_MALE_COUNT = 3;   // 初期男性の人数
const INITIAL_FEMALE_COUNT = 3; // 初期女性の人数

// 使用済みの名前を追跡する Set を追加
const usedNames = new Set();

// 使用済みの顔グラフィックを追跡するSetを追加
export const usedPortraits = {
  male: new Set(),
  female: new Set()
};

// 顔グラフィックのファイル名リストを上部に移動し、グループ分けを明確に
export const MALE_PORTRAIT_FILES = {
  // 筋肉質・たくましいグループ
  GROUP_A: [
    "MA1.png", "MA2.png", "MA3.png", "MA4.png", "MA5.png", "MA6.png", "MA7.png", "MA8.png", "MA9.png", "MA10.png", "MA11.png", "MA12.png", "MA13.png", "MA14.png", "MA15.png", "MA16.png"
  ],
  
  // 美形・スマートグループ
  GROUP_B: [
    "MB1.png", "MB2.png", "MB3.png", "MB4.png", "MB5.png", "MB6.png", "MB7.png", "MB8.png", "MB9.png", "MB10.png", "MB11.png", "MB12.png", "MB13.png", "MB14.png", "MB15.png", "MB16.png", "MB17.png", "MB18.png", "MB19.png", "MB20.png", "MB21.png", "MB22.png", "MB23.png", "MB24.png"
  ],
  
  // 魅力高めグループ
  GROUP_C: [
    "MC1.png", "MC2.png", "MC3.png", "MC4.png", "MC5.png", "MC6.png", "MC7.png", "MC8.png", "MC9.png", "MC10.png", "MC11.png", "MC12.png", "MC13.png", "MC14.png", "MC15.png", "MC16.png", "MC17.png", "MC18.png", "MC19.png", "MC20.png", "MC21.png", "MC22.png", "MC23.png", "MC24.png", "MC25.png", "MC26.png", "MC27.png", "MC28.png", "MC29.png", "MC30.png", "MC31.png", "MC32.png", "MC33.png", "MC34.png", "MC35.png", "MC36.png", "MC37.png", "MC38.png", "MC39.png", "MC40.png", "MC41.png", "MC42.png", "MC43.png", "MC44.png", "MC45.png", "MC46.png", "MC47.png", "MC48.png", "MC49.png", "MC50.png", "MC51.png", "MC52.png", "MC53.png", "MC54.png", "MC55.png"
  ],
  
  // がっしり系グループ
  GROUP_D: [
    "MD1.png", "MD2.png", "MD3.png", "MD4.png", "MD5.png", "MD6.png", "MD7.png", "MD8.png", "MD9.png", "MD10.png", "MD11.png", "MD12.png", "MD13.png", "MD14.png", "MD15.png", "MD16.png", "MD17.png", "MD18.png", "MD19.png", "MD20.png", "MD21.png", "MD22.png", "MD23.png", "MD24.png", "MD25.png", "MD26.png", "MD27.png", "MD28.png", "MD29.png", "MD30.png"
  ],
  
  // 痩せ型・普通グループ
  GROUP_E: [
    "ME1.png", "ME2.png", "ME3.png", "ME4.png", "ME5.png", "ME6.png", "ME7.png", "ME8.png", "ME9.png", "ME10.png", "ME11.png", "ME12.png", "ME13.png", "ME14.png", "ME15.png", "ME16.png", "ME17.png", "ME18.png", "ME19.png", "ME20.png", "ME21.png", "ME22.png"
  ]
};

// 顔グラフィックのファイル名リストに女性用を追加
const FEMALE_PORTRAIT_FILES = {
  // 清楚・神秘グループ
  GROUP_A: [
"A1.png", "A2.png", "A3.png", "A4.png", "A5.png", "A6.png", "A7.png", "A8.png", "A9.png", "A10.png",
"A11.png", "A12.png", "A13.png", "A14.png", "A15.png", "A16.png", "A17.png", "A18.png", "A19.png", "A20.png",
"A21.png", "A22.png", "A23.png", "A24.png", "A25.png", "A26.png", "A27.png", "A28.png", "A29.png", "A30.png",
"A31.png", "A32.png", "A33.png", "A34.png", "A35.png", "A36.png", "A37.png", "A38.png", "A39.png", "A40.png",
"A41.png", "A42.png", "A43.png", "A44.png", "A45.png", "A46.png", "A47.png", "A48.png", "A49.png", "A50.png",
"A51.png", "A52.png", "A53.png", "A54.png", "A55.png", "A56.png", "A57.png", "A58.png"
  ],
  
  // 華やか・魅惑グループ
  GROUP_B: [
"BB1.png", "BB2.png", "BB3.png", "BB4.png", "BB5.png", "BB6.png", "BB7.png", "BB8.png", "BB9.png", "BB10.png",
"BB11.png", "BB12.png", "BB13.png", "BB14.png", "BB15.png", "BB16.png", "BB17.png", "BB18.png", "BB19.png", "BB20.png",
"BB21.png", "BB22.png", "BB23.png", "BB24.png", "BB25.png", "BB26.png", "BB27.png", "BB28.png", "BB29.png", "BB30.png",
"BB31.png", "BB32.png", "BB33.png", "BB34.png", "BB35.png", "BB36.png", "BB37.png", "BB38.png", "BB39.png", "BB40.png",
"BB41.png", "BB42.png", "BB43.png", "BB44.png", "BB45.png", "BB46.png", "BB47.png"

  ],
  
  // 凛々しい・健康的グループ
  GROUP_C: [
"C1.png", "C2.png", "C3.png", "C4.png", "C5.png", "C6.png", "C7.png", "C8.png", "C9.png", "C10.png",
"C11.png", "C12.png", "C13.png", "C14.png", "C15.png", "C16.png", "C17.png", "C18.png", "C19.png", "C20.png",
"C21.png", "C22.png", "C23.png", "C24.png", "C25.png", "C26.png", "C27.png", "C28.png", "C29.png", "C30.png",
"C31.png", "C32.png", "C33.png", "C34.png", "C35.png", "C36.png", "C37.png", "C38.png", "C39.png", "C40.png",
"C41.png", "C42.png", "C43.png", "C44.png", "C45.png", "C46.png", "C47.png", "C48.png", "C49.png", "C50.png",
"C51.png", "C52.png", "C53.png", "C54.png", "C55.png", "C56.png", "C57.png", "C58.png", "C59.png", "C60.png",
"C61.png", "C62.png", "C63.png", "C64.png", "C65.png", "C66.png", "C67.png", "C68.png", "C69.png", "C70.png",
"C71.png", "C72.png", "C73.png", "C74.png"
  ],
  
  // 普通・地味グループ
  GROUP_D: [
"D1.png", "D2.png", "D3.png", "D4.png", "D5.png", "D6.png", "D7.png", "D8.png", "D9.png", "D10.png",
"D11.png", "D12.png", "D13.png", "D14.png", "D15.png", "D16.png", "D17.png", "D18.png", "D19.png", "D20.png",
"D21.png", "D22.png", "D23.png", "D24.png", "D25.png", "D26.png", "D27.png", "D28.png", "D29.png", "D30.png",
"D31.png", "D32.png", "D33.png", "D34.png", "D35.png", "D36.png", "D37.png", "D38.png", "D39.png"
  ]
};

/**
 * 性別と能力値に応じて顔グラフィックを選択
 */
function selectPortraitByCharacter(character) {
  // グループから選択する前に、使用可能な顔グラフィックをフィルタリング
  const filterUnusedPortraits = (portraitList) => {
    return portraitList.filter(portrait => !usedPortraits[character.bodySex === "男" ? "male" : "female"].has(portrait));
  };

  if (character.bodySex === "男") {
    const bodyTraits = character.bodyTraits;
    let selectedGroup = null;
    
    // 1. まず特性による判定を行う
    if (bodyTraits.some(trait => [
      "巨漢", "怪力", "マッチョ", "筋骨隆々",
      "筋肉質", "巨躯"
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
      let male = new Villager(generateRandomName("男"), "男", randInt(18, 29));
      initRandomParams(male);
      assignBodyMindTraits(male);
      applyTraitParameterBonuses(male);
      assignHobby(male);
      refreshJobTable(male);
      male.portraitFile = selectPortraitByCharacter(male);
      villagers.push(male);
      maleCount++;
    } else {
      let female = new Villager(generateRandomName("女"), "女", randInt(18, 25));
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
export function createRandomVillager({ sex, minAge, maxAge, params = {}, ranges = {} }) {
  let age = randInt(minAge, maxAge);

  let nm = generateRandomName(sex);
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
  } else {
    // 通常のランダム初期化
    initRandomParams(vill);
  }

  assignBodyMindTraits(vill);
  applyTraitParameterBonuses(vill);
  assignHobby(vill);
  refreshJobTable(vill);
  
  // 顔グラフィックの設定
  // 襲撃者でない場合のみ顔グラフィックを設定
  if (!params.job || !["野盗", "ゴブリン", "狼", "キュクロプス", "ハーピー"].includes(params.job)) {
    if (sex === "男") {
      // 男性の場合の処理
      let selectedGroup = null;
      // ... 既存の顔グラフィック選択ロジック ...
    } else {
      // 女性の場合の処理
      // ... 既存の顔グラフィック選択ロジック ...
    }
  }

  return vill;
}

/**
 * ランダム名前生成(男/女)を修正
 */
export function generateRandomName(sex) {
  const maleNames = [
    "アルフ","ガルド","レオン","エルネスト","ヨハン","ハイン","グレン","ディルク","ロベルト","シュテファン",
    "オスカー","フィン","ルーカス","ヴィクトール","ベルトラン","ライオネル","ガブリエル","セルジオ","ミハエル","リッツ",
    "クライド","アードルフ","ダリオ","フリード","ハンツ","フェリクス","マキシム","オーウェン","バーン","タイラー",
    "ビルヘルム","イングラム","ジャスパー","レザルド","ガストン","ヘルマン","トリスタン","ファビアン","ヘリオス","アルドール",
    "ローエン","カロル","マルコ","アギル","ボリス","イライアス","サムソン","ブラッド","シモン","エリク",
    "ギルベルト","エドムント",
    "ロタール","バルタザール","テオドール","ラインハルト","ヴォルフガング","アーサー","ランスロット","ガウェイン",
    "パーシヴァル","ベディヴィア","ケイ","トリストラム",
    "アストラル","ファイアル","ソラリス","ルミナス","セレスト","ドラゴ","エオス","オリオン","アルテミス","クロノス",
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

  // 性別に応じた名前リストを選択
  const nameList = sex === "男" ? maleNames : femaleNames;
  
  // 使用可能な名前をフィルタリング
  const availableNames = nameList.filter(name => !usedNames.has(name));
  
  // 使用可能な名前がない場合、全ての名前を再利用可能にする
  if (availableNames.length === 0) {
    usedNames.clear();
    return randChoice(nameList);
  }
  
  // ランダムに名前を選択して使用済みとしてマーク
  const chosenName = randChoice(availableNames);
  usedNames.add(chosenName);
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
    v.sexdr = randNormalInRange(8, 35);
  } else {
    v.vit = randNormalInRange(5, 25);
    let mx = Math.min(25, v.vit * 1.5);
    if (mx < 5) mx = 5;
    v.str = randNormalInRange(5, Math.floor(mx));
    v.dex = randNormalInRange(5, 25);
    v.mag = randNormalInRange(14, 30);
    v.chr = randNormalInRange(14, 30);
    v.int = randNormalInRange(5, 25);
    v.ind = randNormalInRange(5, 25);
    let me = Math.min(30, Math.floor(v.ind * 1.8));
    if (me < 8) me = 8;
    v.eth = randNormalInRange(8, me);
    v.cou = randNormalInRange(3, 25);
    v.sexdr = randNormalInRange(3, 25);
  }

}

// 精神特性と口調タイプのマッピング
const SPEECH_TYPE_MAPPING = {
  "独善的": { male: "クールＭ", female: "クールＦ" },
  "読書家": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "小市民": { male: "普通Ｍ", female: "普通Ｆ" },
  "善人": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "強気": { male: "強気Ｍ", female: "強気Ｆ" },
  "無鉄砲": { male: "乱暴", female: "蓮っ葉" },
  "知性派": { male: "丁寧Ｍ", female: "中性的" },
  "働き者": { male: "普通Ｍ", female: "普通Ｆ" },
  "普通": { male: "普通Ｍ", female: "普通Ｆ" },
  "庶民的": { male: "普通Ｍ", female: "普通Ｆ" },
  "内向的": { male: "陰気", female: "内気" },
  "本の虫": { male: "陰気", female: "内気" },
  "勉強苦手": { male: "普通Ｍ", female: "普通Ｆ" },
  "天才肌": { male: "クールＭ", female: "中性的" },
  "学者肌": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "我慢強い": { male: "普通Ｍ", female: "普通Ｆ" },
  "正直者": { male: "普通Ｍ", female: "普通Ｆ" },
  "天然": { male: "お調子者", female: "おっとり" },
  "おしゃべり": { male: "お調子者", female: "ギャル風" },
  "怒りっぽい": { male: "乱暴", female: "蓮っ葉" },
  "残忍": { male: "乱暴", female: "蓮っ葉" },
  "酷薄": { male: "クールＭ", female: "クールＦ" },
  "昼行燈": { male: "普通Ｍ", female: "普通Ｆ" },
  "戦闘狂": { male: "乱暴", female: "強気Ｆ" },
  "根暗": { male: "陰気", female: "内気" },
  "無気力": { male: "陰気", female: "内気" },
  "マジメ": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "怠け者": { male: "陰気", female: "内気" },
  "ろくでなし": { male: "乱暴", female: "蓮っ葉" },
  "ワル": { male: "乱暴", female: "蓮っ葉" },
  "インテリヤクザ": { male: "クールＭ", female: "クールＦ" },
  "守銭奴": { male: "クールＭ", female: "クールＦ" },
  "優等生": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "策士": { male: "クールＭ", female: "クールＦ" },
  "神経質": { male: "陰気", female: "内気" },
  "女好き": { male: "お調子者", female: "快活" },
  "チャラい": { male: "お調子者", female: "ギャル風" },
  "情熱的": { male: "強気Ｍ", female: "強気Ｆ" },
  "男嫌い": { male: "陰気", female: "丁寧Ｆ" },
  "夢見がち": { male: "陰気", female: "ぶりっこ" },
  "好奇心旺盛": { male: "お調子者", female: "快活" },
  "冒険好き": { male: "強気Ｍ", female: "強気Ｆ" },
  "陰キャ": { male: "陰気", female: "内気" },
  "計算高い": { male: "クールＭ", female: "クールＦ" },
  "姉御肌": { male: "強気Ｍ", female: "強気Ｆ" },
  "古風": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "大雑把": { male: "乱暴", female: "蓮っ葉" },
  "臆病": { male: "陰気", female: "内気" },
  "寡黙": { male: "陰気", female: "内気" },
  "不器用": { male: "陰気", female: "内気" },
  "ぶっきらぼう": { male: "乱暴", female: "蓮っ葉" },
  "偏屈": { male: "陰気", female: "内気" },
  "利発": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "抜け目がない": { male: "クールＭ", female: "ぶりっこ" },
  "職人気質": { male: "普通Ｍ", female: "普通Ｆ" },
  "狡猾": { male: "クールＭ", female: "クールＦ" },
  "あざとい": { male: "お調子者", female: "ぶりっこ" },
  "鈍感": { male: "普通Ｍ", female: "普通Ｆ" },
  "泣き虫": { male: "陰気", female: "内気" },
  "おしゃれ": { male: "お調子者", female: "ギャル風" },
  "粗暴": { male: "乱暴", female: "蓮っ葉" },
  "男勝り": { male: "強気Ｍ", female: "強気Ｆ" },
  "潔癖": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "綺麗好き": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "暴れ者": { male: "乱暴", female: "蓮っ葉" },
  "好戦的": { male: "乱暴", female: "強気Ｆ" },
  "問題児": { male: "お調子者", female: "快活" },
  "草食系": { male: "陰気", female: "内気" },
  "スケベ": { male: "お調子者", female: "ギャル風" },
  "遊び人": { male: "お調子者", female: "ギャル風" },
  "むっつり": { male: "陰気", female: "内気" },
  "勇敢": { male: "強気Ｍ", female: "強気Ｆ" },
  "勇猛果敢": { male: "強気Ｍ", female: "強気Ｆ" },
  "豪傑": { male: "乱暴", female: "強気Ｆ" },
  "箱入り": { male: "丁寧Ｍ", female: "お嬢様" },
  "惚れっぽい": { male: "お調子者", female: "ぶりっこ" },
  "愚直": { male: "普通Ｍ", female: "普通Ｆ" },
  "夢想家": { male: "お調子者", female: "ぶりっこ" },
  "堅物": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "ストイック": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "仕事好き": { male: "普通Ｍ", female: "普通Ｆ" },
  "仕事の鬼": { male: "強気Ｍ", female: "強気Ｆ" },
  "頭脳派": { male: "クールＭ", female: "クールＦ" },
  "聡明": { male: "丁寧Ｍ", female: "中性的" },
  "才気煥発": { male: "丁寧Ｍ", female: "中性的" },
  "マッド": { male: "クールＭ", female: "中性的" },
  "享楽的": { male: "お調子者", female: "ギャル風" },
  "悪女": { male: "乱暴", female: "お嬢様" },
  "筋肉馬鹿": { male: "乱暴", female: "強気Ｆ" },
  "熱血": { male: "強気Ｍ", female: "強気Ｆ" },
  "世渡り上手": { male: "お調子者", female: "ギャル風" },
  "文武両道": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "愚鈍": { male: "陰気", female: "内気" },
  "強欲": { male: "クールＭ", female: "クールＦ" },
  "現実主義": { male: "丁寧Ｍ", female: "丁寧Ｆ" },
  "才女": { male: "丁寧Ｍ", female: "お嬢様" },
  "才色兼備": { male: "丁寧Ｍ", female: "お嬢様" },
  "肉食系": { male: "強気Ｍ", female: "ギャル風" }
};

/**
 * 精神特性から口調タイプを決定
 */
function determineSpeechType(character) {
  // デフォルトの口調
  const defaultSpeechType = character.bodySex === "男" ? "普通Ｍ" : "普通Ｆ";
  
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

  return character.bodySex === "男" ? speechTypes.male : speechTypes.female;
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
    { name: "絶世の美女", condition: (v) => v.bodySex === "女" && v.chr >= 28 },
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
    { name: "女好き", condition: (v) => v.bodySex === "男" && v.sexdr >= 25 },
    { name: "チャラい", condition: (v) => v.bodySex === "男" && v.sexdr >= 18 && v.chr >=18 },
    { name: "情熱的", condition: (v) => v.sexdr >= 19 && v.cou >= 19},
    { name: "男嫌い", condition: (v) => v.bodySex === "女" && v.sexdr <= 7 },
    { name: "夢見がち", condition: (v) => v.bodySex === "女" && v.sexdr >= 18 && v.int <= 15 },
    { name: "好奇心旺盛", condition: (v) => v.int >= 18 && v.sexdr >= 20 && v.dex >= 18 },
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
    { name: "むっつり", condition: (v) => v.eth >= 20 && v.sexdr >= 22 },
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
    { name: "色白", condition: (v)=>(v.vit<=12 && v.chr>=25), chance:0.1, target:"body" },
    { name: "寒がり", condition: (v)=>(v.str<=12 && v.vit<=12), chance:0.1, target:"mind" },
    { name: "大食い", condition: (v) =>(v.vit >= 22 && v.chr<=16), chance:0.1, target:"mind" },
    { name: "小食", condition: (v) =>(v.vit <= 12), chance:0.1, target:"mind" },
    { name: "汗かき", condition: (v)=>(v.vit>=24 && v.chr<=12), chance:0.2, target:"mind" },
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
  if (v.bodyAge >= 60) {
    v.bodyTraits.push("老人");
  } else if (v.bodyAge >= 40) {
    v.bodyTraits.push("中年");
  }

  // 精神特性が決定した後に口調タイプを設定
  v.speechType = determineSpeechType(v);
}

/**
 * 特性によるパラメーター修正
 */
export function applyTraitParameterBonuses(v) {
  if (v.bodyTraits.includes("聖女の輝き")) {
    v.chr += 10; 
    v.mag += 10;
  }
  if (v.bodyTraits.includes("巨躯")) {
    v.str += 10;
  }
  if (v.mindTraits.includes("ワーカホリック")) {
    v.ind += 3;
  }
  if (v.mindTraits.includes("ニート")) {
    v.ind -= 2;
  }
  if (v.mindTraits.includes("箱入り")) {
    v.chr += 5;
  }
  if (v.mindTraits.includes("内向的")) {
    v.int += 4; 
    v.ind += 6; 
    v.eth += 4;
  }
  if (v.mindTraits.includes("本の虫")) {
    v.int += 8;
  }

  // 加齢
  if (v.bodyAge >= 60) {
    if (!v.bodyTraits.includes("老人")) v.bodyTraits.push("老人");
    v.str = Math.floor(v.str * 0.5);
    v.vit = Math.floor(v.vit * 0.5);
    v.chr = Math.floor(v.chr * 0.5);
  } else if (v.bodyAge >= 40) {
    if (!v.bodyTraits.includes("中年")) v.bodyTraits.push("中年");
    v.str = Math.floor(v.str * 0.75);
    v.vit = Math.floor(v.vit * 0.75);
    v.chr = Math.floor(v.chr * 0.75);
  }
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
      "大食い","美食","筋トレ","滝行","自由研究","釣り","自家発電","読書",
      "祈り","ナンパ","ショッピング","散歩","噂話","園芸","詩作","推し活",
      "瞑想","飲酒","ギャンブル","投資","天体観測","狩猟"
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
export function refreshJobTable(v) {
  let sa = v.spiritAge;
  if (sa <= 9) {
    v.jobTable = ["なし"];
    v.actionTable = ["なし"];
    if (!v.jobTable.includes(v.job)) {
      v.job = "なし";
    }
    if (!v.actionTable.includes(v.action)) {
      v.action = v.job;
    }
    return;
  } else if (sa <= 15) {
    v.jobTable = ["学業","鍛錬","なし"];
    v.actionTable = ["学業","鍛錬","休養","余暇"];
    if (!v.jobTable.includes(v.job)) {
      v.job = "なし";
    }
    if (!v.actionTable.includes(v.action)) {
      v.action = v.job;
    }
    return;
  } else {
    // 基本の仕事テーブル（共通）
    let commonJobs = [
      "なし",
      "農作業", "狩猟", "漁",
      "伐採",
      "採集", "内職", "行商",
      "研究", "警備", "看護"
    ];

    // 建築物によって解放される仕事
    const village = import("./main.js").then(m => m.theVillage);
    const buildingFlags = village.buildingFlags || {};

    // 建築物によって解放される共通の仕事
    if (buildingFlags.hasClinic) {
      commonJobs.push("あんま");
    }
    if (buildingFlags.hasLibrary) {
      commonJobs.push("写本");
    }
    if (buildingFlags.hasBrewery) {
      commonJobs.push("醸造");
    }
    if (buildingFlags.hasAlchemy) {
      commonJobs.push("錬金術");
    }
    if (buildingFlags.hasWeaving) {
      commonJobs.push("機織り");
    }

    // 性別に応じた仕事テーブル
    if (v.bodySex === "男") {
      v.jobTable = [
        ...commonJobs,
        "詩人", "神官"
      ];
    } else {
      v.jobTable = [
        ...commonJobs,
        "踊り子", "シスター"
      ];

      // 女性限定の建築物依存の仕事
      if (buildingFlags.hasTavern) {
        v.jobTable.push("バニー");
      }
      if (buildingFlags.hasChurch) {
        v.jobTable.push("巫女");
      }
    }

    // 性別に応じた行動テーブル
    if (v.bodySex === "男") {
      v.actionTable = [
        "休養", "余暇",
        "農作業", "狩猟", "漁",
        "伐採",
        "採集", "内職", "行商",
        "研究", "警備", "看護",
        "詩人", "神官"
      ];

      // 建築物によって解放される共通の仕事を行動テーブルにも追加
      if (buildingFlags.hasClinic) {
        v.actionTable.push("あんま");
      }
      if (buildingFlags.hasLibrary) {
        v.actionTable.push("写本");
      }
      if (buildingFlags.hasBrewery) {
        v.actionTable.push("醸造");
      }
      if (buildingFlags.hasAlchemy) {
        v.actionTable.push("錬金術");
      }
      if (buildingFlags.hasWeaving) {
        v.actionTable.push("機織り");
      }
    } else {
      v.actionTable = [
        "休養", "余暇",
        "農作業", "狩猟", "漁",
        "伐採",
        "採集", "内職", "行商",
        "研究", "警備", "看護",
        "踊り子", "シスター"
      ];

      // 建築物によって解放される共通の仕事を行動テーブルにも追加
      if (buildingFlags.hasClinic) {
        v.actionTable.push("あんま");
      }
      if (buildingFlags.hasLibrary) {
        v.actionTable.push("写本");
      }
      if (buildingFlags.hasBrewery) {
        v.actionTable.push("醸造");
      }
      if (buildingFlags.hasAlchemy) {
        v.actionTable.push("錬金術");
      }
      if (buildingFlags.hasWeaving) {
        v.actionTable.push("機織り");
      }

      // 女性限定の建築物依存の仕事を行動テーブルにも追加
      if (buildingFlags.hasTavern) {
        v.actionTable.push("バニー");
      }
      if (buildingFlags.hasChurch) {
        v.actionTable.push("巫女");
      }
    }

    if (!v.jobTable.includes(v.job)) {
      v.job = "なし";
    }
    if (!v.actionTable.includes(v.action)) {
      v.action = v.job;
    }
  }

  // 襲撃関連の行動追加（状態異常がない場合のみ）
  if (theVillage.villageTraits.includes("襲撃中")) {
    v.actionTable.unshift("迎撃", "罠作成");
  }
}

/**
 * 訪問者タイプの定義
 */
const VISITOR_TYPES = [
  {
    type: "流民",
    weight: 35,
    ageRange: { min: 16, max: 30 },  // 幅広い年齢層
    params: {
      job: "流民",
      action: "訪問"
    },
    status: "normal",
  },
  {
    type: "冒険者",
    weight: 10,
    ageRange: { min: 18, max: 35 },
    params: {
      job: "冒険者",
      action: "訪問"
    },
    ranges: {
      str: [18, 25],  // 高い筋力
      vit: [18, 25],  // 高い体力
      cou: [20, 25]   // 高い勇気
    }
  },
  {
    type: "巡礼者",
    weight: 10,
    ageRange: { min: 16, max: 30 },
    params: {
      job: "巡礼者",
      action: "訪問"
    },
    ranges: {
      mag: [18, 25],  // 高い魔力
      eth: [20, 25],  // 高い倫理
      sexdr: [5, 15]  // 低い好色
    }
  },
  {
    type: "学者",
    weight: 10,
    ageRange: { min: 20, max: 65 },
    params: {
      job: "学者",
      action: "訪問"
    },
    ranges: {
      int: [20, 27],  // 高い知力
      ind: [20, 24],  // やや高い勤勉
      str: [5, 15],   // 低い筋力
     }
  },
  {
    type: "観光客",
    weight: 15,
    ageRange: { min: 16, max: 25 },  // 幅広い年齢層
    params: {
      job: "観光客",
      action: "訪問"
    },
  },
  {
    type: "旅人",
    weight: 10,
    ageRange: { min: 18, max: 30 },  // 青年～中年
    params: {
      job: "旅人",
      action: "訪問"
    },
  },
  {
    type: "行商人",
    weight: 10,
    ageRange: { min: 20, max: 35 },
    params: {
      job: "行商人",
      action: "訪問"
    },
    ranges: {
      chr: [16, 22],  // 高い魅力
      dex: [12, 20],  // やや高い器用
      int: [12, 20],  // やや高い知力
      ind: [18, 25]   // やや高い勤勉
    }
  }
];

/**
 * 重み付き抽選で訪問者タイプを選択
 */
function selectVisitorType() {
  const totalWeight = VISITOR_TYPES.reduce((sum, type) => sum + type.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const visitorType of VISITOR_TYPES) {
    random -= visitorType.weight;
    if (random <= 0) {
      return visitorType;
    }
  }
  return VISITOR_TYPES[0]; // フォールバック
}

/**
 * 訪問者を生成する関数
 */
export function createRandomVisitor() {
  const visitorType = selectVisitorType();
  
  // 性別を明示的に設定（visitorTypeに指定がなければランダム）
  const bodySex = visitorType.forcedSex || (Math.random() < 0.5 ? "男" : "女");
  
  const visitor = createRandomVillager({
    sex: bodySex,  // 肉体性別を明示的に設定
    minAge: visitorType.ageRange.min,
    maxAge: visitorType.ageRange.max,
    params: {
      ...visitorType.params
    },
    ranges: visitorType.ranges
  });

  // 訪問者の名前を修正
  visitor.name = `${visitorType.type}の${visitor.name}`;
  
  // 行動テーブルを訪問のみに制限
  visitor.actionTable = ["訪問"];
  
  // 精神特性に訪問者を追加（1回のみ）
  visitor.mindTraits.push("訪問者");

  // 顔グラフィックを設定
  visitor.portraitFile = selectPortraitByCharacter(visitor);
  
  // 精神性別が設定されていない場合は肉体性別と同じに設定
  if (!visitor.spiritSex) {
    visitor.spiritSex = visitor.bodySex;
  }

  return visitor;
}
