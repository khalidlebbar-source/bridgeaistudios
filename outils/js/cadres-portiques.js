/* RACBA-RAPO — cadres fermés (RACBA) et portiques ouverts (RAPO) en béton armé sous voies ferrées.
 * Moteur pur (aucun DOM) : module.exports pour node, window.BA.cadres dans le navigateur.
 *
 * Références :
 *  - EN 1991-2 : LM71 §6.3.2 (essieux répartis sur 6,40 m, §6.3.6.2 (2)), SW/0 et SW/2 §6.3.3, coefficient α,
 *    coefficient dynamique Φ2 / Φ3 §6.4.5.2 (6.4), longueur déterminante tableau 6.2 (cadres et portiques :
 *    LΦ = 1,3 × moyenne des « portées » piédroit – traverse – piédroit), réduction pour les ouvrages sous remblai
 *    §6.4.5.3 (Φred = Φ − (h − 1,00)/10 ≥ 1,0), répartition transversale par le ballast §6.3.6.2 / §6.3.6.3
 *    (4:1 dans le ballast), surcharge des remblais §6.3.6.4, freinage et démarrage §6.5.3, groupes de charges
 *    tableau 6.11 et voies chargées simultanément tableau 6.10.
 *  - EN 1990 annexe A2 et son annexe nationale française : combinaisons ELU fondamentales (6.10, ensemble B),
 *    ELS caractéristiques, fréquentes, quasi permanentes (tableaux A2.4(B) et A2.6), facteurs ψ (tableau A2.3),
 *    flèche et confort des voyageurs A2.4.4.2.3 et A2.4.4.3.2.
 *  - EN 1991-1-5 §6.1.4 et §6.1.5 : gradient thermique et simultanéité (ωN = 0,35 ; ωM = 0,75).
 *  - EN 1992-1-1 / 1992-2 : sections (moteur BA.sectionBA, outils/js/sections-ba.js), fissuration §7.3.2 (ferraillage
 *    minimal As,min = kc·k·fct,eff·Act/σs, tableau 7.2N) et §7.3.4 (wk), effort tranchant §6.2.
 *  - Fascicule 62 titre V : fondations superficielles (q'ref, iδ annexe F1, décompression, glissement), modules
 *    de réaction depuis le pressiomètre (annexe F2, Ménard).
 *  - Livret 2.01 (option du programme de référence conservée) : coefficients de variation des terres (1,05 / 0,95),
 *    K0 = Ka (1 + 2/3 sin φ), minoration du freinage par la couverture Kd = 2/3 (2,50 − H1).
 *
 * Modèle : cadre ou portique plan (BA.portique), barres au feuillet moyen, goussets par inertie variable
 * (épaisseur effective limitée à une pente de 1/3), radier ou semelles sur appuis élastiques (module de réaction,
 * ressorts deux fois plus raides pour les actions de courte durée), module du béton Ecm (courte durée) et
 * Ecm/(1+φ) (longue durée). Charges mobiles par lignes d'influence de toutes les sollicitations (M, N, V, réactions
 * du sol, flèche) ; enveloppes max/min avec efforts concomitants.
 *
 * Deux modes de calcul pour le cadre : « tronçon » (ouvrage complet, sollicitations totales sur la largeur, charges
 * ferroviaires majorées du coefficient de Guyon-Massonnet calculé par BA.repartition) ou « tranche » (bande de 1 m la plus
 * sollicitée, charges réparties transversalement par diffusion). Le portique est toujours calculé en tronçon.
 *
 * Unités : m, kN, kPa ; matériaux en MPa ; aciers en cm² (par mètre de largeur dans les justifications).
 * Signes : M > 0 tend la face INTÉRIEURE (intrados de la traverse, face côté ouverture des piédroits, face supérieure
 * du radier et des semelles) ; N > 0 traction ; V selon le repère local des barres (seule |V| est exploitée).
 */
(function (root) {
  'use strict';
  const NODE = typeof module !== 'undefined' && module.exports;
  const PQ = NODE ? require('./portique.js') : (root.BA && root.BA.portique);
  const CH = NODE ? require('./charges.js') : (root.BA && root.BA.charges);
  const opt = (nom, fichier) => { try { return NODE ? require(fichier) : (root.BA && root.BA[nom]); } catch (e) { return null; } };
  const gm = () => opt('repartition', './repartition.js');
  const sba = () => opt('sectionBA', './sections-ba.js');

  const GRAD = Math.PI / 200, DEG = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const num = (v, d) => { const x = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(x) ? x : d; };

  /* ══════════════════ 1. Données par défaut ══════════════════ */
  const COMMUN = {
    biais: 100, nbvoi: 2, axevoi1: -2.25, axevoi2: 2.25, vmax: 160, entretien: 'soigne',
    epbal: 0.6, hautraverse: 0.2, eprem: 0, epetan: 0.03, lontottab: 12, lonpied: 12, lonrad: 12,
    alpha: 1, alphaSW2: 1, LM71: true, SW0: true, SW2: true, chVoie: 150, freinLM: 33, freinSW2: 35, kdLivret: true,
    poicor: 10, charexpint: 0, diffRemblai: 2, diffBeton: 4, reactionRemblai: true,
    phi: 35, dphi: 0, k0mode: 'livret', gTer: 20, gTerSat: 21, gBal: 20, gBet: 25, gEtan: 24,
    KterMax: 1.05, KterMin: 0.95, Kmarston: 1, KbalMax: 1.3, KbalMin: 0.7, hw: 0,
    solMode: 'k', ksol: 30, EM: 15, alphaM: 0.5, rapSol: 2, qu: 0, De: 1, phiF: 30, cohF: 0, frottant: true,
    fck: 32, fyk: 500, classe: 'B', phiFluage: 2, cCou: 0.03, cOuv: 0.05, cRad: 0.05, dAxe: 0.02,
    critere: 'wk', expo: 'XC2', wmax: 0.3, wCombi: 'QP', sigLim: 240, phiBar: 20, espBar: 150, tranchantDalle: true,
    epsRet: 0, dilLD: 0, dilCD: 0, conLD: 0, conCD: 0, gradHeat: 0, gradCool: 0,
    gGsup: 1.35, gGinf: 1.0, gLM: 1.45, gSW2: 1.20, gFill: 1.45, gQ: 1.5, gT: 1.5, gSH: 1.0, gW: 1.35,
    engin: false, Pav: 200, Par: 200, voieAv: 2.5, voieAr: 2.5, empat: 3, aImp: 0.6, bImp: 0.6, epRembPro: 0.3,
    fsAngles: true, hPhi: 'EN', Ldelta: 1500, kLdelta: 0.7, bv: 1, Ld600: true,
  };
  /* cadre : jeu inspiré de l'cas de référence « Racba » (cadre de 5 m sous 2 voies, 1 m de remblai) */
  const CADRE = Object.assign({}, COMMUN, {
    type: 'cadre', mode: 'troncon', biais: 80, ouv: 5, hauint: 4, eptra: 0.5, eppied: 0.5, eprad: 0.5,
    haugousup: 0.2, longousup: 0.3, haugouinf: 0.2, longouinf: 0.8, hauterint: 0,
    axevoi1: -2.405, axevoi2: 2.395, vmax: 350, epbal: 0.68, hautraverse: 0.23, eprem: 1.0, lontottab: 12.3, lonpied: 13.3, lonrad: 13.3,
    gTer: 19, charexpint: 10, fyk: 400, ksol: 30, Kmarston: 1,
  });
  /* portique : jeu inspiré de l'cas de référence « RapoSup » (portique de 8 m sur semelles) */
  const PORTIQUE = Object.assign({}, COMMUN, {
    type: 'portique', mode: 'troncon', biais: 100, ouv: 8, hauint: 8, eptra: 0.65, eppied: 0.65, hausem: 1.2, larpat: 1.2, lartal: 1.75,
    haugousup: 0.3, longousup: 1.0, haugouinf: 0, longouinf: 0, hauterint: 1, fond: 'superficielle', Kv: 2e6, Kh: 1e6, Kr: 5e6,
    axevoi1: -2.25, axevoi2: 2.25, vmax: 350, epbal: 0.6, hautraverse: 0.2, eprem: 0, lontottab: 11.3, lonpied: 12.64,
    gTer: 20, ksol: 100, qu: 1.0, De: 2, phiF: 35.75, fyk: 400, cOuv: 0.045, cRad: 0.03,
    epsRet: 2e-4, dilLD: 2.5e-4, dilCD: 1e-4, conLD: -2.5e-4, conCD: -1e-4,
  });
  function defauts(type) { return JSON.parse(JSON.stringify(type === 'portique' ? PORTIQUE : CADRE)); }

  /* ══════════════════ 2. Coefficients réglementaires ══════════════════ */
  const ka = (phi) => Math.pow(Math.tan(Math.PI / 4 - phi * DEG / 2), 2);                  // Rankine, écran vertical lisse
  const k0 = (phi, mode) => mode === 'jaky' ? 1 - Math.sin(phi * DEG) : ka(phi) * (1 + 2 / 3 * Math.sin(phi * DEG)); // Livret 2.01 / Jaky
  const Ecm = (fck) => 22000 * Math.pow((fck + 8) / 10, 0.3);                               // EN 1992-1-1 tableau 3.1 (MPa)
  const fctm = (fck) => fck <= 50 ? 0.3 * Math.pow(fck, 2 / 3) : 2.12 * Math.log(1 + (fck + 8) / 10);
  /* Kd : minoration du freinage par la couverture (Livret 2.01 §1.3.3.3.3), H1 = sous-face des traverses → extrados */
  const kdFrein = (H1) => H1 < 1 ? 1 : H1 > 2.5 ? 0 : 2 / 3 * (2.5 - H1);
  /* EN 1990 A2.4.4.3.2 : valeurs de L/δ lues sur la figure A2.3 (saisies), × 0,7 pour une travée isolée, ÷ bv */

  /* tableau 7.2N (EN 1992-1-1) : diamètre maximal φ*s selon σs et wk ; renvoie σs admissible pour un diamètre donné */
  const T72 = [[160, 40, 32, 25], [200, 32, 25, 16], [240, 20, 16, 12], [280, 16, 12, 8], [320, 12, 10, 6], [360, 10, 8, 5], [400, 8, 6, 4], [450, 6, 5, 0]];
  function sigmaT72(phiBar, wk) {
    const c = wk >= 0.4 ? 1 : wk >= 0.3 ? 2 : 3;
    if (phiBar >= T72[0][c]) return T72[0][0];
    for (let i = 1; i < T72.length; i++) {
      const [s0, s1] = [T72[i - 1], T72[i]];
      if (phiBar >= s1[c]) return s0[0] + (s1[0] - s0[0]) * (s0[c] - phiBar) / Math.max(1e-9, s0[c] - s1[c]);
    }
    return 450;
  }
  /* classes d'exposition → wmax et combinaison (EN 1992-2 AN, tableau 7.101NF, béton armé ; valeurs par défaut modifiables) */
  const EXPO = { X0: [0.3, 'QP'], XC1: [0.3, 'QP'], XC2: [0.3, 'QP'], XC3: [0.3, 'QP'], XC4: [0.3, 'QP'], XD1: [0.2, 'QP'], XD2: [0.2, 'QP'], XD3: [0.2, 'QP'], XS1: [0.2, 'QP'], XS2: [0.2, 'QP'], XS3: [0.2, 'QP'] };

  /* coefficients de trafic : Φ, LΦ, H1, largeur de diffusion, Guyon-Massonnet */
  function coefTrafic(d, G) {
    const s = G.sinB;
    const LPhi = Math.max(1.3 * (G.LarCal + 2 * G.HauCal) / 3, G.LarCal, G.HauCal);      // EN 1991-2 tableau 6.2 (cadres, portiques)
    const phi0 = d.entretien === 'courant' ? CH.phi3(LPhi) : CH.phi2(LPhi);                // §6.4.5.2 (6.4)
    const H1 = Math.max(0, d.epbal - d.hautraverse) + d.eprem + d.epetan;                  // sous-face traverses → extrados (Kd)
    // §6.4.5.3 : h = hauteur de couverture, ballast compris, de l'extrados au dessus des traverses (texte de l'EN) ;
    // option « origine » : sous-face des traverses → dessus de la traverse béton hors étanchéité (manuel d'origine IV.4.1)
    const hPhi = d.hPhi === 'origine' ? Math.max(0, d.epbal - d.hautraverse) + d.eprem : d.epbal + d.eprem + d.epetan;
    const phi = Math.max(1, phi0 - Math.max(0, hPhi - 1) / 10);                            // §6.4.5.3 ouvrages sous remblai
    // largeur transversale au feuillet moyen de la traverse : 2,25 m + diffusion 4:1 dans le ballast, pente choisie dans le
    // remblai (2:1 par défaut, ou 30°) et dans le béton jusqu'au feuillet moyen (4:1 par défaut)
    const hb = Math.max(0, d.epbal - d.hautraverse);
    const pr = d.diffRemblai === 'tan30' ? Math.tan(30 * DEG) : 1 / num(d.diffRemblai, 2);
    const pb = d.diffBeton === 'tan30' ? Math.tan(30 * DEG) : d.diffBeton === '45' ? 1 : 1 / num(d.diffBeton, 4);
    const larRep = 2.25 + 2 * hb / 4 + 2 * pr * (d.eprem + d.epetan) + 2 * pb * d.eptra / 2;
    const voies = (d.nbvoi >= 2 ? [d.axevoi1, d.axevoi2] : [d.axevoi1]).map(Number);
    const out = { LPhi, phi0, phi, H1, hPhi, hb, larRep, voies, Kd: d.kdLivret ? kdFrein(H1) : 1 };
    // répartition transversale
    if (G.tranche) {
      // bande de 1 m la plus chargée : recouvrement des bandes de diffusion des voies
      let nOver = 1;
      if (voies.length > 1 && Math.abs(voies[1] - voies[0]) < larRep) nOver = 2;
      out.nOver = nOver; out.cN = nOver / larRep; out.c1 = 1 / larRep; out.K = NaN; out.K1 = NaN;
      out.info = `bande de 1 m : charge d'une voie répartie sur ${larRep.toFixed(3)} m` + (nOver > 1 ? ' (bandes des deux voies superposées)' : '');
    } else {
      const B = G.Btrav, Leq = 0.8 * (d.ouv + d.eppied);                                    // portée équivalente 0,8 × portée droite
      // largeur de chargement au feuillet moyen (RÉPARTITION) : 2,25 m + diffusion 4:1 sur la hauteur ballast + remblai sous les
      // traverses, 1:1 dans le béton jusqu'au feuillet moyen (hypothèses qui restituent les tables K du programme de référence)
      const lt = 2.25 + 2 * (hb + d.eprem) / 4 + d.eptra / 2;
      const g = gm();
      let K = 1, K1 = 1, yK = 0, note = '';
      if (g && g.Kcharge) {
        const b = B / 2, p = { b, L: Leq, theta: b / Leq, alpha: 1 };
        const kv = (y, e) => g.Kcharge(p, y, e - lt / 2, e + lt / 2, 24);
        for (let i = 0; i <= 16; i++) {                                                     // 17 fibres (pas b/8, comme les abaques)
          const y = -b + i * b / 8, ks = voies.map((e) => kv(y, e));
          const m = ks.reduce((a, v) => a + v, 0) / ks.length;
          if (m > K || i === 0) { K = m; yK = y; }
          if (ks[0] > K1 || i === 0) K1 = ks[0];
        }
        out.theta = b / Leq;
      } else note = 'Module RÉPARTITION indisponible : coefficient de Guyon-Massonnet pris égal à 1.';
      out.K = K; out.K1 = K1; out.yK = yK; out.Leq = Leq; out.lt = lt; out.nOver = voies.length;
      out.cN = voies.length * K; out.c1 = K1; out.info = note;
    }
    return out;
  }

  /* ══════════════════ 3. Géométrie et maillage ══════════════════ */
  function geometrie(d) {
    const tranche = d.type === 'cadre' && d.mode === 'tranche';
    const sinB = tranche ? 1 : Math.sin(num(d.biais, 100) * GRAD);
    const cadre = d.type === 'cadre';
    const ebas = cadre ? d.eprad : d.hausem;
    const LarCal = (d.ouv + d.eppied) / sinB, HauCal = d.hauint + (d.eptra + ebas) / 2;
    const eP = d.eppied / sinB;                                    // épaisseur du piédroit mesurée dans le plan du modèle
    const Btrav = tranche ? 1 : d.lontottab * sinB;               // largeur de la traverse (perpendiculaire au plan du modèle)
    const Bpied = tranche ? 1 : d.lonpied, Brad = tranche ? 1 : (cadre ? d.lonrad : d.lonpied);
    return { tranche, sinB, cadre, ebas, LarCal, HauCal, Xc: LarCal / 2, Yc: HauCal, eP, Btrav, Bpied, Brad,
      Lstruct: (d.ouv + 2 * d.eppied) / sinB, larSem: cadre ? 0 : d.lartal + d.eppied + d.larpat };
  }
  /* épaisseur ajoutée par un gousset de jambes « le long » (barre étudiée) et « perp » (barre adjacente),
   * à la distance u de la face de la barre adjacente : pente limitée à 1/3 (manuel d'origine, IV.2) */
  const gousset = (long, perp, u) => (long > 0 && perp > 0 && u < long) ? Math.min(perp, long / 3) * (1 - Math.max(0, u) / long) : 0;

  function maillage(d, G, extra = {}) {
    const nodes = [], key = new Map();
    const nd = (x, y) => { const k = Math.round(x * 1e6) + ':' + Math.round(y * 1e6); if (!key.has(k)) { key.set(k, nodes.length); nodes.push({ x, y }); } return key.get(k); };
    const Xc = G.Xc, Yc = G.Yc, eP = G.eP, s = G.sinB;
    const hTop = d.eptra, hBot = G.ebas;
    const members = [];
    // définition des barres : points de départ et d'arrivée, épaisseur t(u) avec u = distance à la face de l'élément adjacent
    const lgSup = (d.longousup || 0) / 1, hgSup = d.haugousup || 0, lgInf = d.longouinf || 0, hgInf = d.haugouinf || 0;
    if (G.cadre) {
      members.push({ nom: 'radier', kind: 'radier', a: [Xc, 0], b: [-Xc, 0], w: () => G.Brad,
        t: (x) => { const u = (Xc - eP / 2) - Math.abs(x); return d.eprad + (u < 0 ? gousset(lgInf, hgInf, 0) + 0 : gousset(lgInf, hgInf, u)); },
        bp: [Xc - eP / 2, -(Xc - eP / 2), Xc - eP / 2 - lgInf, -(Xc - eP / 2 - lgInf), 0, (Xc - eP / 2) / 2, -(Xc - eP / 2) / 2] });
    }
    const yBas = hBot / 2, yHaut = Yc - hTop / 2;
    const tPied = (y) => {
      if (y < yBas) return d.eppied + (G.cadre ? gousset(hgInf, lgInf, 0) : 0);
      if (y > yHaut) return d.eppied + gousset(hgSup, lgSup, 0);
      return d.eppied + (G.cadre ? gousset(hgInf, lgInf, y - yBas) : 0) + gousset(hgSup, lgSup, yHaut - y);
    };
    const wPied = (y) => G.tranche ? 1 : d.lonpied + (d.lontottab - d.lonpied) * clamp(y / Yc, 0, 1);
    const bpP = [yBas, yHaut, yBas + (G.cadre ? hgInf : 0), yHaut - hgSup, Yc / 2, (yBas + Yc / 2) / 2, (yHaut + Yc / 2) / 2];
    members.push({ nom: 'piédroit gauche', kind: 'pied', side: -1, a: [-Xc, 0], b: [-Xc, Yc], t: (x, y) => tPied(y), w: (x, y) => wPied(y), bp: bpP });
    members.push({ nom: 'traverse', kind: 'trav', a: [-Xc, Yc], b: [Xc, Yc], w: () => G.Btrav,
      t: (x) => { const u = (Xc - eP / 2) - Math.abs(x); return d.eptra + (u < 0 ? gousset(lgSup, hgSup, 0) : gousset(lgSup, hgSup, u)); },
      bp: [-(Xc - eP / 2), Xc - eP / 2, -(Xc - eP / 2 - lgSup), Xc - eP / 2 - lgSup, 0, -(Xc - eP / 2) / 2, (Xc - eP / 2) / 2, -Xc / 4, Xc / 4] });
    members.push({ nom: 'piédroit droit', kind: 'pied', side: 1, a: [Xc, Yc], b: [Xc, 0], t: (x, y) => tPied(y), w: (x, y) => wPied(y), bp: bpP });
    if (!G.cadre && d.fond !== 'ressorts' && d.fond !== 'encastre') {
      const ext = (d.eppied / 2 + d.lartal) / s, int = (d.eppied / 2 + d.larpat) / s;
      for (const side of [-1, 1]) {
        const xo = side * (Xc + ext), xi = side * (Xc - int);
        members.push({ nom: side < 0 ? 'semelle gauche' : 'semelle droite', kind: 'sem', side, a: side < 0 ? [xi, 0] : [xo, 0], b: side < 0 ? [xo, 0] : [xi, 0],
          t: () => d.hausem, w: () => G.Brad, bp: [side * Xc, side * (Xc - eP / 2), side * (Xc + eP / 2), side * (Xc + eP / 2 + d.lartal / s / 2), side * (Xc - eP / 2 - d.larpat / s / 2)] });
      }
    }
    // points supplémentaires demandés (comparaisons) : {membre, coord}
    for (const p of extra.points || []) { const m = members.find((mm) => mm.nom === p.membre); if (m) m.bp.push(p.c); }
    const elems = [];
    const hmax = Math.max(0.25, Math.max(G.LarCal, G.HauCal) / 32);
    for (const m of members) {
      const horiz = Math.abs(m.b[1] - m.a[1]) < 1e-9;
      const c0 = horiz ? m.a[0] : m.a[1], c1 = horiz ? m.b[0] : m.b[1], dir = Math.sign(c1 - c0);
      let cs = [c0, c1, ...m.bp.filter((c) => (c - c0) * dir > 1e-6 && (c1 - c) * dir > 1e-6)];
      cs = [...new Set(cs.map((c) => Math.round(c * 1e6) / 1e6))].sort((a, b) => dir * (a - b));
      const pts = [];
      for (let i = 0; i < cs.length - 1; i++) {
        const n = Math.max(1, Math.ceil(Math.abs(cs[i + 1] - cs[i]) / hmax - 1e-9));
        for (let k = 0; k < n; k++) pts.push(cs[i] + (cs[i + 1] - cs[i]) * k / n);
      }
      pts.push(cs[cs.length - 1]);
      m.elems = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const P = (c) => horiz ? [c, m.a[1]] : [m.a[0], c];
        const [xa, ya] = P(pts[i]), [xb, yb] = P(pts[i + 1]), xm = (xa + xb) / 2, ym = (ya + yb) / 2;
        const t = m.t(xm, ym), w = m.w(xm, ym);
        const e = { i: nd(xa, ya), j: nd(xb, yb), t, w, A: w * t, I: w * t * t * t / 12, membre: m.nom, kind: m.kind, side: m.side, c0: pts[i], c1: pts[i + 1], horiz };
        m.elems.push(elems.length); elems.push(e);
      }
      m.horiz = horiz;
    }
    return { nodes, elems, members, nd: (x, y) => key.get(Math.round(x * 1e6) + ':' + Math.round(y * 1e6)) };
  }

  /* appuis élastiques (longue / courte durée) */
  function appuis(d, G, M, kLD) {
    const sup = { LD: [], CD: [] }, ressorts = [];
    const add = (n, kx, ky, kr) => { sup.LD.push({ n, ux: kx, uy: ky, rz: kr }); };
    const rap = num(d.rapSol, 2);
    if (G.cadre || d.fond === 'superficielle' || !d.fond) {
      // appuis élastiques sous le radier ou les semelles : k × largeur × longueur d'influence (Fasc. 62 titre V annexe F3)
      const memb = M.members.filter((m) => m.kind === (G.cadre ? 'radier' : 'sem'));
      for (const m of memb) {
        const xs = new Map();
        for (const ie of m.elems) { const e = M.elems[ie]; const L = Math.abs(e.c1 - e.c0); for (const n of [e.i, e.j]) xs.set(n, (xs.get(n) || 0) + L / 2 * e.w); }
        // débords au-delà de l'axe des piédroits (cadre : demi-épaisseur extérieure)
        if (G.cadre) for (const xx of [-G.Xc, G.Xc]) { const n = M.nd(xx, 0); xs.set(n, xs.get(n) + G.eP / 2 * G.Brad); }
        for (const [n, A] of xs) ressorts.push({ n, A, k: kLD * A, x: M.nodes[n].x, sem: m.side || 0 });
      }
      const fixX = G.cadre ? [M.nd(0, 0) ?? ressorts.reduce((a, r) => Math.abs(r.x) < Math.abs(a.x) ? r : a).n] : [M.nd(-G.Xc, 0), M.nd(G.Xc, 0)];
      for (const r of ressorts) sup.LD.push({ n: r.n, ux: fixX.includes(r.n) ? true : false, uy: r.k, rz: false });
      sup.CD = sup.LD.map((s) => Object.assign({}, s, { uy: s.uy * rap }));
    } else if (d.fond === 'ressorts') {
      for (const xx of [-G.Xc, G.Xc]) { const n = M.nd(xx, 0); sup.LD.push({ n, ux: d.Kh, uy: d.Kv, rz: d.Kr }); }
      sup.CD = sup.LD.map((s) => Object.assign({}, s, { ux: s.ux * rap, uy: s.uy * rap, rz: s.rz * rap }));
    } else {
      for (const xx of [-G.Xc, G.Xc]) sup.LD.push({ n: M.nd(xx, 0), ux: true, uy: true, rz: true });
      sup.CD = sup.LD.map((s) => Object.assign({}, s));
    }
    return { sup, ressorts };
  }

  /* ══════════════════ 4. Cas de charges élémentaires ══════════════════ */
  /* outils de chargement : charge répartie verticale sur une barre horizontale entre deux abscisses x */
  function chargeur(M) {
    const L = { elem: [], nodal: [], strain: [] };
    const memb = (nom) => M.members.find((m) => m.nom === nom);
    L.vert = (nom, xa, xb, q) => { // q kN/m (> 0 vers le bas) sur [xa, xb] (abscisses globales x)
      const m = memb(nom); if (!m || !q) return;
      const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
      for (const ie of m.elems) { const e = M.elems[ie]; const a = Math.min(e.c0, e.c1), b = Math.max(e.c0, e.c1); const u = Math.max(lo, a), v = Math.min(hi, b); if (v - u > 1e-9) {
        const s0 = Math.abs(u - e.c0), s1 = Math.abs(v - e.c0); L.elem.push({ e: ie, type: 'u', dir: 'gy', q: -q, a: Math.min(s0, s1), b: Math.max(s0, s1) }); } }
    };
    /* charge répartie verticale fonction de x (qf(x)) sur toute une barre horizontale (intégration par élément, trapèze) */
    L.vertF = (nom, qf, flt) => { const m = memb(nom); if (!m) return; for (const ie of m.elems) { const e = M.elems[ie]; if (flt && !flt(e)) continue; const q1 = qf(e.c0, e), q2 = qf(e.c1, e); if (q1 || q2) L.elem.push({ e: ie, type: 't', dir: 'gy', q1: -q1, q2: -q2 }); } };
    /* pression horizontale sur un piédroit : p(y) kN/m (> 0 vers l'intérieur de l'ouvrage) entre ya et yb */
    L.horiz = (nom, side, ya, yb, pf) => {
      const m = memb(nom); if (!m) return;
      for (const ie of m.elems) { const e = M.elems[ie]; const a = Math.min(e.c0, e.c1), b = Math.max(e.c0, e.c1); const u = Math.max(ya, a), v = Math.min(yb, b); if (v - u <= 1e-9) continue;
        const sU = Math.abs(u - e.c0), sV = Math.abs(v - e.c0), pU = pf(u), pV = pf(v);
        const [s0, s1, p0, p1] = sU < sV ? [sU, sV, pU, pV] : [sV, sU, pV, pU];
        L.elem.push({ e: ie, type: 't', dir: 'gx', q1: -side * p0, q2: -side * p1, a: s0, b: s1 }); }
    };
    L.node = (n, Fx, Fy, Mz) => { if (n === undefined) return; L.nodal.push({ n, Fx: Fx || 0, Fy: Fy || 0, M: Mz || 0 }); };
    L.strainTrav = (eps, kappa) => { for (const ie of memb('traverse').elems) L.strain.push({ e: ie, eps: eps || 0, kappa: kappa || 0 }); };
    return L;
  }
  const integ = (f, a, b, n = 40) => { if (b <= a) return [0, 0]; let F = 0, Fm = 0; const h = (b - a) / n; for (let i = 0; i < n; i++) { const y = a + (i + 0.5) * h, v = f(y); F += v * h; Fm += v * y * h; } return [F, F ? Fm / F : (a + b) / 2]; };

  function casElementaires(d, G, M, C) {
    const cases = {};
    const Xc = G.Xc, Yc = G.Yc, eP = G.eP, nd = M.nd;
    const xFace = Xc - eP / 2, xExt = Xc + eP / 2;
    const yBas = G.ebas / 2, yHaut = Yc - d.eptra / 2, yTop = Yc + d.eptra / 2, yBase = -G.ebas / 2;
    const Bt = G.Btrav, Bp = G.tranche ? 1 : d.lonpied;
    const nCG = nd(-Xc, Yc), nCD = nd(Xc, Yc);
    const nBG = nd(-Xc, 0), nBD = nd(Xc, 0);
    const semG = M.members.find((m) => m.nom === 'semelle gauche');
    const nTalG = semG ? nd(-(Xc + (d.eppied / 2 + d.lartal) / G.sinB), 0) : nBG, nTalD = semG ? nd(Xc + (d.eppied / 2 + d.lartal) / G.sinB, 0) : nBD;
    const trav = M.members.find((m) => m.nom === 'traverse');
    const tTrav = (x) => trav.t(x);
    const surTraverse = (L, q, lumpQ) => { // charge uniforme sur toute la traverse d'axe à axe + parties au-delà des axes aux nœuds d'angle
      L.vert('traverse', -Xc, Xc, q); const F = (lumpQ === undefined ? q : lumpQ) * eP / 2; L.node(nCG, 0, -F); L.node(nCD, 0, -F);
    };
    const mk = (nom, desc, dur, fn) => { const L = chargeur(M); fn(L); cases[nom] = { nom, desc, dur, L }; };

    /* G1 poids propre (+ étanchéité) ; le poids du radier, coulé sur le sol, ne sollicite pas le cadre (manuel IV.3.1) */
    mk('G1', 'Poids propre de la structure et étanchéité', 'LD', (L) => {
      L.vertF('traverse', (x) => d.gBet * tTrav(x) * Bt + d.gEtan * d.epetan * Bt);
      const qc = (d.gBet * (d.eptra + (d.haugousup || 0)) + d.gEtan * d.epetan) * Bt * eP / 2; L.node(nCG, 0, -qc); L.node(nCD, 0, -qc);
      for (const nom of ['piédroit gauche', 'piédroit droit']) { const m = M.members.find((mm) => mm.nom === nom);
        for (const ie of m.elems) { const e = M.elems[ie]; const lo = Math.min(e.c0, e.c1), hi = Math.max(e.c0, e.c1); const u = Math.max(lo, G.cadre ? 0 : yBas), v = Math.min(hi, yHaut); if (v - u <= 1e-9) continue;
          const s0 = Math.min(Math.abs(u - e.c0), Math.abs(v - e.c0)), s1 = Math.max(Math.abs(u - e.c0), Math.abs(v - e.c0));
          L.elem.push({ e: ie, type: 'u', dir: 'gy', q: -d.gBet * e.t * Bp, a: s0, b: s1 }); } }
      for (const m of M.members.filter((mm) => mm.kind === 'sem')) for (const ie of m.elems) { const e = M.elems[ie]; L.elem.push({ e: ie, type: 'u', dir: 'gy', q: -d.gBet * e.t * e.w }); }
    });
    /* G2 couverture de remblai sur la traverse (Kter et coefficient de surpression de Marston dans les combinaisons) */
    mk('G2', 'Couverture de remblai sur la traverse', 'LD', (L) => surTraverse(L, d.gTer * d.eprem * Bt));
    /* G3 ballast, armement et équipements (corniches, garde-corps) */
    mk('G3', 'Ballast, armement de la voie et équipements', 'LD', (L) => surTraverse(L, d.gBal * d.epbal * Bt + (G.tranche ? 0 : d.poicor)));
    /* poussées des terres (k = 1 ; k, Kter appliqués dans les combinaisons) : contrainte effective σ'v(z) */
    const zTop = yTop + d.epetan + d.eprem;                         // niveau du terrain fini au droit des piédroits (sous ballast)
    const zw = yBase + (d.hw || 0);
    const sigV = (y) => { const z = Math.max(0, zTop - y), zs = Math.max(0, Math.min(z, zw - y)); return d.gTer * (z - zs) + (d.gTerSat - 10) * zs; };
    const yInfP = G.cadre ? yBas : yBas;                            // pied de la partie libre du piédroit
    for (const [nomc, side, nom] of [['G7', -1, 'piédroit gauche'], ['G8', 1, 'piédroit droit']]) {
      mk(nomc, `Poussée des terres ${side < 0 ? 'à gauche' : 'à droite'} (k = 1)`, 'LD', (L) => {
        L.horiz(nom, side, yInfP, yHaut, (y) => sigV(y) * Bp);
        const [Ft] = integ((y) => sigV(y) * Bp, yHaut, yTop); L.node(side < 0 ? nCG : nCD, -side * Ft, 0);
        const [Fb] = integ((y) => sigV(y) * Bp, yBase, yInfP);
        L.node(side < 0 ? nTalG : nTalD, -side * Fb, 0);
      });
    }
    for (const [nomc, side, nom] of [['G9', -1, 'piédroit gauche'], ['G10', 1, 'piédroit droit']]) {
      mk(nomc, `Poussée ${side < 0 ? 'à gauche' : 'à droite'} du ballast (k = 1)`, 'LD', (L) => {
        const p = d.gBal * d.epbal * Bp;
        L.horiz(nom, side, yInfP, yHaut, () => p);
        L.node(side < 0 ? nCG : nCD, -side * p * (yTop - yHaut), 0); L.node(side < 0 ? nTalG : nTalD, -side * p * (yInfP - yBase), 0);
      });
    }
    /* poids des terres sur les talons (portique) et à l'intérieur */
    if (!G.cadre && semG) {
      const qTal = ((d.hauint + d.eptra + d.eprem + d.epetan) * d.gTer + d.epbal * d.gBal) * G.Brad;
      for (const [nomc, side] of [['G4', -1], ['G5', 1]]) mk(nomc, `Poids des terres sur le talon ${side < 0 ? 'gauche' : 'droit'}`, 'LD', (L) =>
        L.vert(side < 0 ? 'semelle gauche' : 'semelle droite', side * (Xc + eP / 2), side * (Xc + eP / 2 + d.lartal / G.sinB), qTal));
    } else if (!G.cadre) {
      // semelle non modélisée (ressorts ou encastrement) : terres sur le talon ramenées au pied du piédroit (force + moment)
      const qTal = ((d.hauint + d.eptra + d.eprem + d.epetan) * d.gTer + d.epbal * d.gBal) * G.Brad, Ltal = d.lartal / G.sinB, ex = eP / 2 + Ltal / 2;
      for (const [nomc, side] of [['G4', -1], ['G5', 1]]) mk(nomc, `Poids des terres sur le talon ${side < 0 ? 'gauche' : 'droit'}`, 'LD', (L) =>
        L.node(side < 0 ? nBG : nBD, 0, -qTal * Ltal, side * qTal * Ltal * ex));
    }
    if (d.hauterint > 0) mk('G6', 'Poids des terres à l\'intérieur (radier ou patins)', 'LD', (L) => {
      const q = d.gTer * d.hauterint * G.Brad;
      if (G.cadre) L.vert('radier', -xFace, xFace, q);
      else if (semG) { L.vert('semelle gauche', -xFace, -(Xc - (d.eppied / 2 + d.larpat) / G.sinB), q); L.vert('semelle droite', xFace, Xc - (d.eppied / 2 + d.larpat) / G.sinB, q); }
    });
    /* eau : pression latérale γw·hw et sous-pression sur le radier / les semelles */
    if (d.hw > 0) mk('W', 'Poussée hydrostatique et sous-pression', 'LD', (L) => {
      const u = (y) => 10 * Math.max(0, zw - y) * Bp;
      for (const [side, nom] of [[-1, 'piédroit gauche'], [1, 'piédroit droit']]) {
        L.horiz(nom, side, yInfP, Math.min(yHaut, zw), u);
        const [Fb] = integ(u, yBase, Math.min(yInfP, zw)); L.node(side < 0 ? nTalG : nTalD, -side * Fb, 0);
      }
      const up = 10 * d.hw * G.Brad;
      if (G.cadre) { L.vert('radier', -Xc, Xc, -up); L.node(nBG, 0, up * eP / 2); L.node(nBD, 0, up * eP / 2); }
      else for (const m of M.members.filter((mm) => mm.kind === 'sem')) L.vert(m.nom, -1e3, 1e3, -up);
    });
    /* retrait de la traverse (déformation imposée de longue durée) */
    if (d.epsRet) mk('R', 'Retrait de la traverse', 'LD', (L) => L.strainTrav(-Math.abs(d.epsRet), 0));

    /* ── actions variables unitaires (courte durée) ── */
    mk('FR', 'Freinage / démarrage unitaire (1 kN en tête)', 'CD', (L) => L.node(nCG, 1, 0));
    /* surcharge ferroviaire sur le remblai (EN 1991-2 §6.3.6.4) : poussée uniforme sur le piédroit + réaction triangulaire
     * du remblai opposé (hypothèse du programme de référence), intensité unitaire 1 kN/m de hauteur */
    for (const [nomc, side] of [['QRG', -1], ['QRD', 1]]) mk(nomc, `Surcharge du remblai ${side < 0 ? 'à gauche' : 'à droite'} (1 kN/m)`, 'CD', (L) => {
      const nom = side < 0 ? 'piédroit gauche' : 'piédroit droit', opp = side < 0 ? 'piédroit droit' : 'piédroit gauche';
      L.horiz(nom, side, yInfP, yHaut, () => 1);
      L.node(side < 0 ? nCG : nCD, -side * (yTop - yHaut), 0); L.node(side < 0 ? nTalG : nTalD, -side * (yInfP - yBase), 0);
      if (d.reactionRemblai) { L.horiz(opp, -side, yBase + 0, yHaut, (y) => clamp((y - yBase) / (yTop - yBase), 0, 1)); L.node(side < 0 ? nCD : nCG, side * (yTop - yHaut), 0); }
    });
    if (!G.cadre) for (const [nomc, side] of [['QTG', -1], ['QTD', 1]]) mk(nomc, `Surcharge sur le talon ${side < 0 ? 'gauche' : 'droit'} (1 kN/m)`, 'CD', (L) => {
      if (semG) L.vert(side < 0 ? 'semelle gauche' : 'semelle droite', side * (Xc + eP / 2), side * (Xc + eP / 2 + d.lartal / G.sinB), 1);
      else { const Lt = d.lartal / G.sinB; L.node(side < 0 ? nBG : nBD, 0, -Lt, side * Lt * (eP / 2 + Lt / 2)); }
    });
    if (G.cadre && d.charexpint > 0) mk('QI', 'Charge d\'exploitation à l\'intérieur du cadre', 'CD', (L) => L.vert('radier', -xFace, xFace, d.charexpint * G.Brad));
    /* température : dilatation unitaire 1e-4 (longue et courte durée) et gradient unitaire 1e-4 /m (courte durée) */
    if (d.dilLD || d.conLD) mk('TNL', 'Variation uniforme unitaire ε = 1e-4 (longue durée)', 'LD', (L) => L.strainTrav(1e-4, 0));
    if (d.dilCD || d.conCD) mk('TNC', 'Variation uniforme unitaire ε = 1e-4 (courte durée)', 'CD', (L) => L.strainTrav(1e-4, 0));
    if (d.gradHeat || d.gradCool) mk('TG', 'Gradient unitaire κ = 1e-4 /m, fibre supérieure chaude', 'CD', (L) => L.strainTrav(0, -1e-4));
    /* engin de chantier sur le remblai : pression trapézoïdale (fiche F7b IN 0032, manuel IV.4.4) */
    if (d.engin) {
      const phi = d.phi * DEG, S = (d.Pav + d.Par) * 1.5, ep = d.epRembPro + d.eptra / 2;
      const LonRep = d.empat + d.aImp + ep, LarRepE = G.tranche ? ((d.voieAv + d.voieAr) / 2 + d.bImp + ep) : 1;
      const h1 = LonRep * Math.tan(phi), h2 = LonRep * Math.tan(Math.PI / 4 + phi / 2);
      const W = S * Math.tan(Math.PI / 4 - phi / 2) / LarRepE * 2 / (h1 + h2);
      mk('ENR', 'Poussée de l\'engin de chantier à gauche', 'CD', (L) => {
        const p = (y) => { const z = yTop - y; return z <= h1 ? W : z >= h2 ? 0 : W * (h2 - z) / (h2 - h1); };
        L.horiz('piédroit gauche', -1, yInfP, yHaut, p);
      });
      cases.ENR.W = W;
    }
    return cases;
  }

  /* ══════════════════ 5. Sorties : stations (M, N, V), sol, fondations, flèche ══════════════════ */
  function sorties(M, G, R, d) {
    const st = [];
    M.elems.forEach((e, ie) => { const L = Math.hypot(M.nodes[e.j].x - M.nodes[e.i].x, M.nodes[e.j].y - M.nodes[e.i].y);
      for (const end of [0, 1]) { const n = end ? e.j : e.i; st.push({ e: ie, x: end * L, end, X: M.nodes[n].x, Y: M.nodes[n].y, membre: e.membre, kind: e.kind, c: end ? e.c1 : e.c0 }); } });
    const out = { stations: st, nSt: st.length, ressorts: R.ressorts, fond: [] };
    out.iSol = 3 * st.length;
    out.iFond = out.iSol + R.ressorts.length;
    // résultantes de fondation : portique (semelles ou ressorts) ou radier du cadre (N, H, M)
    out.fond = G.cadre ? [{ nom: 'radier', side: 0 }] : [{ nom: 'semelle gauche', side: -1 }, { nom: 'semelle droite', side: 1 }];
    out.iDefl = out.iFond + 3 * out.fond.length;
    out.n = out.iDefl + 1;
    return out;
  }
  function vecteur(r, M, G, S, R, d) {
    const v = new Float64Array(S.n);
    S.stations.forEach((s, k) => { const f = r.at(s.e, s.x); v[3 * k] = f.M; v[3 * k + 1] = f.N; v[3 * k + 2] = f.V; });
    const rx = new Map(r.reac.map((q) => [q.n, q]));
    R.ressorts.forEach((sp, k) => { const q = rx.get(sp.n); v[S.iSol + k] = q ? q.Ry / sp.A : 0; });
    S.fond.forEach((f, k) => {
      let N = 0, H = 0, Mo = 0;
      const xc = f.side === 0 ? 0 : f.side * G.Xc + (G.cadre ? 0 : f.side * ((d.eppied / 2 + d.lartal) / G.sinB - G.larSem / G.sinB / 2));
      for (const q of r.reac) { const x = M.nodes[q.n].x; if (f.side !== 0 && Math.sign(x) !== f.side) continue; N += q.Ry; H += q.Rx; Mo += q.Ry * (x - xc) + (q.Mz || 0); }
      // N > 0 : compression du sol ; H : réaction horizontale ; M : moment des réactions autour du centre de la fondation
      v[S.iFond + 3 * k] = N; v[S.iFond + 3 * k + 1] = H; v[S.iFond + 3 * k + 2] = Mo;
    });
    const nm = M.nd(0, G.Yc), u = r.nodeDisp(nm).uy, ua = r.nodeDisp(M.nd(-G.Xc, G.Yc)).uy, ub = r.nodeDisp(M.nd(G.Xc, G.Yc)).uy;
    v[S.iDefl] = -(u - (ua + ub) / 2);                  // flèche relative de mi-traverse (> 0 vers le bas)
    return v;
  }

  /* ══════════════════ 6. Lignes d'influence et convois ══════════════════ */
  function lignesInfluence(M, G, prepCD, S, R, d) {
    const trav = M.members.find((m) => m.nom === 'traverse');
    const x0 = -G.Xc, x1 = G.Xc, nP = Math.max(60, Math.ceil(G.LarCal / Math.min(0.1, G.LarCal / 80)));
    const xs = [], Y = [];
    for (let k = 0; k <= nP; k++) {
      const x = x0 + (x1 - x0) * k / nP;
      let ie = trav.elems.find((i) => { const e = M.elems[i]; return x >= Math.min(e.c0, e.c1) - 1e-5 && x <= Math.max(e.c0, e.c1) + 1e-5; });
      if (ie === undefined) ie = trav.elems[x < 0 ? 0 : trav.elems.length - 1];
      const e = M.elems[ie], a = clamp(x - e.c0, 0, e.c1 - e.c0);
      const r = prepCD.run({ elem: [{ e: ie, type: 'p', dir: 'gy', P: -1, a }] });
      xs.push(x); Y.push(vecteur(r, M, G, S, R, d));
    }
    return { xs, Y, h: (x1 - x0) / nP, x0, x1 };
  }
  /* intégrales cumulées d'une ligne d'influence échantillonnée (trapèzes) et évaluation en x quelconque */
  function cumul(xs, y) {
    const n = xs.length, F = new Float64Array(n); for (let k = 1; k < n; k++) F[k] = F[k - 1] + (y[k] + y[k - 1]) / 2 * (xs[k] - xs[k - 1]);
    const h = xs[1] - xs[0], x0 = xs[0];
    const at = (x) => { if (x <= x0) return 0; if (x >= xs[n - 1]) return F[n - 1]; const t = (x - x0) / h, k = Math.min(n - 2, Math.floor(t)), r = t - k; const yk = y[k], yx = y[k] + (y[k + 1] - y[k]) * r; return F[k] + (yk + yx) / 2 * r * h; };
    return { F, at, tot: F[n - 1] };
  }
  /* enveloppes des convois unitaires (une voie, α = 1, Φ = 1) pour la sortie t, avec efforts concomitants du groupe gr */
  function enveloppesConvois(LI, t, gr, conv) {
    const xs = LI.xs, n = xs.length, h = LI.h, x0 = LI.x0, x1 = LI.x1;
    const yT = LI.Y.map((v) => v[t]);
    const C = cumul(xs, yT);
    const res = {};
    const mkG = () => gr.map((j) => cumul(xs, LI.Y.map((v) => v[j])));
    let CG = null;
    for (const nomC of conv) {
      res[nomC] = {};
      for (const sg of [1, -1]) {
        let best = { v: 0, cfg: null };
        if (nomC === 'LM71') {
          // 4 × 250 kN répartis sur 6,40 m (156,25 kN/m) + 80 kN/m de longueur illimitée, fractionnable (§6.3.2, §6.3.6.2 (2))
          const lobe = new Float64Array(n); for (let k = 1; k < n; k++) { const m = sg * (yT[k] + yT[k - 1]); lobe[k] = lobe[k - 1] + (m > 0 ? (yT[k] + yT[k - 1]) / 2 * h : 0); }
          const lob = (x) => { if (x <= x0) return 0; if (x >= x1) return lobe[n - 1]; const tt = (x - x0) / h, k = Math.min(n - 2, Math.floor(tt)), r = tt - k; return lobe[k] + (lobe[k + 1] - lobe[k]) * r; };
          const tot = lobe[n - 1];
          if (sg * 80 * tot > best.v) best = { v: sg * 80 * tot, cfg: { s: null } };
          for (let s = x0 - 6.4; s <= x1 + 1e-9; s += h / 2) {
            const e = 156.25 * (C.at(s + 6.4) - C.at(s)) + 80 * (tot - (lob(s + 6.4) - lob(s)));
            if (sg * e > best.v) best = { v: sg * e, cfg: { s } };
          }
          if (best.cfg) { CG = CG || mkG(); const s = best.cfg.s;
            best.conc = gr.map((j, ig) => { const yj = LI.Y.map((v) => v[j]); let c = 0;
              for (let k = 1; k < n; k++) { if (sg * (yT[k] + yT[k - 1]) <= 0) continue; let a = xs[k - 1], b = xs[k], w = (yj[k] + yj[k - 1]) / 2 * h;
                if (s !== null) { const u = Math.max(a, s), vv = Math.min(b, s + 6.4); if (vv > u) w *= 1 - (vv - u) / h; }
                c += 80 * w; }
              if (s !== null) c += 156.25 * (CG[ig].at(s + 6.4) - CG[ig].at(s));
              return c; }); }
        } else if (nomC === 'SW0' || nomC === 'SW2') {
          const { q, a, c } = CH.SW[nomC === 'SW0' ? 'SW/0' : 'SW/2'];
          for (let s = x0 - 2 * a - c; s <= x1 + 1e-9; s += h / 2) {
            const e = q * (C.at(s + a) - C.at(s) + C.at(s + 2 * a + c) - C.at(s + a + c));
            if (sg * e > best.v) best = { v: sg * e, cfg: { s } };
          }
          if (best.cfg) { CG = CG || mkG(); const s = best.cfg.s; best.conc = CG.map((g) => q * (g.at(s + a) - g.at(s) + g.at(s + 2 * a + c) - g.at(s + a + c))); }
        } else if (nomC === 'ENG') {
          const E = conv.engin, lx = E.lx;
          for (const [P1, P2] of [[E.P1, E.P2], [E.P2, E.P1]]) for (let s = x0 - lx - E.e; s <= x1 + lx; s += h / 2) {
            const e = P1 / lx * (C.at(s + lx / 2) - C.at(s - lx / 2)) + P2 / lx * (C.at(s + E.e + lx / 2) - C.at(s + E.e - lx / 2));
            if (sg * e > best.v) best = { v: sg * e, cfg: { s, P1, P2 } };
          }
          if (best.cfg) { CG = CG || mkG(); const { s, P1, P2 } = best.cfg; best.conc = CG.map((g) => P1 / lx * (g.at(s + lx / 2) - g.at(s - lx / 2)) + P2 / lx * (g.at(s + E.e + lx / 2) - g.at(s + E.e - lx / 2))); }
        }
        if (!best.conc) best.conc = gr.map(() => 0);
        best.v *= sg; res[nomC][sg > 0 ? 'max' : 'min'] = best;
      }
    }
    return res;
  }

  /* ══════════════════ 7. Combinaisons (EN 1990 annexe A2 + AN) ══════════════════ */
  /* facteurs (sup, inf) des actions permanentes élémentaires pour un état et une famille de poussée */
  function facteursPerm(d, etat, fam, cof) {
    const elu = etat === 'ELU', gs = elu ? d.gGsup : 1, gi = elu ? d.gGinf : 1;
    const kmax = fam === 'ka' ? cof.kaMax : cof.k0Max, kmin = fam === 'ka' ? cof.kaMin : cof.k0Min;
    return {
      G1: [gs, gi], G2: [gs * d.KterMax * d.Kmarston, gi * d.KterMin], G3: [gs * d.KbalMax, gi * d.KbalMin],
      G4: [gs * d.KterMax, gi * d.KterMin], G5: [gs * d.KterMax, gi * d.KterMin], G6: [gs * d.KterMax, gi * d.KterMin],
      G7: [gs * kmax * d.KterMax, gi * kmin * d.KterMin], G8: [gs * kmax * d.KterMax, gi * kmin * d.KterMin],
      G9: [gs * kmax * d.KbalMax, gi * kmin * d.KbalMin], G10: [gs * kmax * d.KbalMax, gi * kmin * d.KbalMin],
      W: [elu ? d.gW : 1, 0], R: [elu ? d.gSH : 1, 0],
    };
  }
  const PSI = { T: { p0: 0.8, p1: [0.8, 0.7, 0.6], p2: 0 }, Q: { p0: 0.8, p1: 0.5, p2: 0 }, TH: { p0: 0.6, p1: 0.6, p2: 0.5 } };

  /* ══════════════════ 8. Calcul complet ══════════════════ */
  function calcul(d0, opts = {}) {
    const d = Object.assign(defauts(d0.type || 'cadre'), d0);
    ['ouv', 'hauint', 'eptra', 'eppied', 'eprad', 'hausem', 'larpat', 'lartal', 'haugousup', 'longousup', 'haugouinf', 'longouinf', 'hauterint', 'biais', 'nbvoi',
      'axevoi1', 'axevoi2', 'epbal', 'hautraverse', 'eprem', 'epetan', 'lontottab', 'lonpied', 'lonrad', 'vmax', 'alpha', 'alphaSW2', 'chVoie', 'freinLM', 'freinSW2', 'poicor', 'charexpint',
      'phi', 'dphi', 'gTer', 'gTerSat', 'gBal', 'gBet', 'gEtan', 'KterMax', 'KterMin', 'Kmarston', 'KbalMax', 'KbalMin', 'hw', 'ksol', 'EM', 'alphaM', 'rapSol', 'qu', 'De', 'phiF', 'cohF',
      'fck', 'fyk', 'phiFluage', 'cCou', 'cOuv', 'cRad', 'dAxe', 'wmax', 'sigLim', 'phiBar', 'espBar', 'epsRet', 'dilLD', 'dilCD', 'conLD', 'conCD', 'gradHeat', 'gradCool',
      'gGsup', 'gGinf', 'gLM', 'gSW2', 'gFill', 'gQ', 'gT', 'gSH', 'gW', 'Pav', 'Par', 'voieAv', 'voieAr', 'empat', 'aImp', 'bImp', 'epRembPro', 'Ldelta', 'kLdelta', 'bv', 'Kv', 'Kh', 'Kr']
      .forEach((k) => { if (d[k] !== undefined) d[k] = num(d[k], 0); });
    const alertes = [];
    const lim = (c, msg) => { if (!c) alertes.push(msg); };
    if (d.type === 'cadre') { lim(d.ouv >= 1 && d.ouv <= 15, 'Ouverture hors du domaine des cadres (1 à 15 m).'); }
    else lim(d.ouv >= 5 && d.ouv <= 25, 'Portée hors du domaine des portiques (5 à 25 m).');
    lim(d.biais >= 70 && d.biais <= 130, 'Biais hors du domaine 70 – 130 grades.');
    if (!(d.ouv > 0 && d.hauint > 0 && d.eptra > 0 && d.eppied > 0)) throw new Error('Géométrie incomplète : ouverture, hauteur et épaisseurs doivent être positives.');
    const G = geometrie(d);
    const M = maillage(d, G, opts);
    const cof = coefTrafic(d, G);
    if (cof.info && !G.tranche && cof.info.includes('indisponible')) alertes.push(cof.info);
    cof.kaMax = ka(d.phi - d.dphi); cof.kaMin = ka(d.phi + d.dphi); cof.k0Max = k0(d.phi - d.dphi, d.k0mode); cof.k0Min = k0(d.phi + d.dphi, d.k0mode);
    cof.ka = ka(d.phi); cof.k0 = k0(d.phi, d.k0mode);
    // module de réaction du sol
    let kMPa = d.ksol;
    if (d.solMode === 'pressio') {
      const B = G.cadre ? G.LarCal + G.eP : G.larSem / G.sinB, L = G.Brad, F = (opt('fondations', './fondations.js') || {});
      if (F.souplesseMenard) kMPa = 1 / F.souplesseMenard(Math.min(B, L), Math.max(B, L), false, d.alphaM, d.EM, d.EM).s;
      else { const r = Math.max(B, L) / Math.min(B, L), lc = r <= 1 ? 1.1 : r <= 2 ? 1.1 + 0.1 * (r - 1) : Math.min(1.5, 1.2 + 0.05 * (r - 2)), ld = r <= 1 ? 1.12 : Math.min(2.65, 1.12 + 0.41 * (r - 1)), Bm = Math.min(B, L);
        kMPa = 1 / (d.alphaM * lc * Bm / (9 * d.EM) + 2 * 0.6 * Math.pow(ld * Bm / 0.6, d.alphaM) / (9 * d.EM)); }
      cof.kSolCalc = kMPa;
    }
    const R = appuis(d, G, M, kMPa * 1000);
    const Ec = Ecm(d.fck) * 1000, ELD = Ec / (1 + d.phiFluage);
    const mk = (E, sup) => ({ nodes: M.nodes, elems: M.elems.map((e) => ({ i: e.i, j: e.j, E, A: e.A, I: e.I })), supports: sup });
    const prepLD = PQ.prepare(mk(ELD, R.sup.LD)), prepCD = PQ.prepare(mk(Ec, R.sup.CD));
    const S = sorties(M, G, R, d);
    const cases = casElementaires(d, G, M, cof);
    const E = {};
    for (const [k, c] of Object.entries(cases)) { const r = (c.dur === 'LD' ? prepLD : prepCD).run({ elem: c.L.elem, nodal: c.L.nodal, strain: c.L.strain }); E[k] = vecteur(r, M, G, S, R, d); c.res = r; }
    const LI = lignesInfluence(M, G, prepCD, S, R, d);

    /* ── convois et coefficients ── */
    const convs = [];
    if (d.LM71) convs.push('LM71'); if (d.SW0) convs.push('SW0'); if (d.SW2) convs.push('SW2');
    if (!convs.length) convs.push('LM71');
    let engin = null;
    if (d.engin) {
      const ep = d.epRembPro + d.eptra / 2, lx = d.aImp + ep;
      const larE = (d.voieAv + d.voieAr) / 2 + d.bImp + ep;
      const div = G.tranche ? Math.min(larE, d.lontottab) : 1;
      engin = { P1: d.Pav * 1.5 / div, P2: d.Par * 1.5 / div, e: d.empat, lx, larE };
      convs.push('ENG'); convs.engin = engin;
    }
    const nv = d.nbvoi >= 2 ? 2 : 1;
    const cT = cof.phi * (G.tranche ? cof.cN : cof.cN);         // coefficient d'une famille (toutes voies) sur l'effet d'une voie unitaire
    cof.cLM = d.alpha * cof.phi * cof.cN; cof.cSW2 = d.alphaSW2 * cof.phi * (G.tranche ? cof.c1 : cof.K);
    // coefficient « 1 voie chargée » (flèche)
    cof.c1voie = d.alpha * cof.phi * cof.c1;
    // freinage / démarrage : q × longueur de l'ouvrage × Kd, sur toutes les voies (EN 1991-2 §6.5.3), réparti comme les charges verticales
    const nFr = G.tranche ? (cof.nOver || 1) / cof.larRep : nv;
    cof.FLM = d.freinLM * d.alpha * G.Lstruct * cof.Kd * nFr;
    cof.FSW2 = d.freinSW2 * G.Lstruct * cof.Kd * (G.tranche ? 1 / cof.larRep : (nv > 1 ? 2 : 1));
    // surcharge du remblai : q = chVoie·α par voie, diffusée sur 3,00 m à 0,70 m sous le plan de roulement puis à 2:1 (§6.3.6.4)
    const yTop = G.Yc + d.eptra / 2;
    const prof = (y) => Math.max(0, yTop + d.epetan + d.eprem + d.epbal + 0.2 - 0.7 - y);  // profondeur sous le niveau de diffusion
    const fracBande = (larg) => { if (G.tranche) return 1; const Lw = d.lonpied * G.sinB; let f = 0; for (const e of cof.voies) { const a = Math.max(-Lw / 2, e - larg / 2), b = Math.min(Lw / 2, e + larg / 2); f += Math.max(0, b - a) / larg; } return f; };
    const yMid = (G.ebas / 2 + G.Yc - d.eptra / 2) / 2, larMid = 3 + prof(yMid);
    cof.Wfill = d.chVoie * d.alpha * (G.tranche ? (cof.nOver || 1) / larMid : fracBande(larMid));
    const larTal = 3 + prof(G.ebas / 2);
    cof.Qtal = d.chVoie * d.alpha * (G.tranche ? 1 / larTal : fracBande(larTal));

    /* ── enveloppes ── */
    const groupe = (t) => { if (t < S.iSol) { const k = Math.floor(t / 3) * 3; return [k, k + 1, k + 2]; } if (t >= S.iFond && t < S.iDefl) { const k = S.iFond + Math.floor((t - S.iFond) / 3) * 3; return [k, k + 1, k + 2]; } return [t]; };
    const envCache = new Map();
    const envConv = (t) => { if (!envCache.has(t)) envCache.set(t, enveloppesConvois(LI, t, groupe(t), convs)); return envCache.get(t); };
    const permList = Object.keys(E).filter((k) => /^(G\d+|W|R)$/.test(k));

    /* contribution (vecteur groupe) d'une action variable unitaire, incluse si défavorable pour sg */
    const addIf = (acc, gr, pos, vec, f, sg) => { if (!vec || !f) return 0; const v = vec[gr[pos]] * f; if (sg * v <= 0) return 0; gr.forEach((j, i) => (acc[i] += vec[j] * f)); return v; };
    /* groupe de charges ferroviaires (vertical + freinage + surcharges des remblais) */
    function trafic(t, gr, pos, sg, etat, eng, fam) {
      const kP = fam === 'k0' ? cof.k0 : cof.ka;   // la surcharge des remblais pousse avec le coefficient de la famille étudiée
      const env = envConv(t), elu = etat === 'ELU', best = { v: 0, c: gr.map(() => 0), lib: '' };
      const fams = [];
      if (eng) { if (env.ENG) fams.push({ lib: 'engin de chantier', parts: [['ENG', 1]], g: elu ? 1.35 : 1, F: 0, eng: true }); }
      else {
        const lm = ['LM71', 'SW0'].filter((c) => env[c]);
        if (lm.length) fams.push({ lib: nv > 1 ? 'LM71/SW0 sur les voies' : 'LM71/SW0', parts: lm.map((c) => [c, cof.cLM]), alt: true, g: elu ? d.gLM : 1, F: cof.FLM, gF: elu ? d.gLM : 1 });
        if (env.SW2) {
          if (nv > 1 && !G.tranche && lm.length) fams.push({ lib: 'SW/2 + LM71 (gr 26)', parts: [['SW2', cof.cSW2]], add: lm.map((c) => [c, d.alpha * cof.phi * cof.K]), g: elu ? d.gSW2 : 1, gAdd: elu ? d.gLM : 1, F: cof.FSW2, gF: elu ? d.gSW2 : 1 });
          else if (nv > 1 && G.tranche && (cof.nOver || 1) > 1 && lm.length) fams.push({ lib: 'SW/2 + LM71 (gr 26)', parts: [['SW2', cof.cSW2]], add: lm.map((c) => [c, d.alpha * cof.phi * cof.c1]), g: elu ? d.gSW2 : 1, gAdd: elu ? d.gLM : 1, F: cof.FSW2, gF: elu ? d.gSW2 : 1 });
          else fams.push({ lib: 'SW/2', parts: [['SW2', cof.cSW2]], g: elu ? d.gSW2 : 1, F: cof.FSW2, gF: elu ? d.gSW2 : 1 });
        }
      }
      for (const f of fams) {
        const acc = gr.map(() => 0); let v = 0;
        // vertical : enveloppe du meilleur convoi de la famille
        let bv = null; for (const [c, k] of f.parts) { const e = env[c][sg > 0 ? 'max' : 'min']; const val = e.v * k * f.g; if (!bv || sg * val > sg * bv.v) bv = { v: val, c: e.conc.map((x) => x * k * f.g) }; }
        if (bv && sg * bv.v > 0) { v += bv.v; bv.c.forEach((x, i) => (acc[i] += x)); }
        else if (f.F && !f.eng) {
          // le freinage n'existe pas sans le train : charge verticale favorable conservée à 0,5 (EN 1991-2 tableau 6.11, note)
          let bf = null; for (const [c, k] of f.parts) { const e = env[c][sg > 0 ? 'min' : 'max']; const val = 0.5 * e.v * k * f.g; if (!bf || sg * val > sg * bf.v) bf = { v: val, c: e.conc.map((x) => 0.5 * x * k * f.g) }; }
          if (bf) { v += bf.v; bf.c.forEach((x, i) => (acc[i] += x)); }
        }
        if (f.add) { let ba = null; for (const [c, k] of f.add) { const e = env[c][sg > 0 ? 'max' : 'min']; const val = e.v * k * f.gAdd; if (!ba || sg * val > sg * ba.v) ba = { v: val, c: e.conc.map((x) => x * k * f.gAdd) }; }
          if (ba && sg * ba.v > 0) { v += ba.v; ba.c.forEach((x, i) => (acc[i] += x)); } }
        if (f.eng) { if (E.ENR) v += addIf(acc, gr, pos, E.ENR, 1.35 * (elu ? 1 : 1 / 1.35), sg); }
        else {
          // freinage dans le sens défavorable
          if (f.F && E.FR) { const fv = E.FR[t] * f.F * f.gF; const s2 = sg * fv >= 0 ? 1 : -1; gr.forEach((j, i) => (acc[i] += s2 * E.FR[j] * f.F * f.gF)); v += s2 * fv; }
          const gf = elu ? d.gFill : 1;
          for (const c of ['QRG', 'QRD']) v += addIf(acc, gr, pos, E[c], cof.Wfill * kP * gf, sg);
          for (const c of ['QTG', 'QTD']) v += addIf(acc, gr, pos, E[c], cof.Qtal * gf, sg);
        }
        if (sg * v > sg * best.v) { best.v = v; best.c = acc; best.lib = f.lib; }
      }
      return best;
    }
    function thermique(t, gr, pos, sg) {
      const cands = [];
      const N = (eLD, eCD) => gr.map((j) => (E.TNL ? E.TNL[j] * eLD / 1e-4 : 0) + (E.TNC ? E.TNC[j] * eCD / 1e-4 : 0));
      const Gv = (dt) => gr.map((j) => (E.TG ? E.TG[j] * dt * 1e-5 / Math.max(1e-6, d.eptra) / 1e-4 : 0));   // κ = αT ΔT / h
      const Ns = [N(d.dilLD, d.dilCD), N(d.conLD, d.conCD)], Gs = [Gv(d.gradHeat), Gv(-d.gradCool)];
      for (const n of Ns) for (const g of Gs) for (const [wN, wM] of [[1, 0.75], [0.35, 1]]) cands.push(n.map((x, i) => wN * x + wM * g[i])); // EN 1991-1-5 §6.1.5
      let best = gr.map(() => 0), bv = 0;
      for (const c of cands) if (sg * c[pos] > sg * bv) { bv = c[pos]; best = c; }
      return { v: bv, c: best };
    }
    /* combinaison pour la sortie t (sens sg) à l'état etat ('ELU','CAR','FREQ','QP') et la famille de poussée fam */
    function combine(t, sg, etat, fam) {
      const gr = groupe(t), pos = gr.indexOf(t);
      const F = facteursPerm(d, etat, fam, cof);
      const perm = gr.map(() => 0); let lib = [];
      // actions de même origine pondérées ensemble (EN 1990 §6.4.3.1 (4) note 3) : ballast (poids + poussées), terres de
      // chaque côté du portique (talon + poussée) ; les autres cas élémentaires sont pondérés selon le signe de leur effet
      const groupes = [['G3', 'G9', 'G10'], ['G4', 'G7'], ['G5', 'G8']].map((g) => g.filter((k) => E[k]));
      const dansG = new Set(groupes.flat());
      for (const g of groupes) { if (!g.length) continue;
        const tot = (i) => g.reduce((a, k) => a + E[k][t] * (F[k] ? F[k][i] : 0), 0);
        const i = sg * tot(0) >= sg * tot(1) ? 0 : 1;
        for (const k of g) { const ff = F[k] ? F[k][i] : 0; if (ff) gr.forEach((j, q) => (perm[q] += E[k][j] * ff)); } }
      for (const k of permList) { if (dansG.has(k)) continue; const f = F[k]; if (!f) continue; const v = E[k][t]; const ff = sg * v > 0 ? f[0] : f[1]; if (ff) gr.forEach((j, i) => (perm[i] += E[k][j] * ff)); }
      const elu = etat === 'ELU';
      const T = trafic(t, gr, pos, sg, etat, false, fam), TH = thermique(t, gr, pos, sg);
      const Q = { v: 0, c: gr.map(() => 0) }; if (E.QI) { const v = E.QI[t] * d.charexpint; if (sg * v > 0) { Q.v = v; Q.c = gr.map((j) => E.QI[j] * d.charexpint); } }
      const gQ = elu ? d.gQ : 1, gT = elu ? d.gT : 1, gTr = 1; // γ du trafic déjà inclus dans trafic()
      const p1T = PSI.T.p1[Math.min(nv, 3) - 1];
      const cand = [];
      const lin = (parts) => { const c = perm.slice(); let lb = []; for (const [k, o] of parts) { if (!k || !o) continue; o.c.forEach((x, i) => (c[i] += k * x)); if (o.lib && k) lb.push(o.lib); } return { c, lib: lb.join(' + ') }; };
      if (etat === 'ELU' || etat === 'CAR') {
        cand.push(lin([[gTr, T], [gQ * PSI.Q.p0, Q], [gT * PSI.TH.p0, TH]]));
        cand.push(lin([[gTr * PSI.T.p0, T], [gQ, Q], [gT * PSI.TH.p0, TH]]));
        cand.push(lin([[gTr * PSI.T.p0, T], [gQ * PSI.Q.p0, Q], [gT, TH]]));
        if (engin) { const Eg = trafic(t, gr, pos, sg, etat, true, fam); cand.push(lin([[1, Eg], [gT * PSI.TH.p0, TH]])); }
      } else if (etat === 'FREQ') {
        cand.push(lin([[p1T, T], [PSI.TH.p2, TH]]));
        cand.push(lin([[PSI.Q.p1, Q], [PSI.TH.p2, TH]]));
        cand.push(lin([[PSI.TH.p1, TH]]));
      } else cand.push(lin([[PSI.TH.p2, TH]]));
      let best = null; for (const c of cand) if (!best || sg * c.c[pos] > sg * best.c[pos]) best = c;
      const o = { v: best.c[pos], g: gr, c: best.c, lib: best.lib, fam };
      return o;
    }
    const ETATS = ['ELU', 'CAR', 'FREQ', 'QP'];
    const envelop = (t, sg, etat) => { const a = combine(t, sg, etat, 'ka'), b = combine(t, sg, etat, 'k0'); return sg * a.v >= sg * b.v ? a : b; };

    /* enveloppes aux stations */
    const env = S.stations.map((s, k) => {
      const o = {};
      for (const et of ETATS) {
        const r = {};
        for (const [q, off] of [['M', 0], ['N', 1], ['V', 2]]) for (const sg of [1, -1]) {
          const c = envelop(3 * k + off, sg, et);
          r[q + (sg > 0 ? 'max' : 'min')] = { M: c.c[0], N: c.c[1], V: c.c[2], lib: c.lib, fam: c.fam };
        }
        o[et] = r;
      }
      return o;
    });

    /* ── sections de calcul et justifications ── */
    const sections = sectionsDeCalcul(d, G, M, S);
    const SBA = sba();
    const justif = sections.map((sec) => justifier(d, G, sec, env[sec.st], SBA));

    /* ── flèche sous LM71 (une voie, inertie fissurée) ── */
    const eD = envConv(S.iDefl);
    const dGross = Math.max(...convs.filter((c) => c !== 'ENG').map((c) => eD[c].max.v)) * cof.c1voie;
    const jMid = justif.find((j) => j.sec.cle === 'trav-mi');
    // rigidité : interpolation entre états non fissuré et fissuré à mi-traverse (EN 1992-1-1 §7.4.3 (7.18), β = 1,
    // courte durée), ζ = 1 − (Mcr/M)² sous la combinaison caractéristique, appliquée à toute la traverse (approximation)
    let ratioI = 1, zeta = 0, Mcr = NaN, Mser = NaN;
    if (jMid && jMid.Ifiss > 0) {
      Mser = Math.max(0, env[jMid.sec.st].CAR.Mmax.M / jMid.w); Mcr = fctm(d.fck) * 1000 * jMid.h * jMid.h / 6;
      zeta = Mser > Mcr ? 1 - Math.pow(Mcr / Mser, 2) : 0;
      ratioI = zeta * jMid.Ibrut / jMid.Ifiss + (1 - zeta);
    }
    const Lf = G.LarCal;
    const LdAdm = d.Ldelta * d.kLdelta / Math.max(0.1, d.bv);
    const fleche = { delta: dGross * ratioI, dGross, ratioI, zeta, Mcr, Mser, Ifiss: jMid && jMid.Ifiss, Ibrut: jMid && jMid.Ibrut, L: Lf, admConfort: Lf / LdAdm, adm600: Lf / 600, LdAdm };
    fleche.ok = fleche.delta <= fleche.admConfort + 1e-12 && (!d.Ld600 || fleche.delta <= fleche.adm600);

    /* ── sol et fondations ── */
    const sol = solFondations(d, G, M, S, R, envelop, cof, alertes);

    /* diagrammes enveloppes (par barre) */
    const diag = M.members.map((m) => {
      const ks = S.stations.map((s, k) => (s.membre === m.nom ? k : -1)).filter((k) => k >= 0);
      return { nom: m.nom, kind: m.kind, horiz: m.horiz, pts: ks.map((k) => ({ c: S.stations[k].c, X: S.stations[k].X, Y: S.stations[k].Y, k })) };
    });
    return { d, G, M, cof, cases, E, S, LI, env, sections, justif, fleche, sol, diag, alertes, kSol: kMPa,
      ENV: (t, sg, et) => envelop(t, sg, et), ressorts: R.ressorts };
  }

  /* sections de calcul : faces des appuis, extrémités des goussets, quarts et milieux */
  function sectionsDeCalcul(d, G, M, S) {
    const L = [];
    const Xc = G.Xc, eP = G.eP, yBas = G.ebas / 2, yHaut = G.Yc - d.eptra / 2;
    const near = (membre, c, cote) => { // station de la barre 'membre' à la coordonnée c, côté intérieur de la portée (cote : +1 côté c croissant)
      let best = -1, bd = Infinity;
      S.stations.forEach((s, k) => { if (s.membre !== membre) return; const e = M.elems[s.e]; const other = s.end ? e.c0 : e.c1; if (cote && Math.sign(other - s.c) !== cote) return; const dd = Math.abs(s.c - c); if (dd < bd - 1e-9) { bd = dd; best = k; } });
      return best;
    };
    const push = (cle, lib, membre, c, cote, face) => { const k = near(membre, c, cote); if (k < 0) return; const s = S.stations[k], e = M.elems[s.e];
      const mb = M.members.find((m) => m.nom === membre); const t = mb.t(s.X, s.Y); L.push({ cle, lib, membre, c, st: k, h: t, b: e.w, face, kind: e.kind }); };
    const lg = d.longousup || 0, hgS = d.haugousup || 0;
    push('trav-nu', 'Traverse, nu du piédroit', 'traverse', -(Xc - eP / 2), 1);
    if (lg > 0) push('trav-gou', 'Traverse, fin de gousset', 'traverse', -(Xc - eP / 2 - lg), 1);
    push('trav-q', 'Traverse, quart de portée', 'traverse', -(Xc - eP / 2) / 2, 1);
    push('trav-mi', 'Traverse, mi-portée', 'traverse', 0, 1);
    const pb = G.cadre ? 'Piédroit, nu du radier' : 'Piédroit, nu de la semelle';
    if (G.cadre || d.fond === 'superficielle' || !d.fond) push('pied-bas', pb, 'piédroit gauche', yBas, 1);
    else push('pied-bas', 'Piédroit, encastrement en pied', 'piédroit gauche', 0, 1);
    if (G.cadre && (d.haugouinf || 0) > 0) push('pied-goub', 'Piédroit, fin du gousset inférieur', 'piédroit gauche', yBas + d.haugouinf, 1);
    push('pied-mi', 'Piédroit, mi-hauteur', 'piédroit gauche', G.Yc / 2, 1);
    if (hgS > 0) push('pied-gouh', 'Piédroit, fin du gousset supérieur', 'piédroit gauche', yHaut - hgS, -1);
    push('pied-haut', 'Piédroit, nu de la traverse', 'piédroit gauche', yHaut, -1);
    if (G.cadre) {
      push('rad-nu', 'Radier, nu du piédroit', 'radier', -(Xc - eP / 2), 1);
      if ((d.longouinf || 0) > 0) push('rad-gou', 'Radier, fin de gousset', 'radier', -(Xc - eP / 2 - d.longouinf), 1);
      push('rad-mi', 'Radier, mi-portée', 'radier', 0, 1);
    } else if (M.members.some((m) => m.kind === 'sem')) {
      push('sem-tal', 'Semelle, talon au nu du piédroit', 'semelle gauche', -(Xc + eP / 2), -1);
      push('sem-pat', 'Semelle, patin au nu du piédroit', 'semelle gauche', -(Xc - eP / 2), 1);
    }
    return L;
  }

  /* ══════════════════ 9. Justification d'une section (EC2) ══════════════════ */
  function justifier(d, G, sec, ev, SBA) {
    const b = 1, h = sec.h, w = sec.b;
    // enrobages : face intérieure (nappe « sup » au sens de BA.sectionBA, M > 0 la tend) et face extérieure
    let cIn = d.cCou, cOut = d.cCou;
    if (sec.kind === 'pied' || sec.kind === 'trav') cIn = d.cOuv;   // faces vues (intrados, faces intérieures)
    if (sec.kind === 'radier' || sec.kind === 'sem') { cIn = d.cRad; cOut = d.cCou; }
    const dIn = cIn + d.dAxe, dOut = h - (cOut + d.dAxe);
    const pm = (o) => ({ M: o.M / w, N: -o.N / w, V: Math.abs(o.V) / w });     // par mètre ; N > 0 compression pour sectionBA
    const VmaxELU = Math.max(Math.abs(ev.ELU.Vmax.V), Math.abs(ev.ELU.Vmin.V)) / w;
    // sections d'angle (nus et goussets des nœuds traverse – piédroit et radier – piédroit) : flexion simple, l'effort normal
    // transitant par le nœud n'étant pas mobilisable au nu (option, comme le programme de référence, manuel IV.6.1)
    const fs = d.fsAngles !== false && /^(trav-nu|trav-gou|pied-gouh|pied-haut|rad-nu|rad-gou)$/.test(sec.cle);
    const pm2 = (o) => { const x = pm(o); if (fs) x.N = 0; return x; };
    const elu = ['Mmax', 'Mmin', 'Nmax', 'Nmin'].map((k) => Object.assign(pm2(ev.ELU[k]), { V: VmaxELU, type: 1, src: k }));
    const els = [];
    for (const [et, ty] of [['CAR', 0], ['QP', 1], ['FREQ', 2]]) for (const k of ['Mmax', 'Mmin']) {
      const o = pm2(ev[et][k]); const q = pm(ev.QP[k]); els.push({ N: o.N, M: o.M, Mqp: q.M, type: ty, src: et + ' ' + k });
    }
    const out = { sec, h, b, w, dIn, dOut, elu, els, VmaxELU, fs };
    if (!SBA) { out.erreur = 'Moteur BA.sectionBA indisponible.'; return out; }
    const ex = EXPO[d.expo] || [0.3, 'QP'];
    const wmax = d.critere === 'wk' ? (d.wmax || ex[0]) : null;
    const wType = (d.wCombi || ex[1]) === 'FREQ' ? 2 : 1;
    const fiss = { sup: { c: cIn * 1000, phi: d.phiBar, s: d.espBar }, inf: { c: cOut * 1000, phi: d.phiBar, s: d.espBar } };
    const base = { forme: 'rect', regl: 'EC2', materiau: { fck: d.fck, fyk: d.fyk, classe: d.classe, phi: d.phiFluage },
      section: { b, h, nappes: [{ d: dIn, As: 0 }, { d: dOut, As: 0 }] }, elu, els,
      options: { element: d.tranchantDalle ? 'dalle' : 'poutre', wkCalcul: d.critere === 'wk', wmax: wmax || 0.3, wkType: wType, fissu: fiss, excAdd: false } };
    let r;
    try { r = SBA.calcul(Object.assign({}, base, { mode: 'dim' })); } catch (e) { out.erreur = e.message; return out; }
    let As = r.dim.As.slice();
    // ferraillage minimal de maîtrise de la fissuration (EN 1992-1-1 §7.3.2) sur chaque face susceptible d'être tendue
    const ft = fctm(d.fck), kh = h <= 0.3 ? 1 : h >= 0.8 ? 0.65 : 1 - 0.35 * (h - 0.3) / 0.5;
    const sigS = d.critere === 'contrainte' ? Math.min(d.fyk, d.sigLim) : Math.min(d.fyk, sigmaT72(d.phiBar, wmax || 0.3));
    const AminF = 0.4 * kh * ft * (b * h / 2) / sigS * 1e4;
    const tendSup = elu.some((c) => c.M > 0) || els.some((c) => c.M > 0), tendInf = elu.some((c) => c.M < 0) || els.some((c) => c.M < 0);
    const Amin = [tendSup ? AminF : 0, tendInf ? AminF : 0];
    As = As.map((a, i) => Math.max(a, Amin[i]));
    // critère de contrainte de l'acier (ELS caractéristique) : σs ≤ σs,lim
    const mat = r.mat;
    const geoA = (A) => SBA.rect({ b, h, nappes: [{ d: dIn, As: A[0] }, { d: dOut, As: A[1] }] });
    const nE = mat.Es / mat.Ecm;
    if (d.critere === 'contrainte') {
      for (const c of els.filter((x) => x.type === 0)) {
        const iT = c.M >= 0 ? 0 : 1;
        const n = SBA.nEff(mat, c.M, c.Mqp);
        const ok = (a) => { const A = As.slice(); A[iT] = a; const e = SBA.els(geoA(A), mat, { N: c.N, M: c.M, n }); return -e.ssMin <= d.sigLim + 1e-6; };
        if (!ok(As[iT])) { let lo = As[iT], hi = Math.max(1, As[iT]) * 2; let it = 0; while (!ok(hi) && it++ < 20) hi *= 2; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; } As[iT] = hi; }
      }
    }
    // vérification finale avec les aciers retenus
    let v;
    try { v = SBA.calcul(Object.assign({}, base, { mode: 'verif', section: { b, h, nappes: [{ d: dIn, As: As[0] }, { d: dOut, As: As[1] }] } })); } catch (e) { out.erreur = e.message; return out; }
    const pr = SBA.props(geoA(As), nE);
    const cis = v.cis[0] || null;
    out.As = As; out.AsDim = r.dim.As; out.Amin = Amin; out.AminF = AminF; out.sigS = sigS; out.wmax = wmax; out.wType = wType;
    out.eluR = v.elu; out.elsR = v.els; out.cis = cis; out.Asw = cis ? cis.Asw : 0;
    out.scMax = Math.max(0, ...v.els.map((e) => e.sc)); out.ssMax = Math.max(0, ...v.els.map((e) => -e.ssMin));
    out.wkMax = Math.max(0, ...v.els.map((e) => (e.wk ? e.wk.wk : 0)));
    out.Ibrut = b * h * h * h / 12; out.Ifiss = Math.max(pr.fp ? pr.fp.I : 0, 0) || out.Ibrut;
    // tolérance de 0,5 % sur le taux ELU (précision de la recherche par dichotomie du dimensionnement)
    out.okELU = v.elu.every((e) => e.ok || e.ratio <= 1.005); out.okELS = v.els.every((e) => e.ok); out.okV = v.cis.every((c) => c.ok);
    out.ok = out.okELU && out.okELS && out.okV;
    out.alertes = v.alertes.concat(r.alertes);
    return out;
  }

  /* ══════════════════ 10. Sol et fondations ══════════════════ */
  function solFondations(d, G, M, S, R, envelop, cof, alertes) {
    const res = { ressorts: [], fond: [] };
    // contraintes locales sous le radier / les semelles (appuis élastiques) ; cadre : + poids propre du radier
    const sup = G.cadre ? d.gBet * d.eprad : 0;
    R.ressorts.forEach((r, k) => {
      const t = S.iSol + k;
      const o = { x: r.x };
      for (const et of ['ELU', 'CAR', 'QP']) { const f = et === 'ELU' ? d.gGsup : 1; o[et] = { max: envelop(t, 1, et).v + f * sup, min: envelop(t, -1, et).v + (et === 'ELU' ? d.gGinf : 1) * sup }; }
      res.ressorts.push(o);
    });
    res.sigmaMax = { ELU: Math.max(...res.ressorts.map((o) => o.ELU.max)), CAR: Math.max(...res.ressorts.map((o) => o.CAR.max)), QP: Math.max(...res.ressorts.map((o) => o.QP.max)) };
    res.sigmaMin = { CAR: Math.min(...res.ressorts.map((o) => o.CAR.min)), ELU: Math.min(...res.ressorts.map((o) => o.ELU.min)) };
    if (res.ressorts.length && res.sigmaMin.CAR < -1e-6) alertes.push('Décollement local du radier ou des semelles sous combinaison caractéristique (réaction de traction des appuis élastiques).');
    // vérification globale (Fascicule 62 titre V) : torseur sur la fondation, q'ref = (3σmax + σmin)/4
    const fonds = S.fond;
    fonds.forEach((f, kf) => {
      const B = G.cadre ? (G.LarCal + G.eP) * G.sinB : G.larSem, L = G.cadre ? d.lonrad : d.lonpied;
      const Bm = G.cadre ? G.LarCal + G.eP : G.larSem / G.sinB;   // largeur dans le plan du modèle
      const iN = S.iFond + 3 * kf, lignes = [];
      for (const et of ['CAR', 'FREQ', 'ELU']) for (const [t, sg] of [[iN, 1], [iN, -1], [iN + 2, 1], [iN + 2, -1], [iN + 1, 1], [iN + 1, -1]]) {
        const c = envelop(t, sg, et); let N = c.c[0], H = c.c[1], Mo = c.c[2];
        if (G.cadre) N += (et === 'ELU' ? (sg > 0 ? d.gGsup : d.gGinf) : 1) * d.gBet * d.eprad * Bm * G.Brad;
        const W = G.tranche ? 1 : L;
        const e = N > 0 ? Mo / N : Infinity;
        let smax, smin, dec;
        if (N <= 0) { smax = NaN; smin = NaN; dec = 100; }
        else if (Math.abs(e) <= Bm / 6) { smax = N / (Bm * W) * (1 + 6 * Math.abs(e) / Bm); smin = N / (Bm * W) * (1 - 6 * Math.abs(e) / Bm); dec = 0; }
        else { const bc = 3 * (Bm / 2 - Math.abs(e)); smax = bc > 0 ? 2 * N / (bc * W) : Infinity; smin = 0; dec = 100 * (1 - Math.max(0, bc) / Bm); }
        const qref = (3 * smax + smin) / 4 / 1000;
        const delta = N > 0 ? Math.atan(Math.abs(H) / N) / DEG : 90;
        const DeB = d.De / Bm, ph1 = Math.pow(1 - Math.min(delta, 90) / 90, 2), ph2 = Math.pow(Math.max(0, 1 - delta / 45), 2);
        const id = d.frottant ? ph2 + (ph1 - ph2) * (1 - Math.exp(-DeB)) : ph1;            // Fasc. 62 titre V annexe F1
        const q0 = d.gTer * d.De / 1000;
        const qadm = d.qu > 0 ? q0 + (d.qu - q0) * id / (et === 'ELU' ? 2 : 3) : NaN;
        const mu = Math.tan(d.phiF * DEG) / 1.2;
        const Hres = N * mu + d.cohF * Bm * W * (1 - dec / 100) / 1.5;
        const decAdm = et === 'FREQ' ? 0 : et === 'CAR' ? 25 : 90;
        lignes.push({ et, cible: ['N max', 'N min', 'M max', 'M min', 'H max', 'H min'][lignes.length % 6], N, H, M: Mo, e, smax, smin, dec, decAdm, qref, delta, id, qadm, Hres,
          okP: !(d.qu > 0) || qref <= qadm + 1e-9, okD: dec <= decAdm + 1e-6, okG: et !== 'ELU' || Math.abs(H) <= Hres + 1e-6 });
      }
      res.fond.push({ nom: f.nom, B: Bm, L: G.tranche ? 1 : L, lignes, ok: lignes.every((l) => l.okP && l.okD && l.okG) });
    });
    return res;
  }

  /* ══════════════════ 11. Lecture d'un fichier .don d'origine ══════════════════ */
  function lireDon(txt) {
    const lines = String(txt).replace(/\r/g, '').split('\n'), v = {};
    for (let i = 0; i < lines.length - 1; i++) {
      const l = lines[i]; if (/^\s*;/.test(l) || !l.trim()) continue;
      if (/^(FIN_DICO)/.test(l.trim())) break;
      const key = l.split(/[\s;]/)[0]; if (!key || key === 'FIN') continue;
      const nxt = lines[i + 1]; if (nxt !== undefined && !/^\s*;/.test(nxt)) { if (v[key] === undefined) v[key] = nxt.trim(); i++; }
    }
    const n = (k, def) => { const x = parseFloat(String(v[k] ?? '').replace(',', '.')); return Number.isFinite(x) ? x : def; };
    const cadre = /RACBA/.test(v.application || '') ? n('typstruct', 1) === 1 : false;
    const d = defauts(cadre ? 'cadre' : 'portique');
    const set = (k, key, f = (x) => x) => { const x = n(key, NaN); if (Number.isFinite(x)) d[k] = f(x); };
    [['biais', 'biais'], ['nbvoi', 'nbvoi'], ['vmax', 'vmax'], ['eprem', 'eprem'], ['epbal', 'epbal'], ['hautraverse', 'hautraverse'], ['axevoi1', 'axevoi1'], ['axevoi2', 'axevoi2'],
      ['lontottab', 'lontottab'], ['lonpied', 'lonpied'], ['lonrad', 'lonrad'], ['ouv', 'ouvdroi'], ['hauint', 'hauint'], ['eptra', 'eptra'], ['eppied', 'eppied'],
      ['haugousup', 'haugousup'], ['longousup', 'longousup'], ['hausem', 'hausem'], ['larpat', 'larpat'], ['lartal', 'lartal'], ['hauterint', 'hauterint'],
      ['phi', 'angfrot'], ['dphi', 'varangfrot'], ['cCou', 'enrcofcou'], ['cOuv', 'enrcofouv'], ['cRad', 'enrcofrad'], ['dAxe', 'disaxacenr'], ['fck', 'fc28'], ['fyk', 'fe'],
      ['gTer', 'poivolter'], ['gTerSat', 'poivoltersat'], ['rapSol', 'rapmodsol'], ['gBet', 'poivolbet'], ['gBal', 'poivolbal'], ['gEtan', 'poivoletan'], ['epetan', 'epetan'],
      ['poicor', 'poicor'], ['freinSW2', 'freinsw2'], ['ksol', 'ksol'], ['qu', 'qu'], ['De', 'de'], ['phiF', 'phifond'], ['cohF', 'cohesionfond'], ['alpha', 'alphalm71sw0'],
      ['alphaSW2', 'alphasw2'], ['bv', 'accelvertconfvoy'], ['sigLim', 'limitefissur'], ['phiFluage', 'coeffluage'],
      ['Pav', 'chgessav'], ['Par', 'chgessar'], ['voieAv', 'voiessav'], ['voieAr', 'voiessar'], ['empat', 'empatess'], ['aImp', 'lonimpactav'], ['bImp', 'larimpactav']].forEach(([k, key]) => set(k, key));
    if (cadre) { set('eprad', 'eprad'); set('haugouinf', 'haugouinf'); set('longouinf', 'longouinf'); set('charexpint', 'charexpint'); }
    else { d.fond = ['superficielle', 'superficielle', 'ressorts', 'ressorts'][n('typfond', 0)] || 'superficielle';
      set('epsRet', 'kdefret'); set('dilLD', 'kdefdilatld'); set('dilCD', 'kdefdilatcd'); set('conLD', 'kdefcontld'); set('conCD', 'kdefcontcd'); }
    if (n('entretien', 1) === 0) d.entretien = 'courant';
    const sel = n('selectionconvois', 7); d.LM71 = !!(sel & 1); d.SW0 = !!(sel & 2); d.SW2 = !!(sel & 4);
    if (cadre) { const zw = n('zeau', 0), zb = n('zbassem', 0); d.hw = zw > 0 && zw > zb ? zw - zb : 0; }
    if (n('typfiss', 1) === 0) d.critere = 'wk';
    if (n('typcal', 0) === 1) d.engin = true;
    d.nbvoi = d.nbvoi >= 2 ? 2 : 1;
    d.projet = v.projet || ''; d.source = 'fichier .don';
    return { d, brut: v };
  }

  const api = { defauts, calcul, lireDon, geometrie, coefTrafic, enveloppesConvois, ka, k0, Ecm, kdFrein, sigmaT72, gousset, EXPO };
  if (NODE) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.cadres = api; }
})(typeof window !== 'undefined' ? window : globalThis);
