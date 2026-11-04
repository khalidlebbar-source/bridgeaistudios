// PIPO-EL — lecture / écriture du bordereau SETRA (cartes 1..8, S0..S4).
// parseBordereau(texte) -> modèle ; formatBordereau(modèle) -> texte (format "BORDEREAU DES DONNEES DU PIPO N.xxxx").
(function (root) {
  'use strict';
  const A1 = ['CLASSE', 'STATUT', 'LU', 'EXCENTR', 'DALTRA', 'SUREMB', 'LIGNIN', 'POUST', 'PERM', 'TROT', 'AL', 'BC', 'BT', 'MC', 'ME', 'EXCEP',
    'MOMENT', 'EFTRAN', 'MOTRAN', 'PRESS', 'SUITE2', 'ARBEI', 'FERTRA', 'ETRIER', 'METRE', 'LIBDIM', 'DESSIN', 'MRB', 'PSH2', 'FIXSEM', 'FIP'];
  // [nom, format] ; format : ['F',w,d] réel, ['I',w] entier, ['E',w] réel sans décimale (F w.0)
  const CARDS = {
    A2: { label: 'CARTE 2 - HAUTL   HREMB   OUVER   BIAIS    E2      E3      W      DELTA GEN  ECHEL',
      f: [['HAUTL', 'F', 8, 3], ['HREMB', 'F', 8, 3], ['OUVER', 'F', 8, 3], ['BIAIS', 'F', 8, 3], ['E2', 'F', 8, 3], ['E3', 'F', 8, 3], ['W', 'F', 8, 3], ['DELTA', 'F', 8, 3], ['GENRE', 'I', 3], ['ECHELLE', 'F', 8, 3]] },
    A3: { label: 'CARTE 3 - ETROG   EGAUC   ESURC   EDROI   ETROD  IS  IV   HCHAU   HSREM   LDALT',
      f: [['ETROTG', 'F', 8, 3], ['EGAU', 'F', 8, 3], ['ESURCH', 'F', 8, 3], ['EDROI', 'F', 8, 3], ['ETROTD', 'F', 8, 3], ['SENS', 'I', 4], ['PVOIE', 'I', 4], ['HCHAU', 'F', 8, 3], ['HSREMB', 'F', 8, 3], ['LDALT', 'F', 8, 3]] },
    A4: { label: 'CARTE 4 - RANK1   RANK2   ESOL    PREMA   SPEC    QSUP    QDT     PSREM   PSTRO   RETRA   TEMPE',
      f: [['RANK1', 'F', 8, 3], ['RANK2', 'F', 8, 3], ['ESOL', 'F', 8, 0], ['PREMAX', 'F', 8, 3], ['SPEC', 'F', 8, 3], ['QSUP', 'F', 8, 3], ['QDT', 'F', 8, 3], ['PSREMB', 'F', 8, 3], ['PSTROT', 'F', 8, 3], ['RETRAIT', 'F', 8, 0], ['TEMP', 'F', 8, 0]] },
    A5: { label: 'CARTE 5 - COEFA  COEFB  COEFM  COEFE  KTR   KSA   KBC   KBT   KMC   KME   KEX',
      ind: 8, f: [['COEFA', 'F', 7, 3], ['COEFB', 'F', 7, 3], ['COEFM', 'F', 7, 3], ['COEFEX', 'F', 7, 3], ['KTROT', 'F', 7, 3], ['KA', 'F', 6, 3], ['KBC', 'F', 6, 3], ['KBT', 'F', 6, 3], ['KMC', 'F', 6, 3], ['KME', 'F', 6, 3], ['KEXCEP', 'F', 6, 3]] },
    A6: { label: 'CARTE 6 - PHI1     PHI2    PHI3   SIGN1   SIGN2   SIGN3    SIGBP',
      f: [['PHI1', 'F', 8, 3], ['PHI2', 'F', 8, 3], ['PHI3', 'F', 8, 3], ['SIGMA1', 'F', 9, 0], ['SIGMA2', 'F', 8, 0], ['SIGMA3', 'F', 8, 0], ['SIGMAF', 'F', 8, 0]] },
    S0: { label: 'CARTE S0 - LVOIE   CDTA1   CDTB1   CDTA2   CDTB2   CDTA3   CDTB3   CDTA4   CDTB4   CDTA5   CDTB5   CDTA6   CDTB6',
      f: [['LVOIE', 'F', 8, 3]].concat([1, 2, 3, 4, 5, 6].flatMap(j => [['CDTA' + j, 'F', 8, 3], ['CDTB' + j, 'F', 8, 3]])) },
    S1: { label: 'CARTE S1 - A1      A0', f: [['A1', 'F', 8, 3], ['A0', 'F', 8, 3]] },
    S2: { label: 'CARTE S2 - NVOIE NCAM NES TYPE ESAV ESAR LONGENC LARGENC LARGES  DYNAB',
      f: [['NVOI', 'I', 6], ['NCAM', 'I', 5], ['NES', 'I', 4], ['TYPE', 'I', 5], ['ESAV', 'I', 5], ['ESAR', 'I', 5], ['LONGENC', 'F', 8, 3], ['LARGENC', 'F', 8, 3], ['LARGES', 'F', 8, 3], ['DYNAB', 'F', 8, 3]] },
    S3: { label: 'CARTE S3 - ABESS1  POESS1  ABESS2  POESS2  ABESS3  POESS3  ABESS4  POESS4  ABESS5  POESS5  ABESS6  POESS6',
      f: [1, 2, 3, 4, 5, 6].flatMap(j => [['ABESS' + j, 'F', 8, 3], ['POESS' + j, 'F', 8, 3]]) },
    S4: { label: 'CARTE S4 - DYCHA   POICHA  LARGCHA LOCHE   CHELA   ESCHE',
      f: [['DYCHA', 'F', 8, 3], ['POICHA', 'F', 8, 3], ['LARGCHA', 'F', 8, 3], ['LOCHE', 'F', 8, 3], ['CHELA', 'F', 8, 3], ['ESCHE', 'F', 8, 3]] },
  };

  function num(t) { const v = parseFloat(t); return isFinite(v) ? v : 0; }
  function fmtF(v, w, d) {
    let s = d === 0 ? Math.round(v).toFixed(0) + '.' : v.toFixed(d);
    if (s === '-0.' || /^-0\.0*$/.test(s)) s = s.slice(1);
    return s.padStart(w);
  }
  function fmtField(v, spec) { const [, t, w, d] = spec; return t === 'I' ? String(Math.round(v)).padStart(w) : fmtF(v, w, d); }

  function parseBordereau(texte) {
    const lines = String(texte).replace(/\r/g, '').split('\n');
    const m = { A1: {}, cartes: {}, titre: '', soustitre: '', numero: '', date: '', present: [], style: {} };
    let i0 = lines.findIndex(l => /BORDEREAU DES DONNEES DU PIPO/.test(l));
    if (i0 >= 0) { const mm = lines[i0].match(/PIPO N\.\s*(\S+)/); if (mm) m.numero = mm[1]; }
    // fin du bordereau : début du contrôle des données
    let iEnd = lines.findIndex((l, k) => k > i0 && /RESULTATS DU CONTROLE/.test(l)); if (iEnd < 0) iEnd = lines.length;
    for (let k = Math.max(0, i0); k < iEnd; k++) {
      const l = lines[k];
      let mm = l.match(/^CARTE\s+(\S+)\s+-(.*)$/);
      if (!mm) continue;
      const c = mm[1], rest = mm[2];
      if (c === '1') {
        const toks = rest.trim().split(/\s+/).filter(Boolean).map(Number);
        A1.forEach((n, j) => { m.A1[n] = toks[j] || 0; });
        m.style.trail = (l.match(/ *$/)[0] || '').length; m.present.push('A1');
      } else if (c === '7') {
        const s = rest.replace(/^ /, '');
        const p2 = s.lastIndexOf('/'), p1 = s.lastIndexOf('/', p2 - 1);
        if (p1 >= 0) { m.titre = s.slice(0, p1).replace(/\s+$/, ''); m.numero = m.numero || s.slice(p1 + 1, p2).trim(); m.date = s.slice(p2 + 1).trim(); m.style.titreW = p1; }
        else m.titre = s.trim();
        m.present.push('A7');
      } else if (c === '8') { m.soustitre = rest.replace(/^ /, '').replace(/\s+$/, ''); m.style.t8 = rest.length - rest.replace(/\s+$/, '').length; m.present.push('A8'); }
      else {
        const key = /^S\d$/.test(c) ? c : 'A' + c; const def = CARDS[key]; if (!def) continue;
        // ligne de valeurs : première ligne non vide suivante ne commençant pas par CARTE
        let v = ''; for (let q = k + 1; q < iEnd; q++) { if (/^CARTE/.test(lines[q])) break; if (lines[q].trim()) { v = lines[q]; break; } }
        const toks = v.trim().split(/\s+/).filter(Boolean);
        const o = {}; def.f.forEach((f, j) => { o[f[0]] = num(toks[j]); }); m.cartes[key] = o; m.present.push(key);
      }
    }
    return m;
  }

  // Modèle -> texte, au format du bordereau reproduit en tête des listings PIPO-EL récents.
  function formatBordereau(m, opt) {
    opt = opt || {}; const T = ' '.repeat(m.style && m.style.trail != null ? m.style.trail : 1);
    const L = [];
    const sp = '                               ', star = sp + '********************************************' + T;
    L.push(star, sp + '*                                          *' + T);
    L.push(sp + '* ' + ('BORDEREAU DES DONNEES DU PIPO N.' + (m.numero || '')).padEnd(40) + ' *' + T);
    L.push(sp + '*                                          *' + T, star, ' ' + T.slice(1), ' ' + T.slice(1));
    const h = ['           C  S  L  E  D  S  L  P  P  T  A  B  B  M  M  E   M  E  M  P  S  A  F  E  M  L  D  M  P  F  F',
      '           L  T  U  X  A  U  I  O  E  R     C  T  C  E  X   O  F  O  R  U  R  E  T  E  I  E  R  S  I  I',
      '           A  A     C  L  R  G  U  R  O                     M  T  T  E  I  B  R  R  T  B  S  B  H  X  P',
      '           S  T     E  T  E  N  S  M  T                     E  R  R  S  T  A  T  I  R  D  S     2  S'];
    h.forEach(x => L.push(x + T));
    const v = A1.map(n => String(m.A1[n] ?? 0).padStart(3));
    L.push('CARTE 1 -' + v.slice(0, 16).join('') + ' ' + v.slice(16).join('') + T, ' ' + T.slice(1));
    for (const key of ['A2', 'A3', 'A4', 'A5', 'A6']) {
      const def = CARDS[key], o = (m.cartes && m.cartes[key]) || {};
      L.push(def.label + T);
      L.push(' '.repeat(def.ind || 7) + def.f.map(f => fmtField(o[f[0]] || 0, f)).join('') + T);
      if (key !== 'A6') L.push(' ' + T.slice(1));
    }
    const titre = (m.titre || '');
    L.push(('CARTE 7 - ' + titre.padEnd(m.style && m.style.titreW || 60) + '/' + String(m.numero || '').padEnd(8) + '/' + (m.date || '')) + T);
    L.push(' ' + T.slice(1));
    L.push('CARTE 8 - ' + (m.soustitre || '') + (m.soustitre ? T : ' '.repeat(Math.max(0, ((m.style && m.style.t8) || 1) - 1))));
    for (const key of ['S0', 'S1', 'S2', 'S3', 'S4']) {
      if (!(m.cartes && m.cartes[key])) continue;
      const def = CARDS[key], o = m.cartes[key];
      L.push(' ' + T.slice(1), def.label + T, '       ' + def.f.map(f => fmtField(o[f[0]] || 0, f)).join('') + T);
    }
    return L.join('\n');
  }

  // Accès à plat : m.v('HAUTL')
  function flat(m) { const o = Object.assign({}, m.A1); for (const k in m.cartes) Object.assign(o, m.cartes[k]); return o; }

  const api = { parseBordereau, formatBordereau, flat, A1_NAMES: A1, CARDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PIPO_PARSE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
