/* Chantier — valeurs recalculées à la main */
const { sqrt, exp, log, cos, PI } = Math;
module.exports = [
  ["ch-lancement", {}, { Mb: 180 * 400 / 2 + 20 * 30 * 35, M0: 180 * 2500 / 2 }, "Console avec avant-bec"],
  ["ch-poussee", {}, { Fp: 60000 * 0.08, Fg: 60000 * 0.06 }, "W (µ + i)"],
  ["ch-poussee", { i: -6 }, { Fret: 60000 * 0.02 }, "Retenue en descente"],
  ["ch-encorbellement", {}, { M: 0.02 * 220 * 2025 / 2 + 1200 * 46.75 + 600 * 46 + 0.2 * 12 * 2025 / 2 }, "Déséquilibre de fléau"],
  ["ch-coffrage", {}, { Pm: 25 * (sqrt(2) + 0.45 * (36 / 31) ** 2 * sqrt(6 - sqrt(2))) }, "CIRIA R108"],
  ["ch-coffrage", { Rv: 40 }, { Pm: 150 }, "Plafond hydrostatique"],
  ["ch-etaiement", {}, { F: (1.35 * (26 * 0.45 + 0.5) + 1.5 * 1.5) * 2.25 }, "Charge par étai"],
  ["ch-verinage", {}, { Fv: 1.3 * 6500 / 5, p: 1.3 * 6500 / 5 * 1000 / 38000 * 10 }, "Vérinage"],
  ["ch-elingage", {}, { T: 42 * 9.81 * 1.15 / (2 * cos(PI / 6)) }, "Élingage 2 brins porteurs"],
  ["ch-maturite", { Tm: 20 }, { te: 28 / (1 - log(25 / 43) / 0.25) ** 2 }, "EC2 (3.2) inversée"],
];
