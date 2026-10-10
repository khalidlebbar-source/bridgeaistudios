/* Précontrainte — valeurs recalculées à la main */
const { sqrt, exp, log, pow, cbrt } = Math;
const k = 0.18 * 0.35 / 40 + 0.002, lam = -log(1 - sqrt(0.006 * 195000 * k / 1488)) / k;
const rho = 0.33 / (0.8 * 0.7 * 1.1);
module.exports = [
  ["pc-frottement-recul", {}, { sL: 1488 * exp(-(0.18 * 0.35 + 0.002 * 40)), lam, s0p: 1488 * exp(-2 * k * lam) }, "BPEL 3.3.1 — intégrale exacte du recul"],
  ["pc-frottement-recul", { al: 0, phi: 0.002, g: 6 }, { lam: [sqrt(0.006 * 195000 / (1488 * 0.002)), 0.03] }, "Recul (écart < 3 %) : approximation linéaire λ ≈ √(gEp/σ0k)"],
  ["pc-raccourcissement", {}, { dB: 0.5 * 195000 / (11000 * cbrt(30)) * 9, dE: 5 / 12 * 195000 / (11000 * cbrt(30)) * 9 }, "BPEL 3.3.23 / EC2 5.44"],
  ["pc-relaxation", {}, { dB: 0.06 * 2.5 * (1350 / 1860 - 0.43) * 1350, dE: 0.66 * 2.5 * exp(9.1 * 1350 / 1860) * pow(500, 0.75 * (1 - 1350 / 1860)) * 1e-5 * 1350 }, "BPEL 3.3.24 / EC2 (3.29)"],
  ["pc-pertes-bpel", {}, { dr: 195000 * 3e-4 * 0.8, dfl: 18 * 195000 / (11000 * cbrt(35)), tot: 46.8 + 18 * 195000 / (11000 * cbrt(35)) + 5 / 6 * 0.06 * 2.5 * (1350 / 1860 - 0.43) * 1350 }, "BPEL 3.3.2"],
  ["pc-pertes-ec2", {}, { d: (58.5 + 48 + 195 / 34 * 1.8 * 8) / (1 + 195 / 34 * 0.009 / 0.8 * (1 + 0.8 / 0.33 * 0.85 ** 2) * (1 + 0.8 * 1.8)) }, "EC2 (5.46)"],
  ["pc-contraintes", {}, { s1: 8.3 / 0.8 + (4.5 - 8.3 * 0.9) * 0.7 / 0.33, i2: 7.3 / 0.8 - (9 - 7.3 * 0.9) * 1.1 / 0.33 }, "Navier"],
  ["pc-noyau", {}, { rho, c: rho * 0.7, cp: rho * 1.1 }, "Noyau central"],
  ["pc-pmin", {}, { P1: 4.5 / (rho * 1.8), P2: 9 / (rho * 0.7 + 0.95) }, "Guyon"],
  ["pc-fuseau", {}, { lo: rho * 1.1 + 4.5 / 7.3, hi: 9 / 7.3 - rho * 0.7 }, "Fuseau de passage"],
  ["pc-parabole", {}, { q: 8 * 7000 * 0.75 / 33 ** 2, a0: Math.atan(3 / 33), y: 3 * 8 * 25 / 33 ** 2 }, "Parabole"],
  ["pc-hyperstatique", {}, { X: 8 * 30 * (0.6 / 3 - 0.55 / 6) / 10, Mt: 8 * 0.55 + 8 * 30 * (0.6 / 3 - 0.55 / 6) / 10 }, "Intégrale analytique ∫e·x/L = L(em/3 + e2/6)"],
  ["pc-about", {}, { As: 0.04 * 2.9 / (1000 / 3) * 1e4, Fe: 0.25 * 0.5 * 2900, Fr: 0.09 * 20 * 2 * 1000 }, "BPEL annexe 4 / EC2 6.7"],
  ["pc-mise-tension", {}, { F: 1470 * 1800 / 1000, smax: 1476, p: 1470 * 1800 * 1.02 / 106000 * 10 }, "EC2 5.10.2.1"],
  ["pc-poussee-vide", {}, { q: 3500 / 12, A: 3500 / 12 * 0.15 / 1000 / (500 / 1.15) * 1e4 }, "q = P/R"],
  ["pc-tranchant", {}, { acw: 1.25, Vmax: 1.25 * 0.25 * 1.45 * 0.6 * (1 - 0.16) * 40 / 1.5 * 1000 / (1.5 + 1 / 1.5) }, "EC2 6.2.3 (6.11aN)"],
  ["pc-mrd", {}, { MRd: 10.4 * 1.55 + (13.704348 - 10.4) * (1.65 - 0.4 * (13.704348 - 10.4) / (0.8 * 0.25 * 40 / 1.5)) + 0.002 * 500 / 1.15 * 0.09 }, "Section en T, palier horizontal"],
  ["pc-pretension", {}, { lpt: 1.25 * 0.19 * 15.7 * 1350 / (3.2 * 0.7 * 2.9 / 1.5) }, "EC2 8.10.2.2"],
];
