/* Charpente métallique — valeurs recalculées à la main */
const { sqrt, PI, pow } = Math;
const Ncr = PI ** 2 * 210000 * 14000e4 / 8000 ** 2, lam = sqrt(12000 * 355 / Ncr), ph = 0.5 * (1 + 0.34 * (lam - 0.2) + lam ** 2);
const eps345 = sqrt(235 / 345), kt = 5.34 + 4 * (2300 / 4000) ** 2, lw = 2300 / (37.4 * 18 * eps345 * sqrt(kt));
module.exports = [
  ["acier-charpente", {}, { fy: 335, fu: 470 }, "EN 10025-2 : S355, 40 < t ≤ 63"],
  ["acier-charpente", { nu: "460", t: 30 }, { fy: 440 }, "EN 10025-4 : S460M, 16 < t ≤ 40"],
  ["ec3-proprietes", {}, { A: 1380, zG: 133.62e6 / 138000, zp: 510 }, "Section bi-poutre : calcul manuel"],
  ["ec3-proprietes", {}, { Wpl: (60000 * 480 + 450 * 20 * 225 + 1850 * 20 * 925 + 32000 * 1870) / 1000 }, "Module plastique par rapport à zpl = 510 mm"],
  ["ec3-resistance", {}, { Wpl: (500 * 30 * 1170 + 16 * 1140 ** 2 / 4) / 1000, Vpl: 1140 * 16 * 345 / sqrt(3) / 1000 }, "EN 1993-1-1 §6.2.5, 6.2.6"],
  ["ec3-voilement-cis", {}, { kt, lw, Vbw: 0.83 / lw * 345 * 2300 * 18 / (sqrt(3) * 1.1) / 1000 }, "EN 1993-1-5 §5"],
  ["ec3-flambement", {}, { Ncr: Ncr / 1000, lam, chi: 1 / (ph + sqrt(ph ** 2 - lam ** 2)) }, "EN 1993-1-1 §6.3.1"],
  ["ec3-flambement", { Lcr: 1 }, { chi: 1 }, "Plateau λ̄ ≤ 0,2"],
  ["ec3-soudure", {}, { fvw: 470 / (sqrt(3) * 0.9 * 1.25), areq: 750 / (470 / (sqrt(3) * 0.9 * 1.25)) }, "EN 1993-1-8 §4.5.3.3"],
  ["ec3-boulon-cis", {}, { Fv: 0.6 * 800 * 353 / 1.25 / 1000, Fb: 2.5 * (50 / 78) * 470 * 24 * 20 / 1.25 / 1000 }, "EN 1993-1-8 tableau 3.4"],
  ["ec3-boulon-hr", {}, { Fp: 0.7 * 1000 * 353 / 1000, Fs: 2 * 0.5 * 247.1 / 1.25 }, "EN 1993-1-8 §3.9"],
  ["ec3-boulon-traction", {}, { Ftr: 0.9 * 1000 * 353 / 1.25 / 1000, Bp: 0.6 * PI * 37.8 * 20 * 470 / 1.25 / 1000 }, "EN 1993-1-8 tableau 3.4"],
  ["ec3-fatigue", {}, { dD: 0.737 * 71, dR: 0.737 * 71 * pow(0.5, 0.2), lim: 71 / 1.35 }, "EN 1993-1-9"],
  ["ec3-largeur-efficace", {}, { ks: 23.9, rho: ((2300 / 18) / (28.4 * eps345 * sqrt(23.9)) - 0.11) / ((2300 / 18) / (28.4 * eps345 * sqrt(23.9))) ** 2 }, "EN 1993-1-5 §4.4"],
  ["ec3-patch", {}, { ly: 600 + 120 * (1 + sqrt(335 * 1000 / (345 * 20) + 0.02 * (2300 / 60) ** 2)) }, "EN 1993-1-5 §6.5"],
  ["ec3-traction", {}, { An: 60 - 2 * 2.6 * 1.5, Nu: 0.9 * 52.2 * 100 * 470 / 1.25 / 1000 }, "EN 1993-1-1 §6.2.3"],
  ["ec3-tiges-ancrage", {}, { Ftr: 0.85 * 0.9 * 500 * 561 / 1.25 / 1000 }, "EN 1993-1-8 §3.6.1"],
  ["ec3-classe", {}, { rf: (242 - 6 * sqrt(2)) / 30, rw: (1140 - 12 * sqrt(2)) / 16, cls: 3 }, "EN 1993-1-1 tableau 5.2"],
  ["ec3-deversement", {}, { Mcr: (() => { const Iz = 2 * 30 * 500 ** 3 / 12 + 1140 * 16 ** 3 / 12, It = (2 * 500 * 30 ** 3 + 1170 * 16 ** 3) / 3, Iw = Iz * 1170 ** 2 / 4, L = 8000;
    return 1.13 * PI ** 2 * 210000 * Iz / L ** 2 * sqrt(Iw / Iz + L ** 2 * 81000 * It / (PI ** 2 * 210000 * Iz)) / 1e6; })() }, "Mcr, appuis à fourche"],
];
