import { getPermanentStat, syncEffectiveStats } from "./domain/statLayers.js";
import { HISTORY_EVENT_TYPES, recordHeadmanElectionHistory } from "./history.js";
import { parseRelationship, normalizeRelationships } from "./relationships.js";
import { grantTitle, incrementTitleCounter, TITLE_COUNTER_KEYS } from "./titles.js";

const HEADMAN_TRAIT = "里長";
const ELECTION_MONTH = 7;
const ELECTION_INTERVAL_YEARS = 3;
const ASSEMBLY_HALL_ID = "assemblyHall";
const ELECTION_IMAGE = "../images/events/headman-election.jpg";
const RANKED_STATS = ["cou", "eth", "ind", "str", "int"];
const MODAL_OVERLAY_ID = "headmanElectionOverlay";
const MODAL_ID = "headmanElectionModal";
const PRIORITY_MODAL_SELECTORS = [
  "#actionPhaseModal",
  "#seasonChangeDialog",
  "#festivalModal",
  "#randomEventModal",
  ".effect-result-modal",
  "#secretTreasureEventModal"
];

let pendingElectionMessage = null;
let modalObserver = null;

function hasAssemblyHall(village) {
  return !!(
    village?.buildingFlags?.hasAssemblyHall ||
    (Array.isArray(village?.buildings) && village.buildings.includes(ASSEMBLY_HALL_ID))
  );
}

function hasMindTrait(person, trait) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.includes(trait);
}

function isAdultMind(person) {
  return (Number(person?.spiritAge) || 0) >= 16;
}

function getCurrentHeadmen(village) {
  return (village.villagers || []).filter(person => hasMindTrait(person, HEADMAN_TRAIT));
}

function getCandidates(village) {
  return (village.villagers || []).filter(person => isAdultMind(person) && !hasMindTrait(person, HEADMAN_TRAIT));
}

function getVoters(village) {
  return (village.villagers || []).filter(isAdultMind);
}

function stat(person, key) {
  return Number(getPermanentStat(person, key)) || 0;
}

function impressionScore(candidate) {
  const chr = stat(candidate, "chr");
  if (chr <= 8) return -14;
  if (chr <= 12) return -8;
  if (chr <= 19) return 0;
  if (chr <= 24) return 2;
  return 5;
}

function concernScore(candidate) {
  let score = 0;
  ["ind", "eth"].forEach(key => {
    const value = stat(candidate, key);
    if (value <= 8) score -= 5;
    else if (value <= 12) score -= 3;
  });
  return score;
}

function excellenceScore(candidate) {
  return ["str", "int", "ind", "eth", "cou"].reduce((score, key) => {
    return score + (stat(candidate, key) >= 25 ? 3 : 0);
  }, 0);
}

function getOldestSpiritAge(candidates) {
  return Math.max(...candidates.map(candidate => Number(candidate.spiritAge) || 0));
}

function buildRankMaps(candidates) {
  const maps = {};
  RANKED_STATS.forEach(key => {
    const values = [...new Set(candidates.map(candidate => stat(candidate, key)))].sort((a, b) => b - a);
    maps[key] = new Map();
    candidates.forEach(candidate => {
      const index = values.indexOf(stat(candidate, key));
      maps[key].set(candidate, index === 0 ? 1 : (index === 1 ? 2 : index + 1));
    });
  });
  return maps;
}

function relationshipScore(voter, candidate) {
  normalizeRelationships(voter);
  const relations = Array.isArray(voter.relationships) ? voter.relationships : [];
  let hasPositive = false;

  for (const rel of relations) {
    const parsed = parseRelationship(rel);
    if (!parsed || parsed.target !== candidate.name) continue;
    const prefix = parsed.prefix;
    if (prefix === "天敵") return -99;
    if (
      prefix === "恋人" ||
      prefix === "親友" ||
      prefix === "夫" ||
      prefix === "妻" ||
      prefix === "母" ||
      prefix === "父" ||
      prefix === "親" ||
      prefix === "子" ||
      String(prefix).endsWith("仲間")
    ) {
      hasPositive = true;
    }
  }

  return hasPositive ? 6 : 0;
}

function voterValueScore(voter, candidate, rankMaps) {
  let score = 0;
  RANKED_STATS.forEach(key => {
    if (stat(voter, key) < 18) return;
    const rank = rankMaps[key].get(candidate);
    if (rank === 1) score += 6;
    else if (rank === 2) score += 3;
  });
  return score;
}

function candidateScore(voter, candidate, context) {
  let score = 0;
  score += impressionScore(candidate);
  score += concernScore(candidate);
  score += excellenceScore(candidate);
  if ((Number(candidate.spiritAge) || 0) === context.oldestSpiritAge) score += 5;
  const relation = relationshipScore(voter, candidate);
  if (relation <= -99) return relation;
  score += relation;
  score += voterValueScore(voter, candidate, context.rankMaps);
  return score;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function chooseVote(voter, candidates, context) {
  const options = candidates.filter(candidate => candidate !== voter);
  if (options.length === 0) return null;
  const scored = options.map(candidate => ({
    candidate,
    score: candidateScore(voter, candidate, context)
  }));
  const best = Math.max(...scored.map(item => item.score));
  return pickRandom(scored.filter(item => item.score === best)).candidate;
}

function formatVoteCounts(candidates, voteCounts) {
  return candidates
    .map(candidate => `${candidate.name}${voteCounts.get(candidate) || 0}票`)
    .join("、");
}

function appointHeadman(village, headman) {
  (village.villagers || []).forEach(person => {
    person.mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
    syncEffectiveStats(person);
  });
  (village.villagers || []).forEach(person => {
    person.mindTraits = person.mindTraits.filter(trait => trait !== HEADMAN_TRAIT);
  });
  headman.mindTraits.push(HEADMAN_TRAIT);
  (village.villagers || []).forEach(syncEffectiveStats);
}

function hasRecordedHeadman(village) {
  return Array.isArray(village?.historyEvents) && village.historyEvents.some(event => {
    return event?.type === HISTORY_EVENT_TYPES.HEADMAN_ELECTION &&
      Array.isArray(event.people) &&
      event.people.length > 0;
  });
}

function recordHeadmanTitleProgress(village, headman) {
  if (!headman) return;
  const isFirstHeadman = !hasRecordedHeadman(village);
  incrementTitleCounter(headman, TITLE_COUNTER_KEYS.HEADMAN_TERMS, 1, { getPermanentStat });
  if (isFirstHeadman) {
    grantTitle(headman, "firstHeadman");
  }
}

function markElectionResolved(village) {
  village.lastHeadmanElectionYear = Number(village.year) || 0;
  village.nextHeadmanElectionYear = village.lastHeadmanElectionYear + ELECTION_INTERVAL_YEARS;
}

function markElectionFailed(village) {
  village.nextHeadmanElectionYear = (Number(village.year) || 0) + 1;
}

export function isHeadmanElectionModalPendingOrOpen() {
  if (pendingElectionMessage) return true;
  if (typeof document === "undefined") return false;
  return !!document.getElementById(MODAL_ID);
}

function isPriorityModalOpen() {
  return PRIORITY_MODAL_SELECTORS.some(selector => document.querySelector(selector));
}

function waitForPriorityModalsToClose() {
  if (modalObserver) return;
  modalObserver = new MutationObserver(showElectionModalWhenReady);
  modalObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function stopWaitingForPriorityModals() {
  if (!modalObserver) return;
  modalObserver.disconnect();
  modalObserver = null;
}

function shouldHoldHeadmanElection(village) {
  if ((Number(village.month) || 0) !== ELECTION_MONTH) return false;
  if (!hasAssemblyHall(village)) return false;

  const year = Number(village.year) || 0;
  const nextYear = Number(village.nextHeadmanElectionYear);
  if (Number.isFinite(nextYear) && nextYear > 0) return year >= nextYear;

  const lastYear = Number(village.lastHeadmanElectionYear);
  if (Number.isFinite(lastYear) && lastYear > 0) return year >= lastYear + ELECTION_INTERVAL_YEARS;

  return true;
}

function showElectionResult(village, message) {
  village.log(message.replace(/\n/g, " "));
  if (typeof document !== "undefined") {
    pendingElectionMessage = message;
    closeHeadmanElectionModal();
    showElectionModalWhenReady();
  }
}

function showElectionModalWhenReady() {
  if (!pendingElectionMessage) {
    stopWaitingForPriorityModals();
    return;
  }
  if (isPriorityModalOpen()) {
    waitForPriorityModalsToClose();
    return;
  }

  stopWaitingForPriorityModals();
  const message = pendingElectionMessage;
  pendingElectionMessage = null;

  const overlay = document.createElement("div");
  overlay.id = MODAL_OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(18, 13, 8, 0.52);
    z-index: 2000;
  `;

  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    box-sizing: border-box;
    width: min(720px, 92vw);
    min-height: min(360px, 84vh);
    max-height: 84vh;
    overflow-y: auto;
    color: #fffaf0;
    border: 1px solid rgba(255, 240, 190, 0.58);
    border-radius: 8px;
    box-shadow: 0 20px 48px rgba(0, 0, 0, 0.38);
    background-image:
      linear-gradient(90deg, rgba(18, 12, 7, 0.92), rgba(18, 12, 7, 0.76) 52%, rgba(18, 12, 7, 0.48)),
      url("${new URL(ELECTION_IMAGE, import.meta.url).href}");
    background-size: cover;
    background-position: center;
    z-index: 2001;
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    box-sizing: border-box;
    min-height: min(360px, 84vh);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 14px;
    padding: clamp(22px, 5vw, 42px);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.78);
  `;

  const title = document.createElement("h2");
  title.textContent = "里長選挙";
  title.style.cssText = "margin:0;color:#ffe3a1;font-size:clamp(2rem, 7vw, 3.35rem);line-height:1;letter-spacing:0;";

  const body = document.createElement("p");
  body.textContent = message;
  body.style.cssText = "max-width:38rem;margin:0;line-height:1.7;white-space:pre-line;font-size:clamp(0.98rem, 2.6vw, 1.12rem);";

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;justify-content:flex-end;margin-top:4px;";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "閉じる";
  closeButton.style.cssText = `
    min-width: 88px;
    padding: 8px 16px;
    color: #2d2112;
    background: #ffe3a1;
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  `;
  closeButton.onclick = closeHeadmanElectionModal;

  buttons.appendChild(closeButton);
  content.appendChild(title);
  content.appendChild(body);
  content.appendChild(buttons);
  modal.appendChild(content);

  overlay.onclick = closeHeadmanElectionModal;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  closeButton.focus();
}

export function closeHeadmanElectionModal() {
  const overlay = document.getElementById(MODAL_OVERLAY_ID);
  const modal = document.getElementById(MODAL_ID);
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function runElection(village) {
  const candidates = getCandidates(village);
  const currentHeadman = getCurrentHeadmen(village)[0] || null;

  if (candidates.length === 0) {
    if (currentHeadman) {
      appointHeadman(village, currentHeadman);
      markElectionResolved(village);
      recordHeadmanTitleProgress(village, currentHeadman);
      recordHeadmanElectionHistory(village, currentHeadman, { result: "continued" });
      showElectionResult(village, [
        "集会所に村人たちが集まり、里長選挙が行われた。",
        `新たに立つ者はなく、現里長${currentHeadman.name}が引き続き里長を務めることになった。`
      ].join("\n"));
    } else {
      markElectionFailed(village);
      recordHeadmanElectionHistory(village, null, { result: "failed" });
      showElectionResult(village, [
        "集会所に村人たちが集まったが、里長に立つ者はいなかった。",
        "選挙は不成立となり、里長不在のまま来年の七月に改めて選ぶことになった。"
      ].join("\n"));
    }
    return;
  }

  if (candidates.length === 1) {
    const winner = candidates[0];
    appointHeadman(village, winner);
    markElectionResolved(village);
    recordHeadmanTitleProgress(village, winner);
    recordHeadmanElectionHistory(village, winner, { result: "uncontested" });
    showElectionResult(village, [
      "集会所に村人たちが集まり、里長選挙が行われた。",
      `候補者は${winner.name}のみで、無投票により新たな里長に選ばれた。`
    ].join("\n"));
    return;
  }

  const context = {
    oldestSpiritAge: getOldestSpiritAge(candidates),
    rankMaps: buildRankMaps(candidates)
  };
  const voteCounts = new Map(candidates.map(candidate => [candidate, 0]));

  getVoters(village).forEach(voter => {
    const voted = chooseVote(voter, candidates, context);
    if (voted) voteCounts.set(voted, (voteCounts.get(voted) || 0) + 1);
  });

  const topVotes = Math.max(...Array.from(voteCounts.values()));
  const topCandidates = candidates.filter(candidate => (voteCounts.get(candidate) || 0) === topVotes);
  const winner = pickRandom(topCandidates);
  appointHeadman(village, winner);
  markElectionResolved(village);
  recordHeadmanTitleProgress(village, winner);

  const counts = formatVoteCounts(candidates, voteCounts);
  recordHeadmanElectionHistory(village, winner, {
    result: topCandidates.length > 1 ? "lottery" : "elected",
    counts
  });
  if (topCandidates.length > 1) {
    showElectionResult(village, [
      "集会所に村人たちが集まり、里長選挙が行われた。",
      `得票: ${counts}`,
      "最多得票が並んだため、くじ引きで新里長が決められた。",
      `くじを引き当てた${winner.name}が新たな里長となった。`
    ].join("\n"));
  } else {
    showElectionResult(village, [
      "集会所に村人たちが集まり、里長選挙が行われた。",
      `得票: ${counts}`,
      `得票の結果、${winner.name}が新たな里長に選ばれた。`
    ].join("\n"));
  }
}

export function runHeadmanElectionIfDue(village) {
  if (!shouldHoldHeadmanElection(village)) return false;
  runElection(village);
  return true;
}
