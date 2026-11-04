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
  const api = { makeK };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PIPO_GM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
