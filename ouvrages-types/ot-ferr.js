/* Ponts types — habillage des plans de ferraillage façon ADFER (KLE Ingénierie) sur le moteur de planches OTPLAN :
   nomenclature générale des aciers avec croquis de façonnage cotés, récapitulatif par diamètre, répartition des repères
   autour d'une vue (bulles alignées sans chevauchement), longueurs développées. Unités : m (ouvrage), mm (papier). */
(function (G) {
  const P = () => G.OTPLAN;
  const r3 = v => Math.round(v * 1000) / 1000;
  const fmt = (v, d) => (d == null ? (Math.abs(v * 100 - Math.round(v * 100)) > 1e-6 ? v.toFixed(3) : v.toFixed(2)) : v.toFixed(d));
  const kg = d => (P().MASSE[d] || 0.00617 * d * d);
  const HA = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40];

  /* longueur développée d'une forme : Σ segments (cotes à l'axe), crochets ajoutés (135° : 10φ ; 90° : 10φ ; 180° : 5φ + π·2.5φ)
     — arrondi au 5 mm supérieur, comme la nomenclature ADFER */
  function devLen(segs, d, hooks) {
    let L = segs.reduce((a, s) => a + s.l, 0);
    for (const h of hooks || []) if (h === 135 || h === 90) L += 10 * d / 1000; else if (h === 180) L += (5 + Math.PI * 2.5) * d / 1000;
    return Math.ceil(L * 200 - 1e-6) / 200;
  }

  /* croquis de façonnage dans la boîte (x, y bas-gauche, w, h) ; segs = [{l, a (deg)}] ; cotes des segments écrites à l'extérieur */
  function croquis(S, x, y, w, h, segs, d, hooks) {
    if (!segs.length) return;
    const one = segs.length === 1, sg = one ? [{ l: segs[0].l, a: 0 }] : segs;
    const lmax = Math.max(...sg.map(s => s.l)), dl = sg.map(s => 0.3 + 0.7 * Math.sqrt(s.l / lmax));
    const pts = [[0, 0]]; let cx = 0, cy = 0;
    sg.forEach((s, i) => { cx += dl[i] * Math.cos(s.a * Math.PI / 180); cy += dl[i] * Math.sin(s.a * Math.PI / 180); pts.push([cx, cy]); });
    const bx = [Math.min(...pts.map(p => p[0])), Math.max(...pts.map(p => p[0]))], by = [Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[1]))];
    const padX = sg.some(s => Math.abs(Math.sin(s.a * Math.PI / 180)) > 0.6) ? 7 : 2.5, padY = 2.6;
    // croquis schématique (non à l'échelle, comme ADFER) : échelles horizontale et verticale indépendantes
    const kx0 = (w - 2 * padX) / Math.max(bx[1] - bx[0], 1e-6), ky0 = (h - 2 * padY) / Math.max(by[1] - by[0], 1e-6);
    const kx = Math.min(kx0, Math.max(ky0, 1e-6) * 6, (w - 2 * padX) / 1.0 * (bx[1] - bx[0] < 1e-6 ? 0 : 1) || kx0), ky = Math.min(ky0, kx0 * 1.2);
    const KX = bx[1] - bx[0] < 1e-6 ? 0 : kx, KY = by[1] - by[0] < 1e-6 ? 0 : ky;
    const ox = x + (w - (bx[1] - bx[0]) * KX) / 2 - bx[0] * KX, oy = y + (h - (by[1] - by[0]) * KY) / 2 - by[0] * KY;
    const q = pts.map(p => [ox + p[0] * KX, oy + p[1] * KY]);
    // crochets schématiques
    const hk = (A, B, alpha, side) => { if (!alpha) return null; const ux = (A[0] - B[0]), uy = (A[1] - B[1]), L = Math.hypot(ux, uy) || 1, t = Math.atan2(uy, ux) + side * (180 - alpha) * Math.PI / 180; return [A[0] + 1.6 * Math.cos(t), A[1] + 1.6 * Math.sin(t)]; };
    const h0 = hooks && hk(q[0], q[1], hooks[0], 1), h1 = hooks && hk(q[q.length - 1], q[q.length - 2], hooks[1], -1);
    S.bar([].concat(h0 ? [h0] : [], q, h1 ? [h1] : []), d, { k: 0 });
    const gx = q.reduce((a, p) => a + p[0], 0) / q.length, gy = q.reduce((a, p) => a + p[1], 0) / q.length;
    sg.forEach((s, i) => {
      const A = q[i], B = q[i + 1], mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, a = s.a * Math.PI / 180;
      let nx = -Math.sin(a), ny = Math.cos(a); if (nx * (mx - gx) + ny * (my - gy) < -1e-9 || (one && ny < 0)) { nx = -nx; ny = -ny; }
      const vert = Math.abs(Math.sin(a)) > 0.7, t = fmt(segs[i].l);
      if (vert) S.text(mx + nx * 1.2, my - 0.7, t, 1.7, { a: nx > 0 ? 'l' : 'r', ly: 'TABLEAU' });
      else { let rot = s.a; if (rot > 90 || rot < -90) rot += 180; rot = Math.abs(rot) < 30 ? 0 : rot; S.text(mx + nx * 1.6, my + ny * 1.6 - 0.6, t, 1.7, { rot, ly: 'TABLEAU' }); }
    });
  }

  /* nomenclature générale des aciers (colonnes des plans ADFER de KLE) ; rows : {id, d, n, ne, esp, segs, hooks, L, role}
     renvoie l'ordonnée basse et le total */
  function nomenclature(S, x, yTop, rows, opt) {
    opt = opt || {};
    const cols = [['N°', 9], ['Ø', 9], ['Par\nélém.', 11], ['Nb\nélém.', 10], ['Total', 11], ['Esp.\n(m)', 12], ['Long.\nunit. (m)', 15], ['Façonnage (cotes en m)', opt.wF || 62], ['Long.\ntotale (m)', 17], ['Masse\n(kg)', 16]];
    const W = cols.reduce((a, c) => a + c[1], 0), rh = opt.rh || 9, hh = 8;
    S.poly([[x, yTop + 6], [x + W, yTop + 6], [x + W, yTop], [x, yTop]], 'TABLEAU', true);
    S.text(x + W / 2, yTop + 1.7, opt.title || 'NOMENCLATURE GÉNÉRALE DES ACIERS', 3, { bold: 1, ly: 'TABLEAU' });
    let xx = x; const xs = [x];
    cols.forEach(([t, w]) => { const ls = t.split('\n'); ls.forEach((s, i) => S.text(xx + w / 2, yTop - hh / 2 + (ls.length - 1) * 1.3 - i * 2.7 - 0.8, s, 1.9, { bold: 1, ly: 'TABLEAU' })); xx += w; xs.push(xx); });
    S.line(x, yTop - hh, x + W, yTop - hh, 'TABLEAU');
    let y = yTop - hh, tot = 0, totL = 0;
    for (const r of rows) {
      const L = r.L != null ? r.L : devLen(r.segs, r.d, r.hooks), N = r.n * (r.ne || 1), Lt = L * N, M = Lt * kg(r.d);
      r.Lu = L; r.N = N; r.Lt = Lt; r.M = M; tot += M; totL += Lt;
      const yc = y - rh / 2 - 0.8, cell = (i, s, o) => S.text((xs[i] + xs[i + 1]) / 2, yc, s, 2, Object.assign({ ly: 'TABLEAU' }, o || {}));
      cell(0, r.id, { bold: 1, col: P().WEB_D[r.d] }); cell(1, 'HA' + r.d); cell(2, String(r.n)); cell(3, String(r.ne || 1)); cell(4, String(N));
      cell(5, r.esp ? fmt(r.esp, 3) : ''); cell(6, fmt(L, 3) + (r.moy ? '*' : '')); cell(8, fmt(Lt, 2)); cell(9, fmt(M, 1));
      croquis(S, xs[7] + 1, y - rh + 0.6, cols[7][1] - 2, rh - 1.2, r.segs, r.d, r.hooks);
      y -= rh; S.line(x, y, x + W, y, 'TABLEAU');
    }
    xs.forEach(v => S.line(v, yTop, v, y, 'TABLEAU'));
    // pied : longueur moyenne, diamètre moyen pondéré
    const dm = Math.sqrt(rows.reduce((a, r) => a + r.d * r.d * r.Lt, 0) / Math.max(totL, 1e-9));
    S.poly([[x, y], [x + W, y], [x + W, y - 5], [x, y - 5]], 'TABLEAU', true);
    S.text(x + 2, y - 3.6, '* : longueur moyenne', 1.9, { a: 'l', ly: 'TABLEAU' });
    S.text(x + W - 2, y - 3.6, 'Diamètre moyen : ' + dm.toFixed(1) + ' mm — masse totale : ' + fmt(tot, 1) + ' kg', 1.9, { a: 'r', ly: 'TABLEAU', bold: 1 });
    return { y: y - 5, tot, totL, dm, W };
  }

  /* récapitulatif des aciers par diamètre (format ADFER : DIAMÈTRE / MASSE kg/ml / LONGUEUR / POIDS, D.MOY et TOTAL) */
  function recap(S, x, yTop, rows, opt) {
    opt = opt || {};
    const ds = HA.filter(d => rows.some(r => r.d === d)), byD = d => rows.filter(r => r.d === d).reduce((a, r) => [a[0] + r.Lt, a[1] + r.M], [0, 0]);
    const w0 = 24, wc = 17, wt = 22, W = w0 + ds.length * wc + wt, rh = 5;
    const tot = rows.reduce((a, r) => a + r.M, 0), totL = rows.reduce((a, r) => a + r.Lt, 0), dm = Math.sqrt(rows.reduce((a, r) => a + r.d * r.d * r.Lt, 0) / Math.max(totL, 1e-9));
    S.poly([[x, yTop + 6], [x + W, yTop + 6], [x + W, yTop], [x, yTop]], 'TABLEAU', true);
    S.text(x + W / 2, yTop + 1.7, 'RÉCAPITULATIF DES ACIERS', 3, { bold: 1, ly: 'TABLEAU' });
    const lines = [['DIAMÈTRE', ds.map(d => 'HA' + d), 'D.MOY (mm)'], ['MASSE (kg/ml)', ds.map(d => kg(d).toFixed(3)), dm.toFixed(1)], ['LONGUEUR (m)', ds.map(d => byD(d)[0].toFixed(1)), 'TOTAL (kg)'], ['POIDS (kg)', ds.map(d => byD(d)[1].toFixed(1)), tot.toFixed(1)]];
    lines.forEach((l, i) => { const y = yTop - i * rh, yc = y - rh / 2 - 0.8, b = i === 0;
      S.text(x + w0 / 2, yc, l[0], 1.9, { bold: 1, ly: 'TABLEAU' }); l[1].forEach((v, j) => S.text(x + w0 + j * wc + wc / 2, yc, v, 2, { bold: b, ly: 'TABLEAU', col: b ? P().WEB_D[ds[j]] : undefined })); S.text(x + W - wt / 2, yc, l[2], 2, { bold: 1, ly: 'TABLEAU' }); S.line(x, y - rh, x + W, y - rh, 'TABLEAU'); });
    const yb = yTop - lines.length * rh; [x, x + w0].concat(ds.map((d, j) => x + w0 + (j + 1) * wc)).concat([x + W]).forEach(v => S.line(v, yTop, v, yb, 'TABLEAU'));
    if (opt.vol) { S.text(x, yb - 4, 'Béton : ' + opt.vol.toFixed(1) + ' m³ — ratio : ' + (tot / opt.vol).toFixed(0) + ' kg/m³', 2.1, { a: 'l', bold: 1 }); }
    return { y: yb, tot, W };
  }

  /* bulles d'un côté d'une vue : items {id, at:[x,y] point d'attache sur la barre, want (coord. le long du côté), lab}
     side : 'top' | 'bottom' | 'left' | 'right', line : coordonnée de la rangée de bulles ; pas mini 6.4 mm */
  function sideBubbles(S, items, side, line, opt) {
    opt = opt || {}; const gap = opt.gap || 6.4, horiz = side === 'top' || side === 'bottom';
    const L = items.slice().sort((a, b) => a.want - b.want);
    // répartition : file sans chevauchement, puis recentrage par blocs
    const pos = L.map(it => it.want);
    for (let it = 0; it < 60; it++) { let moved = false; for (let i = 1; i < pos.length; i++) if (pos[i] - pos[i - 1] < gap - 1e-6) { const m = (pos[i] + pos[i - 1]) / 2; pos[i - 1] = m - gap / 2; pos[i] = m + gap / 2; moved = true; } if (!moved) break; }
    if (opt.min != null) { const sh = Math.max(0, opt.min - pos[0]); for (let i = 0; i < pos.length; i++) pos[i] += sh; }
    L.forEach((it, i) => {
      const a = it.at, p = pos[i], sg = side === 'top' || side === 'right' ? 1 : -1, near = Math.abs(p - (horiz ? a[0] : a[1])) < 0.3;
      // ligne de rappel : courte oblique jusqu'au-delà du parement (opt.edge), puis droite jusqu'à la bulle (libellé sur ce tronçon)
      const ed = opt.edge != null ? opt.edge + sg * 3 : (horiz ? a[1] : a[0]) + sg * 4;
      const pts = horiz
        ? (near ? [a, [p, line]] : [a, [a[0], horiz && Math.abs(ed - a[1]) > 4 ? ed - sg * 2.5 : a[1]], [p, ed], [p, line]])
        : (near ? [a, [line, p]] : [a, [Math.abs(ed - a[0]) > 4 ? ed - sg * 2.5 : a[0], a[1]], [ed, p], [line, p]]);
      S.repere(pts, it.id, it.lab, { col: it.col });
    });
  }

  /* découpe de polylignes par un rectangle R = [x0, y0, x1, y1] (Liang-Barsky) et tracé générique des barres */
  function clipSeg(a, b, R) {
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - R[0]], [dx, R[2] - a[0]], [-dy, a[1] - R[1]], [dy, R[3] - a[1]]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) return null; } else { const t = q / p; if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; } }
    }
    return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
  }
  function clipPoly(pts, R) {
    if (!R) return [pts];
    const res = []; let cur = null;
    for (let i = 0; i < pts.length - 1; i++) { const s = clipSeg(pts[i], pts[i + 1], R); if (!s) { cur = null; continue; }
      if (cur && Math.hypot(cur[cur.length - 1][0] - s[0][0], cur[cur.length - 1][1] - s[0][1]) < 1e-9) cur.push(s[1]); else { cur = [s[0], s[1]]; res.push(cur); } }
    return res;
  }
  const inR = (p, R) => !R || (p[0] >= R[0] - 1e-9 && p[0] <= R[2] + 1e-9 && p[1] >= R[1] - 1e-9 && p[1] <= R[3] + 1e-9);
  function drawBars(S, list, T, k, R) {
    for (const b of list) {
      for (const pth of b.paths || []) clipPoly(pth, R).forEach(pc => S.bar(pc.map(p => T(p[0], p[1])), b.d, b.thin ? { w: 0.2 } : { k: k / 1000 }));
      for (const p of b.dots || []) if (inR(p, R)) { const q = T(p[0], p[1]); S.dot(q[0], q[1], Math.max(0.32, b.d / 2000 * k), b.d); }
    }
  }
  function drawPolys(S, polys, T, R, ly) { for (const poly of polys) clipPoly(poly.concat([poly[0]]), R).forEach(pc => S.poly(pc.map(p => T(p[0], p[1])), ly || 'CONTOUR')); }
  /* bulles des repères d'un détail : position libre la plus proche de la barre */
  function detailBubbles(S, list, T, R) {
    const placed = [], cand = [[5, 5], [-5, 5], [5, -5], [-5, -5], [0, 7], [7, 0], [0, -7], [-7, 0], [8, 8], [-8, 8], [8, -8], [-8, -8], [11, 3], [-11, 3]];
    const a0 = T(R[0], R[1]), a1 = T(R[2], R[3]), xr = [a0[0] + 2, a1[0] - 2], yr = [a0[1] + 2, a1[1] - 2];
    list.forEach(b => { if (b.rep || b.thin) return; const pc = (b.paths || []).map(pth => clipPoly(pth, R)[0]).find(Boolean); if (!pc) return;
      let best = null; for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) { const A = pc[0], Z = pc[pc.length - 1], q = T(A[0] + (Z[0] - A[0]) * t, A[1] + (Z[1] - A[1]) * t);
        for (const [dx, dy] of cand) { const c0 = [q[0] + dx, q[1] + dy]; if (c0[0] < xr[0] || c0[0] > xr[1] || c0[1] < yr[0] || c0[1] > yr[1]) continue; if (placed.every(p => Math.hypot(p[0] - c0[0], p[1] - c0[1]) > 5)) { best = [q, c0]; break; } } if (best) break; }
      if (!best) return; placed.push(best[1]); S.repere([best[0], best[1]], b.id, '', {}); });
  }
  /* bulles de toute une vue : tags {side, p (m)} des barres → rangées autour de la vue (bbox papier [x0,y0,x1,y1]) */
  function viewBubbles(S, list, T, bb, opt) {
    opt = opt || {}; const lab = b => b.n + ' HA' + b.d + (b.esp ? ' e=' + b.esp.toFixed(3) : ''); const sides = { top: [], bottom: [], left: [], right: [] };
    for (const b of list) { if (!b.tag || !b.tag.p) continue; const q = T(b.tag.p[0], b.tag.p[1]); sides[b.tag.side].push({ id: b.id + (b.sub || ''), at: q, lab: lab(b), want: b.tag.side === 'left' || b.tag.side === 'right' ? q[1] : q[0] }); }
    const d = opt.d || 26;
    if (sides.top.length) sideBubbles(S, sides.top, 'top', bb[3] + d, { edge: bb[3] });
    if (sides.bottom.length) sideBubbles(S, sides.bottom, 'bottom', bb[1] - d, { edge: bb[1] });
    if (sides.left.length) sideBubbles(S, sides.left, 'left', bb[0] - d - 4, { edge: bb[0] });
    if (sides.right.length) sideBubbles(S, sides.right, 'right', bb[2] + d + 4, { edge: bb[2] });
  }
  /* planche « nomenclature » commune : nomenclature (1 ou 2 colonnes), désignation des repères, récapitulatif, contrôle avant-métré */
  function nomenSheet(m, list, o) {
    const P = G.OTPLAN, S = P.Sheet(); S.frame();
    const rows = list.map(b => ({ id: b.id + (b.sub || ''), d: b.d, n: b.n, ne: b.ne, esp: b.esp, segs: b.segs, hooks: b.hooks, L: b.L, role: b.role }));
    const two = rows.length > 22, half = two ? Math.ceil(rows.length / 2) : rows.length, rh = Math.min(10, Math.max(7.2, 250 / (half + 3)));
    const t1 = nomenclature(S, 14, 276, rows.slice(0, half), { rh, wF: 54 });
    if (two) nomenclature(S, 14 + t1.W + 6, 276, rows.slice(half), { rh, wF: 54, title: 'NOMENCLATURE GÉNÉRALE DES ACIERS (suite)' });
    const xD = two ? 14 : 14 + t1.W + 8;
    let yInfo;
    if (!two) { S.text(xD, 278, 'DÉSIGNATION DES REPÈRES', 3, { a: 'l', bold: 1 });
      rows.forEach((rw, i) => { S.text(xD, 272 - i * 4.1, rw.id, 2.1, { a: 'l', bold: 1, col: P.WEB_D[rw.d] }); S.text(xD + 7, 272 - i * 4.1, rw.role, 2, { a: 'l' }); });
      yInfo = Math.min(272 - rows.length * 4.1 - 14, 130); }
    const rc = recap(S, two ? 14 : xD, two ? t1.y - 14 : yInfo, rows, { vol: o.vol });
    if (o.ton > 0) S.text(two ? 14 : xD, rc.y - 10, 'Avant-métré de la note : ' + (o.ton / 1000).toFixed(2) + ' t — nomenclature : ' + (rc.tot / 1000).toFixed(2) + ' t (écart ' + ((rc.tot / o.ton - 1) * 100).toFixed(1) + ' %)', 2.1, { a: 'l' });
    if (two) {   // désignation des repères à droite du récapitulatif, en une ou deux colonnes
      const x0 = 14 + Math.max(rc.W, 118) + 8, y0 = t1.y - 8, nMax = Math.max(4, Math.floor((y0 - 16) / 3.9)), cols = Math.ceil(rows.length / nMax), cw = Math.min(140, (270 - x0) / cols);
      S.text(x0, y0 + 2, 'DÉSIGNATION DES REPÈRES', 3, { a: 'l', bold: 1 });
      rows.forEach((rw, i) => { const cI = Math.floor(i / nMax), y = y0 - 4 - (i % nMax) * 3.9, x = x0 + cI * cw; S.text(x, y, rw.id, 2, { a: 'l', bold: 1, col: P.WEB_D[rw.d] }); S.text(x + 6.5, y, rw.role.length > cw / 1.25 ? rw.role.slice(0, Math.floor(cw / 1.25)) + '…' : rw.role, 1.8, { a: 'l' }); });
    }
    S.cartouche(Object.assign({ echelles: '—' }, o.cart));
    return { S, tot: rc.tot };
  }

  G.OTFERR = { clipPoly, drawBars, drawPolys, detailBubbles, viewBubbles, nomenSheet, devLen, croquis, nomenclature, recap, sideBubbles, kg, fmt, r3, HA };
})(typeof window !== 'undefined' ? window : globalThis);
