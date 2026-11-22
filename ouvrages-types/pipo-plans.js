/* PIPO-EL — plan de coffrage du portique ouvert (BridgeAI / KLE Ingénierie)
   Planche A3 : coupe transversale droite (traverse, piédroits, semelles excentrées de DELTA, corbeaux et dalles de transition,
   remblai, chaussée, niveaux), coupe B-B suivant l'axe du portique, vue en plan biaise (semelles cachées), détail du corbeau,
   quantités comparées à l'avant-métré du calcul. Épaisseur et débords des semelles : résultats du calcul (r.g, r.aInt, r.aExt). */
(function (G) {
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d)).toFixed(d == null ? 2 : d);
  const get = (m, k) => { const [c, n] = k.split('.'); return c === 'A1' ? (m.A1 || {})[n] : ((m.cartes || {})[c] || {})[n]; };
  const V = (m, k) => { const x = parseFloat(String(get(m, k) == null ? '' : get(m, k)).replace(',', '.')); return isFinite(x) ? x : 0; };
  const sgn = v => (v > 0.0049 ? '+' : v < -0.0049 ? '−' : '±') + f2(Math.abs(v));
  const DT = { ep: 0.30, pente: 0.05, cb: 0.30, hb: 0.25, ch: 0.10 };

  function coffrage(m, r) {
    const P = G.OTPLAN, S = P.Sheet();
    const o = V(m, 'A2.OUVER') || 1, h = V(m, 'A2.HAUTL') || 1, e2 = V(m, 'A2.E2') || 0.5, e3 = V(m, 'A2.E3') || 0.5;
    const genre = V(m, 'A2.GENRE') || 2, rg = r && r.g, e1 = rg ? rg.e1 : Math.max(e2, 0.6);
    const aI = r && r.aInt != null ? r.aInt : 1, aE = r && r.aExt != null ? r.aExt : 1, Ws = genre === 2 ? aI + aE + e2 : 0;
    const ld = V(m, 'A3.LDALT'), hs = V(m, 'A3.HSREMB'), hc = V(m, 'A3.HCHAU'), bg = Math.max(30, Math.min(100, V(m, 'A2.BIAIS') || 100)), b = bg * Math.PI / 200, sb = Math.sin(b);
    const ws = ['A3.ETROTG', 'A3.EGAU', 'A3.ESURCH', 'A3.EDROI', 'A3.ETROTD'].map(k => V(m, k)), sum = ws.reduce((a, c) => a + c, 0), W = rg ? rg.larg : (sum || 10), Wc = W / sb;
    const Bt = o + 2 * e2, Ht = h + e3;   // y = 0 au dessus des semelles (niveau ±0.00)
    const sem = genre === 2 ? [[-aE, e2 + aI], [Bt - e2 - aI, Bt + aE]] : [];
    S.frame();
    // ═════════ 1. COUPE TRANSVERSALE DROITE ═════════
    const hsD = hs > 2.2 ? 1.2 : hs, cut = hs > 2.2, ext = Math.max(ld > 0 ? ld + 0.8 : 1.2, aE + 0.6);
    const totW = Bt + 2 * ext, totH = (genre === 2 ? e1 + 0.1 : 0) + Ht + hsD + hc + 0.5;
    const scC = [20, 25, 50, 75, 100, 125, 150, 200, 250].find(v => totW * 1000 / v <= 172 && totH * 1000 / v <= 124) || 250, kC = 1000 / scC;
    const yb = genre === 2 ? -e1 : 0, ox = 14 + 24 + (172 - totW * kC) / 2 + ext * kC, oy = 128 + (124 - totH * kC) / 2 + (0.1 - yb) * kC;
    const C = (x, y) => [ox + x * kC, oy + y * kC];
    const port = [[0, 0], [e2, 0], [e2, h], [Bt - e2, h], [Bt - e2, 0], [Bt, 0], [Bt, Ht], [0, Ht]];
    S.fill(port.map(p => C(p[0], p[1])), 'BETON'); S.poly(port.map(p => C(p[0], p[1])), 'CONTOUR', true);
    for (const [x0, x1] of sem) { const q = [[x0, -e1], [x1, -e1], [x1, 0], [x0, 0]].map(p => C(p[0], p[1])); S.fill(q, 'BETON'); S.poly(q, 'CONTOUR', true);
      const bp = [[x0 - 0.1, -e1 - 0.1], [x1 + 0.1, -e1 - 0.1], [x1 + 0.1, -e1], [x0 - 0.1, -e1]].map(p => C(p[0], p[1])); S.P.push({ t: 'F', p: bp, ly: 'BETONP' }); S.poly(bp, 'VU', true);
      S.earth([C(x1 + 0.4, -e1 - 0.1), C(x0 - 0.4, -e1 - 0.1)], { step: 2.4, len: 1.6 }); }
    if (genre === 3) for (const x of [e2 / 2, Bt - e2 / 2]) { S.poly([C(x - 0.4, 0), C(x - 0.4, -1.5)], 'CACHE'); S.poly([C(x + 0.4, 0), C(x + 0.4, -1.5)], 'CACHE'); }
    S.earth([C(Bt - e2, 0), C(e2, 0)], { step: 2.6, len: 1.4 });
    const yR = Ht + hsD, yC = yR + hc;
    if (ld > 0) for (const sd of [-1, 1]) {
      const x0 = sd < 0 ? 0 : Bt, X = x => sd < 0 ? x0 - x : x0 + x, ybb = Ht - DT.ep;
      const cb = [[X(0), ybb], [X(DT.cb), ybb], [X(DT.cb), ybb - DT.hb + DT.ch], [X(DT.cb - DT.ch), ybb - DT.hb], [X(0), ybb - DT.hb]];
      S.fill(cb.map(p => C(p[0], p[1])), 'BETON'); S.poly(cb.map(p => C(p[0], p[1])), 'CONTOUR', true);
      const dt = [[X(0.02), Ht], [X(ld), Ht - DT.pente * ld], [X(ld), Ht - DT.pente * ld - DT.ep], [X(DT.cb), ybb], [X(0.02), ybb]];
      S.fill(dt.map(p => C(p[0], p[1])), 'BETON'); S.poly(dt.map(p => C(p[0], p[1])), 'CONTOUR', true);
    }
    S.poly([C(-ext, yR), C(Bt + ext, yR)], 'TERRAIN');
    if (hc > 0) S.poly([C(-ext, yC), C(Bt + ext, yC)], 'VU');
    if (hs > 0.3) S.text(C(Bt * 0.25, 0)[0], C(0, Ht + Math.min(hsD, 1.2) / 2)[1] - 1, 'remblai', 2, { ly: 'TERRAIN' });
    if (cut) { S.brk(C(-ext, Ht + 0.7)[0], C(0, Ht + 0.7)[1], C(Bt + ext, Ht + 0.7)[0], C(0, Ht + 0.7)[1]); S.text(C(Bt / 2, 0)[0], C(0, Ht + 0.85)[1] + 2, 'hauteur de remblai ' + f2(hs) + ' m (dessin interrompu)', 2, { ly: 'COTES' }); }
    { const a = C(Bt / 2, yb - 0.5), z = C(Bt / 2, yC + 0.5); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    for (const x of [e2 / 2, Bt - e2 / 2]) { const a = C(x, yb - 0.3), z = C(x, h * 0.25); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    { const a = C(Bt / 2 + o * 0.22, 0.15), z = C(Bt / 2 + o * 0.22, h - 0.15); S.cut(a[0], a[1] + 2, z[0], z[1] - 2, 'B', { axis: false, flip: true }); }
    const yd0 = C(0, yb - 0.1)[1];
    if (sem.length) { const s0 = sem[0]; S.chainH([C(s0[0], 0)[0], C(0, 0)[0], C(e2, 0)[0], C(s0[1], 0)[0]], yd0 - 6, [f2(aE), f2(e2), f2(aI)], { h: 1.8 });
      S.chainH([C(sem[1][0], 0)[0], C(Bt - e2, 0)[0], C(Bt, 0)[0], C(sem[1][1], 0)[0]], yd0 - 6, [f2(aI), f2(e2), f2(aE)], { h: 1.8 });
      S.dim([C(s0[0], 0)[0], yd0 - 12], [C(s0[1], 0)[0], yd0 - 12], 0, f2(Ws) + ' (semelle)', { noExt: true, h: 1.9 }); }
    S.chainH([C(0, 0)[0], C(e2, 0)[0], C(Bt - e2, 0)[0], C(Bt, 0)[0]], C(0, Ht)[1] + (ld > 0 ? 12 : 5), [f2(e2), f2(o) + ' (ouverture droite)', f2(e2)], { h: 2 });
    const chV = (genre === 2 ? [-e1] : []).concat([0, h, Ht]).concat(cut ? [] : hs > 0 ? [yR] : []).concat(!cut && hc > 0 ? [yC] : []);
    const labV = (genre === 2 ? [f2(e1)] : []).concat([f2(h), f2(e3)]).concat(cut ? [] : hs > 0 ? [f2(hs)] : []).concat(!cut && hc > 0 ? [f2(hc)] : []);
    S.chainV(chV.map(y => C(0, y)[1]), C(-ext, 0)[0] - 4, labV, { h: 1.9 });
    if (ld > 0) S.dim(C(-ld, Ht), C(0, Ht), 5, f2(ld), { h: 1.9 });
    const lv = [[0, 'dessus semelles ±0.00'], [h, 'intrados ' + sgn(h)], [Ht, 'extrados ' + sgn(Ht)]];
    if (genre === 2) lv.push([-e1, 'sous-face ' + sgn(-e1)]);
    if (!cut && hc > 0) lv.push([yC, 'chaussée ' + sgn(Ht + hs + hc)]);
    S.levels(C(Bt + ext, 0)[0] + 2, lv.map(([y, s0]) => [C(0, y)[1], s0]));
    S.text(C(Bt / 2, 0)[0], C(0, h * 0.55)[1], 'OUVERTURE DROITE ' + f2(o) + ' — HAUTEUR LIBRE ' + f2(h), 2.4, { bold: 1 });
    S.text(C(Bt / 2, 0)[0], C(0, h * 0.55)[1] - 4, 'biais ' + f2(bg, 1) + ' gr — ouverture biaise ' + f2(o / sb) + (genre === 2 && Math.abs(V(m, 'A2.DELTA')) > 0.004 ? ' — excentrement Δ = ' + f2(V(m, 'A2.DELTA')) : ''), 2.1, { ly: 'COTES' });
    if (ld > 0) S.text(C(-ld / 2, 0)[0], C(0, Ht - DT.pente * ld / 2 - DT.ep)[1] - 3, 'dalle de transition ép. ' + f2(DT.ep) + ' — pente ' + f2(DT.pente * 100, 0) + ' %', 1.8, { ly: 'COTES' });
    S.vtitle(C(Bt / 2, 0)[0], 280, 'COUPE TRANSVERSALE DROITE', 'Éch : 1/' + scC + ' — perpendiculaire aux piédroits' + (genre === 3 ? ' — fondations profondes' : ''));

    // ═════════ 2. COUPE B-B suivant l'axe ═════════
    const hT = Math.min(h, 1.6), brk = h > hT + 1e-6, wsC = ws.map(w => w / sb), sumC = sum / sb, x0r = (Wc - sumC) / 2, hsB = Math.min(hsD, 1.2);
    const hB = (genre === 2 ? e1 : 0) + hT + e3 + hsB + hc + 0.6;
    const scB = [20, 25, 50, 75, 100, 125, 150, 200, 250].find(v => (Wc + 1.2) * 1000 / v <= 150 && hB * 1000 / v <= 62) || 250, kB = 1000 / scB;
    const oxB = 254 + (150 - (Wc + 1.2) * kB) / 2 + 0.6 * kB, oyB = 204 + (genre === 2 ? e1 * kB : 0), T = (x, y) => [oxB + x * kB, oyB + y * kB];
    const yTi = hT, yTe = hT + e3, yRB = yTe + hsB, yCB = yRB + hc;
    { const q = [T(0, yTi), T(Wc, yTi), T(Wc, yTe), T(0, yTe)]; S.fill(q, 'BETON'); S.poly(q, 'CONTOUR', true); }
    S.poly([T(0, 0), T(0, yTi)], 'VU'); S.poly([T(Wc, 0), T(Wc, yTi)], 'VU');
    if (genre === 2) { const q = [T(-0.1, -e1), T(Wc + 0.1, -e1), T(Wc + 0.1, 0), T(-0.1, 0)]; S.poly(q, 'VU', true); S.text(T(Wc / 2, 0)[0], T(0, -e1 / 2)[1] - 0.8, 'semelle (vue)', 1.8, { ly: 'COTES' }); }
    S.earth([T(Wc + 0.6, 0), T(-0.6, 0)], { step: 2.4, len: 1.4 });
    if (brk) S.brk(T(-0.3, hT / 2)[0], T(0, hT / 2)[1], T(Wc + 0.3, hT / 2)[0], T(0, hT / 2)[1]);
    S.poly([T(0, yTe), T(0, yRB), T(Wc, yRB), T(Wc, yTe)], 'TERRAIN');
    if (cut || hs > 1.2) S.brk(T(-0.2, yTe + hsB / 2)[0], T(0, yTe + hsB / 2)[1], T(Wc + 0.2, yTe + hsB / 2)[0], T(0, yTe + hsB / 2)[1]);
    if (hs > 0.3) S.text(T(Wc * 0.18, 0)[0], T(0, yTe + hsB * 0.4)[1], 'remblai' + (hs > 1.2 ? ' (' + f2(hs) + ' m)' : ''), 1.9, { ly: 'TERRAIN' });
    const xs = [x0r]; wsC.forEach(w => xs.push(xs[xs.length - 1] + w));
    if (sum > 0) {
      const dev = 0.025, xm = (xs[2] + xs[3]) / 2, yS = x => yCB - Math.abs(x - xm) * dev;
      if (wsC[0] > 0) S.poly([T(xs[0], yRB), T(xs[1], yRB), T(xs[1], yS(xs[1]) + 0.18), T(xs[0], yS(xs[1]) + 0.18)], 'VU', true);
      if (wsC[4] > 0) S.poly([T(xs[4], yRB), T(xs[5], yRB), T(xs[5], yS(xs[4]) + 0.18), T(xs[4], yS(xs[4]) + 0.18)], 'VU', true);
      if (hc > 0) { S.poly([T(xs[1], yS(xs[1])), T(xm, yS(xm)), T(xs[4], yS(xs[4]))], 'CONTOUR'); const xq = xm + (xs[4] - xm) * 0.5, q = T(xq, yS(xq)); S.slope(q[0], q[1] + 2.4, '2.5 %', -Math.atan(dev) * 180 / Math.PI); }
      const labs = [], xsd = [xs[0]]; wsC.forEach((w, i) => { if (w > 0) { labs.push(f2(ws[i])); xsd.push(xs[i + 1]); } });
      S.chainH(xsd.map(x => T(x, 0)[0]), T(0, yCB + 0.25)[1] + 6, labs, { h: 1.7 });
    }
    S.dim([T(0, 0)[0], T(0, genre === 2 ? -e1 : 0)[1] - 6], [T(Wc, 0)[0], T(0, genre === 2 ? -e1 : 0)[1] - 6], 0, f2(Wc) + ' (suivant l\'axe)' + (sb < 0.999 ? ' — ' + f2(W) + ' droite' : ''), { noExt: true, h: 1.9 });
    S.chainV([T(0, 0)[1], T(0, yTi)[1], T(0, yTe)[1]], T(Wc, 0)[0] + 6, [f2(h) + (brk ? '*' : ''), f2(e3)], { right: true, h: 1.8 });
    S.text(T(Wc / 2, 0)[0], T(0, hT * 0.3)[1], 'piédroit vu', 1.9, { ly: 'COTES' });
    S.vtitle(330, 280, 'COUPE B-B', 'Éch : 1/' + scB + ' — suivant l\'axe du portique' + (brk ? ' (hauteur interrompue)' : ''));

    // ═════════ 3. VUE EN PLAN ═════════
    const cb = Math.cos(b), Bx = x => x / sb, dx = W * cb / sb;
    const xL = Math.min(-ld, sem.length ? sem[0][0] : 0), xR = Math.max(Bt + ld, sem.length ? sem[1][1] : Bt);
    const xmin = Math.min(0, dx) + Bx(xL) - 0.8, xmax = Math.max(0, dx) + Bx(xR) + 0.8;
    const scP = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500].find(v => (xmax - xmin) * 1000 / v <= 168 && (W + 2.4) * 1000 / v <= 74) || 500, kP = 1000 / scP;
    const oxP = 22 + (168 - (xmax - xmin) * kP) / 2 - xmin * kP, oyP = 22 + (74 - (W + 2.4) * kP) / 2 + 1.2 * kP, Pp = (x, y) => [oxP + x * kP, oyP + y * kP];
    const band = (x1, x2) => [Pp(Bx(x1), 0), Pp(Bx(x2), 0), Pp(Bx(x2) + dx, W), Pp(Bx(x1) + dx, W)];
    S.fill(band(0, Bt), 'BETON'); S.poly(band(0, Bt), 'CONTOUR', true);
    for (const x of [e2, Bt - e2]) S.poly([Pp(Bx(x), 0), Pp(Bx(x) + dx, W)], 'CACHE');
    for (const [x0, x1] of sem) S.poly(band(x0, x1), 'CACHE', true);
    if (ld > 0) { S.poly(band(-ld, 0), 'VU', true); S.poly(band(Bt, Bt + ld), 'VU', true); }
    S.poly([Pp(xmin, 0), Pp(xmax, 0)], 'FIN'); S.poly([Pp(xmin, W), Pp(xmax, W)], 'FIN');
    { const a = Pp(xmin, W / 2), z = Pp(xmax, W / 2); S.line(a[0], a[1], z[0], z[1], 'AXE'); S.text(a[0] + 1, a[1] + 1.2, 'axe de la voie portée', 1.9, { a: 'l', ly: 'AXE' }); }
    { const cA = [Bx(Bt / 2) + dx / 2, W / 2], u = [cb, sb], L0 = W / 2 / sb + 1.0, a = Pp(cA[0] - u[0] * L0, cA[1] - u[1] * L0), z = Pp(cA[0] + u[0] * L0, cA[1] + u[1] * L0); S.line(a[0], a[1], z[0], z[1], 'AXE'); S.text(z[0] + 1, z[1] - 1, 'axe du portique', 1.9, { a: 'l', ly: 'AXE' });
      if (bg < 99.9) { const R = 7, q = Pp(cA[0], cA[1]), pts = []; for (let i = 0; i <= 12; i++) { const t = b * i / 12; pts.push([q[0] + R * Math.cos(t), q[1] + R * Math.sin(t)]); } S.poly(pts, 'COTES'); S.text(q[0] + R + 1.5, q[1] + 2, f2(bg, 1) + ' gr', 1.9, { a: 'l', ly: 'COTES' }); } }
    S.dim(Pp(Bx(e2), 0), Pp(Bx(Bt - e2), 0), -10, f2(o / sb) + (sb < 0.999 ? ' (ouverture biaise)' : ' (ouverture)'), { h: 1.8 });
    S.dim(Pp(0, 0), Pp(Bx(e2), 0), -5, f2(e2 / sb), { h: 1.7 }); S.dim(Pp(Bx(Bt - e2), 0), Pp(Bx(Bt), 0), -5, f2(e2 / sb), { h: 1.7 });
    S.dim([Pp(xmax, 0)[0] + 3, Pp(0, 0)[1]], [Pp(xmax, 0)[0] + 3, Pp(0, W)[1]], 0, f2(W), { noExt: true, h: 1.9 });
    S.vtitle(106, 108, 'VUE EN PLAN', 'Éch : 1/' + scP + ' — traverse, semelles (cachées), dalles de transition');

    // ═════════ 4. DÉTAIL DU CORBEAU ═════════
    if (ld > 0) {
      const kD = 1000 / 20, D = (x, y) => [252 + x * kD, 46 + (y - (Ht - 0.95)) * kD];
      S.P.push({ t: 'F', p: [D(0, Ht - 0.95), D(0.42, Ht - 0.95), D(0.42, Ht), D(0, Ht)], ly: 'BETON' });
      S.poly([D(0, Ht - 0.95), D(0, Ht), D(0.42, Ht)], 'CONTOUR');
      S.brk(D(0, Ht - 0.95)[0], D(0, Ht - 0.95)[1], D(0.42, Ht - 0.95)[0], D(0.42, Ht - 0.95)[1]); S.brk(D(0.42, Ht)[0], D(0.42, Ht)[1], D(0.42, Ht - 0.95)[0], D(0.42, Ht - 0.95)[1]);
      const ybb = Ht - DT.ep, cbp = [[0, ybb], [-DT.cb, ybb], [-DT.cb, ybb - DT.hb + DT.ch], [-DT.cb + DT.ch, ybb - DT.hb], [0, ybb - DT.hb]];
      S.fill(cbp.map(p => D(p[0], p[1])), 'BETON'); S.poly(cbp.map(p => D(p[0], p[1])), 'CONTOUR');
      const Ld = 0.75, dtp = [[-0.02, Ht], [-Ld, Ht - DT.pente * Ld], [-Ld, Ht - DT.pente * Ld - DT.ep], [-0.02, ybb]];
      S.fill(dtp.map(p => D(p[0], p[1])), 'BETON'); S.poly(dtp.map(p => D(p[0], p[1])), 'CONTOUR');
      S.poly([D(-0.15, ybb - 0.17), D(-0.15, ybb + 0.2)], 'CONTOUR'); { const a = D(-0.15, ybb + 0.05), z = D(-0.55, ybb - 0.35); S.line(a[0], a[1], z[0], z[1], 'REPERES'); S.text(z[0] - 1, z[1] - 0.8, 'goujon HA25 / 1.00 m', 1.7, { a: 'r', ly: 'COTES' }); }
      S.text(D(0, 0)[0] + 1, D(0, Ht + 0.04)[1], 'joint', 1.7, { a: 'l', ly: 'COTES' });
      S.dim(D(-DT.cb, ybb - DT.hb), D(0, ybb - DT.hb), -4, f2(DT.cb), { h: 1.7 }); S.dim(D(-DT.cb, ybb - DT.hb), D(-DT.cb, ybb), -4, f2(DT.hb), { h: 1.7 }); S.dim(D(0.42, ybb), D(0.42, Ht), -4, f2(DT.ep), { h: 1.7 });
      S.text(D(-DT.cb, 0)[0] + 2, D(0, ybb - DT.hb)[1] - 9, 'chanfrein ' + f2(DT.ch) + ' × ' + f2(DT.ch), 1.7, { a: 'l', ly: 'COTES' });
      S.vtitle(244, 108, 'DÉTAIL DU CORBEAU', 'Éch : 1/20');
    }
    // ═════════ 5. QUANTITÉS + NOTES ═════════
    const secP = e3 * Bt + 2 * h * e2 + (genre === 2 ? 2 * e1 * Ws : 0), q = [['Béton du portique (traverse, piédroits, semelles)', 'm³', secP * Wc]];
    if (genre === 2) q.push(['Béton de propreté (ép. 0.10)', 'm³', 2 * (Ws + 0.2) * 0.10 * Wc]);
    if (ld > 0) { q.push(['Corbeaux (2)', 'm³', 2 * (DT.cb * DT.hb - DT.ch * DT.ch / 2) * Wc]); q.push(['Dalles de transition (2, ép. ' + f2(DT.ep) + ')', 'm³', 2 * ld * DT.ep * Wc]); }
    q.push(['Coffrage (intrados, piédroits, tympans)', 'm²', (o + 4 * h + 2 * e3 / sb) * Wc + 2 * secP / sb]);
    const mt = r && r.fer && r.fer.metre;
    if (mt) { q.push(['Avant-métré du calcul — béton', 'm³', mt.beton]); q.push(['Avant-métré du calcul — coffrage', 'm²', mt.coffrage]); }
    S.text(345, 168, 'QUANTITÉS (avant-métré)', 2.8, { bold: 1 });
    S.table(284, 165, [86, 12, 22], [['Désignation', 'Unité', 'Quantité']].concat(q.map(x => [x[0], x[1], x[2].toFixed(1)])), 4.4);
    S.notes(['NOTES :', '— Cotes en mètres ; niveaux rapportés au dessus des semelles (±0.00).', '— Ouverture et épaisseurs mesurées perpendiculairement aux piédroits.',
      genre === 2 ? '— Semelles : ép. ' + f2(e1) + ', débords ' + f2(aI) + ' (int.) et ' + f2(aE) + ' (ext.) issus du calcul.' : '— Fondations profondes : voir plan des fondations.',
      '— Arêtes vues chanfreinées 2 × 2 cm ; béton de propreté dosé à 150 kg/m³.', '— Dalles de transition sur corbeaux (dispositions courantes SETRA).'], 284, 112);
    S.cartouche({ titre: 'PLAN DE COFFRAGE DU PORTIQUE', sous: 'portique ouvert en béton armé — PIPO-EL', ouvrage: [m.titre, m.soustitre].filter(Boolean), numero: m.numero, echelles: '1/' + scC + ', 1/' + scB + ', 1/' + scP + (ld > 0 ? ', 1/20' : ''), planNo: 'COF-01' });
    return { S, scC, scPl: scP, scT: scB };
  }
  G.PIPO_PLANS = { coffrage };
})(typeof window !== 'undefined' ? window : globalThis);
