/* Biblio 2004 — Béton armé : valeurs relevées dans les classeurs Excel (tonnes × 10 → kN) */
const t = (o, tol = 2e-4) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v : [v, tol]]));
const DEVQQ = { pts: "-6.5 2.25 ; -5.5 2.25 ; -5.4 2.15 ; -1.2 2.15 ; -1 2.25 ; -1 3.5 ; -1.6 3.7 ; -1.6 4 ; -0.6 4 ; -0.6 -4 ; -1.6 -4 ; -1.6 -3.7 ; -1 -3.5 ; -1 -2.25 ; -1.2 -2.15 ; -5.4 -2.15 ; -5.5 -2.25 ; -6.5 -2.25 ; -6.5 -1.75 ; -5.5 -1.75 ; -5.4 -1.85 ; -1.2 -1.85 ; -1 -1.65 ; -1 1.65 ; -1.2 1.85 ; -5.4 1.85 ; -5.5 1.75 ; -6.5 1.75",
  ac: "-6.25 2.125 -5.75 2.125 12.56 3 ; -6.25 1.875 -5.75 1.875 12.56 3 ; -6.25 -2.125 -5.75 -2.125 12.56 3 ; -6.25 -1.875 -5.75 -1.875 12.56 3", Ne: 962.02, Mx: 0, My: 11272, app: "o" };
module.exports = [
  ["bael-flexion-deviee", {}, t({ a: 14.0753197814826, b: -3.85434678381227, c: -74.1820324101206, ss: -400.159888022991, sb: 14.0753197814826 }, 1e-5), "Biblio2004 · Dev_rec.xls (100 × 100, N = −10,3 t, Mb = −23 tm, Mh = −35,2 tm)"],
  ["bael-flexion-deviee", DEVQQ, t({ a: 2.69474386872411, b: 2.14559910898555, sb: 1.40738440333278, ss: -160.728758436534, ssc: -144.636765119142 }), "Biblio2004 · Dev_qq.xls (section quelconque, N au point (0 ; 0))"],
  ["bael-interaction", {}, { Nmax: [11880, 1e-6], Nmin: [-4000, 1e-6], Mmax: [1425.7, 0.015] }, "Biblio2004 · MN_ELS.xls, section rectangulaire (Mmax : la feuille échantillonne 137 points)"],
  ["bael-interaction", { forme: "c", D: 0.8, As: 25, sbc: 12.498, sbm: 6.25, sst: -189 }, t({ Nmax: 3375.96765358979, Nmin: -472.5, Mmax: 410.400266641249 }, 5e-4), "Biblio2004 · MN_ELS.xls, section circulaire"],
  ["bael-interaction", { forme: "a", D: 0.9, Di: 0.3, As: 22, sbc: 12.498, sbm: 6.25, sst: -189 }, t({ Nmax: 3740.54173528852, Nmin: -415.8, Mmax: 558.976143234884 }, 5e-4), "Biblio2004 · MN_ELS.xls, section annulaire"],
  ["bael-interaction", { et: "u", b: 0.95, rep: 100 }, t({ Nmax: 18335.9998672047, Nmin: -8695.65217391304, Mmax: 3869.58909925749 }, 1e-3), "Biblio2004 · MN_ELU.xls, section rectangulaire"],
  ["bael-interaction", { et: "u", forme: "c", D: 0.5, As: 46.14, c: 0.14 }, t({ Nmax: 4515.95371672459, Nmin: -2006.08695652174, Mmax: 210.371758314224 }, 2e-3), "Biblio2004 · MN_ELU.xls, section circulaire"],
  ["bael-interaction", { et: "u", forme: "a", D: 0.75, Di: 0.25, As: 46.14, c: 0.14 }, t({ Nmax: 7186.30747673143, Mmax: 668.359755037504 }, 1e-3), "Biblio2004 · MN_ELU.xls, section annulaire"],
  ["bael-torsion", {}, t({ b0: 0.13333, Om: 0.64444, u: 3.2667, tT: 0.57491, At: 1.7631, Atmin: 1.2267, Al: 5.7594, Almin: 4.0071 }), "Biblio2004 · A_TOR.XLS"],
  ["bael-forfaitaire", {}, t({ al: 1 / 3, Mtmin: 550, Mwmin: 400, Memin: 500, sum: 1100, reg: 1100, pl2: 8781.8, xm: 0.47723 }), "Biblio2004 · Methforf.xls"],
  ["bael-poutre-voile", {}, t({ l: 6, M0: 2700, V0: 1800, bmin: 0.152638, z: 2.4, Ainf: 12.4583, Asup: 8.625, tu: 2.25, Av: 7.7625, rh: 0.00504562, Ahi: 7.7625, Ahc: 2.32875, Ahs: 6.05475 }), "Biblio2004 · Pouvoile.xls"],
  ["ba-voute-decharge", {}, t({ Atie: 5.60625, l2: 1.21875, q: 320, Vnu: 313.3849453125, Ainf: 9.00981717773438, sb: 11.1923194754464, tu: 2.253849453125, At1: 13.2286846373895, At2: 2, Mu: 171.019678985596, As: 11.4403670777038 }, 1e-6), "Biblio2004 · Voute.xls"],
  ["bael-dalle-4-cotes", {}, t({ al: 0.566667, mux: 0.0856667, muy: 0.0685659, Mx: 29.7092, My: 2.03704, pv1: 25.5, V1: 43.35, pv2: 36.55, V2: 109.65, pm1: 34, M1: 49.13, pm2: 45.5411, M2: 204.935 }), "Biblio2004 · Hourdis.xls"],
  ["rdm-dalle-pucher", { nm: 58 }, t({ Mxo: 30.0011, Myo: 24.0077 }), "Biblio2004 · Pucher.xls (x = 2,85 m, 58 termes comme la feuille)"],
  ["rdm-dalle-pucher", { nm: 58, xo: 0.45 }, t({ Mxo: 2.1903, Myo: 2.1675 }), "Biblio2004 · Pucher.xls (x = 0,45 m)"],
  ["rdm-dalle-pucher", { nm: 58, xo: 5.85 }, t({ Mxo: 0.718, Myo: 0.7157 }, 5e-4), "Biblio2004 · Pucher.xls (x = 5,85 m)"],
  ["rdm-encorbellement", {}, t({ lam: 1.41863, mu: 1.16842, q1: 0.001335, Mmax: -5.34464 }), "Biblio2004 · ENCORBEL.XLS"],
  ["ch-boucle-levage", {}, t({ d: 16.287, dm: 65.147, r1: 19.544, r2: 32.574 }), "Biblio2004 · Levage.xls"],
  ["anc-bassin-circulaire", {}, t({ beta: 0.537284965911771, M0: 131.72, T0: 162.57, Nh: -393.97, Av: 10.7239, Ah: 11.1693, sbh: -0.4727, slim: 176.363 }, 3e-4), "Biblio2004 · Bassin.xls (pied encastré)"],
];
