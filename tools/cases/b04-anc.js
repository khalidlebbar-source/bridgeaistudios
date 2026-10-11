/* Biblio 2004 — Règlements anciens : valeurs relevées dans les classeurs Excel */
module.exports = [
  ["anc-bipoutre-levier", {}, { Bc1: [1.0526315789, 1e-8], Bt1: [1.0087719298, 1e-8], Mc80: [0.95175438596, 1e-8], Mc120: [0.89473684210, 1e-8] }, "Biblio2004 · Surchmix.xls (une file contre le bord gauche)"],
  ["anc-bipoutre-levier", {}, { Ag: [1.22807, 1e-5], Bcg: [1.833333, 1e-6] }, "Calcul manuel : 2 voies A(l) (a1 = 1) et 2 files Bc (bc = 1,1), classe 1"],
  ["anc-mixte-cisaillement-dalle", {}, { y: [1.0761, 5e-5], I: [0.057917, 5e-5], mA: [0.011605, 5e-5], tA: [1.8785, 5e-5], AtA: [18.033, 5e-5], mB: [0.010048, 5e-5], tB: [1.9276, 5e-5], AtB: [15.613, 5e-5], mC: [0.026958, 5e-5], tC: [2.1818, 5e-5], inf: [20.946, 5e-5], gl: [1471.1, 5e-5] }, "Biblio2004 · To_mixt.xls (147,11 t/m de glissement)"],
  ["anc-mixte-els", {}, { s0: [-218.41, 5e-5], k: [195.43, 5e-5], y: [1.1176, 5e-5], cTop: [7.6258, 5e-5], cH: [4.1516, 5e-5], aS: [127.49, 5e-5], aI: [96.226, 5e-5], sS: [74.729, 5e-5], wH: [65.935, 5e-5], sI: [-218.41, 5e-5] }, "Biblio2004 · Ver_mixt.xls, Calcul ELS (M = 1 200 tm)"],
  ["anc-mixte-els", { M: -6000 }, { s0: [6 * 0.83168 / 0.038715, 5e-5], y: [0.83168, 5e-5] }, "Biblio2004 · Ver_mixt.xls : section fissurée métal + armatures (v' = 0,83168 m, I = 0,038715 m⁴)"],
];
