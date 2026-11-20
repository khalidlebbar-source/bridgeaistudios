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
    if (k === 'FC28') return num(((m.lignes || {}).A9 || {}).FCJ) / 100;   // t/m² → MPa
    if (k.startsWith('FIX.')) {                                           // charges A(l), Bc, Bt (codes A et B, extension 000 / 002 / 003)
      const A8 = (m.lignes || {}).A8 || {}, a = String(A8.A || '001').padStart(3, '0'), b = String(A8.B || '001').padStart(3, '0');
      return k === 'FIX.A' ? +(a !== '000') : k === 'FIX.BC' ? +(b !== '000' && b !== '003') : +(b !== '000' && b !== '002');
    }
    if (k.startsWith('MIL.')) return milGet(m)[k.slice(4)];
    if (k === 'TRT.G' || k === 'TRT.D') { const t = milGet(m).TROTX; return k === 'TRT.G' ? +(t === 0 || t === 1) : +(t === 0 || t === 2); }   // trottoirs chargés                // militaires cochés un à un (ligne d'extension C9)
    if (k.startsWith('CE.')) {                                            // cases à cocher du code CE = i m j
      const ce = String(((m.lignes || {}).A8 || {}).CE || '000').padStart(3, '0'), w = k.slice(3);
      return w === 'D' ? +(+ce[1] >= 1) : w === 'E' ? +(+ce[1] === 2) : w === 'MC80' ? +(ce[2] === '3') : +(ce[2] === '4');
    }
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
    if (k === 'FC28') {                                                   // fc28 (MPa) → FCJ, et FTJ = 60 + 0,06 FCJ (t/m²)
      m.lignes = m.lignes || {}; if (!m.lignes.A9) m.lignes.A9 = emptyLine('A9');
      const fc = num(v) * 100; m.lignes.A9.FCJ = fc; m.lignes.A9.FTJ = Math.round((60 + 0.06 * fc) * 10) / 10; return;
    }
    if (k.startsWith('FIX.')) {
      m.lignes = m.lignes || {}; if (!m.lignes.A8) m.lignes.A8 = emptyLine('A8');
      const A8 = m.lignes.A8, on = num(v) === 1;
      if (k === 'FIX.A') { A8.A = on ? '001' : '000'; return; }
      const b = String(A8.B || '001').padStart(3, '0');
      let bc = b !== '000' && b !== '003', bt = b !== '000' && b !== '002';
      if (k === 'FIX.BC') bc = on; else bt = on;
      A8.B = bc && bt ? '001' : bc ? '002' : bt ? '003' : '000'; return;
    }
    if (k === 'TRT.G' || k === 'TRT.D') {
      m.lignes = m.lignes || {}; const o = milGet(m), t = o.TROTX;
      let g = t === 0 || t === 1, d = t === 0 || t === 2; if (k === 'TRT.G') g = num(v) === 1; else d = num(v) === 1;
      o.TROTX = g && d ? 0 : g ? 1 : d ? 2 : 3; m.lignes.C9 = o; return;
    }
    if (k.startsWith('MIL.')) {
      m.lignes = m.lignes || {}; if (!m.lignes.A8) m.lignes.A8 = emptyLine('A8');
      const o = milGet(m); o[k.slice(4)] = num(v) === 1 ? 1 : 0; m.lignes.C9 = o;
      const c = String(m.lignes.A8.CE || '000').padStart(3, '0').split(''); c[2] = o.MC120 ? '4' : o.MC80 ? '3' : '0'; m.lignes.A8.CE = c.join('');   // code SETRA le plus proche
      return;
    }
    if (k.startsWith('CE.')) {
      m.lignes = m.lignes || {}; if (!m.lignes.A8) m.lignes.A8 = emptyLine('A8');
      const c = String(m.lignes.A8.CE || '000').padStart(3, '0').split(''), w = k.slice(3), on = num(v) === 1;
      if (w === 'D') c[1] = on ? (c[1] === '2' ? '2' : '1') : '0';
      if (w === 'E') c[1] = on ? '2' : (c[1] === '2' ? '1' : c[1]);      // E entraîne D
      if (w === 'MC80') c[2] = on ? '3' : (c[2] === '3' ? '0' : c[2]);    // un seul char militaire
      if (w === 'MC120') c[2] = on ? '4' : (c[2] === '4' ? '0' : c[2]);
      m.lignes.A8.CE = c.join(''); return;
    }
    const [l, n] = k.split('.');
    m.lignes = m.lignes || {};
    if (!m.lignes[l]) m.lignes[l] = emptyLine(l);
    if (isS(l, n)) { const x = num(v); m.lignes[l][n] = isFinite(x) ? String(Math.round(x)).padStart(3, '0') : String(v); return; }
    if (l === 'A10' && /^PHI/.test(n)) { m.lignes[l][n] = num(v) / 1000; return; }
    m.lignes[l][n] = v;
  };
  function milGet(m) {
    const L = m.lignes || {};
    if (L.C9) return { MC80: +!!L.C9.MC80, MC120: +!!L.C9.MC120, ME80: +!!L.C9.ME80, ME120: +!!L.C9.ME120, TROTX: +L.C9.TROTX || 0 };
    const j = String((L.A8 || {}).CE || '000').padStart(3, '0')[2];
    return { MC80: +(j === '3'), MC120: +(j === '4'), ME80: 0, ME120: 0, TROTX: 0 };
  }
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
  const sp = i => ({ show: m => i <= (Math.round(V(m, 'A5.NT')) || 1), k: 'A5.D' + i, code: 'D' + i, label: 'travée ' + i, unit: 'm', dec: 3, help: `Portée biaise de la travée ${i}, mesurée suivant l'axe de l'ouvrage entre lignes d'appui. Les remplir toutes, même si l'ouvrage est symétrique ; 0 au-delà de NT.` });
  const tp = i => ({ rowLabel: 'TP', k: 'A12.TP' + i, code: 'TP' + i, label: '', unit: 'm', dec: 3, help: `Tassement probable de l'appui ${i} (m). Pris en compte si TASMENT = 2 (ligne A3).` });
  const dtp = i => ({ rowLabel: 'DTP', k: 'A12.DTP' + i, code: 'DTP' + i, label: '', unit: 'm', dec: 3, help: `Tassement supplémentaire aléatoire de l'appui ${i} (m).` });
  const typ = i => ({ rowLabel: 'TYPAP', k: 'A13.TYPAP' + i, code: 'TYPAP' + i, label: '', type: 'sel', opts: [[1, 'élast.'], [0, 'Freys.'], [2, 'autre']], help: `Type d'appareil d'appui de la ligne d'appui ${i} : 0 articulation Freyssinet, 1 élastomère fretté, 2 autre type.` });
  const nap = i => ({ rowLabel: 'NAP', k: 'A13.NAP' + i, code: 'NAP' + i, label: '', type: 'int', help: `Nombre d'appareils d'appui sur la ligne d'appui ${i} (0 au-delà de NT + 1).` });

  const steps = [
    { id: 'id', noCap: true, label: 'Identification', view: 'elev', caption: '', hint: 'Survolez une case : sa définition s\'affiche ici et la cote correspondante s\'allume sur les dessins.', pages: [
      { label: 'Titre', groups: [
        { title: 'Titre de la note (ligne A1)', short: '', flex: 5, cols: 2, fields: [
          { k: 'TITRE1', code: 'A1', label: 'ligne 1', type: 'txt', bare: true, help: 'Identité de l\'ouvrage (ligne A1, 80 caractères) : imprimée en tête de la note.' },
        ] },
      ] },
    ], draw: (svg, m, sch) => drawElev(svg, m, sch, 'app') },

    { id: 'long', col: 0, label: 'Profil en long', view: 'elev', caption: '', hint: 'Nombre de travées, biais, abouts et portées biaises (mesurées suivant l\'axe de l\'ouvrage).', pages: [
      { label: 'Travées', groups: [
        { title: 'Ouvrage', flex: 3, cols: 3, fields: [
          { k: 'A5.NT', code: 'NT', label: 'nb de travées', type: 'sel', relayout: true, opts: [1, 2, 3, 4, 5, 6].map(i => [i, String(i)]), help: 'Nombre de travées (1 à 6).' },
          { k: 'A5.BIAIS', code: 'BIAIS', label: 'biais', unit: 'gr', dec: 3, help: 'Biais géométrique moyen : angle en grades entre les lignes d\'appui et l\'axe longitudinal (100 = pont droit, ≤ 100).' },
          { k: 'A5.ABOUT', code: 'ABOUT', label: 'about', unit: 'm', dec: 3, help: 'Longueur biaise d\'about sur appuis extrêmes : distance, suivant l\'axe, entre la ligne d\'appui de rive et l\'extrémité de la dalle.' },
        ] },
        { title: 'Portées biaises', alt: true, flex: 6, cols: 6, fields: [1, 2, 3, 4, 5, 6].map(sp) },
      ] },
    ], draw: (svg, m, sch) => drawElev(svg, m, sch, 'app') },

    { id: 'trav', col: 1, label: 'Profil en travers', view: 'coupe', caption: '', hint: 'Profil en travers de la voie portée, de gauche à droite (sens de l\'axe).', pages: [
      { label: 'Profil en travers (A6)', caption: '', groups: [
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
      { label: 'Fibres et symétrie (A6)', caption: '', groups: [
      ] },
    ], draw: (svg, m, sch) => drawCoupe(svg, m, sch, 'prof') },

    { id: 'sect', col: 1, label: 'Coupe transversale', view: 'coupe', caption: '', hint: 'Épaisseurs et largeurs droites de la dalle (EDALLE2 mesurée depuis les arêtes inférieures, flancs compris).', pages: [
      { label: 'Structure porteuse (A7)', caption: '', draw: (svg, m, sch) => drawCoupe(svg, m, sch, 'slab'), groups: [
        { title: 'Épaisseurs', flex: 3, cols: 3, fields: [
          { k: 'A7.HDALLE1', code: 'HDALLE1', label: 'nervure', unit: 'm', dec: 3, help: 'Épaisseur de la dalle résistante (de la nervure si la coupe comporte des encorbellements). À majorer si la dalle est bombée.' },
          { k: 'A7.HDALLE2', code: 'HDALLE2', label: 'bout d\'encorb.', unit: 'm', dec: 3, help: 'Épaisseur à l\'extrémité des encorbellements latéraux. Cas courant : moyenne ½(h1 + h2) des épaisseurs d\'encorbellement.' },
          { k: 'A7.HDALLE3', code: 'HDALLE3', label: 'flanc', unit: 'm', dec: 3, help: 'Hauteur verticale du flanc oblique entre l\'encorbellement et le corps de la dalle. Cas courant : HDALLE1 − HDALLE2.' },
        ] },
        { title: 'Largeurs droites', alt: true, flex: 3, cols: 3, fields: [
          { k: 'A7.EDALLE1', code: 'EDALLE1', label: 'intrados', unit: 'm', dec: 3, help: 'Largeur droite d\'intrados entre encorbellements (entre arêtes inférieures de la nervure).' },
          { k: 'A7.EDALLE2', code: 'EDALLE2', label: 'encorb. cumulés', unit: 'm', dec: 3, help: 'Largeur droite cumulée des deux encorbellements (gauche + droit), mesurée depuis les arêtes inférieures de la nervure : flancs obliques compris. Largeur totale de la dalle = EDALLE1 + EDALLE2.' },
          { k: 'A7.EDALLE3', code: 'EDALLE3', label: 'flancs cumulés', unit: 'm', dec: 3, help: 'Largeur droite cumulée des deux flancs obliques (projection horizontale), comprise dans EDALLE2.' },
        ] },
      ] },
    ], draw: (svg, m, sch) => drawCoupe(svg, m, sch, 'slab') },

    { id: 'charg', col: 2, label: 'Charges', view: 'coupe', caption: '', hint: 'Charges permanentes, gradient, classe du pont et charges d\'exploitation : cliquez une charge sur le dessin pour la cocher ou la décocher.', pages: [
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
        { title: 'Classe du pont', short: 'Pont', flex: 1, cols: 1, fields: [
          { k: 'A8.STATUT', code: 'Classe', label: 'classe', type: 'sel', w: 72, opts: [['100', '1re'], ['200', '2e'], ['300', '3e']], help: 'Classe du pont (fascicule 61 titre II, art. 3) : 1re classe si la largeur roulable est ≥ 7 m, 2e entre 5,50 et 7 m, 3e en deçà.' },
        ] },
        { title: 'Charges routières', short: 'Charges routières (cocher)', alt: true, flex: 9, cols: 9, fields: [
          { k: 'FIX.A', code: 'A(l)', type: 'chk', help: 'Charge A(l) du fascicule 61 titre II : cochée = appliquée.' },
          { k: 'FIX.BC', code: 'Bc', type: 'chk', help: 'Camions Bc : cochés = appliqués.' },
          { k: 'FIX.BT', code: 'Bt', type: 'chk', help: 'Tandems Bt : cochés = appliqués.' },
          { k: 'MIL.MC80', code: 'Mc80', type: 'chk', help: 'Char militaire Mc80 (72 t, 2 chenilles de 4,90 × 0,85 m).' },
          { k: 'MIL.MC120', code: 'Mc120', type: 'chk', help: 'Char militaire Mc120 (110 t, 2 chenilles de 6,10 × 1,00 m).' },
          { k: 'MIL.ME80', code: 'Me80', type: 'chk', help: 'Système militaire Me80 : 2 essieux de 22 t distants de 1,50 m (impact 3,50 × 0,12 m).' },
          { k: 'MIL.ME120', code: 'Me120', type: 'chk', help: 'Système militaire Me120 : 2 essieux de 33 t distants de 1,80 m (impact 4,00 × 0,15 m).' },
          { k: 'CE.D', code: 'Convoi D', type: 'chk', relayout: true, help: 'Convoi exceptionnel type D (circulaire R/DR, 1973).' },
          { k: 'CE.E', code: 'Convoi E', type: 'chk', relayout: true, help: 'Convoi exceptionnel type E (cocher E entraîne D, comme le code CE du SETRA).' },
        ] },
        { title: 'Trottoirs', alt: true, flex: 1, cols: 1, fields: [
          { k: 'A8.PSTROT', code: 'PSTROT', label: 'charge', unit: 't/m²', dec: 3, help: 'Charge générale des trottoirs : 0 pour une plateforme autoroutière, 0,150 t/m² pour une voirie ordinaire.' },
          { k: 'TRT.G', code: 'gauche', type: 'chk', help: 'Trottoir de gauche chargé par PSTROT (décocher pour ne pas le charger).' },
          { k: 'TRT.D', code: 'droit', type: 'chk', help: 'Trottoir de droite chargé par PSTROT (décocher pour ne pas le charger).' },
        ] },
      ] },
    ], one: (svg, m) => drawCoupe(svg, m, false, 'loads1'), draw: (svg, m, sch) => drawCoupe(svg, m, sch, 'loads') },

    { id: 'mat', col: 2, label: 'Béton', view: 'coupe', caption: '', hint: 'État-limite d\'ouverture des fissures et caractéristiques du béton (unités du bordereau : t/m²).', pages: [
      { label: 'Béton', groups: [
        { title: 'Béton (BAEL 91 mod. 99)', short: '', flex: 4, cols: 4, fields: [
          { k: 'FC28', code: 'fc28', label: 'compression', unit: 'MPa', dec: 1, help: 'Résistance caractéristique à la compression à 28 jours (MPa). ft28 = 0,6 + 0,06 fc28 en est déduite (BAEL A.2.1,12).' },
          { k: 'A9.GENRE', code: 'Fissuration', label: 'fissuration', type: 'sel', opts: [['100', 'peu préjudiciable'], ['200', 'préjudiciable'], ['300', 'très préjudiciable']], w: 130, help: '100 / 200 / 300 : fissuration peu préjudiciable / préjudiciable / très préjudiciable ; i01 : contraintes limites extra-réglementaires lues en ligne C1.' },
          { k: 'A9.POISSON', code: 'Poisson', label: 'coef. Poisson', dec: 3, help: 'Coefficient de Poisson du béton (flexion transversale). Valeur conseillée 0,20.', def: '0,20' },
          { k: 'A9.RETRAI', code: 'Retrait', label: 'retrait', dec: 5, help: 'Raccourcissement relatif final du retrait du béton (BAEL A.2.1,22), ex. 0,00040.', def: '0,00040' },
        ] },
      ] },
    ], draw: (svg, m, sch) => drawCoupe(svg, m, sch, 'mat') },

    { id: 'acier', col: 1, label: 'Armatures', view: 'arm', caption: '', hint: 'Diamètres, nuances et disposition des armatures (diamètres saisis en mm, écrits en m dans le bordereau).', pages: [
      { label: 'Diamètres et limites', groups: [
        { title: 'Diamètres', flex: 4, cols: 4, fields: [
          { k: 'A10.PHI1', code: 'PHI1', label: 'longit. princ.', unit: 'mm', dec: 0, help: 'Diamètre des aciers longitudinaux principaux (et éventuellement des chevêtres incorporés).' },
          { k: 'A10.PHI2', code: 'PHI2', label: 'transv. inf.', unit: 'mm', dec: 0, help: 'Diamètre des aciers transversaux inférieurs en travée, des chevêtres incorporés et des aciers longitudinaux complémentaires.' },
          { k: 'A10.PHI3', code: 'PHI3', label: 'transv. sup.', unit: 'mm', dec: 0, help: 'Diamètre des aciers transversaux supérieurs en travée et éventuellement des aciers longitudinaux de construction.' },
          { k: 'A10.PHI4', code: 'PHI4', label: 'étriers', unit: 'mm', dec: 0, help: 'Diamètre des étriers.' },
        ] },
        { title: 'Limites d\'élasticité', alt: true, flex: 4, cols: 4, fields: [1, 2, 3, 4].map(i => ({ k: 'A10.FE' + i, code: 'FE' + i, unit: 't/m²', dec: 0, def: '50000', help: `Limite d'élasticité garantie des aciers PHI${i}, en t/m² (50 000 t/m² = FeE500 ; 40 000 = FeE400).` })) },
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
    ], draw: (svg, m, sch) => drawArm(svg, m, sch) },

    { id: 'app', col: 0, label: 'Appuis', view: 'plan', caption: '', hint: 'Tassements d\'appui (A12) et appareils d\'appui (A13), appuis numérotés de 1 à NT + 1.', pages: [
      { label: 'Tassements par appui (A12)', caption: '', draw: (svg, m, sch) => drawElev(svg, m, sch, 'appt'), groups: [1, 2, 3, 4, 5, 6, 7].map(i => ({ show: m => i <= (Math.round(V(m, 'A5.NT')) || 1) + 1, title: 'Appui ' + i, appui: 'A12', alt: i % 2 === 0, flex: 2, cols: 2, fields: [tp(i), dtp(i)] })) },
      { label: 'Coefficients et compressions', groups: [
        { title: 'Tassements (A12)', flex: 3, cols: 3, fields: [
          { k: 'A3.TASMENT', code: 'TASMENT', label: LBL.TASMENT, type: 'sel', opts: [[0, '0 — non'], [1, '1 — 1 cm'], [2, '2 — + A12']], help: '0 : pas de calcul ; 1 : moments et réactions dus à des dénivellations d\'appui unitaires de 1 cm ; 2 : en plus, sécurité vis-à-vis des tassements de la ligne A12.' },
          { k: 'A12.YOUNG', code: 'YOUNG', label: 'Ei28 / E', dec: 3, def: '3', help: 'Valeur entre 3 et 5 donnant le module Ei28/YOUNG utilisé pour les efforts dus aux tassements. Sauf précision contraire, 3.' },
          { k: 'A12.KTP', code: 'KTP', label: 'fraction ELS', dec: 3, def: '1', help: 'Fraction des tassements probables prise en compte dans l\'étude ELS (combinaison quasi permanente).' },
        ] },
        { title: 'Appareils d\'appui en élastomère fretté (A13) — compressions admissibles en t/m²', alt: true, flex: 3, cols: 3, fields: [
          { k: 'A13.COMPRENV', code: 'COMPRENV', label: 'élast. min', dec: 0, def: '200', help: 'Contrainte minimale admissible de compression moyenne des appareils en élastomère (risque de cheminement), t/m². Conseillé 200.' },
          { k: 'A13.COMPRENS', code: 'COMPRENS', label: 'élast. max', dec: 0, def: '1200', help: 'Contrainte maximale admissible de compression moyenne des appareils en élastomère, t/m². Conseillé 1200.' },
          { k: 'A13.SYMAP', code: 'SYMAP', label: 'symétrie', type: 'sel', opts: [[1, '1 — longit.'], [0, '0 — aucune'], [2, '2 — interm. id.']], help: 'Symétrie longitudinale des appareils : 0 aucune ; 1 symétrie longitudinale ; 2 appareils des appuis intermédiaires tous identiques.' },
        ] },
      ] },
      { label: 'Appareils par appui (A13)', groups: [1, 2, 3, 4, 5, 6, 7].map(i => ({ show: m => i <= (Math.round(V(m, 'A5.NT')) || 1) + 1, title: 'Appui ' + i, appui: 'A13', alt: i % 2 === 0, flex: 2, cols: 2, fields: [nap(i)] })) },
    ], draw: (svg, m, sch) => drawPlan(svg, m, sch) },
  ];

  /* ───── modèle générique pour les schémas de principe ───── */
  let GEN = null;
  function gen() {
    if (GEN) return GEN;
    const m = E.parseBordereau(EX1);
    const L = m.lignes;
    Object.assign(L.A5, { NT: 3, BIAIS: 80, ABOUT: 0.8, D1: 11, D2: 15, D3: 11 });
    Object.assign(L.A6, { ETROTG: 1.25, EGAU: 0.5, ESURCH: 6.5, EDROI: 0.5, ETROTD: 1.25, HCHAU: 0.12, NVOIE: 2 });
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
    const xa = E1 / 2, xb = E1 / 2 + Math.min(E3, E2) / 2, xc = (E1 + E2) / 2;   // notice SETRA : EDALLE2 mesuré depuis les arêtes inférieures, flancs (EDALLE3) compris ; largeur totale = EDALLE1 + EDALLE2
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
    if (!sch) d.dim(xr, Y(-W / 2), xr, Y(W / 2), fmt(W, 2), -0.01, 'A7.EDALLE1 A7.EDALLE2', { size: 0.8 });
    // angle de biais, sous l'arête inférieure, à l'appui 1
    const r = Math.min(W * 0.4, 4.2 * s), xi = xs[0] - W / 2 * ct, yi = Y(-W / 2);
    d.line(xi - r * 1.25, yi, xi, yi, 'l', 'A5.BIAIS');
    d.line(xi, yi, xi - r * 1.25 * Math.cos(b), yi - r * 1.25 * Math.sin(b), 'ax', 'A5.BIAIS');
    const arc = []; for (let i = 0; i <= 18; i++) { const t = Math.PI + b * i / 18; arc.push([xi + r * Math.cos(t), yi + r * Math.sin(t)]); }
    d.path(arc, 'l', 'A5.BIAIS');
    const tm = Math.PI + b / 2;
    d.text(xi + r * 1.5 * Math.cos(tm), yi + r * 1.35 * Math.sin(tm), sch ? 'BIAIS' : fmt(bg, 1) + ' gr', { size: 0.8, cls: sch ? 'tc' : 'dv', a: 'end', k: 'A5.BIAIS' });
    return { top: Y(W / 2), bottom: yi - r * 1.5 };
  }

  /* élévation longitudinale + vue en plan alignée */
  function drawElev(svg, m, sch, mode, hook) {
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
    const d = svg({ x0: -Math.max(3.5 * s, ex + 1.2 * rr + 9 * s), y0: yb, x1: Lt + Math.max(3.5 * s, ex + 3.5 * s), y1: top + 11.2 * s }, { pad: 0.03 });
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
    if (!sch) d.dim(0, top, Lt, top, 'longueur totale ' + fmt(Lt, 2) + ' m', 8.6 * s, null, { size: 1.05 });
    // légende
    const Lmax = Math.max(...D, 0);
    planInto(d, m, sch, yc, s, { nums: NUMS });
    if (hook) hook(d, { n, xs, Lt, W, yc, s, ex, b: bc, H, top, hp, yt, yb });
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
    let dimOff = null;
    const ONE = mode === 'loads1', LOADS = mode === 'loads' || ONE;   // loads1 : schéma unique (toutes les charges, cochées en couleur)
    const nLoads = LOADS ? ['FIX.A', 'FIX.BC', 'FIX.BT', 'MIL.MC80', 'MIL.MC120', 'MIL.ME80', 'MIL.ME120', 'CE.D', 'CE.E'].filter(k => ONE || sch || num(get(m, k)) === 1).length : 0;
    const yTop = top + (LOADS ? 0.18 + 1.05 + nLoads * (ONE ? 1.3 : 0.95) + 0.6 : HALF || mode === 'slab' ? 0.9 : 2.3);
    const d = HALF ? svg({ x0: -0.9, y0: -1.25, x1: xc + 0.7, y1: yTop }, { pad: 0.04 }) : LOADS ? svg({ x0: -half - (ONE ? 3.4 : 1.9), y0: -1.95, x1: half + (sch || ONE ? 0.5 : 3.6), y1: yTop }, { pad: 0.04 }) : svg({ x0: -half - 0.9, y0: mode === 'prof' ? -0.4 : -1.95, x1: half + 0.9, y1: yTop }, { pad: 0.04 });
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
    if (LOADS) {
      // Plan de chargement EN TRAVERS : chaque charge est vue de l'arrière (elle circule perpendiculairement au dessin),
      // une charge par rangée au-dessus du tablier, à l'échelle transversale ; rangées alignées sur la largeur chargeable.
      const x0 = xp[2], wc = ws[2], cx = x0 + wc / 2;
      const isOn = k => num(get(m, k)) === 1, on = k => ONE || sch || isOn(k);
      const nf = Math.max(1, Math.min(nv, Math.floor(wc / 2.5 + 1e-9))), ntd = Math.max(1, Math.min(2, nv, Math.floor(wc / 3 + 1e-9)));
      const rows = [
        { k: 'FIX.A', c: 'A(l)', v: `${nv} voie${nv > 1 ? 's' : ''} chargée${nv > 1 ? 's' : ''}`, draw: (y) => { d.rect(x0, y, wc, 0.32, 'la', 'FIX.A'); for (let i = 1; i < nv; i++) d.line(x0 + wc * i / nv, y, x0 + wc * i / nv, y + 0.32, 'lane', 'FIX.A'); } },
        { k: 'FIX.BC', c: 'Bc', v: `${nf} file${nf > 1 ? 's' : ''} de camions de 30 t`, draw: (y) => { for (let f = 0; f < nf; f++) { const a = x0 + f * 2.5; d.rect(a + 0.12, y + 0.16, 2.26, 0.42, 'veh', 'FIX.BC'); for (const w of [0.25, 2.25]) d.rect(a + w - 0.15, y, 0.3, 0.2, 'tyre', 'FIX.BC'); } } },
        { k: 'FIX.BT', c: 'Bt', v: `${ntd} tandem${ntd > 1 ? 's' : ''} de 32 t`, draw: (y) => { for (let f = 0; f < ntd; f++) { const a = x0 + f * 3; d.rect(a + 0.3, y + 0.16, 2.4, 0.42, 'veh', 'FIX.BT'); for (const w of [0.5, 2.5]) d.rect(a + w - 0.3, y, 0.6, 0.2, 'tyre', 'FIX.BT'); } } },
        { k: 'MIL.MC80', c: 'Mc80', v: 'char de 72 t', draw: (y) => tank(y, 0.85, 2.80, 'MIL.MC80') },
        { k: 'MIL.MC120', c: 'Mc120', v: 'char de 110 t', draw: (y) => tank(y, 1.00, 3.30, 'MIL.MC120') },
        { k: 'MIL.ME80', c: 'Me80', v: '2 essieux de 22 t', draw: (y) => axle(y, 3.50, 'MIL.ME80') },
        { k: 'MIL.ME120', c: 'Me120', v: '2 essieux de 33 t', draw: (y) => axle(y, 4.00, 'MIL.ME120') },
        { k: 'CE.D', c: 'Convoi D', v: 'remorque de 140 t', draw: (y) => conv(y, 'CE.D') },
        { k: 'CE.E', c: 'Convoi E', v: 'remorque de 200 t', draw: (y) => conv(y, 'CE.E') },
      ].filter(r => on(r.k));
      function tank(y, cw, ent, k) { const a = cx - ent / 2; d.rect(a - cw / 2 - 0.1, y + 0.2, ent + cw + 0.2, 0.42, 'veh', k); d.rect(a + ent / 2 - 0.5, y + 0.62, 1.0, 0.18, 'veh', k); for (const t of [a, a + ent]) d.rect(t - cw / 2, y, cw, 0.24, 'tyre', k); }
      function axle(y, w, k) { d.rect(cx - w / 2, y, w, 0.12, 'tyre', k); d.rect(cx - w / 2 + 0.2, y + 0.12, w - 0.4, 0.36, 'veh', k); }
      function conv(y, k) { const w = 3.3; d.rect(cx - w / 2, y + 0.18, w, 0.3, 'veh', k); for (let i = 0; i < 8; i++) d.rect(cx - w / 2 + 0.1 + i * (w - 0.3) / 7, y, 0.1, 0.18, 'tyre', k); }
      const rowH = ONE ? 1.3 : 0.95, y0 = top + ht + 1.05, offRow = [];
      for (const xx of [x0, x0 + wc]) d.line(xx, top, xx, y0 + rows.length * rowH, 'lane');
      rows.forEach((r, i) => {
        const y = y0 + (rows.length - 1 - i) * rowH, act = !ONE || isOn(r.k);
        if (ONE) d.rect(-half - 3.3, y - 0.12, 2 * half + 3.75, rowH - 0.1, act ? 'rowon' : 'rowoff', r.k);   // bande cliquable : coche / décoche
        d.line(x0, y, x0 + wc, y, 'hl-line'); r.draw(y);
        if (ONE) { d.text(-half - 3.1, y + 0.62, (act ? '☑ ' : '☐ ') + r.c, { size: 1.05, a: 'start', cls: act ? 'tc' : 'ts', k: r.k });
          d.text(-half - 3.1, y + 0.08, r.v, { size: 0.62, a: 'start', cls: 'ts', k: r.k }); }
        else { d.text(-half - 0.2, y + 0.25, r.c, { size: 0.8, a: 'end', cls: sch ? 'tc' : 't', k: r.k });
          if (!sch) d.text(half + 0.2, y + 0.25, r.v, { size: 0.68, a: 'start', cls: 'ts', k: r.k }); }
        if (ONE && !act) offRow.push(r.k);
      });
      if (!rows.length && !sch) d.text(cx, y0 + 0.3, 'aucune charge routière cochée', { size: 0.8, cls: 'ts' });
      const yS = y0 + rows.length * rowH + 0.15;
      if (wc > 0) d.dim(x0, top + ht, x0 + wc, top + ht, sch ? 'ESURCH chargeable' : 'largeur chargeable ' + fmt(wc, 2) + ' m', 0.25, 'A6.ESURCH', { size: 0.75 });
      for (const [xa0, w, tk] of [[xp[0], ws[0], 'TRT.G'], [xp[4], ws[4], 'TRT.D']]) if (w > 0 && (sch || num(get(m, tk)) === 1)) { for (const f of [0.3, 0.7]) arrow(d, xa0 + w * f, top + ht + 0.55, top + ht + 0.05, 'A8.PSTROT'); d.text(xa0 + w / 2, top + ht + 0.68, sch ? 'PSTROT' : fmt(V(m, 'A8.PSTROT'), 3) + ' t/m²', { size: 0.65, cls: sch ? 'tc' : 'vl', k: 'A8.PSTROT' }); }
      d.text(0, yS + 0.2, sch ? 'superstructures QSUPTM · QSUPTm (t/m)' : `superstructures ${fmt(V(m, 'A8.QSUPMIN'), 3)} à ${fmt(V(m, 'A8.QSUPMAX'), 3)} t/m`, { size: 0.72, cls: sch ? 'tc' : 'vl', k: 'A8.QSUPMAX A8.QSUPMIN' });
      d.text(0, H1 * 0.45, sch ? 'ossature : MASVOL × aire × OSSAM / OSSAm' : `ossature ${fmt(V(m, 'A8.MASVOL') || 2.5, 2)} t/m³`, { size: 0.72, cls: sch ? 'tc' : 'vl', k: 'A8.MASVOL A8.OSMAX A8.OSMIN' });
      if (ONE && offRow.length) dimOff = out => out.replace(/<(rect|line|text|circle|path|polygon)([^>]*?)data-k="([^"]*)"/g, (mm, t, a, k) => offRow.includes(k) && !/rowoff/.test(a) ? `<${t}${a}data-k="${k}" opacity=".28"` : mm);
    } else if (!HALF && mode !== 'slab') {   // profil en travers : cotes de la ligne A6
      const yy = top + ht;
      const keys = ['A6.ETROTG', 'A6.EGAU', 'A6.ESURCH', 'A6.EDROI', 'A6.ETROTD'];
      keys.forEach((k, i) => { if (ws[i] > 0 || sch) d.dim(xp[i], yy, xp[i + 1], yy, lab(m, k, sch, 2), 0.55, k, { size: ws[i] < 0.9 ? 0.75 : 1.0 }); });
      d.dim(xp[0], yy, xp[5], yy, sch ? 'ETROTG + EGAU + ESURCH + EDROI + ETROTD' : 'profil utile ' + fmt(Ws, 2) + ' m', 1.35, null, { size: 0.9 });
      // rives hors profil utile (corniches, dispositifs) : dalle EDALLE1+2+3 plus large que le profil A6, cas courant des listings SETRA
      if (!sch && S.W > Ws + 0.01) for (const [a, b] of [[-xc, xp[0]], [xp[5], xc]]) if (b - a > 0.01) {
        d.dim(a, yy, b, yy, fmt(b - a, 2), 0.55, null, { size: 0.75 });
        d.text((a + b) / 2, top + ht + 0.12, 'rive', { size: 0.6, cls: 'ts', base: 'auto' });
      }
      d.text(xp[2] + ws[2] / 2, top + 0.3, sch ? 'NVOIE voies' : nv + ' voie' + (nv > 1 ? 's' : '') + (nvR > 0 ? '' : ' (F61)'), { size: 0.75, cls: sch ? 'tc' : 'ts', k: 'A6.NVOIE', base: 'auto' });
      if (hc > 0 || sch) d.text(xp[4] - 0.15, top + 0.3, (sch ? 'HCHAU' : 'chaussée ' + fmt(hc, 3)) + ' ▾', { size: 0.7, a: 'end', base: 'auto', cls: sch ? 'tc' : 'dv', k: 'A6.HCHAU' });
    }
    if (mode === 'mat') d.text(0, H1 * 0.45, sch ? 'fc28 · fissuration · Poisson · retrait' : `fc28 ${fmt(V(m, 'A9.FCJ') / 100, 1)} MPa · ft28 ${fmt(V(m, 'A9.FTJ') / 100, 2)} MPa`, { size: 0.8, cls: sch ? 'tc' : 'dv', k: 'A9.FCJ A9.FTJ A9.POISSON A9.RETRAI A9.GENRE' });
    // cotes de la section
    const DET = !LOADS && mode !== 'mat' && mode !== 'prof';   // 'prof' : seules les cotes du profil en travers ; 'slab' : seules celles de la dalle
    const sides = !DET ? [] : HALF ? [1] : [-1, 1];
    if (xc > xb) for (const sg of sides) d.dim(sg < 0 ? -xc : xa, 0, sg < 0 ? -xa : xc, 0, sch ? 'EDALLE2/2' : fmt(xc - xa, 2), -1.0, 'A7.EDALLE2', { size: 0.9 * Z });
    if (HALF) d.dim(0, 0, xa, 0, sch ? 'EDALLE1/2' : fmt(xa, 2), -0.5, 'A7.EDALLE1', { size: Z });
    else if (DET) d.dim(-xa, 0, xa, 0, sch ? 'EDALLE1' : fmt(S.E1, 2), -0.5, 'A7.EDALLE1', { size: 1.05 });
    if (xb > xa) for (const sg of sides) d.dim(sg < 0 ? -xb : xa, 0, sg < 0 ? -xa : xb, 0, sch ? 'EDALLE3/2' : fmt(xb - xa, 2), -0.5, 'A7.EDALLE3', { size: 0.8 * Z });
    if (!HALF && mode !== 'prof') d.dim(-xc, 0, xc, 0, sch ? 'EDALLE1 + EDALLE2' : 'largeur droite de la dalle ' + fmt(S.W, 2) + ' m', -1.5, 'A7.EDALLE1 A7.EDALLE2 A7.EDALLE3', { size: 0.95 });
    const xh = HALF ? xa * 0.45 : -xa + Math.min(0.5, xa * 0.3);
    if (DET) d.dim(xh, 0, xh, H1, L('A7.HDALLE1'), -0.05, 'A7.HDALLE1', { size: 0.85 * Z, inside: true });
    if (DET && xc > xb && H2 > 0) d.dim(xc, H1 - H2, xc, H1, L('A7.HDALLE2'), -0.2 * Z, 'A7.HDALLE2', { size: 0.85 * Z });
    if (DET && H3 > 0 && xb > xa) d.dim(xb, 0, xb, H3, L('A7.HDALLE3'), -0.2 * Z, 'A7.HDALLE3', { size: 0.85 * Z });
    if (HALF) d.text(xc + 0.6, top + 0.62, sch ? 'cas courant : HDALLE2 = ½ (h1 + h2), HDALLE3 = H − HDALLE2' : '', { size: 0.7, a: 'end', cls: 'ts' });
    return dimOff ? dimOff(d.toString()) : d.toString();
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
    const Ws = ws.reduce((a, b) => a + b, 0), Wd = E1 + E2;
    ws.forEach((w, i) => { if (w < 0) E_('trav', ['A6.ETROTG', 'A6.EGAU', 'A6.ESURCH', 'A6.EDROI', 'A6.ETROTD'][i], 'les largeurs du profil en travers ne peuvent pas être négatives'); });
    const es = ws[2];
    if (!(es > 0)) E_('trav', 'A6.ESURCH', 'la largeur chargeable ESURCH doit être positive');
    // règle : le profil en travers a la même largeur que la coupe transversale (ETROTG + EGAU + ESURCH + EDROI + ETROTD = EDALLE1 + EDALLE2)
    if (Wd > 0 && Ws > 0 && Math.abs(Ws - Wd) > 0.005) { const t = `largeur de la dalle ${fmt(Wd, 2)} m ≠ profil en travers ${fmt(Ws, 2)} m : les deux largeurs doivent être égales`;
      W_('sect', 'A7.EDALLE2', t); }   // avertissement (le calcul reste possible)
    const nv = Math.round(V(m, 'A6.NVOIE'));
    if (nv < 0) E_('trav', 'A6.NVOIE', 'nombre de voies négatif');
    else if (nv > 0 && es > 0 && nv !== nvF61(es)) W_('trav', 'A6.NVOIE', `NVOIE = ${nv} imposé ; le fascicule 61 donne ${nvF61(es)} voie${nvF61(es) > 1 ? 's' : ''} pour ESURCH = ${fmt(es, 2)} m (laisser 0 sauf cas particulier)`);
    const sym = Math.abs(ws[0] - ws[4]) < 1e-6 && Math.abs(ws[1] - ws[3]) < 1e-6;
    const hc = V(m, 'A6.HCHAU'); if (hc < 0 || hc > 0.4) W_('trav', 'A6.HCHAU', `épaisseur de chaussée HCHAU inhabituelle (${fmt(hc, 3)} m)`);
    // charges
    const st = String(get(m, 'A8.STATUT') || '');
    if (st.slice(0, 1) === '0') E_('charg', 'A8.STATUT', 'STATUT 000 (fascicule 61 de 1960) : règlement non pris en charge, choisir la classe 100, 200 ou 300 (fascicule 61 de 1971)');
    else if (!['100', '200', '300'].includes(st.slice(0, 1) + '00') || !/^\d{3}$/.test(st)) E_('charg', 'A8.STATUT', 'STATUT : 100, 200 ou 300 (classe du pont)');
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
    if (!(fc > 0)) E_('mat', 'FC28', 'la résistance fc28 doit être positive (MPa)');
    else if (fc < 1000) E_('mat', 'FC28', `fc28 = ${fmt(fc / 100, 1)} MPa : trop faible`);
    else if (fc < 2000 || fc > 6000) W_('mat', 'FC28', `résistance ${fmt(fc / 100, 0)} MPa inhabituelle (25 à 40 MPa)`);
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
    if (tas !== 2 && anyT) W_('app', 'A3.TASMENT', 'tassements saisis en ligne A12 mais TASMENT ≠ 2 : ils ne sont pas étudiés');
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
      + kv('Largeur droite de la dalle', fmt(A7.EDALLE1 + A7.EDALLE2, 2) + ' m')
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

  /* ═════════════ planches de croquis intercalées dans la note (affichage seulement : la note texte est inchangée) ═════════════
     figures(m, r, pages) → [{ after, html }] ; toutes les valeurs tracées viennent de r (résultats du moteur). */
  const COL = { mx: '#c0392b', mn: '#1a4fd6', perm: '#3c3f4d', s1: '#a07828', s2: '#0a8a78', s3: '#7b4fb0', s4: '#b86a14' };
  const CYC = ['s1', 's2', 's3', 's4', 'mx', 'mn'];
  const STY = '<style>.psf-t{border-collapse:collapse;font-family:\'Courier New\',monospace;font-size:10.5px;color:#222;margin-top:6px}'
    + '.psf-t th,.psf-t td{border:1px solid #d8d3ca;padding:2px 7px;text-align:right;white-space:nowrap}.psf-t th{background:#f3f0ea;font-weight:700;text-align:center}'
    + '.psf-t td:first-child{text-align:left}.psf-n{font-size:11px;color:#7a7e8e;margin:4px 0 0;line-height:1.4}.psf-w{overflow-x:auto}</style>';
  const tbl = (head, rows) => `<div class="psf-w"><table class="psf-t"><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map(rw => `<tr>${rw.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const box = (title, body, wide, note) => `<div${wide ? ' class="wide"' : ''}><h5>${esc(title)}</h5>${body}${note ? `<p class="psf-n">${esc(note)}</p>` : ''}</div>`;
  const pair = (...b) => `<div class="wide" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(560px,1fr));gap:14px 22px;align-items:start">${b.join('')}</div>`;
  const fsz = (str, k) => String(str).replace(/font-size="([\d.]+)"/g, (_, v) => `font-size="${+(v * k).toFixed(4)}"`);
  /* OTUI.chart à la largeur d'affichage, légende remontée au-dessus des repères d'appui */
  function chartW(o, half) {
    const mt = 46, w = o.w || (half ? 660 : 1300);
    let sv = G.OTUI.chart(Object.assign({ mt, h: half ? 300 : 320 }, o, { w }));
    sv = sv.replace(new RegExp(`(<line [^>]*?)y1="${mt - 14}" y2="${mt - 14}"([^>]*class="c )`, 'g'), `$1y1="${mt - 32}" y2="${mt - 32}"$2`)
      .replace(new RegExp(`(<text [^>]*?)y="${mt - 14}"( class="lg")`, 'g'), `$1y="${mt - 32}"$2`);
    return sv;
  }
  const pick = (a, b) => (Math.abs(a) >= Math.abs(b) ? a : b);     // valeur extrême (en module) parmi deux valeurs imprimées
  const nf = (v, d) => (isFinite(v) ? fmt(v, d == null ? 2 : d) : '—');
  const niceStep = r0 => { const p = Math.pow(10, Math.floor(Math.log10(r0))); const f = r0 / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };

  /* diagramme en barres groupées (unités écran, même charte que OTUI.chart) */
  function bars(o) {
    const W = o.w || 1300, H = o.h || 280, ml = 64, mr = 16, mt = 30, mb = 34;
    const all = [0]; for (const s of o.series) for (const v of s.v) if (isFinite(v)) all.push(v);
    let y0 = Math.min(...all), y1 = Math.max(...all); if (y1 - y0 < 1e-9) y1 = y0 + 1;
    const st = niceStep((y1 - y0) / 5); y0 = Math.floor(y0 / st) * st; y1 = Math.ceil(y1 / st) * st;
    const ng = o.groups.length, ns = o.series.length, gw = (W - ml - mr) / ng, bw = Math.min(30, gw * 0.84 / ns);
    const PY = v => H - mb - (v - y0) / (y1 - y0) * (H - mt - mb), f2 = v => +v.toFixed(2), out = [];
    out.push(`<svg class="ot-chart" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">`);
    for (let v = y0; v <= y1 + st / 2; v += st) { const y = f2(PY(v)); out.push(`<line x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}" class="g"/><text x="${ml - 6}" y="${y}" class="yl">${esc(fmt(v, st < 1 ? (st < 0.1 ? 2 : 1) : 0))}</text>`); }
    o.groups.forEach((g, i) => {
      const cx = ml + gw * (i + 0.5);
      if (i) out.push(`<line x1="${f2(ml + gw * i)}" x2="${f2(ml + gw * i)}" y1="${mt}" y2="${H - mb}" class="g2"/>`);
      out.push(`<text x="${f2(cx)}" y="${H - mb + 15}" class="xl">${esc(g)}</text>`);
      o.series.forEach((s, j) => {
        const v = s.v[i]; if (!isFinite(v)) return;
        const x = cx - ns * bw / 2 + j * bw, ya = PY(Math.max(v, 0)), yb = PY(Math.min(v, 0));
        out.push(`<rect x="${f2(x + 1)}" y="${f2(ya)}" width="${f2(bw - 2)}" height="${f2(Math.max(0.6, yb - ya))}" fill="${COL[s.cls] || '#a07828'}" opacity=".82"/>`);
        if (o.vals !== false && Math.abs(v) > 1e-9) {
          const tx = f2(x + bw / 2 + 3.5), ty = f2(v >= 0 ? ya - 3 : yb + 3);
          out.push(`<text x="${tx}" y="${ty}" style="font-size:9px;text-anchor:${v >= 0 ? 'start' : 'end'}" transform="rotate(-90 ${tx} ${ty})" class="${s.cls}">${esc(fmt(v, Math.abs(v) < 10 ? 2 : 1))}</text>`);
        }
      });
    });
    out.push(`<line x1="${ml}" x2="${W - mr}" y1="${f2(PY(0))}" y2="${f2(PY(0))}" class="z"/>`);
    if (o.ylab) out.push(`<text x="12" y="${mt + (H - mt - mb) / 2}" class="al" transform="rotate(-90 12 ${mt + (H - mt - mb) / 2})">${esc(o.ylab)}</text>`);
    let lx = ml + 6;
    for (const s of o.series) { out.push(`<rect x="${lx}" y="${mt - 19}" width="14" height="9" fill="${COL[s.cls]}" opacity=".82"/><text x="${lx + 19}" y="${mt - 14}" class="lg">${esc(s.name)}</text>`); lx += 30 + 6.6 * s.name.length; }
    out.push('</svg>'); return out.join('');
  }

  /* éléments rouges de repérage des coupes (trait épais, flèche de sens de vue, lettre) */
  const RED = 'stroke:#c0392b;fill:#c0392b';
  const rline = (d, x1, y1, x2, y2, w) => d.raw(`<line x1="${+x1.toFixed(4)}" y1="${+(-y1).toFixed(4)}" x2="${+x2.toFixed(4)}" y2="${+(-y2).toFixed(4)}" style="${RED};stroke-width:${w || 2.4}px" vector-effect="non-scaling-stroke"/>`);
  function rarrow(d, x0, y0, dx, dy, len, lab) {         // flèche de sens de vue depuis (x0, y0), direction (dx, dy) unitaire
    const x1 = x0 + dx * len, y1 = y0 + dy * len, h = len * 0.42, w = len * 0.2;
    rline(d, x0, y0, x1 - dx * h * 0.6, y1 - dy * h * 0.6, 1.6);
    d.raw(`<polygon points="${P(x1, y1)} ${P(x1 - dx * h - dy * w, y1 - dy * h + dx * w)} ${P(x1 - dx * h + dy * w, y1 - dy * h - dx * w)}" style="${RED};stroke-width:0"/>`);
    if (lab) d.text(x1 + dx * len * 0.55, y1 + dy * len * 0.55, lab, { size: 1.15, cls: 'tc hl' });
  }
  function cutMarks(d, g) {
    const { n, xs, Lt, W, yc, s, ex, b, H, top } = g, ct = Math.cos(b) / Math.sin(b);
    const L = []; for (let i = 0; i < n; i++) L.push(xs[i + 1] - xs[i]);
    // A-A : suivant l'axe de l'ouvrage (portées biaises), vue vers la gauche de la voie (+y) : la coupe se lit appui 1 à gauche
    const xa0 = -ex - 1.5 * s, xa1 = Lt + ex + 1.5 * s;
    rline(d, xa0, yc, xa0 + 2.4 * s, yc); rline(d, xa1 - 2.4 * s, yc, xa1, yc);
    rarrow(d, xa0, yc, 0, 1, 2.6 * s, 'A'); rarrow(d, xa1, yc, 0, 1, 2.6 * s, 'A');
    // B-B : coupe droite (perpendiculaire à l'axe) au milieu de la plus grande travée, vue dans le sens de l'axe (+x)
    let ib = 0; L.forEach((l, i) => { if (l > L[ib] + 1e-9) ib = i; });
    const xB = xs[ib] + L[ib] / 2, yT = yc + W / 2, yBt = yc - W / 2;
    d.line(xB, yBt - 0.6 * s, xB, yT + 0.6 * s, 'ax');
    rline(d, xB, yT + 0.6 * s, xB, yT + 2.6 * s); rline(d, xB, yBt - 0.6 * s, xB, yBt - 2.6 * s);
    rarrow(d, xB, yT + 2.6 * s, 1, 0, 2.6 * s, 'B'); rarrow(d, xB, yBt - 2.6 * s, 1, 0, 2.6 * s, 'B');
    // rappel de B-B sur l'élévation
    rline(d, xB, top + 0.4 * s, xB, top + 2.0 * s); rline(d, xB, -0.4 * s, xB, -2.0 * s);
    rarrow(d, xB, top + 2.0 * s, 1, 0, 2.0 * s, 'B'); rarrow(d, xB, -2.0 * s, 1, 0, 2.0 * s, 'B');
    // biais de chaque ligne d'appui (biais géométrique unique du PSIDA-EL)
    const bg = b / GR;
    for (let k = 1; k <= n; k++) d.text(xs[k] - (W / 2 + 0.9 * s) * ct, yBt - 0.9 * s, `${k + 1} · ${fmt(bg, 1)} gr`, { size: 0.68, cls: 'dv', a: 'middle' });
    d.text(xs[0] - (W / 2 + 0.9 * s) * ct + 1.2 * s, yBt - 0.9 * s, '1', { size: 0.68, cls: 'dv', a: 'start' });
    return ib;
  }

  /* schéma des lits longitudinaux (épure d'arrêt de barres) sur l'élévation, abscisses horizontales à l'échelle */
  function drawLits(r) {
    const n = r.n, X = r.LI.xs, ab = r.about, E = r.fer.long.epure, phi1 = r.mat.phi[0];
    const xmin = -ab - 1.2, xmax = X[n] + ab + 1.2, W = 1000, ml = 16, mr = 16;
    const K = (W - ml - mr) / (xmax - xmin), PX = x => ml + (x - xmin) * K, f2 = v => +v.toFixed(2);
    const bars0 = sens => {
      const out = [];
      for (const ent of (E[sens] || [])) for (const gr of ent.groupes) {
        const mT = /TRAVEE\s+(\d+)/.exec(gr.lab), mA = /APPUI\s+(\d+)/.exec(gr.lab);
        for (const f of gr.fers) {
          let x0, x1;
          if (mA) { const k = +mA[1]; x0 = X[k - 2] + f.o; x1 = X[k - 1] + f.x; } else if (mT) { const i = +mT[1] - 1; x0 = X[i] + f.o; x1 = X[i] + f.x; } else continue;
          const lab = `${f.nom} ${f.j}`, det = `${f.nb} HA${Math.round(f.phi * 1000)} L=${fmt(f.len, 2)}`;
          const cw = 5.6, full = (lab.length + det.length + 1) * cw, short = lab.length * cw, px0 = PX(x0), px1 = PX(x1);
          const txt = (px1 - px0) >= full + 6 ? lab + ' ' + det : lab, tw = txt.length * cw, cx = (px0 + px1) / 2;
          out.push({ x0, x1, px0, px1, oStar: f.oStar, xStar: f.xStar, princ: Math.abs(f.phi - phi1) < 1e-6, txt, l: Math.min(px0, cx - tw / 2) - 4, r: Math.max(px1, cx + tw / 2) + 4, cx });
          void short;
        }
      }
      out.sort((a, b) => a.l - b.l);
      const rows = [];
      for (const bb of out) { let k = rows.findIndex(e => e <= bb.l); if (k < 0) { rows.push(0); k = rows.length - 1; } rows[k] = bb.r; bb.row = k; }
      return { list: out, nr: rows.length };
    };
    const S = bars0('sup'), I = bars0('inf'), RH = 17, band = 16;
    const yS0 = 30 + S.nr * RH, yBand = yS0 + 10, yI0 = yBand + band + 14, H = yI0 + I.nr * RH + 46;
    const o = [`<svg class="ot-chart" viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg">`];
    // tablier (épaisseur non à l'échelle) et appuis
    o.push(`<rect x="${f2(PX(-ab))}" y="${yBand}" width="${f2((X[n] + 2 * ab) * K)}" height="${band}" fill="#e9e3d6" stroke="#5d5545" stroke-width="1"/>`);
    for (let k = 0; k <= n; k++) {
      const x = f2(PX(X[k]));
      o.push(`<line x1="${x}" x2="${x}" y1="${18}" y2="${H - 30}" class="mk"/>`);
      o.push(`<polygon points="${x},${yBand + band} ${x - 7},${yBand + band + 10} ${x + 7},${yBand + band + 10}" fill="#d9d1c0" stroke="#5d5545" stroke-width="1"/>`);
      o.push(`<text x="${x}" y="${12}" class="mkl">APPUI ${k + 1}</text>`);
    }
    for (let i = 0; i < n; i++) o.push(`<text x="${f2(PX((X[i] + X[i + 1]) / 2))}" y="${f2(yBand + band / 2 + 1)}" style="font-size:10px;text-anchor:middle;dominant-baseline:middle">TRAVEE ${i + 1} — ${fmt(r.L[i], 2)} M</text>`);
    const draw = (B, y0, dir, colP) => {
      for (const bb of B.list) {
        const y = f2(y0 - dir * bb.row * RH), c = bb.princ ? colP : '#7a7e8e', w = bb.princ ? 2.4 : 1.4;
        o.push(`<line x1="${f2(bb.px0)}" x2="${f2(bb.px1)}" y1="${y}" y2="${y}" stroke="${c}" stroke-width="${w}"/>`);
        for (const [px, st] of [[bb.px0, bb.oStar], [bb.px1, bb.xStar]]) o.push(`<line x1="${f2(px)}" x2="${f2(px)}" y1="${f2(y - 3)}" y2="${f2(y + 3)}" stroke="${c}" stroke-width="${st ? 2.4 : 1}"/>`);
        o.push(`<text x="${f2(bb.cx)}" y="${f2(y - 4)}" style="font-size:9.5px;text-anchor:middle;fill:${c}">${esc(bb.txt)}</text>`);
      }
    };
    draw(S, yS0, 1, '#c0392b'); draw(I, yI0 + 10, -1, '#1a4fd6');
    o.push(`<text x="${ml}" y="${f2(yS0 - S.nr * RH + 2)}" style="font-size:10px;font-weight:700">NAPPE SUPERIEURE</text>`);
    o.push(`<text x="${ml}" y="${f2(yI0 + 10 + (I.nr - 1) * RH + 16)}" style="font-size:10px;font-weight:700">NAPPE INFERIEURE</text>`);
    // échelle des abscisses
    const yA = H - 20; o.push(`<line x1="${f2(PX(X[0]))}" x2="${f2(PX(X[n]))}" y1="${yA}" y2="${yA}" class="z"/>`);
    for (let x = 0; x <= X[n] + 1e-6; x += (X[n] > 60 ? 10 : 5)) o.push(`<line x1="${f2(PX(x))}" x2="${f2(PX(x))}" y1="${yA - 3}" y2="${yA + 3}" class="z"/><text x="${f2(PX(x))}" y="${yA + 13}" class="xl">${fmt(x, 0)}</text>`);
    o.push('</svg>'); return o.join('');
  }

  /* appareil d'appui en plan (à l'échelle) avec les contours d'espacement maximal des étriers (poinçonnement) */
  function drawApp(r, k) {
    const a = r.fer.appareils[k], pc = r.fer.poincon, P0 = pc.ap[k], g = pc.gam;
    const la = a.larg / 2, lo = a.long / 2;
    let RL = la, RT = lo; P0.dist.forEach(dd => { if (dd) { RL = Math.max(RL, dd[0]); RT = Math.max(RT, dd[1]); } });
    const d = G.OTUI.svg({ x0: -RL - 0.25, y0: -RT - 0.22, x1: RL + 0.45, y1: RT + 0.22 }, { pad: 0.05 });
    const ring = (hx, hy, rr, cls, sty) => d.raw(`<rect x="${+(-hx).toFixed(4)}" y="${+(-hy).toFixed(4)}" width="${+(2 * hx).toFixed(4)}" height="${+(2 * hy).toFixed(4)}" rx="${+rr.toFixed(4)}" fill="none" class="${cls}"${sty ? ` style="${sty}"` : ''} vector-effect="non-scaling-stroke"/>`);
    let alt = 0;
    P0.dist.forEach((dd, j) => {
      if (!dd) return;
      const off = Math.max(0, Math.min(dd[0] - la, dd[1] - lo));
      ring(dd[0], dd[1], off, 'l', 'stroke:#1a4fd6;stroke-dasharray:4 3');
      const side = (alt++) % 2 ? -1 : 1;
      d.text(dd[0] - 0.012, side * lo * 0.55, fmt(g[j], 2), { size: 0.6, cls: 'dv', rot: 90, base: 'auto' });
    });
    d.rect(-la, -lo, 2 * la, 2 * lo, 'b2');
    d.line(-RL - 0.2, 0, RL + 0.2, 0, 'ax'); d.line(0, -RT - 0.15, 0, RT + 0.15, 'ax');
    d.dim(-la, -lo, la, -lo, fmt(a.larg, 2), -0.06, null, { size: 0.65 });
    d.dim(-la, lo, -la, -lo, fmt(a.long, 2), -0.06, null, { size: 0.65 });
    d.text(RL + 0.42, -RT - 0.12, 'sens longitudinal (axe) →', { size: 0.6, cls: 'ts', a: 'end' });
    d.text(-RL - 0.22, RT + 0.1, '↑ sens transversal (ligne d\'appui)', { size: 0.6, cls: 'ts', a: 'start' });
    return d.toString();
  }

  /* section transversale avec les fibres étudiées en flexion transversale */
  function drawFibres(m, F) {
    const S = sectionOf(m), { H1, H2, H3, xa, xb, xc } = S;
    const d = G.OTUI.svg({ x0: -xc - 0.3, y0: -0.95, x1: xc + 0.3, y1: H1 + 0.45 }, { pad: 0.03 });
    const R = [[xa, 0], [xb > xa ? xb : xa, H3], ...(xc > xb ? [[xc, H1 - H2]] : []), [xc, H1]];
    const full = [...R.slice().reverse().map(p => [-p[0], p[1]]), ...R];
    d.poly(full, 'b'); d.line(0, -0.5, 0, H1 + 0.4, 'ax');
    let j = 0;
    for (const fb of F) {
      const x = fb.y; rline(d, x, -0.1, x, H1 + 0.18, 1.4);
      d.text(x, H1 + 0.32, 'F' + fb.n, { size: 0.8, cls: 'tc hl' });
      if (Math.abs(x) > 1e-6) { const yy = -0.12 - 0.22 * j++; d.dim(0, yy, x, yy, fmt(Math.abs(x), 2), 0, null, { size: 0.7 }); }
    }
    d.text(0, -0.85, 'largeur droite ' + fmt(S.W, 2) + ' m — fibres repérées par rapport à l\'axe mécanique', { size: 0.7, cls: 'ts' });
    return d.toString();
  }

  const FCACHE = new WeakMap();
  function figures(m, r, pages) {
    const c = FCACHE.get(r); if (c && c.np === pages.length && c.m === m) return c.out;
    let out = []; try { out = buildFigures(m, r, pages); } catch (e) { console.error(e); out = []; }
    FCACHE.set(r, { np: pages.length, m, out }); return out;
  }

  function buildFigures(m, r, pages) {
    const N = pages.length, O = G.OTUI;
    const isHead = p => /^\s*PSIDAEL\b/.test(p);
    const endOf = i => { let j = i; while (j + 1 < N && !isHead(pages[j + 1])) j++; return j; };
    const first = re => pages.findIndex(p => re.test(p));
    const last = re => { for (let i = N - 1; i >= 0; i--) if (re.test(pages[i])) return i; return -1; };
    const pl = [];
    const add = (i, title, sub, body, cap) => { if (i >= 0 && body) pl.push({ i: endOf(i), title, sub, body, cap }); };
    const n = r.n, L = r.L, X = r.LI ? r.LI.xs : [0].concat(L.map((_, i) => L.slice(0, i + 1).reduce((p, q) => p + q, 0)));
    const marks = X.map((x, k) => ({ x, label: 'A' + (k + 1) }));
    const xlab = 'abscisse cumulée depuis l\'appui 1 (m)';
    const symL = L.every((l, i) => Math.abs(l - L[n - 1 - i]) < 1e-9), nPrint = symL ? Math.ceil(n / 2) : n;
    const pageNo = i => { const mm = /PAGE\s+(\d+)/.exec(pages[endOf(i)]) || /PAGE\s+(\d+)/.exec(pages[i]); return mm ? +mm[1] : null; };
    const bg = r.biais;

    /* 1 — ouvrage à l'échelle */
    {
      const i = first(/CARACTERISTIQUES PRINCIPALES DE L'OUVRAGE/);
      let ib = 0;
      const elev = drawElev(O.svg, m, false, 'app', (d, g) => { ib = cutMarks(d, g); });
      const pr = r.profil || [];
      const t = tbl(['Largeurs (m)', 'valeur'], [
        ['trottoir gauche ETROTG', nf(pr[0], 3)], ['bande dérasée G  EGAU', nf(pr[1], 3)], ['largeur chargeable ESURCH', nf(pr[2], 3)],
        ['bande dérasée D  EDROI', nf(pr[3], 3)], ['trottoir droit ETROTD', nf(pr[4], 3)], ['largeur roulable', nf((pr[1] || 0) + (pr[2] || 0) + (pr[3] || 0), 3)],
        ['largeur chargeable retenue', nf(r.Lch, 3)], ['voies × largeur', `${r.nvoies} × ${nf(r.v, 3)}`],
        ['largeur totale du profil', nf(r.largeurTotale, 3)], ['largeur droite de la dalle', nf(r._A7 ? r._A7.EDALLE1 + r._A7.EDALLE2 + r._A7.EDALLE3 : NaN, 3)], ['dalle équivalente H × E', `${nf(r.section.H, 3)} × ${nf(r.section.Eeq, 3)}`], ['inertie (m4)', nf(r.section.I, 6)]]);
      add(i, 'OUVRAGE À L\'ÉCHELLE (COUPE LONGITUDINALE, VUE EN PLAN, COUPE TRANSVERSALE)',
        `${n} travée${n > 1 ? 's' : ''} ${L.map(x => fmt(x, 2)).join(' + ')} m · longueur totale ${fmt(r.longueurTotale, 2)} m · biais ${fmt(bg, 1)} gr`,
        box('COUPE A-A SUIVANT L\'AXE DE L\'OUVRAGE (PORTÉES BIAISES) ET VUE EN PLAN', fsz(elev, 0.62), true,
          `A-A : coupe longitudinale suivant l'axe de la voie portée, vue depuis la droite de la voie (appui 1 à gauche). B-B : coupe droite perpendiculaire à l'axe, au milieu de la travée ${ib + 1}, vue dans le sens de l'axe (appui 1 → appui ${n + 1}). ${bg < 99.999 ? `Toutes les lignes d'appui sont parallèles (biais géométrique ${fmt(bg, 1)} gr).` : 'Pont droit (100 gr).'} Hauteur des appuis non fournie par le bordereau : représentée schématiquement.`)
        + pair(box('COUPE B-B — PROFIL EN TRAVERS ET SECTION DE LA DALLE', drawCoupe(O.svg, m, false), false, 'Vue dans le sens de l\'axe : le trottoir gauche (ETROTG) est à gauche. Largeurs droites (perpendiculaires à l\'axe).'),
          box('COUPE B-B — CHARGES APPLIQUÉES ET VOIES', drawCoupe(O.svg, m, false, 'loads') + t, false)),
        'Dessins à l\'échelle (cotes en m) établis à partir des données de la page ' + (pageNo(i) || 1) + '.');
    }

    /* 2 — lignes d'influence */
    if (r.LI && r.LI.momentLI) {
      const i = first(/EQUATIONS DES LIGNES D INFLUENCE DES REACTIONS D APPUIS/);
      const NS = 40, xg = [], loc = [];
      for (let s = 0; s < n; s++) for (let j = 0; j <= NS; j++) { xg.push(X[s] + L[s] * j / NS); loc.push([s, j / NS]); }
      const cub = (c, x) => ((c[0] * x + c[1]) * x + c[2]) * x;
      const sM = [];
      for (let t = 0; t < n; t++) { const cols = r.LI.momentLI(t, 0.5); sM.push({ name: `0.50L T${t + 1}`, cls: CYC[t % 6], y: loc.map(([s, x]) => r.LI.evalM(cols, t, 0.5, s, x)) }); }
      const sA = [];
      for (let k = 1; k < n; k++) sA.push({ name: `appui ${k + 1}`, cls: CYC[(k - 1) % 6], y: loc.map(([s, x]) => cub(r.LI.SL[k][s], x) + (r.LI.SL[k][s][3] || 0)) });
      const sR = [];
      for (let k = 0; k <= n; k++) sR.push({ name: `R${k + 1}`, cls: CYC[k % 6], y: loc.map(([s, x]) => { const c = r.LI.R[k][s]; return cub(c, x) + (c[3] || 0); }) });
      let body = box('MOMENT FLÉCHISSANT À MI-TRAVÉE (0.50 L) — ORDONNÉES EN T·M POUR UNE FORCE DE 1 T', chartW({ x: xg, series: sM, down: true, xticks: X, marks, xlab, ylab: 'M (t·m / t)', h: 300 }), true);
      body += pair(sA.length ? box('MOMENTS SUR APPUIS', chartW({ x: xg, series: sA, down: true, xticks: X, marks, xlab, ylab: 'M (t·m / t)' }, true), false) : '',
        box('RÉACTIONS D\'APPUI', chartW({ x: xg, series: sR, xticks: X, marks, xlab, ylab: 'R (t / t)' }, true), false));
      add(i, 'LIGNES D\'INFLUENCE (POUTRE CONTINUE À INERTIE CONSTANTE)', 'convention : moments positifs (fibre inférieure tendue) portés vers le bas', body,
        'Ordonnées des lignes d\'influence évaluées à partir des cubiques imprimées (force unitaire se déplaçant sur les travées, abouts non représentés).');
    }

    /* 3 — enveloppes des moments longitudinaux */
    if (r.moments) {
      const i = Math.max(last(/POSITIONS DES SURCHARGES CORRESPONDANT AUX MOMENTS/), last(/MOMENTS FLECHISSANTS ET SECTIONS D'ACIER/));
      const S = []; r.moments.forEach((ss, t) => ss.forEach(s => S.push({ X: s.x, s, t })));   // abscisses cumulées du listing
      const x = S.map(p => p.X), g = k => S.map(p => k(p.s));
      const els = chartW({ x, xticks: X, marks, xlab, ylab: 'M (t·m)', down: true, fill: [[0, 1]],
        series: [{ y: g(s => s.els.max), name: 'ELS max', cls: 'mx' }, { y: g(s => s.els.min), name: 'ELS min', cls: 'mn' },
          { y: g(s => pick(s.G.up, s.G.dn)), name: 'charge permanente', cls: 'perm', dash: true }] });
      const elu = chartW({ x, xticks: X, marks, xlab, ylab: 'M (t·m)', down: true, h: 300, fill: [[0, 1]],
        series: [{ y: g(s => s.elu.max), name: 'ELU max', cls: 'mx' }, { y: g(s => s.elu.min), name: 'ELU min', cls: 'mn' }] });
      const rows = [];
      const rowOf = (lab, xx, s) => [lab, nf(xx, 3), nf(pick(s.G.up, s.G.dn), 2), nf(s.els.max, 2), nf(s.els.min, 2), nf(s.elu.max, 2), nf(s.elu.min, 2)];
      for (let t = 0; t < n; t++) {
        const ss = r.moments[t];
        if (t === 0) rows.push(rowOf('APPUI 1', ss[0].x, ss[0]));
        const mid = ss.find(s => Math.abs(s.a - 0.5) < 1e-9); if (mid) rows.push(rowOf(`TRAVEE ${t + 1}  0.50L`, mid.x, mid));
        let im = 0; ss.forEach((s, j) => { if (s.elu.max > ss[im].elu.max) im = j; });
        if (Math.abs(ss[im].a - 0.5) > 1e-9) rows.push(rowOf(`TRAVEE ${t + 1}  ${fmt(ss[im].a, 2)}L (max ELU)`, ss[im].x, ss[im]));
        rows.push(rowOf(`APPUI ${t + 2}`, ss[ss.length - 1].x, ss[ss.length - 1]));
      }
      add(i, 'ENVELOPPES DES MOMENTS FLÉCHISSANTS LONGITUDINAUX (TOUTES TRAVÉES)', 'moments pour la largeur totale (t·m) — positifs vers le bas',
        box('E.L.S. — ENVELOPPE MAX / MIN ET PART PERMANENTE', els, true) + box('E.L.U. — ENVELOPPE MAX / MIN', elu, true)
        + box('SECTIONS REMARQUABLES (T·M)', tbl(['section', 'abscisse', 'charge perm.', 'ELS max', 'ELS min', 'ELU max', 'ELU min'], rows), true),
        'Valeurs des tableaux « MOMENTS FLECHISSANTS ET SECTIONS D\'ACIER » (sections 0 à 1.00 L de chaque travée)' + (nPrint < n ? ' ; les travées symétriques non imprimées sont tracées d\'après le calcul.' : '.'));
    }

    /* 4 — déformations */
    if (r.deformations) {
      const i = last(/DEFORMATION DU TABLIER - TRAVEE/);
      const x = [], fi = [], ff = [];
      r.deformations.forEach((D, t) => D.fl.forEach(row => { x.push(X[t] + row[0] * L[t]); fi.push(row[1]); ff.push(row[2]); }));
      add(i, 'DÉFORMÉE DU TABLIER SOUS CHARGE PERMANENTE', 'flèches en millimètres',
        box('FLÈCHES INSTANTANÉE ET FINALE (MM)', chartW({ x, xticks: X, marks, xlab, ylab: 'flèche (mm)', h: 260,
          series: [{ y: fi, name: 'instantanée (EI)', cls: 's2' }, { y: ff, name: 'finale (EV)', cls: 'mx' }] }), true), 'Colonnes « CHARGE PERMANENTE INSTANT / FINALE » des pages DEFORMATION DU TABLIER.');
    }

    /* 5 — efforts tranchants */
    if (r.effortsTranchants) {
      const i = first(/PSIDAEL\s+\S+\s+EFFORTS TRANCHANTS SUR APPUIS/);
      const A = [0, 0.25, 0.5, 0.75, 1], x = [], V = [];
      for (let t = 0; t < n; t++) for (const a of A) {
        const v = a === 0 ? r.effortsTranchants[t][0] : a === 1 ? r.effortsTranchants[t][1] : (r.shearAt ? r.shearAt(t, a) : null);
        if (v) { x.push(X[t] + a * L[t]); V.push(v); }
      }
      const g = k => V.map(k);
      const rows = [];
      for (let t = 0; t < n; t++) r.effortsTranchants[t].forEach((v, j) => rows.push([`TRAVEE ${t + 1} ${j ? 'côté droit' : 'côté gauche'}`, nf(pick(v.G.up, v.G.dn), 1), nf(v.els.max, 1), nf(v.els.min, 1), nf(v.elu.max, 1), nf(v.elu.min, 1)]));
      add(i, 'ENVELOPPE DES EFFORTS TRANCHANTS', 'efforts tranchants pour la largeur totale (t)',
        box('E.L.S. ET E.L.U. — ENVELOPPES MAX / MIN', chartW({ x, xticks: X, marks, xlab, ylab: 'V (t)', fill: [[0, 1]],
          series: [{ y: g(v => v.elu.max), name: 'ELU max', cls: 'mx' }, { y: g(v => v.elu.min), name: 'ELU min', cls: 'mn' },
            { y: g(v => v.els.max), name: 'ELS max', cls: 'mx', dash: true }, { y: g(v => v.els.min), name: 'ELS min', cls: 'mn', dash: true },
            { y: g(v => pick(v.G.up, v.G.dn)), name: 'charge permanente', cls: 'perm', dash: true }] }), true)
        + box('VALEURS SUR APPUIS (T)', tbl(['section', 'charge perm.', 'ELS max', 'ELS min', 'ELU max', 'ELU min'], rows), true),
        'Valeurs sur appuis : page EFFORTS TRANCHANTS SUR APPUIS ; valeurs intermédiaires (0.25 L, 0.50 L, 0.75 L) calculées par le moteur avec les mêmes lignes d\'influence et combinaisons.');
    }

    /* 6 — réactions d'appui */
    if (r.reactions) {
      const i = first(/PSIDAEL\s+\S+\s+REACTIONS D APPUIS/);
      const R = r.reactions, grp = R.map(x => 'APPUI ' + (x.k + 1));
      add(i, 'RÉACTIONS D\'APPUI PAR LIGNE D\'APPUI', 'réactions globales pour la largeur totale (t), sans majoration dynamique ni tassements',
        box('RÉACTIONS EXTRÊMES (T)', bars({ groups: grp, ylab: 'R (t)', h: 320, series: [
          { name: 'charge perm. max', cls: 'perm', v: R.map(x => x.G.up) }, { name: 'ELS max', cls: 's1', v: R.map(x => x.els.max) }, { name: 'ELS min', cls: 's2', v: R.map(x => x.els.min) },
          { name: 'ELU max', cls: 'mx', v: R.map(x => x.elu.max) }, { name: 'ELU min', cls: 'mn', v: R.map(x => x.elu.min) }] }), true),
        'Valeurs de la page REACTIONS D APPUIS' + (symL ? ' (ouvrage symétrique : appuis symétriques complétés)' : '') + '.');
    }

    /* 7 — flexion transversale */
    if (r.flexT && r.flexT.some(F => F.my)) {
      const i = last(/MOMENTS PRINCIPAUX DE FLEXION TRANSVERSALE/);
      const parts = [];
      const F0 = r.flexT.find(F => F.my);
      parts.push(box('POSITION DES FIBRES ÉTUDIÉES (PAR RAPPORT À L\'AXE MÉCANIQUE)', fsz(drawFibres(m, F0.my.map(y => ({ n: y.n, y: (F0.fibres.find(f => f.n === y.n) || {}).y || 0 }))), 1.3), false));
      for (let t = 0; t < Math.min(nPrint, r.flexT.length); t++) {
        const F = r.flexT[t]; if (!F.my) continue;
        const pos = F.my.map(y => (F.fibres.find(f => f.n === y.n) || {}).y);
        parts.push(box(`TRAVÉE ${t + 1} — MY À MI-TRAVÉE (T·M/M), POISSON ${fmt(r.mat.poisson, 2)}`, bars({ w: 660, groups: F.my.map((y, j) => `F${y.n} (${isFinite(pos[j]) ? fmt(pos[j], 2) : '?'} m)`), ylab: 'My (t·m/m)', h: 300, series: [
          { name: 'CP max', cls: 'perm', v: F.my.map(y => y.cp.max) }, { name: 'ELS max', cls: 's1', v: F.my.map(y => y.els.max) }, { name: 'ELS min', cls: 's2', v: F.my.map(y => y.els.min) },
          { name: 'ELU max', cls: 'mx', v: F.my.map(y => y.elu.max) }, { name: 'ELU min', cls: 'mn', v: F.my.map(y => y.elu.min) }] }), false));
      }
      const body = pair(...parts);
      add(i, 'MOMENTS DE FLEXION TRANSVERSALE EN SECTION MÉDIANE', 'moments principaux My par mètre de largeur (positifs : fibre inférieure tendue)', body,
        'Valeurs des tableaux « MOMENTS PRINCIPAUX DE FLEXION TRANSVERSALE » (coefficient de Poisson des données)' + (nPrint < n ? ' ; travées symétriques non répétées.' : '.'));
    }

    /* 8 — ferraillage longitudinal (lits et arrêts de barres) */
    if (r.fer && r.fer.long && r.fer.long.epure) {
      const i = last(/FERRAILLAGE LONGITUDINAL RETENU/);
      const F = r.fer.long;
      add(i, 'FERRAILLAGE LONGITUDINAL — LITS ET ARRÊTS DE BARRES SUR L\'ÉLÉVATION', `groupes de ${F.N1} barres HA${Math.round(r.mat.phi[0] * 1000)} espacés de ${fmt(F.s, 3)} m · recouvrement ${fmt(F.ls, 2)} m`,
        box('ÉPURE RETENUE (UNE POUTRE ÉLÉMENTAIRE DE ' + (r._A11 && r._A11.N2 ? r._A11.N2 : 3) + ' GROUPES)', drawLits(r), true),
        'Abscisses horizontales à l\'échelle (appui 1 = 0) ; épaisseur de la dalle et écartement des lits non à l\'échelle. Trait épais : diamètre principal PHI1 (rouge : nappe supérieure, bleu : nappe inférieure) ; gris : autres diamètres. Repère, nombre de barres et longueur comme dans les tableaux ; tiret épais d\'extrémité : fer ancré hors de la travée (abscisse marquée *).');
    }

    /* 9 — appareils d'appui et étriers aux environs des appuis concentrés */
    if (r.fer && r.fer.poincon && r.fer.appareils && r.fer.poincon.ap) {
      const i = first(/POINTS D'APPUI CONCENTRES/);
      const AP = r.fer.appareils, PC = r.fer.poincon;
      const ks = [0]; let kmax = -1; for (let k = 1; k < n; k++) if (kmax < 0 || PC.ap[k].tau > PC.ap[kmax].tau) kmax = k; if (kmax > 0) ks.push(kmax);
      const parts = [];
      for (const k of ks) parts.push(box(`APPUI ${k + 1} — APPAREIL ${fmt(AP[k].larg, 2)} × ${fmt(AP[k].long, 2)} M ET CONTOURS D'ESPACEMENT MAXIMAL DES ÉTRIERS`, fsz(drawApp(r, k), 0.95), false,
        `Au voisinage immédiat : cisaillement ${fmt(PC.ap[k].tau, 2)} t/m², espacement ${fmt(PC.ap[k].s, 2)} m. Contours (tirets) : distance au centre de l'appareil au-delà de laquelle l'espacement indiqué suffit (chiffres : espacement maximal des cours d'étriers, m).`));
      let body = pair(...parts);
      body += box('APPAREILS D\'APPUI PAR LIGNE', tbl(['appui', 'nombre', 'espacement (m)', 'largeur × longueur (m)', 'R max / appareil (t)', 'σ max (t/m²)', 'τ max (t/m²)', 'esp. étriers (m)'],
        AP.map((a, k) => [`APPUI ${k + 1}`, a.nap, nf(a.esp, 3), `${nf(a.larg, 3)} × ${nf(a.long, 3)}`, nf(a.chMax, 2), nf(a.cMax, 2), nf(PC.ap[k] && PC.ap[k].tau, 2), nf(PC.ap[k] && PC.ap[k].s, 2)])), true);
      add(i, 'APPAREILS D\'APPUI — ÉTRIERS AUX ENVIRONS DES APPUIS CONCENTRÉS', `DENCHA = ${fmt(PC.D, 3)}`, body,
        'Appareils dessinés à l\'échelle, largeur suivant l\'axe de l\'ouvrage, longueur suivant la ligne d\'appui. Distances de la page « REPARTITION DES ARMATURES DE CISAILLEMENT … AUX ENVIRONS DES POINTS D\'APPUI CONCENTRES ».');
    }

    pl.sort((a, b) => a.i - b.i);
    return pl.map((p, k) => ({ after: p.i, html: O.figPage(`PLANCHE ${k + 1} — ${p.title}`, p.sub, STY + p.body, p.cap) }));
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
    m.titre = ['', '']; m.numero = '0001'; allOn(m); m.date = null;
    delete m.source; delete m.version;
    return m;
  }

  /* la note donne tout systématiquement : tous les calculs (A3) et toutes les impressions détaillées (A4) ; répartition par Guyon (EXCENTR = 1) */
  function allOn(m) {
    const A3 = m.lignes.A3, A4 = m.lignes.A4 || (m.lignes.A4 = {});
    A3.EXCENTR = 1; A3.LIGNINF = 2; for (const c of [...A3G1, ...A3G2]) A3[c] = 1;   // épaisseur HDALLE1 toujours conservée (pas d'optimisation)
    if (m.lignes.A8) { const a = String(m.lignes.A8.A).padStart(3, '0'), b = String(m.lignes.A8.B).padStart(3, '0');
      if (a !== '000') m.lignes.A8.A = '001'; if (!['000', '002', '003'].includes(b)) m.lignes.A8.B = '001'; }   // A(l) réglementaire ; Bc et Bt selon les cases
    if (m.lignes.A6) { const A6 = m.lignes.A6; for (let i = 2; i <= 5; i++) A6['YY' + i] = 0;   // fibres exceptionnelles : jamais utilisées
      A6.NF = 3; A6.DISEXT = 0; A6.DISINT = 0;                                                     // toutes les fibres ; axe mécanique = axe géométrique
      A6.SYMTAB = Math.abs((A6.ETROTG || 0) - (A6.ETROTD || 0)) < 1e-6 && Math.abs((A6.EGAU || 0) - (A6.EDROI || 0)) < 1e-6 ? 1 : 0; }   // symétrie déduite du profil
    if (m.lignes.A9) { m.lignes.A9.BA = '000'; m.lignes.A9.XKI = 0; }   // coefficients BAEL réglementaires, ψ1 = 0
    const A10 = m.lignes.A10; if (A10) { for (let i = 1; i <= 4; i++) { A10['NA' + i] = 0; A10['ETA' + i] = 1.6; } A10.PSID = 1.5; }   // aciers HA, valeurs BAEL (palier, η = 1,6, ψs = 1,5)
    const A13 = m.lignes.A13, nt = +(m.lignes.A5 && m.lignes.A5.NT) || 0; if (A13) for (let i = 1; i <= 7; i++) A13['TYPAP' + i] = i <= nt + 1 ? 1 : 0;
    // cases masquées au-delà de NT (portées) et de NT + 1 (appuis) : 0, comme le demande le bordereau
    for (let i = nt + 1; i <= 6; i++) if (m.lignes.A5) m.lignes.A5['D' + i] = 0;
    for (let i = nt + 2; i <= 7; i++) { if (A13) A13['NAP' + i] = 0; if (m.lignes.A12) { m.lignes.A12['TP' + i] = 0; m.lignes.A12['DTP' + i] = 0; } }   // appareils toujours en élastomère fretté
    for (const c of ['LIGNINF', 'EXCENTR', 'TASMENT', ...A3G1, ...A3G2]) A4[c] = 1;
  }
  /* moteur : la note attend une date {j, m, a} */
  const engine = {
    parseBordereau: t => E.parseBordereau(t),
    formatBordereau: m => E.formatBordereau(m),
    compute: m => { allOn(m); return E.compute(m); },   // répartition transversale : toujours Guyon-Massonnet (EXCENTR = 1)
    renderNote: (m, r, o) => {
      o = Object.assign({}, o);
      if (typeof o.date === 'string') { const p = o.date.split(/[-/.]/); o.date = { j: p[0], m: p[1], a: p[2] }; }
      return E.renderNote(m, r, o);
    },
  };

  G.PSIDA_UI = {
    prog: 'PSIDA-EL', engine, steps, get, set, checks, summary, blank,
    pairs: true, onePage: true, rows: true, simpleBar: true, schemaModel: () => gen(),   // à gauche le schéma SETRA coté par les paramètres, à droite l'ouvrage saisi à l'échelle
    numero: m => m.numero || '0001',
    examples: [{ label: '3 travées 12,5 + 16 + 12,5 m, pont droit', text: EX1 }, { label: '2 travées 15 + 15 m, pont droit', text: EX2 }],
    views: [
      { id: 'elev', label: 'Élévation', draw: (svg, m) => drawElev(svg, m, false, 'app') },
      { id: 'coupe', label: 'Coupe transversale', draw: (svg, m) => drawCoupe(svg, m, false) },
      { id: 'plan', label: 'Vue en plan', draw: (svg, m) => drawPlan(svg, m, false) },
      { id: 'arm', label: 'Armatures', draw: (svg, m) => drawArm(svg, m, false) },
    ],
    figures,
    _draw: { drawElev, drawCoupe, drawPlan, drawArm },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
