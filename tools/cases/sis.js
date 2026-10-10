/* Séisme — valeurs recalculées à la main */
const { sqrt, PI, pow, sin, cos, atan } = Math, r = d => d * PI / 180;
const kh = 1.92 / 9.81 * 1.5, kv = kh / 2, f = r(30), d = r(20);
const KMO = th => sin(PI / 2 + f - th) ** 2 / (cos(th) * sin(PI / 2 - th - d) * (1 + sqrt(sin(f + d) * sin(f - th) / sin(PI / 2 - th - d))) ** 2);
const T = 2 * PI * sqrt(2400 / 50000);
module.exports = [
  ["sis-acceleration", {}, { ag: 1.92, S: 1.5, pl: 2.5 * 1.92 * 1.5 }, "Zone 4, catégorie III, sol C (AN)"],
  ["sis-acceleration", { zone: "3.0", sol: "E", imp: "1" }, { S: 1.4, ag: 3 }, "Zone 5, sol E : S = 1,4"],
  ["sis-monomodal", {}, { T, Sd: 1.92 * 1.5 * 2.5 / 1.5 * 0.4 / T, F: 2400 * 1.92 * 1.5 * 2.5 / 1.5 * 0.4 / T }, "Mode fondamental"],
  ["sis-q", {}, { q: 3.5 }, "EN 1998-2 tableau 4.1 (αs ≥ 3)"],
  ["sis-q", { Ls: 5, Ned: 50 }, { q: (3.5 * sqrt(2 / 3)) - ((50 / (4.5 * 35)) / 0.3 - 1) * (3.5 * sqrt(2 / 3) - 1) }, "Réduction pour ηk > 0,3"],
  ["sis-capacite", {}, { g0: 1.35 * (1 + 2 * 0.02 ** 2), VC: 45 * 1.35 * (1 + 2 * 0.02 ** 2) / 12 }, "EN 1998-2 (5.2)"],
  ["sis-confinement", {}, { wreq: 4.5 / 3.9 * 0.37 * 0.12 + 0.13 * (500 / 1.15) / (35 / 1.5) * 0.005, wd: 0.12 }, "EN 1998-2 (6.7)"],
  ["sis-longueur-appui", {}, { dg: 0.025 * 1.92 * 1.5 * 0.4 * 2 * 1000, lov: 400 + 2 * 57.6 / 400 * 100 + 120 }, "EN 1998-2 §6.6.4"],
  ["sis-mononobe", {}, { kh, Ed: 0.5 * 20 * (1 + kv) * KMO(atan(kh / (1 + kv))) * 49 }, "Mononobe-Okabe (annexe E)"],
  ["sis-liquefaction", {}, { CSR: 0.65 * 2.88 / 9.81 * 114 / (114 - 4 * 9.81) * (1 - 0.00765 * 6), CRR: 1 / 14 + 20 / 135 + 50 / 245 ** 2 - 0.005 }, "Seed-Idriss / NCEER"],
  ["sis-westergaard", { sec: "r", ax: 2, ay: 2 }, { k: 1.51, ma: 1.51 * PI }, "EN 1998-2 tableau F.1 (ay/ax = 1)"],
  ["sis-combinaison", {}, { E30: 12000 + 2400 + 450, Esr: sqrt(144e6 + 64e6 + 2.25e6) }, "Règle des 30 % / SRSS"],
];
