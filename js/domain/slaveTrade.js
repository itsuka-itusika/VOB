// 奴隷商人と奴隷。奴隷商人は奴隷を連れて訪れ、代価と引き換えに奴隷を村へ引き渡す。
// 奴隷商人・奴隷という立場は精神側に結びつくため、肉体交換では入れ替わらない。

export const SLAVE_TRADER_TYPE = "奴隷商人";
export const SLAVE_TITLE = "奴隷";
export const FREED_SLAVE_TITLE = "解放奴隷";
export const SLAVE_TRAIT = "隷属";
export const SLAVE_TYPES = ["キュクロプス", "セントール", "エクイナ", "ドライアド", "翼人兵", "聖女"];
export const SLAVE_PRICE_MIN = 150;
export const SLAVE_PRICE_MAX = 300;

export function isEnslaved(person) {
  return Array.isArray(person?.mindTraits) && person.mindTraits.includes(SLAVE_TRAIT);
}

/** 奴隷が、その奴隷商人に連れられているか。 */
export function isSlaveOf(slave, trader) {
  return !!slave && trader?.slaveTrade?.slaveId === slave.id && isEnslaved(slave);
}

/** 奴隷商人がまだ連れている奴隷。売れた後や解放された後は null。 */
export function findTradedSlave(village, trader) {
  const visitors = Array.isArray(village?.visitors) ? village.visitors : [];
  return visitors.find(person => isSlaveOf(person, trader)) || null;
}

/** 奴隷を解放する。隷属が外れて肩書が解放奴隷に変わり、訪問者として村に残る。 */
export function freeSlave(slave) {
  slave.mindTraits = slave.mindTraits.filter(trait => trait !== SLAVE_TRAIT);
  const prefix = `${SLAVE_TITLE}の`;
  if (slave.name.startsWith(prefix)) {
    slave.name = `${FREED_SLAVE_TITLE}の${slave.name.slice(prefix.length)}`;
  }
}
