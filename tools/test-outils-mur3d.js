/* MUR3D — tests node : cas analytiques et cas de référence des notes de calcul d'origine.
 * node tools/test-outils-mur3d.js (MURU : tools/test-outils-muru.js) */
const M = require('../outils/js/mur3d.js');
let f = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const near = (a, b, t) => Math.abs(a - b) <= t * Math.max(1e-9, Math.abs(b));
const D2R = Math.PI / 180;

/* ── 1. coefficients de poussée ── */
{ const sol = { phi: 30, g: 20, gsat: 20, zw: -1e9, P: [[0, 10], [100, 10]] };
  const c = M.culmann({ T: [0, 10], B: [0, 0], sol, delta: 0, n: 20 });
  ok(near(c.P[20], 0.5 * 20 * 100 / 3, 1e-6), 'coins, terre-plein horizontal, δ = 0 : P = Ka γH²/2 (Ka = 1/3) ' + c.P[20].toFixed(3));
  ok(near(c.I / c.P[20], 10 / 3, 0.01), 'point d’application de la poussée triangulaire à H/3 du pied ' + (c.I / c.P[20]).toFixed(3));
  const s2 = { phi: 30, g: 20, gsat: 20, zw: -1e9, P: [[0, 10], [100, 10 + 100 * Math.tan(15 * D2R)]] };
  const c2 = M.culmann({ T: [0, 10], B: [0, 0], sol: s2, delta: 20, n: 10 });
  ok(near(c2.P[10] / 1000, M.coulomb(30, 15, 20, 0).K, 1e-6), 'coins = Coulomb (β = 15°, δ = 20°) K = ' + M.coulomb(30, 15, 20, 0).K.toFixed(4));
  ok(near(M.coulomb(30, 0, 0, 0).K, 1 / 3, 1e-9), 'Coulomb fermé : Ka(φ = 30°) = 1/3');
  const c3 = M.culmann({ T: [0, 10], B: [0, 0], sol, delta: 0, kh: 0.2, kv: 0.1, n: 10 });
  ok(near(c3.P[10] / (0.5 * 20 * 1.1 * 100), M.mononobeOkabe(30, 0, 0, 0, 0.2, 0.1).K, 1e-6), 'coins avec gravité inclinée = Mononobe-Okabe (EN 1998-5 E.2) K = ' + M.mononobeOkabe(30, 0, 0, 0, 0.2, 0.1).K.toFixed(4));
  ok(near(M.mononobeOkabe(30, 0, 0, 0, 0, 0).K, 1 / 3, 1e-9), 'M-O sans séisme = Coulomb');
  // nappe : γ' sous la nappe + poussée de l'eau séparée
  const sw = { phi: 30, g: 20, gsat: 20, zw: 5, P: [[0, 10], [100, 10]] };
  const cw = M.culmann({ T: [0, 10], B: [0, 0], sol: sw, delta: 0, n: 40 });
  const att = (0.5 * 20 * 25 + 20 * 5 * 5 + 0.5 * 10 * 25) / 3;
  ok(near(cw.P[40], att, 0.01), 'nappe à mi-hauteur : P = Ka(γh1²/2 + γh1h2 + γ′h2²/2) ' + cw.P[40].toFixed(2) + ' / ' + att.toFixed(2));
  // surcharge uniforme : ΔP = Ka q H
  const cq = M.culmann({ T: [0, 10], B: [0, 0], sol, delta: 0, q: [{ y1: 0, y2: 1e4, q: 10 }], n: 20 });
  ok(near(cq.P[20] - c.P[20], 10 * 10 / 3, 1e-4), 'surcharge uniforme q = 10 : ΔP = Ka q H ' + (cq.P[20] - c.P[20]).toFixed(3)); }

/* ── 2. iδ (Fasc. 62 titre V annexe F1) — valeurs des notes d'origine (MUR3D, fondation superficielle) ── */
ok(near(M.iDelta(17.58, true, 4.32 / 3.10), 0.5791, 5e-4), 'iδ(17,58°, De/B = 4,32/3,10) = 0,5791 (note d’origine) ' + M.iDelta(17.58, true, 4.32 / 3.10).toFixed(4));
ok(near(M.iDelta(21.11, true, 4.32 / 3.10), 0.5106, 5e-4), 'iδ(21,11°) = 0,5106 (note d’origine) ' + M.iDelta(21.11, true, 4.32 / 3.10).toFixed(4));
ok(near(M.iDelta(30, false, 1), Math.pow(1 - 30 / 90, 2), 1e-12), 'iδ sol cohérent = (1 − δ/90)²');

/* ── 3. contraintes sous semelle rigide, sol sans traction (bande B = 3 m) ── */
{ const cells = []; for (let i = 0; i < 2; i++) for (let j = 0; j < 300; j++) cells.push({ x: i - 0.5, y: -1.5 + (j + 0.5) * 0.01, A: 0.005 });
  const N = 300, sig = (e) => { const r = M.sigmaSemelle(cells, N, N * e, 0); const s = cells.map((c) => r.v[0] + r.v[2] * c.y); return { max: Math.max(...s), min: Math.min(...s), dec: r.decomp }; };
  let s = sig(0); ok(near(s.max, 100, 1e-3) && near(s.min, 100, 1e-3), 'charge centrée : σ = N/B = 100 kPa');
  s = sig(0.3); ok(near(s.max, 100 * (1 + 6 * 0.3 / 3), 5e-3) && near(s.min, 100 * (1 - 6 * 0.3 / 3), 1e-2), 'e = B/10 : σ = N/B (1 ± 6e/B) ' + s.max.toFixed(1) + ' / ' + s.min.toFixed(1));
  s = sig(0.9); ok(near(s.max, 2 * N / (3 * (1.5 - 0.9)), 1e-2) && near(s.dec, 100 * (1 - 3 * 0.6 / 3), 2e-2), 'e = 0,9 > B/6 : σmax = 2N/3(B/2 − e), décompression ' + s.max.toFixed(1) + ' kPa, ' + s.dec.toFixed(1) + ' %'); }

/* ── 4. ferraillage d'une section (BA.sectionBA) : contrôle de cohérence ── */
{ const r = M.ferrailler({ h: 0.8, dSup: 0.055, dInf: 0.745 }, [{ N: 0, M: -225 / 0.85, type: 3 }], [{ N: 0, M: -165.636 / 0.85 }], { regl: 'LIVRET', fck: 25, fyk: 400, ssLim: 240, livret: true, n: 15 });
  // note d'origine, patin section 1 : ELS fissuration préjudiciable, σs = 240 MPa, M = −165,6 kN·m sur 0,85 m → 9,91 cm² (11,65 cm²/ml)
  ok(near(r.As[1], 11.65, 0.01), 'patin (note d’origine, section 1) : aciers inférieurs ELS 11,65 cm²/ml → ' + r.As[1].toFixed(2));
  ok(near(r.lign.elu[1], 8.81 / 0.85, 0.02), 'patin : aciers ELU (comb. < 1 h, fsu = 347,8 MPa) 8,81 cm² / 0,85 m = 10,36 cm²/ml → ' + r.lign.elu[1].toFixed(2));
  ok(r.ss <= 240 + 1e-6, 'σs ELS ≤ 240 MPa (Livret 2.01 chap. 2A)'); }

/* ── 5. MUR3D, exemple d'origine « fondation superficielle » (données de Mur3D_FondSup.don) ── */
const R = M.calc(M.exemple());
{ const dx = R.plan.L / R.tr.length, S = (fn) => R.tr.reduce((s, g) => s + fn(g), 0) * dx;
  ok(near(-S((g) => g.ch.GT[0].Fz), 1045.5, 0.01), 'terre sur talon (somme des 10 tranches) 1045,5 kN → ' + (-S((g) => g.ch.GT[0].Fz)).toFixed(1));
  ok(near(-S((g) => g.ch.GT.find((x) => x.nom === 'patin').Fz), 746.1, 0.03), 'terre sur patin 746,1 kN → ' + (-S((g) => g.ch.GT.find((x) => x.nom === 'patin').Fz)).toFixed(1));
  ok(near(-S((g) => g.ch.GT.find((x) => x.nom === 'poussée').Fy), 786.4, 0.03), 'poussée horizontale des terres 786,4 kN → ' + (-S((g) => g.ch.GT.find((x) => x.nom === 'poussée').Fy)).toFixed(1));
  ok(near(-S((g) => g.ch.GT.find((x) => x.nom === 'poussée').Fz), 251.4, 0.15), 'poussée verticale des terres 251,4 kN → ' + (-S((g) => g.ch.GT.find((x) => x.nom === 'poussée').Fz)).toFixed(1));
  ok(near(R.tr[0].ch.poussee.Ph * dx, 103.35, 0.03) && near(R.tr[9].ch.poussee.Ph * dx, 43.13, 0.03), 'poussée H tranches 1 et 10 : 103,35 / 43,13 kN → ' + (R.tr[0].ch.poussee.Ph * dx).toFixed(2) + ' / ' + (R.tr[9].ch.poussee.Ph * dx).toFixed(2));
  ok(near(R.fond.q0, 0.082, 0.01) && near(R.fond.De, 4.32, 0.01), "q′0 = 0,082 MPa, De = 4,32 m → " + R.fond.q0.toFixed(3) + ', ' + R.fond.De.toFixed(2));
  const vs = R.verifs;
  ok(near(vs[0].val, 0.208, 0.1), "ELS : q′ref maxi 0,208 MPa → " + vs[0].val.toFixed(3));
  ok(near(vs[3].val, 0.282, 0.12), "ELU : q′ref maxi 0,282 MPa → " + vs[3].val.toFixed(3));
  ok(near(Math.abs(vs[5].val), 1395.3, 0.08), 'ELU glissement : H maxi 1395,3 kN → ' + Math.abs(vs[5].val).toFixed(1));
  ok(near(vs[5].adm, 1543.9, 0.06), 'ELU glissement : limite N tgφ′/1,2 1543,9 kN → ' + vs[5].adm.toFixed(1));
  ok(vs[1].val <= 0.1 + 1e-9 && vs[4].val < 90, 'décompressions : ELS fréquent ≈ 0 %, ELU < 90 % (note : 0,1 % et 12,7 %) → ' + vs[1].val.toFixed(1) + ' %, ' + vs[4].val.toFixed(1) + ' %');
  ok(near(Math.max(...R.deplac.map((x) => x.u)), 40.9, 0.1), 'déplacement maxi en tête ELS fréquent 40,9 mm → ' + Math.max(...R.deplac.map((x) => x.u)).toFixed(1));
  ok(near(R.ba.voile[0][0].Ar, 19.83, 0.06), 'voile tranche 1, pied, face arrière 19,83 cm²/ml → ' + R.ba.voile[0][0].Ar.toFixed(2));
  ok(near(R.ba.voile[0][0].sc, 5.89, 0.08), 'voile tranche 1, pied, σbc ELS 5,89 MPa → ' + R.ba.voile[0][0].sc.toFixed(2));
  ok(near(R.ba.patin[0].inf, 11.65, 0.08), 'patin tranche 1, aciers inférieurs 11,65 cm²/ml → ' + R.ba.patin[0].inf.toFixed(2));
  ok(R.ok, 'exemple d’origine vérifié (comme la note d’origine)'); }

process.exit(f ? 1 : 0);
