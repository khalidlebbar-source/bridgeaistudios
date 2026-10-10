/* Vérifie que chaque calcul produit un croquis valide et une phrase « en clair ». */
const HB = require("./load-handbag.js");
let bad = 0, own = 0;
for (const c of HB.CALCS) {
  const I = {}; c.inputs.forEach(i => { if (i.k) I[i.k] = i.t === "sel" ? i.v : (i.v === "∞" ? Infinity : +i.v); });
  try {
    const r = c.calc(I), g = HB.getter(r);
    const f = HB.figFor(c, I, g, r), t = HB.clairFor(c, I, g, r);
    if (HB.FIGS[c.id] || c.fig) own++;
    if (!f || /NaN|undefined|Infinity/.test(f)) { bad++; console.log("✗ figure", c.id, f && (f.match(/.{40}(NaN|undefined|Infinity).{20}/) || [""])[0]); }
    if (!t || /NaN|undefined/.test(t)) { bad++; console.log("✗ en clair", c.id, t); }
  } catch (e) { bad++; console.log("✗", c.id, e.message); }
}
console.log(`${HB.CALCS.length} croquis et synthèses (${own} croquis dédiés), ${bad} problèmes`); process.exit(bad ? 1 : 0);
