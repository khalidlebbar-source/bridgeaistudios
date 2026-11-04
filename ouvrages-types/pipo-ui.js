/* PIPO-EL — définition de la saisie guidée (portique ouvert en béton armé sur semelles, programme SETRA) */
(function (G) {
  'use strict';
  const { fmt, num } = G.OTUI;
  const E = G.PIPO;
  const CARDS = (G.PIPO_PARSE && G.PIPO_PARSE.CARDS) || {};
  /* styles propres aux dessins PIPO (flèches, armatures), en complément du socle */
  if (typeof document !== 'undefined' && !document.getElementById('pipo-css')) {
    const st = document.createElement('style'); st.id = 'pipo-css';
    st.textContent = '.ot svg text.dv{fill:#1a4fd6;font-family:Outfit,sans-serif}.ot svg .ah{fill:#5d5545}.ot svg .hl.ah{fill:#c0392b}.ot svg .lane{fill:#fff}'
      + '.ot svg .reb{fill:none;stroke:#2f3542;stroke-width:2.2px;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}'
      + '.ot svg .reb3{fill:none;stroke:#2f3542;stroke-width:1.2px;vector-effect:non-scaling-stroke}.ot svg .bar{fill:#2f3542}'
      + '.ot svg .hl.reb,.ot svg .hl.reb3{stroke:#c0392b}.ot svg .hl.bar,.ot svg .hl.wheel{fill:#c0392b}';
    document.head.appendChild(st);
  }

  /* ───── accès au modèle (clés « CARTE.VARIABLE » : A1.CLASSE, A2.HAUTL, S2.NES…) ───── */
  const get = (m, k) => {
    if (k === 'TITRE') return m.titre || '';
    if (k === 'SOUSTITRE') return m.soustitre || '';
    if (k === 'NUMERO') return m.numero || '';
    const [c, n] = k.split('.');
    if (c === 'A1') return (m.A1 || {})[n] ?? 0;
    return ((m.cartes || {})[c] || {})[n] ?? 0;
  };
  const set = (m, k, v) => {
    if (k === 'TITRE') { m.titre = String(v).toUpperCase(); return; }
    if (k === 'SOUSTITRE') { m.soustitre = String(v).toUpperCase(); return; }
    if (k === 'NUMERO') { m.numero = String(v).trim().slice(0, 8); return; }
    const [c, n] = k.split('.');
    if (c === 'A1') { m.A1 = m.A1 || {}; m.A1[n] = v; return; }
    m.cartes = m.cartes || {};
    if (!m.cartes[c]) {                    // carte facultative (S0–S4) : créée à la première saisie
      const o = {}; ((CARDS[c] || {}).f || []).forEach(f => { o[f[0]] = 0; });
      m.cartes[c] = o; m.present = (m.present || []).concat(c);
    }
    m.cartes[c][n] = v;
  };
  const V = (m, k) => { const x = num(get(m, k)); return isFinite(x) ? x : 0; };
  const onChange = (m, k, v) => {           // DALTRA et SUREMB sont complémentaires
    if (k === 'A1.DALTRA') set(m, 'A1.SUREMB', v ? 0 : 1);
    if (k === 'A1.SUREMB') set(m, 'A1.DALTRA', v ? 0 : 1);
  };

  /* ───── listes ───── */
  const chk = (k, code, label, help, def) => ({ k, code, label, type: 'chk', help, def });
  const S = (c, n, label, unit, dec, help, def) => ({ k: c + '.' + n, code: n, label, unit, dec, help, def });
  const ess = [1, 2, 3, 4, 5, 6];

  const steps = [
    { id: 'id', label: 'Identification', view: 'coupe', hint: 'Titre de la note (cartes 7 et 8), règlement de charges et calculs demandés (carte 1).', pages: [
      { label: 'Titre et règlement', groups: [
        { title: 'Titre de la note — cartes 7 et 8', flex: 5, cols: 3, fields: [
          { k: 'TITRE', code: 'CARTE 7', label: 'titre', type: 'txt', help: 'Titre (60 caractères au plus) : route ou autoroute, département, commune, obstacle franchi.' },
          { k: 'SOUSTITRE', code: 'CARTE 8', label: 'sous-titre', type: 'txt', help: 'Sous-titre (60 caractères au plus) : nature et numéro de l\'ouvrage.' },
          { k: 'NUMERO', code: 'N°', label: 'numéro', type: 'txt', help: 'Numéro du bordereau, rappelé dans l\'en-tête « BORDEREAU DES DONNEES DU PIPO N. … ».' },
        ] },
        { title: 'Règlement de charges', alt: true, flex: 3, cols: 2, fields: [
          { k: 'A1.CLASSE', code: 'CLASSE', label: 'du pont', type: 'sel', opts: [[1, '1re classe'], [2, '2e classe'], [3, '3e classe'], [0, '0 — voie nominale imposée (S0)']], help: 'Classe du pont (fascicule 61 titre II). 0 : la largeur de voie nominale et les coefficients a1, bc sont donnés en carte S0.', relayout: true },
          { k: 'A1.STATUT', code: 'STATUT', label: 'charges A et B', type: 'sel', opts: [[1, '1 — A et Bc du fasc. 61'], [2, '2 — A + type Bc (S2, S3)'], [3, '3 — type A (S1) + type Bc (S2, S3)'], [4, '4 — types A et Bc cumulés (S1–S3)']], help: 'Définition des charges : 1 = A et Bc réglementaires ; 2 à 4 = charges généralisées définies aux cartes S1, S2, S3.' },
        ] },
      ] },
      { label: 'Calculs demandés', groups: [
        { title: 'Lignes d\'influence', flex: 3, cols: 3, fields: [
          { k: 'A1.LU', code: 'LU', label: 'pas de calcul', type: 'sel', opts: [[1, '1 — pas 0,50 m'], [2, '2 — pas 0,25 m']], help: 'Facteur de précision : pas des lignes d\'influence et du déplacement des charges. Si la portée dépasse 13 m, LU = 1 obligatoirement.' },
          { k: 'A1.EXCENTR', code: 'EXCENTR', label: 'répartition transv.', type: 'sel', opts: [[1, '1 — Guyon-Massonnet'], [2, '2 — G.-M. + LI de K'], [0, '0 — K imposés (carte 5)']], help: 'Coefficients de répartition transversale : 1 = calculés (Guyon-Massonnet), 2 = idem avec leurs lignes d\'influence, 0 = valeurs imposées en carte 5.' },
          { k: 'A1.LIGNIN', code: 'LIGNIN', label: 'lignes d\'influence', type: 'sel', opts: [[1, '1 — moments long.'], [2, '2 — long. + transversal'], [0, '0 — non']], help: 'Impression des lignes d\'influence des moments longitudinaux aux cinq points principaux (1), et du moment transversal au centre de la traverse (2).' },
        ] },
        { title: 'Efforts calculés', alt: true, flex: 6, cols: 6, fields: [
          chk('A1.POUST', 'POUST', 'poussée des terres', 'Calcul des efforts dus à la poussée des terres (1 = oui).'),
          chk('A1.PERM', 'PERM', 'charges perm.', 'Calcul des efforts dus aux charges permanentes (1 = oui).'),
          chk('A1.MOMENT', 'MOMENT', 'enveloppes M', 'Courbes enveloppes des moments longitudinaux (1 = oui).'),
          chk('A1.EFTRAN', 'EFTRAN', 'enveloppes V', 'Courbes enveloppes des efforts tranchants (1 = oui).'),
          chk('A1.MOTRAN', 'MOTRAN', 'moment transv.', 'Calcul du moment transversal maximal (1 = oui).'),
          { k: 'A1.PRESS', code: 'PRESS', label: 'pressions sol', type: 'sel', opts: [[1, '1 — calculées'], [0, '0 — encastré']], help: 'Pressions sur le sol : 1 dans tous les cas, sauf portique parfaitement encastré (GENRE = 1) : 0.' },
        ] },
      ] },
      { label: 'Ferraillage et sorties', groups: [
        { title: 'Ferraillage', flex: 5, cols: 5, fields: [
          chk('A1.SUITE2', 'SUITE2', 'sections', 'Ferraillage des sections les plus sollicitées (1 = oui). Si 0 : ARBEI, FERTRA, ETRIER, METRE = 0.'),
          chk('A1.ARBEI', 'ARBEI', 'épures d\'arrêt', 'Épures d\'arrêt des barres (exige SUITE2 = 1).'),
          chk('A1.FERTRA', 'FERTRA', 'transversal', 'Ferraillage transversal (exige SUITE2 = 1).'),
          chk('A1.ETRIER', 'ETRIER', 'étriers', 'Distribution complète des étriers sur la traverse et les piédroits (exige SUITE2 = 1).'),
          chk('A1.METRE', 'METRE', 'avant-métré', 'Avant-métré récapitulatif (exige SUITE2 = 1).'),
        ] },
        { title: 'Dessin et liaisons', alt: true, flex: 4, cols: 4, fields: [
          chk('A1.DESSIN', 'DESSIN', 'dessin', 'Commande du dessin automatique (1 = oui ; préciser ECHELLE).'),
          { k: 'A2.ECHELLE', code: 'ECHELLE', label: 'du dessin', dec: 3, help: 'Échelle du dessin automatique : porter 0,050 si celui-ci est commandé.', def: '0,050' },
          chk('A1.MRB', 'MRB', 'obsolète', 'Commande obsolète : porter 0.', '0'),
          chk('A1.PSH2', 'PSH2', 'pieux (PSH 2)', 'Ouvrage sur pieux ou puits verticaux : données pour un calcul PSH 2 (1) ; autres cas : 0.', '0'),
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true) },

    { id: 'geom', label: 'Géométrie', view: 'coupe', caption: 'section droite', hint: 'Dimensions du portique en section droite (carte 2) et sol de fondation (carte 4).', pages: [
      { label: 'Portique', groups: [
        { title: 'Ouverture et hauteur', flex: 4, cols: 4, fields: [
          { k: 'A2.OUVER', code: 'OUVER', label: 'ouverture droite', unit: 'm', dec: 3, help: 'Distance droite entre parements intérieurs des piédroits.' },
          { k: 'A2.HAUTL', code: 'HAUTL', label: 'hauteur intérieure', unit: 'm', dec: 3, help: 'Portique sur semelles : distance verticale moyenne entre les nus intérieurs de la traverse et de la semelle.' },
          { k: 'A2.BIAIS', code: 'BIAIS', label: 'biais', unit: 'gr', dec: 3, help: 'Angle du biais géométrique en grades (ouvrage droit : 100). Méthode valable pour un biais modéré, de 100 à 65 gr environ.' },
          { k: 'A2.HREMB', code: 'HREMB', label: 'remblai intérieur', unit: 'm', dec: 3, help: 'Hauteur moyenne de remblai sur les semelles, à l\'intérieur du portique.' },
        ] },
        { title: 'Épaisseurs', alt: true, flex: 3, cols: 3, fields: [
          { k: 'A2.E2', code: 'E2', label: 'piédroits', unit: 'm', dec: 3, help: 'Épaisseur de départ des piédroits (optimisée si LIBDIM = 1, conservée si LIBDIM = 0). Semelle : épaisseur max(E2 ; 0,60 m).' },
          { k: 'A2.E3', code: 'E3', label: 'traverse', unit: 'm', dec: 3, help: 'Épaisseur de départ de la traverse supérieure (optimisée si LIBDIM = 1, conservée si LIBDIM = 0).' },
          { k: 'A1.LIBDIM', code: 'LIBDIM', label: 'dimensionnement', type: 'sel', opts: [[0, '0 — conservé'], [1, '1 — automatique']], help: 'Libération du dimensionnement de E2 et E3 : 1 = dimensionnement automatique à partir des épaisseurs données ; 0 = épaisseurs conservées.' },
        ] },
      ] },
      { label: 'Semelles et sol', groups: [
        { title: 'Fondation', flex: 4, cols: 4, fields: [
          { k: 'A2.GENRE', code: 'GENRE', label: 'liaison au sol', type: 'int', help: '1 : portique parfaitement encastré ; 2 : portique sur semelles ; 3 : portique articulé. Si GENRE ≠ 2, porter W = 0 et DELTA = 0.', def: '2' },
          { k: 'A2.W', code: 'W', label: 'largeur semelle', unit: 'm', dec: 3, help: 'Largeur droite de la semelle (valeur de départ du dimensionnement si FIXSEM = 0).' },
          { k: 'A2.DELTA', code: 'DELTA', label: 'excentrement', unit: 'm', dec: 3, help: 'Excentrement du centre de la semelle par rapport à l\'axe du piédroit, positif vers l\'intérieur du portique.' },
          { k: 'A1.FIXSEM', code: 'FIXSEM', label: 'semelle', type: 'sel', opts: [[1, '1 — fixe'], [0, '0 — variable']], help: 'Géométrie de la semelle : 1 = W et DELTA imposés ; 0 = dimensionnée par le programme à partir de ces valeurs.' },
        ] },
        { title: 'Sol de fondation', alt: true, flex: 2, cols: 2, fields: [
          { k: 'A4.ESOL', code: 'ESOL', label: 'module différé', unit: 't/m²', dec: 0, help: 'Module d\'élasticité différé du sol de fondation (t/m² ; 1 MPa = 102 t/m²). Ne pas confondre avec le module de réaction ni le module pressiométrique.' },
          { k: 'A4.PREMAX', code: 'PREMAX', label: 'pression admissible', unit: 't/m²', dec: 3, help: 'Pression admissible sur le sol de fondation, généralement inférieure à 40 t/m².' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true) },

    { id: 'prof', label: 'Profil en travers', view: 'travers', caption: 'voie portée, de gauche à droite', hint: 'Voie portée par la traverse (carte 3), largeurs droites de gauche à droite.', pages: [
      { label: 'Voie portée', groups: [
        { title: 'Largeurs droites (de gauche à droite)', flex: 5, cols: 5, fields: [
          { k: 'A3.ETROTG', code: 'ETROTG', label: 'trottoir G', unit: 'm', dec: 3, help: 'Autoroute : bande non chargeable à gauche de la glissière de gauche. Voirie ordinaire : largeur du trottoir de gauche.' },
          { k: 'A3.EGAU', code: 'EGAU', label: 'non charg. G', unit: 'm', dec: 3, help: 'Largeur non chargeable à gauche, entre la chaussée chargeable et le dispositif de sécurité (0,50 m s\'il y a un dispositif, sinon 0).' },
          { k: 'A3.ESURCH', code: 'ESURCH', label: 'chargeable', unit: 'm', dec: 3, help: 'Largeur droite chargeable (article 2 du fascicule 61 titre II).' },
          { k: 'A3.EDROI', code: 'EDROI', label: 'non charg. D', unit: 'm', dec: 3, help: 'Largeur non chargeable à droite, entre la chaussée chargeable et le dispositif de sécurité (0,50 m s\'il y a un dispositif, sinon 0).' },
          { k: 'A3.ETROTD', code: 'ETROTD', label: 'trottoir D', unit: 'm', dec: 3, help: 'Autoroute : bande non chargeable à droite de la glissière de droite. Voirie ordinaire : largeur du trottoir de droite.' },
        ] },
        { title: 'Circulation', alt: true, flex: 2, cols: 2, fields: [
          { k: 'A3.SENS', code: 'SENS', label: 'sens', type: 'sel', opts: [[1, '1 — unidirect.'], [2, '2 — bidirect.']], help: 'Sens de circulation : 1 = ouvrage autoroutier (unidirectionnel) ; 2 = voirie ordinaire (bidirectionnel).' },
          { k: 'A3.PVOIE', code: 'PVOIE', label: 'nb de voies', type: 'int', help: 'Nombre de voies au sens du règlement : partie entière de ESURCH / 3.' },
        ] },
        { title: 'Sur la traverse', flex: 2, cols: 2, fields: [
          { k: 'A3.HCHAU', code: 'HCHAU', label: 'chaussée', unit: 'm', dec: 3, help: 'Épaisseur de béton équivalent à la chape, au remblai éventuel et à la chaussée : sert seulement à la diffusion des charges (la sécurité consiste à la sous-estimer).' },
          { k: 'A3.HSREMB', code: 'HSREMB', label: 'remblai sup.', unit: 'm', dec: 3, help: 'Hauteur de remblai au-dessus de la face supérieure de la traverse : n\'intervient que dans la poussée des terres. Normalement 0 s\'il y a une dalle de transition.' },
        ] },
      ] },
    ], schema: (svg) => drawTravers(svg, GEN, true) },

    { id: 'perm', label: 'Charges permanentes', view: 'coupe', caption: 'section droite', hint: 'Terres, superstructures, dalle de transition, retrait et température (cartes 1 et 4).', pages: [
      { label: 'Terres et superstructures', groups: [
        { title: 'Poussée des terres', flex: 3, cols: 3, fields: [
          { k: 'A4.SPEC', code: 'SPEC', label: 'poids des terres', unit: 't/m³', dec: 3, help: 'Poids spécifique des terres en remblai ; prendre normalement 2,0.', def: '2,000' },
          { k: 'A4.RANK1', code: 'RANK1', label: 'Rankine min', dec: 3, help: 'Valeur minimale du coefficient de poussée des terres de Rankine.', def: '0,250' },
          { k: 'A4.RANK2', code: 'RANK2', label: 'Rankine max', dec: 3, help: 'Valeur maximale du coefficient de poussée des terres de Rankine.', def: '0,500' },
        ] },
        { title: 'Superstructures', alt: true, flex: 1, cols: 1, fields: [
          { k: 'A4.QSUP', code: 'QSUP', label: 'poids', unit: 't/m²', dec: 3, help: 'Poids des superstructures par m² de tablier (comprend le poids des terres si l\'ouvrage est sous remblai).' },
        ] },
        { title: 'Déformations imposées (α·E)', flex: 2, cols: 2, fields: [
          { k: 'A4.RETRAIT', code: 'RETRAIT', label: 'retrait', unit: 't/m²', dec: 0, help: 'Produit de la variation relative de longueur de la traverse par le module de déformation, sous l\'effet du retrait (fasc. 61 titre VI, art. 4 § 2).' },
          { k: 'A4.TEMP', code: 'TEMP', label: 'température', unit: 't/m²', dec: 0, help: 'Produit de la variation relative de longueur de la traverse par le module de déformation, sous l\'effet de la température (fasc. 61 titre VI, art. 4 § 1).' },
        ] },
      ] },
      { label: 'Dalle de transition et remblai', groups: [
        { title: 'Dalle de transition', flex: 3, cols: 3, fields: [
          { k: 'A1.DALTRA', code: 'DALTRA', label: 'dalle de transition', type: 'sel', opts: [[1, '1 — oui'], [0, '0 — non']], help: 'Existence de dalles de transition. DALTRA = 1 impose SUREMB = 0 (et inversement) : la case SUREMB suit automatiquement.', relayout: true },
          { k: 'A3.LDALT', code: 'LDALT', label: 'portée droite', unit: 'm', dec: 3, help: 'Portée droite de la dalle de transition (carte 3).' },
          { k: 'A4.QDT', code: 'QDT', label: 'réaction perm.', unit: 't/m', dec: 3, help: 'Réaction permanente de la dalle de transition par mètre de largeur droite d\'ouvrage, appliquée dans l\'axe du piédroit.' },
        ] },
        { title: 'Charge sur les remblais', alt: true, flex: 2, cols: 2, fields: [
          { k: 'A1.SUREMB', code: 'SUREMB', label: 'charge remblai', type: 'sel', opts: [[0, '0 — avec dalle'], [1, '1 — sans dalle']], help: 'Charge sur les remblais d\'accès : 1 s\'il n\'y a pas de dalle de transition (densité PSREMB), 0 sinon. Complémentaire de DALTRA.', relayout: true },
          { k: 'A4.PSREMB', code: 'PSREMB', label: 'densité', unit: 't/m²', dec: 3, help: 'Densité de charge sur les remblais : 0 s\'il existe une dalle de transition ; normalement 1 t/m² dans le cas contraire.' },
        ] },
      ] },
    ], schema: (svg) => drawCoupe(svg, GEN, true, 'perm') },

    { id: 'expl', label: 'Exploitation', view: 'travers', caption: 'profil en travers chargé', hint: 'Charges routières du fascicule 61 titre II (carte 1) et coefficients (carte 5).', pages: [
      { label: 'Systèmes de charges', groups: [
        { title: 'Charges routières et militaires', flex: 6, cols: 6, fields: [
          chk('A1.AL', 'AL', 'charge A(l)', 'Calcul des efforts dus à la charge A (ou de type A).'),
          chk('A1.BC', 'BC', 'camions Bc', 'Calcul des efforts dus à la charge Bc (ou de type Bc).'),
          chk('A1.BT', 'BT', 'tandem Bt', 'Calcul des efforts dus à la charge Bt (ou de type Bt).'),
          { k: 'A1.MC', code: 'MC', label: 'char', type: 'sel', opts: [[4, '4 — Mc120'], [3, '3 — Mc80'], [5, '5 — généralisé (S4)'], [0, '0 — non']], help: 'Charge militaire à chenilles : 3 = Mc80, 4 = Mc120, 5 = charge généralisée de type Mc définie en carte S4.' },
          { k: 'A1.ME', code: 'ME', label: 'essieux', type: 'sel', opts: [[4, '4 — Me120'], [3, '3 — Me80'], [5, '5 — généralisé (S2, S3)'], [0, '0 — non']], help: 'Charge militaire à essieux : 3 = Me80, 4 = Me120, 5 = charge généralisée « à essieux » définie en cartes S2 et S3.' },
          { k: 'A1.EXCEP', code: 'EXCEP', label: 'convoi', type: 'sel', opts: [[0, '0 — non'], [1, '1 — type D'], [2, '2 — type E']], help: 'Charge exceptionnelle : 1 = convoi de type D, 2 = convoi de type E.' },
        ] },
        { title: 'Trottoirs', alt: true, flex: 2, cols: 2, fields: [
          chk('A1.TROT', 'TROT', 'charge trottoir', 'Calcul des efforts dus à la charge de trottoir (densité PSTROT).'),
          { k: 'A4.PSTROT', code: 'PSTROT', label: 'densité', unit: 't/m²', dec: 3, help: 'Densité de charge des trottoirs : 0 pour une plateforme autoroutière, 0,150 t/m² en voirie ordinaire.' },
        ] },
      ] },
      { label: 'Coefficients', groups: [
        { title: 'Majoration ou minoration des charges réglementaires', flex: 4, cols: 4, fields: [
          { k: 'A5.COEFA', code: 'COEFA', label: 'charges A', dec: 3, help: 'Coefficient de majoration ou de minoration des charges A (sans effet sur les charges généralisées). Porter 1,00 sauf usage exceptionnel.', def: '1,000' },
          { k: 'A5.COEFB', code: 'COEFB', label: 'Bc et Bt', dec: 3, help: 'Coefficient sur les charges Bc et Bt. Porter 1,00 sauf usage exceptionnel.', def: '1,000' },
          { k: 'A5.COEFM', code: 'COEFM', label: 'militaires', dec: 3, help: 'Coefficient sur les charges militaires. Porter 1,00 sauf usage exceptionnel.', def: '1,000' },
          { k: 'A5.COEFEX', code: 'COEFEX', label: 'exceptionnelles', dec: 3, help: 'Coefficient sur les charges exceptionnelles. Porter 1,00 sauf usage exceptionnel.', def: '1,000' },
        ] },
      ] },
      { label: 'Répartition imposée', groups: [
        { title: 'Coefficients K de répartition transversale imposés — seulement si EXCENTR = 0', alt: true, flex: 7, cols: 7, fields: [
          { k: 'A5.KTROT', code: 'KTROT', label: 'trottoir', dec: 3, help: 'K imposé pour la charge de trottoir. Ne pas remplir si EXCENTR = 1 ou 2.' },
          { k: 'A5.KA', code: 'KA', label: 'type A', dec: 3, help: 'K imposé pour la charge A, incluant le coefficient a1 du nombre de voies chargées le plus défavorable. Ne pas remplir si EXCENTR = 1 ou 2.' },
          { k: 'A5.KBC', code: 'KBC', label: 'Bc', dec: 3, help: 'K imposé pour la charge Bc, incluant le coefficient bc. Ne pas remplir si EXCENTR = 1 ou 2.' },
          { k: 'A5.KBT', code: 'KBT', label: 'Bt', dec: 3, help: 'K imposé pour la charge Bt. Ne pas remplir si EXCENTR = 1 ou 2.' },
          { k: 'A5.KMC', code: 'KMC', label: 'Mc', dec: 3, help: 'K imposé pour la charge Mc. Ne pas remplir si EXCENTR = 1 ou 2.' },
          { k: 'A5.KME', code: 'KME', label: 'Me', dec: 3, help: 'K imposé pour la charge Me. Ne pas remplir si EXCENTR = 1 ou 2.' },
          { k: 'A5.KEXCEP', code: 'KEXCEP', label: 'exceptionnel', dec: 3, help: 'K imposé pour la charge exceptionnelle. Ne pas remplir si EXCENTR = 1 ou 2.' },
        ] },
      ] },
    ], schema: (svg) => drawTravers(svg, GEN, true, true) },

    { id: 'mat', label: 'Matériaux', view: 'fer', caption: 'angle traverse – piédroit', hint: 'Béton, fissuration et armatures (cartes 1 et 6). Unités du bordereau : mètre et t/m² (1 MPa = 102 t/m²).', pages: [
      { label: 'Béton et armatures', groups: [
        { title: 'Béton', flex: 2, cols: 2, fields: [
          { k: 'A6.SIGMAF', code: 'SIGMAF', label: 'σ adm. flexion', unit: 't/m²', dec: 0, help: 'Contrainte de compression admissible du béton à la flexion (0,6 fc28) : 1836 t/m² pour fc28 = 30 MPa, 1530 t/m² pour 25 MPa.' },
          { k: 'A1.FIP', code: 'FIP', label: 'fissuration', type: 'sel', opts: [[0, '0 — peu préjudiciable'], [1, '1 — préjudiciable'], [2, '2 — très préjudiciable']], help: 'État limite d\'ouverture des fissures.' },
        ] },
        { title: 'Diamètres', alt: true, flex: 3, cols: 3, fields: [
          { k: 'A6.PHI1', code: 'PHI1', label: 'principales', unit: 'm', dec: 3, help: 'Diamètre des armatures principales, en mètre (ex. 0,025).' },
          { k: 'A6.PHI2', code: 'PHI2', label: 'répartition', unit: 'm', dec: 3, help: 'Diamètre des armatures de répartition (intérieures des piédroits, transversales…), en mètre.' },
          { k: 'A6.PHI3', code: 'PHI3', label: 'couture', unit: 'm', dec: 3, help: 'Diamètre des armatures de couture (étriers), en mètre.' },
        ] },
        { title: 'Limites d\'élasticité', flex: 3, cols: 3, fields: [
          { k: 'A6.SIGMA1', code: 'SIGMA1', label: 'PHI1', unit: 't/m²', dec: 0, help: 'Limite d\'élasticité nominale de l\'acier PHI1 en traction (51000 t/m² pour 500 MPa).', def: '51000' },
          { k: 'A6.SIGMA2', code: 'SIGMA2', label: 'PHI2', unit: 't/m²', dec: 0, help: 'Limite d\'élasticité nominale de l\'acier PHI2 en traction.', def: '51000' },
          { k: 'A6.SIGMA3', code: 'SIGMA3', label: 'PHI3', unit: 't/m²', dec: 0, help: 'Limite d\'élasticité nominale de l\'acier PHI3 en traction.', def: '51000' },
        ] },
      ] },
    ], schema: (svg) => drawFer(svg, GEN, true) },

    { id: 'gen', label: 'Charges généralisées', view: 'gen', caption: 'cartes facultatives S0 à S4', hint: 'Cartes facultatives : à remplir seulement si CLASSE = 0 (S0), STATUT ≥ 2 (S1, S2, S3), MC = 5 (S4) ou ME = 5 (S2, S3).', pages: [
      { label: 'S0 · voie et a1', groups: [
        { title: 'S0 — largeur de voie nominale et coefficients a1 (j voies chargées)', flex: 7, cols: 7, fields: [
          S('S0', 'LVOIE', 'voie nominale', 'm', 3, 'Largeur nominale V0 d\'une voie (CLASSE = 0).'),
        ].concat(ess.map(j => S('S0', 'CDTA' + j, j + ' voie' + (j > 1 ? 's' : ''), '', 3, `Coefficient a1 de la charge de type A pour ${j} voie${j > 1 ? 's' : ''} chargée${j > 1 ? 's' : ''}.`))) },
      ] },
      { label: 'S0 · bc  ·  S1 · A(l)', groups: [
        { title: 'S0 — coefficients bc (j files de camions)', flex: 6, cols: 6, fields: ess.map(j => S('S0', 'CDTB' + j, j + ' file' + (j > 1 ? 's' : ''), '', 3, `Coefficient bc de la charge de type Bc pour ${j} file${j > 1 ? 's' : ''} de véhicules.`)) },
        { title: 'S1 — A(l) = A1·l + A0', alt: true, flex: 2, cols: 2, fields: [
          S('S1', 'A1', 'pente', 't/m²/m', 3, 'Coefficient A1 de la loi affine A(l) = A1·l + A0 (charge généralisée de type A).'),
          S('S1', 'A0', 'ordonnée', 't/m²', 3, 'Coefficient A0 de la loi affine A(l) = A1·l + A0.'),
        ] },
      ] },
      { label: 'S2 · véhicule', groups: [
        { title: 'S2 — véhicule à essieux', flex: 6, cols: 6, fields: [
          { k: 'S2.NVOI', code: 'NVOI', label: 'voies', type: 'int', help: 'Nombre de voies de circulation pour les charges mobiles généralisées.' },
          { k: 'S2.NCAM', code: 'NCAM', label: 'véhicules/voie', type: 'int', help: 'Nombre de véhicules par voie de circulation.' },
          { k: 'S2.NES', code: 'NES', label: 'essieux', type: 'int', help: 'Nombre d\'essieux par véhicule (6 au plus, définis en carte S3).' },
          { k: 'S2.TYPE', code: 'TYPE', label: 'essieu', type: 'sel', opts: [[1, '1 — deux roues'], [0, '0 — rouleau']], help: 'Type d\'essieu : 0 = rouleau, 1 = essieu à deux roues.' },
          { k: 'S2.ESAV', code: 'ESAV', label: 'essieu avant', type: 'int', help: 'Numéro de l\'essieu avant retenu pour la flexion transversale (groupe d\'essieux le plus lourd et le plus concentré).' },
          { k: 'S2.ESAR', code: 'ESAR', label: 'essieu arrière', type: 'int', help: 'Numéro de l\'essieu arrière retenu pour la flexion transversale.' },
        ] },
        { title: 'Encombrement', alt: true, flex: 4, cols: 4, fields: [
          S('S2', 'LONGENC', 'longueur', 'm', 3, 'Longueur d\'encombrement d\'un véhicule.'),
          S('S2', 'LARGENC', 'largeur', 'm', 3, 'Largeur d\'encombrement d\'un véhicule.'),
          S('S2', 'LARGES', 'entre roues', 'm', 3, 'Largeur de l\'essieu du genre rouleau, ou distance entre axes des roues.'),
          S('S2', 'DYNAB', 'maj. dynamique', '', 3, 'Coefficient de majoration dynamique applicable au véhicule.'),
        ] },
      ] },
      { label: 'S3 · essieux', groups: [
        { title: 'S3 — abscisse de l\'essieu j par rapport à l\'essieu 1', flex: 6, cols: 6, fields: ess.map(j => S('S3', 'ABESS' + j, '', 'm', 3, `Abscisse de l'essieu ${j} par rapport à l'essieu 1.`)) },
        { title: 'S3 — poids de l\'essieu j', alt: true, flex: 6, cols: 6, fields: ess.map(j => S('S3', 'POESS' + j, '', 't', 3, `Poids de l'essieu ${j}.`)) },
      ] },
      { label: 'S4 · chenilles', groups: [
        { title: 'S4 — charge généralisée de type Mc (chenilles ou zone répartie)', flex: 6, cols: 6, fields: [
          S('S4', 'DYCHA', 'maj. dynamique', '', 3, 'Coefficient de majoration dynamique applicable à cette charge.'),
          S('S4', 'POICHA', 'masse totale', 't', 3, 'Masse totale de la charge.'),
          S('S4', 'LARGCHA', 'encombrement', 'm', 3, 'Largeur d\'encombrement de la charge.'),
          S('S4', 'LOCHE', 'long. chenille', 'm', 3, 'Longueur d\'une chenille (ou de la zone d\'action de la charge).'),
          S('S4', 'CHELA', 'larg. chenille', 'm', 3, 'Largeur d\'une chenille (ou de la zone d\'action).'),
          S('S4', 'ESCHE', 'entraxe', 'm', 3, 'Distance entre axes des chenilles ; 0 dans le cas d\'une seule zone répartie.'),
        ] },
      ] },
    ], schema: (svg) => drawGen(svg, GEN, true) },
  ];

  /* ───── géométrie générique pour les schémas de principe ───── */
  function mk(flat) {
    const m = { A1: {}, cartes: {}, titre: '', soustitre: '', numero: '' };
    for (const k in flat) set(m, k, flat[k]);
    return m;
  }
  const GEN = mk({
    'A1.DALTRA': 1, 'A1.SUREMB': 0, 'A1.TROT': 1, 'A2.GENRE': 2,
    'A2.HAUTL': 6, 'A2.HREMB': 1.6, 'A2.OUVER': 10, 'A2.BIAIS': 80, 'A2.E2': 0.6, 'A2.E3': 0.6, 'A2.W': 3.4, 'A2.DELTA': -0.4,
    'A3.ETROTG': 1.5, 'A3.EGAU': 0.5, 'A3.ESURCH': 7, 'A3.EDROI': 0.5, 'A3.ETROTD': 1.5, 'A3.SENS': 2, 'A3.PVOIE': 2, 'A3.HCHAU': 0.3, 'A3.HSREMB': 0.5, 'A3.LDALT': 3,
    'A6.PHI1': 0.025, 'A6.PHI2': 0.014, 'A6.PHI3': 0.010,
    'S2.NES': 3, 'S2.TYPE': 1, 'S2.LONGENC': 10.5, 'S2.LARGENC': 2.5, 'S2.LARGES': 2, 'S3.ABESS1': 0, 'S3.ABESS2': 4.5, 'S3.ABESS3': 6, 'S3.POESS1': 6, 'S3.POESS2': 12, 'S3.POESS3': 12,
    'S4.POICHA': 110, 'S4.LARGCHA': 3.3, 'S4.LOCHE': 6.1, 'S4.CHELA': 1, 'S4.ESCHE': 2.3,
  });

  /* ───── dessins ───── */
  const code = k => k.split('.').pop();
  const lab = (m, k, sch, d, u) => sch ? code(k) : fmt(V(m, k), d == null ? 2 : d) + (u || '');
  const larg = m => ['A3.ETROTG', 'A3.EGAU', 'A3.ESURCH', 'A3.EDROI', 'A3.ETROTD'].reduce((a, k) => a + V(m, k), 0);
  // flèche de (x0,y0) vers (x1,y1), pointe en (x1,y1)
  function arrow(d, x0, y0, x1, y1, k, cls) {
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L, a = d.u * 0.9, b = d.u * 0.45;
    d.line(x0, y0, x1 - ux * a * 0.6, y1 - uy * a * 0.6, cls || 'l', k);
    d.poly([[x1, y1], [x1 - ux * a - uy * b, y1 - uy * a + ux * b], [x1 - ux * a + uy * b, y1 - uy * a - ux * b]], 'ah', k);
  }

  function drawCoupe(svg, m, sch, mode) {
    const o = V(m, 'A2.OUVER') || 1, h = V(m, 'A2.HAUTL') || 1;
    const e2 = V(m, 'A2.E2'), e3 = V(m, 'A2.E3'), e1 = Math.max(e2, 0.6);
    const genre = V(m, 'A2.GENRE') || 2, Wd = genre === 2 ? V(m, 'A2.W') : 0, D = genre === 2 ? V(m, 'A2.DELTA') : 0;
    const hr = Math.max(0, Math.min(V(m, 'A2.HREMB'), h * 0.95));
    const ld = V(m, 'A3.LDALT'), hs = V(m, 'A3.HSREMB'), hc = V(m, 'A3.HCHAU');
    const top = h + e3, road = top + hs + hc;
    const cl = -e2 / 2 + D, cr = o + e2 / 2 - D;                  // centres des semelles
    const ext = Math.max(ld + 1.4, Wd / 2 - D + 1.2, 2.4, o * 0.18);
    const xl = Math.min(-e2 - ext, cl - Wd / 2 - 0.8), xr = Math.max(o + e2 + ext, cr + Wd / 2 + 0.8);
    const yb = genre === 2 ? -e1 : 0;
    const d = svg({ x0: xl, y0: yb - 2.5, x1: xr, y1: road + (mode === 'expl' ? 2.6 : mode === 'perm' ? 1.9 : 1.3) }, { pad: 0.05 });
    const u = d.u;
    // terrain, remblais
    d.soil([[xl, yb], [xr, yb]], 0.9);
    d.fill([[xl, yb], [-e2, yb], [-e2, top + hs], [xl, top + hs]], 'A4.SPEC');
    d.fill([[o + e2, yb], [xr, yb], [xr, top + hs], [o + e2, top + hs]], 'A4.SPEC');
    if (hs > 0) d.fill([[-e2, top], [o + e2, top], [o + e2, top + hs], [-e2, top + hs]], 'A3.HSREMB');
    if (yb < 0) d.fill([[0, yb], [o, yb], [o, 0], [0, 0]]);
    if (hr > 0) d.fill([[0, 0], [o, 0], [o, hr], [0, hr]], 'A2.HREMB');
    d.line(0, hr, o, hr, 'ground', 'A2.HREMB');
    d.text(o / 2, hr + 0.45, 'voie franchie', { cls: 'ts', size: 0.8 });
    // chaussée
    d.rect(xl, road - hc, xr - xl, Math.max(hc, u * 0.5), 'road', 'A3.HCHAU');
    // dalles de transition (sous la chaussée, appuyées en tête de piédroit)
    if (ld > 0) {
      const t = 0.3, s = 0.05 * ld, y = top + hs;
      d.poly([[-e2, y], [-e2 - ld, y - s], [-e2 - ld, y - s - t], [-e2, y - t]], 'b2', 'A3.LDALT A1.DALTRA');
      d.poly([[o + e2, y], [o + e2 + ld, y - s], [o + e2 + ld, y - s - t], [o + e2, y - t]], 'b2', 'A3.LDALT A1.DALTRA');
    }
    // poussée des terres (triangles sur les faces extérieures)
    const pw = Math.min(1.6, o * 0.14), kp = 'A4.RANK1 A4.RANK2 A4.SPEC';
    const pr = (x, s) => {
      d.poly([[x, top + hs], [x, 0], [x + s * pw, 0]], 'fillz', kp);
      for (let i = 1; i <= 4; i++) { const y = (top + hs) * (1 - i / 5); arrow(d, x + s * pw * i / 5, y, x + s * 0.04, y, kp); }
    };
    pr(-e2, -1); pr(o + e2, 1);
    // béton : semelles, piédroits, traverse
    if (genre === 2 && Wd > 0) {
      d.rect(cl - Wd / 2, -e1, Wd, e1, 'b', 'A2.W A2.DELTA A1.FIXSEM');
      d.rect(cr - Wd / 2, -e1, Wd, e1, 'b', 'A2.W A2.DELTA A1.FIXSEM');
    }
    d.rect(-e2, 0, e2, h, 'b', 'A2.E2'); d.rect(o, 0, e2, h, 'b', 'A2.E2');
    d.rect(-e2, h, o + 2 * e2, e3, 'b', 'A2.E3');
    if (genre === 3) for (const x of [-e2 / 2, o + e2 / 2]) d.circle(x, 0, Math.max(e2 * 0.3, u * 0.6), 'car', 'A2.GENRE');
    d.line(o / 2, yb - 0.5, o / 2, road + 0.5, 'ax');
    // charges
    if (mode === 'perm') {
      const y = road;
      for (let i = 0; i <= 8; i++) arrow(d, -e2 + (o + 2 * e2) * i / 8, y + 1.0, -e2 + (o + 2 * e2) * i / 8, y + 0.05, 'A4.QSUP');
      d.line(-e2, y + 1.0, o + e2, y + 1.0, 'l', 'A4.QSUP');
      d.text(o / 2, y + 1.4, sch ? 'QSUP' : 'superstructures', { cls: sch ? 'tc' : 'ts', size: 0.85, k: 'A4.QSUP' });
      if (ld > 0) {
        arrow(d, -e2 / 2, y + 1.6, -e2 / 2, top + hs + 0.05, 'A4.QDT');
        d.text(-e2 / 2 - 0.3, y + 1.6, 'QDT', { cls: 'tc', size: 0.85, a: 'end', k: 'A4.QDT' });
      }
      const xa = ld > 0 ? -e2 - ld - 0.3 : -e2 - 0.3, xb = xl + 0.3;
      if (xa - xb > 0.8) {
        for (let i = 0; i <= 3; i++) arrow(d, xb + (xa - xb) * i / 3, y + 0.8, xb + (xa - xb) * i / 3, y + 0.05, 'A4.PSREMB A1.SUREMB');
        d.text((xa + xb) / 2, y + 1.2, 'PSREMB', { cls: 'tc', size: 0.75, k: 'A4.PSREMB A1.SUREMB' });
      }
      d.text(o / 2, h + e3 / 2, 'RETRAIT · TEMP', { cls: 'tc', size: 0.7, k: 'A4.RETRAIT A4.TEMP' });
    }
    if (mode === 'expl') {
      const tw = Math.min(o * 0.8, 10), th = 1.0, x0 = o / 2 - tw / 2, y = road;
      d.rect(x0, y + 0.45, tw * 0.78, th, 'car', 'A1.BC'); d.rect(x0 + tw * 0.8, y + 0.45, tw * 0.2, th * 1.25, 'car', 'A1.BC');
      for (const f of [0.08, 0.42, 0.88]) d.circle(x0 + tw * f, y + 0.25, 0.25, 'wheel');
      d.text(o / 2, y + 0.45 + th / 2, 'A · Bc · Bt · Mc · Me · E', { size: 0.8, cls: 'ts' });
    }
    // réaction du sol
    if (genre === 2 && Wd > 0 && sch) {
      for (const c of [cl, cr]) for (let i = 0; i <= 3; i++) arrow(d, c - Wd / 2 + Wd * i / 3, yb - 0.85, c - Wd / 2 + Wd * i / 3, yb - 0.05, 'A4.ESOL A4.PREMAX');
      d.text(cr, yb - 1.25, 'ESOL · PREMAX', { cls: 'tc', size: 0.75, k: 'A4.ESOL A4.PREMAX' });
    }
    // cotes
    const L = (k, dd) => lab(m, k, sch, dd);
    d.dim(0, h, o, h, L('A2.OUVER'), -Math.max(0.7, h * 0.09), 'A2.OUVER');
    d.dim(o, 0, o, h, L('A2.HAUTL'), Math.min(1.1, o * 0.1), 'A2.HAUTL');
    if (hr > 0.05) d.dim(0, 0, 0, hr, L('A2.HREMB'), -Math.min(0.8, o * 0.08), 'A2.HREMB', { size: 0.85 });
    d.text(-e2 / 2, h * 0.55, L('A2.E2'), { k: 'A2.E2', cls: sch ? 'tc' : 'dv', size: 0.8, rot: 90 });
    d.text(o + e2 / 2, h * 0.55, L('A2.E2'), { k: 'A2.E2', cls: sch ? 'tc' : 'dv', size: 0.8, rot: 90 });
    d.dim(o * 0.3, h, o * 0.3, top, L('A2.E3'), Math.min(0.6, o * 0.05), 'A2.E3', { size: 0.85 });
    if (genre === 2 && Wd > 0) {
      d.dim(cl - Wd / 2, -e1, cl + Wd / 2, -e1, L('A2.W'), -1.05, 'A2.W', { size: 0.85 });
      if (Math.abs(D) > 0.005 || sch) {
        // excentrement : coté au-dessus de la semelle gauche, entre l'axe du piédroit et le centre de la semelle
        d.line(-e2 / 2, -e1 * 0.5, -e2 / 2, h * 0.3, 'ax', 'A2.DELTA');
        d.line(cl, -e1 * 0.5, cl, 1.2, 'ax', 'A2.DELTA');
        d.dim(-e2 / 2, 0, cl, 0, '', 0.9, 'A2.DELTA');
        d.text(Math.min(-e2 / 2, cl) - 0.25, 0.9, L('A2.DELTA'), { k: 'A2.DELTA', cls: sch ? 'tc' : 'dv', size: 0.8, a: 'end' });
      }
      if (!sch) d.text(cr, -e1 / 2, 'ép. ' + fmt(e1, 2), { cls: 'ts', size: 0.7 });
    }
    if (ld > 0) { const yd = top + hs - 0.05 * ld - 0.3; d.dim(-e2 - ld, yd, -e2, yd, L('A3.LDALT'), -0.45, 'A3.LDALT', { size: 0.85 }); }
    const xh = xr - 0.5;
    if (hs > 0.05) { d.dim(xh, top, xh, top + hs, '', 0.01, 'A3.HSREMB'); d.text(xh - 0.35, top + hs / 2, L('A3.HSREMB'), { k: 'A3.HSREMB', cls: sch ? 'tc' : 'dv', size: 0.8, a: 'end' }); }
    if (hc > 0) d.text(xr - 0.5, road + 0.4, sch ? 'HCHAU' : fmt(hc, 2), { k: 'A3.HCHAU', cls: sch ? 'tc' : 'dv', size: 0.8, a: 'end' });
    if (sch) {
      d.text(xl + 0.4, h * 0.45, 'RANK · SPEC', { cls: 'tc', size: 0.75, a: 'start', k: kp });
      d.text(cl, -e1 / 2, 'e = max(E2 ; 0,60)', { cls: 'ts', size: 0.6 });
    }
    return d.toString();
  }

  function drawTravers(svg, m, sch, loads) {
    const ks = ['A3.ETROTG', 'A3.EGAU', 'A3.ESURCH', 'A3.EDROI', 'A3.ETROTD'];
    const ws = ks.map(k => V(m, k)); let W = ws.reduce((a, b) => a + b, 0); if (!(W > 0)) W = 10;
    const hReal = V(m, 'A2.HAUTL') || 4, h = Math.min(hReal, Math.max(1.6, W * 0.15)), e3 = V(m, 'A2.E3');
    const hs = V(m, 'A3.HSREMB'), hc = V(m, 'A3.HCHAU'), hr = Math.min(V(m, 'A2.HREMB') * h / hReal, h * 0.9);
    const top = h + e3, rd = top + hs + hc, hk = 0.2;
    const yTop = rd + (loads ? 4.3 : 2.7);
    const d = svg({ x0: -1.4, y0: -0.8, x1: W + 1.4, y1: yTop }, { pad: 0.04 });
    d.soil([[-1.4, 0], [W + 1.4, 0]], 0.7);
    d.rect(-0.6, 0, W + 1.2, h, 'b2', 'A2.HAUTL'); // piédroit vu en arrière-plan
    void hr;
    d.text(W / 2, h / 2, sch ? 'piédroit vu en arrière-plan — HAUTL' : 'piédroit en arrière-plan — hauteur intérieure ' + fmt(hReal, 2) + ' m' + (hReal > h ? ' (réduite sur le dessin)' : ''), { cls: 'ts', size: 0.75, k: 'A2.HAUTL' });
    if (hReal > h) { const zz = (x, y) => [[x - 0.3, y - 0.25], [x, y + 0.05], [x + 0.05, y - 0.05], [x + 0.35, y + 0.25]]; d.path(zz(-0.6, h * 0.5), 'l'); d.path(zz(W + 0.6, h * 0.5), 'l'); }
    d.rect(-0.6, h, W + 1.2, e3, 'b', 'A2.E3');
    if (hs > 0) d.fill([[-0.6, top], [W + 0.6, top], [W + 0.6, top + hs], [-0.6, top + hs]], 'A3.HSREMB');
    let x = 0; const xs = [0]; for (const w of ws) { x += w; xs.push(x); }
    d.rect(xs[1], top + hs, xs[4] - xs[1], Math.max(hc, d.u * 0.5), 'road', 'A3.HCHAU');
    if (ws[0] > 0) d.rect(xs[0], top + hs, ws[0], hc + hk, 'b2', 'A3.ETROTG');
    if (ws[4] > 0) d.rect(xs[4], top + hs, ws[4], hc + hk, 'b2', 'A3.ETROTD');
    // dispositifs de sécurité (si bande non chargeable)
    if (ws[1] > 0) d.rect(xs[1] - 0.06, rd, 0.12, 0.7, 'b', 'A3.EGAU');
    if (ws[3] > 0) d.rect(xs[4] - 0.06, rd, 0.12, 0.7, 'b', 'A3.EDROI');
    // voies, sens
    const nv = Math.max(1, Math.round(V(m, 'A3.PVOIE')) || 1), lw = ws[2] / nv, sens = V(m, 'A3.SENS');
    for (let i = 1; i < nv; i++) { const xx = xs[2] + lw * i; d.rect(xx - 0.04, rd - Math.min(hc, 0.1), 0.08, Math.min(hc, 0.1) + 0.02, 'lane', 'A3.PVOIE'); }
    for (let i = 0; i < nv; i++) {
      const cx = xs[2] + lw * (i + 0.5), cy = rd + 0.42, r = Math.min(0.24, lw * 0.15);
      d.circle(cx, cy, r, 'car', 'A3.SENS');
      if (sens === 2 && i < nv / 2) d.circle(cx, cy, r * 0.28, 'wheel', 'A3.SENS');
      else { d.line(cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7, 'l', 'A3.SENS'); d.line(cx - r * 0.7, cy + r * 0.7, cx + r * 0.7, cy - r * 0.7, 'l', 'A3.SENS'); }
    }
    if (loads) {
      for (let i = 0; i < Math.min(nv, 6); i++) {
        const cx = xs[2] + lw * (i + 0.5), tw = Math.min(2.5, lw * 0.9), y = rd + 0.85;
        d.rect(cx - tw / 2, y + 0.3, tw, 1.1, 'car', 'A1.BC A1.BT A1.AL');
        d.circle(cx - tw * 0.4, y + 0.18, 0.18, 'wheel'); d.circle(cx + tw * 0.4, y + 0.18, 0.18, 'wheel');
      }
      d.text(xs[2] + ws[2] / 2, rd + 2.75, sch ? 'AL · BC · BT · MC · ME · EXCEP' : 'charges A, B, militaires, exceptionnelles', { cls: sch ? 'tc' : 'ts', size: 0.75, k: 'A1.AL A1.BC A1.BT A1.MC A1.ME A1.EXCEP' });
      for (const [a, w] of [[xs[0], ws[0]], [xs[4], ws[4]]]) if (w > 0.3) for (let i = 0; i <= 2; i++) arrow(d, a + w * (0.2 + 0.3 * i), rd + hk + 1.0, a + w * (0.2 + 0.3 * i), rd + hk + 0.05, 'A4.PSTROT A1.TROT');
      if (ws[0] > 0.3 || ws[4] > 0.3) d.text(ws[0] > 0.3 ? xs[0] + ws[0] / 2 : xs[4] + ws[4] / 2, rd + hk + 1.35, sch ? 'PSTROT' : 'trottoir', { cls: sch ? 'tc' : 'ts', size: 0.7, k: 'A4.PSTROT A1.TROT' });
    }
    const L = k => lab(m, k, sch);
    const yy = rd + (loads ? 3.25 : 1.15);
    ks.forEach((k, i) => { if (ws[i] > 0 || sch) d.dim(xs[i], yy, xs[i + 1], yy, (ws[i] > 0 || sch) ? L(k) : '', 0.01, k, { size: ws[i] < 1 && !sch ? 0.7 : 0.85 }); });
    d.dim(0, yy + 0.95, W, yy + 0.95, sch ? 'largeur droite = Σ' : 'largeur droite ' + fmt(W, 2), 0.01, ks.join(' '), { size: 0.85 });
    d.text(xs[2] + ws[2] / 2, rd + (loads ? 0.6 : 0.85), sch ? 'PVOIE voies · SENS' : nv + ' voie' + (nv > 1 ? 's' : '') + (sens === 1 ? ' · unidirectionnel' : ' · bidirectionnel'), { k: 'A3.PVOIE A3.SENS', cls: sch ? 'tc' : 'ts', size: 0.7, base: 'auto' });
    if (hs > 0.05) d.dim(W + 0.9, top, W + 0.9, top + hs, L('A3.HSREMB'), 0.01, 'A3.HSREMB', { size: 0.75 });
    d.dim(-0.9, h, -0.9, top, L('A2.E3'), 0.01, 'A2.E3', { size: 0.75 });
    if (hc > 0) d.text(W + 0.3, rd + 0.3, sch ? 'HCHAU' : fmt(hc, 2), { k: 'A3.HCHAU', cls: sch ? 'tc' : 'dv', size: 0.75, a: 'start' });
    return d.toString();
  }

  function drawPlan(svg, m, sch) {
    const o = V(m, 'A2.OUVER') || 1, e2 = V(m, 'A2.E2'), W = larg(m) || 10, ld = V(m, 'A3.LDALT');
    const genre = V(m, 'A2.GENRE') || 2, Ws = genre === 2 ? V(m, 'A2.W') : 0, D = genre === 2 ? V(m, 'A2.DELTA') : 0;
    const bg = Math.max(30, Math.min(100, V(m, 'A2.BIAIS') || 100)), b = bg * Math.PI / 200;   // grades → rad
    const s = Math.sin(b);
    // axe de la voie portée = x ; piédroits suivant (cos b, sin b) ; abscisses droites divisées par sin b
    const B = x => x / s, dx = W / Math.tan(b);
    const sl0 = -e2 / 2 + D - Ws / 2, sl1 = sl0 + Ws, sr1 = o + e2 / 2 - D + Ws / 2, sr0 = sr1 - Ws;
    const xmin = Math.min(0, dx) + Math.min(B(-e2 - ld), B(sl0)) - 1.5, xmax = Math.max(0, dx) + Math.max(B(o + e2 + ld), B(sr1)) + 1.5;
    const d = svg({ x0: xmin, y0: -2.4, x1: xmax + 1.6, y1: W + 1.7 }, { pad: 0.04 });
    const band = (x1, x2, cls, k) => d.poly([[B(x1), 0], [B(x2), 0], [B(x2) + dx, W], [B(x1) + dx, W]], cls, k);
    const edge = (x, cls, k) => d.line(B(x), 0, B(x) + dx, W, cls, k);
    d.rect(xmin, 0, xmax - xmin, W, 'road', 'A3.ESURCH');                       // chaussée des accès
    if (ld > 0) { band(-e2 - ld, -e2, 'b2', 'A3.LDALT A1.DALTRA'); band(o + e2, o + e2 + ld, 'b2', 'A3.LDALT A1.DALTRA'); }
    band(-e2, o + e2, 'b', 'A2.E3');                                             // traverse
    edge(0, 'l', 'A2.E2 A2.OUVER'); edge(o, 'l', 'A2.E2 A2.OUVER');            // parements intérieurs (sous la traverse)
    if (Ws > 0) { band(sl0, sl1, 'fillz', 'A2.W A2.DELTA'); band(sr0, sr1, 'fillz', 'A2.W A2.DELTA'); }
    d.line(xmin, W / 2, xmax, W / 2, 'ax');
    const deg = b * 180 / Math.PI;
    const cx = B(o / 2) + dx / 2;
    d.text(cx + 0.9 * Math.cos(b) - 0.35 * Math.sin(b), W / 2 + 0.9 * Math.sin(b) + 0.35 * Math.cos(b), 'voie franchie', { cls: 'ts', size: 0.8, rot: deg });
    // angle de biais : entre l'axe de la voie portée (x) et le parement du piédroit gauche
    const r = Math.min(2.6, W * 0.25, B(o) * 0.45), arc = [];
    for (let i = 0; i <= 16; i++) { const t = b * i / 16; arc.push([r * Math.cos(t), r * Math.sin(t)]); }
    d.path(arc, 'l', 'A2.BIAIS');
    d.line(0, 0, r * 1.15, 0, 'l', 'A2.BIAIS');
    d.text(r * 1.12 * Math.cos(b / 2), r * 1.12 * Math.sin(b / 2), sch ? 'BIAIS' : fmt(bg, 2) + ' gr', { k: 'A2.BIAIS', cls: sch ? 'tc' : 'dv', size: 0.85, a: 'start' });
    d.dim(0, 0, B(o), 0, sch ? 'OUVER / sin BIAIS' : fmt(B(o), 2) + ' (biaise)', -0.9, 'A2.OUVER', { size: 0.85 });
    d.dim(xmax + 0.4, 0, xmax + 0.4, W, sch ? 'largeur droite' : fmt(W, 2), -0.01, 'A3.ESURCH', { size: 0.85 });
    d.text((xmin + xmax) / 2, W + 0.85, 'voie portée →', { cls: 'ts', size: 0.85 });
    if (Ws > 0) d.text(xmin + 0.2, -1.75, sch ? 'semelles W, DELTA (pointillé)' : 'semelles (pointillé) : W = ' + fmt(Ws, 2) + ' m', { cls: sch ? 'tc' : 'ts', size: 0.75, a: 'start', k: 'A2.W A2.DELTA' });
    return d.toString();
  }

  /* angle traverse – piédroit avec les trois familles d'armatures, à l'échelle des épaisseurs */
  function drawFer(svg, m, sch) {
    const e2 = V(m, 'A2.E2') || 0.6, e3 = V(m, 'A2.E3') || 0.6;
    const p1 = V(m, 'A6.PHI1') || 0.025, p2 = V(m, 'A6.PHI2') || 0.014, p3 = V(m, 'A6.PHI3') || 0.01, c = 0.04;
    const Lt = Math.max(2.6, e3 * 4.5), Lp = Math.max(2.2, e2 * 3.6);
    const d = svg({ x0: -e2 - 0.5, y0: -Lp - 0.5, x1: Lt + 0.3, y1: e3 + 0.75 }, { pad: 0.05 });
    // béton : traverse (y 0..e3, x -e2..Lt) et piédroit (x -e2..0, y -Lp..0)
    d.poly([[-e2, e3], [Lt, e3], [Lt, 0], [0, 0], [0, -Lp], [-e2, -Lp]], 'b', 'A6.SIGMAF A1.FIP');
    const r1 = Math.max(p1 / 2, d.u * 0.28), r2 = Math.max(p2 / 2, d.u * 0.22);
    // PHI1 : nappes principales extérieure (continue dans l'angle) et intérieures
    const xo = -e2 + c + p1 / 2, yo = e3 - c - p1 / 2;
    d.path([[Lt - 0.05, yo], [xo, yo], [xo, -Lp + 0.05]], 'reb', 'A6.PHI1 A6.SIGMA1');
    d.path([[Lt - 0.05, c + p1 / 2], [-c - p1 / 2 + 0.0 - 0.0, c + p1 / 2]], 'reb', 'A6.PHI1 A6.SIGMA1');
    d.path([[-c - p1 / 2, -Lp + 0.05], [-c - p1 / 2, c + p1 / 2 + e3 * 0.6]], 'reb', 'A6.PHI1 A6.SIGMA1');
    // PHI2 : armatures de répartition (vues en coupe)
    const n2 = Math.max(3, Math.round(Lt / 0.25));
    for (let i = 1; i < n2; i++) { const x = Lt * i / n2; if (x > 0.15) { d.circle(x, yo - p1 / 2 - p2 / 2 - 0.005, r2, 'bar', 'A6.PHI2 A6.SIGMA2'); d.circle(x, c + p1 + p2 / 2, r2, 'bar', 'A6.PHI2 A6.SIGMA2'); } }
    const n2p = Math.max(3, Math.round(Lp / 0.25));
    for (let i = 1; i < n2p; i++) { const y = -Lp * i / n2p; if (y < -0.15) { d.circle(xo + p1 / 2 + p2 / 2 + 0.005, y, r2, 'bar', 'A6.PHI2 A6.SIGMA2'); d.circle(-c - p1 - p2 / 2, y, r2, 'bar', 'A6.PHI2 A6.SIGMA2'); } }
    // PHI3 : étriers / couture dans la traverse
    for (let i = 0; i < 4; i++) { const x = 0.45 + i * (Lt - 0.6) / 4; d.path([[x - 0.08, yo], [x, yo], [x, c + p1 / 2], [x - 0.08, c + p1 / 2]], 'reb3', 'A6.PHI3 A6.SIGMA3'); }
    void r1;
    const xq = Lt * 0.55, x2 = Lt * 0.3, x3 = 0.45 + 3 * (Lt - 0.6) / 4;
    d.line(xq, e3 + 0.22, xq, yo + 0.01, 'l', 'A6.PHI1 A6.SIGMA1');
    d.line(x2, -0.2, x2, c + p1 + p2 / 2, 'l', 'A6.PHI2 A6.SIGMA2');
    d.line(x3, -0.62, x3, c + p1 / 2, 'l', 'A6.PHI3 A6.SIGMA3');
    const lb = (k, s) => sch ? code(k) : s;
    d.text(Lt * 0.55, e3 + 0.35, lb('A6.PHI1', 'Ø ' + fmt(p1 * 1000, 0) + ' mm · fe ' + fmt(V(m, 'A6.SIGMA1') / 102, 0) + ' MPa') + (sch ? ' · SIGMA1' : ''), { cls: sch ? 'tc' : 'dv', size: 0.8, k: 'A6.PHI1 A6.SIGMA1' });
    d.text(x2 - 0.15, -0.3, lb('A6.PHI2', 'répartition Ø ' + fmt(p2 * 1000, 0) + ' mm · fe ' + fmt(V(m, 'A6.SIGMA2') / 102, 0) + ' MPa') + (sch ? ' · SIGMA2 (répartition)' : ''), { cls: sch ? 'tc' : 'dv', size: 0.75, a: 'start', k: 'A6.PHI2 A6.SIGMA2' });
    d.text(Math.min(x3, Lt - 1.2), -0.75, lb('A6.PHI3', 'couture Ø ' + fmt(p3 * 1000, 0) + ' mm · fe ' + fmt(V(m, 'A6.SIGMA3') / 102, 0) + ' MPa') + (sch ? ' · SIGMA3 (couture)' : ''), { cls: sch ? 'tc' : 'dv', size: 0.75, k: 'A6.PHI3 A6.SIGMA3' });
    const fc = V(m, 'A6.SIGMAF') / 0.6 / 102, fip = ['peu préjudiciable', 'préjudiciable', 'très préjudiciable'][V(m, 'A1.FIP')] || '';
    d.text(0.25, -Lp * 0.6, sch ? 'béton : SIGMAF · FIP' : 'fc28 ≈ ' + fmt(fc, 1) + ' MPa · fissuration ' + fip, { cls: sch ? 'tc' : 'dv', size: 0.75, a: 'start', k: 'A6.SIGMAF A1.FIP' });
    d.dim(-e2, -Lp, 0, -Lp, sch ? 'E2' : fmt(e2, 2), -0.3, 'A2.E2', { size: 0.75 });
    d.dim(Lt, 0, Lt, e3, sch ? 'E3' : fmt(e3, 2), -0.25, 'A2.E3', { size: 0.75 });
    d.text(Lt - 0.1, e3 / 2, 'traverse', { cls: 'ts', size: 0.7, a: 'end' });
    d.text(-e2 / 2, -Lp + 0.3, 'piédroit', { cls: 'ts', size: 0.7, rot: 90, a: 'start' });
    return d.toString();
  }

  /* charges généralisées : véhicule à essieux (S2/S3) en élévation, encombrement transversal, chenilles (S4) en plan */
  function drawGen(svg, m, sch) {
    const nes = Math.max(0, Math.min(6, Math.round(V(m, 'S2.NES'))));
    const ab = ess.slice(0, nes).map(j => V(m, 'S3.ABESS' + j)), po = ess.slice(0, nes).map(j => V(m, 'S3.POESS' + j));
    const lenc = V(m, 'S2.LONGENC'), wenc = V(m, 'S2.LARGENC'), les = V(m, 'S2.LARGES'), typ = V(m, 'S2.TYPE');
    const P = V(m, 'S4.POICHA'), lc = V(m, 'S4.LOCHE'), wc = V(m, 'S4.CHELA'), ec = V(m, 'S4.ESCHE'), wch = V(m, 'S4.LARGCHA');
    const hasV = nes > 0, hasC = P > 0 || lc > 0;
    if (!hasV && !hasC && !sch) {
      const d = svg({ x0: 0, y0: 0, x1: 20, y1: 8 }, { pad: 0.05 });
      d.text(10, 5, 'Aucune charge généralisée définie', { cls: 'ts', size: 1.1 });
      d.text(10, 3.6, 'Cartes S0 à S4 facultatives : CLASSE = 0, STATUT ≥ 2, MC = 5 ou ME = 5', { cls: 'ts', size: 0.8 });
      return d.toString();
    }
    const span = hasV ? Math.max(...ab, 0) - Math.min(...ab, 0) : 0;
    const LA = Math.max(lenc, span + 2, 6), x0A = 0, ax0 = x0A + (LA - span) / 2 - Math.min(...ab.concat([0]));
    const x0B = LA + 2.2, WB = Math.max(wenc, les + 0.4, 2.5);
    const x0C = x0B + WB + 2.4, WC = Math.max(wch, ec + wc, wc, 2.5), LC = Math.max(lc, 3);
    const xEnd = hasC || sch ? x0C + WC : x0B + WB;
    const H = Math.max(LC, 4.5);
    const d = svg({ x0: -0.5, y0: -3.0, x1: xEnd + 0.5, y1: H + 2.3 }, { pad: 0.04 });
    const k2 = 'S2.NES S3.ABESS1 S3.POESS1', y = 0;
    // A — élévation du véhicule
    if (hasV || sch) {
      d.line(x0A - 0.3, y, x0A + LA + 0.3, y, 'ground');
      d.rect(x0A + (LA - lenc) / 2, y + 0.9, Math.max(lenc, 0.5), 1.4, 'car', 'S2.LONGENC');
      ab.forEach((a, i) => {
        const x = ax0 + a, kk = `S3.ABESS${i + 1} S3.POESS${i + 1}`;
        d.circle(x, y + 0.45, 0.42, 'wheel', kk);
        arrow(d, x, y + 3.6, x, y + 2.35, kk);
        d.text(x, y + 3.95, sch ? 'POESS' + (i + 1) : fmt(po[i], 1) + ' t', { cls: sch ? 'tc' : 'dv', size: 0.7, k: kk });
        if (i > 0) d.dim(ax0 + ab[i - 1], y, x, y, sch ? '' : fmt(a - ab[i - 1], 2), -0.55, kk, { size: 0.65 });
      });
      d.text(x0A + LA / 2, y - 1.55, sch ? 'ABESSj (abscisses depuis l\'essieu 1)' : 'abscisses ' + ab.map(a => fmt(a, 2)).join(' · '), { cls: sch ? 'tc' : 'ts', size: 0.7, k: 'S3.ABESS2 S3.ABESS3' });
      d.dim(x0A + (LA - lenc) / 2, y + 2.3, x0A + (LA + lenc) / 2, y + 2.3, sch ? 'LONGENC' : fmt(lenc, 2), 0.01, 'S2.LONGENC', { size: 0.7 });
      d.text(x0A + LA / 2, H + 1.9, sch ? 'S2 / S3 — véhicule à essieux (élévation)' : 'véhicule S2/S3 — ' + nes + ' essieux, ' + fmt(po.reduce((a, b) => a + b, 0), 1) + ' t', { cls: 'ts', size: 0.8, k: k2 });
      // B — encombrement transversal
      d.line(x0B - 0.3, y, x0B + WB + 0.3, y, 'ground');
      const cB = x0B + WB / 2;
      d.rect(cB - wenc / 2, y + 0.9, Math.max(wenc, 0.2), 1.4, 'car', 'S2.LARGENC');
      if (typ === 0) d.rect(cB - les / 2, y, Math.max(les, 0.1), 0.85, 'wheel', 'S2.LARGES S2.TYPE');
      else for (const s of [-1, 1]) d.rect(cB + s * les / 2 - 0.25, y, 0.5, 0.85, 'wheel', 'S2.LARGES S2.TYPE');
      d.dim(cB - les / 2, y, cB + les / 2, y, sch ? 'LARGES' : fmt(les, 2), -0.55, 'S2.LARGES', { size: 0.7 });
      d.dim(cB - wenc / 2, y + 2.3, cB + wenc / 2, y + 2.3, sch ? 'LARGENC' : fmt(wenc, 2), 0.01, 'S2.LARGENC', { size: 0.7 });
      d.text(cB, H + 1.9, sch ? 'S2 — coupe transversale' : 'coupe transversale', { cls: 'ts', size: 0.8 });
      d.text(cB, y + 3.6, sch ? 'TYPE · DYNAB' : (typ === 0 ? 'rouleau' : '2 roues') + ' · δ ' + fmt(V(m, 'S2.DYNAB'), 2), { cls: sch ? 'tc' : 'ts', size: 0.7, k: 'S2.TYPE S2.DYNAB' });
    }
    // C — chenilles en plan
    if (hasC || sch) {
      const cC = x0C + WC / 2, yc = (H - LC) / 2;
      if (wch > 0) d.rect(cC - wch / 2, yc - 0.15, wch, LC + 0.3, 'fillz', 'S4.LARGCHA');
      const xs = ec > 0 ? [cC - ec / 2, cC + ec / 2] : [cC];
      for (const x of xs) d.rect(x - wc / 2, yc, Math.max(wc, 0.1), LC, 'wheel', 'S4.LOCHE S4.CHELA');
      d.dim(cC + WC / 2 + 0.2, yc, cC + WC / 2 + 0.2, yc + LC, sch ? 'LOCHE' : fmt(lc, 2), -0.3, 'S4.LOCHE', { size: 0.7 });
      if (ec > 0) d.dim(xs[0], yc - 0.15, xs[1], yc - 0.15, sch ? 'ESCHE' : fmt(ec, 2), -0.45, 'S4.ESCHE', { size: 0.7 });
      d.dim(xs[0] - wc / 2, yc + LC + 0.15, xs[0] + wc / 2, yc + LC + 0.15, sch ? 'CHELA' : fmt(wc, 2), 0.35, 'S4.CHELA', { size: 0.65 });
      d.text(cC, -1.55, sch ? 'POICHA · LARGCHA · DYCHA' : fmt(P, 1) + ' t · largeur ' + fmt(wch, 2) + ' · δ ' + fmt(V(m, 'S4.DYCHA'), 2), { cls: sch ? 'tc' : 'ts', size: 0.7, k: 'S4.POICHA S4.LARGCHA S4.DYCHA' });
      d.text(cC, H + 1.9, sch ? 'S4 — chenilles (vue en plan)' : 'chenilles S4 (plan)', { cls: 'ts', size: 0.8, k: 'S4.POICHA' });
    }
    // S1 / S0 rappel
    const a1 = V(m, 'S1.A1'), a0 = V(m, 'S1.A0');
    d.text(-0.3, -2.7, sch ? 'S1 : A(l) = A1·l + A0     S0 : LVOIE, CDTAj, CDTBj' : (a1 || a0 ? `A(l) = ${fmt(a1, 3)}·l + ${fmt(a0, 3)}` : 'A(l) réglementaire') + (V(m, 'S0.LVOIE') ? ` · V0 = ${fmt(V(m, 'S0.LVOIE'), 2)} m` : ''), { cls: sch ? 'tc' : 'ts', size: 0.7, a: 'start', k: 'S1.A1 S1.A0 S0.LVOIE' });
    return d.toString();
  }

  /* ───── contrôles de cohérence ───── */
  const PHIS = [0.006, 0.008, 0.010, 0.012, 0.014, 0.016, 0.020, 0.025, 0.032, 0.040];
  function checks(m) {
    const out = [], E_ = (step, k, msg) => out.push({ level: 'e', step, k, msg }), W_ = (step, k, msg) => out.push({ level: 'w', step, k, msg });
    const a = k => V(m, 'A1.' + k);
    const o = V(m, 'A2.OUVER'), h = V(m, 'A2.HAUTL'), e2 = V(m, 'A2.E2'), e3 = V(m, 'A2.E3'), bi = V(m, 'A2.BIAIS');
    const genre = V(m, 'A2.GENRE'), W = V(m, 'A2.W'), D = V(m, 'A2.DELTA');
    // titre
    if ((m.titre || '').length > 60) W_('id', 'TITRE', `titre de ${m.titre.length} caractères : 60 au plus par carte`);
    if ((m.soustitre || '').length > 60) W_('id', 'SOUSTITRE', `sous-titre de ${m.soustitre.length} caractères : 60 au plus par carte`);
    if (![0, 1, 2, 3].includes(a('CLASSE'))) E_('id', 'A1.CLASSE', 'CLASSE : 0, 1, 2 ou 3');
    if (![1, 2, 3, 4].includes(a('STATUT'))) E_('id', 'A1.STATUT', 'STATUT : 1, 2, 3 ou 4');
    // géométrie
    if (!(o > 0)) E_('geom', 'A2.OUVER', 'l\'ouverture droite OUVER doit être positive');
    if (!(h > 0)) E_('geom', 'A2.HAUTL', 'la hauteur intérieure HAUTL doit être positive');
    if (!(e2 > 0)) E_('geom', 'A2.E2', 'l\'épaisseur des piédroits E2 doit être positive');
    if (!(e3 > 0)) E_('geom', 'A2.E3', 'l\'épaisseur de la traverse E3 doit être positive');
    if (!(bi > 0 && bi <= 100)) E_('geom', 'A2.BIAIS', 'le biais est compris entre 0 et 100 grades');
    else if (bi < 65) W_('geom', 'A2.BIAIS', 'biais inférieur à 65 gr : au-delà du biais modéré visé par la méthode PIPO');
    if (h > 0 && V(m, 'A2.HREMB') >= h) W_('geom', 'A2.HREMB', 'le remblai intérieur HREMB atteint la hauteur intérieure HAUTL');
    const Lp = bi > 0 ? (o + e2) / Math.sin(bi * Math.PI / 200) : 0;
    if (a('LU') === 2 && Lp > 13) W_('id', 'A1.LU', `portée biaise ${fmt(Lp, 2)} m > 13 m : LU = 1 obligatoire pour le programme SETRA`);
    if (![1, 2, 3].includes(genre)) E_('geom', 'A2.GENRE', 'GENRE : 1 (encastré), 2 (sur semelles) ou 3 (articulé)');
    else if (genre === 2) {
      if (!(W > 0)) E_('geom', 'A2.W', 'portique sur semelles (GENRE = 2) : la largeur de semelle W doit être positive');
      else if (Math.abs(D) > W / 2 - e2 / 2 + 1e-6) W_('geom', 'A2.DELTA', `excentrement |DELTA| > (W − E2)/2 = ${fmt(W / 2 - e2 / 2, 3)} m : le piédroit déborde de sa semelle`);
      if (a('PRESS') !== 1) W_('id', 'A1.PRESS', 'portique sur semelles : PRESS = 1 attendu');
    } else {
      W_('geom', 'A2.GENRE', 'le calcul en ligne traite le portique sur semelles (GENRE = 2) ; GENRE = 1 ou 3 relève du programme SETRA');
      if (W || D) W_('geom', 'A2.W', 'GENRE ≠ 2 : porter W = 0 et DELTA = 0');
    }
    if (a('FIXSEM') === 0 && !(V(m, 'A4.PREMAX') > 0)) E_('geom', 'A4.PREMAX', 'FIXSEM = 0 : la pression admissible PREMAX est nécessaire au dimensionnement de la semelle');
    if (!(V(m, 'A4.ESOL') > 0)) E_('geom', 'A4.ESOL', 'le module du sol ESOL doit être positif (raideur de la semelle)');
    const pm = V(m, 'A4.PREMAX'); if (pm < 10 || pm > 50) W_('geom', 'A4.PREMAX', 'PREMAX hors des limites habituelles (10 à 50 t/m²)');
    // profil
    const es = V(m, 'A3.ESURCH'), nv = V(m, 'A3.PVOIE');
    if (!(es > 0)) E_('prof', 'A3.ESURCH', 'la largeur chargeable ESURCH doit être positive');
    if (!(nv >= 1)) E_('prof', 'A3.PVOIE', 'le nombre de voies PVOIE doit être au moins 1');
    else if (es >= 6 && nv !== Math.floor(es / 3)) W_('prof', 'A3.PVOIE', `partie entière de ESURCH/3 = ${Math.floor(es / 3)} voies (saisi : ${nv})`);
    if (![1, 2].includes(V(m, 'A3.SENS'))) W_('prof', 'A3.SENS', 'SENS : 1 (autoroute) ou 2 (voirie ordinaire)');
    // permanentes, dalle de transition
    if (V(m, 'A4.RANK1') > V(m, 'A4.RANK2')) W_('perm', 'A4.RANK1', 'RANK1 (minimum) dépasse RANK2 (maximum)');
    if (!(V(m, 'A4.SPEC') > 0)) W_('perm', 'A4.SPEC', 'poids des terres SPEC nul : prendre normalement 2,0 t/m³');
    const dal = a('DALTRA'), sur = a('SUREMB');
    if (dal + sur !== 1) W_('perm', 'A1.SUREMB', 'DALTRA et SUREMB sont complémentaires (l\'un vaut 1, l\'autre 0)');
    if (dal === 1) {
      if (!(V(m, 'A3.LDALT') > 0)) W_('perm', 'A3.LDALT', 'DALTRA = 1 mais la portée de dalle LDALT est nulle');
      if (!(V(m, 'A4.QDT') > 0)) W_('perm', 'A4.QDT', 'dalle de transition déclarée mais réaction QDT nulle');
      if (V(m, 'A4.PSREMB') > 0) W_('perm', 'A4.PSREMB', 'avec dalle de transition, porter PSREMB = 0');
      if (V(m, 'A3.HSREMB') > 0) W_('prof', 'A3.HSREMB', 'avec dalle de transition, porter normalement HSREMB = 0');
    } else {
      if (V(m, 'A3.LDALT') > 0) W_('perm', 'A3.LDALT', 'LDALT > 0 sans dalle de transition (DALTRA = 0) : la dalle est ignorée');
      if (V(m, 'A4.QDT') > 0) W_('perm', 'A4.QDT', 'réaction QDT sans dalle de transition (DALTRA = 0)');
      if (!(V(m, 'A4.PSREMB') > 0)) W_('perm', 'A4.PSREMB', 'sans dalle de transition, PSREMB vaut normalement 1 t/m²');
    }
    const tp = V(m, 'A4.TEMP'); if (tp < 200 || tp > 500) W_('perm', 'A4.TEMP', 'TEMP hors de l\'intervalle usuel (200 à 500 t/m²)');
    // exploitation
    if (a('TROT') && !(V(m, 'A4.PSTROT') > 0)) W_('expl', 'A4.PSTROT', 'charge de trottoir demandée (TROT = 1) mais PSTROT nul');
    if (!a('TROT') && V(m, 'A4.PSTROT') > 0) W_('expl', 'A1.TROT', 'PSTROT renseigné mais la charge de trottoir n\'est pas demandée (TROT = 0)');
    if (!a('AL') && !a('BC') && !a('BT') && !a('MC') && !a('ME') && !a('EXCEP')) W_('expl', 'A1.AL', 'aucune charge d\'exploitation n\'est retenue');
    const ks = ['KTROT', 'KA', 'KBC', 'KBT', 'KMC', 'KME', 'KEXCEP'].map(n => V(m, 'A5.' + n));
    if (a('EXCENTR') === 0 && !ks.some(x => x > 0)) W_('expl', 'A5.KA', 'EXCENTR = 0 : les coefficients K imposés de la carte 5 sont tous nuls');
    if (a('EXCENTR') !== 0 && ks.some(x => x > 0)) W_('expl', 'A5.KA', 'coefficients K saisis mais EXCENTR ≠ 0 : ils seront recalculés');
    for (const n of ['COEFA', 'COEFB', 'COEFM', 'COEFEX']) if (!(V(m, 'A5.' + n) > 0)) W_('expl', 'A5.' + n, `${n} nul : la charge correspondante est annulée (porter 1,00)`);
    // matériaux
    const fc = V(m, 'A6.SIGMAF') / 0.6 / 102;
    if (!(fc > 0)) E_('mat', 'A6.SIGMAF', 'la contrainte admissible du béton SIGMAF doit être positive');
    else if (fc < 20 || fc > 45) W_('mat', 'A6.SIGMAF', `fc28 = SIGMAF/0,6 ≈ ${fmt(fc, 1)} MPa : valeur inhabituelle`);
    for (const j of [1, 2, 3]) {
      const p = V(m, 'A6.PHI' + j), s = V(m, 'A6.SIGMA' + j);
      if (!(p > 0)) E_('mat', 'A6.PHI' + j, `le diamètre PHI${j} doit être positif (en mètre)`);
      else if (p >= 1) W_('mat', 'A6.PHI' + j, `PHI${j} = ${fmt(p, 3)} : diamètre à donner en mètre (ex. 0,025)`);
      else if (!PHIS.some(x => Math.abs(x - p) < 1e-4)) W_('mat', 'A6.PHI' + j, `diamètre PHI${j} = ${fmt(p * 1000, 0)} mm non normalisé`);
      if (!(s > 0)) E_('mat', 'A6.SIGMA' + j, `la limite d'élasticité SIGMA${j} doit être positive (t/m²)`);
      else if (s / 102 < 200 || s / 102 > 600) W_('mat', 'A6.SIGMA' + j, `SIGMA${j} ≈ ${fmt(s / 102, 0)} MPa : valeur inhabituelle (t/m² attendus)`);
    }
    if (V(m, 'A6.PHI2') > V(m, 'A6.PHI1')) W_('mat', 'A6.PHI2', 'PHI2 (répartition) supérieur à PHI1 (principales)');
    if (![0, 1, 2].includes(a('FIP'))) E_('mat', 'A1.FIP', 'FIP : 0, 1 ou 2');
    // options de calcul
    if (!a('SUITE2') && (a('ARBEI') || a('FERTRA') || a('ETRIER') || a('METRE'))) W_('id', 'A1.SUITE2', 'ARBEI, FERTRA, ETRIER, METRE exigent SUITE2 = 1');
    if (a('DESSIN') && !(V(m, 'A2.ECHELLE') > 0)) W_('id', 'A2.ECHELLE', 'dessin demandé : porter ECHELLE = 0,050');
    // charges généralisées
    const has = c => !!(m.cartes && m.cartes[c]);
    if (a('CLASSE') === 0) {
      if (!(V(m, 'S0.LVOIE') > 0)) W_('gen', 'S0.LVOIE', 'CLASSE = 0 : la carte S0 (largeur de voie nominale LVOIE) doit être remplie');
      W_('gen', 'S0.LVOIE', 'CLASSE = 0 : la carte S0 n\'est pas exploitée par le calcul en ligne (classe 1 retenue)');
    }
    if (a('STATUT') >= 2) {
      if (!(V(m, 'S2.NES') > 0)) W_('gen', 'S2.NES', `STATUT = ${a('STATUT')} : véhicule de type Bc à définir en cartes S2 et S3`);
      if (a('STATUT') >= 3 && !(V(m, 'S1.A1') || V(m, 'S1.A0'))) W_('gen', 'S1.A0', `STATUT = ${a('STATUT')} : loi A(l) à définir en carte S1`);
      W_('id', 'A1.STATUT', 'STATUT ≥ 2 : charges généralisées non prises en compte par le calcul en ligne (programme SETRA requis)');
    }
    if (a('ME') === 5) {
      if (!(V(m, 'S2.NES') > 0)) W_('gen', 'S2.NES', 'ME = 5 : véhicule à essieux à définir en cartes S2 et S3');
      if (!(V(m, 'S2.LARGENC') > 0)) W_('gen', 'S2.LARGENC', 'ME = 5 : largeur d\'encombrement LARGENC à définir');
    }
    if (a('MC') === 5) {
      if (!(V(m, 'S4.POICHA') > 0)) W_('gen', 'S4.POICHA', 'MC = 5 : charge à chenilles à définir en carte S4');
      W_('expl', 'A1.MC', 'MC = 5 : la charge S4 n\'est pas exploitée par le calcul en ligne (char Mc120 retenu)');
    }
    const nes = V(m, 'S2.NES');
    if (nes > 6) W_('gen', 'S2.NES', 'NES : 6 essieux au plus');
    if (nes > 0) for (let j = 2; j <= Math.min(6, nes); j++) if (V(m, 'S3.ABESS' + j) < V(m, 'S3.ABESS' + (j - 1))) { W_('gen', 'S3.ABESS' + j, `ABESS${j} inférieur à ABESS${j - 1} : abscisses croissantes attendues`); break; }
    const need = { S0: a('CLASSE') === 0, S1: a('STATUT') >= 3, S2: a('STATUT') >= 2 || a('ME') === 5, S3: a('STATUT') >= 2 || a('ME') === 5, S4: a('MC') === 5 };
    if (need.S3 && V(m, 'S2.NES') > 0 && !has('S3')) W_('gen', 'S3.ABESS2', 'carte S3 (abscisses et poids des essieux) à remplir avec la carte S2');
    const extra = Object.keys(need).filter(c => has(c) && !need[c]);
    if (extra.length) W_('gen', extra[0] === 'S0' ? 'S0.LVOIE' : extra[0] === 'S1' ? 'S1.A1' : extra[0] === 'S4' ? 'S4.POICHA' : 'S2.NES', `carte${extra.length > 1 ? 's' : ''} ${extra.join(', ')} écrite${extra.length > 1 ? 's' : ''} dans le bordereau sans être requise${extra.length > 1 ? 's' : ''}`);
    return out;
  }

  /* ───── résultats ───── */
  function summary(m, r) {
    const esc = G.OTUI.esc, kv = (a, b) => `<div class="ot-kv"><span>${esc(a)}</span><b>${b}</b></div>`;
    const g = r.g || {}, mt = r.mat || {}, dy = r.dyn || {}, K = r.Kc || {}, v = r.v || {};
    let h = `<div class="ot-card"><h4>Géométrie de calcul</h4>${kv('Portée biaise de calcul', fmt(g.L, 2) + ' m')}${kv('Hauteur de calcul', fmt(g.H, 2) + ' m')}${kv('Largeur droite', fmt(g.larg, 2) + ' m')}${kv('Biais', fmt(v.BIAIS, 2) + ' gr')}${kv('Épaisseurs semelle / piédroit / traverse', [g.e1, g.e2, g.e3].map(x => fmt(x, 2)).join(' / ') + ' m')}${kv(v.FIXSEM === 0 ? 'Semelle dimensionnée W / DELTA' : 'Semelle W / DELTA', fmt(g.B, 2) + ' / ' + fmt(g.D, 2) + ' m')}${r.Ldt ? kv('Dalle de transition (biaise)', fmt(r.Ldt, 2) + ' m') : ''}</div>`;
    h += `<div class="ot-card"><h4>Matériaux</h4>${kv('fc28', fmt(mt.fc / 102, 1) + ' MPa')}${kv('ft28', fmt(mt.ft / 102, 2) + ' MPa')}${kv('Module différé Ev', fmt(mt.Ev / 102, 0) + ' MPa')}${kv('σs ELS / ELU (PHI1)', fmt((mt.ssEls || [])[0] / 102, 0) + ' / ' + fmt((mt.ssElu || [])[0] / 102, 0) + ' MPa')}</div>`;
    h += `<div class="ot-card"><h4>Surcharges</h4>${kv('Majoration dynamique Bc / Bt', fmt(dy.dBc, 3) + ' / ' + fmt(dy.dBt, 3))}${kv('Majoration dynamique Mc / Me', fmt(dy.dMc, 3) + ' / ' + fmt(dy.dMe, 3))}${kv('K combinés A / Bc / Bt', [K.combA, K.combBC, K.combBT].map(x => fmt(x, 3)).join(' / '))}${kv('K Mc / Me / trottoir', [K.MC, K.ME, K.TR].map(x => fmt(x, 3)).join(' / '))}${kv('Portée fictive (Guyon-Massonnet)', fmt(K.Lf, 2) + ' m')}</div>`;
    const lab = { sup: 'Angle traverse – piédroit', mid: 'Mi-traverse', inf: 'Pied de piédroit' };
    const rows = Object.keys(lab).filter(k => r.det && r.det[k]).map(k => {
      const M = r.det[k].M;
      return `<div class="ot-kv"><span>${lab[k]}</span><b>ELS ${fmt(M.elsMin, 1)} / ${fmt(M.elsMax, 1)} · ELU ${fmt(M.eluMin, 1)} / ${fmt(M.eluMax, 1)}</b></div>`;
    }).join('');
    if (rows) h += `<div class="ot-card"><h4>Moments aux sections déterminantes (t·m/m, min / max)</h4>${rows}</div>`;
    const P = r.pressions, LV = G.PIPO_LIVE;
    if (P) {
      const ord = ['A', 'BC', 'BT', 'ME', 'MC', 'EX', 'TR'];
      const tot = (p, sg) => {
        if (!LV || !LV.combine) return null;
        const e = p.live[sg > 0 ? 'max' : 'min'], q = ord.map(x => e[x].eff), Gp = sg > 0 ? p.max : p.min;
        return LV.combine({ Gels: Gp, Gelu: Gp, A: q[0], BC: q[1], BT: q[2], ME: q[3], MC: q[4], EX: q[5], TR: q[6], RT: p.ret, TP: p.tem }, sg).els;
      };
      const pm = v.PREMAX;
      const row = (n, p) => { const t = tot(p, 1); const ok = t == null || !(pm > 0) ? '' : t <= pm ? ' <span class="ok">≤ PREMAX</span>' : ' <span class="ko">> PREMAX</span>'; return kv(n, `perm. ${fmt(p.min, 2)} à ${fmt(p.max, 2)}${t != null ? ` · ELS max ${fmt(t, 2)}` : ''} t/m²${ok}`); };
      h += `<div class="ot-card"><h4>Pressions sous semelle</h4>${row('Bord extérieur', P.ext)}${row('Bord intérieur', P.int)}${kv('Pression admissible PREMAX', fmt(pm, 2) + ' t/m²')}</div>`;
    }
    return h;
  }

  /* ───── exemples et nouveau ───── */
  const HEAD = (n) => [
    '                               ******************************************** ',
    '                               *                                          * ',
    '                               * BORDEREAU DES DONNEES DU PIPO N.' + n + '     * ',
    '                               *                                          * ',
    '                               ******************************************** ', ' ', ' ',
    '           C  S  L  E  D  S  L  P  P  T  A  B  B  M  M  E   M  E  M  P  S  A  F  E  M  L  D  M  P  F  F ',
    '           L  T  U  X  A  U  I  O  E  R     C  T  C  E  X   O  F  O  R  U  R  E  T  E  I  E  R  S  I  I ',
    '           A  A     C  L  R  G  U  R  O                     M  T  T  E  I  B  R  R  T  B  S  B  H  X  P ',
    '           S  T     E  T  E  N  S  M  T                     E  R  R  S  T  A  T  I  R  D  S     2  S '];
  const CL = {
    2: 'CARTE 2 - HAUTL   HREMB   OUVER   BIAIS    E2      E3      W      DELTA GEN  ECHEL ',
    3: 'CARTE 3 - ETROG   EGAUC   ESURC   EDROI   ETROD  IS  IV   HCHAU   HSREM   LDALT ',
    4: 'CARTE 4 - RANK1   RANK2   ESOL    PREMA   SPEC    QSUP    QDT     PSREM   PSTRO   RETRA   TEMPE ',
    5: 'CARTE 5 - COEFA  COEFB  COEFM  COEFE  KTR   KSA   KBC   KBT   KMC   KME   KEX ',
    6: 'CARTE 6 - PHI1     PHI2    PHI3   SIGN1   SIGN2   SIGN3    SIGBP ',
  };
  const EX1 = HEAD('0001').concat([
    'CARTE 1 -  1  1  1  1  1  0  1  1  1  0  1  1  1  4  4  2   1  1  1  1  1  1  1  1  1  0  1  0  0  1  1 ', ' ',
    CL[2], '          8.000   3.600  10.000 100.000   0.600   0.600   4.000  -0.050  2   0.050 ', ' ',
    CL[3], '          0.000   3.300   7.000   3.300   0.000   2   2   0.450   0.000   4.000 ', ' ',
    CL[4], '          0.250   0.500  84500.  40.000   2.000   1.782   4.805   0.000   0.000    469.    410. ', ' ',
    CL[5], '          1.000  1.000  1.000  1.000  0.000 0.000 0.000 0.000 0.000 0.000 0.000 ', ' ',
    CL[6], '          0.025   0.016   0.010   51000.  51000.  51000.   1836. ',
    'CARTE 7 - EXEMPLE DE PORTIQUE OUVERT SUR SEMELLES                     /0001    /04-11-26 ', ' ',
    'CARTE 8 - PASSAGE INFERIEUR - OUVERTURE 10 M - DALLES DE TRANSITION ']).join('\n');
  const EX2 = HEAD('0002').concat([
    'CARTE 1 -  1  1  1  1  0  1  2  1  1  0  1  1  1  4  4  2   1  1  1  1  1  1  1  1  1  0  1  0  0  1  1 ', ' ',
    CL[2], '          7.000   2.000  10.500  65.000   0.700   0.700   4.000   0.000  2   0.050 ', ' ',
    CL[3], '          0.000   0.000   8.540   0.000   0.000   2   2   1.780   2.520   0.000 ', ' ',
    CL[4], '          0.250   0.500  20996.  40.000   2.000   5.866   0.000   1.000   0.000    460.    345. ', ' ',
    CL[5], '          1.000  1.000  1.000  1.000  0.000 0.000 0.000 0.000 0.000 0.000 0.000 ', ' ',
    CL[6], '          0.032   0.020   0.010   50000.  50000.  50000.   1800. ',
    'CARTE 7 - EXEMPLE DE PORTIQUE BIAIS SOUS REMBLAI                      /0002    /04-11-26 ', ' ',
    'CARTE 8 - PASSAGE INFERIEUR - OUVERTURE 10,50 M - BIAIS 65 GR ']).join('\n');

  function blank() {
    const m = E.parseBordereau(EX1);
    m.titre = ''; m.soustitre = ''; m.numero = '0001'; m.date = '';
    for (const c of ['S0', 'S1', 'S2', 'S3', 'S4']) delete m.cartes[c];
    m.present = (m.present || []).filter(c => !/^S/.test(c));
    return m;
  }

  G.PIPO_UI = {
    prog: 'PIPO-EL', engine: E, steps, get, set, onChange, checks, summary, blank,
    numero: m => m.numero || '0001',
    examples: [{ label: 'Portique 10 m sur semelles, dalles de transition', text: EX1 }, { label: 'Portique biais 65 gr sous 2,50 m de remblai', text: EX2 }],
    views: [
      { id: 'coupe', label: 'Coupe', draw: (svg, m) => drawCoupe(svg, m, false) },
      { id: 'travers', label: 'Profil en travers', draw: (svg, m) => drawTravers(svg, m, false) },
      { id: 'plan', label: 'Vue en plan', draw: (svg, m) => drawPlan(svg, m, false) },
      { id: 'fer', label: 'Armatures', draw: (svg, m) => drawFer(svg, m, false) },
      { id: 'gen', label: 'Charges S', draw: (svg, m) => drawGen(svg, m, false) },
    ],
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
