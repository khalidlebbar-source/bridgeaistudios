/* BAEL-EC2 — justification des sections en béton armé (moteur pur, sans DOM).
 *
 * Règlements : EN 1992-1-1 et EN 1992-2 avec annexes nationales françaises (« EC2 »),
 *              BAEL 91 révisé 99 (« BAEL »), option Livret 2.01 chap. 2A (fsu fondamental = 0,8 fe/γs).
 *
 * UNITÉS : longueurs en m, efforts en kN, moments en kN·m, contraintes et matériaux en MPa,
 *          SECTIONS D'ACIER EN cm² (entrées et sorties), Asw/s en cm²/m.
 * SIGNES  : N > 0 compression ; M > 0 comprime la fibre inférieure (convention des anciennes notes) ;
 *           My > 0 comprime les fibres d'abscisse x positive ; contraintes > 0 en compression, < 0 en traction.
 *           Les efforts sont réduits au point de référence de la section (centre de gravité du béton seul,
 *           sauf point imposé pour une section quelconque).
 *
 * ── API (window.BA.sectionBA / module.exports) ─────────────────────────────────────────────────────────
 *  Matériaux
 *    mat = materiau({regl:'EC2'|'BAEL', livret:false, fck, fyk, Es:200000, classe:'B', palier:'incline'|'horizontal',
 *                    diagramme:'pr'|'rect', fissuration:0|1|2 (BAEL), phi (fluage), pieu:{k1,k2,fclim} (option fondations
 *                    profondes, Fasc. 62 titre V), gamma:{fond:[γc,γs], acc:[..], sis:[..]}})
 *    lois(mat, type) → {fc, fy, ec2, ecu, eud, sigC(ε, εmax), sigS(ε)}  ; type ELU : 1 >24h/fondamental, 2 1h–24h,
 *                       3 <1h, 4 accidentel, 5 sismique (en EC2, 1–3 = fondamental).
 *  Géométries (retournent un objet « geo » réutilisable)
 *    rect({b, h, nappes:[{d, As}]})                        d = hauteur utile depuis la fibre supérieure
 *    te({b, hf, bw, h, bi, hi, nappes})                     table b×hf, âme bw, talon facultatif bi×hi (section en I)
 *    cercle({D, a, As, nb})                                 a = distance axe des aciers / parement, nb barres
 *    poly({points:[[x,y]…], barres:[{x,y,As}], nappes:[{n,As (une barre),x1,y1,x2,y2}], ref:{x,y}, grille:60})
 *  Calculs élémentaires
 *    elu(geo, mat, {N, M, My, type})          → {ok, ratio, MRdp, MRdn, MRd, Nmin, Nmax, pivot, eps:{c,s}}
 *    interaction(geo, mat, type, n)           → {pos:[{N,M}], neg:[{N,M}], Nmin, Nmax}  (uniaxial)
 *    contourMxMy(geo, mat, type, N, n)        → [{Mx,My}]                               (flexion déviée)
 *    els(geo, mat, {N, M, My, n})              → {sc, ss:[], ssMin, x, Ac, ok…}  (section fissurée, béton non tendu)
 *    props(geo, n)                            → {A, yG, I (non fissurée homogénéisée), Ifp, Ifn (fissurées, flexion simple)}
 *    wk(geo, mat, etatELS, {c, phi, s, kt, wmax, face})   EC2 §7.3.4
 *    tranchantEC2({...}) / tranchantBAEL({...})          EC2 §6.2, §6.3 ; BAEL A.5.1, A.5.4
 *    secondOrdre(geo, mat, comb, opts)        excentricités additionnelles (EC2 §5.2, 5.8.8 ; BAEL A.4.3.5)
 *  Calcul complet (utilisé par la page, réutilisable par RACBA-RAPO, APPUI, FONDATIO, MUR3D, MURU, RADBAN)
 *    calcul(donnees) → {mat, geo, elu:[…], els:[…], fat:[…], cis:[…], dim:{…}, interaction, verdict, alertes}
 *    donnees = {forme:'rect'|'te'|'cercle'|'poly', mode:'verif'|'dim', regl…, section:{…}, elu:[{N,M,My,V,T,type,Mcp}],
 *               els:[{N,M,My,Mqp,type:0 car|1 QP|2 fréq}], fat:[{M1,N1,M2,N2}], options:{…}}
 *  Utilitaire : svgInteraction(inter, points, opts) → chaîne SVG (sans DOM).
 */
(function (root) {
  'use strict';
  const EPS = 1e-12;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sq = (x) => x * x;

  /* ════════════════════════════ MATÉRIAUX ════════════════════════════ */
  /* EN 1992-1-1 tableau 3.1 : εc2, εcu2, n, fctm, Ecm ; §3.1.7 (3) rectangle λ, η ; §3.2.7 acier (palier incliné, εud = 0,9 εuk, AN). */
  function ec2Beton(fck) {
    const fcm = fck + 8;
    const fctm = fck <= 50 ? 0.3 * Math.pow(fck, 2 / 3) : 2.12 * Math.log(1 + fcm / 10);
    const Ecm = 22000 * Math.pow(fcm / 10, 0.3);
    const ec2 = fck <= 50 ? 2.0e-3 : (2.0 + 0.085 * Math.pow(fck - 50, 0.53)) * 1e-3;
    const ecu2 = fck <= 50 ? 3.5e-3 : (2.6 + 35 * Math.pow((90 - fck) / 100, 4)) * 1e-3;
    const n = fck <= 50 ? 2 : 1.4 + 23.4 * Math.pow((90 - fck) / 100, 4);
    const lam = fck <= 50 ? 0.8 : 0.8 - (fck - 50) / 400;
    const eta = fck <= 50 ? 1 : 1 - (fck - 50) / 200;
    return { fcm, fctm, fctk005: 0.7 * fctm, Ecm, ec2, ecu2, n, lam, eta };
  }
  const CLASSES = { A: { k: 1.05, euk: 0.025 }, B: { k: 1.08, euk: 0.05 }, C: { k: 1.15, euk: 0.075 } };

  function materiau(o = {}) {
    const regl = o.regl === 'BAEL' ? 'BAEL' : 'EC2';
    const fck = +o.fck || 30, fyk = +o.fyk || 500, Es = +o.Es || 200000;
    const m = { regl, livret: !!o.livret, fck, fyk, Es, fissuration: o.fissuration ?? 1, diagramme: o.diagramme || 'pr',
      palier: o.palier || (regl === 'EC2' ? 'incline' : 'horizontal'), classe: o.classe || 'B', phi: o.phi ?? 2 };
    /* Fondations profondes : résistance conventionnelle fc* = min(fck, fclim)/(k1·k2) (Fasc. 62 titre V, NF P 94-262 annexe) */
    m.fc = fck;
    if (o.pieu && o.pieu.actif) {
      const p = o.pieu; m.pieu = { k1: +p.k1 || 1.2, k2: +p.k2 || 1, fclim: +p.fclim || 25 };
      m.fc = Math.min(fck, m.pieu.fclim) / (m.pieu.k1 * m.pieu.k2);
    }
    const b = ec2Beton(m.fc);
    m.beton = b;
    m.EcmAff = ec2Beton(fck).Ecm;          // module affiché (fck) ; le module de calcul des n utilise fc* pour les pieux
    m.Ecm = b.Ecm; m.fctm = b.fctm;
    m.ftj = 0.6 + 0.06 * m.fc;              // BAEL A.2.1.12
    const st = CLASSES[m.classe] || CLASSES.B; m.k = st.k; m.euk = st.euk;
    m.gamma = Object.assign({ fond: [1.5, 1.15], acc: [1.2, 1.0], sis: [1.3, 1.0] }, o.gamma || {});
    if (regl === 'BAEL') m.gamma = Object.assign({ fond: [1.5, 1.15], acc: [1.15, 1.0], sis: [1.3, 1.0] }, o.gamma || {});
    /* ELS : EC2 §7.2 (k1 = 0,6 ; k2 = 0,45 ; k3 = 0,8) ; BAEL A.4.5.2, A.4.5.3 */
    if (regl === 'EC2') {
      m.sbc = 0.6 * m.fc; m.sbcQP = 0.45 * m.fc; m.ssLim = 0.8 * fyk;
    } else {
      m.sbc = 0.6 * m.fc; m.sbcQP = m.sbc;
      const eta = fyk >= 400 ? 1.6 : 1.0;
      const fp = Math.min(2 / 3 * fyk, Math.max(0.5 * fyk, 110 * Math.sqrt(eta * m.ftj)));
      m.ssLim = m.fissuration === 0 ? Infinity : m.fissuration === 1 ? fp : 0.8 * fp;
    }
    m.smoyLim = m.pieu ? 0.3 * m.fc : Infinity; // Fasc. 62 titre V : contrainte moyenne de compression ≤ 0,3 fc*
    return m;
  }
  const famille = (type) => (type === 4 ? 'acc' : type === 5 ? 'sis' : 'fond');

  /* Lois de calcul ELU */
  function lois(mat, type = 1) {
    const [gc, gs] = mat.gamma[famille(type)];
    const B = mat.beton, Es = mat.Es;
    let fc, ec2, ecu, n, eud, fy, ftop;
    if (mat.regl === 'EC2') {
      fc = 1.0 * mat.fc / gc;                         // αcc = 1 (AN française)
      ec2 = B.ec2; ecu = B.ecu2; n = B.n;
      fy = mat.fyk / gs;
      eud = 0.9 * mat.euk;                             // AN : εud = 0,9 εuk
      ftop = mat.palier === 'incline' ? mat.k * fy : fy;
    } else {
      const theta = type === 2 ? 0.9 : (type === 3 || type === 4 || type === 5) ? 0.85 : 1.0;  // BAEL A.4.3.41
      fc = 0.85 * mat.fc / (theta * gc);
      ec2 = 2e-3; ecu = 3.5e-3; n = 2; eud = 10e-3;
      fy = mat.fyk / gs;
      if (mat.livret && famille(type) === 'fond') fy *= 0.8;
      ftop = fy;
    }
    const eyd = fy / Es;
    const euk = mat.regl === 'EC2' ? mat.euk : eud;
    const rect = mat.regl === 'EC2' && mat.diagramme === 'rect';
    const lam = B.lam, eta = B.eta;
    const sigC = (e, emax) => {
      if (e <= 0) return 0;
      if (rect) return e >= (1 - lam) * emax - 1e-15 ? eta * fc : 0;
      if (e >= ec2) return fc;
      return fc * (1 - Math.pow(1 - e / ec2, n));
    };
    const sigS = (e) => {
      const a = Math.abs(e), s = Math.sign(e);
      if (a <= eyd) return Es * e;
      if (ftop === fy) return s * fy;
      return s * Math.min(ftop, fy + (ftop - fy) * (a - eyd) / (euk - eyd));
    };
    return { fc, fy, ec2, ecu, eud, eyd, sigC, sigS, gc, gs, ftd: sigS(eud) };
  }

  /* ════════════════════════════ GÉOMÉTRIES ════════════════════════════
   * Fibres : béton {x, y, A} (m, m²) ; barres {x, y, A (m²), d, nom}. Coordonnées relatives au point de référence, y vers le haut. */
  function strips(zones, nTot) {
    // zones : [{y1 (prof. haut), y2 (prof. bas), w1, w2}] largeur variable linéaire ; renvoie fibres en profondeur
    const H = zones.reduce((s, z) => s + (z.y2 - z.y1), 0) || 1;
    const out = [];
    for (const z of zones) {
      const h = z.y2 - z.y1; if (h <= 0) continue;
      const k = Math.max(8, Math.ceil(nTot * h / H));
      for (let i = 0; i < k; i++) {
        const a = z.y1 + h * i / k, b = z.y1 + h * (i + 1) / k;
        const wa = z.w1 + (z.w2 - z.w1) * (a - z.y1) / h, wb = z.w1 + (z.w2 - z.w1) * (b - z.y1) / h;
        const A = (wa + wb) / 2 * (b - a);
        const yc = A > 0 ? a + (b - a) * (wa + 2 * wb) / (3 * (wa + wb)) : (a + b) / 2;
        out.push({ dep: yc, A, w: (wa + wb) / 2, t: b - a });
      }
    }
    return out;
  }
  function fromZones(kind, zones, nappes, extra = {}) {
    const fib = strips(zones, extra.nStrips || 400);
    const Ac = fib.reduce((s, f) => s + f.A, 0);
    const yG = fib.reduce((s, f) => s + f.A * f.dep, 0) / Ac;        // profondeur du c.d.g. béton
    const h = Math.max(...zones.map((z) => z.y2));
    const conc = fib.map((f) => ({ x: 0, y: yG - f.dep, A: f.A, t: f.t, w: f.w }));
    const bars = (nappes || []).filter((n) => n && Number.isFinite(+n.d) && +n.As > 0).map((n, i) => ({ x: 0, y: yG - n.d, A: n.As * 1e-4, d: +n.d, nom: n.nom || `Nappe ${i + 1}` }));
    const width = (dep) => { for (const z of zones) if (dep >= z.y1 - 1e-12 && dep <= z.y2 + 1e-12) return z.w1 + (z.w2 - z.w1) * (dep - z.y1) / Math.max(z.y2 - z.y1, EPS); return 0; };
    const I = conc.reduce((s, f) => s + f.A * f.y * f.y + f.w * Math.pow(f.t, 3) / 12, 0);
    return Object.assign({ kind, plan: true, conc, bars, yG, h, Ac, Ic: I, width, zones, ref: { x: 0, y: 0 }, yTop: yG, yBot: yG - h }, extra);
  }
  function rect(o) {
    const b = +o.b, h = +o.h;
    if (!(b > 0 && h > 0)) throw new Error('Section rectangulaire : b et h doivent être positifs.');
    return fromZones('rect', [{ y1: 0, y2: h, w1: b, w2: b }], o.nappes, { b, nStrips: o.nStrips });
  }
  function te(o) {
    const b = +o.b, hf = +o.hf || 0, bw = +o.bw, h = +o.h, bi = +o.bi || 0, hi = +o.hi || 0;
    if (!(bw > 0 && h > 0)) throw new Error('Section en T : bw et h doivent être positifs.');
    if (hf + hi > h) throw new Error('Section en T : table + talon plus hauts que la section.');
    const z = [];
    if (hf > 0 && b > 0) z.push({ y1: 0, y2: hf, w1: b, w2: b });
    z.push({ y1: hf, y2: h - hi, w1: bw, w2: bw });
    if (hi > 0 && bi > 0) z.push({ y1: h - hi, y2: h, w1: bi, w2: bi });
    return fromZones('te', z, o.nappes, { b: Math.max(b, bw, bi), bw, hf, hi, bi, bTable: b, nStrips: o.nStrips });
  }
  function cercle(o) {
    const D = +o.D, r = D / 2, a = +o.a, As = +o.As || 0, nb = Math.max(4, Math.round(+o.nb || 20));
    if (!(D > 0)) throw new Error('Section circulaire : diamètre nul.');
    if (!(a > 0 && a < r)) throw new Error('Section circulaire : distance des aciers au parement incohérente.');
    const n = o.nStrips || 400, conc = [];
    const F = (y) => y * Math.sqrt(Math.max(r * r - y * y, 0)) + r * r * Math.asin(clamp(y / r, -1, 1));
    for (let i = 0; i < n; i++) {
      const y1 = -r + D * i / n, y2 = -r + D * (i + 1) / n;
      const A = F(y2) - F(y1);
      // centroïde exact d'une bande : ∫ y·2√(r²−y²) dy = −(2/3)(r²−y²)^(3/2)
      const G = (y) => -(2 / 3) * Math.pow(Math.max(r * r - y * y, 0), 1.5);
      conc.push({ x: 0, y: (G(y2) - G(y1)) / A, A, t: y2 - y1, w: A / (y2 - y1) });
    }
    const rs = r - a, bars = [];
    for (let i = 0; i < nb; i++) {
      const t = -Math.PI / 2 + 2 * Math.PI * i / nb;
      bars.push({ x: rs * Math.cos(t), y: rs * Math.sin(t), A: As * 1e-4 / nb, d: r - rs * Math.sin(t), nom: `Barre ${i + 1}` });
    }
    const width = (dep) => 2 * Math.sqrt(Math.max(r * r - sq(r - dep), 0));
    return { kind: 'cercle', plan: true, conc, bars, yG: r, h: D, D, a, rs, nb, AsTot: As, Ac: Math.PI * r * r, Ic: Math.PI * Math.pow(D, 4) / 64, width, ref: { x: 0, y: 0 }, yTop: r, yBot: -r };
  }
  /* Polygone quelconque (un contour, éventuellement avec des évidements reliés par des segments aller-retour) :
   * découpage exact en cellules d'une grille (Sutherland-Hodgman sur chaque cellule). */
  function polyArea(P) { let a = 0, cx = 0, cy = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; const c = x1 * y2 - x2 * y1; a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c; } a /= 2; return { A: a, x: Math.abs(a) > EPS ? cx / (6 * a) : 0, y: Math.abs(a) > EPS ? cy / (6 * a) : 0 }; }
  function clipHalf(P, inside, inter) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(inter(a, b));
    }
    return out;
  }
  function clipBox(P, x0, x1, y0, y1) {
    const ix = (a, b, X) => [X, a[1] + (b[1] - a[1]) * (X - a[0]) / (b[0] - a[0])];
    const iy = (a, b, Y) => [a[0] + (b[0] - a[0]) * (Y - a[1]) / (b[1] - a[1]), Y];
    let Q = clipHalf(P, (p) => p[0] >= x0, (a, b) => ix(a, b, x0)); if (!Q.length) return Q;
    Q = clipHalf(Q, (p) => p[0] <= x1, (a, b) => ix(a, b, x1)); if (!Q.length) return Q;
    Q = clipHalf(Q, (p) => p[1] >= y0, (a, b) => iy(a, b, y0)); if (!Q.length) return Q;
    return clipHalf(Q, (p) => p[1] <= y1, (a, b) => iy(a, b, y1));
  }
  function poly(o) {
    let P = (o.points || []).map((p) => [+p[0], +p[1]]).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) < 1e-9) P = P.slice(0, -1);
    if (P.length < 3) throw new Error('Section quelconque : au moins trois points de contour.');
    const g = polyArea(P), sgn = Math.sign(g.A) || 1, Ac = Math.abs(g.A);
    if (Ac < 1e-9) throw new Error('Section quelconque : aire nulle.');
    const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
    const ng = Math.max(10, Math.min(200, Math.round(+o.grille || 60)));
    const ref = o.ref && Number.isFinite(+o.ref.x) && Number.isFinite(+o.ref.y) ? { x: +o.ref.x, y: +o.ref.y } : { x: g.x, y: g.y };
    const conc = [];
    const dx = (xmax - xmin) / ng, dy = (ymax - ymin) / ng;
    for (let j = 0; j < ng; j++) {
      const y0 = ymin + j * dy, y1 = y0 + dy;
      const strip = clipBox(P, xmin - 1, xmax + 1, y0, y1); if (strip.length < 3) continue;
      for (let i = 0; i < ng; i++) {
        const x0 = xmin + i * dx, C = clipBox(strip, x0, x0 + dx, y0, y1);
        if (C.length < 3) continue;
        const c = polyArea(C), A = c.A * sgn;
        if (A > 1e-14) conc.push({ x: c.x - ref.x, y: c.y - ref.y, A });
      }
    }
    const bars = [];
    (o.barres || []).forEach((b) => { if (+b.As > 0) bars.push({ x: +b.x - ref.x, y: +b.y - ref.y, A: +b.As * 1e-4, nom: b.nom || `Barre ${bars.length + 1}` }); });
    (o.nappes || []).forEach((n, k) => {
      const nb = Math.round(+n.n || 0); if (!(nb > 0 && +n.As > 0)) return;
      for (let i = 0; i < nb; i++) { const t = nb === 1 ? 0 : i / (nb - 1); bars.push({ x: +n.x1 + (n.x2 - n.x1) * t - ref.x, y: +n.y1 + (n.y2 - n.y1) * t - ref.y, A: +n.As * 1e-4, nom: `N${k + 1}.${i + 1}` }); }
    });
    const Ix = conc.reduce((s, f) => s + f.A * sq(f.y - (g.y - ref.y)), 0) + conc.length * 0; // indicatif
    return { kind: 'poly', plan: false, conc, bars, points: P, ref, Ac, xG: g.x, yG: g.y, Igx: Ix, grille: ng, aireModele: conc.reduce((s, f) => s + f.A, 0) };
  }

  /* ════════════════════════════ INTÉGRATION ════════════════════════════ */
  /* plan de déformation : ε(x,y) = e0 − ky·y + kx·x  (compression > 0) ; N = Σσ A ; Mx = −Σσ A y ; My = Σσ A x (kN, kN·m) */
  function integre(geo, sc, ss, e0, ky, kx = 0) {
    let N = 0, Mx = 0, My = 0, emax = -Infinity;
    for (const f of geo.conc) { const e = e0 - ky * f.y + kx * f.x; if (e > emax) emax = e; }
    for (const f of geo.conc) { const e = e0 - ky * f.y + kx * f.x; const s = sc(e, emax); if (s) { const F = s * f.A * 1000; N += F; Mx -= F * f.y; My += F * f.x; } }
    for (const b of geo.bars) { const e = e0 - ky * b.y + kx * b.x; const F = ss(e) * b.A * 1000; N += F; Mx -= F * b.y; My += F * b.x; }
    return { N, Mx, My };
  }
  /* Plans ultimes paramétrés t ∈ [0,3] (pivots A, B, C — EC2 §6.1 fig. 6.1, BAEL A.4.3.3) pour une direction u (vers les fibres comprimées). */
  function planUltime(geo, L, u, t) {
    const s = (p) => u[0] * p.x + u[1] * p.y;
    let sTop = -Infinity, sBot = Infinity;
    for (const f of geo.conc) { const v = s(f.x !== undefined ? f : f) + (f.t && geo.plan ? Math.abs(u[1]) * f.t / 2 : 0); if (v > sTop) sTop = v; const w = s(f) - (f.t && geo.plan ? Math.abs(u[1]) * f.t / 2 : 0); if (w < sBot) sBot = w; }
    if (geo.points) { sTop = -Infinity; sBot = Infinity; for (const p of geo.points) { const v = u[0] * (p[0] - geo.ref.x) + u[1] * (p[1] - geo.ref.y); sTop = Math.max(sTop, v); sBot = Math.min(sBot, v); } }
    else if (geo.kind === 'cercle') { sTop = geo.D / 2; sBot = -geo.D / 2; }
    else if (geo.plan) { sTop = u[1] > 0 ? geo.yTop : -geo.yBot; sBot = u[1] > 0 ? geo.yBot : -geo.yTop; }
    let sSt = sBot; if (geo.bars.length) sSt = Math.min(...geo.bars.map(s));
    if (sSt >= sTop - 1e-6) sSt = sBot;
    const H = sTop - sBot, { ecu, ec2, eud } = L;
    let eT, g; // ε(s) = eT − g (sTop − s)
    if (t <= 1) { eT = -eud + t * (eud + ecu); g = (eT + eud) / (sTop - sSt); }
    else if (t <= 2) {
      const eb1 = ecu - (ecu + eud) * H / (sTop - sSt);
      const eb = eb1 * (2 - t); eT = ecu; g = (eT - eb) / H;
    } else {
      const sC = sTop - (1 - ec2 / ecu) * H, eb = ec2 * (t - 2);
      g = (sC - sBot) > EPS ? (ec2 - eb) / (sC - sBot) : 0; eT = ec2 + g * (sTop - sC);
    }
    // ε = eT − g sTop + g (u·p)  → e0 = eT − g sTop ; −ky = g u_y ; kx = g u_x
    return { e0: eT - g * sTop, ky: -g * u[1], kx: g * u[0], eT, eS: eT - g * (sTop - sSt), sTop, sSt };
  }
  function resUltime(geo, L, u, t) { const p = planUltime(geo, L, u, t); return Object.assign(integre(geo, L.sigC, L.sigS, p.e0, p.ky, p.kx), { plan: p, t }); }
  /* recherche du plan ultime d'effort normal N dans la direction u (N(t) croissant) */
  function ultimeN(geo, L, u, N) {
    const r0 = resUltime(geo, L, u, 0), r3 = resUltime(geo, L, u, 3);
    if (N < r0.N - 1e-6 || N > r3.N + 1e-6) return null;
    let a = 0, b = 3, ra = r0;
    for (let i = 0; i < 70; i++) {
      const m = (a + b) / 2, rm = resUltime(geo, L, u, m);
      if (rm.N < N) { a = m; ra = rm; } else b = m;
      if (b - a < 1e-10) break;
    }
    return resUltime(geo, L, u, (a + b) / 2);
  }
  const pivotDe = (t) => (t < 1 ? 'A' : t <= 2 ? 'B' : 'C');

  /* ── ELU : vérification ── */
  function elu(geo, mat, c) {
    const L = lois(mat, c.type || 1), N = +c.N || 0, M = +c.M || 0, My = +c.My || 0;
    const Nmin = resUltime(geo, L, [0, -1], 0).N, Nmax = resUltime(geo, L, [0, -1], 3).N;
    const out = { N, M, My, Nmin, Nmax, fc: L.fc, fy: L.fy, type: c.type || 1 };
    if (N < Nmin - 1e-6 || N > Nmax + 1e-6) return Object.assign(out, { ok: false, ratio: Infinity, MRd: 0, MRdp: NaN, MRdn: NaN, msg: N < Nmin ? 'Traction supérieure à la résistance des aciers' : 'Compression supérieure à la résistance de la section' });
    if (geo.plan && !(geo.kind === 'cercle' && My)) {
      const rp = ultimeN(geo, L, [0, -1], N), rn = ultimeN(geo, L, [0, 1], N);
      const Mt = geo.kind === 'cercle' ? Math.hypot(M, My) * (M < 0 ? -1 : 1) : M;
      const MRdp = rp.Mx, MRdn = rn.Mx;
      const r = Mt >= 0 ? rp : rn, MRd = Mt >= 0 ? MRdp : MRdn;
      const ratio = Math.abs(Mt) < 1e-9 ? 0 : (MRd * Mt > 0 ? Mt / MRd : Infinity);
      return Object.assign(out, { MRdp, MRdn, MRd, Mt, ratio, ok: ratio <= 1 + 1e-9, pivot: pivotDe(r.t), eps: { c: r.plan.eT, s: r.plan.eS }, plan: r.plan });
    }
    if (geo.kind === 'cercle') { // flexion déviée sur cercle : moment résultant
      return elu(geo, mat, Object.assign({}, c, { M: Math.hypot(M, My) * (M < 0 ? -1 : 1), My: 0 }));
    }
    // flexion déviée, section quelconque : contour (Mx, My) à N constant puis intersection avec le rayon de MEd
    const cont = contourMxMy(geo, mat, c.type || 1, N, 144);
    const Med = Math.hypot(M, My);
    if (Med < 1e-9) return Object.assign(out, { ok: true, ratio: 0, MRd: NaN, contour: cont });
    const ang = Math.atan2(My, M);
    let best = null;
    for (let i = 0; i < cont.length; i++) {
      const p = cont[i], q = cont[(i + 1) % cont.length];
      // intersection du rayon (cos, sin)·λ avec le segment p→q
      const dxs = q.Mx - p.Mx, dys = q.My - p.My, cx = Math.cos(ang), cy = Math.sin(ang);
      const den = cx * dys - cy * dxs; if (Math.abs(den) < EPS) continue;
      const lam = (p.Mx * dys - p.My * dxs) / den, mu = (p.Mx * cy - p.My * cx) / den;
      if (lam > 0 && mu >= -1e-9 && mu <= 1 + 1e-9 && (!best || lam < best.lam)) best = { lam, p, q, mu };
    }
    const MRd = best ? best.lam : 0, ratio = MRd > 0 ? Med / MRd : Infinity;
    return Object.assign(out, { ok: ratio <= 1 + 1e-9, ratio, MRd, MRdx: MRd * Math.cos(ang), MRdy: MRd * Math.sin(ang), contour: cont, pivot: best ? best.p.pivot : '' });
  }
  function contourMxMy(geo, mat, type, N, n = 72) {
    const L = lois(mat, type), out = [];
    for (let i = 0; i < n; i++) {
      const th = 2 * Math.PI * i / n, u = [Math.cos(th), Math.sin(th)];
      const r = ultimeN(geo, L, u, N);
      if (r) out.push({ Mx: r.Mx, My: r.My, th, pivot: pivotDe(r.t) });
    }
    return out;
  }
  /* diagramme d'interaction N–M (sections planes) */
  function interaction(geo, mat, type = 1, n = 90) {
    const L = lois(mat, type), pos = [], neg = [];
    for (let i = 0; i <= n; i++) {
      const t = 3 * i / n;
      const a = resUltime(geo, L, [0, -1], t), b = resUltime(geo, L, [0, 1], t);
      pos.push({ N: a.N, M: a.Mx, t }); neg.push({ N: b.N, M: b.Mx, t });
    }
    return { pos, neg, Nmin: pos[0].N, Nmax: pos[n].N, fc: L.fc, fy: L.fy, type };
  }
  /* moment résistant à N donné, interpolé sur le diagramme (utilitaire pour les autres modules) */
  function MRdAt(geo, mat, type, N) { const L = lois(mat, type); const p = ultimeN(geo, L, [0, -1], N), q = ultimeN(geo, L, [0, 1], N); return p && q ? { pos: p.Mx, neg: q.Mx } : null; }

  /* ════════════════════════════ ELS (section fissurée, béton non tendu) ════════════════════════════ */
  function solve3(J, R, nd) {
    if (nd === 2) { const det = J[0][0] * J[1][1] - J[0][1] * J[1][0]; if (Math.abs(det) < 1e-30) return null; return [(R[0] * J[1][1] - R[1] * J[0][1]) / det, (J[0][0] * R[1] - J[1][0] * R[0]) / det, 0]; }
    const a = J.map((r, i) => [...r, R[i]]);
    for (let i = 0; i < 3; i++) {
      let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(a[k][i]) > Math.abs(a[p][i])) p = k;
      [a[i], a[p]] = [a[p], a[i]]; if (Math.abs(a[i][i]) < 1e-30) return null;
      for (let k = i + 1; k < 3; k++) { const f = a[k][i] / a[i][i]; for (let j = i; j < 4; j++) a[k][j] -= f * a[i][j]; }
    }
    const x = [0, 0, 0]; for (let i = 2; i >= 0; i--) { let s = a[i][3]; for (let j = i + 1; j < 3; j++) s -= a[i][j] * x[j]; x[i] = s / a[i][i]; }
    return x;
  }
  /* résolution générale de l'équilibre (e0, ky, kx) pour une loi élastique (Ec, Es), béton tendu ou non */
  function elastique(geo, Ec, Es, N, Mx, My, tendu = false) {
    const nd = geo.plan ? 2 : 3;
    const etat = (v) => {
      const R = [0, 0, 0], J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const add = (x, y, A, E, s) => {
        const g = [1, -y, x], F = s * A * 1000;
        for (let i = 0; i < 3; i++) { R[i] += F * g[i]; for (let j = 0; j < 3; j++) J[i][j] += E * A * 1000 * g[i] * g[j]; }
      };
      for (const f of geo.conc) { const e = v[0] - v[1] * f.y + v[2] * f.x; const act = tendu || e > 0; add(f.x, f.y, f.A, act ? Ec : Ec * 1e-9, act ? Ec * e : 0); }
      for (const b of geo.bars) { const e = v[0] - v[1] * b.y + v[2] * b.x; add(b.x, b.y, b.A, Es, Es * e); }
      R[0] -= N; R[1] -= Mx; R[2] -= My;
      return { R, J };
    };
    const norm = (R) => Math.hypot(R[0] / 1000, R[1] / 1000, nd === 3 ? R[2] / 1000 : 0);
    // départ : section homogène non fissurée
    let v = [0, 0, 0];
    { const s = etat(v), all = (() => { const R = [0, 0, 0], J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; const add = (x, y, A, E) => { const g = [1, -y, x]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) J[i][j] += E * A * 1000 * g[i] * g[j]; }; geo.conc.forEach((f) => add(f.x, f.y, f.A, Ec)); geo.bars.forEach((b) => add(b.x, b.y, b.A, Es)); return J; })();
      const d = solve3(all, [N, Mx, My], nd); if (d) v = d; void s; }
    let st = etat(v), r0 = norm(st.R), it = 0;
    const tol = 1e-7 * Math.max(1, Math.abs(N) / 1000 + Math.abs(Mx) / 1000 + Math.abs(My) / 1000);
    while (r0 > tol && it < 200) {
      const d = solve3(st.J, st.R.map((x) => -x), nd); if (!d) break;
      let lam = 1, nv, ns, r1;
      for (let k = 0; k < 30; k++) { nv = v.map((x, i) => x + lam * d[i]); ns = etat(nv); r1 = norm(ns.R); if (r1 < r0 * (1 - 1e-4 * lam) || k === 29) break; lam /= 2; }
      v = nv; st = ns; r0 = r1; it++;
    }
    return { e0: v[0], ky: v[1], kx: v[2], conv: r0 <= tol * 10, it, res: r0 };
  }
  function els(geo, mat, c) {
    const n = +c.n || 15, Es = mat.Es, Ec = Es / n;
    const N = +c.N || 0, Mx = +c.M || 0, My = +c.My || 0;
    const v = elastique(geo, Ec, Es, N, Mx, My, !!c.nonFissure);
    let sc = 0, Ac = 0, Fc = 0, xC = null;
    let emax = -Infinity, emin = Infinity;
    for (const f of geo.conc) {
      const e = v.e0 - v.ky * f.y + v.kx * f.x;
      if (e > 0 || c.nonFissure) { const s = Ec * e; if (e > 0) { Ac += f.A; Fc += s * f.A * 1000; } if (s > sc) sc = s; }
      emax = Math.max(emax, e); emin = Math.min(emin, e);
    }
    // contrainte maxi exacte aux sommets / fibres extrêmes
    const ext = geo.points ? geo.points.map((p) => v.e0 - v.ky * (p[1] - geo.ref.y) + v.kx * (p[0] - geo.ref.x))
      : geo.kind === 'cercle' ? (() => { const k = Math.hypot(v.ky, v.kx); return [v.e0 + k * geo.D / 2, v.e0 - k * geo.D / 2]; })()
        : [v.e0 - v.ky * geo.yTop, v.e0 - v.ky * geo.yBot];
    const eTop = Math.max(...ext), eBot = Math.min(...ext);
    sc = Math.max(0, Ec * eTop);
    const ss = geo.bars.map((b) => Es * (v.e0 - v.ky * b.y + v.kx * b.x));
    // hauteur comprimée mesurée depuis la fibre la plus comprimée, perpendiculairement à l'axe neutre
    const k = Math.hypot(v.ky, v.kx);
    if (k > EPS) xC = clamp(eTop / k, 0, (eTop - eBot) / k);
    else xC = v.e0 > 0 ? Infinity : 0;
    const smoy = Ac > 0 ? Fc / Ac / 1000 : 0;
    return { N, M: Mx, My, n, sc, ss, ssMin: ss.length ? Math.min(...ss) : 0, ssMax: ss.length ? Math.max(...ss) : 0, x: xC, Ac, smoy, plan: v, eTop, eBot, conv: v.conv };
  }
  /* caractéristiques homogénéisées : non fissurée (béton entier + n·As) et fissurée en flexion simple (béton comprimé + n·As) */
  function props(geo, n = 15) {
    let A = 0, Sy = 0;
    geo.conc.forEach((f) => { A += f.A; Sy += f.A * f.y; }); geo.bars.forEach((b) => { A += n * b.A; Sy += n * b.A * b.y; });
    const yG = Sy / A; let I = 0;
    geo.conc.forEach((f) => { I += f.A * sq(f.y - yG) + (f.w && f.t ? f.w * Math.pow(f.t, 3) / 12 : 0); }); geo.bars.forEach((b) => { I += n * b.A * sq(b.y - yG); });
    const fiss = (sgn) => { // sgn=+1 : M>0, fibre inférieure comprimée
      if (!geo.plan) return null;
      const r = els(geo, { Es: 200000 }, { n, N: 0, M: sgn * 100 });
      const yN = r.plan.e0 / r.plan.ky; // ε = e0 − ky y = 0
      let If = 0; geo.conc.forEach((f) => { const e = r.plan.e0 - r.plan.ky * f.y; if (e > 0) If += f.A * sq(f.y - yN) + (f.w && f.t ? f.w * Math.pow(f.t, 3) / 12 : 0); });
      geo.bars.forEach((b) => { If += n * b.A * sq(b.y - yN); });
      return { I: If, x: r.x, yN };
    };
    return { A, yG, I, Ac: geo.Ac, fp: fiss(1), fn: fiss(-1) };
  }

  /* coefficient d'équivalence EC2 : n = Es/Ec,eff, Ec,eff = Ecm/(1 + φ·Mqp/M) (EN 1992-1-1 §7.4.3 (5)) */
  function nEff(mat, M, Mqp) {
    const r = Math.abs(M) > EPS ? clamp(Mqp / M, 0, 1) : 1;
    return mat.Es / mat.Ecm * (1 + mat.phi * r);
  }

  /* ════════════════════════════ OUVERTURE DES FISSURES (EC2 §7.3.4) ════════════════════════════ */
  function wk(geo, mat, e, o) {
    // o : {c (mm), phi (mm), s (mm), kt, wmax (mm)} ; face tendue déduite de l'état ELS e
    const c = +o.c, phi = +o.phi, sp = +o.s, kt = o.kt ?? 0.4, k1 = 0.8, k4 = 0.425;
    const k3 = c > 25 ? 3.4 * Math.pow(25 / c, 2 / 3) : 3.4;                // AN française
    const fct = mat.fctm, ae = mat.Es / mat.Ecm;
    let As = 0, ss = 0, hceff, Aceff, h, d, x = e.x, k2 = 0.5;
    if (geo.kind === 'cercle') {
      h = geo.D; x = Math.min(e.x, h);
      const tension = e.ss.some((s) => s < 0); if (!tension) return { wk: 0, sr: 0, dEps: 0, ss: 0, k3, sansTraction: true };
      ss = -Math.min(...e.ss); As = geo.AsTot * 1e-4;
      const t = Math.min(2.5 * geo.a, geo.D / 2), r = geo.D / 2;
      hceff = t; Aceff = Math.PI * (r * r - sq(r - t));                     // couronne d'épaisseur 2,5 a (hypothèse)
      d = geo.D - geo.a;
    } else {
      if (!geo.plan) return null;
      const inf = e.plan.ky < 0 ? false : true; // ky>0 ⇒ ε décroît vers le haut ⇒ fibre inférieure comprimée ⇒ face tendue = supérieure
      // face tendue : 'sup' si M>0 (inférieure comprimée)
      const faceSup = (e.eTop === v_eps(e, geo.yBot)) ? true : (v_eps(e, geo.yTop) < v_eps(e, geo.yBot));
      void inf;
      const yFace = faceSup ? geo.yTop : geo.yBot;
      h = geo.h;
      const barsT = geo.bars.map((b, i) => ({ b, s: e.ss[i] })).filter((z) => z.s < 0);
      if (!barsT.length) return { wk: 0, sr: 0, dEps: 0, ss: 0, k3, sansTraction: true };
      // aciers de la face tendue : à moins de h/2 de la face
      const near = barsT.filter((z) => Math.abs(z.b.y - yFace) <= h / 2 + 1e-9);
      const grp = near.length ? near : barsT;
      As = grp.reduce((s, z) => s + z.b.A, 0); ss = -Math.min(...grp.map((z) => z.s));
      const dist = grp.reduce((s, z) => s + z.b.A * Math.abs(z.b.y - yFace), 0) / As; // h − d
      d = h - dist;
      const xx = Number.isFinite(x) ? x : 0;
      hceff = Math.min(2.5 * dist, (h - xx) / 3, h / 2);
      if (xx <= 0) { hceff = Math.min(2.5 * dist, h / 2); const e1 = Math.max(-e.eTop, -e.eBot), e2 = Math.min(-e.eTop, -e.eBot); k2 = e1 > 0 ? (e1 + Math.max(e2, 0)) / (2 * e1) : 0.5; }
      const dep = faceSup ? 0 : h; let bt = geo.width(faceSup ? 1e-6 : h - 1e-6);
      if (geo.kind === 'te') { // largeur moyenne sur hc,eff
        let A = 0; const nS = 40; for (let i = 0; i < nS; i++) { const z = (i + 0.5) / nS * hceff; A += geo.width(faceSup ? z : h - z) * hceff / nS; } bt = A / hceff;
      }
      void dep; Aceff = bt * hceff;
    }
    const rho = As / Aceff;
    const dEps = Math.max((ss - kt * fct / rho * (1 + ae * rho)) / mat.Es, 0.6 * ss / mat.Es);
    const srmax = sp <= 5 * (c + phi / 2) ? k3 * c + k1 * k2 * k4 * phi / rho : 1.3 * (h - (Number.isFinite(x) ? x : 0)) * 1000;
    const w = srmax * dEps;
    return { wk: w, sr: srmax, dEps, ss, rho, Aceff, hceff, As: As * 1e4, k1, k2, k3, k4, kt, ae, fct, ok: o.wmax ? w <= o.wmax + 1e-9 : true, wmax: o.wmax };
  }
  function v_eps(e, y) { return e.plan.e0 - e.plan.ky * y; }

  /* ════════════════════════════ EFFORT TRANCHANT ET TORSION ════════════════════════════ */
  /* EN 1992-1-1 §6.2.2, 6.2.3, 6.3.2 + AN française (vmin poutres 0,053/γc k^1,5 fck^0,5 ; dalles 0,34/γc fck^0,5 ; 1 ≤ cotθ ≤ 2,5).
   * o : {bw, h, d, z, b (largeur pour torsion), Asl (cm²), N, V, T, fck, fyk, gc, gs, cot:'libre'|nombre, element:'poutre'|'dalle', c (enrobage axe, m)} */
  function tranchantEC2(o) {
    const gc = o.gc || 1.5, gs = o.gs || 1.15, fck = +o.fck, fcd = fck / gc, fywd = +o.fyk / gs;
    const bw = +o.bw, d = +o.d, z = +o.z || 0.9 * d, Ac = +o.Ac || bw * (+o.h || d / 0.9);
    const V = Math.abs(+o.V || 0), T = Math.abs(+o.T || 0), N = +o.N || 0;
    const k = Math.min(1 + Math.sqrt(0.2 / d), 2);
    const rho = Math.min((+o.Asl || 0) * 1e-4 / (bw * d), 0.02);
    const scp = Math.min(N / Ac / 1000, 0.2 * fcd);                         // MPa, compression > 0
    const vmin = o.element === 'dalle' ? 0.34 / gc * Math.sqrt(fck) : 0.053 / gc * Math.pow(k, 1.5) * Math.sqrt(fck);
    const vrdc = Math.max(0.18 / gc * k * Math.pow(100 * rho * fck, 1 / 3) + 0.15 * scp, vmin + 0.15 * scp);
    const VRdc = Math.max(vrdc, 0) * bw * d * 1000;
    const nu1 = 0.6 * (1 - fck / 250);
    const sR = Math.max(N / Ac / 1000, 0);
    const acw = sR <= 0 ? 1 : sR <= 0.25 * fcd ? 1 + sR / fcd : sR <= 0.5 * fcd ? 1.25 : 2.5 * (1 - sR / fcd);
    const VRdmax = (cot) => acw * bw * z * nu1 * fcd / (cot + 1 / cot) * 1000;
    // torsion : section creuse équivalente (§6.3.2), section rectangulaire b × h
    const b = +o.b || bw, h = +o.h || d / 0.9;
    let tor = null;
    if (T > 0) {
      const A = b * h, u = 2 * (b + h), cmin = 2 * (+o.c || (h - d));
      const tef = clamp(A / u, Math.min(cmin, Math.min(b, h) / 2), Math.min(b, h) / 2);
      const Ak = (b - tef) * (h - tef), uk = 2 * ((b - tef) + (h - tef));
      const fctd = 1.0 * ec2Beton(fck).fctk005 / gc;
      const TRdc = 2 * Ak * tef * fctd * 1000;
      tor = { tef, Ak, uk, TRdc, TRdmax: (cot) => 2 * nu1 * acw * fcd * Ak * tef / (cot + 1 / cot) * 1000 };
    }
    // choix de cotθ : libre → plus grande valeur de [1 ; 2,5] respectant la bielle (V et T cumulés)
    const inter = (cot) => V / VRdmax(cot) + (tor ? T / tor.TRdmax(cot) : 0);
    let cot;
    if (o.cot === 'libre' || o.cot === undefined || o.cot === '') {
      const cmax = +o.cotMax || 2.5, cmin = +o.cotMin || 1;
      if (inter(cmax) <= 1) cot = cmax;
      else if (inter(cmin) > 1) cot = cmin;
      else { let a = cmin, bb = cmax; for (let i = 0; i < 60; i++) { const m = (a + bb) / 2; if (inter(m) <= 1) a = m; else bb = m; } cot = a; }
    } else cot = clamp(+o.cot, 0.5, 3);
    const sansArm = V <= VRdc && (!tor || T / tor.TRdc + V / VRdc <= 1);
    const rhoMin = 0.08 * Math.sqrt(fck) / +o.fyk;                         // §9.2.2 (5)
    const AswMin = o.element === 'dalle' ? 0 : rhoMin * bw * 1e4;          // cm²/m
    const AswV = sansArm ? 0 : V / (z * fywd * 1000 * cot) * 1e4;          // cm²/m (toutes branches)
    const Asw = Math.max(AswV, AswMin);
    const dFtd = 0.5 * V * cot;                                            // §6.2.3 (7), cadres droits
    let AswT = 0, AslT = 0, TRdmax = null;
    if (tor) { TRdmax = tor.TRdmax(cot); if (!sansArm || T > tor.TRdc * (1 - V / VRdc)) { AswT = T / (2 * tor.Ak * fywd * 1000 * cot) * 1e4; AslT = T * tor.uk * cot / (2 * tor.Ak * fywd * 1000) * 1e4; } }
    const VRdm = VRdmax(cot), interaction = inter(cot);
    return { regl: 'EC2', V, T, N, k, rho, scp, vmin, VRdc, VRdmax: VRdm, nu1, acw, z, cot, theta: Math.atan(1 / cot) * 180 / Math.PI, sansArm,
      Asw, AswV, AswMin, dFtd, AsFtd: dFtd / (+o.fyk / gs) * 10, tor, AswT, AslT, TRdmax, interaction, ok: interaction <= 1 + 1e-9 };
  }
  /* BAEL 91 A.5.1 (τu, At/st) et A.5.4 (torsion, section pleine). o : {b0, h, d, fc28, fe, gb, gs, fissuration, N, V, T, reprise:0|1|2, alpha:90} */
  function tranchantBAEL(o) {
    const fc = +o.fc28, fe = +o.fe, gb = o.gb || 1.5, gs = o.gs || 1.15, b0 = +o.b0, d = +o.d, h = +o.h || d / 0.9;
    const V = Math.abs(+o.V || 0), T = Math.abs(+o.T || 0), N = +o.N || 0;
    const ftj = 0.6 + 0.06 * fc;
    const tauV = V / (b0 * d) / 1000;
    const tlim = (o.fissuration || 0) === 0 ? Math.min(0.2 * fc / gb, 5) : Math.min(0.15 * fc / gb, 4);
    const sm = N / (b0 * h) / 1000;
    let k = sm >= 0 ? 1 + 3 * sm / fc : 1 - 10 * (-sm) / fc;
    if (o.reprise === 2) k = 0; else if (o.reprise === 1) k = Math.min(k, 1);
    k = Math.max(k, 0);
    const al = (+o.alpha || 90) * Math.PI / 180;
    const AtV = Math.max(gs * (tauV - 0.3 * ftj * k) / (0.9 * fe * (Math.sin(al) + Math.cos(al))), 0); // At/(b0 st), m²/m²
    const AtMin = 0.4 / fe;                                                // A.5.1.22
    let tor = null, tauT = 0;
    if (T > 0) {
      const a = Math.min(b0, h), e = a / 6, Om = (b0 - e) * (h - e), u = 2 * ((b0 - e) + (h - e));
      tauT = T / (2 * Om * e) / 1000;
      const AtT = T / (2 * Om * fe / gs * 1000) * 1e4;                     // cm²/m (un brin)
      tor = { e, Om, u, tauT, AtT, Al: u * AtT };
    }
    const tauTot = Math.sqrt(tauV * tauV + tauT * tauT);
    const At = Math.max(AtV, AtMin) * b0 * 1e4;
    return { regl: 'BAEL', V, T, N, tauV, tauT, tau: tauTot, tlim, k, ftj, AtSurB0: Math.max(AtV, AtMin) * 1e4, At, tor, ok: tauTot <= tlim + 1e-9 };
  }

  /* ════════════════════════════ EXCENTRICITÉS ADDITIONNELLES ════════════════════════════ */
  /* EC2 : imperfection ei = θi l0/2 (§5.2 (7)), θi = αh/200, αh = 2/√l ∈ [2/3 ; 1] ; e0 ≥ max(h/30 ; 20 mm) (§6.1 (4)) ;
   *       second ordre par courbure nominale si λ > λlim (§5.8.3.1, 5.8.8) avec c = 8 (courbure constante) ou π².
   * BAEL : ea = max(2 cm ; L/250), e2 = 3 lf² (2 + α φ)/(10⁴ h) si lf/h ≤ max(15 ; 20 e1/h) (A.4.3.5). */
  function secondOrdre(geo, mat, c, o) {
    const N = +c.N || 0, M = +c.M || 0, L = +o.L || 0, lf = +o.lf || 0;
    const h = geo.kind === 'cercle' ? geo.D : geo.h || 1;
    if (!(N > 0) || !(lf > 0)) return { M, e: 0, detail: 'sans objet' };
    const sg = M < 0 ? -1 : 1, e1 = Math.abs(M) / N;
    if (mat.regl === 'BAEL') {
      const ea = Math.max(0.02, L / 250);
      const alpha = Math.abs(M) > EPS ? clamp((+c.Mcp || 0) / M, 0, 1) : 0;
      const app = lf / h <= Math.max(15, 20 * (e1 + ea) / h);
      const e2 = app ? 3 * lf * lf * (2 + alpha * 2) / (1e4 * h) : 0;
      return { M: sg * N * (e1 + ea + e2), e: ea + e2, ea, e2, detail: app ? 'BAEL A.4.3.5 : e2 forfaitaire' : 'élancement hors domaine forfaitaire (non traité)', horsDomaine: !app };
    }
    const Lc = lois(mat, 1);
    const ah = clamp(2 / Math.sqrt(Math.max(L || lf, 1e-6)), 2 / 3, 1);
    const ei = ah / 200 * lf / 2;
    const i = Math.sqrt((geo.Ic || 1) / geo.Ac);
    const lam = lf / i;
    const As = geo.bars.reduce((s, b) => s + b.A, 0);
    const omega = As * Lc.fy / (geo.Ac * Lc.fc);
    const nrel = N / 1000 / (geo.Ac * Lc.fc);
    const phiEf = Math.abs(M) > EPS ? mat.phi * clamp((+c.Mcp || 0) / M, 0, 1) : 0;
    const Ac = 1 / (1 + 0.2 * phiEf), Bc = Math.sqrt(1 + 2 * omega), Cc = 0.7;
    const lamLim = 20 * Ac * Bc * Cc / Math.sqrt(Math.max(nrel, 1e-9));
    let e2 = 0;
    if (lam > lamLim) {
      const dd = geo.kind === 'cercle' ? geo.D / 2 + geo.rs / 2 : Math.max(...geo.bars.map((b) => b.d || 0), 0.9 * h) || 0.9 * h; // §5.8.8.3 (2) approx.
      const nu = 1 + omega, Kr = clamp((nu - nrel) / (nu - 0.4), 0, 1);
      const beta = 0.35 + mat.fc / 200 - lam / 150, Kphi = Math.max(1, 1 + beta * phiEf);
      const r1 = Kr * Kphi * Lc.eyd / (0.45 * dd);
      e2 = r1 * lf * lf / (o.c || 8);
    }
    const e0 = Math.max(h / 30, 0.02);
    const etot = Math.max(e1 + ei + e2, e0);
    return { M: sg * N * etot, e: etot - e1, ei, e2, lam, lamLim, e0, detail: lam > lamLim ? 'second ordre (courbure nominale)' : 'imperfection seule (λ ≤ λlim)' };
  }

  /* ════════════════════════════ FATIGUE (simplifiée) ════════════════════════════ */
  /* variation de contrainte des aciers entre deux états ELS (section fissurée, n = Es/Ecm), comparée à ΔσRsk/γs,fat (EC2 §6.8.5). */
  function fatigue(geo, mat, f, lim) {
    const n = mat.Es / mat.Ecm;
    const a = els(geo, mat, { N: f.N1, M: f.M1, My: f.My1, n }), b = els(geo, mat, { N: f.N2, M: f.M2, My: f.My2, n });
    const ds = geo.bars.map((_, i) => Math.abs(a.ss[i] - b.ss[i]));
    const dmax = ds.length ? Math.max(...ds) : 0;
    return { n, ds, dmax, lim, ok: dmax <= lim + 1e-9, sc: Math.max(a.sc, b.sc) };
  }

  /* ════════════════════════════ DIMENSIONNEMENT ════════════════════════════ */
  function avecAciers(base, sec, As) { // reconstruit la géométrie avec de nouvelles sections d'acier (cm²)
    if (base.kind === 'cercle') return cercle(Object.assign({}, sec, { As: As[0] }));
    const nap = sec.nappes.map((n, i) => Object.assign({}, n, { As: As[i] }));
    return base.kind === 'te' ? te(Object.assign({}, sec, { nappes: nap })) : rect(Object.assign({}, sec, { nappes: nap }));
  }
  function bisect(f, lo, hi, it = 50) { // plus petite valeur de [lo,hi] telle que f(x) vrai (f monotone)
    if (f(lo)) return lo; if (!f(hi)) return null;
    for (let i = 0; i < it; i++) { const m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; if (hi - lo < 1e-4) break; }
    return hi;
  }
  /* ELU — deux nappes (indices iS : supérieure, iI : inférieure) ; renvoie {As:[sup, inf], cas} pour une combinaison */
  function dimELU2(sec, base, mat, c, sym) {
    const Ab = (base.Ac * 1e4) * 0.08;                                     // borne de recherche 8 % (cm²)
    const okFor = (As) => { const g = avecAciers(base, sec, As); const r = elu(g, mat, c); return r.ok; };
    if (okFor([0, 0])) return { As: [0, 0], cas: 'béton seul' };
    if (sym) { const a = bisect((a) => okFor([a, a]), 0, Ab); return { As: a === null ? [NaN, NaN] : [a, a], cas: 'symétrique' }; }
    const M = +c.M || 0, N = +c.N || 0;
    const iT = M >= 0 ? 0 : 1, iC = 1 - iT;                                 // M>0 : nappe supérieure tendue
    const mk = (t, cc) => { const a = [0, 0]; a[iT] = t; a[iC] = cc; return a; };
    // 1. traction à faible excentricité : deux nappes tendues (règle des leviers)
    if (N < 0) {
      const L = lois(mat, c.type || 1), y = [base.bars[0].y, base.bars[1].y];
      // −fy(A0+A1)·1000·1e-4 = N ; −fy(A0 y0 + A1 y1)… Mx = −Σσ A y = fy·(A0 y0 + A1 y1)·0.1
      const det = y[1] - y[0];
      if (Math.abs(det) > EPS) {
        const S = -N / (L.fy * 0.1), A1 = (M / (L.fy * 0.1) - S * y[0]) / det, A0 = S - A1;
        if (A0 >= 0 && A1 >= 0) { const f = 1 + 1e-6; if (okFor([A0 * f, A1 * f])) return { As: [A0, A1], cas: 'traction (deux nappes tendues)' }; }
      }
    }
    // 2. aciers tendus seuls, avec contrôle de la ductilité (allongement ≥ εyd sur la nappe tendue)
    const At = bisect((a) => okFor(mk(a, 0)), 0, Ab);
    if (At !== null) {
      const g = avecAciers(base, sec, mk(At, 0)), r = elu(g, mat, c), L = lois(mat, c.type || 1);
      const bT = g.bars[iT]; const eT = r.plan ? r.plan.e0 - r.plan.ky * bT.y : 0;
      if (eT <= -L.eyd + 1e-9 || N > 0.3 * r.Nmax) return { As: mk(At, 0), cas: 'aciers tendus seuls' };
    }
    // 3. aciers comprimés : plan limite εc = εcu, εs = −εyd (pivot B, x = xlim)
    {
      const L = lois(mat, c.type || 1), g0 = avecAciers(base, sec, [0, 0]);
      const u = M >= 0 ? [0, -1] : [0, 1];
      const bT = base.bars[iT], bC = base.bars[iC];
      const sTop = M >= 0 ? -g0.yBot : g0.yTop, sT = u[1] * bT.y;
      const g = (L.ecu + L.eyd) / (sTop - sT), e0 = L.ecu - g * sTop, ky = -g * u[1];
      const conc = integre(g0, L.sigC, L.sigS, e0, ky, 0);
      const sC = L.sigS(e0 - ky * bC.y), sT_ = L.sigS(e0 - ky * bT.y);
      // N = Nc + 0.1(AC σC + AT σT) ; Mx = Mc − 0.1(AC σC yC + AT σT yT)
      const a11 = 0.1 * sC, a12 = 0.1 * sT_, a21 = -0.1 * sC * bC.y, a22 = -0.1 * sT_ * bT.y;
      const r1 = N - conc.N, r2 = M - conc.Mx, det = a11 * a22 - a12 * a21;
      if (Math.abs(det) > EPS) {
        let AC = (r1 * a22 - a12 * r2) / det, AT = (a11 * r2 - a21 * r1) / det;
        if (AC > 0 && AT >= 0) { const f = 1.0005; if (okFor(mk(AT * f, AC * f))) return { As: mk(AT, AC), cas: 'aciers comprimés (x = xlim)' }; }
        if (AC > 0 && AT < 0) { // section entièrement comprimée : nappe la plus comprimée seule, puis complément symétrique
          const Ac2 = bisect((a) => okFor(mk(0, a)), 0, Ab);
          if (Ac2 !== null) return { As: mk(0, Ac2), cas: 'compression (nappe comprimée)' };
        }
      }
    }
    if (At !== null) return { As: mk(At, 0), cas: 'aciers tendus seuls (non plastifiés)' };
    const a = bisect((a) => okFor([a, a]), 0, Ab);
    return { As: a === null ? [NaN, NaN] : [a, a], cas: a === null ? 'impossible (section insuffisante)' : 'symétrique (repli)' };
  }

  /* ════════════════════════════ CALCUL COMPLET ════════════════════════════ */
  const TYPES_ELU = { 1: 'ELU fondamental', 2: 'ELU 1 h – 24 h', 3: 'ELU < 1 h', 4: 'ELU accidentel', 5: 'ELU sismique' };
  const TYPES_ELU_BAEL = { 1: 'ELU > 24 h', 2: 'ELU 1 h – 24 h', 3: 'ELU < 1 h', 4: 'ELU accidentel', 5: 'ELU sismique' };
  const TYPES_ELS = { 0: 'ELS caractéristique', 1: 'ELS quasi-permanent', 2: 'ELS fréquent' };

  function construire(d) {
    const s = d.section || {};
    if (d.forme === 'rect') return rect(s);
    if (d.forme === 'te') return te(s);
    if (d.forme === 'cercle') return cercle(s);
    if (d.forme === 'poly') return poly(s);
    throw new Error('Forme de section inconnue : ' + d.forme);
  }
  function nPour(mat, o, r) { // coefficient d'équivalence d'une combinaison ELS
    if (mat.regl === 'BAEL') return +o.n || 15;
    if (o.nCalcule === false) return +o.n || 15;
    return nEff(mat, +r.M || Math.hypot(+r.M || 0, +r.My || 0), r.Mqp ?? r.M);
  }

  function calcul(d) {
    const o = d.options || {}, alertes = [];
    const mat = materiau(Object.assign({ regl: d.regl }, d.materiau || {}, { pieu: o.pieu }));
    let sec = JSON.parse(JSON.stringify(d.section || {}));
    let geo = construire({ forme: d.forme, section: sec });
    const typesELU = mat.regl === 'BAEL' ? TYPES_ELU_BAEL : TYPES_ELU;
    const EL = (d.elu || []).filter((r) => r && [r.N, r.M, r.My, r.V, r.T].some((v) => Number.isFinite(+v) && +v !== 0));
    const ES = (d.els || []).filter((r) => r && [r.N, r.M, r.My].some((v) => Number.isFinite(+v) && +v !== 0));
    const FT = (d.fat || []).filter((r) => r && [r.M1, r.M2, r.N1, r.N2].some((v) => Number.isFinite(+v) && +v !== 0));
    const so = (r) => secondOrdre(geo, mat, r, { L: o.L, lf: o.lf, c: o.cCourbure });
    const fiss = o.fissu || {};
    const faceOf = (r) => (+r.M || 0) >= 0 ? 'sup' : 'inf';                 // face tendue en flexion
    const wkOpts = (face) => { const f = fiss[face] || fiss.sup || {}; return { c: +f.c || 30, phi: +f.phi || 20, s: +f.s || 200, kt: o.kt ?? 0.4, wmax: +o.wmax || 0.3 }; };
    let dim = null;

    /* ── dimensionnement (rect, T : deux nappes ; cercle : section totale) ── */
    if (d.mode === 'dim' && d.forme !== 'poly') {
      const plan2 = d.forme !== 'cercle';
      if (plan2 && (!sec.nappes || sec.nappes.length < 2)) throw new Error('Dimensionnement : définir une nappe supérieure et une nappe inférieure.');
      if (plan2) sec.nappes = sec.nappes.slice(0, 2);
      const nb = plan2 ? 2 : 1, zero = Array(nb).fill(0);
      const base = avecAciers(geo, sec, zero);
      const req = { elu: zero.slice(), els: zero.slice(), wk: zero.slice(), min: zero.slice(), lignes: [] };
      for (const r of EL) {
        const c = Object.assign({}, r, { M: so(r).M });
        if (!plan2) {
          const a = bisect((a) => elu(avecAciers(base, sec, [a]), mat, c).ok, 0, base.Ac * 1e4 * 0.08);
          req.lignes.push({ r, As: [a], cas: a === null ? 'impossible' : '' });
          req.elu[0] = Math.max(req.elu[0], a ?? NaN);
        } else {
          const x = dimELU2(sec, base, mat, c, !!o.sym);
          req.lignes.push({ r, As: x.As, cas: x.cas, MEd: c.M });
          req.elu = req.elu.map((v, i) => Math.max(v, x.As[i]));
        }
        // effort tranchant : ΔFtd ajouté à la nappe tendue (EC2) — reporté dans la synthèse
      }
      let As = req.elu.map((v) => (Number.isFinite(v) ? v : 0));
      // minimum de non-fragilité (EC2 §9.2.1.1, BAEL A.4.2) et maxi 4 % ; cercle : §9.5.2 (2)
      if (plan2) {
        for (let i = 0; i < 2; i++) {
          const dd = sec.nappes[i].d, depth = i === 0 ? geo.h - dd : dd; // d mesuré depuis la fibre comprimée en flexion
          const bt = geo.kind === 'te' ? geo.bw : geo.b;
          const Amin = mat.regl === 'EC2' ? Math.max(0.26 * mat.fctm / mat.fyk, 0.0013) * bt * depth * 1e4 : 0.23 * mat.ftj / mat.fyk * bt * depth * 1e4;
          const tendue = EL.some((r) => (i === 0 ? +r.M > 0 : +r.M < 0)) || ES.some((r) => (i === 0 ? +r.M > 0 : +r.M < 0));
          req.min[i] = tendue ? Amin : 0;
        }
      } else {
        const Nmax = Math.max(0, ...EL.map((r) => +r.N || 0));
        req.min[0] = Math.max(0.002 * geo.Ac, 0.10 * Nmax / 1000 / lois(mat, 1).fy) * 1e4;
      }
      As = As.map((v, i) => Math.max(v, req.min[i]));
      // ELS : contraintes (aciers tendus, puis béton avec aciers comprimés)
      const ssLimFor = (t) => (mat.regl === 'EC2' ? (t === 0 ? mat.ssLim : Infinity) : mat.ssLim);
      const scLimFor = (t) => (t === 1 ? mat.sbcQP : mat.sbc);
      for (let pass = 0; pass < 3; pass++) {
        for (const r of ES) {
          const n = nPour(mat, o, r), t = +r.type || 0;
          const st = (A) => els(avecAciers(geo, sec, A), mat, { N: r.N, M: r.M, My: r.My, n });
          if (!plan2) {
            const okS = (a) => { const e = st([a]); return -e.ssMin <= ssLimFor(t) + 1e-6 && e.sc <= scLimFor(t) + 1e-6 && e.smoy <= mat.smoyLim; };
            if (!okS(As[0])) { const a = bisect(okS, As[0], geo.Ac * 1e4 * 0.08); if (a !== null) { As[0] = a; req.els[0] = Math.max(req.els[0], a); } else alertes.push('ELS : contraintes non satisfaites même à 8 %.'); }
            continue;
          }
          const iT = (+r.M || 0) >= 0 ? 0 : 1, iC = 1 - iT;
          const sl = ssLimFor(t);
          if (Number.isFinite(sl)) {
            const okT = (a) => { const A = As.slice(); A[iT] = a; return -st(A).ssMin <= sl + 1e-6; };
            if (!okT(As[iT])) { const a = bisect(okT, As[iT], base.Ac * 1e4 * 0.08); if (a !== null) { As[iT] = a; req.els[iT] = Math.max(req.els[iT], a); } }
          }
          const okC = (a) => { const A = As.slice(); A[iC] = a; return st(A).sc <= scLimFor(t) + 1e-6; };
          if (!okC(As[iC])) { const a = bisect(okC, As[iC], base.Ac * 1e4 * 0.08); if (a !== null) { As[iC] = a; req.els[iC] = Math.max(req.els[iC], a); } else alertes.push('ELS : contrainte du béton non satisfaite.'); }
        }
      }
      // ouverture des fissures (EC2, combinaisons fréquentes ; ou quasi-permanentes si demandé)
      if (mat.regl === 'EC2' && o.wkCalcul) {
        for (const r of ES.filter((r) => (+r.type || 0) === (o.wkType ?? 2))) {
          const n = nPour(mat, o, r);
          if (!plan2) {
            const ok = (a) => { const g = avecAciers(geo, sec, [a]); const w = wk(g, mat, els(g, mat, { N: r.N, M: r.M, n }), wkOpts('sup')); return !w || w.wk <= w.wmax + 1e-9; };
            if (!ok(As[0])) { const a = bisect(ok, As[0], geo.Ac * 1e4 * 0.08); if (a !== null) { As[0] = a; req.wk[0] = a; } }
            continue;
          }
          const iT = (+r.M || 0) >= 0 ? 0 : 1, face = iT === 0 ? 'sup' : 'inf';
          const ok = (a) => { const A = As.slice(); A[iT] = a; const g = avecAciers(geo, sec, A); const w = wk(g, mat, els(g, mat, { N: r.N, M: r.M, n }), wkOpts(face)); return !w || w.wk <= w.wmax + 1e-9; };
          if (!ok(As[iT])) { const a = bisect(ok, As[iT], base.Ac * 1e4 * 0.08); if (a !== null) { As[iT] = a; req.wk[iT] = Math.max(req.wk[iT], a); } else alertes.push('Ouverture des fissures non satisfaite même à 8 %.'); }
        }
      }
      if (o.sym && plan2) { const m = Math.max(...As); As = [m, m]; }
      const Amax = 0.04 * geo.Ac * 1e4;
      if (As.reduce((s, v) => s + v, 0) > Amax) alertes.push(`Section d'acier totale supérieure à 4 % de la section de béton (${Amax.toFixed(1)} cm²).`);
      dim = { As, req };
      geo = avecAciers(geo, sec, As);
      if (plan2) sec.nappes.forEach((n, i) => (n.As = As[i])); else sec.As = As[0];
    }

    /* ── vérifications ── */
    const resELU = EL.map((r, k) => {
      const s2 = so(r);
      const c = Object.assign({}, r, { M: s2.M, type: +r.type || 1 });
      const v = elu(geo, mat, c);
      return Object.assign(v, { no: k + 1, M1: +r.M || 0, MEd: s2.M, so: s2, libType: typesELU[c.type] });
    });
    const resELS = ES.map((r, k) => {
      const n = nPour(mat, o, r), t = +r.type || 0;
      const e = els(geo, mat, { N: r.N, M: r.M, My: r.My, n });
      const scLim = t === 1 ? mat.sbcQP : mat.sbc;
      const ssLim = mat.regl === 'EC2' ? (t === 0 ? mat.ssLim : Infinity) : mat.ssLim;
      const okS = -e.ssMin <= ssLim + 1e-6, okC = e.sc <= scLim + 1e-6, okM = e.smoy <= mat.smoyLim + 1e-6;
      let w = null;
      if (mat.regl === 'EC2' && o.wkCalcul && t === (o.wkType ?? 2) && d.forme !== 'poly') w = wk(geo, mat, e, wkOpts(faceOf(r)));
      return Object.assign(e, { no: k + 1, Mqp: r.Mqp, type: t, libType: TYPES_ELS[t], scLim, ssLim, ok: okS && okC && okM && (!w || w.ok !== false), okS, okC, okM, wk: w });
    });
    const limFat = +o.dsFat || 162.5 / 1.15;
    const resFat = FT.map((f, k) => Object.assign(fatigue(geo, mat, f, limFat), { no: k + 1, f }));

    /* ── effort tranchant et torsion pour les lignes ELU qui en portent ── */
    const resCis = [];
    for (const r of EL) {
      if (!(+r.V) && !(+r.T)) continue;
      const L = lois(mat, +r.type || 1);
      let bw, h, dd, z, Asl = 0;
      if (geo.kind === 'cercle') { const R = geo.D / 2; bw = geo.D / 1.4; dd = R + geo.rs / Math.PI; h = geo.D; z = 0.9 * dd; Asl = geo.AsTot / 2; }
      else if (geo.plan) {
        bw = geo.kind === 'te' ? geo.bw : geo.b; h = geo.h;
        const tendue = geo.bars.filter((b) => ((+r.M || 0) >= 0 ? b.y > 0 : b.y < 0));
        const grp = tendue.length ? tendue : geo.bars;
        Asl = grp.reduce((s, b) => s + b.A, 0) * 1e4;
        dd = grp.length ? grp.reduce((s, b) => s + b.A * ((+r.M || 0) >= 0 ? geo.h - b.d : b.d), 0) / grp.reduce((s, b) => s + b.A, 0) : 0.9 * h;
        if (!(dd > 0)) dd = 0.9 * h;
        z = 0.9 * dd;
      } else continue;
      if (geo.kind === 'cercle' && +r.T) alertes.push('Torsion non traitée pour la section circulaire.');
      const x = mat.regl === 'EC2'
        ? tranchantEC2({ bw, h, d: dd, z, b: geo.kind === 'te' ? geo.bw : bw, Ac: geo.Ac, Asl: o.AslCis ?? Asl, N: r.N, V: r.V, T: geo.kind === 'cercle' ? 0 : r.T, fck: mat.fc, fyk: mat.fyk, gc: L.gc, gs: L.gs, cot: o.cot ?? 'libre', element: o.element || 'poutre' })
        : tranchantBAEL({ b0: bw, h, d: dd, fc28: mat.fc, fe: mat.fyk, gb: lois(mat, 1).gc, gs: L.gs, fissuration: mat.fissuration, N: r.N, V: r.V, T: geo.kind === 'cercle' ? 0 : r.T, reprise: o.reprise || 0 });
      resCis.push(Object.assign(x, { no: EL.indexOf(r) + 1, bw, d: dd }));
    }

    const verdict = resELU.every((r) => r.ok) && resELS.every((r) => r.ok) && resFat.every((r) => r.ok) && resCis.every((r) => r.ok);
    return { mat, geo, sec, elu: resELU, els: resELS, fat: resFat, cis: resCis, dim, verdict, alertes,
      typesELU, typesELS: TYPES_ELS, pr: geo.plan ? props(geo, mat.regl === 'BAEL' ? (+o.n || 15) : mat.Es / mat.Ecm) : null };
  }

  /* ════════════════════════════ LECTURE D'UN FICHIER .don (format d'origine) ════════════════════════════ */
  function lireDon(txt) {
    const L = txt.replace(/\r/g, '').split('\n');
    const kv = {}, pts = [], nap = [], els = [], elu = [], develu = [], devels = [], elf = [];
    let i = 0;
    const nums = (s) => (s || '').trim().split(/\s+/).map(Number).filter((x) => Number.isFinite(x));
    while (i < L.length) {
      const line = L[i];
      if (/^\s*;/.test(line) || !line.trim()) { i++; continue; }
      const key = line.split(/[\s;]/)[0].trim();
      if (key === 'FIN_DICO') break;
      const next = L[i + 1] ?? '';
      if (key === 'POINT') { const v = nums(next); if (v.length >= 2) pts.push(v.slice(0, 2)); i += 2; continue; }
      if (key === 'NAPPE') { const v = nums(next); if (v.length >= 6) nap.push(v); i += 2; continue; }
      const blocks = { ELS: els, ELU: elu, DEVELU: develu, DEVELS: devels, ELF: elf };
      if (blocks[key]) { const v = nums(next); if (v.length) blocks[key].push(v); i += 2; continue; }
      kv[key.toLowerCase()] = next.trim(); i += 2;
    }
    return { kv, points: pts, nappes: nap, els, elu, develu, devels, elf };
  }
  /* conversion .don → données du moteur (typecalculs : 1 T vérif, 2 T dim(?), 3 rect dim, 5/6 rect vérif, 8/9 cercle, 13/18 quelconque) */
  function donVersDonnees(txt) {
    const D = lireDon(txt), k = D.kv, f = (n, def = 0) => { const v = parseFloat(k[n]); return Number.isFinite(v) ? v : def; };
    const tc = f('typecalculs', 6), regl = f('reglement', 0) === 1 ? 'EC2' : 'BAEL';
    const out = { regl, materiau: { fck: f('fcj', 30), fyk: f('fe', 500), fissuration: f('fissur', 1), livret: f('pra', 0) === 1 && regl === 'BAEL', classe: ['A', 'B', 'C'][f('classeaciers', 1)] || 'B', phi: f('coeffluage', 2) },
      options: { L: f('longpiece', 0), lf: f('longflamb', 0), n: f('nbael', 15), nCalcule: f('calculnbael', 0) === 1, wkCalcul: f('calculdirectfissur', 0) >= 1, cot: f('tetaefftran', 45) ? 1 / Math.tan(f('tetaefftran', 45) * Math.PI / 180) : 'libre', reprise: f('reprise', 0), sym: f('aciersym', 0) === 1,
        fissu: { sup: { c: f('enrobsup', 30), phi: f('diamequivsup', 20), s: f('espacementsup', 200) }, inf: { c: f('enrobinf', 30) || f('enrobsup', 30), phi: f('diamequivinf', 20) || f('diamequivsup', 20), s: f('espacementinf', 200) || f('espacementsup', 200) } } },
      projet: [k.projet, k.oriligne, k.commentaire].filter(Boolean).join(' — '), typecalculs: tc };
    if (f('calcultypepieu', 0) > 0) out.options.pieu = { actif: true, k1: 1.2, k2: 1, fclim: 25 };
    const htot = f('htot'), b0 = f('b0');
    if (tc === 13 || tc === 18 || tc === 20 || tc === 19) {
      out.forme = 'poly'; out.mode = 'verif';
      out.section = { points: D.points, nappes: D.nappes.map((v) => ({ n: v[0], As: v[1] * 1e4, x1: v[2], y1: v[3], x2: v[4], y2: v[5] })), grille: Math.min(120, f('nbcarresxy', 60)) };
      if (f('pteffx') || f('pteffy')) out.section.ref = { x: f('pteffx'), y: f('pteffy') };
      out.els = D.devels.filter((v) => v.length >= 3).map((v) => ({ M: v[0], My: v[1], N: v[2], type: 0 }));
      out.elu = D.develu.filter((v) => v.length >= 3).map((v) => ({ M: v[0], My: v[1], N: v[2], V: v[3] || 0, type: v[4] || 1 }));
      return out;
    }
    if (f('diam') > 0 && (tc === 8 || tc === 9 || tc === 10 || tc === 11)) {
      out.forme = 'cercle'; out.mode = tc === 8 || tc === 10 ? 'dim' : 'verif';
      out.section = { D: f('diam'), a: f('distacier'), As: f('astot') * 1e4, nb: f('nbasrx', 0) || 20 };
    } else if (f('hauttable') > 0 || tc === 1 || tc === 2) {
      out.forme = 'te'; out.mode = tc === 2 ? 'dim' : 'verif';
      const nap = []; for (let j = 1; j <= 5; j++) if (f('hutile' + j) > 0) nap.push({ d: f('hutile' + j), As: f('as' + j) * 1e4 });
      out.section = { b: f('largtable'), hf: f('hauttable'), bw: b0, h: htot, bi: f('largtalon'), hi: f('hauttalon'), nappes: nap };
    } else {
      out.forme = 'rect'; out.mode = tc === 3 || tc === 4 ? 'dim' : 'verif';
      out.section = { b: b0, h: htot, nappes: [{ d: f('hutilesup'), As: f('assup') * 1e4, nom: 'Supérieure' }, { d: f('hutileinf'), As: f('asinf') * 1e4, nom: 'Inférieure' }] };
    }
    // ELS : M, N, Mcp, type (0 car., 1 QP, 2 fréq.) ; ELU : M, Mcp, N, V, T, type (1..5)
    out.els = D.els.filter((v) => v.length >= 2).map((v) => ({ M: v[0], N: v[1], Mqp: v.length >= 3 ? v[2] : v[0], type: v[3] || 0 }));
    out.elu = D.elu.filter((v) => v.length >= 3).map((v) => ({ M: v[0], Mcp: v[1], N: v[2], V: v[3] || 0, T: v[4] || 0, type: v[5] || 1 }));
    return out;
  }

  /* ════════════════════════════ SVG : diagramme d'interaction (chaîne, sans DOM) ════════════════════════════ */
  function svgInteraction(inter, pts = [], opts = {}) {
    const W = opts.w || 640, H = opts.h || 360, Lm = 64, R = 16, T = 16, B = 38;
    const all = inter.pos.concat(inter.neg).concat(pts.map((p) => ({ N: p.N, M: p.M })));
    let n0 = Math.min(...all.map((p) => p.N)), n1 = Math.max(...all.map((p) => p.N));
    let m0 = Math.min(...all.map((p) => p.M)), m1 = Math.max(...all.map((p) => p.M));
    const pn = (n1 - n0) * 0.06 || 1, pm = (m1 - m0) * 0.08 || 1; n0 -= pn; n1 += pn; m0 -= pm; m1 += pm;
    const X = (m) => Lm + (m - m0) / (m1 - m0) * (W - Lm - R), Y = (n) => T + (n1 - n) / (n1 - n0) * (H - T - B);
    const tick = (a, b, k) => { const st = Math.pow(10, Math.floor(Math.log10((b - a) / k))); const s = [1, 2, 5, 10].find((q) => (b - a) / (q * st) <= k) * st; const o = []; for (let v = Math.ceil(a / s) * s; v <= b; v += s) o.push(+v.toFixed(8)); return o; };
    const f0 = (v) => Math.round(v).toLocaleString('fr-FR');
    let g = '';
    for (const t of tick(n0, n1, 6)) g += `<line x1="${Lm}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="rgba(20,23,31,.07)"/><text x="${Lm - 6}" y="${Y(t) + 3}" text-anchor="end">${f0(t)}</text>`;
    for (const t of tick(m0, m1, 7)) g += `<line y1="${T}" y2="${H - B}" x1="${X(t)}" x2="${X(t)}" stroke="rgba(20,23,31,.05)"/><text x="${X(t)}" y="${H - B + 14}" text-anchor="middle">${f0(t)}</text>`;
    g += `<line x1="${X(0)}" x2="${X(0)}" y1="${T}" y2="${H - B}" stroke="#14171f" stroke-width=".8"/><line x1="${Lm}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#14171f" stroke-width=".8"/>`;
    const path = inter.pos.map((p) => `${X(p.M).toFixed(1)},${Y(p.N).toFixed(1)}`).concat(inter.neg.slice().reverse().map((p) => `${X(p.M).toFixed(1)},${Y(p.N).toFixed(1)}`)).join(' ');
    g += `<polygon points="${path}" fill="${opts.fill || '#a8842a'}" fill-opacity=".10" stroke="${opts.stroke || '#a8842a'}" stroke-width="1.6" stroke-linejoin="round"/>`;
    pts.forEach((p) => {
      const c = p.ok === false ? '#c0392b' : '#0f8f7b';
      g += `<circle cx="${X(p.M)}" cy="${Y(p.N)}" r="4.2" fill="${c}" stroke="#fff" stroke-width="1"/>${p.lab ? `<text x="${X(p.M) + 7}" y="${Y(p.N) - 6}" style="fill:${c}">${p.lab}</text>` : ''}`;
    });
    g += `<text x="${W - R}" y="${H - 6}" text-anchor="end">M (kN·m) — positif : fibre inférieure comprimée</text><text x="12" y="${T + 4}" transform="rotate(-90 12 ${T + 4})" text-anchor="end">N (kN) — compression +</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagramme d'interaction N-M">${g}</svg>`;
  }

  const API = { materiau, lois, ec2Beton, rect, te, cercle, poly, elu, interaction, contourMxMy, MRdAt, els, props, nEff, wk,
    tranchantEC2, tranchantBAEL, secondOrdre, fatigue, dimELU2, calcul, lireDon, donVersDonnees, svgInteraction, construire,
    TYPES_ELU, TYPES_ELU_BAEL, TYPES_ELS, _integre: integre, _ultimeN: ultimeN };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) { root.BA = root.BA || {}; root.BA.sectionBA = API; }
})(typeof window !== 'undefined' ? window : globalThis);
