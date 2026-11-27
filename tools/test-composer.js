/* Bridge Composer — vérifications (node tools/test-composer.js).
 *  1. Lignes d'influence : intégrale d'un triangle, LM71 et Bc sur travée isostatique de 20 m (valeurs de référence).
 *  2. Tous les types × route/rail × EC/F61 : aucune valeur NaN, quantités et coût > 0, dessins et DXF sans NaN.
 *  3. Prédimensionnement PSI-DA continu 12-15-12 : h = 0,60 m (L/26).
 *  4. Fondations : contrainte ≤ σ adm, effort par pieu ≤ Q adm.
 */
const C = Object.assign({}, require('../composer/calc.js'), require('../composer/draw.js'), require('../composer/dxf.js'), require('../composer/view3d.js'), require('../composer/analysis.js'), require('../composer/diag.js'), require('../composer/nlp.js'), require('../composer/sheet.js'));
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

/* interpréteur de descriptions */
{
  const S0 = C.normalize(C.defaults('route'));
  const t = (txt, f, msg) => { const r = C.interpret(txt, S0); ok(f(r.S, r) && !bad(JSON.stringify(r.S)), 'NLP « ' + txt + ' » → ' + msg); };
  t('Pont dalle à trois travées', (S) => S.tablier.type === 'PSIDA' && S.travees.length === 3 && S.piles.hauteurs.length === 2, 'PSI-DA, 3 travées');
  t('pont dalle à 3 travées de 12-16-12 m, 2 voies + trottoirs de 1,25, piles colonnes de 6 m, culées remblayées, sol 0,3 MPa, Fascicule 61',
    (S) => S.travees.join() === '12,16,12' && S.profil.roulable === 7 && S.piles.type === 'colonnes' && S.piles.hauteurs.join() === '6,6' && S.culees.type === 'remblayee' && S.fond.sigma === 0.3 && S.reglement === 'F61', 'phrase complète');
  t('VIPP 4 x 30 m sur piles colonnes de 8 m fondées sur pieux Ø1,20 de 18 m', (S) => S.travees.join() === '30,30,30,30' && S.fond.piles === 'pieux' && S.fond.diam === 1.2 && S.fond.long === 18 && S.fond.culees === 'superficielle', 'VIPP 4 × 30, pieux sous piles');
  t('pont-rail PRP de 19,40 m, culées sur pieux Ø1,20, 2 voies', (S) => S.usage === 'rail' && S.tablier.type === 'PRP' && S.travees.join() === '19.4' && S.fond.culees === 'pieux' && S.profil.nbVoiesFer === 2, 'pont-rail PRP');
  t('pont sur oued Bouregreg, dalle précontrainte continue, travées de rive de 18 m et centrales de 25 m, 4 travées', (S) => S.tablier.type === 'PSIDP' && S.travees.join() === '18,25,25,18' && /Bouregreg/.test(S.projet.nom), 'rives/centrales + nom');
  t('VIPP 4 travées, piles de 6, 8 et 6 m', (S) => S.piles.hauteurs.join() === '6,8,6', 'hauteurs énumérées');
  t('travée unique de 18 m', (S) => S.travees.length === 1 && C.typeStatus(S.tablier.type, S.travees, S.usage).k !== 'hors', 'type proposé dans son domaine');
  const r = C.interpret('bonjour', S0); ok(!r.ok.length && r.hint && JSON.stringify(r.S.travees) === JSON.stringify(S0.travees), 'NLP phrase inconnue : rien de modifié, exemples proposés');
}

// 7. tracé simple, vue en plan et plan d'ensemble
{
  // PL : raccordement parabolique, sommet en x = 50, pentes ±2 %, R = 2000 m → T = 40 m, flèche T²/2R = 0,40 m
  const t = C.normTrace({ z0: 100, p1: 2, pkS: 50, p2: -2, Rv: 2000 });
  ok(Math.abs(C.lrAt(t, 50) - (101 - 0.4)) < 1e-9 && Math.abs(C.lrAt(t, 0) - 100) < 1e-9 && Math.abs(C.lrAt(t, 100) - 100) < 1e-9, 'PL : raccordement parabolique (flèche T²/2R = 0,40 m au sommet)');
  const a = C.normTrace({ R: 100, G0: 0 }), q = C.xyAt(a, Math.PI * 50);        // quart de cercle
  ok(Math.abs(q.X - 100) < 1e-6 && Math.abs(q.Y - 100) < 1e-6 && Math.abs(q.G - 100) < 1e-6, 'TP : arc de cercle R = 100 m, quart de tour');
  ok(C.normTrace({ tnTxt: '10;5,5 0;4' }).tn.join() === '0,4,10,5.5', 'TN : lecture « PK;Z » (virgule décimale, tri)');
  const d = C.defaults('route'); d.travees = [16, 20, 16]; d.tablier.type = 'PSIDP';
  d.trace = { actif: true, pk0: 100, z0: 501.45, p1: -0.5, tnTxt: '90;498 100;497.8 112;494.4 140;494.4 150;497 160;498.4', couv: 1,
    obstacle: { type: 'oued', zFond: 494.4, phe: 497.5, aff: 2, revanche: 1, gis: 30 }, X0: 595161, Y0: 449607, G0: 100 };
  const m = C.compute(d), TR = m.trace, s1 = TR.sup[1];
  ok(Math.abs(s1.H - (s1.zSeat - (494.4 - 2))) < 0.01 && Math.abs(m.supports[1].H - s1.H) < 0.01, 'tracé : hauteur de pile en lit d’oued calée sous la limite des affouillements');
  ok(m.S.biais === 70 && TR.checks.length === 1 && TR.checks[0].ok, 'tracé : biais déduit du gisement (70 gr), revanche vérifiée');
  const svgP = C.toSVG(C.planScene(m), { id: 't' }), svgE = C.toSVG(C.elevScene(m), { id: 'u' }), sh = C.sheetSVG(m, {});
  ok(!bad(svgP) && !bad(svgE) && !bad(sh) && /VUE EN PLAN/.test(svgP) && /Altitudes TN/.test(svgE) && /viewBox="0 0 1189 841"/.test(sh) && /PLAN D’ENSEMBLE/.test(sh) && /COUPE TYPE DU TABLIER EN TRAVEE/.test(sh) && /SUR CULEE C0/.test(sh) && /COUPE LONGITUDINALE/.test(sh), 'feuille A0 (disposition des plans KLE) : coupe longitudinale, coupes types, cartouche en bande, sans valeur invalide');
  { const sv = JSON.parse(JSON.stringify(m.S)); sv.cartouche = { orient: 'h', img: 'data:image/png;base64,iVBORw0KGgo=' }; const mh = C.compute(sv), shh = C.sheetSVG(mh, {});
    ok(!bad(shh) && /<image [^>]*href="data:image\/png/.test(shh), 'feuille A0 : cartouche importé placé dans la bande');
    sv.cartouche = { orient: 'v', img: 'javascript:alert(1)' }; ok(!/<image/.test(C.sheetSVG(C.compute(sv), {})), 'feuille A0 : image de cartouche invalide ignorée'); }
  ok(!bad(C.buildDXF(m, {})), 'DXF avec vue en plan sans valeur invalide');
  const m0 = C.compute(C.defaults('rail'));
  ok(!bad(C.sheetSVG(m0, {})) && !m0.trace, 'feuille A0 sans tracé (pont-rail par défaut)');
}


{ // vues de détail des appuis (coupe longitudinale, coupe en plan, vue en plan du chevêtre / sommier)
  for (const [pt, ct, fm] of [['colonnes', 'enterree', 'superficielle'], ['voile', 'remblayee', 'pieux'], ['marteau', 'enterree', 'pieux']]) {
    const S = C.defaults('route'); S.piles.type = pt; S.culees.type = ct; S.fond.piles = fm; S.fond.culees = fm;
    if (pt === 'voile') { S.piles.dim = { nl: 2, fruit: 2 }; S.piles.bout = 'pointu'; }
    const Mx = C.compute(S);
    const okv = Mx.supports.every((sp) => { const D = C.supScenes(Mx, sp.id); return ['lo', 'pl', 'top'].every((k) => !bad(C.toSVG(D[k], { id: 'x' }))); });
    ok(okv, `vues de détail des appuis (${pt} / ${ct} / ${fm}) sans valeur invalide`);
  }
}

{ // bibliothèque d'appuis : culées KLE / PP73, voiles PP73, colonnes
  let ok_ = true;
  const chk = (S) => { const Mx = C.compute(C.normalize(S)); const v = [C.toSVG(C.elevScene(Mx), { id: 'e' }), C.toSVG(C.secScene(Mx, { part: 'culee' }), { id: 'c' })]; Mx.supports.forEach((sp) => { const D = C.supScenes(Mx, sp.id); ['lo', 'pl', 'top'].forEach((k) => v.push(C.toSVG(D[k], { id: 'x' }))); }); if (v.some(bad)) ok_ = false; };
  [['remblayee', 'U'], ['remblayee', 'suspendus'], ['enterree', 'AR'], ['enterree', 'AV'], ['enterree', 'aucun']].forEach(([t, r]) => { const S = C.defaults('route'); S.travees = [25, 30, 25]; Object.assign(S.culees, { type: t, retours: r, chev: 'C', gg: r !== 'AV' }); chk(S); });
  [1, 2, 3].forEach((g) => ['A', 'B', 'C'].forEach((f) => { const S = C.defaults('route'); S.travees = [25, 30, 25]; S.piles.type = 'voile'; Object.assign(S.piles, { grp: g, face: f, sect: g === 2 ? 'arete' : 'plane' }); S.piles.dim = { nl: g }; chk(S); }));
  ['circ', 'carre', 'rect', 'octo', 'ellip'].forEach((c) => { const S = C.defaults('route'); S.travees = [25, 30, 25]; S.piles.type = 'colonnes'; Object.assign(S.piles, { col: c, paires: c === 'carre' }); chk(S); });
  ok(ok_, 'bibliothèque d’appuis (culées KLE et PP73, 9 voiles PP73, 5 sections de colonnes) sans valeur invalide');
}
{ // deux tabliers jumelés avec joint longitudinal
  const S = C.defaults('route'); S.travees = [30, 40, 30]; S.tablier.type = 'VIPP'; S.profil.roulable = 17; S.tablier.jumeaux = true; S.tablier.joint = 0.02;
  const Mx = C.compute(C.normalize(S)), j = Mx.sec.joint / 2;
  const sep = Mx.sec.polys.every((pg) => { const xs = pg.pts.map((q) => q[0]); return Math.max(...xs) <= j + 1e-9 ? Math.max(...xs) <= -j + 1e-9 || Math.min(...xs) >= -j - 1e-9 : Math.min(...xs) >= j - 1e-9; });
  const v = [C.toSVG(C.elevScene(Mx), { id: 'e' }), C.toSVG(C.planScene(Mx), { id: 'p' }), C.toSVG(C.secScene(Mx, { part: 'pile' }), { id: 's' }), C.toSVG(C.secScene(Mx, { part: 'culee' }), { id: 'c' })];
  ok(Mx.sec.jumeaux && sep && Mx.sec.bear.length % 2 === 0 && !v.some(bad), 'deux tabliers jumelés : section coupée au joint, poutres par demi-tablier, vues valides');
  const Mv = C.compute(C.normalize(require('../composer/vitrine.js').vitrine));
  ok(Mv.sec.jumeaux && Math.abs(Mv.sec.joint - 0.02) < 1e-9, 'vitrine PRO2334 : 2 tabliers jumelés, joint 0,02');
}
{ // gabarit KLE paramétrique (modèle PRO2334) : VIPP et PPBA, tablier unique ou jumelé
  const G = require('../composer/vitrine.js').gabaritKLE; let okG = true;
  [{ type: 'VIPP' }, { type: 'PPBA' }, { type: 'VIPP', jumeaux: true }, { type: 'PPBA', travees: [15, 18, 18, 15], biais: 80 }, { type: 'VIPP', travees: [35] }].forEach((o) => {
    const Mx = C.compute(C.normalize(G(o))); const v = [C.sheetSVG(Mx, {}), C.toSVG(C.elevScene(Mx), { id: 'e' })];
    if (v.some(bad) || Mx.T.nom !== o.type || C.build3D(Mx).faces.length < 500) okG = false;
  });
  { const Mv = C.compute(C.normalize(require('../composer/vitrine.js').vitrine)), nP = C.sheetCount(Mv); let okP = nP >= 1; for (let k = 1; k <= nP; k++) { const sh = C.sheetSVG(Mv, { planche: k }); if (bad(sh) || !/PLAN D’ENSEMBLE/.test(sh) || (nP > 1 && !new RegExp('PLANCHE ' + k + ' / ' + nP).test(sh))) okP = false; } ok(okP, 'plan d’ensemble en ' + nP + ' planche(s), cartouche A4 numéroté'); }
  ok(okG, 'gabarit KLE : 5 ponts à poutres VIPP / PPBA générés (plan d’ensemble, 3D) sans valeur invalide');
}
console.log(fails ? fails + ' échec(s)' : 'Tous les contrôles passent.');
process.exit(fails ? 1 : 0);
