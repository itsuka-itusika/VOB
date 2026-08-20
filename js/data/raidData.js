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
    type: "傭兵射手",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "人間",
    forcedSex: "男",
    ageRange: { min: 18, max: 42 },
    params: {
      job: "傭兵射手",
      action: "襲撃"
    },
    raidPosition: "middle",
    raidTargeting: "frontFirst",
    portraits: numberedPortraits("BAN", 20),
    ranges: {
      hp: [55, 75],
      str: [14, 20],
      vit: [10, 20],
      dex: [18, 24],
      mag: [5, 13],
      chr: [5, 16],
      int: [10, 20],
      ind: [10, 20],
      eth: [2, 10],
      cou: [18, 25],
      sexdr: [10, 22]
    },
    dialogues: [
      "前は任せた。こっちは射線を通す！",
      "盾の陰に隠れても無駄だ。動けば射抜くぞ。",
      "足を止めろ。近づかれる前に数を減らす！"
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
    type: "ゴブリンリーダー",
    role: "leader",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "ゴブリン",
    forcedSex: "男",
    ageRange: { min: 24, max: 38 },
    params: {
      job: "ゴブリンリーダー",
      action: "襲撃"
    },
    raidPosition: "front",
    raidTargeting: "weakestHighChance",
    portraits: numberedPortraits("GOB", 13),
    ranges: {
      hp: [50, 70],
      str: [15, 21],
      vit: [10, 20],
      dex: [18, 26],
      mag: [5, 12],
      chr: [8, 16],
      int: [15, 24],
      ind: [10, 18],
      eth: [1, 6],
      cou: [18, 26],
      sexdr: [16, 25]
    },
    mindTraits: ["首長"],
    dialogues: [
      "弱ったやつから囲め！強いのは後回しなのだ！",
      "弓を散らすな！倒せるやつへ狙いを集めるのだ！",
      "頭を使え！列を崩せば人間どもにも勝てるのだ！"
    ]
  },
  {
    type: "ゴブリン射手",
    weight: 0,
    minCount: 2,
    maxCount: 3,
    race: "ゴブリン",
    forcedSex: "男",
    ageRange: { min: 16, max: 32 },
    params: {
      job: "ゴブリン射手",
      action: "襲撃"
    },
    raidPosition: "middle",
    raidTargeting: "frontFirst",
    portraits: numberedPortraits("GOB", 13),
    ranges: {
      hp: [35, 55],
      str: [10, 16],
      vit: [6, 16],
      dex: [24, 32],
      mag: [5, 11],
      chr: [3, 10],
      int: [7, 15],
      ind: [6, 14],
      eth: [1, 5],
      cou: [15, 23],
      sexdr: [18, 25]
    },
    dialogues: [
      "前のやつらが押さえている間に射るのだ！",
      "逃げても背中を射抜くのだ！",
      "矢はまだある！次もすぐに射るのだ！"
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
      cou: [20, 25],
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
      hp: [70, 90],
      str: [20, 25],
      vit: [18, 23],
      dex: [20, 25],
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
      hp: [80, 100],
      str: [18, 23],
      vit: [18, 23],
      dex: [18, 28],
      mag: [5, 14],
      chr: [10, 20],
      int: [8, 18],
      ind: [10, 22],
      eth: [8, 16],
      cou: [18, 24],
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
      hp: [80, 100],
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
      hp: [70, 90],
      str: [22, 25],
      vit: [20, 25],
      dex: [18, 24],
      mag: [7, 16],
      chr: [16, 24],
      int: [14, 22],
      ind: [16, 24],
      eth: [12, 20],
      cou: [18, 25],
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
      hp: [80, 100],
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
    raidPosition: "front",
    raidTargeting: "frontFirst",
    portraits: numberedPortraits("SAINT", 21),
    ranges: {
      hp: [60, 90],
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
    portraitsByBodySex: {
      "男": numberedPortraits("SPHINX_M", 6),
      "女": numberedPortraits("SPHINX_F", 7)
    },
    ranges: {
      hp: [160, 200],
      str: [25, 32],
      vit: [25, 32],
      dex: [18, 28],
      mag: [34, 46],
      chr: [16, 24],
      int: [28, 36],
      ind: [18, 30],
      eth: [5, 18],
      cou: [20, 32],
      sexdr: [5, 12]
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
    raidAttackType: "rangedMagic",
    portraits: numberedPortraits("ANGEL_FIGHTER", 16),
    ranges: {
      hp: [70, 90],
      str: [16, 23],
      vit: [16, 23],
      dex: [16, 23],
      mag: [22, 27],
      chr: [20, 28],
      int: [16, 24],
      ind: [16, 24],
      eth: [22, 30],
      cou: [18, 24],
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
    raidPosition: "front",
    raidTargeting: "frontFirst",
    portraits: numberedPortraits("ARCHANGEL", 13),
    ranges: {
      hp: [80, 100],
      str: [18, 25],
      vit: [18, 25],
      dex: [16, 23],
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
    displayType: "《支配》",
    fixedName: "《支配》",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "黙示録の騎士",
    uiSexDisplay: "無性",
    ageRange: { min: 100, max: 300 },
    params: { job: "黙示録の騎士・支配", action: "襲撃" },
    raidPosition: "middle",
    raidTargeting: "frontMiddleRandom",
    raidAttackType: "rangedMagic",
    portraits: ["ALIGNMENT.png"],
    exchangeImmune: true,
    uncapturable: true,
    ranges: {
      hp: [200, 200],
      str: [28, 28],
      vit: [18, 18],
      dex: [28, 28],
      mag: [37, 37],
      chr: [64, 64],
      int: [60, 60],
      ind: [55, 55],
      eth: [100, 100],
      cou: [28, 28],
      sexdr: [0, 0]
    },
    forcedBodyTraits: ["飛行", "光輪", "多翼多眼", "交換無効"],
    replaceBodyTraits: true,
    mindTraits: ["狂信", "神聖"],
    replaceMindTraits: true,
    hobbies: ["万象監視"],
    dialogues: [
      "白き冠の下にひれ伏せ。すべての地は、天のものとなる。",
      "おまえたちの奇跡で、この身を奪うことはできぬ。",
      "支配は慈悲である。抗う自由さえ、ここで終わる。"
    ]
  },
  {
    type: "黙示録の騎士・戦争",
    displayType: "《戦争》",
    fixedName: "《戦争》",
    weight: 0,
    minCount: 1,
    maxCount: 1,
    race: "黙示録の騎士",
    uiSexDisplay: "無性",
    ageRange: { min: 100, max: 300 },
    params: { job: "黙示録の騎士・戦争", action: "襲撃" },
    raidPosition: "middle",
    raidTargeting: "frontFirst",
    portraits: ["WAR.png"],
    exchangeImmune: true,
    uncapturable: true,
    ranges: {
      hp: [180, 180],
      str: [32, 32],
      vit: [35, 35],
      dex: [30, 30],
      mag: [28, 28],
      chr: [1, 1],
      int: [32, 32],
      ind: [30, 30],
      eth: [38, 38],
      cou: [30, 30],
      sexdr: [2, 2]
    },
    forcedBodyTraits: ["飛行", "光輪", "機身", "交換無効"],
    replaceBodyTraits: true,
    mindTraits: ["狂信", "神聖"],
    replaceMindTraits: true,
    hobbies: ["異端討滅"],
    dialogues: [
      "赤き剣は、村と村人を分けては斬らぬ。すべてを戦場に変える。",
      "争え。憎め。そのたびに私の刃は重くなる。",
      "黄金の像を守る腕ごと、地へ落とそう。"
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
  manaRate: 0,
  security: 10,
  villagerHappiness: 30,
  buildingDamage: false,
  goldenStatueDamage: false,
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
  createCompositeRaiderRaid({
    id: "mercenary-band",
    name: "傭兵団の襲撃",
    warningName: "傭兵団",
    weight: 18,
    avoidance: {
      type: "resourcePayment",
      resource: "funds",
      label: "金を払う",
      rate: 0.4,
      minAmount: 200
    },
    representative: { raiderType: "傭兵団" },
    enemyGroupVariants: [
      {
        weight: 70,
        enemyGroups: [
          { raiderType: "傭兵団", minCount: 3, maxCount: 4 }
        ]
      },
      {
        weight: 30,
        enemyGroups: [
          { raiderType: "傭兵団", minCount: 3, maxCount: 4 },
          { raiderType: "傭兵射手", minCount: 1, maxCount: 1 }
        ]
      }
    ],
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
    id: "goblin-army",
    name: "ゴブリン軍団の襲撃",
    warningName: "ゴブリン軍団",
    weight: 10,
    representative: { raiderType: "ゴブリンリーダー", role: "leader" },
    enemyGroups: [
      { raiderType: "ゴブリンリーダー", minCount: 1, maxCount: 1 },
      { raiderType: "ゴブリン射手", minCount: 2, maxCount: 3 },
      { raiderType: "ゴブリン", minCount: 2, maxCount: 3 }
    ],
    defense: { surviveTurns: 5 },
    failurePenalty: {
      foodRate: 0.35,
      fundsRate: 0.2
    },
    introDialogues: [
      "弱った者から倒せ！弓隊は狙いを合わせるのだ！",
      "食料も金も奪う！今日は群れではなく、軍団の戦なのだ！",
      "前へ出る者と射る者を分けた！人間どもの列を崩すのだ！"
    ]
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
    id: "monster-stampede",
    name: "モンスター・スタンビード",
    warningName: "モンスター・スタンビード",
    weight: 5,
    representative: [
      { raiderType: "ゴブリンリーダー", role: "leader" },
      { raiderType: "ハーピーの長", role: "leader" }
    ],
    enemyGroups: [
      { raiderType: "ゴブリンリーダー", minCount: 1, maxCount: 1 },
      { raiderType: "ゴブリン射手", minCount: 2, maxCount: 2 },
      { raiderType: "キュクロプス", minCount: 1, maxCount: 1 },
      { raiderType: "ハーピーの長", minCount: 1, maxCount: 1 },
      { raiderType: "餓狼", minCount: 2, maxCount: 2 }
    ],
    defense: { surviveTurns: 5 },
    failurePenalty: {
      foodRate: 0.3,
      fundsRate: 0.3,
      buildingDamage: true
    },
    introDialogues: [
      "森も空も街道も騒いでいる。異なる群れが一つの奔流となって村へ迫る。",
      "角笛も号令もない。ただ飢えと怒号の波が、柵を目がけて押し寄せる。",
      "巨人の足音、翼の叫び、蹄と牙――魔物の大群が村を呑み込もうとしている。"
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
        { resource: "food", rate: 0.3, minAmount: 180 },
        { resource: "funds", rate: 0.3, minAmount: 300 }
      ]
    },
    representative: { raiderType: "強遊牧民" },
    enemyGroups: [
      { raiderType: "強遊牧民", minCount: 3, maxCount: 4 },
      { raiderType: "セントール", minCount: 1, maxCount: 2 }
    ],
    introDialogues: [
      "食料も富も差し出せ。拒む村は、蹄で踏み荒らす。",
      "我らは敗残ではない。狙って来た獲物を逃がさぬ。",
      "重い貢納で済ませるか、戦でさらに失うか。選べ。"
    ],
    failurePenalty: {
      foodRate: 0.3,
      fundsRate: 0.3,
      severeInjury: true
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
      rate: 0.5,
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
          { raiderType: "下級騎士", minCount: 3, maxCount: 3 },
          { raiderType: "重装兵", minCount: 1, maxCount: 1, mindTraits: [] },
          { raiderType: "上級騎士", minCount: 1, maxCount: 1, mindTraits: ["戦慣れ"] }
        ]
      },
      {
        weight: 20,
        enemyGroups: [
          { raiderType: "下級騎士", minCount: 2, maxCount: 2 },
          { raiderType: "重装兵", minCount: 1, maxCount: 1, mindTraits: [] },
          { raiderType: "上級騎士", minCount: 1, maxCount: 1, mindTraits: ["戦慣れ"] },
          { raiderType: "聖女", minCount: 1, maxCount: 1, mindTraits: [] }
        ]
      }
    ],
    introDialogues: [
      "聖地への道には寄進が要る。協力すれば剣は収めよう。",
      "巡礼の名を軽んじるなら、不信心者として扱う。",
      "志の高い者も、飢えた者もいる。だが装備と隊列は本物だ。"
    ],
    failurePenalty: {
      fundsRate: 0.4
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
      manaRate: 0.2,
      buildingDamage: true
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
      {
        raiderType: "翼人兵",
        minCount: 5,
        maxCount: 5,
        mindTraits: ["神聖"],
        excludedBodyTraits: ["聖女の輝き"]
      }
    ],
    failurePenalty: {
      security: 20,
      villagerHappiness: 40,
      buildingDamage: true,
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
      { raiderType: "下級騎士", minCount: 2, maxCount: 2 },
      { raiderType: "重装兵", minCount: 2, maxCount: 2, mindTraits: [] },
      { raiderType: "上級騎士", minCount: 2, maxCount: 2, mindTraits: ["歴戦"] },
      { raiderType: "聖女", minCount: 1, maxCount: 1, mindTraits: [] }
    ],
    failurePenalty: {
      foodRate: 0.4,
      fundsRate: 0.4,
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
      {
        raiderType: "翼人兵",
        minCount: 5,
        maxCount: 5,
        mindTraits: ["神聖", "戦慣れ"],
        excludedBodyTraits: ["聖女の輝き"]
      },
      {
        raiderType: "上位翼人",
        minCount: 1,
        maxCount: 1,
        mindTraits: ["神聖", "歴戦", "狂信"],
        excludedBodyTraits: ["聖女の輝き"]
      }
    ],
    defense: { surviveTurns: 5 },
    failurePenalty: {
      security: 20,
      villagerHappiness: 40,
      buildingDamage: true,
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
      {
        raiderType: "重装兵",
        minCount: 2,
        maxCount: 2,
        mindTraits: [],
        mindTraitChances: [{ trait: "秘蹟：盾", chance: 0.2 }]
      },
      {
        raiderType: "上級騎士",
        minCount: 2,
        maxCount: 2,
        mindTraits: ["歴戦"]
      },
      {
        raiderType: "聖女",
        minCount: 1,
        maxCount: 1,
        mindTraits: []
      },
      {
        raiderType: "聖騎士",
        minCount: 1,
        maxCount: 1,
        mindTraits: ["歴戦", "秘蹟：剣"]
      }
    ],
    defense: { surviveTurns: 5 },
    failurePenalty: {
      foodRate: 0.4,
      fundsRate: 0.4,
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
      {
        raiderType: "上位翼人",
        minCount: 1,
        maxCount: 1,
        excludedBodyTraits: ["聖女の輝き"]
      },
      {
        raiderType: "翼人兵",
        minCount: 2,
        maxCount: 3,
        excludedBodyTraits: ["聖女の輝き"]
      },
      { raiderType: "聖騎士", minCount: 1, maxCount: 1 },
      { raiderType: "聖女", minCount: 1, maxCount: 1 }
    ],
    defense: { surviveTurns: 5 },
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
    defense: { surviveTurns: 5 },
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
    warningName: "上位翼人兵と《支配》",
    weight: 0,
    representative: [
      { raiderType: "黙示録の騎士・支配" },
      { raiderType: "上位翼人" }
    ],
    enemyGroups: [
      {
        raiderType: "翼人兵",
        minCount: 3,
        maxCount: 3,
        mindTraits: ["歴戦", "神聖"],
        excludedBodyTraits: ["聖女の輝き"]
      },
      {
        raiderType: "上位翼人",
        minCount: 1,
        maxCount: 1,
        mindTraits: ["歴戦", "狂信", "神聖", "秘蹟：盾"],
        excludedBodyTraits: ["聖女の輝き"]
      },
      {
        raiderType: "上位翼人",
        minCount: 1,
        maxCount: 1,
        mindTraits: ["歴戦", "狂信", "神聖", "秘蹟：剣"],
        excludedBodyTraits: ["聖女の輝き"]
      },
      {
        raiderType: "上位翼人",
        minCount: 1,
        maxCount: 1,
        mindTraits: ["歴戦", "狂信", "神聖", "秘蹟：光"],
        excludedBodyTraits: ["聖女の輝き"]
      },
      { raiderType: "黙示録の騎士・支配", minCount: 1, maxCount: 1 }
    ],
    defense: { surviveTurns: 7 },
    successRewards: { completeHappiness: 30, partialHappiness: 15 },
    failurePenalty: {
      foodRate: 0.5,
      materialsRate: 0.5,
      fundsRate: 0.5,
      security: 0,
      villagerHappiness: 80,
      goldenStatueDamage: true,
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
    name: "第六の災厄・聖征軍団と戦争",
    warningName: "聖征軍団と《戦争》",
    weight: 0,
    representative: [
      { raiderType: "黙示録の騎士・戦争" },
      { raiderType: "聖騎士" },
      { raiderType: "聖女" }
    ],
    enemyGroups: [
      { raiderType: "重装兵", minCount: 2, maxCount: 2, mindTraits: ["歴戦", "秘蹟：盾"] },
      { raiderType: "聖女", minCount: 1, maxCount: 1, mindTraits: ["歴戦", "狂信"] },
      { raiderType: "聖騎士", minCount: 1, maxCount: 1, mindTraits: ["歴戦", "狂信", "秘蹟：剣"] },
      {
        raiderType: "上位翼人",
        minCount: 1,
        maxCount: 1,
        mindTraits: ["歴戦", "狂信", "神聖"],
        excludedBodyTraits: ["聖女の輝き"]
      },
      { raiderType: "黙示録の騎士・戦争", minCount: 1, maxCount: 1 }
    ],
    defense: { surviveTurns: 7 },
    failurePenalty: {
      foodRate: 0.5,
      materialsRate: 0.5,
      fundsRate: 0.5,
      security: 20,
      villagerHappiness: 60,
      goldenStatueDamage: true,
      severeInjury: true
    },
    introDialogues: [
      "第六の角笛は鳴った。赤き騎士の下、聖征の全軍をもってこの村を地図から消す。",
      "戦争の剣に抗う者よ、盾を並べよ。悔い改めの時は終わった。",
      "黄金の偶像を砕くまで、赤き刃も聖なる軍靴も止まらない。"
    ]
  })
];

const RAID_MODULE_BY_ID = new Map(RAID_MODULES.map(raid => [raid.id, raid]));

export const RAID_SCALE_TABLES = [
  {
    id: "early-frontier",
    label: "名もなき小集落・小さな開拓村",
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
    label: "辺境の村",
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
    label: "旅人の立ち寄る村",
    scaleStageIndexes: [3],
    entries: [
      { raidId: "goblin", weight: 10 },
      { raidId: "goblin-army", weight: 0 },
      { raidId: "wolf", weight: 5 },
      { raidId: "mercenary-band", weight: 10 },
      { raidId: "harpy", weight: 10 },
      { raidId: "grassland-people", weight: 10 },
      { raidId: "pilgrimage-knights", weight: 5 }
    ]
  },
  {
    id: "rich-village",
    label: "豊かな村",
    scaleStageIndexes: [4],
    entries: [
      { raidId: "starving-wolves", weight: 10 },
      { raidId: "goblin-army", weight: 10 },
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
    label: "繁栄した郷村",
    scaleStageIndexes: [5],
    excludedVillageTrait: "異端",
    entries: [
      { raidId: "mercenary-band", weight: 5 },
      { raidId: "goblin-army", weight: 10 },
      { raidId: "pilgrimage-knights", weight: 10 },
      { raidId: "harpy-swarm", weight: 10 },
      { raidId: "starving-wolves", weight: 10 },
      { raidId: "horse-nomad-raid", weight: 10 },
      { raidId: "cyclops", weight: 10 }
    ]
  },
  {
    id: "autonomous-settlement",
    label: "自治集落",
    scaleStageIndexes: [6],
    excludedVillageTrait: "異端",
    entries: [
      { raidId: "pilgrimage-knights", weight: 10 },
      { raidId: "goblin-army", weight: 5 },
      { raidId: "monster-stampede", weight: 5 },
      { raidId: "harpy-swarm", weight: 10 },
      { raidId: "starving-wolves", weight: 5 },
      { raidId: "horse-nomad-raid", weight: 10 },
      { raidId: "cyclops-band", weight: 10 },
      { raidId: "sphinx-visit", weight: 5 }
    ]
  },
  {
    id: "heresy-prosperous-village",
    label: "繁栄した郷村（異端）",
    scaleStageIndexes: [5],
    requiredVillageTrait: "異端",
    entries: [
      { raidId: "holy-crusade", weight: 15 },
      { raidId: "winged-punishment", weight: 15 },
      { raidId: "goblin-army", weight: 5 },
      { raidId: "harpy-swarm", weight: 10 },
      { raidId: "horse-nomad-raid", weight: 10 },
      { raidId: "cyclops", weight: 10 }
    ]
  },
  {
    id: "heresy-autonomous-settlement",
    label: "自治集落（異端）",
    scaleStageIndexes: [6],
    requiredVillageTrait: "異端",
    entries: [
      { raidId: "holy-crusade-strong", weight: 15 },
      { raidId: "winged-punishment-strong", weight: 15 },
      { raidId: "goblin-army", weight: 5 },
      { raidId: "monster-stampede", weight: 5 },
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
