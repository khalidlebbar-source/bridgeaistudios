/* PSIDP-EL — planches de coffrage et de câblage du tablier (BridgeAI / KLE Ingénierie)
   Coffrage : planche commune des tabliers-dalles (ot-coffrage, section SETRA HDAL/EDAL, appareils du calcul).
   Câblage : élévation du câble moyen (cotes de l'axe au-dessus de la sous-dalle = VP + z, comme la note), coupes
   en travée et sur appui avec les gaines, tableau des cotes au 1/10 de chaque travée et caractéristiques des câbles. */
(function (G) {
  const n0 = v => (isFinite(+v) ? +v : 0), GR = Math.PI / 200;
  const f2 = (v, d) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d);

  function geometry(m, r) {
    const v = m.values || {};
    const n = Math.max(1, Math.min(6, Math.round(n0(v.NT)) || 1)), D = []; for (let i = 1; i <= n; i++) D.push(Math.max(0.5, n0(v['D' + i])));
    const ab = Math.max(0, n0(v.ABOUT)), xs = [ab]; for (const d of D) xs.push(xs[xs.length - 1] + d);
    const Lt = xs[n] + ab, bg = Math.max(20, Math.min(100, n0(v.BIAIS) || 100)), phi = bg * GR, ct = Math.cos(phi) / Math.sin(phi);
    const tro = [n0(v.ETROG), n0(v.EGAU), n0(v.ESURCH), n0(v.EDROI), n0(v.ETROD)].map(x => Math.max(0, x));
    const sec = G.DALLE_COF.secSetra(n0(v.HDAL1), n0(v.HDAL2), n0(v.HDAL3), n0(v.EDAL1), n0(v.EDAL2), n0(v.EDAL3));
    const lignes = [];
    for (let k = 0; k <= n; k++) {
      const ap = r && r.appareils && r.appareils[k], na = ap ? ap.na : Math.max(0, Math.round(n0(v['NAP' + (k + 1)])));
      const esp = ap && ap.esp > 0 ? ap.esp : (na > 1 ? Math.floor(100 * sec.N / (na - 0.6) / Math.sin(phi) + 1e-9) / 100 : 0);
      const t = []; for (let j = 0; j < na; j++) t.push((j - (na - 1) / 2) * esp);
      lignes.push({ k, na, t, esp, reg: true, lo: ap && ap.larg > 0 ? ap.larg : 0.40, tr: ap && ap.long > 0 ? ap.long : 0.50, sized: !!ap });
    }
    const nom = k => k === 0 ? 'C0' : k === n ? 'C' + n : 'P' + k;
    return { n, D, ab, xs, Lt, bg, phi, ct, tro, Wp: tro.reduce((a, b) => a + b, 0), hc: Math.max(0, n0(v.HCHAU)), sec, lignes, nom };
  }
  const titres = m => (m.titres || []).map(x => String(x || '').trim()).filter(Boolean);

  function coffrage(m, r) {
    const g = geometry(m, r);
    return G.DALLE_COF.layout(g, { sous: 'pont-dalle précontrainte — PSIDP-EL', ouvrage: titres(m), numero: m.numero,
      notes: ['NOTES :', '— cotes en mètres ; travées mesurées suivant l\'axe de l\'ouvrage.',
        '— appareils d\'appui : espacement et dimensions ' + (g.lignes.some(l => l.sized) ? 'du calcul' : 'indicatifs') + '.',
        '— section : dalle SETRA (HDAL / EDAL du bordereau).', '— câblage : voir plan CAB-01.'] });
  }

  /* ---------------- câblage ---------------- */
  function cablage(m, r) {
    const v = m.values || {}, g = geometry(m, r), P = r && r.prec, S = G.OTPLAN.Sheet(), s = g.sec;
    if (!P || !P.cable) return null;
    const cab = P.cable, VP = (r.section.calc || r.section).VP, H = s.H1, N = Math.round(P.N || n0(v.NCA)) || 0;
    const X0 = r.X0, L = r.L, n = g.n, dg = n0(v.DGAIN) || 0.07;
    const axe = (t, x) => VP + cab.z(t, x);
    S.frame();
    // ---------- élévation du câble moyen ----------
    const scP = G.OTPLAN.pickScale(g.Lt + 4, 360, [50, 75, 100, 125, 200, 250, 500, 1000]), kP = 1000 / scP;
    const kV = Math.min(45 / H, 400 / 1), ex = kV / kP;                       // hauteurs dilatées
    const ox = 215 - g.Lt / 2 * kP, oy = 262 - H * kV, E = (x, z) => [ox + x * kP, oy + z * kV];   // x depuis l'extrémité gauche du tablier
    S.poly([E(0, 0), E(g.Lt, 0), E(g.Lt, H), E(0, H)], 'CONTOUR', true);
    { const a = E(-1, VP), b = E(g.Lt + 1, VP); S.line(a[0], a[1], b[0], b[1], 'AXE'); S.text(b[0] + 1, b[1] - 0.8, 'fibre moyenne', 2, { a: 'l', ly: 'AXE' }); }
    // tracé : abouts rectilignes jusqu'aux ancrages (prolongement de la tangente), puis travées
    const pts = [];
    const sl0 = cab.slope(0, 0), sln = cab.slope(n - 1, L[n - 1]);
    pts.push(E(0, axe(0, 0) - sl0 * g.ab));
    for (let t = 0; t < n; t++) for (let k = 0; k <= 60; k++) { const x = L[t] * k / 60; if (t && !k) continue; pts.push(E(g.ab + X0[t] + x, axe(t, x))); }
    pts.push(E(g.Lt, axe(n - 1, L[n - 1]) + sln * g.ab));
    S.poly(pts, 'CABLES');
    // ancrages
    for (const [x, z] of [[0, axe(0, 0) - sl0 * g.ab], [g.Lt, axe(n - 1, L[n - 1]) + sln * g.ab]]) { const q = E(x, z); S.poly([[q[0] - 1, q[1] - 2], [q[0] + 1, q[1] - 2], [q[0] + 1, q[1] + 2], [q[0] - 1, q[1] + 2]], 'CABLES', true); }
    const act = n0(v.MOD) === 0 ? 'ancrages actifs aux deux extrémités' : 'ancrage actif à une extrémité';
    // appuis, points bas / hauts
    for (let k = 0; k <= n; k++) { const x = g.xs[k], a = E(x, 0); S.line(a[0], a[1] - 8, a[0], E(x, H)[1] + 5, 'AXE'); S.poly([[a[0] - 2, a[1] - 0.5], [a[0] + 2, a[1] - 0.5], [a[0], a[1] - 3]], 'APPAREILS', true); S.text(a[0], E(x, H)[1] + 6, g.nom(k), 3); }
    for (let t = 0; t < n; t++) {
      let xm = 0, zm = 1e9; for (let k = 0; k <= 100; k++) { const x = L[t] * k / 100, z = axe(t, x); if (z < zm) { zm = z; xm = x; } }
      const q = E(g.ab + X0[t] + xm, zm); S.circle(q[0], q[1], 0.7, 'CABLES', true); S.text(q[0], q[1] - 3.6, f2(zm, 3), 2, { ly: 'CABLES' });
      if (t < n - 1) { const zh = axe(t, L[t]), q2 = E(g.ab + X0[t + 1], zh); S.circle(q2[0], q2[1], 0.7, 'CABLES', true); S.text(q2[0] + 1.2, q2[1] + 1.6, f2(zh, 3), 2, { a: 'l', ly: 'CABLES' }); }
    }
    { const yb = E(0, 0)[1] - 11, xsP = [0].concat(g.xs, [g.Lt]).map(x => E(x, 0)[0]); S.chainH(xsP, yb, [0].concat(g.xs, [g.Lt]).slice(1).map((x, i, a) => f2(x - (i ? a[i - 1] : 0), 2))); }
    { const a = E(0, 0), b = E(0, H); S.dim([a[0] - 5, a[1]], [a[0] - 5, b[1]], 0, f2(H, 2), { noExt: true, h: 2 }); }
    S.title(15, 281, 'ÉLÉVATION DU CÂBLE MOYEN', 'longueurs 1/' + scP + ' — hauteurs dilatées ×' + f2(ex, 1) + ' — cotes de l\'axe du câble au-dessus de la sous-dalle (m) — ' + act);
    // ---------- tableau des cotes (axe du câble / sous-dalle, au 1/10 de chaque travée) ----------
    const tb0 = E(0, 0)[1] - 20;
    S.title(15, tb0, 'COTES DE L\'AXE DU CÂBLE PAR RAPPORT À LA SOUS-DALLE', 'abscisses comptées depuis l\'appui de gauche de la travée');
    const rows = [['travée'].concat(Array.from({ length: 11 }, (_, j) => j === 0 ? '0' : j === 10 ? 'L' : f2(j / 10, 1) + 'L'))];
    for (let t = 0; t < n; t++) rows.push(['T' + (t + 1) + ' (' + f2(L[t], 2) + ')'].concat(Array.from({ length: 11 }, (_, j) => f2(axe(t, L[t] * j / 10), 3))));
    const yAfter = S.table(15, tb0 - 8, [24].concat(Array(11).fill(15.5)), rows, 4.6);
    // ---------- coupes transversales avec gaines ----------
    const scT = G.OTPLAN.pickScale(s.W + 0.5, 112, [20, 25, 50, 75, 100, 125, 200]), kT = 1000 / scT;
    const yC = yAfter - 26 - H * kT, xsC = [15 + (s.W / 2 + 0.25) * kT, 145 + (s.W / 2 + 0.25) * kT];
    const ws = Math.min(s.N / Math.max(N, 1), 0.6), xsG = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * ws);
    const half = s.half, full = half.map(p => [-p[0], p[1]]).reverse().concat(half);
    [['EN TRAVÉE (POINT BAS)', 0], ['SUR APPUI INTERMÉDIAIRE (POINT HAUT)', 1]].forEach(([lab, hi], i) => {
      if (hi && n < 2) return;
      const cx = xsC[i], T = (x, y) => [cx + x * kT, yC + y * kT];
      const OT = full.map(p => T(p[0], p[1])); S.fill(OT, 'BETON'); S.poly(OT, 'CONTOUR', true);
      // cote de l'axe : point bas de la travée 1 / point haut sur le premier appui intermédiaire
      let z; if (hi) z = axe(0, L[0]); else { z = 1e9; for (let k = 0; k <= 100; k++) z = Math.min(z, axe(0, L[0] * k / 100)); }
      for (const x of xsG) { const q = T(x, z); S.circle(q[0], q[1], Math.max(dg / 2 * kT, 0.5), 'CABLES'); S.circle(q[0], q[1], Math.max(dg / 4 * kT, 0.3), 'CABLES', true); }
      { const a = T(-s.W / 2 - 0.2, z), b = T(s.W / 2 + 0.2, z); S.line(a[0], a[1], b[0], b[1], 'AXE'); }
      S.dim([T(s.W / 2, 0)[0] + 4, T(0, 0)[1]], [T(s.W / 2, 0)[0] + 4, T(0, z)[1]], 0, f2(z, 3), { noExt: true, h: 2, right: true });
      if (N > 1) S.dim([T(xsG[0], 0)[0], T(0, 0)[1] - 5], [T(xsG[1], 0)[0], T(0, 0)[1] - 5], 0, f2(ws, 2), { noExt: true, h: 1.9 });
      S.text(cx, yC + H * kT + 5, 'COUPE ' + lab, 2.8, { bold: 1 });
    });
    S.text(15, yC + H * kT + 13, 'COUPES TRANSVERSALES — échelle 1/' + scT, 3, { a: 'l', bold: 1 });
    // ---------- caractéristiques ----------
    let Lc = 0; for (let i = 1; i < pts.length; i++) { const dx = (pts[i][0] - pts[i - 1][0]) / kP, dz = (pts[i][1] - pts[i - 1][1]) / kV; Lc += Math.hypot(dx, dz); }
    const P0 = n0(v.SECT) * 1e-6 * n0(v.SIGMAP0);
    S.notes(['CÂBLES :', '— procédé ' + (v.PROCEDE || '') + ', unité ' + (v.UNITE || '') + ', section ' + f2(n0(v.SECT), 0) + ' mm²',
      '— ' + N + ' câbles en 1 lit, gaines Ø ' + f2(dg * 1000, 0) + ' mm, espacement ≈ ' + f2(ws, 2) + ' m',
      '— σp0 = ' + f2(n0(v.SIGMAP0) / 101.97, 0) + ' MPa, P0 = ' + f2(P0, 1) + ' t par câble (' + f2(P0 * N, 0) + ' t au total)',
      '— longueur d\'un câble ≈ ' + f2(Lc, 2) + ' m (' + f2(Lc * N, 0) + ' m au total), ' + act,
      '— enrobages : ' + f2(n0(v.COUVI), 3) + ' m (intrados), ' + f2(n0(v.COUVS), 3) + ' m (extrados), Rmin ' + f2(n0(v.RMIN), 2) + ' m'], 282, 120);
    S.cartouche({ titre: 'PLAN DE CÂBLAGE DU TABLIER', sous: 'pont-dalle précontrainte — PSIDP-EL', ouvrage: titres(m), numero: m.numero, echelles: 'élévation 1/' + scP + ' (hauteurs ×' + f2(ex, 1) + '), coupes 1/' + scT, planNo: 'CAB-01' });
    return { S, scP, scT, ex, N };
  }
  G.PSIDP_PLANS = { geometry, coffrage, cablage };
})(typeof window !== 'undefined' ? window : globalThis);
