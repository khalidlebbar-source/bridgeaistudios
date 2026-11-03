/* MURU — tests node : équilibre d'une bande, symétrie, cas d'origine (Muru.res). node tools/test-outils-muru.js */
const U = require('../outils/js/muru.js');
let f = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const near = (a, b, t) => Math.abs(a - b) <= t * Math.max(1e-9, Math.abs(b));
{ const d = U.exemple(); d.q.exp = 0; d.eau = null;
  const B = U.bande(d, 0.5, 1, { G: 1, T: 0, W: 0 }, {});
  const V = U.voile(d.v0, 0.5), H = V.zc - V.hc - d.radier.z;
  const Wv = 2 * 25 * ((V.e0 + V.e0 - (V.far + V.fav) * H) / 2 * H + V.ec * V.hc);
  const Wr = 25 * d.radier.e * (B.yB - B.yA);
  const Rz = B.r.reac.reduce((s, x) => s + x.Ry, 0);
  ok(near(Rz, Wv + Wr, 1e-3), 'MURU : réaction du sol = poids des voiles et du radier ' + Rz.toFixed(2) + ' / ' + (Wv + Wr).toFixed(2));
  const sg = B.sig; ok(near(sg[0], sg[sg.length - 1], 1e-6), 'MURU : symétrie des contraintes sous poids propre'); }
{ const r = U.calc(U.exemple());
  ok(r.verifs.every((v) => v.ok), 'MURU exemple : fondation vérifiée');
  // note d'origine (Muru.res), voile M0D, base, bandes 2 à 5 : face arrière 9,34 / 9,08 / 8,94 / 8,80 cm²/ml
  const a = r.voiles.v0.map((L) => L[0].ext);
  ok(Math.max(...a) < 12 && Math.min(...a) > 6, 'MURU : aciers extérieurs en pied de voile du même ordre que la note d’origine (8,8 à 9,3 cm²/ml) → ' + a.map((x) => x.toFixed(2)).join(' ')); }

process.exit(f ? 1 : 0);
