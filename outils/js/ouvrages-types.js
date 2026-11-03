/* OUVRAGES TYPES — calcul et dessin automatiques des ouvrages types de ponts-rails et de ponts-routes
 * (moteur pur, aucun DOM ; node → module.exports, navigateur → window.BA.ouvragesTypes).
 *
 * Ce module ENCHAÎNE les modules de parties d'ouvrage sans réécrire leurs calculs :
 *   tablier          BA.tablierRail (RADBAn, RAPEn) — BA.tablierRoute (RODBAn, ROPEn) dès que son module est validé ;
 *   efforts horizontaux et appareils d'appui   BA.horizontal (répartition) qui appelle BA.elastomeres (dimensionnement EN 1337-3) ;
 *   cadres et portiques                         BA.cadres (RACBA, RAPO) ;
 *   fondations       BA.fondations (Fascicule 62 titre V) sur le sondage pressiométrique BA.sondages (.sps).
 * Les piles et culées (module APPUI) sont en cours de développement : en attendant, le module établit une DESCENTE DE
 * CHARGES SOMMAIRE jusqu'à la sous-face des semelles (réactions du tablier, efforts horizontaux de REPHOR, poids propres
 * calculés sur la géométrie, terres sur les semelles, poussée des terres de Rankine sur les culées) pour vérifier les
 * fondations avec FONDATIO. Les fûts, murs et semelles ne sont pas justifiés en béton armé (aciers par ratio forfaitaire
 * dans l'avant-métré, signalé comme tel).
 *
 * Références propres à ce module (le reste relève des modules appelés, voir leurs en-têtes) :
 *  - poussée des terres : Rankine, Ka = tan²(π/4 − φ/2) (EN 1997-1 annexe C, écran vertical lisse, terre-plein horizontal) ;
 *  - charge ferroviaire sur remblai : EN 1991-2 §6.3.6.4, LM71 réparti sur 3,00 m de largeur, soit α·4·250/(6,40·3,00)
 *    = 52,1 kN/m² par voie (la part « wagons » 80 kN/m, plus faible, n'est pas retenue séparément) ;
 *  - combinaisons de la descente de charges : EN 1990 annexe A2 / Livret 2.01 (ELU : 1,35 G + 1,45 Q trafic ferroviaire ;
 *    poussée des terres γ = 1,35 ; ELS caractéristique G + Q ; quasi permanent G + ψ2 T), efforts horizontaux de REPHOR
 *    pris avec leurs propres combinaisons (ELU1, ELS1, QP) ;
 *  - gabarits : hauteur libre et largeur libre comparées aux valeurs requises saisies (gabarit routier ou ferroviaire de la
 *    voie franchie) : la géométrie est linéaire par morceaux, le minimum est cherché aux sommets de l'emprise du gabarit.
 *
 * Repère : x le long de l'axe de l'ouvrage depuis l'axe de la culée C0 (appareils d'appui), y transversal (à gauche > 0),
 * z cote NGF ; biais φ en grades (100 = ouvrage droit), une ligne d'appui fait l'angle φ avec l'axe.
 * Unités : kN, m, kPa ; MPa pour les matériaux ; aciers en kg.
 */
(function (root) {
  'use strict';
  const NODE = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  const opt = (file, name) => { try { return NODE ? require('./' + file) : (root.BA && root.BA[name]) || null; } catch (e) { return null; } };
  const mod = {
    radban: () => opt('tablier-rail.js', 'tablierRail'), rodban: () => opt('tablier-route.js', 'tablierRoute'), rephor: () => opt('efforts-horizontaux.js', 'horizontal'), appmobil: () => opt('elastomeres.js', 'elastomeres'),
    fondatio: () => opt('fondations.js', 'fondations'), sondpres: () => opt('sondages.js', 'sondages'), racba: () => opt('cadres-portiques.js', 'cadres'),
  };
  const GR = Math.PI / 200, HRAIL = 0.172, HTRAV = 0.23, ACIER = 7850;
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const r3 = (v) => Math.round(v * 1000) / 1000;

  /* ── modules encore en développement : activés seulement quand leurs tests (tools/test-outils-<slug>.js) passent ── */
  const EN_COURS = {
    rodbanRopen: { pret: true, code: 'TABLIER ROUTE', page: 'tablier-route' },
    appui: { pret: false, code: 'PILES-CULÉES', page: 'piles-culees' },
  };
  /* pages des modules (liens « Ouvrir dans le module ») : clé de sauvegarde BA.store → page et code affiché */
  const MODULES = {
    'tablier-rail': { page: 'tablier-rail.html', code: 'TABLIER RAIL' }, 'tablier-route': { page: 'tablier-route.html', code: 'TABLIER ROUTE' },
    'efforts-horizontaux': { page: 'efforts-horizontaux.html', code: 'HORIZONTAL' }, 'appareils-appui': { page: 'appareils-appui.html', code: 'ÉLASTOMÈRES' },
    fondations: { page: 'fondations.html', code: 'FONDATIONS' }, 'cadres-portiques': { page: 'cadres-portiques.html', code: 'CADRES' },
    'sondages-pressio': { page: 'sondages-pressio.html', code: 'PRESSIO' }, appui: { page: 'piles-culees.html', code: 'PILES-CULÉES' },
  };

  /* ═══════════════════════ 1. Types d'ouvrages et données par défaut ═══════════════════════ */
  const TYPES = {
    radba: { nom: 'Pont-rail dalle BA', desc: 'tablier en dalle béton armé, 1 à 7 travées', famille: 'tablier', ouvrage: 'rail', module: 'tablier-rail', requis: [] },
    rapen: { nom: 'Pont-rail poutrelles enrobées', desc: 'tablier à poutrelles enrobées, 1 à 7 travées', famille: 'tablier', ouvrage: 'rail', module: 'tablier-rail', requis: [] },
    rodba: { nom: 'Pont-route dalle BA', desc: 'tablier en dalle béton armé, 1 à 7 travées', famille: 'tablier', ouvrage: 'route', module: 'tablier-route', requis: ['rodbanRopen'] },
    ropen: { nom: 'Pont-route poutrelles enrobées', desc: 'tablier à poutrelles enrobées, 1 à 7 travées', famille: 'tablier', ouvrage: 'route', module: 'tablier-route', requis: ['rodbanRopen'] },
    racba: { nom: 'Cadre fermé pont-rail', desc: 'cadre en béton armé sous voies ferrées, ouverture 1 à 15 m', famille: 'cadre', ouvrage: 'rail', module: 'cadres-portiques', requis: [] },
    rapo: { nom: 'Portique ouvert pont-rail', desc: 'portique en béton armé sur semelles, portée 5 à 25 m', famille: 'cadre', ouvrage: 'rail', module: 'cadres-portiques', requis: [] },
  };
  function disponible(type) {
    const t = TYPES[type]; if (!t) return { ok: false, msg: 'Type d’ouvrage inconnu.' };
    const manque = t.requis.filter((k) => !EN_COURS[k].pret || !(k === 'rodbanRopen' ? mod.rodban() : null));
    if (manque.length) return { ok: false, msg: `${t.nom} : bientôt disponible (module ${manque.map((k) => EN_COURS[k].code).join(', ')} en cours de validation).` };
    return { ok: true };
  }

  function defaut(type = 'radba') {
    const s = {
      type, projet: '', regl: 'livret',
      travees: [14, 20, 14], biais: 90, nVoies: 2, entraxe: 4.8, Btot: 11.88,
      zRail0: 106.90, pente: 0, zTN: 100,
      gab: { type: 'route', travee: 2, zObs: 100, H: 4.75, W: 9.0, dec: 0 },
      imp: { E0: 0, N0: 0, gis: 100 },
      tab: {},
      app: { appuiFixe: 1, hApp: 0.25, fck: 32,
        pile: { nfut: 1, larfut: 0, e: 0.8 },
        culee: { ef: 1.3, eGG: 0.3, joint: 0.05, lr: 3.0, er: 0.5, patin: 1.5, talon: 4.0, phi: 30, gamma: 20 } },
      fond: { type: 'sup', ancrage: 4.5, es: 1.2, debord: 2.0, pieux: { ptype: 2, D: 1.0, L: 12, nx: 2, ny: 4, ex: 3.0, ey: 3.0 } },
      cad: {}, sps: null,
    };
    if (type === 'radba') { s.projet = 'Pont-rail dalle BA — 3 travées 14 + 20 + 14 m'; s.tab = { h: 1.15 }; }
    if (type === 'rapen') { s.projet = 'Pont-rail poutrelles enrobées — 3 travées 15 + 25 + 15 m'; s.travees = [15, 25, 15]; s.tab = { profil: 'HEA 1000', nPout: 14 }; s.zRail0 = 106.90; }
    if (type === 'rodba' || type === 'ropen') {
      s.projet = (type === 'rodba' ? 'Pont-route dalle BA' : 'Pont-route poutrelles enrobées') + ' — 3 travées 11,27 + 15,06 + 11,27 m'; s.travees = [11.27, 15.06, 11.27];
      s.Btot = 9.06; s.nVoies = 2; s.zRail0 = 106.90; s.tab = {}; s.app.culee.gamma = 20;
      s.gab = { type: 'rail', travee: 2, zObs: 100, H: 6.0, W: 8.0, dec: 0 };
    }
    if (type === 'racba') {
      s.projet = 'Cadre fermé pont-rail — ouverture 5,00 m sous 2 voies'; s.travees = []; s.Btot = 11.88; s.zRail0 = 106.60;
      s.gab = { type: 'route', travee: 1, zObs: 100, H: 3.5, W: 4.0, dec: 0 };
      s.cad = { ouv: 5, hauint: 4, eptra: 0.5, eppied: 0.5, eprad: 0.5, haugousup: 0.2, longousup: 0.3, haugouinf: 0.2, longouinf: 0.8, hauterint: 0, epbal: 0.68, hautraverse: 0.23, surlong: 1.0 };
      s.fond.type = 'sup';
    }
    if (type === 'rapo') {
      s.projet = 'Portique ouvert pont-rail — portée 8,00 m'; s.travees = []; s.Btot = 11.88; s.zRail0 = 105.15; s.zTN = 96.5;
      s.gab = { type: 'route', travee: 1, zObs: 96.5, H: 4.75, W: 7.0, dec: 0 };   // route en déblai : semelles dans les sables
      s.cad = { ouv: 8, hauint: 8, eptra: 0.65, eppied: 0.65, hausem: 1.2, larpat: 2.0, lartal: 3.0, haugousup: 0.3, longousup: 1.0, hauterint: 1, epbal: 0.6, hautraverse: 0.2, surlong: 1.0 };
    }
    return s;
  }
  function normaliser(s0) {
    const b = defaut(s0.type || 'radba'), s = Object.assign({}, b, clone(s0));
    for (const k of ['gab', 'imp', 'fond', 'app']) s[k] = Object.assign({}, b[k], s[k] || {});
    s.app.pile = Object.assign({}, b.app.pile, (s0.app || {}).pile || {});
    s.app.culee = Object.assign({}, b.app.culee, (s0.app || {}).culee || {});
    s.fond.pieux = Object.assign({}, b.fond.pieux, (s0.fond || {}).pieux || {});
    s.tab = Object.assign({}, s0.tab || b.tab);
    s.cad = Object.assign({}, b.cad, s0.cad || {});
    s.travees = (s.travees || []).map(Number).filter((L) => L > 0);
    s.nVoies = Math.max(1, Math.min(2, Math.round(+s.nVoies || 1)));
    if (!(s.biais >= 70 && s.biais <= 130)) throw new Error('Biais compris entre 70 et 130 grades (domaine du calcul en poutre et des cadres).');
    if (TYPES[s.type].famille === 'tablier' && (s.travees.length < 1 || s.travees.length > 7)) throw new Error('Un ouvrage type à tablier compte de 1 à 7 travées.');
    if (!(s.Btot > 0)) throw new Error('Largeur du tablier non valide.');
    return s;
  }

  /* ═══════════════════════ 2. Saisies transmises aux modules ═══════════════════════ */
  /* Tablier RADBAN-RAPEN : jeu par défaut du module complété par les données de l'ouvrage (géométrie générale, voies)
   * et les données propres saisies (s.tab). Les positions des appareils du jeu par défaut ne sont conservées que si la
   * largeur est inchangée ; sinon répartition régulière. */
  function tablierInput(s) {
    if (TYPES[s.type].ouvrage === 'route') return tablierInputRoute(s);
    const RB = mod.radban(), base = clone(s.type === 'rapen' ? RB.DEF_RAPEN : RB.DEF_RADBA);
    const d = Object.assign(base, clone(s.tab || {}));
    const e = +s.entraxe || 0;
    Object.assign(d, { type: s.type, projet: s.projet, regl: s.regl, travees: s.travees.slice(), biais: s.biais, Btot: s.Btot,
      nVoies: s.nVoies, nCharge: s.nVoies, eV: s.nVoies === 2 ? [-e / 2, e / 2] : [0, 0], appuiFixe: Math.round(+s.app.appuiFixe || 0) });
    if (!(s.tab && s.tab.appuis)) d.appuis = Math.abs(s.Btot - base.Btot) < 1e-9 ? base.appuis : { nCulee: base.appuis.nCulee, nPile: base.appuis.nPile, y: null };
    if (d.type === 'radba' && !(s.tab && s.tab.dInf)) d.dInf = +(d.h - 0.06).toFixed(4);
    return d;
  }
  /* Tablier TABLIER ROUTE (rodban-ropen) : référentiel « livret » de l'ouvrage → calcul en poutre, charges du Fascicule 61
   * titre II, BAEL ; « ec » → calcul en plaque, EN 1991-2 + EN 1992. Largeur : la chaussée absorbe l'écart avec le profil
   * en travers par défaut (rives et trottoirs conservés) ; appareils répartis régulièrement sous la sous-face si la largeur change. */
  function tablierInputRoute(s) {
    const RO = mod.rodban(), base = clone(s.type === 'ropen' ? RO.DEF_ROPEN : RO.DEF_RODBA);
    const d = Object.assign(base, clone(s.tab || {}));
    d.trans = Object.assign({}, base.trans, (s.tab || {}).trans || {});
    Object.assign(d, { type: s.type, projet: s.projet, travees: s.travees.slice(), biais: s.biais, biaisApp: null });
    if (!(s.tab && s.tab.methode)) d.methode = s.regl === 'ec' ? 'plaque' : 'poutre';
    if (!(s.tab && s.tab.regl)) d.regl = s.regl === 'ec' ? 'ec' : 'bael';
    // raccourcis de la saisie de l'assistant : épaisseur, profilé et nombre de poutrelles
    const tb = s.tab || {};
    if (+tb.hDalle > 0) d.trans.h = +tb.hDalle;
    if (d.type === 'ropen') { d.ropen = Object.assign({}, base.ropen || {}, d.ropen || {}); if (tb.profil) d.ropen.profil = tb.profil; if (+tb.nPout > 0) d.ropen.n = Math.round(+tb.nPout); }
    ['hDalle', 'profil', 'nPout'].forEach((k) => delete d[k]);
    const t = d.trans, B0 = t.dG + t.tG + t.lc + t.tD + t.dD, dB = s.Btot - B0;
    if (Math.abs(dB) > 1e-9 && !((s.tab || {}).trans)) {
      t.lc = +(t.lc + dB).toFixed(4); t.Bs = +(t.Bs + dB).toFixed(4);
      if (!(t.lc >= 3)) throw new Error('Largeur du tablier trop faible pour une chaussée de 3 m avec les trottoirs du profil en travers par défaut.');
      if (!(s.tab && s.tab.appareils)) {
        const lcg = (s.Btot - t.Bs) / 2, n = d.type === 'ropen' ? 0 : 4;
        d.appareils = n ? { yC: Array.from({ length: n }, (_, k) => r3(lcg + t.Bs * (k + 0.5) / n)), yP: Array.from({ length: n }, (_, k) => r3(lcg + t.Bs * (k + 0.5) / n)), kv: 0 } : { yC: null, yP: null, kv: 0 };
      }
    }
    return d;
  }
  /* Vue commune des deux moteurs de tablier : largeur, hauteurs, réactions par file (convention de leurs exports REPHOR),
   * profil de la coupe (top : au-dessus de l'extrados de rive, bot : sous l'extrados de rive), voies ou chaussée. */
  function adapter(R) {
    const T = R.tab, d = T.d;
    if (R.t.ouvrage !== 'route') {
      const rapen = d.type === 'rapen', B = d.Btot;
      const top = (y) => { if (rapen) return T.pe.H - d.h; const u = Math.min(y + B / 2, B / 2 - y); return u > d.dRebord ? d.penteExt * (u - d.dRebord) : 0; };
      const bot = (y) => { if (rapen) return d.h; const u = Math.min(y + B / 2, B / 2 - y); return u < d.lc ? Math.min(d.h, d.er + d.penteC * u) : d.h; };
      const al = +d.alpha || 1;
      return { route: false, d, B, cg: d.cg, cd: d.cd, hT: rapen ? T.pe.H : T.g.hAxe, hRive: d.h, hV: (+d.hb || 0) + HTRAV + HRAIL, hb: +d.hb || 0, top, bot,
        app: T.app.map((a) => ({ nom: a.nom, culee: a.culee, n: a.n, y: a.y.slice(), Gk: a.R.pp + a.R.supMax + a.R.den.max, GkMin: a.R.pp + a.R.supMin, Q: Math.max(a.R.A.max, a.R.B.max) + 0.8 * a.R.acc.max })),
        voies: d.eV.slice(0, d.nVoies), gQ: 1.45, qRemblai: al * 4 * 250 / (6.4 * 3.0), largeurQ: d.nVoies * 3.0, cRemblai: 'EN 1991-2 §6.3.6.4 : LM71 réparti sur 3,00 m par voie' };
    }
    const G = T.G, ropen = d.type === 'ropen';
    return { route: true, d, B: G.B, cg: d.cg, cd: d.cd, hT: G.h, hRive: G.h, hV: 0.09, hb: 0, top: () => 0, bot: (y) => G.ep(G.yc - y),
      app: T.app.map((a) => ({ nom: a.nom, culee: a.culee, n: a.n, y: a.bear.map((b) => r3(G.yc - b.y)), Gk: a.ligne.c.Gk.max, GkMin: a.ligne.c.Gk.min, Q: a.ligne.c.Q.max })),
      voies: [G.yc - G.chaussee[0], G.yc - G.chaussee[1]], gQ: T.regime === 'f61' ? 1.6 : 1.35, qRemblai: 10, largeurQ: G.lch, ropen,
      cRemblai: 'surcharge conventionnelle de 10 kN/m² sur la chaussée (dossier pilote PP 73)' };
  }
  /* valeurs par défaut de la page REPHOR (formulaire), reprises pour l'enchaînement et pour « Ouvrir dans REPHOR » */
  const REPHOR_V = {
    Emode: 'bael', fck: 32, phi: 2, kbutLong: 1.825, kbutTran: 2.54, Gld: 0.9, Gcd: 1.8, modeApp: 'dim', reglApp: 'en1337', sigLim: 15, alpha0: 0.003, mu: 0.05, hvMax: 0.25,
    retraitMode: 'saisi', epsRetrait: 0.0002, fckTab: 35, RH: 70, h0: 500, ciment: 'N', alphaT: 0.00001, dTdil: 35, dTcon: 35, dTcd: 10,
    alpha: 1, xi: 0.5, nVoiesFrein: 2, sw2: true, interaction: true, qInter: 8, appDilatVoie: 0, thetaExt: 0, eExt: 0,
    classeTrafic: 1, reglRoute: 'en', lch: 7, classeF61: 1, gQ: 1.45, gT: 1.5, psi0T: 0.6, psi2T: 0.5, psi0Q: 0.8, tablierMat: 'beton',
  };
  /* conversion formulaire REPHOR → données du moteur : même règle que la page REPHOR (toInput) */
  function rephorInput(v, rows) {
    const nums = (t) => String(t || '').split(/[\s;,]+/).map((x) => parseFloat(String(x).replace(',', '.'))).filter(Number.isFinite);
    const appuis = rows.map((a) => {
      const k = a.type === 'autre';
      const plaque = +a.pa > 0 && +a.pb > 0 && +a.pn > 0 ? { forme: 'rect', a: a.pa / 1000, b: a.pb / 1000, n: Math.round(a.pn), ti: a.pti / 1000, ts: a.pts / 1000, te: v.reglApp === 'livret' ? 0 : 0.0025, c: 0.005 } : null;
      return { nom: a.nom, type: a.type, nfut: Math.max(1, Math.round(+a.nfut || 1)), larfut: +a.larfut, esup: +a.esup, einf: +a.einf, hfut: +a.hfut, htot: +a.hfut,
        encastre: k ? true : !(+a.Khcd > 0 || +a.Krcd > 0), Khcd: k ? 0 : +a.Khcd, Krcd: k ? 0 : +a.Krcd, Kcd: k ? +a.Khcd : 0, Kld: k ? (+a.Krcd || +a.Khcd) : 0,
        app: a.app, appD: a.appD || undefined, napp: Math.max(1, Math.round(+a.napp || 1)), plaque, Gmax: +a.Gmax || 0, Gmin: +a.Gmax || 0, Qmax: +a.Qmax || 0, rot: +a.rot || 0, biais: v.biais };
    });
    const pT = v.ouvrage === 'route';
    return Object.assign({}, v, { travees: nums(v.travees).filter((x) => x > 0), appuis, joints: nums(v.joints).map(Math.round), biais: v.biais,
      retraitEC2: { fck: v.fckTab, RH: v.RH, h0: v.h0, ciment: v.ciment }, fasc61: true, gQ: v.gQ || (pT ? 1.35 : 1.45), psi0Q: v.psi0Q ?? (pT ? 0 : 0.8) });
  }

  /* ═══════════════════════ 3. Géométrie d'un ouvrage à tablier ═══════════════════════ */
  function geoTablier(s, A) {
    const d = A.d, nT = d.travees.length;
    const X = [0]; d.travees.forEach((L) => X.push(X[X.length - 1] + L));
    const phi = s.biais * GR, sn = Math.sin(phi), cs = Math.cos(phi);
    const hT = A.hT, hV = A.hV;
    const zR = (x) => s.zRail0 + (+s.pente || 0) / 100 * x;
    const zSF = (x) => zR(x) - hV - hT;
    const f = s.fond, c = s.app.culee, p = s.app.pile, P = f.pieux, hApp = +s.app.hApp || 0.25;
    const ymin = Math.min(...A.app.flatMap((a) => a.y)), ymax = Math.max(...A.app.flatMap((a) => a.y));
    const appuis = A.app.map((a, j) => {
      const culee = j === 0 || j === nT, x = X[j], side = j === 0 ? 1 : -1;
      const zApp = zSF(x), zSom = zApp - hApp, zsem = s.zTN - f.ancrage, zst = zsem + f.es;
      const o = { j, nom: a.nom, culee, side, x, zR: zR(x), zApp, zSom, zsem, zst, es: f.es, zTN: s.zTN, el: [], terres: [] };
      if (culee) {
        const cg = j === 0 ? A.cg : A.cd, Lm = A.B / sn;
        const xb = -(cg + c.joint + c.eGG), xf = xb + c.ef, zGG = zApp + hT + (A.route ? A.hV : A.hb);
        Object.assign(o, { type: 'culee', xb, xf, ef: c.ef, Lm, zGG, hMur: zSom - zst, hGG: zGG - zSom, lr: c.lr, er: c.er, talon: c.talon, patin: c.patin, faceAv: xf });
        o.u0 = xb - c.talon; o.u1 = xf + c.patin; o.B = o.u1 - o.u0; o.L = Lm + 2 * c.er;
        if (o.hMur <= 0) throw new Error(`Culée ${a.nom} : hauteur de mur négative — profil en long trop bas ou fondation trop haute.`);
        if (xf < 0.15) throw new Error(`Culée ${a.nom} : le mur de front (épaisseur ${c.ef} m) ne reçoit pas les appareils d’appui ; augmenter son épaisseur.`);
        o.el.push({ nom: 'Mur de front', u0: xb, u1: xf, z0: zst, z1: zSom, L: Lm, ratio: 90, coff: 2 * Lm * (zSom - zst) + 2 * c.ef * (zSom - zst) });
        o.el.push({ nom: 'Mur garde-grève', u0: xb, u1: xb + c.eGG, z0: zSom, z1: zGG, L: Lm, ratio: 120, coff: 2 * Lm * (zGG - zSom) });
        o.el.push({ nom: 'Murs en retour (2)', u0: xb - c.lr, u1: xb, z0: zst, z1: zGG, L: 2 * c.er, ratio: 80, coff: 4 * c.lr * (zGG - zst) + 2 * c.er * (zGG - zst) });
        // terres : remblai sur le talon (jusqu'au niveau du ballast) et terrain sur le patin
        o.terres.push({ nom: 'Remblai sur le talon', u0: xb - c.talon, u1: xb, z0: zst, z1: zGG, L: Lm });
        if (s.zTN > zst) o.terres.push({ nom: 'Terre sur le patin', u0: xf, u1: xf + c.patin, z0: zst, z1: s.zTN, L: Lm });
      } else {
        const ext = (ymax - ymin) / sn + 1.0;
        const nf = Math.max(1, Math.round(+p.nfut || 1)), lf = +p.larfut > 0 ? +p.larfut : (nf === 1 ? ext : 1.5);
        const ent = nf > 1 ? Math.max(lf, (ext - lf) / (nf - 1)) : 0, Lp = nf > 1 ? ent * (nf - 1) + lf : lf;
        Object.assign(o, { type: 'pile', e: p.e, nfut: nf, larfut: lf, entraxeFut: ent, Lp, hfut: zSom - zst, faceAv: p.e / 2 });
        if (o.hfut <= 0) throw new Error(`Pile ${a.nom} : hauteur de fût négative — profil en long trop bas ou fondation trop haute.`);
        o.u0 = -p.e / 2 - f.debord; o.u1 = p.e / 2 + f.debord; o.B = o.u1 - o.u0; o.L = Lp + 2 * f.debord;
        o.el.push({ nom: nf === 1 ? 'Voile' : `Fûts (${nf})`, u0: -p.e / 2, u1: p.e / 2, z0: zst, z1: zSom, L: nf * lf, ratio: 100, coff: nf * 2 * (lf + p.e) * (zSom - zst) });
        if (s.zTN > zst) o.terres.push({ nom: 'Terre sur la semelle', u0: o.u0, u1: o.u1, z0: zst, z1: s.zTN, L: o.L, deduire: { u0: -p.e / 2, u1: p.e / 2, L: nf * lf } });
      }
      // fondation profonde : grille de pieux, semelle agrandie si nécessaire
      if (f.type === 'pieux') {
        const nx = Math.max(1, Math.round(P.nx)), ny = Math.max(1, Math.round(P.ny));
        const Bp = (nx - 1) * P.ex + P.D + 1.0, Lpp = (ny - 1) * P.ey + P.D + 1.0;
        if (Bp > o.B) { const m = (o.u0 + o.u1) / 2; o.u0 = m - Bp / 2; o.u1 = m + Bp / 2; o.B = Bp; }
        o.L = Math.max(o.L, Lpp);
        const piles = []; for (let i = 0; i < nx; i++) for (let k = 0; k < ny; k++) piles.push({ x: r3((i - (nx - 1) / 2) * P.ex), y: r3((k - (ny - 1) / 2) * P.ey) });
        o.piles = piles;
      }
      o.uc = (o.u0 + o.u1) / 2;
      o.el.push({ nom: 'Semelle', u0: o.u0, u1: o.u1, z0: zsem, z1: zst, L: o.L, ratio: 80, coff: 2 * (o.B + o.L) * f.es, semelle: true });
      return o;
    });
    return { X, Ltot: X[nT], xa: -A.cg, xb: X[nT] + A.cd, sn, cs, phi, hT, hV, zR, zSF, appuis, Btot: A.B, ymin, ymax };
  }
  /* plan : point local (u perpendiculaire à la ligne d'appui, vers l'ouvrage pour une culée ; w le long de la ligne) */
  const plan = (G, a, u, w) => { const uu = a.culee ? a.side * u : u; return [a.x + uu * G.sn + w * G.cs, -uu * G.cs + w * G.sn]; };

  /* ═══════════════════════ 4. Descente de charges sommaire sur les appuis ═══════════════════════ */
  /* Torseur (Fx, Fy, Fz, Mx, My, Mz) au centre de la sous-face de semelle, Fz < 0 descendant (convention FONDATIO) ;
   * X perpendiculaire à la ligne d'appui (vers l'ouvrage pour une culée), Y le long de la ligne. */
  function descente(R, j) {
    const F = mod.fondatio(), s = R.s, G = R.geo, a = G.appuis[j], AD = R.tabA, Tj = AD.app[j], H = R.rephor, gB = 25, gQ = AD.gQ;
    const tp = (T, u, z) => F.transport(T, u - a.uc, 0, z, 0, 0, a.zsem);
    const add = (A, B) => A.map((v, k) => v + B[k]);
    const Z = [0, 0, 0, 0, 0, 0];
    // tablier (convention et valeurs des exports vers REPHOR des modules de tablier)
    const Gtab = Tj.Gk, GtabMin = Tj.GkMin, Qtab = Tj.Q;
    const uApp = 0;
    // poids propres et terres
    const pp = a.el.map((e) => { const V = (e.u1 - e.u0) * (e.z1 - e.z0) * e.L; return { nom: e.nom, V, W: gB * V, u: (e.u0 + e.u1) / 2, z: (e.z0 + e.z1) / 2 }; });
    const ter = a.terres.map((t) => {
      let V = (t.u1 - t.u0) * (t.z1 - t.z0) * t.L; if (t.deduire) V -= (t.deduire.u1 - t.deduire.u0) * (t.z1 - t.z0) * t.deduire.L;
      return { nom: t.nom, V, W: (a.culee ? s.app.culee.gamma : 19) * V, u: (t.u0 + t.u1) / 2, z: (t.z0 + t.z1) / 2 };
    });
    let Tg = Z.slice(); for (const e of pp.concat(ter)) Tg = add(Tg, tp([0, 0, -e.W, 0, 0, 0], e.u, e.z));
    const Ttab = (N) => tp([0, 0, -N, 0, 0, 0], uApp, a.zApp);
    // poussée des terres (culées) : Rankine, sur la hauteur sous-face de semelle → niveau du ballast
    let Tp = Z.slice(), Tq = Z.slice(), pous = null;
    if (a.culee) {
      const c = s.app.culee, Ka = Math.pow(Math.tan(Math.PI / 4 - c.phi * Math.PI / 360), 2), Ht = a.zGG - a.zsem;
      const P = 0.5 * Ka * c.gamma * Ht * Ht * a.Lm;
      const q = AD.qRemblai, bq = Math.min(a.Lm, AD.largeurQ / G.sn), Pq = Ka * q * Ht * bq;
      // contre-poussée active du terrain devant le patin (du terrain naturel à la sous-face), butée négligée
      const hf = Math.max(0, s.zTN - a.zsem), Pf = 0.5 * Ka * c.gamma * hf * hf * a.Lm;
      Tp = add(tp([P, 0, 0, 0, 0, 0], a.uc, a.zsem + Ht / 3), tp([-Pf, 0, 0, 0, 0, 0], a.uc, a.zsem + hf / 3)); Tq = tp([Pq, 0, 0, 0, 0, 0], a.uc, a.zsem + Ht / 2);
      pous = { Ka, Ht, P, hf, Pf, q, bq, Pq };
    }
    // efforts horizontaux longitudinaux de REPHOR (|H| dans le sens défavorable), au niveau des appareils
    const pa = H.parAppui[j], Hc = (id) => { const c = pa.combs.find((x) => x.id === id); return c ? Math.abs(c.H.abs ?? Math.max(Math.abs(c.H.max), Math.abs(c.H.min))) : 0; };
    const Th = (Hv) => tp([Hv * G.sn, Hv * G.cs, 0, 0, 0, 0], uApp, a.zApp);
    const Gpp = sum(pp.map((e) => e.W)), Gter = sum(ter.map((e) => e.W));
    const combs = [
      { type: 'ELS Rare', nom: 'ELS caractéristique : G + Q + H(ELS1) + poussée', ld: add(add(Tg, Ttab(Gtab)), Tp), cd: add(add(Ttab(Qtab), Th(Hc('ELS1'))), Tq) },
      { type: 'ELS QP', nom: 'ELS quasi permanent : G + H(QP) + poussée', ld: add(add(add(Tg, Ttab(Gtab)), Tp), Th(Hc('QP'))), cd: Z.slice() },
      { type: 'ELU Fond', nom: `ELU : 1,35 G + ${String(gQ).replace('.', ',')} Q + H(ELU1) + 1,35 poussée`, ld: add(add(Tg, Ttab(Gtab)).map((v) => 1.35 * v), Tp.map((v) => 1.35 * v)), cd: add(add(Ttab(Qtab).map((v) => gQ * v), Th(Hc('ELU1'))), Tq.map((v) => gQ * v)) },
      { type: 'ELU Fond', nom: 'ELU : G min + H(ELU1) + 1,35 poussée (glissement)', ld: add(add(Tg, Ttab(GtabMin)), Tp.map((v) => 1.35 * v)), cd: add(Th(Hc('ELU1')), Tq.map((v) => gQ * v)) },
    ];
    return { j, nom: a.nom, Gtab, GtabMin, Qtab, gQ, pp, ter, Gpp, Gter, pous, H: { ELS1: Hc('ELS1'), QP: Hc('QP'), ELU1: Hc('ELU1') }, combs };
  }

  /* ═══════════════════════ 5. Fondations : données FONDATIO ═══════════════════════ */
  function fondatioInput(s, sps, o) {
    const P = s.fond.pieux;
    return { type: o.type, sps, zsem: o.zsem, zdef: o.zdef, ztn: o.ztn, gamma: 19, gammaSat: 21, gammaB: 25, rapSol: 2, rapBet: 3, fcj: 28, fe: 500, px: 0, py: 0,
      combs: o.combs.map((c) => ({ type: c.type, ld: c.ld.slice(), cd: c.cd.slice() })),
      sup: { forme: 'rect', B: o.B, L: o.L, D: o.B, h: 0, sol: 'frottant', phi: 30, c: 0, methode: 'sigma', ibeta: 1, kp: NaN },
      pieux: { type: +P.ptype || 2, B: P.D, Lb: P.D, L: P.L, nseg: 10, kbase: 1e8, h0: 0, ce: 1, frotNeg: { els: 0, elu: 0 }, reducKf: { x: undefined, y: undefined },
        palierArriere: undefined, reale: false, enrob: 0.09, pmin: 0.5, piles: (o.piles || []).map((q) => ({ x: q.x, y: q.y })) } };
  }
  /* état de la page FONDATIO (formulaire, pieux, lignes de combinaisons LD/CD) pour « Ouvrir dans FONDATIO » */
  function fondatioPage(s, sps, o, projet) {
    const P = s.fond.pieux, K6 = ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'];
    const row = (type, dur, v) => Object.assign({ type, dur }, ...K6.map((k, i) => ({ [k]: +v[i].toFixed(2) })));
    return { gv: 2, v: { projet, type: o.type, zsem: r3(o.zsem), zdef: r3(o.zdef), ztn: r3(o.ztn), zeau: '', forme: 'rect', D: r3(o.B), B: r3(o.B), L: r3(o.L), h: 0, sol: 'frottant', phi: 30, c: 0,
      methode: 'sigma', ibeta: 1, kpImp: '', ptype: +P.ptype || 2, pB: P.D, pLb: P.D, pL: P.L, nseg: 10, kbase: 1e8, h0: 0, ce: 1, gsnEls: 0, gsnElu: 0, redX: '', redY: '', palArr: '',
      reale: false, enrob: 0.09, pmin: 0.5, gnx: P.nx, gny: P.ny, gex: P.ex, gey: P.ey, gamma: 19, gammaSat: 21, gammaB: 25, rapSol: 2, rapBet: 3, fcj: 28, fe: 500, px: 0, py: 0 },
      piles: (o.piles || [{ x: 0, y: 0 }]).map((q) => ({ x: q.x, y: q.y })), comb: o.combs.flatMap((c) => [row(c.type, 'LD', c.ld), row(c.type, 'CD', c.cd)]),
      sps, spsNom: 'OUVRAGES TYPES — ' + (sps.sondage || 'sondage') };
  }

  /* ═══════════════════════ 6. Chaîne d'un ouvrage à tablier ═══════════════════════ */
  function chaineTablier(R) {
    const s = R.s, route = R.t.ouvrage === 'route', RB = route ? mod.rodban() : mod.radban(), RH = mod.rephor(), F = mod.fondatio();
    if (!RB || !RH || !F) throw new Error('Modules TABLIER, HORIZONTAL ou FONDATIONS indisponibles.');
    // 1. tablier
    const din = tablierInput(s); R.tabInp = din; R.tabCle = route ? 'tablier-route' : 'tablier-rail';
    const T = RB.calcul(din); R.tab = T; R.tabMod = RB;
    T.alertes.forEach((m) => R.alertes.push('Tablier : ' + m));
    R.tabA = adapter(R);
    // 2. géométrie des appuis
    const G = geoTablier(s, R.tabA); R.geo = G;
    // 3. efforts horizontaux et appareils d'appui : export vers REPHOR du module de tablier, complété par la géométrie des appuis
    const exp = RB.exportRephor(T);
    const v = Object.assign({}, REPHOR_V, exp.v, { Emode: s.regl === 'ec' ? 'ec2' : 'bael', fck: s.app.fck });
    if (route) Object.assign(v, { gQ: 1.35, psi0Q: 0, nvoies: 1 });
    else { const ex = T.ext.reduce((m, e) => (e.theta * e.v > m.theta * m.v ? e : m), T.ext[0]); Object.assign(v, { nVoiesFrein: s.nVoies, thetaExt: +ex.theta.toExponential(4), eExt: r3(ex.v) }); }
    const rows = exp.ap.map((a, j) => {
      const g = G.appuis[j];
      return Object.assign({}, a, g.culee ? { type: 'mur', nfut: 1, larfut: r3(g.Lm), esup: g.ef, einf: g.ef, hfut: r3(g.hMur) } : { type: 'pile', nfut: g.nfut, larfut: r3(g.larfut), esup: g.e, einf: g.e, hfut: r3(g.hfut) });
    });
    R.rephorPage = { v, ap: rows };
    R.rephorInp = rephorInput(v, rows);
    const H = RH.calc(R.rephorInp); R.rephor = H;
    H.msgs.forEach((m) => R.alertes.push('Efforts horizontaux : ' + m));
    // 4. appareils (dimensionnés par APPMOBIL à travers REPHOR)
    R.appareils = H.app.map((rec) => {
      const a = G.appuis[rec.j], o = { j: rec.j, nom: a.nom, cote: rec.cote, app: rec.app, n: rec.n };
      if (rec.app === 'elasto') { o.res = rec.res; o.combis = rec.combis; o.plaque = rec.res && !rec.res.echec ? rec.res.plaque : null; o.ok = !!(rec.res && !rec.res.echec && rec.res.ok); o.taux = rec.res && rec.res.tauxMax; }
      else if (rec.app === 'fixe') { o.ok = rec.ok; o.HV = rec.HV; o.HVlim = rec.HVlim; }
      else { o.ok = true; o.Hf = rec.Hf; }
      return o;
    });
    // 5. descente de charges et fondations
    const sps = R.sps;
    R.appuis = G.appuis.map((a, j) => descente(R, j));
    R.fond = G.appuis.map((a, j) => {
      const o = { type: s.fond.type === 'pieux' ? 'pieux' : 'sup', zsem: a.zsem, zdef: s.zTN, ztn: s.zTN, B: a.B, L: a.L, piles: a.piles, combs: R.appuis[j].combs };
      const inp = fondatioInput(s, sps, o);
      let res = null, err = null;
      try { res = F.calc(inp); } catch (e) { err = e.message; }
      return { j, nom: a.nom, o, inp, res, err, page: fondatioPage(s, sps, o, (s.projet || '') + ' — ' + a.nom), ok: !!(res && res.synth && res.synth.ok) };
    });
  }

  /* ═══════════════════════ 7. Chaîne d'un cadre ou d'un portique ═══════════════════════ */
  function cadreInput(s) {
    const RR = mod.racba(), type = s.type === 'racba' ? 'cadre' : 'portique', d = RR.defauts(type), c = s.cad || {};
    const sn = Math.sin(s.biais * GR), e = +s.entraxe || 0;
    for (const k of Object.keys(c)) if (k !== 'surlong' && c[k] !== undefined && c[k] !== '') d[k] = c[k];
    d.type = type; d.biais = s.biais; d.nbvoi = s.nVoies; d.axevoi1 = s.nVoies === 2 ? -e / 2 : 0; d.axevoi2 = s.nVoies === 2 ? e / 2 : 0;
    d.lontottab = r3(s.Btot / sn); d.lonpied = r3(d.lontottab + (+c.surlong || 0)); d.lonrad = d.lonpied;
    // profil en long : remblai sur la traverse déduit de la cote du rail (rail = dessus traverse + étanchéité + remblai + ballast + rail)
    const zBase = s.gab.zObs - (+d.hauterint || 0), zTopTrav = zBase + d.hauint + d.eptra;
    const eprem = s.zRail0 - HRAIL - d.epbal - d.epetan - zTopTrav;
    if (eprem < -0.005) throw new Error(`Profil en long incompatible : le rail (cote ${fm(s.zRail0)}) est ${fm(-eprem)} m trop bas pour l’ouverture, la hauteur et les épaisseurs saisies (dessus de traverse ${fm(zTopTrav)}).`);
    d.eprem = r3(Math.max(0, eprem));
    if (!d.projet) d.projet = s.projet;
    return { d, zBase, zTopTrav };
  }
  function chaineCadre(R) {
    const s = R.s, RR = mod.racba(), F = mod.fondatio();
    if (!RR || !F) throw new Error('Modules CADRES ou FONDATIONS indisponibles.');
    const ci = cadreInput(s); R.cadInp = ci.d;
    const C = RR.calcul(ci.d); R.cadre = C;
    C.alertes.forEach((m) => R.alertes.push('Cadre / portique : ' + m));
    const d = C.d, G = C.G, cadre = G.cadre, sn = Math.sin(s.biais * GR);
    const zBase = ci.zBaseTop = ci.zBase, zsem = zBase - (cadre ? d.eprad : d.hausem);
    R.geo = { cadre, zBase, zsem, zTopTrav: ci.zTopTrav, zIntrados: zBase + d.hauint, sn, cs: Math.cos(s.biais * GR), d, G };
    // fondations : torseurs de RACBA-RAPO (N, H, M sur la fondation, poids du radier compris) → FONDATIO avec le sondage
    const sps = R.sps;
    R.fond = C.sol.fond.map((f, k) => {
      const typ = { CAR: 'ELS Rare', FREQ: 'ELS Freq', ELU: 'ELU Fond' };
      const combs = f.lignes.filter((l) => l.N > 0).map((l) => ({ type: typ[l.et], nom: `${l.et} ${l.cible}`, ld: [l.H, 0, -l.N, 0, l.M, 0], cd: [0, 0, 0, 0, 0, 0] }));
      const o = { type: 'sup', zsem, zdef: s.gab.zObs, ztn: s.gab.zObs, B: f.B, L: f.L, combs };
      const inp = fondatioInput(s, sps, o);
      let res = null, err = null;
      try { res = F.calc(inp); } catch (e) { err = e.message; }
      return { j: k, nom: f.nom, o, inp, res, err, src: f, page: fondatioPage(s, sps, o, (s.projet || '') + ' — ' + f.nom), ok: !!(res && res.synth && res.synth.ok) };
    });
  }

  /* ═══════════════════════ 8. Vérification des gabarits ═══════════════════════ */
  function gabarit(R) {
    const s = R.s, g = s.gab;
    if (!g || g.type === 'aucun') return null;
    const o = { type: g.type, Hreq: +g.H, Wreq: +g.W, zObs: +g.zObs, dec: +g.dec || 0 };
    if (R.geo.cadre !== undefined) {
      // cadre / portique : ouverture droite entre piédroits, hauteur libre intrados − niveau de la voie franchie
      const d = R.cadre.d;
      o.travee = 1; o.Wdispo = d.ouv; o.Hdispo = R.geo.zIntrados - o.zObs;
      if (d.haugousup > 0 && d.longousup > 0) {
        // goussets supérieurs : hauteur libre réduite au droit des bords du gabarit s'ils empiètent
        const xg = o.Wreq / 2 + Math.abs(o.dec), dist = d.ouv / 2 - xg;
        o.reducGousset = dist < d.longousup ? d.haugousup * (1 - Math.max(0, dist) / d.longousup) : 0;
        o.Hdispo -= o.reducGousset;
      }
      o.margeG = d.ouv / 2 + o.dec - o.Wreq / 2; o.margeD = d.ouv / 2 - o.dec - o.Wreq / 2;
    } else {
      const G = R.geo, k = Math.max(1, Math.min(G.X.length - 1, Math.round(+g.travee || 1)));
      const aL = G.appuis[k - 1], aR = G.appuis[k];
      const xL = aL.x + aL.faceAv / G.sn, xR = aR.x - aR.faceAv / G.sn;
      const xc = (xL + xR) / 2 + o.dec / G.sn;
      o.travee = k; o.xL = xL; o.xR = xR; o.xc = xc;
      o.Wdispo = (xR - xL) * G.sn;
      o.margeG = (xc - xL) * G.sn - o.Wreq / 2; o.margeD = (xR - xc) * G.sn - o.Wreq / 2;
      const pts = [];
      for (const sg of [-1, 1]) for (const y of [-G.Btot / 2, G.Btot / 2]) { const x = xc + sg * o.Wreq / 2 / G.sn + y * G.cs / G.sn; pts.push({ x, y, z: G.zSF(x) }); }
      const m = pts.reduce((a, b) => (b.z < a.z ? b : a));
      o.zSFmin = m.z; o.ptMin = m; o.Hdispo = m.z - o.zObs;
    }
    o.margeH = o.Hdispo - o.Hreq;
    o.okH = o.margeH >= -1e-9; o.okW = o.margeG >= -1e-9 && o.margeD >= -1e-9; o.ok = o.okH && o.okW;
    return o;
  }

  /* ═══════════════════════ 9. Avant-métré ═══════════════════════ */
  function metres(R) {
    const rows = [], add = (partie, designation, unite, q, origine) => rows.push({ partie, designation, unite, q, origine });
    const s = R.s, kRec = 1.10;
    if (R.tab) {
      const T = R.tab, A = R.tabA, d = T.d, G = R.geo, Lt = G.xb - G.xa, B = A.B, partie = 'Tablier', route = A.route;
      const pe = route ? A.ropen : d.type === 'rapen', modT = route ? 'TABLIER ROUTE' : 'TABLIER RAIL';
      // coupe : aire et longueur développée de la sous-face (profil des plans du module de tablier)
      const n = 400; let dev = 0, Ac = 0;
      for (let k = 0; k < n; k++) { const y0 = -B / 2 + B * k / n, y1 = -B / 2 + B * (k + 1) / n; dev += Math.hypot(y1 - y0, A.bot(y1) - A.bot(y0)); Ac += (y1 - y0) * (A.top((y0 + y1) / 2) + A.bot((y0 + y1) / 2)); }
      Ac = route ? T.G.A : T.g.A;                                    // aire de la coupe : valeur du module (contrôlée par les tests)
      const eRive = A.bot(-B / 2 + 1e-6);
      const coff = (dev + 2 * eRive) * Lt + 2 * Ac / G.sn;
      if (pe) {
        const pr = route ? T.R.prof : T.prof, N = route ? T.R.N : d.nPout, gp = pr.A * 0.785;   // kg/m (7850 kg/m³)
        const Ap = pr.A / 1e4, tf = pr.tf / 1e3, Bs = route ? T.G.Bs : T.g.Bres;
        const Vb = (Ac - N * Ap - (Bs - N * pr.b / 1e3) * tf) * Lt;
        add(partie, 'Béton du tablier (poutrelles et vides sous dallettes déduits)', 'm³', Vb, 'géométrie');
        add(partie, `Poutrelles ${pr.nom} (${N} × ${fm(Lt)} m)`, 'kg', N * Lt * gp, 'géométrie');
        add(partie, 'Dallettes de coffrage perdu', 'm²', Bs * Lt, 'géométrie');
        add(partie, 'Coffrage des rives, encorbellements et abouts', 'm²', coff - Bs * Lt, 'géométrie');
        const AsChap = route ? +d.ropen.AsChap : +d.AsChap, AsMinM = route ? +d.ropen.AsMinM || 0 : +d.AsMinM;
        const xs = T.secs.map((sc, k) => [sc.x, T.pe.secs[k].chap ? AsChap : 0]);
        add(partie, 'Aciers : chapeaux sur appuis', 'kg', integ(xs) * 1e-4 * ACIER * kRec, `calcul ${modT} (zones de chapeaux) + 10 % recouvrements`);
        add(partie, 'Aciers : nappe supérieure et transversaux', 'kg', Math.max(3 * AsMinM, 12) * Bs * Lt * 1e-4 * ACIER * kRec, 'forfait : 3 × mini (≥ 12 cm²/m) longitudinal et transversal');
      } else {
        add(partie, 'Béton du tablier', 'm³', Ac * Lt, 'géométrie');
        add(partie, 'Coffrage (sous-face, rives, abouts)', 'm²', coff, 'géométrie');
        if (route) {
          // sections par mètre de largeur (cm²/m), longitudinales intégrées sur x × largeur ; transversales moyennes × surface
          const xs = T.ba.lon.map((a) => [a.x, a.As[0] + a.As[1]]);
          add(partie, 'Aciers longitudinaux (sections calculées)', 'kg', integ(xs) * B * 1e-4 * ACIER * kRec, `calcul ${modT} + 10 % recouvrements`);
          const tr = T.ba.tra.length ? sum(T.ba.tra.map((a) => a.As[0] + a.As[1])) / T.ba.tra.length : 0;
          add(partie, 'Aciers transversaux (sections calculées, moyenne)', 'kg', tr * B * Lt * 1e-4 * ACIER * kRec, `calcul ${modT} + 10 % recouvrements`);
        } else {
          const xs = T.secs.map((sc, k) => [sc.x, T.ba.secs[k].As[0] + T.ba.secs[k].As[1]]);
          add(partie, 'Aciers longitudinaux (sections calculées)', 'kg', integ(xs) * 1e-4 * ACIER * kRec, `calcul ${modT} + 10 % recouvrements`);
          add(partie, 'Aciers transversaux (2 nappes de construction)', 'kg', 2 * d.AsMin * Lt * B * 1e-4 * ACIER * kRec, `forfait ${d.AsMin} cm²/m par nappe`);
          const xt = T.secs.map((sc, k) => [sc.x, (T.ba.secs[k].AtB0 || 0) * T.ba.b * 0.9 * T.g.hm]);
          const At = integ(xt);
          if (At > 0) add(partie, 'Aciers d’effort tranchant', 'kg', At * 1e-4 * ACIER * 1.2, `calcul ${modT} (At/b0·st) + 20 % façonnage`);
        }
      }
      add(partie, 'Étanchéité (surface de l’extrados)', 'm²', B * Lt, 'géométrie');
      // appareils
      R.appareils.forEach((ap) => {
        if (ap.app !== 'elasto') { add('Appareils d’appui', `${ap.nom} : appareils ${ap.app === 'fixe' ? 'fixes' : 'glissants'}`, 'u', ap.n, 'HORIZONTAL'); return; }
        const p = ap.plaque;
        add('Appareils d’appui', `${ap.nom} : élastomère fretté ${p ? `${Math.round(p.a * 1000)} × ${Math.round(p.b * 1000)} × ${p.n}(${Math.round(p.ti * 1000)} + ${Math.round(p.ts * 1000)})` : '(non dimensionné)'}`, 'u', ap.n, 'calcul HORIZONTAL / ÉLASTOMÈRES');
      });
      // appuis
      G.appuis.forEach((a, j) => {
        const partie = (a.culee ? 'Culée ' : 'Pile ') + a.nom, D = R.appuis[j];
        a.el.forEach((e, k) => {
          const V = D.pp[k].V;
          add(partie, 'Béton : ' + e.nom.toLowerCase(), 'm³', V, 'géométrie');
          add(partie, 'Coffrage : ' + e.nom.toLowerCase(), 'm²', e.coff, 'géométrie');
          add(partie, 'Aciers : ' + e.nom.toLowerCase(), 'kg', V * e.ratio, `ratio forfaitaire ${e.ratio} kg/m³ (PILES-CULÉES à venir)`);
        });
        add(partie, 'Béton de propreté (0,10 m)', 'm³', a.B * a.L * 0.10, 'géométrie');
        add(partie, 'Bossages d’appareils', 'm³', R.appareils.filter((x) => x.j === j && x.plaque).reduce((t, x) => t + x.n * (x.plaque.a + 0.10) * (x.plaque.b + 0.10) * 0.10, 0), 'géométrie (débord 5 cm, épaisseur 10 cm)');
        add(partie, 'Fouilles (emprise de la semelle + 0,50 m)', 'm³', (a.B + 1) * (a.L + 1) * Math.max(0, s.zTN - a.zsem + 0.10), 'géométrie');
        pieuxMetre(R, add, partie, j);
      });
    }
    if (R.cadre) {
      const C = R.cadre, d = C.d, G = C.G, cadre = G.cadre, partie = cadre ? 'Cadre' : 'Portique';
      const Lc = d.ouv + 2 * d.eppied;
      const gou = (h, l) => (h > 0 && l > 0 ? Math.min(h, l / 3) * l / 2 : 0);        // gousset : pente limitée à 1/3, comme RACBA-RAPO
      add(partie, 'Béton : traverse', 'm³', Lc * d.eptra * d.lontottab, 'géométrie');
      add(partie, 'Béton : goussets supérieurs (2)', 'm³', 2 * gou(d.haugousup, d.longousup) * d.lontottab, 'géométrie');
      add(partie, 'Béton : piédroits (2)', 'm³', 2 * d.eppied * d.hauint * d.lonpied, 'géométrie');
      if (cadre) {
        add(partie, 'Béton : radier', 'm³', Lc * d.eprad * d.lonrad, 'géométrie');
        add(partie, 'Béton : goussets inférieurs (2)', 'm³', 2 * gou(d.haugouinf, d.longouinf) * d.lonrad, 'géométrie');
      } else add(partie, 'Béton : semelles (2)', 'm³', 2 * G.larSem * d.hausem * d.lonpied, 'géométrie');
      const coff = 2 * d.hauint * d.lonpied * 2 + d.ouv * d.lontottab + 2 * d.eptra * d.lontottab + (cadre ? 2 * d.eprad * d.lonrad : 4 * d.hausem * d.lonpied) + 2 * (Lc * (d.hauint + d.eptra)) / R.geo.sn;
      add(partie, 'Coffrages (faces vues et cachées, abouts biais)', 'm²', coff, 'géométrie');
      // aciers : sections calculées par RACBA-RAPO (cm²/m sur chaque face), moyenne par élément × longueur × largeur
      const par = {};
      C.justif.forEach((j) => { if (!j.As) return; const k = j.sec.kind; (par[k] = par[k] || []).push(j); });
      const lon = { trav: Lc / G.sinB, pied: 2 * d.hauint, radier: Lc / G.sinB, sem: 2 * G.larSem / G.sinB };
      const lib = { trav: 'traverse', pied: 'piédroits', radier: 'radier', sem: 'semelles' };
      for (const [k, L] of Object.entries(par)) {
        const As = sum(L.map((j) => j.As[0] + j.As[1])) / L.length, w = L[0].w;
        add(partie, 'Aciers principaux : ' + lib[k], 'kg', As * 1e-4 * ACIER * (lon[k] || 0) * w * kRec, 'calcul CADRES (moyenne des sections) + 10 %');
        add(partie, 'Aciers de répartition : ' + lib[k], 'kg', 0.25 * As * 1e-4 * ACIER * (lon[k] || 0) * w * kRec, 'forfait 25 % des aciers principaux');
      }
      add(partie, 'Étanchéité de la traverse', 'm²', (Lc + 2 * d.eptra) * d.lontottab, 'géométrie');
      add(partie, 'Béton de propreté (0,10 m)', 'm³', (cadre ? Lc * d.lonrad : 2 * G.larSem * d.lonpied) * 0.10, 'géométrie');
    }
    // récapitulatif
    const tot = (u, f) => sum(rows.filter((r) => r.unite === u && f(r)).map((r) => r.q));
    const recap = { beton: tot('m³', (r) => /^Béton/.test(r.designation) && !/propreté/.test(r.designation)), coffrage: tot('m²', (r) => /^Coffrage/.test(r.designation)),
      aciers: tot('kg', (r) => /^Aciers/.test(r.designation)), poutrelles: tot('kg', (r) => /^Poutrelles/.test(r.designation)), appareils: tot('u', (r) => r.partie === 'Appareils d’appui') };
    return { rows, recap };
  }
  function pieuxMetre(R, add, partie, j) {
    const f = R.fond[j], P = R.s.fond.pieux;
    if (!f || f.o.type !== 'pieux') return;
    const n = f.o.piles.length, Lp = P.L, Ap = Math.PI * P.D * P.D / 4;
    add(partie, `Pieux forés Ø ${P.D} m (${n} × ${Lp} m)`, 'm', n * Lp, 'géométrie');
    add(partie, 'Béton des pieux', 'm³', n * Lp * Ap, 'géométrie');
    const As = f.res && f.res.acier ? Math.max(...f.res.acier.sections.map((x) => x.A)) : 0.005 * Ap * 1e4;
    add(partie, 'Aciers des pieux', 'kg', n * Lp * As * 1e-4 * ACIER * 1.15, f.res && f.res.acier ? 'calcul FONDATIONS (section maxi) + 15 % cerces' : 'minimum 0,5 % + 15 %');
  }
  /* intégrale ∫ v(x) dx sur des points [x, v] (doublons aux appuis : valeur maxi) */
  function integ(pts) {
    const m = new Map(); for (const [x, v] of pts) { const k = Math.round(x * 1e6); m.set(k, Math.max(m.get(k) ?? -Infinity, v)); }
    const a = [...m.entries()].sort((p, q) => p[0] - q[0]).map(([k, v]) => [k / 1e6, v]);
    let t = 0; for (let i = 1; i < a.length; i++) t += (a[i][0] - a[i - 1][0]) * (a[i][1] + a[i - 1][1]) / 2;
    return t;
  }
  function metresCSV(M) {
    const f = (v) => (Math.round(v * 100) / 100).toFixed(2).replace('.', ',');
    const q = (t) => '"' + String(t).replace(/"/g, '""') + '"';
    return '﻿' + ['Partie;Désignation;Unité;Quantité;Origine'].concat(M.rows.map((r) => [q(r.partie), q(r.designation), r.unite, f(r.q), q(r.origine)].join(';'))).join('\r\n') + '\r\n';
  }

  /* ═══════════════════════ 10. Verdicts par partie ═══════════════════════ */
  function verdicts(R) {
    const V = [], s = R.s;
    const push = (partie, statut, texte, module, etape) => V.push({ partie, statut, texte, module, etape });
    if (R.tab) {
      const T = R.tab, A = R.tabA, rapen = T.d.type === 'rapen';
      if (A.route) {
        let okS, txt;
        if (A.ropen) { okS = T.pe.secs.every((p) => p.okELS && p.okELU) && T.pe.okV; txt = `${T.R.N} ${T.R.prof.nom} : contraintes ELS, moments ELU ${okS ? 'vérifiés' : 'NON vérifiés'} ; VEd/Vpl,Rd = ${(T.pe.Vsd / T.pe.VplRd).toFixed(2)}`; }
        else { const all = T.ba.lon.concat(T.ba.tra); okS = all.every((a) => a.verdict !== false); txt = `aciers longitudinaux maxi ${Math.max(...T.ba.lon.map((a) => Math.max(a.As[0], a.As[1]))).toFixed(1)} cm²/m, transversaux maxi ${Math.max(0, ...T.ba.tra.map((a) => Math.max(a.As[0], a.As[1]))).toFixed(1)} cm²/m ; sections ${okS ? 'vérifiées' : 'NON vérifiées'}`; }
        const fl = T.fl.reduce((m, f) => (f.ratioQ < m.ratioQ ? f : m), T.fl[0]);
        push('Tablier', okS && !T.alertes.length ? 'ok' : 'ko', txt + ` ; flèche sous trafic L/${Math.round(fl.ratioQ)} (travée ${fl.t + 1})`, 'tablier-route', 1);
      } else {
      const okFl = T.fl.travees.every((t) => t.ok), okExt = T.ext.every((e) => e.dH <= e.limH);
      let okS = true, txt;
      if (rapen) { okS = T.pe.secs.every((p) => p.okELS && p.okELU) && T.pe.okV; txt = `${T.d.nPout} ${T.prof.nom} : contraintes ELS, moments ELU ${okS ? 'vérifiés' : 'NON vérifiés'} ; VEd/Vpl,Rd = ${(T.pe.Vsd / T.pe.VplRd).toFixed(2)}`; }
      else { const sc = Math.max(...T.ba.secs.map((a) => a.sc)); okS = !T.alertes.length; txt = `As sup. maxi ${Math.max(...T.ba.secs.map((a) => a.As[0])).toFixed(0)} cm², As inf. maxi ${Math.max(...T.ba.secs.map((a) => a.As[1])).toFixed(0)} cm², σbc ${sc.toFixed(1)} MPa`; }
      push('Tablier', okS && okFl && okExt ? 'ok' : 'ko', txt + ` ; flèche de confort ${okFl ? 'vérifiée' : 'NON vérifiée'}`, 'tablier-rail', 1);
      }
      const okA = R.appareils.every((a) => a.ok);
      push('Appareils d’appui', okA ? 'ok' : 'ko', R.appareils.filter((a) => a.app === 'elasto').length + ' files en élastomère fretté dimensionnées (EN 1337-3)' + (okA ? '' : ' — au moins une vérification non satisfaite'), 'appareils-appui', 2);
      const vr = R.rephor.verifsRail;
      if (vr) { const ok = vr.every((x) => x.okB && x.okLT && x.okH); push('Interaction voie-ouvrage', ok ? 'ok' : 'ko', `δB = ${(Math.max(...vr.map((x) => x.deltaB)) * 1000).toFixed(2)} mm, longueur dilatable ${Math.max(...vr.map((x) => x.LT)).toFixed(1)} m`, 'efforts-horizontaux', 2); }
      push('Piles et culées', 'bientot', 'Justification béton armé et stabilité propre : module PILES-CULÉES bientôt intégré. Descente de charges sommaire établie pour les fondations.', 'appui', 3);
    }
    if (R.cadre) {
      const C = R.cadre, okJ = C.justif.every((j) => j.ok !== false && !j.erreur);
      push(R.cadre.G.cadre ? 'Cadre' : 'Portique', okJ && C.fleche.ok ? 'ok' : 'ko', `${C.justif.length} sections justifiées (ELU, ELS, effort tranchant) ${okJ ? '' : '— au moins une NON vérifiée'} ; flèche ${(C.fleche.delta * 1000).toFixed(1)} mm (limite ${(C.fleche.admConfort * 1000).toFixed(1)} mm)`, 'cadres-portiques', 1);
    }
    R.fond.forEach((f) => {
      const typ = f.o.type === 'pieux' ? `${f.o.piles.length} pieux Ø ${s.fond.pieux.D} m` : `semelle ${f.o.B.toFixed(2)} × ${f.o.L.toFixed(2)} m`;
      push('Fondation ' + f.nom, f.err ? 'ko' : f.ok ? 'ok' : 'ko', f.err ? f.err : typ + ' — ' + (f.ok ? 'portance, décompression et glissement vérifiés' : 'au moins un critère NON vérifié'), 'fondations', 4);
    });
    if (R.gabarit) { const g = R.gabarit; push('Gabarit ' + (g.type === 'rail' ? 'ferroviaire' : 'routier'), g.ok ? 'ok' : 'ko', `hauteur libre ${g.Hdispo.toFixed(2)} m (requis ${g.Hreq.toFixed(2)}), marges latérales ${g.margeG.toFixed(2)} / ${g.margeD.toFixed(2)} m`, null, 1); }
    V.forEach((v) => { v.texte = v.texte.replace(/(\d)\.(\d)/g, '$1,$2'); });   // virgule décimale
    return V;
  }

  /* ═══════════════════════ 11. Point d'entrée ═══════════════════════ */
  function calcul(s0) {
    const s = normaliser(s0), dsp = disponible(s.type);
    if (!dsp.ok) throw new Error(dsp.msg);
    const SP = mod.sondpres();
    const R = { s, t: TYPES[s.type], alertes: [], sps: s.sps && s.sps.couches && s.sps.couches.length ? s.sps : SP.exemple() };
    if (R.t.famille === 'tablier') chaineTablier(R); else chaineCadre(R);
    R.gabarit = gabarit(R);
    R.metres = metres(R);
    R.verdicts = verdicts(R);
    R.implantation = implantation(R);
    return R;
  }

  /* coordonnées d'implantation (E, N) des axes d'appuis aux rives du tablier : origine (E0, N0) à l'intersection de l'axe
   * de l'ouvrage et de l'axe de C0, gisement de l'axe en grades (depuis le nord, sens horaire) */
  function implantation(R) {
    const s = R.s, g = s.imp, gis = (+g.gis || 0) * GR;
    const EN = (x, y) => [g.E0 + x * Math.sin(gis) - y * Math.cos(gis), g.N0 + x * Math.cos(gis) + y * Math.sin(gis)];
    const pts = [];
    if (R.geo && R.geo.appuis) {
      const G = R.geo;
      G.appuis.forEach((a) => { for (const [lib, y] of [['rive gauche', G.Btot / 2], ['axe', 0], ['rive droite', -G.Btot / 2]]) { const x = a.x + y * G.cs / G.sn; const [E, N] = EN(x, y); pts.push({ appui: a.nom, point: lib, x, y, E, N, z: lib === 'axe' ? a.zR : null }); } });
    } else if (R.cadre) {
      const C = R.cadre, d = C.d, sn = R.geo.sn, cs = R.geo.cs, half = (d.ouv / 2 + d.eppied / 2) / sn;
      for (const [nom, xc] of [['Piédroit gauche', -half], ['Piédroit droit', half]]) for (const [lib, y] of [['rive gauche', s.Btot / 2], ['axe', 0], ['rive droite', -s.Btot / 2]]) { const x = xc + y * cs / sn; const [E, N] = EN(x, y); pts.push({ appui: nom, point: lib, x, y, E, N, z: null }); }
    }
    return pts;
  }

  /* ═══════════════════════ 12. Plans : primitives (m), rendu SVG et DXF R12 ═══════════════════════ */
  /* Primitives (même format que RADBAN-RAPEN, dont les vues de coffrage du tablier sont reprises telles quelles) :
   * {l:[x1,y1,x2,y2,calque]}, {p:[[x,y]…],calque,ferme}, {c:[x,y,r,calque]}, {t:[x,y,texte,h,calque,ancre]},
   * {cote:[a,b,y,texte]}, {coteV:[x,a,b,texte]}. Calques : COFFRAGE, CACHE, AXES, APPAREILS, POUTRELLES, PERCAGE,
   * TERRAIN, GABARIT, PROFIL, FONDATIONS, TEXTE, COTES. */
  const fm = (v, n = 2) => (Math.round(v * Math.pow(10, n)) / Math.pow(10, n)).toFixed(n).replace('.', ',');
  const rect = (x0, y0, x1, y1, calque) => ({ p: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], calque, ferme: true });
  function vues(R) { return R.tab ? vuesTablier(R) : vuesCadre(R); }

  function vuesTablier(R) {
    const s = R.s, G = R.geo, T = R.tab, A = R.tabA, d = T.d, V = [], X = G.X, nT = d.travees.length;
    const Lx = (a, u) => a.x + (a.culee ? a.side : 1) * u / G.sn;     // abscisse sur l'axe d'un point local u
    /* ── plan d'implantation ── */
    const pl = [], B = G.Btot, off = (y) => y * G.cs / G.sn;
    pl.push({ p: [[G.xa + off(-B / 2), -B / 2], [G.xb + off(-B / 2), -B / 2], [G.xb + off(B / 2), B / 2], [G.xa + off(B / 2), B / 2]], calque: 'COFFRAGE', ferme: true });
    pl.push({ l: [G.xa - 6, 0, G.xb + 6, 0, 'AXES'] });
    pl.push({ t: [G.xb + 6.2, 0.2, 'axe de l’ouvrage', 0.35, 'TEXTE', 'start'] });
    G.appuis.forEach((a) => {
      const w0 = -a.L / 2 - 1.5, w1 = a.L / 2 + 1.5, p0 = plan(G, a, 0, w0), p1 = plan(G, a, 0, w1);
      pl.push({ l: [p0[0], p0[1], p1[0], p1[1], 'AXES'] });
      pl.push({ t: [p1[0], p1[1] + 0.4, a.nom, 0.4, 'TEXTE', 'middle'] });
      const cs = [[a.u0, -a.L / 2], [a.u1, -a.L / 2], [a.u1, a.L / 2], [a.u0, a.L / 2]].map(([u, w]) => plan(G, a, u, w));
      pl.push({ p: cs, calque: 'CACHE', ferme: true });
      a.el.filter((e) => !e.semelle).forEach((e) => {
        if (a.culee && /retour/.test(e.nom)) { for (const sg of [-1, 1]) { const w0 = sg * (a.Lm / 2 + e.L / 4), hw = e.L / 4; pl.push({ p: [[e.u0, w0 - hw], [e.u1, w0 - hw], [e.u1, w0 + hw], [e.u0, w0 + hw]].map(([u, w]) => plan(G, a, u, w)), calque: 'CACHE', ferme: true }); } return; }
        if (!a.culee && a.nfut > 1) { for (let k = 0; k < a.nfut; k++) { const wc = -a.Lp / 2 + a.larfut / 2 + k * a.entraxeFut; pl.push({ p: [[e.u0, wc - a.larfut / 2], [e.u1, wc - a.larfut / 2], [e.u1, wc + a.larfut / 2], [e.u0, wc + a.larfut / 2]].map(([u, w]) => plan(G, a, u, w)), calque: 'CACHE', ferme: true }); } return; }
        pl.push({ p: [[e.u0, -e.L / 2], [e.u1, -e.L / 2], [e.u1, e.L / 2], [e.u0, e.L / 2]].map(([u, w]) => plan(G, a, u, w)), calque: 'CACHE', ferme: true });
      });
      if (a.piles) a.piles.forEach((q) => { const [x, y] = plan(G, a, a.uc + q.x, q.y); pl.push({ c: [x, y, s.fond.pieux.D / 2, 'FONDATIONS'] }); });
      A.app[a.j].y.forEach((y) => pl.push({ c: [a.x + off(y), y, 0.15, 'APPAREILS'] }));
    });
    A.voies.forEach((e, v) => { pl.push({ l: [G.xa - 3, e, G.xb + 3, e, A.route ? 'CACHE' : 'AXES'] }); pl.push({ t: [G.xa - 3.2, e + 0.15, A.route ? (v ? '' : 'chaussée') : 'V' + (v + 1), 0.35, 'TEXTE', 'end'] }); });
    const g = R.gabarit;
    if (g) {
      const yy = B / 2 + 4, a0 = g.xc - g.Wreq / 2 / G.sn, a1 = g.xc + g.Wreq / 2 / G.sn;
      pl.push({ p: [[a0 - off(yy), -yy], [a1 - off(yy), -yy], [a1 + off(yy), yy], [a0 + off(yy), yy]], calque: 'GABARIT', ferme: true });
      pl.push({ l: [g.xc - off(yy + 2), -yy - 2, g.xc + off(yy + 2), yy + 2, 'GABARIT'] });
      pl.push({ t: [g.xc + off(yy + 2.3), yy + 2.3, (g.type === 'rail' ? 'voie franchie' : 'route franchie') + ' — gabarit ' + fm(g.Wreq) + ' m', 0.35, 'TEXTE', 'middle'] });
    }
    for (let i = 0; i < nT; i++) pl.push({ cote: [X[i], X[i + 1], -B / 2 - 3, fm(d.travees[i])] });
    pl.push({ cote: [G.xa, G.xb, -B / 2 - 4.5, 'longueur du tablier ' + fm(G.xb - G.xa)] });
    pl.push({ t: [X[0] + off(B / 2) + 0.6, B / 2 - 0.8, 'biais ' + fm(s.biais, 2) + ' gr', 0.35, 'TEXTE', 'start'] });
    V.push({ id: 'implantation', groupe: 'ensemble', titre: 'Plan d’implantation (vue en plan, axes d’appuis, emprises des fondations)', prim: pl, flipY: true });

    /* ── élévation (coupe longitudinale dans l'axe) ── */
    const el = [], zmin = Math.min(...G.appuis.map((a) => a.zsem)) - (s.fond.type === 'pieux' ? s.fond.pieux.L : 0) - 0.5;
    const xs = [G.xa, G.xb];
    el.push({ p: [[G.xa, G.zSF(G.xa) + G.hT], [G.xb, G.zSF(G.xb) + G.hT], [G.xb, G.zSF(G.xb)], [G.xa, G.zSF(G.xa)]], calque: 'COFFRAGE', ferme: true });
    el.push({ l: [G.xa - 8, G.zR(G.xa - 8), G.xb + 8, G.zR(G.xb + 8), 'PROFIL'] });
    el.push({ t: [G.xb + 8.2, G.zR(G.xb + 8), 'rail ' + fm(G.zR(G.xb)), 0.35, 'TEXTE', 'start'] });
    el.push({ l: [G.xa - 8, s.zTN, G.xb + 8, s.zTN, 'TERRAIN'] });
    el.push({ t: [G.xa - 8, s.zTN + 0.2, 'TN ' + fm(s.zTN), 0.35, 'TEXTE', 'start'] });
    G.appuis.forEach((a) => {
      el.push({ l: [a.x, a.zR + 1.2, a.x, a.zsem - 0.8, 'AXES'] });
      el.push({ t: [a.x, a.zR + 1.4, a.nom, 0.4, 'TEXTE', 'middle'] });
      a.el.forEach((e) => {
        const x0 = Lx(a, e.u0), x1 = Lx(a, e.u1);
        el.push(Object.assign(rect(Math.min(x0, x1), e.z0, Math.max(x0, x1), e.z1, /retour/.test(e.nom) ? 'CACHE' : 'COFFRAGE')));
      });
      el.push({ p: [[a.x - 0.25, a.zApp], [a.x + 0.25, a.zApp], [a.x + 0.25, a.zSom], [a.x - 0.25, a.zSom]], calque: 'APPAREILS', ferme: true });
      if (a.piles) { const xsP = [...new Set(a.piles.map((q) => q.x))]; xsP.forEach((u) => { const x = Lx(a, a.uc + u); el.push(rect(x - s.fond.pieux.D / 2, a.zsem - s.fond.pieux.L, x + s.fond.pieux.D / 2, a.zsem, 'FONDATIONS')); }); }
      el.push({ t: [Lx(a, a.u1) + 0.3 * (a.culee ? a.side : 1), a.zsem + 0.2, fm(a.zsem), 0.3, 'TEXTE', a.culee && a.side < 0 ? 'end' : 'start'] });
      xs.push(Lx(a, a.u0), Lx(a, a.u1));
    });
    if (g) {
      const a0 = g.xc - g.Wreq / 2 / G.sn, a1 = g.xc + g.Wreq / 2 / G.sn;
      el.push(rect(a0, g.zObs, a1, g.zObs + g.Hreq, 'GABARIT'));
      el.push({ coteV: [a1 + 0.4, g.zObs, g.zSFmin, 'hauteur libre ' + fm(g.Hdispo)] });
      el.push({ t: [(a0 + a1) / 2, g.zObs + g.Hreq / 2, 'gabarit ' + fm(g.Hreq) + ' m', 0.35, 'TEXTE', 'middle'] });
    }
    for (let i = 0; i < nT; i++) el.push({ cote: [X[i], X[i + 1], zmin - 0.6, fm(d.travees[i])] });
    V.push({ id: 'elevation', groupe: 'ensemble', titre: 'Plan d’ensemble : élévation (coupe longitudinale dans l’axe, cotes NGF)', prim: el });

    /* ── coupe transversale au droit de la pile la plus haute (ou d'une culée) ── */
    const piles = G.appuis.filter((a) => !a.culee), a = piles.length ? piles.reduce((m, p) => (p.hfut > m.hfut ? p : m)) : G.appuis[0];
    const ct = [], zE = a.zApp + G.hT;
    const z0 = a.zApp + A.hRive;   // extrados en rive
    const pts = []; for (let k = 0; k <= 120; k++) { const y = -B / 2 + B * k / 120; pts.push([y, z0 + A.top(y)]); }
    for (let k = 120; k >= 0; k--) { const y = -B / 2 + B * k / 120; pts.push([y, z0 - A.bot(y)]); }
    ct.push({ p: pts, calque: 'COFFRAGE', ferme: true });
    if (A.route) { ct.push({ l: [A.voies[0], zE + A.hV, A.voies[1], zE + A.hV, 'PROFIL'] }); ct.push({ t: [(A.voies[0] + A.voies[1]) / 2, zE + A.hV + 0.3, 'chaussée ' + fm(Math.abs(A.voies[0] - A.voies[1])), 0.3, 'TEXTE', 'middle'] }); }
    else A.voies.forEach((e, v) => { ct.push({ l: [e, zE + 1.4, e, a.zApp - 0.3, 'AXES'] }); ct.push({ l: [e - 0.75, zE + A.hV, e + 0.75, zE + A.hV, 'PROFIL'] }); ct.push({ t: [e, zE + 1.55, 'V' + (v + 1), 0.3, 'TEXTE', 'middle'] }); });
    A.app[a.j].y.forEach((y) => ct.push(rect(y - 0.2, a.zSom, y + 0.2, a.zApp, 'APPAREILS')));
    const wv = (a.culee ? a.Lm : a.Lp) * G.sn, wsem = a.L * G.sn;
    if (a.culee) ct.push(rect(-wv / 2, a.zst, wv / 2, a.zSom, 'COFFRAGE'));
    else for (let k = 0; k < a.nfut; k++) { const wc = (-a.Lp / 2 + a.larfut / 2 + k * a.entraxeFut) * G.sn, hw = a.larfut * G.sn / 2; ct.push(rect(wc - hw, a.zst, wc + hw, a.zSom, 'COFFRAGE')); }
    ct.push(rect(-wsem / 2, a.zsem, wsem / 2, a.zst, 'COFFRAGE'));
    if (a.piles) [...new Set(a.piles.map((q) => q.y))].forEach((w) => ct.push(rect(w * G.sn - s.fond.pieux.D / 2, a.zsem - s.fond.pieux.L, w * G.sn + s.fond.pieux.D / 2, a.zsem, 'FONDATIONS')));
    ct.push({ l: [-wsem / 2 - 2, s.zTN, wsem / 2 + 2, s.zTN, 'TERRAIN'] });
    ct.push({ cote: [-B / 2, B / 2, zE + 2.0, 'largeur ' + fm(B)] });
    ct.push({ coteV: [wsem / 2 + 1.0, a.zst, a.zSom, (a.culee ? 'mur ' : 'fût ') + fm(a.zSom - a.zst)] });
    ct.push({ coteV: [-wsem / 2 - 0.8, a.zsem, a.zst, fm(a.es)] });
    ct.push({ cote: [-wsem / 2, wsem / 2, a.zsem - 0.8 - (a.piles ? s.fond.pieux.L : 0), 'semelle (projetée) ' + fm(wsem)] });
    V.push({ id: 'coupe', groupe: 'ensemble', titre: `Plan d’ensemble : coupe transversale au droit de ${a.nom} (section droite)`, prim: ct });

    /* ── coffrage du tablier : vues de RADBAN-RAPEN ── */
    R.tabMod.vues(T).forEach((v) => V.push(Object.assign({}, v, { id: 'tab-' + v.id, groupe: 'coffrage', titre: 'Tablier — ' + v.titre })));
    /* ── coffrage des appuis ── */
    G.appuis.forEach((a) => V.push(a.culee ? vueCulee(R, a) : vuePile(R, a)));
    /* ── gabarit ── */
    if (g) V.push(vueGabaritTablier(R));
    return V;
  }
  function vueCulee(R, a) {
    const s = R.s, c = s.app.culee, P = [], zG = a.zGG;
    // coupe perpendiculaire à la ligne d'appui (u vers l'ouvrage)
    P.push(rect(a.u0, a.zsem, a.u1, a.zst, 'COFFRAGE'));
    P.push({ p: [[a.xb, a.zst], [a.xf, a.zst], [a.xf, a.zSom], [a.xb + c.eGG, a.zSom], [a.xb + c.eGG, zG], [a.xb, zG]], calque: 'COFFRAGE', ferme: true });
    P.push(rect(a.xb - c.lr, a.zst, a.xb, zG, 'CACHE'));
    P.push(rect(-0.25, a.zSom, 0.25, a.zApp, 'APPAREILS'));
    P.push({ l: [0, a.zApp + 1.0, 0, a.zsem - 0.6, 'AXES'] });
    const cg = a.side > 0 ? R.tab.d.cg : R.tab.d.cd;
    P.push({ p: [[-cg, a.zApp], [3.0, a.zApp], [3.0, a.zApp + R.geo.hT], [-cg, a.zApp + R.geo.hT]], calque: 'CACHE', ferme: true });
    P.push({ l: [a.u0 - 1, s.zTN, a.u0, s.zTN, 'TERRAIN'] }); P.push({ l: [a.xf, s.zTN, a.u1 + 3, s.zTN, 'TERRAIN'] });
    P.push({ cote: [a.u0, a.u1, a.zsem - 0.7, fm(a.B)] });
    P.push({ cote: [a.u0, a.xb, a.zsem - 1.4, 'talon ' + fm(a.talon)] }); P.push({ cote: [a.xb, a.xf, a.zsem - 1.4, fm(a.ef)] }); P.push({ cote: [a.xf, a.u1, a.zsem - 1.4, 'patin ' + fm(a.patin)] });
    P.push({ coteV: [a.u1 + 0.6, a.zsem, a.zst, fm(a.es)] });
    P.push({ coteV: [a.xf + 0.6, a.zst, a.zSom, 'mur ' + fm(a.hMur)] });
    P.push({ coteV: [a.xb - c.lr - 0.5, a.zSom, zG, 'garde-grève ' + fm(a.hGG)] });
    P.push({ cote: [a.xb - c.lr, a.xb, zG + 0.6, 'retour ' + fm(c.lr)] });
    [[a.zsem, 'sous-face'], [a.zst, 'arase semelle'], [a.zSom, 'sommier'], [zG, 'garde-grève']].forEach(([z, l]) => P.push({ t: [a.u1 + 1.6, z, l + ' ' + fm(z), 0.28, 'TEXTE', 'start'] }));
    P.push({ t: [a.u1, a.zApp + 0.9, 'vers l’ouvrage →', 0.3, 'TEXTE', 'end'] });
    return { id: 'culee-' + a.nom, groupe: 'coffrage', titre: `Culée ${a.nom} — coupe perpendiculaire à la ligne d’appui (mur de front ${fm(a.Lm)} m, murs en retour ${fm(c.lr)} × ${fm(c.er)} m)`, prim: P };
  }
  function vuePile(R, a) {
    const s = R.s, P = [], dx = a.L + 4;
    // élévation dans le plan de la ligne d'appui (w), puis coupe (u) décalée
    P.push(rect(-a.L / 2, a.zsem, a.L / 2, a.zst, 'COFFRAGE'));
    for (let k = 0; k < a.nfut; k++) { const wc = -a.Lp / 2 + a.larfut / 2 + k * a.entraxeFut; P.push(rect(wc - a.larfut / 2, a.zst, wc + a.larfut / 2, a.zSom, 'COFFRAGE')); }
    R.tabA.app[a.j].y.forEach((y) => P.push(rect(y / R.geo.sn - 0.25, a.zSom, y / R.geo.sn + 0.25, a.zApp, 'APPAREILS')));
    if (a.piles) [...new Set(a.piles.map((q) => q.y))].forEach((w) => P.push(rect(w - s.fond.pieux.D / 2, a.zsem - s.fond.pieux.L, w + s.fond.pieux.D / 2, a.zsem, 'FONDATIONS')));
    P.push({ l: [-a.L / 2 - 1, s.zTN, a.L / 2 + 1, s.zTN, 'TERRAIN'] });
    P.push({ cote: [-a.L / 2, a.L / 2, a.zsem - 0.7 - (a.piles ? s.fond.pieux.L : 0), 'semelle ' + fm(a.L)] });
    P.push({ cote: [-a.Lp / 2, a.Lp / 2, a.zSom + 0.8, (a.nfut > 1 ? a.nfut + ' fûts de ' + fm(a.larfut) : 'voile ') + ' — ' + fm(a.Lp)] });
    P.push({ coteV: [a.L / 2 + 0.6, a.zst, a.zSom, 'fût ' + fm(a.hfut)] });
    P.push({ t: [0, a.zApp + 1.6, 'Élévation (le long de la ligne d’appui)', 0.3, 'TEXTE', 'middle'] });
    // coupe
    const o = a.L / 2 + 2 + a.B / 2;
    P.push(rect(o + a.u0, a.zsem, o + a.u1, a.zst, 'COFFRAGE'));
    P.push(rect(o - a.e / 2, a.zst, o + a.e / 2, a.zSom, 'COFFRAGE'));
    P.push(rect(o - 0.25, a.zSom, o + 0.25, a.zApp, 'APPAREILS'));
    P.push({ l: [o, a.zApp + 1.0, o, a.zsem - 0.5, 'AXES'] });
    P.push({ cote: [o + a.u0, o + a.u1, a.zsem - 0.7 - (a.piles ? s.fond.pieux.L : 0), fm(a.B)] });
    P.push({ cote: [o - a.e / 2, o + a.e / 2, a.zSom + 0.8, fm(a.e)] });
    P.push({ coteV: [o + a.u1 + 0.6, a.zsem, a.zst, fm(a.es)] });
    if (a.piles) [...new Set(a.piles.map((q) => q.x))].forEach((u) => P.push(rect(o + a.uc + u - s.fond.pieux.D / 2, a.zsem - s.fond.pieux.L, o + a.uc + u + s.fond.pieux.D / 2, a.zsem, 'FONDATIONS')));
    P.push({ t: [o, a.zApp + 1.6, 'Coupe', 0.3, 'TEXTE', 'middle'] });
    [[a.zsem, 'sous-face'], [a.zst, 'arase'], [a.zSom, 'sommier']].forEach(([z, l]) => P.push({ t: [o + a.u1 + 1.6, z, l + ' ' + fm(z), 0.28, 'TEXTE', 'start'] }));
    void dx;
    return { id: 'pile-' + a.nom, groupe: 'coffrage', titre: `Pile ${a.nom} — élévation et coupe`, prim: P };
  }
  function vueGabaritTablier(R) {
    const G = R.geo, g = R.gabarit, P = [], aL = G.appuis[g.travee - 1], aR = G.appuis[g.travee];
    // section droite perpendiculaire à l'obstacle (abscisse s = (x − xL)·sinφ), au droit du point le plus bas de la sous-face
    const S = (x) => (x - g.xL) * G.sn, zs = (x) => G.zSF(x + g.ptMin.y * G.cs / G.sn);
    const sL = 0, sR = g.Wdispo, zb = g.zObs - 1.0;
    P.push(rect(sL - 1.2, zb, sL, zs(g.xL) - 0.2, 'COFFRAGE'));
    P.push(rect(sR, zb, sR + 1.2, zs(g.xR) - 0.2, 'COFFRAGE'));
    P.push({ p: [[sL - 1.2, zs(g.xL)], [sR + 1.2, zs(g.xR)], [sR + 1.2, zs(g.xR) + G.hT], [sL - 1.2, zs(g.xL) + G.hT]], calque: 'COFFRAGE', ferme: true });
    P.push({ l: [sL - 2, g.zObs, sR + 2, g.zObs, 'TERRAIN'] });
    const c = S(g.xc);
    P.push(rect(c - g.Wreq / 2, g.zObs, c + g.Wreq / 2, g.zObs + g.Hreq, 'GABARIT'));
    P.push({ l: [c, g.zObs - 0.6, c, g.zObs + g.Hreq + 0.6, 'AXES'] });
    P.push({ cote: [sL, sR, zb - 0.6, 'ouverture droite ' + fm(g.Wdispo)] });
    P.push({ cote: [c - g.Wreq / 2, c + g.Wreq / 2, g.zObs + 0.5, 'gabarit ' + fm(g.Wreq)] });
    P.push({ cote: [sL, c - g.Wreq / 2, g.zObs - 0.4, fm(g.margeG)] }); P.push({ cote: [c + g.Wreq / 2, sR, g.zObs - 0.4, fm(g.margeD)] });
    P.push({ coteV: [c + g.Wreq / 2 + 0.4, g.zObs, g.zObs + g.Hreq, 'requis ' + fm(g.Hreq)] });
    P.push({ coteV: [c - g.Wreq / 2 - 0.4, g.zObs, g.zSFmin, 'libre ' + fm(g.Hdispo)] });
    P.push({ t: [sL - 0.6, zb + 0.3, aL.nom, 0.35, 'TEXTE', 'middle'] }); P.push({ t: [sR + 0.6, zb + 0.3, aR.nom, 0.35, 'TEXTE', 'middle'] });
    return { id: 'gabarit', groupe: 'gabarit', titre: `Vérification du gabarit ${g.type === 'rail' ? 'ferroviaire' : 'routier'} — travée ${g.travee}, section perpendiculaire à la voie franchie`, prim: P };
  }

  function vuesCadre(R) {
    const s = R.s, C = R.cadre, d = C.d, G = R.geo, cadre = G.cadre, V = [], g = R.gabarit;
    const o = d.ouv, e = d.eppied, zB = G.zBase, zI = G.zIntrados, zT = G.zTopTrav, zs = G.zsem;
    const gsup = (h, l) => (h > 0 && l > 0 ? [Math.min(h, l / 3), l] : null);
    /* coupe droite (perpendiculaire aux piédroits) */
    const cp = [], gs = gsup(d.haugousup, d.longousup), gi = cadre ? gsup(d.haugouinf, d.longouinf) : null;
    const outer = [], Lc = o / 2 + e;
    if (cadre) {
      cp.push({ p: [[-Lc, zs], [Lc, zs], [Lc, zT], [-Lc, zT]], calque: 'COFFRAGE', ferme: true });
      const inn = [[-o / 2, zB + (gi ? gi[0] : 0)], [-o / 2 + (gi ? gi[1] : 0), zB], [o / 2 - (gi ? gi[1] : 0), zB], [o / 2, zB + (gi ? gi[0] : 0)], [o / 2, zI - (gs ? gs[0] : 0)], [o / 2 - (gs ? gs[1] : 0), zI], [-o / 2 + (gs ? gs[1] : 0), zI], [-o / 2, zI - (gs ? gs[0] : 0)]];
      cp.push({ p: inn, calque: 'COFFRAGE', ferme: true });
    } else {
      const xt = Lc + d.lartal, xp = o / 2 - d.larpat;
      const g0 = gs ? gs[0] : 0, g1 = gs ? gs[1] : 0;
      cp.push({ p: [[-xt, zs], [-xp, zs], [-xp, zB], [-o / 2, zB], [-o / 2, zI - g0], [-(o / 2 - g1), zI], [o / 2 - g1, zI], [o / 2, zI - g0], [o / 2, zB], [xp, zB], [xp, zs], [xt, zs], [xt, zB], [Lc, zB], [Lc, zT], [-Lc, zT], [-Lc, zB], [-xt, zB]], calque: 'COFFRAGE', ferme: true });
      cp.push({ cote: [Lc, Lc + d.lartal, zs - 1.3, 'talon ' + fm(d.lartal)] }); cp.push({ cote: [o / 2 - d.larpat, o / 2, zs - 1.3, 'patin ' + fm(d.larpat)] });
    }
    void outer;
    const zFill = zT + d.epetan + d.eprem, zBal = zFill + d.epbal;
    if (d.eprem > 0) cp.push(rect(-Lc - 1, zT + d.epetan, Lc + 1, zFill, 'TERRAIN'));
    cp.push({ l: [-Lc - 4, zBal, Lc + 4, zBal, 'PROFIL'] });
    cp.push({ t: [Lc + 4.2, zBal, 'rail ' + fm(s.zRail0), 0.3, 'TEXTE', 'start'] });
    cp.push({ l: [-Lc - 4, s.gab.zObs, Lc + 4, s.gab.zObs, 'TERRAIN'] });
    if (g) { const c = g.dec; cp.push(rect(c - g.Wreq / 2, g.zObs, c + g.Wreq / 2, g.zObs + g.Hreq, 'GABARIT')); }
    cp.push({ cote: [-o / 2, o / 2, zs - 0.7, 'ouverture ' + fm(o)] });
    cp.push({ cote: [-Lc, -o / 2, zs - 0.7, fm(e)] });
    cp.push({ coteV: [Lc + (cadre ? 0 : d.lartal) + 0.8, zB, zI, 'hauteur ' + fm(d.hauint)] });
    cp.push({ coteV: [Lc + (cadre ? 0 : d.lartal) + 0.8, zI, zT, fm(d.eptra)] });
    cp.push({ coteV: [Lc + (cadre ? 0 : d.lartal) + 0.8, zs, zB, fm(cadre ? d.eprad : d.hausem)] });
    if (d.eprem > 0) cp.push({ coteV: [-Lc - 1.5, zT, zFill, 'remblai ' + fm(d.eprem)] });
    [[zs, 'sous-face'], [zB, cadre ? 'dessus radier' : 'arase semelles'], [zI, 'intrados'], [zT, 'extrados']].forEach(([z, l]) => cp.push({ t: [-Lc - (cadre ? 0 : d.lartal) - 2.5, z, l + ' ' + fm(z), 0.28, 'TEXTE', 'end'] }));
    V.push({ id: 'coupe', groupe: 'ensemble', titre: `Plan d’ensemble : coupe droite du ${cadre ? 'cadre' : 'portique'} (perpendiculaire aux piédroits, cotes NGF)`, prim: cp });
    /* vue en plan biaise */
    const pl = [], sn = G.sn, cs = G.cs, Lt = d.lontottab, Lp = d.lonpied;
    const P = (u, w) => [u / sn + w * cs, w * sn];      // u : abscisse droite perpendiculaire aux piédroits ; w : le long des piédroits
    const quad = (u0, u1, w0, w1, cq) => ({ p: [P(u0, w0), P(u1, w0), P(u1, w1), P(u0, w1)], calque: cq, ferme: true });
    pl.push(quad(-Lc, Lc, -Lt / 2, Lt / 2, 'COFFRAGE'));
    pl.push(quad(-Lc, -o / 2, -Lp / 2, Lp / 2, 'CACHE')); pl.push(quad(o / 2, Lc, -Lp / 2, Lp / 2, 'CACHE'));
    if (!cadre) { pl.push(quad(-Lc - d.lartal, -o / 2 + d.larpat, -Lp / 2, Lp / 2, 'CACHE')); pl.push(quad(o / 2 - d.larpat, Lc + d.lartal, -Lp / 2, Lp / 2, 'CACHE')); }
    pl.push({ l: [-Lc / sn - 6, 0, Lc / sn + 6, 0, 'AXES'] }); pl.push({ t: [Lc / sn + 6.2, 0.2, 'axe de la voie portée', 0.35, 'TEXTE', 'start'] });
    if (s.nVoies === 2) [d.axevoi1, d.axevoi2].forEach((y, v) => { pl.push({ l: [-Lc / sn - 3, y, Lc / sn + 3, y, 'AXES'] }); pl.push({ t: [-Lc / sn - 3.2, y + 0.15, 'V' + (v + 1), 0.35, 'TEXTE', 'end'] }); });
    pl.push({ l: [...P(g ? g.dec : 0, -Lp / 2 - 3), ...P(g ? g.dec : 0, Lp / 2 + 3), 'GABARIT'] });
    pl.push({ t: [...P(g ? g.dec : 0, Lp / 2 + 3.3), 'voie franchie', 0.35, 'TEXTE', 'middle'] });
    pl.push({ t: [P(Lc, -Lt / 2)[0] + 0.5, P(Lc, -Lt / 2)[1], 'biais ' + fm(s.biais) + ' gr', 0.35, 'TEXTE', 'start'] });
    V.push({ id: 'implantation', groupe: 'ensemble', titre: 'Plan d’implantation (vue en plan biaise)', prim: pl, flipY: true });
    if (g) {
      const gp = [];
      gp.push(rect(-o / 2 - e, zB - 0.5, -o / 2, zI, 'COFFRAGE')); gp.push(rect(o / 2, zB - 0.5, o / 2 + e, zI, 'COFFRAGE'));
      gp.push(rect(-o / 2 - e, zI, o / 2 + e, zT, 'COFFRAGE'));
      gp.push({ l: [-o / 2 - 1, g.zObs, o / 2 + 1, g.zObs, 'TERRAIN'] });
      gp.push(rect(g.dec - g.Wreq / 2, g.zObs, g.dec + g.Wreq / 2, g.zObs + g.Hreq, 'GABARIT'));
      gp.push({ cote: [-o / 2, o / 2, zB - 1.0, 'ouverture ' + fm(o)] });
      gp.push({ cote: [g.dec - g.Wreq / 2, g.dec + g.Wreq / 2, g.zObs + 0.4, 'gabarit ' + fm(g.Wreq)] });
      gp.push({ coteV: [g.dec + g.Wreq / 2 + 0.3, g.zObs, g.zObs + g.Hreq, 'requis ' + fm(g.Hreq)] });
      gp.push({ coteV: [g.dec - g.Wreq / 2 - 0.3, g.zObs, g.zObs + g.Hdispo, 'libre ' + fm(g.Hdispo)] });
      V.push({ id: 'gabarit', groupe: 'gabarit', titre: `Vérification du gabarit ${g.type === 'rail' ? 'ferroviaire' : 'routier'} sous l’ouvrage`, prim: gp });
    }
    return V;
  }

  /* rendu SVG (sans DOM) */
  const STY = {
    COFFRAGE: ['#14171f', 1.3, '', 'rgba(168,132,42,.08)'], CACHE: ['#6f7484', 0.8, '5 3', 'none'], AXES: ['#c0392b', 0.7, '10 3 2 3', 'none'],
    APPAREILS: ['#0f8f7b', 0.9, '', 'rgba(15,143,123,.15)'], POUTRELLES: ['#2d6be4', 0.8, '', 'rgba(45,107,228,.10)'], PERCAGE: ['#a8842a', 0.9, '', 'none'],
    TERRAIN: ['#8a6d3b', 1.0, '', 'rgba(138,109,59,.08)'], GABARIT: ['#c27a12', 1.2, '6 3', 'rgba(194,122,18,.06)'], PROFIL: ['#2d6be4', 1.0, '', 'none'],
    FONDATIONS: ['#5b4a8a', 0.9, '', 'rgba(91,74,138,.08)'], TEXTE: ['#4a4f5c', 0.6, '', 'none'], COTES: ['#6f7484', 0.6, '', 'none'],
  };
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let svgN = 0;
  function svgVue(v, o = {}) {
    const W = o.w || 900, pad = 40, pts = [];
    const add = (x, y) => { if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]); };
    for (const p of v.prim) {
      if (p.l) { add(p.l[0], p.l[1]); add(p.l[2], p.l[3]); }
      if (p.p) p.p.forEach(([x, y]) => add(x, y));
      if (p.c) { add(p.c[0] - p.c[2], p.c[1] - p.c[2]); add(p.c[0] + p.c[2], p.c[1] + p.c[2]); }
      if (p.t) add(p.t[0], p.t[1]);
      if (p.cote) { add(p.cote[0], p.cote[2]); add(p.cote[1], p.cote[2]); }
      if (p.coteV) { add(p.coteV[0], p.coteV[1]); add(p.coteV[0], p.coteV[2]); }
    }
    if (!pts.length) return '';
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    let sc = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1e-6), (o.hmax || 420) / Math.max(y1 - y0, 1e-6));
    // place des textes ancrés à gauche ou à droite (largeur estimée 5,6 px par caractère)
    for (let it = 0; it < 2; it++) {
      let a0 = x0, a1 = x1;
      for (const p of v.prim) if (p.t) { const w = String(p.t[2]).length * 5.6 / sc, an = p.t[5] || 'start'; if (an === 'end') a0 = Math.min(a0, p.t[0] - w); else if (an === 'start') a1 = Math.max(a1, p.t[0] + w); else { a0 = Math.min(a0, p.t[0] - w / 2); a1 = Math.max(a1, p.t[0] + w / 2); } }
      x0 = a0; x1 = a1; sc = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1e-6), (o.hmax || 420) / Math.max(y1 - y0, 1e-6));
    }
    const H = (y1 - y0) * sc + 2 * pad, id = 'ot' + (++svgN);
    const X = (x) => (pad + (x - x0) * sc).toFixed(1), Y = (y) => (v.flipY ? pad + (y - y0) * sc : pad + (y1 - y) * sc).toFixed(1);
    let s = '';
    for (const p of v.prim) {
      if (p.p) { const st = STY[p.calque] || STY.COFFRAGE; s += `<polygon points="${p.p.map(([x, y]) => X(x) + ',' + Y(y)).join(' ')}" fill="${p.calque === 'COFFRAGE' && v.groupe !== 'coffrage' && v.id.startsWith('tab-') ? 'rgba(168,132,42,.07)' : st[3]}" stroke="${st[0]}" stroke-width="${st[1]}"${st[2] ? ` stroke-dasharray="${st[2]}"` : ''}/>`; }
      if (p.l) { const st = STY[p.l[4]] || STY.COFFRAGE; s += `<line x1="${X(p.l[0])}" y1="${Y(p.l[1])}" x2="${X(p.l[2])}" y2="${Y(p.l[3])}" stroke="${st[0]}" stroke-width="${st[1]}"${st[2] ? ` stroke-dasharray="${st[2]}"` : ''}/>`; }
      if (p.c) { const st = STY[p.c[3]] || STY.COFFRAGE; s += `<circle cx="${X(p.c[0])}" cy="${Y(p.c[1])}" r="${Math.max(1.6, p.c[2] * sc).toFixed(1)}" fill="${st[3]}" stroke="${st[0]}" stroke-width=".9"/>`; }
      if (p.t) s += `<text x="${X(p.t[0])}" y="${Y(p.t[1])}" text-anchor="${p.t[5] || 'start'}" style="font-size:10.5px;fill:#4a4f5c">${esc(p.t[2])}</text>`;
      if (p.cote) { const [a, b, y, t] = p.cote; s += `<line x1="${X(a)}" y1="${Y(y)}" x2="${X(b)}" y2="${Y(y)}" stroke="#6f7484" stroke-width=".6" marker-start="url(#${id})" marker-end="url(#${id})"/><line x1="${X(a)}" y1="${(+Y(y) - 5).toFixed(1)}" x2="${X(a)}" y2="${(+Y(y) + 5).toFixed(1)}" stroke="#6f7484" stroke-width=".6"/><line x1="${X(b)}" y1="${(+Y(y) - 5).toFixed(1)}" x2="${X(b)}" y2="${(+Y(y) + 5).toFixed(1)}" stroke="#6f7484" stroke-width=".6"/><text x="${((+X(a) + +X(b)) / 2).toFixed(1)}" y="${(+Y(y) - 4).toFixed(1)}" text-anchor="middle" style="font-size:10px;fill:#6f7484">${esc(t)}</text>`; }
      if (p.coteV) { const [x, a, b, t] = p.coteV; s += `<line x1="${X(x)}" y1="${Y(a)}" x2="${X(x)}" y2="${Y(b)}" stroke="#6f7484" stroke-width=".6" marker-start="url(#${id})" marker-end="url(#${id})"/><text x="${(+X(x) + 4).toFixed(1)}" y="${((+Y(a) + +Y(b)) / 2 + 3).toFixed(1)}" style="font-size:10px;fill:#6f7484">${esc(t)}</text>`; }
    }
    return `<svg class="plan" viewBox="0 0 ${W} ${H.toFixed(0)}" role="img" aria-label="${esc(v.titre)}"><defs><marker id="${id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 2 L10 5 L0 8z" fill="#6f7484"/></marker></defs>${s}</svg>`;
  }

  /* DXF R12 ASCII (AC1009), unité le mètre, vues placées les unes sous les autres ; accents en \U+XXXX ;
   * tables LTYPE (CONTINUOUS, DASHED, CENTER) et LAYER déclarées (d'après la structure de ferraillage/dxf.js). */
  function dxf(vs) {
    const o = [], E = (...a) => { for (let i = 0; i < a.length; i += 2) o.push(String(a[i]), String(a[i + 1])); };
    const enc = (t) => String(t).replace(/[^\x20-\x7e]/g, (c) => '\\U+' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));
    const n4 = (v) => (Number.isFinite(v) ? v : 0).toFixed(4);
    const LAY = { COFFRAGE: [7, 'CONTINUOUS'], CACHE: [8, 'DASHED'], AXES: [1, 'CENTER'], APPAREILS: [3, 'CONTINUOUS'], POUTRELLES: [5, 'CONTINUOUS'], PERCAGE: [2, 'CONTINUOUS'],
      TERRAIN: [32, 'CONTINUOUS'], GABARIT: [30, 'DASHED'], PROFIL: [5, 'CONTINUOUS'], FONDATIONS: [6, 'CONTINUOUS'], TEXTE: [7, 'CONTINUOUS'], COTES: [8, 'CONTINUOUS'] };
    E(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$DWGCODEPAGE', 3, 'ANSI_1252', 9, '$INSUNITS', 70, 6, 9, '$LTSCALE', 40, 1, 0, 'ENDSEC');
    E(0, 'SECTION', 2, 'TABLES');
    E(0, 'TABLE', 2, 'LTYPE', 70, 3,
      0, 'LTYPE', 2, 'CONTINUOUS', 70, 0, 3, 'Solid line', 72, 65, 73, 0, 40, '0.0',
      0, 'LTYPE', 2, 'DASHED', 70, 0, 3, '__ __ __', 72, 65, 73, 2, 40, '0.3', 49, '0.2', 49, '-0.1',
      0, 'LTYPE', 2, 'CENTER', 70, 0, 3, '___ _ ___', 72, 65, 73, 4, 40, '0.64', 49, '0.4', 49, '-0.08', 49, '0.08', 49, '-0.08', 0, 'ENDTAB');
    E(0, 'TABLE', 2, 'LAYER', 70, Object.keys(LAY).length + 1, 0, 'LAYER', 2, '0', 70, 0, 62, 7, 6, 'CONTINUOUS');
    for (const [n, [c, lt]] of Object.entries(LAY)) E(0, 'LAYER', 2, n, 70, 0, 62, c, 6, lt);
    E(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
    let dy = 0;
    for (const v of vs) {
      const ys = v.prim.flatMap((p) => (p.p ? p.p.map((q) => q[1]) : p.l ? [p.l[1], p.l[3]] : p.c ? [p.c[1]] : p.t ? [p.t[1]] : p.cote ? [p.cote[2]] : p.coteV ? [p.coteV[1], p.coteV[2]] : [])).filter(Number.isFinite);
      if (!ys.length) continue;
      const ymax = Math.max(...ys), ymin = Math.min(...ys), fl = v.flipY ? -1 : 1;
      const T = (y) => dy + fl * y - (fl > 0 ? ymax : -ymin);
      E(0, 'TEXT', 8, 'TEXTE', 10, 0, 20, n4(dy + 1.5), 30, 0, 40, 0.5, 1, enc(v.titre));
      for (const p of v.prim) {
        if (p.l) E(0, 'LINE', 8, p.l[4] || 'COFFRAGE', 10, n4(p.l[0]), 20, n4(T(p.l[1])), 30, 0, 11, n4(p.l[2]), 21, n4(T(p.l[3])), 31, 0);
        if (p.c) E(0, 'CIRCLE', 8, p.c[3], 10, n4(p.c[0]), 20, n4(T(p.c[1])), 30, 0, 40, n4(p.c[2]));
        if (p.t) E(0, 'TEXT', 8, 'TEXTE', 10, n4(p.t[0]), 20, n4(T(p.t[1])), 30, 0, 40, p.t[3], 1, enc(p.t[2]));
        if (p.p) { E(0, 'POLYLINE', 8, p.calque, 66, 1, 70, p.ferme ? 1 : 0); for (const [x, y] of p.p) E(0, 'VERTEX', 8, p.calque, 10, n4(x), 20, n4(T(y)), 30, 0); E(0, 'SEQEND', 8, p.calque); }
        if (p.cote) { const [a, b, y, t] = p.cote; E(0, 'LINE', 8, 'COTES', 10, n4(a), 20, n4(T(y)), 30, 0, 11, n4(b), 21, n4(T(y)), 31, 0); E(0, 'TEXT', 8, 'COTES', 10, n4((a + b) / 2), 20, n4(T(y) + 0.1), 30, 0, 40, 0.25, 1, enc(t)); }
        if (p.coteV) { const [x, a, b, t] = p.coteV; E(0, 'LINE', 8, 'COTES', 10, n4(x), 20, n4(T(a)), 30, 0, 11, n4(x), 21, n4(T(b)), 31, 0); E(0, 'TEXT', 8, 'COTES', 10, n4(x + 0.1), 20, n4((T(a) + T(b)) / 2), 30, 0, 40, 0.25, 1, enc(t)); }
      }
      dy -= (ymax - ymin) + 8;
    }
    E(0, 'ENDSEC', 0, 'EOF');
    return o.join('\r\n') + '\r\n';
  }

  /* ═══════════════════════ 13. Pré-remplissage des pages des modules ═══════════════════════ */
  /* clés et formats de sauvegarde lus par chaque page (BA.store.load(clé) à l'ouverture) */
  function appmobilPage(R, ap) {
    const p = ap.plaque || { a: 0.4, b: 0.5, n: 4, ti: 0.012, ts: 0.004, te: 0.0025, c: 0.005 };
    const v = R.rephorInp;
    return {
      gen: { regl: v.reglApp === 'setra2000' ? 'setra2000' : 'en1337', mode: ap.plaque ? 'verif' : 'dim', forme: 'rect', ouvrage: R.t.ouvrage, projet: (R.s.projet || '') + ' — ' + ap.nom },
      plaque: { a: Math.round(p.a * 1000), b: Math.round(p.b * 1000), D: Math.round(p.a * 1000), n: p.n, ti: +(p.ti * 1000).toFixed(1), ts: +(p.ts * 1000).toFixed(1), te: +((p.te ?? 0.0025) * 1000).toFixed(1), c: +((p.c ?? 0.005) * 1000).toFixed(1) },
      mat: { G: v.Gld ?? 0.9, Gd: v.Gcd ?? 1.8, fy: v.fyFrette ?? 235, acier: 'fe360', sigLim: v.sigLim ?? 15, alpha0: v.alpha0 ?? 0.003, kAlpha0: 1.35, Kf: 0.6, Eb: 2000, gm: 1, hmode: 'v', soulev: true },
      combis: (ap.combis || []).map((c) => ({ type: c.type, Nld: +c.Nld.toFixed(2), Ncd: +c.Ncd.toFixed(2), Hxld: +c.Hxld.toFixed(5), Hyld: +c.Hyld.toFixed(5), Hxcd: +c.Hxcd.toFixed(2), Hycd: +c.Hycd.toFixed(2), aa: c.aa, ab: c.ab, vx: +(c.Hxld || 0).toFixed(5), vy: +(c.Hyld || 0).toFixed(5) })),
      liv: { Nmax: 4506.2, Nmin: 839.88, amin: 0.000651, Nmin1: 0, amin1: 0, Neles: 637.83, Heles: 47.22 },
      elu: [{ N: 5774.8, H2x: 26, H2y: 3.4, aT: 0.0002, u1x: 0.0105, u1y: 0.0017 }],
    };
  }
  function preremplissage(R, quoi, idx = 0) {
    if (quoi === 'tablier-rail' || quoi === 'tablier-route') return R.tabInp && R.tabCle === quoi ? Object.assign(clone(R.tabInp), { _v: 1 }) : null;
    if (quoi === 'efforts-horizontaux') return R.rephorPage ? clone(R.rephorPage) : null;
    if (quoi === 'appareils-appui') { const ap = (R.appareils || []).filter((a) => a.app === 'elasto')[idx]; return ap ? appmobilPage(R, ap) : null; }
    if (quoi === 'fondations') { const f = R.fond[idx]; return f ? clone(f.page) : null; }
    if (quoi === 'cadres-portiques') return R.cadInp ? clone(R.cadInp) : null;
    if (quoi === 'sondages-pressio') return { s: clone(R.sps) };
    return null;
  }

  const api = { TYPES, EN_COURS, MODULES, adapter, tablierInputRoute, disponible, defaut, normaliser, tablierInput, rephorInput, REPHOR_V, cadreInput, geoTablier, descente, fondatioInput, fondatioPage,
    gabarit, metres, metresCSV, integ, verdicts, calcul, implantation, vues, svgVue, dxf, preremplissage, appmobilPage, HRAIL, HTRAV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.BA = root.BA || {}; root.BA.ouvragesTypes = api; }
})(typeof window !== 'undefined' ? window : globalThis);
