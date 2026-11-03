/* BAEL-EC2 — tests du moteur de sections en béton armé (node tools/test-outils-bael-ec2.js).
 * 1. Cas analytiques indépendants (formules fermées).
 * 2. Cas de référence chiffrés tirés des exemples de l'ancien programme (fichiers .don/.res non versionnés :
 *    seules les valeurs attendues sont reprises ici, avec le nom de l'exemple). */
const S = require('../outils/js/bael-ec2.js');
let fails = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const chk = (a, b, tol, m) => ok(near(a, b, tol), `${m} : ${(+a).toFixed(4)} (attendu ${b}, tol. ${(tol * 100).toFixed(2)} %)`);

/* ═════════════ 1. CAS ANALYTIQUES ═════════════ */
console.log('— Cas analytiques');
{ // matériaux EC2 tableau 3.1
  const b = S.ec2Beton(30); chk(b.fctm, 2.896, 1e-3, 'fctm C30'); chk(b.Ecm, 32837, 1e-3, 'Ecm C30');
  const c = S.ec2Beton(70); chk(c.ecu2 * 1000, 2.66, 5e-3, 'εcu2 C70'); chk(c.n, 1.44, 5e-3, 'n C70');
}
{ // rectangle simplement armé, diagramme rectangulaire EC2, palier horizontal : MRd = As fyd (d − 0,4 x), x = As fyd/(0,8 b fcd)
  const m = S.materiau({ regl: 'EC2', fck: 30, fyk: 500, diagramme: 'rect', palier: 'horizontal' });
  const b = 1, h = 0.8, d = 0.74, As = 30;
  const g = S.rect({ b, h, nappes: [{ d: 0.06, As: 0 }, { d, As }] });
  const fyd = 500 / 1.15, fcd = 20, x = As * 1e-4 * fyd / (0.8 * b * fcd);
  const MRd = As * 1e-4 * fyd * (d - 0.4 * x) * 1000;
  const r = S.elu(g, m, { N: 0, M: -500 });
  chk(-r.MRd, MRd, 2e-3, 'MRd rectangle simplement armé (diagramme rectangulaire)');
  ok(r.pivot === 'A' || r.pivot === 'B', 'pivot A ou B en flexion simple faiblement armée : ' + r.pivot);
  // dimensionnement : μ, α, z (formules du cours)
  const M = 600, mu = M / 1000 / (b * d * d * fcd), al = 1.25 * (1 - Math.sqrt(1 - 2 * mu)), z = d * (1 - 0.4 * al), Asth = M / 1000 / (z * fyd) * 1e4;
  const dm = S.dimELU2({ b, h, nappes: [{ d: 0.06, As: 0 }, { d, As: 0 }] }, S.rect({ b, h, nappes: [{ d: 0.06, As: 0 }, { d, As: 0 }] }), m, { N: 0, M: -M, type: 1 });
  chk(dm.As[1], Asth, 3e-3, `As par μ = ${mu.toFixed(4)}, α = ${al.toFixed(4)}, z = ${z.toFixed(4)} m`);
  ok(dm.As[0] === 0, 'pas d’aciers comprimés (μ < μlim)');
  // flexion composée, pivot B, aciers tendus plastifiés : N = 0,8 b x fcd − As fyd ; M/G = 0,8 b x fcd (h/2 − 0,4 x) + As fyd (d − h/2)
  const N = 1500, x2 = (N / 1000 + As * 1e-4 * fyd) / (0.8 * b * fcd);
  const M2 = (0.8 * b * x2 * fcd * (h / 2 - 0.4 * x2) + As * 1e-4 * fyd * (d - h / 2)) * 1000;
  const r2 = S.elu(g, m, { N, M: -100 });
  chk(-r2.MRd, M2, 2e-3, 'MRd flexion composée pivot B (x = ' + x2.toFixed(3) + ' m)');
  ok(r2.pivot === 'B', 'pivot B : ' + r2.pivot);
}
{ // compression et traction centrées (EC2, parabole-rectangle, palier horizontal)
  const m = S.materiau({ regl: 'EC2', fck: 30, fyk: 500, palier: 'horizontal' });
  const g = S.rect({ b: 0.5, h: 0.5, nappes: [{ d: 0.05, As: 10 }, { d: 0.45, As: 10 }] });
  const it = S.interaction(g, m, 1, 30);
  chk(it.Nmax, (0.25 * 20 + 20e-4 * 400) * 1000, 1e-3, 'Nmax = Ac fcd + As Es εc2');
  chk(it.Nmin, -20e-4 * 434.783 * 1000, 1e-4, 'Nmin = −As fyd');
}
{ // ELS : section rectangulaire simplement armée — axe neutre par l'équation du second degré
  const b = 1, d = 0.74, As = 25e-4, nE = 15, M = 300;
  const x = (-nE * As + Math.sqrt(sq(nE * As) + 2 * b * nE * As * d)) / b;
  const I = b * x ** 3 / 3 + nE * As * sq(d - x);
  const g = S.rect({ b, h: 0.8, nappes: [{ d: 0.06, As: 0 }, { d, As: 25 }] });
  const e = S.els(g, { Es: 200000 }, { N: 0, M: -M, n: nE });
  chk(e.x, x, 1e-4, 'x ELS (2nd degré)');
  chk(e.sc, M / 1000 * x / I, 1e-4, 'σc = M x / I');
  chk(-e.ss[1], nE * M / 1000 * (d - x) / I, 1e-4, 'σs = n M (d − x) / I');
  // caractéristiques homogénéisées
  const p = S.props(g, nE);
  chk(p.fn.I, I, 1e-3, 'inertie fissurée homogénéisée (M < 0, aciers inférieurs tendus)');
}
function sq(x) { return x * x; }
{ // inertie non fissurée homogénéisée d'un rectangle
  const g = S.rect({ b: 1, h: 1, nappes: [{ d: 0.1, As: 10 }, { d: 0.9, As: 10 }] });
  const p = S.props(g, 15), A = 1 + 15 * 20e-4, I = 1 / 12 + 15 * 20e-4 * 0.16;
  chk(p.A, A, 1e-9, 'aire homogénéisée'); chk(p.I, I, 1e-6, 'inertie homogénéisée non fissurée');
}
{ // section en T : table comprimée large = rectangle de largeur b si l'axe neutre reste dans la table
  const m = S.materiau({ regl: 'EC2', fck: 30, fyk: 500 });
  const gT = S.te({ b: 2, hf: 0.25, bw: 0.4, h: 1, nappes: [{ d: 0.93, As: 20 }] });
  const gR = S.rect({ b: 2, h: 1, nappes: [{ d: 0.93, As: 20 }] });
  chk(S.elu(gT, m, { N: 0, M: -10 }).MRd, S.elu(gR, m, { N: 0, M: -10 }).MRd, 1e-3, 'T à axe neutre dans la table ≡ rectangle b × h');
  const eT = S.els(gT, { Es: 2e5 }, { M: -400, n: 15 }), eR = S.els(gR, { Es: 2e5 }, { M: -400, n: 15 });
  chk(eT.sc, eR.sc, 1e-4, 'ELS T ≡ rectangle (x < hf)');
}
{ // section circulaire : compression centrée et symétrie
  const m = S.materiau({ regl: 'EC2', fck: 30, fyk: 500, palier: 'horizontal' });
  const g = S.cercle({ D: 1, a: 0.07, As: 49.1, nb: 16 });
  const it = S.interaction(g, m, 1, 20);
  chk(it.Nmax, (Math.PI / 4 * 20 + 49.1e-4 * 400) * 1000, 2e-3, 'cercle : Nmax = Ac fcd + As σs(εc2)');
  chk(S.elu(g, m, { N: 2000, M: 1 }).MRd, -S.elu(g, m, { N: 2000, M: -1 }).MRd, 1e-6, 'cercle : MRd+ = −MRd−');
  chk(S.elu(g, m, { N: 2000, M: 300, My: 400 }).Mt, 500, 1e-9, 'cercle : moment résultant √(Mx² + My²)');
}
{ // section quelconque rectangulaire ≡ section rectangulaire (fibres en grille)
  const m = S.materiau({ regl: 'EC2', fck: 30, fyk: 500 });
  const gR = S.rect({ b: 0.6, h: 1, nappes: [{ d: 0.06, As: 10 }, { d: 0.94, As: 30 }] });
  const gP = S.poly({ points: [[-0.3, -0.5], [0.3, -0.5], [0.3, 0.5], [-0.3, 0.5]], barres: [{ x: 0, y: 0.44, As: 10 }, { x: 0, y: -0.44, As: 30 }], grille: 80, ref: { x: 0, y: 0 } });
  chk(S.elu(gP, m, { N: 800, M: -300 }).MRd, -S.elu(gR, m, { N: 800, M: -300 }).MRd, 3e-3, 'quelconque ≡ rectangle (ELU, M seul)');
  const eP = S.els(gP, { Es: 2e5 }, { N: 300, M: -250, n: 15 }), eR = S.els(gR, { Es: 2e5 }, { N: 300, M: -250, n: 15 });
  chk(eP.sc, eR.sc, 2e-3, 'quelconque ≡ rectangle (ELS σc)');
  // flexion déviée d'une section carrée symétrique : résistance identique selon x et y
  const gQ = S.poly({ points: [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]], barres: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: 0.34 * a, y: 0.34 * b, As: 8 })), grille: 60 });
  chk(S.elu(gQ, m, { N: 1000, M: 100 }).MRd, S.elu(gQ, m, { N: 1000, My: 100 }).MRd, 2e-3, 'carré : MRd,x = MRd,y');
}
{ // effort tranchant EC2 §6.2.2 et 6.2.3 (formules littérales)
  const r = S.tranchantEC2({ bw: 0.4, h: 1, d: 0.9, z: 0.81, Asl: 30, N: 0, V: 600, fck: 30, fyk: 500, cot: 2.5 });
  const k = 1 + Math.sqrt(0.2 / 0.9), rho = 30e-4 / (0.4 * 0.9);
  chk(r.VRdc, Math.max(0.12 * k * Math.pow(100 * rho * 30, 1 / 3), 0.053 / 1.5 * k ** 1.5 * Math.sqrt(30)) * 0.4 * 0.9 * 1000, 1e-9, 'VRd,c');
  chk(r.VRdmax, 0.4 * 0.81 * 0.6 * (1 - 30 / 250) * 20 / (2.5 + 0.4) * 1000, 1e-9, 'VRd,max (cot θ = 2,5)');
  chk(r.Asw, 600 / (0.81 * 434.783 * 1000 * 2.5) * 1e4, 1e-6, 'Asw/s = VEd/(z fywd cot θ)');
  const l = S.tranchantEC2({ bw: 0.3, h: 0.8, d: 0.72, Asl: 20, V: 850, fck: 30, fyk: 500, cot: 'libre' });
  ok(l.cot < 2.5 && l.cot >= 1 && near(l.interaction, 1, 1e-6), 'cot θ libre : bielle juste saturée (cot θ = ' + l.cot.toFixed(3) + ')');
  const b = S.tranchantBAEL({ b0: 0.3, h: 0.8, d: 0.72, fc28: 25, fe: 500, V: 300, fissuration: 1 });
  chk(b.tauV, 300 / (0.3 * 0.72) / 1000, 1e-9, 'BAEL τu = Vu/(b0 d)');
  chk(b.AtSurB0, Math.max(1.15 * (b.tauV - 0.3 * 2.1) / (0.9 * 500), 0.4 / 500) * 1e4, 1e-9, 'BAEL At/(b0 st) (A.5.1.23)');
}
{ // second ordre : imperfection seule si λ ≤ λlim ; e0 minimum
  const m = S.materiau({ regl: 'EC2', fck: 30, fyk: 500 });
  const g = S.rect({ b: 1, h: 1, nappes: [{ d: 0.05, As: 20 }, { d: 0.95, As: 20 }] });
  const r = S.secondOrdre(g, m, { N: 1000, M: 0 }, { L: 4, lf: 4 });
  chk(Math.abs(r.M), 1000 * Math.max(1 / 30, 0.02), 1e-9, 'e0 = max(h/30 ; 20 mm)');
}
{ // lecture .don
  const txt = 'application ;\nBAEL91\nfcj ;\n32\nfe ;\n500\ntypecalculs ;\n3\nreglement ;\n1\nhtot ;\n0.84\nb0 ;\n1\nhutilesup ;\n0.09\nhutileinf ;\n0.752\nassup ;\n0.002\nasinf ;\n0.002\nELS ; 1\n-361.6 0 -218.04 0\nELU ; 1\n-580.2 -348.1 0 0 0 1\n';
  const D = S.donVersDonnees(txt);
  ok(D.forme === 'rect' && D.mode === 'dim' && D.regl === 'EC2' && D.section.h === 0.84 && D.section.nappes[1].As === 20 && D.elu[0].M === -580.2 && D.els[0].Mqp === -218.04, 'lecture d’un .don (section rectangulaire)');
}

/* ═════════════ 2. CAS DE RÉFÉRENCE (anciens exemples) ═════════════ */
console.log('— Cas de référence');
{ // S1_verif (EC2, rectangle 1,00 × 0,84, As inf 18,85 cm², φ = 1,21)
  const m = S.materiau({ regl: 'EC2', fck: 32, fyk: 500, phi: 1.21 });
  const g = S.rect({ b: 1, h: 0.84, nappes: [{ d: 0.09, As: 0 }, { d: 0.752, As: 18.85 }] });
  chk(S.elu(g, m, { N: 0, M: -580.2 }).MRd, -641.85, 1e-3, 'S1_verif MRd');
  let nE = S.nEff(m, -361.6, -218.04); chk(nE, 10.37, 1e-3, 'S1_verif n effectif comb. 1');
  let e = S.els(g, m, { M: -361.6, n: nE }); chk(e.ss[1], -273.66, 1e-3, 'S1_verif σs comb. 1'); chk(e.sc, 6.74, 2e-3, 'S1_verif σc comb. 1');
  nE = S.nEff(m, -218.1, -218.1); e = S.els(g, m, { M: -218.1, n: nE });
  chk(e.ss[1], -166.44, 1e-3, 'S1_verif σs fréquente'); chk(e.x, 0.170, 5e-3, 'S1_verif hauteur comprimée');
  const w = S.wk(g, m, e, { c: 78, phi: 20, s: 167, wmax: 0.2 });
  chk(w.rho, 0.008568, 1e-3, 'S1_verif ρp,eff'); chk(w.sr, 521.0, 2e-3, 'S1_verif sr,max'); chk(w.wk, 0.260, 5e-3, 'S1_verif wk');
}
{ // S1 (EC2, détermination) : aciers ELU 17,0 cm² ; ELS 12,75 ; wk → 21,98 cm² ; tranchant VRd,c 291,45 kN, Asw/s 9,05 cm²/m, ΔFtd 16,5 kN
  const R = S.calcul({ regl: 'EC2', forme: 'rect', mode: 'dim', materiau: { fck: 32, fyk: 500, phi: 1.21 }, section: { b: 1, h: 0.84, nappes: [{ d: 0.09, As: 0 }, { d: 0.752, As: 0 }] },
    elu: [{ M: -580.2, Mcp: -348.12, N: 0, type: 1 }, { M: 0, N: 81.7, V: 33, type: 1 }], els: [{ M: -361.6, N: 0, Mqp: -218.0448, type: 0 }, { M: -218.1, N: 0, Mqp: -218.1, type: 2 }],
    options: { L: 10, lf: 10, wkCalcul: true, wkType: 2, wmax: 0.2, cot: 1, fissu: { sup: { c: 78, phi: 20, s: 167 }, inf: { c: 78, phi: 20, s: 167 } } } });
  chk(R.dim.req.elu[1], 16.98, 2e-3, 'S1 As ELU inférieurs');
  chk(R.dim.As[1], 21.98, 2e-3, 'S1 As retenus (ouverture des fissures)');
  chk(R.cis[0].VRdc, 291.45, 1e-3, 'S1 VRd,c'); chk(R.cis[0].Asw, 9.05, 2e-3, 'S1 Asw/s'); chk(R.cis[0].dFtd, 16.5, 1e-3, 'S1 ΔFtd');
}
{ // S2_verif (EC2, As sup 24,18 cm², M > 0)
  const m = S.materiau({ regl: 'EC2', fck: 32, fyk: 500, phi: 1.42 });
  const g = S.rect({ b: 1, h: 0.97, nappes: [{ d: 0.067, As: 24.18 }, { d: 0.903, As: 0 }] });
  chk(S.elu(g, m, { N: 0, M: 772.1 }).MRd, 986.69, 1e-3, 'S2_verif MRd');
  const nE = S.nEff(m, 396.9, 396.9), e = S.els(g, m, { M: 396.9, n: nE });
  chk(nE, 14.51, 1e-3, 'S2_verif n fréquent'); chk(e.ss[0], -197.77, 1e-3, 'S2_verif σs'); chk(e.sc, 4.37, 3e-3, 'S2_verif σc');
  const w = S.wk(g, m, e, { c: 55, phi: 22.8, s: 167, wmax: 0.2 }); chk(w.wk, 0.225, 5e-3, 'S2_verif wk'); chk(w.sr, 378.8, 2e-3, 'S2_verif sr,max');
}
{ // S4_verif (EC2, flexion composée N > 0)
  const m = S.materiau({ regl: 'EC2', fck: 32, fyk: 500, phi: 1.51 });
  const g = S.rect({ b: 1, h: 0.85, nappes: [{ d: 0.087, As: 9.24 }, { d: 0.763, As: 3 }] });
  chk(S.elu(g, m, { N: 394.9, M: 364.94 }).MRd, 485.47, 1e-3, 'S4_verif MRd comb. 3 (N = 394,9 kN)');
  chk(S.elu(g, m, { N: 280.2, M: 6.98 }).MRd, 441.81, 1e-3, 'S4_verif MRd comb. 4');
  const sec = S.secondOrdre(g, m, { N: 280.2, M: 0 }, { L: 6.21, lf: 3.1, ea: 'forfait' }); chk(sec.M, 6.98, 5e-3, 'S4_verif excentricité additionnelle ea = max(2 cm ; L/250) (option de l’ancien programme)');
  chk(S.secondOrdre(g, m, { N: 394.9, M: 355.1 }, { L: 6.21, lf: 3.1, ea: 'forfait' }).M, 364.94, 1e-3, 'S4_verif MEd comb. 3 avec ea');
  let nE = S.nEff(m, 237.1, 179.295), e = S.els(g, m, { N: 423.7, M: 237.1, n: nE });
  chk(e.ss[0], -141.22, 1e-3, 'S4_verif σs sup comb. 1'); chk(e.ss[1], 37.73, 1e-3, 'S4_verif σs inf comb. 1'); chk(e.sc, 4.73, 3e-3, 'S4_verif σc comb. 1');
  nE = S.nEff(m, 179.3, 179.3); e = S.els(g, m, { N: 352.9, M: 179.3, n: nE }); chk(e.ss[0], -96.04, 1e-3, 'S4_verif σs fréquente');
  // l'ancien programme prend hc,ef = 2,5 (h − d) sans le terme (h − x)/3 en flexion composée : écart de 8 % sur wk avec la règle complète
  const w1 = S.wk(g, m, e, { c: 80, phi: 14, s: 167, wmax: 0.2, xDansHceff: false });
  chk(w1.Aceff, 0.217, 3e-3, 'S4_verif Ac,eff (option hc,ef = 2,5 (h − d))'); chk(w1.wk, 0.198, 5e-3, 'S4_verif wk (même option)');
  const w2 = S.wk(g, m, e, { c: 80, phi: 14, s: 167, wmax: 0.2 }); ok(w2.wk < w1.wk, 'S4_verif wk EC2 complet (hc,ef ≤ (h − x)/3) : ' + w2.wk.toFixed(3) + ' mm ≤ 0,198');
}
{ // RectVerif (BAEL + Livret 2.01, 1,00 × 2,00, 20/20 cm²)
  const m = S.materiau({ regl: 'BAEL', fck: 28, fyk: 500, livret: true, fissuration: 1 });
  const g = S.rect({ b: 1, h: 2, nappes: [{ d: 0.06, As: 20 }, { d: 1.94, As: 20 }] });
  chk(m.ssLim, 250, 1e-9, 'RectVerif σs limite fissuration préjudiciable');
  const e = S.els(g, m, { N: -20, M: 100, n: 15 });
  chk(e.ss[0], -31.80, 1e-3, 'RectVerif σs sup'); chk(e.ss[1], 3.42, 3e-3, 'RectVerif σs inf'); chk(e.sc, 0.30, 2e-2, 'RectVerif σc');
  chk(S.elu(g, m, { N: 200, M: 1014.05, type: 3 }).MRd, 1507.93, 1e-3, 'RectVerif MRd (< 1 h)');
  const it = S.interaction(g, m, 1, 60); chk(it.Nmin, -1391.3, 1e-4, 'RectVerif Nmin'); chk(it.Nmax, 33124.6, 1e-4, 'RectVerif Nmax');
  const tab = [[1, 0, 1318.3], [1, 15866.7, 9021.6], [1, 29673.0, 2562.6], [2, 0, 1319.6], [2, 17629.6, 9878.7], [3, 18666.7, 10382.9], [4, 0, 1896.2], [4, 21533.0, 13627.7], [5, 21338.5, 12203.5]];
  for (const [t, N, M] of tab) chk(S.MRdAt(g, m, t, N).pos, M, 1.5e-3, `RectVerif interaction type ${t}, N = ${N}`);
}
{ // T_Verif (BAEL, section en T à 5 nappes)
  const m = S.materiau({ regl: 'BAEL', fck: 25, fyk: 500, fissuration: 1 });
  const g = S.te({ b: 1, hf: 0.25, bw: 0.4, h: 1, nappes: [0.07, 0.1, 0.8, 0.9, 0.93].map((d) => ({ d, As: 10 })) });
  let e = S.els(g, m, { M: 385, n: 15 }); chk(e.sc, 6.18, 3e-3, 'T_Verif σc (M = 385)'); chk(e.ss[0], -238.88, 1e-3, 'T_Verif σs nappe 1'); chk(e.ss[1], -228.18, 1e-3, 'T_Verif σs nappe 2');
  e = S.els(g, m, { M: -535, n: 15 }); chk(e.ss[2], -195.40, 1e-3, 'T_Verif σs nappe 3'); chk(e.ss[4], -239.53, 1e-3, 'T_Verif σs nappe 5');
  const ref = { 1: [-1074.84, 750.95], 2: [-1078.55, 754.47], 3: [-1080.55, 756.41], 4: [-1247.69, 871.93], 5: [-1242.89, 866.95] };
  for (const t of [1, 2, 3, 4, 5]) { const q = S.MRdAt(g, m, t, 0); chk(q.neg, ref[t][0], 1e-3, `T_Verif MRd− type ${t}`); chk(q.pos, ref[t][1], 1e-3, `T_Verif MRd+ type ${t}`); }
}
{ // RectFC (BAEL, détermination, fissuration peu préjudiciable) : As inf 13,6 cm² à l'ELU ; As sup 1,95 cm² pour σbc ≤ 15 MPa
  const R = S.calcul({ regl: 'BAEL', forme: 'rect', mode: 'dim', materiau: { fck: 25, fyk: 500, fissuration: 0 }, section: { b: 0.18, h: 0.6, nappes: [{ d: 0.03, As: 0 }, { d: 0.55, As: 0 }] },
    elu: [{ M: -256.9, N: 0, type: 1 }], els: [{ M: -175.96, N: 0 }], options: { n: 15, L: 10, lf: 10 } });
  chk(R.dim.req.elu[1], 13.6, 1.5e-2, 'RectFC As ELU (écart : diagramme parabole-rectangle complet au lieu du rectangle 0,8 y)');
  chk(R.dim.req.els[0], 1.95, 8e-2, 'RectFC As sup. comprimés pour σbc (écart dû à l’As inf retenu)');
  const m = S.materiau({ regl: 'BAEL', fck: 25, fyk: 500, diagramme: 'rect' });
  const dm = S.dimELU2({ b: 0.18, h: 0.6, nappes: [{ d: 0.03, As: 0 }, { d: 0.55, As: 0 }] }, S.rect({ b: 0.18, h: 0.6, nappes: [{ d: 0.03, As: 0 }, { d: 0.55, As: 0 }] }), m, { N: 0, M: -256.9, type: 1 });
  chk(dm.As[1], 13.6, 4e-3, 'RectFC As ELU avec le diagramme rectangulaire BAEL (0,8 y)');
}
{ // Pieu_EC2_verif (pieu foré D = 0,76 m, 20 barres, 25,12 cm², fc* = 20,83 MPa)
  const m = S.materiau({ regl: 'EC2', fck: 28, fyk: 500, phi: 1.8, pieu: { actif: true, k1: 1.2, k2: 1, fclim: 25 } });
  chk(m.fc, 20.83, 1e-3, 'Pieu fc* = min(fck ; 25)/1,2'); chk(S.lois(m, 1).fc, 13.89, 1e-3, 'Pieu fcd'); chk(m.sbc, 12.5, 1e-3, 'Pieu σc limite'); chk(m.smoyLim, 6.25, 1e-3, 'Pieu σ moyenne limite');
  const g = S.cercle({ D: 0.76, a: 0.065, As: 25.12, nb: 20 });
  for (const [N, M, ref] of [[1971.4, 59.2, 641.01], [884.7, 399, 509.66], [2194.1, 22.6, 655.25], [622.9, 391.8, 462.66], [601, 411.8, 458.45]]) chk(S.elu(g, m, { N, M }).MRd, ref, 2.5e-3, `Pieu MRd (N = ${N})`);
  for (const [M, N, Mq, ss, sc, x, nref] of [[196, 768, 147, -80.88, 7.20, 0.404, 15.55], [260, 1527, 195, -37.40, 9.08, 0.549, 15.55], [209, 864, 209, -84.40, 7.31, 0.428, 18.53]]) {
    const nE = S.nEff(m, M, Mq), e = S.els(g, m, { N, M, n: nE });
    chk(nE, nref, 1e-3, `Pieu n (M = ${M})`); chk(e.ssMin, ss, 2e-3, `Pieu σs (M = ${M})`); chk(e.sc, sc, 3e-3, `Pieu σc (M = ${M})`); chk(e.x, x, 1e-2, `Pieu hauteur comprimée (M = ${M})`);
  }
  const e = S.els(g, m, { N: 864, M: 209, n: S.nEff(m, 209, 209) }), w = S.wk(g, m, e, { c: 75, phi: 20, s: 233, wmax: 0.3 });
  chk(w.wk, 0.141, 5e-2, 'Pieu wk (couronne tendue 2,5 a : écart de 4 % sur Ac,eff)');
}
{ // Pieu_EC2 (détermination) : ELU 20,59 cm² ; minimum pieu 22,68 cm² (0,5 % Ac) ; Asw/s 14,43 cm²/m ; ΔFtd 135,55 kN ; VRd,max 1018,6 kN
  const R = S.calcul({ regl: 'EC2', forme: 'cercle', mode: 'dim', materiau: { fck: 28, fyk: 500, phi: 1.8 }, section: { D: 0.76, a: 0.065, As: 0, nb: 20 },
    elu: [[59.2, 1971.4], [399, 884.7], [22.6, 2194.1], [391.8, 622.9], [47.3, 1947.3], [419.1, 862.8, 271.1], [32.2, 2162.5], [411.8, 601]].map(([M, N, V]) => ({ M, N, V: V || 0, Mcp: M, type: 1 })),
    els: [{ M: 196, N: 768, Mqp: 147 }, { M: 260, N: 1527, Mqp: 195 }, { M: 209, N: 864, Mqp: 209, type: 2 }],
    options: { pieu: { actif: true, k1: 1.2, k2: 1, fclim: 25 }, L: 10, lf: 10, wkCalcul: true, wkType: 2, wmax: 0.3, cot: 1, fissu: { sup: { c: 75, phi: 20, s: 233 } } } });
  chk(R.dim.req.elu[0], 20.59, 2e-3, 'Pieu_EC2 As ELU'); chk(R.dim.As[0], 22.68, 1e-3, 'Pieu_EC2 As retenu (minimum des pieux)');
  const c = R.cis[0]; chk(c.Asw, 14.43, 2e-3, 'Pieu_EC2 Asw/s (b0 = D/1,4)'); chk(c.dFtd, 135.55, 1e-3, 'Pieu_EC2 ΔFtd'); chk(c.VRdmax, 1018.6, 1e-3, 'Pieu_EC2 VRd,max');
}
{ // RectFD (BAEL + Livret 2.01, section quelconque 2,82 × 0,60, flexion déviée ELS et ELU)
  const m = S.materiau({ regl: 'BAEL', fck: 32, fyk: 500, livret: true, fissuration: 1 });
  const g = S.poly({ points: [[-1.41, 0.29999], [1.41, 0.29999], [1.41, -0.29999], [-1.41, -0.29999]], nappes: [{ n: 19, As: 0.94, x1: -1.335, y1: 0.224991, x2: 1.335, y2: 0.224991 }, { n: 19, As: 0.94, x1: 1.335, y1: -0.224991, x2: -1.335, y2: -0.224991 }], grille: 40 });
  const e = S.els(g, m, { N: 780, M: 392, My: 55, n: 15 });
  chk(e.ss[0], -234.02, 2e-3, 'RectFD σs barre 1'); chk(e.ss[18], -226.60, 2e-3, 'RectFD σs barre 19'); chk(e.ss[19], 43.30, 2e-3, 'RectFD σs barre 20');
  chk(e.sc, 5.90, 2e-3, 'RectFD σc maxi'); chk(e.Ac, 0.3965, 2e-3, 'RectFD aire de béton comprimé');
  const r = S.elu(g, m, { N: 1050.4, M: 568, My: 74, type: 3 }); ok(r.ok, 'RectFD ELU < 1 h vérifié (taux ' + r.ratio.toFixed(3) + ')');
}

console.log(`\n${n - fails}/${n} vérifications réussies`);
process.exit(fails ? 1 : 0);
