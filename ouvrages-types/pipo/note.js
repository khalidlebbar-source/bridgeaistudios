// PIPO-EL — génération de la note de calcul (format listing SETRA PIPO-EL V1.02).
(function (root) {
  'use strict';
  const req = (typeof require === 'function' && typeof module !== 'undefined');
  const P = req ? require('./parse.js') : root.PIPO_PARSE;
  const LV = req ? require('./live.js') : root.PIPO_LIVE;

  const F = (x, w, d) => { const k = 10 ** d; x = Math.round(x * k + (x >= 0 ? 1e-7 : -1e-7)) / k; let s = x.toFixed(d); if (/^-0\.?0*$/.test(s)) s = s.slice(1); return s.padStart(w); };
  const E = (x, w) => (Math.round(x) + '.').padStart(w); // format "1836."
  const sp = n => ' '.repeat(n);

  function controle(m, r) {
    const v = r.v, L = [sp(39) + 'RESULTATS DU CONTROLE DES DONNEES', sp(39) + '=================================', ' '];
    if (v.PREMAX < 10 || v.PREMAX > 50) L.push('  PREMAX HORS DES LIMITES HABITUELLES');
    if (v.TEMP > 500 || v.TEMP < 200) L.push('  TEMP. ANORMAL');
    if (v.SIGMAF !== 1500) L.push('  SIGMAB ANORMAUX');
    L.push(' ');
    if (v.FIXSEM === 0) (r.dimSeq || [[r.g.B, r.g.D]]).forEach(([w, d], i) => { if (i) L.push(' '); L.push('DIMENSIONNEMENT DE LA SEMELLE      LARGEUR :' + F(w, 11, 4) + '  EXCENTREMENT :' + F(d, 11, 4)); });
    return L;
  }

  function generalites(m, r) {
    const { v, g, mat } = r, L = [];
    L.push(sp(56) + 'GEOMETRIE          OUVRAGE SUR SEMELLES', sp(56) + '=========');
    L.push(sp(90) + 'BIAIS          ' + F(v.BIAIS, 8, 2) + ' GR');
    L.push(sp(90) + 'HAUTEUR LIBRE    ' + F(v.HAUTL, 6, 2) + ' M');
    L.push(sp(90) + 'OUVERTURE DROITE ' + F(v.OUVER, 6, 2) + ' M');
    L.push(sp(90) + 'LARGEUR DROITE   ' + F(g.larg, 6, 2) + ' M');
    L.push(sp(90) + 'DALLE TRANSITION ' + F(v.LDALT, 6, 2) + ' M', ' ');
    L.push(' CARACTERISTIQUES OPTIMISEES');
    L.push(sp(29) + 'EPAISSEURS SEMELLES' + F(g.e1, 7, 2) + ' M         SEMELLES LARGEUR   ' + F(g.B, 8, 2) + ' M          PORTEE         ' + F(g.L, 8, 2) + ' M');
    L.push(sp(40) + 'PIEDROITS' + F(g.e2, 6, 2) + ' M                  EXCENTREMENT' + F(g.D, 6, 2) + ' M          HAUTEUR MOYENNE' + F(g.H, 8, 2) + ' M');
    L.push(sp(40) + 'TRAVERSE ' + F(g.e3, 6, 2) + ' M', ' ');
    L.push('VOIE PORTEE           ' + [v.ETROTG, v.EGAU, v.ESURCH, v.EDROI, v.ETROTD].map(x => F(x, 6, 2) + ' M').join('  + '), ' ');
    L.push('HAUTEUR DE REMBLAIS INTERIEUR' + sp(29) + F(v.HREMB, 6, 2) + ' M', ' ');
    L.push('EPAISSEUR EQUIVALENTE CHAUSSEE' + sp(28) + F(v.HCHAU, 6, 2) + ' M');
    L.push('HAUTEUR DE REMBLAIS SUR LA TRAVERSE' + sp(23) + F(v.HSREMB, 6, 2) + ' M', ' ', ' ');
    L.push(sp(56) + 'MATERIAUX', sp(56) + '=========', ' ');
    L.push('BETON   RESISTANCES CARACTERISTIQUES A LA COMPRESSION ' + E(mat.fc, 6) + ' T/M2');
    L.push(sp(37) + 'A LA TRACTION     ' + E(mat.ft, 5) + ' T/M2');
    L.push('        MODULE  DE DEFORMATION DIFFEREE   ' + E(mat.Ev, 9) + ' T/M2', ' ');
    L.push('ACIER   DIAMETRES UTILISES              PHI1 =' + F(v.PHI1, 6, 3) + ' M         PHI2 =' + F(v.PHI2, 6, 3) + ' M         PHI3 =' + F(v.PHI3, 6, 3) + ' M');
    L.push("        LIMITES D'ELASTICITE              " + E(v.SIGMA1, 8) + ' T/M2             ' + E(v.SIGMA2, 8) + ' T/M2             ' + E(v.SIGMA3, 8) + ' T/M2');
    L.push('        COEEFICIENTS FISSURATION            1.60                   1.60                   1.60', ' ');
    L.push('        COEEFICIENT DE SCELLEMENT   1.50', '        ENROBAGES DESSUS TRAVERSE  0.035 M', '                  AUTRES           0.025 M', ' ');
    L.push('SOL     POIDS SPECIFIQUE' + F(v.SPEC, 5, 2) + ' T/M3');
    L.push("        MODULE D'ELASTICITE  " + E(v.ESOL, 7) + ' T/M2');
    L.push('        COEFFICIENTS DE RANKINE ' + F(v.RANK1, 6, 3) + ' ET' + F(v.RANK2, 6, 3));
    L.push('        PRESSION ADMISCIBLE   ' + F(v.PREMAX, 6, 2) + ' T/M2', ' ');
    L.push(sp(56) + 'REGLEMENT DE CALCUL', sp(56) + '===================', ' ');
    L.push('ETAT LIMITE DE SERVICE');
    if (v.FIP >= 1) {
      L.push('     (E.L.S.)           FISSURATION ' + (v.FIP === 2 ? 'TRES ' : '') + 'PREJUDICIABLE');
      L.push('                        COMPRESSION LIMITE DU BETON  ' + E(mat.sigb, 6) + ' T/M2');
      L.push('                        TRACTION LIMITE DES ACIERS       ' + mat.ssEls.map((s, i) => 'PHI' + (i + 1) + ' ' + E(s, 7) + ' T/M2').join('     '));
    } else {
      L.push('     (E.L.S.)           FISSURATION PEU PREJUDICIALE');
      L.push('                        COMPRESSION LIMITE DU BETON  ' + E(mat.sigb, 6) + ' T/M2');
      L.push('                        PAS DE TRACTION LIMITE DES ACIERS');
    }
    L.push('                        COEFFICIENT DE POISSON   0.000', '                        EQUIVALENCE ACIER - BETON  15', ' ');
    L.push('ETAT LIMITE ULTIME', '     (E.L.U.)           COEFFICIENT DE POISSON   0.000');
    L.push('                        COMPRESSION LIMITE DU BETON   ' + E(mat.fbu, 6) + ' T/M2');
    L.push('                        TRACTION LIMITE DES ACIERS       ' + mat.ssElu.map((s, i) => 'PHI' + (i + 1) + ' ' + E(s, 7) + ' T/M2').join('     '));
    L.push("                        AUCUNE ARMATURE D'EFFORT TRANCHANT SI LA CONTRAINTE EST AU PLUS EGALE A  " + E(mat.tauSans, 5) + ' T/M2');
    L.push('                        CONTRAINTE TANGENTE LIMITE DU BETON  ' + E(mat.tauLim, 5) + ' T/M2');
    L.push("                        CONTRAINTE D'ADHERENCE VIS A VIS DE L'ANCRAGE DES ACIERS  " + E(mat.tauSu, 5) + ' T/M2', ' ');
    L.push(sp(56) + 'CHARGES', sp(56) + '=======', ' ', ' ');
    L.push('           POIDS DES SUPERSTRUCTURES          ' + F(v.QSUP, 7, 3) + 'T/M2');
    L.push('           DENSITE DE CHARGE DE TROTTOIRS     ' + F(v.PSTROT, 7, 3) + 'T/M2');
    L.push('           DENSITE DE CHARGE DE REMBLAI       ' + F(v.PSREMB, 7, 3) + 'T/M2');
    L.push('           REACTION DE LA DALLE DE TRANSITION ' + F(v.QDT, 7, 3) + 'T/M2');
    L.push('           RETRAIT (RACCOURCISSEMENT)          ' + E(v.RETRAIT, 6) + 'T/M2');
    L.push('           TEMPERATURE                         ' + E(v.TEMP, 6) + 'T/M2', ' ');
    L.push(sp(51) + '*              *              *', ' ');
    L.push('           COEFFICIENTS DE PRISE EN COMPTE DES CHARGES');
    L.push('                        COEFA=' + v.COEFA.toFixed(3) + '         COEFB=' + v.COEFB.toFixed(3) + '         COEFM=' + v.COEFM.toFixed(3) + '         COEFEX=' + v.COEFEX.toFixed(3));
    return L;
  }

  function lignesInfluence(r) {
    const L = [sp(34) + "*     LIGNES   D'INFLUENCE   DES   MOMENTS   LONGITUDINAUX     *", ' ', sp(46) + 'CHARGE  UNITE  SUR  LA  TRAVERSE  SUPERIEURE', ' ', ' ',
      sp(31) + 'ABSCISSE         ANGLE INFERIEUR      ANGLE SUPERIEUR       MILIEU TRAVERSE SUPERIEURE', ' '];
    for (const l of r.li) L.push(F(l.x, 37, 2) + F(l.Minf, 19, 4) + F(l.Msup, 21, 4) + F(l.Mmid, 24, 4), ' ');
    return L;
  }

  function momentsPermanents(r) {
    const L = [sp(47) + 'M O M E N T S     P E R M A N E N T S', ' ', sp(57) + '*       *       *', ' ', ' ',
      sp(35) + 'CHARGE PERMANENTE  DALLE TRANSITION    EFFET TERRES  HAUTEUR SUPPLEM     EFFORT TOTAL',
      sp(89) + 'DE  REMBLAI         E.L.S.     E.L.U.', ' '];
    const row = (lab, mm, a) => lab + mm + F(a[0], 12, 2) + F(a[1], 19, 2) + F(a[2], 18, 2) + F(a[3], 15, 2) + F(a[4], 16, 2) + F(a[5], 11, 2);
    for (const [lab, k] of [['             ANGLE INFERIEUR   ', 'inf'], ['             ANGLE SUPERIEUR   ', 'sup'], ['             1/2 TRAVERSE SUP  ', 'mid']]) {
      L.push(row(lab, 'MAX', r.perm[k].max), row(sp(31), 'MIN', r.perm[k].min), ' ');
    }
    return L;
  }

  function majDyn(r) {
    const d = r.dyn, L = [sp(44) + 'COEFFICIENTS  DE  MAJORATION  DYNAMIQUE', ' ', ' ', sp(62) + '*', ' ', ' ', sp(34) + 'TYPE            SURCHARGE            COEF MAJDYN', ' ', ' '];
    for (const [t, S, c] of [['BC', d.SBc, d.dBc], ['BT', d.SBt, d.dBt], ['MC', d.SMc, d.dMc], ['ME', d.SMe, d.dMe]])
      L.push(sp(35) + t + E(S, 17) + ' T.' + F(c, 21, 3), ' ', ' ');
    if (r.v.EXCENTR === 2) {
      const K = r.Kc, b = K.b;
      L.push(' ', sp(27) + "LIGNES D'INFLUENCE DE LA REPARTITION TRANSVERSALE DES MOMENTS LONGITUDINAUX", ' ', sp(44) + "LARGEUR DROITE DE L'OUVRAGE B=" + F(2 * b, 7, 3), ' ',
        "  FIBRE D'ETUDE                     VALEUR DES LIGNES D'INFLUENCE DANS LES SECTIONS", '                     -B       -0,75 B    -0,5 B     -0,25 B       0        0,25 B     0,5 B      0,75 B      B', ' ');
      K.table.forEach((row, i) => L.push(F(-b + i * b / 4, 12, 4) + row.map(x => F(x, 11, 5)).join(''), ' '));
    }
    return L;
  }

  function semelleLI(r) {
    const L = [sp(45) + 'S  E  M  E  L  L  E  S', ' ', ' ', ' ', ' ', sp(26) + 'POUR UNE TRANCHE DE 1M. DE SEMELLE PRISE PERPENDICULAIREMENT AU PIEDROIT', ' ', ' ',
      sp(36) + "LIGNES D'INFLUENCE SOUS CHARGE APPLIQUEE A LA TRAVERSE DES", ' ', ' ',
      "             ABSCISSE     R E A C T I O N S         P  R  E  S  S  I  O  N  S       MOMENTS D'ENCASTREMENT",
      '                        VERTICALE  HORIZONTALE   BORD EXTERIEUR  BORD INTERIEUR   SEMELLE EXT.  SEMELLE INT.', ' '];
    for (const s of r.liSem) L.push(F(s.x, 20, 2) + F(s.V, 13, 5) + F(s.H, 12, 5) + F(s.pe, 15, 5) + F(s.pi, 16, 5) + F(s.mE, 17, 5) + F(s.mI, 13, 5), ' ');
    return L;
  }


  function chargesTexte(r) {
    const v = r.v, L = [];
    const nc = ' N A PAS ETE CONSIDEREE';
    L.push('           SURCHARGE REPARTIE TYPE A', '                         ' + (v.AL ? 'SURCHARGE A(L) DU FASCICULE 61 TITRE II (1971)' : 'LA SURCHARGE DE TYPE A' + nc), ' ');
    L.push('           SURCHARGE MOBILE TYPE BC', '                         ' + (v.BC ? 'SURCHARGE BC DU FASCICULE 61 TITRE II (1971)' : 'LA SURCHARGE DE TYPE BC' + nc), ' ');
    L.push('          SURCHARGE MOBILE BT', '                         ' + (v.BT ? 'SURCHARGE BT DU FASCICULE 61 TITRE II (1971)' : 'LA SURCHARGE DE TYPE BT' + nc), ' ');
    L.push('           SURCHARGE MILITAIRE');
    L.push('                         ' + (v.MC === 4 ? 'CHAR STANAG 120' : v.MC === 3 ? 'CHAR STANAG 80' : 'LA SURCHARGE DE TYPE MC' + nc));
    L.push('                         ' + (v.ME === 4 ? 'ME   STANAG 120' : v.ME === 3 ? 'ME   STANAG 80' : 'LA SURCHARGE DE TYPE ME' + nc), ' ');
    L.push('           SURCHARGE EXCEPTIONNELLE DU FASCICULE 61 TITRE II  (1971)', '                         ' + (v.EXCEP === 2 ? 'TYPE E' : v.EXCEP === 1 ? 'TYPE D' : 'LA SURCHARGE EXCEPTIONNELLE' + nc), ' ');
    return L;
  }
  const Z = n => Array(n).fill(0);
  const LIVE = ['A', 'BC', 'BT', 'MC', 'ME', 'EX', 'TR'];
  function ligneM(lab, mm, x, M, sens, ret, tem, lv) {
    const els = sens > 0 ? M.elsMax : M.elsMin, elu = sens > 0 ? M.eluMax : M.eluMin;
    const e = lv ? lv[sens > 0 ? 'max' : 'min'] : null;
    const q = LIVE.map(k => e ? e[k].eff : 0);
    const c = { Gels: els, Gelu: elu, A: q[0], BC: q[1], BT: q[2], MC: q[3], ME: q[4], EX: q[5], TR: q[6], RT: ret, TP: tem };
    const t = LV.combine(c, sens);
    const live = q.map(z => F(z, 7, 2)).join('') + F(0, 7, 2);
    return lab + mm + (x == null ? sp(6) : F(x, 6, 2)) + F(els, 8, 2) + F(elu, 7, 2) + ' ' + live + F(ret, 7, 2) + F(tem, 7, 2) + F(t.els, 11, 2) + F(t.elu, 9, 2);
  }
  function sectionsDet(r) {
    const L = [sp(30) + 'M O M E N T S   F L E C H I S S A N T S   E X T R E M E S', ' ', sp(28) + 'D A N S   L E S   S E C T I O N S   D E T E R M I N A N T E S', ' ', sp(45) + '*           *           *', ' ',
      sp(105) + 'M O M E N T S   T O T A U X', sp(21) + 'CHARGE PERMA      EFFET      NON      PONDERE      DES      SURCHARGES              PONDERES    PONDERES',
      sp(21) + 'E.L.S. E.L.U.    A      BC     BT     CM     ME     EX    TROT   REMB   RETR   TEMP   E.L.S.      E.L.U.', ' '];
    for (const [a, b, k] of [['ANGLE           ', '   SUPERIEUR    ', 'sup'], ['ANGLE           ', '   INFERIEUR    ', 'inf'], ['MILIEU TRAVERSE ', '   SUPERIEURE   ', 'mid']]) {
      const d = r.det[k];
      L.push(ligneM(a, 'MAX', null, d.M, 1, d.ret, d.tem, r.liveDet[k]).replace(/^(.{19}) {6}/, '$1'), ligneM(b, 'MIN', null, d.M, -1, d.ret, d.tem, r.liveDet[k]).replace(/^(.{19}) {6}/, '$1'), ' ', ' ');
    }
    return L;
  }
  function diag(r, quoi) {
    const tr = quoi === 'T';
    const L = [sp(42) + 'M O M E N T S   F L E C H I S S A N T S   E X T R E M E S', ' ',
      tr ? sp(45) + 'S U R   L A   T R A V E R S E   S U P E R I E U R E' : sp(53) + 'S U R   L E   P I E D R O I T                 (OUVRAGE FINI)', ' ', sp(70) + '*', ' ',
      sp(48) + (tr ? "LES ABSCISSES SONT COMPTEES A PARTIR DE L'ANGLE" : 'LES ABSCISSES SONT COMPTEES A PARTIR DE LA BASE'),
      sp(111) + 'MOMENTS TOTAUX', '       ABSCIS   CHARGE PERMA   EFFET    NON  PONDERE   DES   SURCHARGES                                   PONDERES     PONDERES',
      '       SECTION  E.L.S. E.L.U.      A      BC     BT     CM     ME     EX     TR   REMB   RETR   TEMP      E.L.S.    E.L.U.', ' ', ' '];
    (tr ? r.secT : r.secP).forEach((s, i) => { const lv = (tr ? r.liveT : r.liveP)[i].M; L.push(ligneM('     ', 'MAX', s.x, s.M, 1, s.ret, s.tem, lv), ligneM('    ', 'MIN', null, s.M, -1, s.ret, s.tem, lv), ' '); });
    return L;
  }
  function deplacements(r) {
    const d = r.depl, L = [sp(28) + 'M O M E N T S   D U S   A   D E S             D E P L A C E M E N T S', ' ', sp(29) + 'O U   A   D E S   R O T A T I O N S   D E S   A P P U I S', ' ', ' ', ' ', ' ',
      sp(29) + 'SOULEVEMENT APPUI      RAPPROCHEMENT APPUIS     ROTATIONS SYMETRIQUES  ROTATIONS ANTISYMETRIQUES',
      sp(32) + 'DE  1 CM                DE  1 CM                DE 0.01 RADIAN            DE 0.01 RADIAN', ' '];
    const row = (lab, f) => lab + d.map((c, i) => F(c[f], i ? 22 + (i === 3 ? 2 : 0) : 14, 3)).join('');
    L.push(row('         ANGLE SUPERIEUR  ', 'sup'), ' ', row('          BASE DU PIEDROIT', 'base'), ' ', row('          1/2 TRAVERSE SUP', 'mid'), ' ', ' ');
    L.push('         ENCASTREMENT', row('             SEMELLE INT.', 'mI'), ' ', ' ', '         ENCASTREMENT', row('             SEMELLE EXT.', 'mE'));
    return L;
  }
  function tranchants(r, quoi) {
    const tr = quoi === 'T';
    const L = [sp(43) + 'CALCUL   DES   EFFORTS   TRANCHANTS   EXTREMES', ' ', sp(61) + '***', ' ',
      tr ? sp(45) + 'T R A V E R S E   S U P E R I E U R E' : sp(53) + 'P I E D R O I T', ' ',
      sp(39) + (tr ? "LES ABSCISSES SONT COMPTEES A PARTIR DE L'ANGLE" : 'LES ABSCISSES SONT COMPTEES A PARTIR DE LA BASE'), ' ',
      sp(112) + 'EFFORT TOTAL', '          ABSCISSE    CHARGE         EFFET      NON      PONDERE      DES      SURCHARGES                        PONDERES',
      '          SECTION     PERMAN     A      BC      BT      MC      ME      EX   TROTTOIR  REMBLAI  RETRAI  TEMPE    E.L.U.', ' '];
    (tr ? r.secT : r.secP).forEach((s, i) => {
      const vr = Math.abs(s.vret), vt = Math.abs(s.vtem); const lv = (tr ? r.liveT : r.liveP)[i].V;
      for (const sg of [1, -1]) {
        const e = lv[sg > 0 ? 'max' : 'min'], q = LIVE.map(k => e[k].eff), G = sg > 0 ? s.V.eluMax : s.V.eluMin;
        const t = LV.combine({ Gels: G, Gelu: G, A: q[0], BC: q[1], BT: q[2], MC: q[3], ME: q[4], EX: q[5], TR: q[6], RT: tr ? 0 : vr, TP: tr ? 0 : vt }, sg);
        const live = q.slice(0, 6).map(z => F(z, 8, 2)).join('') + F(q[6], 8, 2) + F(0, 8, 2);
        L.push((sg > 0 ? 'MAX' + F(s.x, 12, 2) : '   MIN' + sp(15)) + F(G, 12, 2) + ' ' + live + F(tr ? 0 : vr, 8, 2) + F(tr ? 0 : vt, 8, 2) + F(t.elu, 10, 2));
      }
      L.push(' ');
    });
    return L;
  }


  function tablesSurcharges(r, quoi) {
    const tr = quoi === 'T', out = [], K = r.Kc, d = r.dyn, v = r.v;
    const secs = tr ? r.secT : r.secP, lvs = (tr ? r.liveT : r.liveP).map(o => o.M);
    const head = (titre, akx) => [sp(44) + 'M O M E N T S   D U S   A   ' + titre, ' ', tr ? sp(46) + 'S U R   L A   T R A V E R S E   S U P E R I E U R E' : sp(54) + 'S U R   L E   P I E D R O I T', ' ', sp(70) + '*', ' ',
      sp(48) + (tr ? "LES ABSCISSES SONT COMPTEES A PARTIR DE L'ANGLE" : 'LES ABSCISSES SONT COMPTEES A PARTIR DE LA BASE'), ' ', akx, ' '];
    const blocs = [];
    if (v.AL) { const L = head('L A   S U R C H A R G E   A', sp(66) + 'AKXA=' + F(K.combA, 7, 4));
      L.push(sp(43) + 'ABSCISSE   LONGUEURS CHARGEES    AIRES        EFFORTS  DUS  A  A', sp(43) + 'SECTION                           XA(L)        (SANS PONDERATION)', ' ');
      secs.forEach((s, i) => { const e = lvs[i]; L.push(sp(34) + 'MAX' + F(s.x, 13, 2) + F(e.max.A.l, 15, 2) + F(e.max.A.aire, 18, 2) + F(e.max.A.eff, 18, 2), sp(34) + 'MIN' + sp(13) + F(e.min.A.l, 15, 2) + F(e.min.A.aire, 18, 2) + F(e.min.A.eff, 18, 2), ' '); });
      blocs.push(L); }
    if (v.BC) { const L = head('L A   S U R C H A R G E   B C', sp(54) + 'AKXBC =' + F(K.combBC, 7, 4) + '     DELTA BC =' + F(d.dBc, 6, 3));
      L.push(sp(35) + 'ABSCISSE   ABSCISSE DES CAMIONS    SENS DE     SOMMES DES     EFFORTS DUS A BC', sp(35) + 'SECTION    NO 1    NO 2    NO 3    MARCHE      ORDONNEES        (SANS PONDERATION)', ' ');
      secs.forEach((s, i) => { for (const k of ['max', 'min']) { const e = lvs[i][k].BC;
        L.push(sp(27) + k.toUpperCase() + (k === 'max' ? F(s.x, 9, 2) : sp(9)) + F(e.pos[0], 8, 2) + F(e.pos[1], 8, 2) + F(0, 8, 2) + String(e.sens).padStart(9) + F(e.s, 17, 3) + F(e.eff, 17, 2)); } L.push(' '); });
      blocs.push(L); }
    if (v.BT) { const L = head('L A    S U R C H A R G E    B T', sp(46) + 'AKXBT =' + F(K.combBT, 7, 4) + '      DELTA BT =' + F(d.dBt, 6, 3));
      L.push(sp(36) + 'ABSCISSE    ABSCISSE DU       SOMME DES       EFFORTS DUS AU TANDEM', sp(36) + 'SECTION       TANDEM          ORDONNEES         (SANS PONDERATION)', ' ');
      secs.forEach((s, i) => { for (const k of ['max', 'min']) { const e = lvs[i][k].BT; L.push(sp(25) + k.toUpperCase() + (k === 'max' ? F(s.x, 14, 2) : sp(14)) + F(e.x, 13, 2) + F(e.s, 17, 3) + F(e.eff, 21, 2)); } L.push(' '); });
      blocs.push(L); }
    if (v.ME) { const L = head('L A   S U R C H A R G E   M E', sp(46) + 'AKXME =' + F(K.ME, 7, 4) + '      DELTA ME =' + F(d.dMe, 6, 3));
      L.push(sp(35) + 'ABSCISSE   ABSCISSE DES CAMIONS                SOMME DES     EFFORTS DUS A ME', sp(35) + 'SECTION    NO 1    N0 2    NO 3                0RDONNEES    (SANS PONDERATION)', ' ');
      secs.forEach((s, i) => { for (const k of ['max', 'min']) { const e = lvs[i][k].ME; L.push(sp(27) + k.toUpperCase() + (k === 'max' ? F(s.x, 9, 2) : sp(9)) + F(e.x, 8, 2) + F(0, 8, 2) + F(0, 8, 2) + F(e.s, 24, 3) + F(e.eff, 17, 2)); } L.push(' '); });
      blocs.push(L); }
    if (v.MC) { const L = head('L A   S U R C H A R G E     M C', sp(46) + 'AKXMC =' + F(K.MC, 7, 4) + '     DELTA MC =' + F(d.dMc, 6, 3));
      L.push(sp(36) + 'ABSCISSE    ABSCISSE DU         AIRE          EFFORT DU A MC', sp(51) + 'CM                             (SANS PONDERATION)', ' ');
      secs.forEach((s, i) => { for (const k of ['max', 'min']) { const e = lvs[i][k].MC; L.push(sp(25) + k.toUpperCase() + (k === 'max' ? F(s.x, 14, 2) : sp(14)) + F(e.x, 13, 2) + F(e.aire, 17, 3) + F(e.eff, 21, 2)); } L.push(' '); });
      blocs.push(L); }
    if (v.EXCEP) { const L = head('L A   S U R C H A R G E      E X', sp(56) + 'AKXEX =' + F(K.EX, 7, 4));
      L.push(sp(38) + 'ABSCISSE   ABSCISSE DU                EFFORTS DUS AU TANDEM', sp(51) + 'CAMION          AIRE           (SANS PONDERATION)', ' ');
      secs.forEach((s, i) => { for (const k of ['max', 'min']) { const e = lvs[i][k].EX; L.push(sp(25) + k.toUpperCase() + (k === 'max' ? F(s.x, 14, 2) : sp(14)) + F(e.x, 13, 2) + F(e.aire, 17, 3) + F(e.eff, 21, 2)); } L.push(' '); });
      blocs.push(L); }
    if (v.TROT && v.PSTROT) { const L = head('S U R C H A R G E     D E   T R O T T O I R', sp(52) + 'AKXTR =' + F(K.TR, 7, 4));
      L.push(sp(30) + 'ABSCISSE    LONGUEURS CHARGEES    AIRES X      EFFORTS DUS A LA SURCHARGE', sp(30) + 'SECTION                            PSTROT      DE TROTTOIR (SANS PONDERATION)', ' ');
      secs.forEach((s, i) => { for (const k of ['max', 'min']) { const e = lvs[i][k].TR; L.push(sp(22) + k.toUpperCase() + (k === 'max' ? F(s.x, 13, 2) : sp(13)) + F(e.l, 14, 2) + F(e.aire, 19, 2) + F(e.eff, 22, 2)); } L.push(' '); });
      blocs.push(L); }
    for (const b of blocs) out.push(...b, '\f');
    return out;
  }


  function coefK(r) {
    const K = r.Kc, v = r.v, L = [sp(34) + 'COEFFICIENTS  K  DE  REPARTITION  TRANSVERSALE', ' ', sp(43) + 'DES  MOMENTS  LONGITUDINAUX', ' ', ' ', ' ',
      sp(26) + 'PORTEE FICTIVE   ' + F(K.Lf, 7, 2), ' ', sp(26) + 'LARGEUR DROITE    ' + F(r.g.larg, 7, 2), ' ',
      sp(26) + "PARAMETRE D'ENTRETOISEMENT    TETA =" + F(K.theta, 6, 3) + '(LONGITUDINAL)', ' ', ' ', ' ', sp(52) + 'COEFFICIENTS RELATIFS AUX SURCHARGES', ' ',
      '              NOMBRE DE VOIES     A             BC           BT           MC           ME     EXCEPTIONNELLE  TROTTOIR', ' ', ' '];
    const n = Math.max(K.A.length, 1);
    for (let i = 0; i < n; i++) {
      let l = String(i + 1).padStart(22) + F(K.A[i] || 0, 16, 4);
      if (i < K.BC.length) l += F(K.BC[i], 14, 4); if (i < K.BT.length) l += F(K.BT[i], 13, 4);
      if (i === 0) l += F(K.MC, 13, 4) + F(K.ME, 13, 4) + F(K.EX, 13, 4) + F(K.TR, 13, 4);
      L.push(l);
    }
    L.push(' ', ' ', ' ', sp(32) + 'COEFFICIENTS REGLEMENTAIRES', ' ', '              NOMBRE DE VOIES    A1     A2     BC     BT', ' ');
    for (let i = 0; i < n; i++) {
      let l = String(i + 1).padStart(22) + F(K.a1[i], 11, 3);
      if (i === 0) l += F(K.a2, 7, 3); else l += sp(7);
      if (i < K.bc.length) l += F(K.bc[i], 7, 3); if (i === 0) l += F(K.bt, 7, 3);
      L.push(l);
    }
    L.push(' ', ' ', ' ', sp(32) + 'COMBINAISON LA PLUS DEFAVORABLE', ' ', sp(34) + 'A             BC           BT', ' ', F(K.combA, 39, 4) + F(K.combBC, 14, 4) + F(K.combBT, 13, 4));
    return L;
  }
  function etriers(r) {
    const out = [], lim = r.mat.tauSans;
    for (const [tit, secs, e] of [['E T R I E R S   D E   L A   T R A V E R S E   S U P E R I E U R E', r.secT, r.g.e3, 'T'], ['E T R I E R S   D U   P I E D R O I T', r.secP, r.g.e2, 'P']]) {
      const tr = secs === r.secT, lv = tr ? r.liveT : r.liveP; const d = e - 0.025 - 0.6 * r.v.PHI1 - 1.1 * r.v.PHI2; // hauteur utile (règle des efforts résistants : 43.57/80.01 = 0.5446)
      const rows = secs.map((s, i) => { const vals = [1, -1].map(sg => { const ee = lv[i].V[sg > 0 ? 'max' : 'min'], q = LIVE.map(k => ee[k].eff), G = sg > 0 ? s.V.eluMax : s.V.eluMin;
        return LV.combine({ Gels: G, Gelu: G, A: q[0], BC: q[1], BT: q[2], MC: q[3], ME: q[4], EX: q[5], TR: q[6], RT: tr ? 0 : Math.abs(s.vret), TP: tr ? 0 : Math.abs(s.vtem) }, sg).elu; });
        const V = Math.max(Math.abs(vals[0]), Math.abs(vals[1])); return [s.x, V, V / d]; });
      const mx = Math.max(...rows.map(r => r[2]));
      out.push(sp(30) + tit, ' ', mx < lim ? sp(70) + "PAS D'ETRIERS  (CONTRAINTE DE CISAILLEMENT <" + F(lim, 6, 2) + ' T/M2)' : '', ' ', ' ',
        sp(34) + 'ABSCISSE        EFFORT TRANCHANT     CISAILLEMENT', sp(36) + '(M)                 (T)               (T/M2)', ' ');
      for (const [x, V, t] of rows) out.push(F(x, 40, 2) + F(V, 21, 2) + F(t, 19, 2));
      out.push('\f');
    }
    // semelle : sections encastrement, 3/4, 1/2, 1/4 ; d selon le diamètre des fers solidarisant (int. nappe 4, ext. φ2)
    out.push(sp(30) + 'E T R I E R S     D E   L A    S E M E L L E', ' ');
    for (const [lab, k, sgn, a, phi] of [['* COTE EXTERIEUR', 'E', -1, r.aExt, r.fer.ad.semE.sol.phi], ['* COTE INTERIEUR', 'I', 1, r.aInt, r.fer.ad.semI.sol.phi]]) {
      const d = r.g.e1 - 0.025 - 0.6 * phi - 1.1 * r.v.PHI2;
      const rows = r.semelleEff[k].map(s => { const vals = [1, -1].map(sg => { const e = s.liveV[sg > 0 ? 'max' : 'min'], q = ['A', 'BC', 'BT', 'ME', 'MC', 'EX', 'TR'].map(x => e[x].eff), G = sg > 0 ? s.V.eluMax : s.V.eluMin;
        return LV.combine({ Gels: G, Gelu: G, A: q[0], BC: q[1], BT: q[2], ME: q[3], MC: q[4], EX: q[5], TR: q[6], RT: s.ret[1], TP: s.tem[1] }, sg).elu; });
        const V = Math.max(Math.abs(vals[0]), Math.abs(vals[1])); return [sgn * (r.g.e2 / 2 + (1 - s.t) * a), V, V / d]; });
      const mx = Math.max(...rows.map(x => x[2])), lim = r.mat.tauSans;
      out.push(lab, mx < lim ? sp(60) + "PAS D'ETRIERS    (CONTRAINTE DE CISAILLEMENT <" + F(lim, 6, 2) + ' T/M2)' : '', sp(19) + 'ABSCISSE          EFFORT TRANCHANT        CISAILLEMENT', sp(21) + '(M)                   (T)                  (T/M2)');
      for (const [x, V, t] of rows) out.push(F(x, 25, 2) + F(V, 27, 2) + F(t, 19, 2));
      out.push(' ');
    }
    return out;
  }


  function pressions(r) {
    const L = [sp(49) + 'S E M E L L E', ' ', sp(25) + 'R E P A R T I T I O N   D E   L A   P R E S S I O N   S U R   L E   S O L', ' ', ' '];
    const ord = ['A', 'BC', 'BT', 'ME', 'MC', 'EX', 'TR'];
    for (const [lab, k] of [['      BORD EXTERIEUR', 'ext'], ['       BORD INTERIEUR', 'int']]) {
      const P = r.pressions[k];
      L.push(lab, '                           CHARGE     EFFET   NON   PONDERE   DES   SURCHARGES                              PRESSION TOTALE',
        '                           PERMAN    A     BC     BT     ME     CM     EX     TR   REMBLAI RETRAIT TEMPERA', ' ');
      for (const sg of [1, -1]) {
        const e = P.live[sg > 0 ? 'max' : 'min'], q = ord.map(x => e[x].eff), G = sg > 0 ? P.max : P.min;
        const t = LV.combine({ Gels: G, Gelu: G, A: q[0], BC: q[1], BT: q[2], ME: q[3], MC: q[4], EX: q[5], TR: q[6], RT: P.ret, TP: P.tem }, sg);
        L.push(sp(21) + (sg > 0 ? 'MAX' : 'MIN') + F(G, 9, 2) + q.slice(0, 6).map(x => F(x, 7, 2)).join('') + F(q[6], 7, 2) + F(0, 7, 2) + F(P.ret, 8, 2) + F(P.tem, 7, 2) + F(t.els, 13, 2));
      }
      L.push(' ');
    }
    return L;
  }

  // Moments et efforts tranchants dans la semelle (colonnes A BC BT ME CM EX TR REMBLAI RETRAIT TEMPERA)
  const SORD = ['A', 'BC', 'BT', 'MC', 'ME', 'EX', 'TR']; // en-tête « ME CM » mais colonnes Mc puis Me (comme les autres tableaux)
  const SLAB = [['SECTION 1      ', '(ENCASTREMENT) '], ['SECTION 3/4    ', sp(15)], ['SECTION 1/2    ', sp(15)], ['SECTION 1/4    ', sp(15)]];
  function semelleMoments(r) {
    const L = [sp(46) + 'M O M E N T S       D A N S        L A     S E M E L L E', ' ', ' ', ' '];
    for (const [lab, k] of [[' COTE EXTERIEUR', 'E'], ['  COTE   INTERIEUR', 'I']]) {
      L.push(lab, ' ', sp(22) + 'CHARGE PERMAN    EFFET   NON     PONDERE     DES        SURCHARGES                               MOMENTS TOTAUX PONDERES',
        sp(22) + 'E.L.S. E.L.U.    A     BC       BT     ME          CM       EX     TR     REMBLAI RETRAIT TEMPERA   E.L.S.    E.L.U.', ' ');
      r.semelleEff[k].forEach((s, i) => {
        for (const sg of [1, -1]) {
          const e = s.liveM[sg > 0 ? 'max' : 'min'], q = SORD.map(x => e[x].eff);
          const els = sg > 0 ? s.M.elsMax : s.M.elsMin, elu = sg > 0 ? s.M.eluMax : s.M.eluMin;
          const t = LV.combine({ Gels: els, Gelu: elu, A: q[0], BC: q[1], BT: q[2], MC: q[3], ME: q[4], EX: q[5], TR: q[6], RT: s.ret[0], TP: s.tem[0] }, sg);
          L.push(SLAB[i][sg > 0 ? 0 : 1] + (sg > 0 ? 'MAX' : 'MIN') + F(els, 9, 2) + F(elu, 8, 2) + q.map(x => F(x, 8, 2)).join('') + F(0, 9, 2) + F(s.ret[0], 8, 2) + F(s.tem[0], 8, 2) + F(t.els, 9, 2) + F(t.elu, 9, 2));
        }
        L.push(' ');
      });
      L.push(' ');
    }
    return L;
  }
  function semelleTranchants(r) {
    const L = [sp(32) + 'E F F O R T S    T R A N C H A N T S', sp(35) + 'D A N S   L A    S E M E L L E', ' ', ' ', ' '];
    for (const [lab, k] of [['COTE   EXTERIEUR', 'E'], ['COTE   INTERIEUR', 'I']]) {
      L.push(lab, ' ', sp(29) + 'CHARGE      EFFET    NON   PONDERE       DES     SURCHARGES                                 TOTAUX PONDERES',
        sp(25) + 'PERMA(ELU)     A      BC     BT     ME         CM       EX      TR    REMBLAI RETRAIT TEMPERA     E.L.U.', ' ');
      r.semelleEff[k].forEach((s, i) => {
        for (const sg of [1, -1]) {
          const e = s.liveV[sg > 0 ? 'max' : 'min'], q = ['A', 'BC', 'BT', 'ME', 'MC', 'EX', 'TR'].map(x => e[x].eff); // ici Me puis Mc
          const elu = sg > 0 ? s.V.eluMax : s.V.eluMin;
          const t = LV.combine({ Gels: elu, Gelu: elu, A: q[0], BC: q[1], BT: q[2], ME: q[3], MC: q[4], EX: q[5], TR: q[6], RT: s.ret[1], TP: s.tem[1] }, sg); // q[3]=Me, q[4]=Mc
          L.push(' ' + SLAB[i][sg > 0 ? 0 : 1] + '   ' + (sg > 0 ? 'MAX' : 'MIN') + F(elu, 11, 2) + q.map(x => F(x, 8, 2)).join('') + F(0, 8, 2) + F(s.ret[1], 8, 2) + F(s.tem[1], 8, 2) + F(t.elu, 11, 2));
        }
        L.push(' ');
      });
      L.push(' ');
    }
    return L;
  }

  // ---- Ferraillage (fer.js)
  const F6 = x => F(x, 8, 6);
  function ferMinimal(r) {
    const m = r.fer.min, p2 = k => (k ? 'ACIER PHI2' : 'ACIER PHI1');
    return [sp(31) + 'F E R R A I L L A G E    M I N I M A L     N E C E S S A I R E', ' ', sp(35) + '( S E C T I O N S     D E T E R M I N A N T E S )', ' ', ' ', ' ', ' ',
      'FERRAILLAGE INTERIEUR     (MOMENTS POSITIFS)', ' ', ' ',
      '      TRAVERSE SUPERIEURE               M I L I E U  ' + F6(m.trMid) + ' M2      ' + p2(0), ' ', ' ',
      '       PIEDROIT   SECTION COURANTE DETERMINANTE      ' + F6(m.pdCour) + ' M2      ' + p2(1), ' ', ' ', ' ',
      'FERRAILLAGE EXTERIEUR     (MOMENTS NEGATIFS)', ' ', ' ',
      '       TRAVERSE SUPERIEURE          ANGLE SUPERIEUR  ' + F6(m.trSup) + ' M2      ' + p2(0), ' ', ' ',
      '       PIEDROIT                     ANGLE SUPERIEUR  ' + F6(m.pdSup) + ' M2      ' + p2(0), ' ',
      '                                     B A S E         ' + F6(m.pdBase) + ' M2      ' + p2(0), ' ', ' ', ' ',
      'FERRAILLAGE DE LA SEMELLE', ' ', ' ',
      '       ENCASTREMENT     COTE    EXTERIEUR            ' + F6(m.semE) + ' M2      ' + p2(1), ' ',
      '       ENCASTREMENT     COTE    INTERIEUR            ' + F6(m.semI) + ' M2      ' + p2(1)];
  }
  function ferBloc(tit, o, ep) {
    return [tit, ' ', '      CARACTERISTIQUES GEOMETRIQUES        EPAISSEUR ' + ep + ' =' + F(o.h, 5, 2) + ' M', ' ',
      '      CARACTERISTIQUES DES ACIERS           SECTION =' + F6(o.A) + ' M2            ESPACEMENT =' + F(o.esp, 6, 3) + ' M   DIAMETRE   =' + F(o.phi, 6, 3) + ' M', ' ',
      '     EFFORTS TRANCHANTS RESISTANTS           ACIER =' + F(o.VRs, 6, 2) + ' T                     BETON =' + F(o.VRb, 6, 2) + ' T', ' ',
      '     CONTRAINTES MAXIMALES PONDEREES         ACIER =' + E(o.ss, 7) + ' T/M2                 BETON =' + E(o.sb, 6) + ' T/M2', ' '];
  }
  function ferAdopte(r) {
    const a = r.fer.ad, H1 = [sp(23) + 'F E R R A I L L A G E      R E E L      A D O P T E', ' ', sp(23) + '( S E C T I O N S      D E T E R M I N A N T E S )', ' ', ' ', ' '];
    const L = [...H1, sp(25) + 'F E R R A I L L A G E      I N T E R I E U R', ' ', ' ',
      ...ferBloc(' TRAVERSE SUPERIEURE', a.trInt, 'E3'), ...ferBloc('PIEDROIT   SECTION COURANTE DETERMINANTE', a.pdCour, 'E2'), '\f',
      ...H1, sp(26) + 'F E R R A I L L A G E      E X T E R I E U R', ' ', ' ',
      ...ferBloc('TRAVERSE SUPERIEURE - ANGLE SUPERIEUR', a.trSup, 'E3'), ...ferBloc('PIEDROIT   -   ANGLE SUPERIEUR', a.pdSup, 'E2'), ...ferBloc('PIEDROIT   -   B A S E', a.pdBase, 'E2'), '\f',
      ...H1, sp(35) + 'F E R R A I L L A G E    D E   L A    S E M E L L E', ' ', ' '];
    const nap = (lab, o) => ['     CARACTERISTIQUES DES ACIERS'.slice(0, 0) + sp(41) + lab + F6(o.A) + ' M2   DIAMETRE   =' + F(o.phi, 8, 3) + ' M', sp(105) + 'ESPACEMENT =' + F(o.esp, 8, 3) + ' M', ' '];
    for (const [tit, o, int] of [['* SEMELLE INTERIEURE', a.semI, true], ['* SEMELLE EXTERIEURE', a.semE, false]]) {
      L.push(tit, ' ', '    CARACTERISTIQUES GEOMETRIQUES       EPAISSEUR E1 =' + F(o.h, 5, 2) + ' M      LARGEUR    =' + F(o.larg, 5, 2) + ' M', ' ');
      const sol = nap('SECTION SOLIDARISANT PIEDROIT ET SEMELLE         = ', o.sol), fl = nap((int ? 'SECTION FILANTE SUPPLEMENTAIRE                  = ' : 'SECTION FILANTE DANS LA SEMELLE                 = '), o.fil);
      sol[0] = '     CARACTERISTIQUES DES ACIERS        ' + sol[0].trimStart().padStart(sol[0].length - 41 + 3);
      L.push(...(int ? [...sol, ...fl] : [...fl, ...sol]), sp(41) + 'SECTION TOTALE AU ML                            =' + F6(o.A) + ' M2', ' ',
        '     CONTRAINTES MAXIMALES PONDEREES        ACIER =' + E(o.ss, 7) + ' T/M2                 BETON =' + E(o.sb, 8) + ' T/M2', ' ', ' ');
    }
    return L;
  }
  function ferTransversal(r) {
    const t = r.fer.tr;
    return [sp(43) + 'F E R R A I L L A G E   T R A N S V E R S A L', ' ',
      'CONDITION DE NON FRAGILITE   TRAVERSE ' + F6(t.nfT) + ' M2', '                             PIEDROITS ' + F6(t.nfP) + ' M2', '                             SEMELLES ' + F6(t.nfS) + ' M2', ' ',
      'FERRAILLAGE PLANCHER                   ' + F6(t.plancher) + ' M2', ' ', ' ', ' ',
      'FERRAILLAGE TRANSVERSAL DE LA FACE INTERIEURE DE LA TRAVERSE',
      sp(67) + 'SECTION = MAXIMUM(' + t.Am.toFixed(6) + ',' + t.nfT.toFixed(6) + ',' + t.plancher.toFixed(6) + ')', ' ',
      '                  CARACTERISTIQUES GEOMETRIQUES      EPAISSEUR E3 =' + F(r.g.e3, 5, 2) + ' M', ' ',
      '                  CARACTERISTIQUES DES ACIERS         SECTION =' + F6(t.A) + ' M2   ESPACEMENT DROIT =' + F(t.esp, 6, 3) + ' M   DIAMETRE   =' + F(r.v.PHI2, 6, 3) + ' M', ' ',
      '                 CONTRAINTES MAXIMALES                 ACIER =' + E(t.ss, 7) + ' T/M2              BETON =' + E(t.sb, 6) + ' T/M2'];
  }

  function ferEpure(r) {
    const f = r.fer, ep = f.ep, a = f.ad, F2 = (x, w) => F(x, w, 2);
    const tit = sp(30) + 'E P U R E      D    A R R E T      D E S      B A R R E S';
    const L = [tit, sp(46) + '*             *         *', sp(35) + 'F E R R A I L L A G E        I N T E R I E U R', sp(31) + "LES ABSCISSES SONT COMPTEES A PARTIR DE L'ANGLE", ' ',
      'T R A V E R S E   S U P E R I E U R E', "      SECTION D'ACIER " + a.trInt.A.toFixed(6) + ' M2', '      ACIER PHI =' + F(a.trInt.phi, 6, 3) + ' M',
      sp(42) + 'ABSCISSE ORIGINE         ABSCISSE EXTREMITE     LONGUEUR'];
    const nm = [1, 4, 2, 3];
    ep.trav.forEach(([o, e, l], i) => L.push(sp(25) + 'BARRE ' + (i + 1) + '            A' + nm[i] + 'S =' + F2(o, 8) + '            E' + nm[i] + 'S =' + F2(e, 11) + '     A' + nm[i] + 'SI =' + F2(l, 8)));
    L.push(' ', 'P I E D R O I T', "     SECTION D'ACIER " + a.pdCour.A.toFixed(6) + ' M2', '     ACIER PHI =' + F(a.pdCour.phi, 6, 3) + ' M');
    ep.pied.forEach(([o, e, l], i) => L.push(sp(13) + 'MOITIE ' + (i + 1) + sp(22) + 'A' + (i + 1) + 'P =' + F2(o, 8) + sp(17) + 'E' + (i + 1) + 'P =' + F2(e, 8) + '     A' + (i + 1) + 'PI =' + F2(l, 8)));
    L.push('\f', tit, sp(46) + '*             *            *', sp(34) + 'F E R R A I L L A G E            E X T E R I E U R',
      sp(31) + 'LES ABSCISSES SONT COMPTEES SUR LE PIEDROIT A PARTIR DE LA BASE', ' ', 'A N G L E   S U P E R I E U R',
      '      SECTION ' + a.trSup.A.toFixed(6) + ' M2                  ABSCISSE ORIGINE            ABSCISSE EXTREMITE    LONGUEUR',
      '      ACIER PHI =' + F(a.trSup.phi, 6, 3) + ' M                   SUR LE PIEDROIT              SUR LA TRAVERSE');
    const na = [3, 1, 4, 2];
    ep.ang.forEach(([p, b, l], i) => L.push(sp(24) + 'BARRE ' + (i + 1) + '             P' + na[i] + 'S =' + F2(p, 8) + '               B' + na[i] + 'S =' + F2(b, 8) + '        B' + na[i] + 'SE =' + F2(l, 7)));
    L.push(' ', 'BASE DU PIEDROIT ET SEMELLE', '    SEMELLE INTERIEURE                     ABSCISSE ORIGINE           ABSCISSE EXTREMITE        LONGUEUR',
      '       SECTION = ' + a.pdBase.A.toFixed(6) + ' M2                SUR LE PIEDROIT             DANS LA SEMELLE', '       ACIER PHI =' + F(a.pdBase.phi, 6, 3) + ' M');
    ep.semI.forEach(([p, e, l], i) => L.push((i ? '                SEMELLE ET PIEDROIT   MOITIE2' : '                FERS SOLIDARISANT     MOITIE1') + ' P5S' + (i + 1) + ' =' + F2(p, 13) + '            E5SI =' + F2(e, 7) + '       L5SI' + (i + 1) + ' =' + F2(l, 11)));
    const s = ep.semE;
    L.push('    SEMELLE EXTERIEURE', '       SECTION = ' + a.semE.sol.A.toFixed(6) + ' M2', '       ACIER PHI =' + F(a.semE.sol.phi, 6, 3) + ' M', '                FERS SOLIDARISANT',
      '                SEMELLE ET PIEDROIT               A5S =' + F2(s[0], 7) + '              E5SE =' + F2(s[1], 6) + '        L5SE =' + F2(s[2], 10));
    return L;
  }

  function ferNomenclature(r) {
    const n = r.fer.nom, f2 = x => x.toFixed(2);
    const lg = n.tb > 0 ? '10 M +' + F(n.tb, 7, 2) + ' M ( TETE-BECHE )' : F(n.Wb, 6, 2) + ' M';
    return [sp(31) + 'N O M E N C L A T U R E      D E S       A C I E R S       A U X I L I A I R E S', sp(46) + '(   D I A M E T R E        P H I   2    )', sp(68) + '*', ' ',
      '- T R A V E R S E          S U P E R I E U R E', '          ACIERS LONGITUDINAUX',
      '                   PROLONGEMENT DES ACIERS DU FERRAILLAGE EXTERIEUR              ESPACEMENT ' + f2(n.espT) + ' M - LONGUEUR ' + F(n.lExt, 11, 2) + ' M',
      '                   PROLONGEMENT DES ACIERS DU FERRAILLAGE INTERIEUR              ESPACEMENT ' + f2(n.espT) + ' M - LONGUEURS ' + f2(n.lInt[0]) + ' M ET ' + F(n.lInt[1], 11, 2) + ' M',
      '          ACIERS TRANSVERSAUX',
      '                   FACE EXTERIEURE                                               ESPACEMENT ' + f2(n.espTE) + ' M - LONGUEUR        ' + lg, ' ',
      '- G   O    U   S   S   E   T    S', '          ACIERS LONGITUDINAUX          ESPACEMENT ' + f2(n.espP) + ' M - LONGUEUR       1.80 M',
      '          ACIERS TRANSVERSAUX            8 FERS   FILANTS   - LONGUEUR     ' + lg, ' ',
      '- P   I    E   D   R   O   I    T   S', '                                                      ( ESPACEMENT 0.20 M SUR 2 M          A PARTIR DE LA BASE',
      '          ACIERS TRANSVERSAUX            (', '                   SUR CHACUNE DES 2 FACES            ( ESPACEMENT ' + f2(n.espPd) + ' M SUR LE RESTE DE LA HAUTEUR',
      '                                                      (', '                                                      ( LONGUEUR ' + lg, ' ',
      '- S   E    M   E   L   L   E    S',
      '          ACIERS LONGITUDINAUXFACE SUPERIEURE                 ESPACEMENT ' + f2(n.espP) + ' M - LONGUEUR ' + F(r.g.B, 12, 2) + ' M',
      '          ACIERS TRANSVERSAUX FACE SUPERIEURE                 ESPACEMENT ' + f2(n.espSs) + ' M - LONGUEUR ' + lg,
      '                                          FACE INFERIEURE     ESPACEMENT 0.20 M - LONGUEUR ' + lg];
  }

  function avantMetre(r) {
    const m = r.fer.metre;
    return [sp(24) + 'AVANT       METRE       RECAPITULATIF', ' ', 'B E T O N S', '        BETON POUR BA             ' + String(Math.round(m.beton)).padStart(7) + ' M3',
      '        COFFRAGES                 ' + String(Math.round(m.coffrage)).padStart(7) + ' M2', ' ', 'A C I E R S',
      '       ACIER PHI1               =' + F(m.ton[0], 9, 2) + ' T', '       ACIER PHI2               =' + F(m.ton[1], 9, 2) + ' T', '       ACIER PHI3               =' + F(m.ton[2], 9, 2) + ' T',
      '                    TOTAL       =' + F(m.total, 9, 2) + ' T', "       POIDS D'ACIER", '           PAR M3 DE BETON =' + F(m.total / m.beton, 15, 3) + ' T/M3'];
  }

  function liMu(r) {
    const L = [sp(50) + "LIGNES D'INFLUENCE DU COEFFICIENT MU", sp(24) + 'AU POINT DE COORDONNEES (0.,0.) COMPTEES A PARTIR DU CENTRE DE LA DALLE',
      'HARMONIQUE       -B          -0,75 B      0,5 B        -0,25 B       0        0,25 B      0,5 B     0,75 B       B'];
    for (const rw of r.mu.rows) L.push(String(rw.m).padStart(5) + rw.v.map((x, i) => F(x, i ? 13 : 16, 5)).join(''));
    return L;
  }

  function renderNote(m, r, opt) {
    opt = opt || {};
    const out = [];
    out.push(P.formatBordereau(m), ' ', ' ', ' ', ' ', ' ');
    out.push(...controle(m, r), '\f');
    const gen = generalites(m, r); const ic = gen.findIndex(l => /COEFFICIENTS DE PRISE/.test(l)) - 2;
    gen.splice(ic, 0, ...chargesTexte(r));
    out.push(...gen, '\f');
    out.push(...lignesInfluence(r), '\f');
    out.push(...momentsPermanents(r), '\f');
    out.push(...majDyn(r), '\f', ...coefK(r), '\f');
    out.push(...sectionsDet(r), '\f', ...tablesSurcharges(r, 'T'), ...diag(r, 'T'), '\f', ...tablesSurcharges(r, 'P'), ...diag(r, 'P'), '\f', ...liMu(r), '\f', ...deplacements(r), '\f', ...tranchants(r, 'T'), '\f', ...tranchants(r, 'P'), '\f');
    out.push(...semelleLI(r), '\f', ...semelleMoments(r), '\f', ...semelleTranchants(r), '\f', ...pressions(r), '\f', ...ferMinimal(r), '\f', ...ferAdopte(r), '\f', ...ferTransversal(r), '\f', ...ferEpure(r), '\f', ...ferNomenclature(r), '\f', ...etriers(r), '\f', ...avantMetre(r));
    return out.join('\n');
  }

  const api = { renderNote };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PIPO_NOTE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
