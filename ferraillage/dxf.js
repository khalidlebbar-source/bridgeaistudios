/* BridgeAI Studios — Plans de coffrage & ferraillage : export DXF.
 *
 * DXF ASCII R12 (AC1009) : entités LINE, POLYLINE/VERTEX, CIRCLE, TEXT.
 * Unité de dessin : le mètre. Calques : KLE-Contour, ACIERS, KLE-Cotation,
 * REPERAGE, NOMENC. Les caractères accentués sont écrits en \U+XXXX.
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const F = isNode ? Object.assign({}, require('./calc.js'), require('./draw.js')) : root.FERR;
  const api = factory(F);
  if (isNode) module.exports = api;
  else root.FERR = Object.assign(root.FERR || {}, api);
})(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';

  const LAYERS = [['KLE-Contour', 7], ['ACIERS', 1], ['KLE-Cotation', 3], ['REPERAGE', 5], ['NOMENC', 7]];
  const U = 0.004; // mètres par « pixel » des scènes (texte 11 px → 0,044 m)

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
  Writer.prototype.poly = function (pts, layer, closed, ltype) {
    if (pts.length === 2 && !closed && !ltype) return this.line(pts[0], pts[1], layer);
    this.p(0, 'POLYLINE', 8, layer); if (ltype) this.p(6, ltype);
    this.p(66, 1, 10, 0, 20, 0, 30, 0, 70, closed ? 1 : 0);
    pts.forEach((q) => { this.p(0, 'VERTEX', 8, layer, 10, num(q[0]), 20, num(q[1]), 30, 0); this.grow(q[0], q[1]); });
    this.p(0, 'SEQEND', 8, layer);
  };
  /* Barre cintrée : POLYLINE à largeur constante (40/41 = Ø en m) et sommets à bulge (42). */
  Writer.prototype.bar = function (path, width, layer) {
    const wd = num(width);
    this.p(0, 'POLYLINE', 8, layer, 66, 1, 10, 0, 20, 0, 30, 0, 70, 0, 40, wd, 41, wd);
    path.forEach((v) => {
      this.p(0, 'VERTEX', 8, layer, 10, num(v.p[0]), 20, num(v.p[1]), 30, 0, 40, wd, 41, wd);
      if (Math.abs(v.b) > 1e-9) this.p(42, v.b.toFixed(6));
      this.grow(v.p[0], v.p[1]);
    });
    this.p(0, 'SEQEND', 8, layer);
  };
  Writer.prototype.circle = function (c, r, layer) {
    this.p(0, 'CIRCLE', 8, layer, 10, num(c[0]), 20, num(c[1]), 30, 0, 40, num(r));
    this.grow(c[0] - r, c[1] - r); this.grow(c[0] + r, c[1] + r);
  };
  /* Disque plein (pastille d'acier filant) : polyligne fermée à largeur, 2 sommets en arc. */
  Writer.prototype.dot = function (c, r, layer) {
    this.p(0, 'POLYLINE', 8, layer, 66, 1, 10, 0, 20, 0, 30, 0, 70, 1, 40, num(r), 41, num(r));
    this.p(0, 'VERTEX', 8, layer, 10, num(c[0] - r / 2), 20, num(c[1]), 30, 0, 42, 1);
    this.p(0, 'VERTEX', 8, layer, 10, num(c[0] + r / 2), 20, num(c[1]), 30, 0, 42, 1);
    this.p(0, 'SEQEND', 8, layer);
    this.grow(c[0] - r, c[1] - r); this.grow(c[0] + r, c[1] + r);
  };
  Writer.prototype.text = function (p, h, s, layer, anchor, rot) {
    const hj = anchor === 'middle' ? 1 : anchor === 'end' ? 2 : 0;
    this.p(0, 'TEXT', 8, layer, 10, num(p[0]), 20, num(p[1]), 30, 0, 40, num(h), 1, enc(s));
    if (rot) this.p(50, num(rot));
    this.p(72, hj, 11, num(p[0]), 21, num(p[1]), 31, 0, 73, 2);
    this.grow(p[0], p[1]);
  };

  /* Écrit une scène décalée de (dx, dy). */
  function writeScene(w, sc, dx, dy) {
    const T = (q) => [q[0] + dx, q[1] + dy];
    for (const it of sc.items) {
      if (it.t === 'poly') {
        const lt = it.dash ? 'DASHED' : null;
        w.poly(it.pts.map(T), it.layer, !!it.closed, lt);
        (it.holes || []).forEach((h) => w.poly(h.map(T), it.layer, true));
      } else if (it.t === 'bar') {
        w.bar(it.path.map((v) => ({ p: T(v.p), b: v.b })), it.wM, it.layer);
      } else if (it.t === 'circle') {
        if (it.layer === 'ACIERS' && it.fill) w.dot(T(it.c), it.r, it.layer);
        else w.circle(T(it.c), it.r, it.layer);
      } else if (it.t === 'text') {
        w.text(T(it.p), it.h * sc.u, it.s, it.layer, it.anchor, it.rot);
      }
    }
  }

  const fmt = (v, n) => (v == null || isNaN(v) ? '' : Number(v).toFixed(n));

  /* Nomenclature + récapitulatif dessinés (calque NOMENC). */
  function writeTable(w, rows, rec, x0, y0, title) {
    const L = 'NOMENC', th = 0.04;
    const cols = [
      ['N°', 0.16], ['Type', 0.16], ['Ø', 0.14], ['Nb/élém.', 0.34], ['Nb élém.', 0.26], ['Total', 0.2],
      ['Esp.', 0.22], ['L unit. (m)', 0.3], ['Façonnage', 0.84], ['Mandrin (cm)', 0.34], ['L tot. (m)', 0.3], ['Masse (kg)', 0.3],
    ];
    const W = cols.reduce((s, c) => s + c[1], 0), hh = 0.12, rh = 0.28;
    w.text([x0, y0 + 0.12], 0.07, title, L, 'start');
    const H = hh + rows.length * rh;
    w.poly([[x0, y0], [x0 + W, y0], [x0 + W, y0 - H], [x0, y0 - H]], L, true);
    let x = x0;
    cols.forEach((c, i) => {
      if (i) w.line([x, y0], [x, y0 - H], L);
      w.text([x + c[1] / 2, y0 - hh / 2], th * 0.9, c[0], L, 'middle');
      x += c[1];
    });
    w.line([x0, y0 - hh], [x0 + W, y0 - hh], L);
    rows.forEach((r, k) => {
      const yt = y0 - hh - k * rh, yc = yt - rh / 2;
      if (k) w.line([x0, yt], [x0 + W, yt], L);
      const esp = r.kind === 'densite' ? r.esp + '/m²' : fmt(r.esp, 2);
      const vals = [r.id, r.type, r.d, r.n + (r.mult > 1 ? '×' + r.mult : '') + (r.mult > 1 ? ' = ' + r.parElem : ''), r.nbElem, r.total, esp,
        fmt(r.L, 3), null, fmt(r.D * 100, 1), fmt(r.Ltot, 2), fmt(r.masse, 1)];
      let cx = x0;
      cols.forEach((c, i) => {
        if (i === 8) {
          const gm = F.croquisGeom(r.shape, 150, 48), uc = c[1] / 150;
          const P = (q) => [cx + q[0] * uc, yt - 0.01 - q[1] * uc];
          w.bar(gm.path.map((v) => ({ p: P(v.p), b: -v.b })), 0, 'ACIERS');
          gm.texts.forEach((t) => w.text(P([t.x, t.y]), 9.5 * uc, t.s, L, t.anchor));
          if (r.code) w.text([cx + 0.02, yc - 0.1], th * 0.75, 'code ' + r.code, L, 'start');
        } else {
          w.text([cx + c[1] / 2, yc], th, String(vals[i]), L, 'middle');
        }
        cx += c[1];
      });
    });
    // récapitulatif par diamètre
    const ry = y0 - H - 0.3, rc = [['Ø', 0.3], ['kg/m', 0.34], ['Longueur (m)', 0.44], ['Masse (kg)', 0.4]];
    const RW = rc.reduce((s, c) => s + c[1], 0), rrh = 0.1;
    w.text([x0, ry + 0.1], 0.06, 'RÉCAPITULATIF PAR DIAMÈTRE', L, 'start');
    const lines = rec.lignes.concat([{ d: 'TOTAL', ml: null, longueur: rec.longueur, masse: rec.total }]);
    const RH = rrh * (lines.length + 1);
    w.poly([[x0, ry], [x0 + RW, ry], [x0 + RW, ry - RH], [x0, ry - RH]], L, true);
    let xx = x0;
    rc.forEach((c, i) => { if (i) w.line([xx, ry], [xx, ry - RH], L); w.text([xx + c[1] / 2, ry - rrh / 2], th * 0.9, c[0], L, 'middle'); xx += c[1]; });
    lines.forEach((ln, k) => {
      const yt = ry - rrh * (k + 1);
      w.line([x0, yt], [x0 + RW, yt], L);
      const v = [ln.d === 'TOTAL' ? 'TOTAL' : 'HA' + ln.d, ln.ml == null ? '' : ln.ml.toFixed(3), ln.longueur ? ln.longueur.toFixed(2) : '—', ln.masse ? ln.masse.toFixed(1) : '—'];
      let cx = x0;
      rc.forEach((c, i) => { w.text([cx + c[1] / 2, yt - rrh / 2], th, v[i], L, 'middle'); cx += c[1]; });
    });
    return ry - RH;
  }

  /* Construit le fichier DXF complet. meta : {titre, structureLabel, norme…} */
  function buildDXF(struct, g, res, meta) {
    meta = meta || {};
    const w = new Writer();
    const sA = F.coffrageScene(struct, g, U), bA = F.bounds(sA);
    const sB = F.ferraillageScene(struct, g, res.bars, res.params, U), bB = F.bounds(sB);
    const sC = F.secondScene(struct, g, U), bC = F.bounds(sC);
    // coupe de coffrage à l'origine
    writeScene(w, sA, 0, 0);
    const top = Math.max(bA[3], bB[3]) + 0.25;
    w.text([(bA[0] + bA[2]) / 2, top], 0.07, 'COUPE TRANSVERSALE — COFFRAGE', 'KLE-Cotation', 'middle');
    // coupe ferraillée à droite
    const dxB = bA[2] - bB[0] + 1.0;
    writeScene(w, sB, dxB, 0);
    w.text([(bB[0] + bB[2]) / 2 + dxB, top], 0.07, 'COUPE TRANSVERSALE — FERRAILLAGE', 'KLE-Cotation', 'middle');
    // coupe longitudinale A-A de la semelle sous la coupe transversale ferraillée (mur)
    const sL = F.longiScene ? F.longiScene(struct, g, res.bars, res.params, U) : null;
    let yLow = Math.min(bA[1], bB[1]);
    if (sL) {
      const bL = F.bounds(sL), dyL = bB[1] - bL[3] - 0.7, dxL = dxB + (bB[0] + bB[2]) / 2 - (bL[0] + bL[2]) / 2;
      writeScene(w, sL, dxL, dyL);
      w.text([(bL[0] + bL[2]) / 2 + dxL, bL[3] + dyL + 0.2], 0.07, 'COUPE LONGITUDINALE A-A \u2014 SEMELLE (FERRAILLAGE)', 'KLE-Cotation', 'middle');
      yLow = Math.min(yLow, bL[1] + dyL);
    }
    // seconde vue sous la coupe de coffrage
    const dyC = Math.min(bA[1], bB[1]) - bC[3] - 0.6, dxC = bA[0] - bC[0];
    writeScene(w, sC, dxC, dyC);
    w.text([bC[0] + dxC, bC[3] + dyC + 0.12], 0.07, struct === 'dalot' ? 'VUE EN PLAN' : 'ÉLÉVATION DU BLOC', 'KLE-Cotation', 'start');
    // nomenclature à droite
    const xT = bB[2] + dxB + 1.0;
    const yEnd = writeTable(w, res.rows, res.recap, xT, top, 'NOMENCLATURE DES ACIERS — ' + (meta.structureLabel || struct));
    const p = res.params;
    const notes = [
      (meta.titre || 'BridgeAI Studios — Plans coffrage & ferraillage') + ' — unité : mètre',
      'Norme ' + p.norme + ' — enrobages ' + Math.round(p.cTerre * 100) + ' cm (terre / fondation), ' + Math.round(p.cAutre * 100) + ' cm (autres parements)',
      'Longueur maxi ' + p.lmax + ' m — recouvrement ' + p.recouv + 'Ø — masse totale ' + res.recap.total.toFixed(1) + ' kg',
      'Ferraillage proposé à titre indicatif : à justifier par une note de calcul.',
    ];
    notes.forEach((t, i) => w.text([xT, yEnd - 0.25 - i * 0.09], 0.05, t, 'NOMENC', 'start'));

    const e = w.ext;
    const H = [];
    const hp = function () { for (let i = 0; i < arguments.length; i += 2) H.push(String(arguments[i]), String(arguments[i + 1])); };
    hp(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$DWGCODEPAGE', 3, 'ANSI_1252',
      9, '$INSBASE', 10, 0, 20, 0, 30, 0,
      9, '$EXTMIN', 10, num(e[0]), 20, num(e[1]), 30, 0, 9, '$EXTMAX', 10, num(e[2]), 20, num(e[3]), 30, 0,
      9, '$LIMMIN', 10, num(e[0]), 20, num(e[1]), 9, '$LIMMAX', 10, num(e[2]), 20, num(e[3]),
      9, '$LTSCALE', 40, 1, 9, '$TEXTSTYLE', 7, 'STANDARD', 9, '$CLAYER', 8, 'KLE-Contour', 0, 'ENDSEC');
    hp(0, 'SECTION', 2, 'TABLES');
    hp(0, 'TABLE', 2, 'LTYPE', 70, 2,
      0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, '0.0',
      0, 'LTYPE', 2, 'DASHED', 70, 0, 3, '__ __ __', 72, 65, 73, 2, 40, '0.075', 49, '0.05', 49, '-0.025',
      0, 'ENDTAB');
    hp(0, 'TABLE', 2, 'LAYER', 70, LAYERS.length + 1, 0, 'LAYER', 2, '0', 70, 0, 62, 7, 6, 'CONTINUOUS');
    LAYERS.forEach(([n, c]) => hp(0, 'LAYER', 2, n, 70, 0, 62, c, 6, 'CONTINUOUS'));
    hp(0, 'ENDTAB');
    hp(0, 'TABLE', 2, 'STYLE', 70, 1, 0, 'STYLE', 2, 'STANDARD', 70, 0, 40, '0.0', 41, '1.0', 50, '0.0', 71, 0, 42, '0.2', 3, 'txt', 4, '', 0, 'ENDTAB');
    hp(0, 'ENDSEC', 0, 'SECTION', 2, 'BLOCKS', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
    const all = H.concat(w.o, ['0', 'ENDSEC', '0', 'EOF']);
    return all.join('\r\n') + '\r\n';
  }

  return { buildDXF, DXF_LAYERS: LAYERS.map((l) => l[0]) };
});
