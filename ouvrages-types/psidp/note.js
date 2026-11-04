// PSIDP-EL — rédaction de la note de calcul au format du listing SETRA PSIDP91 (V98244).
(function (root) {
  'use strict';
  var P = (typeof module !== 'undefined' && module.exports && typeof require === 'function') ? require('./parse.js') : root.PSIDP_PARSE;

  // --------------------------------------------------------------- outils de mise en page
  function fx(v, d) {
    if (v === null || v === undefined || isNaN(v)) return '';
    var s = Number(v).toFixed(d);
    if (/^-0\.?0*$/.test(s)) s = s.slice(1);
    return d === 0 ? s + '.' : s;
  }
  function Line(s) { this.s = s || ''; }
  Line.prototype.at = function (end, str) {
    str = String(str);
    var st = end - str.length;
    if (st < this.s.length + (this.s.length ? 1 : 0)) st = this.s.length + (this.s.length ? 1 : 0);
    while (this.s.length < st) this.s += ' ';
    this.s += str;
    return this;
  };
  Line.prototype.toString = function () { return this.s; };
  function L(s) { return new Line(s); }
  function row(items) { var l = L(); items.forEach(function (it) { if (it) l.at(it[0], it[1]); }); return l.s; }
  function pad(n, s) { return new Array(n + 1).join(' ') + s; }
  function cap(t) { return t; }

  function Doc(model, opts) {
    this.lines = []; this.page = 0;
    var p = (model.passage || '').replace(/-/g, '.');
    this.stamp = p; this.num = (opts && opts.numero) || model.numeroRaw2 || '';
  }
  Doc.prototype.push = function (s) { this.lines.push(s === undefined ? '' : String(s)); };
  Doc.prototype.newPage = function () {
    this.page++;
    var pg = String(this.page);
    this.push(row([[25, 'LE ' + this.stamp], [118 - 2, 'PSIDP ' + this.num], [131, 'PAGE ' + (pg.length < 3 ? pad(3 - pg.length, pg) : pg)]]));
    this.push(new Array(133).join('-'));
  };
  Doc.prototype.boxTitle = function (t, col) {
    var w = t.length + 6, st = col || Math.floor((132 - w) / 2);
    var star = new Array(w + 1).join('*');
    this.push(pad(st, star)); this.push(pad(st, '*' + pad(w - 2, '') + '*'));
    this.push(pad(st, '*  ' + t + '  *')); this.push(pad(st, '*' + pad(w - 2, '') + '*')); this.push(pad(st, star));
  };

  // --------------------------------------------------------------- sections
  function spansToPrint(R, v) { var n = R.n; return (v.SYM === 1) ? Math.ceil(n / 2) : n; }

  function secGeometrie(D, m, R) {
    var v = m.values, n = R.n, i;
    D.newPage();
    D.boxTitle("CARACTERISTIQUES GEOMETRIQUES DE L'OUVRAGE", 42);
    D.lines[D.lines.length - 1] += '              UNITES: METRE';
    D.push(pad(112, 'TONNE')); D.push(pad(112, 'GRADE'));
    D.push('        PROFIL EN LONG');
    D.push('                 NOMBRE DE TRAVEES   ' + n);
    var h = L(); for (i = 0; i < n; i++) h.at(39 + 15 * i, 'TRAVEE  ' + (i + 1)); D.push(h.s);
    var r = L('                 PORTEES'); for (i = 0; i < n; i++) r.at(39 + 15 * i, fx(R.L[i], 3)); D.push(r.s);
    D.push("                 LONGUEUR  BIAISE  D'ABOUT  DU  TABLIER :   " + fx(v.ABOUT, 4));
    D.push('        PROFIL EN TRAVERS');
    D.push('                 SYMETRIE TRANSVERSALE    ' + (v.SYM === 1 ? 'OUI' : 'NON'));
    D.push('                    TROTTOIR GAUCHE    BANDE DERASEE GAUCHE    CHAUSSEE    BANDE DERASEE DROITE        TROTTOIR DROIT');
    D.push(row([[30, fx(v.ETROG, 3)], [51, fx(v.EGAU, 3)], [70, fx(v.ESURCH, 3)], [89, fx(v.EDROI, 3)], [111, fx(v.ETROD, 3)]]));
    D.push('                 EPAISSEUR MOYENNE DU REVETEMENT(HCHAU) =  ' + fx(v.HCHAU, 3));
    D.push('                 CARACTERISTIQUES  TRANSVERSALES  DE  LA  DALLE  PORTEUSE');
    D.push('                 EN HAUTEUR                   H DALLE 1      H DALLE 2      H DALLE 3');
    D.push(row([[53, fx(v.HDAL1, 3)], [68, fx(v.HDAL2, 3)], [83, fx(v.HDAL3, 3)]]));
    D.push(pad(101, 'DISSYMETRIE TRANSVERSALE'));
    D.push(pad(99, "DE L'EXTRADOS       DE L'INTRADOS"));
    D.push(row([[106, fx(v.DISEXT, 3)], [131, fx(v.DISINT, 3)]]));
    D.push('                 EN LARGEUR                   E DALLE 1      E DALLE 2      E DALLE 3');
    D.push(row([[53, fx(v.EDAL1, 3)], [68, fx(v.EDAL2, 3)], [83, fx(v.EDAL3, 3)]]));
    D.push('        PROFIL EN PLAN                                                                          LARGEUR DE LA DALLE EQUIVALENTE');
    D.push(row([[22, 'BIAIS'], [34, 'GEOMETRIQUE'], [45, fx(v.BIAIS, 3)], [117, fx(R.Be, 3)]]));
    D.push('                 BIAIS MECANIQUES APPROCHES :');
    D.push(h.s);
    r = L(); for (i = 0; i < n; i++) r.at(39 + 15 * i, fx(R.biaisMeca[i], 3)); D.push(r.s);
  }

  function secMateriaux(D, m, R, short) {
    var v = m.values;
    if (!short) { D.newPage(); D.boxTitle('MATERIAUX', 59); }
    D.push('     CARACTERISTIQUES PRINCIPALES DU BETON');
    D.push(row([[20, 'MODULE'], [74, 'DE DEFORMATION INSTANTANEE A LA MISE EN PRECONTRAINTE'], [88, 'EI'], [92, '='], [102, fx(R.EI, 0)]]));
    D.push(row([[20, 'MODULE'], [64, 'DE DEFORMATION DIFFEREE PAR FLUAGE'], [88, 'EF'], [92, '='], [102, fx(R.EF, 0)]]));
    D.push(row([[20, 'MODULE'], [64, 'DE DEFORMATION INSTANTANEE EN SERVICE'], [90, 'EI28'], [92, '='], [102, fx(R.EI28, 0)]]));
    D.push(row([[20, 'MODULE'], [64, 'DE DEFORMATION DIFFEREE TOTALE'], [90, 'EV28'], [92, '='], [102, fx(R.EV28, 0)]]));
    D.push('              DEFORMATION RELATIVE DUE AU RETRAIT  ' + fx(R.retrait, 7));
    D.push('              COEFFICIENT DE POISSON               ' + fx(v.POIS, 3));
    D.push('              CONTRAINTES DE COMPRESSION DE RUPTURE : A LA MISE EN TENSION ' + fx(v.FCJ, 0) + ' T/M2');
    D.push('                                                      A 28 JOURS           ' + fx(v.FC28, 0) + ' T/M2');
    if (short === 'beton') return;
    D.push('     CARACTERISTIQUES PRINCIPALES DES ACIERS DE PRECONTRAINTE                                                     COUVERTURE');
    D.push("                                                      SECTION D'UNE   DIAMETRE D'UNE   SECTION D'UNE   RAYON      DE LA GAINE");
    D.push("              PROCEDE           UNITE        NOMBRE     ARMATURE          GAINE            GAINE      MINIMAL   F.SUP.   F.INF.");
    D.push(row([[13 + String(v.PROCEDE).length, v.PROCEDE], [38, v.UNITE], [49, String(R.ncab || v.NCA || 0)], [65, fx(v.SECT, 0) + 'MM2'], [80, fx(v.DGAIN, 3) + 'M'], [98, fx(R.Sgaine, 6) + 'M2'], [109, fx(v.RMIN, 3) + 'M'], [118, fx(v.COUVS, 3) + 'M'], [127, fx(v.COUVI, 3) + 'M']]));
    D.push(pad(101, 'COEF      RECUL'));
    D.push("                 RG           TG             EP               T0          REL.1000H         PHI      FROT    D'ANCRAGE   DECAL");
    D.push(row([[25, fx(v.FPRG, 0) + 'T/M2'], [38, fx(v.FPEG, 0) + 'T/M2'], [53, fx(v.EP, 0) + 'T/M2'], [69, fx(v.SIGMAP0, 0) + 'T/M2'], [82, fx(v.RO / 100, 4)], [96, fx(v.PHI, 4)], [105, fx(v.F, 2)], [116, fx(v.RECUL, 3) + 'M'], [127, fx(v.DECAL, 3) + 'M']]));
    D.push(pad(75, 'MU0=' + fx(v.MU0, 2)));
    D.push("              MODE D'ANCRAGE : " + (v.MOD === 0 ? 'ACTIF AUX DEUX EXTREMITES' : 'ACTIF A UNE EXTREMITE'));
    D.push('     CARACTERISTIQUES DES ACIERS DE BETON ARME');
    D.push('                                                FERRAILLAGE LONGITUDINAL ET TRANSVERSAL              ETRIERS');
    D.push(row([[18, 'LIMITE'], [31, "D'ELASTICITE"], [69, fx(v.FE1, 0) + 'T/M2'], [110, fx(v.FE2, 0) + 'T/M2']]));
    if (!short) D.push('            COEFFICIENT DE FISSURATION : ' + fx(v.ETA, 3));
  }

  function secAppuis(D, m, R) {
    var v = m.values, n = R.n, i;
    D.newPage(); D.boxTitle('APPUIS - DIVERS', 55);
    D.push("     TASSEMENTS D'APPUI");
    var h = L(); for (i = 0; i <= n; i++) h.at(50 + 12 * i, 'APPUI  ' + (i + 1)); D.push(h.s);
    var a = L('                 TASSEMENTS ALEATOIRES'), p = L('                 TASSEMENTS PROBABLES');
    for (i = 0; i <= n; i++) { a.at(48 + 12 * i, fx(v['DTP' + (i + 1)] || 0, 3)); p.at(48 + 12 * i, fx(v['TP' + (i + 1)] || 0, 3)); }
    D.push(a.s); D.push(p.s);
    D.push('                 FRACTION DE TASSEMENTS PRIS EN COMPTE EN E.L.S.:XKTP = ' + fx(v.KTP, 3));
    D.push("     CARACTERISTIQUES DES APPAREILS D'APPUI");
    D.push(h.s);
    var t = L('               * TYPE'), nb = L('                 NOMBRE');
    for (i = 0; i <= n; i++) { t.at(44 + 12 * i, String(apType(v, i, n))); nb.at(44 + 12 * i, String(apNb(v, i, n))); }
    D.push(t.s); D.push(nb.s);
    D.push('               * 0 SYMBOLISE UNE ARTICULATION DE FREYSSINET');
    D.push('                 1 SYMBOLISE UN APPAREIL D\'APPUI EN ELASTOMERE FRETTE');
    D.push("                 2 SYMBOLISE TOUT AUTRE TYPE D'APPUI A DIMENSIONNER PAR L'UTILISATEUR");
    D.push('     DIVERS');
    D.push('                 PROFIL VERTICAL DU CABLE     NOMBRE DE DIVISIONS PAR TRAVEE');
    var d = L(); for (i = 0; i < n; i++) { d.at(36 + 12 * i, 'ND' + (i + 1) + '='); d.at(39 + 12 * i, String(R.ND[i])); } D.push(d.s);
  }
  // appareils d'appui : symétrie (SYMAP) -> appuis donnés jusqu'au milieu
  function apIdx(v, i, n) { var k = i + 1; if (v.SYMAP === 1 && v['TYPAP' + k] === undefined) k = n + 1 - i; return k; }
  function apType(v, i, n) { var k = apIdx(v, i, n); return v['TYPAP' + k] !== undefined ? v['TYPAP' + k] : 1; }
  function apNb(v, i, n) { var k = apIdx(v, i, n); return v['NAP' + k] !== undefined ? v['NAP' + k] : 2; }

  function limitesBlock(D, m, R) {
    var v = m.values, lim = R.limites;
    D.push("     CONTRAINTES LIMITES EN T/M2. RELEVANT DU GENRE " + Math.floor(v.GEN / 100) + ' (PSI1= ' + fx(v.PSI1, 3) + ') :');
    D.push('                                                          EN PHASE INITIALE    SOUS QL   SOUS QL+QC  SOUS QL+QC+TA  SOUS QL+PSI1.QR');
    D.push(row([[16, 'DE'], [37, 'COMPRESSION DU BETON'], [69, fx(lim.compInit, 0)], [84, fx(lim.comp, 0)], [99, fx(lim.comp, 0)], [112, fx(lim.comp, 0)], [127, fx(lim.comp, 0)]]));
    D.push(row([[16, 'DE'], [56, "TRACTION DU BETON EN SECTION D'ENROBAGE"], [69, fx(lim.trEnrInit, 0)], [84, '0.'], [99, fx(lim.trEnrQC, 0)], [112, fx(lim.trEnrQC, 0)], [127, '0.']]));
    D.push(row([[16, 'DE'], [58, "TRACTION DU BETON HORS SECTION D'ENROBAGE"], [69, fx(lim.trHorsInit, 0)], [84, fx(lim.trHors, 0)], [99, fx(lim.trHorsQC, 0)], [112, fx(lim.trHorsQC, 0)], [127, fx(lim.trHors, 0)]]));
    D.push('              DE TRACTION DES ARMATURES PASSIVES    ' + fx(lim.aciers, 0));
  }

  function secBaseBP(D, m, R) {
    var v = m.values;
    D.newPage(); D.boxTitle('BASE DE CALCUL DE BETON PRECONTRAINT', 46);
    D.push('     CONTRAINTES CARACTERISTIQUES DES ACIERS DE PRECONTRAINTE');
    D.push('                   VALEUR CARACTERISTIQUE MAXIMALE                           VALEUR CARACTERISTIQUE MINIMALE');
    D.push('                   P1 = ' + fx(v.OSSAX === undefined ? 1.02 : 1.02, 3) + ' * P0 - 0.800 * DELTAP                          P2 = 0.980 * P0 - 1.200 * DELTAP');
    D.push('                                         P0     = VALEUR PROBABLE DE LA TENSION A L\'ANCRAGE');
    D.push('                                         DELTAP = PERTE TOTALE DE TENSION');
    D.push('     COEFFICIENT DE CALCUL DES PERTES PAR FLUAGE : KFL =  ' + fx(v.KFL, 2));
    D.push("      FRACTION DE PERTES DE TENSION DIFFEREES A LA MISE EN SERVICE DE L'OUVRAGE  :   R(J) = " + fx(v.RT, 3));
    D.push('     COEFFICIENT PSI1 =  ' + fx(v.PSI1, 3) + ' POUR COMBINAISON FREQUENTE  (QL+PSI1.QR)');
    limitesBlock(D, m, R);
    D.push("              COEFFICIENTS D'EQUIVALENCE ACIER-BETON : NI = 5.0");
    D.push('                                                       NV =15.0');
    D.push('     LES COEFFICIENTS GAMMA DE L\'ETUDE AUX ETATS-LIMITES SONT DEFINIS PAR LES DIRECTIVES COMMUNES DE 1979:');
    D.push('              POUR LA PRISE EN COMPTE DES CHARGES D\'EXPLOITATION (GAMMA QC ) :');
    D.push('                                                  TROTTOIRS          CHARGE A           CHARGES B      CHARGES PARTICULIERES');
    D.push("                   ETATS LIMITES D'UTILISATION      1.000              1.200              1.200              1.000");
    D.push('                   ETATS LIMITES ULTIMES            1.420              1.420              1.420              1.200');
    D.push('              AUTRES COEFFICIENTS :          GAMMA F3      GAMMA QL1     GAMMA QL2      GAMMA B      GAMMA MA      GAMMA MP');
    D.push('                                               1.125         1.200         0.900         1.500         1.150         1.150');
    D.push('                                             TETA LONGUE DUREE =1.000      TETA COURTE DUREE =0.850');
    D.push('     CARACTERISTIQUES MECANIQUES DE LA SECTION BRUTE');
    D.push('                                                    CENTRE  DE  GRAVITE');
    D.push('                                    AIRE              V           V1           INERTIE           RENDEMENT');
    D.push(row([[39, fx(R.section.S, 4)], [42, 'M2'], [55, fx(R.section.V, 4)], [57, 'M'], [67, fx(R.section.VP, 4)], [69, 'M'], [84, fx(R.section.I, 6)], [87, 'M4'], [104, fx(R.section.rendement, 4)]]));
  }

  function secCharges(D, m, R) {
    var v = m.values;
    D.newPage(); D.boxTitle('CHARGES (ACTIONS)', 54);
    D.push('     CHARGES PERMANENTES (EN T/ML)');
    D.push('                                                               OSSATURE                SUPERSTRUCTURES                TOTAL');
    var lab = ['VALEURS MOYENNES', 'VALEURS CARACTERISTIQUES MAXIMALES', 'VALEURS CARACTERISTIQUES MINIMALES'];
    for (var k = 0; k < 3; k++) D.push(row([[18 + lab[k].length, lab[k]], [70, fx(R.cp.oss[k], 3)], [97, fx(R.cp.sup[k], 3)], [124, fx(R.cp.tot[k], 3)]]));
    D.push('                  >>> POUR MEMOIRE : MASSE VOLUMIQUE DU BETON = ' + fx(v.MASVO, 3) + ' T/M3');
    D.push("     CHARGES D'EXPLOITATION A CARACTERE NORMAL  -  NOMBRE DE VOIES CHARGEABLES =  " + R.nv);
    D.push("                  * RELEVANT DU TITRE II DU FASC. 61 (1971)  L'OUVRAGE EST DE CLASSE " + R.classe + '(PSI1= ' + fx(v.PSI1, 3) + ')');
    if (v.TROT > 0) D.push('                            CHARGE GENERALE DE TROTTOIRS     ' + fx(v.TROT, 3) + 'T/M2');
    D.push('                            CHARGE A(L)  -  LARGEUR NOMINALE D\'UNE VOIE = ' + fx(R.v0, 3) + ' M');
    D.push('                            CHARGES BC  , BT');
    D.push("     CHARGES D'EXPLOITATION A CARACTERE PARTICULIER");
    D.push('                  * RELEVANT DU TITRE II DU FASC. 61 (1971)');
    if (R.loads.MC120) D.push('                            CONVOI MILITAIRE TYPE MC 120');
    if (R.loads.CE) D.push('                            CONVOIS EXCEPTIONNELS TYPES D ET E');
  }

  function cubLines(D, cols, labels, label, ends, withD) {
    var keys = withD ? ['A', 'B', 'C'] : ['A', 'B', 'C'];
    keys.forEach(function (k, ki) {
      var l = L();
      if (ki === 1 && label) label.forEach(function (it) { l.at(it[0], it[1]); });
      l.at(ends.letter, k);
      cols.forEach(function (c, j) { l.at(ends.first + ends.step * j, fx(c[k] + (k === 'C' && withD ? 0 : 0), 6)); });
      D.push(l.s);
    });
  }

  function secLI(D, m, R) {
    var n = R.n, i, j, t;
    D.newPage();
    D.push("                         EQUATIONS DES LIGNES D'INFLUENCE DES MOMENTS FLECHISSANTS SUR APPUIS");
    D.push('                                      CUBIQUE DE LA FORME  A*X**3 + B*X**2 + C*X');
    D.push("                               X ETANT L'ABSCISSE RELATIVE DE LA FORCE DANS LA TRAVEE");
    var h = L('             FORCE DANS LA'); for (j = 0; j < n; j++) h.at(41 + 17 * j, 'TRAVEE ' + (j + 1)); D.push(h.s);
    D.push('SECTION SUR');
    for (i = 0; i < n - 1; i++) cubLines(D, R.liAppuis[i], null, [[11, 'APPUI'], [13, String(i + 2)]], { letter: 27, first: 41, step: 17 });
    D.push("                           AIRES DES LIGNES D'INFLUENCE DES MOMENTS FLECHISSANTS SUR APPUIS");
    h = L('             AIRE TOTALE'); for (j = 0; j < n; j++) h.at(41 + 17 * j, 'TRAVEE ' + (j + 1)); D.push(h.s);
    D.push('SECTION SUR');
    for (i = 0; i < n - 1; i++) {
      var l = row([[11, 'APPUI'], [13, String(i + 2)], [24, fx(R.liAppuisAires[i].total, 3)]]);
      var ll = L(l); R.liAppuisAires[i].parTravee.forEach(function (a, j2) { ll.at(41 + 17 * j2, fx(a, 3)); }); D.push(ll.s);
    }
    D.push("                             ABSCISSES DES FOYERS PAR RAPPORT A L'APPUI DE GAUCHE DE LA TRAVEE");
    h = L(); for (j = 0; j < n; j++) h.at(41 + 17 * j, 'TRAVEE ' + (j + 1)); D.push(h.s);
    var fg = L('      FOYER DE GAUCHE'), fd = L('      FOYER DE DROITE');
    for (j = 0; j < n; j++) { if (R.foyers.gauche[j] !== null) fg.at(39 + 17 * j, fx(R.foyers.gauche[j], 3)); if (R.foyers.droite[j] !== null) fd.at(39 + 17 * j, fx(R.foyers.droite[j], 3)); }
    D.push(fg.s); D.push(fd.s);

    for (t = 0; t < n; t++) {
      D.newPage();
      D.push("                             EQUATIONS DES LIGNES D'INFLUENCE DES MOMENTS FLECHISSANTS EN TRAVEE " + (t + 1));
      D.push('                                         CUBIQUE DE LA FORME  A*X**3 + B*X**2 + C*X + D');
      D.push("                                    X ETANT L'ABSCISSE RELATIVE DE LA FORCE DANS LA TRAVEE");
      D.push('                    DANS LA COLONNE TRAVEE ' + (t + 1) + 'D, LA FORCE ET LA SECTION SONT DANS LA MEME TRAVEE ET');
      D.push("                                               L'ABSCISSE DE LA FORCE EST SUPERIEURE A CELLE DE LA SECTION,");
      D.push("                                               D EST ALORS EGAL A L'ABSCISSE DE LA SECTION.");
      D.push('                    DANS TOUS LES AUTRES CAS D EST NUL');
      D.push('           ABSCISSE');
      h = L('  SECTION   CUMULEE');
      var c = 0; for (j = 0; j < n; j++) { if (j === t) { h.at(35 + 14 * c, 'TRAVEE ' + (j + 1) + 'G'); c++; h.at(35 + 14 * c, 'TRAVEE ' + (j + 1) + 'D'); c++; } else { h.at(35 + 14 * c, 'TRAVEE ' + (j + 1)); c++; } }
      D.push(h.s);
      var X0 = 0;
      R.liTravees[t].forEach(function (s) {
        cubLines(D, s.cols, null, [[10, fx(s.x0, 2) + 'L'], [17, fx(X0 + s.abs, 3)]], { letter: 21, first: 35, step: 14 }, true);
      });
      D.newPage();
      var z = R.zeros[t];
      D.push("                              ZEROS DES LIGNES D'INFLUENCE ET AIRES PARTIELLES EN TRAVEE " + (t + 1));
      D.push('  SECTION  ABSCISSE   ABSCISSE   AIRE A   AIRE A   AIRE TOTALE');
      D.push('            CUMULEE    DU ZERO   GAUCHE   DROITE   EN TRAVEE ' + (t + 1));
      z.forEach(function (q) { D.push(row([[10, fx(q.x0, 2) + 'L'], [17, fx(X0 + q.abs, 3)], [28, fx(q.zero, 3)], [39, fx(q.ag, 3)], [48, fx(q.ad, 3)], [59, fx(q.tot, 3)]])); });
      D.push("                            AIRES DES LIGNES D'INFLUENCE DES MOMENTS FLECHISSANTS EN TRAVEE " + (t + 1));
      D.push('           ABSCISSE');
      h = L('  SECTION   CUMULEE     AIRE TOTALE'); for (j = 0; j < n; j++) h.at(48 + 14 * j, 'TRAVEE ' + (j + 1)); D.push(h.s);
      R.liTraveesAires[t].forEach(function (s) {
        var l2 = L(row([[10, fx(s.x0, 2) + 'L'], [17, fx(X0 + s.abs, 3)], [32, fx(s.total, 3)]]));
        s.parTravee.forEach(function (a, j2) { l2.at(48 + 14 * j2, fx(a, 3)); }); D.push(l2.s);
      });
    }
    // efforts tranchants
    D.newPage();
    D.push("                               EQUATIONS DES LIGNES D'INFLUENCE DES EFFORTS TRANCHANTS");
    D.push('                                    CUBIQUE DE LA FORME  A*X**3 + B*X**2 + C*X + D');
    D.push("                               X ETANT L'ABSCISSE RELATIVE DE LA FORCE DANS LA TRAVEE");
    D.push('                   D=1 QUAND LA FORCE EST DANS LA MEME TRAVEE QUE LA SECTION ET A DROITE DE CELLE-CI');
    D.push('                   D=0 DANS TOUS LES AUTRES CAS');
    h = L('             FORCE DANS LA'); for (j = 0; j < n; j++) h.at(41 + 17 * j, 'TRAVEE ' + (j + 1)); D.push(h.s);
    D.push('SECTION DANS LA');
    for (t = 0; t < n; t++) cubLines(D, R.liEffTr[t], null, [[12, 'TRAVEE'], [14, String(t + 1)]], { letter: 27, first: 41, step: 17 });
    D.push("                              AIRES DES LIGNES D'INFLUENCE DES EFFORTS TRANCHANTS SUR APPUIS");
    h = L('                      AIRE TOTALE'); for (j = 0; j < n; j++) h.at(42 + 17 * j, 'TRAVEE ' + (j + 1)); D.push(h.s);
    for (t = 0; t < n; t++) {
      ['gauche', 'droite'].forEach(function (cote, ci) {
        var a = R.liEffTrAires[t][cote];
        var l3 = L(ci === 0 ? 'TRAVEE ' + (t + 1) + ' COTE GAUCHE' : '         COTE DROIT');
        l3.at(32, fx(a.total, 3)); a.parTravee.forEach(function (x, j2) { l3.at(42 + 17 * j2, fx(x, 3)); }); D.push(l3.s);
      });
    }
    // réactions
    D.newPage();
    D.push("                                EQUATIONS DES LIGNES D'INFLUENCE DES REACTIONS D'APPUIS");
    D.push('                                    CUBIQUE DE LA FORME  A*X**3 + B*X**2 + C*X + D');
    D.push("                               X ETANT L'ABSCISSE RELATIVE DE LA FORCE DANS LA TRAVEE");
    D.push("                        D=1 QUAND LA FORCE EST DANS LA TRAVEE DE MEME NUMERO QUE L'APPUI ETUDIE");
    D.push('                        D=0 DANS LES AUTRES CAS');
    h = L('             FORCE DANS LA'); for (j = 0; j < n; j++) h.at(41 + 17 * j, 'TRAVEE ' + (j + 1)); D.push(h.s);
    for (i = 0; i <= n; i++) cubLines(D, R.liReac[i], null, [[11, 'APPUI'], [13, String(i + 1)]], { letter: 27, first: 41, step: 17 });
    D.push("                                  AIRES DES LIGNES D'INFLUENCE DES REACTIONS D'APPUIS");
    h = L('           AIRE TOTALE          ABOUT'); for (j = 0; j < n; j++) h.at(52 + 15 * j, 'TRAVEE ' + (j + 1)); D.push(h.s);
    for (i = 0; i <= n; i++) {
      var a = R.liReacAires[i], l4 = L('APPUI ' + (i + 1));
      l4.at(22, fx(a.total, 3)); if (a.about !== null) l4.at(37, fx(a.about, 3));
      a.parTravee.forEach(function (x, j2) { l4.at(52 + 15 * j2, fx(x, 3)); }); D.push(l4.s);
    }
  }

  function secDyn(D, m, R) {
    var n = R.n, i, ld = R.loads;
    D.newPage();
    D.push('                                                 DENSITE DE CHARGE PERMANENTE');
    D.push('                                                        POIDS AU METRE');
    D.push(row([[51, 'OSSATURE'], [76, fx(R.cp.oss[0], 3)]]));
    D.push(row([[57, 'SUPERSTRUCTURE'], [76, fx(R.cp.sup[0], 3)]]));
    D.push(row([[48, 'TOTAL'], [76, fx(R.cp.tot[0], 3)]]));
    D.push('                                               COEFFICIENTS DE MAJORATION DYNAMIQUE');
    var h = '             PORTEE    CP';
    if (ld.B) h += '            BC              BT';
    if (ld.CE) h += '            CVOI.D          CVOI.E';
    if (ld.MC120) h += '          MC.120';
    D.push(h);
    for (i = 0; i < n; i++) {
      var d = R.dyn.travee[i], l = L('   TRAVEE ' + (i + 1)); l.at(20, fx(R.L[i], 3)); l.at(27, fx(d.G, 0));
      var c = 38;
      if (ld.B) { l.at(c, fx(d.Sbc, 0)); l.at(c + 8, fx(d.bc, 3)); l.at(c + 16, '****'); l.at(c + 24, fx(d.bc, 3)); c += 32; }
      if (ld.CE) { l.at(c + 16, '****'); l.at(c + 8, ''); l.at(c + 8, fx(1, 3)); l.at(c + 16, '****'); l.at(c + 24, fx(1, 3)); c += 32; }
      if (ld.MC120) { l.at(c, fx(110, 0)); l.at(c + 8, fx(d.mc, 3)); }
      D.push(l.s);
    }
    D.push('                                              COEFFICIENTS DE MAJORATION DYNAMIQUE SUR APPUIS');
    var hh = L(); for (i = 0; i <= n; i++) hh.at(32 + 16 * i, 'APPUI ' + (i + 1)); D.push(hh.s);
    var rows = [];
    if (ld.B) rows.push(['BC', 'bc'], ['BT', 'bc']);
    if (ld.CE) rows.push(['CVOI.D', 'ce'], ['CVOI.E', 'ce']);
    if (ld.MC120) rows.push(['MC.120', 'mc']);
    rows.forEach(function (r) { var l2 = L('   ' + r[0]); for (i = 0; i <= n; i++) l2.at(31 + 16 * i, fx(R.dyn.appui[i][r[1]], 3)); D.push(l2.s); });
  }

  function coefHeader(R, f) {
    var ld = R.loads, h = L(), c = [];
    if (ld.trot) c.push(['TROTTOIRS', 'trot']);
    if (ld.A) c.push(['A(' + f.coef.A.nv + ' /' + R.nv + ' )', 'A']);
    if (ld.B) { c.push(['BC(' + f.coef.BC.nv + ' /' + R.nv + ' )', 'BC']); if (f.coef.BT) c.push(['BT(' + f.coef.BT.nv + ' /' + R.nv + ' )', 'BT']); }
    if (ld.CE) { c.push(['CVOI.D', 'CE']); c.push(['CVOI.E', 'CE']); }
    if (ld.MC120) c.push(['MC.120', 'MC120']);
    return c;
  }
  function coefVal(coef, k) { var x = coef[k]; if (x && typeof x === 'object') return x.val !== undefined ? x.val : x.deux; return x; }

  function secTransv(D, m, R) {
    var v = m.values, n = R.n, t;
    var nt = spansToPrint(R, v);
    for (t = 0; t < nt; t++) {
      var T = R.transv[t];
      D.newPage();
      D.push('                                       COEFFICIENTS CORRECTIFS DE REPARTITION TRANSVERSALE EN TRAVEE ' + (t + 1));
      D.push(row([[41, 'PORTEE EQUIVALENTE'], [48, fx(T.Le, 3)], [104, "PARAMETRE D'ENTRETOISEMENT"], [110, fx(T.theta, 2)]]));
      T.fibres.forEach(function (f, fi) {
        if (fi === 2) { D.push('AXE DE LA CHAUSSEE'); D.push("    LIGNE  D'INFLUENCE"); }
        else { D.push('FIBRE  ' + fx(f.y, 2) + " M DE L'AXE DE L'EXTRADOS"); D.push("    LIGNE D'INFLUENCE"); }
        D.push('        (PAS DE 0.125)');
        for (var k = 0; k < f.li.length; k += 10) {
          var l = L(); for (var j = k; j < Math.min(k + 10, f.li.length); j++) l.at(34 + 10 * (j - k), fx(f.li[j], 4)); D.push(l.s);
        }
        var cols = coefHeader(R, f), h = L(), c = L('    COEFFICIENTS');
        cols.forEach(function (cc, ci) { h.at(33 + 12 * ci + (ci === 0 ? 0 : 0), cc[0]); c.at(30 + 12 * ci, fx(coefVal(f.coef, cc[1]), 3)); });
        D.push(h.s); D.push(c.s);
      });
      D.push('      NOTA : POUR CES CALCULS, LA DALLE EST SUPPOSEE DE SECTION PARFAITEMENT RECTANGULAIRE DE LARGEUR ' + fx(R.Be, 3));
    }
    D.newPage();
    D.push('                             RECAPITULATION DES COEFFICIENTS CORRECTIFS DE REPARTITION TRANSVERSALE');
    D.push("                           L'EFFET DES COEFFICIENTS REDUCTEURS,FONCTIONS DU NOMBRE DE VOIES CHARGEES");
    D.push('                   EST PRIS EN COMPTE DANS LE CALCUL DES COEFFICIENTS CORRECTIFS DE REPARTITION TRANSVERSALE');
    var cols0 = coefHeader(R, R.transv[0].fibres[0]);
    var hh = L(); cols0.forEach(function (cc, ci) { hh.at(32 + 14 * ci, cc[0].replace(/\(.*/, '')); }); D.push(hh.s);
    for (t = 0; t < n; t++) {
      var l2 = L('         TRAVEE ' + (t + 1));
      cols0.forEach(function (cc, ci) { l2.at(32 + 14 * ci, fx(R.K[t][cc[1]], 3)); }); D.push(l2.s);
    }
    D.push('                        INFLUENCE DU BIAIS - COEFFICIENTS DE MINORATION DES EFFORTS DUS AUX CHARGES');
    D.push('                                     BIAIS MECANIQUE                      COEFFICIENTS DE MINORATION');
    for (t = 0; t < n; t++) D.push(row([[15, 'TRAVEE'], [17, String(t + 1)], [47, fx(R.biaisMeca[t], 3)], [88, fx(R.minorationBiais[t], 3)]]));
  }

  function secDeniv(D, m, R) {
    var v = m.values, n = R.n, i, j;
    D.newPage();
    D.push("                               MOMENTS SUR APPUIS ET REACTIONS D'APPUIS DUS AUX DENIVELLATIONS D'APPUI");
    D.push("                                       EN FONCTION D'UNE DENIVELLATION D'APPUI DE 1 CM");
    var h = L(); for (j = 0; j <= n; j++) h.at(32 + 15 * j, 'APPUI ' + (j + 1)); D.push(h.s);
    D.push('  MOMENTS SUR APPUIS');
    for (i = 1; i < n; i++) { var l = L(row([[17, 'APPUI'], [19, String(i + 1)]])); for (j = 0; j <= n; j++) l.at(31 + 15 * j, fx(-R.deniv.M[j][i], 2)); D.push(l.s); }
    D.push("  REACTION D'APPUIS");
    for (i = 0; i <= n; i++) { var l2 = L(row([[17, 'APPUI'], [19, String(i + 1)]])); for (j = 0; j <= n; j++) l2.at(31 + 15 * j, fx(R.deniv.R[j][i], 2)); D.push(l2.s); }
    D.push('   >> NOTA - LE MODULE DE DEFORMATION UTILISE POUR LE CALCUL DES MOMENTS SUR APPUIS DUS A DES DENIVELLATIONS D\'APPUI EST LE MODULE');
    D.push('             DE DEFORMATION INSTANTANEE EI=  ' + fx(R.EI28, 0) + ' T/M2');
    D.push("L'EFFET DES TASSEMENTS D'APPUI PROPOSE CORRESPOND AUX DENIVELLATIONS SUIVANTES :");
    D.push(h.s);
    var p = L('TASSEMENTS PROBABLES'), a = L('TASSEMENTS ALEATOIRES');
    for (j = 0; j <= n; j++) { p.at(30 + 15 * j, fx(v['TP' + (j + 1)] || 0, 3)); a.at(30 + 15 * j, fx(v['DTP' + (j + 1)] || 0, 3)); }
    D.push(p.s); D.push(a.s);
    D.push("   >> NOTA - POUR LE CALCUL DE L'EFFET DES TASSEMENTS D'APPUIS EFFECTIFS, LE MODULE DE DEFORMATION DU BETON UTILISE EST EGAL A");
    D.push('              ' + fx(1 / (v.YOUNG || 3), 3) + ' FOIS LA VALEUR DU MODULE DE DEFORMATION INSTANTANEE DU BETON');
  }

  function secSollicitations(D, m, R) {
    var v = m.values, n = R.n, nt = spansToPrint(R, v), t;
    var f1 = function (x) { return fx(x, 1); };
    for (t = 0; t < nt; t++) {
      D.newPage();
      D.push('                                                 MOMENTS FLECHISSANTS EN TRAVEE ' + (t + 1));
      D.push('                        SOUS LES CHARGES PERMANENTES ET LES DIFFERENTS CAS DE SURCHARGE POUR LA LARGEUR TOTALE');
      D.push('                                                                                                   E T A T S - L I M I T E S');
      D.push("   SECTION  ABSCISSE       CHARGES PERMANENTES               CHARGES D'EXPLOITATION             D'UTILISATION            ULTIME");
      D.push('            CUMULEE');
      D.push('                        OSSAT.    C.P.    TASSEMENT       A      B         C.E.    TROTT    QL+QC  QL+QC+TA  QL+PSI1.QC  QL+QC+TA');
      R.sol[t].forEach(function (S) {
        [0, 1].forEach(function (si) {
          var c = S.comb[si];
          var items = [[29, f1(S.oss[si])], [38, f1(S.cp[si])], [45, f1(S.tp[si])], [52, f1(S.ta[si])], [61, f1(S.A[si])], [69, f1(S.B[si])], [79, f1(S.C[si])], [87, f1(S.trot[si])], [98, f1(c.qlqc)], [107, f1(c.qlqcta)], [116, f1(c.freq)], [128, f1(c.elu)]];
          if (si === 0) items.unshift([9, fx(S.x0, 2) + 'L'], [19, fx(S.abs, 3)]);
          D.push(row(items));
        });
      });
      D.newPage();
      D.push('                     POSITIONS DES SURCHARGES CORRESPONDANT AUX MOMENTS FLECHISSANTS EXTREMES EN TRAVEE ' + (t + 1));
      D.push('       SECTION   ABSCISSE                CHARGE A                        C H A R G E   B                          CHARGE');
      D.push('                 CUMULEE                                                                                 A CARACTERE PARTICULIER');
      D.push('                                      LONGUEURS CHARGEES           TYPE   SENS    ABS. DES CAMIONS          TYPE     ABSCISSES');
      R.sol[t].forEach(function (S) {
        if (S.x0 === 0 && t === 0) return;
        [0, 1].forEach(function (si) {
          var l = L();
          if (si === 0) { l.at(12, fx(S.x0, 2)); l.at(14, 'L'); l.at(25, fx(S.abs, 3)); }
          S.Alens[si].forEach(function (x, k) { l.at(40 + 7 * k, fx(x, 2)); });
          var b = S.Bpos[si]; if (b.type) { l.at(71, b.type); l.at(77, b.sens); b.pos.forEach(function (x, k) { l.at(86 + 7 * k, fx(x, 2)); }); }
          var c = S.Cpos[si]; if (c.type) { l.at(113, c.type); c.pos.forEach(function (x, k) { l.at(120 + 7 * k, fx(x, 2)); }); }
          D.push(l.s);
        });
      });
    }
    D.newPage();
    var shStart = D.lines.length;
    D.push('                                                  EFFORTS TRANCHANTS SUR APPUIS');
    D.push('                        SOUS LA CHARGE PERMANENTE ET LES DIFFERENTS CAS DE SURCHARGE POUR LA LARGEUR TOTALE');
    D.push('                                      CHARGE      CHARGE A      CHARGE B       CHARGE C      TROTTOIRS        ETATS-LIMITES');
    D.push('                                    PERMANENTE                                                              SERVICE    ULTIME');
    for (t = 0; t < nt; t++) {
      ['gauche', 'droite'].forEach(function (cd, ci) {
        var S = R.shear[t][cd];
        [0, 1].forEach(function (si) {
          var items = [[43, f1(S.cp[si])], [57, f1(S.A[si])], [71, f1(S.B[si])], [85, f1(S.C[si])], [99, f1(S.trot[si])], [113, f1(S.comb[si].qlqc)], [124, f1(S.comb[si].elu)]];
          if (si === 0) { if (ci === 0) items.unshift([19, 'TRAVEE'], [21, String(t + 1)]); items.unshift([ci === 0 ? 33 : 32, ci === 0 ? 'COTE GAUCHE' : 'COTE DROIT']); }
          D.push(row(items.sort(function (a, b) { return a[0] - b[0]; })));
        });
      });
    }
    R._shearLines = D.lines.slice(shStart);
    D.newPage();
    D.push("                                                       REACTIONS D'APPUIS");
    D.push('                         SOUS LA CHARGE PERMANENTE ET LES DIFFERENTS CAS DE SURCHARGE POUR LA LARGEUR TOTALE');
    D.push('              CHARGES  TROTTOIRS   A ( L )       C H A R G E S   B                 C H A R G E S   C                ETATS-LIMITES');
    D.push('               PERM.                            BC        BT                CVOI.D    CVOI.E    MC.120             SERVICE    ULTIME');
    var na = (v.SYM === 1) ? Math.floor(n / 2) + 1 : n + 1;
    for (var a = 0; a < na; a++) {
      var S = R.reac[a], e = S.ext;
      [0, 1].forEach(function (si) {
        var g = function (k) { return e[k] ? f1(e[k][si].v) : null; };
        var items = [[21, f1(S.cp[si])], [31, f1(S.trot[si])], [41, f1(S.A[si])], [51, g('BC')], [61, g('BT')], [82, g('CVOI.D')], [92, g('CVOI.E')], [102, g('MC.120')], [121, f1(S.comb[si].qlqc)], [131, f1(S.comb[si].elu)]].filter(function (x) { return x[1] !== null; });
        if (si === 0) items.unshift([7, 'APPUI'], [9, String(a + 1)]);
        D.push(row(items));
      });
    }
  }

  // déformations : seules les colonnes charges permanentes sont calculées (précontrainte non implémentée)
  function secDeform(D, m, R) {
    for (var t = 0; t < R.n; t++) {
      D.newPage();
      D.push('                                                    DEFORMATION DU TABLIER  TRAVEE ' + (t + 1));
      D.push('                                    DEFORMEES SOUS LES CHARGES PERMANENTES ET LA PRECONTRAINTE (EN MILLIMETRES)');
      D.push('           SECTION             CHARGE PERMANENTE                    PRECONTRAINTE        CHARGE PERMANENTE + PRECONTRAINTE');
      D.push('                        OSSATURE      TOTALE       TOTALE      DEFORMEE     DEFORMEE     MISE EN PRECONTRAINTE     EN SERVICE');
      D.push('                       DEFOR.INST.  DEFOR.INST.  DEFOR.TOT.    INSTANT.    PAR FLUAGE    OSSATURE      TOTALE     APRES FLUAGE');
      var Pd = R.prec && R.prec.defl;
      for (var q = 0; q <= 10; q++) {
        var it = [[18, fx(q / 10, 2) + 'L'], [32, fx(R.deform.oss[t][q], 1)], [45, fx(R.deform.cpi[t][q], 1)], [58, fx(R.deform.cpt[t][q], 1)]];
        if (Pd) { var pi = Pd.inst[t][q], pf = Pd.flu[t][q];
          it.push([71, fx(pi, 1)], [84, fx(pf, 1)], [97, fx(R.deform.oss[t][q] + pi, 1)], [110, fx(R.deform.cpi[t][q] + pi, 1)], [123, fx(R.deform.cpt[t][q] + pi + pf, 1)]); }
        D.push(row(it));
      }
    }
  }

  // --------------------------------------------------------------- précontrainte
  function cotesTable(D, m, R) {
    var v = m.values, n = R.n, c = m.cotes.values;
    D.push('                      TABLEAU DONNANT LES COTES DE L\'AXE DU CABLE PAR RAPPORT A LA SOUS DALLE');
    var h = L(); for (var t = 0; t < n; t++) h.at(31 + 18 * t, 'EN  TRAVEE  ' + (t + 1)); D.push(h.s);
    var h2 = L('   SECTION'); for (t = 0; t < n; t++) { h2.at(26 + 18 * t, 'ABSCISSE'); h2.at(31 + 18 * t, 'COTE'); } D.push(h2.s);
    var N = c[0].length - 1;
    for (var k = 0; k <= N; k++) {
      var l = L(); l.at(10, fx(k / N, 2) + 'L');
      for (t = 0; t < n; t++) { l.at(23 + 18 * t, fx(k * R.L[t] / N, 3)); l.at(31 + 18 * t, fx(c[t][k], 3)); }
      D.push(l.s);
    }
    D.push("NOTA  L'ABSCISSE EST COMPTEE PAR RAPPORT A L'APPUI DE GAUCHE DE LA TRAVEE");
    D.push('      CE CABLAGE EST REALISE AVEC ' + (v.NCA < 10 ? ' ' : '') + v.NCA + ' CABLES');
    D.push('                              EN 1 LIT(S)');
  }
  function secCotesCable(D, m, R) { D.newPage(); cotesTable(D, m, R); }
  // Tableaux finaux (câblage automatique) : cotes de l'axe du câble et de la sous-gaine / sous-dalle, pas L/ceil(L)
  // ; sous-gaine = axe - DGAIN/2 - 0.1 DGAIN·signe(z'') (câble plaqué dans la gaine ; transition près des ancrages NON RÉSOLUE)
  function secCotesFinales(D, m, R) {
    var P = R.prec, v = m.values; if (!P || !P.cable || v.CABL === 4) return;
    var VP = R.section.calc.VP, cab = P.cable, n = R.n, ns = n;
    var one = function (title, f) {
      D.newPage(); D.push(' ');
      D.push(pad(32, title)); D.push(' ');
      D.push('             ABSCISSE    COTE    ABSCISSE    COTE    ABSCISSE    COTE    ABSCISSE    COTE    ABSCISSE    COTE    ABSCISSE    COTE ');
      for (var t = 0; t < ns; t++) {
        D.push(' '); D.push('TRAVEE ' + (t + 1) + ' '); D.push(' ');
        var l = R.L[t], N = Math.ceil(l - 1e-9), pts = [];
        for (var k = 0; k <= N; k++) pts.push(k * l / N);
        for (var i = 0; i < pts.length; i += 6) {
          var ln = L(); pts.slice(i, i + 6).forEach(function (x, j) { ln.at(21 + 20 * j, fx(x, 3)); ln.at(29 + 20 * j, fx(f(t, x), 3)); });
          D.push(ln.s + ' '); D.push(' ');
        }
      }
      D.push("NOTA  :  L'ABSCISSE EST COMPTEE PAR RAPPORT A L'APPUI DE GAUCHE DE LA TRAVEE ");
    };
    var axe = function (t, x) { return VP + cab.z(t, x); };
    one("TABLEAU DONNANT LES COTES DE L'AXE DU CABLE PAR RAPPORT A LA SOUS DALLE ", axe);
    one('TABLEAU DONNANT LES COTES DE LA SOUS GAINE PAR RAPPORT A LA SOUS DALLE ', function (t, x) {
      var h = 1e-3, l = R.L[t], xa = Math.max(0, Math.min(l - 2 * h, x - h)), c = cab.z(t, xa) - 2 * cab.z(t, xa + h) + cab.z(t, xa + 2 * h);
      return axe(t, x) - v.DGAIN / 2 - 0.1 * v.DGAIN * (c > 0 ? 1 : (c < 0 ? -1 : 0));
    });
  }


  function secCaracBP(D, m, R) {
    var v = m.values, P = R.prec, sc = R.section.calc, lim = R.limites, genre = Math.floor((v.GEN || 201) / 100);
    D.newPage();
    D.push('                            CARACTERISTIQUES GENERALES NECESSAIRES A LA JUSTIFICATION DE LA PRECONTRAINTE');
    D.push('     CARACTERISTIQUES PRINCIPALES DU BETON');
    D.push(row([[74, '         MODULE DE DEFORMATION INSTANTANEE A LA MISE EN PRECONTRAINTE'], [92, 'EI   ='], [102, fx(R.EI, 0)]]));
    D.push(row([[55, '              MODULE DE DEFORMATION DIFFEREE PAR FLUAGE'], [92, 'EF   ='], [102, fx(R.EF, 0)]]));
    D.push(row([[58, '              MODULE DE DEFORMATION INSTANTANEE EN SERVICE'], [92, 'EI28 ='], [102, fx(R.EI28, 0)]]));
    D.push(row([[51, '              MODULE DE DEFORMATION DIFFEREE TOTALE'], [92, 'EV28 ='], [102, fx(R.EV28, 0)]]));
    D.push('              DEFORMATION RELATIVE DUE AU RETRAIT  ' + fx(R.retrait, 7));
    D.push('              COEFFICIENT DE POISSON               ' + fx(v.POIS || 0, 3));
    D.push(row([[74, '              CONTRAINTES DE COMPRESSION DE RUPTURE : A LA MISE EN TENSION'], [80, fx(v.FCJ, 0)], [85, 'T/M2']]));
    D.push(row([[64, '                                                      A 28 JOURS'], [80, fx(v.FC28, 0)], [85, 'T/M2']]));
    D.push('     CONTRAINTES LIMITES EN T/M2. RELEVANT DU GENRE ' + genre + ' (PSI1= ' + fx(v.PSI1, 3) + ') :');
    D.push('                                                          EN PHASE INITIALE    SOUS QL   SOUS QL+QC  SOUS QL+QC+TA  SOUS QL+PSI1.QR');
    var r5 = function (lab, a) { return row([[lab.length, lab], [69, fx(a[0], 0)], [84, fx(a[1], 0)], [99, fx(a[2], 0)], [112, fx(a[3], 0)], [127, fx(a[4], 0)]]); };
    D.push(r5('              DE COMPRESSION DU BETON', [lim.compInit, lim.comp, lim.comp, lim.comp, lim.comp]));
    D.push(r5("              DE TRACTION DU BETON EN SECTION D'ENROBAGE", [lim.trEnrInit, 0, lim.trEnrQC, lim.trEnrQC, 0]));
    D.push(r5("              DE TRACTION DU BETON HORS SECTION D'ENROBAGE", [lim.trHorsInit, lim.trHors, lim.trHorsQC, lim.trHorsQC, lim.trHors]));
    D.push('              DE TRACTION DES ARMATURES PASSIVES    ' + fx((v.FE1 || 50000) / 2, 0));
    D.push('     CARACTERISTIQUES PRINCIPALES DES ACIERS DE PRECONTRAINTE                                                     COUVERTURE');
    D.push("                                                      SECTION D'UNE   DIAMETRE D'UNE   SECTION D'UNE   RAYON      DE LA GAINE");
    D.push('              PROCEDE           UNITE        NOMBRE     ARMATURE          GAINE            GAINE      MINIMAL   F.SUP.   F.INF.');
    D.push(row([[13 + String(v.PROCEDE || '').length, v.PROCEDE || ''], [39, v.UNITE || ''], [49, P.N ? String(P.N) : ''], [65, fx(v.SECT, 0) + 'MM2'], [80, fx(v.DGAIN, 3) + 'M'],
      [98, fx(P.Sg, 6) + 'M2'], [109, fx(v.RMIN, 3) + 'M'], [118, fx(v.COUVS, 3) + 'M'], [127, fx(v.COUVI, 3) + 'M']]));
    D.push('                                                                                                     COEF      RECUL');
    D.push("                 RG           TG             EP               T0          REL.1000H         PHI      FROT    D'ANCRAGE   DECAL");
    D.push(row([[25, fx(v.FPRG, 0) + 'T/M2'], [38, fx(v.FPEG, 0) + 'T/M2'], [53, fx(v.EP, 0) + 'T/M2'], [69, fx(v.SIGMAP0, 0) + 'T/M2'], [82, fx(v.RO / 100, 4)],
      [96, fx(v.PHI, 4)], [105, fx(v.F, 2)], [116, fx(v.RECUL, 3) + 'M'], [127, fx(v.DECAL, 3) + 'M']]));
    D.push(pad(75, 'MU0=' + fx(v.MU0, 2)));
    D.push("              MODE D'ANCRAGE : " + (v.MOD === 0 ? 'ACTIF AUX DEUX EXTREMITES' : 'ACTIF A UNE EXTREMITE'));
    D.push('     CARACTERISTIQUES DES ACIERS DE BETON ARME');
    D.push('                                                FERRAILLAGE LONGITUDINAL ET TRANSVERSAL              ETRIERS');
    D.push(row([[31, "            LIMITE D'ELASTICITE"], [69, fx(v.FE1, 0) + 'T/M2'], [110, fx(v.FE2, 0) + 'T/M2']]));
    D.push('     CARACTERISTIQUES DES SECTIONS TRANSVERSALES');
    D.push('                                                 CENTRE  DE  GRAVITE');
    D.push('              SECTION BRUTE    SECTION NETTE         V           V1      IG (SECTION BRUTE)         I(X) (SECTION NETTE)');
    D.push(row([[23, fx(R.section.S, 4)], [26, 'M2'], [40, P.N ? fx(P.Sn, 4) : ''], [43, P.N ? 'M2' : ''], [56, fx(sc.V, 4)], [58, 'M'], [68, fx(sc.VP, 4)], [70, 'M'],
      [85, fx(R.section.I, 6)], [88, 'M4'], [105, fx(R.section.I, 6)], [107, '-'], [116, P.N ? fx(P.coefI, 6) : ''], [124, 'Z(X)**2']]));
    {
      D.push('     PROFIL VERTICAL DU CABLE      NOMBRE DE DIVISIONS PAR TRAVEE');
      var l = L(); for (var t = 0; t < R.n; t++) { l.at(22 + 13 * t, 'ND' + (t + 1)); l.at(24 + 13 * t, '='); l.at(27 + 13 * t, String(R.ND[t])); } D.push(l.s);
    }
  }

  function secEquationsCable(D, m, R) {
    var P = R.prec, n = R.n;
    D.newPage();
    D.push('                            EQUATIONS PARABOLIQUES DU CABLE UTILISEES DANS LE CALCUL DES PERTES DE TENSION');
    D.push('                                        PARABOLES DE LA FORME Z = A * X ** 2 + B * X + C');
    D.push('    RAPPORTEES AUX AXES OX = FIBRE MOYENNE DE LA SECTION BRUTE, OZ = APPUI DE GAUCHE DE LA TRAVEE');
    P.cable.spans.forEach(function (segs, t) {
      var h = L();
      segs.forEach(function (g, s) {
        if (s === 0) { h.at(10, 'DE'); h.at(12, '0'); h.at(14, 'A'); h.at(21, fx(g.to, 3)); }
        else { h.at(27 + 22 * (s - 1), 'DE'); h.at(34 + 22 * (s - 1), fx(g.from, 3)); h.at(36 + 22 * (s - 1), 'A'); h.at(43 + 22 * (s - 1), fx(g.to, 3)); }
      });
      D.push(h.s);
      ['A', 'B', 'C'].forEach(function (key) {
        var l = L(key === 'A' ? 'TRAVEE ' + (t + 1) + ' A' : pad(9, key));
        segs.forEach(function (g, s) { l.at(21 + 22 * s, fx(g[key], 6)); });
        D.push(l.s);
      });
    });
    D.push(' NOTA');
    var tr = ''; for (var t = 0; t < n; t++) tr += (t ? ' ' : '') + (t + 1 < 10 ? ' ' : '') + (t + 1) + ',';
    D.push('           DANS LES TRAVEES' + tr);
    if (m.values.CABL !== 4) { D.push('           LES EQUATIONS SONT CELLES DU CABLE'); if (P.flBlock) fluageBlock(D, R, P.flBlock, 1); return; }
    D.push('           OU LE CABLE EST DEFINI PAR POINTS, LES EQUATIONS CI DESSUS NE DONNENT PAS EXACTEMENT');
    D.push('           LES EXCENTREMENTS DU CABLE PAR RAPPORT A LA FIBRE MOYENNE');
    D.push("L'ECART QUADRATIQUE MOYEN EST DE " + fx(P.cable.ecart, 3));
  }

  function travHeader(D, t, two) { D.newPage(); D.push(pad(60, 'TRAVEE ' + (two ? ' ' : '') + (t + 1))); }

  function secTensions(D, m, R) {
    var v = m.values, P = R.prec, nt = spansToPrint(R, v);
    for (var t = 0; t < nt; t++) {
      travHeader(D, t, true);
      D.push("                          TENSIONS EN PHASE INITIALE ET PREMIERE APPROXIMATION DES TENSIONS A L'INFINI");
      D.push('                                                                           MISE EN TENSION');
      D.push('                                                                         EN UNE SEULE SERIE');
      D.push('                                *                           **                                                          ***');
      D.push('     SECTION  ABSCISSE  DEVIATION    T0    PERTE  AU   PERTES   <<<  TENSIONS INITIALES  >>> RELAXATION  TERME    T.INFINI');
      D.push('              CUMULEE   EN GRADES           BLOCAGE   INSTANT.  T.PROBA.   T.MAXI.   T.MINI.   TOTALE  RECTANGLE  PROBABLE');
      P.G.filter(function (g) { return g.t === t; }).forEach(function (g) {
        var p = g.p;
        D.push(row([[11, fx(g.k / P.ND[t], 2) + 'L'], [21, fx(g.X, 3)], [31, fx(g.dev, 3)], [41, fx(g.T0, 0)], [51, fx(g.bl, 0)], [61, fx(p.inst, 0)], [71, fx(p.proba, 0)],
          [81, fx(p.maxi, 0)], [91, fx(p.mini, 0)], [101, fx(p.relax, 0)], [111, fx(p.rect, 0)], [122, fx(p.infini, 0)]]));
      });
      if (t === 0) {
        D.push('  * LA DEVIATION ANGULAIRE TIENT COMPTE DE LA DEVIATION PARASITE EN LIGNE EGALE A ' + fx(v.PHI / v.F, 5) + ' RADIANS PAR METRE');
        D.push(' ** LES PERTES INSTANTANEES COMPRENNENT, OUTRE LES PERTES PAR FROTTEMENT ET BLOCAGE, CELLES DE RACCOURCISSEMENT ELASTIQUE = ' + fx(P.dC, 0) + 'T/M');
        D.push('*** LA TENSION DE SERVICE APPROCHEE TIENT COMPTE DES PERTES DE RETRAIT DELTA(T)= ' + pad(Math.max(0, 5 - fx(R.retrait * v.EP, 0).length), '') + fx(R.retrait * v.EP, 0) + 'T/M2 ET DE FLUAGE APPROCHE DELTA(T)= ' + fx(P.dFl, 0) + 'T/M');
        D.push("    L'EFFET  DU  RECUL  D'ANCRAGE  SE FAIT SENTIR A GAUCHE JUSQU'A  SG=" + pad(7 - fx(P.SG, 3).length, fx(P.SG, 3)) + ' M' +
          (P.SD !== null ? '  A DROITE A PARTIR DE  SD=' + pad(7 - fx(P.SD, 3).length, fx(P.SD, 3)) + ' M' : ''));
      }
      if (v.CABL !== 4 && v.MOD === 0) {
        var xm2 = xMinT0(P.G);
        if (xm2 > R.X0[t] + 1e-9 && xm2 <= R.X0[t + 1] + 1e-9) D.push('    LA TENSION MINIMALE IMMEDIATEMENT AVANT BLOCAGE EVENTUEL A POUR ABSCISSE ' + pad(7 - fx(xm2, 3).length, fx(xm2, 3)));
      }
    }
  }

  function hypBlock(D, R, rows) {
    var n = R.n, h = L(); for (var j = 1; j < n; j++) h.at(58 + 11 * (j - 1), 'APPUI ' + (j + 1)); D.push(h.s);
    rows.forEach(function (r) {
      if (r.lab) D.push(r.lab);
      var l = L(); l.at(38, ':'); l.at(45, r.k); for (var j = 1; j < n; j++) l.at(59 + 11 * (j - 1), fx(r.M[j], 1)); D.push(l.s);
    });
  }

  function secHypInit(D, m, R) {
    var v = m.values, P = R.prec, nt = spansToPrint(R, v), n = R.n;
    for (var t = 0; t < nt; t++) {
      travHeader(D, t, false);
      D.push('                                                        PHASE INITIALE');
      D.push('                                       FORCES ET MOMENTS HYPERSTATIQUES DE LA PRECONTRAINTE');
      D.push('SECTION     ABSCISSE      EXCENTR          DERIVEE SECONDE DE LA L.I. DE M SUR APPUIS          F INITIALE      F INITIALE');
      var h = L('             CUMULEE       CABLE'); for (var j = 1; j < n; j++) h.at(44 + 11 * (j - 1), 'APPUI ' + (j + 1)); h.at(107, 'MOYENNE'); h.at(123, 'MAXIMALE'); D.push(h.s);
      P.G.filter(function (g) { return g.t === t; }).forEach(function (g) {
        var l = L(); l.at(7, fx(g.k / P.ND[t], 2) + 'L'); l.at(20, fx(g.X, 3)); l.at(33, fx(g.e, 3));
        g.d2.forEach(function (d, jj) { l.at(45 + 11 * jj, fx(d, 6)); });
        l.at(103, fx(g.p.proba * P.nA, 0)); l.at(119, fx(g.p.maxi * P.nA, 0)); D.push(l.s);
      });
    }
    D.push('                                               MOMENTS HYPERSTATIQUES SUR APPUIS');
    hypBlock(D, R, [{ k: 'MOY.', M: P.hypInit.moy }, { lab: '                 EN PHASE INITIALE   :', k: 'MAX.', M: P.hypInit.max }]);
  }

  function secPertesDiff(D, m, R) {
    var v = m.values, P = R.prec, nt = spansToPrint(R, v);
    for (var t = 0; t < nt; t++) {
      travHeader(D, t, false);
      D.push('                                       PHASES MISE EN SERVICE (M.S) ET EN SERVICE (E.S)');
      D.push('                                  TENSIONS, FORCES ET MOMENTS HYPERSTATIQUES DE LA PRECONTRAINTE');
      D.push(' SECTION:ABSCISSE:  EXC. : FLUAGE:  TERME  :PERTES DIFFEREES:       TENSIONS  RESIDUELLES        :    F O R C E S   U T I L E S');
      D.push('        : CUMULEE: CABLE :       :RECTANGLE: T O T A L E S  : MISE EN SERVICE :   EN  SERVICE    : MISE EN SERVICE :  EN SERVICE');
      D.push("                         : ( A  L'INFINI ) :  M.S  :  E.S   :  MOY.  :  MAX.  :  MOY.  :   MIN.  :  MOY.  :  MAX.  : MOY.  : MIN.");
      P.G.filter(function (g) { return g.t === t; }).forEach(function (g) {
        var d = g.d, a = P.nA;
        D.push(row([[7, fx(g.k / P.ND[t], 2) + 'L'], [16, fx(g.X, 3)], [25, fx(g.e, 3)], [33, fx(d.fl, 0)], [41, fx(d.rect, 0)], [50, fx(d.ms, 0)], [58, fx(d.es, 0)],
          [69, fx(d.msMoy, 0)], [78, fx(d.msMax, 0)], [87, fx(d.esMoy, 0)], [96, fx(d.esMin, 0)], [106, fx(d.msMoy * a, 0)], [114, fx(d.msMax * a, 0)], [122, fx(d.esMoy * a, 0)], [130, fx(d.esMin * a, 0)]]));
      });
      if (t === 0) {
        D.push("LES PERTES DIFFEREES DE TENSION PAR RELAXATION FINALE DE L'ACIER SONT CELLES DONNEES PAGES PRECEDENTES");
        D.push('                                PAR RETRAIT FINAL DU BETON SONT DE ' + pad(Math.max(0, 6 - fx(R.retrait * v.EP, 0).length), fx(R.retrait * v.EP, 0)) + ' T/M2');
        D.push("                                A LA MISE EN SERVICE DE L'OUVRAGE = " + fx(100 * (v.RT === undefined ? 0.5 : v.RT), 1) + '% DE CELLES EN SERVICE DEFINITIF');
      }
    }
    D.push('                                                MOMENTS HYPERSTATIQUES SUR APPUIS');
    var H = P.hypServ;
    hypBlock(D, R, [{ k: 'MOY.', M: H.msMoy }, { lab: '              A LA MISE EN SERVICE   :', k: 'MAX.', M: H.msMax }, { k: 'MOY.', M: H.esMoy }, { lab: '              EN SERVICE DEFINITIF   :', k: 'MIN.', M: H.esMin }]);
  }

  var add = function (a, b) { return [a[0] + b[0], a[1] + b[1]]; };
  function secContraintesMT(D, m, R) {
    var v = m.values, P = R.prec, nt = spansToPrint(R, v);
    for (var t = 0; t < nt; t++) {
      travHeader(D, t, false);
      D.push('                               CONTRAINTES NORMALES DU BETON (EN T/M2) A LA FIN DE LA MISE EN TENSION');
      D.push('                                               SOUS LES PRECONTRAINTES MAX., MIN. ET MOYENNE');
      D.push('          SECTION     ABSCISSE      O S S A T U R E   S E U L E          PRECONTRAINTE              EN  PHASE  INITIALE');
      D.push('                      CUMULEE       MOY.        MAX.        MIN.        MOY.        MAX.        MOY.        MAX.        MIN.');
      D.push('                                    (1)         (2)         (3)         (4)         (5)        (1)+(4)     (2)+(5)     (3)+(5)');
      var rowsMT = P.G.filter(function (g) { return g.t === t; }).map(function (g) { return { o: g.sig, lab: g.k / P.ND[t], X: g.X }; });
      (P.extraMT || []).filter(function (e) { return e.t === t; }).forEach(function (e) { rowsMT.push({ o: e, lab: e.lab, X: e.X }); });
      rowsMT.sort(function (a, b) { return a.X - b.X || 0; });
      rowsMT.forEach(function (g) {
        var o = g.o, cols = [o.MO, o.MOx, o.MOn, o.Pi, o.Px, add(o.MO, o.Pi), add(o.MOx, o.Px), add(o.MOn, o.Px)];
        [0, 1].forEach(function (f) {
          var l = L(); if (!f) { l.at(16, fx(g.lab, 2) + 'L'); l.at(28, fx(g.X, 3)); }
          cols.forEach(function (c, i) { l.at(41 + 12 * i, fx(c[f], 0)); }); D.push(l.s);
        });
      });
    }
  }
  function secContraintesServ(D, m, R, es) {
    var v = m.values, P = R.prec, nt = spansToPrint(R, v);
    for (var t = 0; t < nt; t++) {
      travHeader(D, t, false);
      if (!es) {
        D.push("                              CONTRAINTES NORMALES DU BETON (EN T/M2) A LA MISE EN SERVICE DE L'OUVRAGE");
        D.push('                                                     SOUS LES PRECONTRAINTES MAX. ET MOYENNE');
      } else {
        D.push("                             CONTRAINTES NORMALES DU BETON (EN T/M2) DE L'OUVRAGE EN SERVICE DEFINITIF");
        D.push('                                           SOUS LES PRECONTRAINTES MIN. ET MOYENNE');
      }
      D.push('  SECTION*ABSCISSE*  CP   *     QL=      * PRECONTRAINTE *  A   V I D E   S O U S *     EN  CHARGE  SANS  TA      *   AVEC  TA');
      D.push('         *CUMULEE * SEUL  *   CP + TP    *       *       *   CP   *      QL       *   QL  +  QC   * QL + PSI1.QR  * QL + TA + QC');
      D.push('                  * MOY.  * MAX. *  MIN. *  MOY. *  ' + (es ? 'MIN.' : 'MAX.') + ' *  MOY.  *  MAX. *  MIN. *  MAX. *  MIN. *  MAX. *  MIN. *  MAX. *  MIN.');
      D.push('                  * (1)   * (2)  *  (3)  *  (4)  *  (5)  * (1)+(4)*(2)+(5)*(3)+(5)*');
      P.G.filter(function (g) { return g.t === t; }).forEach(function (g) {
        var o = g.sig; if (!o.QLx) return;
        var p4 = es ? o.Pes : o.Pms, p5 = es ? o.PesN : o.PmsX;
        var cols = [o.MG, o.QLx, o.QLn, p4, p5, add(o.MG, p4), add(o.QLx, p5), add(o.QLn, p5), add(o.qcx, p5), add(o.qcn, p5), add(o.frx, p5), add(o.frn, p5), add(o.tax, p5), add(o.tan, p5)];
        [0, 1].forEach(function (f) {
          var l = L(); if (!f) { l.at(8, fx(g.k / P.ND[t], 2) + 'L'); l.at(16, fx(g.X, 3)); }
          cols.forEach(function (c, i) { l.at(25 + 8 * i, fx(c[f], 0)); }); D.push(l.s);
        });
      });
    }
  }

  // --------------------------------------------------------------- câblage automatique (sections 20 à 22)
  function fluageBlock(D, R, blk, icr) {
    var n = R.n, m = Math.ceil(n / 2) - 1, rec = blk.rec || {};
    D.push(' CALCUL ITERATIF DU FLUAGE');
    D.push('          VARIABLES ICR, II, JJ,    FM,    FMJ :');
    D.push(row([[23, String(icr || 1)], [27, '3'], [31, '7'], [39, fx(blk.FM, 0)], [47, fx(blk.FMJ || 0, 0)]]));
    D.push('          VARIABLES I,K,SBB(K),E(I),XM,SM,CPTM,CPPM,A1,A2,A3 :');
    ['a' + (m + 1), 'b' + m, 'a' + m].forEach(function (id, i) {
      var r = rec[id]; if (!r) return;
      D.push(row([[26, String(i + 1)], [32, String(r.K)], [42, fx(r.SBB, 3)], [52, fx(r.E, 3)], [62, fx(r.XM, 3)], [72, fx(r.SM, 3)], [82, fx(r.CPTM, 3)],
        [92, fx(r.CPPM, 3)], [102, fx(r.A1, 3)], [112, fx(r.A2, 3)], [122, fx(r.A3, 3)]]));
    });
  }
  function xMinT0(G) { var b = G[0]; G.forEach(function (g) { if (g.T0 < b.T0 - 1e-6) b = g; }); return b.X; }
  function fuseauTables(D, m, R, blk) {
    var v = m.values, n = R.n;
    for (var t = 0; t < n; t++) {
      D.newPage();
      D.push('                             ELEMENTS DE DETERMINATION DU FUSEAU LIMITE DANS LA TRAVEE ' + (t + 1));
      D.push('                                          AVEC DES PERTES ' + blk.kind + ' ET ' + (blk.N < 10 ? ' ' : '') + blk.N + ' CABLES');
      D.push('                                          MISE EN TENSION EN UNE SEULE SERIE');
      D.push('                                *                           **                                     ***');
      D.push('     SECTION  ABSCISSE  DEVIATION    T0    PERTE  AU  TENSION  RELAXATION   TERME   TENSIONS PROBABLES    FUSEAU LIMITE');
      D.push('              CUMULEE   EN GRADES           BLOCAGE   INITIALE   TOTALE   RECTANGLE   M . S     E . S   BORD SUP  BORD INF');
      blk.G.filter(function (g) { return g.t === t; }).forEach(function (g) {
        D.push(row([[11, fx(g.k / 10, 2) + 'L'], [21, fx(g.X, 3)], [31, fx(g.dev, 3)], [41, fx(g.T0, 0)], [51, fx(g.bl, 0)], [61, fx(g.Ti, 0)], [71, fx(g.rel, 0)],
          [81, fx(g.rect, 0)], [91, fx(g.ms, 0)], [101, fx(g.es, 0)], [111, fx(g.sup, 3)], [121, fx(g.inf, 3)]]));
      });
      D.push('    * LA DEVIATION ANGULAIRE TIENT COMPTE DE LA DEVIATION PARASITE EN LIGNE EGALE A ' + fx(v.PHI / v.F, 5) + ' RADIANS PAR METRE');
      D.push('   ** LA TENSION T1 TIENT COMPTE EGALEMENT DE LA PERTE DE RACCOURCISSEMENT ELASTIQUE DELTA(T)= ' + fx(blk.dC, 0) + 'T/M2');
      D.push('  *** LA TENSION DE SERVICE APPROCHEE TIENT COMPTE DES PERTES DE RETRAIT DELTA(T)=' + fx(R.retrait * v.EP, 0) + 'T/M2 ET DE FLUAGE APPROCHE DELTA(T)=' + fx(blk.fl, 0) + 'T/M2');
      D.push("  L'EFFET DU RECUL D'ANCRAGE SE FAIT SENTIR A GAUCHE JUSQU'A SG=" + pad(7 - fx(blk.SG, 3).length, fx(blk.SG, 3)) + ' M' +
        (blk.SD !== null ? ', A DROITE A PARTIR DE SD=' + pad(7 - fx(blk.SD, 3).length, fx(blk.SD, 3)) + ' M' : ''));
      var xm = xMinT0(blk.G);
      if (v.MOD === 0 && xm > R.X0[t] + 1e-9 && xm <= R.X0[t + 1] + 1e-9)
        D.push("  LA TENSION MINIMALE APRES DEDUCTION DES PERTES DE COURBURE MAIS AVANT RECUL D'ANCRAGE EVENTUEL A POUR ABSCISSE " + pad(7 - fx(xm, 3).length, fx(xm, 3)));
    }
  }
  function zcourb(D, R, blk) {
    var n = R.n;
    D.push('                        EXCENTREMENTS MAXIMAUX SUR APPUIS COMPATIBLES AVEC LE RAYON DE COURBURE DES GAINES');
    D.push('                                                            *     *');
    D.push('                                                               *');
    D.push('                                            ZCOURB G                    ZCOURB D');
    for (var j = 1; j < n; j++) {
      // NON RÉSOLU : valeur provisoire = bord supérieur du fuseau sur appui
      var g = blk.G[(j - 1) * 11 + 10];
      D.push(row([[24, 'APPUI ' + (j + 1)], [52, fx(g.sup, 3)], [80, fx(g.sup, 3)]]));
    }
  }
  function parSegsHeader(segs, base, step) {
    var h = L();
    segs.forEach(function (g, s) {
      if (s === 0) { h.at(base, 'DE'); h.at(base + 2, '0'); h.at(base + 4, 'A'); h.at(base + 11, fx(g.to, 3)); }
      else { h.at(base + 17 + step * (s - 1), 'DE'); h.at(base + 24 + step * (s - 1), fx(g.from, 3)); h.at(base + 26 + step * (s - 1), 'A'); h.at(base + 33 + step * (s - 1), fx(g.to, 3)); }
    });
    return h.s;
  }
  function eqBlock(D, R, spans) {
    spans.forEach(function (segs, t) {
      D.push(parSegsHeader(segs, 10, 22));
      ['A', 'B', 'C'].forEach(function (key) {
        var l = L(key === 'A' ? 'TRAVEE ' + (t + 1) + ' A' : pad(9, key));
        segs.forEach(function (g, s) { l.at(21 + 22 * s, fx(g[key], 6)); });
        D.push(l.s);
      });
    });
  }
  function secCablageAuto(D, m, R) {
    var v = m.values, P = R.prec, au = P && P.auto, n = R.n, t, j;
    if (!au || !au.blocks) return;
    var BA = au.blocks[0], BR = au.blocks[1];
    D.newPage(); fluageBlock(D, R, BA, 1);
    fuseauTables(D, m, R, BA);
    D.newPage();
    D.push('                       EXCENTREMENTS   DE   BASE   NECESSAIRES   AU   REAJUSTEMENT   DES   PERTES   DE   TENSION');
    D.push('                                                            *     *');
    D.push('                                                               *');
    D.push('                                X          Z               X          Z               X          Z');
    for (t = 0; t < n; t++) {
      D.push(row([[27, 'TRAVEE  ' + (t + 1)], [35, fx(R.X0[t], 3)], [46, fx(au.P2.zs[t], 3)], [62, fx(R.X0[t] + au.P2.xl[t], 3)], [73, fx(au.P2.zl[t], 3)],
        [89, fx(R.X0[t + 1], 3)], [100, fx(au.P2.zs[t + 1], 3)]]));
    }
    zcourb(D, R, BA);
    D.newPage(); fluageBlock(D, R, BR, 1);
    fuseauTables(D, m, R, BR);
    D.newPage();
    D.push('NOMBRES DE CABLES NECESSAIRES');
    D.push("          A L'OUVERTURE DU FUSEAU LIMITE  " + pad(6 - fx(BR.nb.ouv, 2).length, fx(BR.nb.ouv, 2)) + ' ( DONT ' + pad(5 - fx(BR.nb.ouv, 2).length, fx(BR.nb.ouv, 2)) + ' EN PHASE DE CONSTRUCTION )');
    var hl = L(); for (t = 0; t < n; t++) hl.at(61 + 11 * t, 'TRAVEE' + (t + 1)); D.push(hl.s);
    var il = L("          A L'INSCRIPTION DU CABLE DANS LA STRUCTURE"); for (t = 0; t < n; t++) il.at(60 + 11 * t, fx(BR.nb.ins[t], 2)); D.push(il.s);
    D.push('NOMBRE RETENU : ' + (au.N < 10 ? ' ' : '') + au.N);
    D.newPage(); zcourb(D, R, BR);
    D.newPage();
    D.push('                                             EQUATIONS DES PARABOLES LIMITES');
    D.push('                                                              *     *');
    D.push('                                                                 *');
    D.push('                                     PARABOLES DE LA FORME  Z = A*X**2 + B*X + C');
    D.push('              RAPPORTEES AUX AXES OX = FIBRE MOYENNE DE LA SECTION BRUTE, OZ = APPUI DE GAUCHE DE LA TRAVEE');
    for (t = 0; t < n; t++) [au.T1, au.T2].forEach(function (T, k) {
      var segs = T.spans[t];
      D.push(parSegsHeader(segs, 50, 20));
      ['A', 'B', 'C'].forEach(function (key) {
        var l = L(key === 'A' ? '          TRAVEE ' + (t + 1) + '        TRACE ' + (k + 1) + '        A' : pad(41, key));
        segs.forEach(function (g, s) { l.at(64 + 20 * s, fx(g[key], 6)); });
        D.push(l.s);
      });
    });
    for (t = 0; t < n; t++) {
      D.newPage();
      D.push('       MOMENTS HYPERSTATIQUES SUR APPUIS DUS AUX TRACES LIMITES DU CABLE DANS LA TRAVEE ' + (t + 1) + ' POUR TOUTE LA LARGEUR DE LA DALLE');
      D.push('                                                        *     *');
      D.push('                                                           *');
      D.push('SECTION     ABSCISSE     EXCENTREMENT DU CABLE      DERIVEE SECONDE DE LA L.I. DE M SUR APPUIS');
      var h2 = L('             CUMULEE       TRACE 1   TRACE 2'); for (j = 1; j < n; j++) h2.at(59 + 11 * (j - 1), 'APPUI ' + (j + 1)); h2.at(130, 'F MOYEN DE SERVICE'); D.push(h2.s);
      for (var k = 0; k <= 10; k++) {
        var x = k * R.L[t] / 10, l2 = L();
        l2.at(6, fx(k / 10, 2) + 'L'); l2.at(19, fx(R.X0[t] + x, 3)); l2.at(33, fx(au.T1.z(t, x), 4)); l2.at(43, fx(au.T2.z(t, x), 4));
        for (j = 1; j < n; j++) l2.at(59 + 11 * (j - 1), fx(au.d2(t, k, j), 6));
        l2.at(130, fx(au.Fm(t, k), 0)); D.push(l2.s);
      }
      D.push('                                           MOMENTS HYPERSTATIQUES SUR APPUIS DUS AU TRACE DU CABLE EN TRAVEE ' + (t + 1));
      var h3 = L(); for (j = 1; j < n; j++) h3.at(60 + 11 * (j - 1), 'APPUI ' + (j + 1)); D.push(h3.s);
      [au.H1[t], au.H2[t]].forEach(function (Hh, k2) {
        var l3 = L(k2 === 0 ? '          EN SERVICE                      TRACE 1' : '                                          TRACE 2');
        Hh.forEach(function (x2, jj) { l3.at(61 + 11 * jj, fx(x2, 3)); }); D.push(l3.s);
      });
    }
    D.push('                                           MOMENTS HYPERSTATIQUES TOTAUX SUR APPUIS DUS AU TRACE DU CABLE');
    var h4 = L(); for (j = 1; j < n; j++) h4.at(60 + 11 * (j - 1), 'APPUI ' + (j + 1)); D.push(h4.s);
    [au.H1tot, au.H2tot].forEach(function (Hh, k2) {
      var l4 = L(k2 === 0 ? '          EN SERVICE                      TRACE 1' : '                                          TRACE 2');
      Hh.forEach(function (x2, jj) { l4.at(61 + 11 * jj, fx(x2, 3)); }); D.push(l4.s);
    });
    D.push('MATRICE DU SYSTEME');
    au.Mat.forEach(function (rw) { var l5 = L(); rw.forEach(function (x3, k3) { l5.at(30 + 10 * k3, fx(x3, 3)); }); D.push(l5.s); });
    var vec = function (lab, arr, d) { var l6 = L('                    VECTEUR ' + lab + ' :'); arr.forEach(function (x4, k4) { l6.at(40 + 10 * k4, fx(x4, d)); }); D.push(l6.s); };
    vec('R', au.Rv, 3); vec('R', au.Rv.map(function (x5) { return 0.2093 * x5; }), 3);
    vec('B', au.lambda.map(function () { return 1; }), 4); vec('Y', au.lambda, 4);
    D.newPage();
    D.push('                                EQUATIONS PARABOLIQUES DU CABLE  AVANT TRANSFORMATION LINEAIRE');
    D.push('                                                       *     *');
    D.push('                                                          *');
    eqBlock(D, R, au.before.spans);
    D.newPage();
    D.push('                                EQUATIONS PARABOLIQUES DU CABLE  APRES TRANSFORMATION LINEAIRE');
    D.push('                                                       *     *');
    D.push('                                                          *');
    eqBlock(D, R, au.after.spans);
  }


  // ------------------------------------------------------------ flexion transversale (éléments de calcul, LI de μ)
  function secFlexT(D, m, R) {
    if (!R.flexT) return;
    var ns = spansToPrint(R, m.values);
    for (var t = 0; t < ns; t++) {
      var F = R.flexT[t];
      D.newPage();
      D.push(pad(34, 'ELEMENTS DE CALCUL DU MOMENT DE FLEXION TRANSVERSALE EN TRAVEE  ' + (t + 1) + ' '));
      D.push('  ');
      var rp = function (x, w) { x = String(x); return x.length >= w ? x : pad(w - x.length, x); };
      D.push('      BIAIS MECANIQUE (PSI) ' + rp(fx(F.psi, 3), 8) + '       LONGUEUR EQUIVALENTE BIAISE (DB):' + rp(fx(F.DB, 3), 6) + '        LARGEUR EQUIVALENTE DROITE : ' + rp(fx(F.Be, 3), 8) + ' ');
      D.push(row([[30, '      COEFFICIENT DE POISSON :'], [39, fx(F.nu, 3)], [60, 'A1(2*B/SIN(PSI)):'], [67, fx(F.A1, 3)], [110, 'A2(2*B/DB*SIN(PSI)):'], [117, fx(F.A2, 3)]]));
      D.push("      LES LIGNES D'INFLUENCE DU COEFFICIENT DE FLEXION TRANSVERSALE SONT CALCULEES A PARTIR DE LA TRAVEE DROITE EQUIVALENTE DE ");
      D.push(' ' + rp(fx(F.LS, 3), 12) + 'M DE LONGUEUR ET ' + rp(fx(F.A1, 3), 7) + "M DE LARGEUR.    (PARAMETRE D'ENTRETOISEMENT " + fx(F.theta, 3) + ') ');
      D.push(' ');
      D.push(pad(32, "TERMES MULTIPLICATEURS RELATIFS A L'ETALEMENT LONGITUDINAL DES CHARGES "));
      D.push('  ');
      D.push('                       ETALEMENT      HARMONIQUE 1                          HARMONIQUE 3                          HARMONIQUE 5 ');
      F.etal.forEach(function (e) { D.push(row([[6 + e.nom.length, pad(6, e.nom)], [30, fx(e.c, 3)], [49, fx(e.t[0], 3)], [87, fx(e.t[1], 3)], [125, fx(e.t[2], 3)]])); });
      D.push('  '); D.push(' ');
      F.fibres.forEach(function (fb) {
        D.push("LIGNES D'INFLUENCE DU COEFFICIENT DE FLEXION TRANSVERSALE (PAS 0.500) DE LA FIBRE " + fb.n + (fb.n === 1 ? ' (AXE MECANIQUE)' : ' A ' + pad(7 - fx(fb.y, 3).length, fx(fb.y, 3)) + " DE L'AXE MECANIQUE"));
        D.push('  '); D.push(' ');
        D.push('                  HARMONIQUE 1   HARMONIQUE 3   HARMONIQUE 5 ');
        D.push('                   ( *1000 )      ( *1000 )      ( *1000 ) ');
        var rows = fb.grid.map(function (e, i) { return { e: e, v: fb.vals[i], f: false }; }), hit = false;
        rows.forEach(function (r) { if (Math.abs(r.e - fb.y) < 5e-4) { r.f = true; hit = true; } });
        if (!hit) { rows.push({ e: fb.y, v: fb.star, f: true }); rows.sort(function (a, b) { return a.e - b.e; }); }
        rows.forEach(function (r) { D.push(row([[5, r.f ? 'FIBRE' : ''], [12, fx(r.e, 3)], [29, fx(1000 * r.v[0], 2)], [44, fx(1000 * r.v[1], 2)], [59, fx(1000 * r.v[2], 2)]]) + ' '); });
        D.push('  '); D.push(' ');
      });
      if (F.my) secMyTable(D, F, t);
    }
  }
  function secReductionFT(D, m, R) {
    var FT = R.flexT; if (!FT || !FT[0].my) return;
    D.newPage(); D.push('  ');
    D.push(pad(34, 'ELEMENTS DE REDUCTION DES EFFORTS AU CENTRE MECANIQUE DES DIFFERENTES TRAVEES '));
    for (var i = 0; i < 4; i++) { D.push('  '); D.push(' '); } D.push('  ');
    D.push("     LE CENTRE MECANIQUE D'UNE TRAVEE EST SITUE TRANSVERSALEMENT SUR L'AXE MECANIQUE DE LA SECTION (FIBRE 1). ");
    D.push('     LONGITUDINALEMENT IL EST PRIS AU MILIEU POUR LES TRAVEES INTERMEDIAIRES ');
    D.push(pad(35, "A 0.4 DE LA PORTEE DE L'APPUI DE RIVE POUR LES TRAVEES EXTREMES "));
    D.push('  '); D.push(' '); D.push('  ');
    var hd = L(); FT.forEach(function (F, t) { hd.at(70 + 12 * t, 'TRAVEE ' + (t + 1)); }); D.push(hd.s + ' ');
    D.push('  '); D.push(' ');
    var line = function (lab, f) { var l = L(lab); FT.forEach(function (F, t) { var x = f(F); if (x !== null && x !== undefined) l.at(69 + 12 * t, fx(x, 3)); }); D.push(l.s + ' '); };
    var mxT = function (F, k) { var r = null; F.my.forEach(function (q) { if (r === null || (k === 'max' ? q.pond.max > r : q.pond.min < r)) r = q.pond[k]; }); return r; };
    line('     MOMENT TRANSVERSAL PRINCIPAL PONDERE (T*M/ML)', function (F) { return mxT(F, 'max'); });
    line('', function (F) { return mxT(F, 'min'); });
    D.push('  '); D.push(' ');
    line('     MOMENT LONGITUDINAL PRINCIPAL PONDERE (T*M/ML)', function (F) { return F.prec && F.prec.ML ? F.prec.ML[0] : null; });
    line('', function (F) { return F.prec && F.prec.ML ? F.prec.ML[1] : null; });
    D.push('  '); D.push(' ');
    line('     BIAIS MECANIQUE', function (F) { return F.psi; });
    D.push('  '); D.push(' ');
    line('     EFFORT NORMAL DE PRECONTRAINTE', function (F) { return F.prec ? F.prec.Fes / R.Be : null; });
    line('', function (F) { return F.prec ? F.prec.Fms / R.Be : null; });
  }
  // Section 33 : efforts tranchants et réactions hyperstatiques dus au câble : V = (M_j+1 - M_j)/L avec les moments
  // hyperstatiques M.T max initiaux, M.S max, E.S min (exact 2549) ; réaction = V droite - V gauche.
  function secEffTrHyp(D, m, R) {
    var P = R.prec; if (!P || !P.hypInit || !P.hypServ) return;
    var n = R.n, ph = [['M.T', P.hypInit.max], ['M.S', P.hypServ.msMax], ['E.S', P.hypServ.esMin]];
    var V = function (M) { return R.L.map(function (l, t) { return (M[t + 1] - M[t]) / l; }); };
    D.newPage(); D.push('  ');
    D.push(pad(32, 'EFFORTS TRANCHANTS HYPERSTATIQUES SUR APPUIS DUS AU TRACE DU CABLE '));
    D.push('  '); D.push(' '); D.push('  '); D.push(' '); D.push('  '); D.push(' '); D.push(' ');
    var h1 = L(), h2 = L(), h3 = L(), t;
    for (t = 0; t < n; t++) { h1.at(40 + 11 * t + (t ? 1 : 0), t ? 'APPUI ' + (t + 1) + 'D' : 'APPUI 1'); h2.at(37 + 11 * t, 'ET'); h3.at(41 + 11 * t - (t === n - 1 ? 1 : 0), t === n - 1 ? 'APPUI ' + (n + 1) : 'APPUI ' + (t + 2) + 'G'); }
    D.push(h1.s + ' '); D.push(h2.s + ' '); D.push(h3.s + ' '); D.push('  ');
    ph.forEach(function (q) { var l = L('      EN PHASE ' + q[0]); V(q[1]).forEach(function (x, t2) { l.at(38 + 11 * t2, fx(x, 1)); }); D.push(l.s + ' '); D.push('  '); });
    D.push(' '); D.push('  '); D.push(' '); D.push('  ');
    D.push(pad(34, "REACTIONS D'APPUI HYPERSTATIQUES DUES AU TRACE DU CABLE "));
    D.push('  '); D.push(' ');
    var h4 = L(); for (t = 0; t <= n; t++) h4.at(40 + 11 * t, 'APPUI ' + (t + 1)); D.push(h4.s + ' '); D.push('  ');
    ph.forEach(function (q) { var v = V(q[1]), l = L('      EN PHASE ' + q[0]); for (var i = 0; i <= n; i++) l.at(38 + 11 * i, fx((i < n ? v[i] : 0) - (i > 0 ? v[i - 1] : 0), 1)); D.push(l.s + ' '); D.push('  '); });
  }
  function secFerTransv(D, m, R) {
    var FT = R.flexT; if (!FT || !FT[0].fer) return;
    var vals = function (lab, f, d) { var l = L(lab); FT.forEach(function (F, t) { if (F.fer) l.at(50 + 16 * t, fx(f(F.fer), d)); }); D.push(l.s + ' '); };
    var hdr = function (c0, step) { var l = L(); FT.forEach(function (F, t) { l.at(c0 + step * t, 'TRAVEE ' + (t + 1)); }); D.push(l.s + ' '); };
    D.newPage(); D.push('  ');
    D.push(pad(43, 'FERRAILLAGE DE FLEXION TRANSVERSALE EN TRAVEE '));
    [['inf', 'FACE INFERIEURE '], ['sup', 'FACE SUPERIEURE ']].forEach(function (q) {
      var k = q[0];
      D.push('  '); D.push(q[1]); D.push('  ');
      hdr(50, 16); D.push('  '); D.push(' ');
      [['OX', ' ( PARALLELE A LA DIRECTION DU MOMENT PRINCIPAL MX ) ', '----------'], ['OY', ' ( PARALLELE A LA DIRECTION DU MOMENT PRINCIPAL MY ) ', '----------'],
       ['OX0', " ( PARALLELE AUX CABLES SUR LAQUELLE S'EXERCE LA FLEXION SIMPLE ) ", '-----------']].forEach(function (fa) {
        D.push('          FACETTE ' + fa[0] + fa[1]); D.push('          ' + fa[2] + ' ');
        vals('              MOMENT', function (fe) { return fe[k][fa[0]].M; }, 2);
        if (fa[0] !== 'OX0') vals('              EFFORT NORMAL', function (fe) { return fe[k][fa[0]].N; }, 2);
        vals("              SECTION D'ACIER REQUISE", function (fe) { return fe[k][fa[0]].w; }, 6);
        D.push('  '); D.push(' ');
      });
    });
    D.newPage(); D.push('  ');
    D.push(pad(26, "SECTIONS MINIMALES D'ARMATURES TRANSVERSALES DE BETON ARME DANS LES DIFFERENTES TRAVEES "));
    D.push(pad(32, "(SECTIONS D'ACIER EM M**2 PAR METRE LINEAIRE LONGITUDINAL DE L'OUVRAGE) "));
    D.push('  '); D.push(' '); D.push(' '); D.push('  '); D.push(' ');
    var tab = function (key) {
      D.push('  '); hdr(41, 16); D.push('  ');
      [['sup', 'SUPERIEURE'], ['inf', 'INFERIEURE']].forEach(function (q) { var l = L('          FACE ' + q[1]); FT.forEach(function (F, t) { if (F.fer) l.at(41 + 16 * t, fx(key(F.fer)[q[0]], 6)); }); D.push(l.s + ' '); D.push('  '); });
      D.push(' ');
    };
    D.push("PARALLELEMENT A LA DIRECTION DES LIGNES D'APPUI "); tab(function (fe) { return fe.par; });
    D.push('PERPENDICULAIREMENT AUX BORDS LIBRES '); tab(function (fe) { return fe.perp; });
    D.push('  ');
    D.push('N O T A : ');
    D.push("    * POUR L'OUVRAGE CALCULE IL EST CONSEILLE DE REALISER LE FERRAILLAGE TRANSVERSAL " + (m.values.BIAIS >= 70 ? "PARALLELEMENT A LA DIRECTION DES LIGNES D'APPUI " : 'PERPENDICULAIREMENT AUX BORDS LIBRES '));
    D.push('  '); D.push(' ');
    D.push("    * DANS LE CAS OU L'ON REALISE LE FERRAILLAGE TRANSVERSAL PARALLELEMENT AUX LIGNES D'APPUI ");
    D.push('      LES SECTIONS D\'ARMATURES LONGITUDINALES MINIMALES CI-APRES DOIVENT ETRE VERIFIEES : ');
    tab(function (fe) { return { sup: fe.longi, inf: fe.longi }; });
  }
  function secMyTable(D, F, t) {
    D.newPage();
    D.push('  ');
    D.push('          MOMENTS PRINCIPAUX DE FLEXION TRANSVERSALE MY MAXIMUM ET MINIMUM DES DIFFERENTES SECTIONS SUR LES FIBRES ETUDIEES ');
    D.push(pad(43, 'POUR LA TRAVEE ' + (t + 1) + ' PAR METRE DE LARGEUR '));
    D.push('  '); D.push(' '); D.push('  '); D.push(' ');
    var nb = function (o) { return fx(o.v, 3) + '(' + (o.n < 10 ? ' ' : '') + o.n + ')'; };
    F.my.forEach(function (r) {
      D.push('    FIBRE ' + r.n + ' ');
      D.push('              SECTION          MY CP       MY PREC      MY   A        MY  B       MY TROT      MY   C      MY PONDERE ');
      D.push('  '); D.push(' ');
      [['max', 1], ['min', 0]].forEach(function (q) {
        var k = q[0], l = L();
        if (q[1]) l.at(20, '0.500');
        l.at(36, fx(r.cp[k], 3)); l.at(49, fx(r.prec[k], 3)); l.at(65, nb(r.A[k])); l.at(78, nb(r.B[k]));
        if (r.B[k].typ) l.at(81, r.B[k].typ);
        l.at(91, fx(r.T[k], 3));
        l.at(101, fx(r.C[k].v, 3)); if (r.C[k].nom) l.s += r.C[k].nom;
        l.at(117, fx(r.pond[k], 3));
        D.push(l.s + ' ');
      });
      D.push('  '); D.push(' ');
    });
  }
  function secPrecontrainte(D, m, R) {
    var P = R.prec; if (!P) return;
    if (m.values.CABL !== 4) secCablageAuto(D, m, R);
    secCaracBP(D, m, R);
    if (!P.G) return;
    if (m.values.CABL === 4) { D.newPage(); cotesTable(D, m, R); }
    secEquationsCable(D, m, R);
    secTensions(D, m, R);
    secHypInit(D, m, R);
    secPertesDiff(D, m, R);
    secContraintesMT(D, m, R);
    secContraintesServ(D, m, R, false);
    secContraintesServ(D, m, R, true);
  }

  function renderNote(model, R, opts) {
    var D = new Doc(model, opts);
    D.lines = P.formatBordereau(model).replace(/\n$/, '').split('\n');
    D.push('CONTROLE SOMMAIRE DE COMPATIBILITE DES DONNEES');
    D.push('----------------------------------------------');
    D.push('                                  NOTE DE CALCUL DE PONT DALLE D\'INERTIE CONSTANTE EN BETON PRECONTRAINT');
    D.push('                                             P S I D P - E L ** V E R S I O N  B P E L 9 1');
    D.newPage();
    secGeometrie(D, model, R);
    secMateriaux(D, model, R);
    secAppuis(D, model, R);
    secBaseBP(D, model, R);
    secCharges(D, model, R);
    if (model.values.CABL === 4 && model.cotes && model.cotes.values) secCotesCable(D, model, R);
    secLI(D, model, R);
    secDyn(D, model, R);
    secTransv(D, model, R);
    secDeniv(D, model, R);
    if (R.sol) secSollicitations(D, model, R);
    if (R._shearLines) { D.newPage(); R._shearLines.forEach(function (l) { D.push(l); }); }
    secPrecontrainte(D, model, R);
    secFlexT(D, model, R);
    secReductionFT(D, model, R);
    secFerTransv(D, model, R);
    secEffTrHyp(D, model, R);
    if (R.deform) secDeform(D, model, R);
    secCotesFinales(D, model, R);
    D.newPage();
    D.push(pad(40, 'FIN DE LA NOTE DE CALCUL') + pad(62, 'V98244'));
    return D.lines.join('\n') + '\n';
  }

  var api = { renderNote: renderNote, fx: fx };
  root.PSIDP_NOTE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
