/* Biblio 2004 — Ouvrages mixtes : valeurs relevées dans les classeurs Excel ou recalculées à la main */
module.exports = [
  ["ec4-poteau-rempli", { gm: "1.1 1.5 1.15" }, { Npl: [15438, 1e-4], hn: [0.013464, 5e-5], Mmax: [1387.3, 1e-4], Mpl: [1382, 1e-4], delta: [0.84515, 5e-5] }, "Biblio2004 · EC4.xls (γa = 1,1 : Npl,Rd = 1 543,8 t, Mpl,Rd = 138,2 tm, MD/Mpl = 1,0038)"],
  ["ec4-poteau-rempli", {}, { EI: [106.36879, 1e-6], lam: [1.0241387, 1e-6], chi: [0.5817807, 1e-6], k: [1.0539813, 1e-6], Mmx: [1138.8687, 1e-6] }, "Calcul manuel : EN 1994-1-1 §6.7.3 (courbe b, e0 = L/200)"],
  ["act-bipoutre-superstructures", {}, { nomT: [173.2, 1e-9], maxT: [186.886, 1e-6], minT: [153.642, 1e-6] }, "Biblio2004 · Cp_mix.xls (17,32 / 18,689 / 15,364 t/m pour l'ensemble)"],
  ["act-bipoutre-superstructures", {}, { gN: [92.19455, 1e-6], Mg: [-109.47453, 1e-5] }, "Calcul manuel : levier ½ − e/lp et moment d'encorbellement gauche (charges maxi)"],
];
