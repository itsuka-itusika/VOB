# Codex への引き継ぎ

2026/10/14 時点、`codex/vob-next` の 3302155 までを前提にした引き継ぎです。作業ルールの原本は `AGENTS.md` です。この文書は、ルールを実際に回すときの注意点と、これまでのやり取りで決まった方針をまとめたものです。

## 1. 前提

- リポジトリ: https://github.com/itsuka-itusika/VOB
- 作業ブランチ: `codex/vob-next`。コミットとプッシュは常にこのブランチへ行う。プルリクエストはユーザーに頼まれたときだけ作る。
- 現在の版: `ver.1.031`（`index.html` のタイトルにだけ書かれている）
- 作業を始める前に `git fetch origin` と `git pull --ff-only origin codex/vob-next` で最新を取る。ユーザー自身や別のエージェントも同じブランチへプッシュしている。
- 最近のコミットは `feat:` / `fix:` / `docs:` の接頭辞を付けた日本語の件名が多い。

## 2. 進め方の方針（ユーザーとのやり取りで固まったもの）

- 返答・文書・コミットは日本語で書く。
- 変更は依頼の範囲に絞る。ついでの整理や命名変更はしない。気づいた無関係な問題は、直さずに報告で指摘する。
- 解釈が分かれる依頼は、選んだ解釈を報告に明記する。仕様の判断が大きく分かれるときは確認する。
- 報告には次を必ず載せる。
  - 実装したセリフや文章は全文（口調ごとの一覧）。概要だけで済ませない。
  - 用語辞典やツールチップの本文を変えた場合は、その本文。数値やルールの変更は変更前と変更後。
  - 何をどう確かめたか。確かめられなかったことも書く。
  - 配布済みの zip に入っていない変更があるかどうか。
- ユーザーが「没」「戻して」と言った変更は、`git revert` で取り消すコミットを足してプッシュする。強制プッシュで履歴を消すのは、ユーザーが明示したときだけ。
- 画像で見た目の案を求められることがある（例：家系図の年齢表記）。その場合はスクリーンショットを撮って見せてから決めてもらう。

## 3. コード上の注意点

### 全体

- 入口は `index.html` と `js/app.js`。共有状態は `js/main.js` の `theVillage`、`js/classes.js` の `Village` / `Villager`。
- 固定文言や表データは `js/data/` 配下に置く。セリフは `js/data/dialogue/` に置き、`js/dialogue/dialogueEngine.js` から引く。
- 新しい要素や仕様変更では、`js/data/dictionaryData.js` の用語説明と、影響する Markdown（`PROJECT_OVERVIEW.md`、`ARCHITECTURE.md`、`DIALOGUE_RULES.md`、`GAME_GUIDE_JA.md` など）も合わせて直す。

### 口調と見た目

- **口調は精神側、顔グラは肉体側で決まる。** 精神年齢や精神の性別で顔グラを決めない（ユーザーから明示の指摘あり）。
- 顔の年齢差分は `js/data/portraitPaths.js` の `getBodyAgePortraitVariant` が肉体特性（赤子・幼児・老人）から選ぶ。赤子は `portraitFile` 自体が赤子画像になっている。
- 狼とゴブリンは特殊口調。セリフ表に `狼` / `ゴブリン`（または `wolf` / `goblin`）のキーがないと、汎用の4行（`toneProfiles.js` の `SPECIAL_DIALOGUE_FALLBACK_LINES`）に落ちる。新しいセリフ表を足すときは、この2口調のキーも用意する。

### 肉体交換と肖像

- 交換は `js/exchange.js` の `doExchange`。交換直後の反応のために、保存されない一時プロパティを付ける。
  - `lastBodyExchangeFromOwnBody`: 生まれ持った体から出た
  - `lastBodyExchangeReturnedToOwnBody`: 別の体から生まれ持った体へ戻った（103281b で追加。帰還セリフは `BODY_RETURN_REACTION_LINES`）
- 個人記録の過去の肖像は `pastPortraitFiles`（`js/domain/portraitHistory.js`）。5a04806 から、記録する時点の肉体の年頃（幼児・老人）を `bodyTraits` として残し、その絵で表示する。それ以前に記録した「元の身体」は、その身体を今持っている人が幼児の場合だけ幼児の絵で補う。肉体は若返らないので、その時だけは当時も幼児だったと言える。古い「過去の姿」の年頃は補えない。

### ゴブリンモード

- 定数と判定は `js/domain/gameMode.js` にまとまっている（`isGoblinMode`、`isGoblinRaid`、`isGoblinMajorityVillage` など）。
- 精鋭のゴブリン訪問者は、村の規模に応じて低い確率で出る。豊かな村（段階4）以降はリーダー相当、旅人の立ち寄る村（段階3）以降は射手相当。定義は `createVillagers.js` の `GOBLIN_ELITE_ROLES`。普通の訪問者と表記で区別しないのは仕様。
- ゴブリン襲撃の重み付けにはスタンピードも含める。

### その他の決定済み仕様

- 家系図は `js/familyTree.js`。年齢は肉体と精神が同じなら「26歳」、違うときだけ「45歳/62歳」（肉体/精神）と出す。顔を押すと、その人物の個人記録（村を去った人物は過去帳の記録）を開く。
- 黙示録クリア後は家屋の建設数の上限がない。クリア済みの既存セーブにもそのまま適用される。

## 4. 検証のしかた

- JavaScript を変えたら、変えたファイルに `node --check`。
- ブラウザ確認は、リポジトリ直下で `python -m http.server 8765` を立てて `http://localhost:8765/index.html` を開く。ES modules なので `file://` では動かない。
- 起動画面の「つづきから（JSON読込）」で大きなセーブを読み込むと、多人数での表示崩れや例外を見つけやすい。開発者ツールのコンソールで次のように直接呼んで確かめられる。
  - `const { theVillage } = await import('./js/main.js')`
  - `(await import('./js/exchange.js')).doExchange(a, b, theVillage)` などで、交換を起こす
  - `(await import('./js/history.js')).openPersonalHistoryModal(theVillage, person)` で個人記録を開く
- 修正前後で見比べたいときは、`git worktree add --detach <別フォルダ> <修正前のコミット>` で修正前の版を別ポートで立てると、同じセーブで比べられる。
- 保存形式に触れたら、古い JSON セーブを読み込めることと、JSON 保存→読込で新しい項目が残ることを確かめる。
- UI を変えたら、文字のはみ出しと、スマホ幅での崩れを見る。

## 5. 版上げと夢現用 zip の作り方

### 版を上げる場合

1. `index.html` のタイトルの `ver.x.xxx` を書き換える。版の表記はここ1か所だけにする。zip の作成ツールは、一致がちょうど1件でないと止まる。
2. `Readme.txt` と `Readme_mugen.txt` の両方の「更新履歴」に、`2026/10/8 ver.1.021` の形で日付・版・変更点を足す。
   - `Readme_mugen.txt` は、未プレイの人が先に読む前提で終盤の内容を伏せた版。同じ変更でも書き方を変えている（例：奴隷商人を「訪問者の種類を追加」と書く）。ネタバレになる名前や仕組みは書かない。
   - 小さな修正を履歴に載せるかは、ユーザーに確認する。版を据え置いて zip だけ作り直す依頼もある。

### zip を作る

リポジトリ直下で次を実行する（Windows なら `py tools\package_mugen.py --no-images`）。

```
python tools/package_mugen.py --no-images
```

- 出力先は `output/village-of-bacchus-mugen-v1.021-no-images.zip`。版の部分は `index.html` から読む。`output/` は `.gitignore` 済みなので、コミットしない。
- これまでユーザーに渡してきたのは、画像を入れない `--no-images` 版。画像は受け取った側が `images/` フォルダを手で足す。`--no-images` を外すと画像込み（数十MB）になる。出力先は位置引数で変えられる。
- zip の中身は `index.html`（Google Analytics の計測タグを外したもの）、`css/`、`js/`、`Readme_mugen.txt` を `Readme.txt` に名前を変えたもの。ゲームから読まない `js/data/dialogue/basicConversationLines.js` は除外される。
- 作ったら展開して、次を確かめてから渡す。
  - タイトルの版表記
  - 今回の変更が入っていること（変えたファイルの中身を検索する）
  - `index.html` に `gtag` が残っていないこと
  - 出力の最後に `Google Analytics: removed` と `Version: ver.x.xxx` が表示されていること

### 配布状況

- いま配っている夢現用 zip は ver.1.031（訪問者の交換時のセリフ修正まで）。版表記は ver.1.022 の次から小数2桁の ver.1.03 になった。
- 5a04806（個人記録の過去の肖像を当時の年頃の絵で出す修正）は zip に入っているが、更新履歴には書いていない。

## 6. 保留・未整理の事項

- 修正前に記録された「過去の姿」の年頃（幼児・老人）は復元できない。
- 帰還セリフの機能は 6431291 で一度入れて没にし、bf009ef で取り消した。その後、103281b で別の実装が入っている。今後触る場合は 103281b の側（`BODY_RETURN_REACTION_LINES`、`lastBodyExchangeReturnedToOwnBody`）を正とする。
