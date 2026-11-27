/* BridgeAI Studios — Bridge Composer : PLAN D'ENSEMBLE (feuille A0 paysage, 1189 × 841 mm, cartouche A4)
 * La feuille est l'interface : chaque vue est dessinée à une échelle normalisée (la plus grande qui tient dans son cadre)
 * et porte un repère (data-tag) qui ouvre l'éditeur correspondant.
 *   Élévation (coupe longitudinale, guitare, sondages) · Vue en plan · Coupe courante du tablier ·
 *   Coupe du tablier sur pile · Coupe du tablier sur culée · NOTA · Cartouche A4 (dessiné, ou image importée).
 * Rendu : scènes de draw.js en mètres → toSVG à l'échelle fixe K px/mm, imbriquées dans la feuille en mm. */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? Object.assign({}, require('./calc.js'), require('./draw.js')) : root.COMP;
  const api = factory(C);
  if (isNode) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const fr = C.fr, esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const SW = 1189, SH = 841, K = 4;                      // feuille A0 ; K px de dessin par mm de papier
  const FX0 = 20, FY0 = 10, FX1 = SW - 10, FY1 = SH - 10; // cadre (marge de reliure à gauche)
  const GAP = 4;
  const ECH = {
    // élévation et vue en plan : la plus grande échelle qui tient, plafonnée à 1/50
    long: [50, 60, 75, 80, 100, 120, 125, 150, 175, 200, 250, 300, 400, 500, 600, 750, 1000, 1250, 1500, 2000, 2500, 5000],
    sec: [20, 25, 30, 40, 50],   // coupes transversales : jamais en dessous de 1/50
  };

  /* cadres (mm) selon l'orientation du cartouche A4 */
  function layout(orient) {
    const cw = orient === 'h' ? 297 : 210, chh = orient === 'h' ? 210 : 297;
    const xr = FX1 - cw, cart = [xr, FY1 - chh, cw, chh];
    const mw = xr - GAP - FX0;                              // largeur de la zone principale
    const yS = FY0 + 0.68 * (FY1 - FY0);                    // bas des vues longitudinales
    const long = [FX0, FY0, mw, 0.43 * (FY1 - FY0)];
    const plan = [FX0, long[1] + long[3] + GAP, mw, yS - (long[1] + long[3] + GAP)];
    const hs = FY1 - yS - GAP, ws = (mw - GAP) / 2;
    return {
      long, plan,
      secT: [FX0, yS + GAP, ws, hs],
      secP: [FX0 + ws + GAP, yS + GAP, ws, hs],
      secC: [xr, FY0, cw, 0],                               // hauteur fixée selon le NOTA
      cart,
    };
  }

  /* dessine une scène à la plus grande échelle normalisée qui tient dans le cadre */
  function place(make, box, scales, id, opt, tag) {
    const [bx, by, bw, bh] = box;
    let best = null;
    for (const e of scales) {
      const sc = make(e);
      const svg = C.toSVG(sc, { scale: K * 1000 / e, kp: K, pad: 2 * K, id, dims: opt.dims !== false });
      const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
      best = { svg, vb, e };
      if (vb[2] / K <= bw - 2 && vb[3] / K <= bh - 2) break;
    }
    const wmm = best.vb[2] / K, hmm = best.vb[3] / K, fit = wmm <= bw && hmm <= bh;
    const w = fit ? wmm : bw, h = fit ? hmm : bh;
    const x = bx + (bw - w) / 2, y = by + (bh - h) / 2;
    const svg = best.svg.replace(/^<svg[^>]*>/, `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" viewBox="${best.vb.join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="visible" class="zone" data-tag="${tag}"><rect x="${best.vb[0]}" y="${best.vb[1]}" width="${best.vb[2]}" height="${best.vb[3]}" style="fill:transparent;stroke:none"/>`);
    return { svg, ech: best.e };
  }

  /* élévation et vue en plan : même échelle, abscisses alignées (axe de C0 sur la même verticale) */
  function placePair(mk1, box1, mk2, box2, scales, opt) {
    const bx = box1[0], bw = Math.min(box1[2], box2[2]), Y0 = box1[1], Htot = box2[1] + box2[3] - box1[1];
    let r = null;
    for (const e of scales) {
      const R2 = [[mk1(e), box1, 'zl', 'travees'], [mk2(e), box2, 'zp', 'trace']].map(([sc, box, id, tag]) => {
        const svg = C.toSVG(sc, { scale: K * 1000 / e, kp: K, pad: 2 * K, id, dims: opt.dims !== false });
        const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number), ox = +(svg.match(/data-ox="([^"]+)"/) || [0, 0])[1];
        return { svg, vb, off: (ox - vb[0]) / K, w: vb[2] / K, h: vb[3] / K, box, tag };
      });
      const A = Math.max(R2[0].off, R2[1].off), U = Math.max(...R2.map((q) => A - q.off + q.w));
      r = { R2, A, U, e };
      // les deux vues se partagent la hauteur disponible selon leurs besoins
      if (U <= bw - 2 && R2[0].h + R2[1].h + GAP <= Htot - 2) break;
    }
    const k = Math.min(1, r.U > bw ? bw / r.U : 1, (Htot - GAP) / (r.R2[0].h + r.R2[1].h)), X0 = bx + (bw - r.U * k) / 2;
    const slack = Math.max(0, Htot - GAP - (r.R2[0].h + r.R2[1].h) * k) / 3;
    let yc = Y0 + slack;
    const out = r.R2.map((q) => {
      const w = q.w * k, h = q.h * k, x = X0 + (r.A - q.off) * k, y = yc; yc += h + GAP + slack;
      return q.svg.replace(/^<svg[^>]*>/, `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" viewBox="${q.vb.join(' ')}" preserveAspectRatio="xMidYMid meet" overflow="visible" class="zone" data-tag="${q.tag}"><rect x="${q.vb[0]}" y="${q.vb[1]}" width="${q.vb[2]}" height="${q.vb[3]}" style="fill:transparent;stroke:none"/>`);
    }).join('');
    return { svg: out, ech: r.e };
  }

  const T = (x, y, s, o) => {
    o = o || {};
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.fs || 3}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.b ? ' font-weight="700"' : ''}${o.i ? ' font-style="italic"' : ''}${o.c ? ` fill="${o.c}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.tag ? ` data-tag="${o.tag}"` : ''}>${esc(s)}</text>`;
  };
  const R = (x, y, w, h, st) => `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" style="${st || 'fill:none;stroke:#1e1e1e;stroke-width:.35'}"/>`;
  const L = (x1, y1, x2, y2, w) => `<path d="M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}" style="stroke:#1e1e1e;stroke-width:${w || 0.3}"/>`;
  const fit = (s, w, fs) => { s = String(s || ''); const n = Math.floor(w / (fs * 0.52)); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };
  function wrap(str, w, fs) {
    const n = Math.max(8, Math.floor(w / (fs * 0.5))), out = [];
    String(str).split(/\s+/).forEach((wd) => { const l = out.length ? out[out.length - 1] + ' ' + wd : wd; if (out.length && l.length <= n) out[out.length - 1] = l; else out.push(wd); });
    return out;
  }

  /* NOTA : points saisis par l'utilisateur, numérotés */
  function notaBlock(txt, x, w, fs) {
    const pts = String(txt || '').split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (!pts.length) return null;
    const lines = [];
    pts.forEach((p, i) => wrap(p.replace(/^\d+[.)-]\s*/, ''), w - 16, fs).forEach((l, k) => lines.push([k ? '' : (i + 1) + '.', l])));
    const lh = fs * 1.45, h = 14 + lines.length * lh + 4;
    return { h, draw: (y) => {
      let s = `<g data-tag="nota">` + R(x, y, w, h, 'fill:#fff;stroke:none') + T(x + 5, y + 8, 'NOTA', { fs: 4.5, b: true, ls: '.06em' }) + `<path d="M${x + 5} ${y + 9.4}h${(4.5 * 2.6).toFixed(1)}" style="stroke:#14171f;stroke-width:.4"/>`;
      lines.forEach(([n, l], k) => { const yy = y + 15.5 + k * lh; if (n) s += T(x + 5, yy, n, { fs }); s += T(x + 11, yy, l, { fs }); });
      return s + '</g>';
    } };
  }

  /* cartouche A4 dessiné d'après les champs du projet */
  /* cartouche A4 laissé vierge (à compléter par le bureau d'études) : seul le titre du plan au milieu */
  function cartouche(M, box) {
    const [x, y, w, h] = box;
    return `<g data-tag="projet">` + R(x, y, w, h, 'fill:#fff;stroke:#1e1e1e;stroke-width:.7')
      + T(x + w / 2, y + h / 2 + 4, 'PLAN D’ENSEMBLE', { fs: 11, a: 'middle', b: true, ls: '.04em' }) + '</g>';
  }

  function reserveA4(box, img) {
    const [x, y, w, h] = box;
    return `<g data-tag="projet">` + R(x, y, w, h, 'fill:#fff;stroke:#1e1e1e;stroke-width:.7') + `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${img}"/></g>`;
  }
  const okImg = (img) => img && /^data:image\/(svg\+xml|png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(img);

  /* cartouche A4 vertical, vierge : titre du plan et numéro de planche au milieu */
  function cartoucheA4(box, k, n) {
    const [x, y, w, h] = box;
    return `<g data-tag="projet">` + R(x, y, w, h, 'fill:#fff;stroke:#1e1e1e;stroke-width:.7')
      + T(x + w / 2, y + h / 2, 'PLAN D’ENSEMBLE', { fs: 11, a: 'middle', ls: '.04em' })
      + (n > 1 ? T(x + w / 2, y + h / 2 + 12, 'PLANCHE ' + k + ' / ' + n, { fs: 7, a: 'middle', ls: '.06em' }) : '') + '</g>';
  }

  /* PLAN D'ENSEMBLE — disposition des plans KLE (PRO2334), cartouche A4 vertical en bas à droite, NOTA au-dessus :
   *   planche 1 : coupe longitudinale en tête ; coupes types du tablier en travée et sur piles (1/50) ; coupes types des poutres (1/20) ;
   *               coupes types sur culées à droite si la place le permet ;
   *   planche 2 (si besoin) : coupes types du tablier sur les culées. */
  function plan(M, opt) {
    opt = opt || {};
    const S = M.S;
    const piles = M.supports.filter((x) => x.kind === 'pile'), cul = M.supports.filter((x) => x.kind === 'culee');
    const pid = piles.length ? piles.map((p) => [p, piles.filter((q) => Math.abs(q.H - p.H) < 0.01).length]).sort((a, b) => b[1] - a[1] || b[0].H - a[0].H)[0][0].id : null;
    const size = (mk, id, e) => { const sc = mk(e); if (!sc) return [0, 0]; const svg = C.toSVG(sc, { scale: K * 1000 / e, kp: K, pad: 2 * K, id, dims: opt.dims !== false }); const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number); return [vb[2] / K, vb[3] / K]; };
    const c0 = cul[0], c1 = cul[cul.length - 1];
    const ttl = (sp) => sp ? 'COUPE TYPE DU TABLIER SUR ' + (sp.kind === 'pile' ? 'PILES' : 'CULEE ' + sp.id) : '';
    const L = [['zt', (e) => C.secScene(M, { ech: e, part: 'tablier', titre: 'COUPE TYPE DU TABLIER EN TRAVEE' }), 'tablier'],
      pid ? ['zs', (e) => C.secScene(M, { ech: e, part: 'pile', id: pid, titre: ttl(piles[0]) }), pid] : null].filter(Boolean);
    const Rr = [c0 && ['zc0', (e) => C.secScene(M, { ech: e, part: 'culee', id: c0.id, titre: ttl(c0) }), c0.id],
      c1 && c1 !== c0 && ['zc1', (e) => C.secScene(M, { ech: e, part: 'culee', id: c1.id, titre: ttl(c1) }), c1.id]].filter(Boolean);
    const hasB = !!(C.poutreScene && C.poutreScene(M, {}));
    const Mid = hasB ? [['zb1', (e) => C.poutreScene(M, { ech: e, where: 'appui' }), 'section'], ['zb2', (e) => C.poutreScene(M, { ech: e, where: 'travee' }), 'section']] : [];
    const cart = [FX1 - 210, FY1 - 297, 210, 297], mw = cart[0] - GAP - FX0;
    const sL = L.map(([id, mk]) => size(mk, id, 50)), sR = Rr.map(([id, mk]) => size(mk, id, 50)), sM = Mid.map(([id, mk]) => size(mk, id, 20));
    const wLn = Math.max(0, ...sL.map((q) => q[0])), wRn = Math.max(0, ...sR.map((q) => q[0])), wMn = Math.max(0, ...sM.map((q) => q[0]));
    const hL = sL.reduce((a, q) => a + q[1] + GAP, 0), hR = sR.reduce((a, q) => a + q[1] + GAP, 0);
    const hLongMin = 0.17 * (FY1 - FY0);
    const one = wLn + wRn + wMn + 3 * GAP <= mw && Math.max(hL, hR) <= FY1 - FY0 - hLongMin - GAP;
    return { L, Rr, Mid, cart, mw, one, n: one || !Rr.length ? 1 : 2, size, hL, hR };
  }
  function sheetCount(M) { return plan(M, {}).n; }

  function sheetSVG(M, opt) {
    opt = opt || {};
    const S = M.S, ct = S.cartouche || {}, P_ = plan(M, opt), n = P_.n, k = Math.min(n, Math.max(1, opt.planche || 1));
    const { L, Rr, Mid, cart, mw, size } = P_;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW}mm" height="${SH}mm" role="img" class="sheet">`
      + `<style>.sheet text{font-family:'Arial Narrow','Segoe UI',Arial,sans-serif;fill:#14171f}</style>`
      + `<rect x="0" y="0" width="${SW}" height="${SH}" style="fill:#fff;stroke:none"/>`
      + R(FX0, FY0, FX1 - FX0, FY1 - FY0, 'fill:none;stroke:#1e1e1e;stroke-width:1');
    // NOTA au-dessus du cartouche, dans son cadre
    const top = cart[1] - GAP, nb = notaBlock(S.nota, cart[0], cart[2], 3);
    const nh = nb ? Math.min(nb.h, top - FY0) : 0;
    if (nb) s += `<clipPath id="nclip"><rect x="${cart[0]}" y="${top - nh}" width="${cart[2]}" height="${nh}"/></clipPath><g clip-path="url(#nclip)">${nb.draw(top - nh)}</g>` + R(cart[0], top - nh, cart[2], nh, 'fill:none;stroke:#1e1e1e;stroke-width:.5');
    s += okImg(ct.img) ? reserveA4(cart, ct.img) : cartoucheA4(cart, k, n);
    // mise en page : les blocs sont calculés à leur échelle, puis centrés entre le cadre et le cartouche, espaces répartis
    const X0 = FX0 + 4, X1 = cart[0] - GAP - 4, Y0 = FY0 + 4, Y1 = FY1 - 4, AW = X1 - X0, AH = Y1 - Y0;
    const put = (mk, id, tag, e, x, y, w, h) => { s += place(mk, [x, y, w, h], [e], id, opt, tag).svg; };
    const colSize = (arr, e) => { const q = arr.map(([id, mk]) => size(mk, id, e)); return [Math.max(0, ...q.map((v) => v[0])), q.reduce((a, v) => a + v[1], 0) + GAP * Math.max(0, arr.length - 1), q]; };
    const drawCol = (arr, e, x, w, y, h) => {   // pile verticale centrée dans [x, x+w] × [y, y+h], espaces égaux
      const q = arr.map(([id, mk]) => size(mk, id, e)), tot = q.reduce((a, v) => a + v[1], 0), g = Math.max(GAP, (h - tot) / (arr.length + 1));
      let yy = y + Math.max(0, (h - tot - g * (arr.length - 1)) / 2);
      arr.forEach(([id, mk, tag], k_) => { put(mk, id, tag, e, x, yy, w, q[k_][1]); yy += q[k_][1] + g; });
    };
    if (k === 1) {
      const cols = [[L, ECH.sec], [Mid, [20, 25, 30, 40, 50]]].concat(P_.one ? [[Rr, ECH.sec]] : []).filter((c) => c[0].length);
      // échelles des coupes : la plus grande qui tient en largeur, puis en hauteur avec la coupe longitudinale au minimum
      const longH = (e) => size((e_) => C.elevScene(M, { ech: e_ }), 'zl', e);
      const eLong = ECH.long.find((e) => { const [w, h] = longH(e); return w <= AW && h <= 0.36 * AH; }) || ECH.long[ECH.long.length - 1];
      const [wLo, hLo] = longH(eLong);
      const choose = () => {
        for (const eS of ECH.sec) for (const eB of [20, 25, 30, 40, 50]) {
          const sz = cols.map(([arr, sc]) => colSize(arr, sc === ECH.sec ? eS : eB));
          const w = sz.reduce((a, v) => a + v[0], 0) + 3 * GAP * (sz.length - 1), h = Math.max(...sz.map((v) => v[1]));
          if (w <= AW && h + hLo + 3 * GAP <= AH) return { eS, eB, sz, w, h };
        }
        const sz = cols.map(([arr, sc]) => colSize(arr, sc === ECH.sec ? 50 : 50));
        return { eS: 50, eB: 50, sz, w: sz.reduce((a, v) => a + v[0], 0) + 3 * GAP * (sz.length - 1), h: Math.max(...sz.map((v) => v[1])) };
      };
      const ch = choose(), free = Math.max(0, AH - hLo - ch.h), gv = free / 3;
      put((e) => C.elevScene(M, { ech: e }), 'zl', 'travees', eLong, X0 + (AW - wLo) / 2, Y0 + gv, wLo, hLo);
      const yR = Y0 + gv + hLo + gv, gh = cols.length > 1 ? Math.max(3 * GAP, (AW - ch.sz.reduce((a, v) => a + v[0], 0)) / (cols.length + 1)) : 0;
      let x = X0 + (AW - ch.sz.reduce((a, v) => a + v[0], 0) - gh * (cols.length - 1)) / 2;
      cols.forEach(([arr, sc], q) => { drawCol(arr, sc === ECH.sec ? ch.eS : ch.eB, x, ch.sz[q][0], yR, ch.h); x += ch.sz[q][0] + gh; });
    } else {
      // planche 2 : coupes sur culées, centrées
      const eS = ECH.sec.find((e) => { const q = Rr.map(([id, mk]) => size(mk, id, e)); return q.reduce((a, v) => a + v[0], 0) + 4 * GAP <= AW && Math.max(...q.map((v) => v[1])) <= AH; });
      if (eS) {
        const q = Rr.map(([id, mk]) => size(mk, id, eS)), tw = q.reduce((a, v) => a + v[0], 0), g = (AW - tw) / (Rr.length + 1);
        const hM = Math.max(...q.map((v) => v[1])), yT = Y0 + (AH - hM) / 2;   // titres alignés
        let x = X0 + g; Rr.forEach(([id, mk, tag], k_) => { put(mk, id, tag, eS, x, yT, q[k_][0], q[k_][1]); x += q[k_][0] + g; });
      } else { const [w] = colSize(Rr, 50); drawCol(Rr, 50, X0 + (AW - w) / 2, w, Y0, AH); }
    }
    return s + '</svg>';
  }

  return { sheetSVG, sheetCount, SHEET: { W: SW, H: SH, layout } };
});
