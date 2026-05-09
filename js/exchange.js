// exchange.js

import { refreshJobTable } from "./domain/jobTables.js";

/**
 * Swap body-related parameters between two characters.
 */
export function doExchange(a, b, v, isLightning = false) {
  const exchangeParams = {
    bodySex: a.bodySex,
    bodyAge: a.bodyAge,
    bodyOwner: a.bodyOwner,
    race: a.race,
    portraitFile: a.portraitFile,
    raiderPortrait: a.raiderPortrait,
    visitorPortrait: a.visitorPortrait,
    hp: a.hp,
    str: a.str,
    vit: a.vit,
    dex: a.dex,
    mag: a.mag,
    chr: a.chr,
    bodyTraits: [...a.bodyTraits],
    pregnancy: a.pregnancy ? JSON.parse(JSON.stringify(a.pregnancy)) : null,
    postpartumMonths: a.postpartumMonths || 0,
    bodyPotentialStats: a.bodyPotentialStats
      ? { ...a.bodyPotentialStats }
      : (a.potentialStats ? { ...a.potentialStats } : null),
    adultBodyTraits: Array.isArray(a.adultBodyTraits) ? [...a.adultBodyTraits] : [],
    adultBodyReached: !!a.adultBodyReached,
    adultPortraitFile: a.adultPortraitFile || "",
    toddlerPortraitFile: a.toddlerPortraitFile || "",
    toddlerPortraitGroup: a.toddlerPortraitGroup || ""
  };

  a.bodySex = b.bodySex;
  a.bodyAge = b.bodyAge;
  a.bodyOwner = b.bodyOwner;
  a.race = b.race;
  a.portraitFile = b.portraitFile;
  a.raiderPortrait = b.raiderPortrait;
  a.visitorPortrait = b.visitorPortrait;
  a.hp = b.hp;
  a.str = b.str;
  a.vit = b.vit;
  a.dex = b.dex;
  a.mag = b.mag;
  a.chr = b.chr;
  a.bodyTraits = [...b.bodyTraits];
  a.pregnancy = b.pregnancy ? JSON.parse(JSON.stringify(b.pregnancy)) : null;
  a.postpartumMonths = b.postpartumMonths || 0;
  a.bodyPotentialStats = b.bodyPotentialStats
    ? { ...b.bodyPotentialStats }
    : (b.potentialStats ? { ...b.potentialStats } : null);
  a.adultBodyTraits = Array.isArray(b.adultBodyTraits) ? [...b.adultBodyTraits] : [];
  a.adultBodyReached = !!b.adultBodyReached;
  a.adultPortraitFile = b.adultPortraitFile || "";
  a.toddlerPortraitFile = b.toddlerPortraitFile || "";
  a.toddlerPortraitGroup = b.toddlerPortraitGroup || "";

  b.bodySex = exchangeParams.bodySex;
  b.bodyAge = exchangeParams.bodyAge;
  b.bodyOwner = exchangeParams.bodyOwner;
  b.race = exchangeParams.race;
  b.portraitFile = exchangeParams.portraitFile;
  b.raiderPortrait = exchangeParams.raiderPortrait;
  b.visitorPortrait = exchangeParams.visitorPortrait;
  b.hp = exchangeParams.hp;
  b.str = exchangeParams.str;
  b.vit = exchangeParams.vit;
  b.dex = exchangeParams.dex;
  b.mag = exchangeParams.mag;
  b.chr = exchangeParams.chr;
  b.bodyTraits = [...exchangeParams.bodyTraits];
  b.pregnancy = exchangeParams.pregnancy ? JSON.parse(JSON.stringify(exchangeParams.pregnancy)) : null;
  b.postpartumMonths = exchangeParams.postpartumMonths;
  b.bodyPotentialStats = exchangeParams.bodyPotentialStats ? { ...exchangeParams.bodyPotentialStats } : null;
  b.adultBodyTraits = [...exchangeParams.adultBodyTraits];
  b.adultBodyReached = exchangeParams.adultBodyReached;
  b.adultPortraitFile = exchangeParams.adultPortraitFile;
  b.toddlerPortraitFile = exchangeParams.toddlerPortraitFile;
  b.toddlerPortraitGroup = exchangeParams.toddlerPortraitGroup;

  refreshJobTable(a, v);
  refreshJobTable(b, v);

  a.action = "なし";
  b.action = "なし";

  if (!isLightning) {
    v.log(`【交換の奇跡】${a.name}と${b.name}の肉体を交換しました`);
  }
}
