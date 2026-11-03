/* GMSLT — répartition transversale et flexion transversale des tabliers par la méthode de Guyon-Massonnet-Barès.
 *
 * Références :
 *  - Y. Guyon, « Calcul des ponts larges à poutres multiples solidarisées par des entretoises », Annales des Ponts et
 *    Chaussées, 1946 ; Ch. Massonnet, « Méthode de calcul des ponts à poutres multiples tenant compte de leur résistance
 *    à la torsion », Publications AIPC, 1950 ; R. Barès & Ch. Massonnet, « Le calcul des grillages de poutres et dalles
 *    orthotropes », Dunod, 1966 (formules exactes pour α = 0 et α = 1, interpolation en √α).
 *  - Guide SETRA « Ponts-dalles » (PSI-DA/DP) et « VIPP » : calcul des rigidités ρP, ρE, γP, γE.
 *  - Fascicule 61 titre II (1971 mod.) : A(l) art. 4, Bc art. 5.2, Bt art. 5.4, Mc80/Mc120 art. 9, trottoirs art. 13.
 *  - EN 1991-2 : LM1 §4.3.2 et tableau 4.2 (α de l'AN française), voies conventionnelles §4.2.3,
 *    LM71 §6.3.2, SW/0 et SW/2 §6.3.3, répartition par les traverses et le ballast §6.3.6.
 *
 * Modèle : dalle orthotrope équivalente de largeur 2b, simplement appuyée sur la portée L, bords latéraux libres.
 * Charge harmonique p(x, e) = pₙ sin(nπx/L) en ligne à l'excentricité e. Avec u = y/b, k = nπθ, l'équation de la plaque
 * (ρP w,xxxx + (γP+γE) w,xxyy + ρE w,yyyy = p) devient pour l'amplitude W(u) :
 *       W'''' − 2α k² W'' + k⁴ W = δ(u − uₑ)          (W en unités pₙ b³/ρE)
 * bords libres u = ±1 :  W'' − ν k² W = 0 (My = 0)   et   W''' − (2α − ν) k² W' = 0 (effort de Kirchhoff nul).
 *   K  = W / W̄  avec W̄ = flèche de la même charge répartie uniformément sur 2b  →  K = 2 k⁴ W   (calculé avec ν = 0)
 *   μ  = −(W'' − ν k² W)  et  My = b · μ · pₙ   (calculé avec ν)
 * Solution exacte : W = Wh + G(u − uₑ), G solution fondamentale de la bande infinie (amortie), Wh solution homogène
 * fixée par les 4 conditions de bord (bases amorties depuis chaque bord : numériquement stable quel que soit θ).
 * Charge hors de la dalle (encorbellement) : « prolongé » (prolongement analytique de la formule, comme les abaques
 * et le programme d'origine) ou « statique » (force et moment ramenés au bord).
 *
 * Unités : m, kN, kN/m², moments transversaux en kN·m/m.
 */
(function (root) {
  'use strict';
  const PI = Math.PI;

  /* ── 1. bande infinie : fonctions de base et dérivées 0..3 ── */
  // paire de fonctions e^{ps}cos(qs), e^{ps}sin(qs) (q > 0) ou e^{ps}, s·e^{ps} (q = 0) et leurs dérivées
  function pair(p, q, s) {
    const E = Math.exp(p * s);
    if (q === 0) {
      const f1 = [E, p * E, p * p * E, p * p * p * E];
      const f2 = [s * E, (1 + p * s) * E, (2 * p + p * p * s) * E, (3 * p * p + p * p * p * s) * E];
      return [f1, f2];
    }
    const c = Math.cos(q * s), sn = Math.sin(q * s);
    let x = 1, y = 0; const f1 = [], f2 = [];
    for (let m = 0; m < 4; m++) {
      f1.push(E * (x * c - y * sn)); f2.push(E * (x * sn + y * c));
      const nx = x * p - y * q; y = x * q + y * p; x = nx; // (p + iq)^m
    }
    return [f1, f2];
  }
  function solve4(A, B) {
    const n = 4; A = A.map((r) => r.slice()); B = B.slice();
    for (let k = 0; k < n; k++) {
      let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
      [A[k], A[p]] = [A[p], A[k]]; [B[k], B[p]] = [B[p], B[k]];
      for (let i = k + 1; i < n; i++) { const f = A[i][k] / A[k][k]; for (let j = k; j < n; j++) A[i][j] -= f * A[k][j]; B[i] -= f * B[k]; }
    }
    const x = [0, 0, 0, 0];
    for (let i = n - 1; i >= 0; i--) { let s = B[i]; for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
    return x;
  }
  /* bande de paramètres (α, k = nπθ, ν) : renvoie solve(uₑ, mode) → fonction u ↦ [W, W', W'', W'''] */
  function strip(alpha, k, nu) {
    alpha = Math.min(1, Math.max(0, alpha));
    const one = alpha > 1 - 1e-7;
    const a = one ? k : Math.sqrt((1 + alpha) / 2) * k, q = one ? 0 : Math.sqrt((1 - alpha) / 2) * k;
    // solution fondamentale amortie G(s) = c1 φ1 + c2 φ2 (s ≥ 0), paire : G'(0) = 0, G'''(0+) = 1/2
    const g0 = pair(-a, q, 0);
    const cg = (function () { const a11 = g0[0][1], a12 = g0[1][1], a21 = g0[0][3], a22 = g0[1][3], d = a11 * a22 - a12 * a21; return [(-a12 * 0.5) / d, (a11 * 0.5) / d]; })();
    // branche br = +1 : formule valable pour s ≥ 0 ; br = −1 : formule symétrique valable pour s ≤ 0
    const Gb = (s, br) => { const t = br > 0 ? s : -s, f = pair(-a, q, t), o = []; for (let m = 0; m < 4; m++) o.push((cg[0] * f[0][m] + cg[1] * f[1][m]) * (br < 0 && m % 2 ? -1 : 1)); return o; };
    const G = (s) => Gb(s, s < 0 ? -1 : 1);
    // base homogène : 2 fonctions amorties depuis le bord gauche, 2 depuis le bord droit
    const H = (u) => { const L = pair(-a, q, u + 1), R = pair(a, q, u - 1); return [L[0], L[1], R[0], R[1]]; };
    const k2 = k * k, cV = 2 * alpha - nu;
    const bcM = (d) => d[2] - nu * k2 * d[0], bcV = (d) => d[3] - cV * k2 * d[1];
    const Hm1 = H(-1), Hp1 = H(1);
    const A = [Hm1.map(bcM), Hm1.map(bcV), Hp1.map(bcM), Hp1.map(bcV)];
    return function (ue, mode) {
      const out = (ue < -1 || ue > 1) && mode === 'statique';
      let rhs, useG = !out;
      // bord gauche : branche « s < 0 » de G, bord droit : branche « s > 0 » (prolongement analytique si la charge
      // est hors de la dalle, comme les formules de Guyon-Massonnet utilisées pour les encorbellements)
      if (useG) { const gm = Gb(-1 - ue, -1), gp = Gb(1 - ue, 1); rhs = [-bcM(gm), -bcV(gm), -bcM(gp), -bcV(gp)]; }
      else {
        // charge unité hors dalle à la distance d du bord : effort tranchant ±1 et moment de console −d (μ = −d)
        const d = Math.abs(ue) - 1;
        rhs = ue < -1 ? [d, 1, 0, 0] : [0, 0, d, -1];
      }
      const c = solve4(A, rhs);
      return (u) => {
        const h = H(u), o = useG ? G(u - ue) : [0, 0, 0, 0];
        for (let j = 0; j < 4; j++) for (let m = 0; m < 4; m++) o[m] += c[j] * h[j][m];
        return o;
      };
    };
  }
  const memoStrip = new Map();
  const getStrip = (alpha, k, nu) => { const key = alpha + '|' + k + '|' + nu; let s = memoStrip.get(key); if (!s) { s = strip(alpha, k, nu); if (memoStrip.size > 400) memoStrip.clear(); memoStrip.set(key, s); } return s; };

  /* ── 2. coefficients ponctuels (u = y/b, ue = e/b) ── */
  // K pour α = 0 (Guyon) ou α = 1 (Massonnet), θ quelconque — ν = 0
  const Kexact = (alpha, theta, u, ue, mode) => { const k = PI * theta; return 2 * Math.pow(k, 4) * getStrip(alpha, k, 0)(ue, mode)(u)[0]; };
  const MUexact = (alpha, theta, u, ue, nu, mode) => { const k = PI * theta, w = getStrip(alpha, k, nu)(ue, mode)(u); return -(w[2] - nu * k * k * w[0]); };
  /* interpolation en α :
   *  'massonnet' (défaut) : K = K0 + (K1 − K0)·√α  (Massonnet 1950, reprise par Barès-Massonnet et le guide SETRA)
   *  'sattler'            : K = K0 + (K1 − K0)·α^(1 − exp((0,065 − θ)/0,663))  (Sattler 1955)
   *  'exacte'             : résolution directe pour α (la plaque orthotrope générale, sans interpolation)
   * μ est toujours interpolé en √α (Massonnet) sauf en 'exacte'. */
  function Kalpha(alpha, theta, u, ue, o = {}) {
    const meth = o.interp || 'massonnet', mode = o.hors || 'prolonge';
    if (meth === 'exacte') return Kexact(alpha, theta, u, ue, mode);
    const K1 = Kexact(1, theta, u, ue, mode); if (alpha >= 1) return K1;
    const K0 = Kexact(0, theta, u, ue, mode);
    const ex = meth === 'sattler' ? 1 - Math.exp((0.065 - theta) / 0.663) : 0.5;
    return K0 + (K1 - K0) * Math.pow(alpha, ex);
  }
  function MUalpha(alpha, theta, u, ue, nu, o = {}) {
    const meth = o.interp || 'massonnet', mode = o.hors || 'prolonge';
    if (meth === 'exacte') return MUexact(alpha, theta, u, ue, nu * alpha, mode);
    const M1 = MUexact(1, theta, u, ue, nu, mode); if (alpha >= 1) return M1;
    const M0 = MUexact(0, theta, u, ue, 0, mode);
    return M0 + (M1 - M0) * Math.sqrt(alpha);
  }

  /* ── 3. rigidités ── */
  /* dalle pleine isotrope d'épaisseur h : ρP = ρE = E h³/12, γP = γE = ρ (α = 1 par convention de Massonnet) */
  function rigDalle(o) {
    const E = o.E || 1, h = o.h, rho = E * h * h * h / 12;
    return { rhoP: rho, rhoE: rho, gP: rho, gE: rho, alpha: 1, theta: o.b && o.L ? o.b / o.L : null };
  }
  /* coefficient de torsion de Saint-Venant d'un rectangle a × t (a ≥ t) : K = k a t³ (approximation de Roark, 0,5 %) */
  const kRect = (a, t) => { if (t > a) [a, t] = [t, a]; return 1 / 3 - 0.21 * (t / a) * (1 - Math.pow(t / a, 4) / 12); };
  /* tablier à poutres (guide SETRA VIPP / PRAD) :
   *  o = {E, nu, b1 (entraxe des poutres), Ip (inertie de flexion d'une poutre avec sa table, m⁴), Kp (inertie de torsion
   *       d'une poutre, m⁴), hd (épaisseur du hourdis), entretoises : {LE (espacement), IE, KE} facultatif}
   *  ρP = E Ip / b1 ; γP = G Kp / b1 ; sans entretoises : ρE = E hd³/12, γE = G hd³/6 (hourdis, demi-épaisseur de torsion
   *  de part et d'autre de la fibre moyenne) ; avec entretoises : ρE = E IE / LE, γE = G KE / LE.  G = E / (2(1+ν)). */
  function rigPoutres(o) {
    const E = o.E || 1, nu = o.nu === undefined ? 0 : o.nu, G = E / (2 * (1 + nu));
    const rhoP = E * o.Ip / o.b1, gP = G * o.Kp / o.b1;
    let rhoE, gE;
    if (o.entretoises && o.entretoises.LE) { rhoE = E * o.entretoises.IE / o.entretoises.LE; gE = G * o.entretoises.KE / o.entretoises.LE; }
    else { rhoE = E * Math.pow(o.hd, 3) / 12; gE = G * Math.pow(o.hd, 3) / 6; }
    return { rhoP, rhoE, gP, gE };
  }
  /* paramètres d'entretoisement et de torsion */
  const theta = (b, L, rhoP, rhoE) => b / L * Math.pow(rhoP / rhoE, 0.25);
  const alphaT = (gP, gE, rhoP, rhoE) => (gP + gE) / (2 * Math.sqrt(rhoP * rhoE));

  /* ── 4. modèle d'un tablier : tables K(y, e) et μn(y, e) ──
   * p = {b, L, theta, alpha, nu, N (harmoniques), xs (section, défaut L/2), pas : 'table' (b/8, comme les abaques et
   *      le programme d'origine, interpolation linéaire en e) ou 'fin' (b/64), interp, hors, fibres:[y], emin, emax} */
  function modele(p) {
    const b = p.b, L = p.L, th = p.theta, al = p.alpha === undefined ? 1 : p.alpha, nu = p.nu || 0, N = p.N || 5;
    const xs = p.xs === undefined ? L / 2 : p.xs, o = { interp: p.interp, hors: p.hors };
    const h = b / 8 / (p.pas === 'fin' ? 8 : 1);
    const fib = (p.fibres && p.fibres.length ? p.fibres.slice() : Array.from({ length: 17 }, (_, i) => -b + i * b / 8)).map(Number);
    const emin = Math.min(-2 * b, p.emin === undefined ? -2 * b : p.emin), emax = Math.max(2 * b, p.emax === undefined ? 2 * b : p.emax);
    const j0 = Math.floor(emin / h + 1e-9), j1 = Math.ceil(emax / h - 1e-9);
    const cache = new Map();
    const col = (kind, n, j) => { // valeurs sur toutes les fibres pour la charge au nœud j
      const key = kind + n + ':' + j; let v = cache.get(key); if (v) return v;
      const ue = j * h / b;
      v = fib.map((y) => kind === 'K' ? Kalpha(al, th, y / b, ue, o) : MUalpha(al, n * th, y / b, ue, nu, o));
      cache.set(key, v); return v;
    };
    // intégrale de f(e) linéaire par morceaux entre nœuds sur [e1, e2], f donnée par fonction des nœuds → vecteur fibres
    function integ(kind, n, e1, e2) {
      const out = new Array(fib.length).fill(0);
      if (e2 < e1) [e1, e2] = [e2, e1];
      if (e2 - e1 < 1e-12) { // charge en ligne
        const t = e1 / h, j = Math.floor(t + 1e-12), r = t - j, A = col(kind, n, j), B = r > 1e-12 ? col(kind, n, j + 1) : A;
        for (let i = 0; i < fib.length; i++) out[i] = A[i] * (1 - r) + B[i] * r; return out;
      }
      let ja = Math.floor(e1 / h + 1e-12);
      for (let j = ja; j * h < e2 - 1e-12; j++) {
        const xa = Math.max(e1, j * h), xb = Math.min(e2, (j + 1) * h); if (xb <= xa) continue;
        const ra = xa / h - j, rb = xb / h - j, A = col(kind, n, j), B = col(kind, n, j + 1);
        const wA = (xb - xa) * (1 - (ra + rb) / 2), wB = (xb - xa) * (ra + rb) / 2;
        for (let i = 0; i < fib.length; i++) out[i] += A[i] * wA + B[i] * wB;
      }
      return out;
    }
    // harmonique n d'une répartition longitudinale : liste [{x1, x2, P}] (P kN, x1 = x2 : force ponctuelle) → (2/L)∫ p sin
    const harm = (lon, n) => {
      let s = 0;
      for (const g of lon) {
        if (g.x2 - g.x1 < 1e-9) { if (g.x1 > 0 && g.x1 < L) s += g.P * Math.sin(n * PI * g.x1 / L); continue; }
        const a = Math.max(0, g.x1), c = Math.min(L, g.x2); if (c <= a) continue;
        s += g.P / (g.x2 - g.x1) * L / (n * PI) * (Math.cos(n * PI * a / L) - Math.cos(n * PI * c / L));
      }
      return 2 / L * s;
    };
    /* effet d'un ensemble de charges élémentaires : [{e1, e2, lon:[{x1,x2,P}]}] (P = force totale de l'élément) →
     * {M:[…] moment transversal par fibre en kN·m/m à la section xs, K:[…] coefficient de répartition moyen pondéré
     *  par la première harmonique, P1 : poids total} */
    function effet(elems) {
      const M = new Array(fib.length).fill(0), Kn = new Array(fib.length).fill(0); let W = 0;
      for (const el of elems) {
        const w = Math.max(1e-12, el.e2 - el.e1);
        for (let n = 1; n <= N; n++) {
          const pn = harm(el.lon, n), sx = Math.sin(n * PI * xs / L); if (!pn || Math.abs(sx) < 1e-12) continue;
          const I = integ('M', n, el.e1, el.e2), f = b * pn * sx / (el.e2 - el.e1 < 1e-12 ? 1 : w);
          for (let i = 0; i < fib.length; i++) M[i] += f * I[i];
        }
        const p1 = harm(el.lon, 1); if (!p1) continue;
        const IK = integ('K', 1, el.e1, el.e2), fk = p1 / (el.e2 - el.e1 < 1e-12 ? 1 : w);
        for (let i = 0; i < fib.length; i++) Kn[i] += fk * IK[i];
        W += p1;
      }
      return { M, K: Kn.map((v) => (W ? v / W : 0)), P1: W };
    }
    const Kat = (y, e) => Kalpha(al, th, y / b, e / b, o);
    const muAt = (n, y, e) => MUalpha(al, n * th, y / b, e / b, nu, o);
    return { b, L, theta: th, alpha: al, nu, N, xs, h, fibres: fib, j0, j1, col, integ, harm, effet, Kat, muAt,
      tableK: () => { const es = []; for (let j = Math.round(-2 * b / h); j <= Math.round(2 * b / h); j += (p.pas === 'fin' ? 8 : 1)) es.push(j * h); return { e: es, K: es.map((e, k) => col('K', 1, Math.round(e / h))) }; },
      tableMu: (n) => { const es = []; for (let j = Math.round(-2 * b / h); j <= Math.round(2 * b / h); j += (p.pas === 'fin' ? 8 : 1)) es.push(j * h); return { e: es, mu: es.map((e) => col('M', n, Math.round(e / h))) }; } };
  }

  /* ── 5. véhicules et placement transversal défavorable ──
   * véhicule = {roues:[{dy (décalage transversal du centre de la roue / file), l (largeur transversale), P, dx, lx}],
   *             larg (encombrement transversal pour le placement), bordMin (distance mini axe de roue extrême – bord)}
   * Pour une fibre et une position longitudinale données, la valeur v(c) d'un véhicule centré en c est calculée sur une
   * grille ; le placement de n véhicules (écart mini entre centres « ecart ») maximisant Σ coef(n)·v est obtenu par
   * programmation dynamique (exacte sur la grille). */
  function placer(vals, grid, n, ecart, coefN, sens) {
    // vals[ic] : valeur d'un véhicule centré en grid[ic] ; renvoie {v, pos:[c…], n}
    const G = grid.length, step = G > 1 ? grid[1] - grid[0] : 1, gap = Math.max(1, Math.round(ecart / step - 1e-9));
    let best = { v: 0, pos: [], n: 0 };
    // dp[k][i] = meilleure somme de k véhicules dont le dernier est en i
    let prev = vals.map((v) => sens * v), prevArg = vals.map(() => -1); const args = [prevArg];
    const consider = (k, arr) => { const c = coefN(k); if (!c) return; let mi = -1, mv = -Infinity; for (let i = 0; i < G; i++) if (arr[i] > mv) { mv = arr[i]; mi = i; } if (mi >= 0 && c * mv > best.v + 1e-12) { const pos = []; let i = mi; for (let kk = k; kk >= 1; kk--) { pos.unshift(grid[i]); i = args[kk - 1][i]; } best = { v: c * mv, pos, n: k }; } };
    consider(1, prev);
    for (let k = 2; k <= n; k++) {
      // préfixe max de prev jusqu'à i − gap
      const pm = new Array(G).fill(-Infinity), pa = new Array(G).fill(-1);
      for (let i = 0; i < G; i++) { pm[i] = i ? pm[i - 1] : -Infinity; pa[i] = i ? pa[i - 1] : -1; if (prev[i] > pm[i]) { pm[i] = prev[i]; pa[i] = i; } }
      const cur = new Array(G).fill(-Infinity), arg = new Array(G).fill(-1);
      for (let i = gap; i < G; i++) { const j = i - gap; if (pm[j] > -Infinity) { cur[i] = pm[j] + sens * vals[i]; arg[i] = pa[j]; } }
      args.push(arg); prev = cur; consider(k, cur);
    }
    return { v: sens * best.v, pos: best.pos, n: best.n };
  }

  /* éléments de charge d'un véhicule centré transversalement en c, avec son implantation longitudinale x0 */
  const elemsVeh = (veh, c, x0) => veh.roues.map((r) => ({ e1: c + r.dy - (r.l || 0) / 2, e2: c + r.dy + (r.l || 0) / 2, lon: [{ x1: x0 + (r.dx || 0) - (r.lx || 0) / 2, x2: x0 + (r.dx || 0) + (r.lx || 0) / 2, P: r.P }] }));

  /* enveloppe d'un convoi de véhicules identiques :
   * cv = {veh, nMax, ecart, coefN(n), zone:[emin, emax] (zone où doivent se trouver les centres), xs0:[…] positions
   *       longitudinales à essayer, pas} → par fibre : Kmax (avec la configuration), Mmax, Mmin (et configurations) */
  function enveloppeConvoi(m, cv) {
    const pas = cv.pas || 0.05, [c0, c1] = cv.zone, grid = [];
    for (let c = c0; c <= c1 + 1e-9; c += pas) grid.push(+c.toFixed(6));
    if (!grid.length) return null;
    const nf = m.fibres.length, res = m.fibres.map((y) => ({ y, Kmax: 0, Mmax: 0, Mmin: 0, cfgK: null, cfgMax: null, cfgMin: null }));
    const valsK = grid.map((c) => m.effet(elemsVeh(cv.veh, c, m.L / 2)));
    for (const x0 of cv.xs0) {
      const ef = grid.map((c) => m.effet(elemsVeh(cv.veh, c, x0)));
      for (let i = 0; i < nf; i++) {
        const v = ef.map((e) => e.M[i]);
        const mx = placer(v, grid, cv.nMax, cv.ecart, cv.coefN, 1), mn = placer(v, grid, cv.nMax, cv.ecart, cv.coefN, -1);
        if (mx.v > res[i].Mmax) { res[i].Mmax = mx.v; res[i].cfgMax = { x0, pos: mx.pos }; }
        if (mn.v < res[i].Mmin) { res[i].Mmin = mn.v; res[i].cfgMin = { x0, pos: mn.pos }; }
      }
    }
    // K : maximise coef(n)·Σ K·P1, on rapporte K moyen de la configuration et le coefficient global coef·n·K
    for (let i = 0; i < nf; i++) {
      const v = valsK.map((e) => e.K[i] * e.P1), P1 = valsK[0].P1 || 1;
      const k = placer(v, grid, cv.nMax, cv.ecart, cv.coefN, 1);
      res[i].Kmax = k.n ? k.v / (cv.coefN(k.n) * k.n * P1) : 0;
      res[i].Kglob = k.v / P1; res[i].cfgK = { pos: k.pos, n: k.n };
    }
    return res;
  }

  /* ── 6. charges réglementaires ── */
  /* géométrie transversale : la chaussée (largeur roulable) est centrée en yc ; largeur chargeable = roulable − 0,50 m
   * le long de chaque dispositif de retenue (Fasc. 61 II art. 2.1) */
  function f61Geom(Lr, nDisp, yc = 0) {
    const Lch = Lr - 0.5 * nDisp; // nDisp : nombre de dispositifs de retenue (0, 1 ou 2), répartis symétriquement
    let Nv = Math.floor(Lch / 3 + 1e-9); if (Lch >= 5 && Lch < 6) Nv = 2; Nv = Math.max(1, Nv);
    const classe = Lr >= 7 ? 1 : Lr > 5.5 ? 2 : 3;
    const off = nDisp === 1 ? 0.25 : 0; // un seul dispositif supposé à gauche
    return { Lr, Lch, Nv, v: Lch / Nv, classe, y1: yc - Lch / 2 + off, y2: yc + Lch / 2 + off };
  }
  const A1 = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] }, V0 = { 1: 3.5, 2: 3.0, 3: 2.75 };
  const BC = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 0.8] }, BT = { 1: 1.0, 2: 0.9 };
  const a1F = (cl, n) => { const t = A1[cl] || [1]; return t[Math.min(n, t.length) - 1]; };
  const bcF = (cl, n) => { const t = BC[cl] || [1]; return t[Math.min(n, t.length) - 1]; };
  const AL = (l) => Math.max(2.3 + 360 / (l + 12), 4 - 0.002 * l); // kN/m², Fasc. 61 II art. 4.2

  /* véhicules du Fascicule 61 titre II (roues = files transversales, P par roue) */
  const VEH = {
    // Bc art. 5.2 : essieux 60 / 120 / 120 kN à 4,50 et 1,50 m ; roues à 2,00 m ; impact 0,25 × 0,25 m (0,20 à l'avant)
    Bc: (dif) => ({ nom: 'Bc', larg: 2.5, roues: [-1, 1].flatMap((dy) => [{ dy, l: 0.20 + dif, P: 30, dx: 0, lx: 0.20 }, { dy, l: 0.25 + dif, P: 60, dx: -4.5, lx: 0.25 }, { dy, l: 0.25 + dif, P: 60, dx: -6.0, lx: 0.25 }]) }),
    // Bt art. 5.4 : tandem 2 × 160 kN à 1,35 m, roues à 2,00 m, impact 0,60 (transversal) × 0,25 m
    Bt: (dif) => ({ nom: 'Bt', larg: 3.0, roues: [-1, 1].flatMap((dy) => [{ dy, l: 0.60 + dif, P: 80, dx: -0.675, lx: 0.25 }, { dy, l: 0.60 + dif, P: 80, dx: 0.675, lx: 0.25 }]) }),
    // Mc80 art. 9.2 : 2 chenilles 0,85 × 4,90 m, entraxe 2,80 m, 720 kN ; Me80 : 2 essieux 220 kN à 1,50 m, impact 3,50 × 0,12
    Mc80: () => ({ nom: 'Mc80', larg: 3.65, roues: [-1.4, 1.4].map((dy) => ({ dy, l: 0.85, P: 360, dx: 0, lx: 4.9 })) }),
    Me80: () => ({ nom: 'Me80', larg: 3.5, roues: [-0.75, 0.75].map((dx) => ({ dy: 0, l: 3.5, P: 220, dx, lx: 0.12 })) }),
    // Mc120 : 2 chenilles 1,00 × 6,10 m, entraxe 3,30 m, 1100 kN ; Me120 : 2 essieux 330 kN à 1,80 m, impact 4,00 × 0,15
    Mc120: () => ({ nom: 'Mc120', larg: 4.3, roues: [-1.65, 1.65].map((dy) => ({ dy, l: 1.0, P: 550, dx: 0, lx: 6.1 })) }),
    Me120: () => ({ nom: 'Me120', larg: 4.0, roues: [-0.9, 0.9].map((dx) => ({ dy: 0, l: 4.0, P: 330, dx, lx: 0.15 })) }),
  };

  const range = (a, b, s) => { const o = []; for (let x = a; x <= b + 1e-9; x += s) o.push(+x.toFixed(6)); return o; };
  const keepMax = (dst, src, tag) => src.forEach((r, i) => {
    const d = dst[i];
    if (r.Kmax > d.Kmax) { d.Kmax = r.Kmax; d.Kglob = r.Kglob; d.cfgK = Object.assign({ convoi: tag }, r.cfgK); }
    if (r.Mmax > d.Mmax) { d.Mmax = r.Mmax; d.cfgMax = Object.assign({ convoi: tag }, r.cfgMax); }
    if (r.Mmin < d.Mmin) { d.Mmin = r.Mmin; d.cfgMin = Object.assign({ convoi: tag }, r.cfgMin); }
  });
  const vide = (m) => m.fibres.map((y) => ({ y, Kmax: 0, Kglob: 0, Mmax: 0, Mmin: 0, cfgK: null, cfgMax: null, cfgMin: null }));

  /* A(l) : voies entières (largeur v) chargées sur toute la portée ; on choisit les voies (contiguës ou non) qui
   * maximisent a1(n)·Σ effet (Fasc. 61 II art. 4.2). q = a2·A(L) (ou 1 kN/m² si unitaire) */
  function chargeAL(m, g, o = {}) {
    const a2 = V0[g.classe] / g.v, q = o.unitaire ? 1 : a2 * AL(m.L);
    const voies = Array.from({ length: g.Nv }, (_, i) => g.y1 + (i + 0.5) * g.v);
    const ef = voies.map((c) => m.effet([{ e1: c - g.v / 2, e2: c + g.v / 2, lon: [{ x1: 0, x2: m.L, P: q * g.v * m.L }] }]));
    const res = vide(m);
    for (let mask = 1; mask < (1 << g.Nv); mask++) {
      const sel = voies.filter((_, i) => mask & (1 << i)), n = sel.length, a1 = o.unitaire && !o.a1 ? 1 : a1F(g.classe, n);
      res.forEach((r, i) => {
        let M = 0, KP = 0, P = 0;
        voies.forEach((_, j) => { if (mask & (1 << j)) { M += ef[j].M[i]; KP += ef[j].K[i] * ef[j].P1; P += ef[j].P1; } });
        M *= a1;
        if (M > r.Mmax) { r.Mmax = M; r.cfgMax = { voies: sel }; }
        if (M < r.Mmin) { r.Mmin = M; r.cfgMin = { voies: sel }; }
        if (a1 * KP > r.Kglob * P / n * 0 + (r._kp || 0)) { r._kp = a1 * KP; r.Kmax = KP / P; r.Kglob = a1 * KP / ef[0].P1; r.cfgK = { voies: sel }; }
      });
    }
    res.forEach((r) => delete r._kp);
    return { res, q, a2, voies };
  }

  /* Fascicule 61 : tous les systèmes demandés.
   * o = {Lr, nDisp, yc, classe (facultatif), systemes:{AL,Bc,Bt,Mc80,Mc120,trottoir}, trottoirs:[[y1,y2]…], dif (diffusion
   *      transversale ajoutée aux impacts des roues, m), unitaireAL, delta (coefficient dynamique appliqué à B et M) } */
  function fasc61(m, o) {
    const g = f61Geom(o.Lr, o.nDisp === undefined ? 2 : o.nDisp, o.yc || 0);
    if (o.classe) g.classe = o.classe;
    const S = o.systemes || { AL: 1, Bc: 1, Bt: 1, Mc80: 1, Mc120: 1, trottoir: 1 };
    const dif = o.dif || 0, dB = o.deltaB || 1, dM = o.deltaM || 1, pas = o.pas || 0.05, out = { geom: g, cas: {} };
    const L = m.L;
    if (S.AL) { const r = chargeAL(m, g, { unitaire: o.unitaireAL }); out.cas.AL = { titre: 'A(l)', res: r.res, info: `q = ${o.unitaireAL ? '1 kN/m² (unitaire)' : (r.q).toFixed(3) + ' kN/m² = a2·A(L)'} · a1(n) ; ${g.Nv} voie(s) de ${g.v.toFixed(3)} m` }; }
    // Bc : files de 2 camions (1 ou 2 longitudinalement), au plus Nv files, roue à ≥ 0,25 m du bord de la largeur chargeable,
    // 0,50 m entre roues de camions voisins (entraxe des files ≥ 2,50 m), coefficient bc(n)
    if (S.Bc) {
      const veh = VEH.Bc(dif), lon2 = { nom: 'Bc', roues: veh.roues.concat(veh.roues.map((r) => Object.assign({}, r, { dx: r.dx - 10.5 }))) };
      const xs0 = range(0, L + 10.5, Math.max(0.25, L / 60));
      const cv = (vv) => ({ veh: vv, nMax: g.Nv, ecart: 2.5, coefN: (n) => dB * (o.sansBc ? 1 : bcF(g.classe, n)) * (n <= g.Nv ? 1 : 0), zone: [g.y1 + 1.25, g.y2 - 1.25], xs0, pas });
      const r1 = enveloppeConvoi(m, cv(veh)), r2 = enveloppeConvoi(m, cv(lon2)), res = vide(m);
      keepMax(res, r1, 'Bc'); keepMax(res, r2, 'Bc ×2');
      out.cas.Bc = { titre: 'Bc', res, info: `${o.sansBc ? 'bc non appliqué (à introduire dans les combinaisons)' : 'bc = ' + (BC[g.classe] ? BC[g.classe].join(' / ') : '1') + ' selon le nombre de files'}${dB !== 1 ? ` ; δ = ${dB.toFixed(3)}` : ''}` };
    }
    if (S.Bt && BT[g.classe]) {
      const xs0 = range(0.675, L - 0.675, Math.max(0.05, L / 120));
      const cv = { veh: VEH.Bt(dif), nMax: Math.min(2, g.Nv), ecart: 3.0, coefN: (n) => dB * (o.sansBc ? 1 : BT[g.classe]), zone: [g.y1 + 1.5, g.y2 - 1.5], xs0, pas };
      out.cas.Bt = { titre: 'Bt', res: enveloppeConvoi(m, cv), info: `bt = ${BT[g.classe]}` };
    }
    for (const [nom, c, e] of [['Mc80', 'Mc80', 'Me80'], ['Mc120', 'Mc120', 'Me120']]) {
      if (!S[nom]) continue;
      const res = vide(m);
      for (const vn of [c, e]) {
        const veh = VEH[vn](), w = veh.larg;
        const xs0 = vn[1] === 'c' ? range(0, L, Math.max(0.1, L / 60)) : range(0, L, Math.max(0.05, L / 120));
        const r = enveloppeConvoi(m, { veh, nMax: 1, ecart: 99, coefN: () => dM, zone: [g.y1 + w / 2, g.y2 - w / 2], xs0, pas });
        if (r) keepMax(res, r, vn);
      }
      out.cas[nom] = { titre: nom, res, info: `${c} et ${e}, un véhicule par travée${dM !== 1 ? ` ; δ = ${dM.toFixed(3)}` : ''}` };
    }
    // trottoirs : 1,5 kN/m² (charges générales, art. 13.1) sur l'un et/ou l'autre trottoir
    if (S.trottoir && o.trottoirs && o.trottoirs.length) {
      const q = o.qTrottoir || 1.5, res = vide(m);
      const ef = o.trottoirs.map(([a, b]) => m.effet([{ e1: a, e2: b, lon: [{ x1: 0, x2: L, P: q * (b - a) * L }] }]));
      for (let mask = 1; mask < (1 << ef.length); mask++) {
        res.forEach((r, i) => {
          let M = 0, KP = 0, P = 0; ef.forEach((e, j) => { if (mask & (1 << j)) { M += e.M[i]; KP += e.K[i] * e.P1; P += e.P1; } });
          if (M > r.Mmax) { r.Mmax = M; r.cfgMax = { trottoirs: mask }; } if (M < r.Mmin) { r.Mmin = M; r.cfgMin = { trottoirs: mask }; }
          if (KP / P > r.Kmax) { r.Kmax = KP / P; r.cfgK = { trottoirs: mask }; }
        });
      }
      out.cas.trottoir = { titre: 'Trottoirs', res, info: `${q} kN/m² sur l'un et/ou l'autre trottoir` };
    }
    return out;
  }

  /* EN 1991-2 LM1 : voies conventionnelles de 3 m placées et numérotées de façon défavorable (§4.2.4), TS centré dans
   * sa voie (§4.3.2 (1)a), UDL sur les parties défavorables de la voie et de l'aire résiduelle ; αQ, αq de l'AN française.
   * Programmation dynamique sur une grille transversale (cellules de « pas ») : état = ensemble des rangs de voies déjà
   * placées ; une voie occupe 3 m ; hors voies, aire résiduelle. */
  function lm1(m, o) {
    const w = o.w, y1 = (o.yc || 0) - w / 2, nl = Math.max(1, Math.floor(w / 3 + 1e-9)), pas = o.pas || 0.1;
    const cl = o.classe || 1, al = o.classe === 2 ? { Q: [0.9, 0.8, 0.8], q1: 0.7, qi: 1.0, qr: 1.0 } : { Q: [1, 1, 1], q1: 1, qi: 1.2, qr: 1.2 };
    const Qk = [300, 200, 100], L = m.L, nc = Math.round(w / pas), lc = Math.round(3 / pas);
    const res = vide(m);
    const xs0 = o.xsTS || [m.xs];
    // UDL de 1 kN/m² sur chaque cellule (toute la portée)
    const udl = Array.from({ length: nc }, (_, c) => m.effet([{ e1: y1 + c * pas, e2: y1 + (c + 1) * pas, lon: [{ x1: 0, x2: L, P: pas * L }] }]));
    const ncell = nc, nlUse = Math.min(nl, 6);
    for (const xt of xs0) {
      // TS unitaire (essieu de 1 kN : 2 roues 0,40 × 0,40 m à ±1,00 m, 2 essieux à 1,20 m) centré en c
      const dif = o.dif || 0, ts = (c) => m.effet([-1, 1].flatMap((dy) => [-0.6, 0.6].map((dx) => ({ e1: c + dy - (0.4 + dif) / 2, e2: c + dy + (0.4 + dif) / 2, lon: [{ x1: xt + dx - 0.2, x2: xt + dx + 0.2, P: 0.5 }] }))));
      const tsv = Array.from({ length: Math.max(0, ncell - lc + 1) }, (_, s) => ts(y1 + s * pas + 1.5));
      for (let i = 0; i < m.fibres.length; i++) {
        for (const sens of [1, -1]) {
          const u = udl.map((e) => sens * e.M[i]);
          // valeur d'une voie de rang r commençant à la cellule s
          const qr = [al.q1 * 9].concat(Array(5).fill(al.qi * 2.5)), Qr = Qk.map((q, k) => al.Q[k] * q).concat([0, 0, 0]);
          const res2 = 2.5 * al.qr;
          const lane = (r, s) => { let v = 0; for (let c = s; c < s + lc; c++) v += Math.max(0, qr[r] * u[c]); return v + Math.max(0, Qr[r] * 2 * sens * tsv[s].M[i]); };
          const nm = 1 << nlUse, NEG = -1e30;
          // dp[c][mask] meilleur à partir de la cellule c
          let next = new Float64Array(nm).fill(0); const table = [next];
          for (let c = ncell - 1; c >= 0; c--) {
            const cur = new Float64Array(nm);
            for (let mask = 0; mask < nm; mask++) {
              let best = Math.max(0, res2 * u[c]) + table[0][mask];
              if (c + lc <= ncell) for (let r = 0; r < nlUse; r++) if (!(mask & (1 << r))) { const t = table[lc - 1] ? table[lc - 1] : null; const nxt = (c + lc <= ncell) ? (table[lc - 1] !== undefined ? table[lc - 1][mask | (1 << r)] : 0) : NEG; const v = lane(r, c) + nxt; if (v > best) best = v; }
              cur[mask] = best;
            }
            table.unshift(cur); if (table.length > lc + 1) table.pop();
          }
          const v = sens * table[0][0];
          const r = res[i];
          if (sens > 0 && v > r.Mmax) { r.Mmax = v; r.cfgMax = { xTS: xt }; }
          if (sens < 0 && v < r.Mmin) { r.Mmin = v; r.cfgMin = { xTS: xt }; }
        }
      }
    }
    // K : voie 1 placée au plus défavorable (TS + UDL de la voie 1), rapporté à la charge de la voie 1
    for (let i = 0; i < m.fibres.length; i++) {
      let best = 0, bc = null;
      for (let s = 0; s + lc <= nc; s++) { let KP = 0, P = 0; for (let c = s; c < s + lc; c++) { KP += udl[c].K[i] * udl[c].P1 * al.q1 * 9; P += udl[c].P1 * al.q1 * 9; } const t = m.effet([-1, 1].map((dy) => ({ e1: y1 + s * pas + 1.5 + dy - 0.2, e2: y1 + s * pas + 1.5 + dy + 0.2, lon: [{ x1: 0, x2: L, P: al.Q[0] * 300 }] }))); KP += t.K[i] * t.P1; P += t.P1; if (KP / P > best) { best = KP / P; bc = y1 + s * pas + 1.5; } }
      res[i].Kmax = best; res[i].cfgK = { voie1: bc };
    }
    return { res, nl, classe: cl, info: `${nl} voie(s) conventionnelle(s) de 3 m sur ${w} m ; αQ = ${al.Q.join('/')}, αq1 = ${al.q1}, αqi = αqr = ${al.qi}` };
  }

  /* ponts-rails : voie d'excentricité ey ; largeur de répartition transversale au plan moyen de la dalle
   *  lt = ltrav + 2·(hb + hd/2)/4  (EN 1991-2 §6.3.6.3, diffusion 4:1 sous la traverse, prolongée jusqu'au plan moyen)
   * longitudinalement : LM71 = 4 essieux de 250 kN répartis uniformément sur 6,40 m (156,25 kN/m, §6.3.6.2 (2))
   * + 80 kN/m de part et d'autre ; SW/0 = 2 × 133 kN/m sur 15 m séparés de 5,30 m ; SW/2 = 2 × 150 kN/m sur 25 m
   * séparés de 7,00 m. Recherche de la position longitudinale la plus défavorable à la section xs. */
  function rail(m, o) {
    const lt = (o.ltrav || 2.25) + 2 * ((o.hb || 0) + (o.hd || 0) / 2) / 4, aC = o.alphaC || 1, phi = o.phi || 1, L = m.L;
    const out = [];
    for (const [iv, ey] of o.voies.entries()) {
      const e1 = ey - lt / 2, e2 = ey + lt / 2;
      const mk = (lon) => m.effet([{ e1, e2, lon }]);
      const conv = {};
      const pos = range(-L, 2 * L, Math.max(0.1, L / 120));
      // LM71 (UIC 71)
      const uic = (xc) => [{ x1: -1e3, x2: xc - 3.2, P: 80 * (xc - 3.2 + 1e3) }, { x1: xc - 3.2, x2: xc + 3.2, P: 1000 }, { x1: xc + 3.2, x2: xc + 3.2 + 1e3, P: 80e3 }];
      const sw = (q, a, c, x) => [{ x1: x, x2: x + a, P: q * a }, { x1: x + a + c, x2: x + 2 * a + c, P: q * a }];
      const families = { 'LM71+SW/0': [['LM71', uic, pos], ['SW/0', (x) => sw(133, 15, 5.3, x), range(-35.3, L, Math.max(0.1, L / 120))]], 'SW/2': [['SW/2', (x) => sw(150, 25, 7, x), range(-57, L, Math.max(0.1, L / 120))]] };
      for (const [fam, list] of Object.entries(families)) {
        if (o.convois && !o.convois[fam]) continue;
        const res = vide(m), coef = aC * phi * (fam === 'SW/2' ? 1 : 1);
        for (const [nom, f, ps] of list) {
          const cf = fam === 'SW/2' ? phi : coef;
          for (const x of ps) {
            const e = mk(f(x));
            e.M.forEach((v, i) => { const r = res[i]; v *= cf; if (v > r.Mmax) { r.Mmax = v; r.cfgMax = { convoi: nom, x }; } if (v < r.Mmin) { r.Mmin = v; r.cfgMin = { convoi: nom, x }; } });
          }
          const eK = mk([{ x1: 0, x2: L, P: L }]);
          eK.K.forEach((k, i) => { if (k > res[i].Kmax) { res[i].Kmax = k; res[i].cfgK = { ey }; } });
        }
        conv[fam] = res;
      }
      out.push({ voie: iv + 1, ey, lt, conv });
    }
    return { voies: out, lt };
  }

  /* superstructures : couches transversales [{nom, y1, y2, q (kN/m² ou, si lin, kN/m), gmax, gmin}] sur toute la portée ;
   * chaque couche est pondérée par gmax ou gmin selon le signe de sa contribution (charges amovibles). */
  function superstructures(m, couches) {
    const res = vide(m);
    let KPm = new Array(m.fibres.length).fill(0), Pm = 0;
    for (const c of couches) {
      if (!(c.y2 > c.y1) || !c.q) continue;
      const qa = c.lin ? c.q / (c.y2 - c.y1) : c.q;
      const e = m.effet([{ e1: c.y1, e2: c.y2, lon: [{ x1: 0, x2: m.L, P: qa * (c.y2 - c.y1) * m.L }] }]);
      e.M.forEach((v, i) => { res[i].Mmax += v * (v > 0 ? c.gmax : c.gmin); res[i].Mmin += v * (v < 0 ? c.gmax : c.gmin); });
      e.K.forEach((k, i) => { KPm[i] += k * e.P1 * c.gmax; }); Pm += e.P1 * c.gmax;
    }
    res.forEach((r, i) => { r.Kmax = Pm ? KPm[i] / Pm : 0; });
    return res;
  }

  /* ── 7. API pour les autres modules (RACBA-RAPO, RADBAN…) ──
   * K(p, y, e) : coefficient de répartition transversale à la fibre y pour une charge en ligne d'excentricité e
   * Kcharge(p, y, e1, e2) : K moyen pour une charge répartie uniformément sur [e1, e2]
   * enveloppe(p, charges) : calcul complet (voir calcul) */
  const Kpoint = (p, y, e) => Kalpha(p.alpha === undefined ? 1 : p.alpha, p.theta, y / p.b, e / p.b, p);
  function Kcharge(p, y, e1, e2, n = 64) { if (e2 - e1 < 1e-9) return Kpoint(p, y, e1); let s = 0; for (let i = 0; i < n; i++) s += Kpoint(p, y, e1 + (i + 0.5) * (e2 - e1) / n); return s / n; }

  /* calcul complet d'un tablier.
   * d = {L, larg (2b), alpha, theta, nu, N, pas, interp, hors, fibres, type:'route'|'rail',
   *      couches:[…] (superstructures), route:{Lr, nDisp, yc, trottoirs, systemes, dif, unitaireAL, deltaB, deltaM},
   *      ec:{w, yc, classe} (LM1), rail:{voies:[ey], hb, hd, ltrav, alphaC, phi}} */
  function calcul(d) {
    const b = d.larg / 2;
    const m = modele({ b, L: d.L, theta: d.theta, alpha: d.alpha, nu: d.nu, N: d.N, pas: d.pas, interp: d.interp, hors: d.hors, fibres: d.fibres, emin: d.emin, emax: d.emax, xs: d.xs });
    const out = { modele: m, b, cas: {} };
    if (d.couches && d.couches.length) out.cas.sup = { titre: 'Superstructures', res: superstructures(m, d.couches), info: 'pondérations max/min des charges amovibles' };
    if (d.type === 'route' && d.route) { const f = fasc61(m, d.route); out.geom = f.geom; Object.assign(out.cas, f.cas); }
    if (d.type === 'route' && d.ec) { const r = lm1(m, d.ec); out.cas.LM1 = { titre: 'LM1 (TS + UDL)', res: r.res, info: r.info }; }
    if (d.type === 'rail' && d.rail) {
      const r = rail(m, d.rail); out.lt = r.lt;
      for (const v of r.voies) for (const [fam, res] of Object.entries(v.conv)) out.cas[`V${v.voie} ${fam}`] = { titre: `${fam} — voie ${v.voie}`, res, info: `voie d'excentricité ${v.ey} m, largeur de répartition ${v.lt.toFixed(3)} m` };
      if (r.voies.length > 1) { // deux voies (ou plus) chargées simultanément (EN 1991-2 §6.8.1, tableau 6.10 : 2 voies chargées)
        const res = vide(m);
        for (const fam of ['LM71+SW/0', 'SW/2']) { const parts = r.voies.map((v) => v.conv[fam]).filter(Boolean); if (parts.length < 2) continue;
          res.forEach((x, i) => { const sMax = parts.reduce((a, p) => a + Math.max(0, p[i].Mmax), 0), sMin = parts.reduce((a, p) => a + Math.min(0, p[i].Mmin), 0); if (sMax > x.Mmax) { x.Mmax = sMax; x.cfgMax = { convoi: fam + ' sur toutes les voies' }; } if (sMin < x.Mmin) { x.Mmin = sMin; x.cfgMin = { convoi: fam + ' sur toutes les voies' }; } }); }
        out.cas.multi = { titre: 'Voies chargées simultanément', res, info: 'somme des effets défavorables de chaque voie (positions longitudinales indépendantes : majorant)' };
      }
    }
    // enveloppe générale des charges d'exploitation
    const env = vide(m);
    for (const [k, c] of Object.entries(out.cas)) if (k !== 'sup') keepMax(env, c.res, c.titre);
    out.env = env;
    return out;
  }

  /* lecture d'un fichier .don du programme d'origine (format « clé ;commentaire » puis valeur) */
  function lireDon(txt) {
    const lines = String(txt).replace(/\r/g, '').split('\n'), v = {};
    for (let i = 0; i < lines.length - 1; i++) {
      const l = lines[i]; if (/^\s*;/.test(l) || !l.trim()) continue;
      if (/^FIN_DICO/.test(l)) break;
      const key = l.split(/[\s;]/)[0]; if (!key) continue;
      const nxt = lines[i + 1]; if (nxt !== undefined && !/^\s*;/.test(nxt)) { v[key] = nxt.trim(); i++; }
    }
    const n = (k, d = 0) => { const x = parseFloat(String(v[k] || '').replace(',', '.')); return Number.isFinite(x) ? x : d; };
    const typ = n('typouv'), ch = n('typchexp');
    const d = {
      type: typ === 0 ? 'route' : 'rail', L: n('londalle'), larg: n('lardalle'), hd: n('epdalle'), ortho: n('dalortho'),
      nu: n('poisson'), alpha: n('alpha', 1), theta: n('teta'),
      enc: [n('larencg'), n('poiencg'), n('larencd'), n('poiencd')],
      sup: [1, 2, 3, 4, 5, 6, 7].map((k) => [n('larsup' + k), n('poisup' + k)]),
      hb: n('esoutra'), voies: [n('excv1'), n('excv2'), n('excv3')].slice(0, Math.max(1, Math.min(3, typ))), nVoies: typ,
      charges: ch, brut: v,
    };
    return d;
  }

  const api = { strip, Kexact, MUexact, Kalpha, MUalpha, rigDalle, rigPoutres, kRect, theta, alphaT, modele, placer, enveloppeConvoi,
    f61Geom, a1F, bcF, AL, VEH, chargeAL, fasc61, lm1, rail, superstructures, calcul, Kpoint, Kcharge, lireDon };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.gmslt = api; }
})(typeof window !== 'undefined' ? window : globalThis);
