// autoAssignSettingsData.js
// 自動割り振り詳細設定の既定値と表示用のラベル。
// 倍率は各資源軸の基本重みに掛かる値で、閾値はその段階の上限（この値以下ならその段階）。

// 食料・資材の閾値は備蓄の月数。食料は月間の食料消費、資材は冬1か月ぶんの資材消費で測る。
export const SUPPLY_STAGE_KEYS = ["danger", "needed", "enough", "excess"];
// 治安の閾値は治安値そのもの。
export const SECURITY_STAGE_KEYS = ["danger", "alert", "safe", "stable"];
// 資金・技術の閾値は所持量そのもの。
export const STOCK_STAGE_KEYS = ["priority", "enough", "excess"];

export const AUTO_ASSIGN_SECTIONS = [
  {
    id: "food",
    label: "食料",
    baseWeight: 1,
    stageKeys: SUPPLY_STAGE_KEYS,
    thresholdUnit: "月",
    thresholdHint: "備蓄が何か月ぶんあるかで区切る（月間の食料消費が1か月ぶん）",
    stageLabels: { danger: "危険", needed: "必須", enough: "十分", excess: "過剰" },
    defaultMultipliers: { danger: 4, needed: 2, enough: 1, excess: 0.6 },
    defaultThresholds: { danger: 1, needed: 3, enough: 6 }
  },
  {
    id: "materials",
    label: "資材",
    baseWeight: 1,
    stageKeys: SUPPLY_STAGE_KEYS,
    thresholdUnit: "月",
    thresholdHint: "備蓄が何か月ぶんあるかで区切る（冬1か月ぶんの資材消費が1か月ぶん）",
    stageLabels: { danger: "危険", needed: "必須", enough: "十分", excess: "過剰" },
    defaultMultipliers: { danger: 4, needed: 2, enough: 1, excess: 0.6 },
    defaultThresholds: { danger: 1, needed: 3, enough: 6 }
  },
  {
    id: "security",
    label: "治安",
    baseWeight: 2,
    stageKeys: SECURITY_STAGE_KEYS,
    thresholdUnit: "",
    thresholdHint: "治安値で区切る。村特性「荒廃」の間は治安値によらず危険として扱う",
    stageLabels: { danger: "危険", alert: "警戒", safe: "安全", stable: "安定" },
    defaultMultipliers: { danger: 3.5, alert: 2.5, safe: 1.5, stable: 0.6 },
    defaultThresholds: { danger: 30, alert: 40, safe: 60 }
  },
  {
    id: "funds",
    label: "資金",
    baseWeight: 0.9,
    stageKeys: STOCK_STAGE_KEYS,
    thresholdUnit: "",
    thresholdHint: "所持量で区切る。手動設定を切っている間は段階を作らず一律に扱う",
    optionalStages: true,
    stageLabels: { priority: "優先", enough: "十分", excess: "過剰" },
    defaultMultipliers: { priority: 1.5, enough: 1, excess: 0.5 },
    defaultThresholds: { priority: 300, enough: 1000 }
  },
  {
    id: "tech",
    label: "技術",
    baseWeight: 0.9,
    stageKeys: STOCK_STAGE_KEYS,
    thresholdUnit: "",
    thresholdHint: "所持量で区切る。手動設定を切っている間は段階を作らず一律に扱う",
    optionalStages: true,
    stageLabels: { priority: "優先", enough: "十分", excess: "過剰" },
    defaultMultipliers: { priority: 1.5, enough: 1, excess: 0.5 },
    defaultThresholds: { priority: 300, enough: 1000 }
  }
];

export const AUTO_ASSIGN_SECTION_BY_ID = new Map(
  AUTO_ASSIGN_SECTIONS.map(section => [section.id, section])
);
