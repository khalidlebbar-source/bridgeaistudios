/* EPREUVES — carnet d'épreuves de chargement des ponts-routes et ponts-rails (moteur pur, aucun DOM).
 *
 * Références appliquées :
 *  - Fascicule 61 titre II (ponts-routes) : système A(l) (art. 4 : A(l) = 2,30 + 360/(L+12) kN/m², a1, a2 = v0/v),
 *    système B (art. 5 : Bc avec coefficient bc, Bt avec coefficient bt), charges militaires Mc80 / Mc120.
 *    Les charges réglementaires sont prises NON pondérées et SANS majoration dynamique δ : c'est l'usage pour
 *    juger l'intensité d'une épreuve statique (cf. notes d'épreuves KLE et guide technique SETRA « Épreuves de
 *    chargement des ponts-routes et passerelles piétonnes », 2004).
 *  - Ponts-rails (Livret 2.01, EN 1991-2) : UIC 71 × α (§6.3.2), SW/0 × α pour les travées continues (§6.3.3),
 *    coefficient dynamique Φ2 ou Φ3 (§6.4.5.2) avec LΦ du tableau 6.2 (cas 5.1 : poutres continues
 *    LΦ = k·Lm ≥ max Li, k = 1,2 / 1,3 / 1,4 / 1,5 pour 2 / 3 / 4 / ≥ 5 travées).
 *  - Intensité visée : effet d'épreuve compris entre ηmin = 2/3 et ηmax = 1 de l'effet réglementaire (valeurs par
 *    défaut, modifiables : à fixer par le marché).
 *  - Module instantané du béton : BAEL 91 mod. 99 art. A.2.1.21 Eij = 11 000·fcj^(1/3) MPa, ou EN 1992-1-1
 *    tableau 3.1 Ecm = 22 000·((fck+8)/10)^0,3 MPa, ou valeur saisie.
 *  - Répartition transversale : modèle global (tablier entier), coefficient saisi, ou Courbon (entretoisement
 *    infiniment rigide) Ki = 1 + n·ē·yi / Σyj².
 *  - Biais : prise en compte simplifiée — calcul en poutre selon l'axe avec les portées biaises (toutes les fibres
 *    longitudinales d'un tablier en parallélogramme ont la même longueur) ; le biais n'intervient que dans le dessin
 *    et dans un avertissement au-delà de 70–130 gr (le modèle poutre surestime alors moments et flèches de travée).
 *
 * Méthode : modèle plan (BA.portique) ; lignes d'influence des moments par Müller-Breslau (courbure imposée sur un
 * élément de longueur L/20 000 accolé à la section, calibrée par un calcul direct) ; position longitudinale optimale
 * des véhicules par balayage de la ligne d'influence (pas 5 cm, deux sens, écartement entre véhicules optimisé) ;
 * flèches, rotations et réactions par calcul direct sous les essieux d'épreuve.
 * Unités : kN, m ; E en MPa en entrée (kPa dans le solveur) ; masses des essieux en t converties par g (kN/t).
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  const PQ = isNode ? require('./portique.js') : root.BA.portique;
  const CH = isNode ? require('./charges.js') : root.BA.charges;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fin = (v, d) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : d);

  /* ── module instantané du béton (MPa) ── */
  function Ei(b = {}) {
    const fc = fin(b.fc, 30);
    if (b.mode === 'saisi') return fin(b.E, 34000);
    if (b.mode === 'ec2') return 22000 * Math.pow((fc + 8) / 10, 0.3);   // EN 1992-1-1 tab. 3.1 (fcm = fck + 8)
    return 11000 * Math.cbrt(fc);                                          // BAEL A.2.1.21
  }

  /* ── bibliothèque de véhicules d'épreuve (valeurs indicatives : remplacer par la fiche et les bons de pesée) ──
   * essieux : d (m) depuis le premier essieu, t (tonnes) ; av, ar : porte-à-faux avant / arrière (m) ;
   * voie : entraxe des roues (m) ; larg : largeur hors tout (m). */
  const VEHICULES = {
    c64_32: { nom: 'Camion 6×4 – 32 t', type: 'route', essieux: [{ d: 0, t: 8 }, { d: 3.80, t: 12 }, { d: 5.15, t: 12 }], av: 1.45, ar: 1.55, voie: 2.00, larg: 2.50 },
    c64_26: { nom: 'Camion 6×4 – 26 t', type: 'route', essieux: [{ d: 0, t: 7 }, { d: 3.80, t: 9.5 }, { d: 5.15, t: 9.5 }], av: 1.45, ar: 1.55, voie: 2.00, larg: 2.50 },
    c84_32: { nom: 'Camion 8×4 – 32 t', type: 'route', essieux: [{ d: 0, t: 6.5 }, { d: 1.80, t: 6.5 }, { d: 4.95, t: 9.5 }, { d: 6.30, t: 9.5 }], av: 1.40, ar: 1.30, voie: 2.00, larg: 2.50 },
    c84_299: { nom: 'Camion 8×4 – 29,9 t (pesée)', type: 'route', essieux: [{ d: 0, t: 5.75 }, { d: 1.795, t: 5.75 }, { d: 4.775, t: 9.2 }, { d: 6.175, t: 9.2 }], av: 1.007, ar: 1.25, voie: 2.00, larg: 2.50 },
    bc30: { nom: 'Camion type Bc – 30 t', type: 'route', essieux: [{ d: 0, t: 6 }, { d: 4.50, t: 12 }, { d: 6.00, t: 12 }], av: 1.0, ar: 1.0, voie: 2.00, larg: 2.50 },
    bb: { nom: 'Locomotive BB (à saisir)', type: 'rail', essieux: [{ d: 0, t: 22 }, { d: 2.80, t: 22 }, { d: 10.40, t: 22 }, { d: 13.20, t: 22 }], av: 2.80, ar: 2.80, voie: 1.435, larg: 3.00 },
    cc: { nom: 'Locomotive CC (à saisir)', type: 'rail', essieux: [{ d: 0, t: 20 }, { d: 1.75, t: 20 }, { d: 3.50, t: 20 }, { d: 11.00, t: 20 }, { d: 12.75, t: 20 }, { d: 14.50, t: 20 }], av: 2.60, ar: 2.60, voie: 1.435, larg: 3.00 },
  };

  function vehicule(v, g = 9.81) {
    const ax = (v.essieux || []).filter((a) => Number.isFinite(+a.d) && Number.isFinite(+a.t) && +a.t > 0)
      .map((a) => ({ d: +a.d, P: +a.t * g })).sort((a, b) => a.d - b.d);
    if (!ax.length) throw new Error('Véhicule d’épreuve : aucun essieu valide.');
    const d0 = ax[0].d; ax.forEach((a) => (a.d -= d0));
    const len = ax[ax.length - 1].d;
    return { nom: v.nom || 'Véhicule', ax, len, av: fin(v.av, 1), ar: fin(v.ar, 1), voie: fin(v.voie, 2), larg: fin(v.larg, 2.5),
      W: ax.reduce((s, a) => s + a.P, 0), Lht: fin(v.av, 1) + len + fin(v.ar, 1) };
  }

  /* ── loi d'inertie dans une travée : hauteur équivalente h = I^(1/3) parabolique (Ig, Im, Id) ── */
  function inertie(t, xi) {
    const hg = Math.cbrt(t.Ig), hm = Math.cbrt(fin(t.Im, t.Ig)), hd = Math.cbrt(fin(t.Id, t.Ig));
    const h = hg * (1 - xi) * (1 - 2 * xi) + 4 * hm * xi * (1 - xi) + hd * xi * (2 * xi - 1);
    return Math.pow(Math.max(h, 1e-6), 3);
  }

  /* ── construction du modèle plan ──
   * o.type : 'poutre' (appuis simples), 'portique' (piles / piédroits encastrés dans le tablier), 'cadre'
   * (portique fermé par un radier sur sol élastique). xreq : abscisses globales à mailler ; kinks : [x0, x1]. */
  function modele(o, xreq = [], kinks = []) {
    const T = o.travees, nT = T.length, E = Ei(o.beton) * 1000, A = fin(o.A, 5);
    const X0 = [0]; T.forEach((t, i) => X0.push(X0[i] + t.L));
    const Ltot = X0[nT];
    const nseg = o.nseg || clamp(Math.round(240 / nT), 6, 20);
    const xs = [];
    for (let t = 0; t < nT; t++) for (let k = 0; k <= nseg; k++) xs.push(X0[t] + T[t].L * k / nseg);
    xreq.forEach((x) => xs.push(clamp(x, 0, Ltot)));
    kinks.forEach(([a, b]) => { xs.push(a); xs.push(b); });
    xs.sort((a, b) => a - b);
    const X = [];
    for (const x of xs) if (!X.length || x - X[X.length - 1] > 1e-7 * Math.max(1, Ltot)) X.push(x);
    // recaler exactement les appuis
    const supNode = X0.map((x) => { let b = 0; X.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(X[b] - x)) b = i; }); X[b] = x; return b; });
    const nodes = X.map((x) => ({ x, y: 0 })), elems = [], supports = [], meta = [];
    const spanOf = (x) => { for (let t = 0; t < nT; t++) if (x <= X0[t + 1] + 1e-9) return t; return nT - 1; };
    for (let i = 0; i < X.length - 1; i++) {
      const xm = (X[i] + X[i + 1]) / 2, t = spanOf(xm);
      elems.push({ i, j: i + 1, E, A, I: inertie(T[t], (xm - X0[t]) / T[t].L), deck: true, travee: t });
    }
    const nDeckEl = elems.length;
    const ap = o.appuis || [];
    if (o.type === 'portique') {
      let ux = false;
      supNode.forEach((n, j) => {
        const a = ap[j] || {}, H = fin(a.H, 0);
        if (H > 0) {
          nodes.push({ x: X[n], y: -H });
          const nb = nodes.length - 1;
          elems.push({ i: nb, j: n, E, A: fin(a.Ap, 2), I: fin(a.I, 0.5), pile: j });
          supports.push({ n: nb, ux: true, uy: true, rz: a.pied !== 'articule' }); meta.push({ appui: j, base: true }); ux = true;
        } else { supports.push({ n, ux: false, uy: true }); meta.push({ appui: j }); }
      });
      if (!ux) supports[0].ux = true;
    } else if (o.type === 'cadre') {
      const c = o.cadre || {}, H = fin(c.H, 4), ks = fin(c.ks, 30000), B = fin(c.B, 10), Ir = fin(c.Ir, fin(T[0].Ig, 0.1));
      const base = [];
      for (let k = 0; k < X.length; k++) { nodes.push({ x: X[k], y: -H }); base.push(nodes.length - 1); }
      for (let k = 0; k < X.length - 1; k++) elems.push({ i: base[k], j: base[k + 1], E, A: fin(c.Ar, A), I: Ir, radier: true });
      supNode.forEach((n, j) => { const a = ap[j] || {}; elems.push({ i: base[n], j: n, E, A: fin(a.Ap, 2), I: fin(a.I, 0.1), pile: j }); });
      for (let k = 0; k < X.length; k++) {
        const trib = ((k > 0 ? X[k] - X[k - 1] : 0) + (k < X.length - 1 ? X[k + 1] - X[k] : 0)) / 2;
        supports.push({ n: base[k], ux: k === 0, uy: ks * B * trib }); meta.push({ sol: true });
      }
    } else {
      supNode.forEach((n, j) => { supports.push({ n, ux: j === 0, uy: true }); meta.push({ appui: j }); });
    }
    return { nodes, elems, supports, meta, X, X0, Ltot, supNode, nDeckEl, nT };
  }

  /* élément de tablier contenant x (le plus à gauche si x est un nœud, sauf x = 0) */
  function elemAt(m, x) {
    const X = m.X;
    let lo = 0, hi = X.length - 2;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (X[mid + 1] < x - 1e-9) lo = mid + 1; else hi = mid; }
    return lo;
  }
  const nodeAt = (m, x) => { let b = 0; m.X.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(m.X[b] - x)) b = i; }); return b; };

  const KF = 1000;   // demi-longueur de la zone de courbure imposée = L/(2·KF)
  /* Müller-Breslau discret : une courbure κ imposée sur [x−l/2, x+l/2] produit (Maxwell-Betti) la déformée
   * v(y) = κ·∫M_y dx = κ·l·M_y(x) exactement tant que la charge unité y est hors de cette zone (M_y linéaire par
   * morceaux, nœud au point x) ; la constante est calibrée par un calcul direct. */

  /* ── ligne d'influence du moment de la section s (Müller-Breslau), échantillonnée à pas constant ──
   * s : {x (global), kink:[a,b], ek (élément), xloc}, fenêtre [xa, xb]. */
  function ligneInfluence(m, prep, s, xa, xb, dx = 0.05) {
    const r = prep.run({ strain: s.kels.map((e) => ({ e, kappa: 1 })) });
    const uy = m.X.map((_, i) => r.U[3 * i + 1]), rz = m.X.map((_, i) => r.U[3 * i + 2]);
    // nœud de calibrage : plus grande déformée hors de la zone de courbure (où l'identité de Maxwell-Betti est exacte)
    const inK = (i) => m.X[i] > s.kink[0] + 1e-9 && m.X[i] < s.kink[1] - 1e-9 || (i === s.node);
    let nmax = -1; uy.forEach((v, i) => { if (i < m.X.length && !inK(i) && (nmax < 0 || Math.abs(v) > Math.abs(uy[nmax]))) nmax = i; });
    const d = prep.run({ nodal: [{ n: nmax, Fy: -1 }] });
    const Md = d.at(s.ek, s.xloc).M;
    const c = Math.abs(uy[nmax]) > 1e-300 ? Md / uy[nmax] : 0;
    const n = Math.max(2, Math.ceil((xb - xa) / dx)), h = (xb - xa) / n;
    const iL = m.X.findIndex((v) => Math.abs(v - s.kink[0]) < 1e-9), iR = m.X.findIndex((v) => Math.abs(v - s.kink[1]) < 1e-9);
    const xs = [], ys = [];
    let e = 0;
    for (let k = 0; k <= n; k++) {
      const x = xa + k * h;
      while (e < m.X.length - 2 && m.X[e + 1] < x) e++;
      const x1 = m.X[e], x2 = m.X[e + 1], L = x2 - x1, t = clamp((x - x1) / L, 0, 1);
      const t2 = t * t, t3 = t2 * t;
      let v = (2 * t3 - 3 * t2 + 1) * uy[e] + (t3 - 2 * t2 + t) * L * rz[e] + (-2 * t3 + 3 * t2) * uy[e + 1] + (t3 - t2) * L * rz[e + 1];
      // dans la zone de courbure, la ligne d'influence exacte est affine de part et d'autre de la section : prolongement
      // des tangentes exactes aux bords de la zone
      if (x > s.kink[0] && x < s.kink[1] && iL >= 0 && iR >= 0) v = x <= s.x ? uy[iL] + rz[iL] * (x - m.X[iL]) : uy[iR] + rz[iR] * (x - m.X[iR]);
      xs.push(x); ys.push(c * v);
    }
    return CH.mkLI(xs, ys);
  }

  /* ── position optimale d'un train de nL véhicules identiques (même sens) ──
   * sign = +1 maximise, −1 minimise ; écartement libre g entre véhicules (pare-chocs) dans [gmin, gmax].
   * Renvoie val (effet d'une file), x (abscisse du 1er essieu du véhicule de tête), sens, g, axles [{x, P}]. */
  function train(li, veh, nL, sign, gmin = 0, gmax = 0, h = 0.05) {
    const pitch0 = veh.len + veh.av + veh.ar;
    const gm = Math.max(0, gmin), gM = Math.max(gm, gmax);
    const ng = nL > 1 ? Math.min(200, Math.max(1, Math.round((gM - gm) / 0.25))) : 0;
    const span = veh.len + (nL - 1) * (pitch0 + gM);
    const xa = li.x0 - span - h, xb = li.xn + span + h, nx = Math.ceil((xb - xa) / h);
    let best = { val: -Infinity };
    for (const sens of [1, -1]) {
      const S = new Float64Array(nx + 1);
      for (let j = 0; j <= nx; j++) { const x = xa + j * h; let e = 0; for (const a of veh.ax) e += a.P * li.at(x - sens * a.d); S[j] = e; }
      const Sat = (x) => { const t = (x - xa) / h; if (t <= 0 || t >= nx) return 0; const j = Math.floor(t), r = t - j; return S[j] + (S[j + 1] - S[j]) * r; };
      for (let ig = 0; ig <= ng; ig++) {
        const g = ng ? gm + (gM - gm) * ig / ng : gm, pitch = pitch0 + g;
        for (let j = 0; j <= nx; j++) {
          const x = xa + j * h; let e = S[j];
          for (let k = 1; k < nL; k++) e += Sat(x - sens * k * pitch);
          if (sign * e > best.val) best = { val: sign * e, x, sens, g, pitch };
        }
      }
    }
    const axles = [];
    for (let k = 0; k < nL; k++) for (const a of veh.ax) axles.push({ x: best.x - best.sens * (a.d + k * best.pitch), P: a.P, veh: k });
    return { val: sign * best.val, x: best.x, sens: best.sens, g: nL > 1 ? best.g : null, axles };
  }

  /* ── effet réglementaire de comparaison (même signe que l'épreuve) ── */
  function nVoiesF61(Lc) { return Lc >= 6 ? Math.floor(Lc / 3) : Lc >= 5 ? 2 : 1; }   // Fasc. 61 II art. 2
  const BC_VEH = { ax: CH.CONVOIS.BcCamion.map((a) => ({ d: a.d, P: a.P })), len: 6, av: 0, ar: 0 };
  function reglementaire(li, o, sign, ctx) {
    const pick = (r) => (sign > 0 ? Math.max(0, r.max) : Math.min(0, r.min));
    const det = {};
    if (o.usage === 'rail') {
      const R = o.rail || {}, al = fin(R.alpha, 1), nv = Math.max(1, fin(R.nVoies, 1));
      const phi = R.phi === 'aucun' ? 1 : R.phi === 'phi3' ? CH.phi3(ctx.Lphi) : CH.phi2(ctx.Lphi);
      det.UIC71 = nv * phi * pick(CH.uic71(li, al));
      if (R.SW0 !== false && ctx.nT > 1) det['SW/0'] = nv * phi * pick(CH.swModel(li, 'SW/0', al));
      ctx.phi = phi;
    } else {
      const Rt = o.route || {}, cl = fin(Rt.classe, 1), Lc = fin(Rt.Lc, 7), Nv = nVoiesF61(Lc), v = Lc / Nv, a2 = CH.v0F61(cl) / v;
      const mod = Rt.modeles || { AL: true, Bc: true, Bt: true };
      if (mod.AL) { let b = 0; for (let k = 1; k <= Nv; k++) { const e = pick(CH.AL(li, k * v, CH.a1F61(cl, k), a2)); if (sign * e > sign * b) b = e; } det['A(l)'] = b; }
      if (mod.Bc) {
        const t1 = train(li, BC_VEH, 1, sign).val, t2 = train(li, BC_VEH, 2, sign, 4.5, Math.max(4.5, 1.5 * ctx.Lmax)).val;
        const file = sign * t2 > sign * t1 ? t2 : t1;
        let b = 0; for (let k = 1; k <= Nv; k++) { const e = k * CH.bcF61(cl, k) * file; if (sign * e > sign * b) b = e; }
        det.Bc = b;
      }
      if (mod.Bt && cl <= 2) det.Bt = Math.min(Nv, 2) * CH.btF61(cl) * pick(CH.convoi(li, CH.CONVOIS.Bt));
      if (mod.Mc80) det.Mc80 = pick(CH.chenille(li, 'Mc80'));
      if (mod.Mc120) det.Mc120 = pick(CH.chenille(li, 'Mc120'));
      ctx.Nv = Nv; ctx.v = v; ctx.a2 = a2;
    }
    let gouv = null, val = 0;
    for (const k in det) if (sign * det[k] > sign * val) { val = det[k]; gouv = k; }
    return { val, gouv, det };
  }

  /* ── répartition transversale ── */
  function courbon(n, b, ecc) {
    const y = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * b);
    const S = y.reduce((s, v) => s + v * v, 0);
    const e = ecc.length ? ecc.reduce((s, v) => s + v, 0) / ecc.length : 0;
    return { y, K: y.map((yi) => (S > 0 ? 1 + n * e * yi / S : 1)), e };
  }
  function filesMax(o, veh) {
    if (o.usage === 'rail') return Math.max(1, ((o.rail || {}).ecc || [0]).length);
    const R = o.route || {}, Lc = fin(R.Lc, 7), mg = fin(R.marge, 0.5), ef = fin(R.entraxe, 3);
    return Math.max(1, Math.floor((Lc - 2 * mg - veh.larg) / ef + 1e-9) + 1);
  }
  function positionsTransv(o, veh, nF) {
    if (o.usage === 'rail') { const e = (o.rail || {}).ecc || [0]; return e.slice(0, nF).map(Number); }
    const R = o.route || {}, Lc = fin(R.Lc, 7), mg = fin(R.marge, 0.5), ef = fin(R.entraxe, 3);
    if (R.position === 'centre') return Array.from({ length: nF }, (_, f) => (f - (nF - 1) / 2) * ef);
    return Array.from({ length: nF }, (_, f) => -Lc / 2 + mg + veh.larg / 2 + f * ef);
  }

  /* LΦ (EN 1991-2 tab. 6.2, cas 1 et 5.1) */
  function Lphi(o) {
    const L = o.travees.map((t) => t.L), n = L.length, Lm = L.reduce((a, b) => a + b, 0) / n;
    if (n === 1) return L[0];
    const k = n === 2 ? 1.2 : n === 3 ? 1.3 : n === 4 ? 1.4 : 1.5;
    return Math.max(k * Lm, Math.max(...L));
  }

  /* ── calcul complet ── */
  function calcul(o) {
    const av = [];
    const T = (o.travees || []).filter((t) => t && +t.L > 0).map((t) => ({ L: +t.L, Ig: fin(t.Ig, NaN), Im: fin(t.Im, NaN), Id: fin(t.Id, NaN) }));
    if (T.length < 1 || T.length > 30) throw new Error('Le nombre de travées doit être compris entre 1 et 30.');
    T.forEach((t, i) => { if (!(t.Ig > 0)) throw new Error('Inertie de la travée ' + (i + 1) + ' non valide.'); if (!(t.Im > 0)) t.Im = t.Ig; if (!(t.Id > 0)) t.Id = t.Ig; });
    const biais = fin(o.biais, 100);
    if (biais < 30 || biais > 170) throw new Error('Le biais doit être compris entre 30 et 170 grades.');
    if (biais < 70 || biais > 130) av.push('Biais prononcé (' + biais + ' gr) : le modèle poutre en portées biaises surestime les moments et flèches de travée ; un calcul en plaque est recommandé pour affiner les flèches attendues.');
    const O = Object.assign({}, o, { travees: T, type: o.type || 'poutre', usage: o.usage || 'route' });
    const g = fin(o.g, 9.81);
    O.g = g;
    const veh = vehicule(o.vehicule || VEHICULES.c64_32, g);
    const nT = T.length, X0 = [0]; T.forEach((t, i) => X0.push(X0[i] + t.L));
    const Lmax = Math.max(...T.map((t) => t.L));
    const cible = { min: fin((o.cible || {}).min, 2 / 3), max: fin((o.cible || {}).max, 1) };
    const tr = o.transv || { mode: 'global' };
    const mes = Object.assign({ tolSup: 0.15, tolInf: 0.30, rem: 0.10, prec: 0.5 }, o.mesures || {});
    const cv = o.convoi || {};
    const gmin = fin(cv.gmin, o.usage === 'rail' ? 0 : 1), gmax = fin(cv.gmax, o.usage === 'rail' ? 0 : Lmax);
    const nLmax = clamp(fin(cv.nLmax, o.usage === 'rail' ? 2 : 4), 1, 6);

    // sections à éprouver
    const secs = (o.sections || []).map((s) => {
      const type = s.type === 'appui' ? 'appui' : 'travee', k = Math.round(fin(s.k, 1));
      let x, kink, span;
      if (type === 'appui') {
        if (k < 0 || k > nT) throw new Error('Appui ' + k + ' inexistant (0 à ' + nT + ').');
        if (O.type === 'poutre' && (k === 0 || k === nT)) throw new Error('Appui de rive ' + k + ' : moment nul sur appui simple, section sans objet.');
        x = X0[k];
        const l = Math.min(T[Math.max(0, k - 1)].L, T[Math.min(nT - 1, k)].L) / KF;
        kink = [Math.max(0, x - l / 2), Math.min(X0[nT], x + l / 2)]; span = k === 0 ? 0 : k - 1;
      } else {
        if (k < 1 || k > nT) throw new Error('Travée ' + k + ' inexistante (1 à ' + nT + ').');
        const xi = clamp(fin(s.xi, 0.5), 0.02, 0.98), L = T[k - 1].L, l = L / KF;
        x = X0[k - 1] + xi * L; kink = [x - l / 2, x + l / 2]; span = k - 1;
      }
      return { type, k, xi: type === 'travee' ? clamp(fin(s.xi, 0.5), 0.02, 0.98) : null, x, kink, span, nF: Math.round(fin(s.nF, 0)), nL: Math.round(fin(s.nL, 0)), Kep: fin(s.Kep, 1), Kreg: fin(s.Kreg, 0), nom: s.nom };
    });
    if (!secs.length) throw new Error('Aucune section à éprouver.');

    // points de mesure : milieux de travées (+ quarts si demandé)
    const pts = [];
    for (let t = 0; t < nT; t++) { const fr = mes.quarts ? [0.25, 0.5, 0.75] : [0.5]; fr.forEach((xi) => pts.push({ t, xi, x: X0[t] + xi * T[t].L })); }
    const xreq = pts.map((p) => p.x).concat(secs.map((s) => s.x));
    const m = modele(O, xreq, secs.map((s) => s.kink));
    secs.forEach((s) => {
      const n = nodeAt(m, s.x);
      s.kels = []; for (let e = 0; e < m.nDeckEl; e++) if (m.X[e] >= s.kink[0] - 1e-9 && m.X[e + 1] <= s.kink[1] + 1e-9) s.kels.push(e);
      s.node = n;
      if (n > 0) { s.ek = n - 1; s.xloc = m.X[n] - m.X[n - 1]; } else { s.ek = 0; s.xloc = 0; }
    });
    pts.forEach((p) => (p.n = nodeAt(m, p.x)));
    const prep = PQ.prepare(m);
    const ctx = { nT, Lmax, Lphi: fin((o.rail || {}).Lphi, 0) > 0 ? +o.rail.Lphi : Lphi(O) };
    const nFmax = filesMax(O, veh);
    const W = 5;

    const cas = secs.map((s, ic) => {
      const sign = s.type === 'appui' ? -1 : 1;
      const tA = Math.max(0, s.span - W - (s.type === 'appui' ? 1 : 0)), tB = Math.min(nT, s.span + W + 1);
      const li = ligneInfluence(m, prep, s, X0[tA], X0[tB]);
      const reg = reglementaire(li, O, sign, ctx);
      // effet d'une file pour nL = 1..nLmax
      const trains = [];
      for (let nL = 1; nL <= nLmax; nL++) trains.push(train(li, veh, nL, sign, gmin, gmax));
      const Kof = (nF) => {
        if (tr.mode === 'courbon') { const c = courbon(Math.max(2, fin(tr.n, 4)), fin(tr.b, 2.5), positionsTransv(O, veh, nF)); return Math.max(...c.K); }
        if (tr.mode === 'saisi') return s.Kep > 0 ? s.Kep : 1;
        return 1;
      };
      const Kreg = (nF) => (tr.mode === 'global' ? 1 : s.Kreg > 0 ? s.Kreg : Kof(nF));
      const eta = (nF, nL) => (reg.val ? nF * trains[nL - 1].val / reg.val * Kof(nF) / Kreg(nF) : 0);
      let nF = s.nF, nL = s.nL, auto = false;
      if (!(nF >= 1) || !(nL >= 1)) {
        auto = true;
        const cand = [];
        for (let f = (s.nF >= 1 ? s.nF : 1); f <= (s.nF >= 1 ? s.nF : nFmax); f++) for (let l = (s.nL >= 1 ? s.nL : 1); l <= (s.nL >= 1 ? s.nL : nLmax); l++) cand.push({ f, l, e: eta(f, l), n: f * l });
        const okc = cand.filter((c) => c.e >= cible.min && c.e <= cible.max).sort((a, b) => a.n - b.n || b.e - a.e);
        let ch = okc[0];
        if (!ch) { const below = cand.filter((c) => c.e <= cible.max).sort((a, b) => b.e - a.e || a.n - b.n); ch = below[0] || cand.sort((a, b) => a.e - b.e)[0]; }
        nF = ch.f; nL = ch.l;
      }
      if (nF > nFmax) av.push('Cas ' + (ic + 1) + ' : ' + nF + ' files demandées, ' + nFmax + ' seulement tiennent dans la largeur chargeable.');
      if (nL > nLmax) { nL = nLmax; }
      const trn = trains[nL - 1];
      const ecc = positionsTransv(O, veh, nF);
      // calcul direct sous les essieux (charges de toutes les files cumulées, modèle global)
      const onDeck = trn.axles.filter((a) => a.x >= -1e-9 && a.x <= m.Ltot + 1e-9);
      const loads = { elem: onDeck.map((a) => { const e = elemAt(m, a.x); return { e, type: 'p', P: -a.P * nF, a: a.x - m.X[e], dir: 'gy' }; }) };
      const r = prep.run(loads);
      const Mep = r.at(s.ek, s.xloc).M;
      // flèches relatives aux appuis (m, positives vers le bas) et rotations
      const uyN = (n) => r.U[3 * n + 1];
      const vSup = m.supNode.map(uyN);
      const flèche = (n, t, xi) => -(uyN(n) - (vSup[t] + (vSup[t + 1] - vSup[t]) * xi));
      let Kc = null;
      if (tr.mode === 'courbon') Kc = courbon(Math.max(2, fin(tr.n, 4)), fin(tr.b, 2.5), ecc);
      const Kmax = Kof(nF);
      const tw0 = Math.max(0, s.span - 1), tw1 = Math.min(nT - 1, s.span + (s.type === 'appui' ? 0 : 1));
      const fl = pts.filter((p) => p.t >= tw0 && p.t <= tw1).map((p) => {
        const v = flèche(p.n, p.t, p.xi), vk = v * Kmax;
        return { t: p.t, xi: p.xi, x: p.x, nom: 'M' + (p.t + 1) + (p.xi === 0.5 ? '' : p.xi < 0.5 ? 'g' : 'd'), v, vK: vk, vAbs: -uyN(p.n) * Kmax, vMin: vk >= 0 ? vk * (1 - mes.tolInf) : vk * (1 + mes.tolSup), vMax: vk >= 0 ? vk * (1 + mes.tolSup) : vk * (1 - mes.tolInf),
          parPoutre: Kc ? Kc.K.map((K) => v * K) : null, faible: Math.abs(vk) * 1000 < 5 * mes.prec };
      });
      const rot = [];
      for (let j = tw0; j <= tw1 + 1; j++) rot.push({ appui: j, x: X0[j], th: r.U[3 * m.supNode[j] + 2] });
      const reac = [];
      m.supports.forEach((sp, i) => { const mt = m.meta[i]; if (mt.appui !== undefined) reac.push({ appui: mt.appui, R: r.reac[i].Ry, base: !!mt.base }); });
      if (O.type === 'cadre') reac.push({ sol: true, R: r.reac.filter((_, i) => m.meta[i].sol).reduce((a, b) => a + b.Ry, 0) });
      // diagrammes le long du tablier
      const diag = { x: [], M: [], v: [] };
      for (let e = 0; e < m.nDeckEl; e++) {
        if (e === 0) { diag.x.push(m.X[0]); diag.M.push(r.at(0, 0).M); diag.v.push(-uyN(0)); }
        diag.x.push(m.X[e + 1]); diag.M.push(r.at(e, m.X[e + 1] - m.X[e]).M); diag.v.push(-uyN(e + 1));
      }
      const etaG = reg.val ? Mep / reg.val : 0;
      const Kr = Kreg(nF);
      const etaP = etaG * Kmax / Kr;
      const total = nF * nL * veh.W;
      const verdict = etaP < cible.min - 1e-9 ? 'insuffisant' : etaP > cible.max + 1e-9 ? 'excessif' : 'ok';
      if (verdict === 'insuffisant') av.push('Cas ' + (ic + 1) + ' : intensité ' + (etaP * 100).toFixed(0) + ' % < ' + (cible.min * 100).toFixed(0) + ' % de l’effet réglementaire (ajouter des véhicules ou alourdir les véhicules).');
      if (verdict === 'excessif') av.push('Cas ' + (ic + 1) + ' : intensité ' + (etaP * 100).toFixed(0) + ' % > ' + (cible.max * 100).toFixed(0) + ' % de l’effet réglementaire (réduire le chargement).');
      // position cotée : 1er essieu du véhicule de tête par rapport à l'appui gauche de la travée qui le porte
      const first = trn.axles[0];
      return { n: ic + 1, s, sign, nF, nL, auto, ecc, g: trn.g, sens: trn.sens, x1: first.x, axles: trn.axles, onDeck, total,
        Mep, Mli: nF * trn.val, reg, etaG, etaP, Kep: Kmax, Kreg: Kr, verdict, fl, rot, reac, diag, li, Kc };
    });
    const res = { o: O, veh, m: { X0, Ltot: m.Ltot, nT, supNode: m.supNode }, Ei: Ei(o.beton), cas, cible, mes, ctx, nFmax, av, biais, transv: tr };
    return res;
  }

  /* ── schémas SVG (chaînes pures) ── */
  const f2 = (x, d = 2) => (Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x).toFixed(d).replace('.', ',');
  function fenetre(res, c) {
    const X0 = res.m.X0, nT = res.m.nT;
    let a = c.s.span, b = c.s.type === 'appui' ? c.s.k : c.s.span;
    for (const ax of c.onDeck) { for (let t = 0; t < nT; t++) if (ax.x >= X0[t] - 1e-9 && ax.x <= X0[t + 1] + 1e-9) { a = Math.min(a, t); b = Math.max(b, t); } }
    if (c.s.type === 'appui') { a = Math.min(a, c.s.k - 1 < 0 ? 0 : c.s.k - 1); b = Math.max(b, Math.min(nT - 1, c.s.k)); }
    return { ta: Math.max(0, a), tb: Math.min(nT - 1, b), xa: X0[Math.max(0, a)], xb: X0[Math.min(nT - 1, b) + 1] };
  }
  function svgElevation(res, c) {
    const Wd = 780, Lm = 40, Rm = 30, X0 = res.m.X0, w = fenetre(res, c), veh = res.veh;
    const xa = Math.min(w.xa, ...c.axles.map((a) => a.x)) , xb = Math.max(w.xb, ...c.axles.map((a) => a.x));
    const sx = (Wd - Lm - Rm) / (xb - xa), X = (x) => Lm + (x - xa) * sx;
    const yD = 120, Pmax = Math.max(...veh.ax.map((a) => a.P));
    let s = `<svg viewBox="0 0 ${Wd} 215" class="chart" role="img" style="font-family:Outfit,sans-serif">`;
    s += `<line x1="${X(Math.max(xa, 0))}" x2="${X(Math.min(xb, res.m.Ltot))}" y1="${yD}" y2="${yD}" stroke="#14171f" stroke-width="4"/>`;
    if (xa < 0) s += `<line x1="${X(xa)}" x2="${X(0)}" y1="${yD + 2}" y2="${yD + 2}" stroke="#9aa0ac" stroke-dasharray="3 3"/>`;
    if (xb > res.m.Ltot) s += `<line x1="${X(res.m.Ltot)}" x2="${X(xb)}" y1="${yD + 2}" y2="${yD + 2}" stroke="#9aa0ac" stroke-dasharray="3 3"/>`;
    for (let j = 0; j <= res.m.nT; j++) {
      const x = X0[j]; if (x < xa - 1e-6 || x > xb + 1e-6) continue;
      const lab = j === 0 || j === res.m.nT ? 'C' + (j === 0 ? 0 : 1) : 'P' + j;
      if (res.o.type !== 'poutre' && (res.o.appuis || [])[j] && (+res.o.appuis[j].H > 0 || res.o.type === 'cadre')) s += `<rect x="${X(x) - 3}" y="${yD + 2}" width="6" height="34" fill="#c3c7cf"/>`;
      else s += `<path d="M${X(x)} ${yD + 2} l-7 12 h14 z" fill="none" stroke="#14171f"/>`;
      s += `<text x="${X(x)}" y="${yD + 50}" text-anchor="middle" font-size="10" fill="#3c3f4d">${lab}</text>`;
    }
    for (let t = w.ta; t <= w.tb; t++) {
      const a = X(X0[t]), b = X(X0[t + 1]), y = 192;
      s += `<line x1="${a}" x2="${b}" y1="${y}" y2="${y}" stroke="#6f7484"/><line x1="${a}" x2="${a}" y1="${y - 4}" y2="${y + 4}" stroke="#6f7484"/><line x1="${b}" x2="${b}" y1="${y - 4}" y2="${y + 4}" stroke="#6f7484"/>`;
      s += `<text x="${(a + b) / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="#6f7484">travée ${t + 1} : ${f2(res.o.travees[t].L)} m</text>`;
    }
    // section
    s += `<line x1="${X(c.s.x)}" x2="${X(c.s.x)}" y1="${yD - 80}" y2="${yD + 40}" stroke="#c0392b" stroke-dasharray="4 3"/><text x="${X(c.s.x) + 4}" y="${yD + 38}" font-size="10" fill="#c0392b">S${c.n}</text>`;
    // essieux
    let lastLab = -1e9;
    c.axles.forEach((a, i) => {
      const x = X(a.x), hgt = 22 + 40 * a.P / Pmax, on = a.x >= 0 && a.x <= res.m.Ltot;
      const col = on ? '#a8842a' : '#c3c7cf';
      s += `<line x1="${x}" x2="${x}" y1="${yD - 4 - hgt}" y2="${yD - 6}" stroke="${col}" stroke-width="1.6"/><path d="M${x} ${yD - 3} l-3.5 -7 h7 z" fill="${col}"/>`;
      if (Math.abs(x - lastLab) > 22) { s += `<text x="${x}" y="${yD - 8 - hgt}" text-anchor="middle" font-size="9" fill="#3c3f4d">${f2(a.P / res.o.g, 1)}</text>`; lastLab = x; }
    });
    // véhicules (silhouettes)
    for (let k = 0; k < c.nL; k++) {
      const ax = c.axles.filter((a) => a.veh === k), xf = ax[0].x, xr = ax[ax.length - 1].x;
      const front = xf + c.sens * veh.av, rear = xr - c.sens * veh.ar;
      const x1 = X(Math.min(front, rear)), x2 = X(Math.max(front, rear));
      s += `<rect x="${x1}" y="${yD - 82}" width="${x2 - x1}" height="10" rx="3" fill="none" stroke="#a8842a" stroke-opacity=".6"/>`;
    }
    s += `<text x="${Lm}" y="11" font-size="10" fill="#14171f">Cas ${c.n} — sens de marche ${c.sens > 0 ? '→ (avant à droite)' : '← (avant à gauche)'}</text>`;
    // cotation du premier essieu sur l'ouvrage
    const fa = c.onDeck.length ? c.onDeck.reduce((p, q) => (q.x < p.x ? q : p)) : null;
    if (fa) {
      let t = 0; while (t < res.m.nT - 1 && fa.x > X0[t + 1] + 1e-9) t++;
      const y = 26, a = X(X0[t]), b = X(fa.x);
      s += `<line x1="${a}" x2="${b}" y1="${y}" y2="${y}" stroke="#2d6be4"/><line x1="${a}" x2="${a}" y1="${y - 4}" y2="${yD}" stroke="#2d6be4" stroke-dasharray="2 3"/><line x1="${b}" x2="${b}" y1="${y - 4}" y2="${y + 4}" stroke="#2d6be4"/>`;
      s += `<text x="${(a + b) / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="#2d6be4">${f2(fa.x - X0[t])} m</text>`;
    }
    s += `<text x="${Wd - 4}" y="11" text-anchor="end" font-size="9" fill="#6f7484">charges par essieu et par file (t)</text></svg>`;
    return s;
  }
  function svgPlan(res, c) {
    const Wd = 780, Lm = 40, Rm = 30, o = res.o, veh = res.veh, X0 = res.m.X0, w = fenetre(res, c);
    const xa = Math.min(w.xa, ...c.axles.map((a) => a.x)), xb = Math.max(w.xb, ...c.axles.map((a) => a.x));
    const sx = (Wd - Lm - Rm) / (xb - xa);
    const B = o.usage === 'rail' ? fin((o.rail || {}).largeur, 8) : fin((o.route || {}).Lr, fin((o.route || {}).Lc, 7) + 1);
    const sy = Math.max(sx, 70 / B), Hd = B * sy, cy = 30 + Hd / 2, H = Hd + 70;
    const X = (x) => Lm + (x - xa) * sx, Y = (y) => cy - y * sy;
    const cot = 1 / Math.tan(res.biais * Math.PI / 200);   // décalage des lignes d'appui : x = xj + y·cotφ
    const XY = (x, y) => `${(X(x + y * cot)).toFixed(1)},${Y(y).toFixed(1)}`;
    let s = `<svg viewBox="0 0 ${Wd} ${H}" class="chart" role="img" style="font-family:Outfit,sans-serif">`;
    const x1 = Math.max(xa, 0), x2 = Math.min(xb, res.m.Ltot);
    s += `<polygon points="${XY(x1, B / 2)} ${XY(x2, B / 2)} ${XY(x2, -B / 2)} ${XY(x1, -B / 2)}" fill="#fbfaf7" stroke="#14171f"/>`;
    for (let j = 0; j <= res.m.nT; j++) { const x = X0[j]; if (x < xa - 1e-6 || x > xb + 1e-6) continue; s += `<line x1="${X(x + B / 2 * cot)}" y1="${Y(B / 2)}" x2="${X(x - B / 2 * cot)}" y2="${Y(-B / 2)}" stroke="#14171f" stroke-width="1.4"/>`; }
    if (o.usage !== 'rail') { const Lc = fin((o.route || {}).Lc, 7); [Lc / 2, -Lc / 2].forEach((y) => (s += `<line x1="${X(x1)}" x2="${X(x2)}" y1="${Y(y)}" y2="${Y(y)}" stroke="#9aa0ac" stroke-dasharray="6 4"/>`)); }
    else ((o.rail || {}).ecc || [0]).forEach((e) => (s += `<line x1="${X(x1)}" x2="${X(x2)}" y1="${Y(+e)}" y2="${Y(+e)}" stroke="#9aa0ac" stroke-dasharray="10 3 2 3"/>`));
    s += `<line x1="${X(x1)}" x2="${X(x2)}" y1="${Y(0)}" y2="${Y(0)}" stroke="#c3c7cf" stroke-dasharray="1 4"/>`;
    if (c.Kc) c.Kc.y.forEach((y, i) => (s += `<line x1="${X(x1)}" x2="${X(x2)}" y1="${Y(y)}" y2="${Y(y)}" stroke="#2d6be4" stroke-opacity=".45" stroke-dasharray="8 4"/><text x="${X(x2) + 3}" y="${Y(y) + 3}" font-size="9" fill="#2d6be4">p${i + 1}</text>`));
    // véhicules
    c.ecc.forEach((e) => {
      for (let k = 0; k < c.nL; k++) {
        const ax = c.axles.filter((a) => a.veh === k), xf = ax[0].x, xr = ax[ax.length - 1].x;
        const front = xf + c.sens * veh.av, rear = xr - c.sens * veh.ar, xl = Math.min(front, rear), xr2 = Math.max(front, rear);
        s += `<rect x="${X(xl)}" y="${Y(e + veh.larg / 2)}" width="${(xr2 - xl) * sx}" height="${veh.larg * sy}" rx="2" fill="#a8842a" fill-opacity=".12" stroke="#a8842a"/>`;
        ax.forEach((a) => [e + veh.voie / 2, e - veh.voie / 2].forEach((y) => (s += `<rect x="${X(a.x) - 2.5}" y="${Y(y) - 3}" width="5" height="6" fill="#14171f"/>`)));
      }
    });
    // points de mesure
    c.fl.forEach((p) => (s += `<circle cx="${X(p.x)}" cy="${Y(0)}" r="3.5" fill="#fff" stroke="#c0392b"/><text x="${X(p.x)}" y="${Y(0) - 6}" text-anchor="middle" font-size="9" fill="#c0392b">${p.nom}</text>`));
    // cotes transversales : bord de chaussée (ou axe) → axe de la 1re file
    const e0 = c.ecc[0];
    if (o.usage !== 'rail') {
      const Lc = fin((o.route || {}).Lc, 7), xc = X(xa) + 14, edge = -Lc / 2, wheel = e0 - veh.voie / 2;
      s += `<line x1="${xc}" x2="${xc}" y1="${Y(edge)}" y2="${Y(wheel)}" stroke="#2d6be4"/><text x="${xc + 4}" y="${(Y(edge) + Y(wheel)) / 2 + 3}" font-size="9" fill="#2d6be4">${f2(wheel - edge)} m</text>`;
    }
    c.ecc.forEach((e, i) => (s += `<text x="${X(xb) - 4}" y="${Y(e) + 3}" text-anchor="end" font-size="9" fill="#a8842a">file ${i + 1} : e = ${f2(e)} m</text>`));
    s += `<text x="${Lm}" y="${H - 8}" font-size="9" fill="#6f7484">Vue en plan${sy > sx * 1.01 ? ' (échelle transversale dilatée)' : ''} — biais ${f2(res.biais, 1)} gr — e : excentrement de l’axe de la file / axe de l’ouvrage (positif à gauche)</text></svg>`;
    return s;
  }

  const api = { Ei, VEHICULES, vehicule, inertie, modele, ligneInfluence, train, reglementaire, courbon, positionsTransv, filesMax, nVoiesF61, Lphi, calcul, svgElevation, svgPlan };
  if (isNode) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.epreuves = api; }
})(typeof window !== 'undefined' ? window : globalThis);
