export const VILLAGE_SCALE_STAGES = [
  {
    threshold: 0,
    title: "名もなき小集落",
    description: "地図にも記録にもほとんど残らない、辺境の家々の集まりです。"
  },
  {
    threshold: 30,
    title: "小さな開拓村",
    description: "家屋や施設が整い始め、村としての形が見え始めました。"
  },
  {
    threshold: 70,
    title: "辺境の村",
    description: "外から見ても一つの村として認識される規模になりました。"
  },
  {
    threshold: 120,
    title: "旅人の立ち寄る村",
    description: "道行く者が足を止め、村の噂を外へ運ぶようになりました。"
  },
  {
    threshold: 180,
    title: "豊かな村",
    description: "食料、仕事、施設が安定し、周辺の小集落より豊かに見える村です。"
  },
  {
    threshold: 250,
    title: "繁栄した郷村",
    description: "近隣の中でも存在感を持ち、領主や教会の帳簿にも載りうる村です。"
  },
  {
    threshold: 350,
    title: "自治集落",
    description: "ただの村ではなく、外部から管理や警戒の対象として見られる共同体です。"
  }
];

const milestoneQueue = [];
let milestoneModalOpen = false;

function normalizeScale(scale) {
  return Math.max(0, Number(scale) || 0);
}

export function getVillageScaleStage(scale) {
  const currentScale = normalizeScale(scale);
  let index = 0;
  for (let i = 0; i < VILLAGE_SCALE_STAGES.length; i++) {
    if (currentScale >= VILLAGE_SCALE_STAGES[i].threshold) {
      index = i;
    }
  }
  return {
    ...VILLAGE_SCALE_STAGES[index],
    index
  };
}

export function getVillageScaleTitle(scale) {
  return getVillageScaleStage(scale).title;
}

export function applyVillageScaleArtClass(scale) {
  if (typeof document === "undefined" || !document.body) return;
  const stage = getVillageScaleStage(scale);
  VILLAGE_SCALE_STAGES.forEach((_, index) => {
    document.body.classList.toggle(`scale-stage-${index}`, index === stage.index);
  });
}

export function getInitialScaleStageIndex(scale) {
  return getVillageScaleStage(scale).index;
}

function ensureScaleStageIndex(village) {
  if (!Number.isInteger(village.scaleTitleStage)) {
    village.scaleTitleStage = getVillageScaleStage(village.building).index;
  }
  return village.scaleTitleStage;
}

function ensureMilestoneModal() {
  let overlay = document.getElementById("villageScaleOverlay");
  let modal = document.getElementById("villageScaleModal");
  if (overlay && modal) return { overlay, modal };

  overlay = document.createElement("div");
  overlay.id = "villageScaleOverlay";

  modal = document.createElement("div");
  modal.id = "villageScaleModal";

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  overlay.addEventListener("click", closeVillageScaleModal);
  return { overlay, modal };
}

function showNextMilestoneModal() {
  if (milestoneModalOpen || milestoneQueue.length === 0) return;
  if (typeof document === "undefined") return;

  const { stage, scale } = milestoneQueue.shift();
  const { overlay, modal } = ensureMilestoneModal();
  milestoneModalOpen = true;
  modal.className = `scale-stage-${stage.index}`;

  modal.innerHTML = `
    <div class="village-scale-modal-body">
      <div class="village-scale-kicker">村の発展</div>
      <h2>${stage.title}</h2>
      <p>${stage.description}</p>
      <p class="village-scale-current">現在の規模 ${scale}</p>
      <button type="button" data-close-village-scale-modal>閉じる</button>
    </div>
  `;

  const closeButton = modal.querySelector("[data-close-village-scale-modal]");
  if (closeButton) closeButton.addEventListener("click", closeVillageScaleModal);

  overlay.style.display = "block";
  modal.style.display = "block";
}

export function closeVillageScaleModal() {
  const overlay = document.getElementById("villageScaleOverlay");
  const modal = document.getElementById("villageScaleModal");
  if (overlay) overlay.style.display = "none";
  if (modal) modal.style.display = "none";
  milestoneModalOpen = false;
  showNextMilestoneModal();
}

export function showVillageScaleMilestones(village) {
  if (!village) return;

  const previousIndex = ensureScaleStageIndex(village);
  const currentStage = getVillageScaleStage(village.building);
  if (currentStage.index <= previousIndex) return;

  const reachedStages = VILLAGE_SCALE_STAGES
    .map((stage, index) => ({ ...stage, index }))
    .filter(stage => stage.index > previousIndex && stage.index <= currentStage.index && stage.index > 0);

  village.scaleTitleStage = currentStage.index;

  reachedStages.forEach(stage => {
    village.log(`【村の発展】村は「${stage.title}」と呼ばれる規模になった`);
    milestoneQueue.push({ stage, scale: normalizeScale(village.building) });
  });

  showNextMilestoneModal();
}
