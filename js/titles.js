const TITLE_DEFINITIONS = Object.freeze({
  firstHeadman: {
    id: "firstHeadman",
    name: "初代里長",
    description: "村で最初に里長を務めた。"
  },
  headmanThreeTerms: {
    id: "headmanThreeTerms",
    name: "三度の里長",
    description: "里長を通算3回務めた。"
  },
  recruitmentSuccess3: {
    id: "recruitmentSuccess3",
    name: "村の招き手",
    description: "勧誘を3回成功させた。"
  },
  seductionSuccess3: {
    id: "seductionSuccess3",
    name: "艶聞の誘い手",
    description: "誘惑を3回成功させた。"
  },
  strengthCourage25: {
    id: "strengthCourage25",
    name: "剛勇の担い手",
    description: "一時効果を除いた筋力と勇気が25以上になった。"
  },
  charmLust25Male: {
    id: "charmLust25Male",
    name: "色香の男",
    description: "男性肉体で、一時効果を除いた魅力と好色が25以上になった。"
  },
  charmLust25Female: {
    id: "charmLust25Female",
    name: "艶華の女",
    description: "女性肉体で、一時効果を除いた魅力と好色が25以上になった。"
  },
  charmLust25Other: {
    id: "charmLust25Other",
    name: "艶光の者",
    description: "一時効果を除いた魅力と好色が25以上になった。"
  },
  huntCritical5: {
    id: "huntCritical5",
    name: "山影の狩人",
    description: "狩猟で大成功を5回出した。"
  },
  fishCritical5: {
    id: "fishCritical5",
    name: "潮読み",
    description: "漁で大成功を5回出した。"
  },
  tradingCritical5: {
    id: "tradingCritical5",
    name: "市の目利き",
    description: "行商で大成功を5回出した。"
  }
});

const DEFAULT_TITLE_STATS = Object.freeze({
  recruitmentSuccess: 0,
  seductionSuccess: 0,
  headmanTerms: 0,
  huntCritical: 0,
  fishCritical: 0,
  tradingCritical: 0
});

export const TITLE_COUNTER_KEYS = Object.freeze({
  RECRUITMENT_SUCCESS: "recruitmentSuccess",
  SEDUCTION_SUCCESS: "seductionSuccess",
  HEADMAN_TERMS: "headmanTerms",
  HUNT_CRITICAL: "huntCritical",
  FISH_CRITICAL: "fishCritical",
  TRADING_CRITICAL: "tradingCritical"
});

function normalizeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function normalizeTitleIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter(id => TITLE_DEFINITIONS[id]))];
}

export function ensureTitleState(person) {
  if (!person) return person;
  person.titleIds = normalizeTitleIds(person.titleIds);
  const source = person.titleStats && typeof person.titleStats === "object" ? person.titleStats : {};
  person.titleStats = Object.fromEntries(Object.keys(DEFAULT_TITLE_STATS).map(key => [
    key,
    normalizeCount(source[key])
  ]));
  return person;
}

export function grantTitle(person, titleId) {
  if (!person || !TITLE_DEFINITIONS[titleId]) return false;
  ensureTitleState(person);
  if (person.titleIds.includes(titleId)) return false;
  person.titleIds.push(titleId);
  return true;
}

function permanentStat(person, stat, getPermanentStat) {
  if (typeof getPermanentStat === "function") {
    const value = Number(getPermanentStat(person, stat));
    return Number.isFinite(value) ? value : 0;
  }
  return Number(person?.baseStats?.[stat] || 0) + Number(person?.acquiredStatMods?.[stat] || 0);
}

function getCharmLustTitleId(person) {
  if (person?.bodySex === "男") return "charmLust25Male";
  if (person?.bodySex === "女") return "charmLust25Female";
  return "charmLust25Other";
}

export function evaluateTitles(person, options = {}) {
  if (!person) return [];
  ensureTitleState(person);
  const added = [];
  const add = titleId => {
    if (grantTitle(person, titleId)) added.push(titleId);
  };

  if (person.titleStats.recruitmentSuccess >= 3) add("recruitmentSuccess3");
  if (person.titleStats.seductionSuccess >= 3) add("seductionSuccess3");
  if (person.titleStats.headmanTerms >= 3) add("headmanThreeTerms");
  if (
    permanentStat(person, "str", options.getPermanentStat) >= 25 &&
    permanentStat(person, "cou", options.getPermanentStat) >= 25
  ) {
    add("strengthCourage25");
  }
  if (
    permanentStat(person, "chr", options.getPermanentStat) >= 25 &&
    permanentStat(person, "sexdr", options.getPermanentStat) >= 25
  ) {
    add(getCharmLustTitleId(person));
  }
  if (person.titleStats.huntCritical >= 5) add("huntCritical5");
  if (person.titleStats.fishCritical >= 5) add("fishCritical5");
  if (person.titleStats.tradingCritical >= 5) add("tradingCritical5");

  return added;
}

export function incrementTitleCounter(person, key, amount = 1, options = {}) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_TITLE_STATS, key)) return [];
  ensureTitleState(person);
  person.titleStats[key] = normalizeCount(person.titleStats[key] + Number(amount || 0));
  return evaluateTitles(person, options);
}

export function getPersonTitles(person) {
  ensureTitleState(person);
  return person.titleIds.map(id => TITLE_DEFINITIONS[id]).filter(Boolean);
}

export function getTitleDefinition(titleId) {
  return TITLE_DEFINITIONS[titleId] || null;
}
