export const BUILDING_REQUEST_DURATION_MONTHS = 6;
export const BUILDING_REQUEST_DISCOUNT_RATE = 0.2;

export const BUILDING_REQUEST_DEFINITIONS = [
  {
    buildingId: "tavern",
    name: "酒場",
    rules: [
      { id: "tavern_playful_trait", lines: ["神さま、畑と祈りだけでは息が詰まります。酒場があれば、夜にも村へ笑い声が戻るでしょう。"] },
      { id: "tavern_poet", lines: ["詩は炉端でも詠めますが、声を集める場所があれば、村人の心をもっと温められます。"] },
      { id: "tavern_dancer", lines: ["踊るなら、足音を受け止めてくれる場所がほしいです。酒場があれば、皆を明るくできます。"] },
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
      { id: "fountain_waterfall", lines: ["滝行ほど荒くなくて構いません。清い水音を聞ける噴水があれば、身も心も整います。"] }
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
      { id: "clinic_pregnant", lines: ["身ごもると、急な変化が恐ろしくなります。診療所があれば、産む者も支える者も安心できます。"] }
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
      { id: "bath_cross_lustful", lines: ["この身で生きるには、湯で息を整える時間がほしいです。公衆浴場を願ってもよいでしょうか。"] }
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
      { id: "brewery_miser", lines: ["外から高い酒を買うより、村で仕込むほうが利があります。醸造所はよい稼ぎ口になります。"] }
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
      { id: "weaving_fashion", lines: ["身なりを整える布が村にあれば、祭の日も働く日も気持ちが変わります。機織小屋がほしいです。"] },
      { id: "weaving_worker", lines: ["手を動かせる仕事場が整えば、もっと働けます。機織小屋を建てて、村の稼ぎを増やしましょう。"] },
      { id: "weaving_shrewd", lines: ["布は腐らず、売りにも備えにもなります。機織小屋を持てば、村の商いは強くなります。"] }
    ]
  }
];
