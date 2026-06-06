export const MESSENGER_PASS_SECRET_TREASURE_ID = "messenger_pass";

export const TUTORIAL_TASKS = [
  {
    id: "produce_food",
    title: "食料の生産",
    warningText: "チュートリアル: 食料の生産∶農作業、狩猟、漁、採集で食料を生産しましょう",
    conditionText: "農作業、狩猟、漁、採集で食料を生産する",
    descriptionText: "食料は村人が毎月消費する基本資源です。農作業、狩猟、漁、採集で増やせます。",
    rewardText: "食料+50",
    reward: { resource: "food", amount: 50 }
  },
  {
    id: "produce_materials",
    title: "資材の生産",
    warningText: "チュートリアル: 資材の生産∶伐採、採集で資材を生産しましょう",
    conditionText: "伐採、採集で資材を生産する",
    descriptionText: "資材は建築や冬の備えに使う基本資源です。伐採、採集で増やせます。",
    rewardText: "資材+50",
    reward: { resource: "materials", amount: 50 }
  },
  {
    id: "build_barn",
    title: "納屋の建築",
    warningText: "チュートリアル: 納屋の建築∶建築コマンドから納屋を建てましょう",
    conditionText: "建築コマンドから納屋を建てる",
    descriptionText: "建築は資材や資金を使って村の機能を広げるコマンドです。建築を進めると規模が上がり、村の発展段階が変わります。",
    rewardText: "資金+50",
    reward: { resource: "funds", amount: 50 }
  },
  {
    id: "use_miracle",
    title: "奇跡の行使",
    warningText: "チュートリアル: 奇跡の行使∶奇跡コマンドから奇跡を使いましょう",
    conditionText: "奇跡コマンドから奇跡を使う",
    descriptionText: "奇跡は魔素を使って神の力を行使するコマンドです。資源獲得や回復などに使えます。",
    rewardText: "秘宝「伝令神の手形」",
    reward: { secretTreasureId: MESSENGER_PASS_SECRET_TREASURE_ID }
  }
];
