/* RODBAN-ROPEN — tabliers de ponts-routes en dalle de béton armé (RODBA) ou à poutrelles enrobées (ROPEN),
 * 1 à 7 travées continues, portées 1 à 35 m (moteur pur, aucun DOM ; node → module.exports, navigateur → window.BA.rodbanRopen).
 *
 * Ce module orchestre les moteurs du socle (BA.poutre, BA.charges, BA.gmslt, BA.sectionBA, BA.inerpe) et ajoute un calcul
 * de plaque. Deux méthodes :
 *
 *  ── « poutre » (biais 70 à 130 gr) : charges du Fascicule 61 titre II — A(l) (art. 4), Bc (art. 5.2), Bt (art. 5.4),
 *     Mc80 / Mc120 (art. 9), trottoirs 1,5 kN/m² (art. 12, charges générales), majoration dynamique δ (art. 5.5) — sur la
 *     poutre continue de largeur totale (BA.poutre : lignes d'influence exactes, enveloppes des convois) ; moments par
 *     mètre à la fibre la plus sollicitée = K·M/Bs, K de Guyon-Massonnet (BA.gmslt, placement Fasc. 61 automatique,
 *     K de la travée calculé à mi-travée) ; flexion transversale à mi-travée par BA.gmslt (μ, série de Fourier).
 *     Combinaisons BAEL 91 / Fasc. 62 titre I sect. I annexe D : ELU 1,35 Gmax + Gmin + 1,6 (A ou B + trottoirs) ou
 *     1,35 Mc ; ELS Gmax + Gmin + 1,2 (A ou B + trottoirs) ou Mc.
 *
 *  ── « plaque » (biais 20 à 180 gr) : éléments finis de plaque de Reissner-Mindlin MITC4 (Bathe & Dvorkin 1985 :
 *     cisaillement transverse interpolé aux points d'attache, sans verrouillage), maillage biais suivant les lignes
 *     d'appui, épaisseur variable des encorbellements, orthotropie pour les poutrelles enrobées (Dx = Ea·I/Bs, I de la
 *     section homogénéisée court terme de BA.inerpe), appareils d'appui ponctuels (rigides ou élastiques).
 *     Surfaces d'influence par la méthode adjointe (réciprocité de Maxwell-Betti) pour mx, my, mxy, qx aux points de
 *     calcul et pour les réactions et rotations d'appareils ; les surfaces sont rééchantillonnées sur une grille de 0,10 m
 *     (tables de sommes cumulées : moyenne d'une surface de roue diffusée en O(1)). Charges EN 1991-2 + AN française :
 *     LM1 (§4.3.2 : TS + UDL, αQ, αq de l'AN, voies conventionnelles placées et numérotées au plus défavorable par
 *     programmation dynamique §4.2.4, TS centré dans sa voie), LM2 (§4.3.3, βQ = αQ1), LM4 (§4.3.5, 5 kN/m²),
 *     trottoirs qfk (§5.3.2.1, gr3 ; valeur de combinaison 3 kN/m² dans gr1a), véhicules spéciaux LM3 de l'annexe A
 *     (tableau A1, lignes d'essieux à 1,50 m, répartis sur 3,00 m (150/200 kN) ou 4,50 m (240 kN), φ = 1,40 − L/500 à
 *     vitesse normale, 1 à vitesse lente) ; diffusion des roues à 45° jusqu'au feuillet moyen (§4.3.6).
 *     Combinaisons EN 1990 annexe A2 + AN : ELU 1,35 Gsup / 1,00 Ginf + 1,35 Q ; ELS caractéristique, fréquente
 *     (ψ1 = 0,75 TS, 0,40 UDL et trottoirs, 0,75 LM2) et quasi permanente.
 *     Ferraillage orthogonal (axe de l'ouvrage, perpendiculaire) : moments de Wood-Armer m ± |mxy| (enveloppes non
 *     concomitantes : majorant).
 *
 * Sections (RODBA) : BA.sectionBA par mètre de largeur (EN 1992-1-1/-2 + AN ou BAEL 91 mod. 99), effort tranchant
 * EN 1992-1-1 §6.2 (dalle) ou BAEL A.5.1. Poutrelles enrobées (ROPEN), par poutrelle : moment résistant plastique
 * (BA.inerpe, EN 1994-2 §6.3), contraintes ELS par phases (poutrelles seules sous le poids propre, section homogénéisée
 * n = 18 longue durée, n = 6 courte durée, béton tendu négligé), Vpl,Rd = Av·fy/(√3·γM0) (EN 1993-1-1 §6.2.6),
 * déversement pendant le bétonnage (Fascicule 61 titre V art. 19, méthode simplifiée), dallettes de coffrage,
 * contre-flèches, plan de perçage.
 * Convois exceptionnels C, D, E de l'instruction du 20/07/1983 : NON TRAITÉS (définitions non retrouvées avec certitude).
 *
 * Conventions : x le long de l'axe depuis l'axe de l'appui C0 (consoles en x < 0 et x > ΣL), y transversal depuis le
 * bord gauche du tablier (0 … B), z vers le bas ; m > 0 tend la fibre inférieure ; réactions > 0 vers le haut.
 * Unités : kN, m, kPa ; MPa pour les matériaux ; sections d'acier en cm².
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  const req = (p, k) => (isNode ? require(p) : root.BA && root.BA[k]);
  const CH = req('./charges.js', 'charges'), PT = req('./poutre.js', 'poutre'), GM = req('./gmslt.js', 'gmslt');
  const SB = req('./bael-ec2.js', 'sectionBA'), IN = req('./inerpe.js', 'inerpe');
  const GR = Math.PI / 200;
  const EPS = 1e-9;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const maxA = (a) => a.reduce((m, v) => (v > m ? v : m), -Infinity), minA = (a) => a.reduce((m, v) => (v < m ? v : m), Infinity);

  /* ══════════════════ 1. Jeux de données par défaut ══════════════════ */
  /* d'après les exemples d'origine « Rodban_Plaque_EC » et « Ropen_Plaque_EC » : 3 travées 11,27 + 15,06 + 11,27 m,
   * biais 80 gr, tablier de 9,06 m (rives 0,53 + trottoirs 1,00 + chaussée 6,00), dalle de 7,06 m en sous-face,
   * encorbellements de 1,00 m (0,25 m en rive, 0,573 m à l'encastrement), pont-route de 2e classe. */
  const EQUIP = (beton) => [
    { nom: 'Garde-corps', type: 'lin', q: 0.65, y: 0.33, sym: true, kmax: 1.05, kmin: 0.95 },
    { nom: 'Longrine de garde-corps', type: 'lin', q: 4.48, y: 0.36, sym: true, kmax: 1.05, kmin: 0.95 },
    { nom: 'Remplissage de trottoir', type: 'lin', q: 4.0425, y: 1.025, sym: true, kmax: 1.05, kmin: 0.95 },
    { nom: 'Bordure de trottoir', type: 'lin', q: 0.56, y: 1.47, sym: true, kmax: 1.05, kmin: 0.95 },
    { nom: 'Revêtement de chaussée (0,06 m × 22 kN/m³)', type: 'surf', q: 1.32, y1: 1.53, y2: 7.53, kmax: 1.4, kmin: 0.8 },
    { nom: 'Étanchéité (0,03 m × 22 kN/m³)', type: 'surf', q: 0.66, y1: 0.53, y2: 8.53, kmax: 1.2, kmin: 0.8 },
  ].map((e) => Object.assign(e, beton ? {} : {}));
  const DEF_RODBA = {
    type: 'rodba', projet: 'Pont-route en dalle BA — 3 travées biaises', methode: 'plaque', regl: 'ec',
    travees: [11.27, 15.06, 11.27], cg: 0.45, cd: 0.45, biais: 80, biaisApp: null,
    trans: { dG: 0.53, tG: 1.0, lc: 6.0, tD: 1.0, dD: 0.53, Bs: 7.06, h: 0.6, hr: 0.25, hcr: 0.5727 },
    gb: 25, equip: EQUIP(true), den: 0,
    classe: 2, charges: { LM1: true, LM2: true, LM4: false, qfk: 5, LM3: '', vitLM3: 'lente', AL: true, Bc: true, Bt: true, Mc80: false, Mc120: true, qtr: 1.5 },
    appareils: { yC: [1.38, 3.48, 5.58, 7.68], yP: [1.38, 3.58, 5.48, 7.68], kv: 0 },
    mat: { fck: 32, fe: 500, fissuration: 1, dSup: 0.07, dInf: 0.07, phi: 2 },
    plaque: { nLon: 30, nLar: 24, nu: 0 }, sections: 10,
  };
  const DEF_ROPEN = {
    type: 'ropen', projet: 'Pont-route à poutrelles enrobées — 3 travées biaises', methode: 'plaque', regl: 'ec',
    travees: [11.27, 15.06, 11.27], cg: 0.45, cd: 0.45, biais: 80, biaisApp: null,
    trans: { dG: 0.53, tG: 1.0, lc: 6.0, tD: 1.0, dD: 0.53, Bs: 7.06, h: 0.61465, hr: 0.25, hcr: 0.5727 },
    gb: 25, equip: EQUIP(false), den: 0,
    classe: 2, charges: { LM1: true, LM2: true, LM4: false, qfk: 5, LM3: '', vitLM3: 'lente', AL: true, Bc: true, Bt: true, Mc80: false, Mc120: true, qtr: 1.5 },
    appareils: { yC: null, yP: null, kv: 0 },
    mat: { fck: 32, fe: 500, fissuration: 1, dSup: 0.07, dInf: 0.07, phi: 2 },
    ropen: { profil: 'HEM 450', n: 10, nuance: 'S355', fy: 345, ecof: 0.02, AsChap: 94.26, AsMinM: 0, dAs: 0.07, nCourt: 6, nLong: 18, gammaA: 1.0, debLat: 0.10, seuilChap: 0.10,
      percage: { espEnt: 4.85, rangEnt: 0.2, dTrouEnt: 0.03, zEnt: 0.09, espFer: 0.3, dTrouFer: 0.04, zFer: 0.05, aboutFer: 0.1 } },
    plaque: { nLon: 30, nLar: 24, nu: 0 }, sections: 10,
  };

  /* ══════════════════ 2. Géométrie transversale, charges permanentes ══════════════════ */
  /* d.trans = {dG, tG, lc, tD, dD : largeurs de gauche à droite (rive, trottoir, chaussée, trottoir, rive),
   *            Bs (largeur de la sous-face), h (épaisseur de la dalle), hr (épaisseur de rive), hcr (épaisseur des
   *            encorbellements à l'encastrement)} ; y depuis le bord gauche, axe du tablier en B/2. */
  function geoTrans(d) {
    const t = d.trans, B = t.dG + t.tG + t.lc + t.tD + t.dD;
    const Bs = Math.min(B, t.Bs > 0 ? t.Bs : B), lcg = (B - Bs) / 2;
    const h = t.h, hr = t.hr > 0 ? Math.min(t.hr, h) : h, hcr = t.hcr > 0 ? Math.min(t.hcr, h) : h;
    const ep = (y) => { // épaisseur structurelle à l'ordonnée y (encorbellements linéaires de hr au bord à hcr à l'encastrement)
      if (y < lcg - EPS) return hr + (hcr - hr) * clamp(y / Math.max(lcg, EPS), 0, 1);
      if (y > B - lcg + EPS) return hr + (hcr - hr) * clamp((B - y) / Math.max(lcg, EPS), 0, 1);
      return h;
    };
    const A = Bs * h + 2 * lcg * (hcr + hr) / 2;
    // inertie de flexion longitudinale de la section brute (extrados commun, intrados des encorbellements relevé)
    const parts = [[Bs, h]].concat(lcg > 0 ? [[2 * lcg, (hcr + hr) / 2]] : []);
    const yg = sum(parts.map(([b, e]) => b * e * e / 2)) / sum(parts.map(([b, e]) => b * e));
    const I = sum(parts.map(([b, e]) => b * e ** 3 / 12 + b * e * (e / 2 - yg) ** 2));
    const chaussee = [t.dG + t.tG, t.dG + t.tG + t.lc];
    const trottoirs = [];
    if (t.tG > 0) trottoirs.push([t.dG, t.dG + t.tG]);
    if (t.tD > 0) trottoirs.push([B - t.dD - t.tD, B - t.dD]);
    return { B, Bs, lcg, h, hr, hcr, ep, A, I, vSup: yg, chaussee, trottoirs, yc: B / 2, lch: t.lc };
  }
  /* catégories de charges permanentes : poids propre (surfacique γb·e(y), phase 1) puis équipements :
   * {nom, type:'lin' (kN/m à l'ordonnée y, « sym » = des deux côtés) | 'surf' (kN/m² entre y1 et y2), q, kmax, kmin} */
  function permanentes(d, G, R) {
    const cats = [], gb = +d.gb || 25;
    if (d.type === 'ropen') {
      // béton : section pleine moins l'acier des poutrelles et le vide sous les dallettes (hauteur de l'aile inférieure)
      const P = R.prof, N = d.ropen.n, Ap = P.A / 1e4, tf = P.tf / 1e3, b = P.b / 1e3;
      const vide = G.Bs * tf - N * b * tf;
      const qb = gb * (G.A - N * Ap - vide), qp = N * Ap * 77;
      cats.push({ nom: 'Poids propre du béton', type: 'pp', qlin: qb, kmax: 1, kmin: 1, phase: 1, fy: (y) => (y < G.lcg || y > G.B - G.lcg ? gb * G.ep(y) : (qb - gb * 2 * G.lcg * (G.hr + G.hcr) / 2) / G.Bs) });
      cats.push({ nom: 'Poutrelles', type: 'pp', qlin: qp, kmax: 1, kmin: 1, phase: 1, fy: (y) => (y < G.lcg || y > G.B - G.lcg ? 0 : qp / G.Bs) });
    } else cats.push({ nom: 'Poids propre', type: 'pp', qlin: gb * G.A, kmax: 1, kmin: 1, phase: 1, fy: (y) => gb * G.ep(y) });
    for (const e of d.equip || []) {
      const q = +e.q; if (!(Math.abs(q) > 0)) continue;
      const kmax = +e.kmax || 1, kmin = +e.kmin || 1;
      if (e.type === 'surf') { const y1 = Math.max(0, +e.y1), y2 = Math.min(G.B, +e.y2); if (y2 > y1) cats.push({ nom: e.nom, type: 'surf', q, y1, y2, kmax, kmin, qlin: q * (y2 - y1), phase: 2 }); }
      else { const ys = e.sym ? [+e.y, G.B - +e.y] : [+e.y]; cats.push({ nom: e.nom, type: 'lin', q, ys, kmax, kmin, qlin: q * ys.length, phase: 2 }); }
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
    const L = d.travees, nT = L.length, cg = d.cg, cd = d.cd;
    const xa = [0]; L.forEach((l) => xa.push(xa[xa.length - 1] + l));          // abscisses des appuis sur l'axe
    const cotA = xa.map((_, j) => 1 / Math.tan(d._biais[j] * GR));
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
    (d._app || []).forEach((f) => f.y.forEach((y) => ys0.add(+y)));
    (d._yExtra || []).forEach((y) => ys0.add(+y));
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


  /* rigidités de plaque par élément (ordonnée y du centre) : RODBA isotrope e(y) ; ROPEN orthotrope dans la largeur Bs
   * (Dx = EIx/Bs, EIx de la section homogénéisée court terme ; Dy, Dxy du béton d'épaisseur h), encorbellements isotropes */
  function rigiditesPlaque(d, G, EIx) {
    const E = d._Ecm * 1000, nu = d.plaque.nu ?? 0;
    const iso = (h) => { const D = E * h ** 3 / 12, S = 5 / 6 * E / (2 * (1 + nu)) * h; return { Db: [[D, nu * D, 0], [nu * D, D, 0], [0, 0, D * (1 - nu) / 2]], Ds: [S, S] }; };
    if (d.type === 'ropen' && EIx > 0) {
      const Dx = EIx / G.Bs, Dy = E * G.h ** 3 / 12, Dt = Dy * (1 - nu) / 2, Dxy = nu * Math.sqrt(Dx * Dy), S = 5 / 6 * E / (2 * (1 + nu)) * G.h;
      const ortho = { Db: [[Dx, Dxy, 0], [Dxy, Dy, 0], [0, 0, Dt]], Ds: [S, S] };
      return (y) => (y < G.lcg - EPS || y > G.B - G.lcg + EPS ? iso(G.ep(y)) : ortho);
    }
    return (y) => iso(G.ep(y));
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
  /* résolution simultanée de m seconds membres (B : tableau de Float64Array) — une seule lecture du facteur par passe */
  function solveBandMulti(A, n, p, Bs) {
    const m = Bs.length;
    if (m !== 4) return Bs.map((b) => solveBand(A, n, p, b));
    const w = p + 1, y0 = Float64Array.from(Bs[0]), y1 = Float64Array.from(Bs[1]), y2 = Float64Array.from(Bs[2]), y3 = Float64Array.from(Bs[3]);
    // descente Uᵀ y = b, par colonnes (lecture contiguë des lignes de U), quatre seconds membres à la fois
    for (let k = 0; k < n; k++) {
      const dk = A[k * w], jm = Math.min(n - 1, k + p), wk = k * w - k;
      const a0 = (y0[k] /= dk), a1 = (y1[k] /= dk), a2 = (y2[k] /= dk), a3 = (y3[k] /= dk);
      for (let j = k + 1; j <= jm; j++) { const a = A[wk + j]; y0[j] -= a * a0; y1[j] -= a * a1; y2[j] -= a * a2; y3[j] -= a * a3; }
    }
    for (let i = n - 1; i >= 0; i--) {
      const jm = Math.min(n - 1, i + p), wi = i * w - i;
      let s0 = y0[i], s1 = y1[i], s2 = y2[i], s3 = y3[i];
      for (let j = i + 1; j <= jm; j++) { const a = A[wi + j]; s0 -= a * y0[j]; s1 -= a * y1[j]; s2 -= a * y2[j]; s3 -= a * y3[j]; }
      const di = A[i * w]; y0[i] = s0 / di; y1[i] = s1 / di; y2[i] = s2 / di; y3[i] = s3 / di;
    }
    return [y0, y1, y2, y3];
  }
  function solveBand(A, n, p, b) {
    const w = p + 1, y = Float64Array.from(b);
    for (let i = 0; i < n; i++) { let s = y[i]; for (let k = Math.max(0, i - p); k < i; k++) s -= A[k * w + (i - k)] * y[k]; y[i] = s / A[i * w]; }
    for (let i = n - 1; i >= 0; i--) { let s = y[i]; const jm = Math.min(n - 1, i + p); for (let j = i + 1; j <= jm; j++) s -= A[i * w + (j - i)] * y[j]; y[i] = s / A[i * w]; }
    return y;
  }

  /* assemblage et factorisation ; appuis = [{n (nœud), k (raideur verticale kN/m, 0 = rigide)}] */
  function plaque(d, G, M) {
    const Dof = rigiditesPlaque(d, G, d._EIx);
    const nn = M.nodes.length, nd = 3 * nn;
    M.elems.forEach((e) => {
      e.X = e.n.map((k) => M.nodes[k].x); e.Y = e.n.map((k) => M.nodes[k].y);
      e.D = Dof(e.yc); e.K = kElem(e.X, e.Y, e.D.Db, e.D.Ds);
      e.dofs = e.n.flatMap((k) => [3 * k, 3 * k + 1, 3 * k + 2]);
      e.area = Math.abs(jac(e.X, e.Y, 0, 0).det) * 4;
    });
    // appareils d'appui → nœuds
    const sup = [];
    (d._app || []).forEach((f, j) => {
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
    const solveN = (Fs) => {
      const Bs = Fs.map((F) => { const b = new Float64Array(nf); for (let g = 0; g < nd; g++) if (map[g] >= 0) b[map[g]] = F[g]; return b; });
      return solveBandMulti(A, nf, p, Bs).map((x) => { const U = new Float64Array(nd); for (let g = 0; g < nd; g++) if (map[g] >= 0) U[g] = x[map[g]]; return U; });
    };
    // éléments adjacents à chaque nœud (pour les moments aux nœuds et les réactions)
    const adj = Array.from({ length: nn }, () => []);
    M.elems.forEach((e, ie) => e.n.forEach((k, a) => adj[k].push([ie, a])));
    /* (K·U)_g pour le ddl g = 3·nœud + c */
    const Ku = (U, g) => { let s = 0; const c = g % 3; for (const [ie, a] of adj[(g - c) / 3]) { const e = M.elems[ie], row = e.K[3 * a + c]; for (let b = 0; b < 12; b++) s += row[b] * U[e.dofs[b]]; } return s; };
    /* ligne de K (vecteur global) pour le ddl g : sert aux surfaces d'influence des réactions */
    const Krow = (g) => { const v = new Float64Array(nd), c = g % 3; for (const [ie, a] of adj[(g - c) / 3]) { const e = M.elems[ie], row = e.K[3 * a + c]; for (let b = 0; b < 12; b++) v[e.dofs[b]] += row[b]; } return v; };
    return { nd, nf, p, map, fixed, solve, solveN, sup, Ku, Krow, adj };
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


  /* effort tranchant qx au nœud (moyenne des éléments adjacents, déformations de cisaillement MITC4 aux coins) : g·U */
  /* effort tranchant qx (kN/m) : au nœud (moyenne des éléments adjacents, déformations de cisaillement MITC4 aux coins) ;
   * avec « cote » ('g' | 'd') : au centre des éléments situés de ce côté de la ligne de nœuds, soit à une demi-maille de la
   * ligne d'appui (≈ d, EN 1992-1-1 §6.2.1 (8)) : la valeur au droit d'un appui ponctuel est singulière. */
  function gShear(M, S, node, cote) {
    const g = new Float64Array(S.nd), L = S.adj[node].filter(([, a]) => !cote || (cote === 'g' ? a === 1 || a === 2 : a === 0 || a === 3));
    for (const [ie, a] of L) {
      const e = M.elems[ie], [r, s] = cote ? [0, 0] : CORN[a], b = Bshear(e.X, e.Y, r, s);
      for (let k = 0; k < 12; k++) g[e.dofs[k]] += e.D.Ds[0] * b.B[0][k] / L.length;
    }
    return g;
  }
  const dot = (g, U) => { let s = 0; for (let k = 0; k < g.length; k++) if (g[k]) s += g[k] * U[k]; return s; };

  /* ══════════════════ 4. Grille de chargement (surfaces d'influence rééchantillonnées) ══════════════════
   * Cellules de dy × dx (0,10 m) ; ligne c à l'ordonnée yc = (c + ½)·dy ; colonnes à x = x0 + (k + ½)·dx.
   * Une surface d'influence (valeurs nodales de la flèche adjointe) est interpolée linéairement le long des lignes de
   * nœuds i (biaises) et des lignes y = cte ; hors du tablier, valeur nulle. */
  function grille(M, G, pas = 0.1, pasX = 0.2) {
    const dy = G.B / Math.max(1, Math.round(G.B / pas)), nC = Math.round(G.B / dy);
    let x0 = Infinity, x1 = -Infinity; for (const n of M.nodes) { if (n.x < x0) x0 = n.x; if (n.x > x1) x1 = n.x; }
    const dx = pasX, nX = Math.ceil((x1 - x0) / dx);
    const jj = new Int32Array(nC), tj = new Float64Array(nC), idx = new Int32Array(nC * nX).fill(-1), wt = new Float64Array(nC * nX);
    for (let c = 0; c < nC; c++) {
      const y = (c + 0.5) * dy; let j = 0; while (j < M.ny - 2 && M.yy[j + 1] < y) j++;
      jj[c] = j; tj[c] = clamp((y - M.yy[j]) / (M.yy[j + 1] - M.yy[j]), 0, 1);
      const xr = M.xi.map((xi) => xi + (y - G.yc) * M.cotAt(xi));
      let i = 0;
      for (let k = 0; k < nX; k++) {
        const x = x0 + (k + 0.5) * dx; if (x < xr[0] || x > xr[M.nx - 1]) continue;
        while (i < M.nx - 2 && xr[i + 1] < x) i++;
        idx[c * nX + k] = i; wt[c * nX + k] = (x - xr[i]) / (xr[i + 1] - xr[i]);
      }
    }
    const cell = (y) => clamp(Math.floor(y / dy + 1e-9), 0, nC), col = (x) => Math.floor((x - x0) / dx);
    return { dy, dx, nC, nX, x0, jj, tj, idx, wt, cell, col };
  }
  /* surface d'influence η (valeurs nodales) → grille, table de sommes cumulées, intégrales positives/négatives par ligne */
  function surface(M, Gr, eta) {
    const { nC, nX, jj, tj, idx, wt, dx, dy } = Gr, v = new Float64Array(nC * nX), rv = new Float64Array(M.nx);
    const pos = new Float64Array(nC), neg = new Float64Array(nC);
    for (let c = 0; c < nC; c++) {
      const j = jj[c], t = tj[c];
      for (let i = 0; i < M.nx; i++) rv[i] = eta[M.id(i, j)] * (1 - t) + eta[M.id(i, j + 1)] * t;
      let p = 0, n = 0;
      for (let k = 0; k < nX; k++) { const q = c * nX + k, i = idx[q]; if (i < 0) continue; const val = rv[i] + (rv[i + 1] - rv[i]) * wt[q]; v[q] = val; if (val > 0) p += val; else n += val; }
      pos[c] = p * dx * dy; neg[c] = n * dx * dy;
    }
    const W = nX + 1, sat = new Float64Array((nC + 1) * W);
    for (let c = 0; c < nC; c++) { let r = 0; for (let k = 0; k < nX; k++) { r += v[c * nX + k]; sat[(c + 1) * W + k + 1] = sat[c * W + k + 1] + r; } }
    /* moyenne de la surface sur le rectangle [x1, x2] × [y1, y2] (cellules entières) */
    const box = (x1, x2, y1, y2) => {
      const k1 = clamp(Math.round((x1 - Gr.x0) / dx), 0, nX), k2 = clamp(Math.round((x2 - Gr.x0) / dx), 0, nX);
      const c1 = clamp(Math.round(y1 / dy), 0, nC), c2 = clamp(Math.round(y2 / dy), 0, nC);
      const kk2 = Math.max(k2, k1 + 1), cc2 = Math.max(c2, c1 + 1);
      if (k1 >= nX || c1 >= nC) return 0;
      const a = Math.min(kk2, nX), b = Math.min(cc2, nC);
      return (sat[b * W + a] - sat[c1 * W + a] - sat[b * W + k1] + sat[c1 * W + k1]) / ((a - k1) * (b - c1));
    };
    /* grille lissée : moyenne sur un rectangle de demi-côtés (hx, hy) centré sur chaque cellule (mise en cache) */
    const cache = {};
    const lisse = (hx, hy) => {
      const key = hx + '|' + hy; if (cache[key]) return cache[key];
      const kx = Math.max(0, Math.round(hx / dx - 0.5)), ky = Math.max(0, Math.round(hy / dy - 0.5)), o = new Float64Array(nC * nX);
      for (let c = 0; c < nC; c++) {
        const c1 = Math.max(0, c - ky), c2 = Math.min(nC, c + ky + 1);
        for (let k = 0; k < nX; k++) {
          const k1 = Math.max(0, k - kx), k2 = Math.min(nX, k + kx + 1);
          o[c * nX + k] = (sat[c2 * W + k2] - sat[c1 * W + k2] - sat[c2 * W + k1] + sat[c1 * W + k1]) / ((2 * kx + 1) * (2 * ky + 1));
        }
      }
      return (cache[key] = o);
    };
    const at = (g, c, k) => (c < 0 || c >= nC || k < 0 || k >= nX ? 0 : g[c * nX + k]);
    return { v, pos, neg, box, lisse, at, nC, nX, cache: {} };
  }

  /* ══════════════════ 5. Placement des charges EN 1991-2 sur une surface d'influence ══════════════════ */
  const ALPHA = (cl) => (cl === 2 ? { Q: [0.9, 0.8, 0.8], q1: 0.7, qi: 1.0, qr: 1.0 } : { Q: [1, 1, 1], q1: 1, qi: 1.2, qr: 1.2 }); // AN française tab. 4.2
  /* LM1 (+ trottoirs) : o = {sg, fTS, fUDL, qtr, classe, ch:[c0,c1] (cellules de chaussée), tr:[[c0,c1]…], a (côté de
   * l'impact diffusé d'une roue de TS)} → {v, cfg} ; voies de 3 m, numérotation libre, TS centré dans sa voie */
  function placeLM1(Gr, Su, o) {
    const al = ALPHA(o.classe), sg = o.sg, [c0, c1] = o.ch, nc = c1 - c0, lc = Math.round(3 / Gr.dy);
    const nl = Math.max(0, Math.min(6, Math.floor(nc / lc + 1e-9))), NM = 1 << nl;
    const qr = [al.q1 * 9].concat(Array(5).fill(al.qi * 2.5)).map((q) => q * o.fUDL), Qr = [300, 200, 100].map((q, k) => al.Q[k] * q * o.fTS).concat([0, 0, 0]);
    const qres = 2.5 * al.qr * o.fUDL;
    const I = (c) => Math.max(0, sg > 0 ? Su.pos[c] : -Su.neg[c]);
    let tr = 0; for (const [a, b] of o.tr || []) for (let c = a; c < b; c++) tr += o.qtr * I(c);
    if (!nl) { let v = 0; for (let c = c0; c < c1; c++) v += qres * I(c); return { v: sg * (v + tr), cfg: { lanes: [] } }; }
    // TS unitaire (1 kN par essieu, 2 roues) au mieux longitudinalement pour une voie débutant à la cellule s (mis en cache par signe)
    const nS = nc - lc + 1, key = 'ts' + sg;
    if (!Su.cache[key]) {
      const Wg = Su.lisse(o.a / 2, o.a / 2), ts = new Float64Array(nS), tsk = new Int32Array(nS);
      const dkx = Math.round(0.6 / Gr.dx), dcy = Math.round(1.0 / Gr.dy);
      for (let s = 0; s < nS; s++) {
        const cv = c0 + s + Math.round(lc / 2); let best = 0, bk = -1;
        for (let k = 0; k < Gr.nX; k++) {
          const e = sg * 0.5 * (Su.at(Wg, cv - dcy, k - dkx) + Su.at(Wg, cv - dcy, k + dkx) + Su.at(Wg, cv + dcy, k - dkx) + Su.at(Wg, cv + dcy, k + dkx));
          if (e > best) { best = e; bk = k; }
        }
        ts[s] = best; tsk[s] = bk;
      }
      Su.cache[key] = { ts, tsk };
    }
    const { ts, tsk } = Su.cache[key];
    const Ilane = new Float64Array(nc + 1); for (let c = 0; c < nc; c++) Ilane[c + 1] = Ilane[c] + I(c0 + c);
    const lane = (r, s) => qr[r] * (Ilane[s + lc] - Ilane[s]) + Qr[r] * ts[s];
    const F = Array.from({ length: nc + 1 }, () => new Float64Array(NM)), A = Array.from({ length: nc + 1 }, () => new Int8Array(NM).fill(-1));
    for (let c = nc - 1; c >= 0; c--) for (let m = 0; m < NM; m++) {
      let best = qres * I(c0 + c) + F[c + 1][m], arg = -1;
      if (c + lc <= nc) for (let r = 0; r < nl; r++) if (!(m & (1 << r))) { const v = lane(r, c) + F[c + lc][m | (1 << r)]; if (v > best) { best = v; arg = r; } }
      F[c][m] = best; A[c][m] = arg;
    }
    const lanes = []; let c = 0, m = 0;
    while (c < nc) { const r = A[c][m]; if (r >= 0) { lanes.push({ r, s: c, k: tsk[c], Q: Qr[r], q: qr[r], y: (c0 + c) * Gr.dy + 1.5 }); m |= 1 << r; c += lc; } else c++; }
    return { v: sg * (F[0][0] + tr), cfg: { lanes, sg, qres, qtr: o.qtr, ch: o.ch, tr: o.tr || [], a: o.a } };
  }
  /* effet sur une autre surface Sb de la configuration LM1 trouvée sur Sa (charges réparties sur les parties de Sa de signe
   * favorable, TS à la position retenue) : valeur concomitante */
  function evalLM1(Gr, Sa, Sb, cfg) {
    const { nX, dx, dy } = Gr, sg = cfg.sg, q = new Float64Array(Gr.nC);
    for (let c = cfg.ch[0]; c < cfg.ch[1]; c++) q[c] = cfg.qres;
    const lc = Math.round(3 / dy);
    for (const l of cfg.lanes) for (let c = cfg.ch[0] + l.s; c < cfg.ch[0] + l.s + lc; c++) q[c] = l.q;
    for (const [a, b] of cfg.tr) for (let c = a; c < b; c++) q[c] = cfg.qtr;
    let v = 0;
    for (let c = 0; c < Gr.nC; c++) { if (!q[c]) continue; for (let k = 0; k < nX; k++) { const p = c * nX + k; if (sg * Sa.v[p] > 0) v += q[c] * Sb.v[p]; } }
    v *= dx * dy;
    const h = cfg.a / 2;
    for (const l of cfg.lanes) {
      if (l.k < 0) continue; const xt = Gr.x0 + (l.k + 0.5) * dx;
      for (const ex of [-0.6, 0.6]) for (const ey of [-1, 1]) v += l.Q * 0.5 * Sb.box(xt + ex - h, xt + ex + h, l.y + ey - h, l.y + ey + h);
    }
    return v;
  }
  /* LM2 : essieu de 400·βQ kN, deux roues de 0,35 × 0,60 m (diffusées) à 2,00 m, placé n'importe où sur la chaussée */
  function placeLM2(Gr, Su, o) {
    const P = 400 * o.beta * o.f / 2, sg = o.sg, Wg = Su.lisse((0.35 + o.e2) / 2, (0.60 + o.e2) / 2);
    const dcy = Math.round(1.0 / Gr.dy), cA = o.ch[0] + Math.round(1.3 / Gr.dy), cB = o.ch[1] - Math.round(1.3 / Gr.dy);
    let best = 0; const nX = Gr.nX;
    for (let c = Math.max(cA, dcy); c <= Math.min(cB, Gr.nC - 1 - dcy); c++) {
      const o1 = (c - dcy) * nX, o2 = (c + dcy) * nX;
      for (let k = 0; k < nX; k++) { const e = sg * (Wg[o1 + k] + Wg[o2 + k]); if (e > best) best = e; }
    }
    return sg * P * best;
  }
  /* charge répartie q sur les cellules [c0, c1) : parties de signe favorable seulement (LM4, qfk) */
  function placeRep(Gr, Su, cells, q, sg) { let v = 0; for (const [a, b] of cells) for (let c = a; c < b; c++) v += Math.max(0, sg > 0 ? Su.pos[c] : -Su.neg[c]); return sg * q * v; }
  /* véhicules spéciaux LM3 (EN 1991-2 annexe A, tableau A1) : lignes d'essieux à 1,50 m */
  const LM3 = {
    '600/150': [[4, 150]], '900/150': [[6, 150]], '1200/150': [[8, 150]], '1200/200': [[6, 200]], '1500/150': [[10, 150]],
    '1500/200': [[7, 200], [1, 100]], '1800/150': [[12, 150]], '1800/200': [[9, 200]], '2400/200': [[12, 200]], '2400/240': [[10, 240]],
    '3000/200': [[15, 200]], '3000/240': [[12, 240], [1, 120]], '3600/200': [[18, 200]], '3600/240': [[15, 240]],
  };
  function vehLM3(nom) {
    const c = LM3[nom]; if (!c) return null;
    const lines = []; let k = 0; for (const [n, P] of c) for (let i = 0; i < n; i++) lines.push({ d: 1.5 * k++, P });
    const w = c[0][1] === 240 ? 4.5 : 3.0;
    return { nom, lines, w, len: 1.5 * (k - 1), P: sum(lines.map((l) => l.P)) };
  }
  function placeLM3(Gr, Su, o) {
    const v = o.veh, sg = o.sg, nd = v.lines.map((l) => Math.round(l.d / Gr.dx)), ncw = Math.round(v.w / Gr.dy);
    let best = 0;
    for (let c = o.ch[0]; c + ncw <= o.ch[1]; c += 2) {
      const ya = c * Gr.dy, yb = ya + v.w, col = new Float64Array(Gr.nX);
      for (let k = 0; k < Gr.nX; k++) { const x = Gr.x0 + (k + 0.5) * Gr.dx; col[k] = Su.box(x - Gr.dx / 2, x + Gr.dx / 2, ya, yb) * v.w; }
      for (const dir of [1, -1]) for (let k = -nd[nd.length - 1]; k < Gr.nX + nd[nd.length - 1]; k++) {
        let e = 0; for (let i = 0; i < nd.length; i++) { const kk = k + dir * nd[i]; if (kk >= 0 && kk < Gr.nX) e += v.lines[i].P / v.w * col[kk]; }
        e *= sg * o.phi; if (e > best) best = e;
      }
    }
    return sg * best;
  }

  /* ══════════════════ 6. Combinaisons ══════════════════
   * rec = {g:[effet de chaque catégorie permanente (valeur nominale)], den:{max,min}, q:{cas:{max,min}}}
   * EC (EN 1990 A2 + AN) : ELU Σ(1,35·kmax | 1,00·kmin)·G + 1,20 Δ + 1,35 Q ; ELS car. Gk + Δ + Q ; fréq. Gk + Δ + Qfréq ;
   * QP Gk + Δ. Fasc. 61/BAEL : ELU 1,35 Gmax + Gmin + 1,6 (A|B + trottoirs) | 1,35 Mc ; ELS G + 1,2 (A|B) + trottoirs | Mc. */
  function combiner(rec, cats, regime) {
    const G = (kU, kF, sg) => sum(rec.g.map((e, c) => { const unf = sg > 0 ? e > 0 : e < 0; return e * (unf ? kU * cats[c].kmax : kF * cats[c].kmin); }));
    const q = rec.q, z = { max: 0, min: 0 }, den = rec.den || z;
    const pick = (keys, f = 1) => { let mx = 0, mn = 0; for (const k of keys) { const v = q[k]; if (!v) continue; mx = Math.max(mx, f * v.max); mn = Math.min(mn, f * v.min); } return { max: mx, min: mn }; };
    let Qc, Qf, QU;
    if (regime === 'ec') {
      // gr1a = LM1 + trottoirs 3 kN/m² ; gr1b = LM2 ; gr3 = qfk ; gr4 = LM4 ; gr5 = LM3 (EN 1991-2 tableau 4.4a)
      const t3 = q.tr3 || z, g1 = q.LM1 ? { max: q.LM1.max + t3.max, min: q.LM1.min + t3.min } : null, g1f = q.LM1f ? { max: q.LM1f.max + 0.4 * t3.max, min: q.LM1f.min + 0.4 * t3.min } : null;
      const qq = Object.assign({}, q, { gr1a: g1, gr1af: g1f });
      const pk = (keys) => { let mx = 0, mn = 0; for (const k of keys) { const v = qq[k]; if (!v) continue; mx = Math.max(mx, v.max); mn = Math.min(mn, v.min); } return { max: mx, min: mn }; };
      Qc = pk(['gr1a', 'LM2', 'qfk', 'LM4', 'LM3']); Qf = pk(['gr1af', 'LM2f']); QU = { max: 1.35 * Qc.max, min: 1.35 * Qc.min };
    } else {
      const AB = pick(['AL', 'Bc', 'Bt']), tr = q.trott || z, Mc = pick(['Mc80', 'Mc120']);
      Qc = { max: Math.max(1.2 * AB.max + tr.max, Mc.max), min: Math.min(1.2 * AB.min + tr.min, Mc.min) };
      QU = { max: Math.max(1.6 * (AB.max + tr.max), 1.35 * Mc.max), min: Math.min(1.6 * (AB.min + tr.min), 1.35 * Mc.min) };
      Qf = { max: 0, min: 0 };
    }
    const gU = regime === 'ec' ? 1.35 : 1.35, dU = regime === 'ec' ? 1.2 : 1.0;
    const Gk = { max: G(1, 1, 1), min: G(1, 1, -1) };
    return {
      Gk, Q: Qc,
      ELU: { max: G(gU, 1, 1) + dU * den.max + QU.max, min: G(gU, 1, -1) + dU * den.min + QU.min },
      ELS: { max: Gk.max + den.max + Qc.max, min: Gk.min + den.min + Qc.min },
      FRE: { max: Gk.max + den.max + Qf.max, min: Gk.min + den.min + Qf.min },
      QP: { max: Gk.max + den.max, min: Gk.min + den.min },
    };
  }
  const ETATS = ['ELU', 'ELS', 'FRE', 'QP', 'Gk', 'Q'];
  /* Wood-Armer (ferraillage orthogonal suivant x et y) : m* inférieur = m + |mxy|, supérieur = m − |mxy| */
  function woodArmer(cm, ct) {
    const o = {};
    for (const k of ETATS) { const t = Math.max(Math.abs(ct[k].max), Math.abs(ct[k].min)); o[k] = { max: cm[k].max + (cm[k].max > -t ? t : 0), min: cm[k].min - (cm[k].min < t ? t : 0) }; }
    return o;
  }
  const envMax = (list) => { const o = {}; for (const k of ETATS) o[k] = { max: maxA(list.map((c) => c[k].max)), min: minA(list.map((c) => c[k].min)) }; return o; };

  /* ══════════════════ 7. Normalisation des données ══════════════════ */
  function normaliser(d0) {
    const base = d0 && d0.type === 'ropen' ? DEF_ROPEN : DEF_RODBA;
    const d = JSON.parse(JSON.stringify(Object.assign({}, base, d0 || {})));
    ['trans', 'charges', 'appareils', 'mat', 'plaque'].forEach((k) => { d[k] = Object.assign({}, base[k], (d0 || {})[k] || {}); });
    if (d.type === 'ropen') { d.ropen = Object.assign({}, base.ropen, (d0 || {}).ropen || {}); d.ropen.percage = Object.assign({}, base.ropen.percage, ((d0 || {}).ropen || {}).percage || {}); }
    d.travees = (d.travees || []).map(Number).filter((L) => L > 0);
    const nT = d.travees.length;
    if (nT < 1 || nT > 7) throw new Error('1 à 7 travées.');
    if (d.travees.some((L) => L < 1 || L > 35)) throw new Error('Portées comprises entre 1 et 35 m.');
    d.cg = Math.max(0, +d.cg || 0); d.cd = Math.max(0, +d.cd || 0);
    const bA = Array.isArray(d.biaisApp) && d.biaisApp.length === nT + 1 ? d.biaisApp.map(Number) : Array(nT + 1).fill(+d.biais || 100);
    d._biais = bA;
    const bmin = Math.min(...bA), bmax = Math.max(...bA);
    if (d.methode === 'poutre' && (bmin < 70 || bmax > 130)) throw new Error('Calcul en poutre : biais compris entre 70 et 130 gr (au-delà, calcul en plaque).');
    if (bmin < 20 || bmax > 180) throw new Error('Biais compris entre 20 et 180 gr.');
    d.sections = Math.max(4, Math.min(20, Math.round(+d.sections || 10)));
    return d;
  }

  /* ══════════════════ 8. Calcul ══════════════════ */
  function calcul(d0) {
    const t0 = Date.now();
    const d = normaliser(d0), G = geoTrans(d), alertes = [], nT = d.travees.length, ropen = d.type === 'ropen';
    const Ltot = sum(d.travees), regime = d.methode === 'plaque' ? 'ec' : 'f61';
    const fck = +d.mat.fck;
    const Ecm = d.regl === 'bael' ? 11000 * Math.cbrt(fck) : 22000 * Math.pow((fck + 8) / 10, 0.3);   // BAEL A.2.1,21 / EC2 tab. 3.1
    d._Ecm = Ecm;
    /* ── poutrelles enrobées : caractéristiques (BA.inerpe) ── */
    let R = {};
    if (ropen) {
      const prof = IN.profiles.get(d.ropen.profil); if (!prof) throw new Error('Profilé inconnu : ' + d.ropen.profil);
      const N = Math.round(+d.ropen.n), bP = prof.b / 1e3, ent = N > 1 ? (G.Bs - 2 * d.ropen.debLat - bP) / (N - 1) : 0;
      if (!(ent > bP)) throw new Error('Poutrelles trop nombreuses pour la largeur de dalle.');
      const yP = Array.from({ length: N }, (_, k) => +(G.lcg + d.ropen.debLat + bP / 2 + k * ent).toFixed(5));
      const csup = G.h - prof.h / 1e3; if (!(csup > 0)) throw new Error('Épaisseur de dalle inférieure à la hauteur des poutrelles.');
      const inp = (As) => ({ profil: { mode: 'cat', nom: prof.nom }, N, B: G.Bs, csup, typeSous: 'apparente', ecof: +d.ropen.ecof, nappes: As > 0 ? [{ pos: 'sup', As, d: +d.ropen.dAs }] : [],
        fck, fyk: +d.mat.fe, nuance: d.ropen.nuance, fy: +d.ropen.fy || 0, gammaA: +d.ropen.gammaA || 1, gammaC: 1.5, gammaS: 1.15, congesELU: false, nMode: 'saisi', nCourt: +d.ropen.nCourt, nLong: +d.ropen.nLong });
      const AsM = (+d.ropen.AsMinM || 0) * G.Bs;
      const ine = { courant: IN.calcul(inp(AsM)), chapeau: IN.calcul(inp(Math.max(AsM, +d.ropen.AsChap || 0))) };
      const by = (id) => ine.courant.travee.cas.find((c) => c.id === id);
      ine.Ic = by('ctnf').I; ine.Icf = by('ctf').I; ine.Il = by('ltnf').I; ine.Ilf = by('ltf').I; ine.Is = N * prof.Iy / 1e8; ine.Ea = IN.Ea;
      R = { prof, N, ent, yP, csup, ine, H: G.h };
      d._EIx = IN.Ea * 1000 * ine.Ic;
      d._yExtra = yP;
      if (!d.appareils.yC || d.appareils.yC.length < 2) d.appareils.yC = yP.slice();
      if (!d.appareils.yP || d.appareils.yP.length < 2) d.appareils.yP = yP.slice();
    }
    const yA = (j) => (j === 0 || j === nT ? d.appareils.yC : d.appareils.yP).map(Number).filter((y) => y >= 0 && y <= G.B);
    d._app = Array.from({ length: nT + 1 }, (_, j) => ({ y: yA(j), kv: +d.appareils.kv || 0 }));
    if (d._app.some((a) => a.y.length < 1)) throw new Error('Définir les appareils d’appui de chaque file.');
    const cats = permanentes(d, G, R);
    const Gl = sum(cats.map((c) => c.qlin));                      // charge permanente nominale (kN/m)
    /* ── poutre continue (phase 1 des poutrelles, dénivellations, méthode « poutre », flèches) ── */
    const Ibeam = ropen ? R.ine.Ic * IN.Ea / Ecm : G.I;           // inertie « béton » équivalente
    const SP = PT.build({ E: Ecm, ns: d.sections, travees: d.travees.map((L) => ({ L, Ig: Ibeam })), consoles: { g: d.cg, d: d.cd }, appuis: d.travees.concat([0]).map(() => ({ type: 'simple' })) });
    const unit = PT.fixe(SP, [{ type: 'q', a: -d.cg, b: Ltot + d.cd, q: 1 }]);
    // dénivellations : chaque appui seul de « den » (module différé Ecm/(1 + φ)), enveloppe (EN 1990 A2, BAEL)
    const kLD = 1 / (1 + (+d.mat.phi || 2));
    const denR = d.den > 0 ? d.travees.concat([0]).map((_, k) => PT.fixe(SP, [{ type: 'd', appui: k + 1, v: +d.den }])) : [];
    const denEnv = (f) => (denR.length ? { max: Math.max(0, ...denR.map((r) => kLD * f(r))), min: Math.min(0, ...denR.map((r) => kLD * f(r))) } : { max: 0, min: 0 });
    const out = d.methode === 'plaque' ? calcPlaque(d, G, R, cats, SP, unit, denEnv, alertes) : calcPoutre(d, G, R, cats, SP, unit, denEnv, alertes);
    const res = Object.assign({ d, G, R, cats, Gl, Ecm, regime, Ltot, SP, unit, alertes }, out);
    /* ── sections ── */
    if (!ropen) res.ba = sectionsBA(res);
    else res.pe = verifRopen(res);
    res.fl = fleches(res);
    res.ms = Date.now() - t0;
    return res;
  }

  /* points de calcul : lignes de sections (biaises) et fibres */
  function pointsCalcul(d, G, R, M) {
    const secs = [];
    const nT = d.travees.length, ns = d.sections;
    const fibJ = (() => {
      if (d.type === 'ropen') return R.yP.map((y) => M.yy.findIndex((v) => Math.abs(v - y) < 1e-4));
      const js = []; const nF = 9;
      for (let k = 0; k < nF; k++) { const y = G.lcg + 1e-6 + (G.Bs - 2e-6) * k / (nF - 1); let b = 0; M.yy.forEach((v, j) => { if (Math.abs(v - y) < Math.abs(M.yy[b] - y)) b = j; }); if (!js.includes(b)) js.push(b); }
      return js;
    })();
    for (let t = 0; t < nT; t++) for (let k = (t ? 1 : 0); k <= ns; k++) {
      const i = M.iAppui[t] + k * M.mult;
      secs.push({ i, x: M.xi[i], travee: t, k, kind: 't', side: k === 0 ? 'd' : k === ns ? 'g' : '' });
    }
    return { secs, fibJ };
  }

  /* ── méthode « plaque » ── */
  function calcPlaque(d, G, R, cats, SP, unit, denEnv, alertes) {
    const M = maillage(d, G), S = plaque(d, G, M), Gr = grille(M, G, 0.1, 0.2);
    const nT = d.travees.length, ropen = d.type === 'ropen', ch = d.charges;
    // charges permanentes : une résolution par catégorie
    const caseU = cats.map((c) => {
      const lo = c.type === 'pp' ? { surf: [{ y1: 0, y2: G.B, q: (x, y) => c.fy(y) }] } : c.type === 'surf' ? { surf: [{ y1: c.y1, y2: c.y2, q: c.q }] } : { lignes: c.ys.map((y) => ({ y, q: c.q })) };
      const F = chargePlaque(M, S, lo); return { F, U: S.solve(F) };
    });
    // paramètres de placement
    const cellsOf = (a, b) => [Gr.cell(a), Gr.cell(b)];
    const chC = cellsOf(G.chaussee[0], G.chaussee[1]), trC = G.trottoirs.map(([a, b]) => cellsOf(a, b));
    const erev = sum((d.equip || []).filter((e) => e.type === 'surf' && /rev/i.test(e.nom)).map((e) => +e.q / 22)) || 0.06;
    const e2 = 2 * erev + G.h;                                       // diffusion à 45° jusqu'au feuillet moyen (§4.3.6)
    const aTS = 0.40 + e2, cl = +d.classe === 2 ? 2 : 1, beta = ALPHA(cl).Q[0];
    const veh = ch.LM3 ? vehLM3(ch.LM3) : null;
    const allC = [[trC.length ? Math.min(...trC.map((t) => t[0])) : chC[0], trC.length ? Math.max(...trC.map((t) => t[1])) : chC[1]]];
    const Lphi = (veh && ch.vitLM3 === 'normale') ? Math.max(...d.travees) : 0;
    const phi3 = veh ? (ch.vitLM3 === 'normale' ? Math.max(1, 1.4 - Lphi / 500) : 1) : 1;   // EN 1991-2 A.3 (4)
    function cases(eta) {
      const Su = surface(M, Gr, eta), q = {};
      const lm = (sg, f1, f2, qt) => placeLM1(Gr, Su, { sg, fTS: f1, fUDL: f2, qtr: qt, classe: cl, ch: chC, tr: trC, a: aTS });
      if (ch.LM1) { q.LM1 = { max: lm(1, 1, 1, 0).v, min: lm(-1, 1, 1, 0).v }; q.LM1f = { max: lm(1, 0.75, 0.4, 0).v, min: lm(-1, 0.75, 0.4, 0).v }; }
      if (trC.length) q.tr3 = { max: placeRep(Gr, Su, trC, 3, 1), min: placeRep(Gr, Su, trC, 3, -1) };   // trottoirs, valeur de combinaison de gr1a
      if (ch.LM2) { const f = (sg, ff) => placeLM2(Gr, Su, { sg, beta, f: ff, e2, ch: chC }); q.LM2 = { max: f(1, 1), min: f(-1, 1) }; q.LM2f = { max: 0.75 * q.LM2.max, min: 0.75 * q.LM2.min }; }
      if (+ch.qfk > 0 && trC.length) q.qfk = { max: placeRep(Gr, Su, trC, +ch.qfk, 1), min: placeRep(Gr, Su, trC, +ch.qfk, -1) };
      if (ch.LM4) q.LM4 = { max: placeRep(Gr, Su, allC, 5, 1), min: placeRep(Gr, Su, allC, 5, -1) };
      if (veh) q.LM3 = { max: placeLM3(Gr, Su, { sg: 1, veh, phi: phi3, ch: chC }), min: placeLM3(Gr, Su, { sg: -1, veh, phi: phi3, ch: chC }) };
      return { q, Su };
    }
    const etaOf = (U) => { const e = new Float64Array(M.nodes.length); for (let n = 0; n < e.length; n++) e[n] = U[3 * n]; return e; };
    // dénivellations d'appui (poutre continue) réparties uniformément sur la largeur Bs
    const { secs, fibJ } = pointsCalcul(d, G, R, M);
    const sp = SP.sections, spIdx = (x, side) => { let b = 0; sp.forEach((s, k) => { if (Math.abs(s.x - x) < Math.abs(sp[b].x - x) - 1e-9 || (Math.abs(s.x - x) < 1e-6 && s.side === side)) b = k; }); return b; };
    for (const s of secs) {
      const kb = spIdx(s.x, s.side);
      s.fib = fibJ.map((j) => {
        const node = M.id(s.i, j), f = { y: M.yy[j], node };
        // effort tranchant : sur une ligne d'appui, de chaque côté (la moyenne des deux côtés s'annulerait)
        const surApp = s.k === 0 || s.k === d.sections;
        // sur appui : effort tranchant à une distance ≈ d de la ligne d'appui, de part et d'autre (EN 1992-1-1 §6.2.1 (8))
        const mD = Math.max(1, Math.round((G.h - +d.mat.dInf) / (M.xi[s.i] - M.xi[s.i - 1] || M.xi[s.i + 1] - M.xi[s.i])));
        const nG = s.i - mD >= 0 ? M.id(s.i - mD, j) : node, nD = s.i + mD < M.nx ? M.id(s.i + mD, j) : node;
        const noms = ['mx', 'my', 'mxy', 'qx'], gs = [gMoment(M, S, node, 0), gMoment(M, S, node, 1), gMoment(M, S, node, 2), gShear(M, S, surApp ? nG : node)];
        const Us = S.solveN(gs);
        if (surApp) { noms.push('qx2'); const g2 = gShear(M, S, nD); gs.push(g2); Us.push(S.solve(g2)); }
        for (let a = 0; a < noms.length; a++) {
          const nom = noms[a], g = gs[a], c = cases(etaOf(Us[a]));
          const den = nom === 'mx' ? denEnv((r) => r.sec[kb].M / G.Bs) : nom === 'qx' || nom === 'qx2' ? denEnv((r) => r.sec[kb].V / G.Bs) : { max: 0, min: 0 };
          f[nom] = { g: caseU.map((u) => dot(g, u.U)), den, q: c.q };
          f[nom].c = combiner(f[nom], cats, 'ec');
        }
        return f;
      });
      // valeurs de calcul de la section (pire des fibres) ; RODBA : Wood-Armer
      if (!ropen) {
        s.Mx = envMax(s.fib.map((f) => woodArmer(f.mx.c, f.mxy.c)));
        s.My = envMax(s.fib.map((f) => woodArmer(f.my.c, f.mxy.c)));
      } else {
        s.Mx = envMax(s.fib.map((f) => f.mx.c)); s.My = envMax(s.fib.map((f) => f.my.c));
      }
      s.V = envMax(s.fib.flatMap((f) => (f.qx2 ? [f.qx.c, f.qx2.c] : [f.qx.c])));
    }
    // appareils d'appui : réaction de chaque appareil, réaction globale et moment transversal de la file, rotation
    const app = d._app.map((li, j) => {
      const ss = S.sup.filter((s) => s.ligne === j);
      const surfR = ss.map((s) => {
        const n = 3 * s.node; let eta;
        if (s.kv > 0) { const e = new Float64Array(S.nd); e[n] = 1; eta = etaOf(S.solve(e)).map((v) => v * s.kv); }
        else { const z = S.solve(S.Krow(n)); eta = etaOf(z).map((v) => -v); eta[s.node] = 1; }
        return eta;
      });
      const bear = ss.map((s, k) => {
        const c = cases(surfR[k]);
        const rec = { g: caseU.map((u) => reaction(S, u.U, u.F, s)), den: denEnv((r) => r.appuis[j].R / ss.length), q: c.q };
        return { y: s.y, node: s.node, rec, c: combiner(rec, cats, 'ec') };
      });
      // file entière : V et moment transversal / axe (y − B/2) ; configuration LM1 de V max/min → excentricité concomitante
      const nN = M.nodes.length, eV = new Float64Array(nN), eM = new Float64Array(nN);
      surfR.forEach((eta, k) => { const yk = ss[k].y - G.yc; for (let n = 0; n < nN; n++) { eV[n] += eta[n]; eM[n] += eta[n] * yk; } });
      const cV = cases(eV), SuM = surface(M, Gr, eM);
      const ecc = {};
      if (ch.LM1) for (const sg of [1, -1]) {
        const p = placeLM1(Gr, cV.Su, { sg, fTS: 1, fUDL: 1, qtr: 0, classe: cl, ch: chC, tr: [], a: aTS });
        ecc[sg > 0 ? 'max' : 'min'] = { V: p.v, e: Math.abs(p.v) > 1e-6 ? evalLM1(Gr, cV.Su, SuM, p.cfg) / p.v : 0 };
      }
      const qtr = {}; trC.forEach((tc, k) => { for (const sg of [1, -1]) { const v = placeRep(Gr, cV.Su, [tc], +ch.qfk || 5, sg); const Mt = (() => { let m = 0; for (let c = tc[0]; c < tc[1]; c++) for (let kx = 0; kx < Gr.nX; kx++) { const p = c * Gr.nX + kx; if (sg * cV.Su.v[p] > 0) m += SuM.v[p]; } return m * Gr.dx * Gr.dy * (+ch.qfk || 5); })(); qtr[`t${k}${sg > 0 ? 'max' : 'min'}`] = { V: v, e: Math.abs(v) > 1e-9 ? Mt / v : 0 }; } });
      const recL = { g: bear[0].rec.g.map((_, c) => sum(bear.map((b) => b.rec.g[c]))), den: denEnv((r) => r.appuis[j].R), q: cV.q };
      const gM = cats.map((_, c) => sum(bear.map((b) => b.rec.g[c] * (b.y - G.yc))));
      // rotation (autour de y) au nœud d'appui le plus proche de l'axe : G (module instantané) et LM1
      const nAx = ss.reduce((b, s) => (Math.abs(s.y - G.yc) < Math.abs(b.y - G.yc) ? s : b), ss[0]).node;
      const eR = new Float64Array(S.nd); eR[3 * nAx + 1] = 1; const thU = S.solve(eR), cTh = cases(etaOf(thU));
      const rot = { G: caseU.map((u) => u.U[3 * nAx + 1]), q: cTh.q };
      return { j, nom: (j === 0 || j === nT ? 'C' : 'P') + j, x: M.xa[j], culee: j === 0 || j === nT, n: ss.length, bear, ligne: { rec: recL, c: combiner(recL, cats, 'ec'), gM, ecc, qtr }, rot };
    });
    // flèche dans l'axe à mi-travée : G (module instantané) et trafic caractéristique
    const jAx = M.yy.reduce((b, v, j) => (Math.abs(v - G.yc) < Math.abs(M.yy[b] - G.yc) ? j : b), 0);
    const wMid = d.travees.map((L, t) => {
      const i = M.iAppui[t] + Math.round(d.sections / 2) * M.mult, node = M.id(i, jAx), e = new Float64Array(S.nd); e[3 * node] = 1;
      const c = cases(etaOf(S.solve(e)));
      return { t, x: M.xi[i], G: caseU.map((u) => u.U[3 * node]), q: c.q };
    });
    return { M, S, Gr, caseU, secs, app, wMid, info: { noeuds: M.nodes.length, elements: M.elems.length, ddl: S.nf, bande: S.p, aTS, e2, phi3 } };
  }

  /* ── méthode « poutre » (Fascicule 61 titre II, BAEL) ── */
  function calcPoutre(d, G, R, cats, SP, unit, denEnv, alertes) {
    const nT = d.travees.length, ch = d.charges, ropen = d.type === 'ropen';
    const LI = PT.lignes(SP);
    const Gl = sum(cats.map((c) => c.qlin)), Lr = G.lch, classe = Math.max(1, Math.min(3, Math.round(+d.classe || 1)));
    const cfg = { classe, Lch: Lr, g: Gl, nCamBc: 2, nmc: 1, mcFile: false };
    const co = PT.coefficients(SP, cfg), c2 = Object.assign({}, cfg, { a1: co.a1, a2: co.a2, largAL: co.largAL });
    const sys = [['AL', 'AL'], ['Bc', 'BC'], ['Bt', 'BT'], ['Mc80', 'MC80'], ['Mc120', 'MC120']].filter(([k]) => ch[k]);
    const trW = sum(G.trottoirs.map(([a, b]) => b - a)), qtr = (+ch.qtr || 1.5) * trW;
    // coefficients de répartition transversale K (Guyon-Massonnet, dalle isotrope α = 1) par travée, fibre la plus chargée
    const b = G.Bs / 2, yOff = G.yc;     // axe de la dalle
    const Kt = d.travees.map((L) => {
      const th = b / L, m = GM.modele({ b, L, theta: th, alpha: 1, nu: 0, N: 5 });
      const sysG = { AL: !!ch.AL, Bc: !!ch.Bc, Bt: !!ch.Bt, Mc80: !!ch.Mc80, Mc120: !!ch.Mc120, trottoir: trW > 0 };
      const f = GM.fasc61(m, { Lr, nDisp: 0, yc: (G.chaussee[0] + G.chaussee[1]) / 2 - yOff, classe, systemes: sysG, trottoirs: G.trottoirs.map(([a, bb]) => [a - yOff, bb - yOff]), qTrottoir: +ch.qtr || 1.5, sansBc: true });
      const K = {}; for (const [k, c] of Object.entries(f.cas)) K[k === 'trottoir' ? 'trott' : k] = Math.max(1, maxA(c.res.map((r) => r.Kmax)));
      return { L, theta: th, K, f };
    });
    const kOf = (mod, t) => (co.k[mod] ? co.k[mod][t] : 1);
    const envAt = (li, t) => {
      const q = {};
      for (const [k, mod] of sys) { const e = PT.envModele(li, mod, c2), f = kOf(mod, t); q[k] = { max: f * e.max.v, min: f * e.min.v }; }
      if (qtr > 0) { const e = PT.envRepartie(li, qtr); q.trott = { max: e.max.v, min: e.min.v }; }
      return q;
    };
    const scale = (q, t, ky) => { const o = {}; for (const [k, v] of Object.entries(q)) { const K = ky ? (Kt[t].K[k] || 1) : 1; o[k] = { max: v.max * K, min: v.min * K }; } return o; };
    const per = ropen ? 1 / R.N : 1 / G.Bs;      // par mètre de largeur (RODBA) ou par poutrelle (ROPEN)
    const catsM = cats.map((c) => PT.fixe(SP, [{ type: 'q', a: -d.cg, b: sum(d.travees) + d.cd, q: c.qlin }]));
    const secs = SP.sections.filter((s) => s.kind === 't').map((s) => {
      const k = SP.sections.indexOf(s), L = LI.sec[k], t = s.travee;
      const recM = { g: catsM.map((r) => r.sec[k].M * per), den: denEnv((r) => r.sec[k].M * per), q: scale(envAt(L.M, t), t, true) };
      Object.values(recM.q).forEach((v) => { v.max *= per; v.min *= per; });
      const recV = { g: catsM.map((r) => r.sec[k].V * per), den: denEnv((r) => r.sec[k].V * per), q: scale(envAt(L.V, t), t, true) };
      Object.values(recV.q).forEach((v) => { v.max *= per; v.min *= per; });
      const cM = combiner(recM, cats, 'f61'), cV = combiner(recV, cats, 'f61');
      return { x: s.x, travee: t, kind: 't', side: s.side, k, Mx: cM, V: cV, recM, recV, fib: null };
    });
    // flexion transversale à mi-travée (Guyon-Massonnet : charges d'exploitation × δ ; superstructures)
    secs.forEach((s) => {
      if (Math.abs(s.x - (sum(d.travees.slice(0, s.travee)) + d.travees[s.travee] / 2)) > 1e-6) return;
      const f = Kt[s.travee].f, q = {};
      for (const [k, c] of Object.entries(f.cas)) {
        const key = k === 'trottoir' ? 'trott' : k, mod = { AL: 'AL', Bc: 'BC', Bt: 'BT', Mc80: 'MC80', Mc120: 'MC120' }[k];
        const fac = mod ? (mod === 'BC' ? co.deltas.BC[s.travee] * co.bc : mod === 'BT' ? co.deltas.BT[s.travee] * co.bt : mod === 'MC80' ? co.deltas.MC80[s.travee] : mod === 'MC120' ? co.deltas.MC120[s.travee] : 1) : 1;
        q[key] = { max: fac * maxA(c.res.map((r) => r.Mmax)), min: fac * minA(c.res.map((r) => r.Mmin)) };
      }
      const rec = { g: cats.map(() => 0), q };
      s.My = combiner(rec, cats, 'f61');
    });
    // appareils : réaction globale (ligne d'influence) ; par appareil : R/n × K (fibre la plus chargée), G : R/n
    const app = SP.app.map((a, j) => {
      const li = LI.app[j].R, tA = [Math.max(0, j - 1), Math.min(nT - 1, j)], t = d.travees[tA[0]] >= d.travees[tA[1]] ? tA[0] : tA[1];
      const recL = { g: catsM.map((r) => r.appuis[j].R), den: denEnv((r) => r.appuis[j].R), q: envAt(li, t) };
      const n = d._app[j].y.length;
      const recB = { g: recL.g.map((v) => v / n), den: { max: recL.den.max / n, min: recL.den.min / n }, q: scale(recL.q, t, true) };
      Object.values(recB.q).forEach((v) => { v.max /= n; v.min /= n; });
      const thLi = LI.app[j].th, qth = envAt(thLi, t);
      const rot = { G: cats.map((c) => c.qlin * unit.appuis[j].th), q: qth };
      return { j, nom: (j === 0 || j === nT ? 'C' : 'P') + j, x: a.x, culee: j === 0 || j === nT, n, y: d._app[j].y,
        bear: d._app[j].y.map((y) => ({ y, rec: recB, c: combiner(recB, cats, 'f61') })), ligne: { rec: recL, c: combiner(recL, cats, 'f61') }, rot };
    });
    const wMid = d.travees.map((L, t) => {
      const k = SP.sections.findIndex((s) => s.kind === 't' && s.travee === t && Math.abs(s.x - (sum(d.travees.slice(0, t)) + L / 2)) < 1e-6);
      return { t, x: SP.sections[k].x, G: catsM.map((r) => r.sec[k].w), q: scale(envAt(LI.sec[k].w, t), t, false) };
    });
    return { LI, co, Kt, secs, app, wMid, info: { a1: co.a1, a2: co.a2, nv: co.nv, bc: co.bc, bt: co.bt, deltas: co.deltas } };
  }
  const Ecmof = (d) => d._Ecm;

  /* ══════════════════ 9. RODBA : sections d'acier par mètre (BA.sectionBA) ══════════════════ */
  function dimSection(res, c, V, h, dir) {
    const d = res.d, ec = d.regl !== 'bael';
    const dS = +d.mat.dSup, dI = +d.mat.dInf;
    const elu = [{ M: -c.ELU.max, V: V || 0 }, { M: -c.ELU.min }];
    const els = ec
      ? [{ M: -c.ELS.max, Mqp: -c.QP.max, type: 0 }, { M: -c.ELS.min, Mqp: -c.QP.min, type: 0 }, { M: -c.QP.max, type: 1 }, { M: -c.QP.min, type: 1 }]
      : [{ M: -c.ELS.max, type: 0 }, { M: -c.ELS.min, type: 0 }];
    const r = SB.calcul({ forme: 'rect', mode: 'dim', regl: ec ? 'EC2' : 'BAEL', materiau: ec ? { fck: +d.mat.fck, fyk: +d.mat.fe, classe: 'B' } : { fck: +d.mat.fck, fyk: +d.mat.fe, fissuration: +d.mat.fissuration },
      section: { b: 1, h, nStrips: 80, nappes: [{ d: dS, As: 0 }, { d: h - dI, As: 0 }] }, elu, els, options: { nCalcule: false, n: 15, element: 'dalle', cot: ec ? 1 : undefined } });
    const cis = r.cis[0];
    return { dir, As: r.dim.As, AsELU: r.dim.AsELU, req: r.dim.req, Asw: cis ? (cis.Asw ?? cis.At ?? 0) : 0, AsFtd: cis && cis.AsFtd ? cis.AsFtd : 0, VRdc: cis ? cis.VRdc : null, sc: maxA(r.els.map((e) => e.sc)), verdict: r.verdict, alertes: r.alertes };
  }
  function sectionsBA(res) {
    const G = res.G, d = res.d;
    const lon = res.secs.map((s) => Object.assign({ x: s.x, travee: s.travee, k: s.k }, dimSection(res, s.Mx, Math.max(Math.abs(s.V.ELU.max), Math.abs(s.V.ELU.min)), G.h, 'x')));
    const tra = res.secs.filter((s) => s.My && (s.k === Math.round(d.sections / 2) || s.k === 0 || s.k === d.sections))
      .map((s) => Object.assign({ x: s.x, travee: s.travee, k: s.k, mi: s.k === Math.round(d.sections / 2) }, dimSection(res, s.My, 0, G.h, 'y')));
    return { lon, tra };
  }

  /* ══════════════════ 10. ROPEN : vérifications des poutrelles ══════════════════ */
  function verifRopen(res) {
    const d = res.d, R = res.R, P = R.prof, N = R.N, ine = R.ine, ec = d.regl !== 'bael';
    const hP = P.h / 1e3, tf = P.tf / 1e3, bP = P.b / 1e3, tw = P.tw / 1e3;
    const fy = +d.ropen.fy > 0 ? +d.ropen.fy : IN.fyNuance(d.ropen.nuance, P.tf), gA = +d.ropen.gammaA || 1;
    const Is1 = P.Iy / 1e8, vS = hP / 2;
    const Wpl = bP * tf * (hP - tf) + tw * (hP - 2 * tf) ** 2 / 4;                           // sans congés
    const MplS = Wpl * fy / gA * 1000;                                                        // par poutrelle, EN 1993-1-1 §6.2.5
    const Av = (P.A * 100 - 2 * P.b * P.tf + (P.tw + 2 * P.r) * P.tf) / 1e6;                  // EN 1993-1-1 §6.2.6 (3)
    const VplRd = Av * fy / Math.sqrt(3) / gA * 1000;
    const H = R.H, lim = { beton: 0.6 * +d.mat.fck, acier: ec ? fy : fy / 1.15, HA: ec ? 0.8 * +d.mat.fe : 270 };
    // phase 1 : poids propre (béton + poutrelles) sur les poutrelles seules (poutre continue, part égale)
    const pp = sum(res.cats.filter((c) => c.phase === 1).map((c) => c.qlin)), iP = res.cats.map((c, k) => (c.phase === 1 ? k : -1)).filter((k) => k >= 0);
    const SP = res.SP, sp = SP.sections;
    const near = (x) => sp.reduce((b, s, k) => (Math.abs(s.x - x) < Math.abs(sp[b].x - x) ? k : b), 0);
    const MRdP = ine.courant.travee.elu.M / N, MRdNc = -ine.courant.appui.elu.M / N, MRdNa = -ine.chapeau.appui.elu.M / N;
    const minApp = minA(res.secs.map((s) => s.Mx.ELU.min));
    const out = res.secs.map((s) => {
      const k = near(s.x), M1 = pp * res.unit.sec[k].M / N, V1 = pp * res.unit.sec[k].V / N;
      // efforts par poutrelle hors poids propre (plaque : m(y_p)·entraxe ; poutre : déjà par poutrelle)
      const sansPP = (rec) => Object.assign({}, rec, { g: rec.g.map((v, c) => (iP.includes(c) ? 0 : v)) });
      const parP = (f, nom) => { const rec = f[nom], fac = R.ent; return { g: rec.g.map((v) => v * fac), den: { max: rec.den.max * fac, min: rec.den.min * fac }, q: Object.fromEntries(Object.entries(rec.q).map(([kk, v]) => [kk, { max: v.max * fac, min: v.min * fac }])) }; };
      const recs = s.fib ? s.fib.map((f) => ({ M: parP(f, 'mx'), V: parP(f, 'qx'), y: f.y })) : [{ M: s.recM, V: s.recV, y: null }];
      const chap = s.Mx.ELU.min < -(+d.ropen.seuilChap || 0.1) * Math.abs(minApp);
      const RR = chap ? ine.chapeau : ine.courant, MRdN = chap ? MRdNa : MRdNc;
      let worst = null, MuMax = -Infinity, MuMin = Infinity, Vu = 0, yMax = null;
      for (const r of recs) {
        const cM = combiner(sansPP(r.M), res.cats, res.regime), cV = combiner(sansPP(r.V), res.cats, res.regime);
        const muMax = 1.35 * Math.max(M1, 0) + 1.0 * Math.min(M1, 0) + cM.ELU.max, muMin = 1.35 * Math.min(M1, 0) + Math.max(M1, 0) + cM.ELU.min;
        if (muMax > MuMax) { MuMax = muMax; yMax = r.y; } MuMin = Math.min(MuMin, muMin);
        Vu = Math.max(Vu, Math.abs(1.35 * V1) + Math.max(Math.abs(cV.ELU.max), Math.abs(cV.ELU.min)));
        // ELS : contraintes par phases (cas 1 poutrelles seules ; cas 3 superstructures + Δ, n long ; cas 4 trafic, n court)
        const rq = sansPP(r.M);
        const M3s = { max: sum(rq.g.map((e, c) => e * (e > 0 ? res.cats[c].kmax : res.cats[c].kmin))) + rq.den.max, min: sum(rq.g.map((e, c) => e * (e < 0 ? res.cats[c].kmax : res.cats[c].kmin))) + rq.den.min };
        for (const sg of [1, -1]) {
          const M3 = sg > 0 ? M3s.max : M3s.min, M4 = sg > 0 ? cM.ELS.max - M3s.max : cM.ELS.min - M3s.min;
          const sens = (M3 + M4) >= 0 ? 1 : -1, part = sens > 0 ? RR.travee : RR.appui;
          const cL = part.cas.find((c) => c.id === 'ltf'), cC = part.cas.find((c) => c.id === 'ctf');
          // inerpe : section totale (N poutrelles) → efforts × N ; y depuis la sous-face des poutrelles, + compression
          const sig = (c, Mp, y, beton, nn) => (beton ? 1 / nn : 1) * Mp * N * (y - c.yG) / c.I / 1000;
          const fib = (y, beton) => ({
            c1: beton ? 0 : M1 * (y - vS) / Is1 / 1000,
            c3: (beton && ((sens > 0 && y < cL.yG) || (sens < 0 && y > cL.yG))) ? 0 : sig(cL, M3, y, beton, cL.n),
            c4: (beton && ((sens > 0 && y < cC.yG) || (sens < 0 && y > cC.yG))) ? 0 : sig(cC, M4, y, beton, cC.n),
          });
          const zb = +d.ropen.ecof + tf;
          const F = { betonSup: fib(H, true), betonInf: fib(zb, true), aileSup: fib(hP, false), aileInf: fib(0, false), HA: Object.assign(fib(H - +d.ropen.dAs, false), { c1: 0 }) };
          for (const f of Object.values(F)) f.tot = f.c1 + f.c3 + f.c4;
          const ratio = Math.max(Math.max(0, F.betonSup.tot, F.betonInf.tot) / lim.beton, Math.abs(F.aileSup.tot) / lim.acier, Math.abs(F.aileInf.tot) / lim.acier, Math.max(0, -F.HA.tot) / lim.HA);
          if (!worst || ratio > worst.ratio) worst = { sg, M1, M3, M4, F, ratio, y: r.y };
        }
      }
      const okELU = MuMax <= MRdP + 1e-6 && MuMin >= MRdN - 1e-6 && Math.abs(1.35 * M1) <= MplS + 1e-6;
      // somme des poutrelles (moments globaux de la largeur)
      return { x: s.x, travee: s.travee, k: s.k, chap, M1, V1, MuMax, MuMin, yMax, Vu, MRdP, MRdN, MplS, okELU, worst, okELS: worst.ratio <= 1 + 1e-9 };
    });
    const Vsd = maxA(out.map((o) => o.Vu));
    /* contre-flèches (cm) : fb poids propre sur poutrelles seules, fp superstructures (inertie moyenne long terme),
     * fq trafic caractéristique (inertie moyenne court terme, poutre de largeur totale) ; contre-flèche = fb + fp + fq/4 */
    const Ea = IN.Ea * 1000, EIs = Ea * ine.Is, EIlm = Ea * (ine.Il + ine.Ilf) / 2, EIcm = Ea * (ine.Ic + ine.Icf) / 2;
    const sup = sum(res.cats.filter((c) => c.phase !== 1).map((c) => c.qlin * c.kmax));
    const EIb = res.Ecm * 1000 * SP.travees[0].Ig;
    const cf = SP.sections.filter((s) => s.kind !== 'x').map((s, k) => {
      const wu = res.unit.sec[SP.sections.indexOf(s)].w * EIb;
      return { x: s.x, kind: s.kind, travee: s.travee, fb: pp * wu / EIs, fp: sup * wu / EIlm };
    });
    // fq : flèche sous trafic (plaque ou poutre) à mi-travée → répartie avec la forme de la flèche permanente
    // fq : flèche sous trafic caractéristique à mi-travée (inertie non fissurée court terme) ramenée à l'inertie moyenne
    res.wMid.forEach((w) => { const q = maxA(Object.entries(w.q).filter(([k]) => !/f$/.test(k)).map(([, v]) => v.max)) || 0; w.fqCF = q * Ea * ine.Ic / EIcm; });
    cf.forEach((c) => {
      if (c.kind !== 't') { c.fq = 0; c.tot = c.fb + c.fp; return; }
      const w = res.wMid[c.travee], xm = w.x, L = d.travees[c.travee], x0 = sum(d.travees.slice(0, c.travee));
      c.fq = w.fqCF * Math.sin(Math.PI * clamp((c.x - x0) / L, 0, 1)); void xm;
      c.tot = c.fb + c.fp + c.fq / 4;
    });
    /* déversement pendant le bétonnage (Fasc. 61 titre V art. 19, méthode simplifiée, Mt = pL²/8 par poutrelle) */
    const Lmax = Math.max(...d.travees), Wel1 = Is1 / (hP / 2), gp = P.A / 1e4 * 77;
    const qFrais = (H - tf) * (+d.gb || 25) * R.ent, qCh = 0.5 * R.ent;
    const sigL = gp * Lmax ** 2 / 8 / Wel1 / 1000, sigE = (qFrais + qCh) * Lmax ** 2 / 8 / Wel1 / 1000, sigE15 = (0.15 * (+d.gb || 25) * R.ent + qCh) * Lmax ** 2 / 8 / Wel1 / 1000;
    const sigCrit = IN.Ea / 12 * Math.pow(Math.PI * bP / (0.7 * Lmax), 2);
    const dev = { Lmax, sigL, sigE, sigF: 1.35 * sigL + 1.6 * sigE, sigF15: 1.35 * sigL + 1.6 * sigE15, sigCrit, sigLim: sigCrit <= fy / 2 ? sigCrit : fy * (1 - fy / (4 * sigCrit)) };
    dev.ok15 = dev.sigF15 <= dev.sigLim; dev.ok = dev.sigF <= dev.sigLim;
    if (!dev.ok) res.alertes.push('Déversement des poutrelles : contrainte critique simplifiée dépassée pour un bétonnage en une phase — calcul fin (moment critique, phasage) ou anti-déversement.');
    const dal = { q: (H - tf) * (+d.gb || 25) + 0.5, portee: R.ent - bP + 2 * 0.05 };
    return { secs: out, fy, Wpl, MplS, Av, VplRd, Vsd, okV: Vsd <= VplRd, lim, cf, dev, dal, H };
  }

  /* ══════════════════ 11. Flèches ══════════════════ */
  function fleches(res) {
    const d = res.d, G = res.G, phi = +d.mat.phi || 2;
    return res.wMid.map((w) => {
      const wG = sum(w.G), qmax = maxA(Object.entries(w.q).filter(([k]) => !/f$/.test(k)).map(([, v]) => v.max)) || 0;
      return { t: w.t, x: w.x, wG, wGlt: wG * (1 + phi), wQ: qmax, L: d.travees[w.t], ratioQ: qmax > 0 ? d.travees[w.t] / qmax : Infinity };
    });
    void G;
  }

  /* ══════════════════ 12. Échanges REPHOR / APPUI ══════════════════ */
  /* fichier relu par la page REPHOR (« Ouvrir ») : G = réaction permanente maxi de la file (ELS), Q = trafic caractéristique */
  function exportRephor(res) {
    const d = res.d;
    const ap = res.app.map((a) => ({
      nom: a.nom, type: a.culee ? 'culee' : 'pile', nfut: a.culee ? 3 : 2, larfut: a.culee ? 1 : 6, esup: 0.8, einf: a.culee ? 1.4 : 0.8, hfut: 9, Khcd: 0, Krcd: 0,
      app: 'elasto', appD: '', napp: a.n, pa: 0, pb: 0, pn: 0, pti: 12, pts: 3,
      Gmax: +a.ligne.c.Gk.max.toFixed(1), Qmax: +a.ligne.c.Q.max.toFixed(1), rot: +Math.abs(sum(a.rot.G)).toFixed(6),
    }));
    return { module: 'rephor', version: 1, source: 'RODBAN-ROPEN',
      v: { projet: d.projet || '', ouvrage: 'route', biais: d._biais[0], travees: d.travees.join(' '), about0: d.cg, aboutn: d.cd, joints: '', modeApp: 'dim', lch: res.G.lch, classeF61: Math.min(3, +d.classe || 1), classeTrafic: +d.classe === 2 ? 2 : 1, reglRoute: res.regime === 'ec' ? 'en' : 'f61' }, ap };
  }
  function exportAppuis(res) {
    const d = res.d, r2 = (o) => ({ max: +o.max.toFixed(2), min: +o.min.toFixed(2) });
    return res.app.map((a) => {
      const qs = (q) => Object.fromEntries(Object.entries(q).map(([k, v]) => [k, r2(v)]));
      const best = a.bear.reduce((b, x) => (x.c.ELS.max > b.c.ELS.max ? x : b), a.bear[0]);
      return {
        format: 'BA.rodbanRopen.appui', version: 1, module: 'RODBAN-ROPEN', projet: d.projet || '', appui: a.j, nom: a.nom, x: a.x, biais_gr: d._biais[a.j],
        convention: 'Réactions verticales positives vers le haut (kN), charges d’exploitation majorées dynamiquement ; excentricités / axe du tablier (m, y > 0 vers la droite) ; rotations en rad.',
        ligne: { G: r2(a.ligne.c.Gk), charges: qs(a.ligne.rec.q), denivellations: r2(a.ligne.rec.den), combinaisons: { ELU: r2(a.ligne.c.ELU), ELS: r2(a.ligne.c.ELS), FRE: r2(a.ligne.c.FRE), QP: r2(a.ligne.c.QP) }, excentricites: a.ligne.ecc || null },
        appareils: { nombre: a.n, positions: a.bear.map((b) => +(b.y - res.G.yc).toFixed(3)),
          detail: a.bear.map((b) => ({ y: +(b.y - res.G.yc).toFixed(3), G: r2(b.c.Gk), charges: qs(b.rec.q), ELU: r2(b.c.ELU), ELS: r2(b.c.ELS) })),
          plusCharge: { y: +(best.y - res.G.yc).toFixed(3), ELSmax: +best.c.ELS.max.toFixed(2), ELUmax: +best.c.ELU.max.toFixed(2) } },
        rotations: { G: +sum(a.rot.G).toExponential(4), trafic: qs(a.rot.q) },
      };
    });
  }

  /* ══════════════════ 13. Plans (SVG) ══════════════════
   * primitives (m) : {l:[x1,y1,x2,y2,calque]}, {t:[x,y,texte,h,calque,ancre]}, {p:[[x,y]…],calque}, {c:[x,y,r,calque]},
   * {cote:[x1,x2,y,texte]}, {coteV:[x,y1,y2,texte]} */
  const fmtM = (v) => (Math.round(v * 1000) / 1000).toString().replace('.', ',');
  function vues(res) {
    const d = res.d, G = res.G, nT = d.travees.length, Lt = res.Ltot, ropen = d.type === 'ropen';
    const X = [0]; d.travees.forEach((L) => X.push(X[X.length - 1] + L));
    const V = [], hT = G.h, xa = -d.cg, xb = Lt + d.cd;
    // élévation
    const el = [{ p: [[xa, 0], [xb, 0], [xb, -hT], [xa, -hT]], calque: 'COFFRAGE' }];
    X.forEach((x, j) => {
      el.push({ l: [x, 0.6, x, -hT - 1.2, 'AXES'] });
      el.push({ p: [[x - 0.2, -hT - 0.03], [x + 0.2, -hT - 0.03], [x + 0.2, -hT - 0.12], [x - 0.2, -hT - 0.12]], calque: 'APPAREILS' });
      el.push({ t: [x, 0.8, (j === 0 || j === nT ? 'C' : 'P') + j, 0.35, 'TEXTE', 'middle'] });
    });
    d.travees.forEach((L, i) => el.push({ cote: [X[i], X[i + 1], -hT - 0.9, fmtM(L)] }));
    if (d.cg > 0) el.push({ cote: [xa, 0, -hT - 0.5, fmtM(d.cg)] });
    if (d.cd > 0) el.push({ cote: [Lt, xb, -hT - 0.5, fmtM(d.cd)] });
    el.push({ coteV: [xb + 0.6, 0, -hT, fmtM(hT)] });
    V.push({ id: 'elev', titre: 'Élévation (coupe longitudinale dans l’axe)', prim: el });
    // vue en plan biaise : tablier, lignes d'appui, appareils, chaussée, trottoirs
    const pl = [], B = G.B, cot = (j) => 1 / Math.tan(d._biais[j] * GR);
    const off = (j, y) => (y - G.yc) * cot(j);
    const cg0 = cot(0), cdn = cot(nT);
    pl.push({ p: [[xa + (0 - G.yc) * cg0, 0], [xb + (0 - G.yc) * cdn, 0], [xb + (B - G.yc) * cdn, B], [xa + (B - G.yc) * cg0, B]], calque: 'COFFRAGE' });
    for (const y of [G.chaussee[0], G.chaussee[1]]) pl.push({ l: [xa + (y - G.yc) * cg0, y, xb + (y - G.yc) * cdn, y, 'COTES'] });
    if (G.lcg > 0) for (const y of [G.lcg, B - G.lcg]) pl.push({ l: [xa + (y - G.yc) * cg0, y, xb + (y - G.yc) * cdn, y, 'CACHE'] });
    X.forEach((x, j) => {
      pl.push({ l: [x + off(j, -0.8), -0.8, x + off(j, B + 0.8), B + 0.8, 'AXES'] });
      res.app[j].bear.forEach((b) => pl.push({ c: [x + off(j, b.y), b.y, 0.12, 'APPAREILS'] }));
      pl.push({ t: [x + off(j, -1.1), -1.1, (j === 0 || j === nT ? 'C' : 'P') + j + ' — ' + fmtM(d._biais[j]) + ' gr', 0.35, 'TEXTE', 'middle'] });
    });
    if (ropen) res.R.yP.forEach((y) => pl.push({ l: [xa + (y - G.yc) * cg0, y, xb + (y - G.yc) * cdn, y, 'POUTRELLES'] }));
    pl.push({ coteV: [xb + (B - G.yc) * cdn + 1.0, 0, B, fmtM(B)] });
    V.push({ id: 'plan', titre: 'Vue en plan (lignes d’appui biaises, appareils d’appui' + (ropen ? ', poutrelles' : '') + ')', prim: pl, flipY: true });
    // coupe transversale
    const ct = [], tr = d.trans, pts = [];
    const top = 0, bot = (y) => -G.ep(y);
    const ys = [0, G.lcg, B - G.lcg, B].filter((v, i, a) => !i || v > a[i - 1] + 1e-9);
    pts.push([0, top]); pts.push([B, top]); for (let k = ys.length - 1; k >= 0; k--) pts.push([ys[k], bot(ys[k])]);
    ct.push({ p: pts, calque: 'COFFRAGE' });
    // superstructures schématiques : trottoirs, chaussée
    G.trottoirs.forEach(([a, b]) => ct.push({ p: [[a, 0], [b, 0], [b, 0.25], [a, 0.25]], calque: 'CACHE' }));
    ct.push({ l: [G.chaussee[0], 0.06, G.chaussee[1], 0.06, 'CACHE'] });
    if (ropen) {
      const P = res.R.prof, hp = P.h / 1e3, bp = P.b / 1e3, tf = P.tf / 1e3, tw = P.tw / 1e3, z0 = -G.h;
      res.R.yP.forEach((yc) => ct.push({ p: [[yc - bp / 2, z0], [yc + bp / 2, z0], [yc + bp / 2, z0 + tf], [yc + tw / 2, z0 + tf], [yc + tw / 2, z0 + hp - tf], [yc + bp / 2, z0 + hp - tf], [yc + bp / 2, z0 + hp], [yc - bp / 2, z0 + hp], [yc - bp / 2, z0 + hp - tf], [yc - tw / 2, z0 + hp - tf], [yc - tw / 2, z0 + tf], [yc - bp / 2, z0 + tf]], calque: 'POUTRELLES' }));
    }
    ct.push({ l: [G.yc, 0.8, G.yc, -G.h - 0.4, 'AXES'] });
    ct.push({ cote: [0, B, -G.h - 0.7, fmtM(B)] });
    ct.push({ cote: [G.lcg, B - G.lcg, -G.h - 0.35, fmtM(G.Bs)] });
    let y = 0; [['rive', tr.dG], ['trottoir', tr.tG], ['chaussée', tr.lc], ['trottoir', tr.tD], ['rive', tr.dD]].forEach(([, w]) => { if (w > 0) { ct.push({ cote: [y, y + w, 0.55, fmtM(w)] }); y += w; } });
    ct.push({ coteV: [B + 0.4, 0, -G.h, fmtM(G.h)] });
    if (G.lcg > 0) { ct.push({ coteV: [-0.35, 0, -G.hr, fmtM(G.hr)] }); ct.push({ cote: [0, G.lcg, -G.h - 0.35, fmtM(G.lcg)] }); }
    V.push({ id: 'coupe', titre: 'Coupe transversale' + (ropen ? ' (' + res.R.N + ' ' + res.R.prof.nom + ', entraxe ' + fmtM(res.R.ent) + ' m)' : ''), prim: ct });
    return V;
  }
  /* plan de perçage et de cintrage d'une poutrelle (continue sur toute la longueur du tablier) */
  function percage(res) {
    const d = res.d, pc = d.ropen.percage, P = res.R.prof, hp = P.h / 1e3, tf = P.tf / 1e3, Lt = res.Ltot;
    const L0 = -d.cg, L1 = Lt + d.cd;
    const ent = []; for (let x = L0 + pc.espEnt / 2; x < L1 - 0.2; x += pc.espEnt) ent.push(+x.toFixed(4));
    const fer = []; for (let x = L0 + pc.aboutFer; x <= L1 - pc.aboutFer + 1e-9; x += pc.espFer) fer.push(+x.toFixed(4));
    const cfs = res.pe.cf.map((c) => [c.x, c.tot * 100]).sort((a, b) => a[0] - b[0]);
    const cfAt = (x) => { if (x <= cfs[0][0]) return cfs[0][1]; for (let k = 1; k < cfs.length; k++) if (x <= cfs[k][0]) { const [x0, y0] = cfs[k - 1], [x1, y1] = cfs[k]; return x1 > x0 ? y0 + (y1 - y0) * (x - x0) / (x1 - x0) : y1; } return cfs[cfs.length - 1][1]; };
    const zEnt = hp - tf - pc.zEnt, zFer = tf + +d.ropen.ecof + pc.zFer;
    return { L: L1 - L0, x0: L0, ent, fer, zEnt, zFer, rang: pc.rangEnt, dTrouEnt: pc.dTrouEnt, dTrouFer: pc.dTrouFer, cfAt, hp, nTrou: ent.length * 2 + fer.length, pc };
  }
  function vuePercage(res) {
    const pz = percage(res), d = res.d, hp = pz.hp, prim = [], nT = d.travees.length;
    const X = [0]; d.travees.forEach((L) => X.push(X[X.length - 1] + L));
    const ex = 25, yOf = (x) => pz.cfAt(x) / 100 * ex;
    const xs = []; for (let k = 0; k <= 80; k++) xs.push(pz.x0 + pz.L * k / 80);
    prim.push({ p: xs.map((x) => [x, yOf(x)]).concat(xs.slice().reverse().map((x) => [x, yOf(x) - hp])), calque: 'POUTRELLES' });
    pz.ent.forEach((x) => { const y = yOf(x) - (hp - pz.zEnt); prim.push({ c: [x - pz.rang / 2, y, pz.dTrouEnt * 2, 'PERCAGE'] }); prim.push({ c: [x + pz.rang / 2, y, pz.dTrouEnt * 2, 'PERCAGE'] }); });
    pz.fer.forEach((x) => { const y = yOf(x) - (hp - pz.zFer); prim.push({ c: [x, y, pz.dTrouFer * 1.5, 'PERCAGE'] }); });
    X.forEach((x, j) => { prim.push({ l: [x, yOf(x) + 0.5, x, yOf(x) - hp - 0.8, 'AXES'] }); prim.push({ t: [x, yOf(x) + 0.7, (j === 0 || j === nT ? 'C' : 'P') + j, 0.3, 'TEXTE', 'middle'] }); });
    d.travees.forEach((L, i) => { const xm = X[i] + L / 2; prim.push({ t: [xm, yOf(xm) + 0.35, 'cf = ' + fmtM(Math.round(pz.cfAt(xm) * 10) / 10) + ' cm', 0.28, 'TEXTE', 'middle'] }); });
    prim.push({ cote: [pz.x0, pz.x0 + pz.L, -hp - 1.0, 'L = ' + fmtM(pz.L)] });
    return { id: 'percage', titre: 'Poutrelle type ' + res.R.prof.nom + ' : perçage et cintrage (contre-flèche amplifiée ×' + ex + ')', prim, pz };
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function svgVue(v, o = {}) {
    const W = o.w || 760, pad = 34, pts = [], add = (x, y) => pts.push([x, y]);
    for (const p of v.prim) {
      if (p.l) { add(p.l[0], p.l[1]); add(p.l[2], p.l[3]); }
      if (p.p) p.p.forEach(([x, y]) => add(x, y));
      if (p.c) { add(p.c[0] - p.c[2], p.c[1] - p.c[2]); add(p.c[0] + p.c[2], p.c[1] + p.c[2]); }
      if (p.t) add(p.t[0], p.t[1]);
      if (p.cote) { add(p.cote[0], p.cote[2]); add(p.cote[1], p.cote[2]); }
      if (p.coteV) { add(p.coteV[0], p.coteV[1]); add(p.coteV[0], p.coteV[2]); }
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1e-6), (o.hmax || 360) / Math.max(y1 - y0, 1e-6));
    const H = (y1 - y0) * sc + 2 * pad, flip = v.flipY ? 1 : -1;
    const X = (x) => (pad + (x - x0) * sc).toFixed(1), Y = (y) => (flip < 0 ? pad + (y1 - y) * sc : pad + (y - y0) * sc).toFixed(1);
    const col = { COFFRAGE: '#14171f', POUTRELLES: '#2d6be4', AXES: '#c0392b', APPAREILS: '#0f8f7b', PERCAGE: '#a8842a', TEXTE: '#6f7484', COTES: '#6f7484', CACHE: '#9aa0ac' };
    let s = '';
    for (const p of v.prim) {
      if (p.p) s += `<polygon points="${p.p.map(([x, y]) => X(x) + ',' + Y(y)).join(' ')}" fill="${p.calque === 'COFFRAGE' ? 'rgba(168,132,42,.08)' : p.calque === 'CACHE' ? 'none' : 'rgba(45,107,228,.12)'}" stroke="${col[p.calque] || '#14171f'}" stroke-width="${p.calque === 'COFFRAGE' ? 1.3 : 0.8}"${p.calque === 'CACHE' ? ' stroke-dasharray="4 3"' : ''}/>`;
      if (p.l) s += `<line x1="${X(p.l[0])}" y1="${Y(p.l[1])}" x2="${X(p.l[2])}" y2="${Y(p.l[3])}" stroke="${col[p.l[4]] || '#14171f'}" stroke-width=".7"${p.l[4] === 'AXES' ? ' stroke-dasharray="8 3 2 3"' : p.l[4] === 'CACHE' ? ' stroke-dasharray="4 3"' : ''}/>`;
      if (p.c) s += `<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r="${Math.max(1.8, p.c[2] * sc).toFixed(1)}" fill="none" stroke="${col[p.c[3]] || '#14171f'}" stroke-width=".9"/>`;
      if (p.t) s += `<text x="${X(p.t[0])}" y="${Y(p.t[1])}" text-anchor="${p.t[5] || 'start'}" style="font-size:10.5px;fill:#4a4f5c">${esc(p.t[2])}</text>`;
      if (p.cote) { const [a, b, y, t] = p.cote; s += `<line x1="${X(a)}" y1="${Y(y)}" x2="${X(b)}" y2="${Y(y)}" stroke="#6f7484" stroke-width=".6" marker-start="url(#rr-ar)" marker-end="url(#rr-ar)"/><text x="${((+X(a) + +X(b)) / 2).toFixed(1)}" y="${(+Y(y) - 3).toFixed(1)}" text-anchor="middle" style="font-size:10px;fill:#4a4f5c">${esc(t)}</text>`; }
      if (p.coteV) { const [x, a, b, t] = p.coteV; s += `<line x1="${X(x)}" y1="${Y(a)}" x2="${X(x)}" y2="${Y(b)}" stroke="#6f7484" stroke-width=".6" marker-start="url(#rr-ar)" marker-end="url(#rr-ar)"/><text x="${(+X(x) + 4).toFixed(1)}" y="${((+Y(a) + +Y(b)) / 2 + 3).toFixed(1)}" style="font-size:10px;fill:#4a4f5c">${esc(t)}</text>`; }
    }
    return `<svg class="plan" viewBox="0 0 ${W} ${H.toFixed(0)}" role="img" aria-label="${esc(v.titre)}"><defs><marker id="rr-ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 2 L10 5 L0 8z" fill="#6f7484"/></marker></defs>${s}</svg>`;
  }

  /* ══════════════════ 14. Lecture d'un fichier .don d'origine (RODBAN / ROPEN) ══════════════════ */
  function lireDon(txt) {
    const lines = String(txt).replace(/\r/g, '').split('\n'), v = {};
    for (let i = 0; i < lines.length - 1; i++) {
      const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*;/);
      if (!m || lines[i].startsWith(';')) continue;
      if (/^FIN_DICO/.test(lines[i])) break;
      if (!(m[1] in v)) v[m[1]] = lines[i + 1].trim();
      i++;
    }
    const n = (k, def = 0) => { const x = parseFloat(String(v[k] ?? '').replace(',', '.')); return Number.isFinite(x) ? x : def; };
    if (v.application && !/RODBAN|ROPEN/i.test(v.application)) throw new Error('Ce fichier n’est pas un fichier de données RODBAN-ROPEN.');
    const ropen = Math.round(n('typetablier', 0)) === 1;
    const nt = Math.max(1, Math.min(7, Math.round(n('nbtrav', 1))));
    const trav = Array.from({ length: nt }, (_, k) => n('lontrav' + (k + 1)));
    const dG = n('dishouintgcg', 0.5), dD = n('dishouintgcd', 0.5);
    const tG = n('lartrotsupg'), tD = n('lartrotsupd'), lc = n('larchausupg', 3) + n('larchausupd', 3);
    const B = n('demilartabg') + n('demilartabd') || dG + tG + lc + tD + dD;
    const Bs = n('demisoutabg') + n('demisoutabd') || B;
    const hr = n('eprivtabg', 0.25), hcr = hr + n('haurivtabg', 0);
    const biaisApp = Array.from({ length: nt + 1 }, (_, j) => n('biais' + j, n('biais', 100)));
    const ecart = (k, def) => n(k, def);
    const posApp = (nb, d1, eR, eC) => { const y = [d1]; for (let k = 1; k < nb; k++) y.push(y[k - 1] + ((k === 1 || k === nb - 1) ? eR : eC)); return y.map((t) => +t.toFixed(4)); };
    const nC = Math.round(n('nbappfil0', 2)), nP = Math.round(n('nbappfil1', nC));
    const ySym = (y) => { const s = y[y.length - 1] - (B - y[0]); return Math.abs(s) < 0.05 ? y : y; };
    // équipements (côtés gauche et droit supposés symétriques) ; revêtement et étanchéité surfaciques
    const g = (k) => n(k + 'g', 0);
    const kE = [n('kequibetonmax', 1.05), n('kequibetonmin', 0.95)], kP = [n('kprotmax', 1.05), n('kprotmin', 0.95)];
    const equip = [];
    if (g('poigc')) equip.push({ nom: 'Garde-corps', type: 'lin', q: g('poigc'), y: g('distabgc'), sym: true, kmax: kP[0], kmin: kP[1] });
    if (n('poilong')) equip.push({ nom: 'Longrine de garde-corps', type: 'lin', q: n('poilong'), y: n('distablong'), sym: true, kmax: kE[0], kmin: kE[1] });
    if (g('poirem')) equip.push({ nom: 'Remplissage de trottoir', type: 'lin', q: g('poirem'), y: g('distabrem'), sym: true, kmax: kE[0], kmin: kE[1] });
    if (g('poibor')) equip.push({ nom: 'Bordure de trottoir', type: 'lin', q: g('poibor'), y: g('distabbor'), sym: true, kmax: kE[0], kmin: kE[1] });
    if (g('poicorn')) equip.push({ nom: 'Corniche', type: 'lin', q: g('poicorn'), y: g('distabcorn'), sym: true, kmax: n('kequimax', 1.03), kmin: n('kequimin', 0.97) });
    const erev = n('epchausup', 0.06), eet = n('epetan', 0.03);
    if (erev > 0) equip.push({ nom: `Revêtement de chaussée (${erev} m × ${n('poivolrev', 22)} kN/m³)`, type: 'surf', q: +(erev * n('poivolrev', 22)).toFixed(4), y1: dG + tG, y2: dG + tG + lc, kmax: n('krevetmax', 1.4), kmin: n('krevetmin', 0.8) });
    if (eet > 0) equip.push({ nom: `Étanchéité (${eet} m × ${n('poivoletan', 22)} kN/m³)`, type: 'surf', q: +(eet * n('poivoletan', 22)).toFixed(4), y1: dG, y2: B - dD, kmax: n('ketanmax', 1.2), kmin: n('ketanmin', 0.8) });
    const tc = Math.round(n('typchexp', 1)); void tc;
    const d = {
      type: ropen ? 'ropen' : 'rodba', projet: v.projet || '', methode: n('codecal') ? 'plaque' : 'plaque', regl: 'ec',
      travees: trav, cg: n('lonaboutab0'), cd: n('lonaboutabn'), biais: biaisApp[0], biaisApp,
      trans: { dG, tG, lc, tD, dD, Bs, h: n('epdalmoy', n('epdal', 0.6)), hr, hcr: Math.min(hcr, n('epdalmoy', 0.6)) },
      gb: n('poivolbet', 25), equip, den: 0, classe: Math.round(n('classeoa', 1)) === 2 ? 2 : 1,
      charges: { LM1: true, LM2: false, LM4: false, qfk: 5, LM3: '', vitLM3: 'lente', AL: true, Bc: true, Bt: true, Mc80: false, Mc120: true, qtr: 1.5 },
      appareils: { yC: posApp(nC, ecart('dishouapprivcul', 1), ecart('eaxeapprivcul', 2), ecart('eaxeappcencul', 2)), yP: posApp(nP, ecart('dishouapprivpil', 1), ecart('eaxeapprivpil', 2), ecart('eaxeappcenpil', 2)), kv: 0 },
      mat: { fck: n('fc28tab', 32), fe: n('fetab', 500), fissuration: Math.max(0, Math.round(n('fissur', 2)) - 1), dSup: n('dcdgsup', 0.07), dInf: n('dcdginf', 0.07), phi: n('coeffluage', 2) },
      plaque: { nLon: 30, nLar: 24, nu: 0 }, sections: 10,
    };
    d.appareils.yC = ySym(d.appareils.yC); d.appareils.yP = ySym(d.appareils.yP);
    if (ropen) {
      const nom = ((v.profil || 'HE') + ' ' + (v.module || '') + ' ' + (v.serie || '')).replace(/\s+/g, ' ').trim();
      const cat = IN.profiles.get(nom);
      d.ropen = { profil: cat ? cat.nom : 'HEM 450', n: Math.round(n('nbpoutrelles', 10)), nuance: ['S235', 'S275', 'S355', 'S420', 'S460'][Math.round(n('nuapout', 2))] || 'S355', fy: 0,
        ecof: n('epcof', 0.02), AsChap: n('sectionaciersup') * 1e4, AsMinM: 0, dAs: n('dcdgsup', 0.07), nCourt: n('ni', 6), nLong: n('nv', 18), gammaA: 1.0, debLat: n('deblattabpout', 0.1), seuilChap: 0.10,
        percage: { espEnt: n('espent', 4.85), rangEnt: n('esptrouenth', 0.2), dTrouEnt: n('diamtrouent', 0.03), zEnt: n('distsouent', 0.09), espFer: n('espfer', 0.3), dTrouFer: n('diamtroufer', 0.04), zFer: n('distsurcof', 0.05), aboutFer: n('lonaboufer', 0.1) } };
      d.appareils = { yC: null, yP: null, kv: 0 };
      // nombre d'appareils = nombre de poutrelles dans l'exemple d'origine : appareils au droit des poutrelles
      if (nC !== d.ropen.n) d.appareils.yC = posApp(nC, ecart('dishouapprivcul', 1), ecart('eaxeapprivcul', 2), ecart('eaxeappcencul', 2));
      if (nP !== d.ropen.n) d.appareils.yP = posApp(nP, ecart('dishouapprivpil', 1), ecart('eaxeapprivpil', 2), ecart('eaxeappcenpil', 2));
    }
    return d;
  }

  const api = { DEF_RODBA, DEF_ROPEN, LM3, vehLM3, geoTrans, permanentes, normaliser, maillage, plaque, kElem, gMoment, gShear, momentsNoeud, locate, chargePlaque, reaction,
    grille, surface, placeLM1, evalLM1, placeLM2, placeLM3, placeRep, combiner, woodArmer, calcul, exportRephor, exportAppuis, vues, vuePercage, percage, svgVue, lireDon, ALPHA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.rodbanRopen = api; }
})(typeof window !== 'undefined' ? window : globalThis);
