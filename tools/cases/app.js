/* Appuis et soutènements — valeurs recalculées à la main (formes fermées) */
const { tan, sin, cos, sqrt, PI } = Math, r = d => d * PI / 180, Ka = p => tan(PI / 4 - r(p) / 2) ** 2, Kp = p => tan(PI / 4 + r(p) / 2) ** 2;
const bis = (f, a, b) => { for (let i = 0; i < 100; i++) { const m = (a + b) / 2; f(a) * f(m) <= 0 ? b = m : a = m; } return (a + b) / 2; };
// Blum (console) : ka[q Z²/2 + γ Z³/6] = kp γ D³/6
const ka32 = Ka(32), kp32 = Kp(32) / 1.5, D0 = bis(D => kp32 * 19 * D ** 3 / 6 - ka32 * (10 * (4 + D) ** 2 / 2 + 19 * (4 + D) ** 3 / 6), 0.1, 30);
// ancré : moments / tirant
const Dan = bis(D => { const Z = 8 + D; return kp32 * 19 * (D ** 3 / 3 + 6.5 * D ** 2 / 2) - ka32 * (10 * (Z * Z / 2 - 1.5 * Z) + 19 * (Z ** 3 / 3 - 1.5 * Z * Z / 2)); }, 0.05, 30);
const Tan = ka32 * (10 * (8 + Dan) + 19 * (8 + Dan) ** 2 / 2) - kp32 * 19 * Dan ** 2 / 2;
// Coulomb
const f = r(32), d = r(21.3), b = r(10), kaC = cos(f) ** 2 / (cos(d) * (1 + sqrt(sin(f + d) * sin(f - b) / (cos(d) * cos(b)))) ** 2);
// mur cantilever
const V = 25 * 0.4 * 5.4 + 25 * 3.6 * 0.6 + 20 * 2.4 * 5.4 + 10 * 2.4, Hh = 0.5 / 3 * 20 * 36 + 10 / 3 * 6;
module.exports = [
  ["app-rankine", {}, { ka: 1 / 3, kp: 3, pH: (10 + 80 + 20) / 3 + 20 }, "Rankine φ = 30° (Ka = 1/3)"],
  ["app-rankine", { hw: 10, q: 0 }, { Pa: [0.5 / 3 * 20 * 36, 1e-4] }, "Pa = ½ Ka γ H²"],
  ["app-coulomb", {}, { ka: kaC, Pa: 0.5 * kaC * 20 * 36 }, "Coulomb (λ = 0)"],
  ["app-coulomb", { d: 0, beta: 0 }, { ka: Ka(32) }, "Coulomb δ = β = 0 → Rankine"],
  ["app-mur-stabilite", {}, { V, Hh, Fg: V * tan(r(30)) / Hh }, "Mur en T renversé"],
  ["app-repartition-h", {}, { F2: 500 * (1 / (1 / (90000 / 1728) + 1 / 18)) / (13 + 1 / (1 / (90000 / 1728) + 1 / 18) + 1 / (1 / (90000 / 3375) + 1 / 18) + 13) }, "Raideurs en série"],
  ["app-chevetre", {}, { T: 3200 * 1.7 / 1.44 }, "Bielle-tirant"],
  ["app-palplanche-console", {}, { D0: [D0, 1e-4], D: [1.2 * D0, 1e-4] }, "Blum : forme fermée"],
  ["app-palplanche-ancree", {}, { D: [Dan, 1e-4], T: [Tan, 1e-3] }, "Appui simple en pied : forme fermée"],
  ["app-cadre", {}, { K0: 0.5, pv: 50, ph2: 0.5 * (20 * 6 + 20) }, "Jaky"],
  ["app-culee-poussee", {}, { P: 0.5 / 3 * 20 * 49 + 10 / 3 * 7, M: 0.5 / 3 * 20 * 49 * 7 / 3 + 10 / 3 * 49 / 2 }, "Poussée Ka + surcharge"],
];
