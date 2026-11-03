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

/* ── 5. MUR3D, exemple d'origine « fondation superficielle » (Mur3D_FondSup, version 2011, Livret 2.01) ──
 * Valeurs relevées dans la note .ndc (charges élémentaires sommées sur les 10 tranches, kN) et le .res. */
const R = M.calc(M.exemple());
const rel = (a, b) => (100 * (a / b - 1)).toFixed(2) + ' %';
{ const dx = R.plan.L / R.tr.length, S = (fn) => R.tr.reduce((s, g) => s + fn(g), 0) * dx;
  const cas = (nom, v, ref, tol) => ok(near(v, ref, tol), `${nom} : origine ${ref} → ${v.toFixed(1)} (${rel(v, ref)})`);
  cas('cas 1 poids du mur (poussée d’Archimède déduite)', -S((g) => g.ch.G.reduce((t, f) => t + f.Fz, 0) + g.ch.W.filter((f) => f.Fz > 0).reduce((t, f) => t + f.Fz, 0)), 925.0, 0.005);
  cas('cas 2 terre sur talon', -S((g) => g.ch.GT[0].Fz), 1045.5, 0.005);
  cas('cas 3 terre sur patin', -S((g) => g.ch.GT.find((x) => x.nom === 'patin').Fz), 746.1, 0.005);
  cas('cas 4 poussée horizontale des terres (modèle Livret)', -S((g) => g.ch.GT.find((x) => x.nom === 'poussée').Fy), 786.4, 0.005);
  cas('cas 5 poussée verticale des terres', -S((g) => g.ch.GT.find((x) => x.nom === 'poussée').Fz), 251.4, 0.015);
  cas('cas 8 poussée de la charge d’exploitation (Livret 2.01, éd. 2004)', -S((g) => g.ch.Q.filter((f) => f.nom === 'poussée').reduce((t, f) => t + f.Fy, 0)), 193.5, 0.005);
  cas('cas 16 poussée de la charge de chantier', -S((g) => g.ch.QC.filter((f) => f.nom === 'poussée').reduce((t, f) => t + f.Fy, 0)), 157.5, 0.005);
  ok(near(R.tr[0].ch.poussee.Ph * dx, 103.348, 0.002) && near(R.tr[9].ch.poussee.Ph * dx, 43.125, 0.002), 'poussée H tranches 1 et 10 : 103,348 / 43,125 → ' + (R.tr[0].ch.poussee.Ph * dx).toFixed(3) + ' / ' + (R.tr[9].ch.poussee.Ph * dx).toFixed(3));
  ok(near(R.fond.q0, 0.082, 0.01) && near(R.fond.De, 4.32, 0.01), "q′0 = 0,082 MPa, De = 4,32 m → " + R.fond.q0.toFixed(3) + ', ' + R.fond.De.toFixed(2));
  const c12 = R.res[11]; // comb. 12 de la note : coins 0,277 / 0,000 / 0,035 / 0,166 MPa
  ok(near(c12.coins[0], 0.277, 0.01) && near(c12.coins[3], 0.166, 0.04), 'contraintes aux sommets, comb. 12 : 0,277 / 0,166 → ' + c12.coins[0].toFixed(3) + ' / ' + c12.coins[3].toFixed(3));
  const vs = R.verifs;
  cas("ELS : q′ref (comb. 12)", vs[0].val, 0.208, 0.01);
  cas("ELU : q′ref (comb. 39)", vs[3].val, 0.282, 0.01);
  cas('ELU de renversement : décompression (comb. 56)', vs[4].val, 12.7, 0.02);
  cas('ELU de glissement : H (comb. 28)', Math.abs(vs[5].val), 1395.3, 0.005);
  cas('ELU de glissement : limite N tgφ′/1,2', vs[5].adm, 1543.9, 0.005);
  cas('glissement en rotation, section haute : Mz (comb. 46)', vs[6].val, 5017.6, 0.005);
  cas('glissement en rotation, section basse : Mz (comb. 28)', vs[7].val, 7283.4, 0.005);
  cas('glissement en rotation, section basse : limite', vs[7].adm, 7643.9, 0.025);
  // ÉCART CONNU : limite de q′ref. La note imprime iδ identique au nôtre (0,5791 / 0,5106) mais un γq variable (2,335 ELS,
  // 1,630 ELU au lieu de 3 et 2 du Fasc. 62) ; la règle n'est pas documentée → nos limites sont plus sévères (−17 %).
  ok(vs[0].adm < 0.359 && vs[3].adm < 0.432, 'limites q′ref ELS/ELU (γq = 3 / 2) plus sévères que l’origine (0,359 / 0,432) → ' + vs[0].adm.toFixed(3) + ' / ' + vs[3].adm.toFixed(3));
  cas('rotation maxi de la semelle ELS fréquent (mrad)', Math.max(...R.deplac.map((x) => x.rot)), 5.46, 0.02);
  cas('déplacement maxi en tête ELS fréquent (mm)', Math.max(...R.deplac.map((x) => x.u)), 40.93, 0.02);
  const vref = [19.828, 19.027, 17.539, 15.057, 12.584, 10.457, 8.611, 6.997, 5.586];
  ok(R.ba.voile.slice(0, 9).every((L, i) => near(L[0].Ar, vref[i], 0.016)), 'voile, pied, face arrière, tranches 1 à 9 (± 1,6 %) : ' + R.ba.voile.slice(0, 9).map((L, i) => rel(L[0].Ar, vref[i])).join(' '));
  const sref = [5.892, 5.860, 5.707, 5.374, 5.003, 4.654, 4.319, 3.995, 3.674];
  ok(R.ba.voile.slice(0, 9).every((L, i) => near(L[0].sc, sref[i], 0.025)), 'voile, pied, σbc ELS (± 2,5 %) : ' + R.ba.voile.slice(0, 9).map((L, i) => rel(L[0].sc, sref[i])).join(' '));
  const pref = [3.78, 3.41, 3.00, 2.45, 1.98, 1.57, 1.22, 0.93, 0.69, 0.50];
  ok(R.ba.patin.every((s, i) => Math.abs(s.sc - pref[i]) <= 0.04), 'patin, σbc ELS (± 0,04 MPa) : ' + R.ba.patin.map((s) => s.sc.toFixed(2)).join(' '));
  ok(near(R.ba.patin[0].inf, 11.65, 0.05) && R.ba.patin.slice(2).every((s) => near(s.inf, 8.35, 1e-6)), 'patin, aciers inférieurs 11,65 / 9,68 / 8,35… → ' + R.ba.patin.map((s) => s.inf.toFixed(2)).join(' '));
  ok(R.ba.talon.every((s) => near(s.sup, 8.35, 1e-6)), 'talon (équilibre du nœud) : aciers supérieurs 8,35 cm²/ml partout (origine) → ' + R.ba.talon.map((s) => s.sup.toFixed(2)).join(' '));
  ok(R.ok, 'exemple d’origine vérifié (comme la note d’origine)'); }

/* ── 6. option Culmann (Mur3D1_Culmann, sections 3 à 20) : δ = β, β ≥ 0 (Rankine) ── */
{ const P = [[0.498, 3.069], [14.532, 6.192], [24.554, 6.640], [40.083, 6.360]], ref = [[0.2815, 0.0627], [0.2714, 0.0121], [0.2710, 0.0000]];
  const K = [0, 1, 2].map((i) => { const b = Math.max(0, Math.atan2(P[i + 1][1] - P[i][1], P[i + 1][0] - P[i][0]) / D2R); return M.coulomb(35, b, b); });
  ok(K.every((k, i) => Math.abs(k.Kh - ref[i][0]) < 2e-4 && Math.abs(k.Kv - ref[i][1]) < 2e-4), 'Culmann, section 10 : Kh, Kv des trois pentes ' + K.map((k) => k.Kh.toFixed(4) + '/' + k.Kv.toFixed(4)).join(' ')); }

/* ── 7. fondation sur pieux (Mur3D_Pieux, sondage 22035SP0) : portance par FONDATIO ── */
{ const sps = 'X\r\nX\r\nX\r\nX\r\nSP0\r\n18/05/95\r\n0 0 53.560\r\n5.00\r\n0 0\r\n0.00 LIMON\r\n15.60 ***\r\n1.00 0 0.36 0.21 1.40\r\n£££\r\n$$TVCC\r\n0.00 "LIMON" 0.10 0.05 5.00 0.33 LA\r\n2.40 "ARGILE" 0.50 0.30 12.00 0.33 AA\r\n6.00 "ARGILE MARNEUSE" 0.80 0.50 17.00 0.50 AB\r\n15.60 "***"\r\n';
  const d = M.exemple(); d.zsem = 53.5; d.haute.es = d.basse.es = 1.2; d.nsec = 6;
  d.fond = Object.assign(d.fond, { type: 'pieux', D: 0.9, H: 12.2, typePieu: 2, disAv: 0.6, disAr: 0.6, xAv: [0.5, 2.5, 4.8, 7.0], xAr: [1.8, 3.7, 6.0], kbase: 1e8, ztn: 56.45, sps: M.lireSPS(sps) });
  const Rp = M.calc(d), lim = Rp.prof.R.pt.lim;
  ok(near(lim['ELU fond'][0], 1081.08, 0.001) && near(lim['ELU fond'][1], -644.84, 0.001), 'pieux Ø 0,90, L = 12,20 : Qmax / Qmin ELU 1081,08 / −644,84 kN → ' + lim['ELU fond'].map((v) => v.toFixed(2)).join(' / '));
  ok(near(lim['ELS rare'][0], 852.10, 0.001) && near(lim['ELS qp'][0], 669.51, 0.001) && near(lim['ELU acc'][0], 1261.26, 0.001), 'Qmax ELS rare 852,10 ; ELS qp 669,51 ; ELU acc. 1261,26 → ' + [lim['ELS rare'][0], lim['ELS qp'][0], lim['ELU acc'][0]].map((v) => v.toFixed(2)).join(' ; '));
  const sN = Rp.prof.R.combs.map((c) => c.piles.reduce((t, p) => t + p.N, 0)), sV = Rp.res.filter((r) => r.pieux).map((r) => r.N);
  ok(sN.every((v, i) => near(v, sV[i], 0.01)), 'groupe de pieux : Σ N en tête = charge verticale de la combinaison');
  // ÉCART CONNU : efforts par pieu non retrouvés (origine 976 kN ELU / 750 kN ELS rare au pieu 1) : semelle biaise à 70 gr
  // (non modélisée), diagramme de surcharge rectangulaire et combinaisons de la version 2004 du programme.
}
process.exit(f ? 1 : 0);
