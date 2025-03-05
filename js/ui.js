// ui.js

import { theVillage } from "./main.js"; // 注意: これにより循環参照に注意
// ただし updateUI() の中で theVillage を参照するかどうかによっては構成要再検討
import { refreshJobTable } from "./createVillagers.js";  // 追加
import { openConversationModal } from "./conversation.js";

/**
 * メイン画面(村人一覧,資源パネルなど)を更新
 */
export function updateUI(v) {
  const rp = document.getElementById("resourcePanel");
  if (!rp) return;

  // 季節に応じた背景色を設定
  let seasonColor = "#ffffff"; // デフォルトは白
  if (v.villageTraits.includes("春")) {
    seasonColor = "#e8f5e9"; // 薄い黄緑
  } else if (v.villageTraits.includes("夏")) {
    seasonColor = "#e3f2fd"; // 薄い水色
  } else if (v.villageTraits.includes("秋")) {
    seasonColor = "#fff3e0"; // 薄いだいだい色
  } else if (v.villageTraits.includes("冬")) {
    seasonColor = "#f5f5f5"; // 薄いグレー
  }
  rp.style.backgroundColor = seasonColor;

  rp.innerHTML = `
    <div class="resource-box">年/月<br>${v.year}年${v.month}月</div>
    <div class="resource-box">食料<br>${v.food}</div>
    <div class="resource-box">資材<br>${v.materials}</div>
    <div class="resource-box">資金<br>${v.funds}</div>
    <div class="resource-box">魔素<br>${v.mana}</div>
    <div class="resource-box">名声<br>${v.fame}</div>
    <div class="resource-box">技術<br>${v.tech}</div>
    <div class="resource-box">治安<br>${v.security}</div>
    <div class="resource-box">規模<br>${v.building}</div>
    <div class="resource-box">人口/上限<br>${v.villagers.length}/${v.popLimit}</div>
    <div class="resource-box">村特性<br>${v.villageTraits.join(",")}</div>
  `;

  const tb = document.querySelector("#villagersTable tbody");
  if (!tb) return;
  tb.innerHTML="";

  v.villagers.forEach(person=>{
    let tr=document.createElement("tr");

    // 名前
    let tdName=document.createElement("td");
    tdName.textContent=person.name;
    tdName.style.cursor = "pointer";
    tdName.onclick = () => openConversationModal(person);
    tr.appendChild(tdName);

    // 体の持ち主
    let tdOwn=document.createElement("td");
    tdOwn.textContent=person.bodyOwner;
    tr.appendChild(tdOwn);

    // 種族を追加
    let tdRace = document.createElement("td");
    tdRace.textContent = person.race;
    tr.appendChild(tdRace);

    // 性別
    let tdSex=document.createElement("td");
    tdSex.textContent=person.bodySex;
    tr.appendChild(tdSex);

    // 年齢
    let tdAge=document.createElement("td");
    tdAge.textContent=person.bodyAge;
    tr.appendChild(tdAge);

    // hp
    let tdHP=document.createElement("td");
    tdHP.textContent=Math.floor(person.hp);
    tr.appendChild(tdHP);

    // mp
    let tdMP=document.createElement("td");
    tdMP.textContent=Math.floor(person.mp);
    tr.appendChild(tdMP);

    // happiness
    let tdHap=document.createElement("td");
    tdHap.textContent=Math.floor(person.happiness);
    tr.appendChild(tdHap);

    // 幸福度の後に行動を追加
    let tdAction = document.createElement("td");
    let selAction = document.createElement("select");
    selAction.onchange = () => {
      person.action = selAction.value;
    };
    person.actionTable.forEach(act => {
      let op = document.createElement("option");
      op.value = act;
      op.textContent = act;
      if (act === person.action) op.selected = true;
      selAction.appendChild(op);
    });
    tdAction.appendChild(selAction);
    tr.appendChild(tdAction);

    // 仕事
    let tdJob=document.createElement("td");
    let sel=document.createElement("select");
    person.jobTable.forEach(j=>{
      let op=document.createElement("option");
      op.value=j;
      op.textContent=j;
      if (j===person.job) op.selected=true;
      sel.appendChild(op);
    });
    sel.onchange = function() {
      const newJob = this.value;
      person.job = newJob;
      person.action = newJob;
      refreshJobTable(person);  // 仕事テーブルを更新
      updateUI(v);  // UI全体を更新
    };
    tdJob.appendChild(sel);
    tr.appendChild(tdJob);

    // 筋力
    let tdStr=document.createElement("td");
    tdStr.textContent=Math.floor(person.str);
    tr.appendChild(tdStr);

    // 耐久
    let tdVit=document.createElement("td");
    tdVit.textContent=Math.floor(person.vit);
    tr.appendChild(tdVit);

    // 器用
    let tdDex=document.createElement("td");
    tdDex.textContent=Math.floor(person.dex);
    tr.appendChild(tdDex);

    // 魔力
    let tdMag=document.createElement("td");
    tdMag.textContent=Math.floor(person.mag);
    tr.appendChild(tdMag);

    // 魅力
    let tdChr=document.createElement("td");
    tdChr.textContent=Math.floor(person.chr);
    tr.appendChild(tdChr);

    // 肉体特性
    let tdBod=document.createElement("td");
    tdBod.textContent=person.bodyTraits.join(",");
    tr.appendChild(tdBod);

    // 知力
    let tdInt=document.createElement("td");
    tdInt.textContent=Math.floor(person.int);
    tr.appendChild(tdInt);

    // 勤勉
    let tdInd=document.createElement("td");
    tdInd.textContent=Math.floor(person.ind);
    tr.appendChild(tdInd);

    // 倫理
    let tdEth=document.createElement("td");
    tdEth.textContent=Math.floor(person.eth);
    tr.appendChild(tdEth);

    // 勇気
    let tdCou=document.createElement("td");
    tdCou.textContent=Math.floor(person.cou);
    tr.appendChild(tdCou);

    // 好色
    let tdSexdr=document.createElement("td");
    tdSexdr.textContent=Math.floor(person.sexdr);
    tr.appendChild(tdSexdr);

    // 精神特性
    let tdMind=document.createElement("td");
    tdMind.textContent=person.mindTraits.join(",");
    tr.appendChild(tdMind);

    // 趣味
    let tdHobby=document.createElement("td");
    tdHobby.textContent=person.hobby;
    tr.appendChild(tdHobby);

    // 詳細(折り畳み)
    let tdFold=document.createElement("td");
    tdFold.classList.add("foldable-info");
    tdFold.innerHTML=`
      <details>
        <summary>詳細</summary>
        <div>精神性別: ${person.spiritSex}</div>
        <div>精神年齢: ${person.spiritAge}</div>
        <div>人間関係: ${person.relationships}</div>
      </details>
    `;
    tr.appendChild(tdFold);

    // 行スタイル等(例: 性別により色分け)
    for (let i=0; i<=11; i++) {
      if (person.bodySex==="男") {
        tr.cells[i].classList.add("male-basic");
      } else {
        tr.cells[i].classList.add("female-basic");
      }
    }

    // 体力とメンタルが33以下の時赤字
    if (person.hp <= 33) {
      tr.cells[5].classList.add("low-hpmp");
    }
    if (person.mp <= 33) {
      tr.cells[6].classList.add("low-hpmp");
    }

    // 数値パラメータチェック（魅力と好色が20以上の時太字）
    let checkCols = [10, 11, 12, 13, 14, 16, 17, 18, 19, 20];
    checkCols.forEach(ci => {
      let val = parseInt(tr.cells[ci].textContent);
      // 魅力（14列目）と好色（20列目）は20以上で太字
      if ((ci === 14 || ci === 20) && val >= 20) {
        tr.cells[ci].classList.add("bold-value");
      }
      // その他のパラメータは従来通り
      else if (ci !== 14 && ci !== 20 && val >= 20) {
        tr.cells[ci].classList.add("bold-value");
      }
    });

    tb.appendChild(tr);
  });

  // 訪問者テーブルの更新
  const visitorSection = document.getElementById("visitorsSection");
  const visitorTb = document.querySelector("#visitorsTable tbody");

  // 訪問者セクション表示制御
  if (visitorSection) {
    if (v.visitors.length > 0) {
      visitorSection.style.display = "block";
    } else {
      visitorSection.style.display = "none";
    }
  }

  // 訪問者テーブル更新
  if (visitorTb && v.visitors.length > 0) {
    visitorTb.innerHTML = "";
    v.visitors.forEach(person => {
      let tr = document.createElement("tr");

      // 名前
      let tdName = document.createElement("td");
      tdName.textContent = person.name;
      tdName.style.cursor = "pointer";
      tdName.onclick = () => openConversationModal(person);
      tr.appendChild(tdName);

      // 体の持ち主
      let tdOwn = document.createElement("td");
      tdOwn.textContent = person.bodyOwner;
      tr.appendChild(tdOwn);

      // 種族を追加
      let tdRace = document.createElement("td");
      tdRace.textContent = person.race;
      tr.appendChild(tdRace);

      // 性別
      let tdSex = document.createElement("td");
      tdSex.textContent = person.bodySex;
      tr.appendChild(tdSex);

      // 年齢
      let tdAge = document.createElement("td");
      tdAge.textContent = person.bodyAge;
      tr.appendChild(tdAge);

      // hp
      let tdHP = document.createElement("td");
      tdHP.textContent = Math.floor(person.hp);
      tr.appendChild(tdHP);

      // mp
      let tdMP = document.createElement("td");
      tdMP.textContent = Math.floor(person.mp);
      tr.appendChild(tdMP);

      // happiness
      let tdHap = document.createElement("td");
      tdHap.textContent = Math.floor(person.happiness);
      tr.appendChild(tdHap);

      // 行動
      let tdAction = document.createElement("td");
      tdAction.textContent = person.action;
      tr.appendChild(tdAction);

      // 仕事
      let tdJob = document.createElement("td");
      tdJob.textContent = person.job;
      tr.appendChild(tdJob);

      // 筋力
      let tdStr = document.createElement("td");
      tdStr.textContent = Math.floor(person.str);
      tr.appendChild(tdStr);

      // 耐久
      let tdVit = document.createElement("td");
      tdVit.textContent = Math.floor(person.vit);
      tr.appendChild(tdVit);

      // 器用
      let tdDex = document.createElement("td");
      tdDex.textContent = Math.floor(person.dex);
      tr.appendChild(tdDex);

      // 魔力
      let tdMag = document.createElement("td");
      tdMag.textContent = Math.floor(person.mag);
      tr.appendChild(tdMag);

      // 魅力
      let tdChr = document.createElement("td");
      tdChr.textContent = Math.floor(person.chr);
      tr.appendChild(tdChr);

      // 肉体特性
      let tdBod = document.createElement("td");
      tdBod.textContent = person.bodyTraits.join(",");
      tr.appendChild(tdBod);

      // 知力
      let tdInt = document.createElement("td");
      tdInt.textContent = Math.floor(person.int);
      tr.appendChild(tdInt);

      // 勤勉
      let tdInd = document.createElement("td");
      tdInd.textContent = Math.floor(person.ind);
      tr.appendChild(tdInd);

      // 倫理
      let tdEth = document.createElement("td");
      tdEth.textContent = Math.floor(person.eth);
      tr.appendChild(tdEth);

      // 勇気
      let tdCou = document.createElement("td");
      tdCou.textContent = Math.floor(person.cou);
      tr.appendChild(tdCou);

      // 好色
      let tdSexdr = document.createElement("td");
      tdSexdr.textContent = Math.floor(person.sexdr);
      tr.appendChild(tdSexdr);

      // 精神特性
      let tdMind = document.createElement("td");
      tdMind.textContent = person.mindTraits.join(",");
      tr.appendChild(tdMind);

      // 趣味
      let tdHobby = document.createElement("td");
      tdHobby.textContent = person.hobby;
      tr.appendChild(tdHobby);

      // 詳細(折り畳み)
      let tdFold = document.createElement("td");
      tdFold.classList.add("foldable-info");
      tdFold.innerHTML = `
        <details>
          <summary>詳細</summary>
          <div>精神性別: ${person.spiritSex}</div>
          <div>精神年齢: ${person.spiritAge}</div>
          <div>人間関係: ${person.relationships}</div>
        </details>
      `;
      tr.appendChild(tdFold);

      // スタイル適用
      for (let i = 0; i <= 11; i++) {
        if (person.bodySex === "男") {
          tr.cells[i].classList.add("male-basic");
        } else {
          tr.cells[i].classList.add("female-basic");
        }
      }
      if (person.hp <= 33) {
        tr.cells[5].classList.add("low-hpmp");
      }
      if (person.mp <= 33) {
        tr.cells[6].classList.add("low-hpmp");
      }

      // 数値パラメータチェック
      let checkCols = [10, 11, 12, 13, 14, 16, 17, 18, 19, 20];
      checkCols.forEach(ci => {
        let val = parseInt(tr.cells[ci].textContent);
        if (val >= 20) tr.cells[ci].classList.add("bold-value");
      });

      visitorTb.appendChild(tr);
    });
  }

  // 襲撃者一覧テーブル更新
  const raidTb = document.querySelector("#raidEnemiesTable tbody");

  // 襲撃者セクション表示制御
  const raidSection = document.getElementById("raidEnemiesSection");
  if (raidSection) {
    if (v.villageTraits.includes("襲撃中") && v.raidEnemies.length > 0) {
      raidSection.style.display = "block";
    } else {
      raidSection.style.display = "none";
    }
  }

  // 襲撃者テーブル更新
  if (raidTb) {
    raidTb.innerHTML="";

    // 襲撃中の場合のみ表示
    if (v.villageTraits.includes("襲撃中") && v.raidEnemies.length > 0) {
      v.raidEnemies.forEach(person=>{
        let tr=document.createElement("tr");

        // 名前
        let tdName=document.createElement("td");
        tdName.textContent=person.name;
        tdName.style.cursor = "pointer";
        tdName.onclick = () => {
          openConversationModal(person);
        };
        tr.appendChild(tdName);

        // 体の持ち主
        let tdOwn=document.createElement("td");
        tdOwn.textContent=person.bodyOwner;
        tr.appendChild(tdOwn);

        // 種族を追加
        let tdRace = document.createElement("td");
        tdRace.textContent = person.race;
        tr.appendChild(tdRace);

        // 性別
        let tdSex=document.createElement("td");
        tdSex.textContent=person.bodySex;
        tr.appendChild(tdSex);

        // 年齢
        let tdAge=document.createElement("td");
        tdAge.textContent=person.bodyAge;
        tr.appendChild(tdAge);

        // hp
        let tdHP=document.createElement("td");
        tdHP.textContent=Math.floor(person.hp);
        tr.appendChild(tdHP);

        // mp
        let tdMP=document.createElement("td");
        tdMP.textContent=Math.floor(person.mp);
        tr.appendChild(tdMP);

        // happiness
        let tdHap=document.createElement("td");
        tdHap.textContent=Math.floor(person.happiness);
        tr.appendChild(tdHap);

        // 行動
        let tdAction = document.createElement("td");
        tdAction.textContent=person.action;
        tr.appendChild(tdAction);

        // 仕事
        let tdJob=document.createElement("td");
        tdJob.textContent=person.job;
        tr.appendChild(tdJob);

        // 筋力
        let tdStr=document.createElement("td");
        tdStr.textContent=Math.floor(person.str);
        tr.appendChild(tdStr);

        // 耐久
        let tdVit=document.createElement("td");
        tdVit.textContent=Math.floor(person.vit);
        tr.appendChild(tdVit);

        // 器用
        let tdDex=document.createElement("td");
        tdDex.textContent=Math.floor(person.dex);
        tr.appendChild(tdDex);

        // 魔力
        let tdMag=document.createElement("td");
        tdMag.textContent=Math.floor(person.mag);
        tr.appendChild(tdMag);

        // 魅力
        let tdChr=document.createElement("td");
        tdChr.textContent=Math.floor(person.chr);
        tr.appendChild(tdChr);

        // 肉体特性
        let tdBod=document.createElement("td");
        tdBod.textContent=person.bodyTraits.join(",");
        tr.appendChild(tdBod);

        // 知力
        let tdInt=document.createElement("td");
        tdInt.textContent=Math.floor(person.int);
        tr.appendChild(tdInt);

        // 勤勉
        let tdInd=document.createElement("td");
        tdInd.textContent=Math.floor(person.ind);
        tr.appendChild(tdInd);

        // 倫理
        let tdEth=document.createElement("td");
        tdEth.textContent=Math.floor(person.eth);
        tr.appendChild(tdEth);

        // 勇気
        let tdCou=document.createElement("td");
        tdCou.textContent=Math.floor(person.cou);
        tr.appendChild(tdCou);

        // 好色
        let tdSexdr=document.createElement("td");
        tdSexdr.textContent=Math.floor(person.sexdr);
        tr.appendChild(tdSexdr);

        // 精神特性
        let tdMind=document.createElement("td");
        tdMind.textContent=person.mindTraits.join(",");
        tr.appendChild(tdMind);

        // 趣味
        let tdHobby=document.createElement("td");
        tdHobby.textContent=person.hobby;
        tr.appendChild(tdHobby);

        // 詳細(折り畳み)
        let tdFold=document.createElement("td");
        tdFold.classList.add("foldable-info");
        tdFold.innerHTML=`
          <details>
            <summary>詳細</summary>
            <div>精神性別: ${person.spiritSex}</div>
            <div>精神年齢: ${person.spiritAge}</div>
            <div>人間関係: ${person.relationships}</div>
          </details>
        `;
        tr.appendChild(tdFold);

        // 行スタイル等(例: 性別により色分け)
        for (let i=0; i<=11; i++) {
          if (person.bodySex==="男") {
            tr.cells[i].classList.add("male-basic");
          } else {
            tr.cells[i].classList.add("female-basic");
          }
        }
        if (person.hp<=33) {
          tr.cells[5].classList.add("low-hpmp");
        }
        if (person.mp<=33) {
          tr.cells[6].classList.add("low-hpmp");
        }

        let checkCols=[10,11,12,13,14,16,17,18,19,20];
        checkCols.forEach(ci=>{
          let val=parseInt(tr.cells[ci].textContent);
          if (val>=20) tr.cells[ci].classList.add("bold-value");
        });

        raidTb.appendChild(tr);
      });
    }
  }

  // テーブル更新後にソート機能をセットアップ
  setupTableSort();
  
  // もし現在ソート中の列があれば、その状態を維持
  if (sortState.column !== null) {
    sortVillagerTable(sortState.column, sortState.isAsc);
  }
}

/**
 * テーブルのソート状態を管理
 */
let sortState = {
  column: null,  // ソート中の列
  isAsc: true    // 昇順ならtrue
};

/**
 * テーブルヘッダーにソート機能を追加
 */
function setupTableSort() {
  const table = document.getElementById("villagersTable");
  const headers = table.querySelectorAll("thead th");
  
  // ソート可能な列のインデックスを修正
  const sortableColumns = [
    3,  // 性別
    4,  // 年齢
    5,  // 体力
    6,  // メンタル
    7,  // 幸福
    9,  // 仕事
    10, // 筋力
    11, // 耐久
    12, // 器用
    13, // 魔力
    14, // 魅力
    16, // 知力
    17, // 勤勉
    18, // 倫理
    19, // 勇気
    20  // 好色
  ];

  sortableColumns.forEach(colIndex => {
    const header = headers[colIndex];
    header.style.cursor = "pointer";
    header.addEventListener("click", () => {
      // 同じ列をクリックした場合は昇順/降順を切り替え
      if (sortState.column === colIndex) {
        sortState.isAsc = !sortState.isAsc;
      } else {
        sortState.column = colIndex;
        sortState.isAsc = true;
      }
      
      sortVillagerTable(colIndex, sortState.isAsc);
      
      // ソート方向を表示
      headers.forEach(h => h.textContent = h.textContent.replace(" ▲", "").replace(" ▼", ""));
      header.textContent += sortState.isAsc ? " ▲" : " ▼";
    });
  });
}

/**
 * テーブルのソート実行
 */
function sortVillagerTable(colIndex, isAsc) {
  const table = document.getElementById("villagersTable");
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  rows.sort((a, b) => {
    let aVal = a.cells[colIndex].textContent;
    let bVal = b.cells[colIndex].textContent;

    // 数値の場合は数値としてソート
    if ([3,4,5,6,8,9,10,11,12,14,15,16,17,18,19,20,21].includes(colIndex)) {
      aVal = Number(aVal);
      bVal = Number(bVal);
    }

    if (aVal < bVal) return isAsc ? -1 : 1;
    if (aVal > bVal) return isAsc ? 1 : -1;
    return 0;
  });

  // ソート後のテーブルを再構築
  tbody.innerHTML = "";
  rows.forEach(row => tbody.appendChild(row));
}
