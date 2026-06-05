export const MESSENGER_PASS_SECRET_TREASURE_ID = "messenger_pass";

export const TUTORIAL_TASKS = [
  {
    id: "produce_food",
    title: "食料を生産する",
    warningText: "チュートリアル: 食料を生産する",
    conditionText: "村人の行動により食料を1以上生産する",
    rewardText: "食料+50",
    reward: { resource: "food", amount: 50 }
  },
  {
    id: "produce_materials",
    title: "資材を生産する",
    warningText: "チュートリアル: 資材を生産する",
    conditionText: "村人の行動により資材を1以上生産する",
    rewardText: "資材+50",
    reward: { resource: "materials", amount: 50 }
  },
  {
    id: "build_barn",
    title: "納屋を建てる",
    warningText: "チュートリアル: 納屋を建てる",
    conditionText: "納屋を建築する",
    rewardText: "資金+50",
    reward: { resource: "funds", amount: 50 }
  },
  {
    id: "use_miracle",
    title: "奇跡を使う",
    warningText: "チュートリアル: 奇跡を使う",
    conditionText: "いずれかの奇跡を使用する",
    rewardText: "秘宝「伝令神の手形」",
    reward: { secretTreasureId: MESSENGER_PASS_SECRET_TREASURE_ID }
  }
];
