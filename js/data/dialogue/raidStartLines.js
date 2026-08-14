export const RAID_MENTAL_TRAIT_REACTIONS = Object.freeze([
  { trait: "戦闘狂", mentalGain: 30, line: ({ name }) => `${name}は襲撃者の姿を見るなり、不敵に笑った。` },
  { trait: "豪傑", mentalGain: 30, line: ({ name }) => `${name}は迫る敵を前に、豪快に笑った。` },
  { trait: "勇猛果敢", mentalGain: 30, line: ({ name }) => `${name}は恐れを見せず、敵へ向かって一歩踏み出した。` },
  { trait: "昼行燈", mentalGain: 20, line: ({ name }) => `普段はぼんやりしている${name}の目つきが変わった。` },
  { trait: "好戦的", mentalGain: 20, line: ({ name }) => `${name}は待ち望んだ戦いを前に、口元を歪めた。` },
  { trait: "勇敢", mentalGain: 20, line: ({ name }) => `${name}は恐怖を押し殺し、武器を握り直した。` },
  { trait: "熱血", mentalGain: 20, line: ({ name }) => `${name}は仲間を奮い立たせるように、声を張り上げた。` },
  { trait: "強気", mentalGain: 10, line: ({ name }) => `${name}は敵を睨み据え、ひるむことなく顎を上げた。` },
  { trait: "粗暴", mentalGain: 10, line: ({ name }) => `${name}は武器を打ち鳴らし、荒々しく敵を威嚇した。` },
  { trait: "暴れ者", mentalGain: 10, line: ({ name }) => `${name}はようやく暴れられると、腕を鳴らした。` }
]);
