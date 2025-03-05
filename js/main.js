// main.js

// (従来の import群。ここでは例示のみ)
import { Village } from "./classes.js";
import { createInitialVillagers } from "./createVillagers.js";
import { updateUI } from "./ui.js";
import { doFixedEventPre, doFixedEventPost, doRandomEventPre, doRandomEventPost, endOfMonthProcess, doMonthStartProcess, doAgingProcess, updateSeason } from "./events.js";
import { handleAllVillagerJobs } from "./jobs.js";

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
