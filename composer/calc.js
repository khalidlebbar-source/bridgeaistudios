/* BridgeAI Studios — Bridge Composer : modèle de l'ouvrage.
 *
 * Configurateur v1 : à partir de la composition choisie (type de tablier, travées, piles, culées,
 * fondations, équipements), le module calcule
 *   - le prédimensionnement (élancements SETRA, géométrie de la coupe transversale) ;
 *   - une descente de charges ESTIMÉE par ligne d'appui (EN 1991-2 ou Fascicule 61 titre II / UIC 71),
 *     lignes d'influence triangulaires, coefficients de continuité forfaitaires ;
 *   - les appareils d'appui, joints, fondations (semelles ou pieux) ;
 *   - les métrés (béton, aciers, coffrages, équipements) et un chiffrage à prix unitaires modifiables.
 * Tout résultat est indicatif : il prépare la note de calcul, il ne la remplace pas.
 *
 * Unités : m, kN, kg, MPa (contraintes), MN (capacité de pieu).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let GB = 25;                // béton armé, kN/m³ (hypothèse modifiable, fixée à chaque calcul)
  let HY = null;              // hypothèses du calcul en cours
  const RHO_S = 7850;         // acier, kg/m³
  const r05 = (v) => Math.ceil(v / 0.05 - 1e-6) * 0.05;
  const r10 = (v) => Math.ceil(v / 0.10 - 1e-6) * 0.10;
  const rnd = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const fr = (v, d) => (+v).toFixed(d).replace(/^-(0[.,]?0*)$/, '$1').replace('.', ',');
  const frn = (v) => String(rnd(+v, 2)).replace('.', ',');
  const num = (v, def) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : def);

  /* ───────── Catalogue des tabliers ─────────
   * dom   : domaine d'emploi usuel (portée maxi, m) ;
   * lam   : élancement h/L (L / lam) — iso : travées indépendantes, cont : travées continues ;
   * ratio : aciers passifs kg/m³ ; prec : précontrainte kg/m³ de béton précontraint. */
  const TYPES = {
    PSIDA: {
      nom: 'PSI-DA', titre: 'Dalle en béton armé', famille: 'dalle', iso: true, cont: true, contDef: true,
      dom: { route: [6, 18], rail: [5, 15] },
      lam: { route: { iso: 19, cont: 26 }, rail: { iso: 13, cont: 16 } },
      hmin: { route: 0.35, rail: 0.5 }, ratio: { route: 140, rail: 160 }, prec: { route: 0, rail: 0 },
      ref: 'SETRA, guide PSI-DA (1989) : L/20 (isostatique) à L/26 (continu) — plans KLE OA30 : 0,80 m pour 15 m.',
    },
    PSIDP: {
      nom: 'PSI-DP', titre: 'Dalle précontrainte', famille: 'dalle', iso: true, cont: true, contDef: true,
      dom: { route: [14, 30], rail: [12, 25] },
      lam: { route: { iso: 22, cont: 28 }, rail: { iso: 16, cont: 20 } },
      hmin: { route: 0.6, rail: 0.8 }, ratio: { route: 90, rail: 100 }, prec: { route: 30, rail: 35 },
      ref: 'SETRA, guide PSI-DP (1989) : élancement L/22 (isostatique) à L/28 (continu).',
    },
    VIPP: {
      nom: 'VIPP', titre: 'Poutres préfabriquées précontraintes par post-tension', famille: 'poutres', iso: true, cont: false, contDef: false,
      dom: { route: [30, 50], rail: [25, 45] },
      lam: { route: { iso: 16 }, rail: { iso: 13 } },
      hmin: { route: 1.5, rail: 1.9 }, ratio: { route: 120, rail: 130 }, ratioH: { route: 160, rail: 180 }, prec: { route: 50, rail: 55 },
      ref: 'SETRA, guide VIPP (1996) : L/16 à L/18 — plans KLE PRO2334 : 2,28 + 0,24 = 2,52 m pour 40 m.',
    },
    PRAD: {
      nom: 'PRAD', titre: 'Poutres précontraintes par adhérence', famille: 'poutres', iso: true, cont: false, contDef: false,
      dom: { route: [10, 35], rail: [10, 30] },
      lam: { route: { iso: 20 }, rail: { iso: 15 } },
      hmin: { route: 0.6, rail: 0.8 }, ratio: { route: 110, rail: 120 }, ratioH: { route: 150, rail: 170 }, prec: { route: 35, rail: 40 },
      ref: 'SETRA, guide PRAD (1996) : élancement de l’ordre de L/18 à L/22.',
    },
    PRP: {
      nom: 'PRP', titre: 'Poutrelles métalliques enrobées', famille: 'prp', iso: true, cont: true, contDef: false,
      dom: { route: [8, 30], rail: [6, 25] },
      lam: { route: { iso: 30, cont: 35 }, rail: { iso: 22, cont: 26 } },
      hmin: { route: 0.45, rail: 0.55 }, ratio: { route: 100, rail: 120 }, prec: { route: 0, rail: 0 },
      ref: 'SETRA, guide PRP (1995) : élancement L/25 à L/35 (route), plus massif en ferroviaire.',
    },
    MIXTE: {
      nom: 'Bipoutre', titre: 'Bipoutre mixte acier-béton', famille: 'mixte', iso: true, cont: true, contDef: true,
      dom: { route: [30, 100], rail: [25, 80] },
      lam: { route: { iso: 22, cont: 28 }, rail: { iso: 14, cont: 18 } },
      hmin: { route: 1.2, rail: 1.8 }, ratio: { route: 220, rail: 250 }, prec: { route: 0, rail: 0 },
      ref: 'SETRA, guide des ponts mixtes bipoutres : hauteur de poutre L/22 (iso) à L/28 (continu).',
    },
  };
  const TYPE_KEYS = Object.keys(TYPES);

  const PILES = {
    voile: { nom: 'Voile', desc: 'Fût plein, tête élargie si besoin' },
    colonnes: { nom: 'Colonnes', desc: 'Colonnes circulaires + chevêtre' },
    marteau: { nom: 'Marteau', desc: 'Fût unique + chevêtre en console' },
  };
  const CULEES = {
    enterree: { nom: 'Enterrée', desc: 'Sommier dans le remblai, talus 3/2' },
    remblayee: { nom: 'Remblayée', desc: 'Mur de front + murs en retour' },
  };

  /* Profilés HEB : hauteur (m), masse (kg/m), largeur (m) — poutrelles enrobées */
  const HEB = [[0.30, 117, 0.30], [0.32, 127, 0.30], [0.34, 134, 0.30], [0.36, 142, 0.30], [0.40, 155, 0.30],
    [0.45, 171, 0.30], [0.50, 187, 0.30], [0.55, 199, 0.30], [0.60, 212, 0.30], [0.65, 225, 0.30],
    [0.70, 241, 0.30], [0.80, 262, 0.30], [0.90, 291, 0.30], [1.00, 314, 0.30]];

  /* Appareils d'appui en élastomère fretté : a × b (mm) */
  const ELASTO = [[150, 200], [200, 250], [200, 300], [250, 300], [250, 400], [300, 400], [300, 500], [350, 450],
    [400, 500], [400, 600], [450, 600], [500, 600], [600, 600], [600, 700], [700, 700], [800, 800], [900, 900]];

  /* ───────── Prix unitaires indicatifs (MAD HT) ───────── */
  const PRIX = {
    betonTab: { des: 'Béton de tablier coulé en place', u: 'm³', pu: 1900 },
    betonPref: { des: 'Béton de poutres préfabriquées', u: 'm³', pu: 2600 },
    betonApp: { des: 'Béton d’appuis (piles, culées)', u: 'm³', pu: 1700 },
    betonFond: { des: 'Béton de fondations', u: 'm³', pu: 1500 },
    betonProp: { des: 'Béton de propreté', u: 'm³', pu: 900 },
    coffSoigne: { des: 'Coffrage soigné (parements vus)', u: 'm²', pu: 320 },
    coffOrd: { des: 'Coffrage ordinaire', u: 'm²', pu: 220 },
    acierHA: { des: 'Aciers HA façonnés posés', u: 'kg', pu: 18 },
    prec: { des: 'Précontrainte (câbles ou torons)', u: 'kg', pu: 75 },
    charpente: { des: 'Charpente métallique fournie, posée, protégée', u: 'kg', pu: 42 },
    profiles: { des: 'Poutrelles laminées fournies, posées', u: 'kg', pu: 30 },
    pieu: { des: 'Pieux forés (hors aciers)', u: 'ml', pu: 3600 },
    fouilles: { des: 'Fouilles en grande masse', u: 'm³', pu: 80 },
    remblaiT: { des: 'Remblai technique contigu', u: 'm³', pu: 180 },
    elasto: { des: 'Appareils d’appui en élastomère fretté', u: 'dm³', pu: 180 },
    joint: { des: 'Joints de chaussée', u: 'ml', pu: 9000 },
    etanch: { des: 'Étanchéité de tablier', u: 'm²', pu: 280 },
    enrobe: { des: 'Couche de roulement en enrobés', u: 'm²', pu: 220 },
    retenue: { des: 'Dispositif de retenue', u: 'ml', pu: 1800 },
    gardeCorps: { des: 'Garde-corps', u: 'ml', pu: 1500 },
    corniche: { des: 'Corniches préfabriquées', u: 'ml', pu: 1600 },
    gargouille: { des: 'Gargouilles et descentes d’eau', u: 'u', pu: 2500 },
    ballast: { des: 'Ballast', u: 'm³', pu: 450 },
    caniveau: { des: 'Caniveaux à câbles', u: 'ml', pu: 900 },
    installation: { des: 'Installation de chantier, études et essais', u: '%', pu: 8 },
    aleas: { des: 'Aléas et imprévus', u: '%', pu: 10 },
  };

  /* ───────── Hypothèses (zone « Hypothèses ») ───────── */
  const CLASSES_BETON = ['C25/30', 'C30/37', 'C35/45', 'C40/50', 'C45/55', 'C50/60'];
  function hypDefaults(usage, type) {
    const rail = usage === 'rail', pre = ['PSIDP', 'VIPP', 'PRAD'].includes(type);
    return {
      betonTab: pre ? 'C40/50' : 'C35/45', betonApp: 'C30/37', betonFond: 'C30/37', betonPieux: 'C30/37',
      acier: 'B500B', precontrainte: 'T15S — Y1860', charpente: 'S355',
      enrobTab: 3, enrobApp: 4, enrobFond: 5,
      gammaB: 25, gammaEnrobes: 24, gammaBallast: 20, gammaRemblai: 20,
      qTrottoir: 0,              // kN/m² ; 0 = valeur du règlement (EC 3,0 ; Fasc. 61 1,5)
      dT: 35, retrait: rail ? 3.0 : 3.0, kExc: 0, majCulees: 25,
      seismeA: 0.10, seismeClasse: 'courant',
      dureeVie: 100, exposition: 'XC4 / XF1',
      notes: '',
    };
  }

  /* ───────── Données par défaut ───────── */
  function defaults(usage) {
    const rail = usage === 'rail';
    return {
      projet: { nom: rail ? 'Pont-rail sur oued' : 'Pont-route sur oued', ouvrage: 'OA 1', moa: '', lieu: '', ref: '' },
      usage: rail ? 'rail' : 'route',
      reglement: 'EC',
      classe: 1,
      alpha: 1.33,
      profil: { roulable: 8.0, trottoirG: 1.25, trottoirD: 1.25, nbVoiesFer: 2, entraxe: 4.5, demiLarg: 2.75, largeurForcee: 0 },
      tablier: { type: rail ? 'PRP' : 'VIPP', h: 0, continu: null, dalleContinuite: true },
      travees: rail ? [19.4] : [30, 40, 40, 30],
      biais: 100,
      piles: { type: 'colonnes', hauteurs: rail ? [] : [7.5, 7.5, 7.5] },
      culees: { type: 'enterree', hauteurs: rail ? [5.5, 5.5] : [7.5, 7.5], dalleTransition: !rail },
      fond: { piles: 'superficielle', culees: rail ? 'pieux' : 'superficielle', sigma: 0.25, diam: 1.0, long: 15, qadm: 3.0 },
      equip: { retenue: rail ? 'GC' : 'BN4', corniches: true, etancheite: true, revetement: 0.06, gargouilles: !rail },
      prix: Object.fromEntries(Object.keys(PRIX).map((k) => [k, PRIX[k].pu])),
      devise: 'MAD',
      hyp: hypDefaults(rail ? 'rail' : 'route', rail ? 'PRP' : 'VIPP'),
    };
  }

  /* ───────── Normalisation des saisies ───────── */
  function normalize(src) {
    const S = JSON.parse(JSON.stringify(src || {}));
    const D = defaults(S.usage);
    const out = Object.assign({}, D, S);
    ['projet', 'profil', 'tablier', 'piles', 'culees', 'fond', 'equip'].forEach((k) => { out[k] = Object.assign({}, D[k], S[k] || {}); });
    out.prix = Object.assign({}, D.prix, S.prix || {});
    const HD = hypDefaults(out.usage, (S.tablier || {}).type);
    const h = out.hyp = Object.assign({}, HD, S.hyp || {});
    ['betonTab', 'betonApp', 'betonFond', 'betonPieux'].forEach((k) => { if (!CLASSES_BETON.includes(h[k])) h[k] = HD[k]; });
    const nb = (k, a, b) => { h[k] = clamp(num(h[k], HD[k]), a, b); };
    nb('enrobTab', 1, 10); nb('enrobApp', 1, 10); nb('enrobFond', 1, 10);
    nb('gammaB', 20, 30); nb('gammaEnrobes', 18, 26); nb('gammaBallast', 15, 25); nb('gammaRemblai', 15, 24);
    nb('qTrottoir', 0, 10); nb('dT', 0, 80); nb('retrait', 0, 10); nb('kExc', 0, 3); nb('majCulees', 0, 100);
    nb('seismeA', 0, 1); nb('dureeVie', 10, 150);
    if (!['strategique', 'important', 'courant'].includes(h.seismeClasse)) h.seismeClasse = 'courant';
    ['acier', 'precontrainte', 'charpente', 'exposition', 'notes'].forEach((k) => { h[k] = String(h[k] == null ? HD[k] : h[k]).slice(0, k === 'notes' ? 4000 : 60); });
    Object.keys(out.prix).forEach((k) => { out.prix[k] = Math.max(0, num(out.prix[k], D.prix[k])); });
    out.usage = out.usage === 'rail' ? 'rail' : 'route';
    out.reglement = out.reglement === 'F61' ? 'F61' : 'EC';
    out.classe = clamp(Math.round(num(out.classe, 1)), 1, 3);
    out.alpha = clamp(num(out.alpha, 1.33), 0.75, 1.46);
    if (!TYPES[out.tablier.type]) out.tablier.type = D.tablier.type;
    const T = TYPES[out.tablier.type];
    out.tablier.h = Math.max(0, num(out.tablier.h, 0));
    if (out.tablier.continu === null || out.tablier.continu === undefined) out.tablier.continu = T.contDef;
    out.tablier.continu = !!out.tablier.continu && T.cont;
    if (!T.iso) out.tablier.continu = true;
    out.tablier.dalleContinuite = out.tablier.dalleContinuite !== false;
    let tr = (Array.isArray(out.travees) ? out.travees : String(out.travees).split(/[;\s]+/)).map((v) => num(v, NaN)).filter((v) => Number.isFinite(v));
    if (!tr.length) tr = D.travees.slice();
    out.travees = tr.slice(0, 12).map((v) => clamp(rnd(v, 2), 3, 150));
    const np = out.travees.length - 1;
    const hp = (Array.isArray(out.piles.hauteurs) ? out.piles.hauteurs : []).map((v) => clamp(num(v, 6), 1, 60));
    while (hp.length < np) hp.push(hp.length ? hp[hp.length - 1] : 6);
    out.piles.hauteurs = hp.slice(0, np);
    if (!PILES[out.piles.type]) out.piles.type = 'voile';
    if (!CULEES[out.culees.type]) out.culees.type = 'enterree';
    const hc = (Array.isArray(out.culees.hauteurs) ? out.culees.hauteurs : []).map((v) => clamp(num(v, 3.5), 0.5, 15));
    while (hc.length < 2) hc.push(hc.length ? hc[0] : 3.5);
    out.culees.hauteurs = hc.slice(0, 2);
    out.culees.dalleTransition = !!out.culees.dalleTransition;
    const p = out.profil;
    p.roulable = clamp(num(p.roulable, 8), 3, 30);
    p.trottoirG = clamp(num(p.trottoirG, 1.25), 0, 5);
    p.trottoirD = clamp(num(p.trottoirD, 1.25), 0, 5);
    p.nbVoiesFer = clamp(Math.round(num(p.nbVoiesFer, 2)), 1, 4);
    p.entraxe = clamp(num(p.entraxe, 4.5), 3.5, 6);
    p.demiLarg = clamp(num(p.demiLarg, 2.75), 2.5, 6);
    p.largeurForcee = Math.max(0, num(p.largeurForcee, 0));
    out.biais = clamp(num(out.biais, 100), 40, 100);
    const f = out.fond;
    f.piles = f.piles === 'pieux' ? 'pieux' : 'superficielle';
    f.culees = f.culees === 'pieux' ? 'pieux' : 'superficielle';
    f.sigma = clamp(num(f.sigma, 0.3), 0.05, 2);
    f.diam = [0.6, 0.8, 1.0, 1.2, 1.5].includes(+f.diam) ? +f.diam : 1.0;
    f.long = clamp(num(f.long, 15), 4, 60);
    f.qadm = clamp(num(f.qadm, 3), 0.3, 20);
    const e = out.equip;
    if (!['BN4', 'GBA', 'GC'].includes(e.retenue)) e.retenue = 'BN4';
    e.revetement = clamp(num(e.revetement, 0.06), 0, 0.2);
    e.corniches = !!e.corniches; e.etancheite = !!e.etancheite; e.gargouilles = !!e.gargouilles;
    return out;
  }

  /* Statut d'un type de tablier vis-à-vis des portées : ok / limite / hors domaine */
  function typeStatus(key, travees, usage) {
    const T = TYPES[key], [a, b] = T.dom[usage === 'rail' ? 'rail' : 'route'];
    const Lmax = Math.max.apply(null, travees);
    if (Lmax >= a && Lmax <= b) return { k: 'ok', txt: a + '–' + b + ' m' };
    if (Lmax >= a * 0.85 && Lmax <= b * 1.12) return { k: 'lim', txt: 'limite (' + a + '–' + b + ' m)' };
    return { k: 'hors', txt: 'hors domaine (' + a + '–' + b + ' m)' };
  }

  /* ───────── Polygone : aire et périmètre hors face supérieure ───────── */
  function area(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(a) / 2;
  }
  /* longueur des arêtes non situées à y = yTop (coffrage par mètre linéaire) */
  function coffLen(pts, yTop) {
    let l = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if (Math.abs(p[1] - yTop) < 1e-6 && Math.abs(q[1] - yTop) < 1e-6) continue;
      l += Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    return l;
  }

  /* ───────── Largeur et profil en travers ───────── */
  function profilEnTravers(S) {
    const p = S.profil, rail = S.usage === 'rail';
    if (rail) {
      const W = p.largeurForcee || rnd((p.nbVoiesFer - 1) * p.entraxe + 2 * p.demiLarg, 2);
      const axes = []; for (let i = 0; i < p.nbVoiesFer; i++) axes.push(-(p.nbVoiesFer - 1) * p.entraxe / 2 + i * p.entraxe);
      return { W, roulable: 0, trottoirs: 0, voiesFer: p.nbVoiesFer, axesVoies: axes };
    }
    const W0 = p.trottoirG + p.roulable + p.trottoirD;
    const W = p.largeurForcee || rnd(W0, 2);
    return { W, roulable: p.roulable, trottoirs: p.trottoirG + p.trottoirD, voiesFer: 0, axesVoies: [] };
  }

  /* ───────── Hauteur de tablier (prédimensionnement) ───────── */
  function predimH(S, T) {
    const u = S.usage, tr = S.travees, n = tr.length, lam = T.lam[u];
    const cont = S.tablier.continu && n > 1;
    let h, regle;
    if (cont) {
      const Lint = n > 2 ? Math.max.apply(null, tr.slice(1, -1)) : 0;
      const Lriv = Math.max(tr[0], tr[n - 1]);
      const hi = Lint / lam.cont, hr = Lriv / (lam.cont * 0.85);
      h = Math.max(hi, hr);
      regle = hr >= hi ? 'travée de rive ' + frn(Lriv) + ' m / (' + lam.cont + ' × 0,85)' : 'travée centrale ' + frn(Lint) + ' m / ' + lam.cont;
    } else {
      const L = Math.max.apply(null, tr);
      h = L / lam.iso;
      regle = 'portée ' + frn(L) + ' m / ' + lam.iso;
    }
    if (T.famille === 'mixte') {
      const hs = u === 'rail' ? 0.35 : 0.28;
      h = r05(h) + hs;
      regle += ' (poutre) + hourdis ' + fr(hs, 2) + ' m';
    }
    const hc = r05(h);
    if (T.hmin[u] > hc + 1e-9) regle += ' = ' + fr(hc, 2) + ' m → minimum constructif ' + fr(T.hmin[u], 2) + ' m';
    h = rnd(Math.max(T.hmin[u], hc), 2);
    return { h, regle, cont };
  }

  /* ───────── Coupe transversale du tablier ───────── */
  function section(S, T, PT, h0) {
    const rail = S.usage === 'rail', u = S.usage, W = PT.W;
    const polys = [], info = {};
    let h = h0;
    const add = (pts, mat, role) => polys.push({ pts, mat, role });
    let Abet = 0, Aprefa = 0, coff = 0, coffPrefa = 0, kgCharp = 0, kgProf = 0, bear = [], nbPoutres = 0, entraxe = 0;
    if (T.famille === 'dalle') {
      const lc = h >= 0.5 ? clamp(r05(0.15 * W), 0.5, Math.min(2.5, W * 0.25)) : 0;
      const et = rail ? 0.25 : 0.20, er = clamp(r05(0.45 * h + 0.02), et + 0.10, h);
      const Bn = W - 2 * lc;
      const pts = lc > 0
        ? [[-W / 2, 0], [W / 2, 0], [W / 2, -et], [Bn / 2, -er], [Bn / 2, -h], [-Bn / 2, -h], [-Bn / 2, -er], [-W / 2, -et]]
        : [[-W / 2, 0], [W / 2, 0], [W / 2, -h], [-W / 2, -h]];
      add(pts, 'beton', 'dalle');
      Abet = area(pts); coff = coffLen(pts, 0);
      Object.assign(info, { lc, et, er, Bn });
      const nb = Math.max(2, Math.ceil((Bn - 1.0) / 3.0) + 1), sp = (Bn - 1.0) / (nb - 1);
      for (let i = 0; i < nb; i++) bear.push(-(Bn - 1.0) / 2 + i * sp);
    } else if (T.famille === 'prp') {
      const s = rail ? 0.60 : 0.70;
      const target = h - 0.15;
      let prof = HEB.find((p) => p[0] >= target - 1e-6);
      if (!prof) { prof = HEB[HEB.length - 1]; info.profilMax = true; }
      h = Math.max(h, r05(prof[0] + 0.10));
      const n = Math.max(2, Math.floor((W - 0.7) / s) + 1), sp = (W - 0.7) / (n - 1);
      const As = prof[1] / RHO_S;
      const pts = [[-W / 2, 0], [W / 2, 0], [W / 2, -h], [-W / 2, -h]];
      add(pts, 'beton', 'dalle');
      const hp = prof[0], bf = prof[2], tf = 0.019 + (hp - 0.3) * 0.024, tw = 0.011 + (hp - 0.3) * 0.011;
      for (let i = 0; i < n; i++) {
        const x = -(W - 0.7) / 2 + i * sp, yb = -h, yt = -h + hp;
        add([[x - bf / 2, yb], [x + bf / 2, yb], [x + bf / 2, yb + tf], [x + tw / 2, yb + tf], [x + tw / 2, yt - tf], [x + bf / 2, yt - tf],
          [x + bf / 2, yt], [x - bf / 2, yt], [x - bf / 2, yt - tf], [x - tw / 2, yt - tf], [x - tw / 2, yb + tf], [x - bf / 2, yb + tf]], 'acier', 'profile');
      }
      Abet = W * h - n * As; coff = W + 2 * h; kgProf = n * prof[1];
      Object.assign(info, { profil: 'HEB ' + Math.round(prof[0] * 1000), nbProfils: n, espacement: rnd(sp, 3), Bn: W });
      const nb = Math.max(2, Math.ceil((W - 1.0) / 3.0) + 1), spb = (W - 1.0) / (nb - 1);
      for (let i = 0; i < nb; i++) bear.push(-(W - 1.0) / 2 + i * spb);
    } else if (T.famille === 'poutres') {
      const vipp = S.tablier.type === 'VIPP';
      const eh = vipp ? (rail ? 0.25 : 0.24) : (rail ? 0.25 : 0.22);
      const rive = vipp ? 0.75 : 0.40;
      const n = vipp ? Math.max(2, Math.round((W - 2 * rive) / 3.0) + 1) : Math.max(3, Math.ceil(W / 1.4));
      const b = vipp ? (W - 2 * rive) / (n - 1) : W / n, x0 = vipp ? -W / 2 + rive : -W / 2 + b / 2, hb = h - eh;
      // VIPP : table 1,50, âme 0,24, talon 0,80 (rail 0,90) ; PRAD : poutre en I compacte
      const b0 = vipp ? 0.24 : 0.22, bt = vipp ? (rail ? 0.90 : 0.80) : 0.70, ht = vipp ? 0.25 : 0.20, gs = vipp ? 0.20 : 0.10;
      const btab = vipp ? Math.min(1.50, b - 0.30) : Math.min(b - 0.05, 1.20), etab = vipp ? 0.12 : 0.10, gtab = vipp ? 0.10 : 0.06;
      const ptsH = [[-W / 2, 0], [W / 2, 0], [W / 2, -eh], [-W / 2, -eh]];
      add(ptsH, 'beton', 'hourdis');
      let Ab = 0, cb = 0;
      for (let i = 0; i < n; i++) {
        const x = x0 + b * i, y0 = -eh, ya = y0 - etab, yb = ya - gtab, y1 = -(h - ht - gs), y2 = -(h - ht), y3 = -h;
        const pts = [[x - btab / 2, y0], [x + btab / 2, y0], [x + btab / 2, ya], [x + b0 / 2, yb], [x + b0 / 2, y1], [x + bt / 2, y2], [x + bt / 2, y3],
          [x - bt / 2, y3], [x - bt / 2, y2], [x - b0 / 2, y1], [x - b0 / 2, yb], [x - btab / 2, ya]];
        add(pts, 'beton', 'poutre');
        Ab += area(pts); cb += coffLen(pts, y0);
        bear.push(x);
      }
      Abet = W * eh; Aprefa = Ab; coff = (W - n * btab) + 2 * eh; coffPrefa = cb;
      nbPoutres = n; entraxe = b;
      Object.assign(info, { eh, hb, b0, bt, ht, btab, etab, x0, rive, Bn: W - 2 * rive + bt });
    } else { // mixte
      const hs = rail ? 0.35 : 0.28, te = rail ? 0.30 : 0.25;
      const a = Math.max(2.5, Math.round(0.55 * W * 10) / 10);
      const hp = h - hs;
      const bfs = rail ? 0.8 : 0.6, bfi = rail ? 1.1 : 0.8, tfs = rail ? 0.05 : 0.04, tfi = rail ? 0.07 : 0.06, tw = 0.022;
      const ptsH = [[-W / 2, 0], [W / 2, 0], [W / 2, -te], [a / 2 + bfs / 2, -hs], [-a / 2 - bfs / 2, -hs], [-W / 2, -te]];
      add(ptsH, 'beton', 'hourdis');
      [-a / 2, a / 2].forEach((x) => {
        const yt = -hs, yb = -h;
        add([[x - bfi / 2, yb], [x + bfi / 2, yb], [x + bfi / 2, yb + tfi], [x + tw / 2, yb + tfi], [x + tw / 2, yt - tfs], [x + bfs / 2, yt - tfs],
          [x + bfs / 2, yt], [x - bfs / 2, yt], [x - bfs / 2, yt - tfs], [x - tw / 2, yt - tfs], [x - tw / 2, yb + tfi], [x - bfi / 2, yb + tfi]], 'acier', 'poutre');
        bear.push(x);
      });
      const L = Math.max.apply(null, S.travees);
      const q = (rail ? 120 + 7.0 * L : 60 + 2.3 * L) * (S.tablier.continu ? 0.9 : 1);
      Abet = area(ptsH); coff = coffLen(ptsH, 0) - 2 * bfs; kgCharp = q * W;
      nbPoutres = 2; entraxe = a;
      Object.assign(info, { hs, te, hp: rnd(hp, 2), a, bfs, bfi, kgm2: Math.round(q), Bn: a + bfi });
    }
    return { polys, h, Abet, Aprefa, coff, coffPrefa, kgCharp, kgProf, bear, nbPoutres, entraxe, info };
  }

  /* ───────── Lignes d'influence (triangle) et charges roulantes ───────── */
  const eta = (x, Lg, Ld) => {
    if (Math.abs(x) < 1e-6) return 1;
    return x < 0 ? (Lg > 0 && x > -Lg ? 1 + x / Lg : 0) : (Ld > 0 && x < Ld ? 1 - x / Ld : 0);
  };
  function etaInt(a, b, Lg, Ld) { // ∫ η dx sur [a, b]
    const f = (x) => (x <= -Lg ? 0 : x <= 0 ? (Lg > 0 ? (x + Lg) ** 2 / (2 * Lg) : 0) : Lg / 2 + (x >= Ld ? Ld / 2 : (Ld > 0 ? x - x * x / (2 * Ld) : 0)));
    return f(Math.min(b, Ld)) - f(Math.max(a, -Lg));
  }
  /* maximum de Σ P·η pour un convoi d'essieux [[d, P]] (d depuis le premier essieu), dans les deux sens */
  function axleMax(axles, Lg, Ld) {
    const len = Math.max.apply(null, axles.map((a) => a[0]));
    let best = 0;
    for (const dir of [1, -1]) {
      for (let s = -Lg - len - 0.1; s <= Ld + len + 0.1; s += 0.05) {
        let v = 0;
        for (const [d, P] of axles) v += P * eta(s + dir * d, Lg, Ld);
        if (v > best) best = v;
      }
    }
    return best;
  }
  /* LM71 (par voie, hors α et Φ) : 4 × 250 kN à 1,6 m + 80 kN/m au-delà de 0,8 m des essieux extrêmes */
  function lm71(Lg, Ld) {
    let best = 0;
    for (let x0 = -Lg - 3.2; x0 <= Ld + 3.2; x0 += 0.05) {
      let v = 0;
      for (const d of [-2.4, -0.8, 0.8, 2.4]) v += 250 * eta(x0 + d, Lg, Ld);
      v += 80 * (etaInt(-1e4, x0 - 3.2, Lg, Ld) + etaInt(x0 + 3.2, 1e4, Lg, Ld));
      if (v > best) best = v;
    }
    return best;
  }
  /* SW/2 : 150 kN/m sur 2 × 25 m séparés de 7 m */
  function sw2(Lg, Ld) {
    let best = 0;
    for (let x0 = -Lg - 57; x0 <= Ld + 0.1; x0 += 0.1) {
      const v = 150 * (etaInt(x0, x0 + 25, Lg, Ld) + etaInt(x0 + 32, x0 + 57, Lg, Ld));
      if (v > best) best = v;
    }
    return best;
  }
  const BC_AXLES = [[0, 60], [4.5, 120], [6.0, 120], [10.5, 60], [15.0, 120], [16.5, 120]];

  /* Coefficients de répartition longitudinale des charges réparties (travées continues) */
  function kCont(j, n, cont) {
    if (!cont || n < 2) return 1;
    if (j === 0 || j === n) return 0.8;
    if (n === 2) return 1.25;
    return j === 1 || j === n - 1 ? 1.12 : 1.0;
  }

  /* Charges d'exploitation (valeur caractéristique) sur une ligne d'appui de portées adjacentes Lg, Ld */
  function trafic(S, PT, Lg, Ld, kc, g, ctx) {
    const l = Lg + Ld, rail = S.usage === 'rail', det = {};
    if (rail) {
      const nt = Math.min(PT.voiesFer, 2);
      const LPhi = ctx.LPhi, Phi = clamp(1.44 / (Math.sqrt(LPhi) - 0.2) + 0.82, 1, 1.67);
      const r71 = S.alpha * lm71(Lg, Ld) * Phi, rsw = sw2(Lg, Ld) * Phi;
      det.Phi = Phi; det.LM71 = r71; det.SW2 = rsw; det.voies = nt;
      det.mod = rsw > r71 ? 'SW/2' : (S.reglement === 'F61' ? 'UIC 71' : 'LM71');
      return { Q: nt * Math.max(r71, rsw), det };
    }
    const w = PT.roulable, trot = Math.max(0, PT.trottoirs - (S.profil.trottoirG > 0 ? 0.5 : 0) - (S.profil.trottoirD > 0 ? 0.5 : 0));
    if (S.reglement === 'EC') {
      const nl = Math.max(1, Math.floor(w / 3)), res = Math.max(0, w - 3 * nl);
      const C = S.classe;
      const aQ = C === 1 ? [1, 1, 1] : C === 2 ? [0.9, 0.8, 0.8] : [0.8, 0.7, 0.7];
      const aq1 = C === 1 ? 1 : C === 2 ? 0.7 : 0.5, aqi = C === 1 ? 1.2 : 1.0;
      const Qk = [300, 200, 100];
      const E2 = axleMax([[0, 1], [1.2, 1]], Lg, Ld);
      let ts = 0; for (let i = 0; i < Math.min(3, nl); i++) ts += aQ[i] * Qk[i];
      const qUDL = 3 * 9 * aq1 + (nl - 1) * 3 * 2.5 * aqi + res * 2.5 * aqi;
      const R_TS = E2 * ts, R_UDL = qUDL * l / 2 * kc, R_tr = (HY.qTrottoir || 3) * trot * l / 2 * kc;
      Object.assign(det, { voies: nl, TS: R_TS, UDL: R_UDL, trottoirs: R_tr, mod: 'LM1' });
      return { Q: R_TS + R_UDL + R_tr, det };
    }
    // Fascicule 61 titre II
    const C = S.classe;
    const n = w >= 6 ? Math.floor(w / 3) : (w >= 5 ? 2 : 1), v = w / n;
    const v0 = C === 1 ? 3.5 : C === 2 ? 3.0 : 2.75, a2 = v0 / v;
    const A1T = { 1: [1, 1, 0.9, 0.75, 0.7], 2: [1, 0.9], 3: [0.9, 0.8] }[C];
    const BCT = { 1: [1.2, 1.1, 0.95, 0.8, 0.7], 2: [1, 1], 3: [1, 0.8] }[C];
    const at = (t, k) => t[Math.min(k, t.length) - 1];
    const Al = 2.3 + 360 / (l + 12);
    let RA = 0, nfA = 1;
    for (let k = 1; k <= n; k++) {
      const q = a2 * Math.max(at(A1T, k) * Al, 4 - 0.002 * l) * k * v;
      const R = q * l / 2 * kc; if (R > RA) { RA = R; nfA = k; }
    }
    const EBc = axleMax(BC_AXLES, Lg, Ld);
    let kBc = 0, nfB = 1;
    for (let k = 1; k <= n; k++) { const c = at(BCT, k) * k; if (c > kBc) { kBc = c; nfB = k; } }
    const Ls = Math.max(Lg, Ld), G = g * Ls, Sb = kBc * 600;
    const delta = 1 + 0.4 / (1 + 0.2 * Ls) + 0.6 / (1 + 4 * G / Sb);
    const RBc = delta * kBc * EBc;
    const R_tr = (HY.qTrottoir || 1.5) * trot * l / 2 * kc;
    Object.assign(det, { voies: n, A: RA, Bc: RBc, delta, trottoirs: R_tr, mod: RA >= RBc ? 'A(l)' : 'Bc', nfA, nfB });
    return { Q: Math.max(RA, RBc) + R_tr, det };
  }

  /* Combinaisons */
  function combos(S) {
    if (S.usage === 'rail') return { gG: 1.35, gQ: 1.45, els: 1.0, lab: S.reglement === 'EC' ? 'EN 1990/A1 : 1,35 G + 1,45 Q' : 'Livret 2.01 : 1,35 G + 1,45 Q' };
    if (S.reglement === 'EC') return { gG: 1.35, gQ: 1.35, els: 1.0, lab: 'EN 1990/A2 : 1,35 G + 1,35 Q (ELU), G + Q (ELS car.)' };
    return { gG: 1.35, gQ: 1.6, els: 1.2, lab: 'Fasc. 62 : 1,35 G + 1,6 Q (ELU), G + 1,2 Q (ELS)' };
  }

  /* Superstructures (kN/m) */
  function superstructures(S, PT) {
    const e = S.equip, W = PT.W, rows = [];
    if (S.usage === 'rail') {
      const Wb = Math.max(0, W - 2.4);
      rows.push(['Ballast ' + frn(HY.gammaBallast) + ' kN/m³ × 0,60 m × ' + fr(Wb, 2) + ' m', HY.gammaBallast * 0.60 * Wb]);
      rows.push(['Voies (rails, attaches) 1,5 kN/m × ' + PT.voiesFer, 1.5 * PT.voiesFer]);
      rows.push(['Corniches-caniveaux 2 × 5,0 kN/m', 10]);
      if (e.etancheite) rows.push(['Étanchéité 0,7 kN/m²', 0.7 * W]);
      rows.push(['Garde-corps 2 × 0,5 kN/m', 1]);
    } else {
      const w = PT.roulable;
      if (e.revetement > 0) rows.push(['Enrobés ' + fr((e.revetement * 100), 0) + ' cm × ' + frn(HY.gammaEnrobes) + ' kN/m³ × ' + fr(w, 2) + ' m', HY.gammaEnrobes * e.revetement * w]);
      if (e.etancheite) rows.push(['Étanchéité 0,7 kN/m²', 0.7 * W]);
      if (PT.trottoirs > 0) rows.push(['Trottoirs (remplissage 0,20 m)', 24 * 0.20 * Math.max(0, PT.trottoirs - 1.0)]);
      if (e.corniches) rows.push(['Corniches 2 × 2,5 kN/m', 5]);
      const ret = { BN4: ['Barrières BN4 2 × 0,65 kN/m', 1.3], GBA: ['GBA 2 × 6,5 kN/m', 13], GC: ['Garde-corps 2 × 0,5 kN/m', 1] }[e.retenue];
      rows.push(ret);
    }
    return { rows, g: sum(rows.map((r) => r[1])) };
  }

  /* ───────── Appuis : géométrie ───────── */
  function pileGeom(S, H, Lsup, iso, W) {
    const rail = S.usage === 'rail', t = S.piles.type;
    const bt = (iso ? 2.6 : 1.2) + (rail ? 0.2 : 0);
    const parts = [];
    let lx, ly, ch = null, fut;
    if (t === 'voile') {
      const ev = Math.max(rail ? 1.2 : 0.8, r05(H / 15));
      let hch = 0;
      if (ev < bt) { hch = 0.8; ch = { b: bt, h: hch, L: Lsup, kind: 'tete' }; }
      const Hf = Math.max(0.5, H - hch);
      fut = { kind: 'voile', e: ev, L: Lsup, H: Hf };
      parts.push({ des: 'Fût en voile ' + fr(ev, 2) + ' × ' + fr(Lsup, 2) + ' m', V: ev * Lsup * Hf, coff: 2 * (ev + Lsup) * Hf, ratio: 100 });
      lx = ev; ly = Lsup;
    } else if (t === 'colonnes') {
      const D = H > 15 ? 1.50 : (rail ? 1.40 : 1.20);
      const Lc = Math.max(W, Lsup), ax = D;            // axes des colonnes extrêmes à D du nu du chevêtre
      const nc = Math.max(2, Math.round((Lc - 2 * ax) / 2.7) + 1);
      const s = nc > 1 ? (Lc - 2 * ax) / (nc - 1) : 0;
      const hch = r10(Math.max(1.2, 0.14 * Lc));
      ch = { b: Math.max(bt, D + 0.6), h: hch, L: Lc, kind: 'chevetre' };
      const Hf = Math.max(0.5, H - hch);
      fut = { kind: 'colonnes', D, n: nc, s, H: Hf };
      parts.push({ des: nc + ' colonnes Ø ' + fr(D, 2) + ' m', V: nc * Math.PI * D * D / 4 * Hf, coff: nc * Math.PI * D * Hf, ratio: 160 });
      lx = D; ly = Lc;
    } else {
      const a = Math.max(rail ? 1.5 : 1.2, r05(H / 12));
      const bf = clamp(r05(0.35 * Lsup), 2.0, Math.max(2.0, Lsup - 1.0));
      const h1 = rail ? 2.0 : 1.6, h2 = 0.8;
      ch = { b: Math.max(bt, a + 0.2), h: h1, h2, L: Lsup, bf, kind: 'marteau' };
      const Hf = Math.max(0.5, H - h1);
      fut = { kind: 'marteau', a, b: bf, H: Hf };
      parts.push({ des: 'Fût ' + fr(a, 2) + ' × ' + fr(bf, 2) + ' m', V: a * bf * Hf, coff: 2 * (a + bf) * Hf, ratio: 120 });
      lx = a; ly = bf;
    }
    if (ch) {
      let V, coff;
      if (ch.kind === 'marteau') {
        const lc = (ch.L - ch.bf) / 2;
        const Aside = ch.bf * ch.h + 2 * lc * (ch.h + ch.h2) / 2;
        V = ch.b * Aside;
        coff = 2 * Aside + ch.b * (ch.bf + 2 * Math.hypot(lc, ch.h - ch.h2)) + 2 * ch.b * ch.h2;
      } else { V = ch.b * ch.h * ch.L; coff = (2 * ch.h + ch.b) * ch.L + 2 * ch.b * ch.h - (fut.kind === 'colonnes' ? fut.n * Math.PI * fut.D ** 2 / 4 : fut.e * fut.L); }
      parts.push({ des: (ch.kind === 'tete' ? 'Tête élargie ' : 'Chevêtre ') + fr(ch.b, 2) + ' × ' + fr(ch.h, 2) + ' m', V, coff, ratio: 150 });
    }
    return { type: t, H, fut, ch, parts, lx, ly, V: sum(parts.map((p) => p.V)) };
  }

  function culeeGeom(S, h, H, W, Lsup, iso, PT, cote) {
    const rail = S.usage === 'rail', t = S.culees.type, parts = [];
    const egg = rail ? 0.40 : 0.30, hgg = h + 0.30;
    const bt = (iso ? 2.6 : 1.6) + (rail ? 0.2 : 0);
    const dab = 0.6;
    parts.push({ des: 'Mur garde-grève ' + fr(egg, 2) + ' × ' + fr(hgg, 2) + ' m', V: egg * hgg * W, coff: 2 * hgg * W + 2 * egg * hgg, ratio: 120 });
    const Ht = H + hgg;
    let lx, ly = W, sommier = null, mur = null, colonnes = null, retours;
    if (t === 'enterree') {
      const bs = Math.max(bt, dab + 0.05 + egg + 0.6), hs = r10(Math.max(1.2, 0.14 * W));
      sommier = { b: bs, h: hs, L: W };
      parts.push({ des: 'Sommier ' + fr(bs, 2) + ' × ' + fr(hs, 2) + ' m', V: bs * hs * W, coff: (2 * hs + bs) * W + 2 * bs * hs, ratio: 120 });
      const Hc = H - hs;
      if (Hc > 0.5) {
        const D = rail ? 1.40 : 1.20, nc = Math.max(2, Math.round((W - 2 * D) / 2.7) + 1);
        colonnes = { D, n: nc, H: Hc, s: (W - 2 * D) / (nc - 1) };
        parts.push({ des: nc + ' colonnes Ø ' + fr(D, 2) + ' m (enterrées)', V: nc * Math.PI * D * D / 4 * Hc, coff: nc * Math.PI * D * Hc, ratio: 160 });
        lx = D; ly = W;
      } else lx = bs;
      const Lmr = clamp(r05(0.55 * (hgg + hs + 4)), 3, 6.5), hmr = hgg + hs, em = rail ? 0.60 : 0.50;
      retours = { L: Lmr, h: hmr, e: em, h2: 0.9 };
      parts.push({ des: 'Murs en retour suspendus 2 × ' + fr(Lmr, 2) + ' m, ép. ' + fr(em, 2), V: 2 * Lmr * (hmr + 0.9) / 2 * em, coff: 2 * Lmr * (hmr + 0.9), ratio: 90 });
    } else {
      const ef = Math.max(r05(H / 10), 0.80);
      const bs = Math.max(bt, dab + 0.05 + egg + 0.6, ef), hs = bs > ef + 0.05 ? 1.0 : 0;
      mur = { e: ef, H: H - hs, L: W };
      if (hs) { sommier = { b: bs, h: hs, L: W }; parts.push({ des: 'Sommier ' + fr(bs, 2) + ' × ' + fr(hs, 2) + ' m', V: bs * hs * W, coff: (2 * hs + bs) * W + 2 * bs * hs, ratio: 120 }); }
      parts.push({ des: 'Mur de front ' + fr(ef, 2) + ' × ' + fr(H - hs, 2) + ' m', V: ef * (H - hs) * W, coff: 2 * (H - hs) * W + 2 * ef * (H - hs), ratio: 90 });
      const Lmr = r05(0.8 * Ht + 1.0), em = Math.max(0.4, r05(Ht / 12)), hm = 0.7 * Ht;
      retours = { L: Lmr, h: hm, e: em };
      parts.push({ des: 'Murs en retour 2 × ' + fr(Lmr, 2) + ' m, ép. ' + fr(em, 2), V: 2 * Lmr * hm * em, coff: 4 * Lmr * hm, ratio: 90 });
      lx = Math.max(ef, hs ? bs : 0);
    }
    let dt = null;
    if (S.culees.dalleTransition && !rail) {
      const Ldt = Ht > 9 ? 5.0 : 4.0, Bdt = PT.roulable || W;
      dt = { L: Ldt, e: 0.30, B: Bdt };
      parts.push({ des: 'Dalle de transition ' + fr(Ldt, 2) + ' m × 0,30', V: Ldt * 0.30 * Bdt, coff: 2 * 0.30 * Ldt + 0.30 * Bdt, ratio: 100 });
      parts.push({ des: 'Corbeau d’appui de dalle', V: 0.30 * 0.30 * W, coff: 0.6 * W, ratio: 120 });
    }
    const Vrem = W * Ht * Math.max(3, 0.6 * Ht) * (t === 'enterree' ? 0.5 : 1);
    return { type: t, H, Ht, hgg, egg, dab, sommier, mur, colonnes, retours, dt, parts, lx, ly, V: sum(parts.map((p) => p.V)), Vrem, cote };
  }

  /* ───────── Fondations ───────── */
  function fondation(S, N, lx, ly, mode, opt) {
    const F = S.fond;
    opt = opt || {};
    if (mode === 'superficielle') {
      const sig = F.sigma * 1000, L = r10(ly + 1.0);
      let B = Math.max(lx + 1.0, 2.5), e = 1.0;
      for (let i = 0; i < 8; i++) {
        const Ws = GB * B * L * e + HY.gammaRemblai * 0.6 * B * L;
        B = Math.max(lx + 1.0, 2.5, opt.Bmin || 0, (N + Ws) / (sig * L) * (opt.excentre ? 1 + HY.majCulees / 100 : 1));
        B = r10(B); e = Math.max(0.8, r05((B - lx) / 4 + 0.05), opt.colonnes ? Math.min(1.5, r05(0.3 * B)) : 0);
      }
      const Ws = GB * B * L * e + HY.gammaRemblai * 0.6 * B * L, q = (N + Ws) / (B * L);
      return { mode, B, L, e, V: B * L * e, coff: 2 * (B + L) * e, ratio: 90, prop: B * L * 0.10, fouilles: (B + 1) * (L + 1) * (e + 0.6), q, Ws };
    }
    const D = F.diam, Q = F.qadm * 1000, s = 3 * D;
    let n = opt.min || 2, nr, m, Lx, Ly, e, Wm = 0, sy;
    for (let it = 0; it < 8; it++) {
      nr = opt.uneRangee ? ((n - 1) * s + D + 0.6 <= ly + 1e-6 ? 1 : 2) : (n <= 3 ? 1 : (n <= 12 ? 2 : 3));
      m = Math.ceil(n / nr); n = nr * m;
      Lx = Math.max(opt.uneRangee ? lx : 0, (nr - 1) * s + D + 0.6);
      Ly = Math.max((m - 1) * s + D + 0.6, ly + (opt.uneRangee ? 0 : 0.5));
      sy = m > 1 ? (Ly - D - 0.6) / (m - 1) : 0;
      e = opt.sansMassif ? 0 : Math.max(1.0, r05(1.2 * D + 0.3));
      Wm = GB * Lx * Ly * e;
      const nn = Math.max(opt.min || 2, Math.ceil((N + Wm) * 1.05 / Q));
      if (nn <= n) break;
      n = nn;
    }
    const Vp = n * Math.PI * D * D / 4 * F.long;
    return {
      mode, D, n, nr, m, s, sy, Lp: F.long, Lx: r10(Lx), Ly: r10(Ly), e, V: opt.sansMassif ? 0 : Lx * Ly * e,
      coff: opt.sansMassif ? 0 : 2 * (Lx + Ly) * e, ratio: 100, prop: opt.sansMassif ? 0 : Lx * Ly * 0.10,
      fouilles: opt.sansMassif ? 0 : (Lx + 1) * (Ly + 1) * (e + 0.6), Vp, mlPieux: n * F.long, Npieu: (N + Wm) / n, Q,
    };
  }

  /* ───────── Appareils d'appui ───────── */
  function appareil(Rels, ux) {
    const A = Rels * 1000 / 15; // mm² pour σ ≤ 15 MPa
    const pick = ELASTO.find(([a, b]) => a * b >= A);
    const T = Math.max(20, Math.ceil(ux / 0.5 / 10) * 10);
    const nf = T / 10;
    if (!pick) return { type: 'pot', des: 'Appareil à pot (R = ' + fr((Rels / 1000), 2) + ' MN)', a: 0, b: 0, T, nf, dm3: 0 };
    const [a, b] = pick, ep = T + (nf + 1) * 3;
    return { type: 'elasto', des: a + ' × ' + b + ' ; ' + nf + '(10 + 3)', a, b, T, nf, dm3: a * b * ep / 1e6, sigma: Rels * 1000 / (a * b) };
  }
  function jointType(Wmm) {
    if (Wmm <= 50) return { des: 'Joint à revêtement amélioré / cantilever (Wd 50)', pu: 0.6 };
    if (Wmm <= 100) return { des: 'Joint à peigne en console (Wd 100)', pu: 1.0 };
    if (Wmm <= 200) return { des: 'Joint à peigne (Wd 200)', pu: 1.6 };
    return { des: 'Joint modulaire (W > 200 mm)', pu: 3.3 };
  }

  /* ───────── Calcul complet ───────── */
  function compute(src) {
    const S = normalize(src);
    HY = S.hyp; GB = HY.gammaB;
    const T = TYPES[S.tablier.type], rail = S.usage === 'rail', u = S.usage;
    const warn = [], notes = [];
    const PT = profilEnTravers(S);
    const W = PT.W;
    const st = typeStatus(S.tablier.type, S.travees, u);
    if (st.k === 'hors') warn.push(T.nom + ' : portée maximale ' + frn(Math.max.apply(null, S.travees)) + ' m hors du domaine d’emploi usuel (' + T.dom[u].join('–') + ' m).');
    else if (st.k === 'lim') warn.push(T.nom + ' : portée en limite du domaine d’emploi usuel (' + T.dom[u].join('–') + ' m).');

    // hauteur
    const pd = predimH(S, T);
    let h = S.tablier.h > 0 ? S.tablier.h : pd.h;
    const sec = section(S, T, PT, h);
    h = sec.h;
    const hAuto = S.tablier.h > 0 ? false : true;
    if (!hAuto && S.tablier.h < pd.h * 0.85) warn.push('Hauteur imposée ' + fr(S.tablier.h, 2) + ' m nettement inférieure au prédimensionnement (' + fr(pd.h, 2) + ' m).');
    if (sec.info.profilMax) warn.push('PRP : hauteur supérieure au plus grand HEB (1000) — prévoir des HEM ou des PRS.');

    // implantation
    const tr = S.travees, n = tr.length, xs = [0];
    tr.forEach((L) => xs.push(rnd(xs[xs.length - 1] + L, 3)));
    const Ltot = xs[n], cont = S.tablier.continu && n > 1;
    const iso = !cont;
    const dab = 0.6, Ldeck = Ltot + 2 * dab;
    const surf = W * Ltot;
    if (cont && n > 2) {
      const Lint = Math.max.apply(null, tr.slice(1, -1)), rr = Math.max(tr[0], tr[n - 1]) / Lint;
      if (rr < 0.6) warn.push('Travées de rive courtes (' + fr((rr * 100), 0) + ' % de la travée centrale) : risque de soulèvement sur culées.');
      if (rr > 1.0) warn.push('Travées de rive plus longues que les travées centrales : rapport 0,75 à 0,85 recommandé pour un tablier continu.');
    }
    if (S.biais < 70) warn.push('Biais de ' + frn(S.biais) + ' grades : le prédimensionnement suppose un biais modéré (≥ 70 gr) ; étude spécifique des réactions d’appui nécessaire.');
    if (T.famille === 'mixte' && W > (rail ? 13 : 14)) warn.push('Bipoutre de ' + fr(W, 2) + ' m de large : au-delà de ~14 m, envisager pièces de pont, multipoutre ou caisson.');

    // charges permanentes
    const gStruct = GB * (sec.Abet + sec.Aprefa) + (sec.kgCharp + sec.kgProf) * 9.81 / 1000;
    const sup = superstructures(S, PT);
    const gEnt = T.famille === 'poutres' ? GB * (sec.nbPoutres - 1) * (sec.entraxe - sec.info.b0) * (sec.info.hb - 0.2) * 0.25 * 2 * n / Ltot : 0;
    const g = gStruct + sup.g + gEnt;
    const cb = combos(S);

    // longueur déterminante (Φ ferroviaire)
    const Lm = Ltot / n, kPhi = n >= 5 ? 1.5 : [1, 1, 1.2, 1.3, 1.4][n];
    const LPhi = cont ? kPhi * Lm : Math.max.apply(null, tr);

    // lignes d'appui
    const indep = iso && !S.tablier.dalleContinuite && n > 1;
    // déplacement horizontal : dilatation ΔT × 1e-5 + retrait et fluage (béton) ou retrait de la dalle seule (mixte)
    const xFix = Ltot / 2, epsU = HY.dT * 1e-5 + (T.famille === 'mixte' ? 0.5 : 1) * HY.retrait * 1e-4;
    const lines = [];
    const kExc = HY.kExc > 0 ? HY.kExc : (T.famille === 'poutres' || T.famille === 'mixte' ? 1.5 : 1.3);
    const nbB = sec.bear.length;
    const Lsup = Math.max(2.5, (Math.max.apply(null, sec.bear) - Math.min.apply(null, sec.bear)) + 1.2);
    const mkLine = (j, side, x, Lg, Ld) => {
      const kc = kCont(j, n, cont);
      const G = g * (Lg + Ld) / 2 * kc;
      const tq = trafic(S, PT, Lg, Ld, kc, g, { LPhi });
      const Q = tq.Q;
      const els = G + cb.els * Q, elu = cb.gG * G + cb.gQ * Q;
      const ux = (indep ? (Lg || Ld) / 2 : Math.abs(x - xFix)) * epsU * 1000; // mm
      const Rb = (G + cb.els * Q * kExc) / nbB;
      const app = appareil(Rb, ux);
      return { j, side, x, Lg, Ld, kc, G, Q, els, elu, det: tq.det, ux, nb: nbB, Rb, app };
    };
    for (let j = 0; j <= n; j++) {
      const Lg = j > 0 ? tr[j - 1] : 0, Ld = j < n ? tr[j] : 0;
      if (cont || j === 0 || j === n) lines.push(mkLine(j, j === 0 ? 'D' : j === n ? 'G' : 'C', xs[j], Lg, Ld));
      else { lines.push(mkLine(j, 'G', xs[j] - 0.45, Lg, 0)); lines.push(mkLine(j, 'D', xs[j] + 0.45, 0, Ld)); }
    }

    // appuis
    const supports = [];
    for (let j = 0; j <= n; j++) {
      const isC = j === 0 || j === n, Lg = j > 0 ? tr[j - 1] : 0, Ld = j < n ? tr[j] : 0;
      const L_ = lines.filter((l) => l.j === j);
      const G = sum(L_.map((l) => l.G));
      const tq = L_.length > 1 ? trafic(S, PT, Lg, Ld, 1, g, { LPhi }) : { Q: L_[0].Q, det: L_[0].det };
      const Q = tq.Q;
      const H = isC ? S.culees.hauteurs[j === 0 ? 0 : 1] : S.piles.hauteurs[j - 1];
      const twoLines = L_.length > 1;
      const geo = isC ? culeeGeom(S, h, H, W, Lsup, iso, PT, j === 0 ? 'G' : 'D') : pileGeom(S, H, Lsup, twoLines, W);
      const Gapp = GB * geo.V;
      const N = G + Q + Gapp; // ELS caractéristique en tête de fondation
      const mode = isC ? S.fond.culees : S.fond.piles;
      let fo;
      if (isC && mode === 'pieux' && geo.type === 'enterree' && !geo.colonnes) {
        fo = fondation(S, N, geo.sommier.b, W, 'pieux', { min: 3, uneRangee: true, sansMassif: true });
        if (fo.Lx > geo.sommier.b + 1e-6) { // sommier élargi pour deux rangées de pieux
          const sp = geo.parts.find((p) => /^Sommier/.test(p.des)), b0 = geo.sommier.b;
          geo.sommier.b = fo.Lx;
          sp.V *= fo.Lx / b0; sp.des = 'Sommier ' + fr(fo.Lx, 2) + ' × ' + fr(geo.sommier.h, 2) + ' m (2 rangées de pieux)';
          geo.V = sum(geo.parts.map((p) => p.V));
        }
      } else fo = fondation(S, N, geo.lx, geo.ly, mode, {
        min: 4, excentre: isC, colonnes: (geo.fut && geo.fut.kind === 'colonnes') || !!geo.colonnes,
        Bmin: isC ? r10(0.65 * geo.Ht) : 0,    // semelle de culée (poussée des terres) : ≈ 0,65 Ht (PRO2334 : 7,00 m)
      });
      if (fo.mode === 'superficielle' && fo.B > 10) warn.push((isC ? 'Culée ' : 'Pile ') + (isC ? 'C' + j : 'P' + j) + ' : semelle de ' + fr(fo.B, 1) + ' m — fondations profondes à envisager (σ adm = ' + S.fond.sigma + ' MPa).');
      if (!isC && H > 25) warn.push('Pile P' + j + ' de ' + frn(H) + ' m : piles hautes, vérifier flambement, effets du second ordre et séisme.');
      supports.push({
        j, id: isC ? 'C' + j : 'P' + j, kind: isC ? 'culee' : 'pile', x: xs[j], Lg, Ld, H, G, Q, det: tq.det,
        els: G + cb.els * Q, elu: cb.gG * G + cb.gQ * Q, Gapp, N, geo, fo, lines: L_,
      });
    }

    // joints
    const joints = [];
    const jt = (x, Wmm, lab) => joints.push(Object.assign({ x, W: Wmm, lab }, rail ? { des: 'Couvre-joint de dalle (ferroviaire)', pu: 0.4 } : jointType(Wmm)));
    if (indep) {
      for (let j = 0; j <= n; j++) {
        const Lj = (j > 0 ? tr[j - 1] : 0) + (j < n ? tr[j] : 0);
        jt(j === 0 ? -dab : j === n ? Ltot + dab : xs[j], Math.ceil(Lj * epsU * 1000 / 5) * 5, (j === 0 || j === n ? 'C' : 'P') + j);
      }
    } else {
      const ux = Ltot / 2 * epsU * 1000, Wmm = Math.ceil(2 * ux / 5) * 5;
      jt(-dab, Wmm, 'C0'); jt(Ltot + dab, Wmm, 'C' + n);
    }
    if (rail) {
      const LT_ = indep ? Math.max.apply(null, tr) : Ltot / 2, lim = T.famille === 'mixte' ? 60 : 90;
      if (LT_ > lim) notes.push('Longueur dilatable ' + fr(LT_, 0) + ' m > ' + lim + ' m (EN 1991-2 § 6.5.4.4) : appareils de dilatation de voie ou étude d’interaction voie-ouvrage nécessaires.');
    }

    // ───────── Métrés ─────────
    const M = [], P = S.prix;
    const add = (lot, code, des, uu, q, key, coef) => {
      if (!(q > 1e-9)) return;
      const pu = key ? P[key] * (coef || 1) : 0;
      M.push({ lot, code, des, u: uu, q, key, pu, mt: q * pu });
    };
    // 1. tablier
    const LT = '1. Tablier';
    if (T.famille === 'poutres') {
      const Lp = sum(tr.map((L) => L + 0.8)), Vp = sec.Aprefa * Lp;
      const Vh = sec.Abet * Ldeck;
      const Ve = (sec.nbPoutres - 1) * (sec.entraxe - sec.info.b0) * (sec.info.hb - 0.2) * 0.25 * 2 * n;
      add(LT, '1.1', 'Béton des poutres préfabriquées (' + sec.nbPoutres + ' × ' + n + ' poutres)', 'm³', Vp, 'betonPref');
      add(LT, '1.2', 'Béton d’hourdis et entretoises d’about', 'm³', Vh + Ve, 'betonTab');
      add(LT, '1.3', 'Coffrage des poutres (moules)', 'm²', sec.coffPrefa * Lp, 'coffSoigne');
      add(LT, '1.4', 'Coffrage d’hourdis, entretoises et abouts', 'm²', sec.coff * Ldeck + 2 * Ve / 0.25, 'coffOrd');
      add(LT, '1.5', 'Aciers passifs', 'kg', Vp * T.ratio[u] + (Vh + Ve) * T.ratioH[u], 'acierHA');
      add(LT, '1.6', 'Précontrainte', 'kg', Vp * T.prec[u], 'prec');
    } else {
      const V = sec.Abet * Ldeck;
      add(LT, '1.1', 'Béton de ' + (T.famille === 'mixte' ? 'hourdis' : 'dalle'), 'm³', V, 'betonTab');
      add(LT, '1.2', 'Coffrage ' + (T.famille === 'prp' ? '(intrados en coffrage perdu, rives)' : 'd’intrados et de rives'), 'm²', sec.coff * Ldeck + 2 * sec.Abet, T.famille === 'prp' ? 'coffOrd' : 'coffSoigne');
      add(LT, '1.3', 'Aciers passifs', 'kg', V * T.ratio[u], 'acierHA');
      if (T.prec[u] > 0) add(LT, '1.4', 'Précontrainte longitudinale', 'kg', V * T.prec[u], 'prec');
      if (sec.kgProf > 0) add(LT, '1.5', 'Poutrelles ' + sec.info.profil + ' (' + sec.info.nbProfils + ' u, e = ' + fr(sec.info.espacement, 2) + ' m)', 'kg', sec.kgProf * (Ltot + 2 * 0.4), 'profiles');
      if (sec.kgCharp > 0) add(LT, '1.5', 'Charpente métallique (' + sec.info.kgm2 + ' kg/m², ratio statistique)', 'kg', sec.kgCharp * (Ltot + 2 * 0.4), 'charpente');
    }
    // 2. piles, 3. culées
    const lotPart = (lot, code, sp, parts) => {
      const V = sum(parts.map((p) => p.V)), C = sum(parts.map((p) => p.coff)), A = sum(parts.map((p) => p.V * p.ratio));
      add(lot, code + '.1', 'Béton ' + sp, 'm³', V, 'betonApp');
      add(lot, code + '.2', 'Coffrage ' + sp, 'm²', C, 'coffSoigne');
      add(lot, code + '.3', 'Aciers ' + sp, 'kg', A, 'acierHA');
    };
    const piles = supports.filter((s) => s.kind === 'pile'), culees = supports.filter((s) => s.kind === 'culee');
    if (piles.length) lotPart('2. Piles', '2', 'des piles (' + piles.length + ')', [].concat.apply([], piles.map((p) => p.geo.parts)));
    lotPart('3. Culées', '3', 'des culées', [].concat.apply([], culees.map((c) => c.geo.parts)));
    if (!rail) add('3. Culées', '3.4', 'Remblai technique contigu', 'm³', sum(culees.map((c) => c.geo.Vrem)), 'remblaiT');
    // 4. fondations
    const FO = '4. Fondations', fos = supports.map((s) => s.fo);
    add(FO, '4.1', 'Fouilles', 'm³', sum(fos.map((f) => f.fouilles)), 'fouilles');
    add(FO, '4.2', 'Béton de propreté', 'm³', sum(fos.map((f) => f.prop)), 'betonProp');
    add(FO, '4.3', 'Béton de semelles et massifs', 'm³', sum(fos.map((f) => f.V)), 'betonFond');
    add(FO, '4.4', 'Coffrage de semelles et massifs', 'm²', sum(fos.map((f) => f.coff)), 'coffOrd');
    add(FO, '4.5', 'Aciers de semelles et massifs', 'kg', sum(fos.map((f) => f.V * f.ratio)), 'acierHA');
    const pFo = fos.filter((f) => f.mode === 'pieux');
    if (pFo.length) {
      const D = S.fond.diam, ml = sum(pFo.map((f) => f.mlPieux));
      add(FO, '4.6', 'Pieux forés Ø ' + fr(D, 2) + ' m (' + sum(pFo.map((f) => f.n)) + ' u × ' + frn(S.fond.long) + ' m)', 'ml', ml, 'pieu', (D / 1.0) ** 1.4);
      add(FO, '4.7', 'Aciers de pieux (80 kg/m³)', 'kg', sum(pFo.map((f) => f.Vp)) * 80, 'acierHA');
    }
    // 5. équipements
    const EQ = '5. Équipements';
    const nApp = sum(lines.map((l) => l.nb)), dm3 = sum(lines.map((l) => l.nb * l.app.dm3));
    add(EQ, '5.1', 'Appareils d’appui en élastomère fretté (' + nApp + ' u)', 'dm³', dm3, 'elasto');
    joints.forEach((jj, i) => add(EQ, '5.2.' + (i + 1), (rail ? jj.des : jj.des + ' — souffle ' + jj.W + ' mm') + ' (' + jj.lab + ')', 'ml', W, 'joint', jj.pu));
    if (S.equip.etancheite) add(EQ, '5.3', 'Étanchéité', 'm²', W * Ldeck, 'etanch');
    if (!rail && S.equip.revetement > 0) add(EQ, '5.4', 'Enrobés ép. ' + fr((S.equip.revetement * 100), 0) + ' cm', 'm²', PT.roulable * Ldeck, 'enrobe');
    if (!rail && S.equip.retenue !== 'GC') add(EQ, '5.5', S.equip.retenue === 'BN4' ? 'Barrières BN4' : 'Glissières en béton adhérent (GBA)', 'ml', 2 * Ldeck, 'retenue', S.equip.retenue === 'GBA' ? 1.2 : 1);
    if (rail || S.equip.retenue === 'GC') add(EQ, '5.5', 'Garde-corps', 'ml', 2 * Ldeck, 'gardeCorps');
    if (S.equip.corniches) add(EQ, '5.6', 'Corniches', 'ml', 2 * Ldeck, 'corniche');
    if (!rail && S.equip.gargouilles) add(EQ, '5.7', 'Gargouilles', 'u', 2 * Math.ceil(Ldeck / 12), 'gargouille');
    if (rail) {
      add(EQ, '5.8', 'Ballast (ép. 0,60 m)', 'm³', Math.max(0, W - 2.4) * 0.60 * Ldeck, 'ballast');
      add(EQ, '5.9', 'Caniveaux à câbles', 'ml', 2 * Ldeck, 'caniveau');
    }
    const sousTotal = sum(M.map((m) => m.mt));
    const inst = sousTotal * P.installation / 100;
    M.push({ lot: '6. Divers', code: '6.1', des: PRIX.installation.des, u: '%', q: P.installation, key: 'installation', pu: sousTotal / 100, mt: inst });
    const ale = (sousTotal + inst) * P.aleas / 100;
    M.push({ lot: '6. Divers', code: '6.2', des: PRIX.aleas.des, u: '%', q: P.aleas, key: 'aleas', pu: (sousTotal + inst) / 100, mt: ale });
    const total = sousTotal + inst + ale;

    // récapitulatifs
    const lots = [];
    M.forEach((m) => { let L = lots.find((l) => l.lot === m.lot); if (!L) lots.push(L = { lot: m.lot, mt: 0 }); L.mt += m.mt; });
    const isBet = (m) => m.u === 'm³' && /^Béton/.test(m.des) && !/propreté/.test(m.des);
    const kpi = {
      Ltot, W, surf, h, nbTravees: n,
      beton: sum(M.filter(isBet).map((m) => m.q)),
      acier: sum(M.filter((m) => m.key === 'acierHA').map((m) => m.q)),
      prec: sum(M.filter((m) => m.key === 'prec').map((m) => m.q)),
      metal: sum(M.filter((m) => m.key === 'charpente' || m.key === 'profiles').map((m) => m.q)),
      total, parM2: total / surf,
    };
    kpi.betonTab = sum(M.filter((m) => m.lot === LT && isBet(m)).map((m) => m.q));
    kpi.epEq = kpi.betonTab / (W * Ldeck);

    notes.push('Descente de charges estimée : lignes d’influence triangulaires, coefficients de continuité forfaitaires (rive 0,8 ; 1er appui intermédiaire 1,12 à 1,25).');
    notes.push('Effort par appareil d’appui majoré de ×' + fr(kExc, 1) + ' sur la part d’exploitation (excentrement transversal).');
    notes.push('Déplacements des appareils et souffle des joints : ΔT = ±' + frn(HY.dT) + ' °C, retrait et fluage ' + frn(HY.retrait) + '×10⁻⁴.');
    notes.push('Non pris en compte à ce stade : séisme (RPOA 2005, a = ' + fr(HY.seismeA, 2) + ' g, ouvrage ' + { strategique: 'stratégique', important: 'important', courant: 'courant' }[HY.seismeClasse] + '), freinage, vent, poussée des terres, gradient thermique, phasage.');

    return {
      S, T, PT, W, h, hAuto, pd, sec, st, xs, Ltot, Ldeck, dab, cont, iso, surf, g, gStruct, gEnt, sup, cb, LPhi,
      lines, supports, joints, metres: M, lots, sousTotal, total, kpi, warn, notes, Lsup,
    };
  }

  return {
    fr, frn, TYPES, TYPE_KEYS, CLASSES_BETON, hypDefaults, PILES, CULEES, PRIX, HEB, ELASTO,
    defaults, normalize, compute, typeStatus, predimH, profilEnTravers,
    _int: { eta, etaInt, axleMax, lm71, sw2, area, coffLen, appareil, kCont },
  };
});
