# 画像アトラス化 引き継ぎ書・作業指示書

itch.io アップロードのためのファイル数削減と容量節約として、顔グラフィックのスプライトシート（アトラス）化を行う。この文書は事前調査と方針決定を済ませた状態からの引き継ぎであり、実装はまだ何も行っていない。作業ブランチは `AGENTS.md` の規定どおり `codex/vob-next`。

## 1. 目的と制約

- itch.io の HTML5 ゲームは **zip 内 1,000 ファイル上限**がある。現状の画像は 1,658 ファイルあり、そのままではアップロードできない。ファイル数削減が必須。
- 容量削減は副目的。現状 `images/` は 164MB。
- ゲームはビルドツールなしの素の ES modules 構成で、`file://` 直開きでも動くこと（fetch で JSON を読む構成は CORS で壊れるため不可）。

## 2. 事前調査の結果（2026-08 時点）

| 項目 | 値 |
| --- | --- |
| 画像総数 | 1,658 ファイル / 164MB |
| 顔グラ `images/portraits/` | **1,628 ファイル / 140MB**。ほぼ全て 256×256 PNG（平均 84KB） |
| 顔グラの例外 | 塩の柱 `salt/SALT1-4.png` が 1254×1254（計6.6MB）、`system/` に 900×300 が2枚、SVG が2枚（CHILD_SHADOW） |
| イベント絵 `images/events/` | 13 ファイル / 23MB（うち apocalypse 9枚で20MB）。大判・モーダル全面表示用 |
| 季節・祭 `images/seasons/` `images/festivals/` | 9 ファイル / 1.7MB の JPG |
| 村規模背景・OP（`images/` 直下） | 8 ファイル / 2.5MB。CSS の `url()` から参照 |
| 顔グラの表示サイズ | 最大 200×200（会話モーダル `.portrait-area`）、多くは 72px。256px 源泉で十分 |

重要な構造的事実:

- 顔グラのパス解決は **`js/data/portraitPaths.js` に一元化されている**。`getPortraitAssetPath(key)`（キー→パス）と `getPortraitAssetPathForCharacter(character)`（年齢変種・塩の柱・欠番フォールバック込み）の2関数が出口。`js/util.js` の `getPortraitPath` は後者の別名。
- セーブデータが持つのは `portraitFile` のキー（例 `"D12.png"`）であり、パスではない。**表示方式を変えてもセーブ互換に影響しない**。キー正規化（`normalizePortraitKey`）・実在判定（`isKnownPortraitKey`）は `saveLoad.js` と `domain/portraitHistory.js` からも使われているため、**これらの関数は残す**。
- グループ→フォルダ対応は `PORTRAIT_GROUP_FOLDERS`、各グループの枚数上限は `NUMBERED_PORTRAIT_LIMITS`、old/young 変種の上限は `AGE_VARIANT_PORTRAIT_LIMITS` にある。変種ファイルは `<フォルダ>/<old|young>/<KEY>_<変種>.png` の形。

### 呼び出し箇所インベントリ（表示経路の全数）

`portrait.src = ...` 形式（DOM 操作）:

- `js/ui.js:798`（村人詳細）
- `js/conversation.js:139-151`（会話モーダル、onerror フォールバック付き）
- `js/miracles.js:299, 1421, 1517, 1524`
- `js/wishes.js:480-483`
- `js/buildingRequests.js:484, 556`
- `js/secretTreasures.js:280-283`
- `js/raid.js:1584`
- `js/raidWarningModal.js:121-124`
- `js/randomEventModal.js:89`
- `js/history.js:830`（肖像履歴のナビゲーション。`makePortraitStep` が `path` を組む）

テンプレート文字列内の `<img src="...">`:

- `js/relationships.js:818, 1036`
- `js/reproduction.js:1051`
- `js/miracles.js:1303, 1365, 1367`
- `js/adventurerQuests.js:291`
- `js/raid.js:1353→1437`（`person.portrait` にパスを一時保存して結果モーダルで表示）
- `js/history.js:813`（`data-personal-history-portrait`）

パスを返すだけの関数:

- `js/heresyInquisition.js:144`

`onerror` で default.png に落とす処理が計11箇所ある。アトラス化後はマニフェストで実在が分かるため、移行した箇所の onerror は削除してよい。

## 3. 決定済み方針（ユーザー承認済み）

1. **顔グラをグループ（フォルダ）単位のスプライトシートにまとめる**。old/young 変種も同じグループのシートに同居させる。
2. シートは **WebP（品質80前後）**、**最大 2048×2048（256px タイル 8×8 = 64枚）**。溢れるグループは複数シートに分割。4096² はデコードメモリ（64MB/枚）とモバイル GPU を考慮して使わない。
3. 塩の柱は 256×256 へ縮小してシートに入れる。babies / system / wolf など小グループは misc シートにまとめてよい。SVG 2枚はそのまま。
4. マニフェストは **JSON ではなく生成 JS モジュール**（`file://` 対応のため）。
5. 表示は `<img>` ではなく **`background-image` + `background-position`（%指定）を当てた div** に置き換える。
6. イベント絵・季節・祭はアトラス化せず **WebP 変換（+必要なら長辺リサイズ）のみ**。村規模背景と OPENING は CSS 参照なので同様に変換だけ。
7. 生成ツールは **Python + Pillow** で `tools/atlas/` に置く。実行時コードには依存を増やさない。
8. **原本 PNG はリポジトリに残す**（マスターデータ）。生成物（シート+マニフェスト）もコミットする。itch 用 zip を作るパッケージングスクリプトで原本を除外する。

期待効果: 画像ファイル数 1,658 → 70 前後、容量 164MB → 20〜30MB 程度。

## 4. 実装仕様

### 4.1 生成ツール `tools/atlas/build_portrait_atlas.py`

- 入力: `images/portraits/` 以下の全 PNG。
- グループごとに固定順（ファイル名の自然順。base → old → young の順など、**決定的な順序**）でタイルを詰める。実行のたびに配置が変わらないこと。
- 256×256 でない画像は 256×256 に縮小（塩の柱、900×300 の2枚は中央クロップか letterbox かを目視で判断）。
- 出力:
  - `images/atlas/<group>-<n>.webp`（例 `D-1.webp`, `D-2.webp`, `misc-1.webp`）
  - `js/data/portraitAtlas.generated.js` — 以下の形の生成モジュール:

```js
// build_portrait_atlas.py が生成。手で編集しない。
export const PORTRAIT_ATLAS_TILE = 256;
export const PORTRAIT_ATLAS_SHEETS = {
  "D-1": { url: "images/atlas/D-1.webp", cols: 8, rows: 8 },
  ...
};
// キーは normalizePortraitKey 後の値。変種は "D12_old.png" のような合成キー。
export const PORTRAIT_ATLAS_MAP = {
  "D12.png": { sheet: "D-1", col: 3, row: 1 },
  "D12_old.png": { sheet: "D-2", col: 0, row: 5 },
  ...
};
```

- ツールは再実行で全出力を作り直す冪等な作りにする。出力の枚数・総容量をログに出す。

### 4.2 ランタイム `js/data/portraitAtlas.js`（手書き）

- `resolvePortraitSprite(character)` : `portraitPaths.js` の既存ロジック（キー正規化、年齢変種の選択、欠番時のランダム振り直し、塩の柱のハッシュ選択）を再利用してキーを確定し、`PORTRAIT_ATLAS_MAP` から `{ sheet, col, row }` を引く。キーが無ければ default.png のスプライトを返す。
  - **注意**: 年齢変種・欠番の判定は現在 `NUMBERED_PORTRAIT_LIMITS` 等の手書きマップに依存している。初回はこのロジックを触らず、確定したキー（変種込み）でマニフェストを引き、**引けなかったら変種なしキー → default の順に落とす**だけでよい。手書きマップのマニフェスト駆動化はやらない（変更範囲を広げない）。
- 表示ヘルパー2種:
  - `applyPortraitToElement(el, character)` — 既存の `portrait.src = ...` 箇所の置き換え用。el に `background-image` / `background-size` / `background-position` を設定。
  - `getPortraitSpriteHtml(character, { size, alt, extraStyle })` — テンプレート文字列用。`role="img"` と `aria-label` を付けた div を返す。
- %指定の計算（均等グリッドなので表示サイズ非依存）:
  - `background-size: (cols*100)% (rows*100)%`
  - `background-position: (col/(cols-1)*100)% (row/(rows-1)*100)%`（cols または rows が 1 のときは 0%）
- 共通 CSS として `.portrait-sprite { background-repeat: no-repeat; }` 程度を `css/styles.css` に追加。既存の `.portrait-area img { object-fit: cover }` 系の枠は、置き換えた div が同じ寸法で収まるか個別に確認する。

### 4.3 呼び出し箇所の移行

- インベントリ（§2）の全箇所を上記ヘルパーへ置き換える。`<img>` → div になるため、`alt` は `aria-label` へ移す。
- `js/raid.js:1353` は `person.portrait` にパス文字列を保存している。スプライト情報（またはキー）を保存する形に変え、表示側（1437行）を合わせて直す。
- `js/history.js` の肖像履歴は `path` / `hasImage` を持つ step 構造。`path` をスプライト情報に置き換え、ナビゲーション時の `portrait.src = step.path`（830行）も合わせる。
- `js/heresyInquisition.js:144` は返り値の使われ方を確認してから合わせる。
- 移行が終わった箇所の `onerror` フォールバックは削除。**`portraitPaths.js` 自体と `getPortraitAssetPath` は消さない**（saveLoad などキー処理の利用者がいる。旧パス関数が最終的に未使用になったら、その時点で削除してよいが、キー正規化・実在判定は必ず残す）。

### 4.4 イベント絵ほかの変換

- `images/events/`（13枚）、`images/seasons/`（4枚）、`images/festivals/`（5枚）、`images/` 直下の村規模7枚と `OPENING.png` を WebP 化。参照箇所は `js/apocalypse.js` `js/events.js` `js/festivalModal.js` `js/headmanElection.js` `js/secretTreasureEvents.js` と `css/styles.css`（`--village-scale-image` と OPENING 背景）。拡張子の書き換えのみで済むはず。
- apocalypse の PNG は写真調なので WebP 化の効果が大きい（20MB → 数MB想定）。表示品質は目視確認。

### 4.5 itch 用パッケージング `tools/package_itch.py`（または .sh）

- `index.html` / `css/` / `js/` / `images/` から **`images/portraits/`（原本）を除外**し、`images/atlas/` を含めて zip を作る。`tools/` `docs/` `output/` `tmp/` `*.md` も除外。
- 出力後に zip 内のファイル数と容量を表示し、1,000 ファイル未満であることを確認する。

## 5. 作業手順（この順でコミットを分ける）

1. 生成ツール + 生成物（シート・マニフェスト）。この時点ではゲームは無改修で動く。生成結果の枚数・容量を報告。
2. `portraitAtlas.js` とヘルパー、CSS 追加。
3. 呼び出し箇所の置き換え（会話モーダル → 村人詳細 → 各モーダル、と経路単位で分けてよい）。
4. イベント絵ほかの WebP 化と参照書き換え。
5. パッケージングスクリプト。
6. `ARCHITECTURE.md` に画像アトラスの節を追記（生成ツールの回し方、顔グラ追加時の手順=「PNG を置いてツールを再実行」)。

## 6. 検証チェックリスト

- 変更した JS 全部に `node --check` 相当の構文確認。
- ブラウザ（HTTP サーバ経由と `file://` 直開きの両方）で:
  - 村人詳細・会話モーダル・人間関係・肖像履歴・襲撃（警告モーダル/迎撃結果）・奇跡・お願い・建築依頼・ランダムイベント・捕虜、の各顔グラ表示
  - old/young 変種持ち（幼児・老人の身体）と塩の柱の表示
  - 存在しないキーを持つ古いセーブの読み込み → default 表示に落ちること
  - 黙示録絵・季節絵・祭絵・村規模背景・OP 画面
- PC 表示と `スマホ仮` 表示の両方で枠崩れがないこと。
- パッケージング出力のファイル数 < 1,000、容量を報告。

## 7. リスク・注意点

- 表示中のシートはデコード済みで保持される。2048² 上限・グループ分割はこのための決定なので変えない。
- `background-position` の%計算は端タイル（col=cols-1）で誤差が出やすい。タイルが 256 固定・グリッド均等なら%方式で正確だが、目視で1pxズレがないか確認する。
- div 置き換えで `object-fit: cover` 相当の挙動（正方形でない枠）が必要な箇所がないか、枠の CSS を個別確認。
- 顔グラの追加ワークフローが「PNG を置く」→「PNG を置いて `build_portrait_atlas.py` を回す」に変わる。ARCHITECTURE.md への追記を忘れない。

## 8. 裁量に任せる点

- シート内のタイル詰め順・複数シートへの分割アルゴリズムの詳細。
- misc シートに何を入れるかの線引き。
- WebP 品質値の微調整（画質と容量の目視トレードオフ）。
- パッケージングスクリプトの言語（Python/シェルどちらでも）。
