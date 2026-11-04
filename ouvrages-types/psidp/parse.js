// PSIDP-EL — lecture / écriture du bordereau des données (format imprimé en tête des notes SETRA PSIDP91)
// Module sans dépendance (navigateur + Node). Expose parseBordereau(texte) et formatBordereau(modele).
(function (root) {
  'use strict';

  // Gabarit SETRA standard (passage 0013 et suivants) : lignes d'en-tête des cartes.
  var STD_HEADERS = {
    LIGN: 'LIGN  EXCE  MOME  EFTR  REAP  MOTR  TASM  DIMA  CABL  FERT  ETRI  POIN  DEFO  METRE  PP   DES',
    NT: 'NT    BIAIS    ABOUT     D1       D2       D3       D4       D5       D6     ND1  ND2  ND3  ND4  ND5  ND6',
    NV: "NV  ETROG  EGAU    ESURCH  EDROI  ETROD  HCHAU  SYM   DISEXT   DISINT  NF   YY(2)   YY(3)   YY(4)   YY(5)",
    HDAL1: "HDAL1  HDAL2  HDAL3   EDAL1  EDAL2  EDAL3     S         I       V      V'",
    STA: 'STA  MASVO   OSSAX   OSSAN   QSUPX   QSUPN   A    B    CE   TROT  DT    PSI0     KA     KBC    KBT    KCM    KTR',
    GEN: 'GEN   BP   PSI1   POIS   FCJ   FC28    FE1     FE2      ETA',
    PROCEDE: ' PROCEDE      UNITE    FPRG      FPEG   SIGMAP0     EP      NCA  SECT   DGAIN  COUVS  COUVI  DECAL  RMIN',
    MOD: 'MOD    F     PHI    RECUL  EPSI0   RO     MU0   KFL     RT',
    DSIG: 'DSIG   YOUNG   KTP    TP1    DTP1   TP2    DTP2   TP3    DTP3   TP4    DTP4   TP5    DTP5   TP6    DTP6   TP7    DTP7',
    CNV: ' CNV    CBV    CNS    CBS   SYM  APP1   APP2   APP3   APP4   APP5   APP6   APP7',
    PAS: '  PAS      A(0)     A(1)     A(2)                 A(3)         A(4)      LVOIE    CDTA1      CDTA2    CDTA3    CDTA4      CDTA5     CDTA6'
  };
  var CARD_ORDER = ['LIGN', 'NT', 'NV', 'HDAL1', 'STA', 'GEN', 'PROCEDE', 'MOD', 'DSIG', 'CNV'];
  // Positions (fin de colonne exclusive) des valeurs dans le gabarit standard
  var STD_POS = {
    LIGN: [[[2, 3], [8, 9], [14, 15], [20, 21], [26, 27], [32, 33], [38, 39], [44, 45], [50, 51], [56, 57], [62, 63], [68, 69], [74, 75], [80, 81], [86, 87], [92, 93]],
      [[2, 3], [8, 9], [14, 15], [32, 33], [50, 51]]],
    NT: [[[1, 2], [6, 12], [15, 20], [23, 29], [32, 38], [41, 47], [50, 56], [60, 65], [69, 74], [77, 79], [82, 84], [87, 89], [92, 94], [98, 99], [103, 104]]],
    NV: [[[1, 2], [4, 9], [11, 16], [20, 25], [27, 32], [34, 39], [41, 46], [50, 51], [55, 60], [64, 69], [72, 73], [76, 81], [84, 89], [92, 97], [100, 105]]],
    HDAL1: [[[0, 5], [7, 12], [14, 19], [22, 27], [29, 34], [36, 41], [44, 50], [52, 60], [62, 67], [69, 74]]],
    STA: [[[0, 3], [5, 10], [13, 18], [21, 26], [29, 34], [37, 42], [44, 47], [49, 52], [54, 57], [60, 64], null, null, [79, 84], [86, 91], [93, 98], [100, 105], [107, 112]]],
    GEN: [[[0, 3], [5, 8], [11, 15], [18, 22], [24, 29], [31, 36], [38, 44], [46, 52], [55, 60]]],
    PROCEDE: [[[0, 9], [13, 19], [22, 29], [31, 38], [40, 47], [49, 58], [62, 63], [65, 70], [72, 77], [79, 84], [86, 91], [93, 98], [100, 105]]],
    MOD: [[[1, 2], [5, 9], [11, 17], [19, 25], [27, 32], [35, 39], [41, 45], [48, 52], [54, 59]]],
    DSIG: [[[3, 5], [7, 12], [14, 19], [21, 26], [28, 33], [35, 40], [42, 47], [49, 54], [56, 61], [63, 68], [70, 75], [77, 82], [84, 89], [91, 96], [98, 103], [105, 110], [112, 117]]],
    CNV: [[[1, 5], [7, 12], [14, 19], [21, 26], [29, 30], [33, 34], [36, 37], [40, 41], [43, 44], [47, 48], [50, 51], [54, 55], [57, 58], [61, 62], [64, 65], [68, 69], [71, 72], [75, 76]]]
  };
  // Noms des champs de chaque carte (dans l'ordre des colonnes)
  var FIELDS = {
    LIGN: [['LIGN', 'EXCE', 'MOME', 'EFTR', 'REAP', 'MOTR', 'TASM', 'DIMA', 'CABL', 'FERT', 'ETRI', 'POIN', 'DEFO', 'METRE', 'PP', 'DES'],
      ['LIGN2', 'EXCE2', 'MOME2', 'MOTR2', 'CABL2']],
    NT: [['NT', 'BIAIS', 'ABOUT', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'ND1', 'ND2', 'ND3', 'ND4', 'ND5', 'ND6']],
    NV: [['NV', 'ETROG', 'EGAU', 'ESURCH', 'EDROI', 'ETROD', 'HCHAU', 'SYM', 'DISEXT', 'DISINT', 'NF', 'YY2', 'YY3', 'YY4', 'YY5']],
    HDAL1: [['HDAL1', 'HDAL2', 'HDAL3', 'EDAL1', 'EDAL2', 'EDAL3', 'S', 'I', 'V', 'VP']],
    STA: [['STA', 'MASVO', 'OSSAX', 'OSSAN', 'QSUPX', 'QSUPN', 'A', 'B', 'CE', 'TROT', 'DT', 'PSI0', 'KA', 'KBC', 'KBT', 'KCM', 'KTR']],
    GEN: [['GEN', 'BP', 'PSI1', 'POIS', 'FCJ', 'FC28', 'FE1', 'FE2', 'ETA']],
    PROCEDE: [['PROCEDE', 'UNITE', 'FPRG', 'FPEG', 'SIGMAP0', 'EP', 'NCA', 'SECT', 'DGAIN', 'COUVS', 'COUVI', 'DECAL', 'RMIN']],
    MOD: [['MOD', 'F', 'PHI', 'RECUL', 'EPSI0', 'RO', 'MU0', 'KFL', 'RT']],
    DSIG: [['DSIG', 'YOUNG', 'KTP', 'TP1', 'DTP1', 'TP2', 'DTP2', 'TP3', 'DTP3', 'TP4', 'DTP4', 'TP5', 'DTP5', 'TP6', 'DTP6', 'TP7', 'DTP7']],
    CNV: [['CNV', 'CBV', 'CNS', 'CBS', 'SYMAP', 'TYPAP1', 'NAP1', 'TYPAP2', 'NAP2', 'TYPAP3', 'NAP3', 'TYPAP4', 'NAP4', 'TYPAP5', 'NAP5', 'TYPAP6', 'NAP6', 'TYPAP7', 'NAP7']],
    PAS: [['PAS', 'A0', 'A1', 'A2', 'A3', 'A4', 'LVOIE', 'CDTA1', 'CDTA2', 'CDTA3', 'CDTA4', 'CDTA5', 'CDTA6']]
  };
  var STRING_FIELDS = { PROCEDE: 1, UNITE: 1 };

  function tokens(line) {
    var out = [], re = /\S+/g, m;
    while ((m = re.exec(line))) out.push({ t: m[0], s: m.index, e: m.index + m[0].length });
    return out;
  }
  function headerKey(line) {
    var t = line.trim();
    if (/^LIGN\s/.test(t)) return 'LIGN';
    if (/^NT\s+BIAIS/.test(t)) return 'NT';
    if (/^NV\s+ETROG/.test(t)) return 'NV';
    if (/^HDAL1\s/.test(t)) return 'HDAL1';
    if (/^STA\s+MASVO/.test(t)) return 'STA';
    if (/^GEN\s+BP/.test(t)) return 'GEN';
    if (/^PROCEDE\s+UNITE/.test(t)) return 'PROCEDE';
    if (/^MOD\s+F\s/.test(t)) return 'MOD';
    if (/^DSIG\s/.test(t)) return 'DSIG';
    if (/^CNV\s/.test(t)) return 'CNV';
    if (/^PAS\s+A\(0\)/.test(t)) return 'PAS';
    if (/^COTES DES CABLES/.test(t)) return 'COTES';
    if (/^CHARGES D'EXPLOITATION GENERALISEES/.test(t)) return 'CEGEN';
    return null;
  }
  function toNum(s) {
    if (s === undefined || s === null || s === '') return null;
    var v = Number(s);
    return isNaN(v) ? s : v;
  }

  // Attribution des valeurs aux champs : séquentielle par colonnes de l'en-tête (chevauchement),
  // les colonnes vides (DT, PSI0, deuxième ligne d'options) sont détectées par position.
  function assign(key, row, vals, hdrToks) {
    var names = FIELDS[key][row];
    if (key === 'CNV' || key === 'DSIG' || (key === 'LIGN' && row === 0) || key === 'NT' || key === 'NV' ||
      key === 'HDAL1' || key === 'GEN' || key === 'PROCEDE' || key === 'MOD' || key === 'PAS') {
      // séquentiel
      return vals.map(function (v, i) { return names[i]; });
    }
    if (key === 'STA') {
      // DT et PSI0 éventuellement vides : on se repère sur l'en-tête
      var res = [];
      vals.forEach(function (v) {
        var best = null, bd = 1e9;
        hdrToks.forEach(function (h, j) {
          var d = Math.abs((v.s + v.e) / 2 - (h.s + h.e) / 2);
          if (d < bd) { bd = d; best = j; }
        });
        res.push(names[best]);
      });
      // garantir l'unicité et l'ordre
      return res;
    }
    if (key === 'LIGN' && row === 1) {
      // deuxième ligne des options : alignée sous LIGN EXCE MOME ... MOTR ... CABL
      return vals.map(function (v) {
        var best = 0, bd = 1e9;
        hdrToks.forEach(function (h, j) { var d = Math.abs(v.e - h.s - 1.5); if (d < bd) { bd = d; best = j; } });
        var hn = hdrToks[best].t;
        return { LIGN: 'LIGN2', EXCE: 'EXCE2', MOME: 'MOME2', MOTR: 'MOTR2', CABL: 'CABL2', EFTR: 'EFTR2', REAP: 'REAP2', TASM: 'TASM2', DIMA: 'DIMA2' }[hn] || (hn + '2');
      });
    }
    return vals.map(function (v, i) { return names[i]; });
  }

  function parseBordereau(texte) {
    var lines = String(texte).replace(/\r/g, '').replace(/\f/g, '\n').split('\n');
    var i0 = -1;
    for (var i = 0; i < lines.length; i++) if (/BORDEREAU DES DONNEES DU PSIDP/.test(lines[i])) { i0 = i; break; }
    if (i0 < 0) throw new Error('Bordereau PSIDP introuvable');
    var L = [];
    for (i = i0; i < lines.length; i++) {
      var l = lines[i].replace(/\s+$/, '');
      if (/CONTROLE SOMMAIRE DE COMPATIBILITE/.test(l)) break;
      if (l.trim() === '') continue;
      L.push(l);
    }
    var model = { values: {}, raw: {}, layout: { cards: {} }, titres: [], cotes: null, extra: [] };
    var m = /NUMERO\s+(\S+)\s+PASSAGE DU\s+(\S+)/.exec(L[0]);
    model.layout.line0 = L[0];
    model.layout.line1 = L[1];
    model.numeroRaw = m ? m[1] : '';
    model.passage = m ? m[2] : '';
    // ligne NUM S DATE
    var k = 2;
    model.layout.numHdr = L[k];
    var nt = tokens(L[k + 1]);
    model.layout.numToks = nt.map(function (t) { return [t.s, t.e]; });
    model.numeroRaw2 = nt[0] ? nt[0].t : '';
    model.date = nt[1] ? nt[1].t : '';
    var mm = /^(\d+)-(\S*)$/.exec(model.numeroRaw2);
    model.numero = mm ? mm[1] : model.numeroRaw2;
    model.suffixe = mm ? mm[2] : '';
    k += 2;
    while (k < L.length && !headerKey(L[k])) { model.titres.push(L[k].replace(/^\s+/, '')); k++; }
    var cur = null, row = 0;
    for (; k < L.length; k++) {
      var line = L[k];
      var hk = headerKey(line);
      if (hk === 'COTES') {
        model.cotes = { hdr: [line], rows: [] };
        k++;
        while (k < L.length && /^-+\s*$/.test(L[k].trim())) { model.cotes.hdr.push(L[k]); k++; }
        if (k < L.length && /0\.1L/.test(L[k])) { model.cotes.hdr.push(L[k]); k++; }
        while (k < L.length && !headerKey(L[k])) {
          model.cotes.rows.push(tokens(L[k]).map(function (t) { return t.t; }));
          k++;
        }
        k--; cur = null; continue;
      }
      if (hk === 'CEGEN') {
        model.layout.cegen = [line];
        if (k + 1 < L.length && /^-+\s*$/.test(L[k + 1].trim())) { model.layout.cegen.push(L[k + 1]); k++; }
        cur = null; continue;
      }
      if (hk) { cur = hk; row = 0; model.layout.cards[cur] = { hdr: line, rows: [] }; continue; }
      if (!cur) { model.extra.push(line); continue; }
      var toks = tokens(line);
      // ligne additionnelle non standard (ex. '+0.0 +1.8' sous PROCEDE)
      if (cur === 'PROCEDE' && row >= 1) {
        model.layout.cards[cur].rows.push({ extra: true, line: line, toks: toks.map(function (t) { return [t.s, t.e]; }) });
        model.values.PROCEDE_X = toks.map(function (t) { return t.t; });
        continue;
      }
      if (cur === 'PROCEDE') {
        // le nom du procédé peut contenir un point, l'unité est le 2e jeton
      }
      var hdrToks = tokens(model.layout.cards[cur].hdr);
      var names = assign(cur, row, toks, hdrToks);
      var pos = [];
      toks.forEach(function (t, j) {
        var nm = names[j];
        model.raw[nm] = t.t;
        model.values[nm] = STRING_FIELDS[nm] ? t.t : toNum(t.t);
        pos.push([nm, t.s, t.e]);
      });
      model.layout.cards[cur].rows.push({ pos: pos });
      row++;
    }
    // valeurs dérivées commodes
    var v = model.values;
    model.NT = v.NT;
    model.D = []; model.ND = [];
    for (i = 1; i <= v.NT; i++) { model.D.push(v['D' + i]); model.ND.push(v['ND' + i]); }
    if (model.cotes) model.cotes.values = model.cotes.rows.map(function (r) { return r.map(Number); });
    return model;
  }

  function put(buf, s, start, end) {
    // place s pour finir en 'end' (aligné à droite) ; si 'start' fourni et la longueur égale, même position
    var st = end - s.length;
    if (st < 0) st = 0;
    while (buf.length < st) buf += ' ';
    if (buf.length > st) { buf = buf.replace(/\s+$/, ''); buf += ' '; st = buf.length; }
    return buf.slice(0, st) + s;
  }
  function fmtVal(model, nm) {
    var raw = model.raw[nm];
    var v = model.values[nm];
    if (raw === undefined) return v === undefined || v === null ? '' : String(v);
    if (typeof v === 'number' && Number(raw) !== v) {
      var dec = (raw.split('.')[1] || '').length;
      var hasDot = raw.indexOf('.') >= 0;
      return hasDot ? v.toFixed(dec) + (dec === 0 ? '.' : '') : String(Math.round(v));
    }
    return raw;
  }

  function formatBordereau(model) {
    var out = [];
    var lay = model.layout || { cards: {} };
    out.push(lay.line0 || ('                        BORDEREAU DES DONNEES DU PSIDP91 NUMERO ' + model.numero + '-' + (model.suffixe || '') + '          PASSAGE DU ' + model.passage));
    out.push(lay.line1 || '                        ----------------------------------------------');
    out.push(lay.numHdr || '         NUM   S  DATE');
    var nt = lay.numToks || [[9, 14], [18, 26]];
    var b = '';
    var num = model.numero + '-' + (model.suffixe || '');
    b = ' '.repeat(nt[0][0]) + num;
    b = b + ' '.repeat(Math.max(1, nt[1][0] - b.length)) + model.date;
    out.push(b);
    (model.titres || []).forEach(function (t) { out.push(t); });
    var order = Object.keys(lay.cards).length ? Object.keys(lay.cards) : CARD_ORDER;
    order.forEach(function (key) {
      var card = lay.cards[key] || { hdr: STD_HEADERS[key], rows: (STD_POS[key] || []).map(function (p, r) { return { pos: FIELDS[key][r].map(function (n, j) { return p[j] ? [n, p[j][0], p[j][1]] : null; }).filter(Boolean) }; }) };
      out.push(card.hdr);
      card.rows.forEach(function (r) {
        if (r.extra) {
          var s = '';
          r.toks.forEach(function (p, j) { s = put(s, model.values.PROCEDE_X[j], p[0], p[1]); });
          out.push(s); return;
        }
        var s2 = '';
        r.pos.forEach(function (p) {
          var val = fmtVal(model, p[0]);
          if (val === '') return;
          if (p[0] === 'PROCEDE') { s2 = ' '.repeat(p[1]) + val; return; }
          s2 = put(s2, val, p[1], p[2]);
        });
        out.push(s2);
      });
      if (key === 'CNV' && model.cotes) {
        model.cotes.hdr.forEach(function (h) { out.push(h); });
        model.cotes.values.forEach(function (r) {
          var s = '';
          r.forEach(function (x, j) { s = put(s, x.toFixed(3), 0, 7 + 9 * j); });
          out.push(s);
        });
      }
      if (key === 'CNV' && lay.cegen) lay.cegen.forEach(function (h) { out.push(h); });
    });
    return out.join('\n') + '\n';
  }

  // Normalisation pour comparaison d'aller-retour (fins de lignes, blancs de fin, lignes vides)
  function normalizeBordereauText(texte) {
    var lines = String(texte).replace(/\r/g, '').replace(/\f/g, '\n').split('\n');
    var i0 = lines.findIndex(function (l) { return /BORDEREAU DES DONNEES DU PSIDP/.test(l); });
    var out = [];
    for (var i = i0; i < lines.length; i++) {
      if (/CONTROLE SOMMAIRE DE COMPATIBILITE/.test(lines[i])) break;
      var l = lines[i].replace(/\s+$/, '');
      if (l) out.push(l);
    }
    return out.join('\n') + '\n';
  }

  var api = { parseBordereau: parseBordereau, formatBordereau: formatBordereau, normalizeBordereauText: normalizeBordereauText, FIELDS: FIELDS };
  root.PSIDP_PARSE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
