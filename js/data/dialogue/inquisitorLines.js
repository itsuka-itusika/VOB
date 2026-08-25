// 異端審問官の口上。1回の異端審問では、同じ組から口上と結果のセリフを選ぶ。
export const INQUISITOR_SPEECH_SETS = [
  {
    opening: "「この村では、古き神の力が異様なほど高まっているとの報告がある。新しき神の名において、異端の疑いを調査する。」",
    hospitality: "「十分な協力が得られた。今回の調査では、断罪に足る証は見つからなかったことにしよう。」",
    expulsion: "「拒絶の事実は記録した。次に訪れるのは、調査官ではない。」"
  },
  {
    opening: "「豊かな村だ。畑も、蔵も、人の顔つきさえ。……この実りは、どなたの恵みかな。答えによっては、帳面の書き方が変わる。」",
    hospitality: "「よい酒だった。帳面には『信仰篤き村』とだけ書いておこう。……次に来る者が、同じ筆を持つとは限らんがな。」",
    expulsion: "「そうか。ならば書くことは一つだ。この村は、問いに答えなかった。」"
  },
  {
    opening: "「祭の煙が、ここまで臭う。古き神の名を口にした者が幾人いる。隠し立てをすれば、村ごと帳面に載ることになるぞ。」",
    hospitality: "「……よかろう。教会への献身は、罪を薄める。今日のところは、あの煙も酒の匂いだったことにしておく。」",
    expulsion: "「われを追うか。よく覚えておけ、その手が押しのけたのは人ではない。新しき神の御手だ。」"
  }
];

export function pickInquisitorSpeechSet(random = Math.random) {
  const index = Math.floor(random() * INQUISITOR_SPEECH_SETS.length);
  return INQUISITOR_SPEECH_SETS[Math.min(index, INQUISITOR_SPEECH_SETS.length - 1)];
}
