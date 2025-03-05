// saveLoad.js
import { Village, Villager } from "./classes.js";

/**
 * 村データをJSONファイルとしてダウンロードさせる
 */
export function saveVillageToJsonFile(village) {
  // Villageインスタンスを純粋なオブジェクトに変換
  const dataObj = convertVillageToObject(village);
  const jsonStr = JSON.stringify(dataObj, null, 2);

  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "village_save.json";
  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  village.log("JSONファイルとして保存しました");
}

/**
 * JSONファイルを選択してVillageデータをロードする
 *  (ファイルは index.html で <input type="file"> から取得済み)
 */
export async function loadVillageFromJsonFile(file) {
  const text = await file.text();
  const dataObj = JSON.parse(text);
  const loadedVillage = convertObjectToVillage(dataObj);
  return loadedVillage; // Villageインスタンス
}

/**
 * ローカルストレージへ保存
 */
export function saveVillageToLocalStorage(village) {
  const dataObj = convertVillageToObject(village);
  const jsonStr = JSON.stringify(dataObj);
  localStorage.setItem("villageSave", jsonStr);

  village.log("ローカルストレージに保存しました");
}

/**
 * ローカルストレージからロード(なければ null)
 */
export function loadVillageFromLocalStorage() {
  const jsonStr = localStorage.getItem("villageSave");
  if (!jsonStr) return null;

  const dataObj = JSON.parse(jsonStr);
  return convertObjectToVillage(dataObj);
}

/* -------------------------------------------
   以下、保存用データへの変換と読み出し時の再構築
   (Village, Villager) を適切に再生成する
------------------------------------------- */

/**
 * Villageインスタンス → (シリアライズ可能)オブジェクトに変換
 */
function convertVillageToObject(village) {
  return {
    year: village.year,
    month: village.month,
    food: village.food,
    materials: village.materials,
    funds: village.funds,
    mana: village.mana,
    fame: village.fame,
    tech: village.tech,
    security: village.security,
    building: village.building,
    popLimit: village.popLimit,
    villageTraits: [...village.villageTraits],
    logs: [...village.logs],
    gameOver: village.gameOver,
    hasDonePreEvent: village.hasDonePreEvent,
    hasDonePostEvent: village.hasDonePostEvent,

    // 襲撃系
    isRaidProcessDone: village.isRaidProcessDone,
    raidTurnCount: village.raidTurnCount,
    currentActionIndex: village.currentActionIndex,
    // raidEnemies (Villager互換配列)
    raidEnemies: village.raidEnemies.map(vill => convertVillagerToObject(vill)),

    // villagers
    villagers: village.villagers.map(vill => ({
      name: vill.name,
      bodySex: vill.bodySex,
      bodyAge: vill.bodyAge,
      hp: vill.hp,
      mp: vill.mp,
      happiness: vill.happiness,

      str: vill.str,
      vit: vill.vit,
      dex: vill.dex,
      mag: vill.mag,
      chr: vill.chr,

      int: vill.int,
      ind: vill.ind,
      eth: vill.eth,
      cou: vill.cou,
      sexdr: vill.sexdr,

      spiritAge: vill.spiritAge,
      spiritSex: vill.spiritSex,

      bodyTraits: [...vill.bodyTraits],
      mindTraits: [...vill.mindTraits],
      hobby: vill.hobby,
      relationships: [...vill.relationships],

      job: vill.job,
      jobTable: [...vill.jobTable],
      action: vill.action,
      actionTable: [...vill.actionTable],
      bodyOwner: vill.bodyOwner
    }))
  };
}

/**
 * villager(Villager) → object
 */
function convertVillagerToObject(vill) {
  return {
    name: vill.name,
    bodySex: vill.bodySex,
    bodyAge: vill.bodyAge,
    hp: vill.hp,
    mp: vill.mp,
    happiness: vill.happiness,

    str: vill.str,
    vit: vill.vit,
    dex: vill.dex,
    mag: vill.mag,
    chr: vill.chr,

    int: vill.int,
    ind: vill.ind,
    eth: vill.eth,
    cou: vill.cou,
    sexdr: vill.sexdr,

    spiritAge: vill.spiritAge,
    spiritSex: vill.spiritSex,

    bodyTraits: [...vill.bodyTraits],
    mindTraits: [...vill.mindTraits],
    hobby: vill.hobby,
    relationships: [...vill.relationships],

    job: vill.job,
    jobTable: [...vill.jobTable],
    action: vill.action,
    actionTable: [...vill.actionTable],
    bodyOwner: vill.bodyOwner
  };
}

/**
 * オブジェクト → Villageインスタンス
 */
function convertObjectToVillage(dataObj) {
  let v = new Village();
  // 基本プロパティ
  v.year = dataObj.year;
  v.month = dataObj.month;
  v.food = dataObj.food;
  v.materials = dataObj.materials;
  v.funds = dataObj.funds;
  v.mana = dataObj.mana;
  v.fame = dataObj.fame;
  v.tech = dataObj.tech;
  v.security = dataObj.security;
  v.building = dataObj.building;
  v.popLimit = dataObj.popLimit;
  if (Array.isArray(dataObj.villageTraits)) {
    v.villageTraits = [...dataObj.villageTraits];
  }
  v.logs = Array.isArray(dataObj.logs) ? [...dataObj.logs] : [];
  v.gameOver = !!dataObj.gameOver;
  v.hasDonePreEvent = !!dataObj.hasDonePreEvent;
  v.hasDonePostEvent = !!dataObj.hasDonePostEvent;

  // 襲撃系
  v.isRaidProcessDone = !!dataObj.isRaidProcessDone;
  v.raidTurnCount = dataObj.raidTurnCount ?? 0;
  v.currentActionIndex = dataObj.currentActionIndex ?? 0;
  if (Array.isArray(dataObj.raidEnemies)) {
    v.raidEnemies = dataObj.raidEnemies.map(o => convertObjectToVillager(o));
  }

  // villagers
  if (Array.isArray(dataObj.villagers)) {
    v.villagers = dataObj.villagers.map(o => convertObjectToVillager(o));
  }

  return v;
}

/**
 * オブジェクト → Villagerインスタンス
 */
function convertObjectToVillager(obj) {
  let vill = new Villager(obj.name, obj.bodySex, obj.bodyAge);
  vill.hp = obj.hp;
  vill.mp = obj.mp;
  vill.happiness = obj.happiness;

  vill.str = obj.str;
  vill.vit = obj.vit;
  vill.dex = obj.dex;
  vill.mag = obj.mag;
  vill.chr = obj.chr;

  vill.int = obj.int;
  vill.ind = obj.ind;
  vill.eth = obj.eth;
  vill.cou = obj.cou;
  vill.sexdr = obj.sexdr;

  vill.spiritAge = obj.spiritAge;
  vill.spiritSex = obj.spiritSex;

  vill.bodyTraits = Array.isArray(obj.bodyTraits) ? [...obj.bodyTraits] : [];
  vill.mindTraits = Array.isArray(obj.mindTraits) ? [...obj.mindTraits] : [];
  vill.hobby = obj.hobby;
  vill.relationships = Array.isArray(obj.relationships) ? [...obj.relationships] : [];

  vill.job = obj.job;
  vill.jobTable = Array.isArray(obj.jobTable) ? [...obj.jobTable] : [];
  vill.action = obj.action;
  vill.actionTable = Array.isArray(obj.actionTable) ? [...obj.actionTable] : [];
  vill.bodyOwner = obj.bodyOwner;

  return vill;
}
