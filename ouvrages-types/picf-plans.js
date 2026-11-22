/* PICF-EL — plan de coffrage du cadre (BridgeAI / KLE Ingénierie)
   Coupe droite du cadre (perpendiculaire aux piédroits) avec remblai, chaussée et dalles de transition ; coupe suivant
   l'axe du cadre (profil en travers de la voie portée) ; vue en plan biaise. Données : GEOM.*, PROF.* du bordereau. */
(function (G) {
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
  const V = (m, k) => { const x = parseFloat(String(m[k] == null ? '' : m[k]).replace(',', '.')); return isFinite(x) ? x : 0; };

  function coffrage(m) {
    const P = G.OTPLAN, S = P.Sheet();
    const o = V(m, 'GEOM.OUVER') || 1, h = V(m, 'GEOM.HAUTL') || 1, e1 = V(m, 'GEOM.E1'), e2 = V(m, 'GEOM.E2'), e3 = V(m, 'GEOM.E3');
    const ld = V(m, 'GEOM.LDALT'), hs = V(m, 'PROF.HSREM'), hc = V(m, 'PROF.HCHAU'), bg = Math.max(30, Math.min(100, V(m, 'GEOM.BIAIS') || 100));
    const ws = ['PROF.ETROTG', 'PROF.EGAU', 'PROF.ESURCH', 'PROF.EDROI', 'PROF.ETROTD'].map(k => V(m, k)), sum = ws.reduce((a, b) => a + b, 0);
    const W = V(m, 'PROF.LARGE') || sum || 10, b = bg * Math.PI / 200;
    const B = o + 2 * e2, Hx = e1 + h + e3, top = h + e3, road = top + hs + hc, tdt = 0.30;
    S.frame();
    // ---------- coupe droite du cadre ----------
    const ext = ld + 1.0, scC = P.pickScale(Math.max(B + 2 * ext + 1.5, 1), 245, [20, 25, 50, 75, 100, 125, 200]), kC = 1000 / scC;
    const hC = (road + e1 + 0.5) * kC, ox = 15 + 12 + (ext) * kC + e2 * kC, oy = 268 - hC + e1 * kC - 4;
    const C = (x, y) => [ox + x * kC, oy + y * kC];     // x = 0 au parement intérieur gauche, y = 0 au-dessus du radier
    const rect = (x0, y0, x1, y1, ly) => S.poly([C(x0, y0), C(x1, y0), C(x1, y1), C(x0, y1)], ly || 'CONTOUR', true);
    const outer = [C(-e2, -e1), C(o + e2, -e1), C(o + e2, top), C(-e2, top)], inner = [C(0, 0), C(o, 0), C(o, h), C(0, h)];
    S.fill(outer, 'BETON'); S.P.push({ t: 'F', p: inner, ly: 'BLANC', solid: 1 }); S.poly(outer, 'CONTOUR', true); S.poly(inner, 'CONTOUR', true);
    // terrain et remblai (traits fins)
    const xl = -e2 - ext, xr = o + e2 + ext;
    S.poly([C(xl, road - hc), C(-e2 - ld, road - hc)], 'TERRAIN'); S.poly([C(o + e2 + ld, road - hc), C(xr, road - hc)], 'TERRAIN');
    S.poly([C(xl, -e1), C(xr, -e1)], 'TERRAIN');
    if (hc > 0) S.poly([C(xl, road), C(xr, road)], 'VU');
    S.poly([C(-e2, top), C(-e2, top + hs)], 'TERRAIN'); S.poly([C(o + e2, top), C(o + e2, top + hs)], 'TERRAIN');
    // dalles de transition (pente 5 %)
    if (ld > 0) for (const sg of [-1, 1]) {
      const xa = sg < 0 ? -e2 : o + e2, xb = xa + sg * ld, ya = top + Math.min(hs, 0.4) * 0.2, yb = ya - 0.05 * ld;
      S.poly([C(xa, ya), C(xb, yb), C(xb, yb + tdt), C(xa, ya + tdt)], 'CONTOUR', true);
    }
    // axe
    { const a = C(o / 2, -e1 - 0.6), z = C(o / 2, road + 0.6); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    // cotes
    S.chainH([C(-e2, 0)[0], C(0, 0)[0], C(o, 0)[0], C(o + e2, 0)[0]], C(0, -e1)[1] - 6, [f2(e2, 2), f2(o, 2), f2(e2, 2)]);
    S.dim([C(-e2, 0)[0], C(0, -e1)[1] - 13], [C(o + e2, 0)[0], C(0, -e1)[1] - 13], 0, f2(B, 2), { noExt: true });
    S.chainV([C(0, -e1)[1], C(0, 0)[1], C(0, h)[1], C(0, top)[1]].concat(hs > 0 ? [C(0, top + hs)[1]] : []), C(o + e2, 0)[0] + 7, [f2(e1, 2), f2(h, 2), f2(e3, 2)].concat(hs > 0 ? [f2(hs, 2)] : []), { right: true });
    S.dim([C(o + e2, 0)[0] + 18, C(0, -e1)[1]], [C(o + e2, 0)[0] + 18, C(0, top)[1]], 0, f2(Hx, 2), { noExt: true, h: 2 });
    if (ld > 0) S.dim(C(-e2 - ld, top + 0.6), C(-e2, top + 0.6), 3, f2(ld, 2), { noExt: true, h: 2 });
    S.text(C(o / 2, 0)[0], C(0, h / 2)[1], 'ouverture droite ' + f2(o, 2) + ' — hauteur libre ' + f2(h, 2), 2.2, { ly: 'COTES' });
    S.title(15, 281, 'COUPE DROITE DU CADRE', 'échelle 1/' + scC + ' — perpendiculaire aux piédroits');
    // ---------- vue en plan ----------
    const s = Math.sin(b), ob = o / s, eb = e2 / s, lb = ld / s, dx = W / Math.tan(b);
    const xmin = Math.min(0, dx) - eb - lb - 1, xmax = Math.max(0, dx) + ob + eb + lb + 1;
    const yTopPlan = C(0, -e1)[1] - 26, scP = P.pickScale(Math.max(xmax - xmin, W * 2.6), 245, [50, 75, 100, 125, 200, 250, 500]), scPl = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000].find(sc => sc >= scP && 1000 / sc <= (yTopPlan - 22) / (W + 3)) || 1000, kPl = 1000 / scPl;
    const oxP = 15 + 10 + (-xmin) * kPl, oyP = yTopPlan - 10 - W * kPl;
    const Pp = (x, y) => [oxP + x * kPl, oyP + y * kPl];
    const band = (x1, x2, ly) => S.poly([Pp(x1, 0), Pp(x2, 0), Pp(x2 + dx, W), Pp(x1 + dx, W)], ly, true);
    band(-eb, ob + eb, 'CONTOUR'); band(0, ob, 'CACHE');
    if (ld > 0) { band(-eb - lb, -eb, 'VU'); band(ob + eb, ob + eb + lb, 'VU'); }
    { const a = Pp(xmin, W / 2), z = Pp(xmax, W / 2); S.line(a[0], a[1], z[0], z[1], 'AXE'); S.text(a[0] + 1, a[1] + 1.2, 'axe de la voie portée', 2, { a: 'l', ly: 'AXE' }); }
    { const a = Pp((ob) / 2 - 0, 0), z = Pp(ob / 2 + dx, W); S.line(a[0], a[1] - 4, z[0], z[1] + 4, 'AXE'); }
    S.dim(Pp(0, 0), Pp(ob, 0), -5, f2(ob, 2) + ' (ouverture biaise)', { h: 2 });
    S.dim([Pp(xmax, 0)[0] + 4, Pp(0, 0)[1]], [Pp(xmax, 0)[0] + 4, Pp(0, W)[1]], 0, f2(W, 2), { noExt: true, h: 2 });
    if (ld > 0) S.dim(Pp(-eb - lb, 0), Pp(-eb, 0), -5, f2(lb, 2), { h: 1.9 });
    S.text(Pp(ob + eb + 0.3, 0)[0] + 1, Pp(0, 0)[1] - 9, 'biais ' + f2(bg, 1) + ' gr', 2.4, { a: 'l' });
    S.title(15, yTopPlan, 'VUE EN PLAN', 'échelle 1/' + scPl + ' — piédroits et dalles de transition');
    // ---------- coupe suivant l'axe du cadre (profil en travers de la voie portée) ----------
    const scT = P.pickScale(W + 1, 118, [20, 25, 50, 75, 100, 125, 200, 250]), kT = 1000 / scT, x0T = 286, yT = 232;
    const T = (x, y) => [x0T + x * kT, yT + y * kT], hT = Math.min(h, 1.2);   // hauteur intérieure tronquée
    S.poly([T(0, -e1), T(W, -e1), T(W, 0), T(0, 0)], 'CONTOUR', true); S.fill([T(0, -e1), T(W, -e1), T(W, 0), T(0, 0)], 'BETON');
    S.poly([T(0, hT), T(W, hT), T(W, hT + e3), T(0, hT + e3)], 'CONTOUR', true); S.fill([T(0, hT), T(W, hT), T(W, hT + e3), T(0, hT + e3)], 'BETON');
    S.poly([T(-0.3, hT * 0.5 - 0.1), T(-0.1, hT * 0.5 + 0.1)], 'VU'); S.poly([T(W + 0.1, hT * 0.5 - 0.1), T(W + 0.3, hT * 0.5 + 0.1)], 'VU');
    const tp = hT + e3, x0 = (W - sum) / 2; let xx = x0; const xs = [xx]; for (const w of ws) { xx += w; xs.push(xx); }
    if (hs > 0) { S.poly([T(0, tp + hs), T(W, tp + hs)], 'TERRAIN'); }
    if (ws[0] > 0) S.poly([T(xs[0], tp + hs), T(xs[1], tp + hs), T(xs[1], tp + hs + hc + 0.2), T(xs[0], tp + hs + hc + 0.2)], 'VU', true);
    if (ws[4] > 0) S.poly([T(xs[4], tp + hs), T(xs[5], tp + hs), T(xs[5], tp + hs + hc + 0.2), T(xs[4], tp + hs + hc + 0.2)], 'VU', true);
    if (hc > 0) S.poly([T(xs[1], tp + hs + hc), T(xs[4], tp + hs + hc)], 'VU');
    const yd = T(0, tp + hs + hc + 0.2)[1] + 5, labs = ws.map((w, i) => w > 0 ? f2(w, 2) : '').filter(Boolean), xsd = [xs[0]].concat(xs.slice(1).filter((x, i) => ws[i] > 0));
    S.chainH(xsd.map(x => T(x, 0)[0]), yd, labs, { h: 1.9 });
    S.dim([T(0, 0)[0], T(0, -e1)[1] - 5], [T(W, 0)[0], T(0, -e1)[1] - 5], 0, f2(W, 2) + ' (longueur du cadre)', { noExt: true, h: 2 });
    S.text(T(W / 2, 0)[0], T(0, hT / 2)[1], 'hauteur libre ' + f2(h, 2) + ' (dessin tronqué)', 1.9, { ly: 'COTES' });
    S.title(282, 281, 'COUPE SUIVANT L\'AXE DU CADRE', 'échelle 1/' + scT + ' — profil en travers de la voie portée');
    S.notes(['NOTES :', '— cotes en mètres ; ouverture et épaisseurs mesurées perpendiculairement', '   aux piédroits (coupe droite) ; ouverture biaise en plan.',
      '— dalles de transition : épaisseur ' + f2(tdt, 2) + ' m, pente 5 % (indicatif).', '— gousset et chanfreins à préciser sur le plan de ferraillage.'], 282, 120);
    S.cartouche({ titre: 'PLAN DE COFFRAGE DU CADRE', sous: 'cadre fermé en béton armé — PICF-EL', ouvrage: m.titre, numero: m.num || m.numero, echelles: 'coupe 1/' + scC + ', plan 1/' + scPl + ', coupe axiale 1/' + scT, planNo: 'COF-01' });
    return { S, scC, scPl, scT };
  }
  G.PICF_PLANS = { coffrage };
})(typeof window !== 'undefined' ? window : globalThis);
