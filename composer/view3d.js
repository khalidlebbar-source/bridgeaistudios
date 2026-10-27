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

  function build3D(M) {
    const F = [], h = M.h, sec = M.sec, n = M.xs.length - 1, xs = M.xs, dab = M.dab, Ltot = M.Ltot, W = M.W;
    const ySeat = -(h + 0.30);
    let tag = null, mat = 'beton';
    const face = (p) => F.push({ p, mat, tag });
    /* parallélépipède [x0, x1] × [y0, y1] × [z0, z1] */
    const box = (x0, x1, y0, y1, z0, z1) => {
      if (x0 > x1) [x0, x1] = [x1, x0];
      if (y0 > y1) [y0, y1] = [y1, y0];
      if (z0 > z1) [z0, z1] = [z1, z0];
      face([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]]);
      face([[x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1]]);
      face([[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]]);
      face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]);
      face([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]]);
      face([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]);
    };
    /* prisme vertical octogonal (colonne, pieu) */
    const cyl = (xc, yc, D, z0, z1) => {
      const k = 8, r = D / 2, ring = [];
      for (let i = 0; i < k; i++) { const a = (i + 0.5) * 2 * Math.PI / k; ring.push([xc + r * Math.cos(a), yc + r * Math.sin(a)]); }
      face(ring.map((q) => [q[0], q[1], z0]));
      face(ring.slice().reverse().map((q) => [q[0], q[1], z1]));
      for (let i = 0; i < k; i++) { const a = ring[i], b = ring[(i + 1) % k]; face([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]]); }
    };
    /* extrusion d'une section (points [y, z]) entre x0 et x1 */
    const extrude = (pts, x0, x1) => {
      face(pts.map((q) => [x0, q[0], q[1]]));
      face(pts.slice().reverse().map((q) => [x1, q[0], q[1]]));
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; face([[x0, a[0], a[1]], [x1, a[0], a[1]], [x1, b[0], b[1]], [x0, b[0], b[1]]]); }
    };

    // ── tablier ──
    tag = 'tablier';
    const pieces = [];
    if (M.cont) pieces.push([-dab, Ltot + dab]);
    else for (let i = 0; i < n; i++) pieces.push([i === 0 ? -dab : xs[i] + 0.04, i === n - 1 ? Ltot + dab : xs[i + 1] - 0.04]);
    sec.polys.forEach((pg) => {
      mat = pg.mat === 'acier' ? 'acier' : pg.role === 'poutre' ? 'prefa' : 'beton';
      const cut = pg.mat === 'acier' ? 0.2 : 0;
      pieces.forEach(([x0, x1]) => extrude(pg.pts, x0 + cut, x1 - cut));
    });

    // ── appareils d'appui et bossages ──
    tag = null;
    M.lines.forEach((l) => sec.bear.forEach((y) => {
      mat = 'app'; box(l.x - 0.2, l.x + 0.2, y - 0.2, y + 0.2, -h, -h - 0.12);
      mat = 'beton'; box(l.x - 0.3, l.x + 0.3, y - 0.3, y + 0.3, -h - 0.12, ySeat);
    }));

    // ── appuis ──
    M.supports.forEach((s) => {
      const g = s.geo, yft = ySeat - s.H;
      tag = s.id; mat = 'beton';
      let xf = s.x;
      if (s.kind === 'pile') {
        let zTop = ySeat;
        if (g.ch) {
          if (g.ch.kind === 'marteau') {
            const L = g.ch.L, bf = g.ch.bf, b = g.ch.b;
            const pts = [[-L / 2, ySeat], [-L / 2, ySeat - g.ch.h2], [-bf / 2, ySeat - g.ch.h], [bf / 2, ySeat - g.ch.h], [L / 2, ySeat - g.ch.h2], [L / 2, ySeat]];
            const ex = (x0, x1) => {
              face(pts.map((q) => [x0, q[0], q[1]]));
              face(pts.slice().reverse().map((q) => [x1, q[0], q[1]]));
              for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; face([[x0, a[0], a[1]], [x1, a[0], a[1]], [x1, c[0], c[1]], [x0, c[0], c[1]]]); }
            };
            ex(s.x - b / 2, s.x + b / 2);
          } else box(s.x - g.ch.b / 2, s.x + g.ch.b / 2, -g.ch.L / 2, g.ch.L / 2, ySeat, ySeat - g.ch.h);
          zTop = ySeat - g.ch.h;
        }
        const f = g.fut;
        if (f.kind === 'voile') box(s.x - f.e / 2, s.x + f.e / 2, -f.L / 2, f.L / 2, zTop, yft);
        else if (f.kind === 'marteau') box(s.x - f.a / 2, s.x + f.a / 2, -f.b / 2, f.b / 2, zTop, yft);
        else for (let i = 0; i < f.n; i++) cyl(s.x, -(f.n - 1) * f.s / 2 + i * f.s, f.D, yft, zTop);
      } else {
        const o = s.j === 0 ? -1 : 1;
        const front = s.x + o * (dab + 0.05), back = front + o * g.egg;
        box(front, back, -W / 2, W / 2, 0, ySeat);                          // garde-grève
        let zr0;
        if (g.type === 'enterree') {
          const xin = back - o * g.sommier.b;
          box(back, xin, -W / 2, W / 2, ySeat, ySeat - g.sommier.h);
          xf = (back + xin) / 2;
          if (g.colonnes) for (let i = 0; i < g.colonnes.n; i++) cyl(xf, -(g.colonnes.n - 1) * g.colonnes.s / 2 + i * g.colonnes.s, g.colonnes.D, yft, ySeat - g.sommier.h);
          zr0 = ySeat - g.sommier.h + 0.3;
        } else {
          const xin = back - o * g.mur.e;
          box(back, xin, -W / 2, W / 2, ySeat, yft);
          xf = (back + xin) / 2;
          zr0 = yft + 0.6;
        }
        const er = g.retours.e, Lr = g.retours.L;
        [-1, 1].forEach((sg) => box(back, back + o * Lr, sg * W / 2, sg * (W / 2 - er), 0, Math.max(zr0, -g.retours.h - 0.5)));
        if (g.dt) box(back, back + o * g.dt.L, -g.dt.B / 2, g.dt.B / 2, -0.40, -0.70);
      }
      // fondation
      const f = s.fo;
      mat = 'fond';
      if (f.mode === 'superficielle') box(xf - f.B / 2, xf + f.B / 2, -f.L / 2, f.L / 2, yft, yft - f.e);
      else {
        const zb = f.e === 0 ? (g.sommier ? ySeat - g.sommier.h : yft) : yft - f.e;
        if (f.e > 0) box(xf - f.Lx / 2, xf + f.Lx / 2, -f.Ly / 2, f.Ly / 2, yft, zb);
        mat = 'pieu';
        const sy = f.m > 1 ? (f.e === 0 ? (W - f.D - 0.6) / (f.m - 1) : f.sy) : 0;
        for (let r = 0; r < f.nr; r++) for (let c = 0; c < f.m; c++) cyl(xf + (r - (f.nr - 1) / 2) * f.s, -(f.m - 1) * sy / 2 + c * sy, f.D, zb - f.Lp, zb);
      }
    });

    const box3 = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    F.forEach((fc) => fc.p.forEach((q) => { for (let k = 0; k < 3; k++) { box3[k] = Math.min(box3[k], q[k]); box3[k + 3] = Math.max(box3[k + 3], q[k]); } }));
    return { faces: F, box: box3 };
  }

  const MAT = {
    beton: [204, 212, 224], prefa: [190, 204, 224], acier: [120, 150, 196], app: [40, 44, 54], fond: [214, 208, 196], pieu: [222, 216, 204],
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
    const out = [];
    model.faces.forEach((fc) => {
      const pr = fc.p.map(P);
      let d = 0; pr.forEach((q) => { d += q[2]; }); d /= pr.length;
      // normale de la face (Newell)
      let nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < fc.p.length; i++) {
        const a = fc.p[i], c = fc.p[(i + 1) % fc.p.length];
        nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]);
      }
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const lam = Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
      void view;
      out.push({ pr, d, lam, fc });
    });
    out.sort((a, c) => c.d - a.d);
    const sel = opt.sel;
    const paths = out.map((o) => {
      const d = 'M' + o.pr.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L') + 'Z';
      const t = o.fc.tag ? ` data-tag="${o.fc.tag}"` : '';
      const on = sel && o.fc.tag === sel;
      if (opt.wire) return `<path${t} d="${d}" fill="none" stroke="${on ? '#e8590c' : '#33415a'}" stroke-width="${on ? 1.4 : 0.6}"/>`;
      const c = MAT[o.fc.mat] || MAT.beton, k = 0.62 + 0.38 * o.lam;
      const rgb = on ? [Math.min(255, 250 * k), Math.min(255, 170 * k), Math.min(255, 120 * k)] : c.map((v) => Math.min(255, v * k));
      return `<path${t} d="${d}" fill="rgb(${rgb.map(Math.round).join(',')})" stroke="${on ? '#c2410c' : '#3a4558'}" stroke-width="${on ? 0.9 : 0.45}" stroke-linejoin="round"/>`;
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

  return { build3D, render3D };
});
