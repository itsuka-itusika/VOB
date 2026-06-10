export const BUILDING_REQUEST_DURATION_MONTHS = 6;
export const BUILDING_REQUEST_DISCOUNT_RATE = 0.2;

export const BUILDING_REQUEST_COMPLETION_LINES = {
  "赤子": [() => "あう……えへ……。（うれしそうに手を伸ばしている）"],
  "無垢": [() => "あう……えへ……。（うれしそうに手を伸ばしている）"],
  "男児": [({ buildingName }) => `${buildingName}できたんだ！ 神さま、ありがとう。ぼく、すごくうれしい！`],
  "女児": [({ buildingName }) => `${buildingName}できたの？ 神さま、ありがとう。わたし、とってもうれしい！`],
  "普通Ｍ": [({ buildingName }) => `${buildingName}を建ててくれてありがとう。これで村の暮らしが少し良くなるな。`],
  "丁寧Ｍ": [({ buildingName }) => `${buildingName}を建ててくださり、ありがとうございます。願いを聞き届けていただきました。`],
  "強気Ｍ": [({ buildingName }) => `${buildingName}が建ったな。神さま、よく応えてくれた。これで村はもっと強くなる。`],
  "乱暴": [({ buildingName }) => `${buildingName}を本当に建ててくれたのか。ありがてえ、これなら文句なしだ。`],
  "お調子者": [({ buildingName }) => `やった、${buildingName}だ！ 神さま、話が分かるなあ。村がぱっと明るくなるぜ。`],
  "陰気": [({ buildingName }) => `${buildingName}が建つとは思わなかった……。神さま、ありがとう。少しだけ、先が明るく見える。`],
  "クールＭ": [({ buildingName }) => `${buildingName}の完成を確認した。要望への対応、感謝する。村の効率も上がるはずだ。`],
  "普通Ｆ": [({ buildingName }) => `${buildingName}を建ててくれてありがとうございます。これで皆の毎日が楽になりますね。`],
  "丁寧Ｆ": [({ buildingName }) => `${buildingName}を建ててくださり、心より感謝いたします。願いが叶って胸が満たされました。`],
  "お嬢様": [({ buildingName }) => `${buildingName}を建ててくださいましたのね。神さまのお心遣い、深く感謝いたしますわ。`],
  "快活": [({ buildingName }) => `わあ、${buildingName}だ！ 神さま、ありがとう！ これで村がもっと元気になるね！`],
  "内気": [({ buildingName }) => `${buildingName}を建ててくださって……ありがとうございます。お願いしてよかったです。`],
  "強気Ｆ": [({ buildingName }) => `${buildingName}、ちゃんと建ててくれたのね。感謝するわ。これで皆も助かるはずよ。`],
  "蓮っ葉": [({ buildingName }) => `${buildingName}を本当に建ててくれたんだ。ありがと、神さま。こういうの、悪くないわね。`],
  "おっとり": [({ buildingName }) => `${buildingName}ができたのですね。神さま、ありがとうございます。心がふっと軽くなりました。`],
  "ぶりっこ": [({ buildingName }) => `${buildingName}を建ててくれたんだね。神さま、ありがと。すっごくうれしいな。`],
  "クールＦ": [({ buildingName }) => `${buildingName}の完成を確認したわ。要望に応えてくれて感謝する。良い判断ね。`],
  "ギャル風": [({ buildingName }) => `${buildingName}できてるじゃん！ 神さま、ありがと。これ、村のみんなも助かるやつだね。`],
  "中性的": [({ buildingName }) => `${buildingName}を建ててくれてありがとう。これで村の空気も少し変わりそうだね。`],
  "老人": [({ buildingName }) => `${buildingName}を建ててくださったか。ありがたいことじゃ。これで村も少し安らぐのう。`],
  default: [({ buildingName }) => `${buildingName}を建ててくださってありがとうございます。`]
};

export const BUILDING_REQUEST_DEFINITIONS = [
  {
    buildingId: "tavern",
    name: "酒場",
    rules: [
      {
        id: "tavern_playful_trait",
        linesBySpiritSex: {
          male: ["神さま、畑と祈りだけじゃ息が詰まるんだ。酒場があれば、夜に一杯やって笑える場所になるだろ。"],
          female: ["神さま、畑と祈りだけじゃ息が詰まるの。酒場があれば、夜にみんなで笑える場所になると思うんだ。"]
        }
      },
      { id: "tavern_poet", lines: ["詩は炉端でも詠めますが、声を集める場所があれば、村人の心をもっと温められます。"] },
      {
        id: "tavern_dancer",
        linesBySpiritSex: {
          male: ["踊るなら、床が鳴って人が集まる場所がほしいな。酒場があれば、俺の足でも村を明るくできると思う。"],
          female: ["踊るなら、足音まで受け止めてくれる場所がほしいな。酒場があれば、わたしの踊りでみんなを明るくできると思う。"]
        }
      },
      { id: "tavern_drinker", lines: ["よい酒を囲む場所がほしいです。酒場があれば、働いた後の一杯も祭の支度も映えます。"] },
      { id: "tavern_lustful", lines: ["にぎやかな灯りがあれば、人の縁もほどけます。酒場を建てて、もう少し浮かれた夜をください。"] }
    ]
  },
  {
    buildingId: "fountain",
    name: "噴水",
    rules: [
      { id: "fountain_lover", lines: ["恋人と歩ける水辺があれば、日々の祈りのあとにも心が安らぎます。噴水を置けませんか。"] },
      { id: "fountain_child", lines: ["水がきらきらする場所がほしいです。噴水があれば、遊びに行くのが楽しみになります。"] },
      { id: "fountain_nereid", lines: ["水の音が村の真ん中にあれば、ここでも息がしやすくなります。噴水を作ってください。"] },
      { id: "fountain_waterfall", lines: ["噴水があれば、そこで滝行の練習ができます。水量が足りなくても気合で滝にします。どうか止めないでください。"] }
    ]
  },
  {
    buildingId: "church",
    name: "礼拝堂",
    rules: [
      { id: "church_priest", lines: ["祈りを捧げる場が足りません。礼拝堂があれば、皆の迷いにも静かに寄り添えます。"] },
      { id: "church_distressed", lines: ["胸の奥が重い夜があります。礼拝堂で祈れたなら、もう少し持ちこたえられる気がします。"] },
      { id: "church_prayer", lines: ["祈りを日々の支えにしたいのです。礼拝堂を建てていただけませんか。"] },
      { id: "church_ethical", lines: ["村が大きくなるほど、心を正す場所が必要です。礼拝堂があれば、皆の歩みも乱れにくくなります。"] }
    ]
  },
  {
    buildingId: "clinic",
    name: "診療所",
    rules: [
      { id: "clinic_nurse", lines: ["看護の手だけでは追いつかないことがあります。診療所があれば、傷ついた者をもっと確かに助けられます。"] },
      { id: "clinic_injured", lines: ["この傷を見ていると、村に診療所が必要だと分かります。次に誰かが倒れる前に備えたいです。"] },
      {
        id: "clinic_pregnant",
        linesBySpiritSex: {
          male: ["この身で子を抱えていると、急な痛みや変化が本気で怖いんだ。診療所があれば、俺も周りも少し落ち着ける。"],
          female: ["お腹に子がいると、少しの変化でも怖くなるの。診療所があれば、私も支えてくれる人も安心できる。"]
        }
      }
    ]
  },
  {
    buildingId: "publicBath",
    name: "公衆浴場",
    rules: [
      { id: "bath_clean", lines: ["身を清める湯屋がほしいです。公衆浴場があれば、汗も汚れも心配せず働けます。"] },
      { id: "bath_lover", lines: ["湯に浸かれる場所があるだけで、明日も頑張れる気がします。公衆浴場を建てましょう。"] },
      { id: "bath_sweaty", lines: ["働くたび汗でつらいのです。公衆浴場があれば、身をさっぱりさせてまた村の役に立てます。"] },
      { id: "bath_cold", lines: ["冷える日は骨までこたえます。温かな湯に入れる公衆浴場があれば助かります。"] },
      { id: "bath_cross_lustful", lines: [
        "いやあ、この身体、実に素晴らしい……じゃなくて、やっぱり女性の肌には日々の潤いが必要だと思うんだよね。ほら、公衆浴場とか作ってくれたら、みんな大喜びだよ？",
        "この柔らかい身体を維持するには、お湯でじっくり磨き上げなきゃダメだよなぁ。公衆浴場を作ってくれよ。どんな風に育つか……いや、どう癒やされるか楽しみだろ？",
        "ふぅ……女の身体ってのは、思っていた以上に手入れが大変でね。なぁ、広いお風呂を作ってくれないか？ ほら、色々と『観察』しながら湯浴みを楽しみたいじゃないか",
        "慣れない女性の身体は肩が凝って大変なんだ。なぁ、大きな公衆浴場を建ててくれよ。汗を流して、この肌をじっくり労わってやりたいんだ……くくっ",
        "この胸の重みのせいか、どうにも息が詰まってね。湯船でゆったり身体を伸ばしたいんだよ。公衆浴場があれば、村の娘たちとも『裸の付き合い』で親睦が深められると思わないかい？",
        "女の身体ってのは、じっくり温めると実にいい香りがするんだ。なぁ、公衆浴場を作ってくれよ。毎日通って、この身体の隅々まで『お手入れ』してあげなきゃもったいないだろ？",
        "せっかく女の子になれたんだ、大浴場で極上の湯浴みってやつを体験しなきゃ損だろ！ 頼むから公衆浴場を建ててくれ。最前線でリサーチしてきてやるからさ！",
        "見てよこの極上ボディ！ これを狭いタライの水で済ませろっていうの？ 頼むよ神様、公衆浴場を作って！ 最高のシチュエーションで、この身体を最高に堪能させてくれ！"
      ] }
    ]
  },
  {
    buildingId: "library",
    name: "図書館",
    rules: [
      { id: "library_research", lines: ["研究の覚えを木片や余白に残すだけでは限界があります。図書館があれば、知を村に蓄えられます。"] },
      { id: "library_books", lines: ["本を置き、読み返せる場所がほしいです。図書館があれば、村の子らにも知恵を渡せます。"] }
    ]
  },
  {
    buildingId: "market",
    name: "市場",
    rules: [
      { id: "market_trader", lines: ["行商の目で見ると、この村には市の場所が足りません。市場があれば、外との取引も太くなります。"] },
      { id: "market_shrewd", lines: ["品と人の流れを整えれば、村はもっと潤います。市場を建てて、商いの道を広げましょう。"] },
      { id: "market_investment", lines: ["投じる先が村の中にあれば、実りも村へ戻ります。市場を作りませんか。"] }
    ]
  },
  {
    buildingId: "dock",
    name: "網干場",
    rules: [
      { id: "dock_fishing", lines: ["釣り場の恵みを無駄にしたくありません。網干場があれば、魚をもっと確かに扱えます。"] },
      { id: "dock_gourmet", lines: ["よい魚は、扱いを間違えると台無しです。網干場があれば、村の食卓も豊かになります。"] }
    ]
  },
  {
    buildingId: "huntingLodge",
    name: "狩猟小屋",
    rules: [
      { id: "hunting_hobby", lines: ["森へ入る支度を整える小屋がほしいです。狩猟小屋があれば、獲物にも危険にも備えられます。"] },
      { id: "hunting_gourmet", lines: ["よい肉を得るには、狩りの支度から整えるべきです。狩猟小屋を建てませんか。"] }
    ]
  },
  {
    buildingId: "watermill",
    name: "水車小屋",
    rules: [
      { id: "watermill_scholar", lines: ["水の力を使えば、人の手だけに頼らず働けます。水車小屋は村の知恵になるはずです。"] }
    ]
  },
  {
    buildingId: "brewery",
    name: "醸造所",
    rules: [
      { id: "brewery_shrewd", lines: ["酒は楽しみであり、商いの種でもあります。醸造所があれば、村の懐も温まるでしょう。"] },
      { id: "brewery_drinker", lines: ["酒をただ飲むだけではもったいないです。醸造所で村の恵みを仕込みましょう。"] },
      { id: "brewery_gourmet", lines: ["食と酒が整えば、人は自然と集まります。醸造所を建てて、村の味を育てませんか。"] },
      { id: "brewery_miser", lines: ["酒は人を集め、口も財布の紐もゆるめます。醸造所があれば、外へ流れる利を村の懐に戻せます。"] }
    ]
  },
  {
    buildingId: "alchemy",
    name: "錬金工房",
    rules: [
      { id: "alchemy_scholar", lines: ["魔素と技を試す場があれば、村に新しい実りを返せます。錬金工房を建ててください。"] },
      { id: "alchemy_meditation", lines: ["占いや瞑想で見えるものを、形にする場所がほしいです。錬金工房なら叶うかもしれません。"] },
      { id: "alchemy_mystic", lines: ["目に見えない力をただ恐れるより、扱いを学ぶべきです。錬金工房が必要です。"] },
      { id: "alchemy_free_research", lines: ["自由研究を続けるには、道具も火も足りません。錬金工房があれば、試せることが増えます。"] }
    ]
  },
  {
    buildingId: "weaving",
    name: "機織小屋",
    rules: [
      { id: "weaving_arachnid", lines: ["糸を扱う場があれば、私の手ももっと村の役に立ちます。機織小屋を建ててください。"] },
      { id: "weaving_fashion", lines: ["祭の日くらい、いい布で気分を上げたいです。普段の仕事着も整えたいし、機織小屋がほしいです。"] },
      { id: "weaving_worker", lines: ["手を動かせる仕事場が整えば、もっと働けます。機織小屋を建てて、村の稼ぎを増やしましょう。"] },
      { id: "weaving_shrewd", lines: ["布は腐らず、売りにも備えにもなります。機織小屋を持てば、村の商いは強くなります。"] }
    ]
  }
];
