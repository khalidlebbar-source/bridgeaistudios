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
  const fr = C.fr, frn = (v) => C.fr(v, 2);

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
  const title = (P, p, s, ech) => P.push({ k: 'title', p, s, sub: 'Ech : 1/' + ech });
  /* repère avec ligne d'attache */
  const leader = (P, from, to, s, anchor) => { line(P, from, to, 'lead'); text(P, to, s, { ht: 1.9, anchor: anchor || 'start', dy: 0.6, lay: 'note' }); };

  /* ───────── Élévation (coupe longitudinale) ───────── */
  function elevScene(M) {
    const P = [], h = M.h, sec = M.sec, n = M.xs.length - 1, xs = M.xs, dab = M.dab, Ltot = M.Ltot, S = M.S;
    const ech = pickScale(Ltot + 2 * dab + 24, 400, [50, 100, 150, 200, 250, 500, 1000, 2000]);
    const mm = (v) => v * ech / 1000;
    const ySeat = -(h + 0.30);
    const T = M.T, fam = T.famille, rail = S.usage === 'rail';
    const yInner = fam === 'poutres' ? -sec.info.eh : fam === 'mixte' ? -sec.info.hs : null;

    // ── terrain naturel, remblais d'accès, talus perrés ──
    const xFo = (s) => {
      if (s.kind === 'pile') return s.x;
      const o = s.j === 0 ? -1 : 1, g = s.geo;
      const back = s.x + o * (dab + 0.05 + g.egg);
      if (g.mur && g.sommier) return back - o * (g.sommier.b - g.mur.e / 2);
      const w = g.sommier ? g.sommier.b : g.mur.e;
      return back - o * w / 2;
    };
    const tn = M.supports.map((s) => [xFo(s), ySeat - s.H + 0.6]);
    const xL = -dab - 14, xR = Ltot + dab + 14;
    const yBot = Math.min.apply(null, M.supports.map((s) => ySeat - s.H - (s.fo.mode === 'pieux' ? s.fo.e + s.fo.Lp : s.fo.e))) - 1.5;
    poly(P, [[xL, tn[0][1]]].concat(tn, [[xR, tn[tn.length - 1][1]], [xR, yBot], [xL, yBot]]), 'sol');
    line(P, [xL, tn[0][1]], tn[0], 'tn'); for (let i = 0; i < tn.length - 1; i++) line(P, tn[i], tn[i + 1], 'tn');
    line(P, tn[tn.length - 1], [xR, tn[tn.length - 1][1]], 'tn');
    M.supports.filter((s) => s.kind === 'culee').forEach((s) => {
      const o = s.j === 0 ? -1 : 1, g = s.geo, ytn = ySeat - s.H + 0.6;
      const back = s.x + o * (dab + 0.05 + g.egg), far = o < 0 ? xL : xR, yTop = -0.10;
      const yb = g.sommier ? ySeat - g.sommier.h : ytn;
      const xin = back - o * (g.sommier ? g.sommier.b : g.mur.e);
      if (g.type === 'enterree') {
        const dx = (yb - ytn) * 1.5;                   // talus 3/2 sous le chevêtre, perré
        poly(P, [[far, yTop], [back, yTop], [back, ySeat], [xin, ySeat], [xin, yb], [xin - o * dx, ytn], [far, ytn]], 'remblai');
        line(P, [xin, yb], [xin - o * dx, ytn], 'perre');
        text(P, [xin - o * dx * 0.55, (yb + ytn) / 2], 'Perré 3/2', { ht: 1.8, anchor: o < 0 ? 'start' : 'end', dy: 2, lay: 'note' });
      } else {                                          // culée remblayée : remblai contre le mur de front
        const xwb = xin + o * g.mur.e;
        poly(P, [[far, yTop], [back, yTop], [back, yb], [xwb, yb], [xwb, ytn], [far, ytn]], 'remblai');
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
        rect(P, s.x - g.lx / 2, yTopFut, s.x + g.lx / 2, yft, g.fut.kind === 'colonnes' ? 'col' : 'vuB');
      } else {
        const o = s.j === 0 ? -1 : 1;
        const front = s.x + o * (dab + 0.05), back = front + o * g.egg;
        // garde-grève avec corbeau d'appui de la dalle de transition
        poly(P, [[front, 0], [back, 0], [back, -0.40], [back + o * 0.30, -0.40], [back + o * 0.30, -0.70], [back, -0.85], [back, ySeat], [front, ySeat]], 'vuB');
        const yb = g.sommier ? ySeat - g.sommier.h : ySeat;
        // murs en retour suspendus (trapèze vu)
        const Lr = g.retours.L, ytail = g.type === 'enterree' ? -(g.retours.h2 || 0.9) : -1.2;
        poly(P, [[back, 0], [back + o * Lr, 0], [back + o * Lr, ytail], [back, g.type === 'enterree' ? yb : yft + 0.6]], 'vuL');
        if (g.sommier) {
          const xin = back - o * g.sommier.b;
          rect(P, back, ySeat, xin, yb, 'vuB');
          xf = (back + xin) / 2;
          if (g.colonnes) rect(P, xf - g.colonnes.D / 2, yb, xf + g.colonnes.D / 2, yft, 'col');
          else if (g.mur) { const xm = xin + o * g.mur.e; rect(P, xin, yb, xm, yft, 'vuB'); xf = (xin + xm) / 2; }   // mur de front sous l'appui
        } else {
          const xm = back - o * g.mur.e;
          rect(P, back, ySeat, xm, yft, 'vuB'); xf = (back + xm) / 2;
        }
        if (g.dt) {
          const L = g.dt.L, x2 = back + o * (0.30 + L), sl = 0.05;
          poly(P, [[back + o * 0.30, -0.40], [x2, -0.40 - L * sl], [x2, -0.70 - L * sl], [back + o * 0.30, -0.70]], 'vuB');
          poly(P, [[back + o * 0.30, -0.70], [x2, -0.70 - L * sl], [x2, -0.80 - L * sl], [back + o * 0.30, -0.80]], 'prop');
        }
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
    const yT = 1.6 + mm(30);
    title(P, [Ltot / 2, yT], 'COUPE LONGITUDINALE', ech);
    return { P, ech, titre: 'COUPE LONGITUDINALE — échelle 1/' + ech };
  }

  /* ───────── Coupe transversale (tablier + pile) ───────── */
  function secScene(M) {
    const P = [], h = M.h, sec = M.sec, W = M.W, rail = M.S.usage === 'rail', S = M.S, fam = M.T.famille;
    const ech = pickScale(W + 4, 190, [20, 25, 50, 75, 100, 200]);
    const mm = (v) => v * ech / 1000;
    // tablier coupé (hachuré)
    sec.polys.forEach((p) => poly(P, p.pts, p.mat === 'acier' ? 'acier' : (p.role === 'poutre' ? 'prefa' : 'beton')));
    if (fam === 'poutres' && sec.info.btab) {        // prédalles entre tables de poutres
      const i = sec.info;
      for (let k = 0; k < sec.nbPoutres - 1; k++) {
        const xa = i.x0 + k * sec.entraxe + i.btab / 2, xb = i.x0 + (k + 1) * sec.entraxe - i.btab / 2;
        if (xb - xa > 0.1) rect(P, xa - 0.04, -i.eh, xb + 0.04, -i.eh - 0.06, 'pred');
      }
    }
    tagFrom(P, 0, 'tablier');
    if (fam === 'poutres') {                          // entretoise d'about vue
      const i = sec.info;
      for (let k = 0; k < sec.nbPoutres - 1; k++) {
        const xa = i.x0 + k * sec.entraxe + i.b0 / 2, xb = i.x0 + (k + 1) * sec.entraxe - i.b0 / 2;
        rect(P, xa, -i.eh - i.etab - 0.10, xb, -(h - 0.25), 'vu');
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
      const x1 = -W / 2 + tG, x2 = x1 + w, rev = S.equip.revetement, dv = 0.025;
      // revêtement en toit à 2,5 % et étanchéité
      if (rev > 0) {
        const yc = rev + dv * (w / 2) * 0.6;
        poly(P, [[x1, 0.01], [x2, 0.01], [x2, rev], [(x1 + x2) / 2, yc], [x1, rev]], 'rev');
        if (S.equip.etancheite) line(P, [x1, 0.005], [x2, 0.005], 'etan');
        leader(P, [x2 - w * 0.22, rev * 0.9], [x2 - w * 0.12, rev + 0.55], 'Revêtement ' + fr(rev * 100, 0) + ' cm');
        if (S.equip.etancheite) leader(P, [x2 - w * 0.20, 0.0], [x2 - w * 0.12, rev + 0.32], 'Étanchéité 5 mm');
        [-1, 1].forEach((o) => { line(P, [o * w * 0.12, rev + 0.28], [o * w * 0.30, rev + 0.28], 'note'); text(P, [o * w * 0.21, rev + 0.28], '2,5 %', { ht: 1.9, dy: 0.8, lay: 'note' }); });
      }
      [-1, 1].forEach((o) => {
        const xe = o * W / 2, tw = o < 0 ? tG : tD, xin = o < 0 ? x1 : x2, hc = S.equip.corniches ? 0.25 : 0;
        // corniche préfabriquée (sombre) au nu extérieur
        if (S.equip.corniches) poly(P, [[xe, 0.30], [xe - o * 0.25, 0.30], [xe - o * 0.25, 0.0], [xe, 0.0], [xe, -0.40], [xe + o * 0.06, -0.48], [xe + o * 0.06, 0.30]], 'corn');
        // longrine / trottoir avec fourreaux
        if (tw > hc + 0.05) {
          const xa = xe - o * hc, ht = 0.24;
          rect(P, xa, 0, xin, ht, 'beton');
          const nf = Math.max(1, Math.min(4, Math.floor((Math.abs(xin - xa) - 0.30) / 0.17)));
          for (let k = 0; k < nf; k++) circ(P, xa - o * (0.25 + k * 0.17), ht / 2, 0.06, 'four');
          text(P, [xin + o * 0.15, ht + 0.25], 'L.R', { ht: 1.8, anchor: o < 0 ? 'start' : 'end', lay: 'note' });
        }
        const yb = tw > hc + 0.05 ? 0.24 : 0;
        if (S.equip.retenue === 'BN4') {               // barrière BN4 sur longrine
          const xp = xin - o * 0.20;
          line(P, [xp, yb], [xp, yb + 0.95], 'gc');
          rect(P, xp + o * 0.02, yb + 0.58, xp + o * 0.14, yb + 0.80, 'gcR');
          line(P, [xp - 0.06, yb + 0.95], [xp + 0.06, yb + 0.95], 'gc');
          text(P, [xp, yb + 1.15], 'BN4', { ht: 1.8, lay: 'note' });
        } else if (S.equip.retenue === 'GBA') {
          const xp = xin - o * 0.30;
          poly(P, [[xp - 0.30, yb], [xp + 0.30, yb], [xp + 0.12, yb + 0.25], [xp + 0.08, yb + 0.80], [xp - 0.08, yb + 0.80], [xp - 0.12, yb + 0.25]], 'beton');
        }
        // garde-corps sur corniche
        const xg = xe - o * 0.12;
        line(P, [xg, 0.30], [xg, 1.10], 'gc'); line(P, [xg - 0.05, 1.10], [xg + 0.05, 1.10], 'gc');
      });
      top = 1.5;
      const ch = [[-W / 2, x1], [x1, x2], [x2, W / 2]].filter((c) => c[1] - c[0] > 1e-6);
      if (ch.length > 1) ch.forEach((c) => dim(P, [c[0], top], [c[1], top], 'h', 3, frn(c[1] - c[0])));
    }
    dim(P, [-W / 2, top], [W / 2, top], 'h', rail ? 11 : 10, frn(W));
    line(P, [0, top + mm(16)], [0, -h - 0.6], 'axe');
    dim(P, [W / 2, 0], [W / 2, -h], 'v', 9, frn(h));
    // entraxes des poutres (comme sur les plans)
    if (fam === 'poutres' && sec.info.x0 != null) {
      const xsP = [-W / 2]; for (let k = 0; k < sec.nbPoutres; k++) xsP.push(sec.info.x0 + k * sec.entraxe); xsP.push(W / 2);
      for (let k = 0; k < xsP.length - 1; k++) dim(P, [xsP[k], -h], [xsP[k + 1], -h], 'h', -4, frn(xsP[k + 1] - xsP[k]));
    }
    tagFrom(P, iEq, 'equip');
    const ySeat = -(h + 0.30);
    // bossages et appareils d'appui
    sec.bear.forEach((x) => { rect(P, x - 0.25, -h, x + 0.25, -h - 0.10, 'app'); rect(P, x - 0.32, -h - 0.10, x + 0.32, ySeat, 'vuB'); });

    // ── pile la plus haute ──
    const piles = M.supports.filter((s) => s.kind === 'pile');
    let ref = null, iP = P.length;
    {
      ref = piles.length ? piles.reduce((a, b) => (b.H > a.H ? b : a)) : M.supports[0];
      iP = P.length;
      let g = ref.geo;
      if (ref.kind === 'culee') {                     // ouvrage à une travée : coupe sur culée
        const so = g.sommier;
        g = {
          ch: so ? { kind: 'chevetre', L: W, h: so.h, b: so.b } : null,
          fut: g.colonnes ? { kind: 'colonnes', D: g.colonnes.D, n: g.colonnes.n, s: g.colonnes.s } : { kind: 'voile', L: W },
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
        } else rect(P, -g.ch.L / 2, ySeat, g.ch.L / 2, ySeat - g.ch.h, 'beton');
        yTop = ySeat - g.ch.h;
        if (fam === 'poutres' && sec.nbPoutres >= 2 && ref.kind === 'pile') {   // butée de sécurité (et non blocage)
          const k = Math.floor((sec.nbPoutres - 1) / 2), xb = sec.info.x0 + (k + 0.5) * sec.entraxe;
          rect(P, xb - 0.40, ySeat, xb + 0.40, ySeat + 0.73, 'vuB');
          leader(P, [xb + 0.2, ySeat + 0.5], [xb + 1.2, ySeat + 1.1], 'Butée de sécurité');
        }
        dim(P, [g.ch.L / 2, ySeat], [g.ch.L / 2, ySeat - g.ch.h], 'v', 6, frn(g.ch.h));
      }
      const futRect = (x0, x1, lay) => {
        if (!cut) return rect(P, x0, yTop, x1, yft, lay);
        rect(P, x0, yTop, x1, yC1, lay); rect(P, x0, yC2, x1, yft, lay);
        P.push({ k: 'brk', a: [x0 - 0.15, yC1], b: [x1 + 0.15, yC1] }, { k: 'brk', a: [x0 - 0.15, yC2], b: [x1 + 0.15, yC2] });
      };
      let xcols = [];
      if (g.fut.kind === 'voile') futRect(-g.fut.L / 2, g.fut.L / 2, 'vuB');
      else if (g.fut.kind === 'marteau') futRect(-g.fut.b / 2, g.fut.b / 2, 'vuB');
      else for (let i = 0; i < g.fut.n; i++) { const x = -(g.fut.n - 1) * g.fut.s / 2 + i * g.fut.s; xcols.push(x); futRect(x - g.fut.D / 2, x + g.fut.D / 2, 'col'); }
      if (xcols.length) {
        const Lc = g.ch.L, ch = [-Lc / 2].concat(xcols, [Lc / 2]);
        for (let k = 0; k < ch.length - 1; k++) dim(P, [ch[k], yTop], [ch[k + 1], yTop], 'h', -5, frn(ch[k + 1] - ch[k]));
        const xc = xcols[xcols.length - 1];
        dim(P, [xc - g.fut.D / 2, yTop - 1.6], [xc + g.fut.D / 2, yTop - 1.6], 'h', 2, 'Ø' + frn(g.fut.D));
      }
      const f = ref.fo;
      const ytn = yft + 0.6, half = Math.max(W / 2, (f.mode === 'pieux' ? f.Ly : f.L) / 2) + 1.5;
      let yLow;
      if (f.mode === 'superficielle') {
        rect(P, -f.L / 2, yft, f.L / 2, yft - f.e, 'beton');
        rect(P, -f.L / 2 - 0.1, yft - f.e, f.L / 2 + 0.1, yft - f.e - 0.1, 'prop');
        dim(P, [-f.L / 2, yft - f.e - 0.1], [f.L / 2, yft - f.e - 0.1], 'h', -6, frn(f.L));
        dim(P, [f.L / 2, yft], [f.L / 2, yft - f.e], 'v', 6, frn(f.e));
        yLow = yft - f.e - 0.1;
      } else {
        rect(P, -f.Ly / 2, yft, f.Ly / 2, yft - f.e, 'beton');
        rect(P, -f.Ly / 2 - 0.1, yft - f.e, f.Ly / 2 + 0.1, yft - f.e - 0.1, 'prop');
        const Lv = Math.min(f.Lp, 4);
        for (let i = 0; i < f.m; i++) {
          const x = -(f.m - 1) * f.sy / 2 + i * f.sy;
          rect(P, x - f.D / 2, yft - f.e - 0.1, x + f.D / 2, yft - f.e - Lv, 'pieu');
          if (Lv < f.Lp) P.push({ k: 'brk', a: [x - f.D / 2 - 0.15, yft - f.e - Lv], b: [x + f.D / 2 + 0.15, yft - f.e - Lv] });
        }
        dim(P, [-f.Ly / 2, yft - f.e], [f.Ly / 2, yft - f.e], 'h', -5, frn(f.Ly));
        text(P, [0, yft - f.e - Lv], f.m + ' × ' + f.nr + ' pieux Ø' + fr(f.D, 2) + ' — L = ' + frn(f.Lp) + ' m', { ht: 2.2, dy: -6, lay: 'note' });
        yLow = yft - f.e - Lv;
      }
      poly(P, [[-half, ytn], [half, ytn], [half, yLow - 0.6], [-half, yLow - 0.6]], 'sol');
      line(P, [-half, ytn], [half, ytn], 'tn');
      const xd = (g.fut.kind === 'voile' ? g.fut.L : g.fut.kind === 'marteau' ? g.fut.b : (g.fut.n - 1) * g.fut.s + g.fut.D) / 2;
      dim(P, [-xd, yTop], [-xd, yft], 'v', -6, frn(ref.H - hch));
    }
    tagFrom(P, iP, ref.id);
    P.sort((a, b) => (a.lay === 'sol' ? -1 : 0) - (b.lay === 'sol' ? -1 : 0));
    const tt = 'COUPE TRANSVERSALE SUR ' + (ref.kind === 'pile' ? 'PILE ' : 'CULÉE ') + ref.id;
    title(P, [0, top + mm(26)], tt, ech);
    return { P, ech, titre: tt + ' — échelle 1/' + ech, pile: ref.id };
  }

  /* ───────── Rendu SVG ───────── */
  /* Habillage des plans KLE : béton coupé hachuré, colonnes ombrées, cotes rouges, axes magenta,
     corniches préfabriquées sombres, équipements violets. #ID- est remplacé par l'identifiant du dessin. */
  const STY = {
    beton: 'fill:url(#ID-b);stroke:#1e1e1e;stroke-width:.9',
    prefa: 'fill:url(#ID-p);stroke:#1e1e1e;stroke-width:.9',
    pred: 'fill:url(#ID-d);stroke:#1e1e1e;stroke-width:.5',
    vuB: 'fill:#ececec;stroke:#2b2b2b;stroke-width:.8',
    vuL: 'fill:#fbfaf6;stroke:#3a3a3a;stroke-width:.7',
    cornE: 'fill:#8a8a8a;stroke:#2b2b2b;stroke-width:.6',
    gcF: 'fill:none;stroke:#7048e8;stroke-width:.6',
    vuT: 'fill:none;stroke:#4a4a4a;stroke-width:.6',
    col: 'fill:url(#ID-c);stroke:#2b2b2b;stroke-width:.8',
    acier: 'fill:#9fb3cc;stroke:#1f3a5f;stroke-width:.9',
    acierL: 'fill:none;stroke:#1f3a5f;stroke-width:1.3;stroke-dasharray:6 3',
    vu: 'fill:none;stroke:#6f6f6f;stroke-width:.7;stroke-dasharray:4 2.5',
    axe: 'fill:none;stroke:#d6336c;stroke-width:.7;stroke-dasharray:14 3 2 3',
    tn: 'fill:none;stroke:#5c940d;stroke-width:1.2',
    sol: 'fill:url(#ID-h);stroke:none',
    remblai: 'fill:#f6f1e3;stroke:#a68d5b;stroke-width:.6',
    perre: 'fill:none;stroke:#8a6a2a;stroke-width:2.4;stroke-dasharray:3 2',
    pieu: 'fill:#f3f3f3;stroke:#2b2b2b;stroke-width:.8;stroke-dasharray:6 3',
    prop: 'fill:#cfcfcf;stroke:#555;stroke-width:.4',
    app: 'fill:#222;stroke:#111;stroke-width:.5',
    corn: 'fill:#575757;stroke:#1e1e1e;stroke-width:.7',
    rev: 'fill:#9b9b9b;stroke:#444;stroke-width:.4',
    etan: 'fill:none;stroke:#111;stroke-width:1.4',
    four: 'fill:#fff;stroke:#1e1e1e;stroke-width:.6',
    gc: 'fill:none;stroke:#7048e8;stroke-width:1.5;stroke-linecap:round',
    gcR: 'fill:#d0bfff;stroke:#7048e8;stroke-width:.8',
    equip: 'fill:#d8dde4;stroke:#3d4a5c;stroke-width:.8',
    trottoir: 'fill:#dde3ea;stroke:#3d4a5c;stroke-width:.8',
    ballast: 'fill:url(#ID-g);stroke:#6e6455;stroke-width:.7',
    lead: 'fill:none;stroke:#1e1e1e;stroke-width:.5',
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
        } else if (p.k === 'text') {
          const fs = p.ht * kp;
          T(X(p.p[0]), Y(p.p[1]) - p.dy * kp, p.s, fs, p.anchor, (p.bold ? ' font-weight="700"' : '') + (p.lay === 'titre' ? ' fill="#c2255c"' : '') + (p.tag ? ` data-tag="${p.tag}"` : ''));
        } else if (p.k === 'title') {
          const fs = 3.4 * kp, x = X(p.p[0]), y = Y(p.p[1]), w = p.s.length * fs * 0.6;
          T(x, y, p.s, fs, 'middle', ' font-weight="700" font-style="italic" class="tt"');
          out.push(`<path d="M${(x - w / 2).toFixed(1)} ${(y + fs * 0.25).toFixed(1)}h${w.toFixed(1)}" style="stroke:#1e1e1e;stroke-width:1"/>`);
          T(x, y + fs * 1.15, p.sub, fs * 0.62, 'middle', ' font-style="italic"');
        } else if (p.k === 'dim') {
          if (opt.dims === false) return;
          const off = p.off * kp, fs = 2.2 * kp, tk = 3;
          if (p.dir === 'h') {
            const ya = Y(Math.max(p.a[1], p.b[1])) - off, x1 = X(p.a[0]), x2 = X(p.b[0]);
            out.push(`<path d="M${x1.toFixed(1)} ${Y(p.a[1]).toFixed(1)}V${ya.toFixed(1)}M${x2.toFixed(1)} ${Y(p.b[1]).toFixed(1)}V${ya.toFixed(1)}" class="dx"/>`);
            out.push(`<path d="M${(x1 - 4).toFixed(1)} ${ya.toFixed(1)}H${(x2 + 4).toFixed(1)}M${(x1 - tk).toFixed(1)} ${(ya + tk).toFixed(1)}l${2 * tk} ${-2 * tk}M${(x2 - tk).toFixed(1)} ${(ya + tk).toFixed(1)}l${2 * tk} ${-2 * tk}" class="dl"/>`);
            g(x1, ya); g(x2, ya);
            if (Math.abs(x2 - x1) > fs * 1.2) T((x1 + x2) / 2, ya - 2.5, p.s, fs, 'middle', ' class="dt"');
          } else {
            const xa = X(p.a[0]) + off, y1 = Y(p.a[1]), y2 = Y(p.b[1]);
            out.push(`<path d="M${X(p.a[0]).toFixed(1)} ${y1.toFixed(1)}H${xa.toFixed(1)}M${X(p.b[0]).toFixed(1)} ${y2.toFixed(1)}H${xa.toFixed(1)}" class="dx"/>`);
            out.push(`<path d="M${xa.toFixed(1)} ${(Math.min(y1, y2) - 4).toFixed(1)}V${(Math.max(y1, y2) + 4).toFixed(1)}M${(xa - tk).toFixed(1)} ${(y1 + tk).toFixed(1)}l${2 * tk} ${-2 * tk}M${(xa - tk).toFixed(1)} ${(y2 + tk).toFixed(1)}l${2 * tk} ${-2 * tk}" class="dl"/>`);
            g(xa, y1); g(xa, y2);
            const xm = xa + (off >= 0 ? 3 : -3), ym = (y1 + y2) / 2;
            const w = String(p.s).length * fs * 0.56;
            g(off >= 0 ? xm : xm - w, ym - fs); g(off >= 0 ? xm + w : xm, ym + fs);
            out.push(`<text x="${xm.toFixed(1)}" y="${(ym + fs * 0.35).toFixed(1)}" font-size="${fs.toFixed(1)}" text-anchor="${off >= 0 ? 'start' : 'end'}" class="dt">${esc(p.s)}</text>`);
          }
        } else if (p.k === 'brk') {
          const x1 = X(p.a[0]), x2 = X(p.b[0]), y = Y(p.a[1]), m = (x1 + x2) / 2;
          out.push(`<path d="M${x1.toFixed(1)} ${y.toFixed(1)}L${(m - 3).toFixed(1)} ${y.toFixed(1)}l2 -5l2 10l2 -5L${x2.toFixed(1)} ${y.toFixed(1)}" style="fill:none;stroke:#2b2e36;stroke-width:.8"/>`);
        }
      });
      return { out, ext };
    };
    let s = (Wpx - 2 * pad) / bw;
    let r = render(s);
    const geoW = bw * s, extra = (r.ext[2] - r.ext[0]) - geoW;
    if (extra > 0) { s = Math.max(0.5, (Wpx - 2 * pad - extra) / bw); r = render(s); }
    const e = r.ext, vw = e[2] - e[0] + 2 * pad, vh = e[3] - e[1] + 2 * pad;
    const pat = (k, size, bg, ln, w, rot) => `<pattern id="${id}-${k}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot == null ? 45 : rot})"><rect width="${size}" height="${size}" fill="${bg}"/><line x1="0" y1="0" x2="0" y2="${size}" stroke="${ln}" stroke-width="${w}"/></pattern>`;
    const defs = '<defs>' + pat('b', 5, '#efefef', '#b3b3b3', 0.7) + pat('p', 5, '#e8ebf0', '#a9b1bd', 0.7) + pat('d', 3, '#d9d9d9', '#888', 0.6, -45)
      + pat('h', 8, '#f7f3e8', '#cdbb8e', 0.9)
      + `<pattern id="${id}-g" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#d8d0bf"/><circle cx="1.5" cy="1.5" r=".9" fill="#8d8170"/><circle cx="4.5" cy="4" r=".7" fill="#a59a88"/></pattern>`
      + `<linearGradient id="${id}-c" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#8f8f8f"/><stop offset=".35" stop-color="#f4f4f4"/><stop offset=".55" stop-color="#e2e2e2"/><stop offset="1" stop-color="#7d7d7d"/></linearGradient>`
      + `<style>text{font-family:'Arial Narrow','Segoe UI',Arial,sans-serif;fill:#14171f}.dx{stroke:#e03131;stroke-width:.45;fill:none}.dl{stroke:#e03131;stroke-width:.7;fill:none}.dt{fill:#1e1e1e}.tt{letter-spacing:.04em}</style></defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(e[0] - pad).toFixed(1)} ${(e[1] - pad).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" width="${vw.toFixed(0)}" height="${vh.toFixed(0)}" role="img">${defs}${r.out.join('')}</svg>`;
  }

  return { elevScene, secScene, toSVG };
});
