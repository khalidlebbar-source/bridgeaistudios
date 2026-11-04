// PIPO-EL — calcul (unités SETRA : m, t, t/m², grades).
(function (root) {
  'use strict';
  const req = (typeof require === 'function' && typeof module !== 'undefined');
  const { Frame } = req ? require('./frame.js') : root.PIPO_FRAME;
  const { flat } = req ? require('./parse.js') : root.PIPO_PARSE;
  const LV = req ? require('./live.js') : root.PIPO_LIVE;
  const FER = req ? require('./fer.js') : root.PIPO_FER;
  const MPA = 102; // t/m² par MPa (convention du programme)

  function geometrie(v) {
    const sn = Math.sin(v.BIAIS * Math.PI / 200);
    const e1 = Math.max(v.E2, 0.6);
    const L = (v.OUVER + v.E2) / sn;
    const H = v.HAUTL + v.E3 / 2 + e1 / 2;
    const larg = v.ETROTG + v.EGAU + v.ESURCH + v.EDROI + v.ETROTD;
    return { sn, e1, e2: v.E2, e3: v.E3, L, H, B: v.W, D: v.DELTA, larg, LDALT: v.LDALT };
  }
  function materiaux(v) {
    const fc = v.SIGMAF / 0.6, fcM = fc / MPA;
    const ft = (0.6 + 0.06 * fcM) * MPA;
    const Ev = 3700 * Math.cbrt(fcM) * MPA;
    const fip = v.FIP;
    const ssEls = [v.SIGMA1, v.SIGMA2, v.SIGMA3].map(f => f / 2);
    const ssElu = [v.SIGMA1, v.SIGMA2, v.SIGMA3].map(f => f / 1.15);
    const tauSans = 0.07 * fc / 1.5;
    const tauLim = fip >= 1 ? 0.10 * fc : Math.min(0.2 * fc / 1.5, 5 * MPA);
    const tauSu = 0.6 * 1.5 * 1.5 * ft;
    return { fc, ft, Ev, fbu: fc / 1.5, ssEls, ssElu, tauSans, tauLim, tauSu, sigb: v.SIGMAF };
  }

  // Modèle aux éléments : piédroits discrétisés (pas hp), traverse aux abscisses xs.
  function modele(g, mat, v, xs, zs) {
    const fr = new Frame();
    const { L, H, sn, B, D } = g;
    const I2 = mat.Ev * g.e2 ** 3 / 12 / sn ** 3, I3 = mat.Ev * g.e3 ** 3 / 12;
    const NL = zs.map(z => fr.node(0, z)), NR = zs.map(z => fr.node(L, z));
    const bl = [], br = [];
    for (let i = 0; i < zs.length - 1; i++) { bl.push(fr.bar(NL[i], NL[i + 1], I2)); br.push(fr.bar(NR[i + 1], NR[i], I2)); }
    const T = xs.map((x, k) => k === 0 ? NL[NL.length - 1] : (k === xs.length - 1 ? NR[NR.length - 1] : fr.node(x, H)));
    const bt = []; for (let k = 0; k < xs.length - 1; k++) bt.push(fr.bar(T[k], T[k + 1], I3));
    // Appui : pied de piédroit bloqué en translation, ressort de rotation k_r (sol sous semelle).
    // Excentrement de la semelle : la réaction verticale N (effort normal du piédroit) agit au centre de la
    // semelle, à D/sinφ (longueur biaise) de l'axe du piédroit -> moment N·D/sinφ au pied, sans cinématique
    // de barre rigide (couplage non symétrique ; LI reproduites à 0.0001 sur les 11 passages à semelle fixe).
    const C0 = NL[0], C1 = NR[0];
    const kr = v.ESOL * B * B / 24 * sn;
    fr.spring(C0, [Infinity, Infinity, kr]); fr.spring(C1, [Infinity, Infinity, kr]);
    const Db = D / sn;
    if (Math.abs(Db) > 1e-9 && !globalThis.PIPO_NOECC) {
      // effort normal (compression > 0) de la 1re barre de chaque piédroit = EA/l·(v_bas − v_haut) ; moment au pied = ± N·Db
      const cpl = (b, nb, nh, sg) => { const k = fr.bars[b].EA / fr.bars[b].L; fr.kij(nb * 3 + 2, nb * 3 + 1, -sg * Db * k); fr.kij(nb * 3 + 2, nh * 3 + 1, sg * Db * k); };
      cpl(bl[0], NL[0], NL[1], 1); cpl(br[0], NR[0], NR[1], -1);
    }
    fr.assemble();
    const m = { fr, NL, NR, bl, br, T, bt, C0, C1, kr, xs, zs };
    // moments (convention SETRA : positif = traction intérieure) aux sections
    m.post = function (r) {
      const Mt = xs.map((x, k) => k < bt.length ? -r.end[bt[k]][2] : r.end[bt[k - 1]][5]);
      const Mp = zs.map((z, k) => k < bl.length ? -r.end[bl[k]][2] : r.end[bl[k - 1]][5]);
      const Vt = xs.map((x, k) => k < bt.length ? r.end[bt[k]][1] : -r.end[bt[k - 1]][4]);
      const Vp = zs.map((z, k) => k < bl.length ? r.end[bl[k]][1] : -r.end[bl[k - 1]][4]);
      const th = r.U[C0 * 3 + 2];
      const Mc = -kr * th; // moment sol au centre de semelle gauche
      return { Mt, Mp, Vt, Vp, Mc, N: r.end[bl[0]][0], Hb: r.end[bl[0]][1] };
    };
    m.solve = cs => m.post(fr.solve(cs));
    return m;
  }

  function grille(a, b, pas) { const o = []; for (let x = a; x <= b + 1e-6; x += pas) o.push(Math.round(x * 1000) / 1000); return o; }

  function computeCore(v) {
    const g = geometrie(v), mat = materiaux(v);
    const pas = v.LU === 2 ? 0.25 : 0.5;
    const xsLI = grille(0, g.L, pas); if (g.L - xsLI[xsLI.length - 1] > 1e-3) xsLI.push(g.L);
    const xsSec = grille(0, g.L / 2, pas);
    const zsSec = grille(0, g.H - 1e-6, pas);
    const xs = [...new Set([...xsLI, g.L / 2, g.L].map(x => Math.round(x * 1e6) / 1e6))].sort((a, b) => a - b);
    const zs = [...new Set([...grille(0, g.H, Math.min(pas, 0.25)), g.H].map(z => Math.round(z * 1e6) / 1e6))].sort((a, b) => a - b);
    const M = modele(g, mat, v, xs, zs);
    const ix = x => xs.findIndex(t => Math.abs(t - x) < 1e-5), iz = z => zs.findIndex(t => Math.abs(t - z) < 1e-5);
    const iMid = ix(Math.round(g.L / 2 * 1e6) / 1e6), iTop = zs.length - 1;
    const node = x => M.T[ix(x)];

    // ---- Lignes d'influence (charge unité sur la traverse)
    const li = xsLI.map(x => {
      const r = M.solve({ nodal: { [node(Math.round(x * 1e6) / 1e6)]: [0, -1, 0] } });
      return { x, r };
    });
    const sn = g.sn, B = g.B;
    const xe = g.D - B / 2, aExt = -g.e2 / 2 - xe, aInt = g.D + B / 2 - g.e2 / 2;
    const semelle = (r, VV, HH) => {
      // réaction verticale (largeur droite -> biaise) et moment au centre
      const V = VV * sn, Mc = r.Mc * sn * sn;
      const pe = V / B - 6 * Mc / B / B, pi = V / B + 6 * Mc / B / B;
      const mE = -(pe * aExt * aExt / 2 + (pi - pe) / B * aExt ** 3 / 6);
      const mI = -(pi * aInt * aInt / 2 + (pe - pi) / B * aInt ** 3 / 6);
      return { V, H: HH * sn, pe, pi, mE, mI };
    };
    const liRows = li.map(({ x, r }) => {
      const V = -r.Vp[0] * 0 + null;
      return { x, Minf: r.Mp[0], Msup: r.Mp[iTop], Mmid: r.Mt[iMid], r };
    });
    // réactions de la LI : effort normal du piédroit gauche (= réaction verticale) et effort tranchant à la base
    const liSem = li.map(({ x }) => {
      const res = M.fr.solve({ nodal: { [node(Math.round(x * 1e6) / 1e6)]: [0, -1, 0] } });
      const N = res.end[M.bl[0]][0]; const Hb = res.end[M.bl[0]][1];
      const p = M.post(res);
      return Object.assign({ x }, semelle(p, N, Hb));
    });

    // ---- Charges permanentes
    const RHO = 2.525; // poids volumique béton reconstitué (2.5 × 1.01)
    const qt = RHO * g.e3 + v.QSUP;
    const barsT = q => { const o = {}; M.bt.forEach(b => o[b] = { q: [-q, -q] }); return o; };
    const cp = M.solve({ bars: barsT(qt) });
    const mom = (W, x) => -W * (x - g.D);
    const dt = M.solve({ nodal: { [M.C0]: [0, 0, mom(v.QDT, 0)], [M.C1]: [0, 0, -mom(v.QDT, 0)] } });
    const lateral = (pz, extra) => {
      const bars = {};
      M.bl.forEach((b, i) => bars[b] = { q: [-pz(zs[i]), -pz(zs[i + 1])] });
      M.br.forEach((b, i) => bars[b] = { q: [-pz(zs[i + 1]), -pz(zs[i])] });
      return Object.assign({ bars }, extra || {});
    };
    const xi0 = g.e2 / 2, xi1 = g.D + B / 2, xe1 = -g.e2 / 2;
    const HEXT = globalThis.PIPO_HEXT ? globalThis.PIPO_HEXT(v) : v.HAUTL; // notice : h' = HAUTL+E3, mais les listings V1.02 donnent HAUTL
    // poids des terres sur patin / talon : moment au centre de semelle, ramené au plan biais (÷ sin²φ)
    const Mvert = (mom(v.SPEC * HEXT * (xe1 - xe), (xe + xe1) / 2) + mom(v.SPEC * v.HREMB * (xi1 - xi0), (xi0 + xi1) / 2)) / (sn * sn);
    // poussée : diagramme réel (de l'axe de la traverse au dessus de la semelle, hauteur HAUTL + E3/2)
    // étiré sur la hauteur de calcul H : p(z) = K·γ·(HAUTL + E3/2)·(1 − z/H) (reproduit à l'arrondi, 11 passages)
    const hP = v.HAUTL + g.e3 / 2;
    const terres = K => M.solve(lateral(z => K * v.SPEC * hP * Math.max(0, 1 - z / g.H), { nodal: { [M.C0]: [0, 0, Mvert], [M.C1]: [0, 0, -Mvert] } }));
    const tK1 = terres(v.RANK1), tK2 = terres(v.RANK2);
    // Moments courants du piédroit : les moments d'extrémité (hyperstatiques) sont ceux du diagramme étiré ci-dessus, mais
    // SETRA ajoute le moment isostatique du diagramme p0 = K·γ·H (triangle complet sur la hauteur de calcul) :
    // écart = (H/hP − 1) × moment isostatique du triangle (1638 : bosse maxi à 0.42 H reproduite).
    const SGI = globalThis.PIPO_ISO != null ? globalThis.PIPO_ISO : 1;
    const isoFix = (res, K) => { if (!SGI) return; const p0 = K * v.SPEC * hP * (g.H / hP - 1), H = g.H;
      res.Mp = res.Mp.map((m, k) => { const z = zs[k]; return m + SGI * (p0 * H / 3 * z - p0 * z * z / 2 + p0 * z ** 3 / (6 * H)); });
      res.Vp = res.Vp.map((t, k) => { const z = zs[k]; return t + SGI * (p0 * H / 3 - p0 * z + p0 * z * z / (2 * H)); }); };
    isoFix(tK1, v.RANK1); isoFix(tK2, v.RANK2);
    const hs = K => {
      if (!v.HSREMB) return null;
      const q = v.SPEC * v.HSREMB;
      const cs = lateral(z => K * q);
      const Mv = mom(q * (xe1 - xe), (xe + xe1) / 2) / (sn * sn);
      cs.nodal = { [M.C0]: [0, 0, Mv], [M.C1]: [0, 0, -Mv] };
      return M.solve(cs);
    };
    const hs1 = hs(v.RANK1), hs2 = hs(v.RANK2);
    function permAt(get) {
      const a = get(cp), b = get(dt), t1 = get(tK1), t2 = get(tK2), h1 = hs1 ? get(hs1) : 0, h2 = hs2 ? get(hs2) : 0;
      // MAX : K mini si l'effet des terres est négatif
      const tMax = Math.max(t1, t2), tMin = Math.min(t1, t2), hMax = Math.max(h1, h2), hMin = Math.min(h1, h2);
      const comb = (arr, sens) => arr.reduce((s, x) => s + (sens > 0 ? (x > 0 ? 1.35 * x : x) : (x < 0 ? 1.35 * x : x)), 0);
      return {
        max: [a, b, tMax, hMax, a + b + tMax + hMax, comb([a, b, tMax, hMax], 1)],
        min: [a, b, tMin, hMin, a + b + tMin + hMin, comb([a, b, tMin, hMin], -1)],
      };
    }
    // ---- Retrait / température (raccourcissement imposé de la traverse)
    const EAt = M.fr.bars[M.bt[0]].EA;
    const imposeEps = eps => M.solve({ nodal: { [M.T[0]]: [EAt * eps, 0, 0], [M.T[M.T.length - 1]]: [-EAt * eps, 0, 0] } });
    const ret = imposeEps(v.RETRAIT / mat.Ev), tem = imposeEps(v.TEMP / mat.Ev);
    // ---- Diagrammes permanents aux sections
    const comps = [cp, dt, tK1, tK2, hs1, hs2];
    const combo = get => {
      const [a, b, t1, t2, h1, h2] = comps.map(c => c ? get(c) : 0);
      const tMax = Math.max(t1, t2), tMin = Math.min(t1, t2), hMax = Math.max(h1, h2), hMin = Math.min(h1, h2);
      const c = (arr, sens) => arr.reduce((s, x) => s + (sens > 0 ? (x > 0 ? 1.35 * x : x) : (x < 0 ? 1.35 * x : x)), 0);
      return { elsMax: a + b + tMax + hMax, eluMax: c([a, b, tMax, hMax], 1), elsMin: a + b + tMin + hMin, eluMin: c([a, b, tMin, hMin], -1),
        g: a + b, t: [tMax, tMin], h: [hMax, hMin] };
    };
    const secT = xsSec.map(x => { const k = ix(Math.round(x * 1e6) / 1e6); return { x, M: combo(r => r.Mt[k]), V: combo(r => r.Vt[k]), ret: ret.Mt[k], tem: tem.Mt[k], vret: ret.Vt[k], vtem: tem.Vt[k] }; });
    const secP = zsSec.map(z => { const k = iz(z); return { x: z, M: combo(r => r.Mp[k]), V: combo(r => r.Vp[k]), ret: ret.Mp[k], tem: tem.Mp[k], vret: ret.Vp[k], vtem: tem.Vp[k] }; });
    const det = { sup: { M: combo(r => r.Mp[iTop]), ret: ret.Mp[iTop], tem: tem.Mp[iTop] }, inf: { M: combo(r => r.Mp[0]), ret: ret.Mp[0], tem: tem.Mp[0] }, mid: { M: combo(r => r.Mt[iMid]), ret: ret.Mt[iMid], tem: tem.Mt[iMid] } };
    // ---- Déplacements / rotations d'appuis
    const depl = [
      { imposed: { [M.C0]: [0, 0.01, 0] } },
      { imposed: { [M.C0]: [0.01, 0, 0], [M.C1]: [-0.01, 0, 0] } },
      { imposed: { [M.C0]: [0, 0, 0.01], [M.C1]: [0, 0, -0.01] } },
      { imposed: { [M.C0]: [0, 0, 0.01], [M.C1]: [0, 0, 0.01] } },
    ].map(cs => { const res = M.fr.solve(cs); const p = M.post(res); const N = res.end[M.bl[0]][0];
      const sm = semelle(p, N, 0); return { sup: -p.Mp[iTop], base: -p.Mp[0], mid: -p.Mt[iMid], mI: sm.mI, mE: sm.mE }; });
    for (const k of [1, 2]) for (const f of ['sup', 'base', 'mid', 'mI', 'mE']) depl[k][f] = -depl[k][f];
    const perm = {
      inf: permAt(r => r.Mp[0]), sup: permAt(r => r.Mp[iTop]), mid: permAt(r => r.Mt[iMid]),
    };

    // ---- Majoration dynamique (Fasc. 61 II art. 5.5)
    const Ld = g.L;
    const G = qt * Ld * g.larg;
    const delta = S => S > 0 ? 1 + 0.4 / (1 + 0.2 * Ld) + 0.6 / (1 + 4 * G / S) : 0;
    const essBc = [[0, 6], [4.5, 12], [6, 12], [10.5, 6], [15, 12], [16.5, 12]];
    let pBc = 0;
    for (let i = 0; i < essBc.length; i++) for (let j = i; j < essBc.length; j++)
      if (essBc[j][0] - essBc[i][0] <= Ld + 1e-9) { let s = 0; for (let k = i; k <= j; k++) s += essBc[k][1]; pBc = Math.max(pBc, s); }
    const nf = v.PVOIE || 1;
    const SBc = v.BC ? pBc * nf : 0, SBt = v.BT ? 64 : 0;
    const SMc = v.MC === 3 ? 72 : v.MC === 4 ? 110 : 0;
    const SMe = v.ME === 3 ? 44 : v.ME === 4 ? 66 : 0;
    const dBc = delta(SBc), dMc = delta(v.MC ? SMc : (v.ME === 3 ? 72 : v.ME === 4 ? 110 : 0));
    const dyn = { SBc, SBt, SMc, SMe, dBc, dBt: v.BT || v.BC ? dBc : 0, dMc, dMe: dMc };

    // ---- Portée fictive (flèche équivalente sous charge uniforme) et coefficients K
    // portée fictive : formule fermée de la notice (λ, termes en k'δ) — numériquement, l'excentrement n'y intervient
    // que pour moitié (moment N·D/(2 sinφ) au pied, N = L/2 sous charge unité) : reproduit 11 passages à 0.01 m.
    const mE = 0.5 * (g.L / 2) * g.D / sn;
    const rq = M.fr.solve({ bars: barsT(1), nodal: { [M.C0]: [0, 0, -mE], [M.C1]: [0, 0, mE] } }); const fl = -rq.U[M.T[iMid] * 3 + 1];
    const Lf = Math.pow(384 * mat.Ev * g.e3 ** 3 / 12 * fl / 5, 0.25);
    const Kc = LV.coefficientsK(v, g, Lf);
    const Ldt = v.DALTRA ? v.LDALT / g.sn : 0;
    const fA = (globalThis.PIPO_FDT != null ? globalThis.PIPO_FDT : (v.ESURCH + 2) / (Kc.nA * v.ESURCH / Math.max(1, v.PVOIE)));
    const rML = M.solve({ nodal: { [M.T[0]]: [0, 0, 1] } }), rMR = M.solve({ nodal: { [M.T[M.T.length - 1]]: [0, 0, -1] } });
    const aDT = globalThis.PIPO_ADT != null ? globalThis.PIPO_ADT * g.e2 : 0;
    const env = getf => { const f = li.map(o => getf(o.r)); let ends = [f[0] + aDT * getf(rML), f[f.length - 1] + aDT * getf(rMR)]; if (globalThis.PIPO_ENDS) ends = globalThis.PIPO_ENDS(ends);
      return LV.enveloppes(LV.makeLI(xsLI, f, g.L, Ldt, 1, ends), v, g, dyn, Kc, LV.makeLI(xsLI, f, g.L, 0), false, LV.makeLI(xsLI, f, g.L, Ldt, fA, ends)); };
    // effort tranchant de la traverse : la LI présente un saut unité à la section ; SETRA retient l'ordonnée du côté
    // de l'appui gauche (charge juste à gauche de la section) en plus de celle de droite (T_TRAVERSE : réf(x) = ancienne(x − pas)).
    const JV = globalThis.PIPO_JV != null ? globalThis.PIPO_JV : 1;
    const envJ = (getf, xk) => { const f = li.map(o => getf(o.r)); const j = xsLI.findIndex(x => Math.abs(x - xk) < 1e-6);
      if (j < 0 || !JV) return env(getf);
      let xs2 = [...xsLI.slice(0, j + 1), xsLI[j], ...xsLI.slice(j + 1)], f2 = [...f.slice(0, j), f[j] + JV, f[j], ...f.slice(j + 1)];
      // tour 7 : pas de point dédoublé — ordonnée de gauche (f+1) au point de la section, variation linéaire jusqu au point suivant
      if (globalThis.PIPO_JV2 !== 0) { xs2 = xsLI.slice(); f2 = f.slice(); f2[j] = f[j] + JV; }
      const ends = [f[0] + aDT * getf(rML), f[f.length - 1] + aDT * getf(rMR)];
      return LV.enveloppes(LV.makeLI(xs2, f2, g.L, Ldt, 1, ends), v, g, dyn, Kc, LV.makeLI(xs2, f2, g.L, 0), false, LV.makeLI(xs2, f2, g.L, Ldt, fA, ends)); };
    const liveT = xsSec.map(x => { const k = ix(Math.round(x * 1e6) / 1e6); return { M: env(r => r.Mt[k]), V: envJ(r => r.Vt[k], x) }; });
    const liveP = zsSec.map(z => { const k = iz(z); return { M: env(r => r.Mp[k]), V: env(r => r.Vp[k]) }; });
    const liveDet = { sup: env(r => r.Mt[0]), inf: env(r => r.Mp[0]), mid: env(r => r.Mt[iMid]) };
    // ---- Pressions sous semelle (bords extérieur / intérieur), largeur biaise
    const Wp = 2.525 * g.e2 * v.HAUTL; // poids du piédroit : même ρ = 2.525 que la traverse (semelle : 2.5)
    // Réaction par m de culée (biais) : efforts du cadre × sinφ (N) et × sin²φ (moments au centre de semelle) ;
    // dalle de transition : QDT·sinφ et moment × sinφ ; poids du remblai HSREMB sur le patin compté (1890 exact).
    const Nfix = Wp + 2.5 * g.e1 * B + v.SPEC * v.HAUTL * aExt + v.SPEC * v.HREMB * aInt + v.QDT * sn + v.SPEC * v.HSREMB * aExt;
    const press = (tk, hk) => { const N = (cp.N + dt.N + tk.N + (hk ? hk.N : 0)) * sn + Nfix, Ms = (cp.Mc + tk.Mc + (hk ? hk.Mc : 0)) * sn * sn + dt.Mc * sn - Wp * g.D;
      return [N / B - 6 * Ms / B / B, N / B + 6 * Ms / B / B]; };
    const p1 = press(tK1, hs1), p2 = press(tK2, hs2);
    const pRT = c => [-6 * c.Mc * sn * sn / B / B, 6 * c.Mc * sn * sn / B / B];
    const fPe = li.map(o => 0), semLIpe = liSem.map(s => s.pe), semLIpi = liSem.map(s => s.pi);
    const envS = f => LV.enveloppes(LV.makeLI(xsLI, f, g.L, Ldt), v, g, dyn, Kc, LV.makeLI(xsLI, f, g.L, 0), true);
    const pressions = {
      ext: { max: Math.max(p1[0], p2[0]), min: Math.min(p1[0], p2[0]), live: envS(semLIpe), ret: pRT(ret)[0], tem: pRT(tem)[0] },
      int: { max: Math.max(p1[1], p2[1]), min: Math.min(p1[1], p2[1]), live: envS(semLIpi), ret: pRT(ret)[1], tem: pRT(tem)[1] },
    };
    // ---- Moments et efforts tranchants dans la semelle (sections encastrement, 3/4, 1/2, 1/4 du débord)
    // Débord ext. (patin) de longueur aExt depuis le bord extérieur, int. (talon) aInt depuis le bord intérieur.
    // Charge nette = poids (semelle 2.5·e1 + terres γ·HAUTL (+ γ·HSREMB) sur le patin, γ·HREMB sur le talon)
    // − réaction du sol (loi linéaire pe → pi) ; QDT n'est pas déduit (ELS exact, 10 passages).
    const wSem = { E: 2.5 * g.e1 + v.SPEC * (v.HAUTL + v.HSREMB), I: 2.5 * g.e1 + v.SPEC * v.HREMB };
    const semEff = (pe, pi, side, t, w) => { const a = side === 'E' ? aExt : aInt, l = t * a; const p0 = side === 'E' ? pe : pi, p1 = side === 'E' ? pi : pe, gr = (p1 - p0) / B;
      return [-(p0 * l * l / 2 + gr * l ** 3 / 6) + w * l * l / 2, -(p0 * l + gr * l * l / 2) + w * l]; };
    const semComps = (tk, hk) => { const pp = (N, Mm) => [N / B - 6 * Mm / B / B, N / B + 6 * Mm / B / B];
      return [[pp(cp.N * sn, cp.Mc * sn * sn), 0, 0], [pp(dt.N * sn + v.QDT * sn, dt.Mc * sn), 0, 0],
        [pp(tk.N * sn + v.SPEC * v.HAUTL * aExt + v.SPEC * v.HREMB * aInt, tk.Mc * sn * sn), v.SPEC * v.HAUTL, v.SPEC * v.HREMB],
        [hk ? pp(hk.N * sn + v.SPEC * v.HSREMB * aExt, hk.Mc * sn * sn) : [0, 0], v.SPEC * v.HSREMB, 0],
        [pp(Wp, -Wp * g.D), 0, 0], [pp(2.5 * g.e1 * B, 0), 2.5 * g.e1, 2.5 * g.e1]]; };
    const semCases = [semComps(tK1, hs1), semComps(tK2, hs2)];
    const semT = [1, 0.75, 0.5, 0.25];
    const envSD = f => LV.enveloppes(LV.makeLI(xsLI, f, g.L, Ldt), v, g, dyn, Kc, LV.makeLI(xsLI, f, g.L, 0), false);
    const semelleEff = {};
    for (const side of ['E', 'I']) {
      semelleEff[side] = semT.map(t => {
        const per = j => { // j = 0 moment, 1 effort tranchant
          const vals = semCases.map(cs => cs.map(([p, qE, qI]) => semEff(p[0], p[1], side, t, side === 'E' ? qE : qI)[j]));
          const els = vals.map(a => a.reduce((s, x) => s + x, 0));
          const uMax = vals.map(a => a.reduce((s, x) => s + (x > 0 ? 1.35 * x : x), 0)), uMin = vals.map(a => a.reduce((s, x) => s + (x < 0 ? 1.35 * x : x), 0));
          return { elsMax: Math.max(...els), elsMin: Math.min(...els), eluMax: Math.max(...uMax), eluMin: Math.min(...uMin) };
        };
        const liM = liSem.map(s => semEff(s.pe, s.pi, side, t, 0)[0]), liV = liSem.map(s => semEff(s.pe, s.pi, side, t, 0)[1]);
        const rt = c => { const q = pRT(c); return semEff(q[0], q[1], side, t, 0); };
        return { t, M: per(0), V: per(1), liveM: envSD(liM), liveV: envSD(liV), ret: rt(ret), tem: rt(tem) };
      });
    }
    const out = { v, g, mat, pas, pressions, semelleEff, Lf, Kc, Ldt, liveT, liveP, liveDet, xsLI, xsSec, zsSec, li: liRows, liSem, perm, dyn, aExt, aInt, secT, secP, det, depl };
    Object.defineProperty(out, '_M', { value: M, enumerable: false });
    Object.defineProperty(out, '_comps', { value: { cp, dt, tK1, tK2, hs1, hs2 }, enumerable: false });
    Object.defineProperty(out, '_iTop', { value: iTop, enumerable: false });
    Object.defineProperty(out, '_iMid', { value: iMid, enumerable: false });
    return out;
  }

  // Pressions totales ELS (bords extérieur / intérieur) pour le dimensionnement de la semelle.
  function pressionsTotales(r) {
    return ['ext', 'int'].map(k => { const p = r.pressions[k], e = p.live.max;
      return LV.combine({ Gels: p.max, Gelu: p.max, A: e.A.eff, BC: e.BC.eff, BT: e.BT.eff, ME: e.ME.eff, MC: e.MC.eff, EX: e.EX.eff, TR: e.TR.eff, RT: p.ret, TP: p.tem }, 1).els; });
  }
  // Dimensionnement de la semelle (FIXSEM = 0), reconstitué sur la séquence imprimée de 1799 :
  // critère : pression totale ELS ≤ PREMAX sur les deux bords. Si les deux bords dépassent : W += 0.20.
  // Si un seul bord dépasse : essai de DELTA ∓ 0.05 dans le sens défavorable (imprimé, non retenu), puis pas de 0.05
  // dans le sens qui soulage ce bord tant que l'autre bord reste admissible ; dès qu'il dépasse, W += 0.20 (DELTA conservé).
  function dimensionner(v0) {
    const seq = []; let W = v0.W, D = v0.DELTA, r = null;
    const ev = (w, d) => { const v = Object.assign({}, v0, { W: w, DELTA: d }); const rr = computeCore(v); seq.push([w, d]); return { r: rr, p: pressionsTotales(rr) }; };
    const lim = v0.PREMAX, ok = p => p.map(x => x <= lim + 1e-9);
    let cur = ev(W, D);
    for (let it = 0; it < 60; it++) {
      const o = ok(cur.p);
      if (o[0] && o[1]) break;
      if (!o[0] && !o[1]) { W = Math.round((W + 0.2) * 100) / 100; cur = ev(W, D); continue; }
      const k = o[0] ? 1 : 0, dir = k === 0 ? -1 : 1; // dir : sens de DELTA qui soulage le bord k
      ev(W, Math.round((D - dir * 0.05) * 100) / 100); // essai dans le sens défavorable
      let moved = false;
      for (let j = 0; j < 40; j++) {
        const d2 = Math.round((D + dir * 0.05) * 100) / 100; const nx = ev(W, d2); D = d2; cur = nx; moved = true;
        const o2 = ok(nx.p); if (o2[0] && o2[1]) break; if (!o2[1 - k]) break;
      }
      const o3 = ok(cur.p); if (o3[0] && o3[1]) break;
      W = Math.round((W + 0.2) * 100) / 100; cur = ev(W, D);
    }
    r = cur.r; r.dimSeq = seq; return r;
  }
  function compute(modele0) {
    const v = flat(modele0);
    const r = (v.FIXSEM === 0 && v.PREMAX > 0 && !globalThis.PIPO_NODIM) ? dimensionner(v) : Object.assign(computeCore(v), { dimSeq: [[v.W, v.DELTA]] });
    r.mu = FER.plaqueMu(r);
    if (v.MOTRAN) { const T = FER.transversal(r), dT = r.g.e3 - 0.025 - v.PHI2 / 2;
      T.A = Math.max(FER.asELU(T.Mu, dT, r.mat.fbu, r.mat.ssElu[1]), v.FIP ? FER.asELS(T.Ms, dT, r.mat.ssEls[1], v.SIGMAF) : 0); r.transversal = T; }
    r.fer = FER.ferraillage(r);
    return r;
  }
  const api = { compute, geometrie, materiaux };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PIPO_COMPUTE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
