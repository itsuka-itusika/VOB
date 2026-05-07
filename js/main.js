// main.js

// (従来の import群。ここでは例示のみ)
import { Village } from "./classes.js";
import { createInitialVillagers } from "./createVillagers.js";
import { updateUI } from "./ui.js";
import { doFixedEventPre, doFixedEventPost, doRandomEventPre, doRandomEventPost, endOfMonthProcess, doMonthStartProcess, doAgingProcess, updateSeason } from "./events.js";
import { handleAllVillagerJobs } from "./jobs.js";

function isRestrictedNoJobVillager(person) {
  const bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];
  const hasChildLimit = bodyTraits.includes("赤子") ||
    bodyTraits.includes("幼児") ||
    mindTraits.includes("無垢") ||
    mindTraits.includes("萌芽");
  const onlyNoJob = Array.isArray(person.jobTable) &&
    person.jobTable.length > 0 &&
    person.jobTable.every(job => job === "なし");
  return hasChildLimit || onlyNoJob;
}

// Villageインスタンスを生成
export const theVillage = new Village();
theVillage.villagers = createInitialVillagers();
updateUI(theVillage);

/**
 * 「次の月へ」ボタン
 */
export function onNextTurn() {
  if (theVillage.gameOver) {
    theVillage.log("ゲームオーバー済みです。操作不可");
    return;
  }
  // もし襲撃中かつ未完了なら先に迎撃モーダル
  if (theVillage.villageTraits.includes("襲撃中") && !theVillage.isRaidProcessDone) {
    import("./raid.js").then(m=>{
      m.openRaidModal(theVillage);
    });
    return;
  }

  const noJobVillagers = theVillage.villagers.filter(person => person.job === "なし" && !isRestrictedNoJobVillager(person));
  if (noJobVillagers.length > 0 && typeof window !== "undefined") {
    const names = noJobVillagers.map(person => person.name).join("、");
    const ok = window.confirm(`仕事が「なし」の村人がいます。\n${names}\nこのまま月を進めますか？`);
    if (!ok) return;
  }

  // 通常ターン進行
  doFixedEventPre(theVillage);
  doRandomEventPre(theVillage);
  handleAllVillagerJobs(theVillage);
  doFixedEventPost(theVillage);
  doRandomEventPost(theVillage);
  endOfMonthProcess(theVillage);

  if (theVillage.villagers.length===0) {
    theVillage.log("村人ゼロ→バッカスは眠りに...(GameOver)");
    theVillage.gameOver=true;
    return;
  }
  theVillage.month++;
  if (theVillage.month>12) {
    theVillage.month=1;
    theVillage.year++;
  }
  theVillage.log(`=== ${theVillage.year}年${theVillage.month}月 ===`);

  if (theVillage.month===1) {
    doAgingProcess(theVillage);
  }
  if ([3,6,9,12].includes(theVillage.month)) {
    updateSeason(theVillage);
  }
  doMonthStartProcess(theVillage);

  theVillage.hasDonePreEvent=false;
  theVillage.hasDonePostEvent=false;

  updateUI(theVillage);
}
