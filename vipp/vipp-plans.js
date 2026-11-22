/* VIPP-EL — planches de coffrage et de câblage (BridgeAI / KLE Ingénierie)
   Construites à partir du bordereau (VIPPSaisie.parseBordereau) : géométrie de la poutre (ligne A2, épaississement
   d'âme EPAM / LONGOUS), hourdis (lignes A3, B), entretoises, profil en travers ; câblage : tableau des ordonnées
   des câbles (lignes C) — abscisses depuis l'extrémité de la poutre, ordonnées depuis la fibre inférieure. */
(function (G) {
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
  const n0 = v => (isFinite(+v) ? +v : 0);

  /* contour de la poutre (repère : axe de la poutre, y = 0 en fibre inférieure) ; ep = surépaisseur d'âme */
  function inter(a, b, c, d) { const n = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]), t = a[0] * b[1] - a[1] * b[0], l = c[0] * d[1] - c[1] * d[0]; return [(t * (c[0] - d[0]) - (a[0] - b[0]) * l) / n, (t * (c[1] - d[1]) - (a[1] - b[1]) * l) / n]; }
  function beamOutline(e, ep) {
    const r = e.HPIED + e.H1, s = r + e.H2;
    const side = c => {
      const a = c > 0 ? e.H3D : e.H3G, u = c > 0 ? e.D3D : e.D3G, i = e.ETALON / 2, p = e.E1 / 2, h = e.E2 / 2, B = e.ETAB / 2, v = B - u, f = s + a, X = e.HPOUT + c * e.PENTPOUT * B, $ = ep / 2;
      const D = [p + $, r], m = [h + $, s]; let U, I;
      if ($ <= 1e-12) { U = [p, r]; I = [h, s]; } else { U = inter([i, e.HPIED], [p, r], D, m); I = e.GDA === 2 ? [h + $, s] : inter([h, s], [v, f], D, m); }
      const b = [[i, 0], [i, e.HPIED], U, I];
      if (e.GDA === 2 && $ > 0) b.push([Math.min(v + $, B), f]); else b.push([v, f]);
      b.push([B, X - e.HTAB], [B, X]);
      return b.map(([M, y]) => [c * M, y]);
    };
    return [...side(1), ...side(-1).reverse()];
  }
  /* panneau d'hourdis porté par la poutre i (1..NPOUT) */
  function panel(bd, i) {
    const n = bd.NPOUT, s = bd.ENTRAPOUT, L = i === 1, R = i === n;
    return { xl: L ? -bd.slabG.EEXT : -s / 2, xr: R ? bd.slabD.EEXT : s / 2, HHOUR: L ? bd.slabG.HHOUR : R ? bd.slabD.HHOUR : bd.slab.HHOUR,
      psL: L ? bd.slabG.PENTSUP : bd.slab.PENTSUP, psR: R ? bd.slabD.PENTSUP : bd.slab.PENTSUP, piL: L ? bd.slabG.PENTINF : bd.slab.PENTINF, piR: R ? bd.slabD.PENTINF : bd.slab.PENTINF,
      hMidL: L ? bd.slabG.HEXT : bd.slab.HAXE, hMidR: R ? bd.slabD.HEXT : bd.slab.HAXE };
  }
  function slabOutline(e, o) {
    const r = e.HPOUT, s = e.ETAB / 2, top = a => r + o.HHOUR + (a >= 0 ? o.psR : o.psL) * a, beamTop = a => r + e.PENTPOUT * a;
    const under = a => { const u = a > 0, i = u ? o.xr : o.xl; return top(i) - (u ? o.hMidR : o.hMidL) + (u ? o.piR : o.piL) * (a - i); };
    const c = [];
    if (o.xl < -s - 1e-9) { c.push([o.xl, under(o.xl)]); c.push([-s, under(-s - 1e-12)]); }
    c.push([Math.max(o.xl, -s), beamTop(Math.max(o.xl, -s))]); c.push([0, beamTop(0)]); c.push([Math.min(o.xr, s), beamTop(Math.min(o.xr, s))]);
    if (o.xr > s + 1e-9) { c.push([s, under(s + 1e-12)]); c.push([o.xr, under(o.xr)]); }
    return [...c, [o.xr, top(o.xr)], [0, top(0)], [o.xl, top(o.xl)]];
  }
  const epam = (bd, e, x) => {   // surépaisseur d'âme à l'abscisse x (depuis l'extrémité de la poutre)
    const Lb = bd.PORTEE + 2 * bd.ABOUT, d = x <= Lb / 2 ? x : Lb - x;
    if (!e.GDA || e.EPAM <= 0) return 0;
    const t = bd.ABOUT + e.EPAM / 2, l = bd.ABOUT + e.LONGOUS;
    return e.LIN === 0 ? (d <= l ? e.EPAM : 0) : d <= t ? e.EPAM : d >= l ? 0 : e.EPAM * (l - d) / (l - t);
  };
  const beamX = (bd, i) => { const W = bd.slabG.EEXT + (bd.NPOUT - 1) * bd.ENTRAPOUT + bd.slabD.EEXT; return -W / 2 + bd.slabG.EEXT + (i - 1) * bd.ENTRAPOUT; };
  const deckW = bd => bd.slabG.EEXT + (bd.NPOUT - 1) * bd.ENTRAPOUT + bd.slabD.EEXT;
  const titres = bd => (bd.titre || []).map(x => String(x || '').replace(/_/g, ' ').trim()).filter(Boolean);
  const ouvrage = bd => { const t = titres(bd); return [t.join(' — '), 'portée ' + f2(bd.PORTEE, 2) + ' m · ' + bd.NPOUT + ' poutres'];
  };

  /* ---------------- coffrage ---------------- */
  function coffrage(bd) {
    const P = G.OTPLAN, S = P.Sheet(), e = bd.beam, Lb = bd.PORTEE + 2 * bd.ABOUT, W = deckW(bd), H = e.HPOUT, hh = bd.slab.HHOUR;
    const phi = (bd.BIAIS || 100) * Math.PI / 200, ct = Math.cos(phi) / Math.sin(phi);
    S.frame();
    // ---------- coupe transversale du tablier ----------
    const scT = P.pickScale(W + 1, 250, [20, 25, 50, 75, 100]), kT = 1000 / scT, ox = 140, oy = 262 - (H + hh + 0.4) * kT;
    const T = (x, y) => [ox + x * kT, oy + y * kT];
    for (let i = 1; i <= bd.NPOUT; i++) {
      const xi = beamX(bd, i), bo = beamOutline(e, 0).map(p => T(xi + p[0], p[1])), so = slabOutline(e, panel(bd, i)).map(p => T(xi + p[0], p[1]));
      S.fill(bo, 'BETON'); S.poly(bo, 'CONTOUR', true); S.fill(so, 'BETON'); S.poly(so, 'CONTOUR', true);
      const q = T(xi, -0.15); S.text(q[0], q[1] - 3, 'P' + i, 2.6, { bold: 1 });
    }
    // trottoirs / chaussée (profil A6) au-dessus de l'hourdis
    const ws = [bd.ETROTG, bd.EGAU, bd.ESURCH, bd.EDROI, bd.ETROTD].map(n0), Wp = ws.reduce((a, b) => a + b, 0);
    { let x = -Wp / 2; const xs = [x]; for (const w of ws) { x += w; xs.push(x); } const yt = H + hh;
      if (ws[0] > 0) S.poly([T(xs[0], yt + 0.02), T(xs[1], yt + 0.02), T(xs[1], yt + 0.22), T(xs[0], yt + 0.22)], 'VU', true);
      if (ws[4] > 0) S.poly([T(xs[4], yt + 0.02), T(xs[5], yt + 0.02), T(xs[5], yt + 0.22), T(xs[4], yt + 0.22)], 'VU', true);
      const xd = xs.filter((_, i) => i === 0 || ws[i - 1] > 0);
      S.chainH(xd.map(v => T(v, 0)[0]), T(0, yt + 0.22)[1] + 5, ws.filter(w => w > 0).map(w => f2(w, 2)), { h: 1.9 }); }
    { const a = T(0, -0.5), z = T(0, H + hh + 0.6); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    // cotes : entraxes, largeur, hauteurs
    const xb = [-W / 2].concat(Array.from({ length: bd.NPOUT }, (_, i) => beamX(bd, i + 1)), [W / 2]);
    S.chainH(xb.map(v => T(v, 0)[0]), T(0, 0)[1] - 9, xb.slice(1).map((v, i) => f2(v - xb[i], 2)), { h: 1.9 });
    S.dim([T(-W / 2, 0)[0], T(0, 0)[1] - 16], [T(W / 2, 0)[0], T(0, 0)[1] - 16], 0, f2(W, 2), { noExt: true });
    const xR = T(W / 2, 0)[0] + 6;
    S.chainV([T(0, 0)[1], T(0, e.HPIED)[1], T(0, e.HPIED + e.H1)[1], T(0, e.HPIED + e.H1 + e.H2)[1], T(0, H)[1], T(0, H + hh)[1]], xR,
      [f2(e.HPIED, 2), f2(e.H1, 2), f2(e.H2, 2), f2(H - e.HPIED - e.H1 - e.H2, 2), f2(hh, 2)], { right: true });
    S.title(15, 281, 'COUPE TRANSVERSALE DU TABLIER', 'échelle 1/' + scT + ' — en travée (âmes courantes)');
    // ---------- détail de la poutre : section courante et section d'about ----------
    const scD = P.pickScale(e.ETAB + 0.3, 56, [10, 20, 25, 50]), kD = 1000 / scD, yD = oy - 30 - H * kD;
    [['SECTION COURANTE', 0], ['SECTION D\'ABOUT', epam(bd, e, bd.ABOUT)]].forEach(([lab, ep], j) => {
      const cx = 300 + j * 62, D = (x, y) => [cx + x * kD, yD + y * kD], q = beamOutline(e, ep).map(p => D(p[0], p[1]));
      S.fill(q, 'BETON'); S.poly(q, 'CONTOUR', true);
      S.dim([D(-e.ETAB / 2, 0)[0], D(0, H)[1] + 3], [D(e.ETAB / 2, 0)[0], D(0, H)[1] + 3], 0, f2(e.ETAB, 2), { noExt: true, h: 1.8 });
      S.dim([D(-e.ETALON / 2, 0)[0], D(0, 0)[1] - 3], [D(e.ETALON / 2, 0)[0], D(0, 0)[1] - 3], 0, f2(e.ETALON, 2), { noExt: true, h: 1.8 });
      S.text(D(0, H / 2)[0] + (e.E1 + ep) / 2 * kD + 1, D(0, H / 2)[1], 'âme ' + f2(e.E1 + ep, 2), 1.8, { a: 'l', ly: 'COTES' });
      S.text(cx, D(0, H)[1] + 8, lab, 2.4, { bold: 1 });
    });
    S.text(282, yD + H * kD + 15, 'POUTRE — échelle 1/' + scD + (e.EPAM > 0 ? ' — âme épaissie sur ' + f2(e.LONGOUS, 2) + ' m' : ''), 2.6, { a: 'l', bold: 1 });
    // ---------- élévation d'une poutre et vue en plan ----------
    const scL = P.pickScale(Lb + 2, 250, [50, 75, 100, 125, 200, 250]), kL = 1000 / scL, oxL = 15 + 8, oyL = Math.min(yD - 14, oy - 40) - H * kL;
    const L2 = (x, y) => [oxL + x * kL, oyL + y * kL];
    S.poly([L2(0, 0), L2(Lb, 0), L2(Lb, H), L2(0, H)], 'CONTOUR', true);
    S.poly([L2(0, H + hh), L2(Lb, H + hh)], 'VU'); S.poly([L2(0, H), L2(0, H + hh)], 'VU'); S.poly([L2(Lb, H), L2(Lb, H + hh)], 'VU');
    for (const y of [e.HPIED + e.H1, e.HPIED + e.H1 + e.H2]) S.poly([L2(0, y), L2(Lb, y)], 'CACHE');
    if (e.EPAM > 0) for (const x of [bd.ABOUT + e.LONGOUS, Lb - bd.ABOUT - e.LONGOUS]) { const a = L2(x, 0), z = L2(x, H); S.line(a[0], a[1], z[0], z[1], 'CACHE'); }
    // entretoises d'about
    if (bd.HENTA > 0) for (const x of [0, Lb - bd.ENTAPP]) S.poly([L2(x, H - bd.HENTA), L2(x + bd.ENTAPP, H - bd.HENTA), L2(x + bd.ENTAPP, H), L2(x, H)], 'CACHE', true);
    for (const x of [bd.ABOUT, Lb - bd.ABOUT]) { const a = L2(x, 0); S.line(a[0], a[1] - 6, a[0], L2(x, H + hh)[1] + 4, 'AXE'); S.poly([[a[0] - 2, a[1] - 0.4], [a[0] + 2, a[1] - 0.4], [a[0] + 2, a[1] - 1.8], [a[0] - 2, a[1] - 1.8]], 'APPAREILS', true); }
    S.chainH([0, bd.ABOUT, Lb - bd.ABOUT, Lb].map(x => L2(x, 0)[0]), L2(0, 0)[1] - 8, [f2(bd.ABOUT, 2), f2(bd.PORTEE, 2) + ' (portée)', f2(bd.ABOUT, 2)]);
    S.dim([L2(0, 0)[0], L2(0, 0)[1] - 14], [L2(Lb, 0)[0], L2(0, 0)[1] - 14], 0, f2(Lb, 2) + ' (longueur de la poutre)', { noExt: true });
    if (e.EPAM > 0) S.chainH([L2(bd.ABOUT, 0)[0], L2(bd.ABOUT + e.LONGOUS, 0)[0]], L2(0, H + hh)[1] + 4, [f2(e.LONGOUS, 2) + ' (âme épaissie)'], { h: 1.8 });
    S.title(15, L2(0, H + hh)[1] + 12, 'ÉLÉVATION D\'UNE POUTRE', 'échelle 1/' + scL + (bd.HENTA > 0 ? ' — entretoises d\'about (pointillé) h = ' + f2(bd.HENTA, 2) + ', ép. ' + f2(bd.ENTAPP, 2) : ''));
    // vue en plan du tablier (même échelle)
    const yPl = L2(0, 0)[1] - 32, Pp = (x, y) => [oxL + x * kL, yPl - W / 2 * kL + y * kL + W / 2 * kL - W * kL / 2];
    const Pq = (x, y) => [oxL + (x + y * ct) * kL, yPl - (W / 2 - y) * kL];
    S.poly([Pq(0, -W / 2), Pq(Lb, -W / 2), Pq(Lb, W / 2), Pq(0, W / 2)], 'CONTOUR', true);
    for (let i = 1; i <= bd.NPOUT; i++) { const y = beamX(bd, i); for (const sg of [-1, 1]) { const yy = y + sg * e.ETALON / 2; const a = Pq(0, yy), z = Pq(Lb, yy); S.line(a[0], a[1], z[0], z[1], 'CACHE'); } }
    for (const x of [bd.ABOUT, Lb - bd.ABOUT]) { const a = Pq(x, -W / 2 - 1), z = Pq(x, W / 2 + 1); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    { const a = Pq(-1, 0), z = Pq(Lb + 1, 0); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    S.text(Pq(0, W / 2)[0], Pq(0, W / 2)[1] + 2.5, 'VUE EN PLAN — talons des poutres en pointillé, biais ' + f2(bd.BIAIS || 100, 1) + ' gr', 2.4, { a: 'l', bold: 1 });
    void Pp;
    S.notes(['NOTES :', '— cotes en mètres ; hauteurs mesurées depuis la fibre inférieure de la poutre.', '— hourdis : ' + f2(hh, 2) + ' m (axe), dévers ' + f2(bd.slab.PENTSUP * 100, 1) + ' %.',
      '— entretoises : ' + bd.NE + ' d\'about' + (bd.ENTINT ? ', ' + bd.ENTINT + ' intermédiaire(s)' : '') + '.', '— câblage : voir plan CAB-01.'], 282, 112);
    S.cartouche({ titre: 'PLAN DE COFFRAGE DU TABLIER', sous: 'travée indépendante à poutres précontraintes — VIPP-EL', ouvrage: ouvrage(bd), numero: bd.numero, echelles: 'coupe 1/' + scT + ', élévation 1/' + scL + ', poutre 1/' + scD, planNo: 'COF-01' });
    return { S, scT, scL, scD };
  }

  /* ---------------- câblage ---------------- */
  // tracé d'un câble : points (abscisse, ordonnée) non nuls, demi-poutre, puis symétrie ; ancrage d'extrémité par prolongement
  function cableHalf(cab, row, Lb) {
    const X = cab.abscisses, pts = [];
    row.forEach((y, j) => { if (y > 0) pts.push([X[j], y]); });
    if (!pts.length) return [];
    if (pts[0][0] > 0.01 && pts.length > 1 && row[0] > 0) { const [a, b] = pts; const s = (b[1] - a[1]) / (b[0] - a[0]); pts.unshift([0, a[1] - s * a[0]]); }
    const half = Lb / 2; if (pts[pts.length - 1][0] < half - 1e-6) pts.push([half, pts[pts.length - 1][1]]);
    // interpolation monotone (Fritsch-Carlson)
    const n = pts.length, d = [], m = [];
    for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
    m[0] = d[0]; m[n - 1] = 0; for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    const out = [];
    for (let i = 0; i < n - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], h = x1 - x0;
      for (let k = 0; k <= 12; k++) { if (i && !k) continue; const t = k / 12, t2 = t * t, t3 = t2 * t;
        out.push([x0 + h * t, (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1]]); } }
    return out;
  }
  function cablage(bd, ic) {
    const P = G.OTPLAN, S = P.Sheet(), e = bd.beam, Lb = bd.PORTEE + 2 * bd.ABOUT, H = e.HPOUT, hh = bd.slab.HHOUR;
    const cab = (bd.cablings || [])[ic || 0]; if (!cab) return null;
    const rows = cab.ordonnees, nc = rows.length, sys = bd.systems || [];
    S.frame();
    // ---------- élévation de la demi-poutre avec les câbles ----------
    const half = Lb / 2, scL = P.pickScale(half + 1, 300, [25, 50, 75, 100, 125, 200]), kL = 1000 / scL, kV = Math.min(70 / (H + hh), kL * 4), ex = kV / kL;
    const ox = 22, oy = 262 - (H + hh) * kV, E = (x, y) => [ox + x * kL, oy + y * kV];
    S.poly([E(0, 0), E(half, 0), E(half, H), E(0, H)], 'CONTOUR', true);
    S.poly([E(0, H), E(0, H + hh), E(half, H + hh)], 'VU');
    for (const y of [e.HPIED + e.H1, e.HPIED + e.H1 + e.H2]) S.poly([E(0, y), E(half, y)], 'CACHE');
    { const a = E(half, -0.2), z = E(half, H + hh + 0.15); S.line(a[0], a[1], z[0], z[1], 'AXE'); S.text(a[0], a[1] - 3, 'mi-travée', 2, { ly: 'AXE' }); }
    { const a = E(bd.ABOUT, 0); S.line(a[0], a[1] - 5, a[0], E(0, H + hh)[1] + 3, 'AXE'); S.poly([[a[0] - 2, a[1] - 0.4], [a[0] + 2, a[1] - 0.4], [a[0] + 2, a[1] - 1.8], [a[0] - 2, a[1] - 1.8]], 'APPAREILS', true); }
    rows.forEach((row, k) => {
      const tr = cableHalf(cab, row, Lb); if (!tr.length) return;
      S.poly(tr.map(p => E(p[0], p[1])), 'CABLES');
      const a = E(tr[0][0], tr[0][1]); S.circle(a[0], a[1], 0.8, 'CABLES', true);
      S.text(a[0] - 1.5, a[1] - 0.8, String(k + 1), 2, { a: 'r', ly: 'CABLES', bold: 1 });
    });
    for (const x of cab.abscisses) { const a = E(x, 0); S.line(a[0], a[1] - 1, a[0], a[1] - 3, 'COTES'); }
    S.chainH([0].concat(cab.abscisses).map(x => E(x, 0)[0]), E(0, 0)[1] - 7, cab.abscisses.map((x, i) => f2(x - (i ? cab.abscisses[i - 1] : 0), 3)), { h: 1.8 });
    S.chainV([E(0, 0)[1], E(0, H)[1], E(0, H + hh)[1]], E(0, 0)[0] - 4, [f2(H, 2), f2(hh, 2)], { h: 1.8 });
    S.title(15, 283, 'ÉLÉVATION DE LA DEMI-POUTRE — CÂBLAGE ' + ((ic || 0) + 1), 'longueurs 1/' + scL + ' — hauteurs ×' + f2(ex, 1) + ' — poutres ' + cab.poutres.join(', ') + ' — tracé symétrique par rapport à mi-travée');
    // ---------- tableau des ordonnées ----------
    const y0 = E(0, 0)[1] - 18;
    S.title(15, y0, 'ORDONNÉES DES CÂBLES (m, depuis la fibre inférieure)', 'abscisses depuis l\'extrémité de la poutre ; « — » : câble absent à cette abscisse');
    const head = ['câble', 'famille'].concat(cab.abscisses.map(x => 'x = ' + f2(x, 3)));
    const body = rows.map((row, k) => { const c = cab.cables[k] || {}; return [String(k + 1), String(c.ARMA || '')].concat(row.map(y => y > 0 ? f2(y, 3) : '—')); });
    const yT = S.table(15, y0 - 8, [14, 16].concat(cab.abscisses.map(() => 22)), [head].concat(body), 4.4);
    // ---------- coupes : about et mi-travée avec les gaines ----------
    const scD = P.pickScale(e.ETAB + 0.3, 60, [10, 20, 25, 50]), kD = 1000 / scD, yC = Math.max(20, yT - 22 - H * kD);
    const dg = (sys[0] && sys[0].DGAINE) || 0.07, AH = (sys[0] && sys[0].AH) || 0.22, AV = (sys[0] && sys[0].AV) || 0.22, enr = (sys[0] && sys[0].ENROB) || 0.07;
    const perRow = Math.max(1, Math.floor((e.ETALON - 2 * enr) / AH + 1e-9) + 1);
    [['À L\'ANCRAGE (x = 0)', 0], ['À MI-TRAVÉE', cab.abscisses.length - 1]].forEach(([lab, j], q) => {
      const cx = 60 + q * 110, D = (x, y) => [cx + x * kD, yC + y * kD], ep = j === 0 ? epam(bd, e, 0) : 0;
      const o = beamOutline(e, ep).map(p => D(p[0], p[1])); S.fill(o, 'BETON'); S.poly(o, 'CONTOUR', true);
      // ordonnées à cette abscisse ; câbles de même niveau répartis horizontalement (pas AH)
      const ys = rows.map((row, k) => { const tr = cableHalf(cab, row, Lb); if (!tr.length) return null; const x = j === 0 ? tr[0][0] : half; if (x < tr[0][0] - 1e-6) return null; let best = tr[0]; for (const p of tr) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p; return { k, y: best[1] }; }).filter(Boolean);
      const lv = {}; ys.forEach(c => { const key = c.y.toFixed(2); (lv[key] = lv[key] || []).push(c); });
      Object.values(lv).forEach(g => g.forEach((c, i) => { const row = j === 0 ? 0 : Math.floor(i / perRow), inRow = j === 0 ? 1 : Math.min(perRow, g.length - row * perRow), col = j === 0 ? 0 : i % perRow;
        const x = (col - (inRow - 1) / 2) * (j === 0 ? 0 : AH), p = D(x, c.y + row * AV); S.circle(p[0], p[1], dg / 2 * kD, 'CABLES'); S.text(p[0] + dg / 2 * kD + 0.6, p[1] - 0.7, String(c.k + 1), 1.7, { a: 'l', ly: 'CABLES' }); }));
      S.text(cx, D(0, H)[1] + 4, 'COUPE ' + lab, 2.4, { bold: 1 });
    });
    S.text(15, yC + H * kD + 10, 'COUPES DE LA POUTRE — échelle 1/' + scD + ' (disposition des gaines indicative)', 2.6, { a: 'l', bold: 1 });
    // ---------- caractéristiques ----------
    const s0 = sys[0] || {}, P0 = n0(s0.SECAB) * 1e-6 * n0(s0.SIGP0) * 101.97;
    S.notes(['CÂBLES (par poutre) :', '— ' + nc + ' câbles : ' + (cab.NCAB11 || 0) + ' + ' + (cab.NCAB12 || 0) + ' de 1re famille, ' + (cab.NCAB2 || 0) + ' de 2e famille (relevés en extrados)',
      '— section ' + f2(n0(s0.SECAB), 0) + ' mm², σp0 = ' + f2(n0(s0.SIGP0), 0) + ' MPa, P0 ≈ ' + f2(P0, 1) + ' t par câble', '— gaines Ø ' + f2(dg * 1000, 0) + ' mm, enrobage ' + f2(n0(s0.ENROB), 3) + ' m',
      '— frottement f = ' + f2(n0(s0.F), 2) + ', φ = ' + f2(n0(s0.PHI), 4) + ' /m, recul ' + f2(n0(s0.RECUL) * 1000, 0) + ' mm'], 282, 112);
    S.cartouche({ titre: 'PLAN DE CÂBLAGE DES POUTRES', sous: 'travée indépendante à poutres précontraintes — VIPP-EL', ouvrage: ouvrage(bd), numero: bd.numero, echelles: 'élévation 1/' + scL + ' (hauteurs ×' + f2(ex, 1) + '), coupes 1/' + scD, planNo: 'CAB-0' + ((ic || 0) + 1) });
    return { S, scL, scD, ex, nc };
  }
  G.VIPP_PLANS = { coffrage, cablage, beamOutline };
})(typeof window !== 'undefined' ? window : globalThis);
