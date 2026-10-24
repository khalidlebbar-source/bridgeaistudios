/* BridgeAI Studios — Bridge Composer : export DXF du plan de coffrage d'ensemble.
 *
 * DXF ASCII R12 (AC1009), unité le mètre, dessin en vraie grandeur dans l'espace objet :
 *   - élévation longitudinale (hauteur de texte calée sur son échelle) ;
 *   - coupe transversale du tablier et coupe sur la pile la plus haute, sous l'élévation ;
 *   - cartouche et notes.
 * Calques : 1-COUPE, 1-PREFA, 1-CHARPENTE, 1-VU, 1-AXES, 1-TN, 1-REMBLAI, 1-PIEUX, 1-APPUIS,
 * 1-EQUIPEMENTS, 1-COTATION, 1-TEXTE, 1-TITRE, 1-CARTOUCHE. Cotes éclatées (lignes + texte).
 * Les caractères accentués sont écrits en \U+XXXX.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? Object.assign({}, require('./calc.js'), require('./draw.js')) : root.COMP;
  const api = factory(C);
  if (isNode) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';

  const LAYERS = [
    ['1-COUPE', 7], ['1-PREFA', 30], ['1-CHARPENTE', 5], ['1-VU', 8, 'TIRETS'], ['1-AXES', 1, 'AXES'], ['1-TN', 32],
    ['1-REMBLAI', 42], ['1-PIEUX', 7, 'TIRETS'], ['1-APPUIS', 6], ['1-EQUIPEMENTS', 4], ['1-COTATION', 1],
    ['1-TEXTE', 7], ['1-TITRE', 2], ['1-CARTOUCHE', 7],
  ];
  const LAY = {
    beton: '1-COUPE', prefa: '1-PREFA', acier: '1-CHARPENTE', acierL: '1-CHARPENTE', vu: '1-VU', axe: '1-AXES', tn: '1-TN',
    remblai: '1-REMBLAI', pieu: '1-PIEUX', app: '1-APPUIS', equip: '1-EQUIPEMENTS', trottoir: '1-EQUIPEMENTS',
    ballast: '1-EQUIPEMENTS', texte: '1-TEXTE', titre: '1-TITRE',
  };

  function enc(s) {
    let o = '';
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      o += c < 128 ? ch : '\\U+' + c.toString(16).toUpperCase().padStart(4, '0');
    }
    return o;
  }
  const num = (v) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(4);

  function Writer() { this.o = []; this.ext = [Infinity, Infinity, -Infinity, -Infinity]; }
  Writer.prototype.p = function () { for (let i = 0; i < arguments.length; i += 2) this.o.push(String(arguments[i]), String(arguments[i + 1])); };
  Writer.prototype.grow = function (x, y) { const e = this.ext; e[0] = Math.min(e[0], x); e[1] = Math.min(e[1], y); e[2] = Math.max(e[2], x); e[3] = Math.max(e[3], y); };
  Writer.prototype.line = function (a, b, layer) {
    this.p(0, 'LINE', 8, layer, 10, num(a[0]), 20, num(a[1]), 30, 0, 11, num(b[0]), 21, num(b[1]), 31, 0);
    this.grow(a[0], a[1]); this.grow(b[0], b[1]);
  };
  Writer.prototype.poly = function (pts, layer, closed) {
    if (pts.length === 2 && !closed) return this.line(pts[0], pts[1], layer);
    this.p(0, 'POLYLINE', 8, layer, 66, 1, 10, 0, 20, 0, 30, 0, 70, closed ? 1 : 0);
    pts.forEach((q) => { this.p(0, 'VERTEX', 8, layer, 10, num(q[0]), 20, num(q[1]), 30, 0); this.grow(q[0], q[1]); });
    this.p(0, 'SEQEND', 8, layer);
  };
  /* hj : 0 gauche, 1 centre, 2 droite ; vj : 0 ligne de base, 2 milieu */
  Writer.prototype.text = function (p, h, s, layer, hj, vj, rot) {
    this.p(0, 'TEXT', 8, layer, 10, num(p[0]), 20, num(p[1]), 30, 0, 40, num(h), 1, enc(s));
    if (rot) this.p(50, num(rot));
    this.p(7, 'STANDARD');
    if (hj || vj) this.p(72, hj || 0, 11, num(p[0]), 21, num(p[1]), 31, 0);
    if (vj) this.p(73, vj);
    this.grow(p[0], p[1]);
  };

  /* Écrit une scène décalée de (dx, dy) ; textes et cotes à l'échelle de la scène */
  function writeScene(Wr, sc, dx, dy) {
    const k = sc.ech / 1000, T = (q) => [q[0] + dx, q[1] + dy];
    sc.P.forEach((p) => {
      if (p.k === 'poly') {
        if (p.lay === 'sol') return;
        Wr.poly(p.pts.map(T), LAY[p.lay] || '1-VU', p.closed && p.pts.length > 2);
      } else if (p.k === 'text') {
        const hj = p.anchor === 'middle' ? 1 : p.anchor === 'end' ? 2 : 0;
        Wr.text(T([p.p[0], p.p[1] + p.dy * k]), p.ht * k, p.s, LAY[p.lay] || '1-TEXTE', hj, 0);
      } else if (p.k === 'dim') {
        const L = '1-COTATION', tk = 1.2 * k, ht = 2.0 * k, ext = 1.5 * k;
        if (p.dir === 'h') {
          const y = Math.max(p.a[1], p.b[1]) + p.off * k, x1 = p.a[0], x2 = p.b[0], sg = p.off >= 0 ? 1 : -1;
          Wr.line(T([x1, p.a[1] + sg * 0.5 * k]), T([x1, y + sg * ext]), L);
          Wr.line(T([x2, p.b[1] + sg * 0.5 * k]), T([x2, y + sg * ext]), L);
          Wr.line(T([x1 - 2 * k, y]), T([x2 + 2 * k, y]), L);
          [x1, x2].forEach((x) => Wr.line(T([x - tk, y - tk]), T([x + tk, y + tk]), L));
          Wr.text(T([(x1 + x2) / 2, y + 0.8 * k]), ht, p.s, L, 1, 0);
        } else {
          const x = p.a[0] + p.off * k, y1 = p.a[1], y2 = p.b[1], sg = p.off >= 0 ? 1 : -1;
          Wr.line(T([p.a[0] + sg * 0.5 * k, y1]), T([x + sg * ext, y1]), L);
          Wr.line(T([p.b[0] + sg * 0.5 * k, y2]), T([x + sg * ext, y2]), L);
          Wr.line(T([x, Math.min(y1, y2) - 2 * k]), T([x, Math.max(y1, y2) + 2 * k]), L);
          [y1, y2].forEach((y) => Wr.line(T([x - tk, y - tk]), T([x + tk, y + tk]), L));
          Wr.text(T([x - 0.8 * k, (y1 + y2) / 2]), ht, p.s, L, 1, 0, 90);
        }
      } else if (p.k === 'brk') {
        const m = (p.a[0] + p.b[0]) / 2, y = p.a[1], z = 1.5 * k;
        Wr.poly([[p.a[0], y], [m - z, y], [m - z / 2, y + z], [m + z / 2, y - z], [m + z, y], [p.b[0], y]].map(T), '1-COUPE', false);
      }
    });
  }

  function bounds(sc) {
    const b = [Infinity, Infinity, -Infinity, -Infinity];
    const g = (x, y) => { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); };
    const k = sc.ech / 1000;
    sc.P.forEach((p) => {
      if (p.k === 'poly' && p.lay !== 'sol') p.pts.forEach((q) => g(q[0], q[1]));
      else if (p.k === 'dim') { g(p.a[0], p.a[1] + (p.dir === 'h' ? p.off * k : 0)); g(p.b[0] + (p.dir === 'v' ? p.off * k : 0), p.b[1]); }
      else if (p.k === 'text') g(p.p[0], p.p[1] + p.dy * k);
    });
    return b;
  }

  function buildDXF(M, meta) {
    meta = meta || {};
    const W = new Writer();
    const E = C.elevScene(M), S = C.secScene(M);
    const bE = bounds(E), bS = bounds(S);
    const kE = E.ech / 1000, kS = S.ech / 1000;
    writeScene(W, E, 0, 0);
    W.text([(bE[0] + bE[2]) / 2, bE[1] - 9 * kE], 5 * kE, E.titre, '1-TITRE', 1, 0);
    // coupe sous l'élévation, calée à gauche
    const dyS = bE[1] - 16 * kE - bS[3], dxS = bE[0] - bS[0];
    writeScene(W, S, dxS, dyS);
    W.text([(bS[0] + bS[2]) / 2 + dxS, bS[1] + dyS - 9 * kS], 5 * kS, S.titre, '1-TITRE', 1, 0);

    // cartouche à droite de la coupe (à l'échelle de l'élévation)
    const P = M.S.projet, k = kE;
    const x0 = Math.max(bS[2] + dxS + 20 * kS, (bE[0] + bE[2]) / 2), yT = bE[1] - 20 * kE;
    const cw = 180 * k, rows = [
      ['BridgeAI Studios — Bridge Composer', 4],
      [(P.nom || 'Ouvrage') + (P.ouvrage ? ' — ' + P.ouvrage : ''), 3.5],
      [(P.moa ? 'Maître d’ouvrage : ' + P.moa + '   ' : '') + (P.lieu ? 'Lieu : ' + P.lieu : ''), 2.5],
      ['PLAN DE COFFRAGE D’ENSEMBLE — AVANT-PROJET (configurateur)', 3],
      [M.T.nom + ' — ' + M.S.travees.map((v) => C.fr(v, 2)).join(' + ') + ' = ' + C.fr(M.Ltot, 2) + ' m — largeur ' + C.fr(M.W, 2) + ' m — h = ' + C.fr(M.h, 2) + ' m', 2.5],
      ['Unité : mètre. Élévation 1/' + E.ech + ', coupe 1/' + S.ech + '. ' + (P.ref ? 'Réf. ' + P.ref + '. ' : '') + 'Date : ' + (meta.date || ''), 2.5],
      ['Prédimensionnement indicatif : à justifier par une note de calcul.', 2.5],
    ];
    const rh = 8 * k;
    W.poly([[x0, yT], [x0 + cw, yT], [x0 + cw, yT - rows.length * rh], [x0, yT - rows.length * rh]], '1-CARTOUCHE', true);
    rows.forEach((r, i) => {
      if (i) W.line([x0, yT - i * rh], [x0 + cw, yT - i * rh], '1-CARTOUCHE');
      W.text([x0 + 3 * k, yT - i * rh - rh / 2], r[1] * k, r[0], i === 0 ? '1-TITRE' : '1-TEXTE', 0, 2);
    });

    const e = W.ext, H = [];
    const hp = function () { for (let i = 0; i < arguments.length; i += 2) H.push(String(arguments[i]), String(arguments[i + 1])); };
    const sAx = E.ech / 1000;
    hp(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$DWGCODEPAGE', 3, 'ANSI_1252',
      9, '$INSBASE', 10, 0, 20, 0, 30, 0,
      9, '$EXTMIN', 10, num(e[0]), 20, num(e[1]), 30, 0, 9, '$EXTMAX', 10, num(e[2]), 20, num(e[3]), 30, 0,
      9, '$LIMMIN', 10, num(e[0]), 20, num(e[1]), 9, '$LIMMAX', 10, num(e[2]), 20, num(e[3]),
      9, '$LTSCALE', 40, 1, 9, '$TEXTSTYLE', 7, 'STANDARD', 9, '$CLAYER', 8, '1-COUPE', 0, 'ENDSEC');
    hp(0, 'SECTION', 2, 'TABLES');
    hp(0, 'TABLE', 2, 'LTYPE', 70, 3,
      0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, '0.0',
      0, 'LTYPE', 2, 'TIRETS', 70, 0, 3, '__ __ __', 72, 65, 73, 2, 40, num(5 * sAx), 49, num(3.5 * sAx), 49, num(-1.5 * sAx),
      0, 'LTYPE', 2, 'AXES', 70, 0, 3, '____ _ ____', 72, 65, 73, 4, 40, num(20 * sAx), 49, num(14 * sAx), 49, num(-2.5 * sAx), 49, num(1 * sAx), 49, num(-2.5 * sAx),
      0, 'ENDTAB');
    hp(0, 'TABLE', 2, 'LAYER', 70, LAYERS.length + 1, 0, 'LAYER', 2, '0', 70, 0, 62, 7, 6, 'CONTINUOUS');
    LAYERS.forEach(([nm, c, lt]) => hp(0, 'LAYER', 2, nm, 70, 0, 62, c, 6, lt || 'CONTINUOUS'));
    hp(0, 'ENDTAB');
    hp(0, 'TABLE', 2, 'STYLE', 70, 1, 0, 'STYLE', 2, 'STANDARD', 70, 0, 40, '0.0', 41, '0.9', 50, '0.0', 71, 0, 42, '0.2', 3, 'arial.ttf', 4, '', 0, 'ENDTAB');
    hp(0, 'ENDSEC', 0, 'SECTION', 2, 'BLOCKS', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
    return H.concat(W.o, ['0', 'ENDSEC', '0', 'EOF']).join('\r\n') + '\r\n';
  }

  return { buildDXF, DXF_LAYERS: LAYERS.map((l) => l[0]) };
});
