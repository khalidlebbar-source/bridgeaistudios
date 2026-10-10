/* Ouvrages mixtes — valeurs recalculées à la main */
const { sqrt, PI, pow } = Math, Ecm = 22000 * pow(4.3, 0.3);
module.exports = [
  ["ec4-goujon", {}, { P1: 0.8 * 450 * PI * 22 ** 2 / 4 / 1.25 / 1000, P2: 0.29 * 22 ** 2 * sqrt(35 * Ecm) / 1.25 / 1000 }, "EN 1994-1-1 (6.18), (6.19)"],
  ["ec4-goujon", { hsc: 75, d: 25 }, { al: 0.8 }, "α = 0,2 (hsc/d + 1) pour 3 ≤ hsc/d ≤ 4"],
  ["ec4-connexion", {}, { vu: 2600 * 0.78 / 15.5 * 0.42 / 0.19, s: 4 * 122 / (2600 * 0.78 / 15.5 * 0.42 / 0.19) }, "Flux élastique V·S/I"],
  ["ec4-largeur", {}, { Le: 42.5, beff: 6, bend: 0.5 + 2.25 + (0.55 + 0.025 * 42.5 / 3.25) * 3.25 }, "EN 1994-1-1 §5.4.1.2"],
  ["ec4-equivalence", {}, { n0: 210000 / Ecm, nP: 210000 / Ecm * (1 + 1.1 * 1.4), nS: 210000 / Ecm * (1 + 0.55 * 2.2) }, "EN 1994-1-1 (5.6)"],
  ["ec4-mpl", {}, { x: 280 + (37260 - 15866.667) / 2 * 1000 / 345 / 18 - 18000 / 18 }, "Équilibre plastique (axe dans l'âme)"],
  ["ec4-mpl", { beff: 10 }, { x: 37260 / (0.85 * 35 / 1.5 * 10 * 1000) * 1000 }, "Axe dans la dalle"],
  ["ec4-retrait", {}, { Nf: 3e-4 * 210000 / 18 * 0.8 * 1000 }, "Effort de retrait bloqué"],
  ["ec4-fissuration", {}, { kc: 1, ss: 255, As: 0.9 * 0.8 * 3.2 * 0.25 / 255 * 1e4 }, "EN 1994-1-1 (7.1)"],
  ["ec4-phasage", {}, { g: 10 + 25 * 0.27 * 6, Mu: (1.35 * 50.5 + 1.5 * 6) * 1600 / 8, fl: 5 * 50.5e-3 * 40 ** 4 / (384 * 210000 * 0.075) * 1000 }, "Poutre seule isostatique"],
];
