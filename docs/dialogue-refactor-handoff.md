# 会話パターン整理・リファクタリング引き継ぎ書

## 目的

Village of Bacchus の会話・セリフまわりは、通常会話、ランダムイベント、恋愛、出産、奇跡、訪問者、襲撃者などがそれぞれ別方式で実装されている。

今後ランダムイベントや状態異常を増やすたびにセリフ追加箇所が散らばるため、まず「口調判定」と「状況別セリフ取得」を中心化し、セリフ本文はカテゴリ別データに分ける。

## 現状の主な関連ファイル

- `js/conversation.js`
  - 通常会話モーダル本体。
  - `SPEECH_PATTERNS`、状態別会話、幼児会話、訪問者会話、低勤勉会話、季節会話を内包。
  - 勧誘、誘惑、商人取引モーダルも同居しており肥大化している。

- `js/data/randomEventData.js`
  - ランダムイベント名、種類、イベント別セリフ、口調 fallback を保持。
  - 現時点では比較的データ分離されているが、イベントごとに口調別文を持つため増加しやすい。

- `js/RandomEvents.js`
  - ランダムイベント処理と、イベントセリフ選択の一部を持つ。
  - `getChildlikeEventLine` で `無垢` / `萌芽` を特別扱いしている。

- `js/relationships.js`
  - 恋人・結婚成立時のセリフを独自に持つ。

- `js/reproduction.js`
  - 妊娠、出産、成人、乳児/子供会話を独自に持つ。

- `js/miracles.js`
  - 奇跡結果、肉体交換などのセリフを独自に持つ。

- `js/data/raidData.js`
  - 襲撃者テンプレートの専用セリフを持つ。

## 口調類型の整理方針

「口調」は性格そのものではなく、セリフ文体のキーとして扱う。

実データに常に保存する必要があるのは既存の `speechType`。ただし `無垢`、`男児`、`女児` は保存値ではなく、会話エンジンがその場で算出する仮想口調キーにする。

### 採用する実効口調キー

幼児・子供:

- `無垢`
- `男児`
- `女児`

成人男性:

- `普通Ｍ`
- `丁寧Ｍ`
- `強気Ｍ`
- `乱暴`
- `お調子者`
- `陰気`
- `クールＭ`

成人女性:

- `普通Ｆ`
- `丁寧Ｆ`
- `お嬢様`
- `快活`
- `内気`
- `強気Ｆ`
- `蓮っ葉`
- `おっとり`
- `ぶりっこ`
- `クールＦ`
- `ギャル風`
- `中性的`

その他:

- `老人`

### 注意点

- `男児` は「精神特性 `萌芽` かつ 精神性別 `男`」。
- `女児` は「精神特性 `萌芽` かつ 精神性別 `女`」。
- `無垢` は精神特性 `無垢`。
- `思春期` は容量削減のため、原則として成人の性格別 `speechType` を使う。
- `中性的` はこのゲームでは「中性的な性格の女性」扱い。男性/中立汎用ではなく女性口調側に置く。
- 肉体年齢より精神特性・精神性別を優先する。肉体交換があるため。

## 口調にしないもの

以下は口調キーにせず、状況・場面として扱う。

- `訪問者`
- `襲撃者`
- 商人などの訪問者タイプ
- `妊娠`
- `臨月`
- `産褥`
- `疫病`
- `負傷`
- `過労`
- `抑鬱`
- `襲撃中`
- 季節
- ランダムイベント種別
- 肉体と精神の性別/年齢不一致

例: 「疫病の女児」は、口調 `女児` + 状況 `疫病` として扱う。

## 推奨する新構成

### 中心モジュール

新規作成候補:

- `js/dialogue/dialogueEngine.js`

役割:

- キャラクターから実効口調キーを解決する。
- 状況に応じたセリフ候補を探す。
- 口調別セリフがなければ fallback する。
- 候補からランダムに1つ返す。

想定 API:

```js
getDialogueLine({
  character,
  village,
  scene: "status",
  key: "healthy"
});
```

```js
getDialogueLine({
  character,
  village,
  scene: "randomEvent",
  key: "epidemic"
});
```

```js
getDialogueLine({
  character,
  village,
  scene: "relationship",
  key: "lover",
  context: { partner }
});
```

### データファイル

セリフ本文は中心モジュールに直書きしない。

新規作成候補:

- `js/data/dialogue/toneProfiles.js`
- `js/data/dialogue/statusLines.js`
- `js/data/dialogue/seasonLines.js`
- `js/data/dialogue/randomEventLines.js`
- `js/data/dialogue/relationshipLines.js`
- `js/data/dialogue/reproductionLines.js`
- `js/data/dialogue/visitorLines.js`
- `js/data/dialogue/miracleLines.js`

中心モジュールはこれらを参照して選ぶだけにする。

## 実効口調解決の仕様案

```js
export function resolveDialogueTone(character) {
  const mindTraits = Array.isArray(character?.mindTraits) ? character.mindTraits : [];
  const spiritSex = character?.spiritSex || character?.bodySex || "男";

  if (mindTraits.includes("無垢")) return "無垢";

  if (mindTraits.includes("萌芽")) {
    return spiritSex === "女" ? "女児" : "男児";
  }

  const speechType = character?.speechType;
  if (speechType) return speechType;

  return spiritSex === "女" ? "普通Ｆ" : "普通Ｍ";
}
```

`老人` は既存データでは `speechType = "老人"` として扱われている箇所があるため、いったん保存値を尊重する。将来的に「精神年齢が高いなら老人」などを入れる場合も、ここで一元管理する。

## fallback 方針

全イベントで全口調分のセリフを書くと破綻するので、必須にしない。

基本:

1. 実効口調キー
2. 口調ファミリー
3. 性別デフォルト
4. `default`

例:

```js
export const TONE_PROFILES = {
  "男児": {
    family: "childMale",
    fallback: ["child", "default"]
  },
  "女児": {
    family: "childFemale",
    fallback: ["child", "default"]
  },
  "普通Ｍ": {
    family: "normalMale",
    fallback: ["male", "default"]
  },
  "丁寧Ｍ": {
    family: "polite",
    fallback: ["male", "default"]
  },
  "中性的": {
    family: "neutralFemale",
    fallback: ["female", "default"]
  },
  "老人": {
    family: "elder",
    fallback: ["polite", "default"]
  }
};
```

セリフデータ例:

```js
export const RANDOM_EVENT_LINES = {
  epidemic: {
    default: ["体が重い……今日は療養した方がよさそうだ。"],
    polite: ["発熱がひどいですね。皆に広げぬよう、静かに休みます。"],
    rough: ["だるい……強がっても仕方ねえ。休ませろ。"],
    childMale: ["うう……からだがあついよ。"],
    childFemale: ["ねつっぽい……おやすみしたい。"],
    elder: ["疫病は侮れん。若い者も無理をするでないぞ。"]
  }
};
```

## リファクタリング手順案

### Phase 1: 基盤だけ作る

目的: 既存挙動をなるべく変えず、中心 API を追加する。

作業:

- `js/dialogue/dialogueEngine.js` を作る。
- `resolveDialogueTone` を実装する。
- `pickDialogueLine` と fallback 解決を実装する。
- `toneProfiles.js` を作る。
- 小さな検査用スクリプトかテストを追加する。

この段階では既存ファイルの大規模移動はしない。

### Phase 2: ランダムイベント会話を寄せる

理由: `randomEventData.js` はすでにデータ寄りで、移行しやすい。

作業:

- `EVENT_LINES_BY_SPEECH_TYPE` を新しい `randomEventLines.js` に段階移動。
- `RandomEvents.createEventLine` から `getDialogueLine({ scene: "randomEvent" })` を呼ぶ。
- `無垢`、`萌芽` の個別処理を `dialogueEngine` 側へ寄せる。

### Phase 3: 通常会話を分離

理由: `conversation.js` が最大の混乱源。

作業:

- `SPEECH_PATTERNS` から通常状態セリフを `statusLines.js` へ移す。
- `getStatusLine` の判定を `dialogueEngine` に寄せる。
- `getLazyLines` を `statusLines` または `conditionLines` に移す。
- `getSeasonalLines` を `seasonLines.js` へ移す。

`conversation.js` はモーダル表示とボタン処理中心にする。

### Phase 4: 恋愛・出産・奇跡・訪問者を統合

作業:

- `relationships.js` の恋人/結婚セリフを `relationshipLines.js` へ移す。
- `reproduction.js` の妊娠/出産/成人/乳児セリフを `reproductionLines.js` へ移す。
- `miracles.js` の奇跡結果/交換セリフを `miracleLines.js` へ移す。
- `conversation.js` の訪問者会話を `visitorLines.js` へ移す。

### Phase 5: 検査と掃除

作業:

- すべての `speechType` が `TONE_PROFILES` に存在するか検査。
- 各 scene/key が `default` か fallback 可能な行を持つか検査。
- 空配列、未定義参照、古い口調キーを検査。
- `node --check` を対象ファイルに実行。
- `git diff --check` で改行・空白を確認。

## 実装時の注意

- 保存データに `男児` / `女児` を書き込まない。毎回算出する。
- `mindTraits` に隠し特性を増やすより、仮想口調キーで扱う方が安全。
- `思春期` は独立口調にしない。例外場面だけ scene/key 側で思春期用セリフを追加する。
- 既存の `speechType` 保存形式は壊さない。
- 肉体交換があるので、口調は原則 `spiritSex` と `mindTraits` を優先する。
- PowerShell 上では日本語が文字化け表示されることがある。実ファイルの再エンコードは、ブラウザ表示や git diff で確認してから行う。
- このリポジトリでは LF 改行を維持する。`.gitattributes` は `* text=auto eol=lf`。

## 完了条件

- 新規イベントを追加するとき、イベント処理ファイルではロジックだけを書けばよい。
- セリフは `js/data/dialogue/*Lines.js` に追加すればよい。
- 子供・成人・老人・中性的の口調 fallback が共通で効く。
- `conversation.js` が会話データの巨大置き場ではなく、表示制御中心になっている。
- 既存の通常会話、ランダムイベント会話、恋愛/結婚、妊娠/出産、奇跡会話が壊れていない。

