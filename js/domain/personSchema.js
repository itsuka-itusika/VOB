export const PHYSICAL_ABILITY_STATS = Object.freeze(["str", "vit", "dex", "mag", "chr"]);
export const MENTAL_ABILITY_STATS = Object.freeze(["int", "ind", "eth", "cou", "sexdr"]);
export const ABILITY_STATS = Object.freeze([...PHYSICAL_ABILITY_STATS, ...MENTAL_ABILITY_STATS]);

export const PERSON_IDENTITY_FIELDS = Object.freeze({
  body: ["bodySex", "bodyAge", "bodyOwner", "race", "portraitFile"],
  spirit: ["spiritSex", "spiritAge", "speechType"],
  physicalStats: ["hp", ...PHYSICAL_ABILITY_STATS],
  mentalStats: ["mp", ...MENTAL_ABILITY_STATS]
});

export const PERSON_FIELD_POLICY = Object.freeze({
  // 肉体交換では body と physicalStats のみを対象にする。spirit と mentalStats は魂側仕様。
  doNotMergeBodyAndSpirit: true
});
