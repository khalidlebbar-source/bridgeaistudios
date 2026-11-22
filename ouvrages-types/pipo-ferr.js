/* PIPO-EL — plans de ferraillage du portique ouvert sur semelles, façon ADFER (BridgeAI / KLE Ingénierie)
   Barres du calcul : r.fer.ad (nappes adoptées), r.fer.ep (épures : traverse, angles, piédroits, fers solidarisant des semelles),
   r.fer.nom (aciers auxiliaires PHI2) et r.fer.tr (transversal). Coupe biaise (suivant l'axe de la voie portée), comme le calcul.
   Planche 1 : coupe ferraillée, détails de l'angle et de la semelle. Planche 2 : nomenclature, récapitulatif, contrôle avant-métré. */
(function (G) {
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d)).toFixed(d == null ? 2 : d);
  const mmOf = p => Math.round(p * 1000);          // φ du calcul en m → mm
  const nb = (w, sp) => (sp > 0 ? Math.round(w / sp) : 0);

  function bars(m, r) {
    const g = r.g, v = r.v, F = r.fer, ad = F.ad, ep = F.ep, nom = F.nom, tr = F.tr, sn = g.sn || 1;
    const o = v.OUVER / sn, e2 = g.e2 / sn, e3 = g.e3, e1 = g.e1, h = v.HAUTL, c = 0.025;
    const Bt = o + 2 * e2, Ht = e1 + h + e3, xa = e2 / 2, ya = e1 / 2, larg = g.larg, Wb = nom.Wb;
    const aI = r.aInt / sn, aE = r.aExt / sn, sem = [-aE, e2 + aI];     // semelle gauche : abscisses (parement extérieur du piédroit = 0)
    const d2 = mmOf(v.PHI2), mm = d => d / 1000, cx = d => c + d / 2000, mir = pts => pts.map(p => [Bt - p[0], p[1]]);
    const out = []; let k = 0;
    const add = (b, same) => { b.id = String(same ? k : ++k); out.push(b); return b; };
    const segsOf = pts => pts.slice(1).map((q, i) => ({ l: Math.round(Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]) * 1000) / 1000, a: Math.round(Math.atan2(q[1] - pts[i][1], q[0] - pts[i][0]) * 180 / Math.PI) }));
    const lb = x => x + (x > 10 ? 0.6 : 0);
    // ── semelles : fers solidarisant (nappe 4, face intérieure) et face extérieure
    ep.semI.forEach((b, j) => { const d = mmOf(ad.pdBase.phi), x = e2 - cx(d) - j * 1.25 * mm(d), yB = cx(d) + j * 1.25 * mm(d), xe = Math.min(xa + b[1] / sn, sem[1] - cx(d));
      const pts = [[x, ya + b[0]], [x, yB], [xe, yB]];
      add({ zone: 'semelle', d, n: nb(Wb, 2 * ad.pdBase.esp), ne: 2, esp: 2 * ad.pdBase.esp, role: 'Semelle — fers solidarisant, face intérieure' + (ep.semI.length > 1 ? ' (' + 'ab'[j] + ')' : ''), segs: segsOf(pts), paths: [pts, mir(pts)], tag: { side: 'bottom', p: [x + (xe - x) * (0.55 + 0.2 * j), yB] } }); });
    { const b = ep.semE, d = mmOf(ad.semE.sol.phi), x = cx(d), yB = cx(d) + 2.5 * mm(mmOf(ad.pdBase.phi)), xe = Math.max(xa + b[1] / sn, sem[0] + cx(d));
      const pts = [[x, ya + b[0]], [x, yB], [xe, yB]];
      add({ zone: 'semelle', d, n: nb(Wb, ad.semE.sol.esp), ne: 2, esp: ad.semE.sol.esp, role: 'Semelle — fers solidarisant, face extérieure', segs: segsOf(pts), paths: [pts, mir(pts)], tag: { side: 'bottom', p: [x + (xe - x) * 0.6, yB] } }); }
    { const d = d2, y = e1 - cx(d), pts = [[sem[0] + c, y], [sem[1] - c, y]];
      add({ zone: 'semelle', d, n: nb(Wb, nom.espP), ne: 2, esp: nom.espP, role: 'Semelle — nappe supérieure', segs: segsOf(pts), paths: [pts, mir(pts)], tag: { side: 'bottom', p: [sem[1] - 0.25, y] } }); }
    if (ep.p6) { const d = mmOf(ep.p6.phi), x = cx(mmOf(ad.trSup.phi)) + mm(mmOf(ad.trSup.phi)) * 1.6, pts = [[x, ya + ep.p6.seg[0]], [x, ya + ep.p6.seg[1]]];
      add({ zone: 'piedroit', d, n: nb(Wb, 2 * F.eP), ne: 2, esp: 2 * F.eP, role: 'Piédroits — face extérieure (entre semelle et angle)', segs: segsOf(pts), paths: [pts, mir(pts)], tag: { side: 'left', p: [x, ya + (ep.p6.seg[0] + ep.p6.seg[1]) / 2] } }); }
    // ── piédroits, face intérieure (nappe 3)
    ep.pied.forEach((b, j) => { const d = mmOf(ad.pdCour.phi), x = e2 - cx(d) - (1.25 * mm(mmOf(ad.pdBase.phi))) - j * 1.25 * mm(d), pts = [[x, ya + Math.max(b[0], -ya + c)], [x, ya + b[1]]];
      add({ zone: 'piedroit', d, n: nb(Wb, ep.pied.length * ad.pdCour.esp), ne: 2, esp: ep.pied.length * ad.pdCour.esp, role: 'Piédroits — face intérieure' + (ep.pied.length > 1 ? ' (' + (j ? 'bas' : 'haut') + ')' : ''), segs: segsOf(pts), paths: [pts, mir(pts)], tag: { side: 'left', p: [x, ya + b[0] + (b[1] - b[0]) * (j ? 0.3 : 0.62)] } }); });
    // ── angles supérieurs (4 barres en L, une sur quatre)
    ep.ang.forEach((b, j) => { const d = mmOf(ad.trSup.phi), off = (j % 2) * 1.25 * mm(d), x0 = cx(d) + off, y0 = Ht - cx(d) - off;
      const pts = [[x0, ya + b[0]], [x0, y0], [xa + b[1], y0]];
      add({ zone: 'traverse', d, n: nb(larg, 4 * F.e), ne: 2, esp: 4 * F.e, role: 'Angle supérieur — nappe extérieure, barre ' + (j + 1) + ' (1 sur 4)', segs: segsOf(pts), paths: [pts, mir(pts)], tag: { side: 'top', p: [xa + b[1] * (0.35 + 0.12 * j), y0] } }); });
    { const d = d2, y = Ht - cx(mmOf(ad.trSup.phi)) - 1.25 * mm(mmOf(ad.trSup.phi)) - mm(mmOf(ad.trSup.phi)) / 2 - mm(d) / 2, l = nom.lExt, pts = [[Bt / 2 - l / 2, y], [Bt / 2 + l / 2, y]];
      add({ zone: 'traverse', d, n: nb(larg, nom.espT), ne: 1, esp: nom.espT, role: 'Traverse — prolongement extérieur', segs: segsOf(pts), paths: [pts], tag: { side: 'top', p: [Bt / 2 + l * 0.2, y] } }); }
    // ── traverse, face intérieure (4 barres décalées)
    ep.trav.forEach((b, j) => { const d = mmOf(ad.trInt.phi), y = Ht - e3 + cx(d) + (j % 2) * 1.25 * mm(d), pts = [[xa + b[0], y], [xa + b[1], y]];
      add({ zone: 'traverse', d, n: nb(larg, 4 * F.e), ne: 1, esp: 4 * F.e, role: 'Traverse — face intérieure, barre ' + (j + 1) + ' (1 sur 4)', segs: segsOf(pts), paths: [pts], tag: { side: 'top', p: [xa + b[0] + (b[1] - b[0]) * (0.25 + 0.15 * j), y] } }); });
    nom.lInt.forEach((l0, j) => { const d = d2, y = Ht - e3 + c + 2.4 * mm(mmOf(ad.trInt.phi)) + mm(d) / 2, pts = [[cx(d) + 0.12, y], [xa + l0, y]];
      add({ zone: 'traverse', d, n: nb(larg, nom.espT), ne: 2, esp: nom.espT, role: 'Traverse — prolongement intérieur dans l\'angle (' + 'ab'[j] + ')', segs: segsOf(pts), paths: [pts, mir(pts)], tag: { side: 'top', p: [xa + l0 * 0.7, y] } }); });
    { const d = d2, P0 = [e2 - c, Ht - e3 - 0.9], P1 = [e2 - c, Ht - e3 + c], P2 = [e2 + 0.9, Ht - e3 + c], pts = [[P0[0] - 0.05, P0[1]], [P1[0] - 0.05, P1[1] + 0.04], [P2[0], P2[1] + 0.04]];
      add({ zone: 'traverse', d, n: nb(Wb, nom.espP), ne: 2, esp: nom.espP, role: 'Renfort d\'angle intérieur', segs: [{ l: 0.9, a: 90 }, { l: 0.9, a: 0 }], L: 1.8, paths: [pts, mir(pts)], tag: { side: 'left', p: [pts[0][0], Ht - e3 - 0.55] } }); }
    // ── répartition (PHI2, parallèles à l'axe du portique)
    const wl = lb(Wb), pieces = Wb > 10 ? [10, Wb - 10 + 0.6] : [Wb];
    const dots = (x0, x1, y, n) => { const q = []; for (let i = 0; i < n; i++) q.push([x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), y]); return q; };
    const vd = (x, y0, y1, n) => dots(y0, y1, 0, n).map(p => [x, p[0]]);
    const repRow = (zone, role, n, dpts, tag) => pieces.forEach((L, i) => add({ zone, d: d2, n, ne: 1, esp: null, role: role + (pieces.length > 1 ? ' — ' + (i ? 'tête-bêche' : '10 m') : ''), segs: [{ l: Math.round(L * 1000) / 1000, a: 0 }], rep: true, dots: i ? [] : dpts, tag: i ? null : tag, sub: pieces.length > 1 ? 'ab'[i] : '' }, i > 0));
    const lT = (v.OUVER + 2 * g.e2) / sn, nTi = nb(lT, tr.esp), nTe = nb(lT, nom.espTE);
    const yTi = Ht - e3 + c + 2.4 * mm(mmOf(ad.trInt.phi)) + mm(d2) * 1.6, yTe = Ht - c - 2.4 * mm(mmOf(ad.trSup.phi)) - mm(d2) * 1.6;
    const dT = dots(0.08, Bt - 0.08, yTe, nTe).concat(dots(e2 + 0.05, Bt - e2 - 0.05, yTi, nTi));
    repRow('traverse', 'Traverse — répartition (2 faces)', nTi + nTe + 16, dT, { side: 'top', p: dT[Math.floor(nTe * 0.88)] });
    const n02 = nb(2, 0.2), nUp = nb(Math.max(0, v.HAUTL - 2), nom.espPd), pd = [];
    for (const x of [cx(mmOf(ad.trSup.phi)) + 2.4 * mm(mmOf(ad.trSup.phi)) + mm(d2) / 2, e2 - c - 2.6 * mm(mmOf(ad.pdBase.phi)) - mm(d2) / 2]) { pd.push(...vd(x, e1 + 0.1, e1 + 2, n02)); pd.push(...vd(x, e1 + 2 + nom.espPd, Ht - e3 - 0.1, nUp)); }
    repRow('piedroit', 'Piédroits — répartition (4 faces, 0.20 sur 2 m puis ' + f2(nom.espPd) + ')', 4 * (n02 + nUp), pd.concat(mir(pd)), { side: 'left', p: pd[n02 + Math.floor(nUp * 0.45)] });
    const Bs = sem[1] - sem[0], nSs = nb(g.B, nom.espSs), nSi = nb(g.B, 0.2), ds = dots(sem[0] + 0.08, sem[1] - 0.08, e1 - c - mm(d2) * 1.5, nSs).concat(dots(sem[0] + 0.08, sem[1] - 0.08, c + 3.8 * mm(mmOf(ad.pdBase.phi)), nSi));
    repRow('semelle', 'Semelles — répartition (2 nappes)', 2 * (nSs + nSi), ds.concat(mir(ds)), { side: 'bottom', p: ds[Math.floor(nSs * 0.2)] });
    return { list: out, geo: { o, h, e1, e2, e3, Bt, Ht, c, sem, xa, ya, sn, larg, Wb, bg: v.BIAIS }, ton: F.metre.ton.reduce((a, x) => a + x, 0) * 1000, beton: F.metre.beton };
  }

  function outlines(G0) {
    const { Bt, Ht, e1, e2, e3, sem } = G0;
    const port = [[0, e1], [e2, e1], [e2, Ht - e3], [Bt - e2, Ht - e3], [Bt - e2, e1], [Bt, e1], [Bt, Ht], [0, Ht]];
    const sL = [[sem[0], 0], [sem[1], 0], [sem[1], e1], [sem[0], e1]], sR = sL.map(p => [Bt - p[0], p[1]]);
    return [port, sL, sR];
  }

  function sheet1(m, r, BB) {
    const P = G.OTPLAN, F = G.OTFERR, S = P.Sheet(), G0 = BB.geo, { Bt, Ht, e1, e2, e3, sem, c } = G0;
    S.frame();
    const x0 = sem[0], x1 = Bt - sem[0], Wd = x1 - x0;
    const sc = [20, 25, 50, 75, 100, 125, 150, 200].find(v => Wd * 1000 / v <= 200 && Ht * 1000 / v <= 200) || 200, k = 1000 / sc;
    const ox = 14 + 40 + (200 - Wd * k) / 2 - x0 * k, oy = 14 + 34 + (200 - Ht * k) / 2, T = (x, y) => [ox + x * k, oy + y * k];
    F.drawPolys(S, outlines(G0), T);
    F.drawBars(S, BB.list, T, k);
    { const a = T(Bt / 2, -0.35), z = T(Bt / 2, Ht + 0.35); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    S.earth([T(x1 + 0.5, 0), T(x0 - 0.5, 0)], { step: 2.4, len: 1.6 });
    F.viewBubbles(S, BB.list, T, [T(x0, 0)[0], T(0, 0)[1], T(x1, 0)[0], T(0, Ht)[1]]);
    S.text(T(Bt / 2, 0)[0], T(0, e1 + G0.h / 2)[1], 'O = ' + f2(G0.o) + (G0.sn < 0.999 ? ' (biaise)' : '') + ' — Hi = ' + f2(G0.h), 2.4, { ly: 'COTES' });
    S.text(T(x1, 0)[0] + 3, T(0, Ht / 2)[1], 'symétrique', 2.2, { rot: 90, ly: 'COTES' });
    S.vtitle(ox + (x0 + Wd / 2) * k, 279, 'COUPE ' + (G0.sn < 0.999 ? 'BIAISE' : 'TRANSVERSALE') + ' DU PORTIQUE — FERRAILLAGE', 'Éch : 1/' + sc + (G0.sn < 0.999 ? ' — suivant l\'axe de la voie portée (biais ' + f2(G0.bg, 1) + ' gr)' : ''));
    // détail de l'angle supérieur gauche
    const R = [-0.05, Ht - Math.max(e3 + 1.0, 1.4), Math.max(e2 + 1.1, 1.5), Ht + 0.05];
    const scD = [10, 20, 25, 50].find(v => (R[2] - R[0]) * 1000 / v <= 120 && (R[3] - R[1]) * 1000 / v <= 72) || 50, kD = 1000 / scD;
    const TD = (x, y) => [282 - R[0] * kD, 200 - R[1] * kD].map((q, i) => q + (i ? y : x) * kD);
    F.drawPolys(S, outlines(G0), TD, R); F.drawBars(S, BB.list, TD, kD, R);
    S.brk(TD(0, R[1])[0], TD(0, R[1])[1], TD(e2, R[1])[0], TD(e2, R[1])[1]); S.brk(TD(R[2], Ht)[0], TD(R[2], Ht)[1], TD(R[2], Ht - e3)[0], TD(R[2], Ht - e3)[1]);
    S.dim(TD(0, Ht), TD(c, Ht), 4, 'c=' + f2(c, 3), { h: 1.8 });
    F.detailBubbles(S, BB.list, TD, R);
    S.vtitle(342, 279, "DÉTAIL DE L'ANGLE SUPÉRIEUR", 'Éch : 1/' + scD);
    // détail de la semelle gauche
    const R2 = [sem[0] - 0.05, -0.05, sem[1] + 0.05, e1 + 1.2];
    const scS = [20, 25, 50, 75].find(v => (R2[2] - R2[0]) * 1000 / v <= 118 && (R2[3] - R2[1]) * 1000 / v <= 50) || 75, kS = 1000 / scS;
    const TS = (x, y) => [283 + (x - R2[0]) * kS, 124 + (y - R2[1]) * kS];
    F.drawPolys(S, outlines(G0), TS, R2); F.drawBars(S, BB.list, TS, kS, R2);
    S.brk(TS(0, R2[3])[0], TS(0, R2[3])[1], TS(e2, R2[3])[0], TS(e2, R2[3])[1]);
    S.earth([TS(R2[2], 0), TS(R2[0], 0)], { step: 2.2, len: 1.4 });
    F.detailBubbles(S, BB.list, TS, R2);
    S.chainH([TS(sem[0], 0)[0], TS(0, 0)[0], TS(e2, 0)[0], TS(sem[1], 0)[0]], TS(0, 0)[1] - 5, [f2(-sem[0]), f2(e2), f2(sem[1] - e2)], { h: 1.7 });
    S.vtitle(342, 192, 'DÉTAIL DE LA SEMELLE', 'Éch : 1/' + scS);
    S.notes(['NOTES :', '— Aciers HA ; enrobage 0.025 m (règle du calcul PIPO) ; cotes en mètres.', '— Arrêts des barres : épures du calcul (décalage 0.8 h et scellement).',
      '— Barres de largeur > 10 m : 10 m + tête-bêche (recouvrement 0.60 m).', '— Ferraillage symétrique par rapport à l\'axe du portique.'], 284, 112);
    S.cartouche({ titre: 'PLAN DE FERRAILLAGE DU PORTIQUE', sous: 'coupes — planche 1/2', ouvrage: [m.titre, m.soustitre].filter(Boolean), numero: m.numero, echelles: '1/' + sc + ', 1/' + scD + ', 1/' + scS, planNo: 'FER-01' });
    return { S, sc };
  }

  function build(m, r) {
    const BB = bars(m, r), s1 = sheet1(m, r, BB);
    const s2 = G.OTFERR.nomenSheet(m, BB.list, { vol: BB.beton, ton: BB.ton, cart: { titre: 'PLAN DE FERRAILLAGE DU PORTIQUE', sous: 'nomenclature — planche 2/2', ouvrage: [m.titre, m.soustitre].filter(Boolean), numero: m.numero, planNo: 'FER-02' } });
    return { sheets: [{ S: s1.S, label: 'Coupes', sub: 'A3 · coupe 1/' + s1.sc + ' · détails angle et semelle' }, ...s2.sheets.map((S, i) => ({ S, label: 'Nomenclature' + (s2.sheets.length > 1 ? ' ' + (i + 1) : ''), sub: 'A3 · nomenclature ADFER · ' + (s2.tot / 1000).toFixed(2) + ' t' }))], bars: BB };
  }
  G.PIPO_FERR = { bars, build };
})(typeof window !== 'undefined' ? window : globalThis);
