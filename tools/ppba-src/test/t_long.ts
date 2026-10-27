import { convoyBc, convoyBt, convoyBr, convoyMc120, convoyMe120, convoyD, convoyE, maxEffect } from "../src/engine/fasc61";
const L = Number(process.env.L ?? 26.5);
const cases: [string, any, number][] = [["Bc1", convoyBc(), 1.2], ["Bt1", convoyBt(), 1], ["Br", convoyBr(), 1], ["Mc", convoyMc120(), 1], ["Me", convoyMe120(), 1], ["D", convoyD(), 1], ["E", convoyE(), 1]];
for (const [n, c, k] of cases) {
  const r: string[] = [];
  for (const f of [0, .1, .2, .3, .4, .5]) r.push(`${(k * maxEffect(c, L, f * L, "M")).toFixed(2)}/${(k * maxEffect(c, L, f * L, "T")).toFixed(2)}`);
  console.log(n.padEnd(4), r.join("  "));
}
