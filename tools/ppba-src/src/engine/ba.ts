// Outils béton armé — BAEL 91 révisé 99
export const ft = (fc: number) => 0.6 + 0.06 * fc;
export const Ei = (fc: number) => 11000 * Math.cbrt(fc);
export const EvBAEL = (fc: number) => 3700 * Math.cbrt(fc);
/** Contrainte limite de l'acier à l'ELS selon la fissuration (MPa) */
export function sigmaS(fe: number, fc: number, fiss: "P" | "PP" | "TP", eta = 1.6) {
  const x = Math.min((2 / 3) * fe, Math.max(0.5 * fe, 110 * Math.sqrt(eta * ft(fc))));
  return fiss === "PP" ? fe : fiss === "P" ? x : 0.8 * x;
}
export const barArea = (d: number) => (Math.PI * d * d) / 4 / 100; // cm² (d en mm)

/** Section en T (ou rectangulaire si b = b0) — couches d'acier (A en cm², d depuis la fibre sup. en m) */
export interface Layer { A: number; d: number }
export interface TSec { b: number; h0: number; b0: number; h: number }
/** Section fissurée homogénéisée (béton comprimé + n·acier) : axe neutre y, inertie I (m4) */
export function cracked(s: TSec, layers: Layer[], n = 15) {
  const As = layers.map(l => ({ A: l.A * 1e-4, d: l.d }));
  // moment statique S(y) = ∫ comprimé - n Σ A (d - y)
  const S = (y: number) => {
    const bc = y <= s.h0 ? (s.b * y * y) / 2 : (s.b * s.h0 * s.h0) / 2 + s.b * s.h0 * (y - s.h0) - ((s.b - s.b0) * (y - s.h0) ** 2) / 2 + 0 * 0;
    const bcFix = y <= s.h0 ? bc : s.b * s.h0 * (y - s.h0 / 2) + (s.b0 * (y - s.h0) ** 2) / 2;
    return bcFix - n * As.reduce((t, a) => t + a.A * (a.d - y), 0) + n * 0;
  };
  let lo = 1e-6, hi = s.h;
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (S(m) > 0) hi = m; else lo = m; }
  const y = (lo + hi) / 2;
  const Ib = y <= s.h0 ? (s.b * y ** 3) / 3 : (s.b * s.h0 ** 3) / 12 + s.b * s.h0 * (y - s.h0 / 2) ** 2 + (s.b0 * (y - s.h0) ** 3) / 3;
  const I = Ib + n * As.reduce((t, a) => t + a.A * (a.d - y) ** 2, 0);
  return { y, I };
}
/** Contraintes ELS sous M (kN·m) : béton (fibre sup.) et acier le plus tendu (MPa) */
export function stressesELS(s: TSec, layers: Layer[], M: number, n = 15) {
  const { y, I } = cracked(s, layers, n);
  const K = M / 1000 / I; // MN/m3
  const dmax = Math.max(...layers.map(l => l.d));
  const dg = layers.reduce((t, l) => t + l.A * l.d, 0) / layers.reduce((t, l) => t + l.A, 0);
  return { y, I, sb: K * y, ss: n * K * (dmax - y), ssG: n * K * (dg - y), K };
}
/** Section rectangulaire b x h, ELU : section d'acier tendu (cm²) — pivot A/B sans acier comprimé */
export function asELU(Mu: number, b: number, d: number, fc: number, fe: number, gb = 1.5, gs = 1.15) {
  const fbu = (0.85 * fc) / gb, fsu = fe / gs;
  const mu = Mu / 1000 / (b * d * d * fbu);
  const a = 1.25 * (1 - Math.sqrt(Math.max(0, 1 - 2 * mu)));
  const z = d * (1 - 0.4 * a);
  return { mu, alpha: a, z, As: ((Mu / 1000 / (z * fsu)) * 1e4), ok: mu <= 0.392 };
}
/** Section rectangulaire, dimensionnement ELS (σs imposé) — méthode exacte de la section fissurée */
export function asELS(Mser: number, b: number, d: number, fc: number, ssl: number, n = 15) {
  const sbl = 0.6 * fc;
  // on cherche As tel que σs = ssl (si σb ≤ σbl) ; sinon on borne
  let lo = 1e-3, hi = 500;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2; const r = stressesELS({ b, h0: 0, b0: b, h: d * 1.2 }, [{ A: m, d }], Mser, n);
    if (r.ss > ssl) lo = m; else hi = m;
  }
  const As = hi; const r = stressesELS({ b, h0: 0, b0: b, h: d * 1.2 }, [{ A: As, d }], Mser, n);
  return { As, sb: r.sb, ss: r.ss, okBeton: r.sb <= sbl };
}
