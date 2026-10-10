/* Vérifie que toutes les formules HandBag se composent sans erreur avec KaTeX.
   Usage : npm i katex && node tools/test-latex.js   (ou chemin du module katex en argument) */
const katex = require(process.argv[2] || "katex");
const { CALCS } = require("./load-handbag.js");
let n = 0, bad = 0;
const chk = (tex, where) => { n++; try { katex.renderToString(tex, { throwOnError: true, strict: "ignore" }); } catch (e) { bad++; console.log("✗", where, "→", tex, "\n   ", e.message); } };
const inline = (txt, where) => { if (typeof txt !== "string") return; const re = /\$([^$]+)\$/g; let m; while ((m = re.exec(txt))) chk(m[1], where); };
for (const c of CALCS) {
  inline(c.t, c.id); inline(c.desc, c.id); inline(c.ref, c.id);
  const I = {}; c.inputs.forEach(i => { if (i.h) return inline(i.h, c.id); if (i.s) chk(i.s, c.id + ".in." + i.k); inline(i.l, c.id); I[i.k] = i.t === "sel" ? i.v : (i.v === "∞" ? Infinity : +i.v); });
  const r = c.calc(I);
  (r.steps || []).forEach(s => { if (s.s) chk(s.s, c.id + "." + s.k + ".s"); if (s.f) s.f.startsWith("~") ? inline(s.f, c.id + "." + s.k) : chk(s.f, c.id + "." + s.k + ".f"); });
  (r.tables || []).forEach(t => { t.head.forEach(h => inline(String(h), c.id)); t.rows.forEach(row => inline(String(row[0]), c.id)); inline(t.title, c.id); });
  (r.checks || []).forEach(k => { inline(k.l, c.id); inline(k.txt, c.id); }); (r.notes || []).forEach(x => inline(x, c.id));
}
console.log(`${n} formules, ${bad} erreurs`); process.exit(bad ? 1 : 0);
