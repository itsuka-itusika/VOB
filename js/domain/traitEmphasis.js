// traitEmphasis.js
// 状態異常の強調表示の分類。村人一覧と作戦会議で同じ色分けを使う。

// 行動が奪われ、療養などへ固定される状態異常。身体か精神かを問わず赤の太字で示す。
// js/domain/jobTables.js の applyForcedActionRestriction が縛る特性と揃える。
export const INCAPACITATING_TRAITS = new Set([
  "塩の柱", "危篤", "重体", "負傷", "疫病", "過労", "産褥", "抑鬱"
]);
// 動けはするが放置できない状態異常。青の太字で示す。
export const IMPAIRING_TRAITS = new Set([
  "疲労", "飢餓", "凍え", "曝露", "臨月", "心労", "失望", "絶望"
]);

export function getTraitEmphasisClass(label) {
  if (INCAPACITATING_TRAITS.has(label)) return "trait-incapacitated";
  if (IMPAIRING_TRAITS.has(label)) return "trait-impaired";
  return "";
}
