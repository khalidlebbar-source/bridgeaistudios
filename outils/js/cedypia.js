/* CEDYPIA — Calcul des effets dynamiques dans les ponts-rails sous charges roulantes (EN 1991-2 §6.4).
 * Moteur pur (aucun DOM), UMD : module.exports pour node, window.BA.cedypia dans le navigateur, importScripts dans un Worker.
 *
 * Méthode (EN 1991-2 §6.4.6.4 : analyse dynamique par superposition modale, charges ponctuelles mobiles) :
 *   – poutre continue de 1 à 9 travées sur appuis simples, EI et masse linéique m constants par travée ;
 *   – modes propres : 1 travée → solution analytique φn = √(2/mL)·sin(nπx/L), ωn = (nπ/L)²√(EI/m) ;
 *     plusieurs travées → éléments finis de poutre d'Euler-Bernoulli (Hermite), matrice de masse cohérente,
 *     réduction de Cholesky M = LLᵀ puis méthode de Jacobi sur L⁻¹KL⁻ᵀ ; modes normés φᵀMφ = 1 ;
 *   – modes retenus jusqu'à la plus grande des fréquences 30 Hz, 1,5·n0, n3 (EN 1990 A2.4.4.2.1(4)P / EN 1991-2 §6.4.6.5) ;
 *   – réponse de chaque mode q̈ + 2ζω q̇ + ω² q = Σ Pk φn(xk(t)) intégrée exactement pour un second membre linéaire par pas
 *     (récurrence de Nigam et Jennings), pas de temps ≤ T_min/ppp et ≤ L_min/(40 v) ;
 *   – flèche w(x,t) = Σ φn(x) qn(t), accélération a(x,t) = Σ φn(x) q̈n(t) ;
 *   – flèche statique : ligne d'influence exacte (éléments finis, théorème de Maxwell) et convoi déplacé pas à pas.
 * Unités : kN, m, s, t (masse linéique en t/m), EI en kN·m², fréquences en Hz, vitesses en km/h à l'interface.
 */
(function (root) {
  'use strict';

  /* ── EN 1991-2 annexe E, tableau E.1 : trains universels HSLM-A ──
   * N : nombre de voitures intermédiaires, D : longueur de voiture (m), d : empattement du bogie (m), P : force par essieu (kN). */
  const HSLM_A = {
    A1: { N: 18, D: 18, d: 2.0, P: 170 }, A2: { N: 17, D: 19, d: 3.5, P: 200 }, A3: { N: 16, D: 20, d: 2.0, P: 180 },
    A4: { N: 15, D: 21, d: 3.0, P: 190 }, A5: { N: 14, D: 22, d: 2.0, P: 170 }, A6: { N: 13, D: 23, d: 2.0, P: 180 },
    A7: { N: 13, D: 24, d: 2.0, P: 190 }, A8: { N: 12, D: 25, d: 2.5, P: 190 }, A9: { N: 11, D: 26, d: 2.0, P: 210 },
    A10: { N: 11, D: 27, d: 2.0, P: 210 },
  };
  /* Géométrie de la figure E.1 (motrices et voitures d'extrémité identiques en tête et en queue) :
   * motrice : essieux à 0 / 3 / 14 / 17 m (bogies de 3 m, 11 m entre essieux intérieurs) ;
   * 3,525 m entre le dernier essieu de la motrice et le premier essieu de la voiture d'extrémité (bogie de 3 m) ;
   * bogies articulés d'empattement d espacés de D, le premier à D du bogie avant de la voiture d'extrémité.
   * Hypothèse de reconstitution à confronter à la figure E.1 de la norme (voir encadré « Périmètre » de la page). */
  const GEOM = { pcAxles: [0, 3, 14, 17], gap: 3.525, ecBogie: 3.0 };
  function hslmAxles(nom) {
    const t = HSLM_A[nom];
    if (!t) throw new Error('Train HSLM inconnu : ' + nom);
    const half = [];
    GEOM.pcAxles.forEach((x) => half.push(x));
    const e0 = GEOM.pcAxles[3] + GEOM.gap;               // 1er essieu voiture d'extrémité
    const c0 = e0 + GEOM.ecBogie / 2;                    // centre du bogie avant
    const ax = half.slice();
    ax.push(e0, e0 + GEOM.ecBogie);
    for (let j = 1; j <= t.N + 1; j++) { const c = c0 + j * t.D; ax.push(c - t.d / 2, c + t.d / 2); }
    const cR = c0 + (t.N + 2) * t.D;                     // bogie arrière de la voiture d'extrémité de queue
    ax.push(cR - GEOM.ecBogie / 2, cR + GEOM.ecBogie / 2);
    const p0 = cR + GEOM.ecBogie / 2 + GEOM.gap;
    [0, 3, 14, 17].forEach((x) => ax.push(p0 + x));
    return ax.map((d) => ({ d: +d.toFixed(6), P: t.P }));
  }

  /* ── EN 1991-2 tableau 6.6 : amortissement ζ (%) — limite inférieure à retenir ── */
  function zetaTab(type, L) {
    const r = L < 20 ? 20 - L : 0;
    if (type === 'acier' || type === 'mixte') return 0.5 + 0.125 * r;
    if (type === 'bp') return 1.0 + 0.07 * r;          // béton précontraint
    return 1.5 + 0.07 * r;                             // poutrelles enrobées et béton armé
  }
  /* EN 1991-2 §6.4.6.3.1(3) éq. (6.13) : amortissement additionnel (interaction véhicule-pont), L < 30 m */
  function deltaZeta(L) {
    if (!(L > 0) || L >= 30) return 0;
    return Math.max(0, (0.0187 * L - 0.00064 * L * L) / (1 - 0.0441 * L - 0.0044 * L * L + 0.000255 * L * L * L));
  }
  /* EN 1991-2 §6.4.4 figure 6.10 : limites de la fréquence propre n0 (Hz), 4 ≤ L ≤ 100 m */
  function n0Limites(L) {
    const sup = 94.76 * Math.pow(L, -0.748);
    const inf = L <= 20 ? 80 / L : 23.58 * Math.pow(L, -0.592);
    return { inf, sup, valide: L >= 4 && L <= 100 };
  }
  /* EN 1991-2 §6.4.5.2 tableau 6.2 cas 5.1 : longueur déterminante des poutres continues LΦ = k·Lm ≥ max Li */
  function lPhi(portees) {
    const n = portees.length;
    if (n === 1) return portees[0];
    const k = n === 2 ? 1.2 : n === 3 ? 1.3 : n === 4 ? 1.4 : 1.5;
    const Lm = portees.reduce((a, b) => a + b, 0) / n;
    return Math.max(k * Lm, Math.max(...portees));
  }
  /* EN 1991-2 §6.4.5.2 éq. (6.4) et (6.5) */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const phi2 = (L) => clamp(1.44 / (Math.sqrt(L) - 0.2) + 0.82, 1.0, 1.67);
  const phi3 = (L) => clamp(2.16 / (Math.sqrt(L) - 0.2) + 0.73, 1.0, 2.0);
  /* EN 1991-2 annexe C (C.3) : φ'' irrégularités de voie, v en m/s */
  function phiSecond(LPhi, n0, L, v) {
    const a = v <= 22 ? v / 22 : 1;
    return Math.max(0, a / 100 * (56 * Math.exp(-Math.pow(LPhi / 10, 2)) + 50 * (L * n0 / 80 - 1) * Math.exp(-Math.pow(LPhi / 20, 2))));
  }
  /* EN 1990 A2.4.4.2.1(4)P : accélération maximale admissible du tablier */
  const aLim = (ballast) => (ballast ? 3.5 : 5.0);

  /* ── EN 1991-2 §6.4.4 figure 6.9 : nécessité d'une analyse dynamique (pré-diagnostic) ──
   * o : {V (km/h), continu, L (portée ou LΦ), n0, nT (Hz, facultatif)} */
  function organigramme(o) {
    const etapes = [], lim = n0Limites(o.L);
    const dans = lim.valide && o.n0 >= lim.inf && o.n0 <= lim.sup;
    etapes.push(`Vitesse maximale de la ligne V = ${o.V} km/h ${o.V <= 200 ? '≤' : '>'} 200 km/h`);
    if (o.V > 200) return { requise: true, etapes, verdict: 'Analyse dynamique requise (V > 200 km/h).', lim, dans };
    etapes.push(`n0 = ${o.n0.toFixed(2)} Hz ; limites figure 6.10 pour L = ${o.L.toFixed(2)} m : [${lim.inf.toFixed(2)} ; ${lim.sup.toFixed(2)}] Hz${lim.valide ? '' : ' (hors domaine 4–100 m)'}`);
    if (!dans) return { requise: true, etapes, verdict: 'Analyse dynamique requise : n0 hors des limites de la figure 6.10.', lim, dans };
    if (o.continu) return { requise: false, etapes, verdict: 'Analyse dynamique non requise (poutre continue, n0 dans les limites) : calcul statique avec Φ ; vérifier les conditions de la note (5) de la figure 6.9.', lim, dans };
    if (o.L >= 40) return { requise: false, etapes, verdict: 'Analyse dynamique non requise (structure simple, L ≥ 40 m, n0 dans les limites) : calcul statique avec Φ.', lim, dans };
    if (o.nT > 0) {
      etapes.push(`Torsion : nT = ${o.nT.toFixed(2)} Hz ${o.nT > 1.2 * o.n0 ? '>' : '≤'} 1,2·n0 = ${(1.2 * o.n0).toFixed(2)} Hz`);
      if (o.nT > 1.2 * o.n0) return { requise: null, etapes, verdict: 'Utiliser les tableaux F.1 et F.2 de l\'annexe F : analyse dynamique non requise si v/n0 ≤ (v/n0)lim, sinon requise (tableaux non programmés ici).', lim, dans };
    }
    return { requise: true, etapes, verdict: 'Analyse dynamique requise (structure simple, L < 40 m, nT ≤ 1,2·n0 ou non renseignée).', lim, dans };
  }

  /* ── Jacobi cyclique pour matrice symétrique (valeurs et vecteurs propres) ── */
  function jacobi(A) {
    const n = A.length, V = Array.from({ length: n }, (_, i) => { const r = new Float64Array(n); r[i] = 1; return r; });
    const a = A.map((r) => Float64Array.from(r));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0, diag = 0;
      for (let i = 0; i < n; i++) { diag += a[i][i] * a[i][i]; for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j]; }
      if (off <= 1e-26 * diag) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        const apq = a[p][q];
        if (Math.abs(apq) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * apq);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    return { val: Array.from({ length: n }, (_, i) => a[i][i]), vec: V };
  }
  function cholesky(A) {
    const n = A.length, L = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) { if (s <= 0) throw new Error('Matrice non définie positive (vérifier EI et m).'); L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
    }
    return L;
  }
  const cholSolve = (L, b) => {
    const n = L.length, y = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * y[k]; y[i] = s / L[i][i]; }
    return y;
  };

  /* ── maillage éléments finis de la poutre continue ── */
  function maillage(spans, nseg) {
    const xs = [0], h = [], EI = [], m = [], sp = [], x0 = [0];
    let x = 0;
    spans.forEach((s, t) => {
      for (let k = 1; k <= nseg; k++) { xs.push(x + s.L * k / nseg); h.push(s.L / nseg); EI.push(s.EI); m.push(s.m); sp.push(t); }
      x += s.L; x0.push(x);
    });
    return { xs, h, EI, m, sp, x0, Ltot: x, nseg, nel: h.length };
  }
  /* évaluation des fonctions d'Hermite en x : renvoie l'élément et les 4 poids (w_i, θ_i, w_j, θ_j) */
  function hermite(mesh, x, out) {
    let t = 0; const n = mesh.x0.length - 1;
    while (t < n - 1 && x > mesh.x0[t + 1]) t++;
    const L = mesh.x0[t + 1] - mesh.x0[t], hh = L / mesh.nseg;
    let k = Math.floor((x - mesh.x0[t]) / hh); if (k >= mesh.nseg) k = mesh.nseg - 1; if (k < 0) k = 0;
    const e = t * mesh.nseg + k, xi = (x - mesh.xs[e]) / hh, x2 = xi * xi, x3 = x2 * xi;
    out[0] = 1 - 3 * x2 + 2 * x3; out[1] = hh * (xi - 2 * x2 + x3); out[2] = 3 * x2 - 2 * x3; out[3] = hh * (x3 - x2);
    return e;
  }
  /* assemblage K et M, ddl (w, θ) par nœud ; w bloqué sur appuis */
  function assemble(mesh) {
    const nn = mesh.xs.length, nd = 2 * nn;
    const K = Array.from({ length: nd }, () => new Float64Array(nd)), M = Array.from({ length: nd }, () => new Float64Array(nd));
    for (let e = 0; e < mesh.nel; e++) {
      const h = mesh.h[e], a = mesh.EI[e] / (h * h * h), b = mesh.m[e] * h / 420;
      const ke = [[12, 6 * h, -12, 6 * h], [6 * h, 4 * h * h, -6 * h, 2 * h * h], [-12, -6 * h, 12, -6 * h], [6 * h, 2 * h * h, -6 * h, 4 * h * h]];
      const me = [[156, 22 * h, 54, -13 * h], [22 * h, 4 * h * h, 13 * h, -3 * h * h], [54, 13 * h, 156, -22 * h], [-13 * h, -3 * h * h, -22 * h, 4 * h * h]];
      const dof = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { K[dof[i]][dof[j]] += a * ke[i][j]; M[dof[i]][dof[j]] += b * me[i][j]; }
    }
    const bloque = new Set(); for (let t = 0; t < mesh.x0.length; t++) bloque.add(2 * t * mesh.nseg);
    const libres = []; for (let i = 0; i < nd; i++) if (!bloque.has(i)) libres.push(i);
    const red = (A) => libres.map((i) => Float64Array.from(libres.map((j) => A[i][j])));
    return { K: red(K), M: red(M), libres, nd };
  }

  /* ── modes propres ──
   * Renvoie {freq:[Hz], omega:[rad/s], W:[Float64Array nœuds], T:[…], eval(x, out) → φn(x) dans out, nModes} */
  function modes(spans, o = {}) {
    if (!spans.length || spans.length > 9) throw new Error('Nombre de travées : de 1 à 9.');
    for (const s of spans) if (!(s.L > 0 && s.EI > 0 && s.m > 0)) throw new Error('Portée, EI et masse linéique doivent être positifs.');
    const fmin = o.fmax || 30;
    const nseg = o.nseg || 4 * clamp(Math.floor(24 / spans.length), 2, 6);
    const mesh = maillage(spans, nseg);
    if (spans.length === 1 && !o.forceEF) {
      const { L, EI, m } = spans[0], c = Math.sqrt(2 / (m * L)), w1 = Math.pow(Math.PI / L, 2) * Math.sqrt(EI / m);
      const f1 = w1 / (2 * Math.PI), fmax = Math.max(fmin, 1.5 * f1, 9 * f1);
      const N = Math.max(3, Math.floor(Math.sqrt(fmax / f1) + 1e-9));
      const omega = [], freq = [];
      for (let n = 1; n <= N; n++) { omega.push(n * n * w1); freq.push(n * n * f1); }
      const k = omega.map((_, i) => (i + 1) * Math.PI / L);
      return {
        mesh, omega, freq, nModes: N, fmax, analytique: true,
        eval(x, out) { for (let i = 0; i < N; i++) out[i] = (x <= 0 || x >= L) ? 0 : c * Math.sin(k[i] * x); return out; },
      };
    }
    const { K, M, libres, nd } = assemble(mesh);
    const Lc = cholesky(M), n = K.length;
    // C = L⁻¹ K L⁻ᵀ
    const Y = K.map((r) => Float64Array.from(r));
    const fwd = (b) => { const y = new Float64Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= Lc[i][k] * y[k]; y[i] = s / Lc[i][i]; } return y; };
    const cols = []; for (let j = 0; j < n; j++) cols.push(fwd(Y.map((r) => r[j])));      // L⁻¹ K
    const C = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) { const row = fwd(cols.map((c) => c[i])); for (let j = 0; j < n; j++) C[i][j] = row[j]; } // (L⁻¹ (L⁻¹K)ᵀ)
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const s = (C[i][j] + C[j][i]) / 2; C[i][j] = C[j][i] = s; }
    const { val, vec } = jacobi(C);
    const ord = val.map((v, i) => i).sort((a, b) => val[a] - val[b]);
    const f1 = Math.sqrt(Math.max(val[ord[0]], 0)) / (2 * Math.PI);
    const f3 = ord.length > 2 ? Math.sqrt(Math.max(val[ord[2]], 0)) / (2 * Math.PI) : f1;
    const fmax = Math.max(fmin, 1.5 * f1, f3);
    const omega = [], freq = [], W = [], T = [];
    const nn = mesh.xs.length;
    for (const i of ord) {
      const w = Math.sqrt(Math.max(val[i], 0)), f = w / (2 * Math.PI);
      if (f > fmax * (1 + 1e-9) && omega.length >= 1) break;
      // φ = L⁻ᵀ y
      const y = vec.map((r) => r[i]), phi = new Float64Array(n);
      for (let r = n - 1; r >= 0; r--) { let s = y[r]; for (let k = r + 1; k < n; k++) s -= Lc[k][r] * phi[k]; phi[r] = s / Lc[r][r]; }
      const full = new Float64Array(nd); libres.forEach((g, k) => (full[g] = phi[k]));
      // signe : composante de flèche maximale positive (vers le bas)
      let big = 0; for (let k = 0; k < nn; k++) if (Math.abs(full[2 * k]) > Math.abs(big)) big = full[2 * k];
      const sg = big < 0 ? -1 : 1;
      const Wn = new Float64Array(nn), Tn = new Float64Array(nn);
      for (let k = 0; k < nn; k++) { Wn[k] = sg * full[2 * k]; Tn[k] = sg * full[2 * k + 1]; }
      omega.push(w); freq.push(f); W.push(Wn); T.push(Tn);
    }
    const N = omega.length, hw = new Float64Array(4);
    return {
      mesh, omega, freq, W, T, nModes: N, fmax, analytique: false,
      eval(x, out) {
        if (x < 0 || x > mesh.Ltot) { for (let i = 0; i < N; i++) out[i] = 0; return out; }
        const e = hermite(mesh, x, hw);
        for (let i = 0; i < N; i++) out[i] = hw[0] * W[i][e] + hw[1] * T[i][e] + hw[2] * W[i][e + 1] + hw[3] * T[i][e + 1];
        return out;
      },
    };
  }

  /* ── statique exacte : ligne d'influence de la flèche au point xp (Maxwell) ── */
  function influence(spans, xp, o = {}) {
    const mesh = maillage(spans, o.nseg || 4 * clamp(Math.floor(24 / spans.length), 2, 6));
    const { K, libres, nd } = assemble(mesh), Lk = cholesky(K);
    const hw = new Float64Array(4), e = hermite(mesh, xp, hw), F = new Float64Array(nd);
    F[2 * e] = hw[0]; F[2 * e + 1] = hw[1]; F[2 * e + 2] = hw[2]; F[2 * e + 3] = hw[3];
    const u = cholSolve(Lk, libres.map((g) => F[g])), full = new Float64Array(nd); libres.forEach((g, k) => (full[g] = u[k]));
    const at = (x) => { if (x < 0 || x > mesh.Ltot) return 0; const k = hermite(mesh, x, hw); return hw[0] * full[2 * k] + hw[1] * full[2 * k + 1] + hw[2] * full[2 * k + 2] + hw[3] * full[2 * k + 3]; };
    return { at, mesh };
  }
  /* flèche statique extrême du convoi au point (déplacement pas à pas de la tête) */
  function flecheStatique(li, Ltot, axles, pas) {
    const dl = axles[axles.length - 1].d, h = pas || Math.min(0.05, Ltot / 400);
    let mx = 0, mn = 0, sMax = 0;
    for (let s = 0; s <= Ltot + dl + 1e-9; s += h) {
      let y = 0; for (const a of axles) { const x = s - a.d; if (x > 0 && x < Ltot) y += a.P * li.at(x); }
      if (y > mx) { mx = y; sMax = s; } if (y < mn) mn = y;
    }
    return { max: mx, min: mn, sMax };
  }

  /* ── récurrence exacte pour second membre linéaire par pas (Nigam-Jennings ; Chopra, Dynamics of Structures §5.2) ──
   * oscillateur de masse unité : ü + 2ζω u̇ + ω² u = p(t) */
  function coefNJ(w, z, dt) {
    const k = w * w, wd = w * Math.sqrt(1 - z * z), r = z / Math.sqrt(1 - z * z), e = Math.exp(-z * w * dt);
    const s = Math.sin(wd * dt), c = Math.cos(wd * dt);
    return {
      A: e * (r * s + c), B: e * s / wd,
      C: (2 * z / (w * dt) + e * (((1 - 2 * z * z) / (wd * dt) - r) * s - (1 + 2 * z / (w * dt)) * c)) / k,
      D: (1 - 2 * z / (w * dt) + e * ((2 * z * z - 1) / (wd * dt) * s + 2 * z / (w * dt) * c)) / k,
      Ap: -e * (w / Math.sqrt(1 - z * z)) * s, Bp: e * (c - r * s),
      Cp: (-1 / dt + e * ((w / Math.sqrt(1 - z * z) + z / (dt * Math.sqrt(1 - z * z))) * s + c / dt)) / k,
      Dp: (1 - e * (r * s + c)) / (k * dt),
    };
  }

  /* ── passage d'un convoi à vitesse v (m/s) ──
   * md : modes, axles triés par d croissant ({d, P}) , pts : abscisses de sortie, zeta (fraction).
   * Renvoie par point {ymax, ymin, amax} et, si o.histo, les historiques (t, y[], a[]). */
  function passage(md, axles, v, pts, zeta, o = {}) {
    const N = md.nModes, Ltot = md.mesh.Ltot, ppp = o.ppp || 20;
    const Tmin = 2 * Math.PI / md.omega[N - 1];
    const Lmin = Math.min(...md.mesh.x0.slice(1).map((x, i) => x - md.mesh.x0[i]));
    const dt = Math.min(Tmin / ppp, Lmin / (40 * v));
    const T1 = 2 * Math.PI / md.omega[0];
    const tEnd = (axles[axles.length - 1].d + Ltot) / v + (o.queue === undefined ? 1.5 * T1 : o.queue);
    const nSt = Math.ceil(tEnd / dt);
    const cf = md.omega.map((w) => coefNJ(w, zeta, dt));
    const phiP = pts.map((x) => md.eval(x, new Float64Array(N)));
    const q = new Float64Array(N), qd = new Float64Array(N), p0 = new Float64Array(N), p1 = new Float64Array(N), buf = new Float64Array(N);
    const np = pts.length, ymax = new Float64Array(np), ymin = new Float64Array(np), amax = new Float64Array(np), tYmax = new Float64Array(np), tAmax = new Float64Array(np);
    const dec = o.histo ? Math.max(1, Math.ceil(nSt / (o.nHisto || 1500))) : 0;
    const H = o.histo ? { t: [], y: pts.map(() => []), a: pts.map(() => []), dt, nSt } : null;
    let lo = 0, hi = -1;
    const na = axles.length;
    const force = (t, out) => {
      out.fill(0);
      const xh = v * t;
      while (hi + 1 < na && axles[hi + 1].d <= xh) hi++;
      while (lo <= hi && xh - axles[lo].d >= Ltot) lo++;
      for (let k = lo; k <= hi; k++) {
        const x = xh - axles[k].d; if (x <= 0 || x >= Ltot) continue;
        md.eval(x, buf); const P = axles[k].P;
        for (let i = 0; i < N; i++) out[i] += P * buf[i];
      }
    };
    force(0, p0);
    for (let s = 1; s <= nSt; s++) {
      const t = s * dt;
      force(t, p1);
      for (let i = 0; i < N; i++) {
        const c = cf[i], u = q[i], ud = qd[i];
        q[i] = c.A * u + c.B * ud + c.C * p0[i] + c.D * p1[i];
        qd[i] = c.Ap * u + c.Bp * ud + c.Cp * p0[i] + c.Dp * p1[i];
      }
      const rec = H && s % dec === 0;
      if (rec) H.t.push(t);
      for (let j = 0; j < np; j++) {
        const ph = phiP[j]; let y = 0, a = 0;
        for (let i = 0; i < N; i++) { const w = md.omega[i]; y += ph[i] * q[i]; a += ph[i] * (p1[i] - 2 * zeta * w * qd[i] - w * w * q[i]); }
        if (y > ymax[j]) { ymax[j] = y; tYmax[j] = t; } if (y < ymin[j]) ymin[j] = y;
        if (Math.abs(a) > amax[j]) { amax[j] = Math.abs(a); tAmax[j] = t; }
        if (rec) { H.y[j].push(y); H.a[j].push(a); }
      }
      const tmp = p0; p0.set(p1); void tmp;
    }
    return { ymax: Array.from(ymax), ymin: Array.from(ymin), amax: Array.from(amax), tYmax: Array.from(tYmax), tAmax: Array.from(tAmax), dt, nSt, histo: H };
  }

  /* lecture d'un convoi utilisateur : une ligne « d P » (abscisse depuis la tête en m, charge en kN) */
  function lireConvoi(txt) {
    const ax = [];
    for (const l of String(txt).split(/\r?\n/)) {
      const s = l.replace(/[;#].*$/, '').trim(); if (!s) continue;
      const v = s.split(/[\s\t]+/).map((x) => parseFloat(x.replace(',', '.')));
      if (v.length < 2 || !Number.isFinite(v[0]) || !Number.isFinite(v[1])) throw new Error('Ligne de convoi illisible : « ' + l + ' »');
      ax.push({ d: v[0], P: v[1] });
    }
    ax.sort((a, b) => a.d - b.d);
    if (!ax.length) throw new Error('Convoi vide.');
    const d0 = ax[0].d; ax.forEach((a) => (a.d -= d0));
    return ax;
  }

  /* points de sortie par défaut : quarts et mi-travées de chaque travée */
  function pointsDefaut(portees) {
    const pts = []; let x = 0;
    portees.forEach((L, t) => { pts.push({ x: x + L / 4, nom: `T${t + 1} — L/4` }, { x: x + L / 2, nom: `T${t + 1} — L/2` }, { x: x + 3 * L / 4, nom: `T${t + 1} — 3L/4` }); x += L; });
    return pts;
  }

  /* ── calcul complet ──
   * inp : {spans:[{L,EI,m}], type:'bp'|'ba'|'acier'|'mixte', zeta (% imposé ou null), dzeta:bool,
   *        trains:['A1',…] | 'user', convoi:[{d,P}], vmin, vmax (km/h, vitesse maxi de la ligne), vstep, vmaxEtude (km/h, défaut 1,2·vmax),
   *        pts:[{x, nom}], vHisto (km/h), ballast:bool, nT, ppp }
   * onProgress(fraction) facultatif. */
  function calcul(inp, onProgress) {
    const spans = inp.spans, portees = spans.map((s) => s.L), n = spans.length;
    const Lmax = Math.max(...portees), LPh = lPhi(portees);
    const Lz = n === 1 ? portees[0] : Lmax;
    const zTab = zetaTab(inp.type, Lz), dZ = inp.dzeta ? deltaZeta(Lz) : 0;
    const zeta = (Number.isFinite(inp.zeta) && inp.zeta > 0 ? inp.zeta : zTab) + dZ;
    if (zeta >= 20) throw new Error('Amortissement irréaliste.');
    const md = modes(spans, { fmax: inp.fmax || 30, nseg: inp.nseg });
    const n0 = md.freq[0];
    const vEt = inp.vmaxEtude > 0 ? inp.vmaxEtude : 1.2 * inp.vmax;
    const vmin = Math.max(5, inp.vmin || 40), vstep = inp.vstep > 0 ? inp.vstep : 5;
    const vit = []; for (let v = vmin; v <= vEt + 1e-9 && vit.length < 200; v += vstep) vit.push(+v.toFixed(6));
    if (vit.length < 1) throw new Error('Plage de vitesses vide.');
    const pts = (inp.pts && inp.pts.length ? inp.pts : pointsDefaut(portees)).filter((p) => p.x > 0 && p.x < md.mesh.Ltot);
    if (!pts.length) throw new Error('Aucun point de calcul à l\'intérieur de l\'ouvrage.');
    const trains = inp.trains === 'user' ? [{ nom: 'Convoi utilisateur', axles: inp.convoi }] : (inp.trains || ['A1']).map((t) => ({ nom: 'HSLM-' + t, axles: hslmAxles(t) }));
    for (const t of trains) { if (!t.axles || !t.axles.length) throw new Error('Convoi vide.'); if (t.axles.length > 99) throw new Error(`${t.nom} : ${t.axles.length} essieux (99 au maximum).`); t.axles = t.axles.slice().sort((a, b) => a.d - b.d); }
    // statique exacte
    const lis = pts.map((p) => influence(spans, p.x, { nseg: inp.nseg }));
    const stat = trains.map((t) => pts.map((p, j) => flecheStatique(lis[j], md.mesh.Ltot, t.axles)));
    // balayage des vitesses
    const env = trains.map(() => pts.map(() => ({ y: [], a: [], ymin: [] })));
    let nStMax = 0, dtMin = Infinity; const total = trains.length * vit.length; let done = 0;
    trains.forEach((t, it) => {
      for (const vk of vit) {
        const r = passage(md, t.axles, vk / 3.6, pts.map((p) => p.x), zeta / 100, { ppp: inp.ppp });
        nStMax = Math.max(nStMax, r.nSt); dtMin = Math.min(dtMin, r.dt);
        pts.forEach((p, j) => { env[it][j].y.push(r.ymax[j]); env[it][j].a.push(r.amax[j]); env[it][j].ymin.push(r.ymin[j]); });
        done++; if (onProgress) onProgress(done / total);
      }
    });
    // synthèse par point (enveloppe sur les trains et les vitesses ≤ 1,2 V)
    const synth = pts.map((p, j) => {
      let best = { y: -1, a: -1 };
      trains.forEach((t, it) => env[it][j].y.forEach((y, k) => {
        if (y > best.y) Object.assign(best, { y, vy: vit[k], ty: it });
        const a = env[it][j].a[k]; if (a > best.a) Object.assign(best, { a, va: vit[k], ta: it });
      }));
      const ys = stat[best.ty][j].max, ysAll = Math.max(...stat.map((s) => s[j].max));
      return { x: p.x, nom: p.nom, ydyn: best.y, vy: best.vy, trainY: trains[best.ty].nom, ystat: ys, ystatMax: ysAll, phiDyn: ys > 0 ? best.y / ys - 1 : NaN, amax: best.a, va: best.va, trainA: trains[best.ta].nom };
    });
    const iA = synth.reduce((b, s, j) => (s.amax > synth[b].amax ? j : b), 0);
    const iY = synth.reduce((b, s, j) => ((s.phiDyn > synth[b].phiDyn) ? j : b), 0);
    const aAdm = aLim(inp.ballast !== false);
    // historique pour la vitesse choisie (train déterminant pour l'accélération)
    const vH = inp.vHisto > 0 ? inp.vHisto : synth[iA].va;
    const tH = trains.findIndex((t) => t.nom === synth[iA].trainA);
    const hist = passage(md, trains[tH].axles, vH / 3.6, pts.map((p) => p.x), zeta / 100, { ppp: inp.ppp, histo: true });
    const orga = organigramme({ V: inp.vmax, continu: n > 1, L: n > 1 ? LPh : portees[0], n0, nT: inp.nT });
    const vMs = inp.vmax / 3.6, phiS = phiSecond(LPh, n0, n > 1 ? LPh : portees[0], vMs);
    return {
      n0, freq: md.freq, nModes: md.nModes, fmax: md.fmax, analytique: md.analytique, Ltot: md.mesh.Ltot,
      zeta, zTab, dZ, Lz, LPhi: LPh, phi2: phi2(LPh), phi3: phi3(LPh), phiSecond: phiS,
      vit, pts, trains: trains.map((t) => ({ nom: t.nom, nAx: t.axles.length, long: t.axles[t.axles.length - 1].d })),
      env, stat, synth, iA, iY, aAdm, okA: synth[iA].amax <= aAdm,
      histo: { v: vH, train: trains[tH].nom, ...hist.histo },
      orga, nStMax, dtMin,
      resonances: md.freq.slice(0, 3).map((f) => f), // n0·D/k donne les vitesses critiques
    };
  }

  /* historique flèche/accélération pour une vitesse et un train donnés (recalcul léger, page) */
  function historique(inp, vKmh, train) {
    const spans = inp.spans, portees = spans.map((s) => s.L);
    const Lz = spans.length === 1 ? portees[0] : Math.max(...portees);
    const zeta = (Number.isFinite(inp.zeta) && inp.zeta > 0 ? inp.zeta : zetaTab(inp.type, Lz)) + (inp.dzeta ? deltaZeta(Lz) : 0);
    const md = modes(spans, { fmax: inp.fmax || 30, nseg: inp.nseg });
    const axles = (train === 'Convoi utilisateur' ? inp.convoi : hslmAxles(String(train).replace('HSLM-', ''))).slice().sort((a, b) => a.d - b.d);
    const pts = (inp.pts && inp.pts.length ? inp.pts : pointsDefaut(portees)).filter((p) => p.x > 0 && p.x < md.mesh.Ltot);
    const r = passage(md, axles, vKmh / 3.6, pts.map((p) => p.x), zeta / 100, { ppp: inp.ppp, histo: true });
    return { v: vKmh, train, ...r.histo };
  }

  const api = { historique, HSLM_A, GEOM, hslmAxles, zetaTab, deltaZeta, n0Limites, lPhi, phi2, phi3, phiSecond, aLim, organigramme, jacobi, modes, influence, flecheStatique, coefNJ, passage, lireConvoi, pointsDefaut, calcul };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.cedypia = api; }
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : globalThis));
