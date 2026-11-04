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

  G.PICF_UI = {
    prog: 'PICF-EL', engine: E, steps, get, set, checks, summary, blank,
    numero: m => m.num || m.numero || '0001',
    examples: [{ label: 'Passage inférieur 10 m, biais droit', text: EX1 }, { label: 'Ouvrage hydraulique 5,35 m sous 15 m de remblai', text: EX2 }],
    views: [
      { id: 'coupe', label: 'Coupe du cadre', draw: (svg, m) => drawCoupe(svg, m, false, false) },
      { id: 'travers', label: 'Profil en travers', draw: (svg, m) => drawTravers(svg, m, false) },
      { id: 'plan', label: 'Vue en plan', draw: (svg, m) => drawPlan(svg, m, false) },
    ],
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
