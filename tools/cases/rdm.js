/* RDM — valeurs de formulaire (calcul manuel ou tables classiques) */
const { sqrt, PI, pow } = Math;
module.exports = [
  ["rdm-isostatique", {}, { RA: 450 + 300 * 12 / 20, M: 630 * 8 - 45 * 64 / 2, fq: 5 * 45 * 20 ** 4 / (384 * 1.2e7) * 1000 }, "Poutre sur deux appuis"],
  ["rdm-isostatique", { P: 0 }, { M: 45 * 400 / 8 }, "qL²/8"],
  ["rdm-console", {}, { M: 20 * 16 / 2 + 200, f: (20 * 256 / (8 * 4e5) + 50 * 64 / (3 * 4e5)) * 1000 }, "Console"],
  ["rdm-encastree", {}, { Ma: -(60 * 144 / 12 + 200 * 12 / 8), f: (60 * 12 ** 4 / (384 * 3e6) + 200 * 1728 / (192 * 3e6)) * 1000 }, "Bi-encastrée"],
  ["rdm-continue-2", { L1: 30, L2: 30 }, { MB: -150 * 900 / 8 }, "2 travées égales : −qL²/8"],
  ["rdm-continue-2", {}, { MB: -150 * (27000 + 64000) / (8 * 70) }, "Clapeyron"],
  ["rdm-continue-3", { L1: 30, L2: 30, L3: 30 }, { MB: -0.1 * 180 * 900, M2: 0.025 * 180 * 900 }, "3 travées égales : −0,100 qL² / +0,025 qL²"],
  ["rdm-section-t", { bi: 0, hi: 0 }, { A: 2.5 * 0.2 + 0.3 * 1.4, v: (0.5 * 0.1 + 0.42 * 0.9) / 0.92 }, "Section en T"],
  ["rdm-section-circ", { e: 0 }, { I: PI * 16 / 64, A: PI }, "Disque plein"],
  ["rdm-bredt", {}, { q: 8000 / 33.6, J: 4 * 16.8 ** 2 / (6 / 0.25 + 6 / 0.22 + 5.6 / 0.45) }, "Bredt"],
  ["rdm-euler", {}, { Ncr: PI ** 2 * 5000 / 576 * 1000 }, "Euler, console"],
  ["rdm-ligne-influence", {}, { MT: 300 * (7.5 + 6.9), MU: 27 * 30 * 7.5 / 2 }, "Ligne d'influence"],
  ["rdm-arc", {}, { H: 220 * 6400 / 96, M: 40 * 6400 / 64 }, "Arc parabolique"],
  ["rdm-cable", {}, { H: 30 * 14400 / 96, Lc: 120 * (1 + 8 / 3 * 0.01) }, "Câble parabolique"],
  ["rdm-dalle-navier", { a: 1, b: 1, nu: 0.3, q: 1, h: 0.1, E: 1000 }, { mx: [0.0479, 2e-3], w: [0.00406 / (1e6 * 1e-3 / (12 * 0.91)) * 1000, 2e-3] }, "Timoshenko : carré, ν = 0,3 → 0,0479 qa², 0,00406 qa⁴/D"],
  ["rdm-dalle-navier", { a: 1, b: 2, nu: 0.3, q: 1 }, { mx: [0.1017, 2e-3] }, "Timoshenko : b/a = 2 → 0,1017 qa²"],
  ["rdm-frequence", {}, { f1: PI / (2 * 900) * sqrt(5e10 / 12000) }, "Appuis simples"],
  ["rdm-frequence", { cas: "cl" }, { f1: 1.875 ** 2 / (2 * PI * 900) * sqrt(5e10 / 12000) }, "Console"],
  ["rdm-winkler", {}, { lam: pow(45000 / 3.6e6, 0.25), M0: 800 / (4 * pow(45000 / 3.6e6, 0.25)) }, "Hetényi"],
  ["rdm-mohr", {}, { s1: 140, s2: -60, vm: sqrt(14400 + 1600 + 4800 + 3 * 3600) }, "Mohr / von Mises"],
];
