/* REPHOR — tests du moteur (node tools/test-outils-efforts-horizontaux.js).
 * Cas analytiques indépendants + cas de référence chiffré (exemple d'origine « Rephor » : pont-rail 4 travées de
 * 13,90 m, 2 voies ballastées, biais 84,15 gr, culées enterrées à poteaux, piles à 2 voiles, appui fixe sur la culée
 * d'extrémité). Seules les valeurs numériques attendues sont reprises ici. */
const R = require('../outils/js/efforts-horizontaux.js');
let f = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));
const rel = (a, b) => (a - b) / b;
const pc = (a, b) => `${a.toFixed(3)} / ${b} (${(100 * rel(a, b)).toFixed(2)} %)`;

/* ── 1. raideur d'un fût à section constante : K = 3EI/h³ (biais 100 gr → I longitudinale) ── */
{
  const g = { Emode: 'bael', fck: 32, phi: 2, biais: 100 };
  const ap = { type: 'pile', nfut: 2, larfut: 6, esup: 0.8, einf: 0.8, hfut: 9 };
  const r = R.raideurAppui(ap, g);
  const E = 11000 * Math.cbrt(32) * 1000, I = 2 * 6 * 0.8 ** 3 / 12;
  ok(near(r.Kfcd, 3 * E * I / 729, 1e-6), 'fût constant : K = 3EI/h³ = ' + r.Kfcd.toFixed(0));
  ok(near(r.Kfld, r.Kfcd / 3, 1e-9), 'longue durée : E/(1 + φ), φ = 2');
  // fondation souple : 1/K = 1/Kfût + 1/Kh + H²/Kθ
  const r2 = R.raideurAppui(Object.assign({}, ap, { encastre: false, Khcd: 5e5, Krcd: 2e7, htot: 10 }), g);
  ok(near(1 / r2.Kcd, 1 / r.Kfcd + 1 / 5e5 + 100 / 2e7, 1e-9), 'fût + fondation (translation, rotation) en série');
  // biais : I = Ix sin²φ + Iy cos²φ
  const r3 = R.raideurAppui(Object.assign({}, ap), Object.assign({}, g, { biais: 50 }));
  const Iy = 2 * 0.8 * 6 ** 3 / 12;
  ok(near(r3.Kfcd, 3 * E * (I * 0.5 + Iy * 0.5) / 729, 1e-6), 'biais 50 gr : inertie projetée');
  // fût à épaisseur variable : intégration de Simpson contre la solution fermée (largeur constante, e(z) linéaire)
  const ap4 = { type: 'pile', nfut: 1, larfut: 2, esup: 0.6, einf: 1.2, hfut: 8 };
  const r4 = R.raideurAppui(ap4, g);
  // f = ∫ z²/(E b e³/12) dz, e = e0 + k z → intégrale numérique fine indépendante
  let s = 0; const N = 200000; for (let i = 0; i < N; i++) { const z = (i + 0.5) * 8 / N, e = 0.6 + 0.075 * z; s += z * z / (E * 2 * e ** 3 / 12) * 8 / N; }
  ok(near(r4.Kfcd, 1 / s, 1e-6), 'fût à épaisseur linéaire : ∫ z²/EI dz');
}

/* ── 2. répartition : deux appuis identiques, tablier symétrique → point fixe au centre ── */
const base = (o) => Object.assign({ ouvrage: 'rail', nvoies: 1, about0: 0, aboutn: 0, Emode: 'bael', fck: 32, phi: 2, Gld: 0.9, Gcd: 1.8,
  retraitMode: 'saisi', epsRetrait: 3e-4, alphaT: 1e-5, dTdil: 30, dTcon: 30, dTcd: 0, xi: 1, qInter: 8, modeApp: 'verif', reglApp: 'en1337', interaction: false, sw2: false }, o);
const autre = (K, app, pl, extra) => Object.assign({ type: 'autre', Kcd: K, Kld: K, app, napp: 1, plaque: pl, biais: 100, Gmax: 1000, Gmin: 1000 }, extra || {});
{
  const pl = { forme: 'rect', a: 0.4, b: 0.5, n: 4, ti: 0.01, ts: 0.003, te: 0 };
  const inp = base({ travees: [20], appuis: [autre(1e5, 'elasto', pl), autre(1e5, 'elasto', pl)] });
  const r = R.calc(inp);
  ok(near(r.rep.pfLD[0], 10, 1e-9), 'point fixe au milieu : ' + r.rep.pfLD[0].toFixed(4));
  const Kb = 0.9e3 * 0.2 / 0.04, Keq = 1 / (1 / Kb + 1 / 1e5);
  ok(near(r.rep.Keq[0].ld, Keq, 1e-9), 'raideur équivalente série G·A/T + appui : ' + Keq.toFixed(1));
  ok(near(Math.abs(r.rep.A.retrait.H[0]), Keq * 3e-4 * 10, 1e-6) && near(r.rep.A.retrait.H[0], -r.rep.A.retrait.H[1], 1e-9), 'retrait : H = Keq·ε·L/2, efforts opposés');
  ok(near(r.rep.A.retrait.H[0], Keq * 3e-4 * 10, 1e-6), 'retrait : culée origine tirée vers le centre (H > 0)');
  // freinage : partage égal, ΣH = F ; déplacement F/ΣKcd
  const F = 33 * 20; // démarrage 33 kN/m gouverne (≤ 1000 kN)
  ok(near(r.rep.A.frein.H[0] + r.rep.A.frein.H[1], F, 1e-9) && near(r.rep.A.frein.H[0], F / 2, 1e-9), 'démarrage 33 kN/m × 20 m = 660 kN partagé 50/50');
  const Kcd = 1 / (1 / (1.8e3 * 0.2 / 0.04) + 1 / 1e5);
  ok(near(r.rep.parDeck[0].deltaB, F / (2 * Kcd), 1e-6), 'δB = F/ΣK courte durée');
}

/* ── 3. point fixe pour raideurs inégales : x_pf = Σ K x / Σ K ── */
{
  const inp = base({ travees: [10, 15, 12], appuis: [autre(2e4, 'fixe'), autre(5e4, 'fixe'), autre(8e4, 'fixe'), autre(3e4, 'fixe')] });
  const r = R.calc(inp);
  const xs = [0, 10, 25, 37], K = [2e4, 5e4, 8e4, 3e4];
  const xpf = xs.reduce((s, x, i) => s + K[i] * x, 0) / K.reduce((a, b) => a + b, 0);
  ok(near(r.rep.pfLD[0], xpf, 1e-6), `point fixe barycentre des raideurs : ${r.rep.pfLD[0].toFixed(4)} / ${xpf.toFixed(4)}`);
  const sH = r.rep.A.retrait.H.reduce((a, b) => a + b, 0);
  ok(Math.abs(sH) < 1e-6 * Math.max(...r.rep.A.retrait.H.map(Math.abs)), 'déformation imposée : ΣH = 0 (' + sH.toExponential(1) + ' kN)');
  ok(r.rep.A.retrait.H.every((h, i) => near(h, K[i] * 3e-4 * (xpf - xs[i]), 1e-6)), 'retrait : H_i = K_i·ε·(x_pf − x_i)');
  // dilatation = −contraction (même ΔT, pas de frottement)
  ok(r.rep.A.dil.H.every((h, i) => near(h, -r.rep.A.con.H[i], 1e-9)), 'dilatation et contraction symétriques');
}

/* ── 4. appui glissant : frottement μ·N, appui fixe seul porteur du freinage ── */
{
  const inp = base({ travees: [25], mu: 0.03, appuis: [autre(1e6, 'fixe'), autre(5e4, 'glissant', null, { Gmax: 2000 })] });
  const r = R.calc(inp);
  ok(near(r.rep.A.frein.H[0], 825, 1e-6), 'démarrage 33 × 25 = 825 kN entièrement repris par l’appui fixe : ' + r.rep.A.frein.H[0].toFixed(2));
  ok(near(Math.abs(r.rep.A.retrait.H[1]), 0.03 * 2000, 1e-9) && near(r.rep.A.retrait.H[0], -r.rep.A.retrait.H[1], 1e-9), 'retrait : frottement μ·N sur l’appui glissant, équilibré par l’appui fixe');
  ok(r.rep.A.retrait.H[1] < 0, 'frottement opposé au mouvement du tablier (raccourcissement vers le fixe)');
}

/* ── 5. tabliers indépendants (joint sur une pile) ── */
{
  const pl = { forme: 'rect', a: 0.3, b: 0.4, n: 3, ti: 0.01, ts: 0.003, te: 0 };
  const inp = base({ travees: [15, 15], joints: [1], appuis: [autre(1e5, 'fixe'), Object.assign(autre(1e5, 'elasto', pl), { appD: 'fixe' }), autre(1e5, 'elasto', pl)] });
  const r = R.calc(inp);
  ok(r.rep.G.decks.length === 2 && r.rep.G.lignes.length === 4, 'deux tabliers, quatre lignes d’appareils');
  ok(r.rep.pfLD[0] < 1 && Math.abs(r.rep.pfLD[1] - 15) < 1, `points fixes près des appareils fixes : ${r.rep.pfLD.map((x) => x.toFixed(2))}`);
  const j = r.joints.find((x) => /Joint/.test(x.lieu));
  ok(j && j.relR > 0, 'retrait : le joint intermédiaire s’ouvre');
}

/* ── 6. efforts de freinage réglementaires ── */
{
  const fr = R.freinageRail(57.045, { alpha: 1, xi: 1, nvoies: 1 });
  ok(near(fr.cas[0].F, 1140.9, 1e-6), 'EN 1991-2 §6.5.3 : Qlbk = 20 × 57,045 = 1140,9 kN');
  ok(near(fr.cas[1].F, 1750, 1e-9) && R.lSW2(57.045) === 50, 'SW/2 : 35 kN/m sur 2 × 25 m = 1750 kN');
  ok(near(fr.cas[2].F, 1000, 1e-9), 'démarrage : 33 kN/m, plafonné à 1000 kN');
  ok(near(R.freinageRail(400, { alpha: 1.33, xi: 1 }).cas[0].F, 6000 * 1.33, 1e-9), 'freinage plafonné à 6000 kN × α');
  ok(near(R.freinageRoute(30, { classeTrafic: 1 }).total, 360 + 0.1 * 9 * 3 * 30, 1e-9), 'EN 1991-2 (4.6) : Qlk = 0,6·αQ1·2Q1k + 0,10·αq1·q1k·w1·L = 441 kN');
  ok(near(R.freinageRoute(5, { classeTrafic: 1 }).total, 373.5, 1e-9), 'Qlk(5 m) = 360 + 13,5 = 373,5 kN (≥ 180 αQ1)');
  ok(near(R.freinageRoute(1500, { classeTrafic: 1 }).total, 900, 1e-9), 'Qlk plafonné à 900 kN');
  ok(near(R.freinageRoute(30, { classeTrafic: 2 }).total, 0.6 * 0.9 * 600 + 0.1 * 0.7 * 9 * 3 * 30, 1e-9), 'AN française classe 2 : αQ1 = 0,9, αq1 = 0,7');
  const f61 = R.freinageRoute(30, { fasc61: true, lch: 7, classeF61: 1 });
  const AL = 2.3 + 360 / 42, S = 210;
  ok(near(f61.cas[1].F, AL * S / (20 + 0.0035 * S), 1e-9), 'Fasc. 61 II : F = A1·S/(20 + 0,0035 S) = ' + f61.cas[1].F.toFixed(1) + ' kN');
  ok(f61.cas[2].F === 300, 'Fasc. 61 II : Bc, un camion de 300 kN');
}

/* ── 7. retrait EN 1992-1-1 annexe B ── */
{
  const r = R.retraitEC2({ fck: 35, RH: 70, h0: 500, ciment: 'N' });
  const bRH = 1.55 * (1 - 0.343), ecd0 = 0.85 * 660 * Math.exp(-0.12 * 4.3) * 1e-6 * bRH;
  ok(near(r.ecd0, ecd0, 1e-9) && near(r.kh, 0.70, 1e-12) && near(r.eca, 62.5e-6, 1e-9), `εcd,0 = ${(r.ecd0 * 1e6).toFixed(1)} µm/m, kh = 0,70, εca = 62,5 µm/m`);
  ok(near(R.retraitEC2({ fck: 35, h0: 250 }).kh, 0.80, 1e-12), 'kh interpolé (h0 = 250 mm → 0,80)');
}

/* ── 8. combinaisons ── */
{
  const C = R.coefs({ ouvrage: 'rail' });
  const e = R.envComb(C[0], 10, -50, 50, 0, 20);
  ok(near(e.max, 10 + 0.9 * 50 + 1.45 * 20, 1e-12) && near(e.min, 10 - 0.9 * 50 - 1.45 * 20, 1e-12), 'ELU trafic dominant : Rs + 1,45·F + 1,5·0,6·T (enveloppe ±)');
}

/* ── 9. cas de référence d'origine (rephor.don / rephor.res, exemple « Rephor ») ── */
{
  const pl = (a, b, nf, ti) => ({ forme: 'rect', a, b, n: nf, ti, ts: 0.003, te: 0, c: 0.005 });
  const ap = (type, app, nfut, larfut, esup, einf, plaque) => ({ type, app, napp: 4, nfut, larfut, esup, einf, hfut: 9, htot: 10, biais: 84.15, encastre: true, plaque, Gmax: 1500, Gmin: 1200, Qmax: 800 });
  const inp = { ouvrage: 'rail', nvoies: 2, travees: [13.9, 13.9, 13.9, 13.9], about0: 0.72227, aboutn: 0.72227,
    appuis: [ap('culee', 'elasto', 3, 1, 0.8, 1.4, pl(0.3, 0.4, 4, 0.010)), ap('pile', 'elasto', 2, 6, 0.8, 0.8, pl(0.45, 0.6, 4, 0.012)), ap('pile', 'elasto', 2, 6, 0.8, 0.8, pl(0.4, 0.6, 4, 0.012)), ap('pile', 'elasto', 2, 6, 0.8, 0.8, pl(0.45, 0.6, 4, 0.012)), ap('culee', 'fixe', 3, 1.2, 0.8, 1.8, null)],
    Emode: 'bael', fck: 32, phi: 2, kbutLong: 1.825, kbutTran: 2.54, Gld: 0.9, Gcd: 1.8, reglApp: 'livret', modeApp: 'verif',
    retraitMode: 'saisi', epsRetrait: 2e-4, alphaT: 1e-5, dTdil: 35, dTcon: 35, dTcd: 10, xi: 0.5, qInter: 8, interaction: true };
  const r = R.calc(inp), A = r.rep.A, RA = r.rep.RA, Keq = r.rep.Keq;
  const tol = (a, b, t) => Math.abs(rel(a, b)) <= t;
  // modules BAEL : 34 922,8 / 11 640,9 MPa
  const E = R.modules({ Emode: 'bael', fck: 32, phi: 2 });
  ok(tol(E.Ecd, 34922.82, 1e-6) && tol(E.Eld, 11640.94, 1e-6), 'modules béton BAEL 34 922,8 / 11 640,9 MPa');
  // raideurs des fûts de piles (exact) et des culées (écart dû à l'intégration d'origine, voir rapport)
  ok(tol(RA[1].Kfcd, 320420, 2e-6) && tol(RA[1].Kfld, 106807, 5e-6), 'raideur fût pile C.T./L.T. : ' + pc(RA[1].Kfcd, 320420));
  ok(tol(RA[0].Kfcd, 122555, 0.025), 'raideur culée 0 (butée 1,825/2,54) : ' + pc(RA[0].Kfcd, 122555) + ' — écart < 2,5 %');
  ok(tol(RA[4].Kfcd, 259742, 0.002), 'raideur culée 4 : ' + pc(RA[4].Kfcd, 259742));
  ok(tol(r.rep.RB[1].cd, 40500, 1e-9) && tol(r.rep.RB[0].ld, 10800, 1e-9), 'raideurs appareils n·G·A/T : 40 500 (C.T.) et 10 800 (L.T.) kN/m');
  ok(tol(Keq[1].cd, 35955, 5e-5) && tol(Keq[2].cd, 32364, 5e-5) && tol(Keq[1].ld, 17023, 5e-5), 'raideurs totales piles 35 955 / 32 364 / 17 023 kN/m');
  ok(tol(Keq[0].cd, 18363, 0.005) && tol(Keq[0].ld, 8542, 0.005), 'raideurs totales culée 0 : ' + pc(Keq[0].cd, 18363) + ', ' + pc(Keq[0].ld, 8542));
  // point fixe et longueurs dilatables (Livret 2.01 art. 1.4.3.2)
  const it = r.rep.parDeck[0].inter;
  ok(tol(it.xpf, 42.806, 0.001), 'abscisse du point fixe depuis l’axe de la culée 0 : ' + pc(it.xpf, 42.806));
  ok(tol(it.L2, 43.529, 0.001) && tol(it.L1, 13.516, 0.002), `L2 = ${it.L2.toFixed(3)} (43,529), L1 = ${it.L1.toFixed(3)} (13,516)`);
  ok(tol(it.parVoie, 240.1, 0.002), 'interaction par voie 8 kN/m × (L2 − L1) : ' + pc(it.parVoie, 240.1));
  // efforts par appui (kN, une voie pour l'interaction)
  const exp = {
    retrait: [73.13, 98.41, 46.23, 3.77, -221.54],
    dilCD: [-83.28, -113.08, -56.79, -13.12, 266.27],
    dil: [-174.69, -236.09, -114.58, -17.83, 543.19],
    inter: [13.4, 26.6, 24.1, 26.6, 149.3],
    interCD: [3.29, 6.45, 5.81, 6.45, 46.60],
  };
  const got = { retrait: A.retrait.H, dilCD: A.dilCD.H, dil: A.dil.H, inter: A.inter.H.map((x) => x / 2), interCD: A.interCD.H.map((x) => x / 2) };
  for (const k of Object.keys(exp)) {
    const errs = exp[k].map((v, j) => Math.abs(got[k][j] - v) / Math.max(Math.abs(v), 20));
    ok(Math.max(...errs) <= 0.01, `${k} par appui : ${got[k].map((x) => x.toFixed(2)).join(' ; ')} / ${exp[k].join(' ; ')} (écart max ${(100 * Math.max(...errs)).toFixed(2)} %)`);
  }
  // déplacements en tête (retrait, mm) — appui 4 : −2,559 mm ; appui 0 : 8,561 mm (au droit de l'appareil)
  ok(tol(A.retrait.lig[0].ud * 1000, 8.561, 0.002) && tol(A.retrait.lig[4].ud * 1000, -2.559, 0.003), `déplacement retrait du tablier : ${(A.retrait.lig[0].ud * 1000).toFixed(3)} / 8,561 mm ; ${(A.retrait.lig[4].ud * 1000).toFixed(3)} / −2,559 mm`);
  // freinage : coefficient 0,5, déplacement 0,262 mm pour 100 kN, 1750 kN → 4,577 mm ≤ 5 mm
  const pd = r.rep.parDeck[0];
  ok(tol(pd.unitCD.d[0] * 1e5, 0.262, 0.004), 'déplacement pour 100 kN : ' + pc(pd.unitCD.d[0] * 1e5, 0.262) + ' mm');
  ok(near(pd.frein.total, 1750, 1e-9), 'freinage SW/2 sur deux voies, ξ = 0,5 : 1750 kN');
  ok(tol(pd.deltaB * 1000, 4.577, 0.002) && r.verifsRail[0].okB, 'δB = ' + pc(pd.deltaB * 1000, 4.577) + ' mm ≤ 5 mm');
  // freinage par appui (LM71, 20 kN/m × 0,5 = 10 kN/ml de voie) : 0,48 / 0,94 / 0,85 / 0,94 / 6,79 kN/ml
  const parMl = Keq.map((k) => 10 * k.cd / Keq.reduce((s, q) => s + q.cd, 0));
  ok([0.48, 0.94, 0.85, 0.94, 6.79].every((v, j) => Math.abs(parMl[j] - v) <= 0.006), 'freinage LM71 par ml de voie : ' + parMl.map((x) => x.toFixed(2)).join(' ; '));
  // projection biais : HX = H·sin(84,15 gr)
  const ex = R.exportAppuis(r)[0].actions.find((a) => a.id === 'retrait');
  ok(Math.abs(ex.HX / ex.H - 70.87 / 73.13) < 1e-3 && Math.abs(ex.HY / ex.H - 18.02 / 73.13) < 1e-3, 'export appui : HX = H·sinφ, HY = H·cosφ (70,87 / 18,02 pour 73,13)');
}

/* ── 10. lecture d'un .don (format clé ; commentaire / valeur) ── */
{
  const don = ['application ;', 'REPHOR', 'pra ; x', '1', 'nbrtrav ; x', '2', 'travee ; x', '12.5', 'travee ; 2', '14', 'typecalappui ; x', '1', 'typecalappui ; 2', '0', 'typecalappui ; 3', '1',
    'typeappuis ; x', '1', 'typeappuis ; 2', '-2', 'typeappuis ; 3', '2', 'zdessusappui ; x', '8', 'zdessusappui ; 2', '8', 'zdessusappui ; 3', '8', 'epsem ; x', '1', 'epsem ; 2', '1', 'epsem ; 3', '1',
    'defretrait ; x', '0.0002', 'coeffreinvoietab ; x', '0', 'FIN_DICO'].join('\r\n');
  const p = R.parseDon(don);
  ok(p.travees.join(',') === '12.5,14' && p.appuis.length === 3 && p.appuis[1].app === 'fixe' && p.appuis[2].app === 'glissant' && p.appuis[0].type === 'culee' && p.appuis[0].hfut === 7, 'parseDon : travées, types d’appuis et d’appareils, hauteur des fûts');
  ok(p.xi === 0.5 && p.epsRetrait === 2e-4, 'parseDon : ξ = 0,5 (Livret 2.01) si coefficient nul, retrait');
}

/* ── 11. dimensionnement des appareils (APPMOBIL, EN 1337-3) et itération ── */
{
  const ap = (K, app, G, Q) => ({ type: 'autre', Kcd: K, Kld: K, app, napp: 2, biais: 100, Gmax: G, Gmin: 0.9 * G, Qmax: Q, rot: 0.002 });
  const inp = base({ travees: [18, 18], modeApp: 'dim', appuis: [ap(2e5, 'elasto', 1500, 900), ap(4e5, 'fixe', 3500, 2000), ap(2e5, 'elasto', 1500, 900)] });
  const r = R.calc(inp);
  const el = r.app.filter((a) => a.app === 'elasto');
  ok(el.length === 2 && el.every((a) => a.res && a.res.ok), 'dimensionnement EN 1337-3 : appareils retenus et vérifiés (' + el.map((a) => `${a.res.plaque.a * 1000}×${a.res.plaque.b * 1000} n=${a.res.plaque.n}`).join(', ') + ')');
  ok(r.plaques[0] && near(r.rep.RB[0].cd, 2 * 1.8e3 * r.plaques[0].a * r.plaques[0].b / (r.plaques[0].n * r.plaques[0].ti + 2 * r.plaques[0].te), 1e-9), 'raideur recalculée avec les plaques retenues');
  const ex = R.exportAppuis(r);
  ok(ex.length === 3 && ex[1].combinaisons.length === 5 && ex[1].actions.some((a) => a.id === 'freinage'), 'export JSON par appui (actions et combinaisons)');
}

console.log(`\n${n - f}/${n} tests réussis`);
process.exit(f ? 1 : 0);
