/* PSIDA-EL — calculs complémentaires (extension BridgeAI, ligne C10 du bordereau ; non produits par les programmes SETRA).
 * Guide PSIDP-EL du SETRA, annexe 4 :
 *   KIN  : répartition de la réaction d'appui entre appareils d'une ligne d'appui intermédiaire (§ 3 à 5) pour des appareils
 *          non régulièrement espacés (entraxes réels a, e : ligne C11), et ferraillage des chevêtres incorporés (§ 6) ;
 *          rappel de la majoration simple du dossier PSIDA-68 (pièce 2.01 § 5.2.3.1) : section × espacement réel / calculé.
 *   RENF : renforcements locaux du ferraillage longitudinal de part et d'autre des lignes d'appui intermédiaires (§ 7).
 * Annexe 3 (ENC, encorbellements) : comp-enc.js. Unités : t, m (moments t.m), sections cm2. */
(function (G) {
  'use strict';
  const P = G.PSIDA = G.PSIDA || {};
  const A1T = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] };
  const BCT = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 1] };
  const BTT = { 1: [1, 1], 2: [0.9, 0.9], 3: [0, 0] };
  const tab = (t, j) => t[Math.min(j, t.length) - 1];
  const argmaxJ = (t, nv) => { let bj = 1, bv = -1; for (let j = 1; j <= nv; j++) { const v = j * tab(t, j); if (v > bv + 1e-12) { bv = v; bj = j; } } return bj; };
  // poids maximal des essieux d'une file sur une longueur w (bande 2d)
  function axlesOn(axles, w) {
    let best = 0;
    for (let i = 0; i < axles.length; i++) { let s = 0; for (let j = i; j < axles.length && axles[j][0] - axles[i][0] <= w + 1e-9; j++) s += axles[j][1]; best = Math.max(best, s); }
    return best;
  }
  const BC_FILE = (() => { const a = []; for (let t = 0; t < 4; t++) { const x = t * 10.5; a.push([x, 6], [x + 4.5, 12], [x + 6, 12]); } return a; })();
  const BT_FILE = [[0, 16], [1.35, 16]];
  // chenilles et convois (fasc. 61 titre II) : demi-longueur X, distance hors tout des deux chenilles / largeur
  const CE_GEO = { 'MC.120': { X: 3.05, w: 4.30 }, 'MC.80': { X: 2.45, w: 3.65 }, 'CVOI.D': { X: 5.50, w: 3.30 }, 'CVOI.E': { X: 7.50, w: 3.30 } };

  function compute(m, r) {
    const C10 = m.lignes.C10; if (!C10 || !(C10.KIN || C10.RENF || C10.ENC)) return null;
    const out = { kin: null, renf: null, enc: null };
    const C11 = m.lignes.C11 || {}, A11 = m.lignes.A11 || {}, A10 = m.lignes.A10 || {};
    const B = r.section.Eeq, H = r.section.H, n = r.n;
    const mat = r.mat, fc = mat.fcj, fe = (mat.fe && mat.fe[1]) || 50000, ss = (mat.sigS && mat.sigS[0]) || 2 * fe / 3;
    const fbu = 0.85 * fc / 1.5, fsu = fe / 1.15, fbser = 0.6 * fc, aAB = 15 * fbser / (15 * fbser + ss);
    const enrS = +A11.ENROBS || 0.03, phi1 = +A10.PHI1 || 0.025, phi2 = +A10.PHI2 || 0.016;
    const lines = [];
    for (let k = 1; k < n; k++) {
      const ap = r.appuis[k], Na = ap.nap; if (!(Na >= 2)) continue;
      const sinb = Math.sin((r.biais || 100) * Math.PI / 200);
      let a = +C11['A' + (k + 1)] || 0, e = +C11['E' + (k + 1)] || 0;
      const reg = !(a > 0); if (reg) a = ap.esp; if (!(e > 0)) e = a;   // entraxes mesurés suivant l'axe de la ligne d'appui
      a *= sinb; e *= sinb;                                               // largeurs droites
      const nEff = Math.min(Na, 4);                                       // 5 appareils : appareil central négligé (§ 5.4.1)
      const c = nEff === 2 ? (B - a) / 2 : nEff === 3 ? (B - 2 * a) / 2 : (B - 2 * a - e) / 2;
      const L = (r.L[k - 1] + r.L[k]) / 2;
      lines.push({ k, Na, nEff, a, e, c, L, reg, esp: ap.esp });
    }
    // ------------------------------------------------------------------ RENF (§ 7)
    if (C10.RENF) {
      const d = H - enrS - phi1 / 2, z = d * (1 - aAB / 3);
      out.renf = { d, z, ss, rows: lines.map(Lg => {
        const { k, nEff, a, e, c, L } = Lg;
        const s1 = r.moments[k - 1][r.moments[k - 1].length - 1], s2 = r.moments[k][0];
        const M = Math.max(-Math.min(s1.els.min, s2.els.min), 0);
        const eta = B / L, al = a / B, la = c / B;
        let rMr, rMc, rP;   // ΔM-/M rive, ΔM-/M central, ΔM+/M
        if (nEff === 2) { rMr = 0.25 * eta; rMc = 0; rP = 0.5 * eta; }
        else { rMr = 2 * eta * Math.max(la + al / 2 - 0.25, 0); rMc = 2 * eta * Math.max(al - 0.25, 0); rP = 4 * eta * Math.max(al - 0.25, 0); }
        let note = '';
        if (nEff === 4) {
          if (e < 2 * a) { rMc = 0; rP = 0; note = 'E < 2A : DM- ET DM+ AU DROIT DES APPAREILS CENTRAUX NEGLIGES'; }
          else {   // artifice des doublets (§ 5.4.2) : 2 appareils fictifs, c' = c + a/2, a' = a + e
            rMc = 0.25 * eta; rP = 0.5 * eta; note = 'E >= 2A : ARTIFICE DES DOUBLETS (2 APPAREILS FICTIFS)';
          }
        }
        const bR = c / 2 + a / 4, bC = nEff >= 3 ? a / 4 + (nEff === 4 ? e : a) / 4 : 0, bI = 0.8 * (nEff === 4 ? e : a);
        const As = dM => dM > 0 ? dM / (z * ss) * 1e4 : 0;
        const dMr = rMr * M, dMc = rMc * M, dP = rP * M;
        return { k, nEff, a, e, c, L, M, eta, al, la, rMr, rMc, rP, dMr, dMc, dP, bR, bC, bI,
          AsR: As(dMr), AsC: As(dMc), AsI: As(dP), note };
      }) };
    }
    // ------------------------------------------------------------------ KIN (§ 3 à 6)
    if (C10.KIN) {
      const d = H - enrS - phi2, cl = r.classe, nv = r.nvoies;
      const gU = (r.gamma.uA || 1.42) * (r.gamma.f3 || 1.125), gUc = (r.gamma.uC || 1.2) * (r.gamma.f3 || 1.125), gS = r.gamma.sA || 1.2;
      const asU = Mu => { const mu = Mu / (d * d * fbu); const al = 1.25 * (1 - Math.sqrt(Math.max(0, 1 - 2 * mu))); return Mu / (d * (1 - 0.4 * al) * fsu) * 1e4; };
      const asS = Ms => Ms / (d * (1 - aAB / 3) * ss) * 1e4;
      out.kin = { d, rows: lines.map(Lg => {
        const { k, nEff, a, e, c, L } = Lg, R = r.reactions[k], dyn = (r.cmdAppui[k] || {}).bc || 1;
        const al = a / B, la = c / B, mu = e / B;
        const dd = Math.max(a + c, (a + e) / 2, Math.min(B / 2, L));
        const k1 = (a + c) * (a + c) / a;
        const t = 0.2 / al - 2.7 * al + 0.7, s = -0.112 / al + 3.2 * al - 2;
        const u = la > 0.05 ? 2 * mu * s + t : (al - 0.9) / (3.15 * al + 0.018);
        const Sg = R.G.up, T = r.pstrot > 0 ? Math.max(0, R.live.T.max) : 0;
        const loads = [];
        if (!r.off.A) { const na = argmaxJ(A1T[cl], nv); loads.push({ nom: 'A', Q: R.live.A.pos.v, zeta: dd / L * (2 - dd / L), k2: na * r.v, gU, gS, info: 'NA = ' + na }); }
        if (!r.off.Bc) { const nb = argmaxJ(BCT[cl], nv), Pd = nb * axlesOn(BC_FILE, 2 * dd) * tab(BCT[cl], nb) * dyn;
          loads.push({ nom: 'BC', Q: R.live.Bc.max, zeta: (1 - dd / (2 * L)) * Pd / R.live.Bc.max, k2: (nb - 1) * 2.5 + 2.0, gU, gS, info: 'NB = ' + nb + '  PD = ' + Pd.toFixed(2) + ' T' }); }
        if (!r.off.Bt && cl < 3) { const nb = argmaxJ(BTT[cl], Math.min(2, nv)), Pd = nb * axlesOn(BT_FILE, 2 * dd) * tab(BTT[cl], nb) * dyn;
          loads.push({ nom: r.nomBt, Q: R.live.Bt.max, zeta: (1 - dd / (2 * L)) * Pd / R.live.Bt.max, k2: (nb - 1) * 3.0 + 2.0, gU, gS, info: 'NB = ' + nb + '  PD = ' + Pd.toFixed(2) + ' T' }); }
        for (const ce of R.live.CE || []) { const g = CE_GEO[ce.nom]; if (!g || !(ce.max.v > 0)) continue;
          loads.push({ nom: ce.nom, Q: ce.max.v, zeta: g.X > dd ? dd / g.X * (2 - dd / L) / (2 - g.X / L) : 1, k2: g.w + Math.min(dd, g.X), gU: gUc, gS: 1, info: 'X = ' + g.X.toFixed(2) }); }
        const br = v => Math.min(1, v);
        for (const q of loads) {
          q.zeta = Math.min(1, Math.max(0, q.zeta));
          const z = q.zeta, Sq = q.Q + T;
          const Rof = (sg, sq) => {
            if (nEff === 2) { const R1 = 0.5 * sg + 0.5 * br((1 - z) + k1 / q.k2 * z) * sq; return { R1, R2: 0, sum: 2 * R1 }; }
            if (nEff === 3) { const t1 = 0.25 * (1 + t), t2 = 0.5 * (1 - t);
              const R1 = t1 * sg + br((1 - z) * t1 + 0.5 * k1 / q.k2 * z) * sq, R2 = t2 * sg + br((1 - z) * t2 + a / q.k2 * z) * sq; return { R1, R2, sum: 2 * R1 + R2 }; }
            const u1 = 0.25 * (1 + u), u2 = 0.25 * (1 - u);
            const R1 = u1 * sg + br((1 - z) * u1 + 0.5 * k1 / q.k2 * z) * sq, R2 = u2 * sg + br((1 - z) * u2 + (a + e) / (2 * q.k2) * z) * sq;
            return { R1, R2, sum: 2 * R1 + 2 * R2 };
          };
          q.Sq = Sq; q.elu = Rof(1.35 * Sg, q.gU * Sq); q.els = Rof(Sg, q.gS * Sq);
          q.Rmax = Math.max(q.els.R1, q.els.R2); q.K = Lg.Na * q.Rmax / (Sg + q.gS * Sq);
        }
        // chevêtre incorporé (§ 6) : charge la plus défavorable, réaction Σ R répartie sur B, poutre continue simplifiée
        const ee = nEff === 4 ? e : a;
        const mom = sum => { const p = sum / B, Mc = p * c * c / 2, Me = p * ee * ee / 12; return { p, Mc, Me, mc: Mc / (1.5 * c), me: 1.5 * Me / ee }; };
        let gov = null; for (const q of loads) { q.mU = mom(q.elu.sum); q.mS = mom(q.els.sum); if (!gov || q.elu.sum > gov.elu.sum) gov = q; }
        const bands = [];
        if (gov) {
          const U = gov.mU, S = gov.mS;
          const band = (nom, w, mu_, ms_) => bands.push({ nom, w, Mu: mu_, Ms: ms_, AU: asU(mu_), AS: asS(ms_), A: Math.max(asU(mu_), asS(ms_)) });
          band('1  SUP', 2 / 3 * Math.max(c, a, ee), Math.max(U.mc, U.me), Math.max(S.mc, S.me));
          band('2  SUP', Math.max(2 * c, a, ee), Math.max(2 / 3 * U.mc, U.me / 2), Math.max(2 / 3 * S.mc, S.me / 2));
          band('3  SUP', 2 * Math.max(a, ee, c), U.me / 3, S.me / 3);
          band("1' INF", 2 / 3 * Math.max(a, ee), U.me, S.me);
          band("2' INF", 2 * Math.max(a, ee), U.me / 3, S.me / 3);
        }
        // majoration simple PSIDA-68 (pièce 2.01 § 5.2.3.1) : section du chevêtre de la note × espacement réel maxi / espacement calculé
        const ap = r.fer && r.fer.appareils && r.fer.appareils[k];
        const achN = ap && ap.ach ? ap.ach * 1e4 : null, espR = Math.max(a, ee) / Math.sin((r.biais || 100) * Math.PI / 200);
        const kmaj = Math.max(1, espR / Lg.esp);
        return Object.assign({}, Lg, { al, la, mu, dd, k1, t, s, u, Sg, T, loads, gov: gov && gov.nom, bands, achN, kmaj, achMaj: achN != null ? achN * kmaj : null });
      }) };
    }
    if (C10.ENC && P.computeEnc) out.enc = P.computeEnc(m, r);
    return out;
  }

  function render(m, r, T) {
    const C = r.comp; if (!C) return;
    const { page, f, pad, padR } = T, BL = '';
    if (C.kin) {
      for (const q of C.kin.rows) {
        const pl = ['  GUIDE PSIDP-EL DU SETRA, ANNEXE 4 - REPARTITION DE LA REACTION D\'APPUI ENTRE APPAREILS D\'APPUI ET CHEVETRE INCORPORE', BL,
          `     LIGNE D'APPUI ${q.k + 1}      NOMBRE D'APPAREILS ${pad(q.Na, 3)}` + (q.Na > 4 ? '   (APPAREIL CENTRAL NEGLIGE, PARAGRAPHE 5.4.1)' : '') + (q.reg ? '      APPAREILS REGULIEREMENT ESPACES' : '      ENTRAXES REELS DONNES (LIGNE C11)'), BL,
          `     LARGEUR DE LA DALLE EQUIVALENTE  B = ${f(r.section.Eeq, 7, 3)} M      DEMI-SOMME DES PORTEES  L = ${f(q.L, 7, 3)} M`, BL,
          `     LARGEURS DROITES     A = ${f(q.a, 6, 3)} M     E = ${f(q.e, 6, 3)} M     C = ${f(q.c, 6, 3)} M      ALPHA = ${f(q.al, 6, 3)}   LAMBDA = ${f(q.la, 6, 3)}   MU = ${f(q.mu, 6, 3)}`, BL,
          `     D = MAX(A+C,(A+E)/2,MIN(B/2,L)) = ${f(q.dd, 6, 3)} M     K1 = (A+C)**2/A = ${f(q.k1, 7, 3)}     T(ALPHA) = ${f(q.t, 7, 3)}` + (q.nEff === 4 ? `     S(ALPHA) = ${f(q.s, 7, 3)}     U = ${f(q.u, 7, 4)}` : ''), BL,
          `     REACTION TOTALE DE LA LIGNE D'APPUI SOUS CHARGE PERMANENTE   SG = ${f(q.Sg, 9, 2)} T        TROTTOIRS  ${f(q.T, 8, 2)} T`, BL, BL,
          '     CHARGE        SQ (T)     ZETA      K2 (M)     ELS : R RIVE   R CENTRAL     ELU : R RIVE   R CENTRAL     COEF. GLOBAL', BL];
        for (const c of q.loads) pl.push('     ' + padR(c.nom, 10) + f(c.Sq, 10, 2) + f(c.zeta, 9, 3) + f(c.k2, 11, 3) + f(c.els.R1, 17, 2) + f(c.els.R2, 12, 2) + f(c.elu.R1, 17, 2) + f(c.elu.R2, 12, 2) + f(c.K, 15, 3) + '      ' + c.info, BL);
        pl.push('     COEF. GLOBAL = NOMBRE D\'APPAREILS x R MAXI (ELS) / (SG + SQ ELS)   -   SQ : CHARGE + TROTTOIRS, VALEURS CARACTERISTIQUES', BL, BL,
          `  CHEVETRE INCORPORE (PARAGRAPHE 6) - CHARGE DETERMINANTE ${q.gov || '-'} - REACTION TOTALE DES APPAREILS REPARTIE SUR B`, BL);
        const g = q.loads.find(c => c.nom === q.gov);
        if (g) pl.push(`             P (T/M)      MC- (TM)     ME- = ME+ (TM)     MC- LOCAL (TM/M)   ME- LOCAL   ME+ LOCAL`, BL,
          '     ELU ' + f(g.mU.p, 12, 2) + f(g.mU.Mc, 14, 2) + f(g.mU.Me, 16, 2) + f(g.mU.mc, 19, 2) + f(g.mU.me, 12, 2) + f(g.mU.me, 12, 2), BL,
          '     ELS ' + f(g.mS.p, 12, 2) + f(g.mS.Mc, 14, 2) + f(g.mS.Me, 16, 2) + f(g.mS.mc, 19, 2) + f(g.mS.me, 12, 2) + f(g.mS.me, 12, 2), BL, BL,
          `     BANDE      LARGEUR DROITE (M)    MU (TM/M)    MSER (TM/M)    A ELU (CM2/M)   A ELS (CM2/M)   SECTION RETENUE (CM2/M)     D = ${f(C.kin.d, 5, 3)} M`, BL);
        for (const b of q.bands) pl.push('     ' + padR(b.nom, 9) + f(b.w, 14, 3) + f(b.Mu, 17, 2) + f(b.Ms, 14, 2) + f(b.AU, 16, 2) + f(b.AS, 16, 2) + f(b.A, 20, 2), BL);
        if (q.achN != null) pl.push(BL, `  RAPPEL - MAJORATION DU DOSSIER PSIDA-68 (PIECE 2.01, 5.2.3.1) : SECTION DU CHEVETRE DE LA NOTE ${f(q.achN, 7, 2)} CM2/ML`,
          `           x ESPACEMENT REEL MAXI / ESPACEMENT CALCULE = ${f(q.kmaj, 6, 3)}  ->  ${f(q.achMaj, 7, 2)} CM2/ML`);
        pl.push(BL, '   >> NOTA - REGLES APPROCHEES DE L\'ANNEXE 4 DU GUIDE PSIDP-EL (CALCUL BRIDGEAI, NON PRODUIT PAR LE PROGRAMME SETRA)');
        page('CALCULS COMPLEMENTAIRES - APPAREILS D\'APPUI ET CHEVETRE DE LA LIGNE D\'APPUI ' + (q.k + 1), pl, {});
      }
    }
    if (C.renf) {
      const R = C.renf, pl = ['  GUIDE PSIDP-EL DU SETRA, ANNEXE 4, PARAGRAPHE 7 - RENFORCEMENTS LOCAUX DU FERRAILLAGE LONGITUDINAL', BL,
        `     M : VALEUR ABSOLUE DU MOMENT NEGATIF SUR APPUI (ELS)     ETA = B / L     ACIERS A L'ELS : Z = D (1 - ALPHA_AB/3) = ${f(R.z, 6, 3)} M  (D = ${f(R.d, 5, 3)} M) , SIGMA S = ${f(R.ss, 7, 0)} T/M2`, BL, BL,
        '   APPUI  NAP     M (TM)     L (M)    ETA     LAMBDA  ALPHA     DM-/M RIVE  DM- RIVE   DM-/M CENTR. DM- CENTR.  DM+/M     DM+ (TM)', BL];
      for (const q of R.rows) pl.push('   ' + pad(q.k + 1, 4) + pad(q.nEff, 6) + f(q.M, 12, 2) + f(q.L, 9, 2) + f(q.eta, 8, 3) + f(q.la, 9, 3) + f(q.al, 7, 3) + f(q.rMr, 13, 4) + f(q.dMr, 10, 2) + f(q.rMc, 13, 4) + f(q.dMc, 10, 2) + f(q.rP, 11, 4) + f(q.dP, 10, 2), BL);
      pl.push(BL, '   APPUI   SECTIONS D\'ACIERS DE RENFORCEMENT (CM2)          LARGEURS DE REPARTITION (M)          DENSITES (CM2/M)', BL,
        '           SUP. RIVE   SUP. CENTRAL    INF. ENTRE APP.     C/2+A/4    A/4+E/4    0.8 E           SUP. RIVE  SUP. CENTR.  INF.', BL);
      for (const q of R.rows) pl.push('   ' + pad(q.k + 1, 4) + f(q.AsR, 12, 2) + f(q.AsC, 14, 2) + f(q.AsI, 17, 2) + f(q.bR, 15, 3) + f(q.bC, 11, 3) + f(q.bI, 9, 3) + f(q.bR > 0 ? q.AsR / q.bR : 0, 19, 2) + f(q.bC > 0 ? q.AsC / q.bC : 0, 12, 2) + f(q.bI > 0 ? q.AsI / q.bI : 0, 8, 2) + (q.note ? '     ' + q.note : ''), BL);
      pl.push(BL, '   >> NOTA - ACIERS DE LONGUEUR 0.3 L ENVIRON, TETE-BECHE SUR 0.1 L ET 0.2 L DE PART ET D\'AUTRE DE LA LIGNE D\'APPUI (ANNEXE 4, 7.2)',
        '             REGLES APPROCHEES DU GUIDE PSIDP-EL (CALCUL BRIDGEAI, NON PRODUIT PAR LE PROGRAMME SETRA)');
      page('CALCULS COMPLEMENTAIRES - RENFORCEMENTS LONGITUDINAUX AU DROIT DES APPAREILS D\'APPUI', pl, {});
    }
    if (C.enc && P.renderEnc) P.renderEnc(m, r, T);
  }
  P.computeComp = compute;
  P.renderComp = render;
})(typeof globalThis !== 'undefined' ? globalThis : this);
