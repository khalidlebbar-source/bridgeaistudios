/* RADBAN-RAPEN — tabliers de ponts-rails BA et à poutrelles enrobées (node tools/test-outils-tablier-rail.js).
 * Cas analytiques indépendants + cas de référence chiffrés des exemples d'origine « Radban1 » et « Rapen1 »
 * (notes .res/.ndc, version poutre) : seules les valeurs numériques attendues sont reprises ici. */
const R = require('../outils/js/tablier-rail.js');
const P = require('../outils/js/poutres-continues.js');
const C = require('../outils/js/charges.js');
let f = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));
const near = (a, b, t, m) => ok(rel(a, b) <= t, `${m} : ${(+a).toFixed(4)} (attendu ${b}, écart ${(rel(a, b) * 100).toFixed(2)} %)`);

/* ───────── 1. Cas analytiques ───────── */
{
  // LM71 réparti (locomotive 156,25 kN/m sur 6,40 m) sur une travée isostatique L = 20 m : M(L/2) max analytique
  const S = P.build({ E: 1000, ns: 10, travees: [{ L: 20, Ig: 1 }], appuis: [{}, {}] }), LI = P.lignes(S);
  const i = S.sections.findIndex((s) => Math.abs(s.x - 10) < 1e-9);
  const e = R.envUICrep(LI.sec[i].M);
  // loco centrée : 156,25 × ∫ (aire du triangle sur [6,8 ; 13,2]) + 80 × (aire restante)
  const aire = (a, b) => { const y = (x) => (x <= 10 ? x / 2 : (20 - x) / 2); let s = 0; const n = 2000; for (let k = 0; k < n; k++) { const x = a + (b - a) * (k + 0.5) / n; s += y(x); } return s * (b - a) / n; };
  const att = 156.25 * aire(6.8, 13.2) + 80 * (aire(0, 6.8) + aire(13.2, 20));
  near(e.max, att, 1e-4, 'LM71 réparti, M(L/2) isostatique 20 m');
  ok(e.min === 0, 'LM71 réparti : pas de moment négatif en isostatique');
  // la répartition de la locomotive diminue le moment par rapport aux essieux concentrés (≈ −1 %)
  const conc = R.env(LI.sec[i].M, 'UIC71', false).max;
  ok(e.max < conc && e.max > 0.98 * conc, `LM71 réparti (${e.max.toFixed(1)}) < concentré (${conc.toFixed(1)})`);
}
{
  // section rectangulaire : coupe sans console ni forme de pente → b, h exacts
  const g = R.coupe({ Btot: 10, h: 1, lc: 0, er: 1, penteC: 0, penteExt: 0, dRebord: 0 });
  near(g.A, 10, 1e-9, 'Coupe rectangulaire : aire'); near(g.I, 10 / 12, 1e-6, 'Coupe rectangulaire : inertie');
  near(g.hm, 1, 1e-6, 'Coupe rectangulaire : hauteur équivalente');
}
{
  // Φ2 du Livret 2.01 / EN 1991-2 pour 3 travées 14-20-14 : LΦ = 1,3 × 16 = 20,8 m
  const p = R.phi({ travees: [14, 20, 14], entretien: 'soigne', alpha: 1 });
  near(p.Lphi, 20.8, 1e-9, 'LΦ trois travées'); near(p.phi, C.phi2(20.8), 1e-12, 'Φ2(LΦ)');
}
{
  // combinaisons : ELU = 1,35 G + 1,45 Gr12 sur une composante simple
  const Cb = R.combinaisons('livret');
  const c = { pp: 100, supMax: 13, supMin: 10, den: { max: 0, min: 0 }, A: { max: 50, min: -5 }, B: { max: 40, min: 0 }, acc: { max: 2, min: 0 } };
  near(R.comb(c, Cb.ELU[0], 1, true, Cb), 1.35 * 113 + 1.45 * 50 + 1.2 * 2, 1e-12, 'ELU1 max');
  near(R.comb(c, Cb.ELU[0], -1, true, Cb), 110 - 1.45 * 5, 1e-12, 'ELU1 min (G favorable)');
}
{
  // Navier : répartition rigide d'une charge excentrée de e sur 4 appareils (somme = 1, moment = e)
  const a = R.calcul(Object.assign({}, R.DEF_RADBA, { nCharge: 1 })).app[1];
  const cs = a.parApp.map((p) => p.c[0]);
  near(cs.reduce((s, v) => s + v, 0), 1, 1e-12, 'Somme des coefficients de répartition sur appareils');
  near(cs.reduce((s, v, i) => s + v * a.y[i], 0), -2.4, 1e-12, 'Moment des coefficients = excentricité de la voie');
}
{
  // RAPEN : Av EN 1993-1-1 §6.2.6 pour 14 HEA 1000, Vpl,Rd = Av fy/√3
  const a = R.calcul(R.DEF_RAPEN);
  near(a.pe.Av, 0.258321, 1e-4, 'Aire de cisaillement 14 HEA 1000 (Av)');
  near(a.pe.VplRd, 51453.89, 1e-4, 'Vpl,Rd poutrelles seules');
  near(a.pe.MplS, 57366.986, 5e-4, 'Moment plastique des poutrelles seules (sans congés, fy/1,05)');
  near(a.pe.dev.sigCrit, 50.8, 2e-3, 'Contrainte critique de déversement simplifiée (Fasc. 61 V art. 19)');
}

/* ───────── 2. Radban1 (dalle BA, 3 travées 14 + 20 + 14 m, 2 voies, Livret 2.01 / BAEL) ───────── */
const A = R.calcul(R.DEF_RADBA);
const sA = (x, side) => A.secs.find((s) => Math.abs(s.x - x) < 1e-6 && (side === undefined || s.side === side));
const bA = (x, side) => A.ba.secs[sA(x, side).i];
{
  near(A.g.I, 1.504084, 1e-3, 'Radban1 : inertie de la dalle équivalente');
  near(A.g.beq, 11.022, 1e-3, 'Radban1 : largeur de la dalle équivalente');
  near(A.pp + A.Gna, 345.6, 1e-3, 'Radban1 : charges non amovibles G(na)');
  near(A.ph.phi, 1.1502, 1e-4, 'Radban1 : coefficient dynamique');
  near(A.Kt[0].K[0], 1.0158, 2e-4, 'Radban1 : K GMSLT à l’axe, travée 1');
  const p = sA(14, 'g');
  near(-p.M.pp, 9908.2, 1e-3, 'Radban1 : M poids propre sur pile P1');
  near(-p.M.supMax, 5466.6, 1e-3, 'Radban1 : M superstructures max sur P1');
  near(p.M.den.max, 2302.3, 1e-3, 'Radban1 : M dénivellations sur P1');
  near(-p.M.A.min, 9447.4, 1e-3, 'Radban1 : M Gr12 sur P1');
  near(-p.M.B.min, 9974.3, 1e-3, 'Radban1 : M Gr14 sur P1');
  near(-p.M.acc.min, 259.3, 2e-3, 'Radban1 : M accotements sur P1');
  near(-p.cM.ELU.min, 36722.8, 1e-3, 'Radban1 : M ELU sur P1');
  near(-p.cM.ELS.min, 27006.1, 1e-3, 'Radban1 : M ELS sur P1');
  const m = sA(24);
  near(m.cM.ELU.max, 25571.5, 1e-3, 'Radban1 : M ELU à mi-travée 2');
  near(m.cM.ELS.max, 18870.5, 1e-3, 'Radban1 : M ELS à mi-travée 2');
  near(m.M.A.max, 7954.7, 1e-3, 'Radban1 : M Gr12 à mi-travée 2');
  near(sA(5.6).cM.ELU.max, 18141.2, 1e-3, 'Radban1 : M ELU travée 1 section 4');
  // aciers (cm², toute la largeur)
  near(bA(14, 'g').As[0], 1148.39, 5e-3, 'Radban1 : aciers supérieurs sur P1');
  near(bA(24).As[1], 785.62, 5e-3, 'Radban1 : aciers inférieurs mi-travée 2');
  near(bA(5.6).As[1], 537.49, 5e-3, 'Radban1 : aciers inférieurs travée 1 section 4');
  near(bA(7).As[1], 501.74, 5e-3, 'Radban1 : aciers inférieurs travée 1 section 5');
  near(bA(7).As[0], 35.48, 5e-3, 'Radban1 : aciers supérieurs travée 1 section 5');
  near(bA(0, 'd').As[0], 124.81, 0.12, 'Radban1 : aciers supérieurs sur culée (non-fragilité, voir note)');
  near(bA(24).sc, 9.0653, 5e-3, 'Radban1 : contrainte du béton mi-travée 2');
  near(bA(14, 'g').sc, 11.4729, 5e-3, 'Radban1 : contrainte du béton sur P1');
  near(bA(14, 'g').Vu, 10530.3, 1e-3, 'Radban1 : effort tranchant ELU sur P1');
  near(bA(14, 'g').tau, 0.877, 2e-3, 'Radban1 : contrainte tangente sur P1');
  // flèches de confort (UIC 71 une voie), cm
  near(m.fl.nf * 100, 0.25, 0.02, 'Radban1 : flèche UIC inertie non fissurée, mi-travée 2');
  near(m.fl.moy * 100, 0.32, 0.02, 'Radban1 : flèche UIC inertie moyenne, mi-travée 2');
  near(A.ba.Ifiss, 0.84360, 6e-3, 'Radban1 : inertie fissurée');
  near(A.ext[0].theta, 0.0004639, 2e-3, 'Radban1 : rotation d’about sous trafic');
  near(A.ext[1].dH * 1000, 0.55, 0.02, 'Radban1 : déplacement longitudinal δH culée Cn');
  // réactions
  near(A.app[0].env.UIC71.max, 924.67, 1e-3, 'Radban1 : réaction globale UIC max C0');
  near(A.app[0].env.UIC71.min, -191.20, 1e-3, 'Radban1 : réaction globale UIC min C0');
  near(A.app[1].env.UIC71.max, 2090.19, 1e-3, 'Radban1 : réaction globale UIC max P1');
  near(A.app[1].env.SW2.max, 2810.95, 1e-3, 'Radban1 : réaction globale SW2 max P1');
  const q0 = A.app[0].parApp[A.app[0].iMax], q1 = A.app[1].parApp[A.app[1].iMax];
  near(q0.r.pp + q0.r.supMax, 665.03, 1e-3, 'Radban1 : appareil de culée, charge permanente max');
  near(q1.r.pp + q1.r.supMax, 2415.56, 1e-3, 'Radban1 : appareil de pile, charge permanente max');
  near(q0.r.den.max, 41.11, 1e-3, 'Radban1 : appareil de culée, dénivellations');
  near(q1.r.A.max, 1202.09, 1e-3, 'Radban1 : appareil de pile, groupe 12 max');
  near(q1.r.B.max, 1601.90, 1e-3, 'Radban1 : appareil de pile, groupe 14 max');
  near(q0.r.acc.max, 11.22, 2e-3, 'Radban1 : appareil de culée, accotements');
}

/* ───────── 3. Rapen1 (14 HEA 1000, 3 travées 15 + 25 + 15 m) ───────── */
const B = R.calcul(R.DEF_RAPEN);
const sB = (x, side) => B.secs.find((s) => Math.abs(s.x - x) < 1e-6 && (side === undefined || s.side === side));
const pB = (x, side) => B.pe.secs[sB(x, side).i];
{
  near(B.ph.phi, 1.12, 1e-3, 'Rapen1 : coefficient dynamique');
  near(B.ine.Ic, 0.25391, 5e-3, 'Rapen1 : inertie / acier non fissurée courte durée (n = 6)');
  near(B.ine.Icf, 0.13745, 5e-3, 'Rapen1 : inertie / acier fissurée courte durée');
  near(B.ine.Il, 0.13747, 1e-2, 'Rapen1 : inertie / acier non fissurée longue durée (n = 18)');
  const m = sB(27.5), pm = pB(27.5), pa = pB(15, 'g');
  near(m.M.pp, 10564.8, 3e-3, 'Rapen1 : M phase construction (poutrelles seules) mi-travée 2');
  near(-pa.M1, 14521.6, 3e-3, 'Rapen1 : M phase construction sur P1');
  near(Math.max(m.M.supMax, m.M.supMin), 1855.5, 1e-3, 'Rapen1 : M superstructures max mi-travée 2');
  near(m.M.A.max, 5465.3, 1e-3, 'Rapen1 : M Gr12 mi-travée 2');
  near(m.M.B.max, 6607.7, 1e-3, 'Rapen1 : M Gr14 mi-travée 2');
  near(pm.MuMax, 26764.1, 3e-3, 'Rapen1 : M ELU mi-travée 2');
  near(pa.MuMin, -35920.0, 3e-3, 'Rapen1 : M ELU sur P1');
  near(pm.MRdP, 73230, 6e-3, 'Rapen1 : moment résistant positif (INERPE)');
  near(pm.MRdN, -66946, 1e-3, 'Rapen1 : moment résistant négatif (INERPE)');
  near(pa.MRdP, 73251, 1.2e-2, 'Rapen1 : moment résistant positif, zone des chapeaux');
  near(pa.MRdN, -68785, 1e-3, 'Rapen1 : moment résistant négatif, zone des chapeaux');
  near(pm.sigma.aileSup.tot, 87.44, 5e-3, 'Rapen1 : contrainte ELS aile supérieure mi-travée 2');
  near(pm.sigma.aileInf.tot, -118.304, 5e-3, 'Rapen1 : contrainte ELS aile inférieure mi-travée 2');
  near(pm.sigma.betonSup.tot, 3.676, 1e-2, 'Rapen1 : contrainte ELS béton mi-travée 2');
  near(pa.sigma.aileSup.tot, -164.663, 5e-3, 'Rapen1 : contrainte ELS aile supérieure sur P1');
  near(pa.sigma.aileInf.tot, 137.446, 5e-3, 'Rapen1 : contrainte ELS aile inférieure sur P1');
  near(pa.sigma.HA.tot, -79.942, 5e-3, 'Rapen1 : contrainte ELS des chapeaux sur P1');
  near(B.pe.Vsd, 9655.05, 3e-3, 'Rapen1 : effort tranchant ELU maxi');
  near(m.fl.nf * 100, 0.52, 0.02, 'Rapen1 : flèche UIC non fissurée mi-travée 2');
  near(m.fl.f * 100, 0.95, 0.01, 'Rapen1 : flèche UIC fissurée mi-travée 2');
  near(m.fl.moy * 100, 0.67, 0.01, 'Rapen1 : flèche UIC moyenne mi-travée 2');
  const cf = B.pe.cf.find((c) => Math.abs(c.x - 27.5) < 1e-6);
  near(cf.fb * 100, 3.06, 0.01, 'Rapen1 : flèche béton mou mi-travée 2');
  near(cf.fp * 100, 0.34, 0.02, 'Rapen1 : flèche superstructures mi-travée 2');
  near(cf.fq * 100, 0.60, 0.02, 'Rapen1 : flèche d’exploitation mi-travée 2');
  near(cf.tot * 100, 3.70, 0.01, 'Rapen1 : contre-flèche totale mi-travée 2');
  near(B.pe.dal.q, 27.67, 1e-3, 'Rapen1 : charge sur les dallettes de coffrage');
  near(B.pe.dal.portee, 0.55, 1e-2, 'Rapen1 : portée des dallettes');
  near(B.pe.dev.sigF15, 57.5, 0.07, 'Rapen1 : contrainte de déversement, bétonnage sur 15 cm');
  near(B.ext[1].dH * 1000, 0.31, 0.02, 'Rapen1 : δH culée Cn');
  near(B.app[0].env.UIC71.max, 975.22, 1e-3, 'Rapen1 : réaction globale UIC max C0');
  near(B.app[1].env.SW2.max, 3073.01, 1e-3, 'Rapen1 : réaction globale SW2 max P1');
  const q0 = B.app[0].parApp[B.app[0].iMax], q1 = B.app[1].parApp[B.app[1].iMax];
  near(q0.r.A.max, 177.98, 1e-3, 'Rapen1 : appareil de culée, groupe 12 max');
  near(q0.r.B.max, 196.53, 1e-3, 'Rapen1 : appareil de culée, groupe 14 max');
  near(q1.r.A.max, 446.57, 1e-3, 'Rapen1 : appareil de pile, groupe 12 max');
  near(q1.r.B.max, 560.84, 1e-3, 'Rapen1 : appareil de pile, groupe 14 max');
  near(q1.r.acc.max, 13.97, 2e-3, 'Rapen1 : appareil de pile, accotements');
}

/* ───────── 4. Exports, plans, lecture .don ───────── */
{
  const ex = R.exportRephor(A);
  ok(ex.module === 'efforts-horizontaux' && ex.ap.length === 4 && ex.v.travees === '14 20 14', 'Export REPHOR : format de la page REPHOR');
  ok(ex.ap.every((a) => a.Gmax > 0 && a.Qmax > 0), 'Export REPHOR : charges G et Q par file');
  const ap = R.exportAppuis(B);
  ok(ap.length === 4 && ap[1].appareils.nombre === 14 && ap[1].global.gr12.max > 0, 'Export APPUI : descente de charges par file');
  const vs = R.vues(B).concat([R.vuePercage(B)]);
  ok(vs.length === 4 && vs.every((v) => /^<svg/.test(R.svgVue(v))), 'Plans SVG : élévation, plan biais, coupe, perçage');
  const dx = R.dxf(vs);
  ok(/AC1009/.test(dx) && /ENTITIES/.test(dx) && /EOF\r\n$/.test(dx), 'Export DXF R12');
  const pz = R.percage(B);
  ok(pz.fer.length > 100 && pz.ent.length > 5 && Math.abs(pz.cfAt(27.5) - 3.70) < 0.02, 'Perçage : trous et contre-flèche de cintrage');
  // lecture d'un .don (fragment synthétique au format d'origine)
  const don = ['application ;', 'RADBAN_RAPEN', 'typstruct ;', '0', 'nbtrav ;', '2', 'lontrav1 ;', '12', 'lontrav2 ;', '12', 'biais ;', '100', 'epdal ;', '0.9', 'lardalv1 ;', '8', 'nbvoical ;', '0', 'dismintabv1 ;', '3.37', 'dismaxtabv1 ;', '3.71'].join('\r\n');
  const d = R.lireDon(don);
  ok(d.type === 'radba' && d.travees.join() === '12,12' && d.nVoies === 1 && d.h === 0.9, 'Lecture .don : géométrie et voies');
  ok(R.calcul(d).secs.length > 20, 'Lecture .don : calcul complet sur les données lues');
  let err = null; try { R.calcul(Object.assign({}, R.DEF_RADBA, { biais: 50 })); } catch (e) { err = e; }
  ok(!!err, 'Biais hors domaine du calcul en poutre refusé');
}
process.exit(f ? 1 : 0);
