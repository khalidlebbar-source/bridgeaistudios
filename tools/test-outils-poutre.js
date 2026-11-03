/* POUTRE — tests du moteur (node tools/test-outils-poutre.js).
 * Cas analytiques indépendants + cas de référence chiffrés des exemples d'origine (Poutre_VarPortee, Poutre_ListOuv). */
const P = require('../outils/js/poutre.js');
const C = require('../outils/js/charges.js');
const PO = require('../outils/js/portique.js');
let f = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));
const beam = (L, o = {}) => P.build(Object.assign({ E: 30000, ns: 10, travees: L.map((x) => ({ L: x, Ig: 1 })), appuis: L.concat([0]).map(() => ({})) }, o));
const secAt = (S, r, x, side) => r.sec.find((s) => Math.abs(s.x - x) < 1e-9 && (side === undefined || s.side === side));

/* ── 1. Charges fixes ── */
{
  const EI = 3e7, S = beam([10]);
  let r = P.fixe(S, [{ type: 'q', a: 0, b: 10, q: 10 }]);
  ok(near(secAt(S, r, 5).M, 125), 'isostatique q : M = qL²/8 = 125');
  ok(near(secAt(S, r, 5).w, 5 * 10 * 1e4 / 384 / EI, 1e-6), 'isostatique q : flèche 5qL⁴/384EI');
  ok(near(r.appuis[0].R, 50) && near(r.appuis[0].th, 10 * 1000 / 24 / EI, 1e-6), 'isostatique q : R = 50, θ = qL³/24EI');
  r = P.fixe(S, [{ type: 'P', x: 3.3, P: 100 }]);
  ok(near(Math.max(...r.diag.map((d) => d.M)), 100 * 3.3 * 6.7 / 10), 'charge ponctuelle entre nœuds : M = Pab/L');
  ok(near(r.diag.find((d) => Math.abs(d.x - 3.3) < 1e-9).w, 100 * 3.3 * 3.3 * 6.7 * 6.7 / (3 * EI * 10), 1e-6), 'flèche sous la charge Pa²b²/3EIL');
  r = P.fixe(S, [{ type: 't', a: 0, b: 10, q1: 0, q2: 10 }]);
  ok(near(Math.max(...r.diag.map((d) => d.M)), 10 * 100 / (9 * Math.sqrt(3)), 1e-4) && near(r.appuis[1].R, 100 / 3), 'trapèze 0→10 : Mmax = qL²/(9√3), R = qL/3');
  r = P.fixe(S, [{ type: 'C', x: 0, C: 100 }]);
  ok(near(r.appuis[0].R, 10) && near(r.appuis[0].th, 100 * 10 / (3 * EI), 1e-6), 'couple sur appui : R = C/L, θ = CL/3EI');
  // encastrée-encastrée, P à a = 3 : MA = −Pab²/L²
  const Se = beam([10], { appuis: [{ type: 'encastre' }, { type: 'encastre' }] });
  r = P.fixe(Se, [{ type: 'P', x: 3, P: 100 }]);
  ok(near(r.appuis[0].Mr, 100 * 3 * 49 / 100) && near(secAt(Se, r, 0).M, -147), 'bi-encastrée : M encastrement −Pab²/L² = −147');
  // 2 travées : M appui −qL²/8, R = 1,25 qL
  const S2 = beam([10, 10]);
  r = P.fixe(S2, [{ type: 'q', q: 10 }]);
  ok(near(secAt(S2, r, 10, 'g').M, -125) && near(r.appuis[1].R, 125), '2 travées : M appui −qL²/8, R = 1,25qL');
  ok(near(secAt(S2, r, 10, 'g').V, -62.5) && near(secAt(S2, r, 10, 'd').V, 62.5), '2 travées : V de part et d\'autre de l\'appui ±5qL/8');
  // dénivellation δ de l'appui central : M = 3EIδ/L² (sens : appui descendu → moment négatif de travée réduit)
  r = P.fixe(S2, [{ type: 'd', appui: 2, v: 0.01 }]);
  ok(near(secAt(S2, r, 10).M, -3 * EI * 0.01 / 100, 1e-6) && near(r.appuis[1].w, 0.01), 'dénivellation 1 cm : M appui = −3EIδ/L²');
  // appuis élastiques : flèche sous q = R/k
  const Sk = beam([10], { appuis: [{ type: 'elastique', kv: 1000 }, { type: 'elastique', kv: 1000 }] });
  r = P.fixe(Sk, [{ type: 'q', q: 10 }]);
  ok(near(r.appuis[0].w, 0.05) && near(r.appuis[0].R, 50), 'appuis élastiques : w = R/k');
  // consoles : M d'encastrement de console −qc²/2
  const Sc = beam([10], { consoles: { g: 2, d: 0 } });
  r = P.fixe(Sc, [{ type: 'q', q: 10 }]);
  ok(near(secAt(Sc, r, 0, 'g').M, -20) && near(r.appuis[0].R, 10 * 12 * 6 / 10), 'console 2 m : M = −qc²/2, réaction');
  // inertie variable : comparaison au solveur de portiques du socle (10 éléments d'inertie différente)
  const Iv = (xi) => 1 + 2 * xi;
  const Sv = P.build({ E: 30000, ns: 10, travees: [{ L: 10, loi: 'lin', Ig: 1, Id: 3 }, { L: 10, Ig: 1 }], appuis: [{}, {}, {}] });
  r = P.fixe(Sv, [{ type: 'q', q: 10 }]);
  const pc = PO.poutreContinue([10, 10], { nseg: 200, EI: 1 });
  pc.elems.forEach((e, k) => { e.E = 3e7; e.I = e.travee === 0 ? Iv(((k % 200) + 0.5) / 200) : 1; });
  const rr = PO.solve(pc, { elem: pc.elems.map((e, i) => ({ e: i, type: 'u', q: -10 })) });
  ok(near(secAt(Sv, r, 10, 'g').M, rr.at(199, 0.05).M, 2e-3), 'inertie linéaire 1→3 : M appui ' + secAt(Sv, r, 10, 'g').M.toFixed(3) + ' / portique ' + rr.at(199, 0.05).M.toFixed(3));
}

/* ── 2. Lignes d'influence (réciprocité) ── */
{
  const S = beam([10, 10]), LI = P.lignes(S);
  const i = S.sections.findIndex((s) => Math.abs(s.x - 10) < 1e-9);
  // M appui central sous P = 1 à a dans la 1re travée : −a(L²−a²)/(4L²)
  ok(near(LI.sec[i].M.at(5, 0), -5 * 75 / 400), 'LI moment sur appui (2 travées) en a = L/2');
  ok(near(LI.app[1].R.at(5, 0), 0.6875), 'LI réaction centrale en a = L/2 : 11/16');
  const r = P.fixe(S, [{ type: 'P', x: 7, P: 1 }]);
  const j = S.sections.findIndex((s) => Math.abs(s.x - 14) < 1e-9);
  ok(near(LI.sec[j].V.at(7, 0), r.sec[j].V) && near(LI.sec[j].w.at(7, 0), r.sec[j].w) && near(LI.app[0].th.at(7, 0), r.appuis[0].th), 'LI V, w, θ = calcul direct (réciprocité)');
  const k = S.sections.findIndex((s) => Math.abs(s.x - 3) < 1e-9);
  ok(near(LI.sec[k].V.at(3, 1) - LI.sec[k].V.at(3, -1), 1), 'LI effort tranchant : saut unité au droit de la section');
}

/* ── 3. Enveloppes de charges réglementaires ── */
{
  const S = beam([20]), LI = P.lignes(S), mid = LI.sec[5];
  ok(near(P.envModele(mid.M, 'UIC71', {}).max.v, 6075.2), 'UIC 71 isostatique 20 m : M mi-portée 6075,2 kN·m');
  ok(near(P.envModele(LI.sec[0].V, 'UIC71', {}).max.v, 1294.72) && near(P.envModele(LI.app[0].R, 'UIC71', {}).max.v, 1294.72), 'UIC 71 isostatique 20 m : V appui = R = 1294,72 kN');
  ok(near(P.envModele(mid.M, 'SW2', {}).max.v, 7500), 'SW/2 = 150 × aire = 7500');
  ok(near(P.envModele(mid.M, 'BT', {}).max.v, 1492) && near(P.envModele(mid.M, 'MC120', {}).max.v, 4661.25), 'Bt 1492, Mc120 4661,25 (mi-portée 20 m)');
  // Bc isostatique 20 m, 2 camions : M max = 1455 kN·m (essieu de 120 kN décalé — théorème de Barré)
  ok(near(P.envModele(mid.M, 'BC', { nCamBc: 2 }).max.v, C.Bc(C.mkLI(Array.from({ length: 2001 }, (_, k) => k * 0.01), Array.from({ length: 2001 }, (_, k) => { const x = k * 0.01; return x <= 10 ? x / 2 : (20 - x) / 2; })), 2, 0.01).max, 1e-6), 'Bc mi-portée 20 m = enveloppe du socle (pas 1 cm)');
  ok(near(P.envModele(mid.M, 'BC', { nCamBc: 2 }).max.v, 1455), 'Bc mi-portée 20 m : 1455 kN·m');
  // Bc : M max absolu poutre de 10 m (1 camion déterminant) — table classique Mmax = 120·(…)
  const S10 = P.build({ E: 30000, ns: 50, travees: [{ L: 10, Ig: 1 }], appuis: [{}, {}] }), L10 = P.lignes(S10);
  const mBc = Math.max(...L10.sec.map((l) => P.envModele(l.M, 'BC', { nCamBc: 2 }).max.v));
  // 3 essieux 60/120/120 (4,5 + 1,5 m) : résultante 300 kN à 2,1 m de l'essieu arrière ; théorème de Barré
  ok(near(mBc, 300 * Math.pow(5 - 0.3, 2) / 10 - 120 * 1.5, 1e-6), 'Bc 10 m : M max absolu (Barré) ' + mBc.toFixed(2));
  // UIC 71, 2 travées égales 20 m : M sur appui comparé à une recherche directe par pas de 1 cm sur la LI exacte
  const S2 = P.build({ E: 30000, ns: 20, travees: [{ L: 20, Ig: 1 }, { L: 20, Ig: 1 }], appuis: [{}, {}, {}] }), L2 = P.lignes(S2);
  const ia = S2.sections.findIndex((s) => Math.abs(s.x - 20) < 1e-9);
  const xs = [], ys = [];
  for (let k = 0; k <= 4000; k++) { const a = k * 0.01, b = a <= 20 ? a : 40 - a; xs.push(a); ys.push(-b * (400 - b * b) / 1600); }
  const ref = C.uic71(C.mkLI(xs, ys), 1, 0.01).min;
  const ev = P.envModele(L2.sec[ia].M, 'UIC71', {}).min.v;
  ok(near(ev, ref, 2e-4), 'UIC 71, 2 × 20 m : M appui ' + ev.toFixed(1) + ' / recherche directe ' + ref.toFixed(1));
  // q seule sur les deux travées : −qL²/8 = −4000 ; avec les 4 essieux : ≈ −4000 − …
  ok(ev < -4000, 'UIC 71 sur appui plus défavorable que 80 kN/m seul (−4000)');
  // A(l) : poutre 20 m, largeur 3,5 m
  ok(near(P.envAL(mid.M, 3.5, 1, 1).max.v, (2.3 + 360 / 32) * 3.5 * 50), 'A(l) mi-portée 20 m');
  // A(l) sur appui de 2 travées : les deux travées chargées, l = 40 m
  const a1 = P.envAL(L2.sec[ia].M, 3.5, 1, 1).min.v;
  ok(near(a1, -(2.3 + 360 / 52) * 3.5 * 100), 'A(l) appui 2 × 20 m : l = 40 m, M = −A·b·L²/8');
  // concomitants : V concomitant de M max à mi-portée isostatique sous q illimitée = 0
  const cu = P.mobile(S, { cu: { ax: [], q: 10, e: 0 } }, ['CU']).res.CU;
  ok(near(cu.sec[5].M.max, 500) && near(cu.sec[5].M.cMax, 0, 1e-6), 'charge répartie illimitée : M = qL²/8, V concomitant nul');
  // coefficients : LΦ (EN 1991-2 tab. 6.2 cas 5.1) et Φ3
  ok(near(P.LPhi([10, 15, 10]), 1.3 * 35 / 3) && near(P.LPhi([20, 20]), 24) && near(P.LPhi([10, 30]), 30), 'LΦ = k·Lm ≥ max Li');
  const co = P.coefficients(S2, { phiType: '3', alpha: 1.1 });
  ok(near(co.k.UIC71[0], 1.1 * C.phi3(24)), 'coefficient UIC 71 = α·Φ3(LΦ)');
}

/* ── 4. Cas, combinaisons, enveloppes ── */
{
  const S = beam([10, 10]);
  const G = P.casFixe(P.fixe(S, [{ type: 'q', q: 10 }]));
  const Q = P.mobile(S, { cu: { ax: [{ d: 0, P: 100 }], q: 0 } }, ['CU']).res.CU;
  const c = P.combiner([{ cas: G, c: 1.35 }, { cas: Q, c: 1.5 }]);
  const i = 5;
  ok(near(c.sec[i].M.max, 1.35 * G.sec[i].M.max + 1.5 * Q.sec[i].M.max) && near(c.sec[i].M.min, 1.35 * G.sec[i].M.min + 1.5 * Q.sec[i].M.min), 'combinaison 1,35 G + 1,5 Q');
  const e = P.envelopper([G, Q]);
  ok(near(e.sec[i].M.max, Math.max(G.sec[i].M.max, Q.sec[i].M.max)), 'enveloppe max');
  const t = P.parseTermes('1,35 G + 1.5*UIC71 − 0,5 T2');
  ok(t.length === 3 && t[0].c === 1.35 && t[1].code === 'UIC71' && t[2].c === -0.5, 'lecture des expressions de combinaison');
}

/* ── 5. Majoration dynamique EN 1991-2 annexe C ── */
{
  // valeurs de φ lues dans le fichier Poutre_VarPortee.don (n0 = 94,76 L^−0,748 jusqu'à 20 m, 23,58 L^−0,592 au-delà)
  ok(near(P.phiReel(160, 1, P.n0Defaut(1), false).phi, 0.951596, 1e-5) && near(P.phiReel(100, 1, P.n0Defaut(1), false).phi, 0.818096, 1e-5), 'φ (L = 1 m ; 160 et 100 km/h)');
  ok(near(P.phiReel(160, 22, P.n0Defaut(22), false).phi, 0.372213, 1e-5) && near(P.phiReel(100, 22, P.n0Defaut(22), false).phi, 0.210565, 1e-5), 'φ (L = 22 m)');
  ok(near(P.phiReel(160, 100, P.n0Defaut(100), false).phi, 0.168086, 1e-5), 'φ (L = 100 m)');
  ok(near(P.n0Defaut(22), 3.782941, 1e-5) && near(P.n0Defaut(1), 94.76), 'n0 par défaut');
}

/* ── 6. Études de circulation : exemples d'origine ── */
const wagonA = { ax: [{ Pv: 12, Pp: 18, d: 1.5 }, { Pv: 12, Pp: 18, d: 1.8 }, { Pv: 12, Pp: 18, d: 6.2 }, { Pv: 12, Pp: 18, d: 1.8 }], tampon: 1.5 }; // « wagon utilisateur A » (.cnv)
const cfgA = (vRef) => ({ seq: [{ veh: wagonA, n: 1 }], illimite: true, vEtud: 160, cat: 'A', vRef, soigne: false });
{
  // Poutre_VarPortee.res — variation de portée (isostatique), convoi utilisateur A illimité / ligne A, 160 / 100 km/h
  // [L, M vide, V vide, M plein, V plein, M dyn vide, V dyn vide, M dyn plein, vitesse admissible]
  const REF = [
    [1, 29.43, 117.71, 44.15, 176.56, 57.44, 229.72, 86.15, 62.5],
    [2, 58.86, 129.48, 88.29, 194.22, 116.90, 257.15, 175.35, 62.5],
    [3.2, 96.06, 169.22, 144.09, 253.82, 192.49, 339.08, 288.73, 62.5],
    [5, 197.77, 197.76, 296.65, 296.64, 392.81, 392.80, 589.22, 61.875],
    [6.4, 282.53, 231.76, 423.79, 347.63, 549.81, 451.00, 824.71, 61.875],
    [8.8, 500.07, 294.29, 750.11, 441.44, 923.69, 543.59, 1385.53, 60.625],
    [10, 635.69, 315.48, 953.53, 473.23, 1138.94, 565.25, 1708.42, 60.0],
    [15, 1200.74, 387.69, 1801.12, 581.53, 1892.70, 611.10, 2839.04, 55.0],
    [20, 1918.84, 485.00, 2878.25, 727.50, 2712.67, 685.65, 4069.00, 48.125],
    [22, 2274.35, 526.53, 3411.53, 789.79, 3120.89, 722.50, 4681.34, 39.375],
    [38, 6827.76, 814.12, 10241.64, 1221.18, 8705.61, 1038.03, 13058.42, 20.625],
    [60, 16692.70, 1220.36, 25039.04, 1830.54, 20286.90, 1483.12, 30430.35, null],
    [100, 46028.52, 1955.09, 69042.78, 2932.63, 53765.28, 2283.71, 80647.92, null],
  ];
  const t0 = Date.now();
  const res = P.circulation(REF.map(([L]) => ({ nom: L + ' m', model: { E: 34922.823, ns: 10, travees: [{ L, Ig: 1 }], appuis: [{}, {}] } })), cfgA(100));
  const dt = Date.now() - t0;
  let em = 0, worst = '';
  res.rows.forEach((r, k) => {
    const [L, Mv, Vv, Mp, Vp, MdV, VdV, MdP, va] = REF[k];
    const got = [r.vide.M, r.vide.V, r.plein.M, r.plein.V, r.dyn.vide.M, r.dyn.vide.V, r.dyn.plein.M];
    [Mv, Vv, Mp, Vp, MdV, VdV, MdP].forEach((v, j) => { const e = Math.abs(got[j] - v) / v; if (e > em) { em = e; worst = L + ' m, colonne ' + j + ' : ' + got[j].toFixed(2) + ' / ' + v; } });
    if (va === null) ok(r.va.aucune, 'VarPortée ' + L + ' m : vitesse admissible « Aucune »');
    else ok(near(r.va.v, va, 1e-9), 'VarPortée ' + L + ' m : vitesse admissible ' + r.va.v.toFixed(3) + ' km/h (origine ' + va + ')');
  });
  ok(em < 1e-4, 'VarPortée : M, V à vide, à plein et dynamiques, 13 portées — écart max ' + (em * 1e3).toFixed(3) + ' ‰ (' + worst + ')');
  ok(near(res.statique.r, 1.125) && near(res.statique.Padm, 64) && near(res.statique.CU, 16), 'VarPortée statique : dépassement 12,5 %, 72 t → 64 t, charge utile 16 t');
  ok(near(res.dynamique.r, 1.27522, 1e-5) && near(res.dynamique.Padm, 56.461, 1e-5) && res.rows[res.dynamique.i].nom === '22 m', 'VarPortée dynamique : 27,522 % sur 22 m, 72 t → 56,461 t, charge utile 8,461 t');
  ok(near(res.rows[9].phE + 1, 1.372, 1e-3) && near(res.rows[9].phR + 1, 1.211, 1e-3), 'VarPortée 22 m : 1+φ = 1,372 / 1+φréf = 1,211');
  ok(dt < 1500, 'VarPortée : temps de calcul ' + dt + ' ms');
}
{
  // Poutre_ListOuv.res — 2 ouvrages ; φ saisis dans le .don (1,301617 et 1,141612), n0 = 0
  const ouv = [
    { nom: 'Ouvrage 1', model: { E: 34922.823, ns: 10, travees: [{ L: 10, Ig: 1 }, { L: 15, Ig: 1 }, { L: 10, Ig: 1 }], consoles: { g: 2, d: 2 }, appuis: [{}, {}, {}, {}] }, phiE: 1.301617, phiR: 1.301617, n0: 0 },
    { nom: 'Ouvrage 2', model: { E: 34922.823, ns: 10, travees: [{ L: 10, Ig: 1 }], appuis: [{}, {}] }, phiE: 1.141612, phiR: 1.141612, n0: 0 },
  ];
  const res = P.circulation(ouv, cfgA(100));
  // [M vide, V vide, M plein, V plein, M dyn vide, V dyn vide, M dyn plein, V dyn plein]
  const REF = [[567.38, 400.83, 851.07, 601.25, 1305.89, 922.56, 1958.84, 1383.84], [635.69, 315.48, 953.53, 473.23, 1361.40, 675.65, 2042.10, 1013.47]];
  res.rows.forEach((r, k) => {
    const got = [r.vide.M, r.vide.V, r.plein.M, r.plein.V, r.dyn.vide.M, r.dyn.vide.V, r.dyn.plein.M, r.dyn.plein.V];
    const e = Math.max(...REF[k].map((v, j) => Math.abs(got[j] - v) / v));
    // écart sur le moment de l'ouvrage 3 travées : la LI de l'origine est interpolée linéairement entre les nœuds
    // de son maillage (1,50 m en travée centrale) ; ici le maillage est 4 fois plus fin.
    ok(e < 5e-4, 'ListOuv ' + r.nom + ' : M, V statiques et dynamiques — écart max ' + (e * 1e3).toFixed(2) + ' ‰ (M vide ' + r.vide.M.toFixed(2) + ' / ' + REF[k][0] + ')');
    ok(near(r.rp.M, 1.125) && near(r.rp.V, 1.125) && near(r.rv.M, 0.75), 'ListOuv ' + r.nom + ' : rapports 0,750 / 1,125');
  });
  ok(res.statique.i === 0 && near(res.statique.Padm, 64), 'ListOuv : dépassement 12,5 % sur l\'ouvrage 1, poids admissible 64 t');
}

/* ── 7. Lecture des fichiers d'origine (structure reconstituée, valeurs numériques seulement) ── */
{
  const don = ['application ; x', 'POUTRE', 'nbtrav ; x', '3', 'travelage ; x', '10.0 15.0 10.0', 'EBd ; x', '11640941.0', 'EBi ; x', '34922823.0', 'inertie ; x', '1.0',
    'typapp0 ; x', '1', 'lcons0 ; x', '2.0', 'typapp1 ; x', '2', 'lcons1 ; x', '0', 'nbsec ; x', '10', 'typetude ; x', '1', 'typpoutre ; x', '0', 'convref ; x', '0', 'vitconv ; x', '160', 'vitconvref ; x', '100',
    'POUTRETRAVELAGES ; x', '1\t 10.000000 \t 1.000000\t 34922823.000000\t 11640941.000000\t\t1.000000\t 0\t 10\t 1.000000\t 1.000000\t 0\t 1\t 1.141612\t\t1\t 1.141612\t\t1\t 0.000000\t 0.000000\t OA 2\t 0\t 0.000000\t 0\t 0.000000',
    'FIN_DICO', 'LISTE_CHARGES', '23  convoi A', '0'].join('\r\n');
  const d = P.lireDon(don);
  ok(d.model.travees.length === 3 && d.model.consoles.g === 2 && d.model.appuis[3].type === 'encastre' && near(d.model.E, 34922.823), '.don : travées, console, encastrement, E (MPa)');
  ok(d.ouvrages.length === 1 && d.ouvrages[0].spans[0] === 10 && near(d.ouvrages[0].phiE, 1.141612) && d.ouvrages[0].nom === 'OA 2' && d.convref === 'A', '.don : tableau des ouvrages');
  const cnv = P.lireCnv(['typedoc ; x', '1', 'nomconvoi ; x', 'W', 'nbessieux ; x', '2', 'ESSIEUX ; 1', '12.0\t18.0 1.5', 'ESSIEUX ; 2', '12.0\t18.0 1.8', 'disttampon ; x', '1.5', 'FIN_DICO'].join('\r\n'));
  ok(cnv.type === 'vehicule' && cnv.ax.length === 2 && cnv.ax[1].d === 1.8 && cnv.tampon === 1.5, '.cnv : véhicule');
}

/* ── 8. Performance : 3 travées × 20 sections × tous les modèles ── */
{
  const t0 = Date.now();
  const S = P.build({ E: 35000, ns: 20, travees: [{ L: 15, Ig: 1 }, { L: 20, Ig: 1 }, { L: 15, Ig: 1 }], appuis: [{}, {}, {}, {}] });
  P.mobile(S, { phiType: '3', classe: 1, Lch: 7, g: 150, cu: { ax: [{ d: 0, P: 200 }, { d: 2, P: 200 }], q: 20, e: 1 } }, Object.keys(P.MODELES));
  const dt = Date.now() - t0;
  ok(dt < 2000, '3 travées × 20 sections × 11 modèles : ' + dt + ' ms (node)');
}
console.log(`\n${n - f}/${n} tests réussis`);
process.exit(f ? 1 : 0);
