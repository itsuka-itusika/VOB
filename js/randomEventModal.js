import { getPortraitPath } from "./util.js";

const DEFAULT_LINE = "なにかが起きたようだ。";
const eventQueue = [];
let isShowing = false;

export function showRandomEventModal({ title, message, participants = [] }) {
  eventQueue.push({ title, message, participants });
  if (isShowing) return;
  showNextRandomEventModal();
}

function showNextRandomEventModal() {
  const event = eventQueue.shift();
  if (!event) {
    isShowing = false;
    return;
  }
  isShowing = true;
  const { title, message, participants = [] } = event;

  const overlay = document.createElement("div");
  overlay.id = "randomEventOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 1200;
  `;

  const modal = document.createElement("div");
  modal.id = "randomEventModal";
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, 92vw);
    max-height: 82vh;
    overflow-y: auto;
    background: #fff;
    border: 2px solid #888;
    box-shadow: 2px 2px 12px rgba(0,0,0,0.35);
    padding: 12px;
    z-index: 1201;
  `;

  const heading = document.createElement("h2");
  heading.textContent = title || "ランダムイベント";
  heading.style.margin = "0 0 8px 0";

  const body = document.createElement("p");
  body.textContent = message || "";
  body.style.margin = "0 0 12px 0";
  body.style.lineHeight = "1.5";
  body.style.whiteSpace = "pre-line";

  modal.appendChild(heading);
  modal.appendChild(body);

  const shownParticipants = participants.filter(p => p && p.character).slice(0, 4);
  if (shownParticipants.length > 0) {
    const list = document.createElement("div");
    list.style.cssText = "display:grid;gap:8px;margin:8px 0 12px 0;";

    shownParticipants.forEach(({ character, line }) => {
      const row = document.createElement("div");
      row.style.cssText = `
        display: grid;
        grid-template-columns: 54px 1fr;
        gap: 10px;
        align-items: center;
        border: 1px solid #ddd;
        background: #fafafa;
        padding: 6px;
      `;

      const frame = document.createElement("div");
      frame.style.cssText = `
        width: 48px;
        height: 48px;
        overflow: hidden;
        border: 1px solid #bbb;
        border-radius: 4px;
        background: #fff;
      `;

      const img = document.createElement("img");
      img.src = getPortraitPath(character);
      img.alt = character.name || "";
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center 30%;
        transform: scale(1.34);
        transform-origin: center 28%;
        display: block;
      `;
      frame.appendChild(img);

      const text = document.createElement("div");
      const name = document.createElement("div");
      name.textContent = character.name || "";
      name.style.cssText = "font-weight:bold;margin-bottom:2px;";
      const quote = document.createElement("div");
      quote.textContent = line || DEFAULT_LINE;
      quote.style.lineHeight = "1.45";
      text.appendChild(name);
      text.appendChild(quote);

      row.appendChild(frame);
      row.appendChild(text);
      list.appendChild(row);
    });

    modal.appendChild(list);
  }

  const buttons = document.createElement("div");
  buttons.style.cssText = "text-align:right;";
  const closeButton = document.createElement("button");
  closeButton.textContent = "閉じる";
  closeButton.onclick = () => closeRandomEventModal();
  buttons.appendChild(closeButton);
  modal.appendChild(buttons);

  overlay.onclick = () => closeRandomEventModal();
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

export function closeRandomEventModal() {
  const overlay = document.getElementById("randomEventOverlay");
  const modal = document.getElementById("randomEventModal");
  if (overlay) overlay.remove();
  if (modal) modal.remove();
  isShowing = false;
  showNextRandomEventModal();
}
