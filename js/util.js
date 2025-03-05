// util.js

/** 乱数系/Clamp/シャッフルなどのユーティリティ */

/**
 * [min, max] の範囲で整数を返す
 */
export function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * (min, max)の範囲で浮動小数を返す
 */
export function randFloat(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * 配列からランダムに1つ取り出す (空ならnull)
 */
export function randChoice(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * valを[mi, ma]にClampする
 */
export function clampValue(val, mi, ma) {
  return val < mi ? mi : (val > ma ? ma : val);
}

/**
 * 配列シャッフル
 */
export function shuffleArray(arr) {
  let n = [...arr];
  for (let i = n.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [n[i], n[j]] = [n[j], n[i]];
  }
  return n;
}

/**
 * 指定した数値を四捨五入して小数第3位まで保持する
 */
export function round3(num) {
  return Math.round(num * 1000) / 1000;
}

/**
 * 指定した最小値と最大値の間で、正規分布に従う乱数（整数）を返す
 * (最終的に clampValue で範囲内にするので、round2 で小数第2位まで保持)
 */
export function randNormalInRange(min, max, mean = (min + max) / 2, stddev = (max - min) / 4) {
  let u = 0, v = 0;
  // 0除算を避けるため、uとvが0にならないようにする
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  // Box–Muller変換で標準正規分布乱数生成
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  // 指定の平均と標準偏差に合わせる
  const value = num * stddev + mean;
  // 値を[min, max]にクランプし、整数に丸める
  return Math.round(clampValue(value, min, max));
}

/**
 * キャラクターの顔グラフィックパスを取得する共通関数
 * @param {Object} character - キャラクターオブジェクト
 * @returns {string} 顔グラフィックのパス
 */
export function getPortraitPath(character) {
  if (!character) return 'images/portraits/DEFAULT.png';
  return `images/portraits/${character.portraitFile || "DEFAULT.png"}`;
}
