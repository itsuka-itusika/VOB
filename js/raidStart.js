import { createRandomVillager } from "./createVillagers.js";
import {
  getRaiderTypeByType,
  getRaidModuleById,
  getRaidRepresentative,
  RAID_MODULES,
  RAID_SCALE_TABLES
} from "./data/raidData.js";
import { refreshJobTable } from "./domain/jobTables.js";
import { getRaiderSpeechType } from "./domain/raiderSpeechTypes.js";
import { setBaseStats, syncEffectiveStats } from "./domain/statLayers.js";
import { syncWolfSpeciesTraits } from "./domain/speciesTraits.js";
import { clearRaidWarningModal, showRaidWarningModal } from "./raidWarningModal.js";
import { MESSENGER_PASS_SECRET_TREASURE_ID } from "./data/tutorialData.js";
import { updateUI } from "./ui.js";
import { clampValue, randChoice, randInt } from "./util.js";
import { getVillageScaleStage } from "./villageScale.js";
import { clearDefeatedRaidEnemies, getCaptives } from "./captives.js";
import { RAID_MENTAL_TRAIT_REACTIONS } from "./data/dialogue/raidStartLines.js";

const AVOIDANCE_RESOURCE_LABELS = {
  food: "食料",
  materials: "資材",
  funds: "資金",
  mana: "魔素",
  fame: "名声",
  tech: "技術"
};

export function applyRaidMentalTraitReactions(village) {
  const villagers = Array.isArray(village?.villagers) ? village.villagers : [];
  villagers.forEach(person => {
    const mindTraits = Array.isArray(person?.mindTraits) ? person.mindTraits : [];
    const reaction = RAID_MENTAL_TRAIT_REACTIONS.reduce((best, entry) => {
      if (!mindTraits.includes(entry.trait)) return best;
      return !best || entry.mentalGain > best.mentalGain ? entry : best;
    }, null);
    if (!reaction) return;

    person.mp = clampValue((Number(person.mp) || 0) + reaction.mentalGain, 0, 100);
    village.log(`【${reaction.trait}】${reaction.line(person)}メンタル+${reaction.mentalGain}`);
  });
}

function getVillageScaleStageIndex(village) {
  return getVillageScaleStage(village.building).index;
}

function getRaidTableForVillage(village) {
  const stageIndex = getVillageScaleStageIndex(village);
  const villageTraits = Array.isArray(village?.villageTraits) ? village.villageTraits : [];
  return RAID_SCALE_TABLES.find(table => {
    if (table.requiredVillageTrait && !villageTraits.includes(table.requiredVillageTrait)) return false;
    if (table.excludedVillageTrait && villageTraits.includes(table.excludedVillageTrait)) return false;
    if (Array.isArray(table.scaleStageIndexes)) {
      return table.scaleStageIndexes.includes(stageIndex);
    }
    const min = Number.isFinite(table.minScaleStageIndex) ? table.minScaleStageIndex : 0;
    const max = Number.isFinite(table.maxScaleStageIndex) ? table.maxScaleStageIndex : Infinity;
    return stageIndex >= min && stageIndex <= max;
  }) || RAID_SCALE_TABLES[0];
}

function getVariantEnemyGroups(variant) {
  if (Array.isArray(variant?.enemyGroups)) return variant.enemyGroups;
  if (Array.isArray(variant?.groups)) return variant.groups;
  return [];
}

function getAllRaidEnemyGroups(raidDefinition) {
  const groups = Array.isArray(raidDefinition?.enemyGroups)
    ? [...raidDefinition.enemyGroups]
    : [];
  if (Array.isArray(raidDefinition?.enemyGroupVariants)) {
    raidDefinition.enemyGroupVariants.forEach(variant => {
      groups.push(...getVariantEnemyGroups(variant));
    });
  }
  return groups;
}

function selectRaidEnemyGroups(raidDefinition) {
  const variants = Array.isArray(raidDefinition?.enemyGroupVariants)
    ? raidDefinition.enemyGroupVariants.filter(variant => getVariantEnemyGroups(variant).length > 0)
    : [];
  if (variants.length === 0) {
    return Array.isArray(raidDefinition?.enemyGroups) ? raidDefinition.enemyGroups : [];
  }

  const totalWeight = variants.reduce((sum, variant) => {
    return sum + Math.max(0, Number(variant.weight) || 0);
  }, 0);
  if (totalWeight <= 0) return getVariantEnemyGroups(variants[0]);

  let random = Math.random() * totalWeight;
  for (const variant of variants) {
    random -= Math.max(0, Number(variant.weight) || 0);
    if (random <= 0) return getVariantEnemyGroups(variant);
  }
  return getVariantEnemyGroups(variants[0]);
}

function hasValidEnemyGroup(raidDefinition) {
  return getAllRaidEnemyGroups(raidDefinition).some(group => getRaiderTypeByType(group.raiderType));
}

function matchesRaidEntryConditions(village, entry, stageIndex) {
  const minScaleStageIndex = Number(entry.minScaleStageIndex);
  if (Number.isFinite(minScaleStageIndex) && stageIndex < minScaleStageIndex) return false;

  const maxScaleStageIndex = Number(entry.maxScaleStageIndex);
  if (Number.isFinite(maxScaleStageIndex) && stageIndex > maxScaleStageIndex) return false;

  return true;
}

function selectRaidDefinition(village) {
  const raidTable = getRaidTableForVillage(village);
  const stageIndex = getVillageScaleStageIndex(village);
  const candidates = raidTable.entries
    .filter(entry => matchesRaidEntryConditions(village, entry, stageIndex))
    .map(entry => {
      const raidDefinition = getRaidModuleById(entry.raidId);
      if (!raidDefinition || !hasValidEnemyGroup(raidDefinition)) return null;
      return {
        entry,
        raidDefinition,
        weight: Number(entry.weight ?? raidDefinition.weight) || 0
      };
    })
    .filter(candidate => candidate && candidate.weight > 0);

  const totalWeight = candidates.reduce((sum, candidate) => {
    return sum + candidate.weight;
  }, 0);
  let random = Math.random() * totalWeight;

  for (const candidate of candidates) {
    random -= candidate.weight;
    if (random <= 0) {
      return candidate.raidDefinition;
    }
  }
  return RAID_MODULES[0]; // フォールバック
}

function createRaidState(raidDefinition) {
  return {
    id: raidDefinition.id,
    name: raidDefinition.name
  };
}

function createPendingRaidEnemyGroups(raidDefinition) {
  return selectRaidEnemyGroups(raidDefinition).map(group => {
    const raiderType = getRaiderTypeByType(group.raiderType);
    if (!raiderType) return null;

    const minCount = group.minCount ?? raiderType.minCount;
    const maxCount = group.maxCount ?? raiderType.maxCount;
    return {
      raiderType: group.raiderType,
      count: randInt(minCount, maxCount)
    };
  }).filter(Boolean);
}

export function createPendingRaidReservation(village, monthsUntil = 1) {
  const raidDefinition = selectRaidDefinition(village);
  return {
    raidId: raidDefinition.id,
    raidName: raidDefinition.name,
    warningName: raidDefinition.warningName || raidDefinition.name,
    enemyGroups: createPendingRaidEnemyGroups(raidDefinition),
    monthsUntil: Math.max(1, Math.floor(Number(monthsUntil) || 1)),
    prophecyNotified: false
  };
}

function getRaidDefinitionFromPendingRaid(pendingRaid) {
  const raidId = pendingRaid?.raidId || pendingRaid?.id;
  return raidId ? getRaidModuleById(raidId) : null;
}

function getResolvedEnemyGroups(raidDefinition, pendingRaid = null) {
  if (Array.isArray(pendingRaid?.enemyGroups) && pendingRaid.enemyGroups.length > 0) {
    return pendingRaid.enemyGroups
      .map(group => {
        const raiderType = getRaiderTypeByType(group.raiderType);
        if (!raiderType) return null;
        const count = Math.max(0, Math.floor(Number(group.count) || 0));
        return count > 0 ? { raiderType, count } : null;
      })
      .filter(Boolean);
  }

  return selectRaidEnemyGroups(raidDefinition)
    .map(group => {
      const raiderType = getRaiderTypeByType(group.raiderType);
      if (!raiderType) return null;

      const minCount = group.minCount ?? raiderType.minCount;
      const maxCount = group.maxCount ?? raiderType.maxCount;
      return {
        raiderType,
        count: randInt(minCount, maxCount)
      };
    })
    .filter(Boolean);
}

function createRaidEnemy(village, raiderType, existingNames, enemyProfile = null) {
  const displayType = raiderType.displayType || raiderType.type;
  let e = createRandomVillager({
    sex: raiderType.forcedSex || (Math.random() < 0.5 ? "男" : "女"),
    minAge: raiderType.ageRange.min,
    maxAge: raiderType.ageRange.max,
    existingNames,
    params: {
      ...raiderType.params,
      race: raiderType.race
    },
    ranges: raiderType.ranges
  });

  // 襲撃者の特性とダイアログを設定
  if (raiderType.replaceMindTraits) {
    e.mindTraits = [];
  }
  e.mindTraits.push("襲撃者");
  if (Array.isArray(raiderType.mindTraits)) {
    raiderType.mindTraits.forEach(trait => {
      if (!e.mindTraits.includes(trait)) {
        e.mindTraits.push(trait);
      }
    });
  }
  e.raiderDialogues = raiderType.dialogues || [];

  // 顔グラフィックの設定（直接portraitFileを設定）
  if (raiderType.portraits) {
    e.portraitFile = randChoice(raiderType.portraits);
    console.log('Set portrait for raider:', {
      name: e.name,
      type: raiderType.type,
      portrait: e.portraitFile,
      mindTraits: e.mindTraits
    });
  }
  if (raiderType.useDefaultPortrait) {
    e.portraitFile = "default.png";
  }

  // 狼の場合は肉体特性を上書き
  if (displayType === "狼") {
    e.bodyTraits = [
      ...raiderType.forcedBodyTraits,
      randChoice(raiderType.bodyTraits)
    ];
    // 狼の趣味を設定
    e.hobby = randChoice(raiderType.hobbies);
  }
  // その他の種族の場合は従来通りの処理
  else {
    // 強制的な肉体特性を追加
    if (raiderType.forcedBodyTraits) {
      // キュクロプスの場合は強制的な特性のみを持つ
      if (raiderType.type === "キュクロプス" || raiderType.replaceBodyTraits) {
        e.bodyTraits = [...raiderType.forcedBodyTraits];
      } else {
        raiderType.forcedBodyTraits.forEach(trait => {
          if (!e.bodyTraits.includes(trait)) {
            e.bodyTraits.push(trait);
          }
        });
      }
    }

    // 特定の種族用のランダム肉体特性
    if (raiderType.bodyTraits) {
      const randomTrait = randChoice(raiderType.bodyTraits);
      if (!e.bodyTraits.includes(randomTrait)) {
        e.bodyTraits.push(randomTrait);
      }
    }

    // 特定の種族用の趣味
    if (raiderType.hobbies) {
      e.hobby = randChoice(raiderType.hobbies);
    }
  }

  e.jobTable = [raiderType.params.job];
  e.actionTable = ["襲撃"];
  e.job = raiderType.params.job;
  e.action = "襲撃";
  e.raiderType = raiderType.type;
  e.raiderRole = raiderType.role || "";
  e.raidPosition = raiderType.raidPosition || "front";
  e.raidTargeting = raiderType.raidTargeting || "frontFirst";
  e.raidAttackType = raiderType.raidAttackType || "";
  e.uiSexDisplay = raiderType.uiSexDisplay || "";
  e.exchangeImmune = !!raiderType.exchangeImmune;
  e.uncapturable = !!raiderType.uncapturable;
  const speechType = getRaiderSpeechType(e);
  if (speechType) {
    e.speechType = speechType;
  }
  if (raiderType.fixedName) {
    e.name = raiderType.fixedName;
    e.bodyOwner = raiderType.fixedName;
  } else {
    e.name = `${displayType}の${e.name}`;
  }

  // 襲撃者として矛盾するランダム精神特性は外す。
  e.mindTraits = e.mindTraits.filter(trait => trait !== "ニート" && trait !== "非戦主義");

  if (enemyProfile) {
    const bodyStats = {};
    Object.entries(enemyProfile.bodyStatMultipliers || {}).forEach(([stat, multiplier]) => {
      bodyStats[stat] = (Number(e.baseStats?.[stat]) || 0) * Number(multiplier);
    });
    if (Object.keys(bodyStats).length > 0) setBaseStats(e, bodyStats);
    (enemyProfile.addMindTraits || []).forEach(trait => {
      if (!e.mindTraits.includes(trait)) e.mindTraits.push(trait);
    });
  }

  syncWolfSpeciesTraits(e, { includeWildMindTrait: true });
  syncEffectiveStats(e);
  return e;
}

function getAvoidanceResourceRequests(avoidance) {
  if (Array.isArray(avoidance?.resources)) {
    return avoidance.resources.filter(request => request?.resource);
  }
  return avoidance?.resource ? [avoidance] : [];
}

function calculateAvoidanceAmount(village, request) {
  const resource = request?.resource;
  if (!resource) return 0;

  const currentAmount = Number(village[resource]) || 0;
  const rateAmount = Math.ceil(currentAmount * (Number(request.rate) || 0));
  const minAmount = Math.floor(Number(request.minAmount) || 0);
  return Math.max(minAmount, rateAmount);
}

function createAvoidanceOption(village, avoidance) {
  if (!avoidance || avoidance.type !== "resourcePayment") return null;

  const payments = getAvoidanceResourceRequests(avoidance).map(request => {
    const resource = request.resource;
    const resourceLabel = request.resourceLabel || AVOIDANCE_RESOURCE_LABELS[resource] || resource;
    const currentAmount = Math.floor(Number(village[resource]) || 0);
    const amount = calculateAvoidanceAmount(village, request);
    return {
      amount,
      currentAmount,
      resource,
      resourceLabel
    };
  });
  if (payments.length === 0) return null;

  const disabledPayments = payments.filter(payment => payment.currentAmount < payment.amount);
  const disabled = disabledPayments.length > 0;
  const paymentText = payments
    .map(payment => `${payment.resourceLabel}${payment.amount}`)
    .join(" / ");
  const currentText = payments
    .map(payment => `${payment.resourceLabel}${payment.currentAmount}`)
    .join(" / ");
  const disabledText = disabledPayments
    .map(payment => payment.resourceLabel)
    .join("、");
  const firstPayment = payments[0];

  return {
    label: avoidance.label || `${paymentText}を払う`,
    detail: `要求: ${paymentText}（所持 ${currentText}）`,
    disabled,
    disabledReason: disabled ? `${disabledText}が不足しています` : "",
    amount: firstPayment.amount,
    resource: firstPayment.resource,
    resourceLabel: firstPayment.resourceLabel,
    resourcePayments: payments
  };
}

function createMessengerPassAvoidanceOption(village) {
  if (!hasMessengerPass(village)) return null;
  return {
    type: "messengerPass",
    label: "伝令神の手形を使う",
    detail: "秘宝「伝令神の手形」を使うと、この襲撃をなかったことにします。",
    disabled: false
  };
}

function createSphinxRiddleAvoidanceOption(village, raidDefinition) {
  if (raidDefinition?.id !== "sphinx-visit") return null;
  const candidates = Array.isArray(village?.villagers) ? village.villagers : [];
  return {
    type: "sphinxRiddle",
    label: "問答に挑む",
    detail: "村人を1人選択。成功率は（知力 - 20）÷20（最低0%・最高100%）。",
    candidates,
    candidateLabel: person => `${person.name}（知力${Math.floor(Number(person.int) || 0)}）`,
    disabled: candidates.length === 0,
    disabledReason: candidates.length === 0 ? "問答に挑む村人がいません" : ""
  };
}

function createRaidAvoidanceOptions(village, raidDefinition) {
  return [
    createAvoidanceOption(village, raidDefinition?.avoidance),
    createSphinxRiddleAvoidanceOption(village, raidDefinition),
    createMessengerPassAvoidanceOption(village)
  ].filter(Boolean);
}

function isRaidActive(village) {
  return Array.isArray(village?.villageTraits) &&
    village.villageTraits.includes("襲撃中") &&
    Array.isArray(village.raidEnemies) &&
    village.raidEnemies.length > 0;
}

function getActiveRaidDefinition(village) {
  const currentRaid = village?.currentRaid || {};
  const raidId = currentRaid.id || currentRaid.raidId;
  return getRaidModuleById(raidId) || { name: currentRaid.name || "襲撃" };
}

export function canAvoidCurrentRaidWithMessengerPass(village) {
  return isRaidActive(village) &&
    hasMessengerPass(village);
}

export function avoidCurrentRaidWithMessengerPass(village, { consumeTreasure = true } = {}) {
  if (!isRaidActive(village)) {
    village?.log?.("【秘宝】伝令神の手形は襲撃発生中のみ使用できます。");
    return false;
  }

  const option = createMessengerPassAvoidanceOption(village);
  if (!option) {
    village?.log?.("【秘宝】伝令神の手形を所持していません。");
    return false;
  }

  if (consumeTreasure && !consumeMessengerPass(village)) return false;
  endRaidByAvoidance(village, getActiveRaidDefinition(village), option);
  return true;
}

function resetRaidUiAfterAvoidance() {
  if (typeof document === "undefined") return;

  const raidSection = document.getElementById("raidEnemiesSection");
  if (raidSection) raidSection.style.display = "none";

  const nextBtn = document.getElementById("nextTurnButton");
  if (nextBtn) {
    nextBtn.textContent = "次の月へ";
    nextBtn.disabled = false;
  }

  const autoAssignBtn = document.getElementById("autoAssignButton");
  if (autoAssignBtn) {
    autoAssignBtn.textContent = "自動割り振り";
  }

  const raidAssignBtn = document.getElementById("raidAssignButton");
  if (raidAssignBtn) {
    raidAssignBtn.style.display = "none";
  }
}

function formatAvoidancePaidResources(option) {
  const payments = Array.isArray(option?.resourcePayments) && option.resourcePayments.length > 0
    ? option.resourcePayments
    : [{ resourceLabel: option?.resourceLabel || "", amount: option?.amount || 0 }];
  return payments
    .map(payment => `${payment.resourceLabel}${payment.amount}`)
    .join(" / ");
}

function endRaidByAvoidance(village, raidDefinition, option) {
  village.isRaidProcessDone = true;
  village.isRaidFinalizing = false;
  village.raidTurnCount = 0;
  village.currentActionIndex = 0;
  village.raidActionQueue = [];
  village.raidPhase = "";
  village.currentRaid = null;
  village.raidEnemies = [];
  clearDefeatedRaidEnemies(village);

  const raidTraitIndex = village.villageTraits.indexOf("襲撃中");
  if (raidTraitIndex >= 0) {
    village.villageTraits.splice(raidTraitIndex, 1);
  }

  village.villagers.forEach(person => refreshJobTable(person, village));
  if (option.type === "messengerPass") {
    village.log(`【秘宝】伝令神の手形を使い、${raidDefinition.name}の襲撃をなかったことにしました。`);
  } else if (option.type === "sphinxRiddle") {
    village.log("スフィンクスは問答に満足し去っていった。");
  } else {
    village.log(`${raidDefinition.name}: ${formatAvoidancePaidResources(option)}を支払い、襲撃者は去っていった。`);
  }

  clearRaidWarningModal();
  resetRaidUiAfterAvoidance();
  updateUI(village);
}

function executeRaidAvoidance(village, raidDefinition, option = null) {
  option = option || createAvoidanceOption(village, raidDefinition.avoidance);
  if (!option || option.disabled) {
    if (option?.disabledReason) village.log(`${raidDefinition.name}: ${option.disabledReason}`);
    return false;
  }

  if (option.type === "sphinxRiddle") {
    const person = option.selectedPerson;
    if (!person || !village.villagers.includes(person)) {
      return {
        close: false,
        message: "問答に挑む村人を選んでください。"
      };
    }
    const intelligence = Number(person.int) || 0;
    const successChance = Math.max(0, Math.min(1, (intelligence - 20) / 20));
    const successRate = Math.round(successChance * 100);
    if (Math.random() < successChance) {
      village.log(`${person.name}がスフィンクスの問答に答えた（成功率${successRate}%）。`);
      endRaidByAvoidance(village, raidDefinition, option);
      return true;
    }

    const message = `${person.name}の答えにスフィンクスは満足せず、問答は失敗した（成功率${successRate}%）。`;
    village.log(message);
    updateUI(village);
    return { close: false, message };
  }

  if (option.type === "messengerPass") {
    if (!consumeMessengerPass(village)) return false;
  } else {
    const payments = Array.isArray(option.resourcePayments) && option.resourcePayments.length > 0
      ? option.resourcePayments
      : [option];
    payments.forEach(payment => {
      const currentAmount = Number(village[payment.resource]) || 0;
      village[payment.resource] = Math.max(0, currentAmount - payment.amount);
    });
  }
  endRaidByAvoidance(village, raidDefinition, option);
  return true;
}

function getSecretTreasureEntryId(entry) {
  if (typeof entry === "string") return entry;
  return entry?.id || entry?.name || "";
}

function getMessengerPassIndex(village) {
  const secretTreasures = Array.isArray(village?.secretTreasures)
    ? village.secretTreasures
    : (Array.isArray(village?.treasures) ? village.treasures : []);
  return secretTreasures.findIndex(entry => {
    const id = getSecretTreasureEntryId(entry);
    return id === MESSENGER_PASS_SECRET_TREASURE_ID || id === "伝令神の手形";
  });
}

function hasMessengerPass(village) {
  return getMessengerPassIndex(village) >= 0;
}

function consumeMessengerPass(village) {
  const source = Array.isArray(village.secretTreasures)
    ? village.secretTreasures
    : (Array.isArray(village.treasures) ? village.treasures : []);
  const index = getMessengerPassIndex(village);
  if (index < 0) return false;
  source.splice(index, 1);
  village.secretTreasures = source;
  if (Array.isArray(village.treasures)) delete village.treasures;
  return true;
}

/**
 * 襲撃イベント開始を修正
 */
export function startRaidEvent(village, options = {}) {
  const pendingRaid = options.pendingRaid || null;
  const raidDefinition = options.raidDefinition ||
    getRaidDefinitionFromPendingRaid(pendingRaid) ||
    selectRaidDefinition(village);
  village.log(pendingRaid
    ? `【襲撃発生】予兆のあった${raidDefinition.name}が村へ押し寄せました。`
    : `【襲撃発生】${raidDefinition.name}が村へ押し寄せました。`);
  if (!village.villageTraits.includes("襲撃中")) {
    village.villageTraits.push("襲撃中");
  }

  village.monthsSinceRaid = 0;
  village.raidCooldown = 1;
  village.pendingRaid = null;
  village.raidEnemies = [];
  clearDefeatedRaidEnemies(village);
  village.currentRaid = createRaidState(raidDefinition);

  getResolvedEnemyGroups(raidDefinition, pendingRaid).forEach(group => {
    for (let i = 0; i < group.count; i++) {
      const existingNames = [
        ...village.villagers.map(person => person.name),
        ...getCaptives(village).map(person => person.name),
        ...village.raidEnemies.map(person => person.name)
      ];
      village.raidEnemies.push(createRaidEnemy(
        village,
        group.raiderType,
        existingNames,
        raidDefinition.enemyProfile
      ));
    }
  });

  const enemyCount = village.raidEnemies.length;

  applyRaidMentalTraitReactions(village);

  // 生成された敵全体の確認ログ
  console.log('Created raiders:', village.raidEnemies.map(e => ({
    name: e.name,
    type: e.job,
    portrait: e.portraitFile
  })));

  village.isRaidProcessDone = false;
  village.isRaidFinalizing = false;
  village.raidTurnCount = 0;
  village.currentActionIndex = 0;
  village.raidActionQueue = [];
  village.raidPhase = "";
  village.villagers.forEach(person => refreshJobTable(person, village));

  // 襲撃者の数に応じてメッセージを変更
  if (enemyCount === 1) {
    village.log(`${raidDefinition.name}: 1体が襲来！`);
  } else {
    village.log(`${raidDefinition.name}: ${enemyCount}体が襲来！`);
  }

  if (typeof document !== "undefined") {
    let nextBtn = document.getElementById("nextTurnButton");
    if (nextBtn) {
      nextBtn.innerHTML = `<b style="color:red;">防衛開始</b>`;
    }
    let autoAssignBtn = document.getElementById("autoAssignButton");
    if (autoAssignBtn) {
      autoAssignBtn.textContent = "自動割り振り";
    }
    const raidAssignBtn = document.getElementById("raidAssignButton");
    if (raidAssignBtn) {
      raidAssignBtn.style.display = "";
    }
  }

  const representative = getRaidRepresentative(raidDefinition, village.raidEnemies);
  showRaidWarningModal({
    raidName: raidDefinition.warningName || raidDefinition.name,
    representative,
    introDialogues: raidDefinition.introDialogues,
    enemyCount,
    avoidanceOptions: createRaidAvoidanceOptions(village, raidDefinition),
    onAvoidance: option => executeRaidAvoidance(village, raidDefinition, option)
  });

  if (typeof document !== "undefined") {
    const raidSection = document.getElementById("raidEnemiesSection");
    if (raidSection) raidSection.style.display = "block";
  }
}
