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
  /* Code couleur ADFER de KLE : la couleur dépend du diamètre (barres et points d'un repère). ACI dans le DXF ;
     à l'écran, RVB des ACI rendus lisibles sur fond clair (jaune, vert, cyan, magenta foncés ; ACI 7 en noir). */
  const RED = '#e0302a', ZIG = '#a3a01c';
  const ACI_WEB = { 1: '#ff0000', 2: '#c9a800', 3: '#1fb41f', 4: '#00a8c8', 5: '#0000ff', 6: '#d000d0', 7: '#1a1a1a', 8: '#808080', 9: '#9a9a9a', 10: '#e03030' };
  const aciOf = (d) => F.COULEUR_ACI[d] || 7;
  function barColor(bar) { return ACI_WEB[aciOf(bar.d)]; }
  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1]], vadd = (a, b) => [a[0] + b[0], a[1] + b[1]], vmul = (a, k) => [a[0] * k, a[1] * k];
  const vunit = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
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
        const cls = it.cls ? ` class="${it.cls}"` : '', db = it.barId ? ` data-bar="${it.barId}"` : '';
        if (it.hitW) out += `<path d="${d}" fill="none" stroke="transparent" stroke-width="${it.hitW}" pointer-events="stroke"${db}/>`;
        out += `<path d="${d}" fill="${it.fill || 'none'}"${it.holes ? ' fill-rule="evenodd"' : ''} stroke="${it.stroke === false ? 'none' : it.color}" stroke-width="${it.w}"${it.dash ? ` stroke-dasharray="${it.dash}"` : ''} stroke-linejoin="round" stroke-linecap="${it.cap || 'round'}"${cls}${db}/>`;
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
        out += `<g data-bar="${it.barId}"><path d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(14, +w + 8)}" stroke-linecap="round" pointer-events="stroke"/><path class="bv" d="${d}" fill="none" stroke="${it.color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="butt"/></g>`;
      } else if (it.t === 'circle') {
        if (it.hit) out += `<circle cx="${X(it.c[0])}" cy="${Y(it.c[1])}" r="${Math.max(9, it.r * s).toFixed(1)}" fill="transparent" data-bar="${it.barId}"/>`;
        out += `<circle cx="${X(it.c[0])}" cy="${Y(it.c[1])}" r="${Math.max(it.minPx || 0, it.r * s).toFixed(2)}" fill="${it.fill || 'none'}" stroke="${it.stroke === false ? 'none' : it.color}" stroke-width="${it.w}"${it.cls ? ` class="${it.cls}"` : ''}${it.barId ? ` data-bar="${it.barId}"` : ''}/>`;
      } else if (it.t === 'text') {
        const tr = it.rot ? ` transform="rotate(${-it.rot} ${X(it.p[0])} ${Y(it.p[1])})"` : '';
        out += `<text x="${X(it.p[0])}" y="${Y(it.p[1])}" font-size="${it.h}" text-anchor="${it.anchor}" dominant-baseline="central" fill="${it.color}"${it.halo ? ' stroke="#ffffff" stroke-width="3" paint-order="stroke"' : ''}${it.weight ? ` font-weight="${it.weight}"` : ''}${it.italic ? ' font-style="italic"' : ''}${it.cls ? ` class="${it.cls}"` : ''}${it.barId ? ` data-bar="${it.barId}"` : ''}${tr}>${esc(it.s)}</text>`;
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
    const u = sc.u, gap = 3 * u, tk = 4 * u, L = { layer: 'KLE-Cotation', color: o.color || DIM, w: o.color ? 0.7 : 0.8, aci: o.aci };
    const TX = { color: o.color || INK, aci: o.aci, h: o.h || 11 }, TK = Object.assign({}, L, { color: o.color || INK });
    if (orient === 'h') {
      const [x1, x2] = [Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0])];
      const sgn = at < p1[1] ? -1 : 1;
      sc.line([p1[0], p1[1] + sgn * gap], [p1[0], at + sgn * 3 * u], L);
      sc.line([p2[0], p2[1] + sgn * gap], [p2[0], at + sgn * 3 * u], L);
      sc.line([x1, at], [x2, at], L);
      [x1, x2].forEach((x) => sc.line([x - tk, at - tk], [x + tk, at + tk], TK));
      const tw = txt.length * 11 * 0.56 * u;
      if (x2 - x1 > tw + 8 * u) sc.text([(x1 + x2) / 2, at + 8 * u], txt, TX);
      else sc.text([o.flip ? x1 - 5 * u : x2 + 5 * u, at + 8 * u], txt, Object.assign({}, TX, { anchor: o.flip ? 'end' : 'start' }));
    } else {
      const [y1, y2] = [Math.min(p1[1], p2[1]), Math.max(p1[1], p2[1])];
      const sgn = at < p1[0] ? -1 : 1;
      sc.line([p1[0] + sgn * gap, p1[1]], [at + sgn * 3 * u, p1[1]], L);
      sc.line([p2[0] + sgn * gap, p2[1]], [at + sgn * 3 * u, p2[1]], L);
      sc.line([at, y1], [at, y2], L);
      [y1, y2].forEach((y) => sc.line([at - tk, y - tk], [at + tk, y + tk], TK));
      const tw = txt.length * 11 * 0.56 * u;
      if (y2 - y1 > tw + 8 * u) sc.text([at + (o.out ? sgn : -1) * 8 * u, (y1 + y2) / 2], txt, Object.assign({}, TX, { rot: 90 }));
      else { // cote trop courte : texte horizontal, à l'extérieur de la ligne de cote
        const out = sgn < 0 ? -1 : 1;
        sc.text([at + out * 5 * u, (y1 + y2) / 2], txt, Object.assign({}, TX, { anchor: out < 0 ? 'end' : 'start' }));
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
    const dm = F.encM(bar.d), D = F.mandrin(bar.d, params.norme), R = D / 2 + dm / 2; // nu intérieur au mandrin, axe à Ø encombrement / 2
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
      const h = hookArc(main[main.length - 1], dirE, sE, hooks[1], R, F.hookStraight(hooks[1], bar.d / 1000, params.norme));
      path[path.length - 1].b = h.b; path.push({ p: h.Q, b: 0 }, { p: h.E, b: 0 });
    }
    if (hooks[0]) {
      const h = hookArc(main[0], dirS + 180, sS, hooks[0], R, F.hookStraight(hooks[0], bar.d / 1000, params.norme));
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

  /* ───────── Repérage façon plans KLE ─────────
     Barres façonnées : bulle cerclée rangée en colonne à gauche ou à droite de la coupe, ligne d'attache
     orthogonale (horizontale depuis la bulle, coude à 90° si besoin) terminée par une flèche pleine posée
     sur la barre ; texte de quantité « 60HA10 » au-dessus du premier segment.
     Barres réparties (points) : pas de bulle ; marqueur rouge en équerre à chaque extrémité de rangée.
     Le côté d'approche est choisi en lançant des rayons depuis le point d'attache vers le contour du béton. */

  /* Distance t > 0 du premier bord de polygone rencontré par le rayon P + t·d (d unitaire). */
  function rayHit(P, d, polys) {
    let best = Infinity;
    polys.forEach((poly) => {
      for (let i = 0; i < poly.length; i++) {
        const A = poly[i], B = poly[(i + 1) % poly.length], ex = B[0] - A[0], ey = B[1] - A[1];
        const den = d[0] * ey - d[1] * ex;
        if (Math.abs(den) < 1e-12) continue;
        const ax = A[0] - P[0], ay = A[1] - P[1], t = (ax * ey - ay * ex) / den, q = (ax * d[1] - ay * d[0]) / den;
        if (t > 1e-7 && q >= -1e-9 && q <= 1 + 1e-9) best = Math.min(best, t);
      }
    });
    return best;
  }
  const segFree = (A, B, polys) => { const v = vsub(B, A), l = Math.hypot(v[0], v[1]); return l < 1e-9 || rayHit(A, vmul(v, 1 / l), polys) >= l - 1e-9; };

  /* Marqueurs rouges aux extrémités des rangées de points : trait perpendiculaire vers le parement le plus
     proche (jusqu'au-delà du béton) puis petit retour vers l'intérieur de la rangée, numéro à côté. */
  function rowMarkers(sc, rows, polys) {
    const u = sc.u, boxes = [];
    const boxOf = (T, txt, anchor) => { const w = txt.length * 9 * 0.56 * u, h = 9 * u, x0 = anchor === 'start' ? T[0] : anchor === 'end' ? T[0] - w : T[0] - w / 2; return [x0 - u, T[1] - h / 2, x0 + w + u, T[1] + h / 2]; };
    const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    rows.forEach((rw) => {
      const P = rw.pts; if (!P.length) return;
      const ends = P.length === 1 ? [[P[0], rw.dir || [1, 0]]] : [[P[0], vunit(vsub(P[0], P[1]))], [P[P.length - 1], vunit(vsub(P[P.length - 1], P[P.length - 2]))]];
      ends.forEach(([E, d]) => {
        const n1 = [-d[1], d[0]], n2 = [d[1], -d[0]], t1 = rayHit(E, n1, polys), t2 = rayHit(E, n2, polys);
        const n = t1 <= t2 ? n1 : n2, t = Math.min(t1, t2, 0.6);
        const A = vadd(E, vmul(n, rw.r + 1.5 * u)), B = vadd(E, vmul(n, Math.max(t + 6 * u, rw.r + 9 * u))), C = vadd(B, vmul(d, -8 * u));
        sc.poly([A, B, C], { layer: 'REPERAGE', color: RED, aci: 1, w: 0.9, barId: rw.id, cls: 'mk', hitW: 8, cap: 'butt' });
        const along = Math.abs(d[0]) > Math.abs(d[1]); // rangée plutôt horizontale : numéro au-dessus/au-dessous du retour
        let T = along ? vadd(C, vadd(vmul(d, -4 * u), vmul(n, 5 * u))) : vadd(C, vadd(vmul(d, -3 * u), vmul(n, 7 * u)));
        const anchor = along ? 'middle' : (n[0] < 0 ? 'end' : 'start');
        // numéro déjà occupé par un autre marqueur : on l'écarte le long de la rangée, vers l'intérieur
        for (let k = 0; k < 4 && boxes.some((b) => hit(b, boxOf(T, rw.id, anchor))); k++) T = vadd(T, vmul(d, -9 * u));
        boxes.push(boxOf(T, rw.id, anchor));
        sc.text(T, rw.id, { layer: 'REPERAGE', color: RED, aci: 1, h: 9, barId: rw.id, cls: 'mkt', anchor });
      });
    });
  }

  /* Bulles, lignes d'attache orthogonales, flèches et quantités. tags : {id, p, dir, wM, qty}. */
  function placeReperes(sc, tags, polys, obst) {
    const u = sc.u, R = 10, G = (2 * R + 5) * u, LV = 22 * u;
    const bb = bounds(sc), cx = (bb[0] + bb[2]) / 2, W = bb[2] - bb[0];
    const colX = [bb[0] - (R + 46) * u, bb[2] + (R + 46) * u];
    // rayon libre : sortie du béton sans y rentrer plus loin (sinon la ligne traverserait un vide ou un autre élément)
    const ray = (P, d) => { const t = rayHit(P, d, polys); return { t, ok: isFinite(t) && !isFinite(rayHit(vadd(P, vmul(d, t + 1e-4)), d, polys)) }; };
    const pick = (A, B) => (A.ok && B.ok ? (A.t <= B.t ? 0 : 1) : A.ok ? 0 : B.ok ? 1 : (A.t <= B.t ? 0 : 1));
    const nearH = Math.max(0.35, 0.14 * W);
    const vertOf = (t, P) => { const D = ray(P, [0, -1]), U = ray(P, [0, 1]), k = pick(D, U); t.vert = k ? 1 : -1; t.reach = k ? P[1] + U.t : P[1] - D.t; return { D, U, k }; };
    const sideUp = (t, P) => { // côté d'où l'horizontale au-dessus de l'élément ne recoupe pas le béton
      const y = t.reach + 16 * u, f0 = segFree([P[0], y], [colX[0], y], polys), f1 = segFree([P[0], y], [colX[1], y], polys);
      return f0 && !f1 ? 0 : f1 && !f0 ? 1 : (P[0] - bb[0] <= bb[2] - P[0] ? 0 : 1);
    };
    const toHB = (t) => { t.kind = 'HB'; const r = vertOf(t, t.p); if (r.D.ok) { t.vert = -1; t.reach = t.p[1] - r.D.t; } /* par dessous de préférence */ t.side = t.vert < 0 ? (t.p[0] < cx ? 0 : 1) : sideUp(t, t.p); delete t.want; };
    // point d'attache dégagé : aucune autre barre ne croise ce point (sinon la flèche tomberait sur elle)
    const clear = (P, id, wM) => !(obst || []).some((o) => {
      if (o.id === id) return false; // une barre tangente (distance = somme des demi-épaisseurs) ne gêne pas
      const ab = vsub(o.b, o.a), L2 = ab[0] * ab[0] + ab[1] * ab[1], k = L2 ? Math.max(0, Math.min(1, ((P[0] - o.a[0]) * ab[0] + (P[1] - o.a[1]) * ab[1]) / L2)) : 0;
      return Math.hypot(P[0] - o.a[0] - ab[0] * k, P[1] - o.a[1] - ab[1] * k) < o.h + 0.25 * (wM || 0);
    });
    const orig = tags.map((t) => ({ p: t.p.slice(), dir: t.dir.slice() }));
    const layout = () => {
      tags.forEach((t, i) => { t.p = orig[i].p.slice(); t.dir = orig[i].dir.slice(); ['kind', 'side', 'want', 'near', 'vert', 'reach', 'ub', 'lb', 'by'].forEach((k) => delete t[k]); });
      tags.forEach((t) => {
        const d = t.dir;
        if (Math.abs(d[1]) >= Math.abs(d[0])) { // barre verticale à cet endroit : arrivée horizontale
          if (!clear(t.p, t.id, t.wM)) {
            const alt = [0.6, 0.5, 0.7, 0.4, 0.8, 0.3, 0.85, 0.2].sort((x, y) => Math.abs(x - t.t0) - Math.abs(y - t.t0))
              .map((tt) => vadd(t.a, vmul(vsub(t.b, t.a), tt))).find((Q) => clear(Q, t.id, t.wM));
            if (alt) t.p = alt;
          }
          const P = t.p, Lr = ray(P, [-1, 0]), Rr = ray(P, [1, 0]), k = pick(Lr, Rr), near = k ? Rr : Lr;
          if (near.ok && near.t <= nearH && !t.forceHB) { t.kind = 'H'; t.side = k; t.want = P[1]; t.near = near.t; } else toHB(t);
          return;
        }
        // barre horizontale : bulle hors du béton si l'élément est mince, sinon attache locale (voile) ;
        // le point d'attache glisse le long du segment pour éviter un passage sous le voile
        const ts = [t.t0].concat([0.5, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88].filter((x) => Math.abs(x - t.t0) > 0.02).sort((x, y) => Math.abs(x - t.t0) - Math.abs(y - t.t0)));
        // segment d'origine d'abord, puis les autres segments plutôt horizontaux de la barre, du plus proche au plus lointain
        const M = t.main || [t.a, t.b], s0 = t.seg || 0, segs = [];
        for (let k = 0; k < M.length - 1; k++) { const v = vsub(M[k + 1], M[k]); if (k === s0 || Math.abs(v[0]) > Math.abs(v[1])) segs.push(k); }
        segs.sort((x, y) => Math.abs(x - s0) - Math.abs(y - s0));
        for (const k of segs) for (const tt of ts) {
          const P = vadd(M[k], vmul(vsub(M[k + 1], M[k]), tt)), r = vertOf(t, P), c = r.k ? r.U : r.D;
          if (c.ok && c.t <= 0.6 && (r.D.t + r.U.t <= 1.2 || (!r.k && c.t <= 0.25) || c.t <= 0.12) && clear(P, t.id, t.wM)) { t.p = P; t.dir = vunit(vsub(M[k + 1], M[k])); t.kind = 'V'; t.side = t.vert < 0 ? (P[0] < cx ? 0 : 1) : sideUp(t, P); return; }
        }
        const Lr = ray(t.p, [-1, 0]), Rr = ray(t.p, [1, 0]);
        t.kind = 'VL'; t.side = pick(Lr, Rr); t.want = t.p[1] - 30 * u; delete t.vert;
      });
      // deux arrivées horizontales à la même hauteur du même côté : la plus éloignée du parement passe par dessous
      tags.filter((t) => t.kind === 'H').sort((a, b) => a.near - b.near).forEach((t, i, arr) => {
        if (arr.slice(0, i).some((o) => o.kind === 'H' && o.side === t.side && Math.abs(o.p[1] - t.p[1]) < G)) toHB(t);
      });
      const xv = (t) => (t.kind === 'HB' ? t.p[0] + (t.side ? 1 : -1) * 8 * u : t.p[0]); // abscisse du tronçon vertical
      // niveaux des attaches passant sous (ou au-dessus de) la coupe : la plus proche de la colonne au niveau
      // le plus proche du béton, pour qu'aucune ligne n'en croise une autre
      [0, 1].forEach((sd) => [-1, 1].forEach((vt) => {
        const grp = tags.filter((t) => t.side === sd && t.vert === vt && (t.kind === 'V' || t.kind === 'HB'))
          .sort((a, b) => Math.abs(xv(a) - colX[sd]) - Math.abs(xv(b) - colX[sd]));
        let y = vt < 0 ? bb[1] - 16 * u + LV : -Infinity;
        grp.forEach((t) => {
          if (vt < 0) { y -= LV; t.want = y; t.ub = y; }
          else { y = Math.max(t.reach + 16 * u, y + LV); t.want = y; t.lb = y; }
        });
      }));
      // colonnes : espacement régulier sans chevauchement (descente puis remontée pour les bornes basses)
      [0, 1].forEach((sd) => {
        const list = tags.filter((t) => t.side === sd).sort((a, b) => b.want - a.want);
        list.forEach((t, i) => { t.by = i ? Math.min(t.want, list[i - 1].by - G) : t.want; if (t.ub != null) t.by = Math.min(t.by, t.ub); });
        for (let i = list.length - 1; i >= 0; i--) {
          const t = list[i]; let y = t.by;
          if (t.lb != null) y = Math.max(y, t.lb);
          if (i < list.length - 1) y = Math.max(y, list[i + 1].by + G);
          t.by = y;
        }
      });
      tags.forEach((t) => {
        const s = t.side ? 1 : -1, X = colX[t.side], E = [X - s * R * u, t.by], P = t.p, h = t.wM / 2;
        let path;
        if (t.kind === 'H' || t.kind === 'HB') {
          const T = [P[0] + s * h, P[1]];
          if (t.kind === 'H' && Math.abs(t.by - P[1]) < 0.5 * u) path = [E, T];
          else { const xk = t.kind === 'H' ? X - s * (R + 42) * u : P[0] + s * 8 * u; path = [E, [xk, t.by], [xk, P[1]], T]; }
        } else {
          const v = t.by < P[1] ? -1 : 1;
          path = [E, [P[0], t.by], [P[0], P[1] + v * h]];
        }

        t.path = path;
      });
    };
    // résolution des croisements : une arrivée horizontale qui croise une autre attache passe par dessous
    const segX = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d), e = 1e-12; return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e)); };
    const crossPair = () => { for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) { const A = tags[i].path, B = tags[j].path; for (let a = 0; a < A.length - 1; a++) for (let b = 0; b < B.length - 1; b++) if (segX(A[a], A[a + 1], B[b], B[b + 1])) return [tags[i], tags[j]]; } return null; };
    layout();
    for (let it = 0; it < 6; it++) {
      const pr = crossPair(); if (!pr) break;
      const h = pr.filter((t) => t.kind === 'H').sort((a, b) => (b.path.length - a.path.length) || (b.near - a.near))[0];
      if (!h) break;
      h.forceHB = true; layout();
    }
    tags.forEach((t) => {
      const s = t.side ? 1 : -1, X = colX[t.side], E = [X - s * R * u, t.by], path = t.path;
      const o = { layer: 'REPERAGE', color: INK, barId: t.id };
      sc.poly(path, Object.assign({ w: 0.8, cls: 'rp', hitW: 8, cap: 'butt' }, o));
      const T = path[path.length - 1], v = vunit(vsub(T, path[path.length - 2])), n = [-v[1], v[0]], B0 = vsub(T, vmul(v, 7 * u));
      sc.poly([T, vadd(B0, vmul(n, 2.6 * u)), vsub(B0, vmul(n, 2.6 * u))], Object.assign({ closed: true, fill: INK, w: 0.4, cls: 'rpf', solid: true }, o));
      sc.circle([X, t.by], R * u, Object.assign({ fill: '#ffffff', w: 0.9, hit: true, cls: 'bub' }, o));
      sc.text([X, t.by], t.id, Object.assign({ h: 11, cls: 'bt' }, o));
      sc.text([E[0] - s * 3 * u, t.by + 6 * u], t.qty, Object.assign({ h: 8.5, cls: 'qt', anchor: s < 0 ? 'start' : 'end' }, o));
    });
    return tags;
  }

  /* Pastilles tangentes : chaque point qui empiète sur une barre façonnée (ou sur un point déjà placé d'un
     autre repère) est repoussé jusqu'au contact. Dans un coude, la poussée combinée de l'arc le place à
     l'intérieur du coude, tangent à la barre qui le porte. */
  function settleDot(c, r, obst, placed) {
    const q = c.slice(), cap = 4 * r + 0.03;
    for (let it = 0; it < 6; it++) {
      let moved = false;
      obst.forEach((o) => {
        const ab = vsub(o.b, o.a), L2 = ab[0] * ab[0] + ab[1] * ab[1], t = L2 ? Math.max(0, Math.min(1, ((q[0] - o.a[0]) * ab[0] + (q[1] - o.a[1]) * ab[1]) / L2)) : 0;
        const K = vadd(o.a, vmul(ab, t)), v = vsub(q, K), dist = Math.hypot(v[0], v[1]), need = o.h + r;
        if (dist < need - 1e-6) {
          // centre sur l'axe de la barre : poussée perpendiculaire, vers l'intérieur de la barre façonnée
          // centre dans l'épaisseur de la barre : on sort du côté intérieur de la forme (centroïde), sinon radialement
          const m = vunit([-ab[1], ab[0]]), side = (o.cen[0] - K[0]) * m[0] + (o.cen[1] - K[1]) * m[1];
          const n = (dist < o.h && Math.abs(side) > 1e-4) || dist <= 1e-7 ? (side >= 0 ? m : vmul(m, -1)) : vmul(v, 1 / dist);
          q[0] = K[0] + n[0] * need; q[1] = K[1] + n[1] * need; moved = true;
        }
      });
      placed.forEach((o) => {
        if (o.id === undefined) return;
        const v = vsub(q, o.c), dist = Math.hypot(v[0], v[1]), need = o.r + r;
        if (dist < need - 1e-6 && dist > 1e-9) { const k = (need - dist) / dist; q[0] += v[0] * k; q[1] += v[1] * k; moved = true; }
      });
      if (!moved) break;
    }
    return Math.hypot(q[0] - c[0], q[1] - c[1]) <= cap ? q : c;
  }
  const obstOf = (path, wM, id) => {
    const P = samplePath(path, 10), out = [], cen = vmul(P.reduce((a, q) => vadd(a, q), [0, 0]), 1 / P.length);
    for (let i = 0; i < P.length - 1; i++) out.push({ a: P[i], b: P[i + 1], h: wM / 2, cen, id });
    return out;
  };

  /* Symbole d'arrêt / de reprise : trait avec un zigzag au milieu. */
  function zigzag(sc, A, B) {
    const u = sc.u, d = vunit(vsub(B, A)), n = [-d[1], d[0]], M = vmul(vadd(A, B), 0.5), w = 5 * u, k = 6 * u;
    sc.poly([A, vsub(M, vmul(d, w)), vadd(vsub(M, vmul(d, w / 3)), vmul(n, k)), vsub(vadd(M, vmul(d, w / 3)), vmul(n, k)), vadd(M, vmul(d, w)), B],
      { layer: 'KLE-Cotation', color: ZIG, aci: 41, w: 0.9, cap: 'butt' });
  }

  /* Étiquettes de repérage d'une barre façonnée (une par position si la barre est présente à plusieurs endroits). */
  function tagsOf(bar, mains, params) {
    const tg = bar.place && bar.place.tag; if (!tg || typeof tg !== 'object') return [];
    const blocs = Math.max(1, Math.round((params && params.blocs) || 1));
    const qty = F.barCount(bar) * (bar.mult || 1) * blocs + (bar.type || 'HA') + bar.d;
    const all = mains.length > 1 && (bar.mult || 1) >= mains.length;
    return (all ? mains : mains.slice(0, 1)).map((m) => {
      let s = Math.min(tg.seg || 0, m.length - 2);
      if (tg.pick === 'v') { // segment le plus vertical (âme d'un U), à défaut le plus long
        let best = -1;
        for (let k = 0; k < m.length - 1; k++) { const v = vsub(m[k + 1], m[k]), l = Math.hypot(v[0], v[1]), sc = Math.abs(v[1]) / (l || 1) + l * 1e-3; if (sc > best) { best = sc; s = k; } }
      }
      const a = m[s], b = m[s + 1], t = tg.t == null ? 0.5 : tg.t;
      return { id: bar.id, qty, wM: F.encM(bar.d), p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: vunit(vsub(b, a)), a, b, t0: t, main: m, seg: s };
    });
  }

  /* ───────── Vue 3 : coupe ferraillée ───────── */
  /* Pastilles des barres réparties : disques cyan au Ø réel (minimum lisible). */
  const dotOpt = (bar) => ({ layer: 'ACIERS', color: barColor(bar), aci: aciOf(bar.d), fill: barColor(bar), stroke: false, w: 0, minPx: 0.9, barId: bar.id, hit: true, cls: 'dv' });

  /* Cotes générales en rouge, à l'extérieur du repérage (bb = emprise après repérage).
     Règle KLE : on ne cote que les grandeurs saisies (B, hs, e0 en tête, patin p, bêche), au format 2 décimales,
     plus la hauteur du voile Hv au-dessus de la semelle, dans la même chaîne que l'épaisseur de semelle ;
     une grandeur variable s'écrit « a à b ». Jamais de valeur déduite à 3 décimales (talon, eb…). */
  const f2 = (v) => { const x = Math.round(v * 1000) / 1000; return Math.abs(x * 100 - Math.round(x * 100)) > 1e-6 ? x.toFixed(3) : x.toFixed(2); }; // 2 décimales (3 si la saisie l'exige, ex. 0.475)
  const var2 = (a, b) => (Math.abs(a - b) < 0.005 ? f2(a) : f2(Math.min(a, b)) + ' à ' + f2(Math.max(a, b)));
  function redDims(sc, struct, g, bb) {
    const u = sc.u, o = { color: RED, aci: 1, h: 11.5 };
    if (struct === 'murT') {
      const { B, H, hs, hbp, xAvT, xAmT, p } = g, xl = bb[0] - 16 * u;
      dim(sc, [0, 0], [p, hs], 'v', xl, g.biseau ? var2(hbp, hs) : f2(hs), Object.assign({ flip: true }, o));
      dim(sc, [p, hs], [xAvT, H], 'v', xl, f2(H - hs), o);
      dim(sc, [xAvT, H], [xAmT, H], 'h', Math.max(H, bb[3]) + 14 * u, f2(g.e0), o);
      let y = bb[1] - 14 * u;
      if (p > 1e-6) { dim(sc, [0, 0], [p, hs], 'h', y, f2(p), Object.assign({ flip: true }, o)); y -= 24 * u; }
      if (g.beche) {
        dim(sc, [g.bx0, -g.bh], [g.bx1, -g.bh], 'h', y, f2(g.bw), o); y -= 24 * u;
        dim(sc, [g.bx1, -g.bh], [g.bx1, 0], 'v', bb[2] + 16 * u, f2(g.bh), Object.assign({ out: true, flip: true }, o));
      }
      dim(sc, [0, 0], [B, 0], 'h', y, f2(B), o);
    } else {
      dim(sc, [0, 0], [g.Bext, 0], 'h', bb[1] - 16 * u, f2(g.Bext), o);
      dim(sc, [g.Bext, 0], [g.Bext, g.Hext], 'v', bb[2] + 16 * u, f2(g.Hext), Object.assign({ out: true }, o));
    }
  }

  function ferraillageScene(struct, g, bars, params, u) {
    const sc = new Scene(u);
    drawOutline(sc, struct, g, true);
    const ol = outline(struct, g), polys = [ol.outer].concat(ol.holes);
    const tags = [], rows = [], obst = [], placed = [];
    bars.forEach((bar, i) => {
      const col = barColor(bar), pl = bar.place || {};
      if (pl.items) {
        const mains = pl.items.map((it) => {
          const bp = barPath(bar, it, params);
          sc.bar(bp.path, F.encM(bar.d), { color: col, aci: aciOf(bar.d), barId: bar.id, minPx: bar.maintien ? 1.8 : 1.5 }); // épaisseur = Ø d'encombrement à l'échelle
          obstOf(bp.path, F.encM(bar.d), bar.id).forEach((o) => obst.push(o));
          return bp.main;
        });
        tagsOf(bar, mains, params).forEach((t) => tags.push(t));
      }
    });
    bars.forEach((bar) => {
      const pl = bar.place || {};
      if (pl.dots) {
        const lines = dotPositions(bar), r0 = F.encM(bar.d) / 2;
        lines.forEach((pts0, k) => {
          const pts = pts0.map((q) => { const c = settleDot(q, r0, obst, placed.filter((o) => o.id !== bar.id)); placed.push({ id: bar.id, c, r: r0 }); return c; });
          pts.forEach((q) => sc.circle(q, r0, dotOpt(bar)));
          const ln = pl.dots[k], dir = ln && ln.a && ln.b ? vunit(vsub(ln.b, ln.a)) : ln && ln.pts ? vunit(vsub(ln.pts[ln.pts.length - 1], ln.pts[0])) : [1, 0];
          rows.push({ id: bar.id, pts, r: Math.max(r0, 0.9 * u), dir });
        });
      }
    });
    if (struct === 'murT') {
      // reprise de bétonnage voile / semelle, arrêt du renfort de pied
      zigzag(sc, [g.p, g.hs], [g.p + g.eb, g.hs]);
      // arrêts : tête des attentes (fin du recouvrement l0) et du renfort de pied
      bars.filter((b) => ['AttF', 'AttO', 'R'].includes(b.key) && b.place.items).forEach((b) => {
        const m = barPath(b, b.place.items[0], params).main, T = m[m.length - 1];
        zigzag(sc, [T[0] - 13 * u, T[1]], [T[0] + 13 * u, T[1]]);
      });
    }
    if (struct === 'murT' && g.xCut != null) {
      const yb = -(g.bp || 0) - 0.08, yt = g.hCut + 0.12, L = { layer: 'KLE-Cotation', color: DIM, w: 0.9, dash: '10 3 2 3' };
      sc.line([g.xCut, yb], [g.xCut, yt], L);
      sc.text([g.xCut, yt + 7 * u], 'A', { h: 10.5, weight: 500 });
      sc.text([g.xCut, yb - 7 * u], 'A', { h: 10.5, weight: 500 });
    }
    rowMarkers(sc, rows, polys);
    placeReperes(sc, tags, polys, obst);
    redDims(sc, struct, g, bounds(sc));
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


  /* ───────── Coupe longitudinale A-A de la semelle (mur) ─────────
     Plan vertical parallèle au mur, à l'abscisse g.xCut. Axe horizontal z le long du plot (0 → L),
     dessiné compact : les deux extrémités sur Ls ≈ 1,5 m, ligne de coupure au milieu. */
  function longiScene(struct, g, bars, params, u) {
    if (struct !== 'murT') return null;
    const sc = new Scene(u), L = g.L, hc = g.hCut, bp = g.bp || 0;
    const Ls = Math.min(1.5, L / 2), brk = L > 2 * Ls + 0.05, gap = brk ? 0.3 : 0;
    const wins = brk ? [[0, Ls], [L - Ls, L]] : [[0, L]];
    const Z = (z) => (brk && z > Ls + 1e-9 ? z - (L - 2 * Ls) + gap : z);
    const inWin = (z) => wins.some(([a, b]) => z >= a - 1e-9 && z <= b + 1e-9);
    const P = (q) => [Z(q[0]), q[1]];
    // béton (deux tronçons), coupure, propreté
    wins.forEach(([a, b]) => {
      sc.poly([[Z(a), 0], [Z(b), 0], [Z(b), hc], [Z(a), hc]], { closed: true, fill: CONCRETE, stroke: false, w: 0 });
      sc.line([Z(a), 0], [Z(b), 0], { w: 1.1 }); sc.line([Z(a), hc], [Z(b), hc], { w: 1.1 });
      if (bp > 0) { sc.poly([[Z(a), -bp], [Z(b), -bp]], { w: 0.8 }); hatchRect(sc, Z(a), -bp, Z(b), 0, Math.max(0.04, 9 * u)); }
    });
    sc.line([Z(0), 0], [Z(0), hc], { w: 1.1 }); sc.line([Z(L), 0], [Z(L), hc], { w: 1.1 });
    if (brk) [Ls, Ls + gap].forEach((zd) => {
      const y0 = -bp - 0.06, y1 = hc + 0.06, k = 0.04;
      sc.poly([[zd, y0], [zd, (y0 + y1) / 2 - k], [zd + k * 0.8, (y0 + y1) / 2 - k / 3], [zd - k * 0.8, (y0 + y1) / 2 + k / 3], [zd, (y0 + y1) / 2 + k], [zd, y1]], { w: 0.8, color: DIM, layer: 'KLE-Cotation' });
    });
    // découpe d'une polyligne (en z réel) suivant les fenêtres visibles
    const clip = (pts) => {
      const pieces = [];
      wins.forEach(([a, b]) => {
        let cur = [];
        for (let i = 0; i < pts.length; i++) {
          const q = pts[i], inside = q[0] >= a - 1e-9 && q[0] <= b + 1e-9;
          if (i > 0) {
            const o = pts[i - 1];
            [a, b].forEach((zb) => {
              if ((o[0] - zb) * (q[0] - zb) < -1e-12) { const t = (zb - o[0]) / (q[0] - o[0]), m = [zb, o[1] + (q[1] - o[1]) * t]; cur.push(m); if (!inside) { pieces.push(cur); cur = []; } }
            });
          }
          if (inside) cur.push(q.slice());
        }
        if (cur.length > 1) pieces.push(cur);
      });
      return pieces.filter((pc) => pc.length > 1);
    };
    const tags = [], rows = [], obst = [], placed = [];
    bars.forEach((bar, i) => {
      const lg = bar.longi; if (!lg) return;
      const col = barColor(bar), mains = [];
      (lg.items || []).forEach((it) => {
        const pcs = clip(it.pts);
        pcs.forEach((pc, k) => {
          const bp2 = barPath({ d: bar.d, hooks: [0, 0], segs: [{ l: 0, a: 0 }], sides: [1, -1] }, { pts: pc.map(P) }, params);
          sc.bar(bp2.path, F.encM(bar.d), { color: col, aci: aciOf(bar.d), barId: bar.id, minPx: bar.maintien ? 1.8 : 1.5 });
          obstOf(bp2.path, F.encM(bar.d), bar.id).forEach((o) => obst.push(o));
          if (k === 0) mains.push(bp2.main);
        });
      });
      if (mains.length) tagsOf(Object.assign({}, bar, { place: { tag: lg.tag || { seg: 0, t: 0.5 } } }), mains, params).forEach((t) => tags.push(t));
    });
    bars.forEach((bar) => {
      const lg = bar.longi; if (!lg) return;
      const n = F.barCount(bar), r0 = F.encM(bar.d) / 2, r = Math.max(r0, 0.9 * u);
      const put = (pts0) => pts0.map((q) => { const c = settleDot(q, r0, obst, placed.filter((o) => o.id !== bar.id)); placed.push({ id: bar.id, c, r: r0 }); sc.circle(c, r0, dotOpt(bar)); return c; });
      (lg.dotsZ || []).forEach((ln) => {
        const zs = []; for (let j = 0; j < n; j++) zs.push(n === 1 ? (ln.z0 + ln.z1) / 2 : ln.z0 + (ln.z1 - ln.z0) * j / (n - 1));
        rows.push({ id: bar.id, pts: put(zs.filter(inWin).map((z) => P([z, ln.y]))), r, dir: [1, 0] });
      });
      (lg.dotsY || []).forEach((ln) => {
        const pts = []; for (let j = 0; j < n; j++) pts.push(P([ln.z, n === 1 ? (ln.y0 + ln.y1) / 2 : ln.y0 + (ln.y1 - ln.y0) * j / (n - 1)]));
        rows.push({ id: bar.id, pts: put(pts), r, dir: [0, 1] });
      });
    });
    const polys = wins.map(([a, b]) => [[Z(a), 0], [Z(b), 0], [Z(b), hc], [Z(a), hc]]);
    rowMarkers(sc, rows, polys);
    placeReperes(sc, tags, polys, obst);
    const bb = bounds(sc);
    // cotes (épaisseur à la coupe, L du plot) et titre, à l'extérieur du repérage
    dim(sc, [Z(0), 0], [Z(0), hc], 'v', bb[0] - 16 * u, f2(hc), { flip: true, color: RED, aci: 1, h: 11.5 });
    dim(sc, [Z(0), hc], [Z(L), hc], 'h', bb[3] + 14 * u, 'L = ' + f2(L) + (brk ? ' (plot interrompu)' : ''), { color: RED, aci: 1, h: 11.5 });
    sc.text([(Z(0) + Z(L)) / 2, bb[1] - 12 * u], 'Coupe A-A — x = ' + F.fmtCote(g.xCut) + ' m depuis l’arête du patin', { h: 10, color: DIM, italic: true });
    return sc;
  }

  return { COLORS, ACI_WEB, barColor, rayHit, Scene, bounds, longiScene, toSVG, fitScale, fitRender, filletPath, samplePath, pathLength, arcPts, coffrageScene, secondScene, ferraillageScene, croquisGeom, croquisSVG, barPath, dotPositions, outline };
});
