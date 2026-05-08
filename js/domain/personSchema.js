export const PERSON_IDENTITY_FIELDS = Object.freeze({
  body: ["bodySex", "bodyAge", "bodyOwner", "race", "portraitFile"],
  spirit: ["spiritSex", "spiritAge", "speechType"],
  physicalStats: ["hp", "str", "vit", "dex", "mag", "chr"],
  mentalStats: ["mp", "int", "ind", "eth", "cou", "sexdr"]
});

export const PERSON_FIELD_POLICY = Object.freeze({
  // 肉体交換では body と physicalStats のみを対象にする。spirit と mentalStats は魂側仕様。
  doNotMergeBodyAndSpirit: true
});
