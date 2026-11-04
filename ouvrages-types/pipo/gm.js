// Guyon-Massonnet, dalle isotrope (α = 1), coefficient de Poisson nul.
// K(y, e) : rapport flèche en y sous charge sinusoïdale en e / flèche moyenne. b demi-largeur, Lf portée fictive.
(function (root) {
  'use strict';
  function solve4(A, r) {
    const n = 4, M = A.map((row, i) => [...row, r[i]]);
    for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]];
      for (let k = 0; k < n; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let c = i; c <= n; c++) M[k][c] -= f * M[i][c]; } }
    return M.map((row, i) => row[n] / row[i]);
  }
  function makeK(b, Lf) {
    const k = Math.PI / Lf;
    // fonction de Green (plaque infinie) et dérivées 0..3
    const G = t => { const a = Math.abs(t), s = Math.sign(t) || 1, e = Math.exp(-k * a);
      return [(1 + k * a) * e / (4 * k ** 3), -s * a * e / (4 * k), -(1 - k * a) * e / (4 * k), s * (2 - k * a) * e / 4]; };
    const basis = y => { const c = Math.cosh(k * y), s = Math.sinh(k * y);
      return [[c, k * s, k * k * c, k ** 3 * s], [y * c, c + k * y * s, 2 * k * s + k * k * y * c, 3 * k * k * c + k ** 3 * y * s],
        [s, k * c, k * k * s, k ** 3 * c], [y * s, s + k * y * c, 2 * k * c + k * k * y * s, 3 * k * k * s + k ** 3 * y * c]]; };
    const cache = new Map();
    function W(e) {
      const key = e.toFixed(6); if (cache.has(key)) return cache.get(key);
      const rows = [], rhs = [];
      for (const y of [-b, b]) { const B = basis(y), g = G(y - e);
        rows.push(B.map(f => f[2])); rhs.push(-g[2]);
        rows.push(B.map(f => f[3] - 2 * k * k * f[1])); rhs.push(-(g[3] - 2 * k * k * g[1])); }
      const c = solve4(rows, rhs);
      const w = y => G(y - e)[0] + basis(y).reduce((s, f, i) => s + c[i] * f[0], 0);
      // moyenne (Simpson)
      const n = 200; let s = 0; for (let i = 0; i <= n; i++) { const y = -b + 2 * b * i / n; s += w(y) * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2); }
      const mean = s * (2 * b / n) / 3 / (2 * b);
      const f = y => w(y) / mean; cache.set(key, f); return f;
    }
    // K(y,e) = K(e,y) (réciprocité) : on calcule la ligne d'influence de la fibre y
    return (y, e) => W(Math.max(-b + 1e-9, Math.min(b - 1e-9, e)))(y);
  }
  // Coefficient μ de Guyon (moment transversal, Poisson nul, α = 1) à la fibre f (relative, b = 1) pour une charge
  // linéique sinusoïdale en e (relative) ; θ = b / portée. Solution exacte de la plaque (même formulation que PICF).
  function muCoef(theta, f, e) {
    const b = 1, be = Math.PI * theta;
    const basis = (y, der) => { const ch = Math.cosh(be * y), sh = Math.sinh(be * y);
      const C = k => Math.pow(be, k) * (k % 2 ? sh : ch), S = k => Math.pow(be, k) * (k % 2 ? ch : sh);
      const yC = n => y * C(n) + (n ? n * C(n - 1) : 0), yS = n => y * S(n) + (n ? n * S(n - 1) : 0);
      return [C(der), yC(der), S(der), yS(der)]; };
    const A = [], r = [];
    const row = (seg, y, der, c) => { const v = new Array(8).fill(0); const q = basis(y, der); for (let i = 0; i < 4; i++) v[seg * 4 + i] += c * q[i]; return v; };
    const add = (a, c) => a.map((x, i) => x + c[i]);
    for (const [seg, y] of [[0, -b], [1, b]]) { A.push(row(seg, y, 2, 1)); r.push(0); A.push(add(row(seg, y, 3, 1), row(seg, y, 1, -2 * be * be))); r.push(0); }
    for (let d = 0; d < 3; d++) { A.push(add(row(0, e, d, 1), row(1, e, d, -1))); r.push(0); }
    A.push(add(row(1, e, 3, 1), row(0, e, 3, -1))); r.push(1);
    const n = 8, M = A.map((rw, i) => [...rw, r[i]]);
    for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]];
      for (let k = 0; k < n; k++) if (k !== i) { const q = M[k][i] / M[i][i]; for (let c = i; c <= n; c++) M[k][c] -= q * M[i][c]; } }
    const x = M.map((rw, i) => rw[n] / rw[i]);
    const seg = f < e ? 0 : 1, q = basis(f, 2); let s = 0; for (let i = 0; i < 4; i++) s += x[seg * 4 + i] * q[i];
    return -s;
  }
  const api = { makeK, muCoef };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PIPO_GM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
