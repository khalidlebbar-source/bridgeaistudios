/* BridgeAI Studios — Bridge Composer : vue 3D de l'ouvrage.
 *
 * build3D(M)  → { faces: [{ p: [[x, y, z], …], mat, tag }], box }   x : axe longitudinal, y : transversal, z : vertical
 * render3D(model, cam, opt) → chaîne SVG (projection orthographique, tri des faces par profondeur, ombrage de Lambert)
 *   cam : { yaw, pitch, zoom, panX, panY } (radians, facteur, px) ; opt : { width, height, wire, sel }
 * Géométrie reprise de l'élévation (cotes d'arase identiques) : dessus du tablier à z = 0.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const C = (typeof module === 'object' && module.exports) ? require('./calc.js') : self.COMP;

  function build3D(M) {
    const F = [], h = M.h, sec = M.sec, n = M.xs.length - 1, xs = M.xs, dab = M.dab, Ltot = M.Ltot, W = M.W;
    const ySeat = -(h + C.seatDrop(M.S, M.W));
    let tag = null, mat = 'beton';
    let hz = null, ph = null, inside = null;   // phase de construction (cases à cocher de la vue 3D)
    const PH_MAT = { pieu: 'pieux', gros: 'gros', fond: 'semelles', app: 'app', prefa: 'poutres', hourdis: 'hourdis', dt: 'dt', acier: 'poutres', pred: 'predalles' };
    /* face orientée : inw = direction vers l'intérieur du solide ; la face est retournée pour que sa normale (Newell) pointe vers l'intérieur,
       ce qui permet d'éliminer les faces arrière au rendu (et de tracer les contours de silhouette) */
    const face = (p, ne, inw) => {
      if (inw) {
        let nx = 0, ny = 0, nz = 0;
        for (let i = 0; i < p.length; i++) { const a = p[i], c = p[(i + 1) % p.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
        if (nx * inw[0] + ny * inw[1] + nz * inw[2] < 0) p = p.slice().reverse();
      }
      const under = hz != null && p.every((q) => Math.abs(q[2] - hz) < 1e-6);   // dessus de table de poutre collé sous le hourdis
      F.push({ p, mat, tag, ne, hz, or: !!inw, ph: ph || PH_MAT[mat] || 'futs', under, inside });
    };
    const area2 = (Q) => { let A = 0; for (let i = 0; i < Q.length; i++) { const a = Q[i], c = Q[(i + 1) % Q.length]; A += a[0] * c[1] - c[0] * a[1]; } return A; };
    const inN = (a, c, A) => { const du = c[0] - a[0], dv = c[1] - a[1]; return A > 0 ? [-dv, du] : [dv, -du]; };   // normale intérieure d'une arête du profil
    /* parallélépipède [x0, x1] × [y0, y1] × [z0, z1] */
    const box = (x0, x1, y0, y1, z0, z1) => {
      if (x0 > x1) [x0, x1] = [x1, x0];
      if (y0 > y1) [y0, y1] = [y1, y0];
      if (z0 > z1) [z0, z1] = [z1, z0];
      // grand bloc (semelle, gros béton, sommier) : découpé en pavés de 2,5 m pour un tri du peintre juste, joints invisibles
      const nx = Math.ceil((x1 - x0) / 2.5 - 1e-9), ny = Math.ceil((y1 - y0) / 2.5 - 1e-9);
      if (nx * ny > 1) {
        for (let i = 0; i < nx; i++) for (let k = 0; k < ny; k++) {
          const a = x0 + (x1 - x0) * i / nx, b = x0 + (x1 - x0) * (i + 1) / nx, c = y0 + (y1 - y0) * k / ny, d = y0 + (y1 - y0) * (k + 1) / ny;
          face([[a, c, z0], [b, c, z0], [b, d, z0], [a, d, z0]], true, [0, 0, 1]);
          face([[a, c, z1], [a, d, z1], [b, d, z1], [b, c, z1]], true, [0, 0, -1]);
          if (k === 0) face([[a, c, z0], [a, c, z1], [b, c, z1], [b, c, z0]], true, [0, 1, 0]);
          if (k === ny - 1) face([[a, d, z0], [b, d, z0], [b, d, z1], [a, d, z1]], true, [0, -1, 0]);
          if (i === 0) face([[a, c, z0], [a, d, z0], [a, d, z1], [a, c, z1]], true, [1, 0, 0]);
          if (i === nx - 1) face([[b, c, z0], [b, c, z1], [b, d, z1], [b, d, z0]], true, [-1, 0, 0]);
        }
        return;
      }
      face([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], false, [0, 0, 1]);
      face([[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]], false, [0, 0, -1]);
      face([[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], false, [0, 1, 0]);
      face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], false, [0, -1, 0]);
      face([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], false, [1, 0, 0]);
      face([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], false, [-1, 0, 0]);
    };
    /* prisme vertical octogonal (colonne, pieu) */
    const cyl = (xc, yc, D, z0, z1) => {
      const k = 28, r = D / 2, ring = [];   // cylindre lissé : facettes fines sans arêtes dessinées
      for (let i = 0; i < k; i++) { const a = (i + 0.5) * 2 * Math.PI / k; ring.push([xc + r * Math.cos(a), yc + r * Math.sin(a)]); }
      const sz = z1 > z0 ? 1 : -1;
      face(ring.map((q) => [q[0], q[1], z0]), false, [0, 0, sz]);
      face(ring.slice().reverse().map((q) => [q[0], q[1], z1]), false, [0, 0, -sz]);
      for (let i = 0; i < k; i++) { const a = ring[i], b = ring[(i + 1) % k]; face([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], true, [xc - (a[0] + b[0]) / 2, yc - (a[1] + b[1]) / 2, 0]); }
    };
    /* extrusion d'une section (points [y, z]) entre x0 et x1 */
    const extrude = (pts, x0, x1) => {
      const A = area2(pts), sx = x1 > x0 ? 1 : -1;
      face(pts.map((q) => [x0, q[0], q[1]]), false, [sx, 0, 0]);
      face(pts.slice().reverse().map((q) => [x1, q[0], q[1]]), false, [-sx, 0, 0]);
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], n = inN(a, b, A); face([[x0, a[0], a[1]], [x1, a[0], a[1]], [x1, b[0], b[1]], [x0, b[0], b[1]]], false, [0, n[0], n[1]]); }
    };

    // ── tablier ──
    tag = 'tablier';
    const pieces = [];
    if (M.cont) pieces.push([-dab, Ltot + dab]);
    else for (let i = 0; i < n; i++) pieces.push([i === 0 ? -dab : xs[i] + 0.04, i === n - 1 ? Ltot + dab : xs[i + 1] - 0.04]);
    // tablier découpé en tronçons de 3 m : le tri du peintre par centre de face reste juste (pas de longues faces)
    // et hourdis découpé en bandes transversales de 1,5 m (même raison)
    const band = (pts, y0, y1) => {
      const cut1 = (P, inside, yc) => { const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ia = inside(a), ib = inside(b); if (ia) out.push(a); if (ia !== ib) { const t = (yc - a[0]) / (b[0] - a[0]); out.push([yc, a[1] + t * (b[1] - a[1])]); } } return out; };
      const r = cut1(pts, (q) => q[0] >= y0, y0); return r.length ? cut1(r, (q) => q[0] <= y1, y1) : r;
    };
    sec.polys.forEach((pg) => {
      mat = pg.mat === 'acier' ? 'acier' : pg.role === 'poutre' ? 'prefa' : pg.role === 'hourdis' ? 'hourdis' : 'beton';
      hz = pg.role === 'poutre' && sec.info && sec.info.eh ? -sec.info.eh : null;
      const cut = pg.mat === 'acier' ? 0.2 : 0, ys = pg.pts.map((q) => q[0]), ya = Math.min(...ys), yb = Math.max(...ys);
      const nb = pg.role === 'poutre' ? 1 : Math.max(1, Math.ceil((yb - ya) / 1.5));
      const cutsY = Array.from({ length: Math.max(0, nb - 1) }, (_, k) => ya + (yb - ya) * (k + 1) / nb);
      const parts = nb === 1 ? [pg.pts] : Array.from({ length: nb }, (_, k) => band(pg.pts, ya + (yb - ya) * k / nb, ya + (yb - ya) * (k + 1) / nb)).filter((q) => q.length >= 3);
      // hourdis : continu (dalle de continuité) — coupé seulement aux joints de chaussée intermédiaires
      const jx = (M.joints || []).map((jj) => jj.x).filter((x) => x > -dab + 0.1 && x < Ltot + dab - 0.1).sort((p_, q_) => p_ - q_);
      const hp = [-dab].concat(jx.flatMap((x) => [x - 0.04, x + 0.04]), [Ltot + dab]), hPieces = [];
      for (let k = 0; k < hp.length; k += 2) hPieces.push([hp[k], hp[k + 1]]);
      // bandes de continuité (dallettes) sur les appuis intermédiaires sans joint : 1,00 m de part et d'autre de l'axe
      const LB = 1.0, bands = xs.slice(1, -1).filter((x) => !jx.some((j) => Math.abs(j - x) < 0.2));
      const hSeg = [];
      hPieces.forEach(([a, b]) => {
        const cuts = bands.filter((x) => x > a && x < b).flatMap((x) => [x - LB, x + LB]);
        const pts_ = [a].concat(cuts, [b]);
        for (let k = 0; k < pts_.length - 1; k++) hSeg.push([pts_[k], pts_[k + 1], k % 2 ? 'hourdisB' : 'hourdis']);
      });
      (pg.role === 'hourdis' && M.T.famille === 'poutres' ? hSeg : pieces).forEach(([x0, x1, phx]) => {
        ph = phx || null;
        const a0 = x0 + cut, a1 = x1 - cut, ns = Math.max(1, Math.ceil((a1 - a0) / 3));
        for (let k = 0; k < ns; k++) parts.forEach((q) => {   // faces des tronçons sans arêtes (pas de quadrillage), arêtes gardées aux abouts
          const xa = a0 + (a1 - a0) * k / ns, xb = a0 + (a1 - a0) * (k + 1) / ns;
          const Aq = area2(q);
          if (k === 0) face(q.map((v) => [xa, v[0], v[1]]), true, [1, 0, 0]); if (k === ns - 1) face(q.slice().reverse().map((v) => [xb, v[0], v[1]]), true, [-1, 0, 0]);
          for (let i = 0; i < q.length; i++) { const u = q[i], w = q[(i + 1) % q.length];
            if (nb > 1 && Math.abs(u[0] - w[0]) < 1e-9 && cutsY.some((yc) => Math.abs(u[0] - yc) < 1e-9)) continue;   // paroi interne entre bandes
            const n = inN(u, w, Aq); face([[xa, u[0], u[1]], [xb, u[0], u[1]], [xb, w[0], w[1]], [xa, w[0], w[1]]], true, [0, n[0], n[1]]); }
        });
      });
    });
    hz = null; ph = null;
    // prédalles (.06) entre tables de poutres, posées de .06 sur chaque table
    if (M.T.famille === 'poutres' && sec.info && sec.info.btab) {
      const i = sec.info, bx = sec.bear; mat = 'pred'; ph = 'predalles';
      // découpées aux limites des bandes de continuité : chaque morceau n'est dessiné que si le hourdis qui le recouvre est masqué
      const bandsP = xs.slice(1, -1), LBp = 1.0;
      pieces.forEach(([x0, x1]) => {
        const c_ = bandsP.flatMap((x) => [x - LBp, x + LBp]).filter((x) => x > x0 + 0.05 && x < x1 - 0.05), q_ = [x0 + 0.05].concat(c_, [x1 - 0.05]);
        for (let m = 0; m < q_.length - 1; m++) {
          const xm = (q_[m] + q_[m + 1]) / 2; inside = bandsP.some((x) => Math.abs(xm - x) < LBp) ? 'hourdisB' : 'hourdis';
          for (let k = 0; k < bx.length - 1; k++) { if (sec.jumeaux && bx[k] < 0 && bx[k + 1] > 0) continue; const ya = bx[k] + i.btab / 2 - 0.06, yb = bx[k + 1] - i.btab / 2 + 0.06; if (yb - ya > 0.2) box(q_[m], q_[m + 1], ya, yb, -i.eh, -i.eh + 0.06); }
        }
      });
      inside = null;
      ph = null;
    }
    // entretoises d'about (sur appuis) entre poutres d'un même tablier
    if (M.T.famille === 'poutres' && sec.info && sec.info.btab) {
      const i = sec.info, bx = sec.bear, zt = -i.eh - i.etab - 0.10, zb = -(h - 0.25), ee = 0.40;
      mat = 'prefa'; ph = 'entretoises';
      pieces.forEach(([x0, x1]) => [[x0 + 0.10, x0 + 0.10 + ee], [x1 - 0.10 - ee, x1 - 0.10]].forEach(([a, b2]) => {
        for (let k = 0; k < bx.length - 1; k++) {
          if (sec.jumeaux && bx[k] < 0 && bx[k + 1] > 0) continue;
          box(a, b2, bx[k] + i.b0 / 2, bx[k + 1] - i.b0 / 2, zt, zb);
        }
      }));
      ph = null;
    }

    // ── appareils d'appui et bossages ──
    tag = null;
    M.lines.forEach((l) => sec.bear.forEach((y) => {
      mat = 'app'; box(l.x - 0.2, l.x + 0.2, y - 0.2, y + 0.2, -h, -h - 0.12);
      mat = 'beton'; ph = 'app'; box(l.x - 0.3, l.x + 0.3, y - 0.3, y + 0.3, -h - 0.12, ySeat); ph = null;
    }));

    // ── appuis ──
    M.supports.forEach((s) => {
      const g = s.geo; let yS = ySeat, yft = ySeat - s.H;
      tag = s.id; mat = 'beton';
      let xf = s.x;
      if (s.kind === 'pile') {
        let zTop = ySeat;
        if (g.ch) {
          ph = 'chev';
          if (g.ch.kind === 'marteau') {
            const L = g.ch.L, bf = g.ch.bf, b = g.ch.b;
            const pts = [[-L / 2, ySeat], [-L / 2, ySeat - g.ch.h2], [-bf / 2, ySeat - g.ch.h], [bf / 2, ySeat - g.ch.h], [L / 2, ySeat - g.ch.h2], [L / 2, ySeat]];
            const ex = (x0, x1) => extrude(pts, x0, x1);
            ex(s.x - b / 2, s.x + b / 2);
          } else if (M.sec.jumeaux || g.redan) {   // chevêtre par demi-tablier, redans en sous-face (plans KLE)
            const j = M.sec.jumeaux ? M.sec.joint / 2 : 0, rd = g.redan, yR = ySeat - g.ch.h + (rd ? rd.h : 0), yB = ySeat - g.ch.h;
            (j ? [[-g.ch.L / 2, -j], [j, g.ch.L / 2]] : [[-g.ch.L / 2, g.ch.L / 2]]).forEach(([a, b2]) => {
              const pts = rd ? [[a, ySeat], [a, yR], [a + rd.l, yR], [a + rd.l, yB], [b2 - rd.l, yB], [b2 - rd.l, yR], [b2, yR], [b2, ySeat]] : [[a, ySeat], [a, yB], [b2, yB], [b2, ySeat]];
              extrude(pts, s.x - g.ch.b / 2, s.x + g.ch.b / 2);
            });
          }
          else box(s.x - g.ch.b / 2, s.x + g.ch.b / 2, -g.ch.L / 2, g.ch.L / 2, ySeat, ySeat - g.ch.h);
          zTop = ySeat - g.ch.h; ph = null;
        }
        const f = g.fut;
        if (f.kind === 'voile') box(s.x - f.e / 2, s.x + f.e / 2, -f.L / 2, f.L / 2, zTop, yft);
        else if (f.kind === 'marteau') box(s.x - f.a / 2, s.x + f.a / 2, -f.b / 2, f.b / 2, zTop, yft);
        else if (f.kind === 'vy') {   // voile en V / Y : deux bras (boîtes inclinées approchées par tranches)
          const nS = 6, yN = zTop - f.hn;
          for (let k = 0; k < nS; k++) {
            const z0 = yft + (zTop - yft) * k / nS, z1 = yft + (zTop - yft) * (k + 1) / nS, zm = (z0 + z1) / 2, half = f.Lb / 2 + (f.Lt - f.Lb) / 2 * (zm - yft) / (zTop - yft);
            if (zm < yN) box(s.x - f.e / 2, s.x + f.e / 2, -half, half, z1, z0);
            else { const inner = Math.max(0, (f.Lt / 2 - f.bw) * (zm - yN) / (zTop - yN)); [-1, 1].forEach((sg) => box(s.x - f.e / 2, s.x + f.e / 2, sg * inner, sg * half, z1, z0)); }
          }
        }
        else (f.pos || Array.from({ length: f.n }, (_, i) => -(f.n - 1) * f.s / 2 + i * f.s)).forEach((y) => { if (f.sec && f.sec !== 'circ' && f.sec !== 'ellip') box(s.x - f.D / 2, s.x + f.D / 2, y - (f.b || f.D) / 2, y + (f.b || f.D) / 2, zTop, yft); else cyl(s.x, y, f.D, yft, zTop); });
      } else {
        const o = s.j === 0 ? -1 : 1;
        if (g.type === 'enterree' && g.tal > 0) {
          // culée des plans KLE : extrusion du profil (garde-grève à nez, sommier à talon, dalle de transition sur le talon,
          // murs en retour suspendus à sous-face inclinée), découpée au joint des tabliers jumelés
          const R = C.culeeProfil(s), X = (u) => s.x + o * u, z0 = -g.hgg, j = M.sec.jumeaux ? M.sec.joint / 2 : 0;
          yS = z0; yft = z0 - s.H;
          const halves = (L) => (j ? [[-L / 2, -j], [j, L / 2]] : [[-L / 2, L / 2]]);
          const extY = (pts, y0, y1) => {   // découpée en bandes de 1,5 m pour un tri du peintre juste
            const nb = Math.max(1, Math.ceil(Math.abs(y1 - y0) / 1.5));
            if (nb > 1) { for (let k = 0; k < nb; k++) extY1(pts, y0 + (y1 - y0) * k / nb, y0 + (y1 - y0) * (k + 1) / nb, k > 0, k < nb - 1); return; }
            extY1(pts, y0, y1, false, false);
          };
          const extY1 = (pts, y0, y1, n0, n1) => {
            const Q = pts.map((q) => [X(q[0]), z0 + q[1]]), A = area2(Q), sy = y1 > y0 ? 1 : -1;
            if (!n0) face(Q.map((q) => [q[0], y0, q[1]]), false, [0, sy, 0]); if (!n1) face(Q.slice().reverse().map((q) => [q[0], y1, q[1]]), false, [0, -sy, 0]);
            for (let i = 0; i < Q.length; i++) { const a = Q[i], c = Q[(i + 1) % Q.length], n = inN(a, c, A); face([[a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [a[0], y1, a[1]]], n0 || n1, [n[0], 0, n[1]]); }
          };
          const em = g.retours.e || 0.5, Ls = g.sommier.L || W;
          const dtSpans = j ? [[-W / 2 + em + 0.80, -j - 0.20], [j + 0.20, W / 2 - em - 0.80]] : [[-W / 2 + em + 0.80, W / 2 - em - 0.80]];
          R.cut.filter((c) => c.role !== 'prop').forEach((c) => {   // béton de propreté non représenté en 3D
            mat = c.role === 'dt' ? 'dt' : 'beton';
            const spans = c.role === 'som' ? halves(Ls) : c.role === 'gg' ? halves(W) : dtSpans;
            ph = c.role === 'gg' ? 'gg' : c.role === 'som' ? 'chev' : null;
            spans.forEach(([a, b2]) => extY(c.pts, a, b2));
          });
          mat = 'beton'; ph = 'gg';
          R.seen.filter((c) => c.role === 'mr').forEach((c) => { extY(c.pts, W / 2 - em, W / 2); extY(c.pts, -W / 2, -W / 2 + em); });
          ph = null;
          xf = X(R.uc);
          if (g.colonnes) (g.colonnes.pos || Array.from({ length: g.colonnes.n }, (_, i) => -(g.colonnes.n - 1) * g.colonnes.s / 2 + i * g.colonnes.s)).forEach((y) => { if (g.colonnes.section === 'circ') cyl(xf, y, g.colonnes.D, yft, z0 - g.sommier.h); else { const b = g.colonnes.section === 'rect' ? g.colonnes.b : g.colonnes.D; box(xf - g.colonnes.D / 2, xf + g.colonnes.D / 2, y - b / 2, y + b / 2, z0 - g.sommier.h, yft); } });
        } else {
        const front = s.x + o * (dab + 0.05), back = front + o * g.egg;
        if (g.egg > 0) { ph = 'gg'; box(front, back, -W / 2, W / 2, 0, ySeat); ph = null; }          // garde-grève
        let zr0;
        if (g.type === 'enterree') {
          const xin = back - o * g.sommier.b;
          ph = 'chev';
          if (M.sec.jumeaux) { const j = M.sec.joint / 2; box(back, xin, -g.sommier.L / 2, -j, ySeat, ySeat - g.sommier.h); box(back, xin, j, g.sommier.L / 2, ySeat, ySeat - g.sommier.h); }
          else box(back, xin, -g.sommier.L / 2, g.sommier.L / 2, ySeat, ySeat - g.sommier.h);
          ph = null;
          xf = (back + xin) / 2;
          if (g.colonnes) (g.colonnes.pos || Array.from({ length: g.colonnes.n }, (_, i) => -(g.colonnes.n - 1) * g.colonnes.s / 2 + i * g.colonnes.s)).forEach((y) => { if (g.colonnes.section === 'circ') cyl(xf, y, g.colonnes.D, yft, ySeat - g.sommier.h); else { const b = g.colonnes.section === 'rect' ? g.colonnes.b : g.colonnes.D; box(xf - g.colonnes.D / 2, xf + g.colonnes.D / 2, y - b / 2, y + b / 2, ySeat - g.sommier.h, yft); } });
          zr0 = ySeat - g.sommier.h + 0.3;
        } else {
          const R = C.culeeProfil(s), X = (u) => s.x + o * u, so = g.sommier, hs = so.h;
          ph = 'chev'; box(X(R.uf), X(R.uf + so.b), -W / 2, W / 2, ySeat, ySeat - hs); ph = null;
          box(X(R.uf), X(R.uf + g.mur.e), -W / 2, W / 2, ySeat - hs, yft);
          xf = X(R.uc);
          const rt = g.retours, er = rt.e;
          ph = 'gg';
          if (rt.mode === 'U') [-1, 1].forEach((sg) => box(X(R.uf), X(R.uE), sg * W / 2, sg * (W / 2 - er), 0, yft));
          else [-1, 1].forEach((sg) => box(back, back + o * rt.L, sg * W / 2, sg * (W / 2 - er), 0, ySeat - hs - 0.3));
          ph = null;
          zr0 = null;
        }
        if (zr0 !== null && g.retours.mode !== 'aucun') {
          const er = g.retours.e, Lr = g.retours.L, Lw = (g.sommier && g.sommier.L) || W; ph = 'gg';
          if (g.retours.mode === 'AV') [-1, 1].forEach((sg) => box(back, back - o * g.sommier.b, sg * Lw / 2, sg * (Lw / 2 - er), 0, ySeat));
          else [-1, 1].forEach((sg) => box(back, back + o * Lr, sg * Lw / 2, sg * (Lw / 2 - er), 0, Math.max(zr0, -g.retours.h - 0.5)));
        }
        ph = null;
        if (g.dt) { mat = 'dt'; box(back, back + o * g.dt.L, -g.dt.B / 2, g.dt.B / 2, -0.40, -0.70); mat = 'beton'; }
        }
      }
      // fondation
      const f = s.fo;
      mat = 'fond';
      if (f.mode === 'superficielle' && s.kind === 'culee' && M.sec.jumeaux && !f.split) { const j = M.sec.joint / 2; box(xf - f.B / 2, xf + f.B / 2, -f.L / 2, -j, yft, yft - f.e); box(xf - f.B / 2, xf + f.B / 2, j, f.L / 2, yft, yft - f.e); if (g.gros > 0) { mat = 'gros'; box(xf - f.B / 2 - 0.5, xf + f.B / 2 + 0.5, -f.L / 2 - 0.5, f.L / 2 + 0.5, yft - f.e, yft - f.e - g.gros); mat = 'fond'; } }
      else if (f.mode === 'superficielle') { (f.split ? f.split.centers : [0]).forEach((cy) => box(xf - f.B / 2, xf + f.B / 2, cy - f.L / 2, cy + f.L / 2, yft, yft - f.e));
        if (s.kind === 'culee' && g.gros > 0) { mat = 'gros'; box(xf - f.B / 2 - 0.5, xf + f.B / 2 + 0.5, -f.L / 2 - 0.5, f.L / 2 + 0.5, yft - f.e, yft - f.e - g.gros); mat = 'fond'; } }
      else {
        const zb = f.e === 0 ? (g.sommier ? yS - g.sommier.h : yft) : yft - f.e;
        const cys = f.split ? f.split.centers : [0];
        if (f.e > 0) cys.forEach((cy) => box(xf - f.Lx / 2, xf + f.Lx / 2, cy - f.Ly / 2, cy + f.Ly / 2, yft, zb));
        mat = 'pieu';
        const sy = f.m > 1 ? (f.e === 0 ? (W - f.D - 0.6) / (f.m - 1) : f.sy) : 0;
        for (const cy of cys) for (let r = 0; r < f.nr; r++) for (let c = 0; c < f.m; c++) cyl(xf + (r - (f.nr - 1) / 2) * f.s, cy + (f.ys ? f.ys[c] : -(f.m - 1) * sy / 2 + c * sy), f.D, zb - f.Lp, zb);
      }
    });

    const box3 = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    F.forEach((fc) => fc.p.forEach((q) => { for (let k = 0; k < 3; k++) { box3[k] = Math.min(box3[k], q[k]); box3[k + 3] = Math.max(box3[k + 3], q[k]); } }));
    return { faces: F, box: box3 };
  }

  const MAT = {
    beton: [204, 212, 224], hourdis: [232, 214, 176], dt: [168, 132, 214], pred: [196, 186, 160], gros: [150, 132, 108], prefa: [160, 163, 168], acier: [120, 150, 196], app: [40, 44, 54], fond: [214, 208, 196], pieu: [222, 216, 204],
  };

  function render3D(model, cam, opt) {
    const Wv = opt.width, Hv = opt.height, b = model.box;
    const cx = (b[0] + b[3]) / 2, cy = (b[1] + b[4]) / 2, cz = (b[2] + b[5]) / 2;
    const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const diag = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) || 1;
    const sc = Math.min(Wv, Hv * 1.6) / diag * 0.95 * cam.zoom;
    const P = (q) => {
      const X = q[0] - cx, Y = q[1] - cy, Z = q[2] - cz;
      const x1 = X * cyw - Y * syw, y1 = X * syw + Y * cyw;
      return [Wv / 2 + cam.panX + x1 * sc, Hv / 2 + cam.panY - (Z * cp + y1 * sp) * sc, y1 * cp - Z * sp];
    };
    // direction de vue (vers l'observateur) et lumière dans le repère monde
    const view = [syw * cp * -1, -cyw * cp, -sp].map((v) => -v);
    const L = [-0.35, -0.55, 0.76];
    const gV = [syw * cp, cyw * cp, -sp];   // direction qui s'éloigne de l'observateur
    const out = [];
    const hide = opt.hide || null;
    model.faces.forEach((fc) => {
      if (hide && hide[fc.ph]) return;   // phase de construction masquée
      if (fc.under && !(hide && hide.hourdis)) return;
      if (fc.inside && !(hide && hide[fc.inside])) return;   // prédalle noyée dans le hourdis visible   // invisible sous le hourdis
      const pr = fc.p.map(P);
      let d = 0; pr.forEach((q) => { d += q[2]; }); d /= pr.length;
      // normale de la face (Newell)
      let nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < fc.p.length; i++) {
        const a = fc.p[i], c = fc.p[(i + 1) % fc.p.length];
        nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]);
      }
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      if (fc.or && !opt.wire && nx * gV[0] + ny * gV[1] + nz * gV[2] <= 1e-9) return;   // face arrière : non dessinée
      const lam = Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
      void view;
      let ar = 0; for (let i = 0; i < pr.length; i++) { const a = pr[i], c = pr[(i + 1) % pr.length]; ar += a[0] * c[1] - c[0] * a[1]; }
      out.push({ pr, d, lam, fc, n: [nx, ny, nz], sg: Math.sign(ar) });
    });
    // arêtes de contour : bords libres, plis (> 25°) et silhouettes (cylindres) — les joints de découpe restent invisibles
    const key = (a, c) => { const ka = a.map((v) => Math.round(v * 1000)).join(','), kc = c.map((v) => Math.round(v * 1000)).join(','); return ka < kc ? ka + '|' + kc : kc + '|' + ka; };
    const E = new Map();
    out.forEach((o) => { const p = o.fc.p; for (let j = 0; j < p.length; j++) { const k = key(p[j], p[(j + 1) % p.length]); (E.get(k) || E.set(k, []).get(k)).push(o); } });
    const feat = (k, mt) => {   // évalué entre faces d'un même matériau (un bord de poutre sous le hourdis n'est pas une arête du hourdis)
      const L_ = E.get(k).filter((o) => o.fc.mat === mt); if (L_.length <= 1) return true;
      for (let a = 0; a < L_.length; a++) for (let c = a + 1; c < L_.length; c++) {
        const A = L_[a], B = L_[c], dt = Math.abs(A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2]);
        if (dt < 0.9) return true;
        if (dt < 0.999 && A.sg !== B.sg) return true;
      }
      return false;
    };
    // le gros béton (sous tout le reste) est dessiné en premier : ses faces de contact ne passent pas devant la semelle
    // poutres et entretoises sous le hourdis : légèrement reculées vu de dessus (avancées vu de dessous) pour ne pas percer la dalle
    const bias = (o) => (o.fc.mat === 'gros' && cam.pitch > 0 ? 1e4 : (o.fc.mat === 'prefa' || o.fc.mat === 'pred') ? (cam.pitch > 0 ? 0.8 : -0.8) : 0);
    out.sort((a, c) => (c.d + bias(c)) - (a.d + bias(a)));
    const sel = opt.sel;
    const paths = out.map((o) => {
      const d = 'M' + o.pr.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'Z';
      const t = o.fc.tag ? ` data-tag="${o.fc.tag}"` : '';
      const on = sel && o.fc.tag === sel;
      if (opt.wire) return `<path${t} d="${d}" fill="none" stroke="${on ? '#1f5fd1' : '#33415a'}" stroke-width="${on ? 1.4 : 0.6}"/>`;
      const c = MAT[o.fc.mat] || MAT.beton, k = 0.62 + 0.38 * o.lam;
      const rgb = c.map((v, i) => { const w = Math.min(255, v * k * (on ? 0.75 : 1) + (on ? [31, 95, 209][i] * 0.25 : 0)); return w + (255 - w) * 0.35; });   // remplissage allégé (35 % vers le blanc)   // sélection : léger voile bleu, couleurs conservées
      const fill = `rgb(${rgb.map(Math.round).join(',')})`;
      let ed = '';
      const p3 = o.fc.p;
      for (let j = 0; j < p3.length; j++) if (!(o.fc.hz != null && Math.abs(p3[j][2] - o.fc.hz) < 1e-3 && Math.abs(p3[(j + 1) % p3.length][2] - o.fc.hz) < 1e-3) && feat(key(p3[j], p3[(j + 1) % p3.length]), o.fc.mat)) { const a = o.pr[j], c = o.pr[(j + 1) % o.pr.length]; ed += `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${c[0].toFixed(1)} ${c[1].toFixed(1)}`; }
      return `<path${t} d="${d}" fill="${fill}" stroke="${fill}" stroke-width="0.9" stroke-linejoin="round"/>`
        + (ed ? `<path d="${ed}" fill="none" stroke="${on ? '#1f5fd1' : '#3a4250'}" stroke-width="${on ? 1.3 : 0.8}" stroke-linecap="round" style="pointer-events:none"/>` : '');
    }).join('');
    // trièdre
    const ax = (v) => { const X = v[0], Y = v[1], Z = v[2]; const x1 = X * cyw - Y * syw, y1 = X * syw + Y * cyw; return [x1 * 22, -(Z * cp + y1 * sp) * 22]; };
    const o0 = [34, Hv - 34];
    const tri = [['X', [1, 0, 0], '#c92a2a'], ['Y', [0, 1, 0], '#2b8a3e'], ['Z', [0, 0, 1], '#1f5fd1']].map(([l, v, col]) => {
      const e = ax(v);
      return `<path d="M${o0[0]} ${o0[1]}l${e[0].toFixed(1)} ${e[1].toFixed(1)}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/><text x="${(o0[0] + e[0] * 1.25).toFixed(1)}" y="${(o0[1] + e[1] * 1.25 + 3).toFixed(1)}" font-size="10" fill="${col}" text-anchor="middle">${l}</text>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wv} ${Hv}" role="img" aria-label="Vue 3D de l'ouvrage"><g>${paths}</g><g style="pointer-events:none;font-family:'Segoe UI',Arial,sans-serif">${tri}</g></svg>`;
  }

  /* phases de construction, dans l'ordre */
  const PHASES = [['pieux', 'Pieux'], ['gros', 'Gros béton'], ['semelles', 'Semelles'], ['futs', 'Fûts'], ['chev', 'Chevêtres et sommiers'], ['gg', 'Garde-grève & murs en retour'],
    ['app', 'Bossages et AA'], ['poutres', 'Poutres'], ['entretoises', 'Entretoises'], ['predalles', 'Prédalles'], ['hourdis', 'Hourdis (hors bande de continuité)'],
    ['hourdisB', 'Hourdis (bande de continuité)'], ['dt', 'Dalles de transition']];
  const PH_MATK = { pieux: 'pieu', gros: 'gros', semelles: 'fond', futs: 'beton', chev: 'beton', gg: 'beton', app: 'app', poutres: 'prefa', entretoises: 'prefa', predalles: 'pred', hourdis: 'hourdis', hourdisB: 'hourdis', dt: 'dt' };
  const PH_COLOR = {}; Object.keys(PH_MATK).forEach((k) => { PH_COLOR[k] = MAT[PH_MATK[k]].map((v) => Math.round(v + (255 - v) * 0.3)); });
  return { build3D, render3D, PHASES, PH_COLOR };
});
