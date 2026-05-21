import { doExchange } from "./exchange.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { openExchangeModal, showMarriageMiracleModal, showMiracleResultModal } from "./miracles.js";
import { startRaidEvent } from "./raidStart.js";
import { addRelationship, removeRelationship, addSpouseRelationships } from "./relationships.js";
import { updateChildGrowthStage } from "./reproduction.js";
import { clampValue, round3 } from "./util.js";
import { updateUI } from "./ui.js";

const SEASON_TRAITS_TO_REMOVE = ["夏", "秋", "冬", "冷夏", "飛蝗", "厳冬", "疫病流行"];
const BAD_BODY_TRAITS = ["負傷", "疲労", "過労", "飢餓", "凍え", "病気", "疫病", "産褥", "危篤"];
const BAD_MIND_TRAITS = ["心労", "抑鬱"];

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

function forceMarriage(a, b, village) {
  removeRelationship(a, `恋人:${b.name}`);
  removeRelationship(b, `恋人:${a.name}`);
  addRelationship(a, "既婚");
  addRelationship(b, "既婚");
  addSpouseRelationships(a, b);
  a.happiness = clampValue(a.happiness + 50, 0, 100);
  b.happiness = clampValue(b.happiness + 50, 0, 100);
  village.log(`【秘宝】黄金の矢により${a.name}と${b.name}が結ばれました`);
}

function showSecretTreasureResult(village, title, message, people = []) {
  showMiracleResultModal(village, title, message, people, { allowEmpty: true });
}

function restoreBadStatus(person, village, options = {}) {
  const recovered = [];
  person.bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
  person.mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];

  BAD_BODY_TRAITS.forEach(trait => {
    if (!person.bodyTraits.includes(trait)) return;
    recovered.push(trait);
    person.bodyTraits = person.bodyTraits.filter(item => item !== trait);
    switch (trait) {
      case "飢餓":
      case "凍え":
        person.str = round3(person.str / 0.5);
        person.vit = round3(person.vit / 0.5);
        person.dex = round3(person.dex / 0.5);
        break;
      case "疫病":
        person.hp = clampValue(round3(person.hp / 0.5), 0, 100);
        person.str = round3(person.str / 0.5);
        person.vit = round3(person.vit / 0.5);
        person.dex = round3(person.dex / 0.5);
        break;
      case "疲労":
        person.str = round3(person.str / 0.8);
        person.vit = round3(person.vit / 0.8);
        person.dex = round3(person.dex / 0.8);
        break;
      case "過労":
        person.str = round3(person.str / 0.25);
        person.vit = round3(person.vit / 0.25);
        person.dex = round3(person.dex / 0.25);
        break;
      case "産褥":
        person.str = round3(person.str / 0.5);
        person.vit = round3(person.vit / 0.5);
        person.postpartumMonths = 0;
        break;
    }
  });

  BAD_MIND_TRAITS.forEach(trait => {
    if (!person.mindTraits.includes(trait)) return;
    recovered.push(trait);
    person.mindTraits = person.mindTraits.filter(item => item !== trait);
    switch (trait) {
      case "心労":
        person.int = round3(person.int / 0.8);
        person.cou = round3(person.cou / 0.8);
        person.ind = round3(person.ind / 0.8);
        person.eth = round3(person.eth / 0.8);
        person.sexdr = round3(person.sexdr / 0.8);
        break;
      case "抑鬱":
        person.int = round3(person.int / 0.25);
        person.cou = round3(person.cou / 0.25);
        person.ind = round3(person.ind / 0.25);
        person.eth = round3(person.eth / 0.25);
        person.sexdr = round3(person.sexdr / 0.25);
        break;
    }
  });

  if (options.fullHp) person.hp = 100;
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

function applyNike(village) {
  getVillagers(village).forEach(person => {
    person.mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
    if (!person.mindTraits.includes("ニケ")) {
      person.mindTraits.push("ニケ");
      person.cou = clampValue((Number(person.cou) || 0) + 10, 0, 100);
    }
    person.nikeMonths = 0;
    refreshJobTable(person, village);
  });
  village.log("【秘宝】腕の無い天使像を使いました。村人全員にニケを付与しました");
  showSecretTreasureResult(village, "腕の無い天使像", "村人たちに勝利を呼ぶ気配が宿りました。", getVillagers(village));
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
  return 10 + (Number(flags.publicBathRecoveryBonus) || 0);
}

export const SECRET_TREASURES = [
  {
    id: "persephone_statue",
    name: "冥王妃の神像",
    desc: "常春の奇跡と同じ効果。季節系の村特性を取り除き、春に固定する。",
    use: applyEverSpring
  },
  {
    id: "armless_angel",
    name: "腕の無い天使像",
    desc: "村人全員に1ヶ月の間、精神特性「ニケ」を付与する。ニケ: 勇気+10。",
    canUse: (village) => getVillagers(village).length > 0,
    blockedReason: "村人がいません",
    use: applyNike
  },
  {
    id: "golden_arrow",
    name: "黄金の矢",
    desc: "ランダムな村人2名にクピドの奇跡の効果を与える。",
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
    canUse: (village) => !village.villageTraits?.includes("襲撃中") && !(Array.isArray(village.raidEnemies) && village.raidEnemies.length > 0),
    blockedReason: "襲撃中は使用できません",
    use: (village) => {
      village.log("【秘宝】黄金の林檎を使いました。襲撃を呼び寄せます");
      showSecretTreasureResult(village, "黄金の林檎", "黄金の林檎の甘い香りが災いを呼び、村の外に不穏な影が集まりました。");
      startRaidEvent(village);
    }
  },
  {
    id: "nectar",
    name: "ネクタル",
    desc: "指定した村人1名の体力を100にし、負傷・産褥などの状態異常を解除して行動可能にする。",
    target: "villager",
    use: (village, target) => {
      const recovered = restoreBadStatus(target, village, { fullHp: true });
      village.log(`【秘宝】ネクタルを${target.name}に使いました。体力100${recovered.length ? `、${recovered.join("・")}を解除` : ""}`);
      showSecretTreasureResult(village, "ネクタル", `${target.name}の傷と疲れが癒されました。`, [target]);
    }
  },
  {
    id: "strange_calculator",
    name: "奇妙な計算機械",
    desc: "指定した村人1名の知力を永続的に5上げる。",
    target: "villager",
    use: (village, target) => {
      target.int = clampValue((Number(target.int) || 0) + 5, 0, 100);
      if (target.mindPotentialStats) target.mindPotentialStats.int = clampValue((Number(target.mindPotentialStats.int) || 0) + 5, 0, 100);
      if (target.potentialStats) target.potentialStats.int = clampValue((Number(target.potentialStats.int) || 0) + 5, 0, 100);
      refreshJobTable(target, village);
      village.log(`【秘宝】奇妙な計算機械を${target.name}に使いました。知力+5`);
      showSecretTreasureResult(village, "奇妙な計算機械", `${target.name}の内に新たな思考の歯車が噛み合いました。`, [target]);
    }
  },
  {
    id: "serpent_staff",
    name: "蛇の巻き付いた杖",
    desc: "指定した村人1名の負傷・産褥・疫病・危篤などの状態異常を解除し、体力・メンタルが33以下なら34まで回復する。",
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
    id: "chronos_elixir",
    name: "クロノスの秘薬",
    desc: "肉体年齢15以下または精神年齢15以下の村人に使用可能。該当する年齢を16まで成長させ、潜在成長も反映する。",
    target: "childVillager",
    use: (village, target) => growToSixteen(target, village)
  },
  {
    id: "old_priest_statue",
    name: "老神官の石像",
    desc: "公衆浴場がある時に使用可能。公衆浴場の回復効果をそれぞれ+1する。",
    canUse: (village) => !!(village.buildingFlags && village.buildingFlags.hasPublicBath),
    blockedReason: "公衆浴場が必要です",
    use: (village) => {
      if (!village.buildingFlags) village.buildingFlags = {};
      village.buildingFlags.publicBathRecoveryBonus = (Number(village.buildingFlags.publicBathRecoveryBonus) || 0) + 1;
      village.log(`【秘宝】老神官の石像を使いました。公衆浴場の回復追加量+1（現在+${getPublicBathBonus(village)}）`);
      showSecretTreasureResult(village, "老神官の石像", "公衆浴場に古い祈りが染み込み、湯の癒やしが深まりました。");
    }
  },
  {
    id: "pan_flute",
    name: "牧神の管笛",
    desc: "訪問者、襲撃者がいる時に使用可能。ランダムな村人と訪問者/襲撃者を入れ替える。",
    canUse: (village) => getVillagers(village).length > 0 && [...(village.visitors || []), ...(village.raidEnemies || [])].length > 0,
    blockedReason: "村人と、訪問者または襲撃者が必要です",
    use: (village) => {
      const villager = randFrom(getVillagers(village));
      const outsider = randFrom([...(village.visitors || []), ...(village.raidEnemies || [])]);
      doExchange(villager, outsider, village, true);
      village.log(`【秘宝】牧神の管笛により${villager.name}と${outsider.name}が入れ替わりました`);
      openExchangeModal(villager, outsider, {
        title: "牧神の管笛",
        message: "笛の音に導かれ、二人の魂は互いの体を見て驚いている..."
      });
    }
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
  if (definition.target === "childVillager") {
    return villagers.filter(person => (Number(person.bodyAge) || 0) <= 15 || (Number(person.spiritAge) || 0) <= 15);
  }
  if (definition.target === "villager") return villagers;
  return [];
}

function isSecretTreasureUsable(village, definition) {
  if (!definition) return false;
  if (definition.canUse && !definition.canUse(village)) return false;
  if (definition.target && getTargetCandidates(village, definition).length === 0) return false;
  return true;
}

function getSecretTreasureBlockedReason(village, definition) {
  if (!definition) return "利用効果が定義されていません";
  if (definition.canUse && !definition.canUse(village)) return definition.blockedReason || "使用条件を満たしていません";
  if (definition.target && getTargetCandidates(village, definition).length === 0) return "対象になる村人がいません";
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
    option.disabled = !isSecretTreasureUsable(village, definition);
    select.appendChild(option);
  });

  const updateDescription = () => {
    const definition = getSecretTreasureDefinition(secretTreasures[Number(select.value)]);
    const description = content.querySelector("#secretTreasureDescription");
    renderTargetSelect(village, definition, content);
    if (description) {
      const reason = getSecretTreasureBlockedReason(village, definition);
      description.textContent = definition
        ? `${definition.desc}${reason ? ` 使用不可: ${reason}` : ""}`
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
