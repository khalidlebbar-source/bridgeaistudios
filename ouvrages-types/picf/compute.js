// PICF-EL (PICF91 v1.06, BAEL 91) — moteur de calcul.
// Méthodes reconstituées à partir des listings SETRA du corpus (voir NOTES.md).
// Unités de sortie : kN, kN*m, m, MPa (comme les listings). Charges d'entrée en t (×9.81).
(function (root) {
  const G = 9.81;
  const P = (typeof module !== 'undefined' && module.exports) ? require('./parse.js') : root.PICF_PARSE;

  // ---------------------------------------------------------------- algèbre
  function luFactor(A, n) { // A : Float64Array n*n (row-major), pivot partiel
    const piv = new Int32Array(n);
    for (let i = 0; i < n; i++) piv[i] = i;
    for (let k = 0; k < n; k++) {
      let p = k, mx = Math.abs(A[k * n + k]);
      for (let i = k + 1; i < n; i++) { const v = Math.abs(A[i * n + k]); if (v > mx) { mx = v; p = i; } }
      if (p !== k) { for (let j = 0; j < n; j++) { const t = A[k * n + j]; A[k * n + j] = A[p * n + j]; A[p * n + j] = t; } const t = piv[k]; piv[k] = piv[p]; piv[p] = t; }
      const d = A[k * n + k];
      for (let i = k + 1; i < n; i++) {
        const f = A[i * n + k] / d; if (f === 0) continue; A[i * n + k] = f;
        for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      }
    }
    return { A, piv, n };
  }
  function luSolve(F, b) {
    const { A, piv, n } = F; const x = new Float64Array(n);
    for (let i = 0; i < n; i++) x[i] = b[piv[i]];
    for (let i = 0; i < n; i++) { let s = x[i]; for (let j = 0; j < i; j++) s -= A[i * n + j] * x[j]; x[i] = s; }
    for (let i = n - 1; i >= 0; i--) { let s = x[i]; for (let j = i + 1; j < n; j++) s -= A[i * n + j] * x[j]; x[i] = s / A[i * n + i]; }
    return x;
  }

  // ---------------------------------------------------------------- cadre
  // Cadre plan : traverse supérieure (y=H), traverse inférieure (y=0) sur sol élastique
  // de Winkler, piédroits x=0 et x=L. Éléments poutre d'Euler avec matrice de Winkler cohérente.
  function buildFrame(p) {
    const nodes = [], els = [];
    const add = (x, y) => { nodes.push([x, y]); return nodes.length - 1; };
    const { L, H } = p;
    const bot = p.xb.map(x => add(x, 0));
    const lw = [bot[0]], rw = [bot[bot.length - 1]];
    for (const y of p.yw.slice(1, -1)) lw.push(add(0, y));
    for (const y of p.yw.slice(1, -1)) rw.push(add(L, y));
    const tl = add(0, H), tr = add(L, H); lw.push(tl); rw.push(tr);
    const top = [tl]; for (const x of p.xt.slice(1, -1)) top.push(add(x, H)); top.push(tr);
    const mk = (arr, EI, EA, k, grp) => { for (let i = 0; i + 1 < arr.length; i++) els.push({ a: arr[i], b: arr[i + 1], EI, EA, k, grp }); };
    mk(bot, p.EIb, p.EAb, p.k, 'b'); mk(top, p.EIt, p.EAt, 0, 't'); mk(lw, p.EIw, p.EAw, 0, 'lw'); mk(rw, p.EIw, p.EAw, 0, 'rw');
    const n = nodes.length * 3; const K = new Float64Array(n * n);
    for (const e of els) {
      const [x1, y1] = nodes[e.a], [x2, y2] = nodes[e.b];
      const l = Math.hypot(x2 - x1, y2 - y1), c = (x2 - x1) / l, s = (y2 - y1) / l, EI = e.EI, ea = e.EA;
      const kl = [[ea / l, 0, 0, -ea / l, 0, 0], [0, 12 * EI / l ** 3, 6 * EI / l ** 2, 0, -12 * EI / l ** 3, 6 * EI / l ** 2], [0, 6 * EI / l ** 2, 4 * EI / l, 0, -6 * EI / l ** 2, 2 * EI / l],
        [-ea / l, 0, 0, ea / l, 0, 0], [0, -12 * EI / l ** 3, -6 * EI / l ** 2, 0, 12 * EI / l ** 3, -6 * EI / l ** 2], [0, 6 * EI / l ** 2, 2 * EI / l, 0, -6 * EI / l ** 2, 4 * EI / l]];
      if (e.k) {
        const q = e.k * l / 420, kw = [[156, 22 * l, 54, -13 * l], [22 * l, 4 * l * l, 13 * l, -3 * l * l], [54, 13 * l, 156, -22 * l], [-13 * l, -3 * l * l, -22 * l, 4 * l * l]], id = [1, 2, 4, 5];
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) kl[id[i]][id[j]] += q * kw[i][j];
      }
      const R = Array.from({ length: 6 }, () => new Array(6).fill(0));
      for (const o of [0, 3]) { R[o][o] = c; R[o][o + 1] = s; R[o + 1][o] = -s; R[o + 1][o + 1] = c; R[o + 2][o + 2] = 1; }
      Object.assign(e, { kl, R, l, dofs: [e.a * 3, e.a * 3 + 1, e.a * 3 + 2, e.b * 3, e.b * 3 + 1, e.b * 3 + 2] });
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
        let v = 0; for (let a = 0; a < 6; a++) { if (!R[a][i]) continue; for (let b = 0; b < 6; b++) if (R[b][j]) v += R[a][i] * kl[a][b] * R[b][j]; }
        K[e.dofs[i] * n + e.dofs[j]] += v;
      }
    }
    K[bot[0] * 3 * n + bot[0] * 3] += 1; // blocage horizontal symbolique (mode rigide)
    const groups = { b: els.filter(e => e.grp === 'b'), t: els.filter(e => e.grp === 't'), lw: els.filter(e => e.grp === 'lw'), rw: els.filter(e => e.grp === 'rw') };
    return { nodes, els, bot, top, lw, rw, n, LU: luFactor(K, n), groups, p };
  }
  function endForces(e, u) {
    const ug = e.dofs.map(d => u[d]); const ul = e.R.map(r => r.reduce((a, v, i) => a + v * ug[i], 0));
    return e.kl.map(r => r.reduce((a, v, i) => a + v * ul[i], 0));
  }
  // Moment (convention : positif = fibre intérieure tendue) et effort tranchant au j-ième nœud d'un élément
  const SGN = { b: -1, t: 1, lw: 1, rw: -1 };
  function forcesAt(m, grp, j, u, fem) {
    const list = m.groups[grp]; const atEnd = j >= list.length; const e = atEnd ? list[j - 1] : list[j];
    const f = endForces(e, u);
    let Ms = atEnd ? f[5] : -f[2], V = atEnd ? -f[4] : f[1];
    if (fem) { const ff = fem.get(e); if (ff) { Ms += atEnd ? ff[5] : -ff[2]; V += atEnd ? -ff[4] : ff[1]; } }
    return { M: SGN[grp] * Ms, V: SGN[grp] * V, N: atEnd ? f[3] : -f[0] };
  }

  // ---------------------------------------------------------------- Guyon-Massonnet (sans torsion : alpha = 0)
  function guyonK(theta, ys, e) { const w = guyonSol(theta, e); return ys.map(y => w(y, 0) / w.W0); }
  // moment transversal (coefficient mu de Guyon, Poisson 0) à la fibre f pour une charge linéique sinusoïdale en y
  function guyonMu(theta, f, y) { return -guyonSol(theta, y)(f, 2); }
  function guyonSol(theta, e) { // b = 1 ; charge en e ; retourne W(y, dérivée)
    const b = 1, L = b / theta, be = Math.PI / L;
    const basis = (y, der) => {
      const ch = Math.cosh(be * y), sh = Math.sinh(be * y);
      const C = k => Math.pow(be, k) * (k % 2 ? sh : ch), S = k => Math.pow(be, k) * (k % 2 ? ch : sh);
      const yC = n => y * C(n) + (n ? n * C(n - 1) : 0), yS = n => y * S(n) + (n ? n * S(n - 1) : 0);
      return [C(der), yC(der), S(der), yS(der)];
    };
    const A = [], r = [];
    const row = (seg, y, der, coef) => { const v = new Array(8).fill(0); const f = basis(y, der); for (let i = 0; i < 4; i++) v[seg * 4 + i] += coef * f[i]; return v; };
    const add = (a, c) => a.map((x, i) => x + c[i]);
    for (const [seg, y] of [[0, -b], [1, b]]) { A.push(row(seg, y, 2, 1)); r.push(0); A.push(add(row(seg, y, 3, 1), row(seg, y, 1, -2 * be * be))); r.push(0); }
    for (let d = 0; d < 3; d++) { A.push(add(row(0, e, d, 1), row(1, e, d, -1))); r.push(0); }
    A.push(add(row(1, e, 3, 1), row(0, e, 3, -1))); r.push(1);
    const n = 8, M = new Float64Array(64); A.forEach((rw, i) => rw.forEach((v, j) => M[i * 8 + j] = v));
    const x = luSolve(luFactor(M, n), r);
    const fn = (y, der) => { const seg = y < e ? 0 : 1; const f = basis(y, der); let s = 0; for (let i = 0; i < 4; i++) s += x[seg * 4 + i] * f[i]; return s; };
    fn.W0 = (1 / (2 * b)) / Math.pow(be, 4);
    return fn;
  }

  // ---------------------------------------------------------------- utilitaires
  const range = (a, b, h) => { const r = []; for (let x = a; x <= b + 1e-9; x += h) r.push(+x.toFixed(6)); return r; };
  function sectionsList(Lh, st) { const r = range(0, Lh, st || 0.5).filter(x => x < Lh - 1e-6); r.push(Lh); return r; }
  const r2 = x => Math.round(x * 100) / 100;

  // Marston (annexe CHAMOA « Effet Marston ») : coefficient Cr
  function marston(Hr, D, R, Htot) {
    if (!(R > 0) || !(Hr > 0)) return 1;
    const c = 2 * 0.1925, p = Htot / D;
    let lo = 0, hi = 60; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (Math.exp(c * m) - c * m < c * R * p + 1) lo = m; else hi = m; }
    const He = lo * D;
    if (Hr <= He) return (Math.exp(c * Hr / D) - 1) / (c * Hr / D);
    const Cc = (Math.exp(c * He / D) - 1) / c + (Hr / D - He / D) * Math.exp(c * He / D);
    return Cc * D / Hr;
  }

  // ---------------------------------------------------------------- convois (Fascicule 61 titre II)
  // Chaque convoi : liste d'essieux {x, P (t), a (longueur d'impact)} et pas de déplacement.
  const BC_CAMION = [{ x: 0, P: 6 }, { x: 4.5, P: 12 }, { x: 6, P: 12 }];
  function convoys(d) {
    // Diffusion longitudinale jusqu'au plan moyen de la traverse (calée sur les 3 listings) :
    //  roues (Bc, Bt, Me, engin) : 45° dans chaussée et remblai ; chenilles Mc et convoi E : 45° chaussée, 30° remblai.
    const t30 = Math.tan(Math.PI / 6);
    const sW = 2 * (d.hchau + d.hsrem) + d.e3, sL = 2 * d.hchau + 2 * d.hsrem * t30 + d.e3, sEC = 2 * (d.ec ? d.ec.hsrem : 0) + d.e3;
    const ax = (list, s) => list.map(a => ({ ...a, a: (a.a || 0) + s }));
    const out = {};
    out.BC = { trucks: 2, gapTruck: 10.5, axles: ax(BC_CAMION.map(a => ({ ...a, a: 0.25 })), sW) };
    out.BT = { trucks: 1, axles: ax([{ x: 0, P: 16, a: 0.25 }, { x: 1.35, P: 16, a: 0.25 }], sW) };
    out.MC = { trucks: 1, axles: ax([{ x: 0, P: 110, a: 6.10 }], sL) };
    out.ME = { trucks: 1, axles: ax([{ x: 0, P: 33, a: 0.15 }, { x: 1.80, P: 33, a: 0.15 }], sW) };
    out.E = { trucks: 1, axles: ax([{ x: 0, P: 200, a: 15.0 }, { x: 33.0, P: 200, a: 15.0 }], sL) };
    out.EC = { trucks: 1, axles: ax([{ x: 0, P: 50, a: 0.60 }, { x: 9.5, P: 50, a: 0.60 }], sEC) };
    return out;
  }

  // ---------------------------------------------------------------- calcul principal
  function compute(model) {
    const d = P.data(model);
    const R = { donnees: d };
    const gr = d.biais * Math.PI / 200, s = Math.sin(gr);
    // --- géométrie
    const L = (d.ouver + d.e2) / s;                 // portée biaise entre axes des piédroits
    const H = d.hautl + (d.e1 + d.e3) / 2;          // hauteur moyenne entre axes des traverses
    const W = d.large, b = W / 2;
    const hasEC = d.ec.nom && d.ec.nom !== '0';
    R.geom = { L, H, W, s, biais: d.biais, e1: d.e1, e2: d.e2, e3: d.e3, ldalt: d.ldalt, Ld: d.ldalt / s };
    // --- matériaux (BAEL 91)
    const fc = d.fcj, ft = 0.6 + 0.06 * fc, Ei = 11000 * Math.cbrt(fc), Ev = 3700 * Math.cbrt(fc);
    R.mat = { fc, ft, Ei, Ev, fbu: 0.85 * fc / 1.5, fbuQ: 0.85 * fc / (0.85 * 1.5), sbc: 0.6 * fc,
      fsu: d.fe.map(f => f / 1.15), tauLim0: 0.07 * fc / 1.5, taus: 0.6 * d.psis ** 2 * ft };
    // fissuration : PP (peu préjudiciable), P (préjudiciable), TP (très préjudiciable) — BAEL 91 révisé 99
    const ifis = String(d.ifis || 'PP').trim();
    R.mat.ifis = ifis;
    R.mat.tauLim = ifis === 'PP' ? Math.min(0.2 * fc / 1.5, 5) : Math.min(0.15 * fc / 1.5, 4);
    R.mat.ssLim = ifis === 'PP' ? null : d.fe.map((fe, i) => { const fp = Math.min(2 / 3 * fe, Math.max(0.5 * fe, 110 * Math.sqrt(d.eta[i] * ft))); return ifis === 'P' ? fp : 0.8 * fp; });
    // --- sol (modèle de Winkler, kv = Esol (B+W) / (2 B W), B = portée droite)
    const Bd = L * s; const kv = d.esol * 1000 * (Bd + W) / (2 * Bd * W) * (root.PICF_KVF || 1); // kN/m3
    R.sol = { kv, Bd };
    // --- charges permanentes
    const gb = d.mvbet * G, gs = d.mvsol * G;
    const Htot = d.hautl + d.e1 + d.e3;
    const Cr = marston(d.hsrem, d.ouver, d.r, Htot);
    const qrem = d.hsrem > 0 ? { n: 0.9 * d.mvsol * d.hsrem * Cr, x: 1.1 * d.mvsol * d.hsrem * Cr } : { n: d.qremn || 0, x: d.qremx || 0 };
    const qsup = { n: d.qsupn + qrem.n, x: d.qsupx + qrem.x }; qsup.p = (qsup.n + qsup.x) / 2;
    const rdt = { n: d.rdtn, x: d.rdtx, p: (d.rdtn + d.rdtx) / 2 };
    const ch = hasEC ? { qn: d.ec.qremn, qx: d.ec.qremx, qp: (d.ec.qremn + d.ec.qremx) / 2, rn: d.ec.rdtn, rx: d.ec.rdtx, rp: (d.ec.rdtn + d.ec.rdtx) / 2 } : null;
    R.charges = { gb, gs, Cr, qrem, qsup, rdt, chantier: ch };

    // --- coefficients de majoration dynamique : delta = 1 + 0.4/(1+0.2 L) + 0.6/(1 + 4 G/S)
    const Gt = L * W * (d.mvbet * d.e3 + qsup.p);
    const delta = S => 1 + 0.4 / (1 + 0.2 * L) + 0.6 / (1 + 4 * Gt / S);
    const nvoi = d.nvoi, v = d.esurch / nvoi;
    const bcCoef = [null, 1.2, 1.1, 0.95, 0.8, 0.7][Math.min(nvoi, 5)];
    const btCoef = 1.0;
    const conv = convoys(d); R.conv = conv;
    // masse Bc maximale sur la portée (camions disposés au plus défavorable, impact 0.25 m)
    function maxWeight(axles, Lc, a) {
      let best = 0; const span = axles[axles.length - 1].x;
      for (let x0 = -span - 1; x0 <= Lc + 1; x0 += 0.005) {
        let sm = 0; for (const ax of axles) { const q = x0 + ax.x; const lo = Math.max(0, q - a / 2), hi = Math.min(Lc, q + a / 2); if (hi > lo) sm += ax.P * (hi - lo) / a; }
        best = Math.max(best, sm);
      }
      return best;
    }
    const bcAxles = []; for (let t = 0; t < 4; t++) for (const a of BC_CAMION) bcAxles.push({ x: a.x + t * 10.5, P: a.P });
    const nbc = Math.min(nvoi, 4); // nombre de files Bc
    const Sbc = nbc * maxWeight(bcAxles, L, 0.25);
    const nbt = Math.min(nvoi, 2);
    const Sbt = nbt * 32;
    const dyn = {
      BC: { S: Sbc, coef: bcCoef, d: delta(Sbc * bcCoef) }, BT: { S: Sbt, coef: btCoef, d: delta(Sbc * bcCoef) }, // SETRA applique à Bt le coefficient de Bc
      MC: { S: 110, d: delta(110) }, ME: { S: 66, d: delta(110) }, E: { d: 1.0 }, EC: hasEC ? { d: 1.5 } : null,
    };
    R.dyn = dyn;

    // --- maillage et modèle de cadre (EI différé ; piédroits d'épaisseur biaise e2/sin)
    const Lh = L / 2;
    const STP = L > 10 ? 0.5 : 0.25; // pas des tableaux (0.25 m pour les petites portées, cf. 2498)
    const xsTop = Array.from(new Set([...range(0, L, 0.05), ...sectionsList(Lh, STP), L - 0, Lh, L / 4].map(x => +x.toFixed(6)))).filter(x => x <= L + 1e-9).sort((a, b) => a - b);
    if (xsTop[xsTop.length - 1] < L - 1e-6) xsTop.push(L);
    const secB = sectionsList(Lh, STP);
    const xsBot = Array.from(new Set([...secB, L / 4, ...secB.map(x => L - x), L].map(x => +x.toFixed(6)))).sort((a, b) => a - b);
    const secW = sectionsList(H).map(x => x); // abscisses depuis la base (on prend 0..H par pas de 0.5 + H)
    const secWfull = range(0, H, STP).filter(x => x < H - 1e-6); secWfull.push(H);
    const ywl = Array.from(new Set([...secWfull, H / 2].map(x => +x.toFixed(6)))).sort((a, b) => a - b);
    const EAF = 1e4; // SETRA néglige les déformations d'effort normal (barres quasi inextensibles)
    const EIt = Ev * 1000 * d.e3 ** 3 / 12, EIb = Ev * 1000 * d.e1 ** 3 / 12, EIw = Ev * 1000 * (d.e2 / s) ** 3 / 12;
    const m = buildFrame({ L, H, xt: xsTop, xb: xsBot, yw: ywl, EIt, EIb, EIw, EAt: EAF * Ev * 1000 * d.e3, EAb: EAF * Ev * 1000 * d.e1, EAw: EAF * Ev * 1000 * d.e2 / s, k: kv });
    R._frame = m;
    const idx = (arr, x) => arr.findIndex(v => Math.abs(v - x) < 1e-6);
    // points d'étude
    const studyT = secB.map(x => ({ x, j: idx(xsTop, x) }));
    const studyB = secB.map(x => ({ x, j: idx(xsBot, x) }));
    const studyW = secWfull.map(y => ({ x: y, j: idx(ywl, y) }));
    const extract = (u, fem) => ({
      t: studyT.map(p => forcesAt(m, 't', p.j, u, fem)), b: studyB.map(p => forcesAt(m, 'b', p.j, u, fem)), w: studyW.map(p => forcesAt(m, 'lw', p.j, u, fem)),
      det: [forcesAt(m, 't', 0, u, fem).M, forcesAt(m, 'lw', 0, u, fem).M, forcesAt(m, 't', idx(xsTop, Lh), u, fem).M, forcesAt(m, 'b', idx(xsBot, Lh), u, fem).M, forcesAt(m, 'b', idx(xsBot, L / 4), u, fem).M, forcesAt(m, 'lw', idx(ywl, H / 2), u, fem).M],
      p: [0, L / 4, Lh].map(x => { const j = idx(xsBot, x); return -u[m.bot[j] * 3 + 1] * kv / 1000; }), // MPa (pression du sol)
      u,
    });
    const solve = F => luSolve(m.LU, F);

    // --- lignes d'influence (charge unité 1 kN sur la traverse supérieure)
    const ilTop = xsTop.map((x, i) => { const F = new Float64Array(m.n); F[m.top[i] * 3 + 1] = -1; return extract(solve(F)); });
    // LI (page 7) : abscisses tous les 0.5 m + L
    const ilAbs = range(0, L, STP).filter(x => x < L - 1e-6).concat([L]);
    R.ilPage = ilAbs.map(x => { const i = idx(xsTop, x); return [x, ...ilTop[i].det]; });

    // --- charges permanentes : cas élémentaires
    const fem = new Map();
    function udlTop(q) { // q kN/m vers le bas sur la traverse sup.
      const F = new Float64Array(m.n); const fm = new Map();
      for (const e of m.groups.t) { const l = e.l; F[e.dofs[1]] -= q * l / 2; F[e.dofs[4]] -= q * l / 2; F[e.dofs[2]] -= q * l * l / 12; F[e.dofs[5]] += q * l * l / 12; fm.set(e, [0, q * l / 2, q * l * l / 12, 0, q * l / 2, -q * l * l / 12]); }
      return { F, fm };
    }
    function udlBot(q) {
      const F = new Float64Array(m.n); const fm = new Map();
      for (const e of m.groups.b) { const l = e.l; F[e.dofs[1]] -= q * l / 2; F[e.dofs[4]] -= q * l / 2; F[e.dofs[2]] -= q * l * l / 12; F[e.dofs[5]] += q * l * l / 12; fm.set(e, [0, q * l / 2, q * l * l / 12, 0, q * l / 2, -q * l * l / 12]); }
      return { F, fm };
    }
    function wallPressure(pfun) { // p(y) kN/m2, poussée vers l'intérieur sur les deux piédroits
      const F = new Float64Array(m.n); const fm = new Map();
      for (const [grp, sg] of [['lw', 1], ['rw', -1]]) for (const e of m.groups[grp]) {
        const ya = m.nodes[e.a][1], yb = m.nodes[e.b][1], h = yb - ya, pa = pfun(ya), pb = pfun(yb);
        const fa = h * (7 * pa + 3 * pb) / 20, fb = h * (3 * pa + 7 * pb) / 20, ma = h * h * (3 * pa + 2 * pb) / 60, mb = h * h * (2 * pa + 3 * pb) / 60;
        F[e.dofs[0]] += sg * fa; F[e.dofs[3]] += sg * fb; F[e.dofs[2]] -= sg * ma; F[e.dofs[5]] += sg * mb;
        // efforts d'encastrement en repère local (x local vers le haut, y local = -x global)
        fm.set(e, [0, sg * fa, sg * ma, 0, sg * fb, -sg * mb].map((v, i) => (i === 1 || i === 4) ? v : v));
      }
      return { F, fm };
    }
    const comb = (...cs) => { const F = new Float64Array(m.n); const fm = new Map(); for (const c of cs) { c.F.forEach((v, i) => F[i] += v); for (const [e, f] of c.fm) { const o = fm.get(e) || [0, 0, 0, 0, 0, 0]; fm.set(e, o.map((v, i) => v + f[i])); } } return { F, fm }; };
    const run = c => extract(solve(c.F), c.fm);
    function wallWeight() { const F = new Float64Array(m.n); const Pw = gb * d.e2 / s * H; for (const nd of [m.top[0], m.top[m.top.length - 1], m.bot[0], m.bot[m.bot.length - 1]]) F[nd * 3 + 1] -= Pw / 2; return { F, fm: new Map() }; }
    function headLoad(Pk) { const F = new Float64Array(m.n); F[m.top[0] * 3 + 1] -= Pk; F[m.top[m.top.length - 1] * 3 + 1] -= Pk; return { F, fm: new Map() }; }
    const cases = {};
    cases.pp = run(comb(udlTop(gb * d.e3), wallWeight(), udlBot(gb * d.e1), udlBot(gs * d.hremb)));
    // poussée des terres : K gamma (H - y) sur la hauteur des piédroits (entre axes)
    const pushUnit = run(wallPressure(y => gs * Math.max(0, H - y)));
    cases.pushN = scaleRes(pushUnit, d.rkgn); cases.pushX = scaleRes(pushUnit, d.rkgx);
    R.pushUnit = pushUnit;
    const pushQUnit = run(wallPressure(() => G)); // pression latérale uniforme 1 t/m2
    // poussée du remblai sur la traverse (colonne « POUSSEE H.SUP ») : K·γs·HSREM uniforme sur la hauteur des piédroits,
    // seulement sans dalle de transition (2498 : 31.40 t/m2 = 2 × 15.70 exact ; 2550/2551 avec dalle : colonne nulle).
    const hP = d.ldalt > 0 ? 0 : d.mvsol * d.hsrem;
    cases.pushHN = scaleRes(pushQUnit, d.rkgn * hP); cases.pushHX = scaleRes(pushQUnit, d.rkgx * hP);
    // charge sur les remblais PSREM (t/m2, γ 1.2/1.6) : pression latérale K·PSREM uniforme (K = RKGX)
    cases.remb = scaleRes(pushQUnit, d.rkgx * (d.psrem || 0));
    const qUnit = run(udlTop(G)); // 1 t/m2
    cases.qsupN = scaleRes(qUnit, qsup.n); cases.qsupX = scaleRes(qUnit, qsup.x);
    const rUnit = run(headLoad(G / W)); // réaction de dalle 1 t répartie sur la largeur droite
    cases.rdtN = scaleRes(rUnit, rdt.n); cases.rdtX = scaleRes(rUnit, rdt.x);
    if (ch) { cases.chqN = scaleRes(qUnit, ch.qn * 0); cases.chRN = scaleRes(rUnit, ch.rn); cases.chRX = scaleRes(rUnit, ch.rx); }
    // température : dilatation imposée de la traverse supérieure ; module différé,
    // part rapidement variable affectée du rapport Ei/Ev
    const tUnit = (() => { const F = new Float64Array(m.n); const N = EAF * Ev * 1000 * d.e3 * 1e-5; F[m.top[0] * 3] -= N; F[m.top[m.top.length - 1] * 3] += N; return run({ F, fm: new Map() }); })();
    const ter = d.ter || 0, rr = Ei / Ev;
    cases.tempP = scaleRes(tUnit, (d.tep - ter) + ter * rr); // dilatation
    cases.tempM = scaleRes(tUnit, (d.tem + ter) - ter * rr); // contraction (tem < 0)
    R.cases = cases;

    // --- répartition transversale (Guyon-Massonnet)
    // portée fictive : flèche relative à mi-portée sous charge uniforme = 5 q Lf^4 / 384 EI
    const uq = qUnit.u; const jm = idx(xsTop, Lh);
    const wrel = -(uq[m.top[jm] * 3 + 1] - (uq[m.top[0] * 3 + 1] + uq[m.top[m.top.length - 1] * 3 + 1]) / 2) * EIt / G;
    const Lf = Math.pow(wrel * 384 / 5, 0.25);
    const theta = b / Lf;
    const fib = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
    const Ktab = fib.map(e => guyonK(theta, fib, e));
    const ePrint = fib.map(f => f * b);
    R.guyon = { Lf, theta, Ktab, fibres: ePrint };
    // --- flexion transversale : plaque rectangulaire équivalente sur appuis simples (biais mécanique)
    const eta = W / d.ouver, psi = d.biais + (100 - d.biais) * Math.pow(Math.max(0, 1 - eta / 2), 2) * (eta < 2 ? 1 : 0);
    const sp = Math.sin(psi * Math.PI / 200), LA = W / sp, LO = Lf * sp, bT = LA / 2, thT = bT / LO;
    const muFib = [0, 0.25, 0.5, 0.75].map(f => f * bT);
    const gridMu = [-bT]; for (let y = Math.ceil(-bT / STP - 1e-9) * STP; y <= bT + 1e-9; y += STP) gridMu.push(+y.toFixed(4)); gridMu.push(bT);
    R.mu = { psi, LA, LO, bT, thT, fibres: muFib.map(fy => {
      const ys = gridMu.filter(y => Math.abs(y - fy) > 0.005 || Math.abs(y - +fy.toFixed(2)) < 1e-9).concat([]);
      if (!ys.some(y => Math.abs(y - fy) < 0.005)) ys.push(fy);
      ys.sort((a, c) => a - c);
      return { fy, rows: ys.map(y => ({ y, fib: Math.abs(y - fy) < 0.005, v: [1, 3, 5].map(n => 1000 * guyonMu(n * thT, fy / bT, y / bT)) })) };
    }) };
    // Coefficients de répartition transversale : maximum sur les fibres d'étude y ∈ [-b+0.5, b-0.5]
    // (règle reconstituée : reproduit AL, E, EC et TERRE à ~1 % près ; Bc/Bt/Mc/Me restent 5-10 % forts).
    const c0 = -b + d.etrotg + d.egau, c1 = c0 + d.esurch;
    const a1tab = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] }[d.cl] || [1, 1, 0.9, 0.75, 0.7];
    const v0 = { 1: 3.5, 2: 3.0, 3: 2.75 }[d.cl] || 3.5;
    const a2 = v0 / v;
    const hy = 0.025, gridY = []; for (let y = -b; y <= b + 1e-9; y += hy) gridY.push(y);
    const best = { AL: new Array(nvoi).fill(0), BC: new Array(Math.min(nvoi, 4)).fill(0), BT: new Array(Math.min(nvoi, 2)).fill(0), MC: 0, ME: 0, E: 0, EC: 0, TERRE: 0 };
    for (let f = -b + 0.5; f <= b - 0.5 + 1e-9; f += b / 40) {
      const K = guyonK(theta, gridY.map(y => y / b), f / b);
      const Ki = y => { const t = (y + b) / hy, j = Math.max(0, Math.min(gridY.length - 2, Math.floor(t))); return K[j] + (K[j + 1] - K[j]) * (t - j); };
      const integ = (a, c) => { const N = Math.max(4, Math.ceil((c - a) / hy)); let sm = 0; for (let k = 0; k < N; k++) sm += Ki(a + (k + 0.5) * (c - a) / N); return sm / N * (c - a) / (2 * b); };
      if (root.PICF_ALOLD) for (let k = 1; k <= nvoi; k++) for (let st = 0; st + k <= nvoi; st++) best.AL[k - 1] = Math.max(best.AL[k - 1], integ(c0 + st * v, c0 + (st + k) * v));
      if (hasEC) {
        const e0 = -b + d.ec.egau, e1 = e0 + d.ec.esurch;
        if (root.PICF_ALOLD) best.TERRE = Math.max(best.TERRE, integ(e0, e1));
        for (let c = e0 + 3; c <= e1 - 3 + 1e-9; c += 0.05) best.EC = Math.max(best.EC, (Ki(c - 1.2) + Ki(c + 1.2)) / 2 / (2 * b));
      }
    }
    // AL et TERRE (session g) : 9 fibres de la section médiane (K exact) ; CHAQUE VOIE est diffusée transversalement jusqu'au
    // plan moyen de la traverse (sD = 2·HCHAU + 2·HSREM·tan30° + E3, comme les chenilles), la bande est coupée aux bords de la
    // dalle (±b) et la charge de la voie y est renormalisée (rien n'est perdu) ; k voies = somme des voies contiguës.
    // TERRE (remblai de chantier) : bande EC (EGAU, ESURCH) diffusée de 2·HSREM(chantier)·tan30° + E3, même renormalisation.
    // Reproduit AL 2498 0.333/0.667/1.000 (0.334/0.667/1.001), 2531 0.497/0.772/0.911/1.005, 2550 0.477/0.709/0.882,
    // 2551 0.482/0.719/0.880 (exact), TERRE 0.682/0.621 (0.682/0.622).
    if (!root.PICF_ALOLD) {
      const t30 = Math.tan(Math.PI / 6), sAL = 2 * d.hchau + 2 * d.hsrem * t30 + d.e3;
      const band = (Ki, a, c, sd) => { const lo = Math.max(-b, a - sd / 2), hi = Math.min(b, c + sd / 2), N = 400; let sm = 0;
        for (let k = 0; k < N; k++) sm += Ki(lo + (k + 0.5) * (hi - lo) / N); return sm / N * (c - a) / (2 * b); };
      const hy2 = b / 200, gy2 = []; for (let y = -b; y <= b + 1e-9; y += hy2) gy2.push(y / b);
      let ecN = 0;
      for (const fe of fib) { const K = guyonK(theta, gy2, fe);
        const Ki = y => { const t = (y + b) / hy2, j = Math.max(0, Math.min(gy2.length - 2, Math.floor(t))); return K[j] + (K[j + 1] - K[j]) * (t - j); };
        const lane = []; for (let j = 0; j < nvoi; j++) lane.push(band(Ki, c0 + j * v, c0 + (j + 1) * v, sAL));
        for (let k = 1; k <= nvoi; k++) for (let st = 0; st + k <= nvoi; st++) { let x = 0; for (let j = st; j < st + k; j++) x += lane[j]; best.AL[k - 1] = Math.max(best.AL[k - 1], x); }
        if (hasEC) { const e0 = -b + d.ec.egau; best.TERRE = Math.max(best.TERRE, band(Ki, e0, e0 + d.ec.esurch, 2 * (d.ec.hsrem || 0) * t30 + d.e3));
          if (!root.PICF_ECOLD) { const w = 0.6 + 2 * (d.ec.hsrem || 0) * t30 + d.e3, e1 = e0 + d.ec.esurch; // engin : roues 0.60 m à ±1.20 m, même diffusion
            const bw = (lo0, hi0) => { const lo = Math.max(-b, lo0), hi = Math.min(b, hi0), N = 200; let sm = 0; for (let k = 0; k < N; k++) sm += Ki(lo + (k + 0.5) * (hi - lo) / N); return sm / N; };
            for (let c = e0 + 3; c <= e1 - 3 + 1e-9; c += 0.05) { const v = w >= 2.4 ? bw(c - 1.2 - w / 2, c + 1.2 + w / 2) : (bw(c - 1.2 - w / 2, c - 1.2 + w / 2) + bw(c + 1.2 - w / 2, c + 1.2 + w / 2)) / 2;
              ecN = Math.max(ecN, v / (2 * b)); } } }
      }
      if (hasEC && !root.PICF_ECOLD) best.EC = ecN;
    }
    // Charges concentrées et convoi E (notice SETRA PICF/PIPO § 2.5.2 : « en examinant successivement 9 fibres
    // de la section médiane ») : lignes d'influence de K interpolées linéairement dans la table 9×9, charges
    // tenues à 0.50 m des bords de la chaussée chargeable (plus 0.25 m roue Bc / 0.50 m roue Bt dans leur file).
    for (const R of Ktab) {
      const Ki = y => { const t = (y / b + 1) / 0.25, j = Math.max(0, Math.min(7, Math.floor(t))); return R[j] + (R[j + 1] - R[j]) * (t - j); };
      const integ = (a, c) => { const N = 100; let sm = 0; for (let k = 0; k < N; k++) sm += Ki(a + (k + 0.5) * (c - a) / N); return sm / N * (c - a) / (2 * b); };
      const pts = (ws, lo, hi) => { let bb = 0; for (let st = lo; st + ws[ws.length - 1] <= hi + 1e-9; st += 0.05) bb = Math.max(bb, ws.reduce((a, w) => a + Ki(st + w), 0) / ws.length); return bb / (2 * b); };
      // Diffusion transversale jusqu'au plan moyen de la traverse (45° chaussée, pente 3/4 dans le remblai H.SUP, + E3) ;
      // les empreintes diffusées des roues d'un même véhicule se fondent en une bande unique quand elles se recouvrent
      // (charge du véhicule uniformément répartie), la partie hors de la dalle est perdue ; véhicules distincts sommés.
      // Retrouvé sur 2498 (H.SUP 15.70 m : Bc 0.038/0.075/0.113, Mc 0.035) et améliore Mc/Me de 2550/2551.
      // marge de 0.50 m au bord de la largeur chargeable, sauf si le bordereau donne déjà les bandes EGAU/EDROI (2550/2551)
      const MG = root.PICF_MG ? root.PICF_MG(d) : (d.egau > 0 && d.edroi > 0 ? 0 : 0.5);
      const sD = root.PICF_SD ? root.PICF_SD(d) : 2 * d.hchau + 1.5 * d.hsrem + d.e3;
      const uni = (cs, a) => { const w = a + sD; if (w < 1e-9) return cs.reduce((q, c) => q + Ki(c), 0) / cs.length;
        const iv = cs.map(c => [c - w / 2, c + w / 2]).sort((x, y) => x[0] - y[0]), cl = [];
        for (const v of iv) { const L = cl[cl.length - 1]; if (L && v[0] <= L[1] + 1e-9) { L[1] = Math.max(L[1], v[1]); L[2]++; } else cl.push([v[0], v[1], 1]); }
        let tot = 0; for (const [l0, l1, n] of cl) { const lo = Math.max(-b, l0), hi = Math.min(b, l1); if (hi <= lo) continue; const N = 60; let sm = 0;
          for (let k = 0; k < N; k++) sm += Ki(lo + (k + 0.5) * (hi - lo) / N); tot += n * sm / N * (hi - lo) / (l1 - l0); }
        return tot / cs.length; };
      const veh = (k, sp, gap, a, mg) => { let bb = 0; for (let st = c0 + mg; st + (k - 1) * sp + gap <= c1 - mg + 1e-9; st += 0.05) {
          let v = 0; for (let u = 0; u < k; u++) v += uni([st + u * sp, st + u * sp + gap], a); if (v > bb) bb = v; } return bb / (2 * b); };
      for (let k = 1; k <= best.BC.length; k++) best.BC[k - 1] = Math.max(best.BC[k - 1], veh(k, 2.5, 2, 0.25, MG + 0.25));
      for (let k = 1; k <= best.BT.length; k++) best.BT[k - 1] = Math.max(best.BT[k - 1], veh(k, 3, 2, 0.6, MG + 0.5));
      for (let st = c0 + 0.5; st + 4.3 <= c1 - 0.5 + 1e-9; st += 0.05) best.MC = Math.max(best.MC, uni([st + 0.5, st + 3.8], 1) / (2 * b));
      for (let st = c0 + 0.5; st + 4 <= c1 - 0.5 + 1e-9; st += 0.05) best.ME = Math.max(best.ME, uni([st + 2], 4) / (2 * b));
      for (let c = c0 + 3.5; c <= c1 - 3.5 + 1e-9; c += 0.05) best.E = Math.max(best.E, uni([c - 0.825, c + 0.825], 0) / (2 * b));
    }
    const coefs = { AL: best.AL.map((c, i) => ({ n: i + 1, c, a1: a1tab[Math.min(i + 1, a1tab.length) - 1], a2 })),
      BC: best.BC.map((c, i) => ({ n: i + 1, c, bc: [1.2, 1.1, 0.95, 0.8][i] })), BT: best.BT.map((c, i) => ({ n: i + 1, c, bt: 1.0 })),
      MC: best.MC, ME: best.ME, E: best.E };
    coefs.ALf = Math.max(...coefs.AL.map(o => o.c * o.a1 * o.a2));
    coefs.BCf = Math.max(...coefs.BC.map(o => o.c * o.bc));
    coefs.BTf = Math.max(...coefs.BT.map(o => o.c * o.bt));
    if (hasEC) { coefs.EC = best.EC; coefs.TERRE = best.TERRE; }
    if (root.PICF_DIAG_COEFS) Object.assign(coefs, root.PICF_DIAG_COEFS); // diagnostic uniquement (jamais en production)
    R.coefs = coefs;
    if (ch) { cases.chqN = scaleRes(qUnit, ch.qn * coefs.TERRE); cases.chqX = scaleRes(qUnit, ch.qx * coefs.TERRE); }

    // --- surcharges : enveloppes par section
    // valeur d'une LI à l'abscisse x (x<0 ou x>L : sur la dalle de transition, réaction en tête de piédroit)
    const Ld = d.ldalt / s, Ld0 = Ld;
    function ilVal(getter, x, noDalle) {
      if (noDalle && (x < 0 || x > L)) return 0;
      const Ld = getter.Ld || Ld0;
      if (x < 0) { if (x < -Ld) return 0; return (getter.ends ? getter.ends[0] : getter(0)) * (1 + x / Ld); }
      if (x > L) { if (x > L + Ld) return 0; return (getter.ends ? getter.ends[1] : getter(xsTop.length - 1)) * (1 - (x - L) / Ld); }
      let i = 0, hi = xsTop.length - 1; while (hi - i > 1) { const mid = (i + hi) >> 1; if (xsTop[mid] <= x) i = mid; else hi = mid; }
      const t = (x - xsTop[i]) / (xsTop[hi] - xsTop[i]); return getter(i) * (1 - t) + getter(hi) * t;
    }
    function ilAvg(getter, x, a, nd) { if (!a) return ilVal(getter, x, nd); const n = Math.max(2, Math.ceil(a / 0.1)); let sm = 0; for (let k = 0; k < n; k++) sm += ilVal(getter, x - a / 2 + (k + 0.5) * a / n, nd); return sm / n; }
    // chenilles Mc / convoi E (hook d'essai PICF_MCL) : densité P/λ, aire sur floor(λ/pas)·pas
    const MCL = root.PICF_MCL;
    const mcl = MCL ? (getter, x, ax, nd) => { const lam = MCL.lam(d, ax), li = MCL.floor ? Math.floor(lam / STP + 1e-9) * STP : lam;
      const xc = MCL.align === 'start' ? x - lam / 2 + li / 2 : x; return ax.P / lam * li * ilAvg(getter, xc, li, nd); } : null;
    function envelope(getter, nd, nodyn) {
      const res = {};
      // AL : zones de même signe ; longueur chargée = somme des zones
      // zones : dalles de transition séparées de la travée ; dans la travée, changement de signe.
      // On retient le sous-ensemble de zones de même signe qui maximise A(l)·aire (A dépend de la longueur chargée).
      const segs = [[-Ld, 0], [0, L], [L, L + Ld]];
      for (const sg of [1, -1]) {
        const zones = [];
        for (const [x0, x1] of segs) {
          const n = Math.max(4, Math.ceil((x1 - x0) / 0.01)); let cur = null;
          for (let k = 0; k < n; k++) {
            const a0 = x0 + (x1 - x0) * k / n, a1 = x0 + (x1 - x0) * (k + 1) / n;
            const va = sg * ilVal(getter, a0 + 1e-9, nd), vb = sg * ilVal(getter, a1 - 1e-9, nd), h = a1 - a0;
            let ar = 0, ln = 0;
            if (va >= 0 && vb >= 0) { ar = h * (va + vb) / 2; ln = (va > 0 || vb > 0) ? h : 0; }
            else if (va > 0 || vb > 0) { const z = va / (va - vb) * h; if (va > 0) { ar = va * z / 2; ln = z; } else { ar = vb * (h - z) / 2; ln = h - z; } }
            if (ln > 0) { if (!cur) { cur = { area: 0, len: 0 }; zones.push(cur); } cur.area += ar; cur.len += ln; if (vb <= 0) cur = null; }
            else cur = null;
          }
        }
        let best = { v: 0, len: 0 };
        for (let mask = 1; mask < (1 << zones.length); mask++) {
          let area = 0, len = 0; zones.forEach((z, i) => { if (mask & (1 << i)) { area += z.area; len += z.len; } });
          const v = (0.23 + 36 / (len + 12)) * area; if (v > best.v) best = { v, len };
        }
        res['AL' + (sg > 0 ? '+' : '-')] = { v: sg * best.v * G * coefs.ALf, len: best.len };
      }
      for (const key of ['BC', 'BT', 'MC', 'ME', 'E'].concat(hasEC ? ['EC'] : [])) {
        const cv = conv[key]; let mx = 0, mn = 0, pmx = null, pmn = null;
        const span = cv.axles[cv.axles.length - 1].x + (cv.trucks > 1 ? cv.gapTruck : 0);
        const STEP = 0.5; for (const dir of [1, -1]) for (let nt = 1; nt <= cv.trucks; nt++) {
          // l'essieu le plus à droite parcourt la grille de pas 0.5 m (convention déduite des positions imprimées)
          const sp = cv.axles[cv.axles.length - 1].x + (nt - 1) * (cv.gapTruck || 0);
          for (let kx = Math.floor(-Ld / STEP) - 1; kx * STEP <= L + Ld + sp + 1e-9; kx++) { const x0 = dir > 0 ? kx * STEP - sp : kx * STEP;
          let sm = 0;
          for (let t = 0; t < nt; t++) for (const ax of cv.axles) { const x = x0 + dir * (ax.x + t * (cv.gapTruck || 0)); sm += mcl && (key === 'MC' || key === 'E') ? mcl(getter, x, ax, nd) : ax.P * ilAvg(getter, x, vNoA && (key === 'BC' || key === 'BT' || key === 'ME') ? vNoA(ax, d) : ax.a || 0, nd); }
          if (sm > mx) { mx = sm; pmx = { dir, x0, nt }; } if (sm < mn) { mn = sm; pmn = { dir, x0, nt }; }
        } }
        // Bc : distance entre camions d'une même file VARIABLE (≥ 4.50 m entre essieux extrêmes, fascicule 61 II) ; chaque camion
        // a son essieu le plus à droite sur la grille de pas 0.5 m (positions imprimées « DG -5.00 13.50 » : écart 18.5 m).
        if (cv.trucks > 1 && !root.PICF_BCFIX) { const tl = cv.axles[cv.axles.length - 1].x;
          for (const dir of [1, -1]) { const ks = [], vs = [];
            for (let kx = Math.floor(-Ld / STEP) - 1; kx * STEP <= L + Ld + tl + 1e-9; kx++) { const x0 = dir > 0 ? kx * STEP - tl : kx * STEP; let sm = 0;
              for (const ax of cv.axles) { const x = x0 + dir * ax.x; sm += ax.P * ilAvg(getter, x, vNoA && (key === 'BC' || key === 'BT' || key === 'ME') ? vNoA(ax, d) : ax.a || 0, nd); }
              if (root.PICF_BCG && dir < 0 && x0 < -1e-9) sm = 0; ks.push(x0); vs.push(sm); }
            const gmin = Math.round(cv.gapTruck / STEP);
            for (let i = 0; i < vs.length; i++) for (let j = i + gmin; j < vs.length; j++) { const sm = vs[i] + vs[j];
              if (root.PICF_BCTIE ? sm >= mx - 1e-9 : sm > mx + 1e-12) { mx = sm; pmx = { dir, x0: ks[i], nt: 2, xs: [ks[i], ks[j]] }; } if (root.PICF_BCTIE ? sm <= mn + 1e-9 : sm < mn - 1e-12) { mn = sm; pmn = { dir, x0: ks[i], nt: 2, xs: [ks[i], ks[j]] }; } } } }
        const k = { BC: coefs.BCf * dyn.BC.d, BT: coefs.BTf * dyn.BT.d, MC: coefs.MC * dyn.MC.d, ME: coefs.ME * dyn.ME.d, E: coefs.E * dyn.E.d, EC: hasEC ? coefs.EC * 1.5 : 0 }[key];
        const kk = nodyn ? k / ({ BC: dyn.BC.d, BT: dyn.BT.d, MC: dyn.MC.d, ME: dyn.ME.d, E: 1, EC: 1.5 }[key]) : k;
        res[key + '+'] = { v: mx * G * kk, pos: pmx }; res[key + '-'] = { v: mn * G * kk, pos: pmn };
      }
      return res;
    }
    const getters = {
      t: studyT.map((_, k) => i => ilTop[i].t[k].M), b: studyB.map((_, k) => i => ilTop[i].b[k].M), w: studyW.map((_, k) => i => ilTop[i].w[k].M),
      Vt: studyT.map((_, k) => i => ilTop[i].t[k].V), Vb: studyB.map((_, k) => i => ilTop[i].b[k].V), Vw: studyW.map((_, k) => i => ilTop[i].w[k].V),
      p: [0, 1, 2].map(k => i => ilTop[i].p[k] * 1000),
      det: [0, 1, 2, 3, 4, 5].map(k => i => ilTop[i].det[k]),
    };
    // LI connues aux seuls points de la grille des tableaux (pas STP), interpolation linéaire entre eux ; effort tranchant des
    // traverses : pas de point dédoublé, ordonnée du côté gauche au droit de la section (règle PIPO tour 7, hook PICF_JV).
    const JV = root.PICF_JV != null ? root.PICF_JV : 1, JVS = root.PICF_JVS || 0;
    const coarse = (raw, xk) => { const gv = ilAbs.map(g => { const i = idx(xsTop, g);
        if (xk != null && Math.abs(g - xk) < 1e-6) return JVS > 0 ? 2 * raw(i + 1) - raw(i + 2) : (i >= 2 ? (root.PICF_JVR ? raw(i) - Math.round(raw(i) - 2 * raw(i - 1) + raw(i - 2)) : 2 * raw(i - 1) - raw(i - 2)) : raw(i)); return raw(i); });
      const memo = xsTop.map(x => { let k = 0; while (k < ilAbs.length - 2 && ilAbs[k + 1] < x - 1e-9) k++; const t = (x - ilAbs[k]) / (ilAbs[k + 1] - ilAbs[k]); return gv[k] * (1 - t) + gv[k + 1] * t; });
      const fn = i => memo[i]; fn.ends = raw.ends; fn.Ld = raw.Ld; return fn; };
    // V du radier sous les charges de la dalle de transition : effet des seuls moments d'encastrement (règle des permanentes) —
    // on retranche la réponse à la force verticale transmise directement au pied du piédroit (hook PICF_VBD).
    if (root.PICF_VBD && Ld > 0) { const ex = nd => { const F = new Float64Array(m.n); F[nd * 3 + 1] = -1; return extract(solve(F)); };
      const bl = ex(m.bot[0]), br = ex(m.bot[m.bot.length - 1]), nT = xsTop.length - 1;
      getters.Vb = getters.Vb.map((g, k) => { const v0 = g(0) - bl.b[k].V, v1 = g(nT) - br.b[k].V; const f = i => g(i); f.ends = [v0, v1]; return f; }); }
    if (JV) { for (const [key, sec] of [['Vt', secB], ['Vb', secB]]) getters[key] = getters[key].map((g, k) => coarse(g, sec[k]));
      if (JV === 2) for (const key of ['t', 'b', 'w', 'Vw', 'p', 'det']) getters[key] = getters[key].map(g => coarse(g, null)); }
    if (root.PICF_LDV) getters.Vb.forEach(g => { g.Ld = root.PICF_LDV(d, s, Ld); });
    if (root.PICF_GET) root.PICF_GET(getters, { L, Ld, xsTop, ilVal });
    R.env = {};
    // effort tranchant : diffusion longitudinale des roues (Bc, Bt, Me) à 45° dans la chaussée mais pente 1/2 dans le remblai
    const vWheel = (a, dd) => a.a - dd.hsrem;
    let vNoA = null; for (const key of Object.keys(getters)) R.env[key] = getters[key].map(gt => (vNoA = (root.PICF_VKEYS || ['Vt']).includes(key) ? (root.PICF_VNOA || vWheel) : null, envelope(gt, (key === 'p' && !!root.PICF_PND) || (key === 'Vb' && !!root.PICF_VBND), key === 'p')));
    // traverses : SETRA reprend à mi-portée les efforts tranchants des surcharges de la section précédente
    for (const key of root.PICF_VBNC ? ['Vt'] : ['Vt', 'Vb']) { const a = R.env[key]; if (a.length > 1) a[a.length - 1] = a[a.length - 2]; }
    // V traverse inférieure à l'angle (x = 0) : SETRA imprime MIN = 0 pour toutes les surcharges (2531/2550/2551, EC34 compris) ;
    // nos minima (−0.3 à −1.5 kN) viennent de la LI légèrement négative sur la dalle de transition opposée (hook PICF_VB0 = ancien).
    if (!root.PICF_VB0 && R.env.Vb.length) { const e = R.env.Vb[0]; for (const k of Object.keys(e)) if (k.endsWith('-') && e[k].v < 0) e[k] = Object.assign({}, e[k], { v: 0 }); }
    R.sections = { t: secB, b: secB, w: secWfull, det: [0, 1, 2, 3, 4, 5] };
    R.cmp = combine(R, d, hasEC);
    R.tr = transversal(R, d, { conv, dyn, coefs, c0, c1, v, nvoi, a1tab, a2, hasEC, ch, qsup });
    R.fer = ferraillage(R, d);
    R.det = detailing(R, d);
    // avant-métré (règles déduites des p.32) : goussets supposés 0.50×0.50 (sup.) et 0.60×0.60 (inf.)
    {
      const W = d.large, Lb = (d.ouver + 2 * d.e2) / s, gus = 2 * 0.5 * 0.5 / 2 + 2 * 0.6 * 0.6 / 2;
      const sect = (d.e1 + d.e3) * Lb + 2 * d.hautl * d.e2 / s; // section dans le plan d'about
      R.metre = { beton: sect * W + gus * W / s,
        coffrage: 2 * (d.hautl + d.e1 + d.e3) * W + 2 * d.hautl * W + d.ouver / s * W + 2 * (sect + gus / s) };
    }
    return R;
  }

  // ---------------------------------------------------------------- ferraillage BAEL (règles reconstituées sur les p.26 des listings)
  // ELU : diagramme parabole-rectangle (béton 3.5‰/2‰, acier 10‰), fbu = 0.85 fc/(0.85·1.5) (charges d'exploitation), b = 1 m.
  function asELU(M, d, fbu, fsu) { // M en MN.m, retourne m²/m
    if (M <= 0) return 0;
    const res = x => { const es = Math.min(0.01, 0.0035 * (d - x) / x); const ec = es === 0.01 ? 0.01 * x / (d - x) : 0.0035; const N = 120; let F = 0, Mo = 0;
      for (let k = 0; k < N; k++) { const y = (k + 0.5) * x / N, e = ec * (1 - y / x), sg = e < 0.002 ? fbu * (1 - (1 - e / 0.002) ** 2) : fbu; F += sg * x / N; Mo += sg * x / N * (d - y); } return [F, Mo]; };
    let lo = 1e-5, hi = d * 0.99; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (res(m)[1] < M) lo = m; else hi = m; }
    return res(lo)[0] / fsu;
  }
  // ELS : section fissurée, n = 15
  function elsStress(M, A, d) { if (!(A > 0) || M <= 0) return { ss: 0, sb: 0 }; const nA = 15 * A; const x = (-nA + Math.sqrt(nA * nA + 2 * nA * d)); const I = x ** 3 / 3 + nA * (d - x) ** 2; return { ss: 15 * M * (d - x) / I, sb: M * x / I }; }
  function asELS(M, d, ssl) { // section d'acier telle que σs = σs limite (fissuration préjudiciable)
    if (!ssl || M <= 0) return 0; let lo = 1e-6, hi = 0.2;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (elsStress(M, m, d).ss > ssl) lo = m; else hi = m; } return hi;
  }
  function ferraillage(R, d) {
    const s = R.geom.s, fbu = R.mat.fbuQ, fsu = R.mat.fsu[0], c = d.enrob;
    const phiA = d.phi.map(p => Math.PI * (p / 1000) ** 2 / 4);
    const dd = (h, phi) => h - c - 0.6 * phi / 1000 - 1.1 * d.phi[1] / 1000; // hauteur utile : déduite des efforts résistants béton imprimés (4 passages, φ14/25/32)
    const C = R.cmp;
    const mx = (arr, f) => Math.max(...arr.map(f));
    const M = { // [ELU, ELS] en kN.m (valeurs absolues de la fibre tendue considérée)
      AS: [-C.t[0].design.minU, -C.t[0].design.minS], AI: [-C.b[0].design.minU, -C.b[0].design.minS],
      TS: [mx(C.t, c => c.design.maxU), mx(C.t, c => c.design.maxS)], TI: [mx(C.b, c => c.design.maxU), mx(C.b, c => c.design.maxS)],
      PD: [Math.max(0, mx(C.w, c => c.design.maxU)), Math.max(0, mx(C.w, c => c.design.maxS))] };
    const row = (key, h, fac, phi) => ({ key, h, d: dd(h, phi), MU: M[key][0] * fac, MS: M[key][1] * fac, Amin: Math.max(asELU(M[key][0] * fac / 1000, dd(h, phi), fbu, fsu), asELS(M[key][1] * fac / 1000, dd(h, phi), R.mat.ssLim ? R.mat.ssLim[0] : 0)) });
    const r = { AS_T: row('AS', d.e3, 1, d.phi[0]), AS_P: row('AS', d.e2, s, d.phi[0]), AI_T: row('AI', d.e1, 1, d.phi[0]), AI_P: row('AI', d.e2, s, d.phi[0]),
      TS: row('TS', d.e3, 1, d.phi[0]), TI: row('TI', d.e1, 1, d.phi[0]), PD: row('PD', d.e2, s, d.phi[1]) };
    const Amin0 = 3 * phiA[1]; // minimum : 1 PHI2 tous les 1/3 m (ferraillage plancher ; 2498 : 0.001473 = 3·A(φ25))
    // extérieur : espacement commun, 2 PHI1
    const Vmax = el => Math.max(...C['V' + el].map(c => Math.max(Math.abs(c.design.maxU), Math.abs(c.design.minU)))) / 1000;
    r.tauMax = Math.max(Vmax('b') / r.AI_T.d, Vmax('t') / r.AS_T.d, Vmax('w') / dd(d.e2, d.phi[0]));
    const grpMode = r.tauMax > R.mat.tauLim0;
    // maille de base : hors mode groupes, max des angles ; en mode groupes, section la plus sollicitée des traverses
    // (angles ou milieux — notice PIPO §3.3.3.1 ; 2498 : 0.009852 = TI, 2551 : 0.003884 = angle sup.)
    const Aext = grpMode ? Math.max(r.AS_T.Amin, r.AI_T.Amin, r.TS.Amin, r.TI.Amin) : Math.max(r.AS_T.Amin, r.AI_T.Amin);
    const eExt = 2 * phiA[0] / Aext;
    r.groupMode = grpMode; r.eGroup = eExt;
    for (const k of ['AS_T', 'AI_T']) Object.assign(r[k], { A: Aext, n: 2, phi: 0, esp: eExt / 2 });
    for (const k of ['AS_P', 'AI_P']) Object.assign(r[k], { A: Aext * s, n: 2, phi: 0, esp: eExt / 2 / s });
    // mode « groupes de 2 fers au plus » (2551) : espacement de groupe commun = celui de l'extérieur
    // déclenchement : des étriers sont nécessaires (τu = Vu/d > 0.07 fc/γb dans un élément quelconque) — vérifié sur les 4 passages
    if (r.groupMode) for (const k of ['TS', 'TI', 'PD']) {
      const E = k === 'PD' ? eExt / s : eExt, A = r[k].Amin;
      const opts = [[1, 1], [2, 1], [1, 0], [2, 0]].map(([n, ph]) => ({ n, phi: ph, A: n * phiA[ph] / E, esp: E / n }));
      const o = opts.find(o => o.A >= A - 1e-9) || opts[3]; Object.assign(r[k], { A: o.A, n: o.n, phi: o.phi, esp: o.esp, grp: E });
    }
    if (!r.groupMode) for (const k of ['TS', 'TI', 'PD']) {
      const A = r[k].Amin;
      if (A <= Amin0) Object.assign(r[k], { A: Amin0, n: 1, phi: 1, esp: 0.333 });
      else { const e1 = 2 * phiA[0] / A; const ph = e1 / 2 > 0.33 ? 1 : 0; const A2 = Math.max(A, Amin0); Object.assign(r[k], { A: A2, n: 2, phi: ph, esp: phiA[ph] / A2 }); }
    }
    for (const k of Object.keys(r)) { const o = r[k]; o.d = dd(o.h, d.phi[o.phi]); Object.assign(o, elsStress(o.MS / 1000, o.A, o.d)); o.VRb = R.mat.tauLim * o.d * 1000;
      // effort tranchant « acier » : adhérence d'entraînement, périmètre 4A/φ × τs × d
      o.VRs = 4 * o.A / (d.phi[o.phi] / 1000) * R.mat.taus * o.d * 1000; }
    // non-fragilité : moment de fissuration ft·h²/6 repris par As·fe·0.9d, d = h − enrobage − φ2/2 (même hauteur utile que A20) ;
    // exact 0.000575 / 0.000497 / 0.000800 (h 0.70 / 0.60 / 0.85) ; piédroits ÷ sin(biais)
    const anf = h => root.PICF_ANF0 ? 0.0008 * h : R.mat.ft * h * h / (6 * d.fe[1] * 0.9 * (h - c - d.phi[1] / 2000));
    r.ANF = { t: anf(d.e3), b: anf(d.e1), w: anf(d.e2) / s };
    // ferraillage transversal de la traverse supérieure (face intérieure) : moments transversaux de calcul (p.21),
    // barres PHI2 en nappe extérieure : d = e3 − enrobage − φ2/2 (A20 exact sur 2531/2550/2551 à partir des moments imprimés)
    if (R.tr) { const dT = d.e3 - c - d.phi[1] / 2000; r.dT = dT;
      r.A20 = asELU(R.tr.design.U / 1000, dT, fbu, R.mat.fsu[1]);
      r.A10 = R.mat.ssLim ? asELS(R.tr.design.S / 1000, dT, R.mat.ssLim[1]) : 0; }
    return r;
  }

  // ---------------------------------------------------------------- épure d'arrêt, nomenclature, étriers (règles déduites des p.27–31)
  // E : enveloppes de calcul aux sections du listing { TS, TI, PD : [{x, maxU, maxS, minU, minS}] } (kN.m ; PD par m biais).
  function envFromCmp(R) {
    const f = a => a.map(c => ({ x: c.x, maxU: c.design.maxU, maxS: c.design.maxS, minU: c.design.minU, minS: c.design.minS }));
    return { TS: f(R.cmp.t), TI: f(R.cmp.b), PD: f(R.cmp.w) };
  }
  function detailing(R, d, E) {
    E = E || envFromCmp(R);
    const g = R.geom, s = g.s, L = g.L, H = g.H, fer = R.fer, fbu = R.mat.fbuQ, grp = !!fer.groupMode;
    const ls = i => d.phi[i] / 1000 * d.fe[i] / (4 * R.mat.taus);           // longueur de scellement droit BAEL
    const area = i => Math.PI * (d.phi[i] / 1000) ** 2 / 4;
    const need = (o, MU, MS, fac) => Math.max(asELU(MU * fac / 1000, o.d, fbu, R.mat.fsu[o.phi]), asELS(MS * fac / 1000, o.d, R.mat.ssLim ? R.mat.ssLim[o.phi] : 0));
    const tol = 1e-9;
    // --- ferraillage intérieur des traverses : 2 familles, arrêt au pas des sections, décalage a = 0.8 h
    function travInt(o, env, h) {
      const a = 0.8 * h; const nd = env.map(r => need(o, r.maxU, r.maxS, 1));
      let im = 0; nd.forEach((v, k) => { if (v > nd[im]) im = k; });
      let zero = 0, half = null;
      if (!grp) for (let k = im; k >= 0; k--) if (!(env[k].maxU > 0 || env[k].maxS > 0)) { zero = Math.max(0, env[k].x - a); break; }
      for (let k = im; k >= 0; k--) if (nd[k] <= o.A / 2 + tol) { half = Math.max(0, env[k].x - a); break; }
      if (half === null || half < zero) half = zero;
      const bars = o.n === 1 ? [[zero, L - zero]] : [[zero, L - half], [half, L - zero]];
      return { phi: o.phi, esp: o.esp, bars };
    }
    // --- ferraillage intérieur des piédroits (abscisses depuis la base)
    function pdInt(o, env, h) {
      const a = 0.8 * h, bot = grp ? 0 : g.e1 / 2, top = grp ? H : H - g.e3 / 2 - 0.15;
      if (o.n === 1) return { phi: o.phi, esp: o.esp / 2, bars: [[bot, 1 + ls(o.phi)], [1, top]] };
      const nd = env.map(r => need(o, r.maxU, r.maxS, s));
      let im = 0; nd.forEach((v, k) => { if (v > nd[im]) im = k; });
      let up = top, lo = bot;
      for (let k = im; k < env.length; k++) if (nd[k] <= o.A / 2 + tol) { up = Math.min(top, env[k].x + a); break; }
      for (let k = im; k >= 0; k--) if (nd[k] <= o.A / 2 + tol) { lo = Math.max(bot, env[k].x - a); break; }
      return { phi: o.phi, esp: o.esp, bars: [[bot, up], [lo, top]] };
    }
    // --- ferraillage extérieur des angles : côté traverse (depuis l'angle) et côté piédroit
    function angle(oT, oP, envT, envP, hT, sup) {
      const aT = 0.8 * hT, aP = 0.8 * g.e2;
      let zero = null, half = null, lap = false;
      for (const r of envT) { if (zero === null && !(r.minU < 0 || r.minS < 0)) zero = r.x + aT;
        if (half === null && need(oT, -r.minU, -r.minS, 1) <= oT.A / 2 + tol) half = r.x + aT; }
      if (zero === null) { zero = L / 2 + ls(0) / 2; lap = true; }
      if (half === null || half > zero) half = zero;
      const full = sup ? 2.5 - ls(0) : 2.5; let hp = null;
      const seq = sup ? envP.slice().reverse() : envP;
      for (const r of seq) if (need(oP, -r.minU, -r.minS, s) <= oP.A / 2 + tol) { hp = sup ? r.x - aP : r.x + aP; break; }
      if (hp === null || (sup ? hp < full : hp > full)) hp = full;
      const fam = lap ? [[full, zero], [hp, half]] : [[full, half], [hp, zero]];
      const e = sup ? (g.e2 + g.e3) / 2 : (g.e1 + g.e2) / 2;
      return { phi: 0, espP: oP.esp, espT: oT.esp, lap, zero, bars: fam.map(([p, t]) => [p, t, (sup ? H - p : p) + t + e]) };
    }
    const ep = {
      TS: travInt(fer.TS, E.TS, g.e3), TI: travInt(fer.TI, E.TI, g.e1), PD: pdInt(fer.PD, E.PD, g.e2),
      AS: angle(fer.AS_T, fer.AS_P, E.TS, E.PD, g.e3, true), AI: angle(fer.AI_T, fer.AI_P, E.TI, E.PD, g.e1, false),
    };
    // --- nomenclature des barres PHI2 (aciers auxiliaires)
    const ouv = d.ouver;
    const gs = ouv <= 3 ? [0.2, 0.2] : ouv <= 5 ? [0.6, 0.3] : [0.9, 0.3];     // goussets sup. par défaut (doc. CHAMOA PICF)
    const gi = ouv <= 2 ? [0.3, 0.2] : ouv <= 4 ? [0.5, 0.3] : [0.7, 0.5];     // goussets inf.
    const extLen = an => an.lap ? 0 : L - 2 * an.zero + 2 * ls(1);
    const fam = o => o.esp * o.n;
    const Wt = g.W / s, trLen = Wt <= 10 + 1e-9 ? [Wt] : [10, Wt - 10 + ls(1)];
    const ANFw = fer.ANF.w, AP = 3 * area(1);
    // A = SUP(AP,A10,A20) hors mode groupes (2550 : ANF > AP ignoré), SUP(A10,A20,ANF) en mode groupes, plafonné à 1 PHI2 / 0.333 m
    const Atr = Math.max(AP, fer.A20 || 0, fer.A10 || 0, grp ? fer.ANF.t : 0);
    const eTI = area(1) / Atr, eTE = Math.min(2 * eTI, 0.333);
    const nom = {
      LTS_I: fam(fer.TS), LTI_I: fam(fer.TI), LTS_E: 2 * fer.AS_T.esp, LTI_E: 2 * fer.AI_T.esp, LP_E: 2 * fer.AS_P.esp,
      lenTS_E: extLen(ep.AS), lenTI_E: extLen(ep.AI),
      eG: fer.PD.esp * (grp ? 1 : 2), LGS: gs[0] + 0.6, LGI: gi[0] + 0.6,
      nTGS: Math.floor((gs[0] + gs[1]) / 0.2 + 1e-6) + 1, nTGI: Math.floor((gi[0] + gi[1]) / 0.2 + 1e-6) + 1,
      TT: { TSi: eTI, TSe: eTE, TIi: eTE, TIe: eTE }, Atr, trLen,
      TP: [0.2, Math.min(0.333, area(1) / ANFw)],
    };
    // --- étriers
    const tau0 = 0.07 * d.fcj / 1.5, ft = 0.6 + 0.06 * d.fcj;
    const eG = fer.eGroup || 2 * fer.AS_T.esp;
    const VV = el => R.cmp['V' + el].map(c => ({ x: c.x, V: Math.max(Math.abs(c.design.maxU), Math.abs(c.design.minU)) }));
    const els = { b: { o: fer.AI_T, At: area(2) / eG, len: L }, t: { o: fer.AS_T, At: area(2) / eG, len: L }, w: { o: fer.AS_P, At: area(2) / eG * s, len: H } };
    const SERIE = [0.08, 0.10, 0.125, 0.16, 0.20, 0.25, 0.32];
    let needAny = false;
    // hauteur utile des étriers (session g) : d = h − c − 0.6·φ − 1.1·φ2 avec φ = diamètre des aciers INTÉRIEURS retenus pour l'élément
    // (p.26) : 2531 TI (2 PHI2) 0.6462, piédroits (PHI2) 0.6462/0.5462/0.7725, sinon PHI1 — intervalles déduits des τ imprimés (4 passages).
    const din = { b: fer.TI, t: fer.TS, w: fer.PD };
    for (const el of ['b', 't', 'w']) els[el].d = root.PICF_ETRD ? els[el].o.d : din[el].d;
    for (const el of ['b', 't', 'w']) { const e = els[el]; e.rows = VV(el).map(r => ({ ...r, tau: r.V / 1000 / e.d })); if (e.rows.some(r => r.tau > tau0)) needAny = true; }
    for (const el of ['b', 't', 'w']) {
      const e = els[el], fe3 = d.fe[2];
      e.s1 = Math.min(0.4, 0.9 * (root.PICF_ETRS1 ? e.d : e.o.d)); e.s2 = e.At * fe3 / 0.4; const gen = Math.min(e.s1, e.s2);
      for (const r of e.rows) r.s3 = r.tau > 0.3 * ft ? 0.9 * e.At * fe3 / (r.tau - 0.3 * ft) : null;
      if (!needAny) continue;
      // grille complète (traverses : symétrie)
      let rows = e.rows;
      if (el !== 'w') { const m = rows.slice(0, -1).reverse().map(r => ({ ...r, x: L - r.x })); rows = rows.concat(m); }
      const lim = r => (r.s3 !== null && r.s3 < gen) ? r.s3 : null;
      const side = (dir) => { // dir = +1 depuis l'origine, -1 depuis l'extrémité
        const grid = dir > 0 ? rows : rows.slice().reverse(); const out = []; let x = 0;
        for (let it = 0; it < 200; it++) {
          const pos = x; let r = grid[0];
          for (const q of grid) { const dx = dir > 0 ? q.x : e.len - q.x; if (dx <= pos + 1e-6) r = q; }
          const l = lim(r); if (l === null) break;
          const sp = SERIE.filter(v => v <= l + 1e-9).pop() || SERIE[0];
          if (out.length && Math.abs(out[out.length - 1].s - sp) < 1e-9) out[out.length - 1].n++; else out.push({ s: sp, n: 1 });
          x += sp; if (x >= e.len / 2) break;
        }
        return { out, x };
      };
      const A = side(1), B = side(-1);
      const mid = e.len - A.x - B.x;
      const groups = A.out.slice();
      if (mid > 1e-6) { const n = Math.ceil(mid / gen - 1e-9); groups.push({ s: mid / n, n }); }
      groups.push(...B.out.slice().reverse());
      e.rep = groups;
    }
    // étriers : un étrier par groupe et par cours ; longueur supposée 2(h − 2c) + 0.24 (crochets) — approché
    const tonE = () => needAny ? ['b', 't', 'w'].reduce((a, el) => { const e = els[el], h = el === 'b' ? g.e1 : el === 't' ? g.e3 : g.e2;
      const nc = e.rep.reduce((q, r) => q + r.n, 0) * (el === 'w' ? 2 : 1); return a + nc * nb(g.W, eG) * (2 * (h - 2 * d.enrob) + 0.24) * area(2) * 7850; }, 0) : 0;
    // --- tonnages (avant-métré). PHI1 : Σ longueur × nombre de barres, nombre = arrondi(largeur / espacement de la famille)
    //     (reproduit 2531/2550/2498 à ±0.01 t ; 2551 −2.0 t non expliqué). PHI2 / PHI3 : modèle approché (cf. NOTES).
    const kg = i => area(i) * 7850, Wd = g.W, nb = (w, sp) => sp > 0 ? Math.round(w / sp) : 0;
    const ton = [0, 0, 0];
    const addInt = (e, o, wid) => { const sp = e === ep.PD ? (o.n === 2 ? 2 * o.esp : o.esp) : o.esp * o.n; for (const b of e.bars) ton[e.phi] += (b[1] - b[0]) * nb(wid, sp) * kg(e.phi) * (e === ep.PD ? 2 : 1); };
    addInt(ep.TS, fer.TS, Wd); addInt(ep.TI, fer.TI, Wd); addInt(ep.PD, fer.PD, Wd / s);
    for (const an of [ep.AS, ep.AI]) for (const b of an.bars) ton[0] += 2 * b[2] * nb(Wd, 2 * an.espT) * kg(0);
    const blen = trLen.reduce((a, v) => a + v, 0);
    ton[1] += (nom.lenTS_E * nb(Wd, nom.LTS_E) + nom.lenTI_E * nb(Wd, nom.LTI_E)) * kg(1);
    ton[1] += 2 * (nom.LGS + nom.LGI) * nb(Wd / s, nom.eG) * kg(1);
    const nTT = [nom.TT.TSi, nom.TT.TSe, nom.TT.TIi, nom.TT.TIe].reduce((a, sp) => a + nb(ouv, sp), 0);
    const nTP = 4 * (nb(2, nom.TP[0]) + nb(H - 2, nom.TP[1]));
    ton[1] += (nTT + nTP + 2 * (nom.nTGS + nom.nTGI)) * blen * kg(1);
    ton[2] = tonE();
    return { epure: ep, nom, etr: { need: needAny, tau0, els }, ton };
  }

  function scaleRes(r, f) {
    const sc = o => ({ M: o.M * f, V: o.V * f, N: o.N * f });
    return { t: r.t.map(sc), b: r.b.map(sc), w: r.w.map(sc), det: r.det.map(x => x * f), p: r.p.map(x => x * f), u: r.u };
  }

  // ---------------------------------------------------------------- moments transversaux (p.19–21)
  // Notice SETRA PICF/PIPO (pièce 2.5 § 3) : plaque rectangulaire équivalente sur appuis simples (LARGEUR, LONGUEUR l),
  // charge développée en série de Fourier (harmoniques 1, 3, 5), calcul au centre de la traverse supérieure.
  //   facteur 1 = sin(m π c / l) (2c = étalement longitudinal, borné à l) ; facteur 2 = 1/m (sin(mπd/l)·sin(mπx/l), d = x = l/2)
  //   facteur 3 = Σ P·μ̄ (charges ponctuelles) ou q·2c·∫μ dy (charges réparties) ; moment = F1·F2·F3·(4/π)·b/(2c), b = LARGEUR/2
  //   (vérifié : rapport moment/(F1F2F3) = (4/π)·b/(2c) sur les 3 passages).
  // Torseur (CHAMOA, CED 66) : aciers 1 à a1 = (100−ψ) gr et 2 à a2 = a1 + φ des directions principales (MX longitudinal, MY transversal) :
  //   MTOR = MX sin a1 sin a2 + MY cos a1 cos a2 ; MAVF = (MY sin a2 cos a1 − MX cos a2 sin a1)/sin φ ;
  //   MAPF = MAVF + |MTOR| / (2 sin²(φ/2)) — reproduit les 64 valeurs des listings à 0.02 % près.
  function transversal(R, d, X) {
    const { conv, dyn, c0, c1, v, nvoi, a1tab, a2, hasEC, ch, qsup } = X;
    const l = R.mu.LO, bT = R.mu.bT, thT = R.mu.thT, W = d.large, b = W / 2, HM = [1, 3, 5];
    const N = 400, hy = 2 * bT / N;
    const tab = HM.map(m => { const a = []; for (let i = 0; i <= N; i++) a.push(guyonMu(m * thT, 0, (-bT + i * hy) / bT)); const cu = [0]; for (let i = 0; i < N; i++) cu.push(cu[i] + (a[i] + a[i + 1]) / 2 * hy); return { a, cu }; });
    const lin = (arr, y) => { const t = (Math.max(-bT, Math.min(bT, y)) + bT) / hy, i = Math.min(N - 1, Math.floor(t)); return arr[i] + (arr[i + 1] - arr[i]) * (t - i); };
    const integ = (k, y0, y1) => lin(tab[k].cu, y1) - lin(tab[k].cu, y0);
    const mubar = (k, y, a) => a > 1e-6 ? integ(k, y - a / 2, y + a / 2) / a : lin(tab[k].a, y);
    const t30 = Math.tan(Math.PI / 6), sL = 2 * d.hchau + 2 * d.hsrem * t30 + d.e3;
    const fac = (c2, F3) => { const cc = Math.min(c2, l); return HM.map((m, k) => { const F1 = Math.sin(m * Math.PI * cc / 2 / l), F2 = 1 / m; return { m, F1, F2, F3: F3[k], M: F1 * F2 * F3[k] * 4 / Math.PI * bT / cc }; }); };
    const sum = rows => rows.reduce((a, r) => a + r.M, 0);
    const distrib = (q, y0, y1) => fac(l, HM.map((m, k) => q * G * l * integ(k, y0, y1)));
    // charges ponctuelles : groupe longitudinal (2c), positions transversales relatives ws (poids P t par file), largeur a
    const point = (P, c2, ws, a, lo, hi) => {
      let best = null; // lo/hi : bornes des positions des files (ws relatives)
      for (let st = lo - ws[0]; st + ws[ws.length - 1] <= hi + 1e-9; st += 0.05) {
        const F3 = HM.map((m, k) => P * G * Math.min(1, l / c2) * ws.reduce((s, w) => s + mubar(k, st + w, a), 0));
        const rows = fac(c2, F3), tot = sum(rows); if (!best || tot > best.tot) best = { rows, tot };
      }
      return best || { rows: fac(c2, [0, 0, 0]), tot: 0 };
    };
    // Session e : bandes fusionnées — chaque empreinte diffusée transversalement sur a + sD (sD = 2·HCHAU + 2·HSREM·tan30° + E3,
    // même diffusion que dans le sens longitudinal), empreintes fondues en une bande (toutes les roues des camions Bc / tandems Bt
    // de front), partie hors dalle perdue. Mc120 : chenilles fondues → une seule chenille (55 t) portée par la bande, sinon 2 × 55 t ;
    // E : demi-remorque 100 t sur 3.30 m ; Me120 : un essieu de 33 t (inchangé).
    const TRB = root.PICF_TRB != null ? root.PICF_TRB : 3; // 1 : bandes fusionnées (convois), 2 : diffusion des voies AL ; 0 : ancienne règle
    const sDt = root.PICF_TRSD ? root.PICF_TRSD(d) : sL; // 45° chaussée, 30° remblai, + E3 (comme la diffusion longitudinale des chenilles)
    const bandF3 = (P, c2, cs, a, one) => { const w = a + sDt; const iv = cs.map(x => [x - w / 2, x + w / 2]).sort((x, y) => x[0] - y[0]), cl = [];
      for (const q of iv) { const Lq = cl[cl.length - 1]; if (Lq && q[0] <= Lq[1] + 1e-9) { Lq[1] = Math.max(Lq[1], q[1]); Lq[2]++; } else cl.push([q[0], q[1], 1]); }
      return HM.map((m, k) => { let t = 0; for (const [l0, l1, nn] of cl) { const lo = Math.max(-b, l0), hi = Math.min(b, l1); if (hi > lo) t += (one ? 1 : nn) * integ(k, lo, hi) / (l1 - l0); } return P / cs.length * G * Math.min(1, l / c2) * t; }); };
    // véhicules de front (Bc, Bt) : toutes les empreintes fondues ensemble (meilleur que la somme par véhicule ; hook PICF_TRV)
    const veh = (P, c2, ws, a, lo, hi, nveh, sp, one) => { let best = null; nveh = nveh || 1; sp = sp || 0;
      for (let st = lo - ws[0]; st + (nveh - 1) * sp + ws[ws.length - 1] <= hi + 1e-9; st += 0.05) {
        let F3 = [0, 0, 0];
        if (root.PICF_TRV) { for (let u = 0; u < nveh; u++) { const f = bandF3(P, c2, ws.map(w => st + u * sp + w), a); F3 = F3.map((x, k) => x + f[k]); } }
        else { const cs = []; for (let u = 0; u < nveh; u++) for (const w of ws) cs.push(st + u * sp + w); F3 = bandF3(P * nveh, c2, cs, a, one); }
        const rows = fac(c2, F3), tot = sum(rows); if (!best || tot > best.tot) best = { rows, tot }; }
      return best || { rows: fac(c2, [0, 0, 0]), tot: 0 }; };
    const MGt = d.egau > 0 && d.edroi > 0 ? 0 : 0.5;
    const mid = c => c[c.length - 1];
    const Tm = mid(R.cmp.t);
    const gS = { AL: 1.2, BC: 1.2, BT: 1.2, MC: 1, ME: 1, E: 1, EC: 1.2 }, gU = { AL: 1.6, BC: 1.6, BT: 1.6, MC: 1.35, ME: 1.35, E: 1.35, EC: 1.6 };
    const r = Math.PI / 200, A1 = (100 - R.mu.psi) * r, A2 = A1 + d.biais * r;
    const torseur = (MX, MY) => {
      const MTOR = MX * Math.sin(A1) * Math.sin(A2) + MY * Math.cos(A1) * Math.cos(A2);
      const MAVF = (MY * Math.sin(A2) * Math.cos(A1) - MX * Math.cos(A2) * Math.sin(A1)) / Math.sin(A2 - A1);
      const h2 = (A2 - A1) / 2, MAPF = MAVF + Math.abs(MTOR) / (2 * (MTOR * MX >= 0 ? Math.sin(h2) ** 2 : Math.cos(h2) ** 2));
      return { MX, MY, MTOR, MAVF, MAPF };
    };
    const comb = (mpS, mpU, mS, mU, mxS, mxU) => { const S = torseur(mxS, mpS + mS), U = torseur(mxU, mpU + mU); return { S, U }; };
    const out = { psi: R.mu.psi, phi: d.biais, chantier: null, service: [] };
    // --- phase de chantier : ossature, terre (remblai d'engin), engin
    if (hasEC) {
      const oss = distrib(d.mvbet * d.e3, -b, b);
      const e0 = -b + d.ec.egau, e1 = e0 + d.ec.esurch;
      const ter = distrib(ch.qx, e0, e1);
      const sEC = 2 * d.ec.hsrem + d.e3;
      const ec = point(25, 0.6 + sEC, [-1.2, 1.2], 0.6 + sEC, e0 + 1.8, e1 - 1.8); // axe à 3 m au moins du bord de ESURCH
      const Mp = sum(oss) + sum(ter), Mec = ec.tot * 1.5;
      out.chantier = { oss: { rows: oss, tot: sum(oss) }, ter: { rows: ter, tot: sum(ter) },
        ec: { rows: ec.rows, cmd: 1.5, tot: Mec, comb: comb(Mp, 1.35 * Mp, 1.2 * Mec, 1.6 * Mec, Tm.perm.ch.maxS + 1.2 * Tm.ec.mx, Tm.perm.ch.maxU + 1.6 * Tm.ec.mx) } };
    }
    // --- service
    const perm = distrib(d.mvbet * d.e3 + qsup.x, -b, b), Mp = sum(perm);
    out.perm = { rows: perm, tot: Mp };
    const live = (key, Ml) => comb(Mp, 1.35 * Mp, gS[key] * Ml, gU[key] * Ml, Tm.perm.maxS + gS[key] * Tm.lmax[key], Tm.perm.maxU + gU[key] * Tm.lmax[key]);
    { // AL : voies de la chaussée, A(l) sur la longueur de la plaque
      const qA = 0.23 + 36 / (l + 12);
      const lanes = []; for (let j = 0; j < nvoi; j++) { const sA = (TRB & 2) ? sDt : 0;
        const rows = sA > 0 ? distrib(qA * v / (v + sA), Math.max(-b, c0 + j * v - sA / 2), Math.min(b, c0 + (j + 1) * v + sA / 2)) : distrib(qA, c0 + j * v, c0 + (j + 1) * v); lanes.push({ rows, tot: sum(rows) }); }
      let best = 0; for (let k = 1; k <= nvoi; k++) for (let st = 0; st + k <= nvoi; st++) { let s = 0; for (let j = st; j < st + k; j++) s += lanes[j].tot; best = Math.max(best, s * a1tab[Math.min(k, a1tab.length) - 1] * a2); }
      out.service.push({ key: 'AL', name: 'AL', lanes, tot: best, comb: live('AL', best) });
    }
    const add = (key, name, res, k) => { const tot = res.tot * k; out.service.push({ key, name, rows: res.rows, cmd: dyn[key].d, tot, comb: live(key, tot) }); };
    if (TRB & 1) {
      { let best = null; for (let n = 1; n <= Math.min(nvoi, 4); n++) { const res = veh(24, 1.5 + 0.25 + sL, [0, 2], 0.25, c0 + MGt + 0.25, c1 - MGt - 0.25, n, 2.5), bc = [1.2, 1.1, 0.95, 0.8][n - 1];
          if (!best || res.tot * bc > best.res.tot * best.bc) best = { res, bc }; } add('BC', 'BC', best.res, best.bc * dyn.BC.d); }
      { let best = null; for (let n = 1; n <= Math.min(nvoi, 2); n++) { const res = veh(32, 1.35 + 0.25 + sL, [0, 2], 0.6, c0 + MGt + 0.5, c1 - MGt - 0.5, n, 3); if (!best || res.tot > best.tot) best = res; }
        add('BT', 'BT', best, dyn.BT.d); }
      // Mc120 / Me120 / E : charge d'une file (chenille 55 t, essieu 33 t, demi-remorque 100 t) sur la bande fusionnée du véhicule
      add('MC', 'MC120', veh(110, 6.1 + sL, [0, 3.3], 1.0, c0 + 1.0, c1 - 1.0, 1, 0, !root.PICF_TRM), dyn.MC.d); // chenilles fondues : une seule chenille (55 t) portée
      add('ME', 'ME120', point(33, 1.8 + 0.15 + sL, [0], 4.0 + sL, c0 + 2.5, c1 - 2.5), dyn.ME.d);
      add('E', 'E', veh(100, 15 + sL, [0], 3.3, c0 + 2.0, c1 - 2.0), 1.0);
    } else {
    { // Bc : deux essieux arrière (2 × 6 t par file de roues), roues 0.25 m, 1 à 4 camions de front
      let best = null;
      for (let n = 1; n <= Math.min(nvoi, 4); n++) { const ws = []; for (let u = 0; u < n; u++) ws.push(u * 2.5, 2 + u * 2.5);
        const res = point(12, 1.5 + 0.25 + sL, ws, 0.25 + sL, c0 + 0.75, c1 - 0.75), bc = [1.2, 1.1, 0.95, 0.8][n - 1];
        if (!best || res.tot * bc > best.res.tot * best.bc) best = { res, bc }; }
      add('BC', 'BC', best.res, best.bc * dyn.BC.d);
    }
    { let best = null; for (let n = 1; n <= Math.min(nvoi, 2); n++) { const ws = []; for (let u = 0; u < n; u++) ws.push(u * 3, 2 + u * 3);
        const res = point(16, 1.35 + 0.25 + sL, ws, 0.6 + sL, c0 + 1.0, c1 - 1.0); if (!best || res.tot > best.tot) best = res; }
      add('BT', 'BT', best, dyn.BT.d); }
    add('MC', 'MC120', point(55, 6.1 + sL, [0, 3.3], 1.0 + sL, c0 + 1.0, c1 - 1.0), dyn.MC.d);
    add('ME', 'ME120', point(33, 1.8 + 0.15 + sL, [0], 4.0 + sL, c0 + 2.5, c1 - 2.5), dyn.ME.d); // facteur 3 imprimé ≈ 33 t (un essieu)
    add('E', 'E', point(100, 15 + sL, [-0.825, 0.825], sL, c0 + 2.675, c1 - 2.675), 1.0);
    }
    const all = out.service.concat(out.chantier ? [out.chantier.ec] : []);
    out.design = { S: Math.max(...all.map(o => o.comb.S.MAPF)), U: Math.max(...all.map(o => o.comb.U.MAPF)) };
    return out;
  }

  // ---------------------------------------------------------------- combinaisons
  function combine(R, d, hasEC) {
    const C = R.cases, out = {};
    const LIVE = ['AL', 'BC', 'BT', 'MC', 'ME', 'E'];
    const gS = { AL: 1.2, BC: 1.2, BT: 1.2, MC: 1, ME: 1, E: 1, EC: 1.2 }, gU = { AL: 1.6, BC: 1.6, BT: 1.6, MC: 1.35, ME: 1.35, E: 1.35, EC: 1.6 };
    function perm(get) { // retourne {maxS, maxU, minS, minU, comps}
      const pp = get(C.pp), pu = [get(C.pushN), get(C.pushX)], qs = [get(C.qsupN), get(C.qsupX)], rd = [get(C.rdtN), get(C.rdtX)], ph = [get(C.pushHN), get(C.pushHX)];
      const pick = (arr, f) => f(arr[0], arr[1]);
      const mx = { pp, pu: pick(pu, Math.max), qs: pick(qs, Math.max), rd: pick(rd, Math.max), ph: pick(ph, Math.max) };
      const mn = { pp, pu: pick(pu, Math.min), qs: pick(qs, Math.min), rd: pick(rd, Math.min), ph: pick(ph, Math.min) };
      const S = o => o.pp + o.pu + o.qs + o.rd + (o.ph || 0);
      const UX = o => Object.values(o).reduce((a, v) => a + (v > 0 ? 1.35 * v : v), 0);
      const UN = o => Object.values(o).reduce((a, v) => a + (v < 0 ? 1.35 * v : v), 0);
      const r = { mx, mn, maxS: S(mx), minS: S(mn), maxU: UX(mx), minU: UN(mn) };
      if (hasEC) {
        const cq = [get(C.chqN), get(C.chqX)], cr = [get(C.chRN), get(C.chRX)];
        const cmx = { pp, pu: mx.pu, qs: Math.max(...cq), rd: Math.max(...cr) }, cmn = { pp, pu: mn.pu, qs: Math.min(...cq), rd: Math.min(...cr) };
        r.ch = { mx: cmx, mn: cmn, maxS: S(cmx), minS: S(cmn), maxU: UX(cmx), minU: UN(cmn) };
      }
      return r;
    }
    for (const el of ['t', 'b', 'w', 'det']) {
      out[el] = R.sections[el].map((x, k) => {
        const get = c => el === 'det' ? c.det[k] : c[el][k].M;
        const p = perm(get); const env = R.env[el][k];
        const tP = get(C.tempP), tM = get(C.tempM); const tmax = Math.max(tP, tM, 0), tmin = Math.min(tP, tM, 0);
        const lmax = {}, lmin = {}; for (const l of LIVE) { lmax[l] = Math.max(0, env[l + '+'].v); lmin[l] = Math.min(0, env[l + '-'].v); }
        let liveS = 0, liveU = 0, liveSn = 0, liveUn = 0;
        for (const l of LIVE) { liveS = Math.max(liveS, gS[l] * lmax[l]); liveU = Math.max(liveU, gU[l] * lmax[l]); liveSn = Math.min(liveSn, gS[l] * lmin[l]); liveUn = Math.min(liveUn, gU[l] * lmin[l]); }
        const rb = get(C.remb); lmax.REMB = Math.max(0, rb); lmin.REMB = Math.min(0, rb);
        let dS = p.maxS + liveS + 1.2 * lmax.REMB + 0.6 * tmax, dU = p.maxU + liveU + 1.6 * lmax.REMB, nS = p.minS + liveSn + 1.2 * lmin.REMB + 0.6 * tmin, nU = p.minU + liveUn + 1.6 * lmin.REMB;
        let ec = null;
        if (hasEC) {
          ec = { mx: Math.max(0, env['EC+'].v), mn: Math.min(0, env['EC-'].v) };
          dS = Math.max(dS, p.ch.maxS + 1.2 * ec.mx + 0.6 * tmax); dU = Math.max(dU, p.ch.maxU + 1.6 * ec.mx);
          nS = Math.min(nS, p.ch.minS + 1.2 * ec.mn + 0.6 * tmin); nU = Math.min(nU, p.ch.minU + 1.6 * ec.mn);
        }
        return { x, perm: p, tmax, tmin, lmax, lmin, ec, design: { maxS: dS, maxU: dU, minS: nS, minU: nU } };
      });
    }
    // efforts tranchants (ELU) et pressions (ELS)
    for (const [el, ve] of [['t', 'Vt'], ['b', 'Vb'], ['w', 'Vw']]) {
      out['V' + el] = R.sections[el].map((x, k) => {
        // traverse inférieure, x = 0 : SETRA exclut la réaction de la dalle de transition (force concentrée au nœud)
        const PU = R.pushUnit;
        // traverse inférieure : de la dalle de transition, SETRA ne retient que l'effet des moments d'encastrement transmis
        // par les piédroits (la force verticale en pied de piédroit ne crée pas d'effort tranchant dans le radier) :
        // V = (M_angle(dalle)/M_angle(poussée))·V(poussée) — reproduit l'excédent 0.742/0.258/0.995·V(poussée Kmax) des 3 passages.
        const get = c => (el === 'b' && (c === C.rdtN || c === C.rdtX || c === C.chRN || c === C.chRX)) ? c.b[0].M / PU.b[0].M * PU.b[k].V : c[el][k].V; const p = perm(get); const env = R.env[ve][k];
        const tP = get(C.tempP), tM = get(C.tempM); const tmax = Math.max(tP, tM, 0), tmin = Math.min(tP, tM, 0);
        const lmax = {}, lmin = {}; let lU = 0, lUn = 0;
        for (const l of LIVE) { lmax[l] = Math.max(0, env[l + '+'].v); lmin[l] = Math.min(0, env[l + '-'].v); lU = Math.max(lU, gU[l] * lmax[l]); lUn = Math.min(lUn, gU[l] * lmin[l]); }
        const rb = get(C.remb); lmax.REMB = Math.max(0, rb); lmin.REMB = Math.min(0, rb);
        let ec = null; let dU = p.maxU + lU + 1.6 * lmax.REMB, nU = p.minU + lUn + 1.6 * lmin.REMB; // la température n'entre pas dans les efforts tranchants ELU (2531 PD : 301.9 = 291.5 + 1.6·6.5)
        if (hasEC) { ec = { mx: Math.max(0, env['EC+'].v), mn: Math.min(0, env['EC-'].v) };
          // phase chantier également enveloppée à l'ELU (2550 V TS x = 0 : MIN 89.9 = 90.7 + 1.6·EC34)
          if (!root.PICF_VNOCH) { dU = Math.max(dU, p.ch.maxU + 1.6 * ec.mx); nU = Math.min(nU, p.ch.minU + 1.6 * ec.mn); } }
        return { x, perm: p, tmax, tmin, lmax, lmin, ec, design: { maxU: dU, minU: nU } };
      });
    }
    out.p = [0, 1, 2].map(k => {
      const get = c => c.p[k] * 1000; const p = perm(get); const env = R.env.p[k];
      const tP = get(C.tempP), tM = get(C.tempM); const tmax = Math.max(tP, tM, 0), tmin = Math.min(tP, tM, 0);
      const lmax = {}, lmin = {}; let lS = 0, lSn = 0;
      for (const l of LIVE) { lmax[l] = Math.max(0, env[l + '+'].v); lmin[l] = Math.min(0, env[l + '-'].v); lS = Math.max(lS, gS[l] * lmax[l]); lSn = Math.min(lSn, gS[l] * lmin[l]); }
      let ec = null; if (hasEC) ec = { mx: Math.max(0, env['EC+'].v), mn: Math.min(0, env['EC-'].v) };
      const rb = get(C.remb); lmax.REMB = Math.max(0, rb); lmin.REMB = Math.min(0, rb);
      const des = { maxS: p.maxS + lS + 1.2 * lmax.REMB + 0.6 * tmax, minS: p.minS + lSn + 1.2 * lmin.REMB + 0.6 * tmin };
      if (ec) { des.maxS = Math.max(des.maxS, p.ch.maxS + 1.2 * ec.mx + 0.6 * tmax); des.minS = Math.min(des.minS, p.ch.minS + 1.2 * ec.mn + 0.6 * tmin); }
      return { perm: p, tmax, tmin, lmax, lmin, ec, design: des };
    });
    return out;
  }

  const PICF_COMPUTE = { compute, detailing, envFromCmp, asELU, guyonK, guyonMu, marston, buildFrame, luSolve, luFactor, forcesAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = PICF_COMPUTE;
  root.PICF_COMPUTE = PICF_COMPUTE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
