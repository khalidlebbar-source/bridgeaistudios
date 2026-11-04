// PIPO-EL — surcharges du Fascicule 61 titre II : coefficients K (Guyon-Massonnet) et efforts extrêmes par lignes d'influence.
(function (root) {
  'use strict';
  const req = (typeof require === 'function' && typeof module !== 'undefined');
  const { makeK } = req ? require('./gm.js') : root.PIPO_GM;

  const A1 = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] };
  const V0 = { 1: 3.5, 2: 3.0, 3: 2.75 };
  const BC = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 0.8] };
  const BT = { 1: 1, 2: 0.9 };

  function coefficientsK(v, g, Lf) {
    const b = g.larg / 2, K = makeK(b, Lf);
    const c0 = v.ETROTG + v.EGAU - b, c1 = c0 + v.ESURCH;
    const ys = []; for (let i = 0; i <= 40; i++) ys.push(-b + 2 * b * i / 40);
    const integ = (y, a, z) => { if (z <= a) return 0; const n = 40; let s = 0; for (let i = 0; i <= n; i++) { const e = a + (z - a) * i / n; s += K(y, e) * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2); } return s * (z - a) / n / 3; };
    const best = f => { let m = 0; for (const y of ys) m = Math.max(m, f(y)); return m; };
    const slide = (w, f) => y => { let m = 0; for (let s = c0; s + w <= c1 + 1e-9; s += 0.05) m = Math.max(m, f(y, s)); return m; };
    const pts = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map(t => t * b);
    const cl = v.CLASSE || 1, nv = Math.max(1, v.PVOIE), V = v.ESURCH / nv;
    const out = { table: pts.map(y => pts.map(e => K(y, e))), b, Lf, theta: b / Lf, A: [], BC: [], BT: [], a1: [], a2: V0[cl] / V, bc: [], bt: BT[cl] || 1 };
    // A : 9 fibres de la section médiane, ligne d'influence de K interpolée linéairement entre les 9 ordonnées
    // de la table (intégrale exacte de la ligne brisée) ; reproduit 1638 exactement, écart ≤ 0.5 % ailleurs (non résolu).
    const Klin = (y, e) => { const u = (e + b) / (b / 4); const i = Math.min(7, Math.max(0, Math.floor(u))), f = u - i; return K(y, pts[i]) * (1 - f) + K(y, pts[i + 1]) * f; };
    const integLin = (y, a, z) => { const br = [a, ...pts.filter(p => p > a + 1e-12 && p < z - 1e-12), z]; let s = 0; for (let i = 1; i < br.length; i++) s += (br[i] - br[i - 1]) * (Klin(y, br[i - 1]) + Klin(y, br[i])) / 2; return s; };
    const best9 = f => Math.max(...pts.map(f));
    for (let n = 1; n <= nv; n++) { out.A.push(best9(slide(n * V, (y, s) => integLin(y, s, s + n * V) / (2 * b)))); out.a1.push((A1[cl] || A1[1])[Math.min(n, 5) - 1]); }
    const nf = Math.min(nv, Math.floor(v.ESURCH / 2.5 + 1e-9));
    for (let n = 1; n <= Math.max(1, nf); n++) {
      out.BC.push(best(slide(2.5 * n, (y, s) => { let t = 0; for (let j = 0; j < n; j++) t += K(y, s + 2.5 * j + 0.25) + K(y, s + 2.5 * j + 2.25); return t / 2 / (2 * b); })));
      out.bc.push((BC[cl] || BC[1])[Math.min(n, 5) - 1]);
    }
    for (let n = 1; n <= Math.min(2, Math.max(1, Math.floor(v.ESURCH / 3 + 1e-9))); n++)
      out.BT.push(best(slide(3 * n, (y, s) => { let t = 0; for (let j = 0; j < n; j++) t += K(y, s + 3 * j + 0.5) + K(y, s + 3 * j + 2.5); return t / 2 / (2 * b); })));
    const mc = v.MC === 3 ? [0.85, 2.95] : [1.0, 3.3];
    out.MC = v.MC ? best(slide(mc[0] + mc[1], (y, s) => (integ(y, s, s + mc[0]) + integ(y, s + mc[1], s + mc[1] + mc[0])) / 2 / (2 * b))) : 0;
    const lme = v.ME === 3 ? 3.5 : 4.0;
    out.ME = v.ME ? best(slide(lme, (y, s) => integ(y, s, s + lme) / lme / (2 * b))) : 0;
    if (v.ME === 5 && v.LARGENC > 0) { // charge généralisée « à essieux » (lignes S2/S3) : 2 roues à LARGES, centrées dans l'encombrement LARGENC
      const m0 = (v.LARGENC - v.LARGES) / 2;
      out.ME = best(slide(v.LARGENC, (y, s) => (K(y, s + m0) + K(y, s + m0 + v.LARGES)) / 2 / (2 * b)));
    }
    out.TR = (v.ETROTG + v.ETROTD) > 0 ? best(y => (integ(y, -b, -b + v.ETROTG) + integ(y, b - v.ETROTD, b)) / (2 * b)) : 0;
    const wEx = Math.min(3.3 + 2 * v.HCHAU, v.ESURCH);
    // convoi exceptionnel : chaussée de plus de 7 m → axe du convoi à 3.50 m du bord de chaussée (1638, 1676, 1825, 1890, 1893 :
    // K à 1e-4) ; chaussée ≤ 7 m : position libre (1846 exact, 1847 +3 % non résolu). Maximum sur les 9 fibres.
    const exAt = (y, s) => integ(y, s, s + wEx) / (3.3 + 2 * v.HCHAU) / (2 * b);
    out.EX = !v.EXCEP ? 0 : v.ESURCH > 7 + 1e-9 ? Math.max(...pts.map(y => Math.max(exAt(y, c0 + 3.5 - wEx / 2), exAt(y, c1 - 3.5 - wEx / 2))))
      : Math.max(...pts.map(slide(wEx, exAt)));
    // charges non demandées (indicateurs A1 nuls) : coefficients imprimés à 0
    if (!v.AL) out.A = out.A.map(() => 0); if (!v.BC) out.BC = out.BC.map(() => 0); if (!v.BT) out.BT = out.BT.map(() => 0);
    if (!v.MC) out.MC = 0; if (!v.ME) out.ME = 0; if (!v.EXCEP) out.EX = 0; if (!v.TROT) out.TR = 0;
    out.combA = Math.max(...out.A.map((k, i) => k * out.a1[i] * out.a2));
    out.nA = out.A.map((k, i) => k * out.a1[i] * out.a2).indexOf(out.combA) + 1;
    out.combBC = Math.max(...out.BC.map((k, i) => k * out.bc[i]));
    out.combBT = out.BT.length ? Math.max(...out.BT.map(k => k * out.bt)) : 0;
    return out;
  }

  // ligne d'influence échantillonnée (xs, f) prolongée par les dalles de transition (longueur Ld)
  function makeLI(xs, f, L, Ld, fDT, ends) {
    fDT = fDT || 1; const e0 = ends ? ends[0] : f[0], e1 = ends ? ends[1] : f[f.length - 1];
    const X = [], Y = [];
    const H = globalThis.PIPO_DTX || { s0: 0, k: 1, c: 0 }; const s0 = H.s0, Le = Ld * H.k + H.c;
    if (Ld > 0) { X.push(-s0 - Le); Y.push(0); X.push(-s0 - 1e-9); Y.push(e0 * fDT); if (s0 > 0) { X.push(-1e-9); Y.push(e0 * fDT); } }
    xs.forEach((x, i) => { X.push(x); Y.push(f[i]); });
    if (Ld > 0) { if (s0 > 0) { X.push(L + 1e-9); Y.push(e1 * fDT); } X.push(L + s0 + 1e-9); Y.push(e1 * fDT); X.push(L + s0 + Le); Y.push(0); }
    const at = x => { if (x < X[0] || x > X[X.length - 1]) return 0; let i = 1; while (i < X.length - 1 && X[i] < x) i++; const t = (x - X[i - 1]) / (X[i] - X[i - 1] || 1); return Y[i - 1] + t * (Y[i] - Y[i - 1]); };
    // zones de signe constant
    const zones = sg => { const Z = []; let cur = null;
      for (let i = 1; i < X.length; i++) {
        const a = X[i - 1], b = X[i], ya = Y[i - 1] * sg, yb = Y[i] * sg;
        let piece = null;
        if (ya >= 0 && yb >= 0 && (ya > 0 || yb > 0)) piece = [a, b, ya, yb];
        else if (ya > 0 && yb < 0) piece = [a, a + (b - a) * ya / (ya - yb), ya, 0];
        else if (ya < 0 && yb > 0) piece = [a + (b - a) * ya / (ya - yb), b, 0, yb];
        if (!piece) { cur = null; continue; }
        const [p, q, u, w] = piece, ar = (u + w) / 2 * (q - p);
        if (cur && Math.abs(cur.b - p) < 1e-9 && !(Ld > 0 && (Math.abs(p) < 1e-9 || Math.abs(p - L) < 1e-9))) { cur.b = q; cur.l += q - p; cur.a += ar; } else { cur = { a0: p, b: q, l: q - p, a: ar }; Z.push(cur); }
        if (yb <= 0) cur = null;
      }
      return Z.filter(z => z.a > 1e-12); };
    return { at, zones, X, Y };
  }

  function Al(l) { return Math.max(0.23 + 36 / (l + 12), 0.4 - 0.0002 * l); }

  // enveloppes pour une ligne d'influence ; sg = +1 (max) ou -1 (min)
  function enveloppes(li, v, g, dyn0, Kc, li0, sansDyn, liA) {
    liA = liA || li;
    const dyn = sansDyn ? { dBc: 1, dBt: 1, dMc: 1, dMe: 1 } : dyn0;
    li0 = li0 || li;
    const res = {};
    const lc0 = (v.MC === 3 ? 4.9 : 6.1) + 2 * v.HCHAU, lc = lc0 + g.e3 / 2, lq = lc0 + g.e3, Pmc = v.MC === 3 ? 72 : 110;
    const meP = v.ME === 3 ? 22 : 33, meD = v.ME === 3 ? 1.5 : 1.8;
    const lo = li.X[0] - 20, hi = li.X[li.X.length - 1] + 2;
    const pg = v.LU === 2 ? 0.25 : 0.5; // pas de déplacement des charges = pas des lignes d'influence
    const grid = []; for (let x = Math.ceil(lo / pg) * pg; x <= hi + 1e-9; x += pg) grid.push(Math.round(x * 1000) / 1000);
    const truck = [[0, 6], [4.5, 12], [6, 12]];
    // diffusion longitudinale des charges ponctuelles jusqu'au plan moyen de la traverse (hook d'essai)
    const DF = globalThis.PIPO_DIFF; const dif = a0 => DF ? a0 * DF.a + DF.h * 2 * ((v.HCHAU || 0) + (v.HSREMB || 0)) + DF.e * g.e3 : 0;
    const avg = (x, d) => { if (!(d > 0)) return li.at(x); let s = 0; const n = 8; for (let i = 0; i < n; i++) s += li.at(x - d / 2 + d * (i + 0.5) / n); return s / n; };
    const dBc = DF && DF.me ? 0 : dif(0.25), dBt = DF && DF.me ? 0 : dif(0.25), dMe = dif(DF && DF.l != null ? DF.l : 0.15);
    for (const sg of [1, -1]) {
      const key = sg > 0 ? 'max' : 'min';
      // A : meilleur sous-ensemble de zones
      const Z = liA.zones(sg); let bestA = { l: 0, area: 0, val: 0 };
      const n = Math.min(Z.length, 10);
      for (let m = globalThis.PIPO_ALLZ ? (1 << n) - 1 : 1; m < (1 << n); m++) { let l = 0, a = 0; for (let j = 0; j < n; j++) if (m >> j & 1) { l += Z[j].l; a += Z[j].a; }
        const val = Al(l) * a; if (val > bestA.val) bestA = { l, area: a, val }; }
      let lt = 0, at = 0; for (const z of li0.zones(sg)) { lt += z.l; at += z.a; }
      // Bc : 1 ou 2 camions par file, même sens
      let bBc = { s: 0, pos: [0, 0], sens: 1 };
      for (const sens of [1, -1]) {
        const tk = sens > 0 ? truck : (globalThis.PIPO_TK || [[0, 12], [1.5, 12], [6, 6]]);
        const one = grid.map(x => tk.reduce((s, [d, p]) => s + p * avg(x + d, dBc), 0) * sg);
        // un camion (imprimé en 1re colonne), puis deux camions espacés d'au moins 10.5 m (2e camion « 0.00 » = absent)
        for (let i = 0; i < grid.length; i++) if (one[i] > bBc.s + 5e-4) bBc = { s: one[i], pos: [grid[i], 0], sens };
        for (let i = 0; i < grid.length; i++) { if (one[i] <= 5e-4) continue;
          for (let j = i + 1; j < grid.length; j++) { if (grid[j] - grid[i] < 10.5 - 1e-9 || one[j] <= 5e-4) continue; const s2 = one[i] + one[j];
            if (s2 > bBc.s + 5e-4) bBc = { s: s2, pos: [grid[i], grid[j]], sens }; } }
      }
      const axle = (P, D, dd) => { let b = { s: 0, x: 0 }; for (const x of grid) { const s = (P * avg(x, dd) + P * avg(x + D, dd)) * sg; if (s > b.s + 5e-6) b = { s, x }; } return b; };
      const bBt = axle(16, 1.35, dBt), bMe = axle(meP, meD, dMe);
      // Notice §2.4 : longueur de répartition λ = chenille + 2d, d = HCHAU + E3/2 ; aire calculée au pas des LI,
      // listings : aire sur floor(λ/pas)·pas seulement (pas d interpolation), densité P/λ (1638, 1796 exacts).
      const MV = globalThis.PIPO_MCV != null ? globalThis.PIPO_MCV : 1;
      const seg = (a, b) => { const n = 8; let s = 0; for (let i = 0; i <= n; i++) s += li.at(a + (b - a) * i / n) * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2); return s * (b - a) / n / 3; };
      const areaPas = (x, lam) => { const n = Math.floor(lam / pg + 1e-9), t = lam / pg - n; let s = 0; for (let i = 0; i < n; i++) s += seg(x + i * pg, x + (i + 1) * pg); if (MV === 2 && t > 1e-9) s += t * seg(x + n * pg, x + (n + 1) * pg); return s; };
      const areaSimp = (x, lam) => { let s = 0; const nn = 20; for (let i = 0; i <= nn; i++) s += li.at(x + lam * i / nn) * (i === 0 || i === nn ? 1 : i % 2 ? 4 : 2); return s * lam / nn / 3; };
      let bMc = { s: 0, x: 0 };
      for (const x of grid) { const s = (MV ? areaPas(x, globalThis.PIPO_MCLAM ? globalThis.PIPO_MCLAM(v, g) : lq) : areaSimp(x, lc)) * sg; if (s > bMc.s) bMc = { s, x }; }
      const lex0 = (v.EXCEP === 1 ? 11 : 15) + 2 * v.HCHAU, lex = lex0 + g.e3 / 2, lexq = lex0 + g.e3, Pex = v.EXCEP === 1 ? 280 : 200;
      let bEx = { s: 0, x: 0 };
      if (v.EXCEP) for (const x of grid) { const s = (MV ? areaPas(x, lexq) : areaSimp(x, lex)) * sg; if (s > bEx.s) bEx = { s, x }; }
      res[key] = {
        A: { l: bestA.l, aire: sg * bestA.val, eff: sg * bestA.val * Kc.combA * v.COEFA },
        BC: { pos: bBc.pos, sens: bBc.sens, s: sg * bBc.s, eff: sg * bBc.s * Kc.combBC * dyn.dBc * v.COEFB },
        BT: { x: bBt.x, s: sg * bBt.s, eff: sg * bBt.s * Kc.combBT * dyn.dBt * v.COEFB },
        ME: { x: bMe.x, s: sg * bMe.s, eff: v.ME ? sg * bMe.s * Kc.ME * dyn.dMe * v.COEFM : 0 },
        MC: { x: bMc.x, aire: sg * bMc.s, eff: v.MC ? sg * bMc.s * Pmc / lq * Kc.MC * dyn.dMc * v.COEFM : 0 },
        TR: { l: lt, aire: sg * at * v.PSTROT, eff: sg * at * v.PSTROT * Kc.TR },
        EX: { x: bEx.x, aire: sg * bEx.s, eff: v.EXCEP ? sg * bEx.s * Pex / lexq * Kc.EX * v.COEFEX : 0 },
      };
      if (!v.AL) res[key].A.eff = 0; if (!v.BC) res[key].BC.eff = 0; if (!v.BT) res[key].BT.eff = 0; if (!v.TROT) res[key].TR.eff = 0;
    }
    return res;
  }

  // combinaisons (reconstituées) ; c = composantes {Gels,Gelu,A,BC,BT,MC,ME,EX,TR,RE,RT,TP}, sg = ±1
  function combine(c, sg) {
    // Règles retrouvées sur les sections déterminantes (73/74 lignes ELS/ELU exactes, valeurs SETRA injectées) :
    // A, Bc, Bt : 1.2 / 1.6 × (Q + TR + REMB) ; Mc, Me : Q + 1.2 TR (ELS), 1.35 Q + 1.5 TR (ELU), sans REMB ;
    // convoi exceptionnel seul (1.0 / 1.35) ; TR et REMB pris seulement s'ils sont défavorables.
    // Retrait toujours compté (ELU 1.35 si défavorable, 1.0 sinon) ; température ± : 0.6 |TP| (ELS), 0.8 |TP| (ELU).
    const pick = arr => sg > 0 ? Math.max(...arr) : Math.min(...arr);
    const f = x => (sg * (x || 0) > 0 ? x : 0);
    const T = f(c.TR), R = f(c.RE);
    const qs = pick([1.2 * (c.A + T + R), 1.2 * (c.BC + T + R), 1.2 * (c.BT + T + R), c.MC + 1.2 * T, c.ME + 1.2 * T, c.EX, 1.2 * (T + R), 0]);
    const qu = pick([1.6 * (c.A + T + R), 1.6 * (c.BC + T + R), 1.6 * (c.BT + T + R), 1.35 * c.MC + 1.5 * T, 1.35 * c.ME + 1.5 * T, 1.35 * c.EX, 1.6 * (T + R), 0]);
    const RT = c.RT || 0, TP = Math.abs(c.TP || 0);
    return { els: c.Gels + qs + RT + sg * 0.6 * TP, elu: c.Gelu + qu + (sg * RT > 0 ? 1.35 : 1) * RT + sg * 0.8 * TP, qs, qu };
  }

  const api = { coefficientsK, makeLI, enveloppes, combine, Al };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PIPO_LIVE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
