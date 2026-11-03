/* APPMOBIL — appareils d'appui en élastomère fretté (node tools/test-outils-appareils-appui.js).
 * Cas analytiques indépendants + cas de référence chiffrés tirés des notes de calcul d'origine (exemples PS23
 * pile et culée, combinaisons BC et E3, référentiels EN 1337-3, Sétra 2000 et Livret 2.01). Seules les valeurs
 * numériques attendues sont conservées ; les données d'entrée sont ressaisies ci-dessous. */
const A = require('../outils/js/elastomeres.js');
let f = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
// écart relatif admissible : les notes d'origine sont imprimées à 2 ou 3 décimales
const near = (a, b, tol = 2e-3) => Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-9) + 5e-4 * (Math.abs(b) < 1 ? 1 : 0);
const chk = (v, ref, m, tol) => ok(near(v, ref, tol), `${m} : ${(+v).toFixed(4)} (origine ${ref})`);
const crit = (r, id) => r.crit.find((c) => c.id === id);

/* ───────── 1. Cas analytiques ───────── */
{
  const g = A.geom({ a: 0.4, b: 0.5, n: 4, ti: 0.012, ts: 0.003, te: 0.0025, c: 0.005 });
  ok(Math.abs(g.ap - 0.39) < 1e-12 && Math.abs(g.bp - 0.49) < 1e-12, 'dimensions réduites a′ = a − 2c');
  chk(g.S, 0.39 * 0.49 / (2 * (0.39 + 0.49) * 0.012), 'facteur de forme S = A′/(lp·ti)', 1e-9);
  chk(g.Te, 4 * 0.012 + 2 * 0.0025, 'Te = n·ti + 2·te', 1e-9);
  chk(g.H, g.Te + 5 * 0.003, 'hauteur totale avec n + 1 frettes', 1e-9);
  chk(A.Ar(g, 0.039, 0), 0.39 * 0.49 * 0.9, 'surface réduite Ar = A′(1 − vx/a′)', 1e-9);
  // raideurs : K = G·A/Te
  const k = A.raideurs({ a: 0.4, b: 0.5, n: 4, ti: 0.012, ts: 0.003, te: 0.0025 }, { G: 0.9 });
  chk(k.Kh, 900 * 0.2 / 0.053, 'raideur horizontale G·A/Te (kN/m)', 1e-9);
  chk(k.Khd, 1800 * 0.2 / 0.053, 'raideur horizontale dynamique Gd·A/Te', 1e-9);
  // circulaire : S = D′/(4 ti), surface réduite par segment de cercle
  const gc = A.geom({ forme: 'circ', D: 0.4, n: 4, ti: 0.012, ts: 0.003, te: 0.0025, c: 0.005 });
  chk(gc.S, 0.39 / (4 * 0.012), 'circulaire : S = D′/(4·ti)', 1e-9);
  chk(A.Ar(gc, 0, 0), Math.PI * 0.39 * 0.39 / 4, 'circulaire : Ar(0) = A′', 1e-9);
  ok(A.Ar(gc, 0.39, 0) === 0, 'circulaire : Ar = 0 si v ≥ D′');
  // série K1 (BT4) : carré 2,37 ; bande infinie → 1
  chk(A.K1(1), 2.3712, 'K1 carré', 1e-4);
  ok(Math.abs(A.K1(1000) - 1) < 2e-3, 'K1 → 1 pour une bande infinie');
  // εc vérifié à la main : un seul cas permanent, sans rotation ni effort horizontal
  const r = A.verifier({ regl: 'en1337', plaque: { a: 0.4, b: 0.5, n: 4, ti: 0.012, ts: 0.003, te: 0.0025, c: 0.005 }, opts: { alpha0: 0 },
    combis: [{ type: 'ELUmax', Nld: 1500, Ncd: 0 }, { type: 'ELSmax', Nld: 1100, Ncd: 0 }, { type: 'ELUmin', Nld: 900, Ncd: 0 }] });
  const ec = 1.5 * 1500 / (900 * 0.39 * 0.49 * g.S);
  chk(crit(r, 'et').d.ec, ec, 'εc = 1,5 Fz/(G·Ar·S)', 1e-9);
  chk(crit(r, 'fl' + 'ELU').lim, 2 * 0.39 * 900 * g.S / (3 * g.Te) / 1000, 'flambement 2a′G S/(3Te)', 1e-9);
  chk(crit(r, 'ts').val, 1.3 * 1500 * 2 * 0.012 / (0.39 * 0.49 * 235000) * 1000, 'ts mini = Kp Fz 2ti/(Ar fy)', 1e-9);
  // monotonie du dimensionnement : plus de charge → appareil au moins aussi grand
  const C = (N) => [{ type: 'ELSmax', Nld: N * 0.7, Ncd: N * 0.3, aa: 0.002 }, { type: 'ELUmax', Nld: N * 0.95, Ncd: N * 0.45, aa: 0.003 }, { type: 'ELUmin', Nld: N * 0.7, Ncd: 0 }, { type: 'ELSmin', Nld: N * 0.7, Ncd: 0, aa: 0.002 }];
  const d1 = A.dimensionner({ regl: 'en1337', combis: C(1000), opts: { alpha0: 0.003 } });
  const d2 = A.dimensionner({ regl: 'en1337', combis: C(2500), opts: { alpha0: 0.003 } });
  ok(!d1.echec && !d2.echec && d2.plaque.a * d2.plaque.b >= d1.plaque.a * d1.plaque.b, `dimensionnement croissant avec la charge (${d1.plaque.a}×${d1.plaque.b} → ${d2.plaque.a}×${d2.plaque.b})`);
  ok(d1.crit.every((c) => c.ok || c.sel === false), 'appareil retenu : tous les critères de choix satisfaits');
  // dimensionnement circulaire
  const dc = A.dimensionner({ regl: 'en1337', forme: 'circ', combis: C(1500), opts: { alpha0: 0.003 } });
  ok(!dc.echec && dc.plaque.forme === 'circ', 'dimensionnement circulaire : ⌀ ' + (dc.plaque && dc.plaque.D));
  // lecture .don (fichier synthétique au même format clé ; commentaire / valeur)
  const don = ['typecal ;', '2', 'typereg ;', '1', 'larga ;', '400', 'largb ;', '500', 'nbfeuil ;', '6', 'epfeuil ;', '12', 'epfret ;', '3',
    'enrobfretsupinf ;', '0.006', 'typalpha ;', '4', 'alpha0 ;', '0.003', 'combec ;', '100 50 1 2 3 4 0.001 0 0.01 0.02 2', 'FIN_DICO'].join('\r\n');
  const inp = A.parseDon(don);
  ok(inp.regl === 'en1337' && inp.mode === 'verif' && inp.plaque.n === 5 && inp.plaque.te === 0.006 && inp.combis[0].type === 'ELSmax' && inp.combis[0].Hxld === 3 && inp.combis[0].vy === 0.01, 'lecture .don : référentiel, plaque, combinaison');
}

/* ───────── 2. Cas de référence EN 1337-3 ───────── */
const OP = { alpha0: 0.003, G: 0.9, Gd: 1.8, fy: 235, sigLim: 15 };
const T = ['ELSmax', 'ELSmin', 'ELUmax', 'ELUmin'];
// ordre des colonnes du fichier d'origine : Nld Ncd Fyld Fycd Fxld Fxcd αa αb vy vx
const mk = (rows) => rows.map((v, i) => { const [Nld, Ncd, Hyld, Hycd, Hxld, Hxcd, aa, ab, vy, vx] = v; return { type: T[i], Nld, Ncd, Hxld, Hyld, Hxcd, Hycd, aa, ab, vx, vy }; });
const pileBC = mk([[2931.228, 1038.879, 0, 35.316, 0, 18.835, 0.0011, 0, 0.0053, 0.0028], [1027.107, 0, 0, 35.316, 0, 18.835, 0.0011, 0, 0.0053, 0.0028],
  [3957.158, 1402.487, 0, 47.677, 0, 25.428, 0.00149, 0, 0.00715, 0.00378], [1386.594, 0, 0, 47.677, 0, 25.428, 0.00149, 0, 0.00715, 0.00378]]);
const culBC = mk([[1317.483, 1010.43, 62.784, 29.43, 31.392, 13.734, 0.0032, 0, 0.0316, 0.0156], [655.014, -33.354, 62.784, 29.43, 31.392, 13.734, 0.0032, 0, 0.0316, 0.0156],
  [1778.602, 1364.081, 84.758, 39.73, 42.379, 18.541, 0.00432, 0, 0.04266, 0.02106], [884.268, -45.028, 84.758, 39.73, 42.379, 18.541, 0.00432, 0, 0.04266, 0.02106]]);
const pileE3 = mk([[2931.228, 1964.943, 0, 0, 0, 0, 0.0011, 0, 0, 0], [1027.107, 0, 0, 0, 0, 0, 0.0011, 0, 0, 0], [3957.158, 2652.673, 0, 0, 0, 0, 0.00149, 0, 0, 0], [1386.594, 0, 0, 0, 0, 0, 0.00149, 0, 0, 0]]);

function compare(r, ref, lab) {
  for (const [id, v, w, tol] of ref) { const c = crit(r, id); if (!c) { ok(false, `${lab} ${id} absent`); continue; } chk(w === 'lim' ? c.lim : c.val, v, `${lab} ${c.nom}${w === 'lim' ? ' (limite)' : ''}`, tol); }
}
{ // AppMobil_EC_PS23_Pile_combiBC_determ : plaque retenue 500 × 600, 7 frettes de 4 mm, feuillets 12 mm
  const r = A.dimensionner({ regl: 'en1337', combis: pileBC, opts: OP });
  ok(r.plaque.a === 0.5 && r.plaque.b === 0.6 && r.plaque.n === 6 && r.plaque.ti === 0.012 && r.plaque.ts === 0.004, `EC pile BC détermination : ${r.plaque.a * 1000} × ${r.plaque.b * 1000}, ${r.plaque.n} feuillets (origine 500 × 600, 6 feuillets de 12 + 7 frettes de 4)`);
  compare(r, [['sig', 13.73], ['et', 3.324], ['eq', 0.100], ['ts', 2.51], ['rotELU', 0.905], ['rotELU', 2.792, 'lim'], ['flELU', 18.91], ['flELU', 42.59, 'lim'], ['glELU', 54.03], ['glELU', 393.69, 'lim'], ['sldELU', 4.89], ['svmax', 0.920], ['svmax', 2.102, 'lim'], ['svmin', 0.727], ['svmin', 0.754, 'lim']], 'EC pile BC');
  chk(r.tass.Kv / 1000, 1919.338, 'EC pile BC raideur verticale Kv (kN/mm)');
  ok(r.bossage.a === 0.67 && r.bossage.b === 0.8, 'EC pile BC bossage 0,67 × 0,80');
}
{ // AppMobil_EC_PS23_Culee_combiBC_determ : 300 × 600, 3 feuillets de 12
  const r = A.dimensionner({ regl: 'en1337', combis: culBC, opts: OP });
  ok(r.plaque.a === 0.3 && r.plaque.b === 0.6 && r.plaque.n === 3, `EC culée BC détermination : ${r.plaque.a * 1000} × ${r.plaque.b * 1000}, ${r.plaque.n} feuillets (origine 300 × 600, 3 feuillets)`);
  compare(r, [['sig', 13.61], ['et', 4.990], ['eq', 0.720], ['ts', 2.85], ['rotELU', 0.809], ['rotELU', 2.140, 'lim'], ['flELU', 21.48], ['flELU', 34.38, 'lim'], ['glELU', 138.59], ['glELU', 215.60, 'lim'], ['sldELU', 6.04], ['svmax', 0.972], ['svmax', 2.616, 'lim'], ['svmin', 0.768], ['svmin', 1.120, 'lim']], 'EC culée BC');
  chk(r.tass.Kv / 1000, 1468.489, 'EC culée BC Kv (kN/mm)');
}
{ // AppMobil_EC_PS23_Pile_combiE3_F1_determ : 600 × 600, 5 feuillets de 16, frettes 5 mm
  const r = A.dimensionner({ regl: 'en1337', combis: pileE3, opts: OP });
  ok(r.plaque.a === 0.6 && r.plaque.b === 0.6 && r.plaque.n === 5 && r.plaque.ts === 0.005, `EC pile E3 détermination : ${r.plaque.a * 1000} × ${r.plaque.b * 1000}, ${r.plaque.n} feuillets (origine 600 × 600, 5 feuillets de 16)`);
  compare(r, [['sig', 14.07], ['et', 3.496], ['ts', 3.36], ['rotELU', 1.090], ['rotELU', 3.987, 'lim'], ['flELU', 18.99], ['flELU', 38.39, 'lim'], ['glELU', 451.95, 'lim'], ['sldELU', 3.98], ['svmax', 0.902], ['svmin', 0.713], ['svmin', 0.750, 'lim']], 'EC pile E3');
  chk(r.tass.Kv / 1000, 1657.888, 'EC pile E3 Kv (kN/mm)');
}
{ // AppMobil_EC_PS23_Pile_combiBC_verif : plaque saisie 600 × 600, 5 × 16, ts 4, enrobages 8 mm (S externe avec 1,4·te)
  const r = A.verifier({ regl: 'en1337', plaque: { a: 0.6, b: 0.6, n: 5, ti: 0.016, ts: 0.004, te: 0.008, c: 0.005 }, combis: pileBC, opts: OP });
  compare(r, [['sig', 11.41], ['et', 3.266], ['eq', 0.083], ['ts', 2.78], ['rotELU', 3.813, 'lim'], ['flELU', 15.69], ['flELU', 33.99, 'lim'], ['glELU', 446.15, 'lim'], ['sldELU', 4.06], ['svmax', 0.860], ['svmin', 0.680]], 'EC pile BC vérif');
  chk(r.tass.Kv / 1000, 1405.698, 'EC pile BC vérif Kv (kN/mm)');
}

/* ───────── 3. Cas de référence guide Sétra 2000 ───────── */
{ // AppMobil_EC_PS23_Culee_combiBC_verif_2000 : 400 × 500, 5 × 12, ts 3, te 6 mm
  const r = A.verifier({ regl: 'setra2000', plaque: { a: 0.4, b: 0.5, n: 5, ti: 0.012, ts: 0.003, te: 0.006, c: 0.005 }, combis: culBC, opts: OP });
  compare(r, [['sig', 12.18], ['et', 3.066], ['eq', 0.480], ['ts', 1.81, 'val', 3e-3], ['rotELU', 2.895, 'lim'], ['rotELU', 1.088], ['rotELS', 2.144, 'lim'], ['flELU', 19.15], ['flELU', 29.41, 'lim'], ['flELS', 13.60],
    ['glELU', 755.32, 'lim'], ['sldELU', 5.39], ['glELS', 102.66], ['glELS', 164.85, 'lim'], ['sldELS', 3.83], ['svmax', 1.010], ['svmax', 2.073, 'lim'], ['svmin', 0.798], ['svmin', 0.876, 'lim']], 'Sétra 2000 culée BC');
  chk(r.tass.Kv / 1000, 1085.741, 'Sétra 2000 culée BC Kv (kN/mm)');
  ok(r.ok, 'Sétra 2000 culée BC : toutes conditions respectées (comme l’origine)');
}
{ // AppMobil_SETRA_PS23_Pile_combiE3_F1_verif : 600 × 600, 5 × 16, ts 4, te 8 → σld ELS = 2,95 < 3 MPa (NON à l'origine)
  const r = A.verifier({ regl: 'setra2000', plaque: { a: 0.6, b: 0.6, n: 5, ti: 0.016, ts: 0.004, te: 0.008, c: 0.005 }, combis: pileE3, opts: OP });
  compare(r, [['sig', 14.07], ['et', 2.564], ['ts', 2.49], ['rotELU', 4.398, 'lim'], ['rotELS', 3.258, 'lim'], ['rotELS', 0.806], ['flELU', 33.99, 'lim'], ['glELU', 1247.93, 'lim'], ['glELS', 311.57, 'lim'], ['sldELS', 2.95], ['svmax', 0.430 * 2], ['svmin', 0.680]], 'Sétra 2000 pile E3');
  ok(!crit(r, 'sldELS').ok && !r.ok, 'Sétra 2000 pile E3 : contrainte minimale ELS non respectée (comme l’origine)');
  chk(r.tass.Kv / 1000, 1503.039, 'Sétra 2000 pile E3 Kv (kN/mm)');
}

/* ───────── 4. Cas de référence Livret 2.01 ───────── */
const eluL = (rows) => rows.map(([N, H2x, H2y, aT, u1x, u1y]) => ({ N, H2x, H2y, aT, u1x, u1y }));
{ // Pra_pile_verif : pont-rail 600 × 600, 7 × (16 + 4)
  const r = A.verifier({ regl: 'livret', plaque: { a: 0.6, b: 0.6, n: 7, ti: 0.016, ts: 0.004, c: 0.005 }, opts: { alpha0: 0.003 },
    livret: { Nmax: 4506.2, mins: [{ N: 839.88, alpha: 0.000651 }], Neles: 637.83, Heles: 47.22,
      elu: eluL([[5774.8, 26, 3.4, 0.0002, 0.0105, 0.0017], [5774.8, 17.2, 2, 0.0002, 0.0105, 0.0017], [6084.1, 21.9, 2.7, 0.0003, 0.0105, 0.0017], [3610.5, 13.8, 2.2, 0.0002, 0.0137, 0.0022]]) } });
  compare(r, [['sig', 12.95], ['rot', 0.000522], ['rot', 0.000642, 'lim'], ['tau', 2.987], ['ts', 4.76], ['smin', 1.83], ['gl', 272.64, 'lim']], 'Livret PRA pile');
  const r3 = r.rows[2]; chk(r3.tN / 1000, 2.844, 'Livret PRA pile τN comb. 3'); chk(r3.tH / 1000, 0.117, 'Livret PRA pile τH comb. 3'); chk(r3.ta / 1000, 0.026, 'Livret PRA pile τα comb. 3', 1e-2);
  chk(r.rows[3].tH1 / 1000, 0.111, 'Livret PRA pile τH1 comb. 4');
  ok(!crit(r, 'ts').ok && !crit(r, 'smin').ok && crit(r, 'gl').ok, 'Livret PRA pile : frettes et σmin non respectés, glissement OK (comme l’origine)');
  chk(r.tass.Kv / 1000, 1604.886, 'Livret PRA pile Kv = a³bG/(t³K1 n) (kN/mm)', 1e-3);
}
{ // Pro_pile_verif : pont-route 200 × 400, 3 × (8 + 2), frettes 2 mm (σe = 215 MPa)
  const r = A.verifier({ regl: 'livret', plaque: { a: 0.2, b: 0.4, n: 3, ti: 0.008, ts: 0.002, c: 0.005 }, opts: { alpha0: 0.003 },
    livret: { Nmax: 1065.45, mins: [{ N: 472.81, alpha: 0.001059 }], Neles: 381.76, Heles: 17.43,
      elu: eluL([[1343.5, 14.1, 2.2, 0.0022, 0.0023, 0.0004], [1433.7, 28.9, 4.6, 0.002, 0.0023, 0.0004], [720.6, 4.5, 0.7, 0.0017, 0.003, 0.0005]]) } });
  compare(r, [['sig', 14.38], ['rot', 0.001353], ['rot', 0.004722, 'lim'], ['tau', 4.089], ['ts', 2.14], ['smin', 5.15], ['gl', 82.64, 'lim']], 'Livret PRO pile');
  chk(r.rows[0].t / 1000, 3.776, 'Livret PRO pile τ comb. 1'); chk(r.rows[1].tH2 / 1000, 0.395, 'Livret PRO pile τH2 comb. 2');
  ok(crit(r, 'ts').fe === 215, 'Livret : σe = 215 MPa pour frettes Fe 360 de 2 mm');
  // origine 1082,923 kN/mm : le programme d'origine arrondit K1 à 3 décimales (1,447 au lieu de 1,4411) ; écart 0,4 %
  chk(r.tass.Kv / 1000, 1082.923, 'Livret PRO pile Kv (K1 non arrondi, écart 0,4 %)', 5e-3);
}

console.log(`\n${n - f}/${n} vérifications OK`);
process.exit(f ? 1 : 0);
