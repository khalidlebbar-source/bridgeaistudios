/* Eurocode 2 — valeurs recalculées indépendamment (formules écrites à la main) */
const { sqrt, cbrt, pow, PI, log } = Math;
const fctm = f => 0.3 * pow(f, 2 / 3), fyd = 500 / 1.15;
// flexion rectangulaire : M = 850 kN·m, b = 0,5, d = 0,92, C35
const mu1 = 0.85 / (0.5 * 0.92 ** 2 * 35 / 1.5), a1 = 1.25 * (1 - sqrt(1 - 2 * mu1));
// section en T : axe dans la table
const muT = 4.2 / (2.4 * 1.38 ** 2 * 35 / 1.5), aT = 1.25 * (1 - sqrt(1 - 2 * muT));
// poinçonnement : V = 1,1 MN, poteau 0,6 × 0,6, d = 0,32
const u1 = 2.4 + 4 * PI * 0.32, kP = 1 + sqrt(0.2 / 0.32), vRc = 0.12 * kP * cbrt(0.8 * 35);
// fissuration : section 1 × 0,8, d = 0,73, As = 31,4 cm², αe = 15
const As = 31.4e-4, xF = (-15 * As + sqrt((15 * As) ** 2 + 2 * 15 * As * 0.73)) / 1, IF = xF ** 3 / 3 + 15 * As * (0.73 - xF) ** 2, sF = 15 * 0.42 * (0.73 - xF) / IF;
const hcF = Math.min(2.5 * 0.07, (0.8 - xF) / 3, 0.4), rF = As / hcF, Ecm = 22000 * pow(4.3, 0.3);
const deF = Math.max((sF - 0.4 * fctm(35) / rF * (1 + 200000 / Ecm * rF)) / 2e5, 0.6 * sF / 2e5), srF = 3.4 * pow(0.5, 2 / 3) * 50 + 0.17 * 20 / rF;
module.exports = [
  ["ec2-flexion-rect", {}, { mu: mu1, mul: 0.8 * (3.5 / (3.5 + fyd / 200)) * (1 - 0.4 * (3.5 / (3.5 + fyd / 200))), As: 0.85 / (0.92 * (1 - 0.4 * a1) * fyd) * 1e4, Asmin: 0.26 * fctm(35) / 500 * 0.5 * 0.92 * 1e4 }, "EC2 §6.1 — calcul manuel"],
  ["ec2-flexion-rect", { M: 4000 }, { As2: (4 - 0.8 * (3.5 / (3.5 + fyd / 200)) * (1 - 0.4 * (3.5 / (3.5 + fyd / 200))) * 0.5 * 0.92 ** 2 * 35 / 1.5) / (0.87 * fyd) * 1e4 }, "EC2 §6.1 — aciers comprimés (σs2 = fyd)"],
  ["ec2-flexion-t", {}, { Mt: 2.4 * 0.2 * 35 / 1.5 * (1.38 - 0.1) * 1000, As: 4.2 / (1.38 * (1 - 0.4 * aT) * fyd) * 1e4 }, "EC2 — section en T, calcul manuel"],
  ["ec2-mrd", { As2: 0 }, { MRd: (24.5e-4 * fyd) * (0.73 - 0.4 * 24.5e-4 * fyd / (0.8 * 0.4 * 35 / 1.5)) * 1000 }, "EC2 — MRd sans aciers comprimés"],
  ["ec2-nm-rect", { Ned: 0, As2: 0 }, { MRd: [(49.1e-4 * fyd) * (1.13 - 99 / 238 * 49.1e-4 * fyd / (17 / 21 * 1.2 * 35 / 1.5)) * 1000, 1e-4] }, "EC2 — N = 0 (bloc parabole-rectangle : 0,81 / 0,416)"],
  ["ec2-nm-rect", {}, { Nmax: [1.44 * 35 / 1.5 * 1000 + 98.2e-4 * (400 - 35 / 1.5) * 1000, 2e-3] }, "EC2 — compression centrée (ε = εc2)"],
  ["ec2-nm-circ", {}, { NRd: [PI * 0.36 * 35 / 1.5 * 1000 + 20 * PI * 0.025 ** 2 / 4 * (400 - 35 / 1.5) * 1000, 5e-3], As: 20 * PI * 6.25 / 4 }, "EC2 — compression centrée, section circulaire"],
  ["ec2-vrdc", {}, { k: 1 + sqrt(2 / 3), vmin: 0.34 / 1.5 * sqrt(35), VRdc: 0.34 / 1.5 * sqrt(35) * 0.3 * 1000 }, "EC2 §6.2.2 + AN"],
  ["ec2-vrdc", { type: "p" }, { VRdc: Math.max(0.12 * (1 + sqrt(2 / 3)) * cbrt(100 * 15.7e-4 / 0.3 * 35), 0.053 / 1.5 * pow(1 + sqrt(2 / 3), 1.5) * sqrt(35)) * 0.3 * 1000 }, "EC2 §6.2.2 poutre"],
  ["ec2-poinconnement", {}, { u1, v1: 1.15 * 1.1 / (u1 * 0.32), vRdc: vRc }, "EC2 §6.4"],
  ["ec2-torsion", {}, { At: 0.45 / (2 * 0.4 * fyd * 1.5) * 1e4, Al: 0.45 * 2.8 * 1.5 / (2 * 0.4 * fyd) * 1e4 }, "EC2 §6.3.2"],
  ["ec2-fissuration", {}, { ss: sF, sr: srF, wk: srF * deF }, "EC2 §7.3.4"],
  ["ec2-asmin-fiss", {}, { phis: 14.5, ss: 255, As: 0.4 * 0.79 * 3.2 * 0.3 / 255 * 1e4 }, "EC2 §7.3.2, tableau 7.2N"],
  ["ec2-els", { As2: 0, Mc: 420 }, { ss: sF }, "EC2 §7.2 — section fissurée"],
  ["ec2-ld", {}, { base: 11 + 1.5 * sqrt(30) * sqrt(30) * 1e-3 / 0.004375 + 3.2 * sqrt(30) * pow(sqrt(30) * 1e-3 / 0.004375 - 1, 1.5) }, "EC2 §7.4.2 (7.16a)"],
  ["ec2-ancrage", {}, { fbd: 2.25 * 0.7 * fctm(35) / 1.5, lb: 20 / 4 * 434.8 / (2.25 * 0.7 * fctm(35) / 1.5), lbd: 0.85 * 20 / 4 * 434.8 / (2.25 * 0.7 * fctm(35) / 1.5) }, "EC2 §8.4"],
  ["ec2-recouvrement", {}, { a6: sqrt(2), l0: Math.max(1 - 0.15 * 19 / 16, 0.7) * sqrt(2) * 16 / 4 * 434.8 / (2.25 * 0.7 * fctm(35) / 1.5) }, "EC2 §8.7.3"],
  ["ec2-enrobage", {}, { cdur: 40, cnom: 50 }, "EC2 tableaux 4.3N, 4.4N (XC4, 100 ans → S6)"],
  ["ec2-enrobage", { X: "6/45s", duree: "50", fck: 45 }, { cdur: 40, cnom: 50 }, "XS3, 50 ans, C45 → S3"],
  ["ec2-mandrin", {}, { m: 213000 * (1 / 75 + 1 / 50) / (35 / 1.5) }, "EC2 §8.3 (8.1)"],
  ["ec2-pression-localisee", {}, { Fr: 0.2 * 35 / 1.5 * 2.6 * 1000, Ta: 0.25 * (1 - 1 / 2.6) * 4500 }, "EC2 §6.7"],
  ["ec2-elancement", {}, { lam: 28 / (1.2 / sqrt(12)), lim: 20 * 0.7 * sqrt(1 + 2 * 0.012 * fyd / (3 * 35 / 1.5)) / sqrt(12 / (3 * 35 / 1.5)) }, "EC2 §5.8.3.1"],
  ["ec2-courbure", {}, { e2: (fyd / 2e5) / (0.45 * 1.12) * 28 ** 2 / 10, Med: (6 + 12 * (2 / 3) / 200 * 14) * 1000 + 12 * (fyd / 2e5) / (0.45 * 1.12) * 78.4 * 1000 }, "EC2 §5.8.8"],
  ["ec2-interface", {}, { v: 0.8 / (0.9 * 0.6), vr: 0.4 * 0.7 * fctm(35) / 1.5 + 20e-4 / 0.6 * fyd * 0.7 }, "EC2 §6.2.5"],
  ["ec2-membrure", {}, { v: 3 / 1.6 * 0.42 / (0.25 * 5), Af: 3 / 1.6 * 0.42 / 5 / (fyd * 2) * 1e4 }, "EC2 §6.2.4"],
  ["ec2-console", { Hc: 0 }, { Ft: 900 * 0.25 / (0.64 - (0.64 - sqrt(0.64 ** 2 - 2 * 0.9 * 0.25 / (0.5 * 0.85 * 0.86 * 35 / 1.5))) / 2) }, "EC2 §6.5 — bielle-tirant"],
  ["ec2-ferraillage-min", {}, { Asmin: 0.26 * fctm(35) / 500 * 0.5 * 0.92 * 1e4, Ascol: 0.002 * 0.5 * 1e4 }, "EC2 §9.2.1.1, §9.5.2"],
];
