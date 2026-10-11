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
