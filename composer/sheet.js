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
    sec: [20, 25, 30, 40, 50, 60, 75, 80, 100, 125, 150, 200, 250, 500],
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
  function cartouche(M, box, ech, orient) {
    const p = M.S.projet || {}, x = box[0], w = box[2];
    let y = box[1], h = box[3];
    let s = R(x, y, w, h, 'fill:#fff;stroke:#1e1e1e;stroke-width:.7');
    s += `<g data-tag="projet">`;
    const lab = (xx, yy, t) => T(xx + 3, yy + 5, t.toUpperCase(), { fs: 2.3, c: '#555', ls: '.05em' });
    const cell = (xx, yy, ww, hh, title, lines) => {
      let o = R(xx, yy, ww, hh, 'fill:none;stroke:#1e1e1e;stroke-width:.35') + lab(xx, yy, title);
      lines.forEach((ln, k) => { o += T(xx + (ln.c ? ww / 2 : 3), yy + 12 + k * (ln.fs || 4) * 1.35, fit(ln.t, ww - 6, ln.fs || 4), { fs: ln.fs || 4, b: ln.b, a: ln.c ? 'middle' : null, i: ln.i }); });
      return o;
    };
    const today = p.date || new Date().toLocaleDateString('fr-FR');
    const echTxt = [...new Set(ech)].sort((a, b) => a - b).map((e) => '1/' + e).join(' · ');
    const titre = (xx, yy, ww, hh) => {
      let o = R(xx, yy, ww, hh, 'fill:#f6f7f9;stroke:#1e1e1e;stroke-width:.5');
      o += T(xx + ww / 2, yy + 9, (p.phase || 'Avant-projet').toUpperCase(), { fs: 4.2, a: 'middle', b: true, ls: '.06em' });
      o += T(xx + ww / 2, yy + hh / 2 + 6, 'PLAN D’ENSEMBLE', { fs: 9, a: 'middle', b: true, ls: '.04em' });
      o += T(xx + ww / 2, yy + hh - 6, fit(p.ouvrage || '', ww - 8, 4), { fs: 4, a: 'middle' });
      return o;
    };
    const infos = (xx, yy, ww, hh) => {
      const c = [0.36, 0.18, 0.28, 0.18], lb = ['Échelles', 'Format', 'N° de plan', 'Indice'], v = [echTxt, 'A0', p.ref || '—', p.indice || '00'];
      let o = '', cx = xx;
      c.forEach((f, k) => { const cw = ww * f; o += R(cx, yy, cw, hh, 'fill:none;stroke:#1e1e1e;stroke-width:.35') + lab(cx, yy, lb[k]) + T(cx + cw / 2, yy + hh - 5, fit(v[k], cw - 4, k === 0 ? 3.2 : 4.2), { fs: k === 0 ? 3.2 : 4.2, a: 'middle', b: k > 0 }); cx += cw; });
      return o;
    };
    const indices = (xx, yy, ww, hh) => {
      const c = [0.09, 0.15, 0.37, 0.13, 0.13, 0.13], hd = ['Ind.', 'Date', 'Modification', 'Dessiné', 'Vérifié', 'Validé'];
      const rows = [[p.indice || '00', today, p.modif || 'Première émission', p.dessine || '', p.verifie || '', p.valide || '']];
      const rh = 7, nRows = Math.max(1, Math.floor((hh - rh) / rh));
      let o = R(xx, yy, ww, hh, 'fill:none;stroke:#1e1e1e;stroke-width:.35'), cx = xx;
      c.forEach((f, k) => { const cw = ww * f; if (k) o += L(cx, yy, cx, yy + hh, 0.25); o += T(cx + 2, yy + hh - 2.2, hd[k], { fs: 2.4, c: '#555' }); cx += cw; });
      o += L(xx, yy + hh - rh, xx + ww, yy + hh - rh, 0.3);
      for (let r = 1; r < nRows; r++) o += L(xx, yy + hh - rh - r * rh, xx + ww, yy + hh - rh - r * rh, 0.15);
      rows.forEach((rw, r) => { let ccx = xx; c.forEach((f, k) => { const cw = ww * f; o += T(ccx + 2, yy + hh - rh - r * rh - 2.2, fit(rw[k], cw - 3, 2.8), { fs: 2.8, b: k === 0 }); ccx += cw; }); });
      return o;
    };
    if (orient !== 'h') {
      let yy = y;
      const blk = (hh, f) => { s += f(x, yy, w, hh); yy += hh; };
      blk(34, (a, b, c, d) => cell(a, b, c, d, 'Maître d’ouvrage', [{ t: p.moa || '—', b: true, fs: 4.6 }, { t: p.lieu || '', fs: 3.4 }]));
      blk(40, (a, b, c, d) => cell(a, b, c, d, 'Projet', wrap(p.nom || 'Ouvrage', c - 8, 4.6).slice(0, 3).map((t) => ({ t, b: true, fs: 4.6 }))));
      blk(30, (a, b, c, d) => cell(a, b, c, d, 'Bureau d’études', [{ t: p.bet || 'BridgeAI Studios — Bridge Composer', b: true, fs: 4.2 }]));
      blk(62, titre);
      blk(22, infos);
      blk(h - (yy - y), indices);
    } else {
      const wl = w * 0.5, wr = w - wl;
      s += cell(x, y, wl, 40, 'Maître d’ouvrage', [{ t: p.moa || '—', b: true, fs: 4.4 }, { t: p.lieu || '', fs: 3.2 }]);
      s += cell(x, y + 40, wl, 44, 'Projet', wrap(p.nom || 'Ouvrage', wl - 8, 4.4).slice(0, 3).map((t) => ({ t, b: true, fs: 4.4 })));
      s += cell(x, y + 84, wl, 30, 'Bureau d’études', [{ t: p.bet || 'BridgeAI Studios — Bridge Composer', b: true, fs: 4 }]);
      s += titre(x + wl, y, wr, 84) + infos(x + wl, y + 84, wr, 30);
      s += indices(x, y + 114, w, h - 114);
    }
    return s + '</g>';
  }

  function reserveA4(box, img) {
    const [x, y, w, h] = box;
    return `<g data-tag="projet">` + R(x, y, w, h, 'fill:#fff;stroke:#1e1e1e;stroke-width:.7') + `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" href="${img}"/></g>`;
  }
  const okImg = (img) => img && /^data:image\/(svg\+xml|png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(img);

  /* opt : { dims } — orientation du cartouche dans M.S.cartouche.orient ('v' 210 × 297, 'h' 297 × 210) */
  function sheetSVG(M, opt) {
    opt = opt || {};
    const S = M.S, ct = S.cartouche || {}, orient = ct.orient === 'h' ? 'h' : 'v', Z = layout(orient);
    const piles = M.supports.filter((x) => x.kind === 'pile');
    const pid = piles.length ? piles.reduce((a, b) => (b.H > a.H ? b : a)).id : null;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW}mm" height="${SH}mm" role="img" class="sheet">`
      + `<style>.sheet text{font-family:'Arial Narrow','Segoe UI',Arial,sans-serif;fill:#14171f}</style>`
      + `<rect x="0" y="0" width="${SW}" height="${SH}" style="fill:#fff;stroke:none"/>`
      + R(FX0, FY0, FX1 - FX0, FY1 - FY0, 'fill:none;stroke:#1e1e1e;stroke-width:1');
    const ech = [];
    const put = (k, make, scales, id, tag) => { const r = place(make, Z[k], scales, id, opt, tag); ech.push(r.ech); s += r.svg; return r; };
    { const r = placePair((e) => C.elevScene(M, { ech: e }), Z.long, (e) => C.planScene(M, { ech: e }), Z.plan, ECH.long, opt); ech.push(r.ech); s += r.svg; }
    // coupes du tablier (courante, sur pile, sur culée) : une seule échelle, la plus grande qui convient aux trois cadres
    const [cx, , cw] = Z.cart, top = Z.cart[1] - GAP, nb = notaBlock(S.nota, cx, cw, 3);
    const nh = nb ? Math.min(nb.h, 150) : 0;
    Z.secC = [cx, FY0, cw, top - FY0 - (nb ? nh + GAP : 0)];
    const SEC = [
      ['secT', (e) => C.secScene(M, { ech: e, part: 'tablier' }), 'zt', 'tablier'],
      ['secP', (e) => C.secScene(M, { ech: e, part: pid ? 'pile' : 'culee', id: pid }), 'zs', pid || 'C' + (M.supports.length - 1)],
      ['secC', (e) => C.secScene(M, { ech: e, part: 'culee' }), 'zc', 'C0'],
    ];
    const fits = (e) => SEC.every(([k, mk, id]) => {
      const svg = C.toSVG(mk(e), { scale: K * 1000 / e, kp: K, pad: 2 * K, id, dims: opt.dims !== false });
      const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
      return vb[2] / K <= Z[k][2] - 2 && vb[3] / K <= Z[k][3] - 2;
    });
    const eSec = ECH.sec.find(fits) || ECH.sec[ECH.sec.length - 1];
    SEC.forEach(([k, mk, id, tag]) => put(k, mk, [eSec], id, tag));
    if (nb) s += `<clipPath id="nclip"><rect x="${cx}" y="${top - nh}" width="${cw}" height="${nh}"/></clipPath><g clip-path="url(#nclip)">${nb.draw(top - nh)}</g>` + R(cx, top - nh, cw, nh, 'fill:none;stroke:#1e1e1e;stroke-width:.5');
    s += okImg(ct.img) ? reserveA4(Z.cart, ct.img) : cartouche(M, Z.cart, ech, orient);
    return s + '</svg>';
  }

  return { sheetSVG, SHEET: { W: SW, H: SH, layout } };
});
