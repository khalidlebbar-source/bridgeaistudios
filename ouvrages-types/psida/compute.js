/* PSIDA-EL — moteur de calcul (pont-dalle BA continu d'inertie constante, BAEL 91, Fascicule 61 titre II).
 * Unités SETRA : m, t, grade. Pur JS, sans dépendance. Expose globalThis.PSIDA.compute.
 */
(function (G) {
  'use strict';

  // ============================================================ outils numériques
  function solve(A, b) {
    const n = b.length; if (!n) return [];
    const M = A.map((r, i) => [...r, b[i]]);
    for (let i = 0; i < n; i++) {
      let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      [M[i], M[p]] = [M[p], M[i]];
      for (let k = 0; k < n; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  const cub = (c, x) => ((c[0] * x + c[1]) * x + c[2]) * x + (c[3] || 0);
  // intégrale de 0 à x d'un polynôme cubique A x^3 + B x^2 + C x + D
  const icub = (c, x) => c[0] * x ** 4 / 4 + c[1] * x ** 3 / 3 + c[2] * x * x / 2 + (c[3] || 0) * x;
  const add = (a, b, k = 1) => a.map((v, i) => v + k * (b[i] || 0));
  const GR = Math.PI / 200;

  // ============================================================ 1. caractéristiques géométriques
  function section(A7) {
    const H1 = A7.HDALLE1, H2 = A7.HDALLE2, H3 = A7.HDALLE3, E1 = A7.EDALLE1, E2 = A7.EDALLE2, E3 = A7.EDALLE3;
    // demi-section (x >= 0) : intrados nervure de 0 à E1/2 (cote 0), flanc oblique jusqu'à E1/2+E3/2 (cote H3),
    // encorbellement jusqu'à (E1+E2)/2, d'intrados linéaire de H3 à H1-H2 ; extrados plat à la cote H1.
    const xa = E1 / 2, xb = E1 / 2 + E3 / 2, xc = (E1 + E2) / 2;
    const P = [[0, 0], [xa, 0]];
    if (E3 > 0) P.push([xb, H3]); else P.push([xa, H3]);
    if (xc > xb) P.push([xc, H1 - H2]);
    P.push([xc, H1], [0, H1]);
    // polygone -> A, Sy, Ixx (axe horizontal y=0)
    let A = 0, S = 0, I0 = 0;
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
      const c = x1 * y2 - x2 * y1;
      A += c / 2; S += c * (y1 + y2) / 6; I0 += c * (y1 * y1 + y1 * y2 + y2 * y2) / 12;
    }
    A = Math.abs(A) * 2; S = Math.abs(S) * 2; I0 = Math.abs(I0) * 2;
    const yg = S / A, I = I0 - A * yg * yg;
    return { A, yg, v: H1 - yg, I, H: H1, Eeq: 12 * I / H1 ** 3, Eextr: E1 + E2, Eintr: E1 };
  }

  // ============================================================ 2. poutre continue : lignes d'influence
  function flexMat(L) {
    const m = L.length - 1, A = [];
    for (let j = 0; j < m; j++) {
      A.push(new Array(m).fill(0)); A[j][j] = 2 * (L[j] + L[j + 1]);
      if (j > 0) A[j][j - 1] = L[j]; if (j < m - 1) A[j][j + 1] = L[j + 1];
    }
    return A;
  }
  // LI du moment sur appui intérieur j (index 1..n-1) pour une force unité dans la travée s : cubique [A,B,C,0] en x relatif
  function supportLI(L) {
    const n = L.length, m = n - 1, F = flexMat(L);
    const res = []; // res[k][s] : appui k (0..n), travée s -> [A,B,C,0]
    for (let k = 0; k <= n; k++) res.push(L.map(() => [0, 0, 0, 0]));
    for (let s = 0; s < n; s++) {
      for (const [jj, c] of [[s, [1, 0, -1]], [s - 1, [-1, 3, -2]]]) {
        if (jj < 0 || jj >= m) continue;
        for (let k = 0; k < 3; k++) {
          const rhs = new Array(m).fill(0); rhs[jj] = L[s] ** 2 * c[k];
          const M = solve(F, rhs);
          for (let j = 0; j < m; j++) res[j + 1][s][k] += M[j];
        }
      }
    }
    return res;
  }
  // effet d'un moment unitaire imposé à l'appui d'extrémité (encorbellement d'about) sur les moments intérieurs
  function endMomentEffect(L, side) {
    const n = L.length, m = n - 1, F = flexMat(L), rhs = new Array(m).fill(0);
    if (m === 0) return [1, 1].map(() => 0) && new Array(n + 1).fill(0).map((_, k) => (side === 0 ? (k === 0 ? 1 : 0) : (k === n ? 1 : 0)));
    if (side === 0) rhs[0] = -L[0]; else rhs[m - 1] = -L[n - 1];
    const M = solve(F, rhs);
    const out = new Array(n + 1).fill(0); out[side === 0 ? 0 : n] = 1;
    for (let j = 0; j < m; j++) out[j + 1] = M[j];
    return out;
  }

  const SECT = [0, 0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 0.95, 1.00];

  function influence(L, about) {
    const n = L.length, SL = supportLI(L);
    const xs = [0]; for (const l of L) xs.push(xs[xs.length - 1] + l); // abscisses des appuis
    // ---- moments en travée : section a (relatif) de la travée i
    function momentLI(i, a) {
      const cols = [];
      for (let s = 0; s < n; s++) {
        const c = add(SL[i][s].map(v => v * (1 - a)), SL[i + 1][s].map(v => v * a));
        if (s === i) {
          const G1 = add(c, [0, 0, L[i] * (1 - a), 0]);              // force à gauche de la section
          const D1 = add(c, [0, 0, -L[i] * a, L[i] * a]);            // force à droite
          cols.push({ s, G: G1, D: D1 });
        } else cols.push({ s, c });
      }
      return cols;
    }
    // valeur de la LI de moment pour une force en (s, x)
    function evalM(cols, i, a, s, x) {
      const col = cols[s];
      if (s !== i) return cub(col.c, x);
      return x <= a ? cub(col.G, x) : cub(col.D, x);
    }
    // ---- effort tranchant à gauche (côté gauche) de la travée i : V = (Mr - Ml)/L + iso
    function shearLI(i) {
      return L.map((_, s) => {
        const c = add(SL[i + 1][s], SL[i][s], -1).map(v => v / L[i]);
        if (s === i) return add(c, [0, 0, -1, 1]); // D=1 quand force à droite de la section
        return c;
      });
    }
    const V = L.map((_, i) => shearLI(i));
    // ---- réactions : R_k = Vg(k) - Vd(k-1)
    const R = [];
    for (let k = 0; k <= n; k++) {
      R.push(L.map((_, s) => {
        let c = [0, 0, 0, 0];
        if (k < n) c = add(c, V[k][s]);
        if (k > 0) { let vd = V[k - 1][s]; if (s === k - 1) vd = add(vd, [0, 0, 0, -1]); c = add(c, vd, -1); }
        return c;
      }));
    }
    // ---- effet d'une force sur l'about (porte-à-faux de longueur about) : moments d'appui
    const em0 = endMomentEffect(L, 0), em1 = endMomentEffect(L, 1);
    return { L, n, xs, SL, momentLI, evalM, V, R, em0, em1, about };
  }

  // aires : ∫ de la LI (cubique en x relatif) * L
  function areaCub(c, l, x0 = 0, x1 = 1) { return (icub(c, x1) - icub(c, x0)) * l; }

  // zéros d'une cubique dans ]x0,x1[
  function zeros(f, x0, x1, N = 400) {
    const z = []; let a = x0, fa = f(a);
    for (let i = 1; i <= N; i++) {
      const b = x0 + (x1 - x0) * i / N, fb = f(b);
      if (fa === 0 && i > 1) z.push(a);
      else if (fa * fb < 0) { let lo = a, hi = b, flo = fa; for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2, fm = f(mid); if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; } } z.push((lo + hi) / 2); }
      a = b; fa = fb;
    }
    return z;
  }

  // ============================================================ 3. Guyon-Massonnet : plaque isotrope (alpha = 1)
  // Flèche d'une bande de largeur 2b, bords libres (coefficient de Poisson nu), sous une charge linéique sinusoïdale
  // d'harmonique m (longueur L) appliquée en y = e. Renvoie w(y) (D = 1).
  function plateLine(b, L, e, nu, m) {
    const B = m * Math.PI / L;
    const dG = (t, k) => {
      const s = t < 0 ? -1 : 1, a = Math.abs(t), E = Math.exp(-B * a), c = 4 * B ** 3;
      if (k === 0) return (1 + B * a) * E / c;
      if (k === 1) return s * (-B * B * a * E) / c;
      if (k === 2) return (-B * B * E + B ** 3 * a * E) / c;
      return s * (2 * B ** 3 * E - B ** 4 * a * E) / c;
    };
    const ch = y => Math.cosh(B * y), sh = y => Math.sinh(B * y);
    const H = [
      (y, k) => [ch(y), B * sh(y), B * B * ch(y), B ** 3 * sh(y)][k],
      (y, k) => [sh(y), B * ch(y), B * B * sh(y), B ** 3 * ch(y)][k],
      (y, k) => [y * sh(y), sh(y) + B * y * ch(y), 2 * B * ch(y) + B * B * y * sh(y), 3 * B * B * sh(y) + B ** 3 * y * ch(y)][k],
      (y, k) => [y * ch(y), ch(y) + B * y * sh(y), 2 * B * sh(y) + B * B * y * ch(y), 3 * B * B * ch(y) + B ** 3 * y * sh(y)][k],
    ];
    const rows = [], rhs = [];
    for (const yb of [-b, b]) {
      rows.push(H.map(h => h(yb, 2) - nu * B * B * h(yb, 0))); rhs.push(-(dG(yb - e, 2) - nu * B * B * dG(yb - e, 0)));
      rows.push(H.map(h => h(yb, 3) - (2 - nu) * B * B * h(yb, 1))); rhs.push(-(dG(yb - e, 3) - (2 - nu) * B * B * dG(yb - e, 1)));
    }
    const c = solve(rows, rhs);
    const w = (y, k = 0) => dG(y - e, k) + c.reduce((s, ci, i) => s + ci * H[i](y, k), 0);
    w.B = B;
    return w;
  }
  // Ligne d'influence du coefficient K de la fibre y (par réciprocité : flèche de la fibre y sous charge en e
  // = flèche en e sous charge en y). Les charges hors de la dalle équivalente (trottoirs, encorbellements)
  // utilisent le prolongement analytique de la solution.
  function Kline(Weq, Leq, y, nu) {
    const b = Weq / 2;
    const yy = Math.max(-b + 1e-9, Math.min(b - 1e-9, y));
    const w = plateLine(b, Leq, yy, nu || 0, 1);
    const k = 2 * b * w.B ** 4;
    return e => w(e) * k;
  }

  // ============================================================ 4. charges Fascicule 61 titre II
  const BC_AX = [[0, 6], [4.5, 12], [6, 12]];           // camion Bc (t) : avant, 2 arrière (abscisses)
  const BE_P = 16;   // système Be (F61 1960) : un essieu de 16 t (étalement imprimé d'un seul essieu ; HYPOTHÈSE calée sur 3827)
  const BT_AX = [[0, 16], [1.35, 16]];                  // tandem Bt
  function bcCoef(cl, nf, f1960) {
    if (f1960) return 1;
    const t = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1.0, 1.0, 1.0, 1.0, 1.0], 3: [1.0, 0.8, 0.8, 0.8, 0.8] };
    const r = (t[cl] || t[1]); return r[Math.min(nf, 5) - 1];
  }
  function a1Coef(cl, nv) {
    const t = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] };
    const r = t[cl] || t[1]; return r[Math.min(nv, r.length) - 1];
  }
  function v0Coef(cl) { return cl === 1 ? 3.5 : cl === 2 ? 3.0 : 2.75; }

  // poids maximal d'une file de camions Bc sur une longueur l (convoi de camions espacés de 4,5 m arrière-avant)
  function bcTrain(nTrucks) { const a = []; for (let t = 0; t < nTrucks; t++) { const o = t * 10.5; for (const [x, p] of BC_AX) a.push([o + x, p]); } return a; }
  function maxWeightOn(axles, len) {
    let best = 0;
    for (const [x0] of axles) for (const s of [x0, x0 - len]) {
      let w = 0; for (const [x, p] of axles) if (x >= s - 1e-9 && x <= s + len + 1e-9) w += p; best = Math.max(best, w);
    }
    return best;
  }

  // ============================================================ 5. calcul principal
  // LIGNINF = 1 : optimisation de l'épaisseur (message « LE PROGRAMME A AUGMENTE L'EPAISSEUR ... APRES OPTIMISATION »).
  // Règle reconstituée (3452, 3453, 3488) : épaisseur arrondie au cm supérieur, puis augmentée de 0,01 m (les flancs
  // H DALLE 3 absorbent l'augmentation, encorbellements inchangés) tant que, en fissuration peu préjudiciable,
  // μ = |Mu min| / (Eeq (0,9 H)² fbu) > 0,186 (fbu = 0,85 fcj / 1,5, pivot A/B). Fissuration préjudiciable :
  // critère non identifié (3488 : seul l'arrondi au cm est observé).
  function compute(model) {
    const A3 = model.lignes.A3, A7 = model.lignes.A7;
    if (A3.LIGNINF !== 1 || model._noOpt) return compute1(model);
    const H0 = A7.HDALLE1, clone = H => { const m2 = JSON.parse(JSON.stringify(model)); m2._noOpt = true; const b = m2.lignes.A7; b.HDALLE3 += H - b.HDALLE1; b.HDALLE1 = H; return m2; };
    let H = Math.ceil(H0 * 100 - 1e-6) / 100, r = compute1(clone(H));
    for (let k = 0; k < 60 && r.mat.fiss < 2; k++) {
      let Mn = 0; for (const sp of r.moments) for (const sc of sp) Mn = Math.min(Mn, sc.elu.min);
      const mu = -Mn / (r.section.Eeq * Math.pow(0.9 * H, 2) * 0.85 * r.mat.fcj / 1.5);
      if (mu <= 0.186 * (1 + 2e-4)) break;
      H = Math.round(H * 100 + 1) / 100; r = compute1(clone(H));
    }
    r.optim = { H0, H };
    return r;
  }
  function compute1(model) {
    const Lg = model.lignes;
    const A3 = Lg.A3, A5 = Lg.A5, A6 = Lg.A6, A7 = Lg.A7, A8 = Lg.A8, A9 = Lg.A9, A10 = Lg.A10, A11 = Lg.A11, A12 = Lg.A12, A13 = Lg.A13;
    const r = { warnings: [], _A7: Lg.A7, _A11: Lg.A11 };
    const n = A5.NT;
    const L = [A5.D1, A5.D2, A5.D3, A5.D4, A5.D5, A5.D6].slice(0, n);
    const about = A5.ABOUT, biais = A5.BIAIS;
    r.L = L; r.n = n; r.about = about; r.biais = biais;
    r.longueurTotale = L.reduce((a, b) => a + b, 0) + 2 * about;

    // --- section
    const sec = section(A7); r.section = sec;
    const W = A6.ETROTG + A6.EGAU + A6.ESURCH + A6.EDROI + A6.ETROTD; r.largeurTotale = W;
    r.profil = [A6.ETROTG, A6.EGAU, A6.ESURCH, A6.EDROI, A6.ETROTD];

    // --- matériaux
    const fcj = A9.FCJ, ftj = A9.FTJ;
    const Ei = 242318.34 * Math.cbrt(fcj), Ev = Ei / 3; // constantes recalées sur les listings (EV=80772,77 fcj^1/3)
    const genre = parseInt(A9.GENRE, 10) || 0;
    const fiss = Math.floor(genre / 100); // 1 peu préj., 2 préj., 3 très préj.
    const fe = [A10.FE1, A10.FE2, A10.FE3, A10.FE4], eta = [A10.ETA1, A10.ETA2, A10.ETA3, A10.ETA4];
    let sigS;
    if (genre % 100 === 1 && Lg.C1) sigS = [Lg.C1.SS1, Lg.C1.SS2, Lg.C1.SS3, Lg.C1.SS4];
    else if (fiss === 2) sigS = fe.map((f, i) => Math.min(2 / 3 * f, Math.max(0.5 * f, 110 * 100 * Math.sqrt(eta[i] * ftj / 100))));
    else if (fiss === 3) sigS = fe.map((f, i) => 0.8 * Math.min(2 / 3 * f, Math.max(0.5 * f, 110 * 100 * Math.sqrt(eta[i] * ftj / 100))));
    else sigS = null;
    r.mat = { fcj, ftj, Ev, Ei, Es: 20400000, sigBc: 0.6 * fcj, sigS, fiss, genre, poisson: A9.POISSON, retrait: A9.RETRAI, fe, eta,
      phi: [A10.PHI1, A10.PHI2, A10.PHI3, A10.PHI4] };

    // --- charges permanentes
    const masvol = A8.MASVOL > 0 ? A8.MASVOL : 2.5;
    const oss = sec.A * masvol;
    const ossMax = oss * (A8.OSMAX || 1), ossMin = oss * (A8.OSMIN || 1);
    const gMax = ossMax + A8.QSUPMAX, gMin = ossMin + A8.QSUPMIN;
    r.cp = { masvol, oss, ossMax, ossMin, qsupMax: A8.QSUPMAX, qsupMin: A8.QSUPMIN, ossMoy: (ossMax + ossMin) / 2,
      qsupMoy: (A8.QSUPMAX + A8.QSUPMIN) / 2, gMax, gMin, gMoy: (gMax + gMin) / 2 };

    // --- classe, voies
    const statut = parseInt(A8.STATUT, 10) || 0;
    const classe = Math.floor(statut / 100) || 1; r.statut = statut; r.classe = classe; r.f61_1960 = statut < 100;
    const Lch = A6.ESURCH;
    const nv = A6.NVOIE > 0 ? A6.NVOIE : (Lch < 6 ? (Lch >= 5 ? 2 : 1) : Math.floor(Lch / 3));
    r.nvoies = nv; r.v = Lch / nv; r.v0 = v0Coef(classe);
    const ce = String(A8.CE).padStart(3, '0');
    r.ce = { gen: +ce[0], exc: +ce[1], mil: +ce[2] };
    r.chargesC = [];
    if (r.ce.exc >= 1) r.chargesC.push('CVOI.D'); if (r.ce.exc >= 2) r.chargesC.push('CVOI.E');
    if (r.ce.mil === 3) r.chargesC.push('MC.80'); if (r.ce.mil === 4) r.chargesC.push('MC.120');
    r.nomBt = r.f61_1960 ? 'BE' : 'BT';
    r.pstrot = A8.PSTROT;

    // --- lignes d'appui (A13) : espacement = trunc2(EDALLE1/(NAP-0,6)/sin(biais))
    r.appuis = Array.from({ length: n + 1 }, (_, k) => {
      const nap = A13['NAP' + (k + 1)] || 0, typ = A13['TYPAP' + (k + 1)] || 0;
      const esp = nap > 1 ? Math.floor(100 * A7.EDALLE1 / (nap - 0.6) / Math.sin(biais * GR) + 1e-9) / 100 : 0;
      return { nap, typ, esp };
    });
    // --- lignes d'influence
    const LI = influence(L, about); r.LI = LI;
    r.liAppuis = []; for (let k = 1; k < n; k++) r.liAppuis.push({ k, coefs: LI.SL[k].map(c => c.slice(0, 3)),
      aires: L.map((l, s) => areaCub(LI.SL[k][s], l)) });
    // foyers
    // foyers : zéro du diagramme de la travée i pour une force tendant vers l'appui droit (foyer de gauche)
    // ou vers l'appui gauche (foyer de droite) — dérivées des LI d'appui aux extrémités de la travée
    r.foyers = L.map((l, i) => {
      const cl = LI.SL[i][i], cr = LI.SL[i + 1][i];
      const d1 = c => 3 * c[0] + 2 * c[1] + c[2], d0 = c => c[2];
      const Dl = d1(cl), Dr = d1(cr), El = d0(cl), Er = d0(cr);
      const g = i > 0 ? (-Dl) / (-Dl + Dr - l) * l : null;   // -Dl(1-x) - Dr x + l x = 0
      const d = i < n - 1 ? (El + l) / (El + l - Er) * l : null;
      return { g, d };
    });
    // moments en travée
    r.liTravee = L.map((l, i) => SECT.filter(a => a > 0 && a < 1).map(a => {
      const cols = LI.momentLI(i, a);
      const aires = cols.map(col => col.s === i ? areaCub(col.G, l, 0, a) + areaCub(col.D, l, a, 1) : areaCub(col.c, L[col.s]));
      const f = x => LI.evalM(cols, i, a, i, x);
      const z = zeros(f, 1e-6, 1 - 1e-6);
      let zero = null;
      if (z.length) {
        const x0 = z[0];
        const ag = (x0 <= a ? areaCub(cols[i].G, l, 0, x0) : areaCub(cols[i].G, l, 0, a) + areaCub(cols[i].D, l, a, x0));
        zero = { x: x0 * l, ag, ad: aires[i] - ag };
      }
      return { a, x: a * l, cols, aires, total: aires.reduce((p, q) => p + q, 0), zero };
    }));
    // efforts tranchants
    r.liV = L.map((l, i) => ({ coefs: LI.V[i].map(c => c.slice(0, 3)),
      airesG: L.map((ll, s) => areaCub(LI.V[i][s], ll)),
      airesD: L.map((ll, s) => areaCub(s === i ? add(LI.V[i][s], [0, 0, 0, -1]) : LI.V[i][s], ll)) }));
    // réactions
    r.liR = LI.R.map((cs, k) => {
      const aires = L.map((l, s) => areaCub(cs[s], l));
      let ab = 0;
      if (k === 0 || k === n) ab = aboutArea(LI, k, about, 0) + aboutArea(LI, k, about, 1);
      return { coefs: cs.map(c => c.slice(0, 3)), aires, about: ab, total: aires.reduce((p, q) => p + q, 0) + ab };
    });

    // --- dénivellations d'appui (1 cm) avec Ei
    const EI = Ei * sec.I;
    r.tass = settlements(L, EI, 0.01);
    r.tassProb = Array.from({ length: n + 1 }, (_, k) => A12['TP' + (k + 1)] || 0);
    r.tassAlea = Array.from({ length: n + 1 }, (_, k) => A12['DTP' + (k + 1)] || 0);
    r.young = A12.YOUNG || 3; r.ktp = A12.KTP;

    // --- portées équivalentes et coefficients de majoration dynamique
    r.Leq = L.map((l, s) => l * Math.pow(deflRatio(L, s), 0.25));
    r.cmd = L.map((l, s) => {
      const Gt = r.cp.gMoy * l;
      const o = { L: l, G: Gt };
      const Sbc = bcCoef(classe, nv) * Math.min(nv, 2 + 0 * nv) * 0 + bcCoef(classe, Math.min(nv, nfBc(Lch)), r.f61_1960) * Math.min(nv, nfBc(Lch)) * maxWeightOn(bcTrain(6), l);
      o.Sbc = Sbc; o.bc = dyn(l, Gt, Sbc);
      const Sbt = (classe <= 2 ? 1 : 0) * 32 * Math.min(nv, 2) * (classe === 2 ? 0.9 : 1);
      o.Sbt = Sbt; o.bt = o.bc; // Bt : même coefficient que Bc dans le listing SETRA
      const Smc = r.f61_1960 ? 100 : 110;
      o.Smc = Smc; o.mc = dyn(l, Gt, Smc);
      return o;
    });
    // sur appuis : appuis intermédiaires = enveloppe des travées adjacentes
    r.cmdAppui = Array.from({ length: n + 1 }, (_, k) => {
      const adj = [k - 1, k].filter(s => s >= 0 && s < n);
      return { bc: Math.max(...adj.map(s => r.cmd[s].bc)), mc: Math.max(...adj.map(s => r.cmd[s].mc)), end: k === 0 || k === n };
    });

    // --- coefficients de répartition transversale (Guyon-Massonnet)
    r.gm = L.map((l, s) => gmSpan(r, sec, W, r.Leq[s], A6));

    // --- enveloppes longitudinales (moments), efforts tranchants, réactions
    longitudinal(r, A6);
    // --- ferraillage (ferraillage.js : ferraillage longitudinal retenu, étriers, appareils d'appui…)
    if (G.PSIDA && G.PSIDA.computeFer) G.PSIDA.computeFer(model, r);
    return r;
  }

  // ============================================================ 6. charges mobiles sur la poutre continue
  // Fonction d'influence globale (abscisse X cumulée depuis l'appui 1) ; f(X) = 0 hors des travées.
  function spanOf(r, X) { const xs = r.LI.xs; let s = 0; while (s < r.n - 1 && X > xs[s + 1]) s++; return s; }
  function mkMomentLI(r, i, a) {
    const LI = r.LI, L = r.L, xs = LI.xs, Lt = xs[r.n];
    const cols = LI.momentLI(i, a);
    return X => { if (X < 0 || X > Lt) return 0; const s = spanOf(r, X); return LI.evalM(cols, i, a, s, (X - xs[s]) / L[s]); };
  }
  function mkCubicLI(r, cs, jump) { // cs[s] = cubique ; jump : {s, a} discontinuité (D) à l'abscisse relative a
    const L = r.L, xs = r.LI.xs, Lt = xs[r.n];
    return X => { if (X < 0 || X > Lt) return 0; const s = spanOf(r, X); const x = (X - xs[s]) / L[s];
      const c = cs[s]; let v = ((c[0] * x + c[1]) * x + c[2]) * x; if (c[3]) v += (jump && jump.s === s ? (x > jump.a ? c[3] : 0) : c[3]); return v; };
  }
  // prolongement d'une LI sur les abouts (porte-à-faux) : g(M) = effet des moments d'appui M ; extra = terme propre
  function withAbout(r, f, g, extra) {
    const a = r.about, Lt = r.LI.xs[r.n];
    if (!(a > 0)) return f;
    const h = X => {
      if (X < 0 && X >= -a - 1e-9) { const u = -X; return g(r.LI.em0.map(v => -u * v)) + (extra ? extra(0, u) : 0); }
      if (X > Lt && X <= Lt + a + 1e-9) { const u = X - Lt; return g(r.LI.em1.map(v => -u * v)) + (extra ? extra(1, u) : 0); }
      return f(X);
    };
    h.about = true; return h;
  }
  // facteur par travée (coefficient K de la travée × majoration dynamique)
  function spanFactor(r, key, dkey) { return s => r.gm[s].coef[key] * (dkey ? r.cmd[s][dkey] : 1); }

  // Grille de positionnement SETRA : points à 0,05 L de chaque travée (prolongée hors ouvrage au pas L1/20, Ln/20)
  function posGrid(r) {
    const g = new Set(), xs = r.LI.xs, L = r.L, n = r.n;
    for (let s = 0; s < n; s++) for (let k = 0; k <= 20; k++) g.add(+(xs[s] + L[s] * k / 20).toFixed(6));
    for (let k = 1; k <= 400; k++) { const v = -L[0] * k / 20; if (v < -40) break; g.add(+v.toFixed(6)); }
    for (let k = 1; k <= 400; k++) { const v = xs[n] + L[n - 1] * k / 20; if (v > xs[n] + 40) break; g.add(+v.toFixed(6)); }
    if (r.about > 0) { g.add(+(-r.about).toFixed(6)); g.add(+(xs[n] + r.about).toFixed(6)); }
    return [...g].sort((a, b) => a - b);
  }
  // valeur d'un véhicule dont l'extrémité gauche est en x ; axles = [[dx, P]] (dx >= 0)
  function vehVal(r, f, axles, fac, x) {
    const Lt = r.LI.xs[r.n]; let v = 0;
    const ab = f.about ? r.about : 0;
    for (const [d, p] of axles) { const X = x + d; if (X >= -ab - 1e-9 && X <= Lt + ab + 1e-9) v += p * f(X) * fac((f.spanAt || (Y => spanOf(r, Y)))(Math.min(Math.max(X, 0), Lt))); }
    return v;
  }
  // balayage discret : un essieu (ou une extrémité) sur un point de grille ; 2 véhicules d'écart >= gap
  function vehicleScan(r, f, axles, fac, step, nmax, gap, anchors, exactGap) {
    const grid = r._grid || (r._grid = posGrid(r));
    const offs = anchors || axles.map(a => a[0]);
    const cand = new Set();
    for (const g of grid) for (const d of offs) cand.add(+(g - d).toFixed(6));
    const xs = [...cand].sort((a, b) => a - b);
    const vals = xs.map(x => vehVal(r, f, axles, fac, x));
    const res = {};
    const Lt = r.LI.xs[r.n], span = Math.max(...axles.map(q => q[0])), ab = f.about ? r.about : 0;
    const ok = x => x + span > -ab + 1e-9 && x < Lt + ab + 1e-9;   // véhicule (au moins en partie) sur l'ouvrage
    for (const sg of [1, -1]) {
      let b1 = -Infinity, p1 = null, b2 = -Infinity, p2 = null;
      for (let i = 0; i < xs.length; i++) {
        if (!ok(xs[i])) continue;
        const v = sg * vals[i];
        if (v > b1 + 1e-6 * Math.max(1, Math.abs(b1 === -Infinity ? 0 : b1))) { b1 = v; p1 = [xs[i]]; }
        if (nmax > 1) {
          if (exactGap && ok(xs[i] + gap)) { const w = v + sg * vehVal(r, f, axles, fac, xs[i] + gap); if (w > b2 + 1e-6 * Math.max(1, Math.abs(b2 === -Infinity ? 0 : b2))) { b2 = w; p2 = [xs[i], xs[i] + gap]; } }
          for (let j = i + 1; j < xs.length; j++) {
            if (xs[j] - xs[i] < gap - 1e-6 || !ok(xs[j])) continue;
            const w = v + sg * vals[j]; if (w > b2 + 1e-6 * Math.max(1, Math.abs(b2 === -Infinity ? 0 : b2))) { b2 = w; p2 = [xs[i], xs[j]]; }
          }
        }
      }
      let best = b1, pos = p1; if (p2 && b2 >= b1 - 1e-6 * Math.max(1, Math.abs(b1 === -Infinity ? 0 : b1))) { best = b2; pos = p2; }
      if (pos && pos.length === 2) { const c = pos.map(x => sg * vehVal(r, f, axles, fac, x)); if (c[1] > c[0] + 1e-9) pos = [pos[1], pos[0]]; }
      res[sg > 0 ? 'max' : 'min'] = { v: best > 0 ? sg * best : 0, pos: best > 0 ? pos : null };
    }
    return res;
  }
  // charge répartie A(l) : longueurs chargées de même signe (toutes combinaisons de travées entières)
  function Al(l) { return 0.23 + 36 / (l + 12); }
  // segments de signe constant de la LI (coupure aux zéros) : {s, x0, x1, l, area}
  function signSegments(r, f) {
    const segs = [], xs = r.LI.xs;
    for (let s = 0; s < r.n; s++) {
      const a = xs[s], b = xs[s + 1], N = 400, cuts = [a];
      let pa = f(a + 1e-9);
      for (let k = 1; k <= N; k++) {
        const x = a + (b - a) * k / N, v = f(k === N ? x - 1e-9 : x);
        if (pa * v < 0) { let lo = x - (b - a) / N, hi = x; for (let it = 0; it < 50; it++) { const m = (lo + hi) / 2; if (f(m) * pa > 0) lo = m; else hi = m; } cuts.push((lo + hi) / 2); }
        if (v !== 0) pa = v;
      }
      cuts.push(b);
      for (let k = 0; k + 1 < cuts.length; k++) {
        const x0 = cuts[k], x1 = cuts[k + 1], M = 60; let ar = 0; const h = (x1 - x0) / M;
        for (let j = 0; j < M; j++) { const u = x0 + h * j; ar += (f(u + 1e-12) + 4 * f(u + h / 2) + f(u + h - 1e-12)) * h / 6; }
        segs.push({ s, x0, x1, l: x1 - x0, area: ar });
      }
    }
    return segs;
  }
  function aLoadSegments(r, segs, trans) {
    const out = {};
    for (const sg of ['pos', 'neg']) {
      const cand = segs.filter(g => (sg === 'pos' ? g.area > 0 : g.area < 0));
      let best = 0, bestSet = [];
      const K = cand.length;
      for (let mask = 1; mask < (1 << K); mask++) {
        let l = 0, ar = 0; const set = [];
        for (let k = 0; k < K; k++) if (mask & (1 << k)) { l += cand[k].l; ar += cand[k].area * trans(cand[k].s); set.push(cand[k]); }
        const v = Al(l) * ar;
        if (sg === 'pos' ? v > best : v < best) { best = v; bestSet = set; }
      }
      out[sg] = { v: best, segs: bestSet };
    }
    return out;
  }
  function aLoadEnvelope(r, areasBySpan, trans) {
    // areasBySpan[s] = {pos, neg} aires positives/négatives de la LI dans la travée s
    const n = r.n, out = {};
    for (const sg of ['pos', 'neg']) {
      let best = 0, bestSet = null;
      for (let mask = 1; mask < (1 << n); mask++) {
        let l = 0, ar = 0; const set = [];
        for (let s = 0; s < n; s++) if (mask & (1 << s)) { l += r.L[s]; ar += areasBySpan[s][sg] * trans(s); set.push(s); }
        const v = Al(l) * ar;
        if (sg === 'pos' ? v > best : v < best) { best = v; bestSet = set; }
      }
      out[sg] = { v: best, spans: bestSet };
    }
    return out;
  }
  function posNegAreas(f, x0, x1, N = 200) {
    let p = 0, q = 0; const h = (x1 - x0) / N;
    // Simpson par sous-intervalles avec séparation de signe approximée
    for (let k = 0; k < N; k++) {
      const a = x0 + k * h, b = a + h, fa = f(a + 1e-12), fm = f(a + h / 2), fb = f(b - 1e-12);
      const v = (fa + 4 * fm + fb) * h / 6;
      if (fa >= 0 && fb >= 0 && fm >= 0) p += v; else if (fa <= 0 && fb <= 0 && fm <= 0) q += v;
      else { // intervalle contenant un zéro : découpe fine
        const M = 40; for (let j = 0; j < M; j++) { const u = f(a + (j + 0.5) * h / M) * h / M; if (u > 0) p += u; else q += u; }
      }
    }
    return { pos: p, neg: q };
  }

  const MC1960 = { P: 100, len: 4.5, gap: 0, n: 1 };   // char 1960 : un seul char de 100 t, chenilles de 4,5 m (étalement imprimé)
  const MC120 = { P: 110, len: 6.1, gap: 36.2 }, MC80 = { P: 72, len: 4.9, gap: 30.5 + 4.9 };
  const CV_OFF = 0.425;   // v9 (avec LI interpolée au pas imprimé 0,5) ; v8 : 0,375 avec intégration continue
  const CV_OFF_V8 = 0.375;   // décalage de l'axe des convois D/E vers la fibre (3 pas de 0,125 m ; calage)
  const CVD = { P: 140, len: 11, gap: 18.75 }, CVE = { P: 200, len: 15, gap: 32.75 }; // 2 remorques (F61 II art. 10)

  function liveEffects(r, f, A6, dynOverride, extraSegs, kOne) {
    const n = r.n, L = r.L, xs = r.LI.xs, Lt = xs[n];
    const step = 0.05;
    // aires par travée
    const fa = f.base || f;
    const ar = L.map((l, s) => posNegAreas(fa, xs[s], xs[s + 1]));
    const out = {};
    // charge A
    const kA = s => (kOne ? 1 : r.gm[s].coef.A) * r.a2 * r.Lch;
    out.A = aLoadSegments(r, signSegments(r, fa).concat(extraSegs || []), kA);
    // trottoirs (toutes travées de même signe)
    const wt = r.pstrot * (A6.ETROTG + A6.ETROTD);
    const kT = s => kOne ? 1 : r.gm[s].coef.trot, ex = extraSegs || [];
    out.T = { max: ar.reduce((p, a, s) => p + a.pos * wt * kT(s), 0) + ex.reduce((p, g) => p + Math.max(0, g.area) * wt, 0),
      min: ar.reduce((p, a, s) => p + a.neg * wt * kT(s), 0) + ex.reduce((p, g) => p + Math.min(0, g.area) * wt, 0) };
    // Bc : nfMax files de 2 camions
    const nf = r.gm[0].fibres[0].nfMax;
    const truckL = [[0, 6], [4.5, 12], [6, 12]], truckR = [[0, 12], [1.5, 12], [6, 6]]; // DG : avant à gauche ; GD : avant à droite
    const bcF = kOne ? (sp => bcCoef(r.classe, nf, r.f61_1960) * dynOverride.bc) : dynOverride ? (sp => r.gm[sp].coef.Bc * dynOverride.bc) : spanFactor(r, 'Bc', 'bc');
    const bcL = vehicleScan(r, f, truckL, bcF, step, 2, 10.5, [0], true), bcR = vehicleScan(r, f, truckR, bcF, step, 2, 10.5, [0], true);
    const pickB = (a, b, sg) => (sg > 0 ? (a.max.v >= b.max.v ? [a.max, 'DG'] : [b.max, 'GD']) : (a.min.v <= b.min.v ? [a.min, 'DG'] : [b.min, 'GD']));
    const [bcMax, dMax] = pickB(bcL, bcR, 1), [bcMin, dMin] = pickB(bcL, bcR, -1);
    const ntMax = Math.min(2, r.nvoies);
    const btF = kOne ? (sp => (r.classe === 2 && !r.f61_1960 ? 0.9 : 1) * dynOverride.bc) : dynOverride ? (sp => r.gm[sp].coef.Bt * dynOverride.bc) : spanFactor(r, 'Bt', 'bc');
    const BTX = r.f61_1960 ? [[0, BE_P]] : [[0, 16], [1.35, 16]];
    let bt = vehicleScan(r, f, BTX, btF, step, 1, 0, [0]);
    if (kOne) { const b2 = vehicleScan(r, f, BTX, btF, step, 1, 0, [r.f61_1960 ? 0 : 1.35]);
      bt = { max: b2.max.v > bt.max.v ? b2.max : bt.max, min: b2.min.v < bt.min.v ? b2.min : bt.min }; }
    const Bc = { max: nf * bcMax.v, min: nf * bcMin.v }, Bt = { max: ntMax * bt.max.v, min: ntMax * bt.min.v };
    out.B = {
      max: Bc.max >= Bt.max ? { v: Bc.max, typ: 'BC', sens: dMax, pos: bcMax.pos } : { v: Bt.max, typ: r.nomBt, sens: 'DG', pos: bt.max.pos },
      min: Bc.min <= Bt.min ? { v: Bc.min, typ: 'BC', sens: dMin, pos: bcMin.pos } : { v: Bt.min, typ: r.nomBt, sens: 'DG', pos: bt.min.pos },
    };
    // charges particulières
    const ce = [];
    const mcDef = r.ce.mil === 4 ? (r.f61_1960 ? MC1960 : MC120) : r.ce.mil === 3 ? MC80 : null;
    if (mcDef) {
      const N = 400, ax = []; for (let k = 0; k < N; k++) ax.push([mcDef.len * (k + 0.5) / N, mcDef.P / N]);
      const mc = vehicleScan(r, f, ax, kOne ? (sp => dynOverride.mc) : dynOverride ? (sp => r.gm[sp].coef.Mc * dynOverride.mc) : spanFactor(r, 'Mc', 'mc'), step, mcDef.n || 2, mcDef.gap, [0]);
      ce.push({ nom: r.ce.mil === 4 ? 'MC.120' : 'MC.80', ...mc });
    }
    for (const [nom, d] of [['CVOI.D', CVD], ['CVOI.E', CVE]]) if (r.chargesC.includes(nom)) {
      const N = 40, ax = []; for (let k = 0; k < N; k++) ax.push([d.len * (k + 0.5) / N, d.P / N]);
      const cv = vehicleScan(r, f, ax, kOne ? (sp => 1) : spanFactor(r, 'CV', null), step, 2, d.gap, [0]);
      ce.push({ nom, ...cv });
    }
    let cmax = { v: 0, nom: '' }, cmin = { v: 0, nom: '' };
    for (const c of ce) { if (c.max.v > cmax.v) cmax = { v: c.max.v, nom: c.nom, pos: c.max.pos }; if (c.min.v < cmin.v) cmin = { v: c.min.v, nom: c.nom, pos: c.min.pos }; }
    out.C = { max: cmax, min: cmin };
    out.Bc = Bc; out.Bt = Bt; out.CE = ce;
    return out;
  }

  function combine(r, G, T, live) {
    // G : {up, dn} ; T : tassement (>= 0) ; live : {A, B, C, T(trot)}
    const gq = r.gamma;
    const posA = Math.max(0, live.A.pos.v), negA = Math.min(0, live.A.neg.v);
    const posB = Math.max(0, live.B.max.v), negB = Math.min(0, live.B.min.v);
    const posC = Math.max(0, live.C.max.v), negC = Math.min(0, live.C.min.v);
    const els = {
      max: G.up + T + live.T.max + Math.max(gq.sA * posA, gq.sB * posB, gq.sC * posC),
      min: G.dn - T + live.T.min + Math.min(gq.sA * negA, gq.sB * negB, gq.sC * negC),
    };
    const elu = {
      max: gq.f3 * (Math.max(gq.g1 * G.up, gq.g2 * G.up) + gq.uT * T + gq.uTr * live.T.max + Math.max(gq.uA * posA, gq.uB * posB, gq.uC * posC)),
      min: gq.f3 * (Math.min(gq.g1 * G.dn, gq.g2 * G.dn) - gq.uT * T + gq.uTr * live.T.min + Math.min(gq.uA * negA, gq.uB * negB, gq.uC * negC)),
    };
    return { els, elu };
  }

  function settlementEffect(r, coefBySupport) {
    // coefBySupport[k] : effet d'une dénivellation de 1 cm de l'appui k (déjà avec Ei)
    const mod = 1 / r.young;
    const n = r.n; let prob = 0; for (let k = 0; k <= n; k++) prob += coefBySupport[k] * mod * r.tassProb[k] / 0.01;
    const al = coefBySupport.map((c, k) => Math.abs(c * mod * r.tassAlea[k] / 0.01)).sort((a, b) => b - a);
    return Math.abs(prob) + (al[0] || 0) + (al[1] || 0);
  }

  function longitudinal(r, A6) {
    const n = r.n, L = r.L;
    r.Lch = A6.ESURCH; r.a2 = Math.min(1, r.v0 / r.v);
    r.gamma = { sA: 1.2, sB: 1.2, sC: 1.0, f3: 1.125, g1: 1.2, g2: 0.9, uT: 1.2, uTr: 1.42, uA: 1.42, uB: 1.42, uC: 1.2 };
    const gMax = r.cp.gMax, gMin = r.cp.gMin;
    // effet des dénivellations sur les moments en section (i, a) : interpolation des moments d'appui
    const tassM = (i, a) => Array.from({ length: n + 1 }, (_, k) => (1 - a) * r.tass.M[k][i] + a * r.tass.M[k][i + 1]);
    r.moments = L.map((l, i) => SECT.map(a => {
      const f = mkMomentLI(r, i, a);
      const xs = r.LI.xs; let I = 0; for (let s = 0; s < n; s++) { const pn = posNegAreas(f, xs[s], xs[s + 1], 60); I += pn.pos + pn.neg; }
      const G = { up: Math.max(gMax * I, gMin * I), dn: Math.min(gMax * I, gMin * I) };
      const T = settlementEffect(r, tassM(i, a));
      const live = liveEffects(r, f, A6);
      const comb = combine(r, G, T, live);
      return { a, x: r.LI.xs[i] + a * l, G, T, live, ...comb };
    }));
    // ouvrage symétrique : SETRA ne calcule que la première moitié des travées ; les suivantes sont l'image miroir
    if (L.every((l, i) => Math.abs(l - L[n - 1 - i]) < 1e-9)) for (let i = 0; i < n; i++) { const j = n - 1 - i; if (j >= i) continue;
      r.moments[i] = r.moments[i].map(sc => { const m = r.moments[j].find(t => Math.abs(t.a - (1 - sc.a)) < 1e-9); return m ? { ...m, a: sc.a, x: sc.x } : sc; }); }
    steelSections(r);
    shearsAndReactions(r, A6);
    deformations(r);
    flexionTransversale(r, A6);
    if (r.flexT) r.flexT.forEach((F, sp) => { F.my = momentsTransversaux(r, F, F.fibres, A6, sp); if (F.fibres0) F.my0 = momentsTransversaux(r, F, F.fibres0, A6, sp); });
  }

  // ============================================================ 10. flexion transversale (Guyon-Massonnet, harmoniques 1-3-5)
  // μ_m(y, e) = My/b pour une charge linéique sinusoïdale d'harmonique m en e (coordonnées de la travée droite
  // équivalente). Au-delà du bord de l'intrados (|e| > e1 = EDALLE1/(2 sin ψ)) : charge sur encorbellement ramenée au
  // bord de la nervure (force + couple) → prolongement linéaire de pente = corde [e1, e1 + 0,125] (pas d'étude
  // de la ligne d'influence, guide PSIDP annexe 6 § 3.2.2.2). Reproduit les LI imprimées à 1e-4.
  function muLine(b, L, y, m, nu, e1) {
    nu = nu || 0;
    const cache = new Map();
    const exact = e => { const k = e.toFixed(9); if (!cache.has(k)) { const w = plateLine(b, L, Math.max(-b + 1e-9, Math.min(b - 1e-9, e)), nu, m); cache.set(k, -(w(y, 2) - nu * w.B * w.B * w(y, 0)) / b); } return cache.get(k); };
    const h = 0.125;
    return e => {
      const a = Math.abs(e), sg = Math.sign(e);
      if (a <= e1) return exact(e);
      const v1 = exact(sg * e1), v2 = exact(sg * (e1 + h));
      return v1 + (a - e1) * (v2 - v1) / h;
    };
  }
  function flexionTransversale(r, A6) {
    const sec = r.section, b = sec.Eeq / 2, W = r.largeurTotale, H = sec.H;
    const e0 = 0.25 + 2 * A6.HCHAU + H, e1 = 2 * A6.HCHAU + H;
    const Leqmin = Math.min(...r.Leq);
    r.flexT = r.L.map((l, sp) => {
      const Leq = r.Leq[sp], psi = mechSkew(r.biais, sec.Eeq, l);
      const A1 = sec.Eeq / Math.sin(psi * GR), A2 = A1 / Leq;
      const term = c => [1, 3, 5].map(m => { const x = m * Math.PI * Math.min(c, Leq) / (2 * Leq); return Math.sin(x) / x; });
      const etal = [['CHARGE REPARTIE', Leq], ['BC', 1.5 + e0], [r.nomBt, (r.f61_1960 ? 0 : 1.35) + e0]];
      for (const c of r.chargesC) etal.push([c, /CVOI/.test(c) ? Math.min(Leqmin, (c === 'CVOI.D' ? CVD : CVE).len + e1) : (c === 'MC.120' ? (r.f61_1960 ? 4.5 : 6.1) : 4.9) + e1]);
      const bS = A1 / 2, LS = Leq * Math.sin(psi * GR);   // travée droite équivalente (biais)
      const sP = Math.sin(psi * GR), eInt = r._A7.EDALLE1 / 2 / sP;
      // abscisses imprimées perpendiculaires à l'axe (e) ; coordonnées de la plaque équivalente = e / sin ψ
      const mkFib = nu => [{ n: 1, f: 0 }, { n: 2, f: 0.5 }, { n: 4, f: 0.75 }].slice(0, A6.NF >= 3 ? 3 : A6.NF >= 2 ? 2 : 1).map(fb => {
        const yP = -Math.min(fb.f * bS, eInt);   // fibre de rive limitée au bord de l'intrados (3637)
        const mus = [1, 3, 5].map(m => { const mu = muLine(bS, LS, yP, m, nu, eInt); return e => mu(e / sP); });
        const H3 = mus.map(mu => { const vals = []; for (let e = -W / 2; e <= W / 2 + 1e-9; e += 0.5) vals.push(mu(e)); return { vals, star: mu(yP * sP) }; });
        return { n: fb.n, y: yP * sP, yP, mus, H: H3 };
      });
      const fibres = mkFib(r.mat.poisson);
      const fibres0 = r.mat.poisson ? mkFib(0) : null;
      return { psi, Leq, Weq: sec.Eeq, A1, A2, LS, bS, theta: bS / LS, sinPsi: sP, eInt, etal: etal.map(([nom, c]) => ({ nom, c: Math.min(c, Leq), t: term(c) })), fibres, fibres0 };
    });
  }
  // Moments transversaux My en milieu de travée (guide PSIDP, annexe 6 § 3.2.2) :
  //   charges réparties  My = p · A1 · Σ Bm·Dm, Dm = aire de μm sur la zone chargée (pas 0,125 m) ;
  //   charges roulantes  My = δ · P · A2 · Σ Bm·Dm, Dm = Σ μm aux files de roues (B) / moyenne sur la chenille (Mc).
  //   CP : max = Gmax / Eeq sur la dalle équivalente, min = Gmin / largeur d'extrados sur l'extrados.
  //   A : par voie (a1, a2, A(L) de la travée) ; trottoirs : 3·PSTROT, trottoir par trottoir ;
  //   Bc/Bt : max = un groupe de camions accolés, min = groupes gauche + droite (b_c du nombre total).
  function momentsTransversaux(r, F, fibres, A6, sp) {
    const W = r.largeurTotale, h = 0.125, A1 = F.A1, A2 = F.A2, cl = r.classe;
    const sn = e => -W / 2 + Math.round((e + W / 2) / 0.125 - 1e-9) * 0.125;   // grille de la LI (pas 0,125 depuis le bord d'extrados)
    const x0r = -W / 2 + A6.ETROTG + A6.EGAU, x0 = sn(x0r), x1 = sn(x0r + A6.ESURCH), Lch = A6.ESURCH;
    const term = nom => (F.etal.find(e => e.nom === nom) || F.etal[0]).t;
    const trap = (f, a, b) => { const n = Math.max(1, Math.round((b - a) / h)); let t = 0; for (let i = 0; i <= n; i++) t += (i === 0 || i === n ? 0.5 : 1) * f(a + i * (b - a) / n); return t * (b - a) / n; };
    // intégrale exacte de la ligne d'influence tabulée (pas h depuis le bord gauche de l'extrados, interpolation linéaire)
    const intPL = (f, a, b, h = 0.125) => { const o = -W / 2, g = e => { const k = Math.floor((e - o) / h + 1e-9), e0 = o + k * h, t = (e - e0) / h; return t < 1e-12 ? f(e0) : f(e0) * (1 - t) + f(e0 + h) * t; };
      const pts = [a]; for (let k = Math.ceil((a - o) / h - 1e-9); o + k * h < b - 1e-9; k++) if (o + k * h > a + 1e-9) pts.push(o + k * h); pts.push(b);
      let t = 0; for (let i = 0; i < pts.length - 1; i++) t += (g(pts[i]) + g(pts[i + 1])) / 2 * (pts[i + 1] - pts[i]); return t; };
    const dyn = r.cmd[sp] || {};
    const nv = r.nvoies, v = Lch / nv;
    const bcN = n => bcCoef(cl, n, r.f61_1960);
    const out = fibres.map(fb => {
      const Z = B => e => fb.mus.reduce((t, mu, j) => t + B[j] * mu(e), 0);
      const Zr = Z(term('CHARGE REPARTIE'));
      const res = { n: fb.n };
      // charges permanentes
      const be = r.section.Eeq / 2;
      const cMax = r.cp.gMax / r.section.Eeq * A1 * intPL(Zr, -be, be), cMin = r.cp.gMin / W * A1 * trap(Zr, -W / 2, W / 2);
      res.cp = { max: cMax, min: cMin };
      // charge A
      const q = Al(r.L[sp]) * r.a2;
      const lanes = []; for (let k = 0; k < nv; k++) lanes.push(q * A1 * trap(Zr, sn(x0r + k * v), sn(x0r + (k + 1) * v)));
      let aMax = { v: 0, n: 0 }, aMin = { v: 0, n: 0 };
      for (let msk = 1; msk < (1 << nv); msk++) { let t = 0, n = 0; for (let k = 0; k < nv; k++) if (msk & (1 << k)) { t += lanes[k]; n++; }
        const val = a1Coef(cl, n) * t; if (val > aMax.v + 1e-12) aMax = { v: val, n }; if (val < aMin.v - 1e-12) aMin = { v: val, n }; }
      res.A = { max: aMax, min: aMin };
      // trottoirs (3 × PSTROT)
      const tr = [];
      if (A6.ETROTG > 0) tr.push(3 * r.pstrot * A1 * trap(Zr, -W / 2, sn(-W / 2 + A6.ETROTG)));
      if (A6.ETROTD > 0) tr.push(3 * r.pstrot * A1 * trap(Zr, sn(W / 2 - A6.ETROTD), W / 2));
      res.T = { max: tr.filter(x => x > 0).reduce((a, b) => a + b, 0), min: tr.filter(x => x < 0).reduce((a, b) => a + b, 0) };
      // systèmes B : groupes de véhicules accolés
      const groups = (Zb, nMax, wV, wheels, coef, P, d) => {
        const S = [];   // S[n] = [{x, s}]
        for (let n = 1; n <= nMax; n++) { S[n] = []; for (let k = 0; x0 + k * h <= x1 - n * wV + 1e-9; k++) { const x = x0 + k * h; let t = 0; for (let f = 0; f < n; f++) for (const w of wheels) t += Zb(x + f * wV + w); S[n].push({ x, s: t }); } }
        let mx = { v: 0, n: 0 }, mn = { v: 0, n: 0 };
        for (let n = 1; n <= nMax; n++) for (const g of S[n]) { const val = coef(n) * P * A2 * d * g.s; if (val > mx.v) mx = { v: val, n }; }
        // minimum : groupe gauche + groupe droit (éventuellement vide)
        for (let nL = 0; nL <= nMax; nL++) for (let nR = 0; nL + nR <= nMax; nR++) { if (!nL && !nR) continue;
          const GL = nL ? S[nL] : [{ x: x0 - 1e9, s: 0 }];
          for (const gl of GL) { const xe = nL ? gl.x + nL * wV : x0; const GR = nR ? S[nR].filter(g => g.x >= xe - 1e-9) : [{ s: 0 }];
            for (const gr of GR) { const val = coef(nL + nR) * P * A2 * d * (gl.s + gr.s); if (val < mn.v) mn = { v: val, n: nL + nR }; } } }
        return { max: mx, min: mn };
      };
      const nfMax = Math.min(nv, nfBc(Lch));
      const bc = groups(Z(term('BC')), nfMax, 2.5, [0.25, 2.25], bcN, 12, dyn.bc || 1);
      const f60 = r.f61_1960, wT = f60 ? 2.5 : 3, sT = f60 ? 1.5 : 2;
      const ntMax = Math.max(1, Math.min(2, nv, Math.floor((Lch + (f60 ? 2.5 - sT - 1 : 0) + 1e-9) / wT)));
      const bt = groups(Z(term(r.nomBt)), ntMax, wT, [0.5, 0.5 + sT], () => (cl === 2 && !f60 ? 0.9 : 1), f60 ? BE_P / 2 : 16, dyn.bt || 1);   // Be (1960) : étalement d'un seul essieu imprimé → P = 8 t (HYPOTHÈSE)
      res._bc = bc; res._bt = bt;
      res.B = { max: bc.max.v >= bt.max.v ? { ...bc.max, typ: 'BC' } : { ...bt.max, typ: r.nomBt },
        min: bc.min.v <= bt.min.v ? { ...bc.min, typ: 'BC' } : { ...bt.min, typ: r.nomBt } };
      if (!res.B.max.v) res.B.max.typ = ''; if (!res.B.min.v) res.B.min.typ = '';
      // charges C
      let cMx = { v: 0, nom: '' }, cMn = { v: 0, nom: '' };
      for (const nom of r.chargesC) {
        const Zc = Z(term(nom)); let mx = 0, mn = 0;
        if (/^MC/.test(nom)) {
          const mean = a => { let t = 0; for (let i = 0; i <= 8; i++) t += (i === 0 || i === 8 ? 0.5 : 1) * Zc(a + i / 8); return t / 8; };
          for (let k = 0; x0 + k * h <= x1 - 4.25 + 1e-9; k++) { const x = x0 + k * h, val = (dyn.mc || 1) * (r.f61_1960 ? 50 : 55) * A2 * (mean(x) + mean(x + 3.25)); mx = Math.max(mx, val); mn = Math.min(mn, val); }
        } else {
          // convoi D/E : remorque de 3,30 m, densité P/longueur, axe à ±0,40 m de l'axe de la chaussée (calage 3826/3827,
          // règle exacte non retrouvée)
          const cv = nom === 'CVOI.D' ? CVD : CVE, cE = (F.etal.find(e => e.nom === nom) || {}).c || F.Leq, w = G.PSIDA_CVWID || 3.3, p = cv.P / cv.len / w * Math.min(1, cE / F.Leq), xc = (x0 + x1) / 2;   // charge contenue dans l'étalement 2c
          const cvo = G.PSIDA_CVOFF != null ? G.PSIDA_CVOFF : (G.PSIDA_CV_V8 ? CV_OFF_V8 : CV_OFF); for (const off of [-cvo, cvo]) { const x = xc + off - w / 2, val = p * A1 * (G.PSIDA_CV_V8 && !G.PSIDA_CVPL ? trap(Zc, x, x + w) : intPL(Zc, x, x + w, G.PSIDA_CVPL || 0.5)); mx = Math.max(mx, val); mn = Math.min(mn, val); }
        }
        if (mx > cMx.v) cMx = { v: mx, nom }; if (mn < cMn.v) cMn = { v: mn, nom };
      }
      res.C = { max: cMx, min: cMn };
      const els = (g, t, a, b, c, sg) => g + t + (sg > 0 ? Math.max(1.2 * a, 1.2 * b, c) : Math.min(1.2 * a, 1.2 * b, c));
      const elu = (gx, gn, t, a, b, c, sg) => 1.125 * ((sg > 0 ? Math.max(1.2 * gx, 0.9 * gn) : Math.min(1.2 * gx, 0.9 * gn)) + 1.42 * t + (sg > 0 ? Math.max(1.42 * a, 1.42 * b, 1.2 * c) : Math.min(1.42 * a, 1.42 * b, 1.2 * c)));
      res.els = { max: els(cMax, res.T.max, aMax.v, res.B.max.v, cMx.v, 1), min: els(cMin, res.T.min, aMin.v, res.B.min.v, cMn.v, -1) };
      res.elu = { max: elu(cMax, cMin, res.T.max, aMax.v, res.B.max.v, cMx.v, 1), min: elu(cMax, cMin, res.T.min, aMin.v, res.B.min.v, cMn.v, -1) };
      return res;
    });
    return out;
  }
  // biais mécanique (mise à jour SETRA du dossier PSI-DA, pièce 2.1 § 2.2.1) :
  // ψ = φ si λ ≥ 2 ; ψ = φ + (100 − φ)(1 − 0,5 λ)² sinon, λ = largeur biaise (Eeq/sin φ) / portée biaise
  function mechSkew(phi, Weq, L) {
    if (phi >= 100) return 100;
    const lam = Weq / Math.sin(phi * GR) / L;
    return lam >= 2 ? phi : phi + (100 - phi) * Math.pow(1 - 0.5 * lam, 2);
  }


  // ============================================================ 9. déformations (flèches, ε fibre inférieure, rotations)
  function deformations(r) {
    const n = r.n, L = r.L, EI = r.mat.Ei * r.section.I, yinf = r.section.H / 2; // dalle rectangulaire équivalente
    const F = flexMat(L);
    const supU = qs => { const rhs = new Array(n - 1).fill(0); qs.forEach((q, s) => { const c = -(L[s] ** 3) / 4 * q; if (s < n - 1) rhs[s] += c; if (s > 0) rhs[s - 1] += c; }); return [0, ...solve(F, rhs), 0]; };
    const supP = (s, a, P) => { const M = new Array(n + 1).fill(0); for (let k = 1; k < n; k++) { const c = r.LI.SL[k][s]; M[k] = P * ((c[0] * a + c[1]) * a + c[2]) * a; } return M; };
    // cas : {Ms, q[s], pt:{s,a,P}} -> flèche (mm, vers le haut +), moment M(span,x)
    const mk = (Ms, qs, pt) => {
      const Mx = (sp, xi) => { const l = L[sp]; let m = Ms[sp] * (1 - xi) + Ms[sp + 1] * xi + qs[sp] * l * l * xi * (1 - xi) / 2;
        if (pt && pt.s === sp) { const A = pt.a * l; m += xi * l <= A ? pt.P * (l - A) * xi : pt.P * A * (1 - xi); } return m; };
      const v = (sp, xi) => { const l = L[sp], x = xi * l; let w = qs[sp] * x * (l ** 3 - 2 * l * x * x + x ** 3) / (24 * EI);
        if (pt && pt.s === sp) { const A = pt.a * l, B = l - A; w += x <= A ? pt.P * B * x * (l * l - B * B - x * x) / (6 * l * EI) : pt.P * A * (l - x) * (l * l - A * A - (l - x) ** 2) / (6 * l * EI); }
        w += (Ms[sp] * l * l / 6 * xi * (1 - xi) * (2 - xi) + Ms[sp + 1] * l * l / 6 * xi * (1 - xi * xi)) / EI; return -w; };
      return { Mx, v };
    };
    const g = r.cp.gMoy, qsG = L.map(() => g);
    const cases = [mk(supU(qsG), qsG, null)];
    for (let j = 0; j < n; j++) {
      const q = Al(L[j]) * r.Lch * r.a2, qs = L.map((_, s) => (s === j ? q : 0));
      cases.push(mk(supU(qs), qs, null));
      cases.push(mk(supP(j, 0.5, 48), L.map(() => 0), { s: j, a: 0.5, P: 48 }));
    }
    const k = r.mat.Ei / r.mat.Ev;
    r.deformations = L.map((l, sp) => {
      const fl = []; for (let t = 0; t <= 10; t++) { const xi = t / 10; const vals = cases.map(c => c.v(sp, xi) * 1000); fl.push([xi, vals[0], vals[0] * k, ...vals.slice(1)]); }
      const eps = cases.map(c => { let s2 = 0; const N = 200; for (let t = 0; t < N; t++) s2 += c.Mx(sp, (t + 0.5) / N); return s2 / N * yinf / EI * 1e4; });
      const rot = cases.map(c => { const h = 1e-5; return [(c.v(sp, h) - c.v(sp, 0)) / (h * l) * 1e3, (c.v(sp, 1) - c.v(sp, 1 - h)) / (h * l) * 1e3]; });
      return { fl, eps: [eps[0], eps[0] * k - r.mat.retrait * 1e4, ...eps.slice(1)], rotG: [rot[0][0], rot[0][0] * k, ...rot.slice(1).map(x => x[0])], rotD: [rot[0][1], rot[0][1] * k, ...rot.slice(1).map(x => x[1])] };
    });
  }

  // ============================================================ 8. efforts tranchants sur appuis et réactions
  function shearsAndReactions(r, A6) {
    const n = r.n, LI = r.LI, gq = r.gamma;
    const area = f => { let I = 0; for (let s = 0; s < n; s++) { const pn = posNegAreas(f, LI.xs[s], LI.xs[s + 1], 60); I += pn.pos + pn.neg; } return I; };
    r.effortsTranchants = r.L.map((l, i) => ['g', 'd'].map(side => {
      const cs = LI.V[i].map((c, s) => (s === i && side === 'd') ? add(c, [0, 0, 0, -1]) : c);
      const f = side === 'g' ? mkCubicLI(r, cs, { s: i, a: 0 }) : mkCubicLI(r, cs, { s: i, a: 1 });
      const Xs = LI.xs[i], Xe = LI.xs[i + 1];   // essieu sur l'appui : valeur du côté de la travée (limite)
      const fx = side === 'g' ? (X => (Math.abs(X - Xs) < 1e-7 ? f(Xs + 1e-9) : f(X))) : (X => (Math.abs(X - Xe) < 1e-7 ? f(Xe - 1e-9) : f(X)));
      const I = area(f);
      const G = { up: Math.max(r.cp.gMax * I, r.cp.gMin * I), dn: Math.min(r.cp.gMax * I, r.cp.gMin * I) };
      fx.base = f; if (side === 'g') fx.spanAt = X => spanOf(r, Math.abs(X - Xs) < 1e-7 ? Xs + 1e-9 : X);   // charges réparties (aires) : LI d'origine
      const live = liveEffects(r, fx, A6);
      const c = combine(r, G, 0, live);
      return { side, G, live, ...c };
    }));
    // effort tranchant en section courante (a relatif) de la travée i
    r.shearAt = (i, a) => {
      const f = mkCubicLI(r, LI.V[i], { s: i, a });
      const g = X => { const s = spanOf(r, X); return (s === i && (X - LI.xs[i]) / r.L[i] > a) ? f(X) : (s === i ? f(X) - 0 : f(X)); };
      // V(section a) = V_iso part : c + D(x>a) ; D intégré dans mkCubicLI via jump
      const I = area(f);
      const G = { up: Math.max(r.cp.gMax * I, r.cp.gMin * I), dn: Math.min(r.cp.gMax * I, r.cp.gMin * I) };
      const live = liveEffects(r, f, A6);
      return { G, live, ...combine(r, G, 0, live) };
    };
    // réactions : sans majoration dynamique ni tassements (notice SETRA)
    r.reactions = Array.from({ length: n + 1 }, (_, k) => {
      const f0 = mkCubicLI(r, LI.R[k], { s: k, a: 0 });
      const f1 = withAbout(r, f0, M => (k < n ? (M[k + 1] - M[k]) / r.L[k] : 0) - (k > 0 ? (M[k] - M[k - 1]) / r.L[k - 1] : 0),
        (side, u) => ((side === 0 && k === 0) || (side === 1 && k === n) ? 1 : 0));
      // seul l'about contigu à l'appui étudié est chargeable (OA26 : minima nuls sur une travée unique)
      const LtR = LI.xs[n], f = globalThis.PSIDA_ABOUT_ALL ? f1 : Object.assign(X => ((X < 0 && k !== 0) || (X > LtR && k !== n)) ? 0 : f1(X), { about: f1.about });
      const I = area(f0) + (k === 0 || k === n ? r.liR[k].about : 0);
      const G = { up: Math.max(r.cp.gMax * I, r.cp.gMin * I), dn: Math.min(r.cp.gMax * I, r.cp.gMin * I) };
      const ab = k === 0 || k === n ? [{ s: k === 0 ? 0 : n - 1, l: r.about, area: r.liR[k].about }] : [];
      const live = liveEffects(r, f, A6, { bc: 1, mc: 1 }, ab, true);
      const c = combine(r, G, 0, live);
      return { k, G, live, ...c };
    });
    // ouvrage symétrique : réactions de la seconde moitié = image miroir (calcul SETRA sur la première moitié)
    if (r.L.every((l, i) => Math.abs(l - r.L[n - 1 - i]) < 1e-9)) for (let k = 0; k <= n; k++) if (n - k < k) r.reactions[k] = { ...r.reactions[n - k], k };
  }

  // ============================================================ 7. sections d'acier longitudinales (BAEL 91)
  // ELU : diagramme rectangulaire simplifié (0,8 y), fbu = 0,85 fcj / 1,3 (recalé : 52/52 sections sur 3826, 0063, 3603…),
  // fsu = fe / 1,15 ; ELS : σs limite, n = 15, calcul exact de l'axe neutre (section rectangulaire).
  function asELU(M, b, d, mat) {
    if (!(M > 0)) return 0;
    const fbu = 0.85 * mat.fcj / 1.3, fsu = mat.fe[0] / 1.15;
    const mu = Math.min(M / (b * d * d * fbu), 0.4999);
    const al = 1.25 * (1 - Math.sqrt(1 - 2 * mu));
    return M / (d * (1 - 0.4 * al) * fsu);
  }
  function asELS(M, b, d, ss) {
    if (!(M > 0) || !ss) return { As: 0, y: 0 };
    const n = 15; let lo = 1e-6, hi = d * 0.99999;
    for (let k = 0; k < 100; k++) { const y = (lo + hi) / 2; const m = b * y * y * ss / (2 * n * (d - y)) * (d - y / 3); if (m > M) hi = y; else lo = y; }
    const y = lo, sb = ss * y / (n * (d - y));
    return { As: b * y * sb / (2 * ss), y, sb };
  }
  // hauteur utile provisoire (pages MOMENTS ... SECTIONS D'ACIER) : H − enrobage − max(φ1, φ2 + φ1/2) − φ4/2
  // largeurs de calcul : aciers inférieurs = largeur totale (table comprimée) ; aciers supérieurs = largeur moyenne
  // de l'intrados sur une hauteur comprimée forfaitaire de 0,3 H (E1 + E3·min(0,3H, H3)/(2 H3)).
  function steelGeom(r) {
    const A7 = r._A7, A11 = r._A11, ph = r.mat.phi, H = r.section.H;
    const c = Math.max(ph[0], ph[1] + ph[0] / 2) + ph[3] / 2;
    const yc = 0.3 * H, H3 = A7.HDALLE3;
    const bS = A7.EDALLE1 + (H3 > 0 ? A7.EDALLE3 * Math.min(yc, H3) / (2 * H3) : 0);
    const mm = v => Math.round(v * 1000 + 1e-7) / 1000; // hauteurs utiles arrondies au mm (3607 : 0,7065 -> 0,707)
    return { H, dI: mm(H - A11.ENROBI - c), dS: mm(H - A11.ENROBS - c), bI: r.largeurTotale, bS };
  }
  function steelSections(r) {
    const mat = r.mat, g = steelGeom(r);
    const ss = mat.fiss >= 2 && mat.sigS ? mat.sigS[0] : null;
    r.ferLong = Object.assign({}, g);
    const { dI, dS, bI, bS } = g;
    for (const sp of r.moments) for (const s of sp) {
      const one = (Mels, Melu) => ({
        els: Mels > 0 ? asELS(Mels, bI, dI, ss).As : Mels < 0 ? asELS(-Mels, bS, dS, ss).As : 0,
        elu: Melu > 0 ? asELU(Melu, bI, dI, mat) : Melu < 0 ? asELU(-Melu, bS, dS, mat) : 0 });
      // ligne 1 : moments maximaux (aciers inférieurs si > 0) ; ligne 2 : moments minimaux (aciers supérieurs si < 0)
      const a = one(s.els.max, s.elu.max), b = one(s.els.min, s.elu.min);
      s.as = { elsMax: s.els.max > 0 ? a.els : 0, eluMax: s.elu.max > 0 ? a.elu : 0, elsMin: s.els.min < 0 ? b.els : 0, eluMin: s.elu.min < 0 ? b.elu : 0 };
    }
  }
  function nfBc(Lch) { return Math.max(1, Math.floor(Lch / 2.5)); }
  function dyn(L, Gt, S) { return 1 + 0.4 / (1 + 0.2 * L) + 0.6 / (1 + 4 * Gt / S); }

  function fociLeft(L, i) { // foyer de gauche de la travée i (rapport de foyer)
    let phi = 0; for (let j = 1; j <= i; j++) phi = 1 / (2 + 2 * L[j - 1] / L[j] - phi * L[j - 1] / L[j]) ;
    return phi * L[i];
  }
  function fociRight(L, i) {
    const n = L.length; let phi = 0; for (let j = n - 2; j >= i; j--) phi = 1 / (2 + 2 * L[j + 1] / L[j] - phi * L[j + 1] / L[j]);
    return L[i] - phi * L[i];
  }

  // aire de la LI de réaction sur la longueur d'about (force sur le porte-à-faux)
  function aboutArea(LI, k, a, side) {
    if (!(a > 0)) return 0;
    const n = LI.n, L = LI.L; const em = side === 0 ? LI.em0 : LI.em1;
    // force unité à distance u au-delà de l'appui d'extrémité : moment d'appui extrême = -u, propagé par em
    const R = u => {
      const M = em.map(v => -u * v);
      const supp = side === 0 ? 0 : n;
      // réaction = (V à droite) - (V à gauche) avec V travée i = (M[i+1]-M[i])/L[i]
      let Rk = 0;
      if (k < n) Rk += (M[k + 1] - M[k]) / L[k];
      if (k > 0) Rk -= (M[k] - M[k - 1]) / L[k - 1];
      if (k === supp) Rk += 1;
      return Rk;
    };
    const N = 20; let s = 0; for (let i = 0; i < N; i++) s += R(a * (i + 0.5) / N); return s * a / N;
  }

  function settlements(L, EI, d) {
    const n = L.length, m = n - 1, F = flexMat(L);
    const Ms = [], Rs = [];
    for (let k = 0; k <= n; k++) {
      const vv = new Array(n + 1).fill(0); vv[k] = d;
      const rhs = []; for (let j = 0; j < m; j++) { const a = (vv[j + 1] - vv[j]) / L[j], b = (vv[j + 2] - vv[j + 1]) / L[j + 1]; rhs.push(-6 * EI * (b - a)); }
      const M = [0, ...solve(F, rhs), 0]; Ms.push(M);
      const R = []; for (let j = 0; j <= n; j++) { let v = 0; if (j < n) v += (M[j + 1] - M[j]) / L[j]; if (j > 0) v -= (M[j] - M[j - 1]) / L[j - 1]; R.push(v); }
      Rs.push(R);
    }
    // Ms[k][j] : moment sur appui j dû à une dénivellation de l'appui k
    return { M: Ms, R: Rs };
  }

  function deflRatio(L, s) {
    const n = L.length, m = n - 1, F = flexMat(L), rhs = new Array(m).fill(0);
    if (s < m) rhs[s] += -(L[s] ** 3) / 4; if (s > 0) rhs[s - 1] += -(L[s] ** 3) / 4;
    const M = m ? solve(F, rhs) : []; const Ml = s > 0 ? M[s - 1] : 0, Mr = s < m ? M[s] : 0; const l = L[s];
    return (5 * l ** 4 / 384 + (Ml + Mr) * l * l / 16) / (5 * l ** 4 / 384);
  }

  // ------------------------------------------------------------ Guyon-Massonnet par travée
  function gmSpan(r, sec, W, Leq, A6) {
    const Weq = sec.Eeq, b = Weq / 2;
    const theta = b / Leq;
    // repère : y mesuré depuis l'axe mécanique ; bord gauche du tablier en -W/2 (profil symétrique supposé si SYMTAB)
    const yL = -W / 2;
    const xTG = yL + A6.ETROTG, xCh0 = xTG + A6.EGAU, xCh1 = xCh0 + A6.ESURCH;
    const fibres = [];
    const yEdgeCh = xCh0; // bord de la largeur chargeable
    const yf1 = Math.max(-b, -(W / 2 - A6.ETROTG)); // fibre de rive : bord de la dalle équivalente ou du trottoir
    fibres.push({ y: -b, lib: 'FIBRE ' + (-b).toFixed(2) + "M DE L'AXE DE L'EXTRADOS" });
    fibres.push({ y: yf1, lib: 'FIBRE ' + yf1.toFixed(2) + "M DE L'AXE DE L'EXTRADOS" });
    fibres.push({ y: 0, lib: 'AXE DE LA CHAUSSEE' });
    const nv = r.nvoies, cl = r.classe, Lch = A6.ESURCH;
    const out = fibres.map(f => {
      const K = Kline(Weq, Leq, f.y);
      const N = Math.round(W / 0.125);
      const ligne = []; for (let i = 0; i <= N + 2; i++) ligne.push(K(yL + 0.125 * i));
      // ligne d'influence tabulée au pas de 0,125 m depuis le bord gauche de l'extrados : les bornes des zones chargées
      // et les positions des véhicules sont prises sur cette grille (guide PSIDP annexe 6 § 2 ; 3639 : bord de chaussée
      // à −3,00 m → nœud −2,975 m).
      const h = 0.125, sn = e => yL + Math.round((e - yL) / h - 1e-9) * h;
      const mean = (a, c) => { a = sn(a); c = sn(c); const m = Math.round((c - a) / h); if (m <= 0) return K(a); let t = 0; for (let i = 0; i <= m; i++) t += (i === 0 || i === m ? 0.5 : 1) * K(a + i * h); return t / m; };
      const meanC = (a, c, m = 200) => { let t = 0; for (let i = 0; i < m; i++) t += K(a + (c - a) * (i + 0.5) / m); return t / m; };
      const meanW = (a, w) => { let t = 0; const m = 8; for (let i = 0; i <= m; i++) t += (i === 0 || i === m ? 0.5 : 1) * K(a + i * w / m); return t / m; };
      const g0 = sn(xCh0), g1 = sn(xCh1);
      const res = { y: f.y, lib: f.lib, ligne };
      // trottoirs (les deux chargés)
      const tg = A6.ETROTG > 0 ? meanC(yL, xTG) : null, td = A6.ETROTD > 0 ? meanC(xCh1 + A6.EDROI, -yL) : null;
      res.trot = tg != null && td != null ? (tg + td) / 2 : (tg ?? td ?? 0);
      // charge A : meilleure combinaison de voies adjacentes (i voies de largeur v), coefficient a1
      const v = Lch / nv; let bestA = { v: 0 };
      for (let k = 1; k <= nv; k++) for (let p = 0; p + k <= nv; p++) {
        const val = a1Coef(cl, k) * k / nv * mean(xCh0 + p * v, xCh0 + (p + k) * v);
        if (val > bestA.v) bestA = { v: val, k };
      }
      res.A = bestA.v; res.nA = bestA.k;
      // Bc : files de 2,5 m, roues à 2 m, distance au bord 0,25 m ; positions sur la grille
      const nfMax = Math.min(nv, nfBc(Lch));
      let bestBc = { v: 0 };
      for (let nf = 1; nf <= nfMax; nf++) for (let x = g0; x <= g1 - 2.5 * nf + 1e-9; x += h) {
        let s = 0; for (let f2 = 0; f2 < nf; f2++) { const o = x + 0.25 + f2 * 2.5; s += K(o) + K(o + 2); }
        const val = bcCoef(cl, nf, r.f61_1960) * s / (2 * nfMax); if (val > bestBc.v) bestBc = { v: val, nf };
      }
      res.Bc = bestBc.v; res.nBc = bestBc.nf; res.nfMax = nfMax;
      // Bt : tandems de 3 m, roues à 2 m, 0,5 m du bord ; F61 1960 : système Be (2 véhicules, roues à 1,5 m,
      // entraxe 2,5 m, 0,5 m du bord — calage sur 3827)
      let bestBt = { v: 0 };
      const be = r.f61_1960, wT = be ? 2.5 : 3, sT = be ? 1.5 : 2, dT = 0.5;
      const ntMax = Math.max(1, Math.min(2, nv, Math.floor((Lch + (be ? 2.5 - sT - 2 * dT : 0) + 1e-9) / wT)));
      for (let nt = 1; nt <= ntMax; nt++) for (let x = g0; x <= g1 - (2 * dT + sT + (nt - 1) * wT) + 1e-9; x += h) {
        let s = 0; for (let f2 = 0; f2 < nt; f2++) { const o = x + dT + f2 * wT; s += K(o) + K(o + sT); }
        const val = (cl === 2 && !be ? 0.9 : 1) * s / (2 * ntMax); if (val > bestBt.v) bestBt = { v: val, nt };
      }
      res.Bt = bestBt.v;
      // Mc120 : 2 chenilles de 1 m, entraxe 3,25 m (3,30 m arrondi au pas de la grille)
      let bestMc = 0;
      for (let x = g0; x <= g1 - 4.25 + 1e-9; x += h) bestMc = Math.max(bestMc, (meanW(x, 1) + meanW(x + 3.25, 1)) / 2);
      res.Mc = bestMc;
      // convois D / E : remorque de 3,30 m, axe décalé de 0,50 m vers la fibre (calage listings)
      res.CV = f.y === 0 ? meanC(-1.65, 1.65) : meanC(Math.sign(f.y) * 0.5 - 1.65, Math.sign(f.y) * 0.5 + 1.65);
      return res;
    });
    // fibre la plus sollicitée par cas de charge
    const pick = key => Math.max(...out.map(o => o[key]));
    return { Leq, theta, Weq, fibres: out, coef: { trot: pick('trot'), A: pick('A'), Bc: pick('Bc'), Bt: pick('Bt'), Mc: pick('Mc'), CV: pick('CV') } };
  }

  const api = { compute, section, influence, plateLine, Kline, SECT, _solve: solve, asELS, asELU, steelGeom };
  G.PSIDA = Object.assign(G.PSIDA || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
