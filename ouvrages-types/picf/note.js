// PICF-EL — rendu de la note de calcul au format du listing SETRA (PICF91 v1.06).
(function (root) {
  const P = (typeof module !== 'undefined' && module.exports) ? require('./parse.js') : root.PICF_PARSE;
  const F = (v, d, w) => { let s = (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toFixed(d); if (d === 0) s += '.'; return w ? s.padStart(w) : s; };
  const pad = (s, n) => String(s).padEnd(n);
  const SEP = '-'.repeat(129);

  function renderNote(model, R, opt) {
    opt = opt || {};
    const d = R.donnees; const num = opt.numero || model.numero || model.num;
    const date = opt.date || (model.date ? model.date.slice(0, 2) + '-' + model.date.slice(2, 4) + '-' + model.date.slice(4, 6) : '');
    const dateP = date.replace(/-/g, '.');
    const out = [];
    let page = 0;
    const newPage = () => { page++; out.push(`  ${pad(model.titreCourt, 85)}PICF-EL NO ${num}-   DU ${date} PAGE ${String(page).padStart(page < 10 ? 5 : 2)}`); out.push(SEP); };
    const L = R.geom.L, H = R.geom.H, hasEC = !!R.charges.chantier;
    const ecName = hasEC ? d.ec.nom : 'EC';
    // ------------------------------------------------ bordereau
    out.push(P.formatBordereau(model));
    // ------------------------------------------------ page de garde
    newPage();
    out.push("     MINISTERE DE L'EQUIPEMENT, DU LOGEMENT, DES TRANSPORTS ET DU TOURISME", '', "     SERVICE D'ETUDES TECHNIQUES DES ROUTES ET AUTOROUTES    (S.E.T.R.A.)", '', "                  CENTRE DES TECHNIQUES D'OUVRAGES D'ART", '', '', '', '');
    out.push('', '', "                                                  NOTE   DE CALCUL D' UN CADRE FERME", '                                                          (VERSION 1.06 AU BAEL91)', '', '', '', '');
    out.push('                        ' + '*'.repeat(80), '');
    for (const t of model.titre) out.push('                            ' + t, '');
    out.push('                        ' + '*'.repeat(80), '', '');
    out.push(`                    CALCUL NO ${num}-${' '.repeat(65)}DU ${dateP}`);
    out.push('');
    newPage();
    out.push('', '', '', '', '                    POUR TOUS RENSEIGNEMENTS CONCERNANT CE CALCUL VEUILLEZ CONSULTER :', '                    ' + '-'.repeat(67));
    // ------------------------------------------------ sommaire
    newPage();
    out.push(`                                                  SOMMAIRE DU CALCUL PICF91   N.${num}`);
    out.push('                                                  ' + '-'.repeat(32), '');
    const somIdx = out.length; out.push('\u0000SOMMAIRE');
    // ------------------------------------------------ caractéristiques
    newPage();
    const s = R.geom.s, m = R.mat;
    out.push('', `${' '.repeat(57)}GEOMETRIE${' '.repeat(23)}BIAIS          ${F(d.biais, 2, 7)} GR`);
    out.push(`${' '.repeat(90)}HAUTEUR LIBRE    ${F(d.hautl, 2, 6)} M`);
    out.push(`${' '.repeat(90)}OUVERTURE DROITE ${F(d.ouver, 2, 5)} M`);
    out.push(`${' '.repeat(90)}LARGEUR DROITE   ${F(d.large, 2, 6)} M`);
    out.push(`CARACTERISTIQUES OPTIMISEES${' '.repeat(63)}DALLE TRANSITION ${F(d.ldalt, 2, 6)} M`);
    out.push(`                              EPAISSEURS TRAVERSE INFERIEURE     ${F(d.e1, 2)} M                                  PORTEE           ${F(L, 2, 6)} M`);
    out.push(`                                         PIEDROITS               ${F(d.e2, 2)} M                                  HAUTEUR MOYENNE  ${F(H, 2, 6)} M`);
    out.push(`                                         TRAVERSE SUPERIEURE     ${F(d.e3, 2)} M`, '');
    out.push(`VOIE PORTEE   EN SERVICE   ${F(d.etrotg, 2)} M +   ${F(d.egau, 2)} M   +   ${F(d.esurch, 2)} M   +   ${F(d.edroi, 2)} M   +   ${F(d.etrotd, 2)} M`);
    if (hasEC) out.push(`              EN PHASE DE CHANTIER    ${F(d.ec.egau, 2)} M   +    ${F(d.ec.esurch, 2)} M   +   ${F(d.large - d.ec.egau - d.ec.esurch, 2)} M`);
    out.push('', `HAUTEURS DE REMBLAIS INTERIEUR                                   ${F(d.hremb, 2)} M`, '');
    out.push(`EPAISSEUR CHAUSSEE                                               ${F(d.hchau, 2)} M`);
    out.push(`EPAISSEUR DE REMBLAIS SUR LA TRAVERSE EN SERVICE                 ${F(d.hsrem, 2)} M`);
    if (hasEC) out.push(`                                      EN PHASE DE CHANTIER       ${F(d.ec.hsrem, 2)} M`);
    out.push('', '', `${' '.repeat(57)}MATERIAUX`, '');
    out.push(`BETON   RESISTANCES CARACTERISTIQUES A LA COMPRESSION    ${F(m.fc, 2)} MPA`);
    out.push(`                                     A LA TRACTION        ${F(m.ft, 2)} MPA`);
    out.push(`        MODULES DE DEFORMATION INSTANTANEE ${F(m.Ei, 0)} MPA`);
    out.push(`                               DIFFEREE    ${F(m.Ev, 0)} MPA`);
    out.push('        COEFFICIENT DE DILATATION 0.10E-04', '');
    out.push(`ACIER   DIAMETRES UTILISES              PHI1 = ${F(d.phi[0] / 1000, 3)} M           PHI2 = ${F(d.phi[1] / 1000, 3)} M        PHI3 = ${F(d.phi[2] / 1000, 3)} M`);
    out.push(`        LIMITES D'ELASTICITE              ${F(d.fe[0], 2)} MPA               ${F(d.fe[1], 2)} MPA            ${F(d.fe[2], 2)} MPA`);
    out.push(`        COEEFICIENTS FISSURATION            ${F(d.eta[0], 2)}                     ${F(d.eta[1], 2)}                  ${F(d.eta[2], 2)}`, '');
    out.push(`        COEEFICIENT DE SCELLEMENT  ${F(d.psis, 2)}`);
    out.push('        MODULE DE DEFORMATION 200000. MPA');
    out.push(`        ENROBAGES DESSUS TRAVERSE ${F(d.enrobs, 3)} M`);
    out.push(`                  AUTRES          ${F(d.enrob, 3)} M`, '');
    out.push(`SOL     MODULE D'ELASTICITE   ${F(d.esol, 2)} MPA`);
    out.push(`        COEFFICIENTS DE RANKINE A GAUCHE ${F(d.rkgn, 3)} ET ${F(d.rkgx, 3)}`);
    out.push(`                                A DROITE ${F(d.rkdn, 3)} ET ${F(d.rkdx, 3)}`);
    if (d.r > 0) out.push(`        COEFFICIENT R PERMETTANT LE CALCUL DU POIDS DE REMBLAI EN TENANT COMPTE DE L'EFFET MARSTON ${F(d.r, 2)}`);
    out.push('', `${' '.repeat(57)}REGLEMENT DE CALCUL`, '');
    out.push('ETAT LIMITE DE SERVICE', `     (E.L.S.)            FISSURATION ${{ PP: 'PEU PREJUDICIALE', P: 'PREJUDICIABLE', TP: 'TRES PREJUDICIABLE' }[m.ifis] || 'PEU PREJUDICIALE'}`);
    out.push(`                         COMPRESSION LIMITE DU BETON   ${F(m.sbc, 2)} MPA`, m.ssLim ? `                         TRACTION LIMITE DES ACIERS       PHI1 ${F(m.ssLim[0], 2)} MPA     PHI2 ${F(m.ssLim[1], 2)} MPA     PHI3 ${F(m.ssLim[2], 2)} MPA` : '                         PAS DE TRACTION LIMITE DES ACIERS');
    out.push('                         COEFFICIENT DE POISSON   0.000', '                         EQUIVALENCE ACIER - BETON 15', '');
    out.push('ETAT LIMITE ULTIME', '     (E.L.U.)            COEFFICIENT DE POISSON   0.000');
    out.push(`                         COMPRESSION LIMITE DU BETON SOUS CHARGE PERMANENTE       ${F(m.fbu, 2)} MPA`);
    out.push(`                                                     SOUS CHARGES D'EXPLOITATION ${F(m.fbuQ, 2)} MPA`);
    out.push(`                         TRACTION LIMITE DES ACIERS       PHI1 ${F(m.fsu[0], 2)} MPA     PHI2 ${F(m.fsu[1], 2)} MPA      PHI3 ${F(m.fsu[2], 2)} MPA`);
    out.push('                         LIMITE D\'ELASTICITE DU DIAGRAMME CONTRAINTE-DEFORMATION', '                                        BETON 0.0035 ET 0.0020', '                                        ACIER 0.0100');
    out.push(`                         AUCUNE ARMATURE D'EFFORT TRANCHANT SI LA CONTRAINTE EST AU PLUS EGALE A   ${F(m.tauLim0 * 1.5 / 1.5 * 1.5 / 1.5, 2)} MPA`.replace(/   [\d.]+ MPA$/, '   ' + F(0.07 * m.fc / 1.5, 2) + ' MPA'));
    out.push(`                         CONTRAINTE TANGENTE LIMITE DU BETON ${F(m.tauLim, 2)} MPA`);
    out.push(`                         CONTRAINTE D'ADHERENCE VIS A VIS DE L'ANCRAGE DES ACIERS ${F(m.taus, 2)} MPA`);
    // ------------------------------------------------ définition des charges
    newPage();
    const C = R.charges, t = x => x;
    out.push('', `${' '.repeat(61)}DEFINITION DES CHARGES`);
    out.push(`                      MASSE VOLUMIQUE DU BETON     ${F(d.mvbet, 3)} T/M3      ${F(d.mvbet, 3)} T/M3 ${F(d.mvbet, 3)} T/M3                1.00   1.00         1.00   1.35`);
    out.push(`                                      DU SOL       ${F(d.mvsol, 3)} T/M3      ${F(d.mvsol, 3)} T/M3 ${F(d.mvsol, 3)} T/M3                1.00   1.00         1.00   1.35`);
    out.push('', '         EN SERVICE');
    out.push(`                   SUPERSTRUCTURES+REMBLAI         ${F(C.qsup.p, 2)} T/M2        ${F(C.qsup.x, 2)} T/M2   ${F(C.qsup.n, 2)} T/M2              1.00   1.00         1.00   1.35`);
    out.push(`                   REACTION DALLE                  ${F(C.rdt.p, 0)} T           ${F(C.rdt.x, 0)} T      ${F(C.rdt.n, 0)} T                 1.00   1.00         1.00   1.35`);
    if (hasEC) {
      const ch = C.chantier;
      out.push('', '         EN PHASE DE CHANTIER');
      out.push(`                   REMBLAI SUPERIEUR               ${F(ch.qp, 2)} T/M2        ${F(ch.qx, 2)} T/M2   ${F(ch.qn, 2)} T/M2              1.00   1.00         1.00   1.35`);
      out.push(`                   REACTION DALLE                   ${F(ch.rp, 0)} T            ${F(ch.rx, 0)} T       ${F(ch.rn, 0)} T                 1.00   1.00         1.00   1.35`);
    }
    out.push('', '', 'CHARGES D\'EXPLOITATION', `(OUVRAGE EN CLASSE ${d.cl})`, '                         A CARACTERE NORMAL');
    for (const k of ['AL', 'BC', 'BT']) out.push(`                                                 CHARGE ${k}      DEFINIE AU TITRE II FASC.61(1971)                          1.20   1.60`, '');
    const convoyText = (name, files, trucks, enc, axe, ent, axles, dyn) => {
      out.push(`                                                                ${files} FILE(S)`, `                                                                ${trucks} CAMION(S) PAR FILE`);
      out.push(`                                                                ENCOMBREMENT ${enc}`, `                                                                AXE AU MINIMUM A ${axe} M DU BORD GAUCHE DE ESURCH`);
      out.push(`                                                                ENTRE-AXES DES ROUES ${ent} M`, '                                                                ESSIEU ABSCISSE(M) POIDS(T) IMPACT DE ROUE(M)');
      axles.forEach((a, i) => out.push(`                                                                  ${i + 1}        ${F(a[0], 3)}     ${F(a[1], 3, 7)}        ${a[2]}`));
      out.push(`                                                                COEFFICIENT DE MAJORATION DYNAMIQUE ${F(dyn, 3)}`);
    };
    if (hasEC) { out.push(`                                                 CHARGE ${pad(ecName, 7)}(ENGIN DE CHANTIER)                                        1.20   1.60`); convoyText(ecName, 1, 1, '15.500 M SUR 4.000 M', '3.00', '2.400', [[0, 50, '0.60 X 0.60'], [9.5, 50, '0.60 X 0.60']], 1.5); out.push(''); }
    // charge sur les remblais (PSREM, t/m²) : ligne imprimée seulement si elle est non nulle (listing 2498 : « 1.000 T/M2  1.20 1.60 »)
    if (d.psrem > 0) out.push(`                                                 CHARGE SUR LES REMBLAIS      ${F(d.psrem, 3)} T/M2                                 1.20   1.60`, '');
    out.push('                         A CARACTERE PARTICULIER', '');
    out.push('                                                 CHARGE MC120 DEFINIE AU TITRE II FASC.61(1971)                            1.00   1.35', '');
    out.push('                                                 CHARGE ME120 DEFINIE AU TITRE II FASC.61(1971)                            1.00   1.35', '');
    out.push('                                                 CHARGE E       1 FILE(S)                                                  1.00   1.35');
    out.push('                                                                1 CAMION(S) PAR FILE', '                                                                ENCOMBREMENT 48.000 M SUR 7.000 M', '                                                                AXE AU MINIMUM A 3.50 M DU BORD GAUCHE DE ESURCH', '                                                                ENTRE-AXES DES ROUES 1.650 M', '                                                                ESSIEU ABSCISSE(M) POIDS(T) IMPACT DE ROUE(M)');
    out.push('                                                                  1        0.000    200.000       15.00 X 1.65', '                                                                  2       33.000    200.000       15.00 X 1.65', '                                                                COEFFICIENT DE MAJORATION DYNAMIQUE 1.000', '');
    out.push(`                                                 VARIATION DE TEMPERATURE ${F(d.tep, 0)} ET ${F(d.tem, 0)} DEGRES CELSIUS                       0.60   0.00`);
    out.push(`                                                              (DONT ${F(d.ter, 0)}RAPIDEMENT VARIABLES)`);
    // ------------------------------------------------ CMD et répartition transversale
    newPage();
    const Y = R.dyn, co = R.coefs, gy = R.guyon;
    out.push('', '                                               COEFFICIENTS DE MAJORATION DYNAMIQUE', '                                               =======================================', '');
    out.push(`                      ${pad(ecName, 21)}BC                  BT                  MC120                ME120                E`);
    out.push(`MASSE (T)                              ${F(Y.BC.S, 1)}*(${F(Y.BC.coef, 3)})        ${F(Y.BT.S, 1)}*(${F(Y.BT.coef, 3)})           ${F(110, 1)}                 ${F(66, 1)}`);
    out.push(`COEFFICIENTS         ${hasEC ? F(1.5, 3) : '     '}                ${F(Y.BC.d, 3)}               ${F(Y.BT.d, 3)}                ${F(Y.MC.d, 3)}                ${F(Y.ME.d, 3)}                ${F(1, 3)}`);
    out.push('', '', '', '', '                                COEFFICIENTS DE REPARTITION TRANSVERSALE DES MOMENTS LONGITUDINAUX', '                                ' + '='.repeat(66), '');
    out.push(`PORTEE FICTIVE   ${F(gy.Lf, 2, 5)}       LARGEUR DROITE   ${F(d.large, 2)}    PARAMETRE D'ENTRETOISEMENT (TETA LONGITUDINAL)   ${F(gy.theta, 2)}`, '', '');
    out.push('LIGNES D\'INFLUENCE', '            FIBRE D\'ETUDE                            VALEUR DES LIGNES D\'INFLUENCE DANS LES SECTIONS');
    out.push('                                     -B        -0,75 B    -0,5 B     -0,25 B       0        0,25 B      0,5 B       0,75 B     B');
    gy.Ktab.forEach((row, i) => out.push(`                 ${F(gy.fibres[i], 4, 7)}        ${row.map(v => F(v, 5, 10)).join(' ')}`));
    out.push('', '', 'COEFFICIENTS', '      <- - -CHANTIER- - ->   <- - - - - - - - - - - - - - - - - - - - - - - EN SERVICE - - - - - - - - - - - - - - - - - - - - - - ->');
    out.push(`NVOIE TERRE      ${pad(ecName, 21)}AL                 BC              BT       TR         MC120           ME120            E`);
    const nl = Math.max(co.AL.length, co.BC.length);
    for (let k = 0; k < nl; k++) {
      const a = co.AL[k], bc = co.BC[k], bt = co.BT[k];
      let line = `  ${k + 1}          ${k === 0 && hasEC ? F(co.EC, 3) + '*(' + F(1, 3) + ')' : '             '}   `;
      line += a ? `${F(a.c, 3)}*(${F(a.a1, 3)}*${F(a.a2, 3)})   ` : '';
      line += bc ? `${F(bc.c, 3)}*(${F(bc.bc, 3)})   ` : '';
      line += bt ? `${F(bt.c, 3)}*(${F(bt.bt, 3)})` : '';
      out.push(line);
    }
    out.push('');
    out.push(`     ${hasEC ? F(co.TERRE, 3) : '     '}       ${hasEC ? '=' + F(co.EC, 3) : '      '}             =${F(co.ALf, 3)}             =${F(co.BCf, 3)}          =${F(co.BTf, 3)}                ${F(co.MC, 3)}               ${F(co.ME, 3)}        ${F(co.E, 3)}`);
    // ------------------------------------------------ lignes d'influence
    newPage();
    out.push("                                            LIGNES D'INFLUENCE DES MOMENTS LONGITUDINAUX", '                                            ' + '='.repeat(44), '                                           (CHARGE UNITE SUR LA TRAVERSE SUPERIEURE)', '', '');
    out.push('ABS.      ANGLE SUP.        ANGLE INF.        1/2 TR SUP        1/2 TR INF        1/4 TR INF        1/2 PIEDR.', '            GAUCHE            GAUCHE                                                GAUCHE            GAUCHE', '');
    for (const r of R.ilPage) out.push(`${F(r[0], 2, 5)}  ${r.slice(1).map(v => F(v, 4, 11)).join('       ')}`);
    // ------------------------------------------------ moments permanents dans les sections déterminantes
    newPage();
    out.push('', '                                                 MOMENTS PERMANENTS DANS LES SECTIONS DETERMINANTES      (KN*M)', '                                                 ' + '='.repeat(50), '');
    out.push('                                                              <- - - - - - -CHANTIER- - - - - - ->     <- - - - - - EN SERVICE - - - - - ->');
    out.push('                             POIDS     POUSSEE                H.SUP DALLE POUSSEE MOMENTS TOTAUX       QSUP+ DALLE POUSSEE MOMENTS TOTAUX');
    out.push('                            PROPRE     TERRES                       TRANSI H.SUP    E.L.S. E.L.U.      H.SUP TRANSI H.SUP    E.L.S. E.L.U.', '');
    const DET = ['ANGLE SUP.', 'ANGLE INF.', '1/2 TR SUP', '1/2 TR INF', '1/4 TR INF', '1/2 PIEDR.'];
    const Cs = R.cases;
    const detPerm = DET.map((nm, k) => {
      const get = c => c ? c.det[k] : 0;
      const pp = get(Cs.pp), pu = [get(Cs.pushN), get(Cs.pushX)], qs = [get(Cs.qsupN), get(Cs.qsupX)], rd = [get(Cs.rdtN), get(Cs.rdtX)], ph = [get(Cs.pushHN), get(Cs.pushHX)];
      const UX = a => a.reduce((s, v) => s + (v > 0 ? 1.35 * v : v), 0), UN = a => a.reduce((s, v) => s + (v < 0 ? 1.35 * v : v), 0);
      const ch = hasEC ? { q: [get(Cs.chqN), get(Cs.chqX)], r: [get(Cs.chRN), get(Cs.chRX)] } : null;
      const rows = [];
      for (const mx of [true, false]) {
        const f = mx ? Math.max : Math.min, pe = f(...pu);
        const sv = [pp, pe, f(...qs), f(...rd), f(...ph)];
        const svS = sv.reduce((a, v) => a + v, 0), svU = mx ? UX(sv) : UN(sv);
        let chv = [0, 0, 0, 0, 0];
        if (ch) { const cv = [pp, pe, f(...ch.q), f(...ch.r)]; chv = [f(...ch.q), f(...ch.r), 0, cv.reduce((a, v) => a + v, 0), mx ? UX(cv) : UN(cv)]; }
        rows.push({ pp, pe, chv, sv: [f(...qs), f(...rd), f(...ph), svS, svU] });
      }
      return rows;
    });
    detPerm.forEach((rows, k) => {
      rows.forEach((r, i) => out.push(`${pad(i ? '' : DET[k], 17)}${i ? 'MIN' : 'MAX'}        ${F(r.pp, 1, 8)} ${F(r.pe, 1, 7)}                ${r.chv.map(v => F(v, 1, 7)).join(' ')}      ${r.sv.map(v => F(v, 1, 7)).join(' ')}`));
      out.push('');
    });
    out.push('', '', '', '                                     MOMENTS FLECHISSANTS EXTREMES DANS LES SECTIONS DETERMINANTES (KN*M)', '                                     ' + '='.repeat(61));
    out.push(`                        CHARGE PERM   REMB ${pad(ecName, 8)}TEMP CHARGE PERM    REMB TROT    AL    BC    BT   MC120 ME120 E`);
    // moments extrêmes dans les sections déterminantes : on reprend les tableaux par élément
    const detMap = [['t', 0], ['b', 0], ['t', -1], ['b', -1], ['b', 'q'], ['w', 'h']];
    const cmpOf = (el, sel) => { const arr = R.cmp[el]; if (sel === -1) return arr[arr.length - 1]; if (sel === 0) return arr[0]; return null; };
    detMap.forEach(([el, sel], k) => {
      const c = R.cmp.det[k];
      if (!c) { out.push(`${pad(DET[k], 17)}MAX`, '                 MIN', ''); return; }
      extremeRows(c).forEach((r, i) => out.push(`${pad(i ? '' : DET[k], 17)}${r}`)); out.push('');
    });
    function extremeRows(c) {
      const p = c.perm, ch = p.ch;
      const live = ['AL', 'BC', 'BT', 'MC', 'ME', 'E'];
      const rx = [ch ? ch.maxS : 0, ch ? ch.maxU : 0, 0, c.ec ? c.ec.mx : 0, c.tmax, p.maxS, p.maxU, c.lmax.REMB || 0, 0, ...live.map(l => c.lmax[l]), c.design.maxS, c.design.maxU];
      const rn = [ch ? ch.minS : 0, ch ? ch.minU : 0, 0, c.ec ? c.ec.mn : 0, c.tmin, p.minS, p.minU, c.lmin.REMB || 0, 0, ...live.map(l => c.lmin[l]), c.design.minS, c.design.minU];
      return [rx, rn].map((r, i) => `${i ? 'MIN' : 'MAX'}   ${r.map(v => F(v, 0, 6)).join(' ')}`);
    }
    // ------------------------------------------------ positions + moments extrêmes par élément
    const ELS = [['t', 'TRAVERSE INFERIEURE', 'b', "L'ANGLE"], ['t', 'TRAVERSE SUPERIEURE', 't', "L'ANGLE"], ['t', 'PIEDROIT DE GAUCHE', 'w', 'LA BASE']];
    for (const [, nm, el, orig] of ELS) {
      newPage();
      out.push('', `                       POSITION DES SURCHARGES CORRESPONDANT AUX MOMENTS EXTREMES DANS LA ${nm}`.replace('DANS LA PIEDROIT', 'DANS LE PIEDROIT'), `                                             (LES ABSCISSES SONT COMPTEES A PARTIR DE ${orig})`, '');
      out.push(` ABSC.          ${pad(ecName, 13)}TROT       AL           BC                  BT                MC120               ME120                 E`);
      out.push('SECTION                      LONG.     LONG.', '          <- ABSCISSES ->   CHARGEE   CHARGEE   <- ABSCISSES ->    <- ABSCISSES ->    <- ABSCISSES ->     <- ABSCISSES ->     <- ABSCISSES ->', '');
      const env = R.env[el];
      R.sections[el].forEach((x, k) => {
        const e = env[k];
        const pos = key => {
          const p = e[key] && e[key].pos; if (!p || !e[key].v) return 'DG   0.00   0.00';
          const cv = R.conv[key.slice(0, -1)]; const xs = [];
          for (let t = 0; t < p.nt; t++) { const ps = cv.axles.map(ax => (p.xs ? p.xs[t] : p.x0) + p.dir * (ax.x + (p.xs ? 0 : t * (cv.gapTruck || 0)))); xs.push(key[0] === 'E' && key[1] !== 'C' ? Math.max(...ps) : Math.min(...ps)); }
          xs.sort((a, c) => a - c); while (xs.length < 2) xs.push(0);
          return `${p.dir > 0 ? 'DG' : 'GD'} ${F(xs[0], 2, 6)}   ${F(xs[1], 2)}`; };
        for (const sg of ['+', '-']) {
          out.push(`${sg === '+' ? F(x, 2, 5) : '     '}         ${hasEC ? pos('EC' + sg) : '0.00   0.00'}    0.00     ${F(e['AL' + sg].len, 2, 6)}     ${pos('BC' + sg)}   ${pos('BT' + sg)}   ${pos('MC' + sg)}   ${pos('ME' + sg)}   ${pos('E' + sg)}`);
        }
        out.push('');
      });
      newPage();
      out.push('', `                                        MOMENTS FLECHISSANTS EXTREMES (KN*M) DANS ${el === 'w' ? 'LES PIEDROITS' : 'LA ' + nm}`, `                                             (LES ABSCISSES SONT COMPTEES A PARTIR DE ${orig})`);
      out.push('             <- - - - - - CHANTIER - - - - - ->', ' ABS.                                     <- - - - - - - - - - - - - - - - SERVICE- - - - - - - - - - - - - - - - - ->      MOMENTS DE', 'SECTION                                                                                                                       CALCUL');
      out.push(`              CHARGE PERM    REMB   ${pad(ecName, 6)}TEMP   CHARGE PERM     REMB   TROT    AL      BC     BT   MC120   ME120    E`, '             E.L.S. E.L.U.                       E.L.S. E.L.U.                                                             E.L.S. E.L.U.', '');
      R.cmp[el].forEach(c => { const rr = extremeRows(c); out.push(`${F(c.x, 2)}   ${rr[0]}`, `       ${rr[1]}`, ''); });
    }
    // ------------------------------------------------ lignes d'influence du coefficient MU
    for (const fb of R.mu.fibres) {
      newPage();
      out.push('', `                              LIGNES D'INFLUENCE DU COEFFICIENT MU POUR LA FIBRE A ${F(fb.fy, 3)} M DU CENTRE DE LA DALLE`);
      out.push(`                                                                                                 BIAIS MECANIQUE ${F(R.mu.psi, 2, 7)} GR`);
      out.push('                           DIMENSIONS DE LA PLAQUE RECTANGULAIRE EQUIVALENTE SUR APPUIS SIMPLES');
      out.push(`                  LARGEUR = ${F(R.mu.LA, 3)} M.                LONGUEUR = ${F(R.mu.LO, 3)} M.               TETA(TRANSVERSAL) = ${F(R.mu.thT, 3)}`, '', '');
      out.push('     ABSCISSE        <- - - - - - - POISSON=0.000- - - - - - ->', '                     HARMONIQUE 1   HARMONIQUE 3   HARMONIQUE 5', '                      ( *1000 )      ( *1000 )      ( *1000 )', '');
      for (const r of fb.rows) out.push(`${r.fib ? 'FIBRE ' : '      '}${F(r.y, 2, 7)}       ${F(r.v[0], 2, 11)}    ${F(r.v[1], 2, 11)}    ${F(r.v[2], 2, 11)}`);
    }
    // ------------------------------------------------ moments transversaux (p.19–21)
    if (R.tr) {
      const T = R.tr, POI = '<- POISSON=0.000->';
      const hdr = '                    HARMONIQUE   FACTEUR 1   FACTEUR 2   FACTEUR 3   MOMENT';
      const rowsTxt = (rows, ind) => rows.map(x => `${String(x.m).padStart(ind)}${F(x.F1, 4, 17 - (24 - ind))}${F(x.F2, 4, 12)}${F(x.F3, 4, 11)}${F(x.M, 2, 10)}`);
      const head = (nm) => { const u = '-'.repeat(Math.max(4, nm.length)); out.push(` ${nm}`, ` ${u.padEnd(54)}${POI}`, hdr); };
      const combTxt = c => { out.push(`${' '.repeat(110)}POISSON=0.000`, `${' '.repeat(110)}E.L.S. E.L.U.`);
        for (const k of ['MY', 'MX', 'MTOR', 'MAVF', 'MAPF']) out.push(`${' '.repeat(103)}${k.padEnd(6)}${F(c.S[k], 2, 8)}${F(c.U[k], 2, 8)}`); out.push(''); };
      const simple = (nm, o, tot) => { head(nm); out.push(...rowsTxt(o.rows, 24), ' '.repeat(69) + '------', `     TOTAL${tot}`, ''); };
      const live = (nm, o) => { head(nm); out.push(...rowsTxt(o.rows, 24), ' '.repeat(66) + '------', `     TOTAL AVEC COEFFICIENT DE MAJORATION DYNAMIQUE ${F(o.cmd, 3)}${F(o.tot, 2, 13)}`); combTxt(o.comb); };
      newPage();
      out.push('', '                             MOMENTS TRANSVERSAUX (KN*M) POUR LA FIBRE A   0.000 M A PARTIR DU CENTRE DE LA DALLE', '                             ==========================,',
        `${' '.repeat(75)}BIAIS GEOMETRIQUE ${F(T.phi, 2, 6)}`);
      const svc = (l1) => { out.push(l1 || 'EN SERVICE', '==========', '  CHARGES PERMANENTES', `  -------------------${' '.repeat(34)}${POI}`, '                  HARMONIQUE     FACTEUR 1   FACTEUR 2   FACTEUR 3   MOMENT',
        ...rowsTxt(T.perm.rows, 22), ' '.repeat(69) + '------', `        TOTAL${F(T.perm.tot, 2, 62)}`, ''); };
      if (T.chantier) {
        const C = T.chantier;
        out.push(`PHASE DE CHANTIER${' '.repeat(58)}BIAIS MECANIQUE   ${F(T.psi, 2, 6)}`, '=================');
        out.push('  OSSATURE', `  --------${' '.repeat(45)}${POI}`, hdr, ...rowsTxt(C.oss.rows, 24), ' '.repeat(68) + '------', `     TOTAL${F(C.oss.tot, 2, 65)}`);
        simple('TERRE', C.ter, F(C.ter.tot, 2, 65));
        live(ecName, C.ec); svc(); newPage();
      } else svc(`EN SERVICE${' '.repeat(65)}BIAIS MECANIQUE   ${F(T.psi, 2, 6)}`);
      let cnt = T.chantier ? 0 : 1;
      for (const o of T.service) {
        if (cnt === 3) { newPage(); cnt = 0; }
        if (o.key === 'AL') {
          head('AL'); o.lanes.forEach((ln, j) => out.push(`          VOIE ${String(j + 1).padStart(3)}`, ...rowsTxt(ln.rows, 25)));
          out.push(' '.repeat(69) + '------', `        TOTAL POUR LA COMBINAISON LA PLUS DEFAVORABLE${F(o.tot, 2, 22)}`); combTxt(o.comb);
        } else live(o.name, o);
        cnt++;
      }
      out.push('', '', ' MOMENTS TRANSVERSAUX DE CALCUL (KN*M)', ' ==============================', '                                             <- POISSON=0.000 ->', '                                               E.L.S.   E.L.U.',
        `                                             ${F(T.design.S, 2, 8)} ${F(T.design.U, 2, 8)}`);
    }
    // ------------------------------------------------ efforts tranchants
    for (const [el, nm, orig] of [['b', 'LA TRAVERSE INFERIEURE', "L'ANGLE"], ['t', 'LA TRAVERSE SUPERIEURE', "L'ANGLE"], ['w', 'LES PIEDROITS', 'LA BASE']]) {
      newPage();
      out.push('', `                                            EFFORTS TRANCHANTS EXTREMES DANS ${nm} (KN)`, '                                            ' + '='.repeat(55), `                                                 LES ABSCISSES SONT COMPTEES A PARTIR DE ${orig}`);
      out.push('             <- - - - - - CHANTIER - - - - - ->', ' ABS.                                     <- - - - - - - - - - - - - - - - SERVICE- - - - - - - - - - - - - - - - - ->          EFFORTS', 'SECTION                                                                                                                       TRANCHANTS');
      out.push(`             CHARGE PERM    REMB   ${pad(ecName, 7)}TEMP   CHARGE PERM   REMB   TROT     AL       BC     BT    MC120    ME120     E`, '               E.L.U.                               E.L.U.                                                                     E.L.U.', '');
      R.cmp['V' + el].forEach(c => {
        const p = c.perm, ch = p.ch, live = ['AL', 'BC', 'BT', 'MC', 'ME', 'E'];
        const rx = [ch ? ch.maxU : 0, 0, c.ec ? c.ec.mx : 0, c.tmax, p.maxU, c.lmax.REMB || 0, 0, ...live.map(l => c.lmax[l]), c.design.maxU];
        const rn = [ch ? ch.minU : 0, 0, c.ec ? c.ec.mn : 0, c.tmin, p.minU, c.lmin.REMB || 0, 0, ...live.map(l => c.lmin[l]), c.design.minU];
        out.push(`${F(c.x, 2)}   MAX   ${rx.map(v => F(v, 1, 7)).join(' ')}`, `       MIN   ${rn.map(v => F(v, 1, 7)).join(' ')}`, '');
      });
    }
    // ------------------------------------------------ pressions
    newPage();
    out.push('', '                                             PRESSION SUR LE SOL *1000 (MPA/1000)', '                                             ==========================', "                                          LES ABSCISSES SONT COMPTEES A PARTIR DE L'ANGLE");
    out.push('             <- - - - - - CHANTIER - - - - - ->', ' ABS.                                     <- - - - - - - - - - - - - - - - SERVICE- - - - - - - - - - - - - - - - - ->', 'SECTION                                                                                                                    PRESSIONS');
    out.push(`             CHARGE PERM    REMB   ${pad(ecName, 7)}TEMP   CHARGE PERM   REMB   TROT    AL      BC     BT     MC120   ME120   E`, '               E.L.S.                               E.L.S.                                                                 E.L.S.', '');
    ['0.', '1/4', '1/2'].forEach((lab, k) => {
      const c = R.cmp.p[k], p = c.perm, ch = p.ch, live = ['AL', 'BC', 'BT', 'MC', 'ME', 'E'];
      const rx = [ch ? ch.maxS : 0, 0, c.ec ? c.ec.mx : 0, c.tmax, p.maxS, c.lmax.REMB || 0, 0, ...live.map(l => c.lmax[l]), c.design.maxS];
      const rn = [ch ? ch.minS : 0, 0, c.ec ? c.ec.mn : 0, c.tmin, p.minS, c.lmin.REMB || 0, 0, ...live.map(l => c.lmin[l]), c.design.minS];
      out.push(` ${pad(lab, 6)}MAX   ${rx.map(v => F(v, 1, 7)).join(' ')}`, `       MIN   ${rn.map(v => F(v, 1, 7)).join(' ')}`, '');
    });
    out.push('', '', '', 'RAPPEL : LES CHARGES ROULANTES NE SONT PAS PONDEREES PAR LEUR COEFFICIENT DE MAJORATION DYNAMIQUE');
    // ------------------------------------------------ ferraillage dans les sections déterminantes
    {
      const fr = R.fer; newPage();
      out.push('', '          FERRAILLAGE DANS LES SECTIONS DETERMINANTES');
      if (fr.groupMode) out.push(`          =========================================== LE FERRAILLAGE ADOPTE EST DONNE POUR UN GROUPE COMPORTANT AU MAXIMUM 2 FERS`,
        `                                                                 L'ESPACEMENT DE CES GROUPES EST 2*${F(fr.eGroup / 2, 3)}=${F(fr.eGroup, 3)} M POUR LES TRAVERSES`,
        `                                                                                                 2*${F(fr.eGroup / 2 / R.geom.s, 3)}=${F(fr.eGroup / R.geom.s, 3)} M POUR LES PIEDROITS`);
      else out.push('          =========================================== L\'ESPACEMENT DES FERRAILLAGES EXTERIEURS EST COMMUN A TOUS LES ELEMENTS',
        '                                                      L\'ESPACEMENT DES FERRAILLAGES INTERIEURS EST DEFINI POUR CHAQUE ELEMENT');
      out.push('', '', '                                                                                                 E.L.S.                        E.L.U',
        '                                                 SECTION PAR M/L     DIAMETRE ESPACEMENT      CONTRAINTE MAXI         EFFORTS TRANCHANTS',
        '                                                       (M2)                ADOPTES                 (MPA)                    (KN)',
        '                                               MINIMALE    ADOPTEE                                              RESISTANTS      APPLIQUES',
        '                                                                                              ACIER   BETON     ACIER    BETON    (RAPPEL)',
        'FERRAILLAGE LONGITUDINAL', '========================', '');
      const Vd = c => Math.max(Math.abs(c.design.maxU), Math.abs(c.design.minU));
      const Vt = R.cmp.Vt, Vb = R.cmp.Vb, Vw = R.cmp.Vw;
      const ln = (pre, o, V) => `${pre}${F(o.Amin, 6, 11)}${F(o.A, 6, 11)}   ${o.n === 2 ? '2 ' : '  '}PHI${o.phi + 1}   ${o.n === 2 ? '2*' : '  '}${F(o.esp, 3)} M  ${F(o.ss, 2, 9)}  ${F(o.sb, 2, 9)}  ${F(o.VRs, 1, 7)}  ${F(o.VRb, 1, 7)}${V === undefined ? '' : F(V, 1, 11)}`;
      out.push('  EXTERIEUR', '');
      out.push(ln('      ANGLE SUPERIEUR           TRAVERSE   ', fr.AS_T, Vd(Vt[0])), ln('                                PIEDROIT   ', fr.AS_P, Vd(Vw[Vw.length - 1])), '');
      out.push(ln('       ANGLE INFERIEUR          TRAVERSE   ', fr.AI_T, Vd(Vb[0])), ln('                                PIEDROIT   ', fr.AI_P, Vd(Vw[0])), '', '', '');
      out.push('   INTERIEUR', '', ln('       TRAVERSE   SUPERIEURE               ', fr.TS), '', ln('       TRAVERSE   INFERIEURE               ', fr.TI), '', ln('       PIEDROIT                            ', fr.PD), '', '', '');
      out.push('FERRAILLAGE TRANSVERSAL', '=======================', `   CONDITION DE NON FRAGILITE     TRAV. SUP.   ${F(fr.ANF.t, 6)}`, `                                  TRAV. INF.   ${F(fr.ANF.b, 6)}`, `                                  PIEDROITS    ${F(fr.ANF.w, 6)}`);
      // ferraillage plancher (1 PHI2 / 0.333 m) : imprimé hors mode groupes. A10/A20 (moments transversaux) non calculés → bloc A = SUP(...) omis.
      if (!fr.groupMode) { const AP = F(3 * Math.PI * (d.phi[1] / 1000) ** 2 / 4, 6);
        out.push('', '', `   FERRAILLAGE PLANCHER TRAV SUP. FACE INT. ${AP}`, `                                  FACE EXT. ${AP}`, `                        TRAV INF. FACE INT. ${AP}`, `                                  FACE EXT. ${AP}`, `                        PIEDROITS 2 FACES ${AP}`); }
      if (fr.A20 !== undefined) { const At = R.det.nom.Atr, sp = ' '.repeat(90);
        out.push('', '', '', `   TRAVERSE SUPERIEURE     FACE INTERIEURE     ${F(At, 6)}   ${F(At, 6)}    PHI2 TOUS LES ${F(R.det.nom.TT.TSi, 3)} M`, '                                                   =A', '',
          `${sp} A = SUP(${fr.groupMode ? '' : 'AP,'}A10,A20,ANF)`, '');
        if (!fr.groupMode) out.push(`${sp}AP =${F(3 * Math.PI * (d.phi[1] / 1000) ** 2 / 4, 6)}    FERRAILLAGE PLANCHER`);
        out.push(`${sp}A10=${F(fr.A10, 6)}    E.L.S. AVEC POISSON=0.000`, `${sp}A20=${F(fr.A20, 6)}    E.L.U. AVEC POISSON=0.000`, `${sp}ANF=${F(fr.ANF.t, 6)}    CONDITION DE NON FRAGILITE`); }
    }
    // ------------------------------------------------ épure d'arrêt des barres
    const DT = R.det, ep = DT.epure, sgeo = R.geom.s, f2 = v => F(v, 2);
    {
      newPage();
      out.push('', "                                           EPURE D'ARRET DES BARRES DU FERRAILLAGE LONGITUDINAL", '                                           ====================================================', '',
        "                                                     LES ABSCISSES SONT COMPTEES A PARTIR DE L'ANGLE SUR LA TRAVERSE", '                                                                                             LA BASE SUR LE PIEDROIT', '', '', '',
        '                                DIAMETRE        ESPACEMENT                     ABSCISSE ORIGINE   ABSCISSE EXTREMITE     LONGUEUR', '   FERRAILLAGE INTERIEUR', '   =====================', '');
      const famLines = (b, k) => `${k === 0 ? '' : ' '.repeat(73)}(${k + 1})${F(b[0], 2, 12)}${F(b[1], 2, 21)}${F(b[1] - b[0], 2, 18)}`;
      for (const [k, nm, rep] of [['TS', 'TRAVERSE SUPERIEURE', 'LTS -I'], ['TI', 'TRAVERSE INFERIEURE', 'LTI -I'], ['PD', 'PIEDROIT           ', 'LP(G)-I']]) {
        const e = ep[k];
        e.bars.forEach((b, i) => out.push(i === 0 ? `        ${nm}     ${F(d.phi[e.phi] / 1000, 3)} M           ${F(e.esp, 3)} M      ${rep.padStart(8)}   ${famLines(b, 0)}` : famLines(b, i)));
        out.push('');
      }
      out.push('', '   FERRAILLAGE EXTERIEUR', '   =====================', '', '                                                                                 (PIEDROIT)           (TRAVERSE)');
      for (const [k, nm, rep] of [['AS', 'ANGLE SUPERIEUR', 'LAS(G)-E'], ['AI', 'ANGLE INFERIEUR', 'LAI(G)-E']]) {
        const e = ep[k], esp = Math.abs(sgeo - 1) > 1e-6 ? `${F(e.espP, 3)}-${F(e.espT, 3)}` : `    ${F(e.espT, 3)}`;
        e.bars.forEach((b, i) => { const t = `(${i + 1})${F(b[0], 2, 12)}${F(b[1], 2, 21)}${F(b[2], 2, 17)}`;
          out.push(i === 0 ? `       ${nm}         ${F(d.phi[0] / 1000, 3)} M       ${esp} M   ${rep}    ${t}` : ' '.repeat(73) + t); });
        out.push('');
      }
    }
    // ------------------------------------------------ nomenclature des barres PHI2
    {
      const N = DT.nom; newPage();
      const tl = N.trLen.length > 1 ? `${F(N.trLen[0], 2, 5)} +${F(N.trLen[1], 2, 8)}   (TETE-BECHE)` : F(N.trLen[0], 2, 5);
      out.push('', `                                      NOMENCLATURE DES BARRES DE DIAMETRE PHI2 = ${F(d.phi[1] / 1000, 3)} M`, '                                      ==================================================', '', '', '',
        '                                                             ESPACEMENT                                     LONGUEUR', '', 'FERRAILLAGE LONGITUDINAL', '========================', '',
        `             INTERIEUR             TRAVERSE SUPERIEURE           ${F(N.LTS_I, 3)}                  LTS -I-P         0.00   ET     0.00`, '',
        `                                   TRAVERSE INFERIEURE           ${F(N.LTI_I, 3)}                 LTI -I-P         0.00    ET     0.00`, '',
        `             EXTERIEUR             TRAVERSE SUPERIEURE           ${F(N.LTS_E, 3)}                 LTS -E-P             ${F(N.lenTS_E, 2, 8)}`, '',
        `                                   TRAVERSE INFERIEURE           ${F(N.LTI_E, 3)}                 LTI -E-P             ${F(N.lenTI_E, 2, 8)}`, '',
        `                                   PIEDROITS                     ${F(N.LP_E, 3)}                LP(G)-E-P                 0.00`, '',
        `             GOUSSETS SUPERIEURS                                 ${F(N.eG, 3)}                     LGS-             ${F(N.LGS, 2, 8)}`, '',
        `                      INFERIEURS                                 ${F(N.eG, 3)}                     LGI-             ${F(N.LGI, 2, 8)}`, '', '', '',
        'FERRAILLAGE TRANSVERSAL', '=======================', '',
        '            TRAVERSE SUPERIEURE', `                                   FACE INTERIEURE               ${F(N.TT.TSi, 3)}                      TT-I     ${tl}`,
        `                                   FACE EXTERIEURE               ${F(N.TT.TSe, 3)}                      TT-E     ${tl}`, '',
        '            TRAVERSE INFERIEURE', `                                   FACE INTERIEURE               ${F(N.TT.TIi, 3)}                      TT-I     ${tl}`,
        `                                   FACE EXTERIEURE               ${F(N.TT.TIe, 3)}                      TT-E     ${tl}`, '',
        '            PIEDROITS SUR CHAQUE FACE                                               TP -E / TP -I',
        `                SUR 2. M A PARTIR DE LA REPRISE DE BETONNAGE :   ${F(N.TP[0], 3)}                               ${tl}`,
        `                SUR LE RESTE DE LA HAUTEUR :                     ${F(N.TP[1], 3)}                               ${tl}`, '',
        `            GOUSSETS SUPERIEURS                            ${N.nTGS} FERS FILANTS                  TGS-      ${tl}`, '',
        `                     INFERIEURS                            ${N.nTGI} FERS FILANTS                  TGI-      ${tl}`);
    }
    // ------------------------------------------------ étriers (τ = Vu / (b0 d), b0 = 1 m, d de la section d'angle)
    for (const [el, nm] of [['b', 'DE LA TRAVERSE INFERIEURE'], ['t', 'DE LA TRAVERSE SUPERIEURE'], ['w', 'DES PIEDROITS']]) {
      newPage();
      const E = DT.etr, e = E.els[el];
      out.push('', `                                               ETRIERS ${nm}`);
      if (!E.need) {
        out.push('', `                                                                      PAS D'ETRIERS   (CONTRAINTE DE CISAILLEMENT < ${F(E.tau0, 2, 6)} MPA)`, '', '');
        out.push('                                  ABSCISSE        EFFORT TRANCHANT     CISAILLEMENT', '                                    (M)                 (KN)              (MPA)');
        for (const r of e.rows) out.push(`                                  ${F(r.x, 2, 6)}              ${F(r.V, 1, 7)}               ${F(r.tau, 2, 5)}`);
        continue;
      }
      out.push(`                                                                     DIAMETRE DES ETRIERS   PHI3 = ${F(d.phi[2] / 1000, 3)}`,
        `                                                                     SECTION D'ACIER PAR COURS D'ETRIER AU ML ${F(e.At, 6)} M2`,
        `                                                                     CONTRAINTE DE CISAILLEMENT LIMITE DU BETON ${F(R.mat.tauLim, 2)} MPA`, '', '',
        '                                 ABSCISSE        EFFORT TRANCHANT       CISAILLEMENT          ESPACEMENT MAXIMAL DES COURS',
        '                                   (M)                 (KN)                (MPA)                         (M)');
      for (const r of e.rows) {
        const s3 = r.s3 === null ? '' : r.s3 > 9.9995 ? ', ... ' : `,${F(r.s3, 3)}`;
        out.push(`                                 ${F(r.x, 2, 6)}              ${F(r.V, 1, 7)}               ${F(r.tau, 2, 6)}              MINIMUM(${F(e.s1, 3)} ,${F(e.s2, 3)} ${s3})`);
      }
      out.push('', '', '', 'REPARTITION LONGITUDINALE', '=========================', "                                     ABSCISSE DE DEPART    ESPACEMENTS     NOMBRE D'ETRIERS    PLAGE COUVERTE");
      let x = 0; out.push(`                                         ${F(x, 2, 8)}`);
      for (const gq of e.rep) { out.push(`                                                                ${F(gq.s, 3)}${String(gq.n).padStart(19)}${F(gq.s * gq.n, 2, 19)}`); x += gq.s * gq.n; out.push(`                                         ${F(x, 2, 8)}`); }
      out.push('', '', '', 'REPARTITION TRANSVERSALE', '========================', "           ON DISPOSE UN ETRIER SUCCESSIVEMENT SUR CHAQUE BARRE D'UN GROUPE DU FERRAILLAGE LONGITUDINAL");
    }
    newPage();
    out.push('', '', '', '', '                                            AVANT METRE RECAPITULATIF', '                                            ===========================', '', '', '', '');
    out.push('                   B E T O N S', '', `                            BETON POUR BA              ${F(Math.floor(R.metre.beton), 0, 4).replace('.', '')} M3`, '', `                            COFFRAGES                  ${F(Math.floor(R.metre.coffrage), 0, 4).replace('.', '')} M2`);
    { const t = R.det.ton.map(v => v / 1000), T = t[0] + t[1] + t[2];
      out.push('', '', '                   ACIERS', '', ...t.map((v, i) => `                            ACIER PHI${i + 1}           = ${F(v, 2, 8)} T`),
        '                                                     ---------', `                                         TOTAL   = ${F(T, 2, 9)} T`, '',
        `                 POIDS D'ACIER PAR M3 DE BETON =${F(T * 1000 / R.metre.beton, 0, 4)} KG/M3`); }
    out.push('', `                                  FIN DE LA NOTE DE CALCUL PICF91   NUMERO ${num}-`);
    // sommaire : numéros de page relevés sur la note elle-même (première page portant chaque titre)
    { const pg = []; let cur = 0; for (const l of out) { const mm = / PICF-EL NO .* PAGE +(\d+)$/.exec(l); if (mm) cur = +mm[1]; pg.push(cur); }
      const at = re => { for (let i = somIdx + 1; i < out.length; i++) if (re.test(out[i])) return pg[i]; return null; };
      const P2 = n => 'P.' + String(n).padStart(2);
      const L = [], e = (ind, re, txt) => { const n = at(re); if (n != null) L.push(' '.repeat(ind) + P2(n) + '   ' + txt); };
      L.push('* DONNEES *', '  *******');
      e(5, /CARACTERISTIQUES OPTIMISEES/, "CARACTERISTIQUES DE L'OUVRAGE ET REGLEMENTS DE CALCUL");
      e(5, /DEFINITION DES CHARGES/, 'DEFINITION DES CHARGES');
      L.push('', '* CALCUL DES EFFORTS *', '  ******************');
      e(5, /COEFFICIENTS DE MAJORATION DYNAMIQUE/, 'MOMENTS LONGITUDINAUX     COEFICIENTS DE MAJORATION DYNAMIQUE ET DE REPARTITION TRANSVERSALE');
      e(5, /LIGNES D'INFLUENCE DES MOMENTS LONGITUDINAUX/, "                          LIGNES D'INFLUENCE");
      e(5, /MOMENTS PERMANENTS DANS LES SECTIONS/, '                          MOMENTS DANS LES SECTIONS DETERMINANTES');
      e(5, /POSITION DES SURCHARGES.*TRAVERSE INFERIEURE/, '                          TRAVERSE INFERIEURE   POSITIONS DES CHARGES');
      e(5, /MOMENTS FLECHISSANTS EXTREMES.*TRAVERSE INFERIEURE/, '                                                MOMENTS EXTREMES');
      e(5, /POSITION DES SURCHARGES.*TRAVERSE SUPERIEURE/, '                          TRAVERSE SUPERIEURE   POSITIONS DES CHARGES');
      e(5, /MOMENTS FLECHISSANTS EXTREMES.*TRAVERSE SUPERIEURE/, '                                                MOMENTS EXTREMES');
      e(5, /POSITION DES SURCHARGES.*PIEDROIT/, '                          PIEDROITS             POSITIONS DES CHARGES');
      e(5, /MOMENTS FLECHISSANTS EXTREMES.*PIEDROITS/, '                                                MOMENTS EXTREMES');
      L.push('');
      e(4, /LIGNES D'INFLUENCE DU COEFFICIENT MU/, "MOMENTS TRANSVERSAUX       LIGNES D'INFLUENCE DU COEFFICIENT MU");
      e(4, /MOMENTS TRANSVERSAUX \(KN\*M\)/, '                           MOMENTS');
      L.push('');
      e(4, /EFFORTS TRANCHANTS EXTREMES DANS LA TRAVERSE INFERIEURE/, 'EFFORTS TRANCHANTS         TRAVERSE INFERIEURE');
      e(4, /EFFORTS TRANCHANTS EXTREMES DANS LA TRAVERSE SUPERIEURE/, '                           TRAVERSE SUPERIEURE');
      e(4, /EFFORTS TRANCHANTS EXTREMES DANS LES PIEDROITS/, '                           PIEDROITS');
      L.push('');
      e(4, /PRESSION SUR LE SOL/, 'PRESSIONS SOUS LA TRAVERSE INFERIEURE');
      L.push('', '* CALCUL DES FERRAILLAGES *', '  ***********************');
      e(5, /FERRAILLAGE DANS LES SECTIONS DETERMINANTES/, 'FERRAILLAGES DANS LES SECTIONS DETERMINANTES');
      e(5, /EPURE D'ARRET DES BARRES/, 'ARRETS DES BARRES          ACIERS PRINCIPAUX');
      e(5, /NOMENCLATURE DES BARRES/, '                           ACIERS AUXILIAIRES');
      e(5, /ETRIERS DE LA TRAVERSE INFERIEURE/, 'ETRIERS                    TRAVERSE INFERIEURE');
      e(5, /ETRIERS DE LA TRAVERSE SUPERIEURE/, '                           TRAVERSE SUPERIEURE');
      e(5, /ETRIERS DES PIEDROITS/, '                           PIEDROITS');
      L.push('', "* ELEMENTS POUR L'AVANT METRE *", '  ***************************');
      e(5, /AVANT METRE RECAPITULATIF/, 'AVANT METRE');
      out.splice(somIdx, 1, ...L); }
    return out.join('\n');
  }
  const PICF_NOTE = { renderNote };
  if (typeof module !== 'undefined' && module.exports) module.exports = PICF_NOTE;
  root.PICF_NOTE = PICF_NOTE;
})(typeof globalThis !== 'undefined' ? globalThis : this);
