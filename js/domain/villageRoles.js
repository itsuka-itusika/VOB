import { hasActiveBuildingFlag } from "./buildingState.js";

export const VILLAGE_ROLE_NONE = "なし";
export const VILLAGE_ROLE_HEADMAN = "里長";
export const VILLAGE_ROLE_LIBRARIAN = "司書";
export const VILLAGE_ROLE_PRIEST = "司祭";
export const VILLAGE_ROLE_DOCTOR = "村医";

export const SELECTABLE_VILLAGE_ROLES = [
  VILLAGE_ROLE_LIBRARIAN,
  VILLAGE_ROLE_PRIEST,
  VILLAGE_ROLE_DOCTOR
];

const ALL_VILLAGE_ROLES = new Set([
  VILLAGE_ROLE_NONE,
  VILLAGE_ROLE_HEADMAN,
  ...SELECTABLE_VILLAGE_ROLES
]);

const ROLE_UNLOCK_BUILDINGS = {
  [VILLAGE_ROLE_LIBRARIAN]: { flag: "hasLibrary", id: "library" },
  [VILLAGE_ROLE_PRIEST]: { flag: "hasChurch", id: "church" },
  [VILLAGE_ROLE_DOCTOR]: { flag: "hasClinic", id: "clinic" }
};

export function normalizeVillageRole(role) {
  const value = String(role || "").trim();
  return ALL_VILLAGE_ROLES.has(value) ? value : VILLAGE_ROLE_NONE;
}

export function clearLegacyHeadmanTrait(person) {
  if (!person) return;
  person.mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  person.mindTraits = person.mindTraits.filter(trait => trait !== VILLAGE_ROLE_HEADMAN);
}

export function getVillageRole(person) {
  if (!person) return VILLAGE_ROLE_NONE;
  if (Array.isArray(person.mindTraits) && person.mindTraits.includes(VILLAGE_ROLE_HEADMAN)) {
    return VILLAGE_ROLE_HEADMAN;
  }
  return normalizeVillageRole(person.villageRole);
}

export function setVillageRole(person, role) {
  if (!person) return VILLAGE_ROLE_NONE;
  const normalized = normalizeVillageRole(role);
  person.villageRole = normalized;
  clearLegacyHeadmanTrait(person);
  return normalized;
}

export function normalizeVillageRoleForPerson(person) {
  return setVillageRole(person, getVillageRole(person));
}

export function isHeadman(person) {
  return getVillageRole(person) === VILLAGE_ROLE_HEADMAN;
}

export function isAdultMindForVillageRole(person) {
  return (Number(person?.spiritAge) || 0) >= 16;
}

export function getUnlockedVillageRoles(village) {
  return SELECTABLE_VILLAGE_ROLES.filter(role => {
    const building = ROLE_UNLOCK_BUILDINGS[role];
    return building && hasActiveBuildingFlag(village, building.flag, building.id);
  });
}

export function isVillageRoleUnlocked(village, role) {
  return getUnlockedVillageRoles(village).includes(normalizeVillageRole(role));
}

export function getVillageRoleHolder(village, role, exceptPerson = null) {
  const normalized = normalizeVillageRole(role);
  return (village?.villagers || []).find(person =>
    person !== exceptPerson && getVillageRole(person) === normalized
  ) || null;
}

export function canAssignVillageRole(village, person, role) {
  if (!person) return false;
  const normalized = normalizeVillageRole(role);
  const current = getVillageRole(person);

  if (current === VILLAGE_ROLE_HEADMAN) {
    return normalized === VILLAGE_ROLE_HEADMAN;
  }
  if (normalized === VILLAGE_ROLE_NONE) return true;
  if (normalized === VILLAGE_ROLE_HEADMAN) return false;
  if (!isAdultMindForVillageRole(person)) return false;
  // 既に就いている村人がいても選べる。選んだ時点で役職がそちらへ移る。
  return isVillageRoleUnlocked(village, normalized);
}

/** 役職を与える。既に就いている村人がいれば、その者を「なし」へ戻して引き継ぐ。 */
export function assignVillageRole(village, person, role) {
  const normalized = normalizeVillageRole(role);
  if (!canAssignVillageRole(village, person, normalized)) return false;
  const previousHolder = normalized === VILLAGE_ROLE_NONE
    ? null
    : getVillageRoleHolder(village, normalized, person);
  if (previousHolder) setVillageRole(previousHolder, VILLAGE_ROLE_NONE);
  setVillageRole(person, normalized);
  return true;
}

export function hasVillageRole(person, role) {
  return getVillageRole(person) === normalizeVillageRole(role);
}

export function getVillageRoleMultiplier(person, role, multiplier = 1.2) {
  return hasVillageRole(person, role) ? multiplier : 1;
}

export function normalizeVillageRoles(village) {
  [
    ...(village?.villagers || []),
    ...(village?.visitors || []),
    ...(village?.captives || []),
    ...(village?.raidEnemies || [])
  ].forEach(normalizeVillageRoleForPerson);
}
