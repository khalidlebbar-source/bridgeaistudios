/* Hydraulique — valeurs recalculées à la main */
const { sqrt, PI, pow, log, cos, sin } = Math, g = 9.81;
module.exports = [
  ["hyd-manning", { m: 0, b: 10, Q: 30 * 20 * pow(20 / 14, 2 / 3) * sqrt(0.001) }, { yn: [2, 1e-6] }, "Manning-Strickler : Q calculé pour y = 2 m"],
  ["hyd-manning", { m: 0, b: 10, Q: 10 }, { yc: pow(1 / g, 1 / 3) }, "Hauteur critique d'un canal rectangulaire : (q²/g)^(1/3)"],
  ["hyd-rationnelle", {}, { tc: 0.0195 * pow(2500, 0.77) * pow(0.02, -0.385), Q: 0.35 * 5.9 * pow(0.0195 * pow(2500, 0.77) * pow(0.02, -0.385), -0.6) * 60 * 2.5 / 3.6 }, "Kirpich + Montana"],
  ["hyd-affouillement", { th: 0 }, { ys: 2 * 1 * 1 * 1.1 * pow(2, 0.35) * pow(2.5 / sqrt(g * 4), 0.43) * 2 }, "CSU / HEC-18"],
  ["hyd-courant-pile", {}, { Fw: 0.5 * 1.44 * 1000 * 4 * 2 * 6.25 / 1000, Fd: 666 * 12 * 6.25 / 1000 }, "EN 1991-1-6 §4.9"],
  ["hyd-remous", {}, { dh: 0.9 * (400 / 210) ** 2 / (g * 3.5) * (0.9 + 5 * (400 / 210) ** 2 / (g * 3.5) - 0.6) * (0.09 + 15 * 0.09 ** 4) * 3.5 }, "Yarnell"],
  ["hyd-dalot", {}, { V: sqrt(2 * g * 1.2 / (1.5 + 2 * g * 30 / (4900 * pow(0.6, 4 / 3)))) }, "Bernoulli en charge"],
  ["hyd-dupuit", {}, { Q: PI * 1e-4 * (144 - 49) / log(150 / sqrt(400 / PI)) }, "Dupuit / Sichardt"],
  ["hyd-sous-pression", {}, { Vd: 30, Sd: 0.9 * 37 }, "EC7 UPL"],
  ["hyd-enrochements", {}, { d: 4.5 ** 2 / (2 * g * 0.86 ** 2 * 1.65) }, "Isbash"],
];
