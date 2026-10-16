import { runAutosave } from "./gameSettings.js";
import { updateUI } from "./ui.js";
import { doFixedEventPost, endOfMonthProcess, doAgingProcess, runMonthStartPhase } from "./events.js";
import { handleAllVillagerJobs } from "./jobs.js";
import { applyForcedActionRestriction, refreshJobTable } from "./domain/jobTables.js";
import { getActiveVillagers } from "./domain/apocalypseRules.js";
import { BUILDINGS, damageRandomBuilding } from "./buildings.js";
import {
  countDamagedBuildings,
  recalculateBuildingDerivedState,
  repairDamagedBuilding
} from "./domain/buildingState.js";
import { clampStoredResources } from "./domain/resourceLimits.js";
import {
  ACTION_TRAP,
  estimateRaidActionDamage,
  getActiveRaidFrontliners,
  getActiveRaidMiddleliners,
  getActiveRaidTrapMakers,
  getAverageEnemyAttack,
  getEnemyTotalHp,
  getRaidIncomingDamageMultiplier
} from "./raidRules.js";

const STOP_BODY_TRAITS = ["危篤", "飢餓", "凍え"];
const STOP_MIND_TRAITS = ["絶望"];
const MAX_MONTHS = 12;
const REPORT_MODAL_ID = "yearAdvanceReportModal";
const REPORT_OVERLAY_ID = "yearAdvanceReportOverlay";
const BUTTON_ID = "yearAdvanceButton";

function monthLabel(village) {
  return `${village.year}年${village.month}月`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function getDangerStates(village) {
  return getActiveVillagers(village).flatMap(person => {
    const body = STOP_BODY_TRAITS.filter(trait => person.bodyTraits?.includes(trait));
    const mind = STOP_MIND_TRAITS.filter(trait => person.mindTraits?.includes(trait));
    return [...body, ...mind].map(trait => ({ person, trait }));
  });
}

function applyTurnStartRestrictions(village) {
  village.villagers.forEach(person => {
    const restriction = applyForcedActionRestriction(person);
    if (restriction.restricted && restriction.changed) {
      village.log(`${person.name}は${restriction.reason}のため、行動を「${restriction.action}」に設定しました`);
    }
  });
}

function getRepairCosts(building) {
  return {
    materials: Math.ceil((Number(building.materials) || 0) / 2),
    funds: Math.ceil((Number(building.funds) || 0) / 2),
    tech: Math.ceil((Number(building.tech) || 0) / 2)
  };
}

function canAfford(village, costs) {
  return village.materials >= costs.materials &&
    village.funds >= costs.funds &&
    village.tech >= costs.tech;
}

function autoRepairBuildings(village, report) {
  let repaired = false;
  BUILDINGS.forEach(building => {
    while (countDamagedBuildings(village, building.id) > 0) {
      const costs = getRepairCosts(building);
      if (!canAfford(village, costs)) break;
      if (!repairDamagedBuilding(village, building.id)) break;
      village.materials -= costs.materials;
      village.funds -= costs.funds;
      village.tech -= costs.tech;
      repaired = true;
      const costText = [
        costs.materials ? `資材${costs.materials}` : "",
        costs.funds ? `資金${costs.funds}` : "",
        costs.tech ? `技術${costs.tech}` : ""
      ].filter(Boolean).join("・");
      village.log(`【年次自動修復】${building.name}を修復${costText ? `（${costText}）` : ""}`);
      report.events.push({ month: monthLabel(village), text: `${building.name}を自動修復${costText ? `（${costText}）` : ""}` });
    }
  });
  if (repaired) {
    recalculateBuildingDerivedState(village);
    clampStoredResources(village);
    village.villagers.forEach(person => refreshJobTable(person, village));
  }
}

function clearRaidState(village) {
  village.villageTraits = (village.villageTraits || []).filter(trait => trait !== "襲撃中");
  village.currentRaid = null;
  village.pendingRaid = null;
  village.raidEnemies = [];
  village.isRaidProcessDone = true;
  village.isRaidFinalizing = false;
  village.raidActionQueue = [];
  village.raidPhase = "";
  village.currentActionIndex = 0;
  village.raidTurnCount = 0;
}

function addTrait(person, trait) {
  if (!Array.isArray(person.bodyTraits)) person.bodyTraits = [];
  if (!person.bodyTraits.includes(trait)) person.bodyTraits.push(trait);
}

function sample(items, count) {
  const pool = [...items];
  const result = [];
  while (pool.length > 0 && result.length < count) {
    result.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return result;
}

function applyRaidCasualties(village, tier, participants) {
  const eligible = participants.length > 0 ? participants : getActiveVillagers(village);
  if (eligible.length === 0) return [];

  const plans = {
    overwhelming: { count: 1, chance: 0.25, severe: 0, fatal: 0 },
    win: { count: 2, chance: 0.55, severe: 0.12, fatal: 0 },
    close: { count: 4, chance: 0.9, severe: 0.35, fatal: 0.08 },
    loss: { count: 5, chance: 1, severe: 0.55, fatal: 0.18 },
    disaster: { count: 7, chance: 1, severe: 0.7, fatal: 0.3 }
  };
  const plan = plans[tier];
  const victims = sample(eligible, Math.min(plan.count, eligible.length));
  const results = [];
  victims.forEach(person => {
    if (Math.random() > plan.chance) return;
    const roll = Math.random();
    let trait = "負傷";
    let damage = 20 + Math.floor(Math.random() * 16);
    if (roll < plan.fatal) {
      trait = "致命傷";
      damage = 55 + Math.floor(Math.random() * 21);
    } else if (roll < plan.fatal + plan.severe) {
      trait = "重体";
      damage = 40 + Math.floor(Math.random() * 21);
    }
    person.hp = Math.max(1, (Number(person.hp) || 100) - damage);
    addTrait(person, trait);
    results.push({ person, trait });
  });
  return results;
}

function applyRaidBuildingDamage(village, tier) {
  const plans = {
    overwhelming: [0, 0],
    win: [0.05, 1],
    close: [0.2, 2],
    loss: [0.5, 3],
    disaster: [0.8, 4]
  };
  const [chance, max] = plans[tier];
  if (Math.random() >= chance) return 0;
  const count = 1 + Math.floor(Math.random() * max);
  let damaged = 0;
  for (let i = 0; i < count; i++) {
    if (damageRandomBuilding(village)) damaged++;
  }
  return damaged;
}

function applyRaidResourceLoss(village, tier) {
  const ranges = {
    overwhelming: [0, 0],
    win: [0, 0],
    close: [0, 0],
    loss: [0.05, 0.15],
    disaster: [0.1, 0.3]
  };
  const [min, max] = ranges[tier];
  if (max <= 0) return null;
  const rate = min + Math.random() * (max - min);
  const loss = {};
  ["food", "materials", "funds"].forEach(key => {
    loss[key] = Math.floor((Number(village[key]) || 0) * rate);
    village[key] = Math.max(0, (Number(village[key]) || 0) - loss[key]);
  });
  return loss;
}

function resolveSimplifiedRaid(village, report) {
  const enemies = Array.isArray(village.raidEnemies) ? village.raidEnemies.filter(enemy => (Number(enemy.hp) || 0) > 0) : [];
  if (!village.currentRaid && enemies.length === 0 && !village.villageTraits?.includes("襲撃中")) return null;

  village.villagers.forEach(person => refreshJobTable(person, village));
  const front = getActiveRaidFrontliners(village);
  const middle = getActiveRaidMiddleliners(village);
  const traps = getActiveRaidTrapMakers(village);
  const combatants = [...front, ...middle];
  const raidName = village.currentRaid?.warningName || village.currentRaid?.name || village.currentRaid?.id || "襲撃者";
  const enemyCount = enemies.length;
  const enemyHp = Math.max(1, getEnemyTotalHp(village));
  const averageEnemyAttack = Math.max(1, getAverageEnemyAttack(village));

  const friendlyDamage = combatants.reduce((sum, person) => sum + estimateRaidActionDamage(person, person.action, village), 0);
  const trapPower = traps.reduce((sum, person) => sum + estimateRaidActionDamage(person, ACTION_TRAP, village), 0);
  const mitigation = Math.min(0.25, trapPower / Math.max(1, enemyHp) * 0.25);
  const friendlyThreeTurn = Math.max(1, friendlyDamage * 3 + trapPower);

  const participantHp = Math.max(1, combatants.reduce((sum, person) => sum + Math.max(1, Number(person.hp) || 1), 0));
  const incomingMultiplier = combatants.length > 0
    ? combatants.reduce((sum, person) => sum + getRaidIncomingDamageMultiplier(person.action, village), 0) / combatants.length
    : 1.5;
  const enemyPressure = averageEnemyAttack * Math.max(1, enemyCount) * 3 * incomingMultiplier * (1 - mitigation);

  const offenseRatio = friendlyThreeTurn / enemyHp;
  const survivalRatio = participantHp / Math.max(1, enemyPressure);
  const randomFactor = 0.85 + Math.random() * 0.3;
  const score = ((offenseRatio * 0.65) + (survivalRatio * 0.35)) * randomFactor;

  let tier = "disaster";
  if (score >= 1.6) tier = "overwhelming";
  else if (score >= 1.2) tier = "win";
  else if (score >= 0.8) tier = "close";
  else if (score >= 0.5) tier = "loss";
  const labels = {
    overwhelming: "圧勝",
    win: "勝利",
    close: "辛勝",
    loss: "敗北",
    disaster: "壊滅的敗北"
  };

  const casualties = applyRaidCasualties(village, tier, combatants);
  const damagedBuildings = applyRaidBuildingDamage(village, tier);
  const resourceLoss = applyRaidResourceLoss(village, tier);
  const injuryText = casualties.length > 0
    ? casualties.map(item => `${item.person.name}：${item.trait}`).join("、")
    : "人的被害なし";
  const buildingText = damagedBuildings > 0 ? `、建築損壊${damagedBuildings}件` : "";
  const lossText = resourceLoss
    ? `、略奪 食料${resourceLoss.food}・資材${resourceLoss.materials}・資金${resourceLoss.funds}`
    : "";
  village.log(`【年次簡易襲撃】${raidName}${enemyCount ? `${enemyCount}体` : ""}：${labels[tier]}。${injuryText}${buildingText}${lossText}`);
  report.events.push({
    month: monthLabel(village),
    text: `${raidName}${enemyCount ? ` ${enemyCount}体` : ""}の襲撃 ― ${labels[tier]}（${injuryText}${buildingText}${lossText}）`
  });
  clearRaidState(village);
  return tier;
}

function clickButtonByText(root, text) {
  const buttons = Array.from(root?.querySelectorAll?.("button") || []);
  const button = buttons.find(item => item.textContent.trim() === text);
  if (!button) return false;
  button.click();
  return true;
}

function drainAutoModals() {
  if (typeof document === "undefined") return;
  for (let guard = 0; guard < 30; guard++) {
    let progressed = false;
    const randomModal = document.getElementById("randomEventModal");
    if (randomModal && clickButtonByText(randomModal, "村で飼う")) {
      progressed = true;
      continue;
    }
    const birthButton = document.querySelector("[data-leave-name]");
    if (birthButton) {
      birthButton.click();
      progressed = true;
      continue;
    }
    const reproduction = document.querySelector("[data-close-reproduction-modal]")?.closest(".event-modal") ||
      document.querySelector(".reproduction-modal");
    if (reproduction) {
      if (!clickButtonByText(reproduction, "閉じる")) {
        document.querySelector("[data-close-reproduction-modal]")?.click();
      }
      progressed = true;
      continue;
    }
    if (!progressed) break;
  }

  const disposableSelectors = [
    "#randomEventModal", "#randomEventOverlay",
    "#festivalModal", "#festivalOverlay",
    "#seasonChangeDialog", "#seasonChangeOverlay",
    "#buildingRequestModal", "#buildingRequestOverlay",
    "#buildingRequestCompleteModal", "#buildingRequestCompleteOverlay",
    "#wishModal", "#wishOverlay", "#wishCompleteModal", "#wishCompleteOverlay",
    "#raidWarningModal", "#raidWarningOverlay",
    "#villageScaleModal", "#villageScaleOverlay",
    "#divineMightLevelUpModal", "#divineMightLevelUpOverlay",
    "#headmanElectionModal", "#headmanElectionOverlay",
    "#adventurerQuestResultModal", "#adventurerQuestResultOverlay"
  ];
  disposableSelectors.forEach(selector => document.querySelectorAll(selector).forEach(node => node.remove()));
  document.querySelectorAll("[data-close-relationship-modal]").forEach(button => button.click());
}

function parseImportantLogs(logs, report, label) {
  logs.forEach(log => {
    let match = String(log).match(/^落雷2:(.+)と(.+)の肉体交換$/);
    if (match) {
      report.events.push({ month: label, text: `雷により${match[1]}と${match[2]}の肉体が交換された` });
      return;
    }
    match = String(log).match(/^(.+)（0歳の狼）を村で飼うことにした。$/);
    if (match) {
      report.events.push({ month: label, text: `迷い狼${match[1]}を迎え入れた` });
      return;
    }
    const importantPrefixes = [
      "妊娠", "出産", "誕生", "死亡", "老衰", "破局", "結婚", "恋人", "復縁",
      "願望達成", "願望消失", "願望発生", "要望発生", "要望達成", "要望取り下げ"
    ];
    if (importantPrefixes.some(prefix => String(log).includes(prefix))) {
      report.events.push({ month: label, text: String(log).replace(/^【[^】]+】/, "").trim() });
    }
  });
}

function formatDelta(before, after) {
  const delta = after - before;
  return `${before} → ${after}（${delta >= 0 ? "+" : ""}${delta}）`;
}

function createReport(village) {
  return {
    startLabel: monthLabel(village),
    startPopulation: getActiveVillagers(village).length,
    startResources: {
      food: Number(village.food) || 0,
      materials: Number(village.materials) || 0,
      funds: Number(village.funds) || 0,
      tech: Number(village.tech) || 0,
      mana: Number(village.mana) || 0
    },
    events: [],
    months: 0,
    stopReason: ""
  };
}

function showYearReport(village, report) {
  document.getElementById(REPORT_OVERLAY_ID)?.remove();
  document.getElementById(REPORT_MODAL_ID)?.remove();

  const resources = {
    food: Number(village.food) || 0,
    materials: Number(village.materials) || 0,
    funds: Number(village.funds) || 0,
    tech: Number(village.tech) || 0,
    mana: Number(village.mana) || 0
  };
  const population = getActiveVillagers(village).length;
  const eventHtml = report.events.length > 0
    ? report.events.map(item => `<li><span class="year-advance-event-month">${escapeHtml(item.month)}</span>${escapeHtml(item.text)}</li>`).join("")
    : "<li>特筆すべき出来事はありませんでした。</li>";

  const overlay = document.createElement("div");
  overlay.id = REPORT_OVERLAY_ID;
  overlay.className = "year-advance-report-overlay";
  const modal = document.createElement("div");
  modal.id = REPORT_MODAL_ID;
  modal.className = "year-advance-report-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="year-advance-report-head">
      <div>
        <p class="year-advance-kicker">POST-APOCALYPSE CHRONICLE</p>
        <h2>一年の記録</h2>
        <p>${escapeHtml(report.startLabel)} → ${escapeHtml(monthLabel(village))} / ${report.months}か月経過</p>
      </div>
      <button type="button" class="year-advance-close" aria-label="閉じる">×</button>
    </div>
    ${report.stopReason ? `<div class="year-advance-stop"><strong>自動経過を中断</strong><span>${escapeHtml(report.stopReason)}</span></div>` : ""}
    <div class="year-advance-summary-grid">
      <section><h3>人口</h3><strong>${report.startPopulation} → ${population}</strong><span>${population - report.startPopulation >= 0 ? "+" : ""}${population - report.startPopulation}人</span></section>
      <section><h3>食料</h3><strong>${escapeHtml(formatDelta(report.startResources.food, resources.food))}</strong></section>
      <section><h3>資材</h3><strong>${escapeHtml(formatDelta(report.startResources.materials, resources.materials))}</strong></section>
      <section><h3>資金</h3><strong>${escapeHtml(formatDelta(report.startResources.funds, resources.funds))}</strong></section>
      <section><h3>技術</h3><strong>${escapeHtml(formatDelta(report.startResources.tech, resources.tech))}</strong></section>
      <section><h3>魔素</h3><strong>${escapeHtml(formatDelta(report.startResources.mana, resources.mana))}</strong></section>
    </div>
    <section class="year-advance-events">
      <h3>主な出来事</h3>
      <ol>${eventHtml}</ol>
    </section>
    <div class="year-advance-footer"><button type="button" data-close-year-report>村へ戻る</button></div>
  `;
  const close = () => { overlay.remove(); modal.remove(); };
  overlay.addEventListener("click", close);
  modal.querySelector(".year-advance-close")?.addEventListener("click", close);
  modal.querySelector("[data-close-year-report]")?.addEventListener("click", close);
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

function installStyle() {
  if (document.getElementById("yearAdvanceStyle")) return;
  const style = document.createElement("style");
  style.id = "yearAdvanceStyle";
  style.textContent = `
    #${BUTTON_ID}{background:linear-gradient(135deg,#5d4932,#806742);color:#fff;border:1px solid #3e3123;font-weight:700;letter-spacing:.04em}
    #${BUTTON_ID}:hover{filter:brightness(1.08)}
    #${BUTTON_ID}[hidden]{display:none!important}
    .year-advance-report-overlay{position:fixed;inset:0;background:rgba(18,15,11,.68);z-index:10020;backdrop-filter:blur(2px)}
    .year-advance-report-modal{position:fixed;z-index:10021;top:50%;left:50%;transform:translate(-50%,-50%);width:min(760px,calc(100vw - 28px));max-height:88vh;overflow:auto;background:#f4eddd;border:1px solid #675239;border-radius:10px;box-shadow:0 24px 70px rgba(0,0,0,.35);color:#2b241c}
    .year-advance-report-head{display:flex;justify-content:space-between;gap:18px;padding:22px 24px 18px;background:linear-gradient(135deg,#332a22,#5b4734);color:#f8f1df;border-radius:9px 9px 0 0}
    .year-advance-report-head h2{margin:2px 0 4px;font-size:1.65rem}.year-advance-report-head p{margin:0}.year-advance-kicker{font-size:.72rem;letter-spacing:.16em;opacity:.72}
    .year-advance-close{align-self:flex-start;background:transparent;border:0;color:#fff;font-size:1.8rem;line-height:1;cursor:pointer}
    .year-advance-stop{display:flex;gap:12px;align-items:center;margin:16px 20px 0;padding:12px 14px;background:#ead4c8;border-left:5px solid #874b36}.year-advance-stop span{font-size:.92rem}
    .year-advance-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:18px 20px 8px}.year-advance-summary-grid section{background:#fffaf0;border:1px solid #d4c6ae;border-radius:7px;padding:12px}.year-advance-summary-grid h3{margin:0 0 7px;font-size:.78rem;color:#76634e}.year-advance-summary-grid strong{display:block;font-size:1.02rem}.year-advance-summary-grid span{display:block;margin-top:3px;font-size:.8rem;color:#6b5a48}
    .year-advance-events{padding:10px 20px 4px}.year-advance-events h3{margin:0 0 8px;border-bottom:1px solid #cbbba3;padding-bottom:7px}.year-advance-events ol{margin:0;padding-left:22px}.year-advance-events li{padding:7px 0;border-bottom:1px dotted #d6c8b3;line-height:1.45}.year-advance-event-month{display:inline-block;min-width:92px;font-weight:700;color:#785e3f;margin-right:8px}
    .year-advance-footer{display:flex;justify-content:flex-end;padding:14px 20px 20px}.year-advance-footer button{padding:8px 18px;font-weight:700}
    @media(max-width:620px){.year-advance-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.year-advance-event-month{display:block;min-width:0;margin-bottom:2px}}
  `;
  document.head.appendChild(style);
}

function canUseYearAdvance(village) {
  return village?.apocalypseCleared === true &&
    village?.apocalypseStarted !== true &&
    !village?.gameOver &&
    !village?.currentRaid &&
    !village?.villageTraits?.includes("襲撃中");
}

function syncButton(village) {
  const button = document.getElementById(BUTTON_ID);
  if (!button) return;
  button.hidden = !canUseYearAdvance(village);
}

export async function advanceOneYear(village) {
  if (!canUseYearAdvance(village)) return;
  const dangerBefore = getDangerStates(village);
  if (dangerBefore.length > 0) {
    const text = dangerBefore.map(item => `${item.person.name}：${item.trait}`).join("、");
    window.alert(`危険状態の村人がいるため1年経過できません。\n${text}`);
    return;
  }
  if (!window.confirm("現在の行動設定を維持したまま、最大12か月を自動で進めます。\n危篤・飢餓・凍え・絶望が発生した場合はその月で中断します。\n襲撃は簡易処理、損壊建物は資源があれば自動修復します。\n進めますか？")) return;

  const report = createReport(village);
  const button = document.getElementById(BUTTON_ID);
  if (button) button.disabled = true;

  try {
    for (let index = 0; index < MAX_MONTHS; index++) {
      autoRepairBuildings(village, report);
      applyTurnStartRestrictions(village);
      const logStart = village.logs.length;

      handleAllVillagerJobs(village);
      doFixedEventPost(village);
      endOfMonthProcess(village);
      drainAutoModals();

      if (getActiveVillagers(village).length === 0) {
        village.gameOver = true;
        report.stopReason = "村人がいなくなりました。";
        break;
      }

      village.month++;
      if (village.month > 12) {
        village.month = 1;
        village.year++;
      }
      village.hasDonePreEvent = false;
      village.hasDonePostEvent = false;
      village.log(`=== ${village.year}年${village.month}月 ===`);
      if (village.month === 1) doAgingProcess(village);
      runMonthStartPhase(village);
      drainAutoModals();
      resolveSimplifiedRaid(village, report);
      drainAutoModals();

      report.months++;
      const newLogs = village.logs.slice(logStart);
      parseImportantLogs(newLogs, report, monthLabel(village));
      updateUI(village);
      await new Promise(resolve => setTimeout(resolve, 0));

      const danger = getDangerStates(village);
      if (danger.length > 0) {
        report.stopReason = danger.map(item => `${item.person.name}が${item.trait}状態`).join("、");
        break;
      }
      if (village.gameOver) {
        report.stopReason = "ゲームオーバーになりました。";
        break;
      }
      runAutosave(village);
    }
  } finally {
    updateUI(village);
    runAutosave(village);
    if (button) button.disabled = false;
    syncButton(village);
    showYearReport(village, report);
  }
}

export function installYearAdvanceFeature(village) {
  if (typeof document === "undefined") return;
  installStyle();
  let button = document.getElementById(BUTTON_ID);
  if (!button) {
    button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "1年経過";
    button.title = "黙示録クリア後に、村の営みを最大12か月自動で進める";
    button.addEventListener("click", () => advanceOneYear(village));
    document.getElementById("nextTurnButton")?.insertAdjacentElement("afterend", button);
  }
  syncButton(village);
  const resourcePanel = document.getElementById("resourcePanel");
  if (resourcePanel) {
    const observer = new MutationObserver(() => syncButton(village));
    observer.observe(resourcePanel, { childList: true, subtree: true, characterData: true });
  }
}
