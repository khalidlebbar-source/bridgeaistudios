/* RODBAN-ROPEN — tabliers de ponts-routes en dalle BA et à poutrelles enrobées (node tools/test-outils-tablier-route.js).
 * Cas analytiques indépendants (plaque MITC4, surfaces d'influence, placement des charges) + cas de référence chiffrés
 * des exemples d'origine « Rodban_Plaque_EC » et « Ropen_Plaque_EC » (calculs en plaque EC) : seules les valeurs
 * numériques attendues sont reprises ici. */
const R = require('../outils/js/tablier-route.js');
const P = require('../outils/js/poutres-continues.js');
let f = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));
const near = (a, b, t, m) => ok(rel(a, b) <= t, `${m} : ${(+a).toFixed(4)} (attendu ${b}, écart ${(rel(a, b) * 100).toFixed(2)} %)`);
const sum = (a) => a.reduce((s, v) => s + v, 0);

/* plaque rectangulaire ou biaise sur deux lignes d'appui denses (bande en flexion cylindrique) */
function bande(o) {
  const L = o.L || 10, B = o.B || 6, h = o.h || 0.5, nL = o.nL || 20, nB = o.nB || 12;
  const d = R.normaliser({ type: 'rodba', travees: [L], cg: 0, cd: 0, biais: o.biais || 100, sections: 10,
    trans: { dG: 0, tG: 0, lc: B, tD: 0, dD: 0, Bs: B, h, hr: h, hcr: h }, plaque: { nLon: nL, nLar: nB, nu: o.nu || 0 } });
  const G = R.geoTrans(d); d._Ecm = 30000;
  const ys = Array.from({ length: nB + 1 }, (_, k) => B * k / nB);
  d._app = [{ y: ys, kv: 0 }, { y: ys, kv: 0 }];
  const M = R.maillage(d, G), S = R.plaque(d, G, M);
  return { d, G, M, S };
}

/* ───────── 1. Plaque MITC4 : cas analytiques ───────── */
{
  const { G, M, S } = bande({});
  const q = 10, D = 30000e3 * 0.5 ** 3 / 12;
  const F = R.chargePlaque(M, S, { surf: [{ y1: 0, y2: G.B, q }] }), U = S.solve(F);
  const im = M.xi.findIndex((x) => Math.abs(x - 5) < 1e-6), jm = M.yy.findIndex((y) => Math.abs(y - 3) < 1e-6), n = M.id(im, jm);
  near(U[3 * n], 5 * q * 1e4 / (384 * D), 0.005, 'Bande isostatique 10 m, flèche à mi-portée 5qL⁴/384D');
  near(R.momentsNoeud(M, S, U, n)[0], q * 100 / 8, 0.01, 'Bande isostatique, moment mx = qL²/8');
  near(sum(S.sup.map((s) => R.reaction(S, U, F, s))), q * 10 * 6, 1e-6, 'Équilibre : Σ réactions = charge totale (600 kN)');
  // charge ponctuelle centrée : surface d'influence de mx (méthode adjointe) = calcul direct (réciprocité)
  const g = R.gMoment(M, S, n, 0), eta = S.solve(g);
  const Fp = R.chargePlaque(M, S, { points: [{ x: 3.0, y: 2.0, P: 100 }] }), Up = S.solve(Fp);
  const mDir = R.momentsNoeud(M, S, Up, n)[0], np = M.id(M.xi.findIndex((x) => Math.abs(x - 3) < 1e-6), M.yy.findIndex((y) => Math.abs(y - 2) < 1e-6));
  near(100 * eta[3 * np], mDir, 1e-8, 'Surface d’influence de mx (adjointe) = calcul direct sous 100 kN');
  // réaction : surface d'influence par la ligne de K (adjointe) = réaction directe
  const s0 = S.sup[5], z = S.solve(S.Krow(3 * s0.node));
  near(-100 * z[3 * np], R.reaction(S, Up, Fp, s0), 1e-8, 'Surface d’influence d’une réaction = réaction directe');
  // résolution multiple (4 seconds membres) = résolutions séparées
  const g2 = R.gMoment(M, S, n, 1), g3 = R.gMoment(M, S, n, 2), g4 = R.gShear(M, S, n);
  const Us = S.solveN([g, g2, g3, g4]), u4 = S.solve(g4);
  ok(Math.max(...Us[3].map((v, k) => Math.abs(v - u4[k]))) < 1e-12 * Math.max(...u4.map(Math.abs)) + 1e-18 && Math.abs(Us[0][3 * np] - eta[3 * np]) < 1e-15, 'Résolution simultanée de 4 seconds membres identique aux résolutions séparées');
}
{
  // dalle carrée simplement appuyée sur deux bords (ν = 0) sous charge uniforme : même résultat en biais 70 gr
  // pour la réaction totale ; le moment au centre diminue avec le biais (effet connu des dalles biaises)
  const a = bande({ biais: 100 }), b = bande({ biais: 70 });
  const run = (o) => { const F = R.chargePlaque(o.M, o.S, { surf: [{ y1: 0, y2: o.G.B, q: 10 }] }), U = o.S.solve(F); const n = o.M.id(o.M.xi.findIndex((x) => Math.abs(x - 5) < 1e-6), o.M.yy.findIndex((y) => Math.abs(y - 3) < 1e-6)); return { R: sum(o.S.sup.map((s) => R.reaction(o.S, U, F, s))), m: R.momentsNoeud(o.M, o.S, U, n) }; };
  const ra = run(a), rb = run(b);
  near(rb.R, 600, 1e-6, 'Dalle biaise 70 gr : Σ réactions = 600 kN');
  ok(rb.m[0] < ra.m[0] && Math.abs(rb.m[2]) > 1, `Dalle biaise 70 gr : mx centre ${rb.m[0].toFixed(1)} < dalle droite ${ra.m[0].toFixed(1)}, torsion mxy ≠ 0`);
}
/* ───────── 2. Placement des charges sur une surface d'influence ───────── */
{
  // surface d'influence unité (η = 1 partout) : LM1 = Σ TS + UDL × surface de chaussée ; classe 1, chaussée 6 m = 2 voies
  const { G, M } = bande({ L: 20, B: 9, nL: 20, nB: 18 });
  const Gr = R.grille(M, G, 0.1, 0.2), Su = R.surface(M, Gr, new Float64Array(M.nodes.length).fill(1));
  const ch = [Gr.cell(1.5), Gr.cell(7.5)], Lx = 20;
  const lm = R.placeLM1(Gr, Su, { sg: 1, fTS: 1, fUDL: 1, qtr: 0, classe: 1, ch, tr: [], a: 0.4 });
  near(lm.v, 600 + 400 + (9 * 3 + 2.5 * 1.2 * 3) * Lx, 0.005, 'LM1 sur surface unité, classe 1, 2 voies (TS 1000 kN + UDL 36 kN/m × 20 m)');
  const lm2 = R.placeLM1(Gr, Su, { sg: 1, fTS: 1, fUDL: 1, qtr: 0, classe: 2, ch, tr: [], a: 0.4 });
  near(lm2.v, 0.9 * 600 + 0.8 * 400 + (0.7 * 9 * 3 + 2.5 * 3) * Lx, 0.005, 'LM1 classe 2 (αQ1 0,9, αQ2 0,8, αq1 0,7, AN française)');
  near(R.placeLM2(Gr, Su, { sg: 1, beta: 0.9, f: 1, e2: 0, ch }), 360, 1e-9, 'LM2 sur surface unité : 400·βQ (βQ = αQ1 = 0,9)');
  near(R.placeRep(Gr, Su, [[Gr.cell(0), Gr.cell(1.5)]], 5, 1), 5 * 1.5 * 20, 0.005, 'qfk 5 kN/m² sur un trottoir de 1,50 m × 20 m');
  const v = R.vehLM3('3000/240');
  ok(v.lines.length === 13 && v.P === 3000 && v.w === 4.5 && Math.abs(v.len - 18) < 1e-9, 'LM3 3000/240 : 12 lignes de 240 kN + 1 de 120 kN à 1,50 m (EN 1991-2 tab. A1)');
  near(R.placeLM3(Gr, Su, { sg: 1, veh: R.vehLM3('900/150'), phi: 1, ch }), 900, 1e-9, 'LM3 900/150 sur surface unité = 900 kN');
  // surface linéaire en x (η = x/20) : TS au bout, valeur maxi atteinte en x → 20 − 0,6
  const eta = new Float64Array(M.nodes.length).map((_, k) => M.nodes[k].x / 20), S2 = R.surface(M, Gr, eta);
  const one = R.placeLM1(Gr, S2, { sg: 1, fTS: 1, fUDL: 0, qtr: 0, classe: 1, ch: [Gr.cell(1.5), Gr.cell(4.5)], tr: [], a: 0.4 });
  near(one.v, 600 * (20 - 0.6 - 0.1) / 20, 0.015, 'TS au plus défavorable sur une surface linéaire (grille de 0,20 m, roue diffusée)');
}
/* ───────── 3. Combinaisons ───────── */
{
  const cats = [{ kmax: 1, kmin: 1 }, { kmax: 1.4, kmin: 0.8 }];
  const c = R.combiner({ g: [100, 10], den: { max: 0, min: 0 }, q: { LM1: { max: 50, min: -5 }, tr3: { max: 3, min: 0 }, LM1f: { max: 20, min: -2 } } }, cats, 'ec');
  near(c.ELU.max, 1.35 * (100 + 14) + 1.35 * 53, 1e-12, 'EC : ELU = 1,35 Gsup + 1,35 gr1a (LM1 + trottoirs 3 kN/m²)');
  near(c.ELU.min, 100 + 8 - 1.35 * 5, 1e-12, 'EC : ELU mini = Ginf (γ = 1,00, kmin) + 1,35 Q mini');
  near(c.FRE.max, 114 + 20 + 0.4 * 3, 1e-12, 'EC : ELS fréquent = Gk + ψ1 gr1a');
  const b = R.combiner({ g: [100, 10], q: { AL: { max: 40, min: 0 }, Bc: { max: 50, min: -4 }, trott: { max: 5, min: 0 }, Mc120: { max: 70, min: 0 } } }, cats, 'f61');
  near(b.ELU.max, 1.35 * 114 + Math.max(1.6 * 55, 1.35 * 70), 1e-12, 'Fasc. 61 / BAEL : ELU = 1,35 Gmax + max(1,6 (B + trottoirs), 1,35 Mc)');
  near(b.ELS.max, 114 + Math.max(1.2 * 50 + 5, 70), 1e-12, 'Fasc. 61 / BAEL : ELS = G + max(1,2 B + trottoirs, Mc)');
}
/* ───────── 4. Calcul en poutre (Fascicule 61) ───────── */
{
  const r = R.calcul(Object.assign({}, R.DEF_RODBA, { methode: 'poutre' }));
  // réactions permanentes = poutre continue sous la charge linéique totale (contrôle indépendant)
  const S = P.build({ E: 30000, ns: 10, travees: r.d.travees.map((L) => ({ L, Ig: 1 })), consoles: { g: r.d.cg, d: r.d.cd }, appuis: [{}, {}, {}, {}] });
  const Rr = P.fixe(S, [{ type: 'q', a: -r.d.cg, b: r.Ltot + r.d.cd, q: r.Gl }]).appuis.map((a) => a.R);
  near(sum(r.cats.map((c, k) => r.app[1].ligne.rec.g[k])), Rr[1], 1e-6, 'Poutre : réaction permanente nominale P1 = poutre continue');
  ok(r.secs.length >= 30 && r.ba.lon.every((b) => b.As.every(Number.isFinite)), 'Poutre : sections d’acier calculées en toutes sections');
  ok(r.Kt.every((k) => k.K.Bc >= 1 && k.K.AL >= 1), 'Poutre : coefficients K de Guyon-Massonnet ≥ 1 (fibre la plus chargée)');
  let err = null; try { R.calcul(Object.assign({}, R.DEF_RODBA, { methode: 'poutre', biais: 60 })); } catch (e) { err = e; }
  ok(!!err, 'Calcul en poutre refusé pour un biais de 60 gr (domaine 70–130 gr)');
  err = null; try { R.calcul(Object.assign({}, R.DEF_RODBA, { travees: [40] })); } catch (e) { err = e; }
  ok(!!err, 'Portée de 40 m refusée (domaine 1–35 m)');
}

/* ───────── 5. Cas de référence : exemples d'origine (calcul en plaque EC, 3 travées 11,27 + 15,06 + 11,27 m, biais 80 gr) ───────── */
const rd = R.calcul(R.DEF_RODBA);
{
  // données d'entrée (Rodban_Plaque_EC.don / Rephor.don) : section du tablier 5,017 m² (export REPHOR), largeur 9,06 m
  near(rd.G.B, 9.06, 1e-9, 'Rodban : largeur du tablier');
  near(rd.G.A, 5.017068, 0.01, 'Rodban : aire de la section (REPHOR sectiontablier 5,017 m² ; l’original moyenne l’épaisseur transversale variable)');
  // charge permanente : masse totale 627,514 t (Rephor.don) sur 38,50 m → 159,9 kN/m
  near(rd.Gl, 627.514 * 9.81 / 38.5, 0.01, 'Rodban : charge permanente nominale (kN/m)');
  // descentes de charges globales : CP moyenne (max + min)/2 de l'original (tassements inclus dans max/min)
  const Gm = (a) => (a.ligne.c.Gk.max + a.ligne.c.Gk.min) / 2;
  // charges permanentes maxi / mini : poids propre × 1,05 / 1,00 dans les descentes de charges (retrouvé sur l'exemple)
  near(rd.app[0].ligne.c.Gk.max, 759.95, 0.005, 'Rodban : C.P. maxi, file C0');
  near(rd.app[0].ligne.c.Gk.min, 688.97, 0.01, 'Rodban : C.P. mini, file C0');
  near(rd.app[1].ligne.c.Gk.max, 2472.56, 0.005, 'Rodban : C.P. maxi, file P1');
  near(rd.app[1].ligne.c.Gk.min, 2241.12, 0.01, 'Rodban : C.P. mini, file P1');
  near(Math.max(...rd.app[0].bear.map((b) => b.c.Gk.max)), 236.00, 0.02, 'Rodban : C.P. maxi sur un appareil de C0');
  near(Math.max(...rd.app[1].bear.map((b) => b.c.Gk.max)), 735.92, 0.01, 'Rodban : C.P. maxi sur un appareil de P1');
  // LM1 sur la chaussée (l'original donne les trottoirs à part) : réaction globale maxi de la file
  near(rd.app[0].ligne.rec.q.LM1.max, 946.55, 0.05, 'Rodban : LM1 maxi, file C0');
  near(rd.app[1].ligne.rec.q.LM1.max, 1274.90, 0.02, 'Rodban : LM1 maxi, file P1');
  near(rd.app[2].ligne.rec.q.LM1.max, 1283.40, 0.02, 'Rodban : LM1 maxi, file P2');
  near(rd.app[3].ligne.rec.q.LM1.max, 948.84, 0.05, 'Rodban : LM1 maxi, file C3');
  // trottoirs 5 kN/m² : somme gauche + droite de l'original
  near(rd.app[0].ligne.rec.q.qfk.max, 29.00 + 27.25, 0.01, 'Rodban : trottoirs (5 kN/m²), file C0');
  near(rd.app[1].ligne.rec.q.qfk.max, 79.62 + 75.45, 0.01, 'Rodban : trottoirs (5 kN/m²), file P1');
  // réaction d'un appareil (le plus chargé) : LM1 et trottoirs
  const bMax = (a, k) => Math.max(...a.bear.map((b) => b.rec.q[k].max));
  near(bMax(rd.app[1], 'LM1'), 569.30, 0.05, 'Rodban : LM1 maxi sur un appareil de P1');
  near(bMax(rd.app[0], 'LM1'), 413.34, 0.10, 'Rodban : LM1 maxi sur un appareil de C0 (appuis ponctuels rigides : −7 %)');
  // moments ELU par mètre (Rodban_Plaque_EC_balong.cal) : maille sur appui P1 874,7 kN·m/m ; maille en travée 2 804,0 kN·m/m
  const sAt = (x) => rd.secs.reduce((b, s) => (Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b));
  near(-sAt(11.27).Mx.ELU.min, 874.70, 0.03, 'Rodban : moment ELU sur appui P1 (kN·m/m)');
  near(sAt(18.80).Mx.ELU.max, 803.99, 0.03, 'Rodban : moment ELU en travée 2 (kN·m/m)');
  // effort tranchant sur appui au centre de la première maille (option « maille », comme l'original) : VEd 846,5 kN/m,
  // Asw 39,87 cm²/m², aciers supérieurs flexion + ΔFtd 49,93 cm²/m ; en travée 2 : aciers de flexion seuls 36,74 cm²/m
  near(Math.max(sAt(11.27).V.ELU.max, -sAt(11.27).V.ELU.min), 846.53, 0.06, 'Rodban : effort tranchant ELU sur appui P1 (maille adjacente)');
  const bAt = (x) => rd.ba.lon.reduce((b, s) => (Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b));
  near(bAt(11.27).Asw, 39.87, 0.03, 'Rodban : armatures d’effort tranchant sur appui P1 (cm²/m²)');
  near(bAt(11.27).As[0], 49.93, 0.01, 'Rodban : aciers supérieurs sur appui P1, flexion + ΔFtd (cm²/m)');
  near(bAt(18.80).AsFlex[1], 36.74, 0.01, 'Rodban : aciers inférieurs de flexion en travée 2 (cm²/m)');
}
const ro = R.calcul(R.DEF_ROPEN);
{
  // poutrelles HEM 450 : caractéristiques de l'original (Ropen_Plaque_EC.res)
  near(ro.R.ine.Ic, 0.03202, 0.002, 'Ropen : inertie / acier, béton non fissuré court terme (n = 6)');
  near(ro.R.ine.Il, 0.02000, 0.002, 'Ropen : inertie / acier, béton non fissuré long terme (n = 18)');
  near(ro.R.ine.Icf, 0.02453, 0.002, 'Ropen : inertie / acier, béton fissuré court terme');
  near(ro.R.ine.Ilf, 0.01847, 0.002, 'Ropen : inertie / acier, béton fissuré long terme');
  near(ro.R.ent, 0.728, 0.001, 'Ropen : entraxe des poutrelles (1,253 + 9 × 0,728 m)');
  near(ro.pe.Av, 0.011980, 0.001, 'Ropen : aire de cisaillement Av d’une poutrelle');
  near(ro.pe.VplRd, 2386.25, 0.001, 'Ropen : Vpl,Rd = Av·fy/√3 (fy = 345 MPa, S355 16 < tf ≤ 40 mm, NF EN 10025-2)');
  ok(ro.pe.fy === 345, 'Ropen : fy S355 pour tf = 40 mm = 345 MPa (fy saisi nul : selon la nuance et l’épaisseur)');
  near(ro.pe.dev.sigCrit, 146.5, 0.002, 'Ropen : contrainte critique de déversement simplifiée');
  near(ro.pe.dev.sigF15, 41.9, 0.01, 'Ropen : contrainte de flexion au bétonnage (15 cm de béton)');
  near(ro.pe.dev.sigF, 102.6, 0.02, 'Ropen : contrainte de flexion au bétonnage (béton total)');
  near(ro.pe.dal.q, 14.87, 0.001, 'Ropen : charge des dallettes (béton frais + 0,5 kN/m²)');
  near(ro.pe.dal.portee, 0.52, 0.005, 'Ropen : portée des dallettes');
  const Gm = (a) => (a.ligne.c.Gk.max + a.ligne.c.Gk.min) / 2;
  // charge permanente : vide sous les dallettes non déduit (masse totale de l'original 181,4 kN/m, déduite des réactions)
  near(ro.Gl, 181.4, 0.015, 'Ropen : charge permanente nominale (kN/m)');
  near(ro.app[1].ligne.c.Gk.max, 2789.59, 0.005, 'Ropen : C.P. maxi, file P1');
  near(ro.app[1].ligne.c.Gk.min, 2558.02, 0.005, 'Ropen : C.P. mini, file P1');
  near(ro.app[0].ligne.c.Gk.max, 852.64, 0.03, 'Ropen : C.P. maxi, file C0');
  // phase 1 : dalle résistante (largeur Bs) et poutrelles portées par les poutrelles seules, encorbellements en 2e phase ;
  // colonne « moment poutrelles seules » de l'original (ELU, somme des poutrelles) : 1793 kN·m en travée 2, 3060 sur P1
  const pAt = (x) => ro.pe.secs.reduce((b, s) => (Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b));
  near(1.35 * pAt(18.80).M1 * ro.R.N, 1793, 0.01, 'Ropen : moment ELU de phase 1 (poutrelles seules), travée 2');
  near(-1.35 * pAt(11.27).M1 * ro.R.N, 3060, 0.01, 'Ropen : moment ELU de phase 1 (poutrelles seules), appui P1');
  near(ro.app[1].ligne.rec.q.LM1.max, 1356.48, 0.08, 'Ropen : LM1 maxi, file P1');
  near(ro.app[1].ligne.rec.q.qfk.max, 79.62 + 75.58, 0.02, 'Ropen : trottoirs (5 kN/m²), file P1');
  // moment ELU négatif sur appui, poutrelle la plus sollicitée (enveloppe des poutrelles)
  const sAt = (x) => ro.pe.secs.reduce((b, s) => (Math.abs(s.x - x) < Math.abs(b.x - x) ? s : b));
  near(-sAt(11.27).MuMin, 744, 0.08, 'Ropen : moment ELU sur appui P1 par poutrelle (kN·m) — écart documenté');
  near(sAt(18.80).MuMax, 664, 0.15, 'Ropen : moment ELU en travée 2 par poutrelle (kN·m) — écart documenté (−13 %)');
  near(sAt(11.27).MRdN, -2432, 0.02, 'Ropen : moment résistant négatif avec chapeaux (par poutrelle)');
  ok(ro.pe.secs.every((s) => s.okELU), 'Ropen : ELU vérifié dans toutes les sections (original : « OK » partout)');
}
/* ───────── 6. Lecture .don, exports, plans ───────── */
{
  const don = ['application ;', 'RODBAN_ROPEN', 'typstruct ;', '0', 'nbtrav ;', '2', 'lontrav1 ;', '12', 'lontrav2 ;', '14', 'biais0 ;', '90', 'biais1 ;', '90', 'biais2 ;', '90',
    'larchausupg ;', '3.5', 'larchausupd ;', '3.5', 'lartrotsupg ;', '1', 'lartrotsupd ;', '1', 'dishouintgcg ;', '0.5', 'dishouintgcd ;', '0.5', 'demilartabg ;', '5', 'demilartabd ;', '5',
    'demisoutabg ;', '4', 'demisoutabd ;', '4', 'epdalmoy ;', '0.7', 'nbappfil0 ;', '3', 'nbappfil1 ;', '3', 'dishouapprivcul ;', '2', 'eaxeapprivcul ;', '3', 'eaxeappcencul ;', '3', 'FIN_DICO'].join('\r\n');
  const d = R.lireDon(don);
  ok(d.type === 'rodba' && d.travees.join() === '12,14' && d.trans.lc === 7 && d.trans.Bs === 8 && d.appareils.yC.join() === '2,5,8', 'Lecture .don : géométrie, chaussée et appareils');
  const ex = R.exportRephor(rd), ea = R.exportAppuis(rd);
  ok(ex.module === 'efforts-horizontaux' && ex.ap.length === 4 && ex.ap.every((a) => a.Gmax > 0 && a.Qmax > 0), 'Export REPHOR : 4 files avec G et Q');
  ok(ea.length === 4 && ea[1].appareils.nombre === 4 && ea[1].ligne.combinaisons.ELU.max > ea[1].ligne.combinaisons.ELS.max, 'Export APPUI : réactions par file et par appareil');
  const v = R.vues(ro), svg = v.map((x) => R.svgVue(x)).join('') + R.svgVue(R.vuePercage(ro));
  ok(v.length === 3 && /<svg/.test(svg) && !/NaN/.test(svg), 'Plans de coffrage (élévation, vue en plan, coupe) et de perçage en SVG sans valeur invalide');
  const pz = R.percage(ro);
  ok(pz.ent.length > 5 && pz.fer.length > 100 && Number.isFinite(pz.cfAt(18.8)) && pz.cfAt(18.8) > 0, 'Perçage : trous d’entretoises et d’aciers, contre-flèche positive à mi-travée');
}
console.log(f ? `\n${f} échec(s)` : '\nTous les tests passent.');
process.exit(f ? 1 : 0);
