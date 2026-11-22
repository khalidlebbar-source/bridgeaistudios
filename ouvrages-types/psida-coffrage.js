/* PSIDA-EL — plan de coffrage du tablier (BridgeAI / KLE Ingénierie)
   Une seule liste de primitives en millimètres papier (format A3 paysage, 420 × 297, y vers le haut), rendue
   en SVG (page de la note) et en DXF R12 (AutoCAD). Chaque vue a sa propre échelle, notée sous son titre ; les
   cotes affichent les vraies dimensions (m). Géométrie : lignes A5 (travées, biais, about), A6 (profil en travers),
   A7 / C8 (dalle SETRA / dalle réelle), A13 (appareils), C11 (entraxes réels), résultats (dimensions des appareils). */
(function (G) {
  const GR = Math.PI / 200, n0 = v => (isFinite(+v) ? +v : 0);
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);

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

  /* ---------- planche ---------- */
  const SCP = [50, 75, 100, 125, 200, 250, 500, 1000], SCT = [20, 25, 50, 75, 100, 125, 200];
  /* section SETRA équivalente (HDALLE/EDALLE, même convention PSIDA et PSIDP) */
  function secSetra(H1, H2, H3, E1, E2, E3) {
    H1 = Math.max(0.3, H1); H2 = Math.max(0, H2); H3 = Math.max(0, H3); E1 = Math.max(0.5, E1); E2 = Math.max(0, E2); E3 = Math.max(0, E3);
    const xa = E1 / 2, xb = E1 / 2 + Math.min(E3, E2) / 2, xc = (E1 + E2) / 2;
    const half = [[xa, 0]].concat(xb > xa ? [[xb, H3]] : [[xa, H3]], xc > xb ? [[xc, H1 - H2]] : [], [[xc, H1]]);
    return { real: false, enc: xc > xb, H1, W: 2 * xc, yE: H1, Hax: H1, half, top: () => H1, xN: xa, xR: xb, N: E1, p: 0 };
  }
  function build(m, r, info) {
    const g = geometry(m, r), s = g.sec;
    return layout(g, Object.assign({ sous: 'pont-dalle en béton armé — PSIDA-EL', ouvrage: m.titre, numero: m.numero,
      notes: ['NOTES :', '— cotes en mètres ; travées mesurées suivant l\'axe de l\'ouvrage.',
        '— appareils d\'appui : ' + (g.lignes.some(l => !l.reg) ? 'entraxes réels (ligne C11)' : 'espacement régulier de la note') + ', dimensions ' + (g.lignes.some(l => l.sized) ? 'du calcul' : 'indicatives') + '.',
        '— ' + (s.real ? 'section : dalle réelle (ligne C8).' : 'section : dalle SETRA équivalente (ligne A7).')] }, info || {}));
  }
  /* planche de coffrage d'un tablier-dalle à partir d'une géométrie normalisée g (voir geometry) */
  function layout(g, meta) {
    const info = meta, S = G.OTPLAN.Sheet(), s = g.sec, Wd = s.W, Wtop = Math.max(Wd, g.Wp);
    const ex = Wd / 2 * Math.abs(g.ct);
    // cadre
    S.frame();
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
    S.cartouche({ titre: meta.titre || 'PLAN DE COFFRAGE DU TABLIER', sous: meta.sous, ouvrage: meta.ouvrage, numero: meta.numero, echelles: 'plan 1/' + scP + ', coupe 1/' + scT, date: info.date, planNo: meta.planNo || 'COF-01' });
    S.notes(meta.notes);
    // quantités (avant-métré) : section transversale × longueur, coffrage de sous-face et des rives
    { const sc0 = g.sec, hp = sc0.half, ar = (() => { const P0 = [[-hp[0][0], 0]].concat(hp.map(p => [p[0], p[1]])).concat(hp.slice().reverse().map(p => [-p[0], p[1]])); let a = 0; for (let i = 0; i < P0.length; i++) { const p = P0[i], q = P0[(i + 1) % P0.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); })();
      let per = 0; for (let i = 0; i < hp.length - 1; i++) per += Math.hypot(hp[i + 1][0] - hp[i][0], hp[i + 1][1] - hp[i][1]); per = 2 * per + 2 * hp[0][0];
      const rowsQ = [['Désignation', 'Unité', 'Quantité'], ['Béton du tablier', 'm³', (ar * g.Lt).toFixed(1)], ['Coffrage perdu / sous-face et rives', 'm²', (per * g.Lt).toFixed(1)], ['Coffrage des abouts (2)', 'm²', (2 * ar / Math.sin(g.phi)).toFixed(1)], ['Section transversale', 'm²', ar.toFixed(3)]];
      S.text(345, 151, 'QUANTITÉS (avant-métré)', 2.8, { bold: 1 }); S.table(284, 148, [86, 12, 22], rowsQ, 4.4); }
    return { S, g, scP, scT };
  }

  G.PSIDA_COF = G.DALLE_COF = { geometry, build, layout, secSetra };
})(typeof window !== 'undefined' ? window : globalThis);
