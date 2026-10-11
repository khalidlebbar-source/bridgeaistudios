/* ════════════════════════════════════════════════════════════════════
   HandBag — moteur de poutre (éléments finis de poutre d'Euler-Bernoulli)
   Poutre continue sur appuis rigides ou élastiques, encastrements, consoles,
   sol élastique de Winkler ; charges ponctuelles, réparties trapézoïdales, couples.
   Conventions (celles des classeurs Biblio 2004) : charge positive vers le bas,
   couple positif dans le sens horaire, moment positif tendant la fibre inférieure,
   flèche positive vers le bas. Unités cohérentes : m, kN, kN·m, EI en kN·m².
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
"use strict";
const HB = root.HANDBAG;

/* système bande symétrique (demi-largeur bw) : factorisation de Cholesky en place, puis résolutions multiples */
function bandFactor(A, n, bw) {
  for (let j = 0; j < n; j++) {
    let s = A[j][0];
    for (let k = Math.max(0, j - bw); k < j; k++) s -= A[k][j - k] ** 2 * A[k][0];   // LDLᵀ : A[k][0] = d_k, A[k][m] = l
    A[j][0] = s;
    for (let i = j + 1; i <= Math.min(n - 1, j + bw); i++) {
      let t = A[j][i - j];
      for (let k = Math.max(0, i - bw); k < j; k++) t -= A[k][i - k] * A[k][j - k] * A[k][0];
      A[j][i - j] = t / s;
    }
  }
  return A;
}
function bandSolve(F, n, bw, b) {
  const x = b.slice();
  for (let i = 0; i < n; i++) for (let k = Math.max(0, i - bw); k < i; k++) x[i] -= F[k][i - k] * x[k];
  for (let i = 0; i < n; i++) x[i] /= F[i][0];
  for (let i = n - 1; i >= 0; i--) for (let k = i + 1; k <= Math.min(n - 1, i + bw); k++) x[i] -= F[i][k - i] * x[k];
  return x;
}

/* modèle : { spans:[L…], EI:[…] ou nombre ou fonction(x), left/right:"a"|"e"|"c", kv:[raideur par appui] (∞ = rigide),
              kw: module de réaction du sol (kN/m par m), free: true pour une poutre sans appui (sol élastique), nel: éléments }
   La poutre commence à x = 0 ; « c » à une extrémité = console (pas d'appui à ce bout). */
function model(o) {
  const spans = o.spans, nsp = spans.length, sup = [0]; spans.forEach(l => sup.push(sup.at(-1) + l));
  const Lt = sup.at(-1), extra = (o.points || []).filter(x => x > 1e-9 && x < Lt - 1e-9);
  const per = Math.max(4, Math.round((o.nel || 240) / nsp));
  let xs = []; spans.forEach((l, i) => { for (let k = 0; k < per; k++) xs.push(sup[i] + l * k / per); }); xs.push(Lt);
  xs = xs.concat(extra).sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-7 * Lt);
  const snap = x => { let b = 0, d = 1e99; xs.forEach((v, i) => { const e = Math.abs(v - x); if (e < d) { d = e; b = i; } }); return b; };
  const EIat = x => typeof o.EI === "function" ? o.EI(x) : Array.isArray(o.EI) ? o.EI[Math.min(nsp - 1, Math.max(0, sup.findIndex((s, i) => i > 0 && x <= s + 1e-9) - 1))] : o.EI;
  const nn = xs.length, nd = 2 * nn, bw = 3, K = Array.from({ length: nd }, () => new Float64Array(bw + 1));
  const els = [];
  for (let e = 0; e < nn - 1; e++) {
    const L = xs[e + 1] - xs[e], EI = EIat((xs[e] + xs[e + 1]) / 2), c = EI / L ** 3, kw = o.kw || 0;
    const k = [[12, 6 * L, -12, 6 * L], [6 * L, 4 * L * L, -6 * L, 2 * L * L], [-12, -6 * L, 12, -6 * L], [6 * L, 2 * L * L, -6 * L, 4 * L * L]].map(r => r.map(v => v * c));
    if (kw) { const f = kw * L / 420, m = [[156, 22 * L, 54, -13 * L], [22 * L, 4 * L * L, 13 * L, -3 * L * L], [54, 13 * L, 156, -22 * L], [-13 * L, -3 * L * L, -22 * L, 4 * L * L]]; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) k[i][j] += f * m[i][j]; }
    const d = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let i = 0; i < 4; i++) for (let j = i; j < 4; j++) K[d[i]][d[j] - d[i]] += k[i][j];
    els.push({ x1: xs[e], x2: xs[e + 1], L, k });
  }
  /* appuis */
  const fixed = new Set(), springs = [], supp = [];
  if (!o.free) sup.forEach((x, i) => {
    const end = i === 0 ? o.left || "a" : i === nsp ? o.right || "a" : "a";
    if (end === "c") return;
    const kv = o.kv && o.kv[i] !== undefined ? o.kv[i] : Infinity, node = snap(x);
    supp.push({ i, x, node, kv, enc: end === "e" });
    if (kv === Infinity) fixed.add(2 * node); else { K[2 * node][0] += kv; springs.push([2 * node, kv]); }
    if (end === "e") fixed.add(2 * node + 1);
  });
  const Kf = K.map(r => Float64Array.from(r));                           // copie pour les réactions
  const P = K; fixed.forEach(d => { for (let m = 1; m <= bw; m++) { if (d + m < nd) P[d][m] = 0; if (d - m >= 0) P[d - m][m] = 0; } P[d][0] = 1; });
  bandFactor(P, nd, bw);
  return { xs, nn, nd, bw, els, sup, Lt, supp, fixed, Kf, F: P, snap, springs };
}

/* vecteur de charges et efforts d'encastrement par élément */
function loadVec(m, ld) {
  const f = new Float64Array(m.nd), fe = m.els.map(() => [0, 0, 0, 0]);
  (ld.P || []).forEach(([x, F]) => { if (x >= -1e-9 && x <= m.Lt + 1e-9) f[2 * m.snap(x)] += F; });
  (ld.C || []).forEach(([x, Cc]) => { if (x >= -1e-9 && x <= m.Lt + 1e-9) f[2 * m.snap(x) + 1] += Cc; });
  (ld.q || []).forEach(([a, qa, b, qb]) => {
    if (b === undefined) { b = a; }                                      // sécurité
    if (b < a) { [a, b, qa, qb] = [b, a, qb, qa]; }
    const qx = x => b > a ? qa + (qb - qa) * (x - a) / (b - a) : qa;
    m.els.forEach((el, e) => {
      const lo = Math.max(a, el.x1), hi = Math.min(b, el.x2); if (hi - lo <= 1e-12) return;
      /* intégration de Gauss (3 points) des fonctions de forme d'Hermite sur [lo, hi] */
      const G = [[-0.7745966692, 5 / 9], [0, 8 / 9], [0.7745966692, 5 / 9]], L = el.L;
      G.forEach(([t, w]) => {
        const x = (lo + hi) / 2 + t * (hi - lo) / 2, ww = w * (hi - lo) / 2, s = (x - el.x1) / L, q = qx(x) * ww;
        const N = [1 - 3 * s * s + 2 * s ** 3, L * s * (1 - s) ** 2, 3 * s * s - 2 * s ** 3, L * s * s * (s - 1)];
        for (let i = 0; i < 4; i++) { fe[e][i] += N[i] * q; f[2 * e + i] += N[i] * q; }
      });
    });
  });
  return { f, fe };
}

/* résolution : déplacements, efforts aux nœuds (à gauche et à droite de chaque nœud), réactions */
function solve(m, ld) {
  const { f, fe } = loadVec(m, ld), b = Array.from(f); m.fixed.forEach(d => { b[d] = 0; });
  const u = bandSolve(m.F, m.nd, m.bw, b);
  const pts = [];                                                        // [x, M, V, w]
  m.els.forEach((el, e) => {
    const ue = [u[2 * e], u[2 * e + 1], u[2 * e + 2], u[2 * e + 3]], r = [0, 1, 2, 3].map(i => el.k[i].reduce((s, v, j) => s + v * ue[j], 0) - fe[e][i]);
    pts.push([el.x1, r[1], r[0], ue[0] * 1000], [el.x2, -r[3], -r[2], ue[2] * 1000]);
  });
  const Ku = d => { let s = 0; for (let j = Math.max(0, d - m.bw); j <= Math.min(m.nd - 1, d + m.bw); j++) s += (j >= d ? m.Kf[d][j - d] : m.Kf[j][d - j]) * u[j]; return s; };
  const reac = m.supp.map(s => {
    const d = 2 * s.node;
    return { x: s.x, i: s.i, R: s.kv === Infinity ? f[d] - Ku(d) : s.kv * u[d], Menc: s.enc ? f[d + 1] - Ku(d + 1) : 0 };
  });
  return { u, pts, reac };
}

/* outils de dépouillement */
const at = (pts, x, k = 1) => { let best = null, d = 1e99; pts.forEach(p => { const e = Math.abs(p[0] - x); if (e < d - 1e-12) { d = e; best = p[k]; } }); return best; };
function extremes(pts, k = 1) { let mx = -1e99, mn = 1e99, xmx = 0, xmn = 0; pts.forEach(p => { if (p[k] > mx) { mx = p[k]; xmx = p[0]; } if (p[k] < mn) { mn = p[k]; xmn = p[0]; } }); return { max: mx, min: mn, xmax: xmx, xmin: xmn }; }
function combine(list, coef) { const out = list[0].pts.map(p => [p[0], 0, 0, 0]); list.forEach((r, i) => r.pts.forEach((p, j) => { for (let k = 1; k < 4; k++) out[j][k] += coef[i] * p[k]; })); return out; }

/* lignes de chargement saisies : lignes de 2 nombres = charge ponctuelle (x, P), de 4 nombres = charge répartie (x1, q1, x2, q2) */
function loadsFromRows(rows) { const P = [], q = []; (rows || []).forEach(r => { if (r.length >= 4) q.push(r.slice(0, 4)); else if (r.length >= 2) P.push(r.slice(0, 2)); }); return { P, q }; }

/* lignes d'influence : réponse (points pts) à une charge unité placée sur chaque nœud */
function influence(m) { return m.xs.map(x => solve(m, { P: [[x, 1]] }).pts); }
/* enveloppe d'un convoi d'essieux [[d, P]…] qui défile ; seuls les essieux situés dans la zone [z1, z2] sont comptés */
function convoy(m, axles, z1, z2, sens = "d", step) {
  const IL = influence(m), xs = m.xs, np = IL[0].length, out = IL[0].map(p => [p[0], -1e99, 1e99, -1e99, 1e99]);   // x, Mmax, Mmin, Vmax, Vmin
  const R = m.supp.map(() => [-1e99, 1e99]), RI = m.xs.map(x => solve(m, { P: [[x, 1]] }).reac.map(r => r.R));
  const wAt = x => { let j = 0; while (j < xs.length - 2 && xs[j + 1] < x) j++; const t = (x - xs[j]) / (xs[j + 1] - xs[j]); return [j, Math.min(1, Math.max(0, t))]; };
  const span = Math.max(...axles.map(a => a[0])), h = step || (m.Lt / 400), dirs = sens === "b" ? [1, -1] : [sens === "g" ? -1 : 1];
  dirs.forEach(s => {
    for (let p = z1 - span; p <= z2 + span + 1e-9; p += h) {
      const ld = axles.map(([d, F]) => [p + s * d, F]).filter(([x]) => x >= z1 - 1e-9 && x <= z2 + 1e-9);
      if (!ld.length) continue;
      const M = new Float64Array(np), V = new Float64Array(np), Rr = new Float64Array(R.length);
      ld.forEach(([x, F]) => { const [j, t] = wAt(x); for (let k = 0; k < np; k++) { M[k] += F * ((1 - t) * IL[j][k][1] + t * IL[j + 1][k][1]); V[k] += F * ((1 - t) * IL[j][k][2] + t * IL[j + 1][k][2]); } R.forEach((_, i) => { Rr[i] += F * ((1 - t) * RI[j][i] + t * RI[j + 1][i]); }); });
      for (let k = 0; k < np; k++) { const o = out[k]; if (M[k] > o[1]) o[1] = M[k]; if (M[k] < o[2]) o[2] = M[k]; if (V[k] > o[3]) o[3] = V[k]; if (V[k] < o[4]) o[4] = V[k]; }
      R.forEach((r, i) => { r[0] = Math.max(r[0], Rr[i]); r[1] = Math.min(r[1], Rr[i]); });
    }
  });
  return { env: out, R };
}

/* flambement d'une barre (éléments finis, matrice géométrique cohérente) :
   o = { L, EI(x) ou nombre, kw(x) (réaction du sol, kN/m²), nel,
         foot/head : { t: "b"|"l"|raideur kN/m, r: "b"|"l"|raideur kN·m/rad } }  (pied en x = 0)
   renvoie la charge critique Ncr (kN) et le mode propre */
function buckling(o) {
  const NE = o.nel || 80, br = [0, ...(o.breaks || []).filter(x => x > 1e-9 && x < o.L - 1e-9).sort((a, b) => a - b), o.L], X = [0];
  for (let i = 0; i < br.length - 1; i++) { const m = Math.max(2, Math.round(NE * (br[i + 1] - br[i]) / o.L)); for (let k = 1; k <= m; k++) X.push(br[i] + (br[i + 1] - br[i]) * k / m); }
  const ne = X.length - 1, nd = 2 * (ne + 1), K = Array.from({ length: nd }, () => new Float64Array(nd)), G = Array.from({ length: nd }, () => new Float64Array(nd));
  const EIf = typeof o.EI === "function" ? o.EI : () => o.EI, kwf = typeof o.kw === "function" ? o.kw : () => o.kw || 0;
  for (let e = 0; e < ne; e++) {
    const h = X[e + 1] - X[e], xm = (X[e] + X[e + 1]) / 2, EI = EIf(xm), c = EI / h ** 3, kw = kwf(xm), f = kw * h / 420, g = 1 / (30 * h), d = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    const k = [[12, 6 * h, -12, 6 * h], [6 * h, 4 * h * h, -6 * h, 2 * h * h], [-12, -6 * h, 12, -6 * h], [6 * h, 2 * h * h, -6 * h, 4 * h * h]];
    const m = [[156, 22 * h, 54, -13 * h], [22 * h, 4 * h * h, 13 * h, -3 * h * h], [54, 13 * h, 156, -22 * h], [-13 * h, -3 * h * h, -22 * h, 4 * h * h]];
    const kg = [[36, 3 * h, -36, 3 * h], [3 * h, 4 * h * h, -3 * h, -h * h], [-36, -3 * h, 36, -3 * h], [3 * h, -h * h, -3 * h, 4 * h * h]];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { K[d[i]][d[j]] += c * k[i][j] + f * m[i][j]; G[d[i]][d[j]] += g * kg[i][j]; }
  }
  const fixed = new Set();
  [[o.foot || {}, 0], [o.head || {}, 2 * ne]].forEach(([bc, d0]) => {
    if (bc.t === "b") fixed.add(d0); else if (typeof bc.t === "number") K[d0][d0] += bc.t;
    if (bc.r === "b") fixed.add(d0 + 1); else if (typeof bc.r === "number") K[d0 + 1][d0 + 1] += bc.r;
  });
  const free = [...Array(nd).keys()].filter(d => !fixed.has(d)), n = free.length;
  const A = free.map(i => free.map(j => K[i][j])), B = free.map(i => free.map(j => G[i][j]));
  /* Cholesky de K réduite */
  const Lc = A.map(r => r.slice()); const tolp = 1e-10 * Math.max(...free.map((_, i) => Math.abs(A[i][i])));
  for (let j = 0; j < n; j++) { let s = Lc[j][j]; for (let k = 0; k < j; k++) s -= Lc[j][k] ** 2; if (!(s > tolp)) return { Ncr: 0, mech: true }; Lc[j][j] = Math.sqrt(s);
    for (let i = j + 1; i < n; i++) { let t = Lc[i][j]; for (let k = 0; k < j; k++) t -= Lc[i][k] * Lc[j][k]; Lc[i][j] = t / Lc[j][j]; } }
  const solveK = b => { const y = b.slice(); for (let i = 0; i < n; i++) { for (let k = 0; k < i; k++) y[i] -= Lc[i][k] * y[k]; y[i] /= Lc[i][i]; } for (let i = n - 1; i >= 0; i--) { for (let k = i + 1; k < n; k++) y[i] -= Lc[k][i] * y[k]; y[i] /= Lc[i][i]; } return y; };
  const mv = (M, x) => M.map(r => r.reduce((s, v, j) => s + v * x[j], 0)), dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  let x = free.map((d, i) => 1 + 0.1 * Math.sin(i)), lam = 0;
  for (let it = 0; it < 400; it++) { const y = solveK(mv(B, x)), nrm = Math.sqrt(dot(y, y)) || 1; x = y.map(v => v / nrm); const l2 = dot(x, mv(A, x)) / dot(x, mv(B, x)); if (Math.abs(l2 - lam) < 1e-11 * Math.abs(l2)) { lam = l2; break; } lam = l2; }
  const u = new Float64Array(nd); free.forEach((d, i) => { u[d] = x[i]; });
  return { Ncr: lam, mode: X.map((x, i) => [x, u[2 * i]]) };
}

HB.BEAM = { model, solve, at, extremes, combine, loadVec, loadsFromRows, influence, convoy, buckling };
})(typeof window !== "undefined" ? window : globalThis);
