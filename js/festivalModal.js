const FESTIVAL_DATA = {
  newYear: {
    title: "新年祭",
    month: "1月",
    image: "../images/festivals/new-year.png",
    flavor: "雪明かりの広場に火を入れ、村は新しい一年の無事を祈る。",
    effect: "全村人の体力+20、メンタル+20、幸福度+20から30。"
  },
  resurrection: {
    title: "復活祭",
    month: "3月",
    image: "../images/festivals/resurrection.png",
    flavor: "芽吹きの祭壇に祈りを捧げ、眠っていた生命力を呼び戻す。",
    effect: "全村人の体力+20、メンタル+20。幸福度に応じてマナを獲得。"
  },
  summerSolstice: {
    title: "夏至祭",
    month: "6月",
    image: "../images/festivals/summer-solstice.png",
    flavor: "もっとも長い陽の下、花飾りと篝火が村の縁を結び直す。",
    effect: "全村人の体力+20、メンタル+20、幸福度+20から30。結婚判定が発生。"
  },
  harvest: {
    title: "収穫祭",
    month: "10月",
    image: "../images/festivals/harvest.png",
    flavor: "実りを分け合い、働いた身体に温かな食事と休息を与える。",
    effect: "全村人の体力+40、メンタル+20。"
  },
  stars: {
    title: "星霜祭",
    month: "12月",
    image: "../images/festivals/stars.png",
    flavor: "冬の星々を見上げ、過ぎた歳月とまだ見ぬ縁に祈りを捧げる。",
    effect: "全村人の体力+20、メンタル+20。幸福度に応じてマナを獲得し、恋人判定が発生。"
  }
};

const queue = [];
let isShowing = false;

export function showFestivalModal(festivalKey) {
  const data = FESTIVAL_DATA[festivalKey];
  if (!data || typeof document === "undefined") return;

  queue.push(data);
  if (!isShowing) showNextFestivalModal();
}

function showNextFestivalModal() {
  const data = queue.shift();
  if (!data) {
    isShowing = false;
    return;
  }
  isShowing = true;

  const overlay = document.createElement("div");
  overlay.id = "festivalModalOverlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(12, 10, 8, 0.58);
    z-index: 1300;
  `;

  const modal = document.createElement("div");
  modal.id = "festivalModal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(720px, 92vw);
    min-height: min(360px, 86vh);
    max-height: 86vh;
    overflow-y: auto;
    color: #fffaf0;
    border: 1px solid rgba(255, 240, 190, 0.58);
    border-radius: 8px;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.48);
    background-image:
      linear-gradient(90deg, rgba(15, 11, 8, 0.86), rgba(15, 11, 8, 0.58) 52%, rgba(15, 11, 8, 0.34)),
      url("${new URL(data.image, import.meta.url).href}");
    background-size: cover;
    background-position: center;
    z-index: 1301;
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    box-sizing: border-box;
    min-height: min(360px, 86vh);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 14px;
    padding: clamp(22px, 5vw, 42px);
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.72);
  `;

  const month = document.createElement("div");
  month.textContent = data.month;
  month.style.cssText = `
    font-size: 0.9rem;
    font-weight: bold;
    color: #ffe3a1;
  `;

  const title = document.createElement("h2");
  title.textContent = data.title;
  title.style.cssText = `
    margin: 0;
    font-size: clamp(2rem, 7vw, 3.5rem);
    line-height: 1;
    letter-spacing: 0;
  `;

  const flavor = document.createElement("p");
  flavor.textContent = data.flavor;
  flavor.style.cssText = `
    max-width: 34rem;
    margin: 0;
    font-size: clamp(1rem, 2.8vw, 1.16rem);
    line-height: 1.7;
  `;

  const effect = document.createElement("div");
  effect.style.cssText = `
    max-width: 36rem;
    padding: 11px 13px;
    background: rgba(255, 248, 225, 0.12);
    border: 1px solid rgba(255, 232, 175, 0.36);
    border-radius: 6px;
    backdrop-filter: blur(2px);
    line-height: 1.55;
  `;
  effect.innerHTML = `<strong>効果</strong><br>${data.effect}`;

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;justify-content:flex-end;margin-top:4px;";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "閉じる";
  closeButton.style.cssText = `
    min-width: 88px;
    padding: 8px 16px;
    color: #2d2112;
    background: #ffe3a1;
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 6px;
    font-weight: bold;
  `;
  closeButton.onclick = closeFestivalModal;
  buttons.appendChild(closeButton);

  content.appendChild(month);
  content.appendChild(title);
  content.appendChild(flavor);
  content.appendChild(effect);
  content.appendChild(buttons);
  modal.appendChild(content);

  overlay.onclick = closeFestivalModal;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
}

function closeFestivalModal() {
  const overlay = document.getElementById("festivalModalOverlay");
  const modal = document.getElementById("festivalModal");
  if (overlay) overlay.remove();
  if (modal) modal.remove();
  isShowing = false;
  showNextFestivalModal();
}
