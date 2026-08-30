# バランス設計文書

> **旧仕様の記録**: バランス測定基盤（`tools/balance/`）と実測結果の文書は役目を終えたため削除しました。
> ここに残るのは当時の設計方針だけで、現行の仕様とは一致しません。
> 数値を参照する前に、必ず現行コードの実装を確認してください。

このディレクトリは、Village of Bacchus のゲームバランスを測定し、人間が判断し、必要に応じて調整するための方針をまとめます。

ここに記載する目標値は、2026年8月12日時点では正式仕様ではありません。現行実装の調査とユーザーとの対話から作った暫定仮説であり、測定結果に応じて見直します。ゲーム内の実際の挙動と食い違う場合は、まずコード上の事実を確認し、事実と目標を混同しないでください。

## 文書の位置づけ

記述は次の4種類に分けます。

- 実装事実: 現行コードまたは既存文書から確認できる内容。
- 暫定目標: 将来の測定で妥当性を検証する判断基準。
- 実測結果: リビジョン、条件、乱数、試行数を記録した結果。
- 未決定事項: 人間の判断または追加測定が必要な内容。

数値を引用するときは、どの種類に属するかを明記します。暫定目標を現行仕様や正式な変更指示として扱ってはいけません。

## 文書一覧

- [design-goals.md](design-goals.md): 目指すプレイ体験と対象範囲。
- [player-models.md](player-models.md): 初心者、標準、熟練者の行動モデル。
- [metrics.md](metrics.md): 詰み、安定復帰、ヌルゲー化、襲撃結果などの測定定義。
- [simulation-scenarios.md](simulation-scenarios.md): 通常進行、襲撃、黄金像、黙示録の試行条件。
- [parameter-policy.md](parameter-policy.md): 調整対象、依存関係、自動変更の制限。
- [measurement-foundation-plan.md](measurement-foundation-plan.md): 最小測定基盤の段階的な実装計画。
- [unresolved-questions.md](unresolved-questions.md): 未決定事項と測定上の障害。

実測結果（`baseline-results.md`、`raid-stress-results.md`、`relationship-simulation-results.md`、`all-couples-simulation-results.md`）と実験ログ（`experiment-log.md`）は、測定時点の仕様に紐づく古い数値のため削除しました。必要なら Git 履歴から辿れます。

## 既存文書との関係

- [PROJECT_OVERVIEW.md](../../PROJECT_OVERVIEW.md): ゲーム全体と現行システムの概要。
- [WORLDVIEW.md](../../WORLDVIEW.md): 世界観、外部勢力、黙示録の意味。
- [ARCHITECTURE.md](../../ARCHITECTURE.md): 状態管理と月次処理の構造。
- [CODE_REVIEW.md](../../CODE_REVIEW.md): 実装変更時の技術的検証。
- [GAME_GUIDE_JA.md](../../GAME_GUIDE_JA.md): プレイヤー向けの現行仕様説明。

このディレクトリは既存文書を置き換えません。実装構造は ARCHITECTURE.md、世界観判断は WORLDVIEW.md、技術レビューは CODE_REVIEW.md を優先します。

## 測定基盤について

測定基盤 `tools/balance/` は役目を終えたため削除しました。再び測定が必要になった場合は、この文書群の方針を土台に組み直してください。

ゲーム本体側の測定用フック（`js/balance/seedBootstrap.js`、`js/balance/simulationOptions.js`、`?balanceMode=1` での乱数固定とイベント抑制）は残してあります。

## 更新原則

- 実装事実と設計目標を分ける。
- 試行条件を変えた結果同士を直接比較しない。
- 平均値だけでなく分布と極端値を残す。
- 変更候補は一度に広げず、因果関係を追える単位に分ける。
- 自動生成した候補を自動で正式採用、コミット、プッシュしない。
- 既存の未コミット変更を依頼外で修正しない。
