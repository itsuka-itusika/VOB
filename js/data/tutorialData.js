export const MESSENGER_PASS_SECRET_TREASURE_ID = "messenger_pass";
export const NECTAR_SECRET_TREASURE_ID = "nectar";

export const TUTORIAL_ALL_COMPLETE_REWARD = {
  rewardText: "秘宝「伝令神の手形」、秘宝「ネクタル」",
  reward: { secretTreasureIds: [MESSENGER_PASS_SECRET_TREASURE_ID, NECTAR_SECRET_TREASURE_ID] }
};

export const TUTORIAL_TASKS = [
  {
    id: "produce_food",
    title: "食料の生産",
    warningText: "チュートリアル: 食料の生産∶農作業、狩猟、漁、採集で食料を生産しましょう",
    conditionText: "農作業、狩猟、漁、採集で食料を生産する",
    descriptionText: "食料は毎月減っていく。切らせば村人が飢えるぞ。農作業でも狩りでも漁でも採集でもいい、とにかく食わせろ。",
    rewardText: "食料+50",
    reward: { resource: "food", amount: 50 }
  },
  {
    id: "produce_materials",
    title: "資材の生産",
    warningText: "チュートリアル: 資材の生産∶伐採、採集で資材を生産しましょう",
    conditionText: "伐採、採集で資材を生産する",
    descriptionText: "資材は建物にも冬の備えにも要る。村人を凍えさせたくないなら、伐採と採集で溜めておくことだ。",
    rewardText: "資材+50",
    reward: { resource: "materials", amount: 50 }
  },
  {
    id: "build_barn",
    title: "納屋の建築",
    warningText: "チュートリアル: 納屋の建築∶建築コマンドから納屋を建てましょう",
    conditionText: "建築コマンドから納屋を建てる",
    descriptionText: "資材と資金を積めば、村に新しい建物が増える。建てるほど村の規模は上がり、やがて村そのものが姿を変えるだろう。",
    rewardText: "資金+50",
    reward: { resource: "funds", amount: 50 }
  },
  {
    id: "observe_villagers",
    title: "村人の観察",
    warningText: "チュートリアル: 村人の観察∶村人一覧の顔や名前を選択し、村人の様子を見ましょう",
    conditionText: "村人一覧の顔写真や名前を選択し、村人の様子を見る",
    descriptionText: "信じる民あっての神様だからな。時々そうして村人たちの様子を見てやることだ。",
    rewardText: "魔素+20、神威+2",
    reward: { resource: "mana", amount: 20, divine: 2 }
  },
  {
    id: "use_miracle",
    title: "奇跡の行使",
    warningText: "チュートリアル: 奇跡の行使∶奇跡コマンドから奇跡を使いましょう",
    conditionText: "奇跡コマンドから奇跡を使う",
    descriptionText: "奇跡は魔素を糧に神の力を振るう業だ。実りを呼ぶのも傷を癒すのも思うがまま。出し惜しみするなよ。",
    rewardText: "魔素+50",
    reward: { resource: "mana", amount: 50 }
  }
];
