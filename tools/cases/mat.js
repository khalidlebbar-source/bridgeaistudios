/* Matériaux (compléments) et outils — valeurs recalculées à la main */
const { sqrt, PI, pow, exp, log, sin, tan, cos } = Math;
const h0 = 2 * 2.2 / 12 * 1000, fcm = 43, a1 = pow(35 / 43, 0.7), a2 = pow(35 / 43, 0.2), a3 = pow(35 / 43, 0.5);
const pRH = (1 + 0.3 / (0.1 * Math.cbrt(h0)) * a1) * a2, phi0 = pRH * 16.8 / sqrt(43) / (0.1 + pow(28, 0.2)), bH = min(1.5 * (1 + pow(0.84, 18)) * h0 + 250 * a3, 1500 * a3);
function min(a, b) { return Math.min(a, b); }
module.exports = [
  ["acier-ba", {}, { fyd: 500 / 1.15, eud: 45, sud: 500 / 1.15 + (1.08 * 500 / 1.15 - 500 / 1.15) * (0.045 - 500 / 1.15 / 2e5) / (0.05 - 500 / 1.15 / 2e5) }, "EC2 §3.2.7, classe B"],
  ["fluage-ec2", {}, { phi0, phi: phi0 * pow(36472 / (bH + 36472), 0.3) }, "EC2 annexe B"],
  ["beton-sargin", {}, { ec1: 0.7 * pow(43, 0.31), k: 1.05 * 22000 * pow(4.3, 0.3) * 0.7 * pow(43, 0.31) / 1000 / 43 }, "EC2 (3.14)"],
  ["deformation-imposee", {}, { dl: 1e-5 * 15 * 30000, s: 0.5 * 34000 * 1.5e-4 }, "Déformation gênée"],
  ["beton-confine", {}, { s2: 0.8 * 2 * 1.13e-4 * 500 / 0.16, fckc: 35 * (1 + 5 * 0.565 / 35) }, "EC2 (3.24)"],
  ["conformite-en206", {}, { c1: 35 + 1.48 * 3.6, c2: 31 }, "NF EN 206 tableau 14"],
  ["conformite-en206", { mode: "i" }, { c1: 39 }, "Production initiale : fck + 4"],
  ["out-conversions", {}, { t: 1000 / 9.80665, bar: 250, gr: 50 }, "Conversions"],
  ["out-armatures", {}, { A: 8 * PI, Am: PI * 100 / 15 }, "Sections d'acier"],
  ["out-courbe", {}, { T: 600 * tan(PI / 16), Dv: 600 * PI / 8, fc: 600 - sqrt(360000 - 400) }, "Arc de cercle"],
  ["out-raccordement", {}, { R: 6000, z: 100 + 3.6 - 0.05 * 14400 / 600, xs: 180 }, "Raccordement parabolique"],
  ["out-biais", {}, { Ld: 18 * sin(0.35 * PI), lb: 12 / sin(0.35 * PI) }, "Biais 70 gr"],
];
