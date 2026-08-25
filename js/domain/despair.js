export const DISAPPOINTMENT_TRAIT = "失望";
export const DESPAIR_TRAIT = "絶望";

function ensureMindTraits(person) {
  if (!person) return [];
  if (!Array.isArray(person.mindTraits)) person.mindTraits = [];
  return person.mindTraits;
}

export function hasDisappointmentState(person) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.includes(DISAPPOINTMENT_TRAIT);
}

export function hasDespairState(person) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.includes(DESPAIR_TRAIT);
}

export function hasHopeLossState(person) {
  return hasDisappointmentState(person) || hasDespairState(person);
}

export function addDisappointmentState(person) {
  const mindTraits = ensureMindTraits(person);
  if (mindTraits.includes(DISAPPOINTMENT_TRAIT) || mindTraits.includes(DESPAIR_TRAIT)) return false;
  mindTraits.push(DISAPPOINTMENT_TRAIT);
  return true;
}

export function promoteDisappointmentToDespair(person) {
  const mindTraits = ensureMindTraits(person);
  const hadDisappointment = mindTraits.includes(DISAPPOINTMENT_TRAIT);
  if (!hadDisappointment) return false;
  person.mindTraits = mindTraits.filter(trait => trait !== DISAPPOINTMENT_TRAIT);
  if (!person.mindTraits.includes(DESPAIR_TRAIT)) {
    person.mindTraits.push(DESPAIR_TRAIT);
    return true;
  }
  return true;
}

export function clearDisappointmentIfHappinessRecovered(person) {
  if ((Number(person?.happiness) || 0) <= 0 || hasDespairState(person)) return [];
  return clearHopeLossTraits(person, { includeDespair: false });
}

export function clearHopeLossTraits(person, { includeDespair = true } = {}) {
  const mindTraits = ensureMindTraits(person);
  const recoverableTraits = includeDespair
    ? [DISAPPOINTMENT_TRAIT, DESPAIR_TRAIT]
    : [DISAPPOINTMENT_TRAIT];
  const recovered = recoverableTraits.filter(trait => mindTraits.includes(trait));
  if (recovered.length > 0) {
    person.mindTraits = mindTraits.filter(trait => !recoverableTraits.includes(trait));
  }
  return recovered;
}
