import { theVillage } from "./main.js";
import { updateUI } from "./ui.js";
import { randInt, randChoice, getPortraitPath } from "./util.js";
import { refreshJobTable } from "./createVillagers.js";  // refreshJobTableをインポート

// 口調タイプごとのテンプレート
const SPEECH_PATTERNS = {
  // 男性用
  "普通Ｍ": {
    greet: [
      "やあ、こんにちは。",
      "こんにちは。いい天気だね。",
      "やあ、調子はどう？"
    ],
    talk: [
      "今日は良い天気だね。",
      "空が綺麗だね。",
      "こんな日は外で仕事したくなるよ。"
    ],
    work: [
      "仕事は順調に進んでいるよ。",
      "まあまあ順調かな。",
      "ぼちぼち頑張ってるよ。"
    ]
  },
  "丁寧Ｍ": {
    greet: [
      "こんにちは。お会いできて光栄です。",
      "ご機嫌いかがでしょうか。",
      "お日柄も良く、素晴らしい一日ですね。"
    ],
    talk: [
      "本日は素晴らしい天気ですね。",
      "まさに春の訪れを感じる陽気ですね。",
      "こういった天候は心が洗われる思いです。"
    ],
    work: [
      "仕事は順調に進んでおります。",
      "おかげさまで、滞りなく進めております。",
      "皆様のご協力のもと、着実に前進しております。"
    ]
  },
  "強気Ｍ": {
    greet: [
      "よう！元気か？",
      "おっ！今日も張り切ってるな！",
      "よう！待ってたぜ！"
    ],
    talk: [
      "最高の天気じゃないか！",
      "こんな日は体が騒ぐぜ！",
      "外で仕事するにはピッタリだな！"
    ],
    work: [
      "仕事なら任せとけ！バッチリだ！",
      "順調すぎて退屈なくらいさ！",
      "オレに任せときな！完璧にこなしてやる！"
    ]
  },
  "乱暴": {
    greet: [
      "おうよ！",
      "よっ！",
      "おっ、来たな！"
    ],
    talk: [
      "いい天気だぜ！",
      "最高の天気じゃねえか！",
      "こんな日は外で暴れてえな！"
    ],
    work: [
      "仕事？余裕だぜ！",
      "バリバリこなしてるぜ！",
      "てめえらに任せとけ！"
    ]
  },
  "お調子者": {
    greet: [
      "やぁやぁ、こんちはー！",
      "やっほー、元気？",
      "おー！会えて嬉しいっす！"
    ],
    talk: [
      "いやー、最高の天気っすねー！",
      "こんな日は遊びに行きたくなりますよー！",
      "外がキラキラしてますねー！"
    ],
    work: [
      "仕事順調っすよー！",
      "バッチリこなしてますよー！",
      "任せてくださいっす！"
    ]
  },
  "陰気": {
    greet: [
      "...こんにちは。",
      "...やあ。",
      "...なんか用か？"
    ],
    talk: [
      "まあ...天気は良いですね...",
      "空が...綺麗ですね...",
      "こんな日は...家で過ごしたいです..."
    ],
    work: [
      "仕事は...なんとかやってます...",
      "それなりに...頑張ってます...",
      "...問題ありません..."
    ]
  },
  "クールＭ": {
    greet: [
      "ご機嫌よう。",
      "やあ。",
      "会えて光栄だ。"
    ],
    talk: [
      "良い天気だな。",
      "快適な気候だ。",
      "素晴らしい空だ。"
    ],
    work: [
      "仕事は問題ない。",
      "順調に進んでいる。",
      "心配には及ばない。"
    ]
  },

  // 女性用
  "普通Ｆ": {
    greet: [
      "こんにちは。",
      "あ、こんにちは。",
      "お会いできて嬉しいです。"
    ],
    talk: [
      "今日はいい天気ですね。",
      "気持ちのいい天気です。",
      "空が綺麗ですね。"
    ],
    work: [
      "仕事は順調です。",
      "頑張っています。",
      "なんとかやっています。"
    ]
  },
  "丁寧Ｆ": {
    greet: [
      "こんにちは。お会いできて嬉しいです。",
      "いつもお世話になっております。",
      "本日は素晴らしい出会いをありがとうございます。"
    ],
    talk: [
      "素晴らしいお天気ですね。",
      "まさに春のような陽気でございます。",
      "心が洗われるような青空ですね。"
    ],
    work: [
      "お仕事は順調に進んでおります。",
      "皆様のおかげで順調でございます。",
      "精一杯努めさせていただいております。"
    ]
  },
  "お嬢様": {
    greet: [
      "ごきげんよう。",
      "まあ、お会いできて光栄ですわ。",
      "素敵な出会いですわね。"
    ],
    talk: [
      "まあ、素晴らしいお天気ですわ。",
      "こんな日は庭でお茶会でも開きたくなりますわね。",
      "まるで絵画のような空ですわ。"
    ],
    work: [
      "お仕事は順調ですわ。",
      "それなりに努力しておりますわ。",
      "皆様のお力添えのおかげですわ。"
    ]
  },
  "快活": {
    greet: [
      "やっほー！こんにちは！",
      "わーい！会えた！",
      "元気？私は元気！"
    ],
    talk: [
      "今日の天気サイコー！",
      "外に出ると気持ちいいよ！",
      "こんな日は冒険したくなるね！"
    ],
    work: [
      "仕事バリバリ頑張ってるよ！",
      "順調！超順調！",
      "楽しく働いてます！"
    ]
  },
  "内気": {
    greet: [
      "あ、あの...こんにちは...",
      "は、はじめまして...",
      "あ...お会いできて...嬉しいです..."
    ],
    talk: [
      "天気が...良いですね...",
      "空が...きれいです...",
      "お、温かいですね..."
    ],
    work: [
      "仕事は...頑張ってます...",
      "な、なんとか...やってます...",
      "ゆ、焦らずに...進めてます..."
    ]
  },
  "強気Ｆ": {
    greet: [
      "こんにちは！",
      "よっ！元気？",
      "待ってたわよ！"
    ],
    talk: [
      "最高の天気ね！",
      "こんな日は体が騒ぐわ！",
      "外で仕事したくなる天気ね！"
    ],
    work: [
      "仕事なら任せなさい！",
      "完璧にこなしてるわ！",
      "私に任せておきなさい！"
    ]
  },
  "蓮っ葉": {
    greet: [
      "やっほ！",
      "あっ！来たわね！",
      "待ってたのよ！"
    ],
    talk: [
      "いい天気だねー！",
      "超気持ちいい天気！",
      "外で遊びたくなっちゃう！"
    ],
    work: [
      "仕事？余裕よ！",
      "バリバリこなしてるわよ！",
      "任せとけって！"
    ]
  },
  "おっとり": {
    greet: [
      "あら、こんにちは。",
      "まあ、お会いできて嬉しいわ。",
      "いつもお世話になってますね。"
    ],
    talk: [
      "穏やかなお天気ですね。",
      "心が落ち着くお天気ですわ。",
      "のどかな陽気ですね。"
    ],
    work: [
      "お仕事は順調に進んでいますよ。",
      "ゆっくりと進めています。",
      "着実に前に進んでいますわ。"
    ]
  },
  "クールＦ": {
    greet: [
      "ご機嫌よう。",
      "やあ。",
      "お会いできて光栄ね。"
    ],
    talk: [
      "良い天気ね。",
      "快適な気候だわ。",
      "素晴らしい空ね。"
    ],
    work: [
      "仕事は順調よ。",
      "問題なく進んでいるわ。",
      "心配には及ばないわ。"
    ]
  },
  "ぶりっこ": {
    greet: [
      "あっ！こんにちはー♪",
      "わーい！会えた♪",
      "えへへ、こんにちはー♪"
    ],
    talk: [
      "今日のお天気さいこーです♪",
      "きらきらしてて素敵な天気♪",
      "お空が笑顔だよー♪"
    ],
    work: [
      "お仕事がんばってまーす♪",
      "順調だよー♪",
      "えへへ、頑張ってるの♪"
    ]
  },
  "中性的": {
    greet: [
      "こんにちは。",
      "やあ、こんにちは。",
      "会えて嬉しいよ。"
    ],
    talk: [
      "良い天気だね。",
      "気持ちのいい天気だね。",
      "空が綺麗だよ。"
    ],
    work: [
      "仕事は順調だよ。",
      "順調に進んでいるよ。",
      "問題なく進めているよ。"
    ]
  },
  "ギャル風": {
    greet: [
      "ハーイ！",
      "やっほー！元気ー？",
      "ウェーイ！"
    ],
    talk: [
      "マジいい天気！",
      "超サイコーな天気じゃん！",
      "外、ヤバいくらい気持ちいい！"
    ],
    work: [
      "仕事？超順調っしょ！",
      "バリバリこなしてるよ！",
      "完璧にこなしてまーす！"
    ]
  }
};

// 訪問者タイプごとの勧誘成功率係数
const RECRUITMENT_COEFFICIENTS = {
  "流民": 0.8,    // 最も勧誘しやすい
  "冒険者": 0.4,  // やや勧誘しにくい
  "巡礼者": 0.2,  // 比較的勧誘しやすい
  "学者": 0.2,    // 勧誘しにくい
  "観光客": 0.4,  // かなり勧誘しにくい
  "旅人": 0.4,    // 標準
  "行商人": 0.2   // 勧誘しにくい
};

/**
 * 会話モーダルを開く
 */
export function openConversationModal(character) {
  const overlay = document.getElementById("conversationOverlay");
  const modal = document.getElementById("conversationModal");
  const portrait = document.getElementById("conversationPortrait");
  const text = document.getElementById("conversationText");
  const actionButtons = document.getElementById("actionButtons");

  if (!overlay || !modal || !portrait || !text || !actionButtons) return;

  // 共通関数を使用して顔グラフィックのパスを取得
  const portraitPath = getPortraitPath(character);

  // 顔グラフィックを設定（エラーハンドリング付き）
  try {
    portrait.src = portraitPath;
    portrait.onerror = () => {
      console.error(`Portrait image not found: ${portraitPath}`);
      portrait.src = 'images/portraits/DEFAULT.png';
    };
  } catch (error) {
    console.error('Error loading portrait:', error);
    portrait.src = 'images/portraits/DEFAULT.png';
  }
  
  // キャラクターの状態を判定
  const isExhausted = character.hp <= 33 || character.mp <= 33;
  const isTired = (character.hp > 33 && character.hp <= 59) || (character.mp > 33 && character.mp <= 59);
  const isHealthy = character.hp > 59 && character.mp > 59;
  const isUnderRaid = theVillage.villageTraits.includes("襲撃中");
  const isVisitor = character.mindTraits && character.mindTraits.includes("訪問者");
  const hasFailedRecruitment = character.mindTraits && character.mindTraits.includes("勧誘失敗");

  // 口調タイプに応じた会話テキストを設定
  const speechPattern = SPEECH_PATTERNS[character.speechType] || 
                       SPEECH_PATTERNS[character.bodySex === "男" ? "普通Ｍ" : "普通Ｆ"];
  
  // 各カテゴリからランダムにセリフを選択
  const getRandomLine = (lines) => lines[Math.floor(Math.random() * lines.length)];

  // 状態に応じたセリフを生成
  let statusText = "";
  
  // 襲撃者の場合は専用のセリフを表示
  if (character.mindTraits && character.mindTraits.includes("襲撃者") && character.raiderDialogues) {
    const raiderLine = character.raiderDialogues[Math.floor(Math.random() * character.raiderDialogues.length)];
    statusText = `<p><strong></strong> ${raiderLine}</p>`;
  } else if (isUnderRaid) {
    statusText = `<p><strong></strong> ${getStatusLine(character, "raid")}</p>`;
  } else if (isExhausted) {
    statusText = `<p><strong></strong> ${getStatusLine(character, "exhausted")}</p>`;
  } else if (isTired) {
    statusText = `<p><strong></strong> ${getStatusLine(character, "tired")}</p>`;
  } else if (isHealthy) {
    statusText = `<p><strong></strong> ${getStatusLine(character, "healthy")}</p>`;
  }
  
  // 会話テキストを設定
  text.innerHTML = `
    ${statusText}
  `;

  // ボタンの表示制御
  actionButtons.innerHTML = "";
  
  if (isVisitor && !hasFailedRecruitment) {
    // 訪問者で、かつ勧誘失敗フラグがない場合は勧誘と誘惑ボタンを表示
    actionButtons.innerHTML = `
      <button id="recruitButton">勧誘する</button>
      <button id="seduceButton">誘惑する</button>
    `;
    actionButtons.style.display = "block";
    
    // 勧誘ボタンのイベントリスナーを設定
    document.getElementById("recruitButton").addEventListener("click", () => {
      openRecruitmentModal(character);
    });
    
    // 誘惑ボタンのイベントリスナーを設定
    document.getElementById("seduceButton").addEventListener("click", () => {
      openSeductionModal(character);
    });
  } else if (isUnderRaid && theVillage.villagers.includes(character)) {
    // 襲撃中の村人の場合は迎撃・罠作成ボタンを表示
    actionButtons.innerHTML = `
      <button id="assignDefender" class="${character.action === '迎撃' ? 'active-action' : ''}">迎撃任命</button>
      <button id="assignTrapMaker" class="${character.action === '罠作成' ? 'active-action' : ''}">罠作成任命</button>
    `;
    actionButtons.style.display = "block";
    
    document.getElementById("assignDefender").addEventListener("click", () => {
      changeCharacterAction(character, "迎撃");
    });
    
    document.getElementById("assignTrapMaker").addEventListener("click", () => {
      changeCharacterAction(character, "罠作成");
    });
  } else {
    actionButtons.style.display = "none";
  }

  overlay.style.display = "block";
  modal.style.display = "block";
}

/**
 * 会話モーダルを閉じる
 */
export function closeConversationModal() {
  const overlay = document.getElementById("conversationOverlay");
  const modal = document.getElementById("conversationModal");
  
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
}

/**
 * 状態に応じたセリフを返す
 */
function getStatusLine(character, status) {
  const speechType = character.speechType;
  const pattern = SPEECH_PATTERNS[speechType];
  
  if (!pattern.status) {
    pattern.status = {
      raid: {
        "普通Ｍ": ["危険な状況だね...気を付けないと。", "みんなで村を守らないと。"],
        "丁寧Ｍ": ["非常事態ですね。万全の備えを。", "村の安全が第一です。"],
        "強気Ｍ": ["来るなら来い！やってやる！", "襲撃者なんか怖くないぜ！"],
        "乱暴": ["ぶっ潰してやる！", "かかって来い！"],
        "お調子者": ["やべぇ状況っすね～", "なんとかなるっしょ！","いいとこ見せてやるぜ！"],
        "陰気": ["こ、怖いです...", "ど、どうすれば..."],
        "クールＭ": ["状況は把握している。", "冷静に対処するべきだ。"],
        
        "普通Ｆ": ["怖いですけど...頑張ります。", "みんなで協力しましょう。"],
        "丁寧Ｆ": ["大変な事態になってしまいましたね。", "皆様、お気をつけください。"],
        "お嬢様": ["このような事態になるなんて...。", "村のために私にできることを。"],
        "快活": ["やってやろうじゃない！", "みんなで頑張ろう！"],
        "内気": ["こ、怖いです...", "ど、どうしよう..."],
        "強気Ｆ": ["来るなら来なさい！", "私たちが守ってみせるわ！"],
        "蓮っ葉": ["やってやろうじゃないの！", "かかってきなさいよ！"],
        "おっとり": ["心配ですね...", "どうか無事でありますように..."],
        "クールＦ": ["冷静に対処しましょう。", "慌てる必要はないわ。"],
        "ぶりっこ": ["こわいよ～", "みんな～助けて～"],
        "中性的": ["状況は深刻だね。", "できることをしよう。"],
        "ギャル風": ["マジやばくない？", "なんとかなるっしょ！"]
      },
      exhausted: {
        "普通Ｍ": ["もう限界かも...", "休みたいな..."],
        "丁寧Ｍ": ["申し訳ありません...少し休ませていただけますか...", "体調が優れません..."],
        "強気Ｍ": ["くっ...まだやれる...", "これしきの疲れ...何でもない..."],
        "乱暴": ["くそっ...体が言うこと聞きやがらね...", "まだ...まだ動ける..."],
        "お調子者": ["マジっす...もうダメっす...", "ちょっと...休ませてください..."],
        "陰気": ["もう...動けません...", "死にそうです..."],
        "クールＭ": ["体調が...最悪だ...", "少し休息が必要かもしれない..."],

        "普通Ｆ": ["もう...限界です...", "休ませてください..."],
        "丁寧Ｆ": ["大変申し訳ございません...体調が...","少し休ませていただけますでしょうか..."],
        "お嬢様": ["申し訳ありませんが...もう動けませんわ...", "少し休ませていただきたく..."],
        "快活": ["ごめん...もう無理かも...", "ちょっと休ませて...","さすがにへとへと...休みたい気分だよ。"
        ],
        "内気": ["す、すみません...もう...", "動けなく...なってしまいました..."],
        "強気Ｆ": ["くっ...まだ大丈夫よ...", "この程度で...倒れるもんか..."],
        "蓮っ葉": ["もう...ダメ...", "休ませて...よ..."],
        "おっとり": ["申し訳ありません...少し...", "体が動きませんわ..."],
        "クールＦ": ["休息が...必要ね...", "体調が思わしくないわ..."],
        "ぶりっこ": ["もう...むりぃ...", "休ませて...ほしいの..."],
        "中性的": ["もう...限界だよ...", "休ませて...もらえるかな..."],
        "ギャル風": ["マジ...無理...", "ちょっと...休ませて..."]
      },
      tired: {
        "普通Ｍ": ["ちょっと疲れてるかな。", "少し休憩したいな。"],
        "丁寧Ｍ": ["少々疲れが出ております。", "休息を取らせていただけますでしょうか。"],
        "強気Ｍ": ["まだまだいける！", "この程度の疲れ、何でもないぜ！"],
        "乱暴": ["ちっ、ちょっと疲れただけだ。", "まだ余裕があるぜ。"],
        "お調子者": ["ちょっと疲れちゃいましたー", "休憩欲しいっすね～"],
        "陰気": ["少し...疲れてきました...", "休みたいです..."],
        "クールＭ": ["多少の疲労は感じるな。", "休息も必要かもしれない。"],

        "普通Ｆ": ["少し疲れてきました。", "休憩が欲しいですね。"],
        "丁寧Ｆ": ["少々疲れが出てまいりました。", "休憩を取らせていただけますか？"],
        "お嬢様": ["少し疲れが出てきましたわ。", "疲れを癒すために、温かいお茶をいただきたい気分ですわ。"],
        "快活": ["ちょっと疲れちゃった！", "ちょっとだけ疲れたかも。でもまだまだいける！"],
        "内気": ["す、少し疲れて...", "休憩...したいです..."],
        "強気Ｆ": ["この程度の疲れ、大したことないわ！", "まだまだ頑張れるわよ！"],
        "蓮っ葉": ["あー、なんかだるい…もうやめて帰りたいわ", "ちょっと休んでいい？続きはあとでやるからさ"],
        "おっとり": ["少し疲れが出てきましたわ。", "休憩を取らせていただけますか？"],
        "クールＦ": ["多少の疲労を感じるわ。", "休息も検討すべきね。"],
        "ぶりっこ": ["ちょっと疲れちゃった～", "休憩したいな～♪","うぅ…ちょっと疲れちゃったかも…"],
        "中性的": ["少し疲れてきたかな。", "休憩が必要かも。"],
        "ギャル風": ["ちょー疲れた！", "休憩欲しいんだけど！"]
      },
      healthy: {
        "普通Ｍ": ["調子はバッチリだよ！", "元気いっぱいだ！", 
                 "今日は良い天気だね。", "村の様子はどうかな？", 
                 "最近の収穫は順調だよ。"],
        "丁寧Ｍ": ["絶好調でございます。", "最高の気分です。", 
                 "本日は素晴らしい天気ですね。", "村の発展が楽しみでございます。", 
                 "皆様のおかげで充実した日々を過ごしております。"],
        "強気Ｍ": ["完璧な状態だ！", "どんな仕事でも任せろ！","こんな日は体が騒ぐぜ！", 
                 "この天気、最高じゃないか！", "村の発展は俺に任せとけ！", 
                 "今日も一日バリバリ働いてやるぜ！"],
        "乱暴": ["超元気だぜ！", "バリバリやってやるよ！", 
               "こんな天気は最高だぜ！", "村の連中も元気そうだな！", 
               "今日も暴れてやるぜ！", "こんな日は酒でも飲みてぇな！", 
               "仕事？そんなもんクソくらえだ！", "誰か俺と勝負しろよ！"],
        "お調子者": ["絶好調っす！", "なんでもこなせますよ！", "どこかに可愛い子いないかな～？", 
                   "今日の天気サイコーっすね～！", "村の噂って面白いっすよね～", 
                   "仕事より遊びに行きたい気分っすよ～"],
        "陰気": ["調子は...悪くないです。", "頑張れそうです...", 
               "天気は...悪くないですね...", "村は...平和で良いですね...", 
               "静かな日々が...一番です..."],
        "クールＭ": ["最適な状態だ。", "問題なく動ける。", 
                  "天候も良好だな。", "村の状況は安定している。", 
                  "効率的に仕事を進めよう。"],

        "普通Ｆ": ["元気いっぱいです！", "調子はバッチリです！", 
                 "今日はとても良い天気ですね。", "村の皆さんも元気そうで何よりです。", 
                 "こんな日は外で仕事したくなります。"],
        "丁寧Ｆ": ["とても調子が良うございます。", "どのようなお仕事でも承ります。", 
                 "本日の天気は申し分ございませんね。", "村の皆様はお元気でいらっしゃいますか？", 
                 "このような平和な日々に感謝しております。"],
        "お嬢様": ["絶好調ですわ！", "どのようなことでもこなせそうですわ。", 
                 "まあ、素晴らしいお天気ですわね。", "村の皆様とお話できて光栄ですわ。", 
                 "このような穏やかな日々が続くと良いですわね。"],
        "快活": ["超元気！", "なんでもできちゃう気分！", 
               "今日の天気最高だね！", "村のみんなも元気いっぱい！", 
               "こんな日は冒険したくなるよね！"],
        "内気": ["調子は...いいです。", "が、頑張れます...","えっと…作業は順調です、はい…", 
               "お、お天気が...良くて嬉しいです...", "み、皆さんと一緒に...頑張りたいです...", 
               "静かな村が...好きです..."],
        "強気Ｆ": ["完璧よ！", "どんな仕事でも任せなさい！", 
                "この天気、最高じゃない！", "村の発展は私に任せて！", 
                "今日も一日思いっきり働くわよ！"],
        "蓮っ葉": ["超元気だよ！", "バリバリこなしちゃうわよ！", 
                 "こんな天気は最高よね！", "村の噂、知りたくない？", 
                 "仕事より遊びに行きたいわ～", "あーあ、面白いことないかなぁ", 
                 "マジでだりぃ～", "ちょっとアンタ、ヒマしてない？"],
        "おっとり": ["調子は良好ですわ。", "しっかり働けそうです。", 
                   "穏やかな天気で心が和みますね。", "村の皆様はお元気でいらっしゃいますか？", 
                   "このような平和な日々が続くと良いですね。"],
        "クールＦ": ["最高の状態よ。", "どんな仕事でもこなせるわ。", 
                  "天候は申し分ないわね。", "村の状況は把握しているわ。", 
                  "効率的に進めましょう。"],
        "ぶりっこ": ["元気いっぱいだよ～♪", "なんでもできちゃう気分～♪", 
                   "お天気さいこー♪", "村のみんな大好き～♪", 
                   "お仕事頑張っちゃうよ～♪"],
        "中性的": ["調子はいいよ。", "しっかり働けそうだ。", 
                 "良い天気だね。", "村の様子も平和で何より。", 
                 "こんな日は充実した気分になるよ。"],
        "ギャル風": ["超元気！", "なんでもこなせちゃうよ！", 
                   "マジ最高の天気じゃん！", "村のみんなもイケてるよね！", 
                   "今日も一日楽しんじゃおう！"]
      }
    };
  }

  // 訪問者の場合は専用のセリフを返す
  if (character.mindTraits && character.mindTraits.includes("訪問者")) {
    return getVisitorLine(character);
  }

  // 健康状態で勤勉度が低い場合の特別な会話
  if (status === "healthy" && character.ind <= 10) {
    const lazyLines = getLazyLines(character);
    if (lazyLines.length > 0) {
      // 通常の会話と勤勉度が低い場合の会話を組み合わせる
      const statusLines = pattern.status[status][speechType] || 
                         pattern.status[status][character.bodySex === "男" ? "普通Ｍ" : "普通Ｆ"];
      
      // 季節の会話も取得
      let seasonalLines = [];
      const seasonTraits = ["春", "夏", "秋", "冬"];
      let currentSeason = "";
      
      for (const trait of seasonTraits) {
        if (theVillage.villageTraits.includes(trait)) {
          currentSeason = trait;
          break;
        }
      }
      
      if (currentSeason) {
        seasonalLines = getSeasonalLines(character, currentSeason);
      }
      
      // 全ての会話を組み合わせる
      const allLines = [...statusLines, ...lazyLines];
      if (seasonalLines.length > 0) {
        allLines.push(...seasonalLines);
      }
      
      return allLines[Math.floor(Math.random() * allLines.length)];
    }
  }
  
  // 季節に応じた会話を取得
  if (status === "healthy") {
    // 村の特性から現在の季節を取得
    const seasonTraits = ["春", "夏", "秋", "冬"];
    let currentSeason = "";
    
    for (const trait of seasonTraits) {
      if (theVillage.villageTraits.includes(trait)) {
        currentSeason = trait;
        break;
      }
    }
    
    // 季節に応じた会話を追加
    if (currentSeason) {
      const seasonLines = getSeasonalLines(character, currentSeason);
      if (seasonLines.length > 0) {
        // 通常の会話と季節の会話を組み合わせる
        const statusLines = pattern.status[status][speechType] || 
                           pattern.status[status][character.bodySex === "男" ? "普通Ｍ" : "普通Ｆ"];
        
        // 季節の会話を追加
        return [...statusLines, ...seasonLines][Math.floor(Math.random() * (statusLines.length + seasonLines.length))];
      }
    }
  }

  const statusLines = pattern.status[status][speechType] || 
                     pattern.status[status][character.bodySex === "男" ? "普通Ｍ" : "普通Ｆ"];
  return statusLines[Math.floor(Math.random() * statusLines.length)];
}

/**
 * 訪問者タイプごとの専用セリフを返す
 */
function getVisitorLine(character) {
  // 訪問者の名前から訪問者タイプを抽出
  const visitorTypes = ["流民", "冒険者", "巡礼者", "学者", "観光客", "旅人", "行商人"];
  let visitorType = "";
  
  for (const type of visitorTypes) {
    if (character.name.includes(type)) {
      visitorType = type;
      break;
    }
  }
  
  // 訪問者タイプごとのセリフ
  const VISITOR_LINES = {
    "流民": [
      "どうか助けてください…私たちは故郷を失いました。",
      "この村に住まわせていただけないでしょうか？",
      "食べ物と寝る場所があれば、何でも働きます。",
      "長い旅でくたびれました…少し休ませてください。",
      "他の村では追い出されてしまって…ここなら受け入れてくれますか？"
    ],
    "冒険者": [
      "この辺りで何か変わったことはありませんか？",
      "冒険の途中で立ち寄りました。情報を交換しませんか？",
      "危険な魔物の噂はありませんか？報酬次第では退治できますよ。",
      "旅の途中で補給が必要でして。物資を分けてもらえませんか？",
      "この村は平和そうですね。しばらく休ませてもらえますか？"
    ],
    "巡礼者": [
      "神の加護がありますように。",
      "聖地への巡礼の途中です。どうか祝福を。",
      "祈りを捧げに来ました。この村の平和を祈ります。",
      "神聖な場所を探しています。この村に何かありませんか？",
      "心の安らぎを求めて旅をしています。"
    ],
    "学者": [
      "この地域の歴史について調査しています。何か知っていますか？",
      "珍しい植物や動物を見かけませんでしたか？",
      "古い遺跡や伝承について教えていただけませんか？",
      "研究のためにデータを集めています。協力していただけますか？",
      "この村の成り立ちについて、詳しく知りたいのですが。"
    ],
    "観光客": [
      "この村の名物は何ですか？ぜひ体験したいです！",
      "素敵な村ですね！おすすめの場所はありますか？",
      "記念に何か買って帰りたいのですが、お店はありますか？",
      "この景色は最高ですね！しばらく滞在したいです。",
      "地元の料理を食べてみたいです。おすすめはありますか？"
    ],
    "旅人": [
      "旅の途中で立ち寄りました。良い村ですね。",
      "道中の情報を交換しませんか？",
      "一晩泊めていただけないでしょうか？",
      "長旅で疲れました。少し休ませてください。",
      "各地を巡っていますが、この村は特別な雰囲気がありますね。"
    ],
    "行商人": [
      "良い品を揃えていますよ！見ていきませんか？",
      "珍しい商品があります。興味ありませんか？",
      "他の村では手に入らない品物ですよ。特別価格で。",
      "取引しませんか？あなたの村の特産品と交換できますよ。",
      "商売の話だけでなく、他の村の情報もお教えできますよ。"
    ]
  };
  
  // 訪問者タイプに合わせたセリフを返す
  if (visitorType && VISITOR_LINES[visitorType]) {
    return VISITOR_LINES[visitorType][Math.floor(Math.random() * VISITOR_LINES[visitorType].length)];
  }
  
  // タイプが不明な場合は汎用的なセリフを返す
  const genericLines = [
    "こんにちは、素敵な村ですね。",
    "少しの間、滞在させていただきます。",
    "この村について、もっと知りたいです。",
    "旅の途中で立ち寄りました。",
    "村の皆さんは親切ですね。"
  ];
  
  return genericLines[Math.floor(Math.random() * genericLines.length)];
}

/**
 * 勤勉度が低い場合の会話を返す
 */
function getLazyLines(character) {
  const speechType = character.speechType;
  
  // 勤勉度が低い場合の会話パターン
  const LAZY_LINES = {
    "普通Ｍ": ["仕事なんてしたくないなぁ…", "今日はのんびりしたいな。", "休みたい気分だ。"],
    "丁寧Ｍ": ["今日は少し休息を取りたい気分です。", "仕事は…少し後回しにしたいですね。", "休息も大切かと思います。"],
    "強気Ｍ": ["仕事？今日はパスだ！", "働くより遊びたい気分だぜ！", "休みてぇなぁ！"],
    "乱暴": ["仕事なんてクソくらえだ！", "働くのはごめんだぜ！", "今日は何もしたくねぇ！"],
    "お調子者": ["仕事より遊びに行きたいっすよ～", "今日はサボりたい気分っすね～", "働くの疲れちゃいましたよ～"],
    "陰気": ["仕事は...したくない...です...", "休みたい...気分です...", "何もしたくない...です..."],
    "クールＭ": ["今日は仕事より休息を優先したい。", "労働は最小限に留めたい。", "効率よりも休息を選ぶ日もある。"],
    
    "普通Ｆ": ["仕事なんてしたくないなぁ…", "今日はのんびりしたいな。", "休みたい気分です。"],
    "丁寧Ｆ": ["今日は少し休息を取りたい気分です。", "仕事は…少し後回しにしたいですね。", "休息も大切かと思います。"],
    "お嬢様": ["労働など今日はご遠慮したいですわ。", "休息の時間も必要ですわね。", "今日は静かに過ごしたい気分ですわ。"],
    "快活": ["仕事より遊びたい！", "今日は何もしたくないな～", "休みたい気分だよ～"],
    "内気": ["仕事は...したくない...です...", "休みたい...気分です...", "何もしたくない...です..."],
    "強気Ｆ": ["仕事？今日はパスよ！", "働くより遊びたい気分！", "休みたいわ！"],
    "蓮っ葉": ["仕事なんてサボりたいわ～", "働くの面倒くさ～い", "今日は何もしたくないの～"],
    "おっとり": ["今日は少し休息を取りたい気分です。", "仕事は…少し後回しにしたいですね。", "休息も大切かと思います。"],
    "クールＦ": ["今日は仕事より休息を優先したいわ。", "労働は最小限に留めたいわね。", "効率よりも休息を選ぶ日もあるわ。"],
    "ぶりっこ": ["仕事なんてしたくないよ～", "今日はのんびりしたいな～♪", "休みたい気分だよ～"],
    "中性的": ["仕事なんてしたくないな…", "今日はのんびりしたいな。", "休みたい気分だ。"],
    "ギャル風": ["仕事とかマジ無理～", "今日はサボりたい気分～", "働くの疲れたわ～"]
  };
  
  // 該当する口調タイプの会話を返す
  if (LAZY_LINES[speechType]) {
    return LAZY_LINES[speechType];
  }
  
  // 該当するものがない場合は性別に応じたデフォルトを返す
  const defaultType = character.bodySex === "男" ? "普通Ｍ" : "普通Ｆ";
  return LAZY_LINES[defaultType] || [];
}

/**
 * 季節に応じた会話を返す
 */
function getSeasonalLines(character, season) {
  const speechType = character.speechType;
  
  // 季節ごとの会話パターン
  const SEASONAL_LINES = {
    "春": {
      "普通Ｍ": ["春の陽気は心地いいね。", "花が咲き始めて綺麗だ。", "春の訪れを感じるね。"],
      "丁寧Ｍ": ["春の息吹を感じますね。", "花々が美しく咲き誇る季節ですね。", "春の陽気に心が和みます。"],
      "強気Ｍ": ["春だ！活動するにはピッタリの季節だぜ！", "花見でもするか？いい酒が飲めそうだ！", "春の陽気で体が騒ぐぜ！"],
      "乱暴": ["春だからってなんだってんだ！", "花なんかより酒だろ！", "春は腹が減るぜ、飯くれ！"],
      "お調子者": ["春ですねー！恋の季節っすよ！", "花見に行きませんか？いい酒あるっすよ～", "春は出会いの季節っすね～"],
      "陰気": ["春は...花粉が...つらいです...", "春は...なんだか...眠くなります...", "春は...なんとなく...憂鬱です..."],
      "クールＭ": ["春の訪れだな。", "花が咲き始めたようだ。", "春の陽気は悪くない。"],
      
      "普通Ｆ": ["春の陽気は心地いいですね。", "花が咲き始めて綺麗です。", "春の訪れを感じます。"],
      "丁寧Ｆ": ["春の息吹を感じますね。", "花々が美しく咲き誇る季節でございます。", "春の陽気に心が和みます。"],
      "お嬢様": ["春の訪れは心躍りますわ。", "花々が美しく咲き誇る様は見事ですわね。", "春の陽気は心身ともに癒されますわ。"],
      "快活": ["春だよ！お花見しようよ！", "春の陽気って最高だよね！", "春は新しい出会いの季節だね！"],
      "内気": ["春は...花が...綺麗ですね...", "春の...陽気が...心地いいです...", "春は...なんだか...うれしいです..."],
      "強気Ｆ": ["春だわ！活動するにはピッタリの季節ね！", "花見でもする？いい酒が飲めそうだわ！", "春の陽気で体が騒ぐわ！"],
      "蓮っ葉": ["春ねぇ～恋でもしたくなるわよね～", "花見に行かない？酒持ってくからさ～", "春は出会いの季節よね～誰かいい男いないかな～"],
      "おっとり": ["春の訪れは心が和みますわ。", "花々が美しく咲き誇る季節ですね。", "春の陽気は心身ともに癒されますわ。"],
      "クールＦ": ["春の訪れね。", "花が咲き始めたようね。", "春の陽気は悪くないわ。"],
      "ぶりっこ": ["春だよ～お花見しようよ～♪", "春の陽気って最高だよね～♪", "春は恋の季節だよね～♪"],
      "中性的": ["春の陽気は心地いいね。", "花が咲き始めて綺麗だね。", "春の訪れを感じるよ。"],
      "ギャル風": ["春マジ最高！お花見行こうよ！", "春って恋の季節じゃん！誰かいい人いない？", "春の陽気マジ気持ちいい～！"]
    },
    "夏": {
      "普通Ｍ": ["夏は暑いけど活気があるね。", "川で泳ぎたくなる季節だ。", "夏祭りが楽しみだな。"],
      "丁寧Ｍ": ["夏の暑さも悪くないものですね。", "涼しい場所で過ごしたいものです。", "夏祭りが待ち遠しいですね。"],
      "強気Ｍ": ["夏だぜ！熱い季節だ！", "川で泳ぐか？いい気分だぜ！", "夏祭りで盛り上がろうぜ！"],
      "乱暴": ["くそ暑いぜ！", "汗だくだ、風呂入れねぇのか！", "夏祭り？酒があるなら行くぜ！"],
      "お調子者": ["夏っすね～海行きませんか？", "暑いっすね～冷たいもの飲みましょうよ～", "夏祭りデートしませんか？"],
      "陰気": ["夏は...暑くて...つらいです...", "汗が...出て...不快です...", "夏祭りは...人が多くて...苦手です..."],
      "クールＭ": ["夏の暑さだな。", "涼しい場所を確保しておこう。", "夏祭りか。悪くない。"],
      
      "普通Ｆ": ["夏は暑いけど活気がありますね。", "川で涼みたくなる季節です。", "夏祭りが楽しみです。"],
      "丁寧Ｆ": ["夏の暑さも悪くないものですね。", "涼しい場所で過ごしたいものです。", "夏祭りが待ち遠しいですね。"],
      "お嬢様": ["夏の暑さも風情がありますわね。", "涼しい場所でお茶を楽しみたいですわ。", "夏祭りは華やかで素敵ですわね。"],
      "快活": ["夏だよ！海に行こうよ！", "暑いけど夏は楽しいよね！", "夏祭り楽しみだね！"],
      "内気": ["夏は...暑いですが...好きです...", "川の...せせらぎが...心地いいです...", "夏祭りは...少し...楽しみです..."],
      "強気Ｆ": ["夏よ！熱い季節ね！", "川で泳ぐ？いい気分よ！", "夏祭りで盛り上がりましょう！"],
      "蓮っ葉": ["夏ねぇ～海行かない？", "暑いわ～冷たいもの飲もうよ～", "夏祭り？浴衣着てくからデートしない？"],
      "おっとり": ["夏の暑さも風情がありますわね。", "涼しい場所で過ごしたいものです。", "夏祭りは華やかで素敵ですね。"],
      "クールＦ": ["夏の暑さね。", "涼しい場所を確保しておきましょう。", "夏祭りか。悪くないわ。"],
      "ぶりっこ": ["夏だよ～海行きたいな～♪", "暑いけど夏は楽しいよね～♪", "夏祭り一緒に行こうよ～♪"],
      "中性的": ["夏の暑さも悪くないね。", "涼しい場所で過ごしたいね。", "夏祭りが待ち遠しいね。"],
      "ギャル風": ["夏マジ最高！海行こうよ！", "暑いけど夏って楽しいじゃん！", "夏祭りでテンション上げてこ～！"]
    },
    "秋": {
      "普通Ｍ": ["秋の実りは豊かだね。", "紅葉が綺麗な季節だ。", "秋の夜長は読書に最適だ。"],
      "丁寧Ｍ": ["秋の実りに感謝ですね。", "紅葉の美しさに心奪われます。", "秋の夜長は読書に最適ですね。"],
      "強気Ｍ": ["秋だ！収穫の季節だぜ！", "紅葉狩りでもするか？", "秋の夜長は酒が進むぜ！"],
      "乱暴": ["秋か？腹が減るな！", "紅葉？そんなもんより酒だ！", "夜が長くなったな、退屈だぜ！"],
      "お調子者": ["秋っすね～収穫祭楽しみっす！", "紅葉狩りデートしませんか？", "秋の夜長は何して過ごします？"],
      "陰気": ["秋は...寂しい...季節です...", "紅葉は...綺麗ですが...物悲しいです...", "夜が...長くなって...眠れません..."],
      "クールＭ": ["秋の実りだな。", "紅葉が始まったようだ。", "秋の夜長は悪くない。"],
      
      "普通Ｆ": ["秋の実りは豊かですね。", "紅葉が綺麗な季節です。", "秋の夜長は読書に最適です。"],
      "丁寧Ｆ": ["秋の実りに感謝ですね。", "紅葉の美しさに心奪われます。", "秋の夜長は読書に最適ですね。"],
      "お嬢様": ["秋の実りは恵みそのものですわ。", "紅葉の美しさは格別ですわね。", "秋の夜長は読書や音楽に最適ですわ。"],
      "快活": ["秋だよ！収穫祭楽しみだね！", "紅葉狩りに行こうよ！", "秋の夜長は何して過ごす？"],
      "内気": ["秋は...実りの...季節ですね...", "紅葉が...綺麗で...うれしいです...", "秋の夜長は...本を...読みます..."],
      "強気Ｆ": ["秋よ！収穫の季節ね！", "紅葉狩りでもする？", "秋の夜長は酒が進むわ！"],
      "蓮っ葉": ["秋ねぇ～収穫祭で踊りたいわ～", "紅葉？デートに最適じゃない？", "夜が長くなったわね～何して過ごす？"],
      "おっとり": ["秋の実りは恵みそのものですね。", "紅葉の美しさは格別ですね。", "秋の夜長は読書や音楽に最適ですわ。"],
      "クールＦ": ["秋の実りね。", "紅葉が始まったようね。", "秋の夜長は悪くないわ。"],
      "ぶりっこ": ["秋だよ～収穫祭楽しみだな～♪", "紅葉狩りに行きたいな～♪", "秋の夜長は何して過ごそうかな～♪"],
      "中性的": ["秋の実りは豊かだね。", "紅葉が綺麗な季節だね。", "秋の夜長は読書に最適だね。"],
      "ギャル風": ["秋マジいいじゃん！収穫祭行こうよ！", "紅葉狩りとかインスタ映えするよね！", "夜長だし何かイベントないかな～？"]
    },
    "冬": {
      "普通Ｍ": ["冬は寒いけど静かで良いね。", "雪景色は美しいものだ。", "暖かい部屋で過ごしたいな。"],
      "丁寧Ｍ": ["冬の厳しさも風情がありますね。", "雪景色は心が洗われる思いです。", "暖かい場所で過ごしたいものです。"],
      "強気Ｍ": ["冬だぜ！寒さに負けるなよ！", "雪合戦でもするか？", "暖炉の前で酒が進むぜ！"],
      "乱暴": ["くそ寒いぜ！", "雪？邪魔なだけだ！", "暖かい酒を持ってこい！"],
      "お調子者": ["冬っすね～雪合戦しませんか？", "寒いっすね～暖かいもの飲みましょうよ～", "冬は恋人と過ごすのが一番っすよ～"],
      "陰気": ["冬は...寒くて...つらいです...", "雪は...美しいですが...寒いです...", "暖かい...場所から...出たくありません..."],
      "クールＭ": ["冬の寒さだな。", "雪景色は悪くない。", "暖かい場所を確保しておこう。"],
      
      "普通Ｆ": ["冬は寒いけど静かで良いですね。", "雪景色は美しいものです。", "暖かい部屋で過ごしたいです。"],
      "丁寧Ｆ": ["冬の厳しさも風情がありますね。", "雪景色は心が洗われる思いです。", "暖かい場所で過ごしたいものです。"],
      "お嬢様": ["冬の厳しさも風情がありますわね。", "雪景色は神秘的で美しいですわ。", "暖炉の前でお茶を楽しみたいですわ。"],
      "快活": ["冬だよ！雪合戦しようよ！", "寒いけど冬は楽しいよね！", "暖かい飲み物が美味しい季節だね！"],
      "内気": ["冬は...寒いですが...好きです...", "雪が...綺麗で...うれしいです...", "暖かい...部屋で...本を読みます..."],
      "強気Ｆ": ["冬よ！寒さに負けないわ！", "雪合戦でもする？", "暖炉の前で酒が進むわ！"],
      "蓮っ葉": ["冬ねぇ～寒いから誰か暖めてよ～", "雪？綺麗だけど寒いのはイヤ～", "暖かいところで飲もうよ～"],
      "おっとり": ["冬の厳しさも風情がありますわね。", "雪景色は神秘的で美しいですね。", "暖かい場所で過ごしたいものです。"],
      "クールＦ": ["冬の寒さね。", "雪景色は悪くないわ。", "暖かい場所を確保しておきましょう。"],
      "ぶりっこ": ["冬だよ～雪合戦したいな～♪", "寒いけど冬は楽しいよね～♪", "暖かい飲み物が美味しい季節だよね～♪"],
      "中性的": ["冬の寒さも悪くないね。", "雪景色は美しいものだね。", "暖かい部屋で過ごしたいね。"],
      "ギャル風": ["冬マジ寒い！でも雪合戦楽しいじゃん！", "雪景色インスタ映えするよね～", "暖かいカフェでまったりしたい～！"]
    }
  };
  
  // 該当する季節と口調タイプの会話を返す
  if (SEASONAL_LINES[season] && SEASONAL_LINES[season][speechType]) {
    return SEASONAL_LINES[season][speechType];
  }
  
  // 該当するものがない場合は性別に応じたデフォルトを返す
  const defaultType = character.bodySex === "男" ? "普通Ｍ" : "普通Ｆ";
  return SEASONAL_LINES[season][defaultType] || [];
} 

/**
 * キャラクターの行動を変更する
 */
function changeCharacterAction(character, newAction) {
  if (character.actionTable.includes(newAction)) {
    character.action = newAction;
    
    // テキスト部分を更新して行動変更を反映
    const text = document.getElementById("conversationText");
    if (text) {
      const currentText = text.innerHTML;
      const updatedText = currentText.replace(
        `<strong>現在の行動:</strong> ${character.action !== newAction ? character.action : newAction}`,
        `<strong>現在の行動:</strong> ${newAction}`
      );
      text.innerHTML = updatedText;
    }
    
    // ボタンのアクティブ状態を更新
    const defenderButton = document.getElementById("assignDefender");
    const trapMakerButton = document.getElementById("assignTrapMaker");
    
    if (defenderButton && trapMakerButton) {
      defenderButton.className = newAction === "迎撃" ? "active-action" : "";
      trapMakerButton.className = newAction === "罠作成" ? "active-action" : "";
    }
    
    // 村のUIを更新
    updateUI(theVillage);
  } else {
    console.error(`Action ${newAction} is not available for this character`);
  }
}

// 勧誘モーダルを開く
function openRecruitmentModal(visitor) {
  const overlay = document.createElement("div");
  overlay.id = "recruitmentOverlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:3000;";
  
  const modal = document.createElement("div");
  modal.id = "recruitmentModal";
  modal.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;z-index:3001;min-width:300px;border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,0.1);";
  
  // 訪問者タイプを取得
  const visitorType = getVisitorType(visitor);
  const coefficient = RECRUITMENT_COEFFICIENTS[visitorType] || 1.0;
  
  modal.innerHTML = `
    <h3 style="margin-top:0;">勧誘する村人を選択</h3>
    <p style="margin-bottom:15px;">${visitor.name}を勧誘します。</p>
    <select id="recruiterSelect" style="width:100%;padding:5px;margin-bottom:15px;">
      <option value="">勧誘する村人を選択してください</option>
      ${theVillage.villagers.map(v => `
        <option value="${v.name}">${v.name} (魅力:${Math.floor(v.chr)} 知力:${Math.floor(v.int)})</option>
      `).join('')}
    </select>
    <div style="display:flex;justify-content:flex-end;gap:10px;">
      <button id="cancelRecruitment" style="padding:5px 15px;">キャンセル</button>
      <button id="doRecruitment" style="padding:5px 15px;">勧誘する</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
  // イベントリスナーを設定
  document.getElementById("doRecruitment").addEventListener("click", () => {
    const recruiterName = document.getElementById("recruiterSelect").value;
    if (!recruiterName) {
      alert("勧誘する村人を選択してください。");
      return;
    }
    
    // 人口上限チェックを追加
    if (theVillage.villagers.length >= theVillage.popLimit) {
      alert("村の人口上限に達しています。新たな村人を受け入れるには、家屋を建設して人口上限を増やしてください。");
      theVillage.log(`勧誘失敗: 人口上限(${theVillage.popLimit}人)に達しています`);
      return;
    }
    
    const recruiter = theVillage.villagers.find(v => v.name === recruiterName);
    if (!recruiter) return;
    
    // 勧誘成功率を計算
    const successRate = Math.min(100, Math.max(0, 
      coefficient * (recruiter.chr / 20) * (recruiter.int / 20) * 100
    ));
    
    // 勧誘判定
    if (Math.random() * 100 < successRate) {
      // 成功
      visitor.mindTraits = visitor.mindTraits.filter(t => t !== "訪問者");
      visitor.job = "なし";
      visitor.action = "休養";
      visitor.jobTable = ["なし", "休養"];
      visitor.actionTable = ["休養"];
      
      // 名前から「〜の」を削除
      const visitorType = getVisitorType(visitor);
      if (visitor.name.includes(`${visitorType}の`)) {
        visitor.name = visitor.name.replace(`${visitorType}の`, "");
      }
      
      // 訪問者リストから削除し、村人リストに追加
      theVillage.visitors = theVillage.visitors.filter(v => v.name !== visitor.name);
      theVillage.villagers.push(visitor);
      
      // 仕事テーブルを更新
      refreshJobTable(visitor);
      
      theVillage.log(`${recruiter.name}の勧誘により、${visitor.name}が村人になりました。(成功率: ${Math.floor(successRate)}%)`);
      alert(`勧誘成功！${visitor.name}が村人になりました。`);
    } else {
      // 失敗
      visitor.mindTraits.push("勧誘失敗");
      theVillage.log(`${recruiter.name}の勧誘は失敗しました。(成功率: ${Math.floor(successRate)}%)`);
      alert("勧誘に失敗しました。");
    }
    
    closeRecruitmentModal();
    closeConversationModal();
    updateUI(theVillage);
  });
  
  // キャンセルボタンのイベントリスナーを設定
  const cancelButton = document.getElementById("cancelRecruitment");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      closeRecruitmentModal();
    });
  }
  
  // オーバーレイクリックでもモーダルを閉じる
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeRecruitmentModal();
    }
  });
}

// 勧誘モーダルを閉じる
function closeRecruitmentModal() {
  const overlay = document.getElementById("recruitmentOverlay");
  const modal = document.getElementById("recruitmentModal");
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

// 訪問者タイプを取得する関数
function getVisitorType(visitor) {
  const visitorTypes = ["流民", "冒険者", "巡礼者", "学者", "観光客", "旅人", "行商人"];
  for (const type of visitorTypes) {
    if (visitor.name.includes(type)) {
      return type;
    }
  }
  return "旅人"; // デフォルト
}

// 誘惑モーダルを開く
function openSeductionModal(visitor) {
  const overlay = document.createElement("div");
  overlay.id = "seductionOverlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:3000;";
  
  const modal = document.createElement("div");
  modal.id = "seductionModal";
  modal.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;z-index:3001;min-width:300px;border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,0.1);";
  
  // 訪問者タイプを取得
  const visitorType = getVisitorType(visitor);
  const coefficient = RECRUITMENT_COEFFICIENTS[visitorType] || 1.0;
  
  modal.innerHTML = `
    <h3 style="margin-top:0;">誘惑する村人を選択</h3>
    <p style="margin-bottom:15px;">${visitor.name}を誘惑します。</p>
    <select id="seducerSelect" style="width:100%;padding:5px;margin-bottom:15px;">
      <option value="">誘惑する村人を選択してください</option>
      ${theVillage.villagers.map(v => `
        <option value="${v.name}">${v.name} (魅力:${Math.floor(v.chr)} 好色:${Math.floor(v.sexdr)})</option>
      `).join('')}
    </select>
    <div style="display:flex;justify-content:flex-end;gap:10px;">
      <button id="cancelSeduction" style="padding:5px 15px;">キャンセル</button>
      <button id="doSeduction" style="padding:5px 15px;">誘惑する</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
  // イベントリスナーを設定
  document.getElementById("doSeduction").addEventListener("click", () => {
    const seducerName = document.getElementById("seducerSelect").value;
    if (!seducerName) {
      alert("誘惑する村人を選択してください。");
      return;
    }
    
    // 人口上限チェックを追加
    if (theVillage.villagers.length >= theVillage.popLimit) {
      alert("村の人口上限に達しています。新たな村人を受け入れるには、家屋を建設して人口上限を増やしてください。");
      theVillage.log(`誘惑失敗: 人口上限(${theVillage.popLimit}人)に達しています`);
      return;
    }
    
    const seducer = theVillage.villagers.find(v => v.name === seducerName);
    if (!seducer) return;
    
    // 条件チェック
    // 1. 精神性別と肉体性別が異なるか
    // 2. 誘惑者の好色が21以上か
    if (visitor.spiritSex === seducer.bodySex) {
      alert("誘惑者の肉体性別と訪問者の精神性別が同じです。誘惑できません。");
      theVillage.log(`${seducer.name}の誘惑は失敗しました。(理由: 性別の不一致)`);
      return;
    }
    
    if (seducer.sexdr < 21) {
      alert("誘惑者の好色が足りません。誘惑できません。");
      theVillage.log(`${seducer.name}の誘惑は失敗しました。(理由: 誘惑者の好色不足)`);
      return;
    }
    
    // 誘惑成功率を計算
    const successRate = Math.min(100, Math.max(0, 
      coefficient * (seducer.chr / 20) * (seducer.sexdr / 20) * 100
    ));
    
    // 誘惑判定
    if (Math.random() * 100 < successRate) {
      // 成功
      visitor.mindTraits = visitor.mindTraits.filter(t => t !== "訪問者");
      visitor.job = "なし";
      visitor.action = "休養";
      visitor.jobTable = ["なし", "休養"];
      visitor.actionTable = ["休養"];
      
      // 名前から「〜の」を削除
      const visitorType = getVisitorType(visitor);
      if (visitor.name.includes(`${visitorType}の`)) {
        visitor.name = visitor.name.replace(`${visitorType}の`, "");
      }
      
      // 訪問者リストから削除し、村人リストに追加
      theVillage.visitors = theVillage.visitors.filter(v => v.name !== visitor.name);
      theVillage.villagers.push(visitor);
      
      // 仕事テーブルを更新
      refreshJobTable(visitor);
      
      theVillage.log(`${seducer.name}の誘惑により、${visitor.name}が村人になりました。(成功率: ${Math.floor(successRate)}%)`);
      alert(`誘惑成功！${visitor.name}が村人になりました。`);
    } else {
      // 失敗
      visitor.mindTraits.push("勧誘失敗");
      theVillage.log(`${seducer.name}の誘惑は失敗しました。(成功率: ${Math.floor(successRate)}%)`);
      alert("誘惑に失敗しました。");
    }
    
    closeSeductionModal();
    closeConversationModal();
    updateUI(theVillage);
  });
  
  // キャンセルボタンのイベントリスナーを設定
  const cancelButton = document.getElementById("cancelSeduction");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      closeSeductionModal();
    });
  }
  
  // オーバーレイクリックでもモーダルを閉じる
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeSeductionModal();
    }
  });
}

// 誘惑モーダルを閉じる
function closeSeductionModal() {
  const overlay = document.getElementById("seductionOverlay");
  const modal = document.getElementById("seductionModal");
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}