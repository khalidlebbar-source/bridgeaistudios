/* Modèles de charges d'exploitation et enveloppes par lignes d'influence.
 * Ferroviaires : UIC 71 (EN 1991-2 §6.3.2 / Livret 2.01), SW/0, SW/2, train à vide, coefficients dynamiques Φ2, Φ3.
 * Routières    : EN 1991-2 LM1 (TS + UDL, coefficients α de l'annexe nationale française), LM2,
 *                Fascicule 61 titre II : A(l), Bc, Bt, Br, Mc80, Mc120 et coefficient de majoration dynamique δ.
 * Unités : kN, m. Les charges sont positives vers le bas ; une ligne d'influence donne l'effet d'une force unité vers le bas.
 */
(function (root) {
  'use strict';

  /* ── coefficients ── */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const phi2 = (L) => clamp(1.44 / (Math.sqrt(L) - 0.2) + 0.82, 1.0, 1.67);   // voie soigneusement entretenue
  const phi3 = (L) => clamp(2.16 / (Math.sqrt(L) - 0.2) + 0.73, 1.0, 2.0);    // entretien normal
  const deltaF61 = (L, G, S) => 1 + 0.4 / (1 + 0.2 * L) + 0.6 / (1 + 4 * G / S); // Fasc. 61 II art. 5.5
  const A_L = (L) => 2.30 + 360 / (L + 12);                                       // kN/m², Fasc. 61 II art. 4.2
  const a1F61 = (classe, nv) => ({ 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] }[classe] || [1])[Math.min(nv, classe === 1 ? 5 : 2) - 1];
  const v0F61 = (classe) => ({ 1: 3.5, 2: 3.0, 3: 2.75 }[classe] || 3.5);
  const bcF61 = (classe, nf) => ({ 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 0.8] }[classe] || [1])[Math.min(nf, classe === 1 ? 5 : 2) - 1];
  const btF61 = (classe) => ({ 1: 1.0, 2: 0.9 }[classe] || 0);
  /* EN 1991-2 tableau 4.2 + AN française (classe de trafic 1 ou 2) */
  const alphaLM1 = (classe) => classe === 2
    ? { Q: [0.9, 0.8, 0.8], q1: 0.7, qi: 1.0, qr: 1.0 }
    : { Q: [1.0, 1.0, 1.0], q1: 1.0, qi: 1.2, qr: 1.2 };
  const LM1 = { Q: [300, 200, 100], q: [9, 2.5, 2.5], w: 3.0 };

  /* ── convois de charges concentrées (d = abscisse de l'essieu depuis la tête, P en kN) ── */
  const CONVOIS = {
    BcCamion: [{ d: 0, P: 60 }, { d: 4.5, P: 120 }, { d: 6.0, P: 120 }],
    Bt: [{ d: 0, P: 160 }, { d: 1.35, P: 160 }],
    Br: [{ d: 0, P: 100 }],
    TS: (Q) => [{ d: 0, P: Q }, { d: 1.2, P: Q }],
    LM2: (beta = 1) => [{ d: 0, P: 400 * beta }],
    UIC71: [{ d: 0, P: 250 }, { d: 1.6, P: 250 }, { d: 3.2, P: 250 }, { d: 4.8, P: 250 }],
  };
  /* chenilles : charge répartie sur une longueur (kN, m) */
  const CHENILLES = { Mc80: { P: 720, l: 4.9 }, Mc120: { P: 1100, l: 6.1 } };
  const SW = { 'SW/0': { q: 133, a: 15, c: 5.3 }, 'SW/2': { q: 150, a: 25, c: 7.0 } };

  /* ── outils sur une ligne d'influence échantillonnée à pas constant ──
   * li = {x0, dx, y:[]} (y en effet par kN) ; hors de [x0, x0+(n−1)dx] l'influence est nulle. */
  function mkLI(xs, ys) {
    const dx = xs[1] - xs[0];
    const F = new Float64Array(ys.length); // intégrale cumulée
    for (let k = 1; k < ys.length; k++) F[k] = F[k - 1] + (ys[k] + ys[k - 1]) / 2 * dx;
    const x0 = xs[0], xn = xs[xs.length - 1], tol = 1e-9 * Math.max(1, xn - x0);
    const at = (x) => {
      if (x < x0 - tol || x > xn + tol) return 0;
      const t = (x - x0) / dx, k = Math.min(ys.length - 2, Math.floor(t)), r = t - k;
      return ys[k] + (ys[k + 1] - ys[k]) * r;
    };
    const cum = (x) => {
      if (x <= x0) return 0; if (x >= xn) return F[F.length - 1];
      const t = (x - x0) / dx, k = Math.min(ys.length - 2, Math.floor(t)), r = t - k;
      const yk = ys[k], yx = ys[k] + (ys[k + 1] - ys[k]) * r;
      return F[k] + (yk + yx) / 2 * r * dx;
    };
    const integ = (a, b) => cum(b) - cum(a);
    // parties positive et négative cumulées
    const Fp = new Float64Array(ys.length), Fn = new Float64Array(ys.length);
    for (let k = 1; k < ys.length; k++) {
      const a = ys[k - 1], b = ys[k];
      let p, n;
      if (a >= 0 && b >= 0) { p = (a + b) / 2 * dx; n = 0; }
      else if (a <= 0 && b <= 0) { p = 0; n = (a + b) / 2 * dx; }
      else { const t = a / (a - b); const p1 = a > 0 ? a * t * dx / 2 : b * (1 - t) * dx / 2, n1 = a < 0 ? a * t * dx / 2 : b * (1 - t) * dx / 2; p = p1; n = n1; }
      Fp[k] = Fp[k - 1] + p; Fn[k] = Fn[k - 1] + n;
    }
    const cumS = (arr, x) => { if (x <= x0) return 0; if (x >= xn) return arr[arr.length - 1]; const t = (x - x0) / dx, k = Math.min(ys.length - 2, Math.floor(t)), r = t - k; return arr[k] + (arr[k + 1] - arr[k]) * r; };
    const pos = (a, b) => cumS(Fp, b) - cumS(Fp, a), neg = (a, b) => cumS(Fn, b) - cumS(Fn, a);
    // lobes de signe constant
    const lobes = []; let s = 0, cur = null;
    for (let k = 0; k < ys.length - 1; k++) {
      const a = ys[k], b = ys[k + 1];
      const sg = (a + b) > 0 ? 1 : (a + b) < 0 ? -1 : 0;
      if (!sg) continue;
      if (!cur || cur.sg !== sg) { cur = { sg, a: xs[k], b: xs[k + 1], A: 0 }; lobes.push(cur); }
      cur.b = xs[k + 1]; cur.A += (a + b) / 2 * dx;
    }
    return { xs, ys, x0, xn, dx, at, integ, pos, neg, lobes, L: xn - x0 };
  }

  /* effet extrême d'un convoi d'essieux mobiles (dans les deux sens) */
  function convoi(li, axles, step) {
    const len = Math.max(...axles.map((a) => a.d));
    const h = step || Math.min(li.dx, 0.1);
    let mx = { v: -Infinity, x: null }, mn = { v: Infinity, x: null };
    for (const sens of [1, -1]) {
      for (let x = li.x0 - len - h; x <= li.xn + len + h; x += h) {
        let e = 0;
        for (const a of axles) e += a.P * li.at(x + sens * a.d);
        if (e > mx.v) mx = { v: e, x, sens }; if (e < mn.v) mn = { v: e, x, sens };
      }
    }
    return { max: Math.max(0, mx.v), min: Math.min(0, mn.v), posMax: mx, posMin: mn };
  }
  /* charge répartie illimitée, fractionnable : intégrale des parties de même signe */
  const repartie = (li, q) => ({ max: q * li.pos(li.x0, li.xn), min: q * li.neg(li.x0, li.xn) });

  /* UIC 71 : 4 × 250 kN sur 6,40 m + 80 kN/m illimitée de part et d'autre, hors zone des essieux */
  function uic71(li, alpha = 1, step) {
    const h = step || Math.min(li.dx, 0.1), q = 80;
    let mx = -Infinity, mn = Infinity, px = 0, pn = 0;
    for (let s = li.x0 - 6.4; s <= li.xn; s += h) {
      let e = 0; for (const a of CONVOIS.UIC71) e += a.P * li.at(s + 0.8 + a.d);
      const pIn = li.pos(s, s + 6.4), nIn = li.neg(s, s + 6.4);
      const P = li.pos(li.x0, li.xn) - pIn, N = li.neg(li.x0, li.xn) - nIn;
      const eM = e + q * P, em = e + q * N;
      // la zone des essieux peut aussi être laissée vide : on garde le meilleur des cas
      if (eM > mx) { mx = eM; px = s; } if (em < mn) { mn = em; pn = s; }
    }
    const qOnly = repartie(li, q);
    return { max: alpha * Math.max(0, mx, qOnly.max), min: alpha * Math.min(0, mn, qOnly.min), posMax: px, posMin: pn };
  }
  /* SW/0, SW/2 : deux blocs q sur a séparés de c */
  function swModel(li, nom, alpha = 1, step) {
    const { q, a, c } = SW[nom], h = step || Math.min(li.dx, 0.1);
    let mx = 0, mn = 0;
    for (let s = li.x0 - 2 * a - c; s <= li.xn; s += h) {
      const e = q * (li.integ(s, s + a) + li.integ(s + a + c, s + 2 * a + c));
      if (e > mx) mx = e; if (e < mn) mn = e;
    }
    return { max: alpha * mx, min: alpha * mn };
  }
  /* A(l) du Fascicule 61 : on teste les combinaisons de lobes de même signe (l = longueur chargée) */
  function AL(li, largeur, a1, a2) {
    const best = { max: 0, min: 0 };
    for (const sg of [1, -1]) {
      const L = li.lobes.filter((o) => o.sg === sg);
      if (!L.length) continue;
      const n = Math.min(L.length, 12);
      for (let m = 1; m < (1 << n); m++) {
        let l = 0, A = 0;
        for (let k = 0; k < n; k++) if (m & (1 << k)) { l += L[k].b - L[k].a; A += L[k].A; }
        const e = a2 * Math.max(a1 * A_L(l), 4 - 0.002 * l) * largeur * A;
        if (sg > 0 && e > best.max) best.max = e;
        if (sg < 0 && e < best.min) best.min = e;
      }
    }
    return best;
  }
  /* Bc : 1 ou 2 camions par file, même sens, distance libre ≥ 4,50 m entre essieux voisins */
  function Bc(li, nCamionsFile = 2, step) {
    let best = convoi(li, CONVOIS.BcCamion, step);
    if (nCamionsFile >= 2) {
      for (let g = 4.5; g <= Math.max(4.6, li.L + 6); g += Math.max(0.25, li.dx)) {
        const ax = CONVOIS.BcCamion.concat(CONVOIS.BcCamion.map((a) => ({ d: a.d + 6 + g, P: a.P })));
        const r = convoi(li, ax, step);
        if (r.max > best.max) best = Object.assign({}, best, { max: r.max, posMax: r.posMax });
        if (r.min < best.min) best = Object.assign({}, best, { min: r.min, posMin: r.posMin });
      }
    }
    return best;
  }
  /* chenille (Mc80, Mc120) : charge P répartie sur l, déplacée */
  function chenille(li, nom, step) {
    const { P, l } = CHENILLES[nom], q = P / l, h = step || Math.min(li.dx, 0.1);
    let mx = 0, mn = 0;
    for (let s = li.x0 - l; s <= li.xn; s += h) { const e = q * li.integ(s, s + l); if (e > mx) mx = e; if (e < mn) mn = e; }
    return { max: mx, min: mn };
  }
  /* LM1 sur une voie i (1D) : TS (2 essieux αQ·Q) + UDL αq·q·w */
  function lm1Voie(li, i, classe = 1, w = 3, step) {
    const al = alphaLM1(classe), Q = (al.Q[i] || 0) * (LM1.Q[i] || 0), q = (i === 0 ? al.q1 * 9 : al.qi * 2.5) * w;
    const ts = Q ? convoi(li, CONVOIS.TS(Q), step) : { max: 0, min: 0 };
    const u = repartie(li, q);
    return { max: ts.max + u.max, min: ts.min + u.min, ts, udl: u };
  }

  const api = { phi2, phi3, deltaF61, A_L, a1F61, v0F61, bcF61, btF61, alphaLM1, LM1, CONVOIS, CHENILLES, SW, mkLI, convoi, repartie, uic71, swModel, AL, Bc, chenille, lm1Voie };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.charges = api; }
})(typeof window !== 'undefined' ? window : globalThis);
