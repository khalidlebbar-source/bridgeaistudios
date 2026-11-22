/* PICF-EL — plan de coffrage du cadre (BridgeAI / KLE Ingénierie)
   Planche A3 : coupe transversale droite (goussets CHAMOA, corbeaux et dalles de transition, remblai, chaussée, niveaux),
   coupe B-B suivant l'axe du cadre (profil en travers de la voie portée), vue en plan biaise, détail du corbeau,
   tableau des quantités (béton, coffrage). Données : GEOM.*, PROF.* du bordereau ; y = 0 sous le radier. */
(function (G) {
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d)).toFixed(d == null ? 2 : d);
  const V = (m, k) => { const x = parseFloat(String(m[k] == null ? '' : m[k]).replace(/[=c]/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
  const sgn = v => (v > 0.0049 ? '+' : v < -0.0049 ? '−' : '±') + f2(Math.abs(v));
  const goussets = o => ({ gs: o <= 3 ? [0.2, 0.2] : o <= 5 ? [0.6, 0.3] : [0.9, 0.3], gi: o <= 2 ? [0.3, 0.2] : o <= 4 ? [0.5, 0.3] : [0.7, 0.5] });   // doc. CHAMOA PICF
  const DT = { ep: 0.30, pente: 0.05, cb: 0.30, hb: 0.25, ch: 0.10 };   // dalle de transition et corbeau (dispositions courantes SETRA)

  function geometry(m) {
    const o = V(m, 'GEOM.OUVER') || 1, h = V(m, 'GEOM.HAUTL') || 1, e1 = V(m, 'GEOM.E1') || 0.3, e2 = V(m, 'GEOM.E2') || 0.3, e3 = V(m, 'GEOM.E3') || 0.3;
    const ld = V(m, 'GEOM.LDALT'), hs = V(m, 'PROF.HSREM'), hc = V(m, 'PROF.HCHAU'), bg = Math.max(30, Math.min(100, V(m, 'GEOM.BIAIS') || 100));
    const ws = ['PROF.ETROTG', 'PROF.EGAU', 'PROF.ESURCH', 'PROF.EDROI', 'PROF.ETROTD'].map(k => V(m, k)), sum = ws.reduce((a, b) => a + b, 0);
    const W = V(m, 'PROF.LARGE') || sum || 10, b = bg * Math.PI / 200, s = Math.sin(b), pt = V(m, 'PROF.PTRAN');
    const { gs, gi } = goussets(o), B = o + 2 * e2, Ht = e1 + h + e3, Wc = W / s;
    return { o, h, e1, e2, e3, ld, hs, hc, bg, b, s, W, Wc, ws, sum, pt, gs, gi, B, Ht };
  }

  function quantities(g) {
    const sec = g.B * g.Ht - (g.o * g.h - g.gs[0] * g.gs[1] - g.gi[0] * g.gi[1]);
    const per = 2 * (g.h - g.gs[1] - g.gi[1]) + 2 * (g.o - g.gs[0] - g.gi[0]) + 2 * Math.hypot(g.gs[0], g.gs[1]) + 2 * Math.hypot(g.gi[0], g.gi[1]);
    const q = [['Béton du cadre', 'm³', sec * g.Wc], ['Béton de propreté (ép. 0.10)', 'm³', (g.B + 0.2) * 0.10 * g.Wc]];
    if (g.ld > 0) { q.push(['Corbeaux (2)', 'm³', 2 * (DT.cb * DT.hb - DT.ch * DT.ch / 2) * g.Wc]); q.push(['Dalles de transition (2, ép. ' + f2(DT.ep) + ')', 'm³', 2 * g.ld * DT.ep * g.Wc]); }
    q.push(['Coffrage intérieur (hors radier)', 'm²', (per - (g.o - 2 * g.gi[0])) * g.Wc]);
    q.push(['Coffrage extérieur des piédroits', 'm²', 2 * g.Ht * g.Wc]);
    q.push(['Coffrage des têtes (2)', 'm²', 2 * sec / g.s]);
    return { rows: q, sec, vol: sec * g.Wc };
  }

  function coffrage(m) {
    const P = G.OTPLAN, S = P.Sheet(), g = geometry(m), { o, h, e1, e2, e3, ld, hs, hc, B, Ht, gs, gi, W, Wc, ws, sum, pt } = g;
    S.frame();
    // ═════════ 1. COUPE TRANSVERSALE DROITE (haut gauche : x 14..244, y 118..272) ═════════
    const hsD = hs > 2.2 ? 1.2 : hs, cut = hs > 2.2, ext = ld > 0 ? ld + 0.8 : 1.2;
    const totW = B + 2 * ext, totH = Ht + hsD + hc + 0.10 + 0.5;
    const scC = [20, 25, 50, 75, 100, 125, 150, 200, 250].find(v => totW * 1000 / v <= 172 && totH * 1000 / v <= 128) || 250, kC = 1000 / scC;
    const ox = 14 + 24 + (172 - totW * kC) / 2 + ext * kC, oy = 126 + (128 - totH * kC) / 2 + 0.6 * kC;
    const C = (x, y) => [ox + x * kC, oy + y * kC];
    const outer = [[0, 0], [B, 0], [B, Ht], [0, Ht]];
    const inner = [[e2, e1 + gi[1]], [e2 + gi[0], e1], [B - e2 - gi[0], e1], [B - e2, e1 + gi[1]], [B - e2, Ht - e3 - gs[1]], [B - e2 - gs[0], Ht - e3], [e2 + gs[0], Ht - e3], [e2, Ht - e3 - gs[1]]];
    S.fill(outer.map(p => C(p[0], p[1])), 'BETON'); S.P.push({ t: 'F', p: inner.map(p => C(p[0], p[1])), ly: 'BLANC', solid: 1 });
    S.poly(outer.map(p => C(p[0], p[1])), 'CONTOUR', true); S.poly(inner.map(p => C(p[0], p[1])), 'CONTOUR', true);
    // béton de propreté et sol
    const bp = [[-0.1, -0.1], [B + 0.1, -0.1], [B + 0.1, 0], [-0.1, 0]];
    S.P.push({ t: 'F', p: bp.map(p => C(p[0], p[1])), ly: 'BETONP' }); S.poly(bp.map(p => C(p[0], p[1])), 'VU', true);
    S.earth([C(B + ext, -0.1), C(-ext, -0.1)], { step: 2.4, len: 1.8 });
    // corbeaux et dalles de transition
    const yR = Ht + hsD, yC = Ht + hsD + hc;   // dessus remblai (sous chaussée), chaussée
    for (const sd of [-1, 1]) {
      const x0 = sd < 0 ? 0 : B, X = x => sd < 0 ? x0 - x : x0 + x;   // x : distance au parement extérieur
      if (ld > 0) {
        const yb = Ht - DT.ep, cb = [[X(0), yb], [X(DT.cb), yb], [X(DT.cb), yb - DT.hb + DT.ch], [X(DT.cb - DT.ch), yb - DT.hb], [X(0), yb - DT.hb]];
        S.fill(cb.map(p => C(p[0], p[1])), 'BETON'); S.poly(cb.map(p => C(p[0], p[1])), 'CONTOUR', true);
        const dt = [[X(0.02), Ht], [X(ld), Ht - DT.pente * ld], [X(ld), Ht - DT.pente * ld - DT.ep], [X(DT.cb), yb], [X(0.02), yb]];
        S.fill(dt.map(p => C(p[0], p[1])), 'BETON'); S.poly(dt.map(p => C(p[0], p[1])), 'CONTOUR', true);
      }
    }
    // dessus de remblai, chaussée
    S.poly([C(-ext, yR), C(B + ext, yR)], 'TERRAIN');
    if (hc > 0) S.poly([C(-ext, yC), C(B + ext, yC)], 'VU');
    if (hs > 0.3) S.text(C(B * 0.25, 0)[0], C(0, Ht + Math.min(hsD, 1.2) / 2)[1] - 1, 'remblai', 2, { ly: 'TERRAIN' });
    if (cut) { S.brk(C(-ext, Ht + 0.7)[0], C(0, Ht + 0.7)[1], C(B + ext, Ht + 0.7)[0], C(0, Ht + 0.7)[1]); S.text(C(B / 2, 0)[0], C(0, Ht + 0.85)[1] + 2, 'hauteur de remblai ' + f2(hs) + ' m (dessin interrompu)', 2, { ly: 'COTES' }); }
    // axe et trait de coupe B-B
    { const a = C(B / 2, -0.6), z = C(B / 2, yC + 0.5); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    { const a = C(B / 2 + o * 0.22, e1 + 0.15), z = C(B / 2 + o * 0.22, Ht - e3 - 0.15); S.cut(a[0], a[1] + 2, z[0], z[1] - 2, 'B', { axis: false, flip: true }); }
    // cotes
    const yb0 = C(0, -0.1)[1];
    S.chainH([C(0, 0)[0], C(e2, 0)[0], C(B - e2, 0)[0], C(B, 0)[0]], yb0 - 6, [f2(e2), f2(o) + ' (ouverture droite)', f2(e2)], { h: 2 });
    S.dim([C(0, 0)[0], yb0 - 13], [C(B, 0)[0], yb0 - 13], 0, f2(B), { noExt: true, h: 2.1 });
    const chV = [0, e1, Ht - e3, Ht].concat(cut ? [] : hs > 0 ? [yR] : []).concat(!cut && hc > 0 ? [yC] : []);
    const labV = [f2(e1), f2(h), f2(e3)].concat(cut ? [] : hs > 0 ? [f2(hs)] : []).concat(!cut && hc > 0 ? [f2(hc)] : []);
    S.chainV(chV.map(y => C(0, y)[1]), C(-ext, 0)[0] - 4, labV, { h: 1.9 });
    S.dim([C(-ext, 0)[0] - 11, C(0, 0)[1]], [C(-ext, 0)[0] - 11, C(0, Ht)[1]], 0, f2(Ht), { noExt: true, h: 2 });
    if (ld > 0) { S.dim(C(-ld, Ht), C(0, Ht), 5, f2(ld), { h: 1.9 }); }
    // niveaux (référence : dessus du radier ±0.00)
    const lv = [[e1, 'dessus radier ±0.00'], [0, 'sous-face ' + sgn(-e1)], [Ht - e3, 'intrados ' + sgn(h)], [Ht, 'extrados ' + sgn(h + e3)]];
    if (!cut && hc > 0) lv.push([yC, 'chaussée ' + sgn(h + e3 + hs + hc)]);
    const xLv = C(B + ext, 0)[0] + 2;
    S.levels(xLv, lv.map(([y, s0]) => [C(0, y)[1], s0]));
    // désignations
    S.text(C(B / 2, 0)[0], C(0, e1 + h * 0.55)[1], 'OUVERTURE DROITE ' + f2(o) + ' — HAUTEUR LIBRE ' + f2(h), 2.4, { bold: 1 });
    S.text(C(B / 2, 0)[0], C(0, e1 + h * 0.55)[1] - 4, 'biais ' + f2(g.bg, 1) + ' gr — ouverture biaise ' + f2(o / g.s), 2.1, { ly: 'COTES' });
    S.text(C(e2 + gs[0] * 0.5, 0)[0] + 4, C(0, Ht - e3 - gs[1] * 0.5)[1] - 4, 'gousset ' + f2(gs[0]) + ' × ' + f2(gs[1]), 1.9, { a: 'l', ly: 'COTES' });
    S.text(C(e2 + gi[0] * 0.5, 0)[0] + 4, C(0, e1 + gi[1] * 0.5)[1] + 2.5, 'gousset ' + f2(gi[0]) + ' × ' + f2(gi[1]), 1.9, { a: 'l', ly: 'COTES' });
    if (ld > 0) S.text(C(-ld / 2, 0)[0], C(0, Ht - DT.pente * ld / 2 - DT.ep)[1] - 3, 'dalle de transition ép. ' + f2(DT.ep) + ' — pente ' + f2(DT.pente * 100, 0) + ' %', 1.8, { ly: 'COTES' });
    S.vtitle(C(B / 2, 0)[0], 280, 'COUPE TRANSVERSALE DROITE', 'Éch : 1/' + scC + ' — perpendiculaire aux piédroits');

    // ═════════ 2. COUPE B-B suivant l'axe du cadre (droite haut : x 252..408, y 182..272) ═════════
    const hT = Math.min(h, 1.6), brk = h > hT + 1e-6, wsC = ws.map(w => w / g.s), sumC = sum / g.s, x0r = (Wc - sumC) / 2;
    const hsB = Math.min(hsD, 1.2), hB = e1 + hT + e3 + hsB + hc + 0.6;
    const scB = [20, 25, 50, 75, 100, 125, 150, 200, 250].find(v => (Wc + 1.2) * 1000 / v <= 150 && hB * 1000 / v <= 62) || 250, kB = 1000 / scB;
    const oxB = 254 + (150 - (Wc + 1.2) * kB) / 2 + 0.6 * kB, oyB = 202, T = (x, y) => [oxB + x * kB, oyB + y * kB];
    const yTi = e1 + hT, yTe = yTi + e3, yRB = yTe + hsB, yCB = yRB + hc;
    for (const r of [[0, 0, Wc, e1], [0, yTi, Wc, yTe]]) { const q = [T(r[0], r[1]), T(r[2], r[1]), T(r[2], r[3]), T(r[0], r[3])]; S.fill(q, 'BETON'); S.poly(q, 'CONTOUR', true); }
    S.poly([T(0, e1), T(0, yTi)], 'VU'); S.poly([T(Wc, e1), T(Wc, yTi)], 'VU');   // arêtes des têtes (piédroit vu)
    S.poly([T(0, e1 + Math.min(gi[1], hT / 3)), T(Wc, e1 + Math.min(gi[1], hT / 3))], 'VU'); S.poly([T(0, yTi - Math.min(gs[1], hT / 3)), T(Wc, yTi - Math.min(gs[1], hT / 3))], 'VU');
    if (brk) S.brk(T(-0.3, e1 + hT / 2)[0], T(0, e1 + hT / 2)[1], T(Wc + 0.3, e1 + hT / 2)[0], T(0, e1 + hT / 2)[1]);
    S.P.push({ t: 'F', p: [T(-0.1, -0.1), T(Wc + 0.1, -0.1), T(Wc + 0.1, 0), T(-0.1, 0)], ly: 'BETONP' }); S.poly([T(-0.1, -0.1), T(Wc + 0.1, -0.1), T(Wc + 0.1, 0), T(-0.1, 0)], 'VU', true);
    S.earth([T(Wc + 0.6, -0.1), T(-0.6, -0.1)], { step: 2.4, len: 1.6 });
    // remblai, chaussée, trottoirs
    S.poly([T(0, yTe), T(0, yRB), T(Wc, yRB), T(Wc, yTe)], 'TERRAIN');
    if (cut || hs > 1.2) S.brk(T(-0.2, yTe + hsB / 2)[0], T(0, yTe + hsB / 2)[1], T(Wc + 0.2, yTe + hsB / 2)[0], T(0, yTe + hsB / 2)[1]);
    if (hs > 0.3) S.text(T(Wc * 0.18, 0)[0], T(0, yTe + hsB * 0.4)[1], 'remblai' + (hs > 1.2 ? ' (' + f2(hs) + ' m)' : ''), 1.9, { ly: 'TERRAIN' });
    const xs = [x0r]; wsC.forEach(w => xs.push(xs[xs.length - 1] + w));
    if (sum > 0) {
      const dev = pt > 0 ? pt / 100 : 0.025, xm = (xs[2] + xs[3]) / 2, yS = x => yCB - Math.abs(x - xm) * dev;   // devers en toit
      if (wsC[0] > 0) S.poly([T(xs[0], yRB), T(xs[1], yRB), T(xs[1], yS(xs[1]) + 0.18), T(xs[0], yS(xs[1]) + 0.18)], 'VU', true);
      if (wsC[4] > 0) S.poly([T(xs[4], yRB), T(xs[5], yRB), T(xs[5], yS(xs[4]) + 0.18), T(xs[4], yS(xs[4]) + 0.18)], 'VU', true);
      if (hc > 0) S.poly([T(xs[1], yS(xs[1])), T(xm, yS(xm)), T(xs[4], yS(xs[4]))], 'CONTOUR');
      if (hc > 0) { const xq = xm + (xs[4] - xm) * 0.5, q = T(xq, yS(xq)); S.slope(q[0], q[1] + 2.4, f2(dev * 100, 1) + ' %', -Math.atan(dev) * 180 / Math.PI); }
      const labs = [], xsd = [xs[0]]; wsC.forEach((w, i) => { if (w > 0) { labs.push(f2(ws[i])); xsd.push(xs[i + 1]); } });
      S.chainH(xsd.map(x => T(x, 0)[0]), T(0, yCB + 0.25)[1] + 6, labs, { h: 1.7 });
    }
    S.dim([T(0, 0)[0], T(0, -0.1)[1] - 6], [T(Wc, 0)[0], T(0, -0.1)[1] - 6], 0, f2(Wc) + ' (suivant l\'axe)' + (g.s < 0.999 ? ' — ' + f2(W) + ' droite' : ''), { noExt: true, h: 1.9 });
    S.chainV([T(0, 0)[1], T(0, e1)[1], T(0, yTi)[1], T(0, yTe)[1]], T(Wc, 0)[0] + 6, [f2(e1), f2(h) + (brk ? '*' : ''), f2(e3)], { right: true, h: 1.8 });
    S.text(T(Wc / 2, 0)[0], T(0, e1 + hT * 0.3)[1], 'piédroit vu', 1.9, { ly: 'COTES' });
    S.vtitle(330, 280, 'COUPE B-B', 'Éch : 1/' + scB + ' — suivant l\'axe du cadre' + (brk ? ' (hauteur interrompue)' : ''));

    // ═════════ 3. VUE EN PLAN (bas gauche : x 14..196, y 14..110) ═════════
    const sb = g.s, cb = Math.cos(g.b), ob = o / sb, eb = e2 / sb, lb = ld / sb, dx = W * cb / sb;   // décalage d'une rive à l'autre (biais)
    const xmin = Math.min(0, dx) - eb - lb - 0.8, xmax = Math.max(0, dx) + ob + eb + lb + 0.8;
    const scP = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500].find(v => (xmax - xmin) * 1000 / v <= 168 && (W + 2.4) * 1000 / v <= 74) || 500, kP = 1000 / scP;
    const oxP = 22 + (168 - (xmax - xmin) * kP) / 2 - xmin * kP, oyP = 22 + (74 - (W + 2.4) * kP) / 2 + 1.2 * kP, Pp = (x, y) => [oxP + x * kP, oyP + y * kP];
    const band = (x1, x2) => [Pp(x1, 0), Pp(x2, 0), Pp(x2 + dx, W), Pp(x1 + dx, W)];
    S.fill(band(-eb, 0), 'BETON'); S.fill(band(ob, ob + eb), 'BETON');
    S.poly(band(-eb, ob + eb), 'CONTOUR', true); S.poly([Pp(0, 0), Pp(dx, W)], 'CACHE'); S.poly([Pp(ob, 0), Pp(ob + dx, W)], 'CACHE');
    if (ld > 0) { S.poly(band(-eb - lb, -eb), 'VU', true); S.poly(band(ob + eb, ob + eb + lb), 'VU', true); S.text(Pp(-eb - lb / 2 + dx * 0.3, W * 0.3)[0], Pp(0, W * 0.3)[1], 'D.T.', 1.9, { ly: 'COTES' }); S.text(Pp(ob + eb + lb / 2 + dx * 0.3, W * 0.3)[0], Pp(0, W * 0.3)[1], 'D.T.', 1.9, { ly: 'COTES' }); }
    S.poly([Pp(xmin, 0), Pp(xmax, 0)], 'FIN'); S.poly([Pp(xmin, W), Pp(xmax, W)], 'FIN');
    { const a = Pp(xmin, W / 2), z = Pp(xmax, W / 2); S.line(a[0], a[1], z[0], z[1], 'AXE'); S.text(a[0] + 1, a[1] + 1.2, 'axe de la voie portée', 1.9, { a: 'l', ly: 'AXE' }); }
    const cA = [ob / 2 + dx / 2, W / 2];
    { const u = [cb, sb], L0 = W / 2 / sb + 1.0, a = Pp(cA[0] - u[0] * L0, cA[1] - u[1] * L0), z = Pp(cA[0] + u[0] * L0, cA[1] + u[1] * L0); S.line(a[0], a[1], z[0], z[1], 'AXE'); S.text(z[0] + 1, z[1] - 1, 'axe du cadre', 1.9, { a: 'l', ly: 'AXE' });
      if (g.bg < 99.9) { const R = 7, q = Pp(cA[0], cA[1]), pts = []; for (let i = 0; i <= 12; i++) { const t = g.b * i / 12; pts.push([q[0] + R * Math.cos(t), q[1] + R * Math.sin(t)]); } S.poly(pts, 'COTES'); S.text(q[0] + R + 1.5, q[1] + 2, f2(g.bg, 1) + ' gr', 1.9, { a: 'l', ly: 'COTES' }); } }
    S.dim(Pp(0, 0), Pp(ob, 0), -10, f2(ob) + (sb < 0.999 ? ' (ouverture biaise)' : ' (ouverture)'), { h: 1.8 });
    S.dim(Pp(-eb, 0), Pp(0, 0), -5, f2(eb), { h: 1.7 }); S.dim(Pp(ob, 0), Pp(ob + eb, 0), -5, f2(eb), { h: 1.7 });
    if (ld > 0) { S.dim(Pp(-eb - lb, 0), Pp(-eb, 0), -5, f2(lb), { h: 1.7 }); S.dim(Pp(ob + eb, 0), Pp(ob + eb + lb, 0), -5, f2(lb), { h: 1.7 }); }
    S.dim([Pp(xmax, 0)[0] + 3, Pp(0, 0)[1]], [Pp(xmax, 0)[0] + 3, Pp(0, W)[1]], 0, f2(W), { noExt: true, h: 1.9 });
    S.vtitle(106, 108, 'VUE EN PLAN', 'Éch : 1/' + scP + ' — piédroits sous traverse, dalles de transition');

    // ═════════ 4. DÉTAIL DU CORBEAU (x 200..278, y 30..110) ═════════
    if (ld > 0) {
      const kD = 1000 / 20, oxD = 252, oyD = 46, D = (x, y) => [oxD + x * kD, oyD + (y - (Ht - 0.95)) * kD];   // x = 0 au parement extérieur (côté gauche)
      S.P.push({ t: 'F', p: [D(0, Ht - 0.95), D(0.42, Ht - 0.95), D(0.42, Ht), D(0, Ht)], ly: 'BETON' });
      S.poly([D(0, Ht - 0.95), D(0, Ht), D(0.42, Ht)], 'CONTOUR');
      S.brk(D(0, Ht - 0.95)[0], D(0, Ht - 0.95)[1], D(0.42, Ht - 0.95)[0], D(0.42, Ht - 0.95)[1]);
      S.brk(D(0.42, Ht)[0], D(0.42, Ht)[1], D(0.42, Ht - 0.95)[0], D(0.42, Ht - 0.95)[1]);
      const yb = Ht - DT.ep, cbp = [[0, yb], [-DT.cb, yb], [-DT.cb, yb - DT.hb + DT.ch], [-DT.cb + DT.ch, yb - DT.hb], [0, yb - DT.hb]];
      S.fill(cbp.map(p => D(p[0], p[1])), 'BETON'); S.poly(cbp.map(p => D(p[0], p[1])), 'CONTOUR');
      const Ld = 0.75, dtp = [[-0.02, Ht], [-Ld, Ht - DT.pente * Ld], [-Ld, Ht - DT.pente * Ld - DT.ep], [-0.02, yb]];
      S.fill(dtp.map(p => D(p[0], p[1])), 'BETON'); S.poly(dtp.map(p => D(p[0], p[1])), 'CONTOUR');
      S.poly([D(-0.15, yb - 0.17), D(-0.15, yb + 0.2)], 'CONTOUR'); { const a = D(-0.15, yb + 0.05), z = D(-0.55, yb - 0.35); S.line(a[0], a[1], z[0], z[1], 'REPERES'); } S.text(D(-0.55, 0)[0] - 1, D(0, yb - 0.35)[1] - 0.8, 'goujon HA25 / 1.00 m', 1.7, { a: 'r', ly: 'COTES' });
      S.text(D(0, 0)[0] + 1, D(0, Ht + 0.04)[1], 'joint', 1.7, { a: 'l', ly: 'COTES' });
      S.dim(D(-DT.cb, yb - DT.hb), D(0, yb - DT.hb), -4, f2(DT.cb), { h: 1.7 });
      S.dim(D(-DT.cb, yb - DT.hb), D(-DT.cb, yb), -4, f2(DT.hb), { h: 1.7 });
      S.dim(D(0.42, yb), D(0.42, Ht), -4, f2(DT.ep), { h: 1.7 });
      S.text(D(-DT.cb, 0)[0] + 2, D(0, yb - DT.hb)[1] - 9, 'chanfrein ' + f2(DT.ch) + ' × ' + f2(DT.ch), 1.7, { a: 'l', ly: 'COTES' });
      S.text(D(-0.45, 0)[0], D(0, Ht + 0.05)[1] + 2.5, 'D.T. pente ' + f2(DT.pente * 100, 0) + ' %', 1.8, { ly: 'COTES' });
      S.vtitle(244, 108, 'DÉTAIL DU CORBEAU', 'Éch : 1/20');
    }
    // ═════════ 5. QUANTITÉS + NOTES (colonne droite) ═════════
    const Q = quantities(g);
    S.text(345, 168, 'QUANTITÉS (avant-métré)', 2.8, { bold: 1 });
    S.table(284, 165, [86, 12, 22], [['Désignation', 'Unité', 'Quantité']].concat(Q.rows.map(r => [r[0], r[1], r[2].toFixed(1)])), 4.4);
    S.notes(['NOTES :', '— Cotes en mètres ; niveaux rapportés au dessus du radier (±0.00).', '— Ouverture et épaisseurs mesurées perpendiculairement aux piédroits.',
      '— Goussets : dimensions du document CHAMOA PICF (cohérentes avec le calcul).', '— Arêtes vues chanfreinées 2 × 2 cm ; béton de propreté dosé à 150 kg/m³.',
      '— Dalles de transition sur corbeaux (dispositions courantes SETRA).'], 284, 116);
    S.cartouche({ titre: 'PLAN DE COFFRAGE DU CADRE', sous: 'cadre fermé en béton armé — PICF-EL', ouvrage: m.titre, numero: m.num || m.numero, echelles: '1/' + scC + ', 1/' + scB + ', 1/' + scP + (ld > 0 ? ', 1/20' : ''), planNo: 'COF-01' });
    return { S, scC, scPl: scP, scT: scB };
  }
  G.PICF_PLANS = { coffrage, geometry, quantities };
})(typeof window !== 'undefined' ? window : globalThis);
