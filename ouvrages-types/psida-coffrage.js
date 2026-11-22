/* PSIDA-EL — plan de coffrage du tablier (BridgeAI / KLE Ingénierie)
   Une seule liste de primitives en millimètres papier (format A3 paysage, 420 × 297, y vers le haut), rendue
   en SVG (page de la note) et en DXF R12 (AutoCAD). Chaque vue a sa propre échelle, notée sous son titre ; les
   cotes affichent les vraies dimensions (m). Géométrie : lignes A5 (travées, biais, about), A6 (profil en travers),
   A7 / C8 (dalle SETRA / dalle réelle), A13 (appareils), C11 (entraxes réels), résultats (dimensions des appareils). */
(function (G) {
  const GR = Math.PI / 200, n0 = v => (isFinite(+v) ? +v : 0);
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
  const SHEET = { W: 420, H: 297 };
  const LAYERS = {   // nom : [couleur ACI, type de ligne, épaisseur SVG (mm)]
    CONTOUR: [7, 'CONTINUOUS', 0.5], VU: [7, 'CONTINUOUS', 0.25], CACHE: [8, 'DASHED', 0.25], AXE: [1, 'DASHDOT', 0.18],
    COTES: [3, 'CONTINUOUS', 0.13], TEXTE: [7, 'CONTINUOUS', 0.18], APPAREILS: [5, 'CONTINUOUS', 0.35], CADRE: [7, 'CONTINUOUS', 0.5],
    CARTOUCHE: [7, 'CONTINUOUS', 0.25], BETON: [8, 'CONTINUOUS', 0],
  };

  function geometry(m, r) {
    const L = m.lignes || {}, A5 = L.A5 || {}, A6 = L.A6 || {}, A7 = L.A7 || {}, A13 = L.A13 || {}, C8 = L.C8 || {}, C11 = L.C11 || {};
    const n = Math.max(1, Math.min(6, Math.round(n0(A5.NT)) || 1)), D = []; for (let i = 1; i <= n; i++) D.push(Math.max(0.5, n0(A5['D' + i])));
    const ab = Math.max(0, n0(A5.ABOUT)), xs = [ab]; for (const d of D) xs.push(xs[xs.length - 1] + d);
    const Lt = xs[n] + ab, bg = Math.max(20, Math.min(100, n0(A5.BIAIS) || 100)), phi = bg * GR, ct = Math.cos(phi) / Math.sin(phi);
    const tro = [n0(A6.ETROTG), n0(A6.EGAU), n0(A6.ESURCH), n0(A6.EDROI), n0(A6.ETROTD)].map(v => Math.max(0, v));
    const Wp = tro.reduce((a, b) => a + b, 0), hc = Math.max(0, n0(A6.HCHAU));
    // section : dalle réelle (C8) si elle est décrite, sinon dalle SETRA équivalente (A7)
    let sec;
    const f = Math.round(n0(C8.FORME));
    if (f > 0 && n0(C8.N) > 0) {
      const enc = f === 1 || f === 2, H1 = n0(C8.H1), H2 = enc ? n0(C8.H2) : 0, H3 = n0(C8.H3), p = f === 1 || f === 3 ? n0(C8.PENTE) / 100 : 0;
      const E1 = enc ? n0(C8.E1) : 0, E2 = n0(C8.E2), N = n0(C8.N), W = N + 2 * (E1 + E2), yE = H1 + H2 + H3, Hax = yE + p * W / 2;
      const x0 = N / 2, x2 = W / 2, x1 = x2 - E1;
      const half = [[x0, 0]].concat(enc ? [[x1, H3], [x2, H3 + H2]] : [[x2, H3]], [[x2, yE]]);
      sec = { real: true, enc, H1, H2, H3, p, E1, E2, N, W, yE, Hax, half, top: x => yE + p * (x2 - Math.abs(x)), xN: x0, xR: x1 };
    } else {
      const H1 = Math.max(0.3, n0(A7.HDALLE1)), H2 = Math.max(0, n0(A7.HDALLE2)), H3 = Math.max(0, n0(A7.HDALLE3));
      const E1 = Math.max(0.5, n0(A7.EDALLE1)), E2 = Math.max(0, n0(A7.EDALLE2)), E3 = Math.max(0, n0(A7.EDALLE3));
      const xa = E1 / 2, xb = E1 / 2 + Math.min(E3, E2) / 2, xc = (E1 + E2) / 2;
      const half = [[xa, 0]].concat(xb > xa ? [[xb, H3]] : [[xa, H3]], xc > xb ? [[xc, H1 - H2]] : [], [[xc, H1]]);
      sec = { real: false, enc: xc > xb, H1, W: 2 * xc, yE: H1, Hax: H1, half, top: () => H1, xN: xa, xR: xb, N: E1, p: 0 };
    }
    // appareils d'appui : positions le long de la ligne d'appui (symétriques), dimensions issues du calcul
    const lignes = [];
    for (let k = 0; k <= n; k++) {
      const na = Math.max(0, Math.round(n0(A13['NAP' + (k + 1)])));
      const ap = r && r.appuis && r.appuis[k], esp = ap && ap.esp > 0 ? ap.esp : (na > 1 ? Math.floor(100 * sec.N / (na - 0.6) / Math.sin(phi) + 1e-9) / 100 : 0);
      let a = n0(C11['A' + (k + 1)]), e = n0(C11['E' + (k + 1)]); const reg = !(a > 0); if (reg) a = esp; if (!(e > 0)) e = a;
      let t = [];
      if (reg || na < 2 || na > 4) for (let j = 0; j < na; j++) t.push((j - (na - 1) / 2) * esp);
      else if (na === 2) t = [-a / 2, a / 2]; else if (na === 3) t = [-a, 0, a]; else t = [-e / 2 - a, -e / 2, e / 2, e / 2 + a];
      const dim = r && r.fer && r.fer.appareils && r.fer.appareils[k];
      lignes.push({ k, na, t, a, e, reg, esp, lo: dim && dim.larg > 0 ? dim.larg : 0.40, tr: dim && dim.long > 0 ? dim.long : 0.50, sized: !!dim });
    }
    const nom = k => k === 0 ? 'C0' : k === n ? 'C' + n : 'P' + k;
    return { n, D, ab, xs, Lt, bg, phi, ct, tro, Wp, hc, sec, lignes, nom };
  }

  /* ---------- primitives ---------- */
  function Sheet() {
    const P = [];
    const o = {
      P,
      line: (x1, y1, x2, y2, ly) => P.push({ t: 'L', p: [[x1, y1], [x2, y2]], ly }),
      poly: (pts, ly, closed) => P.push({ t: 'P', p: pts, ly, c: !!closed }),
      fill: (pts, ly) => P.push({ t: 'F', p: pts, ly }),
      text: (x, y, s, h, opt) => P.push(Object.assign({ t: 'T', x, y, s: String(s), h, ly: 'TEXTE', a: 'c', v: 'b', rot: 0 }, opt || {})),
      // cote alignée entre p1 et p2, ligne décalée de off (mm, normale à gauche de p1→p2), attaches depuis les points
      dim(p1, p2, off, s, opt) {
        opt = opt || {};
        const dx = p2[0] - p1[0], dy = p2[1] - p1[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
        const a = [p1[0] + nx * off, p1[1] + ny * off], b = [p2[0] + nx * off, p2[1] + ny * off], sg = off >= 0 ? 1 : -1;
        if (!opt.noExt) { o.line(p1[0] + nx * sg * 1, p1[1] + ny * sg * 1, a[0] + nx * sg * 1.5, a[1] + ny * sg * 1.5, 'COTES'); o.line(p2[0] + nx * sg * 1, p2[1] + ny * sg * 1, b[0] + nx * sg * 1.5, b[1] + ny * sg * 1.5, 'COTES'); }
        o.line(a[0], a[1], b[0], b[1], 'COTES');
        for (const q of [a, b]) o.line(q[0] - (ux + nx) * 0.9, q[1] - (uy + ny) * 0.9, q[0] + (ux + nx) * 0.9, q[1] + (uy + ny) * 0.9, 'COTES');
        let rot = Math.atan2(uy, ux) * 180 / Math.PI; if (rot > 90.01 || rot < -89.99) rot += 180;
        const h = opt.h || 2.2, tx = (a[0] + b[0]) / 2, ty = (a[1] + b[1]) / 2, small = L < s.length * h * 0.75 + 2;
        if (opt.right) { o.text(tx + 1.8, ty - h * 0.45, s, h, { a: 'l', ly: 'COTES' }); return; }   // texte horizontal à droite de la cote
        const sh = small && opt.outside !== false ? (L / 2 + s.length * h * 0.42 + 1.5) : 0;
        o.text(tx + ux * sh + nx * 0.8, ty + uy * sh + ny * 0.8, s, h, { rot, v: 'b', ly: 'COTES' });
      },
    };
    return o;
  }

  /* ---------- planche ---------- */
  const SCP = [50, 75, 100, 125, 200, 250, 500, 1000], SCT = [20, 25, 50, 75, 100, 125, 200];
  function build(m, r, info) {
    info = info || {};
    const g = geometry(m, r), S = Sheet(), s = g.sec, Wd = s.W, Wtop = Math.max(Wd, g.Wp);
    const ex = Wd / 2 * Math.abs(g.ct);
    // cadre
    S.poly([[10, 10], [410, 10], [410, 287], [10, 287]], 'CADRE', true);
    // ---------- échelles ----------
    const scP = SCP.find(sc => (g.Lt + 2 * ex + 6) * 1000 / sc <= 340 && (Wd + 5) * 1000 / sc <= 78) || 1000, kP = 1000 / scP;
    const hT = 268 - (Wd / 2 + 2.8) * kP - Wd * kP - 24 - 16 - s.Hax * kP - 26 - 20 - 36;   // hauteur restante pour la coupe transversale
    const scT = SCT.find(sc => (Wtop + 1.2) * 1000 / sc <= 215 && (s.Hax + g.hc + 0.2) * 1000 / sc <= hT) || 200, kT = 1000 / scT;
    // ---------- vue en plan ----------
    const oxP = 215 - (g.Lt / 2) * kP, oyP = 268 - (Wd / 2 + 2.8) * kP;                 // axe de l'ouvrage
    const P = (x, y) => [oxP + x * kP, oyP + y * kP];
    const lineM = (x1, y1, x2, y2, ly) => { const a = P(x1, y1), b = P(x2, y2); S.line(a[0], a[1], b[0], b[1], ly); };
    const ylo = -Wd / 2, yhi = Wd / 2, X0 = y => y * g.ct, X1 = y => g.Lt + y * g.ct;
    S.poly([P(X0(ylo), ylo), P(X1(ylo), ylo), P(X1(yhi), yhi), P(X0(yhi), yhi)], 'CONTOUR', true);
    // arêtes cachées (nervure, naissance des encorbellements) et bordures de trottoir (vues)
    const hid = s.real ? [s.xN].concat(s.enc ? [s.xR] : []) : [s.xN].concat(s.xR > s.xN ? [s.xR] : []);
    for (const yy of hid) for (const sg of [-1, 1]) if (yy < Wd / 2 - 1e-6) lineM(X0(sg * yy), sg * yy, X1(sg * yy), sg * yy, 'CACHE');
    const yT = [Wd / 2 - g.tro[0], -Wd / 2 + g.tro[4]];
    if (g.tro[0] > 0) lineM(X0(yT[0]), yT[0], X1(yT[0]), yT[0], 'VU');
    if (g.tro[4] > 0) lineM(X0(yT[1]), yT[1], X1(yT[1]), yT[1], 'VU');
    // axe longitudinal
    lineM(-ex - 2.5, 0, g.Lt + ex + 2.5, 0, 'AXE');
    { const q = P(g.Lt + ex + 2.6, 0); S.text(q[0] + 1, q[1] + 0.8, 'axe', 2.2, { a: 'l', ly: 'AXE' }); }
    // lignes d'appui et appareils
    const u = [Math.cos(g.phi), Math.sin(g.phi)], w = [Math.sin(g.phi), -Math.cos(g.phi)];
    g.lignes.forEach((l, k) => {
      const x = g.xs[k], e1 = Wd / 2 + 2.2;
      lineM(x - e1 * g.ct, -e1, x + e1 * g.ct, e1, 'AXE');
      const q = P(x + (e1 + 0.6) * g.ct, e1 + 0.6); S.text(q[0], q[1] + 0.5, g.nom(k), 3, { ly: 'TEXTE' });
      for (const t of l.t) {
        const c = [x + t * u[0], t * u[1]], hl = l.tr / 2, hw = l.lo / 2;
        const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P(c[0] + a * hl * u[0] + b * hw * w[0], c[1] + a * hl * u[1] + b * hw * w[1]));
        S.poly(pts, 'APPAREILS', true);
      }
    });
    // cotes : travées et abouts suivant l'axe, longueur totale ; largeurs à droite
    const yd = P(0, ylo)[1] - 6;
    const chain = [0].concat(g.xs, [g.Lt]);
    for (let i = 0; i < chain.length - 1; i++) {
      const a = P(chain[i], 0)[0], b = P(chain[i + 1], 0)[0];
      S.dim([a, yd], [b, yd], 0, f2(chain[i + 1] - chain[i], 2), { noExt: true, outside: false });
    }
    for (const x of chain) { const a = P(x, 0)[0]; S.line(a, yd - 1.5, a, yd + 1.5, 'COTES'); }
    { const a = P(0, 0)[0], b = P(g.Lt, 0)[0]; S.dim([a, yd - 7], [b, yd - 7], 0, f2(g.Lt, 2) + ' (longueur suivant l\'axe)', { noExt: true }); S.line(a, yd - 8.5, a, yd + 1.5, 'COTES'); S.line(b, yd - 8.5, b, yd + 1.5, 'COTES'); }
    { const xr = P(g.Lt + ex, 0)[0] + 10, xr2 = xr + 9; let y0 = Wd / 2; const parts = [[g.tro[0], 'trottoir'], [g.tro[1] + g.tro[2] + g.tro[3], 'chaussée'], [g.tro[4], 'trottoir']].filter(p => p[0] > 0);
      if (Math.abs(g.Wp - Wd) < 0.02) for (const [wv] of parts) { const a = P(0, y0)[1], b = P(0, y0 - wv)[1]; S.dim([xr, a], [xr, b], 0, f2(wv, 2), { noExt: true, h: 2 }); y0 -= wv; }
      S.dim([xr2, P(0, Wd / 2)[1]], [xr2, P(0, -Wd / 2)[1]], 0, f2(Wd, 2), { noExt: true });
      for (const yy of [Wd / 2, -Wd / 2]) S.line(P(g.Lt + yy * g.ct, yy)[0] + 1, P(0, yy)[1], xr2 + 1.5, P(0, yy)[1], 'COTES'); }
    if (Math.abs(g.bg - 100) > 1e-6) { const a = P(X0(yhi), yhi); S.text(a[0] - 2, a[1] + 2, 'biais ' + f2(g.bg, 1) + ' gr', 2.5, { a: 'r' }); }
    else { const a = P(X0(yhi), yhi); S.text(a[0] - 2, a[1] + 2, 'pont droit (100 gr)', 2.5, { a: 'r' }); }
    S.text(15, 280, 'VUE EN PLAN', 4, { a: 'l', ly: 'TEXTE', bold: 1 }); S.text(15, 275.5, 'échelle 1/' + scP, 2.5, { a: 'l' });
    const tL = oyP - Wd / 2 * kP - 24;
    // ---------- coupe longitudinale (suivant l'axe) ----------
    const oyL = tL - 16, H = s.Hax, L2 = (x, y) => [oxP + x * kP, oyL + y * kP];
    S.poly([L2(0, -H), L2(g.Lt, -H), L2(g.Lt, 0), L2(0, 0)], 'CONTOUR', true);
    S.fill([L2(0, -H), L2(g.Lt, -H), L2(g.Lt, 0), L2(0, 0)], 'BETON');
    if (g.hc > 0) { const a = L2(0, g.hc), b = L2(g.Lt, g.hc); S.line(a[0], a[1], b[0], b[1], 'VU'); }
    g.lignes.forEach((l, k) => {
      const x = g.xs[k], a = L2(x, -H);
      S.line(a[0], a[1] - 9, a[0], L2(x, 0)[1] + 6, 'AXE');
      S.poly([[a[0] - 2.2, a[1] - 0.6], [a[0] + 2.2, a[1] - 0.6], [a[0] + 2.2, a[1] - 2.4], [a[0] - 2.2, a[1] - 2.4]], 'APPAREILS', true);
      S.text(a[0], L2(x, 0)[1] + 7, g.nom(k), 3);
    });
    { const yb = L2(0, -H)[1] - 13;
      for (let i = 0; i < chain.length - 1; i++) S.dim([L2(chain[i], 0)[0], yb], [L2(chain[i + 1], 0)[0], yb], 0, f2(chain[i + 1] - chain[i], 2), { noExt: true, outside: false });
      for (const x of chain) { const a = L2(x, 0)[0]; S.line(a, yb - 1.5, a, yb + 1.5, 'COTES'); }
      const a = L2(0, 0), b = L2(0, -H); S.dim([a[0] - 6, a[1]], [a[0] - 6, b[1]], 0, f2(H, 3), { noExt: true, h: 2 }); }
    S.text(15, tL, 'COUPE LONGITUDINALE SUIVANT L\'AXE', 4, { a: 'l', bold: 1 }); S.text(15, tL - 4.5, 'échelle 1/' + scP + (s.real && s.p > 0 ? ' — épaisseur à l\'axe (extrados bombé)' : ''), 2.5, { a: 'l' });
    // ---------- coupe transversale ----------
    const tT = oyL - H * kP - 26, oyT = tT - 20 - (s.Hax + g.hc + 0.2) * kT, oxT = 140, T = (x, y) => [oxT + x * kT, oyT + y * kT];
    const half = s.half, full = half.map(p => [-p[0], p[1]]).reverse().concat(half);
    let outline;
    if (s.real) { const top = []; const xr = s.W / 2; top.push([xr, s.yE], [0, s.Hax], [-xr, s.yE]); outline = half.concat([[0, s.Hax]], half.slice().reverse().map(p => [-p[0], p[1]])); }
    else outline = full;
    const OT = outline.map(p => T(p[0], p[1]));
    S.fill(OT, 'BETON'); S.poly(OT, 'CONTOUR', true);
    // trottoirs et revêtement
    const xl = -s.W / 2, xrr = s.W / 2, ht = 0.20;
    if (g.tro[0] > 0) { const xi = xl + g.tro[0], yi = s.top(xi); S.poly([T(xl, s.yE), T(xi, yi), T(xi, yi + g.hc + ht), T(xl, yi + g.hc + ht)], 'VU', true); }
    if (g.tro[4] > 0) { const xi = xrr - g.tro[4], yi = s.top(xi); S.poly([T(xrr, s.yE), T(xi, yi), T(xi, yi + g.hc + ht), T(xrr, yi + g.hc + ht)], 'VU', true); }
    if (g.hc > 0) { const xa = xl + g.tro[0], xb = xrr - g.tro[4]; S.poly([T(xa, s.top(xa) + g.hc), T(0, s.Hax + g.hc), T(xb, s.top(xb) + g.hc)], 'VU'); }
    // axe et appareils (ligne P1 ou culée si une seule travée) projetés sur la coupe droite
    { const a = T(0, -0.6), b = T(0, s.Hax + g.hc + 0.6); S.line(a[0], a[1], b[0], b[1], 'AXE'); }
    const lp = g.lignes[g.n > 1 ? 1 : 0];
    for (const t of lp.t) { const x = t * Math.sin(g.phi), hw = Math.max(lp.tr * Math.sin(g.phi), 0.2) / 2; S.poly([T(x - hw, 0), T(x + hw, 0), T(x + hw, -0.08), T(x - hw, -0.08)], 'APPAREILS', true); }
    // cotes transversales
    const yb = T(0, 0)[1] - 7;
    if (s.real) {
      const xs2 = s.enc ? [-s.W / 2, -s.xR, -s.xN, s.xN, s.xR, s.W / 2] : [-s.W / 2, -s.xN, s.xN, s.W / 2];
      for (let i = 0; i < xs2.length - 1; i++) S.dim([T(xs2[i], 0)[0], yb], [T(xs2[i + 1], 0)[0], yb], 0, f2(xs2[i + 1] - xs2[i], 2), { noExt: true, h: 2 });
      for (const x of xs2) { const a = T(x, 0); S.line(a[0], yb - 1.5, a[0], Math.min(a[1] - 1, T(x, s.real ? (Math.abs(x) >= s.W / 2 - 1e-6 ? s.H3 + s.H2 : Math.abs(x) > s.xN + 1e-6 ? s.H3 : 0) : 0)[1] - 1), 'COTES'); }
    }
    S.dim([T(-s.W / 2, 0)[0], yb - 7], [T(s.W / 2, 0)[0], yb - 7], 0, f2(s.W, 2), { noExt: true });
    for (const x of [-s.W / 2, s.W / 2]) { const a = T(x, 0)[0]; S.line(a, yb - 8.5, a, yb + 1.5, 'COTES'); }
    { const yt = T(0, s.Hax + g.hc + ht)[1] + 6; let x0 = -Wtop / 2; const tops = [[g.tro[0]], [g.tro[1] + g.tro[2] + g.tro[3]], [g.tro[4]]].map(a => a[0]).filter(v => v > 0);
      if (Math.abs(g.Wp - s.W) < 0.02) { for (const wv of tops) { S.dim([T(x0, 0)[0], yt], [T(x0 + wv, 0)[0], yt], 0, f2(wv, 2), { noExt: true, h: 2 }); S.line(T(x0, 0)[0], yt - 1.5, T(x0, 0)[0], yt + 1.5, 'COTES'); x0 += wv; } S.line(T(x0, 0)[0], yt - 1.5, T(x0, 0)[0], yt + 1.5, 'COTES'); } }
    { const xR = T(s.W / 2, 0)[0] + 7;
      if (s.real) {   // chaîne verticale à l'extrémité : H3 (gousset), H2 (sous-face de l'encorbellement), H1 (about de console)
        const lv = [[0, s.H3, 'H3'], ...(s.enc && s.H2 > 0 ? [[s.H3, s.H3 + s.H2, 'H2']] : []), [s.yE - s.H1, s.yE, 'H1']];
        for (const [y1, y2, nm] of lv) S.dim([xR, T(0, y1)[1]], [xR, T(0, y2)[1]], 0, nm + ' = ' + f2(y2 - y1, 2), { noExt: true, h: 1.9, right: true });
        for (const y of [0, s.H3, s.H3 + s.H2, s.yE]) S.line(T(s.W / 2, 0)[0] + 1, T(0, y)[1], xR + 1.5, T(0, y)[1], 'COTES'); }
      const xa = T(0, 0)[0] + 3; S.dim([xa, T(0, 0)[1]], [xa, T(0, s.Hax)[1]], 0, f2(s.Hax, 3), { noExt: true, h: 2 });
      if (s.p > 0) for (const sg of [-1, 1]) { const x = sg * s.W * 0.27, q = T(x, s.top(x) + g.hc); S.text(q[0], q[1] + 2.5, (sg < 0 ? '← ' : '') + f2(s.p * 100, 1) + ' %' + (sg > 0 ? ' →' : ''), 2.2); } }
    S.text(15, tT, 'COUPE TRANSVERSALE COURANTE', 4, { a: 'l', bold: 1 }); S.text(15, tT - 4.5, 'échelle 1/' + scT + (lp.na ? ' — appareils de la ligne ' + g.nom(lp.k) : ''), 2.5, { a: 'l' });
    // ---------- cartouche KLE ----------
    const cx0 = 282, cy0 = 10, cw = 128, chh = 76;
    S.poly([[cx0, cy0], [cx0 + cw, cy0], [cx0 + cw, cy0 + chh], [cx0, cy0 + chh]], 'CARTOUCHE', true);
    const rows = [cy0 + 62, cy0 + 50, cy0 + 34, cy0 + 22, cy0 + 12];
    for (const y of rows) S.line(cx0, y, cx0 + cw, y, 'CARTOUCHE');
    S.line(cx0 + 64, cy0, cx0 + 64, cy0 + 22, 'CARTOUCHE');
    S.text(cx0 + cw / 2, cy0 + 67.5, 'KLE INGÉNIERIE', 5, { bold: 1 });
    S.text(cx0 + cw / 2, cy0 + 64, 'Bureau d\'études techniques — ouvrages d\'art', 2.2);
    S.text(cx0 + cw / 2, cy0 + 55, 'PLAN DE COFFRAGE DU TABLIER', 4, { bold: 1 });
    S.text(cx0 + cw / 2, cy0 + 51.2, 'pont-dalle en béton armé — PSIDA-EL', 2.4);
    const tt = (m.titre || []).map(x => String(x || '').trim()).filter(Boolean);
    S.text(cx0 + cw / 2, cy0 + 44, tt[0] || 'ouvrage', 2.8);
    if (tt[1]) S.text(cx0 + cw / 2, cy0 + 39, tt[1], 2.5);
    S.text(cx0 + 3, cy0 + 27, 'Note de calcul n° ' + (m.numero || '—'), 2.5, { a: 'l' });
    S.text(cx0 + 3, cy0 + 24, 'Échelles : plan 1/' + scP + ', coupe 1/' + scT, 2.2, { a: 'l' });
    S.text(cx0 + cw - 3, cy0 + 27, 'Format A3', 2.5, { a: 'r' });
    S.text(cx0 + 3, cy0 + 16, 'Date : ' + (info.date || ''), 2.5, { a: 'l' });
    S.text(cx0 + 67, cy0 + 16, 'Indice : A', 2.5, { a: 'l' });
    S.text(cx0 + 3, cy0 + 4.5, 'Dessiné : BridgeAI Studios', 2.2, { a: 'l' });
    S.text(cx0 + 67, cy0 + 4.5, 'Vérifié :', 2.2, { a: 'l' });
    S.text(cx0 + 3, cy0 + 8.5, 'Établi par : KLE Ingénierie', 2.2, { a: 'l' });
    S.text(cx0 + 67, cy0 + 8.5, 'Plan n° : COF-01', 2.2, { a: 'l' });
    // notes
    const notes = ['NOTES :', '— cotes en mètres ; travées mesurées suivant l\'axe de l\'ouvrage.',
      '— appareils d\'appui : ' + (g.lignes.some(l => !l.reg) ? 'entraxes réels (ligne C11)' : 'espacement régulier de la note') + ', dimensions ' + (g.lignes.some(l => l.sized) ? 'du calcul' : 'indicatives') + '.',
      '— ' + (s.real ? 'section : dalle réelle (ligne C8).' : 'section : dalle SETRA équivalente (ligne A7).')];
    notes.forEach((t, i) => S.text(282, 115 - i * 4.2, t, 2.2, { a: 'l' }));
    return { S, g, scP, scT };
  }

  /* ---------- rendu SVG ---------- */
  function toSVG(b) {
    const H = SHEET.H, esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    let o = `<svg viewBox="0 0 ${SHEET.W} ${H}" width="100%" style="background:#fff;display:block" font-family="Arial Narrow, Arial, sans-serif"><defs><pattern id="cofH" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="2" stroke="#b9b3a6" stroke-width="0.25"/></pattern></defs>`;
    const pt = p => `${(+p[0]).toFixed(2)},${(H - p[1]).toFixed(2)}`;
    const sty = ly => { const [c, lt, w] = LAYERS[ly] || LAYERS.VU; const col = ly === 'AXE' ? '#c0392b' : ly === 'COTES' ? '#1a4fd6' : ly === 'APPAREILS' ? '#1a4fd6' : ly === 'CACHE' ? '#555' : '#111';
      return `stroke="${col}" stroke-width="${w}" fill="none"${lt === 'DASHED' ? ' stroke-dasharray="2 1.2"' : lt === 'DASHDOT' ? ' stroke-dasharray="6 1.2 1 1.2"' : ''}`; };
    for (const q of b.S.P) {
      if (q.t === 'F') o += `<polygon points="${q.p.map(pt).join(' ')}" fill="url(#cofH)" stroke="none"/>`;
      else if (q.t === 'L' || q.t === 'P') o += `<${q.c ? 'polygon' : 'polyline'} points="${q.p.map(pt).join(' ')}" ${sty(q.ly)} stroke-linejoin="round"/>`;
      else if (q.t === 'T') {
        const an = q.a === 'l' ? 'start' : q.a === 'r' ? 'end' : 'middle', col = q.ly === 'COTES' ? '#1a4fd6' : q.ly === 'AXE' ? '#c0392b' : '#111';
        o += `<text x="${q.x.toFixed(2)}" y="${(H - q.y).toFixed(2)}" font-size="${(q.h / 0.72).toFixed(2)}" text-anchor="${an}" fill="${col}"${q.bold ? ' font-weight="700"' : ''}${q.rot ? ` transform="rotate(${(-q.rot).toFixed(2)} ${q.x.toFixed(2)} ${(H - q.y).toFixed(2)})"` : ''}>${esc(q.s)}</text>`;
      }
    }
    return o + '</svg>';
  }

  /* ---------- rendu DXF R12 (unités : mm papier) ---------- */
  function toDXF(b) {
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
    for (const q of b.S.P) {
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

  let last = null;
  function page(m, r) {
    const d = new Date(), info = { date: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear() };
    last = { m, b: build(m, r, info) };
    return { svg: toSVG(last.b), scP: last.b.scP, scT: last.b.scT };
  }
  function download() {
    if (!last) return;
    save(new Blob([toDXF(last.b)], { type: 'application/dxf' }), 'coffrage-PSIDA-' + (last.m.numero || 'tablier') + '.dxf');
  }
  function save(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function downloadSVG() { if (!last) return; const svg = toSVG(last.b).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" ').replace('width="100%" ', ''); save(new Blob([svg], { type: 'image/svg+xml' }), 'coffrage-PSIDA-' + (last.m.numero || 'tablier') + '.svg'); }
  function printPDF() {   // impression A3 paysage (enregistrer en PDF depuis la boîte d'impression)
    if (!last) return; const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Plan de coffrage ${last.m.numero || ''}</title><style>@page{size:A3 landscape;margin:0}html,body{margin:0}svg{width:420mm;height:297mm;display:block}</style></head><body>${toSVG(last.b).replace('width="100%" ', '')}</body></html>`);
    w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 300);
  }
  G.PSIDA_COF = { geometry, build, toSVG, toDXF, page, download, downloadSVG, printPDF };
})(typeof window !== 'undefined' ? window : globalThis);
