/* Biblio 2004 — Géotechnique : valeurs relevées dans les classeurs Excel (tonnes × 10 → kN) */
const t = (o, tol = 2e-4) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v : [v, tol]]));
module.exports = [
  ["geo-semelle-diagramme", {}, t({ Nt: 960, pa: 503.377332726448, pb: -1510.13199817934, pc: -125.844333181614, smax: 1635.97633136095, s34: [1226.98, 1e-5], pS: 25.1488095238095 }, 1e-6), "Biblio2004 · Sem_rec.xls (3,5 × 2 m, N = 40 t au point (1 ; 1), q = 8 t/m²)"],
  ["geo-pieu-flambement", {}, t({ lam: 0.77817, Ncr: 10850.6, lf: 3.77992, m: 38.9815 }, 1e-4), "Biblio2004 · Flambela.xls (tête encastrée, pied articulé)"],
  ["geo-battage", {}, t({ R1: 347.222, R2: 694.441, R3: 416.667, R4: 260.417, R5: 332.834 }), "Biblio2004 · Battage.xls"],
  ["geo-candelabre", {}, t({ V: 30.44, Ms: 16.4226, Mr: 16.2, F: 1.01374 }), "Biblio2004 · CANDEL.XLS"],
  ["geo-colonnes-ballastees", {}, t({ a: 0.04, Ka: 0.27099, Er: 8.98297, b: 1.31932, n: 8.98297 }), "Biblio2004 · Ballast.xls (Baumann)"],
];
module.exports.push(
  ["geo-micropieux", {}, { Nmax: [751.13, 2e-4], Nmin: [24.408, 3e-4] }, "Biblio2004 · MICRO_P.XLS (12 micropieux dont 4 inclinés à 15°)"],
  ["geo-qce", { ecr: "n" }, t({ a: 0.5, b: 0.5, qce: 2.91313, De: [4.6771, 1e-4] }), "Biblio2004 · Qce_prof.xls (De exact 4,677 m ; la feuille, intégrée en 40 pas, donne 4,681)"],
  ["geo-krey", {}, t({ K: 0.700208, S: 84, F: 58.8174, z1: 0.545955, z2: 3.856, f: 17.7694 }), "Biblio2004 · Krey.xls (charge filante)"],
  ["geo-krey", { typ: "p" }, t({ S: 100.8, F: 70.5809, f: 7.8975 }), "Biblio2004 · Krey.xls (charge localisée)"],
  ["geo-kh-ecran", {}, t({ kh: 5561.74 }), "Biblio2004 · CALCULKF.XLS (rideau infini)"],
  ["geo-pieu-modele-barre", {}, t({ L1: 1.56435, L2: 3.1287, Lo: 2.34652, E0: 3144280, k2: 616388, k3: 391151 }), "Biblio2004 · Mod_pieu.xls"],
);
