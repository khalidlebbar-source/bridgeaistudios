/* RADBAN-RAPEN — tabliers de ponts-rails en dalle béton armé (RADBA) ou à poutrelles enrobées (RAPEN),
 * calcul « en poutre » (moteur pur, aucun DOM ; node → module.exports, navigateur → window.BA.tablierRail).
 *
 * Ce module orchestre les moteurs du socle, sans les réécrire :
 *   BA.poutre    lignes d'influence de la poutre continue (1 à 7 travées + consoles), charges fixes, dénivellations,
 *                SW/0, SW/2 (envModele), Φ (LPhi) ;
 *   BA.charges   Φ2, Φ3 ;
 *   BA.repartition     coefficient de répartition transversale K de Guyon-Massonnet (Kcharge) ;
 *   BA.sectionBA sections d'acier BAEL / EC2 de la dalle (RADBA) : dimELU2, els, props, tranchantBAEL/EC2 ;
 *   BA.enrobees    inerties ELS (court / long terme, fissurées ou non) et moments résistants ELU (RAPEN).
 *
 * Références :
 *  - Livret 2.01 (fév. 1995) : groupes de charges Gr12 (UIC 71 ou SW/0 sur les voies chargées) et Gr14 (SW/2 sur une
 *    voie + UIC 71/SW/0 sur l'autre), coefficients γ×ψ du tableau 1 (ELU 1,35 G ; 1,45 Gr12 ; 1,35 Gr14 ; 1,16 Gr12
 *    d'accompagnement ; accotements 1,20 / 1,50 ; ELS 1,0 / 0,8), charges permanentes amovibles × 1,30.
 *  - EN 1991-2 §6.3.2 (LM71 : 4 × 250 kN sur 6,40 m + 80 kN/m), §6.3.3 (SW/0, SW/2), §6.3.6.2 (répartition longitudinale
 *    des charges d'essieu : la charge de la locomotive est répartie uniformément sur 6,40 m), §6.4.5.2 (Φ2, Φ3),
 *    tableau 6.2 cas 5.1 (LΦ des poutres continues), §6.3.6.4 (accotements 5 kN/m²).
 *  - EN 1990 annexe A2 : combinaisons ELU/ELS (γG = 1,35/1,00, γQ = 1,45 pour LM71/SW0, 1,20 pour SW/2, γ dénivellations
 *    1,20, ψ0 = 0,80), §A2.4.4.2.3 (confort des voyageurs : limite L/δ de la figure A2.3, × 0,9 pour 3 travées continues
 *    ou plus, × 0,7 pour une ou deux travées).
 *  - BAEL 91 mod. 99 et Livret 2.01 chap. 2A (fsu = 0,8 fe/γs), EN 1992-1-1/-2 (sections BA, via BA.sectionBA).
 *  - EN 1994-2 §6.3 (poutrelles enrobées), EN 1993-1-1 §6.2.6 (Av = A − 2 b tf + (tw + 2 r) tf, Vpl,Rd = Av fy/(√3 γM0)).
 *  - Fascicule 61 titre V art. 19 (déversement des poutrelles pendant le bétonnage, méthode simplifiée).
 *
 * Conventions : x mesuré depuis l'axe du premier appui (culée C0) ; consoles en x < 0 et x > ΣL.
 * Moments M > 0 en travée (fibre inférieure tendue), comme BA.poutre ; la note les affiche avec cette convention.
 * Unités : kN, m, kN·m ; MPa pour les matériaux ; sections d'acier en cm².
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  const req = (p, k) => (isNode ? require(p) : root.BA && root.BA[k]);
  const P = req('./poutres-continues.js', 'poutre'), CH = req('./charges.js', 'charges'), GM = req('./repartition.js', 'repartition');
  const SB = req('./sections-ba.js', 'sectionBA'), IN = req('./poutrelles-enrobees.js', 'enrobees');
  const GR = Math.PI / 200;
  const sum = (a) => a.reduce((s, v) => s + v, 0);

  /* ═══════════════════════ 1. Jeux de données par défaut ═══════════════════════ */
  // RADBA : d'après l'exemple « Radban1 » (3 travées 14 + 20 + 14 m, dalle de 1,15 m, 2 voies)
  const DEF_RADBA = {
    type: 'radba', projet: 'Pont-rail en dalle BA — 3 travées', regl: 'livret',
    travees: [14, 20, 14], cg: 0.45, cd: 0.45, biais: 110,
    Btot: 11.88, h: 1.15, lc: 0.8, er: 0.325, penteC: 0.5, penteExt: 0.01, dRebord: 0.2,
    nVoies: 2, eV: [-2.4, 2.4], nCharge: 2, hb: 0.35, ltrav: 2.25, alpha: 1, entretien: 'soigne', vmax: 351, Ldelta: 1500,
    uicReparti: true, repartition: 'repartition-transversale', Ksaisi: 1,
    gBeton: 25, Gna: 20.83, Gb: 112.4, Ga: 9.39, kAmov: 1.3, qAcc: 5, lAcc: 0.85, den: 0.01,
    fck: 32, fe: 500, fissuration: 1, dSup: 0.06, dInf: 1.09, fet: 400, AsMin: 3,
    appuis: { nCulee: 4, nPile: 4, y: [-4.65, -1.55, 1.55, 4.65] },
    percage: null,
  };
  // RAPEN : d'après l'exemple « Rapen1 » (3 travées 15 + 25 + 15 m, 14 HEA 1000)
  const DEF_RAPEN = {
    type: 'rapen', projet: 'Pont-rail à poutrelles enrobées — 3 travées', regl: 'livret',
    travees: [15, 25, 15], cg: 0.45, cd: 0.45, biais: 110,
    Btot: 11.88, h: 1.09, lc: 0.8, er: 0.325, penteC: 0.5, penteExt: 0, dRebord: 0.2,
    nVoies: 2, eV: [-2.4, 2.4], nCharge: 1, hb: 0.35, ltrav: 2.25, alpha: 1, entretien: 'soigne', vmax: 351, Ldelta: 1500,
    uicReparti: true, repartition: 'repartition-transversale', Ksaisi: 1,
    gBeton: 25, Gna: 40.58, Gb: 0, Ga: 12.17, kAmov: 1.3, qAcc: 5, lAcc: 0.85, den: 0.01,
    fck: 32, fe: 500, fissuration: 1, fet: 400,
    profil: 'HEA 1000', nPout: 14, nuance: 'S355', fy: 345, ecof: 0.02, csup: 0.1277, AsChap: 94.26, AsMinM: 4, dAs: 0.0603,
    nCourt: 6, nLong: 18, sigS: 270, gammaA: 1.05, seuilChap: 0.10, debLat: 0.12, debDal: 0.05,
    appuis: { nCulee: 14, nPile: 14, y: Array.from({ length: 14 }, (_, k) => +(-4.87 + 0.74923 * k).toFixed(5)) },
    percage: { espEnt: 4.85, rangEnt: 0.2, dEnt: 0.024, dTrouEnt: 0.03, zEnt: 0.09, espFer: 0.3, dTrouFer: 0.04, zFer: 0.05, debord: 0.35, aboutFer: 0.1 },
  };

  /* ═══════════════════════ 2. Géométrie transversale ═══════════════════════ */
  /* Coupe : largeur droite Btot, épaisseur h (mini, en rive des formes de pente), consoles de rive de longueur lc,
   * épaisseur er à l'extrémité, pente de sous-face penteC (V/H), forme de pente de l'extrados penteExt à partir de dRebord
   * (épaisseur croissant vers l'axe). Intégration par bandes verticales : aire, c.d.g., inertie. */
  function coupe(d) {
    const B = +d.Btot, n = 2000, dy = B / n;
    let A = 0, S = 0, J = 0, Ares = 0;
    const Bres = B - 2 * d.lc;
    for (let i = 0; i < n; i++) {
      const y = (i + 0.5) * dy, u = Math.min(y, B - y);
      const bot = u < d.lc ? Math.min(d.h, d.er + d.penteC * u) : d.h;
      const fp = u > d.dRebord ? d.penteExt * (u - d.dRebord) : 0;
      const z1 = -fp, z2 = bot, t = z2 - z1;
      A += t * dy; S += t * dy * (z1 + z2) / 2; J += dy * (z2 ** 3 - z1 ** 3) / 3;
      if (u >= d.lc) Ares += t * dy;
    }
    const zg = S / A, I = J - A * zg * zg, hm = Math.sqrt(12 * I / A);
    return { A, zg, I, hm, beq: A / hm, Bres, hmRes: Ares / Bres, hAxe: d.h + d.penteExt * Math.max(0, B / 2 - d.dRebord) };
  }

  /* ═══════════════════════ 3. Charges mobiles ═══════════════════════ */
  /* LM71 avec la charge de la locomotive répartie sur 6,40 m (156,25 kN/m) et 80 kN/m fractionnable de part et d'autre
   * (EN 1991-2 §6.3.6.2 (2)) : f(s) = 156,25·∫[s, s+6,4] η + 80·(∫η⁺ − ∫[s, s+6,4] η⁺). f est quadratique par morceaux en s :
   * on évalue f aux points de rupture (nœuds et zéros de la ligne d'influence, décalés de 0 et 6,40 m) et au sommet
   * de chaque parabole. */
  const QLOC = 1000 / 6.4, QWAG = 80, LLOC = 6.4;
  function envUICrep(li) {
    const pts = li.X.concat(li.zeros), cand = [];
    for (const x of pts) { cand.push(x, x - LLOC); }
    cand.push(li.x0 - LLOC - 0.1, li.xn + 0.1);
    const C = Float64Array.from(cand).sort();
    const f = (s) => { const e = QLOC * li.integ(s, s + LLOC); return [e + QWAG * (li.Ptot - li.pos(s, s + LLOC)), e + QWAG * (li.Ntot - li.neg(s, s + LLOC))]; };
    let mx = QWAG * li.Ptot, mn = QWAG * li.Ntot, prev = null;
    for (let k = 0; k < C.length; k++) {
      const s = C[k]; if (prev !== null && s - prev[0] < 1e-9) continue;
      const v = f(s); if (v[0] > mx) mx = v[0]; if (v[1] < mn) mn = v[1];
      if (prev) {
        const [sa, va] = prev, sm = (sa + s) / 2, vm = f(sm);
        for (let c = 0; c < 2; c++) {
          if (c === 0 ? vm[0] > mx : vm[1] < mn) { if (c === 0) mx = vm[0]; else mn = vm[1]; }
          const den = va[c] - 2 * vm[c] + v[c];
          if (Math.abs(den) > 1e-12) { const t = 0.5 * (va[c] - v[c]) / den; if (t > -0.5 && t < 0.5) { const w = f(sm + t * (s - sa)); if (w[0] > mx) mx = w[0]; if (w[1] < mn) mn = w[1]; } }
        }
      }
      prev = [s, v];
    }
    return { max: Math.max(0, mx), min: Math.min(0, mn) };
  }
  /* enveloppe d'un modèle sur une ligne d'influence : {max, min} (valeurs caractéristiques, une voie, sans Φ) */
  function env(li, mod, rep) {
    if (mod === 'UIC71') { if (rep) return envUICrep(li); const r = P.envModele(li, 'UIC71', {}); return { max: r.max.v, min: r.min.v }; }
    const r = P.envModele(li, mod, {}); return { max: r.max.v, min: r.min.v };
  }

  /* coefficient de majoration dynamique (EN 1991-2 §6.4.5.2, LΦ du tableau 6.2 cas 5.1 ; Livret 2.01 identique) */
  function phi(d) {
    const Lphi = P.LPhi(d.travees);
    const f = d.phiSaisi > 0 ? +d.phiSaisi : (d.entretien === 'courant' ? CH.phi3(Lphi) : CH.phi2(Lphi));
    return { Lphi, phi: f, alpha: +d.alpha || 1 };
  }

  /* Répartition transversale (calcul en poutre + coefficient de répartition, documenté) :
   * dalle orthotrope isotrope (α = 1) de largeur 2b, portée équivalente Le = L (1 travée), 0,9 L (travée de rive),
   * 0,8 L (travée intermédiaire) ; θ = b/Le. Pour chaque voie d'excentricité e, la charge est répartie sur la largeur
   * lt = ltrav + 2·hb/4 + 2·(hd/2)/4 (EN 1991-2 §6.3.6.3, diffusion 4:1 dans le ballast et le béton) ; le coefficient
   * appliqué au moment global de la dalle est K à l'axe de la dalle (y = 0), comme le programme de référence. */
  function coefK(d, g) {
    const nT = d.travees.length;
    const b = (d.type === 'rapen' ? g.Bres : g.beq) / 2, hd = d.type === 'rapen' ? +d.h : g.hm;
    const lt = (+d.ltrav || 2.25) + 2 * (+d.hb || 0) / 4 + 2 * (hd / 2) / 4;
    const voies = (d.eV || [0]).slice(0, d.nVoies);
    return d.travees.map((L, i) => {
      const Le = nT === 1 ? L : (i === 0 || i === nT - 1 ? 0.9 * L : 0.8 * L);
      if (d.repartition === 'saisi') return { Le, theta: b / Le, K: voies.map(() => +d.Ksaisi || 1), lt };
      const p = { b, theta: b / Le, alpha: 1 };
      return { Le, theta: p.theta, lt, K: voies.map((e) => GM.Kcharge(p, 0, e - lt / 2, e + lt / 2)) };
    });
  }

  /* ═══════════════════════ 4. Combinaisons ═══════════════════════ */
  /* Termes d'une combinaison : γ des charges permanentes (défavorable, favorable), des dénivellations, groupe de charges
   * (Gr12 = 'A' : UIC 71 / SW/0 sur les voies chargées ; Gr14 = 'B' : SW/2 sur une voie + UIC 71 / SW/0 sur l'autre),
   * accotements. */
  function combinaisons(regl) {
    if (regl === 'ec') return {
      gSup: 1.35, gInf: 1.0, gDen: 1.2,
      ELU: [{ id: 'ELU1', gr: 'A', q: 1.45, acc: 1.5 * 0.8 }, { id: 'ELU2', gr: 'B', q: 1.20, acc: 1.5 * 0.8 }, { id: 'ELU3', gr: 'A', q: 1.45 * 0.8, acc: 1.5 }],
      ELS: [{ id: 'ELS1', gr: 'A', q: 1, acc: 0.8 }, { id: 'ELS2', gr: 'B', q: 1, acc: 0.8 }, { id: 'ELS3', gr: 'A', q: 0.8, acc: 1 }],
      txt: ['ELU1 = 1,35 Gmax ou 1,00 Gmin + 1,20 Δ + 1,45 grA + 1,50×0,8 Acc', 'ELU2 = 1,35 Gmax ou 1,00 Gmin + 1,20 Δ + 1,20 grB (SW/2) + 1,50×0,8 Acc', 'ELU3 = 1,35 Gmax ou 1,00 Gmin + 1,20 Δ + 1,50 Acc + 1,45×0,8 grA',
        'ELS1 = G + Δ + grA + 0,8 Acc', 'ELS2 = G + Δ + grB + 0,8 Acc', 'ELS3 = G + Δ + Acc + 0,8 grA'],
    };
    return { // Livret 2.01 tableau 1 (colonnes 3 et 5)
      gSup: 1.35, gInf: 1.0, gDen: 1.35,
      ELU: [{ id: 'ELU1', gr: 'A', q: 1.45, acc: 1.2 }, { id: 'ELU2', gr: 'B', q: 1.35, acc: 1.2 }, { id: 'ELU3', gr: 'A', q: 1.16, acc: 1.5 }],
      ELS: [{ id: 'ELS1', gr: 'A', q: 1, acc: 0.8 }, { id: 'ELS2', gr: 'B', q: 1, acc: 0.8 }, { id: 'ELS3', gr: 'A', q: 0.8, acc: 1 }],
      txt: ['ELU1 = 1,35 Gmax ou 1,00 Gmin + 1,35 Δ + 1,45 Gr12 + 1,20 Acc', 'ELU2 = 1,35 Gmax ou 1,00 Gmin + 1,35 Δ + 1,35 Gr14 + 1,20 Acc', 'ELU3 = 1,35 Gmax ou 1,00 Gmin + 1,35 Δ + 1,50 Acc + 1,16 Gr12',
        'ELS1 = G + Δ + Gr12 + 0,8 Acc', 'ELS2 = G + Δ + Gr14 + 0,8 Acc', 'ELS3 = G + Δ + Acc + 0,8 Gr12'],
    };
  }
  /* valeur extrême d'une combinaison à partir des composantes {pp, supMax, supMin, den:{max,min}, A:{max,min}, B, acc}
   * sens = +1 (maximum) ou −1 (minimum). La charge permanente (pp + superstructures) est pondérée par γsup ou γinf
   * selon son effet ; les superstructures prennent la valeur max (amovibles × 1,3) ou min la plus défavorable. */
  function comb(c, k, sens, elu, C) {
    const gs = elu ? C.gSup : 1, gi = elu ? C.gInf : 1, gd = elu ? C.gDen : 1;
    const cands = [gs * (c.pp + c.supMax), gs * (c.pp + c.supMin), gi * (c.pp + c.supMax), gi * (c.pp + c.supMin)];
    const G = sens > 0 ? Math.max(...cands) : Math.min(...cands);
    const pick = (o) => (sens > 0 ? o.max : o.min);
    return G + gd * pick(c.den) + k.q * pick(c[k.gr]) + k.acc * pick(c.acc);
  }

  /* ═══════════════════════ 5. Calcul ═══════════════════════ */
  function normaliser(d0) {
    const base = d0.type === 'rapen' ? DEF_RAPEN : DEF_RADBA;
    const d = Object.assign({}, base, d0);
    d.travees = (d.travees || []).map(Number).filter((L) => L > 0);
    if (!d.travees.length || d.travees.length > 7) throw new Error('Le tablier doit avoir de 1 à 7 travées.');
    if (!(d.biais >= 70 && d.biais <= 130)) throw new Error('Calcul en poutre : biais compris entre 70 et 130 grades (au-delà, un calcul en plaque est nécessaire).');
    d.nVoies = Math.max(1, Math.min(2, Math.round(+d.nVoies || 1)));
    d.nCharge = Math.max(1, Math.min(d.nVoies, Math.round(+d.nCharge || d.nVoies)));
    d.eV = (d.eV || [0, 0]).map(Number);
    d.appuis = Object.assign({}, base.appuis, d.appuis || {});
    return d;
  }

  function calcul(d0) {
    const d = normaliser(d0), C = combinaisons(d.regl), alertes = [];
    const g = coupe(d), nT = d.travees.length, Ltot = sum(d.travees);
    const rapen = d.type === 'rapen';
    /* ── matériaux et rigidités ── */
    const Ei = d.regl === 'ec' ? 22000 * Math.pow((d.fck + 8) / 10, 0.3) : 11000 * Math.cbrt(d.fck);   // EC2 tab. 3.1 / BAEL A.2.1,21
    const Ev = d.regl === 'ec' ? Ei / 3 : Ei / 3;                                                     // BAEL A.2.1,22 (Ev = Ei/3) ; EC : 1 + φ = 3
    let EIcd, EIld, ine = null, prof = null;
    if (rapen) {
      prof = IN.profiles.get(d.profil);
      if (!prof) throw new Error('Profilé inconnu : ' + d.profil);
      const inpIN = (As) => ({ profil: { mode: 'cat', nom: prof.nom }, N: d.nPout, B: g.Bres, csup: d.csup, typeSous: 'apparente', ecof: d.ecof,
        nappes: As > 0 ? [{ pos: 'sup', As, d: d.dAs }] : [], fck: d.fck, fyk: d.fe, nuance: d.nuance, fy: d.fy || 0, gammaA: d.gammaA, gammaC: 1.5, gammaS: 1.15,
        congesELU: false, nMode: d.regl === 'ec' ? 'ec4' : 'saisi', nCourt: d.nCourt, nLong: d.nLong });
      const AsM = d.AsMinM * g.Bres;                         // minimum de 4 cm²/m (Livret 2.01) sur la largeur résistante
      ine = { AsMin: AsM, courant: IN.calcul(inpIN(AsM)), chapeau: IN.calcul(inpIN(Math.max(AsM, d.AsChap))) };
      const Ea = IN.Ea * 1000, tr = ine.courant.travee.cas, by = (id) => tr.find((c) => c.id === id);
      EIcd = Ea * by('ctnf').I; EIld = Ea * by('ltnf').I;
      ine.Ea = IN.Ea; ine.Is = d.nPout * prof.Iy / 1e8; ine.Ic = by('ctnf').I; ine.Icf = by('ctf').I; ine.Il = by('ltnf').I; ine.Ilf = by('ltf').I;
    } else {
      EIcd = Ei * 1000 * g.I; EIld = Ev * 1000 * g.I;
    }
    /* ── structure : poutre continue, inertie constante ; lignes d'influence calculées pour EI = 10⁶ kN·m² ── */
    const EI0 = 1e6;
    const model = { E: 1000, ns: 10, travees: d.travees.map((L) => ({ L, Ig: 1 })), consoles: { g: d.cg, d: d.cd }, appuis: d.travees.concat([0]).map(() => ({ type: 'simple' })) };
    const S = P.build(model), LI = P.lignes(S);
    const x0 = -d.cg, xn = Ltot + d.cd;
    /* ── charges permanentes (par ml de tablier) ── */
    let pp;
    if (rapen) {
      // béton : coupe pleine moins la hauteur de l'aile inférieure apparente (sous les dallettes) et moins l'acier noyé ; + poutrelles
      const Ap = prof.A / 1e4, tf = prof.tf / 1e3, b = prof.b / 1e3, gp = prof.A * 0.785 * 9.81 / 1000;   // 7850 kg/m³
      pp = d.gBeton * (g.A - g.Bres * tf - d.nPout * (Ap - b * tf)) + d.nPout * gp;
      ine.gp = gp;
    } else pp = d.gBeton * g.A;
    const Gna = +d.Gna || 0, Gb = +d.Gb || 0, Ga = +d.Ga || 0, kA = +d.kAmov || 1.3;
    const supMax = Gna + kA * (Gb + Ga), supMin = Gna + Gb + Ga;
    const unit = P.fixe(S, [{ type: 'q', a: x0, b: xn, q: 1 }]);
    /* ── dénivellations d'appui : chaque appui seul de « den » (module différé), enveloppe ── */
    const den = d.travees.concat([0]).map((_, k) => P.fixe(S, [{ type: 'd', appui: k + 1, v: +d.den || 0 }]));
    const fDen = EIld / EI0;
    /* ── charges mobiles ── */
    const ph = phi(d), Kt = coefK(d, g);
    const mods = ['UIC71', 'SW0', 'SW2'];
    const kSec = (s) => s.kind === 'cg' ? 0 : s.kind === 'cd' ? nT - 1 : s.travee;
    // K appliqué à une section : celui de la travée à laquelle elle appartient (convention du programme de référence)
    const Kof = (s, v) => Kt[kSec(s)].K[v];
    const voiesCh = Array.from({ length: d.nCharge }, (_, v) => v);
    const fA = ph.phi * ph.alpha, fB = ph.phi;          // α appliqué à LM71 et SW/0 (EN 1991-2 §6.3.2 (3))
    // groupes : A = UIC/SW0 sur chaque voie chargée ; B = SW/2 sur la voie la plus défavorable + UIC/SW0 sur l'autre
    function groupes(li, Kv) {
      const e = {}; for (const m of mods) e[m] = env(li, m, d.uicReparti !== false);
      const u = { max: Math.max(e.UIC71.max, e.SW0.max), min: Math.min(e.UIC71.min, e.SW0.min) };
      const A = { max: 0, min: 0 }, B = { max: -Infinity, min: Infinity };
      for (const v of voiesCh) { A.max += fA * Kv[v] * u.max; A.min += fA * Kv[v] * u.min; }
      for (const w of voiesCh) {
        let mx = fB * Kv[w] * e.SW2.max, mn = fB * Kv[w] * e.SW2.min;
        for (const v of voiesCh) if (v !== w) { mx += fA * Kv[v] * u.max; mn += fA * Kv[v] * u.min; }
        B.max = Math.max(B.max, mx); B.min = Math.min(B.min, mn);
      }
      return { e, u, A, B };
    }
    /* accotements : 5 kN/m² sur les deux pistes, chargés sur toute la longueur du tablier (charge non fractionnée,
     * présente ou absente : convention retrouvée sur les cas de référence) */
    const qAcc = (+d.qAcc || 0) * 2 * (+d.lAcc || 0);
    const envAcc = (li) => { const v = qAcc * li.integ(li.x0, li.xn); return { max: Math.max(0, v), min: Math.min(0, v) }; };

    /* ── sollicitations par section ── */
    const secs = S.sections.map((s, i) => {
      const L = LI.sec[i], Kv = (d.eV.slice(0, d.nVoies)).map((_, v) => Kof(s, v));
      const m = { pp: pp * unit.sec[i].M, supMax: supMax * unit.sec[i].M, supMin: supMin * unit.sec[i].M,
        den: { max: Math.max(0, ...den.map((r) => fDen * r.sec[i].M)), min: Math.min(0, ...den.map((r) => fDen * r.sec[i].M)) }, acc: envAcc(L.M) };
      const v = { pp: pp * unit.sec[i].V, supMax: supMax * unit.sec[i].V, supMin: supMin * unit.sec[i].V,
        den: { max: Math.max(0, ...den.map((r) => fDen * r.sec[i].V)), min: Math.min(0, ...den.map((r) => fDen * r.sec[i].V)) }, acc: envAcc(L.V) };
      const gm = groupes(L.M, Kv), gv = groupes(L.V, Kv);
      m.A = gm.A; m.B = gm.B; v.A = gv.A; v.B = gv.B;
      // superstructures : valeur défavorable selon le signe de l'effet unitaire
      const comb2 = (c) => {
        const o = {};
        for (const k of C.ELU) o[k.id] = { max: comb(c, k, 1, true, C), min: comb(c, k, -1, true, C) };
        for (const k of C.ELS) o[k.id] = { max: comb(c, k, 1, false, C), min: comb(c, k, -1, false, C) };
        const ks = Object.keys(o), elu = ks.filter((x) => /^ELU/.test(x)), els = ks.filter((x) => /^ELS/.test(x));
        o.ELU = { max: Math.max(...elu.map((x) => o[x].max)), min: Math.min(...elu.map((x) => o[x].min)) };
        o.ELS = { max: Math.max(...els.map((x) => o[x].max)), min: Math.min(...els.map((x) => o[x].min)) };
        return o;
      };
      // flèche sous UIC 71 sur une voie (confort, contre-flèche) : effet par EI = 10⁶ → réel ×(10⁶/EI)
      const wU = L.w ? env(L.w, 'UIC71', d.uicReparti !== false) : { max: 0, min: 0 };
      return { i, x: s.x, kind: s.kind, side: s.side, travee: s.travee, K: Kv, M: m, V: v, cM: comb2(m), cV: comb2(v), wUIC: wU.max, envM: gm.e, envV: gv.e };
    });

    /* ── appuis : réactions globales et par appareil ── */
    const nA = nT + 1;
    const app = S.app.map((a, j) => {
      const Rli = LI.app[j].R, th = LI.app[j].th;
      const tAdj = [Math.max(0, j - 1), Math.min(nT - 1, j)];
      const Kv = d.eV.slice(0, d.nVoies).map((_, v) => Math.max(Kt[tAdj[0]].K[v], Kt[tAdj[1]].K[v]));
      const e = {}; for (const mm of mods) e[mm] = env(Rli, mm, d.uicReparti !== false);
      const eth = {}; for (const mm of mods) eth[mm] = env(th, mm, d.uicReparti !== false);
      const R = { pp: pp * unit.appuis[j].R, supMax: supMax * unit.appuis[j].R, supMin: supMin * unit.appuis[j].R,
        den: { max: Math.max(0, ...den.map((r) => fDen * r.appuis[j].R)), min: Math.min(0, ...den.map((r) => fDen * r.appuis[j].R)) },
        acc: envAcc(Rli) };
      const u = { max: Math.max(e.UIC71.max, e.SW0.max), min: Math.min(e.UIC71.min, e.SW0.min) };
      const gr = groupes(Rli, Kv); R.A = gr.A; R.B = gr.B;
      // rotations (rad) : G sous module différé, trafic sous module instantané (une voie, Φ compris)
      const rot = { G: Math.max(Math.abs(supMax + pp), Math.abs(supMin + pp)) * Math.abs(unit.appuis[j].th) * EI0 / EIld,
        Q: fA * Math.max(Math.abs(eth.UIC71.max), Math.abs(eth.UIC71.min), Math.abs(eth.SW0.max), Math.abs(eth.SW0.min)) * EI0 / EIcd,
        QSW2: fB * Math.max(Math.abs(eth.SW2.max), Math.abs(eth.SW2.min)) * EI0 / EIcd };
      // répartition transversale rigide sur les appareils (Navier) : c_i(e) = 1/n + e·y_i/Σy²
      const culee = j === 0 || j === nA - 1;
      const n = culee ? d.appuis.nCulee : d.appuis.nPile;
      let y = d.appuis.y && d.appuis.y.length === n ? d.appuis.y.map(Number) : null;
      if (!y) { const sp = g.Bres / n; y = Array.from({ length: n }, (_, k) => -g.Bres / 2 + sp * (k + 0.5)); }
      const Sy2 = sum(y.map((t) => t * t)) || 1;
      const c = (i, ee) => 1 / n + ee * y[i] / Sy2;
      const parApp = y.map((yi, i) => {
        // trafic : chaque voie chargée contribue avec son coefficient (charge défavorable selon le signe de c)
        const grp = (key) => {
          const one = (w) => { // w : voie portant SW/2 (groupe B) ou −1
            let mx = 0, mn = 0;
            for (const v of voiesCh) {
              const ev = v === w ? { max: fB * e.SW2.max, min: fB * e.SW2.min } : { max: fA * u.max, min: fA * u.min };
              const cc = c(i, d.eV[v]);
              mx += cc >= 0 ? cc * ev.max : cc * ev.min; mn += cc >= 0 ? cc * ev.min : cc * ev.max;
            }
            return { max: mx, min: mn };
          };
          if (key === 'A') return one(-1);
          const o = voiesCh.map((w) => one(w)); return { max: Math.max(...o.map((r) => r.max)), min: Math.min(...o.map((r) => r.min)) };
        };
        const r = { pp: R.pp / n, supMax: R.supMax / n, supMin: R.supMin / n, den: { max: R.den.max / n, min: R.den.min / n }, acc: { max: R.acc.max / n, min: R.acc.min / n }, A: grp('A'), B: grp('B') };
        const cmb = {}; for (const k of C.ELS) cmb[k.id] = { max: comb(r, k, 1, false, C), min: comb(r, k, -1, false, C) };
        for (const k of C.ELU) cmb[k.id] = { max: comb(r, k, 1, true, C), min: comb(r, k, -1, true, C) };
        return { y: yi, c: d.eV.slice(0, d.nCharge).map((ee) => c(i, ee)), r, cmb, elsMax: Math.max(...C.ELS.map((k) => cmb[k.id].max)), elsMin: Math.min(...C.ELS.map((k) => cmb[k.id].min)) };
      });
      const iMax = parApp.reduce((b, p, i) => (p.elsMax > parApp[b].elsMax ? i : b), 0), iMin = parApp.reduce((b, p, i) => (p.elsMin < parApp[b].elsMin ? i : b), 0);
      const cm = {}; for (const k of C.ELS) cm[k.id] = { max: comb(R, k, 1, false, C), min: comb(R, k, -1, false, C) };
      for (const k of C.ELU) cm[k.id] = { max: comb(R, k, 1, true, C), min: comb(R, k, -1, true, C) };
      return { j, x: a.x, nom: culee ? 'C' + j : 'P' + j, culee, n, y, R, env: e, rot, cmb: cm, parApp, iMax, iMin };
    });

    /* ── flèches de confort (EN 1990 A2.4.4.3.2) : UIC 71 sur une voie, Φ et K compris ── */
    const Ksec = (s) => Math.max(...s.K.slice(0, 1));
    let Ic, Icf;
    if (rapen) { Ic = ine.Ic; Icf = ine.Icf; }
    const fl = { Ldelta: +d.Ldelta || 1500, coef: nT >= 3 ? 0.9 : 0.7, travees: [] };
    const EImoy = rapen ? IN.Ea * 1000 * (ine.Ic + ine.Icf) / 2 : null;
    secs.forEach((s) => {
      const w1 = s.wUIC * fA * Ksec(s) * EI0;
      s.fl = { nf: w1 / EIcd };
      if (rapen) { s.fl.f = w1 / (IN.Ea * 1000 * ine.Icf); s.fl.moy = w1 / EImoy; }
    });
    /* ── RADBA : sections d'acier ; RAPEN : contraintes et moments résistants ── */
    let ba = null, pe = null; const R0 = {};
    if (!rapen) ba = radba(d, g, secs, C, alertes);
    else { pe = rapenVerif(d, g, secs, ine, prof, pp, C, alertes, S, EI0, EIld, EIcd, fA, unit, supMax, supMin); R0.H = pe.H; }
    /* RADBA : inertie fissurée unique (section rectangulaire équivalente b × hm, n = 15, aciers retenus à la section de
     * plus grand moment ELS positif) ; flèche « moyenne » sous l'inertie (I + If)/2 (convention de l'original) */
    if (!rapen) {
      let kM = 0; secs.forEach((s, k) => { if (s.cM.ELS.max > secs[kM].cM.ELS.max) kM = k; });
      const a = ba.secs[kM], cov = d.h - d.dInf;
      const geo = SB.rect({ b: g.beq, h: g.hm, nStrips: 200, nappes: [{ d: d.dSup, As: a.As[0] }, { d: g.hm - cov, As: a.As[1] }] });
      const pr = SB.props(geo, 15);
      ba.Ifiss = pr.fn ? pr.fn.I : g.I; ba.xIfiss = secs[kM].x;
      secs.forEach((s) => { s.fl.f = s.fl.nf * g.I / ba.Ifiss; s.fl.moy = s.fl.nf * g.I / ((g.I + ba.Ifiss) / 2); });
    }
    for (let t = 0; t < nT; t++) {
      const ss = secs.filter((s) => s.kind === 't' && s.travee === t);
      const wmax = Math.max(...ss.map((s) => s.fl.moy));
      const lim = d.travees[t] / (fl.Ldelta * fl.coef);
      fl.travees.push({ t, L: d.travees[t], w: wmax, lim, ok: wmax <= lim + 1e-12 });
    }
    /* rotations d'extrémité et déplacements de la surface supérieure du tablier sous trafic (Livret 2.01 art. 1.8.1.2.2,
     * EN 1991-2 §6.5.4.5.2) : UIC 71 sur les voies chargées, sans majoration dynamique, module instantané ;
     * δH = θ·v (v = distance de la fibre supérieure au centre de rotation : axe neutre au droit d'un appui fixe,
     * sous-face sur appareils mobiles) ; δV nul (pas de console au-delà de l'appareil). */
    const hTot = rapen ? R0.H : g.hm, vSup = rapen ? R0.H - ine.courant.travee.cas.find((c) => c.id === 'ctnf').yG : g.zg + (g.hm - d.h) * 0;
    const nTr = d.nCharge * ph.alpha;
    const ext = [app[0], app[nA - 1]].map((a) => {
      const th = a.rot.Q / fA * nTr, fixe = a.j === (+d.appuiFixe || 0), v = fixe ? vSup : hTot;
      return { nom: a.nom, fixe, theta: th, v, dH: th * v, dV: 0, limH: (+d.limDeltaH || 10) / 1000, limV: 0.003 };
    });
    return { d, g, C, S, ph, Kt, pp, supMax, supMin, Gna, Gb, Ga, qAcc, Ei, Ev, EIcd, EIld, secs, app, fl, ext, ba, pe, ine, prof, alertes, Ltot };
  }

  /* ═══════════════════════ 6. RADBA : aciers longitudinaux ═══════════════════════ */
  function radba(d, g, secs, C, alertes) {
    const ec = d.regl === 'ec';
    const mat = SB.materiau(ec ? { regl: 'EC2', fck: d.fck, fyk: d.fe, diagramme: 'rect' }
      : { regl: 'BAEL', fck: d.fck, fyk: d.fe, livret: true, fissuration: d.fissuration, diagramme: 'rect' });
    const typeELU = ec ? 1 : 3;                    // BAEL : charges d'exploitation de durée < 1 h (θ = 0,85) comme l'original
    const b = g.beq, h = d.h, ds = d.dSup, di = d.dInf;
    const sec = { b, h, nStrips: 120, nappes: [{ d: ds, As: 0 }, { d: di, As: 0 }] };
    const base = SB.rect(sec);
    const AsC = (+d.AsMin || 3) * b;               // aciers de construction (3 cm²/m par défaut)
    const ftj = 0.6 + 0.06 * d.fck;
    const Afrag = (dd) => ec ? Math.max(0.26 * mat.fctm / d.fe, 0.0013) * b * dd * 1e4 : 0.23 * ftj / d.fe * b * dd * 1e4;   // BAEL A.4.2,1 / EC2 §9.2.1.1
    const n = ec ? SB.nEff(mat, 1, 1) : 15;
    const geoOf = (As) => SB.rect({ b, h, nStrips: 120, nappes: [{ d: ds, As: As[0] }, { d: di, As: As[1] }] });
    const ssLim = mat.ssLim, scLim = mat.sbc;
    // ELS : section d'acier tendu minimale (aciers comprimés = construction) pour σs ≤ σs,lim et σc ≤ σc,lim
    const elsReq = (Msb) => {
      if (Math.abs(Msb) < 1e-6) return 0;
      const iT = Msb > 0 ? 0 : 1;
      const ok = (a) => { const A = [AsC, AsC]; A[iT] = a; const e = SB.els(geoOf(A), mat, { N: 0, M: Msb, n }); return -e.ssMin <= ssLim + 1e-6 && e.sc <= scLim + 1e-6; };
      if (ok(0)) return 0;
      let lo = 0, hi = 0.08 * b * h * 1e4;
      if (!ok(hi)) { alertes.push('ELS : contrainte non satisfaite même à 8 % en x = ' + Msb.toFixed(0)); return NaN; }
      for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; if (hi - lo < 0.01) break; }
      return hi;
    };
    const out = secs.map((s) => {
      // convention BA.sectionBA : M > 0 comprime la fibre inférieure (moment sur appui) → Msb = −M
      const Mu = s.cM.ELU, Ms = s.cM.ELS;
      const eluSup = Mu.min < 0 ? SB.dimELU2(sec, base, mat, { N: 0, M: -Mu.min, type: typeELU }).As[0] : 0;
      const eluInf = Mu.max > 0 ? SB.dimELU2(sec, base, mat, { N: 0, M: -Mu.max, type: typeELU }).As[1] : 0;
      const elsSup = Ms.min < 0 ? elsReq(-Ms.min) : 0, elsInf = Ms.max > 0 ? elsReq(-Ms.max) : 0;
      const fragSup = Ms.min < -1e-6 ? Afrag(h - ds) : 0, fragInf = Ms.max > 1e-6 ? Afrag(di) : 0;
      const As = [Math.max(AsC, eluSup, elsSup, fragSup), Math.max(AsC, eluInf, elsInf, fragInf)];
      const geo = geoOf(As);
      const sc = Math.max(0, ...[Ms.max, Ms.min].filter((m) => Math.abs(m) > 1e-6).map((m) => SB.els(geo, mat, { N: 0, M: -m, n }).sc));
      // effort tranchant (BAEL A.5.1 avec fet ; EC2 §6.2)
      const Vu = Math.max(Math.abs(s.cV.ELU.max), Math.abs(s.cV.ELU.min));
      const t = ec ? SB.tranchantEC2({ bw: b, h, d: di, z: 0.9 * di, b, Ac: b * h, Asl: As[1], N: 0, V: Vu, T: 0, fck: d.fck, fyk: d.fet || d.fe, gc: 1.5, gs: 1.15, cot: 'libre', element: 'dalle' })
        : SB.tranchantBAEL({ b0: b, h, d: di, fc28: d.fck, fe: d.fet || 400, gb: 1.5, gs: 1.15, fissuration: d.fissuration, N: 0, V: Vu, reprise: 0 });
      return { x: s.x, As, req: { eluSup, eluInf, elsSup, elsInf, fragSup, fragInf, AsC }, sc, Vu, tau: t.tauV ?? t.vEd ?? null, AtB0: t.AtSurB0 ?? (t.Asw_s ? t.Asw_s / b : null), cis: t };
    });
    return { mat, n, b, h, ssLim, scLim, AsC, secs: out };
  }

  /* ═══════════════════════ 7. RAPEN : vérification des poutrelles enrobées ═══════════════════════ */
  function rapenVerif(d, g, secs, ine, prof, pp, C, alertes, S, EI0, EIld, EIcd, fA, unit, supMax, supMin) {
    const ec = d.regl === 'ec';
    const N = d.nPout, Ea = IN.Ea;
    const hP = prof.h / 1e3, tf = prof.tf / 1e3, bP = prof.b / 1e3, tw = prof.tw / 1e3, rP = prof.r / 1e3;
    const fy = d.fy > 0 ? d.fy : IN.fyNuance(d.nuance, prof.tf);
    const Is = N * prof.Iy / 1e8, vS = hP / 2;
    const Wpl = bP * tf * (hP - tf) + tw * (hP - 2 * tf) ** 2 / 4;          // sans congés (convention de l'original)
    const MplS = N * Wpl * fy / d.gammaA * 1000;                             // poutrelles seules, EN 1993-1-1 §6.2.5
    // effort tranchant : poutrelles seules (EN 1994-2 §6.3.4, EN 1993-1-1 §6.2.6)
    const Av = (prof.A * 100 - 2 * prof.b * prof.tf + (prof.tw + 2 * prof.r) * prof.tf) / 1e6 * N;
    const VplRd = Av * fy / Math.sqrt(3) / (ec ? 1.0 : 1.0) * 1000;
    const H = hP + d.csup;
    const lim = { beton: 0.6 * d.fck, acier: ec ? fy : fy / 1.15, HA: ec ? 0.8 * d.fe : +d.sigS || 270 };
    // zone des chapeaux : moment ELU négatif supérieur à « seuilChap » × le moment négatif extrême de l'appui voisin
    const minApp = Math.min(...secs.map((s) => s.cM.ELU.min));
    const out = secs.map((s) => {
      const chap = s.cM.ELU.min < -(+d.seuilChap || 0.1) * Math.abs(minApp);
      const R = chap ? ine.chapeau : ine.courant;
      const As = chap ? Math.max(ine.AsMin, d.AsChap) : ine.AsMin;
      // phases : cas 1 poids propre sur poutrelles seules (béton mou) ; cas 3 longue durée (superstructures + Δ) ;
      // cas 4 courte durée (trafic + accotements) ; contraintes sur sections fissurées (béton tendu négligé)
      const M1 = s.M.pp;
      let worst = null;
      for (const k of C.ELS) for (const sg of [1, -1]) {
        const tot = comb(s.M, k, sg, false, C);
        const supv = sg > 0 ? Math.max(s.M.supMax, s.M.supMin) : Math.min(s.M.supMax, s.M.supMin);
        const M3 = supv + (sg > 0 ? s.M.den.max : s.M.den.min);
        const M4 = tot - M1 - M3;
        const sens = (M3 + M4) >= 0 ? 1 : -1, part = sens > 0 ? R.travee : R.appui;
        const cL = part.cas.find((c) => c.id === 'ltf'), cC = part.cas.find((c) => c.id === 'ctf');
        const sig = (c, M, y, beton, nn) => (beton ? 1 / nn : 1) * M * (y - c.yG) / c.I / 1000;   // + : compression en haut si M>0
        const fib = (y, beton) => ({
          c1: beton ? 0 : M1 * (y - vS) / Is / 1000,
          c3: (beton && ((sens > 0 && y < cL.yG) || (sens < 0 && y > cL.yG))) ? 0 : sig(cL, M3, y, beton, cL.n),
          c4: (beton && ((sens > 0 && y < cC.yG) || (sens < 0 && y > cC.yG))) ? 0 : sig(cC, M4, y, beton, cC.n),
        });
        const zb = d.ecof + tf;
        const F = { betonSup: fib(H, true), betonInf: fib(zb, true), aileSup: fib(hP, false), aileInf: fib(0, false), HA: Object.assign(fib(H - d.dAs, false), { c1: 0 }) };
        for (const f of Object.values(F)) f.tot = f.c1 + f.c3 + f.c4;
        const ratio = Math.max(Math.max(0, F.betonSup.tot, F.betonInf.tot) / lim.beton, Math.abs(F.aileSup.tot) / lim.acier, Math.abs(F.aileInf.tot) / lim.acier, Math.max(0, -F.HA.tot) / lim.HA);
        if (!worst || ratio > worst.ratio) worst = { comb: k.id, sg, M1, M3, M4, F, ratio, sens };
      }
      // ELU : moment total (poids propre pondéré compris) ≤ MRd section mixte ; poids propre seul ≤ Mpl poutrelles
      const MuMax = s.cM.ELU.max, MuMin = s.cM.ELU.min;
      const MRdP = R.travee.elu.M, MRdN = -R.appui.elu.M;
      const M1u = C.gSup * M1;
      const okELU = MuMax <= MRdP + 1e-6 && MuMin >= MRdN - 1e-6 && Math.abs(M1u) <= MplS + 1e-6;
      return { x: s.x, chap, As, M1, worst, sigma: worst.F, okELS: worst.ratio <= 1 + 1e-9, MuMax, MuMin, MRdP, MRdN, M1u, MplS, okELU };
    });
    const Vsd = Math.max(...secs.map((s) => Math.max(Math.abs(s.cV.ELU.max), Math.abs(s.cV.ELU.min))));
    /* contre-flèches (cm) : f_b poids propre sur poutrelles seules, f_p superstructures (inertie moyenne long terme),
     * f_q UIC 71 une voie × K sans Φ (inertie moyenne court terme) ; contre-flèche = f_b + f_p + f_q/2 */
    const EIs = Ea * 1000 * Is, EIlm = Ea * 1000 * (ine.Il + ine.Ilf) / 2, EIcm = Ea * 1000 * (ine.Ic + ine.Icf) / 2;
    const cf = secs.map((s) => {
      const wu = unit.sec[s.i].w * EI0;     // flèche sous 1 kN/m pour EI = 1
      const fb = pp * wu / EIs, fp = supMax * wu / EIlm;
      const fq = s.wUIC * s.K[0] * EI0 / EIcm;
      return { x: s.x, kind: s.kind, travee: s.travee, fb, fp, fcp: fb + fp, fq, tot: fb + fp + fq / 2 };
    });
    /* déversement pendant le bétonnage (Fascicule 61 titre V art. 19, méthode simplifiée, Mt = pL²/8 par poutrelle) */
    const Lmax = Math.max(...d.travees), Wel1 = prof.Iy / 1e8 / (hP / 2), ent = entraxe(d, g, prof);
    const gp = ine.gp, qFrais = (H - tf) * d.gBeton * ent, qCh = 0.5 * ent;
    const sigL = gp * Lmax * Lmax / 8 / Wel1 / 1000;
    const sigE = (qFrais + qCh) * Lmax * Lmax / 8 / Wel1 / 1000, sigE15 = (0.15 * d.gBeton * ent + qCh) * Lmax * Lmax / 8 / Wel1 / 1000;
    const sigCrit = Ea / 12 * Math.pow(Math.PI * bP / (0.7 * Lmax), 2);
    const dev = { Lmax, sigL, sigE, sigF: 1.35 * sigL + 1.6 * sigE, sigF15: 1.35 * sigL + 1.6 * sigE15, sigCrit };
    dev.ok15 = dev.sigF15 <= sigCrit; dev.ok = dev.sigF <= sigCrit;
    if (!dev.ok15) alertes.push('Déversement des poutrelles pendant le bétonnage : contrainte critique simplifiée dépassée — prévoir un dispositif anti-déversement ou un calcul fin (moment critique, phasage).');
    // dallettes de coffrage perdu : charge de béton frais + 0,5 kN/m² ; portée libre entre ailes
    const dal = { q: (H - tf) * d.gBeton + 0.5, portee: ent - bP + 2 * (d.debDal ?? 0.05) };   // débord des dallettes sur les ailes
    void sum;
    return { secs: out, fy, Is, Wpl, MplS, Av, VplRd, Vsd, okV: Vsd <= VplRd, lim, cf, dev, dal, H };
  }

  /* ═══════════════════════ 8. Échanges : REPHOR et APPUI ═══════════════════════ */
  /* Fichier relu par la page REPHOR (« Ouvrir ») : {module:'efforts-horizontaux', version:1, v, ap}. Charges par file en kN :
   * G = réaction ELS des charges permanentes maxi (pp + superstructures + dénivellations), Q = groupe de charges ELS
   * le plus défavorable (Φ compris), rotation = rotation maxi sous trafic. Les géométries d'appuis sont à compléter. */
  function exportRephor(R) {
    const d = R.d;
    const ap = R.app.map((a) => {
      const G = a.R.pp + a.R.supMax + a.R.den.max, Q = Math.max(a.R.A.max, a.R.B.max) + 0.8 * a.R.acc.max;
      return { nom: a.nom, type: a.culee ? 'culee' : 'pile', nfut: a.culee ? 3 : 2, larfut: a.culee ? 1 : 6, esup: 0.8, einf: a.culee ? 1.4 : 0.8, hfut: 9, Khcd: 0, Krcd: 0,
        app: a.j === (d.appuiFixe || 0) ? 'fixe' : 'elasto', appD: '', napp: a.n, pa: 0, pb: 0, pn: 0, pti: 12, pts: 3,
        Gmax: Math.round(G * 10) / 10, Qmax: Math.round(Q * 10) / 10, rot: +(a.rot.G + a.rot.Q).toFixed(6) };
    });
    return { module: 'efforts-horizontaux', version: 1, source: 'TABLIER RAIL',
      v: { projet: d.projet || '', ouvrage: 'rail', nvoies: d.nVoies, biais: d.biais, travees: d.travees.join(' '), about0: d.cg, aboutn: d.cd, joints: '', modeApp: 'dim' }, ap };
  }
  /* Descente de charges par file pour le module PILES-CULÉES : réactions globales et par appareil (kN, rad), convention
   * « réaction » (changer le signe pour l'action sur l'appui). */
  function exportAppuis(R) {
    const d = R.d;
    return R.app.map((a) => {
      const pa = a.parApp[a.iMax], pm = a.parApp[a.iMin];
      const r1 = (o) => ({ max: +o.max.toFixed(2), min: +o.min.toFixed(2) });
      return {
        format: 'BA.tablierRail.appui', version: 1, module: 'TABLIER RAIL', projet: d.projet || '', appui: a.j, nom: a.nom, x: a.x, biais_gr: d.biais,
        convention: 'Réactions verticales positives vers le haut (kN) ; groupes de charges majorés dynamiquement (Φ) et répartis transversalement ; rotations en rad.',
        global: { pp: +a.R.pp.toFixed(2), superstructuresMax: +a.R.supMax.toFixed(2), superstructuresMin: +a.R.supMin.toFixed(2), denivellations: r1(a.R.den), gr12: r1(a.R.A), gr14: r1(a.R.B), accotements: r1(a.R.acc),
          combinaisons: Object.fromEntries(Object.entries(a.cmb).map(([k, v]) => [k, r1(v)])) },
        appareils: { nombre: a.n, positions: a.y.map((t) => +t.toFixed(3)),
          plusCharge: { y: +pa.y.toFixed(3), G: +(pa.r.pp + pa.r.supMax).toFixed(2), Gmin: +(pa.r.pp + pa.r.supMin).toFixed(2), den: r1(pa.r.den), gr12: r1(pa.r.A), gr14: r1(pa.r.B), acc: r1(pa.r.acc), ELSmax: +pa.elsMax.toFixed(2) },
          moinsCharge: { y: +pm.y.toFixed(3), ELSmin: +pm.elsMin.toFixed(2) } },
        rotations: { G: +a.rot.G.toExponential(4), trafic: +a.rot.Q.toExponential(4), SW2: +a.rot.QSW2.toExponential(4) },
      };
    });
  }

  /* ═══════════════════════ 9. Plans (SVG et DXF) ═══════════════════════ */
  /* Le dessin est d'abord décrit en primitives (m) : {l:[x1,y1,x2,y2,calque]}, {t:[x,y,texte,h,calque,ancre]},
   * {p:[[x,y]…],calque,ferme}, {c:[x,y,r,calque]}, puis rendu en SVG (vue par vue) ou exporté en DXF R12. */
  function vues(R) {
    const d = R.d, g = R.g, nT = d.travees.length, Lt = R.Ltot, rapen = d.type === 'rapen';
    const X = [0]; d.travees.forEach((L) => X.push(X[X.length - 1] + L));
    const hT = rapen ? R.pe.H : d.h + d.penteExt * Math.max(0, d.Btot / 2 - d.dRebord);
    const V = [];
    // ── élévation ──
    const el = [];
    const xa = -d.cg, xb = Lt + d.cd;
    el.push({ p: [[xa, 0], [xb, 0], [xb, -hT], [xa, -hT]], calque: 'COFFRAGE', ferme: true });
    X.forEach((x, j) => {
      el.push({ l: [x, 0.6, x, -hT - 1.2, 'AXES'] });
      el.push({ p: [[x - 0.25, -hT - 0.05], [x + 0.25, -hT - 0.05], [x + 0.25, -hT - 0.15], [x - 0.25, -hT - 0.15]], calque: 'COFFRAGE', ferme: true });
      el.push({ t: [x, 0.8, (j === 0 || j === nT ? 'C' : 'P') + j, 0.35, 'TEXTE', 'middle'] });
    });
    d.travees.forEach((L, i) => { el.push({ cote: [X[i], X[i + 1], -hT - 0.9, fmtM(L)] }); });
    if (d.cg > 0) el.push({ cote: [xa, 0, -hT - 0.9, fmtM(d.cg)] });
    if (d.cd > 0) el.push({ cote: [Lt, xb, -hT - 0.9, fmtM(d.cd)] });
    el.push({ coteV: [xb + 0.6, 0, -hT, fmtM(hT)] });
    V.push({ id: 'elev', titre: 'Élévation (coupe longitudinale dans l’axe)', prim: el });
    // ── vue en plan biaise ──
    const pl = [], phi = d.biais * GR, cot = Math.cos(phi) / Math.sin(phi), B = d.Btot;
    const off = (y) => y * cot;                    // décalage longitudinal d'une file biaise à l'ordonnée y
    const poly = [[xa + off(-B / 2), -B / 2], [xb + off(-B / 2), -B / 2], [xb + off(B / 2), B / 2], [xa + off(B / 2), B / 2]];
    pl.push({ p: poly, calque: 'COFFRAGE', ferme: true });
    X.forEach((x, j) => {
      pl.push({ l: [x + off(-B / 2 - 0.8), -B / 2 - 0.8, x + off(B / 2 + 0.8), B / 2 + 0.8, 'AXES'] });
      const a = R.app[j];
      a.y.forEach((y) => pl.push({ c: [x + off(y), y, 0.15, 'APPAREILS'] }));
    });
    d.eV.slice(0, d.nVoies).forEach((e, v) => { pl.push({ l: [xa - 1, e, xb + 1, e, 'AXES'] }); pl.push({ t: [xa - 1.2, e + 0.15, 'V' + (v + 1), 0.35, 'TEXTE', 'end'] }); });
    pl.push({ coteV: [xb + off(B / 2) + 1.2, B / 2, -B / 2, fmtM(B)] });
    pl.push({ t: [X[0] + off(-B / 2) + 1.2, -B / 2 + 0.6, 'biais ' + fmtM(d.biais) + ' gr', 0.35, 'TEXTE', 'start'] });
    V.push({ id: 'plan', titre: 'Vue en plan (biais ' + fmtM(d.biais) + ' gr, appareils d’appui)', prim: pl, flipY: true });
    // ── coupe transversale ──
    const ct = [], n = 120, pts = [];
    const top = (y) => { const u = Math.min(y + B / 2, B / 2 - y); return u > d.dRebord ? d.penteExt * (u - d.dRebord) : 0; };
    const bot = (y) => { const u = Math.min(y + B / 2, B / 2 - y); return u < d.lc ? Math.min(d.h, d.er + d.penteC * u) : d.h; };
    for (let k = 0; k <= n; k++) { const y = -B / 2 + B * k / n; pts.push([y, top(y)]); }
    for (let k = n; k >= 0; k--) { const y = -B / 2 + B * k / n; pts.push([y, -bot(y)]); }
    ct.push({ p: pts, calque: 'COFFRAGE', ferme: true });
    if (rapen) {
      const pr = R.prof, hp = pr.h / 1e3, bp = pr.b / 1e3, tf = pr.tf / 1e3, tw = pr.tw / 1e3, N = d.nPout, sp = entraxe(d, g, pr), y0 = -(N - 1) * sp / 2;
      const yb = -d.h - (rapen ? 0 : 0);
      for (let k = 0; k < N; k++) {
        const yc = y0 + sp * k, z0 = yb, z1 = yb + hp;
        ct.push({ p: [[yc - bp / 2, z0], [yc + bp / 2, z0], [yc + bp / 2, z0 + tf], [yc + tw / 2, z0 + tf], [yc + tw / 2, z1 - tf], [yc + bp / 2, z1 - tf], [yc + bp / 2, z1], [yc - bp / 2, z1], [yc - bp / 2, z1 - tf], [yc - tw / 2, z1 - tf], [yc - tw / 2, z0 + tf], [yc - bp / 2, z0 + tf]], calque: 'POUTRELLES', ferme: true });
      }
    }
    d.eV.slice(0, d.nVoies).forEach((e, v) => { ct.push({ l: [e, 1.0, e, -d.h - 0.4, 'AXES'] }); ct.push({ t: [e, 1.15, 'axe V' + (v + 1), 0.25, 'TEXTE', 'middle'] }); });
    ct.push({ cote: [-B / 2, B / 2, -d.h - 0.7, fmtM(B)] });
    ct.push({ cote: [-B / 2, -B / 2 + d.lc, 0.6, fmtM(d.lc)] });
    ct.push({ coteV: [B / 2 + 0.6, 0, -d.h, fmtM(d.h)] });
    ct.push({ coteV: [-B / 2 - 0.5, 0, -d.er, fmtM(d.er)] });
    V.push({ id: 'coupe', titre: 'Coupe transversale' + (rapen ? ' (' + d.nPout + ' ' + R.prof.nom + ')' : ''), prim: ct });
    return V;
  }
  /* entraxe des poutrelles : poutrelles de rive à « debLat » du bord de la dalle résistante */
  const entraxe = (d, g, prof) => (d.nPout > 1 ? (g.Bres - 2 * (d.debLat ?? 0.12) - prof.b / 1e3) / (d.nPout - 1) : 0);
  const fmtM = (v) => (Math.round(v * 1000) / 1000).toString().replace('.', ',');

  /* plan de perçage et de cintrage d'une poutrelle (une poutrelle continue sur toute la longueur) */
  function percage(R) {
    const d = R.d, pc = Object.assign({}, DEF_RAPEN.percage, d.percage || {}), pr = R.prof;
    const hp = pr.h / 1e3, tf = pr.tf / 1e3, Lt = R.Ltot;
    const xa = -d.cg - 0 + 0, xb = Lt + d.cd;
    const L0 = xa, L1 = xb;                               // longueur de poutrelle = longueur du tablier (débord pris dans les consoles)
    // trous des entretoises (rangées de 2 à rangEnt) tous les espEnt depuis l'about, à zEnt sous l'aile supérieure
    const ent = []; for (let x = L0 + pc.espEnt / 2; x < L1 - 0.2; x += pc.espEnt) ent.push(+x.toFixed(4));
    // trous des aciers transversaux inférieurs : espacement espFer, premier à aboutFer de l'extrémité
    const fer = []; for (let x = L0 + pc.aboutFer; x <= L1 - pc.aboutFer + 1e-9; x += pc.espFer) fer.push(+x.toFixed(4));
    // contre-flèche (cm) aux sections, interpolée linéairement
    const cfs = R.pe.cf.filter((c) => c.kind === 't' || c.kind === 'cg' || c.kind === 'cd').map((c) => [c.x, c.tot * 100]);
    cfs.sort((a, b) => a[0] - b[0]);
    const cfAt = (x) => { if (x <= cfs[0][0]) return cfs[0][1]; for (let k = 1; k < cfs.length; k++) if (x <= cfs[k][0]) { const [x0, y0] = cfs[k - 1], [x1, y1] = cfs[k]; return x1 > x0 ? y0 + (y1 - y0) * (x - x0) / (x1 - x0) : y1; } return cfs[cfs.length - 1][1]; };
    const zEnt = hp - tf - pc.zEnt, zFer = tf + d.ecof + pc.zFer;
    const pts = [];
    for (let k = 0; k <= 40; k++) { const x = L0 + (L1 - L0) * k / 40; pts.push([+x.toFixed(3), +cfAt(x).toFixed(2)]); }
    const nTrou = ent.length * 2 + fer.length;
    return { L: L1 - L0, x0: L0, ent, fer, zEnt, zFer, rang: pc.rangEnt, dTrouEnt: pc.dTrouEnt, dTrouFer: pc.dTrouFer, cf: pts, cfAt, hp, nTrou, pc };
  }
  function vuePercage(R) {
    const pz = percage(R), d = R.d, hp = pz.hp, prim = [];
    const X = [0]; d.travees.forEach((L) => X.push(X[X.length - 1] + L));
    const ex = 25;                                           // amplification verticale de la contre-flèche
    const yOf = (x) => pz.cfAt(x) / 100 * ex;
    const xs = []; for (let k = 0; k <= 80; k++) xs.push(pz.x0 + pz.L * k / 80);
    prim.push({ p: xs.map((x) => [x, yOf(x)]).concat(xs.slice().reverse().map((x) => [x, yOf(x) - hp])), calque: 'POUTRELLES', ferme: true });
    pz.ent.forEach((x) => { const y = yOf(x) - (hp - pz.zEnt); prim.push({ c: [x - pz.rang / 2, y, pz.dTrouEnt / 2 * 4, 'PERCAGE'] }); prim.push({ c: [x + pz.rang / 2, y, pz.dTrouEnt / 2 * 4, 'PERCAGE'] }); });
    pz.fer.forEach((x) => { const y = yOf(x) - (hp - pz.zFer); prim.push({ c: [x, y, pz.dTrouFer / 2 * 3, 'PERCAGE'] }); });
    X.forEach((x, j) => { prim.push({ l: [x, yOf(x) + 0.5, x, yOf(x) - hp - 0.8, 'AXES'] }); prim.push({ t: [x, yOf(x) + 0.7, (j === 0 || j === d.travees.length ? 'C' : 'P') + j, 0.3, 'TEXTE', 'middle'] }); });
    // cotes de contre-flèche à mi-travée
    d.travees.forEach((L, i) => { const xm = X[i] + L / 2; prim.push({ t: [xm, yOf(xm) + 0.35, 'cf = ' + fmtM(Math.round(pz.cfAt(xm) * 10) / 10) + ' cm', 0.28, 'TEXTE', 'middle'] }); });
    prim.push({ cote: [pz.x0, pz.x0 + pz.L, -hp - 1.0, 'L = ' + fmtM(pz.L)] });
    return { id: 'percage', titre: 'Poutrelle type ' + R.prof.nom + ' : perçage et cintrage (contre-flèche amplifiée ×' + ex + ')', prim, pz };
  }

  /* rendu SVG d'une vue (sans DOM) */
  function svgVue(v, o = {}) {
    const W = o.w || 760, pad = 34;
    const pts = [];
    const add = (x, y) => pts.push([x, y]);
    for (const p of v.prim) {
      if (p.l) { add(p.l[0], p.l[1]); add(p.l[2], p.l[3]); }
      if (p.p) p.p.forEach(([x, y]) => add(x, y));
      if (p.c) { add(p.c[0] - p.c[2], p.c[1] - p.c[2]); add(p.c[0] + p.c[2], p.c[1] + p.c[2]); }
      if (p.t) add(p.t[0], p.t[1]);
      if (p.cote) { add(p.cote[0], p.cote[2]); add(p.cote[1], p.cote[2]); }
      if (p.coteV) { add(p.coteV[0], p.coteV[1]); add(p.coteV[0], p.coteV[2]); }
    }
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1e-6), (o.hmax || 360) / Math.max(y1 - y0, 1e-6));
    const H = (y1 - y0) * sc + 2 * pad;
    const flip = v.flipY ? 1 : -1;           // y vers le haut (élévation, coupe) ; plan : y transversal vers le bas
    const X = (x) => (pad + (x - x0) * sc).toFixed(1), Y = (y) => (flip < 0 ? pad + (y1 - y) * sc : pad + (y - y0) * sc).toFixed(1);
    const col = { COFFRAGE: '#14171f', POUTRELLES: '#2d6be4', AXES: '#c0392b', APPAREILS: '#0f8f7b', PERCAGE: '#a8842a', TEXTE: '#6f7484', COTES: '#6f7484' };
    let s = '';
    for (const p of v.prim) {
      if (p.p) s += `<polygon points="${p.p.map(([x, y]) => X(x) + ',' + Y(y)).join(' ')}" fill="${p.calque === 'COFFRAGE' ? 'rgba(168,132,42,.07)' : 'rgba(45,107,228,.10)'}" stroke="${col[p.calque] || '#14171f'}" stroke-width="${p.calque === 'COFFRAGE' ? 1.3 : 0.8}"/>`;
      if (p.l) s += `<line x1="${X(p.l[0])}" y1="${Y(p.l[1])}" x2="${X(p.l[2])}" y2="${Y(p.l[3])}" stroke="${col[p.l[4]] || '#14171f'}" stroke-width=".7"${p.l[4] === 'AXES' ? ' stroke-dasharray="8 3 2 3"' : ''}/>`;
      if (p.c) s += `<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r="${Math.max(1.6, p.c[2] * sc).toFixed(1)}" fill="none" stroke="${col[p.c[3]] || '#14171f'}" stroke-width=".9"/>`;
      if (p.t) s += `<text x="${X(p.t[0])}" y="${Y(p.t[1])}" text-anchor="${p.t[5] || 'start'}" style="font-size:10.5px;fill:#4a4f5c">${esc(p.t[2])}</text>`;
      if (p.cote) { const [a, b, y, t] = p.cote; s += `<line x1="${X(a)}" y1="${Y(y)}" x2="${X(b)}" y2="${Y(y)}" stroke="#6f7484" stroke-width=".6" marker-start="url(#ar)" marker-end="url(#ar)"/><line x1="${X(a)}" y1="${(+Y(y) - 5)}" x2="${X(a)}" y2="${(+Y(y) + 5)}" stroke="#6f7484" stroke-width=".6"/><line x1="${X(b)}" y1="${(+Y(y) - 5)}" x2="${X(b)}" y2="${(+Y(y) + 5)}" stroke="#6f7484" stroke-width=".6"/><text x="${((+X(a) + +X(b)) / 2).toFixed(1)}" y="${(+Y(y) - 4).toFixed(1)}" text-anchor="middle" style="font-size:10px;fill:#6f7484">${esc(t)}</text>`; }
      if (p.coteV) { const [x, a, b, t] = p.coteV; s += `<line x1="${X(x)}" y1="${Y(a)}" x2="${X(x)}" y2="${Y(b)}" stroke="#6f7484" stroke-width=".6" marker-start="url(#ar)" marker-end="url(#ar)"/><text x="${(+X(x) + 4).toFixed(1)}" y="${((+Y(a) + +Y(b)) / 2 + 3).toFixed(1)}" style="font-size:10px;fill:#6f7484">${esc(t)}</text>`; }
    }
    return `<svg class="plan" viewBox="0 0 ${W} ${H.toFixed(0)}" role="img" aria-label="${esc(v.titre)}"><defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 2 L10 5 L0 8z" fill="#6f7484"/></marker></defs>${s}</svg>`;
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* DXF R12 ASCII minimal (LINE, LWPOLYLINE remplacé par POLYLINE R12, CIRCLE, TEXT), unité le mètre ;
   * les vues sont placées les unes sous les autres. Accents écrits en \U+XXXX (comme ferraillage/dxf.js). */
  function dxf(vs) {
    const o = [], E = (...a) => { for (let i = 0; i < a.length; i += 2) o.push(String(a[i]), String(a[i + 1])); };
    const enc = (t) => String(t).replace(/[^\x20-\x7e]/g, (c) => '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
    const LAY = { COFFRAGE: 7, POUTRELLES: 5, AXES: 1, APPAREILS: 3, PERCAGE: 2, TEXTE: 7, COTES: 8 };
    E(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 6, 0, 'ENDSEC');
    E(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, Object.keys(LAY).length);
    for (const [n, c] of Object.entries(LAY)) E(0, 'LAYER', 2, n, 70, 0, 62, c, 6, n === 'AXES' ? 'CENTER' : 'CONTINUOUS');
    E(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
    let dy = 0;
    for (const v of vs) {
      const ys = v.prim.flatMap((p) => (p.p ? p.p.map((q) => q[1]) : p.l ? [p.l[1], p.l[3]] : p.c ? [p.c[1]] : p.t ? [p.t[1]] : p.cote ? [p.cote[2]] : p.coteV ? [p.coteV[1], p.coteV[2]] : []));
      const ymax = Math.max(...ys), ymin = Math.min(...ys), fl = v.flipY ? -1 : 1;
      const T = (y) => dy + fl * y - (fl > 0 ? ymax : -ymin);
      E(0, 'TEXT', 8, 'TEXTE', 10, 0, 20, (dy + 1.5).toFixed(4), 30, 0, 40, 0.5, 1, enc(v.titre));
      for (const p of v.prim) {
        if (p.l) E(0, 'LINE', 8, p.l[4] || 'COFFRAGE', 10, p.l[0].toFixed(4), 20, T(p.l[1]).toFixed(4), 30, 0, 11, p.l[2].toFixed(4), 21, T(p.l[3]).toFixed(4), 31, 0);
        if (p.c) E(0, 'CIRCLE', 8, p.c[3], 10, p.c[0].toFixed(4), 20, T(p.c[1]).toFixed(4), 30, 0, 40, p.c[2].toFixed(4));
        if (p.t) E(0, 'TEXT', 8, 'TEXTE', 10, p.t[0].toFixed(4), 20, T(p.t[1]).toFixed(4), 30, 0, 40, p.t[3], 1, enc(p.t[2]));
        if (p.p) { E(0, 'POLYLINE', 8, p.calque, 66, 1, 70, p.ferme ? 1 : 0); for (const [x, y] of p.p) E(0, 'VERTEX', 8, p.calque, 10, x.toFixed(4), 20, T(y).toFixed(4), 30, 0); E(0, 'SEQEND'); }
        if (p.cote) { const [a, b, y, t] = p.cote; E(0, 'LINE', 8, 'COTES', 10, a.toFixed(4), 20, T(y).toFixed(4), 30, 0, 11, b.toFixed(4), 21, T(y).toFixed(4), 31, 0); E(0, 'TEXT', 8, 'COTES', 10, ((a + b) / 2).toFixed(4), 20, (T(y) + 0.1).toFixed(4), 30, 0, 40, 0.25, 1, enc(t)); }
        if (p.coteV) { const [x, a, b, t] = p.coteV; E(0, 'LINE', 8, 'COTES', 10, x.toFixed(4), 20, T(a).toFixed(4), 30, 0, 11, x.toFixed(4), 21, T(b).toFixed(4), 31, 0); E(0, 'TEXT', 8, 'COTES', 10, (x + 0.1).toFixed(4), 20, ((T(a) + T(b)) / 2).toFixed(4), 30, 0, 40, 0.25, 1, enc(t)); }
      }
      dy -= (ymax - ymin) + 6;
    }
    E(0, 'ENDSEC', 0, 'EOF');
    return o.join('\r\n') + '\r\n';
  }

  /* ═══════════════════════ 10. Lecture d'un fichier .don d'origine ═══════════════════════ */
  function lireDon(txt) {
    const lines = String(txt).replace(/\r/g, '').split('\n'), v = {};
    for (let i = 0; i < lines.length - 1; i++) {
      const m = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*)\s*;/);
      if (!m || lines[i].startsWith(';')) continue;
      if (!(m[1] in v)) v[m[1]] = lines[i + 1].trim();
      i++;
    }
    const n = (k, def = 0) => { const x = parseFloat(String(v[k] ?? '').replace(',', '.')); return Number.isFinite(x) ? x : def; };
    if (v.application && !/RADBAN/i.test(v.application)) throw new Error('Ce fichier n’est pas un fichier de données .don de tablier rail.');
    const rapen = n('typstruct') === 1;
    const nt = Math.max(1, Math.min(7, Math.round(n('nbtrav', 1))));
    const trav = Array.from({ length: nt }, (_, k) => n('lontrav' + (k + 1)));
    const B = n('lardalv1', 11.88);
    const ev = n('eaxevoi', 4.8);
    const nv = [0, 1].includes(n('nbvoical')) ? 1 : 2;
    const yv1 = -B / 2 + (n('dismintabv1') + n('dismaxtabv1')) / 2;
    const eV = nv === 1 ? [yv1, yv1 + ev] : [-ev / 2, ev / 2];
    // charges permanentes (kN/ml) : non amovibles = étanchéité + rebords + garde-corps + corniches ; amovibles = caniveaux
    // + armement des voies ; ballast = γ·(hb + h traverse) sur la largeur entre caniveaux (estimation, à vérifier)
    const Gna = n('epetan', 0.03) * n('poivoletan', 24) * B + n('poirebgcv1') + n('poirebgcv2') + n('poigcv1') + n('poigcv2') + n('poicornv1') + n('poicornv2');
    const Ga = n('poicaneauv1') + n('poicaneauv2') + n('poicancabv1') + n('poicancabv2') + nv * n('poivoi', 1.5);
    const lB = B - 2 * (n('larrebgcv1', 0.2) + n('larcancabv1', 0.45) + n('larcaneauv1', 0.2) + 0.05);
    const Gb = n('poivolbal', 20) * (n('epbal', 0.35) + n('hautraverse', 0.23)) * Math.max(0, lB);
    const d = {
      type: rapen ? 'rapen' : 'radba', projet: v.projet || '', regl: n('reglement') === 1 ? 'ec' : 'livret',
      travees: trav, cg: n('lonaboutab0'), cd: n('lonaboutabn'), biais: n('biais', 100),
      Btot: B, h: n('epdal', 1), lc: n('lonconsolev1', 0.8), er: n('epbortrav1', 0.325), penteC: n('penconsolev1', 0.5), penteExt: n('pentranshouv1', 0), dRebord: n('larrebgcv1', 0.2),
      nVoies: nv, eV, nCharge: nv, hb: n('epbal', 0.35), ltrav: 2.25, alpha: n('coeffalpha', 1) || 1, entretien: n('entretien') === 1 ? 'soigne' : 'courant', vmax: n('vmax', 160),
      gBeton: n('poivolbet', 25), Gna: +Gna.toFixed(3), Gb: +Gb.toFixed(3), Ga: +Ga.toFixed(3), kAmov: n('k_amovible', 1.3), qAcc: n('qaccotement', 5), lAcc: n('larpisv1', 0.67) + 0.18,
      den: n('den', 0.01), fck: n('fc28tab', 32), fe: n('fetab', 500), fissuration: Math.max(0, n('fissur', 2) - 1), dSup: n('discdgaciersup', 0.06), dInf: n('epdal', 1) - n('discdgacierinf', 0.06),
      appuis: { nCulee: Math.round(n('nbappmobculeetot', 4)), nPile: Math.round(n('nbappmobpiletot', 4)), y: null },
      appuiFixe: Math.round(n('numappuifixe', 0)),
    };
    {
      // positions des appareils : d1 (bord → appareil de rive), puis entraxes d2 (d3 au centre) — distances droites
      const np = d.appuis.nPile, d1 = n('d1pil'), d2 = n('d2pil'), d3 = n('d3pil') || d2;
      if (d1 > 0 && d2 > 0 && np >= 2) { const y = [d1]; for (let k = 1; k < np; k++) y.push(y[k - 1] + (k === np / 2 ? d3 : d2)); const yc = y.map((t) => +(t - B / 2).toFixed(5)); if (Math.abs(yc[np - 1] + yc[0]) < 0.05) d.appuis.y = yc; }
    }
    if (rapen) {
      const nom = ((v.profil || 'HE') + ' ' + (v.module || '') + ' ' + (v.serie || '')).replace(/\s+/g, ' ');
      const cat = IN.profiles.get(nom);
      Object.assign(d, {
        profil: cat ? cat.nom : 'HEA 1000', nPout: Math.round(n('nbpoutrelles', 14)), nuance: ['S235', 'S275', 'S355', 'S420', 'S460'][Math.round(n('nuapout', 2))] || 'S355',
        fy: 0, ecof: n('epcof', 0.02), csup: +(n('epdalmoy', 1) - (cat ? cat.h / 1000 : 0.99)).toFixed(4), AsChap: n('sectionaciersup') * 1e4, AsMinM: 4, dAs: 0.0603,
        nCourt: n('ni', 6), nLong: n('nv', 18), sigS: 270, gammaA: 1.05, seuilChap: 0.10,
        penteExt: 0, debDal: n('debdalcof', 0.05), debLat: n('deblattabpout', 0.12),
        percage: { espEnt: n('espent', 4.85), rangEnt: n('esptrouenth', 0.2), dEnt: n('diament', 0.024), dTrouEnt: n('diamtrouent', 0.03), zEnt: n('distsouent', 0.09), espFer: n('espfer', 0.3), dTrouFer: n('diamtroufer', 0.04), zFer: n('distsurcof', 0.05), debord: n('deblonpoutaxeapp', 0.35), aboutFer: n('lonaboufer', 0.1) },
      });
    }
    return d;
  }

  const api = { entraxe, DEF_RADBA, DEF_RAPEN, coupe, phi, coefK, combinaisons, comb, envUICrep, env, calcul, exportRephor, exportAppuis, vues, vuePercage, percage, svgVue, dxf, lireDon };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.tablierRail = api; }
})(typeof window !== 'undefined' ? window : globalThis);
