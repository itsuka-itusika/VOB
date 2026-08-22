import { resolveDialogueTone } from "./dialogue/toneProfiles.js";

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


// 要望のセリフは、願望と同じく「理由の本文」と「口調ごとの頼み方」に分ける。
// 本文は建物名を含まない中立な言い切りにし、ここで建物名と依頼の言葉を足す。
const BUILDING_REQUEST_TONE_PATTERNS = {
  "赤子": (_line, { buildingName }) => `あぅ……あぅ。（${buildingName}が建つはずの場所へ、しきりに手を伸ばしている）`,
  "男児": (line, { buildingName }) => `${line} かみさま、${buildingName}をつくって！`,
  "女児": (line, { buildingName }) => `${line} かみさま、${buildingName}がほしいの。おねがい！`,
  "普通Ｍ": (line, { buildingName }) => `${line} 神さま、${buildingName}を建ててくれないか。`,
  "丁寧Ｍ": (line, { buildingName }) => `神さま、お願いがあります。${line} ${buildingName}を建てていただけませんか。`,
  "強気Ｍ": (line, { buildingName }) => `${line} ${buildingName}を建ててくれ、神さま。損はさせない。`,
  "乱暴": (line, { buildingName }) => `${line} ${buildingName}だ。頼んだぞ、神さま。`,
  "お調子者": (line, { buildingName }) => `${line} なあ神さま、${buildingName}をひとつ景気よく頼むぜ！`,
  "陰気": (line, { buildingName }) => `${line} ……${buildingName}が、あればいいんだけど。`,
  "クールＭ": (line, { buildingName }) => `${line} 要るのは${buildingName}だ。建設を進言する。`,
  "普通Ｆ": (line, { buildingName }) => `${line} 神さま、${buildingName}を建ててくれない？`,
  "丁寧Ｆ": (line, { buildingName }) => `神さま、お願いがございます。${line} ${buildingName}を建てていただけませんか。`,
  "お嬢様": (line, { buildingName }) => `${line} ${buildingName}を建ててくださいませ、神さま。`,
  "快活": (line, { buildingName }) => `${line} ねえ神さま、${buildingName}を建てようよ！`,
  "内気": (line, { buildingName }) => `${line} あの……${buildingName}を、建てていただけませんか。`,
  "強気Ｆ": (line, { buildingName }) => `${line} ${buildingName}を建てて。それだけでいいわ。`,
  "蓮っ葉": (line, { buildingName }) => `${line} ${buildingName}、建ててよ神さま。悪い話じゃないでしょ。`,
  "おっとり": (line, { buildingName }) => `${line} ${buildingName}を建てていただけたら、うれしいのですけれど。`,
  "ぶりっこ": (line, { buildingName }) => `${line} だからね、${buildingName}がほしいの。神さま、おねがい。`,
  "クールＦ": (line, { buildingName }) => `${line} 必要なのは${buildingName}よ。建設を進めるべきね。`,
  "ギャル風": (line, { buildingName }) => `${line} てことで${buildingName}、建ててほしいんだけど！ 神さま頼んだ！`,
  "中性的": (line, { buildingName }) => `${line} ${buildingName}を建ててほしい。それで村は変わると思う。`,
  "老人": (line, { buildingName }) => `${line} ${buildingName}を建ててくださらんか、神さま。`,
  "狼": (_line, { buildingName }) => `くぅん……。（${buildingName}が建つはずの地面を、何度も前足で掻いている）`,
  "ゴブリン": (line, { buildingName }) => `${line} ${buildingName}、ほしい。つくってほしい、かみさま。`
};

/** 要望の依頼セリフを、本文と口調から組み立てる。rawLines はそのまま使う。 */
export function resolveBuildingRequestLine(line, context = {}, character = null, { raw = false } = {}) {
  const baseLine = String(line || "");
  if (raw || !character) return baseLine;
  const tone = resolveDialogueTone(character);
  const pattern = BUILDING_REQUEST_TONE_PATTERNS[tone] ||
    BUILDING_REQUEST_TONE_PATTERNS[character.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"];
  return pattern(baseLine, context);
}

export const BUILDING_REQUEST_DEFINITIONS = [
  {
    buildingId: "tavern",
    name: "酒場",
    rules: [
      { id: "tavern_playful_trait", lines: ["畑と祈りだけでは息が詰まる。夜に人が集まって笑える場所がほしい。"] },
      { id: "tavern_poet", lines: ["詩は炉端でも詠める。だが声を集める場所があれば、村人の心をもっと温められる。"] },
      { id: "tavern_dancer", lines: ["踊るなら、足音まで受け止めてくれる床がほしい。人の集まる場所があれば、この踊りで村を明るくできる。"] },
      { id: "tavern_drinker", lines: ["よい酒を囲む場所がほしい。働いた後の一杯も、祭の支度も映えるはずだ。"] },
      { id: "tavern_lustful", lines: ["にぎやかな灯りがあれば、人の縁もほどける。もう少し浮かれた夜がほしい。"] }
    ]
  },
  {
    buildingId: "fountain",
    name: "噴水",
    rules: [
      { id: "fountain_lover", lines: ["恋人と歩ける水辺があれば、日々の祈りのあとにも心が安らぐ。"] },
      { id: "fountain_child", lines: ["水がきらきらする場所がほしい。遊びに行くのが楽しみになる。"] },
      { id: "fountain_nereid", lines: ["水の音が村の真ん中にあれば、ここでも息がしやすくなる。"] },
      { id: "fountain_waterfall", lines: ["村の真ん中に落ちる水があれば、そこで滝行の練習ができる。水量が足りなくても気合で滝にする。"] }
    ]
  },
  {
    buildingId: "church",
    name: "礼拝堂",
    rules: [
      { id: "church_priest", lines: ["祈りを捧げる場が足りない。静かに祈れる場所があれば、皆の迷いにも寄り添える。"] },
      { id: "church_distressed", lines: ["胸の奥が重い夜がある。祈れる場所があれば、もう少し持ちこたえられる気がする。"] },
      { id: "church_prayer", lines: ["祈りを日々の支えにしたい。そのための場所がほしい。"] },
      { id: "church_ethical", lines: ["村が大きくなるほど、心を正す場所が要る。あれば皆の歩みも乱れにくい。"] }
    ]
  },
  {
    buildingId: "clinic",
    name: "診療所",
    rules: [
      { id: "clinic_nurse", lines: ["看護の手だけでは追いつかないことがある。腰を据えて診られる場所があれば、傷ついた者をもっと確かに助けられる。"] },
      { id: "clinic_injured", lines: ["この傷を見ていると、村に手当ての場所が要ると分かる。次に誰かが倒れる前に備えたい。"] },
      {
        id: "clinic_pregnant",
        linesBySpiritSex: {
          male: ["この身で子を抱えていると、急な痛みや変化が本気で怖い。頼れる場所があれば、俺も周りも少し落ち着ける。"],
          female: ["お腹に子がいると、少しの変化でも怖くなる。頼れる場所があれば、私も支えてくれる人も安心できる。"]
        }
      }
    ]
  },
  {
    buildingId: "publicBath",
    name: "公衆浴場",
    rules: [
      { id: "bath_clean", lines: ["身を清める湯屋がほしい。汗も汚れも気にせず働けるようになる。"] },
      { id: "bath_lover", lines: ["湯に浸かれる場所があるだけで、明日も頑張れる気がする。"] },
      { id: "bath_sweaty", lines: ["働くたび汗でつらい。身をさっぱりさせられれば、また村の役に立てる。"] },
      { id: "bath_cold", lines: ["冷える日は骨までこたえる。温かな湯に入れる場所があれば助かる。"] },
      // 肉体交換した好色者の語り口そのものが芯なので、口調の枠では包まずそのまま使う。
      { id: "bath_cross_lustful", rawLines: [
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
      { id: "library_research", lines: ["研究の覚えを木片や余白に残すだけでは限界がある。まとめて置ける場所があれば、知を村に蓄えられる。"] },
      { id: "library_books", lines: ["本を置き、読み返せる場所がほしい。村の子らにも知恵を渡せる。"] }
    ]
  },
  {
    buildingId: "market",
    name: "市場",
    rules: [
      { id: "market_trader", lines: ["行商の目で見ると、この村には市を開く場所が足りない。あれば外との取引も太くなる。"] },
      { id: "market_shrewd", lines: ["品と人の流れを整えれば、村はもっと潤う。商いの道を広げたい。"] },
      { id: "market_investment", lines: ["投じる先が村の中にあれば、実りも村へ戻ってくる。"] }
    ]
  },
  {
    buildingId: "dock",
    name: "網干場",
    rules: [
      { id: "dock_fishing", lines: ["釣り場の恵みを無駄にしたくない。魚を干して蓄える場所があれば、もっと確かに扱える。"] },
      { id: "dock_gourmet", lines: ["よい魚は、扱いを間違えると台無しになる。きちんと干せる場所がほしい。"] }
    ]
  },
  {
    buildingId: "huntingLodge",
    name: "狩猟小屋",
    rules: [
      { id: "hunting_hobby", lines: ["森へ入る支度を整える場所がほしい。獲物にも危険にも備えられる。"] },
      { id: "hunting_gourmet", lines: ["よい肉を得るには、狩りの支度から整えるべきだ。"] }
    ]
  },
  {
    buildingId: "watermill",
    name: "水車小屋",
    rules: [
      { id: "watermill_scholar", lines: ["水の力を使えば、人の手だけに頼らず働ける。村の知恵になるはずだ。"] }
    ]
  },
  {
    buildingId: "brewery",
    name: "醸造所",
    rules: [
      { id: "brewery_shrewd", lines: ["酒は楽しみであり、商いの種でもある。仕込む場所があれば村の懐も温まる。"] },
      { id: "brewery_drinker", lines: ["酒をただ飲むだけではもったいない。村の恵みを自分たちで仕込みたい。"] },
      { id: "brewery_gourmet", lines: ["食と酒が整えば、人は自然と集まる。村の味を育てたい。"] },
      { id: "brewery_miser", lines: ["酒は人を集め、口も財布の紐もゆるめる。外へ流れる利を村の懐に戻せる。"] }
    ]
  },
  {
    buildingId: "alchemy",
    name: "錬金工房",
    rules: [
      { id: "alchemy_scholar", lines: ["魔素と技を試す場があれば、村に新しい実りを返せる。"] },
      { id: "alchemy_meditation", lines: ["占いや瞑想で見えるものを、形にする場所がほしい。"] },
      { id: "alchemy_mystic", lines: ["目に見えない力をただ恐れるより、扱いを学ぶべきだ。"] },
      { id: "alchemy_free_research", lines: ["自由研究を続けるには、道具も火も足りない。揃えられる場所があれば、試せることが増える。"] }
    ]
  },
  {
    buildingId: "arcaneFoundry",
    name: "魔導工廠",
    rules: [
      { id: "arcaneFoundry_alchemist", lines: ["釜の火では、もう作れるものが頭打ちだ。溜めた魔素を火に変えて、村の外へ向けたい。"] },
      { id: "arcaneFoundry_mad", lines: ["魔素は祈るためだけのものではない。筒に込めて撃ち出せる。道具さえ揃えば、私が組み上げてみせる。"] },
      { id: "arcaneFoundry_veteran", lines: ["前の襲撃で、こちらの槍は届かなかった。あの距離から撃ち返せる手があれば、次は誰も転がさずに済む。"] },
      { id: "arcaneFoundry_craftsman", lines: ["醸造も錬金も回るようになった。次は、村を守る道具をこの手で作る番だ。"] }
    ]
  },
  {
    buildingId: "weaving",
    name: "機織小屋",
    rules: [
      { id: "weaving_arachnid", lines: ["糸を扱う場があれば、この手ももっと村の役に立つ。"] },
      { id: "weaving_fashion", lines: ["祭の日くらい、いい布で気分を上げたい。普段の仕事着も整えたい。"] },
      { id: "weaving_worker", lines: ["手を動かせる仕事場が整えば、もっと働ける。村の稼ぎも増える。"] },
      { id: "weaving_shrewd", lines: ["布は腐らず、売りにも備えにもなる。織る場所を持てば、村の商いは強くなる。"] }
    ]
  }
];
