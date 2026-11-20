import {
  PORTRAIT_ATLAS_MAP,
  PORTRAIT_ATLAS_SHEETS
} from "./portraitAtlas.generated.js";
import {
  DEFAULT_PORTRAIT_KEY,
  getPortraitAssetPathForCharacter
} from "./portraitPaths.js";

const SPECIAL_PORTRAIT_SHEET = {
  url: "images/atlas/special-1.webp",
  cols: 3,
  rows: 1
};
const SPECIAL_PORTRAIT_MAP = {
  "ALIGNMENT.png": { col: 0, row: 0 },
  "WAR.png": { col: 1, row: 0 },
  "WOLF_PUP.png": { col: 2, row: 0 }
};


function getFileName(path) {
  return String(path || "").replace(/\\/g, "/").split("/").pop() || DEFAULT_PORTRAIT_KEY;
}

function escapeHtmlAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getManifestSprite(key) {
  const specialTile = SPECIAL_PORTRAIT_MAP[key];
  if (specialTile) return { key, ...specialTile, ...SPECIAL_PORTRAIT_SHEET };

  const tile = PORTRAIT_ATLAS_MAP[key];
  const sheet = tile ? PORTRAIT_ATLAS_SHEETS[tile.sheet] : null;
  if (!tile || !sheet) return null;
  return { key, ...tile, ...sheet };
}

function getFallbackBaseKey(key) {
  return key.replace(/_(old|young)\.png$/i, ".png");
}

function getSpriteStyles(sprite) {
  const x = sprite.cols > 1 ? (sprite.col / (sprite.cols - 1)) * 100 : 0;
  const y = sprite.rows > 1 ? (sprite.row / (sprite.rows - 1)) * 100 : 0;
  return {
    backgroundImage: `url("${sprite.url}")`,
    backgroundSize: `${sprite.cols * 100}% ${sprite.rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`
  };
}

export function resolvePortraitSprite(character) {
  const assetPath = getPortraitAssetPathForCharacter(character);
  const key = getFileName(assetPath);

  if (/\.svg$/i.test(key)) {
    return {
      key,
      url: assetPath,
      col: 0,
      row: 0,
      cols: 1,
      rows: 1
    };
  }

  return getManifestSprite(key)
    || getManifestSprite(getFallbackBaseKey(key))
    || getManifestSprite(DEFAULT_PORTRAIT_KEY);
}

// 妖精は小さな種族なので、枠の中に顔を縮めて描く（css/styles.css の portrait-sprite--fairy）。
const FAIRY_PORTRAIT_KEY_PATTERN = /^FAIRY\d+(_young)?\.png$/i;

function isFairyPortrait(sprite) {
  return FAIRY_PORTRAIT_KEY_PATTERN.test(sprite?.key || "");
}

/** 縮める顔は ::before に描くため、絵を CSS 変数で渡し、本体の背景画像は消す。 */
function getFairyLayerStyles(styles, sprite) {
  // CSS 変数の url() は使う側のスタイルシート基準で解決されるため、ページ基準の絶対URLにして渡す。
  const absoluteUrl = typeof document !== "undefined" ? new URL(sprite.url, document.baseURI).href : sprite.url;
  return {
    "--sprite-image": `url("${absoluteUrl}")`,
    "--sprite-size": styles.backgroundSize,
    "--sprite-position": styles.backgroundPosition
  };
}

export function applyPortraitToElement(element, character) {
  if (!element) return null;
  const sprite = resolvePortraitSprite(character);
  if (!sprite) return null;

  const styles = getSpriteStyles(sprite);
  const fairy = isFairyPortrait(sprite);
  element.classList.toggle("portrait-sprite--fairy", fairy);
  if (fairy) {
    Object.entries(getFairyLayerStyles(styles, sprite)).forEach(([name, value]) => element.style.setProperty(name, value));
    styles.backgroundImage = "none";
  } else {
    ["--sprite-image", "--sprite-size", "--sprite-position"].forEach(name => element.style.removeProperty(name));
  }
  element.classList.add("portrait-sprite");
  element.setAttribute("role", "img");
  if (!element.hasAttribute("aria-label")) {
    element.setAttribute("aria-label", character?.name || "肖像");
  }
  Object.assign(element.style, styles);
  return sprite;
}

export function getPortraitSpriteHtml(character, { size, alt, extraStyle = "" } = {}) {
  const sprite = resolvePortraitSprite(character);
  if (!sprite) return "";
  const styles = getSpriteStyles(sprite);
  const dimension = Number.isFinite(Number(size)) ? `${Number(size)}px` : String(size || "");
  const dimensionStyle = dimension ? `width:${dimension};height:${dimension};` : "";
  const fairy = isFairyPortrait(sprite);
  const imageStyle = fairy
    ? Object.entries(getFairyLayerStyles(styles, sprite)).map(([name, value]) => `${name}:${value};`).join("")
    : `background-image:${styles.backgroundImage};background-size:${styles.backgroundSize};background-position:${styles.backgroundPosition};`;
  const style = `${dimensionStyle}${imageStyle}${extraStyle}`;
  const label = alt ?? character?.name ?? "肖像";
  return `<div class="portrait-sprite${fairy ? " portrait-sprite--fairy" : ""}" role="img" aria-label="${escapeHtmlAttribute(label)}" style="${escapeHtmlAttribute(style)}"></div>`;
}
