/* Vérifie que chaque calcul produit un croquis valide et une phrase « en clair ». */
const HB = require("../handbag/calcs.js"); globalThis.HANDBAG = HB;
const { FIGS, CLAIR } = require("../handbag/figures.js");
let bad = 0;
for (const c of HB.CALCS) {
  const I = {}; c.inputs.forEach(i => { if (i.k) I[i.k] = i.t === "sel" ? i.v : (i.v === "∞" ? Infinity : +i.v); });
  const r = c.calc(I);
  const g = k => { const s = (r.steps || []).find(x => x.k === k); if (s) return s.v; if (r.vals && k in r.vals) return r.vals[k]; for (const t of r.tables || []) if (t.key && t.key[k]) { const [a, b] = t.key[k]; return t.rows[a][b]; } throw new Error("clé " + k); };
  try {
    const f = FIGS[c.id] ? FIGS[c.id](I, g, r) : r.fig, t = CLAIR[c.id] ? CLAIR[c.id](I, g) : "";
    if (!f || /NaN|undefined|Infinity/.test(f)) { bad++; console.log("✗ figure", c.id, f && (f.match(/.{40}(NaN|undefined|Infinity).{20}/) || [""])[0]); }
    if (!t || /NaN|undefined/.test(t)) { bad++; console.log("✗ en clair", c.id, t); }
  } catch (e) { bad++; console.log("✗", c.id, e.message); }
}
console.log(`${HB.CALCS.length} croquis et synthèses, ${bad} problèmes`); process.exit(bad ? 1 : 0);
