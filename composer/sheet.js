/* BridgeAI Studios — Bridge Composer : PLAN D'ENSEMBLE (feuille A1 paysage, 841 × 594 mm)
 * Assemble sur une même feuille, à la manière des plans d'ensemble de bureau d'études :
 *   coupe longitudinale (avec profil en long / guitare et sondages), vue en plan, coupe transversale,
 *   caractéristiques principales, bétons et aciers, nota et contrôles, cartouche.
 * Chaque vue est une scène de draw.js rendue par toSVG puis imbriquée (<svg> enfant) dans son cadre. */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? Object.assign({}, require('./calc.js'), require('./draw.js')) : root.COMP;
  const api = factory(C);
  if (isNode) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const fr = C.fr, esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const SW = 841, SH = 594;
  const Z = {                                  // cadres (mm)
    long: [14, 14, 542, 300], plan: [14, 318, 542, 262],
    sec: [562, 14, 265, 206], carac: [562, 226, 131, 214], mat: [697, 226, 130, 214],
    nota: [562, 446, 265, 58], cart: [562, 508, 265, 72],
  };

  function embed(sc, box, id, opt) {
    const [x, y, w, h] = box;
    const pad = 3, tb = 0;
    const svg = C.toSVG(sc, { width: (w - 2 * pad) * 4, kp: 5, pad: 6, id, dims: opt.dims !== false });
    return svg.replace(/^<svg[^>]*viewBox="([^"]+)"[^>]*>/, (m, vb) => `<svg x="${x + pad}" y="${y + pad + tb}" width="${w - 2 * pad}" height="${h - 2 * pad - tb}" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" overflow="hidden">`);
  }
  const T = (x, y, s, o) => {
    o = o || {};
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.fs || 3}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.b ? ' font-weight="700"' : ''}${o.i ? ' font-style="italic"' : ''}${o.c ? ` fill="${o.c}"` : ''}${o.tag ? ` data-tag="${o.tag}"` : ''}>${esc(s)}</text>`;
  };
  const R = (x, y, w, h, st) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" style="${st || 'fill:none;stroke:#1e1e1e;stroke-width:.35'}"/>`;
  const Lh = (x1, x2, y, w) => `<path d="M${x1} ${y.toFixed(2)}H${x2}" style="stroke:#1e1e1e;stroke-width:${w || 0.2}"/>`;
  /* coupe un texte trop long pour une largeur (mm) donnée */
  const fit = (s, w, fs) => { s = String(s); const n = Math.floor(w / (fs * 0.5)); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };
  function wrap(s, w, fs) {
    const n = Math.max(8, Math.floor(w / (fs * 0.5))), out = [];
    String(s).split(/\n/).forEach((par) => { let l = ''; par.split(/\s+/).forEach((wd) => { if ((l + ' ' + wd).trim().length > n) { if (l) out.push(l); l = wd; } else l = (l + ' ' + wd).trim(); }); if (l) out.push(l); });
    return out;
  }
  /* tableau clé / valeur dans un cadre */
  function table(box, titre, rows, o) {
    o = o || {};
    const [x, y, w, h] = box, fs = o.fs || 2.6, rh = o.rh || 5.0, kw = o.kw || 0.46;
    let s = R(x, y, w, h) + `<rect x="${x}" y="${y}" width="${w}" height="7" style="fill:#eef1f6;stroke:#1e1e1e;stroke-width:.35"/>` + T(x + w / 2, y + 5, titre, { fs: 3.2, a: 'middle', b: true });
    let yy = y + 7;
    for (const r of rows) {
      if (yy + rh > y + h - 0.5) { s += T(x + 2, y + h - 1.5, '…', { fs }); break; }
      if (r.g) { s += `<rect x="${x}" y="${yy.toFixed(2)}" width="${w}" height="${rh}" style="fill:#f7f8fa;stroke:none"/>` + T(x + 2, yy + rh * 0.72, r.g, { fs, b: true }); yy += rh; s += Lh(x, x + w, yy); continue; }
      s += T(x + 2, yy + rh * 0.72, fit(r[0], w * kw - 3, fs), { fs, tag: r[2] }) + T(x + w * kw, yy + rh * 0.72, fit(r[1], w * (1 - kw) - 2, fs), { fs, b: !!r[3], tag: r[2] });
      yy += rh; s += Lh(x, x + w, yy, 0.12);
    }
    return s;
  }

  function caracRows(M) {
    const S = M.S, T_ = M.T, n = M.xs.length - 1, f2 = (v) => fr(v, 2), rail = S.usage === 'rail';
    const spans = S.travees.every((L) => Math.abs(L - S.travees[0]) < 1e-6) && n > 1 ? n + ' × ' + f2(S.travees[0]) : S.travees.map(f2).join(' + ');
    const rows = [
      { g: 'Ouvrage' },
      ['Usage', rail ? 'Pont-rail' : 'Pont-route'],
      ['Tablier', T_.nom + ' — ' + T_.titre.toLowerCase(), 'tablier', true],
      ['Travées', spans + ' m', 'travees'],
      ['Longueur entre culées', f2(M.Ltot) + ' m', 'travees', true],
      ['Largeur du tablier', f2(M.W) + ' m', 'profil'],
      ['Hauteur du tablier', f2(M.h) + ' m', 'tablier'],
      ['Biais', S.biais >= 99.95 ? 'droit (100 gr)' : fr(S.biais, 1) + ' gr', 'travees'],
      ['Fonctionnement', M.cont ? 'continu' : 'travées indépendantes'],
      ['Surface utile', fr(M.surf, 0) + ' m²'],
      { g: 'Appuis' },
      ...(n > 1 ? [['Piles', C.PILES[S.piles.type].nom, 'appuis']] : []),
      ['Culées', C.CULEES[S.culees.type].nom, 'appuis'],
      ...M.supports.map((s) => [s.id + (s.kind === 'pile' ? ' (H ' + f2(s.H) + ')' : ' (H ' + f2(s.H) + ')'), s.fo.mode === 'pieux' ? s.fo.n + ' pieux Ø ' + f2(s.fo.D) + ', L = ' + fr(s.fo.Lp, 1) + ' m' : 'semelle ' + f2(s.fo.B) + ' × ' + f2(s.fo.L) + ' × ' + f2(s.fo.e), s.id]),
      { g: 'Équipements' },
      ['Appareils d’appui', M.lines[0].nb + ' × ' + M.lines[0].app.des],
      ['Joints de chaussée', M.joints.length ? M.joints[0].des : '—'],
      ['Retenue', rail ? 'garde-corps' : ({ BN4: 'barrière BN4', GBA: 'GBA', GC: 'garde-corps' })[S.equip.retenue]],
      ['Revêtement', rail ? 'ballast 0,60 m' : 'enrobés ' + fr(S.equip.revetement * 100, 0) + ' cm' + (S.equip.etancheite ? ' + étanchéité' : '')],
    ];
    if (M.trace) {
      const t = S.trace, TR = M.trace;
      rows.push({ g: 'Tracé' });
      rows.push(['PK des culées', fr(TR.sup[0].pk, 2) + ' → ' + fr(TR.sup[TR.sup.length - 1].pk, 2), 'trace']);
      rows.push(['Tracé en plan', t.R ? 'courbe R = ' + fr(Math.abs(t.R), 0) + ' m (' + (t.R > 0 ? 'à droite' : 'à gauche') + ')' : 'alignement droit', 'trace']);
      rows.push(['Profil en long', t.Rv > 0 ? fr(t.p1, 2) + ' % / ' + fr(t.p2, 2) + ' %, R = ' + fr(t.Rv, 0) + ' m' : 'pente ' + fr(t.p1, 2) + ' %', 'trace']);
      rows.push(['Profil en travers', t.typeDevers === 'toit' ? 'toit ' + fr(t.devers, 1) + ' %' : 'dévers unique ' + fr(t.devers, 1) + ' %', 'trace']);
    }
    return rows;
  }
  function matRows(M) {
    const S = M.S, H = S.hyp, isBet = (m) => m.u === 'm³' && /^Béton/.test(m.des);
    const lots = {};
    M.metres.filter(isBet).forEach((m) => { lots[m.lot] = (lots[m.lot] || 0) + m.q; });
    const rows = [{ g: 'Bétons' },
      ['Tablier', H.betonTab, 'tablier'], ['Appuis', H.betonApp, 'appuis'], ['Fondations', H.betonFond, 'appuis'],
      ...(M.supports.some((s) => s.fo.mode === 'pieux') ? [['Pieux', H.betonPieux]] : []),
      ['Béton de propreté', 'C12/15 (dosé 150 kg/m³)'],
      ['Enrobage tablier / appuis', fr(H.enrobTab, 0) + ' / ' + fr(H.enrobApp, 0) + ' cm'],
      ['Exposition', H.exposition],
      { g: 'Aciers' },
      ['Armatures passives', H.acier + ' — HA'],
      ...(M.kpi.prec > 0 ? [['Précontrainte', H.precontrainte]] : []),
      ...(M.kpi.metal > 0 ? [['Charpente', H.charpente]] : []),
      { g: 'Quantités (estimation)' },
      ...Object.keys(lots).map((k) => ['Béton ' + k.replace(/^\d+\.\s*/, '').toLowerCase(), fr(lots[k], 0) + ' m³']),
      ['Béton total', fr(M.kpi.beton, 0) + ' m³', null, true],
      ['Armatures HA', fr(M.kpi.acier / 1000, 1) + ' t'],
      ...(M.kpi.prec > 0 ? [['Acier de précontrainte', fr(M.kpi.prec / 1000, 1) + ' t']] : []),
      ...(M.kpi.metal > 0 ? [['Acier de charpente', fr(M.kpi.metal / 1000, 1) + ' t']] : []),
    ];
    return rows;
  }
  function notaLines(M, opt) {
    const S = M.S, L = [];
    L.push('Les cotes sont en mètres et les altitudes en m (rattachement du levé topographique).');
    L.push('Règlement : ' + (S.reglement === 'EC' ? 'Eurocodes (EN 1990, EN 1991-2, EN 1992)' : (S.usage === 'rail' ? 'Livret 2.01 / UIC 71' : 'Fascicule 61 titre II, BAEL / BPEL')) + '.');
    if (M.trace) M.trace.checks.forEach((c) => L.push((c.ok ? '✓ ' : '✗ ') + c.lab + ' : ' + fr(c.val, 2) + ' m (requis ' + fr(c.lim, 2) + ' m) — ' + c.txt + '.'));
    if (S.geo && S.geo.sondages && S.geo.sondages.length) L.push('Sondages reportés d’après ' + (S.geo.source ? '« ' + S.geo.source + ' »' : 'le rapport géotechnique') + ' (' + S.geo.sondages.map((d) => d.sondage).join(', ') + ').');
    if (opt.justif) L.push((opt.justif.ok ? '✓ ' : '✗ ') + 'Chaîne de justification : ' + (opt.justif.ok ? 'tous les critères sont vérifiés.' : opt.justif.nko + ' point(s) à reprendre.'));
    if (M.warn.length) L.push('⚠ ' + M.warn.length + ' alerte(s) de prédimensionnement — voir l’onglet Messages.');
    if (S.hyp.notes) L.push(S.hyp.notes);
    return L;
  }
  function cartouche(M, box) {
    const S = M.S, p = S.projet, [x, y, w, h] = box;
    let s = R(x, y, w, h, 'fill:#fff;stroke:#1e1e1e;stroke-width:.6');
    const c1 = x + w * 0.62;
    s += `<path d="M${c1} ${y}V${y + 44}M${x} ${y + 44}H${x + w}M${x} ${y + 14}H${c1}M${x} ${y + 30}H${c1}" style="stroke:#1e1e1e;stroke-width:.35"/>`;
    s += T(x + 3, y + 5.5, 'Maître d’ouvrage', { fs: 2.1, c: '#555' }) + T(x + 3, y + 11, fit(p.moa || '—', c1 - x - 6, 3.2), { fs: 3.2, b: true, tag: 'projet' });
    s += T(x + 3, y + 18.5, 'Projet', { fs: 2.1, c: '#555' }) + T(x + 3, y + 25, fit(p.nom || 'Ouvrage', c1 - x - 6, 3.6), { fs: 3.6, b: true, tag: 'projet' });
    s += T(x + 3, y + 35, fit((p.ouvrage || '') + (p.lieu ? ' — ' + p.lieu : ''), c1 - x - 6, 3), { fs: 3, tag: 'projet' }) + T(x + 3, y + 41, fit(p.ref ? 'Réf. ' + p.ref : '', c1 - x - 6, 2.4), { fs: 2.4 });
    s += T((c1 + x + w) / 2, y + 9, (p.phase || 'Avant-projet').toUpperCase(), { fs: 3.2, a: 'middle', b: true });
    s += T((c1 + x + w) / 2, y + 22, 'PLAN D’ENSEMBLE', { fs: 5.2, a: 'middle', b: true });
    s += T((c1 + x + w) / 2, y + 30, 'Indice ' + (p.indice || '00'), { fs: 3, a: 'middle' });
    s += T((c1 + x + w) / 2, y + 38, fit(p.bet || 'BridgeAI Studios — Bridge Composer', x + w - c1 - 4, 2.4), { fs: 2.4, a: 'middle', i: true });
    // tableau des indices / visas
    const cols = [0, 0.12, 0.30, 0.52, 0.76], lab = ['Ind.', 'Date', 'Dessiné', 'Vérifié', 'Validé'];
    const val = [p.indice || '00', p.date || new Date().toLocaleDateString('fr-FR'), p.dessine || '', p.verifie || '', p.valide || ''];
    const yv = y + 44;
    cols.forEach((c, k) => {
      const xx = x + w * c;
      if (k) s += `<path d="M${xx.toFixed(1)} ${yv}V${y + h}" style="stroke:#1e1e1e;stroke-width:.25"/>`;
      s += T(xx + 2, yv + 5.5, lab[k], { fs: 2.2, c: '#555' }) + T(xx + 2, yv + 13, fit(val[k], w * ((cols[k + 1] || 1) - c) - 4, 2.8), { fs: 2.8, b: k === 0 });
    });
    s += Lh(x, x + w, yv + 8, 0.25);
    return s;
  }

  /* opt : { justif: {ok, nko}, dims } */
  function sheetSVG(M, opt) {
    opt = opt || {};
    const eL = C.elevScene(M), eP = C.planScene(M), eS = C.secScene(M);
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW * 2}" height="${SH * 2}" role="img" class="sheet">`
      + `<style>.sheet text{font-family:'Arial Narrow','Segoe UI',Arial,sans-serif;fill:#14171f}</style>`
      + `<rect x="0" y="0" width="${SW}" height="${SH}" style="fill:#fff;stroke:none"/>`
      + R(8, 8, SW - 16, SH - 16, 'fill:none;stroke:#1e1e1e;stroke-width:.8');
    // vues
    s += R(Z.long[0], Z.long[1], Z.long[2], Z.long[3], 'fill:none;stroke:#c9ced8;stroke-width:.3') + embed(eL, Z.long, 'pl', opt);
    s += R(Z.plan[0], Z.plan[1], Z.plan[2], Z.plan[3], 'fill:none;stroke:#c9ced8;stroke-width:.3') + embed(eP, Z.plan, 'pp', opt);
    s += R(Z.sec[0], Z.sec[1], Z.sec[2], Z.sec[3], 'fill:none;stroke:#c9ced8;stroke-width:.3') + embed(eS, Z.sec, 'ps', opt);
    // tableaux
    s += table(Z.carac, 'CARACTÉRISTIQUES', caracRows(M), { kw: 0.42 });
    s += table(Z.mat, 'BÉTONS — ACIERS', matRows(M), { kw: 0.5 });
    // nota
    {
      const [x, y, w, h] = Z.nota, fs = 2.45;
      s += R(x, y, w, h) + T(x + 3, y + 5.5, 'NOTA', { fs: 3.2, b: true });
      let yy = y + 11;
      for (const l of notaLines(M, opt)) for (const ln of wrap(l, w - 8, fs)) {
        if (yy > y + h - 2) break;
        const bad = /^✗|^⚠/.test(l);
        s += T(x + 4, yy, ln, { fs, c: bad ? '#c92a2a' : null });
        yy += fs * 1.35;
      }
    }
    s += cartouche(M, Z.cart);
    s += T(SW - 12, SH - 4, 'Échelles : coupe longitudinale 1/' + eL.ech + ' · vue en plan 1/' + eP.ech + ' · coupe transversale 1/' + eS.ech + ' — format A1', { fs: 2.2, a: 'end', c: '#555' });
    return s + '</svg>';
  }

  return { sheetSVG, SHEET: { W: SW, H: SH, Z } };
});
