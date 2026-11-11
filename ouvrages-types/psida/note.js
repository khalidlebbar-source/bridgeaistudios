/* PSIDA-EL — génération de la note de calcul au format du listing SETRA.
 * renderNote(modele, resultats, {numero, date}) -> texte. Expose globalThis.PSIDA.renderNote.
 * Les pages sont séparées par un saut de page (\f) ; chaque page commence par l'en-tête SETRA
 * « PSIDAEL nnnn  TITRE / jj  mm  aa / PAGE  p ».
 */
(function (G) {
  'use strict';
  const pad = (s, w) => { s = String(s); return s.length >= w ? s : ' '.repeat(w - s.length) + s; };
  const padR = (s, w) => { s = String(s); return s.length >= w ? s : s + ' '.repeat(w - s.length); };
  const f = (v, w, d) => pad(fx(v, d), w);
  // v19 : listings de la version 2006 du programme (bordereau A6 EDROI F6.3, listings 2007–2008) : égalités exactes arrondies
  // en s'éloignant de zéro (20,125 -> 20.13 ; -2,625 -> -2.63) ; versions ultérieures : demi-pair. Crochet PSIDA_RNDV = 0 : demi-pair partout.
  let RND_AWAY = false;
  function fx(v, d) { if (v == null || !isFinite(v)) return '*'.repeat(Math.max(1, d + 2)); v = Math.fround(+v);
    // arrondi Fortran : demi-pair sur les égalités exactes (0,625 -> 0.62 ; 1,875 -> 1.88)
    const t = v * Math.pow(10, d), fl = Math.floor(t);
    if (t - fl === 0.5 && Number.isFinite(t) && Math.abs(t) < 1e15) { const ev = RND_AWAY ? (t > 0 ? fl + 1 : fl) : fl % 2 === 0 ? fl : fl + 1; v = ev / Math.pow(10, d); }
    let s = v.toFixed(d); if (/^-0\.?0*$/.test(s)) s = s.slice(1); return s; }
  // v24 : entier suivi d'un point (EI, EV...) : valeur en simple précision puis même règle d'égalité que fx
  // (3060 T/M2 : Ei = 3517980,496 -> float32 3517980,5 -> 3517981 avant 2010, 3517980 ensuite). PSIDA_FDOT0 = 1 : Math.round direct.
  const fdot = (v, w) => pad((G.PSIDA_FDOT0 ? Math.round(v) : fx(v, 0)) + '.', w);
  const STAR = ['                                                              *     * ', '                                                                 * '];

  function renderNote(m, r, opt) {
    opt = opt || {};
    // v24 : la date du passage identifie aussi la génération du programme : passages antérieurs à 2010 (3452, 3453, 3488 de 2007–2008)
    // = même arrondi des égalités que la version 2006 (constat v19 sur 3488 ; Ei imprimé 3517981 vs 3517980 en 2022). PSIDA_RNDDATE = 0 : sans.
    const yy = m.date && /^\d\d$/.test(String(m.date.a).trim()) ? +String(m.date.a).trim() : null;
    const preV2010 = G.PSIDA_RNDDATE !== 0 && yy != null && (yy < 10 || yy >= 90);
    RND_AWAY = (m.version === '2006' || preV2010) && G.PSIDA_RNDV !== 0;
    const num = String(opt.numero != null ? opt.numero : (m.numero || '0000')).padStart(4, '0');
    const d = opt.date || m.date || { j: '01', m: '01', a: '00' };
    const dstr = `${d.j}  ${d.m}  ${d.a}`;
    const pages = [];
    let pno = 0;
    function page(title, lines, opts) {
      opts = opts || {};
      const p = opts.noNumber ? null : pno++;
      const head = [padR('PSIDAEL ' + num, 42) + (title || ''), dstr + (opts.sub ? padR('', 40) + opts.sub : '')];
      if (p != null) head.push('PAGE ' + pad(p, 3) + (opts.sub2 ? padR('', 40) + opts.sub2 : ''));
      pages.push(head.concat(lines).join('\n'));
    }
    const n = r.n, L = r.L, A6 = m.lignes.A6, A7 = r._A7 || m.lignes.A7;
    const T = k => 'TRAVEE ' + (k + 1);
    const nPrint = sym(r) ? Math.ceil(n / 2) : n; // pages par travée : symétrie -> moitié

    // ---------------------------------------------------------- bordereau
    pages.push(G.PSIDA.formatBordereau(m).replace(/\n$/, ''));
    pno = 1;
    // ---------------------------------------------------------- page 1
    const p1 = ['', '   CARACTERISTIQUES LONGITUDINALES', '',
      `          NOMBRE DE TRAVEES ${pad(n, 5)}             BIAIS GEOMETRIQUE  = ${f(r.biais, 8, 3)} GRADES           LONGUEUR TOTALE  = ${f(r.longueurTotale, 8, 3)} M`, '',
      '          PORTEES          ' + [r.about, ...L, r.about].map(v => f(v, 10, 3) + ' M ').join(''), '', '',
      '   CARACTERISTIQUES TRANSVERSALES DU TABLIER', '',
      '                           ' + r.profil.map(v => f(v, 10, 3) + ' M ').join(''), '', '',
      '   CARACTERISTIQUES TRANSVERSALES DE LA DALLE PORTEUSE', '',
      `          EN HAUTEUR            H DALLE 1 = ${f(A7.HDALLE1, 6, 3)} M     H DALLE 2 = ${f(A7.HDALLE2, 6, 3)} M     H DALLE 3 = ${f(A7.HDALLE3, 6, 3)} M`, '',
      `          EN LARGEUR            E DALLE 1 = ${f(A7.EDALLE1, 6, 3)} M     E DALLE 2 = ${f(A7.EDALLE2, 6, 3)} M     E DALLE 3 = ${f(A7.EDALLE3, 6, 3)} M`, '',
      `          EPAISSEUR DE LA CHAUSSEE            H CHAU  = ${f(A6.HCHAU, 6, 3)} M`, '', '',
      '   CARACTERISTIQUES DE LA DALLE RECTANGULAIRE EQUIVALENTE', '',
      `                                H DALLE   = ${f(r.section.H, 6, 3)} M     E DALLE   = ${f(r.section.Eeq, 6, 3)} M       INERTIE  = ${f(r.section.I, 9, 6)} M4`, '', '',
      '   DONNEES RELATIVES AUX LIGNES D\'APPUI', '',
      '          NOMBRE D\'APPUIS          ' + r.appuis.map(a => pad(a.nap, 13)).join(''), '',
      '          TYPE                     ' + r.appuis.map(a => pad(a.typ, 13)).join(''), '',
      '          ESPACEMENT D\'AXE EN AXE  ' + r.appuis.map(a => f(a.esp, 11, 2) + ' M').join(''), '',
      '   TASSEMENTS D\'APPUI',
      '                      PROBABLES       ' + r.tassProb.map(v => f(v, 10, 3) + ' M ').join(''),
      '                      ALEATOIRES      ' + r.tassAlea.map(v => f(v, 10, 3) + ' M ').join(''), '',
      `   CHARGES PERMANENTES : OSSATURE = (${f(r.cp.ossMax, 7, 3)} , ${f(r.cp.ossMin, 7, 3)} ) T/ML  ;  QSUP = (${f(r.cp.qsupMax, 7, 3)} , ${f(r.cp.qsupMin, 7, 3)} ) T/ML`,
      '   TASSEMENTS PRIS EN COMPTE', '',
      '   CLASSE DU PONT = ' + r.classe,
      `   CHARGES D'EXPLOITATION :  PSTROT = ${f(r.pstrot, 6, 3)} T/M2    A  BC  ${r.nomBt}        ${r.chargesC.join('  ')}`,
      '   LES COEFFICIENTS DE PRISE EN COMPTE DES CHARGES ( GAMMA Q ) SONT DEFINIS PAR LES D.C. 1979'];
    page("CARACTERISTIQUES PRINCIPALES DE L'OUVRAGE", p1, { sub: 'UNITES : METRE, TONNE , GRADE' });
    // ---------------------------------------------------------- page 2
    const mt = r.mat, phi = mt.phi;
    const p2 = ['', '   ACIER                    ES= 20400000.T/M2                                        LIMITE DE DEFORMATION=0.01000', '',
      '           DIAMETRES UTILISES     ' + phi.map((v, i) => `    PHI${i + 1} ${f(v, 5, 3)} M    `).join(''), '',
      '           LIMITE D\'ELASTICITE    ' + mt.fe.map(v => fdot(v, 10) + '   T/M2  ').join('')];
    if (mt.sigS) p2.push('', '           LIMITE DE TRACTION EN E.L.S    ' + mt.sigS.map(v => fdot(v, 10) + '   T/M2  ').join(''));
    p2.push('', '   BETON                                         TRACTION             COMPRESSION', '',
      `           RESISTANCES CARACTERISTIQUES        ${f(mt.ftj, 8, 2)} T/M2        ${f(mt.fcj, 8, 2)} T/ M2`, '',
      `           COMPRESSION LIMITE EN E.L.S       ${f(mt.sigBc, 8, 2)} T/M2`, '',
      `           MODULE DE DEFORMATION =                 EV=${pad(Math.floor(mt.Ev + 1e-6) + ".", 9)} T/M2          EI=${fdot(mt.Ei, 9)} T/M2`, '',
      `           COEFFICIENTS                              RETRAIT =${f(mt.retrait, 9, 7)}         POISSON = ${f(mt.poisson, 5, 3)}`, '',
      '    EQUIVALENCE ACIER BETON= 15', '', '           LIMITE DE DEFORMATION           DOMAINE 2=0.00350          DOMAINE 3=0.00200', '', '',
      '                                                 PRINCIPES DU FERRAILLAGE PROPOSE', '                                                 ********************************', '', '',
      `                                           ENROB S = ${f(m.lignes.A11.ENROBS, 5, 3)} M           ENROB I = ${f(m.lignes.A11.ENROBI, 5, 3)} M           PSIS = ${f(m.lignes.A10.PSID, 5, 3)}`,
      '    FERRAILLAGE LONGITUDINAL', '',
      `           IL EST CONSTITUE DE GROUPES COMPORTANT AU MAXIMUM ${m.lignes.A11.N1} FERS DE DIAMETRE ${fx(phi[0], 3)}`, '',
      `           AUX EXTREMA DE LA COURBE ENVELOPPE,ON CHOISIT AU MIEUX ENTRE LES DIAMETRES ${fx(phi[0], 3)} ET ${fx(phi[1], 3)} POUR LE FER LE PLUS COURT`, '',
      `           L'ESPACEMENT DE CES GROUPES EST DE ${fx(m.lignes.A11.ESPAC1, 3)} M`, '',
      `           ${m.lignes.A11.N2} DE CES GROUPES SONT CONSIDERES ENSEMBLE POUR REALISER L'EPURE D'ARRET DE BARRES`, '',
      `           CES ${m.lignes.A11.N2} GROUPES CONSTITUTENT UNE POUTRE ELEMENTAIRE DANS LE SENS TRANSVERSAL REPETEE UN NOMBRE ENTIER OU FRACTIONNAIRE`, '',
      '           DE FOIS SELON LA LARGEUR DE LA DALLE', '',
      `           LES FERS LONGITUDINAUX DE CONSTRUCTION SONT DE DIAMETRE ${fx(phi[2], 3)}`, '', '',
      '   FERRAILLAGE TRANSVERSAL', '', `           IL EST CONSTITUE DE FERS DE DIAMETRE ${fx(phi[1], 3)} ET (OU) ${fx(phi[2], 3)} EN TRAVEE`, '', '',
      '   ETRIERS', '', `           ILS SONT REALISES AVEC DES FERS DE DIAMETRE ${fx(phi[3], 3)}`, '', ...(m.lignes.A3.DESSIN ? ['DESSIN AUTOMATIQUE DEMANDE'] : []));
    page('CARACTERISTIQUES DES MATERIAUX UTILISES', p2, { sub: '***************************************' });
    if (m.lignes.A3.LIGNINF === 2) page('', ['', '', 'AVEC LES CARACTERISTIQUES GEOMETRIQUES DU FRANCHISSEMENT ET LES CARACTERISTIQUES MECANIQUES DES MATERIAUX', '',
      '               FIGURANT DANS LE TABLEAU DES DONNES,LA REALISATION D\'UN OUVRAGE EN DALLE ARMEE PLEINE D\'INERTIE CONSTANTE', '',
      '               PARAIT DEVOIR ETRE EXCLUE.', '', '                          NOUS DONNONS CEPENDANT CI-APRES LES LIGNES D\'INFLUENCE DES EFFORTS,LEURS COURBES ENVELOPPES ET', '',
      `               LES FERRAILLAGES QUI EN RESULTENT POUR UNE DALLE D'EPAISSEUR HDALLE=${fx(r.section.H, 3)} M`]);
    // ---------------------------------------------------------- page 4 : charges
    const fissTxt = ['', 'PEU PREJUDICIABLE', 'PREJUDICIABLE', 'TRES PREJUDICIABLE'][mt.fiss] || 'PEU PREJUDICIABLE';
    const p4 = ['                                          LA FISSURATION EST CONSIDEREE COMME ' + fissTxt, '',
      "     LES COEFFICIENTS GAMMA DE L'ETUDE AUX ETATS-LIMITES SONT DEFINIS PAR LES DIRECTIVES COMMUNES DE 1979:", '',
      '              POUR LA PRISE EN COMPTE DES CHARGES D\'EXPLOITATION ( GAMMA QC ) : ',
      '                                                  TROTTOIRS          CHARGE A           CHARGES B      CHARGES PARTICULIERES',
      '                   ETATS LIMITES DE SERVICE         1.000              1.200              1.200              1.000',
      '                   ETATS LIMITES ULTIMES            1.420              1.420              1.420              1.200', '',
      '     AUTRES COEFFICIENTS : GAMMA F3    GAMMA QL1    GAMMA QL2     GAMMA B      THETAC       THETAL       GAMMA S',
      '                            1.125        1.200        0.900        1.500        0.850        1.000        1.150', '',
      '     CHARGES PERMANENTES (EN T/ML)', '',
      `                  VALEURS MOYENNES                          ${f(r.cp.ossMoy, 10, 3)}                  ${f(r.cp.qsupMoy, 10, 3)}                 ${f(r.cp.gMoy, 10, 3)}`, '',
      `                  VALEURS CARACTERISTIQUES MAXIMALES        ${f(r.cp.ossMax, 10, 3)}                  ${f(r.cp.qsupMax, 10, 3)}                 ${f(r.cp.gMax, 10, 3)}`, '',
      `                  VALEURS CARACTERISTIQUES MINIMALES        ${f(r.cp.ossMin, 10, 3)}                  ${f(r.cp.qsupMin, 10, 3)}                 ${f(r.cp.gMin, 10, 3)}`, '',
      `                  >>> POUR MEMOIRE : MASSE VOLUMIQUE DU BETON = ${f(r.cp.masvol, 5, 3)} T/M3`, '',
      `     CHARGES D'EXPLOITATION A CARACTERE NORMAL  -  NOMBRE DE VOIES CHARGEABLES = ${pad(r.nvoies, 2)}`, '',
      r.f61_1960 ? '                  * RELEVANT DU TITRE II DU FASC. 61 (1960)' : `                  * RELEVANT DU TITRE II DU FASC. 61 (1971)  L'OUVRAGE EST DE CLASSE ${r.classe}`, '',
      `                            CHARGE GENERALE DE TROTTOIRS    ${f(r.pstrot, 6, 3)}T/M2`, '',
      `                            CHARGE A(L)  -  LARGEUR NOMINALE D'UNE VOIE = ${f(r.v0, 5, 3)} M`, '',
      '                            CHARGES BC  , ' + r.nomBt, '', '',
      "     CHARGES D'EXPLOITATION A CARACTERE PARTICULIER", '',
      '                  * RELEVANT DU TITRE II DU FASC. 61 (1971) ', '',
      ...(r.ce.mil === 4 ? ['                            CONVOI MILITAIRE TYPE MC 120', ''] : r.ce.mil === 3 ? ['                            CONVOI MILITAIRE TYPE MC 80', ''] : []),
      ...(r.ce.exc === 2 ? ['                            CONVOIS EXCEPTIONNELS TYPES D ET E'] : r.ce.exc === 1 ? ['                            CONVOI EXCEPTIONNEL TYPE D'] : [])];
    page("ETAT-LIMITE D'OUVERTURE DES FISSURES", p4, { sub: '************************************' });
    // ---------------------------------------------------------- page 5 : LI moments sur appuis
    const hdrT = '             FORCE DANS LA    ' + L.map((_, s) => pad(T(s), 17)).join('');
    const p5 = [...STAR, '', hdrT, 'SECTION SUR', ''];
    for (const a of r.liAppuis) ['A', 'B', 'C'].forEach((c, k) => p5.push((k === 1 ? padR('      APPUI ' + (a.k + 1), 26) : ' '.repeat(26)) + c + a.coefs.map((cc, s) => f(cc[k], s ? 17 : 14, 6)).join(''), ...(k === 2 ? [''] : [])));
    p5.push('', '                           AIRES DES LIGNES D INFLUENCE DES MOMENTS FLECHISSANTS SUR APPUIS', '',
      '             AIRE TOTALE      ' + L.map((_, s) => pad(T(s), 17)).join(''), 'SECTION SUR', '');
    for (const a of r.liAppuis) p5.push(padR('      APPUI ' + (a.k + 1), 13) + f(a.aires.reduce((p, q) => p + q, 0), 8, 3) + a.aires.map(v => f(v, s17(a.aires, v), 3)).join(''), '');
    p5.push('', '                             ABSCISSES DES FOYERS PAR RAPPORT A L\'APPUI DE GAUCHE DE LA TRAVEE', '',
      '                              ' + L.map((_, s) => pad(T(s), 17)).join(''), '',
      '      FOYER DE GAUCHE         ' + r.foyers.map(x => x.g == null ? ' '.repeat(17) : f(x.g, 17, 3)).join(''), '',
      '      FOYER DE DROITE         ' + r.foyers.map(x => x.d == null ? ' '.repeat(17) : f(x.d, 17, 3)).join(''));
    page("EQUATIONS DES LIGNES D'INFLUENCE DES MOMENTS FLECHISSANTS SUR APPUIS", p5, { sub2: 'CUBIQUE DE LA FORME  A*X**3 + B*X**2 + C*X' });
    // ---------------------------------------------------------- LI en travée
    for (let i = 0; i < n; i++) {
      const cols = []; for (let s = 0; s < n; s++) { if (s === i) cols.push(T(s) + 'G', T(s) + 'D'); else cols.push(T(s)); }
      const pl = [...STAR, '', '           ABSCISSE', '  SECTION   CUMULEE     ' + cols.map(c => pad(c, 14)).join(''), ''];
      for (const sct of r.liTravee[i]) {
        const vals = []; for (const c of sct.cols) { if (c.s === i) vals.push(c.G, c.D); else vals.push(c.c); }
        ['A', 'B', 'C'].forEach((c, k) => pl.push((k === 1 ? '     ' + fx(sct.a, 2) + 'L' + f(sct.x, 7, 3) + '   ' : ' '.repeat(20)) + c + vals.map((v, j) => f(v[k], j ? 14 : 13, 6)).join('')));
        pl.push('');
      }
      page('EQUATIONS DES LIGNES D INFLUENCE DES MOMENTS FLECHISSANTS EN ' + T(i), pl, { sub2: 'CUBIQUE DE LA FORME  A*X**3 + B*X**2 + C*X + D' });
      const pz = [...STAR, '', '  SECTION  ABSCISSE   ABSCISSE   AIRE A   AIRE A   AIRE TOTALE', '            CUMULEE    DU ZERO   GAUCHE   DROITE   EN ' + T(i), ''];
      for (const sct of r.liTravee[i]) if (sct.zero) pz.push('     ' + fx(sct.a, 2) + 'L' + f(sct.x, 7, 3) + f(sct.zero.x, 11, 3) + f(sct.zero.ag, 9, 3) + f(sct.zero.ad, 9, 3) + f(sct.aires[i], 11, 3), '');
      pz.push('', '                            AIRES DES LIGNES D\'INFLUENCE DES MOMENTS FLECHISSANTS EN ' + T(i), '',
        '           ABSCISSE', '  SECTION   CUMULEE     AIRE TOTALE   ' + L.map((_, s) => pad(T(s), 14)).join(''), '');
      for (const sct of r.liTravee[i]) pz.push('     ' + fx(sct.a, 2) + 'L' + f(sct.x, 7, 3) + f(sct.total, 15, 3) + sct.aires.map(v => f(v, 14, 3)).join(''), '');
      page('ZEROS DES LIGNES D INFLUENCE ET AIRES PARTIELLES EN ' + T(i), pz);
    }
    // ---------------------------------------------------------- LI efforts tranchants
    const pv = [...STAR, '', hdrT, '', 'SECTION DANS LA', ''];
    r.liV.forEach((v, i) => ['A', 'B', 'C'].forEach((c, k) => pv.push((k === 1 ? padR('     ' + T(i), 26) : ' '.repeat(26)) + c + v.coefs.map((cc, s) => f(cc[k], s ? 17 : 14, 6)).join(''), ...(k === 2 ? [''] : []))));
    pv.push('', '                              AIRES DES LIGNES D INFLUENCE DES EFFORTS TRANCHANTS SUR APPUIS', '',
      '                    AIRE TOTALE ' + L.map((_, s) => pad(T(s), 17)).join(''), '');
    r.liV.forEach((v, i) => {
      pv.push(padR(T(i) + ' COTE GAUCHE', 22) + f(sum(v.airesG), 10, 3) + v.airesG.map(x => f(x, 10, 3)).join(''));
      pv.push(padR('         COTE DROIT', 22) + f(sum(v.airesD), 10, 3) + v.airesD.map(x => f(x, 10, 3)).join(''), '');
    });
    page('EQUATIONS DES LIGNES D INFLUENCE DES EFFORTS TRANCHANTS', pv, { sub: 'CUBIQUE DE LA FORME  A*X**3 + B*X**2 + C*X + D' });
    // ---------------------------------------------------------- LI réactions
    const pr = [...STAR, '', hdrT, ''];
    r.liR.forEach((v, k) => ['A', 'B', 'C'].forEach((c, j) => pr.push((j === 1 ? padR('      APPUI ' + (k + 1), 26) : ' '.repeat(26)) + c + v.coefs.map((cc, s) => f(cc[j], s ? 17 : 14, 6)).join(''), ...(j === 2 ? [''] : []))));
    pr.push('', '                                  AIRES DES LIGNES D INFLUENCE DES REACTIONS D\'APPUIS', '',
      '           AIRE TOTALE          ABOUT  ' + L.map((_, s) => pad(T(s), 15)).join(''), '');
    r.liR.forEach((v, k) => pr.push(padR('APPUI ' + (k + 1), 9) + f(v.total, 14, 3) + (k === 0 || k === n ? f(v.about, 15, 3) : ' '.repeat(15)) + v.aires.map(x => f(x, 15, 3)).join(''), ''));
    page('EQUATIONS DES LIGNES D INFLUENCE DES REACTIONS D APPUIS', pr, { sub: 'CUBIQUE DE LA FORME  A*X**3 + B*X**2 + C*X +  D' });
    // ---------------------------------------------------------- dénivellations
    const pt = ['', '                      ' + Array.from({ length: n + 1 }, (_, k) => pad('APPUI ' + pad(k + 1, 3), 15)).join(''), '  MOMENTS SUR APPUIS', ''];
    for (let j = 1; j < n; j++) pt.push(padR('            APPUI ' + pad(j + 1, 3), 22) + r.tass.M.map(Mk => f(Mk[j], 15, 2)).join(''), '');
    pt.push('', '  REACTION D\'APPUIS', '');
    for (let j = 0; j <= n; j++) pt.push(padR('            APPUI ' + pad(j + 1, 3), 22) + r.tass.R.map(Rk => f(Rk[j], 15, 2)).join(''), '');
    pt.push('   >> NOTA - LE MODULE DE DEFORMATION UTILISE POUR LE CALCUL DES MOMENTS SUR APPUIS DUS A DES DENIVELLATIONS D\'APPUI EST LE MODULE', '',
      `             DE DEFORMATION INSTANTANEE EI=${fdot(mt.Ei, 9)} T/M2`, '',
      'TASSEMENTS PROBABLES  ' + r.tassProb.map(v => f(v, 15, 3)).join(''), '',
      'TASSEMENTS ALEATOIRES ' + r.tassAlea.map(v => f(v, 15, 3)).join(''), '',
      `             LE MODULE DE DEFORMATION DU BETON UTILISE EST EGAL A ${f(1 / r.young, 5, 3)} FOIS LA VALEUR DU`);
    page("MOMENTS SUR APPUIS ET REACTIONS D'APPUIS DUS AUX DENIVELLATIONS D'APPUI", pt, { sub2: 'EN FONCTION D\'UNE DENIVELLATION             D\'APPUI DE 1 CM' });
    // ---------------------------------------------------------- CP + CMD
    const cnames = r.chargesC.filter(c => /MC/.test(c)).concat([]);
    const pc = [...STAR, '', '                                                                          MAX           MIN', '',
      `                                           OSSATURE                    ${f(r.cp.ossMax, 8, 3)}       ${f(r.cp.ossMin, 8, 3)}`, '',
      `                                           SUPERSTRUCTURE              ${f(r.cp.qsupMax, 8, 3)}       ${f(r.cp.qsupMin, 8, 3)}`, '',
      `                                           TOTAL                       ${f(r.cp.gMax, 8, 3)}       ${f(r.cp.gMin, 8, 3)}`, '', '',
      '                                               COEFFICIENTS DE MAJORATION DYNAMIQUE', '',
      '             PORTEE    CP            BC              ' + r.nomBt + '            ' + r.chargesC.join('          '), ''];
    r.cmd.forEach((c, s) => {
      let l = '   ' + T(s) + f(c.L, 9, 3) + fdot(c.G, 7) + '    ' + fdot(c.Sbc, 6) + f(c.bc, 8, 3) + '    ****' + f(c.bt, 8, 3);
      for (const cn of r.chargesC) l += /CVOI/.test(cn) ? '    ****   1.000' : fdot(c.Smc, 8) + f(c.mc, 8, 3);
      pc.push(l, '', '');
    });
    pc.push('                                              COEFFICIENTS DE MAJORATION DYNAMIQUE SUR APPUIS', '',
      '                    ' + Array.from({ length: n + 1 }, (_, k) => pad('APPUI ' + (k + 1), 16)).join(''), '',
      padR('   BC', 20) + r.cmdAppui.map(a => f(a.bc, 16, 3)).join(''), '',
      padR('   ' + r.nomBt, 20) + r.cmdAppui.map(a => f(a.bc, 16, 3)).join(''), '');
    for (const cn of r.chargesC) pc.push(padR('   ' + cn, 20) + r.cmdAppui.map(a => f(/CVOI/.test(cn) ? (a.end ? 1.1 : 1) : a.mc, 16, 3)).join(''), '');
    page('DENSITE DE CHARGE PERMANENTE', pc, { sub2: 'POIDS AU METRE' });
    // ---------------------------------------------------------- Guyon-Massonnet
    const cHdr = '                        TROTTOIRS    A(' + r.nvoies + '  /' + r.nvoies + '  )   BC (2  /2  )   ' + r.nomBt + ' (2  /2  )' + r.chargesC.map(c => pad(c, 14)).join('');
    const cVal = (o) => '     COEFFICIENTS    ' + [o.trot, o.A, o.Bc, o.Bt].map(v => f(v, 14, 3)).join('') + r.chargesC.map(c => f(/CVOI/.test(c) ? o.CV : o.Mc, 14, 3)).join('');
    for (let s = 0; s < nPrint; s++) {
      const g = r.gm[s];
      const pg = ['                                                             *    * ', '                                                                * ', ''];
      for (const fb of g.fibres) {
        pg.push('    ' + (fb.y === 0 ? 'AXE DE LA CHAUSSEE' : 'FIBRE ' + f(fb.y, 6, 2) + "M DE L'AXE DE L'EXTRADOS"), "      LIGNE D''INFLUENCE", '        (PAS DE 0.125)');
        for (let k = 0; k < fb.ligne.length; k += 10) pg.push('                        ' + fb.ligne.slice(k, k + 10).map(v => f(v, 10, 4)).join(''));
        pg.push('', cHdr, '', cVal(fb), '');
      }
      pg.push('', '      NOTA:POUR CES CALCULS,LA DALLE EST SUPPOSEE DE SECTION PARFAITEMENT RECTANGULAIRE DE LARGEUR ' + f(g.Weq, 6, 3));
      page('COEFFICIENTS CORRECTIFS DE REPARTITION TRANSVERSALE EN ' + T(s), pg,
        { sub2: '               PORTEE EQUIVALENTE' + f(g.Leq, 7, 3) + '                              PARAMETRE D ENTRETOISEMENT ' + f(g.theta, 5, 2) });
    }
    const prc = [...STAR, '', '                        TROTTOIRS           A            BC             ' + r.nomBt + r.chargesC.map(c => pad(c, 14)).join(''), ''];
    r.gm.forEach((g, s) => prc.push('         ' + T(s) + '   ' + [g.coef.trot, g.coef.A, g.coef.Bc, g.coef.Bt].map(v => f(v, 14, 3)).join('') + r.chargesC.map(c => f(/CVOI/.test(c) ? g.coef.CV : g.coef.Mc, 14, 3)).join(''), ''));
    page('RECAPITULATION DES COEFFICIENTS CORRECTIFS DE REPARTITION TRANSVERSALE', prc);
    // ---------------------------------------------------------- moments fléchissants
    for (let i = 0; i < nPrint; i++) {
      const pm = [...STAR, '', 'SECTION ABSCISSE   CHARGE     TASSEMENTS             SURCHARGES  NON  PONDEREES          MOMENTS  EXTREMES       SECTIONS  D\'ACIER',
        '                                                  A         B       C.E.    TROTTOIRS    E.L.S.     E.L.U.       E.L.S.     E.L.U.', ''];
      for (const s of r.moments[i]) {
        const l = s.live;
        pm.push(' ' + fx(s.a, 2) + 'L' + f(s.x, 9, 3) + f(s.G.up, 12, 2) + f(s.T, 9, 2) + '         ' + f(l.A.pos.v, 9, 2) + f(l.B.max.v, 10, 2) + f(l.C.max.v, 10, 2) + f(l.T.max, 8, 2) + f(s.els.max, 14, 2) + f(s.elu.max, 11, 2) + f(s.as ? s.as.elsMax : 0, 12, 4) + f(s.as ? s.as.eluMax : 0, 11, 4));
        pm.push(' '.repeat(15) + f(s.G.dn, 12, 2) + f(-s.T, 9, 2) + '         ' + f(l.A.neg.v, 9, 2) + f(l.B.min.v, 10, 2) + f(l.C.min.v, 10, 2) + f(l.T.min, 8, 2) + f(s.els.min, 14, 2) + f(s.elu.min, 11, 2) + f(s.as ? s.as.elsMin : 0, 12, 4) + f(s.as ? s.as.eluMin : 0, 11, 4), '');
      }
      page("MOMENTS FLECHISSANTS ET SECTIONS D'ACIER EN TRAVEE  " + (i + 1), pm, { sub2: 'SOUS LA CHARGE PERMANENTE LES TASSEMENTS ET LES DIFFERENTS CAS DE SURCHARGE' });
      const pp = [...STAR, '', '            SECTION  ABSCISSE               SURCHARGE A             S U R C H A R G E  B         CHAR',
        '                      CUMULEE                                    SENS DE      ABSCISSES        ABSCISSE',
        '                                        LONGUEURS CHARGEES       MARCHE      DES CAMIONS', ''];
      for (const sc of r.moments[i]) {
        if (Math.abs(sc.a - 0.05) < 1e-9 || Math.abs(sc.a - 0.95) < 1e-9 || (sc.a === 0 && i === 0)) continue;
        const l = sc.live;
        const row = (A, B, C, first) => {
          const AO = G.PSIDA_AORD ?? 1, Alf = (l) => 0.23 + 36 / (l + 12), kAs = (g) => (r.gm && r.gm[g.s] ? r.gm[g.s].coef.A : 1);
          const key = AO === 1 ? (g => Alf(g.l) * Math.abs(g.area)) : AO === 2 ? (g => Math.abs(g.area) * kAs(g)) : AO === 3 ? (g => g.l) : AO === 4 ? (g => Alf(g.l) * Math.abs(g.area) * kAs(g)) : (g => Math.abs(g.area));
          const lens = (A.segs || []).slice().sort((p, q) => key(q) - key(p)).map(g => fx(g.l, 2));
          let t = (first ? '        ' + fx(sc.a, 2) + ' L' + f(sc.x, 11, 3) + '     ' : ' '.repeat(30)) + padR(lens.map(v => pad(v, 7)).join(''), 30);
          t += B && B.pos ? padR('    ' + B.typ, 10) + padR(B.sens, 4) + padR(B.pos.map(v => f(v + (B.typ === 'BC' && B.sens === 'DG' ? 0 : 0), 7, 2)).join(''), 19) : ' '.repeat(33);
          if (C && C.pos) t += padR(C.nom, 7) + C.pos.slice().sort((p, q) => q - p).map(v => f(v, 7, 2)).join('');
          return t;
        };
        pp.push(row(l.A.pos, l.B.max, l.C.max, true), row(l.A.neg, l.B.min, l.C.min, false), '');
      }
      page('POSITIONS DES SURCHARGES CORRESPONDANT AUX MOMENTS FLECHISSANTS EXTREMES EN TRAVEE ' + (i + 1), pp);
    }
    if (r.flexT) for (let sp = 0; sp < nPrint; sp++) {
      const F = r.flexT[sp];
      const variantes = [[mt.poisson, F.fibres, F.my]]; if (F.fibres0) variantes.push([0, F.fibres0, F.my0]);
      for (const [nu, fibres, my] of variantes) {
      const pf = [`                    COEFFICIENT DE POISSON :${f(nu, 5, 3)}     A1(2*B/SIN(PSI)):${f(F.A1, 7, 3)}                     A2(2*B/DB*SIN(PSI)):${f(F.A2, 7, 3)}`,
        '      LES LIGNES D INFLUENCE DU COEFFICIENT DE FLEXION TRANSVERSALE SONT CALCULEES A PARTIR DE LA TRAVEE DROITE EQUIVALENTE DE',
        `      ${f(F.LS, 7, 3)}M DE LONGUEUR ET ${f(2 * F.bS, 7, 3)}M DE LARGEUR.(PARAMETRE D ENTRETOISEMENT ${f(F.theta, 7, 3)})`,
        '                                                                  * ', '                                TERMES MULTIPLICATEURS RELATIFS A L\'ETALEMENT LONGITUDINAL DES CHARGES', '',
        '                       ETALEMENT      HARMONIQUE 1                          HARMONIQUE 3                          HARMONIQUE 5'];
      for (const e of F.etal) pf.push('      ' + padR(e.nom, 15) + f(e.c, 8, 3) + f(e.t[0], 21, 3) + f(e.t[1], 38, 3) + f(e.t[2], 38, 3));
      for (const fb of fibres) {
        pf.push('                                                                   * ', '                                LIGNES D\'INFLUENCE DU COEFFICIENT DE FLEXION TRANSVERSALE (PAS 0.500)',
          '                                                    DE LA FIBRE ' + fb.n + (fb.y === 0 ? '   (AXE MECANIQUE)' : '   A ' + f(fb.y, 7, 3) + 'DE L\'AXE MECANIQUE'), '');
        fb.H.forEach((h, k) => { pf.push('      HARMONIQUE ' + [1, 3, 5][k], '          ' + h.vals.slice(0, 14).map(v => f(v, 8, 4)).join(''), f(h.star, 9, 4) + '* ' + h.vals.slice(14).map(v => f(v, 8, 4)).join(''), ''); });
      }
      pf.push('     NOTA : LE CHIFFRE MARQUE D\'UN ASTERISQUE CORRESPOND A L\'ORDONNEE AU DROIT DE LA FIBRE CONSIDEREE');
      page('ELEMENTS DE CALCUL DU MOMENT DE FLEXION TRANSVERSALE EN TRAVEE  ' + (sp + 1), pf,
        { sub2: `BIAIS MECANIQUE (PSI):${f(F.psi, 7, 3)}  LONGUEUR EQUIVALENTE BIAISE (DB):${f(F.Leq, 6, 3)}   LARGEUR EQUIVALENTE DROITE :${f(F.Weq, 6, 3)}` });
      if (my) {
        const pm = ['', '', '', '', '          MOMENTS PRINCIPAUX DE FLEXION TRANSVERSALE MY MAXIMUM ET MINIMUM DES DIFFERENTES SECTIONS SUR LES FIBRES ETUDIEES',
          `                          POUR LA TRAVEE ${pad(sp + 1, 2)}  PAR METRE DE LARGEUR , COEFFICIENT DE POISSON = ${f(nu, 6, 2)}`, '', STAR[0], '', STAR[1], '', ''];
        const nb = x => '(' + pad(x.n, 2) + ')';
        for (const y of my) {
          pm.push('', '    FIBRE ' + y.n,
            '              SECTION          MY CP                    MY   A        MY  B       MY TROT      MY   C                MY PONDERE',
            '                                                                                                                   E.L.S.    E.L.U.', '');
          for (const [k, lab] of [['max', '               0.500'], ['min', '                    ']]) {
            pm.push(lab + f(y.cp[k], 16, 3) + f(y.A[k].v, 25, 3) + nb(y.A[k]) + f(y.B[k].v, 9, 3) + nb(y.B[k]) + ' ' + padR(y.B[k].typ, 2) +
              f(y.T[k], 9, 3) + f(y.C[k].v, 10, 3) + ' ' + padR(y.C[k].nom, 6) + f(y.els[k], 14, 3) + f(y.elu[k], 10, 3));
          }
          pm.push('');
        }
        page('', pm);
      }
      }
    }
    if (r.deformations) for (let sp = 0; sp < n; sp++) {
      const D = r.deformations[sp];
      const pd = ['                                                             *   *                               EV =' + pad(Math.floor(mt.Ev + 1e-6) + '.', 8) + ' T/M2', '                                                               * ', '',
        '                               DEFORMEES DU TABLIER POUR LES DIFFERENTS CAS DE CHARGE (EN MILLIMETRES)', '', '',
        '       SECTION  CHARGE PERMANENTE                  SURCHARGES DANS CHAQUE TRAVEE (DEFORMEES INSTANTANEES)', '',
        '                INSTANT  FINALE   ' + L.map((_, j) => pad(T(j), 15)).join(''), '                                 ' + L.map(() => '    A      48T  ').join(''), ''];
      for (const row of D.fl) pd.push('        ' + fx(row[0], 2) + 'L' + f(row[1], 8, 1) + f(row[2], 9, 1) + row.slice(3).map((v, j) => f(v, j % 2 ? 6 : 10, 1)).join(''), '');
      pd.push('', '', '              VARIATIONS RELATIVES DE LONGUEUR DE LA FIBRE INFERIEURE POUR LES DIFFERENTS CAS DE CHARGE (X 10**4)', '', '',
        '         ' + D.eps.map(v => f(v, 8, 1)).join(''), '', '', '',
        '              ROTATIONS SUR APPUIS DU TABLIER SOUS L\'EFFET DES DIFFERENTS CAS DE CHARGE (EN RADIANS X 10**3)', '', '',
        '       APP G' + D.rotG.map(v => f(v, 8, 1)).join(''), '', '', '       APP D' + D.rotD.map(v => f(v, 8, 1)).join(''));
      page('', ['                                                DEFORMATION DU TABLIER - ' + T(sp) + '                EI =' + pad((G.PSIDA_FDOT0 ? Math.round(mt.Ei + 1e-3) : fx(mt.Ei, 0)) + '.', 8) + ' T/M2', ...pd]);
    }
    if (r.effortsTranchants) {
      const pv2 = [...STAR, '', '', '                                      CHARGE      CHARGE A      CHARGE B       CHARGE C      TROTTOIRS        ETATS-LIMITES',
        '                                    PERMANENTE                                                              SERVICE    ULTIME', ''];
      for (let i = 0; i < nPrint; i++) r.effortsTranchants[i].forEach((v, j) => {
        const l = v.live;
        pv2.push((j === 0 ? '             ' + T(i) + ' COTE GAUCHE' : '                      COTE DROIT ') + f(v.G.up, 11, 1) + [l.A.pos.v, l.B.max.v, l.C.max.v, l.T.max].map(x => f(x, 14, 1)).join('') + f(v.els.max, 14, 1) + f(v.elu.max, 11, 1));
        pv2.push(' '.repeat(33) + f(v.G.dn, 11, 1) + [l.A.neg.v, l.B.min.v, l.C.min.v, l.T.min].map(x => f(x, 14, 1)).join('') + f(v.els.min, 14, 1) + f(v.elu.min, 11, 1), '');
      });
      page('EFFORTS TRANCHANTS SUR APPUIS', pv2, { sub2: 'SOUS LA CHARGE PERMANENTE ET LES DIFFERENTS CAS DE SURCHARGE POUR LA LARGEUR TOTALE' });
      const slots = ['CVOI.D', 'CVOI.E', 'MC.120', 'MC.80'].filter(c => r.chargesC.includes(c));
      const pr2 = [...STAR, "              CHARGES  TROTTOIRS   A ( L )       C H A R G E S   B                 C H A R G E S   C                ETATS-LIMITES",
        '               PERM.                           BC        ' + r.nomBt + '                ' + slots.map(c => padR(c, 10)).join('') + '              SERVICE   ULTIME', ''];
      const nR = sym(r) ? Math.ceil((n + 1) / 2) : n + 1;
      for (let k = 0; k < nR; k++) {
        const R = r.reactions[k], l = R.live;
        const cv = (mx) => { const o = slots.map(c => { const e = l.CE.find(x => x.nom === c); return e ? (mx ? e.max.v : e.min.v) : 0; }); while (o.length < 4) o.push(0); return o; };
        pr2.push(padR('  APPUI ' + (k + 1), 9) + f(R.G.up, 12, 1) + [l.T.max, l.A.pos.v, l.Bc.max, l.Bt.max, 0, ...cv(true)].map(x => f(x, 10, 1)).join('') + f(R.els.max, 9, 1) + f(R.elu.max, 10, 1));
        pr2.push(' '.repeat(9) + f(R.G.dn, 12, 1) + [l.T.min, l.A.neg.v, l.Bc.min, l.Bt.min, 0, ...cv(false)].map(x => f(x, 10, 1)).join('') + f(R.els.min, 9, 1) + f(R.elu.min, 10, 1), '');
      }
      page('REACTIONS D APPUIS', pr2, { sub2: 'SOUS LA CHARGE PERMANENTE ET LES DIFFERENTS CAS DE SURCHARGE POUR LA LARGEUR TOTALE' });
    }
    // ---------------------------------------------------------- ferraillage (ferraillage.js)
    if (G.PSIDA.renderFer && r.fer) G.PSIDA.renderFer(m, r, { page, f, fx, pad, padR, STAR, num, dstr });
    // ---------------------------------------------------------- résumé + résultats PP73 (partiel)
    const t0 = m.titre[0] || '';
    const ps = ['                                    *** RAPPEL DES CARACTERISTIQUES PRINCIPALES DE L\'OUVRAGE *** ', '',
      `   NOMBRE DE TRAVEES ${pad(n, 19)}                                                               LONGUEUR TOTALE = ${f(r.longueurTotale, 7, 3)} M`,
      '  PORTEES                         ' + [r.about, ...L, r.about].map(v => f(v, 10, 3) + ' M').join(''), '',
      `   BIAIS GEOMETRIQUE (GRADES)               ${f(r.biais, 10, 1)}`, '',
      '   BIAIS MECANIQUE   (GRADES)               ' + (r.flexT || []).map(F => f(F.psi, 10, 1) + '  ').join(''), '',
      '   CARACTERISTIQUES   TABLIER      ' + r.profil.map(v => f(v, 9, 3) + ' M  ').join('') + `      LARGEUR TOTALE = ${f(r.largeurTotale, 7, 3)} M`,
      '   TRANSVERSALES', `                      DALLE PORTEUSE    EXTRADOS=${f(r.section.Eextr, 7, 3)} M   LARGEUR MOYENNE=${f(r.section.Eeq, 7, 3)} M   INTRADOS=${f(r.section.Eintr, 7, 3)} M    EPAISSEUR=${f(r.section.H, 7, 3)} M`, '',
      '   CLASSE DU PONT = ' + r.classe];
    const VF = r.fer && r.fer.verif;
    if (VF && VF.length) {
      const row = (lab, fn, w) => padR(lab, 21) + VF.map(fn).map(v => pad(v, w)).join('') + ' ';
      ps.push('', '                                 *** VERIFICATION DE L\'OUVRAGE AUX SECTIONS LES PLUS SOLLICITEES *** ', '',
        '                          TRAVEE1   APPUI2   TRAVEE2   APPUI3   TRAVEE3   APPUI4   TRAVEE4   APPUI5   TRAVEE5   APPUI6   TRAVEE6 ', '',
        ' * ELS (' + (r.mat.fiss >= 2 ? 'FISSURATION PREJUDICIABLE' : 'FISSURATION PEU NUISIBLE') + ') * ', '', '  * BETON COMPRIME ', '',
        row('    HAUTEUR EN METRE', v => fx(v.y, 3), 10), '', row('    CONTRAINTES EN T/M2', v => Math.round(v.sb) + '.', 10), '',
        '  * ACIER COMPRIME ', '', row('    CONTRAINTES EN T/M2', v => Math.round(v.ss2) + '.', 10), '',
        '  * ACIER TENDU ', '', row('    CONTRAINTES EN T/M2', v => Math.round(v.ss) + '.', 10), '',
        ' * ELU (DEFORMATION EN 0/00) * ', '', row('  * BETON COMPRIME', v => fx(v.ec, 2), 10), '',
        row('  * ACIER COMPRIME', v => fx(v.e2, 2), 10), '', row('  * ACIER TENDU', v => fx(v.es, 2), 10));
    }
    const MT = r.fer && r.fer.metre;
    if (MT) {
      ps.push('', '                                                *** AVANT-METRE RECAPITULATIF *** ',
        "                                 (FERRAILLAGE TRANSVERSAL DISPOSE PARALLELEMENT AUX LIGNES D'APPUI) ", '',
        '   ACIERS          DIAMETRE       LONGITUDINAUX        TRANSVERSAUX            ETRIERS              TOTAL ', '');
      for (let i = 0; i < 3; i++) ps.push('                     PHI' + (i + 1) + f(MT.lon[i], 18, 3) + ' T' + f(MT.tra[i], 18, 3) + ' T' + ' '.repeat(32) + f(MT.tot[i], 6, 3) + ' T ');
      ps.push('                     PHI4' + ' '.repeat(52) + f(MT.etr, 9, 3) + ' T' + f(MT.tot[3], 18, 3) + ' T ', '',
        '                     POIDS TOTAL DES ACIERS' + ' '.repeat(69) + f(MT.ptot, 9, 3) + ' T ', '',
        '    BETONS           BETON POUR BETON ARME' + ' '.repeat(71) + pad(Math.round(MT.beton) + '.', 9) + '    M3 ', '',
        '                     COFFRAGES DE LA SOUS-DALLE' + ' '.repeat(46) + pad(Math.round(MT.sousDalle) + '.', 9) + '   M2 ',
        '                     AUTRES COFFRAGES' + ' '.repeat(56) + pad(Math.round(MT.autres) + '.', 9) + '   M2' + pad(Math.round(MT.sousDalle) + Math.round(MT.autres) + '.', 14) + '    M2 ', '',
        "                     POIDS D'ACIER PAR M3 DE BETON" + ' '.repeat(62) + f(MT.ratio, 9, 3) + ' T ');
    }
    page(t0, ps, { sub: m.titre[1] || '' });
    if (r.reactions) {
      const R = r.reactions, nA = n + 1, ap = Array.from({ length: nA }, (_, k) => pad('APPUI' + (k + 1), 11)).join('');
      const row = (lab, fn) => padR(lab, 52) + R.map(x => f(fn(x), 11, 2)).join('');
      const cmax = x => Math.max(0, ...x.live.CE.map(c => c.max.v)), cmin = x => Math.min(0, ...x.live.CE.map(c => c.min.v));
      const pp = ['                                     RESULTATS UTILISABLES EN DONNEES POUR LE PROGRAMME PP73 ', '                                                              *     * ', '',
        `    BIAIS GEOMETRIQUE (GRADES)=${f(r.biais, 8, 3)}       PORTEES ` + L.map(v => f(v, 10, 3) + ' M').join(''), '',
        `    LARGEUR D'INTRADOS(ELARGT)=${f(r.section.Eintr, 8, 3)} M                                         LARGEUR SURCHARGEABLE(ELARGA)=${f(r.Lch, 8, 3)} M`,
        '                                                                 * ', '                                                          REACTIONS D\'APPUI', '                                                                 * ',
        '                                                    ' + ap, '',
        row('    CHARGE       AVANT REMBLAIEMENT     ( QCP1 )', x => r.cp.ossMoy * (x.G.up / r.cp.gMax)),
        row('    PERMANENTE   TOTALE                 ( QCP2 )', x => r.cp.gMoy * (x.G.up / r.cp.gMax)), '',
        row('    CHARGE A  NON PONDEREE              (PAMAX )', x => x.live.A.pos.v + x.live.T.max),
        row('    (TROTTOIRS COMPRIS)                 (PAMIN )', x => x.live.A.neg.v + x.live.T.min), '',
        row('    CHARGE BC NON PONDEREE              (PBCMAX)', x => Math.max(x.live.Bc.max, x.live.Bt.max) + x.live.T.max),
        row('    (TROTTOIRS COMPRIS)                 (PBCMIN)', x => Math.min(x.live.Bc.min, x.live.Bt.min) + x.live.T.min), '',
        row('    CHARGE MILITAIRE NON PONDEREE       (PCMMAX)', x => cmax(x) + x.live.T.max),
        row('    (TROTTOIRS COMPRIS)                 (PCMMIN)', x => cmin(x) + x.live.T.min)];
      const AP = r.fer && r.fer.appareils;
      if (AP) {
        const ra = (lab, fn, w, d) => padR(lab, 52) + AP.map(a => d == null ? pad(fn(a), w) : f(fn(a), w, d)).join('');
        const mx = (a, re) => Math.max(1, ...a.cas.filter(c => re.test(c)).map(c => a.coef[c]));
        pp.push('                                                                 * ', "                                                  GEOMETRIE DES APPAREILS D'APPUI", '                                                                 * ',
          ra("  * TYPE DE L'APPAREIL D'APPUI          (TYPAP)", a => a.typ, 11), ra("    NOMBRE D'APPAREILS D'APPUI          ( NAP )", a => a.nap, 11),
          ra("    ESPACEMENT D'AXE EN AXE             (ESPAP)", a => a.esp, 11, 3), ra('    DIMENSIONS EN PLAN  LARGEUR         ( DAP )', a => a.larg, 11, 3),
          ra('                        LONGUEUR        ( LAP )', a => a.long, 11, 3),
          "              *  0  SYMBOLISE UNE ARTICULATION PAR SECTION REDUITE DE BETON (ARTICULATION FREYSSINET)",
          "                 1  SYMBOLISE UNE PLAQUE D'APPUI SEMI-MOBILE A BASE D'ELASTOMERES (APPUI NEOPRENE)",
          "                 2  SYMBOLISE TOUT AUTRE TYPE D'APPUI QUE L'UTILISATEUR DEVRA DIMENSIONNER", '                                                                 * ',
          "              COEFFICIENTS D'INEGALITE DE REPARTITION DE LA REACTION D'APPUI ENTRE APPAREILS D'APPUI D'UNE MEME LIGNE D'APPUI", '                                                                 * ',
          ra('    CHARGE PERMANENTE                   (MAJCP)', a => a.coef.CP, 11, 3), ra('    CHARGE A                            (MAJA )', a => a.coef.A, 11, 3),
          ra('    CHARGE BC                           (MAJBC)', a => a.coef.BC, 11, 3), ra('    CHARGE MILITAIRE                    (MAJCM)', a => mx(a, /CVOI|MC/), 11, 3));
      }
      if (r.deformations) {
        const D = r.deformations;
        pp.push('                                                                 * ', '              VARIATIONS RELATIVES DE LONGUEUR DE LA FIBRE INFERIEURE POUR LES DIFFERENTS CAS DE CHARGE (X 10**4 ) ',
          '                                                                 * ', '                                                       ' + L.map((_, j) => pad('TRAVEE' + (j + 1), 11)).join(''), '',
          padR('    SOUS CHARGE PERMANENTE              (EPSCP)', 52) + D.map(d => f(d.eps[1], 11, 2)).join(''), '',
          `    SOUS L'ACTION DES CHARGES , LA VARIATION RELATIVE  MAXIMALE (EPSSUR) EST DE ${f(Math.max(...D.map(d => Math.max(...d.eps.slice(2).map(Math.abs)))), 7, 3)}`);
      }
      page(t0, pp, { sub: m.titre[1] || '' });
      // ------------------------------------------------ PP73 (SUITE ET FIN) : rotations + cartes PP68
      if (r.deformations && AP) {
        const D = r.deformations, nA = n + 1;
        // ROT = max sur les deux signes de |rotation CP finale + plus forte rotation de ce signe sous A seule (une travée)|
        const rot = Array.from({ length: nA }, (_, k) => {
          const Rk = k < n ? D[k].rotG : D[k - 1].rotD; let b = 0;
          for (const sg of [1, -1]) { let mA = 0; for (let j = 0; j < n; j++) { const a = Rk[2 + 2 * j]; if (a * sg > mA * sg) mA = a; } b = Math.max(b, Math.abs(Rk[1] + mA)); }
          return b; });
        const epsSur = Math.max(...D.map(d => Math.max(...d.eps.slice(2).map(Math.abs))));
        const cmax = x => Math.max(0, ...x.live.CE.map(c => c.max.v)), cmin = x => Math.min(0, ...x.live.CE.map(c => c.min.v));
        const mxc = (a, re) => Math.max(1, ...a.cas.filter(c => re.test(c)).map(c => a.coef[c]));
        const carte = k => { const x = R[k], a = AP[k];
          return pad(k + 1, 3) + pad(a.typ, 5) + pad(a.nap, 5) + f(a.long, 7, 3) + f(a.larg, 6, 3) + f(a.esp, 6, 2) + '   *   ' +
            f(a.coef.CP, 6, 3) + f(r.cp.ossMoy * (x.G.up / r.cp.gMax), 7, 2) + f(r.cp.gMoy * (x.G.up / r.cp.gMax), 7, 2) +
            f(a.coef.A, 6, 3) + f(x.live.A.pos.v + x.live.T.max, 7, 2) + f(x.live.A.neg.v + x.live.T.min, 7, 2) +
            f(a.coef.BC, 6, 3) + f(Math.max(x.live.Bc.max, x.live.Bt.max) + x.live.T.max, 7, 2) + f(Math.min(x.live.Bc.min, x.live.Bt.min) + x.live.T.min, 7, 2) +
            f(mxc(a, /CVOI|MC/), 6, 3) + f(cmax(x) + x.live.T.max, 7, 2) + f(cmin(x) + x.live.T.min, 7, 2) + ' '; };
        const HD = '  N0 TYPAP NAP  LAP   DAP  ESPAP NFEUIL MAJCP  QCP1   QCP2  MAJA  PAMAX  PAMIN  MAJBC PBCMAX PBCMIN MAJCM PCMMAX PCMMIN ';
        const S1 = '                                                                 * ', S2 = '                                                              *     * ';
        const pz = ['                                     ROTATIONS MAXIMALES ABSOLUES DU TABLIER SUR APPUIS (X 10**3 ) ', S1, ' ',
          '                           ' + Array.from({ length: nA }, (_, k) => pad('APPUI' + (k + 1), 13)).join('') + ' ', ' ',
          '        ROTATIONS  (ROT)   ' + rot.map((v, k) => f(v, k ? 13 : 8, 2)).join('') + ' ', S2, S1, S2, ' ',
          '                  RESULTATS REGROUPES DANS LES CARTES CORRESPONDANTES DU BORDEREAU DES DONNEES DU PROGRAMME PP68 ', ' '];
        for (const [c, k] of [[6, 0], [8, n]]) pz.push(S1, '                                                              CARTE ' + pad(c, 2) + ' ', S1,
          HD + 'KSEM  QDT', carte(k) + '*.**  *.**', ' ', '  EXCNDT EXCNAP ', '   *.**   *.** ');
        if (n > 1) {
          pz.push(S1, '                                                      CARTES ' + Array.from({ length: n - 1 }, (_, i) => (10 + 2 * i) + ',').join('') + ' ', HD, ' ');
          for (let k = 1; k < n; k++) pz.push(carte(k), ' ');
        } else pz.push(' ');
        pz.push(S1, '                                                              CARTE 26 ', S1,
          '   BIAIS    D1      D2      D3      D4      D5      D6    ELARGT ELARGA  LDALT EXFRBC ',
          f(r.biais, 8, 3) + L.map(v => f(v, 8, 3)).join('') + ' '.repeat(8 * (6 - n)) + f(r.section.Eintr, 7, 2) + f(r.Lch, 7, 2) + '   **.**  **.** ',
          S1, '                                                              CARTE 27 ', S1,
          '  EPSTEM EPSCP1 EPSCP2 EPSCP3 EPSCP4 EPSCP5 EPSCP6 KCP  EPSSUR  ROT1  ROT2  ROT3  ROT4  ROT5  ROT6  ROT7 ',
          '  *.*** ' + D.map(d => f(d.eps[1], 7, 3)).join('') + ' '.repeat(7 * (6 - n)) + '  *.** ' + f(epsSur, 7, 3) + rot.map(v => f(v, 6, 2)).join(''),
          ' ', ' ', '       NOTA  LES DONNEES REPRESENTEES PAR DES ASTERISQUES NE SONT PAS CALCULEES PAR LE PROGRAMME PSI DAEL ');
        page('                   RESULTATS UTILISABLES EN DONNEES POUR LE PROGRAMME PP73 (SUITE ET FIN)'.trim(), pz, { sub: '                      *     * ' });
      }
    }
    return pages.join('\n\f');
  }
  function sum(a) { return a.reduce((p, q) => p + q, 0); }
  function s17() { return 17; }
  function sym(r) { const L = r.L; for (let i = 0; i < L.length; i++) if (Math.abs(L[i] - L[L.length - 1 - i]) > 1e-9) return false; return true; }
  function renderV() { return []; }

  G.PSIDA = Object.assign(G.PSIDA || {}, { renderNote });
  if (typeof module !== 'undefined' && module.exports) module.exports = { renderNote };
})(typeof globalThis !== 'undefined' ? globalThis : this);
