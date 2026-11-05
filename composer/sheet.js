/* BridgeAI Studios — Bridge Composer : PLAN D'ENSEMBLE (feuille A1 paysage, 841 × 594 mm)
 * Assemble sur une même feuille, à la manière des plans d'ensemble de bureau d'études :
 *   coupe longitudinale (avec profil en long / guitare et sondages), vue en plan, coupe transversale,
 *   et une réserve A4 (verticale ou horizontale) laissée vide pour le cartouche de l'utilisateur.
 * Chaque vue est une scène de draw.js rendue par toSVG puis imbriquée (<svg> enfant) dans son cadre. */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? Object.assign({}, require('./calc.js'), require('./draw.js')) : root.COMP;
  const api = factory(C);
  if (isNode) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const fr = C.fr, esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const SW = 841, SH = 594;
  /* cadres (mm) : vues + réserve A4 pour le cartouche de l'utilisateur, verticale (210 × 297) ou horizontale (297 × 210) */
  const LAYOUTS = {
    v: { long: [14, 14, 597, 300], plan: [14, 318, 597, 262], sec: [617, 14, 210, 263], cart: [617, 283, 210, 297] },
    h: { long: [14, 14, 510, 300], plan: [14, 318, 510, 262], sec: [530, 14, 297, 350], cart: [530, 370, 297, 210] },
  };
  const Z = LAYOUTS.v;

  function embed(sc, box, id, opt) {
    const [x, y, w, h] = box;
    const pad = 3, tb = 0;
    const svg = C.toSVG(sc, { width: (w - 2 * pad) * 4, kp: 5, pad: 6, id, dims: opt.dims !== false });
    return svg.replace(/^<svg[^>]*viewBox="([^"]+)"[^>]*>/, (m, vb) => `<svg x="${x + pad}" y="${y + pad + tb}" width="${w - 2 * pad}" height="${h - 2 * pad - tb}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" overflow="hidden">`);
  }
  const T = (x, y, s, o) => {
    o = o || {};
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.fs || 3}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.b ? ' font-weight="700"' : ''}${o.i ? ' font-style="italic"' : ''}${o.c ? ` fill="${o.c}"` : ''}${o.tag ? ` data-tag="${o.tag}"` : ''}>${esc(s)}</text>`;
  };
  const R = (x, y, w, h, st) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" style="${st || 'fill:none;stroke:#1e1e1e;stroke-width:.35'}"/>`;
  /* réserve A4 : cadre vide, ou le cartouche importé par l'utilisateur (image SVG/PNG/JPG) */
  function reserveA4(box, img) {
    const [x, y, w, h] = box;
    let s = R(x, y, w, h, 'fill:#fff;stroke:#1e1e1e;stroke-width:.6');
    if (img && /^data:image\/(svg\+xml|png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(img)) s += `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${img}"/>`;
    return s;
  }

  /* opt : { dims } — la disposition (cartouche vertical ou horizontal) vient de M.S.cartouche */
  function sheetSVG(M, opt) {
    opt = opt || {};
    const ct = (M.S && M.S.cartouche) || {}, Zl = LAYOUTS[ct.orient === 'h' ? 'h' : 'v'];
    const eL = C.elevScene(M), eP = C.planScene(M), eS = C.secScene(M);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW * 2}" height="${SH * 2}" role="img" class="sheet">`
      + `<style>.sheet text{font-family:'Arial Narrow','Segoe UI',Arial,sans-serif;fill:#14171f}</style>`
      + `<rect x="0" y="0" width="${SW}" height="${SH}" style="fill:#fff;stroke:none"/>`
      + R(8, 8, SW - 16, SH - 16, 'fill:none;stroke:#1e1e1e;stroke-width:.8');
    const frame = (b) => R(b[0], b[1], b[2], b[3], 'fill:none;stroke:#c9ced8;stroke-width:.3');
    s += frame(Zl.long) + embed(eL, Zl.long, 'pl', opt);
    s += frame(Zl.plan) + embed(eP, Zl.plan, 'pp', opt);
    s += frame(Zl.sec) + embed(eS, Zl.sec, 'ps', opt);
    s += reserveA4(Zl.cart, ct.img);
    s += T(SW - 12, SH - 3, 'Échelles : coupe longitudinale 1/' + eL.ech + ' · vue en plan 1/' + eP.ech + ' · coupe transversale 1/' + eS.ech + ' — format A1', { fs: 2.2, a: 'end', c: '#555' });
    return s + '</svg>';
  }

  return { sheetSVG, SHEET: { W: SW, H: SH, Z, LAYOUTS } };
});
