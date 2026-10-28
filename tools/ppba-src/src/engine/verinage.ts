// Entretoise d'about sous vérinage à vide : poutre continue (EI constant) chargée par les poutres,
// appuyée sur des vérins placés librement par l'utilisateur.
import { barArea, asELS, asELU, sigmaS } from "./ba";

export interface VerinageRes {
  ok: boolean; erreur?: string;
  jacks: number[]; reac: number[];                 // positions (m, depuis l'axe) et réactions (kN, > 0 = compression du vérin)
  pts: { x: number; M: number }[];                 // diagramme des moments (M > 0 : fibre inférieure tendue), points anguleux
  V: { x1: number; x2: number; V: number }[];      // effort tranchant constant par tronçon
  Msup: number; Minf: number; Vmax: number; xMsup: number; xMinf: number;
  soulev: boolean;                                 // un vérin serait tendu (décollement)
}
const key = (v: number) => Math.round(v * 1e4) / 1e4;

export function verinage(Lent: number, beams: number[], P: number, jacksIn: number[]): VerinageRes {
  const jacks = Array.from(new Set(jacksIn.map(key))).sort((a, b) => a - b);
  const vide = { jacks, reac: [], pts: [], V: [], Msup: 0, Minf: 0, Vmax: 0, xMsup: 0, xMinf: 0, soulev: false };
  if (jacks.length < 2) return { ...vide, ok: false, erreur: "Placer au moins deux vérins." };
  if (jacks.some(j => Math.abs(j) > Lent / 2 + 1e-9)) return { ...vide, ok: false, erreur: "Un vérin est hors de l'entretoise." };
  const xs = Array.from(new Set([...jacks, ...beams.map(key), key(-Lent / 2), key(Lent / 2)])).sort((a, b) => a - b);
  const N = xs.length, n2 = 2 * N;
  const K = Array.from({ length: n2 }, () => new Array(n2).fill(0)), F = new Array(n2).fill(0);
  const ke = (l: number) => [[12, 6 * l, -12, 6 * l], [6 * l, 4 * l * l, -6 * l, 2 * l * l], [-12, -6 * l, 12, -6 * l], [6 * l, 2 * l * l, -6 * l, 4 * l * l]].map(r => r.map(v => v / l ** 3));
  for (let i = 0; i < N - 1; i++) { const k = ke(xs[i + 1] - xs[i]); for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[2 * i + a][2 * i + b] += k[a][b]; }
  const idx = (x: number) => xs.indexOf(key(x));
  for (const b of beams) F[2 * idx(b)] -= P;
  const fixed = new Set(jacks.map(j => 2 * idx(j)));
  const free = Array.from({ length: n2 }, (_, i) => i).filter(i => !fixed.has(i));
  const u = gauss(free.map(i => free.map(j => K[i][j])), free.map(i => F[i]));
  if (!u) return { ...vide, ok: false, erreur: "Disposition des vérins instable." };
  const U = new Array(n2).fill(0); free.forEach((d, k) => (U[d] = u[k]));
  const Rr = K.map((r, i) => r.reduce((s, v, j) => s + v * U[j], 0) - F[i]);
  const reac = jacks.map(j => Rr[2 * idx(j)]);
  const pts: { x: number; M: number }[] = [], V: { x1: number; x2: number; V: number }[] = [];
  for (let i = 0; i < N - 1; i++) {
    const k = ke(xs[i + 1] - xs[i]), f = k.map(r => r.reduce((s, v, j) => s + v * U[2 * i + j], 0));
    if (i === 0) pts.push({ x: xs[0], M: -f[1] });
    pts.push({ x: xs[i + 1], M: f[3] });
    V.push({ x1: xs[i], x2: xs[i + 1], V: f[0] });
  }
  // nettoyage numérique (extrémités libres : M = 0)
  for (const p of pts) if (Math.abs(p.M) < 1e-6 * P) p.M = 0;
  let Msup = 0, Minf = 0, xMsup = 0, xMinf = 0;
  for (const p of pts) { if (-p.M > Msup) { Msup = -p.M; xMsup = p.x; } if (p.M > Minf) { Minf = p.M; xMinf = p.x; } }
  const Vmax = Math.max(...V.map(v => Math.abs(v.V)));
  return { ok: true, jacks, reac, pts, V, Msup, Minf, Vmax, xMsup, xMinf, soulev: reac.some(r => r < -1e-6) };
}

function gauss(A: number[][], b: number[]): number[] | null {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-9) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}

/** Choix de barres : nombre minimal de barres d'un même diamètre logeant dans la largeur b (enrobage c, cm) */
export function choixBarres(A: number, bEnt: number, enr = 0.04, diams = [12, 14, 16, 20, 25, 32]) {
  for (const d of diams) {
    const n = Math.max(2, Math.ceil(A / barArea(d) - 1e-9));
    const libre = (bEnt - 2 * enr - (n * d) / 1000) / Math.max(1, n - 1);
    if (libre >= Math.max(d / 1000, 0.025) && n <= 5) return { n, d, A: n * barArea(d) };
  }
  const d = diams[diams.length - 1], n = Math.max(2, Math.ceil(A / barArea(d)));
  return { n, d, A: n * barArea(d) };
}
/** Choix de cadres : nb de brins Ø d, espacement le plus grand parmi la liste qui couvre At/St (cm²/ml) */
export function choixCadres(AtSt: number, brins = 4, d = 10, esps = [25, 20, 15, 12.5, 10, 7.5]) {
  for (const dd of [d, 12, 14]) for (const e of esps) { const pose = (brins * barArea(dd) * 100) / e; if (pose >= AtSt) return { brins, d: dd, esp: e, pose }; }
  return { brins, d: 14, esp: 7.5, pose: (brins * barArea(14) * 100) / 7.5 };
}

/** Positions des vérins normalisées (anciennes données : demi-positions positives, symétrisées) */
export function verinsNormalises(v: number[], sym?: boolean) {
  if (sym === undefined && v.length && v.every(x => x > 0)) return [...v.map(x => -x), ...v].sort((a, b) => a - b);
  return v.slice().sort((a, b) => a - b);
}
export interface EntParams { bEnt: number; Htot: number; feSup: number; feInf: number; feCis: number; enr: number }
/** Ferraillage de l'entretoise à partir du vérinage (ELS et ELU = 1,35 × vérinage à vide) */
export function dimEntretoise(V: VerinageRes, en: EntParams, fc28: number, fiss: "P" | "PP" | "TP") {
  const d = en.Htot - en.enr;
  const ssS = sigmaS(en.feSup, fc28, fiss), ssI = sigmaS(en.feInf, fc28, fiss);
  const AsSupELS = asELS(V.Msup, en.bEnt, d, fc28, ssS).As, AsSupELU = asELU(1.35 * V.Msup, en.bEnt, d, fc28, en.feSup).As;
  const AsInfELS = asELS(V.Minf, en.bEnt, d, fc28, ssI).As, AsInfELU = asELU(1.35 * V.Minf, en.bEnt, d, fc28, en.feInf).As;
  const AsSup = V.Msup > 0 ? Math.max(AsSupELS, AsSupELU) : 0, AsInf = V.Minf > 0 ? Math.max(AsInfELS, AsInfELU) : 0;
  const Tu = 1.35 * V.Vmax, tu = Tu / 1000 / (en.bEnt * d), tlim = Math.min((0.15 * fc28) / 1.5, 4);
  const AtSt = ((tu * en.bEnt * 1.15) / (0.9 * en.feCis)) * 1e4;
  return { d, ssS, ssI, AsSup, AsInf, Tu, tu, tlim, AtSt, barSup: choixBarres(AsSup, en.bEnt), barInf: choixBarres(AsInf, en.bEnt), cadres: choixCadres(AtSt) };
}
