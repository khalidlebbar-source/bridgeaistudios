/* RACBA-RAPO — tests node (node tools/test-outils-cadres-portiques.js).
 * Cas analytiques indépendants puis cas de référence chiffrés extraits des exemples d'origine « Racba » (cadre de 5 m,
 * biais 80 gr, 2 voies, 1 m de remblai) et « RapoSup » (portique de 8 m sur semelles). Seules les valeurs numériques
 * attendues sont reprises. Conventions : M > 0 tend la face intérieure (les valeurs d'origine ont été ramenées à
 * cette convention), sollicitations totales de l'ouvrage (mode « tronçon »).
 * Écarts admis et leur origine : voir les commentaires de chaque bloc. */
const R = require('../outils/js/cadres-portiques.js');
const P = require('../outils/js/portique.js');
let nOk = 0, nKo = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); c ? nOk++ : nKo++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const pct = (a, b) => (100 * (a - b) / Math.abs(b)).toFixed(1) + ' %';

/* ── 1. formules ── */
ok(near(R.ka(30), 1 / 3, 1e-12), 'Ka(30°) = 1/3 (Rankine)');
ok(near(R.ka(35), 0.2710, 2e-4) && near(R.k0(35, 'livret'), 0.3746, 2e-4), 'Ka(35°) = 0,2710 et K0 = Ka(1 + 2/3 sin φ) = 0,3746 (valeurs des notes d’origine)');
ok(near(R.k0(30, 'jaky'), 0.5, 1e-12), 'K0 de Jaky = 1 − sin 30° = 0,5');
ok(near(R.Ecm(32), 33345.76, 1e-6), 'Ecm(32) = 33 346 MPa (module courte durée des modèles d’origine)');
ok(R.kdFrein(0.8) === 1 && near(R.kdFrein(1.48), 0.68, 1e-9) && R.kdFrein(3) === 0, 'Kd = 1 ; 2/3 (2,50 − H1) ; 0 (Livret 2.01) — 0,680 pour H1 = 1,48 m comme l’exemple Racba');
ok(R.sigmaT72(16, 0.3) === 240 && R.sigmaT72(25, 0.3) === 200 && near(R.sigmaT72(20, 0.3), 200 + 40 * 5 / 9, 1e-9), 'tableau 7.2N (wk = 0,3 mm) : φ16 → 240 MPa, φ25 → 200 MPa, φ20 interpolé 222 MPa');
ok(near(R.gousset(0.3, 0.2, 0), 0.1, 1e-12) && near(R.gousset(0.8, 0.2, 0.4), 0.1, 1e-12), 'gousset : épaisseur effective limitée à la pente 1/3');

/* ── 2. portique encastré sans gousset : moments de Kleinlogel ──
 * barres d'inertie égale, k = I2·h/(I1·L) = h/L ; charge q uniforme sur la traverse :
 * M angle = −qL²/(6(k+2)), M pied = +qL²/(12(k+2)) (convention : M > 0 tend la face intérieure). */
{
  const d = Object.assign(R.defauts('portique'), { fond: 'encastre', biais: 100, ouv: 8, hauint: 6, eptra: 0.6, eppied: 0.6, hausem: 1.2, haugousup: 0, longousup: 0,
    lontottab: 10, lonpied: 10, epsRet: 0, dilLD: 0, dilCD: 0, conLD: 0, conCD: 0 });
  const r = R.calcul(d);
  const L = r.G.LarCal, h = r.G.HauCal, q = d.gBal * d.epbal * 10 + d.poicor, k = h / L;
  const st = (m, c) => r.S.stations.findIndex((s) => s.membre === m && Math.abs(s.c - c) < 1e-6);
  const Mb = r.E.G3[3 * st('traverse', -L / 2)], Ma = r.E.G3[3 * st('piédroit gauche', 0)];
  ok(near(Mb, -q * L * L / (6 * (k + 2)), 2e-3), `Kleinlogel, M d’angle : ${Mb.toFixed(2)} / ${(-q * L * L / (6 * (k + 2))).toFixed(2)} kN·m (déformation axiale négligée dans la formule)`);
  ok(near(Ma, q * L * L / (12 * (k + 2)), 6e-3), `Kleinlogel, M de pied : ${Ma.toFixed(2)} / ${(q * L * L / (12 * (k + 2))).toFixed(2)} kN·m`);
  const Mmid = r.E.G3[3 * st('traverse', 0)];
  ok(near(Mmid - Mb, q * L * L / 8, 2e-3), 'équilibre de la traverse : M(mi-portée) − M(angle) = qL²/8');
  // ligne d'influence : charge répartie 100 kN/m via les LI = cas statique équivalent
  const t = 3 * st('traverse', 0), xs = r.LI.xs, y = r.LI.Y.map((v) => v[t]);
  let I = 0; for (let i = 1; i < xs.length; i++) I += (y[i] + y[i - 1]) / 2 * (xs[i] - xs[i - 1]);
  const pr = P.prepare({ nodes: r.M.nodes, elems: r.M.elems.map((e) => ({ i: e.i, j: e.j, E: 1e7, A: e.A, I: e.I })), supports: [{ n: r.M.nd(-L / 2, 0), ux: true, uy: true, rz: true }, { n: r.M.nd(L / 2, 0), ux: true, uy: true, rz: true }] });
  const trav = r.M.members.find((m) => m.nom === 'traverse');
  const rs = pr.run({ elem: trav.elems.map((e) => ({ e, type: 'u', dir: 'gy', q: -1 })) });
  ok(near(I, rs.at(trav.elems[trav.elems.length / 2 | 0], 0).M, 5e-3), 'aire de la ligne d’influence = moment sous charge unitaire répartie');
}

/* ── 3. cadre de référence « Racba » ── */
const pts = [['traverse', -2.767], ['radier', -0.4605], ['piédroit gauche', 0.125], ['piédroit gauche', 1.993], ['piédroit gauche', 2.507], ['piédroit gauche', 4.375]];
const dRa = Object.assign(R.defauts('cadre'), { Kmarston: 1.0648, hPhi: 'origine', critere: 'contrainte', sigLim: 320 });
const ra = R.calcul(dRa, { points: pts.map(([m, c]) => ({ membre: m, c })) });
{
  const c = ra.cof;
  // coefficient total appliqué au chargement LM71 d'une voie : 1,6142 = Φ × K ; sur les deux voies 3,228
  ok(near(c.phi, 1.3928, 2e-4), `Φ réduit sous 1 m de remblai : ${c.phi.toFixed(4)} / 1,3928`);
  ok(near(c.K, 1.1590, 5e-4), `K de Guyon-Massonnet (GMSLT) : ${c.K.toFixed(4)} / 1,1590`);
  ok(near(c.cLM, 3.228, 1e-3), `coefficient des deux voies : ${c.cLM.toFixed(4)} / 3,228`);
  ok(near(c.LPhi, 6.406, 1e-3), 'LΦ = 1,3 (5,783 + 2 × 4,5)/3 = 6,406 m');
  ok(near(ra.G.LarCal, 5.783, 2e-4) && near(ra.G.HauCal, 4.5, 1e-9) && near(ra.G.Btrav, 11.698, 1e-4), 'LarCal = 5,783 m, HauCal = 4,50 m, largeur de traverse 11,698 m');
  const st = (m, x) => { let b = -1, bd = 9; ra.S.stations.forEach((s, k) => { if (s.membre !== m) return; const dd = Math.abs(s.c - x); if (dd < bd - 1e-9) { bd = dd; b = k; } }); return b; };
  // cas élémentaires (kN·m, valeurs d'origine ramenées à la convention « face intérieure »)
  const kM = st('traverse', 0);
  const E = (k, i) => ra.E[k][3 * i];
  ok(near(E('G1', kM), 419.87, 0.03), `poids propre, M mi-traverse : ${E('G1', kM).toFixed(1)} / 419,9 (${pct(E('G1', kM), 419.87)})`);
  ok(near(E('G2', kM), 516.14, 0.03), `remblai (k = 1), M mi-traverse : ${E('G2', kM).toFixed(1)} / 516,1 (${pct(E('G2', kM), 516.14)})`);
  ok(near(E('G7', kM), -283.83, 0.03), `poussée gauche k = 1, M mi-traverse : ${E('G7', kM).toFixed(1)} / −283,8`);
  const k8 = st('piédroit gauche', 0.125);
  ok(near(E('G7', k8), -2632.4, 0.02), `poussée gauche k = 1, M pied du piédroit (nœud 8) : ${E('G7', k8).toFixed(1)} / −2632,4`);
  ok(near(E('QRG', k8) * 300, -494.0, 0.03), `surcharge du remblai 300 kN/m, nœud 8 : ${(E('QRG', k8) * 300).toFixed(1)} / −494,0`);
  ok(near(E('FR', k8) * 300.3, -324.7, 0.03), `freinage 300,3 kN, nœud 8 : ${(E('FR', k8) * 300.3).toFixed(1)} / −324,7`);
  const env = R.enveloppesConvois(ra.LI, 3 * kM, [3 * kM], ['LM71', 'SW2']);
  // +2 % : traverse un peu plus souple vis-à-vis des angles qu'à l'origine (épaisseurs des barres de gousset, piédroits)
  ok(near(env.LM71.max.v, 364.12, 0.025), `LM71 réparti (une voie, coefficient 1) : ${env.LM71.max.v.toFixed(2)} / 364,12 kN·m`);
  ok(near(env.SW2.max.v, 349.55, 0.025), `SW/2 (une voie) : ${env.SW2.max.v.toFixed(2)} / 349,55 kN·m`);
  // enveloppes ELU aux sections d'origine (somme courte + longue durée). Écarts : combinaisons construites section par
  // section ici (l'origine applique à toutes les sections les jeux de coefficients définis pour 6 effets), freinage de
  // l'EN (33 kN/m pour LM71 au lieu de 35), maillage et goussets, poids des piédroits.
  const REF = [['traverse mi-portée (nœud 24)', 'traverse', 0, 3534.2, 1], ['traverse près de l’angle (nœud 19)', 'traverse', -2.767, -3477.6, -1],
    ['radier, angle (section 6)', 'radier', -2.8915, -3857.5, -1], ['radier près du milieu (section 1)', 'radier', -0.4605, 3129.5, 1],
    ['piédroit, pied (nœud 8)', 'piédroit gauche', 0.125, -3592.2, -1], ['piédroit (nœud 13)', 'piédroit gauche', 2.507, -2014.5, -1], ['piédroit, tête (nœud 17)', 'piédroit gauche', 4.375, -3825.7, -1]];
  for (const [lib, m, x, ref, sg] of REF) { const e = ra.env[st(m, x)].ELU[sg > 0 ? 'Mmax' : 'Mmin'].M; ok(near(e, ref, 0.06), `Racba ELU ${lib} : ${e.toFixed(0)} / ${ref} kN·m (${pct(e, ref)})`); }
  { const e = ra.env[st('piédroit gauche', 1.993)].ELU.Mmin.M; ok(e <= -1745.3 && near(e, -1745.3, 0.15), `Racba ELU piédroit nœud 12 : ${e.toFixed(0)} / −1745 (${pct(e, -1745.3)}, enveloppe section par section plus défavorable)`); }
  // ELS caractéristique
  const RS = [['traverse mi-portée', 'traverse', 0, 2492.7, 1], ['traverse nœud 19', 'traverse', -2.767, -2400.3, -1], ['piédroit tête', 'piédroit gauche', 4.375, -2639.1, -1], ['radier angle', 'radier', -2.8915, -2590.1, -1]];
  for (const [lib, m, x, ref, sg] of RS) { const e = ra.env[st(m, x)].CAR[sg > 0 ? 'Mmax' : 'Mmin'].M; ok(near(e, ref, 0.06), `Racba ELS car. ${lib} : ${e.toFixed(0)} / ${ref} kN·m (${pct(e, ref)})`); }
  // aciers à mi-traverse (origine : 225,10 cm² / 11,698 m = 19,24 cm²/m, σs ≤ 320 MPa)
  const jm = ra.justif.find((j) => j.sec.cle === 'trav-mi');
  ok(near(jm.As[0], 19.24, 0.04), `Racba aciers inférieurs à mi-traverse : ${jm.As[0].toFixed(2)} / 19,24 cm²/m (${pct(jm.As[0], 19.24)})`);
  ok(ra.justif.every((j) => j.ok), 'Racba : toutes les sections justifiées');
  ok(near(ra.fleche.admConfort * 1000, 5.51, 0.01), `flèche admissible de confort : ${(ra.fleche.admConfort * 1000).toFixed(2)} / 5,51 mm (L/δ = 1500 × 0,7)`);
  ok(ra.fleche.delta > 0 && ra.fleche.ok, `flèche sous LM71 ${(ra.fleche.delta * 1000).toFixed(2)} mm < 5,51 mm (origine 1,24 mm : K des deux voies et n = 15, ici K de la voie excentrée et rigidité §7.4.3)`);
}

/* ── 4. portique de référence « RapoSup » ── */
{
  const REF = { 3: ['semelle gauche', -4.65, 3763.4, 1], 5: ['semelle gauche', -4.0, -4195.3, -1], 8: ['piédroit gauche', 0.6, -7130.3, -1], 12: ['piédroit gauche', 4.45, 4001.5, 1],
    17: ['piédroit gauche', 8.763, -9364.0, -1], 19: ['traverse', -4.163, -9158.6, -1], 24: ['traverse', 0, 5015.1, 1] };
  const rp = R.calcul(Object.assign(R.defauts('portique'), { hPhi: 'origine', critere: 'contrainte', sigLim: 320, classe: 'A' }), { points: Object.values(REF).map(([m, c]) => ({ membre: m, c })) });
  ok(near(rp.cof.phi, 1.2716, 2e-4), `RapoSup Φ : ${rp.cof.phi.toFixed(4)} / 1,2716`);
  ok(near(rp.cof.K, 1.0862, 1e-3), `RapoSup K : ${rp.cof.K.toFixed(4)} / 1,0862`);
  ok(near(rp.cof.cLM, 2.7624, 1e-3), `RapoSup coefficient des deux voies : ${rp.cof.cLM.toFixed(4)} / 2,762`);
  const st = (m, x) => { let b = -1, bd = 9; rp.S.stations.forEach((s, k) => { if (s.membre !== m) return; const dd = Math.abs(s.c - x); if (dd < bd - 1e-9) { bd = dd; b = k; } }); return b; };
  const env = R.enveloppesConvois(rp.LI, 3 * st('traverse', 0), [3 * st('traverse', 0)], ['LM71', 'SW2']);
  ok(near(env.LM71.max.v, 745.74, 0.01), `RapoSup LM71 une voie, M mi-traverse : ${env.LM71.max.v.toFixed(2)} / 745,74`);
  // écarts : semelles maillées plus finement (ressorts répartis), freinage EN 33 kN/m, combinaisons section par section,
  // charge verticale du train conservée à 0,5 quand le freinage agit (EN 1991-2 tableau 6.11)
  for (const [n, [m, x, ref, sg]] of Object.entries(REF)) { const e = rp.env[st(m, x)].ELU[sg > 0 ? 'Mmax' : 'Mmin'].M; ok(near(e, ref, 0.08), `RapoSup ELU section ${n} (${m}) : ${e.toFixed(0)} / ${ref} kN·m (${pct(e, ref)})`); }
  const f = rp.sol.fond[0];
  const qE = Math.max(...f.lignes.filter((l) => l.et === 'CAR').map((l) => l.qref)), qU = Math.max(...f.lignes.filter((l) => l.et === 'ELU').map((l) => l.qref));
  ok(near(qE, 0.317, 0.08) && near(qU, 0.442, 0.08), `RapoSup q’ref sous semelle ELS ${qE.toFixed(3)} / 0,317 MPa, ELU ${qU.toFixed(3)} / 0,442 MPa (non vérifiés dans les deux calculs)`);
  ok(!f.ok, 'RapoSup : fondation non vérifiée, comme dans la note d’origine');
  ok(near(rp.fleche.admConfort * 1000, 8.24, 0.01), `RapoSup flèche admissible : ${(rp.fleche.admConfort * 1000).toFixed(2)} / 8,24 mm`);
}

/* ── 5. variantes : tranche de 1 m, cadre sous ballast, ressorts, eau, engin, import .don ── */
{
  const t = R.calcul(Object.assign(R.defauts('cadre'), { mode: 'tranche' }));
  ok(t.G.Btrav === 1 && t.G.sinB === 1 && t.cof.nOver === 1 && near(t.cof.cN, 1 / t.cof.larRep, 1e-12), 'tranche de 1 m : biais 100 gr, charge d’une voie / largeur de répartition');
  const s = R.calcul(Object.assign(R.defauts('cadre'), { eprem: 0, epbal: 0.35, ouv: 2, hauint: 2, nbvoi: 1, axevoi1: 0, lontottab: 6, lonpied: 6, lonrad: 6 }));
  ok(s.cof.phi === s.cof.phi0 && s.justif.every((j) => j.As), 'cadre sous ballast (couverture nulle) : Φ non réduit, sections calculées');
  const w = R.calcul(Object.assign(R.defauts('cadre'), { hw: 2, engin: true }));
  ok(w.cases.W && w.cases.ENR && w.justif.length > 8, 'nappe (pression et sous-pression) et engin de chantier pris en compte');
  const p = R.calcul(Object.assign(R.defauts('portique'), { fond: 'ressorts', Kv: 2e6, Kh: 1e6, Kr: 5e6 }));
  ok(p.justif.every((j) => j.As) && p.sol.fond.length === 2, 'portique sur ressorts (fondations profondes) : calcul complet');
  const txt = 'application ;\nRACBA_RAPO\ntypstruct ;\n1\nbiais ;\n90\nouvdroi ;\n4\nhauint ;\n3\neptra ;\n0.4\neppied ;\n0.4\neprad ;\n0.4\nnbvoi ;\n1\nselectionconvois ;\n5\n';
  const x = R.lireDon(txt).d;
  ok(x.type === 'cadre' && x.biais === 90 && x.ouv === 4 && x.nbvoi === 1 && x.LM71 && !x.SW0 && x.SW2, 'lecture d’un fichier .don (clé ; commentaire / valeur)');
}

console.log(`\n${nOk}/${nOk + nKo} vérifications réussies`);
process.exit(nKo ? 1 : 0);
