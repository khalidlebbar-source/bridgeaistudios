/* FONDATIO — tests du moteur (node tools/test-outils-fondatio.js) : cas analytiques et exemples d'origine
 * (FondSup, FondSemiPro, FondPieux sur le sondage PressioC0 — seules les valeurs numériques sont reprises). */
const S = require('../outils/js/sondpres.js');
const F = require('../outils/js/fondatio.js');
let f = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));
const near = (a, b, t = 1e-6) => rel(a, b) <= t || Math.abs(a - b) < 1e-9;
const cmp = (lab, a, b, t) => ok(near(a, b, t), `${lab} : ${(+a).toFixed(4)} / origine ${b} (écart ${(100 * rel(a, b)).toFixed(2)} %)`);

/* ── cas analytiques ── */
// courbes de frottement (annexe C3)
ok(near(F.qsCourbe(1, 0.4), 0.04 * (0.4 / 1.5) * (2 - 0.4 / 1.5)) && near(F.qsCourbe(2, 3.5), 0.08) && near(F.qsCourbe(3, 1), 0.12 * (1 / 2.5) * (2 - 1 / 2.5)), 'courbes Q1 à Q4 : qsn (2 − pl/pn) pl/pn, palier qsn');
ok(near(F.qsCourbe(5, 2), Math.min(1.8 / 9, 5.3 / 32)) && near(F.qsCourbe(6, 2), Math.min(0.22, 0.2)) && near(F.qsCourbe(7, 2.6), 0.3), 'courbes Q5, Q6, Q7');
// iδ (annexe F1)
ok(near(F.iDelta(0, true, 1), 1) && near(F.iDelta(30, false, 1), Math.pow(2 / 3, 2)) && near(F.iDelta(45, true, 0), 0), 'iδ : δ = 0, sol cohérent, sol frottant De = 0');
// répartition sous semelle rigide
{ const r = F.repartition({ B: 2, L: 3 }, 600, 0, 0); ok(near(r.smax, 100) && near(r.smin, 100) && r.decomp === 0, 'semelle centrée : σ = N/A'); }
{ const r = F.repartition({ B: 2, L: 3 }, 600, 0, 100); ok(near(r.smax, 100 + 100 / (3 * 8 / 12)) && near(r.smin, 100 - 50), 'noyau central : σ = N/A ± M/W'); }
{ const r = F.repartition({ B: 2, L: 3 }, 600, 0, 400); ok(near(r.decomp, 50, 1e-3) && near(r.smax, 400, 2e-3), 'hors noyau : triangle 3(B/2 − e), σmax = 2N/(3(B/2 − e)L), 50 % décomprimé'); }
ok(near(F.meyerhof({ B: 2, L: 3 }, 600, 0, 300), 600 / (1 * 3) / 1000), 'Meyerhof : N/(B’L’)');
// Ménard : réaction latérale, coefficients de forme
ok(near(F.esMenard(5, 0.5, 1.2), 12 * 5 / (4 / 3 * 0.5 * Math.pow(5.3, 0.5) + 0.5), 1e-12) && near(F.esMenard(5, 0.5, 0.4), 60 / (4 / 3 * Math.pow(2.65, 0.5) + 0.5), 1e-12), 'Es de Ménard (annexe C5), B ≥ B0 et B < B0');
ok(near(F.lambdas(5.4, 10.4).lc, 1.1926, 1e-4) && near(F.lambdas(5.4, 10.4).ld, 1.4996, 1e-4), 'λc, λd interpolés (L/B = 1,926)');
// transport d'un torseur
{ const T = F.transport([10, 0, -100, 0, 0, 0], 1, 0, 2, 0, 0, 0); ok(near(T[4], 2 * 10 + 1 * 100) && near(T[3], 0), 'transport du torseur (bras de levier vertical et horizontal)'); }
// pieu isolé, sol homogène, charge en tête : équilibre et symétrie du groupe
{
  const sp = S.vide(); Object.assign(sp, { z: 100, fin: 30, finCouches: 30, couches: [{ z: 0, nom: 'sable', pl: 2, pf: 1.2, em: 20, alpha: 0.33, classe: 'SB' }] });
  const d = { type: 'pieux', sps: sp, zsem: 100, zdef: 100, ztn: 100, combs: [{ type: 'ELS Rare', ld: [0, 0, -4000, 0, 0, 0], cd: [200, 0, 0, 0, 0, 0] }],
    pieux: { type: 2, B: 1, L: 12, piles: [{ x: -1.5, y: 0 }, { x: 1.5, y: 0 }], palierArriere: 1 } };
  const r = F.calc(d), c = r.combs[0];
  ok(near(c.piles[0].N + c.piles[1].N, 4000, 1e-6), 'équilibre vertical ΣN = V');
  const r0 = F.calc(Object.assign({}, d, { combs: [{ type: 'ELS Rare', ld: [0, 0, -4000, 0, 0, 0], cd: [0, 0, 0, 0, 0, 0] }] }));
  ok(near(r0.combs[0].piles[0].N, 2000, 1e-9) && near(r0.combs[0].piles[1].N, 2000, 1e-9), 'charge centrée : N = 4000/2 par pieu');
  // sous H, les pieux encastrés font tourner la semelle : couple axial ΔN·e équilibrant les moments d'encastrement
  const dN = (c.piles[1].N - c.piles[0].N) / 2 * 3, Mt = c.piles[0].My + c.piles[1].My;
  ok(near(dN, Mt, 1e-4) || near(dN, -Mt, 1e-4), 'équilibre des moments : ΔN·e = ΣM en tête');
  ok(near(c.piles[0].Fx + c.piles[1].Fx, -200, 1e-4) || near(c.piles[0].Fx + c.piles[1].Fx, 200, 1e-4), 'équilibre horizontal ΣFx = H');
  const pt = r.pt;
  ok(near(pt.Qpu, 1.1 * 2 * Math.PI / 4 * 1000, 1e-9) && near(pt.Qsu, F.qsCourbe(2, 2) * Math.PI * 12 * 1000, 1e-9), 'Qpu = kp ple* Ap ; Qsu = qs(Q2) π B L');
}

/* ── exemples d'origine (valeurs relevées dans les notes .res/.ndc ; sondage PressioC0 reconstitué) ── */
const sps = S.vide();
Object.assign(sps, { z: 160, nappe: 8, fin: 20, finCouches: 20, couches: [{ z: 0, nom: 'limon', pl: 0.40, pf: 0.24, em: 5, alpha: 0.5, classe: 'LA' }, { z: 10.5, nom: 'sable', pl: 3.5, pf: 2.1, em: 20, alpha: 0.33, classe: 'SB' }] });
const C = [ // 17 combinaisons communes aux trois exemples : [type, LD (Fx Fy Fz Mx My Mz), CD]
  ['ELS Rare', [633.24, 7.66, -17994.34, -71.28, -1503.65, 0], [768.15, -124.97, -1565.6, 1525.58, 4874.98, 0]],
  ['ELS Rare', [0, -4.3, -17994.34, 40.02, -8361.83, 0], [0, 124.97, -1565.6, -1525.58, -5348.05, 0]],
  ['ELS Rare', [612.96, 7.66, -16315.63, -71.28, -588.58, 0], [595.38, -128.12, 277.6, 1554.88, 5847.47, 0]],
  ['ELS Rare', [0, -4.3, -16315.63, 40.02, -7274.97, 0], [0, 128.12, 277.6, -1554.88, -1930.75, 0]],
  ['ELS Rare', [0, -4.3, -17994.34, 40.02, -8361.83, 0], [0, 119.7, -1332, -1476.52, -6422, 0]],
  ['ELS Rare', [612.96, 7.66, -16315.63, -71.28, -588.58, 0], [954.95, -121.57, -614.3, 1188.97, 7945.29, 0]],
  ['ELS Freq', [593.92, 6.94, -17994.34, -64.62, -1869.62, 0], [482.66, -60.9, -939.36, 748.07, 3126.95, 0]],
  ['ELS Freq', [0, -3.58, -17994.34, 33.35, -8171.37, 0], [0, 60.9, -939.36, -748.07, -3313.61, 0]],
  ['ELS Freq', [0, -3.58, -17994.34, 33.35, -8171.37, 0], [0, 57.74, -799.2, -718.57, -3957.98, 0]],
  ['ELS Freq', [573.64, 6.94, -16315.63, -64.62, -954.55, 0], [656.21, -57.74, -287.28, 718.63, 5655.1, 0]],
  ['ELU Fond', [890.27, 10.98, -24292.36, -102.24, -1700.55, 0], [1118.67, -187.96, -2270.12, 2293.06, 7114.12, 0]],
  ['ELU Fond', [0, -6.45, -24292.36, 60.02, -11459.88, 0], [0, 187.96, -2270.12, -2293.06, -7778.45, 0]],
  ['ELU Fond', [795.46, 10.98, -16315.63, -102.24, 1109.91, 0], [868.15, -192.53, 402.52, 2335.55, 8524.24, 0]],
  ['ELU Fond', [0, -6.45, -16315.63, 60.02, -7846.34, 0], [0, 190.32, 366.66, -2333.19, -3461.47, 0]],
  ['ELU Fond', [890.27, 10.98, -24292.36, -102.24, -1700.55, 0], [1538.08, -180.32, -1931.4, 2221.93, 11491.83, 0]],
  ['ELU Fond', [1126.2, 15.28, -24292.36, -142.25, 495.27, 0], [1352.4, -100.99, -1545.12, 1266.1, 10326.35, 0]],
  ['ELU Fond', [0, -10.75, -16315.63, 100.04, -8989.08, 0], [0, 118.8, 0, -1431.89, -1159.55, 0]],
].map(([type, ld, cd]) => ({ type, ld, cd }));

// FondSemiPro : massif 5,40 × 10,40 m, h = 2 m sous semelle à 156,00 ; TN 159, TD 162
{
  const r = F.calc({ type: 'semi', sps, combs: C, zsem: 156, zdef: 162, ztn: 159, sup: { forme: 'rect', B: 5.4, L: 10.4, h: 2, phi: 35.75, sol: 'frottant' } });
  console.log('— FondSemiPro');
  cmp('De', r.De, 4.767, 1e-3); cmp('ple*', r.ple, 1.049, 1e-3); cmp('kp', r.kp, 0.943, 1e-3); cmp('q’0', r.q0, 0.152, 1e-3); cmp('q’u', r.qu, 1.141, 1e-3);
  cmp('kv longue durée', r.kvLD, 7.79, 1e-3); cmp('Ed', r.mm.Ed, 8.63, 1e-3); cmp('poids du massif', r.poids, 2808, 1e-9);
  // σ sous le massif, comb. 1 (points 1 et 3 de la note : 0,2987 / 0,5322 MPa) ; comparaison des q'ref (σ3/4) ELS 5 / ELU 12
  // écart ≈ 1 % : la réaction horizontale des faces verticales du massif (206 kN en comb. 1) n'est pas comptée ici
  cmp('σmax comb. 1', r.combs[0].smax, 0.5322, 1.5e-2); cmp('σmin comb. 1', r.combs[0].smin, 0.2644, 2.5e-2);
  cmp('q’ref ELS comb. 5', r.combs[4].qref, 0.542, 1.5e-2); cmp('q’ref ELU comb. 12', r.combs[11].qref, 0.718, 1.5e-2);
  ok(r.combs.every((c) => c.decomp === 0), 'décompression nulle (origine : 0 %)');
}
// FondSup : semelle 6,50 × 13,50 m à 154,00
{
  const r = F.calc({ type: 'sup', sps, combs: C, zsem: 154, zdef: 162, ztn: 159, sup: { forme: 'rect', B: 6.5, L: 13.5, phi: 35.75, sol: 'frottant' } });
  console.log('— FondSup');
  cmp('kv longue durée', r.kvLD, 6.45, 1e-3);
  cmp('q’ref ELS comb. 5', r.combs[4].qref, 0.302, 2e-3); cmp('q’ref ELU comb. 16', r.combs[15].qref, 0.354, 2e-3);
  // déplacement moyen (fichier .max : c = 0,0331674 m pour la comb. 1, 0,0449143 m pour la comb. 11)
  cmp('déplacement vertical comb. 1 (mm)', r.combs[0].wz, 33.1674, 2e-3); cmp('déplacement vertical comb. 11 (mm)', r.combs[10].wz, 44.9143, 2e-3);
  cmp('glissement Hres/H comb. 13', r.combs[12].glis, 5.70, 2e-3);
  ok(r.mu > 0.599 && r.mu < 0.601, 'μ = tan 35,75°/1,2 = 0,600');
}
// FondPieux : 8 pieux forés boue Ø 1,20 m, L = 15 m, semelle à 158,00
{
  const piles = []; for (const x of [-1.5, 1.5]) for (const y of [-4.5, -1.5, 1.5, 4.5]) piles.push({ x, y });
  const d = { type: 'pieux', sps, combs: C, zsem: 158, zdef: 162, ztn: 159.5,
    pieux: { type: 2, B: 1.2, L: 15, nseg: 10, kbase: 1e8, piles, enrob: 0.09,
      // réduction de groupe du module frontal relevée dans la note d'origine (non programmée ici)
      reducKf: { x: { limon: 0.8503, sable: 0.8681 }, y: { limon: 0.9104, sable: 0.9258 } } } };
  const r = F.calc(d), pt = r.pt;
  console.log('— FondPieux');
  cmp('ple* pointe', pt.ple, 3.5, 1e-6); cmp('De', pt.De, 8.271, 1e-3); cmp('kp', pt.kp, 1.1, 1e-9);
  cmp('Qpu', pt.Qpu, 4354, 1e-3); cmp('Qsu', pt.Qsu, 2553, 1e-3); cmp('Qu', pt.Qu, 6907.1, 1e-4); cmp('Qc', pt.Qc, 3964.1, 1e-4);
  cmp('Qtc', pt.Qtc, 1787.0, 1e-4); cmp('fc* conventionnelle', pt.fc, 20.833, 1e-4); cmp('N ≤ 0,3 fc* Ap', pt.Nbeton, 7068.6, 1e-4);
  cmp('limite ELU fond.', pt.lim['ELU fond'][0], 4933.6, 1e-4); cmp('limite ELS rare', pt.lim['ELS rare'][0], 3603.7, 1e-4); cmp('limite ELS q.p.', pt.lim['ELS qp'][0], 2831.5, 1e-4);
  cmp('Kf limon (1,20 m, réduction de groupe 0,8503)', F.esMenard(5, 0.5, 1.2) * 0.8503, 25.074, 1e-3); cmp('Kf sable', F.esMenard(20, 0.33, 1.2) * 0.8681, 140.208, 1e-3);
  // efforts en tête (la note donne Fz, Fy, Mx, My par pieu)
  const c4 = r.combs[3], c5 = r.combs[4], c12 = r.combs[11], c13 = r.combs[12];
  cmp('comb. 4 pieu 4 Fz', -c4.piles[3].N, -2763.50, 5e-3); cmp('comb. 4 pieu 5 Fz', -c4.piles[4].N, -1246.01, 5e-3);
  cmp('comb. 5 pieu 4 Fz', -c5.piles[3].N, -3578.62, 5e-3); cmp('comb. 12 pieu 4 Fz', -c12.piles[3].N, -4854.38, 5e-3);
  cmp('comb. 13 pieu 4 Fz', -c13.piles[3].N, -877.65, 2e-2); cmp('comb. 13 pieu 5 Fz', -c13.piles[4].N, -3100.63, 5e-3);
  cmp('comb. 13 Fx par pieu', c13.piles[0].Fx, 207.95, 1e-3); cmp('comb. 12 Fy par pieu', c12.piles[0].Fy, 22.69, 2e-3);
  cmp('comb. 4 My en tête', c4.piles[0].My, -144.39, 2e-2); cmp('comb. 5 My en tête', c5.piles[0].My, -228.36, 2e-2);
  cmp('comb. 12 My en tête', c12.piles[0].My, -297.78, 4e-2); cmp('comb. 13 My en tête', c13.piles[0].My, -268.76, 4e-2);
  cmp('comb. 4 Mx en tête', c4.piles[0].Mx, 30.29, 5e-2);
  cmp('comb. 4 dz pieu 4 (mm)', c4.piles[3].dz * 1000, -3.487, 5e-3); cmp('comb. 5 dx (mm)', c5.piles[0].dx * 1000, -1.483, 5e-2);
  cmp('comb. 13 dx (mm)', c13.piles[0].dx * 1000, 3.701, 5e-2);
  ok(r.combs.every((c) => c.conv), 'convergence élasto-plastique de toutes les combinaisons');
  ok(r.synth.ok, 'portance vérifiée (origine : OK)');
  // aciers : origine 1,0 cm² à l'ELU en tête, section retenue = ferraillage minimal (51,62 cm² dans la note)
  ok(r.acier.sections[0].Aelu > 0.5 && r.acier.sections[0].Aelu < 1.6, `As ELU en tête : ${r.acier.sections[0].Aelu.toFixed(2)} cm² (origine 1,0 cm²)`);
  ok(r.acier.sections.slice(1).every((s) => s.Aelu === 0), 'As ELU nulle sous la tête (origine : ferraillage minimal)');
  cmp('Vu ELU en tête', r.acier.sections[0].Vu, 310.0, 8e-2);
}
process.exit(f ? 1 : 0);
