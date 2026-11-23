/* BridgeAI Studios — Plans de coffrage : description des structures (paramètres, vues cotées, quantités).
 * Conventions : mètres ; x horizontal, y vers le haut ; vues « comme les plans KLE »
 * (coupe longitudinale, élévation, vue en plan, coupes de détail).
 */
(function (root) {
  'use strict';
  const C = (typeof module === 'object' && module.exports) ? require('./coffrage.js') : root.COFF;
  const { View, RECT, CIRC, ARC } = C;
  const V = (t) => new View(t);
  const f = (k, label, def, min, max, step, unit, grp, hint) => ({ k, label, def, min, max, step: step || 0.05, unit: unit || 'm', g: grp || 'Géométrie', hint });
  const n = (k, label, def, min, max, grp) => ({ k, label, def, min, max, step: 1, unit: '', g: grp || 'Géométrie', int: true });
  const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
  const S = {};

  /* Bossage d'appui vu en élévation */
  const boss = (v, x, y, w, h) => v.seen(RECT(x - w / 2, y, w, h));
  /* Positions régulières centrées */
  const spread = (nb, e) => { const a = []; for (let i = 0; i < nb; i++) a.push((i - (nb - 1) / 2) * e); return a; };
  const bp = (v, x0, x1, y) => v.seen(RECT(x0 - 0.10, y - 0.10, x1 - x0 + 0.20, 0.10));   // béton de propreté

  /* ═════════════ CULÉE VOILE ═════════════ */
  function culeeProfile(g, x0f, ef) {
    // corps de culée (mur de front ou fût coupé, sommier, garde-grève, corbeau) en coupe longitudinale
    const y1 = g.hs + g.Hf, y2 = y1 + g.hsm, y3 = y2 + g.hgg;
    const xs0 = g.d - g.af, xsb = xs0 + g.bs, xg0 = xsb - g.egg, yc = y3 - g.zc;
    return { y1, y2, y3, xs0, xsb, xg0, yc, pts: [[x0f, g.hs], [x0f, y1], [xs0, y1], [xs0, y2], [xg0, y2], [xg0, y3], [xsb, y3], [xsb, yc], [xsb + g.lc, yc], [xsb + g.lc, yc - g.hc], [xsb, yc - g.hc - g.lc], [xsb, y1 + g.cs], [xsb - g.cs, y1], [x0f + ef, y1], [x0f + ef, g.hs]] };
  }
  const culeeFields = [
    f('Bs', 'Longueur semelle Bs', 7.00, 1, 20), f('hs', 'Épaisseur semelle hs', 1.20, 0.4, 3), f('Ls', 'Largeur semelle Ls', 12.00, 2, 40),
    f('d', 'Patin avant d', 1.50, 0, 8), f('ef', 'Épaisseur mur de front ef', 1.00, 0.3, 3), f('Hf', 'Hauteur mur de front Hf', 4.00, 0.5, 15),
    f('L', 'Largeur de la culée L', 11.00, 2, 40),
    f('bs', 'Largeur sommier bs', 2.00, 0.6, 5, 0.05, 'm', 'Sommier'), f('hsm', 'Hauteur sommier hsm', 1.00, 0.3, 3, 0.05, 'm', 'Sommier'), f('af', 'Débord avant sommier af', 0.30, 0, 1.5, 0.05, 'm', 'Sommier'), f('cs', 'Chanfrein arrière cs', 0.40, 0, 1.5, 0.05, 'm', 'Sommier'),
    f('egg', 'Épaisseur garde-grève egg', 0.30, 0.2, 0.8, 0.05, 'm', 'Garde-grève'), f('hgg', 'Hauteur garde-grève hgg', 1.80, 0.3, 4, 0.05, 'm', 'Garde-grève'),
    f('lc', 'Saillie corbeau lc', 0.30, 0.1, 0.8, 0.05, 'm', 'Garde-grève'), f('hc', 'Hauteur corbeau hc', 0.30, 0.1, 0.8, 0.05, 'm', 'Garde-grève'), f('zc', 'Arase → dessus corbeau zc', 0.40, 0, 1.5, 0.05, 'm', 'Garde-grève'),
    n('na', 'Nombre d\'appareils na', 4, 1, 12, 'Appuis'), f('ea', 'Entraxe appareils ea', 2.70, 0.5, 6, 0.05, 'm', 'Appuis'), f('xa', 'Axe d\'appui / nu avant sommier xa', 0.55, 0.2, 2, 0.05, 'm', 'Appuis'),
  ];
  function culeeValidate(g) {
    const e = [], P = culeeProfile(g, g.d, g.ef);
    if (g.d + g.ef > g.Bs) e.push('Le mur de front dépasse la semelle (d + ef > Bs).');
    if (P.xsb - g.cs < g.d + g.ef - 1e-6) e.push('Sommier trop étroit pour le chanfrein arrière (bs, af, cs).');
    if (P.yc - g.hc - g.lc < P.y2 - 1e-6) e.push('Corbeau trop bas : il descend sous le dessus du sommier.');
    if (g.xa > g.bs - g.egg - 0.1) e.push('Axe d\'appui trop en arrière (xa).');
    if ((g.na - 1) * g.ea > g.L - 0.6) e.push('Appareils hors de la largeur L.');
    return e;
  }
  S.culeeV = {
    name: 'Culée voile', fields: culeeFields, validate: culeeValidate,
    views(g) {
      const P = culeeProfile(g, g.d, g.ef), xr = P.xsb + g.lc, xa = P.xs0 + g.xa;
      const A = V('Coupe longitudinale').cut(RECT(0, 0, g.Bs, g.hs)).cut(P.pts);
      bp(A, 0, g.Bs, 0); A.ground(-0.6, -0.1, -0.1).ground(g.Bs + 0.1, g.Bs + 0.6, -0.1);
      boss(A, xa, P.y2, 0.80, 0.10); A.line([[xa, P.y2 - 0.4], [xa, P.y3 + 0.6]], 'axis').text([xa, P.y3 + 0.8], 'Axe d\'appui', 2.2, { it: true });
      A.line([[-1.2, P.y2 + 0.10], [P.xs0 - 0.05, P.y2 + 0.10]], 'hidden').line([[-1.2, P.y2 + 0.10 + 1.0], [P.xs0 - 0.4, P.y2 + 0.10 + 1.0]], 'hidden').text([-0.6, P.y2 + 0.75], 'Tablier', 2.2, { it: true, noSchema: true });
      A.line([[xr + 0.05, P.yc + 0.02], [xr + 2.5, P.yc + 0.02 - 2.5 * 0.05]], 'hidden').text([xr + 1.6, P.yc + 0.3], 'Dalle de transition', 2, { it: true, noSchema: true });
      A.chainH([[0, 0], [g.d, g.hs], [g.d + g.ef, g.hs], [g.Bs, 0]], -0.9, ['d', 'ef'], -1.6, 'Bs');
      A.chainH([[P.xs0, P.y2], [P.xg0, P.y3], [P.xsb, P.y3], [xr, P.yc]], P.y3 + 1.6, [null, 'egg', 'lc'], P.y3 + 2.3, 'bs');
      A.dimH([P.xs0, P.y1], [g.d, g.hs + 0.3], P.y1 - 0.6, 'af');
      A.chainV([[0, 0], [0, g.hs], [g.d, P.y1], [P.xs0, P.y2], [P.xg0, P.y3]], -1.4, ['hs', 'Hf', 'hsm', 'hgg']);
      A.chainV([[xr, P.yc - g.hc], [xr, P.yc], [P.xsb, P.y3]], xr + 0.9, ['hc', 'zc']);
      A.dimH([P.xsb - g.cs, P.y1], [P.xsb, P.y1 + g.cs], P.y1 - 0.6, 'cs');
      // Élévation face avant (côté travée)
      const Lh = g.L / 2, Lsh = g.Ls / 2;
      const B = V('Élévation face avant').seen(RECT(-Lsh, 0, g.Ls, g.hs)).seen(RECT(-Lh, g.hs, g.L, g.Hf)).seen(RECT(-Lh, P.y1, g.L, g.hsm)).seen(RECT(-Lh, P.y2, g.L, g.hgg));
      bp(B, -Lsh, Lsh, 0);
      spread(g.na, g.ea).forEach((x) => { boss(B, x, P.y2, 0.80, 0.10); B.line([[x, P.y2 - 0.3], [x, P.y2 + 0.5]], 'axis'); });
      B.line([[0, -0.4], [0, P.y3 + 0.5]], 'axis');
      B.chainH([[-Lsh, 0], [Lsh, 0]], -0.9, ['Ls']).chainH([[-Lh, P.y3], [Lh, P.y3]], P.y3 + 0.8, ['L']);
      if (g.na > 1) B.chainH(spread(g.na, g.ea).map((x) => [x, P.y2 + 0.1]), P.y2 + 0.7, spread(g.na, g.ea).map(() => 'ea'));
      B.chainV([[-Lsh, 0], [-Lsh, g.hs], [-Lh, P.y1], [-Lh, P.y2], [-Lh, P.y3]], -Lsh - 0.9, ['hs', 'Hf', 'hsm', 'hgg']);
      // Vue en plan
      const Cv = V('Vue en plan').seen(RECT(0, -Lsh, g.Bs, g.Ls)).seen(RECT(P.xs0, -Lh, g.bs, g.L)).line([[P.xg0, -Lh], [P.xg0, Lh]], 'thin').seen(RECT(P.xsb, -Lh, g.lc, g.L));
      Cv.line([[g.d, -Lh], [g.d, Lh]], 'hidden').line([[g.d + g.ef, -Lh], [g.d + g.ef, Lh]], 'hidden');
      spread(g.na, g.ea).forEach((y) => Cv.seen(RECT(xa - 0.4, y - 0.4, 0.8, 0.8)));
      Cv.line([[xa, -Lh - 0.5], [xa, Lh + 0.5]], 'axis').line([[-0.5, 0], [g.Bs + 0.5, 0]], 'axis');
      Cv.chainH([[0, -Lsh], [g.Bs, -Lsh]], -Lsh - 0.9, ['Bs']).chainV([[0, -Lsh], [0, Lsh]], -0.9, ['Ls']).chainV([[xr, -Lh], [xr, Lh]], xr + 0.9, ['L']);
      return [A, B, Cv];
    },
    qty(g) { const P = culeeProfile(g, g.d, g.ef); return [['Semelle', g.Bs * g.hs * g.Ls], ['Mur, sommier, garde-grève', area(P.pts) * g.L]]; },
  };

  /* ═════════════ CULÉE À COLONNES ═════════════ */
  S.culeeC = {
    name: 'Culée à colonnes',
    fields: culeeFields.filter((x) => x.k !== 'ef').map((x) => x.k === 'Hf' ? Object.assign({}, x, { label: 'Hauteur colonnes Hf' }) : x.k === 'd' ? Object.assign({}, x, { label: 'Patin avant d (nu colonne)', def: 2.00 }) : x)
      .concat([n('nc', 'Nombre de colonnes nc', 3, 2, 8, 'Colonnes'), f('D', 'Diamètre colonnes D', 1.00, 0.5, 2.5, 0.05, 'm', 'Colonnes'), f('ec', 'Entraxe colonnes ec', 4.00, 1, 10, 0.05, 'm', 'Colonnes')]),
    validate(g) { const e = culeeValidate(Object.assign({}, g, { ef: g.D })); if ((g.nc - 1) * g.ec + g.D > g.L) e.push('Colonnes hors de la largeur du sommier.'); if ((g.nc - 1) * g.ec + g.D > g.Ls) e.push('Colonnes hors de la semelle.'); return e; },
    views(g) {
      const P = culeeProfile(g, g.d, g.D), xr = P.xsb + g.lc, xa = P.xs0 + g.xa, xc = g.d + g.D / 2;
      const A = V('Coupe longitudinale sur colonne').cut(RECT(0, 0, g.Bs, g.hs)).cut(P.pts);
      bp(A, 0, g.Bs, 0); A.ground(-0.6, -0.1, -0.1).ground(g.Bs + 0.1, g.Bs + 0.6, -0.1);
      boss(A, xa, P.y2, 0.80, 0.10); A.line([[xa, P.y2 - 0.4], [xa, P.y3 + 0.6]], 'axis'); A.line([[xc, -0.3], [xc, P.y1 + 0.3]], 'axis');
      A.chainH([[0, 0], [g.d, g.hs], [g.d + g.D, g.hs], [g.Bs, 0]], -0.9, ['d', 'D'], -1.6, 'Bs');
      A.chainH([[P.xs0, P.y2], [P.xg0, P.y3], [P.xsb, P.y3], [xr, P.yc]], P.y3 + 1.6, [null, 'egg', 'lc'], P.y3 + 2.3, 'bs');
      A.chainV([[0, 0], [0, g.hs], [g.d, P.y1], [P.xs0, P.y2], [P.xg0, P.y3]], -1.4, ['hs', 'Hf', 'hsm', 'hgg']);
      A.chainV([[xr, P.yc - g.hc], [xr, P.yc], [P.xsb, P.y3]], xr + 0.9, ['hc', 'zc']);
      const Lh = g.L / 2, Lsh = g.Ls / 2, cs = spread(g.nc, g.ec);
      const B = V('Élévation face avant').seen(RECT(-Lsh, 0, g.Ls, g.hs)).seen(RECT(-Lh, P.y1, g.L, g.hsm)).seen(RECT(-Lh, P.y2, g.L, g.hgg));
      cs.forEach((x) => { B.seen(RECT(x - g.D / 2, g.hs, g.D, g.Hf)); B.line([[x, -0.3], [x, P.y1 + 0.3]], 'axis'); });
      bp(B, -Lsh, Lsh, 0);
      spread(g.na, g.ea).forEach((x) => boss(B, x, P.y2, 0.80, 0.10));
      B.chainH([[-Lsh, 0], [Lsh, 0]], -0.9, ['Ls']).chainH([[-Lh, P.y3], [Lh, P.y3]], P.y3 + 0.8, ['L']);
      B.chainH(cs.map((x) => [x, g.hs + 0.5]), g.hs + 0.6 + (g.Hf > 2 ? 1 : 0.2), cs.map(() => 'ec'));
      B.chainV([[-Lsh, 0], [-Lsh, g.hs], [-Lh, P.y1], [-Lh, P.y2], [-Lh, P.y3]], -Lsh - 0.9, ['hs', 'Hf', 'hsm', 'hgg']);
      const Cv = V('Vue en plan').seen(RECT(0, -Lsh, g.Bs, g.Ls)).seen(RECT(P.xs0, -Lh, g.bs, g.L)).line([[P.xg0, -Lh], [P.xg0, Lh]], 'thin').seen(RECT(P.xsb, -Lh, g.lc, g.L));
      cs.forEach((y) => Cv.circ([xc, y], g.D / 2, 'hidden'));
      Cv.line([[xc, -Lsh - 0.4], [xc, Lsh + 0.4]], 'axis').line([[-0.5, 0], [g.Bs + 0.5, 0]], 'axis');
      Cv.chainH([[0, -Lsh], [g.Bs, -Lsh]], -Lsh - 0.9, ['Bs']).chainV([[0, -Lsh], [0, Lsh]], -0.9, ['Ls']).chainV(cs.map((y) => [xc, y]), xr + 0.9, cs.map(() => 'ec'));
      const D = V('Coupe sur colonnes').seen(RECT(0, -Lsh, g.Bs, g.Ls)); cs.forEach((y) => D.circ([xc, y], g.D / 2, 'fill'));
      D.chainH([[g.d, cs[0]], [g.d + g.D, cs[0]]], cs[0] - g.D / 2 - 0.7, ['D']);
      return [A, B, Cv, D];
    },
    qty(g) { const P = culeeProfile(g, g.d, g.D), pts = P.pts.slice(2, -2); return [['Semelle', g.Bs * g.hs * g.Ls], ['Colonnes', g.nc * Math.PI * g.D * g.D / 4 * g.Hf], ['Sommier, garde-grève', area([[g.d, P.y1]].concat(pts, [[g.d + g.D, P.y1]])) * g.L]]; },
  };

  /* ═════════════ PILE SEMELLE + FÛTS (chevêtre marteau) ═════════════ */
  const chevFields = [
    f('Lc', 'Longueur chevêtre Lc', 10.00, 2, 25, 0.05, 'm', 'Chevêtre'), f('bc', 'Largeur chevêtre bc', 2.00, 0.8, 4, 0.05, 'm', 'Chevêtre'),
    f('h1', 'Hauteur au droit du fût h1', 1.80, 0.6, 4, 0.05, 'm', 'Chevêtre'), f('h2', 'Hauteur en about h2', 0.80, 0.4, 3, 0.05, 'm', 'Chevêtre'), f('lp', 'Partie centrale lp', 2.20, 0.5, 10, 0.05, 'm', 'Chevêtre'),
    n('na', 'Nombre d\'appareils na', 4, 1, 10, 'Appuis'), f('ea', 'Entraxe appareils ea', 2.70, 0.5, 6, 0.05, 'm', 'Appuis'), f('ba', 'Bossage (côté) ba', 0.80, 0.3, 1.5, 0.05, 'm', 'Appuis'),
  ];
  function chevPts(g, y0, x0) { // élévation du chevêtre marteau (dessous du chevêtre à y0)
    const Lh = g.Lc / 2, ph = g.lp / 2, yt = y0 + g.h1;
    return [[x0 - ph, y0], [x0 + ph, y0], [x0 + Lh, yt - g.h2], [x0 + Lh, yt], [x0 - Lh, yt], [x0 - Lh, yt - g.h2]];
  }
  S.pile = {
    name: 'Pile semelle + fûts',
    fields: [f('Ls', 'Largeur semelle Ls', 6.00, 1, 25), f('Bs', 'Longueur semelle Bs', 4.00, 1, 15), f('hs', 'Épaisseur semelle hs', 1.20, 0.4, 3),
      n('nf', 'Nombre de fûts nf', 1, 1, 4, 'Fûts'), f('D', 'Diamètre fûts D', 1.40, 0.5, 3, 0.05, 'm', 'Fûts'), f('ef', 'Entraxe fûts ef', 3.50, 1, 10, 0.05, 'm', 'Fûts'), f('Hf', 'Hauteur fûts Hf', 6.00, 0.5, 30, 0.05, 'm', 'Fûts')].concat(chevFields),
    validate(g) { const e = []; const w = (g.nf - 1) * g.ef + g.D; if (w > g.Ls) e.push('Fûts hors de la semelle.'); if (w > g.lp + 1e-6 && g.nf > 1) e.push('Partie centrale du chevêtre lp plus courte que l\'emprise des fûts.'); if (g.D > g.bc + 1e-6) e.push('Fût plus large que le chevêtre.'); if (g.h2 > g.h1) e.push('h2 doit être ≤ h1.'); if ((g.na - 1) * g.ea + g.ba > g.Lc) e.push('Appareils hors du chevêtre.'); return e; },
    views(g) {
      const y0 = g.hs + g.Hf, yt = y0 + g.h1, Lh = g.Lc / 2, Lsh = g.Ls / 2, fx = spread(g.nf, g.ef), ax = spread(g.na, g.ea);
      const A = V('Élévation transversale').seen(RECT(-Lsh, 0, g.Ls, g.hs)); fx.forEach((x) => A.seen(RECT(x - g.D / 2, g.hs, g.D, g.Hf)));
      A.seen(chevPts(g, y0, 0)); ax.forEach((x) => boss(A, x, yt, g.ba, 0.10)); bp(A, -Lsh, Lsh, 0);
      A.ground(-Lsh - 0.8, -Lsh - 0.1, -0.1).ground(Lsh + 0.1, Lsh + 0.8, -0.1).line([[0, -0.4], [0, yt + 0.6]], 'axis');
      A.chainH([[-Lsh, 0], [Lsh, 0]], -0.9, ['Ls']).chainH([[-Lh, yt], [Lh, yt]], yt + 1.4, ['Lc']).chainH([[-g.lp / 2, y0], [g.lp / 2, y0]], y0 - 0.6, ['lp']);
      if (g.na > 1) A.chainH(ax.map((x) => [x, yt + 0.1]), yt + 0.7, ax.map(() => 'ea'));
      if (g.nf > 1) A.chainH(fx.map((x) => [x, g.hs + 0.6]), g.hs + 1.0, fx.map(() => 'ef'));
      A.chainH([[fx[0] - g.D / 2, g.hs + g.Hf / 2], [fx[0] + g.D / 2, g.hs + g.Hf / 2]], g.hs + g.Hf / 2, ['D']);
      A.chainV([[-Lsh, 0], [-Lsh, g.hs], [-g.lp / 2, y0], [-Lh, yt]], -Math.max(Lsh, Lh) - 1.4, ['hs', 'Hf', 'h1']).chainV([[Lh, yt - g.h2], [Lh, yt]], Lh + 0.8, ['h2']);
      const Bsh = g.Bs / 2;
      const B = V('Élévation longitudinale').seen(RECT(-Bsh, 0, g.Bs, g.hs)).seen(RECT(-g.D / 2, g.hs, g.D, g.Hf)).seen(RECT(-g.bc / 2, y0, g.bc, g.h1)); bp(B, -Bsh, Bsh, 0);
      boss(B, 0, yt, g.ba, 0.10); B.line([[0, -0.4], [0, yt + 0.6]], 'axis');
      B.chainH([[-Bsh, 0], [Bsh, 0]], -0.9, ['Bs']).chainH([[-g.bc / 2, yt], [g.bc / 2, yt]], yt + 0.8, ['bc']);
      B.chainV([[-Bsh, 0], [-Bsh, g.hs], [-g.bc / 2, y0], [-g.bc / 2, yt]], -Bsh - 0.9, ['hs', 'Hf', 'h1']);
      const Cv = V('Vue en plan').seen(RECT(-Lsh, -Bsh, g.Ls, g.Bs)).seen(RECT(-Lh, -g.bc / 2, g.Lc, g.bc)).line([[-g.lp / 2, -g.bc / 2], [-g.lp / 2, g.bc / 2]], 'thin').line([[g.lp / 2, -g.bc / 2], [g.lp / 2, g.bc / 2]], 'thin');
      fx.forEach((x) => Cv.circ([x, 0], g.D / 2, 'hidden')); ax.forEach((x) => Cv.seen(RECT(x - g.ba / 2, -g.ba / 2, g.ba, g.ba)));
      Cv.line([[-Lsh - 0.5, 0], [Lsh + 0.5, 0]], 'axis').line([[0, -Bsh - 0.5], [0, Bsh + 0.5]], 'axis');
      Cv.chainH([[-Lsh, -Bsh], [Lsh, -Bsh]], -Math.max(Bsh, g.bc / 2) - 0.9, ['Ls']).chainV([[-Lsh, -Bsh], [-Lsh, Bsh]], -Math.max(Lsh, Lh) - 0.9, ['Bs']).chainV([[Lh, -g.bc / 2], [Lh, g.bc / 2]], Lh + 0.8, ['bc']);
      const D = V('Coupe sur fût').seen(RECT(-Lsh, -Bsh, g.Ls, g.Bs)); fx.forEach((x) => D.circ([x, 0], g.D / 2, 'fill'));
      D.line([[-Lsh - 0.4, 0], [Lsh + 0.4, 0]], 'axis'); D.chainH([[fx[0] - g.D / 2, 0], [fx[0] + g.D / 2, 0]], -Bsh - 0.8, ['D']);
      return [A, B, Cv, D];
    },
    qty(g) { return [['Semelle', g.Ls * g.Bs * g.hs], ['Fûts', g.nf * Math.PI * g.D * g.D / 4 * g.Hf], ['Chevêtre', area(chevPts(g, 0, 0)) * g.bc]]; },
  };

  /* ═════════════ CHEVÊTRE (marteau) ═════════════ */
  S.chevetre = {
    name: 'Chevêtre', fields: chevFields.concat([f('D', 'Diamètre du fût D', 1.40, 0.5, 3, 0.05, 'm', 'Fût')]),
    validate(g) { const e = []; if (g.h2 > g.h1) e.push('h2 doit être ≤ h1.'); if (g.D > g.lp + 1e-6) e.push('Partie centrale lp plus courte que le fût.'); if ((g.na - 1) * g.ea + g.ba > g.Lc) e.push('Appareils hors du chevêtre.'); return e; },
    views(g) {
      const Lh = g.Lc / 2, ax = spread(g.na, g.ea), y0 = 1.0, yt = y0 + g.h1;
      const A = V('Élévation').cut(chevPts(g, y0, 0)).seen(RECT(-g.D / 2, 0, g.D, y0)).brk(-g.D / 2, g.D / 2, 0); ax.forEach((x) => boss(A, x, yt, g.ba, 0.10));
      A.line([[0, -0.3], [0, yt + 0.6]], 'axis');
      A.chainH([[-Lh, yt], [Lh, yt]], yt + 1.4, ['Lc']).chainH([[-g.lp / 2, y0], [g.lp / 2, y0]], y0 - 0.6, ['lp']);
      if (g.na > 1) A.chainH(ax.map((x) => [x, yt + 0.1]), yt + 0.7, ax.map(() => 'ea'));
      A.chainV([[-Lh, yt - g.h2], [-Lh, yt]], -Lh - 0.8, ['h2']).chainV([[g.lp / 2, y0], [g.lp / 2, yt]], Lh + 0.8, ['h1']);
      const B = V('Vue en plan').seen(RECT(-Lh, -g.bc / 2, g.Lc, g.bc)).line([[-g.lp / 2, -g.bc / 2], [-g.lp / 2, g.bc / 2]], 'thin').line([[g.lp / 2, -g.bc / 2], [g.lp / 2, g.bc / 2]], 'thin').circ([0, 0], g.D / 2, 'hidden');
      ax.forEach((x) => B.seen(RECT(x - g.ba / 2, -g.ba / 2, g.ba, g.ba)));
      B.line([[-Lh - 0.5, 0], [Lh + 0.5, 0]], 'axis').chainV([[Lh, -g.bc / 2], [Lh, g.bc / 2]], Lh + 0.8, ['bc']).chainH([[ax[0] - g.ba / 2, -g.ba / 2], [ax[0] + g.ba / 2, -g.ba / 2]], -g.bc / 2 - 0.6, ['ba']);
      const Cc = V('Coupe transversale').cut(RECT(-g.bc / 2, y0, g.bc, g.h1)).seen(RECT(-g.D / 2, 0, g.D, y0)).brk(-g.D / 2, g.D / 2, 0); boss(Cc, 0, yt, g.ba, 0.10);
      Cc.chainH([[-g.bc / 2, yt], [g.bc / 2, yt]], yt + 0.8, ['bc']).chainV([[-g.bc / 2, y0], [-g.bc / 2, yt]], -g.bc / 2 - 0.8, ['h1']);
      return [A, B, Cc];
    },
    qty(g) { return [['Chevêtre', area(chevPts(g, 0, 0)) * g.bc], ['Bossages', g.na * g.ba * g.ba * 0.10]]; },
  };

  /* ═════════════ MASSIF SUR PIEUX ═════════════ */
  S.massif = {
    name: 'Massif sur pieux',
    fields: [f('Lx', 'Longueur massif Lx', 7.00, 1, 25), f('Ly', 'Largeur massif Ly', 4.40, 1, 20), f('h', 'Épaisseur massif h', 1.60, 0.5, 4),
      n('nx', 'Pieux suivant x nx', 3, 1, 8, 'Pieux'), n('ny', 'Pieux suivant y ny', 2, 1, 6, 'Pieux'), f('D', 'Diamètre pieux D', 1.00, 0.4, 2.5, 0.05, 'm', 'Pieux'),
      f('ex', 'Entraxe x ex', 2.50, 1, 8, 0.05, 'm', 'Pieux'), f('ey', 'Entraxe y ey', 2.50, 1, 8, 0.05, 'm', 'Pieux'), f('Lp', 'Longueur pieux Lp', 15.00, 3, 60, 0.5, 'm', 'Pieux'),
      f('Df', 'Diamètre du fût Df', 1.40, 0, 3, 0.05, 'm', 'Fût', '0 = sans fût')],
    validate(g) { const e = []; if ((g.nx - 1) * g.ex + g.D > g.Lx) e.push('Pieux hors du massif suivant x.'); if ((g.ny - 1) * g.ey + g.D > g.Ly) e.push('Pieux hors du massif suivant y.'); if (g.ex < 2.5 * g.D - 1e-6 && g.nx > 1) e.push('Entraxe x < 2,5 D (à justifier).'); return e; },
    views(g) {
      const X = spread(g.nx, g.ex), Y = spread(g.ny, g.ey), Lh = g.Lx / 2, Wh = g.Ly / 2, lp = Math.min(g.Lp, 3.0);
      const elev = (title, L, P, ax) => {
        const v = V(title).seen(RECT(-L, -g.h, 2 * L, g.h));
        P.forEach((x) => { v.seen(RECT(x - g.D / 2, -g.h - lp, g.D, lp)); v.brk(x - g.D / 2, x + g.D / 2, -g.h - lp); v.line([[x, -g.h - lp - 0.4], [x, 0.3]], 'axis'); });
        if (g.Df > 0) v.seen(RECT(-g.Df / 2, 0, g.Df, 1.0)).brk(-g.Df / 2, g.Df / 2, 1.0);
        bp(v, -L, L, -g.h); v.ground(-L - 1, -L - 0.1, 0).ground(L + 0.1, L + 1, 0);
        v.chainH([[-L, 0], [L, 0]], 1.6, [ax === 'x' ? 'Lx' : 'Ly']);
        if (P.length > 1) v.chainH(P.map((x) => [x, -g.h - 0.5]), -g.h - lp - 0.9, P.map(() => ax === 'x' ? 'ex' : 'ey'));
        v.chainV([[-L, -g.h], [-L, 0]], -L - 0.9, ['h']);
        v.dimV([P[0] + g.D / 2 + 0.05, -g.h - lp], [P[0] + g.D / 2 + 0.05, -g.h], P[0] + g.D / 2 + 0.6, null, 'Lp = ' + C.fmt(g.Lp));
        return v;
      };
      const A = elev('Élévation longitudinale', Lh, X, 'x'), B = elev('Élévation transversale', Wh, Y, 'y');
      const Cv = V('Vue en plan').seen(RECT(-Lh, -Wh, g.Lx, g.Ly));
      X.forEach((x) => Y.forEach((y) => Cv.circ([x, y], g.D / 2, 'hidden')));
      if (g.Df > 0) Cv.circ([0, 0], g.Df / 2, 'thick');
      Cv.line([[-Lh - 0.5, 0], [Lh + 0.5, 0]], 'axis').line([[0, -Wh - 0.5], [0, Wh + 0.5]], 'axis');
      X.forEach((x) => Cv.line([[x, -Wh - 0.3], [x, Wh + 0.3]], 'axis')); Y.forEach((y) => Cv.line([[-Lh - 0.3, y], [Lh + 0.3, y]], 'axis'));
      Cv.chainH([[-Lh, -Wh], [Lh, -Wh]], -Wh - 1.4, ['Lx']).chainV([[-Lh, -Wh], [-Lh, Wh]], -Lh - 1.4, ['Ly']);
      if (X.length > 1) Cv.chainH(X.map((x) => [x, -Wh]), -Wh - 0.7, X.map(() => 'ex'));
      if (Y.length > 1) Cv.chainV(Y.map((y) => [-Lh, y]), -Lh - 0.7, Y.map(() => 'ey'));
      return [A, B, Cv];
    },
    qty(g) { return [['Massif', g.Lx * g.Ly * g.h], ['Pieux', g.nx * g.ny * Math.PI * g.D * g.D / 4 * g.Lp]]; },
  };

  /* ═════════════ DALLE DE TRANSITION ═════════════ */
  S.dalleT = {
    name: 'Dalle de transition',
    fields: [f('L', 'Longueur L', 5.00, 2, 10), f('e', 'Épaisseur e', 0.30, 0.2, 0.6, 0.01), f('W', 'Largeur W', 10.00, 2, 40), f('i', 'Pente i', 5, 0, 15, 0.5, '%'),
      f('lc', 'Appui sur corbeau lc', 0.30, 0.1, 0.8, 0.05, 'm', 'Appui'), f('hc', 'Hauteur corbeau hc', 0.30, 0.1, 0.8, 0.05, 'm', 'Appui'), f('egg', 'Épaisseur garde-grève egg', 0.30, 0.2, 0.8, 0.05, 'm', 'Appui'), f('zc', 'Arase GG → dessus corbeau zc', 0.40, 0.1, 1.5, 0.05, 'm', 'Appui')],
    validate(g) { const e = []; if (g.e > g.zc + 0.2) e.push('Dalle plus épaisse que la réservation au-dessus du corbeau.'); return e; },
    views(g) {
      const s = g.i / 100, Lc = Math.sqrt(1 / (1 + s * s)), x1 = g.L * Lc, y1 = -g.L * s * Lc, yc = -g.zc;
      const dalle = [[0, yc], [x1, yc + y1], [x1, yc + y1 - g.e], [0, yc - g.e]];
      const A = V('Coupe longitudinale').cut(dalle).seen([[-g.egg, -2.2], [-g.egg, 0], [0, 0], [0, yc], [g.lc - 0.001, yc], [g.lc - 0.001, yc - g.hc], [0, yc - g.hc - g.lc], [0, -2.2]]).brk(-g.egg, 0, -2.2);
      A.line([[x1, yc + y1 - g.e - 0.10], [x1 - 1.2, yc + y1 - g.e - 0.10 + 1.2 * s], [x1 - 1.2, yc + y1 - g.e + 1.2 * s]], 'thin').text([x1 - 0.6, yc + y1 - g.e - 0.45], 'Béton de propreté', 2, { it: true, noSchema: true });
      A.line([[-1.5, 0], [-g.egg, 0]], 'hidden').text([-1.0, 0.25], 'Tablier', 2, { it: true, noSchema: true }).line([[0, 0.10], [x1 + 0.5, 0.10 + (y1 - 0.5 * s)]], 'thin').text([x1 / 2, 0.45 + y1 / 2], 'Chaussée', 2, { it: true, noSchema: true });
      A.dim([0, yc], [x1, yc + y1], 0.9, 'L', C.fmt(g.L)).chainH([[0, yc - g.e], [g.lc, yc - g.hc]], yc - g.hc - g.lc - 0.6, ['lc']).chainV([[x1, yc + y1 - g.e], [x1, yc + y1]], x1 + 0.6, ['e']).chainV([[-g.egg, yc], [-g.egg, 0]], -g.egg - 0.7, ['zc']).chainV([[g.lc, yc - g.hc], [g.lc, yc]], g.lc + 0.5, ['hc']);
      A.text([x1 / 2, yc + y1 / 2 - g.e - 0.45], 'Pente ' + g.i + ' %', 2.2, { it: true });
      const B = V('Vue en plan').seen(RECT(0, -g.W / 2, g.L, g.W)).line([[-g.egg, -g.W / 2], [-g.egg, g.W / 2]], 'thin').line([[0, 0], [g.L, 0]], 'axis');
      B.chainH([[0, -g.W / 2], [g.L, -g.W / 2]], -g.W / 2 - 0.9, ['L']).chainV([[g.L, -g.W / 2], [g.L, g.W / 2]], g.L + 0.9, ['W']);
      const Cc = V('Coupe transversale').cut(RECT(-g.W / 2, 0, g.W, g.e)); bp(Cc, -g.W / 2, g.W / 2, 0);
      Cc.chainH([[-g.W / 2, g.e], [g.W / 2, g.e]], g.e + 0.7, ['W']).chainV([[-g.W / 2, 0], [-g.W / 2, g.e]], -g.W / 2 - 0.7, ['e']);
      return [A, B, Cc];
    },
    qty(g) { return [['Dalle', g.L * g.e * g.W]]; },
  };

  /* ═════════════ MUR EN RETOUR (suspendu) ═════════════ */
  S.murRetour = {
    name: 'Mur en retour',
    fields: [f('Lr', 'Longueur Lr', 5.00, 1, 15), f('H', 'Hauteur à l\'encastrement H', 3.50, 0.5, 10), f('hb', 'Hauteur en about hb', 1.00, 0.3, 5), f('lv', 'Partie à hauteur constante lv', 0.80, 0, 5), f('e', 'Épaisseur e', 0.40, 0.2, 1.2, 0.01),
      f('egg', 'Épaisseur garde-grève (culée) egg', 0.30, 0.2, 0.8, 0.05, 'm', 'Culée'), f('Hc', 'Hauteur culée visible Hc', 5.00, 1, 15, 0.05, 'm', 'Culée')],
    validate(g) { const e = []; if (g.hb > g.H) e.push('hb doit être ≤ H.'); if (g.lv >= g.Lr) e.push('lv doit être < Lr.'); return e; },
    views(g) {
      const wall = [[0, -g.H], [g.lv, -g.H], [g.Lr, -g.hb], [g.Lr, 0], [0, 0]];
      const A = V('Élévation').seen(wall).seen(RECT(-1.0, -g.Hc, 1.0, g.Hc)).brk(-1.0, 0, -g.Hc);
      const sl = (g.H - g.hb) / (g.Lr - g.lv);
      A.line([[g.lv - 0.3, -g.H - 0.3 * sl - 0.15], [g.Lr + 0.6, -g.hb + 0.6 * sl - 0.15]], 'thin').text([(g.lv + g.Lr) / 2 + 0.4, -(g.H + g.hb) / 2 - 0.45], 'Talus', 2, { it: true, noSchema: true });
      A.chainH([[0, 0], [g.Lr, 0]], 0.8, ['Lr']).chainH([[0, -g.H], [g.lv, -g.H]], -g.H - 0.8, ['lv']).chainV([[0, -g.H], [0, 0]], -1.8, ['H']).chainV([[g.Lr, -g.hb], [g.Lr, 0]], g.Lr + 0.8, ['hb']);
      const B = V('Vue en plan').seen(RECT(0, 0, g.Lr, g.e)).seen(RECT(-1.0, -2.0, 1.0, 2.0 + g.e)).line([[-1, -2], [0, -2]], 'thin');
      B.chainH([[0, g.e], [g.Lr, g.e]], g.e + 0.8, ['Lr']).chainV([[g.Lr, 0], [g.Lr, g.e]], g.Lr + 0.7, ['e']);
      const Cc = V('Coupe à l\'encastrement').cut(RECT(0, -g.H, g.e, g.H)).chainH([[0, 0], [g.e, 0]], 0.7, ['e']).chainV([[0, -g.H], [0, 0]], -0.8, ['H']);
      return [A, B, Cc];
    },
    qty(g) { return [['Mur en retour', area([[0, -g.H], [g.lv, -g.H], [g.Lr, -g.hb], [g.Lr, 0], [0, 0]]) * g.e]]; },
  };

  /* ═════════════ MUR EN AILE (cadres et portiques) ═════════════ */
  S.murAile = {
    name: 'Mur en aile (cadres, portiques)',
    fields: [f('La', 'Longueur développée La', 4.00, 1, 12), f('H1', 'Hauteur au cadre H1', 2.60, 0.5, 8), f('H2', 'Hauteur en about H2', 0.80, 0.3, 4), f('e', 'Épaisseur voile e', 0.30, 0.2, 1, 0.01),
      f('bs', 'Largeur semelle bs', 1.80, 0.5, 5, 0.05, 'm', 'Semelle'), f('hs', 'Épaisseur semelle hs', 0.40, 0.2, 1.2, 0.05, 'm', 'Semelle'), f('p', 'Patin p', 0.40, 0, 2, 0.05, 'm', 'Semelle'),
      f('alpha', 'Angle avec l\'axe du cadre α', 30, 0, 90, 1, '°', 'Implantation'), f('Bc', 'Largeur extérieure du cadre Bc', 3.00, 1, 15, 0.05, 'm', 'Implantation')],
    validate(g) { const e = []; if (g.H2 > g.H1) e.push('H2 doit être ≤ H1.'); if (g.p + g.e > g.bs) e.push('Patin + voile > semelle.'); return e; },
    views(g) {
      const A = V('Élévation développée').seen(RECT(0, 0, g.La, g.hs)).seen([[0, g.hs], [g.La, g.hs], [g.La, g.hs + g.H2], [0, g.hs + g.H1]]).seen(RECT(-0.8, 0, 0.8, g.hs + g.H1 + 0.3)).brk(-0.8, 0, g.hs + g.H1 + 0.3);
      bp(A, 0, g.La, 0); A.ground(g.La + 0.1, g.La + 0.8, -0.1);
      A.chainH([[0, 0], [g.La, 0]], -0.8, ['La']).chainV([[g.La, 0], [g.La, g.hs], [g.La, g.hs + g.H2]], g.La + 0.8, ['hs', 'H2']).chainV([[0, g.hs], [0, g.hs + g.H1]], -1.6, ['H1']);
      const B = V('Coupe transversale').cut([[0, 0], [g.bs, 0], [g.bs, g.hs], [g.p + g.e, g.hs], [g.p + g.e, g.hs + g.H1], [g.p, g.hs + g.H1], [g.p, g.hs], [0, g.hs]]); bp(B, 0, g.bs, 0);
      B.chainH([[0, 0], [g.p, g.hs], [g.p + g.e, g.hs], [g.bs, 0]], -0.7, ['p', 'e'], -1.3, 'bs').chainV([[g.bs, 0], [g.bs, g.hs], [g.p + g.e, g.hs + g.H1]], g.bs + 0.8, ['hs', 'H1']);
      const a = g.alpha * Math.PI / 180, ux = Math.sin(a), uy = -Math.cos(a), nx = -uy, ny = ux, x0 = g.Bc / 2;
      const P = (s, t) => [x0 + ux * s + nx * t, uy * s + ny * t];
      const Cv = V('Vue en plan').seen([P(0, -g.p), P(g.La, -g.p), P(g.La, g.bs - g.p), P(0, g.bs - g.p)]).seen([P(0, 0), P(g.La, 0), P(g.La, g.e), P(0, g.e)]);
      Cv.seen(RECT(-x0, 0, g.Bc, 2.5)).brk(-x0, x0, 2.5).line([[0, -g.La - 0.5], [0, 3]], 'axis').text([0.15, -g.La * 0.5], 'Axe du cadre', 2, { a: 'start', it: true, noSchema: true });
      Cv.dim(P(0, g.bs - g.p), P(g.La, g.bs - g.p), 0.6, 'La').text([x0 + 0.6, 0.6], 'α = ' + g.alpha + '°', 2.4, { a: 'start' });
      return [A, B, Cv];
    },
    qty(g) { return [['Semelle', g.La * g.bs * g.hs], ['Voile', (g.H1 + g.H2) / 2 * g.La * g.e]]; },
  };

  /* ═════════════ POUTRES PRÉFABRIQUÉES (VIPP / PPBA) ═════════════ */
  function sec(g, about) {
    const { hp, bt, et, eg, b0, bta, hta, hg } = g, w = about ? bta : b0;
    const R = [[bta / 2, 0], [bta / 2, hta]].concat(about ? [] : [[w / 2, hta + hg]]).concat([[w / 2, hp - eg], [bt / 2, hp - et], [bt / 2, hp]]);
    const Lf = R.slice().reverse().map((q) => [-q[0], q[1]]);
    return R.concat(Lf);
  }
  const poutreFields = (d) => [f('L', 'Longueur poutre L', d.L, 5, 50, 0.05), f('hp', 'Hauteur poutre hp', d.hp, 0.5, 3, 0.01, 'm', 'Section'), f('bt', 'Largeur table bt', d.bt, 0.4, 3.5, 0.01, 'm', 'Section'),
    f('et', 'Épaisseur table en rive et', d.et, 0.06, 0.4, 0.01, 'm', 'Section'), f('eg', 'Épaisseur table à l\'âme eg', d.eg, 0.08, 0.6, 0.01, 'm', 'Section'), f('b0', 'Épaisseur âme b0', d.b0, 0.12, 0.8, 0.01, 'm', 'Section'),
    f('bta', 'Largeur talon bta', d.bta, 0.2, 1.5, 0.01, 'm', 'Section'), f('hta', 'Hauteur talon hta', d.hta, 0.08, 0.8, 0.01, 'm', 'Section'), f('hg', 'Gousset du talon hg', d.hg, 0, 0.6, 0.01, 'm', 'Section'),
    f('la', 'Longueur d\'about épaissi la', d.la, 0, 4, 0.05, 'm', 'About'), f('lt', 'Longueur de transition lt', d.lt, 0, 3, 0.05, 'm', 'About')];
  function poutreValidate(g) { const e = []; if (g.b0 > g.bta) e.push('Âme plus large que le talon.'); if (g.bt < g.bta) e.push('Table plus étroite que le talon.'); if (g.hta + g.hg + g.eg > g.hp - 0.1) e.push('Hauteur insuffisante pour l\'âme.'); if (g.et > g.eg) e.push('et doit être ≤ eg.'); if (2 * (g.la + g.lt) > g.L) e.push('Abouts trop longs pour la poutre.'); return e; }
  function poutreViews(g, vipp) {
    const secDims = (v, about) => {
      v.chainH([[-g.bt / 2, g.hp], [g.bt / 2, g.hp]], g.hp + 0.25, ['bt']).chainH([[-g.bta / 2, 0], [g.bta / 2, 0]], -0.25, ['bta']);
      if (!about) v.chainH([[-g.b0 / 2, g.hp / 2], [g.b0 / 2, g.hp / 2]], g.hp / 2, ['b0']);
      v.chainV([[-g.bt / 2, 0], [-g.bt / 2, g.hp]], -g.bt / 2 - 0.25, ['hp']).chainV([[g.bt / 2, g.hp - g.et], [g.bt / 2, g.hp]], g.bt / 2 + 0.2, ['et']);
      v.chainV([[g.bta / 2, 0], [g.bta / 2, g.hta]].concat(about ? [] : [[g.b0 / 2, g.hta + g.hg]]), g.bta / 2 + 0.25, about ? ['hta'] : ['hta', 'hg']).chainV([[g.b0 / 2, g.hp - g.eg], [g.b0 / 2, g.hp]], g.bt / 2 + 0.45, ['eg']);
      v.line([[0, -0.15], [0, g.hp + 0.15]], 'axis');
    };
    const A = V('Coupe à mi-travée').cut(sec(g, false)); secDims(A, false);
    if (vipp) [-1, 0, 1].forEach((i) => A.circ([i * Math.min(0.14, g.bta / 4), g.hta * 0.5 + (i ? 0 : 0.11)], 0.04, 'thin'));
    const B = V('Coupe sur appui').cut(sec(g, true)); secDims(B, true);
    // élévation interrompue : 2 extrémités de longueur a
    const a = Math.min(g.L / 2, Math.max(4, g.la + g.lt + 1.5)), gap = 0.8, X = (x) => x <= a ? x : x - (g.L - 2 * a) + gap;
    const E = V('Élévation (interrompue)');
    [[0, a], [g.L - a, g.L]].forEach(([x0, x1]) => {
      const p0 = X(x0), p1 = X(x1);
      E.seen(RECT(p0, 0, p1 - p0, g.hp)).line([[p0, g.hp - g.et], [p1, g.hp - g.et]], 'thin').line([[p0, g.hta], [p1, g.hta]], 'thin');
    });
    E.brkV(X(a), 0, g.hp).brkV(X(g.L - a), 0, g.hp);
    if (g.la > 0) { [[g.la, g.la + g.lt], [g.L - g.la, g.L - g.la - g.lt]].forEach(([x1, x2]) => E.line([[X(x1), g.hta], [X(x1), g.hp - g.eg]], 'hidden').line([[X(x1), g.hp - g.eg], [X(x2), g.hp - g.eg]], 'hidden')); }
    if (vipp) { const pc = (x, y0) => { const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20 * a, yy = y0 + (g.hta * 0.5 - y0) * Math.min(1, t / (a * 0.9)) ** 0.6; pts.push([X(t), yy]); } return pts; }; [0.45, 0.65, 0.85].forEach((r) => { E.line(pc(0, g.hp * r), 'hidden'); E.line(pc(0, g.hp * r).map((q) => [X(g.L) - q[0] + X(0), q[1]]), 'hidden'); }); }
    E.dimH([X(0), g.hp], [X(g.L), g.hp], g.hp + 0.9, 'L', C.fmt(g.L)).chainV([[X(0), 0], [X(0), g.hp]], X(0) - 0.4, ['hp']);
    if (g.la > 0) E.chainH([[X(0), 0], [X(g.la), g.hta], [X(g.la + g.lt), g.hta]], -0.4, ['la', 'lt']);
    const T = V('Vue de dessus (interrompue)');
    [[0, a], [g.L - a, g.L]].forEach(([x0, x1]) => T.seen(RECT(X(x0), -g.bt / 2, X(x1) - X(x0), g.bt)));
    T.brkV(X(a), -g.bt / 2, g.bt / 2).brkV(X(g.L - a), -g.bt / 2, g.bt / 2).line([[X(0) - 0.3, 0], [X(g.L) + 0.3, 0]], 'axis').chainV([[X(g.L), -g.bt / 2], [X(g.L), g.bt / 2]], X(g.L) + 0.4, ['bt']);
    return [A, B, E, T];
  }
  const qPoutre = (g) => [['Poutre', area(sec(g, false)) * (g.L - 2 * (g.la + g.lt / 2)) + area(sec(g, true)) * 2 * (g.la + g.lt / 2)]];
  S.poutreVIPP = { name: 'Poutres VIPP', fields: poutreFields({ L: 33.00, hp: 2.00, bt: 2.40, et: 0.12, eg: 0.22, b0: 0.20, bta: 0.66, hta: 0.25, hg: 0.20, la: 1.50, lt: 1.00 }), validate: poutreValidate, views: (g) => poutreViews(g, true), qty: qPoutre };
  S.poutrePPBA = { name: 'Poutre PPBA', fields: poutreFields({ L: 18.00, hp: 1.20, bt: 1.00, et: 0.12, eg: 0.18, b0: 0.25, bta: 0.50, hta: 0.20, hg: 0.12, la: 0.80, lt: 0.50 }), validate: poutreValidate, views: (g) => poutreViews(g, false), qty: qPoutre };

  /* ═════════════ HOURDIS ═════════════ */
  const deckFields = [f('W', 'Largeur du tablier W', 10.50, 3, 30), f('e', 'Épaisseur hourdis e', 0.20, 0.12, 0.4, 0.01), n('np', 'Nombre de poutres np', 4, 2, 12, 'Poutres'), f('s', 'Entraxe poutres s', 2.70, 1, 5, 0.05, 'm', 'Poutres'),
    f('hp', 'Hauteur poutres hp', 1.70, 0.5, 3, 0.01, 'm', 'Poutres'), f('bt', 'Largeur table bt', 1.50, 0.4, 3, 0.01, 'm', 'Poutres'), f('b0', 'Âme b0', 0.20, 0.12, 0.6, 0.01, 'm', 'Poutres'), f('bta', 'Talon bta', 0.60, 0.2, 1.2, 0.01, 'm', 'Poutres'), f('hta', 'Hauteur talon hta', 0.25, 0.1, 0.6, 0.01, 'm', 'Poutres')];
  const beamSec = (g, x) => sec({ hp: g.hp, bt: g.bt, et: 0.10, eg: 0.18, b0: g.b0, bta: g.bta, hta: g.hta, hg: 0.15 }, false).map((q) => [q[0] + x, q[1]]);
  const deckValidate = (g) => { const e = []; if ((g.np - 1) * g.s + g.bt > g.W) e.push('Poutres hors de la largeur du tablier.'); if (g.bt > g.s) e.push('Tables plus larges que l\'entraxe.'); return e; };
  S.hourdis = {
    name: 'Hourdis', fields: deckFields.concat([f('Lv', 'Longueur représentée Lv', 6.00, 2, 40, 0.5, 'm', 'Vue en plan')]), validate: deckValidate,
    views(g) {
      const X = spread(g.np, g.s), Wh = g.W / 2, top = g.hp + g.e;
      const A = V('Coupe transversale'); X.forEach((x) => A.seen(beamSec(g, x))); A.cut(RECT(-Wh, g.hp, g.W, g.e));
      X.forEach((x) => A.line([[x, -0.2], [x, top + 0.3]], 'axis'));
      A.chainH([[-Wh, top], [Wh, top]], top + 1.1, ['W']).chainH([[-Wh, top]].concat(X.map((x) => [x, top]), [[Wh, top]]), top + 0.5, [null].concat(X.slice(1).map(() => 's'), [null])).chainV([[Wh, g.hp], [Wh, top]], Wh + 0.6, ['e']);
      const B = V('Vue en plan (partielle)').seen(RECT(0, -Wh, g.Lv, g.W)).brk(0, 0, 0); X.forEach((y) => { B.line([[0, y], [g.Lv, y]], 'axis'); B.line([[0, y - g.bt / 2], [g.Lv, y - g.bt / 2]], 'hidden').line([[0, y + g.bt / 2], [g.Lv, y + g.bt / 2]], 'hidden'); });
      B.chainV([[g.Lv, -Wh], [g.Lv, Wh]], g.Lv + 1.0, ['W']).chainV(X.map((y) => [g.Lv, y]), g.Lv + 0.5, X.slice(1).map(() => 's'));
      const D = V('Détail d\'appui sur poutre').seen(beamSec(g, 0)).cut(RECT(-g.s / 2, g.hp, g.s, g.e)).brk(-g.s / 2, -g.s / 2, g.hp + g.e / 2).line([[0, g.hp - 0.6], [0, top + 0.2]], 'axis');
      D.chainH([[-g.bt / 2, g.hp], [g.bt / 2, g.hp]], g.hp - 0.35, ['bt']).chainV([[g.s / 2, g.hp], [g.s / 2, top]], g.s / 2 + 0.3, ['e']);
      return [A, D, B];
    },
    qty(g) { return [['Hourdis (par m de tablier)', g.W * g.e]]; },
  };

  /* ═════════════ ENTRETOISES ═════════════ */
  S.entretoises = {
    name: 'Entretoises',
    fields: deckFields.concat([f('he', 'Hauteur entretoise he', 1.30, 0.3, 2.5, 0.01, 'm', 'Entretoise'), f('ee', 'Épaisseur entretoise ee', 0.30, 0.15, 0.8, 0.01, 'm', 'Entretoise'), f('zb', 'Dessous entretoise / dessous poutre zb', 0.20, 0, 1.5, 0.01, 'm', 'Entretoise')]),
    validate(g) { const e = deckValidate(g); if (g.zb + g.he > g.hp + 1e-6) e.push('Entretoise plus haute que les poutres (zb + he > hp).'); return e; },
    views(g) {
      const X = spread(g.np, g.s), Wh = g.W / 2, top = g.hp + g.e;
      const A = V('Coupe transversale au droit de l\'entretoise'); X.forEach((x) => A.seen(beamSec(g, x)));
      for (let i = 0; i + 1 < X.length; i++) A.cut(RECT(X[i] + g.b0 / 2, g.zb, g.s - g.b0, g.he));
      A.seen(RECT(-Wh, g.hp, g.W, g.e)); X.forEach((x) => A.line([[x, -0.2], [x, top + 0.3]], 'axis'));
      A.chainH([[-Wh, top], [Wh, top]], top + 0.9, ['W']).chainH(X.map((x) => [x, top]), top + 0.45, X.slice(1).map(() => 's'));
      A.chainV([[X[X.length - 1] - g.b0 / 2, 0], [X[X.length - 1] - g.b0 / 2, g.zb], [X[X.length - 1] - g.b0 / 2, g.zb + g.he]], Wh + 0.6, ['zb', 'he']).chainV([[-Wh, 0], [-Wh, g.hp]], -Wh - 0.6, ['hp']);
      const B = V('Coupe A-A').seen(RECT(-1.2, 0, 2.4, g.hp)).cut(RECT(-g.ee / 2, g.zb, g.ee, g.he)).cut(RECT(-1.2, g.hp, 2.4, g.e)).brk(-1.2, -1.2, g.hp / 2).brk(1.2, 1.2, g.hp / 2);
      B.chainH([[-g.ee / 2, g.zb], [g.ee / 2, g.zb]], g.zb - 0.35, ['ee']).chainV([[g.ee / 2, g.zb], [g.ee / 2, g.zb + g.he]], 1.5, ['he']);
      const Cv = V('Vue en plan sous hourdis').seen(RECT(-1.5, -Wh, 3.0, g.W)).brk(-1.5, -1.5, 0).brk(1.5, 1.5, 0);
      X.forEach((y) => Cv.seen(RECT(-1.5, y - g.bta / 2, 3.0, g.bta)).line([[-1.8, y], [1.8, y]], 'axis'));
      for (let i = 0; i + 1 < X.length; i++) Cv.seen(RECT(-g.ee / 2, X[i] + g.bta / 2, g.ee, g.s - g.bta));
      Cv.line([[0, -Wh - 0.4], [0, Wh + 0.4]], 'axis').text([0.25, Wh + 0.25], 'A', 3, { a: 'start' }).chainH([[-g.ee / 2, -Wh], [g.ee / 2, -Wh]], -Wh - 0.5, ['ee']);
      return [A, B, Cv];
    },
    qty(g) { return [['Entretoise (par ligne d\'appui)', (g.np - 1) * (g.s - g.b0) * g.he * g.ee]]; },
  };

  /* ═════════════ CORNICHE ═════════════ */
  function cornProfile(g) {
    const pts = [[0, 0], [0, g.H], [-g.B, g.H]];
    for (let i = 1; i <= 14; i++) { const t = i / 14, x = (1 - t) ** 2 * -g.B + 2 * (1 - t) * t * -(g.B + 2 * g.fg) + t * t * -g.bb, y = (1 - t) ** 2 * g.H + 2 * (1 - t) * t * (g.H / 2) + t * t * g.lr * 2; pts.push([x, y]); }
    pts.push([-g.bb, 0], [-g.bb + 0.04, 0], [-g.bb + 0.04, g.lr], [-g.bb + 0.04 + g.lr, g.lr], [-g.bb + 0.04 + g.lr, 0]);
    return pts;
  }
  S.corniche = {
    name: 'Corniche',
    fields: [f('H', 'Hauteur H', 0.80, 0.4, 1.5, 0.01), f('B', 'Largeur en tête B', 0.35, 0.15, 0.8, 0.01), f('bb', 'Largeur en pied bb', 0.25, 0.1, 0.7, 0.01), f('fg', 'Flèche du galbe fg', 0.10, 0, 0.3, 0.01), f('lr', 'Larmier lr', 0.03, 0.01, 0.08, 0.005),
      f('Le', 'Longueur d\'élément Le', 2.00, 0.5, 5, 0.05, 'm', 'Éléments'), f('j', 'Joint j', 0.01, 0, 0.05, 0.005, 'm', 'Éléments'),
      f('es', 'Épaisseur dalle es', 0.25, 0.15, 0.5, 0.01, 'm', 'Tablier'), f('bl', 'Largeur longrine BN4 bl', 0.65, 0.3, 1.2, 0.01, 'm', 'Tablier'), f('hl', 'Hauteur longrine hl', 0.15, 0.05, 0.5, 0.01, 'm', 'Tablier')],
    validate(g) { const e = []; if (g.bb > g.B + g.fg) e.push('Pied plus large que le galbe.'); if (g.hl + g.es > g.H) e.push('Dalle + longrine plus hautes que la corniche.'); return e; },
    views(g) {
      const yd = g.H - g.hl, A = V('Coupe type').cut(cornProfile(g)).seen(RECT(0, yd - g.es, 1.4, g.es)).brk(1.4, 1.4, yd - g.es / 2).seen(RECT(0, yd, g.bl, g.hl));
      A.chainH([[-g.B, g.H], [0, g.H]], g.H + 0.2, ['B']).chainH([[-g.bb, 0], [0, 0]], -0.18, ['bb']).chainV([[0, 0], [0, g.H]], 0.0 + 1.55, ['H']).chainV([[1.4, yd - g.es], [1.4, yd]], 1.7, ['es']).chainV([[g.bl, yd], [g.bl, g.H]], g.bl + 0.15, ['hl']).chainH([[0, g.H], [g.bl, g.H]], g.H + 0.2, ['bl']);
      A.text([0.7, yd - g.es / 2 - 0.03], 'Dalle', 2.2, { it: true, noSchema: true }).text([g.bl / 2, g.H + 0.42], 'Longrine BN4', 2, { it: true, noSchema: true });
      const n3 = 3, E = V('Élévation (3 éléments)'), T = V('Vue de dessus');
      for (let i = 0; i < n3; i++) { const x = i * (g.Le + g.j); E.seen(RECT(x, 0, g.Le, g.H)).line([[x, g.lr * 2], [x + g.Le, g.lr * 2]], 'thin'); T.seen(RECT(x, -g.B, g.Le, g.B)); }
      E.chainH([[0, g.H], [g.Le, g.H]], g.H + 0.25, ['Le']).chainV([[0, 0], [0, g.H]], -0.3, ['H']); T.chainH([[0, 0], [g.Le, 0]], 0.25, ['Le']).chainV([[0, -g.B], [0, 0]], -0.3, ['B']);
      return [A, E, T];
    },
    qty(g) { return [['Élément de corniche', area(cornProfile(g)) * g.Le]]; },
  };

  /* ═════════════ PORTIQUE OUVERT (PIPO) ═════════════ */
  S.pipo = {
    name: 'Portique ouvert (PIPO)',
    fields: [f('O', 'Ouverture O', 8.00, 2, 20), f('Hi', 'Hauteur libre Hi', 5.00, 2, 10), f('et', 'Épaisseur traverse et', 0.60, 0.3, 1.5, 0.01), f('ep', 'Épaisseur piédroits ep', 0.60, 0.3, 1.5, 0.01), f('g', 'Goussets g', 0.30, 0, 1, 0.05), f('L', 'Longueur L', 12.00, 3, 50),
      f('bs', 'Largeur semelles bs', 2.60, 0.8, 6, 0.05, 'm', 'Semelles'), f('hs', 'Épaisseur semelles hs', 0.80, 0.3, 2, 0.05, 'm', 'Semelles'), f('ds', 'Débord extérieur ds', 0.80, 0, 3, 0.05, 'm', 'Semelles')],
    validate(g) { const e = []; if (g.ds + g.ep > g.bs) e.push('Semelle trop étroite (ds + ep > bs).'); if (g.g > g.O / 4) e.push('Goussets trop grands.'); return e; },
    views(g) {
      const W = 2 * g.ep + g.O, yt = g.hs + g.Hi, top = yt + g.et, x0 = -W / 2;
      const P = [[x0, g.hs], [x0 + g.ep, g.hs], [x0 + g.ep, yt - g.g], [x0 + g.ep + g.g, yt], [-x0 - g.ep - g.g, yt], [-x0 - g.ep, yt - g.g], [-x0 - g.ep, g.hs], [-x0, g.hs], [-x0, top], [x0, top]];
      const sl = x0 - g.ds, sr = -x0 + g.ds;
      const A = V('Coupe transversale').cut(P).cut(RECT(sl, 0, g.bs, g.hs)).cut(RECT(sr - g.bs, 0, g.bs, g.hs)); bp(A, sl, sl + g.bs, 0); bp(A, sr - g.bs, sr, 0);
      A.ground(sl - 0.8, sl - 0.1, -0.1).ground(sl + g.bs + 0.1, sr - g.bs - 0.1, g.hs + 0.3).ground(sr + 0.1, sr + 0.8, -0.1).line([[0, -0.3], [0, top + 0.4]], 'axis');
      A.chainH([[x0, top], [x0 + g.ep, top], [-x0 - g.ep, top], [-x0, top]], top + 0.7, ['ep', 'O', 'ep'], top + 1.4, null).chainH([[sl, 0], [x0, g.hs], [sl + g.bs, 0]], -0.8, ['ds', null]).chainH([[sl, 0], [sl + g.bs, 0]], -1.4, ['bs']);
      A.chainV([[sl, 0], [sl, g.hs], [x0, yt], [x0, top]], sl - 0.9, ['hs', 'Hi', 'et']).dimH([x0 + g.ep, yt - g.g], [x0 + g.ep + g.g, yt], yt - g.g - 0.5, 'g');
      const E = V('Élévation d\'un piédroit').seen(RECT(0, 0, g.L, g.hs)).seen(RECT(0, g.hs, g.L, g.Hi)).seen(RECT(0, yt, g.L, g.et)); bp(E, 0, g.L, 0);
      E.chainH([[0, top], [g.L, top]], top + 0.7, ['L']).chainV([[g.L, 0], [g.L, g.hs], [g.L, yt], [g.L, top]], g.L + 0.8, ['hs', 'Hi', 'et']);
      const Cv = V('Vue en plan').seen(RECT(x0, 0, W, g.L)).line([[sl, 0], [sl, g.L]], 'hidden').line([[sl + g.bs, 0], [sl + g.bs, g.L]], 'hidden').line([[sr - g.bs, 0], [sr - g.bs, g.L]], 'hidden').line([[sr, 0], [sr, g.L]], 'hidden').line([[x0 + g.ep, 0], [x0 + g.ep, g.L]], 'hidden').line([[-x0 - g.ep, 0], [-x0 - g.ep, g.L]], 'hidden').line([[0, -0.4], [0, g.L + 0.4]], 'axis');
      Cv.chainH([[x0, 0], [-x0, 0]], -0.8, [null]).chainV([[-x0, 0], [-x0, g.L]], sr + 0.8, ['L']);
      return [A, E, Cv];
    },
    qty(g) { const W = 2 * g.ep + g.O; return [['Semelles', 2 * g.bs * g.hs * g.L], ['Piédroits + traverse', (W * (g.Hi + g.et) - g.O * g.Hi + g.g * g.g) * g.L]]; },
  };

  /* ═════════════ MUR EN U (trémies) ═════════════ */
  S.murU = {
    name: 'Mur en U (trémies)',
    fields: [f('Bi', 'Largeur intérieure Bi', 9.00, 3, 30), f('Hv', 'Hauteur des voiles Hv', 5.00, 1, 12), f('ev', 'Épaisseur voiles ev', 0.60, 0.25, 1.5, 0.01), f('er', 'Épaisseur radier er', 0.80, 0.3, 2, 0.01), f('db', 'Débord du radier db', 0.50, 0, 3, 0.05), f('L', 'Longueur du plot L', 15.00, 3, 40, 0.5), f('cv', 'Chanfrein voile/radier cv', 0.20, 0, 0.8, 0.05)],
    validate(g) { return g.cv > g.Hv / 4 ? ['Chanfrein trop grand.'] : []; },
    views(g) {
      const xi = g.Bi / 2, xo = xi + g.ev, xr = xo + g.db, top = g.er + g.Hv;
      const P = [[-xr, 0], [xr, 0], [xr, g.er], [xo, g.er], [xo, top], [xi, top], [xi, g.er + g.cv], [xi - g.cv, g.er], [-xi + g.cv, g.er], [-xi, g.er + g.cv], [-xi, top], [-xo, top], [-xo, g.er], [-xr, g.er]];
      const A = V('Coupe transversale').cut(P); bp(A, -xr, xr, 0); A.ground(-xr - 0.8, -xr - 0.1, -0.1).ground(xr + 0.1, xr + 0.8, -0.1).line([[0, -0.3], [0, top + 0.3]], 'axis').line([[-xi, g.er + 0.12], [xi, g.er + 0.12]], 'thin').text([0, g.er + 0.35], 'Chaussée', 2.2, { it: true, noSchema: true });
      A.chainH([[-xr, 0], [-xo, g.er], [-xi, top], [xi, top], [xo, top], [xr, 0]], -0.8, ['db', 'ev', 'Bi', 'ev', 'db'], -1.5, null).chainV([[xr, 0], [xr, g.er], [xo, top]], xr + 0.8, ['er', 'Hv']).dimH([-xi, g.er + g.cv], [-xi + g.cv, g.er], g.er + g.cv + 0.5, 'cv');
      const E = V('Élévation intérieure d\'un voile').seen(RECT(0, 0, g.L, g.er)).seen(RECT(0, g.er, g.L, g.Hv)); bp(E, 0, g.L, 0);
      E.chainH([[0, top], [g.L, top]], top + 0.7, ['L']).chainV([[g.L, 0], [g.L, g.er], [g.L, top]], g.L + 0.8, ['er', 'Hv']);
      const Cv = V('Vue en plan').seen(RECT(-xr, 0, 2 * xr, g.L)).seen(RECT(-xo, 0, g.ev, g.L)).seen(RECT(xi, 0, g.ev, g.L)).line([[0, -0.4], [0, g.L + 0.4]], 'axis');
      Cv.chainH([[-xr, 0], [xr, 0]], -0.8, [null]).chainV([[xr, 0], [xr, g.L]], xr + 0.8, ['L']);
      return [A, E, Cv];
    },
    qty(g) { const xi = g.Bi / 2, xo = xi + g.ev, xr = xo + g.db; return [['Radier', 2 * xr * g.er * g.L], ['Voiles', 2 * g.ev * g.Hv * g.L]]; },
  };

  /* ═════════════ TÊTE D'OUVRAGE HYDRAULIQUE ═════════════ */
  S.teteOH = {
    name: 'Tête d\'ouvrage hydraulique',
    fields: [n('nb', 'Nombre de buses nb', 2, 1, 6, 'Buses'), f('D', 'Diamètre intérieur D', 1.00, 0.3, 3, 0.05, 'm', 'Buses'), f('eb', 'Épaisseur buse eb', 0.15, 0.05, 0.4, 0.01, 'm', 'Buses'), f('sb', 'Entraxe buses sb', 1.56, 0.5, 5, 0.01, 'm', 'Buses'),
      f('Lm', 'Longueur mur de tête Lm', 7.05, 1, 20, 0.05, 'm', 'Mur de tête'), f('Hm', 'Hauteur mur de tête Hm', 1.70, 0.5, 5, 0.05, 'm', 'Mur de tête'), f('em', 'Épaisseur mur de tête em', 0.30, 0.15, 1, 0.01, 'm', 'Mur de tête'),
      f('La', 'Longueur des ailes La', 2.50, 0.5, 8, 0.05, 'm', 'Ailes'), f('alpha', 'Angle des ailes α', 33, 0, 60, 1, '°', 'Ailes'), f('ha', 'Hauteur aile en about ha', 0.60, 0.2, 3, 0.05, 'm', 'Ailes'), f('ea', 'Épaisseur ailes ea', 0.25, 0.15, 0.8, 0.01, 'm', 'Ailes'),
      f('hr', 'Épaisseur radier hr', 0.30, 0.15, 1, 0.01, 'm', 'Radier'), f('hpf', 'Profondeur parafouille hpf', 0.60, 0, 2, 0.05, 'm', 'Radier'), f('epf', 'Épaisseur parafouille epf', 0.30, 0.15, 1, 0.01, 'm', 'Radier')],
    validate(g) { const e = []; if ((g.nb - 1) * g.sb + g.D + 2 * g.eb > g.Lm) e.push('Buses hors du mur de tête.'); if (g.D + 2 * g.eb > g.Hm) e.push('Mur de tête moins haut que les buses.'); if (g.ha > g.Hm) e.push('ha doit être ≤ Hm.'); return e; },
    views(g) {
      const a = g.alpha * Math.PI / 180, sx = Math.sin(a), cy = Math.cos(a), Lh = g.Lm / 2, X = Lh + g.La * sx, Yd = -g.La * cy, B = spread(g.nb, g.sb), R = g.D / 2 + g.eb;
      // vue en plan (y vers l'aval négatif)
      const Pv = V('Vue en plan').seen([[-Lh, 0], [Lh, 0], [X, Yd], [-X, Yd]]).seen(RECT(-Lh, 0, g.Lm, g.em));
      [-1, 1].forEach((s) => Pv.seen([[s * Lh, 0], [s * X, Yd], [s * (X + cy * g.ea), Yd + sx * g.ea], [s * (Lh + cy * g.ea), sx * g.ea]]));
      B.forEach((x) => Pv.line([[x - R, g.em], [x - R, g.em + 1.6]], 'hidden').line([[x + R, g.em], [x + R, g.em + 1.6]], 'hidden').line([[x, Yd - 0.4], [x, g.em + 1.8]], 'axis'));
      Pv.line([[-X, Yd + g.epf], [X, Yd + g.epf]], 'hidden');
      Pv.chainH([[-Lh, g.em], [Lh, g.em]], g.em + 2.2, ['Lm']).chainH([[-X, Yd], [X, Yd]], Yd - 0.8, null).dim([Lh, 0], [X, Yd], 0.5, 'La').chainV([[Lh, 0], [Lh, g.em]], X + 0.8, ['em']).text([X - 0.2, -0.4], 'α = ' + g.alpha + '°', 2.4, { a: 'end' });
      // élévation face aval
      const E = V('Élévation face aval');
      E.seen(RECT(-X, -g.hr, 2 * X, g.hr)).seen([[-Lh, 0], [Lh, 0], [Lh, g.Hm], [-Lh, g.Hm]], B.map((x) => C.CIRC(x, R, R)));
      [-1, 1].forEach((s) => E.seen([[s * Lh, 0], [s * X, 0], [s * X, g.ha], [s * Lh, g.Hm]]));
      B.forEach((x) => E.circ([x, R], g.D / 2, 'thin').line([[x, -0.3], [x, g.Hm + 0.3]], 'axis'));
      if (g.hpf > 0) E.seen(RECT(-X, -g.hr - g.hpf, 2 * X, g.hpf));
      E.chainH([[-X, -g.hr]].concat([[X, -g.hr]]), -g.hr - g.hpf - 0.7, null).chainH([[-Lh, g.Hm], [Lh, g.Hm]], g.Hm + 0.7, ['Lm']);
      if (B.length > 1) E.chainH(B.map((x) => [x, R]), g.Hm + 0.3, B.slice(1).map(() => 'sb'));
      E.chainV([[-X, -g.hr - g.hpf], [-X, -g.hr], [-X, 0], [-X, g.ha]], -X - 0.7, ['hpf', 'hr', 'ha']).chainV([[Lh, 0], [Lh, g.Hm]], X + 0.7, ['Hm']).chainH([[B[0] - g.D / 2, R], [B[0] + g.D / 2, R]], R, ['D']);
      // coupe dans l'axe d'une buse
      const t0 = Yd, Cc = V('Coupe dans l\'axe d\'une buse');
      Cc.cut([[t0, -g.hr - g.hpf], [t0 + g.epf, -g.hr - g.hpf], [t0 + g.epf, -g.hr], [g.em, -g.hr], [g.em, 0], [t0, 0]]);
      Cc.cut(RECT(0, 2 * R, g.em, g.Hm - 2 * R));
      Cc.cut(RECT(0, 0, g.em + 1.6, g.eb)).cut(RECT(0, g.eb + g.D, g.em + 1.6, g.eb)).brkV(g.em + 1.6, 0, 2 * R);
      Cc.seen([[t0, 0], [0, 0], [0, g.Hm], [t0, g.ha]]).line([[t0 - 0.3, R], [g.em + 1.9, R]], 'axis');
      Cc.ground(g.em + 0.1, g.em + 1.6, g.Hm).chainH([[t0, -g.hr - g.hpf], [t0 + g.epf, -g.hr - g.hpf]], -g.hr - g.hpf - 0.5, ['epf']).chainH([[0, g.Hm], [g.em, g.Hm]], g.Hm + 0.5, ['em']).chainV([[t0, -g.hr - g.hpf], [t0, -g.hr], [t0, 0]], t0 - 0.7, ['hpf', 'hr']).chainV([[0, 0], [0, g.Hm]], -0.5, ['Hm']);
      return [Pv, E, Cc];
    },
    qty(g) { const a = g.alpha * Math.PI / 180, X = g.Lm / 2 + g.La * Math.sin(a), Yd = g.La * Math.cos(a), R = g.D / 2 + g.eb; return [['Radier + parafouille', (g.Lm + X * 2) / 2 * (Yd + g.em) * g.hr + 2 * X * g.epf * g.hpf], ['Mur de tête', (g.Lm * g.Hm - g.nb * Math.PI * R * R) * g.em], ['Ailes', 2 * g.La * (g.Hm + g.ha) / 2 * g.ea]]; },
  };

  /* ═════════════ MUR DE SOUTÈNEMENT et DALOT (géométrie des modules existants) ═════════════ */
  const FR = () => root.FERR && root.FERR.STRUCTURES;
  S.murT = {
    name: 'Mur de soutènement', ferr: true,
    fields: [f('H', 'Hauteur totale H', 4.00, 0.6, 12), f('hs', 'Semelle hs', 0.70, 0.2, 2), f('e0', 'Voile en tête e0', 0.25, 0.15, 1.5, 0.01), f('fa', 'Fruit amont', 0.075, 0, 0.3, 0.005, 'm/m'), f('fv', 'Fruit aval', 0, 0, 0.2, 0.005, 'm/m'), f('p', 'Patin p', 0.50, 0, 6), f('B', 'Semelle B', 3.70, 0.5, 12), f('L', 'Longueur plot L', 10.00, 1, 40, 0.5)],
    validate(g) { return g.p + g.e0 + (g.fa + g.fv) * (g.H - g.hs) > g.B ? ['Voile plus large que la semelle.'] : []; },
    views(g) {
      let outer;
      try { const F = FR(); if (F && F.murT) { const gg = {}; F.murT.fields.forEach((x) => { gg[x.k] = x.def; }); Object.assign(gg, g); outer = F.murT.outline(gg).outer; } } catch (e) { outer = null; }
      const Hv = g.H - g.hs, eb = g.e0 + (g.fa + g.fv) * Hv;
      if (!outer) outer = [[0, 0], [g.B, 0], [g.B, g.hs], [g.p + eb, g.hs], [g.p + g.fv * Hv + g.e0, g.H], [g.p + g.fv * Hv, g.H], [g.p, g.hs], [0, g.hs]];
      const A = V('Coupe transversale').cut(outer); bp(A, 0, g.B, 0); A.ground(-0.8, -0.1, -0.1).ground(g.B + 0.1, g.B + 0.8, -0.1);
      A.chainH([[0, 0], [g.p, g.hs], [g.p + eb, g.hs], [g.B, 0]], -0.8, ['p', null, null], -1.4, 'B').chainH([[g.p + g.fv * Hv, g.H], [g.p + g.fv * Hv + g.e0, g.H]], g.H + 0.5, ['e0']).chainV([[0, 0], [0, g.hs], [g.p, g.H]], -0.8, ['hs', null]).chainV([[g.B, 0], [g.B, g.H]], g.B + 0.8, ['H']);
      const E = V('Élévation d\'un plot').seen(RECT(0, 0, g.L, g.hs)).seen(RECT(0, g.hs, g.L, Hv)); bp(E, 0, g.L, 0);
      E.chainH([[0, g.H], [g.L, g.H]], g.H + 0.6, ['L']).chainV([[g.L, 0], [g.L, g.hs], [g.L, g.H]], g.L + 0.7, ['hs', null]);
      const Pv = V('Vue en plan').seen(RECT(0, 0, g.L, g.B)).line([[0, g.p], [g.L, g.p]], 'thin').line([[0, g.p + eb], [g.L, g.p + eb]], 'thin');
      Pv.chainH([[0, 0], [g.L, 0]], -0.7, ['L']).chainV([[g.L, 0], [g.L, g.B]], g.L + 0.7, ['B']);
      return [A, E, Pv];
    },
    qty(g) { const Hv = g.H - g.hs; return [['Semelle', g.B * g.hs * g.L], ['Voile', (2 * g.e0 + (g.fa + g.fv) * Hv) / 2 * Hv * g.L]]; },
  };
  S.dalot = {
    name: 'Dalot cadre fermé', ferr: true,
    fields: [f('O', 'Ouverture intérieure O', 2.00, 0.5, 8), f('Hi', 'Hauteur intérieure Hi', 1.50, 0.5, 6), f('et', 'Épaisseur traverse et', 0.25, 0.15, 1, 0.01), f('ep', 'Épaisseur piédroits ep', 0.25, 0.15, 1, 0.01), f('er', 'Épaisseur radier er', 0.30, 0.15, 1, 0.01), f('g', 'Goussets g (45°)', 0.15, 0, 0.5), f('L', 'Longueur L', 10.00, 1, 40)],
    validate(g) { return g.g > Math.min(g.O, g.Hi) / 3 ? ['Goussets trop grands par rapport à l\'ouverture.'] : []; },
    views(g) {
      const Be = g.O + 2 * g.ep, He = g.er + g.Hi + g.et, G = g.g, ep = g.ep, er = g.er;
      const inner = G > 0.001 ? [[ep, er + G], [ep + G, er], [Be - ep - G, er], [Be - ep, er + G], [Be - ep, He - g.et - G], [Be - ep - G, He - g.et], [ep + G, He - g.et], [ep, He - g.et - G]] : RECT(ep, er, g.O, g.Hi);
      const A = V('Coupe transversale').cut(RECT(0, 0, Be, He), [inner]); bp(A, 0, Be, 0); A.ground(-0.6, -0.1, -0.1).ground(Be + 0.1, Be + 0.6, -0.1).line([[Be / 2, -0.3], [Be / 2, He + 0.3]], 'axis');
      A.chainH([[0, He], [ep, He - g.et], [Be - ep, He - g.et], [Be, He]], He + 0.5, ['ep', 'O', 'ep'], He + 1.0, null).chainV([[Be, 0], [Be, er], [Be - ep, He - g.et], [Be, He]], Be + 0.6, ['er', 'Hi', 'et']);
      if (G > 0.001) A.dimH([ep, er + G], [ep + G, er], er + G + 0.35, 'g');
      const E = V('Coupe longitudinale').seen(RECT(0, 0, g.L, g.er)).seen(RECT(0, He - g.et, g.L, g.et)).line([[0, g.er], [0, He - g.et]], 'hidden').line([[g.L, g.er], [g.L, He - g.et]], 'hidden'); bp(E, 0, g.L, 0);
      E.chainH([[0, He], [g.L, He]], He + 0.5, ['L']);
      const Pv = V('Vue en plan').seen(RECT(0, 0, g.L, Be)).line([[0, ep], [g.L, ep]], 'hidden').line([[0, Be - ep], [g.L, Be - ep]], 'hidden').line([[-0.3, Be / 2], [g.L + 0.3, Be / 2]], 'axis');
      Pv.chainH([[0, 0], [g.L, 0]], -0.6, ['L']).chainV([[g.L, 0], [g.L, Be]], g.L + 0.6, [null]);
      return [A, E, Pv];
    },
    qty(g) { const Be = g.O + 2 * g.ep, He = g.er + g.Hi + g.et; return [['Cadre', (Be * He - g.O * g.Hi + 2 * g.g * g.g) * g.L]]; },
  };

  root.COFF_REG = Object.assign(root.COFF_REG || {}, S);
})(typeof window !== 'undefined' ? window : globalThis);
