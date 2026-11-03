/* MURU — tests node : équilibre d'une bande, symétrie, cas d'origine (Muru.res). node tools/test-outils-murs-u.js */
const U = require('../outils/js/murs-u.js');
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

/* cas d'origine Muru.don (Eurocodes) : aciers extérieurs au pied du voile M0D, bandes 2 à 5 de la note (9,34 / 9,08 / 8,94 /
 * 8,80 cm²/ml). Le programme d'origine découpe le voile en bandes le long du voile (et une console) ; ici, bandes du radier. */
{ const d = U.exemple(); d.ouv = 4.45; d.nbandes = 10; d.radier.L = 8; d.radier.zav = 56.8; d.eau = 52.36;
  for (const v of [d.v0, d.v1]) { v.ep = { h: 0.71, b: 0.61 }; v.zc = { h: 62.1, b: 57.1 }; v.talus = { h: [[-10.10, 56.85], [-6.62, 56.85], [2.86, 62.53], [16.39, 62.36]], b: [[-10.10, 56.85], [-6.62, 56.85], [2.86, 62.53], [16.39, 62.36]] }; }
  d.q = { type: 'fer', voies: 2, y: 3.143, larg: 7.295, exp: 44.55, chantier: 0, radier: 0, cote: 2 };
  d.fond.qu = 3.0; d.beton.fck = 28; d.beton.fyk = 500; d.beton.fiss = 0;
  const r = U.calc(d), a = r.voiles.v0.map((L) => L[0].ext), ref = [9.34, 9.08, 8.94, 8.80];
  ok(a.slice(1, 5).every((v, i) => near(v, ref[i], 0.02)), 'MURU : pied du voile M0D, bandes 2 à 5 (± 2 %) → ' + a.slice(1, 5).map((v) => v.toFixed(2)).join(' '));
  const g = r.verifs.find((v) => v.nom === 'ELU de glissement');
  ok(g && g.ok, 'MURU : glissement vérifié (poussées symétriques)'); }
process.exit(f ? 1 : 0);
