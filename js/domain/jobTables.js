import { isForcedHealingAction } from "../util.js";
import { ACTION_DEFEND, ACTION_TRAP, isRaidActionAssignable } from "../raidRules.js";

export function applyForcedActionRestriction(person) {
  if (!person) return { restricted: false, changed: false, reason: "" };

  const beforeJob = person.job;
  const beforeAction = person.action;
  const beforeJobTable = Array.isArray(person.jobTable) ? person.jobTable.join("\u0001") : "";
  const beforeActionTable = Array.isArray(person.actionTable) ? person.actionTable.join("\u0001") : "";
  const bodyTraits = Array.isArray(person.bodyTraits) ? person.bodyTraits : [];
  const mindTraits = Array.isArray(person.mindTraits) ? person.mindTraits : [];

  if (bodyTraits.includes("危篤")) {
    person.jobTable = ["なし"];
    person.actionTable = ["臨終"];
    person.job = "なし";
    person.action = "臨終";
    return {
      restricted: true,
      changed: beforeJob !== person.job ||
        beforeAction !== person.action ||
        beforeJobTable !== person.jobTable.join("\u0001") ||
        beforeActionTable !== person.actionTable.join("\u0001"),
      reason: "危篤",
      action: "臨終"
    };
  }

  if (isForcedHealingAction(person)) {
    const reasons = [];
    ["病気", "疫病", "負傷", "過労", "産褥"].forEach(trait => {
      if (bodyTraits.includes(trait)) reasons.push(trait);
    });
    if (mindTraits.includes("抑鬱")) reasons.push("抑鬱");

    person.jobTable = ["なし"];
    person.actionTable = ["療養"];
    person.job = "なし";
    person.action = "療養";
    return {
      restricted: true,
      changed: beforeJob !== person.job ||
        beforeAction !== person.action ||
        beforeJobTable !== person.jobTable.join("\u0001") ||
        beforeActionTable !== person.actionTable.join("\u0001"),
      reason: reasons[0] || "状態異常",
      action: "療養"
    };
  }

  return { restricted: false, changed: false, reason: "" };
}

export function refreshJobTable(v, village = {}) {
  let sa = v.spiritAge;
  const villageTraits = Array.isArray(village.villageTraits) ? village.villageTraits : [];
  const bodyTraits = Array.isArray(v.bodyTraits) ? v.bodyTraits : [];
  const mindTraits = Array.isArray(v.mindTraits) ? v.mindTraits : [];
  const isBabyBodyWithNonBabyMind = bodyTraits.includes("赤子") && !mindTraits.includes("無垢") && sa > 3;
  const isBabyStage = !isBabyBodyWithNonBabyMind && (bodyTraits.includes("赤子") || mindTraits.includes("無垢") || sa <= 3);
  const isToddlerStage = mindTraits.includes("萌芽") || sa <= 9;
  const isAdolescentStage = mindTraits.includes("思春期") || sa <= 15;
  const addHealingActionIfNeeded = () => {
    if (isForcedHealingAction(v) && !v.actionTable.includes("療養")) {
      v.actionTable.push("療養");
    }
  };
  const addRaidActionsIfAllowed = () => {
    if (!villageTraits.includes("襲撃中") || !isRaidActionAssignable(v)) return;
    v.actionTable = v.actionTable.filter(action => action !== ACTION_DEFEND && action !== ACTION_TRAP);
    v.actionTable.unshift(ACTION_DEFEND, ACTION_TRAP);
  };

  if (applyForcedActionRestriction(v).restricted) {
    return;
  }

  if (isBabyStage) {
    v.jobTable = ["なし"];
    v.actionTable = ["休養"];
    addHealingActionIfNeeded();
    if (!v.jobTable.includes(v.job)) {
      v.job = "なし";
    }
    if (!v.actionTable.includes(v.action)) {
      v.action = "休養";
    }
    return;
  } else if (isBabyBodyWithNonBabyMind) {
    v.jobTable = ["採集", "内職", "研究", "なし"];
    v.actionTable = ["休養", "余暇", "採集", "内職", "研究"];
    addHealingActionIfNeeded();
    if (!v.jobTable.includes(v.job)) {
      v.job = "なし";
    }
    if (!v.actionTable.includes(v.action)) {
      v.action = v.jobTable.includes(v.job) && v.actionTable.includes(v.job) ? v.job : "余暇";
    }
    return;
  } else if (isToddlerStage) {
    v.jobTable = ["なし"];
    v.actionTable = ["休養", "遊び"];
    addHealingActionIfNeeded();
    if (!v.jobTable.includes(v.job)) {
      v.job = "なし";
    }
    if (!v.actionTable.includes(v.action)) {
      v.action = "遊び";
    }
    return;
  } else if (isAdolescentStage) {
    v.jobTable = ["鍛錬", "農作業", "伐採", "狩猟", "漁", "採集", "内職", "なし"];
    v.actionTable = ["休養", "遊び", "鍛錬", "農作業", "伐採", "狩猟", "漁", "採集", "内職"];
    addHealingActionIfNeeded();
    if (!v.jobTable.includes(v.job)) {
      v.job = "なし";
    }
    if (!v.actionTable.includes(v.action)) {
      v.action = v.jobTable.includes(v.job) && v.actionTable.includes(v.job) ? v.job : "遊び";
    }
    return;
  } else {
    // 基本の仕事テーブル（共通）
    let commonJobs = [
      "なし",
      "農作業", "狩猟", "漁",
      "伐採",
      "採集", "内職", "行商",
      "研究", "警備", "看護"
    ];

    // 建築物によって解放される仕事
    const buildingFlags = village.buildingFlags || {};

    // 建築物によって解放される共通の仕事
    if (buildingFlags.hasClinic) {
      commonJobs.push("あんま");
    }
    if (buildingFlags.hasLibrary) {
      commonJobs.push("写本");
    }
    if (buildingFlags.hasBrewery) {
      commonJobs.push("醸造");
    }
    if (buildingFlags.hasAlchemy) {
      commonJobs.push("錬金術");
    }
    if (buildingFlags.hasWeaving) {
      commonJobs.push("機織り");
    }

    // 性別に応じた仕事テーブル
    if (v.bodySex === "男") {
      v.jobTable = [
        ...commonJobs,
        "詩人", "神官"
      ];
    } else {
      v.jobTable = [
        ...commonJobs,
        "踊り子", "シスター"
      ];

      // 女性限定の建築物依存の仕事
      if (buildingFlags.hasTavern) {
        v.jobTable.push("バニー");
      }
      if (buildingFlags.hasChurch) {
        v.jobTable.push("巫女");
      }
    }

    // 性別に応じた行動テーブル
    if (v.bodySex === "男") {
      v.actionTable = [
        "休養", "余暇",
        "農作業", "狩猟", "漁",
        "伐採",
        "採集", "内職", "行商",
        "研究", "警備", "看護",
        "詩人", "神官"
      ];

      // 建築物によって解放される共通の仕事を行動テーブルにも追加
      if (buildingFlags.hasClinic) {
        v.actionTable.push("あんま");
      }
      if (buildingFlags.hasLibrary) {
        v.actionTable.push("写本");
      }
      if (buildingFlags.hasBrewery) {
        v.actionTable.push("醸造");
      }
      if (buildingFlags.hasAlchemy) {
        v.actionTable.push("錬金術");
      }
      if (buildingFlags.hasWeaving) {
        v.actionTable.push("機織り");
      }
    } else {
      v.actionTable = [
        "休養", "余暇",
        "農作業", "狩猟", "漁",
        "伐採",
        "採集", "内職", "行商",
        "研究", "警備", "看護",
        "踊り子", "シスター"
      ];

      // 建築物によって解放される共通の仕事を行動テーブルにも追加
      if (buildingFlags.hasClinic) {
        v.actionTable.push("あんま");
      }
      if (buildingFlags.hasLibrary) {
        v.actionTable.push("写本");
      }
      if (buildingFlags.hasBrewery) {
        v.actionTable.push("醸造");
      }
      if (buildingFlags.hasAlchemy) {
        v.actionTable.push("錬金術");
      }
      if (buildingFlags.hasWeaving) {
        v.actionTable.push("機織り");
      }

      // 女性限定の建築物依存の仕事を行動テーブルにも追加
      if (buildingFlags.hasTavern) {
        v.actionTable.push("バニー");
      }
      if (buildingFlags.hasChurch) {
        v.actionTable.push("巫女");
      }
    }

    addHealingActionIfNeeded();
    addRaidActionsIfAllowed();

    if (!v.jobTable.includes(v.job)) {
      v.job = "なし";
    }
    if (!v.actionTable.includes(v.action)) {
      v.action = v.actionTable.includes(v.job)
        ? v.job
        : (v.actionTable.includes("休養") ? "休養" : (v.actionTable[0] || "なし"));
    }
  }

  // 襲撃関連の行動は、行動の有効性チェックより前に追加する。
  // 後から追加すると、画面更新時に「迎撃」「罠作成」が通常行動へ戻されてしまう。
}
