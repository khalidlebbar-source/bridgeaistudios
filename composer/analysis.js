/* BridgeAI Studios — Bridge Composer : analyse longitudinale du tablier.
 *
 * Modèle : poutre de Bernoulli à inertie constante (éléments finis à 2 nœuds, ddl v et θ, maillage ≈ 0,5 à 1 m),
 * appuis simples aux lignes d'appui. Tablier continu : une poutre continue ; travées indépendantes : une poutre
 * isostatique par travée. Pour une poutre à inertie constante, les efforts ne dépendent pas de EI.
 *
 * Lignes d'influence de M, V (sections aux nœuds) et des réactions, obtenues par charges unitaires aux nœuds
 * (solveur bande). Enveloppes caractéristiques :
 *   - G : charges permanentes g (structure + superstructures) ;
 *   - route EN 1991-2 : tandem TS (convoi de 2 essieux à 1,20 m, somme des voies) + UDL et trottoirs sur les parties
 *     défavorables des lignes d'influence ;
 *   - route Fascicule 61 : max [ A(l) (l = longueur chargée de la zone de même signe), δ·Bc ] + trottoirs ;
 *   - rail : α·Φ·LM71 (4 × 250 kN à 1,60 m + 80 kN/m) et Φ·SW/2 (150 kN/m), par voie chargée (2 au plus).
 * Combinaisons : ELS caractéristique G + Q ; ELU γG,sup/inf G + γQ Q (coefficients du module de calcul).
 * Contraintes normales de la section brute (homogénéisée n = 6 pour l'acier), sans précontrainte, et
 * précontrainte indicative pour décompresser la fibre inférieure sous ELS caractéristique (tabliers précontraints).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ───────── Caractéristiques de section (polygones [y, z]) ───────── */
  function sectionProps(polys, nAcier) {
    let A = 0, Sz = 0, Izz0 = 0;
    polys.forEach((p) => {
      const k = p.mat === 'acier' ? nAcier : 1, pts = p.pts;
      let a = 0, s = 0, i = 0;
      for (let j = 0; j < pts.length; j++) {
        const [y1, z1] = pts[j], [y2, z2] = pts[(j + 1) % pts.length], c = y1 * z2 - y2 * z1;
        a += c; s += (z1 + z2) * c; i += (z1 * z1 + z1 * z2 + z2 * z2) * c;
      }
      a /= 2; s /= 6; i /= 12;
      if (a < 0) { a = -a; s = -s; i = -i; }
      // les profilés sont noyés dans le béton (PRP) : on retire le béton remplacé
      const kk = p.mat === 'acier' && p.role === 'profile' ? k - 1 : k;
      A += kk * a; Sz += kk * s; Izz0 += kk * i;
    });
    const zG = Sz / A, I = Izz0 - A * zG * zG;
    let zt = -Infinity, zb = Infinity;
    polys.forEach((p) => p.pts.forEach((q) => { zt = Math.max(zt, q[1]); zb = Math.min(zb, q[1]); }));
    const v = zt - zG, vp = zG - zb;
    return { A, I, zG, v, vp, rho: I / (A * v * vp), h: zt - zb };
  }

  /* ───────── Poutre EF : solveur bande symétrique (Cholesky en bande) ───────── */
  function beamModel(len, supports, hMax) {
    // nœuds : appuis + subdivisions régulières de chaque intervalle
    const xs = [];
    for (let k = 0; k < supports.length - 1; k++) {
      const a = supports[k], b = supports[k + 1], ne = Math.max(8, Math.min(60, Math.ceil((b - a) / hMax)));
      for (let i = 0; i < ne; i++) xs.push(a + (b - a) * i / ne);
    }
    xs.push(supports[supports.length - 1]);
    const N = xs.length, nd = 2 * N, bw = 4;
    const sup = new Set(supports.map((x) => xs.findIndex((y) => Math.abs(y - x) < 1e-6)));
    // matrice de rigidité en bande (EI = 1) : K[i][j - i] pour j ≥ i, j - i ≤ 3
    const K = Array.from({ length: nd }, () => new Float64Array(bw));
    for (let e = 0; e < N - 1; e++) {
      const L = xs[e + 1] - xs[e], L2 = L * L, L3 = L2 * L;
      const k = [[12 / L3, 6 / L2, -12 / L3, 6 / L2], [6 / L2, 4 / L, -6 / L2, 2 / L], [-12 / L3, -6 / L2, 12 / L3, -6 / L2], [6 / L2, 2 / L, -6 / L2, 4 / L]];
      const d = 2 * e;
      for (let i = 0; i < 4; i++) for (let j = i; j < 4; j++) K[d + i][j - i] += k[i][j];
    }
    // conditions d'appui : v = 0 (pénalisation exacte par mise à l'identité)
    sup.forEach((n) => {
      const r = 2 * n;
      for (let j = 1; j < bw; j++) K[r][j] = 0;
      for (let i = Math.max(0, r - 3); i < r; i++) K[i][r - i] = 0;
      K[r][0] = 1;
    });
    // factorisation de Cholesky en bande : K = Lᵀ L stockée dans K
    for (let i = 0; i < nd; i++) {
      for (let k = Math.max(0, i - 3); k < i; k++) {
        const lki = K[k][i - k];
        for (let j = i; j <= Math.min(nd - 1, k + 3); j++) K[i][j - i] -= lki * K[k][j - k];
      }
      const piv = Math.sqrt(Math.max(K[i][0], 1e-30));
      K[i][0] = piv;
      for (let j = i + 1; j <= Math.min(nd - 1, i + 3); j++) K[i][j - i] /= piv;
    }
    const solve = (F) => {
      const y = Float64Array.from(F);
      for (let i = 0; i < nd; i++) { for (let k = Math.max(0, i - 3); k < i; k++) y[i] -= K[k][i - k] * y[k]; y[i] /= K[i][0]; }
      for (let i = nd - 1; i >= 0; i--) { for (let j = i + 1; j <= Math.min(nd - 1, i + 3); j++) y[i] -= K[i][j - i] * y[j]; y[i] /= K[i][0]; }
      return y;
    };
    return { xs, N, sup: [...sup].sort((a, b) => a - b), solve };
  }

  /* Efforts pour une charge unitaire descendante au nœud j : M (sagging +) et V (juste à droite) aux nœuds, réactions */
  function influence(model) {
    const { xs, N, sup, solve } = model;
    const IM = [], IV = [], IR = sup.map(() => new Float64Array(N));
    for (let j = 0; j < N; j++) {
      const F = new Float64Array(2 * N);
      if (!sup.includes(j)) F[2 * j] = -1;
      const u = sup.includes(j) ? F : solve(F);
      const M = new Float64Array(N), V = new Float64Array(N);
      for (let e = 0; e < N - 1; e++) {
        const L = xs[e + 1] - xs[e], L2 = L * L, L3 = L2 * L, d = 2 * e;
        const v1 = u[d], t1 = u[d + 1], v2 = u[d + 2], t2 = u[d + 3];
        const f0 = 12 / L3 * v1 + 6 / L2 * t1 - 12 / L3 * v2 + 6 / L2 * t2;   // effort à gauche
        const f1 = 6 / L2 * v1 + 4 / L * t1 - 6 / L2 * v2 + 2 / L * t2;      // moment à gauche
        const f3 = 6 / L2 * v1 + 2 / L * t1 - 6 / L2 * v2 + 4 / L * t2;      // moment à droite
        if (e === 0) M[0] = -f1;
        M[e + 1] = f3;
        V[e] = f0;
        if (e === N - 2) V[N - 1] = f0 - 0;                                  // dernier nœud : effort de l'élément
      }
      IM.push(M); IV.push(V);
      // réactions : équilibre local aux nœuds d'appui (somme des efforts tranchants)
      sup.forEach((n, k) => {
        const left = n > 0 ? IV[j][n - 1] : 0, right = n < N - 1 ? IV[j][n] : 0;
        IR[k][j] = right - left + (j === n ? 1 : 0);
      });
    }
    // transposition : IL[i][j] = effet en i d'une charge en j
    const T = (A) => { const R = Array.from({ length: N }, () => new Float64Array(N)); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) R[i][j] = A[j][i]; return R; };
    return { M: T(IM), V: T(IV), R: IR };
  }

  /* longueurs tributaires (charges réparties ramenées aux nœuds) */
  const tributary = (xs) => xs.map((x, i) => ((i < xs.length - 1 ? xs[i + 1] - x : 0) + (i > 0 ? x - xs[i - 1] : 0)) / 2);

  /* maximum (et minimum) d'un convoi d'essieux [[d, P]] sur une ligne d'influence échantillonnée aux nœuds */
  function convoy(xs, il, axles) {
    const x0 = xs[0], x1 = xs[xs.length - 1], len = Math.max.apply(null, axles.map((a) => a[0]));
    const at = (x) => {
      if (x < x0 || x > x1) return 0;
      let lo = 0, hi = xs.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
      const t = (x - xs[lo]) / ((xs[hi] - xs[lo]) || 1);
      return il[lo] * (1 - t) + il[hi] * t;
    };
    let mx = 0, mn = 0;
    const step = Math.max(0.1, (x1 - x0) / 400);
    for (const dir of [1, -1]) {
      for (let s = x0 - len; s <= x1 + len; s += step) {
        let v = 0;
        for (const [d, P] of axles) v += P * at(s + dir * d);
        if (v > mx) mx = v; if (v < mn) mn = v;
      }
    }
    return [mx, mn];
  }

  /* intégrales cumulées de la ligne d'influence (totale et partie positive / négative) */
  function cumul(xs, il, w) {
    const n = xs.length, T = new Float64Array(n + 1), P = new Float64Array(n + 1), N = new Float64Array(n + 1);
    for (let j = 0; j < n; j++) { const v = il[j] * w[j]; T[j + 1] = T[j] + v; P[j + 1] = P[j] + Math.max(v, 0); N[j + 1] = N[j] + Math.min(v, 0); }
    // somme sur les nœuds d'abscisse dans [a, b]
    const idx = (x) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < x) lo = m + 1; else hi = m; } return lo; };
    const sum = (A, a, b) => { const i = idx(a), j = idx(b + 1e-9); return A[Math.max(i, j)] - A[i]; };
    return { all: (a, b) => sum(T, a, b), pos: (a, b) => sum(P, a, b), neg: (a, b) => sum(N, a, b), Ptot: P[n], Ntot: N[n] };
  }
  /* LM71 : 4 essieux à 1,60 m + charge répartie à plus de 0,80 m des essieux extrêmes (parties défavorables seulement) */
  function lm71Env(xs, il, w, axles, q) {
    const c = cumul(xs, il, w), x0 = xs[0], x1 = xs[xs.length - 1];
    let mx = 0, mn = 0;
    const step = Math.max(0.1, (x1 - x0) / 400);
    const at = (x) => {
      if (x < x0 || x > x1) return 0;
      let lo = 0, hi = xs.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
      const t = (x - xs[lo]) / ((xs[hi] - xs[lo]) || 1);
      return il[lo] * (1 - t) + il[hi] * t;
    };
    for (let s = x0 - 6; s <= x1 + 1; s += step) {
      let a = 0; for (const [d, P] of axles) a += P * at(s + d);
      const wa = s - 0.8, wb = s + 4.8 + 0.8;
      const vp = a + q * (c.Ptot - c.pos(wa, wb)), vn = a + q * (c.Ntot - c.neg(wa, wb));
      if (vp > mx) mx = vp; if (vn < mn) mn = vn;
    }
    return [mx, mn];
  }
  /* SW/2 : 150 kN/m sur 2 × 25 m distants de 7 m (chargement complet des deux tronçons) */
  function sw2Env(xs, il, w, q) {
    const c = cumul(xs, il, w), x0 = xs[0], x1 = xs[xs.length - 1];
    let mx = 0, mn = 0;
    const step = Math.max(0.25, (x1 - x0) / 300);
    for (let s = x0 - 57; s <= x1; s += step) {
      const v = q * (c.all(s, s + 25) + c.all(s + 32, s + 57));
      if (v > mx) mx = v; if (v < mn) mn = v;
    }
    return [mx, mn];
  }

  /* ───────── Modèle de trafic pour l'analyse ───────── */
  function trafficModel(M) {
    const S = M.S, HY = S.hyp, PT = M.PT, rail = S.usage === 'rail';
    if (rail) {
      const nt = Math.min(PT.voiesFer, 2), Phi = M.lines[0].det.Phi || 1, a = S.alpha;
      return {
        kind: 'rail', Phi, nt,
        axles: [[0, 250], [1.6, 250], [3.2, 250], [4.8, 250]].map(([d, P]) => [d, nt * a * Phi * P]),
        q: nt * a * Phi * 80, qSW: nt * Phi * 150, sw: S.reglement === 'EC' || true,
        lab: (S.reglement === 'EC' ? 'LM71' : 'UIC 71') + ' × α = ' + String(a).replace('.', ',') + ' × Φ = ' + Phi.toFixed(2).replace('.', ',') + ', SW/2, ' + nt + ' voie(s)',
      };
    }
    const w = PT.roulable, trot = Math.max(0, PT.trottoirs - (S.profil.trottoirG > 0 ? 0.5 : 0) - (S.profil.trottoirD > 0 ? 0.5 : 0));
    if (S.reglement === 'EC') {
      const nl = Math.max(1, Math.floor(w / 3)), res = Math.max(0, w - 3 * nl), Cl = S.classe;
      const aQ = Cl === 1 ? [1, 1, 1] : Cl === 2 ? [0.9, 0.8, 0.8] : [0.8, 0.7, 0.7];
      const aq1 = Cl === 1 ? 1 : Cl === 2 ? 0.7 : 0.5, aqi = Cl === 1 ? 1.2 : 1.0, Qk = [300, 200, 100];
      let ts = 0; for (let i = 0; i < Math.min(3, nl); i++) ts += aQ[i] * Qk[i];
      const q = 3 * 9 * aq1 + (nl - 1) * 3 * 2.5 * aqi + res * 2.5 * aqi + (HY.qTrottoir || 3) * trot;
      return { kind: 'EC', axles: [[0, ts], [1.2, ts]], q, lab: 'LM1 : TS ' + Math.round(2 * ts) + ' kN + UDL ' + q.toFixed(1).replace('.', ',') + ' kN/m (voies + trottoirs), ' + nl + ' voie(s)' };
    }
    const Cl = S.classe, n = w >= 6 ? Math.floor(w / 3) : (w >= 5 ? 2 : 1), v = w / n;
    const v0 = Cl === 1 ? 3.5 : Cl === 2 ? 3.0 : 2.75, a2 = v0 / v;
    const A1T = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] }[Cl], BCT = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 0.8] }[Cl];
    const at = (t, k) => t[Math.min(k, t.length) - 1];
    const qA = (l) => { let best = 0; for (let k = 1; k <= n; k++) best = Math.max(best, a2 * Math.max(at(A1T, k) * (2.3 + 360 / (l + 12)), 4 - 0.002 * l) * k * v); return best; };
    let kBc = 0; for (let k = 1; k <= n; k++) kBc = Math.max(kBc, at(BCT, k) * k);
    const BC = [[0, 60], [4.5, 120], [6.0, 120], [10.5, 60], [15.0, 120], [16.5, 120]];
    return { kind: 'F61', qA, kBc, axles: BC.map(([d, P]) => [d, kBc * P]), qtr: (HY.qTrottoir || 1.5) * trot, lab: 'A(l) et δ·Bc (' + n + ' voie(s), classe ' + Cl + ')' };
  }

  /* ───────── Analyse complète ───────── */
  function analyse(M) {
    const S = M.S, sec = M.sec, xsSup = M.xs, n = xsSup.length - 1, g = M.g, cb = M.cb;
    const secp = sectionProps(sec.polys, 6);
    const TM = trafficModel(M);
    const groups = M.cont ? [xsSup.slice()] : xsSup.slice(0, -1).map((x, i) => [x, xsSup[i + 1]]);
    const hMax = Math.max(0.25, Math.min(0.75, M.Ltot / 300));
    const pts = [];                                   // résultats par nœud, toutes poutres confondues
    const reac = xsSup.map(() => ({ G: 0, Qmax: 0, Qmin: 0 }));
    const Lmax = Math.max.apply(null, xsSup.slice(1).map((x, k) => x - xsSup[k]));
    const dF61 = 1 + 0.4 / (1 + 0.2 * Lmax) + 0.6 / (1 + 4 * g * Lmax / ((TM.kBc || 1) * 600));
    /* enveloppe G / Q d'une ligne d'influence (xs, w, il) */
    const envelope = (xs, w, il) => {
      let G = 0, ap = 0, an = 0, lp = 0, ln = 0;
      for (let j = 0; j < xs.length; j++) {
        const v = il[j] * w[j];
        G += g * v;
        if (il[j] > 0) { ap += v; lp += w[j]; } else { an += v; ln += w[j]; }
      }
      let qmax, qmin;
      if (TM.kind === 'EC') { const [cmx, cmn] = convoy(xs, il, TM.axles); qmax = cmx + TM.q * ap; qmin = cmn + TM.q * an; }
      else if (TM.kind === 'F61') {
        const [cmx, cmn] = convoy(xs, il, TM.axles);
        qmax = Math.max(TM.qA(Math.max(lp, 1)) * ap, dF61 * cmx) + TM.qtr * ap;
        qmin = Math.min(TM.qA(Math.max(ln, 1)) * an, dF61 * cmn) + TM.qtr * an;
      } else {
        const [lmx, lmn] = lm71Env(xs, il, w, TM.axles, TM.q), [smx, smn] = sw2Env(xs, il, w, TM.qSW);
        qmax = Math.max(lmx, smx); qmin = Math.min(lmn, smn);
      }
      return { G, Qmax: Math.max(qmax, 0), Qmin: Math.min(qmin, 0) };
    };
    const rIL = xsSup.map(() => ({ xs: [], w: [], il: [] }));   // lignes d'influence de réaction sur tout l'ouvrage
    groups.forEach((sp, gi) => {
      const mdl = beamModel(sp[sp.length - 1] - sp[0], sp, hMax);
      const IL = influence(mdl), xs = mdl.xs, w = tributary(xs);
      for (let i = 0; i < xs.length; i++) {
        const em = envelope(xs, w, IL.M[i]), ev = envelope(xs, w, IL.V[i]);
        pts.push({ x: xs[i], gi, MG: em.G, MQmax: em.Qmax, MQmin: em.Qmin, VG: ev.G, VQmax: ev.Qmax, VQmin: ev.Qmin, sup: mdl.sup.includes(i) });
      }
      mdl.sup.forEach((nIdx, k) => {
        const js = xsSup.findIndex((x) => Math.abs(x - xs[nIdx]) < 1e-6), r = rIL[js];
        const off = r.xs.length && xs[0] <= r.xs[r.xs.length - 1] + 1e-9 ? 1e-4 : 0;      // nœuds confondus entre deux travées indépendantes
        for (let j = 0; j < xs.length; j++) { r.xs.push(xs[j] + (j === 0 ? off : 0)); r.w.push(w[j]); r.il.push(IL.R[k][j]); }
      });
    });
    rIL.forEach((r, j) => { const e = envelope(r.xs, r.w, r.il); reac[j].G = e.G; reac[j].Qmax = e.Qmax; reac[j].Qmin = e.Qmin; });
    const gG = cb.gG, gQ = cb.gQ, ke = cb.els;
    pts.forEach((p) => {
      p.MelsMax = p.MG + ke * p.MQmax; p.MelsMin = p.MG + ke * p.MQmin;
      p.MeluMax = Math.max(gG * p.MG, p.MG) + gQ * p.MQmax; p.MeluMin = Math.min(gG * p.MG, p.MG) + gQ * p.MQmin;
      p.VeluMax = Math.max(gG * p.VG, p.VG) + gQ * p.VQmax; p.VeluMin = Math.min(gG * p.VG, p.VG) + gQ * p.VQmin;
      // contraintes (MPa, compression +) en fibres supérieure et inférieure, ELS caractéristique
      const k = 1 / secp.I / 1000;
      p.sSupMax = p.MelsMax * secp.v * k; p.sSupMin = p.MelsMin * secp.v * k;
      p.sInfMin = -p.MelsMax * secp.vp * k; p.sInfMax = -p.MelsMin * secp.vp * k;
      p.sSupG = p.MG * secp.v * k; p.sInfG = -p.MG * secp.vp * k;
    });
    reac.forEach((r) => { r.els = r.G + ke * r.Qmax; r.elu = gG * r.G + gQ * r.Qmax; r.soul = r.G + gQ * r.Qmin; });

    // synthèse par travée et par appui
    const spans = [];
    for (let i = 0; i < n; i++) {
      const a = xsSup[i], b = xsSup[i + 1];
      const ps = pts.filter((p) => p.x >= a - 1e-6 && p.x <= b + 1e-6 && (M.cont || p.gi === i));
      const top = ps.reduce((m, p) => (p.MeluMax > m.MeluMax ? p : m), ps[0]);
      spans.push({ i, L: b - a, xMax: top.x, MG: top.MG, MQ: top.MQmax, Mels: top.MelsMax, Melu: top.MeluMax, sInf: top.sInfMin, sSup: top.sSupMax,
        Vmax: Math.max.apply(null, ps.map((p) => Math.max(Math.abs(p.VeluMax), Math.abs(p.VeluMin)))) });
    }
    const supsRes = xsSup.map((x, j) => {
      const ps = pts.filter((p) => Math.abs(p.x - x) < 1e-6);
      const m = ps.reduce((a, p) => (p.MeluMin < a.MeluMin ? p : a), ps[0]);
      return { j, x, MG: m.MG, MQ: m.MQmin, Mels: m.MelsMin, Melu: m.MeluMin, sSup: m.sSupMin, sInf: m.sInfMax, R: reac[j] };
    });

    // précontrainte indicative (tabliers précontraints) : fibre inférieure décomprimée sous ELS caractéristique
    let prec = null;
    if (['PSIDP', 'VIPP', 'PRAD'].includes(S.tablier.type)) {
      const sp = spans.reduce((a, b) => (b.Mels > a.Mels ? b : a), spans[0]);
      const e = Math.max(0.05, secp.vp - Math.max(0.10, 0.08 * secp.h));
      const P = sp.Mels * secp.vp / secp.I / (1 / secp.A + e * secp.vp / secp.I);     // kN
      const cable = 12 * 150e-6 * 1395e3 * 0.75;                                         // 12T15, contrainte finale ≈ 0,75 × 0,75 fpk
      prec = { P, e, span: sp.i, nCables: Math.ceil(P / cable), cable };
    }
    // dimensionnement indicatif selon la famille de tablier
    const fam = M.T.famille, W = M.W, des = { kind: null };
    if (S.tablier.type === 'PSIDA') {                  // dalle en béton armé : aciers longitudinaux (ELU), bras de levier 0,9 d
      const d = M.h - 0.06, fyd = 500 / 1.15 * 1000, As = (Mu) => Math.abs(Mu) / (0.9 * d * fyd) * 1e4 / W;   // cm²/m
      des.kind = 'BA'; des.d = d;
      spans.forEach((sp) => { sp.As = As(sp.Melu); });
      supsRes.forEach((sp) => { sp.As = As(sp.Melu); });
    } else if (fam === 'prp' || fam === 'mixte') {     // contrainte dans l'acier inférieur : n × contrainte homogénéisée
      des.kind = 'acier'; des.fy = parseFloat(S.hyp.charpente.slice(1)) || 355;
      spans.forEach((sp) => { sp.sAcier = 6 * Math.abs(sp.sInf); });
      supsRes.forEach((sp) => { sp.sAcier = 6 * Math.abs(sp.sInf); });
    } else if (prec) des.kind = 'prec';
    return { sec: secp, pts, spans, sups: supsRes, reac, TM, prec, des, hMax };
  }

  return { analyse, sectionProps, _an: { beamModel, influence, convoy, tributary } };
});
