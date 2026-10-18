/* BridgeAI Studios — Plans de coffrage & ferraillage : calculs (fonctions pures).
 *
 * Unités : géométrie en mètres, diamètres Ø en millimètres, masses en kg.
 * Utilisable dans le navigateur (window.FERR) et sous Node (module.exports).
 *
 * HYPOTHÈSES DE FAÇONNAGE (simplifiées, à vérifier par le projeteur)
 *  - Les cotes des segments sont des cotes hors-tout (nu extérieur des coudes),
 *    comme sur les plans de façonnage usuels.
 *  - Longueur développée = Σ cotes − Σ déductions de pliage + Σ crosses,
 *    arrondie au 5 mm le plus proche.
 *  - Déduction d'un coude d'angle θ ≤ 90°, mandrin D, rayon r = D/2 :
 *        Δ = 2(r + Ø)·tan(θ/2) − θ·(r + Ø/2)      (axe de la barre)
 *  - Crosse d'angle α en extrémité : longueur ajoutée
 *        Lc = α·(r + Ø/2) + retour droit − (r + Ø)
 *    retour droit EC2 (§8.5, fig. 8.5) : α ≥ 150° → max(5Ø ; 50 mm),
 *                                        90° ≤ α < 150° → max(10Ø ; 70 mm)
 *    retour droit BAEL (simplifié) : 10Ø quel que soit l'angle.
 *  - Mandrins : EC2 (§8.3, tableau 8.1N) Ø ≤ 16 → 4Ø, Ø > 16 → 7Ø ;
 *               BAEL (simplifié, HA) → 5Ø.
 *  - Nombre de barres réparties = floor(longueur de répartition / espacement) + 1.
 *  - Barres à densité (épingles, écarteurs) : ceil(surface × densité).
 *  - Mur : aciers verticaux parallèles aux parements (fruits), barres identiques
 *    des deux faces regroupées sous un même repère.
 *  - Barre plus longue que Lmax : découpe en k barres indicées (4a, 4b…) avec
 *    recouvrement l0 = n·Ø, k = ceil((L − l0)/(Lmax − l0)).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FERR = Object.assign(root.FERR || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIAMS = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40];
  const MASSE_LIN = { 6: 0.222, 8: 0.395, 10: 0.617, 12: 0.888, 14: 1.208, 16: 1.578, 20: 2.466, 25: 3.854, 32: 6.313, 40: 9.864 };
  const HOOKS = [0, 90, 135, 180];
  /* Paramétrage ADFER de KLE (aciers.dat) : diamètre d'encombrement (colonne REEL, Ø nominal + nervures) et
     couleur AutoCAD (ACI) par diamètre. L'encombrement sert au dessin (épaisseur des barres, diamètre des
     points) et au placement (enrobage au nu extérieur, imbrication des nappes, tangences). Longueurs
     développées, mandrins et masses restent au Ø nominal. */
  const ENCOMBREMENT = { 6: 8, 8: 10, 10: 12, 12: 14, 14: 17, 16: 19, 20: 24, 25: 30, 32: 38, 40: 48 };
  const COULEUR_ACI = { 6: 1, 8: 2, 10: 3, 12: 4, 14: 5, 16: 6, 20: 7, 25: 8, 32: 9, 40: 10 };
  const encM = (d) => (ENCOMBREMENT[d] || Math.round(1.2 * d)) / 1000;

  const DEFAULT_PARAMS = {
    norme: 'EC2',     // 'EC2' | 'BAEL'
    lmax: 12,         // longueur commerciale maximale (m)
    recouv: 50,       // recouvrement en nombre de Ø
    cTerre: 0.05,     // enrobage fondation / contact terre (m)
    cAutre: 0.03,     // enrobage autres parements (m)
    blocs: 1,         // nombre d'éléments identiques
    maintien: 'epingle', // barres de maintien des nappes : 'epingle' | 'etrier' (réglage global)
    fermeture: 'U',      // fermeture de la semelle : 'U' (nappes droites + U 5/6 + répartitions 7/8) | 'retours'
  };

  const rad = (deg) => deg * Math.PI / 180;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const round5mm = (x) => Math.round(x * 200 + 1e-9) / 200;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* Repères du mur (règle KLE) : semelle 1 à 9 —
       1 nappe inférieure transversale, 2 filants inférieurs, 3 nappe supérieure transversale,
       4 filants supérieurs, 5 U de fermeture vus en coupe transversale (patin et talon),
       6 U de fermeture vus en coupe longitudinale (joints du plot), 7 répartition des 5,
       8 répartition des 6, 9 maintien (épingles / étriers) ;
     voile à partir de 10 ; bêche (semelle pleine) juste après le dernier repère du voile. */
  const SEMELLE_IDS = { I: 1, FsI: 2, S: 3, FsS: 4, U5: 5, U6: 6, R7: 7, R8: 8, Es: 9 };
  /* Numéros fixes du voile (KLE) : face à fruit 10 attente, 11 courante, 12 renfort, 13 filants ; face opposée
     14 attente, 15 courante, 16 filants ; 17 fourchette de tête ; 18 maintien (étrier). Un repère absent laisse
     son numéro libre. Bêche à partir du premier numéro libre après le voile. */
  const VOILE_IDS = { AttF: 10, CourF: 11, R: 12, FvF: 13, AttO: 14, CourO: 15, FvO: 16, Fo: 17, Ev: 18 };
  const VOILE_KEYS = Object.keys(VOILE_IDS);
  const BECHE_KEYS = ['Bc', 'Bf'];

  /* Diamètre du mandrin (m) pour un Ø en mm. */
  function mandrin(d, norme) {
    if (norme === 'BAEL') return 5 * d / 1000;
    return (d <= 16 ? 4 : 7) * d / 1000;
  }

  /* Déviation (degrés, 0…180) entre deux directions successives. */
  function deviation(a1, a2) {
    let x = ((a2 - a1) % 360 + 540) % 360 - 180;
    return Math.abs(x);
  }

  /* Déduction de pliage (m) pour un coude de θ degrés. */
  function bendDeduction(theta, dm, D) {
    if (theta < 1e-6) return 0;
    const r = D / 2, t = rad(theta);
    const tanPart = theta <= 90 ? Math.tan(t / 2) : 1; // au-delà de 90°, cote prise à la tangente
    return 2 * (r + dm) * tanPart - t * (r + dm / 2);
  }

  /* Retour droit après une crosse (m). */
  function hookStraight(alpha, dm, norme) {
    if (!alpha) return 0;
    if (norme === 'BAEL') return 10 * dm;
    return alpha >= 150 ? Math.max(5 * dm, 0.05) : Math.max(10 * dm, 0.07);
  }

  /* Longueur ajoutée par une crosse d'extrémité (m). */
  function hookLength(alpha, dm, D, norme) {
    if (!alpha) return 0;
    const r = D / 2;
    return rad(alpha) * (r + dm / 2) + hookStraight(alpha, dm, norme) - (r + dm);
  }

  /* Longueur développée d'une forme {segs, hooks} pour Ø d (mm). */
  function devLength(shape, d, params) {
    const p = Object.assign({}, DEFAULT_PARAMS, params);
    const dm = d / 1000, D = mandrin(d, p.norme);
    let L = 0, ded = 0, hk = 0;
    shape.segs.forEach((s, i) => {
      L += s.l;
      if (i > 0) ded += bendDeduction(deviation(shape.segs[i - 1].a, s.a), dm, D);
    });
    (shape.hooks || [0, 0]).forEach((h) => { hk += hookLength(h, dm, D, p.norme); });
    const raw = L - ded + hk;
    return { raw, L: round5mm(raw), sumSegs: L, deductions: ded, hooks: hk, D };
  }

  /* Nombre de barres d'un repère (par élément, avant multiplicateur). */
  function barCount(bar) {
    if (bar.kind === 'densite') return Math.max(1, Math.ceil(bar.area * bar.esp - 1e-9));
    if (bar.kind === 'unite') return bar.count;
    if (!(bar.esp > 0)) return 1;
    return Math.floor(bar.distLen / bar.esp + 1e-9) + 1;
  }

  /* Découpe d'une forme trop longue en morceaux avec recouvrement. */
  function splitShape(shape, d, params) {
    const p = Object.assign({}, DEFAULT_PARAMS, params);
    const full = devLength(shape, d, p);
    if (full.raw <= p.lmax + 1e-9) return [{ suffix: '', shape, dev: full }];
    const l0 = p.recouv * d / 1000;
    if (l0 >= p.lmax) return [{ suffix: '', shape, dev: full, tooLong: true }];
    const k = Math.ceil((full.raw - l0) / (p.lmax - l0) - 1e-9);
    const target = (full.raw + (k - 1) * l0) / k;
    let m = 0;
    shape.segs.forEach((s, i) => { if (s.l > shape.segs[m].l) m = i; });
    const seg = shape.segs[m];
    const hooks = shape.hooks || [0, 0];
    const before = shape.segs.slice(0, m), after = shape.segs.slice(m + 1);
    const devOf = (segs, hk) => devLength({ segs, hooks: hk }, d, p).raw;
    // morceau de tête : segments avant + portion x1 du segment le plus long
    const x1 = Math.max(0.5, target - devOf(before.concat([{ l: 0, a: seg.a }]), [hooks[0], 0]));
    const xk = Math.max(0.5, target - devOf([{ l: 0, a: seg.a }].concat(after), [0, hooks[1]]));
    const xmid = k > 2 ? (seg.l + (k - 1) * l0 - x1 - xk) / (k - 2) : 0;
    const pieces = [];
    for (let i = 0; i < k; i++) {
      let segs, hk;
      if (i === 0) { segs = before.concat([{ l: r3(x1), a: seg.a, label: seg.label }]); hk = [hooks[0], 0]; }
      else if (i === k - 1) { segs = [{ l: r3(k === 2 ? seg.l + l0 - x1 : xk), a: seg.a, label: seg.label }].concat(after); hk = [0, hooks[1]]; }
      else { segs = [{ l: r3(xmid), a: seg.a, label: seg.label }]; hk = [0, 0]; }
      const sh = { segs, hooks: hk, sides: shape.sides };
      pieces.push({ suffix: String.fromCharCode(97 + i), shape: sh, dev: devLength(sh, d, p) });
    }
    return pieces;
  }

  /* Applique les modifications de l'utilisateur à un repère proposé. */
  function applyOverride(bar, ov) {
    const b = clone(bar);
    if (!ov) return b;
    if (ov.d && MASSE_LIN[ov.d]) b.d = ov.d;
    if (ov.esp > 0) b.esp = ov.esp;
    if (ov.hooks) b.hooks = ov.hooks.slice(0, 2).map((h) => (HOOKS.includes(+h) ? +h : 0));
    if (ov.segs && ov.segs.length === b.segs.length) b.segs.forEach((s, i) => { if (ov.segs[i] > 0) s.l = ov.segs[i]; });
    return b;
  }

  /* Lignes de la nomenclature (avec découpe) pour une liste de repères. */
  function computeRows(bars, params) {
    const p = Object.assign({}, DEFAULT_PARAMS, params);
    const rows = [];
    bars.forEach((bar) => {
      const n = barCount(bar);
      const parElem = n * (bar.mult || 1);
      const total = parElem * Math.max(1, Math.round(p.blocs || 1));
      const shape = { segs: bar.segs, hooks: bar.hooks || [0, 0], sides: bar.sides || [1, -1] };
      const pieces = splitShape(shape, bar.d, p);
      pieces.forEach((pc) => {
        const L = pc.dev.L;
        const Ltot = total * L;
        rows.push({
          id: bar.id + pc.suffix, barId: bar.id, suffix: pc.suffix, role: bar.role,
          type: bar.type || 'HA', d: bar.d, kind: bar.kind, esp: bar.esp,
          n, mult: bar.mult || 1, parElem, nbElem: Math.max(1, Math.round(p.blocs || 1)), total,
          shape: pc.shape, L, D: pc.dev.D, Ltot, masse: Ltot * MASSE_LIN[bar.d],
          split: pieces.length > 1, tooLong: !!pc.tooLong, code: bar.code || '', maintien: bar.maintien || '',
        });
      });
    });
    return rows;
  }

  /* Récapitulatif par diamètre (HA6 à HA40). */
  function recap(rows) {
    const out = DIAMS.map((d) => ({ d, ml: MASSE_LIN[d], longueur: 0, masse: 0 }));
    rows.forEach((r) => {
      const o = out.find((x) => x.d === r.d);
      o.longueur += r.Ltot; o.masse += r.masse;
    });
    const total = out.reduce((s, o) => s + o.masse, 0);
    const longueur = out.reduce((s, o) => s + o.longueur, 0);
    return { lignes: out, total, longueur };
  }

  /* ───────────── Structures ───────────── */

  const fld = (k, label, def, min, max, step, hint) => ({ k, label, def, min, max, step: step || 0.005, hint });

  /* Choix indicatif du Ø principal selon une dimension caractéristique (m). */
  function mainDiam(h, steps) {
    for (const [lim, d] of steps) if (h <= lim + 1e-9) return d;
    return steps[steps.length - 1][1];
  }

  /* ── Outils géométriques (sections planes, y vers le haut) ── */
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const len2 = (v) => Math.hypot(v[0], v[1]);
  const angOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;

  /* Décale chaque côté d'un polygone (sens trigonométrique, intérieur à gauche)
     de dists[i] vers l'intérieur et renvoie les nouveaux sommets (même indexation). */
  function offsetPoly(poly, dists) {
    const n = poly.length, N = [];
    for (let i = 0; i < n; i++) {
      const d = sub(poly[(i + 1) % n], poly[i]), l = len2(d);
      N.push(l < 1e-9 ? null : [-d[1] / l, d[0] / l]);
    }
    for (let i = 0; i < n; i++) if (!N[i]) { let k = i; do { k = (k + n - 1) % n; } while (!N[k] && k !== i); N[i] = N[k]; }
    const out = [];
    for (let i = 0; i < n; i++) {
      const ip = (i + n - 1) % n, n0 = N[ip], n1 = N[i], d0 = typeof dists === 'number' ? dists : dists[ip], d1 = typeof dists === 'number' ? dists : dists[i];
      const P = poly[i], A = [P[0] + n0[0] * d0, P[1] + n0[1] * d0], B = [P[0] + n1[0] * d1, P[1] + n1[1] * d1];
      const u0 = [n0[1], -n0[0]], u1 = [n1[1], -n1[0]], cr = u0[0] * u1[1] - u0[1] * u1[0];
      if (Math.abs(cr) < 1e-9) { out.push(B); continue; }
      const t = ((B[0] - A[0]) * u1[1] - (B[1] - A[1]) * u1[0]) / cr;
      out.push([A[0] + u0[0] * t, A[1] + u0[1] * t]);
    }
    return out;
  }

  /* Supprime les points doublons et alignés d'un trajet ouvert. */
  function cleanPath(pts) {
    const p = [];
    pts.forEach((q) => { if (!p.length || len2(sub(q, p[p.length - 1])) > 1e-6) p.push(q); });
    for (let i = p.length - 2; i > 0; i--) {
      const a = sub(p[i], p[i - 1]), b = sub(p[i + 1], p[i]);
      if (Math.abs(a[0] * b[1] - a[1] * b[0]) < 1e-9 * len2(a) * len2(b) + 1e-12 && a[0] * b[0] + a[1] * b[1] > 0) p.splice(i, 1);
    }
    return p;
  }

  /* Segments cotés {l, a} à partir d'un trajet (cotes hors-tout = longueurs du trajet). */
  const segsOf = (pts) => pts.slice(1).map((q, i) => ({ l: r3(len2(sub(q, pts[i]))), a: Math.round(angOf(pts[i], q) * 1000) / 1000 }));
  /* Abscisse sur la droite AB à l'ordonnée y. */
  const xAt = (A, B, y) => A[0] + (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]);
  /* Droite AB décalée de d vers la gauche du sens A→B. */
  function offLine(A, B, d) {
    const v = sub(B, A), l = len2(v), n = [-v[1] / l * d, v[0] / l * d];
    return [[A[0] + n[0], A[1] + n[1]], [B[0] + n[0], B[1] + n[1]]];
  }

  /* Mur de soutènement cantilever. Repère : x depuis l'arête du patin (aval, à gauche),
     y depuis la sous-face de la semelle ; talon côté terres (droite).
     Paramétrage identique à la feuille de stabilité (Fascicule 62 titre V). */
  const BPOS = [['voile', 'sous le voile'], ['talon', 'au bout du talon'], ['patin', 'au bout du patin'], ['libre', 'abscisse libre']];
  const murT = {
    id: 'murT',
    label: 'Mur de soutènement en T',
    groups: [['geo', 'Géométrie'], ['ter', 'Terrain'], ['opt', 'Options']],
    fields: [
      { k: 'H', label: 'Hauteur totale H', def: 4.00, min: 0.6, max: 12, step: 0.05, unit: 'm', g: 'geo', hint: 'dessus voile → dessous semelle' },
      { k: 'hs', label: 'Semelle hs', def: 0.70, min: 0.2, max: 2, step: 0.05, unit: 'm', g: 'geo' },
      { k: 'e0', label: 'Voile en tête e0', def: 0.25, min: 0.15, max: 1.5, step: 0.01, unit: 'm', g: 'geo' },
      { k: 'fa', label: 'Fruit amont', def: 0.075, min: 0, max: 0.3, step: 0.005, unit: 'm/m', g: 'geo', hint: 'côté terres' },
      { k: 'fv', label: 'Fruit aval', def: 0, min: 0, max: 0.2, step: 0.005, unit: 'm/m', g: 'geo', hint: 'parement' },
      { k: 'p', label: 'Patin p', def: 0.50, min: 0, max: 6, step: 0.05, unit: 'm', g: 'geo' },
      { k: 'B', label: 'Semelle B', def: 3.70, min: 0.5, max: 12, step: 0.05, unit: 'm', g: 'geo' },
      { k: 'L', label: 'Longueur plot L', def: 10.00, min: 1, max: 40, step: 0.5, unit: 'm', g: 'geo' },
      { k: 'bp', label: 'Béton propreté', def: 0.10, min: 0, max: 0.3, step: 0.01, unit: 'm', g: 'geo' },
      { k: 'beta', label: 'Talus amont β', def: 26.57, min: 0, max: 45, step: 0.01, unit: '°', g: 'ter', hint: '0 = terre-plein' },
      { k: 'tn', label: 'TN aval', def: 0.50, min: 0, max: 10, step: 0.05, unit: 'm', g: 'ter', hint: 'au-dessus semelle' },
      { k: 'q', label: 'Surcharge q', def: 1.00, min: 0, max: 10, step: 0.1, unit: 't/m²', g: 'ter' },
      { k: 'beche', label: 'Bêche sous semelle', def: false, type: 'check', g: 'opt' },
      { k: 'bw', label: 'Largeur bêche', def: 0.50, min: 0.25, max: 3, step: 0.05, unit: 'm', g: 'opt', when: 'beche' },
      { k: 'bh', label: 'Hauteur bêche', def: 0.50, min: 0.2, max: 2, step: 0.05, unit: 'm', g: 'opt', when: 'beche' },
      { k: 'bpos', label: 'Position', def: 'voile', type: 'select', opts: BPOS, g: 'opt', when: 'beche' },
      { k: 'bx', label: 'Abscisse bêche', def: 1.00, min: 0, max: 12, step: 0.05, unit: 'm', g: 'opt', when: 'beche', whenVal: ['bpos', 'libre'], hint: 'bord gauche' },
      { k: 'biseau', label: 'Semelle en biseau', def: false, type: 'check', g: 'opt' },
      { k: 'hbp', label: 'Ép. bout patin', def: 0.40, min: 0.15, max: 2, step: 0.05, unit: 'm', g: 'opt', when: 'biseau' },
      { k: 'hbt', label: 'Ép. bout talon', def: 0.40, min: 0.15, max: 2, step: 0.05, unit: 'm', g: 'opt', when: 'biseau' },
    ],
    presets: {
      M4: { label: 'Mur M4 (H 4,00)', g: {} },
      M5: { label: 'Mur M5 (H 1,25)', g: { H: 1.25, hs: 0.25, e0: 0.25, fa: 0, fv: 0, p: 0.475, B: 1.20, L: 10, bp: 0.10, beta: 0, tn: 0.30, q: 1.00, beche: false, biseau: false } },
    },
    derive(g) {
      const Hv = g.H - g.hs, eb = g.e0 + (g.fa + g.fv) * Hv, talon = g.B - g.p - eb;
      const xAvT = g.p + g.fv * Hv, xAmT = xAvT + g.e0, dPou = g.B - xAmT;
      const hbp = g.biseau ? g.hbp : g.hs, hbt = g.biseau ? g.hbt : g.hs;
      let bx0 = 0, bx1 = 0;
      if (g.beche) {
        if (g.bpos === 'talon') bx0 = g.B - g.bw;
        else if (g.bpos === 'patin') bx0 = 0;
        else if (g.bpos === 'libre') bx0 = g.bx;
        else bx0 = g.p + eb / 2 - g.bw / 2;
        bx1 = bx0 + g.bw;
      }
      // coupe longitudinale A-A : plan vertical parallèle au mur, au milieu du talon
      const xCut = talon > 0.3 ? g.p + eb + talon / 2 : g.B / 2;
      const hCut = xCut <= g.p ? hbp + (g.hs - hbp) * xCut / Math.max(g.p, 1e-9) : xCut >= g.p + eb ? g.hs + (hbt - g.hs) * (xCut - g.p - eb) / Math.max(g.B - g.p - eb, 1e-9) : g.hs;
      return Object.assign({}, g, {
        xCut, hCut,
        Hv: r3(Hv), eb: Math.round(eb * 1e4) / 1e4, talon: Math.round(talon * 1e4) / 1e4, xAvT, xAmT, dPou,
        Hp: Math.round((g.H + dPou * Math.tan(rad(g.beta))) * 1e4) / 1e4, hbp, hbt, bx0, bx1, Htot: g.H,
      });
    },
    validate(g) {
      const e = [], d = this.derive(g);
      for (const f of this.fields) {
        if (f.type || (f.when && !g[f.when]) || (f.whenVal && g[f.whenVal[0]] !== f.whenVal[1])) continue;
        if (!(g[f.k] >= f.min - 1e-9)) e.push(f.label + ' doit être ≥ ' + f.min + ' ' + f.unit + '.');
        else if (g[f.k] > f.max + 1e-9) e.push(f.label + ' doit être ≤ ' + f.max + ' ' + f.unit + '.');
      }
      if (e.length) return e;
      if (d.Hv < 0.3) e.push('Hauteur du voile Hv = H − hs = ' + d.Hv.toFixed(2) + ' m : trop faible (≥ 0,30 m).');
      if (d.eb >= g.B) e.push('L’épaisseur du voile à la base (' + d.eb.toFixed(3) + ' m) dépasse la largeur de semelle B.');
      if (d.talon < -1e-9) e.push('Talon négatif : B − p − eb = ' + d.talon.toFixed(3) + ' m. Augmentez B ou réduisez p, e0 ou les fruits.');
      if (g.tn > d.Hv + 1e-9) e.push('Le TN aval dépasse la tête du voile.');
      if (g.biseau) {
        if (g.hbp > g.hs + 1e-9 || g.hbt > g.hs + 1e-9) e.push('Biseau : les épaisseurs aux abouts doivent être ≤ hs.');
        if (g.p < 0.1 && g.hbp < g.hs - 1e-9) e.push('Biseau côté patin impossible sans patin (p < 0,10 m).');
      }
      if (g.beche) {
        if (d.bx0 < -1e-9 || d.bx1 > g.B + 1e-9) e.push('La bêche sort de l’emprise de la semelle (0 à ' + g.B + ' m).');
      }
      return e;
    },
    /* Contour de coffrage (sens trigonométrique) et polygone de la semelle seule. */
    outline(g) {
      const d = this.derive(g), { B, hs, H } = g, { hbp, hbt, eb, xAvT, xAmT, bx0, bx1 } = d;
      const bottom = g.beche ? [[0, 0], [bx0, 0], [bx0, -g.bh], [bx1, -g.bh], [bx1, 0], [B, 0]] : [[0, 0], [B, 0]];
      const outer = cleanPath(bottom.concat([[B, hbt], [g.p + eb, hs], [xAmT, H], [xAvT, H], [g.p, hs], [0, hbp], [0, 0]]));
      outer.pop();
      return { outer, sole: [[0, 0], [B, 0], [B, hbt], [g.p + eb, hs], [g.p, hs], [0, hbp]] };
    },
    /* dMap : {repère: Ø} imposés par l'utilisateur — les barres sont replacées à l'axe en conséquence. */
    propose(g0, params, dMap, mMap) {
      const p = Object.assign({}, DEFAULT_PARAMS, params);
      const g = this.derive(g0), c = p.cTerre, ca = p.cAutre;
      const { H, hs, B, L, e0 } = g, { Hv, eb, hbp, hbt, xAvT, xAmT } = g;
      const big = H >= 3 - 1e-9;
      // Diamètres par défaut : petit mur (type M5) HA12 partout ; H ≥ 3 m principe M4.
      let dI, dS, dAv, dAm, dR = 0, dFs, dFv, dens;
      if (!big) { dI = dS = dAv = dAm = mainDiam(Hv, [[1.5, 12], [2.5, 14], [99, 16]]); dFs = dFv = 12; dens = 6; }
      else if (H < 5.5) { dI = 14; dS = 20; dAm = 14; dR = 20; dAv = 12; dFs = 12; dFv = 10; dens = 4; }
      else { dI = 16; dS = 25; dAm = 16; dR = 25; dAv = 12; dFs = 12; dFv = 10; dens = 4; }
      const fa0 = g.fa >= g.fv; // face à fruit = terres (sinon aval) : Ø de la face physique
      const D0 = { I: dI, S: dS, AttF: fa0 ? dAm : dAv, CourF: fa0 ? dAm : dAv, AttO: fa0 ? dAv : dAm, CourO: fa0 ? dAv : dAm, R: dR, Fo: dAv,
        FsI: dFs, FsS: dFs, FvF: dFv, FvO: dFv, Bc: dI, Bf: dFs, Es: 10, Ev: 10, U5: 12, U6: 12, R7: 10, R8: 10 };
      const build = (D, forceSame) => {
      ({ I: dI, S: dS, R: dR } = D);
      const dFsI = D.FsI, dFsS = D.FsS, dB = D.Bc, dBf = D.Bf, dEs = D.Es, dEv = D.Ev;
      const fermU = p.fermeture !== 'retours';
      const mm = encM, nom = (d) => d / 1000, m5 = fermU ? mm(D.U5) : 0, m6 = fermU ? mm(D.U6) : 0, m7 = fermU ? mm(D.R7) : 0, m8 = mm(D.R8), mI = mm(dI), mS = mm(dS), mR = mm(dR), mFsI = mm(dFsI), mFsS = mm(dFsS), mBf = mm(dBf);
      const lr = r3(L - 2 * c), yL = c + mI / 2;
      const sole = this.outline(g0).sole; // 0:(0,0) 1:(B,0) 2:(B,hbt) 3:(p+eb,hs) 4:(p,hs) 5:(0,hbp)
      const env = offsetPoly(sole, c);
      const ytop = (x) => (x <= g.p ? hbp + (hs - hbp) * x / Math.max(g.p, 1e-9) : x >= g.p + eb ? hs + (hbt - hs) * (x - g.p - eb) / Math.max(B - g.p - eb, 1e-9) : hs);
      const bars = [];
      const ext = (pts, d) => { const q = pts.map((x) => x.slice()), n = q.length; [[0, 1], [n - 1, n - 2]].forEach(([i, j]) => { const v = sub(q[i], q[j]), l = len2(v) || 1; q[i][0] += v[0] / l * d; q[i][1] += v[1] / l * d; }); return q; };
      const mkRep = (bar, key) => { bar.key = key; bars.push(bar); return bar; };
      const walk = (pts, len) => { // début d'une polyligne sur une longueur donnée
        const out = [pts[0].slice()]; let rest = len;
        for (let i = 1; i < pts.length && rest > 1e-9; i++) {
          const v = sub(pts[i], pts[i - 1]), l = len2(v);
          if (l >= rest) { out.push([pts[i - 1][0] + v[0] / l * rest, pts[i - 1][1] + v[1] / l * rest]); rest = 0; } else { out.push(pts[i].slice()); rest -= l; }
        }
        return out;
      };
      const xc = g.xCut, hc = g.hCut;
      const spreadDots = (y0, y1, n) => (n === 1 ? [(y0 + y1) / 2, (y0 + y1) / 2] : [y0, y1]);

      if (fermU) {
        // 1 — nappe inférieure transversale : droite, arrêtée contre l'âme intérieure des U 5
        const y1 = c + mI / 2, xa = c + m5, xb = B - c - m5;
        mkRep({ role: 'Nappe inférieure transversale (droite, arrêtée contre les U 5)', d: dI, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: [{ l: r3(xb - xa), a: 0 }], hooks: [0, 0], sides: [1, -1], place: { items: [{ pts: [[xa, y1], [xb, y1]] }], tag: { seg: 0, t: 0.3 } },
          longi: { dotsZ: [{ y: y1, z0: c + mI / 2, z1: L - c - mI / 2 }] } }, 'I');
        // 3 — nappe supérieure transversale : suit le dessus de semelle (biseau compris), arrêtée contre les U 5
        const t3 = offsetPoly(sole, [0, c + m5, c + mS / 2, c + mS / 2, c + mS / 2, c + m5]);
        const k3 = offsetPoly(sole, [0, c + m5, c, c, c, c + m5]);
        mkRep({ role: 'Nappe supérieure transversale (suit le dessus, arrêtée contre les U 5)', d: dS, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: segsOf(cleanPath([k3[5], k3[4], k3[3], k3[2]])), hooks: [0, 0], sides: [1, -1],
          place: { items: [{ pts: cleanPath([t3[5], t3[4], t3[3], t3[2]]) }], tag: { seg: 1, t: 0.6 } },
          longi: { dotsZ: [{ y: hc - c - mS / 2, z0: c + mS / 2, z1: L - c - mS / 2 }] } }, 'S');
      } else {
      // 1 — U semelle, nappe inférieure (retours vers le haut)
      const p1 = cleanPath([env[5], env[0], env[1], env[2]]);
      const ax1 = offsetPoly(sole, c + mI / 2);
      mkRep({ role: 'U semelle — nappe inférieure (retours vers le haut)', d: dI, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
        segs: segsOf(p1), hooks: [0, 0], sides: [1, -1], place: { items: [{ pts: ext(cleanPath([ax1[5], ax1[0], ax1[1], ax1[2]]), mI / 2) }], tag: { seg: 1, t: 0.2 } },
        longi: { dotsZ: [{ y: c + mI / 2, z0: c + mI / 2, z1: L - c - mI / 2 }] } }, 'I');
      // 2 — U semelle, nappe supérieure (retours vers le bas), à l'intérieur des retours du n° 1
      const p2 = cleanPath([env[0], env[5], env[4], env[3], env[2], env[1]]);
      const ax2 = offsetPoly(sole, [c + mS / 2, c + mI + mS / 2, c + mS / 2, c + mS / 2, c + mS / 2, c + mI + mS / 2]);
      mkRep({ role: 'U semelle — nappe supérieure (retours vers le bas)', d: dS, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
        segs: segsOf(p2), hooks: [0, 0], sides: [1, -1], place: { items: [{ pts: ext(cleanPath([ax2[0], ax2[5], ax2[4], ax2[3], ax2[2], ax2[1]]), mS / 2) }], tag: { seg: 2, t: 0.75 } },
        longi: { dotsZ: [{ y: hc - c - mS / 2, z0: c + mS / 2, z1: L - c - mS / 2 }] } }, 'S');

      }

      // Aciers verticaux du voile, par face, du parement vers l'intérieur : barre courante (à l'enrobage, droite
      // de la reprise jusqu'en tête, arrêtée sous l'âme de la fourchette 17), attente en L ancrée dans la
      // semelle et remontant de l0 = recouv·Ø au-dessus de la reprise, puis (face à fruit) renfort de pied.
      // Face à fruit : la plus inclinée ; à égalité (faces verticales), la face terres.
      const avA = [g.p, hs], avB = [xAvT, H], amA = [g.p + eb, hs], amB = [xAmT, H];
      const fruitAm = g.fa >= g.fv, fF = fruitAm ? 'am' : 'av', fO = fruitAm ? 'av' : 'am';
      const covOf = (face) => (face === 'av' ? ca : c);
      const faceLine = (face, off) => (face === 'av' ? offLine(avA, avB, -off) : offLine(amA, amB, off));
      const cosF = (face) => Math.cos(Math.atan(face === 'av' ? g.fv : g.fa));
      const lb5u = fermU ? r3(Math.min(p.recouv * nom(D.U5), (B - 2 * c) / 2)) : 0;
      const mFo = mm(D.Fo), yTopC = H - ca - mFo; // tête des barres courantes, sous l'âme de la fourchette
      // L ancré en pied : pied sur la nappe 1 (ou sur la branche d'un U 5 là où elle passe), retour vers l'intérieur
      const footL = (face, d, off, yTop, yBase) => {
        const m = mm(d), [A, Bp] = faceLine(face, off + m / 2), av = face === 'av';
        const xf0 = xAt(A, Bp, c), avail0 = av ? xf0 + m / 2 - c : B - c - (xf0 - m / 2);
        const leg0 = Math.max(0.15, Math.min(Math.max(0.30, 25 * nom(d)), avail0));
        const x0 = av ? xf0 - leg0 : xf0, x1 = av ? xf0 : xf0 + leg0;
        const lift = yBase != null ? 0 : (fermU && (x0 < c + lb5u || x1 > B - c - lb5u) ? m5 : 0);
        const yF = yBase != null ? yBase + m / 2 : c + mI + lift + m / 2;
        const xFoot = xAt(A, Bp, yF), top = [xAt(A, Bp, yTop), yTop];
        const avail = av ? xFoot + m / 2 - c : B - c - (xFoot - m / 2);
        const leg = r3(Math.max(0.15, Math.min(Math.max(0.30, 25 * nom(d)), avail)));
        const tip = [av ? xFoot + m / 2 - leg : xFoot - m / 2 + leg, yF];
        const Vl = r3((yTop - (yF - m / 2)) / cosF(face));
        return { leg, Vl, yF, m, pts: [tip, [xFoot, yF], top], segs: [{ l: leg, a: av ? 0 : 180 }, { l: Vl, a: r3(angOf([xFoot, yF], top)) }] };
      };
      const voileFace = (face, kAtt, kCour) => {
        const nomF = face === 'av' ? 'aval' : 'terres', dC = D[kCour], dA = D[kAtt], mC = mm(dC), cov = covOf(face);
        // courante : droite, de la reprise (y = hs) à la tête
        const [A, Bp] = faceLine(face, cov + mC / 2), P0 = [xAt(A, Bp, hs), hs], P1 = [xAt(A, Bp, yTopC), yTopC];
        mkRep({ role: 'Voile face ' + nomF + ' — barre courante (recouvre l’attente, arrêtée sous la fourchette)', d: dC, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: [{ l: r3((yTopC - hs) / cosF(face)), a: r3(angOf(P0, P1)) }], hooks: [0, 0], sides: [1, -1],
          place: { items: [{ pts: [P0, P1] }], tag: { seg: 0, t: 0.75 } } }, kCour);
        // attente : L ancré, remonte de l0 au-dessus de la reprise, juste à l'intérieur de la courante
        const l0 = Math.min(p.recouv * nom(dA), Hv - ca - 0.05), att = footL(face, dA, cov + mC, hs + l0);
        mkRep({ role: 'Voile face ' + nomF + ' — attente en L (recouvrement ' + fmtCote(r3(l0)) + ' m au-dessus de la reprise)', d: dA, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: att.segs, hooks: [0, 0], sides: [1, -1], l0: r3(l0),
          place: { items: [{ pts: att.pts }], tag: { seg: 1, t: 0.3 } } }, kAtt);
        return { mC, att };
      };
      const vF = voileFace(fF, 'AttF', 'CourF');
      // Renfort de pied (face à fruit), à l'intérieur de l'attente, posé sur son pied ; hauteur ≈ 0,42·Hv
      let hopt = 0, mRf = 0;
      if (dR) {
        hopt = Math.round(0.42 * Hv * 20) / 20; mRf = mR;
        const rf = footL(fF, dR, covOf(fF) + vF.mC + vF.att.m, hs + hopt, vF.att.yF + vF.att.m / 2);
        mkRep({ role: 'Renfort de pied face ' + (fF === 'av' ? 'aval' : 'terres') + ' (arrêté à ' + fmtCote(hopt) + ' m au-dessus de la semelle)', d: dR, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: rf.segs, hooks: [0, 0], sides: [-1, 1], place: { items: [{ pts: rf.pts }], tag: { seg: 1, t: 0.55 } } }, 'R');
      }
      const vO = voileFace(fO, 'AttO', 'CourO');
      // Fourchette 17 : U renversé en tête, âme sous l'enrobage de tête, branches de 0,25 m juste à l'intérieur des courantes
      {
        const BR = 0.25, cF = vF.mC, cO = vO.mC, mCav = fF === 'av' ? cF : cO, mCam = fF === 'am' ? cF : cO;
        const yTip = H - ca - BR, ya = H - ca - mFo / 2;
        const La = faceLine('av', ca + mCav + mFo / 2), Lm = faceLine('am', c + mCam + mFo / 2);
        const Lao = faceLine('av', ca + mCav), Lmo = faceLine('am', c + mCam);
        const pts = [[xAt(La[0], La[1], yTip), yTip], [xAt(La[0], La[1], ya), ya], [xAt(Lm[0], Lm[1], ya), ya], [xAt(Lm[0], Lm[1], yTip), yTip]];
        const hors = [[xAt(Lao[0], Lao[1], yTip), yTip], [xAt(Lao[0], Lao[1], H - ca), H - ca], [xAt(Lmo[0], Lmo[1], H - ca), H - ca], [xAt(Lmo[0], Lmo[1], yTip), yTip]];
        mkRep({ role: 'Fourchette de fermeture en tête du voile (branches ' + fmtCote(BR) + ' m)', d: D.Fo, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: segsOf(hors), hooks: [0, 0], sides: [1, -1], place: { items: [{ pts }], tag: { seg: 1, t: 0.5 } } }, 'Fo');
      }

      // Filants de semelle et fermetures
      const r = r3(Math.min(hbp, hbt) - 2 * c);
      let fI, fS;
      if (fermU) {
        // U 5 : fermeture vue en coupe transversale, aux deux abouts (patin, talon). Âme sur la face
        // d'about, branches en recouvrement avec les nappes 1 et 3 (recouv·Ø, plafonné à (B − 2c)/2),
        // juste à l'intérieur de ces nappes ; la branche haute suit le dessus de semelle.
        const lb5 = r3(Math.min(p.recouv * nom(D.U5), (B - 2 * c) / 2));
        const o5 = offsetPoly(sole, [c + mI, c, c + mS, c + mS, c + mS, c]);
        const a5 = offsetPoly(sole, [c + mI + m5 / 2, c + m5 / 2, c + mS + m5 / 2, c + mS + m5 / 2, c + mS + m5 / 2, c + m5 / 2]);
        const uPath = (o, lb, end, m) => {
          const top = end === 'p' ? [o[5], o[4], o[3], o[2]] : [o[2], o[3], o[4], o[5]];
          const corner = end === 'p' ? o[0] : o[1], sg = end === 'p' ? 1 : -1;
          return cleanPath(walk(top, lb - m).reverse().concat([corner.slice(), [corner[0] + sg * (lb - m), corner[1]]]));
        };
        const c5p = uPath(o5, lb5, 'p', 0), c5t = uPath(o5, lb5, 't', 0);
        const sum = (q) => segsOf(q).reduce((t, x) => t + x.l, 0);
        mkRep({ role: 'U de fermeture des abouts (patin et talon), vus en coupe transversale', d: D.U5, kind: 'reparti', esp: 0.15, distLen: lr, mult: 2,
          segs: segsOf(sum(c5t) > sum(c5p) ? c5t : c5p), hooks: [0, 0], sides: [1, -1],
          place: { items: [{ pts: uPath(a5, lb5, 'p', m5 / 2) }, { pts: uPath(a5, lb5, 't', m5 / 2) }], tag: { pick: 'v', t: 0.5 } },
          longi: (xc <= c + lb5 || xc >= B - c - lb5) ? { dotsZ: [{ y: c + mI + m5 / 2, z0: c + m5 / 2, z1: L - c - m5 / 2 }, { y: hc - c - mS - m5 / 2, z0: c + m5 / 2, z1: L - c - m5 / 2 }] } : null }, 'U5');
        // 7 : répartition des 5, le long de l'âme, entre les branches (positions intermédiaires, e ≤ 0,15)
        const ends7 = [['p', 0, hbp], ['t', B, hbt]].map(([e, x0, h]) => {
          const yLo = c + mI + m5, yHi = h - c - mS - m5, hin = yHi - yLo, n = Math.ceil(hin / 0.15 - 1e-9) - 1;
          const x = e === 'p' ? x0 + c + m5 + m7 / 2 : x0 - c - m5 - m7 / 2;
          return { n, x, y0: yLo + hin / (n + 1), y1: yHi - hin / (n + 1) };
        });
        const n7 = Math.max(ends7[0].n, ends7[1].n);
        if (n7 > 0) {
          mkRep({ role: 'Répartition des U 5 (le long de l\u2019âme, entre les branches)', d: D.R7, kind: 'filant', esp: 0.15, distLen: r3((n7 - 1) * 0.15), mult: 2,
            segs: [{ l: r3(L - 2 * c - 2 * m6), a: 0 }], hooks: [0, 0], sides: [1, -1],
            place: { dots: ends7.filter((e) => e.n > 0).map((e) => ({ mode: 'poly', pts: [[e.x, e.y0], [e.x, e.y1]] })), tag: 0 } }, 'R7');
        }
        // Filants : droits, à l'intérieur des branches des U 5 et des répartitions 7, arrêtés contre l'âme des U 6
        const eF = (mF) => c + m5 + m7 + mF / 2;
        fI = offsetPoly(sole, [c + mI + m5 + mFsI / 2, eF(mFsI), 0, 0, 0, eF(mFsI)]);
        fS = offsetPoly(sole, [0, eF(mFsS), c + mS + m5 + mFsS / 2, c + mS + m5 + mFsS / 2, c + mS + m5 + mFsS / 2, eF(mFsS)]);
        const lF = r3(L - 2 * c - 2 * m6), yF2 = c + mI + m5 + mFsI / 2, yF4 = hc - c - mS - m5 - mFsS / 2;
        mkRep({ role: 'Filants semelle — nappe inférieure (droits, arrêtés contre les U 6)', d: dFsI, kind: 'filant', esp: 0.20, distLen: r3(B - 2 * c), mult: 1,
          segs: [{ l: lF, a: 0 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ mode: 'poly', pts: [fI[0], fI[1]] }], tag: 1 },
          longi: { items: [{ pts: [[c + m6, yF2], [L - c - m6, yF2]] }] } }, 'FsI');
        mkRep({ role: 'Filants semelle — nappe supérieure (droits, arrêtés contre les U 6)', d: dFsS, kind: 'filant', esp: 0.20, distLen: r3(B - 2 * c), mult: 1,
          segs: [{ l: lF, a: 0 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ mode: 'poly', pts: cleanPath([fS[5], fS[4], fS[3], fS[2]]) }], tag: -1 },
          longi: { items: [{ pts: [[c + m6, yF4], [L - c - m6, yF4]] }] } }, 'FsS');
        // U 6 : fermeture vue en coupe longitudinale, aux deux joints du plot ; branches le long de L en
        // recouvrement avec les filants (recouv·Ø, plafonné à (L − 2c)/2), juste à l'intérieur des filants.
        const lb6 = r3(Math.min(p.recouv * nom(D.U6), (L - 2 * c) / 2));
        // nus extérieurs des branches ; avec biseau, l'âme varie sur la largeur : la nomenclature prend
        // l'épaisseur moyenne de semelle (le dessin de la coupe A-A, l'épaisseur à l'abscisse de coupe)
        const hmoy = g.biseau ? (g.p * (hbp + hs) / 2 + eb * hs + (B - g.p - eb) * (hs + hbt) / 2) / B : hs;
        const yB6o = c + mI + m5 + mFsI, yT6o = hmoy - c - mS - m5 - mFsS;
        const yB6 = yB6o + m6 / 2, yT6 = hc - c - mS - m5 - mFsS - m6 / 2;
        const u6 = (zW, sg) => [[zW + sg * (lb6 - m6 / 2), yT6], [zW, yT6], [zW, yB6], [zW + sg * (lb6 - m6 / 2), yB6]];
        mkRep({ role: 'U de fermeture des joints du plot, vus en coupe longitudinale', d: D.U6, kind: 'reparti', esp: 0.20, distLen: r3(B - 2 * c), mult: 2,
          segs: [{ l: lb6, a: 180 }, { l: r3(yT6o - yB6o), a: -90 }, { l: lb6, a: 0 }], hooks: [0, 0], sides: [1, -1],
          place: {}, longi: { items: [{ pts: u6(c + m6 / 2, 1) }, { pts: u6(L - c - m6 / 2, -1) }], tag: { seg: 1, t: 0.5 } } }, 'U6');
        // 8 : répartition des U 6, transversales, le long de l'âme des 6 entre leurs branches
        const hmin = Math.min(hbp, hbt, hs), hin8 = (hmin - c - mS - m5 - mFsS - m6) - (yB6o + m6), n8 = Math.ceil(hin8 / 0.15 - 1e-9) - 1;
        if (n8 > 0) {
          const y0 = yB6o + m6, y1 = hc - c - mS - m5 - mFsS - m6, h8 = y1 - y0, sp = spreadDots(y0 + h8 / (n8 + 1), y1 - h8 / (n8 + 1), n8);
          mkRep({ role: 'Répartition des U 6 (transversales, le long de l\u2019âme aux joints)', d: D.R8, kind: 'filant', esp: 0.15, distLen: r3((n8 - 1) * 0.15), mult: 2,
            segs: [{ l: r3(B - 2 * c - 2 * m5), a: 0 }], hooks: [0, 0], sides: [1, -1],
            place: {}, longi: { dotsY: [{ z: c + m6 + m8 / 2, y0: sp[0], y1: sp[1] }, { z: L - c - m6 - m8 / 2, y0: sp[0], y1: sp[1] }], tag: 0 } }, 'R8');
        }
      } else {
        // Ancien principe : filants à retours aux joints du plot
        fI = offsetPoly(sole, [c + mI + mFsI / 2, c + mI + mFsI / 2, 0, 0, 0, c + mI + mFsI / 2]);
        fS = offsetPoly(sole, [0, c + mI + mS + mFsS / 2, c + mS + mFsS / 2, c + mS + mFsS / 2, c + mS + mFsS / 2, c + mI + mS + mFsS / 2]);
        const yF2 = c + mI + mFsI / 2, yF4 = hc - c - mS - mFsS / 2, zl = c + mFsI / 2;
        mkRep({ role: 'Filants semelle — nappe inférieure', d: dFsI, kind: 'filant', esp: 0.20, distLen: r3(B - 2 * c), mult: 1,
          segs: [{ l: r, a: 90 }, { l: lr, a: 0 }, { l: r, a: -90 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ mode: 'poly', pts: [fI[0], fI[1]] }], tag: 1 },
          longi: { items: [{ pts: [[zl, c + r], [zl, yF2], [L - zl, yF2], [L - zl, c + r]] }] } }, 'FsI');
        mkRep({ role: 'Filants semelle — nappe supérieure', d: dFsS, kind: 'filant', esp: 0.20, distLen: r3(B - 2 * c), mult: 1,
          segs: [{ l: r, a: -90 }, { l: lr, a: 0 }, { l: r, a: 90 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ mode: 'poly', pts: cleanPath([fS[5], fS[4], fS[3], fS[2]]) }], tag: -1 },
          longi: { items: [{ pts: [[zl, hc - c - r], [zl, yF4], [L - zl, yF4], [L - zl, hc - c - r]] }] } }, 'FsS');
      }
      const em = (e0 + eb) / 2, rv = r3(em - c - ca);
      // Filants du voile : deux repères, d'abord la face à fruit (la plus inclinée ; sans fruit, la face
      // terres), puis la face opposée. Rangées placées sous les deux crosses de tête.
      const yTopOf = (m) => H - ca - mFo - m / 2; // sous l'âme de la fourchette
      const filV = (key, face) => {
        const d = D[key], m = mm(d), am = face === 'am', vv = face === fF ? vF : vO;
        const inner = Math.max(mFo, vv.att.m + (face === fF ? mRf : 0));
        const line = faceLine(face, covOf(face) + vv.mC + inner + m / 2);
        mkRep({ role: 'Filants voile — face ' + (am ? 'terres' : 'aval') + (key === 'FvF' ? ' (face à fruit)' : ' (face opposée)'), d, kind: 'filant', esp: 0.20, distLen: r3(Hv - ca), mult: 1,
          segs: [{ l: rv, a: 90 }, { l: lr, a: 0 }, { l: rv, a: -90 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ mode: 'stepY', line, y0: yTopOf(m) }], tag: 1 } }, key);
      };
      filV('FvF', fF); filV('FvO', fO);
      const yTopV = yTopOf(Math.max(mm(D.FvF), mm(D.FvO))); // hauteur de la rangée haute (épingles / étriers du voile)

      // Bêche : cadre en U ancré dans la semelle + filants en fond de bêche
      if (g.beche) {
        const mB = mm(dB), x0 = g.bx0, x1 = g.bx1, yb = -g.bh;
        const yT = Math.min(ytop(x0 + c), ytop(x1 - c)) - c;
        const pts = [[x0 + c + mB / 2, yT], [x0 + c + mB / 2, yb + c + mB / 2], [x1 - c - mB / 2, yb + c + mB / 2], [x1 - c - mB / 2, yT]];
        mkRep({ role: 'Bêche — cadres en U ancrés dans la semelle', d: dB, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: [{ l: r3(yT - yb - c), a: -90 }, { l: r3(g.bw - 2 * c), a: 0 }, { l: r3(yT - yb - c), a: 90 }], hooks: [0, 0], sides: [1, -1],
          place: { items: [{ pts }], tag: { seg: 1, t: 0.5 } } }, 'Bc');
        const yF = yb + c + mB + mBf / 2;
        mkRep({ role: 'Bêche — filants de fond', d: dBf, kind: 'filant', esp: 0.20, distLen: r3(g.bw - 2 * c), mult: 1,
          segs: [{ l: lr, a: 0 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ mode: 'poly', pts: [[x0 + c + mB + mBf / 2, yF], [x1 - c - mB - mBf / 2, yF]] }], tag: 0 } }, 'Bf');
      }

      // Barres de maintien des nappes (semelle, voile) : épingles ou étriers.
      //  - Épingle (code 3001) : barre droite, une crosse à chaque extrémité (135° par défaut),
      //    accrochée aux deux nappes.
      //  - Étrier : boucle FERMÉE étroite (deux branches parallèles écartées du seul mandrin) qui
      //    ceinture UN filant de chaque nappe ; extrémités en demi-cercle au mandrin, fermeture à une
      //    extrémité par deux crosses 135° parallèles (comme un cadre, mais d'une seule maille de large).
      //    Le cadre, lui, ceinture plusieurs barres.
      const hsm = g.biseau ? (g.p * (hbp + hs) / 2 + eb * hs + (B - g.p - eb) * (hs + hbt) / 2) / B : hs;
      const rs = r3(hsm - 2 * c);
      const fx = (t) => fI[0][0] + (fI[1][0] - fI[0][0]) * t;
      const epX = [g.p + eb + Math.max(0.05, (B - g.p - eb) * 0.5), Math.max(c + 0.05, g.p * 0.5)].filter((x, i) => i === 0 || g.p > 0.25).map((x) => Math.min(Math.max(x, fx(0.08)), fx(0.92)));
      const maint = (id) => ((mMap && mMap[id]) || p.maintien || 'epingle');
      const r5 = (x) => Math.round(x * 200) / 200;
      // — semelle
      const idEs = '9', mEs = mm(dEs);
      if (maint(idEs) === 'etrier') {
        const De = mandrin(dEs, p.norme), wE = r3(De + 2 * nom(dEs)), wa = De + mEs; // cote au Ø nominal, dessin à l'encombrement
        const nF = Math.floor((B - 2 * c) / 0.20 + 1e-9) + 1, pitch = (fI[1][0] - fI[0][0]) / Math.max(1, nF - 1);
        const items = epX.map((x) => {
          const k = Math.max(0, Math.min(nF - 1, Math.round((x - fI[0][0]) / pitch))), cx = fI[0][0] + k * pitch;
          const xL = cx - wa / 2, xR = cx + wa / 2, yB = c + mEs / 2, yT = ytop(cx) - c - mEs / 2;
          return { pts: [[xL, yT], [xR, yT], [xR, yB], [xL, yB], [xL, yT]], hs: [1, -1] };
        });
        mkRep({ role: 'Étriers semelle (boucle fermée autour d\u2019un filant de chaque nappe)', d: dEs, kind: 'densite', esp: dens, area: r3(B * L), mult: 1, maintien: 'etrier', code: '5201',
          segs: [{ l: wE, a: 0 }, { l: rs, a: -90 }, { l: wE, a: 180 }, { l: rs, a: 90 }], hooks: [135, 135], sides: [1, -1],
          place: { items, tag: { seg: 1, t: 0.5 } } }, 'Es');
      } else {
        mkRep({ role: 'Épingles semelle', d: dEs, kind: 'densite', esp: dens, area: r3(B * L), mult: 1, maintien: 'epingle', code: '3001',
          segs: [{ l: rs, a: 90 }], hooks: [135, 135], sides: [1, -1],
          place: { items: epX.map((x) => ({ pts: [[x, c], [x, ytop(x) - c]], hs: [1, -1] })), tag: { seg: 0, t: 0.5 } } }, 'Es');
      }
      const b9 = bars[bars.length - 1], Ls9 = Math.min(1.5, L / 2);
      b9.longi = { items: [0.45, 1.05].filter((z) => z < Ls9 - 0.1).flatMap((z) => [z, L - z]).map((z) => ({ pts: [[z, c + mEs / 2], [z, hc - c - mEs / 2]] })), tag: { seg: 0, t: 0.5 } };
      // — voile
      const idEv = String(VOILE_IDS.Ev), mEv = mm(dEv);
      const lav = offLine(avA, avB, -ca), lam = offLine(amA, amB, c);
      const xAv = (y) => xAt(lav[0], lav[1], y), xAm = (y) => xAt(lam[0], lam[1], y);
      if (((mMap && mMap[idEv]) || 'etrier') === 'etrier') { // 18 : étrier par défaut (KLE), basculable en épingle
        const De = mandrin(dEv, p.norme), wE = r3(De + 2 * nom(dEv)), wa = De + mEv;
        const items = [0.25, 0.6].map((f) => {
          const i = Math.max(0, Math.round((yTopV - (H - ca - f * Hv)) / 0.20)), yc = yTopV - i * 0.20;
          const yT = yc + wa / 2, yB = yc - wa / 2;
          const xLT = xAv(yT) + mEv / 2, xRT = xAm(yT) - mEv / 2, xLB = xAv(yB) + mEv / 2, xRB = xAm(yB) - mEv / 2;
          return { pts: [[xLT, yT], [xRT, yT], [xRB, yB], [xLB, yB], [xLT, yT]], hs: [1, -1] };
        });
        mkRep({ role: 'Étriers voile (boucle fermée autour d\u2019un filant de chaque face)', d: dEv, kind: 'densite', esp: dens, area: r3(Hv * L), mult: 1, maintien: 'etrier', code: '5201',
          segs: [{ l: rv, a: 0 }, { l: wE, a: -90 }, { l: rv, a: 180 }, { l: wE, a: 90 }], hooks: [135, 135], sides: [1, -1],
          place: { items, tag: { seg: 0, t: 0.5 } } }, 'Ev');
      } else {
        const ve = [0.25, 0.6].map((f) => H - ca - f * Hv).map((y) => ({ pts: [[xAv(y), y], [xAm(y), y]], hs: [-1, 1] }));
        mkRep({ role: 'Épingles voile', d: dEv, kind: 'densite', esp: dens, area: r3(Hv * L), mult: 1, maintien: 'epingle', code: '3001',
          segs: [{ l: rv, a: 0 }], hooks: [135, 135], sides: [-1, 1], place: { items: ve, tag: { seg: 0, t: 0.5 } } }, 'Ev');
      }

      // Numérotation KLE (piles, culées) : semelle 1 à 9 (voir SEMELLE_IDS), voile à partir de 10,
      // bêche juste après le voile. Les numéros libres (5-8 en mode « retours ») restent libres.
      bars.forEach((b) => { if (SEMELLE_IDS[b.key]) b.id = String(SEMELLE_IDS[b.key]); else if (VOILE_IDS[b.key]) b.id = String(VOILE_IDS[b.key]); });
      let nv = Math.max.apply(null, Object.values(VOILE_IDS)) + 1;
      BECHE_KEYS.forEach((k) => bars.filter((b) => b.key === k).forEach((b) => { b.id = String(nv++); }));
      bars.sort((a, b) => Number(a.id) - Number(b.id));
      bars.meta = { hopt, big };
      return bars;
      };
      const b0 = build(D0);
      if (!dMap || !Object.keys(dMap).length) return b0;
      const D1 = Object.assign({}, D0);
      b0.forEach((b) => { const d = dMap[b.id]; if (d) D1[b.key] = d; });
      return build(D1);
    },
  };

  /* Dalot cadre fermé, 1 cellule. x depuis le nu extérieur gauche, y depuis la sous-face du radier. */
  const dalot = {
    id: 'dalot',
    label: 'Dalot cadre fermé (1 cellule)',
    fields: [
      fld('O', 'Ouverture intérieure O', 2.00, 0.5, 8),
      fld('Hi', 'Hauteur intérieure Hi', 1.50, 0.5, 6),
      fld('et', 'Épaisseur traverse', 0.25, 0.15, 1),
      fld('ep', 'Épaisseur piédroits', 0.25, 0.15, 1),
      fld('er', 'Épaisseur radier', 0.30, 0.15, 1),
      fld('g', 'Goussets g (45°)', 0.15, 0, 0.5),
      fld('L', 'Longueur L', 10.00, 1, 40, 0.05),
    ],
    derive(g) { return Object.assign({}, g, { Bext: r3(g.O + 2 * g.ep), Hext: r3(g.er + g.Hi + g.et) }); },
    validate(g) {
      const e = [];
      for (const f of this.fields) if (!(g[f.k] >= f.min - 1e-9)) e.push(f.label + ' doit être ≥ ' + f.min + ' m.');
      if (g.g > Math.min(g.O, g.Hi) / 3) e.push('Goussets trop grands par rapport à l’ouverture.');
      return e;
    },
    propose(g0, params) {
      const p = Object.assign({}, DEFAULT_PARAMS, params);
      const g = this.derive(g0);
      const c = p.cTerre, ca = p.cAutre;
      const d1 = mainDiam(Math.max(g.O, g.Hi), [[2, 12], [3, 14], [4, 16], [99, 20]]);
      const d2 = 10, dg = 10;
      const m1 = encM(d1), m2 = encM(d2), mg = encM(dg);
      const { O, Hi, et, ep, er, L, Bext, Hext } = g;
      const lr = r3(L - 2 * c);
      const lap = p.recouv * d1 / 1000;
      const legU = r3(Math.min((Hext - 2 * c) / 2 + lap / 2, Hext - 2 * c));
      const lx = r3(Bext - 2 * c);
      const lInt = r3(Bext - 2 * c - 4 * m1);
      const lV = r3(Hext - 2 * c - 2 * m1);
      const bars = [
        { id: '1', role: 'U extérieur supérieur (traverse + piédroits)', d: d1, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: [{ l: legU, a: 90 }, { l: lx, a: 0 }, { l: legU, a: -90 }], hooks: [0, 0], sides: [1, -1],
          place: { items: [{ x0: c + m1 / 2, y0: Hext - c - legU }], tag: { seg: 1, t: 0.3 } } },
        { id: '2', role: 'U extérieur inférieur (radier + piédroits)', d: d1, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: [{ l: legU, a: -90 }, { l: lx, a: 0 }, { l: legU, a: 90 }], hooks: [0, 0], sides: [1, -1],
          place: { items: [{ x0: c + 1.5 * m1, y0: c + legU, shrink: { seg: 1, by: 2 * m1 } }], tag: { seg: 1, t: 0.3 } } },
        { id: '3', role: 'Traverse — nappe inférieure (crosses dans les piédroits)', d: d1, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: [{ l: lInt, a: 0 }], hooks: [90, 90], sides: [1, -1],
          place: { items: [{ x0: c + 2 * m1, y0: Hext - et + ca + m1 / 2 }], tag: { seg: 0, t: 0.62 } } },
        { id: '4', role: 'Radier — nappe supérieure (crosses dans les piédroits)', d: d1, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: [{ l: lInt, a: 0 }], hooks: [90, 90], sides: [-1, 1],
          place: { items: [{ x0: c + 2 * m1, y0: er - ca - m1 / 2 }], tag: { seg: 0, t: 0.62 } } },
        { id: '5', role: 'Piédroits — face intérieure (2 piédroits)', d: d1, kind: 'reparti', esp: 0.15, distLen: lr, mult: 2,
          segs: [{ l: lV, a: 90 }], hooks: [90, 90], sides: [-1, 1],
          place: { items: [{ x0: ep - ca - m1 / 2, y0: c + m1 }, { x0: Bext - ep + ca + m1 / 2, y0: c + m1, mx: true }], tag: { seg: 0, t: 0.55 } } },
      ];
      if (g.g > 0.01) {
        // barres de gousset, parallèles au chanfrein, à l'enrobage intérieur
        const off = ca + mg / 2;
        const cx = ep + g.g / 2 - off / Math.SQRT2, cy = Hext - et - g.g / 2 + off / Math.SQRT2; // coin haut gauche
        const lim1 = (cx - (c + 2 * m1 + mg)) * Math.SQRT2;     // vers le piédroit
        const lim2 = ((Hext - c - 2 * m1 - mg) - cy) * Math.SQRT2; // vers la traverse
        const half = Math.max(0.1, Math.min(lim1, lim2, g.g * Math.SQRT2 / 2 + 30 * mg));
        const lg = Math.floor(2 * half * 20) / 20;
        const sx = cx - lg / 2 / Math.SQRT2, sy = cy - lg / 2 / Math.SQRT2;
        const cyb = g.er + g.g / 2 - off / Math.SQRT2; // coin bas gauche (symétrique)
        const syb = cyb + lg / 2 / Math.SQRT2;
        bars.push({ id: '6', role: 'Goussets (4 angles)', d: dg, kind: 'reparti', esp: 0.15, distLen: lr, mult: 4,
          segs: [{ l: lg, a: 45 }], hooks: [0, 0], sides: [1, -1],
          place: { items: [
            { x0: sx, y0: sy }, { x0: Bext - sx, y0: sy, mx: true },
            { x0: sx, y0: syb, my: true }, { x0: Bext - sx, y0: syb, mx: true, my: true },
          ], tag: { seg: 0, t: 0.5 } } });
      }
      const n = String(bars.length + 1), n2 = String(bars.length + 2), n3 = String(bars.length + 3);
      const xa = c + 2 * m1 + m2 / 2, xb = Bext - xa;
      bars.push(
        { id: n, role: 'Filants traverse et radier — nappes extérieures', d: d2, kind: 'filant', esp: 0.20, distLen: lx, mult: 2,
          segs: [{ l: lr, a: 0 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ a: [xa, Hext - c - m1 - m2 / 2], b: [xb, Hext - c - m1 - m2 / 2], mode: 'spread' },
                          { a: [xa, c + m1 + m2 / 2], b: [xb, c + m1 + m2 / 2], mode: 'spread' }], tag: 2 } },
        { id: n2, role: 'Filants traverse et radier — nappes intérieures', d: d2, kind: 'filant', esp: 0.20, distLen: r3(O), mult: 2,
          segs: [{ l: lr, a: 0 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ a: [ep + 0.02, Hext - et + ca + m1 + m2 / 2], b: [Bext - ep - 0.02, Hext - et + ca + m1 + m2 / 2], mode: 'spread' },
                          { a: [ep + 0.02, er - ca - m1 - m2 / 2], b: [Bext - ep - 0.02, er - ca - m1 - m2 / 2], mode: 'spread' }], tag: -3 } },
        { id: n3, role: 'Filants piédroits (2 faces × 2 piédroits)', d: d2, kind: 'filant', esp: 0.20, distLen: r3(Hi), mult: 4,
          segs: [{ l: lr, a: 0 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [
            { a: [c + 2 * m1 + m2 / 2, er + 0.05], b: [c + 2 * m1 + m2 / 2, Hext - et - 0.05], mode: 'spread' },
            { a: [ep - ca - m1 - m2 / 2, er + 0.05], b: [ep - ca - m1 - m2 / 2, Hext - et - 0.05], mode: 'spread' },
            { a: [Bext - ep + ca + m1 + m2 / 2, er + 0.05], b: [Bext - ep + ca + m1 + m2 / 2, Hext - et - 0.05], mode: 'spread' },
            { a: [Bext - c - 2 * m1 - m2 / 2, er + 0.05], b: [Bext - c - 2 * m1 - m2 / 2, Hext - et - 0.05], mode: 'spread' }], tag: 2 } }
      );
      return bars;
    },
  };

  const STRUCTURES = { murT, dalot };

  function defaults(struct) {
    const g = {};
    STRUCTURES[struct].fields.forEach((f) => { g[f.k] = f.def; });
    return g;
  }

  /* Valeurs d'un exemple prédéfini (ex. murs M4, M5 de KLE). */
  function preset(struct, name) {
    const P = STRUCTURES[struct].presets && STRUCTURES[struct].presets[name];
    return Object.assign(defaults(struct), P ? P.g : {});
  }

  /* Calcul complet : proposition + modifications → lignes + récapitulatif. */
  function compute(struct, g, params, overrides) {
    const S = STRUCTURES[struct];
    const p = Object.assign({}, DEFAULT_PARAMS, params);
    const dMap = {};
    Object.entries(overrides || {}).forEach(([id, o]) => { if (o && o.d) dMap[id] = o.d; });
    const mMap = {};
    Object.entries(overrides || {}).forEach(([id, o]) => { if (o && o.maint) mMap[id] = o.maint; });
    const proposed = S.propose(g, p, dMap, mMap);
    const bars = proposed.map((b) => applyOverride(b, overrides && overrides[b.id]));
    const rows = computeRows(bars, p);
    return { bars, rows, recap: recap(rows), params: p, geom: S.derive(g) };
  }

  /* Format d'une cote en m : 2 décimales, 3 si nécessaire. */
  function fmtCote(l) {
    const v = Math.round(l * 1000) / 1000;
    return Math.abs(v * 100 - Math.round(v * 100)) > 1e-6 ? v.toFixed(3) : v.toFixed(2);
  }

  return {
    ENCOMBREMENT, COULEUR_ACI, encM, DIAMS, MASSE_LIN, HOOKS, DEFAULT_PARAMS, STRUCTURES,
    mandrin, deviation, bendDeduction, hookStraight, hookLength, devLength,
    barCount, splitShape, applyOverride, computeRows, recap, defaults, preset, compute, fmtCote, round5mm, offsetPoly, cleanPath,
  };
});
