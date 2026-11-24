/* BridgeAI Studios — Plans de ferraillage de principe des structures du module coffrage.
 * Pour chaque structure : ferr(g, fp) → { views, bars, vol }
 *   fp.c : enrobage (m) ; fp.o[rep] = { d, esp, n } : surcharges saisies par l'utilisateur.
 * Présentation inspirée des plans KLE (Pile P3 PK5, culées) : repères dans une bulle rouge,
 * texte « nHAd e=x » sur la ligne de rappel, nomenclature par élément avec façonnage.
 * Ferraillage de principe : les sections d'acier sont à justifier par la note de calcul.
 */
(function (root) {
  'use strict';
  const C = (typeof module === 'object' && module.exports) ? require('./coffrage.js') : root.COFF;
  const REG = (typeof module === 'object' && module.exports) ? (require('./coffrage-structs.js'), globalThis.COFF_REG) : root.COFF_REG;
  const { View, RECT, CIRC, finishBars, f2 } = C;

  /* ───────── Outils ───────── */
  const UP = (L, r) => [[0, r], [0, 0], [L, 0], [L, r]];          // U retours vers le haut
  const DN = (L, r) => [[0, -r], [0, 0], [L, 0], [L, -r]];        // U retours vers le bas
  const ST = (L) => [[0, 0], [L, 0]];
  const LF = (a, b) => [[a, 0], [0, 0], [0, b]];                  // barre en L (pied a, hauteur b)
  const RB = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];          // cadre fermé
  const row = (a, b, e) => { const n = Math.max(1, Math.round((b - a) / e)), o = []; for (let i = 0; i <= n; i++) o.push(a + (b - a) * i / n); return o; };
  const spread = (nb, e) => { const a = []; for (let i = 0; i < nb; i++) a.push((i - (nb - 1) / 2) * e); return a; };
  const dT = (t) => (t >= 1.5 ? 25 : t >= 1.0 ? 20 : t >= 0.6 ? 16 : t >= 0.35 ? 14 : 12);
  const DS = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40], up = (d, k) => DS[Math.min(DS.length - 1, DS.indexOf(d) + (k || 1))];
  const near = (arr, t) => arr[Math.min(arr.length - 1, Math.max(0, Math.round((arr.length - 1) * t)))];

  /* Fond de plan : contours du coffrage (sans cotes ni textes) */
  function base(struct, g, idx, title) {
    const v = new View(title), src = struct.views(g)[idx];
    src.items.forEach((it) => { if (it.t === 'poly' || it.t === 'circ' || it.t === 'brk' || it.t === 'ground' || (it.t === 'line' && it.st !== 'hidden')) v.items.push(it); });
    return v;
  }
  /* Cotes d'encombrement */
  function overall(v, keyW, keyH) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    v.items.forEach((it) => { if (it.t === 'poly') it.pts.forEach((p) => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }); });
    if (!isFinite(x0)) return v;
    const m = Math.max(0.25, (x1 - x0 + y1 - y0) * 0.03);
    if (keyW !== false) v.dimH([x0, y1], [x1, y1], y1 + m);
    if (keyH !== false) v.dimV([x1, y0], [x1, y1], x1 + m);
    return v;
  }

  /* Registre des aciers d'une structure */
  function Kit(fp, defC) {
    const c = fp && fp.c != null && fp.c !== '' ? +fp.c : defC, o = (fp && fp.o) || {}, bars = [];
    const K = {
      c, grp: '', bars,
      add(b) {
        const rep = bars.length + 1, ov = o[rep] || {};
        b.def = { d: b.d, esp: b.esp };
        if (ov.d) b.d = +ov.d;
        if (ov.esp && b.esp) b.esp = +ov.esp;
        if (b.ld != null && b.esp) b.nu = Math.max(2, Math.round(b.ld / b.esp) + 1);
        if (ov.n && !b.esp) b.nu = Math.max(1, Math.round(+ov.n));
        if (b.nu == null) b.nu = b.n || 1;
        b.rep = rep; b.grp = b.grp || K.grp; b.ne = b.ne || 1;
        bars.push(b); return b;
      },
      lab(b) { return (b.ne > 1 ? b.nu + '*' + b.ne : b.nu) + (b.closed ? ' CAD ' : b.circle ? ' Cerces ' : '') + 'HA' + b.d + (b.esp ? ' e=' + f2(b.esp) : ''); },
      done(views, vol) { finishBars(bars); return { views, bars, vol, c }; },
    };
    return K;
  }

  /* ───────── Familles d'éléments ───────── */
  /* Nappes inférieures et supérieures d'une semelle / d'un radier / d'une dalle, coupe suivant x.
     o : x0, x1, y0, h, Lp (dimension ⊥ coupe), d, e, dS, eS, ret, noSup, ix (repère côté) */
  function nappes(K, v, o) {
    const c = K.c, Lx = o.x1 - o.x0 - 2 * c, Ly = o.Lp - 2 * c, r = o.ret != null ? o.ret : Math.max(0.15, Math.min(o.h - 2 * c, 0.9));
    const d = o.d || dT(o.h), e = o.e || 0.15, dS = o.dS || Math.max(12, up(d, -1)), eS = o.eS || e;
    const yI = o.y0 + c, yS = o.y0 + o.h - c, nm = o.nm || '';
    const b1 = K.add({ des: 'Nappe inf. ' + nm + '(sens coupe)', d, esp: e, ld: Ly, shape: UP(Lx, r) });
    v.bar([[o.x0 + c, yI + r], [o.x0 + c, yI], [o.x1 - c, yI], [o.x1 - c, yI + r]], b1.d).rep([o.x0 + c + Lx * 0.3, yI], b1.rep, K.lab(b1));
    const b2 = K.add({ des: 'Nappe inf. ' + nm + '(sens ⊥)', d, esp: e, ld: Lx, shape: UP(Ly, r) });
    const p2 = row(o.x0 + c + 0.05, o.x1 - c - 0.05, b2.esp).map((x) => [x, yI + (b1.d + b2.d) / 2000]);
    v.dots(p2, b2.d).rep(near(p2, 0.72), b2.rep, K.lab(b2));
    if (o.noSup) return { yI, yS, b1, b2 };
    const b3 = K.add({ des: 'Nappe sup. ' + nm + '(sens coupe)', d: dS, esp: eS, ld: Ly, shape: DN(Lx, Math.min(r, o.h - 2 * c - 0.1)) });
    const rs = Math.min(r, o.h - 2 * c - 0.1);
    v.bar([[o.x0 + c + 0.03, yS - rs], [o.x0 + c + 0.03, yS], [o.x1 - c - 0.03, yS], [o.x1 - c - 0.03, yS - rs]], b3.d).rep([o.x0 + c + Lx * 0.2, yS], b3.rep, K.lab(b3));
    const b4 = K.add({ des: 'Nappe sup. ' + nm + '(sens ⊥)', d: dS, esp: eS, ld: Lx, shape: DN(Ly, rs) });
    const p4 = row(o.x0 + c + 0.08, o.x1 - c - 0.08, b4.esp).map((x) => [x, yS - (b3.d + b4.d) / 2000]);
    v.dots(p4, b4.d).rep(near(p4, 0.8), b4.rep, K.lab(b4));
    return { yI, yS, b1, b2, b3, b4 };
  }

  /* Voile vertical vu en coupe (épaisseur xa..xb, de y0 à y1), aciers verticaux ancrés à yb. */
  function voile(K, v, o) {
    const c = K.c, yb = o.yb != null ? o.yb : o.y0 + c, yT = o.ytop != null ? o.ytop : o.y1 - c, fl = o.fl != null ? o.fl : (yb < o.y0 - 0.05 ? 0.40 : 0);
    const t = o.xb - o.xa, dV = o.dV || dT(t), eV = o.eV || 0.15, dH = o.dH || Math.max(10, up(dV, -1)), eH = o.eH || 0.20, Lw = o.Lw;
    const H = yT - yb, xA = o.xa + c, xB = o.xb - c, nmA = o.nmA || 'face gauche', nmB = o.nmB || 'face droite';
    const bA = K.add({ des: 'Verticales ' + nmA, d: dV, esp: eV, ld: Lw - 2 * c, shape: fl ? LF(fl, H) : [[0, 0], [0, H]] });
    v.bar((fl ? [[xA - fl, yb]] : []).concat([[xA, yb], [xA, yT]]), bA.d).rep([xA, o.y0 + (o.y1 - o.y0) * 0.55], bA.rep, K.lab(bA), 'L');
    const bB = K.add({ des: 'Verticales ' + nmB, d: o.dV2 || dV, esp: eV, ld: Lw - 2 * c, shape: fl ? LF(fl, H) : [[0, 0], [0, H]] });
    v.bar([[xB, yT], [xB, yb]].concat(fl ? [[xB + fl, yb]] : []), bB.d).rep([xB, o.y0 + (o.y1 - o.y0) * 0.45], bB.rep, K.lab(bB), 'R');
    const ys = row(o.y0 + 0.08, o.y1 - c - 0.03, eH);
    const bH = K.add({ des: 'Horizontales (2 faces)', d: dH, esp: eH, ld: o.y1 - c - 0.03 - o.y0 - 0.08, ne: 2, shape: ST(Lw - 2 * c) });
    const dx = (bA.d + bH.d) / 2000;
    v.dots(ys.map((y) => [xA + dx, y]).concat(ys.map((y) => [xB - dx, y])), bH.d).rep([xA + dx, near(ys, 0.3)], bH.rep, K.lab(bH), 'L');
    if (t >= 0.25 && !o.noEp) {
      const te = xB - xA, ne = Math.max(2, Math.ceil((o.y1 - o.y0) * Lw * 4));
      const bE = K.add({ des: 'Épingles', d: 8, n: ne, shape: [[0, 0.08], [0, 0], [te, 0], [te, 0.08]] });
      [0.25, 0.5, 0.75].forEach((f, i) => { const y = o.y0 + (o.y1 - o.y0) * f; v.bar([[xA, y], [xB, y]], bE.d); if (i === 1) v.rep([(xA + xB) / 2, y], bE.rep, K.lab(bE), 'R'); });
    }
    return { xA, xB, yT, bA, bB, bH };
  }

  /* Poteau / fût / pieu circulaire : élévation (vE) et section (vS, centre sc). */
  function poteau(K, vE, vS, o) {
    const c = K.c, D = o.D, ri = D / 2 - c - 0.015, d = o.d || (D >= 1.2 ? 25 : D >= 0.8 ? 20 : 16);
    const n = o.n || Math.max(6, Math.round(Math.PI * 2 * ri / 0.13)), dc = o.dc || (D >= 1.5 ? 16 : D >= 0.9 ? 14 : 12), ec = o.ec || 0.15;
    const Lb = o.yT - o.yb, fl = o.fl || 0;
    const bL = K.add({ des: o.desL || 'Barres longitudinales', d, n, ne: o.ne || 1, shape: fl ? LF(fl, Lb) : [[0, 0], [0, Lb]] });
    const bC = K.add({ des: o.desC || 'Cerces', d: dc, esp: ec, ld: o.yc1 - o.yc0, ne: o.ne || 1, circle: 2 * ri + dc / 1000 });
    const xs = [...new Set(Array.from({ length: bL.nu }, (_, i) => Math.round(ri * Math.cos(2 * Math.PI * i / bL.nu) * 200) / 200))];
    if (vE) {
      const segs = o.segs || [[o.yb, o.yT]];
      xs.forEach((x, i) => segs.forEach(([a, b]) => vE.bar([[o.xc + x, a], [o.xc + x, b]], bL.d)));
      if (fl) { vE.bar([[o.xc - ri - fl, o.yb], [o.xc - ri, o.yb]], bL.d); vE.bar([[o.xc + ri, o.yb], [o.xc + ri + fl, o.yb]], bL.d); }
      const cs = (o.csegs || [[o.yc0, o.yc1]]).map(([a, b]) => row(a, b, bC.esp));
      const nC = cs.reduce((s, a) => s + a.length, 0), step = nC > 90 ? 2 : 1;
      cs.forEach((ys) => ys.forEach((y, j) => { if (j % step === 0) vE.bar([[o.xc - ri - 0.012, y], [o.xc + ri + 0.012, y]], bC.d); }));
      vE.rep([o.xc + ri, o.yc0 + (o.yc1 - o.yc0) * (o.tl || 0.62)], bL.rep, K.lab(bL), 'R');
      const yy = cs[0][Math.floor(cs[0].length * 0.4)];
      vE.rep([o.xc - ri * 0.3, yy], bC.rep, K.lab(bC), 'L');
      if (!o.noDist) vE.dist([o.xc + D / 2 + 0.12, o.yc0], [o.xc + D / 2 + 0.12, o.yc1], (bC.nu - 1) + ' x ' + f2(bC.esp));
    }
    if (vS) {
      const sc = o.sc || [0, 0], P = Array.from({ length: bL.nu }, (_, i) => { const t = Math.PI / 2 + 2 * Math.PI * i / bL.nu; return [sc[0] + (ri - dc / 1000 - d / 2000) * Math.cos(t), sc[1] + (ri - dc / 1000 - d / 2000) * Math.sin(t)]; });
      vS.bar(CIRC(sc[0], sc[1], ri, 64).concat([[sc[0] + ri, sc[1]]]), bC.d).dots(P, bL.d);
      vS.rep(P[Math.round(bL.nu * 0.62) % bL.nu], bL.rep, K.lab(bL), 'L').rep([sc[0] + ri * 0.71, sc[1] - ri * 0.71], bC.rep, K.lab(bC), 'R');
    }
    return { bL, bC };
  }

  /* Poutre / longrine / sommier rectangulaire : élévation (vE : x0..x1, yb..yb+h) et section (vS : centre sx, bas sy). */
  function poutre(K, vE, vS, o) {
    const c = K.c, L = o.x1 - o.x0, h = o.h, b = o.b, Lb = L - 2 * c, rh = Math.min(0.40, h - 2 * c - 0.05);
    const dI = o.dI || (h >= 1.2 ? 25 : h >= 0.8 ? 20 : 16), dS = o.dS || Math.max(14, up(dI, -2)), dc = o.dc || (b >= 1.2 ? 14 : 12), ec = o.ec || 0.20;
    const nI = o.nI || Math.max(3, Math.round((b - 2 * c) / 0.12) + 1), nS = o.nS || Math.max(3, Math.round((b - 2 * c) / 0.15) + 1);
    const nP = h > 0.8 ? Math.max(1, Math.floor((h - 2 * c) / 0.35) - 1) : 0;
    const bI = K.add({ des: o.desI || 'Filants inférieurs', d: dI, n: nI, shape: UP(Lb, rh) });
    const bS = K.add({ des: o.desS || 'Filants supérieurs', d: dS, n: nS, shape: DN(Lb, rh) });
    const bP = nP ? K.add({ des: 'Aciers de peau', d: 12, n: nP, ne: 2, shape: ST(Lb) }) : null;
    const bC = K.add({ des: 'Cadres', d: dc, esp: ec, ld: L - 0.10, closed: true, shape: RB(b - 2 * c, h - 2 * c) });
    const bE = b > 0.9 ? K.add({ des: 'Étriers intérieurs', d: dc, esp: ec, ld: L - 0.10, closed: true, shape: RB((b - 2 * c) / 2.2, h - 2 * c) }) : null;
    if (vE) {
      const y0 = o.yb, yI = y0 + c, yS = y0 + h - c;
      const inf = o.infPts || [[o.x0 + c, yI + rh], [o.x0 + c, yI], [o.x1 - c, yI], [o.x1 - c, yI + rh]];
      vE.bar(inf, bI.d).bar([[o.x0 + c + 0.03, yS - rh], [o.x0 + c + 0.03, yS], [o.x1 - c - 0.03, yS], [o.x1 - c - 0.03, yS - rh]], bS.d);
      if (bP) row(yI, yS, (yS - yI) / (nP + 1)).slice(1, -1).forEach((y) => vE.bar([[o.x0 + c + 0.05, y], [o.x1 - c - 0.05, y]], bP.d));
      const xs = row(o.x0 + 0.05, o.x1 - 0.05, bC.esp), step = xs.length > 80 ? 2 : 1, ybot = o.cadBot || (() => yI);
      xs.forEach((x, i) => { if (i % step === 0) vE.bar([[x, ybot(x) - 0.01], [x, yS + 0.01]], bC.d); });
      vE.rep([o.x0 + L * 0.37, (o.infPts ? inf[1][1] : yI)], bI.rep, K.lab(bI), 'L').rep([o.x0 + L * 0.66, yS], bS.rep, K.lab(bS), 'R');
      if (bP) vE.rep([o.x0 + L * 0.22, row(yI, yS, (yS - yI) / (nP + 1))[1]], bP.rep, K.lab(bP), 'L');
      vE.rep([near(xs, 0.85), (yI + yS) / 2], bC.rep, K.lab(bC), 'R');
      vE.dist([o.x0 + 0.05, y0 - 0.18], [o.x1 - 0.05, y0 - 0.18], (bC.nu - 1) + ' x ' + f2(bC.esp));
    }
    if (vS) {
      const sx = o.sx || 0, sy = o.sy || 0, xa = sx - b / 2 + c, xb = sx + b / 2 - c, ya = sy + c, yb = sy + h - c;
      vS.bar([[xa, ya], [xb, ya], [xb, yb], [xa, yb], [xa, ya]], bC.d);
      if (bE) { const w = (b - 2 * c) / 2.2; vS.bar([[sx - w / 2, ya + 0.02], [sx + w / 2, ya + 0.02], [sx + w / 2, yb - 0.02], [sx - w / 2, yb - 0.02], [sx - w / 2, ya + 0.02]], bE.d); }
      const r = (bC.d) / 1000;
      const pI = row(xa + r + dI / 2000, xb - r - dI / 2000, (xb - xa - 2 * r - dI / 1000) / Math.max(1, bI.nu - 1)).slice(0, bI.nu).map((x) => [x, ya + r + dI / 2000]);
      const pS = row(xa + r + dS / 2000, xb - r - dS / 2000, (xb - xa - 2 * r - dS / 1000) / Math.max(1, bS.nu - 1)).slice(0, bS.nu).map((x) => [x, yb - r - dS / 2000]);
      vS.dots(pI, bI.d).dots(pS, bS.d).rep(near(pI, 0.3), bI.rep, K.lab(bI), 'L').rep(near(pS, 0.7), bS.rep, K.lab(bS), 'R').rep([xb, (ya + yb) / 2 + (bP ? 0.12 : 0)], bC.rep, K.lab(bC), 'R');
      if (bE) vS.rep([sx + (b - 2 * c) / 4.4, ya + 0.02], bE.rep, K.lab(bE), 'R');
      if (bP) { const ys = row(ya, yb, (yb - ya) / (nP + 1)).slice(1, -1); vS.dots(ys.map((y) => [xa + r + 0.006, y]).concat(ys.map((y) => [xb - r - 0.006, y])), 12).rep([xa + r + 0.006, ys[0]], bP.rep, K.lab(bP), 'L'); }
    }
    return { bI, bS, bC };
  }

  const vol = (struct, g) => struct.qty(g).reduce((a, q) => a + q[1], 0);
  const R = REG;

  /* ═════════════ CULÉES ═════════════ */
  function culeeProfile(g, x0f, ef) {
    const y1 = g.hs + g.Hf, y2 = y1 + g.hsm, y3 = y2 + g.hgg, xs0 = g.d - g.af, xsb = xs0 + g.bs, xg0 = xsb - g.egg, yc = y3 - g.zc;
    return { y1, y2, y3, xs0, xsb, xg0, yc };
  }
  function culeeHaut(K, A, g, P) {
    const c = K.c;
    K.grp = 'Sommier';
    poutre(K, null, A, { x0: 0, x1: g.L, h: g.hsm, b: g.bs, sx: P.xs0 + g.bs / 2, sy: P.y1, dI: 16, dS: 16, nI: Math.round((g.bs - 2 * c) / 0.15) + 1, nS: Math.round((g.bs - 2 * c) / 0.15) + 1, ec: 0.20, dc: 12, desI: 'Filants inf. sommier', desS: 'Filants sup. sommier' });
    K.grp = 'Garde-grève';
    voile(K, A, { xa: P.xg0, xb: P.xsb, y0: P.y2, y1: P.y3, yb: P.y1 + c + 0.1, Lw: g.L, dV: 14, eV: 0.15, dH: 12, eH: 0.20, nmA: 'face arrière tablier', nmB: 'face remblai', noEp: true });
    K.grp = 'Corbeau';
    const x1 = P.xsb + g.lc - c, ya = P.yc - c, yb2 = P.yc - g.hc + c, xi = P.xsb - 0.45;
    const bK = K.add({ des: 'Cadres corbeau', d: 12, esp: 0.15, ld: g.L - 2 * c, shape: [[0, 0], [x1 - xi, 0], [x1 - xi, ya - yb2], [0, ya - yb2]] });
    A.bar([[xi, ya], [x1, ya], [x1, yb2], [xi, yb2]], bK.d).rep([x1, (ya + yb2) / 2], bK.rep, K.lab(bK), 'R');
  }
  R.culeeV.ferr = function (g, fp) {
    const K = Kit(fp, 0.05), c = K.c, P = culeeProfile(g, g.d, g.ef), A = overall(base(R.culeeV, g, 0, 'Coupe longitudinale — ferraillage'));
    K.grp = 'Semelle'; nappes(K, A, { x0: 0, x1: g.Bs, y0: 0, h: g.hs, Lp: g.Ls });
    K.grp = 'Mur de front'; voile(K, A, { xa: g.d, xb: g.d + g.ef, y0: g.hs, y1: P.y1, yb: c + 0.06, ytop: P.y2 - c - 0.05, Lw: g.L, nmA: 'face avant', nmB: 'face arrière', dV2: up(Math.max(dT(g.ef), 16)) });
    culeeHaut(K, A, g, P);
    return K.done([A], vol(R.culeeV, g));
  };
  R.culeeC.ferr = function (g, fp) {
    const K = Kit(fp, 0.05), c = K.c, P = culeeProfile(g, g.d, g.D), A = overall(base(R.culeeC, g, 0, 'Coupe longitudinale sur colonne — ferraillage'));
    const S = new View('Coupe sur colonne').cut(CIRC(0, 0, g.D / 2, 64));
    K.grp = 'Semelle'; nappes(K, A, { x0: 0, x1: g.Bs, y0: 0, h: g.hs, Lp: g.Ls });
    K.grp = 'Colonnes'; poteau(K, A, S, { xc: g.d + g.D / 2, D: g.D, yb: c + 0.06, yT: P.y2 - c - 0.05, fl: 0.5, ne: g.nc, yc0: g.hs + 0.05, yc1: P.y1 - 0.05, noDist: true });
    culeeHaut(K, A, g, P);
    return K.done([A, S], vol(R.culeeC, g));
  };

  /* ═════════════ PILE / CHEVÊTRE ═════════════ */
  function chevetre(K, vE, vS, g, y0, sx) {
    const c = K.c, Lh = g.Lc / 2, ph = g.lp / 2, yt = y0 + g.h1, rh = 0.4;
    const inf = [[-Lh + c, yt - g.h2 + c + rh], [-Lh + c, yt - g.h2 + c], [-ph, y0 + c], [ph, y0 + c], [Lh - c, yt - g.h2 + c], [Lh - c, yt - g.h2 + c + rh]];
    const shape = inf.map((p) => [p[0] + Lh - c, p[1] - y0 - c]);
    const slope = (x) => { const ax = Math.abs(x); return ax <= ph ? y0 + c : y0 + c + (ax - ph) / (Lh - ph) * (g.h1 - g.h2); };
    K.grp = 'Chevêtre';
    const r = poutre(K, vE, vS, { x0: -Lh, x1: Lh, yb: y0, h: g.h1, b: g.bc, sx: sx || 0, sy: 0, infPts: inf, cadBot: slope, dI: 20, dS: 25, nS: Math.round((g.bc - 2 * c) / 0.12) + 1, ec: 0.20, dc: 12 });
    r.bI.shape = shape;
    // bossages
    K.grp = 'Bossages';
    const bb = K.add({ des: 'Frettes de bossage', d: 10, n: 3, ne: g.na, closed: true, shape: RB(g.ba - 2 * 0.03, g.ba - 2 * 0.03) });
    if (vE) { const x = spread(g.na, g.ea)[0]; [0.03, 0.06].forEach((dy) => vE.bar([[x - g.ba / 2 + 0.03, yt + dy], [x + g.ba / 2 - 0.03, yt + dy]], bb.d)); vE.rep([x, yt + 0.06], bb.rep, K.lab(bb), 'L'); }
    return r;
  }
  R.pile.ferr = function (g, fp) {
    const K = Kit(fp, 0.05), c = K.c, y0 = g.hs + g.Hf, A = base(R.pile, g, 0, 'Élévation transversale — ferraillage');
    overall(A);
    const S = new View('Coupe sur fût').cut(CIRC(0, 0, g.D / 2, 64)), T = new View('Coupe transversale du chevêtre').cut(RECT(-g.bc / 2, 0, g.bc, g.h1));
    K.grp = 'Semelle'; nappes(K, A, { x0: -g.Ls / 2, x1: g.Ls / 2, y0: 0, h: g.hs, Lp: g.Bs });
    K.grp = 'Fûts';
    const fx = spread(g.nf, g.ef);
    poteau(K, A, S, { xc: fx[0], D: g.D, yb: c + 0.06, yT: y0 + g.h1 - c - 0.06, fl: 0.6, ne: g.nf, yc0: g.hs + 0.05, yc1: y0 - 0.05 });
    fx.slice(1).forEach((x) => { const ri = g.D / 2 - c - 0.015; A.bar([[x - ri, c + 0.06], [x - ri, y0 + g.h1 - c - 0.06]], 25).bar([[x + ri, c + 0.06], [x + ri, y0 + g.h1 - c - 0.06]], 25); });
    chevetre(K, A, T, g, y0);
    return K.done([A, S, T], vol(R.pile, g));
  };
  R.chevetre.ferr = function (g, fp) {
    const K = Kit(fp, 0.05), A = overall(base(R.chevetre, g, 0, 'Élévation — ferraillage')), T = new View('Coupe transversale').cut(RECT(-g.bc / 2, 0, g.bc, g.h1));
    chevetre(K, A, T, g, 1.0);
    return K.done([A, T], vol(R.chevetre, g));
  };

  /* ═════════════ MASSIF SUR PIEUX ═════════════ */
  R.massif.ferr = function (g, fp) {
    const K = Kit(fp, 0.05), c = K.c, A = overall(base(R.massif, g, 0, 'Élévation longitudinale — ferraillage')), B = overall(base(R.massif, g, 1, 'Élévation transversale — ferraillage'));
    K.grp = 'Massif';
    const n1 = nappes(K, A, { x0: -g.Lx / 2, x1: g.Lx / 2, y0: -g.h, h: g.h, Lp: g.Ly, d: g.h >= 1.4 ? 25 : 20, e: 0.15 });
    // vue transversale : mêmes aciers vus dans l'autre sens
    const Wh = g.Ly / 2, yI = -g.h + c, yS = -c, r = Math.max(0.15, Math.min(g.h - 2 * c, 0.9)), rs = Math.min(r, g.h - 2 * c - 0.1);
    B.bar([[-Wh + c, yI + r], [-Wh + c, yI], [Wh - c, yI], [Wh - c, yI + r]], n1.b2.d).bar([[-Wh + c + 0.03, yS - rs], [-Wh + c + 0.03, yS], [Wh - c - 0.03, yS], [Wh - c - 0.03, yS - rs]], n1.b4.d);
    const q1 = row(-Wh + c + 0.05, Wh - c - 0.05, n1.b1.esp).map((x) => [x, yI + (n1.b1.d + n1.b2.d) / 2000]), q3 = row(-Wh + c + 0.08, Wh - c - 0.08, n1.b3.esp).map((x) => [x, yS - (n1.b3.d + n1.b4.d) / 2000]);
    B.dots(q1, n1.b1.d).dots(q3, n1.b3.d).rep([-Wh / 2, yI], n1.b2.rep, K.lab(n1.b2)).rep([Wh / 2, yS], n1.b4.rep, K.lab(n1.b4)).rep(near(q1, 0.75), n1.b1.rep, K.lab(n1.b1)).rep(near(q3, 0.85), n1.b3.rep, K.lab(n1.b3));
    // frettes en tête de pieux
    K.grp = 'Massif';
    const bF = K.add({ des: 'Cerces de frettage (tête de pieux)', d: 16, n: 3, ne: g.nx * g.ny, circle: g.D + 0.30 });
    spread(g.nx, g.ex).forEach((x, i) => [0.10, 0.25, 0.40].forEach((dy) => A.bar([[x - g.D / 2 - 0.15, -g.h + c + dy + 0.05], [x + g.D / 2 + 0.15, -g.h + c + dy + 0.05]], bF.d)));
    A.rep([spread(g.nx, g.ex)[0] + g.D / 2 + 0.15, -g.h + c + 0.30], bF.rep, K.lab(bF), 'L');
    if (g.Df > 0) {
      K.grp = 'Fût (attentes)';
      const ri = g.Df / 2 - 0.05 - 0.015, n = Math.max(8, Math.round(Math.PI * 2 * ri / 0.13));
      const bA = K.add({ des: 'Attentes du fût', d: g.Df >= 1.2 ? 25 : 20, n, shape: LF(0.6, g.h - 2 * c + 1.0) });
      [-ri, ri].forEach((x) => A.bar([[x + Math.sign(x) * 0.6, -g.h + c + 0.06], [x, -g.h + c + 0.06], [x, 1.0]], bA.d));
      A.rep([ri, 0.4], bA.rep, K.lab(bA), 'R');
    }
    return K.done([A, B], vol(R.massif, g) - g.nx * g.ny * Math.PI * g.D * g.D / 4 * g.Lp);
  };

  /* ═════════════ PIEU / BARRETTE / PAROI ═════════════ */
  R.pieu.ferr = function (g, fp) {
    const K = Kit(fp, 0.075), c = K.c, ht = 2.2, gp = 0.7, yp = -ht - gp - 1.0, ya = g.lr + 0.8;
    const A = base(R.pieu, g, 0, 'Élévation (interrompue) — ferraillage'), S = new View('Coupe A-A').cut(CIRC(0, 0, g.D / 2, 64));
    A.dimH([-g.D / 2, ya], [g.D / 2, ya], ya + 0.4);
    K.grp = 'Pieu';
    const r = poteau(K, A, S, { xc: 0, D: g.D, yb: yp + c, yT: ya, segs: [[-ht + 0.02, ya], [yp + c, yp + 0.98]], csegs: [[-ht + 0.05, g.lr - 0.05], [yp + c + 0.05, yp + 0.95]], yc0: -ht + 0.05, yc1: g.lr - 0.05, d: g.D >= 1.2 ? 25 : 20, ec: 0.15, noDist: true, tl: 0.5, desL: 'Barres longitudinales (cage)', desC: 'Cerces (ou spire)' });
    r.bL.shape = [[0, 0], [0, g.L + g.lr + 0.8 - c]];
    r.bC.nu = Math.max(2, Math.round((g.L + g.lr - c) / r.bC.esp) + 1); r.bC.ld = g.L;
    A.text([g.D / 2 + 0.15, g.lr + 0.55], 'Attentes', 2, { a: 'start', it: true });
    const bR = K.add({ des: 'Cerces de rigidité', d: 20, n: Math.max(2, Math.ceil(g.L / 3)), circle: g.D - 2 * c - 0.1 });
    S.bar(CIRC(0, 0, (g.D - 2 * c - 0.1) / 2 - 0.04, 48).concat([[(g.D - 2 * c - 0.1) / 2 - 0.04, 0]]), bR.d).rep([0, -(g.D - 2 * c - 0.1) / 2 + 0.04], bR.rep, K.lab(bR), 'R');
    return K.done([A, S], vol(R.pieu, g));
  };
  R.barrette.ferr = function (g, fp) {
    const K = Kit(fp, 0.075), c = K.c, ht = 2.4, gp = 0.7, yp = -ht - gp - 1.0, ya = g.lr + 0.8, Bh = g.B / 2, eh = g.e / 2;
    const A = base(R.barrette, g, 0, 'Élévation face (interrompue) — ferraillage'), S = new View('Coupe A-A').cut(RECT(-Bh, -eh, g.B, g.e));
    K.grp = 'Barrette';
    const nf = Math.round((g.B - 2 * c) / 0.15) + 1, d = 25, Lb = g.L + g.lr + 0.8 - c;
    const bL = K.add({ des: 'Barres longitudinales (2 faces)', d, n: nf, ne: 2, shape: [[0, 0], [0, Lb]] });
    const xs = row(-Bh + c + 0.03, Bh - c - 0.03, (g.B - 2 * c - 0.06) / (bL.nu - 1)).slice(0, bL.nu);
    [[-ht + 0.02, ya], [yp + c, yp + 0.98]].forEach(([a, b]) => xs.forEach((x, i) => { if (i % 2 === 0 || bL.nu < 14) A.bar([[x, a], [x, b]], bL.d); }));
    const bC = K.add({ des: 'Cadres', d: 14, esp: 0.20, ld: g.L + g.lr, closed: true, shape: RB(g.B - 2 * c, g.e - 2 * c) });
    const bE = K.add({ des: 'Épingles', d: 12, esp: 0.20, ld: g.L + g.lr, ne: Math.max(1, Math.round(bL.nu / 2) - 1), shape: [[0, 0.1], [0, 0], [g.e - 2 * c, 0], [g.e - 2 * c, 0.1]] });
    [[-ht + 0.05, g.lr - 0.05], [yp + c + 0.05, yp + 0.95]].forEach(([a, b]) => row(a, b, bC.esp).forEach((y) => A.bar([[-Bh + c, y], [Bh - c, y]], bC.d)));
    A.rep([xs[1], -ht * 0.5], bL.rep, K.lab(bL), 'L').rep([Bh - c, -ht * 0.3], bC.rep, K.lab(bC), 'R').dimH([-Bh, ya], [Bh, ya], ya + 0.4);
    S.bar([[-Bh + c, -eh + c], [Bh - c, -eh + c], [Bh - c, eh - c], [-Bh + c, eh - c], [-Bh + c, -eh + c]], bC.d);
    const dy = eh - c - bC.d / 1000 - d / 2000;
    S.dots(xs.map((x) => [x, dy]).concat(xs.map((x) => [x, -dy])), bL.d).rep([xs[2], dy], bL.rep, K.lab(bL), 'L').rep([Bh - c, 0], bC.rep, K.lab(bC), 'R');
    xs.filter((_, i) => i % 2 === 1).forEach((x, i) => { S.bar([[x, -eh + c], [x, eh - c]], bE.d); if (!i) S.rep([x, 0], bE.rep, K.lab(bE), 'L'); });
    return K.done([A, S], vol(R.barrette, g));
  };
  R.paroi.ferr = function (g, fp) {
    const K = Kit(fp, 0.075), c = K.c, eh = g.e / 2, ht = 3.0, gp = 0.8, yb = -ht - gp - 1.2;
    const A = base(R.paroi, g, 1, 'Coupe transversale (interrompue) — ferraillage');
    A.dimH([-g.bc / 2, g.hc], [g.bc / 2, g.hc], g.hc + 0.5);
    K.grp = 'Panneau (cage)';
    const Wc = g.Lp - 0.30, Lb = g.H + 0.6, xA = -eh + c, xB = eh - c;
    const bA = K.add({ des: 'Verticales face fouille', d: 25, esp: 0.15, ld: Wc, shape: [[0, 0], [0, Lb]] });
    const bB = K.add({ des: 'Verticales face terre', d: 20, esp: 0.15, ld: Wc, shape: [[0, 0], [0, Lb]] });
    [[-ht + 0.02, 0.6], [yb + c, yb + 1.18]].forEach(([a, b]) => { A.bar([[xA, a], [xA, b]], bA.d).bar([[xB, a], [xB, b]], bB.d); });
    A.rep([xA, -ht * 0.4], bA.rep, K.lab(bA), 'L').rep([xB, -ht * 0.55], bB.rep, K.lab(bB), 'R');
    const bH = K.add({ des: 'Horizontales (2 faces)', d: 16, esp: 0.20, ld: g.H - 0.1, ne: 2, shape: ST(Wc) });
    const hs = [[-ht + 0.08, -0.05], [yb + c + 0.08, yb + 1.15]].map(([a, b]) => row(a, b, bH.esp));
    hs.forEach((ys) => A.dots(ys.map((y) => [xA + 0.025, y]).concat(ys.map((y) => [xB - 0.025, y])), bH.d));
    A.rep([xA + 0.025, hs[0][Math.floor(hs[0].length * 0.75)]], bH.rep, K.lab(bH), 'L');
    const bR = K.add({ des: 'Raidisseurs de cage', d: 16, esp: 3.0, ld: g.H, ne: 3, shape: [[0, 0], [xB - xA, 0]] });
    A.bar([[xA, -ht * 0.75], [xB, -ht * 0.75 + 0.15]], bR.d).rep([0, -ht * 0.75 + 0.075], bR.rep, K.lab(bR), 'R');
    K.grp = 'Poutre de couronnement';
    poutre(K, null, A, { x0: 0, x1: g.Lp, h: g.hc, b: g.bc, sx: 0, sy: 0, dI: 16, dS: 20, ec: 0.20 });
    return K.done([A], g.Lp * g.e * g.H + g.Lp * g.bc * g.hc);
  };

  /* ═════════════ LONGRINE ═════════════ */
  R.longrine.ferr = function (g, fp) {
    const K = Kit(fp, 0.05), X = spread(g.np, g.ep), L = (g.np - 1) * g.ep + g.D + 2 * g.d;
    const A = overall(base(R.longrine, g, 0, 'Élévation — ferraillage')), S = new View('Coupe transversale').cut(RECT(-g.b / 2, 0, g.b, g.h));
    K.grp = 'Longrine';
    poutre(K, A, S, { x0: -L / 2, x1: L / 2, yb: 0, h: g.h, b: g.b, dI: 20, dS: 20, ec: 0.20 });
    K.grp = 'Tête de pieux';
    const bF = K.add({ des: 'Cerces de frettage', d: 14, n: 2, ne: g.np, circle: g.D + 0.10 });
    X.forEach((x) => [0.12, 0.27].forEach((y) => A.bar([[x - g.D / 2 - 0.05, y], [x + g.D / 2 + 0.05, y]], bF.d)));
    A.rep([X[X.length - 1] + g.D / 2 + 0.05, 0.27], bF.rep, K.lab(bF), 'R');
    return K.done([A, S], vol(R.longrine, g));
  };

  /* ═════════════ DALLE DE TRANSITION ═════════════ */
  R.dalleT.ferr = function (g, fp) {
    const K = Kit(fp, 0.04), c = K.c, s = g.i / 100, Lc = Math.sqrt(1 / (1 + s * s)), yc = -g.zc;
    const A = base(R.dalleT, g, 0, 'Coupe longitudinale — ferraillage'), B = overall(base(R.dalleT, g, 2, 'Coupe transversale — ferraillage'));
    const P = (t, z) => [t * Lc - z * s * Lc * 0, yc - t * s * Lc - z];          // abscisse curviligne t, profondeur z sous le dessus
    A.dim([0, yc], [g.L * Lc, yc - g.L * s * Lc], 0.6);
    K.grp = 'Dalle';
    const Ll = g.L - 2 * c, Wt = g.W - 2 * c, dI = 16, dS = 12;
    const b1 = K.add({ des: 'Nappe inf. longitudinale', d: dI, esp: 0.15, ld: Wt, shape: [[0, 0.15], [0, 0], [Ll, 0], [Ll, 0.15]] });
    A.bar([P(c, g.e - c - 0.15), P(c, g.e - c), P(g.L - c, g.e - c), P(g.L - c, g.e - c - 0.15)].map((q, i) => i === 0 || i === 3 ? [q[0], q[1] + 0.15 + 0.15] : q), b1.d).rep(P(g.L * 0.4, g.e - c), b1.rep, K.lab(b1), 'L');
    const b2 = K.add({ des: 'Nappe inf. transversale', d: 12, esp: 0.20, ld: Ll, shape: ST(Wt) });
    const p2 = row(c + 0.05, g.L - c - 0.05, b2.esp).map((t) => { const q = P(t, g.e - c - 0.014); return q; });
    A.dots(p2, b2.d).rep(near(p2, 0.7), b2.rep, K.lab(b2), 'R');
    const b3 = K.add({ des: 'Nappe sup. longitudinale', d: dS, esp: 0.20, ld: Wt, shape: ST(Ll) });
    A.bar([P(c, c), P(g.L - c, c)], b3.d).rep(P(g.L * 0.25, c), b3.rep, K.lab(b3), 'L');
    const b4 = K.add({ des: 'Nappe sup. transversale', d: 10, esp: 0.20, ld: Ll, shape: ST(Wt) });
    const p4 = row(c + 0.05, g.L - c - 0.05, b4.esp).map((t) => P(t, c + 0.012));
    A.dots(p4, b4.d).rep(near(p4, 0.85), b4.rep, K.lab(b4), 'R');
    const bG = K.add({ des: 'Goujons d\'appui (corbeau)', d: 25, esp: 0.50, ld: Wt, shape: ST(0.60) });
    A.bar([[g.lc / 2, yc - g.e - 0.25], [g.lc / 2, yc - 0.05]], bG.d).rep([g.lc / 2, yc - g.e - 0.1], bG.rep, K.lab(bG), 'L');
    // coupe transversale
    const Wh = g.W / 2;
    B.bar([[-Wh + c, c], [Wh - c, c]], b2.d).bar([[-Wh + c, g.e - c], [Wh - c, g.e - c]], b4.d);
    const q1 = row(-Wh + c + 0.04, Wh - c - 0.04, b1.esp).map((x) => [x, c + 0.016]), q3 = row(-Wh + c + 0.04, Wh - c - 0.04, b3.esp).map((x) => [x, g.e - c - 0.012]);
    B.dots(q1, b1.d).dots(q3, b3.d).rep([-Wh * 0.6, c], b2.rep, K.lab(b2)).rep([Wh * 0.6, g.e - c], b4.rep, K.lab(b4)).rep(near(q1, 0.3), b1.rep, K.lab(b1)).rep(near(q3, 0.75), b3.rep, K.lab(b3));
    return K.done([A, B], vol(R.dalleT, g));
  };

  /* ═════════════ MURS ═════════════ */
  R.murRetour.ferr = function (g, fp) {
    const K = Kit(fp, 0.05), c = K.c, A = overall(base(R.murRetour, g, 0, 'Élévation — ferraillage')), S = new View('Coupe à l\'encastrement').cut(RECT(0, -g.H, g.e, g.H));
    K.grp = 'Mur en retour';
    const v = voile(K, S, { xa: 0, xb: g.e, y0: -g.H, y1: 0, Lw: (g.Lr + g.lv) / 2 + 0.5, dV: 14, dH: 14, eH: 0.15, nmA: 'face intérieure', nmB: 'face extérieure', noEp: true });
    // armatures de suspension (tirants supérieurs) ancrées dans le garde-grève
    const bT = K.add({ des: 'Armatures de suspension (2 faces)', d: 25, n: 3, ne: 2, shape: LF(0.5, g.Lr + 0.6) .map((p) => [p[1], p[0]]) });
    [0.07, 0.17, 0.27].forEach((dy) => A.bar([[-0.6, -c - dy], [g.Lr - c, -c - dy], [g.Lr - c, -c - dy - 0.4]], bT.d));
    A.rep([g.Lr * 0.5, -c - 0.17], bT.rep, K.lab(bT), 'R');
    const ys = row(-g.H + c + 0.05, -0.35, v.bH.esp);
    ys.forEach((y) => { const xe = y < -g.hb ? g.lv + (g.Lr - g.lv) * (g.H + y) / (g.H - g.hb) : g.Lr; A.bar([[-0.3, y], [Math.min(g.Lr, xe) - c, y]], v.bH.d); });
    A.rep([0.5, ys[2]], v.bH.rep, K.lab(v.bH), 'L');
    row(c + 0.05, g.Lr - c - 0.05, v.bA.esp).forEach((x) => { const yb = x < g.lv ? -g.H : -g.H + (x - g.lv) / (g.Lr - g.lv) * (g.H - g.hb); A.bar([[x, yb + c], [x, -c]], v.bA.d); });
    A.rep([g.Lr * 0.8, -g.hb - 0.3], v.bA.rep, K.lab(v.bA), 'R');
    S.dots([0.07, 0.17, 0.27].flatMap((dy) => [[c + 0.03, -c - dy], [g.e - c - 0.03, -c - dy]]), bT.d).rep([g.e - c - 0.03, -c - 0.07], bT.rep, K.lab(bT), 'R');
    return K.done([A, S], vol(R.murRetour, g));
  };
  R.murAile.ferr = function (g, fp) {
    const K = Kit(fp, 0.05), c = K.c, A = overall(base(R.murAile, g, 1, 'Coupe transversale — ferraillage'));
    K.grp = 'Semelle'; nappes(K, A, { x0: 0, x1: g.bs, y0: 0, h: g.hs, Lp: g.La, d: 14, e: 0.15, dS: 12, eS: 0.20 });
    K.grp = 'Voile'; voile(K, A, { xa: g.p, xb: g.p + g.e, y0: g.hs, y1: g.hs + g.H1, yb: c + 0.04, Lw: g.La, nmA: 'face remblai', nmB: 'face vue', fl: 0.35, dV: 14, dH: 10 });
    return K.done([A], vol(R.murAile, g));
  };
  R.murU.ferr = function (g, fp) {
    const K = Kit(fp, 0.05), c = K.c, xi = g.Bi / 2, xo = xi + g.ev, xr = xo + g.db, top = g.er + g.Hv, A = overall(base(R.murU, g, 0, 'Coupe transversale — ferraillage'));
    K.grp = 'Radier'; nappes(K, A, { x0: -xr, x1: xr, y0: 0, h: g.er, Lp: g.L, d: up(dT(g.er)), e: 0.15 });
    K.grp = 'Voiles';
    const v1 = voile(K, A, { xa: -xo, xb: -xi, y0: g.er, y1: top, yb: c + 0.06, Lw: g.L, fl: 0.5, nmA: 'face terre', nmB: 'face chaussée', dV: up(dT(g.ev)), dV2: dT(g.ev), noEp: false });
    // voile droit : symétrique (mêmes repères)
    const xA = xi + c, xB = xo - c, yb = c + 0.06;
    A.bar([[xA, top - c], [xA, yb], [xA - 0.5, yb]], v1.bB.d).bar([[xB + 0.5, yb], [xB, yb], [xB, top - c]], v1.bA.d);
    const ys = row(g.er + 0.08, top - c - 0.03, v1.bH.esp), dx = 0.025;
    A.dots(ys.map((y) => [xA + dx, y]).concat(ys.map((y) => [xB - dx, y])), v1.bH.d);
    v1.bA.ne = 2; v1.bB.ne = 2; v1.bH.ne = 4;
    if (g.cv > 0) { const bG = K.add({ des: 'Aciers de gousset', d: 12, esp: 0.20, ld: g.L, ne: 2, shape: ST(g.cv * 1.414 + 0.8) }); A.bar([[-xi - 0.05, g.er + g.cv + 0.4], [-xi + g.cv + 0.4, g.er - 0.05]], bG.d).rep([-xi + g.cv / 2, g.er + g.cv / 2], bG.rep, K.lab(bG), 'L'); A.bar([[xi + 0.05, g.er + g.cv + 0.4], [xi - g.cv - 0.4, g.er - 0.05]], bG.d); }
    return K.done([A], vol(R.murU, g));
  };

  /* ═════════════ PIPO ═════════════ */
  R.pipo.ferr = function (g, fp) {
    const K = Kit(fp, 0.05), c = K.c, W = 2 * g.ep + g.O, x0 = -W / 2, yt = g.hs + g.Hi, top = yt + g.et, sl = x0 - g.ds, sr = -x0 + g.ds;
    const A = overall(base(R.pipo, g, 0, 'Coupe transversale — ferraillage'));
    K.grp = 'Semelles';
    const ns = nappes(K, A, { x0: sl, x1: sl + g.bs, y0: 0, h: g.hs, Lp: g.L, d: dT(g.hs), e: 0.15 });
    ns.b1.ne = ns.b2.ne = ns.b3.ne = ns.b4.ne = 2;
    const rr = Math.max(0.15, Math.min(g.hs - 2 * c, 0.9));
    A.bar([[sr - g.bs + c, c + rr], [sr - g.bs + c, c], [sr - c, c], [sr - c, c + rr]], ns.b1.d);
    A.dots(row(sr - g.bs + c + 0.05, sr - c - 0.05, ns.b2.esp).map((x) => [x, c + 0.02]), ns.b2.d);
    K.grp = 'Piédroits';
    const v = voile(K, A, { xa: x0, xb: x0 + g.ep, y0: g.hs, y1: yt, yb: c + 0.06, ytop: top - c - 0.03, Lw: g.L, fl: 0.45, nmA: 'face extérieure', nmB: 'face intérieure' });
    v.bA.ne = v.bB.ne = 2; v.bH.ne = 4;
    const xa2 = -x0 - c, xb2 = -x0 - g.ep + c;
    A.bar([[xa2 + 0.45, c + 0.06], [xa2, c + 0.06], [xa2, top - c - 0.03]], v.bA.d).bar([[xb2, yt + 0.4], [xb2, c + 0.06], [xb2 - 0.45, c + 0.06]], v.bB.d);
    const hy = row(g.hs + 0.08, yt - c - 0.03, v.bH.esp);
    A.dots(hy.map((y) => [xa2 - 0.025, y]).concat(hy.map((y) => [xb2 + 0.025, y])), v.bH.d);
    const rs = Math.min(rr, g.hs - 2 * c - 0.1);
    A.bar([[sr - g.bs + c + 0.03, g.hs - c - rs], [sr - g.bs + c + 0.03, g.hs - c], [sr - c - 0.03, g.hs - c], [sr - c - 0.03, g.hs - c - rs]], ns.b3.d);
    A.dots(row(sr - g.bs + c + 0.08, sr - c - 0.08, ns.b4.esp).map((x) => [x, g.hs - c - 0.02]), ns.b4.d);
    K.grp = 'Traverse';
    const Lt = W - 2 * c;
    const bI = K.add({ des: 'Nappe inf. traverse (transversale)', d: up(dT(g.et)), esp: 0.15, ld: g.L - 2 * c, shape: UP(g.O + 1.2, 0.3) });
    A.bar([[-g.O / 2 - 0.6, yt + c + 0.3], [-g.O / 2 - 0.6, yt + c], [g.O / 2 + 0.6, yt + c], [g.O / 2 + 0.6, yt + c + 0.3]], bI.d).rep([-g.O * 0.15, yt + c], bI.rep, K.lab(bI), 'L');
    const bS = K.add({ des: 'Nappe sup. traverse (transversale)', d: dT(g.et), esp: 0.15, ld: g.L - 2 * c, shape: DN(Lt, Math.min(1.0, g.Hi * 0.3)) });
    const rS = Math.min(1.0, g.Hi * 0.3);
    A.bar([[x0 + c + 0.03, top - c - rS], [x0 + c + 0.03, top - c], [-x0 - c - 0.03, top - c], [-x0 - c - 0.03, top - c - rS]], bS.d).rep([g.O * 0.2, top - c], bS.rep, K.lab(bS), 'R');
    const bL = K.add({ des: 'Répartition traverse (2 nappes)', d: 12, esp: 0.20, ld: Lt, ne: 2, shape: ST(g.L - 2 * c) });
    const pI = row(-g.O / 2 - 0.5, g.O / 2 + 0.5, bL.esp).map((x) => [x, yt + c + 0.022]), pS = row(x0 + c + 0.1, -x0 - c - 0.1, bL.esp).map((x) => [x, top - c - 0.022]);
    A.dots(pI, bL.d).dots(pS, bL.d).rep(near(pI, 0.75), bL.rep, K.lab(bL), 'R');
    if (g.g > 0) { const bG = K.add({ des: 'Aciers de gousset', d: 14, esp: 0.15, ld: g.L, ne: 2, shape: ST(g.g * 1.414 + 0.9) }); const gx = x0 + g.ep; A.bar([[gx - 0.35, yt - g.g - 0.45 + 0.05], [gx + g.g + 0.45, yt + 0.35]], bG.d).rep([gx + g.g / 2, yt - g.g / 2], bG.rep, K.lab(bG), 'L'); A.bar([[-gx + 0.35, yt - g.g - 0.4], [-gx - g.g - 0.45, yt + 0.35]], bG.d); }
    return K.done([A], vol(R.pipo, g));
  };

  /* ═════════════ POUTRES PRÉFABRIQUÉES ═════════════ */
  function poutreFerr(struct, vipp) {
    return function (g, fp) {
      const K = Kit(fp, 0.03), c = K.c, A = overall(base(struct, g, 0, 'Coupe à mi-travée — ferraillage')), E = base(struct, g, 2, 'Élévation (interrompue) — ferraillage');
      const a = Math.min(g.L / 2, Math.max(4, g.la + g.lt + 1.5)), gap = 0.8, X = (x) => (x <= a ? x : x - (g.L - 2 * a) + gap), Lb = g.L - 2 * c;
      E.dimH([X(0), g.hp], [X(g.L), g.hp], g.hp + 0.5, null, C.fmt(g.L));
      K.grp = 'Poutre';
      const nT = Math.max(4, Math.round((g.bta - 2 * c) / 0.07) + 1) * (vipp ? 1 : 2), dT_ = vipp ? 16 : 25;
      const bT = K.add({ des: vipp ? 'Aciers passifs du talon' : 'Aciers principaux du talon', d: dT_, n: nT, shape: vipp ? ST(Lb) : UP(Lb, 0.35) });
      const bA = K.add({ des: 'Filants de table', d: 12, n: Math.max(4, Math.round((g.bt - 2 * c) / 0.25) + 1) * 2, shape: ST(Lb) });
      const nP = Math.max(1, Math.floor((g.hp - g.hta - g.eg) / 0.25)), bP = K.add({ des: 'Aciers de peau de l\'âme', d: 10, n: nP, ne: 2, shape: ST(Lb) });
      const h1 = g.hp - 2 * c, wt = g.bta - 2 * c, w0 = g.b0 - 2 * c;
      const bE = K.add({ des: 'Étriers de l\'âme', d: vipp ? 12 : 10, esp: 0.20, ld: g.L - 0.1, shape: [[-0.12, h1], [0, h1], [0, 0], [w0, 0], [w0, h1], [w0 + 0.12, h1]] });
      const bC = K.add({ des: 'Cadres du talon', d: 10, esp: 0.20, ld: g.L - 0.1, closed: true, shape: RB(wt, g.hta - 2 * c + 0.06) });
      const bS = K.add({ des: 'Aciers transversaux de table (2 nappes)', d: 10, esp: 0.20, ld: g.L - 0.1, ne: 2, shape: ST(g.bt - 2 * c) });
      // section
      const yt = g.hp - c, ytt = g.hp - g.et + c;
      A.bar([[-g.bt / 2 + c, yt], [g.bt / 2 - c, yt]], bS.d).bar([[-g.bt / 2 + c, ytt], [g.bt / 2 - c, ytt]], bS.d);
      A.bar([[-w0 / 2 - 0.12, yt - 0.012], [-w0 / 2, yt - 0.012], [-w0 / 2, c], [w0 / 2, c], [w0 / 2, yt - 0.012], [w0 / 2 + 0.12, yt - 0.012]], bE.d);
      A.bar([[-wt / 2, c], [wt / 2, c], [wt / 2, g.hta - c + 0.06], [-wt / 2, g.hta - c + 0.06], [-wt / 2, c]], bC.d);
      const tx = row(-wt / 2 + 0.03, wt / 2 - 0.03, (wt - 0.06) / Math.max(1, (vipp ? nT : nT / 2) - 1)).slice(0, vipp ? nT : nT / 2);
      const tp = tx.map((x) => [x, c + 0.025]).concat(vipp ? [] : tx.map((x) => [x, c + 0.075]));
      A.dots(tp, bT.d).rep(near(tp, 0.2), bT.rep, K.lab(bT), 'L');
      const ax = row(-g.bt / 2 + c + 0.03, g.bt / 2 - c - 0.03, (g.bt - 2 * c - 0.06) / (bA.nu / 2 - 1)).slice(0, bA.nu / 2);
      A.dots(ax.map((x) => [x, yt - 0.016]).concat(ax.map((x) => [x, ytt + 0.016])), bA.d).rep([ax[ax.length - 2], yt - 0.016], bA.rep, K.lab(bA), 'R');
      const py = row(g.hta + g.hg, g.hp - g.eg, (g.hp - g.eg - g.hta - g.hg) / (nP + 1)).slice(1, -1);
      A.dots(py.map((y) => [-w0 / 2 + 0.014, y]).concat(py.map((y) => [w0 / 2 - 0.014, y])), bP.d).rep([w0 / 2 - 0.014, py[0] || g.hp / 2], bP.rep, K.lab(bP), 'R');
      A.rep([-w0 / 2, g.hp * 0.55], bE.rep, K.lab(bE), 'L').rep([wt / 2, g.hta * 0.5], bC.rep, K.lab(bC), 'R').rep([g.bt * 0.3, yt], bS.rep, K.lab(bS), 'R');
      // élévation
      [[0, a], [g.L - a, g.L]].forEach(([x0, x1]) => {
        const p0 = X(x0) + (x0 === 0 ? c : 0), p1 = X(x1) - (x1 === g.L ? c : 0);
        E.bar([[p0, c + 0.025], [p1, c + 0.025]], bT.d).bar([[p0, yt - 0.016], [p1, yt - 0.016]], bA.d);
        row(X(x0) + 0.05, X(x1) - 0.05, bE.esp).forEach((x) => E.bar([[x, c], [x, yt]], bE.d));
      });
      E.rep([X(a * 0.45), c + 0.025], bT.rep, K.lab(bT), 'L').rep([X(g.L - a * 0.4), yt - 0.016], bA.rep, K.lab(bA), 'R').rep([X(a * 0.7), g.hp * 0.5], bE.rep, K.lab(bE), 'L');
      E.dist([X(0) + 0.05, -0.3], [X(a) - 0.05, -0.3], 'e = ' + f2(bE.esp));
      return K.done([A, E], vol(struct, g));
    };
  }
  R.poutreVIPP.ferr = poutreFerr(R.poutreVIPP, true);
  R.poutrePPBA.ferr = poutreFerr(R.poutrePPBA, false);

  /* ═════════════ HOURDIS / ENTRETOISES ═════════════ */
  R.hourdis.ferr = function (g, fp) {
    const K = Kit(fp, 0.03), c = K.c, Wh = g.W / 2, X = spread(g.np, g.s), A = overall(base(R.hourdis, g, 0, 'Coupe transversale — ferraillage'), true, false);
    K.grp = 'Hourdis';
    const n = nappes(K, A, { x0: -Wh, x1: Wh, y0: g.hp, h: g.e, Lp: g.Lv, d: g.e >= 0.22 ? 14 : 12, e: 0.15, dS: 12, eS: 0.15, ret: g.e - 2 * c - 0.02, nm: '' });
    n.b1.des = 'Nappe inf. transversale'; n.b2.des = 'Nappe inf. longitudinale'; n.b3.des = 'Nappe sup. transversale'; n.b4.des = 'Nappe sup. longitudinale';
    const bC = K.add({ des: 'Chapeaux sur poutres', d: 12, esp: 0.15, ld: g.Lv - 2 * c, ne: g.np, shape: ST(g.bt + 0.8) });
    X.forEach((x, i) => { A.bar([[x - g.bt / 2 - 0.4, g.hp + g.e - c - 0.03], [x + g.bt / 2 + 0.4, g.hp + g.e - c - 0.03]], bC.d); if (i === 1) A.rep([x + g.bt / 2 + 0.3, g.hp + g.e - c - 0.03], bC.rep, K.lab(bC), 'R'); });
    return K.done([A], g.W * g.e * g.Lv);
  };
  R.entretoises.ferr = function (g, fp) {
    const K = Kit(fp, 0.04), c = K.c, X = spread(g.np, g.s), A = overall(base(R.entretoises, g, 0, 'Coupe au droit de l\'entretoise — ferraillage'), true, false);
    const S = new View('Coupe A-A').cut(RECT(-g.ee / 2, g.zb, g.ee, g.he));
    K.grp = 'Entretoise';
    const x0 = X[0] + g.b0 / 2, x1 = X[1] - g.b0 / 2;
    const r = poutre(K, A, S, { x0: x0 - 0.30, x1: x1 + 0.30, yb: g.zb, h: g.he, b: g.ee, sx: 0, sy: g.zb, dI: 20, dS: 16, nI: 3, nS: 3, ec: 0.20, dc: 10 });
    r.bI.ne = r.bS.ne = r.bC.ne = g.np - 1;
    for (let i = 1; i + 1 < X.length; i++) { const a = X[i] + g.b0 / 2 - 0.3, b = X[i + 1] - g.b0 / 2 + 0.3; A.bar([[a, g.zb + c], [b, g.zb + c]], r.bI.d).bar([[a, g.zb + g.he - c], [b, g.zb + g.he - c]], r.bS.d); }
    return K.done([A, S], vol(R.entretoises, g));
  };

  /* ═════════════ CORNICHE ═════════════ */
  R.corniche.ferr = function (g, fp) {
    const K = Kit(fp, 0.03), c = K.c, A = base(R.corniche, g, 0, 'Coupe type — ferraillage');
    A.dimV([0, 0], [0, g.H], -g.B - g.fg - 0.25);
    K.grp = 'Corniche';
    const pts = [[-c, c + 0.02], [-c, g.H - c], [-g.B + c, g.H - c], [-g.B - g.fg * 0.6 + c, g.H / 2], [-g.bb + c, c + 0.02]];
    const bC = K.add({ des: 'Cadres', d: 8, esp: 0.20, ld: g.Le - 2 * c, closed: true, shape: pts.map((p) => [p[0] + g.B + g.fg, p[1]]) });
    A.bar(pts.concat([pts[0]]), bC.d).rep(pts[3], bC.rep, K.lab(bC), 'L');
    const fl = [[-c - 0.012, g.H - c - 0.012], [-g.B + c + 0.012, g.H - c - 0.012], [-c - 0.012, c + 0.035], [-g.bb + c + 0.015, c + 0.035], [-g.B - g.fg * 0.6 + c + 0.016, g.H / 2]];
    const bF = K.add({ des: 'Filants', d: 10, n: fl.length, shape: ST(g.Le - 2 * c) });
    A.dots(fl, bF.d).rep(fl[1], bF.rep, K.lab(bF), 'L');
    const bL = K.add({ des: 'Aciers de liaison (attentes)', d: 10, esp: 0.20, ld: g.Le - 2 * c, shape: [[0, 0.25], [0, 0], [0.65, 0], [0.65, -0.15]] });
    const yd = g.H - g.hl;
    A.bar([[-c - 0.02, g.H - c - 0.28], [-c - 0.02, g.H - c - 0.04], [0.62, g.H - c - 0.04], [0.62, yd - 0.12]], bL.d).rep([0.35, g.H - c - 0.04], bL.rep, K.lab(bL), 'R');
    return K.done([A], vol(R.corniche, g));
  };

  /* ═════════════ TÊTE D'OUVRAGE HYDRAULIQUE ═════════════ */
  R.teteOH.ferr = function (g, fp) {
    const K = Kit(fp, 0.04), c = K.c, a = g.alpha * Math.PI / 180, Yd = -g.La * Math.cos(a), R2 = g.D / 2 + g.eb, B = spread(g.nb, g.sb), Lh = g.Lm / 2, X = Lh + g.La * Math.sin(a);
    const A = overall(base(R.teteOH, g, 2, 'Coupe dans l\'axe d\'une buse — ferraillage')), E = overall(base(R.teteOH, g, 1, 'Élévation face aval — ferraillage'));
    K.grp = 'Radier';
    const W = (2 * X + g.Lm) / 2;
    nappes(K, A, { x0: Yd, x1: g.em, y0: -g.hr, h: g.hr, Lp: W, d: 12, e: 0.20, dS: 10, eS: 0.20, ret: g.hr - 2 * c - 0.02 });
    if (g.hpf > 0) { const bP = K.add({ des: 'Parafouille (cadres)', d: 10, esp: 0.20, ld: 2 * X - 2 * c, closed: true, shape: RB(g.epf - 2 * c, g.hpf + g.hr - 2 * c) }); A.bar([[Yd + c, -g.hr - g.hpf + c], [Yd + g.epf - c, -g.hr - g.hpf + c], [Yd + g.epf - c, -c], [Yd + c, -c], [Yd + c, -g.hr - g.hpf + c]], bP.d).rep([Yd + c, -g.hr - g.hpf / 2], bP.rep, K.lab(bP), 'L'); }
    K.grp = 'Mur de tête';
    const v = voile(K, A, { xa: 0, xb: g.em, y0: 2 * R2, y1: g.Hm, yb: 2 * R2 + c, Lw: g.Lm, fl: 0, dV: 12, dH: 10, eH: 0.20, nmA: 'face aval', nmB: 'face amont', noEp: true });
    const bO = K.add({ des: 'Cerces de renfort autour des buses', d: 12, n: 2, ne: g.nb, circle: 2 * R2 + 0.16 });
    B.forEach((x, i) => { E.bar(CIRC(x, R2, R2 + 0.08, 48).concat([[x + R2 + 0.08, R2]]), bO.d); if (!i) E.rep([x - (R2 + 0.08) * 0.7, R2 + (R2 + 0.08) * 0.7], bO.rep, K.lab(bO), 'L'); });
    const ys = row(0.08, g.Hm - c, v.bH.esp);
    ys.forEach((y) => { if (y > 2 * R2 + 0.1) E.bar([[-Lh + c, y], [Lh - c, y]], v.bH.d); });
    E.rep([Lh * 0.6, ys[ys.length - 1]], v.bH.rep, K.lab(v.bH), 'R');
    K.grp = 'Ailes';
    const bW = K.add({ des: 'Ailes : verticales (2 faces)', d: 10, esp: 0.20, ld: g.La, ne: 4, shape: LF(0.3, (g.Hm + g.ha) / 2 + g.hr) });
    const bWh = K.add({ des: 'Ailes : horizontales (2 faces)', d: 10, esp: 0.20, ld: (g.Hm + g.ha) / 2, ne: 4, shape: ST(g.La + 0.4) });
    row(Lh + 0.1, X - c, bW.esp).forEach((x) => E.bar([[x, -g.hr + c], [x, g.Hm - (x - Lh) / (X - Lh) * (g.Hm - g.ha) - c]], bW.d));
    E.rep([X - 0.2, g.ha * 0.5], bW.rep, K.lab(bW), 'R').rep([Lh + 0.3, g.ha * 0.7], bWh.rep, K.lab(bWh), 'R');
    return K.done([A, E], vol(R.teteOH, g));
  };
})(typeof window !== 'undefined' ? window : globalThis);
