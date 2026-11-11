// Solveur de portique plan par la méthode des déplacements (sans dépendance).
// Utilisation : const m = new Frame(); m.node(x,y) ; m.bar(i,j,EI,EA) ; m.spring(n,[kx,ky,kr]) ;
// m.coupled(n, [[kvv,kvr],[krv,krr]]) ; m.assemble() ; puis m.solve(cas) pour chaque cas de charge.
// Un cas : { nodal:{n:[Fx,Fy,M]}, bars:{b:{q:[qa,qb] (local, perpendiculaire), P:[[a,P]...]}}, imposed:{n:[ux,uy,r]} }
// Retour : { U, end:[[N1,V1,M1,N2,V2,M2] par barre en repère local] }.
(function (root) {
  function Frame() { this.nodes = []; this.bars = []; this.springs = []; this.coupledK = []; this.extraK = []; }
  // terme de raideur supplémentaire (éventuellement non symétrique) : K[r][c] += val (r, c : numéros de ddl globaux)
  Frame.prototype.kij = function (r, c, val) { this.extraK.push([r, c, val]); };
  Frame.prototype.node = function (x, y) { this.nodes.push({ x, y }); return this.nodes.length - 1; };
  Frame.prototype.bar = function (i, j, EI, EA) {
    const a = this.nodes[i], b = this.nodes[j];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    this.bars.push({ i, j, EI, EA: EA || EI * (globalThis.PIPO_EAK || 1e6), /* tour 17 : barres quasi inextensibles (déformation d'effort normal négligée, méthode des forces SETRA) — 1e5 laissait des ordonnées parasites ~1e-7 ; 1e8 : mal conditionné */ L, c: dx / L, s: dy / L });
    return this.bars.length - 1;
  };
  Frame.prototype.spring = function (n, k) { this.springs.push({ n, k }); };
  Frame.prototype.coupled = function (n, K) { this.coupledK.push({ n, K }); };
  function klocal(b) {
    const { EA, EI, L } = b;
    return [
      [EA / L, 0, 0, -EA / L, 0, 0],
      [0, 12 * EI / L ** 3, 6 * EI / L ** 2, 0, -12 * EI / L ** 3, 6 * EI / L ** 2],
      [0, 6 * EI / L ** 2, 4 * EI / L, 0, -6 * EI / L ** 2, 2 * EI / L],
      [-EA / L, 0, 0, EA / L, 0, 0],
      [0, -12 * EI / L ** 3, -6 * EI / L ** 2, 0, 12 * EI / L ** 3, -6 * EI / L ** 2],
      [0, 6 * EI / L ** 2, 2 * EI / L, 0, -6 * EI / L ** 2, 4 * EI / L]];
  }
  // transforme vecteur global -> local
  function toLocal(b, g) {
    const { c, s } = b;
    return [c * g[0] + s * g[1], -s * g[0] + c * g[1], g[2], c * g[3] + s * g[4], -s * g[3] + c * g[4], g[5]];
  }
  function toGlobal(b, l) {
    const { c, s } = b;
    return [c * l[0] - s * l[1], s * l[0] + c * l[1], l[2], c * l[3] - s * l[4], s * l[3] + c * l[4], l[5]];
  }
  Frame.prototype.assemble = function () {
    const n = this.nodes.length * 3;
    const K = Array.from({ length: n }, () => new Float64Array(n));
    for (const b of this.bars) {
      b.k = klocal(b);
      b.dofs = [b.i * 3, b.i * 3 + 1, b.i * 3 + 2, b.j * 3, b.j * 3 + 1, b.j * 3 + 2];
      for (let q = 0; q < 6; q++) {
        const e = [0, 0, 0, 0, 0, 0]; e[q] = 1;
        // colonne q de T^T k T
        const col = toGlobal(b, b.k.map(r => r.reduce((s, v, m) => s + v * toLocal(b, e)[m], 0)));
        for (let p = 0; p < 6; p++) K[b.dofs[p]][b.dofs[q]] += col[p];
      }
    }
    this.big = 1e14;
    for (const { n: nd, k } of this.springs) for (let d = 0; d < 3; d++) if (k[d]) K[nd * 3 + d][nd * 3 + d] += (k[d] === Infinity ? this.big : k[d]);
    for (const { n: nd, K: kk } of this.coupledK) {
      const d = [nd * 3 + 1, nd * 3 + 2];
      for (let p = 0; p < 2; p++) for (let q = 0; q < 2; q++) K[d[p]][d[q]] += kk[p][q];
    }
    for (const [r, c, val] of this.extraK) K[r][c] += val;
    // factorisation LU (pivot partiel)
    const A = K.map(r => Float64Array.from(r)), piv = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      piv[i] = p; if (p !== i) { const t = A[i]; A[i] = A[p]; A[p] = t; }
      const d = A[i][i];
      for (let r = i + 1; r < n; r++) { const f = A[r][i] / d; if (f) { A[r][i] = f; const Ar = A[r], Ai = A[i]; for (let c = i + 1; c < n; c++) Ar[c] -= f * Ai[c]; } else A[r][i] = 0; }
    }
    this.LU = A; this.piv = piv; this.n = n;
    return this;
  };
  Frame.prototype.fixedEnd = function (b, ld) {
    const L = b.L; const fe = [0, 0, 0, 0, 0, 0];
    if (ld.q) { const [q1, q2] = ld.q;
      fe[1] += L * (7 * q1 + 3 * q2) / 20; fe[4] += L * (3 * q1 + 7 * q2) / 20;
      fe[2] += L * L * (3 * q1 + 2 * q2) / 60; fe[5] -= L * L * (2 * q1 + 3 * q2) / 60; }
    if (ld.P) for (const [a, P] of ld.P) { const c = L - a;
      fe[1] += P * c * c * (3 * a + c) / L ** 3; fe[4] += P * a * a * (a + 3 * c) / L ** 3;
      fe[2] += P * a * c * c / L ** 2; fe[5] -= P * a * a * c / L ** 2; }
    if (ld.N) { const [n1, n2] = ld.N; fe[0] += L * (2 * n1 + n2) / 6; fe[3] += L * (n1 + 2 * n2) / 6; }
    return fe;
  };
  Frame.prototype.solve = function (cs) {
    const n = this.n, F = new Float64Array(n), fes = {};
    if (cs.nodal) for (const [nd, f] of Object.entries(cs.nodal)) for (let d = 0; d < 3; d++) F[nd * 3 + d] += f[d] || 0;
    if (cs.bars) for (const [bi, ld] of Object.entries(cs.bars)) {
      const b = this.bars[bi]; const fe = this.fixedEnd(b, ld); fes[bi] = fe;
      const g = toGlobal(b, fe); for (let p = 0; p < 6; p++) F[b.dofs[p]] += g[p];
    }
    if (cs.imposed) for (const [nd, u] of Object.entries(cs.imposed)) for (let d = 0; d < 3; d++) if (u[d]) {
      const sp = this.springs.find(s => s.n == nd); const k = sp && sp.k[d] === Infinity ? this.big : (sp ? sp.k[d] : 0);
      F[nd * 3 + d] += k * u[d];
    }
    const x = Float64Array.from(F), A = this.LU, piv = this.piv;
    for (let i = 0; i < n; i++) { const p = piv[i]; if (p !== i) { const t = x[i]; x[i] = x[p]; x[p] = t; } }
    for (let i = 0; i < n; i++) { const xi = x[i]; if (xi) for (let r = i + 1; r < n; r++) { const a = A[r][i]; if (a) x[r] -= a * xi; } }
    for (let i = n - 1; i >= 0; i--) { let s = x[i]; const Ai = A[i]; for (let c = i + 1; c < n; c++) s -= Ai[c] * x[c]; x[i] = s / Ai[i]; }
    const end = this.bars.map((b, bi) => {
      const ul = toLocal(b, b.dofs.map(d => x[d]));
      const f = b.k.map(r => r.reduce((s, v, m) => s + v * ul[m], 0));
      const fe = fes[bi]; if (fe) for (let p = 0; p < 6; p++) f[p] -= fe[p];
      return f;
    });
    return { U: x, end };
  };
  const api = { Frame };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PIPO_FRAME = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
