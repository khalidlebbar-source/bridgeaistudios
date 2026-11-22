/* PIPO-EL — plan de coffrage du portique (BridgeAI / KLE Ingénierie)
   Coupe droite (traverse, piédroits, semelles excentrées de DELTA, remblai, dalles de transition), coupe suivant l'axe
   du portique (profil en travers de la voie portée) et vue en plan biaise. Données : cartes A2, A3 du bordereau. */
(function (G) {
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
  const get = (m, k) => { const [c, n] = k.split('.'); return c === 'A1' ? (m.A1 || {})[n] : ((m.cartes || {})[c] || {})[n]; };
  const V = (m, k) => { const x = parseFloat(String(get(m, k) == null ? '' : get(m, k)).replace(',', '.')); return isFinite(x) ? x : 0; };

  function coffrage(m) {
    const P = G.OTPLAN, S = P.Sheet();
    const o = V(m, 'A2.OUVER') || 1, h = V(m, 'A2.HAUTL') || 1, e2 = V(m, 'A2.E2'), e3 = V(m, 'A2.E3'), e1 = Math.max(e2, 0.6);
    const genre = V(m, 'A2.GENRE') || 2, Ws = genre === 2 ? V(m, 'A2.W') : 0, D = genre === 2 ? V(m, 'A2.DELTA') : 0;
    const ld = V(m, 'A3.LDALT'), hs = V(m, 'A3.HSREMB'), hc = V(m, 'A3.HCHAU'), bg = Math.max(30, Math.min(100, V(m, 'A2.BIAIS') || 100)), b = bg * Math.PI / 200;
    const ws = ['A3.ETROTG', 'A3.EGAU', 'A3.ESURCH', 'A3.EDROI', 'A3.ETROTD'].map(k => V(m, k)); let W = ws.reduce((a, c) => a + c, 0); if (!(W > 0)) W = 10;
    const top = h + e3, road = top + hs + hc, tdt = 0.30, cl = -e2 / 2 + D, cr = o + e2 / 2 - D, yb = genre === 2 ? -e1 : 0;
    S.frame();
    // ---------- coupe droite ----------
    const ext = Math.max(ld + 1.0, Ws / 2 - D + 0.8, 1.5);
    const scC = P.pickScale(o + 2 * e2 + 2 * ext + 1.5, 245, [20, 25, 50, 75, 100, 125, 200]), kC = 1000 / scC;
    const ox = 15 + 12 + (ext + e2) * kC, oy = 262 - (road + 0.6) * kC;
    const C = (x, y) => [ox + x * kC, oy + y * kC];
    const rect = (x0, y0, x1, y1) => { const q = [C(x0, y0), C(x1, y0), C(x1, y1), C(x0, y1)]; S.fill(q, 'BETON'); S.poly(q, 'CONTOUR', true); };
    // portique : traverse + piédroits d'un seul contour, semelles
    const port = [C(-e2, 0), C(0, 0), C(0, h), C(o, h), C(o, 0), C(o + e2, 0), C(o + e2, top), C(-e2, top)];
    S.fill(port, 'BETON'); S.poly(port, 'CONTOUR', true);
    if (genre === 2 && Ws > 0) { rect(cl - Ws / 2, -e1, cl + Ws / 2, 0); rect(cr - Ws / 2, -e1, cr + Ws / 2, 0); }
    else if (genre === 3) for (const x of [-e2 / 2, o + e2 / 2]) S.circle(C(x, 0)[0], C(x, 0)[1], 1.2, 'CONTOUR');
    const xl = -e2 - ext, xr = o + e2 + ext;
    S.poly([C(xl, yb), C(xr, yb)], 'TERRAIN'); S.poly([C(0, 0), C(o, 0)], 'TERRAIN');
    S.poly([C(xl, road - hc), C(-e2 - ld, road - hc)], 'TERRAIN'); S.poly([C(o + e2 + ld, road - hc), C(xr, road - hc)], 'TERRAIN');
    if (hc > 0) S.poly([C(xl, road), C(xr, road)], 'VU');
    if (ld > 0) for (const sg of [-1, 1]) {
      const xa = sg < 0 ? -e2 : o + e2, xb2 = xa + sg * ld, ya = top + hs - 0.02, yb2 = ya - 0.05 * ld;
      S.poly([C(xa, ya), C(xb2, yb2), C(xb2, yb2 - tdt), C(xa, ya - tdt)], 'CONTOUR', true);
    }
    { const a = C(o / 2, yb - 0.6), z = C(o / 2, road + 0.6); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    for (const x of [-e2 / 2, o + e2 / 2]) { const a = C(x, yb - 0.4), z = C(x, h * 0.3); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    // cotes
    const yd = C(0, yb)[1] - 6;
    S.chainH([C(-e2, 0)[0], C(0, 0)[0], C(o, 0)[0], C(o + e2, 0)[0]], C(0, top)[1] + 5, [f2(e2, 2), f2(o, 2), f2(e2, 2)]);
    if (genre === 2 && Ws > 0) {
      S.chainH([C(cl - Ws / 2, 0)[0], C(cl + Ws / 2, 0)[0]], yd, [f2(Ws, 2)]); S.chainH([C(cr - Ws / 2, 0)[0], C(cr + Ws / 2, 0)[0]], yd, [f2(Ws, 2)]);
      if (Math.abs(D) > 0.005) S.text(C(cl, 0)[0], yd - 5, 'excentrement Δ = ' + f2(D, 2), 2, { ly: 'COTES' });
    }
    S.chainV([C(0, yb)[1]].concat(genre === 2 ? [C(0, 0)[1]] : [], [C(0, h)[1], C(0, top)[1]], hs > 0 ? [C(0, top + hs)[1]] : []), C(o + e2, 0)[0] + 7,
      (genre === 2 ? [f2(e1, 2)] : []).concat([f2(h, 2), f2(e3, 2)], hs > 0 ? [f2(hs, 2)] : []), { right: true });
    if (ld > 0) S.dim(C(-e2 - ld, top + hs + 0.4), C(-e2, top + hs + 0.4), 3, f2(ld, 2), { noExt: true, h: 2 });
    S.text(C(o / 2, 0)[0], C(0, h / 2)[1], 'ouverture droite ' + f2(o, 2) + ' — hauteur libre ' + f2(h, 2), 2.2, { ly: 'COTES' });
    S.title(15, 281, 'COUPE DROITE DU PORTIQUE', 'échelle 1/' + scC + ' — perpendiculaire aux piédroits' + (genre === 3 ? ' — piédroits sur fondations profondes' : ''));
    // ---------- vue en plan ----------
    const s = Math.sin(b), B = x => x / s, dx = W / Math.tan(b);
    const sl0 = cl - Ws / 2, sr1 = cr + Ws / 2;
    const xmin = Math.min(0, dx) + Math.min(B(-e2 - ld), B(sl0)) - 1, xmax = Math.max(0, dx) + Math.max(B(o + e2 + ld), B(sr1)) + 1;
    const yTop = Math.min(C(0, yb)[1] - 22, 150), scP = P.pickScale(xmax - xmin, 245, [50, 75, 100, 125, 200, 250, 500]);
    const scPl = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000].find(sc => sc >= scP && 1000 / sc <= (yTop - 24) / (W + 3)) || 1000, kP = 1000 / scPl, oxP = 15 + 10 + (-xmin) * kP, oyP = yTop - 10 - W * kP;
    const Pp = (x, y) => [oxP + x * kP, oyP + y * kP];
    const band = (x1, x2, ly) => S.poly([Pp(B(x1), 0), Pp(B(x2), 0), Pp(B(x2) + dx, W), Pp(B(x1) + dx, W)], ly, true);
    if (ld > 0) { band(-e2 - ld, -e2, 'VU'); band(o + e2, o + e2 + ld, 'VU'); }
    band(-e2, o + e2, 'CONTOUR');
    for (const x of [0, o]) { const a = Pp(B(x), 0), z = Pp(B(x) + dx, W); S.line(a[0], a[1], z[0], z[1], 'CACHE'); }
    if (Ws > 0) { band(sl0, sl0 + Ws, 'CACHE'); band(sr1 - Ws, sr1, 'CACHE'); }
    { const a = Pp(xmin, W / 2), z = Pp(xmax, W / 2); S.line(a[0], a[1], z[0], z[1], 'AXE'); S.text(a[0] + 1, a[1] + 1.2, 'axe de la voie portée', 2, { a: 'l', ly: 'AXE' }); }
    S.dim(Pp(0, 0), Pp(B(o), 0), -5, f2(B(o), 2) + ' (ouverture biaise)', { h: 2 });
    S.dim([Pp(xmax, 0)[0] + 4, Pp(0, 0)[1]], [Pp(xmax, 0)[0] + 4, Pp(0, W)[1]], 0, f2(W, 2), { noExt: true, h: 2 });
    S.text(Pp(xmax, 0)[0], Pp(0, 0)[1] - 10, 'biais ' + f2(bg, 1) + ' gr', 2.4, { a: 'r' });
    S.title(15, yTop, 'VUE EN PLAN', 'échelle 1/' + scPl + ' — traverse, semelles (cachées) et dalles de transition');
    // ---------- coupe suivant l'axe du portique ----------
    const scT = P.pickScale(W + 1, 118, [20, 25, 50, 75, 100, 125, 200, 250]), kT = 1000 / scT, x0T = 286, yT = 236;
    const T = (x, y) => [x0T + x * kT, yT + y * kT], hT = Math.min(h, 1.2);
    S.poly([T(0, hT), T(W, hT), T(W, hT + e3), T(0, hT + e3)], 'CONTOUR', true); S.fill([T(0, hT), T(W, hT), T(W, hT + e3), T(0, hT + e3)], 'BETON');
    S.poly([T(0, 0), T(W, 0), T(W, hT), T(0, hT)], 'CACHE', true);
    const tp = hT + e3; let xx = 0; const xs = [0]; for (const w of ws) { xx += w; xs.push(xx); }
    if (hs > 0) S.poly([T(0, tp + hs), T(W, tp + hs)], 'TERRAIN');
    if (ws[0] > 0) S.poly([T(xs[0], tp + hs), T(xs[1], tp + hs), T(xs[1], tp + hs + hc + 0.2), T(xs[0], tp + hs + hc + 0.2)], 'VU', true);
    if (ws[4] > 0) S.poly([T(xs[4], tp + hs), T(xs[5], tp + hs), T(xs[5], tp + hs + hc + 0.2), T(xs[4], tp + hs + hc + 0.2)], 'VU', true);
    if (hc > 0) S.poly([T(xs[1], tp + hs + hc), T(xs[4], tp + hs + hc)], 'VU');
    const ydT = T(0, tp + hs + hc + 0.2)[1] + 5, xsd = [xs[0]].concat(xs.slice(1).filter((x, i) => ws[i] > 0));
    S.chainH(xsd.map(x => T(x, 0)[0]), ydT, ws.filter(w => w > 0).map(w => f2(w, 2)), { h: 1.9 });
    S.dim([T(0, 0)[0], T(0, 0)[1] - 5], [T(W, 0)[0], T(0, 0)[1] - 5], 0, f2(W, 2) + ' (largeur droite)', { noExt: true, h: 2 });
    S.text(T(W / 2, 0)[0], T(0, hT / 2)[1], 'piédroit en arrière-plan — hauteur ' + f2(h, 2) + ' (tronquée)', 1.9, { ly: 'COTES' });
    S.title(282, 281, 'COUPE SUIVANT L\'AXE DU PORTIQUE', 'échelle 1/' + scT + ' — profil en travers de la voie portée');
    S.notes(['NOTES :', '— cotes en mètres ; ouverture et épaisseurs mesurées perpendiculairement', '   aux piédroits (coupe droite) ; ouverture biaise en plan.',
      genre === 2 ? '— semelles : épaisseur ' + f2(e1, 2) + ' m (max(E2 ; 0,60)), largeur ' + f2(Ws, 2) + ' m.' : '— fondations profondes : voir plan des fondations.',
      '— dalles de transition : épaisseur ' + f2(tdt, 2) + ' m, pente 5 % (indicatif).'], 282, 120);
    const tit = [m.titre, m.soustitre].filter(Boolean);
    S.cartouche({ titre: 'PLAN DE COFFRAGE DU PORTIQUE', sous: 'portique ouvert en béton armé — PIPO-EL', ouvrage: tit, numero: m.numero, echelles: 'coupe 1/' + scC + ', plan 1/' + scPl + ', coupe axiale 1/' + scT, planNo: 'COF-01' });
    return { S, scC, scPl, scT };
  }
  G.PIPO_PLANS = { coffrage };
})(typeof window !== 'undefined' ? window : globalThis);
