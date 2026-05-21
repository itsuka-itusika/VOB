# ARCHITECTURE.md

このプロジェクトは、単一ページの静的ブラウザゲームです。中心状態である `theVillage` を各モジュールが操作し、必要に応じて `updateUI` で画面を再描画します。

## 全体構成

- `index.html`
  - 画面の土台、テーブル、ボタン、モーダル、スクリプト読込を定義する。
- `css/styles.css`
  - PC 表示、スマホ仮表示、テーブル、モーダル、ログ、各種操作 UI の見た目を定義する。
- `js/app.js`
  - アプリの接続層。モジュールを読み込み、HTML から呼ぶ操作を `window` に公開する。
- `js/main.js`
  - `theVillage` を生成し、月次進行の入口 `onNextTurn` を持つ。
- `js/classes.js`
  - `Village` と `Villager` のデータ構造を定義する。

## 状態管理

中心状態は `js/main.js` の `theVillage` です。`Village` は年月、資源、村人、訪問者、襲撃、建築、ログ、モーダル状態などを持ちます。`Villager` は肉体情報、精神情報、能力値、特性、仕事、行動、人間関係、妊娠・成長関連の情報を持ちます。

状態更新は各機能モジュールで直接行われます。専用の状態管理ライブラリはありません。そのため、変更後は必要なタイミングで `updateUI(theVillage)` を呼び、画面と状態を同期します。

## 起動時の流れ

1. `index.html` が `js/app.js` を ES module として読み込む。
2. `js/main.js` が `Village` を生成し、初期村人を `createInitialVillagers()` で作成する。
3. `updateUI(theVillage)` で初期画面を描画する。
4. `js/app.js` がボタン操作用の関数を `window` に登録する。
5. 表示モードを localStorage から復元し、PC / スマホ仮表示を切り替える。

## 月次処理

`onNextTurn()` が通常ターン進行の入口です。

1. ゲームオーバー中、襲撃処理中などの停止条件を確認する。
2. 襲撃中で迎撃未完了なら、襲撃モーダルを開く。
3. 強制休養などの行動制限を適用する。
4. 仕事や行動が未設定の村人がいれば確認する。
5. `handleAllVillagerJobs(theVillage)` で仕事処理を行う。
6. `doFixedEventPost(theVillage)` と `endOfMonthProcess(theVillage)` で月末処理を行う。
7. 年月を進め、年始なら加齢処理を行う。
8. `runMonthStartPhase(theVillage)` で月初イベントを処理する。
9. `updateUI(theVillage)` で画面を更新する。

## 主なモジュール

- `js/ui.js`
  - 村情報、村人表、訪問者表、襲撃者表、ログ、各種表示状態を描画する。
- `js/jobs.js`
  - 村人の仕事効果、資源増減、体力・メンタル変化、趣味効果などを処理する。
- `js/events.js`
  - 月初・月末イベント、固定イベント、ランダムイベント呼び出し、季節更新、加齢を扱う。
- `js/RandomEvents.js`
  - ランダムイベントの実行本体。イベントデータ、会話、結果モーダルをつなぐ。
- `js/reproduction.js`
  - 妊娠、出産、産褥、成人化、成長段階を扱う。
- `js/relationships.js`
  - 恋人・配偶者・親子などの関係を正規化し、追加・削除・表示する。
- `js/miracles.js`
  - 奇跡モーダル、奇跡の実行、交換の奇跡、奇跡結果を扱う。
- `js/secretTreasures.js`
  - 秘宝データ、秘宝モーダル、使い切り効果を扱う。
- `js/secretTreasureEvents.js`
  - 仕事や行商人取引による秘宝入手判定、入手ログ、入手イベントモーダルを扱う。
- `js/exchange.js`
  - 肉体と精神の交換処理を扱う。
- `js/buildings.js`
  - 建築データ、建築モーダル、建築効果を扱う。
- `js/raidStart.js`
  - 襲撃発生時の敵生成と警告モーダルを扱う。
- `js/raid.js`
  - 迎撃フェーズ、罠作成、戦闘、襲撃結果を扱う。
- `js/raidRules.js`
  - 襲撃中の行動可否や状態判定をまとめる。
- `js/villageScale.js`
  - 規模に応じた村の呼称、呼称到達モーダル、達成済み段階の管理を扱う。
- `js/saveLoad.js`
  - JSON ファイル保存/読込と localStorage 保存/読込を扱う。
- `js/dictionary.js`
  - 用語検索を扱う。
- `js/util.js`
  - 乱数、丸め、上限下限、顔画像パス、消費量計算などの小さな共通関数を持つ。

## domain と data

- `js/domain/jobTables.js`
  - 仕事・行動候補の更新、強制行動制限を扱う。
- `js/domain/jobMath.js`
  - 仕事・行動の体力/メンタル消費計算と、副作用のない労働成果計算を扱う。`jobs.js` の実処理と `ui.js` の予測表示はここを参照し、季節・特性補正を重複実装しない。
- `js/domain/rules.js`
  - 仕事未設定チェックなどで使う共通ルールを扱う。
- `js/domain/personSchema.js`
  - 人物フィールドの方針を定義する。
- `js/data/`
  - 固定データ置き場。辞書、村人生成、襲撃、ランダムイベント、会話データが入る。

新しい仕事、行動、資源、建築、奇跡、状態異常、特性、イベント、襲撃者、ルールなどを追加したり、既存仕様を変更した場合は、必要に応じて `js/data/dictionaryData.js` の用語説明も追加・更新します。プレイヤーが用語検索で確認できる情報と、実装上の仕様がずれないようにしてください。

## 会話アーキテクチャ

通常会話は `js/dialogue/dialogueEngine.js` が入口です。表示側の `js/conversation.js` は `getConversationLine({ character, village })` を呼び、会話エンジンが口調、状態、仕事、季節などから候補を集めて 1 行を選びます。

会話データは `js/data/dialogue/` 配下に分割されています。状態会話、季節会話、仕事会話、妊娠・成長会話、訪問者会話、ランダムイベント会話、口調定義を別ファイルで持ちます。
肉体交換への反応は `js/data/dialogue/exchangeLines.js` に置き、交換の奇跡と落雷による肉体交換で共有します。

詳細な追加ルールは `DIALOGUE_RULES.md` を参照してください。

## 保存と互換性

保存データは `Village` / `Villager` のフィールドに強く依存します。フィールド名の変更、型変更、初期値変更は既存セーブに影響します。

保存関連を変更する場合は、次の点を確認してください。

- 新規フィールドに安全な初期値があるか。
- 古い保存データに存在しないフィールドを読んでも壊れないか。
- 人間関係や口調など、読込時に正規化している処理を通しているか。
- JSON 保存と localStorage 保存の両方で同じ結果になるか。

## 変更時に壊れやすい場所

- 月次処理の順序。
- 襲撃中の `次の月へ` と迎撃モーダルの接続。
- 仕事候補と行動候補の更新。
- 肉体情報と精神情報の混同。
- 口調 fallback によるセリフの不自然な混線。
- 保存データの後方互換性。
- スマホ仮表示のテーブル幅とボタン表示。
