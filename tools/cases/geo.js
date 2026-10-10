/* Géotechnique — valeurs de référence (tables classiques et calcul manuel) */
const { tan, sin, cos, sqrt, PI, exp, log10, pow } = Math, r = d => d * PI / 180;
const Nq = exp(PI * tan(r(32))) * tan(PI / 4 + r(16)) ** 2;
module.exports = [
  ["geo-portance-ec7", { Hx: 0, e: 0, c: 0 }, { qu: 19 * 1.5 * Nq * (1 + 0.5 * sin(r(32))) + 0.5 * 19 * 3 * 2 * (Nq - 1) * tan(r(32)) * (1 - 0.15) }, "EC7 annexe D (Nq = 23,18 ; Nγ = 27,72)"],
  ["geo-portance-ec7", { cond: "u", Hx: 0, e: 0, B: 2, Lf: 2 }, { qu: (PI + 2) * 80 * 1.2 + 19 * 1.5 }, "EC7 D.3 : (π + 2) cu sc + q"],
  ["geo-portance-pressio", {}, { kp: 1 + 0.5 * (0.6 + 0.2) * 0.4, qu: 1.16 * 1200 + 30 }, "Fascicule 62-V annexe F.2 (sables et graves B)"],
  ["geo-tassement-pressio", {}, { s: (1 / 3 / (9 * 15) * 0.27 * 1.2 * 3 + 2 / (9 * 12) * 0.27 * 0.6 * pow(1.53 * 5, 1 / 3)) * 1000 }, "Ménard (L/B = 2 : λc = 1,2 ; λd = 1,53)"],
  ["geo-oedometre", {}, { s: 6 / 2.1 * (0.05 * log10(80 / 60) + 0.35 * log10(2)) * 1000, t90: 0.848 * 9 / 2 }, "Terzaghi"],
  ["geo-oedometre", { t: 0.5 }, { U: sqrt(4 * (2 * 0.5 / 9) / PI) * 100 }, "U = √(4Tv/π) pour Tv < 0,28"],
  ["geo-pieu-pressio", {}, { Qp: 1.4 * 2500 * PI / 4, Qs: PI * (160 + 640 + 480), Qc: 0.5 * 1.4 * 2500 * PI / 4 + 0.7 * PI * 1280 }, "Fascicule 62-V (pieu foré)"],
  ["geo-pieu-lateral", { M: 0 }, { y0: 2 * 300 * pow(20000 / 6e6, 0.25) / 20000 * 1000, Mm: [0.3224 * 300 / pow(20000 / 6e6, 0.25), 2e-3] }, "Hetényi : Mmax = 0,3224 H/λ"],
  ["geo-frottement-negatif", {}, { Gsf: PI * 0.2 * (60 * 8 + 8 * 32) }, "Méthode simplifiée"],
  ["geo-semelle-pieux", {}, { Ft: 12000 * 4.8 / 25.6 }, "Blévot, 4 pieux"],
  ["geo-semelle-pieux", { n: "2" }, { Ft: 6000 * (1.5 - 0.3) / 1.6 }, "Blévot, 2 pieux"],
  ["geo-groupe-repartition", {}, { Nmax: 3000 + 9000 * 3 / 36 + 3000 * 1.5 / 13.5 }, "Répartition rigide"],
  ["geo-talus", { c: 0, m: 0 }, { F: tan(r(32)) / tan(r(21.8)) }, "Pente infinie sèche"],
  ["geo-boussinesq", {}, { Ic: [4 * 0.1202, 2e-3], s21: 200 * 32 / 96 }, "Steinbrenner : m = 0,5, n = 1 → 0,1202"],
  ["geo-kmenard", {}, { Es: 12 * 12 / (4 / 3 * 0.6 * pow(2.65 / 0.6, 0.5) + 1.5) }, "Ménard (pieu D = 1 m)"],
  ["geo-ple-equivalent", { z1: 2, p1: 1, z2: 3, p2: 1, z3: 4, p3: 1, z4: 5, p4: 1, z5: 7, p5: 1 }, { ple: [1, 1e-9] }, "Sol homogène → p*le = p*l"],
  ["geo-tirant", {}, { Tu: PI * 0.21 * 8 * 250 }, "Bustamante"],
  ["geo-semelle-excentree", {}, { qM: 900 / 3.2 * (1 + 6 * (1 / 3) / 3.2), q62: (3 * 900 / 3.2 * (1 + 0.625) + 900 / 3.2 * (1 - 0.625)) / 4, qMey: 900 / (3.2 - 2 / 3) }, "Fascicule 62 / Meyerhof"],
];
