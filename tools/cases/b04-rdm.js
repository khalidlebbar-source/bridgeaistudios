/* Biblio 2004 — RDM : valeurs relevées dans les classeurs Excel (tonnes × 10 → kN) */
/* t(valeurs, tolérance relative) : les classeurs donnent 5 chiffres significatifs */
const t = (o, tol = 2e-4) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v : [v, tol]]));
module.exports = [
  ["rdm-continue-n", {}, t({ Ma1: -126.29629615814, Ma2: -126.29629615814, R0: 49.4753086534902, R1: 120.52469134651 }), "Biblio2004 · Poutre continue.xls (12+10+12 m, 1 t/m)"],
  ["rdm-continue-n", { Ls: "10 ; 5", EI: 10, g: 0, Pc: "12 10", qr: "7 -10 12 20", C: "7 30" }, t({ R0: -4.5621, R1: 28.686, R2: 10.8759, Ma1: 2.3793 }), "Biblio2004 · POUTRE.XLS (charge trapézoïdale, couple, charge ponctuelle)"],
  ["rdm-enveloppe", {}, t({ Ma1max: -175.04, Ma1min: -987.63, Mo_max: 868.34, Mo_min: -99.054, R0max: 326.42, R0min: -2.0968, wo_max: 690.66, wo_min: -272.22 }), "Biblio2004 · Pout_env.xls (3 groupes exclusifs)"],
  ["rdm-enveloppe", { Ls: "10 ; 20 ; 5", g: 10, G: "", qp: 50, Q1: "", Q2: "", Q3: "" }, t({ Ma1max: -264.42, Ma1min: -1670.7, Mo_max: 518.08, Mo_min: -452.12, R0max: 249.52, R0min: -93.029, wo_max: 461.31, wo_min: -676.96 }), "Biblio2004 · Piano.xls (1 t/m + 5 t/m en pianotage)"],
  ["rdm-convoi", {}, t({ Mo_max: [106.5, 1e-3], Ma1min: [-117.87, 1e-3], Ma1max: [-9.898, 1e-3], R0max: 55.19, R0min: 0.87026, R1max: [59.13, 1e-3] }, 5e-4), "Biblio2004 · Pou_roul.xls (convoi 6 t + 2 t, zone 1–9 m, appui droit encastré)"],
  ["rdm-sol-elastique", {}, t({ lam: 0.88914, wo: 0.87555, Mo: 4.4667 }), "Biblio2004 · Pou_sol.xls (x = 5 m)"],
  ["rdm-sol-elastique", { xo: 0.5 }, t({ wo: 6.1077, Mo: -25.127 }), "Biblio2004 · Pou_sol.xls (x = 0,5 m)"],
];
const fl = (pt, pr, tt, tr, ks = 0) => ({ pt, pr, tt, tr, ks });
module.exports.push(
  ["rdm-section-polygone", {}, t({ A: 2.4675, per: 7.9581, Xg: 1.8902, Yg: 0.60321, v: 0.39679, vp: 0.60321, Ix: 0.17075, Iy: 1.7413, Ixy: -0.046209, I1: 0.1694, I2: 1.7427, th: -1.6838, Wsx: 0.43034, Wix: 0.28308, Wy: 1.0491, Wyp: 0.92124 }), "Biblio2004 · SECTIO.XLS"],
  ["rdm-section-polygone", { pts: "1 0 ; -1 0 1 ; 1 0 1" }, { A: [Math.PI, 2e-4], Ix: [Math.PI / 4, 4e-4] }, "Cercle défini par deux arcs (π R², π R⁴/4)"],
  ["rdm-torsion-sections", {}, t({ J: 0.45848, e: 0.16667, So: 1.5278, u: 5.3333, Jt: 0.29176 }), "Biblio2004 · TORSION.XLS (rectangle 1 × 2)"],
  ["rdm-torsion-sections", { forme: "c", a: 1.2 }, t({ J: 0.20358 }), "Biblio2004 · TORSION.XLS (cercle)"],
  ["rdm-torsion-sections", { forme: "e", a: 1.2, b: 1.2 }, t({ J: 0.20358 }), "Biblio2004 · TORSION.XLS (ellipse)"],
  ["rdm-torsion-sections", { forme: "t", a: 1.2 }, t({ J: 0.044883 }), "Biblio2004 · TORSION.XLS (triangle)"],
  ["rdm-torsion-sections", { forme: "h", a: 1.2 }, t({ J: 2.1503, Ip: 1.0825 * 1.2 ** 4 }), "Biblio2004 · TORSION.XLS (hexagone)"],
  ["rdm-torsion-sections", { forme: "o", a: 1.2 }, t({ J: 7.5894 }), "Biblio2004 · TORSION.XLS (octogone)"],
  ["rdm-flambement", fl("b", "b", "l", "l"), { beta: [2, 1e-5] }, "Biblio2004 · Flamb.xls cas 1"],
  ["rdm-flambement", fl("b", "l", "b", "l"), { beta: [1, 1e-5] }, "Biblio2004 · Flamb.xls cas 2"],
  ["rdm-flambement", fl("b", "b", "l", "b"), { beta: [1, 1e-5] }, "Biblio2004 · Flamb.xls cas 3"],
  ["rdm-flambement", fl("b", "b", "b", "l"), { beta: [0.6992, 2e-4] }, "Biblio2004 · Flamb.xls cas 4 (0,7 arrondi ; valeur exacte 0,6992)"],
  ["rdm-flambement", fl("b", "b", "b", "b"), { beta: [0.5, 1e-5] }, "Biblio2004 · Flamb.xls cas 5"],
  ["rdm-flambement", fl("b", "b", "k", "l"), { beta: [1.5618, 0.005] }, "Biblio2004 · Flamb.xls cas 6 (abaque interpolé)"],
  ["rdm-flambement", fl("b", "b", "k", "b"), { beta: [0.92592, 0.005] }, "Biblio2004 · Flamb.xls cas 7 (abaque)"],
  ["rdm-flambement", fl("b", "k", "l", "l"), { beta: [8.3241, 0.005] }, "Biblio2004 · Flamb.xls cas 8 (abaque)"],
  ["rdm-flambement", fl("b", "k", "b", "l"), { beta: [0.98466, 0.005] }, "Biblio2004 · Flamb.xls cas 9 (abaque)"],
  ["rdm-flambement", fl("b", "b", "l", "k"), { beta: [1.8959, 0.005] }, "Biblio2004 · Flamb.xls cas 10 (abaque)"],
  ["rdm-flambement", fl("b", "l", "b", "l", 20000), { beta: [0.91085, 2e-4] }, "Biblio2004 · Flamb.xls cas 11 (sol élastique, formule exacte)"],
  ["rdm-guyon-massonnet", {}, t({ Kcp: 1.0054, KA1: 1.1077, KA2: 1.0057, KBc1: 1.1436, KBc2: 1.0391, KMc: 1.0594 }), "Biblio2004 · GMB.xls (dalle 8 m, portée 15 m)"],
  ["rdm-chainette", { a: 16, h: 0, s: 2 * 20 * Math.sinh(8 / 20) }, t({ c: 20, H: 0.29636 * 20, f: 20 * (Math.cosh(0.4) - 1) }, 1e-4), "Chaînette symétrique de paramètre c = 20 m (contrôle analytique)"],
  ["rdm-flottaison", { F: "", Mh: 1500.9, gw: 9.81, zG: 3.21775 }, t({ d: 1177.2 / (9.81 * 270), BM: 15.1875, thr: 0.10388 }, 2e-4), "Biblio2004 · ROTCAIS.XLS (équation du 3e degré : a = 8939,4 ; c = 14352 ; d = −1500,9)"],
);
