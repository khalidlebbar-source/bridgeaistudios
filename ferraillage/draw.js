/* BridgeAI Studios — Plans de coffrage & ferraillage : dessins.
 *
 * Chaque vue est d'abord construite comme une « scène » (primitives en mètres,
 * y vers le haut), puis rendue en SVG (écran, impression) ou en DXF (dxf.js).
 * Les tailles de texte et de symboles sont exprimées en pixels ; u = mètres par pixel.
 */
(function (root, factory) {
  const calc = (typeof module === 'object' && module.exports) ? require('./calc.js') : root.FERR;
  const api = factory(calc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FERR = Object.assign(root.FERR || {}, api);
})(typeof self !== 'undefined' ? self : this, function (F) {
  'use strict';

  const COLORS = ['#c0392b', '#2d6be4', '#0f8f7b', '#b07d12', '#8e44ad', '#d35400', '#1e8449', '#34495e', '#c2185b', '#5e35b1', '#00838f', '#6d4c41'];
  const INK = '#14171f', DIM = '#6b7280', CONCRETE = '#efebe0';
  const rad = (d) => d * Math.PI / 180;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ───────── Scène ───────── */
  function Scene(u) { this.u = u; this.items = []; }
  Scene.prototype.poly = function (pts, o) { this.items.push(Object.assign({ t: 'poly', pts, layer: 'KLE-Contour', color: INK, w: 1 }, o)); return this; };
  Scene.prototype.line = function (a, b, o) { return this.poly([a, b], o); };
  Scene.prototype.circle = function (c, r, o) { this.items.push(Object.assign({ t: 'circle', c, r, layer: 'KLE-Contour', color: INK, w: 1 }, o)); return this; };
  Scene.prototype.bar = function (path, wM, o) { this.items.push(Object.assign({ t: 'bar', path, wM, layer: 'ACIERS', color: INK }, o)); return this; };
  Scene.prototype.text = function (p, s, o) { this.items.push(Object.assign({ t: 'text', p, s: String(s), h: 11, anchor: 'middle', rot: 0, layer: 'KLE-Cotation', color: INK }, o)); return this; };

  function textBox(it, u) {
    const w = it.s.length * it.h * 0.56 * u, h = it.h * u;
    const ax = it.anchor === 'start' ? 0 : it.anchor === 'end' ? -w : -w / 2;
    let x0 = ax, x1 = ax + w, y0 = -h / 2, y1 = h / 2;
    if (Math.abs(it.rot) === 90) { [x0, x1, y0, y1] = [-h / 2, h / 2, ax, ax + w]; }
    return [it.p[0] + x0, it.p[1] + y0, it.p[0] + x1, it.p[1] + y1];
  }

  function bounds(scene) {
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    const add = (x, y) => { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); };
    for (const it of scene.items) {
      if (it.t === 'poly') { it.pts.forEach((p) => add(p[0], p[1])); (it.holes || []).forEach((h) => h.forEach((p) => add(p[0], p[1]))); }
      else if (it.t === 'bar') samplePath(it.path, 6).forEach((p) => add(p[0], p[1]));
      else if (it.t === 'circle') { add(it.c[0] - it.r, it.c[1] - it.r); add(it.c[0] + it.r, it.c[1] + it.r); }
      else if (it.t === 'text') { const tb = textBox(it, scene.u); add(tb[0], tb[1]); add(tb[2], tb[3]); }
    }
    return b;
  }

  /* Rendu SVG d'une scène à l'échelle s (px/m). */
  function toSVG(scene, s, opts) {
    opts = opts || {};
    const pad = opts.pad == null ? 6 : opts.pad;
    const b = bounds(scene);
    const W = Math.ceil((b[2] - b[0]) * s + 2 * pad), H = Math.ceil((b[3] - b[1]) * s + 2 * pad);
    const X = (x) => ((x - b[0]) * s + pad).toFixed(1), Y = (y) => ((b[3] - y) * s + pad).toFixed(1);
    const pathOf = (pts, closed) => 'M' + pts.map((p) => X(p[0]) + ' ' + Y(p[1])).join('L') + (closed ? 'Z' : '');
    let out = '';
    for (const it of scene.items) {
      if (it.t === 'poly') {
        let d = pathOf(it.pts, it.closed);
        (it.holes || []).forEach((h) => { d += pathOf(h, true); });
        out += `<path d="${d}" fill="${it.fill || 'none'}"${it.holes ? ' fill-rule="evenodd"' : ''} stroke="${it.stroke === false ? 'none' : it.color}" stroke-width="${it.w}"${it.dash ? ` stroke-dasharray="${it.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"${it.barId ? ` data-bar="${it.barId}"` : ''}/>`;
      } else if (it.t === 'bar') {
        // trajet cintré : arcs SVG (l'axe y est inversé à l'écran, donc un bulge positif
        // — sens trigonométrique — devient un arc horaire : sweep-flag 0) ; tracé transparent
        // plus large derrière pour la sélection
        let d = 'M' + X(it.path[0].p[0]) + ' ' + Y(it.path[0].p[1]);
        for (let i = 0; i < it.path.length - 1; i++) {
          const A = it.path[i].p, B = it.path[i + 1].p, bu = it.path[i].b;
          if (Math.abs(bu) < 1e-9) d += 'L' + X(B[0]) + ' ' + Y(B[1]);
          else {
            const th = Math.abs(4 * Math.atan(bu)), c = Math.hypot(B[0] - A[0], B[1] - A[1]), r = (c / (2 * Math.sin(th / 2)) * s).toFixed(2);
            d += `A${r} ${r} 0 ${th > Math.PI ? 1 : 0} ${bu > 0 ? 0 : 1} ${X(B[0])} ${Y(B[1])}`;
          }
        }
        const w = Math.max(it.minPx || 1, it.wM * s).toFixed(2);
        out += `<g data-bar="${it.barId}"><path d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(14, +w + 8)}" stroke-linecap="round" pointer-events="stroke"/><path d="${d}" fill="none" stroke="${it.color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="butt"/></g>`;
      } else if (it.t === 'circle') {
        if (it.hit) out += `<circle cx="${X(it.c[0])}" cy="${Y(it.c[1])}" r="${Math.max(9, it.r * s).toFixed(1)}" fill="transparent" data-bar="${it.barId}"/>`;
        out += `<circle cx="${X(it.c[0])}" cy="${Y(it.c[1])}" r="${Math.max(it.minPx || 0, it.r * s).toFixed(2)}" fill="${it.fill || 'none'}" stroke="${it.stroke === false ? 'none' : it.color}" stroke-width="${it.w}"${it.barId ? ` data-bar="${it.barId}"` : ''}/>`;
      } else if (it.t === 'text') {
        const tr = it.rot ? ` transform="rotate(${-it.rot} ${X(it.p[0])} ${Y(it.p[1])})"` : '';
        out += `<text x="${X(it.p[0])}" y="${Y(it.p[1])}" font-size="${it.h}" text-anchor="${it.anchor}" dominant-baseline="central" fill="${it.color}"${it.halo ? ' stroke="#ffffff" stroke-width="3" paint-order="stroke"' : ''}${it.weight ? ` font-weight="${it.weight}"` : ''}${it.italic ? ' font-style="italic"' : ''}${it.barId ? ` data-bar="${it.barId}"` : ''}${tr}>${esc(it.s)}</text>`;
      }
    }
    const label = opts.label ? ` role="img" aria-label="${esc(opts.label)}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Outfit, Arial, sans-serif"${label}>${out}</svg>`;
  }

  /* Construit une scène (build(u)) et la rend au mieux dans une boîte W × H px. */
  function fitRender(build, W, H, opts) {
    let s = 100, sc;
    for (let k = 0; k < 4; k++) {
      sc = build(1 / s);
      const b = bounds(sc), w = (b[2] - b[0]) * s + 12, h = (b[3] - b[1]) * s + 12;
      const f = Math.min(W / w, H / h);
      if (Math.abs(f - 1) < 0.01) break;
      s = Math.max(20, Math.min(s * f, 1200));
    }
    return toSVG(build(1 / s), s, opts);
  }

  /* ───────── Cotation ───────── */
  function dim(sc, p1, p2, orient, at, txt, o) {
    o = o || {};
    const u = sc.u, gap = 3 * u, tk = 4 * u, L = { layer: 'KLE-Cotation', color: DIM, w: 0.8 };
    if (orient === 'h') {
      const [x1, x2] = [Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0])];
      const sgn = at < p1[1] ? -1 : 1;
      sc.line([p1[0], p1[1] + sgn * gap], [p1[0], at + sgn * 3 * u], L);
      sc.line([p2[0], p2[1] + sgn * gap], [p2[0], at + sgn * 3 * u], L);
      sc.line([x1, at], [x2, at], L);
      [x1, x2].forEach((x) => sc.line([x - tk, at - tk], [x + tk, at + tk], Object.assign({}, L, { color: INK })));
      const tw = txt.length * 11 * 0.56 * u;
      if (x2 - x1 > tw + 8 * u) sc.text([(x1 + x2) / 2, at + 8 * u], txt, { color: INK });
      else sc.text([o.flip ? x1 - 5 * u : x2 + 5 * u, at + 8 * u], txt, { color: INK, anchor: o.flip ? 'end' : 'start' });
    } else {
      const [y1, y2] = [Math.min(p1[1], p2[1]), Math.max(p1[1], p2[1])];
      const sgn = at < p1[0] ? -1 : 1;
      sc.line([p1[0] + sgn * gap, p1[1]], [at + sgn * 3 * u, p1[1]], L);
      sc.line([p2[0] + sgn * gap, p2[1]], [at + sgn * 3 * u, p2[1]], L);
      sc.line([at, y1], [at, y2], L);
      [y1, y2].forEach((y) => sc.line([at - tk, y - tk], [at + tk, y + tk], Object.assign({}, L, { color: INK })));
      const tw = txt.length * 11 * 0.56 * u;
      if (y2 - y1 > tw + 8 * u) sc.text([at - 8 * u, (y1 + y2) / 2], txt, { color: INK, rot: 90 });
      else { // cote trop courte : texte horizontal, à l'extérieur de la ligne de cote
        const out = sgn < 0 ? -1 : 1;
        sc.text([at + out * 5 * u, (y1 + y2) / 2], txt, { color: INK, anchor: out < 0 ? 'end' : 'start' });
      }
    }
  }

  function hatchRect(sc, x0, y0, x1, y1, step) {
    const L = { layer: 'KLE-Contour', color: '#9aa0ac', w: 0.6 };
    for (let k = x0 - (y1 - y0); k < x1; k += step) {
      // segment de pente 1 : x = k + (y − y0)
      let ya = y0, xa = k, yb = y1, xb = k + (y1 - y0);
      if (xa < x0) { ya = y0 + (x0 - xa); xa = x0; }
      if (xb > x1) { yb = y1 - (xb - x1); xb = x1; }
      if (ya < yb) sc.line([xa, ya], [xb, yb], L);
    }
  }

  /* ───────── Contours ───────── */
  function outline(struct, g) {
    if (struct === 'murT') return { outer: F.STRUCTURES.murT.outline(g).outer, holes: [] };
    const { Bext, Hext, ep, er, et } = g, G = g.g;
    const inner = G > 0.001
      ? [[ep, er + G], [ep + G, er], [Bext - ep - G, er], [Bext - ep, er + G], [Bext - ep, Hext - et - G], [Bext - ep - G, Hext - et], [ep + G, Hext - et], [ep, Hext - et - G]]
      : [[ep, er], [Bext - ep, er], [Bext - ep, Hext - et], [ep, Hext - et]];
    return { outer: [[0, 0], [Bext, 0], [Bext, Hext], [0, Hext]], holes: [inner] };
  }

  function drawOutline(sc, struct, g, light) {
    const o = outline(struct, g);
    sc.poly(o.outer, { closed: true, holes: o.holes.length ? o.holes : undefined, fill: CONCRETE, w: light ? 1.1 : 1.6, layer: 'KLE-Contour' });
    if (struct === 'murT' && g.bp > 0) {
      const bp = g.bp, x0 = -0.05, x1 = g.B + 0.05, st = Math.max(0.04, 9 * sc.u), L = { closed: true, w: 1, layer: 'KLE-Contour' };
      if (g.beche) {
        const b0 = g.bx0, b1 = g.bx1, bh = g.bh, X0 = Math.min(x0, b0 - bp), X1 = Math.max(x1, b1 + bp);
        sc.poly(F.cleanPath([[X0, 0], [b0, 0], [b0, -bh], [b1, -bh], [b1, 0], [X1, 0], [X1, -bp], [b1 + bp, -bp], [b1 + bp, -bh - bp], [b0 - bp, -bh - bp], [b0 - bp, -bp], [X0, -bp]]), L);
        if (b0 - bp > x0) hatchRect(sc, x0, -bp, b0 - bp, 0, st);
        if (x1 > b1 + bp) hatchRect(sc, b1 + bp, -bp, x1, 0, st);
        hatchRect(sc, b0 - bp, -bh - bp, b0, 0, st);
        hatchRect(sc, b1, -bh - bp, b1 + bp, 0, st);
        hatchRect(sc, b0, -bh - bp, b1, -bh, st);
      } else {
        sc.poly([[x0, -bp], [x1, -bp], [x1, 0], [x0, 0]], L);
        hatchRect(sc, x0, -bp, x1, 0, st);
      }
    }
  }

  /* Échelle (px/m) pour faire tenir une emprise dans une largeur donnée. */
  function fitScale(extW, extH, width, marginX, maxH) {
    let s = (width - marginX) / extW;
    if (maxH) s = Math.min(s, maxH / extH);
    return Math.max(40, Math.min(s, 900));
  }

  /* Coupe de coffrage cotée du mur, façon feuille de stabilité : TN aval, talus amont,
     hauteur de poussée, fruits, bêche et biseau. */
  function murCoffrage(sc, g, u, f) {
    const { B, hs, p, H, bp, eb, talon, Hv, xAvT, xAmT, hbp, hbt, Hp } = g;
    const TER = { layer: 'KLE-Cotation', color: '#7b6a3a', w: 1.1 }, HID = { layer: 'KLE-Cotation', color: DIM, w: 0.8, dash: '5 4' };
    const yb = -(bp || 0) - (g.beche ? g.bh : 0);
    // terrain aval
    if (g.tn > 0) {
      const y = hs + g.tn, xf = p + g.fv * g.tn;
      sc.line([-0.12, y], [xf, y], TER);
      sc.text([-0.12, y + 9 * u], 'TN aval', { h: 10, color: '#7b6a3a', italic: true, anchor: 'start' });
      if (p > 0.18) dim(sc, [p * 0.55, hs], [p * 0.55, y], 'v', p * 0.55, f(g.tn));
    }
    // talus amont, horizontale de référence, poussée
    const tb = Math.tan(g.beta * Math.PI / 180), xE = B + Math.max(0.35, 0.12 * B), yE = H + (xE - xAmT) * tb;
    sc.line([xAmT, H], [xE, yE], TER);
    sc.text([xE, yE - 10 * u], g.beta > 0 ? 'TN amont' : 'Terre-plein', { h: 10, color: '#7b6a3a', italic: true, anchor: 'end', halo: true });
    if (g.beta > 0) {
      sc.line([xAmT, H], [xE, H], HID);
      const R = Math.min(0.9, 0.45 * (xE - xAmT)), a = [];
      for (let k = 0; k <= 10; k++) { const t = g.beta * Math.PI / 180 * k / 10; a.push([xAmT + R * Math.cos(t), H + R * Math.sin(t)]); }
      sc.poly(a, { layer: 'KLE-Cotation', color: DIM, w: 0.8 });
      sc.text([xAmT + R + 5 * u, H + R * tb / 2 + 2 * u], 'β = ' + g.beta.toFixed(2).replace('.', ',') + '°', { h: 10.5, anchor: 'start', halo: true });
    }
    if (g.q > 0) {
      const n = 4, x0 = xAmT + 0.35 * (xE - xAmT);
      for (let i = 0; i < n; i++) {
        const x = x0 + 0.62 * (xE - x0) * i / (n - 1), y = H + (x - xAmT) * tb + 3 * u;
        sc.line([x, y], [x, y + 16 * u], { layer: 'KLE-Cotation', color: '#2d6be4', w: 0.9 });
        sc.poly([[x - 3 * u, y + 5 * u], [x, y], [x + 3 * u, y + 5 * u]], { layer: 'KLE-Cotation', color: '#2d6be4', w: 0.9 });
      }
      const xq = x0 + 0.31 * (xE - x0), yq = H + (xq - xAmT) * tb + 32 * u;
      sc.text([xq, yq], 'q = ' + String(g.q.toFixed(2)).replace('.', ',') + ' t/m²', { h: 10, color: '#2d6be4', halo: true });
    }
    sc.line([B, hbt], [B, Hp], HID);
    sc.line([B, Hp], [xE + 6 * u, Hp], HID);
    dim(sc, [xE, 0], [xE, Hp], 'v', xE + 26 * u, f(Hp));
    sc.text([xE + 40 * u, Hp * 0.5], 'hauteur de poussée', { h: 9.5, color: DIM, italic: true, rot: 90 });
    // fruits
    const lab = (P, txt, anchor) => sc.text(P, txt, { h: 9.5, color: DIM, italic: true, anchor, halo: true });
    if (g.fa > 0) lab([(xAmT + p + eb) / 2 + 8 * u, hs + Hv * 0.42], 'fruit ' + String(g.fa).replace('.', ',') + ' m/m', 'start');
    if (g.fv > 0) lab([(xAvT + p) / 2 - 8 * u, hs + Hv * 0.6], 'fruit ' + String(g.fv).replace('.', ',') + ' m/m', 'end');
    sc.text([p + eb + Math.max(0.1, talon * 0.55), hs + Math.min(Hv * 0.25, 0.9) + 0.05], 'Remblai', { h: 10.5, color: DIM, italic: true });
    if (p > 0.3 && !(g.tn > 0)) sc.text([p * 0.5, hs + 14 * u], 'Aval', { h: 10.5, color: DIM, italic: true });
    // cotes horizontales
    const yc1 = yb - 20 * u, chain = g.beche ? yb - 44 * u : yc1;
    if (g.beche) {
      const xs = [0, g.bx0, g.bx1, B].filter((x, i, a) => i === 0 || x - a[i - 1] > 1e-6);
      for (let i = 1; i < xs.length; i++) dim(sc, [xs[i - 1], yb], [xs[i], yb], 'h', yc1, f(xs[i] - xs[i - 1]), { flip: i === 1 });
      dim(sc, [g.bx1, -g.bh], [g.bx1, 0], 'v', g.bx1 + 16 * u, f(g.bh), { flip: true });
    }
    if (p > 1e-6) dim(sc, [0, yb], [p, yb], 'h', chain, f(p), { flip: true });
    dim(sc, [p, yb], [p + eb, yb], 'h', chain, f(eb));
    if (talon > 1e-6) dim(sc, [p + eb, yb], [B, yb], 'h', chain, f(talon));
    dim(sc, [0, yb], [B, yb], 'h', chain - 24 * u, f(B));
    dim(sc, [xAvT, H], [xAmT, H], 'h', H + 20 * u, f(g.e0));
    // cotes verticales à gauche
    const xl = Math.min(-0.15, g.beche ? g.bx0 - bp : 0);
    let k = 1;
    if (g.biseau && hbp < hs - 1e-6) { dim(sc, [0, 0], [0, hbp], 'v', xl - 20 * u, f(hbp), { flip: true }); k = 2; }
    dim(sc, [0, 0], [0, hs], 'v', xl - (20 + 24 * (k - 1)) * u, f(hs), { flip: true });
    dim(sc, [xAvT, hs], [xAvT, H], 'v', xl - (20 + 24 * (k - 1)) * u, f(Hv));
    dim(sc, [0, 0], [xAvT, H], 'v', xl - (44 + 24 * (k - 1)) * u, f(H));
    if (g.biseau && hbt < hs - 1e-6) dim(sc, [B, 0], [B, hbt], 'v', B + 16 * u, f(hbt), { flip: true });
    if (bp > 0) sc.text([p + eb + talon * 0.5, -bp / 2], 'Béton de propreté ' + f(bp), { h: 9, color: DIM, italic: true, halo: true });
  }

  /* ───────── Vue 1 : coupe de coffrage cotée ───────── */
  function coffrageScene(struct, g, u) {
    const sc = new Scene(u), f = F.fmtCote;
    drawOutline(sc, struct, g);
    if (struct === 'murT') murCoffrage(sc, g, u, f);
    else {
      const { Bext, Hext, ep, er, et, O, Hi } = g, G = g.g;
      dim(sc, [0, Hext], [ep, Hext], 'h', Hext + 20 * u, f(ep), { flip: true });
      dim(sc, [ep, Hext - et], [Bext - ep, Hext - et], 'h', Hext + 20 * u, f(O));
      dim(sc, [Bext - ep, Hext], [Bext, Hext], 'h', Hext + 20 * u, f(ep));
      dim(sc, [0, 0], [Bext, 0], 'h', -22 * u, f(Bext));
      dim(sc, [0, 0], [0, er], 'v', -20 * u, f(er), { flip: true });
      dim(sc, [ep, er], [ep, Hext - et], 'v', -20 * u, f(Hi));
      dim(sc, [0, Hext - et], [0, Hext], 'v', -20 * u, f(et));
      dim(sc, [Bext, 0], [Bext, Hext], 'v', Bext + 24 * u, f(Hext));
      if (G > 0.001) {
        const px = ep + G / 2, py = er + G / 2;
        sc.line([px, py], [px + 0.18 * Math.min(1, O), py + 0.18 * Math.min(1, Hi)], { layer: 'KLE-Cotation', color: DIM, w: 0.8 });
        sc.text([px + 0.18 * Math.min(1, O) + 4 * u, py + 0.18 * Math.min(1, Hi) + 2 * u], 'gousset ' + f(G) + ' × ' + f(G), { anchor: 'start', h: 10, color: INK });
      }
      sc.text([Bext / 2, er + Hi / 2], 'O = ' + f(O) + ' · Hi = ' + f(Hi), { h: 10.5, color: DIM, italic: true });
    }
    return sc;
  }

  /* ───────── Vue 2 : élévation (mur) ou vue en plan (dalot) ───────── */
  function secondScene(struct, g, u) {
    const sc = new Scene(u), f = F.fmtCote;
    if (struct === 'murT') {
      const { L, hs, H } = g, hb = g.beche ? g.bh : 0;
      sc.poly([[0, 0], [L, 0], [L, hs], [0, hs]], { closed: true, fill: CONCRETE, w: 1.4 });
      sc.poly([[0, hs], [L, hs], [L, H], [0, H]], { closed: true, fill: '#f6f3ea', w: 1.4 });
      if (hb) sc.poly([[0, -hb], [L, -hb], [L, 0], [0, 0]], { closed: true, dash: '6 4', w: 1, color: '#7b8191' });
      if (g.tn > 0) { sc.line([-0.3, hs + g.tn], [L + 0.3, hs + g.tn], { w: 1, color: '#7b6a3a', layer: 'KLE-Cotation' }); sc.text([L + 0.35, hs + g.tn], 'TN aval', { h: 10, color: DIM, italic: true, anchor: 'start' }); }
      dim(sc, [0, -hb], [L, -hb], 'h', -hb - 20 * u, f(L));
      dim(sc, [0, 0], [0, H], 'v', -20 * u, f(H));
      sc.text([L / 2, hs + (H - hs) * 0.6], 'Parement aval du voile', { h: 10, color: DIM, italic: true });
      sc.text([L / 2, H + 12 * u], 'Élévation du plot (joints aux extrémités)' + (hb ? ' — bêche en traits cachés' : ''), { h: 10, color: DIM });
    } else {
      const { L, Bext, ep } = g;
      sc.poly([[0, 0], [L, 0], [L, Bext], [0, Bext]], { closed: true, fill: CONCRETE, w: 1.4 });
      sc.line([0, ep], [L, ep], { dash: '6 4', w: 1, color: '#7b8191' });
      sc.line([0, Bext - ep], [L, Bext - ep], { dash: '6 4', w: 1, color: '#7b8191' });
      sc.line([-0.3, Bext / 2], [L + 0.3, Bext / 2], { dash: '14 3 2 3', w: 0.7, color: DIM, layer: 'KLE-Cotation' });
      const ax = L / 2, ay = Bext / 2;
      sc.poly([[ax - 0.6, ay + 0.12], [ax + 0.6, ay + 0.12]], { w: 1, color: '#2d6be4', layer: 'KLE-Cotation' });
      sc.poly([[ax + 0.45, ay + 0.2], [ax + 0.6, ay + 0.12], [ax + 0.45, ay + 0.04]], { w: 1, color: '#2d6be4', layer: 'KLE-Cotation' });
      sc.text([ax, ay - 0.16], 'écoulement', { h: 10, color: '#2d6be4', italic: true });
      dim(sc, [0, 0], [L, 0], 'h', -20 * u, f(L));
      dim(sc, [L, 0], [L, ep], 'v', L + 20 * u, f(ep), { flip: true });
      dim(sc, [L, ep], [L, Bext - ep], 'v', L + 20 * u, f(g.O));
      dim(sc, [L, Bext - ep], [L, Bext], 'v', L + 20 * u, f(ep));
      dim(sc, [0, 0], [0, Bext], 'v', -20 * u, f(Bext));
      sc.text([L / 2, Bext + 12 * u], 'Vue en plan (piédroits en traits cachés)', { h: 10, color: DIM });
    }
    return sc;
  }

  /* ───────── Barres en coupe ───────── */
  /* ───────── Trajets cintrés ─────────
     Un trajet est une liste de sommets {p:[x,y], b} où b est le « bulge » DXF du segment
     qui part de ce sommet : b = tan(angle balayé / 4), positif dans le sens trigonométrique
     (repère y vers le haut). b = 0 : segment droit. */

  /* Arrondit les angles d'une polyligne avec un rayon R (rayon à l'axe). */
  function filletPath(pts, R) {
    const n = pts.length, out = [{ p: pts[0].slice(), b: 0 }];
    for (let i = 1; i < n - 1; i++) {
      const P = pts[i], A = pts[i - 1], C = pts[i + 1];
      const v1 = [P[0] - A[0], P[1] - A[1]], v2 = [C[0] - P[0], C[1] - P[1]];
      const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
      if (l1 < 1e-9 || l2 < 1e-9) continue;
      const u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2];
      const cr = u1[0] * u2[1] - u1[1] * u2[0], th = Math.atan2(Math.abs(cr), u1[0] * u2[0] + u1[1] * u2[1]);
      if (th < 1e-4 || th > Math.PI - 1e-3) { out.push({ p: P.slice(), b: 0 }); continue; }
      // longueur de tangente bornée par les segments voisins (moitié, ou totalité aux extrémités)
      const tmax = Math.min(l1 * (i === 1 ? 0.98 : 0.5), l2 * (i === n - 2 ? 0.98 : 0.5));
      const t = Math.min(R * Math.tan(th / 2), tmax);
      out.push({ p: [P[0] - u1[0] * t, P[1] - u1[1] * t], b: Math.sign(cr) * Math.tan(th / 4) });
      out.push({ p: [P[0] + u2[0] * t, P[1] + u2[1] * t], b: 0 });
    }
    out.push({ p: pts[n - 1].slice(), b: 0 });
    return out;
  }

  /* Points d'un arc défini par sa corde A→B et son bulge. */
  function arcPts(A, B, b, k) {
    const th = 4 * Math.atan(b), cx = (A[0] + B[0]) / 2, cy = (A[1] + B[1]) / 2;
    const dx = B[0] - A[0], dy = B[1] - A[1], c = Math.hypot(dx, dy);
    const h = c / 2 / Math.tan(th / 2); // distance signée du milieu de corde au centre
    const O = [cx - dy / c * h, cy + dx / c * h], r = Math.hypot(A[0] - O[0], A[1] - O[1]);
    const a0 = Math.atan2(A[1] - O[1], A[0] - O[0]), out = [];
    for (let i = 1; i <= k; i++) { const t = a0 + th * i / k; out.push([O[0] + r * Math.cos(t), O[1] + r * Math.sin(t)]); }
    return out;
  }
  /* Échantillonne un trajet (pour les emprises, la longueur, les croquis DXF…). */
  function samplePath(path, k) {
    const pts = [path[0].p];
    for (let i = 0; i < path.length - 1; i++) {
      if (Math.abs(path[i].b) > 1e-9) arcPts(path[i].p, path[i + 1].p, path[i].b, k || 8).forEach((q) => pts.push(q));
      else pts.push(path[i + 1].p);
    }
    return pts;
  }
  /* Longueur exacte d'un trajet (arcs compris). */
  function pathLength(path) {
    let L = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const A = path[i].p, B = path[i + 1].p, c = Math.hypot(B[0] - A[0], B[1] - A[1]), b = path[i].b;
      if (Math.abs(b) < 1e-9) L += c;
      else { const th = Math.abs(4 * Math.atan(b)); L += th * c / (2 * Math.sin(th / 2)); }
    }
    return L;
  }
  /* Crosse d'extrémité : arc de rayon R balayant alpha à partir de P (direction dirDeg), puis retour droit. */
  function hookArc(P, dirDeg, side, alpha, R, straight) {
    const ux = Math.cos(rad(dirDeg)), uy = Math.sin(rad(dirDeg));
    const nx = side > 0 ? -uy : uy, ny = side > 0 ? ux : -ux;
    const C = [P[0] + nx * R, P[1] + ny * R], sw = side * rad(alpha);
    const vx = P[0] - C[0], vy = P[1] - C[1];
    const Q = [C[0] + vx * Math.cos(sw) - vy * Math.sin(sw), C[1] + vx * Math.sin(sw) + vy * Math.cos(sw)];
    const fd = rad(dirDeg + side * alpha);
    return { b: Math.sign(side) * Math.tan(rad(alpha) / 4), Q, E: [Q[0] + straight * Math.cos(fd), Q[1] + straight * Math.sin(fd)] };
  }

  /* Trajet d'une barre (axe), angles cintrés au mandrin et crosses comprises. */
  function barPath(bar, item, params) {
    const dm = bar.d / 1000, D = F.mandrin(bar.d, params.norme), R = D / 2 + dm / 2;
    const segs = bar.segs, n = segs.length, hooks = bar.hooks || [0, 0], sides = bar.sides || [1, -1];
    const tr = (a) => { if (item.mx) a = 180 - a; if (item.my) a = -a; return a; };
    const sideF = (item.mx ? -1 : 1) * (item.my ? -1 : 1);
    let main, dirS, dirE, sS = sides[0] * sideF, sE = sides[1] * sideF;
    if (item.pts) {
      // trajet donné à l'axe ; les extrémités à crosse sont raccourcies de (D/2 + Ø)
      main = item.pts.map((q) => q.slice());
      const cut = (P, Q, d) => { const v = [Q[0] - P[0], Q[1] - P[1]], l = Math.hypot(v[0], v[1]) || 1, k = Math.min(d, l * 0.9) / l; P[0] += v[0] * k; P[1] += v[1] * k; };
      if (hooks[0]) cut(main[0], main[1], D / 2 + dm);
      if (hooks[1]) cut(main[main.length - 1], main[main.length - 2], D / 2 + dm);
      const ang = (P, Q) => Math.atan2(Q[1] - P[1], Q[0] - P[0]) * 180 / Math.PI;
      dirS = ang(main[0], main[1]); dirE = ang(main[main.length - 2], main[main.length - 1]);
      if (item.hs) { sS = item.hs[0]; sE = item.hs[1]; }
    } else {
      const lens = segs.map((s, i) => {
        let l = s.l;
        if (i > 0 && F.deviation(segs[i - 1].a, s.a) > 1e-6) l -= dm / 2;
        if (i < n - 1 && F.deviation(s.a, segs[i + 1].a) > 1e-6) l -= dm / 2;
        if (i === 0 && hooks[0]) l -= D / 2 + dm;
        if (i === n - 1 && hooks[1]) l -= D / 2 + dm;
        if (item.shrink && item.shrink.seg === i) l -= item.shrink.by;
        return Math.max(l, 0.005);
      });
      let x = item.x0, y = item.y0;
      if (hooks[0]) { const a0 = rad(tr(segs[0].a)); x += (D / 2 + dm) * Math.cos(a0); y += (D / 2 + dm) * Math.sin(a0); }
      main = [[x, y]];
      segs.forEach((s, i) => { const a = rad(tr(s.a)); x += lens[i] * Math.cos(a); y += lens[i] * Math.sin(a); main.push([x, y]); });
      dirS = tr(segs[0].a); dirE = tr(segs[n - 1].a);
    }
    const path = filletPath(main, R);
    if (hooks[1]) {
      const h = hookArc(main[main.length - 1], dirE, sE, hooks[1], R, F.hookStraight(hooks[1], dm, params.norme));
      path[path.length - 1].b = h.b; path.push({ p: h.Q, b: 0 }, { p: h.E, b: 0 });
    }
    if (hooks[0]) {
      const h = hookArc(main[0], dirS + 180, sS, hooks[0], R, F.hookStraight(hooks[0], dm, params.norme));
      path.unshift({ p: h.E, b: 0 }, { p: h.Q, b: -h.b });
    }
    return { path, main, pts: samplePath(path), R };
  }

  function dotPositions(bar) {
    const n = F.barCount(bar), out = [];
    (bar.place.dots || []).forEach((ln) => {
      const pts = [];
      if (ln.mode === 'poly') {
        const P = ln.pts, cum = [0];
        for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
        const T = cum[cum.length - 1];
        for (let i = 0; i < n; i++) {
          const s = n === 1 ? T / 2 : T * i / (n - 1);
          let k = 1; while (k < P.length - 1 && cum[k] < s) k++;
          const t = (s - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
          pts.push([P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t]);
        }
      } else if (ln.mode === 'stepY') {
        const [A, B] = ln.line;
        for (let i = 0; i < n; i++) { const y = ln.y0 - bar.esp * i; pts.push([A[0] + (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]), y]); }
      } else if (ln.mode === 'step') {
        for (let i = 0; i < n; i++) pts.push([ln.a[0] + ln.dir[0] * bar.esp * i, ln.a[1] + ln.dir[1] * bar.esp * i]);
      } else {
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          pts.push([ln.a[0] + (ln.b[0] - ln.a[0]) * t, ln.a[1] + (ln.b[1] - ln.a[1]) * t]);
        }
      }
      out.push(pts);
    });
    return out;
  }

  /* Répartit des bulles de repère sur deux colonnes, sans chevauchement. */
  function placeBubbles(tags, bb, u, R) {
    // côté le plus proche, puis rééquilibrage si un côté est trop chargé
    const cx = (bb[0] + bb[2]) / 2;
    const left = tags.filter((t) => t.p[0] < cx).sort((a, b) => b.p[0] - a.p[0]);
    const right = tags.filter((t) => t.p[0] >= cx).sort((a, b) => a.p[0] - b.p[0]);
    while (left.length > right.length + 2) right.push(left.shift());
    while (right.length > left.length + 2) left.push(right.shift());
    const sidesOut = [left, right];
    const gapM = (2 * R + 6) * u;
    sidesOut.forEach((list, k) => {
      list.sort((a, b) => b.p[1] - a.p[1]);
      const x = k === 0 ? bb[0] - 34 * u : bb[2] + 34 * u;
      let y = Infinity;
      list.forEach((t) => { y = Math.min(t.p[1], y - gapM); t.b = [x, y]; });
      const lowest = list.length ? list[list.length - 1].b[1] : 0;
      const floor = bb[1] - 4 * u;
      if (lowest < floor) {
        let shift = floor - lowest;
        list.forEach((t) => { t.b[1] += shift; });
      }
    });
    return tags;
  }

  /* ───────── Vue 3 : coupe ferraillée ───────── */
  function ferraillageScene(struct, g, bars, params, u) {
    const sc = new Scene(u);
    drawOutline(sc, struct, g, true);
    const tags = [];
    bars.forEach((bar, i) => {
      const col = COLORS[i % COLORS.length];
      const pl = bar.place || {};
      if (pl.items) {
        pl.items.forEach((it, k) => {
          const bp = barPath(bar, it, params);
          sc.bar(bp.path, bar.d / 1000, { color: col, barId: bar.id, minPx: 1 }); // épaisseur = Ø réel à l'échelle
          if (k === 0 && pl.tag) {
            const s = Math.min(pl.tag.seg, bp.main.length - 2), a = bp.main[s], b = bp.main[s + 1];
            tags.push({ id: bar.id, col, p: [a[0] + (b[0] - a[0]) * pl.tag.t, a[1] + (b[1] - a[1]) * pl.tag.t] });
          }
        });
      }
      if (pl.dots) {
        const lines = dotPositions(bar);
        lines.forEach((pts) => pts.forEach((p) => sc.circle(p, bar.d / 2000, { layer: 'ACIERS', color: col, fill: col, stroke: false, w: 0, minPx: 1.2, barId: bar.id, hit: true })));
        const first = lines[0] || [];
        if (first.length) {
          let idx = pl.tag == null ? 0 : pl.tag;
          if (idx < 0) idx = first.length + idx;
          idx = Math.max(0, Math.min(first.length - 1, idx));
          tags.push({ id: bar.id, col, p: first[idx] });
        }
      }
    });
    const bb = bounds(sc), R = 10;
    placeBubbles(tags, bb, u, R);
    tags.forEach((t) => {
      const dx = t.p[0] - t.b[0], dy = t.p[1] - t.b[1], dl = Math.hypot(dx, dy) || 1;
      sc.poly([[t.b[0] + dx / dl * R * u, t.b[1] + dy / dl * R * u], t.p], { layer: 'REPERAGE', color: t.col, w: 0.8, barId: t.id });
      sc.circle(t.p, 1.8 * u, { layer: 'REPERAGE', color: t.col, fill: t.col, w: 0.5, barId: t.id });
      sc.circle(t.b, R * u, { layer: 'REPERAGE', color: t.col, fill: '#ffffff', w: 1.2, barId: t.id, hit: true });
      sc.text(t.b, t.id, { layer: 'REPERAGE', color: t.col, h: 11, weight: 500, barId: t.id });
    });
    return sc;
  }

  /* ───────── Croquis de façonnage (nomenclature) ───────── */
  /* Renvoie une géométrie en pixels (y vers le bas) tenant dans w × h. */
  function croquisGeom(shape, w, h) {
    let segs = shape.segs.map((s) => ({ l: s.l, a: s.a }));
    const hooks = shape.hooks || [0, 0], sides = shape.sides || [1, -1];
    if (segs.length === 1) segs[0].a = 0;
    const lmax = Math.max.apply(null, segs.map((s) => s.l));
    const dl = segs.map((s) => 0.32 + 0.68 * Math.sqrt(s.l / lmax));
    let x = 0, y = 0;
    const main = [[0, 0]];
    segs.forEach((s, i) => { x += dl[i] * Math.cos(rad(s.a)); y += dl[i] * Math.sin(rad(s.a)); main.push([x, y]); });
    const hk = 0.26;
    const hookPts = (P, dir, side, alpha) => {
      if (!alpha) return [];
      if (alpha === 180) {
        const ux = Math.cos(rad(dir)), uy = Math.sin(rad(dir)), nx = side > 0 ? -uy : uy, ny = side > 0 ? ux : -ux, r = 0.07, pts = [];
        const cx = P[0] + nx * r, cy = P[1] + ny * r, a0 = Math.atan2(P[1] - cy, P[0] - cx);
        for (let k = 1; k <= 8; k++) { const t = a0 + side * Math.PI * k / 8; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
        const l = pts[pts.length - 1];
        pts.push([l[0] - ux * hk * 0.7, l[1] - uy * hk * 0.7]);
        return pts;
      }
      const fd = rad(dir + side * alpha);
      return [[P[0] + hk * Math.cos(fd), P[1] + hk * Math.sin(fd)]];
    };
    const endH = hookPts(main[main.length - 1], segs[segs.length - 1].a, sides[1], hooks[1]);
    const startH = hookPts(main[0], segs[0].a + 180, sides[0], hooks[0]).reverse();
    const all = startH.concat(main, endH);
    // centroïde (pour placer les cotes à l'extérieur)
    const cx = all.reduce((s, p) => s + p[0], 0) / all.length, cy = all.reduce((s, p) => s + p[1], 0) / all.length;
    const sideLabels = segs.some((s) => Math.abs(Math.sin(rad(s.a))) > 0.7);
    const padX = sideLabels ? 30 : 10, padY = 13;
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    all.forEach((p) => { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
    const k = Math.min((w - 2 * padX) / Math.max(b[2] - b[0], 1e-6), (h - 2 * padY) / Math.max(b[3] - b[1], 1e-6));
    const ox = (w - (b[2] - b[0]) * k) / 2, oy = (h - (b[3] - b[1]) * k) / 2;
    const P = (p) => [ox + (p[0] - b[0]) * k, h - (oy + (p[1] - b[1]) * k)];
    const texts = segs.map((s, i) => {
      const a = main[i], c = main[i + 1], mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2;
      let nx = -Math.sin(rad(s.a)), ny = Math.cos(rad(s.a));
      const dot = nx * (mx - cx) + ny * (my - cy);
      if (dot < -1e-9 || (Math.abs(dot) < 1e-9 && ny < 0)) { nx = -nx; ny = -ny; }
      const q = P([mx, my]), off = 7;
      const tx = q[0] + nx * off, ty = q[1] - ny * off;
      const anchor = Math.abs(nx) > 0.7 ? (nx > 0 ? 'start' : 'end') : 'middle';
      return { x: tx, y: ty + (Math.abs(nx) > 0.7 ? 0 : -ny * 2), s: F.fmtCote(shape.segs[i].l), anchor };
    });
    // évite le chevauchement des cotes : décale le long de la normale tant qu'il y a collision
    const box = (t) => { const tw = t.s.length * 5.4, x0 = t.anchor === 'start' ? t.x : t.anchor === 'end' ? t.x - tw : t.x - tw / 2; return [x0, t.y - 5.5, x0 + tw, t.y + 5.5]; };
    const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    texts.forEach((t, i) => {
      for (let k = 0; k < 4 && texts.slice(0, i).some((o) => hit(box(t), box(o))); k++) {
        if (t.anchor === 'middle') t.y += (t.y < h / 2 ? -1 : 1) * 10; else t.x += t.anchor === 'start' ? 10 : -10;
      }
    });
    const ptsPx = all.map(P);
    // angles arrondis (croquis schématique : rayon d'affichage fixe, proportionné au dessin)
    const path = filletPath(ptsPx, Math.min(5, Math.max(2, 0.045 * k)));
    return { w, h, pts: ptsPx, path, texts };
  }

  function croquisSVG(shape, color, w, h) {
    w = w || 150; h = h || 56;
    const gm = croquisGeom(shape, w, h);
    let d = 'M' + gm.path[0].p[0].toFixed(1) + ' ' + gm.path[0].p[1].toFixed(1);
    for (let i = 0; i < gm.path.length - 1; i++) {
      const A = gm.path[i].p, B = gm.path[i + 1].p, bu = gm.path[i].b;
      if (Math.abs(bu) < 1e-9) d += 'L' + B[0].toFixed(1) + ' ' + B[1].toFixed(1);
      else { const th = Math.abs(4 * Math.atan(bu)), r = (Math.hypot(B[0] - A[0], B[1] - A[1]) / (2 * Math.sin(th / 2))).toFixed(2); d += `A${r} ${r} 0 0 ${bu > 0 ? 1 : 0} ${B[0].toFixed(1)} ${B[1].toFixed(1)}`; }
    }
    const t = gm.texts.map((x) => `<text x="${x.x.toFixed(1)}" y="${x.y.toFixed(1)}" font-size="9.5" text-anchor="${x.anchor}" dominant-baseline="central" fill="#14171f">${x.s}</text>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Outfit, Arial, sans-serif" aria-hidden="true"><path d="${d}" fill="none" stroke="${color || '#c0392b'}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="butt"/>${t}</svg>`;
  }

  return { COLORS, Scene, bounds, toSVG, fitScale, fitRender, filletPath, samplePath, pathLength, arcPts, coffrageScene, secondScene, ferraillageScene, croquisGeom, croquisSVG, barPath, dotPositions, outline };
});
