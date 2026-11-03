/* Solveur de portiques plans (méthode des déplacements, poutres d'Euler-Bernoulli).
 * Utilisé par POUTRE, GMSLT, RACBA-RAPO, APPUI, REPHOR… et par les tests node.
 *
 * Modèle :
 *   nodes   : [{x, y}]                                   (m)
 *   elems   : [{i, j, E, A, I, rel:[relâche moment en i, en j], name}]   E (kPa=kN/m²), A (m²), I (m⁴)
 *   supports: [{n, ux, uy, rz}]  chaque ddl : true (bloqué), false/undefined (libre) ou un nombre = raideur de ressort
 *             (kN/m ou kN·m/rad)
 *   loads   : {
 *     nodal : [{n, Fx, Fy, M}],                                   (kN, kN·m) repère global
 *     elem  : [{e, type:'u'|'t'|'p', dir:'gy'|'gx'|'ly'|'lx', q, q1, q2, a, b, P}]
 *               u : uniforme q sur [a,b] (défaut toute la barre), t : trapézoïdale q1→q2 sur [a,b], p : ponctuelle P à a
 *               dir 'gy' = verticale globale (q<0 vers le bas), 'ly' = perpendiculaire à la barre, etc. Intensités par m de barre.
 *     strain: [{e, eps, kappa}]   allongement imposé (retrait, dilatation) et courbure imposée (gradient thermique)
 *     disp  : [{n, dof:'ux'|'uy'|'rz', v}]  déplacement imposé d'un ddl bloqué (dénivellation d'appui)
 *   }
 * Conventions de sortie, repère local (x de i vers j, y à +90°) :
 *   N > 0 traction, M > 0 tend la fibre côté −y local (moment « positif » de travée pour une poutre horizontale),
 *   V = dM/dx. Déplacements globaux ux, uy (m), rz (rad, sens trigonométrique). Réactions dans le repère global.
 */
(function (root) {
  'use strict';
  const G3 = [[-0.7745966692414834, 0.5555555555555556], [0, 0.8888888888888888], [0.7745966692414834, 0.5555555555555556]];

  /* factorisation LU avec pivot partiel, réutilisable pour plusieurs seconds membres */
  function lu(A) {
    const n = A.length, P = Array.from({ length: n }, (_, i) => i);
    for (let k = 0; k < n; k++) {
      let p = k, mx = Math.abs(A[k][k]);
      for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > mx) { mx = Math.abs(A[i][k]); p = i; }
      if (mx < 1e-14) throw new Error('Structure instable (mécanisme) : vérifier les appuis et les articulations.');
      if (p !== k) { [A[p], A[k]] = [A[k], A[p]]; [P[p], P[k]] = [P[k], P[p]]; }
      const akk = A[k][k], rk = A[k];
      for (let i = k + 1; i < n; i++) {
        const ri = A[i], f = ri[k] / akk;
        if (f === 0) continue;
        ri[k] = f;
        for (let j = k + 1; j < n; j++) ri[j] -= f * rk[j];
      }
    }
    return (b) => {
      const y = P.map((i) => b[i]);
      for (let i = 0; i < n; i++) { let s = y[i]; const ri = A[i]; for (let j = 0; j < i; j++) s -= ri[j] * y[j]; y[i] = s; }
      for (let i = n - 1; i >= 0; i--) { let s = y[i]; const ri = A[i]; for (let j = i + 1; j < n; j++) s -= ri[j] * y[j]; y[i] = s / ri[i]; }
      return y;
    };
  }

  function geom(m, e) {
    const a = m.nodes[e.i], b = m.nodes[e.j];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
    if (L < 1e-9) throw new Error('Barre de longueur nulle (' + (e.name || e.i + '-' + e.j) + ').');
    return { L, c: dx / L, s: dy / L };
  }

  /* raideur locale 6×6 avec relâchements de moment (condensation statique) */
  function kLocal(e, L) {
    const EA = e.E * e.A / L, EI = e.E * e.I, l2 = L * L, l3 = l2 * L;
    const k = [
      [EA, 0, 0, -EA, 0, 0],
      [0, 12 * EI / l3, 6 * EI / l2, 0, -12 * EI / l3, 6 * EI / l2],
      [0, 6 * EI / l2, 4 * EI / L, 0, -6 * EI / l2, 2 * EI / L],
      [-EA, 0, 0, EA, 0, 0],
      [0, -12 * EI / l3, -6 * EI / l2, 0, 12 * EI / l3, -6 * EI / l2],
      [0, 6 * EI / l2, 2 * EI / L, 0, -6 * EI / l2, 4 * EI / L],
    ];
    return k;
  }
  function condense(k, f, rel) {
    const r = [];
    if (rel && rel[0]) r.push(2);
    if (rel && rel[1]) r.push(5);
    for (const d of r) {
      const kdd = k[d][d];
      if (Math.abs(kdd) < 1e-14) continue;
      const kd = k.map((row) => row[d]), fd = f[d];
      for (let i = 0; i < 6; i++) {
        f[i] -= kd[i] * fd / kdd;
        for (let j = 0; j < 6; j++) k[i][j] -= kd[i] * k[d][j] / kdd;
      }
    }
    return { k, f };
  }

  /* charges réparties/ponctuelles d'une barre → composantes locales (px, py) par segment */
  function localLoads(el, ld, g) {
    const { L, c, s } = g, out = [];
    const proj = (dir, q) => dir === 'gy' ? [q * s, q * c] : dir === 'gx' ? [q * c, -q * s] : dir === 'lx' ? [q, 0] : [0, q];
    const a = ld.a !== undefined ? ld.a : 0, b = ld.b !== undefined ? ld.b : L;
    const dir = ld.dir || 'gy';
    if (ld.type === 'p') { const [px, py] = proj(dir, ld.P); out.push({ kind: 'p', a: Math.min(Math.max(ld.a || 0, 0), L), px, py }); }
    else {
      const q1 = ld.type === 't' ? ld.q1 : ld.q, q2 = ld.type === 't' ? ld.q2 : ld.q;
      const [x1, y1] = proj(dir, q1), [x2, y2] = proj(dir, q2);
      out.push({ kind: 'd', a: Math.max(0, a), b: Math.min(L, b), px1: x1, px2: x2, py1: y1, py2: y2 });
    }
    return out;
  }
  function eqNodal(segs, L) {
    const f = [0, 0, 0, 0, 0, 0];
    const add = (x, px, py, w) => {
      const xi = x / L, x2 = xi * xi, x3 = x2 * xi;
      f[0] += w * px * (1 - xi); f[3] += w * px * xi;
      f[1] += w * py * (1 - 3 * x2 + 2 * x3); f[2] += w * py * L * (xi - 2 * x2 + x3);
      f[4] += w * py * (3 * x2 - 2 * x3); f[5] += w * py * L * (-x2 + x3);
    };
    for (const sg of segs) {
      if (sg.kind === 'p') add(sg.a, sg.px, sg.py, 1);
      else {
        const h = sg.b - sg.a; if (h <= 0) continue;
        for (const [t, w] of G3) {
          const x = sg.a + (t + 1) / 2 * h, r = (x - sg.a) / h;
          add(x, sg.px1 + (sg.px2 - sg.px1) * r, sg.py1 + (sg.py2 - sg.py1) * r, w * h / 2);
        }
      }
    }
    return f;
  }
  const rot = (v, c, s) => [c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2], c * v[3] + s * v[4], -s * v[3] + c * v[4], v[5]];
  const rotT = (v, c, s) => [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2], c * v[3] - s * v[4], s * v[3] + c * v[4], v[5]];

  /* Prépare (assemble + factorise) un modèle ; renvoie run(loads) réutilisable (lignes d'influence). */
  function prepare(m) {
    const nn = m.nodes.length, nd = 3 * nn;
    const K = Array.from({ length: nd }, () => new Float64Array(nd));
    const E = m.elems.map((e) => {
      const g = geom(m, e);
      const k = kLocal(e, g.L);
      return { e, g, k0: k };
    });
    for (const it of E) {
      const { k } = condense(it.k0.map((r) => r.slice()), [0, 0, 0, 0, 0, 0], it.e.rel);
      it.k = k;
      const { c, s } = it.g, T = [[c, s, 0], [-s, c, 0], [0, 0, 1]];
      const dofs = [3 * it.e.i, 3 * it.e.i + 1, 3 * it.e.i + 2, 3 * it.e.j, 3 * it.e.j + 1, 3 * it.e.j + 2];
      for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) {
        let v = 0;
        for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) {
          const ta = T[p][a % 3], tb = T[q][b % 3];
          if (!ta || !tb) continue;
          v += ta * k[(a < 3 ? 0 : 3) + p][(b < 3 ? 0 : 3) + q] * tb;
        }
        K[dofs[a]][dofs[b]] += v;
      }
      it.dofs = dofs;
    }
    // rotation nodale sans raideur (toutes barres articulées sur le nœud) : petit ressort
    const diagMax = Math.max(1, ...K.map((r, i) => Math.abs(r[i])));
    for (let n = 0; n < nn; n++) if (Math.abs(K[3 * n + 2][3 * n + 2]) < 1e-12 * diagMax) K[3 * n + 2][3 * n + 2] = 1e-9 * diagMax;
    // appuis
    const fixed = new Set(), presc = {};
    for (const sp of m.supports || []) {
      ['ux', 'uy', 'rz'].forEach((d, k) => {
        const v = sp[d], idx = 3 * sp.n + k;
        if (v === true) fixed.add(idx);
        else if (typeof v === 'number' && v > 0) K[idx][idx] += v;
      });
    }
    const free = []; for (let i = 0; i < nd; i++) if (!fixed.has(i)) free.push(i);
    const pos = new Int32Array(nd).fill(-1); free.forEach((d, i) => (pos[d] = i));
    const Kff = free.map((i) => free.map((j) => K[i][j]));
    const solveFF = lu(Kff);

    function run(loads = {}) {
      const Fn = new Float64Array(nd);
      for (const p of loads.nodal || []) { Fn[3 * p.n] += p.Fx || 0; Fn[3 * p.n + 1] += p.Fy || 0; Fn[3 * p.n + 2] += p.M || 0; }
      const per = E.map(() => ({ segs: [], feq: [0, 0, 0, 0, 0, 0], eps: 0, kap: 0 }));
      for (const ld of loads.elem || []) {
        const it = E[ld.e]; if (!it) continue;
        per[ld.e].segs.push(...localLoads(it.e, ld, it.g));
      }
      for (const st of loads.strain || []) { per[st.e].eps += st.eps || 0; per[st.e].kap += st.kappa || 0; }
      E.forEach((it, idx) => {
        const P = per[idx], L = it.g.L;
        let f = eqNodal(P.segs, L);
        if (P.eps) { const N = it.e.E * it.e.A * P.eps; f[0] -= N; f[3] += N; }
        if (P.kap) { const M = it.e.E * it.e.I * P.kap; f[2] -= M; f[5] += M; }
        const cd = condense(it.k0.map((r) => r.slice()), f.slice(), it.e.rel);
        P.feq = cd.f; P.feqFull = f;
        const fg = rotT(cd.f, it.g.c, it.g.s);
        it.dofs.forEach((d, a) => (Fn[d] += fg[a]));
      });
      // déplacements imposés
      const U = new Float64Array(nd);
      for (const d of loads.disp || []) U[3 * d.n + { ux: 0, uy: 1, rz: 2 }[d.dof]] = d.v;
      const rhs = free.map((i) => { let s = Fn[i]; for (const j of fixed) if (U[j]) s -= K[i][j] * U[j]; return s; });
      const uf = solveFF(rhs);
      free.forEach((d, i) => (U[d] = uf[i]));
      // efforts d'extrémité (locaux, efforts exercés par les nœuds sur la barre)
      const ends = E.map((it, idx) => {
        const ug = it.dofs.map((d) => U[d]);
        const ul = rot(ug, it.g.c, it.g.s);
        const F = it.k.map((row, a) => row.reduce((t, kv, b) => t + kv * ul[b], 0) - per[idx].feq[a]);
        return { F, ul };
      });
      // réactions : somme des efforts des barres − charges nodales directes
      const Rn = new Float64Array(nd);
      E.forEach((it, idx) => { const fg = rotT(ends[idx].F, it.g.c, it.g.s); it.dofs.forEach((d, a) => (Rn[d] += fg[a])); });
      for (const p of loads.nodal || []) { Rn[3 * p.n] -= p.Fx || 0; Rn[3 * p.n + 1] -= p.Fy || 0; Rn[3 * p.n + 2] -= p.M || 0; }
      const reac = (m.supports || []).map((sp) => ({ n: sp.n, Rx: Rn[3 * sp.n], Ry: Rn[3 * sp.n + 1], Mz: Rn[3 * sp.n + 2] }));
      // ressorts : réaction = −k·u (effort du sol sur la structure)
      for (const r of reac) {
        const sp = (m.supports || []).find((x) => x.n === r.n);
        if (typeof sp.ux === 'number' && sp.ux > 0) r.Rx = -sp.ux * U[3 * r.n];
        if (typeof sp.uy === 'number' && sp.uy > 0) r.Ry = -sp.uy * U[3 * r.n + 1];
        if (typeof sp.rz === 'number' && sp.rz > 0) r.Mz = -sp.rz * U[3 * r.n + 2];
      }

      /* efforts internes en x (local) de la barre e */
      function at(e, x) {
        const it = E[e], P = per[e], F = ends[e].F;
        let N = -F[0], V = F[1], M = -F[2] + F[1] * x;
        for (const sg of P.segs) {
          if (sg.kind === 'p') { if (sg.a < x || (sg.a <= x && x >= it.g.L)) { N -= sg.px; V += sg.py; M += sg.py * (x - sg.a); } }
          else {
            const lo = sg.a, hi = Math.min(sg.b, x); if (hi <= lo) continue;
            const h = sg.b - sg.a, qa = (t) => sg.py1 + (sg.py2 - sg.py1) * (t - sg.a) / h, pa = (t) => sg.px1 + (sg.px2 - sg.px1) * (t - sg.a) / h;
            const q1 = qa(lo), q2 = qa(hi), d = hi - lo;
            V += (q1 + q2) / 2 * d;
            M += q1 * d * (x - lo - d / 2) + (q2 - q1) * d / 2 * (x - lo - 2 * d / 3);
            N -= (pa(lo) + pa(hi)) / 2 * d;
          }
        }
        return { N, V, M };
      }
      /* échantillonnage d'une barre : efforts et flèche locale (v transversale, m) */
      function diagram(e, n = 40) {
        const it = E[e], L = it.g.L, P = per[e];
        const xs = new Set(); for (let k = 0; k <= n; k++) xs.add(L * k / n);
        for (const sg of P.segs) { if (sg.kind === 'p') { xs.add(Math.max(0, sg.a - 1e-9)); xs.add(Math.min(L, sg.a + 1e-9)); } else { xs.add(sg.a); xs.add(sg.b); } }
        const X = [...xs].filter((x) => x >= 0 && x <= L).sort((a, b) => a - b);
        const pts = X.map((x) => Object.assign({ x }, at(e, x)));
        // flèche : v'' = M/EI + κ0, v(0)=v1, v'(0)=θ1 (repère local, θ1 = rotation nodale si non relâchée)
        const ul = ends[e].ul, EI = it.e.E * it.e.I;
        let th1 = ul[2];
        if (it.e.rel && it.e.rel[0]) {
          // rotation propre de l'extrémité relâchée : obtenue par la condition v(L) = v2
          th1 = null;
        }
        const integ = (t0) => {
          let v = ul[1], t = t0; const out = [v];
          for (let k = 1; k < pts.length; k++) {
            const h = pts[k].x - pts[k - 1].x, c0 = pts[k - 1].M / EI + (P.kap || 0), c1 = pts[k].M / EI + (P.kap || 0);
            v += t * h + h * h * (2 * c0 + c1) / 6; t += h * (c0 + c1) / 2; out.push(v);
          }
          return out;
        };
        let v;
        if (th1 === null) {
          const a = integ(0), b = integ(1), v2 = ul[4];
          const t = (v2 - a[a.length - 1]) / (b[b.length - 1] - a[a.length - 1]);
          v = a.map((x, k) => x + t * (b[k] - x));
        } else v = integ(th1);
        pts.forEach((p, k) => (p.v = v[k]));
        return pts;
      }
      return { U, reac, ends, at, diagram, nodeDisp: (n) => ({ ux: U[3 * n], uy: U[3 * n + 1], rz: U[3 * n + 2] }) };
    }
    return { run, elems: E.map((it) => ({ L: it.g.L, c: it.g.c, s: it.g.s })) };
  }

  const solve = (m, loads) => prepare(m).run(loads || m.loads || {});

  /* Poutre continue horizontale : portées [L1..Ln], EI constant ou par travée, appuis simples.
   * Renvoie un modèle subdivisé (nseg éléments par travée) avec l'abscisse cumulée de chaque nœud. */
  function poutreContinue(portees, o = {}) {
    const nseg = o.nseg || 20, nodes = [], elems = [], supports = [], x0 = [];
    let x = 0; nodes.push({ x: 0, y: 0 });
    portees.forEach((L, t) => {
      const EI = Array.isArray(o.EI) ? o.EI[t] : (o.EI || 1e6);
      for (let k = 1; k <= nseg; k++) {
        nodes.push({ x: x + L * k / nseg, y: 0 });
        elems.push({ i: nodes.length - 2, j: nodes.length - 1, E: 1, A: o.EA || 1e9, I: EI, travee: t });
      }
      x0.push(x); x += L;
    });
    const appuis = [0]; let c = 0; portees.forEach(() => { c += nseg; appuis.push(c); });
    appuis.forEach((n, k) => supports.push({ n, ux: k === 0, uy: (o.kv && o.kv[k]) ? o.kv[k] : true, rz: (o.encastre && o.encastre[k]) ? true : false }));
    return { nodes, elems, supports, appuis, x0, Ltot: x, nseg };
  }

  const api = { prepare, solve, poutreContinue, lu };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.portique = api; }
})(typeof window !== 'undefined' ? window : globalThis);
