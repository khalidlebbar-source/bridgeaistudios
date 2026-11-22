/* PICF-EL — plans de ferraillage du cadre, façon ADFER (BridgeAI / KLE Ingénierie)
   Les barres sont celles du calcul (R.fer : sections et espacements ; R.det : épures d'arrêt des barres, aciers auxiliaires PHI2,
   étriers PHI3), placées à l'enrobage MAT.ENROB, avec les goussets par défaut du document CHAMOA PICF.
   Planche 1 : coupe transversale ferraillée, détail d'angle, coupe A-A de la traverse. Planche 2 : nomenclature et récapitulatif. */
(function (G) {
  const V = (m, k) => { const x = parseFloat(String(m[k] == null ? '' : m[k]).replace(/[=c]/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d)).toFixed(d == null ? 2 : d);
  const nb = (w, sp) => (sp > 0 ? Math.round(w / sp) : 0);

  /* ───────── barres du cadre (coordonnées m : x depuis le parement extérieur gauche, y depuis la sous-face du radier) ───────── */
  function bars(m, r) {
    const o = V(m, 'GEOM.OUVER'), h = V(m, 'GEOM.HAUTL'), e1 = V(m, 'GEOM.E1'), e2 = V(m, 'GEOM.E2'), e3 = V(m, 'GEOM.E3');
    const c = V(m, 'MAT.ENROB') || 0.03, phi = ['ACIER.PHI1', 'ACIER.PHI2', 'ACIER.PHI3'].map((k, i) => V(m, k) || [25, 14, 10][i]);
    const g = r.geom, s = g.s || 1, W = g.W, B = o + 2 * e2, Ht = e1 + h + e3, xa = e2 / 2, ya = e1 / 2;
    const fer = r.fer, D = r.det, ep = D.epure, nom = D.nom;
    const gs = o <= 3 ? [0.2, 0.2] : o <= 5 ? [0.6, 0.3] : [0.9, 0.3], gi = o <= 2 ? [0.3, 0.2] : o <= 4 ? [0.5, 0.3] : [0.7, 0.5];
    const cx = d => c + d / 2000, mm = d => d / 1000, mir = pts => pts.map(p => [B - p[0], p[1]]);
    const out = []; let k = 0;
    const add = (b, same) => { b.id = String(same ? k : ++k); out.push(b); return b; };
    const segsOf = pts => pts.slice(1).map((q, i) => ({ l: Math.round(Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]) * 1000) / 1000, a: Math.round(Math.atan2(q[1] - pts[i][1], q[0] - pts[i][0]) * 180 / Math.PI) }));
    const d1 = phi[0], d2 = phi[1], d3 = phi[2];
    // ── radier
    ep.AI.bars.forEach((b, j) => {
      const d = phi[ep.AI.phi], off = j * 1.25 * mm(d), x0 = cx(d) + off, y0 = cx(d) + off;
      const pts = [[x0, ya + b[0]], [x0, y0], [xa + b[1], y0]];
      add({ zone: 'radier', d, n: nb(W, 2 * ep.AI.espT), ne: 2, esp: 2 * ep.AI.espT, role: 'Radier — angle inférieur, nappe extérieure (famille ' + 'ab'[j] + ')', segs: segsOf(pts), paths: [pts, mir(pts)], tag: { side: 'bottom', p: [xa + b[1] * (0.45 + 0.22 * j), y0] } });
    });
    if (nom.lenTI_E > 0.01) { const d = d2, y = cx(d1) + 1.25 * mm(d1) + mm(d1) / 2 + mm(d) / 2, l = nom.lenTI_E; const pts = [[B / 2 - l / 2, y], [B / 2 + l / 2, y]];
      add({ zone: 'radier', d, n: nb(W, nom.LTI_E), ne: 1, esp: nom.LTI_E, role: 'Radier — nappe extérieure centrale', segs: segsOf(pts), paths: [pts], tag: { side: 'bottom', p: [B / 2 - l * 0.12, y] } }); }
    ep.TI.bars.forEach((b, j) => {
      const d = phi[ep.TI.phi], y = e1 - cx(d) - j * 1.25 * mm(d), pts = [[xa + b[0], y], [xa + b[1], y]];
      add({ zone: 'radier', d, n: nb(W, fer.TI.esp * fer.TI.n), ne: 1, esp: fer.TI.esp * fer.TI.n, role: 'Radier — nappe intérieure (famille ' + 'ab'[j] + ')', segs: segsOf(pts), paths: [pts], tag: { side: 'bottom', p: [xa + b[0] + (b[1] - b[0]) * (j ? 0.62 : 0.3), y] } });
    });
    const gous = (sup, gd, L, key) => {
      const d = d2, P1 = sup ? [e2, Ht - e3 - gd[1]] : [e2, e1 + gd[1]], P2 = sup ? [e2 + gd[0], Ht - e3] : [e2 + gd[0], e1];
      const dx = P2[0] - P1[0], dy = P2[1] - P1[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = sup ? -uy : uy, ny = sup ? ux : -ux, cc = cx(d);
      const M = [(P1[0] + P2[0]) / 2 + nx * cc, (P1[1] + P2[1]) / 2 + ny * cc], pts = [[M[0] - ux * L / 2, M[1] - uy * L / 2], [M[0] + ux * L / 2, M[1] + uy * L / 2]];
      return add({ zone: sup ? 'traverse' : 'radier', d, n: nb(W / s, nom.eG), ne: 2, esp: nom.eG, role: 'Gousset ' + (sup ? 'supérieur' : 'inférieur') + ' ' + f2(gd[0]) + ' × ' + f2(gd[1]), segs: [{ l: L, a: Math.round(Math.atan2(uy, ux) * 180 / Math.PI) }], paths: [pts, mir(pts)],
        tag: { side: sup ? 'top' : 'bottom', p: M }, gd, chamfer: [P1, P2] });
    };
    gous(false, gi, nom.LGI);
    // ── piédroits (intérieur)
    ep.PD.bars.forEach((b, j) => {
      const d = phi[ep.PD.phi], x = e2 - cx(d) - j * 1.25 * mm(d), pts = [[x, ya + b[0]], [x, ya + b[1]]];
      const sp = fer.PD.n === 2 ? 2 * fer.PD.esp : fer.PD.esp;
      add({ zone: 'piedroit', d, n: nb(W / s, sp), ne: 2, esp: sp, role: 'Piédroits — nappe intérieure (' + (j ? 'haut' : 'bas') + ')', segs: segsOf(pts), paths: [pts, mir(pts)], tag: { side: 'left', p: [x, ya + b[0] + (b[1] - b[0]) * (j ? 0.7 : 0.35)] } });
    });
    // ── traverse supérieure
    ep.AS.bars.forEach((b, j) => {
      const d = phi[ep.AS.phi], off = j * 1.25 * mm(d), x0 = cx(d) + off, y0 = Ht - cx(d) - off;
      const pts = [[x0, ya + b[0]], [x0, y0], [xa + b[1], y0]];
      add({ zone: 'traverse', d, n: nb(W, 2 * ep.AS.espT), ne: 2, esp: 2 * ep.AS.espT, role: 'Traverse — angle supérieur, nappe extérieure (famille ' + 'ab'[j] + ')' + (ep.AS.lap ? ' — recouvrement au milieu' : ''), segs: segsOf(pts), paths: [pts, mir(pts)], tag: { side: 'top', p: [xa + b[1] * (0.42 + 0.2 * j), y0] } });
    });
    if (nom.lenTS_E > 0.01) { const d = d2, y = Ht - cx(d1) - 1.25 * mm(d1) - mm(d1) / 2 - mm(d) / 2, l = nom.lenTS_E; const pts = [[B / 2 - l / 2, y], [B / 2 + l / 2, y]];
      add({ zone: 'traverse', d, n: nb(W, nom.LTS_E), ne: 1, esp: nom.LTS_E, role: 'Traverse — nappe extérieure centrale', segs: segsOf(pts), paths: [pts], tag: { side: 'top', p: [B / 2 + l * 0.12, y] } }); }
    ep.TS.bars.forEach((b, j) => {
      const d = phi[ep.TS.phi], y = Ht - e3 + cx(d) + j * 1.25 * mm(d), pts = [[xa + b[0], y], [xa + b[1], y]];
      add({ zone: 'traverse', d, n: nb(W, fer.TS.esp * fer.TS.n), ne: 1, esp: fer.TS.esp * fer.TS.n, role: 'Traverse — nappe intérieure (famille ' + 'ab'[j] + ')', segs: segsOf(pts), paths: [pts], tag: { side: 'top', p: [xa + b[0] + (b[1] - b[0]) * (j ? 0.66 : 0.34), y] } });
    });
    gous(true, gs, nom.LGS);
    // ── aciers de répartition (PHI2, parallèles à l'axe du cadre : points en coupe)
    const tr = nom.trLen, dr = d2, dots = (x0, x1, y, n) => { const q = []; for (let i = 0; i < n; i++) q.push([x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), y]); return q; };
    const vdots = (x, y0, y1, n) => dots(y0, y1, 0, n).map(p => [x, p[0]]);
    const yTIe = cx(d1) + 1.25 * mm(d1) + mm(d1) / 2 + mm(dr) / 2 + (nom.lenTI_E > 0.01 ? mm(d2) : 0), yTIi = e1 - c - 2.25 * mm(phi[ep.TI.phi]) - mm(dr) / 2;
    const yTSe = Ht - cx(d1) - 1.25 * mm(d1) - mm(d1) / 2 - mm(dr) / 2 - (nom.lenTS_E > 0.01 ? mm(d2) : 0), yTSi = Ht - e3 + c + 2.25 * mm(phi[ep.TS.phi]) + mm(dr) / 2;
    const nTI = [nb(o, nom.TT.TIi), nb(o, nom.TT.TIe)], nTS = [nb(o, nom.TT.TSi), nb(o, nom.TT.TSe)];
    const xe0 = e2 + 0.05, xe1 = B - e2 - 0.05;
    const repRow = (zone, role, n, dpts, tag) => tr.forEach((L, i) => add({ zone, d: dr, n, ne: 1, esp: null, role: role + (tr.length > 1 ? ' — barre ' + 'ab'[i] + ' (recouvrement)' : ''), segs: [{ l: Math.round(L * 1000) / 1000, a: 0 }], rep: true, dots: i ? [] : dpts, tag: i ? null : tag, sub: tr.length > 1 ? 'ab'[i] : '' }, i > 0));
    const dTI = dots(xe0, xe1, yTIe, nTI[1]).concat(dots(xe0, xe1, yTIi, nTI[0]));
    repRow('radier', 'Radier — répartition (2 nappes)', nTI[0] + nTI[1], dTI, { side: 'bottom', p: dTI[Math.floor(nTI[1] * 0.78)] });
    const xPe = cx(d1) + 1.25 * mm(d1) + mm(d1) / 2 + mm(dr) / 2, xPi = e2 - c - 2.25 * mm(phi[ep.PD.phi]) - mm(dr) / 2;
    const n02 = nb(2, nom.TP[0]), nUp = nb(h - 2, nom.TP[1]), pd = [];
    for (const x of [xPe, xPi]) { pd.push(...vdots(x, e1 + 0.1, e1 + 2, n02)); pd.push(...vdots(x, e1 + 2 + nom.TP[1], Ht - e3 - 0.1, nUp)); }
    const pdAll = pd.concat(mir(pd));
    repRow('piedroit', 'Piédroits — répartition (4 faces, ' + f2(nom.TP[0]) + ' sur 2 m puis ' + f2(nom.TP[1]) + ')', 4 * (n02 + nUp), pdAll, { side: 'left', p: pd[Math.min(pd.length - 1, n02 + Math.floor(nUp * 0.55))] });
    const dTS = dots(xe0, xe1, yTSe, nTS[1]).concat(dots(xe0, xe1, yTSi, nTS[0]));
    repRow('traverse', 'Traverse — répartition (2 nappes)', nTS[0] + nTS[1], dTS, { side: 'top', p: dTS[Math.floor(nTS[1] * 0.85)] });
    const gb = out.filter(b => b.chamfer), gd = [];
    gb.forEach((b, i) => { const n = i ? nom.nTGS : nom.nTGI, P1 = b.chamfer[0], P2 = b.chamfer[1], sup = i === 1;
      const dx = P2[0] - P1[0], dy = P2[1] - P1[1], l = Math.hypot(dx, dy), nx = sup ? -dy / l : dy / l, ny = sup ? dx / l : -dx / l, cc = c + mm(d2) * 1.5 + mm(dr) / 2;
      for (let j = 0; j < n; j++) { const t = (j + 0.5) / n; gd.push([P1[0] + dx * t + nx * cc, P1[1] + dy * t + ny * cc]); } });
    const gdAll = gd.concat(mir(gd));
    repRow('gousset', 'Goussets — répartition', 2 * (nom.nTGS + nom.nTGI), gdAll, { side: 'top', p: gd[gd.length - 2] });
    // ── étriers (PHI3) si nécessaires
    const et = D.etr;
    if (et && et.need) {
      const cfg = { b: ['Radier', e1, 0], t: ['Traverse', e3, Ht - e3], w: ['Piédroits', e2, 0] };
      for (const el of ['b', 't', 'w']) {
        const e = et.els[el]; if (!e || !e.rep) continue;
        const hh = cfg[el][1], nc = e.rep.reduce((a, q) => a + q.n, 0) * (el === 'w' ? 2 : 1), eG = r.fer.eGroup || 2 * r.fer.AS_T.esp;
        const pts = []; let x = 0; const ln = el === 'w' ? g.H : g.L;
        for (const q of e.rep) for (let i = 0; i < q.n; i++) { x += q.s; if (x > ln - 1e-6) break; if (q.s < (e.s1 || 1) - 1e-6 || e.rep.length === 1) pts.push(x); }
        const paths = pts.map(t => el === 'w' ? [[c, ya + t], [e2 - c, ya + t]] : [[xa + t, cfg[el][2] + c], [xa + t, cfg[el][2] + hh - c]]);
        add({ zone: el === 'w' ? 'piedroit' : el === 'b' ? 'radier' : 'traverse', d: d3, n: nb(W, eG), ne: nc, esp: eG, role: cfg[el][0] + ' — étriers (épingles)', segs: [{ l: Math.round((hh - 2 * c) * 1000) / 1000, a: 90 }], hooks: [135, 135], L: Math.ceil((2 * (hh - 2 * c) + 0.24) * 200) / 200,
          paths: paths.concat(el === 'w' ? paths.map(mir) : []), thin: true, tag: paths.length ? { side: el === 'b' ? 'bottom' : el === 't' ? 'top' : 'left', p: el === 'w' ? [e2 / 2, paths[Math.floor(paths.length / 2)][0][1]] : [paths[0][0][0], cfg[el][2] + hh / 2] } : null });
      }
    }
    return { list: out, geo: { o, h, e1, e2, e3, B, Ht, W, s, c, gs, gi, phi, xa, ya, biais: g.biais }, ton: D.ton };
  }

  /* ───────── dessin de la coupe ferraillée : T(x,y) → papier, clip = [x0,y0,x1,y1] (m) facultatif ───────── */
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

  function outline(G0) {
    const { B, Ht, e1, e2, e3, gs, gi } = G0;
    const outer = [[0, 0], [B, 0], [B, Ht], [0, Ht]];
    const inner = [[e2, e1 + gi[1]], [e2 + gi[0], e1], [B - e2 - gi[0], e1], [B - e2, e1 + gi[1]], [B - e2, Ht - e3 - gs[1]], [B - e2 - gs[0], Ht - e3], [e2 + gs[0], Ht - e3], [e2, Ht - e3 - gs[1]]];
    return { outer, inner };
  }

  function drawSection(S, BB, T, k, R, opt) {
    opt = opt || {}; const G0 = BB.geo, ol = outline(G0);
    const close = p => p.concat([p[0]]);
    for (const poly of [ol.outer, ol.inner]) clipPoly(close(poly), R).forEach(pc => S.poly(pc.map(p => T(p[0], p[1])), 'CONTOUR'));
    const kw = k / 1000 * 1.0;   // épaisseur des barres à l'échelle (papier)
    for (const b of BB.list) {
      for (const pth of b.paths || []) clipPoly(pth, R).forEach(pc => S.bar(pc.map(p => T(p[0], p[1])), b.d, b.thin ? { w: 0.2 } : { k: kw }));
      for (const p of b.dots || []) if (inR(p, R)) { const q = T(p[0], p[1]); S.dot(q[0], q[1], Math.max(0.32, b.d / 2000 * k), b.d); }
    }
  }

  function label(b) { return b.n + ' HA' + b.d + (b.esp ? ' e=' + f2(b.esp, 3) : ''); }

  /* ───────── planche 1 : coupes ───────── */
  function sheet1(m, r, BB, meta) {
    const P = G.OTPLAN, F = G.OTFERR, S = P.Sheet(), G0 = BB.geo, { B, Ht, e1, e2, e3, c } = G0;
    S.frame();
    // coupe transversale : zone x 14..266, y 14..283 (bulles : 30 mm en haut/bas, 34 à gauche)
    const sc = [20, 25, 50, 75, 100, 125, 150, 200].find(v => B * 1000 / v <= 250 - 44 && Ht * 1000 / v <= 269 - 64) || 200, k = 1000 / sc;
    const ox = 14 + 40 + (250 - 44 - B * k) / 2, oy = 14 + 30 + (269 - 64 - Ht * k) / 2, T = (x, y) => [ox + x * k, oy + y * k];
    const ol = outline(G0);
    drawSection(S, BB, T, k);
    // axes, cotes de coffrage discrètes
    { const a = T(B / 2, -0.35), z = T(B / 2, Ht + 0.35); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    // repères (moitié gauche + radier/traverse) : bulles en rangées
    const top = [], bot = [], left = [];
    for (const b of BB.list) { if (!b.tag || !b.tag.p) continue; const q = T(b.tag.p[0], b.tag.p[1]), it = { id: b.id + (b.sub || ''), at: q, lab: label(b), want: b.tag.side === 'left' ? q[1] : q[0] };
      (b.tag.side === 'top' ? top : b.tag.side === 'bottom' ? bot : left).push(it); }
    F.sideBubbles(S, top, 'top', T(0, Ht)[1] + 26, { edge: T(0, Ht)[1] });
    F.sideBubbles(S, bot, 'bottom', T(0, 0)[1] - 26, { edge: T(0, 0)[1] });
    F.sideBubbles(S, left, 'left', T(0, 0)[0] - 30, { edge: T(0, 0)[0] });
    // trait de coupe A-A (traverse)
    { const xA = B * 0.7, a = T(xA, Ht - e3 - 0.25), z = T(xA, Ht + 0.25); S.cut(a[0], a[1], z[0], z[1], 'A', { axis: false }); }
    S.vtitle(ox + B * k / 2, 279, 'COUPE TRANSVERSALE DU CADRE — FERRAILLAGE', 'Éch : 1/' + sc + ' — coupe droite (perpendiculaire aux piédroits)');
    S.text(T(B / 2, 0)[0], T(0, e1 + G0.h / 2)[1], 'O = ' + f2(G0.o) + ' — Hi = ' + f2(G0.h), 2.4, { ly: 'COTES' });
    S.text(T(B, 0)[0] + 3, T(0, Ht / 2)[1], 'symétrique', 2.2, { rot: 90, ly: 'COTES' });
    // détail de l'angle supérieur gauche (1/20 ou 1/25)
    const R = [-0.05, Ht - Math.max(e3 + G0.gs[1] + 0.55, 1.1), Math.max(e2 + G0.gs[0] + 0.55, 1.25), Ht + 0.05];
    const scD = [10, 20, 25, 50].find(v => (R[2] - R[0]) * 1000 / v <= 120 && (R[3] - R[1]) * 1000 / v <= 78) || 50, kD = 1000 / scD;
    const oxD = 278 - R[0] * kD + 4, oyD = 194 - R[1] * kD, TD = (x, y) => [oxD + x * kD, oyD + y * kD];
    const box = [TD(R[0], R[1]), TD(R[2], R[1]), TD(R[2], R[3]), TD(R[0], R[3])];
    drawSection(S, BB, TD, kD, R);
    S.brk(TD(0, R[1])[0], TD(0, R[1])[1], TD(e2, R[1])[0], TD(e2, R[1])[1]);
    S.brk(TD(R[2], Ht)[0], TD(R[2], Ht)[1], TD(R[2], Ht - e3)[0], TD(R[2], Ht - e3)[1]);
    // cotes du détail : enrobage, gousset
    S.dim(TD(0, Ht), TD(c, Ht), 4, 'c=' + f2(c, 3), { h: 1.8 });
    S.dim(TD(e2, Ht - e3 - G0.gs[1]), TD(e2 + G0.gs[0], Ht - e3), -4, 'gousset ' + f2(G0.gs[0]) + ' × ' + f2(G0.gs[1]), { h: 1.8 });
    S.chainV([TD(0, Ht - e3)[1], TD(0, Ht)[1]], TD(R[2], 0)[0] + 5, [f2(e3)], { right: true });
    S.chainH([TD(0, 0)[0], TD(e2, 0)[0]], TD(0, R[1])[1] - 5, [f2(e2)]);
    // repères du détail (numéros seuls) : bulle reliée à la barre, position libre la plus proche
    { const placed = [], cand = [[5, 5], [-5, 5], [5, -5], [-5, -5], [0, 7], [7, 0], [0, -7], [-7, 0], [8, 8], [-8, 8], [8, -8], [-8, -8], [11, 3], [-11, 3]];
      const xr = [TD(R[0], 0)[0] + 2, TD(R[2], 0)[0] - 2], yr = [TD(0, R[1])[1] + 2, TD(0, R[3])[1] - 2];
      BB.list.forEach(b => { if (b.rep || b.thin) return; const pc = (b.paths || []).map(pth => clipPoly(pth, R)[0]).find(Boolean); if (!pc) return;
        let best = null; for (const t of [0.5, 0.3, 0.7, 0.15, 0.85]) { const A = pc[0], Z = pc[pc.length - 1], q = TD(A[0] + (Z[0] - A[0]) * t, A[1] + (Z[1] - A[1]) * t);
          for (const [dx, dy] of cand) { const c0 = [q[0] + dx, q[1] + dy]; if (c0[0] < xr[0] || c0[0] > xr[1] || c0[1] < yr[0] || c0[1] > yr[1]) continue; if (placed.every(p => Math.hypot(p[0] - c0[0], p[1] - c0[1]) > 5)) { best = [q, c0]; break; } } if (best) break; }
        if (!best) return; placed.push(best[1]); S.repere([best[0], best[1]], b.id, '', {}); }); }
    S.vtitle(338, 279, "DÉTAIL DE L'ANGLE SUPÉRIEUR", 'Éch : 1/' + scD);
    // coupe A-A : traverse, extrémité du cadre (axe du cadre horizontal)
    const Lw = Math.min(2.2, G0.W / G0.s), scA = [20, 25, 50].find(v => Lw * 1000 / v <= 112 && e3 * 1000 / v <= 30) || 50, kA = 1000 / scA, oxA = 290, oyA = 160 - e3 * kA, TA = (z, y) => [oxA + z * kA, oyA + (y - (Ht - e3)) * kA];
    S.poly([TA(Lw, Ht), TA(0, Ht), TA(0, Ht - e3), TA(Lw, Ht - e3)], 'CONTOUR');
    S.brk(TA(Lw, Ht)[0], TA(Lw, Ht)[1], TA(Lw, Ht - e3)[0], TA(Lw, Ht - e3)[1]);
    // répartitions = lignes ; principales = points au pas de chaque famille
    const xA = B * 0.7, at = (pth, x) => { for (let i = 0; i < pth.length - 1; i++) { const a = pth[i], b = pth[i + 1]; if ((a[0] - x) * (b[0] - x) <= 1e-12 && Math.abs(b[0] - a[0]) > 1e-9) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return null; };
    const cA = c, tags = [];
    for (const b of BB.list) {
      if (b.zone !== 'traverse' || b.thin) continue;
      if (b.rep) { if (!b.dots || !b.dots.length) continue; const ys = [...new Set(b.dots.filter(p => Math.abs(p[0] - xA) < G0.o).map(p => Math.round(p[1] * 1e4) / 1e4))];
        ys.forEach((y, i) => { S.bar([TA(cA, y), TA(Lw + 0.02, y)], b.d, { k: kA / 1000 }); if (i === 0) tags.push({ b, p: TA(Lw * 0.82, y) }); }); continue; }
      const y = (b.paths || []).map(pth => at(pth, xA)).find(v => v != null); if (y == null) continue;
      const sp = b.esp || 0.2, n = Math.floor((Lw - cA) / sp) + 1; for (let i = 0; i < n; i++) { const z = cA + mmz(b.d) + i * sp; if (z > Lw) break; const q = TA(z, y); S.dot(q[0], q[1], Math.max(0.32, b.d / 2000 * kA), b.d); }
      tags.push({ b, p: TA(cA + mmz(b.d) + sp * (b.id % 3 + 1), y) });
    }
    const upT = tags.filter(t => t.p[1] > oyA + e3 * kA / 2), dnT = tags.filter(t => t.p[1] <= oyA + e3 * kA / 2);
    F.sideBubbles(S, upT.map(t => ({ id: t.b.id + (t.b.sub || ''), at: t.p, want: t.p[0], lab: '' })), 'top', oyA + e3 * kA + 12, { gap: 6, edge: oyA + e3 * kA });
    F.sideBubbles(S, dnT.map(t => ({ id: t.b.id + (t.b.sub || ''), at: t.p, want: t.p[0], lab: '' })), 'bottom', oyA - 12, { gap: 6, edge: oyA });
    S.text(TA(0, 0)[0] - 1.5, TA(0, Ht - e3 / 2)[1] - 1, 'tête', 2, { a: 'r', ly: 'COTES' });
    S.vtitle(342, 184, 'COUPE A-A — TRAVERSE (EXTRÉMITÉ)', 'Éch : 1/' + scA + ' — axe du cadre horizontal');
    // notes
    S.notes(['NOTES :', '— Aciers HA FeE' + (V(m, 'ACIER.FE1') || 500).toFixed(0) + ' ; béton fc28 = ' + (V(m, 'MAT.FCJ') || 25).toFixed(0) + ' MPa.',
      '— Enrobage : ' + f2(c, 3) + ' m (MAT.ENROB) ; cotes en mètres, longueurs à l\'axe.', '— Arrêts des barres : épures du calcul PICF (décalage 0.8 h).',
      '— Goussets : dimensions par défaut du document CHAMOA PICF.', '— Ferraillage symétrique par rapport à l\'axe du cadre.'], 284, 114);
    S.cartouche({ titre: 'PLAN DE FERRAILLAGE DU CADRE', sous: 'coupes — planche 1/2', ouvrage: m.titre, numero: m.num || m.numero, echelles: '1/' + sc + ', 1/' + scD + ', 1/' + scA, planNo: 'FER-01' });
    return { S, sc };
  }
  const mmz = d => d / 2000;

  /* ───────── planche 2 : nomenclature et récapitulatif ───────── */
  function sheet2(m, r, BB, meta) {
    const P = G.OTPLAN, F = G.OTFERR, S = P.Sheet();
    S.frame();
    const rows = BB.list.map(b => ({ id: b.id + (b.sub || ''), d: b.d, n: b.n, ne: b.ne, esp: b.esp, segs: b.segs, hooks: b.hooks, L: b.L, role: b.role }));
    const half = rows.length > 22 ? Math.ceil(rows.length / 2) : rows.length, rh = Math.min(10, Math.max(7.2, 250 / (half + 3)));
    const t1 = F.nomenclature(S, 14, 276, rows.slice(0, half), { rh, wF: 54 });
    let yR = t1.y - 6, xR = 14;
    if (half < rows.length) { const t2 = F.nomenclature(S, 14 + t1.W + 6, 276, rows.slice(half), { rh, wF: 54, title: 'NOMENCLATURE GÉNÉRALE DES ACIERS (suite)' }); }
    // désignation des repères
    const xD = half < rows.length ? 282 : 14 + t1.W + 8, yD = half < rows.length ? 276 : 276;
    if (half === rows.length) {
      S.text(xD, yD + 2, 'DÉSIGNATION DES REPÈRES', 3, { a: 'l', bold: 1 });
      rows.forEach((rw, i) => { S.text(xD, yD - 4 - i * 4.1, rw.id, 2.1, { a: 'l', bold: 1, col: P.WEB_D[rw.d] }); S.text(xD + 7, yD - 4 - i * 4.1, rw.role, 2, { a: 'l' }); });
    }
    const vol = (BB.geo.B * BB.geo.Ht - (BB.geo.o * BB.geo.h - (BB.geo.gs[0] * BB.geo.gs[1] + BB.geo.gi[0] * BB.geo.gi[1]))) * BB.geo.W / BB.geo.s;
    const rc = F.recap(S, half < rows.length ? 14 : xD, half < rows.length ? Math.min(yR, 60) : 120, rows, { vol });
    // contrôle : tonnage de l'avant-métré de la note
    const tn = (BB.ton || []).reduce((a, v) => a + v, 0);
    if (tn > 0) S.text(half < rows.length ? 14 : xD, rc.y - 10, 'Avant-métré de la note PICF : ' + (tn / 1000).toFixed(2) + ' t — nomenclature : ' + (rc.tot / 1000).toFixed(2) + ' t (écart ' + ((rc.tot / tn - 1) * 100).toFixed(1) + ' %)', 2.1, { a: 'l' });
    S.cartouche({ titre: 'PLAN DE FERRAILLAGE DU CADRE', sous: 'nomenclature — planche 2/2', ouvrage: m.titre, numero: m.num || m.numero, echelles: '—', planNo: 'FER-02' });
    return { S, tot: rc.tot };
  }

  function build(m, r) {
    const BB = bars(m, r), s1 = sheet1(m, r, BB), s2 = sheet2(m, r, BB);
    return { sheets: [{ S: s1.S, label: 'Planche 1/2 · coupes', sub: 'A3 · coupe 1/' + s1.sc + ' · détail d\'angle · coupe A-A' }, { S: s2.S, label: 'Planche 2/2 · nomenclature', sub: 'A3 · nomenclature ADFER · récapitulatif · ' + (s2.tot / 1000).toFixed(2) + ' t' }], bars: BB };
  }
  G.PICF_FERR = { bars, build };
})(typeof window !== 'undefined' ? window : globalThis);
