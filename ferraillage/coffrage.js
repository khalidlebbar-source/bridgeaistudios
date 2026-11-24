/* BridgeAI Studios — Plans de coffrage : moteur commun.
 * - Chaque structure décrit ses paramètres et ses vues (géométrie en mètres, y vers le haut).
 * - Une vue est une liste d'éléments : contours de béton coupé ou vu, traits cachés, axes,
 *   cercles, cotes (avec le code du paramètre pour le schéma de principe), textes, terrain.
 * - Rendu SVG (saisie et plan), mise en page A3 → A0 à échelle automatique, cartouche A4,
 *   export DXF R12 (AC1009) et impression PDF.
 */
(function (root) {
  'use strict';

  /* ───────────────────────── Outils géométriques ───────────────────────── */
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const RECT = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const CIRC = (cx, cy, r, n) => { n = n || 48; const a = []; for (let k = 0; k < n; k++) { const t = 2 * Math.PI * k / n; a.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return a; };
  const ARC = (cx, cy, r, a0, a1, n) => { n = n || 16; const a = []; for (let k = 0; k <= n; k++) { const t = a0 + (a1 - a0) * k / n; a.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } return a; };
  const fmt = (v) => { const s = (Math.round(Math.abs(v) * 100) / 100).toFixed(2).replace('.', ','); return (v < 0 ? '-' : '') + s; };

  /* Constructeur de vue */
  function View(title, opt) {
    this.title = title; this.items = []; Object.assign(this, opt || {});
  }
  View.prototype.cut = function (pts, holes) { this.items.push({ t: 'poly', pts, holes, cut: true }); return this; };      // béton coupé
  View.prototype.seen = function (pts, holes) { this.items.push({ t: 'poly', pts, holes }); return this; };                // béton vu
  View.prototype.line = function (pts, st) { this.items.push({ t: 'line', pts, st: st || 'thin' }); return this; };        // st : thin | hidden | axis | thick
  View.prototype.circ = function (c, r, st) { this.items.push({ t: 'circ', c, r, st: st || 'thick' }); return this; };
  View.prototype.dim = function (a, b, off, k, txt) { this.items.push({ t: 'dim', a, b, off, k, txt }); return this; };
  View.prototype.dimH = function (a, b, at, k, txt) { this.items.push({ t: 'dim', o: 'h', a, b, at, k, txt }); return this; };   // cote horizontale, ligne à y = at
  View.prototype.dimV = function (a, b, at, k, txt) { this.items.push({ t: 'dim', o: 'v', a, b, at, k, txt }); return this; };   // cote verticale, ligne à x = at
  /* Chaînes de cotes : pts = points de la géométrie, keys = codes (facultatifs), total = cote globale décalée */
  View.prototype.chainH = function (pts, at, keys, totalAt, totalKey) { for (let i = 0; i + 1 < pts.length; i++) if (Math.abs(pts[i + 1][0] - pts[i][0]) > 1e-6) this.dimH(pts[i], pts[i + 1], at, keys && keys[i]); if (totalAt != null && pts.length > 2) this.dimH(pts[0], pts[pts.length - 1], totalAt, totalKey); return this; };
  View.prototype.chainV = function (pts, at, keys, totalAt, totalKey) { for (let i = 0; i + 1 < pts.length; i++) if (Math.abs(pts[i + 1][1] - pts[i][1]) > 1e-6) this.dimV(pts[i], pts[i + 1], at, keys && keys[i]); if (totalAt != null && pts.length > 2) this.dimV(pts[0], pts[pts.length - 1], totalAt, totalKey); return this; };
  View.prototype.text = function (p, s, h, opt) { this.items.push(Object.assign({ t: 'text', p, s, h: h || 2.5 }, opt || {})); return this; };
  View.prototype.ground = function (x1, x2, y) { this.items.push({ t: 'ground', x1, x2, y }); return this; };
  View.prototype.brk = function (x1, x2, y) { this.items.push({ t: 'brk', x1, x2, y }); return this; };
  /* Aciers : barre vue en long (polyligne), barres vues en bout (points), repère ADFER (bulle + texte) */
  View.prototype.bar = function (pts, d, rep) { this.items.push({ t: 'bar', pts, d, rep }); return this; };
  View.prototype.dots = function (pts, d, rep) { this.items.push({ t: 'dots', pts, d, rep }); return this; };
  View.prototype.rep = function (p, num, txt, side) { this.items.push({ t: 'rep', p, num, txt, side }); return this; };          // side : 'L' | 'R' (auto)
  View.prototype.dist = function (a, b, txt) { this.items.push({ t: 'dist', a, b, txt }); return this; };                       // répartition « 17 x 0.20 »
  View.prototype.brkV = function (x, y1, y2) { const m = (y1 + y2) / 2, z = Math.min(0.12, (y2 - y1) / 6); this.items.push({ t: 'line', pts: [[x, y1 - 0.08], [x, m - z], [x + z, m - z / 2], [x - z, m + z / 2], [x, m + z], [x, y2 + 0.08]], st: 'thin' }); return this; };                     // ligne de coupure

  /* Emprise d'une vue en mètres (cotes comprises), pour une échelle donnée (mm papier par m). */
  function bounds(v, k) {
    const b = baseBounds(v, k); if (!v.items.some((it) => it.t === 'rep')) return b;
    let { x0, y0, x1, y1 } = b;
    repLayout(v, k || 20).forEach((r) => { [r.p, r.q, r.c].forEach((q) => { x0 = Math.min(x0, q[0] - r.R); x1 = Math.max(x1, q[0] + r.R); y0 = Math.min(y0, q[1] - r.R); y1 = Math.max(y1, q[1] + r.R); }); });
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }
  /* Repères : rangés en colonne à gauche / à droite du dessin, empilés sans chevauchement (k = mm papier / m) */
  function repLayout(v, k) {
    const reps = v.items.filter((it) => it.t === 'rep'); if (!reps.length) return [];
    const b = baseBounds(v, k, true), cx = (b.x0 + b.x1) / 2, R = 2.4 / k, gap = 7 / k, out = [];
    ['L', 'R'].forEach((side) => {
      const L = reps.filter((r) => (r.side || (r.p[0] <= cx ? 'L' : 'R')) === side).sort((a, c) => c.p[1] - a.p[1]);
      const col = side === 'L' ? b.x0 - 5 / k : b.x1 + 5 / k; let prev = Infinity;
      L.forEach((r) => {
        const y = Math.min(r.p[1], prev - gap); prev = y;
        const tw = (String(r.txt || '').length * 2.3 * 0.56 + 2.5) / k, sg = side === 'L' ? -1 : 1;
        const q = [col, y], e = [col + sg * tw, y], c = [col + sg * (tw + R), y];
        out.push({ p: r.p, q, e, c, R, side, num: r.num, txt: r.txt, tx: side === 'L' ? e[0] + 0.6 / k : col + 0.6 / k });
      });
    });
    return out;
  }
  function baseBounds(v, k, geomOnly) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (p) => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; };
    v.items.forEach((it) => {
      if (it.t === 'poly' || it.t === 'line') it.pts.forEach(add);
      else if (it.t === 'circ') { add([it.c[0] - it.r, it.c[1] - it.r]); add([it.c[0] + it.r, it.c[1] + it.r]); }
      else if (it.t === 'ground' || it.t === 'brk') { add([it.x1, it.y - 0.06]); add([it.x2, it.y]); }
      else if (it.t === 'dim') { if (!geomOnly) { const g = dimGeom(it, k || 20); g.ext.forEach(add); } }
      else if (it.t === 'text') { add(it.p); }
      else if (it.t === 'bar' || it.t === 'dots') it.pts.forEach(add);
      else if (it.t === 'dist' && !geomOnly) { add(it.a); add(it.b); }
    });
    if (!isFinite(x0)) { x0 = y0 = 0; x1 = y1 = 1; }
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  }

  /* Géométrie d'une cote : ligne de cote décalée de off (m) à gauche de a→b. k = mm papier / m. */
  function dimGeom(it, k) {
    const over = 1.5 / k, gap = 0.8 / k, off = 1.1 / k, th = 2.2 / k;
    let A, B, u, n, e1, e2, L, s;
    if (it.o === 'h' || it.o === 'v') {
      const h = it.o === 'h', a = it.a, b = it.b;
      const lo = h ? (a[0] <= b[0] ? a : b) : (a[1] <= b[1] ? a : b), hi = lo === a ? b : a;
      A = h ? [lo[0], it.at] : [it.at, lo[1]]; B = h ? [hi[0], it.at] : [it.at, hi[1]];
      L = h ? hi[0] - lo[0] : hi[1] - lo[1];
      u = h ? [1, 0] : [0, 1];
      const ext = (P, Q) => { const d = h ? Math.sign(Q[1] - P[1]) || 1 : Math.sign(Q[0] - P[0]) || 1;
        return h ? [[P[0], P[1] + d * gap], [Q[0], Q[1] + d * over]] : [[P[0] + d * gap, P[1]], [Q[0] + d * over, Q[1]]]; };
      e1 = ext(lo, A); e2 = ext(hi, B);
      n = h ? [0, 1] : [-1, 0];
      const tp = h ? [(A[0] + B[0]) / 2, it.at + off] : [it.at - off, (A[1] + B[1]) / 2];
      const ang = h ? 0 : 90;
      const extp = h ? [[A[0], it.at + off + th], [B[0], it.at + off + th]] : [[it.at - off - th, A[1]], [it.at - off - th, B[1]]];
      return { A, B, e1, e2, tp, ang, L, u, n, ext: [A, B, e1[1], e2[1]].concat(extp) };
    }
    const a = it.a, b = it.b, dx = b[0] - a[0], dy = b[1] - a[1]; L = Math.hypot(dx, dy) || 1e-9;
    u = [dx / L, dy / L]; n = [-u[1], u[0]]; const o = it.off; s = Math.sign(o) || 1;
    A = [a[0] + n[0] * o, a[1] + n[1] * o]; B = [b[0] + n[0] * o, b[1] + n[1] * o];
    e1 = [[a[0] + n[0] * gap * s, a[1] + n[1] * gap * s], [A[0] + n[0] * over * s, A[1] + n[1] * over * s]];
    e2 = [[b[0] + n[0] * gap * s, b[1] + n[1] * gap * s], [B[0] + n[0] * over * s, B[1] + n[1] * over * s]];
    let ang = Math.atan2(u[1], u[0]) * 180 / Math.PI, flip = false; if (ang > 90.01 || ang < -89.99) { ang += 180; flip = true; }
    const side = flip ? -1 : 1;
    const tp = [(A[0] + B[0]) / 2 + n[0] * off * side, (A[1] + B[1]) / 2 + n[1] * off * side];
    return { A, B, e1, e2, tp, ang, L, u, n, ext: [A, B, e1[1], e2[1], [tp[0] + n[0] * th * side, tp[1] + n[1] * th * side]] };
  }

  /* ───────────────────────── Rendu SVG d'une vue ─────────────────────────
     k : unités SVG par mètre ; o : {ox, oy} position de l'origine ; mode 'plan' | 'live' | 'schema' ;
     W : épaisseurs (unités SVG). Retourne une chaîne SVG (groupe). */
  const COL = { ink: '#14171f', dim: '#d22b2b', dimTxt: '#14171f', axis: '#c026d3', hidden: '#3b4252', fill: '#e9e6dd', fillSeen: '#f6f4ee', code: '#1d4ed8', title: '#14171f' };
  const HA_COL = { 6: '#a855f7', 8: '#7c3aed', 10: '#0891b2', 12: '#16a34a', 14: '#ca8a04', 16: '#ea580c', 20: '#dc2626', 25: '#be123c', 32: '#4338ca', 40: '#1e3a8a' };
  const haCol = (d) => HA_COL[d] || '#dc2626';
  const HA_ACI = { 6: 30, 8: 200, 10: 4, 12: 3, 14: 2, 16: 30, 20: 1, 25: 241, 32: 5, 40: 170 };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function renderView(v, k, ox, oy, mode, mm, hl) {
    // mm : taille d'un « mm papier » en unités SVG (=1 sur la feuille ; ≈ px à l'écran)
    const X = (p) => (ox + p[0] * k).toFixed(2), Y = (p) => (oy - p[1] * k).toFixed(2);
    const pth = (pts, close) => 'M' + pts.map((p) => X(p) + ' ' + Y(p)).join(' L') + (close ? 'Z' : '');
    const wT = 0.5 * mm, wt = 0.18 * mm, fs = 2.5 * mm;
    let o = '';
    const dash = { hidden: `${(2 * mm).toFixed(2)} ${(1.2 * mm).toFixed(2)}`, axis: `${(6 * mm).toFixed(2)} ${(1.2 * mm).toFixed(2)} ${(1 * mm).toFixed(2)} ${(1.2 * mm).toFixed(2)}` };
    v.items.forEach((it) => {
      if (it.t === 'poly') {
        const d = pth(it.pts, true) + (it.holes || []).map((h) => pth(h, true)).join('');
        o += `<path d="${d}" fill="${it.cut ? COL.fill : COL.fillSeen}" fill-rule="evenodd" stroke="${COL.ink}" stroke-width="${(it.cut ? wT : wT * .75).toFixed(2)}" stroke-linejoin="round"/>`;
      } else if (it.t === 'line') {
        const st = it.st, col = st === 'axis' ? COL.axis : st === 'hidden' ? COL.hidden : COL.ink;
        const w = st === 'thick' ? wT : wt;
        o += `<path d="${pth(it.pts)}" fill="none" stroke="${col}" stroke-width="${w.toFixed(2)}"${dash[st] ? ` stroke-dasharray="${dash[st]}"` : ''} stroke-linecap="round"/>`;
      } else if (it.t === 'circ') {
        const st = it.st, col = st === 'axis' ? COL.axis : st === 'hidden' ? COL.hidden : COL.ink;
        o += `<circle cx="${X(it.c)}" cy="${Y(it.c)}" r="${(it.r * k).toFixed(2)}" fill="${st === 'fill' ? COL.fill : 'none'}" stroke="${st === 'fill' ? COL.ink : col}" stroke-width="${(st === 'thin' || st === 'hidden' || st === 'axis' ? wt : wT).toFixed(2)}"${dash[st] ? ` stroke-dasharray="${dash[st]}"` : ''}/>`;
      } else if (it.t === 'ground') {
        let h = ''; const st = 2.2 / (k / mm);
        for (let x = it.x1 + st; x <= it.x2 + 1e-9; x += st) h += `M${X([x, it.y])} ${Y([x, it.y])} l${(-1.4 * mm).toFixed(2)} ${(1.8 * mm).toFixed(2)}`;
        o += `<path d="${pth([[it.x1, it.y], [it.x2, it.y]])}" stroke="${COL.ink}" stroke-width="${wt.toFixed(2)}"/><path d="${h}" stroke="${COL.ink}" stroke-width="${(wt * .8).toFixed(2)}"/>`;
      } else if (it.t === 'brk') {
        const m = (it.x1 + it.x2) / 2, z = Math.min(0.15, Math.max(1.6 / (k / mm), (it.x2 - it.x1) / 10));
        o += `<path d="${pth([[it.x1 - z, it.y], [m - z / 2, it.y], [m - z / 4, it.y + z], [m + z / 4, it.y - z], [m + z / 2, it.y], [it.x2 + z, it.y]])}" fill="none" stroke="${COL.ink}" stroke-width="${wt.toFixed(2)}"/>`;
      } else if (it.t === 'dim') {
        if (mode === 'schema' && !it.k) return;
        const g = dimGeom(it, k / mm);
        const on = hl && it.k === hl, col = on ? '#d97706' : mode === 'schema' ? COL.code : COL.dim;
        o += `<path d="${pth([g.A, g.B])}${pth(g.e1)}${pth(g.e2)}" stroke="${col}" stroke-width="${(on ? wt * 2.4 : wt).toFixed(2)}" fill="none"/>`;
        const tk = 1.1 / (k / mm), t = [g.u[0] + g.n[0], g.u[1] + g.n[1]];
        [g.A, g.B].forEach((P) => { o += `<path d="${pth([[P[0] - t[0] * tk, P[1] - t[1] * tk], [P[0] + t[0] * tk, P[1] + t[1] * tk]])}" stroke="${col}" stroke-width="${(wt * 1.8).toFixed(2)}"/>`; });
        const label = mode === 'schema' ? it.k : (it.txt != null ? it.txt : fmt(g.L));
        const tw = String(label).length * fs * 0.56, room = g.L * k;
        if (room < tw + 1.2 * mm) { const sh = (room / 2 + tw / 2 + 1.0 * mm) / k; g.tp = [g.tp[0] + g.u[0] * sh, g.tp[1] + g.u[1] * sh]; }
        o += `<text x="${X(g.tp)}" y="${Y(g.tp)}" transform="rotate(${(-g.ang).toFixed(1)} ${X(g.tp)} ${Y(g.tp)})" font-size="${(mode === 'schema' ? fs * 1.15 : fs).toFixed(2)}" fill="${on ? '#d97706' : mode === 'schema' ? COL.code : COL.dimTxt}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif"${mode === 'schema' ? ' font-weight="700"' : ''}>${esc(label)}</text>`;
      } else if (it.t === 'bar') {
        o += `<path d="${pth(it.pts)}" fill="none" stroke="${haCol(it.d)}" stroke-width="${Math.max(0.35 * mm, it.d / 1000 * k).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`;
      } else if (it.t === 'dots') {
        const r = Math.max(0.5 * mm, it.d / 2000 * k).toFixed(2);
        o += it.pts.map((q) => `<circle cx="${X(q)}" cy="${Y(q)}" r="${r}" fill="${haCol(it.d)}"/>`).join('');
      } else if (it.t === 'dist') {
        const dx = it.b[0] - it.a[0], dy = it.b[1] - it.a[1], Ld = Math.hypot(dx, dy) || 1, u = [dx / Ld, dy / Ld], nn = [-u[1], u[0]], tk = 1.0 / (k / mm);
        o += `<path d="${pth([it.a, it.b])}${pth([[it.a[0] - nn[0] * tk, it.a[1] - nn[1] * tk], [it.a[0] + nn[0] * tk, it.a[1] + nn[1] * tk]])}${pth([[it.b[0] - nn[0] * tk, it.b[1] - nn[1] * tk], [it.b[0] + nn[0] * tk, it.b[1] + nn[1] * tk]])}" stroke="#14171f" stroke-width="${wt.toFixed(2)}" fill="none"/>`;
        let ang = Math.atan2(u[1], u[0]) * 180 / Math.PI, sd = 1; if (ang > 90.01 || ang < -89.99) { ang += 180; sd = -1; }
        const m = [(it.a[0] + it.b[0]) / 2 + nn[0] * sd * 0.9 / (k / mm), (it.a[1] + it.b[1]) / 2 + nn[1] * sd * 0.9 / (k / mm)];
        o += `<text x="${X(m)}" y="${Y(m)}" transform="rotate(${(-ang).toFixed(1)} ${X(m)} ${Y(m)})" font-size="${(2 * mm).toFixed(2)}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" fill="#14171f">${esc(it.txt)}</text>`;
      } else if (it.t === 'text') {
        if (mode === 'schema' && it.noSchema) return;
        o += `<text x="${X(it.p)}" y="${Y(it.p)}" font-size="${(it.h * mm).toFixed(2)}" fill="${it.col || COL.ink}" text-anchor="${it.a || 'middle'}" font-family="Arial,Helvetica,sans-serif"${it.it ? ' font-style="italic"' : ''}>${esc(it.s)}</text>`;
      }
    });
    if (mode !== 'schema') repLayout(v, k / mm).forEach((r) => {
      const RC = '#c81e1e';
      o += `<path d="${pth([r.p, r.q, r.e])}" fill="none" stroke="${RC}" stroke-width="${(wt * 1.1).toFixed(2)}"/><circle cx="${X(r.p)}" cy="${Y(r.p)}" r="${(0.45 * mm).toFixed(2)}" fill="${RC}"/>`;
      o += `<circle cx="${X(r.c)}" cy="${Y(r.c)}" r="${(r.R * k).toFixed(2)}" fill="#fff" stroke="${RC}" stroke-width="${(wt * 1.1).toFixed(2)}"/><text x="${X(r.c)}" y="${(+Y(r.c) + 0.85 * mm).toFixed(2)}" font-size="${(2.3 * mm).toFixed(2)}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" fill="${RC}">${esc(r.num)}</text>`;
      if (r.txt) o += `<text x="${X([r.tx, 0])}" y="${(+Y(r.q) - 0.7 * mm).toFixed(2)}" font-size="${(2.3 * mm).toFixed(2)}" font-family="Arial,Helvetica,sans-serif" fill="#14171f">${esc(r.txt)}</text>`;
    });
    return o;
  }

  /* Vue isolée en SVG autonome, ajustée dans W×H px. mm = taille d'un « mm papier » à l'écran. */
  function viewSVG(v, W, H, mode, mm, hl) {
    mm = mm || 3.2; let k = 100, b;
    for (let i = 0; i < 4; i++) { b = bounds(v, k / mm); k = Math.min((W - 16) / Math.max(b.w, 0.01), (H - 16) / Math.max(b.h, 0.01)); }
    b = bounds(v, k / mm);
    const ox = 8 - b.x0 * k + (W - 16 - b.w * k) / 2, oy = 8 + b.y1 * k + (H - 16 - b.h * k) / 2;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${renderView(v, k, ox, oy, mode, mm, hl)}</svg>`;
  }

  /* Plusieurs vues réunies (dessin en direct) : même échelle, rangées automatiques. */
  function viewsSVG(views, W, H, mm) {
    mm = mm || 3.0; const pad = 10, titleH = 18;
    const layout = (k) => {
      const bs = views.map((v) => bounds(v, k / mm)), rows = []; let row = [], rw = 0;
      bs.forEach((b, i) => { const w = Math.max(b.w * k, views[i].title.length * 7.2) + pad * 2; if (row.length && rw + w > W) { rows.push(row); row = []; rw = 0; } row.push(i); rw += w; });
      if (row.length) rows.push(row);
      const hs = rows.map((r) => Math.max(...r.map((i) => bs[i].h * k)) + titleH + pad * 2);
      const ws = rows.map((r) => r.reduce((s, i) => s + Math.max(bs[i].w * k, views[i].title.length * 7.2) + pad * 2, 0));
      return { bs, rows, hs, ws, H: hs.reduce((a, c) => a + c, 0), W: Math.max(...ws) };
    };
    let lo = 1, hi = 3000, best = null;
    for (let it = 0; it < 32; it++) { const k = (lo + hi) / 2, L = layout(k); if (L.H <= H && L.W <= W) { lo = k; best = { k, L }; } else hi = k; }
    if (!best) best = { k: lo, L: layout(lo) };
    const { k, L } = best; let o = '', y = (H - L.H) / 2;
    L.rows.forEach((r, ri) => {
      let x = (W - L.ws[ri]) / 2;
      r.forEach((i) => {
        const b = L.bs[i], v = views[i], w = Math.max(b.w * k, v.title.length * 7.2) + pad * 2, xo = (w - pad * 2 - b.w * k) / 2;
        o += `<text x="${(x + w / 2).toFixed(1)}" y="${(y + 13).toFixed(1)}" font-size="12" font-weight="700" fill="#14171f" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" text-decoration="underline">${esc(v.title)}</text>`;
        o += renderView(v, k, x + pad + xo - b.x0 * k, y + titleH + pad + b.y1 * k + (L.hs[ri] - titleH - pad * 2 - b.h * k) / 2, 'live', mm);
        x += w;
      });
      y += L.hs[ri];
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${o}</svg>`;
  }

  /* ───────────────────────── Mise en page du plan ───────────────────────── */
  const FORMATS = { A3: [420, 297], A2: [594, 420], A1: [841, 594], A0: [1189, 841] };
  const FORDER = ['A3', 'A2', 'A1', 'A0'];
  const SCALES = [10, 20, 25, 40, 50, 100, 200, 500];
  const CART = { V: [210, 297], H: [297, 210] };
  const MARG = { l: 20, r: 10, t: 10, b: 10 };
  const NOTA_H = 34;

  /* Range les vues (tailles en mm) dans la feuille, en évitant le cartouche (bas droite). */
  function pack(sizes, fmt, cart) {
    const [FW, FH] = FORMATS[fmt], [CW, CH] = CART[cart];
    const x0 = MARG.l + 4, x1 = FW - MARG.r - 4, y0 = MARG.t + 4, yB = FH - MARG.b - 4;
    const cx = FW - MARG.r - CW, cy = FH - MARG.b - CH - NOTA_H;    // coin haut gauche de la zone réservée
    if (cx < x0 + 40) return null;
    const pos = []; let y = y0, i = 0;
    while (i < sizes.length) {
      // largeur disponible pour une rangée qui commence à y
      let row = [], rw = 0, rh = 0;
      while (i < sizes.length) {
        const s = sizes[i], h = Math.max(rh, s[1]);
        const lim = (y + h > cy - 2) ? cx - 4 : x1;
        if (rw + s[0] > lim - x0) break;
        row.push(i); rw += s[0]; rh = h; i++;
      }
      if (!row.length) return null;
      if (y + rh > yB) return null;
      // répartir la rangée horizontalement
      const lim = (y + rh > cy - 2) ? cx - 4 : x1, gap = (lim - x0 - rw) / (row.length + 1);
      let x = x0 + gap;
      row.forEach((j) => { pos[j] = [x, y + (rh - sizes[j][1]) / 2]; x += sizes[j][0] + gap; });
      y += rh;
    }
    return pos;
  }

  /* Choix automatique échelle / format (ou imposés). */
  function layoutSheet(views, opt, extras) {
    opt = opt || {}; extras = extras || [];
    const cart = opt.cart || 'V';
    const sizeAt = (s) => views.map((v) => { const k = 1000 / s, b = bounds(v, k); return [Math.max(b.w * k, v.title.length * 2.9) + 16, b.h * k + 20]; }).concat(extras.map((e) => [e.w + 12, e.h + 12]));
    const scales = opt.scale ? [opt.scale] : SCALES, fmts = opt.format ? [opt.format] : FORDER;
    let best = null;
    scales.forEach((s) => {
      const sz = sizeAt(s);
      fmts.forEach((f, fi) => {
        const pos = pack(sz, f, cart); if (!pos) return;
        const score = [0, 1, 2.1, 3.8][FORDER.indexOf(f)] + Math.max(0, Math.log2(s / 20)) * 1.25 + (s < 20 ? 0.4 : 0);
        if (!best || score < best.score) best = { s, f, pos, sz, score };
      });
    });
    if (!best) { const s = opt.scale || 250, f = opt.format || 'A0', sz = sizeAt(s); best = { s, f, sz, pos: sz.map((_, i) => [MARG.l + 10 + i * 5, MARG.t + 10 + i * 5]), forced: true }; }
    return best;
  }

  /* Cartouche (rendu SVG en mm) */
  function cartouche(meta, x, y, cart, logos) {
    const [W, H] = CART[cart], v = cart === 'V';
    const T = (tx, ty, s, h, opt) => `<text x="${tx}" y="${ty}" font-size="${h}" font-family="Arial,Helvetica,sans-serif"${/ fill="/.test(opt || '') ? '' : ' fill="#14171f"'}${opt || ''}>${esc(s)}</text>`;
    const L = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#14171f" stroke-width="${w || 0.25}"/>`;
    let o = `<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="#fff" stroke="#14171f" stroke-width="0.7"/>`;
    const rows = v
      ? [['mo', 40], ['projet', 34], ['ouvrage', 26], ['objet', 46], ['bet', 34], ['ent', 24], ['id', 24], ['vis', 24], ['rev', 45]]
      : [['mo', 34], ['projet', 28], ['ouvrage', 20], ['objet', 34], ['bet', 28], ['id', 22], ['vis', 22]];
    // en horizontal : entreprise et révisions en colonne à droite
    const colW = v ? W : W * 0.66;
    let yy = y;
    const cx = x + colW / 2;
    rows.forEach(([key, h]) => {
      o += L(x, yy + h, x + colW, yy + h);
      const lab = (s) => T(x + 2.5, yy + 4.5, s, 2.4, ' fill-opacity=".65"');
      if (key === 'mo') {
        o += lab('MAÎTRE D\'OUVRAGE');
        if (logos.mo) o += `<image href="${logos.mo}" x="${x + 4}" y="${yy + 7}" width="${h - 10}" height="${h - 10}" preserveAspectRatio="xMidYMid meet"/>`;
        o += T(cx + (logos.mo ? 10 : 0), yy + h / 2 + 3, meta.mo || '—', 4.2, ' text-anchor="middle" font-weight="700"');
      } else if (key === 'projet') {
        o += lab('PROJET'); wrap(meta.projet || '—', 46).forEach((ln, i, a) => { o += T(cx, yy + h / 2 + 2 + (i - (a.length - 1) / 2) * 5.2, ln, 4, ' text-anchor="middle" font-weight="700"'); });
      } else if (key === 'ouvrage') {
        o += lab('OUVRAGE'); o += T(cx, yy + h / 2 + 3, meta.ouvrage || '—', 4, ' text-anchor="middle"');
      } else if (key === 'objet') {
        o += lab('OBJET'); wrap(meta.objet || '', 34).forEach((ln, i, a) => { o += T(cx, yy + h / 2 + 2.5 + (i - (a.length - 1) / 2) * 7, ln, 5.6, ' text-anchor="middle" font-weight="700" fill="#1d4ed8"'); });
      } else if (key === 'bet') {
        o += lab('BUREAU D\'ÉTUDES');
        if (logos.bet) o += `<image href="${logos.bet}" x="${x + 4}" y="${yy + 7}" width="${h - 10}" height="${h - 10}" preserveAspectRatio="xMidYMid meet"/>`;
        o += T(cx + (logos.bet ? 10 : 0), yy + h / 2 + 3, meta.bet || '—', 4.2, ' text-anchor="middle" font-weight="700"');
      } else if (key === 'ent') {
        o += lab('ENTREPRISE'); o += T(cx, yy + h / 2 + 3, meta.ent || '—', 4, ' text-anchor="middle"');
      } else if (key === 'id') {
        const cells = [['N° PLAN', meta.num || '—'], ['INDICE', meta.ind || 'A'], ['ÉCHELLE', meta.ech || ''], ['FORMAT', meta.fmt || ''], ['DATE', meta.date || '']];
        const cw = colW / cells.length;
        cells.forEach((c, i) => { if (i) o += L(x + i * cw, yy, x + i * cw, yy + h); o += T(x + i * cw + cw / 2, yy + 6, c[0], 2.3, ' text-anchor="middle" fill-opacity=".65"') + T(x + i * cw + cw / 2, yy + h / 2 + 5, c[1], 3.8, ' text-anchor="middle" font-weight="700"'); });
      } else if (key === 'vis') {
        const cells = [['ÉTABLI PAR', meta.etabli || ''], ['VÉRIFIÉ PAR', meta.verifie || ''], ['APPROUVÉ PAR', meta.approuve || '']];
        const cw = colW / 3;
        cells.forEach((c, i) => { if (i) o += L(x + i * cw, yy, x + i * cw, yy + h); o += T(x + i * cw + cw / 2, yy + 6, c[0], 2.3, ' text-anchor="middle" fill-opacity=".65"') + T(x + i * cw + cw / 2, yy + h / 2 + 5, c[1], 3.6, ' text-anchor="middle"'); });
      } else if (key === 'rev') {
        o += revTable(x, yy, colW, h, meta);
      }
      yy += h;
    });
    if (!v) {
      const rx = x + colW, rw = W - colW;
      o += L(rx, y, rx, y + H, 0.4);
      o += T(rx + 2.5, y + 4.5, 'ENTREPRISE', 2.4, ' fill-opacity=".65"') + T(rx + rw / 2, y + 18, meta.ent || '—', 4, ' text-anchor="middle"');
      o += L(rx, y + 28, rx + rw, y + 28);
      o += revTable(rx, y + 28, rw, H - 28, meta);
    }
    return o;
  }
  function revTable(x, y, w, h, meta) {
    const T = (tx, ty, s, hh, opt) => `<text x="${tx}" y="${ty}" font-size="${hh}" font-family="Arial,Helvetica,sans-serif"${/ fill="/.test(opt || '') ? '' : ' fill="#14171f"'}${opt || ''}>${esc(s)}</text>`;
    let o = T(x + 2.5, y + 4.5, 'INDICES', 2.4, ' fill-opacity=".65"');
    const c1 = x + 14, c2 = x + 40, rh = 7, top = y + 8;
    o += `<line x1="${x}" y1="${top}" x2="${x + w}" y2="${top}" stroke="#14171f" stroke-width=".25"/>`;
    o += T(x + 7, top + 5, 'Ind.', 2.4, ' text-anchor="middle" font-weight="700"') + T((c1 + c2) / 2, top + 5, 'Date', 2.4, ' text-anchor="middle" font-weight="700"') + T(c2 + 3, top + 5, 'Modification', 2.4, ' font-weight="700"');
    const n = Math.max(1, Math.floor((h - 8) / rh));
    for (let i = 1; i <= n; i++) o += `<line x1="${x}" y1="${top + i * rh}" x2="${x + w}" y2="${top + i * rh}" stroke="#14171f" stroke-width=".18"/>`;
    o += `<line x1="${c1}" y1="${top}" x2="${c1}" y2="${y + h}" stroke="#14171f" stroke-width=".18"/><line x1="${c2}" y1="${top}" x2="${c2}" y2="${y + h}" stroke="#14171f" stroke-width=".18"/>`;
    o += T(x + 7, top + rh + 5, meta.ind || 'A', 2.6, ' text-anchor="middle"') + T((c1 + c2) / 2, top + rh + 5, meta.date || '', 2.6, ' text-anchor="middle"') + T(c2 + 3, top + rh + 5, meta.rev || 'Première émission', 2.6);
    return o;
  }
  function wrap(s, n) {
    const words = String(s).split(/\s+/), out = []; let l = '';
    words.forEach((w) => { if ((l + ' ' + w).trim().length > n && l) { out.push(l); l = w; } else l = (l + ' ' + w).trim(); });
    if (l) out.push(l); return out.slice(0, 3);
  }

  /* Feuille complète en SVG (unités = mm). */
  /* Feuille complète en SVG (unités = mm). kind : 'coffrage' | 'ferraillage' */
  function sheetSVG(struct, g, meta, opt, logos, kind, fp) {
    let views, extras = [], bars = null;
    if (kind === 'ferraillage' && typeof struct.ferr === 'function') {
      const F = struct.ferr(g, fp || {}); views = F.views; bars = F.bars;
      const vol = F.vol != null ? F.vol : (struct.qty ? struct.qty(g).reduce((a, q) => a + q[1], 0) : 0);
      extras = [nomenBlock(bars, 'NOMENCLATURE DES ACIERS — ' + String(struct.name).toUpperCase(), vol)];
    }
    else views = struct.views(g);
    const L = layoutSheet(views, opt, extras), [FW, FH] = FORMATS[L.f], k = 1000 / L.s, cart = (opt && opt.cart) || 'V';
    const [CW, CH] = CART[cart];
    const m = Object.assign({}, meta, { ech: '1/' + L.s, fmt: L.f });
    let o = `<rect x="0" y="0" width="${FW}" height="${FH}" fill="#fff"/>`;
    o += `<rect x="${MARG.l}" y="${MARG.t}" width="${FW - MARG.l - MARG.r}" height="${FH - MARG.t - MARG.b}" fill="none" stroke="#14171f" stroke-width="0.7"/>`;
    views.forEach((v, i) => {
      const b = bounds(v, k), [px, py] = L.pos[i], [w, h] = L.sz[i];
      const cxv = px + w / 2;
      o += `<text x="${cxv.toFixed(1)}" y="${(py + 5).toFixed(1)}" font-size="4.2" font-weight="700" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" fill="#14171f" text-decoration="underline">${esc(v.title.toUpperCase())}</text>`;
      o += `<text x="${cxv.toFixed(1)}" y="${(py + 10).toFixed(1)}" font-size="3" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" fill="#0f8f3b">Ech : 1/${L.s}</text>`;
      o += renderView(v, k, px + (w - b.w * k) / 2 - b.x0 * k, py + 14 + b.y1 * k + (h - 20 - b.h * k) / 2, 'plan', 1);
    });
    extras.forEach((e, j) => { const [px, py] = L.pos[views.length + j]; o += primsSVG(e.prims, px + 6, py + 6); });
    const nx = FW - MARG.r - CW, ny = FH - MARG.b - CH - NOTA_H;
    o += `<rect x="${nx}" y="${ny}" width="${CW}" height="${NOTA_H}" fill="#fff" stroke="#14171f" stroke-width="0.5"/>`;
    o += `<text x="${nx + 3}" y="${ny + 6}" font-size="3.4" font-weight="700" font-family="Arial,Helvetica,sans-serif" text-decoration="underline">NOTA :</text>`;
    String(m.nota || '').split('\n').slice(0, 5).forEach((ln, i) => { o += `<text x="${nx + 3}" y="${ny + 12 + i * 4.6}" font-size="2.8" font-family="Arial,Helvetica,sans-serif">${esc(ln)}</text>`; });
    o += cartouche(m, FW - MARG.r - CW, FH - MARG.b - CH, cart, logos || {});
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FW} ${FH}" width="${FW}mm" height="${FH}mm">${o}</svg>`, layout: L, FW, FH, views, extras, bars, meta: m, cart, kind: kind || 'coffrage' };
  }

  /* ───────────────────────── Aciers : longueurs, masses, nomenclature ───────────────────────── */
  const KGM = (d) => 0.00617 * d * d;                       // kg/m pour un HA de d mm
  const segLen = (pts) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
  /* Longueur développée : polyligne (+ fermeture et crochets pour les cadres), cerce = πD + recouvrement */
  function barLength(b) {
    if (b.circle) return Math.PI * b.circle + 40 * b.d / 1000;
    let L = segLen(b.closed ? b.shape.concat([b.shape[0]]) : b.shape);
    if (b.closed) L += 2 * 10 * b.d / 1000;
    if (b.hooks) L += b.hooks * 10 * b.d / 1000;
    return L;
  }
  function finishBars(list) {
    list.forEach((b) => { b.ne = b.ne || 1; if (b.nu == null) b.nu = b.n; b.n = b.nu * b.ne; b.L = barLength(b); b.Lt = b.L * b.n; b.kg = b.Lt * KGM(b.d); });
    return list;
  }
  function totals(bars) { const t = {}; bars.forEach((b) => { t[b.d] = (t[b.d] || 0) + b.kg; }); return t; }

  const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
  /* Croquis de façonnage (primitives mm) dans une case w × h — longueurs en m comme sur les plans KLE */
  function shapePrims(b, x, y, w, h) {
    const P = [], col = haCol(b.d);
    if (b.circle) {
      const r = Math.min(w, h) / 2 - 0.9; P.push({ t: 'circ', c: [x + w / 2 - 6, y + h / 2], r, col }); P.push({ t: 'text', p: [x + w / 2 - 6 + r + 1.5, y + h / 2 + 0.8], s: 'Ø ' + f2(b.circle), h: 2.1, a: 'start' }); return P;
    }
    const pts = b.closed ? b.shape.concat([b.shape[0]]) : b.shape;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; pts.forEach((q) => { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    const sw = Math.max(x1 - x0, 1e-6), sh = Math.max(y1 - y0, 1e-6), W = w - 16, Hh = h - 3.6;
    const kx = W / sw, ky = sh < 1e-5 ? 0 : Math.min(Hh / sh, kx * 3);
    const ox = x + 8 + (W - sw * kx) / 2, oy = y + h - 1.8 - (sh < 1e-5 ? Hh / 2 : (Hh - sh * ky) / 2);
    const T = (q) => [ox + (q[0] - x0) * kx, oy - (q[1] - y0) * ky];
    P.push({ t: 'pl', pts: pts.map(T), col });
    const seen = {};
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], c = pts[i], Lm = Math.hypot(c[0] - a[0], c[1] - a[1]); if (Lm < 0.04) continue;
      const key = f2(Lm) + (Math.abs(c[0] - a[0]) < 1e-6 ? 'v' : 'h'); if (b.closed && seen[key]) continue; seen[key] = 1;
      const A = T(a), C = T(c), mx = (A[0] + C[0]) / 2, my = (A[1] + C[1]) / 2, vert = Math.abs(C[0] - A[0]) < Math.abs(C[1] - A[1]);
      const left = vert && mx < x + w / 2;
      P.push({ t: 'text', p: vert ? [left ? mx - 0.8 : mx + 0.8, my + 0.7] : [mx, my - 0.7], s: f2(Lm), h: 1.9, a: vert ? (left ? 'end' : 'start') : 'middle' });
    }
    return P;
  }

  /* Nomenclature des aciers « comme la Pile P3 » + récapitulatif (primitives mm, origine en haut à gauche) */
  const NCOL = [['', 8], ['N°', 8], ['HA Ø', 10], ['Par élt', 11], ['Nb élts', 11], ['Total', 11], ['Esp.', 11], ['L. unit.', 13], ['Façonnage', 64], ['L. tot.', 16], ['Poids', 15]];
  const DIAS = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40];
  function nomenBlock(bars, title, vol) {
    const rh = 8, hh = 11, W = NCOL.reduce((a, c) => a + c[1], 0), P = [];
    const xs = []; let x = 0; NCOL.forEach((c) => { xs.push(x); x += c[1]; });
    const T = (p, s, h, o) => P.push(Object.assign({ t: 'text', p, s, h }, o || {}));
    const Ln = (a, b, w) => P.push({ t: 'line', a, b, w: w || 0.25 });
    Ln([0, 0], [W, 0], 0.5); T([W / 2, 6.2], title || 'NOMENCLATURE DES ACIERS', 3.6, { a: 'middle', bold: true });
    let y = 9; Ln([0, y], [W, y], 0.5);
    // en-tête sur deux niveaux (Nombre)
    NCOL.forEach((c, i) => { if (i >= 3 && i <= 5) return; T([xs[i] + c[1] / 2, y + hh / 2 + 1], c[0], 2.4, { a: 'middle', bold: true }); });
    T([xs[3] + 16.5, y + 4], 'Nombre', 2.4, { a: 'middle', bold: true }); Ln([xs[3], y + 5.5], [xs[6], y + 5.5]);
    [3, 4, 5].forEach((i) => T([xs[i] + NCOL[i][1] / 2, y + 9.4], NCOL[i][0], 2.1, { a: 'middle' }));
    const yH = y; y += hh; Ln([xs[1], y], [W, y], 0.35);
    const yR = y; let g0 = y, gname = bars.length ? bars[0].grp : '';
    const flushGrp = (yy) => { if (!gname) return; Ln([0, g0], [xs[1], g0], 0.35); T([xs[0] + 5.2, (g0 + yy) / 2], String(gname).toUpperCase(), 2.3, { a: 'middle', rot: -90, col: '#c81e1e' }); };
    bars.forEach((b) => {
      if (b.grp !== gname) { flushGrp(y); g0 = y; gname = b.grp; }
      const cells = [null, String(b.rep), String(b.d), String(b.nu), String(b.ne), String(b.n), b.esp ? f2(b.esp) : '-', f2(b.L), null, f2(b.Lt), (Math.round(b.kg * 10) / 10).toFixed(1)];
      cells.forEach((c, i) => { if (c != null) T([xs[i] + NCOL[i][1] / 2, y + 5.3], c, 2.4, { a: 'middle', col: i === 2 ? haCol(b.d) : null, bold: i === 1 }); });
      shapePrims(b, xs[8], y + 0.4, NCOL[8][1], rh - 0.8).forEach((q) => P.push(q));
      y += rh; Ln([xs[1], y], [W, y], 0.18);
    });
    flushGrp(y); Ln([0, y], [W, y], 0.5);
    NCOL.forEach((c, i) => { if (i) Ln([xs[i], i >= 4 && i <= 5 ? yH + 5.5 : yH], [xs[i], y], i === 1 ? 0.35 : 0.18); });
    Ln([0, 0], [0, y], 0.5); Ln([W, 0], [W, y], 0.5);
    // récapitulatif par diamètre
    const tot = {}, len = {}; bars.forEach((b) => { tot[b.d] = (tot[b.d] || 0) + b.kg; len[b.d] = (len[b.d] || 0) + b.Lt; });
    const used = DIAS.filter((d) => tot[d]).concat(Object.keys(tot).map(Number).filter((d) => !DIAS.includes(d)));
    const TT = Object.values(tot).reduce((a, c) => a + c, 0);
    y += 5; const ry = y, lw = 40, cw = Math.min(18, (W - lw - 24) / Math.max(1, used.length)), r2 = 6.5;
    Ln([0, y], [W, y], 0.5); T([W / 2, y + 5.2], 'RÉCAPITULATIF DES ACIERS', 3.2, { a: 'middle', bold: true }); y += 7.5; Ln([0, y], [W, y], 0.35);
    const rowsR = [['HA Ø', (d) => String(d), true], ['Poids (kg/ml)', (d) => KGM(d).toFixed(3)], ['Longueur (m)', (d) => len[d].toFixed(1)], ['Poids (kg)', (d) => tot[d].toFixed(1), true]];
    rowsR.forEach(([lab, fn, bold], ri) => {
      T([2, y + 4.4], lab, 2.4, { bold: !!bold });
      used.forEach((d, j) => T([lw + j * cw + cw / 2, y + 4.4], fn(d), 2.4, { a: 'middle', bold: !!bold, col: ri === 0 ? haCol(d) : null }));
      if (ri === 3) { T([W - 12, y + 4.4], TT.toFixed(1), 2.5, { a: 'middle', bold: true }); }
      if (ri === 0) T([W - 12, y + 4.4], 'TOTAL', 2.4, { a: 'middle', bold: true });
      y += r2; Ln([0, y], [W, y], ri === 3 ? 0.35 : 0.18);
    });
    used.forEach((d, j) => Ln([lw + j * cw, ry + 7.5], [lw + j * cw, y], 0.18)); Ln([lw + used.length * cw, ry + 7.5], [lw + used.length * cw, y], 0.18); Ln([W - 24, ry + 7.5], [W - 24, y], 0.35);
    // volume, ratio, total
    const v3 = vol || 0, third = W / 3;
    T([2, y + 4.6], 'Vol. béton (m³) :', 2.5, { bold: true }); T([third - 3, y + 4.6], v3 ? v3.toFixed(2) : '-', 2.5, { a: 'end' });
    T([third + 2, y + 4.6], 'Ratio (kg/m³) :', 2.5, { bold: true }); T([2 * third - 3, y + 4.6], v3 ? (TT / v3).toFixed(1) : '-', 2.5, { a: 'end' });
    T([2 * third + 2, y + 4.6], 'Total (kg) :', 2.5, { bold: true }); T([W - 3, y + 4.6], TT.toFixed(1), 2.5, { a: 'end', bold: true });
    Ln([third, y], [third, y + 7]); Ln([2 * third, y], [2 * third, y + 7]);
    y += 7; Ln([0, y], [W, y], 0.5); Ln([0, ry], [0, y], 0.5); Ln([W, ry], [W, y], 0.5);
    return { w: W, h: y, prims: P, total: TT, ratio: v3 ? TT / v3 : 0 };
  }
  function primsSVG(P, ox, oy) {
    return P.map((q) => {
      if (q.t === 'line') return `<line x1="${(ox + q.a[0]).toFixed(2)}" y1="${(oy + q.a[1]).toFixed(2)}" x2="${(ox + q.b[0]).toFixed(2)}" y2="${(oy + q.b[1]).toFixed(2)}" stroke="#14171f" stroke-width="${q.w || 0.25}"/>`;
      if (q.t === 'pl') return `<polyline points="${q.pts.map((p) => (ox + p[0]).toFixed(2) + ',' + (oy + p[1]).toFixed(2)).join(' ')}" fill="none" stroke="${q.col || '#14171f'}" stroke-width="0.45" stroke-linejoin="round"/>`;
      if (q.t === 'circ') return `<circle cx="${(ox + q.c[0]).toFixed(2)}" cy="${(oy + q.c[1]).toFixed(2)}" r="${q.r.toFixed(2)}" fill="none" stroke="${q.col || '#14171f'}" stroke-width="0.45"/>`;
      const tx = (ox + q.p[0]).toFixed(2), ty = (oy + q.p[1]).toFixed(2);
      return `<text x="${tx}" y="${ty}" font-size="${q.h}" text-anchor="${q.a || 'start'}" font-family="Arial,Helvetica,sans-serif"${q.bold ? ' font-weight="700"' : ''}${q.rot ? ` transform="rotate(${q.rot} ${tx} ${ty})"` : ''} fill="${q.col || '#14171f'}">${esc(q.s)}</text>`;
    }).join('');
  }

  /* ───────────────────────── Export DXF R12 ───────────────────────── */
  /* Texte DXF : caractères Windows-1252 conservés (fichier écrit en ANSI_1252), le reste en \U+XXXX */
  const CP_EXTRA = { 0x20AC: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x0153: 0x9C, 0x0152: 0x8C };
  function enc(s) { let o = ''; for (const ch of String(s)) { const c = ch.codePointAt(0); o += (c < 128 || (c >= 160 && c < 256) || CP_EXTRA[c]) ? ch : '\\U+' + c.toString(16).toUpperCase().padStart(4, '0'); } return o; }
  function toCP1252(str) { const out = new Uint8Array(str.length); let n = 0; for (const ch of str) { const c = ch.codePointAt(0); out[n++] = c < 256 ? c : (CP_EXTRA[c] || 63); } return out.slice(0, n); }
  const LAYERS = [['REPERE', 1, 'CONTINUOUS'], ['NOMENCLATURE', 7, 'CONTINUOUS']].concat([6, 8, 10, 12, 14, 16, 20, 25, 32, 40].map((d) => ['HA' + d, HA_ACI[d], 'CONTINUOUS'])).concat([['COFFRAGE', 7, 'CONTINUOUS'], ['VU', 8, 'CONTINUOUS'], ['CACHE', 8, 'DASHED'], ['AXE', 6, 'CENTER'], ['COTATION', 1, 'CONTINUOUS'], ['TEXTE', 7, 'CONTINUOUS'], ['TITRE', 7, 'CONTINUOUS'], ['TERRAIN', 8, 'CONTINUOUS'], ['CADRE', 7, 'CONTINUOUS'], ['CARTOUCHE', 7, 'CONTINUOUS']]);
  function dxf(sheet) {
    const L = sheet.layout, s = L.s, sc = s / 1000;          // mm papier → m modèle
    const FH = sheet.FH, o = [];
    const p = (...a) => { for (let i = 0; i < a.length; i += 2) o.push(String(a[i]), String(a[i + 1])); };
    const N = (v) => (Math.abs(v) < 1e-9 ? 0 : v).toFixed(4);
    // conversion : coordonnées feuille (mm, y vers le bas) → modèle (m, y vers le haut)
    const M = (xmm, ymm) => [xmm * sc, (FH - ymm) * sc];
    const line = (a, b, ly) => p(0, 'LINE', 8, ly, 10, N(a[0]), 20, N(a[1]), 30, 0, 11, N(b[0]), 21, N(b[1]), 31, 0);
    const pline = (pts, closed, ly) => { p(0, 'POLYLINE', 8, ly, 66, 1, 70, closed ? 1 : 0); pts.forEach((q) => p(0, 'VERTEX', 8, ly, 10, N(q[0]), 20, N(q[1]), 30, 0)); p(0, 'SEQEND', 8, ly); };
    const circle = (c, r, ly) => p(0, 'CIRCLE', 8, ly, 10, N(c[0]), 20, N(c[1]), 30, 0, 40, N(r));
    const text = (q, h, str, ly, al, rot) => { const a = al === 'middle' ? 1 : al === 'end' ? 2 : 0; p(0, 'TEXT', 8, ly, 10, N(q[0]), 20, N(q[1]), 30, 0, 40, N(h), 1, enc(str)); if (rot) p(50, N(rot)); p(7, 'STANDARD'); if (a) p(72, a, 11, N(q[0]), 21, N(q[1]), 31, 0); };
    // en-tête
    const ext = [M(0, FH), M(FORMATS[L.f][0], 0)];
    p(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSBASE', 10, 0, 20, 0, 30, 0, 9, '$EXTMIN', 10, N(ext[0][0]), 20, N(ext[0][1]), 30, 0, 9, '$EXTMAX', 10, N(ext[1][0]), 20, N(ext[1][1]), 30, 0, 9, '$LTSCALE', 40, N(sc * 10), 9, '$DWGCODEPAGE', 3, 'ANSI_1252', 0, 'ENDSEC');
    p(0, 'SECTION', 2, 'TABLES');
    p(0, 'TABLE', 2, 'LTYPE', 70, 3);
    p(0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, 0);
    p(0, 'LTYPE', 2, 'DASHED', 70, 0, 3, '__ __ __', 72, 65, 73, 2, 40, 0.75, 49, 0.5, 49, -0.25);
    p(0, 'LTYPE', 2, 'CENTER', 70, 0, 3, '____ _ ____', 72, 65, 73, 4, 40, 2.0, 49, 1.25, 49, -0.25, 49, 0.25, 49, -0.25);
    p(0, 'ENDTAB');
    p(0, 'TABLE', 2, 'LAYER', 70, LAYERS.length); LAYERS.forEach(([n, c, lt]) => p(0, 'LAYER', 2, n, 70, 0, 62, c, 6, lt)); p(0, 'ENDTAB');
    p(0, 'TABLE', 2, 'STYLE', 70, 1, 0, 'STYLE', 2, 'STANDARD', 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 0.25, 3, 'txt', 4, '', 0, 'ENDTAB');
    p(0, 'ENDSEC');
    p(0, 'SECTION', 2, 'ENTITIES');
    const [FW] = FORMATS[L.f];
    // cadre
    pline([M(0, 0), M(FW, 0), M(FW, FH), M(0, FH)], true, 'CADRE');
    pline([M(MARG.l, MARG.t), M(FW - MARG.r, MARG.t), M(FW - MARG.r, FH - MARG.b), M(MARG.l, FH - MARG.b)], true, 'CADRE');
    // vues : en mètres réels, placées comme sur la feuille
    const k = 1000 / s;
    sheet.views.forEach((v, i) => {
      const b = bounds(v, k), [px, py] = L.pos[i], [w, h] = L.sz[i];
      const ox = px + (w - b.w * k) / 2 - b.x0 * k, oy = py + 14 + b.y1 * k + (h - 20 - b.h * k) / 2;      // mm feuille de l'origine de la vue
      const W = (q) => M(ox + q[0] * k, oy - q[1] * k);
      text(M(px + w / 2, py + 5), 4.2 * sc, v.title.toUpperCase(), 'TITRE', 'middle');
      text(M(px + w / 2, py + 10), 3 * sc, 'Ech : 1/' + s, 'TITRE', 'middle');
      v.items.forEach((it) => {
        if (it.t === 'poly') { pline(it.pts.map(W), true, it.cut ? 'COFFRAGE' : 'VU'); (it.holes || []).forEach((hh) => pline(hh.map(W), true, it.cut ? 'COFFRAGE' : 'VU')); }
        else if (it.t === 'line') pline(it.pts.map(W), false, it.st === 'axis' ? 'AXE' : it.st === 'hidden' ? 'CACHE' : 'COFFRAGE');
        else if (it.t === 'circ') circle(W(it.c), it.r * k * sc, it.st === 'axis' ? 'AXE' : it.st === 'hidden' ? 'CACHE' : 'COFFRAGE');
        else if (it.t === 'ground') { line(W([it.x1, it.y]), W([it.x2, it.y]), 'TERRAIN'); const st = 2.2 / k; for (let x = it.x1 + st; x <= it.x2 + 1e-9; x += st) line(W([x, it.y]), W([x - 1.4 / k, it.y - 1.8 / k]), 'TERRAIN'); }
        else if (it.t === 'brk') { const m = (it.x1 + it.x2) / 2, z = Math.min(0.15, Math.max(1.6 / k, (it.x2 - it.x1) / 10)); pline([[it.x1 - z, it.y], [m - z / 2, it.y], [m - z / 4, it.y + z], [m + z / 4, it.y - z], [m + z / 2, it.y], [it.x2 + z, it.y]].map(W), false, 'COFFRAGE'); }
        else if (it.t === 'dim') {
          const gm = dimGeom(it, k);
          line(W(gm.A), W(gm.B), 'COTATION'); line(W(gm.e1[0]), W(gm.e1[1]), 'COTATION'); line(W(gm.e2[0]), W(gm.e2[1]), 'COTATION');
          const tk = 1.1 / k, t = [gm.u[0] + gm.n[0], gm.u[1] + gm.n[1]];
          [gm.A, gm.B].forEach((P) => line(W([P[0] - t[0] * tk, P[1] - t[1] * tk]), W([P[0] + t[0] * tk, P[1] + t[1] * tk]), 'COTATION'));
          const lab = it.txt != null ? it.txt : fmt(gm.L), tw = lab.length * 2.5 * 0.56;
          if (gm.L * k < tw + 1.2) { const sh = (gm.L * k / 2 + tw / 2 + 1.0) / k; gm.tp = [gm.tp[0] + gm.u[0] * sh, gm.tp[1] + gm.u[1] * sh]; }
          text(W(gm.tp), 2.5 * sc, lab, 'COTATION', 'middle', gm.ang);
        } else if (it.t === 'text') text(W(it.p), it.h * sc, it.s, 'TEXTE', it.a || 'middle');
        else if (it.t === 'bar') pline(it.pts.map(W), false, 'HA' + it.d);
        else if (it.t === 'dots') it.pts.forEach((q) => circle(W(q), Math.max(it.d / 2000, 0.4 / k), 'HA' + it.d));
        else if (it.t === 'dist') {
          const dx = it.b[0] - it.a[0], dy = it.b[1] - it.a[1], Ld = Math.hypot(dx, dy) || 1, u = [dx / Ld, dy / Ld], nn = [-u[1], u[0]], tk = 1 / k;
          line(W(it.a), W(it.b), 'REPERE'); [it.a, it.b].forEach((P) => line(W([P[0] - nn[0] * tk, P[1] - nn[1] * tk]), W([P[0] + nn[0] * tk, P[1] + nn[1] * tk]), 'REPERE'));
          let ang = Math.atan2(u[1], u[0]) * 180 / Math.PI, sd = 1; if (ang > 90.01 || ang < -89.99) { ang += 180; sd = -1; }
          text(W([(it.a[0] + it.b[0]) / 2 + nn[0] * sd * 0.9 / k, (it.a[1] + it.b[1]) / 2 + nn[1] * sd * 0.9 / k]), 2 * sc, it.txt, 'REPERE', 'middle', ang);
        }
      });
      repLayout(v, k).forEach((r) => {
        pline([r.p, r.q, r.e].map(W), false, 'REPERE'); circle(W(r.c), r.R, 'REPERE');
        text(W([r.c[0], r.c[1] - 0.85 / k]), 2.3 * sc, String(r.num), 'REPERE', 'middle');
        if (r.txt) text(W([r.tx, r.q[1] + 0.7 / k]), 2.3 * sc, r.txt, 'REPERE');
      });
    });
    // blocs annexes (nomenclature)
    (sheet.extras || []).forEach((e, j) => {
      const [px, py] = L.pos[sheet.views.length + j], ox = px + 6, oy = py + 6;
      e.prims.forEach((q) => {
        if (q.t === 'line') line(M(ox + q.a[0], oy + q.a[1]), M(ox + q.b[0], oy + q.b[1]), 'NOMENCLATURE');
        else if (q.t === 'pl') pline(q.pts.map((pp) => M(ox + pp[0], oy + pp[1])), false, 'NOMENCLATURE');
        else if (q.t === 'circ') circle(M(ox + q.c[0], oy + q.c[1]), q.r * sc, 'NOMENCLATURE');
        else if (q.t === 'text') text(M(ox + q.p[0], oy + q.p[1]), q.h * sc, q.s, 'NOMENCLATURE', q.a || 'start', q.rot ? -q.rot : 0);
      });
    });
    // nota + cartouche (traits et textes principaux)
    const cart = sheet.cart, [CW, CH] = CART[cart], cx = FW - MARG.r - CW, cy = FH - MARG.b - CH, ny = cy - NOTA_H, m = sheet.meta;
    pline([M(cx, ny), M(cx + CW, ny), M(cx + CW, cy), M(cx, cy)], true, 'CARTOUCHE');
    text(M(cx + 3, ny + 6), 3.4 * sc, 'NOTA :', 'CARTOUCHE');
    String(m.nota || '').split('\n').slice(0, 5).forEach((ln, i) => text(M(cx + 3, ny + 12 + i * 4.6), 2.8 * sc, ln, 'CARTOUCHE'));
    pline([M(cx, cy), M(cx + CW, cy), M(cx + CW, cy + CH), M(cx, cy + CH)], true, 'CARTOUCHE');
    const rowsV = [['MAÎTRE D\'OUVRAGE', m.mo, 40], ['PROJET', m.projet, 34], ['OUVRAGE', m.ouvrage, 26], ['OBJET', m.objet, 46], ['BUREAU D\'ÉTUDES', m.bet, 34], ['ENTREPRISE', m.ent, 24], ['', '', 24], ['', '', 24], ['INDICES', '', 45]];
    const rowsH = [['MAÎTRE D\'OUVRAGE', m.mo, 34], ['PROJET', m.projet, 28], ['OUVRAGE', m.ouvrage, 20], ['OBJET', m.objet, 34], ['BUREAU D\'ÉTUDES', m.bet, 28], ['', '', 22], ['', '', 22]];
    const colW = cart === 'V' ? CW : CW * 0.66; let yy = cy;
    (cart === 'V' ? rowsV : rowsH).forEach(([lab, val, h], ri, arr) => {
      if (lab) text(M(cx + 2.5, yy + 4.5), 2.4 * sc, lab, 'CARTOUCHE');
      if (val) text(M(cx + colW / 2, yy + h / 2 + 3), (lab === 'OBJET' ? 5 : 4) * sc, val, 'CARTOUCHE', 'middle');
      const isId = lab === '' && arr.slice(0, ri).filter((r) => r[0] === '').length === 0;
      if (lab === '') {
        const cells = isId ? [['N° PLAN', m.num], ['INDICE', m.ind], ['ÉCHELLE', '1/' + s], ['FORMAT', L.f], ['DATE', m.date]] : [['ÉTABLI PAR', m.etabli], ['VÉRIFIÉ PAR', m.verifie], ['APPROUVÉ PAR', m.approuve]];
        const cw = colW / cells.length;
        cells.forEach((c, i) => { if (i) line(M(cx + i * cw, yy), M(cx + i * cw, yy + h), 'CARTOUCHE'); text(M(cx + i * cw + cw / 2, yy + 6), 2.3 * sc, c[0], 'CARTOUCHE', 'middle'); if (c[1]) text(M(cx + i * cw + cw / 2, yy + h / 2 + 5), 3.6 * sc, c[1], 'CARTOUCHE', 'middle'); });
      }
      yy += h; line(M(cx, yy), M(cx + colW, yy), 'CARTOUCHE');
    });
    if (cart === 'H') { line(M(cx + colW, cy), M(cx + colW, cy + CH), 'CARTOUCHE'); text(M(cx + colW + 2.5, cy + 4.5), 2.4 * sc, 'ENTREPRISE', 'CARTOUCHE'); if (m.ent) text(M(cx + colW + (CW - colW) / 2, cy + 18), 4 * sc, m.ent, 'CARTOUCHE', 'middle'); }
    p(0, 'ENDSEC', 0, 'EOF');
    return o.join('\r\n') + '\r\n';
  }

  const api = { toCP1252, KGM, finishBars, totals, nomenBlock, primsSVG, HA_COL, DIAS, f2, View, RECT, CIRC, ARC, r3, fmt, bounds, renderView, viewSVG, viewsSVG, layoutSheet, sheetSVG, dxf, FORMATS, SCALES, STRUCTS: {} };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COFF = api;
})(typeof window !== 'undefined' ? window : globalThis);
