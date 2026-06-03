import { grantRandomSecretTreasure } from "./secretTreasures.js";

export const SECRET_TREASURE_JOB_EVENT_CHANCE = 0.01;
export const MERCHANT_SECRET_TREASURE_CHANCE = 0.03;
export const MERCHANT_SECRET_TREASURE_PRICE = 300;

const EVENT_DEFINITIONS = {
  field: {
    title: "土の底の秘宝",
    logPrefix: "畑から奇妙な物が出てきた",
    message: "畑の土を起こしていると、泥にまみれた奇妙な品が姿を現しました。村に伝わるどの道具とも違う、かすかな魔素を帯びた秘宝です。",
    imagePath: "images/events/secret-treasure-field.jpg"
  },
  fishing: {
    title: "網にかかった秘宝",
    logPrefix: "網に奇妙な物がかかった",
    message: "引き上げた網の中に、魚でも流木でもない奇妙な品が絡まっていました。水を払うと淡い光がこぼれ、秘宝として村に納められました。",
    imagePath: "images/events/secret-treasure-fishing.jpg"
  },
  merchant: {
    title: "行商人の秘蔵品",
    logPrefix: "行商人から秘宝を買い取った",
    message: "行商人が荷の奥から、布に包まれた奇妙な品を取り出しました。旅先で手に入れた由来の知れない秘宝だといいます。",
    imagePath: "images/events/secret-treasure-field.jpg"
  }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function createSecretTreasureEvent(village, type) {
  const event = EVENT_DEFINITIONS[type];
  const treasure = grantRandomSecretTreasure(village);
  if (!event || !treasure) return null;

  village.log(`【秘宝発見】${event.logPrefix}。${treasure.name}を入手しました`);
  return {
    ...event,
    treasureName: treasure.name
  };
}

export function rollSecretTreasureJobEvents(village, flags) {
  const events = [];
  if (flags.field && Math.random() < SECRET_TREASURE_JOB_EVENT_CHANCE) {
    events.push(createSecretTreasureEvent(village, "field"));
  }
  if (flags.fishing && Math.random() < SECRET_TREASURE_JOB_EVENT_CHANCE) {
    events.push(createSecretTreasureEvent(village, "fishing"));
  }
  return events.filter(Boolean);
}

export function buyMerchantSecretTreasure(village, stock) {
  if (!stock?.secretTreasure) return null;
  if (village.funds < MERCHANT_SECRET_TREASURE_PRICE) return null;

  village.funds -= MERCHANT_SECRET_TREASURE_PRICE;
  stock.secretTreasure = false;
  return createSecretTreasureEvent(village, "merchant");
}

export function showSecretTreasureEventModals(events) {
  if (typeof document === "undefined" || !Array.isArray(events) || events.length === 0) return;

  const queue = [...events];
  const showNext = () => {
    const event = queue.shift();
    if (!event) return;

    document.getElementById("secretTreasureEventOverlay")?.remove();
    document.getElementById("secretTreasureEventModal")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "secretTreasureEventOverlay";
    overlay.className = "event-modal-overlay";

    const modal = document.createElement("div");
    modal.id = "secretTreasureEventModal";
    modal.className = "event-modal secret-treasure-event-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `
      <img class="event-modal-image" src="${escapeHtml(event.imagePath)}" alt="">
      <div class="event-modal-body">
        <h3>${escapeHtml(event.title)}</h3>
        <p>${escapeHtml(event.message)}</p>
        <p class="event-modal-reward">入手した秘宝: ${escapeHtml(event.treasureName)}</p>
        <div class="event-modal-buttons">
          <button type="button" data-close-secret-treasure-event>閉じる</button>
        </div>
      </div>
    `;

    const close = () => {
      overlay.remove();
      modal.remove();
      showNext();
    };
    overlay.addEventListener("click", close);
    modal.querySelector("[data-close-secret-treasure-event]").addEventListener("click", close);

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
  };

  showNext();
}
