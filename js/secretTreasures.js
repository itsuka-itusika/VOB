import { doExchange } from "./exchange.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { recordMarriageHistory } from "./history.js";
import { openPanFluteExchangeModal, showMarriageMiracleModal, showMiracleResultModal } from "./miracles.js";
import { startRaidEvent } from "./raidStart.js";
import { addRelationship, removeRelationship, addSpouseRelationships } from "./relationships.js";
import { updateChildGrowthStage } from "./reproduction.js";
import { clampValue, round3 } from "./util.js";
import { updateUI } from "./ui.js";
import { addAcquiredStat, syncEffectiveStats } from "./domain/statLayers.js";

const SEASON_TRAITS_TO_REMOVE = ["夏", "秋", "冬", "冷夏", "飛蝗", "厳冬", "疫病流行"];
const BAD_BODY_TRAITS = ["負傷", "疲労", "過労", "飢餓", "凍え", "病気", "疫病", "産褥", "危篤"];
const BAD_MIND_TRAITS = ["心労", "抑鬱"];
const SECRET_TREASURE_SELL_PRICES = {
  persephone_statue: 300,
  abundance_horn: 300,
  armless_angel: 200,
  golden_arrow: 150,
  golden_apple: 150,
  nectar: 300,
  strange_calculator: 300,
  serpent_staff: 500,
  chronos_elixir: 500,
  old_priest_statue: 100,
  pan_flute: 300,
  grotesque_portrait: 500,
  golden_mask: 300,
  blue_stone_tablet: 150
};

function getVillagers(village) {
  return Array.isArray(village.villagers) ? village.villagers : [];
}

function randFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickTwoRandom(items) {
  if (items.length < 2) return [];
  const firstIndex = Math.floor(Math.random() * items.length);
  let secondIndex = Math.floor(Math.random() * (items.length - 1));
  if (secondIndex >= firstIndex) secondIndex += 1;
  return [items[firstIndex], items[secondIndex]];
}

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getPanFluteCandidates(village) {
  return [
    ...getVillagers(village),
    ...(Array.isArray(village.visitors) ? village.visitors : []),
    ...(Array.isArray(village.raidEnemies) ? village.raidEnemies : [])
  ];
}

function pickPanFlutePairs(village) {
  const outsiders = [
    ...(Array.isArray(village.visitors) ? village.visitors : []),
    ...(Array.isArray(village.raidEnemies) ? village.raidEnemies : [])
  ];
  const selected = [];
  if (outsiders.length > 0) selected.push(randFrom(outsiders));

  const remaining = getPanFluteCandidates(village).filter(person => !selected.includes(person));
  selected.push(...shuffled(remaining).slice(0, 6 - selected.length));

  const pairedTargets = shuffled(selected);
  return [
    [pairedTargets[0], pairedTargets[1]],
    [pairedTargets[2], pairedTargets[3]],
    [pairedTargets[4], pairedTargets[5]]
  ];
}

function forceMarriage(a, b, village) {
  removeRelationship(a, `恋人:${b.name}`);
  removeRelationship(b, `恋人:${a.name}`);
  addRelationship(a, "既婚");
  addRelationship(b, "既婚");
  addSpouseRelationships(a, b);
  recordMarriageHistory(village, a, b, { source: "秘宝" });
  a.happiness = clampValue(a.happiness + 50, 0, 100);
  b.happiness = clampValue(b.happiness + 50, 0, 100);
  village.log(`【秘宝】黄金の矢により${a.name}と${b.name}が結ばれました`);
}

function showSecretTreasureResult(village, title, message, people = []) {
  showMiracleResultModal(village, title, message, people, { allowEmpty: true });
}

function restoreBadStatus(person, village, options = {}) {
  const recovered = [];
  const excludedTraits = Array.isArray(options.excludeTraits) ? options.excludeTraits : [];
  person.bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
  person.mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];

  BAD_BODY_TRAITS.forEach(trait => {
    if (excludedTraits.includes(trait)) return;
    if (!person.bodyTraits.includes(trait)) return;
    recovered.push(trait);
    person.bodyTraits = person.bodyTraits.filter(item => item !== trait);
    if (trait === "疫病") person.hp = clampValue(round3(person.hp / 0.5), 0, 100);
    if (trait === "産褥") person.postpartumMonths = 0;
  });

  BAD_MIND_TRAITS.forEach(trait => {
    if (excludedTraits.includes(trait)) return;
    if (!person.mindTraits.includes(trait)) return;
    recovered.push(trait);
    person.mindTraits = person.mindTraits.filter(item => item !== trait);
  });

  if (options.fullHp) person.hp = 100;
  syncEffectiveStats(person);
  refreshJobTable(person, village);
  if (!person.actionTable.includes(person.action)) {
    person.action = person.actionTable.includes("休養") ? "休養" : (person.actionTable[0] || "なし");
  }
  return recovered;
}

function restoreLowVitals(person) {
  const recovered = [];
  if ((Number(person.hp) || 0) <= 33) {
    person.hp = 34;
    recovered.push("体力を34まで回復");
  }
  if ((Number(person.mp) || 0) <= 33) {
    person.mp = 34;
    recovered.push("メンタルを34まで回復");
  }
  return recovered;
}

function applyEverSpring(village) {
  village.villageTraits = (village.villageTraits || []).filter(trait => !SEASON_TRAITS_TO_REMOVE.includes(trait));
  if (!village.villageTraits.includes("春")) village.villageTraits.push("春");
  village.log("【秘宝】冥王妃の神像を使いました。村に常春の気配が定着しました");
  showSecretTreasureResult(village, "冥王妃の神像", "村に穏やかな春の気配が定着しました。", getVillagers(village));
}

function applyAbundance(village) {
  village.villageTraits = village.villageTraits || [];
  village.villageTraits.push("豊穣");
  village.log("【秘宝】豊穣の角を使いました。対象生産の成果と醸造の食料獲得2倍を1ヶ月付与");
  showSecretTreasureResult(village, "豊穣の角", "畑と森、水辺と蔵に豊かな気配が満ちました。", getVillagers(village));
}

function applyNike(village) {
  getVillagers(village).forEach(person => {
    person.mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
    if (!person.mindTraits.includes("ニケ")) {
      person.mindTraits.push("ニケ");
    }
    person.nikeMonths = 0;
    syncEffectiveStats(person);
    refreshJobTable(person, village);
  });
  village.log("【秘宝】腕の無い天使像を使いました。村人全員にニケを付与しました");
  showSecretTreasureResult(village, "腕の無い天使像", "村人たちに勝利を呼ぶ気配が宿りました。", getVillagers(village));
}

function canUsePortraitOn(person) {
  return (Number(person?.eth) || 0) >= 2;
}

function applyGrotesquePortrait(village, target) {
  const ethLoss = clampValue(round3((Number(target.eth) || 0) - 1), 0, 100);
  target.mindTraits = Array.isArray(target.mindTraits) ? target.mindTraits : [];
  if (!target.mindTraits.includes("肖像")) {
    target.mindTraits.push("肖像");
  }
  target.portraitEthLoss = ethLoss;
  target.portraitMonths = 0;
  syncEffectiveStats(target);
  refreshJobTable(target, village);
  village.log(`【秘宝】悍ましい肖像画を${target.name}に使いました。倫理-${ethLoss}、魅力+${ethLoss}`);
  showSecretTreasureResult(village, "悍ましい肖像画", `${target.name}の内に暗い美が宿りました。`, [target]);
}

function growToSixteen(person, village) {
  const oldBodyAge = Number(person.bodyAge) || 0;
  const oldSpiritAge = Number(person.spiritAge) || 0;
  if (oldBodyAge > 15 && oldSpiritAge > 15) return;
  const hasPotential = !!(person.potentialStats || person.bodyPotentialStats || person.mindPotentialStats);

  if (oldBodyAge <= 15) person.bodyAge = 16;
  if (oldSpiritAge <= 15) person.spiritAge = 16;
  updateChildGrowthStage(person, village, { announce: true });
  if (!hasPotential) {
    person.bodyTraits = (person.bodyTraits || []).filter(trait => !["赤子", "子供", "少年", "少女"].includes(trait));
    person.mindTraits = (person.mindTraits || []).filter(trait => !["無垢", "萌芽", "思春期"].includes(trait));
    refreshJobTable(person, village);
  }
  village.log(`【秘宝】クロノスの秘薬により${person.name}は16歳まで成長しました`);
  showSecretTreasureResult(village, "クロノスの秘薬", `${person.name}は急速に成長し、若い姿を得ました。`, [person]);
}

function getPublicBathBonus(village) {
  const flags = village.buildingFlags || {};
  return 5 + (Number(flags.publicBathRecoveryBonus) || 0);
}

function hasUsedOldPriestStatue(village) {
  const flags = village.buildingFlags || {};
  return Boolean(flags.usedOldPriestStatue) || (Number(flags.publicBathRecoveryBonus) || 0) > 0;
}

export const SECRET_TREASURES = [
  {
    id: "persephone_statue",
    name: "冥王妃の神像",
    desc: "常春の奇跡と同じ効果。季節系の村特性を取り除き、春に固定する。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.persephone_statue,
    use: applyEverSpring
  },
  {
    id: "abundance_horn",
    name: "豊穣の角",
    desc: "豊穣の奇跡と同じ効果。今月のみ農作業・伐採・狩猟・漁・採集の成果と醸造の食料獲得を2倍にする。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.abundance_horn,
    use: applyAbundance
  },
  {
    id: "armless_angel",
    name: "腕の無い天使像",
    desc: "村人全員に1ヶ月の間、精神特性「ニケ」を付与する。ニケ: 勇気+10。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.armless_angel,
    canUse: (village) => getVillagers(village).length > 0,
    blockedReason: "村人がいません",
    use: applyNike
  },
  {
    id: "golden_arrow",
    name: "黄金の矢",
    desc: "ランダムな村人2名にクピドの奇跡の効果を与える。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.golden_arrow,
    canUse: (village) => getVillagers(village).length >= 2,
    blockedReason: "村人が2名以上必要です",
    use: (village) => {
      const [a, b] = pickTwoRandom(getVillagers(village));
      forceMarriage(a, b, village);
      showMarriageMiracleModal(village, "黄金の矢", [[a, b]], {
        message: "秘宝の力により新たな夫婦が結ばれました。"
      });
    }
  },
  {
    id: "golden_apple",
    name: "黄金の林檎",
    desc: "襲撃を発生させる。襲撃中は使用不可。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.golden_apple,
    canUse: (village) => !village.pendingRaid && !village.villageTraits?.includes("襲撃中") && !(Array.isArray(village.raidEnemies) && village.raidEnemies.length > 0),
    blockedReason: "襲撃中または襲撃予約中は使用できません",
    use: (village) => {
      village.log("【秘宝】黄金の林檎を使いました。襲撃を呼び寄せます");
      showSecretTreasureResult(village, "黄金の林檎", "黄金の林檎の甘い香りが災いを呼び、村の外に不穏な影が集まりました。");
      startRaidEvent(village);
    }
  },
  {
    id: "nectar",
    name: "ネクタル",
    desc: "指定した村人1名の体力を100にし、負傷・産褥などの状態異常を解除して行動可能にする。危篤は解除できない。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.nectar,
    target: "villager",
    use: (village, target) => {
      const recovered = restoreBadStatus(target, village, { fullHp: true, excludeTraits: ["危篤"] });
      village.log(`【秘宝】ネクタルを${target.name}に使いました。体力100${recovered.length ? `、${recovered.join("・")}を解除` : ""}`);
      showSecretTreasureResult(village, "ネクタル", `${target.name}の傷と疲れが癒されました。`, [target]);
    }
  },
  {
    id: "strange_calculator",
    name: "奇妙な計算機械",
    desc: "指定した村人1名の知力を永続的に5上げる。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.strange_calculator,
    target: "villager",
    use: (village, target) => {
      addAcquiredStat(target, "int", 5);
      refreshJobTable(target, village);
      village.log(`【秘宝】奇妙な計算機械を${target.name}に使いました。知力+5`);
      showSecretTreasureResult(village, "奇妙な計算機械", `${target.name}の内に新たな思考の歯車が噛み合いました。`, [target]);
    }
  },
  {
    id: "serpent_staff",
    name: "蛇の巻き付いた杖",
    desc: "指定した村人1名の負傷・産褥・疫病・危篤などの状態異常を解除し、体力・メンタルが33以下なら34まで回復する。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.serpent_staff,
    target: "villager",
    use: (village, target) => {
      const recovered = restoreBadStatus(target, village);
      const vitalRecovered = restoreLowVitals(target);
      if (vitalRecovered.length) refreshJobTable(target, village);
      const details = [
        recovered.length ? `${recovered.join("・")}を解除` : "",
        ...vitalRecovered
      ].filter(Boolean);
      village.log(`【秘宝】蛇の巻き付いた杖を${target.name}に使いました${details.length ? `。${details.join("、")}` : ""}`);
      showSecretTreasureResult(village, "蛇の巻き付いた杖", `${target.name}に杖の力が巡りました。`, [target]);
    }
  },
  {
    id: "grotesque_portrait",
    name: "悍ましい肖像画",
    desc: "倫理が2以上の村人1名に使用可能。今月のみ精神特性「肖像」を付与し、倫理を1まで下げ、下がった分だけ魅力を上げる。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.grotesque_portrait,
    target: "villager",
    targetFilter: canUsePortraitOn,
    targetBlockedReason: "倫理が2以上の村人が必要です",
    use: (village, target) => applyGrotesquePortrait(village, target)
  },
  {
    id: "chronos_elixir",
    name: "クロノスの秘薬",
    desc: "肉体年齢15以下または精神年齢15以下の村人に使用可能。該当する年齢を16まで成長させ、潜在成長も反映する。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.chronos_elixir,
    target: "childVillager",
    use: (village, target) => growToSixteen(target, village)
  },
  {
    id: "old_priest_statue",
    name: "老神官の石像",
    desc: "公衆浴場がある時に1回だけ使用可能。公衆浴場の毎月の体力・メンタル回復をそれぞれ+1する。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.old_priest_statue,
    canUse: (village) => !!(village.buildingFlags && village.buildingFlags.hasPublicBath) && !hasUsedOldPriestStatue(village),
    blockedReason: (village) => {
      if (!(village.buildingFlags && village.buildingFlags.hasPublicBath)) return "公衆浴場が必要です";
      if (hasUsedOldPriestStatue(village)) return "老神官の石像は使用済みです";
      return "使用条件を満たしていません";
    },
    use: (village) => {
      if (!village.buildingFlags) village.buildingFlags = {};
      village.buildingFlags.publicBathRecoveryBonus = (Number(village.buildingFlags.publicBathRecoveryBonus) || 0) + 1;
      village.buildingFlags.usedOldPriestStatue = true;
      village.log(`【秘宝】老神官の石像を使いました。公衆浴場の回復追加量+1（現在+${getPublicBathBonus(village)}）`);
      showSecretTreasureResult(village, "老神官の石像", "公衆浴場に古い祈りが染み込み、湯の癒やしが深まりました。");
    }
  },
  {
    id: "pan_flute",
    name: "牧神の管笛",
    desc: "村人・訪問者・襲撃者から6名を選び、3組の肉体を入れ替える。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.pan_flute,
    canUse: (village) => getPanFluteCandidates(village).length > 5,
    blockedReason: "村人・訪問者・襲撃者の合計が6名以上必要です",
    use: (village) => {
      const pairs = pickPanFlutePairs(village);
      pairs.forEach(([personA, personB]) => doExchange(personA, personB, village, true, "秘宝"));
      const pairText = pairs.map(([personA, personB]) => `${personA.name}と${personB.name}`).join("、");
      village.log(`【秘宝】牧神の管笛により${pairText}が入れ替わりました`);
      openPanFluteExchangeModal(pairs, {
        title: "牧神の管笛",
        message: "笛の音に導かれ、三つの入れ替わりが村を揺らしました。"
      });
    }
  },
  {
    id: "golden_mask",
    name: "黄金の仮面",
    desc: "使用効果はないが、高く売ることができる秘宝。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.golden_mask,
    canUse: () => false,
    blockedReason: "使用効果はありません"
  },
  {
    id: "blue_stone_tablet",
    name: "青石の石板",
    desc: "使用効果はないが、売ることができる秘宝。",
    sellPrice: SECRET_TREASURE_SELL_PRICES.blue_stone_tablet,
    canUse: () => false,
    blockedReason: "使用効果はありません"
  }
];

export function grantRandomSecretTreasure(village) {
  const definition = randFrom(SECRET_TREASURES);
  if (!definition) return null;
  if (!Array.isArray(village.secretTreasures)) village.secretTreasures = [];
  village.secretTreasures.push({ id: definition.id });
  return definition;
}

function ensureSecretTreasures(village) {
  if (Array.isArray(village.secretTreasures)) return village.secretTreasures;
  if (Array.isArray(village.treasures)) {
    village.secretTreasures = village.treasures;
    delete village.treasures;
    return village.secretTreasures;
  }
  village.secretTreasures = [];
  return village.secretTreasures;
}

function getSecretTreasureDefinition(entry) {
  const id = typeof entry === "string" ? entry : entry?.id;
  const name = typeof entry === "string" ? entry : entry?.name;
  return SECRET_TREASURES.find(secretTreasure => secretTreasure.id === id || secretTreasure.name === id || secretTreasure.name === name) || null;
}

function getSecretTreasureLabel(entry) {
  const definition = getSecretTreasureDefinition(entry);
  if (definition) return definition.name;
  if (typeof entry === "string") return entry;
  return entry?.name || entry?.id || "不明な秘宝";
}

function getTargetCandidates(village, definition) {
  const villagers = getVillagers(village);
  let candidates = [];
  if (definition.target === "childVillager") {
    candidates = villagers.filter(person => (Number(person.bodyAge) || 0) <= 15 || (Number(person.spiritAge) || 0) <= 15);
  } else if (definition.target === "villager") {
    candidates = villagers;
  }
  if (typeof definition.targetFilter === "function") {
    candidates = candidates.filter(person => definition.targetFilter(person, village));
  }
  return candidates;
}

function isSecretTreasureUsable(village, definition) {
  if (!definition) return false;
  if (definition.canUse && !definition.canUse(village)) return false;
  if (definition.target && getTargetCandidates(village, definition).length === 0) return false;
  return true;
}

function getSecretTreasureBlockedReason(village, definition) {
  if (!definition) return "利用効果が定義されていません";
  if (definition.canUse && !definition.canUse(village)) {
    return typeof definition.blockedReason === "function"
      ? definition.blockedReason(village)
      : definition.blockedReason || "使用条件を満たしていません";
  }
  if (definition.target && getTargetCandidates(village, definition).length === 0) {
    return definition.targetBlockedReason || "対象になる村人がいません";
  }
  return "";
}

function renderTargetSelect(village, definition, container) {
  const oldTarget = container.querySelector(".secret-treasure-target-label");
  if (oldTarget) oldTarget.remove();
  if (!definition?.target) return;

  const candidates = getTargetCandidates(village, definition);
  const label = document.createElement("label");
  label.className = "secret-treasure-target-label";
  label.innerHTML = `<span>対象を選択:</span><select id="secretTreasureTargetSelect"></select>`;
  const select = label.querySelector("select");
  candidates.forEach((person, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${person.name}（肉体${person.bodyAge}歳 / 精神${person.spiritAge}歳）`;
    select.appendChild(option);
  });
  container.querySelector(".secret-treasure-description")?.before(label);
}

function renderSecretTreasureModal(village) {
  const content = document.getElementById("secretTreasureContent");
  if (!content) return;

  const secretTreasures = ensureSecretTreasures(village);
  if (secretTreasures.length === 0) {
    content.innerHTML = "<p>所持している秘宝はありません。</p>";
    return;
  }

  content.innerHTML = `
    <label class="secret-treasure-select-label">
      <span>秘宝を選択:</span>
      <select id="secretTreasureSelect"></select>
    </label>
    <div id="secretTreasureDescription" class="secret-treasure-description"></div>
  `;

  const select = content.querySelector("#secretTreasureSelect");
  secretTreasures.forEach((entry, index) => {
    const definition = getSecretTreasureDefinition(entry);
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = getSecretTreasureLabel(entry);
    select.appendChild(option);
  });

  const updateDescription = () => {
    const definition = getSecretTreasureDefinition(secretTreasures[Number(select.value)]);
    const description = content.querySelector("#secretTreasureDescription");
    renderTargetSelect(village, definition, content);
    if (description) {
      const reason = getSecretTreasureBlockedReason(village, definition);
      const sellPrice = Number(definition?.sellPrice) || 0;
      description.textContent = definition
        ? `${definition.desc} 売却価格: 資金${sellPrice}。${reason ? ` 使用不可: ${reason}` : ""}`
        : "この秘宝はまだ利用効果が定義されていません。";
    }
  };
  select.addEventListener("change", updateDescription);
  updateDescription();
}

export function openSecretTreasureModal(village) {
  if (village.gameOver) {
    village.log("ゲームオーバー→秘宝利用不可");
    return;
  }
  ensureSecretTreasures(village);

  const overlay = document.getElementById("secretTreasureOverlay");
  const modal = document.getElementById("secretTreasureModal");
  if (!overlay || !modal) return;

  renderSecretTreasureModal(village);
  overlay.style.display = "block";
  modal.style.display = "block";
}

export function closeSecretTreasureModal() {
  const overlay = document.getElementById("secretTreasureOverlay");
  const modal = document.getElementById("secretTreasureModal");
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
}

export function useSelectedSecretTreasure(village) {
  const select = document.getElementById("secretTreasureSelect");
  if (!select) return;
  const secretTreasures = ensureSecretTreasures(village);
  const index = Number(select.value);
  const definition = getSecretTreasureDefinition(secretTreasures[index]);
  if (!isSecretTreasureUsable(village, definition)) {
    village.log(`【秘宝】${getSecretTreasureBlockedReason(village, definition)}`);
    renderSecretTreasureModal(village);
    return;
  }

  let target = null;
  if (definition.target) {
    const candidates = getTargetCandidates(village, definition);
    const targetSelect = document.getElementById("secretTreasureTargetSelect");
    target = candidates[Number(targetSelect?.value || 0)];
    if (!target) {
      village.log("【秘宝】対象を選択してください");
      return;
    }
  }

  if (!window.confirm(`${definition.name}を使いますか？`)) return;
  definition.use(village, target);
  secretTreasures.splice(index, 1);
  village.secretTreasures = secretTreasures;
  renderSecretTreasureModal(village);
  updateUI(village);
}

export function sellSelectedSecretTreasure(village) {
  const select = document.getElementById("secretTreasureSelect");
  if (!select) return;
  const secretTreasures = ensureSecretTreasures(village);
  const index = Number(select.value);
  const definition = getSecretTreasureDefinition(secretTreasures[index]);
  if (!definition) {
    village.log("【秘宝】売却できない秘宝です");
    renderSecretTreasureModal(village);
    return;
  }

  const price = Number(definition.sellPrice) || 0;
  if (!window.confirm(`${definition.name}を資金${price}で売却しますか？`)) return;
  village.funds = clampValue((Number(village.funds) || 0) + price, 0, 99999);
  secretTreasures.splice(index, 1);
  village.secretTreasures = secretTreasures;
  village.log(`【秘宝売却】${definition.name}を売却しました。資金+${price}`);
  renderSecretTreasureModal(village);
  updateUI(village);
}
