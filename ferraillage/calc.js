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

  const DEFAULT_PARAMS = {
    norme: 'EC2',     // 'EC2' | 'BAEL'
    lmax: 12,         // longueur commerciale maximale (m)
    recouv: 50,       // recouvrement en nombre de Ø
    cTerre: 0.05,     // enrobage fondation / contact terre (m)
    cAutre: 0.03,     // enrobage autres parements (m)
    blocs: 1,         // nombre d'éléments identiques
  };

  const rad = (deg) => deg * Math.PI / 180;
  const r3 = (x) => Math.round(x * 1000) / 1000;
  const round5mm = (x) => Math.round(x * 200 + 1e-9) / 200;
  const clone = (o) => JSON.parse(JSON.stringify(o));

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
          split: pieces.length > 1, tooLong: !!pc.tooLong,
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

  /* Mur de soutènement en T. Repère : x depuis l'arête du patin (aval, à gauche),
     y depuis la sous-face de la semelle ; talon côté terre (droite). */
  const murT = {
    id: 'murT',
    label: 'Mur de soutènement en T',
    fields: [
      fld('H', 'Hauteur du voile H', 1.00, 0.4, 8),
      fld('e', 'Épaisseur du voile e', 0.25, 0.15, 1.2),
      fld('B', 'Largeur de la semelle B', 1.20, 0.5, 8),
      fld('hs', 'Épaisseur de la semelle hs', 0.25, 0.15, 1.5),
      fld('p', 'Patin (côté aval) p', 0.475, 0, 4, 0.005, 'Talon = B − p − e'),
      fld('L', 'Longueur du bloc L', 10.00, 1, 40, 0.05),
      fld('bp', 'Béton de propreté', 0.10, 0, 0.3, 0.01),
    ],
    derive(g) { return Object.assign({}, g, { talon: r3(g.B - g.p - g.e), Htot: g.H + g.hs }); },
    validate(g) {
      const e = [];
      const t = g.B - g.p - g.e;
      if (t < -1e-9) e.push('Le talon est négatif : réduisez le patin p ou l’épaisseur e (B − p − e = ' + t.toFixed(3) + ' m).');
      if (g.hs < 0.15) e.push('Semelle trop mince pour deux nappes et l’enrobage.');
      for (const f of this.fields) if (!(g[f.k] >= f.min - 1e-9)) e.push(f.label + ' doit être ≥ ' + f.min + ' m.');
      return e;
    },
    propose(g, params) {
      const p = Object.assign({}, DEFAULT_PARAMS, params);
      const c = p.cTerre, ca = p.cAutre;
      const d1 = mainDiam(g.H, [[1.5, 12], [2.5, 14], [3.5, 16], [5, 20], [99, 25]]);
      const d2 = 12, d3 = 10;
      const m1 = d1 / 1000, m2 = d2 / 1000, m3 = d3 / 1000;
      const { H, e, B, hs, p: pa, L } = g;
      const talon = B - pa - e;
      const r = r3(hs - 2 * c);                       // retours des U de semelle
      const lr = r3(L - 2 * c);                        // longueur de répartition longitudinale
      const V = r3(hs + H - c - ca);                    // hauteur des aciers verticaux du voile
      const leg = r3(Math.max(0.15, Math.min(Math.max(0.30, 25 * m1), Math.min(pa, talon) + e / 2 - c)));
      const rv = r3(e - c - ca);                       // retours des filants du voile
      const xf = pa + ca + m1 / 2, xb = pa + e - c - m1 / 2;
      const yL = c + m1 / 2;
      const legChair = Math.max(0.05, Math.round((hs - 2 * c - 2 * m1 - m2) * 100) / 100);
      const nF = Math.floor((B - 2 * c) / 0.20 + 1e-9) + 1;
      const fx = (i) => c + m1 + m2 / 2 + i * (B - 2 * c - 2 * m1 - m2) / Math.max(1, nF - 1);
      const yTopV = hs + H - ca - m1 - m2 / 2;
      return [
        { id: '1', role: 'U semelle — nappe inférieure (retours vers le haut)', d: d1, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: [{ l: r, a: -90 }, { l: r3(B - 2 * c), a: 0 }, { l: r, a: 90 }], hooks: [0, 0], sides: [1, -1],
          place: { items: [{ x0: c + m1 / 2, y0: hs - c }], tag: { seg: 1, t: 0.22 } } },
        { id: '2', role: 'U semelle — nappe supérieure (retours vers le bas)', d: d1, kind: 'reparti', esp: 0.15, distLen: lr, mult: 1,
          segs: [{ l: r, a: 90 }, { l: r3(B - 2 * c), a: 0 }, { l: r, a: -90 }], hooks: [0, 0], sides: [1, -1],
          place: { items: [{ x0: c + 1.5 * m1, y0: c, shrink: { seg: 1, by: 2 * m1 } }], tag: { seg: 1, t: 0.8 } } },
        { id: '3', role: 'Aciers verticaux du voile en L + crosse (2 faces)', d: d1, kind: 'reparti', esp: 0.15, distLen: lr, mult: 2,
          segs: [{ l: leg, a: 0 }, { l: V, a: 90 }], hooks: [0, 90], sides: [1, -1],
          place: { items: [{ x0: xf - leg + m1 / 2, y0: yL }, { x0: xb + leg - m1 / 2, y0: yL, mx: true }], tag: { seg: 1, t: 0.72 } } },
        { id: '4', role: 'Filants semelle — nappe inférieure', d: d2, kind: 'filant', esp: 0.20, distLen: r3(B - 2 * c), mult: 1,
          segs: [{ l: r, a: 90 }, { l: lr, a: 0 }, { l: r, a: -90 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ a: [fx(0), c + m1 + m2 / 2], b: [fx(nF - 1), c + m1 + m2 / 2], mode: 'spread' }], tag: 1 } },
        { id: '5', role: 'Filants semelle — nappe supérieure', d: d2, kind: 'filant', esp: 0.20, distLen: r3(B - 2 * c), mult: 1,
          segs: [{ l: r, a: -90 }, { l: lr, a: 0 }, { l: r, a: 90 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ a: [fx(0), hs - c - m1 - m2 / 2], b: [fx(nF - 1), hs - c - m1 - m2 / 2], mode: 'spread' }], tag: -1 } },
        { id: '6', role: 'Filants voile (2 faces)', d: d2, kind: 'filant', esp: 0.20, distLen: r3(H - ca), mult: 2,
          segs: [{ l: rv, a: 90 }, { l: lr, a: 0 }, { l: rv, a: -90 }], hooks: [0, 0], sides: [1, -1],
          place: { dots: [{ a: [pa + ca + m1 + m2 / 2, yTopV], dir: [0, -1], mode: 'step' }, { a: [pa + e - c - m1 - m2 / 2, yTopV], dir: [0, -1], mode: 'step' }], tag: 1 } },
        { id: '7', role: 'Épingles semelle', d: d3, kind: 'densite', esp: 6, area: r3(B * L), mult: 1,
          segs: [{ l: r, a: 90 }], hooks: [135, 135], sides: [1, -1],
          place: { items: [{ x0: fx(1) + m2 / 2 + m3 / 2, y0: c }, { x0: fx(nF - 2) + m2 / 2 + m3 / 2, y0: c }], tag: { seg: 0, t: 0.5 } } },
        { id: '8', role: 'Épingles voile', d: d3, kind: 'densite', esp: 6, area: r3(H * L), mult: 1,
          segs: [{ l: rv, a: 0 }], hooks: [135, 135], sides: [-1, 1],
          place: { items: [{ x0: pa + ca, y0: yTopV - 0.2 - m2 / 2 - m3 / 2 }, { x0: pa + ca, y0: yTopV - 0.6 - m2 / 2 - m3 / 2 }], tag: { seg: 0, t: 0.5 } } },
        { id: '9', role: 'Écarteurs (chaises) semelle', d: d3, kind: 'densite', esp: 1, area: r3(B * L), mult: 1,
          segs: [{ l: 0.20, a: 0 }, { l: legChair, a: 90 }, { l: 0.30, a: 0 }, { l: legChair, a: -90 }, { l: 0.20, a: 0 }], hooks: [0, 0], sides: [1, -1],
          place: { items: [{ x0: Math.max(c + 0.02, B / 2 - 0.35), y0: c + m1 + m2 + m3 / 2 }], tag: { seg: 4, t: 0.7 } } },
      ];
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
      const m1 = d1 / 1000, m2 = d2 / 1000, mg = dg / 1000;
      const { O, Hi, et, ep, er, L, Bext, Hext } = g;
      const lr = r3(L - 2 * c);
      const lap = p.recouv * m1;
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

  /* Calcul complet : proposition + modifications → lignes + récapitulatif. */
  function compute(struct, g, params, overrides) {
    const S = STRUCTURES[struct];
    const p = Object.assign({}, DEFAULT_PARAMS, params);
    const proposed = S.propose(g, p);
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
    DIAMS, MASSE_LIN, HOOKS, DEFAULT_PARAMS, STRUCTURES,
    mandrin, deviation, bendDeduction, hookStraight, hookLength, devLength,
    barCount, splitShape, applyOverride, computeRows, recap, defaults, compute, fmtCote, round5mm,
  };
});
