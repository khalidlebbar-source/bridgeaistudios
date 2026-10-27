/* Bridge Composer — vérifications (node tools/test-composer.js).
 *  1. Lignes d'influence : intégrale d'un triangle, LM71 et Bc sur travée isostatique de 20 m (valeurs de référence).
 *  2. Tous les types × route/rail × EC/F61 : aucune valeur NaN, quantités et coût > 0, dessins et DXF sans NaN.
 *  3. Prédimensionnement PSI-DA continu 12-15-12 : h = 0,60 m (L/26).
 *  4. Fondations : contrainte ≤ σ adm, effort par pieu ≤ Q adm.
 */
const C = Object.assign({}, require('../composer/calc.js'), require('../composer/draw.js'), require('../composer/dxf.js'), require('../composer/view3d.js'), require('../composer/analysis.js'), require('../composer/diag.js'));
let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) fails++; };
const bad = (s) => /NaN|undefined|Infinity/.test(s);
const I = C._int;

// 1. lignes d'influence
ok(Math.abs(I.etaInt(-1e3, 1e3, 20, 0) - 10) < 1e-9, 'aire de la ligne d’influence d’appui d’une travée de 20 m = 10 m');
// LM71 sur 20 m, réaction d'appui : 250 (1 + 0,92 + 0,84 + 0,76) + 80 × (20 − 5,6)² / 40 = 880 + 414,7 = 1294,7 kN
const r71 = I.lm71(20, 0);
ok(Math.abs(r71 - 1294.72) < 2, `LM71, réaction d’appui L = 20 m : ${r71.toFixed(1)} kN (attendu 1294,7)`);
// Bc : essieux 120 + 120 sur l'appui (0 et 1,5 m) …
const rbc = I.axleMax([[0, 60], [4.5, 120], [6.0, 120], [10.5, 60], [15.0, 120], [16.5, 120]], 0, 20);
ok(rbc > 380 && rbc < 460, `Bc, réaction d’appui L = 20 m (une file) : ${rbc.toFixed(1)} kN`);

// 2. balayage
let n = 0;
const f0 = fails;
for (const u of ['route', 'rail']) for (const t of C.TYPE_KEYS) for (const reg of ['EC', 'F61']) for (const fond of ['superficielle', 'pieux']) {
  const d = C.defaults(u);
  d.tablier.type = t; d.reglement = reg; d.fond.piles = fond; d.fond.culees = fond;
  if (t === 'VIPP' || t === 'MIXTE') d.travees = [32, 38, 32];
  const m = C.compute(d);
  const dump = JSON.stringify({ k: m.kpi, l: m.lines.map((x) => [x.G, x.Q, x.app.des]), s: m.supports.map((x) => [x.N, x.fo]) });
  const svg = C.toSVG(C.elevScene(m), { width: 900 }) + C.toSVG(C.secScene(m), { width: 600 });
  const dxf = C.buildDXF(m, { date: 'test' });
  m.an = C.analyse(m);
  const dg = ['M', 'V', 'S', 'R'].map((k) => C.diagSVG(m, k, { width: 800, height: 400 })).join('') + JSON.stringify(m.an.spans) + JSON.stringify(m.an.sups);
  const v3 = C.render3D(C.build3D(m), { yaw: -0.6, pitch: 0.4, zoom: 1, panX: 0, panY: 0 }, { width: 800, height: 500 });
  const good = !bad(dump) && !bad(svg) && !/nan/i.test(dxf) && m.total > 0 && m.kpi.beton > 0 && dxf.endsWith('EOF\r\n') && !bad(v3) && !bad(dg);
  if (!good) ok(false, `${u} ${t} ${reg} ${fond} ${bad(dump)} ${bad(svg)} ${/nan/i.test(dxf)}`);
  n++;
}
ok(fails === f0, n + ' combinaisons type × usage × règlement × fondation sans NaN, DXF et vue 3D complets');

// 2b. analyse longitudinale : solutions de référence
const A = C._an;
{
  let mdl = A.beamModel(20, [0, 20], 0.5), IL = A.influence(mdl), xs = mdl.xs, w = A.tributary(xs);
  const im = xs.findIndex((x) => Math.abs(x - 10) < 1e-9); let Mq = 0; for (let j = 0; j < xs.length; j++) Mq += IL.M[im][j] * w[j];
  ok(Math.abs(IL.M[im][im] - 5) < 1e-9 && Math.abs(Mq - 50) < 1e-6, `poutre isostatique 20 m : M(P = 1 à mi-portée) = ${IL.M[im][im].toFixed(3)} (5), M(q = 1) = ${Mq.toFixed(3)} (50)`);
  mdl = A.beamModel(40, [0, 20, 40], 0.5); IL = A.influence(mdl); xs = mdl.xs; w = A.tributary(xs);
  const is = xs.findIndex((x) => Math.abs(x - 20) < 1e-9); let Ms = 0, R1 = 0; for (let j = 0; j < xs.length; j++) { Ms += IL.M[is][j] * w[j]; R1 += IL.R[1][j] * w[j]; }
  ok(Math.abs(Ms + 50) < 0.1 && Math.abs(R1 - 25) < 0.01, `2 travées de 20 m, q = 1 : M sur appui = ${Ms.toFixed(2)} (−50), R centrale = ${R1.toFixed(2)} (25)`);
  const m = C.compute(C.defaults('route')); m.an = C.analyse(m);
  const t2 = m.an.spans[1], ref = m.g * 40 * 40 / 8;
  ok(Math.abs(t2.MG - ref) / ref < 0.005, `VIPP 40 m isostatique : M G = ${t2.MG.toFixed(0)} kN·m (gL²/8 = ${ref.toFixed(0)})`);
  const dmax = Math.max.apply(null, m.an.sups.map((s) => Math.abs(s.R.elu - m.supports[s.j].elu) / m.supports[s.j].elu));
  ok(dmax < 0.05, `réactions EF / descente de charges : écart maximal ${(dmax * 100).toFixed(1)} %`);
}

// 3. prédimensionnement
const a = C.compute(Object.assign(C.defaults('route'), { tablier: { type: 'PSIDA' }, travees: [12, 15, 12], piles: { type: 'voile', hauteurs: [6, 6] }, culees: { hauteurs: [3.5, 3.5] } }));
ok(a.h === 0.6 && a.cont, `PSI-DA 12 + 15 + 12 continu : h = ${a.h} m`);

// 4. fondations
a.supports.forEach((s) => ok(s.fo.q / 1000 <= a.S.fond.sigma + 1e-6, `${s.id} : q = ${(s.fo.q / 1000).toFixed(3)} MPa ≤ ${a.S.fond.sigma}`));
const dp = C.defaults('rail'); dp.fond.piles = 'pieux'; dp.fond.culees = 'pieux';
C.compute(dp).supports.forEach((s) => ok(s.fo.Npieu <= s.fo.Q + 1e-6, `${s.id} : ${(s.fo.Npieu / 1000).toFixed(2)} MN/pieu ≤ ${(s.fo.Q / 1000).toFixed(2)}`));

console.log(fails ? fails + ' échec(s)' : 'Tous les contrôles passent.');
process.exit(fails ? 1 : 0);
