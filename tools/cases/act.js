/* Actions sur les ponts — valeurs recalculées à la main */
const { sqrt, PI, log, pow } = Math;
const cr = 0.19 * log(15 / 0.05), qp = (1 + 7 / log(15 / 0.05)) * 0.5 * 1.225 * (cr * 24) ** 2 / 1000;
module.exports = [
  ["act-lm1", {}, { n: 3, tot: 540 + 756 + 320 + 300 + 160 + 300 + 150 }, "EN 1991-2 LM1, 2e classe (AN)"],
  ["act-lm1", { w: 5.6, cl: "EN" }, { n: 2, wl: 2.8 }, "5,4 ≤ w < 6 m : 2 voies de w/2"],
  ["act-freinage-lm1", {}, { Ql: 0.6 * 0.9 * 600 + 0.1 * 0.7 * 9 * 3 * 80 }, "EN 1991-2 (4.6)"],
  ["act-freinage-lm1", { L: 1000, cl: "EN" }, { Ql: 900 }, "Plafond 900 kN"],
  ["act-systeme-b", {}, { bc: 1.1, Bc: 2 * 600 * 1.1 * 1.12 }, "Fascicule 61 — Bc"],
  ["act-militaires", {}, { M: 1100 * 1.1 * (50 - 6.1) / 8 }, "Mc120 centré"],
  ["act-trottoirs", {}, { qp: 2 + 120 / 70 }, "EN 1991-2 (5.1)"],
  ["act-vent", {}, { qp, cf: 2.4 - (12 / 3.2 - 0.5) * 1.1 / 3.5, F: qp * (2.4 - (12 / 3.2 - 0.5) * 1.1 / 3.5) * 3.2 }, "EN 1991-1-4, terrain II"],
  ["act-temp-uniforme", {}, { Temax: 39.5, Temin: -7, ucon: 1e-5 * 37 * 60000, uexp: 1e-5 * 49.5 * 60000 }, "EN 1991-1-5 figure 6.1 (type 3)"],
  ["act-gradient", {}, { dh: 7, M2: 1.5 * 3.5e5 * 1e-5 * 7 / 2.5 * 1000 }, "EN 1991-1-5 tableaux 6.1, 6.2"],
  ["act-combinaisons", {}, { Eu: 1.35 * 14500 + 1.35 * 9000, Eq: 14500 + 750 }, "EN 1990/A2"],
  ["act-superstructures", {}, { gmax: 1.4 * 20.16 + 1.2 * 3.15 + 19.5 }, "EN 1991-1-1 §5.2.3"],
  ["act-choc", { route: "50/25", veh: "v" }, { Fx: 50, Fy: 25, h: 0.5 }, "EN 1991-1-7 tableau 4.1"],
  ["act-lm71", {}, { p2: 1.44 / (sqrt(20) - 0.2) + 0.82, p3: 2.16 / (sqrt(20) - 0.2) + 0.73 }, "EN 1991-2 (6.4), (6.5)"],
  ["act-freq-ferro", {}, { n0: PI / (2 * 625) * sqrt(1.2e11 / 18000), up: 94.76 * pow(25, -0.748), lo: 23.58 * pow(25, -0.592) }, "EN 1991-2 figure 6.10"],
  ["act-passerelle", {}, { f1: PI / (2 * 1600) * sqrt(4e9 / 2500), plage: 2 }, "Guide Sétra"],
  ["act-diffusion-roue", {}, { u0: 0.4 + 0.16 + 0.25 }, "EN 1991-2 §4.3.6"],
];
