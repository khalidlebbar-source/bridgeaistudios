/* PSIDP-EL — plans de ferraillage passif du tablier-dalle précontraint, façon ADFER (BridgeAI / KLE Ingénierie)
   Proposition de ferraillage à partir des sections du calcul : transversal par zones (r.ferPassif.travees : section minimale et
   espacements maximaux par Ø — on retient le plus petit Ø dont l'espacement maximal atteint 0.10 m, espacement arrondi au 2.5 cm
   inférieur) ; longitudinal = filants (minimum r.ferPassif.longi, pour toute la largeur) + renforts là où la section ELU
   (r.elu.spans : asS / asI) dépasse les filants, prolongés de l'ancrage 40 Ø. Gaines des câbles (r.prec) dessinées en coupe. */
(function (G) {
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d)).toFixed(d == null ? 2 : d);
  const aire = d => Math.PI * d * d / 4e6, PHT = [10, 12, 14, 16, 20], LMAX = 12;

  function bars(m, r) {
    const g = G.PSIDP_PLANS.geometry(m, r), s = g.sec, n = g.n, xs = g.xs, L = r.L, FP = r.ferPassif || { travees: [], longi: { sup: 0, inf: 0 } };
    const c = 0.03, Wsup = s.W - 2 * c, Winf = 2 * s.half[0][0] - 2 * c, Lt = g.Lt;
    const rows = [], occ = [], zones = [];
    const add = b => { b.id = String(rows.length + 1); rows.push(b); return b; };
    // ── longitudinaux filants
    const fil = {};
    for (const [face, A, W] of [['sup', FP.longi.sup, Wsup], ['inf', FP.longi.inf, Winf]]) {
      let d = [12, 14, 16, 20, 25].find(dd => { const nb = Math.ceil(A / aire(dd)); return nb < 2 || W / (nb - 1) >= 0.10; }) || 25, nb = Math.max(2, Math.ceil(A / aire(d)));
      while (W / (nb - 1) > 0.25) nb++;
      const lap = 40 * d / 1000, Lc = Lt - 2 * c, np = Lc <= LMAX ? 1 : Math.ceil((Lc - lap) / (LMAX - lap)), lp = Math.ceil(((Lc + (np - 1) * lap) / np) * 20) / 20;
      const b = add({ kind: 'fil', sens: face, d, n: nb * np, ne: 1, esp: W / (nb - 1), segs: [{ l: lp, a: 0 }], L: lp, role: 'Longitudinal ' + (face === 'sup' ? 'supérieur' : 'inférieur') + ' filant (' + np + ' barre' + (np > 1 ? 's' : '') + ' par file, recouvrement 40 Ø)' });
      fil[face] = { b, nb, A: nb * aire(d), d };
      for (let i = 0; i < np; i++) { const x0 = c + i * (lp - lap); occ.push({ b, x0, x1: Math.min(Lt - c, x0 + lp), nb, sens: face }); }
    }
    // ── renforts longitudinaux (sections ELU > filants)
    const sp = r.elu && r.elu.spans;
    if (sp) for (const face of ['sup', 'inf']) {
      const key = face === 'sup' ? 'asS' : 'asI', A0 = fil[face].A, iv = [];
      sp.forEach((rowsT, t) => { const xm = Math.max(...rowsT.map(q => q.X)) || L[t], kx = L[t] / xm; rowsT.forEach(q => { const ex = (q[key] || 0) - A0; if (ex > 1e-6) iv.push({ x: xs[t] + q.X * kx, ex }); }); });
      iv.sort((a, b) => a.x - b.x);
      const grp = []; for (const p of iv) { const gq = grp[grp.length - 1]; if (gq && p.x - gq.x1 < 2.5) { gq.x1 = p.x; gq.ex = Math.max(gq.ex, p.ex); } else grp.push({ x0: p.x, x1: p.x, ex: p.ex }); }
      for (const gq of grp) {
        const d = fil[face].d >= 16 ? fil[face].d : 16, nb = Math.max(2, Math.ceil(gq.ex / aire(d))), ls = 40 * d / 1000;
        const x1 = Math.min(Lt - c, gq.x1 + ls + 1.0), x0 = Math.max(c, Math.min(gq.x0 - ls - 1.0, x1 - 1.0)), Lr = Math.ceil((x1 - x0) * 20) / 20;
        const b = rows.find(q => q.kind === 'ren' && q.sens === face && q.d === d && Math.abs(q.L - Lr) < 0.01) || add({ kind: 'ren', sens: face, d, n: 0, ne: 1, esp: null, segs: [{ l: Lr, a: 0 }], L: Lr, role: 'Renfort longitudinal ' + (face === 'sup' ? 'supérieur (sur appui)' : 'inférieur (en travée)') });
        b.n += nb; occ.push({ b, x0, x1: Math.min(Lt - c, x0 + Lr), nb, sens: face });
      }
    }
    // ── transversaux par zones
    const pick = z => { for (let k = 0; k < PHT.length; k++) { const e = z.s[k]; if (e != null && e >= 0.10 - 1e-9) return { d: PHT[k], esp: Math.min(0.25, Math.floor(e * 40 + 1e-6) / 40) }; } return { d: 20, esp: 0.10 }; };
    let x = 0;
    FP.travees.forEach((zs, t) => zs.forEach(z => {
      const a = z.nom === 'ABOUT' ? 0 : x, b = a + z.lg; if (z.nom === 'ABOUT') x = z.lg; else x = b;
      const zz = { nom: z.nom, t, a, b }; zones.push(zz);
      for (const [face, W] of [['sup', s.W - 2 * c], ['inf', Winf]]) {
        const p = pick(z[face]), nb = Math.ceil(z.lg / p.esp - 1e-6), Lb = Math.round(W / Math.sin(g.phi) * 100) / 100;
        const bb = rows.find(q => q.kind === 'tr' && q.sens === face && q.d === p.d && Math.abs(q.L - Lb) < 0.01) || add({ kind: 'tr', sens: face, d: p.d, n: 0, ne: 1, esp: null, segs: [{ l: Lb, a: 0 }], L: Lb, role: 'Transversal ' + (face === 'sup' ? 'supérieur' : 'inférieur') + (g.bg < 99.9 ? ' (parallèle aux lignes d\'appui)' : '') });
        bb.n += nb; zz[face] = { b: bb, nb, esp: p.esp };
      }
    }));
    // dernière zone : about droit (symétrique du premier)
    if (zones.length && zones[0].nom === 'ABOUT') { const z0 = zones[0], last = zones[zones.length - 1]; const zz = { nom: 'ABOUT', a: last.b, b: last.b + (z0.b - z0.a), sup: { b: z0.sup.b, nb: z0.sup.nb, esp: z0.sup.esp }, inf: { b: z0.inf.b, nb: z0.inf.nb, esp: z0.inf.esp } }; z0.sup.b.n += z0.sup.nb; z0.inf.b.n += z0.inf.nb; zones.push(zz); }
    rows.sort((p, q) => ['fil', 'ren', 'tr'].indexOf(p.kind) - ['fil', 'ren', 'tr'].indexOf(q.kind) || (p.sens === q.sens ? 0 : p.sens === 'sup' ? -1 : 1) || q.d - p.d);
    rows.forEach((b, i) => { b.id = String(i + 1); });
    const X = xs.map(v => v);
    return { g, list: rows, occ, zones, X, n, ab: g.ab, c, Lt, vol: (r.section.S || 0) * Lt };
  }

  function sheet1(m, r, BB) {
    const P = G.OTPLAN, S = P.Sheet(), { X, n, Lt } = BB; S.frame();
    const span = Lt + 0.6, scL = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000].find(v => span * 1000 / v <= 360) || 1000, K = 1000 / scL;
    const ox = 30 + (360 - span * K) / 2 + 0.3 * K, PX = x => ox + x * K;
    const pack = list => { const ends = []; list.sort((a, b) => a.x0 - b.x0).forEach(o => { const l = PX(o.x0) - 1, w = Math.max(PX(o.x1), PX(o.x0) + 34) + 2; let k = ends.findIndex(e => e <= l); if (k < 0) { ends.push(0); k = ends.length - 1; } ends[k] = w; o.row = k; }); return ends.length; };
    const sup = BB.occ.filter(o => o.sens === 'sup'), inf = BB.occ.filter(o => o.sens === 'inf'), nS = pack(sup), nI = pack(inf), RH = 5.2, band = 5;
    const ySlab = 262 - nS * RH - 4, yS0 = ySlab + band + 4, yI0 = ySlab - 4;
    const deck = [[PX(0), ySlab], [PX(Lt), ySlab], [PX(Lt), ySlab + band], [PX(0), ySlab + band]]; S.fill(deck, 'BETON'); S.poly(deck, 'CONTOUR', true);
    for (let k = 0; k <= n; k++) { const x = PX(X[k]); S.line(x, ySlab - nI * RH - 8, x, ySlab + band + nS * RH + 6, 'AXE'); S.P.push({ t: 'F', p: [[x, ySlab], [x - 1.6, ySlab - 2.6], [x + 1.6, ySlab - 2.6]], ly: 'CONTOUR', solid: 1, col: '#111' }); S.text(x, ySlab + band + nS * RH + 7.5, BB.g.nom(k), 2.2, { bold: 1 }); }
    for (let i = 0; i < n; i++) S.text(PX((X[i] + X[i + 1]) / 2), ySlab + 1.4, 'TRAVÉE ' + (i + 1) + ' — ' + f2(r.L[i]) + ' m', 2, {});
    const drawRow = (o, y) => { const a = PX(o.x0), b = PX(o.x1); S.bar([[a, y], [b, y]], o.b.d, { w: 0.5 }); S.line(a, y - 0.8, a, y + 0.8, 'ACIERS'); S.line(b, y - 0.8, b, y + 0.8, 'ACIERS');
      S.bubble(a + 2.4, y + 2.2, o.b.id, { r: 1.7, h: 1.6, fill: 1 }); S.text(a + 5, y + 0.7, o.nb + ' HA' + o.b.d + ' L=' + f2(o.b.L), 1.7, { a: 'l', col: P.WEB_D[o.b.d] }); };
    sup.forEach(o => drawRow(o, yS0 + o.row * RH)); inf.forEach(o => drawRow(o, yI0 - o.row * RH - 1.5));
    S.text(22, yS0 + nS * RH / 2, 'NAPPE SUP.', 2.4, { rot: 90, bold: 1, col: '#c0392b' }); S.text(22, yI0 - nI * RH / 2, 'NAPPE INF.', 2.4, { rot: 90, bold: 1, col: '#1a4fd6' });
    const yAx = yI0 - nI * RH - 9; S.chainH(X.map(PX), yAx, r.L.map(v => f2(v)), { h: 1.9 });
    S.vtitle(210, 281, 'FERRAILLAGE LONGITUDINAL PASSIF', 'Éch. des longueurs : 1/' + scL + ' — filants pour toute la largeur + renforts (section ELU du calcul)');
    // transversaux
    const hB = 9, yT = yAx - 38;
    S.poly([[PX(0), yT], [PX(Lt), yT], [PX(Lt), yT + hB], [PX(0), yT + hB]], 'CONTOUR', true);
    for (let k = 0; k <= n; k++) S.line(PX(X[k]), yT - 3, PX(X[k]), yT + hB + 3, 'AXE');
    BB.zones.forEach(zz => { const a = PX(zz.a), b = PX(zz.b), w = b - a; S.line(a, yT, a, yT + hB, 'COTES'); S.line(b, yT, b, yT + hB, 'COTES');
      const nl = Math.min(zz.sup.nb, Math.max(1, Math.floor(w / 0.9))); for (let j = 0; j < nl; j++) { const x = a + w * (j + 0.5) / nl; S.line(x, yT + 0.6, x, yT + hB - 0.6, 'FIN'); }
      const t1 = zz.sup.nb + ' HA' + zz.sup.b.d + ' e=' + f2(zz.sup.esp, 3), t2 = zz.inf.nb + ' HA' + zz.inf.b.d + ' e=' + f2(zz.inf.esp, 3), mid = (a + b) / 2;
      if (w > 34) { S.text(mid, yT + hB + 2.2, t1, 1.7, { col: '#c0392b' }); S.text(mid, yT - 3.4, t2, 1.7, { col: '#1a4fd6' }); }
      else { S.text(mid + 0.6, yT + hB + 2, zz.sup.nb + ' HA' + zz.sup.b.d, 1.6, { rot: 90, a: 'l', col: '#c0392b' }); S.text(mid + 0.6, yT - 2, zz.inf.nb + ' HA' + zz.inf.b.d, 1.6, { rot: 90, a: 'r', col: '#1a4fd6' }); } });
    S.vtitle(210, yAx - 8, 'RÉPARTITION DES ACIERS TRANSVERSAUX', 'zones du calcul (about, chevêtre, extension de chevêtre, travée) — rouge : face sup. ; bleu : face inf.');
    S.notes(['NOTES :', '— Proposition établie à partir des sections minimales de la note (sections 30 et 35).', '— Transversaux : plus petit Ø dont l\'espacement maximal ≥ 0.10 m, arrondi au 2.5 cm.',
      '— Renforts : sur la longueur où la section ELU dépasse les filants, + 40 Ø + 1.00 m.', '— Câblage : voir plan CAB-01 ; enrobage 0.030 m.'], 20, 62);
    S.cartouche({ titre: 'PLAN DE FERRAILLAGE PASSIF DU TABLIER', sous: 'épures — planche 1', ouvrage: (m.titres || []).filter(Boolean), numero: m.numero, echelles: 'longueurs 1/' + scL, planNo: 'FER-01' });
    return { S, scL };
  }

  function sheet2(m, r, BB) {
    const P = G.OTPLAN, F = G.OTFERR, S = P.Sheet(); S.frame();
    const g = BB.g, s = g.sec, half = s.half, W = s.W, H = s.yE, c = BB.c, PC = r.prec, VP = (r.section.calc || r.section).VP, N = PC ? Math.round(PC.N) || 0 : 0, dg = 0.07;
    const poly = [[W / 2 - half[0][0], 0]].concat(half.map(p => [W / 2 + p[0], p[1]])).concat(half.slice().reverse().map(p => [W / 2 - p[0], p[1]]));
    const sc = [20, 25, 50, 75, 100].find(v => W * 1000 / v <= 236 && H * 1000 / v <= 50) || 100, k = 1000 / sc;
    const section = (oy, xG, titre) => {
      const ox = 30 + (236 - W * k) / 2, T = (x, y) => [ox + x * k, oy + y * k]; S.poly(poly.map(p => T(p[0], p[1])), 'CONTOUR', true);
      const zz = BB.zones.find(q => q.a <= xG + 1e-6 && q.b >= xG - 1e-6) || BB.zones[0];
      const xi0 = W / 2 - half[0][0] + c, xi1 = W / 2 + half[0][0] - c, yTs = H - c - zz.sup.b.d / 2000, yTi = c + zz.inf.b.d / 2000, tags = [];
      S.bar([T(c, yTs - 0.06), T(c, yTs), T(W - c, yTs), T(W - c, yTs - 0.06)], zz.sup.b.d, { k: k / 1000 }); S.bar([T(xi0, yTi), T(xi1, yTi)], zz.inf.b.d, { k: k / 1000 });
      tags.push({ side: 'top', p: T(W * 0.86, yTs), id: zz.sup.b.id, lab: 'HA' + zz.sup.b.d + ' e=' + f2(zz.sup.esp, 3) });
      tags.push({ side: 'bottom', p: T(xi1 - 0.3, yTi), id: zz.inf.b.id, lab: 'HA' + zz.inf.b.d + ' e=' + f2(zz.inf.esp, 3) });
      for (const sens of ['sup', 'inf']) {
        const act = BB.occ.filter(o => o.sens === sens && o.x0 <= xG && o.x1 >= xG); const per = new Map(); act.forEach(o => { const q = per.get(o.b.id) || { b: o.b, nb: 0 }; q.nb = Math.max(q.nb, 0) + (o.b.kind === 'fil' ? 0 : o.nb); if (o.b.kind === 'fil') q.nb = Math.max(q.nb, o.nb); per.set(o.b.id, q); });
        const L = [...per.values()], y = sens === 'sup' ? yTs - zz.sup.b.d / 2000 - 0.012 : yTi + zz.inf.b.d / 2000 + 0.012, xa = sens === 'sup' ? c + 0.03 : xi0 + 0.03, xb = sens === 'sup' ? W - c - 0.03 : xi1 - 0.03;
        const seq = []; L.forEach(q => { for (let j = 0; j < q.nb; j++) seq.push(q.b.d); }); seq.sort((a, b) => b - a);
        const mix = []; const big = seq.filter(d => d === seq[0]), rest = seq.filter(d => d !== seq[0]); let acc = 0; const ra = rest.length / Math.max(1, big.length); big.forEach(d => { mix.push(d); acc += ra; while (acc >= 1 && rest.length) { mix.push(rest.shift()); acc -= 1; } }); mix.push(...rest);
        mix.forEach((d, j) => { const xx = xa + (xb - xa) * (mix.length === 1 ? 0.5 : j / (mix.length - 1)), q = T(xx, y); S.dot(q[0], q[1], Math.max(0.3, d / 2000 * k), d); });
        L.forEach((q, j) => tags.push({ side: sens === 'sup' ? 'top' : 'bottom', p: T(sens === 'sup' ? 0.5 + W * 0.6 * (j + 0.5) / L.length : xi0 + (xi1 - xi0) * 0.6 * (j + 0.5) / L.length, y), id: q.b.id, lab: q.nb + ' HA' + q.b.d }));
      }
      // gaines des câbles
      if (N && PC.cable) { let t = 0; while (t < g.n - 1 && xG > g.xs[t + 1]) t++; const xl = Math.max(0, Math.min(r.L[t], xG - g.xs[t])), z = VP + PC.cable.z(t, xl), e = (2 * half[0][0] - 0.4) / Math.max(1, N - 1);
        for (let j = 0; j < N; j++) { const q = T(W / 2 - half[0][0] + 0.2 + j * (N > 1 ? e : 0) + (N === 1 ? half[0][0] - 0.2 : 0), z); S.circle(q[0], q[1], dg / 2 * k, 'CABLES'); }
        S.text(T(W, 0)[0] + 3, T(0, z)[1] - 0.8, N + ' câbles — axe à ' + f2(z) + ' m', 1.9, { a: 'l', ly: 'CABLES' }); }
      const top0 = T(0, H)[1], bot0 = T(0, 0)[1];
      F.sideBubbles(S, tags.filter(q => q.side === 'top').map(q => ({ id: q.id, at: q.p, lab: q.lab, want: q.p[0] })), 'top', top0 + 16, { edge: top0 });
      F.sideBubbles(S, tags.filter(q => q.side === 'bottom').map(q => ({ id: q.id, at: q.p, lab: q.lab, want: q.p[0] })), 'bottom', bot0 - 16, { edge: bot0 });
      S.chainH([T(0, 0)[0], T(W / 2 - half[0][0], 0)[0], T(W / 2 + half[0][0], 0)[0], T(W, 0)[0]], bot0 - 24, [f2(W / 2 - half[0][0]), f2(2 * half[0][0]), f2(W / 2 - half[0][0])], { h: 1.8 });
      S.vtitle(ox + W * k / 2, oy + H * k + 30, titre, 'Éch : 1/' + sc + ' — x = ' + f2(xG) + ' m depuis l\'extrémité du tablier');
    };
    let im = 0; r.L.forEach((L, i) => { if (L > r.L[im]) im = i; });
    const xT = (g.xs[im] + g.xs[im + 1]) / 2, kA = g.n > 1 ? Math.min(im + 1, g.n - 1) : 0, xA = g.xs[kA] + (g.n > 1 ? 0 : 0.3);
    section(206, xT, 'COUPE A-A — EN TRAVÉE ' + (im + 1));
    section(116, xA, 'COUPE B-B — SUR ' + g.nom(kA));
    S.notes(['NOTES :', '— Barres longitudinales actives à l\'abscisse de la coupe.', '— Gaines Ø 0.07 schématiques (nombre et hauteur du câble moyen).', '— Position des barres schématique dans la largeur.'], 284, 160);
    S.cartouche({ titre: 'PLAN DE FERRAILLAGE PASSIF DU TABLIER', sous: 'coupes transversales — planche 2', ouvrage: (m.titres || []).filter(Boolean), numero: m.numero, echelles: '1/' + sc, planNo: 'FER-02' });
    return { S, sc };
  }

  function build(m, r) {
    const BB = bars(m, r), s1 = sheet1(m, r, BB), s2 = sheet2(m, r, BB);
    const s3 = G.OTFERR.nomenSheet(m, BB.list, { vol: BB.vol, cart: { titre: 'PLAN DE FERRAILLAGE PASSIF DU TABLIER', sous: 'nomenclature', ouvrage: (m.titres || []).filter(Boolean), numero: m.numero, planNo: 'FER-03' } });
    return { sheets: [{ S: s1.S, label: 'Épures', sub: 'A3 · longitudinal 1/' + s1.scL + ' · transversaux par zones' }, { S: s2.S, label: 'Coupes', sub: 'A3 · coupes 1/' + s2.sc + ' avec gaines' }].concat(s3.sheets.map((S, i) => ({ S, label: 'Nomenclature' + (s3.sheets.length > 1 ? ' ' + (i + 1) : ''), sub: 'A3 · nomenclature ADFER · ' + (s3.tot / 1000).toFixed(2) + ' t' }))), bars: BB };
  }
  G.PSIDP_FERR = { bars, build };
})(typeof window !== 'undefined' ? window : globalThis);
