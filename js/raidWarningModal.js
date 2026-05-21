const MODAL_OVERLAY_ID = "raidWarningOverlay";
const MODAL_ID = "raidWarningModal";
const PRIORITY_MODAL_SELECTORS = [
  "#seasonChangeDialog",
  "#festivalModal",
  "#randomEventModal",
  ".effect-result-modal"
];

let pendingRaidWarning = null;
let priorityModalObserver = null;

export function showRaidWarningModal({ raiderType, enemyCount }) {
  if (typeof document === "undefined") return;

  pendingRaidWarning = { raiderType, enemyCount };
  closeRaidWarningModal();
  showRaidWarningWhenReady();
}

function isPriorityModalOpen() {
  return PRIORITY_MODAL_SELECTORS.some(selector => document.querySelector(selector));
}

function waitForPriorityModalsToClose() {
  if (priorityModalObserver) return;
  priorityModalObserver = new MutationObserver(showRaidWarningWhenReady);
  priorityModalObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function stopWaitingForPriorityModals() {
  if (!priorityModalObserver) return;
  priorityModalObserver.disconnect();
  priorityModalObserver = null;
}

function showRaidWarningWhenReady() {
  if (!pendingRaidWarning) {
    stopWaitingForPriorityModals();
    return;
  }

  if (isPriorityModalOpen()) {
    waitForPriorityModalsToClose();
    return;
  }

  stopWaitingForPriorityModals();
  const { raiderType, enemyCount } = pendingRaidWarning;
  pendingRaidWarning = null;

  const isSingleEnemy = enemyCount === 1;
  const message = isSingleEnemy
    ? `${raiderType}が村に近づいています。迎撃してください！`
    : `${raiderType}の集団が村に近づいています。迎撃してください！`;
  const countText = isSingleEnemy ? "1体" : `${enemyCount}体`;

  const overlay = document.createElement("div");
  overlay.id = MODAL_OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(20, 5, 5, 0.56);
    z-index: 2100;
  `;

  const modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "raidWarningTitle");
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    box-sizing: border-box;
    width: min(520px, 92vw);
    max-height: 84vh;
    overflow-y: auto;
    color: #2b1612;
    background: #fff8f1;
    border: 2px solid #9d2b22;
    border-radius: 8px;
    box-shadow: 0 20px 46px rgba(0, 0, 0, 0.38);
    padding: 20px;
    z-index: 2101;
  `;

  const title = document.createElement("h2");
  title.id = "raidWarningTitle";
  title.textContent = "襲撃発生";
  title.style.cssText = `
    margin: 0 0 12px 0;
    color: #9d2b22;
    font-size: 1.55rem;
    letter-spacing: 0;
  `;

  const body = document.createElement("p");
  body.textContent = message;
  body.style.cssText = `
    margin: 0 0 14px 0;
    line-height: 1.65;
    font-size: 1rem;
  `;

  const detail = document.createElement("div");
  detail.style.cssText = `
    margin: 0 0 18px 0;
    padding: 10px 12px;
    background: #ffe8dc;
    border: 1px solid #efb5a5;
    border-radius: 6px;
    line-height: 1.55;
  `;
  detail.innerHTML = `<strong>襲撃者</strong><br>${raiderType} / ${countText}`;

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;justify-content:flex-end;";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "迎撃準備へ";
  closeButton.style.cssText = `
    min-width: 112px;
    padding: 8px 16px;
    color: #fff;
    background: #9d2b22;
    border: 1px solid #7f1f18;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  `;
  closeButton.onclick = closeRaidWarningModal;

  buttons.appendChild(closeButton);
  modal.appendChild(title);
  modal.appendChild(body);
  modal.appendChild(detail);
  modal.appendChild(buttons);

  overlay.onclick = closeRaidWarningModal;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  closeButton.focus();
}

export function closeRaidWarningModal() {
  const overlay = document.getElementById(MODAL_OVERLAY_ID);
  const modal = document.getElementById(MODAL_ID);
  if (overlay) overlay.remove();
  if (modal) modal.remove();
}
