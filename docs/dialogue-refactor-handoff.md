# 会話・セリフ実装ガイド

## 目的

この文書は、現行の会話エンジン構造と、新規セリフを作成・実装するときの判断基準をまとめる。

通常の村人会話は `js/dialogue/dialogueEngine.js` が中心になっている。ただし、恋愛成立・結婚・奇跡結果など、一部の専用モーダル用セリフはまだ各処理ファイル内に残っている。新しく会話データを追加するときは、対象の表示経路を確認してから置き場所を選ぶ。肉体交換への反応は `js/data/dialogue/exchangeLines.js` に分離し、交換の奇跡と落雷による肉体交換で共有している。

## 現行構造

### 表示側

- `js/conversation.js`
  - 会話モーダル本体。
  - 会話文は `getConversationLine({ character, village })` で取得する。
  - 勧誘、誘惑、商人取引、襲撃中の行動ボタンなど、会話モーダル上の操作も扱う。

- `js/RandomEvents.js`
  - ランダムイベント処理本体。
  - 村人のイベントセリフは `getDialogueLine({ scene: "randomEvent" })` または `scene: "randomEventSecond"` で取得する。

- `js/reproduction.js`
  - 妊娠、臨月、産褥、成人などの処理本体。
  - 会話用セリフの一部は `getDialogueLine({ scene: "reproduction" })` で取得する。

- `js/relationships.js`
  - 恋人成立・結婚成立の処理と専用モーダル。
  - 現時点では、恋愛/結婚モーダル用の口調別セリフをこのファイル内に持つ。

- `js/miracles.js`
  - 奇跡実行、奇跡結果モーダル、交換の奇跡モーダル。
  - 現時点では、奇跡結果の口調別セリフをこのファイル内に持つ。
  - 交換の奇跡モーダルの肉体交換反応は `exchangeLines.js` を参照する。

### 会話エンジン

- `js/dialogue/dialogueEngine.js`
  - 口調解決は `toneProfiles.js` に委譲する。
  - `getDialogueLines` で scene/key ごとの候補配列を取得する。
  - `getDialogueLine` で候補から1行を選ぶ。
  - `collectConversationCandidates` で通常会話の候補を集める。
  - `selectConversationCandidate` で最も高い優先度の候補からランダムに選ぶ。
  - `getConversationLine` が通常会話の入口。

現在の `getDialogueLines` が扱う scene:

- `status`
- `lazy`
- `season`
- `condition`
- `job`
- `reproduction`
- `visitor`

`randomEvent` と `randomEventSecond` は、通常の `getDialogueLines` ではなく `getDialogueLine` 内の専用分岐で処理する。

### データファイル

- `js/data/dialogue/toneProfiles.js`
  - 実効口調キー、口調ファミリー、fallback、デフォルト口調を定義する。
  - `resolveDialogueTone`、`resolveStoredSpeechType`、`getToneLookupKeys` を持つ。

- `js/data/dialogue/statusLines.js`
  - `STATUS_LINES`: 健康、疲労、消耗、襲撃中など。
  - `LAZY_LINES`: 勤勉が低いときの会話。

- `js/data/dialogue/seasonLines.js`
  - 春、夏、秋、冬の季節会話。

- `js/data/dialogue/conditionLines.js`
  - 危篤、負傷、疫病、病気、過労、飢餓、凍え、抑鬱、狂乱、心労など。

- `js/data/dialogue/jobLines.js`
  - 警備、踊り子、バニーなど、仕事に応じた通常会話。

- `js/data/dialogue/reproductionLines.js`
  - 妊娠、臨月、産褥、成人など、肉体状態や成長に関する会話。

- `js/data/dialogue/visitorLines.js`
  - 訪問者タイプ別の会話。

- `js/data/dialogue/randomEventLines.js`
  - ランダムイベントの口調別セリフ、子供向け汎用セリフ、fallback 展開ヘルパー。

- `js/data/randomEventData.js`
  - ランダムイベントの種別、タイトル、説明、効果などのイベント定義。
  - 実際の村人セリフは `randomEventLines.js` 側に置く。

- `js/data/dialogue/basicConversationLines.js`
  - 文面保持用の分離ファイル。
  - 現行の通常会話表示では、主に `statusLines.js` など scene 別データを使う。

## 通常会話の優先度

`CONVERSATION_PRIORITY` は以下の値。

- `NORMAL = 1`
- `SEVERE = 2`
- `EMERGENCY = 3`
- `CRITICAL = 4`

通常会話では `collectConversationCandidates` が候補を集め、候補が持つ最大 priority の中からランダムに1つ選ぶ。同じ scene/key の重複候補は追加されない。また、現在の口調で取得できる行がない候補は追加されない。

現在の候補:

- 村特性 `襲撃中`: `status/raid`, `EMERGENCY`
- 肉体特性 `危篤`: `condition/critical`, `CRITICAL`
- 肉体特性 `負傷`, `疫病`, `病気`, `過労`, `飢餓`, `凍え`: `SEVERE`
- 肉体特性 `産褥`: `reproduction/postpartumConversation`, `NORMAL`
- 肉体特性 `疲労`: `status/tired`, `NORMAL`
- 精神特性 `抑鬱`: `condition/depression`, `SEVERE`
- 精神特性 `狂乱`: `condition/madness`, `EMERGENCY`
- 精神特性 `心労`: `condition/mentalStress`, `NORMAL`
- HP または MP が33以下: `status/exhausted`, `SEVERE`
- HP または MP が34から59: `status/tired`, `NORMAL`
- 上記以外: `status/healthy`, `NORMAL`
- 肉体特性 `臨月`: `reproduction/fullTermConversation`, `NORMAL`
- 肉体特性 `妊娠`: `reproduction/pregnantConversation`, `NORMAL`
- 勤勉 `ind <= 10`: `lazy/lowDiligence`, `NORMAL`
- `JOB_LINES` に存在する仕事: `job/<仕事名>`, `NORMAL`
- 村特性に含まれる `春`, `夏`, `秋`, `冬`: `season/<季節>`, `NORMAL`

`getConversationLine` では、以下は通常候補選択より前に処理される。

- 精神特性 `訪問者`: `visitor` scene の会話を返す。
- 精神特性 `襲撃者` かつ `raiderDialogues` がある: 襲撃者専用セリフを返す。

## 口調キー

「口調」は性格そのものではなく、セリフ文体のキーとして扱う。

保存データに常にある前提なのは既存の `speechType`。ただし `赤子`、`男児`、`女児` は保存値ではなく、会話エンジンがその場で算出する仮想口調キーにする。

幼児・子供:

- `赤子`
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

注意点:

- `赤子` は精神特性 `無垢`。
- `男児` は精神特性 `萌芽` かつ 精神性別 `男`。
- `女児` は精神特性 `萌芽` かつ 精神性別 `女`。
- `無垢` は `赤子` の alias として扱う。
- `思春期` は独立口調にしない。原則として成人の性格別 `speechType` を使う。
- `中性的` はこのゲームでは「中性的な性格の女性」扱い。男性/中立汎用ではなく女性口調側に置く。
- `老人` は男性の老人として扱う。中立老人・女性老人ではない。
- 肉体年齢より精神特性・精神性別を優先する。肉体交換があるため。

## 口調解決

`resolveDialogueTone(character)` の現在の流れ:

1. `mindTraits` に `無垢` があれば `赤子`。
2. `mindTraits` に `萌芽` があれば、`spiritSex` が `女` なら `女児`、それ以外なら `男児`。
3. それ以外は `speechType` を使う。alias があれば正規化する。
4. `speechType` がなければ、`spiritSex` が `女` なら `普通Ｆ`、それ以外なら `普通Ｍ`。

`resolveStoredSpeechType(character)` は、保存値としての `speechType` を優先し、なければ性別デフォルトを返す。ランダムイベントの成人向けセリフではこちらを使う。

## fallback

通常の scene では `selectToneLines` が以下の順で lookup key を作り、最初に存在したキーのセリフを使う。

1. 正規化後の実効口調キー
2. 元の口調キー
3. `TONE_PROFILES` の `family`
4. `TONE_PROFILES` の `fallback` から `default` を除いたもの
5. 精神性別に基づくデフォルト口調
6. デフォルト口調の `family`
7. デフォルト口調の `fallback` から `default` を除いたもの
8. `default`

ランダムイベントの成人向けセリフは、`SPEECH_TYPE_LINE_FALLBACKS` と性別デフォルトを使う専用ルートで選ばれる。子供口調では、イベント固有の子供向けセリフがあればそれを優先し、なければ `INFANT_EVENT_LINES` または `BUDDING_EVENT_LINES` を使う。

fallback キーは便利だが、男女差や当事者性が混線しやすい。妊娠、仕事、身体変化など、読む人格によって自然な反応が変わる場面では、`丁寧Ｍ` と `丁寧Ｆ` のように実口調キーを分ける。

## セリフ作成ルール

新規にセリフ案を作成するときは、以下を優先する。

- セリフは原則として当事者本人の発話にする。
- 他人への助言、客観説明、観察者コメントだけで終わらせない。
- 状況説明が必要な場合でも、本人が自分の状態・仕事・出来事をどう受け止めているかを優先する。
- 口調は肉体ではなく精神側を優先する。
- 肉体状態や仕事が女性寄り・成人寄りに見えても、発話は精神側の実効口調で書く。

このゲームでは交換の奇跡などにより、現実では起こりにくい、または起こり得ない組み合わせが発生する。

- 男性人格が妊娠する。
- 男性人格がバニーの仕事をする。
- 子供人格が妊娠・臨月・産褥を経験する。
- 老人男性人格が女性肉体の仕事や妊娠を経験する。
- 精神は大人だが肉体が子供、または精神は子供だが肉体が大人になる。

セリフはこれらの状態でも破綻しないように書く。

通常会話データを新しく作る場合は、`statusLines.js` や `seasonLines.js` と同じく、できるだけ実口調キーを直接持たせる。

- 推奨: `普通Ｍ`, `丁寧Ｍ`, `普通Ｆ`, `丁寧Ｆ`, `男児`, `女児`, `老人` などを直接書く。
- 注意: `polite`, `bold`, `rough`, `cool`, `bright`, `male`, `female` などの口調ファミリー fallback は、男女・当事者性が混線しやすい。
- fallback キーを使う場合は、男性人格/女性人格のどちらが読んでも破綻しない文だけにする。
- 性別や体験内容で文が変わる場面では、共有 `polite` などに逃がさず、実口調キーを分ける。
- 既存の `conditionLines.js` には口調ファミリー fallback 中心の古い書き方が残っている。修正や追加を行う場合は、可能な範囲で実口調キー方式へ寄せ、共有 fallback に男女差や当事者性のある文を置かない。

### 世界観の目安

舞台は神話・開拓村・村落生活を中心にした世界である。現代的な語や施設は、口調として意図した場合を除き避ける。

避けたい例:

- `インスタ`
- `SNS`
- `スマホ`
- `ネット`
- `カフェ`
- `コンビニ`
- 現代的なメタ表現

許容されている例:

- `デート`
- `ファッションショー`
- `コーデ`
- `映える`

世界観に迷う場合は、村、酒場、祭、川、海、森、畑、祈り、魔素、神、奇跡など、このゲーム内で既に使われている語彙へ寄せる。

### 書き方の注意

- 実装上の注釈をセリフに混ぜない。
- 体験した本人が驚く、喜ぶ、戸惑う、受け入れる、困る、といった反応を中心にする。
- `老人` のセリフは「わし」「のう」「じゃ」などを使ってよいが、第三者への説教だけにならないようにする。
- 仕事セリフは、その仕事をしている本人の発話にする。
- 妊娠・臨月・産褥などは肉体状態だが、発話は精神側の口調で書く。

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
- 仕事
- ランダムイベント種別
- 肉体と精神の性別/年齢不一致

例: 「疫病の女児」は、口調 `女児` + 状況 `疫病` として扱う。

## 実装時の注意

- 保存データに `赤子` / `男児` / `女児` を書き込まない。毎回算出する。
- `mindTraits` に隠し特性を増やすより、仮想口調キーで扱う方が安全。
- 既存の `speechType` 保存形式は壊さない。
- 肉体交換があるので、口調は原則 `spiritSex` と `mindTraits` を優先する。
- 新しい通常会話は、可能なら `js/data/dialogue/*Lines.js` に追加し、処理本体にセリフを直書きしない。
- 恋愛・奇跡など、まだ処理ファイル内にセリフが残るモーダルを修正する場合も、この文書の口調・当事者性・世界観ルールに従う。
- PowerShell 上では日本語が文字化け表示されることがある。実ファイルの再エンコードは、ブラウザ表示や `git diff` で確認してから行う。
- このリポジトリでは LF 改行を維持する。`.gitattributes` は `* text=auto eol=lf`。
