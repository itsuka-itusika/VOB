(function initializeBalanceSeed() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  if (params.get("balanceMode") !== "1") return;

  const seedText = params.get("balanceSeed");
  if (!/^\d+$/.test(seedText || "")) return;

  const seedNumber = Number(seedText);
  if (!Number.isSafeInteger(seedNumber) || seedNumber < 0 || seedNumber > 0xFFFFFFFF) return;

  let state = seedNumber >>> 0;
  let calls = 0;
  Math.random = function seededRandom() {
    calls++;
    state = (state + 0x6D2B79F5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  Object.defineProperty(window, "__vobBalanceSeed", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      algorithm: "mulberry32",
      version: 1,
      seed: seedNumber,
      get calls() { return calls; },
      reset() {
        state = seedNumber >>> 0;
        calls = 0;
      }
    })
  });
})();
