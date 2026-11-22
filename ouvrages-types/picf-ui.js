/* PICF-EL — définition de la saisie guidée (cadre fermé en béton armé, BAEL 91, fasc. 61 titre II) */
(function (G) {
  'use strict';
  const { fmt, num } = G.OTUI;
  const E = G.PICF;

  /* ───── accès au modèle (clés « CARTE.VARIABLE ») ───── */
  const get = (m, k) => k === 'TITRE1' ? (m.titre || [])[0] || '' : k === 'TITRE2' ? (m.titre || [])[1] || '' : k === 'TCOURT' ? m.titreCourt || '' : m[k];
  const set = (m, k, v) => {
    if (k === 'TITRE1' || k === 'TITRE2') { m.titre = (m.titre || ['', '']).slice(); m.titre[k === 'TITRE1' ? 0 : 1] = String(v).toUpperCase(); return; }
    if (k === 'TCOURT') { m.titreCourt = String(v).toUpperCase(); return; }
    m[k] = v;
    if (m.flags && m.flags[k] === '=') m.flags[k] = '';      // valeur saisie : plus une valeur par défaut
  };
  const V = (m, k) => { const x = num(m[k]); return isFinite(x) ? x : 0; };

  /* ───── listes ───── */
  const yes = (c, l) => [[c, l || c], ['', 'non']];
  const steps = [
    { id: 'id', label: 'Identification', view: 'coupe', hint: 'Titre de la note, options générales du calcul.', pages: [
      { label: 'Titre et options', groups: [
        { title: 'Titre de la note', flex: 3, cols: 3, fields: [
          { k: 'TITRE1', code: 'TITRE', label: 'ligne 1', type: 'txt', help: 'Première ligne du titre imprimé en tête de chaque page de la note (route, autoroute…).' },
          { k: 'TITRE2', code: 'TITRE', label: 'ligne 2', type: 'txt', help: 'Seconde ligne du titre (nature et numéro de l\'ouvrage).' },
          { k: 'TCOURT', code: 'REPÈRE', label: 'titre court', type: 'txt', help: 'Titre court rappelé en haut à gauche de chaque page (ex. PI 270).' },
        ] },
        { title: 'Options', alt: true, flex: 3, cols: 3, fields: [
          { k: 'FIX.FIXD', code: 'FIXD', label: 'épaisseurs', type: 'sel', opts: [[0, '0 — optimisées'], [1, '1 — imposées']], help: 'FIXD = 1 : les épaisseurs E1, E2, E3 sont imposées ; FIXD = 0 : le programme peut les optimiser.' },
          { k: 'FIX.DIRFER', code: 'DIRFER', label: 'direction des fers', type: 'sel', opts: [[1, '1 — // bords libres'], [2, '2 — // bords libres (biais)'], [3, '3 — // piédroits']], help: 'Direction des armatures. 1 : longitudinales parallèles aux bords libres, transversales parallèles aux piédroits ; 2 : les deux nappes parallèles aux bords libres ; 3 : longitudinales parallèles aux piédroits. Par défaut : 1 si le biais ≥ 70 gr.' },
          { k: 'FIX.DES', code: 'DES', label: 'dessin', type: 'sel', opts: [[0, '0 — non'], [1, '1 — oui']], help: 'Demande des planches de dessin automatique.' },
        ] },
      ] },
    ], schema: (svg, m) => drawCoupe(svg, GEN, true) },

    { id: 'geom', label: 'Géométrie', view: 'coupe', hint: 'Dimensions du cadre en section droite.', pages: [
      { label: 'Cadre', groups: [
        { title: 'Ouverture et hauteur', flex: 4, cols: 4, fields: [
          { k: 'GEOM.OUVER', code: 'OUVER', label: 'ouverture droite', unit: 'm', dec: 2, help: 'Ouverture droite intérieure, entre les faces internes des piédroits, mesurée perpendiculairement à ceux-ci.' },
          { k: 'GEOM.HAUTL', code: 'HAUTL', label: 'hauteur libre', unit: 'm', dec: 2, help: 'Hauteur libre intérieure, entre le dessus de la traverse inférieure et le dessous de la traverse supérieure.' },
          { k: 'GEOM.BIAIS', code: 'BIAIS', label: 'biais', unit: 'gr', dec: 3, help: 'Angle entre l\'axe de la voie portée et les piédroits, en grades (100 = droit). Domaine du programme : biais ≥ 50 gr.' },
          { k: 'GEOM.HREMB', code: 'HREMB', label: 'remblai intérieur', unit: 'm', dec: 2, help: 'Hauteur de remblai (ou de chaussée) reposant sur la traverse inférieure, à l\'intérieur du cadre.' },
        ] },
        { title: 'Épaisseurs', alt: true, flex: 3, cols: 3, fields: [
          { k: 'GEOM.E1', code: 'E1', label: 'traverse inf.', unit: 'm', dec: 2, help: 'Épaisseur de la traverse inférieure (radier).' },
          { k: 'GEOM.E2', code: 'E2', label: 'piédroits', unit: 'm', dec: 2, help: 'Épaisseur des piédroits, mesurée perpendiculairement à leur plan.' },
          { k: 'GEOM.E3', code: 'E3', label: 'traverse sup.', unit: 'm', dec: 2, help: 'Épaisseur de la traverse supérieure.' },
        ] },
        { title: 'Dalle de transition', flex: 1, cols: 1, fields: [
          { k: 'GEOM.LDALT', code: 'LDALT', label: 'longueur', unit: 'm', dec: 2, help: 'Portée droite des dalles de transition (0 s\'il n\'y en a pas).' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true) },

    { id: 'prof', label: 'Profil en travers', view: 'travers', hint: 'Voie portée par la traverse supérieure, de gauche à droite.', pages: [
      { label: 'Largeurs', groups: [
        { title: 'Profil en travers de la voie portée (de gauche à droite)', flex: 7, cols: 7, fields: [
          { k: 'PROF.ETROTG', code: 'ETROTG', label: 'trottoir G', unit: 'm', dec: 2, help: 'Largeur du trottoir (ou de la zone non chargeable) de gauche.' },
          { k: 'PROF.EGAU', code: 'EGAU', label: 'bande G', unit: 'm', dec: 2, help: 'Largeur de la bande dérasée ou zone neutre de gauche (non chargée par les camions).' },
          { k: 'PROF.ESURCH', code: 'ESURCH', label: 'chargeable', unit: 'm', dec: 2, help: 'Largeur chargeable de la chaussée (Fasc. 61 titre II).' },
          { k: 'PROF.EDROI', code: 'EDROI', label: 'bande D', unit: 'm', dec: 2, help: 'Largeur de la bande dérasée ou zone neutre de droite.' },
          { k: 'PROF.ETROTD', code: 'ETROTD', label: 'trottoir D', unit: 'm', dec: 2, help: 'Largeur du trottoir de droite.' },
          { k: 'PROF.LARGE', code: 'LARGE', label: 'largeur droite', unit: 'm', dec: 2, help: 'Largeur droite totale de l\'ouvrage (longueur du cadre, mesurée parallèlement aux piédroits). Normalement égale à la somme des cinq bandes.' },
          { k: 'PROF.NVOI', code: 'NVOI', label: 'nb de voies', type: 'int', help: 'Nombre de voies de circulation (Fasc. 61 : partie entière de ESURCH/3, si ESURCH ≥ 6 m).' },
        ] },
      ] },
      { label: 'Chaussée et remblai', groups: [
        { title: 'Chaussée et remblai sur la traverse', flex: 3, cols: 3, fields: [
          { k: 'PROF.HCHAU', code: 'HCHAU', label: 'épaisseur chaussée', unit: 'm', dec: 2, help: 'Épaisseur de la chaussée (couche de roulement et assises) sur la traverse supérieure.' },
          { k: 'PROF.HSREM', code: 'HSREM', label: 'remblai sur traverse', unit: 'm', dec: 2, help: 'Épaisseur de remblai entre le dessus de la traverse supérieure et le dessous de la chaussée, en service.' },
          { k: 'PROF.PTRAN', code: 'PTRAN', label: 'pente transversale', unit: '%', dec: 2, help: 'Pente transversale de la chaussée portée.' },
        ] },
      ] },
    ], schema: (svg) => drawTravers(svg, GEN, true) },

    { id: 'perm', label: 'Charges permanentes', view: 'coupe', hint: 'Valeurs caractéristiques minimales et maximales.', pages: [
      { label: 'Poids et poussées', groups: [
        { title: 'Masses volumiques', flex: 2, cols: 2, fields: [
          { k: 'PERM.MVBET', code: 'MVBET', label: 'béton', unit: 't/m³', dec: 2, help: 'Masse volumique du béton armé.', def: '2,50' },
          { k: 'PERM.MVSOL', code: 'MVSOL', label: 'sol / remblai', unit: 't/m³', dec: 2, help: 'Masse volumique des terres (poussée et remblai).', def: '2,00' },
        ] },
        { title: 'Coefficients de poussée de Rankine', alt: true, flex: 4, cols: 4, fields: [
          { k: 'PERM.RKGN', code: 'RKGN', label: 'gauche min', dec: 2, help: 'Coefficient de poussée minimal sur le piédroit de gauche.', def: '0,25' },
          { k: 'PERM.RKGX', code: 'RKGX', label: 'gauche max', dec: 2, help: 'Coefficient de poussée maximal sur le piédroit de gauche.', def: '0,50' },
          { k: 'PERM.RKDN', code: 'RKDN', label: 'droite min', dec: 2, help: 'Coefficient de poussée minimal sur le piédroit de droite.', def: '0,25' },
          { k: 'PERM.RKDX', code: 'RKDX', label: 'droite max', dec: 2, help: 'Coefficient de poussée maximal sur le piédroit de droite.', def: '0,50' },
        ] },
      ] },
      { label: 'Superstructures et dalle', groups: [
        { title: 'Superstructures', flex: 2, cols: 2, fields: [
          { k: 'PERM.QSUPN', code: 'QSUPN', label: 'min', unit: 't/m²', dec: 2, help: 'Poids minimal des superstructures (chaussée, étanchéité…) par m² de traverse.' },
          { k: 'PERM.QSUPX', code: 'QSUPX', label: 'max', unit: 't/m²', dec: 2, help: 'Poids maximal des superstructures par m² de traverse.' },
        ] },
        { title: 'Réaction de la dalle de transition', alt: true, flex: 2, cols: 2, fields: [
          { k: 'PERM.RDTN', code: 'RDTN', label: 'min', unit: 't', dec: 1, help: 'Réaction minimale de la dalle de transition sur le piédroit, sur toute la largeur.' },
          { k: 'PERM.RDTX', code: 'RDTX', label: 'max', unit: 't', dec: 1, help: 'Réaction maximale de la dalle de transition sur le piédroit, sur toute la largeur.' },
        ] },
        { title: 'Remblai sur la traverse', flex: 3, cols: 3, fields: [
          { k: 'PERM.QREMN', code: 'QREMN', label: 'min', unit: 't/m²', dec: 2, help: 'Poids minimal du remblai sur la traverse. Laisser la valeur calculée (=) pour appliquer l\'effet Marston.' },
          { k: 'PERM.QREMX', code: 'QREMX', label: 'max', unit: 't/m²', dec: 2, help: 'Poids maximal du remblai sur la traverse. Laisser la valeur calculée (=) pour appliquer l\'effet Marston.' },
          { k: 'PERM.R', code: 'R', label: 'coef. Marston', dec: 2, help: 'Coefficient R du calcul du poids du remblai avec effet Marston (1 = poids des terres sans effet de voûte).' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true) },

    { id: 'expl', label: 'Charges d\'exploitation', view: 'coupe', hint: 'Fascicule 61 titre II : systèmes A, B, militaires, convois exceptionnels.', pages: [
      { label: 'Systèmes de charges', groups: [
        { title: 'Charges routières', flex: 7, cols: 7, fields: [
          { k: 'CHARG.CL', code: 'CLASSE', label: 'du pont', type: 'sel', opts: [[1, '1re classe'], [2, '2e classe'], [3, '3e classe']], help: 'Classe du pont au sens du Fascicule 61 titre II.' },
          { k: 'CHARG.AL', code: 'AL', label: 'charge A(l)', type: 'sel', opts: yes('AL'), help: 'Prise en compte de la charge uniforme A(l).' },
          { k: 'CHARG.BC', code: 'BC', label: 'camions Bc', type: 'sel', opts: yes('BC'), help: 'Prise en compte du système Bc.' },
          { k: 'CHARG.BT', code: 'BT', label: 'tandem Bt', type: 'sel', opts: yes('BT'), help: 'Prise en compte du système Bt (ponts de 1re et 2e classe).' },
          { k: 'CHARG.MC', code: 'MC', label: 'char', type: 'sel', opts: [['MC120', 'Mc120'], ['MC80', 'Mc80'], ['', 'non']], help: 'Charge militaire à chenilles.' },
          { k: 'CHARG.ME', code: 'ME', label: 'essieux', type: 'sel', opts: [['ME120', 'Me120'], ['ME80', 'Me80'], ['', 'non']], help: 'Charge militaire à essieux.' },
          { k: 'CHARG.EX', code: 'EX', label: 'convoi', type: 'sel', opts: [['E', 'E'], ['D', 'D'], ['', 'non']], help: 'Convoi exceptionnel de type D (280 t) ou E (400 t).' },
        ] },
      ] },
      { label: 'Trottoirs et température', groups: [
        { title: 'Trottoirs et remblai', flex: 2, cols: 2, fields: [
          { k: 'CHARG.PTRO', code: 'PSTROT', label: 'charge trottoir', unit: 't/m²', dec: 2, help: 'Densité de charge sur les trottoirs (0 s\'il n\'y en a pas).' },
          { k: 'CHARG.PSREM', code: 'PSREMB', label: 'charge sur remblai', unit: 't/m²', dec: 1, help: 'Densité de charge sur le remblai d\'accès (poussée due aux charges sur le remblai).' },
        ] },
        { title: 'Température', alt: true, flex: 3, cols: 3, fields: [
          { k: 'CHARG.TE+', code: 'TEMP+', label: 'élévation', unit: '°C', dec: 0, help: 'Variation positive de température.', def: '30' },
          { k: 'CHARG.TE-', code: 'TEMP−', label: 'abaissement', unit: '°C', dec: 0, help: 'Variation négative de température.', def: '−40' },
          { k: 'CHARG.TER', code: 'TEMPR', label: 'rapide', unit: '°C', dec: 0, help: 'Part rapidement variable de la variation de température.', def: '10' },
        ] },
      ] },
      { label: 'Coefficients imposés', groups: [
        { title: 'Coefficients de répartition transversale (0 = calculés par le programme)', flex: 7, cols: 7, fields: [
          { k: 'K.KAL', code: 'KAL', label: 'A(l)', dec: 3, help: 'Coefficient de répartition transversale imposé pour A(l). 0 : calculé (Guyon-Massonnet).' },
          { k: 'K.KBC', code: 'KBC', label: 'Bc', dec: 3, help: 'Coefficient de répartition imposé pour Bc. 0 : calculé.' },
          { k: 'K.KBT', code: 'KBT', label: 'Bt', dec: 3, help: 'Coefficient de répartition imposé pour Bt. 0 : calculé.' },
          { k: 'K.KMC', code: 'KMC', label: 'Mc', dec: 3, help: 'Coefficient de répartition imposé pour le char. 0 : calculé.' },
          { k: 'K.KME', code: 'KME', label: 'Me', dec: 3, help: 'Coefficient de répartition imposé pour les essieux militaires. 0 : calculé.' },
          { k: 'K.KEX', code: 'KEX', label: 'convoi', dec: 3, help: 'Coefficient de répartition imposé pour le convoi exceptionnel. 0 : calculé.' },
          { k: 'K.KTR', code: 'KTROT', label: 'trottoir', dec: 3, help: 'Coefficient de répartition imposé pour la charge de trottoir. 0 : calculé.' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true, true) },

    { id: 'chant', label: 'Phase chantier', view: 'coupe', hint: 'Circulation d\'engins de chantier avant mise en place complète du remblai.', pages: [
      { label: 'Engin de chantier', groups: [
        { title: 'Engin de chantier', flex: 3, cols: 3, fields: [
          { k: 'EC.EC', code: 'EC', label: 'engin', type: 'sel', opts: [['EC34', 'EC34 (2 × 50 t)'], [0, 'aucun']], help: 'Engin de chantier circulant sur l\'ouvrage en phase de travaux (EC34 : 2 essieux de 50 t).' },
          { k: 'EC.EGAU', code: 'EGAU', label: 'bande G', unit: 'm', dec: 2, help: 'Largeur non chargeable à gauche en phase de chantier.' },
          { k: 'EC.ESURCH', code: 'ESURCH', label: 'chargeable', unit: 'm', dec: 2, help: 'Largeur chargeable en phase de chantier.' },
        ] },
        { title: 'Remblai en phase chantier', alt: true, flex: 6, cols: 6, fields: [
          { k: 'EC.HSREM', code: 'HSREM', label: 'remblai', unit: 'm', dec: 2, help: 'Épaisseur de remblai sur la traverse en phase de chantier.' },
          { k: 'EC.RDTN', code: 'RDTN', label: 'réact. dalle min', unit: 't', dec: 0, help: 'Réaction minimale de la dalle de transition en phase de chantier.' },
          { k: 'EC.RDTX', code: 'RDTX', label: 'réact. dalle max', unit: 't', dec: 0, help: 'Réaction maximale de la dalle de transition en phase de chantier.' },
          { k: 'EC.QREMN', code: 'QREMN', label: 'remblai min', unit: 't/m²', dec: 2, help: 'Poids minimal du remblai sur la traverse en phase de chantier.' },
          { k: 'EC.QREMX', code: 'QREMX', label: 'remblai max', unit: 't/m²', dec: 2, help: 'Poids maximal du remblai sur la traverse en phase de chantier.' },
          { k: 'EC.PSREM', code: 'PSREMB', label: 'charge remblai', unit: 't/m²', dec: 1, help: 'Charge sur le remblai d\'accès en phase de chantier.' },
        ] },
        { title: 'Répartition', flex: 1, cols: 1, fields: [
          { k: 'EC.KEC', code: 'KEC', label: 'coef. imposé', dec: 3, help: 'Coefficient de répartition transversale imposé pour l\'engin. 0 : calculé.' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true, true) },

    { id: 'mat', label: 'Matériaux', view: 'coupe', hint: 'Béton, sol de fondation et armatures (BAEL 91).', pages: [
      { label: 'Béton et sol', groups: [
        { title: 'Béton', flex: 4, cols: 4, fields: [
          { k: 'MAT.FCJ', code: 'FC28', label: 'résistance', unit: 'MPa', dec: 2, help: 'Résistance caractéristique du béton à 28 jours.' },
          { k: 'MAT.IFIS', code: 'FISS', label: 'fissuration', type: 'sel', opts: [['PP', 'peu préjudiciable'], ['P', 'préjudiciable'], ['TP', 'très préjudiciable']], help: 'Hypothèse de fissuration au sens du BAEL 91.' },
          { k: 'MAT.ENROBS', code: 'ENROBS', label: 'enrobage dessus', unit: 'm', dec: 3, help: 'Enrobage des armatures sur le dessus de la traverse supérieure.' },
          { k: 'MAT.ENROB', code: 'ENROB', label: 'autres enrobages', unit: 'm', dec: 3, help: 'Enrobage des autres armatures.' },
        ] },
        { title: 'Sol de fondation', alt: true, flex: 1, cols: 1, fields: [
          { k: 'MAT.ESOL', code: 'ESOL', label: 'module du sol', unit: 'MPa', dec: 2, help: 'Module d\'élasticité (pseudo-module différé) du sol sous la traverse inférieure, pour le calcul sur appui élastique.' },
        ] },
      ] },
      { label: 'Armatures', groups: [
        { title: 'Diamètres', flex: 3, cols: 3, fields: [
          { k: 'ACIER.PHI1', code: 'PHI1', label: 'principaux', unit: 'mm', type: 'int', help: 'Diamètre des aciers principaux.' },
          { k: 'ACIER.PHI2', code: 'PHI2', label: 'auxiliaires', unit: 'mm', type: 'int', help: 'Diamètre des aciers auxiliaires (répartition, continuité).' },
          { k: 'ACIER.PHI3', code: 'PHI3', label: 'étriers', unit: 'mm', type: 'int', help: 'Diamètre des étriers.' },
        ] },
        { title: 'Limites d\'élasticité', alt: true, flex: 3, cols: 3, fields: [
          { k: 'ACIER.FE1', code: 'FE1', unit: 'MPa', dec: 2, help: 'Limite d\'élasticité des aciers PHI1.', def: '500' },
          { k: 'ACIER.FE2', code: 'FE2', unit: 'MPa', dec: 2, help: 'Limite d\'élasticité des aciers PHI2.', def: '500' },
          { k: 'ACIER.FE3', code: 'FE3', unit: 'MPa', dec: 2, help: 'Limite d\'élasticité des aciers PHI3.', def: '500' },
        ] },
        { title: 'Adhérence', flex: 4, cols: 4, fields: [
          { k: 'ACIER.ETA1', code: 'ETA1', dec: 2, help: 'Coefficient de fissuration η des aciers PHI1 (1,6 pour HA).', def: '1,60' },
          { k: 'ACIER.ETA2', code: 'ETA2', dec: 2, help: 'Coefficient de fissuration η des aciers PHI2.', def: '1,60' },
          { k: 'ACIER.ETA3', code: 'ETA3', dec: 2, help: 'Coefficient de fissuration η des aciers PHI3.', def: '1,60' },
          { k: 'ACIER.PSIS', code: 'PSIS', dec: 2, help: 'Coefficient de scellement ψs (1,5 pour HA).', def: '1,50' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true) },
  ];

  /* ───── géométrie générique pour les schémas de principe ───── */
  const GEN = {
    'GEOM.OUVER': 8, 'GEOM.HAUTL': 5, 'GEOM.E1': 0.6, 'GEOM.E2': 0.55, 'GEOM.E3': 0.55, 'GEOM.HREMB': 0.6, 'GEOM.LDALT': 4, 'GEOM.BIAIS': 80,
    'PROF.ETROTG': 1.5, 'PROF.EGAU': 0.6, 'PROF.ESURCH': 9, 'PROF.EDROI': 0.6, 'PROF.ETROTD': 1.5, 'PROF.LARGE': 13.2, 'PROF.NVOI': 3,
    'PROF.HCHAU': 0.3, 'PROF.HSREM': 1.0, 'PROF.PTRAN': 2.5,
  };

  /* ───── dessins ───── */
  const lab = (m, k, sch, d, u) => sch ? (k.split('.').pop().replace('HSREM', 'HSREM').replace('PTRO', 'PSTROT')) : fmt(V(m, k), d == null ? 2 : d) + (u || '');

  function drawCoupe(svg, m, sch, loads) {
    const o = V(m, 'GEOM.OUVER') || 1, h = V(m, 'GEOM.HAUTL') || 1;
    const e1 = V(m, 'GEOM.E1'), e2 = V(m, 'GEOM.E2'), e3 = V(m, 'GEOM.E3');
    const hr = Math.min(V(m, 'GEOM.HREMB'), h * 0.9), ld = V(m, 'GEOM.LDALT');
    const hs = V(m, 'PROF.HSREM'), hc = V(m, 'PROF.HCHAU');
    const top = h + e3, road = top + hs + hc;
    const side = Math.max(ld + 1.2, o * 0.28, 2);
    const xl = -e2 - side, xr = o + e2 + side;
    const d = svg({ x0: xl, y0: -e1 - 1.2, x1: xr, y1: road + Math.max(1.6, o * 0.08) }, { pad: 0.06 });
    const u = d.u;
    // terrain et remblais
    d.soil([[xl, -e1], [xr, -e1]], 1.1);
    d.fill([[xl, -e1], [-e2, -e1], [-e2, top], [o + e2, top], [o + e2, -e1], [xr, -e1], [xr, road - hc], [xl, road - hc]], 'PROF.HSREM');
    if (hr > 0) d.fill([[0, 0], [o, 0], [o, hr], [0, hr]], 'GEOM.HREMB');
    // chaussée
    d.rect(xl, road - hc, xr - xl, Math.max(hc, u * 0.5), 'road', 'PROF.HCHAU');
    // dalles de transition
    if (ld > 0) {
      const t = 0.3, y0 = top + Math.min(hs, 0.4) * 0.15;
      d.poly([[-e2, top], [-e2 - ld, y0 + 0.0], [-e2 - ld, y0 + t], [-e2, top + t]], 'b2', 'GEOM.LDALT');
      d.poly([[o + e2, top], [o + e2 + ld, y0], [o + e2 + ld, y0 + t], [o + e2, top + t]], 'b2', 'GEOM.LDALT');
    }
    // cadre
    d.rect(-e2, -e1, o + 2 * e2, e1, 'b', 'GEOM.E1');
    d.rect(-e2, 0, e2, h, 'b', 'GEOM.E2');
    d.rect(o, 0, e2, h, 'b', 'GEOM.E2');
    d.rect(-e2, h, o + 2 * e2, e3, 'b', 'GEOM.E3');
    d.line(o / 2, -e1 - 0.6, o / 2, road + 0.6, 'ax');
    // charges
    if (loads) {
      const cx = o / 2, y = road;
      const tw = Math.min(o * 0.9, 11), th = Math.max(0.9, tw * 0.12);
      d.rect(cx - tw / 2, y + 0.45, tw * 0.78, th, 'car');
      d.rect(cx - tw / 2 + tw * 0.8, y + 0.45, tw * 0.2, th * 1.25, 'car');
      for (const f of [0.08, 0.42, 0.88]) d.circle(cx - tw / 2 + tw * f, y + 0.25, 0.25, 'wheel');
      d.text(cx, y + 0.45 + th / 2, sch ? 'Bc · Mc · E · EC' : 'charges', { size: 0.9, cls: 'ts' });
    }
    // cotes
    const L = (k, dd) => lab(m, k, sch, dd);
    d.dim(0, -e1, o, -e1, L('GEOM.OUVER'), -0.75, 'GEOM.OUVER');
    d.dim(o, 0, o, h, L('GEOM.HAUTL'), -Math.min(1.2, o * 0.12), 'GEOM.HAUTL');
    d.dim(-e2, h + e3 * 0.5, 0, h + e3 * 0.5, '', 0, 'GEOM.E2');
    d.text(-e2 / 2, h * 0.5, L('GEOM.E2'), { k: 'GEOM.E2', cls: sch ? 'tc' : 'dv', size: 0.9, rot: 90 });
    d.text(o + e2 / 2, h * 0.5, L('GEOM.E2'), { k: 'GEOM.E2', cls: sch ? 'tc' : 'dv', size: 0.9, rot: 90 });
    d.dim(xr - side * 0.35, h, xr - side * 0.35, top, L('GEOM.E3'), 0.6, 'GEOM.E3', { size: 0.85 });
    d.dim(xr - side * 0.35, -e1, xr - side * 0.35, 0, L('GEOM.E1'), 0.6, 'GEOM.E1', { size: 0.85 });
    if (hs > 0) d.dim(xr - side * 0.65, top, xr - side * 0.65, road - hc, L('PROF.HSREM'), 0.6, 'PROF.HSREM', { size: 0.85 });
    if (hc > 0) d.text(xr - side * 0.25, road + 0.45, (sch ? 'HCHAU' : fmt(hc, 2)), { k: 'PROF.HCHAU', cls: sch ? 'tc' : 'dv', size: 0.85 });
    if (ld > 0) d.dim(-e2 - ld, top, -e2, top, L('GEOM.LDALT'), -0.7, 'GEOM.LDALT', { size: 0.85 });
    if (hr > 0) d.dim(o * 0.15, 0, o * 0.15, hr, L('GEOM.HREMB'), 0.5, 'GEOM.HREMB', { size: 0.85 });
    // poussée des terres (flèches)
    const pw = Math.min(1.4, o * 0.12);
    const pr = (x, s, k) => { d.poly([[x, top], [x, 0], [x + s * pw, 0]], 'fillz', k); for (let i = 1; i <= 4; i++) { const y = h * (1 - i / 5); const L = pw * i / 5; d.line(x + s * L, y, x + s * 0.05, y, 'l', k); } };
    pr(-e2, -1, 'PERM.RKGN PERM.RKGX'); pr(o + e2, 1, 'PERM.RKDN PERM.RKDX');
    if (sch) {
      d.text(-e2 - 1.2, h * 0.5, 'RKG', { cls: 'tc', size: 0.85, k: 'PERM.RKGN PERM.RKGX' });
      d.text(o + e2 + 1.2, h * 0.5, 'RKD', { cls: 'tc', size: 0.85, k: 'PERM.RKDN PERM.RKDX' });
      d.text(o / 2, top + hs * 0.5, 'QREM · QSUP', { cls: 'tc', size: 0.8, k: 'PERM.QREMN PERM.QREMX PERM.QSUPN PERM.QSUPX' });
      if (ld > 0) d.text(-e2 - 0.4, top + 0.9, 'RDT', { cls: 'tc', size: 0.8, a: 'end', k: 'PERM.RDTN PERM.RDTX' });
      d.text(o / 2, -e1 - 0.65, 'ESOL', { cls: 'tc', size: 0.8, k: 'MAT.ESOL' });
    }
    return d.toString();
  }

  function drawTravers(svg, m, sch) {
    const ws = ['PROF.ETROTG', 'PROF.EGAU', 'PROF.ESURCH', 'PROF.EDROI', 'PROF.ETROTD'].map(k => V(m, k));
    let W = V(m, 'PROF.LARGE'); const sum = ws.reduce((a, b) => a + b, 0); if (!(W > 0)) W = sum || 10;
    const hReal = V(m, 'GEOM.HAUTL') || 4, h = Math.min(hReal, Math.max(1.5, W * 0.16)), e1 = V(m, 'GEOM.E1'), e3 = V(m, 'GEOM.E3');
    const hs = V(m, 'PROF.HSREM'), hc = V(m, 'PROF.HCHAU'), hr = Math.min(V(m, 'GEOM.HREMB'), h * 0.9);
    const top = h + e3, rd = top + hs + hc;
    const x0 = (W - sum) / 2;                 // profil centré si la somme ≠ LARGE
    const d = svg({ x0: -1.2, y0: -e1 - 0.9, x1: W + 1.2, y1: rd + 2.6 }, { pad: 0.05 });
    d.soil([[-1.2, -e1], [W + 1.2, -e1]], 0.8);
    d.rect(0, -e1, W, e1, 'b', 'GEOM.E1');
    if (hr > 0) d.fill([[0, 0], [W, 0], [W, hr], [0, hr]], 'GEOM.HREMB');
    d.rect(0, h, W, e3, 'b', 'GEOM.E3');
    d.text(W / 2, h * 0.55, sch ? 'intérieur du cadre — HAUTL' : 'intérieur du cadre — hauteur libre ' + fmt(hReal, 2) + ' m' + (hReal > h ? ' (hauteur réduite sur le dessin)' : ''), { cls: 'ts', size: 0.8, k: 'GEOM.HAUTL' });
    if (hReal > h) { const zz = (x, y) => [[x - 0.3, y - 0.25], [x, y + 0.05], [x + 0.05, y - 0.05], [x + 0.35, y + 0.25]]; d.path(zz(-0.4, h * 0.5), 'l'); d.path(zz(W + 0.4, h * 0.5), 'l'); }
    d.fill([[0, top], [W, top], [W, top + hs], [0, top + hs]], 'PROF.HSREM');
    // chaussée, trottoirs
    let x = x0; const xs = [x];
    for (const w of ws) { x += w; xs.push(x); }
    const p = V(m, 'PROF.PTRAN') / 100;
    d.rect(xs[1], top + hs, xs[4] - xs[1], Math.max(hc, d.u * 0.5), 'road', 'PROF.HCHAU PROF.ESURCH');
    if (ws[0] > 0) d.rect(xs[0], top + hs, ws[0], hc + 0.2, 'b2', 'PROF.ETROTG');
    if (ws[4] > 0) d.rect(xs[4], top + hs, ws[4], hc + 0.2, 'b2', 'PROF.ETROTD');
    const nv = Math.max(1, Math.round(V(m, 'PROF.NVOI')) || 1);
    for (let i = 1; i < nv; i++) { const xx = xs[2] + ws[2] * i / nv; d.line(xx, rd + 0.02, xx, rd + 0.02, 'l'); d.line(xx, top + hs + hc * 0.5, xx, top + hs + hc + 0.02, 'l', 'PROF.NVOI'); }
    if (p) d.text(xs[4] - 0.2, rd + 0.35, (sch ? 'PTRAN' : fmt(V(m, 'PROF.PTRAN'), 1) + ' %') + '  ◂', { k: 'PROF.PTRAN', cls: sch ? 'tc' : 'dv', size: 0.8, a: 'end' });
    const L = k => lab(m, k, sch);
    const yy = rd + 0.95;
    ['PROF.ETROTG', 'PROF.EGAU', 'PROF.ESURCH', 'PROF.EDROI', 'PROF.ETROTD'].forEach((k, i) => { if (ws[i] > 0 || sch) d.dim(xs[i], yy, xs[i + 1], yy, L(k), 0.01, k, { size: ws[i] < 1 && !sch ? 0.75 : 0.9 }); });
    d.dim(0, rd + 1.9, W, rd + 1.9, L('PROF.LARGE'), 0.01, 'PROF.LARGE');
    d.text(xs[2] + ws[2] / 2, top + hs + hc + 0.0 + 0.15, sch ? 'NVOI voies' : nv + ' voie' + (nv > 1 ? 's' : ''), { k: 'PROF.NVOI', cls: sch ? 'tc' : 'ts', size: 0.75, base: 'auto' });
    d.dim(W + 0.6, top, W + 0.6, top + hs, L('PROF.HSREM'), 0.01, 'PROF.HSREM', { size: 0.8 });
    return d.toString();
  }

  function drawPlan(svg, m, sch) {
    const o = V(m, 'GEOM.OUVER') || 1, e2 = V(m, 'GEOM.E2'), W = V(m, 'PROF.LARGE') || 10, ld = V(m, 'GEOM.LDALT');
    const b = Math.max(30, Math.min(100, V(m, 'GEOM.BIAIS') || 100)) * Math.PI / 200;  // grades → rad
    const s = Math.sin(b), c = Math.cos(b);
    // axe de la voie portée = x ; piédroits suivant (cos b, sin b) ; ouverture biaise o/s le long de x
    const ob = o / s, eb = e2 / s, lb = ld / s;
    const dx = W / Math.tan(b);            // décalage en x sur la largeur W (mesurée ⟂ à la voie)
    const xmin = Math.min(0, dx) - eb - lb - 1.5, xmax = Math.max(0, dx) + ob + eb + lb + 1.5;
    const d = svg({ x0: xmin, y0: -2.2, x1: xmax, y1: W + 1.6 }, { pad: 0.04 });
    d.rect(xmin, 0, xmax - xmin, W, 'road', 'PROF.LARGE');
    const band = (x1, x2, cls, k) => d.poly([[x1, 0], [x2, 0], [x2 + dx, W], [x1 + dx, W]], cls, k);
    band(-eb, 0, 'b', 'GEOM.E2'); band(ob, ob + eb, 'b', 'GEOM.E2');
    band(0, ob, 'fillz', 'GEOM.OUVER');
    if (ld > 0) { band(-eb - lb, -eb, 'b2', 'GEOM.LDALT'); band(ob + eb, ob + eb + lb, 'b2', 'GEOM.LDALT'); }
    d.line(xmin, W / 2, xmax, W / 2, 'ax');
    const L = k => lab(m, k, sch);
    d.dim(0, 0, ob, 0, sch ? 'OUVER / sin(BIAIS)' : fmt(ob, 2) + ' (biaise)', -0.9, 'GEOM.OUVER', { size: 0.85 });
    d.dim(xmax - 0.6, 0, xmax - 0.6, W, L('PROF.LARGE'), 0.01, 'PROF.LARGE');
    // angle
    const r = Math.min(3, W * 0.3), ax = ob + eb + (lb || 0) * 0;
    const arc = []; for (let i = 0; i <= 16; i++) { const t = b * i / 16; arc.push([ob + r * Math.cos(t), r * Math.sin(t)]); }
    d.path(arc, 'l', 'GEOM.BIAIS');
    d.text(ob + r * 1.15 * Math.cos(b / 2), r * 1.15 * Math.sin(b / 2), sch ? 'BIAIS' : fmt(V(m, 'GEOM.BIAIS'), 1) + ' gr', { k: 'GEOM.BIAIS', cls: sch ? 'tc' : 'dv', size: 0.9 });
    d.text((xmin + xmax) / 2, W + 0.8, 'voie portée →', { cls: 'ts', size: 0.85 });
    void ax; void c;
    return d.toString();
  }

  /* ───── contrôles de cohérence ───── */
  function checks(m) {
    const out = [], E_ = (step, k, msg) => out.push({ level: 'e', step, k, msg }), W_ = (step, k, msg) => out.push({ level: 'w', step, k, msg });
    const o = V(m, 'GEOM.OUVER'), h = V(m, 'GEOM.HAUTL');
    if (!(o > 0)) E_('geom', 'GEOM.OUVER', 'l\'ouverture droite OUVER doit être positive');
    if (!(h > 0)) E_('geom', 'GEOM.HAUTL', 'la hauteur libre HAUTL doit être positive');
    for (const k of ['GEOM.E1', 'GEOM.E2', 'GEOM.E3']) if (!(V(m, k) > 0)) E_('geom', k, `l'épaisseur ${k.split('.')[1]} doit être positive`);
    const bi = V(m, 'GEOM.BIAIS');
    if (!(bi > 0 && bi <= 100)) E_('geom', 'GEOM.BIAIS', 'le biais est compris entre 0 et 100 grades');
    else if (bi < 50) W_('geom', 'GEOM.BIAIS', 'biais inférieur à 50 gr : hors du domaine d\'emploi du programme PICF-EL');
    if (o > 0 && V(m, 'GEOM.E3') > 0 && V(m, 'GEOM.E3') < o / 32) W_('geom', 'GEOM.E3', `traverse supérieure mince pour l'ouverture (E3 < OUVER/32 = ${fmt(o / 32, 2)} m)`);
    if (h > 0 && V(m, 'GEOM.HREMB') >= h) E_('geom', 'GEOM.HREMB', 'le remblai intérieur HREMB dépasse la hauteur libre');
    const sum = ['PROF.ETROTG', 'PROF.EGAU', 'PROF.ESURCH', 'PROF.EDROI', 'PROF.ETROTD'].reduce((a, k) => a + V(m, k), 0);
    if (!(V(m, 'PROF.ESURCH') > 0)) E_('prof', 'PROF.ESURCH', 'la largeur chargeable ESURCH doit être positive');
    if (V(m, 'PROF.LARGE') > 0 && Math.abs(sum - V(m, 'PROF.LARGE')) > 0.015) W_('prof', 'PROF.LARGE', `LARGE (${fmt(V(m, 'PROF.LARGE'), 2)} m) ≠ somme des bandes du profil en travers (${fmt(sum, 2)} m)`);
    if (!(V(m, 'PROF.LARGE') > 0)) E_('prof', 'PROF.LARGE', 'la largeur droite LARGE doit être positive');
    const es = V(m, 'PROF.ESURCH'), nv = V(m, 'PROF.NVOI');
    if (es >= 6 && nv && nv !== Math.floor(es / 3) && !(m.flags && m.flags['PROF.NVOI'] === '=')) W_('prof', 'PROF.NVOI', `Fasc. 61 : ${Math.floor(es / 3)} voies pour ESURCH = ${fmt(es, 2)} m (saisi : ${nv})`);
    const mm = (a, b, step, lab) => { if (V(m, a) > V(m, b) + 1e-9) E_(step, a, `${lab} : la valeur minimale dépasse la maximale`); };
    mm('PERM.RKGN', 'PERM.RKGX', 'perm', 'Rankine gauche'); mm('PERM.RKDN', 'PERM.RKDX', 'perm', 'Rankine droite');
    mm('PERM.QSUPN', 'PERM.QSUPX', 'perm', 'superstructures'); mm('PERM.RDTN', 'PERM.RDTX', 'perm', 'réaction de dalle');
    if (V(m, 'GEOM.LDALT') > 0 && !(V(m, 'PERM.RDTX') > 0)) W_('perm', 'PERM.RDTX', 'une dalle de transition est déclarée mais sa réaction RDTX est nulle');
    if (!(V(m, 'GEOM.LDALT') > 0) && V(m, 'PERM.RDTX') > 0) W_('perm', 'PERM.RDTX', 'réaction de dalle de transition sans dalle (LDALT = 0)');
    const fc = V(m, 'MAT.FCJ'); if (!(fc >= 16 && fc <= 60)) W_('mat', 'MAT.FCJ', 'résistance du béton inhabituelle (fc28 attendu entre 20 et 40 MPa)');
    if (!(V(m, 'MAT.ESOL') > 0)) E_('mat', 'MAT.ESOL', 'le module du sol ESOL doit être positif');
    const p1 = V(m, 'ACIER.PHI1'), p2 = V(m, 'ACIER.PHI2'), p3 = V(m, 'ACIER.PHI3');
    for (const [k, p] of [['ACIER.PHI1', p1], ['ACIER.PHI2', p2], ['ACIER.PHI3', p3]]) if (![6, 8, 10, 12, 14, 16, 20, 25, 32, 40].includes(p)) W_('mat', k, `diamètre ${p} mm non normalisé`);
    if (p2 > p1) W_('mat', 'ACIER.PHI2', 'PHI2 (auxiliaires) supérieur à PHI1 (principaux)');
    if (!['PP', 'P', 'TP'].includes(m['MAT.IFIS'])) E_('mat', 'MAT.IFIS', 'fissuration : PP, P ou TP');
    if (!m['CHARG.AL'] && !m['CHARG.BC'] && !m['CHARG.BT'] && !m['CHARG.MC'] && !m['CHARG.ME'] && !m['CHARG.EX']) W_('expl', 'CHARG.AL', 'aucune charge d\'exploitation n\'est retenue');
    return out;
  }

  /* ───── résultats ───── */
  function summary(m, r) {
    const esc = G.OTUI.esc, kv = (a, b) => `<div class="ot-kv"><span>${esc(a)}</span><b>${b}</b></div>`;
    const g = r.geom || {}, f = r.fer || {}, mt = r.metre || {};
    let h = `<div class="ot-card"><h4>Géométrie de calcul</h4>${kv('Portée de calcul', fmt(g.L, 2) + ' m')}${kv('Hauteur moyenne', fmt(g.H, 2) + ' m')}${kv('Largeur droite', fmt(g.W, 2) + ' m')}${kv('Biais', fmt(g.biais, 1) + ' gr')}${kv('Épaisseurs E1 / E2 / E3', [g.e1, g.e2, g.e3].map(x => fmt(x, 2)).join(' / ') + ' m')}</div>`;
    const lab = { TS: 'Traverse sup. — milieu', TI: 'Traverse inf. — milieu', PD: 'Piédroit — intérieur', AS_T: 'Angle supérieur (traverse)', AS_P: 'Angle supérieur (piédroit)', AI_T: 'Angle inférieur (traverse)', AI_P: 'Angle inférieur (piédroit)' };
    const rows = Object.keys(lab).filter(k => f[k]).map(k => {
      const x = f[k];
      return `<div class="ot-kv"><span>${lab[k]}</span><b>${fmt((x.A || 0) * 1e4, 2)} cm²/m · Mu ${fmt(x.MU, 1)} kN·m</b></div>`;
    }).join('');
    if (rows) h += `<div class="ot-card"><h4>Aciers principaux (sections déterminantes)</h4>${rows}</div>`;
    if (mt.beton != null) h += `<div class="ot-card"><h4>Avant-métré</h4>${kv('Béton', fmt(mt.beton, 1) + ' m³')}${kv('Coffrage', fmt(mt.coffrage, 1) + ' m²')}${(mt.acier || mt.aciers) ? kv('Aciers', fmt(mt.acier || mt.aciers, 2) + ' t') : ''}</div>`;
    return h;
  }

  /* ───── exemple et nouveau ───── */
  const EX1 = [
    '                                                        BORDEREAU DES DONNES DU PICF91   NUMERO 0001- DU  4.11.26 09H00',
    '                                                        -----------------------------------------------------------------', '', '',
    '              NUM    S    DATE     NIV    TEL       GESTIONNAIRE                     CLIENT',
    'PICF91        0001       041126', '', '  TITRE',
    '                                 EXEMPLE DE CADRE FERME',
    '                              PASSAGE INFERIEUR SOUS AUTOROUTE', '', 'PI EX1', '',
    'FIXD DIRFER DES', ' 0     1     0', '',
    'HAUTL HREMB OUVER BIAIS             E1     E2     E3    LDALT',
    '8.80 2.30 10.00 100.000            0.60   0.60   0.60   4.00', '',
    'NVOI ETROTG     EGAU ESURCH       EDROI ETROTD    LARGE   HCHAU HSREM PTRAN',
    '   3   0.65     0.50 10.69         0.50 0.30      12.64   0.66 0.99 0.00', '',
    'MVBET MVSOL     RKGN     RKGX   RKDN     RKDX QSUPN QSUPX    RDTN    RDTX    QREMN QREMX   R',
    ' 2.50 2.00      0.25     0.50   0.25     0.50 0.21 0.35      106.8   119.1   =1.82 =2.22 0.70', '',
    'CL AL    BC     BT    MC        ME        EX     PTRO TE+ TE- TER PSREM',
    ' 1 AL    BC     BT    MC120     ME120     E      0.00 =30. =-40. =10. 0.0', '',
    '  KAL    KBC    KBT    KMC    KME    KEX    KTR',
    'c0.000 c0.000 c0.000 c0.000 c0.000 c0.000 c0.000', '',
    ' EC      EGAU ESURCH       HSREM    RDTN    RDTX    QREMN       QREMX    PSREM  KEC',
    'EC34      4.50  7.00        0.20     66.      72.     0.36        0.44    0.0 c0.000', '',
    'IFIS     FCJ  ENROBS        ENROB       ESOL',
    ' PP      25.00 0.030        0.030      158.00', '',
    'PHI1    PHI2   PHI3        FE1     FE2     FE3           ETA1    ETA2     ETA3    PSIS',
    ' 25      14     10       =500.00 =500.00 =500.00        =1.60   =1.60    =1.60   =1.50', ''].join('\n');
  const EX2 = EX1.replace('EXEMPLE DE CADRE FERME', 'EXEMPLE DE CADRE HYDRAULIQUE').replace('PASSAGE INFERIEUR SOUS AUTOROUTE', 'OUVRAGE HYDRAULIQUE SOUS REMBLAI').replace('PI EX1', 'OH EX2')
    .replace('8.80 2.30 10.00 100.000            0.60   0.60   0.60   4.00', '4.50 0.00  5.35 100.000            0.85   0.85   0.85   0.00')
    .replace('   3   0.65     0.50 10.69         0.50 0.30      12.64   0.66 0.99 0.00', '  =3  0.00     0.00 10.00         0.00 0.00      10.00   0.00 15.70 0.00')
    .replace(' 2.50 2.00      0.25     0.50   0.25     0.50 0.21 0.35      106.8   119.1   =1.82 =2.22 0.70', ' 2.50 2.00      0.25     0.50   0.25     0.50 0.24 0.24        0.     0.    =**** =**** 1.00')
    .replace('EC34      4.50  7.00        0.20     66.      72.     0.36        0.44    0.0 c0.000', '0         0.00  0.00        0.00      0.       0.     0.00        0.00    0.0  0.000')
    .replace(' PP      25.00 0.030        0.030      158.00', ' P       30.00 0.035        0.035       80.00')
    .replace(' 25      14     10       =500.00', ' 32      25     16       =500.00').replace('=10. 0.0', '10.  1.0');

  function blank() {
    const m = E.parseBordereau(EX1);
    delete m._layout;
    m.titre = ['', '']; m.titreCourt = ''; m.verification = [];
    m.num = m.numero = '0001';
    return m;
  }


  /* ═════════════ planches de croquis intercalées dans la note (affichage seulement) ═════════════
     figures(model, results, pages) → [{ after: indice de page, html }] ; la note texte SETRA n'est pas modifiée.
     Toutes les grandeurs tracées viennent de results (R.donnees, R.geom, R.cmp, R.env, R.conv, R.fer, R.det…). */
  const FG = (() => {
    const esc = s => G.OTUI.esc(s);
    const f2 = v => fmt(v, 2), f1 = v => fmt(v, 1), f0 = v => fmt(v, 0);
    const P = (x, y) => `${+x.toFixed(4)},${+(-y).toFixed(4)}`;
    // primitives stylées (unités = m, y vers le haut, même repère que OTUI.svg)
    const sPoly = (d, pts, st) => d.raw(`<polygon points="${pts.map(p => P(p[0], p[1])).join(' ')}" style="${st}"/>`);
    const sLine = (d, pts, st) => d.raw(`<polyline points="${pts.map(p => P(p[0], p[1])).join(' ')}" fill="none" style="vector-effect:non-scaling-stroke;${st}"/>`);
    const sText = (d, x, y, s, o) => { o = o || {}; const fs = (o.size || 1) * d.u * 2; const rot = o.rot ? ` transform="rotate(${-o.rot} ${P(x, y).replace(',', ' ')})"` : '';
      d.raw(`<text x="${+x.toFixed(4)}" y="${+(-y).toFixed(4)}" font-size="${+fs.toFixed(4)}" text-anchor="${o.a || 'middle'}" dominant-baseline="${o.base || 'middle'}" style="font-family:${o.mono ? "'Courier New',monospace" : "'Outfit',sans-serif"};fill:${o.c || '#3c3f4d'};${o.b ? 'font-weight:700;' : ''}${o.i ? 'font-style:italic;' : ''}"${rot}>${esc(s)}</text>`); };
    // flèche (pointe en x,y, direction ux,uy)
    const arrow = (d, x, y, ux, uy, sz, c) => { const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L; const a = sz, b = sz * 0.38;
      sPoly(d, [[x, y], [x - ux * a - uy * b, y - uy * a + ux * b], [x - ux * a + uy * b, y - uy * a - ux * b]], `fill:${c || '#3c3f4d'};stroke:none`); };
    // échelle graphique
    const scaleBar = (d, x, y, len) => { const u = d.u, n = len >= 5 ? 5 : len;
      for (let i = 0; i < n; i++) sPoly(d, [[x + i * len / n, y], [x + (i + 1) * len / n, y], [x + (i + 1) * len / n, y + u * 0.6], [x + i * len / n, y + u * 0.6]], `fill:${i % 2 ? '#fff' : '#3c3f4d'};stroke:#3c3f4d;stroke-width:.8px;vector-effect:non-scaling-stroke`);
      sText(d, x, y + u * 1.6, '0', { size: 0.7 }); sText(d, x + len, y + u * 1.6, fmt(len, 0) + ' m', { size: 0.7 }); };
    const zig = (d, x1, x2, y) => { const w = x2 - x1, h = d.u * 0.9, m = (x1 + x2) / 2; sLine(d, [[x1, y], [m - h, y], [m - h * 0.4, y + h], [m + h * 0.4, y - h], [m + h, y], [x2, y]], 'stroke:#3c3f4d;stroke-width:1px'); void w; };
    const fit = (s, mh) => s.replace('<svg ', `<svg style="max-height:${mh}px;width:100%;margin:0 auto" `);
    const fig = (t, inner, wide) => `<div${wide ? ' class="wide"' : ''}>${t ? `<h5>${esc(t)}</h5>` : ''}${inner}</div>`;
    const tab = (head, rows, al) => `<table style="border-collapse:collapse;font:10.5px/1.35 'Courier New',monospace;width:100%;color:#222">`
      + `<tr>${head.map((h, i) => `<th style="text-align:${i ? 'right' : 'left'};border-bottom:1px solid #222;padding:2px 6px;font-weight:700">${esc(h)}</th>`).join('')}</tr>`
      + rows.map(r => `<tr>${r.map((c, i) => `<td style="text-align:${(al && al[i]) || (i ? 'right' : 'left')};padding:2px 6px;border-bottom:1px solid #eee">${esc(c)}</td>`).join('')}</tr>`).join('') + '</table>';
    const RED = '#c0392b', BLUE = '#1a4fd6', GREY = '#3c3f4d', GOLD = '#a07828';
    const ticks = xs => { const a = Math.min(...xs), b = Math.max(...xs), st = b - a > 12 ? 2 : b - a > 4 ? 1 : 0.5, t = [];
      for (let v = Math.ceil(a / st) * st; v < b - 0.45 * st; v += st) t.push(+v.toFixed(3)); t.push(b); return t; };
    const legend = items => `<div style="display:flex;flex-wrap:wrap;gap:4px 16px;font:11px 'Outfit',sans-serif;color:#3c3f4d;margin:0 0 2px 64px">${items.map(([n, c, dash]) =>
      `<span style="display:inline-flex;align-items:center;gap:5px"><svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="${c}" stroke-width="2"${dash ? ' stroke-dasharray="6 4"' : ''}/></svg>${esc(n)}</span>`).join('')}</div>`;
    const noPermLab = s => s.replace(/<text[^>]*class="vl perm"[^>]*>[^<]*<\/text>/g, '');

    /* ---------- coupe A-A (perpendiculaire aux piédroits), à l'échelle ---------- */
    function coupeAA(d, R) {
      const o = d.ouver, h = d.hautl, e1 = d.e1, e2 = d.e2, e3 = d.e3, hr = Math.min(d.hremb, h), ld = d.ldalt, hs = d.hsrem, hc = d.hchau;
      const hcap = Math.max(1.5, 0.3 * (h + e1 + e3)), brk = hs > hcap * 1.15, hsD = brk ? hcap : hs;
      const top = h + e3, road = top + hsD + hc;
      const side = Math.max(ld + 1.5, 2.5, o * 0.2), xl = -e2 - side, xr = o + e2 + side;
      const d_ = G.OTUI.svg({ x0: xl, y0: -e1 - 1.4, x1: xr + 2.6, y1: road + 1.6 }, { pad: 0.03 }), u = d_.u;
      const D = d_;
      D.soil([[xl, -e1], [xr, -e1]], 0.8);
      D.fill([[xl, -e1], [-e2, -e1], [-e2, top], [o + e2, top], [o + e2, -e1], [xr, -e1], [xr, road - hc], [xl, road - hc]]);
      if (hr > 0) D.fill([[0, 0], [o, 0], [o, hr], [0, hr]]);
      D.rect(xl, road - hc, xr - xl, Math.max(hc, u * 0.45), 'road');
      if (ld > 0) { const t = Math.min(0.3, Math.max(hsD, 0.3)); D.rect(-e2 - ld, road - hc - t, ld, t, 'b2'); D.rect(o + e2, road - hc - t, ld, t, 'b2');
        sText(D, -e2 - ld / 2, road - hc - t - u * 1.2, 'dalle de transition', { size: 0.65, i: 1, c: '#7a7e8e' }); sText(D, o + e2 + ld / 2, road - hc - t - u * 1.2, 'dalle de transition', { size: 0.65, i: 1, c: '#7a7e8e' }); }
      D.rect(-e2, -e1, o + 2 * e2, e1, 'b'); D.rect(-e2, 0, e2, h, 'b'); D.rect(o, 0, e2, h, 'b'); D.rect(-e2, h, o + 2 * e2, e3, 'b');
      // lignes moyennes (cadre de calcul)
      sLine(D, [[-e2 / 2, -e1 / 2], [o + e2 / 2, -e1 / 2], [o + e2 / 2, h + e3 / 2], [-e2 / 2, h + e3 / 2], [-e2 / 2, -e1 / 2]], `stroke:${BLUE};stroke-width:.8px;stroke-dasharray:8 3 2 3;opacity:.75`);
      D.line(o / 2, -e1 - 0.5, o / 2, road + 0.5, 'ax');
      sText(D, o / 2 + u * 0.8, road + 0.35, 'axe', { a: 'start', size: 0.65, c: BLUE, i: 1 });
      if (brk) { zig(D, xl, xr, top + hsD * 0.55); sText(D, xl + u, top + hsD * 0.55 + u * 1.6, `remblai coupé (HSREM = ${f2(hs)} m)`, { a: 'start', size: 0.7, i: 1 }); }
      sText(D, o / 2, h + e3 / 2, 'TRAVERSE SUPÉRIEURE', { size: Math.min(0.75, e3 / u / 2.6), c: '#5d5545' });
      sText(D, o / 2, -e1 / 2, 'TRAVERSE INFÉRIEURE', { size: Math.min(0.75, e1 / u / 2.6), c: '#5d5545' });
      sText(D, -e2 / 2, h * 0.72, 'PIÉDROIT G', { size: Math.min(0.7, e2 / u / 2.6), rot: 90, c: '#5d5545' });
      sText(D, o + e2 / 2, h * 0.72, 'PIÉDROIT D', { size: Math.min(0.7, e2 / u / 2.6), rot: 90, c: '#5d5545' });
      // cotes
      D.dim(0, h * 0.42, o, h * 0.42, 'OUVER ' + f2(o), 0.01, null, { size: 0.9 });
      D.dim(o, 0, o, h, 'HAUTL ' + f2(h), Math.min(1.1, o * 0.1), null, { size: 0.9 });
      D.dim(-e2, h * 0.3, 0, h * 0.3, '', 0.01); sText(D, -e2 - u * 0.6, h * 0.3 + u * 1.5, 'E2 ' + f2(e2), { a: 'end', size: 0.75, c: BLUE });
      D.dim(o, h * 0.3, o + e2, h * 0.3, '', 0.01); sText(D, o + e2 + u * 0.6, h * 0.3 + u * 1.5, 'E2 ' + f2(e2), { a: 'start', size: 0.75, c: BLUE });
      const c1 = xr + 0.5, c2 = xr + 1.7;
      D.dim(c1, -e1, c1, 0, 'E1 ' + f2(e1), 0.01, null, { size: 0.75 });
      D.dim(c1, h, c1, top, 'E3 ' + f2(e3), 0.01, null, { size: 0.75 });
      if (hs > 0) D.dim(c1, top, c1, top + hsD, 'HSREM ' + f2(hs), -0.01, null, { size: 0.75 });
      if (hc > 0) sText(D, c2, road + u * 1.4, 'HCHAU ' + f2(hc), { size: 0.7, c: BLUE });
      D.dim(c2, -e1, c2, road - hc, brk ? 'hauteur totale ' + f2(e1 + h + e3 + hs) : f2(e1 + h + e3 + hs), -0.01, null, { size: 0.8 });
      if (hr > 0) D.dim(o * 0.1, 0, o * 0.1, hr, 'HREMB ' + f2(d.hremb), -0.01, null, { size: 0.7 });
      D.dim(-e2, road + 0.15, o + e2, road + 0.15, f2(o + 2 * e2) + ' hors tout', 0.5, null, { size: 0.8 });
      if (ld > 0) { D.dim(-e2 - ld, road + 0.15, -e2, road + 0.15, 'LDALT ' + f2(ld), 0.5, null, { size: 0.75 }); D.dim(o + e2, road + 0.15, o + e2 + ld, road + 0.15, 'LDALT ' + f2(ld), 0.5, null, { size: 0.75 }); }
      sText(D, -e2 / 2 - u * 0.5, -e1 / 2 - u * 2.2, 'lignes moyennes', { a: 'end', size: 0.6, c: BLUE, i: 1 });
      scaleBar(D, xl + 0.3, -e1 - 1.25, o >= 6 ? 5 : 2);
      return D.toString();
    }

    /* ---------- vue en plan : biais, axe de la voie portée, piédroits, dalles, traits de coupe ---------- */
    function plan(d) {
      const o = d.ouver, e2 = d.e2, W = d.large || 10, ld = d.ldalt, g = d.biais || 100;
      const b = g * Math.PI / 200, s = Math.sin(b);
      const ob = o / s, eb = e2 / s, lb = ld / s, dx = W / Math.tan(b);
      const C = [(ob + dx) / 2, W / 2];                                  // centre de l'ouverture sur l'axe
      const n = [s, -Math.cos(b)], v = [Math.cos(b), s];                // ⟂ piédroits, // piédroits
      const ha = o / 2 + e2 + Math.max(ld, 0) + 1.6;                      // demi-longueur du trait A-A
      const A1 = [C[0] - n[0] * ha, C[1] - n[1] * ha], A2 = [C[0] + n[0] * ha, C[1] + n[1] * ha];
      const xmin = Math.min(0, dx, A1[0], A2[0]) - eb - lb - 1.5, xmax = Math.max(ob, ob + dx, A1[0], A2[0]) + eb + lb + 1.5;
      const ymin = Math.min(-2.4, A1[1] - 0.8, A2[1] - 0.8), ymax = Math.max(W + 2.2, A1[1] + 1.2, A2[1] + 1.2);
      const D = G.OTUI.svg({ x0: xmin, y0: ymin, x1: xmax + 1.6, y1: ymax }, { pad: 0.03 }), u = D.u;
      // profil en travers (y = W : bord gauche, vu dans le sens de la voie portée →)
      const ws = [d.etrotg, d.egau, d.esurch, d.edroi, d.etrotd], sum = ws.reduce((a, c) => a + c, 0), y0 = W - (W - sum) / 2;
      const yb = [y0]; for (const w of ws) yb.push(yb[yb.length - 1] - w);
      sPoly(D, [[xmin, 0], [xmax, 0], [xmax, W], [xmin, W]], 'fill:#f3f0ea;stroke:none');
      sPoly(D, [[xmin, yb[4]], [xmax, yb[4]], [xmax, yb[1]], [xmin, yb[1]]], 'fill:#dcdad5;stroke:none');
      sPoly(D, [[xmin, yb[3]], [xmax, yb[3]], [xmax, yb[2]], [xmin, yb[2]]], 'fill:#cfccc5;stroke:none');
      for (const y of [0, W]) sLine(D, [[xmin, y], [xmax, y]], 'stroke:#5d5545;stroke-width:1.2px');
      for (const y of [yb[1], yb[4]]) if (y > 0.01 && y < W - 0.01) sLine(D, [[xmin, y], [xmax, y]], 'stroke:#7a7e8e;stroke-width:.8px');
      const nv = Math.max(1, Math.round(d.nvoi) || 1);
      for (let i = 1; i < nv; i++) { const y = yb[2] - d.esurch * i / nv; sLine(D, [[xmin, y], [xmax, y]], 'stroke:#fff;stroke-width:1.2px;stroke-dasharray:10 8'); }
      const band = (x1, x2, st) => sPoly(D, [[x1, 0], [x2, 0], [x2 + dx, W], [x1 + dx, W]], st);
      if (ld > 0) { band(-eb - lb, -eb, 'fill:#d9d1c0;fill-opacity:.85;stroke:#5d5545;stroke-width:.8px;vector-effect:non-scaling-stroke');
        band(ob + eb, ob + eb + lb, 'fill:#d9d1c0;fill-opacity:.85;stroke:#5d5545;stroke-width:.8px;vector-effect:non-scaling-stroke'); }
      band(-eb, ob + eb, 'fill:#e9e3d6;fill-opacity:.55;stroke:#5d5545;stroke-width:1.2px;vector-effect:non-scaling-stroke');
      band(-eb, 0, 'fill:#cbbf9f;stroke:#5d5545;stroke-width:1px;vector-effect:non-scaling-stroke');
      band(ob, ob + eb, 'fill:#cbbf9f;stroke:#5d5545;stroke-width:1px;vector-effect:non-scaling-stroke');
      // axe de la voie portée, axe de l'ouverture
      D.line(xmin + 0.3, W / 2, xmax - 0.3, W / 2, 'ax');
      arrow(D, xmax - 0.3, W / 2, 1, 0, u * 1.6, BLUE);
      sText(D, xmin + 0.4, W / 2 + u * 3.4, 'axe de la voie portée →', { a: 'start', size: 0.9, c: BLUE, i: 1 });
      const ho = W / s / 2 + 1.2; sLine(D, [[C[0] - v[0] * ho, C[1] - v[1] * ho], [C[0] + v[0] * ho, C[1] + v[1] * ho]], 'stroke:#7a7e8e;stroke-width:.8px;stroke-dasharray:8 3 2 3');
      sText(D, C[0] + v[0] * ho, C[1] + v[1] * ho + u * 1.4, "axe de l'ouverture", { size: 0.85, c: '#7a7e8e', i: 1 });
      // piédroits repérés
      sText(D, -eb - lb - u * 2, W * 0.12, 'G', { b: 1, size: 1.1 }); sText(D, ob + eb + lb + dx * 0.12 + u * 2, W * 0.12, 'D', { b: 1, size: 1.1 });
      // angle de biais (entre l'axe de la voie portée et le piédroit D)
      const I = [ob + dx / 2, W / 2], r = Math.min(W * 0.28, 3.2), arc = [];
      if (Math.abs(g - 100) > 0.05) { for (let i = 0; i <= 20; i++) { const t = b * i / 20; arc.push([I[0] + r * Math.cos(t), I[1] + r * Math.sin(t)]); }
        sLine(D, arc, `stroke:${GOLD};stroke-width:1.2px`); }
      sText(D, I[0] + r * 1.25 * Math.cos(b / 2), I[1] + r * 1.25 * Math.sin(b / 2), 'biais ' + fmt(g, 2) + ' gr', { size: 1.0, c: GOLD, b: 1, a: 'start' });
      // traits de coupe
      const cut = (p1, p2, look, lab) => {
        sLine(D, [p1, p2], `stroke:${RED};stroke-width:.9px;stroke-dasharray:12 4 2 4`);
        for (const [p, q] of [[p1, p2], [p2, p1]]) { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), t = [(q[0] - p[0]) / L, (q[1] - p[1]) / L], k = u * 2.2;
          sLine(D, [p, [p[0] + t[0] * k, p[1] + t[1] * k]], `stroke:${RED};stroke-width:3px`);
          const a = [p[0] + look[0] * u * 3, p[1] + look[1] * u * 3]; sLine(D, [p, a], `stroke:${RED};stroke-width:1.2px`); arrow(D, a[0], a[1], look[0], look[1], u * 1.3, RED);
          sText(D, p[0] - t[0] * u * 1.8, p[1] - t[1] * u * 1.8, lab, { b: 1, c: RED, size: 1.0 }); } };
      cut(A1, A2, v, 'A');
      const xB = C[0], B1 = [xB, -1.4], B2 = [xB, W + 1.4]; cut(B1, B2, [1, 0], 'B');
      // cotes
      D.dim(0, 0, ob, 0, 'ouverture biaise ' + f2(ob), -1.0, null, { size: 0.9 });
      D.dim(xmax + 0.6, 0, xmax + 0.6, W, 'LARGE ' + f2(W), -0.01, null, { size: 0.9 });
      sText(D, xmin + 0.4, W + 0.9, 'bord gauche', { a: 'start', size: 0.85, i: 1 }); sText(D, xmin + 0.4, -0.9, 'bord droit', { a: 'start', size: 0.85, i: 1 });
      return D.toString();
    }

    /* ---------- coupe B-B (transversale, vue dans le sens de la voie portée) ---------- */
    function coupeBB(d, R, conv) {
      const ws = [d.etrotg, d.egau, d.esurch, d.edroi, d.etrotd];
      let W = d.large; const sum = ws.reduce((a, b) => a + b, 0); if (!(W > 0)) W = sum || 10;
      const hReal = d.hautl, e1 = d.e1, e3 = d.e3, hc = d.hchau, hs = d.hsrem;
      const h = conv ? 0 : Math.min(hReal, Math.max(1.5, W * 0.14));
      const hcap = Math.max(1.0, W * 0.1), brk = hs > hcap * 1.15, hsD = brk ? hcap : hs;
      const top = conv ? e3 : h + e3, rd = top + hsD + hc;
      const x0 = (W - sum) / 2, xs = [x0]; for (const w of ws) xs.push(xs[xs.length - 1] + w);
      const yTop = rd + (conv ? 2.3 : 3.2);
      const D = G.OTUI.svg({ x0: -1.4, y0: conv ? -1.2 : -e1 - 0.9, x1: W + 1.6, y1: yTop }, { pad: 0.03 }), u = D.u;
      if (!conv) { D.soil([[-1.4, -e1], [W + 1.6, -e1]], 0.6); D.rect(0, -e1, W, e1, 'b'); if (d.hremb > 0) D.fill([[0, 0], [W, 0], [W, Math.min(d.hremb, h * 0.9)], [0, Math.min(d.hremb, h * 0.9)]]);
        sText(D, W / 2, h * 0.55, 'ouverture — hauteur libre ' + f2(hReal) + ' m' + (hReal > h ? ' (hauteur réduite sur le dessin)' : ''), { size: 0.85, i: 1, c: '#7a7e8e' });
        if (hReal > h) for (const x of [-0.5, W + 0.5]) zig(D, x - 0.4, x + 0.4, h * 0.5); }
      D.rect(0, top - e3, W, e3, 'b');
      if (hsD > 0) D.fill([[0, top], [W, top], [W, top + hsD], [0, top + hsD]]);
      if (brk) { zig(D, -0.6, W + 0.6, top + hsD * 0.5); }
      D.rect(xs[1], top + hsD, xs[4] - xs[1], Math.max(hc, u * 0.45), 'road');
      if (ws[0] > 0) D.rect(xs[0], top + hsD, ws[0], hc + 0.18, 'b2');
      if (ws[4] > 0) D.rect(xs[4], top + hsD, ws[4], hc + 0.18, 'b2');
      // dispositifs (de principe) en rive
      for (const x of [xs[0] + 0.1, xs[5] - 0.1]) { sLine(D, [[x, rd + (ws[0] > 0 || ws[4] > 0 ? 0.18 : 0)], [x, rd + 0.9]], 'stroke:#5d5545;stroke-width:2px'); sLine(D, [[x - 0.12, rd + 0.9], [x + 0.12, rd + 0.9]], 'stroke:#5d5545;stroke-width:2px'); }
      const nv = Math.max(1, Math.round(d.nvoi) || 1), lw = ws[2] / nv;
      for (let i = 1; i < nv; i++) { const xx = xs[2] + lw * i; sLine(D, [[xx, rd + 0.01], [xx, rd + 0.01 + u * 0.4]], 'stroke:#fff;stroke-width:2px'); }
      if (conv) { for (let i = 0; i < nv; i++) { D.dim(xs[2] + lw * i, -0.5, xs[2] + lw * (i + 1), -0.5, 'voie ' + (i + 1) + ' : ' + f2(lw), 0.01, null, { size: 0.75 }); } }
      if (!conv) {
        const names = ['ETROTG', 'EGAU', 'ESURCH', 'EDROI', 'ETROTD'], yy = rd + 1.25;
        names.forEach((k, i) => { if (ws[i] > 0) { D.dim(xs[i], yy, xs[i + 1], yy, f2(ws[i]), 0.01, null, { size: ws[i] < 1 ? 0.8 : 1.0 }); sText(D, (xs[i] + xs[i + 1]) / 2, yy + u * 3.4, k, { size: ws[i] < 1 ? 0.7 : 0.85, mono: 1, b: 1, c: GOLD }); } });
        D.dim(0, rd + 2.45, W, rd + 2.45, 'LARGE ' + f2(W), 0.01, null, { size: 1.0 });
        sText(D, xs[2] + ws[2] / 2, rd + 0.45, nv + ' voie' + (nv > 1 ? 's' : '') + ' de ' + f2(lw) + ' m', { size: 0.85, i: 1, c: '#7a7e8e' });
        if (hs > 0) D.dim(W + 0.7, top, W + 0.7, top + hsD, 'HSREM ' + f2(hs), -0.01, null, { size: 0.8 });
        D.dim(-0.7, top - e3, -0.7, top, 'E3 ' + f2(e3), 0.01, null, { size: 0.8 });
        sText(D, -1.2, rd + 0.5, 'G', { b: 1, size: 0.9 }); sText(D, W + 1.4, rd + 0.5, 'D', { b: 1, size: 0.9 });
      }
      return { D, xs, rd, W, nv, lw, u };
    }

    /* ---------- charges d'exploitation placées sur la coupe B-B (principe Fasc. 61 titre II) ---------- */
    function convois(d, R) {
      const out = [];
      const truck = (D, c, y, enc, ent, wt, lab) => { const u = D.u; D.rect(c - enc / 2, y + 0.42, enc, 0.95, 'car'); for (const s of [-1, 1]) D.rect(c + s * ent / 2 - wt / 2, y, wt, 0.42, 'wheel'); sText(D, c, y + 0.9, lab, { size: 0.75, b: 1 }); void u; };
      const mk = (title, draw, note) => { const g = coupeBB(d, R, true); draw(g); return fig(title, fit(g.D.toString(), 230) + (note ? `<div style="font:10.5px 'Courier New',monospace;color:#3c3f4d;margin-top:2px">${esc(note)}</div>` : '')); };
      const dyn = R.dyn || {}, cv = R.conv || {};
      const axl = k => (cv[k] && cv[k].axles || []).map(a => fmt(a.P, 0)).join('-') + ' t';
      if (d.bc && cv.BC) out.push(mk(`SYSTÈME Bc — ${Math.max(1, Math.round(d.nvoi))} FILE(S)`, g => { for (let i = 0; i < g.nv; i++) { const c = g.xs[2] + g.lw * (i + 0.5); truck(g.D, c, g.rd, 2.5, 2.0, 0.25, 'Bc'); } },
        `essieux ${axl('BC')} · ${cv.BC.trucks || 2} camions par file · δ = ${fmt(dyn.BC && dyn.BC.d, 3)}`));
      if (d.mc && cv.MC) out.push(mk('CHAR Mc120', g => { const c = (g.xs[2] + g.xs[3]) / 2; g.D.rect(c - 1.65, g.rd, 1.0, 0.3, 'wheel'); g.D.rect(c + 0.65, g.rd, 1.0, 0.3, 'wheel'); g.D.rect(c - 1.65, g.rd + 0.3, 3.3, 1.05, 'car'); sText(g.D, c, g.rd + 0.82, 'Mc120', { size: 0.75, b: 1 });
        g.D.dim(c - 1.65, g.rd + 1.35, c + 1.65, g.rd + 1.35, '3.30', 0.5, null, { size: 0.7 }); },
        `${fmt(cv.MC.axles[0].P, 0)} t · 2 chenilles de 1.00 m · δ = ${fmt(dyn.MC && dyn.MC.d, 3)} · position transversale de principe`));
      if (d.ex && cv.E) out.push(mk('CONVOI EXCEPTIONNEL E', g => { const c = g.xs[2] + 3.5; g.D.rect(c - 3.5, g.rd + 0.3, 7.0, 1.05, 'car'); g.D.rect(c - 3.5, g.rd, 7.0, 0.3, 'wheel'); sText(g.D, c, g.rd + 0.82, 'E', { size: 0.8, b: 1 });
        g.D.dim(c - 3.5, g.rd + 1.37, c + 3.5, g.rd + 1.37, '7.00', 0.5, null, { size: 0.7 }); },
        `2 × ${fmt(cv.E.axles[0].P, 0)} t à ${fmt(cv.E.axles[1] ? cv.E.axles[1].x : 0, 2)} m · encombrement 7.00 m · axe à 3.50 m du bord gauche de ESURCH · δ = 1.000`));
      if (R.charges && R.charges.chantier && cv.EC && d.ec) out.push(mk(`ENGIN DE CHANTIER ${d.ec.nom} (PHASE DE CHANTIER)`, g => { const xg = (g.W - (d.etrotg + d.egau + d.esurch + d.edroi + d.etrotd)) / 2, c = xg + d.ec.egau + 3.0; truck(g.D, c, g.rd, 4.0, 2.4, 0.6, d.ec.nom);
        g.D.dim(xg, g.rd + 1.75, xg + d.ec.egau, g.rd + 1.75, 'EGAU ' + f2(d.ec.egau), 0.01, null, { size: 0.65 }); g.D.dim(xg + d.ec.egau, g.rd + 1.75, xg + d.ec.egau + d.ec.esurch, g.rd + 1.75, 'ESURCH ' + f2(d.ec.esurch), 0.01, null, { size: 0.65 }); },
        `essieux ${axl('EC')} · encombrement 4.00 m · axe à 3.00 m du bord gauche de ESURCH (chantier)`));
      return out;
    }

    /* ---------- position longitudinale des convois (moment max à mi-portée de la traverse supérieure) ---------- */
    function positions(d, R) {
      const L = R.geom.L, Ld = R.geom.Ld || 0, H = 0, e = R.env.t[R.env.t.length - 1];
      const keys = [['EC', 'ENGIN ' + (d.ec && d.ec.nom || 'EC')], ['BC', 'Bc'], ['BT', 'Bt'], ['MC', 'Mc120'], ['ME', 'Me120'], ['E', 'E']]
        .filter(([k]) => e[k + '+'] && e[k + '+'].pos && e[k + '+'].v && R.conv[k]);
      if (!keys.length) return '';
      const rowH = 2.3, n = keys.length, xa = -Ld - 2.5, xb = L + Ld + 1.5;
      const D = G.OTUI.svg({ x0: xa - 3.2, y0: -n * rowH - 0.6, x1: xb, y1: 1.4 }, { pad: 0.02 }), u = D.u;
      keys.forEach(([k, nm], j) => {
        const y = -j * rowH - 1.6, p = e[k + '+'].pos, cv = R.conv[k];
        sPoly(D, [[0, y - 0.18], [L, y - 0.18], [L, y], [0, y]], 'fill:#e9e3d6;stroke:#5d5545;stroke-width:1px;vector-effect:non-scaling-stroke');
        if (Ld > 0) for (const [a, b2] of [[-Ld, 0], [L, L + Ld]]) sPoly(D, [[a, y - 0.12], [b2, y - 0.12], [b2, y], [a, y]], 'fill:#d9d1c0;stroke:#5d5545;stroke-width:.6px;vector-effect:non-scaling-stroke');
        for (const x of [0, L]) sLine(D, [[x, y - 0.18], [x, y - 0.5]], 'stroke:#5d5545;stroke-width:1.4px');
        sLine(D, [[L / 2, y + 0.2], [L / 2, y - 0.6]], `stroke:${RED};stroke-width:.8px;stroke-dasharray:3 2`);
        sText(D, xa - 3.0, y + 0.45, nm, { a: 'start', size: 0.8, b: 1 });
        sText(D, xa - 3.0, y - 0.35, 'M = ' + f1(e[k + '+'].v) + ' kN·m', { a: 'start', size: 0.62, c: RED });
        for (let t = 0; t < p.nt; t++) for (const ax of cv.axles) {
          const x = (p.xs ? p.xs[t] : p.x0) + p.dir * (ax.x + (p.xs ? 0 : t * (cv.gapTruck || 0)));
          if (x < xa || x > xb) continue;
          const a = ax.a || 0;
          if (a > 2) sPoly(D, [[x - a / 2, y + 0.02], [x + a / 2, y + 0.02], [x + a / 2, y + 0.35], [x - a / 2, y + 0.35]], 'fill:#a07828;fill-opacity:.25;stroke:#a07828;stroke-width:.8px;vector-effect:non-scaling-stroke');
          sLine(D, [[x, y + 1.05], [x, y + 0.08]], `stroke:${GOLD};stroke-width:1.6px`); arrow(D, x, y + 0.02, 0, -1, u * 1.1, GOLD);
          sText(D, x, y + 1.32, fmt(ax.P, 0), { size: 0.6, c: GOLD, b: 1 });
        }
      });
      sText(D, L / 2, 1.0, 'mi-portée', { size: 0.65, c: RED, i: 1 });
      sText(D, 0, 1.0, 'angle', { size: 0.65, i: 1 }); sText(D, L, 1.0, 'angle', { size: 0.65, i: 1 });
      void H;
      return D.toString();
    }

    /* ---------- croquis de repérage d'un élément (abscisses du listing) ---------- */
    function key(R, el) {
      const L = R.geom.L, H = R.geom.H;
      const D = G.OTUI.svg({ x0: -1.2, y0: -1.2, x1: L + 1.2, y1: H + 1.2 }, { pad: 0.04 }), u = D.u;
      sLine(D, [[0, 0], [L, 0], [L, H], [0, H], [0, 0]], 'stroke:#b9ad92;stroke-width:5px');
      const seg = el === 't' ? [[0, H], [L, H]] : el === 'b' ? [[0, 0], [L, 0]] : [[0, 0], [0, H]];
      sLine(D, seg, `stroke:${RED};stroke-width:6px`);
      if (el === 'w') sLine(D, [[L, 0], [L, H]], `stroke:${RED};stroke-width:6px;opacity:.35`);
      const o = seg[0], dir = el === 'w' ? [0, 1] : [1, 0], m = el === 'w' ? H / 2 : L / 2;
      D.circle(o[0], o[1], u * 0.9, 'b');
      const off = el === 't' ? [0, 0.6] : el === 'b' ? [0, -0.6] : [-0.6, 0];
      sLine(D, [[o[0] + off[0], o[1] + off[1]], [o[0] + off[0] + dir[0] * m, o[1] + off[1] + dir[1] * m]], `stroke:${GREY};stroke-width:1px`);
      arrow(D, o[0] + off[0] + dir[0] * m, o[1] + off[1] + dir[1] * m, dir[0], dir[1], u * 2, GREY);
      sText(D, o[0] + off[0] * 1.8 + dir[0] * m / 2, o[1] + off[1] * 1.8 + dir[1] * m / 2, 'x', { size: 1.6, i: 1 });
      sText(D, L / 2, H / 2, el === 'w' ? 'piédroits' : el === 't' ? 'traverse supérieure' : 'traverse inférieure', { size: 1.7, c: RED });
      sText(D, o[0] + (el === 'w' ? -u * 2 : 0), o[1] + (el === 'b' ? -u * 4 : el === 't' ? u * 4 : -u * 2), 'origine', { size: 1.3, i: 1, a: el === 'w' ? 'end' : 'middle' });
      return D.toString();
    }

    /* ---------- diagrammes sur le cadre (côté fibre tendue) ---------- */
    function frameDiagram(R, lim) {
      const L = R.geom.L, H = R.geom.H, C = R.cmp;
      const mx = lim === 'U' ? 'maxU' : 'maxS', mn = lim === 'U' ? 'minU' : 'minS';
      const half = arr => { const a = arr.map(c => [c.x, c.design[mx], c.design[mn]]), r = a.slice(0, -1).reverse().map(([x, p, q]) => [2 * a[a.length - 1][0] - x, p, q]); return a.concat(r); };
      const T = half(C.t), B = half(C.b), Wl = C.w.map(c => [c.x, c.design[mx], c.design[mn]]);
      let M = 1e-9; for (const a of [T, B, Wl]) for (const r of a) M = Math.max(M, Math.abs(r[1]), Math.abs(r[2]));
      const k = 0.2 * Math.min(L, H) / M;
      const els = [
        { pts: T, base: x => [x, H], n: [0, -1] }, { pts: B, base: x => [x, 0], n: [0, 1] },
        { pts: Wl, base: y => [0, y], n: [1, 0] }, { pts: Wl, base: y => [L, y], n: [-1, 0] }];
      const pad = 0.2 * Math.min(L, H) + 1.0;
      const D = G.OTUI.svg({ x0: -pad, y0: -pad, x1: L + pad, y1: H + pad }, { pad: 0.03 }), u = D.u;
      sLine(D, [[0, 0], [L, 0], [L, H], [0, H], [0, 0]], 'stroke:#5d5545;stroke-width:2px');
      for (const E of els) for (const [j, col] of [[1, RED], [2, BLUE]]) {
        const cur = E.pts.map(r => { const b = E.base(r[0]); return [b[0] + E.n[0] * k * r[j], b[1] + E.n[1] * k * r[j]]; });
        const b0 = E.base(E.pts[0][0]), b1 = E.base(E.pts[E.pts.length - 1][0]);
        sPoly(D, [b0].concat(cur, [b1]), `fill:${col};fill-opacity:.07;stroke:none`);
        sLine(D, cur, `stroke:${col};stroke-width:1.6px`);
      }
      // valeurs aux sections déterminantes
      const lab = (E, r, j, col, al) => { const b = E.base(r[0]); const v = r[j]; const p = [b[0] + E.n[0] * k * v, b[1] + E.n[1] * k * v];
        const close = Math.abs(k * (r[1] - r[2])) < u * 3.5, t = [Math.abs(E.n[1]), Math.abs(E.n[0])], sh = close ? (j === 1 ? 1 : -1) * u * 2.6 : 0;
        const o = Math.sign(v || 1); sText(D, p[0] + E.n[0] * o * u * 2.2 + t[0] * sh, p[1] + E.n[1] * o * u * 1.6 + t[1] * sh, f0(v), { size: 0.8, c: col, b: 1, a: al || 'middle' }); };
      const mid = a => a[Math.floor(a.length / 2)];
      for (const [E, i] of [[els[0], 0], [els[0], -1], [els[1], 0], [els[1], -1], [els[2], 'm']]) {
        const r = i === 0 ? E.pts[0] : i === -1 ? mid(E.pts) : E.pts[Math.floor(E.pts.length / 2)];
        lab(E, r, 1, RED); lab(E, r, 2, BLUE);
      }
      sText(D, L / 2, H / 2 + u * 1.5, 'M > 0 : fibre intérieure tendue', { size: 0.7, i: 1, c: '#7a7e8e' });
      sText(D, L / 2, H / 2 - u * 1.5, 'tracé côté fibre tendue', { size: 0.7, i: 1, c: '#7a7e8e' });
      return D.toString();
    }

    /* ---------- pressions sous la traverse inférieure ---------- */
    function pressions(R) {
      const L = R.geom.L, e1 = R.geom.e1, p = R.cmp.p, xs = [0, L / 4, L / 2, 3 * L / 4, L], id = [0, 1, 2, 1, 0];
      const smx = id.map(i => p[i].design.maxS), smn = id.map(i => p[i].design.minS), spm = id.map(i => p[i].perm.maxS);
      const M = Math.max(1e-9, ...smx.map(Math.abs), ...smn.map(Math.abs)), k = 0.28 * L / M;
      const D = G.OTUI.svg({ x0: -1.5, y0: -0.28 * L - 1.6, x1: L + 1.5, y1: e1 + 1.6 }, { pad: 0.03 }), u = D.u;
      D.rect(0, 0, L, e1, 'b'); sText(D, L / 2, e1 / 2, 'TRAVERSE INFÉRIEURE', { size: Math.min(0.75, e1 / u / 2.6), c: '#5d5545' });
      const cur = v => xs.map((x, i) => [x, -k * v[i]]);
      sPoly(D, [[0, 0]].concat(cur(smx), [[L, 0]]), `fill:${RED};fill-opacity:.08;stroke:none`);
      sLine(D, cur(smx), `stroke:${RED};stroke-width:1.8px`); sLine(D, cur(smn), `stroke:${BLUE};stroke-width:1.8px`);
      sLine(D, cur(spm), `stroke:${GREY};stroke-width:1.2px;stroke-dasharray:6 4`);
      xs.forEach((x, i) => { sLine(D, [[x, 0], [x, -k * smx[i]]], 'stroke:#b9ad92;stroke-width:.8px');
        if (Math.abs(smx[i]) > M * 0.04) arrow(D, x, -0.02, 0, 1, u * 1.1, '#7a7e8e');
        sText(D, x, -k * smx[i] - u * 1.6, f1(smx[i]), { size: 0.75, c: RED, b: 1 });
        sText(D, x + (i === 4 ? -u * 2.5 : u * 2.5), -k * smn[i] + u * 1.3, f1(smn[i]), { size: 0.7, c: BLUE, b: 1 });
        sText(D, x, e1 + u * 1.6, ['0', 'L/4', 'L/2', '3L/4', 'L'][i], { size: 0.7, mono: 1 }); });
      D.dim(0, e1 + u * 3.2, L, e1 + u * 3.2, 'L = ' + f2(L) + ' m (portée de calcul, abscisses du listing)', 0.01, null, { size: 0.7 });
      return D.toString();
    }

    /* ---------- ferraillage longitudinal et épure d'arrêt des barres ---------- */
    function ferraillage(d, R) {
      const L = R.geom.L, H = R.geom.H, s = R.geom.s || 1, e1 = d.e1, e3 = d.e3, e2s = d.e2 / s, ep = R.det && R.det.epure;
      if (!ep) return '';
      const D = G.OTUI.svg({ x0: -e2s / 2 - 1.4, y0: -e1 / 2 - 1.2, x1: L + e2s / 2 + 1.4, y1: H + e3 / 2 + 1.2 }, { pad: 0.03 }), u = D.u;
      sPoly(D, [[-e2s / 2, -e1 / 2], [L + e2s / 2, -e1 / 2], [L + e2s / 2, H + e3 / 2], [-e2s / 2, H + e3 / 2]], 'fill:#e9e3d6;stroke:#5d5545;stroke-width:1.2px;vector-effect:non-scaling-stroke');
      sPoly(D, [[e2s / 2, e1 / 2], [L - e2s / 2, e1 / 2], [L - e2s / 2, H - e3 / 2], [e2s / 2, H - e3 / 2]], 'fill:#fff;stroke:#5d5545;stroke-width:1.2px;vector-effect:non-scaling-stroke');
      const c = Math.max(0.07, u * 0.9), gap = Math.max(0.06, u * 0.8);
      const bar = (pts, col, fam) => sLine(D, pts, `stroke:${col};stroke-width:${fam ? 1.6 : 2}px;${fam ? 'stroke-dasharray:7 3;' : ''}stroke-linecap:round`);
      const tag = (x, y, t, col, a) => sText(D, x, y, t, { size: 0.62, c: col, b: 1, a: a || 'middle', mono: 1 });
      const mir = pts => pts.map(([x, y]) => [L - x, y]);
      // intérieur
      (ep.TS.bars || []).forEach((b, i) => { const y = H - e3 / 2 + c + i * gap; bar([[b[0], y], [b[1], y]], RED, i); if (i === 0) tag((b[0] + b[1]) / 2, y + gap * 2.4, 'TS-I', RED); });
      (ep.TI.bars || []).forEach((b, i) => { const y = e1 / 2 - c - i * gap; bar([[b[0], y], [b[1], y]], RED, i); if (i === 0) tag((b[0] + b[1]) / 2, y - gap * 2.6, 'TI-I', RED); });
      (ep.PD.bars || []).forEach((b, i) => { const x = e2s / 2 - c - i * gap; bar([[x, b[0]], [x, b[1]]], RED, i); bar(mir([[x, b[0]], [x, b[1]]]), RED, i); if (i === 0) tag(x + gap * 4, (b[0] + b[1]) / 2, 'P-I', RED, 'start'); });
      // extérieur
      (ep.AS.bars || []).forEach((b, i) => { const x = -e2s / 2 + c + i * gap, y = H + e3 / 2 - c - i * gap; const pts = [[x, b[0]], [x, y], [b[1], y]]; bar(pts, BLUE, i); bar(mir(pts), BLUE, i); if (i === 0) tag(b[1] + u, y + gap * 2.6, 'AS-E', BLUE, 'start'); });
      (ep.AI.bars || []).forEach((b, i) => { const x = -e2s / 2 + c + i * gap, y = -e1 / 2 + c + i * gap; const pts = [[x, b[0]], [x, y], [b[1], y]]; bar(pts, BLUE, i); bar(mir(pts), BLUE, i); if (i === 0) tag(b[1] + u, y - gap * 2.8, 'AI-E', BLUE, 'start'); });
      D.dim(0, -e1 / 2 - 0.7, L, -e1 / 2 - 0.7, 'L = ' + f2(L) + ' (entre lignes moyennes, selon l\'axe de la voie portée)', 0.01, null, { size: 0.7 });
      D.dim(L + e2s / 2 + 0.7, 0, L + e2s / 2 + 0.7, H, 'H = ' + f2(H), -0.01, null, { size: 0.7 });
      return D.toString();
    }

    /* ---------- assemblage ---------- */
    function figures(model, R, pages) {
      if (!R || !R.geom || !R.cmp || !Array.isArray(pages)) return [];
      const d = R.donnees || {}, L = R.geom.L, H = R.geom.H, list = [];
      const find = re => pages.findIndex(p => re.test(p));
      const isCont = p => { const l = String(p).split('\n').slice(2).map(x => x.trim()).filter(Boolean); return l.length > 0 && /^-?\d/.test(l[0]); };
      const last = i => { if (i < 0) return i; while (i + 1 < pages.length && isCont(pages[i + 1])) i++; return i; };
      const add = (i, mk) => { if (i >= 0) list.push({ after: i, mk }); };
      const cap = s => s;
      const hasEC = !!(R.charges && R.charges.chantier);

      // 1. ouvrage à l'échelle
      add(find(/HAUTEUR LIBRE/), n => G.OTUI.figPage(`PLANCHE ${n} — OUVRAGE À L'ÉCHELLE (COUPE A-A, VUE EN PLAN, COUPE TRANSVERSALE B-B)`,
        `biais ${fmt(d.biais, 2)} gr · cotes en m`,
        fig("COUPE A-A — PERPENDICULAIRE AUX PIÉDROITS (COUPE DROITE)", fit(coupeAA(d, R), 430), true)
        + fig('VUE EN PLAN — BIAIS, AXE DE LA VOIE PORTÉE, PIÉDROITS' + (d.ldalt > 0 ? ', DALLES DE TRANSITION' : '') + ', TRAITS DE COUPE', fit(plan(d), 360))
        + fig('COUPE B-B — TRANSVERSALE (VUE DANS LE SENS DE LA VOIE PORTÉE)', fit(coupeBB(d, R, false).D.toString(), 360)),
        cap(`A-A est une coupe droite (perpendiculaire aux piédroits) : l'ouverture OUVER = ${f2(d.ouver)} m et les épaisseurs y sont vraies. `
          + `Le calcul est mené selon l'axe de la voie portée : portée biaise L = (OUVER + E2)/sin(biais) = ${f2(L)} m, hauteur moyenne H = ${f2(H)} m (lignes moyennes en tireté). `
          + `B-B est perpendiculaire à l'axe de la voie portée ; profil vu dans le sens de la voie portée (gauche à gauche). Dalles de transition : épaisseur de principe.`)));

      // 2. convois sur la coupe transversale
      const cv = convois(d, R);
      if (cv.length) add(find(/COEFFICIENTS DE MAJORATION DYNAMIQUE/), n => G.OTUI.figPage(`PLANCHE ${n} — CHARGES D'EXPLOITATION SUR LA COUPE TRANSVERSALE B-B`,
        `${Math.round(d.nvoi)} voie(s) de ${f2(d.esurch / Math.max(1, Math.round(d.nvoi)))} m sur ESURCH = ${f2(d.esurch)} m`, cv.join(''),
        'Disposition transversale de principe des convois du fascicule 61 titre II retenus au bordereau ; essieux et coefficients de majoration dynamique δ du calcul. La position la plus défavorable est recherchée par le programme (coefficients de répartition transversale).'));

      // 3. position des convois pour le moment max à mi-portée de la traverse supérieure
      const ps = positions(d, R);
      if (ps) add(last(find(/POSITION DES SURCHARGES CORRESPONDANT AUX MOMENTS EXTREMES DANS LA TRAVERSE SUPERIEURE/)), n => G.OTUI.figPage(
        `PLANCHE ${n} — POSITION DES CONVOIS : MOMENT MAXIMAL À MI-PORTÉE DE LA TRAVERSE SUPÉRIEURE`, 'charges en t · abscisses comptées à partir de l\'angle',
        fig('', fit(ps, 420), true), `Essieux placés aux positions trouvées par le calcul (lignes d'influence de la traverse supérieure, portée L = ${f2(L)} m${R.geom.Ld > 0 ? `, dalles de transition de ${f2(R.geom.Ld)} m en biais` : ''}). M : moment longitudinal correspondant (sans pondération), repris du tableau des moments extrêmes.`));

      // 4. enveloppes des moments par élément
      const DETL = ['ANGLE SUP.', 'ANGLE INF.', '1/2 TR SUP', '1/2 TR INF', '1/4 TR INF', '1/2 PIEDR.'];
      const envM = (el, re, nm, marks, detIdx, xlab, down) => add(last(find(re)), n => {
        const C = R.cmp[el], x = C.map(c => c.x);
        const ser = [
          { y: C.map(c => c.design.maxU), cls: 'mx' }, { y: C.map(c => c.design.minU), cls: 'mn' },
          { y: C.map(c => c.design.maxS), cls: 'mx', dash: 1 }, { y: C.map(c => c.design.minS), cls: 'mn', dash: 1 },
          { y: C.map(c => c.perm.maxS), cls: 'perm' }, { y: C.map(c => c.perm.minS), cls: 'perm', dash: 1 }];
        const ch = legend([['ELU max', RED], ['ELU min', BLUE], ['ELS max', RED, 1], ['ELS min', BLUE, 1], ['permanent ELS max', GREY], ['permanent ELS min', GREY, 1]])
          + G.OTUI.chart({ x, series: ser, fill: [[0, 1]], down, xlab, ylab: 'M (kN·m)', marks, xticks: ticks(x), w: 900, h: 330, labels: 'none' });
        const rows = detIdx.map(k => { const c = R.cmp.det[k]; return c ? [DETL[k], f0(c.design.maxS), f0(c.design.minS), f0(c.design.maxU), f0(c.design.minU)] : [DETL[k], '', '', '', '']; });
        const ext = ['maxU', 'minU'].map(q => { let im = 0; C.forEach((c, i) => { if (q === 'maxU' ? c.design[q] > C[im].design[q] : c.design[q] < C[im].design[q]) im = i; }); return [q === 'maxU' ? 'ELU max' : 'ELU min', f2(C[im].x), f0(C[im].design[q])]; });
        return G.OTUI.figPage(`PLANCHE ${n} — ENVELOPPE DES MOMENTS FLÉCHISSANTS — ${nm}`, `moments de calcul (kN·m) · ${down ? 'M > 0 vers le bas' : 'M > 0 vers le haut'} = fibre intérieure tendue`,
          fig('', ch, true)
          + fig('REPÉRAGE DE L\'ÉLÉMENT ET DES ABSCISSES', fit(key(R, el), 200))
          + fig('SECTIONS DÉTERMINANTES (kN·m)', tab(['section', 'ELS max', 'ELS min', 'ELU max', 'ELU min'], rows) + '<div style="height:8px"></div>' + tab(['extremum', 'abscisse (m)', 'M (kN·m)'], ext)),
          'Courbes reprises des colonnes « MOMENTS DE CALCUL E.L.S. / E.L.U. » et « CHARGE PERM. E.L.S. » du tableau précédent'
          + (el === 'w' ? '.' : ` (demi-traverse : le cadre est symétrique, abscisses de 0 à L/2 = ${f2(L / 2)} m).`));
      });
      envM('b', /MOMENTS FLECHISSANTS EXTREMES \(KN\*M\) DANS LA TRAVERSE INFERIEURE/, 'TRAVERSE INFÉRIEURE',
        [{ x: 0, label: 'angle' }, { x: L / 4, label: '1/4' }, { x: L / 2, label: '1/2' }], [1, 4, 3], "abscisse à partir de l'angle (m)", false);
      envM('t', /MOMENTS FLECHISSANTS EXTREMES \(KN\*M\) DANS LA TRAVERSE SUPERIEURE/, 'TRAVERSE SUPÉRIEURE',
        [{ x: 0, label: 'angle' }, { x: L / 2, label: '1/2' }], [0, 2], "abscisse à partir de l'angle (m)", true);
      envM('w', /MOMENTS FLECHISSANTS EXTREMES \(KN\*M\) DANS LES PIEDROITS/, 'PIÉDROITS',
        [{ x: 0, label: 'base' }, { x: H / 2, label: '1/2' }, { x: H, label: 'tête' }], [5], 'abscisse à partir de la base (m)', false);

      // 5. synthèse : moments sur le cadre
      add(last(find(/MOMENTS FLECHISSANTS EXTREMES \(KN\*M\) DANS LES PIEDROITS/)), n => G.OTUI.figPage(`PLANCHE ${n} — SYNTHÈSE : MOMENTS DE CALCUL SUR LE CADRE`,
        `kN·m · cadre de calcul L = ${f2(L)} m × H = ${f2(H)} m (lignes moyennes)`,
        fig('ÉTAT LIMITE ULTIME — ENVELOPPES MAX / MIN', fit(frameDiagram(R, 'U'), 380)) + fig('ÉTAT LIMITE DE SERVICE — ENVELOPPES MAX / MIN', fit(frameDiagram(R, 'S'), 380)),
        'Rouge : moments maximaux ; bleu : moments minimaux. Diagrammes tracés côté fibre tendue (M > 0 vers l\'intérieur du cadre). Traverses complétées par symétrie ; piédroit droit symétrique du piédroit gauche. Valeurs aux angles, à mi-traverse et à mi-hauteur des piédroits.'));

      // 6. enveloppes des efforts tranchants
      const vch = (el, nm, xlab) => { const C = R.cmp['V' + el]; if (!C || !C.length) return '';
        return fig(nm, G.OTUI.chart({ x: C.map(c => c.x), series: [{ y: C.map(c => c.design.maxU), name: 'ELU max', cls: 'mx' }, { y: C.map(c => c.design.minU), name: 'ELU min', cls: 'mn' },
          { y: C.map(c => c.perm.maxU), name: 'permanent ELU max', cls: 'perm' }, { y: C.map(c => c.perm.minU), name: 'permanent ELU min', cls: 'perm', dash: 1 }], fill: [[0, 1, 'b']], xlab, ylab: 'V (kN)', xticks: ticks(C.map(c => c.x)), w: 900, h: 250 }).replace(/(<svg[^>]*>)/, '$1').replace(/<text[^>]*class="vl perm"[^>]*>[^<]*<\/text>/g, ''), true); };
      add(last(find(/EFFORTS TRANCHANTS EXTREMES DANS LES PIEDROITS/)), n => G.OTUI.figPage(`PLANCHE ${n} — ENVELOPPES DES EFFORTS TRANCHANTS (E.L.U.)`, 'kN · abscisses comme le listing',
        vch('b', 'TRAVERSE INFÉRIEURE', "abscisse à partir de l'angle (m)") + vch('t', 'TRAVERSE SUPÉRIEURE', "abscisse à partir de l'angle (m)") + vch('w', 'PIÉDROITS', 'abscisse à partir de la base (m)'),
        'Courbes reprises des colonnes « EFFORTS TRANCHANTS E.L.U. » et « CHARGE PERM. E.L.U. » des trois tableaux précédents.'));

      // 7. pressions sur le sol
      if (R.cmp.p && R.cmp.p.length >= 3) add(find(/PRESSION SUR LE SOL/), n => G.OTUI.figPage(`PLANCHE ${n} — PRESSIONS SUR LE SOL SOUS LA TRAVERSE INFÉRIEURE (E.L.S.)`,
        `MPa/1000 (kPa) · module du sol ESOL = ${f2(d.esol)} MPa`, fig('', fit(pressions(R), 380), true)
        + fig('VALEURS DU LISTING (MPa/1000)', tab(['section', 'abscisse (m)', 'perm. max', 'perm. min', 'max E.L.S.', 'min E.L.S.'], ['0.', '1/4', '1/2'].map((s, i) => { const c = R.cmp.p[i]; return [s, f2([0, L / 4, L / 2][i]), f1(c.perm.maxS), f1(c.perm.minS), f1(c.design.maxS), f1(c.design.minS)]; }))),
        'Rouge : pression maximale ; bleu : pression minimale ; tireté : charges permanentes (max). Calcul sur appui élastique ; valeurs du listing aux sections 0, L/4, L/2, complétées par symétrie.'));

      // 8. ferraillage et épure d'arrêt des barres
      const fr = R.fer, ep = R.det && R.det.epure;
      if (fr && ep) add(find(/EPURE D'ARRET DES BARRES/), n => {
        const ph = i => fmt(d.phi[i], 0);
        const frow = (nm, o) => o ? [nm, fmt(o.Amin * 1e4, 2), fmt(o.A * 1e4, 2), (o.n === 2 ? '2 ' : '') + 'HA' + ph(o.phi), (o.n === 2 ? '2×' : '') + fmt(o.esp, 3), f1(o.ss), f1(o.sb)] : [nm, '', '', '', '', '', ''];
        const rowsF = [['angle sup. — traverse', fr.AS_T], ['angle sup. — piédroit', fr.AS_P], ['angle inf. — traverse', fr.AI_T], ['angle inf. — piédroit', fr.AI_P], ['traverse sup. (int.)', fr.TS], ['traverse inf. (int.)', fr.TI], ['piédroit (int.)', fr.PD]].map(([a, b]) => frow(a, b));
        const rowsE = [];
        for (const [k, nm] of [['TS', 'TS-I'], ['TI', 'TI-I'], ['PD', 'P-I']]) (ep[k].bars || []).forEach((b, i) => rowsE.push([`${nm} (${i + 1})`, 'HA' + ph(ep[k].phi), fmt(ep[k].esp, 3), f2(b[0]), f2(b[1]), f2(b[1] - b[0])]));
        for (const [k, nm] of [['AS', 'AS-E'], ['AI', 'AI-E']]) (ep[k].bars || []).forEach((b, i) => rowsE.push([`${nm} (${i + 1})`, 'HA' + ph(ep[k].phi), Math.abs((R.geom.s || 1) - 1) > 1e-6 ? `${fmt(ep[k].espP, 3)}-${fmt(ep[k].espT, 3)}` : fmt(ep[k].espT, 3), 'P ' + f2(b[0]), 'T ' + f2(b[1]), f2(b[2])]));
        return G.OTUI.figPage(`PLANCHE ${n} — FERRAILLAGE LONGITUDINAL ET ÉPURE D'ARRÊT DES BARRES`, 'cadre de calcul selon l\'axe de la voie portée · abscisses du listing',
          fig('', fit(ferraillage(d, R), 440), true)
          + fig('SECTIONS DÉTERMINANTES', tab(['section', 'A min cm²/m', 'A adoptée', 'barres', 'esp. (m)', 'σs MPa', 'σb MPa'], rowsF))
          + fig("ARRÊTS DES BARRES", tab(['barre', 'Ø', 'esp. (m)', 'origine', 'extrémité', 'longueur'], rowsE)),
          'Rouge : ferraillage intérieur (TS-I traverse supérieure, TI-I traverse inférieure, P-I piédroits) ; bleu : ferraillage extérieur des angles (AS-E, AI-E). Trait plein : famille (1) ; tireté : famille (2). '
          + 'Abscisses comptées à partir de l\'angle sur les traverses et de la base sur les piédroits ; pour les angles, P = abscisse d\'arrêt sur le piédroit, T = abscisse d\'arrêt sur la traverse. Enrobages et écartement des familles amplifiés pour la lisibilité.');
      });

      list.sort((a, b) => a.after - b.after);
      return list.map((f, i) => ({ after: f.after, html: f.mk(i + 1) }));
    }
    return { figures };
  })();

  G.PICF_UI = {
    prog: 'PICF-EL', engine: E, steps, get, set, checks, summary, blank, figures: FG.figures,
    numero: m => m.num || m.numero || '0001',
    extraTabs: [{ t: 'cof', label: 'Plan de coffrage', color: 'var(--teal)', render(m, r, el) { const b = G.PICF_PLANS.coffrage(m);
      G.OTPLAN.tab(el, { sheet: b.S, title: 'Plan de coffrage du cadre', sub: `A3 · coupe droite 1/${b.scC} · plan 1/${b.scPl} · coupe axiale 1/${b.scT}`, file: 'coffrage-PICF-' + (m.num || m.numero || 'cadre') }); } }],
    examples: [{ label: 'Passage inférieur 10 m, biais droit', text: EX1 }, { label: 'Ouvrage hydraulique 5,35 m sous 15 m de remblai', text: EX2 }],
    views: [
      { id: 'coupe', label: 'Coupe du cadre', draw: (svg, m) => drawCoupe(svg, m, false, false) },
      { id: 'travers', label: 'Profil en travers', draw: (svg, m) => drawTravers(svg, m, false) },
      { id: 'plan', label: 'Vue en plan', draw: (svg, m) => drawPlan(svg, m, false) },
    ],
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
