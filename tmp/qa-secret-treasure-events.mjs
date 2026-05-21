import { Villager } from "../js/classes.js";
import { handleAllVillagerJobs } from "../js/jobs.js";

function makeWorker(name, action) {
  const person = new Villager(name, "男", 25);
  person.action = action;
  person.job = action;
  person.ind = 100;
  person.vit = 100;
  person.str = 20;
  person.dex = 20;
  person.int = 20;
  person.cou = 20;
  person.mag = 20;
  person.bodyTraits = [];
  person.mindTraits = [];
  return person;
}

const logs = [];
const village = {
  year: 1091,
  month: 4,
  food: 200,
  materials: 120,
  funds: 0,
  mana: 40,
  tech: 0,
  security: 60,
  villageTraits: ["春"],
  buildingFlags: {},
  secretTreasures: [],
  villagers: [
    makeWorker("農夫A", "農作業"),
    makeWorker("農夫B", "農作業"),
    makeWorker("醸造家", "醸造"),
    makeWorker("漁師", "漁")
  ],
  log(message) {
    logs.push(String(message));
  }
};

handleAllVillagerJobs(village);

if (village.secretTreasures.length !== 2) {
  throw new Error(`expected two secret treasures, got ${village.secretTreasures.length}`);
}
if (logs.filter(line => line.includes("畑から奇妙な物が出てきた")).length !== 1) {
  throw new Error("field secret treasure event did not occur exactly once");
}
if (logs.filter(line => line.includes("網に奇妙な物がかかった")).length !== 1) {
  throw new Error("fishing secret treasure event did not occur exactly once");
}

console.log("secret treasure event qa ok");
