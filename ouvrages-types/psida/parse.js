/* PSIDA-EL — lecture / écriture du bordereau des données (format SETRA imprimé en tête de listing).
 * JavaScript pur, sans dépendance. Expose globalThis.PSIDA.parseBordereau / formatBordereau.
 */
(function (G) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Description des lignes : [nom, largeur, type, décimales, options]
  //   type 'I' entier, 'F' réel (Fortran Fw.d), 'S' chaîne de chiffres (codes 001, 024…)
  //   opt.nz : zéro de tête supprimé (Fortran : ".000", ".00040")
  //   d = 0 avec type F : "3000." (point final)
  // ---------------------------------------------------------------------------
  const F = (n, w, d, o) => [n, w, 'F', d, o || {}];
  const I = (n, w) => [n, w, 'I', 0, {}];
  const S = (n, w, len) => [n, w, 'S', len, {}];

  const A3NAMES = ['LIGNINF', 'EXCENTR', 'MOMENT', 'EFTRAN', 'REAPPUI', 'MOTRAN', 'TASMENT', 'DIMAP',
    'FERLON', 'FERTRAN', 'ETRIERS', 'POINCON', 'DEFORM', 'AVMETRE', 'PP', 'DESSIN'];

  const LAYOUT = {
    A3: { lab: 2, f: A3NAMES.map((n, i) => I(n, i === 0 ? 5 : 7)) },
    A4: { lab: 2, f: A3NAMES.map((n, i) => I(n, i === 0 ? 5 : 7)) },
    A5: { lab: 2, f: [I('NT', 3), F('BIAIS', 11, 3), F('ABOUT', 9, 3), F('D1', 9, 3), F('D2', 9, 3), F('D3', 9, 3),
      F('D4', 9, 3), F('D5', 9, 3), F('D6', 9, 3)] },
    A6: { lab: 2, f: [I('NVOIE', 5), F('ETROTG', 10, 3), F('EGAU', 8, 3), F('ESURCH', 10, 3), F('EDROI', 7, 3),
      F('ETROTD', 8, 3), F('HCHAU', 7, 3), I('SYMTAB', 5), F('DISEXT', 12, 3), F('DISINT', 10, 3), I('NF', 3),
      F('YY2', 9, 3), F('YY3', 8, 3), F('YY4', 8, 3), F('YY5', 8, 3)] },
    A7: { lab: 2, f: [F('HDALLE1', 10, 3), F('HDALLE2', 9, 3), F('HDALLE3', 9, 3), F('EDALLE1', 10, 3),
      F('EDALLE2', 8, 3), F('EDALLE3', 9, 3)] },
    A8: { lab: 2, f: [S('STATUT', 9, 3), F('MASVOL', 7, 3), F('OSMAX', 8, 3), F('OSMIN', 7, 3), F('QSUPMAX', 7, 3),
      F('QSUPMIN', 7, 3), S('A', 7, 3), S('B', 4, 3), S('CE', 4, 3), F('PSTROT', 9, 3), F('DGRADI', 6, 1),
      F('XGRADI', 6, 1), F('XKA', 9, 3), F('XKBC', 6, 3), F('XKBT', 6, 3), F('XKCM', 6, 3), F('XKTR', 6, 3)] },
    A9: { lab: 2, f: [S('GENRE', 7, 3), S('BA', 5, 3), F('XKI', 5, 3, { nz: 1 }), F('POISSON', 6, 3, { nz: 1 }),
      F('FCJ', 7, 0), F('FTJ', 6, 0), F('RETRAI', 7, 5, { nz: 1 })] },
    A10: { lab: 3, f: [F('PHI1', 9, 3), F('PHI2', 7, 3), F('PHI3', 7, 3), F('PHI4', 7, 3), F('FE1', 9, 0),
      F('FE2', 9, 0), F('FE3', 9, 0), F('FE4', 9, 0), I('NA1', 5), I('NA2', 5), I('NA3', 5), I('NA4', 5),
      F('ETA1', 9, 2), F('ETA2', 6, 2), F('ETA3', 6, 2), F('ETA4', 6, 2), F('PSID', 6, 2)] },
    A11: { lab: 3, f: [I('N1', 6), I('N2', 5), F('ESPAC1', 8, 3), F('ESPAC2', 8, 3), F('ENROBS', 8, 3),
      F('ENROBI', 8, 3)] },
    A12: { lab: 3, f: [F('YOUNG', 9, 3), F('KTP', 7, 3)].concat(
      [1, 2, 3, 4, 5, 6, 7].flatMap(i => [F('TP' + i, 7, 3), F('DTP' + i, 7, 3)])) },
    A13: { lab: 3, f: [F('COMPRENV', 10, 0), F('COMPREBV', 10, 0), F('COMPRENS', 10, 0), F('COMPREBS', 10, 0),
      I('SYMAP', 6)].concat([1, 2, 3, 4, 5, 6, 7].flatMap(i => [I('TYPAP' + i, 5), I('NAP' + i, 3)])) },
    C1: { lab: 2, f: [F('XB', 7, 2), F('SS1', 8, 0), F('SS2', 8, 0), F('SS3', 8, 0), F('SS4', 8, 0)] },
  };
  // Variante de mise en page (listings 2006 : A6 EDROI F6.3 / HCHAU F8.3)
  const A6_2006 = { lab: 2, f: LAYOUT.A6.f.map(x => x[0] === 'EDROI' ? F('EDROI', 6, 3) : x[0] === 'HCHAU' ? F('HCHAU', 8, 3) : x) };

  const LABELS = {
    A5: '    NT   BIAIS      ABOUT    D1       D2       D3       D4       D5       D6',
    A6: '    NVOIE   ETROTG   EGAU   ESURCH  EDROI  ETROTD  HCHAU   SYMTAB   DISEXT   DISINT   NF   YY(2)   YY(3)   YY(4)   YY(5)',
    A7: '      HDALLE1  HDALLE2  HDALLE3  EDALLE1  EDALLE2  EDALLE3',
    A8: '      STATUT MASVOL  OSMAX  OSMIN  QSUPMAX QSUPMIN  A   B  CE    PSTROT DGRADI XGRADI XKA    XKBC  XKBT  XKCM  XKTR',
    A9: '    GENRE  BA  XKI  POISSON  FCJ  FTJ  RETRAI',
    A10: '       PHI1   PHI2   PHI3   PHI4    FE1      FE2      FE3      FE4      NA1  NA2  NA3  NA4   ETA1  ETA2  ETA3  ETA4  PSID',
    A11: '       N1   N2  ESPAC1  ESPAC2  ENROBS  ENROBI',
    A12: '      YOUNG   KTP    TP1    DTP1   TP2    DTP2   TP3    DTP3   TP4    DTP4   TP5    DTP5   TP6    DTP6   TP7    DTP7',
    A13: '      COMPRENV  COMPREBV  COMPRENS  COMPREBS  SYMAP  APPUI1  APPUI2  APPUI3  APPUI4  APPUI5  APPUI6  APPUI7',
  };
  const GRID = [
    '      L      E      M      E      R      M      T      D      F      F      E      P      D      A      P      D',
    '      I      X      O      F      E      O      A      I      E      E      T      O      E      V      P      E',
    '      G      C      M      T      A      T      S      M      R      R      R      I      F      A             S',
    '      N      E      E      R      P      R      M      A      L      T      I      N      O      N             S',
    '      I      N      N      A      P      A      E      P      O      R      E      C      R      T             I',
    '      N      T      T      N      U      N      N             N      A      R      O      M                    N',
  ];

  // ---------------------------------------------------------------- utilitaires
  function pad(s, w) { s = String(s); return s.length >= w ? s : ' '.repeat(w - s.length) + s; }
  function padR(s, w) { s = String(s); return s.length >= w ? s : s + ' '.repeat(w - s.length); }

  function fmtField(v, spec) {
    const [, w, t, d, o] = spec;
    let s;
    if (t === 'I') s = String(Math.round(v || 0));
    else if (t === 'S') s = String(v == null ? '' : v);
    else {
      const x = v || 0;
      s = d === 0 ? Math.round(x).toFixed(0) + '.' : x.toFixed(d);
      if (o.nz) s = s.replace(/^(-?)0\./, '$1.');
    }
    return pad(s, w);
  }

  // Découpe tolérante d'une ligne de données en jetons (fusionne les artefacts "0. 000", ".00 0")
  function tokens(rest, n) {
    let t = rest.trim().split(/\s+/).filter(Boolean);
    let guard = 0;
    while (t.length > n && guard++ < 20) {
      let k = -1;
      for (let i = 0; i < t.length - 1; i++) {
        if (/\.\d*$/.test(t[i]) && /^\d+$/.test(t[i + 1])) { k = i; break; }
      }
      if (k < 0) break;
      t.splice(k, 2, t[k] + t[k + 1]);
    }
    return t;
  }

  function readLine(line, key) {
    const lay = LAYOUT[key];
    const rest = line.replace(/^\s*[A-C]\d+/, '');
    const t = tokens(rest, lay.f.length);
    const o = {};
    lay.f.forEach((spec, i) => {
      const [n, , ty] = spec;
      const raw = t[i];
      if (raw === undefined) { o[n] = ty === 'S' ? '000' : 0; return; }
      if (ty === 'S') o[n] = raw;
      else o[n] = Number(raw);
    });
    return o;
  }

  // ---------------------------------------------------------------- parse
  function parseBordereau(text) {
    const lines = String(text).replace(/\r/g, '').replace(/\f/g, '\n').split('\n');
    const m = { numero: null, date: null, titre: ['', ''], lignes: {}, source: {} };
    let iHead = -1, iGrid = -1;
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      if (m.numero == null) {
        const mm = /^\s*PSIDAEL(?:\s+([0-9A-Z]{1,6})\b)?/.exec(L);
        if (mm) { m.numero = mm[1] || null; iHead = i; continue; }
      }
      if (!m.date && iHead >= 0 && iGrid < 0) {
        const md = /^\s*(\d{2})\s+(\d{2})\s+(\d{2})\s/.exec(L + ' ');
        if (md) { m.date = { j: md[1], m: md[2], a: md[3] }; continue; }
      }
      if (iGrid < 0 && /^\s*L\s+E\s+M\s+E\s+R\s+M/.test(L)) { iGrid = i; break; }
    }
    if (iGrid < 0) throw new Error('bordereau PSIDA : grille A3 introuvable');
    // titres A1/A2 : lignes non vides entre l'en-tête et la grille
    let start = 0;
    for (let i = iGrid - 1; i >= 0; i--) {
      if (/BORDEREAU DES DONNEES|^\s*\*{5,}|^\s*PAGE\s+0|^#/.test(lines[i])) { start = i + 1; break; }
    }
    const tit = [];
    for (let i = start; i < iGrid; i++) {
      if (/^\s*PAGE\s+0/.test(lines[i]) || /\*{5,}/.test(lines[i])) continue;
      const s = lines[i].replace(/\s+$/, '');
      if (s.trim()) tit.push(s.trim());
    }
    m.titre = [tit[0] || '', tit[1] || ''];
    // lignes A3..A13, C1..C3, B1..B4 jusqu'à la fin du bordereau
    for (let i = iGrid; i < lines.length; i++) {
      const L = lines[i];
      if (/MINISTERE|NOTE DE CALCUL DE PONT|^\s*X{6,}/.test(L)) break;
      const mm = /^\s*(A\d{1,2}|B\d|C\d)\s/.exec(L + ' ');
      if (!mm) continue;
      const key = mm[1];
      if (LAYOUT[key]) {
        m.lignes[key] = readLine(L, key);
        m.source[key] = L.replace(/\s+$/, '');
        if (key === 'A6') m._a6 = L.replace(/\s+$/, '');
      } else (m.lignes[key + '_raw'] = m.lignes[key + '_raw'] || []).push(L.replace(/^\s*\S+/, '').trim());
    }
    const req = ['A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13'];
    for (const k of req) if (!m.lignes[k]) throw new Error('bordereau PSIDA : ligne ' + k + ' absente');
    // variante de mise en page : année 2006 et avant (A6 EDROI sur 6 colonnes)
    m.version = detectVersion(m);
    delete m._a6;
    return m;
  }

  function detectVersion(m) {
    const L = m._a6 || '';
    const ends = []; const re = /\S+/g; let x;
    while ((x = re.exec(L))) ends.push(x.index + x[0].length);
    return ends[5] === 41 ? '2006' : 'V92';
  }

  // ---------------------------------------------------------------- format
  function fmtLine(key, obj, lay, src) {
    lay = lay || LAYOUT[key];
    // option « conserver la mise en page » : on réémet la ligne source si elle relit les mêmes valeurs
    if (src && JSON.stringify(readLine(src, key)) === JSON.stringify(obj)) return src;
    let s = padR(key, lay.lab);
    for (const spec of lay.f) s += fmtField(obj[spec[0]], spec);
    return s;
  }

  function formatBordereau(m, opts) {
    opts = opts || {};
    const L = m.lignes;
    const S = opts.conserverMiseEnPage && m.source ? m.source : {};
    const out = [];
    const num = m.numero == null ? '' : String(m.numero);
    const d = m.date || { j: '  ', m: '  ', a: '  ' };
    out.push(padR('PSIDAEL ' + num, 52) + '***************************');
    out.push(padR(d.j + '  ' + d.m + '  ' + d.a, 52) + '*  BORDEREAU DES DONNEES  *');
    out.push(padR('PAGE   0', 52) + '***************************');
    out.push('', '', '');
    out.push('    ' + (m.titre[0] || ''));
    out.push('   ' + (m.titre[1] || ''));
    out.push('');
    out.push(...GRID);
    out.push(fmtLine('A3', L.A3, null, S.A3), fmtLine('A4', L.A4, null, S.A4), '');
    for (const k of ['A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13']) {
      out.push(LABELS[k]);
      out.push(fmtLine(k, L[k], k === 'A6' && m.version === '2006' ? A6_2006 : null, S[k]));
      if (k !== 'A13') out.push('');
    }
    for (const k of ['C1']) if (L[k]) out.push(fmtLine(k, L[k], null, S[k]));
    for (const k of Object.keys(L)) if (/_raw$/.test(k)) for (const r of L[k]) out.push(k.slice(0, 2) + '   ' + r);
    return out.map(x => (x === '' ? ' ' : x + ' ')).join('\n') + '\n';
  }

  const api = { parseBordereau, formatBordereau, BORDEREAU_LAYOUT: LAYOUT, A3NAMES };
  G.PSIDA = Object.assign(G.PSIDA || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
