export const RAIDER_TYPES = [
  {
    type: "野盗",
    weight: 30,  // 出現率30%
    minCount: 2,
    maxCount: 3,
    race: "人間",
    forcedSex: "男",  // 性別を男に固定
    ageRange: { min: 18, max: 45 },  // 青年～中年
    params: {
      job: "野盗",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: [
      "BAN1.png", "BAN2.png", "BAN3.png", "BAN4.png", "BAN5.png",
      "BAN6.png", "BAN7.png", "BAN8.png", "BAN9.png", "BAN10.png",
      "BAN11.png", "BAN12.png", "BAN13.png", "BAN14.png", "BAN15.png",
      "BAN16.png", "BAN17.png", "BAN18.png", "BAN19.png", "BAN20.png", "BAN20.png"
    ],
    ranges: {
      hp: [50, 70],
      str: [15, 21],
      vit: [8, 25],
      dex: [10, 20],
      mag: [5, 12],
      chr: [3, 15],
      int: [5, 16],
      ind: [3, 12],
      eth: [1, 9],
      cou: [13, 20],
      sexdr: [15, 25]
    },
    dialogues: [
      "戸を破れ！蔵を探せ、隠した袋まで持っていけ！",
      "おとなしく全財産を差し出せ！抵抗するなら容赦しないぞ！",
      "この村は今から俺たちのものだ。抵抗は無駄だ！",
      "女も寄越せ！さもなくば皆殺しだ！",
      "火をつけられたくなけりゃ、そこをどけ！",
      "腹が減って気が立ってるんだ。邪魔する奴から叩き伏せる！"
    ]
  },
  {
    type: "傭兵団",
    weight: 18,
    minCount: 3,
    maxCount: 4,
    race: "人間",
    forcedSex: "男",
    ageRange: { min: 18, max: 45 },
    params: {
      job: "傭兵団",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: [
      "BAN1.png", "BAN2.png", "BAN3.png", "BAN4.png", "BAN5.png",
      "BAN6.png", "BAN7.png", "BAN8.png", "BAN9.png", "BAN10.png",
      "BAN11.png", "BAN12.png", "BAN13.png", "BAN14.png", "BAN15.png",
      "BAN16.png", "BAN17.png", "BAN18.png", "BAN19.png", "BAN20.png", "BAN20.png"
    ],
    ranges: {
      hp: [65, 85],
      str: [18, 24],
      vit: [14, 28],
      dex: [12, 22],
      mag: [5, 13],
      chr: [5, 16],
      int: [8, 18],
      ind: [8, 18],
      eth: [2, 10],
      cou: [16, 23],
      sexdr: [10, 22]
    },
    dialogues: [
      "金を出せば命だけは助けてやる！",
      "ここの村長を出せ！交渉したい事がある。",
      "金も食料も、抵抗する力も、まとめていただく。",
      "命が惜しければ道を開けろ。仕事は手早く済ませる。",
      "村の備蓄を押さえろ。散るな、固まって動け！",
      "取り分を減らすなよ。ぐずぐずしてると夜が明ける。"
    ]
  },
  {
    type: "ゴブリン",
    weight: 25,
    minCount: 4,
    maxCount: 5,
    race: "ゴブリン",
    forcedSex: "男",
    ageRange: { min: 15, max: 30 },  // 若いゴブリン
    params: {
      job: "ゴブリン",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: [
      "GOB1.png", "GOB2.png", "GOB3.png", "GOB4.png", "GOB5.png",
      "GOB6.png", "GOB7.png", "GOB8.png", "GOB9.png", "GOB10.png", "GOB11.png", "GOB12.png", "GOB13.png"
    ],
    ranges: {
      hp: [30, 50],
      str: [12, 18],
      vit: [5, 15],
      dex: [18, 25],
      mag: [5, 11],
      chr: [3, 10],
      int: [5, 12],
      ind: [5, 12],
      eth: [1, 5],
      cou: [5, 12],
      sexdr: [18, 25]
    },
    dialogues: [
      "キヒヒ！村の秘宝をよこすのだ！",
      "ゴブゴブ！人間は弱いから殺して食べるのだ！",
      "キャッキャッ！女を連れて帰るのだ！",
      "ゴブリン族の力を思い知るのだ！",
      "人間の村を奪うのだ！ここはゴブリンの新しい巣になるのだ！",
      "食料をよこせ！さもなくば皆殺しにするのだ！"
    ]
  },
  {
    type: "狼",
    weight: 20,
    minCount: 2,
    maxCount: 3,
    race: "狼",
    ageRange: { min: 3, max: 8 },  // 若い～成熟した狼
    params: {
      job: "狼",
      action: "襲撃"
    },
    raidPosition: "front",
    ranges: {
      hp: [30, 50],
      str: [15, 20],
      vit: [8, 16],
      dex: [3, 8],
      mag: [10, 15],
      chr: [12, 16],
      int: [1, 5],
      ind: [5, 15],
      eth: [5, 15],
      cou: [20, 25],
      sexdr: [10, 20]
    },
    bodyTraits: ["筋肉質", "毛艶がいい", "精悍", "痩せぎす", "細身", "強面"],
    forcedBodyTraits: ["モフモフ"],
    hobbies: ["散歩", "狩り", "毛づくろい", "繁殖", "子育て", "喧嘩", "日光浴"],
    dialogues: [
      "グルルル...（獲物を見つけたようだ）",
      "ウゥゥ...ガウッ！（空腹で凶暴になっている）",
      "キャンキャン...（仲間を呼んでいるようだ）",
      "フンフン...（村の匂いを嗅いでいる）",
      "ハァハァ...（獲物を前に興奮している）",
      "ウォォォン！（襲撃の合図を出している）"
    ],
    portraits: [
      "WOLF1.png", "WOLF2.png", "WOLF3.png", "WOLF4.png", "WOLF5.png",
      "WOLF6.png"
    ],
  },
  {
    type: "餓狼",
    displayType: "狼",
    weight: 0,
    minCount: 3,
    maxCount: 4,
    race: "狼",
    ageRange: { min: 3, max: 8 },
    params: {
      job: "狼",
      action: "襲撃"
    },
    raidPosition: "front",
    ranges: {
      hp: [30, 50],
      str: [15, 20],
      vit: [8, 16],
      dex: [3, 8],
      mag: [10, 15],
      chr: [12, 16],
      int: [1, 5],
      ind: [5, 15],
      eth: [5, 15],
      cou: [27, 34],
      sexdr: [10, 20]
    },
    bodyTraits: ["筋肉質", "毛艶がいい", "精悍", "痩せぎす", "細身", "強面"],
    forcedBodyTraits: ["モフモフ"],
    mindTraits: ["餓狼"],
    hobbies: ["散歩", "狩り", "毛づくろい", "繁殖", "子育て", "喧嘩", "日光浴"],
    dialogues: [
      "グルルル...（飢えた群れが村へにじり寄る）",
      "ウゥゥ...ガウッ！（強い飢えと殺気を放っている）",
      "キャンキャン...（群れの仲間を呼んでいるようだ）",
      "フンフン...（獲物の匂いを逃さない）",
      "ハァハァ...（獲物を前に興奮している）",
      "ウォォォン！（飢えた群れが一斉に吠える）"
    ],
    portraits: [
      "WOLF1.png", "WOLF2.png", "WOLF3.png", "WOLF4.png", "WOLF5.png",
      "WOLF6.png"
    ],
  },
  {
    type: "キュクロプス",
    weight: 10,
    minCount: 1,
    maxCount: 1,
    race: "巨人",
    forcedSex: "男",
    ageRange: { min: 30, max: 60 },  // 成熟～老齢の巨人
    params: {
      job: "キュクロプス",
      action: "襲撃"
    },
    raidPosition: "front",
    ranges: {
      hp: [90, 120],
      str: [28, 35],
      vit: [28, 35],
      dex: [5, 15],
      mag: [5, 15],
      chr: [3, 12],
      int: [3, 8],
      ind: [5, 15],
      eth: [5, 15],
      cou: [20, 25],
      sexdr: [10, 20]
    },
    forcedBodyTraits: ["巨躯", "単眼"],
    dialogues: [
      "ウオォォ！小さい人間ども、潰してやる！",
      "腹が減った...人間を食べる...！",
      "この村を平らにしてやる！逃げられると思うな！",
      "お前たちの家畜をよこせ！抵抗するなら踏み潰す！",
      "キュクロプスの怒りを知るがいい！",
      "人間は弱すぎる...簡単に潰せる..."
    ],
    portraits: [
      "CYCLOPS1.png", "CYCLOPS2.png", "CYCLOPS3.png", "CYCLOPS4.png"
    ],
  },
  {
    type: "ハーピー",
    weight: 15,
    minCount: 2,
    maxCount: 3,
    race: "ハーピー",
    forcedSex: "女",
    ageRange: { min: 16, max: 25 },  // 若い～成熟したハーピー
    params: {
      job: "ハーピー",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: [
      "HARPY1.png", "HARPY2.png", "HARPY3.png", "HARPY4.png",
      "HARPY5.png", "HARPY6.png", "HARPY7.png", "HARPY8.png",
      "HARPY9.png", "HARPY10.png", "HARPY11.png", "HARPY12.png"

    ],
    ranges: {
      hp: [50, 70],
      str: [16, 22],
      vit: [8, 18],
      dex: [1, 5],
      mag: [15, 20],
      chr: [18, 25],
      int: [5, 12],
      ind: [5, 12],
      eth: [5, 12],
      cou: [16, 22],
      sexdr: [10, 20]
    },
    forcedBodyTraits: ["飛行", "澄んだ声"],
    hobbies: ["遠乗り", "狩り", "羽づくろい", "繁殖", "子育て", "喧嘩", "日光浴", "歌唱"],
    dialogues: [
      "キャハハ！素敵なものを見つけたわ！",
      "あら、可愛い村ね。頂いちゃうわ！",
      "私たちの歌声で魅了してあげる♪",
      "空から襲えば逃げ場なんてないのよ！",
      "秘宝は全部私のもの！さあ、出しなさい！",
      "美しいものが大好き！あなたの持っているキラキラしたものを全部頂戴！"
    ]
  },
  {
    type: "ハーピーの長",
    displayType: "ハーピー",
    role: "leader",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "ハーピー",
    forcedSex: "女",
    ageRange: { min: 25, max: 30 },
    params: {
      job: "ハーピー",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: [
      "HARPY1.png", "HARPY2.png", "HARPY3.png", "HARPY4.png",
      "HARPY5.png", "HARPY6.png", "HARPY7.png", "HARPY8.png",
      "HARPY9.png", "HARPY10.png", "HARPY11.png", "HARPY12.png"

    ],
    ranges: {
      hp: [70, 90],
      str: [18, 24],
      vit: [12, 22],
      dex: [2, 7],
      mag: [20, 26],
      chr: [20, 28],
      int: [10, 18],
      ind: [8, 15],
      eth: [5, 12],
      cou: [20, 26],
      sexdr: [10, 20]
    },
    forcedBodyTraits: ["飛行", "澄んだ声"],
    mindTraits: ["首長"],
    hobbies: ["遠乗り", "狩り", "羽づくろい", "繁殖", "子育て", "喧嘩", "日光浴", "歌唱"],
    dialogues: [
      "キャハハ！いいわ、みんなでこの村をさらってしまいましょう！",
      "空を見なさい。逃げ道なんて最初からないのよ。",
      "下の子たち、好きにお取り。光るものも食料も全部よ！",
      "私の声に合わせなさい。ばらばらに飛んじゃだめ。",
      "この村の一番きれいなものを、私の巣へ運びなさい！",
      "さあ、群れの力を見せてあげるわ！"
    ]
  }

];

const DEFAULT_RAID_DEFENSE = {
  surviveTurns: 5,
  defeatAll: true
};

const DEFAULT_RAID_SUCCESS_REWARDS = {
  completeHappiness: 20,
  partialHappiness: 10
};

const DEFAULT_RAID_FAILURE_PENALTY = {
  foodRate: 0.2,
  materialsRate: 0.2,
  fundsRate: 0.2,
  security: 10,
  villagerHpRange: [5, 15],
  villagerHappiness: 30
};

const RAIDER_TYPE_BY_TYPE = new Map(RAIDER_TYPES.map(raiderType => [raiderType.type, raiderType]));

function cloneRaidRules(value) {
  return JSON.parse(JSON.stringify(value));
}

function createExistingRaiderRaid(id, raiderTypeName, overrides = {}) {
  const raiderType = RAIDER_TYPE_BY_TYPE.get(raiderTypeName);
  if (!raiderType) {
    throw new Error(`Unknown raider type: ${raiderTypeName}`);
  }

  return {
    id,
    name: `${raiderTypeName}の襲撃`,
    warningName: raiderTypeName,
    weight: raiderType.weight,
    avoidance: overrides.avoidance || null,
    representative: overrides.representative || null,
    introDialogues: overrides.introDialogues || [],
    defense: cloneRaidRules(DEFAULT_RAID_DEFENSE),
    enemyGroups: [
      {
        raiderType: raiderTypeName,
        minCount: raiderType.minCount,
        maxCount: raiderType.maxCount
      }
    ],
    successRewards: cloneRaidRules(DEFAULT_RAID_SUCCESS_REWARDS),
    failurePenalty: cloneRaidRules(DEFAULT_RAID_FAILURE_PENALTY)
  };
}

function createCompositeRaiderRaid({
  id,
  name,
  warningName,
  weight,
  enemyGroups,
  disableScaleWeightBonus = false,
  avoidance = null,
  representative = null,
  introDialogues = []
}) {
  return {
    id,
    name,
    warningName,
    weight,
    disableScaleWeightBonus,
    avoidance,
    representative,
    introDialogues,
    defense: cloneRaidRules(DEFAULT_RAID_DEFENSE),
    enemyGroups,
    successRewards: cloneRaidRules(DEFAULT_RAID_SUCCESS_REWARDS),
    failurePenalty: cloneRaidRules(DEFAULT_RAID_FAILURE_PENALTY)
  };
}

export const FALLBACK_RAID_RULES = {
  id: "fallback",
  name: "襲撃",
  warningName: "襲撃者",
  avoidance: null,
  defense: cloneRaidRules(DEFAULT_RAID_DEFENSE),
  successRewards: cloneRaidRules(DEFAULT_RAID_SUCCESS_REWARDS),
  failurePenalty: cloneRaidRules(DEFAULT_RAID_FAILURE_PENALTY)
};

export const RAID_MODULES = [
  createExistingRaiderRaid("bandit", "野盗"),
  createExistingRaiderRaid("mercenary-band", "傭兵団", {
    avoidance: {
      type: "resourcePayment",
      resource: "funds",
      label: "金を払う",
      rate: 0.4,
      minAmount: 200
    },
    introDialogues: [
      "この村を焼く契約は受けている。だが、今すぐ金を出すなら見逃してやる。",
      "命まで買いたいなら、相応の金を積め。足りなければ仕事に移るだけだ。",
      "金で済ませるか、刃で払うか。選ぶ時間は長くないぞ。"
    ]
  }),
  createExistingRaiderRaid("goblin", "ゴブリン"),
  createExistingRaiderRaid("wolf", "狼"),
  createExistingRaiderRaid("cyclops", "キュクロプス"),
  createExistingRaiderRaid("harpy", "ハーピー"),
  createCompositeRaiderRaid({
    id: "harpy-swarm",
    name: "ハーピーの大群",
    warningName: "ハーピーの大群",
    weight: 14,
    disableScaleWeightBonus: true,
    representative: { raiderType: "ハーピーの長", role: "leader" },
    enemyGroups: [
      { raiderType: "ハーピー", minCount: 3, maxCount: 4 },
      { raiderType: "ハーピーの長", minCount: 1, maxCount: 1 }
    ]
  }),
  createCompositeRaiderRaid({
    id: "starving-wolves",
    name: "餓狼の群れ",
    warningName: "餓狼の群れ",
    weight: 18,
    enemyGroups: [
      { raiderType: "餓狼", minCount: 3, maxCount: 4 }
    ]
  }),
  createCompositeRaiderRaid({
    id: "cyclops-band",
    name: "キュクロプス団",
    warningName: "キュクロプス団",
    weight: 6,
    disableScaleWeightBonus: true,
    enemyGroups: [
      { raiderType: "キュクロプス", minCount: 2, maxCount: 3 }
    ]
  })
];

const RAID_MODULE_BY_ID = new Map(RAID_MODULES.map(raid => [raid.id, raid]));

export const RAID_SCALE_TABLES = [
  {
    id: "early-frontier",
    scaleStageIndexes: [0, 1],
    entries: [
      { raidId: "goblin", weight: 30 },
      { raidId: "wolf", weight: 28 },
      { raidId: "bandit", weight: 30 },
      { raidId: "harpy", weight: 6 }
    ]
  },
  {
    id: "border-travel",
    scaleStageIndexes: [2, 3],
    entries: [
      { raidId: "bandit", weight: 18 },
      { raidId: "wolf", weight: 14 },
      { raidId: "goblin", weight: 22 },
      { raidId: "harpy", weight: 14 },
      { raidId: "cyclops", weight: 8 },
      { raidId: "mercenary-band", weight: 16 }
    ]
  },
  {
    id: "rich-village",
    scaleStageIndexes: [4],
    entries: [
      { raidId: "mercenary-band", weight: 24 },
      { raidId: "harpy", weight: 16 },
      { raidId: "cyclops", weight: 10 },
      { raidId: "harpy-swarm", weight: 14 },
      { raidId: "starving-wolves", weight: 18 },
      { raidId: "goblin", weight: 8 }
    ]
  },
  {
    id: "prosperous",
    minScaleStageIndex: 5,
    entries: [
      { raidId: "mercenary-band", weight: 22 },
      { raidId: "harpy-swarm", weight: 22 },
      { raidId: "starving-wolves", weight: 18 },
      { raidId: "cyclops", weight: 10 },
      { raidId: "cyclops-band", weight: 6 },
      { raidId: "harpy", weight: 6 },
      { raidId: "goblin", weight: 6 }
    ]
  }
];

export function getRaiderTypeByType(type) {
  return RAIDER_TYPE_BY_TYPE.get(type) || null;
}

export function getRaidModuleById(id) {
  return RAID_MODULE_BY_ID.get(id) || null;
}

export function getRaidRulesById(id) {
  const raid = getRaidModuleById(id) || FALLBACK_RAID_RULES;
  return {
    ...FALLBACK_RAID_RULES,
    ...raid,
    defense: {
      ...FALLBACK_RAID_RULES.defense,
      ...(raid.defense || {})
    },
    successRewards: {
      ...FALLBACK_RAID_RULES.successRewards,
      ...(raid.successRewards || {})
    },
    failurePenalty: {
      ...FALLBACK_RAID_RULES.failurePenalty,
      ...(raid.failurePenalty || {})
    }
  };
}

function matchesRepresentativeSelector(enemy, selector) {
  if (!enemy || !selector || typeof selector !== "object") return false;

  let hasCondition = false;
  const exactFields = [
    ["raiderType", enemy.raiderType],
    ["role", enemy.raiderRole],
    ["job", enemy.job],
    ["race", enemy.race]
  ];

  for (const [field, value] of exactFields) {
    if (!selector[field]) continue;
    hasCondition = true;
    if (value !== selector[field]) return false;
  }

  if (selector.mindTrait) {
    hasCondition = true;
    if (!Array.isArray(enemy.mindTraits) || !enemy.mindTraits.includes(selector.mindTrait)) return false;
  }

  if (selector.bodyTrait) {
    hasCondition = true;
    if (!Array.isArray(enemy.bodyTraits) || !enemy.bodyTraits.includes(selector.bodyTrait)) return false;
  }

  return hasCondition;
}

export function getRaidRepresentative(raidDefinition, raidEnemies) {
  const enemies = Array.isArray(raidEnemies) ? raidEnemies : [];
  if (enemies.length === 0) return null;

  const representative = raidDefinition?.representative;
  const selectors = Array.isArray(representative)
    ? representative
    : (representative ? [representative] : []);

  for (const selector of selectors) {
    const match = enemies.find(enemy => matchesRepresentativeSelector(enemy, selector));
    if (match) return match;
  }

  return enemies[0];
}
