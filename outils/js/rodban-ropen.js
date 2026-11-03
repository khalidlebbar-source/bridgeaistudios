/* RODBAN-ROPEN — tabliers de ponts-routes en dalle de béton armé (RODBA) ou à poutrelles enrobées (ROPEN),
 * 1 à 7 travées continues, portées 1 à 35 m (moteur pur, aucun DOM ; node → module.exports, navigateur → window.BA.rodbanRopen).
 *
 * Deux méthodes de calcul :
 *  ── « poutre » (biais 70 à 130 gr) : charges du Fascicule 61 titre II — A(l) (art. 4), Bc (art. 5.2), Bt (art. 5.4),
 *     Mc80 / Mc120 (art. 9), trottoirs (art. 13), coefficient de majoration dynamique δ (art. 5.5) — appliquées sur la
 *     poutre continue de largeur totale (BA.poutre : lignes d'influence exactes, enveloppes des convois) ; moments par
 *     mètre de largeur à la fibre la plus sollicitée obtenus avec les coefficients de répartition transversale de
 *     Guyon-Massonnet (BA.gmslt, placement Fasc. 61 automatique) ; flexion transversale à mi-travée par BA.gmslt.
 *  ── « plaque » (biais 20 à 180 gr) : éléments finis de plaque de Reissner-Mindlin MITC4 (Bathe-Dvorkin 1985,
 *     déformations de cisaillement transverse interpolées aux points d'attache : pas de verrouillage), maillage biais
 *     suivant les lignes d'appui, épaisseur variable (encorbellements), orthotropie pour les poutrelles enrobées,
 *     appareils d'appui ponctuels. Surfaces d'influence par la méthode adjointe (réciprocité de Maxwell-Betti) pour
 *     mx, my, mxy aux points de calcul et pour les réactions d'appareils ; placement des charges EN 1991-2 sur ces
 *     surfaces : LM1 (TS + UDL, §4.3.2, α de l'AN française, voies conventionnelles placées et numérotées au plus
 *     défavorable par programmation dynamique, §4.2.4), LM2 (§4.3.3), LM4 (foule 5 kN/m², §4.3.5), convois LM3 de
 *     l'annexe A (lignes d'essieux à 1,50 m), charges de trottoir qfk (§5.3.2.1). Diffusion des charges de roue à 45°
 *     jusqu'au feuillet moyen (§4.3.6). Ferraillage orthogonal (axe de l'ouvrage / perpendiculaire), torsion par
 *     Wood-Armer m* = m ± |mxy| (enveloppes non concomitantes : majorant).
 *
 * Sections : BA.sectionBA (EN 1992-1-1/-2 + AN ou BAEL 91 mod. 99) par mètre de largeur ; poutrelles enrobées :
 *   EN 1994-2 §6.3 (moment résistant plastique, effort tranchant repris par les poutrelles seules Vpl,Rd = Av·fy/√3/γM0,
 *   EN 1993-1-1 §6.2.6), contraintes ELS par phases (poutrelles seules sous béton frais, puis section homogénéisée
 *   n = Ea/Ecm·(1+φ) longue durée, Ea/Ecm courte durée), déversement en phase de bétonnage (EN 1993-1-1 §6.3.2.2,
 *   courbe a des profilés laminés h/b ≤ 2).
 * Combinaisons : EN 1990 annexe A2 + AN (ELU 1,35 Gsup / 1,00 Ginf + 1,35 groupes de trafic ; ELS caractéristique,
 *   fréquente ψ1 = 0,75 TS / 0,40 UDL et trottoirs, quasi permanente) ; BAEL / Fasc. 62 titre I sect. I annexe (ponts-
 *   routes) : ELU 1,35 Gmax + Gmin + 1,6 Q (A, B, trottoirs) ou 1,35 Q (Mc) ; ELS Gmax + Gmin + 1,2 Q (A, B), 1,0 Q (Mc,
 *   trottoirs).
 * Unités : kN, m, kPa ; matériaux en MPa ; sections d'acier en cm².
 */
(function (root) {
  'use strict';
  const req = (p, nom) => {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') { try { return require(p); } catch (e) { return null; } }
    return root.BA && root.BA[nom];
  };
  const CH = req('./charges.js', 'charges'), PT = req('./poutre.js', 'poutre'), GM = req('./gmslt.js', 'gmslt'), SB = req('./bael-ec2.js', 'sectionBA');
  const GR = Math.PI / 200;
  const EPS = 1e-9;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const num = (v, d = 0) => { const x = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : d; };

  /* ══════════════════ 1. Catalogue de poutrelles (EN 10365, profils HE usuels des tabliers enrobés) ══════════════════
   * h, b, tw, tf, r en m ; A en m², Iy en m⁴, g en kN/m (ρ = 7850 kg/m³). */
  const PROFILS = {
    'HEA 300': [0.290, 0.300, 0.0085, 0.014, 0.027], 'HEA 360': [0.350, 0.300, 0.010, 0.0175, 0.027], 'HEA 400': [0.390, 0.300, 0.011, 0.019, 0.027],
    'HEA 450': [0.440, 0.300, 0.0115, 0.021, 0.027], 'HEA 500': [0.490, 0.300, 0.012, 0.023, 0.027], 'HEA 550': [0.540, 0.300, 0.0125, 0.024, 0.027],
    'HEA 600': [0.590, 0.300, 0.013, 0.025, 0.027], 'HEA 650': [0.640, 0.300, 0.0135, 0.026, 0.027], 'HEA 700': [0.690, 0.300, 0.0145, 0.027, 0.027],
    'HEA 800': [0.790, 0.300, 0.015, 0.028, 0.030], 'HEA 900': [0.890, 0.300, 0.016, 0.030, 0.030], 'HEA 1000': [0.990, 0.300, 0.0165, 0.031, 0.030],
    'HEB 300': [0.300, 0.300, 0.011, 0.019, 0.027], 'HEB 360': [0.360, 0.300, 0.0125, 0.0225, 0.027], 'HEB 400': [0.400, 0.300, 0.0135, 0.024, 0.027],
    'HEB 450': [0.450, 0.300, 0.014, 0.026, 0.027], 'HEB 500': [0.500, 0.300, 0.0145, 0.028, 0.027], 'HEB 550': [0.550, 0.300, 0.015, 0.029, 0.027],
    'HEB 600': [0.600, 0.300, 0.0155, 0.030, 0.027], 'HEB 650': [0.650, 0.300, 0.016, 0.031, 0.027], 'HEB 700': [0.700, 0.300, 0.017, 0.032, 0.027],
    'HEB 800': [0.800, 0.300, 0.0175, 0.033, 0.030], 'HEB 900': [0.900, 0.300, 0.0185, 0.035, 0.030], 'HEB 1000': [1.000, 0.300, 0.019, 0.036, 0.030],
    'HEM 300': [0.340, 0.310, 0.021, 0.039, 0.027], 'HEM 360': [0.395, 0.308, 0.021, 0.040, 0.027], 'HEM 400': [0.432, 0.307, 0.021, 0.040, 0.027],
    'HEM 450': [0.478, 0.307, 0.021, 0.040, 0.027], 'HEM 500': [0.524, 0.306, 0.021, 0.040, 0.027], 'HEM 550': [0.572, 0.306, 0.021, 0.040, 0.027],
    'HEM 600': [0.620, 0.305, 0.021, 0.040, 0.027], 'HEM 650': [0.668, 0.305, 0.021, 0.040, 0.027], 'HEM 700': [0.716, 0.304, 0.021, 0.040, 0.027],
    'HEM 800': [0.814, 0.303, 0.021, 0.040, 0.030], 'HEM 900': [0.910, 0.302, 0.021, 0.040, 0.030], 'HEM 1000': [1.008, 0.302, 0.021, 0.040, 0.030],
  };
  /* caractéristiques d'un I laminé doublement symétrique (congés : 4 quarts de cercle « (1 − π/4) r² ») */
  function profil(p) {
    const { h, b, tw, tf } = p, r = p.r || 0;
    const hw = h - 2 * tf, ac = (4 - Math.PI) * r * r;                        // aire des 4 congés
    const A = 2 * b * tf + hw * tw + ac;
    const yc = h / 2 - tf - (0.2234 * r);                                     // centre d'un congé (≈ à 0,2234 r du nu de l'aile)
    const I = b * h ** 3 / 12 - (b - tw) * hw ** 3 / 12 + ac * yc * yc;
    const Wpl = b * tf * (h - tf) + tw * hw * hw / 4 + ac * yc;
    const Av = Math.max(A - 2 * b * tf + (tw + 2 * r) * tf, 1.0 * hw * tw);   // EN 1993-1-1 §6.2.6 (3) a), η = 1
    // inertie de torsion de Saint-Venant (approchée) et de gauchissement
    const It = (2 * b * tf ** 3 + (h - 2 * tf) * tw ** 3) / 3, Iz = 2 * tf * b ** 3 / 12 + hw * tw ** 3 / 12, Iw = Iz * (h - tf) ** 2 / 4;
    return Object.assign({}, p, { A, I, Wel: I / (h / 2), Wpl, Av, It, Iz, Iw, g: A * 77 });
  }
  const profilNom = (nom) => { const v = PROFILS[nom]; if (!v) return null; return profil({ nom, h: v[0], b: v[1], tw: v[2], tf: v[3], r: v[4] }); };

  /* ══════════════════ 2. Données, géométrie transversale, charges permanentes ══════════════════ */
  /* d.trans = {dG, tG, lc, tD, dD (largeurs de gauche à droite : rive, trottoir, chaussée, trottoir, rive),
   *            Bs (largeur de sous-face), h (épaisseur courante de la dalle), hr (épaisseur de rive des encorbellements)}
   * repère transversal : y depuis le bord gauche du tablier (0 … B), axe du tablier en B/2. */
  function geoTrans(d) {
    const t = d.trans, B = t.dG + t.tG + t.lc + t.tD + t.dD;
    const Bs = Math.min(B, t.Bs > 0 ? t.Bs : B), lcg = (B - Bs) / 2;
    const h = t.h, hr = t.hr > 0 ? Math.min(t.hr, h) : h;
    const ep = (y) => { // épaisseur structurelle à l'ordonnée y
      if (y < lcg) return hr + (h - hr) * clamp(y / Math.max(lcg, EPS), 0, 1);
      if (y > B - lcg) return hr + (h - hr) * clamp((B - y) / Math.max(lcg, EPS), 0, 1);
      return h;
    };
    const A = Bs * h + 2 * lcg * (h + hr) / 2;
    const chaussee = [t.dG + t.tG, t.dG + t.tG + t.lc];
    const trottoirs = [];
    if (t.tG > 0) trottoirs.push([t.dG, t.dG + t.tG]);
    if (t.tD > 0) trottoirs.push([B - t.dD - t.tD, B - t.dD]);
    return { B, Bs, lcg, h, hr, ep, A, chaussee, trottoirs, yc: B / 2 };
  }
  /* Charges permanentes : catégories {nom, type:'lin'|'surf', q (kN/m ou kN/m²), y (lin : ordonnée depuis le bord
   * gauche ; « sym » = présente des deux côtés), y1,y2 (surf), kmax, kmin}. Poids propre : γb·A (kpp). */
  function permanentes(d, G) {
    const cats = [];
    const gb = d.mat.gb || 25;
    if (d.type === 'ropen') {
      const P = d.ropen.P, n = d.ropen.n;
      const Ab = G.A - n * P.A - d.ropen.trousVides;                                // béton (poutrelles déduites)
      cats.push({ nom: 'Poids propre béton', type: 'pp', qlin: gb * Ab, kmax: d.coef.ppMax, kmin: d.coef.ppMin, phase: 1 });
      cats.push({ nom: 'Poutrelles', type: 'pp', qlin: n * P.g, kmax: d.coef.ppMax, kmin: d.coef.ppMin, phase: 1 });
    } else cats.push({ nom: 'Poids propre', type: 'pp', qlin: gb * G.A, kmax: d.coef.ppMax, kmin: d.coef.ppMin, phase: 1 });
    for (const e of d.equip || []) {
      if (!(Math.abs(+e.q) > 0)) continue;
      if (e.type === 'surf') cats.push({ nom: e.nom, type: 'surf', q: +e.q, y1: +e.y1, y2: +e.y2, kmax: +e.kmax || 1, kmin: +e.kmin || 1, qlin: +e.q * (+e.y2 - +e.y1), phase: 2 });
      else {
        const ys = e.sym ? [+e.y, G.B - +e.y] : [+e.y];
        cats.push({ nom: e.nom, type: 'lin', q: +e.q, ys, kmax: +e.kmax || 1, kmin: +e.kmin || 1, qlin: +e.q * ys.length, phase: 2 });
      }
    }
    return cats;
  }

  /* ══════════════════ 3. Plaque de Reissner-Mindlin MITC4 ══════════════════
   * ddl par nœud : w (flèche, > 0 vers le bas), βx, βy (rotations de la normale : u = z·βx, v = z·βy, z vers le bas).
   * Courbures κ = [βx,x ; βy,y ; βx,y + βy,x], cisaillements γ = [w,x + βx ; w,y + βy] ; m = Db·κ (mx > 0 tend la fibre
   * inférieure), q = Ds·γ. MITC4 : γrz interpolé entre A(0,1) et C(0,−1), γsz entre B(−1,0) et D(1,0). */
  const GP = [-1 / Math.sqrt(3), 1 / Math.sqrt(3)];
  const NN = (r, s) => [(1 - r) * (1 - s) / 4, (1 + r) * (1 - s) / 4, (1 + r) * (1 + s) / 4, (1 - r) * (1 + s) / 4];
  const dNr = (r, s) => [-(1 - s) / 4, (1 - s) / 4, (1 + s) / 4, -(1 + s) / 4];
  const dNs = (r, s) => [-(1 - r) / 4, -(1 + r) / 4, (1 + r) / 4, (1 - r) / 4];
  function jac(X, Y, r, s) {
    const a = dNr(r, s), b = dNs(r, s);
    let xr = 0, yr = 0, xs = 0, ys = 0;
    for (let i = 0; i < 4; i++) { xr += a[i] * X[i]; yr += a[i] * Y[i]; xs += b[i] * X[i]; ys += b[i] * Y[i]; }
    const det = xr * ys - yr * xs;
    // [∂/∂x ; ∂/∂y] = J⁻¹ [∂/∂r ; ∂/∂s], J = [[xr, yr],[xs, ys]]
    const i11 = ys / det, i12 = -yr / det, i21 = -xs / det, i22 = xr / det;
    const dx = a.map((v, k) => i11 * v + i12 * b[k]), dy = a.map((v, k) => i21 * v + i22 * b[k]);
    return { det, xr, yr, xs, ys, i11, i12, i21, i22, dx, dy };
  }
  /* matrice de courbure Bb (3×12) au point (r, s) */
  function Bbend(X, Y, r, s) {
    const J = jac(X, Y, r, s), B = [new Float64Array(12), new Float64Array(12), new Float64Array(12)];
    for (let i = 0; i < 4; i++) {
      B[0][3 * i + 1] = J.dx[i];
      B[1][3 * i + 2] = J.dy[i];
      B[2][3 * i + 1] = J.dy[i]; B[2][3 * i + 2] = J.dx[i];
    }
    return { B, J };
  }
  /* cisaillement covariant γr (ou γs) au point (r, s) : ligne de 12 coefficients */
  function gamCov(X, Y, r, s, dir) {
    const J = jac(X, Y, r, s), N = NN(r, s), dN = dir === 'r' ? dNr(r, s) : dNs(r, s);
    const xa = dir === 'r' ? J.xr : J.xs, ya = dir === 'r' ? J.yr : J.ys, row = new Float64Array(12);
    for (let i = 0; i < 4; i++) { row[3 * i] = dN[i]; row[3 * i + 1] = N[i] * xa; row[3 * i + 2] = N[i] * ya; }
    return row;
  }
  function Bshear(X, Y, r, s) {
    const gA = gamCov(X, Y, 0, 1, 'r'), gC = gamCov(X, Y, 0, -1, 'r'), gB = gamCov(X, Y, -1, 0, 's'), gD = gamCov(X, Y, 1, 0, 's');
    const gr = new Float64Array(12), gs = new Float64Array(12);
    for (let k = 0; k < 12; k++) { gr[k] = 0.5 * (1 + s) * gA[k] + 0.5 * (1 - s) * gC[k]; gs[k] = 0.5 * (1 + r) * gD[k] + 0.5 * (1 - r) * gB[k]; }
    const J = jac(X, Y, r, s);
    // [γx ; γy] = J⁻¹ [γr ; γs]
    const gx = new Float64Array(12), gy = new Float64Array(12);
    for (let k = 0; k < 12; k++) { gx[k] = J.i11 * gr[k] + J.i12 * gs[k]; gy[k] = J.i21 * gr[k] + J.i22 * gs[k]; }
    return { B: [gx, gy], J };
  }
  function kElem(X, Y, Db, Ds) {
    const K = Array.from({ length: 12 }, () => new Float64Array(12));
    for (const r of GP) for (const s of GP) {
      const b = Bbend(X, Y, r, s), w = b.J.det, sh = Bshear(X, Y, r, s);
      for (let i = 0; i < 12; i++) {
        const bi = [b.B[0][i], b.B[1][i], b.B[2][i]], si = [sh.B[0][i], sh.B[1][i]];
        if (!bi[0] && !bi[1] && !bi[2] && !si[0] && !si[1]) continue;
        const Dbi = [Db[0][0] * bi[0] + Db[0][1] * bi[1] + Db[0][2] * bi[2], Db[1][0] * bi[0] + Db[1][1] * bi[1] + Db[1][2] * bi[2], Db[2][0] * bi[0] + Db[2][1] * bi[1] + Db[2][2] * bi[2]];
        const Dsi = [Ds[0] * si[0], Ds[1] * si[1]];
        for (let j = 0; j < 12; j++) K[i][j] += w * (Dbi[0] * b.B[0][j] + Dbi[1] * b.B[1][j] + Dbi[2] * b.B[2][j] + Dsi[0] * sh.B[0][j] + Dsi[1] * sh.B[1][j]);
      }
    }
    return K;
  }

  /* maillage biais : lignes ξ = const parallèles aux lignes d'appui (biais interpolé linéairement entre deux lignes),
   * lignes y = const parallèles à l'axe. Renvoie nœuds, éléments, tables de localisation. */
  function maillage(d, G) {
    const L = d.travees, nT = L.length, cg = d.consoles.g, cd = d.consoles.d;
    const xa = [0]; L.forEach((l) => xa.push(xa[xa.length - 1] + l));          // abscisses des appuis sur l'axe
    const cotA = xa.map((_, j) => 1 / Math.tan(((d.biais[j] ?? d.biais[0] ?? 100)) * GR));
    const nPer = Math.max(4, Math.round(d.plaque.nLon || 16)), ns = Math.max(2, Math.round(d.sections || 10));
    const mult = Math.max(1, Math.round(nPer / ns));
    const xi = [], kindX = [];
    const pushSeg = (a, b, n, k) => { for (let i = (xi.length ? 1 : 0); i <= n; i++) { xi.push(a + (b - a) * i / n); kindX.push(k); } };
    if (cg > EPS) pushSeg(-cg, 0, Math.max(1, Math.round(cg / (L[0] / (ns * mult)) )), 'cg');
    for (let t = 0; t < nT; t++) pushSeg(xa[t], xa[t + 1], ns * mult, 't' + t);
    if (cd > EPS) pushSeg(xa[nT], xa[nT] + cd, Math.max(1, Math.round(cd / (L[nT - 1] / (ns * mult)))), 'cd');
    // cotangente du biais le long de l'axe : constante dans les encorbellements, linéaire entre lignes d'appui
    const cotAt = (x) => {
      if (x <= 0) return cotA[0]; if (x >= xa[nT]) return cotA[nT];
      let t = 0; while (t < nT - 1 && x > xa[t + 1]) t++;
      return cotA[t] + (cotA[t + 1] - cotA[t]) * (x - xa[t]) / L[t];
    };
    // ordonnées : bords, encorbellements, chaussée, trottoirs, appareils, puis subdivision
    const ys0 = new Set([0, G.B, G.lcg, G.B - G.lcg, G.chaussee[0], G.chaussee[1]]);
    G.trottoirs.forEach(([a, b]) => { ys0.add(a); ys0.add(b); });
    (d.appareils || []).forEach((f) => f.y.forEach((y) => ys0.add(+y)));
    let ys = [...ys0].filter((y) => y >= -EPS && y <= G.B + EPS).map((y) => +y.toFixed(6)).sort((a, b) => a - b);
    ys = ys.filter((y, i) => !i || y - ys[i - 1] > 1e-4);
    const hmax = G.B / Math.max(4, d.plaque.nLar || 20), yy = [ys[0]];
    for (let i = 1; i < ys.length; i++) { const n = Math.max(1, Math.ceil((ys[i] - ys[i - 1]) / hmax - 1e-9)); for (let k = 1; k <= n; k++) yy.push(ys[i - 1] + (ys[i] - ys[i - 1]) * k / n); }
    const nx = xi.length, ny = yy.length, yc = G.yc;
    const nodes = [];
    for (let i = 0; i < nx; i++) { const c = cotAt(xi[i]); for (let j = 0; j < ny; j++) nodes.push({ x: xi[i] + (yy[j] - yc) * c, y: yy[j], i, j }); }
    const id = (i, j) => i * ny + j;
    const elems = [];
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) {
      const n = [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)];
      elems.push({ n, i, j, yc: (yy[j] + yy[j + 1]) / 2 });
    }
    const iAppui = xa.map((x) => xi.findIndex((v) => Math.abs(v - x) < 1e-7));
    return { xi, yy, nx, ny, nodes, elems, id, xa, cotA, cotAt, iAppui, kindX, mult, ns };
  }

  /* matrices de rigidité : D(y) = {Db 3×3, Ds 2} par élément */
  function rigiditesPlaque(d, G) {
    const E = d.mat.Ecm * 1000, nu = d.plaque.nu ?? 0;
    if (d.type === 'ropen') {
      const R = d.ropen, P = R.P, ea = d.ropen.nCourt;            // n = Ea/Ecm (courte durée) pour la répartition
      const hom = homogene(d, ea);                                 // section homogénéisée béton d'une poutrelle et de sa bande
      const Dx = E * hom.I / R.e, hc = G.h;
      const Dy = E * hc ** 3 / 12, Dt = E * hc ** 3 / 12 * (1 - nu) / 2;
      return (y) => {
        const h = G.ep(y);
        if (y < G.lcg - EPS || y > G.B - G.lcg + EPS) { const D = E * h ** 3 / 12; return { Db: [[D, nu * D, 0], [nu * D, D, 0], [0, 0, D * (1 - nu) / 2]], Ds: [5 / 6 * E / (2 * (1 + nu)) * h, 5 / 6 * E / (2 * (1 + nu)) * h] }; }
        const Dxy = nu * Math.sqrt(Dx * Dy);
        return { Db: [[Dx, Dxy, 0], [Dxy, Dy, 0], [0, 0, Dt]], Ds: [5 / 6 * E / (2 * (1 + nu)) * h, 5 / 6 * E / (2 * (1 + nu)) * h] };
      };
    }
    return (y) => {
      const h = G.ep(y), D = E * h ** 3 / 12, S = 5 / 6 * E / (2 * (1 + nu)) * h;
      return { Db: [[D, nu * D, 0], [nu * D, D, 0], [0, 0, D * (1 - nu) / 2]], Ds: [S, S] };
    };
  }

  /* Cholesky bande en place (A[i*w + k] = K[i][i+k]) */
  function cholBand(A, n, p) {
    const w = p + 1;
    let dmax = 0; for (let i = 0; i < n; i++) dmax = Math.max(dmax, Math.abs(A[i * w]));
    for (let i = 0; i < n; i++) {
      let dd = A[i * w];
      for (let k = Math.max(0, i - p); k < i; k++) { const u = A[k * w + (i - k)]; dd -= u * u; }
      if (!(dd > 1e-12 * dmax)) throw new Error('Plaque instable : vérifier les appareils d’appui (au moins trois appuis non alignés).');
      dd = Math.sqrt(dd); A[i * w] = dd;
      const jm = Math.min(n - 1, i + p);
      for (let j = i + 1; j <= jm; j++) {
        let s = A[i * w + (j - i)];
        for (let k = Math.max(0, j - p); k < i; k++) s -= A[k * w + (i - k)] * A[k * w + (j - k)];
        A[i * w + (j - i)] = s / dd;
      }
    }
  }
  function solveBand(A, n, p, b) {
    const w = p + 1, y = Float64Array.from(b);
    for (let i = 0; i < n; i++) { let s = y[i]; for (let k = Math.max(0, i - p); k < i; k++) s -= A[k * w + (i - k)] * y[k]; y[i] = s / A[i * w]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; const jm = Math.min(n - 1, i + p); for (let j = i + 1; j <= jm; j++) s -= A[i * w + (j - i)] * y[j]; y[i] = s / A[i * w]; }
    return y;
  }

  /* assemblage et factorisation ; appuis = [{n (nœud), k (raideur verticale kN/m, 0 = rigide)}] */
  function plaque(d, G, M) {
    const Dof = rigiditesPlaque(d, G);
    const nn = M.nodes.length, nd = 3 * nn;
    M.elems.forEach((e) => {
      e.X = e.n.map((k) => M.nodes[k].x); e.Y = e.n.map((k) => M.nodes[k].y);
      e.D = Dof(e.yc); e.K = kElem(e.X, e.Y, e.D.Db, e.D.Ds);
      e.dofs = e.n.flatMap((k) => [3 * k, 3 * k + 1, 3 * k + 2]);
      e.area = Math.abs(jac(e.X, e.Y, 0, 0).det) * 4;
    });
    // appareils d'appui → nœuds
    const sup = [];
    (d.appareils || []).forEach((f, j) => {
      const i = M.iAppui[j];
      f.y.forEach((y, k) => {
        let best = 0, bd = Infinity;
        for (let jj = 0; jj < M.ny; jj++) { const dd = Math.abs(M.yy[jj] - y); if (dd < bd) { bd = dd; best = jj; } }
        sup.push({ ligne: j, k, y, node: M.id(i, best), kv: +f.kv || 0 });
      });
    });
    const fixed = new Uint8Array(nd);
    sup.forEach((s) => { if (!(s.kv > 0)) fixed[3 * s.node] = 1; });
    const map = new Int32Array(nd).fill(-1); let nf = 0;
    for (let g = 0; g < nd; g++) if (!fixed[g]) map[g] = nf++;
    let p = 0;
    M.elems.forEach((e) => { const f = e.dofs.map((g) => map[g]).filter((v) => v >= 0); p = Math.max(p, Math.max(...f) - Math.min(...f)); });
    const w = p + 1, A = new Float64Array(nf * w);
    M.elems.forEach((e) => {
      for (let a = 0; a < 12; a++) { const fa = map[e.dofs[a]]; if (fa < 0) continue; for (let b = 0; b < 12; b++) { const fb = map[e.dofs[b]]; if (fb < fa) continue; A[fa * w + (fb - fa)] += e.K[a][b]; } }
    });
    sup.forEach((s) => { if (s.kv > 0) A[map[3 * s.node] * w] += s.kv; });
    cholBand(A, nf, p);
    const solve = (F) => { // F : vecteur global (nd) → U global (nd)
      const b = new Float64Array(nf); for (let g = 0; g < nd; g++) if (map[g] >= 0) b[map[g]] = F[g];
      const x = solveBand(A, nf, p, b), U = new Float64Array(nd);
      for (let g = 0; g < nd; g++) if (map[g] >= 0) U[g] = x[map[g]];
      return U;
    };
    // éléments adjacents à chaque nœud (pour les moments aux nœuds et les réactions)
    const adj = Array.from({ length: nn }, () => []);
    M.elems.forEach((e, ie) => e.n.forEach((k, a) => adj[k].push([ie, a])));
    /* (K·U)_g pour le ddl g = 3·nœud + c */
    const Ku = (U, g) => { let s = 0; const c = g % 3; for (const [ie, a] of adj[(g - c) / 3]) { const e = M.elems[ie], row = e.K[3 * a + c]; for (let b = 0; b < 12; b++) s += row[b] * U[e.dofs[b]]; } return s; };
    /* ligne de K (vecteur global) pour le ddl g : sert aux surfaces d'influence des réactions */
    const Krow = (g) => { const v = new Float64Array(nd), c = g % 3; for (const [ie, a] of adj[(g - c) / 3]) { const e = M.elems[ie], row = e.K[3 * a + c]; for (let b = 0; b < 12; b++) v[e.dofs[b]] += row[b]; } return v; };
    return { nd, nf, p, map, fixed, solve, sup, Ku, Krow, adj };
  }
  /* coordonnées naturelles des coins */
  const CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  /* vecteur g tel que q = g·U : moment au nœud (moyenne des éléments adjacents), comp 0 mx, 1 my, 2 mxy */
  function gMoment(M, S, node, comp) {
    const g = new Float64Array(S.nd), L = S.adj[node];
    for (const [ie, a] of L) {
      const e = M.elems[ie], [r, s] = CORN[a], b = Bbend(e.X, e.Y, r, s), Db = e.D.Db[comp];
      for (let k = 0; k < 12; k++) g[e.dofs[k]] += (Db[0] * b.B[0][k] + Db[1] * b.B[1][k] + Db[2] * b.B[2][k]) / L.length;
    }
    return g;
  }
  /* moments en un nœud pour un champ U (et charges réparties équivalentes sans effet local : éléments finis) */
  function momentsNoeud(M, S, U, node) {
    const out = [0, 0, 0], L = S.adj[node];
    for (const [ie, a] of L) {
      const e = M.elems[ie], [r, s] = CORN[a], b = Bbend(e.X, e.Y, r, s);
      const k = [0, 0, 0]; for (let c = 0; c < 12; c++) { const u = U[e.dofs[c]]; k[0] += b.B[0][c] * u; k[1] += b.B[1][c] * u; k[2] += b.B[2][c] * u; }
      for (let c = 0; c < 3; c++) out[c] += (e.D.Db[c][0] * k[0] + e.D.Db[c][1] * k[1] + e.D.Db[c][2] * k[2]) / L.length;
    }
    return out;
  }
  /* localisation d'un point (x, y) dans le maillage structuré → {e, r, s} ou null */
  function locate(M, x, y) {
    const yy = M.yy; if (y < yy[0] - EPS || y > yy[M.ny - 1] + EPS) return null;
    let lo = 0, hi = M.ny - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (yy[m] <= y) lo = m; else hi = m; }
    const j = Math.min(lo, M.ny - 2), t = clamp((y - yy[j]) / (yy[j + 1] - yy[j]), 0, 1);
    const xL = (i) => { const a = M.nodes[M.id(i, j)].x, b = M.nodes[M.id(i, j + 1)].x; return a + (b - a) * t; };
    if (x < xL(0) - EPS || x > xL(M.nx - 1) + EPS) return null;
    let a = 0, b = M.nx - 1; while (b - a > 1) { const m = (a + b) >> 1; if (xL(m) <= x) a = m; else b = m; }
    const i = Math.min(a, M.nx - 2), x0 = xL(i), x1 = xL(i + 1), s = clamp((x - x0) / (x1 - x0), 0, 1);
    return { e: i * (M.ny - 1) + j, r: 2 * s - 1, s: 2 * t - 1 };
  }

  /* vecteur de charges nodales équivalentes : forces ponctuelles [{x,y,P}], surfaces [{y1,y2,x1?,x2?,q (nombre ou
   * fonction (x,y))}] intégrées par Gauss 3×3 dans chaque élément, lignes [{y, q}] (kN/m le long de l'axe, à l'ordonnée y) */
  const G3 = [[-0.7745966692414834, 5 / 9], [0, 8 / 9], [0.7745966692414834, 5 / 9]];
  function chargePlaque(M, S, ch) {
    const F = new Float64Array(S.nd);
    const addAt = (x, y, P) => { const L = locate(M, x, y); if (!L) return; const e = M.elems[L.e], N = NN(L.r, L.s); for (let k = 0; k < 4; k++) F[3 * e.n[k]] += P * N[k]; };
    for (const p of ch.points || []) addAt(p.x, p.y, p.P);
    const surf = (ch.surf || []).concat((ch.lignes || []).map((l) => ({ y1: l.y - 0.05, y2: l.y + 0.05, q: l.q / 0.1 })));
    if (surf.length) M.elems.forEach((e) => {
      for (const [r, wr] of G3) for (const [s, ws] of G3) {
        const N = NN(r, s); let x = 0, y = 0; for (let k = 0; k < 4; k++) { x += N[k] * e.X[k]; y += N[k] * e.Y[k]; }
        const dA = wr * ws * Math.abs(jac(e.X, e.Y, r, s).det);
        for (const q of surf) {
          if (y < q.y1 - EPS || y > q.y2 + EPS) continue;
          if (q.x1 !== undefined && (x < q.x1 - EPS || x > q.x2 + EPS)) continue;
          const qq = (typeof q.q === 'function' ? q.q(x, y) : q.q) * dA;
          for (let k = 0; k < 4; k++) F[3 * e.n[k]] += qq * N[k];
        }
      }
    });
    return F;
  }
  /* réaction d'un appareil (> 0 vers le haut) pour un champ U et un vecteur de charges F */
  function reaction(S, U, F, s) {
    if (s.kv > 0) return s.kv * U[3 * s.node];
    return F[3 * s.node] - S.Ku(U, 3 * s.node);
  }

/*__SUITE__*/
})(typeof window !== 'undefined' ? window : globalThis);
