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
    ageRange: { min: 18, max: 42 },
    params: {
      job: "遊牧民",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("NOMAD", 20),
    ranges: {
      hp: [75, 95],
      str: [22, 28],
      vit: [16, 26],
      dex: [20, 28],
      mag: [5, 12],
      chr: [8, 18],
      int: [9, 18],
      ind: [10, 20],
      eth: [4, 13],
      cou: [21, 29],
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
    ageRange: { min: 20, max: 45 },
    params: {
      job: "遊牧民",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("ELITE_NOMAD", 20),
    ranges: {
      hp: [90, 115],
      str: [26, 34],
      vit: [20, 30],
      dex: [25, 34],
      mag: [5, 14],
      chr: [10, 20],
      int: [12, 22],
      ind: [14, 24],
      eth: [3, 12],
      cou: [27, 36],
      sexdr: [10, 22]
    },
    mindTraits: ["歴戦"],
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
    ageRange: { min: 18, max: 38 },
    params: {
      job: "セントール",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("CENTAUR", 9),
    ranges: {
      hp: [95, 125],
      str: [28, 36],
      vit: [24, 34],
      dex: [18, 28],
      mag: [5, 14],
      chr: [10, 20],
      int: [8, 18],
      ind: [10, 22],
      eth: [5, 15],
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
    type: "傭兵",
    weight: 0,
    minCount: 2,
    maxCount: 3,
    race: "人間",
    forcedSex: "男",
    ageRange: { min: 18, max: 42 },
    params: {
      job: "傭兵",
      action: "襲撃"
    },
    raidPosition: "front",
    portraits: numberedPortraits("BAN", 21),
    ranges: {
      hp: [60, 80],
      str: [18, 24],
      vit: [12, 22],
      dex: [12, 22],
      mag: [5, 12],
      chr: [5, 15],
      int: [8, 16],
      ind: [8, 18],
      eth: [2, 10],
      cou: [16, 24],
      sexdr: [10, 22]
    },
    dialogues: [
      "税だろうが略奪だろうが、払われるなら同じ仕事だ。",
      "騎士様の後ろで楽をしたいが、村が逆らうなら前に出る。",
      "金の匂いがする。抵抗するなら取り分が増えるだけだ。"
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
      str: [21, 29],
      vit: [18, 28],
      dex: [12, 22],
      mag: [5, 13],
      chr: [10, 20],
      int: [10, 20],
      ind: [12, 22],
      eth: [8, 18],
      cou: [20, 30],
      sexdr: [6, 18]
    },
    dialogues: [
      "領主の命である。納めるものを納めよ。",
      "拒むなら、徴税は討伐に変わる。",
      "村の蓄えを調べる。門を開けよ。"
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
      hp: [105, 135],
      str: [26, 34],
      vit: [30, 40],
      dex: [8, 16],
      mag: [5, 12],
      chr: [6, 16],
      int: [8, 18],
      ind: [16, 26],
      eth: [6, 18],
      cou: [24, 34],
      sexdr: [5, 18]
    },
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
      hp: [100, 130],
      str: [28, 36],
      vit: [24, 34],
      dex: [18, 28],
      mag: [7, 16],
      chr: [18, 28],
      int: [15, 25],
      ind: [18, 28],
      eth: [12, 24],
      cou: [28, 38],
      sexdr: [5, 16]
    },
    mindTraits: ["歴戦"],
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
      hp: [115, 145],
      str: [30, 40],
      vit: [28, 38],
      dex: [18, 28],
      mag: [18, 28],
      chr: [18, 28],
      int: [16, 26],
      ind: [18, 30],
      eth: [22, 32],
      cou: [30, 40],
      sexdr: [3, 12]
    },
    mindTraits: ["歴戦"],
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
      hp: [80, 105],
      str: [10, 18],
      vit: [14, 24],
      dex: [12, 22],
      mag: [28, 38],
      chr: [28, 40],
      int: [20, 32],
      ind: [18, 30],
      eth: [28, 40],
      cou: [20, 30],
      sexdr: [3, 10]
    },
    forcedBodyTraits: ["聖女の輝き"],
    mindTraits: ["神聖"],
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
    forcedSex: "女",
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
      hp: [85, 110],
      str: [18, 28],
      vit: [18, 28],
      dex: [24, 34],
      mag: [24, 34],
      chr: [20, 30],
      int: [16, 26],
      ind: [16, 28],
      eth: [24, 36],
      cou: [24, 34],
      sexdr: [3, 10]
    },
    forcedBodyTraits: ["飛行", "光輪"],
    mindTraits: ["神聖"],
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
      hp: [140, 175],
      str: [28, 38],
      vit: [26, 36],
      dex: [30, 42],
      mag: [36, 50],
      chr: [30, 44],
      int: [28, 40],
      ind: [24, 36],
      eth: [32, 45],
      cou: [32, 44],
      sexdr: [3, 10]
    },
    forcedBodyTraits: ["飛行", "光輪"],
    mindTraits: ["神聖", "歴戦"],
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
    ageRange: { min: 20, max: 45 },
    params: {
      job: "騎馬兵団",
      action: "襲撃"
    },
    raidPosition: "middle",
    raidTargeting: "frontMiddleRandom",
    portraits: numberedPortraits("ELITE_NOMAD", 20),
    ranges: {
      hp: [105, 135],
      str: [30, 40],
      vit: [25, 35],
      dex: [32, 44],
      mag: [5, 14],
      chr: [12, 24],
      int: [18, 30],
      ind: [22, 34],
      eth: [4, 14],
      cou: [34, 45],
      sexdr: [8, 20]
    },
    mindTraits: ["歴戦"],
    dialogues: [
      "第一列、射て。第二列、回り込め。",
      "一度退いても終わりではない。次の波が来る。",
      "この村は兵站に使える。焼きすぎるな、奪い尽くせ。"
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
    enemyGroups: [
      { raiderType: "キュクロプス", minCount: 2, maxCount: 3 }
    ]
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
    ]
  }),
  createCompositeRaiderRaid({
    id: "tax-collector-visit",
    name: "徴税官の来訪",
    warningName: "徴税官",
    weight: 12,
    avoidance: {
      type: "resourcePayment",
      label: "税を納める",
      resources: [
        { resource: "food", rate: 0.25, minAmount: 80 },
        { resource: "funds", rate: 0.3, minAmount: 150 }
      ]
    },
    representative: { raiderType: "下級騎士" },
    enemyGroups: [
      { raiderType: "下級騎士", minCount: 2, maxCount: 3 },
      { raiderType: "傭兵", minCount: 2, maxCount: 3 }
    ],
    introDialogues: [
      "近隣の領主より徴税に来た。食料と資金を納めよ。",
      "義理がないと言うなら、こちらも徴発に移るだけだ。",
      "税を拒む村には、領主の暴力が向かう。"
    ]
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
    ]
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
    ]
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
      foodRate: 0.35,
      materialsRate: 0.35,
      fundsRate: 0.35,
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
    name: "翼持つ者の襲撃",
    warningName: "翼持つ者",
    weight: 12,
    representative: { raiderType: "翼人兵" },
    enemyGroups: [
      { raiderType: "翼人兵", minCount: 3, maxCount: 5 }
    ],
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
      foodRate: 0.3,
      materialsRate: 0.3,
      fundsRate: 0.3,
      security: 18,
      villagerHpRange: [10, 25],
      villagerHappiness: 40
    },
    introDialogues: [
      "これは巡礼ではない。異端討伐である。",
      "聖征の旗の下、古き神の村を砕く。",
      "悔い改める機会は過ぎた。剣で答える。"
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
      foodRate: 0.35,
      materialsRate: 0.35,
      fundsRate: 0.35,
      security: 22,
      villagerHpRange: [12, 30],
      villagerHappiness: 50
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
      materialsRate: 0.35,
      fundsRate: 0.45,
      security: 25,
      villagerHpRange: [15, 35],
      villagerHappiness: 55
    },
    introDialogues: [
      "偵察は終わった。ここからは兵団の戦だ。",
      "一波を退けても次が来る。兵站の整った軍を侮るな。",
      "高い士気と馬上の弓で、この村を包囲する。"
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
      { raidId: "mercenary-band", weight: 16 },
      { raidId: "grassland-people", weight: 12 },
      { raidId: "tax-collector-visit", weight: 10 }
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
      { raidId: "goblin", weight: 8 },
      { raidId: "grassland-people", weight: 10 },
      { raidId: "tax-collector-visit", weight: 10 },
      { raidId: "pilgrimage-knights", weight: 8 },
      { raidId: "sphinx-visit", weight: 4 },
      { raidId: "winged-punishment", weight: 8, minHeresy: 100 },
      { raidId: "holy-crusade", weight: 5, minHeresy: 100 }
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
      { raidId: "goblin", weight: 6 },
      { raidId: "horse-nomad-raid", weight: 12 },
      { raidId: "pilgrimage-knights", weight: 10 },
      { raidId: "sphinx-visit", weight: 5 },
      { raidId: "winged-punishment", weight: 10, minHeresy: 100 },
      { raidId: "holy-crusade", weight: 8, minHeresy: 100 },
      { raidId: "upper-apostle-raid", weight: 5, minHeresy: 100, minScaleStageIndex: 6 },
      { raidId: "cavalry-corps", weight: 6, minDivineMight: 300 }
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
