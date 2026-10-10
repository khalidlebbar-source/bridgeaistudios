/* Validation de HandBag contre les valeurs calculées par les classeurs Excel d'origine.
   Usage : node tools/test-handbag.js                                                    */
const { CALCS, seV } = require("../handbag/calcs.js");

const DEF = id => { const c = CALCS.find(x => x.id === id); if (!c) throw new Error("calcul inconnu " + id); return c; };
function run(id, over = {}) {
  const c = DEF(id), I = {};
  c.inputs.filter(i => i.k).forEach(i => { I[i.k] = i.t === "sel" ? i.v : (i.v === "∞" ? Infinity : +i.v); });
  Object.assign(I, over);
  return c.calc(I);
}
function get(r, k) {
  const s = (r.steps || []).find(x => x.k === k); if (s) return s.v;
  if (r.vals && k in r.vals) return r.vals[k];
  for (const t of r.tables || []) if (t.key && t.key[k]) { const [i, j] = t.key[k]; return t.rows[i][j]; }
  throw new Error("valeur introuvable : " + k);
}

// [calcul, surcharges d'entrée, { clé: valeur Excel }, source Excel]
const CASES = [
  ["beton-bael", {}, { fcj: 14.4827586206897, ftj: 1.46896551724138, tuj: 0.675862068965517, Eij: 26812.8584821372, Evj: 9018.87058035524, ft28: 2.7, tu28: 1.63333333333333, Ei28: 35981.7294120745, Ev28: 12102.9453476978 }, "Hand-Bag 2022 · Beton"],
  ["beton-ec2", {}, { fcm: 43, fctm: 3.209962441695237, fctk05: 2.2469737091866655, fctk95: 4.172951174203808, Ecm: 34077.14619918933, Ecv: 10326.407939148283,
    sQP: 15.75, sCar: 21, fcdF: 23.333333333333332, fcdA: 29.166666666666668, fcdS: 26.923076923076923, ftdF: 1.4979824727911104, ftdA: 1.872478090988888, ftdS: 1.7284413147589734 }, "HAND-BAG-EC · Beton (C35/45)"],
  ["beton-ec2", { fck: "50" }, { fctm: 4.071626424892359, Ecm: 37277.86909161465 }, "HAND-BAG-EC · Beton (C50/60)"],
  ["retrait-ec2", {}, { h0: 770.427817115212, ecd0: 0.0005014914951366843, ecd: 0.000351044046595679, ecaInf: 4.9999999999999996e-05, ecs: 0.00040104404659567895, bRH: 1.01835 }, "HAND-BAG-EC · Retrait"],
  ["retrait-fluage", {}, { rm: 13.7571428571429, ert: 0.000178719601710602, rt: 0.446799004276505, rRest: 0.000221280398289398, ft: 0.313913996436662, eflt: 9.41741989309985e-05, fRest: 0.000205825801069002, rest: 0.0004271061993584, ratio: 0.610151713369142 }, "Hand-Bag 2022 · Ret+Fl"],
  ["acier-precontrainte", {}, { sp0: 1488, fprgT: 189602.44648318, sp0T: 151681.957186544, EpT: 19367991.8450561 }, "Hand-Bag 2022 · PSIDP"],
  ["section-mixte", {}, { hw: 1310, n: 6.14402335658128, Aa: 1317, va: 65.2029233105543, Ia: 5326953.51874525, Am: 2973.24370374501, vm: 120.302154339389, Im: 12578061.1640112 }, "Hand-Bag 2022 · In-Mixte"],
  ["raideur-appui", {}, { Ieq: 2.24097597950809, K: 153846.153846154, Kaa: 50400 }, "Hand-Bag 2022 · Inertie eq"],
  ["fleche-prefa", {}, { Ei: 35981.7294120745, Ev: 12102.9453476978, p1: 32.69, F1: 32.2847189790151, F2: 45.0298071709887, F3: 13.949896858023, Fg: 76.2544872843639, sup: 27.3150637677881, inf: 4.77459847788272,
    cf1: 36, cf2: 64, cf3: 84, cf4: 96, cf5: 100 }, "Hand-Bag 2022 · Fleche Iso"],
  ["fleche-tablier", {}, { Fv: 41.5151665911028, Fi: 13.8383888637009, sup: 25.4941228507613, inf: 4.375, cf1: 18, cf2: 32, cf3: 42, cf4: 48, cf5: 50 }, "Hand-Bag 2022 · Fleche Iso simple"],
  ["contre-fleche", {}, { a: -0.110803324099723, b: 4.21052631578947, cf1: 14.4, cf2: 25.6, cf3: 33.6, cf4: 38.4, cf5: 40 }, "Hand-Bag 2022 · CF"],
  ["fleche-mur", {}, { pt: 64.02, pq: 6.6, I: 0.0910605833333333, ft: 18.0457712723985, fq: 2.32548598871115, f: 20.3712572611097 }, "Hand-Bag 2022 · Console"],
  ["fleche-pile", {}, { ui: 0.570699621552873, uv: 1.69667455056259 }, "Hand-Bag 2022 · Fleche Cons (I donnée)"],
  ["fleche-pile", { sec: "P", n: 3, D: 1.2, F: 504.45 }, { In: 0.305362805928928, uv: 23.2948341517117 }, "Hand-Bag 2022 · Fleche Cons (3 pieux Ø1,2)"],
  ["fleche-pile", { sec: "P", n: 2, D: 2, F: 504.45 }, { uv: 4.52851575909275 }, "Hand-Bag 2022 · Fleche Cons (2 pieux Ø2)"],
  ["fleche-pile", { sec: "B", n: 5, bb: 1.2, hb: 2.7, F: 504.45 }, { In: 9.8415, uv: 0.722793874939359 }, "Hand-Bag 2022 · Fleche Cons (5 barrettes)"],
  ["rotation", {}, { av: 0.00314592829831511, ai: 0.00105817588216054, av23: 0.00209728553221007 }, "Hand-Bag 2022 · Rot (répartie)"],
  ["rotation", { cas: "P", p: 320, L: 25, I: 4.5776 }, { av: 0.000237518092559821, ai: 7.98924493155761e-05 }, "Hand-Bag 2022 · Rot (concentrée)"],
  ["maj-dyn", {}, { delta: 1.06731605295618 }, "Hand-Bag 2022 · MAJ dyn (poutres)"],
  ["maj-dyn", { el: "h", L: 4.1, G: 34.645, S: 75 }, { delta: 1.43047410497546 }, "Hand-Bag 2022 · MAJ dyn (hourdis)"],
  ["charge-al", { a1f: 1 }, { V: 3, a2: 1.16666666666667, A: 2.22637529137529, Aml: 33.3956293706294, Sf: 141.75, fr: 0.0487897102501083, F: 15.397481111793 }, "Hand-Bag 2022 · A,a,(L) (a1 = 1 imposé comme dans la feuille)"],
  // CORRECTION : Fascicule 61 II art. 4.2.2 — pont de 1re classe, 5 voies chargées → a1 = 0,70 (la feuille prenait a1 = 1)
  ["charge-al", {}, { a1: 0.7, A: 1.16666666666667 * 0.7 * (0.23 + 36 / 21.45), F: 141.75 * 1.16666666666667 * 0.7 * (0.23 + 36 / 21.45) / (20 + 0.0035 * 141.75) }, "Fascicule 61 II — a1 du tableau (corrigé)"],
  ["charge-al", { Lch: 7 }, { Nv: 2 }, "Fascicule 61 II art. 2.3 — E(7/3) = 2 voies"],
  ["charge-al", { Lch: 5.5 }, { Nv: 2 }, "Fascicule 61 II art. 2.3 — chaussée de 5 à 6 m : 2 voies"],
  ["courbon", {}, { eta1: 0.380645161290323, eta2: 0.293548387096774, eta3: 0.206451612903226, eta4: 0.119354838709677, max: 0.380645161290323 }, "Hand-Bag 2022 · Courbon (Bc 5 files)"],
  ["courbon", { e: 0 }, { eta1: 0.25, eta4: 0.25 }, "Hand-Bag 2022 · Courbon (convoi centré)"],
  ["freinage-lgv", {}, { Qla: 792, Qlb: 480 }, "HAND-BAG-LGV · FR & DEM UIC 71"],
  ["freinage-lgv", { mod: "SW2" }, { Qla: 792, Qlb: 840 }, "HAND-BAG-LGV · FR & DEM SW2"],
  ["allongement", {}, { P: 2.481984, sm: 1192.0724100336, dlm: 230.032584055638, ct: 0.747398683068428, Tp: 1030.57309610939 }, "Hand-Bag 2022 · Allong PSIDP (formule de la moyenne)"],
  // CORRECTION : allongement par intégration de σ(x) le long du câble au lieu de la moyenne des tensions extrêmes
  ["allongement", {}, { dl: (() => { const k = 0.2 * 0.387891 + 0.002 * 34; return 1378.88 * 34 / 190000 * (1 - Math.exp(-k)) / k * 1000; })() }, "Intégrale exacte (corrigé)"],
  ["cis-ec2", {}, { A1: 53.6118795143691, A2: 44.2047026279391 }, "Hand-Bag 2022 · CisEC2"],
  ["cis-circulaire", {}, { Di: 1.6, I: 1.30690254389335 }, "Hand-Bag 2022 · Cis-Cr"],
  // CORRECTION : τ = V·S/(I·b) exact pour une couronne épaisse (la feuille utilisait V·R²/I, approximation de tube mince, +42 %)
  ["cis-circulaire", {}, { tau: 1.161 * (2 / 3 * (1.2 ** 3 - 0.8 ** 3)) / (1.30690254389335 * 0.8), A: 0.4 * 1.161 * (2 / 3 * (1.2 ** 3 - 0.8 ** 3)) / (1.30690254389335 * 0.8) / (0.9 * 500) * 1e4 }, "RDM τ = VS/Ib (corrigé)"],
  ["frettage", {}, { A: 2.81106382978723, n: 3.57915763085978 }, "Hand-Bag 2022 · Frettage"],
  ["levage-trous", {}, { Sm: 0.8085, V: 22.23375, P: 55.584375, F: 27.7921875, A: 0.709587765957447 }, "Hand-Bag 2022 · Levage TROU"],
  ["levage-crochets", {}, { M: 5.0625, P: 24.4375, P2: 12.21875, sc: 124.427189409369 * 9.82 / (2 * Math.PI * 2.5 ** 2 / 4), ssl: 250, sbl: 21 }, "Hand-Bag 2022 · Levage CR (Ø25 : 4,909 vs 4,91 cm²)"],
  ["predalles", {}, { p: 9.528, M: 0.465234375, I: 1.44e-07, s: 19.384765625, Fs: 0.928564231738035 }, "Hand-Bag 2022 · Fibro (cas 1)"],
  ["predalles", { L: 1.46, ep: 0.03, H: 0.25, gb: 25 }, { p: 6.67, M: 1.7772215, s: 11.8481433333333, Fs: 1.51922537511503 }, "Hand-Bag 2022 · Fibro (cas 2)"],
  ["serrage", {}, { Fp: 321.3, Mr: 954.261, M75: 715.69575, M110: 1049.6871 }, "Hand-Bag 2022 · Couple serrage"],
  ["tassement-aa", {}, { a1: 0.29, b1: 0.39, A1: 0.1131, lp: 1.36, sig: 5.22546419098143, vz: 1.13800230648116, vz2: 0.569001153240578, v1: 0.0867608727004264, v2: 0.321493520360101 }, "Hand-Bag 2022 · TasAA"],
  ["pieux-min-sis", {}, { As: 47.1238898038469, n: 6, Ar: 48.2548631591392, rr: 0.6144, rc: 0.848481343881531, rk: 0.61707734100475 }, "Hand-Bag Geo · Pieux Min Sis"],
  ["groupe-v", {}, { Ce: 0.812999901996251, C2: 0.9 }, "Hand-Bag Geo · GroupeV"],
  ["groupe-h", {}, { ax: 1.48, ay: 2.4, r0x: 0.507756183111612, r0y: 0.656215140490306, Kx: 1, Rfx: 0.616666666666667, Ky: 0.868215803854617, Rfy: 1 }, "Hand-Bag Geo · Groupe H"],
  ["barrettes", {}, { KfX: 285326.187318261, RfX: 3180, RsX: 136, R1X: 272, R2X: 3316, SDRfX: 0.37037037037037, r0X: 0.439202077379936, SPDRsX: 0.176470588235294, gRfX: 1177.77777777778, gRsX: 24, gR1X: 48, gR2X: 1201.77777777778,
    KfY: 362736.814277435, RfY: 8586, SDRfY: 0.481481481481481, r0Y: 0.59671051037542, SPDKfY: 0.746076988014153, gKfY: 270629.589837958, gRfY: 4134, gR2Y: 4134, gK1Yb: 100233.181421466 }, "Hand-Bag Geo · Barrettes"],
  ["barrettes-sis", {}, { Gm: 352, G: 153.472, Es: 399027.2, K: 478832.64, KX: 478832.64, KY: 177345.422222222 }, "Hand-Bag Geo · Barrettes Sismique"],
  ["barrettes-min-sis", {}, { Amin: 67.5, Amax: 810, t1: 10, p1: 26.8, t2: 27, p2: 82.1333333333333, zc: 2.5 }, "Hand-Bag Geo · Barrettes min sis"],
  ["inclusions", {}, { F0: 0.68, F1: 1.059, s1: 3.74544632742927, s2: 6.252, Qp: 0.848230016469244, Qs: 0.829380460547705, Q: 1.67761047701695, F2: 1.11840698467797, rho: 0.568713663315039 }, "Hand-Bag Geo · IR"],
  ["cis-ec2", {}, { nu1: 0.6 * (1 - 35 / 250), Amin: 0.08 * Math.sqrt(35) / 500 * 1e4, VR1: 1 * 0.9 * 1.928 * 0.6 * (1 - 35 / 250) * (35 / 1.5) / (1.5 + 1 / 1.5) }, "EC2 (6.9) et (9.5N)"],
  ["levage-crochets", { fis: "TP" }, { ssl: 0.8 * Math.min(500 * 2 / 3, Math.max(250, 110 * Math.sqrt(1.6 * 2.7))) }, "BAEL A.4.5.34 — fissuration très préjudiciable"],
  ["acier-precontrainte", { mode: "pre" }, { sp0: Math.min(0.85 * 1860, 0.95 * 1660), spm0: Math.min(0.75 * 1860, 0.85 * 1660) }, "BPEL pré-tension, EC2 5.10.3"],
  ["serrage", { t: 40 }, { rot: 60 }, "EN 1090-2 tableau 21 (t < 2d)"], ["serrage", { t: 120 }, { rot: 90 }, "EN 1090-2 tableau 21 (2d ≤ t < 6d)"],
  ["freinage-lgv", { mod: "SW2", a: 1.33 }, { Qlb: 840 }, "EN 1991-2 : α ne s'applique pas à SW/2"],
  ["fleche-mur", { phi: 30 }, { Ka: 1 / 3 }, "Rankine φ = 30°"],
  ["beton-bael", {}, { fbu: 0.85 * 14.4827586206897 / 1.5, sbc: 0.6 * 14.4827586206897 }, "BAEL A.4.3.41 et A.4.5.2"],
  ["section-mixte", { mod: "e0" }, { n: 210 / (22 * Math.pow(3.8, 0.3)) }, "EC4 n0 = Ea/Ecm"],
  ["spectre-ec8", { q: 1.5 }, { plD: 0.981 * 1.8 * 2.5 / 1.5 }, "EC8 spectre de calcul (3.14)"],
  ["spectre-ec8", {}, { r055: 3.6818181818181817, r2: 0.6328125, plH: 0.981 * 1.8 * 2.5 }, "HAND-BAG-EC · Spectres Elas (horizontal)"],
];

let ok = 0, ko = 0; const lines = [];
for (const [id, over, exp, src] of CASES) {
  let r; try { r = run(id, over); } catch (e) { console.log("✗", id, "ERREUR", e.message); ko++; continue; }
  for (const [k, ev] of Object.entries(exp)) {
    let v; try { v = get(r, k); } catch (e) { console.log("✗", id, k, e.message); ko++; continue; }
    const rel = Math.abs(v - ev) / Math.max(Math.abs(ev), 1e-12);
    if (rel < 1e-6) ok++; else { ko++; console.log(`✗ ${id}.${k} = ${v} ≠ Excel ${ev} (écart ${(rel * 100).toFixed(4)} %)  [${src}]`); }
  }
  lines.push(src);
}
// spectre vertical : point T = 0,21 s de la feuille (Se/avg = 2,857)
{ const v = seV(0.21, 0.03, 0.2, 2.5, 1), e = 2.857142857142857; if (Math.abs(v - e) < 1e-9) ok++; else { ko++; console.log("✗ spectre vertical", v, e); } }
// section rectangulaire ELS : contrôle manuel (b = 0,4 ; d = 0,95 ; As = 4,68 cm² ; M = 5,0625 kN·m)
{ const r = run("levage-crochets"); const b = 0.4, d = 0.95, As = 4.68e-4, n = 15, y = get(r, "y");
  const eq = Math.abs(b * y * y / 2 - n * As * (d - y)) < 1e-12; eq ? ok++ : (ko++, console.log("✗ ELS : équilibre de l'axe neutre"));
  const I = b * y ** 3 / 3 + n * As * (d - y) ** 2; Math.abs(get(r, "ss") - n * 5.0625e-3 * (d - y) / I) < 1e-9 ? ok++ : (ko++, console.log("✗ ELS σs")); }

const ids = new Set(CASES.map(c => c[0]));
const missing = CALCS.filter(c => !ids.has(c.id)).map(c => c.id);
console.log(`\n${ok} valeurs conformes, ${ko} écarts — ${CALCS.length} calculs, ${ids.size} validés contre Excel${missing.length ? " ; non couverts : " + missing.join(", ") : ""}`);
process.exit(ko ? 1 : 0);
