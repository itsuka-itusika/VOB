// exchange.js

import { refreshJobTable } from "./createVillagers.js";

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
    bodyTraits: [...a.bodyTraits]
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

  refreshJobTable(a);
  refreshJobTable(b);

  if (!a.jobTable.includes(a.job)) a.job = "なし";
  if (!a.actionTable.includes(a.action)) a.action = a.job;
  if (!b.jobTable.includes(b.job)) b.job = "なし";
  if (!b.actionTable.includes(b.action)) b.action = b.job;

  if (!isLightning) {
    v.log(`【交換の奇跡】${a.name}と${b.name}の肉体を交換しました`);
  }
}