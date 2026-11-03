/* GMSLT — tests du moteur Guyon-Massonnet-Barès (node tools/test-outils-gmslt.js).
 * 1. cas analytiques indépendants : différences finies sur l'équation de la bande, réciprocité, ∫K = 2b, limites ;
 * 2. cas de référence d'origine : exemples GmsltPra (pont-rail 2 voies) et GmsltPro (pont-route), valeurs chiffrées
 *    relevées dans les notes de calcul du programme d'origine (version 2007). */
const G = require('../outils/js/gmslt.js');
let f = 0, n = 0;
const ok = (c, m) => { n++; console.log((c ? '✓ ' : '✗ ') + m); if (!c) f++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const rel = (a, b, t) => Math.abs(a - b) <= t * Math.max(1e-9, Math.abs(b));

/* ── 1. vérification indépendante par différences finies ──
 * W'''' − 2αk²W'' + k⁴W = δ(u−ue) sur [−1,1], bords libres W'' − νk²W = 0, W''' − (2α−ν)k²W' = 0 (points fictifs). */
function fd(alpha, k, nu, ue, nn = 1600) {
  const h = 2 / nn, N = nn + 1, NT = N + 4, A = Array.from({ length: NT }, () => new Float64Array(NT)), B = new Float64Array(NT);
  const ix = (i) => i + 2; // i = −2…N+1
  for (let i = 0; i < N; i++) {
    const r = ix(i), c4 = [1, -4, 6, -4, 1].map((x) => x / h ** 4), c2 = [1, -2, 1].map((x) => x / h ** 2);
    for (let j = -2; j <= 2; j++) A[r][ix(i + j)] += c4[j + 2];
    for (let j = -1; j <= 1; j++) A[r][ix(i + j)] -= 2 * alpha * k * k * c2[j + 1];
    A[r][r] += k ** 4;
    const u = -1 + i * h; if (Math.abs(u - ue) < h / 2) B[r] = 1 / h;
  }
  for (const [i, rM, rV] of [[0, 0, 1], [N - 1, NT - 2, NT - 1]]) {
    A[rM][ix(i - 1)] += 1 / h ** 2; A[rM][ix(i)] += -2 / h ** 2 - nu * k * k; A[rM][ix(i + 1)] += 1 / h ** 2;
    const c = (2 * alpha - nu) * k * k;
    A[rV][ix(i - 2)] += -1 / (2 * h ** 3); A[rV][ix(i - 1)] += 1 / h ** 3 + c / (2 * h); A[rV][ix(i + 1)] += -1 / h ** 3 - c / (2 * h); A[rV][ix(i + 2)] += 1 / (2 * h ** 3);
  }
  // élimination de Gauss bande (largeur ≤ 5) avec pivot partiel limité
  const M = A, X = B, nT = NT;
  for (let kk = 0; kk < nT; kk++) {
    let p = kk; for (let i = kk + 1; i < Math.min(nT, kk + 6); i++) if (Math.abs(M[i][kk]) > Math.abs(M[p][kk])) p = i;
    if (p !== kk) { const t = M[p]; M[p] = M[kk]; M[kk] = t; const tb = X[p]; X[p] = X[kk]; X[kk] = tb; }
    for (let i = kk + 1; i < Math.min(nT, kk + 8); i++) { const q = M[i][kk] / M[kk][kk]; if (!q) continue; for (let j = kk; j < Math.min(nT, kk + 12); j++) M[i][j] -= q * M[kk][j]; X[i] -= q * X[kk]; }
  }
  const W = new Float64Array(nT);
  for (let i = nT - 1; i >= 0; i--) { let s = X[i]; for (let j = i + 1; j < Math.min(nT, i + 12); j++) s -= M[i][j] * W[j]; W[i] = s / M[i][i]; }
  return (u) => { const t = (u + 1) / h, i = Math.round(t); const w = W[ix(i)], d2 = (W[ix(i - 1)] - 2 * w + W[ix(i + 1)]) / h ** 2; return [w, d2]; };
}
for (const [al, th, nu, y, e] of [[1, 0.5, 0, 0, 0], [1, 0.5, 0, -1, -0.95], [0, 0.5, 0, -1, 0.5], [0, 1.2, 0, 0, 0], [0.4, 0.8, 0, 0.5, -0.25]]) {
  const k = Math.PI * th, w = fd(al, k, 0, e)(y)[0], Kfd = 2 * k ** 4 * w, K = G.Kexact(al, th, y, e);
  if (al === 0 || al === 1) ok(rel(K, Kfd, 2e-3), `K exact (α=${al}, θ=${th}, y/b=${y}, e/b=${e}) = ${K.toFixed(4)} ; différences finies ${Kfd.toFixed(4)}`);
  else { const Ke = G.Kalpha(al, th, y, e, { interp: 'exacte' }); ok(rel(Ke, Kfd, 2e-3), `K résolution directe α=${al} : ${Ke.toFixed(4)} ; différences finies ${Kfd.toFixed(4)}`); }
}
for (const [al, th, nu, y, e] of [[1, 0.5, 0.2, 0, 0], [1, 0.9, 0.2, -0.5, -0.25], [0, 0.6, 0, 0.25, 0.25]]) {
  const k = Math.PI * th, r = fd(al, k, nu, e)(y), mu = -(r[1] - nu * k * k * r[0]), m = G.MUexact(al, th, y, e, nu);
  ok(near(m, mu, 2e-3 * Math.max(0.05, Math.abs(mu))), `μ exact (α=${al}, θ=${th}, ν=${nu}, y/b=${y}, e/b=${e}) = ${m.toFixed(5)} ; différences finies ${mu.toFixed(5)}`);
}
// réciprocité de Maxwell K(y, e) = K(e, y), μ symétrique en (y, e) ↔ (−y, −e)
ok(near(G.Kexact(1, 0.7, -0.3, 0.8), G.Kexact(1, 0.7, 0.8, -0.3), 1e-10) && near(G.Kexact(0, 0.7, -0.3, 0.8), G.Kexact(0, 0.7, 0.8, -0.3), 1e-10), 'réciprocité K(y,e) = K(e,y) pour α = 0 et α = 1');
ok(near(G.MUexact(1, 0.6, -0.4, 0.3, 0.2), G.MUexact(1, 0.6, 0.4, -0.3, 0.2), 1e-12), 'symétrie μ(y,e) = μ(−y,−e)');
// valeur moyenne : (1/2b)∫K de = 1 sur la largeur (charge répartie uniformément ⇒ K ≡ 1)
for (const [al, th] of [[1, 0.5], [0, 0.5], [0, 1.5]]) {
  let s = 0; const nn = 400; for (let i = 0; i < nn; i++) s += G.Kexact(al, th, 0.3, -1 + (i + 0.5) * 2 / nn) / nn;
  ok(near(s, 1, 2e-4), `moyenne de K sur 2b = ${s.toFixed(5)} (α=${al}, θ=${th})`);
}
ok(near(G.Kexact(0, 0.02, -1, 1), -2, 1e-3) && near(G.Kexact(0, 0.02, 0.5, -0.7), 1 - 3 * 0.35, 1e-3), 'θ → 0, α = 0 : section transversale indéformable (Courbon) K → 1 + 3ye/b²');
ok(near(G.Kexact(1, 0.02, 0.5, -0.7), 1, 1e-3), 'θ → 0, α = 1 : rotation empêchée par la torsion, K → 1');
ok(G.Kexact(0, 2, 0, 0) > G.Kexact(1, 2, 0, 0), 'α = 0 plus concentré que α = 1 (K(0,0) décroît avec α)');
// interpolation de Massonnet : √α
{ const K0 = G.Kexact(0, 0.6, 0, 0), K1 = G.Kexact(1, 0.6, 0, 0); ok(near(G.Kalpha(0.25, 0.6, 0, 0), K0 + (K1 - K0) * 0.5, 1e-12), 'interpolation K = K0 + (K1 − K0)√α'); }
{ const a = 0.3, th = 0.8, Km = G.Kalpha(a, th, 0, 0), Ke = G.Kalpha(a, th, 0, 0, { interp: 'exacte' }); ok(rel(Km, Ke, 0.03), `interpolation √α ≈ résolution exacte (α=0,3, θ=0,8) : ${Km.toFixed(4)} / ${Ke.toFixed(4)}`); }
// charge hors dalle, mode statique : moment de console au bord = −d·P
ok(near(G.MUexact(1, 0.4, -1, -1.3, 0.2, 'statique'), -0.3, 1e-9), 'charge sur encorbellement (mode statique) : μ(bord) = −d');
// rigidités : dalle pleine
{ const r = G.rigDalle({ E: 3e7, h: 0.8, b: 6, L: 15 }); ok(near(G.theta(6, 15, r.rhoP, r.rhoE), 0.4, 1e-12) && near(G.alphaT(r.gP, r.gE, r.rhoP, r.rhoE), 1, 1e-12), 'dalle pleine : θ = b/L, α = 1'); }
{ const r = G.rigPoutres({ E: 1, nu: 0, b1: 2, Ip: 0.4, Kp: 0.02, hd: 0.2 }); ok(near(r.rhoP, 0.2, 1e-12) && near(r.gP, 0.005, 1e-12) && near(r.rhoE, 0.008 / 12, 1e-12) && near(r.gE, 0.5 * 0.008 / 6, 1e-12), 'tablier à poutres : ρP = EIp/b1, γP = GKp/b1, ρE = Eh³/12, γE = Gh³/6');
  const th = G.theta(5, 20, r.rhoP, r.rhoE); ok(near(th, 0.25 * Math.pow(0.2 / (0.008 / 12), 0.25), 1e-12), 'θ = (b/L)(ρP/ρE)^¼ = ' + th.toFixed(4)); }
ok(near(G.kRect(1, 0.1), 1 / 3 - 0.021 * (1 - 1e-4 / 12), 1e-12), 'coefficient de torsion d’un rectangle allongé');
// API : K pour une charge donnée et pour un groupe
{ const p = { b: 5, theta: 0.5, alpha: 1 }; ok(near(G.Kpoint(p, -5, -5), G.Kexact(1, 0.5, -1, -1), 1e-12) && near(G.Kgroupe(p, 0, [{ e1: -5, e2: 5, P: 1 }]), 1, 1e-3), 'API Kpoint, Kgroupe (charge sur toute la largeur → 1)'); }
// placement par programmation dynamique contre énumération
{ const grid = [], vals = []; for (let i = 0; i <= 60; i++) { grid.push(i * 0.1); vals.push(Math.sin(i * 0.37) + 0.3 * Math.cos(i * 0.11)); }
  const coefN = (k) => [0, 1.2, 1.1, 0.95][k] || 0, r = G.placer(vals, grid, 3, 2.5, coefN, 1);
  let best = 0; for (let a = 0; a < 61; a++) { best = Math.max(best, coefN(1) * vals[a]); for (let b = a + 25; b < 61; b++) { best = Math.max(best, coefN(2) * (vals[a] + vals[b])); for (let c = b + 25; c < 61; c++) best = Math.max(best, coefN(3) * (vals[a] + vals[b] + vals[c])); } }
  ok(near(r.v, best, 1e-12), 'placement transversal optimal (programmation dynamique = énumération) ' + r.v.toFixed(4)); }
// Fascicule 61 : géométrie
{ const g = G.f61Geom(10.6, 2); ok(g.Lch === 9.6 && g.Nv === 3 && near(g.v, 3.2, 1e-12) && g.classe === 1, 'Fasc. 61 : Lch = 9,60 m, 3 voies de 3,20 m, classe 1'); }
{ const g = G.f61Geom(5.5, 0); ok(g.Nv === 2 && g.classe === 3, 'Fasc. 61 : largeur chargeable de 5,50 m → 2 voies (art. 2.2), classe 3'); }

/* ── 2. cas de référence d'origine ── */
// GmsltPra : pont-rail 2 voies, L = 12 m, 2b = 11 m, θ = 0,458333, α = 1, ν = 0,2
const thPra = 0.458333;
// tableau des K (bandes y, excentricités e) — note de calcul GmsltPra, § 2
for (const [y, e, v] of [[-5.5, -11, 4.009], [-5.5, -5.5, 1.979], [0, 0, 1.090], [-4.125, -8.25, 1.970], [2.75, -11, -0.044], [5.5, 11, 4.009], [0.6875, 5.5, 0.985], [-1.375, 0, 1.061]])
  ok(near(G.Kexact(1, thPra, y / 5.5, e / 5.5), v, 6e-4), `GmsltPra K(y=${y}, e=${e}) = ${G.Kexact(1, thPra, y / 5.5, e / 5.5).toFixed(4)} (origine ${v})`);
// tableau 10⁴·μ pour θ, 2θ … 5θ — note GmsltPra § 2 (y, e, [μ1…μ5])
for (const [y, e, vals] of [[-5.5, -8.9375, [-7859.62, -13896.85, -28965.24, -64813.76, -149991.57]], [0, -8.9375, [-1795.19, -355.93, 48.42, 153.05, 156.80]], [-4.125, -4.125, [1187.6, 840.79, 626.50, 492.47, 403.26]], [0, 2.75, [208.97, -18.79, -38.95, -27.42, -16.01]], [-2.75, 6.1875, [-438.14, -48.79, -4.63, -0.40, -0.03]]]) {
  const got = vals.map((_, i) => 1e4 * G.MUexact(1, (i + 1) * thPra, y / 5.5, e / 5.5, 0.2));
  ok(got.every((g, i) => near(g, vals[i], 0.006 * Math.max(1, Math.abs(vals[i]) / 100) + 0.02)), `GmsltPra 10⁴μ(y=${y}, e=${e}) = ${got.map((x) => x.toFixed(2)).join(' / ')}`);
}
// résultats : superstructures et convois UIC+SW/0, SW/2 (voie 1 à −2,25 m)
const pra = G.calcul({ type: 'rail', L: 12, larg: 11, alpha: 1, theta: thPra, nu: 0.2, N: 5, couches: [{ y1: -5.2, y2: 5.2, q: 13, gmax: 1.3, gmin: 1 }], rail: { voies: [-2.25, 2.25], hb: 0.45, hd: 0.85, ltrav: 2.25 } });
const ix = (y) => Math.round((y + 5.5) / (11 / 16));
const cmp = (cas, champ, y, v, tol, lab) => { const r = pra.cas[cas].res[ix(y)][champ]; ok(near(r, v, tol), `GmsltPra ${lab} y=${y} : ${r.toFixed(4)} (origine ${v})`); };
cmp('sup', 'Mmax', 0, 47.1089, 0.01, 'superstructures Mmax'); cmp('sup', 'Mmin', 0, 36.2367, 0.01, 'superstructures Mmin');
cmp('sup', 'Mmax', -4.8125, 12.1598, 0.01, 'superstructures Mmax'); cmp('sup', 'Kmax', -5.5, 0.9898, 2e-4, 'superstructures K');
cmp('V1 SW/2', 'Kmax', -5.5, 1.2588, 2e-4, 'SW/2 voie 1 K'); cmp('V1 SW/2', 'Kmax', 5.5, 0.6504, 2e-4, 'SW/2 voie 1 K');
for (const [y, v] of [[-4.8125, 21.9528], [-2.75, 110.998], [-2.0625, 117.3184], [-0.6875, 75.6305], [0, 47.4251], [1.375, 10.1661]]) cmp('V1 SW/2', 'Mmax', y, v, 0.1, 'SW/2 voie 1 Mmax');
for (const [y, v] of [[2.75, -7.444], [3.4375, -10.4696], [4.8125, -6.6794]]) cmp('V1 SW/2', 'Mmin', y, v, 0.05, 'SW/2 voie 1 Mmin');
for (const [y, v] of [[-4.8125, 19.9773], [-2.0625, 111.9149], [-0.6875, 70.9039], [0, 43.593]]) cmp('V1 LM71+SW/0', 'Mmax', y, v, 0.12, 'UIC+SW/0 voie 1 Mmax');
for (const [y, v] of [[3.4375, -9.9175], [4.125, -9.5156]]) cmp('V1 LM71+SW/0', 'Mmin', y, v, 0.03, 'UIC+SW/0 voie 1 Mmin');
// écart connu : à y = +1,375 m, l'origine retient SW/0 (9,01) ; LM71 réparti donne 9,01 aussi
cmp('V1 LM71+SW/0', 'Mmax', 1.375, 9.0139, 0.05, 'UIC+SW/0 voie 1 Mmax');
cmp('V2 SW/2', 'Mmax', 2.0625, 117.3184, 0.1, 'SW/2 voie 2 Mmax (symétrie)');

// GmsltPro : pont-route, L = 15 m, 2b = 12 m, θ = 0,4, α = 1, ν = 0,2 ; chaussée 10,60 m entre 2 dispositifs de retenue
const lay = [[0.2, 10, 1, 1.05, 0.95], [1.0, 20, 0, 1.05, 0.95], [0.5, 30, 1, 1.05, 0.95], [10.6, 30, 0, 1.4, 0.8], [0.5, 30, 1, 1.05, 0.95], [1.0, 20, 0, 1.05, 0.95], [0.2, 10, 1, 1.05, 0.95]];
let x = -7; const couches = [{ y1: -7, y2: -6, q: 20, gmax: 1, gmin: 1 }, { y1: 6, y2: 7, q: 20, gmax: 1, gmin: 1 }];
for (const [w, q, lin, gM, gm] of lay) { couches.push({ y1: x, y2: x + w, q, lin: !!lin, gmax: gM, gmin: gm }); x += w; }
const pro = G.calcul({ type: 'route', L: 15, larg: 12, alpha: 1, theta: 0.4, nu: 0.2, N: 5, couches,
  route: { Lr: 10.6, nDisp: 2, trottoirs: [[-6.8, -5.8], [5.8, 6.8]], unitaireAL: true, sansBc: true, systemes: { AL: 1, Bc: 1, Bt: 1, Mc80: 1, Mc120: 1, trottoir: 1 } } });
const jx = (y) => Math.round((y + 6) / 0.75);
const cmq = (cas, champ, y, v, tol, lab) => { const r = pro.cas[cas].res[jx(y)][champ]; ok(near(r, v, tol), `GmsltPro ${lab} y=${y} : ${r.toFixed(4)} (origine ${v})`); };
// K du tableau (θ = 0,4)
for (const [y, e, v] of [[-6, -12, 3.176], [0, -6, 0.922], [6, -12, -0.011], [-3, -9, 1.368]]) ok(near(G.Kexact(1, 0.4, y / 6, e / 6), v, 6e-4), `GmsltPro K(y=${y}, e=${e}) = ${G.Kexact(1, 0.4, y / 6, e / 6).toFixed(4)} (origine ${v})`);
for (const [y, mn, mx] of [[-6, -30.162, -28.3823], [-5.25, -15.0433, 4.4268], [-3, -2.5103, 60.1217], [0, 3.7407, 85.4289]]) { cmq('sup', 'Mmin', y, mn, 0.02, 'superstructures Mmin'); cmq('sup', 'Mmax', y, mx, 0.02, 'superstructures Mmax'); }
cmq('sup', 'Kmax', -6, 1.0299, 0.0015, 'superstructures K (écart : pondération des K, voir rapport)');
for (const [y, k, mx, mn] of [[-6, 0.9741, 0, 0], [-3.75, 0.9964, 3.0231, -0.3973], [0, 1.0154, 4.4912, 0]]) { cmq('AL', 'Kmax', y, k, 2e-4, 'A(l) unitaire K'); cmq('AL', 'Mmax', y, mx, 0.01, 'A(l) unitaire Mmax'); cmq('AL', 'Mmin', y, mn, 0.01, 'A(l) unitaire Mmin'); }
for (const [y, k, mx, mn] of [[-6, 1.0726, 0, 0], [-4.5, 1.0705, 32.8356, -3.9755], [-3, 1.0643, 49.7462, -5.1088], [-2.25, 1.0583, 66.6051, -4.7095], [0, 1.0269, 70.367, 0]]) { cmq('Bc', 'Kmax', y, k, 2e-4, 'Bc K'); cmq('Bc', 'Mmax', y, mx, 0.01 * mx + 0.05, 'Bc Mmax'); cmq('Bc', 'Mmin', y, mn, 0.03, 'Bc Mmin'); }
cmq('Bc', 'Mmax', -0.75, 71.2032, 0.6, 'Bc Mmax (grille transversale plus fine : +0,8 %)');
for (const [y, k, mx, mn] of [[-6, 1.1505, 0, 0], [-3, 1.1112, 47.7046, -5.177], [0, 1.0366, 70.4209, 0], [-1.5, 1.0746, 67.93, -2.98]]) { cmq('Bt', 'Kmax', y, k, 2e-4, 'Bt K'); cmq('Bt', 'Mmax', y, mx, 0.12, 'Bt Mmax'); cmq('Bt', 'Mmin', y, mn, 0.02, 'Bt Mmin'); }
for (const [y, k, mx, mn] of [[-6, 1.3037, 0, 0], [-3, 1.1873, 71.3976, -7.7404], [0, 1.0507, 76.6605, 0], [-3.75, 1.2226, 64.12, -8.56]]) { cmq('Mc80', 'Kmax', y, k, 2e-4, 'M80 K'); cmq('Mc80', 'Mmax', y, mx, 0.15, 'M80 Mmax'); cmq('Mc80', 'Mmin', y, mn, 0.02, 'M80 Mmin'); }
for (const [y, k, mx, mn] of [[-6, 1.2704, 0, 0], [-3, 1.1733, 91.5979, -6.8685], [0, 1.0484, 96.7371, 0], [-1.5, 1.0978, 99.75, 0]]) { cmq('Mc120', 'Kmax', y, k, 2e-4, 'M120 K'); cmq('Mc120', 'Mmax', y, mx, 0.1, 'M120 Mmax'); cmq('Mc120', 'Mmin', y, mn, 0.02, 'M120 Mmin'); }
for (const [y, k, mn] of [[-6, 1.8191, -0.5445], [-3, 1.297, -1.5747], [0, 0.9143, -1.853]]) { cmq('trottoir', 'Kmax', y, k, 2e-4, 'trottoirs K'); cmq('trottoir', 'Mmin', y, mn, 0.002, 'trottoirs Mmin'); }

// lecture .don
{ const txt = 'typouv\t\t;Type\r\n2\r\nlondalle\t;L\r\n12.0\r\nlardalle\r\n11\r\nteta ;t\r\n0.458333\r\nexcv1\r\n-2.25\r\nexcv2\r\n2.25\r\nesoutra\r\n0.45\r\ntypchexp\r\n3\r\nFIN_DICO\r\n';
  const d = G.lireDon(txt); ok(d.type === 'rail' && d.L === 12 && d.larg === 11 && d.voies.length === 2 && d.voies[1] === 2.25 && d.hb === 0.45, 'lecture d’un fichier .don'); }
// LM1 (EN 1991-2) : cohérence — la voie 1 seule sur une dalle étroite à une voie
{ const r = G.calcul({ type: 'route', L: 10, larg: 3, alpha: 1, theta: 0.15, nu: 0, N: 5, ec: { w: 3, classe: 1 } });
  ok(r.cas.LM1.res.every((x) => near(x.Kmax, 1, 0.02)), 'LM1 : une seule voie occupant toute la largeur → K ≈ 1'); }

console.log(`\n${n - f}/${n} vérifications réussies`);
process.exit(f ? 1 : 0);
