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

  const pickScale = (len, maxmm, list) => list.find((e) => len / e * 1000 <= maxmm) || list[list.length - 1];

  /* ───────── Élévation longitudinale ───────── */
  function elevScene(M) {
    const P = [], h = M.h, sec = M.sec, n = M.xs.length - 1, xs = M.xs, dab = M.dab, Ltot = M.Ltot;
    const ech = pickScale(Ltot + 2 * dab + 24, 400, [50, 100, 200, 250, 500, 1000, 2000]);
    const mm = (v) => v * ech / 1000;
    const ySeat = -(h + 0.30);
    const T = M.T, fam = T.famille;
    const yInner = fam === 'poutres' ? -sec.info.eh : fam === 'mixte' ? -sec.info.hs : null;

    // ── terrain et remblais (dessinés en premier) ──
    const ft = M.supports.map((s) => ({ s, x: s.x, yft: ySeat - s.H }));
    const xFo = (s) => {
      if (s.kind === 'pile') return s.x;
      const o = s.j === 0 ? -1 : 1, g = s.geo;
      const back = s.x + o * (dab + 0.05 + g.egg);
      const w = g.type === 'enterree' ? g.sommier.b : g.mur.e;
      return back - o * w / 2;
    };
    const tn = ft.map((f) => [xFo(f.s), f.yft + 0.6]);
    const xL = -dab - 14, xR = Ltot + dab + 14;
    let yBot = Math.min.apply(null, M.supports.map((s) => ySeat - s.H - (s.fo.mode === 'pieux' ? s.fo.e + s.fo.Lp : s.fo.e))) - 1.5;
    const ground = [[xL, tn[0][1]]].concat(tn, [[xR, tn[tn.length - 1][1]], [xR, yBot], [xL, yBot]]);
    poly(P, ground, 'sol');
    line(P, [xL, tn[0][1]], tn[0], 'tn'); for (let i = 0; i < tn.length - 1; i++) line(P, tn[i], tn[i + 1], 'tn');
    line(P, tn[tn.length - 1], [xR, tn[tn.length - 1][1]], 'tn');

    // remblais d'accès
    M.supports.filter((s) => s.kind === 'culee').forEach((s) => {
      const o = s.j === 0 ? -1 : 1, g = s.geo, ytn = ySeat - s.H + 0.6;
      const back = s.x + o * (dab + 0.05 + g.egg);
      const far = o < 0 ? xL : xR, yTop = -0.05;
      if (g.type === 'enterree') {
        const xin = back - o * g.sommier.b, yin = ySeat - g.sommier.h;
        const dx = (yin - ytn) * 1.5;
        poly(P, [[far, yTop], [back, yTop], [back, ySeat], [xin, ySeat], [xin, yin], [xin - o * dx, ytn], [far, ytn]], 'remblai');
      } else {
        poly(P, [[far, yTop], [back, yTop], [back, ytn], [far, ytn]], 'remblai');
      }
    });

    // ── tablier ──
    const deckPiece = (x0, x1, y0, y1, lay) => rect(P, x0, y0, x1, y1, lay);
    if (M.cont) {
      if (fam === 'mixte') { deckPiece(-dab, Ltot + dab, 0, yInner, 'beton'); deckPiece(-dab + 0.2, Ltot + dab - 0.2, yInner, -h, 'acier'); }
      else deckPiece(-dab, Ltot + dab, 0, -h, 'beton');
      if (fam === 'prp') line(P, [-dab + 0.1, -h + 0.02], [Ltot + dab - 0.1, -h + 0.02], 'acierL');
    } else {
      const cont = M.S.tablier.dalleContinuite && fam === 'poutres';
      if (fam === 'poutres' && cont) deckPiece(-dab, Ltot + dab, 0, yInner, 'beton');
      for (let i = 0; i < n; i++) {
        const x0 = i === 0 ? -dab : xs[i] + 0.03, x1 = i === n - 1 ? Ltot + dab : xs[i + 1] - 0.03;
        if (fam === 'poutres') {
          if (!cont) deckPiece(x0, x1, 0, yInner, 'beton');
          deckPiece(x0, x1, yInner, -h, 'prefa');
        } else if (fam === 'mixte') { deckPiece(x0, x1, 0, yInner, 'beton'); deckPiece(x0 + 0.2, x1 - 0.2, yInner, -h, 'acier'); }
        else deckPiece(x0, x1, 0, -h, 'beton');
      }
    }

    // appareils d'appui
    M.lines.forEach((l) => {
      rect(P, l.x - 0.22, -h, l.x + 0.22, -h - 0.12, 'app');
      rect(P, l.x - 0.35, -h - 0.12, l.x + 0.35, ySeat, 'beton');
    });

    // ── appuis ──
    M.supports.forEach((s) => {
      const g = s.geo, yft = ySeat - s.H;
      let xf = s.x;
      if (s.kind === 'pile') {
        let yTopFut = ySeat;
        if (g.ch) {
          rect(P, s.x - g.ch.b / 2, ySeat, s.x + g.ch.b / 2, ySeat - g.ch.h, 'beton');
          yTopFut = ySeat - g.ch.h;
        }
        rect(P, s.x - g.lx / 2, yTopFut, s.x + g.lx / 2, yft, 'beton');
      } else {
        const o = s.j === 0 ? -1 : 1;
        const front = s.x + o * (dab + 0.05);         // nu avant du garde-grève
        const back = front + o * g.egg;
        rect(P, front, 0, back, ySeat, 'beton');       // garde-grève
        if (g.type === 'enterree') {
          const xin = back - o * g.sommier.b;
          rect(P, back, ySeat, xin, ySeat - g.sommier.h, 'beton');
          xf = (back + xin) / 2;
          if (g.colonnes) rect(P, xf - g.colonnes.D / 2, ySeat - g.sommier.h, xf + g.colonnes.D / 2, yft, 'beton');
          // mur en retour vu
          poly(P, [[back, 0], [back + o * g.retours.L, 0], [back + o * g.retours.L, -0.6], [back, ySeat - g.sommier.h + 0.3]], 'vu');
        } else {
          const xin = back - o * g.mur.e;
          rect(P, back, ySeat, xin, yft, 'beton');
          xf = (back + xin) / 2;
          poly(P, [[back, 0], [back + o * g.retours.L, 0], [back + o * g.retours.L, -1.0], [back, yft + 0.6]], 'vu');
        }
        if (g.dt) rect(P, back, -0.40, back + o * g.dt.L, -0.70, 'beton');
      }
      // fondation
      const f = s.fo;
      if (f.mode === 'superficielle') {
        rect(P, xf - f.B / 2, yft, xf + f.B / 2, yft - f.e, 'beton');
        rect(P, xf - f.B / 2 - 0.1, yft - f.e, xf + f.B / 2 + 0.1, yft - f.e - 0.10, 'vu');
      } else {
        const sansMassif = f.e === 0;
        const yb = sansMassif ? (s.geo.sommier ? ySeat - s.geo.sommier.h : yft) : yft - f.e;
        if (!sansMassif) rect(P, xf - f.Lx / 2, yft, xf + f.Lx / 2, yb, 'beton');
        for (let r = 0; r < f.nr; r++) {
          const xp = xf + (r - (f.nr - 1) / 2) * f.s;
          rect(P, xp - f.D / 2, yb, xp + f.D / 2, yb - f.Lp, 'pieu');
        }
      }
      // axe et repère
      line(P, [s.x, 1.2 + mm(4)], [s.x, yft - (f.mode === 'pieux' ? 0 : f.e + 0.3)], 'axe');
      text(P, [s.x, 1.2 + mm(6)], s.id, { ht: 3, lay: 'titre', bold: true });
    });

    // ── cotes ──
    for (let i = 0; i < n; i++) dim(P, [xs[i], 0], [xs[i + 1], 0], 'h', 9, frn(xs[i + 1] - xs[i]));
    if (n > 1) dim(P, [0, 0], [Ltot, 0], 'h', 17, frn(Ltot));
    dim(P, [xs[1] * 0.25, 0], [xs[1] * 0.25, -h], 'v', 4, frn(h));
    M.supports.filter((s) => s.kind === 'pile').forEach((s) => {
      dim(P, [s.x + s.geo.lx / 2, ySeat], [s.x + s.geo.lx / 2, ySeat - s.H], 'v', 5, frn(s.H));
    });
    M.supports.forEach((s) => {
      const f = s.fo, yft = ySeat - s.H;
      const lab = f.mode === 'pieux' ? f.n + ' pieux Ø' + fr(f.D, 2) + ' L=' + frn(f.Lp) : 'Semelle ' + fr(f.B, 2) + '×' + fr(f.L, 2);
      text(P, [s.x, (f.mode === 'pieux' ? yft - (f.e || 0) - f.Lp : yft - f.e - 0.1)], lab, { ht: 2, dy: -4, lay: 'texte' });
    });
    return { P, ech, titre: 'ÉLÉVATION — échelle 1/' + ech };
  }

  /* ───────── Coupe transversale (tablier + appui) ───────── */
  function secScene(M) {
    const P = [], h = M.h, sec = M.sec, W = M.W, rail = M.S.usage === 'rail', S = M.S;
    const ech = pickScale(W + 4, 190, [20, 25, 50, 75, 100, 200]);
    const mm = (v) => v * ech / 1000;
    sec.polys.forEach((p) => poly(P, p.pts, p.mat === 'acier' ? 'acier' : (p.role === 'poutre' ? 'prefa' : 'beton')));
    if (M.T.famille === 'poutres') {
      const b = sec.entraxe, x0 = -W / 2 + b / 2;
      for (let i = 0; i < sec.nbPoutres - 1; i++) {
        const xa = x0 + i * b + sec.info.b0 / 2, xb = x0 + (i + 1) * b - sec.info.b0 / 2;
        rect(P, xa, -sec.info.eh, xb, -(h - 0.2), 'vu');
      }
    }
    if (M.T.famille === 'mixte') {
      const a = sec.info.a, yt = -sec.info.hs - 0.15, yb = -h + 0.25;
      rect(P, -a / 2 + 0.02, yt, a / 2 - 0.02, yt - Math.max(0.4, (yt - yb) * 0.55), 'vu');
    }
    // équipements
    let top = 0;
    if (rail) {
      const ax = M.PT.axesVoies, xa = Math.min.apply(null, ax) - 2.3, xb = Math.max.apply(null, ax) + 2.3;
      const xl = Math.max(xa, -W / 2 + 1.0), xr = Math.min(xb, W / 2 - 1.0);
      poly(P, [[xl, 0], [xr, 0], [xr - 0.9, 0.6], [xl + 0.9, 0.6]], 'ballast');
      ax.forEach((x, i) => {
        rect(P, x - 1.3, 0.38, x + 1.3, 0.60, 'equip');
        [-0.75, 0.75].forEach((d) => rect(P, x + d - 0.035, 0.60, x + d + 0.035, 0.77, 'acier'));
        line(P, [x, -h - 0.2], [x, 1.6], 'axe');
        text(P, [x, 1.6], 'Voie ' + (i + 1), { ht: 2.2, dy: 2 });
      });
      [-1, 1].forEach((o) => {
        const xe = o * W / 2;
        poly(P, [[xe, 0], [xe - o * 0.9, 0], [xe - o * 0.9, 0.55], [xe, 0.55]], 'equip');
        line(P, [xe - o * 0.08, 0.55], [xe - o * 0.08, 1.6], 'equip');
        line(P, [xe - o * 0.08, 1.6], [xe - o * 0.5, 1.6], 'equip');
      });
      top = 1.8;
      if (ax.length > 1) for (let i = 0; i < ax.length - 1; i++) dim(P, [ax[i], 1.6], [ax[i + 1], 1.6], 'h', 4, frn(ax[i + 1] - ax[i]));
    } else {
      const tG = S.profil.trottoirG, tD = S.profil.trottoirD, w = S.profil.roulable;
      const x1 = -W / 2 + tG, x2 = x1 + w;
      if (S.equip.revetement > 0) rect(P, x1, 0, x2, S.equip.revetement, 'equip');
      if (tG > 0) rect(P, -W / 2, 0, x1, 0.20, 'trottoir');
      if (tD > 0) rect(P, x2, 0, W / 2, 0.20, 'trottoir');
      [-1, 1].forEach((o) => {
        const xe = o * W / 2, yb = (o < 0 ? tG : tD) > 0 ? 0.20 : 0;
        if (S.equip.retenue === 'BN4') {
          const xp = (o < 0 ? x1 : x2) - o * 0.30;
          line(P, [xp, yb], [xp, yb + 1.0], 'equip');
          rect(P, xp - 0.05, yb + 0.55, xp + 0.05, yb + 0.75, 'equip');
          line(P, [xp - 0.06, yb + 1.0], [xp + 0.06, yb + 1.0], 'equip');
          line(P, [xe - o * 0.08, yb], [xe - o * 0.08, yb + 1.0], 'equip');
        } else if (S.equip.retenue === 'GBA') {
          const xp = (o < 0 ? x1 : x2) - o * 0.30;
          poly(P, [[xp - 0.30, 0], [xp + 0.30, 0], [xp + 0.12, 0.25], [xp + 0.08, 0.80], [xp - 0.08, 0.80], [xp - 0.12, 0.25]], 'beton');
          line(P, [xe - o * 0.08, yb], [xe - o * 0.08, yb + 1.0], 'equip');
        } else line(P, [xe - o * 0.08, yb], [xe - o * 0.08, yb + 1.05], 'equip');
        if (S.equip.corniches) poly(P, [[xe, 0.25], [xe + o * 0.12, 0.25], [xe + o * 0.12, -0.35], [xe, -0.35]], 'equip');
      });
      top = 1.3;
      const ch = [[-W / 2, x1, 'Trottoir'], [x1, x2, 'Chaussée'], [x2, W / 2, 'Trottoir']].filter((c) => c[1] - c[0] > 1e-6);
      if (ch.length > 1) ch.forEach((c) => dim(P, [c[0], top], [c[1], top], 'h', 3, frn(c[1] - c[0])));
      text(P, [(x1 + x2) / 2, S.equip.revetement + 0.05], 'Chaussée ' + frn(w) + ' m', { ht: 2.2, dy: 1.5 });
    }
    dim(P, [-W / 2, top], [W / 2, top], 'h', rail ? 11 : 10, frn(W));
    line(P, [0, top + mm(14)], [0, -h - 0.5], 'axe');
    dim(P, [W / 2, 0], [W / 2, -h], 'v', 8, frn(h));
    // appareils sur la pile
    const ySeat = -(h + 0.30);
    sec.bear.forEach((x) => { rect(P, x - 0.20, -h, x + 0.20, -h - 0.12, 'app'); rect(P, x - 0.3, -h - 0.12, x + 0.3, ySeat, 'beton'); });

    // pile la plus haute vue de face
    const piles = M.supports.filter((s) => s.kind === 'pile');
    let ref = null;
    if (piles.length) {
      ref = piles.reduce((a, b) => (b.H > a.H ? b : a));
      const g = ref.geo, hch = g.ch ? g.ch.h : 0;
      const cut = ref.H - hch > 7.5;                 // fût tronqué au dessin
      const Hd = cut ? hch + 5.0 : ref.H, yft = ySeat - Hd;
      const yC1 = ySeat - hch - 3.0, yC2 = yC1 - 0.5;
      let yTop = ySeat;
      if (g.ch) {
        if (g.ch.kind === 'marteau') {
          const L = g.ch.L, bf = g.ch.bf;
          poly(P, [[-L / 2, ySeat], [L / 2, ySeat], [L / 2, ySeat - g.ch.h2], [bf / 2, ySeat - g.ch.h], [-bf / 2, ySeat - g.ch.h], [-L / 2, ySeat - g.ch.h2]], 'beton');
        } else rect(P, -g.ch.L / 2, ySeat, g.ch.L / 2, ySeat - g.ch.h, 'beton');
        yTop = ySeat - g.ch.h;
      }
      const futRect = (x0, x1) => {
        if (!cut) return rect(P, x0, yTop, x1, yft, 'beton');
        rect(P, x0, yTop, x1, yC1, 'beton'); rect(P, x0, yC2, x1, yft, 'beton');
        P.push({ k: 'brk', a: [x0 - 0.15, yC1], b: [x1 + 0.15, yC1] }, { k: 'brk', a: [x0 - 0.15, yC2], b: [x1 + 0.15, yC2] });
      };
      if (g.fut.kind === 'voile') futRect(-g.fut.L / 2, g.fut.L / 2);
      else if (g.fut.kind === 'marteau') futRect(-g.fut.b / 2, g.fut.b / 2);
      else for (let i = 0; i < g.fut.n; i++) { const x = -(g.fut.n - 1) * g.fut.s / 2 + i * g.fut.s; futRect(x - g.fut.D / 2, x + g.fut.D / 2); }
      const f = ref.fo;
      const ytn = yft + 0.6, half = Math.max(W / 2, (f.mode === 'pieux' ? f.Ly : f.L) / 2) + 1.5;
      let yLow;
      if (f.mode === 'superficielle') {
        rect(P, -f.L / 2, yft, f.L / 2, yft - f.e, 'beton');
        rect(P, -f.L / 2 - 0.1, yft - f.e, f.L / 2 + 0.1, yft - f.e - 0.1, 'vu');
        dim(P, [-f.L / 2, yft - f.e - 0.1], [f.L / 2, yft - f.e - 0.1], 'h', -6, frn(f.L));
        yLow = yft - f.e - 0.1;
      } else {
        rect(P, -f.Ly / 2, yft, f.Ly / 2, yft - f.e, 'beton');
        const Lv = Math.min(f.Lp, 4);
        for (let i = 0; i < f.m; i++) {
          const x = -(f.m - 1) * f.sy / 2 + i * f.sy;
          rect(P, x - f.D / 2, yft - f.e, x + f.D / 2, yft - f.e - Lv, 'pieu');
          if (Lv < f.Lp) P.push({ k: 'brk', a: [x - f.D / 2 - 0.15, yft - f.e - Lv], b: [x + f.D / 2 + 0.15, yft - f.e - Lv] });
        }
        dim(P, [-f.Ly / 2, yft - f.e], [f.Ly / 2, yft - f.e], 'h', -5 - mm(0), frn(f.Ly));
        text(P, [0, yft - f.e - Lv], f.m + ' × ' + f.nr + ' pieux Ø' + fr(f.D, 2) + ' — L = ' + frn(f.Lp) + ' m', { ht: 2.2, dy: -6 });
        yLow = yft - f.e - Lv;
      }
      poly(P, [[-half, ytn], [half, ytn], [half, yLow - 0.6], [-half, yLow - 0.6]], 'sol');
      line(P, [-half, ytn], [half, ytn], 'tn');
      const xd = (g.fut.kind === 'voile' ? g.fut.L : g.fut.kind === 'marteau' ? g.fut.b : (g.fut.n - 1) * g.fut.s + g.fut.D) / 2;
      dim(P, [-xd, ySeat], [-xd, yft], 'v', -6, 'H = ' + frn(ref.H));
      const xr = Math.max(xd, g.ch ? g.ch.L / 2 : 0) + 0.4;
      g.parts.forEach((pt, i) => text(P, [xr, ySeat - hch - 0.6], pt.des, { ht: 2.1, anchor: 'start', dy: -i * 4.2 }));
    }
    // le sol se dessine sous le reste
    P.sort((a, b) => (a.lay === 'sol' ? -1 : 0) - (b.lay === 'sol' ? -1 : 0));
    const titre = 'COUPE TRANSVERSALE' + (ref ? ' SUR PILE ' + ref.id : '') + ' — échelle 1/' + ech;
    return { P, ech, titre, pile: ref ? ref.id : null };
  }

  /* ───────── Rendu SVG ───────── */
  const STY = {
    beton: 'fill:#ece6d6;stroke:#2b2e36;stroke-width:1',
    prefa: 'fill:#e3dcc8;stroke:#2b2e36;stroke-width:1',
    acier: 'fill:#9db2c9;stroke:#24364c;stroke-width:1',
    acierL: 'fill:none;stroke:#24364c;stroke-width:1.4;stroke-dasharray:6 3',
    vu: 'fill:none;stroke:#7d8494;stroke-width:.8;stroke-dasharray:4 2.5',
    axe: 'fill:none;stroke:#b3261e;stroke-width:.7;stroke-dasharray:12 3 2 3',
    tn: 'fill:none;stroke:#6b4f12;stroke-width:1.3',
    sol: 'fill:url(#HATCH);stroke:none',
    remblai: 'fill:#f2ead4;stroke:#a88a4a;stroke-width:.8',
    pieu: 'fill:#efe9da;stroke:#2b2e36;stroke-width:.9;stroke-dasharray:5 2',
    app: 'fill:#1f2430;stroke:#1f2430;stroke-width:.6',
    equip: 'fill:#d9dde4;stroke:#454b58;stroke-width:.8',
    trottoir: 'fill:#e1dccd;stroke:#454b58;stroke-width:.8',
    ballast: 'fill:#cfc6b4;stroke:#6e6455;stroke-width:.8',
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
      else if (p.k === 'text') grow(p.p[0], p.p[1]);
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
          out.push(`<path d="${d}" style="${(STY[p.lay] || STY.vu).replace('#HATCH', '#' + id + '-h')}${p.pts.length === 2 || !p.closed ? ';fill:none' : ''}"/>`);
        } else if (p.k === 'text') {
          const fs = p.ht * kp;
          T(X(p.p[0]), Y(p.p[1]) - p.dy * kp, p.s, fs, p.anchor, (p.bold ? ' font-weight="600"' : '') + (p.lay === 'titre' ? ' fill="#8a6b1f"' : ''));
        } else if (p.k === 'dim') {
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
    const defs = `<defs><pattern id="${id}-h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#f6f1e4"/><line x1="0" y1="0" x2="0" y2="7" stroke="#c9b98f" stroke-width="1"/></pattern>`
      + `<style>text{font-family:Outfit,Arial,sans-serif;fill:#14171f}.dx{stroke:#8a6b1f;stroke-width:.5;fill:none}.dl{stroke:#8a6b1f;stroke-width:.8;fill:none}.dt{fill:#6b4f12}</style></defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(e[0] - pad).toFixed(1)} ${(e[1] - pad).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" width="${vw.toFixed(0)}" height="${vh.toFixed(0)}" role="img">${defs}${r.out.join('')}</svg>`;
  }

  return { elevScene, secScene, toSVG };
});
