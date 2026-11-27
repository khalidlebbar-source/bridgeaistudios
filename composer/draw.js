/* BridgeAI Studios — Bridge Composer : dessins (élévation longitudinale, coupe transversale + coupe sur pile).
 *
 * Les scènes sont décrites en mètres (repère : x le long de l'axe, y vers le haut, dessus du tablier à y = 0)
 * par des primitives communes au rendu SVG (écran, note PDF) et à l'export DXF :
 *   { k: 'poly', pts, closed, lay }            lay : beton, prefa, acier, vu, axe, tn, remblai, app, equip, eau
 *   { k: 'text', p, s, ht, anchor, lay, dy }   ht et dy en mm « papier »
 *   { k: 'dim', a, b, dir: 'h'|'v', off, s }   off en mm papier (positif : au-dessus / à droite)
 *   { k: 'brk', a, b }                         coupure (pieux tronqués)
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('./calc.js') : root.COMP;
  const api = factory(C);
  if (isNode) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const fr = C.fr;
  const frn = (v) => {   // cotes comme sur les plans KLE (AutoCAD) : « .75 », « 1.50 », « .023 », point décimal
    v = +v; if (!Number.isFinite(v)) return String(v);
    const d = Math.abs(Math.round(v * 1000) - Math.round(v * 100) * 10) > 0 ? 3 : 2;
    return v.toFixed(d).replace(/^(-?)0\./, '$1.');
  };

  const poly = (P, pts, lay, closed) => P.push({ k: 'poly', pts, lay, closed: closed !== false });
  const line = (P, a, b, lay) => P.push({ k: 'poly', pts: [a, b], lay, closed: false });
  const rect = (P, x0, y0, x1, y1, lay) => poly(P, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], lay);
  const text = (P, p, s, o) => P.push(Object.assign({ k: 'text', p, s, ht: 2.5, anchor: 'middle', lay: 'texte', dy: 0 }, o || {}));
  const dim = (P, a, b, dir, off, s) => P.push({ k: 'dim', a, b, dir, off, s });

  /* étiquette de sélection (data-tag) des primitives ajoutées depuis l'indice i */
  const tagFrom = (P, i, t) => { for (let k = i; k < P.length; k++) if (!P[k].tag) P[k].tag = t; };
  const pickScale = (len, maxmm, list) => list.find((e) => len / e * 1000 <= maxmm) || list[list.length - 1];

  /* cercle (fourreaux, colonnes en plan) en polygone */
  const circ = (P, cx, cy, r, lay, nseg) => {
    const k = nseg || 14, pts = [];
    for (let i = 0; i < k; i++) { const a = i * 2 * Math.PI / k; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    poly(P, pts, lay);
  };
  /* titre de vue à la manière des plans KLE : « COUPE TRANSVERSALE » souligné, « Ech : 1/50 » dessous */
  const title = (P, p, s, ech) => P.push({ k: 'title', p, s, sub: 'Ech:1/' + ech });
  /* repère avec ligne d'attache */
  let curEch = 50;   // échelle de la scène en cours (taille des flèches de repère)
  /* repère à la manière des plans : flèche pleine sur l'objet, trait, épaulement horizontal, texte */
  const leader = (P, from, to, s, anchor) => {
    const k = curEch / 1000, sd = anchor === 'end' ? -1 : 1, dx = from[0] - to[0], dy = from[1] - to[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const ah = 1.8 * k, aw = 0.4 * k, sh = [to[0] + sd * 3 * k, to[1]];
    line(P, from, to, 'lead'); line(P, to, sh, 'lead');
    poly(P, [from, [from[0] - ux * ah - uy * aw, from[1] - uy * ah + ux * aw], [from[0] - ux * ah + uy * aw, from[1] - uy * ah - ux * aw]], 'arrowF');
    text(P, [sh[0] + sd * 0.8 * k, sh[1]], s, { ht: 2.6, anchor: anchor || 'start', dy: -0.9, lay: 'note' });
  };

  /* ───────── Élévation (coupe longitudinale) ───────── */
  function elevScene(M, o) {
    const P = [], h = M.h, sec = M.sec, n = M.xs.length - 1, xs = M.xs, dab = M.dab, Ltot = M.Ltot, S = M.S;
    const ech = (o && o.ech) || pickScale(Ltot + 2 * dab + 24, 400, [50, 100, 150, 200, 250, 500, 1000, 2000]);
    const mm = (v) => v * ech / 1000;
    const ySeat = -(h + C.seatDrop(M.S, M.W));
    const T = M.T, fam = T.famille, rail = S.usage === 'rail';
    const yInner = fam === 'poutres' ? -sec.info.eh : fam === 'mixte' ? -sec.info.hs : null;

    // ── terrain naturel, remblais d'accès, talus perrés ──
    const xFo = (s) => {
      if (s.kind === 'pile') return s.x;
      const o = s.j === 0 ? -1 : 1, R = C.culeeProfil(s);
      return s.x + o * (R.uf != null ? R.uf + s.geo.mur.e / 2 : R.uc);
    };
    // tracé : altitude du dessus du tablier en x (repère local : dessus du tablier en y = 0, cisaillé à la fin)
    const TR = M.trace, tr0 = S.trace;
    const ZT = TR ? (x) => C.lrAt(tr0, tr0.pk0 + x) - TR.ep : () => 0;
    const tnS = (s) => (TR && TR.sup[s.j].TN != null ? TR.sup[s.j].TN - ZT(s.x) : ySeat - s.H + 0.6);
    let tn = M.supports.map((s) => [xFo(s), tnS(s)]);
    const xL = -dab - 14, xR = Ltot + dab + 14;
    if (TR && TR.hasTN) { tn = []; for (let k = 0; k <= 80; k++) { const x = xL + (xR - xL) * k / 80; tn.push([x, C.tnAt(tr0, tr0.pk0 + x) - ZT(x)]); } }
    const yBot = Math.min.apply(null, M.supports.map((s) => ySeat - s.H - (s.fo.mode === 'pieux' ? s.fo.e + s.fo.Lp : s.fo.e))) - 1.5;
    poly(P, [[xL, tn[0][1]]].concat(tn, [[xR, tn[tn.length - 1][1]], [xR, yBot], [xL, yBot]]), 'sol');
    line(P, [xL, tn[0][1]], tn[0], 'tn'); for (let i = 0; i < tn.length - 1; i++) line(P, tn[i], tn[i + 1], 'tn');
    line(P, tn[tn.length - 1], [xR, tn[tn.length - 1][1]], 'tn');
    M.supports.filter((s) => s.kind === 'culee').forEach((s) => {
      const o = s.j === 0 ? -1 : 1, g = s.geo, ytn = tnS(s);
      const back = s.x + o * (dab + 0.05 + g.egg), far = o < 0 ? xL : xR, yTop = -0.10;
      const yb = g.sommier ? ySeat - g.sommier.h : ytn;
      const xin = back - o * (g.sommier ? g.sommier.b : g.mur.e);
      if (g.type === 'enterree') {
        const dx = (yb - ytn) * 1.5;                   // talus 3/2 sous le chevêtre, perré
        poly(P, [[far, yTop], [back, yTop], [back, ySeat], [xin, ySeat], [xin, yb], [xin - o * dx, ytn], [far, ytn]], 'remblai');
        line(P, [xin, yb], [xin - o * dx, ytn], 'perre');
        text(P, [xin - o * dx * 0.55, (yb + ytn) / 2], 'Perré 3/2', { ht: 1.8, anchor: o < 0 ? 'start' : 'end', dy: 2, lay: 'note' });
      } else {                                          // culée remblayée : remblai contre le sommier, le gousset et le mur de front
        const R = C.culeeProfil(s), X = (u) => s.x + o * u;
        const bk = R.back.map((q) => [X(q[0]), ySeat + q[1]]).filter((q) => q[1] >= ytn - 1e-6);
        poly(P, [[far, yTop], [back, yTop]].concat(bk, [[X(R.uf + g.mur.e), ytn], [far, ytn]]), 'remblai');
      }
    });

    // ── tablier (vu) ──
    const i0 = P.length;
    const piece = (x0, x1) => {
      if (fam === 'poutres') {
        rect(P, x0, 0, x1, yInner, 'vuB');
        rect(P, x0 + 0.02, yInner, x1 - 0.02, -h, 'vuB');
        line(P, [x0 + 0.02, -h + sec.info.ht], [x1 - 0.02, -h + sec.info.ht], 'vuT');   // dessus du talon
      } else if (fam === 'mixte') { rect(P, x0, 0, x1, yInner, 'vuB'); rect(P, x0 + 0.2, yInner, x1 - 0.2, -h, 'acier'); }
      else {
        rect(P, x0, 0, x1, -h, 'vuB');
        if (sec.info.lc > 0) line(P, [x0, -sec.info.er], [x1, -sec.info.er], 'vuT');       // naissance des encorbellements
        if (fam === 'prp') line(P, [x0 + 0.1, -h + 0.02], [x1 - 0.1, -h + 0.02], 'acierL');
      }
    };
    if (M.cont) piece(-dab, Ltot + dab);
    else for (let i = 0; i < n; i++) piece(i === 0 ? -dab : xs[i] + 0.03, i === n - 1 ? Ltot + dab : xs[i + 1] - 0.03);
    if (fam === 'poutres' && !M.cont && S.tablier.dalleContinuite) for (let i = 1; i < n; i++) rect(P, xs[i] - 0.03, 0, xs[i] + 0.03, yInner, 'vuB');
    // corniche (bande sombre) et dispositif de retenue vus en élévation
    if (S.equip.corniches || rail) rect(P, -dab, 0.30, Ltot + dab, -Math.min(0.35, 0.4 * h), 'cornE');
    const yg = rail ? 1.40 : 1.05, stp = Math.max(2, Math.ceil(ech / 100));
    line(P, [-dab, yg], [Ltot + dab, yg], 'gc');
    for (let x = -dab; x <= Ltot + dab + 1e-6; x += stp) line(P, [x, 0.30], [x, yg], 'gcF');
    tagFrom(P, i0, 'tablier');

    // appareils d'appui et bossages
    M.lines.forEach((l) => {
      rect(P, l.x - 0.25, -h, l.x + 0.25, -h - 0.10, 'app');
      rect(P, l.x - 0.35, -h - 0.10, l.x + 0.35, ySeat, 'vuB');
    });

    // ── appuis ──
    M.supports.forEach((s) => {
      const g = s.geo, yft = ySeat - s.H, i1 = P.length;
      let xf = s.x;
      if (s.kind === 'pile') {
        let yTopFut = ySeat;
        if (g.ch) { rect(P, s.x - g.ch.b / 2, ySeat, s.x + g.ch.b / 2, ySeat - g.ch.h, 'vuB'); yTopFut = ySeat - g.ch.h; }
        const fu = g.fut;
        if (fu.kind === 'voile' && fu.e1 && Math.abs(fu.e1 - fu.e) > 0.01) poly(P, [[s.x - fu.e / 2, yTopFut], [s.x + fu.e / 2, yTopFut], [s.x + fu.e1 / 2, yft], [s.x - fu.e1 / 2, yft]], 'vuB');
        else rect(P, s.x - (fu.kind === 'voile' || fu.kind === 'vy' ? fu.e : g.lx) / 2, yTopFut, s.x + (fu.kind === 'voile' || fu.kind === 'vy' ? fu.e : g.lx) / 2, yft, fu.kind === 'colonnes' ? colLay(fu) : 'vuB');
      } else {
        const o = s.j === 0 ? -1 : 1, R = C.culeeProfil(s), X = (q) => [s.x + o * q[0], ySeat + q[1]];
        R.seen.forEach((c) => poly(P, c.pts.map(X), c.lay === 'col' ? 'col' : c.lay === 'vuB' ? 'vuB' : 'vuL'));
        R.cut.forEach((c) => poly(P, c.pts.map(X), c.lay === 'prop' ? 'prop' : 'vuB'));
        xf = s.x + o * R.uc;
        if (g.gros > 0 && s.fo.mode === 'superficielle') rect(P, xf - s.fo.B / 2 - 0.5, yft - s.fo.e - 0.10, xf + s.fo.B / 2 + 0.5, yft - s.fo.e - 0.10 - g.gros, 'prop');
      }
      // fondation (coupée, hachurée) sur béton de propreté
      const f = s.fo;
      if (f.mode === 'superficielle') {
        rect(P, xf - f.B / 2, yft, xf + f.B / 2, yft - f.e, 'beton');
        rect(P, xf - f.B / 2 - 0.10, yft - f.e, xf + f.B / 2 + 0.10, yft - f.e - 0.10, 'prop');
      } else {
        const sansMassif = f.e === 0;
        const yb = sansMassif ? (s.geo.sommier ? ySeat - s.geo.sommier.h : yft) : yft - f.e;
        if (!sansMassif) {
          rect(P, xf - f.Lx / 2, yft, xf + f.Lx / 2, yb, 'beton');
          rect(P, xf - f.Lx / 2 - 0.10, yb, xf + f.Lx / 2 + 0.10, yb - 0.10, 'prop');
        }
        for (let r = 0; r < f.nr; r++) {
          const xp = xf + (r - (f.nr - 1) / 2) * f.s;
          rect(P, xp - f.D / 2, yb - (sansMassif ? 0 : 0.10), xp + f.D / 2, yb - f.Lp, 'pieu');
        }
      }
      // axe et repère d'appui
      line(P, [s.x, 1.6 + mm(4)], [s.x, yft - (f.mode === 'pieux' ? 0 : f.e + 0.3)], 'axe');
      text(P, [s.x, 1.6 + mm(6)], s.id, { ht: 3.2, lay: 'titre', bold: true });
      tagFrom(P, i1, s.id);
    });

    // ── cotes ──
    for (let i = 0; i < n; i++) { dim(P, [xs[i], 1.6], [xs[i + 1], 1.6], 'h', 10, frn(xs[i + 1] - xs[i])); P[P.length - 1].tag = 'T' + (i + 1); }
    if (n > 1) dim(P, [0, 1.6], [Ltot, 1.6], 'h', 18, frn(Ltot));
    const xh = n > 1 ? xs[1] * 0.3 : Ltot * 0.3;
    dim(P, [xh, 0], [xh, -h], 'v', 4, frn(h));
    M.supports.filter((s) => s.kind === 'pile').forEach((s) => {
      const xd = s.x + (s.geo.ch ? s.geo.ch.b : s.geo.lx) / 2;
      dim(P, [xd, ySeat], [xd, ySeat - s.H], 'v', 5, frn(s.H));
    });
    M.supports.forEach((s) => {
      const f = s.fo, yft = ySeat - s.H;
      const lab = f.mode === 'pieux' ? f.n + ' pieux Ø' + fr(f.D, 2) + ' — L = ' + frn(f.Lp) : 'Semelle ' + fr(f.B, 2) + ' × ' + fr(f.L, 2) + ' × ' + fr(f.e, 2);
      text(P, [s.x, (f.mode === 'pieux' ? yft - (f.e || 0) - f.Lp : yft - f.e - 0.1)], lab, { ht: 2, dy: -4, lay: 'note' });
    });
    const yT = 1.6 + mm(n > 1 ? 38 : 30);
    title(P, [Ltot / 2, yT], 'COUPE LONGITUDINALE', ech);
    if (TR || (S.geo && S.geo.sondages && S.geo.sondages.length)) tracer(P, M, ZT, xL, xR, mm, ySeat, tn);
    return { P, ech, titre: 'COUPE LONGITUDINALE — échelle 1/' + ech, abs: !!TR };
  }

  /* passage en altitudes réelles (cisaillement y += Z(x)) puis habillage : cotes, PHE, gabarit, sondages, guitare */
  /* nature de sol d'après la description du log : une hachure par nature */
  const SOL_LAB = { remblai: 'Remblai', argile: 'Argile, limon', sable: 'Sable, grave', calc: 'Calcaire, tuf', schisteA: 'Schiste altéré / argileux', schiste: 'Schiste, schiste fracturé', quartz: 'Quartzite, blocs de quartzite', roche: 'Rocher' };
  function solType(desc) {
    const d = String(desc || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/remblai/.test(d)) return 'remblai';
    if (/quartzit/.test(d) && !/schiste/.test(d)) return 'quartz';
    if (/schiste/.test(d)) return /alter|argil|alternance/.test(d) ? 'schisteA' : 'schiste';
    if (/argil|limon|marne/.test(d)) return 'argile';
    if (/sable|grave|gravier/.test(d)) return 'sable';
    if (/calcai|tuf/.test(d)) return 'calc';
    return 'roche';
  }
  function tracer(P, M, ZT, xL, xR, mm, ySeat, tn) {
    const TR = M.trace, S = M.S, t = S.trace, f2 = (v) => fr(v, 2);
    if (TR) {
      const sh = (q) => [q[0], q[1] + ZT(q[0])];
      P.forEach((p) => {
        if (p.k === 'poly') p.pts = p.pts.map(sh);
        else if (p.k === 'dim' || p.k === 'brk') { p.a = sh(p.a); p.b = sh(p.b); }
        else if (p.k === 'text' || p.k === 'title') p.p = sh(p.p);
      });
    }
    let yMin = Infinity;
    P.forEach((p) => { if (p.k === 'poly' && p.lay !== 'sol') p.pts.forEach((q) => { if (q[1] < yMin) yMin = q[1]; }); });
    const ob = t.obstacle, i0 = P.length;
    if (TR) {
      // cotes d'appui et d'arase des fondations
      TR.sup.forEach((s, k) => {
        const sp = M.supports[k];
        text(P, [sp.x + 0.5, s.zSeat - 0.05], 'Z = ' + f2(s.zSeat), { ht: 1.7, anchor: 'start', dy: -2.2, lay: 'note' });
        const yf = s.zSeat - sp.H;
        text(P, [sp.x + 0.5, yf], 'Z = ' + f2(yf), { ht: 1.7, anchor: 'start', dy: 0.8, lay: 'note' });
      });
      if (ob.type === 'oued') {
        if (ob.phe) { line(P, [xL, ob.phe], [xR, ob.phe], 'eau'); text(P, [xL + 1, ob.phe], 'PHE = ' + f2(ob.phe), { ht: 1.9, anchor: 'start', dy: 3.2, lay: 'note' }); }
        if (ob.zFond && ob.aff > 0) { const za = ob.zFond - ob.aff; line(P, [xL + 8, za], [xR - 8, za], 'aff'); text(P, [xR - 8, za], 'Limite des affouillements ' + f2(za), { ht: 1.8, anchor: 'end', dy: 0.8, lay: 'note' }); }
      } else if ((ob.type === 'voie' || ob.type === 'route') && ob.pk && ob.zVoie) {
        const x = ob.pk - t.pk0, rail = ob.type === 'voie';
        rect(P, x - (rail ? 1.5 : 3.5), ob.zVoie, x + (rail ? 1.5 : 3.5), ob.zVoie - (rail ? 0.55 : 0.3), rail ? 'ballast' : 'rev');
        line(P, [x, ob.zVoie - 1], [x, ob.zVoie + Math.max(ob.gabarit, 1) + 0.5], 'axe');
        if (ob.gabarit > 0) dim(P, [x + 2, ob.zVoie], [x + 2, ob.zVoie + ob.gabarit], 'v', 2, 'gabarit ' + f2(ob.gabarit));
        text(P, [x, ob.zVoie - (rail ? 0.55 : 0.3)], (ob.nom || (rail ? 'Voie ferrée' : 'Route')) + ' — Z = ' + f2(ob.zVoie), { ht: 1.8, dy: -3, lay: 'note' });
      }
    }
    // sondages
    const SD = (S.geo && S.geo.sondages || []).filter((d) => Number.isFinite(+d.pk) && d.pk !== null && d.pk !== '' && Number.isFinite(+d.z) && +d.z !== 0);
    const usedSol = new Set();
    const tnAtX = (x) => { if (!tn || !tn.length) return 0; if (x <= tn[0][0]) return tn[0][1]; for (let i = 0; i < tn.length - 1; i++) if (x <= tn[i + 1][0]) { const a = tn[i], b = tn[i + 1]; return a[1] + (b[1] - a[1]) * (x - a[0]) / Math.max(1e-9, b[0] - a[0]); } return tn[tn.length - 1][1]; };
    SD.forEach((d) => {
      let x = (+d.pk) - (TR ? t.pk0 : 0);
      { // sondage au droit d'un appui : dessiné à côté, vers l'intérieur de l'ouvrage (repère d'implantation conservé)
        const sp = M.supports.find((q) => Math.abs(q.x - x) < 3 + (q.fo && (q.fo.B || q.fo.Lx) ? (q.fo.B || q.fo.Lx) / 2 : 0));
        if (sp) { const sg = sp.j === 0 ? 1 : sp.kind === 'culee' ? -1 : 1, x0 = x; x = sp.x + sg * (((sp.fo && (sp.fo.B || sp.fo.Lx)) || 3) / 2 + mm(16)); line(P, [x0, tnAtX(x0)], [x, tnAtX(x)], 'lead'); }
      }
      const zN = +d.z, fin = +d.fin || Math.max(1, ...(d.lithologie || []).map((c) => +c.z || 0)), w = mm(4);
      // sans tracé : la tête du sondage est calée sur le terrain dessiné, les cotes NGM restent celles du sondage
      const dz = TR ? 0 : tnAtX(x) - zN, zt = zN + dz, fz = (z) => f2(z - dz);
      const L = (d.lithologie || []).slice().sort((a, b) => a.z - b.z);
      if (!L.length) rect(P, x - w / 2, zt, x + w / 2, zt - fin, 'sond');
      const fd = (v) => fr(v, 2);   // profondeur depuis la tête du sondage
      text(P, [x - w / 2 - mm(0.8), zt], '0,00', { ht: 1.4, anchor: 'end', dy: -0.5, lay: 'note' });
      L.forEach((c, k) => {
        const z1 = zt - c.z, z2 = zt - (k + 1 < L.length ? L[k + 1].z : fin), sol = solType(c.desc);
        rect(P, x - w / 2, z1, x + w / 2, z2, 'sol_' + sol); usedSol.add(sol);   // même hachure pour un même sol
        if (k) line(P, [x - w / 2, z1], [x + w / 2 + mm(1.5), z1], 'note');
        text(P, [x + w / 2 + mm(1.2), (z1 + z2) / 2], String(c.desc || '').slice(0, 34), { ht: 1.5, anchor: 'start', dy: -0.5, lay: 'note' });
        if (k) text(P, [x - w / 2 - mm(0.8), z1], fd(c.z), { ht: 1.4, anchor: 'end', dy: -0.5, lay: 'note' });
      });
      text(P, [x - w / 2 - mm(0.8), zt - fin], fd(fin), { ht: 1.4, anchor: 'end', dy: -0.5, lay: 'note' });
      // essais pressiométriques : pl* et EM (MPa) à chaque profondeur d'essai, cotés à gauche du sondage
      (d.essais || []).forEach((e) => { const ze = zt - e.z; line(P, [x - w / 2, ze], [x - w / 2 - mm(1), ze], 'note'); text(P, [x - w / 2 - mm(8), ze], (e.sup ? '>' : '') + fr(e.pl, 2) + ' / ' + fr(+e.em || +e.EM || 0, 1), { ht: 1.5, anchor: 'end', dy: -0.45, lay: 'note' }); });
      if ((d.essais || []).length) text(P, [x - w / 2 - mm(8), zt], 'pl (MPa) / EM (MPa)', { ht: 1.5, anchor: 'end', dy: 1.6, lay: 'note' });
      text(P, [x, zt], 'Z = ' + f2(zN), { ht: 1.4, dy: 5.2, lay: 'note' });
      if (+d.nappe > 0) { const zn = zt - d.nappe; poly(P, [[x - mm(1.6), zn + mm(1.4)], [x + mm(1.6), zn + mm(1.4)], [x, zn]], 'eauF'); }
      text(P, [x, zt], d.sondage || 'S', { ht: 2.2, dy: 2, lay: 'titre', bold: true });
      yMin = Math.min(yMin, zt - fin);
    });
    if (false && usedSol.size) {   // légende des sols — non portée sur les plans de ponts (KLE) (une hachure par nature de sol)
      const lx = xL + mm(4); let ly = Math.min(yMin, ...(tn || [[0, 0]]).map((q) => q[1])) - mm(12);
      text(P, [lx, ly + mm(5)], 'LÉGENDE DES SOLS', { ht: 2, anchor: 'start', lay: 'note', bold: true });
      [...usedSol].forEach((sl, i) => { const yy = ly - i * mm(6); rect(P, lx, yy, lx + mm(8), yy - mm(4), 'sol_' + sl); text(P, [lx + mm(10), yy - mm(2)], SOL_LAB[sl], { ht: 1.8, anchor: 'start', dy: -0.6, lay: 'note' }); });
      yMin = Math.min(yMin, ly - usedSol.size * mm(6));
    }
    if (!TR) return;
    // guitare (profil en long)
    const rh = mm(7), xg = xL - mm(48), y0 = yMin - mm(9);
    const rows = [['Abscisses (PK)', (s) => f2(s.pk)], ['Altitudes projet (LR)', (s) => f2(s.LR)], ['Altitudes TN', (s) => (s.TN == null ? '—' : f2(s.TN))], ['Arase des fondations', (s) => f2(s.zSeat - M.supports[s.j].H)]];
    const nr = rows.length + 1;
    for (let r = 0; r <= nr; r++) line(P, [xg, y0 - r * rh], [xR, y0 - r * rh], 'guit');
    line(P, [xg, y0], [xg, y0 - nr * rh], 'guit'); line(P, [xL, y0], [xL, y0 - nr * rh], 'guit'); line(P, [xR, y0], [xR, y0 - nr * rh], 'guit');
    rows.forEach(([lab, fn], r) => {
      const yr = y0 - (r + 0.5) * rh;
      text(P, [xg + mm(2), yr], lab, { ht: 2, anchor: 'start', dy: -0.7, lay: 'note' });
      TR.sup.forEach((s, k) => text(P, [M.supports[k].x, yr], fn(s), { ht: 1.9, dy: -0.7, lay: 'note' }));
    });
    TR.sup.forEach((s, k) => line(P, [M.supports[k].x, y0], [M.supports[k].x, y0 - rows.length * rh], 'guitF'));
    const yp = y0 - (rows.length + 0.5) * rh;
    text(P, [xg + mm(2), yp], 'Pentes et rampes', { ht: 2, anchor: 'start', dy: -0.7, lay: 'note' });
    const pct = (v) => (v > 0 ? '+' : '') + fr(v, 2) + ' %';
    const Ltot = M.Ltot;
    if (t.Rv > 0 && Math.abs(t.p2 - t.p1) > 1e-9) {
      const T_ = t.Rv * Math.abs(t.p2 - t.p1) / 200, xs_ = t.pkS - t.pk0;
      text(P, [Math.max(xL + 4, (xL + xs_ - T_) / 2), yp], 'p = ' + pct(t.p1), { ht: 1.9, dy: -0.7, lay: 'note' });
      text(P, [xs_, yp], 'R = ' + fr(t.Rv, 0) + ' m', { ht: 1.9, dy: -0.7, lay: 'note' });
      text(P, [Math.min(xR - 4, (xs_ + T_ + xR) / 2), yp], 'p = ' + pct(t.p2), { ht: 1.9, dy: -0.7, lay: 'note' });
    } else text(P, [Ltot / 2, yp], 'p = ' + pct(t.p1) + '  ·  L = ' + fr(xR - xL, 2) + ' m', { ht: 1.9, dy: -0.7, lay: 'note' });
    tagFrom(P, i0, 'trace');
  }

  /* ───────── Vue en plan ───────── */
  function planScene(M, o) {
    const P = [], S = M.S, t = S.trace, TR = M.trace, n = M.xs.length - 1, xs = M.xs, Ltot = M.Ltot, W = M.W, dab = M.dab;
    const ech = (o && o.ech) || pickScale(Ltot + 2 * dab + 30, 420, [100, 150, 200, 250, 500, 1000, 2000]);
    const mm = (v) => v * ech / 1000;
    const g2r = (g) => g * Math.PI / 200;
    // repère local : axe au départ selon +x ; courbure éventuelle de rayon R (R > 0 : virage à droite)
    const R = TR ? t.R : 0;
    const ax = (s) => {                                   // point d'axe et tangente à l'abscisse curviligne s depuis C0
      if (!R) return { p: [s, 0], u: [1, 0] };
      const ph = s / R;
      return { p: [R * Math.sin(ph), -R * (1 - Math.cos(ph))], u: [Math.cos(ph), -Math.sin(ph)] };
    };
    const at = (s, d) => { const a = ax(s); return [a.p[0] - a.u[1] * d, a.p[1] + a.u[0] * d]; };   // d > 0 : à gauche
    const beta = g2r(S.biais);
    const band = (s0, s1, d0, d1, lay) => {
      const k = Math.max(2, Math.ceil(Math.abs(s1 - s0) / 2)), A = [], B = [];
      for (let i = 0; i <= k; i++) { const s = s0 + (s1 - s0) * i / k; A.push(at(s, d0)); B.push(at(s, d1)); }
      poly(P, A.concat(B.reverse()), lay);
    };
    // ligne d'appui (biaise) passant par l'axe en s, demi-longueur l
    const supLine = (s, l) => { const a = ax(s), c = Math.cos(beta), sn = Math.sin(beta); const d = [a.u[0] * c - a.u[1] * sn, a.u[1] * c + a.u[0] * sn]; return [[a.p[0] - d[0] * l, a.p[1] - d[1] * l], [a.p[0] + d[0] * l, a.p[1] + d[1] * l], d, a]; };
    // obstacle
    const ob = t.obstacle;
    if (ob.type === 'oued') {
      let s0 = n > 1 ? xs[1] - 3 : 2, s1 = n > 1 ? xs[n - 1] + 3 : xs[n] - 2;
      if (TR && TR.hasTN && ob.phe) {                  // lit mouillé : TN sous les PHE
        const wet = []; for (let k = 0; k <= 200; k++) { const x = -dab + (Ltot + 2 * dab) * k / 200; if (C.tnAt(t, t.pk0 + x) < ob.phe) wet.push(x); }
        if (wet.length) { s0 = wet[0]; s1 = wet[wet.length - 1]; }
      }
      const hl = W / 2 / Math.max(0.3, Math.sin(beta)) + 6;
      const [a0, b0] = supLine(s0, hl), [a1, b1] = supLine(s1, hl);
      poly(P, [a0, b0, b1, a1], 'eauP');
      const [, , , am] = supLine((s0 + s1) / 2, 0);
      text(P, [am.p[0], am.p[1] - W / 2 - mm(9)], ob.nom || 'Oued', { ht: 2.4, lay: 'note' });
    } else if (ob.type === 'voie' || ob.type === 'route') {
      const s = (ob.pk || t.pk0 + Ltot / 2) - t.pk0, hl = W / 2 / Math.max(0.3, Math.sin(beta)) + 6;
      const [a, b, d] = supLine(s, hl), nrm = [-d[1], d[0]], e = ob.type === 'voie' ? 2.2 : 4;
      poly(P, [[a[0] - nrm[0] * e, a[1] - nrm[1] * e], [b[0] - nrm[0] * e, b[1] - nrm[1] * e], [b[0] + nrm[0] * e, b[1] + nrm[1] * e], [a[0] + nrm[0] * e, a[1] + nrm[1] * e]], ob.type === 'voie' ? 'ballastP' : 'routeP');
      line(P, a, b, 'axe');
      text(P, [b[0], b[1]], ob.nom || (ob.type === 'voie' ? 'Voie ferrée' : 'Route'), { ht: 2.2, anchor: 'start', dy: 1, lay: 'note' });
    }
    // tablier
    const i0 = P.length;
    band(-dab, Ltot + dab, -W / 2, W / 2, 'vuL');
    const tg = S.usage === 'rail' ? 0 : S.profil.trottoirG, td = S.usage === 'rail' ? 0 : S.profil.trottoirD;
    if (tg > 0) { const A = [], k = 40; for (let i = 0; i <= k; i++) A.push(at(-dab + (Ltot + 2 * dab) * i / k, W / 2 - tg)); poly(P, A, 'vuT', false); }
    if (td > 0) { const A = [], k = 40; for (let i = 0; i <= k; i++) A.push(at(-dab + (Ltot + 2 * dab) * i / k, -W / 2 + td)); poly(P, A, 'vuT', false); }
    { const A = [], k = 40; for (let i = 0; i <= k; i++) A.push(at(-dab - 10 + (Ltot + 2 * dab + 20) * i / k, 0)); poly(P, A, 'axe', false); }
    if (M.sec.jumeaux) [-1, 1].forEach((sg) => { const A = [], k = 40; for (let i = 0; i <= k; i++) A.push(at(-dab + (Ltot + 2 * dab) * i / k, sg * Math.max(M.sec.joint / 2, 0.05))); poly(P, A, 'vuT', false); });   // joint longitudinal entre tabliers jumelés
    tagFrom(P, i0, 'tablier');
    // appuis
    M.supports.forEach((sp) => {
      const i1 = P.length, hl = W / 2 / Math.max(0.3, Math.sin(beta));
      const [a, b, d, A] = supLine(sp.x, hl + 1.5);
      line(P, a, b, 'axe');
      text(P, [b[0] + d[0] * 1.2, b[1] + d[1] * 1.2], sp.id, { ht: 3, lay: 'titre', bold: true, dy: -1 });
      const f = sp.fo, g = sp.geo;
      // emprise de la fondation (parallélogramme biais)
      const isC = sp.kind === 'culee', o = sp.j === 0 ? -1 : 1;
      const RC = isC ? C.culeeProfil(sp) : null, xf = isC ? sp.x + o * RC.uc : sp.x;
      const B = f.mode === 'pieux' ? (f.Lx || f.B || 2) : f.B, L = f.mode === 'pieux' ? (f.Ly || f.L || W) : f.L;
      const c = ax(xf).p, u = ax(xf).u, ds = supLine(xf, 1)[2];
      const hb = B / 2 / Math.max(0.3, Math.sin(beta)), hL = L / 2;
      const cys = f.split ? f.split.centers : [0];
      cys.forEach((cy) => { const cc = [c[0] + ds[0] * cy, c[1] + ds[1] * cy]; if (B > 0 && L > 0) poly(P, [[cc[0] - u[0] * hb - ds[0] * hL, cc[1] - u[1] * hb - ds[1] * hL], [cc[0] + u[0] * hb - ds[0] * hL, cc[1] + u[1] * hb - ds[1] * hL], [cc[0] + u[0] * hb + ds[0] * hL, cc[1] + u[1] * hb + ds[1] * hL], [cc[0] - u[0] * hb + ds[0] * hL, cc[1] - u[1] * hb + ds[1] * hL]], 'vu'); });
      if (f.mode === 'pieux') for (const cy of cys) for (let r = 0; r < f.nr; r++) for (let m = 0; m < f.m; m++) {
        const ex = (r - (f.nr - 1) / 2) * f.s, ey = cy + (f.ys ? f.ys[m] : (m - (f.m - 1) / 2) * (f.sy || f.s));
        circ(P, c[0] + u[0] * ex / Math.max(0.3, Math.sin(beta)) + ds[0] * ey, c[1] + u[1] * ex / Math.max(0.3, Math.sin(beta)) + ds[1] * ey, f.D / 2, 'vu');
      }
      if (isC && g.retours) {                          // murs en retour
        const md = g.retours.mode, u0 = md === 'U' ? RC.uf : md === 'AV' ? RC.ub - g.sommier.b : RC.ub, u1 = md === 'U' ? RC.uE : md === 'AV' ? RC.ub : RC.ub + g.retours.L, Lw = md === 'U' ? W : (g.sommier.L || W);
        if (md !== 'aucun') [-1, 1].forEach((sd) => { const p0 = at(sp.x + o * u0, sd * (Lw / 2 - g.retours.e / 2)), p1 = at(sp.x + o * u1, sd * (Lw / 2 - g.retours.e / 2)); line(P, p0, p1, 'beton'); });
        if (g.mur) { const a = at(sp.x + o * RC.uf, -W / 2), b = at(sp.x + o * RC.uf, W / 2); line(P, a, b, 'beton'); }
      }
      if (TR && TR.coords) {
        const s = TR.sup[sp.j];
        text(P, [A.p[0] - d[0] * (hl + 2), A.p[1] - d[1] * (hl + 2)], 'X = ' + fr(s.X, 3), { ht: 1.7, anchor: 'start', dy: -1, lay: 'note' });
        text(P, [A.p[0] - d[0] * (hl + 2), A.p[1] - d[1] * (hl + 2)], 'Y = ' + fr(s.Y, 3), { ht: 1.7, anchor: 'start', dy: -3.4, lay: 'note' });
      }
      tagFrom(P, i1, sp.id);
    });
    // cotes, biais, directions
    let yTop = -Infinity; for (let k = 0; k <= 40; k++) yTop = Math.max(yTop, at(-dab + (Ltot + 2 * dab) * k / 40, W / 2)[1]);
    const dp = (x) => [ax(x).p[0], yTop + 3];                 // cotes projetées sur une ligne de rappel commune
    for (let i = 0; i < n; i++) dim(P, dp(xs[i]), dp(xs[i + 1]), 'h', 4, fr(xs[i + 1] - xs[i], 2));
    if (n > 1) dim(P, dp(0), dp(Ltot), 'h', 11, fr(Ltot, 2));
    if (S.biais < 99.9) { const [a] = supLine(0, W / 2 + 4); text(P, a, 'biais ' + fr(S.biais, 1) + ' gr', { ht: 2.2, anchor: 'end', dy: -3.5, lay: 'note' }); }
    if (t.versG) text(P, at(-dab - 10, 0), '← ' + t.versG, { ht: 2.3, anchor: 'start', dy: 2.2, lay: 'note' });
    if (t.versD) text(P, at(Ltot + dab + 10, 0), t.versD + ' →', { ht: 2.3, anchor: 'end', dy: 2.2, lay: 'note' });
    if (TR && R) text(P, at(Ltot / 2, -W / 2 - 3), 'Axe en courbe R = ' + fr(Math.abs(R), 0) + ' m', { ht: 2, dy: -3, lay: 'note' });
    title(P, [ax(Ltot / 2).p[0], yTop + 3 + mm(24)], 'VUE EN PLAN', ech);
    return { P, ech, titre: 'VUE EN PLAN — échelle 1/' + ech };
  }

  /* ───────── Coupe transversale (tablier + pile) ───────── */
  function secScene(M, o) {
    o = o || {};
    const part = o.part || 'pile';
    const P = [], h = M.h, sec = M.sec, W = M.W, rail = M.S.usage === 'rail', S = M.S, fam = M.T.famille;
    const ech = o.ech || pickScale(W + 4, 190, [20, 25, 50, 75, 100, 200]);
    const mm = (v) => v * ech / 1000;
    const f2 = (v) => (Math.round(Math.abs(v) * 100 + 1e-6) / 100).toFixed(2).replace(/^0\./, '.');
    const buts = [];
    const dh = (x1, y1, x2, y2, yl, s_) => dim(P, [x1, y1], [x2, y2], 'h', ((Number.isFinite(yl) ? yl : Math.max(y1, y2)) - Math.max(y1, y2)) * 1000 / ech, s_ || frn(Math.abs(x2 - x1)));
    // dévers en toit (2,5 % de part et d'autre de l'axe / du joint) — comme les coupes des plans KLE :
    // hourdis et superstructures suivent la pente, chaque poutre est abaissée de p·|x| (talon horizontal, table inclinée)
    const pv = rail ? 0 : 0.025, dyx = (x) => -pv * Math.abs(x);
    const ybeam = (x) => -h + dyx(x);                         // dessous du talon d'une poutre d'axe x
    const tb = fam === 'poutres' ? sec.info.eh + sec.info.etab + 0.10 : 0;
    sec.polys.forEach((pg) => {
      let pts = pg.pts;
      if (pv && pg.role === 'poutre' && fam === 'poutres') {
        const xb = (Math.min(...pts.map((q) => q[0])) + Math.max(...pts.map((q) => q[0]))) / 2;
        pts = pts.map((q) => [q[0], q[1] + (q[1] >= -tb - 1e-9 ? dyx(q[0]) : dyx(xb))]);   // table inclinée, âme et talon translatés
      }
      P.push({ k: 'poly', pts, lay: pg.mat === 'acier' ? 'acier' : 'hachD', closed: true, ds: !!pv && pg.role === 'poutre' });
    });
    if (fam === 'poutres' && sec.info.btab) {        // prédalles (.060) posées de .060 sur les tables
      const i = sec.info, bx = sec.bear;
      for (let k = 0; k < bx.length - 1; k++) {
        const xa = bx[k] + i.btab / 2, xb = bx[k + 1] - i.btab / 2;
        if (sec.jumeaux && bx[k] < 0 && bx[k + 1] > 0) continue;
        if (xb - xa > 0.1) rect(P, xa - 0.06, -i.eh, xb + 0.06, -i.eh + 0.06, 'pred');   // prédalle posée sur les tables (appui .060), dans l'épaisseur du hourdis
      }
    }
    const lc = sec.jumeaux ? (S.tablier.lcentre || 1.02) : 0;
    if (sec.jumeaux && !rail) {   // longrine au centre sur le joint
      rect(P, -lc / 2, 0, lc / 2, 0.24, 'vuB');
      rect(P, -0.29, 0.03, 0.29, 0.21, 'equip');
      line(P, [0, 0.24], [0, -h - 0.2], 'note');
    }
    tagFrom(P, 0, 'tablier');
    if (fam === 'poutres' && part !== 'tablier') {   // entretoise d'about vue (coupes sur appuis seulement)
      const i = sec.info;
      for (let k = 0; k < sec.bear.length - 1; k++) {
        if (sec.jumeaux && sec.bear[k] < 0 && sec.bear[k + 1] > 0) continue;
        const xa = sec.bear[k] + i.b0 / 2, xb = sec.bear[k + 1] - i.b0 / 2;
        rect(P, xa, -i.eh - i.etab - 0.10, xb, -(h - 0.25), 'vuT');
      }
    }
    if (fam === 'mixte') {
      const a = sec.info.a, yt = -sec.info.hs - 0.15, yb = -h + 0.25;
      rect(P, -a / 2 + 0.02, yt, a / 2 - 0.02, yt - Math.max(0.4, (yt - yb) * 0.55), 'vu');
    }

    // ── superstructures ──
    const iEq = P.length;
    let top = 0;
    if (rail) {
      const ax = M.PT.axesVoies, xa = Math.min.apply(null, ax) - 2.3, xb = Math.max.apply(null, ax) + 2.3;
      const xl = Math.max(xa, -W / 2 + 0.9), xr = Math.min(xb, W / 2 - 0.9);
      if (S.equip.etancheite) line(P, [xl, 0.02], [xr, 0.02], 'etan');
      poly(P, [[xl, 0.03], [xr, 0.03], [xr - 0.9, 0.62], [xl + 0.9, 0.62]], 'ballast');
      ax.forEach((x, i) => {
        rect(P, x - 1.3, 0.40, x + 1.3, 0.62, 'vuB');
        [-0.7175, 0.7175].forEach((d) => poly(P, [[x + d - 0.075, 0.62], [x + d + 0.075, 0.62], [x + d + 0.012, 0.645], [x + d + 0.012, 0.74], [x + d + 0.035, 0.74], [x + d + 0.035, 0.79], [x + d - 0.035, 0.79], [x + d - 0.035, 0.74], [x + d - 0.012, 0.74], [x + d - 0.012, 0.645]], 'acier'));
        line(P, [x, -h - 0.2], [x, 2.0], 'axe');
        text(P, [x, 2.0], 'Voie ' + (i + 1), { ht: 2.2, dy: 1.5 });
      });
      [-1, 1].forEach((o) => {        // corniche-caniveau préfabriquée et garde-corps
        const xe = o * W / 2;
        poly(P, [[xe, 0.70], [xe - o * 0.25, 0.70], [xe - o * 0.25, 0.25], [xe - o * 0.85, 0.25], [xe - o * 0.85, 0.0], [xe, 0.0], [xe, -0.45], [xe + o * 0.05, -0.45], [xe + o * 0.05, 0.70]].map((q) => q), 'corn');
        rect(P, xe - o * 0.80, 0.05, xe - o * 0.30, 0.22, 'vuL');
        line(P, [xe - o * 0.10, 0.70], [xe - o * 0.10, 1.70], 'gc'); line(P, [xe - o * 0.10, 1.70], [xe - o * 0.45, 1.70], 'gc');
      });
      top = 2.2;
      if (ax.length > 1) for (let i = 0; i < ax.length - 1; i++) dim(P, [ax[i], 2.0], [ax[i + 1], 2.0], 'h', 4, frn(ax[i + 1] - ax[i]));
    } else {
      const tG = S.profil.trottoirG, tD = S.profil.trottoirD, w = S.profil.roulable;
      const x1 = -W / 2 + tG, x2 = x1 + w, rev = S.equip.revetement;
      // revêtement (épaisseur constante, suit le dévers) et étanchéité
      if (rev > 0) {
        const zones = lc ? [[x1, -lc / 2], [lc / 2, x2]] : [[x1, x2]];
        zones.forEach(([a, b]) => { rect(P, a, 0.005, b, rev, 'rev'); if (S.equip.etancheite) line(P, [a, 0.003], [b, 0.003], 'etan'); });
        const xr = lc ? (lc / 2 + x2) / 2 : w * 0.16;
        [-1, 1].forEach((o) => {
          if (lc) {
            leader(P, [o * xr - 0.25 * o, rev], [o * xr - o * 1.6, rev + 0.75], 'Revêtement ' + fr(rev * 100, 0) + 'cm', o < 0 ? 'start' : 'end');
            if (S.equip.etancheite) leader(P, [o * xr - 0.6 * o, 0.0], [o * xr - o * 1.6, rev + 0.45], 'Etanchéité 5mm', o < 0 ? 'start' : 'end');
          } else if (o > 0) {   // tablier unique : repères d'un seul côté
            leader(P, [xr, rev], [xr + 0.5, rev + 0.95], 'Revêtement ' + fr(rev * 100, 0) + 'cm');
            if (S.equip.etancheite) leader(P, [xr - 0.35, 0.0], [xr + 0.5, rev + 0.65], 'Etanchéité 5mm');
          }
          const xa = o * (lc ? (lc / 2 + x2) / 2 + 1.6 : o > 0 ? w * 0.36 : w * 0.30), xb = xa + o * 1.2;   // flèche de pente
          line(P, [xa, rev + 0.32], [xb, rev + 0.32 - 1.2 * pv], 'pente');
          line(P, [xb, rev + 0.32 - 1.2 * pv], [xb - o * 0.18, rev + 0.36 - 1.2 * pv], 'pente');
          text(P, [(xa + xb) / 2, rev + 0.36], '2.5%', { ht: 2.4, dy: 0.6, lay: 'note' });
        });
      }
      [-1, 1].forEach((o) => {
        const xe = o * W / 2, tw = o < 0 ? tG : tD, xin = o < 0 ? x1 : x2, hc = S.equip.corniches ? 0.25 : 0;
        // corniche préfabriquée arrondie, débordant du nu (BLE) et enveloppant la rive du hourdis — plan KLE
        const ht = 0.24, xe2 = xe;
        if (S.equip.corniches) {
          const c = [[xe2 - o * 0.23, ht]];
          for (let k = 0; k <= 14; k++) { const a = (80 - k * 170 / 14) * Math.PI / 180; c.push([xe2 + o * (0.05 + 0.27 * Math.cos(a)), -0.05 + 0.30 * Math.sin(a)]); }
          c.push([xe2, -0.35], [xe2, 0], [xe2 - o * 0.23, 0]);
          poly(P, c, 'corn');
        }
        // trottoir : bloc d'ancrage BN4 (orange hachuré), fourreaux, longrine de relevage L.R
        if (tw > 0.7) {
          const xa = xe2 - o * 0.23, xo = xe2 - o * 0.65;
          rect(P, xo, 0, xin + o * 0.12, ht, 'vuB');
          rect(P, xa, 0, xo, ht, 'orH');
          const nf = Math.max(1, Math.min(4, Math.floor((Math.abs(xin - xo) - 0.35) / 0.22)));
          for (let k = 0; k < nf; k++) circ(P, xo - o * (0.17 + k * 0.22), ht / 2, 0.065, 'four', 18);
          rect(P, xin + o * 0.12, 0, xin, ht, 'lr');
          leader(P, [xin + o * 0.03, ht * 0.7], [xin + o * 0.55, ht + 0.75], 'L.R', o < 0 ? 'start' : 'end');
        }
        const yb = tw > 0.7 ? ht : 0;
        if (S.equip.retenue === 'BN4') {               // barrière BN4 : poteau sur le bloc d'ancrage, entretoises côté chaussée
          const xb0 = xe2 - o * 0.27, xp = xe2 - o * 0.52, yt = yb + 1.0;
          poly(P, [[xb0, yb], [xp, yb], [xp, yt], [xp + o * 0.12, yt]], 'bn4');
          [0.30, 0.55, 0.80].forEach((z) => rect(P, xp, yb + z - 0.035, xp - o * 0.07, yb + z + 0.035, 'bn4'));
          rect(P, xp + o * 0.02, yt - 0.02, xp - o * 0.07, yt + 0.04, 'bn4');
          leader(P, [xp - o * 0.03, yb + 0.70], [xp - o * 0.65, yb + 1.25], 'BN4', o < 0 ? 'start' : 'end');
        } else if (S.equip.retenue === 'GBA') {
          const xp = xin - o * 0.30;
          poly(P, [[xp - 0.30, yb], [xp + 0.30, yb], [xp + 0.12, yb + 0.25], [xp + 0.08, yb + 0.80], [xp - 0.08, yb + 0.80], [xp - 0.12, yb + 0.25]], 'beton');
        }
        // garde-corps BLE (montant double) sur la corniche, tête inclinée vers l'extérieur
        [0, 0.035].forEach((d) => poly(P, [[xe2 - o * d, ht], [xe2 - o * d, ht + 1.95], [xe2 + o * (0.10 - d), ht + 2.18]], 'ble', false));
        leader(P, [xe2 - o * 0.02, ht + 1.55], [xe2 - o * 0.55, ht + 1.95], 'BLE', o < 0 ? 'start' : 'end');
      });
      top = 2.3;
    }
    // application du dévers à tout ce qui a été dessiné (sauf poutres déjà traitées)
    if (pv) {
      for (let k = 0; k < P.length; k++) {
        const q = P[k];
        if (q.k === 'poly' && !q.ds) {
          let pts = q.pts;
          if (q.closed !== false && pts.length > 2) {      // sommet ajouté sur l'axe pour que le toit se plie
            const out = [];
            pts.forEach((a, n) => { const b = pts[(n + 1) % pts.length]; out.push(a); if ((a[0] < -1e-9 && b[0] > 1e-9) || (a[0] > 1e-9 && b[0] < -1e-9)) { const t = -a[0] / (b[0] - a[0]); out.push([0, a[1] + t * (b[1] - a[1])]); } });
            pts = out;
          } else if (pts.length === 2 && ((pts[0][0] < -1e-9 && pts[1][0] > 1e-9) || (pts[0][0] > 1e-9 && pts[1][0] < -1e-9)) && Math.abs(pts[0][1] - pts[1][1]) < 1e-9) pts = [pts[0], [0, pts[0][1]], pts[1]];
          q.pts = pts.map((a) => [a[0], a[1] + (q.lay === 'axe' ? 0 : dyx(a[0]))]);
        } else if (q.k === 'text') q.p = [q.p[0], q.p[1] + dyx(q.p[0])];
      }
    }
    // cotes du tablier, disposition des plans : chaînes en tête, hauteurs, entraxes au pied des poutres
    if (!rail) {
      const tG = S.profil.trottoirG, tD = S.profil.trottoirD, w = S.profil.roulable, x1 = -W / 2 + tG, x2 = x1 + w;
      const yT = top - 0.3;
      if (lc) {
        dim(P, [-W / 2, yT], [-sec.joint / 2, yT], 'h', 9, frn(W / 2 - sec.joint / 2));
        dim(P, [-sec.joint / 2, yT], [sec.joint / 2, yT], 'h', 9, frn(sec.joint));
        dim(P, [sec.joint / 2, yT], [W / 2, yT], 'h', 9, frn(W / 2 - sec.joint / 2));
        [[-W / 2, x1], [x1, -lc / 2], [-lc / 2, lc / 2], [lc / 2, x2], [x2, W / 2]].forEach((c) => { if (c[1] - c[0] > 1e-6) dim(P, [c[0], yT], [c[1], yT], 'h', 3, frn(c[1] - c[0])); });
      } else {
        [[-W / 2, x1], [x1, x2], [x2, W / 2]].forEach((c) => { if (c[1] - c[0] > 1e-6) dim(P, [c[0], yT], [c[1], yT], 'h', 3, frn(c[1] - c[0])); });
        dim(P, [-W / 2, yT], [W / 2, yT], 'h', 9, frn(W));
      }
    } else dim(P, [-W / 2, top], [W / 2, top], 'h', 11, frn(W));
    // axe (repère X en tête)
    line(P, [0, top + mm(14)], [0, -h - 0.6], 'axe');
    { const ya = top + mm(14), d = mm(3.5); line(P, [-d * 0.7, ya + d], [d * 0.7, ya - d * 1.2], 'axeC'); line(P, [d * 0.7, ya + d], [-d * 0.7, ya - d * 1.2], 'axeC'); }
    if (fam === 'poutres' && sec.info.x0 != null) {
      const bx = sec.bear, f3 = (v) => Math.abs(v).toFixed(3).replace(/^0\./, '.');
      const yL = Math.min(...bx.map(ybeam)) - 0.15;
      // hauteurs aux rives et encombrement
      const ytr = 0.24 + dyx(W / 2), ydk = dyx(W / 2), xo = bx[bx.length - 1], yob = ybeam(xo);
      const hbE = (S.tablier.hp || sec.info.hb + 0.02) - 0.02, xt = W / 2, ytt = yob + hbE;   // hauteur de poutre au bord de table (plan : 2.28)
      if (part === 'tablier') { dim(P, [xt, ytt], [xt, yob], 'v', 8, frn(hbE)); dim(P, [-xt, ytt], [-xt, yob], 'v', -8, frn(hbE)); }
      if (!rail) { if (part !== 'culee') dim(P, [W / 2, ytr], [W / 2, ydk], 'v', 3, frn(0.24)); if (part === 'tablier') { dim(P, [-W / 2, ytr], [-W / 2, ydk], 'v', -3, frn(0.24));
        dim(P, [-W / 2, ytr], [-W / 2, yob], 'v', -14, 'ENCOMBREMENT:' + f3(ytr - yob)); } }
      // entraxes des poutres au pied (.750 / 3.000)
      const xsP = [-W / 2].concat(bx); if (sec.jumeaux) xsP.push(-sec.joint / 2, sec.joint / 2); xsP.push(W / 2); xsP.sort((a, b) => a - b);
      for (let k = 0; k < xsP.length - 1; k++) if (xsP[k + 1] - xsP[k] > 0.05) dim(P, [xsP[k], bx.includes(xsP[k]) ? ybeam(xsP[k]) : yL], [xsP[k + 1], bx.includes(xsP[k + 1]) ? ybeam(xsP[k + 1]) : yL], 'h', (yL - 0.35 - Math.max(bx.includes(xsP[k]) ? ybeam(xsP[k]) : yL, bx.includes(xsP[k + 1]) ? ybeam(xsP[k + 1]) : yL)) * 1000 / ech, f3(xsP[k + 1] - xsP[k]));
      // décrochements successifs des poutres (.075) — coupe en travée seulement
      if (pv && part === 'tablier') for (let k = 0; k < bx.length - 1; k++) {
        if (sec.jumeaux && bx[k] < 0 && bx[k + 1] > 0) continue;
        const xi = Math.abs(bx[k]) < Math.abs(bx[k + 1]) ? bx[k] : bx[k + 1], xo2 = xi === bx[k] ? bx[k + 1] : bx[k], xm = (xi + xo2) / 2 + Math.sign(xo2 - xi) * 0.9;
        dim(P, [xm, ybeam(xi)], [xm, ybeam(xo2)], 'v', 0, f3(ybeam(xi) - ybeam(xo2)));
        line(P, [xi + Math.sign(xo2 - xi) * sec.info.bt / 2, ybeam(xi)], [xm + Math.sign(xo2 - xi) * 0.15, ybeam(xi)], 'vuT');
      }
      // prédalle cotée (deuxième travée de prédalles depuis la gauche)
      if (bx.length > 2 && part === 'tablier') {
        const i = sec.info, xa = bx[1] + i.btab / 2, xb = bx[2] - i.btab / 2, yp = -i.eh + dyx((xa + xb) / 2) - 0.35;
        dim(P, [xa - 0.06, yp], [xa, yp], 'h', 0, f3(0.06)); dim(P, [xa, yp], [xb, yp], 'h', 0, f3(xb - xa)); dim(P, [xb, yp], [xb + 0.06, yp], 'h', 0, f3(0.06));
        dim(P, [xa - 0.06, yp - 0.35], [xb + 0.06, yp - 0.35], 'h', 0, f3(xb - xa + 0.12));
        dim(P, [bx[0] + i.btab / 2 + 0.3, -i.eh + 0.06 + dyx(bx[0] + i.btab / 2 + 0.3)], [bx[0] + i.btab / 2 + 0.3, -i.eh + dyx(bx[0] + i.btab / 2 + 0.3)], 'v', 0, f3(0.06));
      }
    }
    tagFrom(P, iEq, 'equip');
    const hApp = 0.06, ySeat = Math.min(...sec.bear.map(ybeam)) - (fam === 'poutres' ? 0.20 : 0.30);   // bossage + appareil : .20 sous la poutre la plus basse (plans KLE)   // arase du chevêtre / sommier (horizontale), bossages de hauteur variable
    // bossages et appareils d'appui
    if (part === 'tablier') {
      title(P, [0, top + mm(22)], o.titre || 'COUPE TRANSVERSALE COURANTE DU TABLIER', ech);
      return { P, ech, titre: 'COUPE TRANSVERSALE COURANTE — échelle 1/' + ech };
    }
    sec.bear.forEach((x) => {
      const yb = ybeam(x);
      rect(P, x - 0.25, yb, x + 0.25, yb - hApp, 'app'); rect(P, x - 0.30, yb - hApp, x + 0.30, ySeat, 'vuB');
      dim(P, [x, yb], [x, ySeat], 'v', 0, f2(yb - ySeat));               // hauteur de bossage (.20 / .28 / .35 / .43)
      if (fam === 'poutres') [-1, 1].forEach((sg) => rect(P, x + sg * 0.575 - 0.10, ySeat, x + sg * 0.575 + 0.10, ySeat + 0.10, 'vuB'));   // bossages de vérinage
    });

    // ── pile la plus haute ──
    const piles = M.supports.filter((s) => s.kind === 'pile');
    let ref = null, iP = P.length;
    {
      ref = part === 'culee' || !piles.length ? ((o.id && M.supports.find((x) => x.id === o.id && x.kind === 'culee')) || M.supports[0]) : (o.id && M.supports.find((x) => x.id === o.id)) || piles.reduce((a, b) => (b.H > a.H ? b : a));
      iP = P.length;
      let g = ref.geo;
      if (ref.kind === 'culee') {                     // ouvrage à une travée : coupe sur culée
        const so = g.sommier;
        g = {
          ch: so ? { kind: 'chevetre', L: so.L || W, h: so.h, b: so.b } : null,
          fut: g.colonnes ? { kind: 'colonnes', D: g.colonnes.D, b: g.colonnes.section === 'rect' ? g.colonnes.b : g.colonnes.D, n: g.colonnes.n, s: g.colonnes.s, pos: g.colonnes.pos, sec: g.colonnes.section, section: g.colonnes.section } : { kind: 'voile', L: W },
          nervure: g.nervure,
        };
      }
      const hch = g.ch ? g.ch.h : 0;
      const cut = ref.H - hch > 7.5;
      const Hd = cut ? hch + 5.0 : ref.H, yft = ySeat - Hd;
      const yC1 = ySeat - hch - 3.0, yC2 = yC1 - 0.5;
      let yTop = ySeat;
      if (g.ch) {
        if (g.ch.kind === 'marteau') {
          const L = g.ch.L, bf = g.ch.bf;
          poly(P, [[-L / 2, ySeat], [L / 2, ySeat], [L / 2, ySeat - g.ch.h2], [bf / 2, ySeat - g.ch.h], [-bf / 2, ySeat - g.ch.h], [-L / 2, ySeat - g.ch.h2]], 'beton');
        } else {
          const j = sec.jumeaux ? sec.joint / 2 : 0, rd = ref.kind === 'pile' ? ref.geo.redan : null;
          const halves = sec.jumeaux ? [[-g.ch.L / 2, -j], [j, g.ch.L / 2]] : [[-g.ch.L / 2, g.ch.L / 2]];
          halves.forEach(([xa, xb], q) => {
            if (rd) {   // chevêtre à redans en sous-face (plans KLE : 1.00 + .50, retraits 1.50)
              const yR = ySeat - (g.ch.h - rd.h), yB = ySeat - g.ch.h, la = sec.jumeaux || q === 0 ? rd.l : 0;
              const ra = rd.l, rb = sec.jumeaux ? rd.l : rd.l;
              poly(P, [[xa, ySeat], [xb, ySeat], [xb, yR], [xb - rb, yR], [xb - rb, yB], [xa + ra, yB], [xa + ra, yR], [xa, yR]], 'beton');
              dh(xa, yR, xa + ra, yR, yR + 0.3); dh(xb - rb, yR, xb, yR, yR + 0.3);
              if (!q) { dim(P, [xa, ySeat], [xa, yR], 'v', -6, frn(g.ch.h - rd.h)); dim(P, [xa, yR], [xa, yB], 'v', -6, frn(rd.h)); }
              void la;
            } else rect(P, xa, ySeat, xb, ySeat - g.ch.h, 'beton');
          });
          if (sec.jumeaux) dim(P, [-j, ySeat - g.ch.h], [j, ySeat - g.ch.h], 'h', 4, frn(sec.joint));
        }
        yTop = ySeat - g.ch.h;
        if (fam === 'poutres' && sec.nbPoutres >= 2) {   // butée de sécurité (et non blocage)
          const bx = sec.bear, mid = (a) => (bx[a] + bx[a + 1]) / 2, nh = Math.floor(bx.length / 2);
          const xbs = sec.jumeaux ? [mid(Math.max(0, Math.floor((nh - 1) / 2))), mid(Math.min(bx.length - 2, nh + Math.floor((nh - 1) / 2)))] : [mid(Math.floor((bx.length - 1) / 2) - (bx.length % 2 ? 0 : 0))];
          xbs.forEach((xb, q) => {   // butée 1.34, dessus parallèle au dessous des poutres (+ .375)
            const kk = bx.findIndex((v, n) => n < bx.length - 1 && v < xb && bx[n + 1] > xb);
            const xa = xb - 0.67, xc = xb + 0.67, ya = ybeam(bx[kk]) + 0.45, yc = ybeam(bx[kk + 1]) + 0.45;   // dessus : talons voisins + .45 (plan : .73 / .80)
            poly(P, [[xa, ySeat], [xc, ySeat], [xc, yc], [xa, ya]], 'butee');
            dim(P, [xa, ySeat], [xa, ya], 'v', 0, f2(ya - ySeat)); dim(P, [xc, ySeat], [xc, yc], 'v', 0, f2(yc - ySeat));
            buts.push(xa, xc);
            if (q === xbs.length - 1) { leader(P, [xb, ySeat + 0.25], [xb + 0.4, ySeat + 1.9], 'Butée de sécurité'); text(P, [xb + 0.4, ySeat + 1.9], '(et non blocage)', { ht: 2.6, anchor: 'start', dy: -3.4, lay: 'note' }); }
          });
        }
        dim(P, [g.ch.L / 2, ySeat], [g.ch.L / 2, ySeat - g.ch.h], 'v', 6, frn(g.ch.h));
        if (ref.kind === 'culee') { dim(P, [-W / 2, ySeat - g.ch.h], [-W / 2, ySeat], 'v', -6, frn(g.ch.h));
          dim(P, [-W / 2, dyx(W / 2)], [-W / 2, ySeat], 'v', -6, f2(dyx(W / 2) - ySeat)); dim(P, [W / 2, dyx(W / 2)], [W / 2, ySeat], 'v', 6, f2(dyx(W / 2) - ySeat));
          dim(P, [0.05, 0], [0.05, ySeat], 'v', 0, f2(-ySeat)); }
        if (fam === 'poutres') {   // chaînes de cotes sur l'arase : vérinage / butées, puis axes des poutres
          const j = sec.jumeaux ? sec.joint / 2 : 0, bx = sec.bear, fc = (v) => (Math.abs(Math.abs(v) - 0.575) < 1e-6 ? '.575' : f2(v));
          (sec.jumeaux ? [[-g.ch.L / 2, -j], [j, g.ch.L / 2]] : [[-g.ch.L / 2, g.ch.L / 2]]).forEach(([xa, xb]) => {
            const ax = bx.filter((x) => x > xa && x < xb);
            let r1 = []; ax.forEach((x) => r1.push(x - 0.575, x, x + 0.575)); r1 = r1.concat(buts.filter((x) => x > xa && x < xb)).filter((x) => x > xa + 0.01 && x < xb - 0.01).sort((a, b) => a - b);
            for (let k = 0; k < r1.length - 1; k++) if (r1[k + 1] - r1[k] > 0.05) dh(r1[k], ySeat, r1[k + 1], ySeat, ySeat - 0.22, fc(r1[k + 1] - r1[k]));
            const r2 = [xa].concat(ax, [xb]);
            for (let k = 0; k < r2.length - 1; k++) dh(r2[k], ySeat, r2[k + 1], ySeat, ySeat - 0.45, f2(r2[k + 1] - r2[k]));
          });
        }
      }
      const futRect = (x0, x1, lay) => {
        if (!cut) return rect(P, x0, yTop, x1, yft, lay);
        rect(P, x0, yTop, x1, yC1, lay); rect(P, x0, yC2, x1, yft, lay);
        P.push({ k: 'brk', a: [x0 - 0.15, yC1], b: [x1 + 0.15, yC1] }, { k: 'brk', a: [x0 - 0.15, yC2], b: [x1 + 0.15, yC2] });
      };
      /* fût à fruit : largeur wt en tête, wb en pied (interpolée de part et d'autre d'une coupure) */
      const futTrap = (xc, wt, wb, lay) => {
        if (Math.abs(wt - wb) < 1e-6) return futRect(xc - wt / 2, xc + wt / 2, lay);
        const H0 = yTop - yft, w = (y) => wb + (wt - wb) * (y - yft) / Math.max(1e-6, H0);
        const seg = (ya, yb) => poly(P, [[xc - w(ya) / 2, ya], [xc + w(ya) / 2, ya], [xc + w(yb) / 2, yb], [xc - w(yb) / 2, yb]], lay);
        if (!cut) return seg(yTop, yft);
        seg(yTop, yC1); seg(yC2, yft);
        P.push({ k: 'brk', a: [xc - wt / 2 - 0.15, yC1], b: [xc + wt / 2 + 0.15, yC1] }, { k: 'brk', a: [xc - wb / 2 - 0.15, yC2], b: [xc + wb / 2 + 0.15, yC2] });
      };
      let xcols = [];
      if (g.fut.kind === 'voile') (g.fut.xl || [0]).forEach((xc) => futTrap(xc, g.fut.L, g.fut.Lb || g.fut.L, 'vuB'));
      else if (g.fut.kind === 'marteau') futTrap(0, g.fut.b, g.fut.bb || g.fut.b, 'vuB');
      else if (g.fut.kind === 'vy') {
        const f_ = g.fut, yT = yTop, yB = ySeat - ref.H, a = f_.Lt / 2, b = f_.Lb / 2, w = f_.bw, yN = yT - f_.hn;
        const yS = f_.form === 'Y' ? yN : yB, kx = (y) => b + (a - b) * (y - yB) / (yT - yB);
        if (f_.form === 'Y') { const yA = yN + Math.min(0.8 * w, (yT - yN) * 0.4); poly(P, [[-b, yB], [b, yB], [b, yN], [a, yT], [a - w, yT], [0, yA], [-(a - w), yT], [-a, yT], [-b, yN]], 'vuB'); dim(P, [b, yB], [b, yN], 'v', 4, frn(yN - yB)); }
        else poly(P, [[-b, yB], [b, yB], [a, yT], [a - w, yT], [0, yN], [-(a - w), yT], [-a, yT]], 'vuB');
        dim(P, [-a, yT], [-(a - w), yT], 'h', 3, frn(w)); dim(P, [-b, yB], [b, yB], 'h', -3, frn(f_.Lb));
        void yS; void kx;
      }
      else {
        if (g.nervure) { const nv = g.nervure; rect(P, -nv.L / 2, yft + nv.h, nv.L / 2, yft, 'beton'); dim(P, [nv.L / 2, yft], [nv.L / 2, yft + nv.h], 'v', 4, frn(nv.h)); }
        const yfc = g.nervure ? yft + g.nervure.h : yft, yf0 = yft;
        colPos(g.fut).forEach((x) => {
          const lay = colLay(g.fut), w = (g.fut.b || g.fut.D) / 2;
          xcols.push(x);
          if (g.nervure) rect(P, x - w, yTop, x + w, yfc, lay); else futRect(x - w, x + w, lay);
        });
        void yf0;
      }
      if (xcols.length && ref.kind === 'pile' && sec.jumeaux && g.fut.paires) {
        // disposition des plans KLE : chaîne bord / faces extérieures des fûts / joint, largeur de chaque demi-chevêtre
        const wf = (g.fut.b || g.fut.D), j = sec.joint / 2, Lc = g.ch.L, yd = yTop - 0.35;
        [[-Lc / 2, -j], [j, Lc / 2]].forEach(([xa, xb]) => {
          const cs = xcols.filter((x) => x > xa && x < xb), f0 = Math.min(...cs) - wf / 2, f1 = Math.max(...cs) + wf / 2;
          dh(xa, yTop, f0, yTop, yd); dh(f0, yTop, f1, yTop, yd); dh(f1, yTop, xb, yTop, yd);
          dh(xa, yTop, xb, yTop, yd - 0.6, frn(xb - xa));
          const xm = (f0 + f1) / 2; line(P, [xm, ySeat + 2.8], [xm, yft - (ref.fo.e || 1.5) - 0.8], 'axeC');
          cs.forEach((x) => dh(x - wf / 2, yft, x + wf / 2, yft, yft + 0.8));
          if (cs.length >= 2) dh(cs[0] + wf / 2, yTop - 3.6, cs[1] - wf / 2, yTop - 3.6, yTop - 3.6);
        });
        line(P, [0, ySeat + 0.3], [0, yTop - 2.0], 'axeC'); line(P, [0, yTop - 5.5], [0, yft - 2.5], 'axeC');
        leader(P, [-Lc / 2 + 0.25, ySeat - 0.8], [-Lc / 2 - 0.9, ySeat - 1.6], 'Bossages :', 'end');
        text(P, [-Lc / 2 - 2.4, ySeat - 1.6], 'Voir dimensions', { ht: 2.6, anchor: 'start', dy: -3.4, lay: 'note' });
        text(P, [-Lc / 2 - 2.4, ySeat - 1.6], 'sur plan des', { ht: 2.6, anchor: 'start', dy: -6.8, lay: 'note' });
        text(P, [-Lc / 2 - 2.4, ySeat - 1.6], 'equipements', { ht: 2.6, anchor: 'start', dy: -10.2, lay: 'note' });
      } else if (xcols.length && sec.jumeaux) {
        const wf = (g.fut.b || g.fut.D), j = sec.joint / 2, Lc = g.ch.L, yd = yTop - 0.35;
        [[-Lc / 2, -j], [j, Lc / 2]].forEach(([xa, xb]) => {
          const cs = xcols.filter((x) => x > xa && x < xb), r = [xa].concat(cs, [xb]);
          for (let k = 0; k < r.length - 1; k++) dh(r[k], yTop, r[k + 1], yTop, yd);
          dh(xa, yTop, xb, yTop, yd - 0.9, frn(xb - xa));
          cs.forEach((x) => { dh(x - wf / 2, yTop - 2.6, x + wf / 2, yTop - 2.6, yTop - 2.6); line(P, [x, yTop], [x, yft], 'axeC'); });
        });
        dim(P, [Lc / 2, yTop], [Lc / 2, yft], 'v', 6, frn(yTop - yft)); dim(P, [-Lc / 2, yTop], [-Lc / 2, yft], 'v', -6, frn(yTop - yft));
      } else if (xcols.length) {
        const Lc = g.ch.L, ch = [-Lc / 2].concat(xcols, [Lc / 2]);
        for (let k = 0; k < ch.length - 1; k++) dim(P, [ch[k], yTop], [ch[k + 1], yTop], 'h', -5, frn(ch[k + 1] - ch[k]));
        const xc = xcols[xcols.length - 1];
        dim(P, [xc - (g.fut.b || g.fut.D) / 2, yTop - 1.6], [xc + (g.fut.b || g.fut.D) / 2, yTop - 1.6], 'h', 2, colLab(g.fut));
      }
      if (xcols.length && ref.geo.rain > 0) {   // rainures des fûts (5 cm × 3 cm) tous les 1,00 m
        const wf = (g.fut.b || g.fut.D);
        for (let y = yTop - ref.geo.rain; y > yft + 0.4; y -= ref.geo.rain) xcols.forEach((x) => { line(P, [x - wf / 2, y], [x + wf / 2, y], 'rain'); line(P, [x - wf / 2, y - 0.05], [x + wf / 2, y - 0.05], 'rain'); });
      }
      if (ref.kind === 'culee' && ref.geo.type === 'remblayee') {   // barbacanes Ø100 tous les 1,50 m au-dessus du terrain
        const yb = yft + 1.1, nB = Math.max(2, Math.floor((W - 1) / 1.5) + 1);
        for (let i = 0; i < nB; i++) circ(P, -(nB - 1) * 0.75 + i * 1.5, yb, 0.05, 'vu', 10);
        text(P, [0, yb], 'barbacanes Ø100 tous les 1,50 m', { ht: 1.8, dy: 3, lay: 'note' });
      }
      const f = ref.fo;
      const ytn = yft + 0.6, half = Math.max(W / 2, (f.mode === 'pieux' ? f.Ly : f.L) / 2 + (f.split ? Math.max(...f.split.centers.map(Math.abs)) : 0)) + 1.5;
      let yLow;
      if (f.mode === 'superficielle' && ref.kind === 'culee' && sec.jumeaux && !f.split) {
        // semelle filante coupée au joint, gros béton (débord .50) — plan C4
        const j = sec.joint / 2, Lh = f.L / 2;
        rect(P, -Lh, yft, -j, yft - f.e, 'beton'); rect(P, j, yft, Lh, yft - f.e, 'beton');
        dim(P, [-j, yft - f.e / 2], [j, yft - f.e / 2], 'h', 0, frn(sec.joint));
        dim(P, [Lh, yft], [Lh, yft - f.e], 'v', 6, frn(f.e)); dim(P, [-Lh, yft], [-Lh, yft - f.e], 'v', -6, frn(f.e));
        yLow = yft - f.e;
        const gb = ref.geo.gros || 0;
        if (gb > 0) {
          const yg = yft - f.e;
          rect(P, -Lh - 0.5, yg, Lh + 0.5, yg - gb, 'gros');
          [-1, 1].forEach((sg) => text(P, [sg * Lh / 2, yg - gb * 0.55], 'GROS BETON', { ht: 2.8, lay: 'note' }));
          const yd = yg - 0.25; dh(-Lh - 0.5, yg, -Lh, yg, yd); dh(-Lh, yg, -j, yg, yd, frn(Lh - j + 0.0)); dh(j, yg, Lh, yg, yd, frn(Lh - j)); dh(Lh, yg, Lh + 0.5, yg, yd);
          dim(P, [Lh + 0.5, yg], [Lh + 0.5, yg - gb], 'v', 4, frn(gb));
          yLow = yg - gb;
        }
      } else if (f.mode === 'superficielle') {
        (f.split ? f.split.centers : [0]).forEach((c0, i) => {
          rect(P, c0 - f.L / 2, yft, c0 + f.L / 2, yft - f.e, 'beton');
          rect(P, c0 - f.L / 2 - 0.1, yft - f.e, c0 + f.L / 2 + 0.1, yft - f.e - 0.1, 'prop');
          dim(P, [c0 - f.L / 2, yft - f.e - 0.1], [c0 + f.L / 2, yft - f.e - 0.1], 'h', -6, frn(f.L));
          if (!i) dim(P, [c0 + f.L / 2, yft], [c0 + f.L / 2, yft - f.e], 'v', 6, frn(f.e));
        });
        yLow = yft - f.e - 0.1;
        if (ref.kind === 'culee' && ref.geo.gros > 0) {   // gros béton sous la semelle (débord 0,50)
          const gb = ref.geo.gros; rect(P, -f.L / 2 - 0.5, yft - f.e, f.L / 2 + 0.5, yft - f.e - gb, 'prop');
          text(P, [0, yft - f.e - gb / 2], 'GROS BÉTON', { ht: 2, lay: 'note' }); dim(P, [f.L / 2 + 0.5, yft - f.e], [f.L / 2 + 0.5, yft - f.e - gb], 'v', 6, frn(gb));
          yLow = yft - f.e - gb;
        }
      } else {
        const Lv = Math.min(f.Lp, f.e > 0 ? 4 : 4.3), cs = f.split ? f.split.centers : [0];
        if (!(f.e > 0) && ref.kind === 'culee') {
          // pieux directement sous le sommier (plan C0) : fûts cylindriques, coupure, cotes par demi-sommier
          const j = sec.jumeaux ? sec.joint / 2 : 0, Lc = g.ch ? g.ch.L : W, ys = Array.from({ length: f.m }, (_, i) => pieY(f, i)), yb = yft - Lv;
          ys.forEach((x, i) => {
            rect(P, x - f.D / 2, yft, x + f.D / 2, yb, 'col');
            line(P, [x, yft], [x, yb], 'axeC');
            const yw = yft - Lv * 0.5, d = f.D / 2;
            [1, -1].forEach((sg) => P.push({ k: 'poly', pts: Array.from({ length: 17 }, (_, n) => [x - d + n * d / 8, yw + sg * 0.11 * Math.abs(Math.sin(n * Math.PI / 8))]), lay: 'brkO', closed: false }));
            void i;
          });
          (sec.jumeaux ? [[-Lc / 2, -j], [j, Lc / 2]] : [[-Lc / 2, Lc / 2]]).forEach(([xa, xb], q) => {
            const px = ys.filter((x) => x > xa && x < xb), r = [xa].concat(px, [xb]), yd = yft - 0.35;
            for (let k = 0; k < r.length - 1; k++) dh(r[k], yft, r[k + 1], yft, yd);
            dh(xa, yft, xb, yft, yd - 0.9, frn(xb - xa));
            if (px.length > 1) dh(px[1] - f.D / 2, yft - 3.0, px[1] + f.D / 2, yft - 3.0, yft - 3.0, frn(f.D));
            void q;
          });
          dim(P, [-Lc / 2, yft], [-Lc / 2, yb], 'v', -6, 'H_PIEUX=' + fr(f.Lp, 0) + 'm'); dim(P, [Lc / 2, yft], [Lc / 2, yb], 'v', 6, 'H_PIEUX=' + frn(f.Lp) + 'm');
          line(P, [-Lc / 2, yb], [Lc / 2, yb], 'tn');
          yLow = yb;
        } else {
        cs.forEach((c0) => {
          rect(P, c0 - f.Ly / 2, yft, c0 + f.Ly / 2, yft - f.e, 'beton');
          rect(P, c0 - f.Ly / 2 - 0.1, yft - f.e, c0 + f.Ly / 2 + 0.1, yft - f.e - 0.1, 'prop');
          for (let i = 0; i < f.m; i++) {
            const x = c0 + pieY(f, i);
            rect(P, x - f.D / 2, yft - f.e - 0.1, x + f.D / 2, yft - f.e - Lv, 'pieu');
            if (Lv < f.Lp) P.push({ k: 'brk', a: [x - f.D / 2 - 0.15, yft - f.e - Lv], b: [x + f.D / 2 + 0.15, yft - f.e - Lv] });
          }
          dim(P, [c0 - f.Ly / 2, yft - f.e], [c0 + f.Ly / 2, yft - f.e], 'h', -5, frn(f.Ly));
        });
        text(P, [0, yft - f.e - Lv], (cs.length > 1 ? cs.length + ' massifs — ' + f.n + ' pieux' : f.m + ' × ' + f.nr + ' pieux') + ' Ø' + fr(f.D, 2) + ' — L = ' + frn(f.Lp) + ' m', { ht: 2.2, dy: -6, lay: 'note' });
        yLow = yft - f.e - Lv;
        }
      }
      if (ref.kind !== 'pile' && !sec.jumeaux) { poly(P, [[-half, ytn], [half, ytn], [half, yLow - 0.6], [-half, yLow - 0.6]], 'sol'); line(P, [-half, ytn], [half, ytn], 'tn'); }
      const xd = g.fut.kind === 'voile' ? Math.max(...(g.fut.xl || [0]).map(Math.abs)) + g.fut.L / 2 : (g.fut.kind === 'marteau' ? g.fut.b : g.fut.kind === 'vy' ? g.fut.Lt : 2 * Math.max(...colPos(g.fut).map(Math.abs)) + (g.fut.b || g.fut.D)) / 2;
      if (g.fut.kind === 'voile' && g.fut.n === 2) dim(P, [g.fut.xl[0] - g.fut.L / 2, yTop - 0.6], [g.fut.xl[0] + g.fut.L / 2, yTop - 0.6], 'h', -2, frn(g.fut.L));
      if (ref.H - hch > 0.05 && !(ref.kind === 'culee' && sec.jumeaux)) dim(P, [-xd, yTop], [-xd, yft], 'v', -6, frn(ref.H - hch));
      if (ref.kind === 'pile') {   // renvoi « 7m pour P1 » pour les piles de hauteur différente
        const oth = piles.filter((q) => Math.abs(q.H - ref.H) > 0.01);
        if (oth.length) [-1, 1].forEach((sg) => { const xx = sg * (xd + 3.2), yy = (yTop + yft) / 2 - 0.4; leader(P, [sg * (xd + 2.2), yy + 0.5], [xx, yy], oth.map((q) => fr(q.H - hch, 0) + 'm pour ' + q.id).join(', '), sg < 0 ? 'end' : 'start'); });
        if (sec.jumeaux) dim(P, [xd, yTop], [xd, yft], 'v', 6, frn(ref.H - hch));
      }
    }
    tagFrom(P, iP, ref.id);
    P.sort((a, b) => (a.lay === 'sol' ? -1 : 0) - (b.lay === 'sol' ? -1 : 0));
    const tt = 'COUPE TRANSVERSALE SUR ' + (ref.kind === 'pile' ? 'PILE ' : 'CULÉE ') + ref.id;
    title(P, [0, top + mm(22)], o.titre || tt, ech);
    return { P, ech, titre: tt + ' — échelle 1/' + ech, pile: ref.id };
  }

  /* ───────── Appuis : vues de détail (d'après les plans de coffrage KLE : Larache, Bata, CIMAT) ─────────
     supScenes(M, id) → { lo : coupe longitudinale à l'axe, pl : coupe en plan au niveau des fûts, top : vue en plan du chevêtre / sommier }
     Repère : x longitudinal (axe des appareils de la ligne d'appui en x = 0), y vertical (dessus de la fondation en y = 0) ou transversal en plan. */
  const PIL = 'pieuP', FSEC = 'beton';
  function fondLo(P, f, xc, isLo) {
    // fondation vue en coupe longitudinale (isLo) ou transversale : semelle / massif + pieux
    const W_ = f.mode === 'pieux' ? (isLo ? f.Lx : f.Ly) : (isLo ? f.B : f.L), e = f.mode === 'pieux' ? f.e : f.e;
    if (e > 0) { rect(P, xc - W_ / 2, 0, xc + W_ / 2, -e, 'beton'); rect(P, xc - W_ / 2 - 0.1, -e, xc + W_ / 2 + 0.1, -e - 0.1, 'prop'); }
    let yl = -e - (e > 0 ? 0.1 : 0);
    if (f.mode === 'pieux') {
      const k = isLo ? f.nr : f.m, sp = isLo ? f.s : (f.sy || f.s), Lv = Math.min(f.Lp, 4);
      for (let i = 0; i < k; i++) {
        const x = xc - (k - 1) * sp / 2 + i * sp;
        rect(P, x - f.D / 2, -e, x + f.D / 2, -e - Lv, 'pieu');
        P.push({ k: 'brk', a: [x - f.D / 2 - 0.15, -e - Lv], b: [x + f.D / 2 + 0.15, -e - Lv] });
        if (i < k - 1) dim(P, [x, -e - Lv], [x + sp, -e - Lv], 'h', -4, frn(sp));
      }
      yl = -e - Math.min(f.Lp, 4);
    }
    if (W_ > 0 && e > 0) { dim(P, [xc - W_ / 2, -e - 0.1], [xc + W_ / 2, -e - 0.1], 'h', f.mode === 'pieux' ? -14 : -6, frn(W_)); dim(P, [xc + W_ / 2, 0], [xc + W_ / 2, -e], 'v', 6, frn(e)); }
    return { yl, W: W_ };
  }
  /* section de lame de voile en plan : longueur L (sens transversal y), épaisseur e (sens x), extrémités droites, arrondies ou pointues */
  function lame(P, xc, yc, e, L, bout, lay, sect) {
    const h = L / 2, r = e / 2, r0 = Math.min(r, 0.20);
    if (sect === 'arete') return poly(P, [[xc - r0, yc - h], [xc - r, yc], [xc - r0, yc + h], [xc + r0, yc + h], [xc + r, yc], [xc + r0, yc - h]], lay);
    if (sect === 'creuse') return poly(P, [[xc - r, yc - h], [xc - r0, yc], [xc - r, yc + h], [xc + r, yc + h], [xc + r0, yc], [xc + r, yc - h]], lay);
    if (bout === 'pointu') poly(P, [[xc - r, yc - h + r], [xc, yc - h], [xc + r, yc - h + r], [xc + r, yc + h - r], [xc, yc + h], [xc - r, yc + h - r]], lay);
    else if (bout === 'arrondi') {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const a = Math.PI + i * Math.PI / 8; pts.push([xc + r * Math.cos(a), yc - h + r + r * Math.sin(a)]); }
      for (let i = 0; i <= 8; i++) { const a = i * Math.PI / 8; pts.push([xc + r * Math.cos(a), yc + h - r + r * Math.sin(a)]); }
      poly(P, pts, lay);
    } else rect(P, xc - r, yc - h, xc + r, yc + h, lay);
  }
  const pieY = (f, k, sy) => (f.ys ? f.ys[k] : -(f.m - 1) * (sy == null ? f.sy : sy) / 2 + k * (sy == null ? f.sy : sy));
  /* section d'un fût en plan : D le long de l'axe (x), b en travers (y) — circulaire, carrée, rectangulaire, octogonale, elliptique */
  function colSec(P, xc, yc, D, b, sec, lay) {
    if (sec === 'carre' || sec === 'rect') return rect(P, xc - D / 2, yc - b / 2, xc + D / 2, yc + b / 2, lay);
    if (sec === 'octo') { const k = D / 2, c = k * 0.4142; return poly(P, [[xc - c, yc - k], [xc + c, yc - k], [xc + k, yc - c], [xc + k, yc + c], [xc + c, yc + k], [xc - c, yc + k], [xc - k, yc + c], [xc - k, yc - c]], lay); }
    if (sec === 'ellip') { const pts = []; for (let i = 0; i < 32; i++) { const a = i * Math.PI / 16; pts.push([xc + D / 2 * Math.cos(a), yc + b / 2 * Math.sin(a)]); } return poly(P, pts, lay); }
    return circ(P, xc, yc, D / 2, lay, 24);
  }
  const colPos = (f) => f.pos || Array.from({ length: f.n }, (_, i) => -(f.n - 1) * f.s / 2 + i * f.s);
  const colLay = (f) => (f.sec === 'circ' || f.sec === 'ellip' || (!f.sec && f.section !== 'carre') ? 'col' : 'vuB');
  const colLab = (f) => (f.sec === 'carre' ? frn(f.D) + ' × ' + frn(f.D) : f.sec === 'rect' || f.sec === 'ellip' ? frn(f.D) + ' × ' + frn(f.b) : f.sec === 'octo' ? 'oct. ' + frn(f.D) : 'Ø' + frn(f.D));

  function supScenes(M, id) {
    const sp = M.supports.find((x) => x.id === id); if (!sp) return null;
    const S = M.S, g = sp.geo, f = sp.fo, isC = sp.kind === 'culee', H = sp.H, out = {};
    const nm = isC ? 'CULÉE ' + id : 'PILE ' + id, W = M.W;
    // ── coupe longitudinale à l'axe ──
    {
      const P = [];
      if (!isC) {
        const ch = g.ch, fut = g.fut, Hf = fut.H, th = fut.kind === 'colonnes' ? fut.D : fut.kind === 'voile' || fut.kind === 'vy' ? fut.e : fut.a;
        const fl = fondLo(P, f, 0, true);
        line(P, [-(fl.W / 2 + 2), 0.6], [fl.W / 2 + 2, 0.6], 'tn');
        if (fut.kind === 'voile' && fut.e1 && Math.abs(fut.e1 - fut.e) > 0.01) poly(P, [[-fut.e1 / 2, 0], [fut.e1 / 2, 0], [fut.e / 2, Hf], [-fut.e / 2, Hf]], 'vuB');
        else rect(P, -th / 2, 0, th / 2, Hf, fut.kind === 'colonnes' ? colLay(fut) : 'vuB');
        if (fut.kind === 'voile' && fut.e1 && Math.abs(fut.e1 - fut.e) > 0.01) dim(P, [-fut.e1 / 2, 0.4], [fut.e1 / 2, 0.4], 'h', -3, frn(fut.e1));
        if (ch) { rect(P, -ch.b / 2, Hf, ch.b / 2, H, 'beton'); dim(P, [-ch.b / 2, H], [ch.b / 2, H], 'h', 14, frn(ch.b)); dim(P, [ch.b / 2, Hf], [ch.b / 2, H], 'v', 8, frn(ch.h)); }
        dim(P, [-th / 2, Hf * 0.55], [th / 2, Hf * 0.55], 'h', 3, fut.kind === 'colonnes' ? (fut.sec === 'circ' ? 'Ø' : '') + frn(th) : frn(th));
        dim(P, [-(ch ? ch.b : th) / 2, 0], [-(ch ? ch.b : th) / 2, H], 'v', -10, 'H = ' + frn(H));
        // appareils d'appui, bossages, abouts du tablier
        const hd = M.h, yb = H + 0.10 + 0.06;
        sp.lines.forEach((l) => {
          const x = l.x - sp.x, a = Math.max(0.2, (l.app.a || 300) / 1000);
          rect(P, x - a / 2 - 0.05, H, x + a / 2 + 0.05, H + 0.10, 'vuB'); rect(P, x - a / 2, H + 0.10, x + a / 2, yb, 'app');
        });
        const xs_ = sp.lines.map((l) => l.x - sp.x), L2 = 2.6;
        if (xs_.length > 1) { rect(P, -L2 - 0.3, yb, xs_[0] + 0.35, yb + hd, 'vuL'); rect(P, xs_[1] - 0.35, yb, L2 + 0.3, yb + hd, 'vuL'); dim(P, [xs_[0], yb], [xs_[1], yb], 'h', 4, frn(xs_[1] - xs_[0])); }
        else rect(P, -L2, yb, L2, yb + hd, 'vuL');
        line(P, [0, fl.yl - 0.5], [0, yb + hd + 0.8], 'axe');
        tagFrom(P, 0, id);
        title(P, [0, yb + hd + 2.2], 'COUPE LONGITUDINALE À L’AXE — ' + nm, 50);
      } else if (C.culeeProfil(sp).tal > 0) {
        // coupe longitudinale des plans KLE (PRO2334 C0) : remblai à gauche, garde-grève à nez, sommier à talon,
        // dalle de transition posée sur le talon, appareil, pieu ou poteau — cotes du plan
        curEch = 50;
        const R = C.culeeProfil(sp), X = (q) => [-q[0], q[1]], so = g.sommier, hs = so.h, hgg = g.hgg, hE = S.usage === 'rail' ? hgg : hgg - 0.025 * M.W / 2;
        R.cut.forEach((c) => poly(P, c.pts.map(X), c.lay === 'prop' ? 'vuT' : 'beton'));
        const uF = R.ut - so.b, nz = g.nez || 0;
        rect(P, -0.30, 0, 0.30, 0.06, 'vuB'); rect(P, -0.20, 0.06, 0.20, 0.12, 'vuB'); rect(P, -0.30, 0.12, 0.30, 0.18, 'vuB');   // appareil
        if (f.mode === 'pieux') { const Lv = 6.0; rect(P, -f.D / 2, -hs, f.D / 2, -hs - Lv, 'col'); const yw = -hs - Lv * 0.58;
          [1, -1].forEach((sg) => P.push({ k: 'poly', pts: Array.from({ length: 17 }, (_, n) => [-f.D / 2 + n * f.D / 16, yw + sg * 0.11 * Math.abs(Math.sin(n * Math.PI / 8))]), lay: 'brkO', closed: false }));
          dim(P, [-f.D / 2, yw + 1.1], [f.D / 2, yw + 1.1], 'h', 0, 'Ø' + frn(f.D)); dim(P, [-uF + 2.2, -hs], [-uF + 2.2, -hs - Lv], 'v', 0, 'H_PIEUX=' + fr(f.Lp, 0) + 'm'); }
        else if (g.colonnes) { rect(P, -(R.uc) - g.colonnes.D / 2, -hs, -(R.uc) + g.colonnes.D / 2, -sp.H, 'vuB'); }
        line(P, [0, hgg - 1.3], [0, -hs - 8], 'axeC');
        const xR = -uF + 6.5, f2 = (v) => (Math.round(v * 100 + 1e-6) / 100).toFixed(2).replace(/^0\./, '.');
        dim(P, [xR, hgg], [xR, 0], 'v', 0, 'VAR : ' + f2(hE) + ' à ' + f2(hgg)); dim(P, [xR, 0], [xR, -hs], 'v', 0, frn(hs));
        const yT = hgg + 0.5;
        dim(P, [-R.ub, hgg], [-(R.ug - nz), hgg], 'h', (yT - hgg) * 20, frn(R.ub - R.ug + nz)); dim(P, [-(R.ug - nz), hgg], [0, hgg], 'h', (yT - hgg) * 20, frn(R.ug - nz));
        if (nz > 0) { dim(P, [-(R.ug - nz) + 0.6, hgg], [-(R.ug - nz) + 0.6, hgg - 0.60], 'v', 0, frn(0.60)); dim(P, [-(R.ug - nz) + 0.6, hgg - 0.60], [-(R.ug - nz) + 0.6, hgg - 0.80], 'v', 0, frn(0.20)); }
        if (g.dt) { const L = g.dt.L; dim(P, [-R.ub - L, 0.30 - 0.05 * L], [-R.ub, 0.30], 'h', 18, frn(L)); dim(P, [-R.ub - L - 0.8, 0.30 - 0.05 * L], [-R.ub - L - 0.8, -0.05 * L], 'v', 0, frn(0.30)); }
        const ch = [-R.ut, -R.ub, -R.ug, 0, -uF].sort((p_, q_) => p_ - q_), yc = -0.25;
        for (let k = 0; k < ch.length - 1; k++) dim(P, [ch[k], 0], [ch[k + 1], 0], 'h', (yc - 0) * 20, frn(ch[k + 1] - ch[k]));
        if (f.mode === 'pieux') { const c2 = [-R.ut, -f.D / 2, 0, f.D / 2, -uF]; for (let k = 0; k < c2.length - 1; k++) dim(P, [c2[k], -hs], [c2[k + 1], -hs], 'h', -0.4 * 20, frn(c2[k + 1] - c2[k])); }
        dim(P, [-R.ut, -hs], [-uF, -hs], 'h', -1.6 * 20, frn(so.b));
        P.push({ k: 'title', p: [-R.ub, hgg + 2.4], s: 'COUPE LONGITUDINALE', sub: 'Ech:1/50' });
        tagFrom(P, 0, id);
      } else {
        const o = sp.j === 0 ? -1 : 1, R = C.culeeProfil(sp), X = (u) => o * u, Q = (q) => [X(q[0]), q[1] + H];
        const rt = g.retours, hgg = g.hgg, so = g.sommier, hs = so.h, yTop = H + hgg, rem = g.type === 'remblayee';
        const lo_ = (a, b) => [Math.min(a, b), Math.max(a, b)];
        // remblai d'accès (dessous de chaussée ≈ 0,35 sous le dessus du tablier)
        const uFar = Math.max(R.ub + Math.max(rt.mode === 'U' ? 0 : rt.L, g.dt ? g.dt.L + 0.3 : 0) + 1.5, (R.u1 || 0) + 1.0, rem ? R.uE + 1.0 : 0);
        if (rem) {
          const ubk = R.uf + so.b;
          poly(P, [[X(R.ub), yTop - 0.35], [X(uFar), yTop - 0.35], [X(uFar), 0]].concat(R.back.slice().reverse().map(Q), [Q([ubk, 0]), Q([R.ub, 0])]), 'remblai');
          line(P, [X(R.u0 - 3), 0.6], [X(R.uf), 0.6], 'tn');
        } else {
          const uF = R.ub - so.b, ut = uF - Math.max(0, H - hs - 0.6) * 1.5;
          poly(P, [[X(R.ub), yTop - 0.35], [X(uFar), yTop - 0.35], [X(uFar), 0.6], [X(ut), 0.6], [X(uF), H - hs], [X(R.ub), H - hs]], 'remblai');
          line(P, [X(ut), 0.6], [X(uF), H - hs], 'perre');
          line(P, [X(ut - 3), 0.6], [X(ut), 0.6], 'tn');
        }
        // structure : parties vues (murs en retour, colonnes) puis coupées (garde-grève, sommier, mur de front, dalle de transition)
        R.seen.forEach((c) => poly(P, c.pts.map(Q), c.lay === 'col' ? 'col' : c.lay === 'vuB' ? 'vuB' : 'vu'));
        R.cut.forEach((c) => poly(P, c.pts.map(Q), c.lay));
        if (g.dt) { const a = lo_(X(R.ub + 0.30), X(R.ub + 0.30 + g.dt.L)); dim(P, [a[0], yTop - 0.40], [a[1], yTop - 0.40], 'h', 6, 'dalle de transition ' + frn(g.dt.L) + ' — 5 %'); }
        if (rem) {   // drainage (plans KLE) : nappe drainante + géotextile contre le mur, drain Ø160 en pied, barbacanes Ø100 tous les 1,50 m
          const ub_ = R.uf + g.mur.e, yTN = 0.6 + 0.5;
          line(P, [X(ub_ + 0.08), 0.3], [X(ub_ + 0.08), Math.max(0.6, H - so.h - (so.b - g.mur.e))], 'vuT');
          circ(P, X(ub_ + 0.30), 0.35, 0.08, 'vu', 12);
          line(P, [X(R.uf - 0.15), yTN], [X(ub_ + 0.05), yTN + 0.05], 'eau');
          text(P, [X(ub_ + 0.6), 0.35], 'drain Ø160 + géotextile, nappe drainante', { ht: 1.8, anchor: o < 0 ? 'end' : 'start', lay: 'note' });
          text(P, [X(R.uf - 0.2), yTN], 'barbacanes Ø100 / 1,50 m', { ht: 1.8, anchor: o < 0 ? 'start' : 'end', dy: 2, lay: 'note' });
        }
        // fondation (semelle à patin et talon, ou massif sur pieux) et gros béton éventuel
        const fl = fondLo(P, f, X(R.uc), true);
        if (g.gros > 0 && f.mode === 'superficielle') {
          const a = lo_(X(R.u0 - 0.5), X(R.u1 + 0.5)), y0 = -f.e - 0.10;
          rect(P, a[0], y0, a[1], y0 - g.gros, 'prop'); text(P, [(a[0] + a[1]) / 2, y0 - g.gros / 2], 'gros béton ép. ' + frn(g.gros), { ht: 2, lay: 'note' });
        }
        // appareils d'appui et about du tablier
        const a = Math.max(0.2, ((sp.lines[0] && sp.lines[0].app.a) || 300) / 1000), yb = H + 0.16, xg = X(g.dab);
        rect(P, -a / 2 - 0.05, H, a / 2 + 0.05, H + 0.10, 'vuB'); rect(P, -a / 2, H + 0.10, a / 2, yb, 'app');
        rect(P, xg - o * 0.05, yb, xg - o * 3.2, yb + Math.min(M.h, hgg - 0.16), 'vuL');
        // cotes
        const ufr = rem ? R.uf : R.ub - so.b, ubk = ufr + so.b;
        { const q = lo_(X(ufr), X(ubk)); dim(P, [q[0], H], [q[1], H], 'h', 9, frn(so.b)); dim(P, [q[1], H - hs], [q[1], H], 'v', 6, frn(hs)); }
        { const q = lo_(X(R.ug), X(R.ub)); dim(P, [q[0], yTop], [q[1], yTop], 'h', 4, frn(g.egg)); }
        if (rem) {
          const ef = g.mur.e, q = lo_(X(R.uf), X(R.uf + ef)), ym = (H - hs) * 0.45;
          dim(P, [q[0], ym], [q[1], ym], 'h', 3, frn(ef));
          if (f.mode === 'superficielle') {
            const pa = lo_(X(R.u0), X(R.uf)), ta = lo_(X(R.uf + ef), X(R.u1));
            dim(P, [pa[0], 0], [pa[1], 0], 'h', 3, 'patin ' + frn(R.uf - R.u0));
            dim(P, [ta[0], 0], [ta[1], 0], 'h', 3, 'talon ' + frn(R.u1 - R.uf - ef));
          }
          const qr = lo_(X(rt.mode === 'U' ? R.uf : R.ub), X(rt.mode === 'U' ? R.uE : R.ub + rt.L));
          dim(P, [qr[0], yTop], [qr[1], yTop], 'h', 16, 'mur en retour ' + (rt.mode === 'U' ? 'en U ' : 'suspendu ') + frn(qr[1] - qr[0]) + ' — ép. ' + frn(rt.e));
        } else {
          if (g.colonnes) { const q = lo_(X(R.uc - g.colonnes.D / 2), X(R.uc + g.colonnes.D / 2)); dim(P, [q[0], (H - hs) * 0.5], [q[1], (H - hs) * 0.5], 'h', 3, (g.colonnes.section === 'circ' ? 'Ø' : '') + frn(g.colonnes.D)); }
          if (rt.mode === 'suspendus' || rt.mode === 'AR') { const qr = lo_(X(R.ub), X(R.ub + rt.L)); dim(P, [qr[0], yTop], [qr[1], yTop], 'h', 16, (rt.mode === 'AR' ? 'petit mur en retour ' : 'mur en retour suspendu ') + frn(rt.L) + ' — ép. ' + frn(rt.e)); }
          else if (rt.mode === 'AV') text(P, [X(R.ub - so.b / 2), yTop], 'murettes latérales ép. ' + frn(rt.e), { ht: 2, dy: 6, lay: 'note' });
          if (g.nervure) { const q = lo_(X(R.uc - g.nervure.b / 2), X(R.uc + g.nervure.b / 2)); dim(P, [q[1], 0], [q[1], g.nervure.h], 'v', 4, frn(g.nervure.h)); text(P, [q[0], g.nervure.h / 2], 'nervure', { ht: 1.8, anchor: 'end', dy: 0, lay: 'note' }); }
          text(P, [X(R.ub - so.b / 2), yTop], 'disposition ' + g.dispo + ' (PP73)' + (so.court ? ' — chevêtre court' : ' — chevêtre long'), { ht: 2, dy: 12, lay: 'note' });
        }
        { const xm = Math.min(X(R.u0), X(ufr)) - 0.6; dim(P, [xm, 0], [xm, H], 'v', -6, 'H = ' + frn(H)); }
        line(P, [0, fl.yl - 0.5], [0, yTop + 1], 'axe');
        P.sort((a_, b_) => (a_.lay === 'remblai' ? -1 : 0) - (b_.lay === 'remblai' ? -1 : 0));
        tagFrom(P, 0, id);
        title(P, [X((R.u0 + R.u1) / 2), yTop + 2.6], 'COUPE LONGITUDINALE À L’AXE — ' + nm, 50);
      }
      out.lo = { P, ech: 50, titre: 'Coupe longitudinale à l’axe' };
    }
    // ── coupe en plan au niveau des fûts (fondation, pieux, sections des fûts) ──
    {
      const P = [];
      const Bf = f.mode === 'pieux' ? (f.e > 0 ? f.Lx : 0) : f.B, Lf = f.mode === 'pieux' ? (f.e > 0 ? f.Ly : W) : f.L;
      const o = isC ? (sp.j === 0 ? -1 : 1) : 0, RC = isC ? C.culeeProfil(sp) : null, cx = isC ? o * RC.uc : 0;
      const cys = f.split ? f.split.centers : [0];
      if (Bf > 0) cys.forEach((cy, i) => { rect(P, cx - Bf / 2, cy - Lf / 2, cx + Bf / 2, cy + Lf / 2, 'vuL'); if (!i) dim(P, [cx - Bf / 2, cy - Lf / 2], [cx + Bf / 2, cy - Lf / 2], 'h', -6, frn(Bf)); dim(P, [cx + Bf / 2, cy - Lf / 2], [cx + Bf / 2, cy + Lf / 2], 'v', 8, frn(Lf)); });
      if (f.mode === 'pieux') {
        const sy = f.sy || f.s;
        for (const cy of cys) for (let i = 0; i < f.nr; i++) for (let k = 0; k < f.m; k++) {
          const x = cx - (f.nr - 1) * f.s / 2 + i * f.s, y = cy + pieY(f, k, sy);
          circ(P, x, y, f.D / 2, PIL, 20); line(P, [x - f.D * 0.7, y], [x + f.D * 0.7, y], 'axe'); line(P, [x, y - f.D * 0.7], [x, y + f.D * 0.7], 'axe');
        }
        if (f.m > 1) dim(P, [cx - (f.nr - 1) * f.s / 2 - (Bf / 2 || f.D) - 0.2, -(f.m - 1) * sy / 2], [cx - (f.nr - 1) * f.s / 2 - (Bf / 2 || f.D) - 0.2, -(f.m - 1) * sy / 2 + sy], 'v', -6, frn(sy));
        text(P, [cx, cys[0] - Lf / 2], f.n + ' pieux Ø' + fr(f.D, 2) + ' — L = ' + frn(f.Lp) + ' m', { ht: 2.4, dy: -11, lay: 'note' });
      }
      if (!isC) {
        const fut = g.fut;
        if (fut.kind === 'colonnes') { const ps = colPos(fut); ps.forEach((y, i) => { colSec(P, 0, y, fut.D, fut.b || fut.D, fut.sec, FSEC); if (i < ps.length - 1) dim(P, [0, y], [0, ps[i + 1]], 'v', -4, frn(ps[i + 1] - y)); }); text(P, [0, ps[0]], colLab(fut), { ht: 2, dy: -8, lay: 'note', anchor: 'start' }); }
        else if (fut.kind === 'voile') {
          const eb = fut.e1 || fut.e;
          (fut.xl || [0]).forEach((y) => { lame(P, 0, y, eb, fut.Lb || fut.L, fut.bout, FSEC, fut.sect); dim(P, [eb / 2, y - (fut.Lb || fut.L) / 2], [eb / 2, y + (fut.Lb || fut.L) / 2], 'v', 3, frn(fut.Lb || fut.L)); });
          const y0 = (fut.xl || [0])[0] - (fut.Lb || fut.L) / 2; dim(P, [-eb / 2, y0], [eb / 2, y0], 'h', -4, frn(eb));
          text(P, [0, (fut.xl || [0])[0]], 'PP73 ' + fut.grp + fut.face + (fut.sect === 'arete' ? '1' : fut.sect === 'creuse' ? '2' : ''), { ht: 2, dy: 0, lay: 'note', anchor: 'start' });
        }
        else if (fut.kind === 'vy') { rect(P, -fut.e / 2, -fut.Lb / 2, fut.e / 2, fut.Lb / 2, FSEC); dim(P, [fut.e / 2, -fut.Lb / 2], [fut.e / 2, fut.Lb / 2], 'v', 3, frn(fut.Lb)); text(P, [0, fut.Lb / 2], 'voile en ' + fut.form + ' — section au pied', { ht: 2, dy: 4, lay: 'note' }); }
        else rect(P, -fut.a / 2, -(fut.bb || fut.b) / 2, fut.a / 2, (fut.bb || fut.b) / 2, FSEC);
      } else {
        const R = RC, X = (u) => o * u, rt = g.retours, rr = (a, b, y0, y1, lay) => rect(P, Math.min(X(a), X(b)), y0, Math.max(X(a), X(b)), y1, lay);
        if (g.type === 'remblayee') {
          rr(R.uf, R.uf + g.mur.e, -W / 2, W / 2, FSEC);
          dim(P, [Math.min(X(R.uf), X(R.uf + g.mur.e)), W / 2], [Math.max(X(R.uf), X(R.uf + g.mur.e)), W / 2], 'h', 4, frn(g.mur.e));
        } else if (g.colonnes) {
          const D = g.colonnes.D, nv = g.nervure;
          if (nv) rr(R.uc - nv.b / 2, R.uc + nv.b / 2, -nv.L / 2, nv.L / 2, 'vu');
          const cb_ = g.colonnes.section === 'rect' ? g.colonnes.b : D;
          (g.colonnes.pos || colPos(g.colonnes)).forEach((y) => { if (g.colonnes.section !== 'circ') rr(R.uc - D / 2, R.uc + D / 2, y - cb_ / 2, y + cb_ / 2, FSEC); else circ(P, X(R.uc), y, D / 2, FSEC, 24); });
        }
        const Lch = g.sommier.L;
        if (rt.mode !== 'aucun') [-1, 1].forEach((sd) => {   // murs en retour : coupés s'ils descendent sur la semelle (U), vus sinon
          const y0 = sd * ((rt.mode === 'U' ? W : Lch) / 2 - rt.e / 2);
          if (rt.mode === 'U') rr(R.uf, R.uE, y0 - rt.e / 2, y0 + rt.e / 2, FSEC);
          else if (rt.mode === 'AV') rr(R.ub - g.sommier.b, R.ub, y0 - rt.e / 2, y0 + rt.e / 2, 'vu');
          else rr(R.ub, R.ub + rt.L, y0 - rt.e / 2, y0 + rt.e / 2, 'vu');
        });
        if (rt.mode === 'U') dim(P, [Math.min(X(R.uf), X(R.uE)), -W / 2], [Math.max(X(R.uf), X(R.uE)), -W / 2], 'h', -14, 'murs en retour ' + frn(R.uE - R.uf) + ' — ép. ' + frn(rt.e));
      }
      line(P, [cx - (Bf / 2 + 1.5), 0], [cx + Bf / 2 + 1.5, 0], 'axe'); line(P, [0, -(Lf / 2 + 1)], [0, Lf / 2 + 1], 'axe');
      tagFrom(P, 0, id);
      title(P, [cx, Lf / 2 + 2.6], (isC ? 'COUPE SUR SEMELLE — ' : 'COUPE EN PLAN AU NIVEAU DES FÛTS — ') + nm, 50);
      out.pl = { P, ech: 50, titre: isC ? 'Coupe sur semelle' : 'Coupe en plan au niveau des fûts' };
    }
    // ── vue en plan du chevêtre / sommier : appareils d'appui et bossages ──
    {
      const P = [];
      let x0, x1, L;
      if (!isC) { const ch = g.ch || { b: g.fut.e || g.fut.a || 1.2, L: g.fut.L || W }; x0 = -ch.b / 2; x1 = ch.b / 2; L = ch.L; }
      else {
        const o = sp.j === 0 ? -1 : 1, R = C.culeeProfil(sp), so = g.sommier, uF = g.type === 'remblayee' ? R.uf : R.ub - so.b;
        x0 = Math.min(o * uF, o * (uF + so.b)); x1 = Math.max(o * uF, o * (uF + so.b)); L = so.L || W;
        if (g.egg > 0) rect(P, Math.min(o * R.ug, o * R.ub), -L / 2, Math.max(o * R.ug, o * R.ub), L / 2, 'vuB');
        const rt = g.retours, ua = rt.mode === 'U' ? R.uf : rt.mode === 'AV' ? R.ub - so.b : R.ub, ue = rt.mode === 'U' ? R.uE : rt.mode === 'AV' ? R.ub : R.ub + rt.L;
        if (rt.mode !== 'aucun') [-1, 1].forEach((sd) => rect(P, Math.min(o * ua, o * ue), sd * (L / 2 - rt.e), Math.max(o * ua, o * ue), sd * L / 2, 'vuB'));
      }
      rect(P, x0, -L / 2, x1, L / 2, 'vuL');
      const bear = M.sec.bear;
      sp.lines.forEach((l) => {
        const x = l.x - sp.x, a = Math.max(0.2, (l.app.a || 300) / 1000), b = Math.max(0.2, (l.app.b || 400) / 1000);
        bear.forEach((y) => { rect(P, x - a / 2 - 0.05, y - b / 2 - 0.05, x + a / 2 + 0.05, y + b / 2 + 0.05, 'vuB'); rect(P, x - a / 2, y - b / 2, x + a / 2, y + b / 2, 'app'); });
        line(P, [x, -L / 2 - 0.4], [x, L / 2 + 0.4], 'axe');
        // bossages de vérinage entre les appareils (plans KLE : Larache, LGV lot 10)
        for (let k = 0; k < bear.length - 1; k++) { const y = (bear[k] + bear[k + 1]) / 2; rect(P, x - 0.25, y - 0.25, x + 0.25, y + 0.25, 'vuB'); }
      });
      if (bear.length > 1) text(P, [(x0 + x1) / 2, (bear[0] + bear[1]) / 2], 'vérinage', { ht: 1.8, dy: 10, lay: 'note' });
      const bmax = Math.max(...bear.map(Math.abs)) + Math.max(0.2, ((sp.lines[0] && sp.lines[0].app.b) || 400) / 1000) / 2 + 0.45;
      if (S.usage === 'rail' && bmax + 0.25 <= L / 2 - 0.05) [-1, 1].forEach((sd) => {   // butées de sécurité transversales (et non blocage), au-delà des appareils
        const y = sd * bmax; rect(P, (x0 + x1) / 2 - 0.4, y - 0.25, (x0 + x1) / 2 + 0.4, y + 0.25, 'beton');
        if (sd > 0) text(P, [x1, y], 'butée de sécurité', { ht: 1.8, dy: -6, lay: 'note' });
      });
      for (let k = 0; k < bear.length - 1; k++) dim(P, [x1, bear[k]], [x1, bear[k + 1]], 'v', 6, frn(bear[k + 1] - bear[k]));
      dim(P, [x1, -L / 2], [x1, L / 2], 'v', 14, frn(L));
      dim(P, [x0, -L / 2], [x1, -L / 2], 'h', -5, frn(x1 - x0));
      const ap = sp.lines[0] && sp.lines[0].app;
      text(P, [(x0 + x1) / 2, -L / 2], (bear.length * sp.lines.length) + ' appareils ' + (ap ? ap.des : ''), { ht: 2.2, dy: -12, lay: 'note' });
      line(P, [x0 - 1, 0], [x1 + 1, 0], 'axe');
      tagFrom(P, 0, id);
      title(P, [(x0 + x1) / 2, L / 2 + 2.4], 'VUE EN PLAN ' + (isC ? 'DU SOMMIER' : 'DU CHEVÊTRE') + ' — ' + nm, 50);
      out.top = { P, ech: 50, titre: isC ? 'Vue en plan du sommier' : 'Vue en plan du chevêtre' };
    }
    // ── coupe biaise à l'axe : longueurs mesurées le long de l'axe de l'ouvrage (÷ sin φ), cotes recalculées ──
    if (S.biais < 99.5) {
      const k = 1 / Math.max(0.3, Math.sin(S.biais * Math.PI / 200)), num = (t) => (t.match(/\d+,\d{2}/) || [null])[0];
      const P = out.lo.P.map((p) => {
        const q = JSON.parse(JSON.stringify(p)), sx = (pt) => [pt[0] * k, pt[1]];
        if (q.k === 'poly') q.pts = q.pts.map(sx);
        else if (q.k === 'dim' || q.k === 'brk') {
          const L0 = Math.abs(q.b[0] - q.a[0]); q.a = sx(q.a); q.b = sx(q.b);
          if (q.k === 'dim' && q.dir === 'h' && L0 > 0.01) { const n = num(q.s || ''); if (n && Math.abs(parseFloat(n.replace(',', '.')) - L0) < 0.02) q.s = q.s.replace(n, frn(L0 * k)); }
        } else if (q.k === 'text' || q.k === 'title') { q.p = sx(q.p); if (q.k === 'title') q.s = q.s.replace('COUPE LONGITUDINALE', 'COUPE BIAISE'); }
        return q;
      });
      out.lob = { P, ech: 50, titre: 'Coupe biaise à l’axe (φ = ' + fr(S.biais, 0) + ' gr)' };
    }
    // ── culées : mur en retour (élévation et coupe type), garde-grève (élévation) ──
    if (isC) {
      const R = C.culeeProfil(sp), rt = g.retours, hgg = g.hgg, H = sp.H, nm2 = 'CULÉE ' + id;
      if (rt.mode !== 'aucun') {
        const P = [];
        const src = R.seen.find((c) => c.lay === 'vuL');
        if (src && R.tal > 0) {
          // élévation côté bas comme sur le plan KLE : remblai à gauche (u → −u), mur suspendu, garde-grève et sommier coupés
          curEch = 50;
          const hgg0 = hgg, hE = S.usage === 'rail' ? hgg0 : hgg0 - 0.025 * M.W / 2;   // hauteur à la rive (dévers) : 2.72 sur le plan
          const X = (q) => [-q[0], q[1] > hgg0 - 1.0 ? q[1] - (hgg0 - hE) : q[1]], hs = g.sommier.h;
          { const hgg = hE, f2m = (v) => (Math.round(v * 100 + 1e-6) / 100).toFixed(2).replace(/^0\./, '.');   // cotes à la rive
          poly(P, src.pts.map(X), 'vuT');
          R.cut.filter((c) => c.role === 'gg' || c.role === 'som').forEach((c) => poly(P, c.pts.map(X), 'beton'));
          const uL = R.ub + rt.L, z2 = hgg - (rt.h2 || 0.9);
          rect(P, -0.6, -hs, 0.6, -hs - 3.2, 'col'); line(P, [0, hgg - 1.2], [0, -hs - 3.6], 'axeC');
          const yT = hgg + 0.45;
          dim(P, [-uL, hgg], [-R.ub, hgg], 'h', (yT - hgg) * 20, f2m(rt.L)); dim(P, [-R.ub, hgg], [-(R.ug - (g.nez || 0)), hgg], 'h', (yT - hgg) * 20, f2m(R.ub - R.ug + (g.nez || 0))); dim(P, [-(R.ug - (g.nez || 0)), hgg], [0, hgg], 'h', (yT - hgg) * 20, f2m(R.ug - (g.nez || 0)));
          dim(P, [-uL, hgg], [-uL, z2], 'v', -6, f2m(hgg - z2)); dim(P, [-uL, z2], [-uL, -hs], 'v', -6, f2m(z2 + hs));
          const xr = R.bs !== undefined ? 0 : 0; void xr;
          const xd = -(R.ut - g.sommier.b) + 2.2;
          dim(P, [xd, hgg], [xd, 0], 'v', 0, f2m(hgg)); dim(P, [xd, 0], [xd, -hs], 'v', 0, f2m(hs)); dim(P, [xd + 1.2, hgg], [xd + 1.2, -hs], 'v', 0, f2m(hgg + hs));
          P.push({ k: 'title', p: [-uL / 2, hgg + 2.0], s: 'MUR EN RETOUR : ELEVATION COTE BAS', sub: 'Ech:1/50' });
          // coupe type : voile .50, tête avec bloc d'ancrage et corniche
          const cx = xd + 4.5, e = rt.e, yb = -hs;
          poly(P, [[cx, yb], [cx + e, yb], [cx + e, hgg], [cx + e + 0.15, hgg], [cx + e + 0.15, hgg + 0.31], [cx - 0.26, hgg + 0.31], [cx - 0.26, hgg - 0.49], [cx, hgg - 0.49]], 'beton');
          rect(P, cx - 0.26, hgg, cx + 0.15, hgg + 0.31, 'orH');
          dim(P, [cx, yb], [cx + e, yb], 'h', -5, f2m(e)); dim(P, [cx + e + 0.15, yb], [cx + e + 0.15, hgg], 'v', 5, f2m(hgg - yb));
          dim(P, [cx - 0.26, hgg + 0.31], [cx - 0.26, hgg], 'v', -5, f2m(0.31)); dim(P, [cx - 0.26, hgg], [cx - 0.26, hgg - 0.49], 'v', -5, f2m(0.49)); dim(P, [cx, hgg - 0.49], [cx, yb], 'v', -9, f2m(hgg - 0.49 - yb));
          P.push({ k: 'title', p: [cx + e / 2, hgg + 2.0], s: 'MUR EN RETOUR : COUPE TYPE', sub: 'Ech:1/50' });
          out.mr = { P, ech: 50, titre: 'Mur en retour : élévation et coupe type' };
          }
        } else if (src) {
          const pts = src.pts.map((q) => [q[0], q[1] + H]);
          poly(P, pts, 'beton');
          const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
          dim(P, [x0, y1], [x1, y1], 'h', 6, frn(x1 - x0));
          dim(P, [x0, y0], [x0, y1], 'v', -6, frn(y1 - y0));
          const top = pts.filter((q) => Math.abs(q[1] - y1) < 1e-6), xe = Math.max(...top.map((q) => q[0]));
          if (xe < x1 - 0.05) dim(P, [x0, y1], [xe, y1], 'h', 14, frn(xe - x0));
          const rr = pts.filter((q) => Math.abs(q[0] - x1) < 1e-6), ye = Math.max(...rr.map((q) => q[1]));
          if (ye > y0 + 0.05) dim(P, [x1, y0], [x1, ye], 'v', 6, frn(ye - y0));
          if (rt.mode === 'U') { rect(P, x0 - 0.5, y0, x1 + 0.3, y0 - (sp.fo.e || 1), 'vuL'); text(P, [(x0 + x1) / 2, y0 - (sp.fo.e || 1) / 2], 'semelle', { ht: 2, lay: 'note' }); }
          // coupe type à côté
          const cx = x1 + 3, e = rt.e;
          rect(P, cx, y0, cx + e, y1, 'beton'); rect(P, cx - 0.10, y1, cx + e + 0.10, y1 - 0.25, 'vuB');
          dim(P, [cx, y0], [cx + e, y0], 'h', -5, frn(e));
          text(P, [cx + e / 2, y1], 'coupe type', { ht: 2.2, dy: 8, lay: 'note' });
          title(P, [(x0 + x1) / 2, y1 + 3], 'MUR EN RETOUR — ÉLÉVATION ET COUPE TYPE — ' + nm2, 50);
          out.mr = { P, ech: 50, titre: 'Mur en retour : élévation et coupe type' };
        }
      }
      if (g.egg > 0) {
        const P = [], Lg = g.sommier.L || M.W, W2 = Lg / 2;
        rect(P, -W2, 0, W2, hgg, 'vuB');
        if (g.dt) line(P, [-W2, hgg - 0.70], [W2, hgg - 0.70], 'vuT');
        M.sec.bear.forEach((y) => { rect(P, y - 0.35, -0.0, y + 0.35, 0.10, 'vuB'); rect(P, y - 0.25, 0.10, y + 0.25, 0.16, 'app'); });
        rect(P, -W2 - 0.2, 0, W2 + 0.2, -0.6, 'vuL');
        dim(P, [-W2, hgg], [W2, hgg], 'h', 6, frn(Lg));
        dim(P, [W2, 0], [W2, hgg], 'v', 6, frn(hgg));
        const b = M.sec.bear; for (let i = 0; i < b.length - 1; i++) dim(P, [b[i], 0], [b[i + 1], 0], 'h', -5, frn(b[i + 1] - b[i]));
        text(P, [0, hgg / 2], 'ép. ' + frn(g.egg) + (g.dt ? ' — corbeau d’appui de la dalle de transition' : ''), { ht: 2, lay: 'note' });
        title(P, [0, hgg + 2.6], 'GARDE-GRÈVE — ÉLÉVATION — ' + nm2, 50);
        out.gg = { P, ech: 50, titre: 'Garde-grève : élévation' };
      }
    }
    return out;
  }

  /* ───────── Rendu SVG ───────── */
  /* Habillage des plans KLE : béton coupé hachuré, colonnes ombrées, cotes rouges, axes magenta,
     corniches préfabriquées sombres, équipements violets. #ID- est remplacé par l'identifiant du dessin. */
  const STY = {
    beton: 'fill:url(#ID-b);stroke:#1a1a1a;stroke-width:1.1',
    prefa: 'fill:#cdcdcd;stroke:#1a1a1a;stroke-width:1.1',
    pred: 'fill:url(#ID-d);stroke:#1a1a1a;stroke-width:.6',
    vuB: 'fill:#ffffff;stroke:#1e1e1e;stroke-width:.8',
    vuL: 'fill:#fbfaf6;stroke:#3a3a3a;stroke-width:.7',
    cornE: 'fill:#8a8a8a;stroke:#2b2b2b;stroke-width:.6',
    gcF: 'fill:none;stroke:#2020ff;stroke-width:.6',
    vuT: 'fill:none;stroke:#4a4a4a;stroke-width:.6',
    rep: 'fill:none;stroke:#e8590c;stroke-width:1.6',
    arrowF: 'fill:#000;stroke:#000;stroke-width:.3',
    orH: 'fill:url(#ID-o);stroke:#1a1a1a;stroke-width:.7',
    ble: 'fill:none;stroke:#2020ff;stroke-width:1.1',
    bn4: 'fill:#fff;stroke:#666;stroke-width:.7',
    lr: 'fill:url(#ID-k);stroke:#1a1a1a;stroke-width:.7',
    pente: 'fill:none;stroke:#ff0000;stroke-width:.9',
    rain: 'fill:none;stroke:#7b2fbe;stroke-width:.9',
    brkO: 'fill:none;stroke:#e8590c;stroke-width:.9',
    gros: 'fill:url(#ID-s);stroke:#444;stroke-width:.7',
    butee: 'fill:url(#ID-w);stroke:#1a1a1a;stroke-width:.9',
    gcN: 'fill:#f4f4f4;stroke:#555;stroke-width:.6',
    hachP: 'fill:url(#ID-w);stroke:#000;stroke-width:1.3',
    hachD: 'fill:url(#ID-w);stroke:#1a1a1a;stroke-width:.9',
    axeC: 'fill:none;stroke:#ff00bf;stroke-width:.8',
    col: 'fill:url(#ID-c);stroke:#2b2b2b;stroke-width:.8',
    acier: 'fill:#9fb3cc;stroke:#1f3a5f;stroke-width:.9',
    acierL: 'fill:none;stroke:#1f3a5f;stroke-width:1.3;stroke-dasharray:6 3',
    vu: 'fill:none;stroke:#6f6f6f;stroke-width:.7;stroke-dasharray:4 2.5',
    axe: 'fill:none;stroke:#ff00bf;stroke-width:.7;stroke-dasharray:14 3 2 3',      // axes magenta (plans KLE)
    tn: 'fill:none;stroke:#2eb800;stroke-width:1.1',                                 // terrain naturel vert (plans KLE)
    sol: 'fill:none;stroke:none',
    remblai: 'fill:none;stroke:none',
    perre: 'fill:none;stroke:#8a6a2a;stroke-width:2.4;stroke-dasharray:3 2',
    pieu: 'fill:#f3f3f3;stroke:#2b2b2b;stroke-width:.8;stroke-dasharray:6 3',
    pieuP: 'fill:none;stroke:#e8590c;stroke-width:.8;stroke-dasharray:5 3',
    prop: 'fill:#cfcfcf;stroke:#555;stroke-width:.4',
    app: 'fill:#222;stroke:#111;stroke-width:.5',
    corn: 'fill:#6e6e6e;stroke:#1e1e1e;stroke-width:.7',
    rev: 'fill:#9b9b9b;stroke:#444;stroke-width:.4',
    etan: 'fill:none;stroke:#111;stroke-width:1.4',
    four: 'fill:#fff;stroke:#1e1e1e;stroke-width:.6',
    gc: 'fill:none;stroke:#2020ff;stroke-width:1.5;stroke-linecap:round',
    gcR: 'fill:#d6d6ff;stroke:#2020ff;stroke-width:.8',
    equip: 'fill:#f2b25c;stroke:#7a4a10;stroke-width:.8',
    trottoir: 'fill:#dde3ea;stroke:#3d4a5c;stroke-width:.8',
    ballast: 'fill:url(#ID-g);stroke:#6e6455;stroke-width:.7',
    lead: 'fill:none;stroke:#1e1e1e;stroke-width:.5',
    eau: 'fill:none;stroke:#1c7ed6;stroke-width:1.1;stroke-dasharray:10 3',
    eauF: 'fill:#1c7ed6;stroke:#1c7ed6;stroke-width:.4',
    eauP: 'fill:#e7f1fb;stroke:#74a9dd;stroke-width:.8',
    routeP: 'fill:#eceef1;stroke:#868e96;stroke-width:.8',
    ballastP: 'fill:#ece6da;stroke:#8d8170;stroke-width:.8',
    aff: 'fill:none;stroke:#a61e4d;stroke-width:.8;stroke-dasharray:6 2 1 2',
    sond: 'fill:#fff4d6;stroke:#7a5b00;stroke-width:.7',
    sol_remblai: 'fill:url(#ID-sr);stroke:#333;stroke-width:.6', sol_argile: 'fill:url(#ID-sa);stroke:#333;stroke-width:.6', sol_sable: 'fill:url(#ID-ss);stroke:#333;stroke-width:.6',
    sol_calc: 'fill:url(#ID-sc);stroke:#333;stroke-width:.6', sol_schisteA: 'fill:url(#ID-sh2);stroke:#333;stroke-width:.6', sol_schiste: 'fill:url(#ID-sh);stroke:#333;stroke-width:.6',
    sol_quartz: 'fill:url(#ID-sq);stroke:#333;stroke-width:.6', sol_roche: 'fill:url(#ID-sk);stroke:#333;stroke-width:.6',
    guit: 'fill:none;stroke:#1e1e1e;stroke-width:.6',
    guitF: 'fill:none;stroke:#9a9a9a;stroke-width:.4',
    note: 'fill:none;stroke:#1e1e1e;stroke-width:.6',
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* opt : { width (px), kp (px par mm papier), pad (px), id } */
  function toSVG(sc, opt) {
    opt = opt || {};
    const Wpx = opt.width || 900, kp = opt.kp || 3.6, pad = opt.pad || 10, id = opt.id || 'cz';
    const P = sc.P;
    let bx = [Infinity, Infinity, -Infinity, -Infinity];
    const grow = (x, y) => { bx[0] = Math.min(bx[0], x); bx[1] = Math.min(bx[1], y); bx[2] = Math.max(bx[2], x); bx[3] = Math.max(bx[3], y); };
    P.forEach((p) => {
      if (p.k === 'poly') { if (p.lay !== 'sol') p.pts.forEach((q) => grow(q[0], q[1])); }
      else if (p.k === 'dim') { grow(p.a[0], p.a[1]); grow(p.b[0], p.b[1]); }
      else if (p.k === 'text' || p.k === 'title') grow(p.p[0], p.p[1]);
    });
    const bw = Math.max(1, bx[2] - bx[0]);
    const render = (s) => {
      const X = (x) => (x - bx[0]) * s, Y = (y) => (bx[3] - y) * s;
      const out = [], ext = [Infinity, Infinity, -Infinity, -Infinity];
      const g = (x, y) => { ext[0] = Math.min(ext[0], x); ext[1] = Math.min(ext[1], y); ext[2] = Math.max(ext[2], x); ext[3] = Math.max(ext[3], y); };
      const T = (x, y, s_, fs, anchor, extra) => {
        const w = String(s_).length * fs * 0.56;
        const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
        g(x0, y - fs); g(x0 + w, y + fs * 0.25);
        out.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${fs.toFixed(1)}" text-anchor="${anchor}"${extra || ''}>${esc(s_)}</text>`);
      };
      P.forEach((p) => {
        if (p.k === 'poly') {
          const d = p.pts.map((q, i) => (i ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1)).join('') + (p.closed && p.pts.length > 2 ? 'Z' : '');
          if (p.lay !== 'sol') p.pts.forEach((q) => g(X(q[0]), Y(q[1])));
          out.push(`<path${p.tag ? ` data-tag="${p.tag}"` : ''} d="${d}" style="${(STY[p.lay] || STY.vu).split('#ID-').join('#' + id + '-')}${p.pts.length === 2 || !p.closed ? ';fill:none' : ''}"/>`);
          if (p.lay === 'sol' || p.lay === 'remblai') {   // terrain : trait du terrain et hachures courtes en dessous (convention de dessin), sans aplat
            const yb = Math.min(...p.pts.map((q) => q[1])), n = p.pts.length, sp = 3.2 * kp, tl = 2.2 * kp;
            let dd = '';
            for (let i = 0; i < n; i++) {
              const a = p.pts[i], b = p.pts[(i + 1) % n];
              if (Math.abs(a[1] - yb) < 1e-6 && Math.abs(b[1] - yb) < 1e-6) continue;         // fond de la zone
              const x1 = X(a[0]), y1 = Y(a[1]), x2 = X(b[0]), y2 = Y(b[1]), L = Math.hypot(x2 - x1, y2 - y1);
              if (L < 1 || Math.abs(y2 - y1) > 2 * Math.abs(x2 - x1)) continue;               // bords verticaux
              dd += `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
              for (let t = sp / 2; t < L; t += sp) { const x = x1 + (x2 - x1) * t / L, y = y1 + (y2 - y1) * t / L; dd += `M${x.toFixed(1)} ${y.toFixed(1)}l${(-tl * 0.7).toFixed(1)} ${(tl * 0.7).toFixed(1)}`; }
            }
            if (dd) out.push(`<path d="${dd}" style="fill:none;stroke:#2eb800;stroke-width:.5"/>`);
          }
        } else if (p.k === 'text') {
          const fs = p.ht * kp;
          T(X(p.p[0]), Y(p.p[1]) - p.dy * kp, p.s, fs, p.anchor, (p.bold ? ' font-weight="700"' : '') + (p.lay === 'titre' ? ' fill="#000"' : '') + (p.tag ? ` data-tag="${p.tag}"` : ''));
        } else if (p.k === 'title') {
          const fs = 7 * kp, x = X(p.p[0]), y = Y(p.p[1]);
          T(x, y, p.s, fs, 'middle');
          T(x, y + fs * 0.75, p.sub, 3.4 * kp, 'middle');
          if (p.sub2) T(x, y + fs * 1.65, p.sub2, 4.6 * kp, 'middle');
        } else if (p.k === 'dim') {
          if (opt.dims === false) return;
          const off = p.off * kp, fs = 2.9 * kp, ah = 1.8 * kp, aw = 0.32 * kp, ov = 1.2 * kp;
          const arr = (x, y, ux, uy) => `M${x.toFixed(1)} ${y.toFixed(1)}l${(-ux * ah - uy * aw).toFixed(1)} ${(-uy * ah + ux * aw).toFixed(1)}l${(2 * uy * aw).toFixed(1)} ${(-2 * ux * aw).toFixed(1)}Z`;
          if (p.dir === 'h') {
            const ya = Y(Math.max(p.a[1], p.b[1])) - off, x1 = Math.min(X(p.a[0]), X(p.b[0])), x2 = Math.max(X(p.a[0]), X(p.b[0]));
            const ea = Y(p.a[1]), eb = Y(p.b[1]), sg = (e) => (ya < e ? -ov : ov);
            out.push(`<path d="M${X(p.a[0]).toFixed(1)} ${ea.toFixed(1)}V${(ya + sg(ea)).toFixed(1)}M${X(p.b[0]).toFixed(1)} ${eb.toFixed(1)}V${(ya + sg(eb)).toFixed(1)}" class="dx"/>`);
            out.push(`<path d="M${x1.toFixed(1)} ${ya.toFixed(1)}H${x2.toFixed(1)}" class="dl"/>`);
            if (x2 - x1 > 2.2 * ah) out.push(`<path d="${arr(x1, ya, -1, 0)}${arr(x2, ya, 1, 0)}" class="da"/>`);
            else out.push(`<path d="${arr(x1, ya, 1, 0)}${arr(x2, ya, -1, 0)}" class="da"/><path d="M${(x1 - 2 * ah).toFixed(1)} ${ya.toFixed(1)}H${(x2 + 2 * ah).toFixed(1)}" class="dl"/>`);
            g(x1, ya); g(x2, ya);
            const w = String(p.s).length * fs * 0.55;
            const tx = w < x2 - x1 - 1 ? (x1 + x2) / 2 : (p.side === 'l' ? x1 - w / 2 - 2 : x2 + w / 2 + 2);
            T(tx, ya - 1.6, p.s, fs, 'middle', ' class="dt"');
          } else {
            const xa = X(p.a[0]) + off, y1 = Math.min(Y(p.a[1]), Y(p.b[1])), y2 = Math.max(Y(p.a[1]), Y(p.b[1]));
            const ea = X(p.a[0]), eb = X(p.b[0]), sg = (e) => (xa < e ? -ov : ov);
            if (Math.abs(off) > 0.5) out.push(`<path d="M${ea.toFixed(1)} ${Y(p.a[1]).toFixed(1)}H${(xa + sg(ea)).toFixed(1)}M${eb.toFixed(1)} ${Y(p.b[1]).toFixed(1)}H${(xa + sg(eb)).toFixed(1)}" class="dx"/>`);
            out.push(`<path d="M${xa.toFixed(1)} ${y1.toFixed(1)}V${y2.toFixed(1)}" class="dl"/>`);
            if (y2 - y1 > 2.2 * ah) out.push(`<path d="${arr(xa, y1, 0, -1)}${arr(xa, y2, 0, 1)}" class="da"/>`);
            else out.push(`<path d="${arr(xa, y1, 0, 1)}${arr(xa, y2, 0, -1)}" class="da"/><path d="M${xa.toFixed(1)} ${(y1 - 2 * ah).toFixed(1)}V${(y2 + 2 * ah).toFixed(1)}" class="dl"/>`);
            g(xa, y1); g(xa, y2);
            const w = String(p.s).length * fs * 0.55, ym = w < y2 - y1 - 1 ? (y1 + y2) / 2 : y2 + w / 2 + 2, xt = xa - 1.6;
            g(xt - fs, ym - w / 2); g(xt, ym + w / 2);
            out.push(`<text x="${xt.toFixed(1)}" y="${ym.toFixed(1)}" font-size="${fs.toFixed(1)}" text-anchor="middle" transform="rotate(-90 ${xt.toFixed(1)} ${ym.toFixed(1)})" class="dt">${esc(p.s)}</text>`);
          }
        } else if (p.k === 'brk') {
          const x1 = X(p.a[0]), x2 = X(p.b[0]), y = Y(p.a[1]), m = (x1 + x2) / 2;
          out.push(`<path d="M${x1.toFixed(1)} ${y.toFixed(1)}L${(m - 3).toFixed(1)} ${y.toFixed(1)}l2 -5l2 10l2 -5L${x2.toFixed(1)} ${y.toFixed(1)}" style="fill:none;stroke:#2b2e36;stroke-width:.8"/>`);
        }
      });
      return { out, ext };
    };
    let s = opt.scale || (Wpx - 2 * pad) / bw;
    let r = render(s);
    const geoW = bw * s, extra = (r.ext[2] - r.ext[0]) - geoW;
    if (!opt.scale && extra > 0) { s = Math.max(0.5, (Wpx - 2 * pad - extra) / bw); r = render(s); }
    const e = r.ext, vw = e[2] - e[0] + 2 * pad, vh = e[3] - e[1] + 2 * pad;
    const pat = (k, size, bg, ln, w, rot) => `<pattern id="${id}-${k}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot == null ? 45 : rot})"><rect width="${size}" height="${size}" fill="${bg}"/><line x1="0" y1="0" x2="0" y2="${size}" stroke="${ln}" stroke-width="${w}"/></pattern>`;
    const defs = '<defs>' + pat('b', 6, '#ffffff', '#9a9a9a', 0.6) + pat('p', 5, '#e8ebf0', '#a9b1bd', 0.7) + pat('d', 3, '#d9d9d9', '#888', 0.6, -45)
      + pat('h', 8, '#f7f3e8', '#cdbb8e', 0.9) + pat('w', 9, '#ffffff', '#a6a6a6', 0.8) + pat('o', 5, '#f6c27a', '#e07b00', 0.8) + `<pattern id="${id}-sr" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#efe6d3"/><circle cx="2" cy="2" r=".9" fill="#7b6a4a"/><circle cx="6" cy="5.5" r=".6" fill="#7b6a4a"/><path d="M4.5 1.5l1.5 1" stroke="#7b6a4a" stroke-width=".5"/></pattern>`
      + `<pattern id="${id}-sa" width="6" height="4" patternUnits="userSpaceOnUse"><rect width="6" height="4" fill="#e9dcc4"/><path d="M0 1h6M0 3h3" stroke="#8a6b3c" stroke-width=".5"/></pattern>`
      + `<pattern id="${id}-ss" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#f6ecc8"/><circle cx="1.5" cy="1.5" r=".5" fill="#9a8440"/><circle cx="4.5" cy="4" r=".5" fill="#9a8440"/></pattern>`
      + `<pattern id="${id}-sc" width="10" height="6" patternUnits="userSpaceOnUse"><rect width="10" height="6" fill="#eef0e6"/><path d="M0 .3h10M0 3.3h10M3 .3v3M8 3.3v2.7" stroke="#6f7860" stroke-width=".5"/></pattern>`
      + `<pattern id="${id}-sh2" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><rect width="7" height="7" fill="#dfe3e8"/><path d="M0 2h7M0 5h3" stroke="#5b6675" stroke-width=".55" stroke-dasharray="2 1"/></pattern>`
      + `<pattern id="${id}-sh" width="6" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(20)"><rect width="6" height="4" fill="#cfd6df"/><path d="M0 1h6M0 3h6" stroke="#3f4a59" stroke-width=".55"/></pattern>`
      + `<pattern id="${id}-sq" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#e6e1ee"/><path d="M0 8L8 0M-2 2L2 -2M6 10L10 6" stroke="#5c4e78" stroke-width=".6"/><path d="M0 0L8 8" stroke="#5c4e78" stroke-width=".3"/></pattern>`
      + `<pattern id="${id}-sk" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#e4e4e4"/><path d="M0 4h8M4 0v4M0 8h8M8 4v4" stroke="#555" stroke-width=".5"/></pattern>` + pat('k', 3, '#6e6e6e', '#3a3a3a', 0.6) + `<pattern id="${id}-s" width="34" height="22" patternUnits="userSpaceOnUse"><rect width="34" height="22" fill="#fff"/><path d="M2 4l8-2 6 4-2 7-9 1-4-5zM18 3l9 0 4 6-5 5-8-2zM6 14l8 1 3 6-9 1-4-4zM20 14l8 1 4 5-7 2-6-3z" fill="none" stroke="#9a9a9a" stroke-width=".7"/></pattern>`
      + `<pattern id="${id}-g" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#d8d0bf"/><circle cx="1.5" cy="1.5" r=".9" fill="#8d8170"/><circle cx="4.5" cy="4" r=".7" fill="#a59a88"/></pattern>`
      + `<linearGradient id="${id}-c" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#8f8f8f"/><stop offset=".35" stop-color="#f4f4f4"/><stop offset=".55" stop-color="#e2e2e2"/><stop offset="1" stop-color="#7d7d7d"/></linearGradient>`
      + `<style>text{font-family:Arial,Helvetica,sans-serif;fill:#000}.dx{stroke:#ff0000;stroke-width:.45;fill:none}.dl{stroke:#ff0000;stroke-width:.6;fill:none}.da{fill:#000;stroke:none}.dt{fill:#000}.tt{letter-spacing:.04em}</style></defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(e[0] - pad).toFixed(1)} ${(e[1] - pad).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" width="${vw.toFixed(0)}" height="${vh.toFixed(0)}" data-ox="${(-bx[0] * s).toFixed(2)}" role="img">${defs}${r.out.join('')}</svg>`;
  }

  /* coupe type d'une poutre VIPP — reproduction des coupes 1/20 des plans KLE (PRO2334, CO2334-0002) :
   *   table 1.50 à dévers (bords .12), sous-face inclinée (.05 / .07), goussets vers l'âme ;
   *   en travée : âme .23, goussets .110 × .10 / .132 × .12, talon .80 (gousset .350, hauteur .21) ;
   *   sur appuis : âme épaissie .40, chanfreins .025 × .023 / .047 × .042, talon (gousset .246),
   *   entretoise d'about vue en arrière-plan et repères « 40 ».  Origine : dessous du talon, axe de la poutre. */
  function poutreScene(M, o) {
    o = o || {};
    const S = M.S, sec = M.sec, i = sec.info || {};
    if (!i.btab || !['VIPP', 'PPBA'].includes(S.tablier.type)) return null;
    if (S.tablier.type === 'PPBA') return poutrePPBA(M, o);
    const ech = o.ech || 20, ap = o.where === 'appui', P = []; curEch = ech;
    const H = S.tablier.hp || rnd2(i.hb + 0.02), B = 1.50, dv = 0.02;          // hauteur à l'axe, demi-dévers sur la table
    const yTL = H - dv, yTR = H + dv, yL = yTL - 0.12, yR = yTR - 0.12;           // dessus et sous-face des bords de table
    const xgL = -B / 2 + 0.525, xgR = B / 2 - 0.503, ygL = yL - 0.05, ygR = yR - 0.07;
    const bw = ap ? 0.40 : 0.23, yW = ap ? null : H - 0.29;                      // âme ; départ de l'âme sous les goussets (travée)
    const yWL = ap ? ygL - 0.023 : yW, yWR = ap ? ygR - 0.042 : yW;
    const hg = ap ? 0.246 : 0.350, yT = 0.21, bt = 0.80;
    const pts = [[-B / 2, yTL], [0, H], [B / 2, yTR], [B / 2, yR], [xgR, ygR], [bw / 2, yWR], [bw / 2, yT + hg], [bt / 2, yT], [bt / 2, 0],
      [-bt / 2, 0], [-bt / 2, yT], [-bw / 2, yT + hg], [-bw / 2, yWL], [xgL, ygL], [-B / 2, yL]];
    poly(P, pts, 'hachP');
    if (ap) {   // entretoise d'about vue au-delà de la coupe
      poly(P, [[-B / 2, yL], [-B / 2, yT], [-bt / 2, yT]], 'vuT', false);
      poly(P, [[B / 2, yR], [B / 2, yT], [bt / 2, yT]], 'vuT', false);
      [-1, 1].forEach((sg) => { circ(P, sg * 0.48, 1.18, 0.045, 'rep', 20); text(P, [sg * 0.48, 1.18], '40', { ht: 2.6, dy: -0.9, lay: 'note' }); });
    }
    line(P, [0, H + 0.02], [0, 0], 'axeC');
    // cotes — disposition et valeurs du plan
    const f3 = (v) => Math.abs(v).toFixed(3).replace(/^0\./, '.');
    const dh = (x1, y1, x2, y2, yl, s_) => dim(P, [x1, y1], [x2, y2], 'h', (yl - Math.max(y1, y2)) * 1000 / ech, s_ || frn(Math.abs(x2 - x1)));
    const dvv = (x1, y1, x2, y2, xl, s_) => dim(P, [x1, y1], [x2, y2], 'v', (xl - x1) * 1000 / ech, s_ || frn(Math.abs(y2 - y1)));
    dh(-B / 2, yTL, B / 2, yTR, H + 0.30, frn(B));
    dh(-B / 2, yTL, 0, H, H + 0.16); dh(0, H, B / 2, yTR, H + 0.16);
    // gauche
    dvv(-B / 2, yTL, -B / 2, 0, -1.15, frn(yTL));
    dvv(-B / 2, yTL, -B / 2, yL, -1.0);
    dvv(-B / 2, yL, -B / 2, yT + hg, -1.0, ap && Math.abs(H - 2.30) < 1e-6 ? '1.71' : frn(yL - yT - hg));   // valeur du plan PRO2334
    dvv(-bt / 2, yT + hg, -bt / 2, yT, -1.0, f3(hg));
    dvv(-bt / 2, yT, -bt / 2, 0, -1.0);
    dvv(-B / 2, yL, -B / 2, ygL, -0.85);
    dvv(xgL, ygL, xgL, yWL, xgL - 0.05);
    const yc = Math.min(yWL, yWR) - 0.12;
    dh(-B / 2, yL, xgL, ygL, yc, f3(xgL + B / 2)); dh(xgL, ygL, -bw / 2, yWL, yc, f3(xgL + bw / 2));
    dh(-B / 2, yL, -bw / 2, yWL, yc - 0.10, f3(B / 2 - bw / 2));
    // droite
    dvv(B / 2, yTR, B / 2, 0, 1.15, frn(yTR));
    dvv(B / 2, yTR, B / 2, yR, 1.0);
    dvv(B / 2, yR, B / 2, yT, 1.0);
    dvv(bt / 2, yT, bt / 2, 0, 1.0);
    dvv(B / 2, yR, B / 2, ygR, 0.86);
    dvv(xgR, ygR, xgR, yWR, xgR + 0.18);
    dh(bw / 2, yWR, xgR, ygR, yc, f3(xgR - bw / 2)); dh(xgR, ygR, B / 2, yR, yc, f3(B / 2 - xgR));
    dh(bw / 2, yWR, B / 2, yR, yc - 0.10, f3(B / 2 - bw / 2));
    // axe et talon
    dvv(0, 0, 0, H, 0, frn(H));
    const yb = yT + hg + 0.25;
    const fT = (v) => (ap ? frn(v) : f3(v)); dh(-bt / 2, yT, -bw / 2, yT + hg, yb, fT(bt / 2 - bw / 2)); dh(-bw / 2, yT + hg, bw / 2, yT + hg, yb); dh(bw / 2, yT + hg, bt / 2, yT, yb, fT(bt / 2 - bw / 2));
    dh(-bt / 2, 0, bt / 2, 0, -0.18);
    P.push({ k: 'title', p: [0, H + 0.95], s: 'COUPE TYPE DES POUTRES', sub: 'Ech:1/' + ech, sub2: ap ? 'Sur Appuis' : 'En travée' });
    return { P, ech, titre: 'COUPE TYPE DES POUTRES — ' + (ap ? 'sur appuis' : 'en travée') };
  }
  const rnd2 = (v) => Math.round(v * 100) / 100;
  /* coupe type d'une poutre PPBA (programme PPBA KLE) : table 1,20 (.12 / .17), âme .40, talon .65 (.40 + gousset .10) */
  function poutrePPBA(M, o) {
    const ech = o.ech || 20, ap = o.where === 'appui', P = [], i = M.sec.info; curEch = ech;
    const H = rnd2(i.hb), B = i.btab, hs1 = i.etab, hs2 = i.etab + i.gtab, b0 = i.b0, bt = i.bt, ht1 = i.ht, ht2 = i.ht + i.gs;
    const R_ = [[B / 2, H], [B / 2, H - hs1], [b0 / 2, H - hs2], [b0 / 2, ht2], [bt / 2, ht1], [bt / 2, 0]];
    poly(P, R_.concat(R_.slice().reverse().map((q) => [-q[0], q[1]])), 'hachP');
    if (ap) { poly(P, [[-B / 2, H - hs1], [-B / 2, 0.25], [-bt / 2, 0.25]], 'vuT', false); poly(P, [[B / 2, H - hs1], [B / 2, 0.25], [bt / 2, 0.25]], 'vuT', false); }
    line(P, [0, H + 0.02], [0, 0], 'axeC');
    const dh = (x1, y1, x2, y2, yl, s_) => dim(P, [x1, y1], [x2, y2], 'h', (yl - Math.max(y1, y2)) * 1000 / ech, s_ || frn(Math.abs(x2 - x1)));
    const dv = (x1, y1, x2, y2, xl, s_) => dim(P, [x1, y1], [x2, y2], 'v', (xl - x1) * 1000 / ech, s_ || frn(Math.abs(y2 - y1)));
    dh(-B / 2, H, B / 2, H, H + 0.25); dh(-B / 2, H, 0, H, H + 0.12); dh(0, H, B / 2, H, H + 0.12);
    dh(-b0 / 2, H / 2, b0 / 2, H / 2, H / 2); dh(-bt / 2, 0, bt / 2, 0, -0.15);
    dv(B / 2, H, B / 2, H - hs1, B / 2 + 0.12); dv(B / 2, H - hs1, B / 2, H - hs2, B / 2 + 0.12); dv(B / 2, H - hs2, B / 2, ht2, B / 2 + 0.12); dv(B / 2, ht2, B / 2, ht1, B / 2 + 0.12); dv(B / 2, ht1, B / 2, 0, B / 2 + 0.12);
    dv(-B / 2, H, -B / 2, 0, -B / 2 - 0.2);
    P.push({ k: 'title', p: [0, H + 0.85], s: 'COUPE TYPE DES POUTRES', sub: 'Ech:1/' + ech, sub2: ap ? 'Sur Appuis' : 'En travée' });
    return { P, ech, titre: 'COUPE TYPE DES POUTRES PPBA — ' + (ap ? 'sur appuis' : 'en travée') };
  }

  return { elevScene, secScene, planScene, supScenes, poutreScene, toSVG };
});
