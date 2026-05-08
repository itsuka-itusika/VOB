export function isRestrictedNoJobVillager(person) {
  const bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  const hasChildLimit = bodyTraits.includes("赤子") ||
    bodyTraits.includes("子供") ||
    mindTraits.includes("無垢") ||
    mindTraits.includes("萌芽");
  const onlyNoJob = Array.isArray(person.jobTable) &&
    person.jobTable.length > 0 &&
    person.jobTable.every(job => job === "なし");
  return hasChildLimit || onlyNoJob;
}
