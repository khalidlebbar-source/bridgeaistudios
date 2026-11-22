/* PSIDA-EL — plans de ferraillage du tablier-dalle, façon ADFER (BridgeAI / KLE Ingénierie)
   Barres du calcul : r.fer.long.epure (lits longitudinaux : nombre, Ø, abscisses d'origine et d'extrémité, longueurs),
   r.fer.propose (aciers transversaux par zones : chevêtres 1G/1D, zones 2G/2D, travées ; Ø, espacement, nombre, longueurs Ls / Li / TB).
   Planche 1 : épure d'arrêt des barres longitudinales et répartition des aciers transversaux. Planche 2 : coupes transversales
   en travée et sur appui. Planche 3 : nomenclature, récapitulatif, contrôle avec l'avant-métré de la note (hors étriers). */
(function (G) {
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d == null ? 2 : d)) / Math.pow(10, d == null ? 2 : d)).toFixed(d == null ? 2 : d);
  const mmOf = p => Math.round(p * 1000);

  function bars(m, r) {
    const n = r.n, X = r.LI.xs, ab = r.about || 0, E = r.fer.long.epure, Q = r.fer.propose, ph = r.mat.phi.map(mmOf);
    const A11 = r._A11 || {}, cS = A11.ENROBS || 0.03, cI = A11.ENROBI || 0.03;
    const rows = [], byKey = new Map(), occ = [];
    const rep = (key, mk) => { if (!byKey.has(key)) { const b = mk(); b.id = String(rows.length + 1); rows.push(b); byKey.set(key, b); } return byKey.get(key); };
    // ── longitudinaux : un repère par (nappe, Ø, longueur)
    for (const sens of ['sup', 'inf']) for (const ent of E[sens] || []) for (const gr of ent.groupes) {
      const mT = /TRAVEE\s+(\d+)/.exec(gr.lab), mA = /APPUI\s+(\d+)/.exec(gr.lab);
      for (const f of gr.fers) {
        let x0, x1; if (mA) { const k = +mA[1]; x0 = X[k - 2] + f.o; x1 = X[k - 1] + f.x; } else if (mT) { const i = +mT[1] - 1; x0 = X[i] + f.o; x1 = X[i] + f.x; } else continue;
        const d = mmOf(f.phi), L = Math.round(f.len * 100) / 100;
        const b = rep(sens + d + '_' + L.toFixed(2), () => ({ kind: 'long', sens, d, n: 0, ne: 1, esp: null, segs: [{ l: L, a: 0 }], L, role: 'Longitudinal ' + (sens === 'sup' ? 'supérieur' : 'inférieur') + ' — ' + gr.lab.replace(/\s+/g, ' ').toLowerCase() + ' (lit ' + f.nom + ')' }));
        b.n += f.nb; occ.push({ b, x0, x1, nb: f.nb, sens, star: [f.oStar, f.xStar], lab: f.nom + ' ' + f.j });
      }
    }
    // ── transversaux : zones (chevêtres, zones 2, travées) — Ls pour la nappe sup., Li (ou TB) pour la nappe inf.
    const zones = [];
    if (Q) {
      const put = (z, a, bnd) => { if (!z || !z.nb) return; zones.push({ z, a: Math.min(a, bnd), b: Math.max(a, bnd) }); };
      Q.appuis.forEach((A, k) => { const xk = X[k], Z = {}; A.zones.forEach(z => { Z[z.no] = z; });
        if (Z['1G']) { put(Z['1G'], xk - Z['1G'].plage, xk); if (Z['2G']) put(Z['2G'], xk - Z['1G'].plage - Z['2G'].plage, xk - Z['1G'].plage); }
        if (Z['1D']) { put(Z['1D'], xk, xk + Z['1D'].plage); if (Z['2D']) put(Z['2D'], xk + Z['1D'].plage, xk + Z['1D'].plage + Z['2D'].plage); } });
      Q.travees.forEach((T, i) => { const zs = zones.filter(q => q.a >= X[i] - 1e-6 && q.b <= X[i + 1] + 1e-6); const a = Math.max(X[i], ...zs.filter(q => q.a < (X[i] + X[i + 1]) / 2).map(q => q.b)), bnd = Math.min(X[i + 1], ...zs.filter(q => q.b > (X[i] + X[i + 1]) / 2).map(q => q.a)); put(T.zone, a, bnd); });
      for (const zz of zones) { const z = zz.z;
        for (const [face, o, L, tb] of [['sup', z.sup, Q.Ls, false], ['inf', z.inf, z.tbI ? Q.LiTB : Q.Li, !!z.tbI]]) { if (!o) continue;
          for (const k of o) { const d = ph[k], Lr = Math.round(L * 100) / 100;
            const b = rep('tr' + face + d + '_' + Lr.toFixed(2), () => ({ kind: 'tr', sens: face, d, n: 0, ne: 1, esp: null, segs: [{ l: Lr, a: 0 }], L: Lr, role: 'Transversal ' + (face === 'sup' ? 'supérieur' : 'inférieur') + (tb ? ' — tête-bêche' : '') + ' (L = ' + (face === 'sup' ? 'largeur' : 'nervure') + ')' }));
            const nk = Math.round(z.nb / o.length); b.n += nk; (zz[face] = zz[face] || []).push({ b, nb: nk }); } } }
    }
    rows.sort((p, q) => (p.kind === q.kind ? 0 : p.kind === 'long' ? -1 : 1) || (p.sens === q.sens ? 0 : p.sens === 'sup' ? -1 : 1) || q.d - p.d || q.L - p.L);
    rows.forEach((b, i) => { b.id = String(i + 1); });
    const ton = r.fer.metre ? (r.fer.metre.lon.reduce((a, v) => a + v, 0) + r.fer.metre.tra.reduce((a, v) => a + v, 0)) * 1000 : 0;
    return { list: rows, occ, zones, X, n, ab, cS, cI, ton, Q, etr: r.fer.metre ? r.fer.metre.etr : 0, beton: r.fer.metre ? r.fer.metre.beton : 0 };
  }

  /* ───────── planche 1 : épure longitudinale + transversaux ───────── */
  function sheet1(m, r, BB) {
    const P = G.OTPLAN, S = P.Sheet(), { X, n, ab } = BB;
    S.frame();
    const xmin = -ab - 0.3, xmax = X[n] + ab + 0.3, span = xmax - xmin;
    const scL = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000].find(v => span * 1000 / v <= 360) || 1000, K = 1000 / scL;
    const ox = 30 + (360 - span * K) / 2 - xmin * K, PX = x => ox + x * K;
    // rangées sans chevauchement (par nappe)
    const pack = list => { const rowsEnd = []; list.sort((a, b) => a.x0 - b.x0).forEach(o => { const l = PX(o.x0) - 1, w = Math.max(PX(o.x1), PX(o.x0) + 34) + 2; let k = rowsEnd.findIndex(e => e <= l); if (k < 0) { rowsEnd.push(0); k = rowsEnd.length - 1; } rowsEnd[k] = w; o.row = k; }); return rowsEnd.length; };
    const sup = BB.occ.filter(o => o.sens === 'sup'), inf = BB.occ.filter(o => o.sens === 'inf'), nS = pack(sup), nI = pack(inf);
    const RH = Math.min(5.6, Math.max(3.2, 94 / (nS + nI + 1))), band = 5;
    const ySlab = 270 - 8 - nS * RH - 4, yS0 = ySlab + band + 4, yI0 = ySlab - 4;
    // tablier, appuis
    S.poly([[PX(-ab), ySlab], [PX(X[n] + ab), ySlab], [PX(X[n] + ab), ySlab + band], [PX(-ab), ySlab + band]], 'CONTOUR', true);
    S.fill([[PX(-ab), ySlab], [PX(X[n] + ab), ySlab], [PX(X[n] + ab), ySlab + band], [PX(-ab), ySlab + band]], 'BETON');
    for (let k = 0; k <= n; k++) { const x = PX(X[k]); S.line(x, ySlab - nI * RH - 10, x, ySlab + band + nS * RH + 8, 'AXE'); S.P.push({ t: 'F', p: [[x, ySlab], [x - 1.6, ySlab - 2.6], [x + 1.6, ySlab - 2.6]], ly: 'CONTOUR', solid: 1, col: '#111' }); S.text(x, ySlab + band + nS * RH + 9.5, 'APPUI ' + (k + 1), 2.2, { bold: 1 }); }
    for (let i = 0; i < n; i++) S.text(PX((X[i] + X[i + 1]) / 2), ySlab + 1.4, 'TRAVÉE ' + (i + 1) + ' — ' + f2(r.L[i]) + ' m', 2, {});
    const drawRow = (o, y, col) => { const a = PX(o.x0), b = PX(o.x1); S.bar([[a, y], [b, y]], o.b.d, { w: 0.5 });
      for (const [x, st] of [[a, o.star[0]], [b, o.star[1]]]) S.line(x, y - (st ? 1.3 : 0.8), x, y + (st ? 1.3 : 0.8), 'ACIERS');
      S.bubble(a + 2.4, y + 2.2, o.b.id, { r: 1.7, h: 1.6, fill: 1 }); S.text(a + 5, y + 0.7, o.nb + ' HA' + o.b.d + ' L=' + f2(o.b.L), 1.7, { a: 'l', col: P.WEB_D[o.b.d] }); };
    sup.forEach(o => drawRow(o, yS0 + o.row * RH));
    inf.forEach(o => drawRow(o, yI0 - o.row * RH - 1.5));
    S.text(22, yS0 + nS * RH / 2, 'NAPPE SUPÉRIEURE', 2.4, { rot: 90, bold: 1, col: '#c0392b' });
    S.text(22, yI0 - nI * RH / 2, 'NAPPE INFÉRIEURE', 2.4, { rot: 90, bold: 1, col: '#1a4fd6' });
    const yAx = yI0 - nI * RH - 9; S.chainH(X.map(PX), yAx, r.L.map(v => f2(v)), { h: 1.9 });
    S.vtitle(210, 281, "ÉPURE D'ARRÊT DES BARRES LONGITUDINALES", 'Éch. des longueurs : 1/' + scL + ' — épaisseur et écartement des lits non à l\'échelle ; trait d\'extrémité épais : barre ancrée hors de la travée');
    // répartition des aciers transversaux (bande en plan, même échelle des longueurs)
    const hB = 9, yT = yAx - 38;
    S.poly([[PX(-ab), yT], [PX(X[n] + ab), yT], [PX(X[n] + ab), yT + hB], [PX(-ab), yT + hB]], 'CONTOUR', true);
    for (let k = 0; k <= n; k++) S.line(PX(X[k]), yT - 3, PX(X[k]), yT + hB + 3, 'AXE');
    BB.zones.forEach((zz, i) => {
      const a = PX(zz.a), b = PX(zz.b), z = zz.z; S.line(a, yT, a, yT + hB, 'COTES'); S.line(b, yT, b, yT + hB, 'COTES');
      const nl = Math.min(z.nb, Math.max(1, Math.floor((b - a) / 0.9))); for (let j = 0; j < nl; j++) { const x = a + (b - a) * (j + 0.5) / nl; S.line(x, yT + 0.6, x, yT + hB - 0.6, 'FIN'); }
      const lab = (arr) => (arr || []).map(q => q.nb + ' HA' + q.b.d).join(' + ');
      const up = i % 2 === 0, mid = (a + b) / 2, w = b - a;
      const t1 = (w > 30 ? (z.no.startsWith('T') ? 'T' : z.no) + ' : ' : '') + lab(zz.sup).replace(/ \+ /g, '+') + (w > 30 ? ' e=' + f2(z.s, 3) : ''), t2 = lab(zz.inf) + (z.tbI ? ' TB' : '') + (w > 30 ? ' e=' + f2(z.s, 3) : '');
      if (w > 30) { S.text(mid, yT + hB + 2.2, t1, 1.7, { col: '#c0392b' }); S.text(mid, yT - 3.4, t2, 1.7, { col: '#1a4fd6' }); }
      else { S.text(mid + 0.6, yT + hB + 2 + (up ? 0 : 0), t1, 1.6, { rot: 90, a: 'l', col: '#c0392b' }); S.text(mid + 0.6, yT - 2, t2, 1.6, { rot: 90, a: 'r', col: '#1a4fd6' }); }
    });
    S.vtitle(210, yAx - 8, 'RÉPARTITION DES ACIERS TRANSVERSAUX', 'vue en plan schématique — rouge : nappe supérieure (L = ' + f2(BB.Q ? BB.Q.Ls : 0) + ') ; bleu : nappe inférieure (L = ' + f2(BB.Q ? BB.Q.Li : 0) + (BB.Q && BB.Q.LiTB ? ', TB ' + f2(BB.Q.LiTB) : '') + ')');
    S.notes(['NOTES :', '— Lits longitudinaux, arrêts et longueurs : épure du calcul PSIDA (tableaux « fers »).', '— Zones transversales : chevêtres 1G / 1D, zones 2G / 2D, travées T (calcul).',
      '— Enrobages : ' + f2(BB.cS, 3) + ' (sup.) / ' + f2(BB.cI, 3) + ' (inf.) ; cotes en mètres.', '— Étriers : voir la note de calcul (' + f2(BB.etr, 2) + ' t).'], 20, 62);
    S.cartouche({ titre: 'PLAN DE FERRAILLAGE DU TABLIER', sous: 'épures — planche 1/3', ouvrage: [m.titre].concat([]).filter(Boolean), numero: m.numero, echelles: 'longueurs 1/' + scL, planNo: 'FER-01' });
    return { S, scL };
  }

  /* ───────── planche 2 : coupes transversales ───────── */
  function sheet2(m, r, BB) {
    const P = G.OTPLAN, F = G.OTFERR, S = P.Sheet(); S.frame();
    const g = G.PSIDA_COF.geometry(m, r), s = g.sec, half = s.half, W = s.W, H = s.yE;
    const full = half.slice().reverse().map(p => [-p[0], p[1]]).concat(half.slice()).map(p => [p[0] + W / 2, p[1]]);
    const poly = [[W / 2 - half[0][0], 0]].concat(half.map(p => [W / 2 + p[0], p[1]])).concat(half.slice().reverse().map(p => [W / 2 - p[0], p[1]]));
    const top = x => s.top(x - W / 2), bot = x => { const ax = Math.abs(x - W / 2); for (let i = 0; i < half.length - 1; i++) { const a = half[i], b = half[i + 1]; if (ax >= a[0] - 1e-9 && ax <= b[0] + 1e-9 && b[0] > a[0]) return a[1] + (b[1] - a[1]) * (ax - a[0]) / (b[0] - a[0]); } return ax <= half[0][0] ? 0 : null; };
    const sc = [20, 25, 50, 75, 100].find(v => W * 1000 / v <= 236 && H * 1000 / v <= 50) || 100, k = 1000 / sc;
    const cS = BB.cS, cI = BB.cI, ph = r.mat.phi.map(mmOf);
    const section = (oy, xSec, titre) => {
      const ox = 14 + 16 + (236 - W * k) / 2, T = (x, y) => [ox + x * k, oy + y * k];
      S.poly(poly.map(p => T(p[0], p[1])), 'CONTOUR', true);
      // aciers actifs à l'abscisse xSec
      const act = (sens) => { const per = new Map(); for (const o of BB.occ) if (o.sens === sens && o.x0 <= xSec && o.x1 >= xSec) { const q = per.get(o.b.id) || { b: o.b, nb: 0 }; q.nb += o.nb; per.set(o.b.id, q); } return [...per.values()].sort((a, b) => b.b.d - a.b.d); };
      const zt = BB.zones.find(q => q.a <= xSec + 1e-6 && q.b >= xSec - 1e-6);
      const dT = zt && zt.sup && zt.sup[0] ? zt.sup[0].b.d : ph[1], dTi = zt && zt.inf && zt.inf[0] ? zt.inf[0].b.d : ph[1];
      // transversaux : nappe sup. sur toute la largeur, nappe inf. sur la nervure
      const yTs = H - cS - dT / 2000, xi0 = W / 2 - half[0][0] + 0.03, xi1 = W / 2 + half[0][0] - 0.03, yTi = cI + dTi / 2000;
      S.bar([T(0.03, yTs - 0.06), T(0.03, yTs), T(W - 0.03, yTs), T(W - 0.03, yTs - 0.06)], dT, { k: k / 1000 });
      S.bar([T(xi0, yTi), T(xi1, yTi)], dTi, { k: k / 1000 });
      const tags = [];
      tags.push({ side: 'top', p: T(W * 0.82, yTs), id: zt && zt.sup ? zt.sup[0].b.id : '', lab: zt && zt.sup ? zt.sup.map(q => 'HA' + q.b.d).join('/') + ' e=' + f2(zt.z.s, 3) : '' });
      tags.push({ side: 'bottom', p: T(W / 2 + half[0][0] * 0.6, yTi), id: zt && zt.inf ? zt.inf[0].b.id : '', lab: zt && zt.inf ? zt.inf.map(q => 'HA' + q.b.d).join('/') + ' e=' + f2(zt.z.s, 3) : '' });
      // longitudinaux : points répartis (nappe sup. sous les transversaux, nappe inf. au-dessus)
      for (const sens of ['sup', 'inf']) {
        const LL = act(sens), L = []; LL.forEach(q => { const e = L.find(x => x[0] === q.b.d); if (e) e[1] += q.nb; else L.push([q.b.d, q.nb]); }); const nTot = L.reduce((a, v) => a + v[1], 0); if (!nTot) continue;
        const y = sens === 'sup' ? yTs - dT / 2000 - 0.012 - 0.002 : yTi + dTi / 2000 + 0.012 + 0.002;
        let xa = sens === 'sup' ? 0.06 : xi0 + 0.03, xb = sens === 'sup' ? W - 0.06 : xi1 - 0.03;
        if (sens === 'inf') { /* nervure */ }
        const seq = []; L.forEach(([d, nb]) => { for (let j = 0; j < nb; j++) seq.push(d); });
        // alternance des diamètres
        const big = seq.filter(d => d === L[0][0]), rest = seq.filter(d => d !== L[0][0]), mix = []; const ratio = rest.length / Math.max(1, big.length);
        let acc = 0; big.forEach(d => { mix.push(d); acc += ratio; while (acc >= 1 && rest.length) { mix.push(rest.shift()); acc -= 1; } }); mix.push(...rest);
        mix.forEach((d, j) => { const x = xa + (xb - xa) * (mix.length === 1 ? 0.5 : j / (mix.length - 1)), yy = sens === 'sup' ? Math.min(y, top(x) - cS - dT / 1000 - d / 2000) : y; const q = T(x, yy); S.dot(q[0], q[1], Math.max(0.3, d / 2000 * k), d); });
        LL.forEach((q, j) => { const t = (j + 0.5) / LL.length;
          tags.push({ side: sens === 'sup' ? 'top' : 'bottom', p: T(sens === 'sup' ? 0.4 + (W * 0.62) * t : xi0 + (xi1 - xi0) * 0.75 * t, y), id: q.b.id, lab: q.nb + ' HA' + q.b.d }); });
      }
      const top0 = T(0, H)[1], bot0 = T(0, 0)[1];
      F.sideBubbles(S, tags.filter(t => t.side === 'top').map(t => ({ id: t.id, at: t.p, lab: t.lab, want: t.p[0] })), 'top', top0 + 16, { edge: top0 });
      F.sideBubbles(S, tags.filter(t => t.side === 'bottom').map(t => ({ id: t.id, at: t.p, lab: t.lab, want: t.p[0] })), 'bottom', bot0 - 16, { edge: bot0 });
      S.chainH([T(0, 0)[0], T(W / 2 - half[0][0], 0)[0], T(W / 2 + half[0][0], 0)[0], T(W, 0)[0]], bot0 - 24, [f2(W / 2 - half[0][0]), f2(2 * half[0][0]), f2(W / 2 - half[0][0])], { h: 1.8 });
      S.chainV([bot0, top0], T(W, 0)[0] + 6, [f2(H)], { right: true, h: 1.8 });
      S.vtitle(ox + W * k / 2, oy + H * k + 30, titre, 'Éch : 1/' + sc + ' — x = ' + f2(xSec) + ' m depuis l\'appui 1');
    };
    // coupe en travée (milieu de la travée la plus longue) et sur appui intermédiaire (ou culée)
    let im = 0; r.L.forEach((L, i) => { if (L > r.L[im]) im = i; });
    const xT = (BB.X[im] + BB.X[im + 1]) / 2, xA = BB.n > 1 ? BB.X[Math.min(im + 1, BB.n - 1)] : BB.X[0] + 0.3;
    section(206, xT, 'COUPE A-A — EN TRAVÉE ' + (im + 1));
    section(116, xA, 'COUPE B-B — SUR ' + (BB.n > 1 ? 'APPUI ' + (Math.min(im + 1, BB.n - 1) + 1) : 'CULÉE'));
    S.notes(['NOTES :', '— Nombre de barres longitudinales : lits actifs à l\'abscisse de la coupe (épure).', '— Transversaux de la zone traversée (chevêtre, zone 2, travée) ;', '   nappe inférieure sur la nervure.',
      '— Position des barres schématique dans la largeur.', '— Enrobages ' + f2(cS, 3) + ' / ' + f2(cI, 3) + ' m.'], 284, 160);
    S.cartouche({ titre: 'PLAN DE FERRAILLAGE DU TABLIER', sous: 'coupes transversales — planche 2/3', ouvrage: [m.titre], numero: m.numero, echelles: '1/' + sc, planNo: 'FER-02' });
    return { S, sc };
  }

  function build(m, r) {
    const BB = bars(m, r), s1 = sheet1(m, r, BB), s2 = sheet2(m, r, BB);
    const s3 = G.OTFERR.nomenSheet(m, BB.list, { vol: BB.beton, ton: BB.ton, tonLab: 'hors étriers', cart: { titre: 'PLAN DE FERRAILLAGE DU TABLIER', sous: 'nomenclature — planche 3/3', ouvrage: [m.titre], numero: m.numero, planNo: 'FER-03' } });
    return { sheets: [{ S: s1.S, label: 'Épures', sub: 'A3 · épure longitudinale 1/' + s1.scL + ' · transversaux' }, { S: s2.S, label: 'Coupes', sub: 'A3 · coupes en travée et sur appui 1/' + s2.sc }, ...s3.sheets.map((S, i) => ({ S, label: 'Nomenclature' + (s3.sheets.length > 1 ? ' ' + (i + 1) : ''), sub: 'A3 · nomenclature ADFER (hors étriers) · ' + (s3.tot / 1000).toFixed(2) + ' t' }))], bars: BB };
  }
  G.PSIDA_FERR = { bars, build };
})(typeof window !== 'undefined' ? window : globalThis);
