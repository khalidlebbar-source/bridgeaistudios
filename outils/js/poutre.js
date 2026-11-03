/* POUTRE — poutres continues de 1 à 20 travées (moteur pur, sans DOM).
 *
 * Modèle de poutre d'Euler-Bernoulli discrétisé en éléments finis cubiques (Hermite), 2 ddl par nœud
 * (flèche w positive vers le bas, rotation θ = dw/dx positive en sens horaire). Système bande (demi-largeur 3)
 * factorisé une seule fois par Cholesky ; les lignes d'influence sont obtenues par la méthode adjointe
 * (théorème de réciprocité de Maxwell-Betti) : une résolution par grandeur étudiée donne sa ligne d'influence
 * en tous les nœuds. Les résultats sont donc exacts aux nœuds pour une inertie constante par élément ;
 * l'inertie variable est représentée par une inertie constante par élément (≥ 40 éléments par travée).
 *
 * Conventions : charges positives vers le bas ; M > 0 tend la fibre inférieure (moment de travée) ;
 * V = dM/dx ; réactions positives vers le haut ; couple appliqué positif en sens horaire.
 * Unités : kN, m, kPa (E saisi en MPa).
 *
 * Charges réglementaires : EN 1991-2 §6.3 (LM71 = UIC 71, SW/0, SW/2), §6.4.5 (Φ2, Φ3, tableau 6.2),
 * annexe C (majoration dynamique des trains réels), §4.3.2 (LM1, α de l'AN française) ;
 * Fascicule 61 titre II (A(l) art. 4, Bc/Bt/Br art. 5, δ art. 5.5, Mc80/Mc120 art. 9) ;
 * EN 15528 (catégories de ligne, wagons de référence) pour les études de circulation.
 */
(function (root) {
  'use strict';
  const CH = (typeof module !== 'undefined' && module.exports && typeof require === 'function')
    ? require('./charges.js') : (root.BA && root.BA.charges);
  const G = 9.81;
  const EPS = 1e-9;

  /* ══════════════════ 1. Maillage et rigidité ══════════════════ */

  /* inertie le long d'une travée (ξ = x/L) */
  function inertie(t, xi) {
    const Ig = +t.Ig, Id = t.Id === undefined || t.Id === '' || !Number.isFinite(+t.Id) ? Ig : +t.Id;
    const Im = t.Im === undefined || t.Im === '' || !Number.isFinite(+t.Im) ? Ig : +t.Im;
    if (t.loi === 'lin') return Ig + (Id - Ig) * xi;
    if (t.loi === 'para') {
      // variation parabolique : Ig sur l'appui gauche, Im à mi-travée, Id sur l'appui droit (tangente horizontale à mi-travée)
      return xi <= 0.5 ? Im + (Ig - Im) * Math.pow(1 - 2 * xi, 2) : Im + (Id - Im) * Math.pow(2 * xi - 1, 2);
    }
    return Ig;
  }

  /* Construit la structure : nœuds, éléments, appuis, sections, factorisation.
   * m = { E (MPa), travees:[{L, loi:'cst'|'lin'|'para', Ig, Im, Id}], consoles:{g, d} (m),
   *       appuis:[{type:'simple'|'encastre'|'elastique', kv (kN/m), kr (kN·m/rad)}] (n+1),
   *       ns (sections par travée, 2 à 50), Ix:[{x0,x1,I}] (tableau d'inertie facultatif, prioritaire) } */
  function build(m) {
    const tr = (m.travees || []).filter((t) => +t.L > 0);
    if (!tr.length) throw new Error('Au moins une travée de portée non nulle est nécessaire.');
    if (tr.length > 20) throw new Error('20 travées au maximum.');
    const ns = Math.max(2, Math.min(50, Math.round(+m.ns || 10)));
    const E = (+m.E || 0) * 1000;
    if (!(E > 0)) throw new Error('Module d’élasticité E non valide.');
    const sub = Math.max(1, Math.ceil((+m.nel || 80) / ns));  // éléments entre deux sections (≥ 80 par travée)
    const cg = Math.max(0, +(m.consoles && m.consoles.g) || 0), cd = Math.max(0, +(m.consoles && m.consoles.d) || 0);
    const segs = [];
    if (cg > 0) segs.push({ kind: 'cg', L: cg, t: tr[0], x0: -cg, If: () => inertie(tr[0], 0) });
    let x = 0;
    tr.forEach((t, i) => { segs.push({ kind: 't', i, L: +t.L, t, x0: x, If: (xi) => inertie(t, xi) }); x += +t.L; });
    if (cd > 0) segs.push({ kind: 'cd', L: cd, t: tr[tr.length - 1], x0: x, If: () => inertie(tr[tr.length - 1], 1) });
    const Ltot = x;
    const X = [segs[0].x0], el = [], sections = [];
    const Ix = Array.isArray(m.Ix) && m.Ix.length ? m.Ix : null;
    const IxAt = (xx) => { for (const r of Ix) if (xx >= +r.x0 - EPS && xx <= +r.x1 + EPS) return +r.I; return null; };
    segs.forEach((s, si) => {
      const nel = ns * sub, h = s.L / nel, base = X.length - 1;
      s.n0 = base; s.n1 = base + nel;
      for (let k = 1; k <= nel; k++) {
        X.push(s.x0 + h * k);
        const xm = s.x0 + h * (k - 0.5);
        let I = Ix ? IxAt(xm) : null;
        if (I === null) I = s.If((k - 0.5) / nel);
        if (!(I > 0)) throw new Error('Inertie nulle ou négative dans la ' + (s.kind === 't' ? 'travée ' + (s.i + 1) : 'console') + '.');
        el.push({ i: X.length - 2, j: X.length - 1, h, EI: E * I, seg: si });
      }
      for (let k = 0; k <= ns; k++) {
        const nd = base + k * sub;
        sections.push({ x: X[nd], node: nd, seg: si, kind: s.kind, travee: s.kind === 't' ? s.i : (s.kind === 'cg' ? 0 : tr.length - 1),
          side: k === 0 ? 'd' : (k === ns ? 'g' : ''), elR: k < ns ? s.n0 + k * sub - 0 : null });
      }
    });
    // élément à droite / à gauche de chaque section
    for (const sc of sections) {
      sc.eR = sc.side === 'g' ? null : el.findIndex((e) => e.i === sc.node);
      sc.eL = sc.side === 'd' ? null : el.findIndex((e) => e.j === sc.node);
      if (sc.side === '' ) sc.eL = null;
      delete sc.elR;
    }
    // appuis : un appui à chaque extrémité de travée
    const nApp = tr.length + 1, app = [];
    const segT = segs.filter((s) => s.kind === 't');
    for (let k = 0; k < nApp; k++) {
      const nd = k < tr.length ? segT[k].n0 : segT[tr.length - 1].n1;
      const a = (m.appuis && m.appuis[k]) || {};
      const type = a.type || 'simple';
      app.push({ k, node: nd, x: X[nd], type, kv: +a.kv || 0, kr: +a.kr || 0 });
    }
    const N = X.length, nd = 2 * N;
    // matrice complète bande (demi-largeur 3) : Kb[i*4 + (j-i)]
    const Kb = new Float64Array(nd * 4);
    const addK = (i, j, v) => { if (j < i) [i, j] = [j, i]; Kb[i * 4 + (j - i)] += v; };
    for (const e of el) {
      const k = kElem(e.EI, e.h), d = [2 * e.i, 2 * e.i + 1, 2 * e.j, 2 * e.j + 1];
      e.k = k; e.d = d;
      for (let a = 0; a < 4; a++) for (let b = a; b < 4; b++) addK(d[a], d[b], k[a][b]);
    }
    const fixed = new Uint8Array(nd);
    for (const a of app) {
      if (a.type === 'elastique') {
        if (!(a.kv > 0) && !(a.kr > 0)) throw new Error('Appui élastique n° ' + (a.k + 1) + ' sans raideur.');
        if (a.kv > 0) addK(2 * a.node, 2 * a.node, a.kv);
        if (a.kr > 0) addK(2 * a.node + 1, 2 * a.node + 1, a.kr);
      } else {
        fixed[2 * a.node] = 1;
        if (a.type === 'encastre') fixed[2 * a.node + 1] = 1;
      }
    }
    // système réduit aux ddl libres
    const map = new Int32Array(nd).fill(-1), free = [];
    for (let i = 0; i < nd; i++) if (!fixed[i]) { map[i] = free.length; free.push(i); }
    const nf = free.length, P = 3;
    const A = new Float64Array(nf * (P + 1));
    for (let fi = 0; fi < nf; fi++) {
      const gi = free[fi];
      for (let gj = gi; gj <= Math.min(nd - 1, gi + 3); gj++) {
        const fj = map[gj]; if (fj < 0) continue;
        if (fj - fi > P) throw new Error('largeur de bande');
        A[fi * (P + 1) + (fj - fi)] += Kb[gi * 4 + (gj - gi)];
      }
    }
    const dmax = Math.max(1, ...Array.from({ length: nf }, (_, i) => Math.abs(A[i * (P + 1)])));
    const A0 = Float64Array.from(A);
    cholBand(A, nf, P, dmax);
    /* résolution + un pas de raffinement itératif (appuis élastiques très souples devant la rigidité des éléments) */
    const solveF = (b) => {
      const x = solveBand(A, nf, P, b), r = Float64Array.from(b), w = P + 1;
      for (let i = 0; i < nf; i++) {
        const xi = x[i]; r[i] -= A0[i * w] * xi;
        for (let k = 1; k <= P && i + k < nf; k++) { const a = A0[i * w + k]; if (a) { r[i] -= a * x[i + k]; r[i + k] -= a * xi; } }
      }
      const d = solveBand(A, nf, P, r);
      for (let i = 0; i < nf; i++) x[i] += d[i];
      return x;
    };
    const kGet = (i, j) => { if (j < i) [i, j] = [j, i]; return j - i > 3 ? 0 : Kb[i * 4 + (j - i)]; };
    return { X, el, segs, sections, app, N, nd, fixed, map, free, solveF, kGet, Ltot, x0: X[0], xn: X[N - 1], ns, sub, nTrav: tr.length, travees: tr, E, cache: {} };
  }

  function kElem(EI, h) {
    const c = EI / (h * h * h), h2 = h * h;
    return [[12 * c, 6 * h * c, -12 * c, 6 * h * c], [6 * h * c, 4 * h2 * c, -6 * h * c, 2 * h2 * c],
      [-12 * c, -6 * h * c, 12 * c, -6 * h * c], [6 * h * c, 2 * h2 * c, -6 * h * c, 4 * h2 * c]];
  }
  /* Cholesky bande en place : A[i*(p+1)+k] = K[i][i+k] → U (K = UᵀU) */
  function cholBand(A, n, p, dmax) {
    const w = p + 1;
    for (let i = 0; i < n; i++) {
      let d = A[i * w];
      for (let k = Math.max(0, i - p); k < i; k++) { const u = A[k * w + (i - k)]; d -= u * u; }
      if (!(d > 1e-11 * dmax)) throw new Error('Structure instable (mécanisme) : vérifier les appuis.');
      d = Math.sqrt(d); A[i * w] = d;
      for (let j = i + 1; j <= Math.min(n - 1, i + p); j++) {
        let s = A[i * w + (j - i)];
        for (let k = Math.max(0, j - p); k < i; k++) s -= A[k * w + (i - k)] * A[k * w + (j - k)];
        A[i * w + (j - i)] = s / d;
      }
    }
  }
  function solveBand(A, n, p, b) {
    const w = p + 1, y = Float64Array.from(b);
    for (let i = 0; i < n; i++) { let s = y[i]; for (let k = Math.max(0, i - p); k < i; k++) s -= A[k * w + (i - k)] * y[k]; y[i] = s / A[i * w]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let j = i + 1; j <= Math.min(n - 1, i + p); j++) s -= A[i * w + (j - i)] * y[j]; y[i] = s / A[i * w]; }
    return y;
  }

  /* ══════════════════ 2. Charges fixes ══════════════════ */

  const hermite = (xi, h) => [1 - 3 * xi * xi + 2 * xi ** 3, h * (xi - 2 * xi * xi + xi ** 3), 3 * xi * xi - 2 * xi ** 3, h * (-xi * xi + xi ** 3)];
  const hermiteD = (xi, h) => [(-6 * xi + 6 * xi * xi) / h, 1 - 4 * xi + 3 * xi * xi, (6 * xi - 6 * xi * xi) / h, -2 * xi + 3 * xi * xi];
  const G3 = [[-0.7745966692414834, 0.5555555555555556], [0, 0.8888888888888888], [0.7745966692414834, 0.5555555555555556]];

  /* élément contenant l'abscisse x (le dernier si x est sur un nœud de fin) */
  function findElem(S, x) {
    const X = S.X; if (x < X[0] - EPS || x > X[S.N - 1] + EPS) return -1;
    let lo = 0, hi = S.N - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (X[mid] <= x) lo = mid; else hi = mid; }
    return Math.min(lo, S.el.length - 1);
  }
  const nodeAt = (S, x) => { const e = findElem(S, x); if (e < 0) return -1; const E = S.el[e]; if (Math.abs(S.X[E.i] - x) < 1e-7) return E.i; if (Math.abs(S.X[E.j] - x) < 1e-7) return E.j; return -1; };

  /* loads : [{type:'P', x, P} | {type:'C', x, C} | {type:'q', a, b, q} | {type:'t', a, b, q1, q2} | {type:'d', appui (1..n+1), v (m, vers le bas)}] */
  function fixe(S, loads) {
    const F = new Float64Array(S.nd), per = S.el.map(() => ({ p: [], c: [], d: [], feq: [0, 0, 0, 0] })), warn = [];
    const presc = new Float64Array(S.nd);
    for (const L of loads || []) {
      if (L.type === 'P' || L.type === 'C') {
        const x = +L.x, v = L.type === 'P' ? +L.P : +L.C;
        if (!Number.isFinite(x) || !Number.isFinite(v) || !v) continue;
        const n = nodeAt(S, x);
        if (n >= 0) { F[2 * n + (L.type === 'P' ? 0 : 1)] += v; continue; }
        const e = findElem(S, x); if (e < 0) { warn.push('Charge hors de la poutre (x = ' + x + ' m) ignorée.'); continue; }
        const E = S.el[e], a = x - S.X[E.i], xi = a / E.h;
        const N = L.type === 'P' ? hermite(xi, E.h) : hermiteD(xi, E.h);
        for (let k = 0; k < 4; k++) per[e].feq[k] += v * N[k];
        (L.type === 'P' ? per[e].p : per[e].c).push({ a, v });
      } else if (L.type === 'q' || L.type === 't') {
        let a = +L.a, b = +L.b; const q1 = L.type === 'q' ? +L.q : +L.q1, q2 = L.type === 'q' ? +L.q : +L.q2;
        if (!Number.isFinite(a)) a = S.x0; if (!Number.isFinite(b)) b = S.xn;
        if (!(b > a) || !Number.isFinite(q1) || !Number.isFinite(q2)) continue;
        const qa = (x) => q1 + (q2 - q1) * (x - a) / (b - a);
        const A0 = Math.max(a, S.x0), B0 = Math.min(b, S.xn);
        if (A0 < a - EPS || B0 > b + EPS || B0 <= A0) { if (B0 <= A0) warn.push('Charge répartie hors de la poutre ignorée.'); }
        S.el.forEach((E, e) => {
          const xa = Math.max(A0, S.X[E.i]), xb = Math.min(B0, S.X[E.j]);
          if (xb - xa <= 1e-12) return;
          const sg = { a: xa - S.X[E.i], b: xb - S.X[E.i], q1: qa(xa), q2: qa(xb) };
          per[e].d.push(sg);
          const hh = sg.b - sg.a;
          for (const [t, w] of G3) {
            const xl = sg.a + (t + 1) / 2 * hh, q = sg.q1 + (sg.q2 - sg.q1) * (xl - sg.a) / hh, N = hermite(xl / E.h, E.h);
            for (let k = 0; k < 4; k++) per[e].feq[k] += w * hh / 2 * q * N[k];
          }
        });
      } else if (L.type === 'd') {
        const ap = S.app[Math.round(+L.appui) - 1], v = +L.v;
        if (!ap || !Number.isFinite(v)) { warn.push('Dénivellation : appui n° ' + L.appui + ' inexistant.'); continue; }
        if (ap.type === 'elastique') { if (ap.kv > 0) F[2 * ap.node] += ap.kv * v; ap._sett = (ap._sett || 0) + v; }
        else presc[2 * ap.node] += v;
      }
    }
    S.el.forEach((E, e) => E.d.forEach((g, k) => (F[g] += per[e].feq[k])));
    // second membre réduit
    const nf = S.free.length, b = new Float64Array(nf);
    for (let fi = 0; fi < nf; fi++) {
      const gi = S.free[fi]; let s = F[gi];
      for (let gj = Math.max(0, gi - 3); gj <= Math.min(S.nd - 1, gi + 3); gj++) if (S.fixed[gj] && presc[gj]) s -= S.kGet(gi, gj) * presc[gj];
      b[fi] = s;
    }
    const uf = S.solveF(b), U = Float64Array.from(presc);
    S.free.forEach((g, i) => (U[g] = uf[i]));
    const Ku = (g) => { let s = 0; for (let j = Math.max(0, g - 3); j <= Math.min(S.nd - 1, g + 3); j++) s += S.kGet(g, j) * U[j]; return s; };
    const ends = S.el.map((E, e) => { const u = E.d.map((g) => U[g]); return E.k.map((r, a) => r.reduce((t, kv, c) => t + kv * u[c], 0) - per[e].feq[a]); });
    const appuis = S.app.map((a) => {
      const gw = 2 * a.node, gr = gw + 1;
      let R, Mr = 0;
      if (a.type === 'elastique') { R = a.kv * (U[gw] - (a._sett || 0)); Mr = a.kr * U[gr]; delete a._sett; }
      else { R = F[gw] - Ku(gw); if (a.type === 'encastre') Mr = F[gr] - Ku(gr); }
      return { k: a.k, x: a.x, R, Mr, w: U[gw], th: U[gr], type: a.type };
    });
    /* efforts dans l'élément e à l'abscisse locale x (côté droit d'une charge ponctuelle si x = a) */
    function at(e, x, left) {
      const f = ends[e], P = per[e];
      let V = -f[0], M = f[1] + V * x;
      for (const p of P.p) if (p.a < x || (!left && p.a <= x)) { V -= p.v; M -= p.v * (x - p.a); }
      for (const c of P.c) if (c.a < x || (!left && c.a <= x)) M += c.v;
      for (const sg of P.d) {
        const lo = sg.a, hi = Math.min(sg.b, x); if (hi <= lo) continue;
        const h = sg.b - sg.a, qa = (t) => sg.q1 + (sg.q2 - sg.q1) * (t - sg.a) / h, q1 = qa(lo), q2 = qa(hi), d = hi - lo;
        V -= (q1 + q2) / 2 * d;
        M -= q1 * d * (x - lo - d / 2) + (q2 - q1) * d / 2 * (x - lo - 2 * d / 3);
      }
      return { M, V };
    }
    const wNode = (n) => U[2 * n];
    /* efforts au point x (global) ; side 'g' : juste à gauche */
    function effort(x, side) {
      let e = findElem(S, x); if (e < 0) return null;
      const n = nodeAt(S, x);
      if (n >= 0) {
        // à un nœud : élément de droite (ou de gauche pour side 'g' ou en bout)
        const eR = S.el.findIndex((E) => E.i === n), eL = S.el.findIndex((E) => E.j === n);
        if ((side === 'g' || eR < 0) && eL >= 0) { const r = at(eL, S.el[eL].h, true); return { M: r.M, V: r.V, w: wNode(n) }; }
        const r = at(eR, 0, false); return { M: r.M, V: r.V, w: wNode(n) };
      }
      const E = S.el[e], xl = x - S.X[E.i], r = at(e, xl, side === 'g');
      const N = hermite(xl / E.h, E.h), u = E.d.map((g) => U[g]);
      // flèche entre nœuds : interpolation d'Hermite (exacte en l'absence de charge dans l'élément)
      return { M: r.M, V: r.V, w: N.reduce((t, v, k) => t + v * u[k], 0) };
    }
    const sec = S.sections.map((s) => Object.assign({ x: s.x, side: s.side, kind: s.kind, travee: s.travee }, effort(s.x, s.side === 'g' ? 'g' : 'd')));
    // diagramme : tous les nœuds, des deux côtés des charges ponctuelles et des appuis
    const diag = [];
    S.el.forEach((E, e) => {
      const xs = new Set([0, E.h]);
      for (const p of per[e].p.concat(per[e].c)) { xs.add(p.a); }
      for (const sg of per[e].d) { xs.add(sg.a); xs.add(sg.b); }
      const L = [...xs].sort((a, b) => a - b);
      const u = E.d.map((g) => U[g]);
      L.forEach((xl, k) => {
        const N = hermite(xl / E.h, E.h), w = N.reduce((t, v, i) => t + v * u[i], 0);
        const hasP = per[e].p.some((p) => Math.abs(p.a - xl) < 1e-12) || per[e].c.some((p) => Math.abs(p.a - xl) < 1e-12);
        if (hasP) { const l = at(e, xl, true); diag.push({ x: S.X[E.i] + xl, M: l.M, V: l.V, w }); }
        const r = at(e, xl, k === L.length - 1);
        diag.push({ x: S.X[E.i] + xl, M: r.M, V: r.V, w });
      });
    });
    return { sec, diag, appuis, U, warn };
  }

  /* ══════════════════ 3. Lignes d'influence ══════════════════ */

  /* ligne d'influence linéaire par morceaux sur les nœuds X, avec limites à gauche/droite (sauts) */
  function makeLI(X, YL, YR) {
    const N = X.length, F = new Float64Array(N), Fp = new Float64Array(N), Fn = new Float64Array(N);
    const posPart = (a, b, d) => { if (a >= 0 && b >= 0) return (a + b) / 2 * d; if (a <= 0 && b <= 0) return 0; const t = a / (a - b); return a > 0 ? a * t * d / 2 : b * (1 - t) * d / 2; };
    for (let k = 1; k < N; k++) {
      const a = YR[k - 1], b = YL[k], d = X[k] - X[k - 1];
      F[k] = F[k - 1] + (a + b) / 2 * d; const p = posPart(a, b, d);
      Fp[k] = Fp[k - 1] + p; Fn[k] = Fn[k - 1] + ((a + b) / 2 * d - p);
    }
    const x0 = X[0], xn = X[N - 1];
    // recherche du segment en O(1) : table de seaux sur [x0, xn]
    const NB = 4 * N, bw = (xn - x0) / NB, B = new Int32Array(NB + 1);
    for (let b = 0, k = 0; b <= NB; b++) { const xb = x0 + b * bw; while (k < N - 2 && X[k + 1] <= xb) k++; B[b] = k; }
    const seg = (x) => { let k = B[Math.min(NB, Math.max(0, Math.floor((x - x0) / bw)))]; while (k < N - 2 && X[k + 1] <= x) k++; while (k > 0 && X[k] > x) k--; return k; };
    /* mode : 1 = valeur haute au droit d'un saut, −1 = basse, 0 = limite à droite */
    function at(x, mode) {
      if (x < x0 - 1e-9 || x > xn + 1e-9) return 0;
      const k = seg(x);
      if (Math.abs(x - X[k]) < 1e-9) { const l = YL[k], r = YR[k]; return mode > 0 ? Math.max(l, r) : mode < 0 ? Math.min(l, r) : r; }
      if (k + 1 < N && Math.abs(x - X[k + 1]) < 1e-9) { const l = YL[k + 1], r = YR[k + 1]; return mode > 0 ? Math.max(l, r) : mode < 0 ? Math.min(l, r) : (k + 1 === N - 1 ? l : r); }
      const t = (x - X[k]) / (X[k + 1] - X[k]);
      return YR[k] + (YL[k + 1] - YR[k]) * t;
    }
    /* valeurs haute et basse en x (identiques hors d'un saut) : renvoyées dans hl[0], hl[1] */
    const hl = new Float64Array(2);
    function atHL(x) {
      if (x < x0 - 1e-9 || x > xn + 1e-9) { hl[0] = 0; hl[1] = 0; return hl; }
      const k = seg(x);
      let n = -1;
      if (x - X[k] < 1e-9) n = k; else if (k + 1 < N && X[k + 1] - x < 1e-9) n = k + 1;
      if (n >= 0) { const l = YL[n], r = YR[n]; if (l > r) { hl[0] = l; hl[1] = r; } else { hl[0] = r; hl[1] = l; } return hl; }
      const v = YR[k] + (YL[k + 1] - YR[k]) * (x - X[k]) / (X[k + 1] - X[k]);
      hl[0] = v; hl[1] = v; return hl;
    }
    const cumG = (arr, kind, x) => {
      if (x <= x0) return 0; if (x >= xn) return arr[N - 1];
      const k = seg(x), d = x - X[k], a = YR[k], yx = YR[k] + (YL[k + 1] - YR[k]) * d / (X[k + 1] - X[k]);
      const p = posPart(a, yx, d);
      return arr[k] + (kind === 0 ? (a + yx) / 2 * d : kind > 0 ? p : (a + yx) / 2 * d - p);
    };
    const integ = (a, b) => cumG(F, 0, b) - cumG(F, 0, a);
    const pos = (a, b) => cumG(Fp, 1, b) - cumG(Fp, 1, a);
    const neg = (a, b) => cumG(Fn, -1, b) - cumG(Fn, -1, a);
    // intervalles de signe constant (passages par zéro exacts)
    const ivs = { p: [], n: [] }, zeros = [];
    let cur = null;
    for (let k = 0; k < N - 1; k++) {
      const a = YR[k], b = YL[k + 1], xa = X[k], xb = X[k + 1];
      const pieces = [];
      if ((a > 0 && b < 0) || (a < 0 && b > 0)) { const xz = xa + a / (a - b) * (xb - xa); zeros.push(xz); pieces.push([xa, xz, Math.sign(a)], [xz, xb, Math.sign(b)]); }
      else pieces.push([xa, xb, (a + b) > 0 ? 1 : (a + b) < 0 ? -1 : 0]);
      for (const [u, v, s] of pieces) {
        if (!s) { cur = null; continue; }
        if (cur && cur.s === s && Math.abs(cur.b - u) < 1e-12) cur.b = v;
        else { cur = { a: u, b: v, s }; (s > 0 ? ivs.p : ivs.n).push(cur); }
      }
    }
    const lobes = ivs.p.map((o) => ({ sg: 1, a: o.a, b: o.b, A: integ(o.a, o.b) })).concat(ivs.n.map((o) => ({ sg: -1, a: o.a, b: o.b, A: integ(o.a, o.b) })));
    return { X, YL, YR, x0, xn, L: xn - x0, at, atHL, integ, pos, neg, ivs, zeros, lobes, Ptot: Fp[N - 1], Ntot: Fn[N - 1] };
  }

  /* Lignes d'influence de toutes les grandeurs (mises en cache dans S) :
   * par section : M, V, w ; par appui : R, θ. opts.w = false pour ne pas calculer les flèches. */
  function lignes(S, opts = {}) {
    const key = 'li' + (opts.w === false ? '0' : '1');
    if (S.cache[key]) return S.cache[key];
    const nf = S.free.length, N = S.N;
    const solveC = (cG) => { // cG : vecteur global (ddl) → réponse w nodale
      const b = new Float64Array(nf); let any = false;
      for (const [g, v] of cG) { const f = S.map[g]; if (f >= 0) { b[f] += v; any = true; } }
      const y = new Float64Array(N);
      if (!any) return y;
      const r = S.solveF(b);
      for (let n = 0; n < N; n++) { const f = S.map[2 * n]; y[n] = f >= 0 ? r[f] : 0; }
      return y;
    };
    const rowElem = (e, a) => { const E = S.el[e]; return E.d.map((g, c) => [g, E.k[a][c]]); };
    const mk = (y, jump) => {
      const YL = Float64Array.from(y), YR = Float64Array.from(y);
      if (jump) { if (jump.side === 'R') YR[jump.n] += 1; else YL[jump.n] -= 1; }
      return makeLI(S.X, YL, YR);
    };
    const Mli = new Map();
    const sec = S.sections.map((s) => {
      let M = Mli.get(s.node);
      if (!M) {
        const eR = S.el.findIndex((E) => E.i === s.node), eL = S.el.findIndex((E) => E.j === s.node);
        // M = C1 de l'élément de droite (= −C2 de l'élément de gauche)
        M = eR >= 0 ? mk(solveC(rowElem(eR, 1))) : mk(solveC(rowElem(eL, 3)).map((v) => -v));
        Mli.set(s.node, M);
      }
      let V;
      if (s.side === 'g') V = mk(solveC(rowElem(s.eL, 2)), { n: s.node, side: 'L' });              // V(L) = F2
      else V = mk(solveC(rowElem(s.eR, 0)).map((v) => -v), { n: s.node, side: 'R' });               // V(0) = −F1
      const w = opts.w === false ? null : (S.cache['w' + s.node] || (S.cache['w' + s.node] = mk(solveC([[2 * s.node, 1]]))));
      return { M, V, w };
    });
    const app = S.app.map((a) => {
      const gw = 2 * a.node, gr = gw + 1;
      let R;
      if (a.type === 'elastique') R = mk(solveC(a.kv > 0 ? [[gw, 1]] : []).map((v) => v * a.kv));
      else {
        const row = []; for (let j = Math.max(0, gw - 3); j <= Math.min(S.nd - 1, gw + 3); j++) if (!S.fixed[j]) row.push([j, S.kGet(gw, j)]);
        const y = solveC(row).map((v) => -v); y[a.node] = 1; R = mk(y);
      }
      const th = mk(solveC(S.fixed[gr] ? [] : [[gr, 1]]));
      return { R, th };
    });
    return (S.cache[key] = { sec, app });
  }

  /* ══════════════════ 4. Enveloppes sous charges mobiles ══════════════════
   * Chaque fonction renvoie {max:{v, arr}, min:{v, arr}} ; arr = {pts:[[x,P]], ivs:[[a,b,q]]} décrit la position
   * de la charge, pour calculer les effets concomitants sur une autre ligne d'influence. */

  const empty = () => ({ max: { v: 0, arr: { pts: [], ivs: [] } }, min: { v: 0, arr: { pts: [], ivs: [] } } });
  const effet = (li, arr) => { let e = 0; for (const [x, P] of arr.pts) e += P * li.at(x, 0); for (const [a, b, q] of arr.ivs) e += q * li.integ(a, b); return e; };
  const uniq = (arr) => { const a = Float64Array.from(arr).sort(), o = []; for (let i = 0; i < a.length; i++) if (!o.length || a[i] - o[o.length - 1] > 1e-9) o.push(a[i]); return o; };

  /* convoi d'essieux (d depuis la tête, P > 0), dans les deux sens (exact : un essieu au droit d'un nœud) */
  function envEssieux(li, ax0, opt = {}) {
    const out = empty(); if (!ax0.length) return out;
    const ax = ax0.slice().sort((a, b) => a.d - b.d), nA = ax.length, D = ax.map((a) => a.d), PP = ax.map((a) => a.P);
    const dirs = opt.sym ? [1] : [1, -1], X = li.X, x0 = li.x0 - 1e-9, xn = li.xn + 1e-9;
    // indice du premier essieu d'abscisse relative ≥ t
    const lb = (t) => { let lo = 0, hi = nA; while (lo < hi) { const m = (lo + hi) >> 1; if (D[m] < t) lo = m + 1; else hi = m; } return lo; };
    for (const dir of dirs) {
      for (let ia = 0; ia < nA; ia++) for (let k = 0; k < X.length; k++) {
        const s = X[k] - dir * D[ia];
        // train périodique : une position décalée d'une période au-delà de l'entrée est équivalente
        if (opt.period && (dir > 0 ? s < li.x0 - opt.period - D[0] : s > li.xn + opt.period + D[0])) continue;
        // essieux sur la poutre : s + dir·d ∈ [x0, xn]
        const ta = dir > 0 ? x0 - s : s - xn, tb = dir > 0 ? xn - s : s - x0;
        const j0 = lb(ta - 1e-12), j1 = lb(tb + 1e-12);
        let hi = 0, lo = 0;
        for (let j = j0; j < j1; j++) { const h = li.atHL(s + dir * D[j]), P = PP[j]; hi += P * h[0]; lo += P * h[1]; }
        if (hi > out.max.v) out.max = { v: hi, s, dir };
        if (lo < out.min.v) out.min = { v: lo, s, dir };
      }
    }
    for (const r of [out.max, out.min]) if (r.s !== undefined) {
      const side = r === out.max ? 1 : -1;
      r.arr = { pts: ax.map((b) => [r.s + r.dir * b.d, b.P]).filter(([x]) => x >= x0 && x <= xn).map(([x, P]) => [nudge(li, x, side * Math.sign(P)), P]), ivs: [] };
    }
    return out;
  }
  /* au droit d'un saut, décale l'abscisse du côté qui donne la valeur cherchée (pour le calcul des concomitants) */
  function nudge(li, x, sgn) {
    const l = li.at(x - 1e-7, 0), r = li.at(x + 1e-7, 0);
    if (Math.abs(l - r) < 1e-6) return x;
    return (sgn > 0 ? (r >= l) : (r <= l)) ? x + 1e-7 : x - 1e-7;
  }
  /* intervalles du signe s (1 ou −1) privés de la zone [za, zb] */
  function ivsHors(li, s, za, zb, q) {
    const out = [];
    for (const o of (s > 0 ? li.ivs.p : li.ivs.n)) {
      if (zb <= o.a || za >= o.b) out.push([o.a, o.b, q]);
      else { if (za > o.a) out.push([o.a, za, q]); if (zb < o.b) out.push([zb, o.b, q]); }
    }
    return out;
  }
  /* convoi d'essieux + charge répartie q fractionnable hors de la zone [tête − e, queue + e] (UIC 71, convoi utilisateur) */
  function envEssieuxQ(li, ax, q, e, opt = {}) {
    if (!(q > 0)) return envEssieux(li, ax, opt);
    const out = empty(), X = li.X, dmax = ax.length ? Math.max(...ax.map((a) => a.d)) : 0;
    const dirs = opt.sym ? [1] : [1, -1];
    const pts = X.concat(li.zeros);
    for (const dir of dirs) {
      const zone = (s) => dir > 0 ? [s - e, s + dmax + e] : [s - dmax - e, s + e];
      const f = (s) => {
        let hi = 0, lo = 0;
        for (const b of ax) { const h = li.atHL(s + dir * b.d); hi += b.P * h[0]; lo += b.P * h[1]; }
        const [za, zb] = zone(s);
        return [hi + q * (li.Ptot - li.pos(za, zb)), lo + q * (li.Ntot - li.neg(za, zb))];
      };
      let cand = [li.x0 - dmax - 2 * e - 1, li.xn + dmax + 2 * e + 1];
      for (const x of X) for (const b of ax) cand.push(x - dir * b.d);
      const [o1, o2] = dir > 0 ? [-e, dmax + e] : [-dmax - e, e];
      for (const x of pts) { cand.push(x - o1, x - o2); }
      cand = uniq(cand.filter((s) => { const [za, zb] = zone(s); return zb >= li.x0 - 1 - 2 * e && za <= li.xn + 1 + 2 * e; }));
      const consider = (s, v) => {
        if (v[0] > out.max.v) out.max = { v: v[0], s, dir };
        if (v[1] < out.min.v) out.min = { v: v[1], s, dir };
      };
      let prev = null;
      for (const s of cand) {
        const v = f(s); consider(s, v);
        if (prev) { // fonction quadratique par morceaux : sommet éventuel entre deux points de rupture
          const [sa, va] = prev, sm = (sa + s) / 2, vm = f(sm); consider(sm, vm);
          for (let c = 0; c < 2; c++) {
            const den = va[c] - 2 * vm[c] + v[c];
            if (Math.abs(den) > 1e-12) { const t = 0.5 * (va[c] - v[c]) / den; if (t > -0.5 && t < 0.5) { const sv = sm + t * (s - sa); consider(sv, f(sv)); } }
          }
        }
        prev = [s, v];
      }
    }
    for (const r of [out.max, out.min]) if (r.s !== undefined) {
      const sg = r === out.max ? 1 : -1, [za, zb] = r.dir > 0 ? [r.s - e, r.s + dmax + e] : [r.s - dmax - e, r.s + e];
      r.arr = { pts: ax.map((b) => [r.s + r.dir * b.d, b.P]).filter(([x]) => x >= li.x0 - 1e-9 && x <= li.xn + 1e-9).map(([x, P]) => [nudge(li, x, sg), P]), ivs: ivsHors(li, sg, za, zb, q) };
    } else if (r === out.max && li.Ptot > 0) { r.v = q * li.Ptot; r.arr = { pts: [], ivs: ivsHors(li, 1, 1e9, 1e9, q) }; }
    return out;
  }
  /* blocs de charge répartie rigides entre eux : [{o (décalage), l, q}] (SW/0, SW/2, chenilles Mc) */
  function envBlocs(li, blocs, opt = {}) {
    const out = empty(), len = Math.max(...blocs.map((b) => b.o + b.l));
    const f = (s) => blocs.reduce((t, b) => t + b.q * li.integ(s + b.o, s + b.o + b.l), 0);
    let cand = [li.x0 - len - 1];
    for (const x of li.X) for (const b of blocs) cand.push(x - b.o, x - b.o - b.l);
    cand = uniq(cand.filter((s) => s + len >= li.x0 - 1 && s <= li.xn + 1));
    const all = [];
    const consider = (s, v) => { all.push([s, v]); if (v > out.max.v) out.max = { v, s }; if (v < out.min.v) out.min = { v, s }; };
    let prev = null;
    for (const s of cand) {
      const v = f(s); consider(s, v);
      if (prev) {
        const [sa, va] = prev, sm = (sa + s) / 2, vm = f(sm); consider(sm, vm);
        const den = va - 2 * vm + v;
        if (Math.abs(den) > 1e-12) { const t = 0.5 * (va - v) / den; if (t > -0.5 && t < 0.5) { const sv = sm + t * (s - sa); consider(sv, f(sv)); } }
        if (opt.grid) for (let x = sa + opt.grid; x < s - 1e-9; x += opt.grid) consider(x, f(x));
      }
      prev = [s, v];
    }
    const arrOf = (ss) => ({ pts: [], ivs: ss.flatMap((s) => blocs.map((b) => [s + b.o, s + b.o + b.l, b.q])) });
    if (opt.D > 0) {
      // file de véhicules identiques espacés d'au moins D (programmation dynamique sur les positions candidates)
      all.sort((a, b) => a[0] - b[0]);
      for (const sg of [1, -1]) {
        const n = all.length, best = new Float64Array(n), take = new Int32Array(n).fill(-2);
        let j = -1;
        for (let i = 0; i < n; i++) {
          while (j + 1 < i && all[j + 1][0] <= all[i][0] - opt.D + 1e-9) j++;
          const gain = sg * all[i][1];
          const withI = (gain > 0 ? gain : -Infinity) + (j >= 0 ? best[j] : 0);
          const without = i > 0 ? best[i - 1] : 0;
          if (withI > without) { best[i] = withI; take[i] = j; } else { best[i] = without; take[i] = -2; }
        }
        const ss = []; let i = n - 1;
        while (i >= 0) { if (take[i] !== -2) { ss.push(all[i][0]); i = take[i]; } else i--; }
        const v = sg * (n ? best[n - 1] : 0);
        if (sg > 0) out.max = { v, arr: arrOf(ss) }; else out.min = { v, arr: arrOf(ss) };
      }
      return out;
    }
    for (const r of [out.max, out.min]) if (r.s !== undefined) r.arr = arrOf([r.s]);
    return out;
  }
  /* charge répartie illimitée fractionnable */
  function envRepartie(li, q) {
    return { max: { v: q * li.Ptot, arr: { pts: [], ivs: li.ivs.p.map((o) => [o.a, o.b, q]) } }, min: { v: q * li.Ntot, arr: { pts: [], ivs: li.ivs.n.map((o) => [o.a, o.b, q]) } } };
  }
  const somme = (a, b) => ({ max: { v: a.max.v + b.max.v, arr: { pts: a.max.arr.pts.concat(b.max.arr.pts), ivs: a.max.arr.ivs.concat(b.max.arr.ivs) } },
    min: { v: a.min.v + b.min.v, arr: { pts: a.min.arr.pts.concat(b.min.arr.pts), ivs: a.min.arr.ivs.concat(b.min.arr.ivs) } } });
  /* deux camions Bc par file (même sens), distance libre entre essieux voisins ≥ 4,50 m — Fasc. 61 II art. 5.2 */
  function envBc(li, nCam = 2) {
    const cam = CH.CONVOIS.BcCamion, Lc = 6, gmin = 4.5;
    let best = envEssieux(li, cam);
    if (nCam < 2) return best;
    const two = envEssieux(li, cam.concat(cam.map((a) => ({ d: a.d + Lc + gmin, P: a.P }))));
    const pick = (a, b) => ({ max: a.max.v >= b.max.v ? a.max : b.max, min: a.min.v <= b.min.v ? a.min : b.min });
    best = pick(best, two);
    // camions écartés de plus que le minimum : chacun à une position candidate (fonction linéaire par morceaux)
    for (const dir of [1, -1]) {
      const cs = [];
      for (const x of li.X) for (const a of cam) cs.push(x - dir * a.d);
      const S = uniq(cs).map((s) => {
        let hi = 0, lo = 0;
        for (const a of cam) { const x = s + dir * a.d; hi += a.P * li.at(x, 1); lo += a.P * li.at(x, -1); }
        return [s, hi, lo];
      });
      const n = S.length, sufH = new Int32Array(n + 1).fill(-1), sufL = new Int32Array(n + 1).fill(-1);
      for (let i = n - 1; i >= 0; i--) {
        const h = sufH[i + 1], l = sufL[i + 1];
        sufH[i] = h < 0 || S[i][1] > S[h][1] ? i : h;
        sufL[i] = l < 0 || S[i][2] < S[l][2] ? i : l;
      }
      let j = 0;
      for (let i = 0; i < n; i++) {
        while (j < n && S[j][0] < S[i][0] + Lc + gmin - 1e-9) j++;
        if (j >= n) break;
        // le second camion est derrière le premier (dans le sens de marche) : abscisses s croissantes si dir = 1
        const h = S[i][1] + S[sufH[j]][1], l = S[i][2] + S[sufL[j]][2];
        const mk = (s1, s2, sg) => ({ pts: [s1, s2].flatMap((s) => cam.map((a) => [nudge(li, s + dir * a.d, sg), a.P])), ivs: [] });
        if (h > best.max.v) best = { max: { v: h, arr: mk(S[i][0], S[sufH[j]][0], 1) }, min: best.min };
        if (l < best.min.v) best = { max: best.max, min: { v: l, arr: mk(S[i][0], S[sufL[j]][0], -1) } };
      }
    }
    return best;
  }
  /* A(l) — Fasc. 61 II art. 4.2 : A(l) = 2,30 + 360/(l+12) kN/m², a1·A(l) ≥ 4 − 0,002·l ; lobes de même signe
   * combinés pour l'effet le plus défavorable (l = longueur chargée) */
  function envAL(li, largeur, a1, a2) {
    const out = empty();
    for (const sg of [1, -1]) {
      let L = li.lobes.filter((o) => o.sg === sg && Math.abs(o.A) > 1e-12);
      L = L.sort((a, b) => Math.abs(b.A) - Math.abs(a.A)).slice(0, 12);
      for (let m = 1; m < (1 << L.length); m++) {
        let l = 0, A = 0;
        for (let k = 0; k < L.length; k++) if (m & (1 << k)) { l += L[k].b - L[k].a; A += L[k].A; }
        const q = a2 * Math.max(a1 * CH.A_L(l), 4 - 0.002 * l) * largeur, e = q * A;
        const arr = () => ({ pts: [], ivs: L.filter((_, k) => m & (1 << k)).map((o) => [o.a, o.b, q]) });
        if (sg > 0 && e > out.max.v) out.max = { v: e, arr: arr() };
        if (sg < 0 && e < out.min.v) out.min = { v: e, arr: arr() };
      }
    }
    return out;
  }

  /* ══════════════════ 5. Coefficients ══════════════════ */

  /* EN 1991-2 tableau 6.2 cas 5.1 : poutres continues, LΦ = k·Lm (≥ max Li) */
  function LPhi(portees) {
    const L = portees.filter((x) => x > 0), n = L.length;
    if (n <= 1) return L[0] || 0;
    const k = n === 2 ? 1.2 : n === 3 ? 1.3 : n === 4 ? 1.4 : 1.5;
    const Lm = L.reduce((a, b) => a + b, 0) / n;
    return Math.max(k * Lm, Math.max(...L));
  }
  /* EN 1991-2 annexe C : trains réels, 1+φ = 1 + φ' + r·φ'' (r = 0,5 voie soigneusement entretenue, 1 entretien normal)
   * K = v/(2·LΦ·n0) ; φ' = K/(1−K+K⁴) si K < 0,76, 1,325 sinon ; φ'' = α/100·[56 e^{−(LΦ/10)²} + 50 (LΦ·n0/80 − 1) e^{−(LΦ/20)²}],
   * α = v/22 si v ≤ 22 m/s, 1 sinon (v en m/s). n0 = 0 : K → ∞ (φ' = 1,325). */
  function phiReel(vkmh, L, n0, soigne) {
    const v = vkmh / 3.6;
    const K = n0 > 0 ? v / (2 * L * n0) : (v > 0 ? Infinity : 0);
    const p1 = K < 0.76 ? K / (1 - K + Math.pow(K, 4)) : 1.325;
    const al = v <= 22 ? v / 22 : 1;
    const p2 = al / 100 * (56 * Math.exp(-Math.pow(L / 10, 2)) + 50 * (L * n0 / 80 - 1) * Math.exp(-Math.pow(L / 20, 2)));
    return { K, p1, p2, phi: p1 + (soigne ? 0.5 : 1) * p2 };
  }
  /* fréquence propre par défaut (EN 1991-2 fig. 6.10) : limite supérieure 94,76·L^−0,748 jusqu'à 20 m,
   * limite inférieure 23,58·L^−0,592 au-delà (règle retrouvée dans les cas de référence) */
  const n0Defaut = (L) => L <= 20 ? 94.76 * Math.pow(L, -0.748) : 23.58 * Math.pow(L, -0.592);
  const n0Limites = (L) => ({ sup: 94.76 * Math.pow(L, -0.748), inf: L <= 20 ? 80 / L : 23.58 * Math.pow(L, -0.592) });
  /* poutre isostatique : n0 = π/(2L²)·√(EI/μ) (EI en N·m², μ en kg/m) */
  const n0Isostatique = (L, EIkNm2, mu_tm) => Math.PI / (2 * L * L) * Math.sqrt(EIkNm2 * 1000 / (mu_tm * 1000));

  /* poids maximal d'un convoi d'essieux plaçable sur une longueur L (pour S dans δ) */
  function maxSurL(ax, L) {
    let best = 0;
    for (const a of ax) { let s = 0; for (const b of ax) if (b.d >= a.d - 1e-9 && b.d <= a.d + L + 1e-9) s += b.P; best = Math.max(best, s); }
    return best;
  }
  /* δ (Fasc. 61 II art. 5.5) par travée : G = g·L, S = poids maximal du système B sur L */
  function deltaTravees(S, cfg, sys) {
    const g = +cfg.g || 0;
    return S.travees.map((t) => {
      const L = +t.L;
      let Sv;
      if (sys === 'Bc') { const cam = CH.CONVOIS.BcCamion, ax = cam.concat(cam.map((a) => ({ d: a.d + 10.5, P: a.P }))); Sv = cfg.bc * cfg.nf * maxSurL(ax, L); }
      else if (sys === 'Bt') Sv = cfg.bt * cfg.nt * maxSurL(CH.CONVOIS.Bt, L);
      else if (sys === 'Br') Sv = 100;
      else if (sys === 'Mc80' || sys === 'Mc120') { const c = CH.CHENILLES[sys], D = sys === 'Mc80' ? 30.5 : 36.6; Sv = c.P * Math.max(1, 1 + Math.floor(Math.max(0, L - c.l) / D)) * (cfg.nmc || 1); }
      if (!(Sv > 0)) return 1;
      return CH.deltaF61(L, g * L, Sv);
    });
  }

  /* ══════════════════ 6. Charges mobiles : orchestration ══════════════════ */

  const MODELES = {
    UIC71: 'UIC 71 (LM71)', SW0: 'SW/0', SW2: 'SW/2', LM1: 'LM1 (TS + UDL)', AL: 'A(l)', BC: 'Bc', BT: 'Bt', BR: 'Br',
    MC80: 'Mc 80', MC120: 'Mc 120', CU: 'Convoi utilisateur',
  };
  /* catégories de ligne EN 15528 : charge à l'essieu P (t) et charge linéique p (t/m) ;
   * wagon de référence à 4 essieux, a = 1,50 m (tampon–essieu), b = 1,80 m (empattement de bogie), longueur 4P/p
   * (géométrie retrouvée sur l'exemple de la catégorie A, à confirmer pour les autres catégories). */
  const CATEGORIES = { A: [16, 5.0], B1: [18, 5.0], B2: [18, 6.4], C2: [20, 6.4], C3: [20, 7.2], C4: [20, 8.0], D2: [22.5, 6.4], D3: [22.5, 7.2], D4: [22.5, 8.0], E4: [25, 8.0], E5: [25, 8.8] };
  function wagonRef(cat) {
    const c = CATEGORIES[cat]; if (!c) throw new Error('Catégorie de ligne inconnue : ' + cat);
    const [P, p] = c, Lw = 4 * P / p, cc = Lw - 2 * 1.5 - 2 * 1.8;
    return { nom: 'Wagon de référence ' + cat, ax: [{ Pv: P, Pp: P, d: 1.5 }, { Pv: P, Pp: P, d: 1.8 }, { Pv: P, Pp: P, d: cc }, { Pv: P, Pp: P, d: 1.8 }], tampon: 1.5 };
  }
  const longueurVeh = (v) => v.ax.reduce((t, a) => t + a.d, 0) + (+v.tampon || 0);
  const poidsVeh = (v, plein) => v.ax.reduce((t, a) => t + (plein ? a.Pp : a.Pv), 0);
  /* train : suite de véhicules [{veh, n}], répétée si illimité, chargée à vide ou à plein → essieux (kN) depuis la tête */
  function train(seq, illimite, plein, Lmin) {
    const ax = []; let pos = 0;
    const once = () => { for (const { veh, n } of seq) for (let r = 0; r < (n || 1); r++) { let x = pos; for (const a of veh.ax) { x += +a.d; ax.push({ d: x, P: (plein ? +a.Pp : +a.Pv) * G }); } pos += longueurVeh(veh); } };
    once();
    const per = pos;
    if (illimite && per > 0) while (pos < Lmin + 3 * per) once();
    ax.period = illimite ? per : 0;
    return ax;
  }
  const symetrique = (ax) => { const d0 = Math.min(...ax.map((a) => a.d)), L = Math.max(...ax.map((a) => a.d)), s = ax.map((a) => [+(L - a.d).toFixed(6), a.P]).sort((a, b) => a[0] - b[0]); const o = ax.map((a) => [+(a.d - d0).toFixed(6), a.P]).sort((a, b) => a[0] - b[0]); return o.every((v, i) => Math.abs(v[0] - s[i][0]) < 1e-6 && Math.abs(v[1] - s[i][1]) < 1e-6); };

  /* enveloppe d'un modèle sur une ligne d'influence (valeurs caractéristiques sans coefficient) */
  function envModele(li, mod, cfg) {
    switch (mod) {
      case 'UIC71': return envEssieuxQ(li, CH.CONVOIS.UIC71, 80, 0.8, { sym: true });   // EN 1991-2 fig. 6.1
      case 'SW0': case 'SW2': { const s = CH.SW[mod === 'SW0' ? 'SW/0' : 'SW/2']; return envBlocs(li, [{ o: 0, l: s.a, q: s.q }, { o: s.a + s.c, l: s.a, q: s.q }]); }
      case 'LM1': {
        const al = CH.alphaLM1(cfg.classeLM1 || 1), n = Math.max(1, Math.min(3, cfg.nvLM1 || 1));
        let Q = 0, q = 0;
        for (let i = 0; i < n; i++) { Q += (al.Q[i] || 0) * CH.LM1.Q[i]; q += (i === 0 ? al.q1 * 9 : al.qi * 2.5) * 3; }
        q += (cfg.wrLM1 > 0 ? al.qr * 2.5 * cfg.wrLM1 : 0);
        return somme(envEssieux(li, CH.CONVOIS.TS(Q), { sym: true }), envRepartie(li, q));
      }
      case 'AL': return envAL(li, cfg.largAL, cfg.a1, cfg.a2);
      case 'BC': return envBc(li, cfg.nCamBc === 1 ? 1 : 2);
      case 'BT': return envEssieux(li, CH.CONVOIS.Bt, { sym: true });
      case 'BR': return envEssieux(li, CH.CONVOIS.Br, { sym: true });
      case 'MC80': case 'MC120': { const c = CH.CHENILLES[mod === 'MC80' ? 'Mc80' : 'Mc120']; return envBlocs(li, [{ o: 0, l: c.l, q: c.P / c.l }], { D: cfg.mcFile ? (mod === 'MC80' ? 30.5 : 36.6) : 0, grid: 0.25 }); }
      case 'CU': {
        const ax = (cfg.cu && cfg.cu.ax || []).filter((a) => a.P > 0 && a.d >= 0);
        const q = +(cfg.cu && cfg.cu.q) || 0, e = +(cfg.cu && cfg.cu.e) || 0;
        if (!ax.length && !(q > 0)) return empty();
        const sym = ax.length ? symetrique(ax) : true;
        return q > 0 ? envEssieuxQ(li, ax, q, e, { sym }) : envEssieux(li, ax, { sym });
      }
      default: if (mod && mod.ax) return envEssieux(li, mod.ax, { sym: mod.sym }); return empty();
    }
  }

  /* coefficients appliqués à chaque modèle (par travée : δ varie d'une travée à l'autre) */
  function coefficients(S, cfg) {
    const nT = S.nTrav, one = new Array(nT).fill(1);
    const Lphi = cfg.LPhi > 0 ? cfg.LPhi : LPhi(S.travees.map((t) => +t.L));
    const phi = cfg.phiSaisi > 0 ? cfg.phiSaisi : (cfg.phiType === 'none' ? 1 : (cfg.phiType === '2' ? CH.phi2(Lphi) : CH.phi3(Lphi)));
    const alpha = +cfg.alpha || 1, fr = +cfg.nVoiesFer || 1;
    const classe = +cfg.classe || 1, Lch = +cfg.Lch || 7, nvT = Lch >= 5 && Lch < 6 ? 2 : Math.max(1, Math.floor(Lch / 3));
    const nv = Math.max(1, Math.min(nvT, +cfg.nv || nvT)), vlarg = Lch / nvT;
    const a1 = CH.a1F61(classe, nv), a2 = CH.v0F61(classe) / vlarg;
    const nf = nv, bc = CH.bcF61(classe, nf), nt = Math.max(1, Math.min(2, +cfg.nt || Math.min(2, nv))), bt = CH.btF61(classe);
    const fRoute = +cfg.fRoute || 1;
    const dB = { BC: deltaTravees(S, Object.assign({}, cfg, { bc, nf }), 'Bc'), BT: deltaTravees(S, Object.assign({}, cfg, { bt, nt }), 'Bt'), BR: deltaTravees(S, cfg, 'Br'), MC80: deltaTravees(S, cfg, 'Mc80'), MC120: deltaTravees(S, cfg, 'Mc120') };
    const k = {
      UIC71: one.map(() => alpha * phi * fr), SW0: one.map(() => alpha * phi * fr), SW2: one.map(() => phi * fr),
      LM1: one.map(() => fRoute), AL: one.map(() => fRoute),
      BC: dB.BC.map((d) => d * bc * nf * fRoute), BT: dB.BT.map((d) => d * bt * nt * fRoute), BR: dB.BR.map((d) => d * fRoute),
      MC80: dB.MC80.map((d) => d * (cfg.nmc || 1) * fRoute), MC120: dB.MC120.map((d) => d * (cfg.nmc || 1) * fRoute),
      CU: one.map(() => +(cfg.cu && cfg.cu.f) || 1),
    };
    if (bt === 0) k.BT = one.map(() => 0);
    return { k, Lphi, phi, alpha, a1, a2, nv, nvT, vlarg, largAL: nv * vlarg, bc, nf, bt, nt, deltas: dB, classe };
  }

  /* enveloppes de plusieurs modèles sur toutes les sections et tous les appuis */
  function mobile(S, cfg, mods) {
    const LI = lignes(S), co = coefficients(S, cfg);
    const c2 = Object.assign({}, cfg, { a1: co.a1, a2: co.a2, largAL: co.largAL });
    const res = {};
    for (const mod of mods) {
      const kT = co.k[mod] || new Array(S.nTrav).fill(1);
      const memo = new Map(), env = (li) => { let r = memo.get(li); if (!r) memo.set(li, (r = envModele(li, mod, c2))); return r; };
      const sec = S.sections.map((s, i) => {
        const L = LI.sec[i], f = kT[s.travee];
        const eM = env(L.M), eV = env(L.V), eW = L.w ? env(L.w) : null;
        return {
          x: s.x, side: s.side, kind: s.kind, travee: s.travee,
          M: { max: f * eM.max.v, min: f * eM.min.v, cMax: f * effet(L.V, eM.max.arr), cMin: f * effet(L.V, eM.min.arr) },
          V: { max: f * eV.max.v, min: f * eV.min.v, cMax: f * effet(L.M, eV.max.arr), cMin: f * effet(L.M, eV.min.arr) },
          w: eW ? { max: f * eW.max.v, min: f * eW.min.v } : null,
        };
      });
      const app = S.app.map((a, j) => {
        const L = LI.app[j], f = Math.max(kT[Math.min(j, S.nTrav - 1)], kT[Math.max(0, j - 1)]);
        const e = envModele(L.R, mod, c2);
        return { k: a.k, x: a.x, R: { max: f * e.max.v, min: f * e.min.v, cMax: f * effet(L.th, e.max.arr), cMin: f * effet(L.th, e.min.arr) } };
      });
      res[mod] = { sec, app, coef: kT };
    }
    return { res, co };
  }

  /* ══════════════════ 7. Cas, combinaisons, enveloppes ══════════════════ */

  /* résultat d'un cas fixe au format commun (max = min) */
  function casFixe(r) {
    return {
      sec: r.sec.map((s) => ({ x: s.x, side: s.side, kind: s.kind, travee: s.travee, M: { max: s.M, min: s.M, cMax: s.V, cMin: s.V }, V: { max: s.V, min: s.V, cMax: s.M, cMin: s.M }, w: { max: s.w, min: s.w } })),
      app: r.appuis.map((a) => ({ k: a.k, x: a.x, R: { max: a.R, min: a.R, cMax: a.th, cMin: a.th } })),
    };
  }
  const QTY = [['M', true], ['V', true], ['w', false]];
  /* combinaison linéaire Σ cᵢ·casᵢ (les cas à enveloppe prennent leur extrême défavorable selon le signe de cᵢ) */
  function combiner(termes) {
    const base = termes[0].cas, out = { sec: base.sec.map((s) => ({ x: s.x, side: s.side, kind: s.kind, travee: s.travee })), app: base.app.map((a) => ({ k: a.k, x: a.x })) };
    out.sec.forEach((s, i) => {
      for (const [q, conc] of QTY) {
        const r = { max: 0, min: 0 }; if (conc) { r.cMax = 0; r.cMin = 0; }
        let ok = true;
        for (const { cas, c } of termes) {
          const v = cas.sec[i][q]; if (!v) { ok = false; break; }
          if (c >= 0) { r.max += c * v.max; r.min += c * v.min; if (conc) { r.cMax += c * v.cMax; r.cMin += c * v.cMin; } }
          else { r.max += c * v.min; r.min += c * v.max; if (conc) { r.cMax += c * v.cMin; r.cMin += c * v.cMax; } }
        }
        s[q] = ok ? r : null;
      }
    });
    out.app.forEach((a, j) => {
      const r = { max: 0, min: 0, cMax: 0, cMin: 0 };
      for (const { cas, c } of termes) { const v = cas.app[j].R; if (c >= 0) { r.max += c * v.max; r.min += c * v.min; r.cMax += c * v.cMax; r.cMin += c * v.cMin; } else { r.max += c * v.min; r.min += c * v.max; r.cMax += c * v.cMin; r.cMin += c * v.cMax; } }
      a.R = r;
    });
    return out;
  }
  /* enveloppe : max et min de plusieurs cas (avec les concomitants du cas retenu) */
  function envelopper(cases) {
    const base = cases[0], out = { sec: base.sec.map((s) => ({ x: s.x, side: s.side, kind: s.kind, travee: s.travee })), app: base.app.map((a) => ({ k: a.k, x: a.x })) };
    out.sec.forEach((s, i) => {
      for (const [q, conc] of QTY) {
        let r = null;
        for (const cas of cases) {
          const v = cas.sec[i][q]; if (!v) continue;
          if (!r) { r = Object.assign({}, v); continue; }
          if (v.max > r.max) { r.max = v.max; if (conc) r.cMax = v.cMax; }
          if (v.min < r.min) { r.min = v.min; if (conc) r.cMin = v.cMin; }
        }
        s[q] = r;
      }
    });
    out.app.forEach((a, j) => {
      let r = null;
      for (const cas of cases) { const v = cas.app[j].R; if (!r) { r = Object.assign({}, v); continue; } if (v.max > r.max) { r.max = v.max; r.cMax = v.cMax; } if (v.min < r.min) { r.min = v.min; r.cMin = v.cMin; } }
      a.R = r;
    });
    return out;
  }
  /* analyse d'une expression : « 1,35 G + 1,5*Q1 − 0,5 T » (combinaison) ou « G, Q1, C2 » (enveloppe) */
  function parseTermes(txt) {
    const s = String(txt || '').replace(/−/g, '-').replace(/(\d),(\d)/g, '$1.$2').replace(/\s+/g, ' ').trim();
    const out = []; const re = /([+-])?\s*(\d*\.?\d+(?:[eE][+-]?\d+)?)?\s*\*?\s*([A-Za-z_][A-Za-z0-9_/.']*)/g;
    let m;
    while ((m = re.exec(s))) { const sg = m[1] === '-' ? -1 : 1, c = m[2] !== undefined ? parseFloat(m[2]) : 1; out.push({ code: m[3], c: sg * c }); }
    return out;
  }
  const parseListe = (txt) => String(txt || '').split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);

  /* ══════════════════ 8. Études de circulation ══════════════════ */

  /* extrêmes globaux de M et V (en valeur absolue) sur toutes les sections pour un convoi */
  /* M max (positif), M min (négatif) et |V| max sur toutes les sections pour un convoi d'essieux */
  function extremesConvoi(S, LI, ax) {
    const opt = { sym: symetrique(ax), period: ax.period || 0 };
    let Mp = 0, Mn = 0, Vx = 0, iM = 0, iN = 0, iV = 0;
    LI.sec.forEach((L, i) => {
      const m = envEssieux(L.M, ax, opt), v = envEssieux(L.V, ax, opt), av = Math.max(v.max.v, -v.min.v);
      if (m.max.v > Mp) { Mp = m.max.v; iM = i; } if (m.min.v < Mn) { Mn = m.min.v; iN = i; } if (av > Vx) { Vx = av; iV = i; }
    });
    return { M: Mp, Mn: -Mn, V: Vx, xM: S.sections[iM].x, xMn: S.sections[iN].x, xV: S.sections[iV].x };
  }
  /* vitesse admissible : plus grande vitesse ≤ vEtud telle que le rapport dynamique à plein reste ≤ 1.
   * Dichotomie sur [0, vEtud] arrêtée à la précision vEtud/256 et arrondie par défaut (même règle que les
   * cas de référence, dont les vitesses sont des multiples de 160/256 = 0,625 km/h). « Aucune » si même
   * une vitesse nulle ne suffit pas. */
  function vitesseAdmissible(rStat, Lphi, n0, vEtud, unPlusPhiRef, soigne) {
    const r = (v) => rStat * (1 + phiReel(v, Lphi, n0, soigne).phi) / unPlusPhiRef;
    if (r(vEtud) <= 1 + 1e-12) return { v: vEtud, limite: false };
    if (r(0) > 1 - 1e-9) return { v: 0, aucune: true, limite: true };
    let lo = 0, hi = vEtud;
    for (let it = 0; it < 8; it++) { const m = (lo + hi) / 2; if (r(m) <= 1) lo = m; else hi = m; }
    return { v: lo, limite: true };
  }
  /* étude de circulation sur une liste d'ouvrages.
   * ouvrages : [{nom, model (cf. build), LPhi?, n0?, phiE?, phiR? (φ saisis), QM, QV}]
   * cfg : {seq:[{veh,n}], illimite, vEtud, cat, vRef, soigne} */
  function circulation(ouvrages, cfg) {
    const ref = wagonRef(cfg.cat || 'A');
    const rows = ouvrages.map((o) => {
      const S = build(o.model), LI = lignes(S, { w: false });
      const Lmin = S.xn - S.x0;
      const ev = extremesConvoi(S, LI, train(cfg.seq, cfg.illimite !== false, false, Lmin));
      const ep = extremesConvoi(S, LI, train(cfg.seq, cfg.illimite !== false, true, Lmin));
      const er = extremesConvoi(S, LI, train([{ veh: ref, n: 1 }], true, true, Lmin));
      const QM = +o.QM || 1, QV = +o.QV || 1;
      const rat = (a, b, q) => b > 1e-9 ? a / (q * b) : 0;
      const rv = { M: rat(ev.M, er.M, QM), Mn: rat(ev.Mn, er.Mn, QM), V: rat(ev.V, er.V, QV) }, rp = { M: rat(ep.M, er.M, QM), Mn: rat(ep.Mn, er.Mn, QM), V: rat(ep.V, er.V, QV) };
      const Lp = o.LPhi > 0 ? o.LPhi : LPhi(S.travees.map((t) => +t.L));
      const n0 = o.n0 > 0 ? o.n0 : (o.n0 === 0 ? 0 : n0Defaut(Lp));
      const phE = o.phiE > 0 ? o.phiE : phiReel(cfg.vEtud, Lp, n0, cfg.soigne).phi;
      const phR = o.phiR > 0 ? o.phiR : phiReel(cfg.vRef, Lp, n0, cfg.soigne).phi;
      const fd = (1 + phE) / (1 + phR);
      const dv = { M: rv.M * fd, Mn: rv.Mn * fd, V: rv.V * fd }, dp = { M: rp.M * fd, Mn: rp.Mn * fd, V: rp.V * fd };
      const va = o.phiE > 0 ? null : vitesseAdmissible(Math.max(rp.M, rp.Mn, rp.V), Lp, n0, cfg.vEtud, 1 + phR, cfg.soigne);
      return { nom: o.nom, Lphi: Lp, n0, QM, QV, vide: ev, plein: ep, ref: er, rv, rp, phE, phR, dyn: { vide: { M: ev.M * (1 + phE), Mn: ev.Mn * (1 + phE), V: ev.V * (1 + phE) }, plein: { M: ep.M * (1 + phE), Mn: ep.Mn * (1 + phE), V: ep.V * (1 + phE) } }, dv, dp, va };
    });
    // autorisations : réduction du poids total du véhicule (proportionnelle) — charge utile = poids admissible − tare
    const veh0 = cfg.seq[0] && cfg.seq[0].veh;
    const Pp = veh0 ? cfg.seq.reduce((t, s) => t + poidsVeh(s.veh, true) * (s.n || 1), 0) / cfg.seq.reduce((t, s) => t + (s.n || 1), 0) : 0;
    const Pv = veh0 ? cfg.seq.reduce((t, s) => t + poidsVeh(s.veh, false) * (s.n || 1), 0) / cfg.seq.reduce((t, s) => t + (s.n || 1), 0) : 0;
    const aut = (key) => {
      let r = 0, i = -1;
      rows.forEach((o, k) => { const v = Math.max(o[key].M, o[key].Mn, o[key].V); if (v > r) { r = v; i = k; } });
      return { r, i, depasse: r > 1 + 1e-9, Padm: r > 1 ? Pp / r : Pp, CU: (r > 1 ? Pp / r : Pp) - Pv };
    };
    return { rows, ref, Pp, Pv, statique: aut('rp'), dynamique: aut('dp') };
  }
  /* variation de portée : poutre sur deux appuis simples de portée L ∈ liste */
  function portees(spec) {
    const out = [];
    for (const part of String(spec).split(/[;\n]+/)) {
      const p = part.replace(/,/g, '.').trim(); if (!p) continue;
      const m = p.split(/[:\s]+/).map(Number).filter(Number.isFinite);
      if (m.length >= 3 && m[2] > 0) { for (let L = m[0]; L <= m[1] + 1e-9; L += m[2]) out.push(+L.toFixed(6)); }
      else for (const v of m) out.push(v);
    }
    return uniq(out.filter((L) => L > 0));
  }

  /* ══════════════════ 9. Lecture des fichiers de référence (.don, .cnv) ══════════════════ */

  /* fichier « clé ; commentaire » puis valeur(s) à la ligne suivante */
  function lireDico(txt) {
    const lines = String(txt).replace(/\r/g, '').split('\n'), d = {}, rep = {};
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i]; if (!L.trim() || L.trim().startsWith(';')) continue;
      const m = L.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(;.*)?$/);
      if (!m) continue;
      const k = m[1];
      if (k === 'FIN_DICO') { d._suite = lines.slice(i + 1); break; }
      const v = lines[i + 1] !== undefined ? lines[i + 1] : '';
      (rep[k] || (rep[k] = [])).push(v);
      if (d[k] === undefined) d[k] = v.trim();
      i++;
    }
    d._rep = rep;
    return d;
  }
  const nums = (s) => String(s || '').replace(/,/g, '.').trim().split(/\s+/).map(Number).filter(Number.isFinite);
  const CONVREF = ['A', 'B1', 'B2', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4', 'E4', 'E5'];
  function lireCnv(txt) {
    const d = lireDico(txt);
    const out = { nom: (d.nomconvoi || '').trim(), type: +d.typedoc === 1 ? 'vehicule' : 'convoi' };
    if (out.type === 'vehicule') {
      out.ax = (d._rep.ESSIEUX || []).map(nums).filter((r) => r.length >= 3).map(([Pv, Pp, dd]) => ({ Pv, Pp, d: dd }));
      out.tampon = +nums(d.disttampon)[0] || 0;
    } else {
      out.vehicules = [];
      const lines = String(txt).replace(/\r/g, '').split('\n');
      const i0 = lines.findIndex((l) => /^FICHIERS_CONVOI/.test(l));
      for (let i = i0 + 1; i0 >= 0 && i < lines.length; i++) {
        const l = lines[i]; if (!l.trim() || /^[;A-Za-z_]+\s*;|^;/.test(l) && !/\t/.test(l)) break;
        const c = l.split('\t'); if (c.length < 2) break;
        out.vehicules.push({ fichier: c[0].trim(), nom: (c[1] || '').trim(), n: +c[2] || 1, flag: +c[3] || 0 });
      }
      out.illimite = /illimit/i.test(out.nom) || /illimit/i.test(txt);
    }
    return out;
  }
  function lireDon(txt) {
    const d = lireDico(txt);
    if (d.application && !/POUTRE/i.test(d.application)) throw new Error('Ce fichier n’est pas un fichier de données POUTRE.');
    const L = nums(d.travelage), ns = +d.nbsec || 10;
    const Emod = Math.max(+nums(d.EBi)[0] || 0, +nums(d.EBd)[0] || 0) / 1000 || 35000;
    const I = +nums(d.inertie)[0] || +nums(d.inertiecste)[0] || 1;
    const cons = (t, l) => (+t === 1 ? +nums(l)[0] || 0 : 0);
    const enc = (t) => +t === 2;
    const model = {
      E: +Emod.toFixed(3), ns,
      travees: L.map((x) => ({ L: x, loi: 'cst', Ig: I, Im: I, Id: I })),
      consoles: { g: cons(d.typapp0, d.lcons0), d: cons(d.typapp1, d.lcons1) },
      appuis: L.concat([0]).map((_, k) => ({ type: (k === 0 && enc(d.typapp0)) || (k === L.length && enc(d.typapp1)) ? 'encastre' : 'simple', kv: 0, kr: 0 })),
    };
    if (+d.typpoutre === 1) model.Ix = (d._rep.ELEMENTS || []).map(nums).filter((r) => r.length >= 4).map(([x0, x1, , Ii]) => ({ x0, x1, I: Ii }));
    // ouvrages (liste d'ouvrages ou variation de portée)
    const ouvrages = (d._rep.POUTRETRAVELAGES || []).filter((l) => l.trim()).map((l) => {
      const t = l.trim().split(/\t+/).map((s) => s.trim());
      const n = +t[0], spans = nums(t[1]).slice(0, n);
      const r = t.slice(2);
      // champs : I, EBi, EBd, ?, ?, nbsec, Q_M, Q_V, ?, ?, φ étudié, ?, φ réf., ?, n0, masse, nom, typapp0, lcons0, typapp1, lcons1
      const f = (k) => r[k];
      return { nom: f(16) || '', spans, I: +f(0) || 1, ns: +f(5) || ns, QM: +f(6) || 1, QV: +f(7) || 1, phiE: +f(10) || 0, phiR: +f(12) || 0, n0: +f(14) || 0, masse: +f(15) || 0,
        consoles: { g: +f(17) === 1 ? +f(18) || 0 : 0, d: +f(19) === 1 ? +f(20) || 0 : 0 }, encG: +f(17) === 2, encD: +f(19) === 2 };
    });
    const charges = (d._suite || []).join('\n').split('LISTE_CHARGES')[1];
    const liste = charges ? charges.split('\n').map((l) => l.trim()).filter((l) => /^\d+\s+\S/.test(l)).map((l) => { const m = l.match(/^(\d+)\s+([^\t]*)\t?(.*)$/); return { code: +m[1], nom: m[2].trim(), fichier: (m[3] || '').trim() }; }) : [];
    return {
      projet: d.projet || '', model, typetude: +d.typetude || 0, typouv: +d.typouv || 0,
      ficconv: (d.ficconv || '').trim(), vitconv: +nums(d.vitconv)[0] || 0, convref: CONVREF[+d.convref] || 'A', vitconvref: +nums(d.vitconvref)[0] || 0,
      soigne: +d.typentvoie === 1, ouvrages, charges: liste,
    };
  }

  const api = {
    build, fixe, lignes, makeLI, envEssieux, envEssieuxQ, envBlocs, envRepartie, envBc, envAL, envModele, effet,
    LPhi, phiReel, n0Defaut, n0Limites, n0Isostatique, coefficients, deltaTravees, mobile, MODELES,
    casFixe, combiner, envelopper, parseTermes, parseListe,
    CATEGORIES, wagonRef, train, longueurVeh, poidsVeh, extremesConvoi, circulation, vitesseAdmissible, portees,
    lireDico, lireDon, lireCnv, G,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.poutre = api; }
})(typeof window !== 'undefined' ? window : globalThis);
