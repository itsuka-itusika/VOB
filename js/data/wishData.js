import { resolveDialogueTone } from "./dialogue/toneProfiles.js";

export const WISH_DURATION_MONTHS = 12;
export const WISH_START_CHANCE = 0.2;

const WISH_TONE_PATTERNS = {
  "赤子": {
    start: (_line, { targetName }) => targetName
      ? `あぅ……うぅ……。（${targetName}へ願うように手を伸ばしている）`
      : "あぅ……うぅ……。（願うように手を伸ばしている）",
    complete: (_line, { targetName }) => targetName
      ? `きゃっ、きゃっ。（${targetName}を見て、うれしそうに笑っている）`
      : "きゃっ、きゃっ。（うれしそうに笑っている）"
  },
  "男児": {
    start: line => `${line} かみさま、おねがい！`,
    complete: line => `${line} やったあ、ありがとう！`
  },
  "女児": {
    start: line => `${line} かみさま、おねがいね！`,
    complete: line => `${line} わあ、かなった！ ありがとう！`
  },
  "普通Ｍ": {
    start: line => `${line} 神さま、頼むよ。`,
    complete: line => `${line} 願ってみるものだな。`
  },
  "丁寧Ｍ": {
    start: line => `神さま、お願いがあります。${line} どうかお聞き届けください。`,
    complete: line => `${line} お聞き届けくださり、ありがとうございます。`
  },
  "強気Ｍ": {
    start: line => `${line} 神さまなら叶えられるだろ。頼んだぞ。`,
    complete: line => `${line} よし、これでいい。`
  },
  "乱暴": {
    start: line => `${line} 何とかしてくれ。頼んだぞ、神さま。`,
    complete: line => `${line} ありがとよ、神さま。`
  },
  "お調子者": {
    start: line => `${line} ひとつ景気よく頼むぜ、神さま！`,
    complete: line => `${line} やったな、神さま！`
  },
  "陰気": {
    start: line => `${line} どうせ無理かもしれないけど、頼むよ……。`,
    complete: line => `${line} 本当に叶うとはな……ありがとう。`
  },
  "クールＭ": {
    start: line => `${line} 必要な願いはそれだけだ。`,
    complete: line => `${line} 願望の達成を確認した。感謝する。`
  },
  "普通Ｆ": {
    start: line => `${line} 神さま、お願いね。`,
    complete: line => `${line} 願ってみてよかった。ありがとう。`
  },
  "丁寧Ｆ": {
    start: line => `神さま、お願いがございます。${line} どうかお聞き届けください。`,
    complete: line => `${line} お聞き届けくださり、ありがとうございます。`
  },
  "お嬢様": {
    start: line => `${line} 神さま、どうかお聞き届けくださいませ。`,
    complete: line => `${line} 願いを叶えてくださり、感謝いたしますわ。`
  },
  "快活": {
    start: line => `${line} ね、神さま！ お願い！`,
    complete: line => `${line} やったあ！ 神さま、ありがとう！`
  },
  "内気": {
    start: line => `${line} こんなお願いでも、聞いてくれますか……。`,
    complete: line => `${line} 叶えてくれて……ありがとうございます。`
  },
  "強気Ｆ": {
    start: line => `${line} 神さま、きっと叶えてくれるわよね。`,
    complete: line => `${line} ちゃんと叶えてくれたのね。感謝するわ。`
  },
  "蓮っ葉": {
    start: line => `${line} 何とかしてよ。頼んだからね、神さま。`,
    complete: line => `${line} やるじゃない、神さま。ありがと。`
  },
  "おっとり": {
    start: line => `${line} 神さま、どうぞよろしくお願いいたします。`,
    complete: line => `${line} まあ、うれしい。ありがとうございます。`
  },
  "ぶりっこ": {
    start: line => `${line} ねえ神さま、お願いを叶えてほしいな。`,
    complete: line => `${line} うれしいな。神さま、ありがとっ。`
  },
  "クールＦ": {
    start: line => `${line} 私の願いはそれだけよ。`,
    complete: line => `${line} 願望の達成を確認したわ。感謝する。`
  },
  "ギャル風": {
    start: line => `${line} 神さま、マジでお願いね！`,
    complete: line => `${line} ほんとに叶ったじゃん！ 神さま、ありがと！`
  },
  "中性的": {
    start: line => `${line} 神さま、聞き届けてくれるかな。`,
    complete: line => `${line} 願いが叶ったんだね。ありがとう。`
  },
  "老人": {
    start: line => `${line} 神さま、老いぼれの願いを聞いてくだされ。`,
    complete: line => `${line} 長く生きてみるものじゃ。ありがたいのう。`
  },
  "狼": {
    start: (_line, { targetName }) => targetName
      ? `くぅん……。（${targetName}を見つめ、祈るように頭を垂れている）`
      : "くぅん……。（祈るように頭を垂れている）",
    complete: (_line, { targetName }) => targetName
      ? `わふっ、わふっ！（${targetName}へ、うれしそうに尾を振っている）`
      : "わふっ、わふっ！（うれしそうに尾を振っている）"
  },
  "ゴブリン": {
    start: line => `${line} 神さま、頼むゴブ。`,
    complete: line => `${line} 叶ったゴブ！ ありがとゴブ！`
  }
};

export const WISH_DEFINITIONS = [
  {
    id: "avoid_enemy",
    name: "顔も見たくない",
    startLine: ({ targetName }) => `${targetName}の顔も見たくない。どうにかしてほしい。`,
    completionLines: {
      targetGone: ({ targetName }) => `${targetName}の顔を見ずに済むようになった。胸のつかえが取れた。`,
      rivalryResolved: ({ targetName }) => `${targetName}を憎み続けるのは、もうやめにする。気持ちが少し軽くなった。`
    }
  },
  {
    id: "be_popular",
    name: "モテたい",
    startLine: () => "もっと人に好かれたい。人を惹きつけられるようになりたい。",
    completionLines: {
      partner: () => "ようやく大切に思える相手と結ばれた。この縁を大事にしたい。",
      charm: () => "前よりも人の目を引けるようになった。これなら胸を張れそうだ。"
    }
  },
  {
    id: "get_closer",
    name: "近づきたい",
    startLine: ({ targetName }) => `${targetName}とお近づきになりたい。もっと心を通わせたい。`,
    completionLines: {
      partner: ({ targetName }) => `${targetName}と心を通わせることができた。この縁を大切にしたい。`,
      exchangedBody: ({ targetName }) => `${targetName}の身体になって、見えてくるものがあった。不思議な形で願いが叶った。`
    }
  },
  {
    id: "be_healthy",
    name: "健康になりたい",
    startLine: () => "丈夫な身体になりたい。病や疲れに負けずに暮らしたい。",
    completionLines: {
      healthy: () => "身体の底から力が湧いてくる。これなら元気に働けそうだ。"
    }
  },
  {
    id: "be_strong",
    name: "強くなりたい",
    startLine: () => "もっと強くなりたい。大切なものを守れる力がほしい。",
    completionLines: {
      strong: () => "望んでいた力が、この腕に宿った。もう簡単には負けない。"
    }
  },
  {
    id: "grow_up",
    name: "早くおとなになりたい",
    startLine: () => "はやくおとなになりたい。みんなとおなじように、できることをふやしたいな。",
    completionLines: {
      adultBody: () => "もう子どもの身体ではない。これからはもっと村の力になれる。"
    }
  },
  {
    id: "be_full_fledged",
    name: "早く一人前になりたい",
    startLine: () => "早く一人前になりたい。いつまでも子ども扱いされたくない。",
    completionLines: {
      adultBody: () => "これで身体は一人前になった。あとは働きで認めてもらいたい。"
    }
  },
  {
    id: "win_distinction",
    name: "殊勲をあげたい",
    startLine: () => "この村を守る戦で、いちばんの働きをしてみせたい。",
    completionLines: {
      distinguished: () => "殊勲は自分のものだ。守ると誓った村を、この手で守り抜いた。"
    }
  },
  {
    id: "be_child_again",
    name: "子どもに戻りたい",
    startLine: () => "働くことばかり考えずに、もう一度、子どものように過ごしたい。",
    completionLines: {
      childBody: () => "身体まで子どもに戻るとは思わなかった。今は何もかもが新しく見える。"
    }
  },
  {
    id: "want_partner",
    name: "恋人が欲しい",
    startLine: () => "心を分かち合える恋人がほしい。この村で、よい縁に巡り会えないかな。",
    completionLines: {
      partner: () => "ひとりではないと思える相手に出会えた。この縁を大事にしたい。"
    }
  },
  {
    id: "regain_youth",
    name: "若さを取り戻したい",
    startLine: () => "もう一度、若い頃の身体を取り戻したい。まだやり残したことがあるんだ。",
    completionLines: {
      young: () => "身体が若返っている。この力を今度こそ無駄にはしない。"
    }
  },
  {
    id: "research_monsters",
    name: "魔物について調べたい",
    startLine: () => "魔物について、書物だけでは分からないことを調べたい。村で観察できる機会がほしい。",
    completionLines: {
      monsterPresent: () => "これで魔物を間近に観察できる。思い込みではなく、確かな記録を残せそうだ。"
    }
  },
  {
    id: "research_rare_races",
    name: "希少種族について調べたい",
    startLine: () => "希少な種族の暮らしや身体について調べたい。実際に話を聞ける機会がほしい。",
    completionLines: {
      rareRacePresent: () => "希少な種族から直接話を聞けるなんて、得難い機会だ。大切に記録しよう。"
    }
  },
  {
    id: "want_child",
    name: "子どもが欲しい",
    startLine: () => "伴侶との子どもがほしい。難しい願いだとしても、どうか聞き届けてほしい。",
    completionLines: {
      requesterPregnant: () => "この身体に新しい命が宿っている。家族が増える日が待ち遠しい。",
      spousePregnant: ({ targetName }) => `${targetName}に新しい命が宿った。家族が増える日が待ち遠しい。`
    }
  },
  {
    id: "celebrate",
    name: "パーッと騒ぎたい",
    startLine: () => "たまには村のみんなで、酒を飲んでパーッと騒ぎたい。",
    completionLines: {
      celebration: () => "思いきり飲んで騒げた。胸のつかえまで吹き飛んだよ。"
    }
  }
];

export const WISH_DEFINITION_BY_ID = new Map(
  WISH_DEFINITIONS.map(definition => [definition.id, definition])
);

export function resolveWishLine(line, context = {}, character = null, phase = "start") {
  const baseLine = typeof line === "function" ? line(context) : String(line || "");
  if (!character) return baseLine;
  const tone = resolveDialogueTone(character);
  const pattern = WISH_TONE_PATTERNS[tone] || WISH_TONE_PATTERNS[character.spiritSex === "女" ? "普通Ｆ" : "普通Ｍ"];
  const formatter = phase === "complete" ? pattern.complete : pattern.start;
  return formatter(baseLine, context);
}
