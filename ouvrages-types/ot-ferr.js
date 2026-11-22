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

  G.OTFERR = { devLen, croquis, nomenclature, recap, sideBubbles, kg, fmt, r3, HA };
})(typeof window !== 'undefined' ? window : globalThis);
