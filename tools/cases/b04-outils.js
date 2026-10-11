/* Biblio 2004 — Outils : valeurs relevées dans les classeurs Excel */
const t = (o, tol = 2e-4) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v : [v, tol]]));
module.exports = [
  ["out-equation", {}, t({ x1: 2.8378, x2: -1.9561, x3: -7.8817 }), "Biblio2004 · Résolution de l'équation (3e degré)"],
  ["out-equation", { a: 1, b: 0, c: 3, d: 2 }, t({ x1: -0.59607 }), "Biblio2004 · Résolution de l'équation (y³ + 3y + 2 = 0)"],
  ["out-equation", { deg: "4", a: 2, b: -4, c: 1, d: 0 }, t({ x1: 1, x2: 0.30278, x4: -3.3028 }), "Biblio2004 · Résolution de l'équation (4e degré)"],
  ["out-rotation", {}, t({ r12: -0.150126 }, 1e-5), "Biblio2004 · ROTATION (axe et angle)"],
  ["out-clothoide", {}, t({ Lc: 60.735, A: 15.99 }, 3e-4), "Biblio2004 · Clothoïde (raccordement)"],
  ["out-interpolation", {}, t({ a0: 21.1141149530631, a1: -2.26603884489741, a2: 2.08836701369379, a3: -0.554109548872337, a4: 0.0531919762598816, a5: -0.00176894427803112 }, 1e-6), "Biblio2004 · Interpolation (moindres carrés, degré 5)"],
  ["out-fonction", {}, t({ I: -9.6361 }, 1e-4), "Biblio2004 · Tracés de fonctions (intégrale sur [0 ; 5])"],
  ["out-cercles", {}, t({ C1x: 7.8731, C1y: 8.9722, C2x: 4.7457, C2y: -0.17276, C3x: 1.4262, C3y: 16.173, C4x: -1.7012, C4y: 7.0279 }, 3e-4), "Biblio2004 · CERCLES (quatre cercles tangents)"],
  ["out-enveloppe-convexe", {}, t({ x1: -1, y1: 56.388, x2: 0.72609, y2: 11.117, x3: 70.615, y3: 32.408, x4: 70.393, y4: 54.783, x5: 0.54618, y5: 85.169 }, 1e-5), "Biblio2004 · Enveloppe convexe"],
];
