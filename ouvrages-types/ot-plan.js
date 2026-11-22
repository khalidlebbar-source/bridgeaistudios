/* Ponts types — moteur commun des planches (coffrage, câblage) : BridgeAI / KLE Ingénierie
   Primitives en millimètres papier (A3 paysage 420 × 297, y vers le haut) rendues en SVG (onglet) et en DXF R12
   (AutoCAD, calques séparés) ; cartouche KLE, cadre, notes, onglet avec téléchargements DXF / SVG / impression PDF. */
(function (G) {
  const SHEET = { W: 420, H: 297 };
  const LAYERS = {   // nom : [couleur ACI, type de ligne, épaisseur SVG (mm), couleur SVG]
    CONTOUR: [7, 'CONTINUOUS', 0.5, '#111'], VU: [7, 'CONTINUOUS', 0.25, '#111'], CACHE: [8, 'DASHED', 0.25, '#555'], AXE: [1, 'DASHDOT', 0.18, '#c0392b'],
    COTES: [3, 'CONTINUOUS', 0.13, '#1a4fd6'], TEXTE: [7, 'CONTINUOUS', 0.18, '#111'], APPAREILS: [5, 'CONTINUOUS', 0.35, '#1a4fd6'], CADRE: [7, 'CONTINUOUS', 0.5, '#111'],
    CARTOUCHE: [7, 'CONTINUOUS', 0.25, '#111'], BETON: [8, 'CONTINUOUS', 0, '#b9b3a6'], CABLES: [6, 'CONTINUOUS', 0.45, '#b0129b'], TERRAIN: [32, 'CONTINUOUS', 0.25, '#7a5a2a'],
    TABLEAU: [7, 'CONTINUOUS', 0.18, '#111'], BLANC: [7, 'CONTINUOUS', 0, '#fff'],
  };
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
  const SCALES = [10, 20, 25, 50, 75, 100, 125, 200, 250, 500, 1000, 2000];
  const pickScale = (lenM, availMm, list) => (list || SCALES).find(sc => lenM * 1000 / sc <= availMm) || (list || SCALES)[(list || SCALES).length - 1];

  function Sheet() {
    const P = [];
    const o = {
      P,
      line: (x1, y1, x2, y2, ly) => P.push({ t: 'L', p: [[x1, y1], [x2, y2]], ly }),
      poly: (pts, ly, closed) => P.push({ t: 'P', p: pts, ly, c: !!closed }),
      fill: (pts, ly) => P.push({ t: 'F', p: pts, ly }),
      circle: (x, y, r, ly, filled) => { const q = []; for (let i = 0; i < 24; i++) q.push([x + r * Math.cos(i * Math.PI / 12), y + r * Math.sin(i * Math.PI / 12)]); if (filled) P.push({ t: 'F', p: q, ly, solid: 1 }); P.push({ t: 'P', p: q, ly, c: true }); },
      text: (x, y, s, h, opt) => P.push(Object.assign({ t: 'T', x, y, s: String(s), h, ly: 'TEXTE', a: 'c', rot: 0 }, opt || {})),
      // cote alignée entre p1 et p2, décalée de off (mm, normale à gauche de p1→p2)
      dim(p1, p2, off, s, opt) {
        opt = opt || {};
        const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
        const a = [p1[0] + nx * off, p1[1] + ny * off], b = [p2[0] + nx * off, p2[1] + ny * off], sg = off >= 0 ? 1 : -1;
        if (!opt.noExt) { o.line(p1[0] + nx * sg * 1, p1[1] + ny * sg * 1, a[0] + nx * sg * 1.5, a[1] + ny * sg * 1.5, 'COTES'); o.line(p2[0] + nx * sg * 1, p2[1] + ny * sg * 1, b[0] + nx * sg * 1.5, b[1] + ny * sg * 1.5, 'COTES'); }
        o.line(a[0], a[1], b[0], b[1], 'COTES');
        for (const q of [a, b]) o.line(q[0] - (ux + nx) * 0.9, q[1] - (uy + ny) * 0.9, q[0] + (ux + nx) * 0.9, q[1] + (uy + ny) * 0.9, 'COTES');
        let rot = Math.atan2(uy, ux) * 180 / Math.PI; if (rot > 90.01 || rot < -89.99) rot += 180;
        const h = opt.h || 2.2, tx = (a[0] + b[0]) / 2, ty = (a[1] + b[1]) / 2, small = L < s.length * h * 0.75 + 2;
        if (opt.right) { o.text(tx + 1.8, ty - h * 0.45, s, h, { a: 'l', ly: 'COTES' }); return; }
        const sh = small && opt.outside !== false ? (L / 2 + s.length * h * 0.42 + 1.5) : 0;
        o.text(tx + ux * sh + nx * 0.8, ty + uy * sh + ny * 0.8, s, h, { rot, ly: 'COTES' });
      },
      // chaîne de cotes horizontale à l'ordonnée y (xs : abscisses papier, labels : textes)
      chainH(xs, y, labels, opt) { for (let i = 0; i < xs.length - 1; i++) o.dim([xs[i], y], [xs[i + 1], y], 0, labels[i], Object.assign({ noExt: true, outside: false }, opt || {})); for (const x of xs) o.line(x, y - 1.5, x, y + 1.5, 'COTES'); },
      chainV(ys, x, labels, opt) { for (let i = 0; i < ys.length - 1; i++) o.dim([x, ys[i]], [x, ys[i + 1]], 0, labels[i], Object.assign({ noExt: true, h: 2 }, opt || {})); for (const y of ys) o.line(x - 1.5, y, x + 1.5, y, 'COTES'); },
      title: (x, y, t, sub) => { o.text(x, y, t, 4, { a: 'l', bold: 1 }); if (sub) o.text(x, y - 4.5, sub, 2.5, { a: 'l' }); },
      frame: () => o.poly([[10, 10], [410, 10], [410, 287], [10, 287]], 'CADRE', true),
      // cartouche KLE en bas à droite (128 × 76 mm)
      cartouche(c) {
        const x0 = 282, y0 = 10, w = 128, h = 76;
        o.poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], 'CARTOUCHE', true);
        for (const y of [y0 + 62, y0 + 50, y0 + 34, y0 + 22, y0 + 12]) o.line(x0, y, x0 + w, y, 'CARTOUCHE');
        o.line(x0 + 64, y0, x0 + 64, y0 + 22, 'CARTOUCHE');
        o.text(x0 + w / 2, y0 + 67.5, 'KLE INGÉNIERIE', 5, { bold: 1 });
        o.text(x0 + w / 2, y0 + 64, 'Bureau d\'études techniques — ouvrages d\'art', 2.2);
        o.text(x0 + w / 2, y0 + 55, c.titre, 4, { bold: 1 });
        o.text(x0 + w / 2, y0 + 51.2, c.sous || '', 2.4);
        const tt = (c.ouvrage || []).map(x => String(x || '').trim()).filter(Boolean);
        o.text(x0 + w / 2, y0 + 44, tt[0] || 'ouvrage', 2.8); if (tt[1]) o.text(x0 + w / 2, y0 + 39, tt[1], 2.5);
        o.text(x0 + 3, y0 + 27, 'Note de calcul n° ' + (c.numero || '—'), 2.5, { a: 'l' });
        o.text(x0 + 3, y0 + 24, 'Échelles : ' + (c.echelles || ''), 2.2, { a: 'l' });
        o.text(x0 + w - 3, y0 + 27, 'Format A3', 2.5, { a: 'r' });
        o.text(x0 + 3, y0 + 16, 'Date : ' + (c.date || today()), 2.5, { a: 'l' });
        o.text(x0 + 67, y0 + 16, 'Indice : A', 2.5, { a: 'l' });
        o.text(x0 + 3, y0 + 8.5, 'Établi par : KLE Ingénierie', 2.2, { a: 'l' });
        o.text(x0 + 67, y0 + 8.5, 'Plan n° : ' + (c.planNo || '—'), 2.2, { a: 'l' });
        o.text(x0 + 3, y0 + 4.5, 'Dessiné : BridgeAI Studios', 2.2, { a: 'l' });
        o.text(x0 + 67, y0 + 4.5, 'Vérifié :', 2.2, { a: 'l' });
      },
      notes(lines, x, y) { (lines || []).forEach((t, i) => o.text(x == null ? 282 : x, (y == null ? 115 : y) - i * 4.2, t, 2.2, { a: 'l' })); },
      // tableau simple : rows = [[...cellules]], widths en mm, en-tête en gras
      table(x, y, widths, rows, h) {
        h = h || 4.6; const W = widths.reduce((a, b) => a + b, 0);
        rows.forEach((r, i) => { const yy = y - i * h; o.line(x, yy, x + W, yy, 'TABLEAU'); let xx = x; r.forEach((c, j) => { o.text(xx + widths[j] / 2, yy - h + 1.4, c, 2.1, { bold: i === 0 ? 1 : 0, ly: 'TABLEAU' }); xx += widths[j]; }); });
        const yb = y - rows.length * h; o.line(x, yb, x + W, yb, 'TABLEAU'); let xx = x; for (const wd of [0].concat(widths)) { xx += wd; o.line(xx, y, xx, yb, 'TABLEAU'); }
        return yb;
      },
    };
    return o;
  }
  const today = () => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };

  function toSVG(S) {
    const H = SHEET.H, esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let o = `<svg viewBox="0 0 ${SHEET.W} ${H}" width="100%" style="background:#fff;display:block" font-family="Arial Narrow, Arial, sans-serif"><defs><pattern id="otH" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#b9b3a6" stroke-width="0.25"/></pattern><pattern id="otT" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="3" stroke="#c9b48a" stroke-width="0.3"/></pattern></defs>`;
    const pt = p => `${(+p[0]).toFixed(2)},${(H - p[1]).toFixed(2)}`;
    const sty = ly => { const [, lt, w, col] = LAYERS[ly] || LAYERS.VU; return `stroke="${col}" stroke-width="${w}" fill="none"${lt === 'DASHED' ? ' stroke-dasharray="2 1.2"' : lt === 'DASHDOT' ? ' stroke-dasharray="6 1.2 1 1.2"' : ''}`; };
    for (const q of S.P) {
      if (q.t === 'F') o += `<polygon points="${q.p.map(pt).join(' ')}" fill="${q.solid ? (LAYERS[q.ly] || LAYERS.VU)[3] : q.ly === 'TERRAIN' ? 'url(#otT)' : 'url(#otH)'}" stroke="none"/>`;
      else if (q.t === 'L' || q.t === 'P') o += `<${q.c ? 'polygon' : 'polyline'} points="${q.p.map(pt).join(' ')}" ${sty(q.ly)} stroke-linejoin="round"/>`;
      else if (q.t === 'T') {
        const an = q.a === 'l' ? 'start' : q.a === 'r' ? 'end' : 'middle', col = (LAYERS[q.ly] || LAYERS.TEXTE)[3];
        o += `<text x="${q.x.toFixed(2)}" y="${(H - q.y).toFixed(2)}" font-size="${(q.h / 0.72).toFixed(2)}" text-anchor="${an}" fill="${q.ly === 'TABLEAU' || q.ly === 'CARTOUCHE' ? '#111' : col}"${q.bold ? ' font-weight="700"' : ''}${q.rot ? ` transform="rotate(${(-q.rot).toFixed(2)} ${q.x.toFixed(2)} ${(H - q.y).toFixed(2)})"` : ''}>${esc(q.s)}</text>`;
      }
    }
    return o + '</svg>';
  }

  function toDXF(S) {
    const out = [], p = (c, v) => out.push(String(c), String(v));
    const tx = s0 => { const s = s0.replace(/—/g, '-').replace(/←/g, '<-').replace(/→/g, '->').replace(/[’‘]/g, "'"); let r = ''; for (const ch of s) { const c = ch.codePointAt(0); r += c > 255 ? '\\U+' + c.toString(16).toUpperCase().padStart(4, '0') : ch; } return r; };
    p(0, 'SECTION'); p(2, 'HEADER'); p(9, '$ACADVER'); p(1, 'AC1009'); p(9, '$DWGCODEPAGE'); p(3, 'ANSI_1252'); p(9, '$INSUNITS'); p(70, 4);
    p(9, '$EXTMIN'); p(10, 0); p(20, 0); p(9, '$EXTMAX'); p(10, SHEET.W); p(20, SHEET.H); p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'TABLES');
    p(0, 'TABLE'); p(2, 'LTYPE'); p(70, 3);
    const lt = (n, d, pat) => { p(0, 'LTYPE'); p(2, n); p(70, 0); p(3, d); p(72, 65); p(73, pat.length); p(40, pat.reduce((a, v) => a + Math.abs(v), 0)); for (const v of pat) p(49, v); };
    lt('CONTINUOUS', 'Solid line', []); lt('DASHED', '__ __ __', [2, -1.2]); lt('DASHDOT', '__ . __ .', [6, -1.2, 0, -1.2]);
    p(0, 'ENDTAB');
    p(0, 'TABLE'); p(2, 'LAYER'); p(70, Object.keys(LAYERS).length);
    for (const [n, [c, l]] of Object.entries(LAYERS)) { p(0, 'LAYER'); p(2, n); p(70, 0); p(62, c); p(6, l); }
    p(0, 'ENDTAB');
    p(0, 'TABLE'); p(2, 'STYLE'); p(70, 1); p(0, 'STYLE'); p(2, 'STANDARD'); p(70, 0); p(40, 0); p(41, 0.85); p(50, 0); p(71, 0); p(42, 2.5); p(3, 'arial.ttf'); p(4, ''); p(0, 'ENDTAB');
    p(0, 'ENDSEC');
    p(0, 'SECTION'); p(2, 'ENTITIES');
    for (const q of S.P) {
      if (q.t === 'F') continue;
      if (q.t === 'L') { p(0, 'LINE'); p(8, q.ly); p(10, q.p[0][0].toFixed(3)); p(20, q.p[0][1].toFixed(3)); p(30, 0); p(11, q.p[1][0].toFixed(3)); p(21, q.p[1][1].toFixed(3)); p(31, 0); }
      else if (q.t === 'P') { p(0, 'POLYLINE'); p(8, q.ly); p(66, 1); p(10, 0); p(20, 0); p(30, 0); p(70, q.c ? 1 : 0);
        for (const v of q.p) { p(0, 'VERTEX'); p(8, q.ly); p(10, v[0].toFixed(3)); p(20, v[1].toFixed(3)); p(30, 0); } p(0, 'SEQEND'); p(8, q.ly); }
      else if (q.t === 'T') { const h72 = q.a === 'l' ? 0 : q.a === 'r' ? 2 : 1;
        p(0, 'TEXT'); p(8, q.ly); p(10, q.x.toFixed(3)); p(20, q.y.toFixed(3)); p(30, 0); p(40, q.h); p(1, tx(q.s)); if (q.rot) p(50, q.rot.toFixed(3)); p(41, 0.85); p(7, 'STANDARD');
        if (h72) { p(72, h72); p(11, q.x.toFixed(3)); p(21, q.y.toFixed(3)); p(31, 0); } }
    }
    p(0, 'ENDSEC'); p(0, 'EOF');
    const s = out.join('\r\n') + '\r\n', bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); bytes[i] = c < 256 ? c : 63; }
    return bytes;
  }

  function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  const svgFile = S => toSVG(S).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" ').replace('width="100%" ', '');
  function printPDF(S, title) {
    const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title || 'Plan'}</title><style>@page{size:A3 landscape;margin:0}html,body{margin:0}svg{width:420mm;height:297mm;display:block}</style></head><body>${toSVG(S).replace('width="100%" ', '')}</body></html>`);
    w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 300);
  }
  /* contenu d'un onglet de planche : barre (titre, sous-titre, téléchargements) + planche ajustée à la hauteur */
  function tab(el, o) {
    const S = o.sheet, fn = o.file || 'plan';
    el.innerHTML = `<div class="ot-xbar"><b style="font-size:13px">${o.title}</b><span style="font-size:12px;color:var(--ink3)">${o.sub || ''}</span><div style="flex:1"></div>
      <button class="ot-btn" data-p="dxf">Télécharger DXF (AutoCAD)</button><button class="ot-btn" data-p="svg">Télécharger SVG</button><button class="ot-btn pri" data-p="pdf">Imprimer / PDF</button></div>
      <div class="ot-xfig">${toSVG(S)}</div>`;
    el.querySelector('[data-p=dxf]').onclick = () => save(new Blob([toDXF(S)], { type: 'application/dxf' }), fn + '.dxf');
    el.querySelector('[data-p=svg]').onclick = () => save(new Blob([svgFile(S)], { type: 'image/svg+xml' }), fn + '.svg');
    el.querySelector('[data-p=pdf]').onclick = () => printPDF(S, o.title);
  }
  G.OTPLAN = { SHEET, LAYERS, Sheet, toSVG, toDXF, svgFile, printPDF, save, tab, f2, pickScale, today };
})(typeof window !== 'undefined' ? window : globalThis);
