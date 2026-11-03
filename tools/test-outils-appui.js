/* APPUI — tests du moteur (node tools/test-outils-appui.js) : cas analytiques et exemples d'origine
 * (ProC0Sup : culée enterrée de pont-route sur semelle ; ProP1Sup : pile à deux voiles sur semelle ; PraC0FixeSup :
 * culée de pont-rail). Seules les valeurs numériques des notes d'origine sont reprises. */
const A = require('../outils/js/appui.js');
const S = require('../outils/js/sondpres.js');
let f = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));
const near = (a, b, t = 1e-6) => rel(a, b) <= t || Math.abs(a - b) < 1e-9;
const cmp = (lab, a, b, t) => ok(near(a, b, t), `${lab} : ${(+a).toFixed(4)} / origine ${b} (écart ${(100 * (a - b) / Math.abs(b || 1)).toFixed(2)} %)`);
const R = Math.PI / 180;

/* ══════════ cas analytiques ══════════ */
console.log('— analytiques');
ok(near(A.ka(35), Math.pow(Math.tan((45 - 17.5) * R), 2), 1e-12) && near(A.ka(30), 1 / 3, 1e-12), 'Ka de Rankine = tan²(π/4 − φ/2) (δ = β = 0)');
{ // Coulomb δ ≠ 0 (écriture générale EN 1998-5 E.2 avec ψ = 90°, θ = 0), composante horizontale K cos δ
  const phi = 30 * R, d = 20 * R, K = Math.pow(Math.cos(phi), 2) / (Math.cos(d) * Math.pow(1 + Math.sqrt(Math.sin(phi + d) * Math.sin(phi) / Math.cos(d)), 2));
  ok(near(A.ka(30, 20), K * Math.cos(d), 1e-12), `Coulomb φ = 30°, δ = 20° : Kh = ${(K * Math.cos(d)).toFixed(4)}`);
}
{ // Mononobe-Okabe, EN 1998-5 annexe E (E.2), forme générale avec ψ = 90°, β = δ = 0
  const phi = 30 * R, kh = 0.2, th = Math.atan(kh), psi = 90 * R;
  const K = Math.pow(Math.sin(psi + phi - th), 2) / (Math.cos(th) * Math.pow(Math.sin(psi), 2) * Math.sin(psi - th) * Math.pow(1 + Math.sqrt(Math.sin(phi) * Math.sin(phi - th) / (Math.sin(psi - th) * Math.sin(psi))), 2));
  ok(near(A.kAE(30, 0, 0, th), K, 1e-12), `K_AE (φ = 30°, kh = 0,2, kv = 0) = ${K.toFixed(4)}`);
  const mo = A.mononobe(30, 0, 0.2, 0); ok(near(mo.Ktot, K, 1e-12) && near(mo.dK, K - 1 / 3, 1e-12), 'incrément dynamique ΔK = K_AE − Ka');
  ok(near(A.mononobe(30, 0, 0, 0).dK, 0, 1e-12), 'kh = 0 : pas d’incrément dynamique');
}
{ // transport de torseur
  const T = A.transport([10, 5, -100, 0, 0, 0], [1, 2, 3], [0, 0, 0]);
  ok(near(T[3], 2 * -100 - 3 * 5) && near(T[4], 3 * 10 - 1 * -100) && near(T[5], 1 * 5 - 2 * 10), 'transport : Mx = Δy·Fz − Δz·Fy, My = Δz·Fx − Δx·Fz, Mz = Δx·Fy − Δy·Fx');
}
{ // pile élémentaire : un fût rectangulaire, une action verticale centrée et un effort horizontal
  const d = A.exemple('pile');
  d.geo.fut = { forme: 'rect', n: 1, b: 2, e: 1, entraxe: 0, h: 5 }; d.geo.app = { n: 1, e: 0, xApp: 0, a0: 0.3, b0: 0.4, a: 0.5, b: 0.6, hb: 0 };
  d.geo.zdef = d.geo.zBase + d.geo.ep; d.biais = 100; d.regl = 'EC';
  d.actions = [{ nom: 'G', cat: 'Gmax', V: -1000 }, { nom: 'G', cat: 'Gmin', V: -1000 }, { nom: 'H', cat: 'W', HX: 100 }];
  const r = A.calc(d), c = r.combs.find((x) => x.type === 'ELS QP' && x.nom.startsWith('G max'));
  const Wsem = 25 * d.geo.B * d.geo.L * d.geo.ep, Wf = 25 * 2 * 5;
  ok(near(-c.T.tot[2], 1000 + Wsem + Wf, 1e-9), 'équilibre vertical en sous-face : V + poids semelle + fût');
  const s0 = r.futs.futs[0].secs[0].rows.find((x) => x.cb === c);
  ok(near(s0.N, 1000 + Wf, 1e-6), `effort normal en pied de fût = V + poids du fût (${s0.N.toFixed(2)})`);
  const cw = r.combs.find((x) => x.type === 'ELS Rare' && /vent/.test(x.nom) && x.nom.startsWith('G max · retrait'));
  const sw = r.futs.futs[0].secs[0].rows.find((x) => x.cb === cw);
  ok(near(sw.My, 100 * 5, 1e-9) && near(cw.T.tot[4], 100 * (5 + d.geo.ep), 1e-9), 'effort horizontal en tête : M pied de fût = H·h, M sous semelle = H·(h + e)');
}
{ // deux fûts et chevêtre : charge symétrique → efforts normaux égaux, somme = charge + poids du chevêtre
  const d = A.exemple('ec'); d.sismique.actif = false; d.choc.actif = false; d.vent.q = 0;
  d.actions = [{ nom: 'G', cat: 'Gmax', V: -2000 }, { nom: 'G', cat: 'Gmin', V: -2000 }];
  const r = A.calc(d), c = r.combs.find((x) => x.type === 'ELS QP');
  const n0 = r.futs.futs[0].secs[0].rows.find((x) => x.cb === c).N, n1 = r.futs.futs[1].secs[0].rows.find((x) => x.cb === c).N;
  const Wch = 25 * 9 * 2 * 1.4, Wf = 25 * Math.PI * 1.4 * 1.4 / 4 * 6;
  ok(near(n0, n1, 1e-9) && near(n0 + n1, 2000 + Wch + 2 * Wf, 1e-6), `portique transversal : N = ${n0.toFixed(1)} kN par fût, Σ = charge + chevêtre + fûts`);
}
{ // frettage sous appareil (BAEL A.8.4) et éclatement (annexe E.8) : valeurs des notes ProC0Sup (Pu = 1016,1 kN saisi)
  const r = A.frettage({ a0: 0.2, b0: 0.3, a: 0.3, b: 0.41, Pu: 1016.1, fck: 32, fe: 500, livret: true, regl: 'ANC', e1: 1.25, e2: 8.43, d1: 1.0, d2: 1.0 });
  console.log('— frettage (ProC0Sup)');
  cmp('K', r.K, 1.0591, 1e-4); cmp('K·fbu', r.sigAdm, 22.5944, 1e-4); cmp('σ sous appareil', r.sig, 16.936, 1e-4);
  cmp('frettage de surface As', r.As, 1.169, 1e-3); cmp('éclatement Ae (parallèle)', r.par.Ae, 4.382, 1e-3); cmp('éclatement Ae (perpendiculaire)', r.perp.Ae, 5.112, 1e-3);
  cmp('équilibre du coin Al', r.Al, 14.607, 1e-3); cmp('σb parallèle', r.par.sb, 0.813, 1e-3); cmp('σte parallèle', r.par.ste, 0.240, 3e-3); cmp('σb perpendiculaire', r.perp.sb, 0.121, 1e-2);
  const p = A.frettage({ a0: 0.3, b0: 0.45, a: 0.41, b: 0.6, Pu: 2377.2, fck: 32, fe: 500, livret: true, regl: 'ANC', e1: 0.7, e2: 2.5, d1: 0.75, d2: 0.7 });
  console.log('— frettage (ProP1Sup, Pu = 2377,2 kN saisi)');
  cmp('σb parallèle', p.par.sb, 4.528, 1e-3); cmp('σte parallèle', p.par.ste, 0.453, 1e-3); cmp('σb perpendiculaire', p.perp.sb, 1.358, 1e-3); cmp('Ae', p.par.Ae, 10.252, 1e-3); cmp('Al', p.Al, 34.172, 1e-3);
}

/* ══════════ ProC0Sup : culée enterrée de pont-route, 3 poteaux Ø 0,70, chevêtre, semelle 2,10 × 7,70 ══════════ */
console.log('— ProC0Sup (culée enterrée, BAEL / Fasc. 61 / Fasc. 62, ouvrage du patrimoine ferroviaire)');
{
  const d = A.exemple('culee'), r = A.calc(d);
  const pp = (re) => r.acts.filter((a) => a.cat === 'PP' && re.test(a.nom)).reduce((s, a) => s - a.F[2], 0);
  cmp('poids propre semelle', pp(/semelle/), 282.98, 1e-4); cmp('poids propre poteaux', pp(/fût/), 224.60, 1e-4); cmp('poids propre chevêtre + petite murette', pp(/chevêtre|murette/), 271.53, 1e-4);
  const all = r.acts.filter((a) => a.cat === 'PP'), W = all.reduce((s, a) => s - a.F[2], 0), ex = all.reduce((s, a) => s - a.F[2] * a.P[0], 0) / W;
  cmp('poids propre total', W, 779.10, 1e-4); cmp('excentricité du poids propre', ex, -0.049, 2e-2);
  // terres : profil simplifié (remblai à l'arrière, niveau de passage à l'avant, sous-face du chevêtre au droit des poteaux) ;
  // l'origine suit le talus avant (perré 3/2) : écart < 1 % sur le poids
  const T = r.acts.find((a) => a.cat === 'GT'); cmp('poids des terres sur la semelle', -T.F[2], 2459.16, 1e-2);
  cmp('Ka (Rankine, φ = 35°)', r.Ka, 0.2710, 2e-4);
  const ecr = (c) => r.acts.find((a) => a.cat === c && a.cible === 'ecran');
  cmp('poussée des terres sur le chevêtre', ecr('PT').F[0], 72.91, 1e-3); cmp('… bras de levier / sous-face', ecr('PT').P[2] - 45, 9.006, 1e-4);
  cmp('poussée de la surcharge (10 kPa) sur le chevêtre', ecr('PQ').F[0], 28.69, 1e-3); cmp('… bras de levier', ecr('PQ').P[2] - 45, 9.109, 1e-4);
  const tp = r.acts.filter((a) => a.cat === 'PT' && a.poteau), tq = r.acts.filter((a) => a.cat === 'PQ' && a.poteau);
  cmp('poussée des terres sur les poteaux (3 D, PP 73)', tp.reduce((s, a) => s + a.F[0], 0), 504.44, 1e-3); cmp('… bras de levier / base des fûts', tp[0].P[2] - 45.7, 3.891, 1e-3);
  cmp('poussée de la surcharge sur les poteaux', tq.reduce((s, a) => s + a.F[0], 0), 132.85, 1e-3);
  cmp('hauteur Dz butée', r.Dz, 4.591, 1e-3);
  // combinaison n° 1 de la note (ELS rare, G max, A(l) maxi freinage sens retrait) : part de courte durée
  const c1 = r.combs.find((c) => c.type === 'ELS Rare' && c.nom === 'G max · retrait / contraction · A(l) maxi');
  cmp('comb. 1 courte durée V', c1.T.cd[2], -31.00, 1e-3); cmp('comb. 1 courte durée HY', c1.T.cd[1], 1.41, 5e-3); cmp('comb. 1 courte durée MY', c1.T.cd[4], 746.67, 1e-4);
  // longue durée : l'écart sur le poids des terres (−0,9 %) se retrouve sur V et MY
  cmp('comb. 1 longue durée V', c1.T.ld[2], -4036.52, 1e-2); cmp('comb. 1 longue durée HY', c1.T.ld[1], 1.22, 5e-3); cmp('comb. 1 longue durée MY', c1.T.ld[4], 421.51, 5e-2);
  ok(Math.abs(c1.T.ld[0]) < 1e-9, 'butée sur les poteaux : HX non repris en sous-face (comme l’origine)');
  // stabilité sous la semelle (q'u = 1 MPa saisi, q'0 = 0,173 MPa)
  const F = r.fond; cmp('q’0', F.q0, 0.173, 2e-3);
  cmp('q’ref ELS maxi (comb. 6 d’origine)', F.synth.els.qref, 0.377, 4e-2); cmp('contrainte limite ELS', F.synth.els.qadm, 0.448, 2e-3);
  cmp('q’ref ELU maxi (comb. 42 d’origine)', F.synth.elu.qref, 0.508, 4e-2); cmp('contrainte limite ELU', F.synth.elu.qadm, 0.586, 2e-3);
  cmp('glissement Hres/H mini', F.synth.glis.glis, 303.17, 1e-2);
  ok(F.combs.every((c) => c.decomp === 0), 'décompression nulle (origine : 0 %)');
  // répartition des contraintes avec le torseur exact de la note (comb. 1)
  const s = A.fondSaisie(Object.assign(d, { regl: 'ANC' }), A.geometrie(d), [{ n: 1, type: 'ELS Rare', nom: 'origine', T: { ld: [0, 1.22, -4036.52, -16.55, 421.51, 0], cd: [0, 1.41, -31.0, -2.19, 746.67, 0], tot: [0, 2.63, -4067.52, -18.74, 1168.18, 0] } }]).combs[0];
  cmp('σmax comb. 1 (torseur d’origine)', s.smax, 0.45886, 2e-3); cmp('σmin comb. 1', s.smin, 0.04423, 1e-2); cmp('q’ref comb. 1', s.qref, 0.35520, 1e-3);
  cmp('déplacement vertical moyen (kv = 10 MPa/m)', s.wz, (4036.52 / 10000 + 31.0 / 20000) / 16.17 * 1000, 1e-9);
}
{ // poteaux : la note d'origine ne charge pas les poteaux par la dalle de transition (pas de dalle déclarée dans la structure)
  const d = A.exemple('culee'); d.actions = d.actions.filter((a) => a.cat !== 'QD');
  const r = A.calc(d), s = r.futs.futs[0].secs[0], rows = s.rows;
  const best = (t) => rows.filter((q) => q.cb.type === t).sort((a, b) => Math.abs(b.My) - Math.abs(a.My))[0];
  const e = best('ELS Rare'), u = best('ELU Fond');
  console.log('— ProC0Sup, poteau 1 en pied (Livret 2.01 chap. 2A, σs ≤ 240 MPa)');
  cmp('M ELS maxi (comb. 27 d’origine)', e.My, 1285.7, 1e-2); cmp('N concomitant (comb. 27)', e.N, 580.3, 4e-2);
  cmp('M ELU maxi (comb. 115)', u.My, 1746.8, 1e-2); cmp('N concomitant (comb. 115)', u.N, 780.8, 5e-2);
  cmp('aciers ELS du poteau', s.A.els, 320.50, 1e-2); cmp('aciers ELU du poteau', s.A.tot, 232.3, 3e-2);
  cmp('τu en pied (b0 = D/1,4)', s.cis.tauV, 1.09, 4e-2);
  ok(r.futs.pctMax > 0.05, `pourcentage d’aciers ${(100 * r.futs.pctMax).toFixed(1)} % > 5 % (l’origine émet la même alerte)`);
}

/* ══════════ ProP1Sup : pile de pont-route à deux voiles 2,50 × 0,70, semelle 2,10 × 8,60 ══════════ */
console.log('— ProP1Sup (pile à deux voiles)');
{
  const d = A.exemple('pile'), r = A.calc(d);
  const W = r.acts.filter((a) => a.cat === 'PP').reduce((s, a) => s - a.F[2], 0);
  cmp('poids propre de l’appui', W, 1103.6, 1e-4); cmp('poids des terres', -r.acts.find((a) => a.cat === 'GT').F[2], 805.2, 1e-4);
  const c3 = r.combs.find((c) => c.type === 'ELS Rare' && c.nom === 'G max · retrait / contraction · Bc maxi');
  const L3 = [20.21, -3.00, -4158.28, 13.58, 196.63], C3 = [157.56, -23.41, -1035.80, 247.70, 1533.24];
  ok(L3.every((v, k) => Math.abs(c3.T.ld[k] - v) < 0.06) && C3.every((v, k) => Math.abs(c3.T.cd[k] - v) < 0.06), 'comb. 3 (ELS rare, Bc maxi, sens retrait) : torseur LD et CD identique à l’origine à 0,05 près');
  const c39 = r.combs.find((c) => c.type === 'ELU Fond' && c.nom === 'G max · retrait / contraction · Bc maxi');
  const L39 = [27.14, -4.03, -5613.67, 18.13, 264.09], C39 = [210.73, -31.31, -1399.08, 331.28, 2050.57];
  ok(L39.every((v, k) => Math.abs(c39.T.ld[k] - v) < 0.06) && C39.every((v, k) => Math.abs(c39.T.cd[k] - v) < 0.06), 'comb. 39 (ELU, Bc maxi, sens retrait) : torseur identique à l’origine à 0,05 près');
  const F = r.fond;
  cmp('q’ref ELS maxi (comb. 3)', F.synth.els.qref, 0.429, 2e-3); cmp('q’ref ELU maxi (comb. 39)', F.synth.elu.qref, 0.578, 1e-3);
  // q'u = 1,832 MPa saisi (calculé par l'origine sur le sondage 11030) ; iδ (BA.fondatio) : 0,940 contre 0,909 à l'origine
  cmp('contrainte limite ELS (comb. 3)', F.synth.els.qadm, 0.603, 4e-2); cmp('contrainte limite ELU (comb. 39)', F.synth.elu.qadm, 0.884, 2.5e-2);
  cmp('glissement Hres/H mini (comb. 51)', F.synth.glis.glis, 9.37, 1e-3);
  cmp('décompression ELS rare maxi (comb. 15)', Math.max(...F.combs.filter((c) => c.type === 'ELS Rare').map((c) => c.decomp)), 15.299, 3e-3);
  cmp('décompression ELU maxi (comb. 51)', Math.max(...F.combs.filter((c) => c.type === 'ELU Fond').map((c) => c.decomp)), 38.025, 3e-3);
  const s = r.futs.futs[0].secs[0];
  console.log('— ProP1Sup, voile en pied (flexion composée, aciers symétriques)');
  cmp('MY1 ELU (comb. 43)', s.crit.elu.M1, 1074.1, 1e-3); cmp('MY total = MY1 + N(ea + e2)', s.crit.elu.M, 1224.5, 5e-3); cmp('MX concomitant', s.crit.elu.Mx, 160.4, 1.5e-2);
  cmp('N concomitant', s.crit.elu.N, 1333.3, 5e-3);
  cmp('aciers ELU par face', s.A.face, 38.8, 1e-2); cmp('M ELS (comb. 15)', s.crit.els.M, 802.7, 1e-3); cmp('aciers ELS par face', s.A.els, 30.14, 1e-2);
}

/* ══════════ PraC0FixeSup : culée de pont-rail (écran : chevêtre + garde-grève) ══════════ */
console.log('— PraC0FixeSup (culée de pont-rail 2 voies, surcharge de remblai 150 kN/ml/voie)');
{
  const d = A.exemple('culee'); d.ouvrage = 'rail'; d.nVoies = 2; d.sol.gamma = 19;
  Object.assign(d.geo, { zBase: 157, ep: 1.1, B: 7, L: 11.746, talon: 1.5, zdef: 167.699, zAvant: 165.207, fut: { forme: 'rect', n: 3, b: 1.166667, e: 1.1, entraxe: 4.373, h: 6.727 },
    chev: { actif: true, L: 12.6521, l: 1.3, h: 1.45, xArr: 0.7, hpm: 0, lpm: 0 }, gg: { h: 0.8, e: 0.2, L: 12.65 }, app: { n: 4, e: 3, xApp: 0.05, a0: 0.6, b0: 0.6, a: 0.8, b: 0.8, hb: 0.1 } });
  const r = A.calc(d), g = (c, re) => r.acts.find((a) => a.cat === c && re.test(a.nom));
  cmp('poussée des terres sur le chevêtre', g('PT', /chevêtre/).F[0], 202.80, 1e-3); cmp('… bras de levier', g('PT', /chevêtre/).P[2] - 157, 8.470, 1e-3);
  cmp('poussée des terres sur la murette', g('PT', /garde/).F[0], 53.25, 1e-3); cmp('… bras de levier', g('PT', /garde/).P[2] - 157, 9.625, 1e-3);
  cmp('surcharge ferroviaire sur le chevêtre (3 m par voie)', g('PQ', /chevêtre/).F[0], 117.88, 1e-3); cmp('surcharge ferroviaire sur la murette', g('PQ', /garde/).F[0], 65.04, 1e-3);
  cmp('poids propre semelle', -g('PP', /semelle/).F[2], 2261.11, 1e-4); cmp('poids propre chevêtre', -g('PP', /chevêtre/).F[2], 596.23, 1e-4); cmp('poids propre murette', -g('PP', /garde/).F[2], 50.60, 1e-4);
}

/* ══════════ imports, lecture .don, séisme, fondation profonde ══════════ */
console.log('— imports et options');
{
  const j = { format: 'BA.rephor.appui', nom: 'Pile 1', biais_gr: 100, actions: [{ id: 'retrait', nom: 'Retrait', H: 20, HX: 20, HY: 0 }, { id: 'freinage', nom: 'Freinage', H: 300, HX: 300, HY: 0 }, { id: 'dilatation', HX: -40, HY: 0, nom: 'Dilatation' }] };
  const x = A.depuisRephor(j); ok(x.actions.length === 3 && x.actions[1].cat === 'F' && x.actions[2].cat === 'Td' && x.repereTablier === false, 'import REPHOR (BA.rephor.appui) : retrait, freinage, dilatation');
  const t = A.depuisTablier({ format: 'BA.radbanRapen.appui', nom: 'P1', biais_gr: 100, global: { pp: 1500, superstructuresMax: 900, superstructuresMin: 600, gr12: { max: 2000, min: -50 }, gr14: { max: 1500, min: 0 }, accotements: { max: 30, min: 0 } } });
  ok(near(t.actions[0].V, -2400) && near(t.actions[1].V, -2100) && t.actions.some((a) => a.qt === 'sw2' && near(a.V, -1500)), 'import RADBAN-RAPEN : V = −réaction, G maxi/mini, groupes gr12 et gr14');
}
{
  const don = ['application        ;', 'APPUI', 'pra ;', '0', 'typeappui ;', '0', 'typefond ;', '0', 'biais ;', '109.39', 'zbasem ;', '45', 'epsem ;', '0.7', 'hap ;', '9.7', 'happapp ;', '0.031', 'hauche ;', '0',
    'lonsem ;', '8.6', 'larsem ;', '2.1', 'nbfut ;', '2', 'larfut ;', '2.5', 'epfutb ;', '0.7', 'eaxefut ;', '4.34', 'zdef ;', '48.465', 'nbappapp ;', '4', 'eaxeappfut ;', '1.75', 'paramgeotech ;', '1', 'qu ;', '1.832', 'de ;', '2.04',
    'gmaxc ;', '-2209.3  0.0  0.0  0.0  0.0', 'gmaxd ;', '0.007  0.007  0.000  0.000  0.000', 'qbcmaxc ;', '-820.5  0.0  0.0  0.0  0.0', 'qbcmaxd ;', '0.020  -0.020  0.000  0.000  0.000', 'FIN_DICO'].join('\n');
  const d = A.parseDon(don);
  ok(d.type === 'pile' && d.geo.fut.forme === 'rect' && near(d.geo.fut.h, 9.0, 1e-9) && d.actions.length === 2 && near(d.actions[1].dy, -0.02), 'lecture .don : pile, voiles rectangulaires, hauteur des fûts, actions et position transversale');
}
{
  const d = A.exemple('ec'); const r = A.calc(d);
  ok(r.combs.some((c) => c.type === 'ELU Sis') && r.combs.some((c) => c.type === 'ELU Acc'), 'Eurocodes : combinaisons sismiques (100 % / 30 %) et accidentelles (choc) générées');
  ok(near(r.sis.kh, 1.1 * 1.35 / 9.81, 1e-9), 'kh = α·S (EN 1998-5 7.3.2.2, r = 1), zone 3, sol B, classe II');
  const dc = A.exemple('ec'); dc.type = 'culee'; dc.geo.talon = 1; dc.geo.zdef = dc.geo.zBase + 8; dc.geo.zAvant = dc.geo.zBase + 3;
  const rc = A.calc(dc); ok(rc.acts.some((a) => a.cat === 'EP' && a.F[0] > 0), 'culée en séisme : incrément de poussée de Mononobe-Okabe');
}
{
  const sps = S.exemple(), d = A.exemple('ec'); d.sismique.actif = false; d.choc.actif = false;
  Object.assign(d.geo, { zBase: sps.z - 2, zdef: sps.z, zAvant: sps.z, ztn: sps.z });
  d.fond.type = 'pieux'; d.fond.pieux = { type: 2, D: 1.0, Lp: 12, nFiles: 2, nParFile: 3, eFile: 3, ePieu: 3.5, enrob: 0.09 };
  const r = A.calc(d, { sps }), c = r.fond.combs[0];
  const N = c.piles.reduce((s, p) => s + p.N, 0);
  ok(near(N, -r.combs[0].T.tot[2], 1e-4), `pieux (BA.fondatio) : Σ N en tête = V en sous-face (${N.toFixed(1)} kN, 6 pieux)`);
}
process.exit(f ? 1 : 0);
