/* PSIDA-EL — définition de la saisie guidée (pont-dalle continu en béton armé, BAEL 91, fasc. 61 titre II) */
(function (G) {
  'use strict';
  const { fmt, num, esc } = G.OTUI;
  const E = G.PSIDA;
  const LAY = E.BORDEREAU_LAYOUT || {};
  const GR = Math.PI / 200;

  /* ───── accès au modèle (clés « LIGNE.VARIABLE », ex. A5.D1) ───── */
  const isS = (l, v) => !!(LAY[l] && LAY[l].f.some(s => s[0] === v && s[2] === 'S'));
  function emptyLine(l) { const o = {}; for (const s of (LAY[l] ? LAY[l].f : [])) o[s[0]] = s[2] === 'S' ? '000' : 0; return o; }
  const get = (m, k) => {
    if (k === 'TITRE1') return (m.titre || [])[0] || '';
    if (k === 'TITRE2') return (m.titre || [])[1] || '';
    if (k === 'NUM') return m.numero || '';
    const [l, v] = k.split('.');
    const o = (m.lignes || {})[l];
    if (!o) return l === 'C1' ? 0 : undefined;
    const x = o[v];
    if (l === 'A10' && /^PHI/.test(v)) return Math.round(num(x) * 10000) / 10;   // m → mm
    return x;
  };
  const set = (m, k, v) => {
    if (k === 'TITRE1' || k === 'TITRE2') { m.titre = (m.titre || ['', '']).slice(); m.titre[k === 'TITRE1' ? 0 : 1] = String(v).toUpperCase().slice(0, 76); return; }
    if (k === 'NUM') { m.numero = String(v).toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6) || null; return; }
    const [l, n] = k.split('.');
    m.lignes = m.lignes || {};
    if (!m.lignes[l]) m.lignes[l] = emptyLine(l);
    if (isS(l, n)) { const x = num(v); m.lignes[l][n] = isFinite(x) ? String(Math.round(x)).padStart(3, '0') : String(v); return; }
    if (l === 'A10' && /^PHI/.test(n)) { m.lignes[l][n] = num(v) / 1000; return; }
    m.lignes[l][n] = v;
  };
  const V = (m, k) => { const x = num(get(m, k)); return isFinite(x) ? x : 0; };
  const code = k => (k.split('.')[1] || k);
  const nvF61 = es => es < 6 ? (es >= 5 ? 2 : 1) : Math.floor(es / 3);

  /* ───── listes ───── */
  const oui = (c, l) => ({ k: 'A3.' + c, code: c, label: l, type: 'chk' });
  const imp = (c, l) => ({ k: 'A4.' + c, code: c, label: l, type: 'chk', help: `Impression des résultats intermédiaires de « ${l} » (1) ou des seuls résultats essentiels (0). Porter normalement les mêmes chiffres que sur la ligne A3 pour LIGNINF, EXCENTR, MOMENT et MOTRAN.` });
  const H3 = {
    MOMENT: 'Calcul des courbes enveloppes des moments fléchissants longitudinaux.',
    EFTRAN: 'Calcul des efforts tranchants extrêmes sur appuis.',
    REAPPUI: 'Calcul des réactions d\'appui globales extrêmes, par ligne d\'appui.',
    MOTRAN: 'Calcul des moments de flexion transversale en milieu de travée.',
    DIMAP: 'Dimensionnement des appareils d\'appui (et calcul des chevêtres incorporés).',
    FERLON: 'Calcul du ferraillage longitudinal (sections d\'acier, gamme, épure d\'arrêt des barres).',
    FERTRAN: 'Calcul du ferraillage transversal.',
    ETRIERS: 'Sécurité vis-à-vis du cisaillement à l\'effort tranchant général (étriers).',
    POINCON: 'Cisaillement de poinçonnement aux environs des appuis concentrés.',
    DEFORM: 'Calcul des déformations probables du tablier (flèches et rotations).',
    AVMETRE: 'Avant-métré récapitulatif (béton, coffrages, aciers).',
    PP: 'Tableau récapitulatif des résultats utilisables en données pour le programme P.P. (piles et palées).',
    DESSIN: 'Dessin automatique du ferraillage (uniquement si le ferraillage transversal est parallèle aux lignes d\'appui).',
  };
  const ck = (c, l) => Object.assign(oui(c, l), { help: H3[c] });
  const A3G1 = ['MOMENT', 'EFTRAN', 'REAPPUI', 'MOTRAN', 'DIMAP'];
  const A3G2 = ['FERLON', 'FERTRAN', 'ETRIERS', 'POINCON', 'DEFORM', 'AVMETRE', 'PP', 'DESSIN'];
  const LBL = { LIGNINF: 'lignes d\'influence', EXCENTR: 'répartition transv.', TASMENT: 'tassements', MOMENT: 'moments', EFTRAN: 'efforts tranchants', REAPPUI: 'réactions d\'appui', MOTRAN: 'flexion transv.', DIMAP: 'appareils d\'appui', FERLON: 'ferr. longitudinal', FERTRAN: 'ferr. transversal', ETRIERS: 'étriers', POINCON: 'poinçonnement', DEFORM: 'déformations', AVMETRE: 'avant-métré', PP: 'tableau P.P.', DESSIN: 'dessin' };
  const sp = i => ({ k: 'A5.D' + i, code: 'D' + i, label: 'travée ' + i, unit: 'm', dec: 3, help: `Portée biaise de la travée ${i}, mesurée suivant l'axe de l'ouvrage entre lignes d'appui. Les remplir toutes, même si l'ouvrage est symétrique ; 0 au-delà de NT.` });
  const tp = i => ({ k: 'A12.TP' + i, code: 'TP' + i, label: '', unit: 'm', dec: 3, help: `Tassement probable de l'appui ${i} (m). Pris en compte si TASMENT = 2 (ligne A3).` });
  const dtp = i => ({ k: 'A12.DTP' + i, code: 'DTP' + i, label: '', unit: 'm', dec: 3, help: `Tassement supplémentaire aléatoire de l'appui ${i} (m).` });
  const typ = i => ({ k: 'A13.TYPAP' + i, code: 'TYPAP' + i, label: '', type: 'sel', opts: [[1, 'élast.'], [0, 'Freyss.'], [2, 'autre']], help: `Type d'appareil d'appui de la ligne d'appui ${i} : 0 articulation Freyssinet, 1 élastomère fretté, 2 autre type.` });
  const nap = i => ({ k: 'A13.NAP' + i, code: 'NAP' + i, label: '', type: 'int', help: `Nombre d'appareils d'appui sur la ligne d'appui ${i} (0 au-delà de NT + 1).` });

  const steps = [
    { id: 'id', label: 'Identification', view: 'elev', caption: 'lignes A1 à A4', hint: 'Titre de la note (A1, A2) et calculs demandés (A3) ou imprimés en détail (A4).', pages: [
      { label: 'Titre', groups: [
        { title: 'Titre de la note (lignes A1 et A2)', flex: 5, cols: 2, fields: [
          { k: 'TITRE1', code: 'A1', label: 'ligne 1', type: 'txt', help: 'Identité de l\'ouvrage (ligne A1, 80 caractères) : imprimée en tête de la note.' },
          { k: 'TITRE2', code: 'A2', label: 'ligne 2', type: 'txt', help: 'Seconde ligne d\'identification (ligne A2) : localisation, nature de l\'ouvrage…' },
        ] },
        { title: 'Passage', alt: true, flex: 1, cols: 1, fields: [
          { k: 'NUM', code: 'NUM', label: 'numéro', type: 'txt', help: 'Numéro du passage, rappelé en tête de chaque page (PSIDAEL nnnn).' },
        ] },
      ] },
      { label: 'Calculs : efforts', groups: [
        { title: 'Méthode (A3)', flex: 3, cols: 3, fields: [
          { k: 'A3.LIGNINF', code: 'LIGNINF', label: LBL.LIGNINF, type: 'sel', opts: [[2, '2 — conservée'], [1, '1 — optimisée']], help: 'Calcul des lignes d\'influence. 2 : l\'épaisseur HDALLE1 est conservée ; 1 : elle est optimisée par le programme (option non reconstituée ici : l\'épaisseur saisie est conservée).' },
          { k: 'A3.EXCENTR', code: 'EXCENTR', label: LBL.EXCENTR, type: 'sel', opts: [[1, '1 — Guyon'], [0, '0 — K en A8']], help: 'Coefficients de répartition transversale : 1 calculés par la méthode de Guyon-Massonnet ; 0 lus à la ligne A8 (KA, KBC, KBT, KCM, KTR).' },
          { k: 'A3.TASMENT', code: 'TASMENT', label: LBL.TASMENT, type: 'sel', opts: [[0, '0 — non'], [1, '1 — 1 cm'], [2, '2 — + A12']], help: '0 : pas de calcul ; 1 : moments et réactions dus à des dénivellations d\'appui unitaires de 1 cm ; 2 : en plus, sécurité vis-à-vis des tassements de la ligne A12.' },
        ] },
        { title: 'Efforts à calculer (A3)', alt: true, flex: 5, cols: 5, fields: A3G1.map(c => ck(c, LBL[c])) },
      ] },
      { label: 'Calculs : ferraillage', groups: [
        { title: 'Ferraillage et sorties à calculer (A3)', flex: 8, cols: 8, fields: A3G2.map(c => ck(c, LBL[c])) },
      ] },
      { label: 'Impression : efforts', groups: [
        { title: 'Résultats intermédiaires imprimés (A4)', alt: true, flex: 8, cols: 8, fields: ['LIGNINF', 'EXCENTR', 'TASMENT', ...A3G1].map(c => imp(c, LBL[c])) },
      ] },
      { label: 'Impression : ferraillage', groups: [
        { title: 'Résultats intermédiaires imprimés (A4)', alt: true, flex: 8, cols: 8, fields: A3G2.map(c => imp(c, LBL[c])) },
      ] },
    ], schema: (svg) => drawElev(svg, gen(), true) },

    { id: 'long', label: 'Profil en long', view: 'elev', caption: 'ligne A5 — portées biaises', hint: 'Nombre de travées, biais, abouts et portées biaises (mesurées suivant l\'axe de l\'ouvrage).', pages: [
      { label: 'Travées', groups: [
        { title: 'Ouvrage', flex: 3, cols: 3, fields: [
          { k: 'A5.NT', code: 'NT', label: 'nb de travées', type: 'sel', opts: [1, 2, 3, 4, 5, 6].map(i => [i, String(i)]), help: 'Nombre de travées (1 à 6).' },
          { k: 'A5.BIAIS', code: 'BIAIS', label: 'biais', unit: 'gr', dec: 3, help: 'Biais géométrique moyen : angle en grades entre les lignes d\'appui et l\'axe longitudinal (100 = pont droit, ≤ 100).' },
          { k: 'A5.ABOUT', code: 'ABOUT', label: 'about', unit: 'm', dec: 3, help: 'Longueur biaise d\'about sur appuis extrêmes : distance, suivant l\'axe, entre la ligne d\'appui de rive et l\'extrémité de la dalle.' },
        ] },
        { title: 'Portées biaises', alt: true, flex: 6, cols: 6, fields: [1, 2, 3, 4, 5, 6].map(sp) },
      ] },
    ], schema: (svg) => drawElev(svg, gen(), true) },

    { id: 'trav', label: 'Profil en travers', view: 'coupe', caption: 'ligne A6 — de gauche à droite', hint: 'Profil en travers de la voie portée, de gauche à droite (sens de l\'axe).', pages: [
      { label: 'Largeurs', groups: [
        { title: 'Profil en travers (de gauche à droite)', flex: 5, cols: 5, fields: [
          { k: 'A6.ETROTG', code: 'ETROTG', label: 'trottoir G', unit: 'm', dec: 3, help: 'Largeur utile du trottoir de gauche. Passage inférieur : largeur de la bande non chargée à gauche de la glissière de gauche.' },
          { k: 'A6.EGAU', code: 'EGAU', label: 'bande G', unit: 'm', dec: 3, help: 'S\'il existe un dispositif de retenue : largeur de la bande non chargeable côté chaussée, le long du dispositif (0,50 m) ; sinon 0.' },
          { k: 'A6.ESURCH', code: 'ESURCH', label: 'chargeable', unit: 'm', dec: 3, help: 'Largeur chargeable au sens de l\'article 2 du fascicule 61 titre II.' },
          { k: 'A6.EDROI', code: 'EDROI', label: 'bande D', unit: 'm', dec: 3, help: 'S\'il existe un dispositif de retenue à droite : largeur de la bande non chargeable côté chaussée (0,50 m) ; sinon 0.' },
          { k: 'A6.ETROTD', code: 'ETROTD', label: 'trottoir D', unit: 'm', dec: 3, help: 'Largeur utile du trottoir de droite.' },
        ] },
        { title: 'Chaussée', alt: true, flex: 2, cols: 2, fields: [
          { k: 'A6.HCHAU', code: 'HCHAU', label: 'épaisseur', unit: 'm', dec: 3, help: 'Épaisseur moyenne de béton équivalent au renformis éventuel, à la chape et à la chaussée (diffusion des charges locales).' },
          { k: 'A6.NVOIE', code: 'NVOIE', label: 'nb de voies', type: 'int', help: 'Nombre de voies de circulation. 0 : calculé selon l\'article 2.2 du fascicule 61 titre II ; à remplir seulement s\'il en diffère (chaussée de 9 m à deux voies…).' },
        ] },
      ] },
      { label: 'Fibres et symétrie', groups: [
        { title: 'Symétrie et fibres', flex: 2, cols: 2, fields: [
          { k: 'A6.SYMTAB', code: 'SYMTAB', label: 'symétrie', type: 'sel', opts: [[1, '1 — symétrique'], [0, '0 — asymétrique']], help: 'Symétrie transversale du profil en travers : 1 si ETROTG = ETROTD et EGAU = EDROI, 0 dans les autres cas.' },
          { k: 'A6.NF', code: 'NF', label: 'fibres flex. transv.', type: 'sel', opts: [[1, '1 — axe'], [2, '2 — + ±EDALLE/4'], [3, '3 — + ±3 EDALLE/8']], help: 'Fibres étudiées en flexion transversale : 1 axe mécanique ; 2 axe et fibres à ±EDALLE/4 ; 3 en plus fibres à ±3 EDALLE/8. Normalement 3.' },
        ] },
        { title: 'Axe mécanique', alt: true, flex: 2, cols: 2, fields: [
          { k: 'A6.DISEXT', code: 'DISEXT', label: 'extrados', unit: 'm', dec: 3, help: 'Distance de l\'axe mécanique à l\'axe géométrique de l\'extrados de la dalle (0 si confondus).' },
          { k: 'A6.DISINT', code: 'DISINT', label: 'intrados', unit: 'm', dec: 3, help: 'Distance de l\'axe mécanique à l\'axe géométrique de l\'intrados de la dalle (0 si confondus).' },
        ] },
        { title: 'Largeur exceptionnelle (normalement 0)', flex: 4, cols: 4, fields: [2, 3, 4, 5].map(i => ({ k: 'A6.YY' + i, code: `YY(${i})`, label: 'fibre ' + i, unit: 'm', dec: 3, help: `Ouvrages exceptionnels seulement : distance au bord gauche du trottoir gauche de la fibre ${i} étudiée pour les coefficients K. Normalement 0.` })) },
      ] },
    ], schema: (svg) => drawCoupe(svg, gen(), true) },

    { id: 'sect', label: 'Coupe transversale', view: 'coupe', caption: 'ligne A7 — structure porteuse', hint: 'Nervure, flancs obliques et encorbellements de la dalle (largeurs droites cumulées).', pages: [
      { label: 'Section', groups: [
        { title: 'Épaisseurs', flex: 3, cols: 3, fields: [
          { k: 'A7.HDALLE1', code: 'HDALLE1', label: 'nervure', unit: 'm', dec: 3, help: 'Épaisseur de la dalle résistante (de la nervure si la coupe comporte des encorbellements). À majorer si la dalle est bombée.' },
          { k: 'A7.HDALLE2', code: 'HDALLE2', label: 'bout d\'encorb.', unit: 'm', dec: 3, help: 'Épaisseur à l\'extrémité des encorbellements latéraux. Cas courant : moyenne ½(h1 + h2) des épaisseurs d\'encorbellement.' },
          { k: 'A7.HDALLE3', code: 'HDALLE3', label: 'flanc', unit: 'm', dec: 3, help: 'Hauteur verticale du flanc oblique entre l\'encorbellement et le corps de la dalle. Cas courant : HDALLE1 − HDALLE2.' },
        ] },
        { title: 'Largeurs droites', alt: true, flex: 3, cols: 3, fields: [
          { k: 'A7.EDALLE1', code: 'EDALLE1', label: 'intrados', unit: 'm', dec: 3, help: 'Largeur droite d\'intrados entre encorbellements (entre arêtes inférieures de la nervure).' },
          { k: 'A7.EDALLE2', code: 'EDALLE2', label: 'encorb. cumulés', unit: 'm', dec: 3, help: 'Largeur droite cumulée des deux encorbellements (gauche + droit).' },
          { k: 'A7.EDALLE3', code: 'EDALLE3', label: 'flancs cumulés', unit: 'm', dec: 3, help: 'Largeur droite cumulée des deux flancs obliques (projection horizontale).' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, gen(), true, 'half') },

    { id: 'charg', label: 'Charges', view: 'coupe', caption: 'ligne A8', hint: 'Charges permanentes, charges d\'exploitation du fascicule 61 titre II, coefficients de répartition imposés.', pages: [
      { label: 'Permanentes', groups: [
        { title: 'Ossature', flex: 3, cols: 3, fields: [
          { k: 'A8.MASVOL', code: 'MASVOL', label: 'masse vol.', unit: 't/m³', dec: 3, def: '2,5 (0 = 2,5)', help: 'Valeur probable de la masse volumique du béton armé (2,5 t/m³ du BAEL si 0).' },
          { k: 'A8.OSMAX', code: 'OSSAM', label: 'coef. max', dec: 3, def: '1', help: 'Coefficient multiplicateur de la valeur nominale maximale du poids de l\'ossature (normalement 1).' },
          { k: 'A8.OSMIN', code: 'OSSAm', label: 'coef. min', dec: 3, def: '1', help: 'Coefficient multiplicateur de la valeur nominale minimale du poids de l\'ossature (normalement 1).' },
        ] },
        { title: 'Superstructures', alt: true, flex: 2, cols: 2, fields: [
          { k: 'A8.QSUPMAX', code: 'QSUPTM', label: 'max', unit: 't/m', dec: 3, help: 'Valeur nominale maximale du poids des superstructures (équipements ne concourant pas à la résistance), par mètre de tablier.' },
          { k: 'A8.QSUPMIN', code: 'QSUPTm', label: 'min', unit: 't/m', dec: 3, help: 'Valeur nominale minimale du poids des superstructures, par mètre de tablier.' },
        ] },
        { title: 'Gradient thermique', flex: 2, cols: 2, fields: [
          { k: 'A8.DGRADI', code: 'DGRADI', label: 'gradient', unit: '°C', dec: 1, help: 'Gradient thermique (°C). Normalement 0 pour un pont-dalle en béton armé.' },
          { k: 'A8.XGRADI', code: 'XGRADI', label: 'fraction', dec: 1, help: 'Fraction du gradient thermique prise en compte. Normalement 0.' },
        ] },
      ] },
      { label: 'Exploitation', groups: [
        { title: 'Fascicule 61 titre II', flex: 4, cols: 4, fields: [
          { k: 'A8.STATUT', code: 'STATUT', label: 'classe', type: 'sel', opts: [['100', '100 — 1re classe'], ['200', '200 — 2e classe'], ['300', '300 — 3e classe'], ['000', '000 — F61 de 1960']], help: 'Classe du pont (F61 II art. 3) : 100, 200, 300 ; 000 = calcul selon le titre II de 1960.' },
          { k: 'A8.A', code: 'A', label: 'charge A(l)', type: 'sel', opts: [['001', '001 — réglementaire'], ['100', '100 — généralisée (B3)']], help: '001 : charge A(l) réglementaire du F61 II ; 100 : charge généralisée définie en ligne B3 (passerelle, voie ferrée…).' },
          { k: 'A8.B', code: 'B', label: 'charges B', type: 'sel', opts: [['001', '001 — Bc et Bt'], ['100', '100 — BG seuls'], ['101', '101 — B + BG']], help: '001 : camions Bc et tandems Bt ; 100 : seuls camions généralisés BG (lignes B1, B2) ; 101 : B du F61 et BG.' },
          { k: 'A8.CE', code: 'CE', label: 'caract. particulier', type: 'sel', opts: [['000', '000 — aucune'], ['003', '003 — Mc80'], ['004', '004 — Mc120'], ['010', '010 — convoi D'], ['020', '020 — D et E'], ['013', '013 — D + Mc80'], ['014', '014 — D + Mc120'], ['023', '023 — D, E + Mc80'], ['024', '024 — D, E + Mc120']], help: 'Code i m j : i charges généralisées (lignes B4), m convois exceptionnels (1 : D ; 2 : D et E), j charges militaires (3 : Mc80 ; 4 : Mc120). Ex. 024 = D, E et Mc120.' },
        ] },
        { title: 'Trottoirs', alt: true, flex: 1, cols: 1, fields: [
          { k: 'A8.PSTROT', code: 'PSTROT', label: 'charge', unit: 't/m²', dec: 3, help: 'Charge générale des trottoirs : 0 pour une plateforme autoroutière, 0,150 t/m² pour une voirie ordinaire.' },
        ] },
      ] },
      { label: 'Coefficients K imposés', groups: [
        { title: 'Coefficients correctifs de répartition transversale — seulement si EXCENTR = 0', flex: 5, cols: 5, fields: [
          { k: 'A8.XKA', code: 'KA', label: 'charge A', dec: 3, help: 'Coefficient de répartition transversale imposé pour A(l), incluant a1 : de la forme a1(NVOIE)·(1 + ε). Seulement si EXCENTR = 0.' },
          { k: 'A8.XKBC', code: 'KBC', label: 'Bc', dec: 3, help: 'Coefficient imposé pour Bc, incluant bc : de la forme bc(NVOIE)·(1 + ε). Seulement si EXCENTR = 0.' },
          { k: 'A8.XKBT', code: 'KBT', label: 'Bt', dec: 3, help: 'Coefficient imposé pour Bt. Seulement si EXCENTR = 0.' },
          { k: 'A8.XKCM', code: 'KCM', label: 'char', dec: 3, help: 'Coefficient imposé pour le char militaire. Seulement si EXCENTR = 0.' },
          { k: 'A8.XKTR', code: 'KTR', label: 'trottoirs', dec: 3, help: 'Coefficient imposé pour la charge des trottoirs. Seulement si EXCENTR = 0.' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, gen(), true, 'loads') },

    { id: 'mat', label: 'Béton', view: 'coupe', caption: 'ligne A9 (et C1)', hint: 'État-limite d\'ouverture des fissures et caractéristiques du béton (unités du bordereau : t/m²).', pages: [
      { label: 'Béton', groups: [
        { title: 'Fissuration', flex: 3, cols: 3, fields: [
          { k: 'A9.GENRE', code: 'GENRE', label: 'fissuration', type: 'sel', opts: [['100', '100 — peu préjudiciable'], ['200', '200 — préjudiciable'], ['300', '300 — très préjudiciable'], ['101', '101 — peu préj. + C1'], ['201', '201 — préj. + C1'], ['301', '301 — très préj. + C1']], help: '100 / 200 / 300 : fissuration peu préjudiciable / préjudiciable / très préjudiciable ; i01 : contraintes limites extra-réglementaires lues en ligne C1.' },
          { k: 'A9.BA', code: 'BA', label: 'coef. BA', type: 'sel', opts: [['000', '000 — réglementaires'], ['001', '001 — lignes C2/C3'], ['100', '100 — lignes C2/C3']], help: 'Une valeur non nulle du chiffre des unités ou des centaines provoque la lecture des lignes C2 et C3 (coefficients extra-réglementaires). Normalement 000.' },
          { k: 'A9.XKI', code: 'ψ1', label: 'combin. fréquente', dec: 3, help: 'XKI : fraction ψ1 des charges d\'exploitation sans caractère particulier pour la combinaison fréquente à l\'ELS.' },
        ] },
        { title: 'Caractéristiques du béton', alt: true, flex: 4, cols: 4, fields: [
          { k: 'A9.FCJ', code: 'FCJ', label: 'compression', unit: 't/m²', dec: 0, help: 'Résistance caractéristique à la compression à j = 28 jours, en t/m² (3000 t/m² ≈ 30 MPa).', def: '3000' },
          { k: 'A9.FTJ', code: 'FTJ', label: 'traction', unit: 't/m²', dec: 0, help: 'Résistance caractéristique à la traction à 28 jours, en t/m² : ftj = 60 + 0,06 fcj (240 t/m² pour 3000).', def: '240' },
          { k: 'A9.POISSON', code: 'POISSON', label: 'coef. Poisson', dec: 3, help: 'Coefficient de Poisson du béton (flexion transversale). Valeur conseillée 0,20.', def: '0,20' },
          { k: 'A9.RETRAI', code: 'RETRAIT', label: 'retrait', dec: 5, help: 'Raccourcissement relatif final du retrait du béton (BAEL A.2.1,22), ex. 0,00040.', def: '0,00040' },
        ] },
      ] },
      { label: 'Contraintes limites (C1)', groups: [
        { title: 'Classe extra-réglementaire — seulement si GENRE = i01', flex: 5, cols: 5, fields: [
          { k: 'C1.XB', code: 'XB', label: 'xb', dec: 2, help: 'Ligne C1, coefficient xb de la classe extra-réglementaire (seulement si GENRE = 101, 201 ou 301).' },
          ...[1, 2, 3, 4].map(i => ({ k: 'C1.SS' + i, code: 'ss' + i, label: `σs PHI${i}`, unit: 't/m²', dec: 0, help: `Contrainte limite de traction des aciers de diamètre PHI${i} à l'ELS, en t/m² (seulement si GENRE = i01).` })),
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, gen(), true, 'mat') },

    { id: 'acier', label: 'Armatures', view: 'arm', caption: 'lignes A10 et A11', hint: 'Diamètres, nuances et disposition des armatures (diamètres saisis en mm, écrits en m dans le bordereau).', pages: [
      { label: 'Diamètres et limites', groups: [
        { title: 'Diamètres', flex: 4, cols: 4, fields: [
          { k: 'A10.PHI1', code: 'PHI1', label: 'longit. princ.', unit: 'mm', dec: 0, help: 'Diamètre des aciers longitudinaux principaux (et éventuellement des chevêtres incorporés).' },
          { k: 'A10.PHI2', code: 'PHI2', label: 'transv. inf.', unit: 'mm', dec: 0, help: 'Diamètre des aciers transversaux inférieurs en travée, des chevêtres incorporés et des aciers longitudinaux complémentaires.' },
          { k: 'A10.PHI3', code: 'PHI3', label: 'transv. sup.', unit: 'mm', dec: 0, help: 'Diamètre des aciers transversaux supérieurs en travée et éventuellement des aciers longitudinaux de construction.' },
          { k: 'A10.PHI4', code: 'PHI4', label: 'étriers', unit: 'mm', dec: 0, help: 'Diamètre des étriers.' },
        ] },
        { title: 'Limites d\'élasticité', alt: true, flex: 4, cols: 4, fields: [1, 2, 3, 4].map(i => ({ k: 'A10.FE' + i, code: 'FE' + i, unit: 't/m²', dec: 0, def: '50000', help: `Limite d'élasticité garantie des aciers PHI${i}, en t/m² (50 000 t/m² = FeE500 ; 40 000 = FeE400).` })) },
      ] },
      { label: 'Nuances et adhérence', groups: [
        { title: 'Nuances (BAEL A.2.2)', flex: 4, cols: 4, fields: [1, 2, 3, 4].map(i => ({ k: 'A10.NA' + i, code: 'NA' + i, type: 'sel', opts: [[0, '0 — palier fe'], [1, '1 — écrouissage']], help: `Nuance des aciers PHI${i} : 0 contrainte plafonnée à fe ; 1 contrainte croissant linéairement jusqu'à 1,1 fe à 10 ‰.` })) },
        { title: 'Fissuration et scellement', alt: true, flex: 5, cols: 5, fields: [
          ...[1, 2, 3, 4].map(i => ({ k: 'A10.ETA' + i, code: 'ETA' + i, dec: 2, def: '1,60', help: `Coefficient de fissuration η des aciers PHI${i} (BAEL A.4.5,3) : 1,6 pour les HA.` })),
          { k: 'A10.PSID', code: 'PSID', label: 'ψs', dec: 2, def: '1,50', help: 'Coefficient de scellement ψs caractérisant l\'adhérence des barres (BAEL A.6.1,21) : 1,5 pour les HA.' },
        ] },
      ] },
      { label: 'Disposition (A11)', groups: [
        { title: 'Groupes de barres longitudinales', flex: 4, cols: 4, fields: [
          { k: 'A11.N1', code: 'N1', label: 'barres / groupe', type: 'int', def: '3', help: 'Nombre de barres dans un groupe d\'armatures longitudinales (valeur conseillée 3).' },
          { k: 'A11.N2', code: 'N2', label: 'groupes / épure', type: 'int', def: '3', help: 'Nombre de groupes considérés ensemble pour l\'épure d\'arrêt des barres (valeur conseillée 3).' },
          { k: 'A11.ESPAC1', code: 'ESPAC1', label: 'espacement', unit: 'm', dec: 3, help: 'Espacement désiré entre axes des groupes (conseillé 10 PHI1) ; éventuellement réduit par le programme.' },
          { k: 'A11.ESPAC2', code: 'ESPAC2', label: 'réservé', unit: 'm', dec: 3, help: 'Case réservée : porter 0.' },
        ] },
        { title: 'Enrobages', alt: true, flex: 2, cols: 2, fields: [
          { k: 'A11.ENROBS', code: 'ENROBS', label: 'nappe sup.', unit: 'm', dec: 3, help: 'Enrobage des aciers de la nappe supérieure.' },
          { k: 'A11.ENROBI', code: 'ENROBI', label: 'nappe inf.', unit: 'm', dec: 3, help: 'Enrobage des aciers de la nappe inférieure.' },
        ] },
      ] },
    ], schema: (svg) => drawArm(svg, gen(), true) },

    { id: 'app', label: 'Appuis', view: 'plan', caption: 'lignes A12 et A13 — appuis numérotés de gauche à droite', hint: 'Tassements d\'appui (A12) et appareils d\'appui (A13), appuis numérotés de 1 à NT + 1.', pages: [
      { label: 'Tassements par appui (A12)', groups: [1, 2, 3, 4, 5, 6, 7].map(i => ({ title: 'Appui ' + i, alt: i % 2 === 0, flex: 2, cols: 2, fields: [tp(i), dtp(i)] })) },
      { label: 'Coefficients et compressions', groups: [
        { title: 'Tassements (A12)', flex: 2, cols: 2, fields: [
          { k: 'A12.YOUNG', code: 'YOUNG', label: 'Ei28 / E', dec: 3, def: '3', help: 'Valeur entre 3 et 5 donnant le module Ei28/YOUNG utilisé pour les efforts dus aux tassements. Sauf précision contraire, 3.' },
          { k: 'A12.KTP', code: 'KTP', label: 'fraction ELS', dec: 3, def: '1', help: 'Fraction des tassements probables prise en compte dans l\'étude ELS (combinaison quasi permanente).' },
        ] },
        { title: 'Appareils d\'appui (A13) — compressions admissibles en t/m²', alt: true, flex: 5, cols: 5, fields: [
          { k: 'A13.COMPRENV', code: 'COMPRENV', label: 'élast. min', dec: 0, def: '200', help: 'Contrainte minimale admissible de compression moyenne des appareils en élastomère (risque de cheminement), t/m². Conseillé 200.' },
          { k: 'A13.COMPRENS', code: 'COMPRENS', label: 'élast. max', dec: 0, def: '1200', help: 'Contrainte maximale admissible de compression moyenne des appareils en élastomère, t/m². Conseillé 1200.' },
          { k: 'A13.COMPREBV', code: 'COMPREBV', label: 'béton min', dec: 0, def: '2000', help: 'Contrainte minimale admissible de compression moyenne des appareils en section rétrécie de béton, t/m². Conseillé 2000.' },
          { k: 'A13.COMPREBS', code: 'COMPREBS', label: 'béton max', dec: 0, def: '3500', help: 'Contrainte maximale admissible de compression moyenne des appareils en section rétrécie de béton, t/m². Conseillé 3500.' },
          { k: 'A13.SYMAP', code: 'SYMAP', label: 'symétrie', type: 'sel', opts: [[1, '1 — longit.'], [0, '0 — aucune'], [2, '2 — interm. id.']], help: 'Symétrie longitudinale des appareils : 0 aucune ; 1 symétrie longitudinale ; 2 appareils des appuis intermédiaires tous identiques.' },
        ] },
      ] },
      { label: 'Appareils par appui (A13)', groups: [1, 2, 3, 4, 5, 6, 7].map(i => ({ title: 'Appui ' + i, alt: i % 2 === 0, flex: 2, cols: 2, fields: [typ(i), nap(i)] })) },
    ], schema: (svg) => drawElev(svg, gen(), true, 'appt') },
  ];

  /* ───── modèle générique pour les schémas de principe ───── */
  let GEN = null;
  function gen() {
    if (GEN) return GEN;
    const m = E.parseBordereau(EX1);
    const L = m.lignes;
    Object.assign(L.A5, { NT: 3, BIAIS: 80, ABOUT: 0.8, D1: 11, D2: 15, D3: 11 });
    Object.assign(L.A6, { ETROTG: 1.25, EGAU: 0.75, ESURCH: 7, EDROI: 0.75, ETROTD: 1.25, HCHAU: 0.12, NVOIE: 2 });
    Object.assign(L.A7, { HDALLE1: 0.8, HDALLE2: 0.35, HDALLE3: 0.45, EDALLE1: 6, EDALLE2: 4, EDALLE3: 1.4 });
    Object.assign(L.A10, { PHI1: 0.032, PHI2: 0.016, PHI3: 0.012, PHI4: 0.010 });
    Object.assign(L.A11, { ESPAC1: 0.30, ENROBS: 0.04, ENROBI: 0.04, N1: 3 });
    GEN = m; return m;
  }

  /* ───── dessins ───── */
  const lab = (m, k, sch, d, u) => sch ? code(k) : fmt(V(m, k), d == null ? 2 : d) + (u || '');
  const P = (x, y) => (+x.toFixed(4)) + ',' + (+(-y).toFixed(4));
  // remplissage sans contour (pour découper une forme en zones surlignables)
  const zone = (d, pts, k, cls) => d.raw(`<polygon points="${pts.map(p => P(p[0], p[1])).join(' ')}" class="${cls || 'b'}" style="stroke:none" data-k="${esc(k)}"/>`);
  const arrow = (d, x, y0, y1, k) => { d.line(x, y0, x, y1, 'l', k); const s = Math.sign(y1 - y0) || 1, a = Math.abs(y1 - y0) * 0.28; d.poly([[x, y1], [x - a * 0.45, y1 - s * a], [x + a * 0.45, y1 - s * a]], 'b', k); };

  function spans(m) {
    const n = Math.max(1, Math.min(6, Math.round(V(m, 'A5.NT')) || 1));
    const D = []; for (let i = 1; i <= n; i++) D.push(V(m, 'A5.D' + i));
    const Dd = D.map(x => x > 0.5 ? x : 0.5);
    const ab = Math.max(0, V(m, 'A5.ABOUT'));
    const xs = [ab]; for (const x of Dd) xs.push(xs[xs.length - 1] + x);
    return { n, D, Dd, ab, xs, Lt: xs[n] + ab };
  }
  function sectionOf(m) {
    let H1 = V(m, 'A7.HDALLE1'), H2 = V(m, 'A7.HDALLE2'), H3 = V(m, 'A7.HDALLE3');
    const E1 = Math.max(V(m, 'A7.EDALLE1'), 0.5), E2 = Math.max(V(m, 'A7.EDALLE2'), 0), E3 = Math.max(V(m, 'A7.EDALLE3'), 0);
    if (!(H1 > 0)) H1 = 0.5; H2 = Math.min(Math.max(H2, 0), H1); H3 = Math.min(Math.max(H3, 0), H1);
    const xa = E1 / 2, xb = E1 / 2 + E3 / 2, xc = (E1 + E2 + E3) / 2;
    return { H1, H2, H3, E1, E2, E3, xa, xb, xc, W: 2 * xc };
  }
  const fmtL = x => fmt(x, 2);

  /* vue en plan biaise, dessinée dans d autour de l'axe y = yc */
  function planInto(d, m, sch, yc, s, o) {
    o = o || {};
    const { n, ab, xs, Lt } = spans(m);
    const S = sectionOf(m), W = S.W;
    const bg = Math.max(20, Math.min(100, V(m, 'A5.BIAIS') || 100)), b = bg * GR, ct = Math.cos(b) / Math.sin(b);
    const ws = ['A6.ETROTG', 'A6.EGAU', 'A6.ESURCH', 'A6.EDROI', 'A6.ETROTD'].map(k => Math.max(0, V(m, k)));
    const Ws = ws.reduce((a, c) => a + c, 0);
    const ex = W / 2 * Math.abs(ct);
    const Y = y => y + yc;
    const strip = (y1, y2, cls, k) => d.poly([[y1 * ct, Y(y1)], [Lt + y1 * ct, Y(y1)], [Lt + y2 * ct, Y(y2)], [y2 * ct, Y(y2)]], cls, k);
    strip(-W / 2, W / 2, 'b', 'A7.EDALLE1 A7.EDALLE2 A7.EDALLE3');
    // profil : ETROTG en haut (à gauche dans le sens de l'axe)
    let y = Ws / 2; const ys = [y]; for (const w of ws) { y -= w; ys.push(y); }
    if (ws[0] > 0) strip(ys[1], ys[0], 'b2', 'A6.ETROTG');
    if (ws[4] > 0) strip(ys[5], ys[4], 'b2', 'A6.ETROTD');
    for (const yy of [ys[2], ys[3]]) d.line(yy * ct, Y(yy), Lt + yy * ct, Y(yy), 'l', 'A6.ESURCH');
    const nvR = Math.round(V(m, 'A6.NVOIE')), nv = nvR > 0 ? nvR : nvF61(ws[2]);
    for (let i = 1; i < nv; i++) { const yy = ys[2] - ws[2] * i / nv; for (let x = 0.5; x < Lt - 1; x += 3) d.line(x + yy * ct, Y(yy), x + 1.5 + yy * ct, Y(yy), 'l', 'A6.NVOIE'); }
    d.line(-ex - 1.5 * s, Y(0), Lt + ex + 1.5 * s, Y(0), 'ax');
    // lignes d'appui et appareils
    for (let k = 0; k <= n; k++) {
      d.line(xs[k] - W / 2 * ct, Y(-W / 2), xs[k] + W / 2 * ct, Y(W / 2), 'ax', 'A5.BIAIS');
      const na = Math.max(0, Math.round(V(m, 'A13.NAP' + (k + 1))));
      const esp = na > 1 ? Math.floor(100 * S.E1 / (na - 0.6) / Math.sin(b) + 1e-9) / 100 : 0;
      const q = Math.max(0.22, s * 0.45);
      for (let j = 0; j < na; j++) { const t = (j - (na - 1) / 2) * esp; d.rect(xs[k] + t * Math.cos(b) - q, Y(t * Math.sin(b)) - q, 2 * q, 2 * q, 'car', `A13.NAP${k + 1} A13.TYPAP${k + 1}`); }
      if (o.nums) d.text(xs[k] + (W / 2 + 1.6 * s) * ct, Y(W / 2 + 1.6 * s), sch ? `NAP${k + 1}` : `${na} app.`, { size: 0.75, cls: sch ? 'tc' : 'dv', k: `A13.NAP${k + 1} A13.TYPAP${k + 1}` });
    }
    // cotes
    if (o.dims) {
      const yb = -W / 2;
      for (let i = 0; i < n; i++) d.dim(xs[i] + yb * ct, Y(yb), xs[i + 1] + yb * ct, Y(yb), sch ? 'D' + (i + 1) : fmt(V(m, 'A5.D' + (i + 1)), 2), -6.4 * s, 'A5.D' + (i + 1));
    }
    const xr = Lt + ex + 1.6 * s;
    d.dim(xr, Y(-W / 2), xr, Y(W / 2), sch ? 'EDALLE1+2+3' : fmt(W, 2), -0.01, 'A7.EDALLE1 A7.EDALLE2 A7.EDALLE3', { size: 0.8 });
    // angle de biais, sous l'arête inférieure, à l'appui 1
    const r = Math.min(W * 0.4, 4.2 * s), xi = xs[0] - W / 2 * ct, yi = Y(-W / 2);
    d.line(xi - r * 1.25, yi, xi, yi, 'l', 'A5.BIAIS');
    d.line(xi, yi, xi - r * 1.25 * Math.cos(b), yi - r * 1.25 * Math.sin(b), 'ax', 'A5.BIAIS');
    const arc = []; for (let i = 0; i <= 18; i++) { const t = Math.PI + b * i / 18; arc.push([xi + r * Math.cos(t), yi + r * Math.sin(t)]); }
    d.path(arc, 'l', 'A5.BIAIS');
    const tm = Math.PI + b / 2;
    d.text(xi + r * 1.5 * Math.cos(tm), yi + r * 1.35 * Math.sin(tm), sch ? 'BIAIS' : fmt(bg, 1) + ' gr', { size: 0.8, cls: sch ? 'tc' : 'dv', a: 'end', k: 'A5.BIAIS' });
    d.text(Lt + ex + 1.0 * s, Y(1.3 * s), 'axe →', { size: 0.7, cls: 'ts', a: 'end' });
    return { top: Y(W / 2), bottom: yi - r * 1.5 };
  }

  /* élévation longitudinale + vue en plan alignée */
  function drawElev(svg, m, sch, mode) {
    const { n, D, Dd, ab, xs, Lt } = spans(m);
    const S = sectionOf(m), H = S.H1, hc = Math.max(0, V(m, 'A6.HCHAU'));
    const s = Lt / 100, hp = Math.max(2.5, Lt * 0.09), bh = Math.max(0.15, s * 0.45);
    const top = H + Math.max(hc, s * 0.2);
    const T = mode === 'tass' || mode === 'appt';
    const yt = -hp - (T ? 5.2 * s : 1.6 * s) - 2.6 * s;                // ligne de légende
    const W = S.W, bc = Math.max(20, Math.min(100, V(m, 'A5.BIAIS') || 100)) * GR;
    const NUMS = mode === 'app' || mode === 'appt';
    const yc = yt - (NUMS ? 5.2 : 3.2) * s - W / 2;                      // axe de la vue en plan
    const yb = yc - W / 2 - Math.min(W * 0.4, 4.2 * s) * 1.6 - 1.5 * s;
    const ex = W / 2 * Math.abs(Math.cos(bc) / Math.sin(bc));
    const rr = Math.min(W * 0.4, 4.2 * s);
    const d = svg({ x0: -Math.max(3.5 * s, ex + 1.2 * rr + 9 * s), y0: yb, x1: Lt + Math.max(3.5 * s, ex + 3.5 * s), y1: top + 9.5 * s }, { pad: 0.03 });
    const u = d.u;
    // terrain, culées, piles
    const xg0 = -3.5 * s, xg1 = Lt + 3.5 * s;
    d.soil([[xg0, -hp], [xg1, -hp]], 1.4 * s);
    const cw = Math.max(1.2, 2.5 * s);
    d.fill([[xg0, -hp], [xs[0] - cw * 0.6, -hp], [xs[0] - cw * 0.6, -bh], [xg0, -bh]]);
    d.fill([[xg1, -hp], [xs[n] + cw * 0.6, -hp], [xs[n] + cw * 0.6, -bh], [xg1, -bh]]);
    d.rect(xs[0] - cw * 0.6, -hp, cw, hp - bh, 'b2');
    d.rect(xs[n] - cw * 0.4, -hp, cw, hp - bh, 'b2');
    const pw = Math.max(0.7, 1.6 * s);
    for (let k = 1; k < n; k++) d.rect(xs[k] - pw / 2, -hp, pw, hp - bh, 'b2');
    // tablier
    d.rect(0, 0, Lt, H, 'b');
    zone(d, [[0, 0], [xs[0], 0], [xs[0], H], [0, H]], 'A5.ABOUT');
    zone(d, [[xs[n], 0], [Lt, 0], [Lt, H], [xs[n], H]], 'A5.ABOUT');
    for (let i = 0; i < n; i++) zone(d, [[xs[i], 0], [xs[i + 1], 0], [xs[i + 1], H], [xs[i], H]], 'A5.D' + (i + 1) + ' A7.HDALLE1');
    d.path([[0, 0], [Lt, 0], [Lt, H], [0, H], [0, 0]], 'l');
    d.rect(0, H, Lt, Math.max(hc, s * 0.2), 'road', 'A6.HCHAU');
    // appuis
    for (let k = 0; k <= n; k++) {
      d.line(xs[k], -hp + 0.3 * s, xs[k], top + 1.6 * s, 'ax');
      const q = Math.max(0.25, s * 0.6);
      d.rect(xs[k] - q, -bh, 2 * q, bh, 'b', `A13.NAP${k + 1} A13.TYPAP${k + 1}`);
      const ycir = -hp * 0.5, kk = `A12.TP${k + 1} A12.DTP${k + 1} A13.NAP${k + 1}`;
      d.circle(xs[k], ycir, 1.5 * s, 'car', kk);
      d.text(xs[k], ycir, String(k + 1), { size: 0.85, cls: 't', k: kk });
      if (T) {
        const y0 = -hp - 0.3 * s, y1 = -hp - 3.4 * s;
        arrow(d, xs[k], y0, y1, `A12.TP${k + 1} A12.DTP${k + 1}`);
        d.text(xs[k] + 0.8 * s, (y0 + y1) / 2 - 0.4 * s, sch ? `TP${k + 1}+DTP${k + 1}` : fmt(V(m, 'A12.TP' + (k + 1)), 3) + '+' + fmt(V(m, 'A12.DTP' + (k + 1)), 3), { size: 0.7, a: 'start', cls: sch ? 'tc' : 'dv', k: `A12.TP${k + 1} A12.DTP${k + 1}` });
      }
    }
    // cotes
    for (let i = 0; i < n; i++) d.dim(xs[i], top, xs[i + 1], top, sch ? 'D' + (i + 1) : fmt(D[i], 2), 3.0 * s, 'A5.D' + (i + 1), { size: 1.1 });
    if (ab > 0) {
      d.dim(0, top, xs[0], top, '', 3.0 * s, 'A5.ABOUT'); d.dim(xs[n], top, Lt, top, '', 3.0 * s, 'A5.ABOUT');
      d.text(-0.7 * s, top + 3.0 * s + 1.4 * u, sch ? 'ABOUT' : fmt(ab, 2), { size: 0.8, a: 'end', cls: sch ? 'tc' : 'dv', k: 'A5.ABOUT' });
      d.text(Lt + 0.7 * s, top + 3.0 * s + 1.4 * u, sch ? 'ABOUT' : fmt(ab, 2), { size: 0.8, a: 'start', cls: sch ? 'tc' : 'dv', k: 'A5.ABOUT' });
    }
    d.dim(0, top, Lt, top, sch ? 'longueur totale = 2 ABOUT + ΣD' : 'longueur totale ' + fmt(Lt, 2) + ' m', 6.6 * s, null, { size: 1.05 });
    // légende
    const Lmax = Math.max(...D, 0);
    d.text(0, yt, sch ? 'NT travées' : `${n} travée${n > 1 ? 's' : ''}`, { size: 0.9, a: 'start', cls: sch ? 'tc' : 'ts', k: 'A5.NT' });
    d.text(Lt / 2, yt, sch ? 'HDALLE1 — élancement HDALLE1 / Dmax' : `épaisseur ${fmt(H, 3)} m — élancement 1/${Lmax > 0 ? Math.round(Lmax / H) : '—'}`, { size: 0.9, cls: sch ? 'tc' : 'ts', k: 'A7.HDALLE1' });
    d.text(Lt, yt, sch ? 'vue en plan ↓' : 'vue en plan ↓', { size: 0.9, a: 'end', cls: 'ts' });
    planInto(d, m, sch, yc, s, { nums: NUMS });
    return d.toString();
  }

  /* coupe transversale (mode : 'loads' charges, 'mat' béton, 'half' demi-coupe détaillée) */
  function drawCoupe(svg, m, sch, mode) {
    const S = sectionOf(m), { H1, H2, H3, xa, xb, xc } = S;
    const ws = ['A6.ETROTG', 'A6.EGAU', 'A6.ESURCH', 'A6.EDROI', 'A6.ETROTD'].map(k => Math.max(0, V(m, k)));
    const Ws = ws.reduce((a, b) => a + b, 0);
    const hc = Math.max(0, V(m, 'A6.HCHAU')), ht = 0.18;
    const half = Math.max(xc, Ws / 2);
    const top = H1 + hc;
    const HALF = mode === 'half';
    const yTop = top + (mode === 'loads' ? 2.6 : HALF ? 0.9 : 2.3);
    const d = HALF ? svg({ x0: -0.9, y0: -1.25, x1: xc + 0.7, y1: yTop }, { pad: 0.04 }) : svg({ x0: -half - 0.9, y0: -1.95, x1: half + 0.9, y1: yTop }, { pad: 0.04 });
    const u = d.u, Z = HALF ? 0.75 : 1;                       // tailles de texte relatives
    // section
    const R = [[xa, 0], ...(xb > xa ? [[xb, H3]] : [[xa, H3]]), ...(xc > xb ? [[xc, H1 - H2]] : []), [xc, H1]];
    const full = [...R.slice().reverse().map(p => [-p[0], p[1]]), ...R];
    d.poly(full, 'b');
    zone(d, [[-xa, 0], [xa, 0], [xa, H1], [-xa, H1]], 'A7.EDALLE1 A7.HDALLE1');
    for (const sg of [1, -1]) {
      if (xb > xa) zone(d, [[sg * xa, 0], [sg * xb, H3], [sg * xb, H1], [sg * xa, H1]], 'A7.EDALLE3 A7.HDALLE3');
      if (xc > xb) zone(d, [[sg * xb, H3], [sg * xc, H1 - H2], [sg * xc, H1], [sg * xb, H1]], 'A7.EDALLE2 A7.HDALLE2');
    }
    d.path(full.concat([full[0]]), 'l');
    if (HALF) { zone(d, [[-2, -0.4], [-0.35, -0.4], [-0.35, H1 + hc + 0.6], [-2, H1 + hc + 0.6]], '', 'car'); const p = []; for (let i = 0; i <= 10; i++) p.push([-0.35 + (i % 2 ? 0.05 : -0.05), -0.25 + (H1 + hc + 0.5) * i / 10]); d.path(p, 'l'); }
    d.line(0, -0.9, 0, top + (HALF ? 0.75 : 0.6), 'ax');
    if (HALF) d.text(0.06, top + 0.62, 'axe', { size: 0.8, a: 'start', cls: 'ts' });
    // superstructures (profil centré sur l'axe)
    const xp = [-Ws / 2]; for (const w of ws) xp.push(xp[xp.length - 1] + w);
    const QS = ' A8.QSUPMAX A8.QSUPMIN';
    if (xp[4] > xp[1]) d.rect(xp[1], H1, xp[4] - xp[1], Math.max(hc, u * 0.45), 'road', 'A6.HCHAU A6.ESURCH' + QS);
    if (ws[0] > 0) d.rect(xp[0], H1, ws[0], hc + ht, 'b2', 'A6.ETROTG' + QS);
    if (ws[4] > 0) d.rect(xp[4], H1, ws[4], hc + ht, 'b2', 'A6.ETROTD' + QS);
    for (const [x, w, k] of [[xp[1], ws[1], 'A6.EGAU'], [xp[4], -ws[3], 'A6.EDROI']]) if (Math.abs(w) > 0) { d.rect(x - (w < 0 ? 0.06 : 0), top, 0.06, 0.5, 'b', k); d.line(x, top + 0.45, x + w * 0.7, top + 0.45, 'l', k); }
    const nvR = Math.round(V(m, 'A6.NVOIE')), nv = nvR > 0 ? nvR : nvF61(ws[2]);
    for (let i = 1; i < nv; i++) { const x = xp[2] + ws[2] * i / nv; d.line(x, top + 0.02, x, top + 0.22, 'l', 'A6.NVOIE'); }
    const L = k => lab(m, k, sch, 3);
    if (mode === 'loads') {
      if (ws[2] > 0) {
        const cx = xp[2] + ws[2] / 2, tw = Math.min(ws[2] * 0.62, 3.6), th = 0.7, y = top + 0.3;
        const k = 'A8.B A8.A A8.CE A8.STATUT';
        d.rect(cx - tw / 2, y, tw * 0.74, th, 'car', k); d.rect(cx - tw / 2 + tw * 0.77, y, tw * 0.23, th * 1.25, 'car', k);
        for (const f of [0.1, 0.5, 0.88]) d.circle(cx - tw / 2 + tw * f, top + 0.15, 0.15, 'wheel', k);
        d.text(cx - tw / 2 + tw * 0.37, y + th / 2, sch ? 'STATUT · A · B · CE' : `classe ${String(get(m, 'A8.STATUT'))[0] === '0' ? 'F61-1960' : String(get(m, 'A8.STATUT'))[0]} · A(l) · Bc · Bt` + (String(get(m, 'A8.CE')) !== '000' ? ' · CE ' + get(m, 'A8.CE') : ''), { size: 0.72, cls: 'ts', k });
      }
      for (const [x0, w] of [[xp[0], ws[0]], [xp[4], ws[4]]]) if (w > 0) { for (const f of [0.25, 0.75]) arrow(d, x0 + w * f, top + ht + 0.7, top + ht + 0.05, 'A8.PSTROT'); d.text(x0 + w / 2, top + ht + 0.95, sch ? 'PSTROT' : fmt(V(m, 'A8.PSTROT'), 3) + ' t/m²', { size: 0.75, cls: sch ? 'tc' : 'dv', k: 'A8.PSTROT' }); }
      d.text(0, top + 1.95, sch ? 'superstructures QSUPTM · QSUPTm (t/m) : chaussée, trottoirs, corniches, dispositifs de retenue' : `superstructures ${fmt(V(m, 'A8.QSUPMIN'), 3)} à ${fmt(V(m, 'A8.QSUPMAX'), 3)} t/m`, { size: 0.8, cls: sch ? 'tc' : 'dv', k: 'A8.QSUPMAX A8.QSUPMIN' });
      d.text(0, H1 * 0.45, sch ? 'ossature : MASVOL × aire × OSSAM / OSSAm' : `ossature ${fmt(V(m, 'A8.MASVOL') || 2.5, 2)} t/m³`, { size: 0.75, cls: sch ? 'tc' : 'dv', k: 'A8.MASVOL A8.OSMAX A8.OSMIN' });
    } else if (!HALF) {
      const yy = top + ht;
      const keys = ['A6.ETROTG', 'A6.EGAU', 'A6.ESURCH', 'A6.EDROI', 'A6.ETROTD'];
      keys.forEach((k, i) => { if (ws[i] > 0 || sch) d.dim(xp[i], yy, xp[i + 1], yy, lab(m, k, sch, 2), 0.55, k, { size: ws[i] < 0.9 ? 0.75 : 1.0 }); });
      d.dim(xp[0], yy, xp[5], yy, sch ? 'ETROTG + EGAU + ESURCH + EDROI + ETROTD' : 'profil ' + fmt(Ws, 2) + ' m', 1.35, null, { size: 0.9 });
      d.text(xp[2] + ws[2] / 2, top + 0.3, sch ? 'NVOIE voies' : nv + ' voie' + (nv > 1 ? 's' : '') + (nvR > 0 ? '' : ' (F61)'), { size: 0.75, cls: sch ? 'tc' : 'ts', k: 'A6.NVOIE', base: 'auto' });
      if (hc > 0 || sch) d.text(xp[4] - 0.15, top + 0.3, (sch ? 'HCHAU' : 'chaussée ' + fmt(hc, 3)) + ' ▾', { size: 0.7, a: 'end', base: 'auto', cls: sch ? 'tc' : 'dv', k: 'A6.HCHAU' });
    }
    if (mode === 'mat') d.text(0, H1 * 0.45, sch ? 'GENRE · FCJ · FTJ · POISSON · RETRAIT' : `fc28 ${fmt(V(m, 'A9.FCJ') / 100, 1)} MPa · ft28 ${fmt(V(m, 'A9.FTJ') / 100, 2)} MPa`, { size: 0.8, cls: sch ? 'tc' : 'dv', k: 'A9.FCJ A9.FTJ A9.POISSON A9.RETRAI A9.GENRE' });
    // cotes de la section
    const DET = mode !== 'loads' && mode !== 'mat';
    const sides = !DET ? [] : HALF ? [1] : [-1, 1];
    if (xc > xb) for (const sg of sides) d.dim(sg < 0 ? -xc : xb, 0, sg < 0 ? -xb : xc, 0, sch ? 'EDALLE2/2' : fmt(xc - xb, 2), -0.5, 'A7.EDALLE2', { size: 0.9 * Z });
    if (HALF) d.dim(0, 0, xa, 0, sch ? 'EDALLE1/2' : fmt(xa, 2), -0.5, 'A7.EDALLE1', { size: Z });
    else if (DET) d.dim(-xa, 0, xa, 0, sch ? 'EDALLE1' : fmt(S.E1, 2), -0.5, 'A7.EDALLE1', { size: 1.05 });
    if (xb > xa) for (const sg of sides) d.dim(sg < 0 ? -xb : xa, 0, sg < 0 ? -xa : xb, 0, sch ? 'EDALLE3/2' : fmt(xb - xa, 2), -1.0, 'A7.EDALLE3', { size: 0.8 * Z });
    if (!HALF) d.dim(-xc, 0, xc, 0, sch ? 'EDALLE1 + EDALLE2 + EDALLE3' : 'largeur droite ' + fmt(S.W, 2) + ' m', -1.5, 'A7.EDALLE1 A7.EDALLE2 A7.EDALLE3', { size: 0.95 });
    const xh = HALF ? xa * 0.45 : -xa + Math.min(0.5, xa * 0.3);
    if (DET) d.dim(xh, 0, xh, H1, L('A7.HDALLE1'), -0.05, 'A7.HDALLE1', { size: 0.85 * Z, inside: true });
    if (DET && xc > xb && H2 > 0) d.dim(xc, H1 - H2, xc, H1, L('A7.HDALLE2'), -0.2 * Z, 'A7.HDALLE2', { size: 0.85 * Z });
    if (DET && H3 > 0 && xb > xa) d.dim(xb, 0, xb, H3, L('A7.HDALLE3'), -0.2 * Z, 'A7.HDALLE3', { size: 0.85 * Z });
    if (HALF) d.text(xc + 0.6, top + 0.62, sch ? 'cas courant : HDALLE2 = ½ (h1 + h2), HDALLE3 = H − HDALLE2' : '', { size: 0.7, a: 'end', cls: 'ts' });
    if (!sch && Ws > S.W + 0.01) d.text(0, -1.85, 'le profil en travers déborde la largeur de la dalle', { size: 0.8, cls: 'ts' });
    return d.toString();
  }

  /* vue en plan seule (avec portées) */
  function drawPlan(svg, m, sch) {
    const { Lt } = spans(m), W = sectionOf(m).W, s = Lt / 100;
    const b = Math.max(20, Math.min(100, V(m, 'A5.BIAIS') || 100)) * GR, ex = W / 2 * Math.abs(Math.cos(b) / Math.sin(b));
    const r = Math.min(W * 0.4, 4.2 * s);
    const d = svg({ x0: -ex - 1.2 * r - 9 * s, y0: -W / 2 - 11 * s, x1: Lt + ex + 3.5 * s, y1: W / 2 + 3.5 * s }, { pad: 0.035 });
    planInto(d, m, sch, 0, s, { dims: true, nums: true });
    d.text(Lt / 2, -W / 2 - 10 * s, 'appareils d\'appui répartis sous la nervure, espacement EDALLE1 / (NAP − 0,6) mesuré suivant la ligne d\'appui', { size: 0.72, cls: 'ts' });
    return d.toString();
  }

  /* armatures : tranche de dalle */
  function drawArm(svg, m, sch) {
    const H = sectionOf(m).H1;
    const es = Math.max(0.01, V(m, 'A11.ENROBS')), ei = Math.max(0.01, V(m, 'A11.ENROBI'));
    const ph = [1, 2, 3, 4].map(i => Math.max(0.006, V(m, 'A10.PHI' + i) / 1000));
    const N1 = Math.max(1, Math.min(4, Math.round(V(m, 'A11.N1')) || 3));
    let s = V(m, 'A11.ESPAC1'); if (!(s > 0.05)) s = Math.max(0.15, 10 * ph[0]);
    s = Math.max(s, (N1 + 1) * ph[0]);
    const ng = 3, Bw = (ng - 1) * s + 2 * Math.max(0.2, s * 0.55);
    const x0 = Bw / 2 - (ng - 1) * s / 2;
    const xR = Bw + 0.06;
    const d = svg({ x0: -0.36 * H - 0.08, y0: -0.3 * H, x1: xR + 0.62 * H, y1: H * 1.24 }, { pad: 0.03 });
    d.rect(0, 0, Bw, H, 'b', 'A7.HDALLE1');
    const zz = x => { const a = H / 8; const p = [[x, -a * 0.2]]; for (let i = 1; i <= 8; i++) p.push([x + (i % 2 ? a * 0.12 : -a * 0.12), H * i / 8]); p.push([x, H + a * 0.2]); d.path(p, 'l'); };
    zz(0); zz(Bw);
    // nappes transversales
    d.rect(0.02, ei, Bw - 0.04, ph[1], 'road', 'A10.PHI2 A11.ENROBI');
    d.rect(0.02, H - es - ph[2], Bw - 0.04, ph[2], 'road', 'A10.PHI3 A11.ENROBS');
    // groupes longitudinaux
    const yI = ei + ph[1] + ph[0] / 2, yS = H - es - ph[2] - ph[0] / 2;
    const gx = i => x0 + i * s, bx = (i, j) => gx(i) + (j - (N1 - 1) / 2) * ph[0] * 1.05;
    for (let i = 0; i < ng; i++) for (let j = 0; j < N1; j++) {
      d.circle(bx(i, j), yI, ph[0] / 2, 'wheel', 'A10.PHI1 A11.N1 A11.ESPAC1');
      d.circle(bx(i, j), yS, ph[0] / 2, 'wheel', 'A10.PHI1 A11.N1 A11.ESPAC1');
    }
    // étrier autour du groupe central
    const hw = (N1 / 2) * ph[0] * 1.05 + ph[3] * 0.6, xa = gx(1) - hw, xb = gx(1) + hw, t = ph[3];
    for (const r of [[xa - t, yI - ph[0] / 2 - t, t, yS - yI + ph[0] + 2 * t], [xb, yI - ph[0] / 2 - t, t, yS - yI + ph[0] + 2 * t], [xa - t, yI - ph[0] / 2 - t, xb - xa + 2 * t, t], [xa - t, yS + ph[0] / 2, xb - xa + 2 * t, t]]) d.rect(r[0], r[1], r[2], r[3], 'road', 'A10.PHI4');
    // cotes
    const xl = -0.04 * H;
    d.dim(xl, 0, xl, ei, sch ? 'ENROBI' : fmt(ei, 3), 0.02, 'A11.ENROBI', { size: 0.8 });
    d.dim(xl, H - es, xl, H, sch ? 'ENROBS' : fmt(es, 3), 0.02, 'A11.ENROBS', { size: 0.8 });
    d.dim(-0.24 * H, 0, -0.24 * H, H, sch ? 'HDALLE1' : fmt(H, 3), 0.02, 'A7.HDALLE1', { size: 0.95 });
    d.dim(gx(0), H, gx(1), H, sch ? 'ESPAC1' : fmt(V(m, 'A11.ESPAC1'), 3), 0.09 * H, 'A11.ESPAC1', { size: 0.95 });
    // repères avec lignes de rappel, à droite
    const mm = x => Math.round(x * 1000);
    const tag = (px, py, ty, sTxt, vTxt, k) => { d.path([[px, py], [xR, ty], [xR + 0.03, ty]], 'l', k); d.text(xR + 0.05, ty, sch ? sTxt : vTxt, { size: 0.85, a: 'start', cls: sch ? 'tc' : 'dv', k }); };
    tag(Bw - 0.05, H - es - ph[2] / 2, H + 0.12 * H, 'PHI3 transv. sup.', `HA${mm(ph[2])} transv. sup.`, 'A10.PHI3');
    tag(bx(2, N1 - 1) + ph[0] / 2, yS, yS - 0.14 * H, 'N1 × PHI1 (nappe sup.)', `${N1} HA${mm(ph[0])} par groupe`, 'A10.PHI1 A11.N1');
    tag(bx(1, N1 - 1) + ph[0] / 2 + t, (yI + yS) / 2, H * 0.5, 'PHI4 étriers', `étriers HA${mm(ph[3])}`, 'A10.PHI4');
    tag(bx(2, N1 - 1) + ph[0] / 2, yI, yI + 0.14 * H, 'N1 × PHI1 (nappe inf.)', `${N1} HA${mm(ph[0])} par groupe`, 'A10.PHI1 A11.N1');
    tag(Bw - 0.05, ei + ph[1] / 2, -0.12 * H, 'PHI2 transv. inf.', `HA${mm(ph[1])} transv. inf.`, 'A10.PHI2');
    d.text(Bw / 2, -0.22 * H, sch ? 'tranche de dalle en coupe transversale : groupes de N1 barres tous les ESPAC1' : `groupes de ${N1} barres tous les ${fmt(V(m, 'A11.ESPAC1'), 3)} m — fe ${fmt(V(m, 'A10.FE1') / 100, 0)} MPa`, { size: 0.85, cls: 'ts', k: 'A11.ESPAC1 A11.N1' });
    return d.toString();
  }

  /* ───── contrôles de cohérence ───── */
  function checks(m) {
    const out = [], E_ = (step, k, msg) => out.push({ level: 'e', step, k, msg }), W_ = (step, k, msg) => out.push({ level: 'w', step, k, msg });
    const L = m.lignes || {};
    const nt = Math.round(V(m, 'A5.NT'));
    // profil en long
    if (!(nt >= 1 && nt <= 6)) E_('long', 'A5.NT', 'le nombre de travées NT doit être compris entre 1 et 6');
    const n = Math.max(1, Math.min(6, nt || 1));
    const D = []; for (let i = 1; i <= 6; i++) D.push(V(m, 'A5.D' + i));
    for (let i = 1; i <= n; i++) if (!(D[i - 1] > 0)) E_('long', 'A5.D' + i, `la portée D${i} de la travée ${i} doit être positive (NT = ${n})`);
    for (let i = n + 1; i <= 6; i++) if (D[i - 1] !== 0) W_('long', 'A5.D' + i, `portée D${i} non nulle au-delà de NT = ${n} : elle est ignorée`);
    const bi = V(m, 'A5.BIAIS');
    if (!(bi > 0 && bi <= 100)) E_('long', 'A5.BIAIS', 'le biais est compris entre 0 et 100 grades');
    else if (bi < 50) W_('long', 'A5.BIAIS', `biais très prononcé (${fmt(bi, 1)} gr) : la modélisation en poutre continue d'un PSI-DA devient discutable`);
    const ab = V(m, 'A5.ABOUT');
    if (ab < 0) E_('long', 'A5.ABOUT', 'la longueur d\'about ne peut pas être négative');
    else if (D[0] > 0 && ab > 0.25 * Math.min(D[0], D[n - 1] || D[0])) W_('long', 'A5.ABOUT', `about important (${fmt(ab, 2)} m) vis-à-vis des travées de rive`);
    if (n >= 3) { const r1 = D[0] / D[1], r2 = D[n - 1] / D[n - 2]; if (D[1] > 0 && (r1 < 0.5 || r1 > 1.1)) W_('long', 'A5.D1', `rapport travée de rive / travée voisine = ${fmt(r1, 2)} (usuel 0,6 à 0,85)`); else if (D[n - 2] > 0 && (r2 < 0.5 || r2 > 1.1)) W_('long', 'A5.D' + n, `rapport travée de rive / travée voisine = ${fmt(r2, 2)} (usuel 0,6 à 0,85)`); }
    // section et élancement
    const H1 = V(m, 'A7.HDALLE1'), H2 = V(m, 'A7.HDALLE2'), H3 = V(m, 'A7.HDALLE3');
    const E1 = V(m, 'A7.EDALLE1'), E2 = V(m, 'A7.EDALLE2'), E3 = V(m, 'A7.EDALLE3');
    if (!(H1 > 0)) E_('sect', 'A7.HDALLE1', 'l\'épaisseur de la nervure HDALLE1 doit être positive');
    if (!(E1 > 0)) E_('sect', 'A7.EDALLE1', 'la largeur d\'intrados EDALLE1 doit être positive');
    if (E2 < 0 || E3 < 0) E_('sect', E2 < 0 ? 'A7.EDALLE2' : 'A7.EDALLE3', 'les largeurs cumulées EDALLE2 et EDALLE3 ne peuvent pas être négatives');
    if (E2 > 0 && !(H2 > 0)) E_('sect', 'A7.HDALLE2', 'encorbellements déclarés (EDALLE2 > 0) sans épaisseur HDALLE2');
    if (H1 > 0 && H2 + H3 > H1 + 0.002) E_('sect', 'A7.HDALLE3', `HDALLE2 + HDALLE3 (${fmt(H2 + H3, 3)}) dépasse HDALLE1 (${fmt(H1, 3)}) : section impossible`);
    else if (H1 > 0 && E2 > 0 && E3 > 0 && Math.abs(H1 - H2 - H3) > 0.002) W_('sect', 'A7.HDALLE3', `cas courant : HDALLE3 = HDALLE1 − HDALLE2 = ${fmt(H1 - H2, 3)} m`);
    if (E3 > 0 && !(H3 > 0)) W_('sect', 'A7.HDALLE3', 'flancs obliques déclarés (EDALLE3 > 0) de hauteur nulle');
    if (E2 > 0 && E2 / 2 > 2.5) W_('sect', 'A7.EDALLE2', `encorbellements de ${fmt(E2 / 2, 2)} m : au-delà de 2,5 m environ, vérifier la flexion transversale`);
    const Lmax = Math.max(...D.slice(0, n));
    if (H1 > 0 && Lmax > 0) {
      const e = Lmax / H1, ref = n === 1 ? 20 : n === 2 ? 26 : 28;
      if (e > 33) W_('sect', 'A7.HDALLE1', `dalle très élancée : HDALLE1 / Dmax = 1/${Math.round(e)} (usuel 1/20 à 1/28 ; ≈ 1/${ref} pour ${n} travée${n > 1 ? 's' : ''})`);
      else if (e < 16) W_('sect', 'A7.HDALLE1', `dalle épaisse : HDALLE1 / Dmax = 1/${Math.round(e)} (usuel 1/20 à 1/28)`);
    }
    if (Lmax > 25) W_('long', 'A5.D' + (D.indexOf(Lmax) + 1), `portée de ${fmt(Lmax, 2)} m : au-delà de 20 à 25 m le pont-dalle en béton armé devient peu économique (PSI-DP)`);
    // profil en travers
    const ws = ['A6.ETROTG', 'A6.EGAU', 'A6.ESURCH', 'A6.EDROI', 'A6.ETROTD'].map(k => V(m, k));
    const Ws = ws.reduce((a, b) => a + b, 0), Wd = E1 + E2 + E3;
    ws.forEach((w, i) => { if (w < 0) E_('trav', ['A6.ETROTG', 'A6.EGAU', 'A6.ESURCH', 'A6.EDROI', 'A6.ETROTD'][i], 'les largeurs du profil en travers ne peuvent pas être négatives'); });
    const es = ws[2];
    if (!(es > 0)) E_('trav', 'A6.ESURCH', 'la largeur chargeable ESURCH doit être positive');
    if (Wd > 0 && Ws > Wd + 0.01) W_('trav', 'A6.ESURCH', `profil en travers (${fmt(Ws, 2)} m) plus large que la dalle EDALLE1 + EDALLE2 + EDALLE3 (${fmt(Wd, 2)} m)`);
    else if (Wd > 0 && Wd - Ws > 1.5) W_('trav', 'A6.ESURCH', `la dalle (${fmt(Wd, 2)} m) dépasse le profil en travers (${fmt(Ws, 2)} m) de plus de 1,5 m`);
    const nv = Math.round(V(m, 'A6.NVOIE'));
    if (nv < 0) E_('trav', 'A6.NVOIE', 'nombre de voies négatif');
    else if (nv > 0 && es > 0 && nv !== nvF61(es)) W_('trav', 'A6.NVOIE', `NVOIE = ${nv} imposé ; le fascicule 61 donne ${nvF61(es)} voie${nvF61(es) > 1 ? 's' : ''} pour ESURCH = ${fmt(es, 2)} m (laisser 0 sauf cas particulier)`);
    const sym = Math.abs(ws[0] - ws[4]) < 1e-6 && Math.abs(ws[1] - ws[3]) < 1e-6;
    if (V(m, 'A6.SYMTAB') === 1 && !sym) W_('trav', 'A6.SYMTAB', 'SYMTAB = 1 alors que le profil n\'est pas symétrique (ETROTG ≠ ETROTD ou EGAU ≠ EDROI)');
    const hc = V(m, 'A6.HCHAU'); if (hc < 0 || hc > 0.4) W_('trav', 'A6.HCHAU', `épaisseur de chaussée HCHAU inhabituelle (${fmt(hc, 3)} m)`);
    if ([2, 3, 4, 5].some(i => V(m, 'A6.YY' + i) !== 0)) W_('trav', 'A6.YY2', 'fibres YY non nulles : réservé aux ouvrages de largeur exceptionnelle');
    // charges
    const st = String(get(m, 'A8.STATUT') || '');
    if (!['000', '100', '200', '300'].includes(st.slice(0, 1) + '00') || !/^\d{3}$/.test(st)) E_('charg', 'A8.STATUT', 'STATUT : 100, 200, 300 (classe du pont) ou 000 (F61 de 1960)');
    const lr = ws[1] + ws[2] + ws[3];
    if (/^[23]/.test(st) && lr >= 7 - 1e-9) W_('charg', 'A8.STATUT', `largeur roulable ${fmt(lr, 2)} m ≥ 7 m : pont de 1re classe au sens du fascicule 61 (STATUT = ${st})`);
    if (st[0] === '1' && lr < 5.5) W_('charg', 'A8.STATUT', `largeur roulable ${fmt(lr, 2)} m < 5,50 m : vérifier la classe du pont (1re classe déclarée)`);
    if (V(m, 'A8.QSUPMIN') > V(m, 'A8.QSUPMAX') + 1e-9) E_('charg', 'A8.QSUPMIN', 'superstructures : la valeur minimale dépasse la maximale');
    if (V(m, 'A8.OSMIN') > V(m, 'A8.OSMAX') + 1e-9) E_('charg', 'A8.OSMIN', 'ossature : le coefficient minimal dépasse le maximal');
    for (const k of ['A8.OSMAX', 'A8.OSMIN']) { const x = V(m, k); if (x !== 0 && (x < 0.8 || x > 1.2)) W_('charg', k, `coefficient d'ossature ${fmt(x, 3)} inhabituel (normalement 1)`); }
    const mv = V(m, 'A8.MASVOL'); if (mv !== 0 && (mv < 2.2 || mv > 2.7)) W_('charg', 'A8.MASVOL', `masse volumique ${fmt(mv, 3)} t/m³ inhabituelle (2,5 pour le béton armé)`);
    if (!(V(m, 'A8.QSUPMAX') > 0)) W_('charg', 'A8.QSUPMAX', 'aucun poids de superstructures (chaussée, trottoirs, corniches…)');
    const ce = String(get(m, 'A8.CE') || '000');
    if (!/^\d{3}$/.test(ce) || !['0', '3', '4'].includes(ce[2]) || !['0', '1', '2'].includes(ce[1])) E_('charg', 'A8.CE', 'CE = i m j : m ∈ {0, 1, 2} (convois D, E), j ∈ {0, 3, 4} (Mc80, Mc120)');
    else if (ce[0] !== '0' && !L.B4_raw) W_('charg', 'A8.CE', `CE = ${ce} : ${ce[0]} charge(s) généralisée(s) à décrire en lignes B4 (non saisies ici)`);
    const ca = String(get(m, 'A8.A')), cb = String(get(m, 'A8.B'));
    if (ca === '100' && !L.B3_raw) W_('charg', 'A8.A', 'A = 100 : charge A généralisée à décrire en ligne B3 (non saisie ici)');
    if ((cb === '100' || cb === '101') && !L.B1_raw) W_('charg', 'A8.B', `B = ${cb} : camions généralisés à décrire en lignes B1 et B2 (non saisies ici)`);
    if (V(m, 'A3.EXCENTR') === 0 && !['A8.XKA', 'A8.XKBC', 'A8.XKBT', 'A8.XKCM', 'A8.XKTR'].some(k => V(m, k) > 0)) E_('charg', 'A8.XKA', 'EXCENTR = 0 : les coefficients KA, KBC, KBT, KCM, KTR doivent être donnés');
    if (V(m, 'A3.EXCENTR') === 1 && ['A8.XKA', 'A8.XKBC', 'A8.XKBT', 'A8.XKCM', 'A8.XKTR'].some(k => V(m, k) > 0)) W_('charg', 'A8.XKA', 'coefficients K saisis alors que EXCENTR = 1 (Guyon-Massonnet) : ils sont ignorés');
    const pt = V(m, 'A8.PSTROT'); if (pt > 0.5) W_('charg', 'A8.PSTROT', `charge de trottoir ${fmt(pt, 3)} t/m² élevée (0,150 en voirie ordinaire)`);
    if ((ws[0] > 0 || ws[4] > 0) && pt === 0) W_('charg', 'A8.PSTROT', 'trottoirs déclarés sans charge de trottoir (normal pour une plateforme autoroutière)');
    // béton
    const ge = String(get(m, 'A9.GENRE') || '');
    if (!/^[123]0[01]$/.test(ge)) E_('mat', 'A9.GENRE', 'GENRE : 100, 200, 300 (ou 101, 201, 301 avec la ligne C1)');
    else if (ge[2] === '1' && !(L.C1 && [1, 2, 3, 4].every(i => L.C1['SS' + i] > 0))) E_('mat', 'C1.SS1', `GENRE = ${ge} : contraintes limites ss1 à ss4 de la ligne C1 à renseigner`);
    const fc = V(m, 'A9.FCJ'), ft = V(m, 'A9.FTJ');
    if (!(fc > 0)) E_('mat', 'A9.FCJ', 'la résistance du béton FCJ doit être positive (t/m²)');
    else if (fc < 1000) E_('mat', 'A9.FCJ', `FCJ = ${fmt(fc, 0)} : la donnée est en t/m² (ex. 3000 pour 30 MPa)`);
    else if (fc < 2000 || fc > 6000) W_('mat', 'A9.FCJ', `résistance ${fmt(fc / 100, 0)} MPa inhabituelle (25 à 40 MPa)`);
    if (fc >= 1000) { const ftr = 60 + 0.06 * fc; if (!(ft > 0)) E_('mat', 'A9.FTJ', 'la résistance à la traction FTJ doit être positive'); else if (Math.abs(ft - ftr) > 0.06 * ftr) W_('mat', 'A9.FTJ', `BAEL : ftj = 0,6 + 0,06 fcj = ${fmt(ftr, 0)} t/m² (saisi ${fmt(ft, 0)})`); }
    const nu = V(m, 'A9.POISSON'); if (nu < 0 || nu > 0.3) E_('mat', 'A9.POISSON', 'coefficient de Poisson compris entre 0 et 0,3');
    const re = V(m, 'A9.RETRAI'); if (re < 0 || re > 0.001) W_('mat', 'A9.RETRAI', `retrait ${fmt(re, 5)} inhabituel (≈ 0,0003 à 0,0005)`);
    const xk = V(m, 'A9.XKI'); if (xk < 0 || xk > 1) E_('mat', 'A9.XKI', 'ψ1 compris entre 0 et 1');
    // armatures
    const NORM = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40];
    const ph = [1, 2, 3, 4].map(i => V(m, 'A10.PHI' + i));
    ph.forEach((p, i) => { if (!(p > 0)) E_('acier', 'A10.PHI' + (i + 1), `le diamètre PHI${i + 1} doit être positif`); else if (!NORM.includes(Math.round(p))) W_('acier', 'A10.PHI' + (i + 1), `diamètre ${fmt(p, 1)} mm non normalisé`); });
    if (ph[3] > ph[0]) W_('acier', 'A10.PHI4', 'étriers PHI4 plus gros que les aciers principaux PHI1');
    for (let i = 1; i <= 4; i++) { const fe = V(m, 'A10.FE' + i); if (!(fe > 0)) E_('acier', 'A10.FE' + i, `limite d'élasticité FE${i} à renseigner (t/m²)`); else if (fe < 20000 || fe > 60000) W_('acier', 'A10.FE' + i, `FE${i} = ${fmt(fe, 0)} t/m² : la donnée est en t/m² (50 000 pour FeE500)`); }
    for (let i = 1; i <= 4; i++) { const e = V(m, 'A10.ETA' + i); if (!(e >= 1 && e <= 1.6)) W_('acier', 'A10.ETA' + i, `η${i} = ${fmt(e, 2)} (1,0 ronds lisses, 1,6 HA)`); }
    const n1 = V(m, 'A11.N1'), sp1 = V(m, 'A11.ESPAC1');
    if (!(n1 >= 1 && n1 <= 3)) W_('acier', 'A11.N1', 'nombre de barres par groupe N1 : conseillé 3 (1 à 3)');
    if (!(V(m, 'A11.N2') >= 1)) W_('acier', 'A11.N2', 'nombre de groupes par épure N2 : conseillé 3');
    if (!(sp1 > 0)) E_('acier', 'A11.ESPAC1', 'l\'espacement des groupes ESPAC1 doit être positif');
    else if (ph[0] > 0 && (sp1 < 5 * ph[0] / 1000 || sp1 > 15 * ph[0] / 1000)) W_('acier', 'A11.ESPAC1', `ESPAC1 = ${fmt(sp1, 3)} m ; conseillé 10 PHI1 = ${fmt(ph[0] / 100, 3)} m`);
    for (const k of ['A11.ENROBS', 'A11.ENROBI']) { const c = V(m, k); if (!(c > 0)) E_('acier', k, 'enrobage nul'); else if (c < 0.025 || c > 0.08) W_('acier', k, `enrobage ${fmt(c, 3)} m inhabituel (3 à 5 cm)`); }
    // appuis
    const yg = V(m, 'A12.YOUNG'); if (yg < 3 || yg > 5) W_('app', 'A12.YOUNG', 'YOUNG compris entre 3 et 5 (3 sauf précision contraire)');
    const ktp = V(m, 'A12.KTP'); if (ktp < 0 || ktp > 1) E_('app', 'A12.KTP', 'KTP : fraction comprise entre 0 et 1');
    for (let i = n + 2; i <= 7; i++) if (V(m, 'A12.TP' + i) || V(m, 'A12.DTP' + i)) W_('app', 'A12.TP' + i, `tassement saisi sur l'appui ${i} alors que l'ouvrage n'en compte que ${n + 1}`);
    const tas = V(m, 'A3.TASMENT');
    let anyT = false; for (let i = 1; i <= n + 1; i++) { if (V(m, 'A12.TP' + i) < 0 || V(m, 'A12.DTP' + i) < 0) E_('app', 'A12.TP' + i, `tassements de l'appui ${i} négatifs`); if (V(m, 'A12.TP' + i) || V(m, 'A12.DTP' + i)) anyT = true; }
    if (tas === 2 && !anyT) W_('app', 'A12.DTP1', 'TASMENT = 2 mais aucun tassement n\'est donné en ligne A12');
    if (tas !== 2 && anyT) W_('id', 'A3.TASMENT', 'tassements saisis en ligne A12 mais TASMENT ≠ 2 : ils ne sont pas étudiés');
    for (let i = 1; i <= n + 1; i++) {
      const a = V(m, 'A13.NAP' + i);
      if (!(a >= 1)) (V(m, 'A3.DIMAP') ? E_ : W_)('app', 'A13.NAP' + i, `ligne d'appui ${i} : nombre d'appareils NAP${i} nul`);
      else if (a === 1 && E1 > 3) W_('app', 'A13.NAP' + i, `un seul appareil sur la ligne d'appui ${i} pour une nervure de ${fmt(E1, 2)} m`);
      if (![0, 1, 2].includes(V(m, 'A13.TYPAP' + i))) E_('app', 'A13.TYPAP' + i, 'TYPAP : 0, 1 ou 2');
    }
    for (let i = n + 2; i <= 7; i++) if (V(m, 'A13.NAP' + i)) W_('app', 'A13.NAP' + i, `appareils déclarés sur l'appui ${i} alors que l'ouvrage n'en compte que ${n + 1}`);
    if (V(m, 'A13.COMPRENV') >= V(m, 'A13.COMPRENS')) E_('app', 'A13.COMPRENV', 'élastomère : la compression minimale admissible doit être inférieure à la maximale');
    if (V(m, 'A13.COMPREBV') >= V(m, 'A13.COMPREBS')) E_('app', 'A13.COMPREBV', 'béton : la compression minimale admissible doit être inférieure à la maximale');
    // options
    if (V(m, 'A3.LIGNINF') === 1) W_('id', 'A3.LIGNINF', 'LIGNINF = 1 (épaisseur optimisée) : règle d\'optimisation non reconstituée, l\'épaisseur HDALLE1 saisie est conservée');
    if (!V(m, 'A3.MOMENT')) W_('id', 'A3.MOMENT', 'MOMENT = 0 : les enveloppes des moments sont néanmoins nécessaires au ferraillage');
    return out;
  }

  /* ───── résultats ───── */
  function summary(m, r) {
    const kv = (a, b) => `<div class="ot-kv"><span>${esc(a)}</span><b>${b}</b></div>`;
    const card = (t, body, wide) => body ? `<div class="ot-card"${wide ? ' style="grid-column:span 2"' : ''}><h4>${esc(t)}</h4>${body}</div>` : '';
    const n = r.n, sec = r.section || {}, A7 = m.lignes.A7;
    const Lmax = Math.max(...r.L);
    let h = card('Géométrie de calcul',
      kv('Travées', r.L.map(x => fmt(x, 2)).join(' + ') + ' m')
      + kv('Longueur totale (abouts compris)', fmt(r.longueurTotale, 2) + ' m')
      + kv('Largeur droite de la dalle', fmt(A7.EDALLE1 + A7.EDALLE2 + A7.EDALLE3, 2) + ' m')
      + kv('Biais', fmt(r.biais, 1) + ' gr')
      + kv('Aire de la section', fmt(sec.A, 3) + ' m²') + kv('Inertie', fmt(sec.I, 4) + ' m⁴')
      + kv('Élancement HDALLE1 / Dmax', '1/' + Math.round(Lmax / sec.H))
      + kv('Voies · classe', `${r.nvoies} voie${r.nvoies > 1 ? 's' : ''} · ${r.f61_1960 ? 'F61 1960' : r.classe + (r.classe === 1 ? 're' : 'e') + ' classe'}`));
    const cp = r.cp || {};
    h += card('Charges permanentes',
      kv('Ossature', fmt(cp.oss, 2) + ' t/m') + kv('Superstructures min / max', fmt(cp.qsupMin, 2) + ' / ' + fmt(cp.qsupMax, 2) + ' t/m')
      + kv('g min / max', fmt(cp.gMin, 2) + ' / ' + fmt(cp.gMax, 2) + ' t/m')
      + kv('Charges particulières', (r.chargesC || []).join(' · ') || '—'));
    if (r.moments) {
      let b = '';
      r.moments.forEach((secs, i) => { const mx = Math.max(...secs.map(s => s.elu.max)); b += kv(`Travée ${i + 1} — M max ELU`, fmt(mx, 1) + ' t·m'); });
      for (let k = 1; k < n; k++) { const a = r.moments[k - 1], c = r.moments[k]; const mn = Math.min(a[a.length - 1].elu.min, c[0].elu.min); b += kv(`Appui ${k + 1} — M min ELU`, fmt(mn, 1) + ' t·m'); }
      h += card('Moments longitudinaux (ELU)', b);
    }
    if (r.reactions) h += card('Réactions d\'appui (ELS)', r.reactions.map(x => kv(`Appui ${x.k + 1} — min / max`, fmt(x.els.min, 1) + ' / ' + fmt(x.els.max, 1) + ' t')).join(''));
    const F = r.fer || {};
    if (F.long) {
      const ph = r.mat.phi.map(x => Math.round(x * 1000));
      h += card('Ferraillage longitudinal',
        kv('Espacement des groupes', fmt(F.long.s, 3) + ' m')
        + kv('Groupes sup. / inf.', `${F.long.sup.n} / ${F.long.inf.n}`) + kv('Composition d\'un groupe', `${F.long.N1} HA${ph[0]}`)
        + kv('Hauteurs utiles sup. / inf.', fmt(F.long.sup.d, 3) + ' / ' + fmt(F.long.inf.d, 3) + ' m')
        + kv('Longueur de recouvrement', fmt(F.long.ls, 2) + ' m'));
    }
    if (F.appareils) h += card('Appareils d\'appui', F.appareils.map((a, k) => kv(`Appui ${k + 1} : ${a.nap} × ${fmt(a.larg, 2)}×${fmt(a.long, 2)}`, `${fmt(a.chMax, 1)} t · ${fmt(a.cMax, 0)} t/m²`)).join(''));
    if (r.deformations) h += card('Flèches (charges permanentes)', r.deformations.map((dd, i) => { const f0 = Math.min(...dd.fl.map(x => x[1])), f1 = Math.min(...dd.fl.map(x => x[2])); return kv(`Travée ${i + 1} (inst. / finale)`, fmt(-f0, 1) + ' / ' + fmt(-f1, 1) + ' mm'); }).join(''));
    const mt = F.metre;
    if (mt) h += card('Avant-métré',
      kv('Béton', fmt(mt.beton, 1) + ' m³') + kv('Coffrages', fmt(mt.sousDalle + mt.autres, 1) + ' m²')
      + kv('Aciers (estimation)', fmt(mt.ptot, 2) + ' t') + kv('Ratio', fmt(mt.ratio * 1000, 0) + ' kg/m³'));
    if (r.warnings && r.warnings.length) h += card('Avertissements du calcul', r.warnings.map(w => `<div class="ot-kv"><span>${esc(w)}</span></div>`).join(''));
    return h;
  }

  /* ───── exemples (bordereaux du corpus, titres génériques) et nouveau ───── */
  const HEAD = (t1, t2) => ['PSIDAEL 0001                                        *************************** ',
    '04  11  26                                          *  BORDEREAU DES DONNEES  * ',
    'PAGE   0                                            *************************** ', ' ', ' ', ' ',
    '    ' + t1 + ' ', '   ' + t2 + ' ', ' ',
    '      L      E      M      E      R      M      T      D      F      F      E      P      D      A      P      D ',
    '      I      X      O      F      E      O      A      I      E      E      T      O      E      V      P      E ',
    '      G      C      M      T      A      T      S      M      R      R      R      I      F      A             S ',
    '      N      E      E      R      P      R      M      A      L      T      I      N      O      N             S ',
    '      I      N      N      A      P      A      E      P      O      R      E      C      R      T             I ',
    '      N      T      T      N      U      N      N             N      A      R      O      M                    N '];
  const LBL5 = '    NT   BIAIS      ABOUT    D1       D2       D3       D4       D5       D6 ';
  const LBL6 = '    NVOIE   ETROTG   EGAU   ESURCH  EDROI  ETROTD  HCHAU   SYMTAB   DISEXT   DISINT   NF   YY(2)   YY(3)   YY(4)   YY(5) ';
  const LBL7 = '      HDALLE1  HDALLE2  HDALLE3  EDALLE1  EDALLE2  EDALLE3 ';
  const LBL8 = '      STATUT MASVOL  OSMAX  OSMIN  QSUPMAX QSUPMIN  A   B  CE    PSTROT DGRADI XGRADI XKA    XKBC  XKBT  XKCM  XKTR ';
  const LBL9 = '    GENRE  BA  XKI  POISSON  FCJ  FTJ  RETRAI ';
  const LBL10 = '       PHI1   PHI2   PHI3   PHI4    FE1      FE2      FE3      FE4      NA1  NA2  NA3  NA4   ETA1  ETA2  ETA3  ETA4  PSID ';
  const LBL11 = '       N1   N2  ESPAC1  ESPAC2  ENROBS  ENROBI ';
  const LBL12 = '      YOUNG   KTP    TP1    DTP1   TP2    DTP2   TP3    DTP3   TP4    DTP4   TP5    DTP5   TP6    DTP6   TP7    DTP7 ';
  const LBL13 = '      COMPRENV  COMPREBV  COMPRENS  COMPREBS  SYMAP  APPUI1  APPUI2  APPUI3  APPUI4  APPUI5  APPUI6  APPUI7 ';
  const A34 = ['A3    2      1      1      1      1      1      2      1      1      1      1      1      1      1      1      1 ',
    'A4    1      1      1      0      0      1      0      1      1      0      0      0      0      0      0      0 ', ' '];
  const A10 = 'A10    0.032  0.016  0.012  0.010   50000.   50000.   50000.   50000.    0    0    0    0     1.60  1.60  1.60  1.60  1.50 ';
  const EX1 = [...HEAD('EXEMPLE DE PONT-DALLE EN BETON ARME', '3 TRAVEES 12,50 - 16,00 - 12,50 M'), ...A34,
    LBL5, 'A5  3    100.000    0.500   12.500   16.000   12.500    0.000    0.000    0.000 ', ' ',
    LBL6, 'A6    0     1.000   0.000     8.000  0.000   1.000  0.080    1       0.000     0.000  3    0.000   0.000   0.000   0.000 ', ' ',
    LBL7, 'A7     0.723    0.338    0.385     6.400   3.600    0.600 ', ' ',
    LBL8, 'A8      100  2.500   1.000  1.000  4.243  2.892    001 001 024    0.150   0.0   0.0    0.000 0.000 0.000 0.000 0.000 ', ' ',
    LBL9, 'A9    200  000 .000  .000  3000.  240. .00040 ', ' ',
    LBL10, A10, ' ',
    LBL11, 'A11     3    3   0.320   0.000   0.030   0.030 ', ' ',
    LBL12, 'A12    3.000  1.000  0.000  0.010  0.000  0.010  0.000  0.010  0.000  0.010  0.000  0.000  0.000  0.000  0.000  0.000 ', ' ',
    LBL13, 'A13      250.     2000.     1500.     3500.     1    1  4    1  4    1  4    1  4    0  0    0  0    0  0 ', ''].join('\n');
  const EX2 = [...HEAD('EXEMPLE DE PONT-DALLE EN BETON ARME', '2 TRAVEES 15,00 - 15,00 M'), ...A34,
    LBL5, 'A5  2    100.000    0.500   15.000   15.000    0.000    0.000    0.000    0.000 ', ' ',
    LBL6, 'A6    0     1.000   0.000     8.000  0.000   1.000  0.080    1       0.000     0.000  3    0.000   0.000   0.000   0.000 ', ' ',
    LBL7, 'A7     0.738    0.313    0.425     6.400   3.600    0.600 ', ' ',
    LBL8, 'A8      100  0.000   1.000  1.000  4.320  3.050    001 001 004    0.150   0.0   0.0    0.000 0.000 0.000 0.000 0.000 ', ' ',
    LBL9, 'A9    200  000 .000  .000  3000.  240. .00040 ', ' ',
    LBL10, A10, ' ',
    LBL11, 'A11     3    3   0.320   0.000   0.030   0.030 ', ' ',
    LBL12, 'A12    3.000  1.000  0.000  0.010  0.000  0.010  0.000  0.010  0.000  0.000  0.000  0.000  0.000  0.000  0.000  0.000 ', ' ',
    LBL13, 'A13      250.     2000.     1500.     3500.     1    1  4    1  4    1  4    0  0    0  0    0  0    0  0 ', ''].join('\n');

  function blank() {
    const m = E.parseBordereau(EX1);
    m.titre = ['', '']; m.numero = '0001'; m.date = null;
    delete m.source; delete m.version;
    return m;
  }

  /* moteur : la note attend une date {j, m, a} */
  const engine = {
    parseBordereau: t => E.parseBordereau(t),
    formatBordereau: m => E.formatBordereau(m),
    compute: m => E.compute(m),
    renderNote: (m, r, o) => {
      o = Object.assign({}, o);
      if (typeof o.date === 'string') { const p = o.date.split(/[-/.]/); o.date = { j: p[0], m: p[1], a: p[2] }; }
      return E.renderNote(m, r, o);
    },
  };

  G.PSIDA_UI = {
    prog: 'PSIDA-EL', engine, steps, get, set, checks, summary, blank,
    numero: m => m.numero || '0001',
    examples: [{ label: '3 travées 12,5 + 16 + 12,5 m, pont droit', text: EX1 }, { label: '2 travées 15 + 15 m, pont droit', text: EX2 }],
    views: [
      { id: 'elev', label: 'Élévation', draw: (svg, m) => drawElev(svg, m, false, 'app') },
      { id: 'coupe', label: 'Coupe transversale', draw: (svg, m) => drawCoupe(svg, m, false) },
      { id: 'plan', label: 'Vue en plan', draw: (svg, m) => drawPlan(svg, m, false) },
      { id: 'arm', label: 'Armatures', draw: (svg, m) => drawArm(svg, m, false) },
    ],
    _draw: { drawElev, drawCoupe, drawPlan, drawArm },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
