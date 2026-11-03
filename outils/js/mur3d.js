/* MUR3D — tronçon de mur de soutènement en béton armé sur semelle superficielle (moteur pur, sans DOM).
 * Module node (module.exports) et navigateur (window.BA.mur3d). Réutilisé par MURU (outils/js/muru.js).
 *
 * UNITÉS : m, kN, kPa (= kN/m²) ; matériaux en MPa ; sections d'acier en cm²/ml.
 * REPÈRE (coupe transversale d'une tranche) : y horizontal, origine au parement avant du voile au niveau du dessus
 *   de semelle, positif vers le remblai ; z = cote absolue (m). Repère 3D : x le long du mur (0 = section haute,
 *   L = section basse), y, z ; résultantes au centre du rectangle exinscrit de la semelle en sous-face.
 *
 * Méthodes (références) :
 *  - Poussée des terres : méthode des coins de Coulomb généralisée (« Culmann numérique ») sur un écran plan
 *    quelconque, talus brisé jusqu'à 3 pentes, surcharges en bande, nappe (γ' = γsat − γw sous la nappe).
 *    La poussée P(s) est calculée en tout point de l'écran ; p = dP/ds, moment par rapport au pied = ∫P ds.
 *    Coulomb fermé (vérification) : K = cos²(φ−θ) / [cos²θ cos(δ+θ) (1+√(sin(φ+δ)sin(φ−β)/(cos(δ+θ)cos(θ−β))))²].
 *  - Séisme : coefficients kh, kv (EN 1998-5 §7.3.2.2 : kh = α S / r, kv = ±0,5 kh) ; poussée dynamique de
 *    Mononobe-Okabe (EN 1998-5 annexe E, E.2 à E.4), obtenue ici par la même méthode des coins avec gravité inclinée
 *    (identique à M-O pour un talus plan) ; l'incrément dynamique est appliqué à mi-hauteur de l'écran (E.9).
 *  - Fondation superficielle : Fascicule 62 titre V (annexe B / art. B.3) : contrainte de référence q'ref = (3σmax+σmin)/4
 *    sur la surface comprimée (semelle rigide, sol sans traction), q'ref ≤ q'0 + iδ (q'u − q'0)/γq, iδ annexe F1
 *    (sol frottant : iδ = Φ2 + (Φ1 − Φ2)(1 − e^(−De/B)), Φ1 = (1 − δ/90°)², Φ2 = (1 − δ/45°)²) ;
 *    glissement H ≤ N tgφ'/γg (γg = 1,2) + c'A'/1,5 ; décompression limitée (ELS fréquent, ELS rare, ELU).
 *    q'u peut venir d'un sondage pressiométrique (SPS) : q'u − q'0 = kp ple* (Fasc. 62 B.3.?, annexe C1).
 *  - Béton armé : BAEL 91 révisé 99 (+ Livret 2.01 chap. 2A : σs limite saisie) ou EC2 + AN, par BA.sectionBA
 *    (outils/js/bael-ec2.js) ; flexion composée par mètre linéaire.
 */
(function (root) {
  'use strict';
  const S = (typeof module !== 'undefined' && module.exports) ? require('./bael-ec2.js') : (root.BA && root.BA.sectionBA);
  const D2R = Math.PI / 180, GW = 10;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ═══════════════════════ COEFFICIENTS FERMÉS ═══════════════════════ */
  /* Coulomb (angles en degrés) — θ : inclinaison de l'écran sur la verticale, positive quand le parement « surplombe »
   * le remblai (fruit arrière d'un voile qui s'amincit vers le haut : θ > 0) ; β : pente du talus ; δ : obliquité. */
  function coulomb(phi, beta, delta, theta = 0) {
    const f = phi * D2R, b = beta * D2R, d = delta * D2R, t = theta * D2R;
    const s = Math.sin(f + d) * Math.sin(f - b);
    const K = Math.pow(Math.cos(f - t), 2) / (Math.pow(Math.cos(t), 2) * Math.cos(d + t) * Math.pow(1 + Math.sqrt(Math.max(0, s) / (Math.cos(d + t) * Math.cos(t - b))), 2));
    return { K, Kh: K * Math.cos(d + t), Kv: K * Math.sin(d + t) };
  }
  /* Mononobe-Okabe, EN 1998-5 annexe E (E.2) — ψ = 90° − θ (écran), β talus, δ, kh, kv (kv > 0 vers le bas) */
  function mononobeOkabe(phi, beta, delta, theta, kh, kv) {
    const f = phi * D2R, b = beta * D2R, d = delta * D2R, psi = (90 - theta) * D2R;
    const th = Math.atan(kh / (1 + kv));            // kv > 0 : accélération verticale vers le bas (charge (1 + kv) W)
    if (b > f - th) return { K: NaN, theta: th / D2R };
    const num = Math.pow(Math.sin(psi + f - th), 2);
    const g = Math.sqrt(Math.sin(f + d) * Math.sin(f - b - th) / (Math.sin(psi - th - d) * Math.sin(psi + b)));
    const K = num / (Math.cos(th) * Math.pow(Math.sin(psi), 2) * Math.sin(psi - th - d) * Math.pow(1 + g, 2));
    return { K, theta: th / D2R };
  }
  /* coefficient iδ du Fascicule 62 titre V, annexe F1 (δ en degrés) */
  function iDelta(deltaDeg, frottant, DeB) {
    const d = Math.min(Math.abs(deltaDeg), 90), p1 = Math.pow(1 - d / 90, 2);
    if (!frottant) return p1;
    const p2 = Math.pow(Math.max(0, 1 - d / 45), 2);
    return p2 + (p1 - p2) * (1 - Math.exp(-DeB));
  }
  /* kp superficiel (Fasc. 62 titre V annexe C1, tableau) : catégories A/B/C par groupe */
  function kpSup(groupe, cat, DeB, BL) {
    const f = 0.6 + 0.4 * Math.min(1, BL);
    if (groupe === 'argile') return cat === 'A' ? 0.8 * (1 + 0.25 * f * DeB) : 0.8 * (1 + 0.35 * f * DeB);
    if (groupe === 'sable') return cat === 'A' ? 1 + 0.35 * f * DeB : cat === 'B' ? 1 + 0.5 * f * DeB : 1 + 0.8 * f * DeB;
    if (groupe === 'craie') return 1.3 * (1 + 0.27 * f * DeB);
    if (groupe === 'marne') return 1 + 0.27 * f * DeB;
    return 1 + 0.27 * f * DeB; // roche altérée
  }

  /* ═══════════════════════ GÉOMÉTRIE PLANE ═══════════════════════ */
  /* sol : polyligne [[y,z]…] triée en y ; prolongée à gauche par son premier segment, à droite horizontalement */
  function solZ(P, y) {
    if (P.length === 1) return P[0][1];
    if (y <= P[0][0]) { const [a, b] = P; return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0] || 1); }
    for (let i = 0; i < P.length - 1; i++) if (y <= P[i + 1][0]) return P[i][1] + (P[i + 1][1] - P[i][1]) * (y - P[i][0]) / (P[i + 1][0] - P[i][0] || 1);
    return P[P.length - 1][1];
  }
  const polyArea = (Q) => { let a = 0; for (let i = 0; i < Q.length; i++) { const [x1, y1] = Q[i], [x2, y2] = Q[(i + 1) % Q.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
  function polyCentroid(Q) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < Q.length; i++) { const [x1, y1] = Q[i], [x2, y2] = Q[(i + 1) % Q.length]; const c = x1 * y2 - x2 * y1; a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c; }
    a /= 2; return Math.abs(a) < 1e-12 ? { A: 0, y: 0, z: 0 } : { A: Math.abs(a), y: cx / (6 * a), z: cy / (6 * a) };
  }
  /* découpe d'un polygone par z < zc (Sutherland–Hodgman) */
  function clipBelow(Q, zc) {
    const out = [];
    for (let i = 0; i < Q.length; i++) {
      const A = Q[i], B = Q[(i + 1) % Q.length], ia = A[1] < zc, ib = B[1] < zc;
      if (ia) out.push(A);
      if (ia !== ib) { const t = (zc - A[1]) / (B[1] - A[1]); out.push([A[0] + t * (B[0] - A[0]), zc]); }
    }
    return out;
  }
  /* poids effectif d'un polygone de sol (kN/ml) et son centre de gravité ; nappe à zw */
  function poidsSol(Q, sol) {
    const c = polyCentroid(Q);
    if (!(c.A > 0)) return { W: 0, y: 0, z: 0, A: 0 };
    const sub = Number.isFinite(sol.zw) ? clipBelow(Q, sol.zw) : [];
    const cs = sub.length >= 3 ? polyCentroid(sub) : { A: 0, y: 0, z: 0 };
    const gs = sol.gsat - GW, Wd = sol.g * (c.A - cs.A), Ws = gs * cs.A;
    const yd = c.A - cs.A > 1e-12 ? (c.y * c.A - cs.y * cs.A) / (c.A - cs.A) : 0, zd = c.A - cs.A > 1e-12 ? (c.z * c.A - cs.z * cs.A) / (c.A - cs.A) : 0;
    const W = Wd + Ws;
    return { W, y: W > 0 ? (Wd * yd + Ws * cs.y) / W : c.y, z: W > 0 ? (Wd * zd + Ws * cs.z) / W : c.z, A: c.A };
  }
  /* intersection du rayon C + t(cosρ, sinρ), t > 0, avec le sol ; renvoie {y, z, k} (k : indice du sommet précédent) */
  function rayonSol(P, C, rho) {
    const c = Math.cos(rho), s = Math.sin(rho);
    if (c <= 1e-9) return null;
    const m = s / c, f = (y) => solZ(P, y) - (C[1] + (y - C[0]) * m);
    let y0 = C[0], f0 = f(y0);
    if (f0 <= 0) return null;
    const xs = P.map((p) => p[0]).filter((y) => y > y0 + 1e-12);
    for (const y1 of xs) {
      const f1 = f(y1);
      if (f1 <= 0) { const y = y0 + (y1 - y0) * f0 / (f0 - f1); return { y, z: solZ(P, y) }; }
      y0 = y1; f0 = f1;
    }
    // au-delà du dernier sommet : sol horizontal
    if (m <= 1e-12) return null;
    const zl = P[P.length - 1][1], y = C[0] + (zl - C[1]) / m;
    return y > y0 ? { y, z: zl } : null;
  }

  /* ═══════════════════════ MÉTHODE DES COINS (CULMANN NUMÉRIQUE) ═══════════════════════
   * o = {T:[y,z] tête de l'écran (sur le sol), B:[y,z] pied, sol:{phi, g, gsat, zw, P:[[y,z]…]}, delta (°),
   *      q:[{y1,y2,q}] surcharges en bande (kN/m² sur l'horizontale), kh, kv (séisme, kv > 0 vers le bas), n}
   * Le remblai est du côté y croissant. Renvoie s (abscisses le long de l'écran depuis la tête), P(s) (kN/ml),
   * u : direction de la force du sol sur l'écran, rho : angle critique au pied, et l'intégrale ∫P ds (moment au pied). */
  function coin(o, C) {
    const sol = o.sol, phi = sol.phi * D2R, d = (o.delta || 0) * D2R;
    const T = o.T, L = Math.hypot(T[0] - C[0], T[1] - C[1]);
    if (L < 1e-9) return { P: 0, rho: NaN };
    const dv = [(T[0] - C[0]) / L, (T[1] - C[1]) / L];             // le long de l'écran, vers le haut
    let ns = [dv[1], -dv[0]]; if (ns[0] < 0) ns = [-ns[0], -ns[1]]; // normale vers le remblai
    const uP = [Math.cos(d) * ns[0] + Math.sin(d) * dv[0], Math.cos(d) * ns[1] + Math.sin(d) * dv[1]];
    const kh = o.kh || 0, kv = o.kv || 0;
    const ev = (rho) => {
      const I = rayonSol(sol.P, C, rho);
      if (!I) return -Infinity;
      const Q = [C, T];
      for (const p of sol.P) if (p[0] > T[0] + 1e-9 && p[0] < I.y - 1e-9) Q.push(p);
      Q.push([I.y, I.z]);
      let W = poidsSol(Q, sol).W;
      for (const b of o.q || []) { const a = Math.max(b.y1, T[0]), c = Math.min(b.y2, I.y); if (c > a) W += b.q * (c - a); }
      // forces sur le coin : W(−kh, −(1+kv)) [inertie vers l'écran], P·uP, R·uR ; R incliné de φ sur la normale
      const np = [-Math.sin(rho), Math.cos(rho)], e = [Math.cos(rho), Math.sin(rho)];
      const uR = [Math.cos(phi) * np[0] + Math.sin(phi) * e[0], Math.cos(phi) * np[1] + Math.sin(phi) * e[1]];
      const Fx = -kh * W, Fz = -(1 + kv) * W;
      const det = uP[0] * uR[1] - uP[1] * uR[0];
      if (Math.abs(det) < 1e-12) return -Infinity;
      return (-Fx * uR[1] + Fz * uR[0]) / det;                    // P (solution de Cramer)
    };
    let best = -Infinity, rb = NaN;
    for (let a = 1; a < 89.6; a += 1.5) { const v = ev(a * D2R); if (v > best) { best = v; rb = a; } }
    if (Number.isFinite(rb)) {                                     // affinage (section dorée locale)
      let lo = Math.max(0.5, rb - 1.5) * D2R, hi = Math.min(89.9, rb + 1.5) * D2R;
      for (let i = 0; i < 22; i++) { const m1 = hi - (hi - lo) * 0.618, m2 = lo + (hi - lo) * 0.618; if (ev(m1) > ev(m2)) hi = m2; else lo = m1; }
      const v = ev((lo + hi) / 2); if (v > best) { best = v; rb = (lo + hi) / 2 / D2R; }
    }
    return { P: Math.max(0, best), rho: rb, uP };
  }
  function culmann(o) {
    const n = o.n || 24, T = o.T, B = o.B, L = Math.hypot(T[0] - B[0], T[1] - B[1]);
    const s = [0], P = [0];
    let u = null, rho = NaN;
    for (let k = 1; k <= n; k++) {
      const t = k / n, C = [lerp(T[0], B[0], t), lerp(T[1], B[1], t)];
      const r = coin(o, C); s.push(t * L); P.push(r.P); u = r.uP; rho = r.rho;
    }
    for (let k = 1; k < P.length; k++) P[k] = Math.max(P[k], P[k - 1]);   // P(s) non décroissante
    let I = 0; for (let k = 1; k <= n; k++) I += (P[k] + P[k - 1]) / 2 * (s[k] - s[k - 1]);
    if (!u) { const dv = [(T[0] - B[0]) / (L || 1), (T[1] - B[1]) / (L || 1)]; u = [dv[1], -dv[0]]; }
    // force exercée PAR le sol SUR l'écran : −P·uP
    return { s, P, L, I, rho, f: [-u[0], -u[1]], T, B };
  }
  /* résultante d'une courbe P(s) entre la tête et l'abscisse sc (écran supérieur au-dessus d'une section) :
   * force (Fy, Fz) et point d'application sur l'écran. Moment au point sc : cosδ∫P ds ⇒ position s̄ = sc − ∫P/P */
  function resultante(cu, sc = cu.L) {
    const { s } = cu, Pm = cu.Py || cu.P;
    let Ps = 0, I = 0, Pz = 0;
    for (let k = 1; k < s.length; k++) {
      const a = s[k - 1], b = Math.min(s[k], sc); if (b <= a) break;
      const t = (b - a) / (s[k] - a), pa = Pm[k - 1], pb = pa + (Pm[k] - pa) * t;
      I += (pa + pb) / 2 * (b - a); Ps = pb;
      if (cu.Pz) Pz = cu.Pz[k - 1] + (cu.Pz[k] - cu.Pz[k - 1]) * t;
    }
    const sb = Math.abs(Ps) > 1e-12 ? sc - I / Ps : sc;
    const t = sb / cu.L, y = lerp(cu.T[0], cu.B[0], t), z = lerp(cu.T[1], cu.B[1], t);
    if (cu.Py) return { F: Math.hypot(Ps, Pz), Fy: -Ps, Fz: -Pz, y, z };   // modèle Livret : composantes exactes
    return { F: Ps, Fy: Ps * cu.f[0], Fz: Ps * cu.f[1], y, z };
  }

  /* ═══════════════════════ MODÈLE ANALYTIQUE « LIVRET 2.01 » (talus brisé, surcharges) ═══════════════════════
   * Écran T (tête, sur le terrain) → B (pied) ; profondeur comptée verticalement. Identifié sur les notes de calcul
   * d'origine (MUR3D, édition 2011) et conforme au principe du Livret 2.01 (édition 2004) :
   *  - terres : chaque pente j du talus, prolongée jusqu'à l'écran, donne σv,j(z) (γ au-dessus de la nappe, γsat − γw
   *    dessous) et un coefficient (Kh,j ; Kv,j) ; la pression est Kj σv,j sous la profondeur où la droite inclinée à
   *    45° + φ/2 issue du début de la pente j recoupe l'écran, K(j−1) σv,(j−1) au-dessus ;
   *  - surcharge q en bande [y1, y2] au niveau du terrain zl : p = Ka q avec Ka = tan²(45° − φ/2) (terrain horizontal,
   *    pas de composante verticale), nulle au-dessus de zl − a tanφ, croissant linéairement jusqu'à zl − a tan(45° + φ/2),
   *    constante ensuite, arrêtée à zl − (y2 − ys) tan(45° + φ/2) (a = y1 − ys, ys abscisse de l'écran) ;
   *    une surcharge uniforme sur le talus est découpée par pente (une bande par pente).
   * Kfun(beta°) → [Kh, Kv]. Renvoie une courbe cumulée compatible avec resultante(). */
  function ecranLivret(o) {
    const { T, B, sol } = o, P = sol.P, n = o.n || 200, phi = sol.phi * D2R;
    const t45 = Math.tan(Math.PI / 4 + phi / 2), tphi = Math.tan(phi), Ka = Math.pow(Math.tan(Math.PI / 4 - phi / 2), 2);
    const L = Math.hypot(T[0] - B[0], T[1] - B[1]), H = T[1] - B[1], ys = T[0];
    const yAt = (z) => T[0] + (B[0] - T[0]) * (T[1] - z) / (H || 1);
    const segs = [];
    for (let j = 0; j < P.length - 1; j++) if (P[j + 1][0] > ys + 1e-9) segs.push(j);
    const pend = (j) => (P[j + 1][1] - P[j][1]) / (P[j + 1][0] - P[j][0]);
    const sv = (j, z) => { const y = yAt(z), zg = P[j][1] + pend(j) * (y - P[j][0]), h = Math.max(0, zg - z), hw = Math.max(0, Math.min(h, sol.zw - z)); return sol.g * (h - hw) + (sol.gsat - GW) * hw; };
    const K = segs.map((j) => o.Kfun(Math.atan(pend(j)) / D2R));
    const ramp = (z, zl, a, step) => { if (a <= 1e-12) return 1; const e0 = zl - a * (step ? t45 : tphi), e1 = zl - a * t45; return z > e0 ? 0 : z > e1 ? (e0 - z) / (e0 - e1) : 1; };
    const pres = (z) => {
      let ph = 0, pv = 0;
      if (o.terres !== false && segs.length) {
        let kh = K[0][0] * sv(segs[0], z), kv = K[0][1] * sv(segs[0], z);
        for (let i = 1; i < segs.length; i++) {
          const j = segs[i], w = ramp(z, P[j][1], P[j][0] - ys, true);
          kh += w * (K[i][0] * sv(j, z) - K[i - 1][0] * sv(segs[i - 1], z)); kv += w * (K[i][1] * sv(j, z) - K[i - 1][1] * sv(segs[i - 1], z));
        }
        ph += kh; pv += kv;
      }
      for (const b of o.q || []) {
        const y1 = Math.max(b.y1, ys), y2 = b.y2; if (y2 <= y1) continue;
        const zl = solZ(P, y1), a = y1 - ys;
        ph += Ka * b.q * (ramp(z, zl, a, false) - (y2 < 1e3 ? ramp(z, zl, y2 - ys, true) : 0));
      }
      return [ph, pv];
    };
    const s = [0], Py = [0], Pz = [0];
    let Iy = 0, Fy = 0, Fz = 0;
    for (let k = 1; k <= n; k++) {
      const za = T[1] - H * (k - 1) / n, zb = T[1] - H * k / n, pa = pres(za), pb = pres(zb), dz = H / n;
      Fy += (pa[0] + pb[0]) / 2 * dz; Fz += (pa[1] + pb[1]) / 2 * dz;
      s.push(L * k / n); Py.push(Fy); Pz.push(Fz);
    }
    const F = Math.hypot(Fy, Fz) || 1, f = [-Fy / F, -Fz / F];
    void Iy;
    return { s, P: Py.map((v, k) => Math.hypot(v, Pz[k])), Py, Pz, L, I: 0, f, T, B, Fy, Fz };
  }
  /* découpe d'une surcharge uniforme sur le talus en une bande par pente (Livret 2.01) */
  const bandesParPente = (P, ys, q) => { const L = []; for (let j = 0; j < P.length - 1; j++) if (P[j + 1][0] > ys + 1e-9) L.push({ y1: P[j][0], y2: j === P.length - 2 ? 1e4 : P[j + 1][0], q }); return L; };

  /* ═══════════════════════ GÉOMÉTRIE D'UNE TRANCHE ═══════════════════════ */
  /* g : tranche interpolée. Champs : zsem, es (épaisseur semelle), p (patin), B (largeur), e0 (voile en pied),
   *   fav, far (fruits, m/m), zc (couronnement), ec, hc (couronnement), zav (remblai avant), talus [[y,z]…],
   *   beche {e, h, y}. */
  /* cote du couronnement : palier horizontal de longueur lch côté haut et lcb côté bas, pente entre les deux */
  function zCour(d, t) {
    const L = +d.L || 1, x = t * L, a = +d.lch || 0, b = L - (+d.lcb || 0), zh = +d.haute.zc, zb = +d.basse.zc;
    if (!(b > a)) return lerp(zh, zb, t);
    return x <= a ? zh : x >= b ? zb : zh + (zb - zh) * (x - a) / (b - a);
  }
  function tranche(d, t) {
    const H = d.haute, Bs = d.basse, I = (k) => lerp(+H[k] || 0, +Bs[k] || 0, t);
    const g = { zsem: d.zsem, es: I('es'), p: I('patin'), B: I('B'), e0: I('ep'), fav: d.fav / 100, far: d.far / 100,
      zc: zCour(d, t), ec: d.ec, hc: d.hc, zav: I('zav'), bec: { e: I('bece'), h: I('bech'), y: I('becy') } };
    g.zf = g.zsem - g.es;
    const n = Math.max(H.talus.length, Bs.talus.length);
    g.talus = []; for (let i = 0; i < n; i++) { const a = H.talus[Math.min(i, H.talus.length - 1)], b = Bs.talus[Math.min(i, Bs.talus.length - 1)]; g.talus.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); }
    g.talus.sort((a, b) => a[0] - b[0]);
    g.yt = g.B - g.p;                                               // extrémité du talon (écran fictif)
    g.Hv = g.zc - g.hc - g.zsem;                                    // hauteur du fût trapézoïdal
    g.yf = (z) => g.fav * (z - g.zsem);                             // parement avant
    g.yb = (z) => g.e0 - g.far * (z - g.zsem);                      // parement arrière
    g.ep = (z) => g.yb(z) - g.yf(z);
    return g;
  }
  /* béton du voile au-dessus de la cote z0 (polygone) et de la semelle */
  function polyVoile(g, z0 = g.zsem) {
    const zt = g.zsem + g.Hv;
    const Q = [[g.yf(z0), z0], [g.yb(z0), z0], [g.yb(zt), zt]];
    if (g.hc > 0) { const yfT = g.yf(zt); Q.push([yfT + g.ec, zt], [yfT + g.ec, g.zc], [yfT, g.zc]); }
    Q.push([g.yf(zt), zt]);
    return Q;
  }
  const polySemelle = (g) => [[-g.p, g.zf], [g.yt, g.zf], [g.yt, g.zsem], [-g.p, g.zsem]];

  /* ═══════════════════════ CHARGES ÉLÉMENTAIRES D'UNE TRANCHE (par ml) ═══════════════════════
   * Chaque action : liste de forces {Fy, Fz, y, z} (kN/ml) ; cas : G (poids propre), GT (terres : talon, patin,
   * poussée), W (eau), Q (exploitation sur talus), QP (exploitation sur remblai avant), QC (chantier),
   * E (séisme, deux sens de kv). */
  function chargesTranche(d, g, opt = {}) {
    const sol = { phi: d.sol.phi, g: d.sol.g, gsat: d.sol.gsat, zw: d.eau.am, P: null };
    const gb = d.beton.g, out = {};
    // ── poids propre (voile, semelle, bêche), poussée d'Archimède incluse dans l'action eau ──
    const pv = polyCentroid(polyVoile(g)), ps = polyCentroid(polySemelle(g));
    const G = [{ Fy: 0, Fz: -gb * pv.A, y: pv.y, z: pv.z }, { Fy: 0, Fz: -gb * ps.A, y: ps.y, z: ps.z }];
    if (g.bec.e > 0 && g.bec.h > 0) G.push({ Fy: 0, Fz: -gb * g.bec.e * g.bec.h, y: g.bec.y + g.bec.e / 2, z: g.zf - g.bec.h / 2 });
    out.G = G;
    // ── sol arrière : polyligne du terrain à partir du parement arrière ──
    const zTop = g.zsem + g.Hv;
    // intersection du parement arrière avec le terrain (le terrain ne dépasse pas le couronnement)
    let zi = g.zsem, lo = g.zsem, hi = g.zc;
    const fz = (z) => solZ(g.talus, g.yb(Math.min(z, zTop))) - z;
    if (fz(hi) >= 0) zi = hi; else { for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (fz(m) > 0) lo = m; else hi = m; } zi = (lo + hi) / 2; }
    const yTete = g.yb(Math.min(zi, zTop));
    sol.P = [[yTete, zi]].concat(g.talus.filter((p) => p[0] > yTete + 1e-9));
    g.solP = sol.P; g.zTete = zi;
    // terre sur talon : entre parement arrière, dessus de semelle, écran fictif et terrain
    const zt = solZ(sol.P, g.yt);
    const Qt = [[g.yb(g.zsem), g.zsem], [g.yt, g.zsem], [g.yt, zt]];
    for (let i = sol.P.length - 1; i >= 0; i--) if (sol.P[i][0] < g.yt - 1e-9) Qt.push(sol.P[i]);
    // le parement arrière entre z_i et le dessus de semelle
    const wt = poidsSol(Qt, sol);
    const GT = [{ Fy: 0, Fz: -wt.W, y: wt.y, z: wt.z, nom: 'talon' }];
    // terre sur patin (remblai avant)
    const solAv = { g: d.sol.g, gsat: d.sol.gsat, zw: d.eau.av };
    if (g.zav > g.zsem && g.p > 0) {
      const Qp = [[-g.p, g.zsem], [0, g.zsem], [0, g.zav], [-g.p, g.zav]];   // rectangle sur le patin (comme le programme d'origine)
      const wp = poidsSol(Qp, solAv); GT.push({ Fy: 0, Fz: -wp.W, y: wp.y, z: wp.z, nom: 'patin' });
    }
    // ── poussée sur l'écran fictif (stabilité, talon) ──
    const ecr = { T: [g.yt, zt], B: [g.yt, g.zf], sol, n: opt.n || 20 };
    const livret = d.options.modele === 'livret';
    const Kecr = (beta) => { const b = clamp(beta, -d.sol.phi + 0.01, d.sol.phi - 0.01), lam = lamLivret(d, g, zt);
      const a = coulomb(d.sol.phi, b, +d.options.delta0 || 2 * d.sol.phi / 3), c = coulomb(d.sol.phi, b, b);
      return [lam * a.Kh + (1 - lam) * c.Kh, lam * a.Kv + (1 - lam) * c.Kv]; };
    const cuL = livret
      ? (extra) => ecranLivret(Object.assign({}, ecr, { Kfun: Kecr, terres: !(extra.q || extra.kh), q: extra.q }))
      : (extra) => mixe(d, g, sol.P, (dl) => culmann(Object.assign({}, ecr, extra, { delta: dl })));
    const cu = cuL({});
    const r0 = resultante(cu);   // (Livret : composantes exactes Fy, Fz)
    GT.push({ Fy: r0.Fy, Fz: r0.Fz, y: r0.y, z: r0.z, nom: 'poussée' });
    out.GT = GT; out.poussee = { cu, delta: cu.delta, Ph: -r0.Fy, Pv: -r0.Fz, Kh: -r0.Fy / (0.5 * d.sol.g * Math.pow(zt - g.zf, 2)), Kv: -r0.Fz / (0.5 * d.sol.g * Math.pow(zt - g.zf, 2)) };
    // ── eau : poussée hydrostatique amont sur l'écran fictif, aval sur le parement du patin, sous-pression ──
    const W = [];
    const uAm = GW * Math.max(0, d.eau.am - g.zf), uAv = GW * Math.max(0, d.eau.av - g.zf);
    if (uAm > 0) W.push({ Fy: -uAm * uAm / (2 * GW), Fz: 0, y: g.yt, z: g.zf + uAm / GW / 3 });
    if (uAv > 0) W.push({ Fy: uAv * uAv / (2 * GW), Fz: 0, y: -g.p, z: g.zf + uAv / GW / 3 });
    const Bw = g.B;
    if (uAm > 0 || uAv > 0) {
      const U = (uAm + uAv) / 2 * Bw, yU = -g.p + (uAv + 2 * uAm) / (3 * (uAv + uAm)) * Bw;
      W.push({ Fy: 0, Fz: U, y: yU, z: g.zf });
    }
    // poids de l'eau au-dessus de la semelle côté remblai : déjà pris par γsat − γw + γw (on ajoute γw·volume immergé)
    const imm = (Q, zw) => { const c = Number.isFinite(zw) ? clipBelow(Q, zw) : []; return c.length >= 3 ? polyCentroid(c) : { A: 0, y: 0, z: 0 }; };
    const iT = imm(Qt, d.eau.am); if (iT.A > 0) W.push({ Fy: 0, Fz: -GW * iT.A, y: iT.y, z: iT.z });
    if (g.zav > g.zsem && g.p > 0) { const iP = imm([[-g.p, g.zsem], [0, g.zsem], [0, g.zav], [-g.p, g.zav]], d.eau.av); if (iP.A > 0) W.push({ Fy: 0, Fz: -GW * iP.A, y: iP.y, z: iP.z }); }
    out.W = W;
    // ── exploitation sur talus (bande) : poids sur le talon + supplément de poussée ──
    const surch = (bandes, key, bTalon) => {
      const L = [];
      for (const b of bTalon || bandes) { const a = Math.max(b.y1, yTete), c = Math.min(b.y2, g.yt); if (c > a) L.push({ Fy: 0, Fz: -b.q * (c - a), y: (a + c) / 2, z: solZ(sol.P, (a + c) / 2), nom: 'sur talon' }); }
      const cq = cuL({ q: bandes });
      const dq = livret ? cq : { s: cq.s, P: cq.P.map((v, k) => Math.max(0, v - cu.P[k])), L: cq.L, f: cq.f, T: cq.T, B: cq.B };
      const r = resultante(dq); if (r.F > 1e-9) L.push({ Fy: r.Fy, Fz: r.Fz, y: r.y, z: r.z, nom: 'poussée' });
      out[key + 'cu'] = dq; return L;
    };
    const yq = d.q.y + (+d.q.dydx || 0) * g.x;
    out.Q = d.q.exp > 0 && d.q.larg > 0 ? surch([{ y1: yq, y2: yq + d.q.larg, q: d.q.exp }], 'Q') : [];
    out.QC = d.q.chantier > 0 ? surch(livret ? bandesParPente(sol.P, g.yt, d.q.chantier) : [{ y1: yTete, y2: 1e4, q: d.q.chantier }], 'QC', [{ y1: yTete, y2: 1e4, q: d.q.chantier }]) : [];
    out.QP = d.q.av > 0 && g.p > 0 ? [{ Fy: 0, Fz: -d.q.av * g.p, y: -g.p / 2, z: g.zav }] : [];
    // ── séisme : inertie du mur et du sol sur talon + incrément dynamique de poussée (M-O, à mi-hauteur) ──
    out.E = [];
    if (d.seisme.kh > 0) {
      for (const sgn of [1, -1]) {
        const kh = d.seisme.kh, kv = sgn * d.seisme.kv, L = [];
        const mass = G.concat([GT[0]]);
        for (const f of mass) L.push({ Fy: kh * f.Fz, Fz: kv * f.Fz, y: f.y, z: f.z });   // Fz < 0 : inertie vers l'avant (−y)
        const ce = livret ? culmann(Object.assign({}, ecr, { delta: cu.delta || 0, kh, kv })) : cuL({ kh, kv });
        const c0 = livret ? culmann(Object.assign({}, ecr, { delta: cu.delta || 0 })) : cu;
        const dP = Math.max(0, ce.P[ce.P.length - 1] - c0.P[c0.P.length - 1]);
        if (dP > 0) L.push({ Fy: dP * ce.f[0], Fz: dP * ce.f[1], y: g.yt, z: (zt + g.zf) / 2, nom: 'ΔPAE' });
        out[sgn > 0 ? 'E1' : 'E2'] = L;
      }
    }
    out.yTete = yTete; out.zt = zt; out.sol = sol;
    return out;
  }
  /* obliquité de la poussée sur l'écran fictif vertical passant par l'extrémité du talon :
   *  'beta'    : δ = pente du terrain au droit de l'écran (hypothèse de Rankine, sol contre sol) ;
   *  nombre    : δ imposé (degrés) ;
   *  'origine' : pondération identifiée sur les notes de calcul d'origine — P = λ P(δ0) + (1 − λ) P(δ = β) avec
   *              λ = 1 − ℓtalon·tan(45° + φ/2)/H (part de l'écran située sous le coin de Rankine issu du talon,
   *              δ0 = 2φ/3 par défaut). Cette règle reproduit les coefficients d'origine à quelques % près. */
  /* pondération δ0 / δ = β identifiée sur les notes d'origine : λ = 1 − c·ℓtalon/H (c = 2,12) */
  function lamLivret(d, g, zt) { const H = zt - g.zf, talon = Math.max(0, g.yt - g.yb(g.zsem)); return clamp(1 - (+d.options.cLambda || 2.12) * talon / H, 0, 1); }
  function mixe(d, g, P, run) {
    const yt = g.yt, h = 0.01, b = Math.atan((solZ(P, yt + h) - solZ(P, yt - h)) / (2 * h)) / D2R;
    const bb = clamp(b, -d.sol.phi, d.sol.phi), mode = d.options.deltaFictif;
    if (mode === 'origine') {
      const H = solZ(P, yt) - g.zf, talon = Math.max(0, yt - g.yb(g.zsem));
      const lam = clamp(1 - talon * Math.tan((45 + d.sol.phi / 2) * D2R) / H, 0, 1);
      const d0 = +d.options.delta0 || 2 * d.sol.phi / 3;
      const a = run(d0), c = run(bb);
      // combinaison des forces vectorielles : direction et intensité moyennes pondérées
      const Fy = (k) => lam * a.P[k] * a.f[0] + (1 - lam) * c.P[k] * c.f[0], Fz = (k) => lam * a.P[k] * a.f[1] + (1 - lam) * c.P[k] * c.f[1];
      const kN = a.P.length - 1, F = Math.hypot(Fy(kN), Fz(kN)) || 1, f = [Fy(kN) / F, Fz(kN) / F];
      const Pm = a.P.map((_, k) => Fy(k) * f[0] + Fz(k) * f[1]);
      return Object.assign({}, a, { P: Pm, f, lam, delta: Math.atan2(-f[1], -f[0]) / D2R });
    }
    const dl = mode === 'beta' || mode === undefined ? bb : +mode;
    return Object.assign(run(dl), { delta: dl });
  }

  /* ═══════════════════════ COMBINAISONS ═══════════════════════
   * Coefficients : poids propre G (favorable/défavorable), terres GT (×(1±Δ) pondération du poids volumique),
   * eau W, exploitation Q (talus), QP (remblai avant), chantier QC, séisme E. */
  function combinaisons(d) {
    const ec = d.regl === 'EC', out = [], dg = d.sol.dg;
    // Livret 2.01 (chap. 1, tableaux des combinaisons) : trafic ferroviaire γ = 1,45 ; autres actions variables
    // 1,5 × 1,07 = 1,605 à l'ELU et 1,2 à l'ELS rare. EN 1990 A2 (AN) + NF P 94-281 approche 2 : 1,45 (trafic), 1,35.
    const gQ = 1.45, gV = ec ? 1.35 : 1.605, rV = ec ? 1 : 1.2;
    const psi1 = d.q.type === 'route' ? 0.75 : d.q.voies === 2 ? 0.6 : 0.8;
    const add = (nom, type, c) => out.push(Object.assign({ no: out.length + 1, nom, type, G: 1, W: 1 }, c));
    const K = [[1 - dg, 1 - dg], [1 + dg, 1 + dg], [1 + dg, 1 - dg]];      // (talon + poussée, patin)
    const VAR = (g) => [['', {}], [' + Q', { Qw: gQ * g, Qp: gQ * g }], [' + Q + q av.', { Qw: gQ * g, Qp: gQ * g, QP: gV * g }],
      [' + chantier', { Cp: gV * g }], [' + chantier + q av.', { Cp: gV * g, QP: gV * g }], [' + chantier (talon)', { Cp: gV * g, Cw: gV * g }],
      [' + chantier (talon) + q av.', { Cp: gV * g, Cw: gV * g, QP: gV * g }]];
    for (const [kt, kp] of K.slice(0, 2)) add(`ELS fréquent, terres ×${kt}`, 'ELSf', { Tt: kt, Tp: kp, Tpou: kt, Qw: psi1, Qp: psi1 });
    for (const [n, v] of VAR(1)) for (const [kt, kp] of K.slice(0, 2)) {   // ordre des notes d'origine (3 à 16)
      const c = Object.assign({ Tt: kt, Tp: kp, Tpou: kt }, v);
      for (const k of ['QP', 'Cp', 'Cw']) if (c[k]) c[k] = rV;
      if (c.Qw) { c.Qw = 1; c.Qp = 1; }
      add(`ELS rare${n}, terres ×${kt}`, 'ELSr', c);
    }
    const GAM = [[1, 1, 1], [1, 1, 1.35], [1, 1.35, 1.35], [1.35, 1.35, 1.35]];   // (G, talon, patin)
    for (const [gG, gt, gp] of GAM) for (const [n, v] of VAR(1)) for (const [kt, kp] of K)
      add(`ELU G×${gG}, terres ×${gt}/${gp}${n}, ×${kt}`, 'ELU', Object.assign({ G: gG, Tt: gt * kt, Tp: gp * kp, Tpou: 1.35 * kt }, v));
    if (d.seisme.kh > 0) for (const e of ['E1', 'E2']) for (const [kt, kp] of K.slice(0, 2))
      add(`ELU sismique (${e === 'E1' ? 'kv ↓' : 'kv ↑'}), terres ×${kt}`, 'ELUs', { Tt: kt, Tp: kp, Tpou: kt, [e]: 1 });
    return out;
  }
  /* somme des forces d'une tranche pour une combinaison (la poussée des terres peut avoir son propre coefficient) */
  const COEF = { G: (f) => 'G', GT: (f) => (f.nom === 'talon' ? 'Tt' : f.nom === 'patin' ? 'Tp' : 'Tpou'), W: () => 'W',
    Q: (f) => (f.nom === 'sur talon' ? 'Qw' : 'Qp'), QC: (f) => (f.nom === 'sur talon' ? 'Cw' : 'Cp'), QP: () => 'QP', E1: () => 'E1', E2: () => 'E2' };
  function forcesComb(ch, c) {
    const F = [];
    for (const key in COEF) for (const f of ch[key] || []) { const k = c[COEF[key](f)]; if (k) F.push({ Fy: f.Fy * k, Fz: f.Fz * k, y: f.y, z: f.z, nom: f.nom, cas: key }); }
    return F;
  }

  /* ═══════════════════════ CONTRAINTES SOUS UNE SEMELLE RIGIDE (sol sans traction) ═══════════════════════
   * cells : [{x, y, A}] ; N > 0 compression, moments au point (0,0) : Mx = Σ N·y, My = Σ N·x (repère de la grille).
   * Recherche de σ = a + b x + c y, σ ≥ 0, équilibrant N, Σσy, Σσx (Newton). */
  function sigmaSemelle(cells, N, Sy, Sx) {
    const A = cells.reduce((t, c) => t + c.A, 0);
    if (!(N > 0)) return { ok: false, v: [0, 0, 0], decomp: 100 };
    const F = (v) => {
      let n = 0, my = 0, mx = 0, J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (const c of cells) {
        const s = v[0] + v[1] * c.x + v[2] * c.y; if (s <= 0) continue;
        n += s * c.A; my += s * c.y * c.A; mx += s * c.x * c.A;
        const g = [1, c.x, c.y];
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) J[i][j] += g[i] * g[j] * c.A;
      }
      return { r: [n - N, mx - Sx, my - Sy], J: [J[0], J[1], J[2]] };
    };
    // départ élastique linéaire (section entièrement comprimée)
    let v = [N / A, 0, 0];
    { const r = F([1e9, 0, 0]); const J = r.J.map((row) => row.slice()); const sol = solve3(J, [N, Sx, Sy]); if (sol) v = sol; }
    for (let it = 0; it < 80; it++) {
      const { r, J } = F(v);
      if (Math.abs(r[0]) < 1e-7 * N && Math.abs(r[1]) < 1e-7 * N && Math.abs(r[2]) < 1e-7 * N) break;
      // J est la matrice des dérivées de (n, mx, my) par rapport à (a, b, c) : lignes (n, mx, my) ↔ g = (1, x, y)
      const Jm = [[J[0][0], J[0][1], J[0][2]], [J[1][0], J[1][1], J[1][2]], [J[2][0], J[2][1], J[2][2]]];
      const dv = solve3(Jm, r.map((x) => -x));
      if (!dv) return { ok: false, v, decomp: 100 };
      let t = 1; const v0 = v.slice();
      v = v0.map((x, i) => x + t * dv[i]);
      if (it > 60) return { ok: false, v, decomp: 100 };
    }
    let Ac = 0; for (const c of cells) if (v[0] + v[1] * c.x + v[2] * c.y > 0) Ac += c.A;
    return { ok: true, v, decomp: 100 * (1 - Ac / A), Ac };
  }
  function solve3(M, b) {
    const a = M.map((r, i) => r.concat([b[i]]));
    for (let k = 0; k < 3; k++) {
      let p = k; for (let i = k + 1; i < 3; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
      if (Math.abs(a[p][k]) < 1e-14) return null; [a[p], a[k]] = [a[k], a[p]];
      for (let i = k + 1; i < 3; i++) { const f = a[i][k] / a[k][k]; for (let j = k; j < 4; j++) a[i][j] -= f * a[k][j]; }
    }
    const x = [0, 0, 0];
    for (let i = 2; i >= 0; i--) { let s = a[i][3]; for (let j = i + 1; j < 3; j++) s -= a[i][j] * x[j]; x[i] = s / a[i][i]; }
    return x;
  }

  /* limite de la contrainte de référence (Fasc. 62 titre V) */
  function qrefLim(o) {
    const id = iDelta(o.delta, o.frottant, o.DeB);
    return { iD: id, lim: o.q0 + id * (o.qu - o.q0) / o.gq };
  }

  /* ═══════════════════════ DIMENSIONNEMENT D'UNE SECTION RECTANGULAIRE (par ml) ═══════════════════════
   * Réutilise BA.sectionBA : ELU (diagramme rectangulaire en BAEL, parabole-rectangle en EC2), ELS (section fissurée).
   * sec : {h, dSup, dInf} (hauteurs utiles depuis la fibre supérieure) ; elu, els : [{N (compr. +), M (>0 comprime la
   * fibre inférieure : tend la nappe supérieure)}] ; o : {regl, fck, fyk, ssLim (MPa), n, Amin (cm²/ml), livret} */
  /* enveloppe : on ne conserve que les combinaisons extrêmes (moment maxi de chaque signe, avec l'effort normal mini) */
  function enveloppe(L) {
    const keep = new Set();
    const f = L.filter((c) => Math.abs(c.M) > 1e-6 || Math.abs(c.N) > 1e-6);
    for (const sg of [1, -1]) {
      const g = f.filter((c) => sg * c.M > 0); if (!g.length) continue;
      keep.add(g.reduce((a, b) => (sg * b.M > sg * a.M ? b : a)));
      keep.add(g.reduce((a, b) => (sg * b.M - 0.1 * b.N * 0.1 > sg * a.M - 0.1 * a.N * 0.1 ? b : a)));
      keep.add(g.reduce((a, b) => (Math.abs(b.M) / Math.max(1, b.N) > Math.abs(a.M) / Math.max(1, a.N) ? b : a)));
    }
    return [...keep];
  }
  function ferrailler(sec, elu0, els0, o) {
    const elu = enveloppe(elu0), els = enveloppe(els0);
    const regl = o.regl === 'EC' ? 'EC2' : 'BAEL';
    const mat = S.materiau({ regl, fck: o.fck, fyk: o.fyk, fissuration: o.fiss ?? 1, livret: !!o.livret, diagramme: regl === 'BAEL' ? 'rect' : 'pr' });
    if (Number.isFinite(o.ssLim) && o.ssLim > 0) mat.ssLim = o.ssLim;
    const matCD = o.livret ? Object.assign({}, mat, { livret: false }) : mat;
    const base = { b: 1, h: sec.h, nappes: [{ d: sec.dSup, As: 0 }, { d: sec.dInf, As: 0 }] };
    const geo0 = S.rect(base);
    let As = [0, 0], cas = ['', ''];
    const lign = { elu: [0, 0], els: [0, 0] };
    for (const c of elu) {
      if (!(Math.abs(c.M) > 1e-6 || Math.abs(c.N) > 1e-6)) continue;
      // Livret 2.01 chap. 2A : réduction 0,8 fe/γs aux combinaisons fondamentales de longue durée seulement ; les
      // combinaisons avec action variable de courte durée (type 3, « < 1 h ») gardent fe/γs (comme le programme d'origine)
      const r = S.dimELU2(base, geo0, (c.type || 1) === 3 ? matCD : mat, { N: c.N, M: c.M, type: c.type || 1 }, false);
      for (let i = 0; i < 2; i++) if (r.As[i] > As[i]) { As[i] = r.As[i]; lign.elu[i] = r.As[i]; cas[i] = c.nom || ''; }
    }
    // minimum (aciers de construction et non-fragilité BAEL A.4.2 / EC2 §9.2.1.1)
    const Amin = [0, 1].map((i) => {
      const dd = i === 0 ? sec.h - sec.dSup : sec.dInf;
      const nf = regl === 'EC2' ? Math.max(0.26 * mat.fctm / mat.fyk, 0.0013) * dd * 1e4 : 0.23 * mat.ftj / mat.fyk * dd * 1e4;
      const tendue = elu.concat(els).some((c) => (i === 0 ? c.M > 1e-6 : c.M < -1e-6));
      return Math.max(+o.Amin || 0, tendue ? nf : 0);
    });
    As = As.map((v, i) => Math.max(v, Amin[i]));
    // ELS : contrainte des aciers tendus puis du béton
    const st = (A, c) => S.els(S.rect({ b: 1, h: sec.h, nappes: [{ d: sec.dSup, As: A[0] }, { d: sec.dInf, As: A[1] }] }), mat, { N: c.N, M: c.M, n: o.n || 15 });
    const bis = (f, lo, hi) => { if (f(lo)) return lo; if (!f(hi)) return null; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; } return hi; };
    let scMax = 0, ssMax = 0;
    for (let pass = 0; pass < 2; pass++) for (const c of els) {
      if (!(Math.abs(c.M) > 1e-6 || Math.abs(c.N) > 1e-6)) continue;
      const iT = c.M >= 0 ? 0 : 1, iC = 1 - iT;
      const ssL = regl === 'EC2' ? (c.qp ? Infinity : mat.ssLim) : mat.ssLim;
      if (Number.isFinite(ssL)) {
        const okT = (a) => { const A = As.slice(); A[iT] = a; return -st(A, c).ssMin <= ssL + 1e-6; };
        if (!okT(As[iT])) { const a = bis(okT, As[iT], 400); if (a !== null) { As[iT] = a; lign.els[iT] = Math.max(lign.els[iT], a); } }
      }
      const scL = c.qp ? mat.sbcQP : mat.sbc;
      const okC = (a) => { const A = As.slice(); A[iC] = a; return st(A, c).sc <= scL + 1e-6; };
      if (!okC(As[iC])) { const a = bis(okC, As[iC], 400); if (a !== null) As[iC] = a; }
    }
    for (const c of els) { if (!(Math.abs(c.M) > 1e-6 || Math.abs(c.N) > 1e-6)) continue; const e = st(As, c); scMax = Math.max(scMax, e.sc); ssMax = Math.max(ssMax, -e.ssMin); }
    return { As, Amin, lign, cas, sc: scMax, ss: ssMax, sbc: mat.sbc, ssLim: mat.ssLim, mat };
  }
  /* effort tranchant d'une dalle (par ml) sans armatures d'effort tranchant : BAEL A.5.2.2 (τu ≤ 0,07 fcj/γb) /
   * EC2 §6.2.2 (VRd,c) — renvoie aussi At/st si nécessaire (cm²/m²) */
  function tranchant(V, h, d, o, Asl = 0, N = 0) {
    const regl = o.regl === 'EC' ? 'EC2' : 'BAEL';
    if (regl === 'EC2') {
      const r = S.tranchantEC2({ bw: 1, h, d, Asl, N, V, fck: o.fck, fyk: o.fyk, gc: 1.5, gs: 1.15, element: 'dalle', cot: 2.5 });
      return { tau: Math.abs(V) / (d * 1000), lim: r.VRdc / (d * 1000), At: r.sansArm ? 0 : r.Asw, ok: r.ok, VRdc: r.VRdc };
    }
    const tau = Math.abs(V) / (d * 1000), lim = 0.07 * o.fck / 1.5;
    const At = tau <= lim ? 0 : (tau - 0.3 * (0.6 + 0.06 * o.fck)) / (0.9 * o.fyk / 1.15) * 1e4; // A.5.1.23 (k = 1), cm²/m²
    return { tau, lim, At: Math.max(0, At), ok: tau <= Math.min(0.15 * o.fck / 1.5, 4) };
  }

  /* ═══════════════════════ CALCUL COMPLET ═══════════════════════ */
  function normaliser(d) {
    const x = JSON.parse(JSON.stringify(d));
    x.nsec = clamp(Math.round(+x.nsec || 10), 2, 20);
    x.sol.dg = +x.sol.dg || 0;
    x.eau = x.eau || {}; x.eau.am = Number.isFinite(+x.eau.am) && x.eau.am !== '' ? +x.eau.am : -Infinity; x.eau.av = Number.isFinite(+x.eau.av) && x.eau.av !== '' ? +x.eau.av : -Infinity;
    x.seisme = x.seisme || { kh: 0, kv: 0 }; x.options = x.options || {};
    return x;
  }
  /* fond : {qu (MPa) | sps:{couches}, frottant, mu (tgφ'), c (kPa), kv (kPa/m), gq:{els, elu, acc}, De} */
  function calc(d0) {
    const d = normaliser(d0), L = +d.L, n = d.nsec, dx = L / n, alertes = [];
    const tr = [];
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, g = tranche(d, t);
      g.x = (k + 0.5) * dx; g.k = k;
      if (g.Hv <= 0) throw new Error(`Tranche ${k + 1} : hauteur de voile nulle ou négative.`);
      if (g.ep(g.zsem + g.Hv) < 0.05) alertes.push(`Tranche ${k + 1} : épaisseur du voile en tête < 5 cm (fruits trop forts).`);
      g.ch = chargesTranche(d, g, { n: d.options.nCoins || 16 });
      tr.push(g);
    }
    // ── semelle en plan : origine au parement avant du voile, section haute ; grille de cellules ──
    const cells = [], ny = 24;
    for (const g of tr) for (let j = 0; j < ny; j++) { const y = -g.p + (j + 0.5) * g.B / ny; cells.push({ x: g.x, y, A: dx * g.B / ny, k: g.k }); }
    const Aplan = cells.reduce((s, c) => s + c.A, 0);
    const xg = cells.reduce((s, c) => s + c.A * c.x, 0) / Aplan, yg = cells.reduce((s, c) => s + c.A * c.y, 0) / Aplan;
    const zf = d.zsem - Math.max(...tr.map((g) => g.es));
    const combs = combinaisons(d);
    // ── résultantes par combinaison (au centre de gravité de la semelle en sous-face) ──
    const res = combs.map((c) => {
      let N = 0, Hy = 0, Mx = 0, My = 0, Mz = 0;
      const parTr = tr.map((g) => {
        const F = forcesComb(g.ch, c);
        let n1 = 0, h1 = 0, m1 = 0;
        for (const f of F) { n1 += -f.Fz; h1 += f.Fy; m1 += -f.Fz * (f.y - yg) + f.Fy * (f.z - g.zf); } // ∫σ(y − yg) : équilibre des moments en sous-face
        N += n1 * dx; Hy += h1 * dx; Mx += m1 * dx; My += n1 * dx * (g.x - xg); Mz += h1 * dx * (g.x - xg);
        return { N: n1, H: h1, M: m1, F };
      });
      return Object.assign({}, c, { N, Hy, Mx, My, Mz, parTr });
    });
    // ── contraintes sous semelle ──
    const cs = cells.map((c) => ({ x: c.x - xg, y: c.y - yg, A: c.A, k: c.k }));
    const gq = Object.assign({ els: 3, elu: 2, acc: 1.5 }, d.fond.gq || {});
    const B0 = Math.min(...tr.map((g) => g.B)), B1 = Math.max(...tr.map((g) => g.B)), Bm = Aplan / L;
    // terrain définitif : moyenne des niveaux de remblai avant des sections haute et basse (comme le programme d'origine)
    const zdef = (+d.haute.zav + +d.basse.zav) / 2;
    const q0 = d.fond.q0 !== undefined && d.fond.q0 !== '' ? +d.fond.q0 : d.sol.g * Math.max(0, zdef - zf) / 1000;
    const De = +d.fond.De || Math.max(0, zdef - zf);
    let qu = +d.fond.qu;
    let geo = null;
    if (d.fond.sps && d.fond.sps.couches && d.fond.sps.couches.length) { geo = portanceSPS(d.fond.sps, zf, Bm, L, De); qu = geo.qu + q0; }
    for (const r of res) {
      const st = sigmaSemelle(cs, r.N, r.Mx, r.My);
      r.sig = st; r.decomp = st.decomp;
      const sv = cs.map((c) => Math.max(0, st.v[0] + st.v[1] * c.x + st.v[2] * c.y));
      r.smax = Math.max(...sv) / 1000; r.smin = Math.min(...sv) / 1000;
      r.coins = [[0, -tr[0].p], [0, tr[0].yt], [L, tr[n - 1].yt], [L, -tr[n - 1].p]].map(([x, y]) => Math.max(0, st.v[0] + st.v[1] * (x - xg) + st.v[2] * (y - yg)) / 1000);
      // σmax, σmin aux sommets de la semelle (contrainte linéaire tronquée à 0), comme le programme d'origine
      r.smax = Math.max(r.smax, ...r.coins); r.smin = Math.min(...r.coins);
      r.q34 = (3 * r.smax + r.smin) / 4;
      r.delta = Math.atan2(Math.abs(r.Hy), r.N) / D2R;
      const gqv = r.type === 'ELUs' ? gq.acc : r.type === 'ELU' ? gq.elu : gq.els;
      const ql = qrefLim({ delta: r.delta, frottant: !!d.fond.frottant, DeB: De / Bm, q0, qu, gq: gqv });
      r.iD = ql.iD; r.qlim = ql.lim;
      // glissement (Fasc. 62 B.3.? : H ≤ N tgφ'/1,2 + c' A'/1,5) — ELU seulement
      const Ac = (st.Ac || 0);
      r.Hlim = r.N * (+d.fond.mu || 0) / 1.2 + (+d.fond.c || 0) * Ac / 1.5;
      // torsion (glissement en rotation) autour des extrémités haute et basse de la semelle (milieu de la largeur)
      const rot = (xp, yp) => { let Mr = 0, Mt = 0; cs.forEach((c, i) => { Mr += sv[i] * c.A * Math.hypot(c.x - xp, c.y - yp); }); return Mr * (+d.fond.mu || 0) / 1.2; };
      const pH = [0 - xg, (tr[0].yt - tr[0].p) / 2 - yg], pB = [L - xg, (tr[n - 1].yt - tr[n - 1].p) / 2 - yg];
      r.MtH = { M: Math.abs(r.Mz + r.Hy * (0 - 0) - r.Hy * pH[0]), lim: rot(pH[0], pH[1]) };
      r.MtB = { M: Math.abs(r.Mz - r.Hy * pB[0]), lim: rot(pB[0], pB[1]) };
      // rotation de la semelle (σ = kv w) — déplacement en tête (ELS fréquent)
      r.rot = (st.v[2] || 0) / (+d.fond.kv || 1e9);
    }
    // ── vérifications ──
    const pick = (type, f) => { const L2 = res.filter((r) => type.includes(r.type)); return L2.length ? L2.reduce((a, b) => (f(b) > f(a) ? b : a)) : null; };
    const v = {};
    const lim = d.limites;
    v.elsSol = pick(['ELSr', 'ELSf'], (r) => r.q34 / r.qlim);
    v.elsDecF = pick(['ELSf'], (r) => r.decomp);
    v.elsDecR = pick(['ELSr'], (r) => r.decomp);
    v.eluSol = pick(['ELU', 'ELUs'], (r) => r.q34 / r.qlim);
    v.eluRen = pick(['ELU', 'ELUs'], (r) => r.decomp);
    v.eluGli = pick(['ELU', 'ELUs'], (r) => Math.abs(r.Hy) / r.Hlim);
    v.eluTH = pick(['ELU', 'ELUs'], (r) => r.MtH.M / r.MtH.lim);
    v.eluTB = pick(['ELU', 'ELUs'], (r) => r.MtB.M / r.MtB.lim);
    const verifs = [
      { nom: 'ELS de mobilisation du sol', r: v.elsSol, par: "q'ref (MPa)", val: v.elsSol.q34, adm: v.elsSol.qlim },
      { nom: 'ELS décompression (fréquent)', r: v.elsDecF, par: 'Décompression (%)', val: v.elsDecF.decomp, adm: lim.decFreq },
      { nom: 'ELS décompression (rare)', r: v.elsDecR, par: 'Décompression (%)', val: v.elsDecR.decomp, adm: lim.decRare },
      { nom: 'ELU de mobilisation du sol', r: v.eluSol, par: "q'ref (MPa)", val: v.eluSol.q34, adm: v.eluSol.qlim },
      { nom: 'ELU de renversement', r: v.eluRen, par: 'Décompression (%)', val: v.eluRen.decomp, adm: lim.decELU },
      { nom: 'ELU de glissement', r: v.eluGli, par: "H ≤ N tgφ'/1,2 + c'A'/1,5 (kN)", val: Math.abs(v.eluGli.Hy), adm: v.eluGli.Hlim },
      { nom: 'Glissement en rotation (s. haute)', r: v.eluTH, par: 'Mz (kN·m)', val: v.eluTH.MtH.M, adm: v.eluTH.MtH.lim },
      { nom: 'Glissement en rotation (s. basse)', r: v.eluTB, par: 'Mz (kN·m)', val: v.eluTB.MtB.M, adm: v.eluTB.MtB.lim },
    ].map((x) => Object.assign(x, { ok: x.val <= x.adm + 1e-9, comb: x.r.no }));
    // ── béton armé : voile, patin, talon par tranche ──
    const ba = baMur(d, tr, res, cs, xg, yg);
    // ── déplacement en tête (ELS fréquent) : rotation de la semelle + flexion du voile (E = Ei/rapmod) ──
    const Hmax = Math.max(...tr.map((g) => g.zc)) - zf;
    const deplac = res.filter((r) => r.type === 'ELSf').map((r) => {
      let umax = 0;
      tr.forEach((g, k) => {
        const vo = voileTranche(d, g, res.find((x) => x.no === r.no).parTr[k], r, 0, true);
        umax = Math.max(umax, Math.abs(r.rot) * (g.zc - g.zf) + vo.fleche);
      });
      return { no: r.no, rot: Math.abs(r.rot) * 1000, u: umax * 1000, lim: (+lim.deplac || 0.01) * Hmax * 1000 };
    });
    const ok = verifs.every((x) => x.ok) && deplac.every((x) => x.u <= x.lim) && ba.ok;
    return { d, tr, combs, res, verifs, deplac, ba, plan: { L, Aplan, xg, yg, zf, Bm, B0, B1 }, fond: { q0, qu, De, zdef, geo, gq }, ok, alertes: alertes.concat(ba.alertes) };
  }

  /* efforts dans le voile d'une tranche au niveau z = zsem + h (par ml) pour une combinaison c :
   * N (compression +), M (> 0 tend le parement arrière… convention : M > 0 comprime le parement avant), V */
  function voileEfforts(d, g, c, h) {
    const z0 = g.zsem + h, gb = d.beton.g;
    const pv = polyCentroid(polyVoile(g, z0));
    const yc = (g.yf(z0) + g.yb(z0)) / 2;
    let N = 0, M = 0, V = 0;
    const addF = (Fy, Fz, y, z) => { N += -Fz; V += Fy; M += Fz * (y - yc) - Fy * (z - z0); };   // M > 0 : parement avant comprimé
    const kG = c.G || 0;
    addF(0, -gb * pv.A * kG, pv.y, pv.z);
    // poussée sur le parement arrière au-dessus de z0 (δ = δvoile)
    const cuV = g.cuV, sc = Math.min(cuV.L, Math.max(0, (g.zTete - z0) / Math.cos(Math.atan(g.far))));
    const kP = c.Tpou || 0;
    if (z0 < g.zTete) {
      const r = resultante(cuV, sc); addF(r.Fy * kP, r.Fz * kP, r.y, r.z);
      for (const [key, kk] of [['cuVQ', c.Qp], ['cuVC', c.Cp]]) if (kk && g[key]) { const rq = resultante(g[key], sc); addF(rq.Fy * kk, rq.Fz * kk, rq.y, rq.z); }
      // eau amont sur le parement (si nappe au-dessus de z0)
      if ((c.W || 0) && d.eau.am > z0) { const hw = d.eau.am - z0; addF(-GW * hw * hw / 2, 0, g.yb(z0), z0 + hw / 3); }
      // séisme : inertie du voile + incrément dynamique (mi-hauteur)
      for (const e of ['E1', 'E2']) if (c[e] && g.cuVE) {
        const kv = (e === 'E1' ? 1 : -1) * d.seisme.kv;
        addF(d.seisme.kh * -gb * pv.A, kv * -gb * pv.A, pv.y, pv.z);
        const H0 = g.zTete - z0, dP = 0.5 * d.sol.g * (1 + kv) * g.KAE * H0 * H0 - 0.5 * d.sol.g * g.KA0 * H0 * H0;
        if (dP > 0) addF(-dP, 0, g.yb(z0 + H0 / 2), z0 + H0 / 2);
      }
    }
    return { N, M, V, h: g.ep(z0), z0 };
  }
  function voileTranche(d, g, pt, c, h, flecheSeule) {
    // flèche en tête du voile (console encastrée dans la semelle) par intégration de M/EI
    const n = 12, H = g.Hv; let th = 0, u = 0, Mprev = null, zprev = null;
    const Ei = 11000 * Math.pow(d.beton.fck, 1 / 3) * 1000 / (d.beton.rapmod || 3);   // kPa (BAEL A.2.1.21 module différé)
    const pts = [];
    for (let i = 0; i <= n; i++) { const z = i * H / n; const e = voileEfforts(d, g, c, z); pts.push({ z, k: e.M / (Ei * Math.pow(e.h, 3) / 12) }); }
    for (let i = 1; i <= n; i++) { const a = pts[i - 1], b = pts[i], dz = b.z - a.z; u += th * dz + dz * dz * (2 * a.k + b.k) / 6; th += dz * (a.k + b.k) / 2; }
    return { fleche: Math.abs(u) + Math.abs(th) * (g.zc - g.zsem - H) };
  }

  function baMur(d, tr, res, cs, xg, yg) {
    const o = { regl: d.regl, fck: d.beton.fck, fyk: d.beton.fyk, ssLim: d.beton.ssLim, n: d.beton.n || 15, fiss: d.beton.fiss, livret: d.regl !== 'EC' && d.beton.livret };
    const enr = d.beton.enrob;   // {avant, arriere, fouille, terre} (m)
    const alertes = [];
    const elsC = res.filter((r) => r.type === 'ELSr' || r.type === 'ELSf'), eluC = res.filter((r) => r.type === 'ELU' || r.type === 'ELUs');
    const typeELU = (r) => (r.type === 'ELUs' ? 5 : (r.Qw || r.Qp || r.Cp || r.Cw || r.QP) ? 3 : 1);
    // courbes de poussée sur le parement arrière (δ voile), par tranche
    for (const g of tr) {
      const sol = g.ch.sol, T = [g.yb(Math.min(g.zTete, g.zsem + g.Hv)), g.zTete], B = [g.yb(g.zsem), g.zsem];
      const dv = +d.options.deltaVoile || 0;
      const liv = d.options.modele === 'livret', th = Math.atan(g.far) / D2R;
      const KV = (beta) => { const c = coulomb(d.sol.phi, clamp(beta, -d.sol.phi + 0.01, d.sol.phi - 0.01), dv, th); return [c.Kh, c.Kv]; };
      g.cuV = liv ? ecranLivret({ T, B, sol, Kfun: KV, n: 120 }) : culmann({ T, B, sol, delta: dv, n: 16 });
      const sur = (q) => { if (liv) return ecranLivret({ T, B, sol, Kfun: KV, terres: false, q, n: 120 }); const c = culmann({ T, B, sol, delta: dv, q, n: 16 }); return { s: c.s, P: c.P.map((v, k) => Math.max(0, v - g.cuV.P[k])), L: c.L, f: c.f, T, B }; };
      if (d.q.exp > 0 && d.q.larg > 0) { const yq = d.q.y + (+d.q.dydx || 0) * g.x; g.cuVQ = sur([{ y1: yq, y2: yq + d.q.larg, q: d.q.exp }]); }
      if (d.q.chantier > 0) g.cuVC = sur(liv ? bandesParPente(sol.P, T[0], d.q.chantier) : [{ y1: T[0], y2: 1e4, q: d.q.chantier }]);
      if (d.seisme.kh > 0) {
        const beta = Math.atan((solZ(sol.P, T[0] + 1) - solZ(sol.P, T[0])) / 1) / D2R, th = Math.atan(g.far) / D2R;
        g.KAE = mononobeOkabe(d.sol.phi, beta, dv, th, d.seisme.kh, d.seisme.kv).K * Math.cos((dv) * D2R) || 0;
        g.KA0 = coulomb(d.sol.phi, beta, dv, th).Kh; g.cuVE = true;
      }
    }
    const fr = [0, 1 / 8, 1 / 4, 1 / 2];
    const voile = tr.map((g) => fr.map((f) => {
      const h = f * g.Hv, z0 = g.zsem + h, ep = g.ep(z0);
      const elu = eluC.map((r) => { const e = voileEfforts(d, g, r, h); return { N: e.N, M: e.M, V: e.V, type: typeELU(r), nom: r.no }; });
      const els = elsC.map((r) => { const e = voileEfforts(d, g, r, h); return { N: e.N, M: e.M, nom: r.no }; });
      // section horizontale : fibre « supérieure » = parement arrière (y croissant), M > 0 comprime le parement avant
      const sec = { h: ep, dSup: enr.arriere, dInf: ep - enr.avant };
      if (sec.dInf <= sec.dSup + 0.02) { alertes.push(`Voile tranche ${g.k + 1} : épaisseur incompatible avec les enrobages.`); return { h, ep, As: [NaN, NaN], ok: false }; }
      // convention moteur sectionBA : M > 0 comprime la fibre inférieure (ici parement avant) → tend le parement arrière
      const fe = ferrailler(sec, elu.map((x) => ({ N: x.N, M: x.M, type: x.type, nom: x.nom })), els.map((x) => ({ N: x.N, M: x.M, nom: x.nom })), Object.assign({}, o, { Amin: d.beton.AminVoile }));
      const Vmax = elu.reduce((a, b) => (Math.abs(b.V) > Math.abs(a.V) ? b : a), { V: 0 });
      const t = tranchant(Vmax.V, ep, ep - enr.arriere, o, fe.As[0]);
      return { h, ep, Ar: fe.As[0], Aav: fe.As[1], sc: fe.sc, ss: fe.ss, tau: t.tau, tauLim: t.lim, At: t.At, Mmax: Math.max(...elu.map((x) => x.M)), ok: fe.sc <= fe.sbc + 1e-6 && t.ok };
    }));
    // ── patin et talon : consoles depuis les parements, réaction du sol de la tranche (plan σ au droit de x) ──
    const sigY = (r, g, y) => Math.max(0, r.sig.v[0] + r.sig.v[1] * (g.x - xg) + r.sig.v[2] * (y - yg));
    const console = (g, r, side) => {
      // side 'patin' : section y = yf(zsem) = 0, partie y < 0 ; 'talon' : y = yb(zsem), partie y > yb
      const yS = side === 'patin' ? 0 : g.yb(g.zsem), y0 = side === 'patin' ? -g.p : yS, y1 = side === 'patin' ? 0 : g.yt;
      let V = 0, M = 0; const m = 20, dy = (y1 - y0) / m;
      for (let i = 0; i < m; i++) { const y = y0 + (i + 0.5) * dy; const s = sigY(r, g, y) * dy; V += s; M += s * (y - yS); }
      // charges descendantes (poids semelle, terres, surcharges) sur la console ; uplift : déjà dans σ (charges nettes)
      const F = r.parTr[g.k].F;
      const loads = [];
      const kG = r.G || 0;
      loads.push({ Fz: -d.beton.g * g.es * (y1 - y0) * kG, y: (y0 + y1) / 2 });
      for (const f of F) {
        if (side === 'patin' && f.nom === 'patin') loads.push({ Fz: f.Fz, y: f.y });
        if (side === 'patin' && f.cas === 'QP') loads.push({ Fz: f.Fz, y: f.y });
        if (side === 'talon' && (f.nom === 'talon' || f.nom === 'sur talon')) loads.push({ Fz: f.Fz, y: f.y });
        if (side === 'talon' && f.nom === 'poussée' && Math.abs(f.y - g.yt) < 1e-6) loads.push({ Fz: f.Fz, y: g.yt });
      }
      // surcharge sur remblai avant (QP) et eau (poids/sous-pression) — sous-pression comptée en charge ascendante
      for (const w of g.ch.W || []) if (r.W && w.Fz !== 0 && w.z > g.zf + 1e-9) { if ((side === 'patin' && w.y < 0) || (side === 'talon' && w.y > yS)) loads.push({ Fz: w.Fz, y: w.y }); }
      if (r.W) { const uAm = GW * Math.max(0, d.eau.am - g.zf), uAv = GW * Math.max(0, d.eau.av - g.zf); for (let i = 0; i < m; i++) { const y = y0 + (i + 0.5) * dy; const u = uAv + (uAm - uAv) * (y + g.p) / g.B; loads.push({ Fz: u * dy, y }); } }
      for (const l of loads) { V += l.Fz; M += l.Fz * (l.y - yS); }
      return { V, M };   // M > 0 : moment ascendant (tend la fibre inférieure du patin)
    };
    const semelles = { patin: [], talon: [] };
    for (const side of ['patin', 'talon']) for (const g of tr) {
      const eff = (r) => console(g, r, side);
      // section verticale de la semelle : fibre « supérieure » = dessus ; M > 0 (sectionBA) comprime la fibre inférieure
      const sec = { h: g.es, dSup: enr.terre, dInf: g.es - enr.fouille };
      const sgn = side === 'patin' ? 1 : -1;   // M(console) < 0 au patin = face inférieure tendue = M(sectionBA) < 0 ; inversé au talon
      const elu = eluC.map((r) => { const e = eff(r); return { N: 0, M: sgn * e.M, V: e.V, type: typeELU(r), nom: r.no }; });
      const els = elsC.map((r) => { const e = eff(r); return { N: 0, M: sgn * e.M, nom: r.no }; });
      const fe = ferrailler(sec, elu, els, Object.assign({}, o, { Amin: d.beton.AminSemelle }));
      const Vmax = elu.reduce((a, b) => (Math.abs(b.V) > Math.abs(a.V) ? b : a), { V: 0 });
      const t = tranchant(Vmax.V, g.es, sec.dInf, o, Math.max(fe.As[0], fe.As[1]));
      const Mels = els.reduce((a, b) => (Math.abs(b.M) > Math.abs(a.M) ? b : a), { M: 0 });
      semelles[side].push({ k: g.k, sup: fe.As[0], inf: fe.As[1], sc: fe.sc, ss: fe.ss, tau: t.tau, tauLim: t.lim, At: t.At, Mels: Mels.M, MelsComb: Mels.nom, Melu: elu.reduce((a, b) => (Math.abs(b.M) > Math.abs(a.M) ? b : a), { M: 0 }).M, ok: fe.sc <= fe.sbc + 1e-6 && t.ok });
    }
    const ok = voile.every((L) => L.every((s) => s.ok !== false)) && semelles.patin.every((s) => s.ok) && semelles.talon.every((s) => s.ok);
    return { voile, fr, patin: semelles.patin, talon: semelles.talon, ok, alertes };
  }

  /* ═══════════════════════ PORTANCE D'APRÈS UN SONDAGE PRESSIOMÉTRIQUE (version minimale) ═══════════════════════
   * Fonction rebranchable : BA.mur3d.portanceSPS = BA.fondatio… si le module FONDATIO est validé.
   * sps : {z (cote tête), couches:[{z (profondeur du toit), pl (pl* MPa), classe:'SB'…}]} ; ple* = moyenne géométrique
   * de pl* entre D et D + 1,5 B (Fasc. 62 annexe C1) ; q'u − q'0 = kp ple*. */
  function portanceSPS(sps, zf, B, L, De) {
    const C = sps.couches.slice().sort((a, b) => a.z - b.z);
    const pl = (z) => { const p = sps.z - z; let c = C[0]; for (const x of C) if (p >= x.z - 1e-9) c = x; return c; };
    const m = 30; let s = 0;
    for (let i = 0; i < m; i++) s += Math.log(Math.max(1e-3, pl(zf - (i + 0.5) * 1.5 * B / m).pl));
    const ple = Math.exp(s / m), c0 = pl(zf - 0.01);
    const cl = String(c0.classe || 'SB').toUpperCase();
    const groupe = { A: 'argile', L: 'argile', S: 'sable', G: 'sable', C: 'craie', M: 'marne', R: 'roche' }[cl[0]] || 'sable';
    const kp = kpSup(groupe, cl[1] || 'B', De / B, B / L);
    return { ple, kp, qu: kp * ple, groupe, categorie: cl[1] || 'B' };   // qu net (MPa) : q'u − q'0 ; q'0 ajouté par l'appelant
  }
  /* lecture minimale d'un .SPS (section $$TVCC) — rebranchable sur BA.sondpres.parse */
  function lireSPS(txt) {
    if (root.BA && root.BA.sondpres && root.BA.sondpres.parse) { try { const s = root.BA.sondpres.parse(txt); const o = s.sps || s; if (o.couches && o.couches.length) return { z: o.z, couches: o.couches.map((c) => ({ z: c.z, pl: c.pl, classe: c.classe, nom: c.nom })) }; } catch (e) { /* lecteur interne */ } }
    const Ls = String(txt).replace(/\r/g, '').split('\n');
    const z = parseFloat((Ls[6] || '').trim().split(/\s+/)[2]) || 0, couches = [];
    const i0 = Ls.findIndex((l) => /\$\$TVCC/.test(l));
    if (i0 >= 0) for (let i = i0 + 1; i < Ls.length; i++) {
      const m = Ls[i].match(/^\s*(-?[\d.,]+)\s+"([^"]*)"\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+(\S+)/);
      if (!m) { if (/\*\*\*/.test(Ls[i])) break; continue; }
      couches.push({ z: +m[1].replace(',', '.'), nom: m[2], pl: +m[3].replace(',', '.'), classe: m[7].replace(/"/g, '') });
    }
    return { z, couches };
  }

  /* ═══════════════════════ LECTURE D'UN FICHIER .don D'ORIGINE (MUR3D) ═══════════════════════ */
  function lireKV(txt) {
    const L = String(txt).replace(/\r/g, '').split('\n'), kv = {};
    for (let i = 0; i < L.length - 1; i++) {
      const l = L[i]; if (/^\s*;/.test(l) || !l.trim()) continue;
      const key = l.split(/[\s;]/)[0].trim().toLowerCase(); if (!key) continue;
      if (!(key in kv)) kv[key] = (L[i + 1] || '').trim();
      i++;
    }
    return kv;
  }
  function donVersDonnees(txt) {
    const k = lireKV(txt), f = (n, def = 0) => { const v = parseFloat(String(k[n] ?? '').replace(',', '.')); return Number.isFinite(v) ? v : def; };
    if (String(k.application || '').toUpperCase().indexOf('MUR3D') < 0 && !('frav' in k)) throw new Error('Ce fichier ne semble pas être un fichier de données MUR3D.');
    const L = f('lonhsem', 10), zsem = f('zsem'), fav = f('frav'), far = f('frar');
    // talus défini dans un repère (u le long du talus, v = ytl perpendiculaire) faisant l'angle angtl (grades) avec la face
    // avant ; dans la coupe d'abscisse x : y = (v + x cos a)/sin a, z = ztl − pente·u avec u = x sin a + y cos a
    const ang = f('angtl', 100) * Math.PI / 200, sa = Math.sin(ang) || 1, ca = Math.cos(ang), cot = ca / sa, pen = f('penlontal', 0);
    const tal = (x) => [0, 1, 2, 3].map((i) => { const y = f('ytl' + i) / sa + x * cot; return [y, f('ztl' + i) - pen * (x * sa + y * ca)]; }).filter((p, i, a) => i === 0 || p[0] > a[i - 1][0]);
    const sec = (h) => ({ es: f(h ? 'ephsem' : 'epbsem'), patin: f(h ? 'larhpat' : 'larbpat'), B: f(h ? 'larhsem' : 'larbsem'), ep: f(h ? 'ephvoi' : 'epbvoi'),
      zc: f(h ? 'zhcour' : 'zbcour'), zav: f(h ? 'zhremav' : 'zbremav'), bece: f(h ? 'ephbec' : 'epbbec'), bech: f(h ? 'hauhbec' : 'haubbec'), becy: 0, talus: tal(h ? 0 : L) });
    const regl = f('reglement', 0) === 1 ? 'EC' : 'LIVRET';
    const typ = f('typfond', 0);
    return {
      projet: [k.projet, k.commentaire].filter(Boolean).join(' — '), regl, L, nsec: f('nbsecmur', 10), zsem, fav, far, lch: f('lonhcour', 0), lcb: f('lonbcour', 0),
      ec: f('epcour', 0.3), hc: f('haucour', 0.2), haute: sec(true), basse: sec(false),
      sol: { phi: f('angfrot', 35), g: f('poivolter', 19), gsat: f('poivoltersat', 22), dg: (f('deltapoivolter', 0) ? 0.05 : 0) },
      eau: { am: f('zeau', -1e9), av: f('zeau', -1e9) },
      // charge d'exploitation : bande biaise ; intensité ramenée à q·sin a (convention du programme d'origine : charge par mètre de voie)
      q: { type: f('typchgexp', 1) === 0 ? 'route' : 'fer', voies: f('typchgexp', 1) === 2 ? 2 : 1, y: f('yexp') / sa, dydx: cot, larg: f('larexp') / sa, exp: f('chgexp') * sa, chantier: f('qchantier'), av: f('qexpav') },
      beton: { fck: f('fcj', 25), fyk: f('fe', 500), n: f('nbael', 15), g: f('poivolbet', 25), rapmod: f('rapmodbet', 3), fiss: f('fissur', 1), livret: f('patrim', 0) === 1,
        ssLim: f('patrim', 0) === 1 ? f('limitefissur', 240) : NaN, enrob: { fouille: f('enrcoffouil', 0.03) + 0.025, terre: f('enrcofterre', 0.025) + 0.03, avant: f('enrcofavant', 0.045) + 0.03, arriere: f('enrcofterre', 0.025) + 0.03 },
        AminVoile: 4, AminSemelle: 3 },
      fond: { type: typ === 0 ? 'superficielle' : typ <= 2 ? 'semi-profonde' : 'profonde', qu: f('qu', 1), mu: f('frotsolsem', 0.6), c: f('cohesolfond', 0), frottant: f('typsolfrot', 0) === 1 || f('typesolfrot', 0) === 1, kv: f('kvdif', 10) * 1000, gq: { els: 3, elu: 2, acc: 1.5 } },
      limites: { decFreq: f('declim1', 0), decRare: f('declim2', 25), decELU: f('renlim', 90), deplac: f('deplaclim', 0.01) },
      seisme: { kh: 0, kv: 0, aN: f('zonseism', 0) > 0 ? f('anseism', 0) : 0 },
      options: { modele: 'livret', deltaFictif: 'origine', delta0: f('angdelta0', 2 * f('angfrot', 35) / 3), deltaVoile: 0 },
      avertissements: typ > 0 ? ['Fondation profonde ou semi-profonde dans le fichier : seule la fondation superficielle est traitée par ce module.'] : [],
    };
  }

  /* ═══════════════════════ JEU DE DONNÉES PAR DÉFAUT ═══════════════════════
   * Cas « fondation superficielle » des exemples d'origine (talus biais ramené dans les coupes droites). */
  function exemple() {
    return {
      projet: 'Mur de soutènement — exemple', regl: 'LIVRET', L: 8.5, nsec: 10, zsem: 52.7, fav: 2, far: 4.66, ec: 0.3, hc: 0.2, lch: 1.0, lcb: 0.5,
      haute: { es: 0.8, patin: 1.8, B: 4.2, ep: 0.75, zc: 59.6, zav: 56.45, bece: 0, bech: 0, becy: 0, talus: [[-13.011, 53.924], [0.707, 59.006], [10.677, 59.47], [20.648, 59.243]] },
      basse: { es: 0.8, patin: 0.8, B: 2.0, ep: 0.517, zc: 56.1, zav: 56.0, bece: 0, bech: 0, becy: 0, talus: [[-4.511, 53.827], [9.207, 58.91], [19.177, 59.373], [29.148, 59.147]] },
      sol: { phi: 35, g: 19, gsat: 22, dg: 0.05 },
      eau: { am: 52.36, av: 52.36 },
      q: { type: 'fer', voies: 1, y: 2.121, dydx: 1, larg: 5.657, exp: 35.355, chantier: 10, av: 10 },
      beton: { fck: 25, fyk: 400, n: 15, g: 25, rapmod: 3, fiss: 1, livret: true, ssLim: 240, enrob: { fouille: 0.055, terre: 0.055, avant: 0.075, arriere: 0.055 }, AminVoile: 4, AminSemelle: 3 },
      fond: { type: 'superficielle', qu: 1.2, mu: 0.6, c: 0, frottant: true, kv: 10000, gq: { els: 3, elu: 2, acc: 1.5 } },
      limites: { decFreq: 0, decRare: 25, decELU: 90, deplac: 0.01 },
      seisme: { kh: 0, kv: 0 },
      options: { modele: 'livret', deltaFictif: 'origine', delta0: 23.333, deltaVoile: 0, nCoins: 16 },
    };
  }
  /* coefficients sismiques EN 1998-5 §7.3.2.2 : kh = α S / r ; kv = ±0,5 kh (avg/ag > 0,6) sinon ±0,33 kh */
  function kSeisme(agR, gammaI, S, r, ratioV = 0.9) {
    const a = agR * gammaI / 9.81, kh = a * S / r;
    return { kh, kv: (ratioV > 0.6 ? 0.5 : 0.33) * kh };
  }

  const api = { coulomb, mononobeOkabe, iDelta, kpSup, qrefLim, culmann, coin, resultante, solZ, polyCentroid, poidsSol, clipBelow,
    tranche, chargesTranche, combinaisons, forcesComb, sigmaSemelle, ferrailler, tranchant, calc, portanceSPS, lireSPS, lireKV,
    donVersDonnees, exemple, kSeisme, mixe, polyVoile, polySemelle, voileEfforts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.mur3d = api; }
})(typeof window !== 'undefined' ? window : globalThis);
