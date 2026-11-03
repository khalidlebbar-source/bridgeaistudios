/* APPMOBIL — appareils d'appui en élastomère fretté (type B : rectangulaires et circulaires).
 * Moteur pur (aucun DOM) : node → module.exports, navigateur → window.BA.elastomeres.
 *
 * Trois référentiels :
 *  'en1337'    NF EN 1337-3 (2005) §5.3.3, avec les précisions du guide Sétra « Appareils d'appui en élastomère
 *              fretté » (2007) ; vérifications aux ELU (et ELS pour la pression), soulèvement selon guide Sétra 2000 §3.4.2.
 *  'setra2000' Guide technique Sétra septembre 2000 (rédigé sur le projet de norme) : mêmes formules de distorsion,
 *              mais distorsion et frettes vérifiées à l'ELS (ε ≤ 5, εq ≤ 0,7), rotation et flambement à l'ELU et à l'ELS,
 *              glissement à l'ELU (μ forfaitaire) et à l'ELS (μ = 0,1 + Kf/σm).
 *  'livret'    Livret 2.01 (1995), méthode des contraintes de cisaillement du Bulletin technique n°4 Sétra :
 *              τN + τH + τα ≤ 5G, τH1 et τH limités, rotation limite, frettes ts ≥ a σm/(β σe), non-cheminement (ELES).
 *
 * Unités : efforts en kN, longueurs en m, rotations en rad, modules et contraintes en MPa (convertis en kPa en interne).
 * Repère : a = côté parallèle à X (direction des efforts Fx, des déplacements vx et du bras de levier de la rotation αa),
 * b = côté parallèle à Y. Pour un appareil circulaire, D est le diamètre.
 *
 * Conventions de saisie (EN 1337-3 et Sétra 2000), une ligne par combinaison :
 *  type  : 'ELUmax' | 'ELUmin' | 'ELSmax' | 'ELSmin'
 *  Nld, Ncd        effort vertical de longue durée (permanent) et de courte durée (variable)      kN
 *  Hxld, Hyld      effort horizontal de longue durée (ou déplacement lent en m si hmode = 'v')    kN | m
 *  Hxcd, Hycd      effort horizontal de courte durée (freinage, vent…)                             kN
 *  aa, ab          rotations de calcul autour des axes parallèles à b et à a (sans α0)             rad
 *  vx, vy          déplacements horizontaux totaux (pour la surface réduite Ar)                    m
 * Les actions de longue durée sont associées au module G, celles de courte durée à Gd (= 2G par défaut,
 * guide Sétra : module conventionnel doublé pour les effets rapides).
 */
(function (root) {
  'use strict';
  const MPA = 1000; // 1 MPa = 1000 kPa

  /* ── Catalogues de dimensions courantes ─────────────────────────────────────────────────────────
   * EN 1337-3 tableau 3 (appareils de type B), enrobages supérieur/inférieur 2,5 mm, enrobage latéral 5 mm.
   * Les feuillets intermédiaires sont au nombre de n, les frettes de n + 1. */
  const CAT_EC_SRC = [ // [a, b, ti, ts, nombre de frettes min, max] ; feuillets intermédiaires n = frettes − 1
    [100, 150, 8, 3, 3, 4], [100, 200, 8, 3, 3, 4], [150, 200, 8, 3, 3, 5], [150, 250, 8, 3, 3, 5], [150, 300, 8, 3, 3, 5],
    [200, 250, 8, 3, 4, 7], [200, 300, 8, 3, 4, 7], [200, 350, 8, 3, 4, 7], [250, 300, 8, 3, 4, 8], [200, 400, 8, 3, 4, 7],
    [250, 400, 8, 3, 4, 8], [300, 400, 12, 4, 4, 7], [300, 500, 12, 4, 4, 7], [350, 450, 12, 4, 4, 8], [300, 600, 12, 4, 4, 7],
    [400, 500, 12, 4, 5, 9], [400, 600, 12, 4, 5, 9], [450, 600, 12, 4, 5, 10], [500, 600, 12, 4, 5, 11], [600, 600, 16, 5, 5, 10],
    [600, 700, 16, 5, 5, 10], [700, 700, 16, 5, 5, 11], [700, 800, 16, 5, 5, 11], [800, 800, 20, 5, 5, 11], [900, 900, 20, 5, 5, 12],
  ];
  /* Ancienne norme NF T47-815 (1993-1996), utilisée avec le Livret 2.01 : n(t + ts), contrainte admissible
   * σ pont-rail (11, 12 ou 15 MPa selon la taille) et pont-route (15 MPa). [σPRA, a, b, t, ts, nmin, nmax] */
  const CAT_NF_SRC = [
    [11, 100, 150, 8, 2, 2, 2], [11, 100, 200, 8, 2, 2, 2], [11, 150, 200, 8, 2, 2, 3], [11, 150, 250, 8, 2, 2, 3],
    [12, 200, 200, 8, 2, 2, 4], [12, 150, 300, 8, 2, 2, 3], [12, 200, 250, 8, 2, 3, 4], [12, 200, 300, 8, 2, 3, 4],
    [12, 200, 350, 8, 2, 3, 4], [12, 250, 300, 10, 3, 3, 4], [12, 200, 400, 8, 2, 3, 4], [12, 250, 350, 10, 3, 3, 4],
    [15, 300, 300, 10, 3, 3, 5], [12, 250, 400, 10, 3, 3, 4], [15, 300, 400, 10, 3, 3, 5], [15, 300, 450, 10, 3, 3, 5],
    [15, 300, 500, 10, 3, 3, 5], [15, 350, 450, 12, 3, 3, 5], [15, 400, 400, 10, 3, 4, 5], [15, 400, 400, 12, 3, 4, 6],
    [15, 300, 550, 10, 3, 3, 5], [15, 300, 600, 10, 3, 3, 5], [15, 400, 500, 12, 3, 4, 6], [15, 400, 550, 12, 3, 4, 6],
    [15, 400, 600, 12, 3, 4, 6], [15, 500, 500, 10, 3, 5, 5], [15, 500, 500, 12, 3, 5, 8], [15, 450, 600, 12, 3, 4, 7],
    [15, 500, 600, 12, 3, 5, 8], [15, 600, 600, 16, 4, 4, 7], [15, 600, 650, 16, 4, 4, 7], [15, 600, 700, 16, 4, 4, 7],
    [15, 700, 700, 16, 4, 5, 7],
  ];
  /* Appareils circulaires : liste indicative (pas de catalogue d'origine), mêmes feuillets que les rectangulaires
   * de surface voisine. [D, ti, ts, nmin, nmax] */
  const CAT_CIRC_SRC = [
    [150, 8, 3, 2, 4], [200, 8, 3, 2, 5], [250, 8, 3, 3, 6], [300, 8, 3, 3, 7], [350, 12, 4, 3, 6], [400, 12, 4, 3, 7],
    [450, 12, 4, 4, 8], [500, 12, 4, 4, 9], [550, 12, 4, 4, 10], [600, 16, 5, 4, 9], [650, 16, 5, 4, 9], [700, 16, 5, 4, 10],
    [800, 20, 5, 4, 10], [900, 20, 5, 4, 11],
  ];
  const stableSortByArea = (arr) => arr.map((x, i) => [x, i]).sort((p, q) => (p[0].aire - q[0].aire) || (p[1] - q[1])).map((p) => p[0]);
  function catalogue(kind) {
    const out = [];
    if (kind === 'nf') {
      for (const [s, a, b, t, ts, n0, n1] of CAT_NF_SRC) for (let n = n0; n <= n1; n++)
        out.push({ forme: 'rect', a: a / 1000, b: b / 1000, ti: t / 1000, ts: ts / 1000, n, te: 0, c: 0.005, sigPRA: s, sigPRO: 15, aire: a * b / 1e6 });
    } else if (kind === 'circ') {
      for (const [D, t, ts, n0, n1] of CAT_CIRC_SRC) for (let n = n0; n <= n1; n++)
        out.push({ forme: 'circ', D: D / 1000, ti: t / 1000, ts: ts / 1000, n, te: 0.0025, c: 0.005, aire: Math.PI * D * D / 4e6 });
    } else {
      for (const [a, b, t, ts, f0, f1] of CAT_EC_SRC) for (let n = f0 - 1; n <= f1 - 1; n++)
        out.push({ forme: 'rect', a: a / 1000, b: b / 1000, ti: t / 1000, ts: ts / 1000, n, te: 0.0025, c: 0.005, aire: a * b / 1e6 });
    }
    return stableSortByArea(out);
  }

  /* ── valeurs par défaut ── */
  const DEF = {
    G: 0.9, Gd: 1.8, fy: 235, sigLim: 15, Eb: 2000, Kf: 0.6, Kp: 1.3, Kh: 1, gm: 1, Kl: 1, Kr: 3,
    alpha0: 0.003, kAlpha0: 1.35, epsLimELU: 7, epsqLimELU: 1, epsLimELS: 5, epsqLimELS: 0.7,
    sigLd: 3, muELU2000: 0.9, soulev: true, rotMin: false, hmode: 'F', enrobNorme: 0.0025,
    // Livret 2.01
    kH1: 0.7, kH: 1.0, kTau: 5, sigMinEles: 2, acier: 'fe360',
  };
  // limite élastique des frettes, Livret 2.01 (valeurs du fichier réglementaire d'origine)
  const feLivret = (acier, ts) => acier === 'inox' ? (ts <= 0.003 + 1e-9 ? 275 : 245) : (ts <= 0.003 + 1e-9 ? 215 : 235);

  /* ── géométrie ── */
  function geom(p) {
    const g = { forme: p.forme || 'rect', n: p.n, ti: p.ti, te: p.te || 0, ts: p.ts, c: p.c ?? 0.005 };
    if (g.forme === 'circ') {
      g.D = p.D; g.Dp = p.D - 2 * g.c;
      g.A = Math.PI * p.D * p.D / 4; g.Ap = Math.PI * g.Dp * g.Dp / 4;
      g.lp = Math.PI * g.Dp;                    // périmètre chargé
      g.amin = g.Dp;
    } else {
      g.a = p.a; g.b = p.b; g.ap = p.a - 2 * g.c; g.bp = p.b - 2 * g.c;
      g.A = p.a * p.b; g.Ap = g.ap * g.bp; g.lp = 2 * (g.ap + g.bp);
      g.amin = Math.min(g.ap, g.bp);
    }
    // EN 1337-3 §5.3.3.1 : facteur de forme S = A'/(lp·te) ; pour les feuillets extérieurs, épaisseur 1,4·e.
    // Les enrobages normalisés de 2,5 mm ne sont pas des feuillets : facteur 1,4 appliqué au-delà (comme le programme de référence).
    g.S = g.Ap / (g.lp * g.ti);
    g.kext = g.te > DEF.enrobNorme + 1e-9 ? 1.4 : 1;
    g.Se = g.te > 0 ? g.Ap / (g.lp * g.kext * g.te) : 0;
    g.Te = g.n * g.ti + 2 * g.te;                 // épaisseur totale d'élastomère
    g.sumT3 = g.n * Math.pow(g.ti, 3) + 2 * Math.pow(g.te, 3);
    g.H = g.Te + (g.n + 1) * g.ts;                // hauteur totale (n + 1 frettes)
    return g;
  }
  // surface réduite EN 1337-3 §5.3.3.2
  function Ar(g, vx, vy) {
    if (g.forme === 'circ') {
      const v = Math.hypot(vx, vy);
      if (v >= g.Dp) return 0;
      const d = 2 * Math.acos(v / g.Dp);
      return g.Ap * (d - Math.sin(d)) / Math.PI;
    }
    return g.Ap * Math.max(0, 1 - Math.abs(vx) / g.ap - Math.abs(vy) / g.bp);
  }
  // Σ ti/A'·(1/(5 G S²) + 1/Eb) : souplesse verticale (m/kN), EN 1337-3 §5.3.3.7
  function soupV(g, G, Eb) {
    const f = (t, S) => t * (1 / (5 * G * MPA * S * S) + 1 / (Eb * MPA));
    let s = g.n * f(g.ti, g.S);
    if (g.te > 0) s += 2 * f(g.te, g.Se);
    return s / g.Ap;
  }

  /* Raideurs utilisables par REPHOR : horizontale K = G·A/Te (EN 1337-3 §5.3.3.7, A = surface en plan totale),
   * verticale Kv = 1/Σvz par kN (EN 1337-3 §5.3.3.7, modules G et Eb). Retour en kN/m. */
  function raideurs(p, o = {}) {
    const G = o.G ?? DEF.G, Gd = o.Gd ?? DEF.Gd, Eb = o.Eb ?? DEF.Eb;
    const g = geom(p);
    const T = o.regl === 'livret' ? g.n * g.ti : g.Te;
    const res = { Kh: G * MPA * g.A / T, Khd: Gd * MPA * g.A / T, Te: T };
    if (o.regl === 'livret' && g.forme === 'rect') res.Kv = kvLivret(g, G);
    else res.Kv = 1 / soupV(g, G, Eb);
    return res;
  }

  /* Coefficient K1 de la raideur verticale d'un feuillet rectangulaire incompressible (BT4 Sétra annexe 3.2.1) :
   * v = N t³ K1/(G a³ b) ; solution en série de l'écoulement de cisaillement, r = b/a ≥ 1. */
  function K1(r) {
    if (r < 1) r = 1 / r;
    let s = 0;
    for (let k = 1; k < 60; k += 2) s += Math.tanh(k * Math.PI * r / 2) / Math.pow(k, 5);
    return 1 / (1 - 192 / (Math.pow(Math.PI, 5) * r) * s);
  }
  function kvLivret(g, G) {
    const a = Math.min(g.ap, g.bp), b = Math.max(g.ap, g.bp);
    return Math.pow(a, 3) * b * G * MPA / (Math.pow(g.ti, 3) * K1(b / a) * g.n);
  }

  /* ── combinaisons : grandeurs dérivées ── */
  function combo(g, c, o) {
    const G = o.G * MPA, Gd = o.Gd * MPA;
    const elu = c.type === 'ELUmax' || c.type === 'ELUmin';
    let Fxld = c.Hxld || 0, Fyld = c.Hyld || 0, ux = 0, uy = 0;
    if (o.hmode === 'v') { // Hxld, Hyld = déplacements lents (m) → effort G·A·u/Te
      ux = Fxld; uy = Fyld; Fxld = G * g.A * ux / g.Te; Fyld = G * g.A * uy / g.Te;
    }
    const Fxcd = c.Hxcd || 0, Fycd = c.Hycd || 0;
    let vx = c.vx || 0, vy = c.vy || 0;
    if (o.hmode === 'v') { vx = ux + Fxcd * g.Te / (Gd * g.A); vy = uy + Fycd * g.Te / (Gd * g.A); }
    const k0 = elu ? o.kAlpha0 : 1;
    const aa = Math.abs(c.aa || 0) + k0 * o.alpha0, ab = Math.abs(c.ab || 0);
    const Nld = c.Nld || 0, Ncd = c.Ncd || 0, Fz = Nld + Ncd;
    const ar = Ar(g, vx, vy);
    return { c, elu, Nld, Ncd, Fz, Fxld, Fyld, Fxcd, Fycd, vx, vy, aa, ab, Ar: ar, ux, uy,
      Fxy: Math.hypot(Fxld + Fxcd, Fyld + Fycd), Hld: Math.hypot(Fxld, Fyld), Hcd: Math.hypot(Fxcd, Fycd) };
  }

  /* εc, εq, εα (EN 1337-3 §5.3.3.2 à 5.3.3.4) ; ψ < 1 : surface comprimée partielle (soulèvement, Sétra 2000 §3.4.2) */
  function distorsions(g, k, o) {
    const G = o.G * MPA, Gd = o.Gd * MPA;
    const ec = 1.5 * k.Nld / (G * k.Ar * g.S) + 1.5 * k.Ncd / (Gd * k.Ar * g.S);
    const eq = o.hmode === 'v'
      ? Math.hypot(k.ux, k.uy) / g.Te + k.Hcd / (Gd * g.A)
      : k.Hld / (G * g.A) + k.Hcd / (Gd * g.A);
    const ea = g.forme === 'circ'
      ? 3 * g.Dp * g.Dp * Math.hypot(k.aa, k.ab) * g.ti / (8 * g.sumT3)
      : (g.ap * g.ap * k.aa + g.bp * g.bp * k.ab) * g.ti / (2 * g.sumT3);
    return { ec, eq, ea, et: o.Kl * (ec + eq + ea) };
  }
  function tsMin(g, k, o) { // EN 1337-3 §5.3.3.5 : ts = Kp Fz (t1 + t2) Kh γm/(Ar fy), t1 = t2 = ti (frettes sans trous)
    return o.Kp * k.Fz * 2 * g.ti * o.Kh * o.gm / (k.Ar * o.fy * MPA);
  }
  function rotation(g, k, o) { // EN 1337-3 §5.3.3.6
    const sv = k.Nld * soupV(g, o.G, o.Eb) + k.Ncd * soupV(g, o.Gd, o.Eb);
    const req = g.forme === 'circ' ? g.Dp * Math.hypot(k.aa, k.ab) / o.Kr : (g.ap * k.aa + g.bp * k.ab) / o.Kr;
    return { sv, req };
  }
  function flambement(g, k, o) { // EN 1337-3 §5.3.3.6 : Fz/Ar < 2 a' G S1/(3 Te)
    return { sig: k.Fz / k.Ar, lim: 2 * g.amin * o.G * MPA * g.S / (3 * g.Te) };
  }
  function soulevement(g, k, o, psi) { // guide Sétra 2000 §3.4.2 : 2 εα(ψ) < εc(ψ), surface comprimée ψ·a'
    const G = o.G * MPA, Gd = o.Gd * MPA;
    const Ap = psi * g.ap * g.bp, S = Ap / (2 * (psi * g.ap + g.bp) * g.ti);
    const ea = (psi * psi * g.ap * g.ap * k.aa + g.bp * g.bp * k.ab) * g.ti / (2 * g.sumT3);
    const ec = 1.5 * k.Nld / (G * Ap * S) + 1.5 * k.Ncd / (Gd * Ap * S);
    return { ea, ec, Ap, S };
  }

  /* ── vérification EN 1337-3 et Sétra 2000 ── */
  function verifEC(p, combis, oo) {
    const o = Object.assign({}, DEF, oo);
    const g = geom(p);
    const ks = combis.map((c) => combo(g, c, o));
    const by = (t) => ks.filter((k) => t.includes(k.c.type));
    const ELU = by(['ELUmax', 'ELUmin']), ELUmax = by(['ELUmax']), ELUmin = by(['ELUmin']), ELSmax = by(['ELSmax']), ELSmin = by(['ELSmin']), ELS = by(['ELSmax', 'ELSmin']);
    const s2000 = o.regl === 'setra2000';
    const crit = [];
    const art = s2000 ? 'Sétra 2000 ' : 'EN 1337-3 ';
    // garde-fou : appareil en traction ou surface réduite nulle
    for (const k of ks) if (k.Ar <= 0 || k.Fz <= 0) crit.push({ id: 'ar', nom: 'Appareil comprimé, surface réduite > 0', ref: art + '§5.3.3.2', comb: ks.indexOf(k) + 1, val: k.Fz, lim: 0, taux: Infinity, ok: false, sel: true, txt: 'Fz ≤ 0 ou Ar ≤ 0' });
    const ok = (k) => k.Ar > 0 && k.Fz > 0;
    const worst = (arr, f) => { let best = null; for (const k of arr.filter(ok)) { const r = f(k); if (!best || r.taux > best.taux) best = r; } return best; };
    const push = (r) => { if (r) crit.push(r); };

    // 1. pression maximale ELS : σ = Fz/A' ≤ σlim
    push(worst(ELSmax.length ? ELSmax : ELS, (k) => { const s = k.Fz / g.Ap / MPA; return { id: 'sig', nom: 'Pression moyenne ELS', ref: s2000 ? 'Sétra 2000 §3.4.1.6' : 'EN 1337-3 §5.3.3.7 · guide Sétra', comb: ks.indexOf(k) + 1, val: s, lim: o.sigLim, unit: 'MPa', taux: s / o.sigLim, ok: s <= o.sigLim + 1e-9, sel: true, txt: 'σm = Fz/A′' }; }));
    // 2. distorsion totale et distorsion de cisaillement
    const distSet = s2000 ? ELS : ELU;
    const eLim = s2000 ? o.epsLimELS : o.epsLimELU / o.gm, qLim = s2000 ? o.epsqLimELS : o.epsqLimELU;
    const dist = ks.map((k) => (ok(k) ? distorsions(g, k, o) : null));
    push(worst(distSet, (k) => { const d = dist[ks.indexOf(k)]; return { id: 'et', nom: 'Distorsion totale εt = KL(εc + εq + εα)', ref: s2000 ? 'Sétra 2000 §3.4.1.1' : 'EN 1337-3 §5.3.3 (5.3.3.2 à 5.3.3.4)', comb: ks.indexOf(k) + 1, val: d.et, lim: eLim, taux: d.et / eLim, ok: d.et <= eLim + 1e-9, sel: true, d, txt: `εc = ${d.ec.toFixed(3)} · εq = ${d.eq.toFixed(3)} · εα = ${d.ea.toFixed(3)}` }; }));
    push(worst(distSet, (k) => { const d = dist[ks.indexOf(k)]; return { id: 'eq', nom: 'Distorsion due aux efforts horizontaux εq', ref: s2000 ? 'Sétra 2000 §3.4.1.1' : 'EN 1337-3 §5.3.3.3', comb: ks.indexOf(k) + 1, val: d.eq, lim: qLim, taux: d.eq / qLim, ok: d.eq <= qLim + 1e-9, sel: true, txt: o.hmode === 'v' ? 'εq = vxy/Tq + Fxy,rapide/(Gd·A)' : 'εq = Fxy/(G·A) + Fxy,rapide/(Gd·A)' }; }));
    // 3. frettes
    const fretSet = s2000 ? (ELSmax.length ? ELSmax : ELS) : ELU;
    push(worst(fretSet, (k) => { const t = tsMin(g, k, o), tr = Math.max(0.002, t); return { id: 'ts', nom: 'Épaisseur des frettes', ref: s2000 ? 'Sétra 2000 §3.4.1.2' : 'EN 1337-3 §5.3.3.5', comb: ks.indexOf(k) + 1, val: t * 1000, lim: g.ts * 1000, unit: 'mm', taux: tr / g.ts, ok: tr <= g.ts + 1e-9, sel: 'ts', tsReq: tr, txt: 'ts ≥ max(2 mm ; Kp·Fz·2ti·Kh·γm/(Ar·fy))' }; }));
    // 4. stabilité en rotation
    const rotSets = s2000 ? [['ELU', ELUmax.length ? ELUmax : ELU], ['ELS', ELSmax.length ? ELSmax : ELS]] : [['ELU', o.rotMin ? ELU : (ELUmax.length ? ELUmax : ELU)]];
    for (const [nm, set] of rotSets) push(worst(set, (k) => { const r = rotation(g, k, o); return { id: 'rot' + nm, nom: 'Stabilité en rotation' + (s2000 ? ' (' + nm + ')' : ''), ref: s2000 ? 'Sétra 2000 §3.4.1.3' : 'EN 1337-3 §5.3.3.6', comb: ks.indexOf(k) + 1, val: r.req * 1000, lim: r.sv * 1000, unit: 'mm', taux: r.req / r.sv, ok: r.sv >= r.req - 1e-12, sel: true, r, txt: 'Σvz ≥ (a′αa + b′αb)/Kr' }; }));
    // 5. flambement
    const flSets = s2000 ? [['ELU', ELUmax.length ? ELUmax : ELU], ['ELS', ELSmax.length ? ELSmax : ELS]] : [['ELU', ELU]];
    for (const [nm, set] of flSets) push(worst(set, (k) => { const f = flambement(g, k, o); return { id: 'fl' + nm, nom: 'Stabilité au flambement' + (s2000 ? ' (' + nm + ')' : ''), ref: s2000 ? 'Sétra 2000 §3.4.1.4' : 'EN 1337-3 §5.3.3.6', comb: ks.indexOf(k) + 1, val: f.sig / MPA, lim: f.lim / MPA, unit: 'MPa', taux: f.sig / f.lim, ok: f.sig <= f.lim + 1e-9, sel: true, txt: 'Fz/Ar < 2a′·G·S1/(3Te)' }; }));
    // 6. glissement et contrainte minimale sous charges permanentes
    const glSets = s2000 ? [['ELU', ELUmin.length ? ELUmin : ELU, o.muELU2000], ['ELS', ELSmin.length ? ELSmin : ELS, null]] : [['ELU', ELUmin.length ? ELUmin : ELU, null]];
    for (const [nm, set, muF] of glSets) {
      push(worst(set, (k) => { const s = k.Fz / k.Ar / MPA; const mu = muF ?? (0.1 + (s2000 ? 1 : 1.5) * o.Kf / s); const R = mu * k.Fz; return { id: 'gl' + nm, nom: 'Non-glissement Fxy ≤ μe·Fz' + (s2000 ? ' (' + nm + ')' : ''), ref: s2000 ? 'Sétra 2000 §3.4.1.5' : 'EN 1337-3 §5.3.3.6', comb: ks.indexOf(k) + 1, val: k.Fxy, lim: R, unit: 'kN', taux: k.Fxy / R, ok: k.Fxy <= R + 1e-9, sel: true, mu, txt: muF ? `μ = ${muF}` : `μe = 0,1 + ${s2000 ? '' : '1,5·'}Kf/σm = ${mu.toFixed(3)}` }; }));
      push(worst(set, (k) => { const s = k.Nld / k.Ar / MPA; return { id: 'sld' + nm, nom: 'Contrainte minimale sous charges permanentes' + (s2000 ? ' (' + nm + ')' : ''), ref: s2000 ? 'Sétra 2000 §3.4.1.5' : 'EN 1337-3 §5.3.3.6', comb: ks.indexOf(k) + 1, val: s, lim: o.sigLd, unit: 'MPa', taux: o.sigLd / Math.max(s, 1e-9), ok: s >= o.sigLd - 1e-9, sel: false, txt: 'σm,ld = Fz,ld/Ar ≥ 3 MPa (sinon dispositif anti-cheminement)' }; }));
    }
    // 7. soulèvement (rectangulaires)
    if (o.soulev && g.forme === 'rect') {
      for (const [nm, set, psi] of [['max', ELSmax, 0.9], ['min', ELSmin, 0.8]]) push(worst(set, (k) => { const s = soulevement(g, k, o, psi); return { id: 'sv' + nm, nom: `Non-soulèvement ELS ${nm} (ψ = ${psi})`, ref: 'Sétra 2000 §3.4.2', comb: ks.indexOf(k) + 1, val: 2 * s.ea, lim: s.ec, taux: 2 * s.ea / s.ec, ok: 2 * s.ea <= s.ec + 1e-9, sel: true, s, txt: '2 εα(ψ) < εc(ψ)' }; }));
    }
    // tassement et raideur verticale (ELS max)
    let tass = null;
    const kref = (ELSmax.length ? ELSmax : ELS.length ? ELS : ks).filter(ok).sort((x, y) => y.Fz - x.Fz)[0];
    if (kref) { const sv = kref.Nld * soupV(g, o.G, o.Eb) + kref.Ncd * soupV(g, o.Gd, o.Eb); tass = { comb: ks.indexOf(kref) + 1, N: kref.Fz, vz: sv, Kv: kref.Fz / sv }; }
    return { g, ks, dist, crit, tass, rd: raideurs(p, o), o };
  }

  /* ── vérification Livret 2.01 (BT4 Sétra) ── */
  function verifLivret(p, L, oo) {
    const o = Object.assign({}, DEF, oo);
    const g = geom(Object.assign({}, p, { te: 0 }));
    const G = o.G * MPA, T = g.n * g.ti;
    const a = g.ap, ap = g.Ap; // a : côté parallèle à X (bras de levier de la rotation)
    const beta = g.Ap / (2 * g.ti * (g.ap + g.bp));
    const crit = [], push = (r) => r && crit.push(r);
    const amin = Math.min(g.ap, g.bp);
    // 1. non-flambement : a/10 < T < a/5
    push({ id: 'T', nom: 'Hauteur d’élastomère a/10 ≤ T ≤ a/5', ref: 'Livret 2.01 · BT4 Sétra', val: T * 1000, lim: amin / 5 * 1000, unit: 'mm', taux: Math.max(T / (amin / 5), (amin / 10) / T), ok: T >= amin / 10 - 1e-9 && T <= amin / 5 + 1e-9, sel: true, txt: `a/10 = ${(amin / 10 * 1000).toFixed(1)} mm · T = n·t = ${(T * 1000).toFixed(1)} mm · a/5 = ${(amin / 5 * 1000).toFixed(1)} mm` });
    // 2. ELS : contrainte moyenne
    const sMax = (L.Nmax || 0) / ap / MPA;
    push({ id: 'sig', nom: 'Pression moyenne ELS', ref: 'Livret 2.01 · BT4 Sétra', val: sMax, lim: o.sigLim, unit: 'MPa', taux: sMax / o.sigLim, ok: sMax <= o.sigLim + 1e-9, sel: true, txt: 'σm = Nmax/(a′·b′)' });
    // 3. ELS : rotation limite (non-soulèvement) αt = (αT + α0)/n ≤ 3/β·(t/a)²·σmin/G
    let wr = null;
    for (const m of (L.mins || []).filter((x) => x && x.N > 0)) {
      const smin = m.N / ap; const at = (Math.abs(m.alpha || 0) + o.alpha0) / g.n; const lim = 3 / beta * Math.pow(g.ti / a, 2) * smin / G;
      const r = { id: 'rot', nom: 'Rotation limite (non-soulèvement)', ref: 'Livret 2.01 · BT4 Sétra', val: at, lim, unit: 'rad', taux: at / lim, ok: at <= lim + 1e-12, sel: true, txt: `σmin = ${(smin / MPA).toFixed(2)} MPa · αt = (αT + α0)/n` };
      if (!wr || r.taux > wr.taux) wr = r;
    }
    push(wr);
    // 4. ELU : contraintes de cisaillement
    const rows = (L.elu || []).map((c, i) => {
      const N = c.N || 0, sm = N / ap;
      const u1 = Math.hypot(c.u1x || 0, c.u1y || 0), H2 = Math.hypot(c.H2x || 0, c.H2y || 0);
      const tH1 = G * u1 / T, tH2 = H2 / ap, tH = tH1 + 0.5 * tH2;
      const tN = 1.5 * sm / beta;                                          // τN = 3t(a+b)σm/(ab) = 1,5σm/β
      const ta = G / 2 * Math.pow(a / g.ti, 2) * Math.abs(c.aT || 0) / g.n; // τα = G/2 (a/t)² αT/n
      return { i: i + 1, N, sm, u1, H2, tH1, tH2, tH, tN, ta, t: tH + tN + ta };
    });
    const wmax = (f) => rows.reduce((m, r) => (!m || f(r) > f(m) ? r : m), null);
    if (rows.length) {
      let r = wmax((x) => x.tH1); push({ id: 'tH1', nom: 'τH1 = G·u1/T (déplacements lents)', ref: 'Livret 2.01 · BT4 Sétra', comb: r.i, val: r.tH1 / MPA, lim: o.kH1 * o.G, unit: 'MPa', taux: r.tH1 / (o.kH1 * G), ok: r.tH1 <= o.kH1 * G + 1e-9, sel: true, txt: `limite ${o.kH1}·G` });
      r = wmax((x) => x.tH); push({ id: 'tH', nom: 'τH = τH1 + 0,5·τH2', ref: 'Livret 2.01 · BT4 Sétra', comb: r.i, val: r.tH / MPA, lim: o.kH * o.G, unit: 'MPa', taux: r.tH / (o.kH * G), ok: r.tH <= o.kH * G + 1e-9, sel: true, txt: `limite ${o.kH}·G` });
      r = wmax((x) => x.t); push({ id: 'tau', nom: 'τ = τN + τH + τα', ref: 'Livret 2.01 · BT4 Sétra', comb: r.i, val: r.t / MPA, lim: o.kTau * o.G, unit: 'MPa', taux: r.t / (o.kTau * G), ok: r.t <= o.kTau * G + 1e-9, sel: true, txt: `τN = ${(r.tN / MPA).toFixed(3)} · τH = ${(r.tH / MPA).toFixed(3)} · τα = ${(r.ta / MPA).toFixed(3)} MPa` });
      // 5. frettes : ts ≥ a/β·σm/σe et ts ≥ 2 mm
      r = wmax((x) => x.sm); const fe = feLivret(o.acier, g.ts); const ts0 = a / beta * r.sm / (fe * MPA), tsr = Math.max(0.002, ts0);
      push({ id: 'ts', nom: 'Épaisseur des frettes', ref: 'Livret 2.01 · BT4 Sétra', comb: r.i, val: ts0 * 1000, lim: g.ts * 1000, unit: 'mm', taux: tsr / g.ts, ok: tsr <= g.ts + 1e-9, sel: 'ts', tsReq: tsr, fe, txt: `ts ≥ a′/β·σm/σe, σe = ${fe} MPa` });
    }
    // 6. ELES : non-cheminement et glissement
    if (L.Neles > 0) {
      const smin = L.Neles / ap / MPA, f = 0.1 + 0.6 / smin, R = f * L.Neles;
      push({ id: 'smin', nom: 'Non-cheminement σmin ≥ 2 MPa (ELES)', ref: 'Livret 2.01 · BT4 Sétra', val: smin, lim: o.sigMinEles, unit: 'MPa', taux: o.sigMinEles / smin, ok: smin >= o.sigMinEles - 1e-9, sel: false, txt: 'sinon dispositif anti-cheminement' });
      push({ id: 'gl', nom: 'Non-glissement H ≤ f·Nmin (ELES)', ref: 'Livret 2.01 · BT4 Sétra', val: L.Heles || 0, lim: R, unit: 'kN', taux: (L.Heles || 0) / R, ok: (L.Heles || 0) <= R + 1e-9, sel: true, txt: `f = 0,10 + 0,60/σmin = ${f.toFixed(3)}` });
    }
    const Kv = kvLivret(g, o.G);
    return { g, beta, T, rows, crit, tass: L.Nmax > 0 ? { N: L.Nmax, vz: L.Nmax / Kv, Kv, K1: K1(Math.max(g.ap, g.bp) / Math.min(g.ap, g.bp)) } : null, rd: raideurs(p, Object.assign({}, o, { regl: 'livret' })), o };
  }

  /* bossage : débord ≥ a/6 de chaque côté (4a/3) et ≥ 5 cm, arrondi au cm supérieur */
  const ceilCm = (x) => Math.ceil(x * 100 - 1e-6) / 100;
  function bossage(p) {
    if (p.forme === 'circ') { const d = ceilCm(Math.max(4 / 3 * p.D, p.D + 0.1)); return { a: d, b: d }; }
    return { a: ceilCm(Math.max(4 / 3 * p.a, p.a + 0.1)), b: ceilCm(Math.max(4 / 3 * p.b, p.b + 0.1)) };
  }

  /* ── point d'entrée ── */
  function verifier(inp) {
    const o = Object.assign({}, inp.opts || {}, { regl: inp.regl });
    const p = inp.plaque;
    const r = inp.regl === 'livret' ? verifLivret(p, inp.livret || {}, o) : verifEC(p, inp.combis || [], o);
    r.plaque = p; r.regl = inp.regl; r.bossage = bossage(p);
    r.ok = r.crit.every((c) => c.ok);
    r.okSel = r.crit.every((c) => c.ok || c.sel === false);
    r.tauxMax = Math.max(...r.crit.filter((c) => Number.isFinite(c.taux)).map((c) => c.taux), 0);
    return r;
  }
  /* Dimensionnement : parcours du catalogue par surface croissante puis nombre de feuillets croissant ;
   * retient le premier appareil qui satisfait tous les critères de choix. L'épaisseur des frettes est portée
   * au millimètre supérieur si nécessaire ; les critères de contrainte minimale (non-cheminement), qui
   * s'aggravent quand l'appareil grandit, ne sont pas des critères de choix : ils sont signalés. */
  function dimensionner(inp) {
    const o = Object.assign({}, DEF, inp.opts || {});
    const forme = inp.forme || 'rect';
    let cat = forme === 'circ' ? catalogue('circ') : inp.regl === 'livret' ? catalogue('nf') : catalogue('ec');
    if (inp.catalogue) cat = inp.catalogue;
    const rejets = [];
    for (const pl of cat) {
      const p = Object.assign({}, pl);
      if (inp.regl === 'livret') p.te = 0;
      const opts = Object.assign({}, inp.opts || {});
      if (inp.regl === 'livret' && pl.sigPRA) opts.sigLim = inp.ouvrage === 'route' ? pl.sigPRO : pl.sigPRA;
      let r, tsAug = false;
      for (let it = 0; it < 6; it++) {
        r = verifier({ regl: inp.regl, plaque: p, combis: inp.combis, livret: inp.livret, opts });
        const f = r.crit.find((c) => c.sel === 'ts' && !c.ok);
        if (!f) break;
        p.ts = Math.ceil(f.tsReq * 1000 - 1e-6) / 1000; tsAug = true;
      }
      if (r.okSel) { r.tsAugmente = tsAug ? { de: pl.ts, a: p.ts } : null; r.essais = rejets.length + 1; r.rejets = rejets.slice(-8); r.plaqueCatalogue = pl; return r; }
      const ko = r.crit.filter((c) => !c.ok && c.sel !== false).map((c) => c.nom);
      rejets.push({ plaque: pl, motifs: ko });
    }
    return { echec: true, rejets: rejets.slice(-8), essais: rejets.length, crit: [], regl: inp.regl };
  }
  function calc(inp) { return inp.mode === 'dim' ? dimensionner(inp) : verifier(inp); }

  /* ── lecture d'un fichier .don d'origine (format « clé ; commentaire » puis ligne de valeur) ── */
  function parseDon(txt) {
    const lines = String(txt).replace(/\r/g, '').split('\n');
    const kv = {}, multi = {};
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (!L.trim() || L.trim().startsWith(';')) continue;
      if (!L.includes(';')) { if (/FIN_DICO/.test(L)) break; continue; }
      const key = L.split(';')[0].trim().toLowerCase();
      const val = (lines[i + 1] ?? '').trim(); i++;
      if (key === 'combec' || key === 'combelu') (multi[key] = multi[key] || []).push(val.split(/\s+/).map(Number)); else kv[key] = val;
    }
    const n = (k, d = 0) => (kv[k] !== undefined && kv[k] !== '' && Number.isFinite(+kv[k]) ? +kv[k] : d);
    const reg = n('typereg', 1), regl = reg === 0 ? 'livret' : reg === 2 ? 'setra2000' : 'en1337';
    const nb = Math.round(n('nbfeuil', 2));
    const ALPHA = [0, 0.003, 0.01, 0.003];
    const ta = Math.round(n('typalpha', 0));
    const alpha0 = ta === 4 || ta >= ALPHA.length ? n('alpha0', 0) : ALPHA[ta];
    const r6 = (x) => Math.round(x * 1e6) / 1e6;
    const inp = {
      regl, mode: n('typecal', 0) === 0 ? 'dim' : 'verif', forme: 'rect', ouvrage: n('typeoa', 0) === 0 ? 'rail' : 'route',
      plaque: { forme: 'rect', a: r6(n('larga') / 1000), b: r6(n('largb') / 1000), n: regl === 'livret' ? nb : nb - 1, ti: r6(n('epfeuil') / 1000), ts: r6(n('epfret') / 1000),
        te: regl === 'livret' ? 0 : r6(n('enrobfretsupinf', 0.0025)), c: r6(n('enrobfretlat', 0.005)) },
      opts: {
        G: n('modtrvcaout', 0.9), Gd: n('modtrvdyncaout', 1.8), fy: n('fyfret', 235), sigLim: n('caoutlimels', 15), alpha0,
        Eb: n('modelastvol', 2000), Kf: n('surfpose', 0) === 1 ? 0.2 : n('kf', 0.6), Kp: n('kp', 1.3), Kh: n('kh', 1), gm: n('gamma', 1), Kl: n('kl', 1), Kr: n('krd', 3),
        kAlpha0: n('pondalpha0elu', 1.35), epsLimELU: n('limdefmaxelu', 7), epsqLimELU: n('limdistorelu', 1), epsLimELS: n('limdefmaxels', 5), epsqLimELS: n('limdistorels', 0.7),
        sigLd: n('limcontmoycomp', 3), muELU2000: n('coeffrotelusetra', 0.9), soulev: n('verifsoulev', 1) === 1, acier: n('typacierfret', 0) === 1 ? 'inox' : 'fe360', hmode: 'F',
      },
      combis: [], livret: null, projet: kv.projet || '',
    };
    const TYP = ['ELUmax', 'ELUmin', 'ELSmax', 'ELSmin'];
    for (const v of multi.combec || []) {
      if (v.length < 11 || v.slice(0, 10).every((x) => !x)) continue;
      const [Nld, Ncd, Fyld, Fycd, Fxld, Fxcd, Rota, Rotb, DpY, DepX, t] = v;
      inp.combis.push({ type: TYP[t] || 'ELUmax', Nld, Ncd, Hxld: Fxld, Hyld: Fyld, Hxcd: Fxcd, Hycd: Fycd, aa: Rota, ab: Rotb, vx: DepX, vy: DpY });
    }
    inp.livret = {
      Nmax: n('velsmax'), mins: [{ N: n('velsmin'), alpha: n('relsmin') }, { N: n('velsmin1'), alpha: n('relsmin1') }],
      Neles: n('veles'), Heles: n('heles'),
      elu: (multi.combelu || []).filter((v) => v.some((x) => x)).map(([N, H2x, H2y, aT, u1x, u1y]) => ({ N, H2x, H2y, aT, u1x, u1y })),
    };
    return inp;
  }

  const api = { DEF, catalogue, geom, Ar, raideurs, K1, verifier, dimensionner, calc, parseDon, bossage, feLivret };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.elastomeres = api; }
})(typeof window !== 'undefined' ? window : globalThis);
