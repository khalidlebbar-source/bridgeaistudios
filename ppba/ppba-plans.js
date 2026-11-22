/* PPBA — plan de coffrage du tablier à poutres préfabriquées en béton armé (BridgeAI / KLE Ingénierie)
   Géométrie : b.base (n, e, L, Lpoutre, bs, hs1, hs2, b0, b0m, hame, bt, ht1, ht2, Lh, hd, trG, trD, ent). */
(function (G) {
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);
  // section de poutre (repère : y = 0 en fibre supérieure de la table, vers le bas négatif), comme le moteur PPBA
  const beam = (e, b0) => { const r = e.hs2 + e.hame + e.ht2; return [[-e.bs / 2, 0], [-e.bs / 2, -e.hs1], [-b0 / 2, -e.hs2], [-b0 / 2, -(r - e.ht2)], [-e.bt / 2, -(r - e.ht1)], [-e.bt / 2, -r], [e.bt / 2, -r], [e.bt / 2, -(r - e.ht1)], [b0 / 2, -(r - e.ht2)], [b0 / 2, -e.hs2], [e.bs / 2, -e.hs1], [e.bs / 2, 0]]; };

  function coffrage(st, it) {
    const tr = (st.travees || [])[it || 0], e = Object.assign({}, st.base || st, tr ? { L: tr.L, Lpoutre: tr.Lpoutre, travee: tr.nom } : {});
    const P = G.OTPLAN, S = P.Sheet(), H = e.hs2 + e.hame + e.ht2, n = Math.max(1, Math.round(e.n) || 1);
    const W = Math.max(e.Lh || 0, (n - 1) * e.e + e.bs), xs = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * e.e), Lp = e.Lpoutre || e.L + 1, ab = (Lp - e.L) / 2;
    const ent = e.ent || { b: 0, h: 0, ep: 0, nb: 0 };
    S.frame();
    // ---------- coupe transversale ----------
    const scT = P.pickScale(W + 1, 250, [20, 25, 50, 75, 100]), kT = 1000 / scT, ox = 140, oy = 262 - (e.hd + 0.3) * kT;   // y = 0 : dessus des poutres
    const T = (x, y) => [ox + x * kT, oy + y * kT];
    const hq = [T(-W / 2, 0), T(W / 2, 0), T(W / 2, e.hd), T(-W / 2, e.hd)]; S.fill(hq, 'BETON'); S.poly(hq, 'CONTOUR', true);
    xs.forEach((x, i) => { const q = beam(e, e.b0m).map(p => T(x + p[0], p[1])); S.fill(q, 'BETON'); S.poly(q, 'CONTOUR', true); const t = T(x, -H); S.text(t[0], t[1] - 4, 'P' + (i + 1), 2.6, { bold: 1 }); });
    if (e.trG > 0) S.poly([T(-W / 2, e.hd), T(-W / 2 + e.trG, e.hd), T(-W / 2 + e.trG, e.hd + 0.2), T(-W / 2, e.hd + 0.2)], 'VU', true);
    if (e.trD > 0) S.poly([T(W / 2 - e.trD, e.hd), T(W / 2, e.hd), T(W / 2, e.hd + 0.2), T(W / 2 - e.trD, e.hd + 0.2)], 'VU', true);
    if (ent.h > 0) S.poly([T(xs[0], -ent.h), T(xs[n - 1], -ent.h)], 'CACHE');
    { const a = T(0, -H - 0.4), z = T(0, e.hd + 0.6); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    const xb = [-W / 2].concat(xs, [W / 2]);
    S.chainH(xb.map(v => T(v, 0)[0]), T(0, -H)[1] - 10, xb.slice(1).map((v, i) => f2(v - xb[i], 2)), { h: 1.9 });
    S.dim([T(-W / 2, 0)[0], T(0, -H)[1] - 17], [T(W / 2, 0)[0], T(0, -H)[1] - 17], 0, f2(W, 2) + ' (hourdis)', { noExt: true });
    const tops = [e.trG, W - e.trG - e.trD, e.trD].filter(v => v > 0); let x0 = -W / 2;
    S.chainH([x0].concat(tops.map(v => (x0 += v))).map(v => T(v, 0)[0]), T(0, e.hd + 0.2)[1] + 5, tops.map(v => f2(v, 2)), { h: 1.9 });
    S.chainV([T(0, -H)[1], T(0, -H + e.ht1)[1], T(0, -H + e.ht2)[1], T(0, -e.hs2)[1], T(0, -e.hs1)[1], T(0, 0)[1], T(0, e.hd)[1]], T(W / 2, 0)[0] + 6,
      [f2(e.ht1, 2), f2(e.ht2 - e.ht1, 2), f2(e.hame, 2), f2(e.hs2 - e.hs1, 2), f2(e.hs1, 2), f2(e.hd, 2)], { right: true });
    S.title(15, 281, 'COUPE TRANSVERSALE DU TABLIER', 'échelle 1/' + scT + ' — section courante (âme ' + f2(e.b0m, 2) + ' m)' + (ent.h > 0 ? ', entretoise d\'about en pointillé' : ''));
    // ---------- sections de poutre ----------
    const scD = P.pickScale(e.bs + 0.3, 56, [10, 20, 25, 50]), kD = 1000 / scD, yD = oy - H * kT - 34;
    [['SECTION COURANTE', e.b0m], ['SECTION SUR APPUI', e.b0]].forEach(([lab, b0], j) => {
      const cx = 302 + j * 60, D = (x, y) => [cx + x * kD, yD + y * kD], q = beam(e, b0).map(p => D(p[0], p[1])); S.fill(q, 'BETON'); S.poly(q, 'CONTOUR', true);
      S.dim([D(-e.bs / 2, 0)[0], D(0, 0)[1] + 3], [D(e.bs / 2, 0)[0], D(0, 0)[1] + 3], 0, f2(e.bs, 2), { noExt: true, h: 1.8 });
      S.dim([D(-e.bt / 2, 0)[0], D(0, -H)[1] - 3], [D(e.bt / 2, 0)[0], D(0, -H)[1] - 3], 0, f2(e.bt, 2), { noExt: true, h: 1.8 });
      S.text(D(b0 / 2, -H / 2)[0] + 1, D(0, -H / 2)[1], 'âme ' + f2(b0, 2), 1.8, { a: 'l', ly: 'COTES' });
      S.text(cx, D(0, 0)[1] + 8, lab, 2.4, { bold: 1 });
    });
    S.text(282, yD + 15, 'POUTRE — échelle 1/' + scD + ' — hauteur ' + f2(H, 2) + ' m', 2.6, { a: 'l', bold: 1 });
    // ---------- élévation d'une poutre ----------
    const topL = yD - H * kD - 18, kMax = (topL - 14 - 12 - 14 - 18 - 6) / (H + e.hd + W);
    const scL = [50, 75, 100, 125, 150, 200, 250, 300, 400, 500].find(sc => (Lp + 2) * 1000 / sc <= 250 && 1000 / sc <= kMax) || 500, kL = 1000 / scL, oxL = 23, oyL = topL - 12 - e.hd * kL;
    const L2 = (x, y) => [oxL + x * kL, oyL + y * kL];
    S.poly([L2(0, -H), L2(Lp, -H), L2(Lp, 0), L2(0, 0)], 'CONTOUR', true); S.poly([L2(0, 0), L2(0, e.hd), L2(Lp, e.hd), L2(Lp, 0)], 'VU');
    for (const y of [-e.hs2, -H + e.ht2]) S.poly([L2(0, y), L2(Lp, y)], 'CACHE');
    if (ent.h > 0 && ent.ep > 0) for (const x of [0, Lp - ent.ep]) S.poly([L2(x, -ent.h), L2(x + ent.ep, -ent.h), L2(x + ent.ep, 0), L2(x, 0)], 'CACHE', true);
    for (const x of [ab, Lp - ab]) { const a = L2(x, -H); S.line(a[0], a[1] - 6, a[0], L2(x, e.hd)[1] + 4, 'AXE'); S.poly([[a[0] - 2, a[1] - 0.4], [a[0] + 2, a[1] - 0.4], [a[0] + 2, a[1] - 1.8], [a[0] - 2, a[1] - 1.8]], 'APPAREILS', true); }
    S.chainH([0, ab, Lp - ab, Lp].map(x => L2(x, 0)[0]), L2(0, -H)[1] - 8, [f2(ab, 2), f2(e.L, 2) + ' (portée)', f2(ab, 2)]);
    S.dim([L2(0, 0)[0], L2(0, -H)[1] - 14], [L2(Lp, 0)[0], L2(0, -H)[1] - 14], 0, f2(Lp, 2) + ' (longueur de la poutre)', { noExt: true });
    S.title(15, L2(0, e.hd)[1] + 12, 'ÉLÉVATION D\'UNE POUTRE', 'échelle 1/' + scL + (ent.h > 0 ? ' — entretoises d\'about (pointillé) h = ' + f2(ent.h, 2) + ', ép. ' + f2(ent.ep, 2) : ''));
    // ---------- vue en plan ----------
    const yPl = L2(0, -H)[1] - 24, Pq = (x, y) => [oxL + x * kL, yPl - (W / 2 - y) * kL];
    S.poly([Pq(0, -W / 2), Pq(Lp, -W / 2), Pq(Lp, W / 2), Pq(0, W / 2)], 'CONTOUR', true);
    xs.forEach(x => { for (const sg of [-1, 1]) { const a = Pq(0, x + sg * e.bt / 2), z = Pq(Lp, x + sg * e.bt / 2); S.line(a[0], a[1], z[0], z[1], 'CACHE'); } });
    if (ent.ep > 0) for (const x of [0, Lp - ent.ep]) S.poly([Pq(x, xs[0]), Pq(x + ent.ep, xs[0]), Pq(x + ent.ep, xs[n - 1]), Pq(x, xs[n - 1])], 'CACHE', true);
    for (const x of [ab, Lp - ab]) { const a = Pq(x, -W / 2 - 1), z = Pq(x, W / 2 + 1); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    { const a = Pq(-1, 0), z = Pq(Lp + 1, 0); S.line(a[0], a[1], z[0], z[1], 'AXE'); }
    S.text(Pq(0, W / 2)[0], Pq(0, W / 2)[1] + 2.5, 'VUE EN PLAN — talons des poutres et entretoises en pointillé', 2.4, { a: 'l', bold: 1 });
    S.notes(['NOTES :', '— cotes en mètres.', '— hourdis coulé en place : épaisseur ' + f2(e.hd, 2) + ' m, largeur ' + f2(W, 2) + ' m.', '— ' + n + ' poutres préfabriquées, entraxe ' + f2(e.e, 2) + ' m.',
      '— entretoises : ' + (ent.nb || 0) + ' (h ' + f2(ent.h || 0, 2) + ', ép. ' + f2(ent.ep || 0, 2) + ').'], 282, 112);
    S.cartouche({ titre: 'PLAN DE COFFRAGE DU TABLIER', sous: 'tablier à poutres préfabriquées en béton armé — PPBA', ouvrage: [e.projet || '', [e.ouvrage, e.travee].filter(Boolean).join(' — ')], numero: '', echelles: 'coupe 1/' + scT + ', élévation 1/' + scL + ', poutre 1/' + scD, planNo: 'COF-01' });
    return { S, scT, scL, scD };
  }
  G.PPBA_PLANS = { coffrage };
  // onglet de l'application PPBA
  let sel = 0;
  G.PPBA_COF = (st, el) => { if (!el) return; try {
    const trs = st.travees || []; sel = Math.min(sel, Math.max(0, trs.length - 1));
    const b = coffrage(st, sel); G.OTPLAN.tab(el, { sheet: b.S, title: 'Plan de coffrage du tablier', sub: `A3 · coupe 1/${b.scT} · élévation 1/${b.scL} · poutre 1/${b.scD}`, file: 'coffrage-PPBA' + (trs[sel] ? '-' + trs[sel].nom.replace(/\W+/g, '_') : '') });
    if (trs.length > 1) { const s2 = document.createElement('select'); s2.innerHTML = trs.map((t, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${t.nom} — L = ${t.L} m</option>`).join(''); s2.onchange = () => { sel = +s2.value; G.PPBA_COF(st, el); }; const bar = el.querySelector('.ot-xbar'); bar.insertBefore(s2, bar.children[2]); } } catch (e) { console.error(e); el.innerHTML = '<div class="empty">Planche impossible : ' + (e.message || e) + '</div>'; } };
})(typeof window !== 'undefined' ? window : globalThis);
