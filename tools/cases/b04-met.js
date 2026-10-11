/* Biblio 2004 — Charpente métallique : valeurs relevées dans les classeurs Excel (macros VBA) ou recalculées à la main */
const t = (o, tol = 2e-4) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v : [v, tol]]));
module.exports = [
  ["ec3-noeud-chs", {}, t({ g: 122.377, kp: 0.93636, N1Rd: 361.379, N2Rd: 361.379 }, 5e-5), "Biblio2004 · Assnoeu1.xls, nœud 3 (K avec écartement)"],
  ["ec3-noeud-chs", { ty: "X", th1: 30, N1: 400 }, t({ N1Rd: 324.409 }, 5e-5), "Biblio2004 · Assnoeu1.xls, nœud 4 (X)"],
  ["ec3-noeud-chs", { ty: "T", N1: 300 }, t({ N1Rd: 352.0986 }, 5e-5), "Calcul manuel : nœud T, γ^0,2 kp fy0 t0²/sinθ (2,8 + 14,2 β²)"],
  ["ec3-noeud-rhs", { ty: "T", s0: "300 200 10", s1: "80 5", th1: 45, N1: 200 }, t({ N1Rd: 277.97 }, 5e-5), "Calcul manuel (Assnoeu2, nœud 1 : 322,37 kN avec η = h1/h0 et sans π/4)"],
  ["ec3-noeud-rhs", {}, t({ lov: 48.7828, beff: 72.305, bov: 106.667, N1Rd: 1181.92 }, 5e-5), "Biblio2004 · ASSNOEU2.xls, nœud 2 (λov) ; N1,Rd recalculé à la main"],
  ["ec3-treillis-tubes", {}, t({ lov: 36.321, np: 0.26138, kg: 2.2069, N1Rd: 1090.947, R2: 567.68 }, 1e-4), "Biblio2004 · TREILLIK.xls (nœud : 991,77 kN avec γMj = 1,1, soit 1 090,95 kN avec γM5 = 1)"],
  ["ec3-treillis-tubes", { T2: "177.8 3.5" }, t({ R2: 527.0455 }, 1e-4), "Biblio2004 · TREILLIK.xls, tubes courants (177,8 × 3,5 : +5,409 % sur 500 kN)"],
];
module.exports.push(
  ["ec3-profile-lamine", {}, { A: [282.21, 1e-4], Iy: [406450, 1e-4], zA: [221.27, 1e-4], zIy: [326080, 1e-4], zWpy: [7784.6, 1e-4], zIz: [7379.8, 1e-4], zIt: [217.38, 1e-4], zIw: [16544, 1e-4], zAvz: [133.55, 1e-4], zSp: [3.0371, 1e-4] }, "Biblio2004 · PROFILE.xls, feuille EC3 (HEAA 1000, corrosion 2 mm)"],
  ["ec3-choix-profile", { pref: 0.981 }, { s_HEA: [106.85, 1e-4], f_HEA: [19.083, 1e-4] }, "Biblio2004 · Choix.xls (HEA 220 ; 1 t = 10 kN comme le classeur)"],
);
module.exports.push(
  ["app-palplanche-corrosion", {}, { Sc: [73.9579757111658, 1e-9], yGc: [64.9853855608838, 1e-9], Ic: [4961.42036056607, 1e-9], Wc: [442.983960764828, 1e-9] }, "Biblio2004 · CARAPAL.xls (PU6, corrosion 1 mm par face)"],
  ["app-palplanche-corrosion", { p: "AZ13" }, { Sc: [113.907209996745, 1e-9], Ic: [16489.2120593076, 1e-9], Wc: [1095.62870825964, 1e-9] }, "Biblio2004 · CARAPAL.xls (AZ13, corrosion 1 mm par face)"],
);
module.exports.push(
  ["ec3-rhs-flexion-composee", { gM1: 1.1 }, { A: [14375, 1e-9], ly: [0.90955, 5e-5], lz: [0.78778, 5e-5], xy: [0.65504, 5e-5], xz: [0.73197, 5e-5] }, "Biblio2004 · EC3.xls (élancements et χ, courbe b)"],
  ["ec3-rhs-flexion-composee", { gM1: 1.1 }, { Cmy: [0.4, 1e-9], Cmz: [0.52, 1e-9], e61: [0.462044, 1e-5], e62: [0.427850, 1e-5] }, "Calcul manuel : annexe B, Cm du tableau B.3 (αs = 0,2 et 0,4)"],
);
