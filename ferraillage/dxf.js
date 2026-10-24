/* BridgeAI Studios — Plans de coffrage & ferraillage : export DXF au format des plans ADFER de KLE.
 *
 * DXF ASCII R12 (AC1009), unité le mètre, dessin à l'échelle 1/40 (1 mm papier = 0,04 m).
 * Reprend la présentation des plans ADFER de KLE (relevée sur le plan MUR M4) :
 *   - calques ADFER-ACIERS__HAxx (une couleur par diamètre), ADFER-REPERAGE, ADFER-NOMENC,
 *     1-COUPE, 1-HACH-1, 1-COTATION, 1-TEXTE, 1-TITRE, 1-AXES, 1-REPRISE ;
 *   - repères : blocs $$FER_BUL (bulle), $FER_REPERE (numéro en attribut), FLECHE, quantité « 67 HA10 » ;
 *   - nomenclature : blocs FER-TITREGEN, fer-tit, fer-nom (attributs REP, NC, FI, NB, NE, NTOT, ESP, LC,
 *     MAN, LT, INDICE), FER-FINNOM, REC-TAB ;
 *   - cotes : entités DIMENSION (style KLE-50, virgule décimale, zéro de tête supprimé : « ,25 », « 3,30 ») ;
 *   - hachures ANSI31 du béton coupé (bloc anonyme *X, comme les hachures R12).
 * Les caractères accentués sont écrits en \U+XXXX.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const F = isNode ? Object.assign({}, require('./calc.js'), require('./draw.js')) : root.FERR;
  const api = factory(F);
  if (isNode) module.exports = api;
  else root.FERR = Object.assign(root.FERR || {}, api);
})(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';

  const ECH = 40, MM = ECH / 1000;   // 1 mm papier → 0,04 m
  const U = 0.016;                   // mètres par « pixel » des scènes : bulle R 10 px → 0,16 m (bulle ADFER)
  const DIAMS = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40];
  const ACI_HA = { 6: 1, 8: 2, 10: 3, 12: 4, 14: 5, 16: 6, 20: 7, 25: 8, 32: 9, 40: 10 };
  const HA_OF_ACI = {}; Object.keys(ACI_HA).forEach((d) => { HA_OF_ACI[ACI_HA[d]] = +d; });
  const layerHA = (d) => 'ADFER-ACIERS__HA' + d;

  /* Calques du plan KLE : [nom, couleur, type de ligne] */
  const LAYERS = [
    ['1-COUPE', 7], ['1-VU', 7], ['1-HACH-1', 8], ['1-COTATION', 1], ['1-TEXTE', 7], ['1-TITRE', 7],
    ['1-AXES', 1, 'CENTER2'], ['1-REPRISE', 15], ['1-AMORCE', 70, 'HIDDEN2'],
    ['ADFER-ACIERS', 12], ['ADFER-REPERAGE', 7], ['ADFER-FAUX_REPERES', 1], ['ADFER-NOMENC', 7],
  ].concat(DIAMS.map((d) => [layerHA(d), ACI_HA[d]]));

  const STYLES = [['STANDARD', 'arial.ttf'], ['M', 'ARIALN.TTF'], ['KLE', 'arial.ttf'], ['ROMANS', 'romans.shx'],
    ['$$$FER-NOM$$$', 'isocpeur.ttf'], ['$$$FER-TIT$$$', 'isocpeur.ttf'], ['$LIBFER$', 'isocpeur.ttf']];

  /* Blocs ADFER relevés sur le plan MUR M4 (unités du bloc ; nomenclature insérée à 0,025).
     L : ligne, P : polyligne [fermée, [x, y, bulge]…], C : cercle, T : texte [x, y, h, texte, style, cadrage, rot],
     A : attribut [x, y, h, étiquette, style, cadrage, rot, défaut]. */
  const ADFER = {
    'fer-nom': [['L', 0, -6.5, 112.5, -6.5], ['L', 0, -6.5, 0, 6.5], ['L', 200, 6.5, 200, -6.5], ['L', 159.5, -6.5, 200, -6.5],
      ['L', 13.5, -6.5, 13.5, 6.5], ['L', 23.5, -6.5, 23.5, 6.5], ['L', 33.5, -6.5, 33.5, 6.5], ['L', 48.5, -6.5, 48.5, 6.5],
      ['L', 63.5, -6.5, 63.5, 6.5], ['L', 78.5, -6.5, 78.5, 6.5], ['L', 95.5, -6.5, 95.5, 6.5], ['L', 112.5, -6.5, 112.5, 6.5],
      ['L', 159.5, -6.5, 159.5, 6.5], ['L', 169.5, -6.5, 169.5, 6.5], ['L', 195, -6.5, 195, 6.5],
      ['A', 6.75, 0, 4, 'REP', '$$$FER-NOM$$$', 4, 0, ''], ['A', 123.1631, 0.2872, 4, 'COD', '$$$FER-NOM$$$', 4, 0, '', 1],
      ['A', 18.5, 0, 4, 'NC', '$$$FER-NOM$$$', 4, 0, ''], ['A', 28.5, 0, 4, 'FI', '$$$FER-NOM$$$', 4, 0, ''],
      ['A', 41, 0, 4, 'NB', '$$$FER-NOM$$$', 4, 0, ''], ['A', 56, 0, 4, 'NE', '$$$FER-NOM$$$', 4, 0, ''],
      ['A', 71, 0, 4, 'NTOT', '$$$FER-NOM$$$', 4, 0, ''], ['A', 87, 0, 4, 'ESP', '$$$FER-NOM$$$', 4, 0, ''],
      ['A', 104, 0, 4, 'LC', '$$$FER-NOM$$$', 4, 0, ''], ['A', 136, 0, 4, 'SCHEMA', '$$$FER-NOM$$$', 4, 0, ''],
      ['A', 164.5, 0, 2.5, 'MAN', '$$$FER-NOM$$$', 4, 0, ''], ['A', 182.25, 0, 4, 'LT', '$$$FER-NOM$$$', 4, 0, ''],
      ['A', 197.5, 0, 3, 'INDICE', '$$$FER-NOM$$$', 4, 0, '']],
    'fer-tit': [['P', 1, [[0, -7.5, 0], [200, -7.5, 0], [200, 7.5, 0], [0, 7.5, 0]]], ['P', 1, [[0.5, -7, 0], [199.5, -7, 0], [199.5, 7, 0], [0.5, 7, 0]]],
      ['L', 13.5, 7, 13.5, -7], ['L', 23.5, 7, 23.5, -7], ['L', 33.5, 7, 33.5, -7], ['L', 78.5, 0, 33.5, 0], ['L', 48.5, 0, 48.5, -7],
      ['L', 63.5, 0, 63.5, -7], ['L', 78.5, 7, 78.5, -7], ['L', 95.5, 7, 95.5, -7], ['L', 112.5, 7, 112.5, -7], ['L', 159.5, 7, 159.5, -7],
      ['L', 169.5, 7, 169.5, -7], ['L', 195, 7, 195, -7],
      ['T', 7, 0, 4, 'N°', '$$$FER-TIT$$$', 4, 0], ['T', 18.5, 0, 2, 'TYPE', '$$$FER-TIT$$$', 4, 0], ['T', 28.5, 0, 4, '%%C', '$$$FER-TIT$$$', 4, 0],
      ['T', 56, 3.6946, 3, 'Nombre', '$$$FER-TIT$$$', 4, 0], ['T', 41, -3.4946, 1.75, 'Par Elément', '$$$FER-TIT$$$', 4, 0],
      ['T', 56, -3.4946, 1.75, 'd\'éléments', '$$$FER-TIT$$$', 4, 0], ['T', 71, -3.4946, 2, 'Total', '$$$FER-TIT$$$', 4, 0],
      ['T', 87, 0, 3, 'Esp', '$$$FER-TIT$$$', 4, 0], ['T', 104, 1.648, 3, 'Long.', '$$$FER-TIT$$$', 4, 0], ['T', 104, -2.25, 3, 'Unitaire', '$$$FER-TIT$$$', 4, 0],
      ['T', 136, 0, 4, 'Façonnage', '$$$FER-TIT$$$', 4, 0], ['T', 182.5316, 1.648, 3, 'Long.', '$$$FER-TIT$$$', 4, 0],
      ['T', 182.5316, -2.25, 3, 'TOTALE', '$$$FER-TIT$$$', 4, 0], ['T', 164.5719, 4.2535, 2, 'Mandrin', '$$$FER-TIT$$$', 4, 0],
      ['T', 164.5719, 1.4983, 2, '(cm)', '$$$FER-TIT$$$', 4, 0], ['C', 164.5, -3.7403, 2.1],
      ['P', 0, [[162.4, -0.3803, 0], [162.4, -3.7403, 0.4142], [164.5, -5.8403, 0], [169.06, -5.8403, 0]]],
      ['P', 0, [[162.16, -0.3803, 0], [162.16, -3.7403, 0.4142], [164.5, -6.0803, 0], [168.8271, -6.0803, 0]]],
      ['L', 168.51, -6.3974, 169.3585, -5.5489], ['L', 162.16, -0.3803, 162.4, -0.3803],
      ['T', 198.1198, -3.1958, 2, 'Indice', '$$$FER-TIT$$$', 0, 90]],
    'FER-TITREGEN': [['L', 0, -6.5, 200, -6.5], ['L', 200, -6.5, 200, 6.5], ['L', 200, 6.5, 0, 6.5], ['L', 0, 6.5, 0, -6.5],
      ['L', 0.5, -6, 199.5, -6], ['L', 199.5, -6, 199.5, 6], ['L', 199.5, 6, 0.5, 6], ['L', 0.5, 6, 0.5, -6],
      ['A', 100, 0, 5, 'TITRE', '$$$FER-TIT$$$', 4, 0, '']],
    'FER-FINNOM': [['P', 1, [[0, -5, 0], [200, -5, 0], [200, 5, 0], [0, 5, 0]]], ['T', 4.8599, -1.8856, 3, '*  : LONGUEUR MOYENNE', '$$$FER-TIT$$$', 0, 0],
      ['A', 196.4626, -1.9809, 4, 'RATIO', '$$$FER-TIT$$$', 2, 0, ''], ['A', 110.1345, -1.9809, 4, 'DMOY', '$$$FER-TIT$$$', 1, 0, '']],
    'REC-TAB': [['L', 0, 0, 13, 0], ['L', 0, -10, 13, -10], ['L', 0, -20, 13, -20], ['L', 0, -30, 13, -30], ['L', 0, -40, 13, -40],
      ['L', 0, 0, 0, -40], ['L', 13, 0, 13, -40],
      ['A', 6.5, -5, 2.8, 'DIAM', '$$$FER-NOM$$$', 4, 0, ''], ['A', 6.5, -15, 2.8, 'PML', '$$$FER-NOM$$$', 4, 0, '*'],
      ['A', 6.5, -25, 2.8, 'LG', '$$$FER-NOM$$$', 4, 0, '*'], ['A', 6.5, -35, 2.8, 'POIDS', '$$$FER-NOM$$$', 4, 0, '*']],
    '$$FER_BUL': [['C', 0, 0, 0.5]],
    '$FER_REPERE': [['A', 0, 0, 1, 'NUMERO', 'STANDARD', 4, 0, '']],
    // flèche ADFER (la hachure pleine du bloc d'origine est rendue par deux SOLID)
    'FLECHE': [['L', 1.25, 0.2, 0.99, 0], ['L', 0, 0, 1.25, 0.2], ['L', 0.99, 0, 1.25, -0.2], ['L', 1.25, -0.2, 0, 0],
      ['S', [[0, 0], [1.25, 0.2], [0.99, 0]]], ['S', [[0, 0], [0.99, 0], [1.25, -0.2]]]],
  };
  const BASE = { '$$FER_BUL': [-0.5, 0] };

  function enc(s) {
    let o = '';
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      o += c < 128 ? ch : '\\U+' + c.toString(16).toUpperCase().padStart(4, '0');
    }
    return o;
  }
  const num = (v) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(4);
  const deg = (v) => Math.atan2(v[1], v[0]) * 180 / Math.PI;

  /* ───────── Écrivain d'entités ───────── */
  function Writer() { this.o = []; this.ext = [Infinity, Infinity, -Infinity, -Infinity]; }
  Writer.prototype.p = function () { for (let i = 0; i < arguments.length; i += 2) this.o.push(String(arguments[i]), String(arguments[i + 1])); };
  Writer.prototype.grow = function (x, y) { const e = this.ext; e[0] = Math.min(e[0], x); e[1] = Math.min(e[1], y); e[2] = Math.max(e[2], x); e[3] = Math.max(e[3], y); };
  Writer.prototype.col = function (aci) { if (aci) this.p(62, aci); };
  Writer.prototype.line = function (a, b, layer, aci, lt) {
    this.p(0, 'LINE', 8, layer); if (lt) this.p(6, lt); this.col(aci); this.p(10, num(a[0]), 20, num(a[1]), 30, 0, 11, num(b[0]), 21, num(b[1]), 31, 0);
    this.grow(a[0], a[1]); this.grow(b[0], b[1]);
  };
  /* pts : [x, y] ou [x, y, bulge] */
  Writer.prototype.poly = function (pts, layer, closed, lt, aci, width) {
    if (pts.length === 2 && !closed && !width && !(pts[0][2])) return this.line(pts[0], pts[1], layer, aci, lt);
    this.p(0, 'POLYLINE', 8, layer); if (lt) this.p(6, lt); this.col(aci);
    this.p(66, 1, 10, 0, 20, 0, 30, 0, 70, closed ? 1 : 0);
    if (width) this.p(40, num(width), 41, num(width));
    pts.forEach((q) => {
      this.p(0, 'VERTEX', 8, layer, 10, num(q[0]), 20, num(q[1]), 30, 0);
      if (width) this.p(40, num(width), 41, num(width));
      if (q[2] && Math.abs(q[2]) > 1e-9) this.p(42, (+q[2]).toFixed(6));
      this.grow(q[0], q[1]);
    });
    this.p(0, 'SEQEND', 8, layer);
  };
  Writer.prototype.circle = function (c, r, layer, aci) {
    this.p(0, 'CIRCLE', 8, layer); this.col(aci); this.p(10, num(c[0]), 20, num(c[1]), 30, 0, 40, num(r));
    this.grow(c[0] - r, c[1] - r); this.grow(c[0] + r, c[1] + r);
  };
  Writer.prototype.dot = function (c, r, layer) { // disque plein : polyligne fermée à largeur
    this.p(0, 'POLYLINE', 8, layer, 66, 1, 10, 0, 20, 0, 30, 0, 70, 1, 40, num(r), 41, num(r));
    this.p(0, 'VERTEX', 8, layer, 10, num(c[0] - r / 2), 20, num(c[1]), 30, 0, 42, 1);
    this.p(0, 'VERTEX', 8, layer, 10, num(c[0] + r / 2), 20, num(c[1]), 30, 0, 42, 1);
    this.p(0, 'SEQEND', 8, layer);
    this.grow(c[0] - r, c[1] - r); this.grow(c[0] + r, c[1] + r);
  };
  Writer.prototype.solid = function (q, layer, aci) {
    const v = q.length === 3 ? [q[0], q[1], q[2], q[2]] : q;
    this.p(0, 'SOLID', 8, layer); this.col(aci);
    this.p(10, num(v[0][0]), 20, num(v[0][1]), 30, 0, 11, num(v[1][0]), 21, num(v[1][1]), 31, 0, 12, num(v[2][0]), 22, num(v[2][1]), 32, 0, 13, num(v[3][0]), 23, num(v[3][1]), 33, 0);
    v.forEach((p) => this.grow(p[0], p[1]));
  };
  /* Texte. hj : 0 gauche, 1 centre, 2 droite, 4 milieu ; vj : 0 ligne de base, 1 bas, 2 milieu, 3 haut. */
  Writer.prototype.text = function (p, h, s, layer, o) {
    o = o || {};
    const hj = o.hj == null ? 4 : o.hj, vj = o.vj || 0;
    this.p(0, 'TEXT', 8, layer); this.col(o.aci);
    this.p(10, num(p[0]), 20, num(p[1]), 30, 0, 40, num(h), 1, enc(s));
    if (o.rot) this.p(50, num(o.rot));
    if (o.wf) this.p(41, num(o.wf));
    this.p(7, o.style || 'STANDARD');
    if (hj || vj) this.p(72, hj, 11, num(p[0]), 21, num(p[1]), 31, 0);
    if (vj) this.p(73, vj);
    this.grow(p[0], p[1]);
  };
  /* Référence de bloc, avec attributs [{tag, val, p, h, style, hj, rot, inv}] en coordonnées monde. */
  Writer.prototype.insert = function (name, p, layer, o) {
    o = o || {};
    const at = o.attribs || [];
    this.p(0, 'INSERT', 8, layer); this.col(o.aci);
    if (at.length) this.p(66, 1);
    this.p(2, enc(name), 10, num(p[0]), 20, num(p[1]), 30, 0);
    const sx = o.sx == null ? 1 : o.sx, sy = o.sy == null ? sx : o.sy;
    if (sx !== 1 || sy !== 1) this.p(41, num(sx), 42, num(sy), 43, num(sx));
    if (o.rot) this.p(50, num(o.rot));
    this.grow(p[0], p[1]);
    if (!at.length) return;
    at.forEach((a) => {
      const hj = a.hj || 0;
      this.p(0, 'ATTRIB', 8, layer, 10, num(a.p[0]), 20, num(a.p[1]), 30, 0, 40, num(a.h), 1, enc(a.val == null ? '' : a.val), 2, enc(a.tag), 70, a.inv ? 1 : 0);
      if (a.rot) this.p(50, num(a.rot));
      this.p(7, a.style || 'STANDARD');
      if (hj) this.p(72, hj, 11, num(a.p[0]), 21, num(a.p[1]), 31, 0);
      this.grow(a.p[0], a.p[1]);
    });
    this.p(0, 'SEQEND', 8, layer);
  };

  /* Définition de bloc à partir des primitives ADFER (unités du bloc). */
  function defBlock(B, name, prims, base) {
    const b = base || [0, 0];
    B.p(0, 'BLOCK', 8, '0', 2, enc(name), 70, prims.some((q) => q[0] === 'A') ? 2 : 0, 10, b[0], 20, b[1], 30, 0, 3, enc(name));
    prims.forEach((q) => {
      if (q[0] === 'L') B.line([q[1], q[2]], [q[3], q[4]], '0');
      else if (q[0] === 'P') B.poly(q[2], '0', q[1]);
      else if (q[0] === 'C') B.circle([q[1], q[2]], q[3], '0');
      else if (q[0] === 'S') B.solid(q[1], '0');
      else if (q[0] === 'T') B.text([q[1], q[2]], q[3], q[4], '0', { style: q[5], hj: q[6], rot: q[7] });
      else if (q[0] === 'A') {
        B.p(0, 'ATTDEF', 8, '0', 10, num(q[1]), 20, num(q[2]), 30, 0, 40, num(q[3]), 1, enc(q[8] || ''), 3, enc(q[4]), 2, enc(q[4]), 70, q[9] ? 1 : 0);
        if (q[7]) B.p(50, num(q[7]));
        B.p(7, q[5]);
        if (q[6]) B.p(72, q[6], 11, num(q[1]), 21, num(q[2]), 31, 0);
      }
    });
    B.p(0, 'ENDBLK', 8, '0');
  }

  /* Attributs d'une insertion de bloc ADFER (échelles sx, sy), valeurs par étiquette. */
  function attribsOf(name, p, sx, sy, vals) {
    return ADFER[name].filter((q) => q[0] === 'A').map((q) => ({
      tag: q[4], val: vals[q[4]] == null ? '' : vals[q[4]], p: [p[0] + q[1] * sx, p[1] + q[2] * sy], h: q[3] * sx,
      style: q[5], hj: q[6], rot: q[7], inv: !!q[9],
    }));
  }

  /* ───────── Cotes : DIMENSION + bloc anonyme *D (géométrie de la cote au style KLE-50) ───────── */
  const DIMT = 0.1, DIMEXO = 0.05, DIMEXE = 0.05, TICK = 0.025, DIMGAP = 0.03;
  /* « 0.25 » → « ,25 », « 3.30 » → « 3,30 » (format des cotes KLE) */
  const fmtDim = (s) => String(s).replace(/(^|[^0-9])0\.(\d)/g, '$1.$2').replace(/(\d|^|\s)\.(\d)/g, '$1,$2');

  function dimension(W, B, d, dx, dy, nb) {
    const T = (q) => [q[0] + dx, q[1] + dy];
    const p1 = T(d.p1), p2 = T(d.p2), txt = fmtDim(d.txt), h = d.orient === 'h';
    const at = h ? d.at + dy : d.at + dx;
    // points de cote sur la ligne de cote
    const a = h ? [p1[0], at] : [at, p1[1]], b = h ? [p2[0], at] : [at, p2[1]];
    const lo = h ? (a[0] <= b[0] ? a : b) : (a[1] <= b[1] ? a : b), hi = lo === a ? b : a;
    const len = h ? hi[0] - lo[0] : hi[1] - lo[1];
    const tw = txt.length * DIMT * 0.62, fits = len > tw + 0.1;
    const name = '*D' + nb, L = '0';
    B.p(0, 'BLOCK', 8, L, 2, name, 70, 1, 10, 0, 20, 0, 30, 0, 3, name);
    // lignes d'attache
    [[p1, a], [p2, b]].forEach(([P, Q]) => {
      const v = h ? Math.sign(Q[1] - P[1]) || 1 : Math.sign(Q[0] - P[0]) || 1;
      const s0 = h ? [P[0], P[1] + v * DIMEXO] : [P[0] + v * DIMEXO, P[1]];
      const s1 = h ? [Q[0], Q[1] + v * DIMEXE] : [Q[0] + v * DIMEXE, Q[1]];
      if ((h ? (s1[1] - s0[1]) * v : (s1[0] - s0[0]) * v) > 0) B.line(s0, s1, L);
    });
    B.line(lo, hi, L);
    [lo, hi].forEach((q) => B.line([q[0] - TICK, q[1] - TICK], [q[0] + TICK, q[1] + TICK], L)); // traits obliques
    let tp, rot = 0;
    if (h) tp = fits ? [(lo[0] + hi[0]) / 2, at + DIMGAP] : [hi[0] + 0.06 + tw / 2, at + DIMGAP];
    else { rot = 90; tp = fits ? [at - DIMGAP, (lo[1] + hi[1]) / 2] : [at - DIMGAP, hi[1] + 0.06 + tw / 2]; }
    B.text(tp, DIMT, txt, L, { hj: 1, vj: 1, rot, style: 'KLE' });
    B.p(0, 'ENDBLK', 8, L);
    // entité DIMENSION (cote linéaire horizontale ou verticale, texte imposé au format KLE)
    W.p(0, 'DIMENSION', 8, '1-COTATION'); W.col(d.aci && d.aci !== 1 ? d.aci : 0);
    W.p(2, name, 3, 'KLE-50', 10, num(b[0]), 20, num(b[1]), 30, 0, 11, num(tp[0]), 21, num(tp[1]), 31, 0, 70, 0, 1, enc(txt),
      13, num(p1[0]), 23, num(p1[1]), 33, 0, 14, num(p2[0]), 24, num(p2[1]), 34, 0, 50, h ? 0 : 90);
    W.grow(lo[0], lo[1]); W.grow(hi[0], hi[1]); W.grow(p1[0], p1[1]); W.grow(p2[0], p2[1]);
  }

  /* ───────── Hachures ANSI31 (45°, pas 0,05 m) : lignes découpées par le contour (pair-impair) ───────── */
  function hatchLines(rings, step) {
    const out = [], c = Math.SQRT1_2, dir = [c, c], nrm = [-c, c];
    let kmin = Infinity, kmax = -Infinity;
    rings.forEach((r) => r.forEach((q) => { const k = q[0] * nrm[0] + q[1] * nrm[1]; kmin = Math.min(kmin, k); kmax = Math.max(kmax, k); }));
    for (let k = Math.ceil(kmin / step) * step; k <= kmax; k += step) {
      const ts = [];
      rings.forEach((r) => r.forEach((A, i) => {
        const Bq = r[(i + 1) % r.length], ka = A[0] * nrm[0] + A[1] * nrm[1], kb = Bq[0] * nrm[0] + Bq[1] * nrm[1];
        if ((ka - k) * (kb - k) < 0 || (ka === k && kb !== k)) {
          const t = (k - ka) / (kb - ka), P = [A[0] + (Bq[0] - A[0]) * t, A[1] + (Bq[1] - A[1]) * t];
          ts.push(P[0] * dir[0] + P[1] * dir[1]);
        }
      }));
      ts.sort((x, y) => x - y);
      for (let i = 0; i + 1 < ts.length; i += 2) {
        if (ts[i + 1] - ts[i] < 1e-6) continue;
        out.push([[nrm[0] * k + dir[0] * ts[i], nrm[1] * k + dir[1] * ts[i]], [nrm[0] * k + dir[0] * ts[i + 1], nrm[1] * k + dir[1] * ts[i + 1]]]);
      }
    }
    return out;
  }

  /* ───────── Repère ADFER : ligne d'attache, flèche, bulle, numéro, quantité ───────── */
  function repere(W, it, T) {
    const path = it.path.map(T), c = T(it.c), L = 'ADFER-REPERAGE';
    W.poly(path, L, false);
    const tip = path[path.length - 1], prev = path[path.length - 2];
    W.insert('FLECHE', tip, L, { sx: 0.08, rot: deg([prev[0] - tip[0], prev[1] - tip[1]]) });
    const E = path[0];
    W.insert('$$FER_BUL', E, L, { sx: 0.32, rot: deg([c[0] - E[0], c[1] - E[1]]) });
    W.insert('$FER_REPERE', c, L, { sx: 0.14, attribs: [{ tag: 'NUMERO', val: it.id, p: c, h: 0.14, style: 'STANDARD', hj: 4 }] });
    // quantité au-dessus du premier tronçon de l'attache, côté bulle
    const n = path[1], mid = [(E[0] + n[0]) / 2, (E[1] + n[1]) / 2], seg = Math.abs(n[0] - E[0]), tw = String(it.qty).length * 0.1 * 0.62;
    const P = seg > tw + 0.06 ? [mid[0], E[1] + 0.09] : [E[0] - it.side * (tw / 2 + 0.03), E[1] + 0.09];
    W.text(P, 0.1, String(it.qty).replace(/^(\d+)(HA|TS|RL)/, '$1 $2'), L, { hj: 4, style: 'STANDARD' });
  }

  /* ───────── Écriture d'une scène décalée de (dx, dy) ───────── */
  function writeScene(W, B, sc, dx, dy, st) {
    const T = (q) => [q[0] + dx, q[1] + dy];
    for (const it of sc.items) {
      if (it.dimPart || it.repPart) continue;
      if (it.t === 'dim') { dimension(W, B, it, dx, dy, ++st.nd); continue; }
      if (it.t === 'rep') { repere(W, it, T); continue; }
      if (it.t === 'poly') {
        let layer = '1-VU', lt = null;
        if (it.section) layer = '1-COUPE';
        else if (it.hach) layer = '1-HACH-1';
        else if (it.layer === 'REPERAGE') layer = 'ADFER-REPERAGE';
        else if (it.layer === 'KLE-Contour') layer = '1-COUPE';
        else if (it.aci === 41) layer = '1-REPRISE';
        if (it.dash && it.dash.split(' ').length >= 4) { layer = '1-AXES'; lt = 'CENTER2'; }
        else if (it.dash) lt = 'HIDDEN2';
        if (it.solid && it.pts.length === 3) { W.solid(it.pts.map(T), layer); continue; }
        if (it.aci === 41) { // symbole de reprise / d'arrêt : ramené à sa taille écran (échelle des scènes ×4)
          const c = it.pts.reduce((a, q) => [a[0] + q[0] / it.pts.length, a[1] + q[1] / it.pts.length], [0, 0]), k = 0.004 / U;
          W.poly(it.pts.map((q) => T([c[0] + (q[0] - c[0]) * k, c[1] + (q[1] - c[1]) * k])), layer, false); continue;
        }
        if (it.stroke === false && !it.hatch) continue; // aplat de couleur sans contour (écran seulement)
        if (it.stroke !== false) {
          W.poly(it.pts.map(T), layer, !!it.closed, lt);
          (it.holes || []).forEach((h) => W.poly(h.map(T), layer, true, lt));
        }
        if (it.hatch) {
          const rings = [it.pts].concat(it.holes || []).map((r) => r.map(T)), name = '*X' + (++st.nx);
          B.p(0, 'BLOCK', 8, '0', 2, name, 70, 1, 10, 0, 20, 0, 30, 0, 3, name);
          hatchLines(rings, 0.05).forEach((s) => B.line(s[0], s[1], '0'));
          B.p(0, 'ENDBLK', 8, '0');
          W.insert(name, [0, 0], '1-HACH-1');
        }
      } else if (it.t === 'bar') {
        const d = HA_OF_ACI[it.aci] || 10;
        W.poly(it.path.map((v) => { const q = T(v.p); return [q[0], q[1], v.b]; }), layerHA(d), false, null, null, it.wM);
      } else if (it.t === 'circle') {
        if (it.layer === 'ACIERS' && it.fill) W.dot(T(it.c), it.r, layerHA(HA_OF_ACI[it.aci] || 10));
        else W.circle(T(it.c), it.r, it.layer === 'REPERAGE' ? 'ADFER-REPERAGE' : '1-VU');
      } else if (it.t === 'text') {
        if (it.cls === 'mkt') W.text(T(it.p), 0.14, it.s, 'ADFER-REPERAGE', { hj: anchorHJ(it.anchor) });
        else W.text(T(it.p), Math.max(0.08, it.h * 0.01), it.s, '1-TEXTE', { hj: anchorHJ(it.anchor), rot: it.rot, style: 'M' });
      }
    }
  }
  const anchorHJ = (a) => (a === 'start' ? 0 : a === 'end' ? 2 : 4);
  /* texte gauche/droite cadré au milieu verticalement : TEXT cadrage « ML » / « MR » */

  /* Titre de vue façon KLE : intitulé souligné, échelle dessous. */
  function viewTitle(W, x, y, title) {
    W.text([x, y], 0.2, '%%U' + title, '1-TITRE', { hj: 4, style: 'KLE' });
    W.text([x, y - 0.26], 0.14, 'ECH. : 1/' + ECH, '1-TITRE', { hj: 4, style: 'KLE' });
  }

  const f3 = (v) => (v == null || isNaN(v) ? '' : Number(v).toFixed(3));

  /* ───────── Nomenclature ADFER ───────── */
  function nomenclature(W, rows, rec, x0, yTop) {
    const s = 0.025, L = 'ADFER-NOMENC';
    let yc = yTop - 6.5 * s;
    W.insert('FER-TITREGEN', [x0, yc], L, { sx: s, attribs: attribsOf('FER-TITREGEN', [x0, yc], s, s, { TITRE: 'Nomenclature générale des aciers .' }) });
    yc -= 14 * s;
    W.insert('fer-tit', [x0, yc], L, { sx: s });
    let y = yc - 7.5 * s; // bas de l'en-tête = haut de la 1re ligne
    rows.forEach((r) => {
      // hauteur de ligne : 13 unités, davantage pour un façonnage à retours verticaux marqués (U, épingle haute…)
      const gm0 = F.croquisGeom(r.shape, 150, 110), ys = gm0.pts.map((q) => q[1]), xs = gm0.pts.map((q) => q[0]);
      const ratio = (Math.max.apply(null, ys) - Math.min.apply(null, ys)) / Math.max(1, Math.max.apply(null, xs) - Math.min.apply(null, xs));
      const H = ratio > 0.3 ? Math.min(35, Math.round(13 + 30 * ratio)) : 13;
      const c = y - H * s / 2;
      const bends = (r.shape.segs || []).length > 1 || (r.shape.hooks || []).some((k) => k);
      const nbE = (r.mult || 1) * (r.nbElem || 1), varL = r.kind === 'densite';
      const vals = {
        REP: r.id, COD: r.code || '', NC: r.type || 'HA', FI: r.d, NB: r.n, NE: nbE, NTOT: r.total,
        ESP: r.kind === 'densite' ? '' : f3(r.esp), LC: f3(r.L) + (varL ? '*' : ''), SCHEMA: '',
        MAN: bends && r.D ? (r.D * 100).toFixed(1) : '', LT: f3(r.Ltot), INDICE: '1',
      };
      W.insert('fer-nom', [x0, c], L, { sx: s, sy: s * H / 13, attribs: attribsOf('fer-nom', [x0, c], s, 0, vals) });
      // croquis de façonnage dans la colonne (112,5 → 159,5 unités), cotes au style $LIBFER$
      const cw = 47 * s, ch = (H - 1.5) * s, wpx = 150, hpx = wpx * ch / cw, gm = F.croquisGeom(r.shape, wpx, hpx), k = cw / wpx;
      const P = (q) => [x0 + 112.5 * s + q[0] * k, c + ch / 2 - q[1] * k];
      W.poly(gm.path.map((v) => { const q = P(v.p); return [q[0], q[1], -v.b]; }), L, false);
      gm.texts.forEach((t) => W.text(P([t.x, t.y]), 2 * s, t.s, L, { hj: t.anchor === 'start' ? 0 : t.anchor === 'end' ? 2 : 4, style: '$LIBFER$', vj: t.anchor === 'middle' ? 0 : 2 }));
      y -= H * s;
    });
    // pied : longueur moyenne, diamètre moyen
    let sumL = 0, sumD2L = 0;
    rec.lignes.forEach((l) => { sumL += l.longueur; sumD2L += l.d * l.d * l.longueur; });
    const dmoy = sumL > 0 ? Math.sqrt(sumD2L / sumL) : 0;
    yc = y - 5 * s;
    W.insert('FER-FINNOM', [x0, yc], L, { sx: s, attribs: attribsOf('FER-FINNOM', [x0, yc], s, s, { RATIO: '', DMOY: 'Diamètre moyen : ' + dmoy.toFixed(1) }) });
    // récapitulatif des aciers
    yc -= (5 + 4.5 + 6.5) * s;
    W.insert('FER-TITREGEN', [x0, yc], L, { sx: s, attribs: attribsOf('FER-TITREGEN', [x0, yc], s, s, { TITRE: 'RECAPITULATIF DES ACIERS' }) });
    const sr = s * 200 / 191, top = yc - 6.5 * s - 2 * s, hc = 22 * sr;
    // colonne d'intitulés
    [0, 10, 20, 30, 40].forEach((v) => W.line([x0, top - v * sr], [x0 + hc, top - v * sr], L));
    W.line([x0, top], [x0, top - 40 * sr], L);
    [['DIAMETRE'], ['MASSE', '(kg/ml)'], ['LONGUEUR', '(m)'], ['POIDS', '(kg)']].forEach((t, i) => {
      const yy = top - (5 + 10 * i) * sr;
      if (t.length === 1) W.text([x0 + hc / 2, yy], 2.8 * sr, t[0], L, { hj: 4, style: '$$$FER-NOM$$$' });
      else { W.text([x0 + hc / 2, yy + 1.8 * sr], 2.8 * sr, t[0], L, { hj: 4, style: '$$$FER-NOM$$$' }); W.text([x0 + hc / 2, yy - 1.8 * sr], 2.8 * sr, t[1], L, { hj: 4, style: '$$$FER-NOM$$$' }); }
    });
    let x = x0 + hc;
    const colOf = (vals, wx) => { const p = [x, top]; W.insert('REC-TAB', p, L, { sx: sr * wx, sy: sr, attribs: attribsOf('REC-TAB', p, sr * wx, sr, vals).map((a) => Object.assign(a, { h: 2.8 * sr })) }); x += 13 * sr * wx; };
    DIAMS.forEach((d) => {
      const l = rec.lignes.find((q) => q.d === d) || { ml: F.MASSE_LIN[d], longueur: 0, masse: 0 };
      colOf({ DIAM: 'HA' + d, PML: l.ml.toFixed(3), LG: l.longueur > 0 ? l.longueur.toFixed(1) : '-', POIDS: l.masse > 0 ? l.masse.toFixed(1) : '-' }, 1);
    });
    colOf({ DIAM: 'HA-', PML: '-', LG: '-', POIDS: '-' }, 1);
    colOf({ DIAM: 'D.MOY(mm)', PML: dmoy.toFixed(2), LG: 'TOTAL(kg)', POIDS: rec.total.toFixed(1) }, 2);
    return top - 40 * sr;
  }

  /* ───────── Fichier complet ───────── */
  function buildDXF(struct, g, res, meta) {
    meta = meta || {};
    const W = new Writer(), B = new Writer(), st = { nd: 0, nx: 0 };
    const sA = F.coffrageScene(struct, g, U), bA = F.bounds(sA);
    const sB = F.ferraillageScene(struct, g, res.bars, res.params, U), bB = F.bounds(sB);
    const sC = F.secondScene(struct, g, U), bC = F.bounds(sC);
    // coupe de coffrage à l'origine, coupe ferraillée à droite
    writeScene(W, B, sA, 0, 0, st);
    const dxB = bA[2] - bB[0] + 1.5;
    writeScene(W, B, sB, dxB, 0, st);
    const yTitle = Math.min(bA[1], bB[1]) - 0.5;
    viewTitle(W, (bA[0] + bA[2]) / 2, yTitle, 'COFFRAGE - COUPE TYPE');
    viewTitle(W, (bB[0] + bB[2]) / 2 + dxB, yTitle, 'FERRAILLAGE - COUPE TYPE');
    let yLow = yTitle - 0.6;
    // coupe longitudinale A-A sous la coupe ferraillée
    const sL = F.longiScene ? F.longiScene(struct, g, res.bars, res.params, U) : null;
    if (sL) {
      const bL = F.bounds(sL), dyL = yLow - bL[3] - 0.4, dxL = dxB + (bB[0] + bB[2]) / 2 - (bL[0] + bL[2]) / 2;
      writeScene(W, B, sL, dxL, dyL, st);
      viewTitle(W, (bL[0] + bL[2]) / 2 + dxL, bL[1] + dyL - 0.5, 'COUPE A-A - ' + (struct === 'dalot' ? 'RADIER ET TRAVERSE' : 'SEMELLE'));
      yLow = bL[1] + dyL - 1.1;
    }
    // élévation (mur) ou vue en plan (dalot) sous l'ensemble, calée à gauche
    const dyC = yLow - bC[3] - 0.4, dxC = bA[0] - bC[0];
    writeScene(W, B, sC, dxC, dyC, st);
    viewTitle(W, (bC[0] + bC[2]) / 2 + dxC, bC[1] + dyC - 0.5, struct === 'dalot' ? 'VUE EN PLAN' : 'ELEVATION DU PLOT');
    // nomenclature à droite, en haut
    const xT = bB[2] + dxB + 1.5, yTop = Math.max(bA[3], bB[3]);
    const yEnd = nomenclature(W, res.rows, res.recap, xT, yTop);
    const p = res.params;
    const notes = [
      (meta.titre || 'BridgeAI Studios — Plans coffrage & ferraillage') + ' — unité : mètre — échelle 1/' + ECH,
      'Norme ' + p.norme + ' — enrobages ' + Math.round(p.cTerre * 100) + ' cm (terre / fondation), ' + Math.round(p.cAutre * 100) + ' cm (autres parements)',
      'Longueur maxi ' + p.lmax + ' m — recouvrement ' + p.recouv + 'Ø — masse totale ' + res.recap.total.toFixed(1) + ' kg',
      'Ferraillage proposé à titre indicatif : à justifier par une note de calcul.',
    ];
    notes.forEach((t, i) => W.text([xT, yEnd - 0.3 - i * 0.18], 0.105, t, '1-TEXTE', { hj: 0, style: 'M' }));

    // blocs ADFER
    Object.keys(ADFER).forEach((n) => defBlock(B, n, ADFER[n], BASE[n]));

    const e = W.ext, H = [];
    const hp = function () { for (let i = 0; i < arguments.length; i += 2) H.push(String(arguments[i]), String(arguments[i + 1])); };
    hp(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$DWGCODEPAGE', 3, 'ANSI_1252',
      9, '$INSBASE', 10, 0, 20, 0, 30, 0,
      9, '$EXTMIN', 10, num(e[0]), 20, num(e[1]), 30, 0, 9, '$EXTMAX', 10, num(e[2]), 20, num(e[3]), 30, 0,
      9, '$LIMMIN', 10, num(e[0]), 20, num(e[1]), 9, '$LIMMAX', 10, num(e[2]), 20, num(e[3]),
      9, '$LTSCALE', 40, 1, 9, '$TEXTSTYLE', 7, 'STANDARD', 9, '$CLAYER', 8, '1-COUPE', 9, '$DIMSTYLE', 2, 'KLE-50',
      9, '$DIMSCALE', 40, 50, 9, '$DIMTXT', 40, 0.002, 9, '$DIMASZ', 40, 0.001, 9, '$DIMTSZ', 40, 0.0005, 9, '$DIMEXO', 40, 0.001,
      9, '$DIMEXE', 40, 0.001, 9, '$DIMTAD', 70, 1, 9, '$DIMTIH', 70, 0, 9, '$DIMTOH', 70, 0, 9, '$DIMZIN', 70, 4, 0, 'ENDSEC');
    hp(0, 'SECTION', 2, 'TABLES');
    hp(0, 'TABLE', 2, 'LTYPE', 70, 4,
      0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, '0.0',
      0, 'LTYPE', 2, 'DASHED', 70, 0, 3, '__ __ __', 72, 65, 73, 2, 40, '0.3', 49, '0.2', 49, '-0.1',
      0, 'LTYPE', 2, 'HIDDEN2', 70, 0, 3, '- - - -', 72, 65, 73, 2, 40, '0.15', 49, '0.1', 49, '-0.05',
      0, 'LTYPE', 2, 'CENTER2', 70, 0, 3, '___ _ ___', 72, 65, 73, 4, 40, '0.64', 49, '0.4', 49, '-0.08', 49, '0.08', 49, '-0.08',
      0, 'ENDTAB');
    hp(0, 'TABLE', 2, 'LAYER', 70, LAYERS.length + 1, 0, 'LAYER', 2, '0', 70, 0, 62, 7, 6, 'CONTINUOUS');
    LAYERS.forEach(([n, c, lt]) => hp(0, 'LAYER', 2, n, 70, 0, 62, c, 6, lt || 'CONTINUOUS'));
    hp(0, 'ENDTAB');
    hp(0, 'TABLE', 2, 'STYLE', 70, STYLES.length);
    STYLES.forEach(([n, f]) => hp(0, 'STYLE', 2, n, 70, 0, 40, '0.0', 41, '1.0', 50, '0.0', 71, 0, 42, '0.2', 3, f, 4, ''));
    hp(0, 'ENDTAB');
    hp(0, 'TABLE', 2, 'DIMSTYLE', 70, 1,
      0, 'DIMSTYLE', 2, 'KLE-50', 70, 0, 3, '', 4, '', 5, '', 6, '', 7, '',
      40, 50, 41, 0.001, 42, 0.001, 43, 0.0076, 44, 0.001, 45, 0, 46, 0, 47, 0, 48, 0,
      140, 0.002, 141, 0.0018, 142, 0.0005, 143, 25.4, 144, 1, 145, 0, 146, 1, 147, 0.0006,
      71, 0, 72, 0, 73, 0, 74, 0, 75, 0, 76, 0, 77, 1, 78, 4, 170, 0, 171, 2, 172, 0, 173, 0, 174, 0, 175, 0, 176, 0, 177, 0, 178, 7,
      0, 'ENDTAB');
    hp(0, 'ENDSEC', 0, 'SECTION', 2, 'BLOCKS');
    const all = H.concat(B.o, ['0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'], W.o, ['0', 'ENDSEC', '0', 'EOF']);
    return all.join('\r\n') + '\r\n';
  }

  return { buildDXF, DXF_LAYERS: LAYERS.map((l) => l[0]), DXF_SCALE: ECH };
});
