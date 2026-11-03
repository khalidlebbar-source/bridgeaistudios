/* MURU — mur en U : deux voiles en béton armé encastrés sur un radier fondé superficiellement (moteur pur, sans DOM).
 * Module node (module.exports) et navigateur (window.BA.murU). S'appuie sur BA.soutenement (poussée par la méthode des coins,
 * contrainte de référence, ferraillage des sections) et BA.portique (radier = poutre sur appuis élastiques).
 *
 * UNITÉS : m, kN, kPa ; matériaux en MPa ; aciers en cm²/ml.
 * MODÈLE : le radier est découpé en bandes transversales de largeur b (le long du mur) ; chaque bande est un portique
 *   plan : poutre de radier sur ressorts verticaux de Winkler k = kv·b·Δy (sol sans traction : ressorts tendus
 *   supprimés par itérations), voiles encastrés dans le radier (barres verticales d'inertie variable).
 *   Repère de la coupe : y horizontal, origine au parement intérieur du voile V0, positif vers V1 ; z cote.
 *   Le talus de chaque voile est donné dans son propre repère (distance horizontale comptée depuis le parement
 *   intérieur du voile, vers l'extérieur) — même convention que MUR3D.
 * Références : Fascicule 62 titre V (contrainte de référence q'ref = (3σmax + σmin)/4, iδ annexe F1), Livret 2.01 /
 *   EN 1990 A2 (combinaisons), BAEL 91 mod. 99 ou EN 1992-1-1 + AN (sections, par BA.sectionBA). */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const M3 = node ? require('./murs-soutenement.js') : root.BA.soutenement;
  const PQ = node ? require('./portique.js') : root.BA.portique;
  const D2R = Math.PI / 180, GW = 10;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* géométrie d'un voile à l'abscisse t ∈ [0,1] (section haute → basse) */
  function voile(v, t) {
    return { e0: lerp(v.ep.h, v.ep.b, t), zc: lerp(v.zc.h, v.zc.b, t), fav: (v.fav || 0) / 100, far: (v.far || 0) / 100, ec: v.ec || 0, hc: v.hc || 0,
      talon: v.talon || 0, talus: v.talus.h.map((p, i) => [lerp(p[0], v.talus.b[Math.min(i, v.talus.b.length - 1)][0], t), lerp(p[1], v.talus.b[Math.min(i, v.talus.b.length - 1)][1], t)]) };
  }

  /* poussée sur le parement extérieur d'un voile (écran = parement arrière) et terre sur talon extérieur.
   * Repère local du voile : u horizontal, origine au parement intérieur au niveau du dessus du radier, vers l'extérieur. */
  function pousseeVoile(d, V, zr, eprad, bandes) {
    const H = V.zc - V.hc - zr;
    const ub = (z) => V.e0 - V.far * (z - zr);           // parement extérieur (fruit arrière)
    const sol = { phi: d.sol.phi, g: d.sol.g, gsat: d.sol.gsat, zw: d.eau, P: null };
    let lo = zr, hi = V.zc; const fz = (z) => M3.solZ(V.talus, ub(Math.min(z, zr + H))) - z;
    let zi = fz(hi) >= 0 ? hi : (() => { for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (fz(m) > 0) lo = m; else hi = m; } return (lo + hi) / 2; })();
    if (fz(zr) <= 0) zi = zr;
    const ut = ub(Math.min(zi, zr + H));
    sol.P = [[ut, zi]].concat(V.talus.filter((p) => p[0] > ut + 1e-9));
    const T = [ut, zi], B = [ub(zr), zr], dv = +d.options.deltaVoile || 0;
    const out = { sol, T, B, zi, H };
    if (zi - zr < 1e-3) { out.cu = null; return out; }
    out.cu = M3.culmann({ T, B, sol, delta: dv, n: 14 });
    const sur = (q) => { const c = M3.culmann({ T, B, sol, delta: dv, q, n: 14 }); return { s: c.s, P: c.P.map((v, k) => Math.max(0, v - out.cu.P[k])), L: c.L, f: c.f, T, B }; };
    if (bandes.Q) out.cuQ = sur(bandes.Q);
    if (bandes.C) out.cuC = sur(bandes.C);
    // terre sur le talon extérieur (entre parement extérieur, radier et verticale de l'extrémité du talon)
    if (V.talon > 0) {
      const u1 = ub(zr) + V.talon, z1 = M3.solZ(sol.P, u1);
      const Q = [[ub(zr), zr], [u1, zr], [u1, Math.max(zr, z1)]];
      for (let i = sol.P.length - 1; i >= 0; i--) if (sol.P[i][0] < u1 - 1e-9) Q.push(sol.P[i]);
      out.talonW = M3.poidsSol(Q, sol);
      out.talonQ = (bq) => { let W = 0; for (const b of bq || []) { const a = Math.max(b.y1, ut), c = Math.min(b.y2, u1); if (c > a) W += b.q * (c - a); } return W; };
      out.u1 = u1;
    }
    return out;
  }
  /* pression p(s) = dP/ds aux extrémités d'un tronçon de l'écran [sa, sb] (projection horizontale et verticale) */
  function pressions(cu, sa, sb) {
    const P = (s) => { const { s: S, P: Pv } = cu; if (s <= 0) return 0; for (let k = 1; k < S.length; k++) if (s <= S[k] + 1e-12) return Pv[k - 1] + (Pv[k] - Pv[k - 1]) * (s - S[k - 1]) / (S[k] - S[k - 1]); return Pv[Pv.length - 1]; };
    return (P(sb) - P(sa));   // force sur le tronçon (kN/ml)
  }

  function combinaisons(d) {
    const ec = d.regl === 'EC', out = [];
    const gQ = 1.45, gV = ec ? 1.35 : 1.605, psi1 = d.q.type === 'route' ? 0.75 : d.q.voies === 2 ? 0.6 : 0.8;
    const add = (nom, type, c) => out.push(Object.assign({ no: out.length + 1, nom, type }, c));
    add('ELS fréquent', 'ELSf', { G: 1, T: 1, Q: psi1, W: 1 });
    add('ELS rare', 'ELSr', { G: 1, T: 1, W: 1 });
    add('ELS rare + Q', 'ELSr', { G: 1, T: 1, Q: 1, W: 1 });
    add('ELS rare + chantier', 'ELSr', { G: 1, T: 1, C: ec ? 1 : 1.2, W: 1 });
    for (const [gG, gT] of [[1, 1], [1.35, 1.35], [1, 1.35]]) {
      add(`ELU G×${gG} T×${gT}`, 'ELU', { G: gG, T: gT, W: 1 });
      add(`ELU G×${gG} T×${gT} + Q`, 'ELU', { G: gG, T: gT, Q: gQ, W: 1 });
      add(`ELU G×${gG} T×${gT} + chantier`, 'ELU', { G: gG, T: gT, C: gV, W: 1 });
    }
    if (d.seisme && d.seisme.kh > 0) { add('ELU sismique (kv ↓)', 'ELUs', { G: 1, T: 1, W: 1, E: 1 }); add('ELU sismique (kv ↑)', 'ELUs', { G: 1, T: 1, W: 1, E: -1 }); }
    return out;
  }

  /* portique d'une bande pour une combinaison ; renvoie les efforts du radier et des voiles */
  function bande(d, t, b, c, cache) {
    const zr = d.radier.z, er = d.radier.e, zm = zr - er / 2, kv = d.fond.kv;
    const V0 = voile(d.v0, t), V1 = voile(d.v1, t), ouv = d.ouv;
    const Q = d.q.exp > 0 && d.q.larg > 0 ? [{ y1: d.q.y, y2: d.q.y + d.q.larg, q: d.q.exp }] : null;
    const C = d.q.chantier > 0 ? [{ y1: -1e4, y2: 1e4, q: d.q.chantier }] : null;
    const key = 'p' + t.toFixed(5);
    if (!cache[key]) cache[key] = [pousseeVoile(d, V0, zr, er, { Q: d.q.cote !== 1 ? Q : null, C }), pousseeVoile(d, V1, zr, er, { Q: d.q.cote !== 0 ? Q : null, C })];
    const [p0, p1] = cache[key];
    // abscisses du radier : de l'extrémité du talon de V0 à celle de V1 (y = 0 au parement intérieur de V0)
    const yA = -(V0.e0 + V0.talon), yB = ouv + V1.e0 + V1.talon;
    const ax0 = -V0.e0 / 2, ax1 = ouv + V1.e0 / 2;
    const nr = d.options.nRadier || 24;
    const ys = new Set([yA, yB, ax0, ax1, 0, ouv]);
    for (let i = 0; i <= nr; i++) ys.add(yA + (yB - yA) * i / nr);
    const Y = [...ys].sort((a, b2) => a - b2).filter((y, i, a) => i === 0 || y - a[i - 1] > 1e-6);
    const E = 11000 * Math.pow(d.beton.fck, 1 / 3) * 1000;   // module instantané (kPa) — BAEL A.2.1.21 / ordre de grandeur Ecm
    const nodes = Y.map((y) => ({ x: y, y: zm }));
    const elems = [];
    for (let i = 0; i < Y.length - 1; i++) elems.push({ i, j: i + 1, E, A: b * er, I: b * er * er * er / 12, name: 'R' });
    // voiles : barres verticales sur l'axe de la base, de zm à la tête
    const voileBars = (V, yax, sgn, tag) => {
      const n = 8, H = V.zc - zm, i0 = Y.findIndex((y) => Math.abs(y - yax) < 1e-6), ids = [i0];
      for (let k = 1; k <= n; k++) { nodes.push({ x: yax, y: zm + H * k / n }); ids.push(nodes.length - 1); }
      for (let k = 0; k < n; k++) {
        const za = zm + H * k / n, zb = zm + H * (k + 1) / n, zmid = Math.max(zr, (za + zb) / 2);
        const ep = Math.max(0.05, V.e0 - (V.far + V.fav) * (zmid - zr));
        elems.push({ i: ids[k], j: ids[k + 1], E, A: b * ep, I: b * ep * ep * ep / 12, name: tag, za, zb });
      }
      return ids;
    };
    const ids0 = voileBars(V0, ax0, -1, 'V0'), ids1 = voileBars(V1, ax1, 1, 'V1');
    // ressorts de sol (aires tributaires)
    const trib = Y.map((y, i) => ((i > 0 ? y - Y[i - 1] : 0) + (i < Y.length - 1 ? Y[i + 1] - y : 0)) / 2);
    let actif = Y.map(() => true);
    const loads = { nodal: [], elem: [] };
    const gb = d.beton.g;
    const kG = c.G || 0, kT = c.T || 0;
    // poids du radier
    for (let i = 0; i < Y.length - 1; i++) loads.elem.push({ e: i, type: 'u', dir: 'gy', q: -gb * er * b * kG });
    // poids des voiles (nodal, avec excentricité du centre de gravité par rapport à l'axe : moment)
    // poids des voiles : par tronçon (au-dessus du dessus du radier), aux nœuds, avec le moment dû à l'excentricité
    // du centre de gravité du tronçon par rapport à l'axe de la barre (fruits avant/arrière différents)
    const poidsVoile = (V, yax, sgn, ids) => {
      let Wt = 0;
      for (let k = 0; k < ids.length - 1; k++) {
        const za = Math.max(zr, nodes[ids[k]].y), zb = nodes[ids[k + 1]].y; if (zb <= za) continue;
        const zt = V.zc - V.hc, z1 = Math.min(zb, zt), z2 = zb;
        let W = 0, mom = 0;
        if (z1 > za) {
          const e = (z) => V.e0 - (V.far + V.fav) * (z - zr), zm2 = (za + z1) / 2;
          const w = gb * (e(za) + e(z1)) / 2 * (z1 - za) * b; const uoff = (V.fav - V.far) * (zm2 - zr) / 2;
          W += w; mom += w * sgn * uoff;
        }
        if (z2 > Math.max(za, zt) && V.hc > 0) {   // couronnement (côté intérieur)
          const h = z2 - Math.max(za, zt), w = gb * V.ec * h * b, eT = V.e0 - (V.far + V.fav) * (zt - zr);
          const uoff = V.fav * (zt - zr) + V.ec / 2 - (V.e0 / 2);
          W += w * 1; mom += w * sgn * uoff; void eT;
        }
        W *= kG; mom *= kG; Wt += W;
        loads.nodal.push({ n: ids[k], Fy: -W / 2, M: -mom / 2 }, { n: ids[k + 1], Fy: -W / 2, M: -mom / 2 });
      }
      void yax; return Wt;
    };
    const W0 = poidsVoile(V0, ax0, -1, ids0), W1 = poidsVoile(V1, ax1, 1, ids1);
    // poussées sur les voiles : force par tronçon de barre, horizontale (vers l'intérieur) et verticale (vers le bas)
    const pousse = (p, ids, sgn, coef, cu) => {
      if (!cu || !coef) return;
      const L = cu.L, zT = p.T[1], zB = p.B[1], hs = (z) => clamp((zT - z) / (zT - zB), 0, 1) * L;
      const n = ids.length - 1;
      for (let k = 0; k < n; k++) {
        const za = nodes[ids[k]].y, zb = nodes[ids[k + 1]].y;
        if (zb <= zr) continue;
        const F = pressions(cu, hs(zb), hs(Math.max(za, zr)));
        if (Math.abs(F) < 1e-12) continue;
        const Fy = F * cu.f[0] * b * coef, Fz = F * cu.f[1] * b * coef;   // f[0] < 0 : vers l'intérieur (repère local)
        const yk = -sgn * Fy;                                               // V0 : intérieur = +y ; V1 : intérieur = −y
        loads.nodal.push({ n: ids[k], Fx: yk / 2, Fy: Fz / 2 }, { n: ids[k + 1], Fx: yk / 2, Fy: Fz / 2 });
      }
    };
    const sides = [[p0, ids0, -1], [p1, ids1, 1]];
    for (const [p, ids, sgn] of sides) {
      pousse(p, ids, sgn, kT, p.cu); pousse(p, ids, sgn, c.Q || 0, p.cuQ); pousse(p, ids, sgn, c.C || 0, p.cuC);
      // séisme : incrément dynamique (M-O) à mi-hauteur et inertie du voile
      if (c.E && d.seisme.kh > 0 && p.cu) {
        const kvE = c.E * d.seisme.kv, beta = 0, KAE = M3.mononobeOkabe(d.sol.phi, beta, 0, 0, d.seisme.kh, kvE).K, KA = M3.coulomb(d.sol.phi, beta, 0, 0).K;
        const Hh = p.zi - zr, dP = 0.5 * d.sol.g * Hh * Hh * ((1 + kvE) * KAE - KA) * b;
        const mid = ids[Math.max(1, Math.round((ids.length - 1) * (Hh / 2 + zr - zm) / (nodes[ids[ids.length - 1]].y - zm)))];
        if (dP > 0) loads.nodal.push({ n: mid, Fx: -sgn * dP });
      }
    }
    if (c.E && d.seisme.kh > 0) {   // inertie horizontale des voiles et du radier (même sens pour les deux voiles : vers +y)
      loads.nodal.push({ n: ids0[Math.ceil(ids0.length / 2)], Fx: d.seisme.kh * W0 }, { n: ids1[Math.ceil(ids1.length / 2)], Fx: d.seisme.kh * W1 });
    }
    // terres sur talons extérieurs
    const talonLoad = (p, V, yEdge, sgn) => {
      if (!p.talonW) return;
      const W = p.talonW.W * b * kT + (p.talonQ ? (p.talonQ(c.Q ? [{ y1: d.q.y, y2: d.q.y + d.q.larg, q: d.q.exp * c.Q }] : []) + p.talonQ(c.C ? [{ y1: -1e4, y2: 1e4, q: d.q.chantier * c.C }] : [])) * b : 0);
      const i = Y.findIndex((y) => Math.abs(y - (yEdge + sgn * V.talon / 2)) < (yB - yA) / nr);
      const yc = yEdge + sgn * V.talon / 2;
      let best = 0; Y.forEach((y, k) => { if (Math.abs(y - yc) < Math.abs(Y[best] - yc)) best = k; });
      loads.nodal.push({ n: best, Fy: -W }); void i;
    };
    talonLoad(p0, V0, -V0.e0, -1); talonLoad(p1, V1, ouv + V1.e0, 1);
    // terres et charge sur le radier entre les voiles (remblai intérieur zav), eau (sous-pression)
    if (d.radier.zav > zr) for (let i = 0; i < Y.length - 1; i++) { const a = Math.max(Y[i], 0), e2 = Math.min(Y[i + 1], ouv); if (e2 > a) loads.elem.push({ e: i, type: 'u', dir: 'gy', q: -d.sol.g * (d.radier.zav - zr) * b * kT, a: a - Y[i], b: e2 - Y[i] }); }
    if (d.q.radier > 0 && (c.Q || 0)) for (let i = 0; i < Y.length - 1; i++) { const a = Math.max(Y[i], 0), e2 = Math.min(Y[i + 1], ouv); if (e2 > a) loads.elem.push({ e: i, type: 'u', dir: 'gy', q: -d.q.radier * b * c.Q, a: a - Y[i], b: e2 - Y[i] }); }
    const u = GW * Math.max(0, d.eau - (zr - er));
    if (u > 0 && c.W) for (let i = 0; i < Y.length - 1; i++) loads.elem.push({ e: i, type: 'u', dir: 'gy', q: u * b });
    // résolution non linéaire (ressorts sans traction) ; blocage horizontal par un ressort de frottement fictif au centre
    let r = null;
    for (let it = 0; it < 30; it++) {
      const supports = Y.map((y, i) => ({ n: i, uy: actif[i] ? kv * b * trib[i] : false, ux: false }));
      const imid = Y.reduce((bi, y, i) => (Math.abs(y - ouv / 2) < Math.abs(Y[bi] - ouv / 2) ? i : bi), 0);
      supports[imid].ux = 1e3 * kv * b;
      const model = { nodes, elems, supports: supports.filter((s) => s.uy || s.ux) };
      try { r = PQ.solve(model, loads); } catch (e) { throw new Error('Radier instable : soulèvement généralisé (' + e.message + ').'); }
      let chg = false;
      Y.forEach((y, i) => { const uy = r.nodeDisp(i).uy; const a = uy < 0 || !actif[i] && uy < 0; if (actif[i] && uy > 1e-12) { actif[i] = false; chg = true; } else if (!actif[i] && uy < 0) { actif[i] = true; chg = true; } void a; });
      if (!chg) break;
      if (actif.every((a) => !a)) throw new Error('Radier entièrement soulevé.');
    }
    const sig = Y.map((y, i) => (actif[i] ? -kv * r.nodeDisp(i).uy : 0));   // kPa
    return { r, Y, sig, actif, elems, nodes, ids0, ids1, yA, yB, V0, V1, p0, p1, b, zm };
  }

  function calc(d0) {
    const d = JSON.parse(JSON.stringify(d0));
    d.options = d.options || {}; d.eau = Number.isFinite(+d.eau) && d.eau !== '' && d.eau !== null ? +d.eau : -Infinity;
    d.seisme = d.seisme || { kh: 0, kv: 0 };
    const nb = clamp(Math.round(+d.nbandes || 8), 1, 20), L = +d.radier.L, b = L / nb;
    const combs = combinaisons(d), cache = {}, alertes = [];
    const R = combs.map((c) => ({ c, bandes: [] }));
    for (let k = 0; k < nb; k++) {
      const t = (k + 0.5) / nb;
      for (const x of R) x.bandes.push(bande(d, t, b, x.c, cache));
    }
    // ── fondation : contraintes, q'ref, décompression ──
    const Bm = d.ouv + (d.v0.ep.h + d.v0.ep.b) / 2 + (d.v1.ep.h + d.v1.ep.b) / 2 + (d.v0.talon || 0) + (d.v1.talon || 0);
    const zf = d.radier.z - d.radier.e, zdef = Number.isFinite(+d.fond.zdef) ? +d.fond.zdef : d.radier.zav;
    const q0 = d.fond.q0 !== undefined && d.fond.q0 !== '' ? +d.fond.q0 : d.sol.g * Math.max(0, zdef - zf) / 1000;
    const De = +d.fond.De || Math.max(0, zdef - zf);
    let qu = +d.fond.qu, geo = null;
    if (d.fond.sps && d.fond.sps.couches && d.fond.sps.couches.length) { geo = M3.portanceSPS(d.fond.sps, zf, Bm, L, De, zdef, zdef); qu = geo.qu + q0; }
    const gq = Object.assign({ els: 3, elu: 2, acc: 1.5 }, d.fond.gq || {});
    const fondation = R.map(({ c, bandes }) => {
      let smax = 0, smin = Infinity, n = 0, na = 0, H = 0, N = 0;
      for (const B of bandes) {
        B.sig.forEach((s, i) => { smax = Math.max(smax, s); smin = Math.min(smin, s); n++; if (s > 0) na++; });
        N += B.r.reac.reduce((s, x) => s + x.Ry, 0); H += B.r.reac.reduce((s, x) => s + x.Rx, 0);
      }
      const q34 = (3 * smax + smin) / 4 / 1000, delta = Math.atan2(Math.abs(H), N) / D2R;
      const gqv = c.type === 'ELUs' ? gq.acc : c.type === 'ELU' ? gq.elu : gq.els;
      const ql = M3.qrefLim({ delta, frottant: !!d.fond.frottant, DeB: De / Bm, q0, qu, gq: gqv });
      return { no: c.no, nom: c.nom, type: c.type, N, H, smax: smax / 1000, smin: smin / 1000, q34, qlim: ql.lim, iD: ql.iD, delta, decomp: 100 * (1 - na / n) };
    });
    const pick = (types, f) => { const L2 = fondation.filter((r) => types.includes(r.type)); return L2.reduce((a, x) => (f(x) > f(a) ? x : a)); };
    const lim = d.limites || { decFreq: 0, decRare: 25, decELU: 90 };
    const verifs = [
      ['ELS de mobilisation du sol', pick(['ELSr', 'ELSf'], (r) => r.q34 / r.qlim), "q'ref (MPa)", (r) => r.q34, (r) => r.qlim],
      ['ELS décompression (fréquent)', pick(['ELSf'], (r) => r.decomp), 'Décompression (%)', (r) => r.decomp, () => lim.decFreq],
      ['ELS décompression (rare)', pick(['ELSr'], (r) => r.decomp), 'Décompression (%)', (r) => r.decomp, () => lim.decRare],
      ['ELU de mobilisation du sol', pick(['ELU', 'ELUs'], (r) => r.q34 / r.qlim), "q'ref (MPa)", (r) => r.q34, (r) => r.qlim],
      ['ELU de renversement', pick(['ELU', 'ELUs'], (r) => r.decomp), 'Décompression (%)', (r) => r.decomp, () => lim.decELU],
      // glissement (Fasc. 62 titre V) : résultante horizontale (différence des poussées des deux voiles, séisme) ≤ N tgφ′/1,2
      ['ELU de glissement', pick(['ELU', 'ELUs'], (r) => Math.abs(r.H) / Math.max(1e-9, r.N)), "H ≤ N tgφ′/1,2 (kN)", (r) => Math.abs(r.H), (r) => r.N * (+d.fond.mu || 0.6) / 1.2],
    ].map(([nom, r, par, v, a]) => ({ nom, comb: r.no, par, val: v(r), adm: a(r), ok: v(r) <= a(r) + 1e-9 }));
    // ── béton armé ──
    const o = { regl: d.regl, fck: d.beton.fck, fyk: d.beton.fyk, ssLim: d.beton.ssLim, n: d.beton.n || 15, fiss: d.beton.fiss, livret: d.regl !== 'EC' && d.beton.livret };
    const enr = d.beton.enrob, typ = (c) => (c.type === 'ELUs' ? 5 : 1);
    const isELU = (c) => c.type === 'ELU' || c.type === 'ELUs', isELS = (c) => c.type === 'ELSr' || c.type === 'ELSf';
    const radier = [], voiles = { v0: [], v1: [] };
    for (let k = 0; k < nb; k++) {
      const B0 = R[0].bandes[k], Y = B0.Y, nR = Y.length - 1;
      // radier : 11 sections entre les axes des voiles (et consoles des talons)
      const ax0 = -B0.V0.e0 / 2, ax1 = d.ouv + B0.V1.e0 / 2, secs = [];
      for (let i = 0; i <= 10; i++) secs.push(lerp(ax0, ax1, i / 10));
      const atY = (B, y) => { for (let e = 0; e < nR; e++) if (y >= Y[e] - 1e-9 && y <= Y[e + 1] + 1e-9) return B.r.at(e, y - Y[e]); return { N: 0, M: 0, V: 0 }; };
      const rs = secs.map((y) => {
        const elu = R.filter((x) => isELU(x.c)).map((x) => { const e = atY(x.bandes[k], y); return { N: -e.N / B0.b, M: -e.M / B0.b, V: e.V / B0.b, type: typ(x.c), nom: x.c.no }; });
        const els = R.filter((x) => isELS(x.c)).map((x) => { const e = atY(x.bandes[k], y); return { N: -e.N / B0.b, M: -e.M / B0.b, nom: x.c.no }; });
        // convention portique : M > 0 tend la fibre inférieure ; sectionBA : M > 0 comprime la fibre inférieure ⇒ M_BA = −M
        const fe = M3.ferrailler({ h: d.radier.e, dSup: enr.sup, dInf: d.radier.e - enr.inf }, elu, els, Object.assign({}, o, { Amin: d.beton.AminRadier }));
        const Vm = elu.reduce((a, x) => (Math.abs(x.V) > Math.abs(a.V) ? x : a), { V: 0 });
        const tv = M3.tranchant(Vm.V, d.radier.e, d.radier.e - enr.inf, o, Math.max(...fe.As));
        return { y, sup: fe.As[0], inf: fe.As[1], sc: fe.sc, ss: fe.ss, tau: tv.tau, tauLim: tv.lim, At: tv.At, Mmax: Math.max(...elu.map((x) => -x.M)), Mmin: Math.min(...elu.map((x) => -x.M)), ok: fe.sc <= fe.sbc + 1e-6 && tv.ok };
      });
      radier.push(rs);
      // voiles : base, 1/4, 1/2 de la hauteur
      for (const [key, ids, Vk] of [['v0', B0.ids0, 'V0'], ['v1', B0.ids1, 'V1']]) {
        const V = B0[Vk], H = V.zc - V.hc - d.radier.z, sgn = key === 'v0' ? -1 : 1;
        const lev = [0, 0.25, 0.5].map((f) => {
          const z = d.radier.z + f * H, ep = V.e0 - (V.far + V.fav) * (z - d.radier.z);
          const e0 = B0.elems.findIndex((el) => el.name === Vk && z >= el.za - 1e-9 && z <= el.zb + 1e-9);
          const get = (x) => { const B = x.bandes[k], el = B.elems[e0]; return B.r.at(e0, z - el.za); };
          // barre verticale orientée vers le haut : y local = −x global ; M > 0 tend la fibre −y local = +x global.
          // V0 (côté y < 0) : parement extérieur à −x ⇒ M > 0 tend l'intérieur. Fibre « supérieure » BA = parement extérieur.
          const conv = (e) => ({ N: -e.N / B0.b, M: sgn * e.M / B0.b * -1, V: e.V / B0.b });
          const elu = R.filter((x) => isELU(x.c)).map((x) => Object.assign(conv(get(x)), { type: typ(x.c), nom: x.c.no }));
          const els = R.filter((x) => isELS(x.c)).map((x) => Object.assign(conv(get(x)), { nom: x.c.no }));
          const fe = M3.ferrailler({ h: ep, dSup: enr.ext, dInf: ep - enr.int }, elu, els, Object.assign({}, o, { Amin: d.beton.AminVoile }));
          const Vm = elu.reduce((a, x) => (Math.abs(x.V) > Math.abs(a.V) ? x : a), { V: 0 });
          const tv = M3.tranchant(Vm.V, ep, ep - enr.ext, o, fe.As[0]);
          return { f, z, ep, ext: fe.As[0], int: fe.As[1], sc: fe.sc, ss: fe.ss, tau: tv.tau, tauLim: tv.lim, At: tv.At, Mmax: Math.max(...elu.map((x) => Math.abs(x.M))), ok: fe.sc <= fe.sbc + 1e-6 && tv.ok };
        });
        voiles[key].push(lev);
      }
    }
    // diagrammes de la bande centrale (combinaison ELU la plus chargée)
    const kc = Math.floor(nb / 2), cELU = R.filter((x) => isELU(x.c)).reduce((a, x) => (x.bandes[kc].sig.reduce((s, v) => Math.max(s, v), 0) > a.bandes[kc].sig.reduce((s, v) => Math.max(s, v), 0) ? x : a));
    const Bc = cELU.bandes[kc], diag = [];
    for (let e = 0; e < Bc.Y.length - 1; e++) for (const p of Bc.r.diagram(e, 4)) diag.push({ y: Bc.Y[e] + p.x, M: p.M / Bc.b, V: p.V / Bc.b });
    const ok = verifs.every((v) => v.ok) && radier.every((L2) => L2.every((s) => s.ok)) && voiles.v0.every((L2) => L2.every((s) => s.ok)) && voiles.v1.every((L2) => L2.every((s) => s.ok));
    return { d, combs, fondation, verifs, radier, voiles, diag: { comb: cELU.c, y: diag.map((p) => p.y), M: diag.map((p) => p.M), sigY: Bc.Y, sig: Bc.sig.map((s) => s / 1000) },
      fond: { q0, qu, De, zdef, Bm, geo, gq }, nb, b, ok, alertes };
  }

  /* lecture d'un fichier .don d'origine (MUR EN U) */
  function donVersDonnees(txt) {
    const k = M3.lireKV(txt), f = (n, def = 0) => { const v = parseFloat(String(k[n] ?? '').replace(',', '.')); return Number.isFinite(v) ? v : def; };
    if (String(k.application || '').toUpperCase().indexOf('MURU') < 0 && !('ouvdroi' in k)) throw new Error('Ce fichier ne semble pas être un fichier de données MURU.');
    const ang = f('angtl', 100) * Math.PI / 200, sa = Math.sin(ang) || 1;
    // talus : coordonnées ytl comptées depuis le parement intérieur du voile, ramenées dans la coupe droite
    const tal = [0, 1, 2, 3].map((i) => [f('ytl' + i) / sa, f('ztl' + i)]).filter((p, i, a) => i === 0 || p[0] > a[i - 1][0]);
    const V = (i) => ({ nom: k['nomvoile' + i] || 'V' + i, L: f('lonmur' + i), fav: f('frav' + i), far: f('frar' + i), ec: f('epcour' + i), hc: f('hcour' + i),
      ep: { h: f('epvoih' + i), b: f('epvoib' + i) }, zc: { h: f('zcourh' + i), b: f('zcourb' + i) }, talon: f('talon', 0), talus: { h: tal, b: tal } });
    return {
      projet: k.projet || '', regl: f('reglement', 0) === 1 ? 'EC' : 'LIVRET', ouv: f('ouvdroi'), nbandes: Math.min(12, f('nbsecmur', 8)),
      radier: { z: f('zrad'), e: f('eprad'), L: f('lonrad'), zav: f('zrembav', f('zrad')) },
      v0: V(0), v1: V(1), eau: f('zeau', -1e9),
      sol: { phi: f('angfrot', 35), g: f('poivolter', 19), gsat: f('poivoltersat', 22) },
      q: { type: f('typchexp', 1) === 0 ? 'route' : 'fer', voies: f('typchexp', 1) === 2 ? 2 : 1, y: f('yexp') / sa, larg: f('lonexp') / sa, exp: f('chgexp') * sa, chantier: f('qchantier'), radier: f('qexpav'), cote: 2 },
      beton: { fck: f('fc28', 25), fyk: f('fe', 500), n: f('nbael', 15), g: f('poivolbet', 25), fiss: f('typfiss', 1), livret: f('patrim', 0) === 1, ssLim: NaN,
        enrob: { sup: f('enrcofterre', 0.025) + 0.03, inf: f('enrcoffouil', 0.03) + 0.025, ext: f('enrcofterre', 0.025) + 0.03, int: f('enrcofavant', 0.045) + 0.03 }, AminVoile: 3, AminRadier: 3 },
      fond: { qu: f('qu', 1), mu: f('frotsolsem', 0.6), frottant: f('typsolfrot', 0) === 1 || f('typesolfrot', 0) === 1, kv: f('kvdif', 10) * 1000, gq: { els: 3, elu: 2, acc: 1.5 } },
      limites: { decFreq: 0, decRare: 25, decELU: 90 }, seisme: { kh: 0, kv: 0 }, options: { deltaVoile: 0 },
    };
  }
  function exemple() {
    const tal = [[0.6, 57.6], [3.5, 59.6], [9, 59.6]];
    return {
      projet: 'Mur en U — exemple', regl: 'EC', ouv: 4.45, nbandes: 6,
      radier: { z: 56.1, e: 0.6, L: 8.0, zav: 56.8 },
      v0: { nom: 'V0', fav: 0, far: 3.68, ec: 0.5, hc: 0.3, ep: { h: 0.71, b: 0.61 }, zc: { h: 62.1, b: 59.1 }, talon: 0.2, talus: { h: [[0.6, 59.0], [4.0, 61.5], [12, 61.6]], b: tal } },
      v1: { nom: 'V1', fav: 0, far: 3.68, ec: 0.5, hc: 0.3, ep: { h: 0.71, b: 0.61 }, zc: { h: 62.1, b: 59.1 }, talon: 0.2, talus: { h: [[0.6, 59.0], [4.0, 61.5], [12, 61.6]], b: tal } },
      eau: 52.36, sol: { phi: 35, g: 19, gsat: 22 },
      q: { type: 'fer', voies: 2, y: 2.8, larg: 6.5, exp: 50, chantier: 0, radier: 0, cote: 2 },
      beton: { fck: 28, fyk: 500, n: 15, g: 25, fiss: 1, livret: false, ssLim: NaN, enrob: { sup: 0.055, inf: 0.055, ext: 0.055, int: 0.075 }, AminVoile: 3, AminRadier: 3 },
      fond: { qu: 3.0, frottant: true, kv: 10000, gq: { els: 3, elu: 2, acc: 1.5 } },
      limites: { decFreq: 0, decRare: 25, decELU: 90 }, seisme: { kh: 0, kv: 0 }, options: { deltaVoile: 0, nRadier: 24 },
    };
  }

  const api = { calc, bande, combinaisons, pousseeVoile, voile, donVersDonnees, exemple };
  if (node) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.murU = api; }
})(typeof window !== 'undefined' ? window : globalThis);
