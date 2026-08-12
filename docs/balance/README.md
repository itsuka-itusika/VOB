# バランス設計文書

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
- [baseline-results.md](baseline-results.md): 現行実装の予備調査と将来の基準測定結果。
- [experiment-log.md](experiment-log.md): 変更候補と比較結果の履歴。
- [unresolved-questions.md](unresolved-questions.md): 未決定事項と測定上の障害。

## 既存文書との関係

- [PROJECT_OVERVIEW.md](../../PROJECT_OVERVIEW.md): ゲーム全体と現行システムの概要。
- [WORLDVIEW.md](../../WORLDVIEW.md): 世界観、外部勢力、黙示録の意味。
- [ARCHITECTURE.md](../../ARCHITECTURE.md): 状態管理と月次処理の構造。
- [CODE_REVIEW.md](../../CODE_REVIEW.md): 実装変更時の技術的検証。
- [GAME_ANALYSIS.md](../../GAME_ANALYSIS.md): ゲーム内容とプレイヤー体験の批評方針。
- [GAME_GUIDE_JA.md](../../GAME_GUIDE_JA.md): プレイヤー向けの現行仕様説明。

このディレクトリは既存文書を置き換えません。実装構造は ARCHITECTURE.md、世界観判断は WORLDVIEW.md、技術レビューは CODE_REVIEW.md、内容批評は GAME_ANALYSIS.md を優先します。

## 現在の作業段階

1. 現行実装の初回調査: 完了。
2. 暫定的な測定基準の共同設計: 初稿完了。
3. 方針書の承認: 完了。
4. 最小測定基盤の実装計画: 承認済み。
5. 測定基盤の実装: 初版完了。通常進行、上位襲撃、上位襲撃後復旧を少数試行可能。
6. 予備基準測定: 実施中。正式な1,000回測定と数値調整は未着手。

測定基盤は `tools/balance/index.html` から利用します。ゲーム本体のバランス値はまだ変更していません。敵HPが100を超える場合の切り下げだけは、測定前提となる不具合として修正しました。

## 更新原則

- 実装事実と設計目標を分ける。
- 試行条件を変えた結果同士を直接比較しない。
- 平均値だけでなく分布と極端値を残す。
- 変更候補は一度に広げず、因果関係を追える単位に分ける。
- 自動生成した候補を自動で正式採用、コミット、プッシュしない。
- 既存の未コミット変更を依頼外で修正しない。
