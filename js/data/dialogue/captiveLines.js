const CAPTIVE_CONVERSATION_LINES = {
  "ゴブリン": [
    "隅で歯を鳴らし、こちらの手元を警戒している。",
    "縄をほどけと言いかけて、こちらの目を見ると黙り込んだ。"
  ],
  "キュクロプス": [
    "鎖を鳴らしながら、ひとつ目でこちらを睨んでいる。",
    "低い息を吐き、牢の梁がきしむほど身じろぎした。"
  ],
  "ハーピー": [
    "翼を折り畳み、木柵の隙間から空を見上げている。",
    "羽づくろいを止め、こちらの声にだけ耳を向けた。"
  ],
  default: [
    "牢の中から、こちらの言葉を測るように見返している。",
    "粗末な寝藁に腰を下ろし、まだ村を信用していない。"
  ]
};

export function getCaptiveConversationLines(captive, { failed = false } = {}) {
  if (failed) {
    return ["こちらの言葉に目を伏せ、今月はもう口を開きそうにない。"];
  }
  const type = String(captive?.raiderType || captive?.job || captive?.race || "");
  const key = type.includes("キュクロプス")
    ? "キュクロプス"
    : type.includes("ハーピー")
      ? "ハーピー"
      : type.includes("ゴブリン")
        ? "ゴブリン"
        : "default";
  return CAPTIVE_CONVERSATION_LINES[key];
}
