// PIPO-EL — ferraillage (sections BAEL, ferraillage minimal, réel adopté, transversal), règles reconstituées
// sur les pages « FERRAILLAGE » des listings SETRA (cf. NOTES.md, tour 5). Unités : m, t, t/m².
(function (root) {
  'use strict';
  const req = (typeof require === 'function' && typeof module !== 'undefined');
  const LV = req ? require('./live.js') : root.PIPO_LIVE;
  const GM = req ? require('./gm.js') : root.PIPO_GM;
  const aire = phi => Math.PI * phi * phi / 4;

  // ELU flexion simple, diagramme parabole-rectangle (béton 3.5‰ / 2‰, acier 10‰), b = 1 m
  function asELU(M, d, fbu, fsu) {
    if (!(M > 0)) return 0;
    const res = x => { const es = Math.min(0.01, 0.0035 * (d - x) / x); const ec = es === 0.01 ? 0.01 * x / (d - x) : 0.0035; const N = 200; let F = 0, Mo = 0;
      for (let k = 0; k < N; k++) { const y = (k + 0.5) * x / N, e = ec * (1 - y / x), sg = e < 0.002 ? fbu * (1 - (1 - e / 0.002) ** 2) : fbu; F += sg * x / N; Mo += sg * x / N * (d - y); }
      return [F, Mo]; };
    let lo = 1e-6, hi = d * 0.99; for (let i = 0; i < 70; i++) { const m = (lo + hi) / 2; if (res(m)[1] < M) lo = m; else hi = m; }
    return res(lo)[0] / fsu;
  }
  // ELS : section fissurée, n = 15
  function elsStress(M, A, d) {
    if (!(A > 0) || !(M > 0)) return { ss: 0, sb: 0 };
    const nA = 15 * A, x = -nA + Math.sqrt(nA * nA + 2 * nA * d), I = x ** 3 / 3 + nA * (d - x) ** 2;
    return { ss: 15 * M * (d - x) / I, sb: M * x / I };
  }
  // section d'acier telle que σs ≤ σs limite (fissuration préjudiciable) et σb ≤ σb limite
  function asELS(M, d, ssl, sbl) {
    if (!(M > 0)) return 0; let lo = 1e-7, hi = 0.3;
    for (let i = 0; i < 90; i++) { const m = (lo + hi) / 2; const s = elsStress(M, m, d); if ((ssl && s.ss > ssl) || (sbl && s.sb > sbl)) lo = m; else hi = m; }
    return hi;
  }

  // Totaux pondérés (mêmes combinaisons que les tableaux) : {els, elu}
  function totaux(Mo, sg, ret, tem, lv) {
    const e = lv[sg > 0 ? 'max' : 'min'];
    return LV.combine({ Gels: sg > 0 ? Mo.elsMax : Mo.elsMin, Gelu: sg > 0 ? Mo.eluMax : Mo.eluMin, A: e.A.eff, BC: e.BC.eff, BT: e.BT.eff,
      MC: e.MC.eff, ME: e.ME.eff, EX: e.EX.eff, TR: e.TR.eff, RE: e.RE ? e.RE.eff : 0, RT: ret, TP: tem }, sg);
  }

  function ferraillage(r) {
    const v = r.v, g = r.g, mat = r.mat, sn = g.sn;
    const fbu = mat.fbu, fsu = mat.ssElu, ssl = v.FIP ? mat.ssEls : [0, 0, 0], sbl = v.SIGMAF;
    const PHI = [v.PHI1, v.PHI2, v.PHI3], A1 = aire(v.PHI1), A2 = aire(v.PHI2);
    // hauteur utile (règle PICF, exacte sur les efforts résistants béton imprimés) : d = h − c − 0.6 φ − 1.1 φ2 ;
    // enrobage 0.035 au dessus de la traverse (fibre supérieure), 0.025 ailleurs.
    const dd = (h, c, phi) => h - c - 0.6 * phi - 1.1 * v.PHI2;
    const need = (MU, MS, d, k) => Math.max(asELU(MU, d, fbu, fsu[k]), asELS(MS, d, ssl[k], sbl));
    // ---- moments de dimensionnement (valeurs positives pour la fibre tendue considérée)
    const D = r.det;
    const mid = totaux(D.mid.M, 1, D.mid.ret, D.mid.tem, r.liveDet.mid);
    const sup = totaux(D.sup.M, -1, D.sup.ret, D.sup.tem, r.liveDet.sup);
    const inf = totaux(D.inf.M, -1, D.inf.ret, D.inf.tem, r.liveDet.inf);
    let pdU = 0, pdS = 0;
    r.secP.forEach((s, i) => { const t = totaux(s.M, 1, s.ret, s.tem, r.liveP[i].M); pdU = Math.max(pdU, t.elu); pdS = Math.max(pdS, t.els); });
    const semTot = k => { const s = r.semelleEff[k][0]; return totaux(s.M, -1, s.ret[0], s.tem[0], s.liveM); };
    const sE = semTot('E'), sI = semTot('I');
    const dT = dd(g.e3, 0.025, v.PHI1), dTs = dd(g.e3, 0.035, v.PHI1), dP1 = dd(g.e2, 0.025, v.PHI1), dP2 = dd(g.e2, 0.025, v.PHI2), dS2 = dd(g.e1, 0.025, v.PHI2);
    const min = {
      trMid: need(mid.elu, mid.els, dT, 0),
      pdCour: need(pdU, pdS, dP2, 1), // piédroit, section courante (moment non multiplié par sin φ)
      trSup: need(-sup.elu, -sup.els, dTs, 0),
      pdBase: need(-inf.elu * sn, -inf.els * sn, dP1, 0),
      semE: need(-sE.elu, -sE.els, dS2, 1), semI: need(-sI.elu, -sI.els, dS2, 1),
    };
    min.pdSup = min.trSup * sn;
    // ---- ferraillage réel adopté : maille de base dans la section la plus sollicitée de la traverse (notice §3.3.3.1)
    const Q = Math.max(min.trMid, min.trSup), e = A1 / Q, eP = e / sn;
    const opt = (k, m) => ({ A: (k ? A2 : A1) / (eP * m), esp: eP * m, phi: PHI[k], k });
    const choose = (list, Am) => list.find(o => o.A >= Am - 1e-12) || list[list.length - 1];
    const ad = {
      trInt: { A: Q, esp: e, phi: v.PHI1, k: 0, h: g.e3, d: dT, M: mid },
      trSup: { A: Q, esp: e, phi: v.PHI1, k: 0, h: g.e3, d: dTs, M: { els: -sup.els, elu: -sup.elu } },
      pdSup: { A: Q * sn, esp: eP, phi: v.PHI1, k: 0, h: g.e2, d: dP1, M: { els: -sup.els * sn, elu: -sup.elu * sn } },
    };
    // nappe 3 (piédroit, moments positifs) : φ2 à 2d, φ2 à d, φ1 à 2d, φ1 à d (premier suffisant)
    // tour 14 : la section minimale imprimée est calculée avec le diamètre de la disposition adoptée (premier suffisant) :
    // calcul d'abord avec φ2 (d = dP2) ; si la gamme retient φ1, section recalculée avec φ1 (d = dP1) et choix refait.
    // (cour : 1799/1815 exacts en φ1 ; base : 1638/1679/1799/1815/1846 φ1, 1676/1680/1825/1847 φ2 exacts.)
    // tour 15 : base des ouvrages biais — section biaise (d_b = e2/sinφ − c − 0.6φ − 1.1φ2), moment du cadre brut,
    // section minimale = sinφ · A(M, d_b) (1677, 1796, 1893 exacts ; 1890 à 1e-6 près) ; option bias = [facteur, h].
    const chooseRe = (list, MU, MS, bias) => { const NEW = globalThis.PIPO_FMPHI !== 0;
      const [f, hh] = bias || [1, g.e2], d2 = dd(hh, 0.025, v.PHI2), d1 = dd(hh, 0.025, v.PHI1);
      let Am = NEW ? f * need(MU, MS, d2, 1) : null, k = 1, o;
      if (!NEW) return null;
      o = choose(list, Am); if (o.k === 0) { Am = f * need(MU, MS, d1, 0); k = 0; o = choose(list, Am); } return { o, Am, k }; };
    const L3 = [opt(1, 2), opt(1, 1), opt(0, 2), opt(0, 1)], L4 = [opt(1, 1), opt(0, 2), opt(0, 1)];
    const fb = globalThis.PIPO_FMBASE != null ? globalThis.PIPO_FMBASE(sn) : sn * sn; // base : moment × sin²φ (tour 14)
    const rc = globalThis.PIPO_PDB !== 0 ? chooseRe(L3, pdU / sn, pdS / sn, [1, g.e2 / sn]) : chooseRe(L3, pdU, pdS), rb = globalThis.PIPO_PDB !== 0 && globalThis.PIPO_FMBASE == null ? chooseRe(L4, -inf.elu, -inf.els, [sn, g.e2 / sn]) : chooseRe(L4, -inf.elu * fb, -inf.els * fb);
    min.kCour = 1; min.kBase = 0;
    if (rc) { min.pdCour = rc.Am; min.kCour = rc.k; } if (rb) { min.pdBase = rb.Am; min.kBase = rb.k; }
    ad.pdCour = Object.assign(rc ? rc.o : choose(L3, min.pdCour), { h: g.e2, M: { els: pdS, elu: pdU } });
    // nappe 4 (base du piédroit, prolongée dans la semelle intérieure) : φ2 à d, φ1 à 2d, φ1 à d
    ad.pdBase = Object.assign(rb ? rb.o : choose(L4, min.pdBase), { h: g.e2, M: { els: -inf.els * sn, elu: -inf.elu * sn } });
    // semelle intérieure : nappe 4 + nappe 5 filante si insuffisante ; extérieure : φ2 à d (fers solidarisant) + filante
    const fil = (Am, A0) => Am > A0 + 1e-12 ? choose([opt(1, 2), opt(1, 1), opt(0, 2), opt(0, 1)], Am - A0) : { A: 0, esp: 0, phi: 0, k: -1 };
    const solE = choose([opt(1, 1), opt(0, 2), opt(0, 1)], min.semE); // même gamme que la nappe 4 (1825 : φ1 à d)
    ad.semI = { sol: ad.pdBase, fil: fil(min.semI, ad.pdBase.A), h: g.e1, larg: r.aInt, M: { els: -sI.els, elu: -sI.elu } };
    ad.semE = { sol: solE, fil: fil(min.semE, solE.A), h: g.e1, larg: r.aExt, M: { els: -sE.els, elu: -sE.elu } };
    for (const k of ['semI', 'semE']) { const o = ad[k]; o.A = o.sol.A + o.fil.A; o.phi = o.sol.phi; o.d = dd(g.e1, 0.025, o.sol.phi); }
    for (const k of ['trInt', 'trSup', 'pdSup', 'pdCour', 'pdBase', 'semI', 'semE']) {
      const o = ad[k]; if (o.d == null) o.d = dd(o.h, 0.025, o.phi);
      Object.assign(o, elsStress(o.M.els, o.A, o.d));
      const fp = /^(pd|sem)/.test(k) ? 1 / sn : 1; // piédroits et semelles : efforts par m biais (1638 : 181.64 = 181.53/sin φ)
      o.VRb = mat.tauLim * o.d * fp; // effort tranchant résistant béton : τlim · d
      o.VRs = 4 * o.A / o.phi * mat.tauSu * o.d * fp; // adhérence d'entraînement : périmètre 4A/φ × τs × d
      // Tour 15 — piédroits des ouvrages biais (1890, 1893 exacts) : section biaise d'épaisseur e2/sinφ,
      // d_b = e2/sinφ − c − 0.6φ − 1.1φ2 ; béton τlim·d_b ; acier 4A/φ·τs·d_b/sinφ² (angle, base), /sinφ (section courante) ;
      // contraintes ELS avec le moment du cadre non multiplié par sinφ et A/sinφ (angle, base), M et A (section courante).
      if (/^pd/.test(k) && globalThis.PIPO_PDB !== 0) {
        const cour = k === 'pdCour', db = dd(g.e2 / sn, 0.025, o.phi);
        Object.assign(o, elsStress(cour ? o.M.els : o.M.els / sn, cour ? o.A : o.A / sn, db));
        o.VRb = mat.tauLim * db; o.VRs = 4 * o.A / o.phi * mat.tauSu * db / (cour ? sn : sn * sn);
      }
    }
    // ---- ferraillage transversal (face intérieure de la traverse)
    // non-fragilité : A = ft·h²/(6·fe·0.9·d), d = h − 0.025 − φ2/2 (traverse, semelles) ; piédroits : d = h − 0.025 + φ2/2, ÷ sin φ
    const fe2 = v.SIGMA2, nfr = (h, dd2) => mat.ft * h * h / (6 * fe2 * 0.9 * dd2);
    const tr = { nfT: nfr(g.e3, g.e3 - 0.025 - v.PHI2 / 2), nfP: nfr(g.e2, g.e2 - 0.025 + v.PHI2 / 2) / sn, nfS: nfr(g.e1, g.e1 - 0.025 - v.PHI2 / 2), plancher: 3 * A2 };
    tr.Am = r.transversal ? r.transversal.A : 0;
    tr.A = Math.max(tr.Am, tr.nfT, tr.plancher); tr.esp = A2 / tr.A;
    if (r.transversal) Object.assign(tr, elsStress(r.transversal.Ms, tr.A, g.e3 - 0.025 - v.PHI2 / 2)); else Object.assign(tr, { ss: 0, sb: 0 });
    const ep = epure(r, ad, eP);
    // ---- nomenclature des aciers auxiliaires (φ2) — règles relevées sur 6 listings
    const ls2 = v.PHI2 * v.SIGMA2 / (4 * mat.tauSu), Wb = g.larg / sn;
    const nom = {
      espT: 2 * e, espP: 2 * eP, // une barre sur deux du ferraillage principal (traverse / piédroit, goussets, semelles)
      lExt: g.L - 2 * ep.ang[0][1] + ls2, // prolongement extérieur (approché : exact 1638/1679)
      lInt: [ep.trav[0][0] + 0.6, ep.trav[2][0] + 0.6], // prolongement intérieur : origine des barres 1 et 3 + 0.60 (exact)
      espTE: A2 / Math.max(tr.A / 2, tr.nfT, tr.plancher), // face extérieure : max(A/2, non-fragilité, plancher)
      espPd: Math.min(1 / 3, A2 / tr.nfP), espSs: A2 / Math.max(tr.nfS, tr.plancher),
      tb: Wb > 10 ? Wb - 10 + 0.6 : 0, Wb, // longueur « 10 M + x M (TETE-BECHE) » : x = largeur biaise − 10 + 0.60
    };
    // ---- avant-métré
    const lb = (x) => x + (x > 10 ? 0.6 : 0); // barres filantes de largeur : recouvrement 0.60 au-delà de 10 m
    const larg = g.larg, rho = 7.85, ton = [0, 0, 0];
    const add = (phi, len, n) => { const k = PHI.indexOf(phi); if (k >= 0) ton[k] += rho * aire(phi) * len * n; };
    ep.trav.forEach(b => add(ad.trInt.phi, b[2], larg / (4 * e)));
    ep.ang.forEach(b => add(ad.trSup.phi, b[2], 2 * larg / (4 * e)));
    ep.pied.forEach(b => add(ad.pdCour.phi, b[2], 2 * Wb / (ep.pied.length * ad.pdCour.esp)));
    ep.semI.forEach(b => add(ad.pdBase.phi, b[2], 2 * Wb / (2 * ad.pdBase.esp)));
    add(ad.semE.sol.phi, ep.semE[2], 2 * Wb / ad.semE.sol.esp);
    const lT = (v.OUVER + 2 * g.e2) / sn, wl = lb(Wb);
    add(v.PHI2, nom.lExt, larg / nom.espT); add(v.PHI2, 2 * (nom.lInt[0] + nom.lInt[1]), larg / nom.espT);
    add(v.PHI2, wl, lT / tr.esp + lT / nom.espTE + 16); add(v.PHI2, 1.8, 2 * Wb / nom.espP);
    add(v.PHI2, wl, 4 * (2 / 0.2 + Math.max(0, v.HAUTL - 2) / nom.espPd));
    add(v.PHI2, g.B, 2 * Wb / nom.espP); add(v.PHI2, wl, 2 * (g.B / nom.espSs + g.B / 0.2));
    const beton = g.e3 * (v.OUVER + 2 * g.e2) / sn * larg + (2 * v.HAUTL * g.e2 + 2 * g.e1 * g.B) * Wb; // exact (droits et 1677/1796)
    const coffrage = (v.OUVER + 4 * v.HAUTL + 4 * g.e1 + 2 * g.e3) * Wb; // approché
    const metre = { beton, coffrage, ton, total: ton[0] + ton[1] + ton[2] };
    return { min, ad, tr, e, eP, Q, ep, nom, metre };
  }

  // ---- Épure d'arrêt des barres (par quart de nappe, notice §3.3.5)
  // Règle retrouvée (traverse, 6/10 passages exacts) : à partir du point le plus sollicité, la k-ième barre (sur 4) est
  // arrêtée à la première section de la grille où max(MU/MUmax, MS/MSmax) ≤ (4−k)/4, prolongée du décalage a = 0.8 h.
  function epure(r, ad, eP) {
    const v = r.v, g = r.g, L = g.L, H = g.H;
    const env = (secs, lives) => secs.map((s, i) => { const mx = totaux(s.M, 1, s.ret, s.tem, lives[i].M), mn = totaux(s.M, -1, s.ret, s.tem, lives[i].M);
      return { x: s.x, maxU: mx.elu, maxS: mx.els, minU: mn.elu, minS: mn.els }; });
    const T = env(r.secT, r.liveT), P = env(r.secP, r.liveP);
    const ratio = (o, ref, neg) => neg ? Math.max(o.minU / ref.minU, o.minS / ref.minS) : Math.max(o.maxU / ref.maxU, o.maxS / ref.maxS);
    const seuil = (order, ref, neg) => [0.75, 0.5, 0.25, 0].map(k => { for (const o of order) if (ratio(o, ref, neg) <= k + 1e-9) return o.x; return order[order.length - 1].x; });
    const aT = 0.8 * g.e3, aP = 0.8 * g.e2, r2 = x => Math.round(x * 100) / 100;
    // intérieur traverse (abscisses depuis l'angle, portée biaise L)
    const ti = seuil([...T].reverse(), T[T.length - 1], false).map(x => x - aT); // [x34, x12, x14, x0]
    const trav = [[ti[3], L - ti[0]], [ti[0], L - ti[3]], [ti[2], L - ti[1]], [ti[1], L - ti[2]]];
    // extérieur, angle supérieur : côté traverse (depuis l'angle), côté piédroit (depuis la base)
    const te = seuil(T, T[0], true).map(x => x + aT);
    const Pd = [...P].reverse(); const tp = seuil(Pd, Pd[0], true).map(x => Math.max(0, x - aP));
    const pairs = [[tp[1], te[2]], [tp[3], te[0]], [tp[0], te[3]], [tp[2], te[1]]]; // barres 1..4 (cf. 1638)
    const ang = pairs.map(([p, b]) => [p, b, H - p + b + (g.e2 + g.e3) / 2]);
    // intérieur piédroit (nappe 3) : épure de la moitié des aciers (seuil 3/4 de part et d'autre du maximum)
    let iMax = 0; P.forEach((o, i) => { if (o.maxU > P[iMax].maxU) iMax = i; });
    const dn = P.slice(0, iMax + 1).reverse(), up = P.slice(iMax);
    const s34 = (order) => { for (const o of order) if (ratio(o, P[iMax], false) <= 0.75 + 1e-9) return o.x; return order[order.length - 1].x; };
    const deux = ad.pdCour.esp < 1.5 * eP;
    const pied = deux ? [[s34(dn) - aP, H], [-0.25, s34(up) + aP]] : [[g.e1 / 2, H]];
    // semelles : fers solidarisant (abscisses sur le piédroit depuis la base, extrémité au bord de la semelle)
    const E5SI = g.D + g.B / 2, E5SE = -(r.aExt + g.e2 / 2), A5S = g.e1 / 2 + 0.6;
    const p5 = [Math.max(A5S, tp[2] - 0.6), Math.max(A5S, tp[1])];
    return { trav: trav.map(([a, b]) => [r2(a), r2(b), r2(b) - r2(a)]), ang: ang.map(x => x.map(r2)), pied: pied.map(([a, b]) => [r2(a), r2(b), r2(b) - r2(a)]),
      semI: p5.map(p => [r2(p), r2(E5SI), r2(p + E5SI + g.e1)]), semE: [r2(A5S), r2(E5SE), r2(A5S - E5SE + g.e1)] };
  }

  // ---- Lignes d'influence du coefficient μ (point (0,0), plaque équivalente LARGEUR = larg/sinφ, LONGUEUR = OUVER + E2)
  function plaqueMu(r) {
    const LA = r.g.larg / r.g.sn, LO = r.v.OUVER + r.v.E2, theta = LA / 2 / LO;
    const ys = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
    return { LA, LO, theta, rows: [1, 3, 5].map(m => ({ m, v: ys.map(y => GM.muCoef(m * theta, 0, y / r.g.sn)) })) };
    // biais : colonnes ±B imprimées pour des charges en y·b/sinφ (15/15 exacts sur 1638, 1677, 1796, 1890, 1893 — tour 14)
  }

  // ---- Moment transversal principal au point (0,0) (Guyon-Massonnet, harmoniques 1..5) — cf. NOTES.md tour 6.
  // MOMENT(m) = F1·F2·F3·(4/π)·b·q ; F1 = sin(mπc/l), 2c = a + 2·HCHAU + E3 (borné à l), F2 = |sin(mπ/2)|/m,
  // F3 = Σ μ_m(0,e) (roues ponctuelles Bc/Bt/Br) ou moyenne de μ par Simpson 5 points sur la bande chargée
  // (chenilles, convoi E, Me : largeur + 2·HCHAU + E3 ; A(l) : largeur de voie) ; q = P/2c.
  function transversal(r) {
    const v = r.v, g = r.g, mu0 = r.mu, LA = mu0.LA, LO = mu0.LO, b = LA / 2, th = mu0.theta, sn = g.sn;
    const phi = v.BIAIS, eta = g.larg / v.OUVER, psi = phi + (100 - phi) * (eta < 2 ? Math.pow(1 - eta / 2, 2) : 0);
    const s2 = 2 * v.HCHAU + v.E3, H = [1, 2, 3, 4, 5];
    const cache = {}; const mu = (m, e) => { const k = m + ':' + e.toFixed(6); return k in cache ? cache[k] : (cache[k] = GM.muCoef(m * th, 0, e / b)); };
    const simp3 = (m, a, c) => (c - a) / 6 * (mu(m, a) + 4 * mu(m, (a + c) / 2) + mu(m, c));
    // intégration SETRA : Simpson 3 points, l'intervalle étant coupé au point étudié (pic anguleux de μ)
    const strip = (m, e0, w) => { if (!(w > 0)) return mu(m, e0); const a = e0 - w / 2, c = e0 + w / 2;
      return (a < -1e-9 && c > 1e-9 ? simp3(m, a, 0) + simp3(m, 0, c) : simp3(m, a, c)) / w; };
    const F3 = (m, pos, w) => pos.reduce((s, e) => s + strip(m, e, w), 0);
    const yL = -b + (v.ETROTG + v.EGAU) / sn, yR = yL + v.ESURCH / sn;
    const F1 = (m, a) => { const c2 = Math.min(a + s2, LO); return Math.sin(m * Math.PI * c2 / 2 / LO); };
    const F2 = m => (m % 2 ? 1 / m : 0);
    // dimensions transversales (largeurs, entraxes) mesurées dans la plaque biaise : ÷ sinφ
    const harm = (a, pos, w, q) => H.map(m => { const f1 = F1(m, a), f2 = F2(m), f3 = F3(m, pos, w / sn); return { m, f1, f2, f3, M: f1 * f2 * f3 * 4 / Math.PI * b * q }; });
    const place = (lay0, w0) => { const lay = lay0.map(d => d / sn); const w = 0; // SETRA : seuls les centres des éléments sont tenus dans la chaussée // position la plus défavorable (somme des harmoniques impaires), charge dans la chaussée
      const lo = yL + w / 2 - Math.min(...lay), hi = yR - w / 2 - Math.max(...lay); let bx = 0, bv = -Infinity;
      // SETRA : un élément de la charge (roue, chenille, bande) est placé sur le point étudié
      const loM = yL + w / 2 + Math.max(...lay), hiM = yR - w / 2 + Math.min(...lay); // disposition symétrique (−lay)
      let cand = lay.map(d => [-d, 1]).filter(([x]) => x >= lo - 1e-9 && x <= hi + 1e-9)
        .concat(lay.map(d => [d, -1]).filter(([x]) => x >= loM - 1e-9 && x <= hiM + 1e-9));
      if (!cand.length) cand = [[Math.min(Math.max(0, lo), hi), 1]];
      let bs = 1;
      for (const [x, sg] of cand) { const val = [1, 3, 5].reduce((s, m) => s + Math.sin(m * Math.PI / 2) * F3(m, lay.map(d => x + sg * d), w) / m, 0); if (val > bv + 1e-12) { bv = val; bx = x; bs = sg; } }
      return lay.map(d => bx + bs * d); };
    const tot = h => h.reduce((s, x) => s + x.M, 0);
    // MX : moment longitudinal à mi-traverse (permanent max + charge, mêmes règles que les sections déterminantes)
    const G = r.det.mid.M, L = r.liveDet.mid.max, TR = Math.max(0, L.TR ? L.TR.eff : 0);
    const MXf = k => { const Q = L[k] ? L[k].eff : 0;
      if (k === 'A' || k === 'BC' || k === 'BT') return [G.elsMax + 1.2 * (Q + TR), G.eluMax + 1.6 * (Q + TR)];
      if (k === 'EX') return [G.elsMax + Q, G.eluMax + 1.35 * Q];
      return [G.elsMax + Q + 1.2 * TR, G.eluMax + 1.35 * Q + 1.5 * TR]; };
    const R = Math.PI / 200, A1 = (100 - psi) * R, A2 = A1 + phi * R;
    const tors = (MY, MX) => { const MTOR = MX * Math.sin(A1) * Math.sin(A2) + MY * Math.cos(A1) * Math.cos(A2);
      const MAVF = (MY * Math.sin(A2) * Math.cos(A1) - MX * Math.cos(A2) * Math.sin(A1)) / Math.sin(A2 - A1);
      const h2 = (A2 - A1) / 2, MAPF = MAVF + Math.abs(MTOR) / (2 * (MTOR * MX >= 0 ? Math.sin(h2) ** 2 : Math.cos(h2) ** 2)); return { MX, MY, MTOR, MAVF, MAPF }; };
    const res = (total, gs, gu, k) => { const mx = MXf(k); return { els: tors(Math.max(0, gs * total), mx[0]), elu: tors(Math.max(0, gu * total), mx[1]) }; };
    const blocks = [], dyn = r.dyn;
    if (v.MC && v.MC !== 5) { const m80 = v.MC === 3, wc = (m80 ? 0.85 : 1.0) + s2, a = m80 ? 4.9 : 6.1, P = m80 ? 36 : 55, q = P / Math.min(a + s2, LO);
      const p1 = place([0, m80 ? 2.95 : 3.3], m80 ? 0.85 : 1.0).sort((x, y) => Math.abs(x) - Math.abs(y)), h1 = harm(a, [p1[0]], wc, q), h2 = harm(a, [p1[1]], wc, q), t = (tot(h1) + tot(h2)) * dyn.dMc;
      blocks.push({ k: 'MC', parts: [h1, h2], coef: dyn.dMc, total: t, ...res(t, 1, 1.35, 'MC') }); }
    if (v.EXCEP) { const D = v.EXCEP === 1, a = D ? 11 : 15, w = 3.3 + s2, q = (D ? 140 : 100) / Math.min(a + s2, Math.max(LO, a));
      const h = harm(a, place([0], 3.3), w, q), t = 2 * tot(h); blocks.push({ k: 'EX', parts: [h], total: t, ...res(t, 1, 1.35, 'EX') }); }
    const cl = v.CLASSE || 1, BCT = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 0.8] }[cl] || [1];
    if (v.BC) { let best = null; const nv = Math.max(1, Math.min(v.PVOIE || 1, BCT.length));
      for (let n = 1; n <= nv; n++) { const lay = []; for (let i = 0; i < n; i++) lay.push(2.5 * i, 2.5 * i + 2);
        const h = harm(1.75, place(lay, 0.25), 0, 12 * BCT[n - 1] / Math.min(1.75 + s2, LO)), t = tot(h); if (!best || t > best.t) best = { h, t }; }
      const t = best.t * dyn.dBc; blocks.push({ k: 'BC', parts: [best.h], coef: dyn.dBc, total: t, ...res(t, 1.2, 1.6, 'BC') }); }
    if (v.BT && cl < 3) { const bt = cl === 1 ? 1 : 0.9, h = harm(1.6, place([0, 2], 0.6), 0, 16 * bt / Math.min(1.6 + s2, LO)), t = tot(h) * dyn.dBt;
      blocks.push({ k: 'BT', parts: [h], coef: dyn.dBt, total: t, ...res(t, 1.2, 1.6, 'BT') }); }
    if (v.ME && v.ME !== 5) { const m80 = v.ME === 3, w = (m80 ? 3.5 : 4.0) + s2, a = m80 ? 1.6 : 1.9, P = m80 ? 22 : 33;
      const h = harm(a, place([0], m80 ? 3.5 : 4.0), w, P / Math.min(a + s2, LO)), t = tot(h) * dyn.dMe; blocks.push({ k: 'ME', parts: [h], coef: dyn.dMe, total: t, ...res(t, 1, 1.35, 'ME') }); }
    // ME = 5 (charge généralisée à essieux, lignes S2/S3) : deux roues ponctuelles distantes de LARGES (÷ sinφ), une sur le point (pas de contrainte de chaussée : 1677, 2e roue hors chaussée) ;
    // a = étendue des essieux + 0.25 (2c = a + 2·HCHAU + E3), q = (ΣPOESS/2)/2c, total × DYNAB (1677 : F3, MOMENT, MY exacts).
    if (v.ME === 5) { let P = 0, x0 = Infinity, x1 = -Infinity; for (let j = 1; j <= Math.max(1, v.NES || 1); j++) if (v['POESS' + j]) { P += v['POESS' + j]; x0 = Math.min(x0, v['ABESS' + j] || 0); x1 = Math.max(x1, v['ABESS' + j] || 0); }
      const a = (x1 > x0 ? x1 - x0 : 0) + 0.25, h = harm(a, [0, (v.LARGES || 0) / sn], 0, P / 2 / Math.min(a + s2, LO)), t = tot(h) * dyn.dMe;
      blocks.push({ k: 'ME', parts: [h], coef: dyn.dMe, total: t, ...res(t, 1, 1.35, 'ME') }); }
    if (v.BC) { const h = harm(0.3, place([0], 0.6), 0, 10 / Math.min(0.3 + s2, LO)), t = tot(h) * dyn.dBc;
      blocks.push({ k: 'BR', parts: [h], coef: dyn.dBc, total: t, ...res(t, 1.2, 1.6, 'BC') }); }
    if (v.AL) { const nv = Math.max(1, v.PVOIE || 1), V = v.ESURCH / nv, Vb = V / sn, Al = 0.23 + 36 / (LO + 12), q = Al * V;
      const lanes = []; for (let i = 0; i < nv; i++) lanes.push(H.map(m => { const f1 = Math.sin(m * Math.PI / 2), f3 = strip(m, yL + (i + 0.5) * Vb, Vb); return { m, f1, f2: F2(m), f3, M: f1 * F2(m) * f3 * 4 / Math.PI * b * q }; }));
      const a1t = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] }[cl] || [1], a2 = ({ 1: 3.5, 2: 3, 3: 2.75 }[cl] || 3.5) / V;
      let t = 0; for (let i = 0; i < nv; i++) for (let j = i; j < nv; j++) { let s = 0; for (let k = i; k <= j; k++) s += tot(lanes[k]);
        const n = j - i + 1, val = s * a1t[Math.min(n, a1t.length) - 1] * a2; if (val > t) t = val; }
      blocks.push({ k: 'AL', parts: lanes, total: t, ...res(t, 1.2, 1.6, 'A') }); }
    const Ms = Math.max(0, ...blocks.map(x => x.els.MAPF)), Mu = Math.max(0, ...blocks.map(x => x.elu.MAPF));
    return { phi, psi, LA, LO, th, blocks, Ms, Mu };
  }
  const api = { ferraillage, plaqueMu, transversal, asELU, asELS, elsStress };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PIPO_FER = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
