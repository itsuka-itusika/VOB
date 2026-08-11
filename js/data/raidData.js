function numberedPortraits(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}.png`);
}

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
    ageRange: { min: 16, max: 30 },  // 若いゴブリン
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
      cou: [7, 15],
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
    forcedBodyTraits: ["四足歩行", "嗅覚鋭敏"],
    mindTraits: ["野生"],
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
    forcedBodyTraits: ["四足歩行", "嗅覚鋭敏"],
    mindTraits: ["餓狼", "野生"],
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
    race: "キュクロプス",
    forcedSex: "男",
    ageRange: { min: 30, max: 60 },  // 成熟～老齢のキュクロプス
    params: {
      job: "キュクロプス",
      action: "襲撃"
    },
    raidPosition: "front",
    ranges: {
      hp: [90, 120],
      str: [23, 30],
      vit: [23, 30],
      dex: [5, 15],
      mag: [5, 15],
      chr: [3, 12],
      int: [3, 8],
      ind: [5, 15],
      eth: [5, 15],
      cou: [20, 25],
      sexdr: [10, 20]
    },
    forcedBodyTraits: ["巨人", "単眼"],
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
  },
  {
    type: "遊牧民",
    weight: 0,
    minCount: 3,
    maxCount: 4,
    race: "人間",
    forcedSex: "男",
    ageRange: { min: 18, max: 35 },
    params: {
      job: "遊牧民",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("NOMAD", 20),
    ranges: {
      hp: [45, 60],
      str: [18, 24],
      vit: [16, 23],
      dex: [18, 26],
      mag: [5, 12],
      chr: [8, 18],
      int: [9, 18],
      ind: [10, 20],
      eth: [8, 16],
      cou: [18, 25],
      sexdr: [10, 22]
    },
    dialogues: [
      "馬を止めるな。食料を奪えば、まだ氏族は冬を越せる。",
      "弱い村だ。だが油断するな、囲んで崩す。",
      "恨みはない。腹を満たすものを置いていけ。",
      "道を空けろ。草原を追われた者にも牙は残っている。"
    ]
  },
  {
    type: "強遊牧民",
    displayType: "遊牧民",
    weight: 0,
    minCount: 4,
    maxCount: 5,
    race: "人間",
    forcedSex: "男",
    ageRange: { min: 25, max: 35 },
    params: {
      job: "遊牧民",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("ELITE_NOMAD", 20),
    ranges: {
      hp: [75, 95],
      str: [20, 28],
      vit: [18, 23],
      dex: [20, 28],
      mag: [5, 14],
      chr: [10, 20],
      int: [12, 22],
      ind: [14, 24],
      eth: [8, 16],
      cou: [22, 30],
      sexdr: [10, 22]
    },
    mindTraits: ["戦慣れ"],
    dialogues: [
      "富も食料も置いていけ。草原の蹄は二度同じ村を踏む。",
      "射手は左右へ回れ。逃げる者から落とせ。",
      "貢ぎ物で済ませるなら急げ。こちらの馬は待たぬ。",
      "この村の蓄えは、我らの次の戦の糧になる。"
    ]
  },
  {
    type: "セントール",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "セントール",
    forcedSex: "男",
    ageRange: { min: 18, max: 30 },
    params: {
      job: "セントール",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("CENTAUR", 9),
    ranges: {
      hp: [95, 125],
      str: [20, 25],
      vit: [20, 25],
      dex: [18, 28],
      mag: [5, 14],
      chr: [10, 20],
      int: [8, 18],
      ind: [10, 22],
      eth: [8, 16],
      cou: [26, 36],
      sexdr: [10, 22]
    },
    forcedBodyTraits: ["半人半馬"],
    dialogues: [
      "蹄の音を聞け。逃げ足で我らに勝てると思うな。",
      "人の柵など、草原の脚には低すぎる。",
      "食料を差し出せ。馬腹を満たせば血は少なくて済む。"
    ]
  },
  {
    type: "下級騎士",
    weight: 0,
    minCount: 2,
    maxCount: 3,
    race: "人間",
    forcedSex: "男",
    ageRange: { min: 18, max: 40 },
    params: {
      job: "下級騎士",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("KNIGHT", 26),
    ranges: {
      hp: [75, 95],
      str: [19, 24],
      vit: [17, 24],
      dex: [12, 20],
      mag: [5, 13],
      chr: [10, 20],
      int: [10, 20],
      ind: [12, 22],
      eth: [8, 16],
      cou: [18, 25],
      sexdr: [6, 18]
    },
    dialogues: [
      "巡礼の列を妨げるな。寄進を差し出し、道を開けよ。",
      "聖地へ向かう騎士を拒むなら、不信心の報いを受ける。",
      "門を開けよ。祈りの旅に必要な糧を求める。"
    ]
  },
  {
    type: "重装兵",
    weight: 0,
    minCount: 1,
    maxCount: 2,
    race: "人間",
    forcedSex: "男",
    ageRange: { min: 22, max: 45 },
    params: {
      job: "重装兵",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("ARMORED", 8),
    ranges: {
      hp: [90, 115],
      str: [20, 25],
      vit: [20, 28],
      dex: [8, 15],
      mag: [5, 12],
      chr: [6, 16],
      int: [8, 18],
      ind: [14, 22],
      eth: [8, 16],
      cou: [18, 25],
      sexdr: [5, 18]
    },
    mindTraits: ["秘蹟：盾", "戦慣れ"],
    dialogues: [
      "盾を上げろ。前へ進む。",
      "この鎧を抜ける刃があるなら試してみよ。",
      "道を開けぬなら、押し潰すまでだ。"
    ]
  },
  {
    type: "上級騎士",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "人間",
    forcedSex: "男",
    ageRange: { min: 25, max: 48 },
    params: {
      job: "上級騎士",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("ELITE", 22),
    ranges: {
      hp: [85, 110],
      str: [22, 25],
      vit: [20, 25],
      dex: [18, 24],
      mag: [7, 16],
      chr: [16, 24],
      int: [14, 22],
      ind: [16, 24],
      eth: [12, 20],
      cou: [22, 28],
      sexdr: [5, 16]
    },
    mindTraits: ["戦慣れ"],
    dialogues: [
      "整列せよ。正規の戦で、この村を屈服させる。",
      "寄進を惜しむ者に、巡礼の道を妨げる資格はない。",
      "剣を抜かせるな。抜けば慈悲は薄くなる。"
    ]
  },
  {
    type: "聖騎士",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "人間",
    forcedSex: "男",
    ageRange: { min: 24, max: 45 },
    params: {
      job: "聖騎士",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("HOLY_KNIGHT", 8),
    ranges: {
      hp: [90, 115],
      str: [22, 25],
      vit: [20, 25],
      dex: [18, 24],
      mag: [18, 25],
      chr: [18, 25],
      int: [16, 24],
      ind: [18, 25],
      eth: [22, 30],
      cou: [22, 30],
      sexdr: [3, 12]
    },
    mindTraits: ["狂信", "秘蹟：剣", "秘蹟：盾", "歴戦"],
    dialogues: [
      "異端の村よ。剣の前に悔い改めよ。",
      "古き神の奇跡は、ここで断つ。",
      "新しき神の名において、汝らを討つ。"
    ]
  },
  {
    type: "聖女",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "人間",
    forcedSex: "女",
    ageRange: { min: 18, max: 30 },
    params: {
      job: "聖女",
      action: "襲撃"
    },
    raidPosition: "middle",
    raidTargeting: "frontMiddleRandom",
    portraits: numberedPortraits("SAINT", 21),
    ranges: {
      hp: [70, 95],
      str: [8, 15],
      vit: [12, 20],
      dex: [12, 20],
      mag: [18, 28],
      chr: [18, 30],
      int: [18, 26],
      ind: [18, 26],
      eth: [22, 30],
      cou: [16, 24],
      sexdr: [3, 10]
    },
    forcedBodyTraits: ["聖女の輝き"],
    mindTraits: ["神聖", "狂信"],
    dialogues: [
      "祈りましょう。拒む者にも、痛みを通じて道は開かれます。",
      "寄進を惜しむ心こそ、剣より深い罪です。",
      "不信心を悔いるなら、今ここで膝をつきなさい。"
    ]
  },
  {
    type: "スフィンクス",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "スフィンクス",
    ageRange: { min: 30, max: 120 },
    params: {
      job: "スフィンクス",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("MINOTAUR", 4),
    ranges: {
      hp: [160, 200],
      str: [32, 44],
      vit: [30, 42],
      dex: [18, 28],
      mag: [34, 46],
      chr: [26, 38],
      int: [34, 46],
      ind: [18, 30],
      eth: [5, 18],
      cou: [28, 40],
      sexdr: [5, 16]
    },
    forcedBodyTraits: ["人面獣身"],
    mindTraits: ["古代知識"],
    hobbies: ["月光浴", "読書", "詩作", "祈り", "謎掛け", "瞑想", "人間観察", "自由研究", "天体観測", "占い"],
    dialogues: [
      "問いに答えよ。沈黙もまた答えとして扱おう。",
      "知恵のない村は、砂に埋もれるだけです。",
      "私の機嫌を損ねるなら、家も畑も同じ塵になります。"
    ]
  },
  {
    type: "翼人兵",
    weight: 0,
    minCount: 3,
    maxCount: 5,
    race: "翼人",
    forcedSex: "女",
    ageRange: { min: 18, max: 32 },
    params: {
      job: "翼人兵",
      action: "襲撃"
    },
    raidPosition: "middle",
    raidTargeting: "frontMiddleRandom",
    portraits: numberedPortraits("ANGEL_FIGHTER", 16),
    ranges: {
      hp: [75, 100],
      str: [16, 23],
      vit: [16, 23],
      dex: [20, 27],
      mag: [24, 32],
      chr: [20, 28],
      int: [16, 24],
      ind: [16, 24],
      eth: [22, 30],
      cou: [20, 28],
      sexdr: [3, 10]
    },
    forcedBodyTraits: ["飛行", "光輪"],
    mindTraits: ["神聖", "狂信"],
    dialogues: [
      "古き神に膝を折る村へ、神罰を。",
      "翼を見上げよ。裁きは空から降る。",
      "魔に近い者、罪深き者から焼き払う。"
    ]
  },
  {
    type: "上位翼人",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "翼人",
    forcedSex: "女",
    ageRange: { min: 25, max: 60 },
    params: {
      job: "上位翼人",
      action: "襲撃"
    },
    raidPosition: "middle",
    raidTargeting: "frontMiddleRandom",
    portraits: numberedPortraits("ARCHANGEL", 13),
    ranges: {
      hp: [105, 135],
      str: [20, 25],
      vit: [20, 25],
      dex: [22, 28],
      mag: [28, 36],
      chr: [25, 35],
      int: [22, 30],
      ind: [20, 28],
      eth: [25, 35],
      cou: [22, 30],
      sexdr: [3, 10]
    },
    forcedBodyTraits: ["飛行", "光輪"],
    mindTraits: ["神聖", "狂信", "歴戦"],
    dialogues: [
      "幾重の翼の下で裁きを受けよ。",
      "この村は記録された。異端の火は、ここで絶える。",
      "聖騎士たちよ、地を塞げ。空から私が断つ。"
    ]
  },
  {
    type: "騎馬兵団兵",
    displayType: "騎馬兵",
    weight: 0,
    minCount: 4,
    maxCount: 6,
    race: "人間",
    forcedSex: "男",
    ageRange: { min: 20, max: 40 },
    params: {
      job: "騎馬兵団",
      action: "襲撃"
    },
    raidPosition: "middle",
    raidTargeting: "frontMiddleRandom",
    portraits: numberedPortraits("ELITE_NOMAD", 20),
    ranges: {
      hp: [85, 110],
      str: [22, 28],
      vit: [18, 25],
      dex: [22, 30],
      mag: [5, 14],
      chr: [12, 24],
      int: [18, 26],
      ind: [20, 28],
      eth: [8, 16],
      cou: [24, 30],
      sexdr: [8, 20]
    },
    mindTraits: ["歴戦"],
    dialogues: [
      "第一列、射て。第二列、回り込め。",
      "一度退いても終わりではない。次の波が来る。",
      "この村は兵站に使える。焼きすぎるな、奪い尽くせ。"
    ]
  },
  {
    type: "黙示録の騎士・支配",
    displayType: "白の騎士",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "異形の大天使",
    ageRange: { min: 100, max: 300 },
    params: { job: "黙示録の騎士・支配", action: "襲撃" },
    raidPosition: "middle",
    raidTargeting: "frontMiddleRandom",
    useDefaultPortrait: true,
    exchangeImmune: true,
    uncapturable: true,
    ranges: {
      hp: [230, 260],
      str: [38, 46],
      vit: [36, 44],
      dex: [40, 48],
      mag: [48, 58],
      chr: [44, 54],
      int: [42, 52],
      ind: [36, 44],
      eth: [42, 50],
      cou: [42, 50],
      sexdr: [0, 4]
    },
    forcedBodyTraits: ["飛行", "光輪", "異形の大天使"],
    mindTraits: ["神聖", "狂信", "歴戦"],
    dialogues: [
      "白き冠の下にひれ伏せ。すべての地は、天のものとなる。",
      "おまえたちの奇跡で、この身を奪うことはできぬ。",
      "支配は慈悲である。抗う自由さえ、ここで終わる。"
    ]
  },
  {
    type: "黙示録の騎士・戦争",
    displayType: "赤の騎士",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "異形の大天使",
    ageRange: { min: 100, max: 300 },
    params: { job: "黙示録の騎士・戦争", action: "襲撃" },
    raidPosition: "front",
    raidTargeting: "frontFirst",
    useDefaultPortrait: true,
    exchangeImmune: true,
    uncapturable: true,
    ranges: {
      hp: [260, 300],
      str: [52, 62],
      vit: [46, 56],
      dex: [36, 44],
      mag: [38, 48],
      chr: [38, 46],
      int: [34, 42],
      ind: [46, 54],
      eth: [32, 40],
      cou: [52, 60],
      sexdr: [0, 4]
    },
    forcedBodyTraits: ["飛行", "光輪", "異形の大天使"],
    mindTraits: ["神聖", "狂信", "歴戦"],
    dialogues: [
      "赤き剣は、村と村人を分けては斬らぬ。すべてを戦場に変える。",
      "争え。憎め。そのたびに私の刃は重くなる。",
      "黄金の像を守る腕ごと、地へ落とそう。"
    ]
  },
  {
    type: "黙示録の騎士・飢餓",
    displayType: "黒の騎士",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "異形の大天使",
    ageRange: { min: 100, max: 300 },
    params: { job: "黙示録の騎士・飢餓", action: "襲撃" },
    raidPosition: "middle",
    raidTargeting: "frontMiddleRandom",
    useDefaultPortrait: true,
    exchangeImmune: true,
    uncapturable: true,
    ranges: {
      hp: [220, 250],
      str: [34, 42],
      vit: [38, 46],
      dex: [42, 50],
      mag: [54, 64],
      chr: [32, 40],
      int: [48, 58],
      ind: [44, 52],
      eth: [38, 46],
      cou: [40, 48],
      sexdr: [0, 4]
    },
    forcedBodyTraits: ["飛行", "光輪", "異形の大天使"],
    mindTraits: ["神聖", "狂信", "歴戦"],
    dialogues: [
      "黒き秤に麦を載せよ。おまえたちの一日を、一粒ずつ量ろう。",
      "倉は空となり、腹は祈りのほか何も受けつけなくなる。",
      "飢えに肉体はない。ゆえに、交換の奇跡も届かぬ。"
    ]
  },
  {
    type: "黙示録の騎士・疫病",
    displayType: "青白い騎士",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "異形の大天使",
    ageRange: { min: 100, max: 300 },
    params: { job: "黙示録の騎士・疫病", action: "襲撃" },
    raidPosition: "front",
    raidTargeting: "lowestHp",
    useDefaultPortrait: true,
    exchangeImmune: true,
    uncapturable: true,
    ranges: {
      hp: [240, 280],
      str: [46, 56],
      vit: [42, 50],
      dex: [46, 56],
      mag: [50, 60],
      chr: [30, 38],
      int: [46, 54],
      ind: [50, 60],
      eth: [34, 42],
      cou: [48, 58],
      sexdr: [0, 4]
    },
    forcedBodyTraits: ["飛行", "光輪", "異形の大天使"],
    mindTraits: ["神聖", "狂信", "歴戦"],
    dialogues: [
      "青白き翼が触れた名を、村の記録から消そう。",
      "私は急がぬ。七つ目の角笛は、すでに鳴り終えた。",
      "肉体を替えても、死の順番は替わらぬ。"
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
  foodRate: 0,
  materialsRate: 0,
  fundsRate: 0,
  security: 10,
  villagerHpRange: [5, 15],
  villagerHappiness: 30,
  buildingDamage: false,
  severeInjury: false
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
    failurePenalty: {
      ...cloneRaidRules(DEFAULT_RAID_FAILURE_PENALTY),
      ...(overrides.failurePenalty || {})
    }
  };
}

function createCompositeRaiderRaid({
  id,
  name,
  warningName,
  weight,
  enemyGroups = [],
  enemyGroupVariants = null,
  avoidance = null,
  representative = null,
  introDialogues = [],
  defense = null,
  successRewards = null,
  failurePenalty = null
}) {
  return {
    id,
    name,
    warningName,
    weight,
    avoidance,
    representative,
    introDialogues,
    defense: {
      ...cloneRaidRules(DEFAULT_RAID_DEFENSE),
      ...(defense || {})
    },
    enemyGroups,
    enemyGroupVariants,
    successRewards: {
      ...cloneRaidRules(DEFAULT_RAID_SUCCESS_REWARDS),
      ...(successRewards || {})
    },
    failurePenalty: {
      ...cloneRaidRules(DEFAULT_RAID_FAILURE_PENALTY),
      ...(failurePenalty || {})
    }
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
  createExistingRaiderRaid("bandit", "野盗", {
    failurePenalty: {
      foodRate: 0.2,
      fundsRate: 0.2
    }
  }),
  createExistingRaiderRaid("mercenary-band", "傭兵団", {
    avoidance: {
      type: "resourcePayment",
      resource: "funds",
      label: "金を払う",
      rate: 0.4,
      minAmount: 200
    },
    failurePenalty: {
      fundsRate: 0.3
    },
    introDialogues: [
      "この村を焼く契約は受けている。だが、今すぐ金を出すなら見逃してやる。",
      "命まで買いたいなら、相応の金を積め。足りなければ仕事に移るだけだ。",
      "金で済ませるか、刃で払うか。選ぶ時間は長くないぞ。"
    ]
  }),
  createExistingRaiderRaid("goblin", "ゴブリン", {
    failurePenalty: {
      foodRate: 0.25
    }
  }),
  createExistingRaiderRaid("wolf", "狼", {
    failurePenalty: {
      foodRate: 0.2
    }
  }),
  createExistingRaiderRaid("cyclops", "キュクロプス", {
    failurePenalty: {
      foodRate: 0.2,
      buildingDamage: true
    }
  }),
  createExistingRaiderRaid("harpy", "ハーピー", {
    failurePenalty: {
      fundsRate: 0.25
    }
  }),
  createCompositeRaiderRaid({
    id: "stray-harpy",
    name: "逸れハーピーの襲撃",
    warningName: "逸れハーピー",
    weight: 3,
    representative: { raiderType: "ハーピー" },
    enemyGroups: [
      { raiderType: "ハーピー", minCount: 1, maxCount: 1 }
    ],
    failurePenalty: {
      fundsRate: 0.15
    }
  }),
  createCompositeRaiderRaid({
    id: "harpy-swarm",
    name: "ハーピーの大群",
    warningName: "ハーピーの大群",
    weight: 14,
    representative: { raiderType: "ハーピーの長", role: "leader" },
    enemyGroups: [
      { raiderType: "ハーピー", minCount: 3, maxCount: 4 },
      { raiderType: "ハーピーの長", minCount: 1, maxCount: 1 }
    ],
    failurePenalty: {
      fundsRate: 0.35
    }
  }),
  createCompositeRaiderRaid({
    id: "starving-wolves",
    name: "餓狼の群れ",
    warningName: "餓狼の群れ",
    weight: 18,
    enemyGroups: [
      { raiderType: "餓狼", minCount: 3, maxCount: 4 }
    ],
    failurePenalty: {
      foodRate: 0.3
    }
  }),
  createCompositeRaiderRaid({
    id: "cyclops-band",
    name: "キュクロプス団",
    warningName: "キュクロプス団",
    weight: 6,
    enemyGroups: [
      { raiderType: "キュクロプス", minCount: 2, maxCount: 3 }
    ],
    failurePenalty: {
      foodRate: 0.3,
      buildingDamage: true
    }
  }),
  createCompositeRaiderRaid({
    id: "grassland-people",
    name: "草原の民の襲撃",
    warningName: "草原の民",
    weight: 14,
    avoidance: {
      type: "resourcePayment",
      resource: "food",
      label: "食料を渡す",
      rate: 0.3,
      minAmount: 80
    },
    representative: { raiderType: "遊牧民" },
    enemyGroupVariants: [
      {
        weight: 85,
        enemyGroups: [
          { raiderType: "遊牧民", minCount: 3, maxCount: 4 }
        ]
      },
      {
        weight: 15,
        enemyGroups: [
          { raiderType: "遊牧民", minCount: 3, maxCount: 4 },
          { raiderType: "セントール", minCount: 1, maxCount: 1 }
        ]
      }
    ],
    introDialogues: [
      "争いに敗れた氏族だ。食料を渡せば、ここで血を流す理由はない。",
      "弱った氏族でも、馬上の刃は鈍っていない。蓄えを出せ。",
      "冬を越す食料が要る。拒むなら、村から奪っていく。"
    ],
    failurePenalty: {
      foodRate: 0.3
    }
  }),
  createCompositeRaiderRaid({
    id: "horse-nomad-raid",
    name: "騎馬民族の襲撃",
    warningName: "騎馬民族",
    weight: 12,
    avoidance: {
      type: "resourcePayment",
      label: "貢納を差し出す",
      resources: [
        { resource: "food", rate: 0.45, minAmount: 180 },
        { resource: "funds", rate: 0.45, minAmount: 300 }
      ]
    },
    representative: { raiderType: "強遊牧民" },
    enemyGroups: [
      { raiderType: "強遊牧民", minCount: 3, maxCount: 5 },
      { raiderType: "セントール", minCount: 1, maxCount: 3 }
    ],
    introDialogues: [
      "食料も富も差し出せ。拒む村は、蹄で踏み荒らす。",
      "我らは敗残ではない。狙って来た獲物を逃がさぬ。",
      "重い貢納で済ませるか、戦でさらに失うか。選べ。"
    ],
    failurePenalty: {
      foodRate: 0.4,
      fundsRate: 0.4
    }
  }),
  createCompositeRaiderRaid({
    id: "pilgrimage-knights",
    name: "巡礼騎士団の来襲",
    warningName: "巡礼騎士団",
    weight: 10,
    avoidance: {
      type: "resourcePayment",
      resource: "funds",
      label: "巡礼の寄付を払う",
      rate: 0.55,
      minAmount: 500
    },
    representative: [
      { raiderType: "聖女" },
      { raiderType: "上級騎士" }
    ],
    enemyGroupVariants: [
      {
        weight: 80,
        enemyGroups: [
          { raiderType: "下級騎士", minCount: 2, maxCount: 3 },
          { raiderType: "重装兵", minCount: 1, maxCount: 2 },
          { raiderType: "上級騎士", minCount: 1, maxCount: 1 }
        ]
      },
      {
        weight: 20,
        enemyGroups: [
          { raiderType: "下級騎士", minCount: 1, maxCount: 2 },
          { raiderType: "重装兵", minCount: 1, maxCount: 2 },
          { raiderType: "上級騎士", minCount: 1, maxCount: 1 },
          { raiderType: "聖女", minCount: 1, maxCount: 1 }
        ]
      }
    ],
    introDialogues: [
      "聖地への道には寄進が要る。協力すれば剣は収めよう。",
      "巡礼の名を軽んじるなら、不信心者として扱う。",
      "志の高い者も、飢えた者もいる。だが装備と隊列は本物だ。"
    ],
    failurePenalty: {
      fundsRate: 0.35,
      severeInjury: true
    }
  }),
  createCompositeRaiderRaid({
    id: "sphinx-visit",
    name: "スフィンクスの来襲",
    warningName: "スフィンクス",
    weight: 5,
    representative: { raiderType: "スフィンクス" },
    enemyGroups: [
      { raiderType: "スフィンクス", minCount: 1, maxCount: 1 }
    ],
    failurePenalty: {
      materialsRate: 0.35,
      fundsRate: 0.25,
      security: 18,
      villagerHpRange: [12, 28],
      villagerHappiness: 45
    },
    introDialogues: [
      "問いを持って降り立ちました。答えられぬ村には、爪で続きを刻みましょう。",
      "知恵を示しなさい。機嫌を損ねる答えなら、畑も屋根も残りません。",
      "私の問答は気まぐれです。けれど、拒絶への報いは確かです。"
    ]
  }),
  createCompositeRaiderRaid({
    id: "winged-punishment",
    name: "翼人兵の襲撃",
    warningName: "翼人兵",
    weight: 12,
    representative: { raiderType: "翼人兵" },
    enemyGroups: [
      { raiderType: "翼人兵", minCount: 3, maxCount: 5 }
    ],
    failurePenalty: {
      security: 18,
      villagerHpRange: [10, 22],
      villagerHappiness: 40,
      severeInjury: true
    },
    introDialogues: [
      "白き翼は、異端の村を見逃さない。",
      "古き神の祭をやめよ。拒むなら神罰を受けよ。",
      "光輪の下に、村の罪は記された。"
    ]
  }),
  createCompositeRaiderRaid({
    id: "holy-crusade",
    name: "聖征騎士団の襲撃",
    warningName: "聖征騎士団",
    weight: 8,
    representative: [
      { raiderType: "聖騎士" },
      { raiderType: "聖女" }
    ],
    enemyGroups: [
      { raiderType: "重装兵", minCount: 2, maxCount: 3 },
      { raiderType: "上級騎士", minCount: 1, maxCount: 2 },
      { raiderType: "聖騎士", minCount: 1, maxCount: 1 },
      { raiderType: "聖女", minCount: 1, maxCount: 1 }
    ],
    failurePenalty: {
      materialsRate: 0.3,
      fundsRate: 0.3,
      security: 18,
      villagerHpRange: [10, 25],
      villagerHappiness: 40,
      severeInjury: true
    },
    introDialogues: [
      "これは巡礼ではない。異端討伐である。",
      "聖征の旗の下、古き神の村を砕く。",
      "悔い改める機会は過ぎた。剣で答える。"
    ]
  }),
  createCompositeRaiderRaid({
    id: "winged-punishment-strong",
    name: "翼人兵（強）の襲撃",
    warningName: "翼人兵（強）",
    weight: 15,
    representative: { raiderType: "翼人兵" },
    enemyGroups: [
      { raiderType: "翼人兵", minCount: 6, maxCount: 8 }
    ],
    defense: { surviveTurns: 6 },
    failurePenalty: {
      security: 22,
      villagerHpRange: [12, 28],
      villagerHappiness: 50,
      severeInjury: true
    },
    introDialogues: [
      "異端の記録は覆らない。翼の陣を組み、村を断て。",
      "下位の裁きを退けた罪も加えられた。今度こそ神罰を受けよ。",
      "白き翼の軍勢から逃れる空はない。"
    ]
  }),
  createCompositeRaiderRaid({
    id: "holy-crusade-strong",
    name: "聖征騎士団（強）の襲撃",
    warningName: "聖征騎士団（強）",
    weight: 15,
    representative: [
      { raiderType: "聖騎士" },
      { raiderType: "聖女" }
    ],
    enemyGroups: [
      { raiderType: "重装兵", minCount: 3, maxCount: 4 },
      { raiderType: "上級騎士", minCount: 2, maxCount: 3 },
      { raiderType: "聖騎士", minCount: 1, maxCount: 2 },
      { raiderType: "聖女", minCount: 1, maxCount: 2 }
    ],
    defense: { surviveTurns: 6 },
    failurePenalty: {
      materialsRate: 0.4,
      fundsRate: 0.4,
      security: 22,
      villagerHpRange: [12, 30],
      villagerHappiness: 50,
      severeInjury: true
    },
    introDialogues: [
      "異端の村へ、増派された聖征の剣を示す。",
      "先の裁きを耐えたことを誇るな。今度は軍勢で押し潰す。",
      "重き鎧と祈りの列を崩せるものなら、崩してみよ。"
    ]
  }),
  createCompositeRaiderRaid({
    id: "upper-apostle-raid",
    name: "上級使途の襲撃",
    warningName: "上級使途",
    weight: 5,
    representative: { raiderType: "上位翼人" },
    enemyGroups: [
      { raiderType: "上位翼人", minCount: 1, maxCount: 1 },
      { raiderType: "翼人兵", minCount: 2, maxCount: 3 },
      { raiderType: "聖騎士", minCount: 1, maxCount: 1 },
      { raiderType: "聖女", minCount: 1, maxCount: 1 }
    ],
    defense: { surviveTurns: 6 },
    failurePenalty: {
      materialsRate: 0.35,
      fundsRate: 0.35,
      security: 22,
      villagerHpRange: [12, 30],
      villagerHappiness: 50,
      severeInjury: true
    },
    introDialogues: [
      "幾重の翼が降りる時、下位の裁きは終わる。",
      "聖騎士たちよ、地を囲め。空は私が支配する。",
      "新しき神の最高戦力の一端を、異端の村に示す。"
    ]
  }),
  createCompositeRaiderRaid({
    id: "cavalry-corps",
    name: "騎馬兵団の襲撃",
    warningName: "騎馬兵団",
    weight: 6,
    representative: { raiderType: "騎馬兵団兵" },
    enemyGroups: [
      { raiderType: "騎馬兵団兵", minCount: 4, maxCount: 6 },
      { raiderType: "強遊牧民", minCount: 2, maxCount: 3 },
      { raiderType: "セントール", minCount: 1, maxCount: 2 }
    ],
    defense: { surviveTurns: 7 },
    failurePenalty: {
      foodRate: 0.45,
      fundsRate: 0.45,
      security: 25,
      villagerHpRange: [15, 35],
      villagerHappiness: 55,
      severeInjury: true
    },
    introDialogues: [
      "偵察は終わった。ここからは兵団の戦だ。",
      "一波を退けても次が来る。兵站の整った軍を侮るな。",
      "高い士気と馬上の弓で、この村を包囲する。"
    ]
  }),
  createCompositeRaiderRaid({
    id: "apocalypse-upper-winged",
    name: "第七の災厄・上位翼人兵と支配",
    warningName: "上位翼人兵と白き騎士・支配",
    weight: 0,
    representative: [
      { raiderType: "黙示録の騎士・支配" },
      { raiderType: "上位翼人" }
    ],
    enemyGroups: [
      { raiderType: "上位翼人", minCount: 3, maxCount: 4 },
      { raiderType: "翼人兵", minCount: 4, maxCount: 6 },
      { raiderType: "黙示録の騎士・支配", minCount: 1, maxCount: 1 }
    ],
    defense: { surviveTurns: 6 },
    successRewards: { completeHappiness: 30, partialHappiness: 15 },
    failurePenalty: {
      security: 28,
      villagerHpRange: [18, 35],
      villagerHappiness: 55,
      severeInjury: true
    },
    introDialogues: [
      "第七の角笛は鳴った。幾重の翼の下で、異端の村は支配される。",
      "白き騎士の命により、天の軍勢が最後の裁きを下す。",
      "黄金の偶像を倒さぬ者に、もはや自由も赦しもない。"
    ]
  }),
  createCompositeRaiderRaid({
    id: "apocalypse-grand-crusade",
    name: "第六の災厄・大規模聖征軍団と戦争",
    warningName: "大規模聖征軍団と赤き騎士・戦争",
    weight: 0,
    representative: [
      { raiderType: "黙示録の騎士・戦争" },
      { raiderType: "聖騎士" },
      { raiderType: "聖女" }
    ],
    enemyGroups: [
      { raiderType: "重装兵", minCount: 6, maxCount: 8 },
      { raiderType: "上級騎士", minCount: 4, maxCount: 6 },
      { raiderType: "聖騎士", minCount: 2, maxCount: 3 },
      { raiderType: "聖女", minCount: 2, maxCount: 3 },
      { raiderType: "黙示録の騎士・戦争", minCount: 1, maxCount: 1 }
    ],
    defense: { surviveTurns: 7 },
    failurePenalty: {
      materialsRate: 0.5,
      fundsRate: 0.5,
      security: 35,
      villagerHpRange: [25, 45],
      villagerHappiness: 65,
      buildingDamage: true,
      severeInjury: true
    },
    introDialogues: [
      "第六の角笛は鳴った。赤き騎士の下、聖征の全軍をもってこの村を地図から消す。",
      "戦争の剣に抗う者よ、盾を並べよ。悔い改めの時は終わった。",
      "黄金の偶像を砕くまで、赤き刃も聖なる軍靴も止まらない。"
    ]
  }),
  createCompositeRaiderRaid({
    id: "apocalypse-four-horsemen",
    name: "第七の災厄・黙示録の四騎士",
    warningName: "黙示録の四騎士",
    weight: 0,
    representative: { raiderType: "黙示録の騎士・支配" },
    enemyGroups: [
      { raiderType: "黙示録の騎士・支配", minCount: 1, maxCount: 1 },
      { raiderType: "黙示録の騎士・戦争", minCount: 1, maxCount: 1 },
      { raiderType: "黙示録の騎士・飢餓", minCount: 1, maxCount: 1 },
      { raiderType: "黙示録の騎士・疫病", minCount: 1, maxCount: 1 }
    ],
    defense: { surviveTurns: 8 },
    successRewards: { completeHappiness: 30, partialHappiness: 15 },
    failurePenalty: {
      foodRate: 0.6,
      materialsRate: 0.6,
      fundsRate: 0.6,
      security: 45,
      villagerHpRange: [30, 55],
      villagerHappiness: 75,
      buildingDamage: true,
      severeInjury: true
    },
    introDialogues: [
      "第七の角笛は鳴った。支配、戦争、飢餓、疫病――四つの裁きがここに揃う。",
      "肉体を取り替える奇跡など、天の使いには届かぬ。",
      "我らを退けるか、黄金の偶像とともに砕かれるか。選べ。"
    ]
  })
];

const RAID_MODULE_BY_ID = new Map(RAID_MODULES.map(raid => [raid.id, raid]));

export const RAID_SCALE_TABLES = [
  {
    id: "early-frontier",
    scaleStageIndexes: [0, 1],
    entries: [
      { raidId: "goblin", weight: 10 },
      { raidId: "wolf", weight: 10 },
      { raidId: "bandit", weight: 10 },
      { raidId: "stray-harpy", weight: 3 }
    ]
  },
  {
    id: "frontier-village",
    scaleStageIndexes: [2],
    entries: [
      { raidId: "goblin", weight: 10 },
      { raidId: "wolf", weight: 10 },
      { raidId: "bandit", weight: 10 },
      { raidId: "harpy", weight: 10 },
      { raidId: "grassland-people", weight: 10 }
    ]
  },
  {
    id: "mapped-village",
    scaleStageIndexes: [3],
    entries: [
      { raidId: "goblin", weight: 5 },
      { raidId: "wolf", weight: 5 },
      { raidId: "mercenary-band", weight: 10 },
      { raidId: "harpy", weight: 10 },
      { raidId: "grassland-people", weight: 10 },
      { raidId: "pilgrimage-knights", weight: 5 }
    ]
  },
  {
    id: "rich-village",
    scaleStageIndexes: [4],
    entries: [
      { raidId: "starving-wolves", weight: 10 },
      { raidId: "mercenary-band", weight: 10 },
      { raidId: "harpy", weight: 5 },
      { raidId: "grassland-people", weight: 5 },
      { raidId: "pilgrimage-knights", weight: 10 },
      { raidId: "harpy-swarm", weight: 5 },
      { raidId: "cyclops", weight: 5 }
    ]
  },
  {
    id: "prosperous-village",
    scaleStageIndexes: [5],
    excludedVillageTrait: "異端",
    entries: [
      { raidId: "mercenary-band", weight: 5 },
      { raidId: "pilgrimage-knights", weight: 10 },
      { raidId: "harpy-swarm", weight: 10 },
      { raidId: "starving-wolves", weight: 10 },
      { raidId: "horse-nomad-raid", weight: 10 },
      { raidId: "cyclops", weight: 10 }
    ]
  },
  {
    id: "autonomous-settlement",
    scaleStageIndexes: [6],
    excludedVillageTrait: "異端",
    entries: [
      { raidId: "pilgrimage-knights", weight: 10 },
      { raidId: "harpy-swarm", weight: 10 },
      { raidId: "starving-wolves", weight: 5 },
      { raidId: "horse-nomad-raid", weight: 10 },
      { raidId: "cyclops-band", weight: 10 },
      { raidId: "sphinx-visit", weight: 5 }
    ]
  },
  {
    id: "heresy-prosperous-village",
    scaleStageIndexes: [5],
    requiredVillageTrait: "異端",
    entries: [
      { raidId: "holy-crusade", weight: 15 },
      { raidId: "winged-punishment", weight: 15 },
      { raidId: "harpy-swarm", weight: 10 },
      { raidId: "horse-nomad-raid", weight: 10 },
      { raidId: "cyclops", weight: 10 }
    ]
  },
  {
    id: "heresy-autonomous-settlement",
    scaleStageIndexes: [6],
    requiredVillageTrait: "異端",
    entries: [
      { raidId: "holy-crusade-strong", weight: 15 },
      { raidId: "winged-punishment-strong", weight: 15 },
      { raidId: "harpy-swarm", weight: 5 },
      { raidId: "horse-nomad-raid", weight: 10 },
      { raidId: "cyclops-band", weight: 10 },
      { raidId: "sphinx-visit", weight: 5 }
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
