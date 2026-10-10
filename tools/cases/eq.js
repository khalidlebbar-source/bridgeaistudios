/* Appareils d'appui — valeurs recalculées à la main (EN 1337-3, appareil 400 × 500, 4 × 12 mm) */
const Ap = 390 * 490, S1 = Ap / (2 * 880 * 12), Ar = Ap * (1 - 20 / 390), ec = 1.5 * 2.5e6 / (0.9 * Ar * S1);
module.exports = [
  ["aa-compression", {}, { S1, Ar: Ar / 100, ec, sm: 2.5e6 / Ar }, "EN 1337-3 §5.3.3"],
  ["aa-distorsion", {}, { eq: 20 / 53, ea: 390 ** 2 * 0.006 * 12 / (2 * 4 * 1728), et: ec + 20 / 53 + 390 ** 2 * 0.006 * 12 / (2 * 4 * 1728) }, "EN 1337-3 (5.1)"],
  ["aa-stabilite", {}, { vz: 4 * 2.5e6 * 12 / Ap * (1 / (5 * 0.9 * S1 ** 2) + 1 / 2000), stab: 2 * 390 * 0.9 * S1 / (3 * 53) }, "EN 1337-3 §5.3.3.6"],
  ["aa-glissement", {}, { mue: 0.1 + 0.9 / (0.9e6 / Ar) }, "EN 1337-3 (5.13)"],
  ["aa-frettes", {}, { ts1: 1.3 * 2.5e6 * 24 / (Ar * 235) }, "EN 1337-3 (5.9)"],
  ["aa-effort-h", {}, { K1: 0.9 * Ap / 53 / 1000, Hx: 0.9 * Ap / 53 / 1000 * 20 }, "H = G A' v / Te"],
  ["aa-ptfe", {}, { mu: 1.2 / (10 + 1.8e6 / (Math.PI * 22500)), sEd: 3e6 / (Math.PI * 22500) }, "EN 1337-2 tableau 11"],
  ["joint-chaussee", {}, { Wmax: 50 + 26.4 + 42 + 10, Wmin: 50 - 30 - 10 }, "Bilan des déplacements"],
];
