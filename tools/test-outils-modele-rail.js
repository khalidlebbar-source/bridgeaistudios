/* MODELPRA — tests du moteur (node tools/test-outils-modele-rail.js).
 * 1. cas analytiques indépendants ; 2. cas de référence chiffrés relevés dans les fichiers de résultats
 * d'origine (exemples MODELPRA générés par APPUI : ProC0Sup, PraC0FixeSup, PRaC0Mobile). Seules les valeurs
 * numériques attendues sont reprises ; les données d'entrée sont ressaisies ci-dessous. */
const MP = require('../outils/js/modele-rail.js');
const C = require('../outils/js/charges.js');
let f = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const near = (a, b, t = 1e-3) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));
const fx = (x, d = 3) => (+x).toFixed(d);
const R = (M, v, m) => MP.appuisVals(M, v, m);

/* ── jeux de données : géométries des exemples d'origine (portiques à 2 travées, piédroits encastrés) ── */
const mat = { mode: 'saisie', Ei: 34922823, Ed: 11640941, gamma: 25 };
const sansAct = { superstructures: 0, ballast: 0, retrait: 0, denivAppui: 0, denivCulees: 0, tLD: { con: 0, dil: 0 }, tCD: { con: 0, dil: 0 }, gradient: { chaud: 0, froid: 0 }, qvent: 0 };
const pied = (h, A, I, Ab, Ib, kyT) => ({ type: 'piedroit', h, A, I, Ab, Ib, base: 'encastre', kyT });
function exemple(o) {
  const p = MP.defauts();
  Object.assign(p, { travees: o.L, consoleDeb: o.c, consoleFin: o.c, nbElTrav: 10, materiau: mat, tablier: { mode: 'dalle', b: o.b, h: o.h, Sreel: o.S, goussets: [] },
    nbElPied: o.nb, actions: sansAct, rail: Object.assign(p.rail, { uic: false, sw0: false }), quelconques: o.q || [] });
  p.appuis = [0, 1, 2].map(() => pied(o.hp, o.A, o.I, o.Ab, o.Ib, o.kyT));
  p.seisme.actif = false;
  return p;
}
// ProC0Sup : 2 × 2,77 m, consoles 1,445 m, dalle 1,25 × 1,00, S réelle 1,2884 m², piédroits Ø0,70 h = 7,781 m
const PRO = exemple({ L: [2.77, 2.77], c: 1.445, b: 1.25, h: 1.0, S: 1.2884, hp: 7.781429, A: 0.384845, I: 0.011786, Ab: 0.384845, Ib: 0.011786, nb: 6, kyT: 4566.766252 });
// PraC0FixeSup : 2 × 4,373 m, consoles 1,95305 m, dalle 1,30 × 1,45, piédroits à section variable
const FIX = exemple({ L: [4.373, 4.373], c: 1.95305, b: 1.3, h: 1.45, S: 2.044973, hp: 6.727, A: 1.283334, I: 0.145563, Ab: 5.250002, Ib: 0.595487, nb: 11, kyT: 761347.349234 });
// PRaC0Mobile : 2 × 4,482 m, consoles 2,226672 m, charges ponctuelles de 100 kN en x = 2,982 et 3,417 m
const MOB = exemple({ L: [4.482, 4.482], c: 2.226672, b: 1.3, h: 1.45, S: 2.1775, hp: 5.379, A: 1.026666, I: 0.074528, Ab: 2.146666, Ib: 0.155832, nb: 11, kyT: 289711.986062,
  q: [{ cat: 'G', x1: 2.982, q1: 100 }, { cat: 'G', x1: 3.417, q1: 100 }] }); // abscisses comptées depuis le premier appui

console.log('— Cas analytiques —');
{ // poutre continue 2 travées sur appuis simples, 1 kN/ml : R centrale = 1,25 qL ; M appui = −qL²/8
  const p = MP.defauts(); Object.assign(p, { travees: [10, 10], consoleDeb: 0, consoleFin: 0, nbElTrav: 20, actions: sansAct });
  p.appuis = [{ type: 'simple', fixe: true }, { type: 'simple' }, { type: 'simple' }]; p.tablier = { mode: 'dalle', b: 1, h: 1, goussets: [] };
  p.seisme.actif = false; p.trans.actif = false; p.rail.uic = true; p.rail.sw0 = false; p.rail.Lphi = 20; p.rail.alpha = 1; p.rail.freinage = false;
  const M = MP.genere(p), r = MP.calcule(M);
  const ra = R(M, r.unit.v1LD.v);
  ok(near(ra[1].Ry, 12.5, 1e-6) && near(ra[0].Ry, 3.75, 1e-6), 'poutre continue 2 × 10 m : R = 3,75 / 12,5 / 3,75 kN (' + ra.map((a) => fx(a.Ry)).join(' / ') + ')');
  const s = MP.sectionsTablier(M, r.unit.v1LD.v).find((o) => Math.abs(o.x - 10) < 1e-9);
  ok(near(s.M, -12.5, 1e-6), 'moment sur appui −qL²/8 = −12,5 kN·m (' + fx(s.M) + ')');
  // dénivellation δ de l'appui central : M = 3EIδ/L² (signe : appui qui descend → moment positif sur appui)
  const EI = M.mod.Ed / 12, d = MP.sectionsTablier(M, r.unit.tass[1].v).find((o) => Math.abs(o.x - 10) < 1e-9);
  ok(near(d.M, 3 * EI * 1 / 100, 1e-6), 'tassement unité de l’appui central : M = 3EIδ/L² (' + fx(d.M, 0) + ')');
  // gradient thermique ΔT = 1 °C : courbure κ = α ΔT / h, M sur appui central = 1,5 EI κ
  const g = MP.sectionsTablier(M, r.unit.grad.v, M.long.CD).find((o) => Math.abs(o.x - 10) < 1e-9);
  ok(near(g.M, 1.5 * M.mod.Ei / 12 * 1e-5, 1e-6), 'gradient +1 °C : M appui = 1,5 EI α ΔT / h (' + fx(g.M) + ')');
  // allongement libre (un seul appui fixe) : aucun effort
  ok(Math.max(...r.unit.eLD.v.slice(0, 6 * M.long.LD.elems.length).map(Math.abs)) < 1e-6, 'dilatation libre : aucun effort');
  // modules BAEL : Ei = 11 000 fcj^(1/3), Ed = Ei/3
  ok(near(MP.modules({ mode: 'BAEL', fck: 32, phi: 2 }).Ei, 34922823, 1e-6) && near(MP.modules({ mode: 'BAEL', fck: 32, phi: 2 }).Ed, 11640941, 1e-6), 'modules BAEL fcj = 32 MPa : Ei = 34 922 823 kPa, Ed = 11 640 941 kPa');
}
{ // UIC 71 et SW/2 sur une travée isostatique de 20 m (ligne d'influence de M à mi-portée), Φ imposé = 1
  const p = MP.defauts(); Object.assign(p, { travees: [20], consoleDeb: 0, consoleFin: 0, nbElTrav: 20, actions: sansAct });
  p.appuis = [{ type: 'simple', fixe: true }, { type: 'simple' }]; p.tablier = { mode: 'dalle', b: 1, h: 1, goussets: [] };
  p.seisme.actif = false; p.trans.actif = false; Object.assign(p.rail, { uic: true, sw0: true, sw2: true, Lphi: 0, alpha: 1.33, pas: 0.05, freinage: true, kFrein: 1 });
  const M = MP.genere(p), E = MP.enveloppesFerroviaires(M);
  const L = E.layout, e = 9, k = 6 * e + 5; // extrémité j de l'élément 10 = mi-portée
  const phi = C.phi2(20);
  ok(near(E.phi, phi, 1e-9) && near(E.Lphi, 20, 1e-9), 'Φ2 pour LΦ = L = 20 m : ' + fx(phi, 4));
  ok(near(E.env.UIC71.max[k], 1.33 * phi * 6075.2, 1e-4), 'UIC 71 α = 1,33 : M mi-portée = α Φ × 6075,2 (' + fx(E.env.UIC71.max[k], 1) + ')');
  ok(near(E.env['SW/2'].max[k], phi * 7500, 1e-4), 'SW/2 : M = Φ × 150 × 50 (' + fx(E.env['SW/2'].max[k], 1) + ')');
  ok(near(E.env.UIC71.cMax[k][2], E.env.UIC71.max[k], 1e-9), 'effort concomitant : le schéma retenu redonne le maximum');
  const kr = L.offA + 1;
  // réaction d'appui : 1er essieu sur l'appui, 4 × 250 kN + 80 kN/m au-delà de la zone de 6,40 m
  const Rref = 250 * (1 + 0.92 + 0.84 + 0.76) + 80 * 14.4 * 14.4 / 40;
  ok(near(E.env.UIC71.max[kr], 1.33 * phi * Rref, 1e-4), 'réaction d’appui UIC 71 = α Φ × 1294,72 kN (' + fx(E.env.UIC71.max[kr], 1) + ')');
  ok(near(E.frein.uic, 33 * 1.33, 1e-9), 'démarrage LM71 : 33 kN/m × α (EN 1991-2 §6.5.3)');
}
{ // séisme : spectre de l'AN française, zone 3 (agr = 1,1 m/s²), sol B, γI = 1 : plateau = ag S η 2,5
  const sp = MP.spectre({ zone: 3, sol: 'B', classe: 'II', xi: 5 });
  ok(near(sp.Se(0.2), 1.1 * 1.35 * 2.5, 1e-9) && sp.TB === 0.05 && sp.TC === 0.25 && sp.TD === 2.5, 'spectre élastique zone 3, sol B : plateau 3,7125 m/s², TB = 0,05, TC = 0,25, TD = 2,5');
  ok(near(sp.Se(1.0), 3.7125 * 0.25, 1e-9) && near(sp.Sd(1.0, 1.5), 1.1 * 1.35 * 2.5 / 1.5 * 0.25, 1e-9), 'branche TC–TD et spectre de calcul q = 1,5');
  ok(near(MP.spectre({ zone: 4, sol: 'A', classe: 'III' }).ag, 1.6 * 1.2, 1e-9), 'zone 4, classe III : ag = γI agr = 1,92 m/s²');
  ok(near(sp.Sve(0.1), 0.45 * 1.1 * 3, 1e-9), 'spectre vertical : avg = 0,45 ag, plateau 3 avg');
  // portique 1 travée, traverse très rigide, piédroits encastrés : T = 2π √(m / (2 × 12 EI / H³))
  const p = MP.defauts(); Object.assign(p, { travees: [10], consoleDeb: 0, consoleFin: 0, nbElTrav: 10, actions: sansAct, nbElPied: 8 });
  p.tablier = { mode: 'section', b: 1, h: 1, A: 1e3, I: 1e4, It: 1e4, Sreel: 2, goussets: [] };
  p.appuis = [pied(6, 0.5, 0.01, 0, 0, 0), pied(6, 0.5, 0.01, 0, 0, 0)];
  p.materiau = { mode: 'saisie', Ei: 3e7, Ed: 1e7, gamma: 25 };
  Object.assign(p.seisme, { actif: true, massesAppuis: false, vertical: false, zone: 3, sol: 'B', q: 1 });
  p.rail.uic = false; p.rail.sw0 = false; p.trans.actif = false;
  const M = MP.genere(p), r = MP.calcule(M);
  const H = 6 + MP.sectionTablier(p, 0).h / 2, K = 2 * 12 * 3e7 * 0.01 / Math.pow(H, 3), m = 2 * 25 * 10 / 9.81;
  const T = 2 * Math.PI * Math.sqrt(m / K), md = r.sis.long.modes[0];
  ok(near(md.T, T, 2e-3) && md.ratio > 0.99, 'mode fondamental (analyse modale) : T = ' + fx(md.T, 4) + ' s, attendu 2π√(m/K) = ' + fx(T, 4) + ' s');
  const ra = R(M, r.sis.Elong, M.long.SIS);
  ok(near(ra[0].Rx + ra[1].Rx, m * sp.Se(md.T), 2e-3), 'effort tranchant sismique total = m Se(T) = ' + fx(m * sp.Se(md.T), 1) + ' kN');
  p.seisme.methode = 'fondamental'; const r2 = MP.calcule(MP.genere(p));
  ok(near(r2.sis.long.T, T, 2e-3), 'méthode du mode fondamental (Rayleigh) : T = ' + fx(r2.sis.long.T, 4) + ' s');
  const J = MP.jacobi([[2, 1], [1, 2]]).val.sort();
  ok(near(J[0], 1, 1e-12) && near(J[1], 3, 1e-12), 'valeurs propres (Jacobi) d’une matrice 2 × 2');
}
{ // combinaison ELU sans action variable : 1,35 G (effet défavorable) ou 1,00 G
  const p = Object.assign(MP.defauts(), { actions: sansAct }); p.seisme.actif = false; p.rail.uic = false; p.rail.sw0 = false;
  const M = MP.genere(p), r = MP.calcule(M), ra = R(M, r.comb.ELU.max), rg = R(M, r.cas.G1);
  ok(near(ra[1].Ry, 1.35 * rg[1].Ry, 1e-9), 'ELU fondamental : Ry = 1,35 G (' + fx(ra[1].Ry, 1) + ' kN)');
  ok(near(R(M, r.comb.QP.max)[1].Ry, rg[1].Ry, 1e-9), 'ELS quasi-permanent = G');
}
{ // radier sur sol élastique : la somme des réactions du sol équilibre le poids total
  const p = MP.defauts(); p.radier = { actif: true, e: 0.8, b: 1, kv: 30000 }; p.seisme.actif = false; p.rail.uic = false; p.rail.sw0 = false; p.trans.actif = false;
  const M = MP.genere(p), u = MP.calcule(M, { sansRail: true }).unit.pp;
  const W = M.poidsDeck.reduce((s, w, k) => s + w * M.deckEl[k].L, 0) + M.long.LD.nodalPP.reduce((s, o) => s - o.Fy, 0);
  ok(near(u.r.reac.reduce((s, x) => s + x.Ry, 0), W, 1e-9), 'radier sur ressorts : Σ réactions du sol = poids total ' + fx(W, 1) + ' kN');
}

console.log('— Cas de référence (fichiers de résultats d’origine) —');
{ // ProC0Sup, modèle longitudinal longue durée (E = 11 640 941 kPa), 41 nœuds, 40 barres
  const M = MP.genere(PRO), r = MP.calcule(M, { sansRail: true }), u = r.unit;
  ok(M.long.LD.nodes.length === 41 && M.long.LD.elems.length === 40, 'ProC0Sup : modèle de 41 nœuds et 40 barres identique à l’original');
  let a = R(M, u.pp.v);
  ok(near(a[0].Ry, 169.002) && near(a[1].Ry, 158.1245) && near(a[0].Mz, 0.585, 2e-3) && near(a[0].Rx, -0.212, 2e-3), 'ProC0Sup poids propre : R = 169,002 / 158,124 kN, M pied 0,585 (' + fx(a[0].Ry) + ' / ' + fx(a[1].Ry) + ' / ' + fx(a[0].Mz) + ')');
  a = R(M, u.v1LD.v);
  ok(near(a[0].Ry, 2.9226) && near(a[1].Ry, 2.5849) && near(a[0].Mz, 0.0182, 5e-3), 'ProC0Sup 1 kN/ml vertical : R = 2,9226 / 2,5849 (' + fx(a[0].Ry, 4) + ' / ' + fx(a[1].Ry, 4) + ')');
  a = R(M, u.h1LD.v);
  ok(near(a[0].Rx, -2.7849) && near(a[1].Rx, -2.86) && near(a[0].Ry, -6.2246) && near(a[0].Mz, 11.7066) && near(a[1].Mz, 11.9139), 'ProC0Sup 1 kN/ml horizontal : Rx = −2,785 / −2,860, M pied = 11,707 / 11,914 (' + fx(a[0].Mz) + ' / ' + fx(a[1].Mz) + ')');
  a = R(M, u.eLD.v.map((x) => -x)); // cas d'origine : raccourcissement unitaire 1e-5
  ok(near(a[0].Rx, -0.0752, 2e-3) && near(a[0].Ry, -0.0845, 2e-3) && near(a[1].Ry, 0.169, 2e-3) && near(a[0].Mz, 0.3183, 2e-3), 'ProC0Sup retrait unitaire 1e-5 : Rx = −0,0752, Ry = −0,0845 / 0,169, M = 0,3183');
  const s = MP.sectionsTablier(M, u.pp.v);
  // fichier d'origine : efforts d'extrémité de barre (Mi = 32,457) ; ici moment interne (négatif = fibre supérieure tendue)
  ok(near(s[2].M, -32.457, 1e-3) && near(s[2].V, 47.592, 1e-3), 'ProC0Sup poids propre : M = −32,457 kN·m et V = 47,592 kN au droit de l’appui 1 (' + fx(s[2].M) + ', ' + fx(s[2].V) + ')');
  // modèle sismique longitudinal (E instantané) sous 10 kN/ml horizontal
  const h10 = u.h1CD.v.map((x) => 10 * x); a = R(M, h10, M.long.CD);
  ok(near(a[0].Rx, -27.8493, 1e-3) && near(a[1].Rx, -28.6001, 1e-3) && near(a[0].Mz, 117.066, 1e-3) && near(a[1].Mz, 119.1393, 1e-3), 'ProC0Sup séisme longitudinal 10 kN/ml : Rx = −27,85 / −28,60, M pied = 117,07 / 119,14');
  const dx = u.h1CD.r.U[3 * 1] * 10;
  ok(near(dx, 0.003347, 1e-3), 'ProC0Sup séisme longitudinal : déplacement du tablier 3,347 mm (' + fx(dx * 1000, 4) + ' mm)');
  // période déduite de la raideur d'origine : K = 10 × 8,43 / 0,003347, m = 25 × 1,2884 × 8,43 / 9,81
  const p2 = JSON.parse(JSON.stringify(PRO)); Object.assign(p2.seisme, { actif: true, massesAppuis: false, vertical: false, methode: 'modal', zone: 3, sol: 'B' }); p2.trans.actif = false;
  const r2 = MP.calcule(MP.genere(p2), { sansRail: true });
  const Tref = 2 * Math.PI * Math.sqrt((25 * 1.2884 * 8.43 / 9.81) / (10 * 8.43 / 0.003347));
  ok(near(r2.sis.long.modes[0].T, Tref, 2e-3), 'ProC0Sup : période longitudinale ' + fx(r2.sis.long.modes[0].T, 4) + ' s = période déduite de la raideur d’origine ' + fx(Tref, 4) + ' s');
  // modèle transversal (courte durée) sous 1 kN/ml : ressorts KY = 4566,77 kN/m
  const T = r.trans, L = T.layout, ry = T.modele.appuis.map((x, k) => T.unit[L.offA + 3 * k + 1]);
  ok(near(ry[0], -2.8105, 1e-3) && near(ry[1], -2.8091, 1e-3) && near(T.unit[L.offD], 0.0006158, 2e-3), 'ProC0Sup transversal 1 kN/ml : R = −2,8105 / −2,8091 kN, déplacement 0,6158 mm');
}
{ // PraC0FixeSup : piédroits à section variable (1,28 → 5,25 m²), 11 éléments par piédroit
  const M = MP.genere(FIX), u = MP.calcule(M, { sansRail: true }).unit;
  let a = R(M, u.pp.v);
  ok(near(a[0].Ry, 764.9419) && near(a[1].Ry, 765.0621) && near(a[0].Mz, 3.0544, 2e-3), 'PraC0FixeSup poids propre : R = 764,94 / 765,06 kN, M pied 3,054 (' + fx(a[0].Ry) + ' / ' + fx(a[1].Ry) + ')');
  a = R(M, u.v1LD.v);
  ok(near(a[0].Ry, 4.2166) && near(a[1].Ry, 4.2189), 'PraC0FixeSup 1 kN/ml vertical : R = 4,2166 / 4,2189');
  a = R(M, u.h1LD.v);
  // l'original donne 19,6424 / 19,6797 aux deux culées (dissymétrie numérique du solveur d'origine) : on compare à la moyenne
  ok(near(a[1].Mz, 21.6409) && near(a[0].Mz, (19.6424 + 19.6797) / 2, 1e-3) && near(a[1].Rx, -4.6551), 'PraC0FixeSup 1 kN/ml horizontal : M pied = 19,661 (moyenne des deux culées) / 21,641');
  a = R(M, u.eLD.v.map((x) => -x));
  ok(near(a[0].Rx, -3.7373) && near(a[1].Ry, 5.7347) && near(a[0].Mz, 18.7016), 'PraC0FixeSup retrait unitaire : Rx = −3,737, Ry = 5,735, M = 18,702');
  a = R(M, u.h1CD.v.map((x) => 10 * x), M.long.CD);
  ok(near(a[1].Rx, -46.5514) && near(a[1].Mz, 216.4091) && near(a[0].Mz, (196.4239 + 196.7966) / 2, 1e-3), 'PraC0FixeSup séisme longitudinal 10 kN/ml : Rx = −46,55, M pied = 216,41 / 196,61');
  const T = MP.calcule(MP.genere(Object.assign(JSON.parse(JSON.stringify(FIX)))), { sansRail: true }).trans, L = T.layout;
  ok(near(T.unit[L.offA + 1] * 1000, -4230.2448, 1e-3) && near(T.unit[L.offA + 4] * 1000, -4191.6104, 1e-3), 'PraC0FixeSup séisme transversal 1000 kN/ml : R = −4230,2 / −4191,6 kN');
}
{ // PRaC0Mobile : 56 nœuds, charges ponctuelles « appui 2 » et « vérin 2 »
  const M = MP.genere(MOB), u = MP.calcule(M, { sansRail: true }).unit;
  let a = R(M, u.pp.v);
  ok(near(a[0].Ry, 466.793) && near(a[1].Ry, 436.9212) && near(a[0].Mz, 5.5006, 2e-3) && near(a[0].Rx, -2.4242, 2e-3), 'PRaC0Mobile poids propre : R = 466,79 / 436,92 kN, Rx = −2,424, M = 5,501');
  a = R(M, u.eLD.v);
  ok(near(a[0].Rx, 2.5524) && near(a[1].Ry, -3.7214) && near(a[0].Mz, -9.2735), 'PRaC0Mobile allongement unitaire : Rx = 2,552, Ry = −3,721, M = 9,274');
  a = R(M, u.qq[0].v);
  ok(near(a[0].Ry, 29.3703) && near(a[1].Ry, 74.8484) && near(a[2].Ry, -4.2187) && near(a[0].Rx, 3.1881, 2e-3) && near(a[1].Mz, 6.4607, 2e-3), 'PRaC0Mobile 100 kN en x = 2,982 m : R = 29,370 / 74,848 / −4,219 kN');
  a = R(M, u.qq[1].v);
  ok(near(a[0].Ry, 21.1705) && near(a[1].Ry, 81.4359) && near(a[2].Ry, -2.6064), 'PRaC0Mobile 100 kN en x = 3,417 m : R = 21,171 / 81,436 / −2,606 kN');
  const s = MP.sectionsTablier(M, u.qq[0].v);
  ok(near(s[2].M, -12.394, 2e-3) && near(s.find((o) => o.e === 7 && o.end === 'j').M, 64.213, 1e-3), 'PRaC0Mobile 100 kN : M = −12,394 sur appui et 64,213 kN·m près de la charge (' + fx(s[2].M) + ', ' + fx(s.find((o) => o.e === 7 && o.end === 'j').M) + ')');
}
console.log((n - f) + ' / ' + n + ' tests réussis');
process.exit(f ? 1 : 0);
