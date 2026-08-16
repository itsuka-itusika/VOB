// 冒険者へ依頼できるクエストの固定データ。

export const ADVENTURER_QUEST_COST = 100;
export const ADVENTURER_QUEST_DURATION_MONTHS = 6;
export const ADVENTURER_QUEST_ACCEPTED_TRAIT = "依頼受諾";

export const ADVENTURER_QUEST_STAT_LABELS = {
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

export const ADVENTURER_QUEST_TEMPLATES = [
  {
    id: "bandit_fort",
    title: "野盗砦への夜襲",
    description: "山道を荒らす野盗の砦へ忍び込み、頭目を討つ。",
    bodyStat: "str",
    mindStat: "cou"
  },
  {
    id: "serpent_ruins",
    title: "蛇神殿の探索",
    description: "密林に沈んだ蛇神の祭殿から、秘宝を持ち帰る。",
    bodyStat: "dex",
    mindStat: "int"
  },
  {
    id: "marsh_escort",
    title: "沼地越えの護衛",
    description: "毒気の漂う沼地を越え、巡礼の一団を聖堂まで送り届ける。",
    bodyStat: "vit",
    mindStat: "eth"
  },
  {
    id: "sealed_reliquary",
    title: "封印祭具の回収",
    description: "魔素に閉ざされた地下祭室へ入り、古い祭具を回収する。",
    bodyStat: "mag",
    mindStat: "int"
  },
  {
    id: "collapsed_mine",
    title: "崩れた坑道の救助",
    description: "崩落した坑道を掘り進み、取り残された鉱夫を救い出す。",
    bodyStat: "str",
    mindStat: "ind"
  },
  {
    id: "beast_hunt",
    title: "森喰らいの追跡",
    description: "森の獣道をたどり、里を脅かす魔獣を狩る。",
    bodyStat: "dex",
    mindStat: "cou"
  },
  {
    id: "plague_tower",
    title: "疫病塔の踏破",
    description: "病の残る廃塔を踏破し、最上階に眠る秘宝を回収する。",
    bodyStat: "vit",
    mindStat: "ind"
  },
  {
    id: "merchant_decoy",
    title: "隊商を狙う囮役",
    description: "豪商を装って街道を進み、隊商を狙う賊を誘い出す。",
    bodyStat: "chr",
    mindStat: "cou"
  },
  {
    id: "maiden_rite",
    title: "月女神の祭殿潜入",
    description: "女人のみが入れる月女神の祭殿へ参列し、奪われた聖印を取り戻す。",
    bodyStat: "chr",
    mindStat: "eth",
    requiredBodySex: "女"
  },
  {
    id: "noble_ball_infiltration",
    title: "貴族の舞踏会への潜入",
    description: "貴族の舞踏会へ客を装って潜り込み、密かに持ち込まれた秘宝を奪還する。",
    bodyStat: "chr",
    mindStat: "sexdr",
    requiredBodySex: "女"
  }
];

// 売値だけでなく、戦況を覆す即効性や恒久効果も加味した基礎成功率。
export const ADVENTURER_QUEST_BASE_SUCCESS_RATES = {
  persephone_statue: 25,
  abundance_horn: 27.5,
  armless_angel: 30,
  golden_arrow: 35,
  golden_apple: 37.5,
  ambrosia: 25,
  nectar: 40,
  strange_calculator: 25,
  serpent_staff: 20,
  grotesque_portrait: 35,
  chronos_elixir: 22.5,
  dryad_fruit: 32.5,
  old_priest_statue: 37.5,
  pan_flute: 32.5,
  golden_mask: 20
};
