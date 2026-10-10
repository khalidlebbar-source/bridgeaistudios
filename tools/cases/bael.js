/* BAEL 91 mod. 99 — valeurs recalculées à la main */
const { sqrt } = Math, fsu = 500 / 1.15;
const mu = 0.65 / (0.4 * 0.82 ** 2 * 17), a = 1.25 * (1 - sqrt(1 - 2 * mu));
const lam = 5 / (0.5 / sqrt(12)), al = 0.85 / (1 + 0.2 * (lam / 35) ** 2);
module.exports = [
  ["bael-flexion-elu", {}, { fbu: 17, mu, A: 0.65 / (0.82 * (1 - 0.4 * a) * fsu) * 1e4, Amin: 0.23 * 2.4 / 500 * 0.4 * 0.82 * 1e4, mul: [0.3717, 1e-4] }, "BAEL A.4.3 — calcul manuel"],
  ["bael-flexion-elu", { fe: 400 }, { mul: [0.3916, 2e-4] }, "BAEL — µl FeE400 = 0,392 (valeur classique)"],
  ["bael-flexion-els", {}, { ss: 250, A: [0.45 / ((0.82 - 0.30996 / 3) * 250) * 1e4, 1e-4] }, "BAEL A.4.5.33 (FP : max(0,5 fe ; 110√(ηftj)))"],
  ["bael-flexion-els", { fis: "tp" }, { ss: 200 }, "BAEL mod. 99 : FTP = 0,8 × FP"],
  ["bael-flexion-composee", {}, { MuA: 900 + 1500 * 0.42 }, "BAEL — moment rapporté aux aciers tendus"],
  ["bael-tranchant", {}, { tu: 0.7 / (0.4 * 0.82), At: 1.15 * 0.4 * (0.7 / 0.328 - 0.72) / 450 * 1e4, lim: 3 }, "BAEL A.5.1"],
  ["bael-poteau", {}, { lam, al, Nr: al * (0.48 * 0.58 * 30 / 1.35 + 18.85e-4 * fsu) * 1000 }, "BAEL A.8.4"],
  ["bael-poteau", { lf: 12 }, { al: 0.6 * (50 / (12 / (0.5 / sqrt(12)))) ** 2 }, "BAEL A.8.4 — 50 < λ ≤ 70"],
  ["bael-ancrage", {}, { ts: 0.6 * 2.25 * 2.4, ls: 20 * 500 / (4 * 3.24), lc: 0.4 * 20 * 500 / (4 * 3.24) }, "BAEL A.6.1.2"],
  ["bael-semelle", {}, { Ax: 1.1 * 3.2 * 2.1 / (8 * 0.59 * fsu) * 1e4 }, "Méthode des bielles"],
  ["bael-poinconnement", {}, { Ql: 0.045 * 4 * (0.4 + 0.12 + 0.25) * 0.25 * 20 * 1000 }, "BAEL A.5.2.4"],
  ["bael-nonfragilite", {}, { Af: 0.23 * 2.4 / 500 * 0.4 * 0.82 * 1e4 }, "BAEL A.4.2.1"],
];
