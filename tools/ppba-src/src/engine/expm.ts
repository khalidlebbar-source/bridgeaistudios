// Petite algèbre linéaire 4x4 (exponentielle de matrice par Padé + mise à l'échelle)
export type M4 = number[][];
export const eye = (n: number): M4 => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export function mul(a: M4, b: M4): M4 {
  const n = a.length, m = b[0].length, k = b.length;
  const r: M4 = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) for (let p = 0; p < k; p++) { const v = a[i][p]; if (v) for (let j = 0; j < m; j++) r[i][j] += v * b[p][j]; }
  return r;
}
const add = (a: M4, b: M4, s = 1): M4 => a.map((r, i) => r.map((v, j) => v + s * b[i][j]));
const scale = (a: M4, s: number): M4 => a.map(r => r.map(v => v * s));
export function solve(A: M4, B: M4): M4 {
  const n = A.length, m = B[0].length;
  const a = A.map((r, i) => [...r, ...B[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c];
    for (let j = c; j < n + m; j++) a[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; if (f) for (let j = c; j < n + m; j++) a[r][j] -= f * a[c][j]; }
  }
  return a.map(r => r.slice(n));
}
export function expm(A: M4): M4 {
  const n = A.length;
  let nrm = 0; for (const r of A) nrm = Math.max(nrm, r.reduce((s, v) => s + Math.abs(v), 0));
  let s = Math.max(0, Math.ceil(Math.log2(nrm / 0.5)) + 1);
  const As = scale(A, 1 / 2 ** s);
  // Padé (6,6)
  const c = [1, 1 / 2, 5 / 44, 1 / 66, 1 / 792, 1 / 15840, 1 / 665280];
  let X = eye(n), N = eye(n), D = eye(n);
  for (let k = 1; k <= 6; k++) { X = mul(As, X); N = add(N, X, c[k]); D = add(D, X, (k % 2 ? -1 : 1) * c[k]); }
  let E = solve(D, N);
  for (let i = 0; i < s; i++) E = mul(E, E);
  return E;
}
export const mv = (A: M4, v: number[]) => A.map(r => r.reduce((s, x, j) => s + x * v[j], 0));
