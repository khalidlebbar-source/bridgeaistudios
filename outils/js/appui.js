/* APPUI — piles, palées et culées de ponts-routes et ponts-rails : actions propres de l'appui, combinaisons,
 * stabilité des fondations, efforts et aciers dans les fûts, le chevêtre, la semelle, le mur garde-grève et les murs en retour.
 * Moteur pur (aucun DOM) : module.exports pour node, window.BA.appui dans le navigateur.
 *
 * Réutilise : BA.portique (portique transversal fûts + chevêtre), BA.sectionBA (aciers, BAEL 91 mod. 99 / EN 1992),
 * BA.fondatio (fondations Fasc. 62 titre V sur sondage pressiométrique : semelles, massifs, groupes de pieux),
 * BA.modelpra (spectre EN 1998-1 + AN française pour le séisme).
 *
 * Repère de l'appui : origine au milieu de la sous-face de la semelle ; X horizontal perpendiculaire à la file d'appuis,
 * positif vers l'ouvrage (vers l'avant pour une culée) ; Y le long de la file ; Z vertical ascendant.
 * Actions : torseur [Fx, Fy, Fz, Mx, My, Mz] (kN, kN·m) appliqué au point (x, y, z) ; Fz < 0 = charge descendante
 * (convention des fichiers d'origine). Transport d'un torseur : Mx += Δy·Fz − Δz·Fy ; My += Δz·Fx − Δx·Fz.
 * Unités : kN, m, kPa ; MPa pour les matériaux et les contraintes du sol de fondation.
 *
 * Références (articles cités au fil du code) :
 *  - EN 1990 + A2 et AN française (combinaisons 6.10, 6.11b, 6.12b, 6.14b à 6.16b ; tableaux A2.1, A2.3, A2.4(B)) ;
 *  - EN 1991-2 §4.9 (charges sur remblais), EN 1991-1-7 §4.3 (chocs de véhicules sur appuis) ;
 *  - EN 1998-1 §3.2.2 + AN (spectre), EN 1998-2 §4.2.1.4 (combinaison des directions 100 % / 30 %), §6.7.3 (culées),
 *    EN 1998-5 §7.3.2 et annexe E (Mononobe-Okabe, kh = α·S/r, kv = ±0,33 ou ±0,5 kh) ;
 *  - EN 1992-1-1 / EN 1992-2 (aciers, §6.7 pressions localisées) ;
 *  - ancien référentiel : Fascicule 61 titre II et BAEL 91 mod. 99 (ponts-routes), Livret 2.01 chap. 2A (ponts-rails et
 *    ouvrages du patrimoine ferroviaire : fsu = 0,8 fe/γs à l'ELU fondamental), Fascicule 62 titre V (fondations) ;
 *  - dossier pilote SETRA PP 73 « Piles et palées » : poussée sur les poteaux de culées enterrées (largeur fictive 3 D),
 *    bras de levier réduit par la butée en pied (hauteur « Dz butée » = épaisseur de semelle + h poteaux / 2) ;
 *  - BAEL 91 A.8.4 et annexe E.8 : frettage sous appareils d'appui, éclatement, équilibre du coin.
 */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const get = (file, name) => { try { return isNode ? require('./' + file) : (root.BA && root.BA[name]); } catch (e) { return null; } };
  const PQ = get('portique.js', 'portique'), SBA = get('bael-ec2.js', 'sectionBA'), FD = get('fondatio.js', 'fondatio'), MP = get('modelpra.js', 'modelpra');
  const RAD = Math.PI / 180, GR = Math.PI / 200, G_ACC = 9.81;
  const sq = (x) => x * x, clamp = (v, a, b) => Math.min(b, Math.max(a, v)), num = (v, d = 0) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : d);

  /* ══════════════════════ poussée des terres ══════════════════════
   * Coefficient de poussée (Coulomb, parement vertical ψ = 90°, terre-plein incliné β, obliquité δ) et coefficient
   * dynamique de Mononobe-Okabe (EN 1998-5 annexe E, éq. E.2 avec ψ = 90°) : θ = 0 redonne le coefficient statique ;
   * β = δ = 0 redonne Rankine Ka = tan²(π/4 − φ/2). Composante horizontale : K·cos δ. */
  function kAE(phiDeg, deltaDeg = 0, betaDeg = 0, theta = 0) {
    const f = phiDeg * RAD, d = deltaDeg * RAD, b = betaDeg * RAD;
    const num_ = sq(Math.cos(f - theta));
    let den = Math.cos(theta) * Math.cos(theta + d);
    if (b <= f - theta) den *= sq(1 + Math.sqrt(Math.sin(f + d) * Math.sin(f - b - theta) / (Math.cos(theta + d) * Math.cos(b))));
    return num_ / den * Math.cos(d);
  }
  const ka = (phi, delta = 0, beta = 0) => kAE(phi, delta, beta, 0);
  /* EN 1998-5 §7.3.2.2 et annexe E : poussée totale (statique + dynamique) Ed = ½ γ (1 ± kv) K H², valeur la plus forte */
  function mononobe(phi, delta, kh, kv) {
    const r = [1, -1].map((s) => { const th = Math.atan(kh / (1 - s * kv)); return { s, theta: th, K: kAE(phi, delta, 0, th), f: (1 - s * kv) * kAE(phi, delta, 0, th) }; });
    const w = r[0].f >= r[1].f ? r[0] : r[1];
    return { K: w.K, theta: w.theta, kvSigne: -w.s * kv, Ktot: w.f, dK: w.f - ka(phi, delta) };
  }

  /* ══════════════════════ jeux de données ══════════════════════ */
  /* actions du tablier (repère de l'appui, au niveau des appareils) : {nom, cat, qt, etatG, V, HX, HY, MX, MY, dy, dx, cd}
   *  cat : Gmax | Gmin | GD (permanente dalle de transition) | R (retrait) | Q (trafic, qt = A, B, M, E (route) ou rail, sw2)
   *        | QT (trottoirs, accotements) | QD (dalle de transition) | F (freinage-démarrage, qt = groupe associé ou '*')
   *        | Td, Tc (dilatation, contraction) | W (vent) | EX, EY (séisme longitudinal, transversal) | AD (accidentel)
   *  etatG : 'max' (avec Gmax seulement), 'min' (avec Gmin seulement) ou '' (les deux) ; cd : part de courte durée (0 à 1). */
  function exemple(nom = 'culee') {
    const base = {
      projet: '', regl: 'ANC', ouvrage: 'route', nVoies: 1, livret: true, partCDT: 10 / 35,
      type: 'culee', biais: 100,
      geo: {
        zBase: 45, ep: 0.7, B: 2.1, L: 7.7, talon: 0.7, exF: 0,
        fut: { forme: 'rond', n: 3, D: 0.7, b: 0.7, e: 0.7, entraxe: 2.77, h: 7.781 },
        chev: { actif: true, L: 8.43, l: 1.25, h: 1.0, xArr: 0.75, hpm: 0.256, lpm: 0.15 },
        gg: { h: 0, e: 0, L: 0 }, retour: { actif: false, Lr: 0, Hr: 0, e: 0.3 },
        app: { n: 3, e: 2.77, xApp: 0.2, a0: 0.2, b0: 0.3, a: 0.3, b: 0.41, hb: 0.17, hApp: 0 },
        zdef: 55.38, zAvant: 53.634, ztn: 49, zeau: -1000,
      },
      sol: { gamma: 20, gammaSat: 22, phi: 35, delta: 0, beta: 0, qRoute: 10, qRail: 150, largRail: 3, butee: true, kf3D: 3 },
      mat: { gammaB: 25, fck: 32, fe: 500, fiss: 1, cSem: 0.06, cFut: 0.06, cChev: 0.05, ssFut: 240, ssSem: 0, kf: 1 },
      fond: { type: 'sup', mode: 'saisie', qu: 1.0, De: 0, kv: 10, rapSol: 2, phi: 35.75, c: 0, sol: 'frottant', massif: { B: 0, L: 0, h: 0 },
        pieux: { type: 2, D: 1.0, Lp: 12, nFiles: 2, nParFile: 3, eFile: 3, ePieu: 3, enrob: 0.09 } },
      sismique: { actif: false, zone: 3, sol: 'B', classe: 'II', r: 1, khAppui: 0 },
      choc: { actif: false, Fdx: 1000, Fdy: 500, h: 1.25 }, vent: { q: 0 },
      actions: [
        { nom: 'C.P. tablier maxi', cat: 'Gmax', V: -675.3, dy: 0.007 },
        { nom: 'C.P. tablier mini', cat: 'Gmin', V: -610.8, dy: 0.005 },
        { nom: 'Retrait', cat: 'R', HX: 4.7 },
        { nom: 'A(l) maxi', cat: 'Q', qt: 'A', etatG: 'max', V: -481.4, dy: 0.02 },
        { nom: 'A(l) mini', cat: 'Q', qt: 'A', etatG: 'min', V: 88.9, dy: 0.02 },
        { nom: 'Freinage A(l)', cat: 'F', qt: 'A', HX: 6.8 },
        { nom: 'Bc maxi', cat: 'Q', qt: 'B', etatG: 'max', V: -509.4, dy: 0.02 },
        { nom: 'Bc mini', cat: 'Q', qt: 'B', etatG: 'min', V: 63.5, dy: 0.02 },
        { nom: 'Freinage Bc', cat: 'F', qt: 'B', HX: 22.2 },
        { nom: 'Mc 120 maxi', cat: 'Q', qt: 'M', etatG: 'max', V: -540.2, dy: 0.655 },
        { nom: 'Mc 120 mini', cat: 'Q', qt: 'M', etatG: 'min', V: 80.1, dy: 0.655 },
        { nom: 'Convoi C maxi', cat: 'Q', qt: 'E', etatG: 'max', V: -524.3, dy: 0.88 },
        { nom: 'Convoi C mini', cat: 'Q', qt: 'E', etatG: 'min', V: 93.6, dy: 0.88 },
        { nom: 'Convoi D/E maxi', cat: 'Q', qt: 'E', etatG: 'max', V: -728.1, dy: -0.095 },
        { nom: 'Convoi D/E mini', cat: 'Q', qt: 'E', etatG: 'min', V: 144.0, dy: -0.095 },
        { nom: 'Trottoir gauche maxi', cat: 'QT', etatG: 'max', V: -9.2, dy: -3.08 },
        { nom: 'Trottoir droit maxi', cat: 'QT', etatG: 'max', V: -9.2, dy: 3.08 },
        { nom: 'Trottoir gauche mini', cat: 'QT', etatG: 'min', V: 1.8, dy: -3.08 },
        { nom: 'Trottoir droit mini', cat: 'QT', etatG: 'min', V: 1.8, dy: 3.08 },
        { nom: 'Surcharge dalle de transition', cat: 'QD', V: 470.9, dy: 0.02, dx: -0.95 },
        { nom: 'Dilatation', cat: 'Td', HX: -8.4 },
        { nom: 'Contraction', cat: 'Tc', HX: 8.4 },
      ],
    };
    if (nom === 'culee') { base.projet = 'Culée C0 de pont-route sur semelle (exemple ProC0Sup)'; base.biais = 90.61; return base; }
    if (nom === 'pile') {
      return Object.assign(base, {
        projet: 'Pile P1 de pont-route à deux voiles sur semelle (exemple ProP1Sup)', type: 'pile', biais: 109.39,
        geo: { zBase: 45, ep: 0.7, B: 2.1, L: 8.6, talon: 0, exF: 0, fut: { forme: 'rect', n: 2, D: 0.7, b: 2.5, e: 0.7, entraxe: 4.34, h: 9.0 },
          chev: { actif: false, L: 0, l: 0, h: 0, xArr: 0, hpm: 0, lpm: 0 }, gg: { h: 0, e: 0, L: 0 }, retour: { actif: false, Lr: 0, Hr: 0, e: 0.3 },
          app: { n: 4, e: 1.75, xApp: 0, a0: 0.3, b0: 0.45, a: 0.41, b: 0.6, hb: 0.031, hApp: 0.039 }, zdef: 48.465, zAvant: 48.465, ztn: 49, zeau: -1000 },
        mat: Object.assign({}, base.mat, { cFut: 0.075, ssFut: 250, kf: 1 }),
        fond: Object.assign({}, base.fond, { qu: 1.832, De: 2.04, kv: 38.75 }),
        actions: [
          { nom: 'C.P. tablier maxi', cat: 'Gmax', V: -2209.3, dy: 0.007 }, { nom: 'C.P. tablier mini', cat: 'Gmin', V: -1998.4, dy: 0.005 },
          { nom: 'Retrait', cat: 'R', HX: 11.9 },
          { nom: 'A(l) maxi', cat: 'Q', qt: 'A', etatG: 'max', V: -934.7, dy: 0.02 }, { nom: 'A(l) mini', cat: 'Q', qt: 'A', etatG: 'min', V: 74.2, dy: 0.02 },
          { nom: 'Freinage A(l)', cat: 'F', qt: 'A', HX: 39.9 },
          { nom: 'Bc maxi', cat: 'Q', qt: 'B', etatG: 'max', V: -820.5, dy: 0.02 }, { nom: 'Bc mini', cat: 'Q', qt: 'B', etatG: 'min', V: 65.0, dy: 0.02 },
          { nom: 'Freinage Bc', cat: 'F', qt: 'B', HX: 129.9 },
          { nom: 'Mc 120 maxi', cat: 'Q', qt: 'M', etatG: 'max', V: -691.0, dy: 0.655 }, { nom: 'Mc 120 mini', cat: 'Q', qt: 'M', etatG: 'min', V: 72.9, dy: 0.655 },
          { nom: 'Convoi C maxi', cat: 'Q', qt: 'E', etatG: 'max', V: -988.7, dy: 0.88 }, { nom: 'Convoi C mini', cat: 'Q', qt: 'E', etatG: 'min', V: 77.4, dy: 0.88 },
          { nom: 'Convoi D/E maxi', cat: 'Q', qt: 'E', etatG: 'max', V: -1891.5, dy: -0.095 }, { nom: 'Convoi D/E mini', cat: 'Q', qt: 'E', etatG: 'min', V: 109.8, dy: -0.095 },
          { nom: 'Trottoir gauche maxi', cat: 'QT', etatG: 'max', V: -25.6, dy: -3.08 }, { nom: 'Trottoir droit maxi', cat: 'QT', etatG: 'max', V: -25.6, dy: 3.08 },
          { nom: 'Trottoir gauche mini', cat: 'QT', etatG: 'min', V: 1.4, dy: -3.08 }, { nom: 'Trottoir droit mini', cat: 'QT', etatG: 'min', V: 1.4, dy: 3.08 },
          { nom: 'Dilatation', cat: 'Td', HX: -19.9 }, { nom: 'Contraction', cat: 'Tc', HX: 19.9 },
        ],
      });
    }
    // pile de pont-rail, Eurocodes, deux poteaux ronds et chevêtre, séisme et choc
    return Object.assign(base, {
      projet: 'Pile de pont-rail 2 voies (Eurocodes)', regl: 'EC', ouvrage: 'rail', nVoies: 2, livret: false, type: 'pile', biais: 100,
      geo: { zBase: 0, ep: 1.2, B: 4.0, L: 9.0, talon: 0, exF: 0, fut: { forme: 'rond', n: 2, D: 1.4, b: 1.4, e: 1.4, entraxe: 5.0, h: 6.0 },
        chev: { actif: true, L: 9.0, l: 2.0, h: 1.4, xArr: 1.0, hpm: 0, lpm: 0 }, gg: { h: 0, e: 0, L: 0 }, retour: { actif: false, Lr: 0, Hr: 0, e: 0.3 },
        app: { n: 4, e: 2.4, xApp: 0, a0: 0.5, b0: 0.6, a: 0.8, b: 0.9, hb: 0.15, hApp: 0.1 }, zdef: 1.5, zAvant: 1.5, ztn: 1.5, zeau: -1000 },
      mat: Object.assign({}, base.mat, { fck: 35, cFut: 0.06, ssFut: 0, kf: 2 }),
      fond: Object.assign({}, base.fond, { qu: 1.5, De: 1.5, kv: 30 }),
      sismique: { actif: true, zone: 3, sol: 'B', classe: 'II', r: 1, khAppui: 0 },
      choc: { actif: true, Fdx: 1000, Fdy: 500, h: 1.25 }, vent: { q: 1.5 },
      actions: [
        { nom: 'G tablier maxi', cat: 'Gmax', V: -3600 }, { nom: 'G tablier mini', cat: 'Gmin', V: -3250 },
        { nom: 'Retrait', cat: 'R', HX: 20 },
        { nom: 'gr11 LM71+SW/0 maxi', cat: 'Q', qt: 'rail', etatG: 'max', V: -2900, dy: 0.9 },
        { nom: 'gr11 LM71+SW/0 mini', cat: 'Q', qt: 'rail', etatG: 'min', V: 150, dy: 0.9 },
        { nom: 'gr16 SW/2', cat: 'Q', qt: 'sw2', etatG: 'max', V: -2300, dy: 0.9 },
        { nom: 'Freinage-démarrage', cat: 'F', qt: '*', HX: 450 },
        { nom: 'Dilatation', cat: 'Td', HX: -60 }, { nom: 'Contraction', cat: 'Tc', HX: 60 },
        { nom: 'Vent sur tablier', cat: 'W', HY: 180, MX: 0 },
        { nom: 'Séisme longitudinal (tablier)', cat: 'EX', HX: 900 }, { nom: 'Séisme transversal (tablier)', cat: 'EY', HY: 1100 },
      ],
    });
  }

  /* ══════════════════════ géométrie dérivée ══════════════════════ */
  function geometrie(d) {
    const g = d.geo, f = g.fut, ch = g.chev || {}, ap = g.app || {};
    const type = d.type, nF = Math.max(0, Math.round(num(f.n, 1)));
    const zTS = g.zBase + g.ep;                                 // dessus de semelle
    const dimX = f.forme === 'rond' ? f.D : f.e, dimY = f.forme === 'rond' ? f.D : f.b;
    // axe des fûts : centré (pile) ou à talon + épaisseur/2 du bord arrière (culée)
    const xF = type === 'pile' ? num(g.exF) : -g.B / 2 + num(g.talon) + dimX / 2 + num(g.exF);
    const hF = nF ? num(f.h) : 0, zTF = zTS + hF;               // sommet des fûts = dessous du chevêtre
    const chev = ch.actif ? { L: ch.L, l: ch.l, h: ch.h, x0: xF - ch.xArr, x1: xF - ch.xArr + ch.l, z0: zTF, z1: zTF + ch.h, hpm: num(ch.hpm), lpm: num(ch.lpm) } : null;
    const zTop = chev ? chev.z1 : zTF;                          // sommet de la structure porteuse (sous bossages)
    const zApp = zTop + num(ap.hb) + num(ap.hApp) / 2;          // niveau d'application des actions du tablier
    const xApp = xF + num(ap.xApp);
    const yF = []; for (let i = 0; i < nF; i++) yF.push((i - (nF - 1) / 2) * num(f.entraxe));
    // aire et inerties d'un fût (section supposée constante) ; oblong : rectangle b × e à extrémités demi-circulaires
    const Af = f.forme === 'rond' ? Math.PI * f.D * f.D / 4 : f.forme === 'oblong' ? f.b * f.e - (4 - Math.PI) / 4 * f.e * f.e : f.b * f.e;
    const IxF = f.forme === 'rond' ? Math.PI * Math.pow(f.D, 4) / 64 : f.e * Math.pow(f.b, 3) / 12;   // flexion dans le plan YZ
    const IyF = f.forme === 'rond' ? IxF : f.b * Math.pow(f.e, 3) / 12;                                // flexion dans le plan XZ
    // appareils d'appui : centrés sur le chevêtre, sinon répartis par fût
    const nA = Math.max(1, Math.round(num(ap.n, 1))), yA = [];
    if (chev || nF <= 1) for (let k = 0; k < nA; k++) yA.push((k - (nA - 1) / 2) * num(ap.e));
    else { const per = Math.max(1, Math.round(nA / nF)); yF.forEach((y) => { for (let k = 0; k < per; k++) yA.push(y + (k - (per - 1) / 2) * num(ap.e)); }); }
    const futA = yA.map((y) => yF.length ? yF.reduce((b, yy, i) => (Math.abs(yy - y) < Math.abs(yF[b] - y) ? i : b), 0) : -1);
    // écran arrière (culées) : chevêtre + petite murette + mur garde-grève, au dos du chevêtre ou du mur
    const xBack = type === 'pile' ? null : chev ? chev.x0 : xF - dimX / 2;
    // hauteur « Dz butée » (PP 73) : épaisseur de semelle + demi-hauteur des poteaux
    const Dz = g.ep + hF / 2;
    return { nF, zTS, xF, hF, zTF, chev, zTop, zApp, xApp, yF, Af, IxF, IyF, dimX, dimY, yA, nA: yA.length, futA, xBack, Dz };
  }

  /* ══════════════════════ actions propres de l'appui ══════════════════════ */
  const A6 = () => [0, 0, 0, 0, 0, 0];
  function act(o) { return Object.assign({ F: A6(), P: [0, 0, 0], cd: 0, cible: 'sem', etatG: '' }, o); }

  /* poids volumiques effectifs sous la nappe (déjaugeage) : béton γb − 10, terres γsat − 10 */
  const wCol = (z0, z1, zeau, g, gw) => { if (z1 <= z0) return 0; const a = Math.max(z0, Math.min(z1, zeau)); return (a - z0) * gw + (z1 - a) * g; };

  function actionsPropres(d, G) {
    const g = d.geo, s = d.sol, m = d.mat, out = [], gb = m.gammaB, zeau = num(g.zeau, -1e9);
    const W = (z0, z1) => wCol(z0, z1, zeau, gb, gb - 10);           // poids d'une colonne de béton par m²
    const ppA = (nom, V, x, y, z, extra) => { const a = act(Object.assign({ id: 'pp' + out.length, nom, cat: 'PP', F: [0, 0, -V, 0, 0, 0], P: [x, y, z] }, extra)); out.push(a); return a; };
    // semelle
    ppA('Poids propre semelle', g.B * g.L * W(g.zBase, G.zTS), 0, 0, g.zBase + g.ep / 2, { cible: 'sem', el: 'sem' });
    // fûts (élément propre : poids réparti, porté par le fût lui-même)
    G.yF.forEach((y, i) => ppA('Poids propre fût ' + (i + 1), G.Af * W(G.zTS, G.zTF), G.xF, y, (G.zTS + G.zTF) / 2, { cible: 'futpp', fut: i, el: 'fut' }));
    // chevêtre, petite murette, garde-grève, murs en retour (portés par le chevêtre)
    const C = G.chev;
    if (C) {
      ppA('Poids propre chevêtre', C.L * C.l * W(C.z0, C.z1), (C.x0 + C.x1) / 2, 0, (C.z0 + C.z1) / 2, { cible: 'chev', el: 'chev' });
      if (C.hpm > 0 && C.lpm > 0) ppA('Petite murette du sommier', C.L * C.lpm * C.hpm * gb, C.x0 + C.lpm / 2, 0, C.z1 + C.hpm / 2, { cible: 'chev', el: 'chev' });
    }
    if (g.gg && g.gg.h > 0 && g.gg.e > 0) {
      const x0 = G.xBack !== null ? G.xBack : G.xF;
      ppA('Mur garde-grève', (g.gg.L || (C ? C.L : g.L)) * g.gg.e * g.gg.h * gb, x0 + g.gg.e / 2, 0, G.zTop + g.gg.h / 2, { cible: C ? 'chev' : 'tete', el: 'gg' });
    }
    if (g.retour && g.retour.actif && g.retour.Lr > 0) {
      const r = g.retour, x0 = G.xBack !== null ? G.xBack : G.xF, Lc = C ? C.L : g.L;
      const zt = G.zTop + num(g.gg && g.gg.h);
      [-1, 1].forEach((sg) => ppA('Mur en retour ' + (sg < 0 ? 'gauche' : 'droit'), r.Lr * r.e * r.Hr * gb, x0 - r.Lr / 2, sg * (Lc / 2 - r.e / 2), zt - r.Hr / 2, { cible: C ? 'chev' : 'tete', el: 'retour' }));
    }
    // poids des terres sur la semelle (bandes en X) : arrière jusqu'au remblai, avant jusqu'au terrain avant,
    // sous le chevêtre jusqu'à sa sous-face ; volume des fûts déduit ; déjaugeage sous la nappe
    {
      const gt = s.gamma, gw = s.gammaSat - 10, n = 400, dx = g.B / n;
      const topAt = (x) => {
        if (d.type === 'pile') return g.zdef;
        if (x < G.xBack) return g.zdef;
        let t = num(g.zAvant, g.zdef);
        if (C && x <= C.x1) t = Math.min(t, C.z0);
        return t;
      };
      let V = 0, Mx = 0;
      for (let k = 0; k < n; k++) {
        const x = -g.B / 2 + (k + 0.5) * dx, w = wCol(G.zTS, topAt(x), zeau, gt, gw) * g.L * dx;
        V += w; Mx += w * x;
      }
      const tF = Math.min(topAt(G.xF), G.zTF), wF = G.nF * G.Af * wCol(G.zTS, tF, zeau, gt, gw);
      V -= wF; Mx -= wF * G.xF;
      if (V > 0) out.push(act({ id: 'terres', nom: 'Poids des terres sur la semelle', cat: 'GT', F: [0, 0, -V, 0, 0, 0], P: [Mx / V, 0, (G.zTS + g.zdef) / 2], cible: 'sem' }));
    }
    // poussées (culées)
    if (d.type !== 'pile') out.push(...poussees(d, G));
    // vent sur les fûts (transversal Y) : pression × largeur vue × hauteur exposée au-dessus du terrain
    if (d.vent && d.vent.q > 0 && G.nF) {
      const zt0 = Math.max(G.zTS, d.type === 'pile' ? g.zdef : num(g.zAvant, g.zdef)), h = Math.max(0, G.zTF - zt0);
      G.yF.forEach((y, i) => { if (h > 0) out.push(act({ id: 'vf' + i, nom: 'Vent sur fût ' + (i + 1), cat: 'W', F: [0, d.vent.q * G.dimX * h, 0, 0, 0, 0], P: [G.xF, y, zt0 + h / 2], cd: 1, cible: 'futdist', fut: i, z0: zt0, z1: G.zTF })); });
    }
    // choc de véhicule ou de bateau sur un fût (EN 1991-1-7 §4.3.1 : Fdx et Fdy non simultanés), fût d'extrémité
    if (d.choc && d.choc.actif && G.nF) {
      const z = G.zTS + Math.max(0, (d.type === 'pile' ? g.zdef : num(g.zAvant, g.zdef)) - G.zTS) + num(d.choc.h, 1.25);
      const i = 0, y = G.yF[i];
      if (d.choc.Fdx > 0) out.push(act({ id: 'chocx', nom: 'Choc Fdx sur fût 1', cat: 'AD', F: [d.choc.Fdx, 0, 0, 0, 0, 0], P: [G.xF, y, z], cd: 1, cible: 'futpt', fut: i }));
      if (d.choc.Fdy > 0) out.push(act({ id: 'chocy', nom: 'Choc Fdy sur fût 1', cat: 'AD', F: [0, d.choc.Fdy, 0, 0, 0, 0], P: [G.xF, y, z], cd: 1, cible: 'futpt', fut: i }));
    }
    // séisme : forces d'inertie des éléments de l'appui (kh·W), poussée dynamique des terres (Mononobe-Okabe)
    if (d.sismique && d.sismique.actif) out.push(...sismeAppui(d, G, out));
    return out;
  }

  /* zones soumises à la poussée : [{nom, z0, z1, L, cible, fut?}] */
  function zonesPoussee(d, G) {
    const g = d.geo, Z = [], C = G.chev;
    const zr = g.zdef;
    const add = (nom, z0, z1, L, cible, extra) => { const a = Math.max(z0, -1e9), b = Math.min(z1, zr); if (b > a + 1e-6 && L > 0) Z.push(Object.assign({ nom, z0: a, z1: b, L, cible }, extra)); };
    const hgg = num(g.gg && g.gg.h);
    if (d.type === 'culee') {
      if (C) add('chevêtre et petite murette', C.z0, C.z1 + C.hpm, C.L, 'ecran');
      if (hgg > 0) add('mur garde-grève', G.zTop + (C ? C.hpm : 0), G.zTop + hgg, num(g.gg.L, C ? C.L : g.L), 'ecran');
    } else if (d.type === 'mur') {
      if (C) add('chevêtre', C.z0, C.z1 + C.hpm, C.L, 'ecran');
      if (hgg > 0) add('mur garde-grève', G.zTop, G.zTop + hgg, num(g.gg.L, g.L), 'ecran');
      G.yF.forEach((y, i) => add('mur de front ' + (i + 1), G.zTS, G.zTF, G.dimY, 'fut', { fut: i, lineaire: true }));
      add('semelle (tranche arrière)', g.zBase, G.zTS, g.L, 'sem');
    }
    return Z;
  }
  /* charge sur remblai équivalente (kPa) et largeur chargée : route q uniforme ; rail Q (kN/ml/voie) sur 3 m par voie */
  function surchargeRemblai(d, L) {
    if (d.ouvrage === 'rail') { const lr = num(d.sol.largRail, 3), w = Math.min(L, lr * Math.max(1, d.nVoies)); return { q: num(d.sol.qRail) / lr, w }; }
    return { q: num(d.sol.qRoute), w: L };
  }
  function poussees(d, G) {
    const s = d.sol, out = [], K = ka(s.phi, s.delta, s.beta), zr = d.geo.zdef;
    for (const z of zonesPoussee(d, G)) {
      // terres : trapèze de Ka·γ·(zr − z) ; résultante et centre de poussée
      const a = K * s.gamma * (zr - z.z1), b = K * s.gamma * (zr - z.z0), h = z.z1 - z.z0;
      const Ht = (a + b) / 2 * h * z.L, zt = z.z0 + h * (2 * a + b) / (3 * (a + b || 1));
      const sr = surchargeRemblai(d, z.L), Hq = K * sr.q * h * sr.w, zq = z.z0 + h / 2;
      const x = z.cible === 'fut' ? G.xF - G.dimX / 2 : G.xBack;
      const ex = z.cible === 'fut' ? { fut: z.fut, lin: { a, b, q: K * sr.q, z0: z.z0, z1: z.z1, L: z.L, w: sr.w } } : {};
      if (Ht > 0) out.push(act(Object.assign({ id: 'pt-' + z.nom, nom: 'Poussée des terres — ' + z.nom, cat: 'PT', F: [Ht, 0, 0, 0, 0, 0], P: [x, 0, zt], cible: z.cible === 'fut' ? 'futdist' : z.cible, z0: z.z0, z1: z.z1 }, ex)));
      if (Hq > 0) out.push(act(Object.assign({ id: 'pq-' + z.nom, nom: 'Poussée de la surcharge sur remblai — ' + z.nom, cat: 'PQ', F: [Hq, 0, 0, 0, 0, 0], P: [x, 0, zq], cd: 1, cible: z.cible === 'fut' ? 'futdist' : z.cible, z0: z.z0, z1: z.z1 }, ex)));
    }
    // culée enterrée : poussée sur les poteaux (PP 73) — pression uniforme Ka(γ·h au-dessus des poteaux + q) sur une
    // largeur fictive min(3 D ; entraxe) par poteau ; équilibrée par la butée en pied pour la stabilité si l'option est retenue
    if (d.type === 'culee' && G.nF && G.zTF < zr) {
      const bP = Math.min(num(s.kf3D, 3) * G.dimY, G.nF > 1 ? Math.abs(G.yF[1] - G.yF[0]) : Infinity);
      const hov = zr - G.zTF, sr = surchargeRemblai(d, bP * G.nF), qeq = sr.q * Math.min(1, sr.w / (bP * G.nF));
      G.yF.forEach((y, i) => {
        const pt = K * s.gamma * hov, pq = K * qeq, h = G.hF;
        const lin = { a: pt, b: pt, q: pq, z0: G.zTS, z1: G.zTF, L: bP, w: bP };
        out.push(act({ id: 'ptp' + i, nom: 'Poussée des terres sur poteau ' + (i + 1), cat: 'PT', F: [pt * h * bP, 0, 0, 0, 0, 0], P: [G.xF - G.dimX / 2, y, G.zTS + h / 2], cible: 'futdist', fut: i, lin, poteau: true }));
        if (pq > 0) out.push(act({ id: 'pqp' + i, nom: 'Poussée de la surcharge sur poteau ' + (i + 1), cat: 'PQ', F: [pq * h * bP, 0, 0, 0, 0, 0], P: [G.xF - G.dimX / 2, y, G.zTS + h / 2], cd: 1, cible: 'futdist', fut: i, lin: Object.assign({}, lin, { a: 0, b: 0 }), poteau: true }));
      });
    }
    return out;
  }

  /* ── séisme (EN 1998-2 §6.7.3, EN 1998-5 §7.3.2.2) ── */
  function sismeParams(d) {
    const s = d.sismique;
    const sp = MP ? MP.spectre({ zone: s.zone, sol: s.sol, classe: s.classe, xi: 5 }) : { ag: 1.1, S: 1.35, avg: 0.5 };
    const alpha = sp.ag / G_ACC, r = num(s.r, 1) || 1;
    const kh = num(s.khAppui) > 0 ? +s.khAppui : alpha * sp.S / r;                  // EN 1998-5 (7.1)
    const kv = (sp.avg / sp.ag > 0.6 ? 0.5 : 0.33) * kh;                              // EN 1998-5 (7.2), (7.3)
    return { ag: sp.ag, S: sp.S, alpha, r, kh, kv, avg: sp.avg };
  }
  function sismeAppui(d, G, propres) {
    const sp = sismeParams(d), out = [];
    // inerties horizontales des éléments en béton (masse de l'appui), directions X et Y séparées
    propres.filter((a) => a.cat === 'PP').forEach((a) => {
      const W = -a.F[2];
      const base = { P: a.P.slice(), cd: 1, cible: a.cible, fut: a.fut, z0: a.cible === 'futpp' ? G.zTS : undefined, z1: a.cible === 'futpp' ? G.zTF : undefined };
      if (a.cible === 'futpp') base.cible = 'futdist';
      out.push(act(Object.assign({ id: 'ex-' + a.id, nom: 'Inertie X — ' + a.nom, cat: 'EX', F: [sp.kh * W, 0, 0, 0, 0, 0] }, base)));
      out.push(act(Object.assign({ id: 'ey-' + a.id, nom: 'Inertie Y — ' + a.nom, cat: 'EY', F: [0, sp.kh * W, 0, 0, 0, 0] }, base)));
    });
    // incrément dynamique de poussée (Mononobe-Okabe, EN 1998-5 annexe E), réparti uniformément sur la hauteur retenue
    if (d.type !== 'pile') {
      const mo = mononobe(d.sol.phi, d.sol.delta, sp.kh, sp.kv), zr = d.geo.zdef;
      const Z = zonesPoussee(d, G);
      if (Z.length && mo.dK > 0) {
        const zLow = Math.min(...Z.map((z) => z.z0)), Hw = zr - zLow, p = 0.5 * mo.dK * d.sol.gamma * Hw;  // pression uniforme équivalente
        Z.forEach((z) => {
          const H = p * (z.z1 - z.z0) * z.L, x = z.cible === 'fut' ? G.xF - G.dimX / 2 : G.xBack;
          out.push(act({ id: 'ep-' + z.nom, nom: 'Poussée dynamique (M-O) — ' + z.nom, cat: 'EP', F: [H, 0, 0, 0, 0, 0], P: [x, 0, (z.z0 + z.z1) / 2], cd: 1, cible: z.cible === 'fut' ? 'futdist' : z.cible, fut: z.fut, z0: z.z0, z1: z.z1, lin: z.cible === 'fut' ? { a: p, b: p, q: 0, z0: z.z0, z1: z.z1, L: z.L, w: z.L } : undefined }));
        });
      }
      out.mo = mo;
    }
    out.sp = sp;
    return out;
  }

  /* ── actions du tablier : repère de l'appui (rotation du biais), point d'application aux appareils ──
   * biais de l'appui φ (gr) : angle entre l'axe longitudinal de l'ouvrage et l'axe Y de l'appui ; ε = (100 − φ) gr.
   * Un effort longitudinal H du tablier donne HX = H cos ε, HY = H sin ε ; une excentricité transversale dy du tablier
   * devient dy / cos ε le long de l'appui. Les saisies « repère appui » sont prises telles quelles. */
  function actionsTablier(d, G) {
    const e = (100 - num(d.biais, 100)) * GR, c = Math.cos(e), s = Math.sin(e), rep = d.repereTablier !== false;
    return (d.actions || []).map((a, k) => {
      const HXt = num(a.HX), HYt = num(a.HY);
      const HX = rep ? HXt * c - HYt * s : HXt, HY = rep ? HXt * s + HYt * c : HYt, dy = rep ? num(a.dy) / c : num(a.dy);
      const cdDef = { Gmax: 0, Gmin: 0, GD: 0, R: 0, Td: d.partCDT, Tc: d.partCDT }[a.cat];
      const cd = Number.isFinite(+a.cd) && a.cd !== '' && a.cd !== undefined ? +a.cd : (cdDef === undefined ? 1 : cdDef);
      return act({ id: 't' + k, nom: a.nom || ('Action ' + (k + 1)), cat: a.cat, qt: a.qt || '', etatG: a.etatG || '', tab: true,
        F: [HX, HY, num(a.V), num(a.MX), num(a.MY), 0], P: [G.xApp + num(a.dx), dy, G.zApp], cd, cible: num(a.dx) !== 0 && G.chev ? 'chevx' : 'tab' });
    });
  }

  /* ══════════════════════ combinaisons ══════════════════════ */
  /* Coefficients (γ × ψ) par référentiel ; usage 'fond' (stabilité, Fasc. 62 : terres × 1,05 / 0,95 et surcharges de
   * remblai × 1,2 dans l'ancien référentiel route) ou 'struct' (béton armé). */
  function coefs(d) {
    const old = d.regl !== 'EC', rail = d.ouvrage === 'rail', nV = Math.max(1, d.nVoies || 1);
    const psiRail = nV >= 3 ? 0.4 : nV === 2 ? 0.6 : 0.8;          // Livret 2.01 tableau 1 (fréquent, accidentel)
    const psi1RailEC = nV >= 3 ? 0.6 : nV === 2 ? 0.7 : 0.8;       // EN 1990 A2 tableau A2.3
    if (old && !rail) return {                                       // Fasc. 61 titre II + BAEL 91 (annexes) — ponts-routes
      nom: 'Fascicule 61 titre II et BAEL 91 mod. 99 (ponts-routes)',
      G: { ELU: [1.35, 1.0] }, mT: { fond: [1.05, 0.95], struct: [1, 1] }, R: { ELU: 1.35 },
      Q: (etat, qt, role) => {
        const AB = qt === 'A' || qt === 'B' || qt === 'rail';
        return { ELU: AB ? 1.605 : 1.35, CAR: AB ? 1.2 : 1.0, FRE: qt === 'A' ? 0.4 : 0, QP: 0, ACC: qt === 'A' ? 0.4 : 0, SIS: qt === 'A' ? 0.2 : 0 }[etat];
      },
      QT: { ELU: 1.605, CAR: 1, FRE: 0, QP: 0, ACC: 0, SIS: 0 }, QD: { ELU: 1.605, CAR: 1.2, FRE: 0, QP: 0, ACC: 0, SIS: 0 },
      PQ: { fond: { ELU: 1.605, CAR: 1.2, FRE: 0.48, QP: 0, ACC: 0, SIS: 0 }, struct: { ELU: 1.35, CAR: 1, FRE: 0.4, QP: 0, ACC: 0, SIS: 0 } },
      T: { ELU: [1.35, 0.81], CAR: [1, 0.6], FRE: [0.5, 0.5], QP: [0.5, 0.5], ACC: [0.5, 0.5], SIS: [0, 0] },
      W: { ELU: [1.5, 0], CAR: [1, 0], FRE: [0.2, 0], QP: [0, 0], ACC: [0.2, 0] },
      AD: 1, E: 1,
    };
    if (old) return {                                                // Livret 2.01 (février 1995), tableaux 1 et 2 — ponts-rails
      nom: 'Livret 2.01 (ponts-rails) et BAEL 91 mod. 99',
      G: { ELU: [1.35, 1.0] }, mT: { fond: [1, 1], struct: [1, 1] }, R: { ELU: 1.35 },
      Q: (etat, qt) => ({ ELU: qt === 'sw2' ? 1.35 : 1.45, CAR: 1, FRE: psiRail, QP: 0, ACC: psiRail, SIS: 0 }[etat]),
      QT: { ELU: 1.5, CAR: 1, FRE: 0, QP: 0, ACC: 0, SIS: 0 }, QD: { ELU: 1.45, CAR: 1, FRE: psiRail, QP: 0, ACC: 0, SIS: 0 },
      PQ: { fond: { ELU: 1.45, CAR: 1, FRE: psiRail, QP: 0, ACC: psiRail, SIS: 0 }, struct: { ELU: 1.45, CAR: 1, FRE: psiRail, QP: 0, ACC: psiRail, SIS: 0 } },
      T: { ELU: [1.5, 0.9], CAR: [1, 0.6], FRE: [0.6, 0.5], QP: [0.5, 0.5], ACC: [0.5, 0.5], SIS: [0, 0] },
      W: { ELU: [1.5, 0.9], CAR: [1, 0.6], FRE: [0.2, 0], QP: [0, 0], ACC: [0.2, 0] },
      AD: 1, E: 1,
    };
    // Eurocodes : EN 1990 A2 + AN française (tableaux A2.1, A2.3, A2.4(B)) ; trafic ferroviaire γQ = 1,45 (1,35 pour SW/2)
    const gQ = rail ? 1.45 : 1.35, psi0 = rail ? 0.8 : 0.75, psi1 = rail ? psi1RailEC : 0.75, psi21 = num(d.psi21, rail ? 0.3 : 0.2);
    const tr = { ELU: gQ, CAR: 1, FRE: psi1, QP: 0, ACC: psi1, SIS: psi21 };
    return {
      nom: 'EN 1990 annexe A2 et AN française',
      G: { ELU: [1.35, 1.0] }, mT: { fond: [1, 1], struct: [1, 1] }, R: { ELU: 1.0 },
      Q: (etat, qt) => (etat === 'ELU' && qt === 'sw2' ? 1.35 : tr[etat]), psi0Q: psi0,
      QT: { ELU: gQ, CAR: 1, FRE: rail ? psi1 : 0.4, QP: 0, ACC: rail ? psi1 : 0.4, SIS: 0 }, QD: tr,
      PQ: { fond: tr, struct: tr },
      T: { ELU: [1.5, 0.9], CAR: [1, 0.6], FRE: [0.6, 0.5], QP: [0.5, 0.5], ACC: [0.5, 0.5], SIS: [0.5, 0.5] },
      W: { ELU: [1.5, 1.5 * (rail ? 0.75 : 0.6)], CAR: [1, rail ? 0.75 : 0.6], FRE: [rail ? 0.5 : 0.2, 0], QP: [0, 0], ACC: [rail ? 0.5 : 0.2, 0] },
      AD: 1, E: 1,
    };
  }
  /* Génère les combinaisons : {n, etat, type (FONDATIO), nom, f: {id: [coef fond, coef struct]}} */
  function combinaisons(d, acts) {
    const K = coefs(d), byCat = (c) => acts.filter((a) => a.cat === c);
    const Q = byCat('Q'), QT = byCat('QT'), QD = byCat('QD'), F = byCat('F'), W = byCat('W'), AD = byCat('AD');
    const EX = byCat('EX'), EY = byCat('EY'), EP = byCat('EP');
    const out = [];
    const TYPE = { ELU: 'ELU Fond', CAR: 'ELS Rare', FRE: 'ELS Freq', QP: 'ELS QP', ACC: 'ELU Acc', SIS: 'ELU Sis' };
    const okG = (a, g) => !a.etatG || a.etatG === g;
    const push = (etat, nom, f) => out.push({ n: out.length + 1, etat, type: TYPE[etat], nom, f });
    const perm = (f, etat, g, s) => {
      const gG = etat === 'ELU' ? K.G.ELU[g === 'max' ? 0 : 1] : 1;
      const mF = K.mT.fond[g === 'max' ? 0 : 1], mS = K.mT.struct[g === 'max' ? 0 : 1];
      for (const a of acts) {
        if (a.cat === 'PP' || a.cat === 'GD') f[a.id] = [gG, gG];
        else if (a.cat === 'GT') f[a.id] = [gG * mF, gG * mS];
        else if (a.cat === 'PT') { const gp = etat === 'ELU' ? K.G.ELU[0] : 1; f[a.id] = [gp * K.mT.fond[0], gp * K.mT.struct[0]]; }    // poussée toujours défavorable
        else if (a.cat === (g === 'max' ? 'Gmax' : 'Gmin')) f[a.id] = [gG, gG];
        else if (a.cat === 'R' && s > 0) { const r = etat === 'ELU' ? K.R.ELU : 1; f[a.id] = [r, r]; }
      }
    };
    const therm = (f, etat, s, role) => { const c = K.T[etat] ? K.T[etat][role === 'lead' ? 0 : 1] : 0; if (!c) return; for (const a of byCat(s > 0 ? 'Tc' : 'Td')) f[a.id] = [c, c]; };
    const traffic = (f, etat, g, s, q, role) => {
      const cq = role === 'lead' ? K.Q(etat, q.qt, 'lead') : (K.psi0Q || 0.8) * K.Q('ELU', q.qt) * (etat === 'ELU' ? 1 : 1 / K.Q('ELU', q.qt));
      if (!cq) return false;
      f[q.id] = [cq, cq];
      const route = d.ouvrage !== 'rail';
      for (const a of QT) if (okG(a, g) && (q.qt === 'A' || q.qt === 'B' || q.qt === 'rail' || q.qt === 'sw2' || route)) { const c = K.QT[etat] * (role === 'lead' ? 1 : (K.psi0Q || 1)); if (c) f[a.id] = [c, c]; }
      if (g === 'max' && q.etatG !== 'min') for (const a of QD) { const c = K.QD[etat] * (role === 'lead' ? 1 : (K.psi0Q || 1)); if (c) f[a.id] = [c, c]; }
      for (const a of acts) if (a.cat === 'PQ') { const c1 = K.PQ.fond[etat], c2 = K.PQ.struct[etat], r = role === 'lead' ? 1 : (K.psi0Q || 1); if (c1 || c2) f[a.id] = [c1 * r, c2 * r]; }
      for (const a of F) if (a.qt === '*' || !a.qt || a.qt === q.qt) f[a.id] = [cq * s, cq * s];
      return true;
    };
    const etats = ['ELU', 'CAR', 'FRE', 'QP'];
    for (const etat of etats) for (const g of ['max', 'min']) for (const s of [1, -1]) {
      const sens = s > 0 ? 'retrait / contraction' : 'dilatation', gl = g === 'max' ? 'G max' : 'G min';
      // température dominante (ou permanentes seules à l'ELS quasi permanent)
      { const f = {}; perm(f, etat, g, s); therm(f, etat, s, 'lead'); push(etat, `${gl} · ${sens} · température${etat === 'QP' ? ' (ψ2)' : ' dominante'}`, f); }
      if (etat === 'QP') continue;
      for (const q of Q) {
        if (!okG(q, g)) continue;
        const f = {}; perm(f, etat, g, s);
        if (!traffic(f, etat, g, s, q, 'lead')) continue;
        therm(f, etat, s, 'acc');
        push(etat, `${gl} · ${sens} · ${q.nom}`, f);
      }
      if (W.length && (K.W[etat] || [0])[0]) {
        const f = {}; perm(f, etat, g, s); for (const a of W) f[a.id] = [K.W[etat][0] * s, K.W[etat][0] * s]; therm(f, etat, s, 'acc');
        push(etat, `${gl} · ${sens} · vent dominant`, f);
      }
    }
    // ELU accidentel (EN 1990 6.11b ; Livret 2.01 tableau 2) : G + Ad + ψ1·Q + ψ2·T
    for (const ad of AD) for (const s of [1, -1]) for (const q of [null, ...Q.filter((x) => x.etatG !== 'min')]) {
      const f = {}; perm(f, 'ACC', 'max', s); f[ad.id] = [1, 1]; therm(f, 'ACC', s, 'acc');
      if (q) { const c = K.Q('ACC', q.qt); if (!c) continue; f[q.id] = [c, c]; }
      push('ACC', `${ad.nom}${q ? ' · ' + q.nom : ''} · ${s > 0 ? 'contraction' : 'dilatation'}`, f);
    }
    // ELU sismique (EN 1990 6.12b ; EN 1998-2 §4.2.1.4 : E = ±EX ± 0,3 EY et ±0,3 EX ± EY) + ψ2,1 trafic
    if (EX.length || EY.length) {
      const qmax = Q.filter((x) => x.etatG !== 'min' && K.Q('SIS', x.qt)).sort((a, b) => a.F[2] - b.F[2])[0];
      for (const [cx, cy] of [[1, 0.3], [0.3, 1]]) for (const sx of [1, -1]) for (const sy of [1, -1]) for (const q of [null, qmax].filter((x, i) => i === 0 || x)) {
        const f = {}; perm(f, 'SIS', 'max', sx); therm(f, 'SIS', sx, 'acc');
        for (const a of EX) f[a.id] = [cx * sx, cx * sx];
        for (const a of EY) f[a.id] = [cy * sy, cy * sy];
        for (const a of EP) f[a.id] = [1, 1];
        if (q) { const c = K.Q('SIS', q.qt); f[q.id] = [c, c]; }
        push('SIS', `${sx > 0 ? '+' : '−'}${cx === 1 ? '' : '0,3 '}EX ${sy > 0 ? '+' : '−'} ${cy === 1 ? '' : '0,3 '}EY${q ? ' · ' + q.nom : ''}`, f);
      }
    }
    return { list: out, K };
  }

  /* ══════════════════════ torseurs ══════════════════════ */
  function transport(F, P, Q) {
    const rx = P[0] - Q[0], ry = P[1] - Q[1], rz = P[2] - Q[2];
    return [F[0], F[1], F[2], F[3] + ry * F[2] - rz * F[1], F[4] + rz * F[0] - rx * F[2], F[5] + rx * F[1] - ry * F[0]];
  }
  /* torseur d'une combinaison au point Q (sous-face de semelle) : parts de longue et de courte durée.
   * Option « butée » (culée enterrée, PP 73) : les efforts horizontaux suivant X sont équilibrés par la butée des terres
   * sur les poteaux ; ils ne sont pas repris dans HX et leur bras de levier est réduit de Dz. */
  function torseurFond(acts, comb, Q, opt = {}) {
    const ld = A6(), cd = A6();
    for (const a of acts) {
      const c = comb.f[a.id]; if (!c || !c[0]) continue;
      if (a.fondExclu) continue;
      let T;
      if (opt.butee) {
        const Fv = a.F.slice(); Fv[0] = 0;
        T = transport(Fv, a.P, Q);
        T[4] += a.F[0] * Math.max(0, a.P[2] - Q[2] - opt.Dz);
      } else T = transport(a.F, a.P, Q);
      const k = c[0];
      for (let i = 0; i < 6; i++) { ld[i] += k * (1 - a.cd) * T[i]; cd[i] += k * a.cd * T[i]; }
    }
    return { ld, cd, tot: ld.map((v, i) => v + cd[i]) };
  }

  /* ══════════════════════ fondation à paramètres saisis (Fasc. 62 titre V annexe B / NF P 94-261) ══════════════════════ */
  function fondSaisie(d, G, combs) {
    const f = d.fond, g = d.geo, old = d.regl !== 'EC';
    const forme = { B: g.B, L: g.L }, A = g.B * g.L;
    const zq = d.type === 'pile' ? g.zdef : Math.min(g.zdef, num(g.zAvant, g.zdef));
    const zeau = num(g.zeau, -1e9);
    const q0 = wCol(g.zBase, zq, zeau, d.sol.gamma, d.sol.gammaSat - 10) / 1000;  // q'0 (MPa)
    const qu = num(f.qu), frottant = f.sol !== 'coherent', DeB = num(f.De) / g.B;
    // γq : Fasc. 62 titre V B.3 (ELU 2, ELS 3) ; NF P 94-261 : γR;v = 1,4 (ELU), 2,3 (ELS), γR;d;v = 1,2 (accidentel / sismique γR;v = 1,0)
    const gq = (t) => (old ? (t.startsWith('ELU') ? 2 : 3) : (t === 'ELU Fond' ? 1.68 : t.startsWith('ELU') ? 1.2 : 2.76));
    const lim = { 'ELS Freq': 0, 'ELS QP': 0, 'ELS Rare': 25, 'ELU Fond': 90, 'ELU Acc': 90, 'ELU Sis': 90 };
    const kv = num(f.kv) * 1000, kvCD = kv * num(f.rapSol, 2);  // kPa/m
    const phi = num(f.phi, 30) * RAD, coh = num(f.c);
    const res = combs.map((cb) => {
      const T = cb.T.tot, N = -T[2], H = Math.hypot(T[0], T[1]);
      const r = FD.repartition(forme, N, T[3], T[4]);
      const qref = (3 * r.smax + r.smin) / 4 / 1000;
      const delta = N > 0 ? Math.atan(H / N) / RAD : 90;
      const id = FD.iDelta(delta, frottant, DeB);
      const qadm = q0 + (qu - q0) * id / gq(cb.type);
      const Ac = r.Ac || A;
      const Hres = old ? N * Math.tan(phi) / 1.2 + coh * Ac / 1.5 : N * Math.tan(phi) / 1.1;    // Fasc. 62 B.5 ; NF P 94-261 (γR;h = 1,1)
      const okG = !cb.type.startsWith('ELU') || H <= Hres + 1e-9;
      const wz = (-cb.T.ld[2] / A / kv + -cb.T.cd[2] / A / kvCD) * 1000;
      const okD = r.decomp <= lim[cb.type] + 1e-6;
      return { n: cb.n, type: cb.type, nom: cb.nom, T, N, H, smax: r.smax / 1000, smin: r.smin / 1000, decomp: r.decomp, decompAdm: lim[cb.type], qref, qadm, id, delta, Hres,
        glis: H > 0 ? Hres / H : Infinity, okP: qref <= qadm + 1e-9, okD, okG, ok: qref <= qadm + 1e-9 && okD && okG, wz, rep: r };
    });
    const pire = (fn, flt) => res.filter(flt).reduce((m, r) => (!m || fn(r) > fn(m) ? r : m), null);
    return { mode: 'saisie', q0, qu, combs: res, synth: { els: pire((r) => r.qref / r.qadm, (r) => r.type.startsWith('ELS')), elu: pire((r) => r.qref / r.qadm, (r) => r.type.startsWith('ELU')),
      glis: pire((r) => -r.glis, (r) => r.type.startsWith('ELU')), decomp: pire((r) => r.decomp - r.decompAdm, () => true), ok: res.every((r) => r.ok) } };
  }
  function fondation(d, G, combs, sps) {
    const f = d.fond, g = d.geo;
    if (f.type === 'sup' && (f.mode !== 'sps' || !sps)) return fondSaisie(d, G, combs);
    if (!sps) throw new Error('Fondation ' + (f.type === 'semi' ? 'semi-profonde' : 'profonde') + ' : charger un sondage pressiométrique (.sps).');
    const zdefF = d.type === 'pile' ? g.zdef : Math.min(g.zdef, num(g.zAvant, g.zdef));
    const base = { sps, zsem: g.zBase, zdef: zdefF, ztn: num(g.ztn, zdefF), gamma: d.sol.gamma, gammaSat: d.sol.gammaSat, gammaB: d.mat.gammaB, rapSol: num(f.rapSol, 2), fcj: d.mat.fck, fe: d.mat.fe,
      combs: combs.map((c) => ({ type: c.type, ld: c.T.ld, cd: c.T.cd })) };
    if (Number.isFinite(+g.zeau) && g.zeau > -1e3) base.zeau = g.zeau;
    let r;
    if (f.type === 'sup') r = FD.calc(Object.assign(base, { type: 'sup', sup: { forme: 'rect', B: g.B, L: g.L, phi: num(f.phi, 30), c: num(f.c), sol: f.sol } }));
    else if (f.type === 'semi') r = FD.calc(Object.assign(base, { type: 'semi', sup: { forme: 'rect', B: num(f.massif.B, g.B), L: num(f.massif.L, g.L), h: num(f.massif.h), phi: num(f.phi, 30), c: num(f.c), sol: f.sol } }));
    else {
      const p = f.pieux, piles = pieuxPlan(p);
      r = FD.calc(Object.assign(base, { type: 'pieux', pieux: { type: num(p.type, 2), B: p.D, L: p.Lp, nseg: 10, piles, enrob: num(p.enrob, 0.09), kbase: 1e8 } }));
    }
    r.mode = 'sps';
    r.combs.forEach((c, k) => { c.nom = combs[k].nom; });
    return r;
  }
  function pieuxPlan(p) {
    const piles = [], nf = Math.max(1, Math.round(num(p.nFiles, 1))), np = Math.max(1, Math.round(num(p.nParFile, 1)));
    if (Array.isArray(p.liste) && p.liste.length) return p.liste.map((q) => ({ x: +q.x, y: +q.y }));
    for (let i = 0; i < nf; i++) for (let j = 0; j < np; j++) piles.push({ x: (i - (nf - 1) / 2) * num(p.eFile), y: (j - (np - 1) / 2) * num(p.ePieu) });
    return piles;
  }

  /* ══════════════════════ fûts et chevêtre : portique transversal + statique longitudinale ══════════════════════ */
  function modeleTransversal(d, G) {
    if (!G.nF || !PQ) return null;
    const Ec = 11000 * Math.cbrt(d.mat.fck) * 1000;               // module instantané (BAEL A.2.1,21), kPa
    const nodes = [], elems = [], supports = [], fut = [], chevEl = [];
    const C = G.chev, zc = C ? (C.z0 + C.z1) / 2 : G.zTF;
    const nSeg = 6;
    G.yF.forEach((y, i) => {
      const nb = nodes.length; nodes.push({ x: y, y: G.zTS }); supports.push({ n: nb, ux: true, uy: true, rz: true });
      const segs = [];
      for (let k = 1; k <= nSeg; k++) { nodes.push({ x: y, y: G.zTS + (zc - G.zTS) * k / nSeg }); elems.push({ i: nb + k - 1, j: nb + k, E: Ec, A: G.Af, I: G.IxF }); segs.push(elems.length - 1); }
      fut.push({ base: nb, top: nb + nSeg, segs, L: zc - G.zTS });
    });
    let chevNodes = [];
    if (C) {
      const ys = new Set([-C.L / 2, C.L / 2, ...G.yA.map((v) => +v.toFixed(6)), ...G.yF.map((v) => +v.toFixed(6))]);
      for (let k = 0; k <= 20; k++) ys.add(+(-C.L / 2 + C.L * k / 20).toFixed(6));
      const arr = [...ys].filter((v) => v >= -C.L / 2 - 1e-9 && v <= C.L / 2 + 1e-9).sort((a, b) => a - b);
      chevNodes = arr.map((y) => { const f = G.yF.findIndex((yy) => Math.abs(yy - y) < 1e-6); if (f >= 0) return fut[f].top; nodes.push({ x: y, y: zc }); return nodes.length - 1; });
      const Ich = C.l * Math.pow(C.h, 3) / 12;
      for (let k = 0; k < chevNodes.length - 1; k++) { elems.push({ i: chevNodes[k], j: chevNodes[k + 1], E: Ec, A: C.l * C.h, I: Ich }); chevEl.push(elems.length - 1); }
    }
    const model = { nodes, elems, supports };
    const prep = PQ.prepare(model);
    return { model, prep, fut, chevEl, chevNodes, zc, Ec };
  }
  const nodeAt = (M, y) => M.chevNodes.reduce((b, n) => (Math.abs(M.model.nodes[n].x - y) < Math.abs(M.model.nodes[b].x - y) ? n : b), M.chevNodes[0]);

  /* charges transversales d'une action sur le portique (plan Y-Z ; portique : x = Y, y = Z, M trigonométrique) */
  function chargesPortique(a, d, G, M) {
    const nodal = [], elem = [];
    const C = G.chev;
    if (a.cible === 'tab' || a.cible === 'chevx') {
      // répartition rigide sur les appareils : Fz_a = V/nA + Mx0·y_a/Σy² ; Fy_a = HY/nA
      const V = a.F[2], Mx0 = a.F[3] + a.P[1] * V, Fy = a.F[1], n = G.nA, S2 = G.yA.reduce((s, y) => s + y * y, 0);
      G.yA.forEach((y, k) => {
        const Fz = V / n + (S2 > 0 ? Mx0 * y / S2 : 0), fy = Fy / n;
        const hb = G.zApp - M.zc;
        if (C) nodal.push({ n: nodeAt(M, y), Fx: fy, Fy: Fz, M: -hb * fy });
        else { const i = G.futA[k], fi = M.fut[i]; nodal.push({ n: fi.top, Fx: fy, Fy: Fz, M: (y - G.yF[i]) * Fz - hb * fy }); }
      });
      return { nodal, elem };
    }
    if (a.cible === 'chev' && C) {
      // charge répartie sur la longueur de l'élément (chevêtre, murette) ; murs en retour : charge ponctuelle à l'extrémité
      if (/retour/i.test(a.nom)) nodal.push({ n: nodeAt(M, a.P[1]), Fx: a.F[1], Fy: a.F[2], M: 0 });
      else { const q = a.F[2] / C.L, qy = a.F[1] / C.L; M.chevEl.forEach((e) => { elem.push({ e, type: 'u', dir: 'gy', q }); if (qy) elem.push({ e, type: 'u', dir: 'gx', q: qy }); }); }
      return { nodal, elem };
    }
    if (a.cible === 'tete' && !C) {   // garde-grève ou mur en retour porté par le fût (mur de front)
      const i = 0; nodal.push({ n: M.fut[i].top, Fx: a.F[1], Fy: a.F[2], M: 0 }); return { nodal, elem };
    }
    if ((a.cible === 'futdist' || a.cible === 'futpt') && a.F[1]) {
      const fi = M.fut[a.fut];
      if (a.cible === 'futpt') {
        const s = a.P[2] - G.zTS; let acc = 0;
        for (const e of fi.segs) { const L = fi.L / fi.segs.length; if (s >= acc - 1e-9 && s <= acc + L + 1e-9) { elem.push({ e, type: 'p', dir: 'gx', P: a.F[1], a: s - acc }); break; } acc += L; }
      } else {
        const z0 = num(a.z0, G.zTS), z1 = num(a.z1, G.zTF), q = a.F[1] / Math.max(1e-9, z1 - z0);
        let acc = 0; for (const e of fi.segs) { const L = fi.L / fi.segs.length, a0 = Math.max(0, z0 - G.zTS - acc), b0 = Math.min(L, z1 - G.zTS - acc); if (b0 > a0) elem.push({ e, type: 'u', dir: 'gx', q, a: a0, b: b0 }); acc += L; }
      }
    }
    return { nodal, elem };
  }

  /* efforts dans les fûts (sections de calcul) et le chevêtre pour chaque action élémentaire */
  function effetsElements(d, G, acts, M) {
    const ns = 5, zs = []; for (let k = 0; k <= ns; k++) zs.push(G.zTS + G.hF * k / ns);
    const nF = G.nF;
    const eff = {};
    for (const a of acts) {
      if (a.cible === 'sem') { eff[a.id] = null; continue; }
      const E = { fut: G.yF.map(() => zs.map(() => [0, 0, 0, 0, 0])), chev: null, app: null };   // [N (compr.), Vx, Vy, Mx, My]
      // 1) transversal (Y-Z) et répartition verticale entre fûts par le portique
      let Nsh = null;
      if (M && (a.cible === 'tab' || a.cible === 'chev' || a.cible === 'chevx' || a.cible === 'tete' || ((a.cible === 'futdist' || a.cible === 'futpt') && a.F[1]))) {
        const L = chargesPortique(a, d, G, M);
        const r = M.prep.run(L);
        Nsh = G.yF.map((_, i) => -r.at(M.fut[i].segs[0], 0).N);    // effort normal en pied (compression +)
        G.yF.forEach((_, i) => {
          const fi = M.fut[i], Ls = fi.L / fi.segs.length;
          zs.forEach((z, k) => {
            const s = z - G.zTS, j = Math.min(fi.segs.length - 1, Math.floor(s / Ls - 1e-9)), e = fi.segs[Math.max(0, j)], loc = s - Math.max(0, j) * Ls;
            const v = r.at(e, Math.min(Ls, Math.max(0, loc)));
            E.fut[i][k][0] += -v.N; E.fut[i][k][2] += v.V; E.fut[i][k][3] += v.M;
          });
        });
        if (M.chevEl.length) E.chev = M.chevEl.map((e) => { const L0 = r.lens ? r.lens[e] : null; const a0 = r.at(e, 0), b0 = r.at(e, L0 || (M.model.nodes[M.model.elems[e].j].x - M.model.nodes[M.model.elems[e].i].x)); return { y0: M.model.nodes[M.model.elems[e].i].x, y1: M.model.nodes[M.model.elems[e].j].x, M0: a0.M, M1: b0.M, V0: a0.V, V1: b0.V }; });
        if (a.tab) { const V = a.F[2], Mx0 = a.F[3] + a.P[1] * V, S2 = G.yA.reduce((s, y) => s + y * y, 0); E.app = G.yA.map((y) => -(V / G.nA + (S2 > 0 ? Mx0 * y / S2 : 0))); }
      }
      // 2) longitudinal (X-Z) par statique : effort HX partagé entre les fûts, excentricités des charges verticales
      if (nF) {
        const shareX = a.cible === 'tab' || a.cible === 'chev' || a.cible === 'chevx' || a.cible === 'ecran' || a.cible === 'tete';
        G.yF.forEach((yF, i) => {
          zs.forEach((z, k) => {
            const T = E.fut[i][k];
            if (shareX) {
              const Fx = a.F[0] / nF, arm = Math.max(0, a.P[2] - z);
              T[1] += Fx; T[4] += Fx * arm + a.F[4] / nF;
              if (Nsh) T[4] += Nsh[i] * (a.P[0] - G.xF);   // charge verticale reçue par le fût × excentricité (My = −Δx·Fz)
              if (a.cible === 'ecran' && !Nsh) { /* écran sans charge verticale */ }
            } else if ((a.cible === 'futdist' || a.cible === 'futpp') && a.fut === i) {
              const z0 = num(a.z0, G.zTS), z1 = num(a.z1, G.zTF);
              if (a.cible === 'futpp') { T[0] += -a.F[2] * Math.max(0, G.zTF - z) / G.hF; return; }
              const lin = a.lin;
              // part de la charge au-dessus de la section (pression trapézoïdale ou uniforme)
              const part = (zz) => {
                if (!lin) { const h = Math.max(0, z1 - Math.max(z0, zz)); const p = a.F[0] / Math.max(1e-9, z1 - z0); return [p * h, p * h * h / 2]; }
                const zb = Math.max(z0, zz), h = Math.max(0, z1 - zb); if (h <= 0) return [0, 0];
                const pres = (zp) => lin.a + (lin.b - lin.a) * (z1 - zp) / Math.max(1e-9, z1 - z0);
                const pt = pres(z1), pb = pres(zb), Fh = (pt + pb) / 2 * h, zc = h * (2 * pt + pb) / (3 * (pt + pb || 1));
                const k_ = a.cat === 'PQ' ? lin.q * h : 0;
                const Ft = a.cat === 'PQ' ? k_ : Fh;
                const arm = a.cat === 'PQ' ? (zb - zz) + h / 2 : (zb - zz) + zc;
                return [Ft * (a.cat === 'PQ' ? lin.w : lin.L), Ft * (a.cat === 'PQ' ? lin.w : lin.L) * arm];
              };
              if (a.F[0]) { const [Fx, My] = part(z); T[1] += Fx; T[4] += My; }
            } else if (a.cible === 'futpt' && a.fut === i && a.F[0]) {
              if (a.P[2] > z) { T[1] += a.F[0]; T[4] += a.F[0] * (a.P[2] - z); }
            }
          });
        });
      }
      eff[a.id] = E;
    }
    return { eff, zs };
  }

  /* ══════════════════════ dimensionnement des sections ══════════════════════ */
  function materiaux(d) {
    const regl = d.regl === 'EC' ? 'EC2' : 'BAEL';
    const mat = SBA.materiau({ regl, fck: d.mat.fck, fyk: d.mat.fe, fissuration: num(d.mat.fiss, 1), livret: !!d.livret && regl === 'BAEL' });
    return mat;
  }
  const typeELU = (d, etat, hasCD) => (etat === 'ACC' ? 4 : etat === 'SIS' ? 5 : d.regl === 'EC' ? 1 : (hasCD ? 3 : 1));
  const bisect = (f, lo, hi) => { if (f(lo)) return lo; if (!f(hi)) return null; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; if (hi - lo < 1e-3) break; } return hi; };

  /* section rectangulaire b × h, nappe tendue unique (semelle, chevêtre) : M > 0 tend la fibre inférieure (convention
   * de ce module) ; BA.sectionBA : M > 0 comprime la fibre inférieure → M_sba = −M. */
  function dimFlexion(mat, b, h, c, M, type, ssLim, sbcLim) {
    if (!(Math.abs(M) > 1e-6)) return 0;
    const inf = M > 0, dd = h - c;
    const geo = (As) => SBA.rect({ b, h, nappes: inf ? [{ d: c, As: 0 }, { d: dd, As }] : [{ d: c, As }, { d: dd, As: 0 }] });
    if (type === 'ELS') return bisect((As) => { const e = SBA.els(geo(As), mat, { N: 0, M: -M, n: mat.regl === 'BAEL' ? 15 : mat.Es / (mat.Ecm / 3) }); return -e.ssMin <= ssLim + 1e-6 && e.sc <= sbcLim + 1e-6; }, 0.01, 0.1 * b * h * 1e4) || NaN;
    return bisect((As) => SBA.elu(geo(As), mat, { N: 0, M: -M, type }).ok, 0, 0.1 * b * h * 1e4) ?? NaN;
  }
  const AminFlex = (mat, b, dd) => (mat.regl === 'EC2' ? Math.max(0.26 * mat.fctm / mat.fyk, 0.0013) : 0.23 * mat.ftj / mat.fyk) * b * dd * 1e4;  // EC2 9.2.1.1 ; BAEL A.4.2

  /* fûts : par section, enveloppe ELU (avec excentricités additionnelles) et ELS ; section circulaire (aciers totaux) ou
   * rectangulaire (aciers symétriques sur les deux grandes faces pour My, sur les petites faces pour Mx) */
  function calculFuts(d, G, acts, combs, eff, zs, mat) {
    if (!G.nF) return null;
    const f = d.geo.fut, c = num(d.mat.cFut, 0.05), rond = f.forme === 'rond';
    const ssLim = d.regl === 'EC' ? 0.8 * d.mat.fe : (num(d.mat.ssFut) > 0 ? +d.mat.ssFut : mat.ssLim), sbc = 0.6 * d.mat.fck;
    const nEq = d.regl === 'EC' ? mat.Es / (mat.Ecm / 2) : 15;
    const lf = num(d.mat.kf, 1) * G.hF;
    const permCats = new Set(['PP', 'GT', 'PT', 'Gmax', 'Gmin', 'GD', 'R']);
    const res = G.yF.map((yF, i) => {
      const secs = zs.map((z, k) => {
        const rows = combs.map((cb) => {
          let T = [0, 0, 0, 0, 0], Mg = 0, hasCD = false;
          for (const a of acts) {
            const co = cb.f[a.id]; if (!co || !co[1] || !eff[a.id]) continue;
            const v = eff[a.id].fut[i][k];
            for (let j = 0; j < 5; j++) T[j] += co[1] * v[j];
            if (permCats.has(a.cat)) Mg += co[1] * Math.hypot(v[3], v[4]);
            if (a.cd > 0 && (v[0] || v[4] || v[3])) hasCD = true;
          }
          return { cb, N: T[0], Vx: T[1], Vy: T[2], Mx: T[3], My: T[4], Mg, hasCD };
        });
        const elu = rows.filter((r) => /^ELU/.test(r.cb.type)), els = rows.filter((r) => r.cb.type === 'ELS Rare' || (d.regl === 'EC' && r.cb.etat === 'QP'));
        let A = { tot: 0, face: 0, petite: 0 }, crit = {}, so2 = null;
        const L = G.hF;
        if (rond) {
          const geo = (As) => SBA.cercle({ D: f.D, a: c, As, nb: 24 });
          for (const r of elu) {
            const M1 = Math.hypot(r.Mx, r.My), type = typeELU(d, r.cb.etat, r.hasCD);
            const g0 = geo(0.01 * Math.PI * f.D * f.D / 4 * 1e4);
            const so = SBA.secondOrdre(g0, mat, { N: r.N, M: M1, Mcp: Math.min(M1, r.Mg) }, { L, lf, actif: k === 0 });
            const As = bisect((x) => SBA.elu(geo(x), mat, { N: r.N, M: so.M, type }).ok, 0, 0.08 * G.Af * 1e4);
            if (As === null || As > A.tot) { A.tot = As === null ? Infinity : As; crit.elu = { n: r.cb.n, N: r.N, M1, M: so.M, e: so.e }; so2 = so; }
          }
          for (const r of els) {
            const M1 = Math.hypot(r.Mx, r.My);
            const ok = (x) => { const e = SBA.els(geo(x), mat, { N: r.N, M: M1, n: nEq }); return -e.ssMin <= ssLim + 1e-6 && e.sc <= sbc + 1e-6; };
            const As = bisect(ok, 0.01, 0.08 * G.Af * 1e4);
            if (As === null || As > (A.els || 0)) { A.els = As === null ? Infinity : As; crit.els = { n: r.cb.n, N: r.N, M: M1 }; }
          }
          // minimum : EC2 9.5.2 (2) ; BAEL A.8.1,21 : 4 cm²/m de périmètre et 0,2 % de la section
          const Nmax = Math.max(0, ...elu.map((r) => r.N));
          A.min = d.regl === 'EC' ? Math.max(0.002 * G.Af, 0.1 * Nmax / 1000 / (d.mat.fe / 1.15)) * 1e4 : Math.max(4 * Math.PI * f.D, 0.002 * G.Af * 1e4);
          A.ret = Math.max(A.tot, A.els || 0, A.min);
        } else {
          const b = f.b, e = f.e;
          const geoF = (x) => SBA.rect({ b, h: e, nappes: [{ d: c, As: x }, { d: e - c, As: x }] });
          const geoP = (x) => SBA.rect({ b: e, h: b, nappes: [{ d: c, As: x }, { d: b - c, As: x }] });
          for (const r of elu) {
            const type = typeELU(d, r.cb.etat, r.hasCD);
            const so = SBA.secondOrdre(geoF(0), mat, { N: r.N, M: r.My, Mcp: Math.sign(r.My) * Math.min(Math.abs(r.My), r.Mg) }, { L, lf, actif: k === 0 });
            const As = bisect((x) => SBA.elu(geoF(x), mat, { N: r.N, M: so.M, type }).ok, 0, 0.04 * b * e * 1e4);
            if (As === null || As > A.face) { A.face = As === null ? Infinity : As; crit.elu = { n: r.cb.n, N: r.N, M1: r.My, M: so.M, e: so.e, Mx: r.Mx }; }
            const Ap = bisect((x) => SBA.elu(geoP(x), mat, { N: r.N, M: r.Mx, type }).ok, 0, 0.04 * b * e * 1e4);
            if (Ap === null || Ap > A.petite) A.petite = Ap === null ? Infinity : Ap;
          }
          for (const r of els) {
            const ok = (x) => { const s = SBA.els(geoF(x), mat, { N: r.N, M: r.My, n: nEq }); return -s.ssMin <= ssLim + 1e-6 && s.sc <= sbc + 1e-6; };
            const As = bisect(ok, 0.01, 0.04 * b * e * 1e4);
            if (As === null || As > (A.els || 0)) { A.els = As === null ? Infinity : As; crit.els = { n: r.cb.n, N: r.N, M: r.My }; }
          }
          // minimum par face : BAEL A.8.1,21 (4 cm²/m de parement, 0,2 % B au total) ; EC2 9.6.2 (voiles : 0,002 Ac au total)
          A.min = d.regl === 'EC' ? Math.max(0.001 * b * e * 1e4, 0) : Math.max(4 * b, 0.001 * b * e * 1e4);
          A.ret = Math.max(A.face, A.els || 0, A.min); A.ml = A.ret / b;
        }
        // effort tranchant (combinaison ELU la plus défavorable)
        let cis = null;
        for (const r of elu) {
          const V = rond ? Math.hypot(r.Vx, r.Vy) : Math.abs(r.Vx);
          const o = rond ? { b0: f.D / 1.4, bw: f.D / 1.4, d: 0.9 * f.D, h: f.D } : { b0: f.b, bw: f.b, d: f.e - c, h: f.e };
          const x = d.regl === 'EC' ? SBA.tranchantEC2({ bw: o.bw, h: o.h, d: o.d, Ac: G.Af, Asl: (A.ret || 0) / 2, N: r.N, V, fck: d.mat.fck, fyk: d.mat.fe, cot: 'libre', element: 'poutre' })
            : SBA.tranchantBAEL({ b0: o.b0, h: o.h, d: o.d, fc28: d.mat.fck, fe: 400, fissuration: num(d.mat.fiss, 1), N: r.N, V });
          if (!cis || V > cis.V) cis = Object.assign(x, { V, n: r.cb.n });
        }
        const Nm = rows.length ? Math.max(...elu.map((r) => r.N)) : 0;
        return { z, h: z - G.zTS, A, crit, cis, Nmax: Nm, rows: k === 0 ? rows : null, so: so2 };
      });
      return { i, y: yF, secs };
    });
    // contrôle : pourcentage maxi (BAEL A.8.1,22 : 5 % ; EC2 9.5.2 (3) : 4 %)
    const pmax = d.regl === 'EC' ? 0.04 : 0.05;
    const tot = (s) => (rond ? s.A.ret : 2 * s.A.ret + 2 * (s.A.petite || 0));
    const AsMax = Math.max(...res.flatMap((r) => r.secs.map(tot)));
    return { futs: res, ssLim, lf, pmax, AsMax, pctMax: AsMax / (G.Af * 1e4), ok: AsMax <= pmax * G.Af * 1e4 && res.every((r) => r.secs.every((s) => !s.cis || s.cis.ok !== false)) };
  }

  /* chevêtre : flexion verticale (portique), flexion horizontale sous la poussée de l'écran (poutre continue sur les
   * fûts : q e²/10 entre fûts, q c²/2 en console), section l × h */
  function calculChevetre(d, G, acts, combs, eff, mat) {
    const C = G.chev; if (!C) return null;
    const c = num(d.mat.cChev, 0.05), ssLim = d.regl === 'EC' ? 0.8 * d.mat.fe : mat.ssLim, sbc = 0.6 * d.mat.fck;
    const nEl = (eff[acts.find((a) => eff[a.id] && eff[a.id].chev)?.id] || { chev: [] }).chev.length;
    const secs = [];
    for (let e = 0; e < nEl; e++) for (const end of [0, 1]) {
      let y = null; const env = { ELU: [0, 0], ELS: [0, 0], V: 0, crit: {} };
      for (const cb of combs) {
        let Mv = 0, V = 0;
        for (const a of acts) { const co = cb.f[a.id]; if (!co || !co[1] || !eff[a.id] || !eff[a.id].chev) continue; const s = eff[a.id].chev[e]; y = end ? s.y1 : s.y0; Mv += co[1] * (end ? s.M1 : s.M0); V += co[1] * (end ? s.V1 : s.V0); }
        const k = /^ELU/.test(cb.type) ? 'ELU' : cb.type === 'ELS Rare' ? 'ELS' : null; if (!k) continue;
        if (Mv > env[k][0]) { env[k][0] = Mv; env.crit[k + '+'] = cb.n; }
        if (Mv < env[k][1]) { env[k][1] = Mv; env.crit[k + '-'] = cb.n; }
        if (k === 'ELU' && Math.abs(V) > env.V) env.V = Math.abs(V);
      }
      if (y === null) continue;
      if (secs.length && Math.abs(secs[secs.length - 1].y - y) < 1e-6) { const s = secs[secs.length - 1]; s.env.ELU = [Math.max(s.env.ELU[0], env.ELU[0]), Math.min(s.env.ELU[1], env.ELU[1])]; s.env.ELS = [Math.max(s.env.ELS[0], env.ELS[0]), Math.min(s.env.ELS[1], env.ELS[1])]; s.env.V = Math.max(s.env.V, env.V); continue; }
      secs.push({ y, env });
    }
    const t = d.regl === 'EC' ? 1 : 3;
    let Ainf = 0, Asup = 0, Vmax = 0;
    secs.forEach((s) => {
      s.Ainf = Math.max(dimFlexion(mat, C.l, C.h, c, s.env.ELU[0], t) || 0, dimFlexion(mat, C.l, C.h, c, s.env.ELS[0], 'ELS', ssLim, sbc) || 0);
      s.Asup = Math.max(dimFlexion(mat, C.l, C.h, c, s.env.ELU[1], t) || 0, dimFlexion(mat, C.l, C.h, c, s.env.ELS[1], 'ELS', ssLim, sbc) || 0);
      Ainf = Math.max(Ainf, s.Ainf); Asup = Math.max(Asup, s.Asup); Vmax = Math.max(Vmax, s.env.V);
    });
    const Amin = AminFlex(mat, C.l, C.h - c);
    // flexion horizontale : poussée sur l'écran, pondérée ELU
    const K = coefs(d);
    const qH = acts.filter((a) => a.cible === 'ecran').reduce((s, a) => s + Math.abs(a.F[0]) * (a.cat === 'PT' ? K.G.ELU[0] : a.cat === 'PQ' ? K.PQ.struct.ELU : 1), 0) / C.L;
    const eF = G.nF > 1 ? Math.abs(G.yF[1] - G.yF[0]) : 0, cons = G.nF ? C.L / 2 - Math.abs(G.yF[0]) : C.L / 2;
    const MH = Math.max(qH * eF * eF / 10, qH * cons * cons / 2);
    const AH = dimFlexion(mat, C.h, C.l, c, MH, t) || 0;
    const cis = d.regl === 'EC' ? SBA.tranchantEC2({ bw: C.l, h: C.h, d: C.h - c, Asl: Math.max(Ainf, Asup), N: 0, V: Vmax, fck: d.mat.fck, fyk: d.mat.fe, cot: 'libre', element: 'poutre' })
      : SBA.tranchantBAEL({ b0: C.l, h: C.h, d: C.h - c, fc28: d.mat.fck, fe: 400, fissuration: num(d.mat.fiss, 1), N: 0, V: Vmax });
    // dispositions PP 73 : aciers longitudinaux ≥ 0,5 % de la section, armatures d'effort tranchant ≥ 0,2 %
    return { secs, Ainf: Math.max(Ainf, Amin), Asup: Math.max(Asup, Amin), Amin, qH, MH, AH, Vmax, cis, pp73: { Along: 0.005 * C.l * C.h * 1e4, At: 0.002 * C.l * 1e4 }, ok: !cis || cis.ok !== false };
  }

  /* ══════════════════════ semelle ══════════════════════
   * Statique d'une semelle rigide : moment fléchissant par mètre dans une coupure = moment des forces situées au-delà
   * (réaction du sol ou des pieux vers le haut, poids de la semelle et des terres vers le bas, efforts des fûts en pied).
   * M > 0 : fibre inférieure tendue. Coupures au nu des fûts (carré de même aire pour un fût circulaire) et entre fûts. */
  function calculSemelle(d, G, acts, combs, fut, fond, mat) {
    const g = d.geo, B = g.B, L = g.L, ep = g.ep, c = num(d.mat.cSem, 0.05), nx = 40, ny = 80;
    const zeau = num(g.zeau, -1e9);
    const cells = [];
    const terresPA = (x) => { const a = acts.find((q) => q.cat === 'GT'); return a ? 1 : 0; };
    const topAt = (x) => { if (d.type === 'pile') return g.zdef; if (x < G.xBack) return g.zdef; let t = num(g.zAvant, g.zdef); if (G.chev && x <= G.chev.x1) t = Math.min(t, G.chev.z0); return t; };
    const inFut = (x, y) => G.yF.some((yf) => Math.abs(x - G.xF) <= G.dimX / 2 && Math.abs(y - yf) <= G.dimY / 2);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = -B / 2 + (i + 0.5) * B / nx, y = -L / 2 + (j + 0.5) * L / ny, A = B * L / nx / ny;
      const wb = wCol(g.zBase, G.zTS, zeau, d.mat.gammaB, d.mat.gammaB - 10);
      const wt = inFut(x, y) ? 0 : (terresPA(x) ? wCol(G.zTS, topAt(x), zeau, d.sol.gamma, d.sol.gammaSat - 10) : 0);
      cells.push({ x, y, A, wb, wt });
    }
    const aEq = (G.nF && g.fut.forme === 'rond') ? Math.sqrt(Math.PI) / 2 * G.dimX : G.dimX, bEq = (G.nF && g.fut.forme === 'rond') ? Math.sqrt(Math.PI) / 2 * G.dimY : G.dimY;
    const cutsX = G.nF ? [{ dir: 'x', v: G.xF + aEq / 2, cote: 'avant' }, { dir: 'x', v: G.xF - aEq / 2, cote: 'arrière' }] : [];
    const cutsY = [];
    if (G.nF) {
      G.yF.forEach((y, i) => { cutsY.push({ dir: 'y', v: y + bEq / 2, cote: 'nu fût ' + (i + 1) }); cutsY.push({ dir: 'y', v: y - bEq / 2, cote: 'nu fût ' + (i + 1) }); if (i) cutsY.push({ dir: 'y', v: (y + G.yF[i - 1]) / 2, cote: 'entre fûts ' + i + '-' + (i + 1) }); });
    }
    const cuts = cutsX.concat(cutsY).filter((k) => Math.abs(k.v) < (k.dir === 'x' ? B : L) / 2 - 1e-6);
    const K = coefs(d), pieux = fond && fond.combs && fond.combs[0] && fond.combs[0].piles;
    const piles = pieux ? pieuxPlan(d.fond.pieux) : null;
    const env = cuts.map(() => ({ ELU: [0, 0], ELS: [0, 0], V: 0, crit: {} }));
    combs.forEach((cb, k) => {
      const isU = /^ELU/.test(cb.type), isS = cb.type === 'ELS Rare';
      if (!isU && !isS) return;
      const gb = (cb.f[acts.find((a) => a.id === 'pp0')?.id] || [1])[0];
      const gt = (cb.f['terres'] || [0, 0])[1];
      const fr = fond && fond.combs[k];
      let sig = null;
      if (!pieux && fr) { const T = cb.T.tot; const r = FD.repartition({ B, L }, -T[2], T[3], T[4]); sig = (x, y) => Math.max(0, r.a + r.b * x + r.c * y); }
      // efforts des fûts en pied (combinaison « struct »)
      const pieds = fut ? fut.futs.map((F) => { const s0 = F.secs[0]; const row = s0.rows[k]; return { y: F.y, N: row.N, Mx: row.Mx, My: row.My }; }) : [];
      cuts.forEach((ct, m) => {
        let M = 0, V = 0, len = ct.dir === 'x' ? L : B;
        const dd = ep - c;
        for (const q of cells) {
          const u = ct.dir === 'x' ? q.x - ct.v : q.y - ct.v, side = ct.v >= 0 ? u > 0 : u < 0;
          if (!side) continue;
          const p = (sig ? sig(q.x, q.y) : 0) - gb * q.wb - gt * q.wt;
          M += p * q.A * Math.abs(u);
          if (Math.abs(u) >= dd) V += p * q.A;
        }
        if (pieux) {
          fr.piles.forEach((pl, j) => { const P = piles[j]; const u = ct.dir === 'x' ? P.x - ct.v : P.y - ct.v; if (ct.v >= 0 ? u > 0 : u < 0) { M += pl.N * Math.abs(u); if (Math.abs(u) >= dd) V += pl.N; } });
        }
        if (ct.dir === 'y') pieds.forEach((pd) => { const u = pd.y - ct.v; if (ct.v >= 0 ? u > 0 : u < 0) M += -pd.N * Math.abs(u) + (ct.v >= 0 ? 1 : -1) * pd.Mx; });
        M /= len; V /= len;
        const e = env[m], t = isU ? 'ELU' : 'ELS';
        if (M > e[t][0]) { e[t][0] = M; e.crit[t + '+'] = cb.n; }
        if (M < e[t][1]) { e[t][1] = M; e.crit[t + '-'] = cb.n; }
        if (isU && Math.abs(V) > e.V) { e.V = Math.abs(V); e.critV = cb.n; }
      });
    });
    const t = d.regl === 'EC' ? 1 : 1;
    const ssLim = d.regl === 'EC' ? 0.8 * d.mat.fe : (num(d.mat.ssSem) > 0 ? +d.mat.ssSem : mat.ssLim), sbc = 0.6 * d.mat.fck;
    const dd = ep - c, Amin = AminFlex(mat, 1, dd);
    const out = cuts.map((ct, m) => {
      const e = env[m];
      const Ainf = Math.max(dimFlexion(mat, 1, ep, c, e.ELU[0], t) || 0, dimFlexion(mat, 1, ep, c, e.ELS[0], 'ELS', ssLim, sbc) || 0);
      const Asup = Math.max(dimFlexion(mat, 1, ep, c, e.ELU[1], t) || 0, dimFlexion(mat, 1, ep, c, e.ELS[1], 'ELS', ssLim, sbc) || 0);
      const tau = e.V / dd / 1000, tlim = d.regl === 'EC' ? vRdcDalle(d.mat.fck, dd, Ainf) : 0.07 * d.mat.fck / 1.5;   // BAEL A.5.2,2 ; EC2 6.2.2
      return Object.assign({}, ct, { env: e, Ainf, Asup, tau, tlim, okV: tau <= tlim + 1e-9 });
    });
    const dirs = { x: out.filter((o) => o.dir === 'x'), y: out.filter((o) => o.dir === 'y') };
    const mx = (arr, k) => Math.max(0, ...arr.map((o) => o[k]));
    // Fasc. 62 titre V B.4.3 : aciers inférieurs ≥ 1/1000, supérieurs ≥ 0,5/1000 de la section de béton
    const AminInf = Math.max(Amin, 0.001 * ep * 1e4), AminSup = 0.0005 * ep * 1e4;
    return { cuts: out, dd, Amin, AminInf, AminSup, ssLim,
      trans: { inf: Math.max(mx(dirs.x, 'Ainf'), AminInf), sup: Math.max(mx(dirs.x, 'Asup'), AminSup), Mu: mx(dirs.x.map((o) => ({ v: o.env.ELU[0] })), 'v') },
      long: { inf: Math.max(mx(dirs.y, 'Ainf'), AminInf), sup: Math.max(mx(dirs.y, 'Asup'), AminSup), Mu: mx(dirs.y.map((o) => ({ v: o.env.ELU[0] })), 'v') },
      ok: out.every((o) => o.okV) };
  }
  // EC2 6.2.2 (1) : VRd,c (dalle sans armatures d'effort tranchant), MPa, AN : vmin = 0,053/γc k^1,5 fck^0,5 (dalles)
  function vRdcDalle(fck, dd, Asl) { const k = Math.min(2, 1 + Math.sqrt(0.2 / dd)), rho = Math.min(0.02, Asl * 1e-4 / dd); return Math.max(0.18 / 1.5 * k * Math.cbrt(100 * rho * fck), 0.053 / 1.5 * Math.pow(k, 1.5) * Math.sqrt(fck)); }

  /* ══════════════════════ appareils d'appui : pressions localisées, frettage, éclatement ══════════════════════
   * BAEL 91 A.8.4,1 : σ ≤ K·fbu, K = 1 + (3 − 4/3·(a0/a + b0/b))·√((1 − 4a0/(3a))(1 − 4b0/(3b))) ≤ 3,3 ;
   * annexe E.8 (et guide SETRA BAEL ponts) : σb = Pu/(d1 e) ≤ 0,9 fcj ; σte = 0,5(1 − b/d1)Pu/(d1 e) ≤ 1,7 ftj ;
   * As = 0,04 Pu/fsu ; Ae = max(0,25(1 − b/d1), 0,15)·Pu/fsu ; Al = 0,5 Pu/fsu.
   * EC2 §6.7 : FRdu = Ac0·fcd·√(Ac1/Ac0) ≤ 3 fcd Ac0. */
  function frettage(o) {
    const { a0, b0, a, b, Pu, fck, fe, livret, regl, e1, e2, d1, d2 } = o;
    const fbu = 0.85 * fck / 1.5, fsu = fe / 1.15 * (livret ? 0.8 : 1), ftj = 0.6 + 0.06 * fck;
    const K = Math.min(3.3, 1 + (3 - 4 / 3 * (a0 / a + b0 / b)) * Math.sqrt(Math.max(0, (1 - 4 * a0 / (3 * a)) * (1 - 4 * b0 / (3 * b)))));
    const sig = Pu / (a0 * b0) / 1000;
    const fcd = fck / 1.5, Ac0 = a0 * b0, Ac1 = Math.min(a * b, 9 * Ac0), FRdu = Math.min(Ac0 * fcd * Math.sqrt(Ac1 / Ac0), 3 * fcd * Ac0) * 1000;
    const dir = (dd, bb, ee) => ({ d1: dd, sb: Pu / (dd * ee) / 1000, ste: 0.5 * (1 - bb / dd) * Pu / (dd * ee) / 1000, Ae: Math.max(0.25 * (1 - bb / dd), 0.15) * Pu / fsu / 1000 * 1e4 });
    return { K, fbu, sig, sigAdm: K * fbu, okK: regl === 'EC' ? Pu <= FRdu + 1e-6 : sig <= K * fbu + 1e-9, FRdu, fsu,
      As: 0.04 * Pu / fsu / 1000 * 1e4, Al: 0.5 * Pu / fsu / 1000 * 1e4, par: dir(d1, b, e1), perp: dir(d2, a, e2), sbLim: 0.9 * fck, steLim: 1.7 * ftj };
  }
  function calculAppareils(d, G, acts, combs, eff) {
    const ap = d.geo.app; if (!ap || !G.nA) return null;
    let Pu = 0, crit = null, Pels = 0;
    combs.forEach((cb) => {
      const P = G.yA.map(() => 0);
      for (const a of acts) { const co = cb.f[a.id]; if (!co || !a.tab || !eff[a.id] || !eff[a.id].app) continue; eff[a.id].app.forEach((v, k) => (P[k] += co[1] * v)); }
      const m = Math.max(...P);
      if (/^ELU/.test(cb.type) && m > Pu) { Pu = m; crit = cb.n; }
      if (cb.type === 'ELS Rare' && m > Pels) Pels = m;
    });
    // prisme d'éclatement : d1 = min(entraxe des appareils, 2 × distance au bord) dans chaque direction
    const C = G.chev, Lb = C ? C.L : G.dimY, e1 = C ? C.l : G.dimX;
    const ent = G.nA > 1 ? Math.abs(G.yA[1] - G.yA[0]) : Lb, bord = Math.min(...G.yA.map((y) => Lb / 2 - Math.abs(y - (C ? 0 : G.yF[G.futA[G.yA.indexOf(y)]] || 0))));
    const d1 = Math.min(ent, 2 * bord), d2 = Math.min(e1, 2 * (e1 / 2 - Math.abs(num(ap.xApp) + (C ? G.xF - (C.x0 + C.x1) / 2 : 0))));
    const fr = frettage({ a0: ap.a0, b0: ap.b0, a: ap.a, b: ap.b, Pu, fck: d.mat.fck, fe: d.mat.fe, livret: !!d.livret && d.regl !== 'EC', regl: d.regl, e1, e2: Lb, d1, d2 });
    return Object.assign(fr, { Pu, Pels, crit, d1, d2, ok: fr.okK && fr.par.sb <= fr.sbLim && fr.par.ste <= fr.steLim && fr.perp.ste <= fr.steLim });
  }

  /* ══════════════════════ mur garde-grève et murs en retour (méthodes simplifiées) ══════════════════════ */
  function calculGardeGreve(d, G, mat) {
    const gg = d.geo.gg; if (!gg || !(gg.h > 0) || !(gg.e > 0)) return null;
    const K = ka(d.sol.phi, d.sol.delta, d.sol.beta), h = gg.h, sr = surchargeRemblai(d, num(gg.L, d.geo.L));
    const Mt = K * d.sol.gamma * h * h * h / 6, Mq = K * sr.q * Math.min(1, sr.w / num(gg.L, d.geo.L)) * h * h / 2;   // par mètre
    const C = coefs(d), gG = C.G.ELU[0], gq = C.PQ.struct.ELU || 1.5;
    const Mels = Mt + Mq, Melu = gG * Mt + gq * Mq;
    const c = num(d.mat.cChev, 0.04), t = 1, ssLim = d.regl === 'EC' ? 0.8 * d.mat.fe : mat.ssLim;
    const A = Math.max(dimFlexion(mat, 1, gg.e, c, Melu, t) || 0, dimFlexion(mat, 1, gg.e, c, Mels, 'ELS', ssLim, 0.6 * d.mat.fck) || 0, AminFlex(mat, 1, gg.e - c));
    return { K, Mt, Mq, Mels, Melu, A };
  }
  function calculMursRetour(d, G, mat) {
    const r = d.geo.retour; if (!r || !r.actif || !(r.Lr > 0)) return null;
    const K = ka(d.sol.phi, d.sol.delta, d.sol.beta), sr = surchargeRemblai(d, r.Lr);
    // mur suspendu encastré sur l'écran : pression moyenne Ka(γ H/2 + q) sur H × Lr, moment d'encastrement horizontal
    const P = K * (d.sol.gamma * r.Hr / 2 + sr.q) * r.Hr * r.Lr, Mh = P * r.Lr / 2;
    const W = d.mat.gammaB * r.Lr * r.Hr * r.e, Mv = W * r.Lr / 2;     // poids : moment vertical d'encastrement
    const C = coefs(d), gG = C.G.ELU[0];
    const c = num(d.mat.cChev, 0.04);
    const Ah = (dimFlexion(mat, r.Hr, r.e, c, gG * Mh, 1) || 0);               // aciers horizontaux (face intérieure), total sur H
    const Av = (dimFlexion(mat, r.e, r.Hr, c, gG * Mv, 1) || 0);               // aciers en tête (flexion verticale)
    return { K, P, Mh, W, Mv, Ah, AhMl: Ah / r.Hr, Av };
  }

  /* ══════════════════════ calcul complet ══════════════════════ */
  function calc(d0, opt = {}) {
    const d = JSON.parse(JSON.stringify(d0));
    if (!d.geo || !d.geo.fut) throw new Error('Géométrie de l’appui incomplète.');
    if (d.fond && d.fond.type === 'chevpieux') { d.geo.fut.n = 0; d.fond.type = 'pieux'; }
    const G = geometrie(d), alertes = [];
    if (G.nF && G.hF <= 0) throw new Error('Hauteur des fûts nulle ou négative : vérifier les niveaux.');
    if (G.nF > 1 && G.nF * G.dimY > d.geo.L + 1e-6) alertes.push('Les fûts débordent de la semelle suivant Y.');
    const propres = actionsPropres(d, G), tab = actionsTablier(d, G);
    const acts = propres.concat(tab);
    const C = combinaisons(d, acts);
    const Dz = G.Dz, butee = d.type === 'culee' && !!d.sol.butee;
    if (butee) acts.forEach((a) => { if (a.poteau) a.fondExclu = true; });
    const Q = [0, 0, d.geo.zBase];
    C.list.forEach((cb) => { cb.T = torseurFond(acts, cb, Q, { butee, Dz }); });
    // fondation
    let fond = null;
    try { fond = fondation(d, G, C.list, opt.sps || d.sps || null); } catch (e) { alertes.push(e.message); }
    // éléments
    const mat = materiaux(d);
    const M = modeleTransversal(d, G);
    const { eff, zs } = effetsElements(d, G, acts, M);
    const futs = calculFuts(d, G, acts, C.list, eff, zs, mat);
    const chev = calculChevetre(d, G, acts, C.list, eff, mat);
    let sem = null;
    try { sem = calculSemelle(d, G, acts, C.list, futs, fond, mat); } catch (e) { alertes.push('Semelle : ' + e.message); }
    const app = calculAppareils(d, G, acts, C.list, eff);
    const gg = calculGardeGreve(d, G, mat), retour = calculMursRetour(d, G, mat);
    const mo = propres.mo || (propres.find((a) => a.cat === 'EP') ? null : null);
    const sis = d.sismique && d.sismique.actif ? sismeParams(d) : null;
    if (sis && d.type !== 'pile') sis.mo = mononobe(d.sol.phi, d.sol.delta, sis.kh, sis.kv);
    const verdicts = [
      { el: 'Fondation', ok: fond ? !!(fond.synth && fond.synth.ok) : false },
      futs ? { el: 'Fûts', ok: futs.ok } : null,
      chev ? { el: 'Chevêtre', ok: chev.ok } : null,
      sem ? { el: 'Semelle', ok: sem.ok } : null,
      app ? { el: 'Appareils (pressions localisées)', ok: app.ok } : null,
    ].filter(Boolean);
    return { d, G, acts, combs: C.list, coefs: C.K, Ka: ka(d.sol.phi, d.sol.delta, d.sol.beta), fond, futs, chev, sem, app, gg, retour, sis, mat, alertes, verdicts, butee, Dz,
      ok: verdicts.every((v) => v.ok) };
  }

  /* ══════════════════════ imports ══════════════════════ */
  /* fichiers d'appui exportés par REPHOR (format 'BA.rephor.appui') : efforts horizontaux en tête (HX, HY), repère appui */
  function depuisRephor(j) {
    if (!j || j.format !== 'BA.rephor.appui') throw new Error('Fichier non reconnu (format BA.rephor.appui attendu).');
    const out = [], map = { retrait: 'R', dilatation: 'Td', contraction: 'Tc', freinage: 'F', interaction: 'F' };
    for (const a of j.actions || []) {
      const cat = map[a.id]; if (!cat) continue;
      out.push({ nom: a.nom + ' (REPHOR)', cat, qt: cat === 'F' ? '*' : '', HX: +(a.HX || 0).toFixed(2), HY: +(a.HY || 0).toFixed(2), cd: cat === 'R' ? 0 : undefined });
    }
    return { actions: out, biais: j.biais_gr, repereTablier: false, nom: j.nom };
  }
  /* descentes de charges RADBAN-RAPEN ('BA.radbanRapen.appui') et RODBAN-ROPEN ('BA.rodbanRopen.appui') :
   * réactions positives vers le haut → V = −R ; groupes de charges maxi / mini. */
  function depuisTablier(j) {
    const out = [];
    const mm = (nom, cat, o, qt) => { if (!o) return; out.push({ nom: nom + ' maxi', cat, qt, etatG: 'max', V: -(+o.max) }); if (Math.abs(+o.min) > 1e-9) out.push({ nom: nom + ' mini', cat, qt, etatG: 'min', V: -(+o.min) }); };
    if (j && j.format === 'BA.radbanRapen.appui') {
      const g = j.global || {};
      out.push({ nom: 'G tablier maxi (RADBAN-RAPEN)', cat: 'Gmax', V: -((g.pp || 0) + (g.superstructuresMax || 0)) });
      out.push({ nom: 'G tablier mini (RADBAN-RAPEN)', cat: 'Gmin', V: -((g.pp || 0) + (g.superstructuresMin || 0)) });
      mm('Groupe gr12 (LM71/SW0)', 'Q', g.gr12, 'rail'); mm('Groupe gr14 (SW/2)', 'Q', g.gr14, 'sw2'); mm('Accotements', 'QT', g.accotements, '');
      return { actions: out, biais: j.biais_gr, ouvrage: 'rail', repereTablier: true, nom: j.nom };
    }
    if (j && j.format === 'BA.rodbanRopen.appui') {
      const l = j.ligne || {};
      out.push({ nom: 'G tablier maxi (RODBAN-ROPEN)', cat: 'Gmax', V: -(+(l.G || {}).max || 0) });
      out.push({ nom: 'G tablier mini (RODBAN-ROPEN)', cat: 'Gmin', V: -(+(l.G || {}).min || 0) });
      Object.entries(l.charges || {}).forEach(([k, v]) => mm(k + ' (RODBAN-ROPEN)', /trot/i.test(k) ? 'QT' : 'Q', v, /A/.test(k) && !/B/.test(k) ? 'A' : 'B'));
      return { actions: out, biais: j.biais_gr, ouvrage: 'route', repereTablier: true, nom: j.nom };
    }
    throw new Error('Fichier non reconnu (formats BA.radbanRapen.appui ou BA.rodbanRopen.appui attendus).');
  }

  /* fichier de données .don d'origine (format « mot-clé ; commentaire » puis valeur) */
  function parseDon(text) {
    const L = String(text).replace(/\r\n?/g, '\n').split('\n'), kv = {};
    for (let i = 0; i < L.length; i++) {
      const s = L[i]; if (/^FIN_DICO/.test(s.trim())) break;
      if (!s || s[0] === ';' || s.indexOf(';') < 0) continue;
      const k = s.slice(0, s.indexOf(';')).trim().toLowerCase(); if (!k || /\s/.test(k)) continue;
      kv[k] = (L[i + 1] || '').trim(); i++;
    }
    const n = (k, def = 0) => { const v = parseFloat(String(kv[k] || '').replace(',', '.')); return Number.isFinite(v) ? v : def; };
    const vec = (k) => String(kv[k] || '').trim().split(/\s+/).map((v) => parseFloat(v)).map((v) => (Number.isFinite(v) ? v : 0));
    const d = exemple('culee');
    const ta = Math.round(n('typeappui', 0)), pra = Math.round(n('pra', 0)), tf = Math.round(n('typefond', 0));
    d.projet = [kv.projet, kv.commentaire].filter(Boolean).join(' — ');
    d.type = ta === 0 ? 'pile' : ta === 1 ? 'culee' : 'mur';
    d.ouvrage = pra === 0 ? 'route' : 'rail'; d.nVoies = Math.max(1, Math.round(n('nbvoipra', 1)));
    d.regl = Math.round(n('reglement', 0)) === 1 ? 'EC' : 'ANC';
    d.livret = n('patrimoinesncf', 0) === 1 || pra > 0;
    const biais = n('biais', 100);
    d.biais = d.type !== 'pile' && Math.round(n('numappui', 0)) === 0 ? 200 - biais : biais;
    const zb = n('zbasem'), ep = n('epsem'), zsc = n('zsousche'), hap = n('hap'), hb = n('happapp'), hch = n('hauche');
    const rond = n('larfut', 0) === 0, nF = Math.round(n('nbfut', 1));
    const hF = zsc > 0 ? zsc - zb - ep : hap - hb - ep - hch;
    d.geo = Object.assign(d.geo, {
      zBase: zb, ep, B: n('larsem'), L: n('lonsem'), talon: n('lartal'), exF: 0,
      fut: { forme: rond ? 'rond' : 'rect', n: nF, D: n('epfutb'), b: n('larfut') || n('epfutb'), e: n('epfutb'), entraxe: n('eaxefut'), h: hF },
      chev: { actif: hch > 0, L: n('lonche'), l: n('larche'), h: hch, xArr: n('disarche'), hpm: n('hpetitemuretteche'), lpm: n('lpetitemuretteche') },
      gg: { h: n('haumugg'), e: n('epmugg'), L: n('lonmugg') },
      retour: { actif: n('mursretour', 0) > 0 && n('lonret') > 0, Lr: n('lonret'), Hr: n('hret'), e: n('epret', 0.3) },
      app: { n: Math.round(n('nbappapp', 1)), e: n('eaxeappfut'), xApp: n('eaxeappapp'), a0: n('largappapp'), b0: n('longappapp'), a: n('largbossage'), b: n('longbossage'), hb, hApp: n('hautappapp') },
      zdef: n('zdef'), zAvant: n('zpassage') || n('zdef'), ztn: n('ztn'), zeau: n('zeau', -1000),
    });
    d.sol = Object.assign(d.sol, { gamma: n('poivolter', 19), gammaSat: n('poivoltersat', 21), phi: n('angfrot', 35), qRoute: n('surchrembpro', 10), qRail: n('surchremb1voiepra', 150), butee: d.type === 'culee' });
    d.mat = Object.assign(d.mat, { gammaB: n('poivolbet', 25), fck: n('fcj', 32), fe: n('fe', 500), fiss: Math.max(0, Math.round(n('fissur', 2)) - 1), cSem: n('enrobpleinfouil', 0.03) + 0.025, cFut: n('enrobvoil', 0.035) + 0.03, cChev: n('enrobautre', 0.03) + 0.02, ssFut: n('limitefissur', 0) });
    d.fond = Object.assign(d.fond, {
      type: tf === 0 ? 'sup' : tf <= 2 ? 'semi' : tf === 3 ? 'pieux' : 'chevpieux', mode: n('paramgeotech', 0) === 1 ? 'saisie' : 'sps',
      qu: n('qu', 1), De: n('de', 0), kv: n('kvdif', 10), rapSol: n('rapmodsol', 2), phi: n('phifond', 30), c: n('cohesionfond', 0), sol: n('typesolfrot', 1) ? 'frottant' : 'coherent',
      massif: { B: n('lfond'), L: n('dfond'), h: Math.max(0, zb - n('zfond', zb)) },
      pieux: { type: Math.max(1, Math.round(n('typepieu', 2))), D: n('dfond', 1), Lp: Math.max(0, zb - n('zfond', zb)) || 12, nFiles: Math.round(n('nbfile', 1)), nParFile: Math.round(n('nbfond', 1)), eFile: n('entraxefile'), ePieu: n('entraxepieu'), enrob: n('distacierpieu', 0.09) },
    });
    d.spsNom = kv.nomficsps || '';
    // actions du tablier (pont-route) : deux positions transversales p1, p2 (ligne « …d ») ; la seconde est retenue
    const A = [];
    const add = (k, nom, cat, extra = {}) => {
      const v = vec(k + 'c'); if (!v.length || v.every((x) => x === 0)) return;
      const pos = vec(k + 'd'), p1 = pos[0] || 0, p2 = pos[1] || 0;
      const o = Object.assign({ nom, cat, V: v[0], HX: v[1], HY: v[2], MX: v[3], MY: v[4], dy: p2 }, extra);
      if (cat === 'Q' && Math.abs(p1 - p2) > 1e-6 && Math.abs(p1) > 1e-6) { A.push(Object.assign({}, o, { nom: nom + ' (dY+)' })); A.push(Object.assign({}, o, { nom: nom + ' (dY−)', dy: p1 })); }
      else A.push(Object.assign(o, { dy: Math.abs(p2) > 1e-9 ? p2 : p1 }));
    };
    add('gmax', 'C.P. tablier maxi', 'Gmax'); add('gmin', 'C.P. tablier mini', 'Gmin'); add('retrait', 'Retrait', 'R');
    add('gamoviblemax', 'Charges amovibles maxi', 'Gmax'); add('gamoviblemin', 'Charges amovibles mini', 'Gmin');
    if (d.ouvrage === 'route') {
      add('qamax', 'A(l) maxi', 'Q', { qt: 'A', etatG: 'max' }); add('qamin', 'A(l) mini', 'Q', { qt: 'A', etatG: 'min' }); add('freinmaxqa', 'Freinage A(l)', 'F', { qt: 'A' });
      add('qbtmax', 'Bt maxi', 'Q', { qt: 'B', etatG: 'max' }); add('qbtmin', 'Bt mini', 'Q', { qt: 'B', etatG: 'min' });
      add('qbcmax', 'Bc maxi', 'Q', { qt: 'B', etatG: 'max' }); add('qbcmin', 'Bc mini', 'Q', { qt: 'B', etatG: 'min' }); add('freinmaxqbc', 'Freinage Bc', 'F', { qt: 'B' });
      add('qmmax', 'Convoi militaire maxi', 'Q', { qt: 'M', etatG: 'max' }); add('qmmin', 'Convoi militaire mini', 'Q', { qt: 'M', etatG: 'min' });
      add('qecmax', 'Convoi exceptionnel C maxi', 'Q', { qt: 'E', etatG: 'max' }); add('qecmin', 'Convoi exceptionnel C mini', 'Q', { qt: 'E', etatG: 'min' });
      add('qemax', 'Convoi exceptionnel D/E maxi', 'Q', { qt: 'E', etatG: 'max' }); add('qemin', 'Convoi exceptionnel D/E mini', 'Q', { qt: 'E', etatG: 'min' });
      add('qtrotmaxg', 'Trottoir gauche maxi', 'QT', { etatG: 'max' }); add('qtrotmaxd', 'Trottoir droit maxi', 'QT', { etatG: 'max' });
      add('qtrotming', 'Trottoir gauche mini', 'QT', { etatG: 'min' }); add('qtrotmind', 'Trottoir droit mini', 'QT', { etatG: 'min' });
      const dxDT = -(n('disarche') + n('eaxeappapp'));
      add('gdaltr', 'C.P. dalle de transition', 'GD', { dx: dxDT }); add('qdaltr', 'Surcharge dalle de transition', 'QD', { dx: dxDT });
    } else {
      const nv = Math.max(1, d.nVoies);
      add('quicsw0max', 'UIC71-SW/0 maxi (1 voie)', 'Q', { qt: 'rail', etatG: 'max' }); add('quicsw0min', 'UIC71-SW/0 mini (1 voie)', 'Q', { qt: 'rail', etatG: 'min' });
      add('freinmaxuicsw0', 'Freinage UIC71-SW/0 (1 voie)', 'F', { qt: 'rail' }); add('demmaxuicsw0', 'Démarrage UIC71-SW/0 (1 voie)', 'F', { qt: 'rail' });
      add('qsw2max', 'SW/2 maxi (1 voie)', 'Q', { qt: 'sw2', etatG: 'max' }); add('qsw2min', 'SW/2 mini (1 voie)', 'Q', { qt: 'sw2', etatG: 'min' });
      add('freinmaxsw2', 'Freinage SW/2 (1 voie)', 'F', { qt: 'sw2' });
      A.forEach((a) => { if ((a.cat === 'Q' || a.cat === 'F') && nv > 1) { a.nom = a.nom.replace('(1 voie)', `(${nv} voies)`); for (const k of ['V', 'HX', 'HY', 'MX', 'MY']) a[k] *= nv; } });
      // freinage et démarrage ne se cumulent pas : on garde le plus fort
      const fr = A.filter((a) => a.cat === 'F' && a.qt === 'rail'); if (fr.length > 1) { const keep = fr.reduce((m, a) => (Math.abs(a.HX) > Math.abs(m.HX) ? a : m)); fr.forEach((a) => { if (a !== keep) A.splice(A.indexOf(a), 1); }); }
    }
    add('venth', 'Vent', 'W'); add('dilath', 'Dilatation', 'Td'); add('contrh', 'Contraction', 'Tc');
    add('seismlongelas', 'Séisme longitudinal (tablier)', 'EX'); add('seismtranelas', 'Séisme transversal (tablier)', 'EY');
    d.actions = A;
    d.sismique = Object.assign(d.sismique, { actif: A.some((a) => a.cat === 'EX' || a.cat === 'EY') && n('zonseism', 0) > 0 });
    d.avert = [];
    if (d.fond.mode === 'sps') d.avert.push('Fondation calculée sur sondage : charger le fichier ' + (d.spsNom.split(/[\\/]/).pop() || '.sps') + '.');
    if (n('choc', 0) || n('chocpile', 0)) d.avert.push('Choc saisi dans le fichier d’origine : renseigner Fdx, Fdy et la hauteur dans le module.');
    if (n('hauplaqremb') > 0) d.avert.push('Plaques de remblaiement non modélisées (poussée sur les plaques ignorée).');
    if (n('epfuth') && Math.abs(n('epfuth') - n('epfutb')) > 1e-6) d.avert.push('Fûts d’épaisseur variable : épaisseur de base retenue sur toute la hauteur.');
    return d;
  }

  const api = { exemple, geometrie, ka, kAE, mononobe, actionsPropres, actionsTablier, combinaisons, coefs, transport, torseurFond, fondSaisie, frettage,
    sismeParams, surchargeRemblai, zonesPoussee, calc, parseDon, depuisRephor, depuisTablier, pieuxPlan, dimFlexion };
  if (isNode) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.appui = api; }
})(typeof window !== 'undefined' ? window : globalThis);
