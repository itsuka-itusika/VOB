import { theVillage } from "./main.js";
import { updateUI } from "./ui.js";
import { getPortraitPath, isForcedHealingAction } from "./util.js";
import { ACTION_NONE, refreshJobTable, setPreferredAction } from "./domain/jobTables.js";
import { addStoredResource } from "./domain/resourceLimits.js";
import { getPermanentStat } from "./domain/statLayers.js";
import { ACTION_DEFEND, ACTION_FORTIFY, ACTION_SHOOT, ACTION_TRAP, RAID_ACTIONS, canPerformRaidAction } from "./raidRules.js";
import { getConversationLine } from "./dialogue/dialogueEngine.js";
import { recordVillagerJoinHistory } from "./history.js";
import { MERCHANT_SECRET_TREASURE_LINES } from "./data/dialogue/visitorLines.js";
import { incrementTitleCounter, TITLE_COUNTER_KEYS } from "./titles.js";
import {
  buyMerchantSecretTreasure,
  MERCHANT_SECRET_TREASURE_CHANCE,
  MERCHANT_SECRET_TREASURE_PRICE,
  showSecretTreasureEventModals
} from "./secretTreasureEvents.js";

// 訪問者タイプごとの勧誘成功率係数
const RECRUITMENT_COEFFICIENTS = {
  "流民": 0.8,    // 最も勧誘しやすい
  "冒険者": 0.4,  // やや勧誘しにくい
  "巡礼者": 0.2,  // 比較的勧誘しやすい
  "学者": 0.2,    // 勧誘しにくい
  "観光客": 0.4,  // かなり勧誘しにくい
  "旅人": 0.4,    // 標準
  "行商人": 0.2,  // 勧誘しにくい
  "棄民": 0.9     // 最も勧誘しやすい（村を追われた人なので）
};

const MERCHANT_TRADE = {
  food: { label: "食料", stockKey: "food", unit: 10, price: 8, initialStock: 100 },
  materials: { label: "資材", stockKey: "materials", unit: 10, price: 12, initialStock: 80 }
};

function randFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createConversationStatusHtml(character) {
  if (isMerchantVisitor(character)) {
    const stock = ensureMerchantStock(character);
    if (stock.secretTreasure) {
      return `<p><strong></strong> ${randFrom(MERCHANT_SECRET_TREASURE_LINES)}</p>`;
    }
  }
  const line = getConversationLine({ character, village: theVillage });
  return `<p><strong></strong> ${line || "..."}</p>`;
}

function refreshConversationText(character) {
  const text = document.getElementById("conversationText");
  if (!text) return;
  text.innerHTML = createConversationStatusHtml(character);
}

function isMerchantVisitor(character) {
  return getVisitorType(character) === "行商人";
}

function ensureMerchantStock(visitor) {
  if (!visitor.merchantStock) {
    visitor.merchantStock = {
      food: MERCHANT_TRADE.food.initialStock,
      materials: MERCHANT_TRADE.materials.initialStock
    };
  }
  if (typeof visitor.merchantStock.food !== "number") {
    visitor.merchantStock.food = MERCHANT_TRADE.food.initialStock;
  }
  if (typeof visitor.merchantStock.materials !== "number") {
    visitor.merchantStock.materials = MERCHANT_TRADE.materials.initialStock;
  }
  if (typeof visitor.merchantStock.secretTreasure !== "boolean") {
    visitor.merchantStock.secretTreasure = Math.random() < MERCHANT_SECRET_TREASURE_CHANCE;
  }
  return visitor.merchantStock;
}

/**
 * 会話モーダルを開く
 */
export function openConversationModal(character) {
  const overlay = document.getElementById("conversationOverlay");
  const modal = document.getElementById("conversationModal");
  const portrait = document.getElementById("conversationPortrait");
  const text = document.getElementById("conversationText");
  const actionButtons = document.getElementById("actionButtons");

  if (!overlay || !modal || !portrait || !text || !actionButtons) return;

  // 共通関数を使用して顔グラフィックのパスを取得
  const portraitPath = getPortraitPath(character);
  console.log(`Character: ${character.name}, Portrait: ${portraitPath}`);

  // 顔グラフィックを設定（エラーハンドリング付き）
  try {
    portrait.src = portraitPath;
    portrait.onerror = () => {
      console.error(`Portrait image not found: ${portraitPath}`);
      portrait.src = 'images/portraits/default.png';
    };
  } catch (error) {
    console.error('Error loading portrait:', error);
    portrait.src = 'images/portraits/default.png';
  }
  portrait.style.cursor = "pointer";
  portrait.title = "クリックで会話を更新";
  portrait.onclick = () => refreshConversationText(character);
  
  // キャラクター情報を表示するためのHTML要素を追加
  const characterInfo = document.getElementById("characterInfo");
  if (characterInfo) {
    characterInfo.innerHTML = `
      <div class="character-name">${character.name}｜${character.race}｜${character.bodySex}｜${character.bodyAge}歳</div>
    `;
  }
  
  const isVillageMember = theVillage.villagers.includes(character);
  if (isVillageMember) {
    refreshJobTable(character, theVillage);
  }

  // キャラクターの状態を判定
  const isExhausted = character.hp <= 33 || character.mp <= 33;
  const isTired = (character.hp > 33 && character.hp <= 59) || (character.mp > 33 && character.mp <= 59);
  const isHealthy = character.hp > 59 && character.mp > 59;
  const isUnderRaid = theVillage.villageTraits.includes("襲撃中");
  const isVisitor = character.mindTraits && character.mindTraits.includes("訪問者");
  const hasFailedRecruitment = character.mindTraits && character.mindTraits.includes("勧誘失敗");
  
  // 会話テキストを設定
  refreshConversationText(character);

  // ボタンの表示制御
  actionButtons.innerHTML = "";
  
  if (isVisitor) {
    // 訪問者で、かつ勧誘失敗フラグがない場合は勧誘と誘惑ボタンを表示
    const buttons = [];
    if (!hasFailedRecruitment) {
      buttons.push('<button id="recruitButton">勧誘する</button>');
      buttons.push('<button id="seduceButton">誘惑する</button>');
    }
    if (isMerchantVisitor(character)) {
      ensureMerchantStock(character);
      buttons.push('<button id="merchantTradeButton">取引する</button>');
    }
    actionButtons.innerHTML = buttons.join("");
    actionButtons.style.display = buttons.length > 0 ? "block" : "none";
    
    // 勧誘ボタンのイベントリスナーを設定
    const recruitButton = document.getElementById("recruitButton");
    if (recruitButton) {
      recruitButton.addEventListener("click", () => {
        openRecruitmentModal(character);
      });
    }
    
    // 誘惑ボタンのイベントリスナーを設定
    const seduceButton = document.getElementById("seduceButton");
    if (seduceButton) {
      seduceButton.addEventListener("click", () => {
        openSeductionModal(character);
      });
    }

    const merchantTradeButton = document.getElementById("merchantTradeButton");
    if (merchantTradeButton) {
      merchantTradeButton.addEventListener("click", () => {
        openMerchantTradeModal(character);
      });
    }
  } else if (isUnderRaid && isVillageMember) {
    const raidButtonDefs = [
      { action: ACTION_DEFEND, id: "assignDefender" },
      { action: ACTION_FORTIFY, id: "assignFortifier" },
      { action: ACTION_SHOOT, id: "assignShooter" },
      { action: ACTION_TRAP, id: "assignTrapMaker" }
    ];
    const buttons = raidButtonDefs
      .filter(def => canPerformRaidAction(character, def.action, theVillage))
      .map(def => `<button id="${def.id}" class="${character.action === def.action ? 'active-action' : ''}">${def.action}任命</button>`);
    actionButtons.innerHTML = buttons.join("");
    actionButtons.style.display = buttons.length > 0 ? "block" : "none";

    raidButtonDefs.forEach(def => {
      const button = document.getElementById(def.id);
      if (button) {
        button.addEventListener("click", () => {
          changeCharacterAction(character, def.action);
        });
      }
    });
  } else {
    actionButtons.style.display = "none";
  }

  overlay.style.display = "block";
  modal.style.display = "block";
}

/**
 * 会話モーダルを閉じる
 */
export function closeConversationModal() {
  const overlay = document.getElementById("conversationOverlay");
  const modal = document.getElementById("conversationModal");
  
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
}

/**
 * キャラクターの行動を変更する
 */
function changeCharacterAction(character, newAction) {
  refreshJobTable(character, theVillage);

  if (isForcedHealingAction(character) && newAction !== "療養") {
    console.error(`Action ${newAction} is not available for this character`);
    return;
  }

  if (RAID_ACTIONS.includes(newAction) && !canPerformRaidAction(character, newAction, theVillage)) {
    console.error(`Action ${newAction} is not available for this character`);
    return;
  }

  if (Array.isArray(character.actionTable) && character.actionTable.includes(newAction)) {
    character.action = newAction;
    refreshConversationText(character);
    
    // ボタンのアクティブ状態を更新
    [
      ["assignDefender", ACTION_DEFEND],
      ["assignFortifier", ACTION_FORTIFY],
      ["assignShooter", ACTION_SHOOT],
      ["assignTrapMaker", ACTION_TRAP]
    ].forEach(([id, action]) => {
      const button = document.getElementById(id);
      if (button) button.className = newAction === action ? "active-action" : "";
    });
    
    // 村のUIを更新
    updateUI(theVillage);
  } else {
    console.error(`Action ${newAction} is not available for this character`);
  }
}

/**
 * 訪問者タイプを取得する関数
 */
function getVisitorType(visitor) {
  // 「〜の」で名前が始まる場合、その部分を訪問者タイプとして抽出
  const match = visitor.name.match(/^(.+)の/);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * 訪問者の勧誘係数を取得する関数
 */
function getRecruitmentCoefficient(visitor) {
  const visitorType = getVisitorType(visitor);
  if (visitorType && RECRUITMENT_COEFFICIENTS[visitorType]) {
    return RECRUITMENT_COEFFICIENTS[visitorType];
  }
  return 0.4; // デフォルト値
}

function hasUsedVisitorSocialAttempt(person) {
  return !!person?.socialAttemptedThisMonth;
}

function markVisitorSocialAttempt(person) {
  if (person) {
    person.socialAttemptedThisMonth = true;
  }
}

function getVisitorSocialCandidates() {
  return theVillage.villagers.filter(person => !hasUsedVisitorSocialAttempt(person));
}

function calculateRecruitmentSuccessRate(visitor, recruiter) {
  const coefficient = getRecruitmentCoefficient(visitor);
  return Math.min(100, Math.max(0,
    coefficient * (recruiter.chr / 20) * (recruiter.int / 20) * 100
  ));
}

function canAttemptSeduction(visitor, seducer) {
  // 誘惑は、訪問者の精神性別と誘惑者の肉体性別が異なる場合のみ可能。
  // 誘惑者側は「見た目・身体」として bodySex を参照し、
  // 訪問者側は「惹かれる向き」として spiritSex を参照する。
  if (visitor.spiritSex === seducer.bodySex) {
    return { ok: false, reason: "対象外性別" };
  }
  if (seducer.sexdr < 21) {
    return { ok: false, reason: "好色不足" };
  }
  return { ok: true, reason: "" };
}

function calculateSeductionSuccessRate(visitor, seducer) {
  const check = canAttemptSeduction(visitor, seducer);
  if (!check.ok) return 0;
  const coefficient = getRecruitmentCoefficient(visitor);
  const targetLustMultiplier = Math.max(0, ((Number(visitor.sexdr) || 0) - 10) / 10);
  return Math.min(100, Math.max(0,
    coefficient * (seducer.chr / 20) * (seducer.sexdr / 20) * targetLustMultiplier * 100
  ));
}

// 勧誘モーダルを開く
function openRecruitmentModal(visitor) {
  const candidates = getVisitorSocialCandidates();
  const hasCandidates = candidates.length > 0;
  const overlay = document.createElement("div");
  overlay.id = "recruitmentOverlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:3000;";
  
  const modal = document.createElement("div");
  modal.id = "recruitmentModal";
  modal.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;z-index:3001;min-width:300px;border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,0.1);";
  
  modal.innerHTML = `
    <h3 style="margin-top:0;">勧誘する村人を選択</h3>
    <p style="margin-bottom:15px;">${visitor.name}を勧誘します。</p>
    <select id="recruiterSelect" style="width:100%;padding:5px;margin-bottom:15px;">
      <option value="">${hasCandidates ? "勧誘する村人を選択してください" : "今月、勧誘・誘惑できる村人はいません"}</option>
      ${candidates.map(v => `
        <option value="${v.name}">${v.name} (魅力:${Math.floor(v.chr)} 知力:${Math.floor(v.int)} 成功率:${Math.floor(calculateRecruitmentSuccessRate(visitor, v))}%)</option>
      `).join('')}
    </select>
    <div id="recruitmentSuccessRate" style="margin:-5px 0 15px 0;color:#555;">成功率: -</div>
    <div style="display:flex;justify-content:flex-end;gap:10px;">
      <button id="cancelRecruitment" style="padding:5px 15px;">キャンセル</button>
      <button id="doRecruitment" style="padding:5px 15px;" ${hasCandidates ? "" : "disabled"}>勧誘する</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
  // イベントリスナーを設定
  const recruiterSelect = document.getElementById("recruiterSelect");
  const recruitmentSuccessRate = document.getElementById("recruitmentSuccessRate");
  recruiterSelect.addEventListener("change", () => {
    const recruiter = theVillage.villagers.find(v => v.name === recruiterSelect.value);
    recruitmentSuccessRate.textContent = recruiter
      ? `成功率: ${Math.floor(calculateRecruitmentSuccessRate(visitor, recruiter))}%`
      : "成功率: -";
  });

  document.getElementById("doRecruitment").addEventListener("click", () => {
    const recruiterName = document.getElementById("recruiterSelect").value;
    if (!recruiterName) {
      alert("勧誘する村人を選択してください。");
      return;
    }

    const recruiter = theVillage.villagers.find(v => v.name === recruiterName);
    if (!recruiter) return;
    if (hasUsedVisitorSocialAttempt(recruiter)) {
      alert(`${recruiter.name}は今月すでに勧誘または誘惑を試みています。`);
      return;
    }
    
    // 人口上限チェックを追加
    if (theVillage.villagers.length >= theVillage.popLimit) {
      alert("村の人口上限に達しています。新たな村人を受け入れるには、家屋を建設して人口上限を増やしてください。");
      theVillage.log(`勧誘失敗: 人口上限(${theVillage.popLimit}人)に達しています`);
      return;
    }
    markVisitorSocialAttempt(recruiter);
    
    const successRate = calculateRecruitmentSuccessRate(visitor, recruiter);
    
    // 勧誘判定
    if (Math.random() * 100 < successRate) {
      handleRecruitmentSuccess(visitor, recruiter, successRate);
    } else {
      // 失敗
      visitor.mindTraits.push("勧誘失敗");
      theVillage.log(`${recruiter.name}の勧誘は失敗しました。(成功率: ${Math.floor(successRate)}%)`);
      alert("勧誘に失敗しました。");
    }
    
    closeRecruitmentModal();
    closeConversationModal();
    updateUI(theVillage);
  });
  
  // キャンセルボタンのイベントリスナーを設定
  const cancelButton = document.getElementById("cancelRecruitment");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      closeRecruitmentModal();
    });
  }
  
  // オーバーレイクリックでもモーダルを閉じる
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeRecruitmentModal();
    }
  });
}

// 勧誘モーダルを閉じる
function closeRecruitmentModal() {
  const overlay = document.getElementById("recruitmentOverlay");
  const modal = document.getElementById("recruitmentModal");
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

// 誘惑モーダルを開く
function openSeductionModal(visitor) {
  const candidates = getVisitorSocialCandidates();
  const hasCandidates = candidates.length > 0;
  const overlay = document.createElement("div");
  overlay.id = "seductionOverlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:3000;";
  
  const modal = document.createElement("div");
  modal.id = "seductionModal";
  modal.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;z-index:3001;min-width:300px;border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,0.1);";
  
  modal.innerHTML = `
    <h3 style="margin-top:0;">誘惑する村人を選択</h3>
    <p style="margin-bottom:15px;">${visitor.name}を誘惑します。</p>
    <select id="seducerSelect" style="width:100%;padding:5px;margin-bottom:15px;">
      <option value="">${hasCandidates ? "誘惑する村人を選択してください" : "今月、勧誘・誘惑できる村人はいません"}</option>
      ${candidates.map(v => {
        const check = canAttemptSeduction(visitor, v);
        const rate = Math.floor(calculateSeductionSuccessRate(visitor, v));
        const rateText = check.ok ? `成功率:${rate}%` : `不可:${check.reason}`;
        return `<option value="${v.name}">${v.name} (魅力:${Math.floor(v.chr)} 好色:${Math.floor(v.sexdr)} ${rateText})</option>`;
      }).join('')}
    </select>
    <div id="seductionSuccessRate" style="margin:-5px 0 15px 0;color:#555;">成功率: -</div>
    <div style="display:flex;justify-content:flex-end;gap:10px;">
      <button id="cancelSeduction" style="padding:5px 15px;">キャンセル</button>
      <button id="doSeduction" style="padding:5px 15px;" ${hasCandidates ? "" : "disabled"}>誘惑する</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  
  // イベントリスナーを設定
  const seducerSelect = document.getElementById("seducerSelect");
  const seductionSuccessRate = document.getElementById("seductionSuccessRate");
  seducerSelect.addEventListener("change", () => {
    const seducer = theVillage.villagers.find(v => v.name === seducerSelect.value);
    if (!seducer) {
      seductionSuccessRate.textContent = "成功率: -";
      return;
    }
    const check = canAttemptSeduction(visitor, seducer);
    seductionSuccessRate.textContent = check.ok
      ? `成功率: ${Math.floor(calculateSeductionSuccessRate(visitor, seducer))}%`
      : `誘惑不可: ${check.reason}`;
  });

  document.getElementById("doSeduction").addEventListener("click", () => {
    const seducerName = document.getElementById("seducerSelect").value;
    if (!seducerName) {
      alert("誘惑する村人を選択してください。");
      return;
    }

    const seducer = theVillage.villagers.find(v => v.name === seducerName);
    if (!seducer) return;
    if (hasUsedVisitorSocialAttempt(seducer)) {
      alert(`${seducer.name}は今月すでに勧誘または誘惑を試みています。`);
      return;
    }
    
    // 人口上限チェックを追加
    if (theVillage.villagers.length >= theVillage.popLimit) {
      alert("村の人口上限に達しています。新たな村人を受け入れるには、家屋を建設して人口上限を増やしてください。");
      theVillage.log(`誘惑失敗: 人口上限(${theVillage.popLimit}人)に達しています`);
      return;
    }
    markVisitorSocialAttempt(seducer);
    
    // 条件チェック
    // 1. 訪問者の精神性別と誘惑者の肉体性別が異なるか
    // 2. 誘惑者の好色が21以上か
    const seductionCheck = canAttemptSeduction(visitor, seducer);
    if (!seductionCheck.ok && seductionCheck.reason === "対象外性別") {
      alert("誘惑は、誘惑者の肉体性別が、訪問者の精神性別にとって異性である場合に実行できます。誘惑者自身の精神性別ではなく、現在の肉体性別が参照されます。");
      theVillage.log(`${seducer.name}の誘惑は失敗しました。(理由: 対象外性別)`);
      closeSeductionModal();
      closeConversationModal();
      updateUI(theVillage);
      return;
    }
    
    if (!seductionCheck.ok && seductionCheck.reason === "好色不足") {
      alert("誘惑者の好色が足りません。誘惑できません。");
      theVillage.log(`${seducer.name}の誘惑は失敗しました。(理由: 誘惑者の好色不足)`);
      closeSeductionModal();
      closeConversationModal();
      updateUI(theVillage);
      return;
    }
    
    const successRate = calculateSeductionSuccessRate(visitor, seducer);
    
    // 誘惑判定
    if (Math.random() * 100 < successRate) {
      handleRecruitmentSuccess(visitor, seducer, successRate, "誘惑");
    } else {
      // 失敗
      visitor.mindTraits.push("勧誘失敗");
      theVillage.log(`${seducer.name}の誘惑は失敗しました。(成功率: ${Math.floor(successRate)}%)`);
      alert("誘惑に失敗しました。");
    }
    
    closeSeductionModal();
    closeConversationModal();
    updateUI(theVillage);
  });
  
  // キャンセルボタンのイベントリスナーを設定
  const cancelButton = document.getElementById("cancelSeduction");
  if (cancelButton) {
    cancelButton.addEventListener("click", () => {
      closeSeductionModal();
    });
  }
  
  // オーバーレイクリックでもモーダルを閉じる
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeSeductionModal();
    }
  });
}

// 誘惑モーダルを閉じる
function closeSeductionModal() {
  const overlay = document.getElementById("seductionOverlay");
  const modal = document.getElementById("seductionModal");
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

function openMerchantTradeModal(visitor) {
  const overlay = document.createElement("div");
  overlay.id = "merchantTradeOverlay";
  overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:3000;";

  const modal = document.createElement("div");
  modal.id = "merchantTradeModal";
  modal.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:20px;z-index:3001;min-width:360px;border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,0.1);";

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  const render = () => {
    const stock = ensureMerchantStock(visitor);
    modal.innerHTML = `
      <h3 style="margin-top:0;">行商人と取引</h3>
      <p style="margin-bottom:12px;">所持資金: ${theVillage.funds}</p>
      <div id="merchantTradeRows"></div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:15px;">
        <button id="closeMerchantTrade" style="padding:5px 15px;">閉じる</button>
      </div>
    `;

    const rows = document.getElementById("merchantTradeRows");
    Object.values(MERCHANT_TRADE).forEach(item => {
      const canBuy = stock[item.stockKey] >= item.unit && theVillage.funds >= item.price;
      const row = document.createElement("div");
      row.style.cssText = "display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #ddd;";
      row.innerHTML = `
        <div>
          <div><strong>${item.label}</strong> ${item.unit}個 / 資金${item.price}</div>
          <div style="font-size:0.85em;color:#555;">在庫: ${stock[item.stockKey]}</div>
        </div>
        <button data-buy="${item.stockKey}" ${canBuy ? "" : "disabled"}>購入</button>
        <button data-buy-max="${item.stockKey}" ${canBuy ? "" : "disabled"}>買えるだけ</button>
      `;
      rows.appendChild(row);
    });

    if (stock.secretTreasure) {
      const canBuySecretTreasure = theVillage.funds >= MERCHANT_SECRET_TREASURE_PRICE;
      const row = document.createElement("div");
      row.style.cssText = "display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;padding:10px 0;border-top:1px solid #ddd;";
      row.innerHTML = `
        <div>
          <div><strong>秘宝</strong> 1個 / 資金${MERCHANT_SECRET_TREASURE_PRICE}</div>
          <div style="font-size:0.85em;color:#555;">由来の知れない、布に包まれた品</div>
        </div>
        <button data-buy-secret-treasure ${canBuySecretTreasure ? "" : "disabled"}>購入</button>
      `;
      rows.appendChild(row);
    }

    rows.querySelectorAll("[data-buy]").forEach(button => {
      button.addEventListener("click", () => {
        buyFromMerchant(visitor, button.dataset.buy, 1);
        render();
      });
    });
    rows.querySelectorAll("[data-buy-max]").forEach(button => {
      button.addEventListener("click", () => {
        buyFromMerchant(visitor, button.dataset.buyMax, Infinity);
        render();
      });
    });
    rows.querySelector("[data-buy-secret-treasure]")?.addEventListener("click", () => {
      const event = buyMerchantSecretTreasure(theVillage, stock);
      if (!event) {
        alert("秘宝を購入できません。資金が不足しているか、すでに売り切れています。");
        return;
      }
      closeMerchantTradeModal();
      closeConversationModal();
      updateUI(theVillage);
      showSecretTreasureEventModals([event]);
    });

    document.getElementById("closeMerchantTrade").addEventListener("click", closeMerchantTradeModal);
  };

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeMerchantTradeModal();
    }
  });

  render();
}

function buyFromMerchant(visitor, stockKey, packs) {
  const item = Object.values(MERCHANT_TRADE).find(entry => entry.stockKey === stockKey);
  if (!item) return;

  const stock = ensureMerchantStock(visitor);
  const maxByStock = Math.floor(stock[item.stockKey] / item.unit);
  const maxByFunds = Math.floor(theVillage.funds / item.price);
  const count = Math.min(packs, maxByStock, maxByFunds);

  if (count <= 0) {
    alert("購入できません。資金または在庫が不足しています。");
    return;
  }

  const amount = item.unit * count;
  const cost = item.price * count;
  stock[item.stockKey] -= amount;
  theVillage.funds -= cost;
  addStoredResource(theVillage, item.stockKey, amount);
  theVillage.log(`行商人から${item.label}${amount}を購入: 資金-${cost}`);
  updateUI(theVillage);
}

function closeMerchantTradeModal() {
  const overlay = document.getElementById("merchantTradeOverlay");
  const modal = document.getElementById("merchantTradeModal");
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}

// 勧誘成功時の処理を修正
function handleRecruitmentSuccess(visitor, recruiter, successRate = 0, source = "勧誘") {
  const originalVisitor = visitor;
  // 訪問者のタイプを取得（名前から抽出）
  const visitorType = visitor.name.includes("の") ? visitor.name.split("の")[0] : null;
  
  visitor.mindTraits = visitor.mindTraits.filter(t => t !== "訪問者");
  setPreferredAction(visitor, ACTION_NONE);
  visitor.action = ACTION_NONE;
  visitor.jobTable = [];
  visitor.actionTable = [];
  
  // 棄民の場合は強制的に老人口調に設定
  if (visitorType === "棄民" || visitor.name.includes("棄民の")) {
    visitor.speechType = "老人";
  }
  
  // 名前から「〜の」を削除
  const separatorIndex = visitor.name.indexOf("の");
  if (separatorIndex >= 0) {
    visitor.name = visitor.name.slice(separatorIndex + 1);
  }
  
  // 訪問者リストから削除し、村人リストに追加
  theVillage.visitors = theVillage.visitors.filter(v => v !== originalVisitor);
  theVillage.villagers.push(visitor);
  incrementTitleCounter(
    recruiter,
    source === "誘惑" ? TITLE_COUNTER_KEYS.SEDUCTION_SUCCESS : TITLE_COUNTER_KEYS.RECRUITMENT_SUCCESS,
    1,
    { getPermanentStat }
  );
  recordVillagerJoinHistory(theVillage, visitor, { recruiter, source });
  
  // 行動テーブルを更新
  refreshJobTable(visitor, theVillage);
  
  theVillage.log(`${recruiter.name}の${source}により、${visitor.name}が村人になりました。(成功率: ${Math.floor(successRate)}%)`);
  alert(`${source}成功！${visitor.name}が村人になりました。`);
  
  // モーダルを閉じる
  closeConversationModal();
}
