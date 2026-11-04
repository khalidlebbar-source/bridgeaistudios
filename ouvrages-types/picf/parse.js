// PICF-EL (PICF91 v1.06) — bordereau des données : lecture / écriture.
// Le bordereau est une suite de « cartes » : une ligne d'en-tête (noms de variables) suivie
// d'une ligne de valeurs. Chaque valeur peut porter un préfixe :
//   "=" : valeur par défaut ou calculée par le programme (réimprimée dans le bordereau)
//   "c" : coefficient calculé par le programme
// Le modèle conserve, pour un aller-retour sans perte, la colonne et la chaîne d'origine de
// chaque valeur (model._layout). Sans _layout, formatBordereau produit la mise en page
// standard SETRA.

const CARDS = [
  { id: 'FIX', keys: ['FIXD', 'DIRFER', 'DES'] },
  { id: 'GEOM', keys: ['HAUTL', 'HREMB', 'OUVER', 'BIAIS', 'E1', 'E2', 'E3', 'LDALT'] },
  { id: 'PROF', keys: ['NVOI', 'ETROTG', 'EGAU', 'ESURCH', 'EDROI', 'ETROTD', 'LARGE', 'HCHAU', 'HSREM', 'PTRAN'] },
  { id: 'PERM', keys: ['MVBET', 'MVSOL', 'RKGN', 'RKGX', 'RKDN', 'RKDX', 'QSUPN', 'QSUPX', 'RDTN', 'RDTX', 'QREMN', 'QREMX', 'R'] },
  { id: 'CHARG', keys: ['CL', 'AL', 'BC', 'BT', 'MC', 'ME', 'EX', 'PTRO', 'TE+', 'TE-', 'TER', 'PSREM'] },
  { id: 'K', keys: ['KAL', 'KBC', 'KBT', 'KMC', 'KME', 'KEX', 'KTR'] },
  { id: 'EC', keys: ['EC', 'EGAU', 'ESURCH', 'HSREM', 'RDTN', 'RDTX', 'QREMN', 'QREMX', 'PSREM', 'KEC'] },
  { id: 'MAT', keys: ['IFIS', 'FCJ', 'ENROBS', 'ENROB', 'ESOL'] },
  { id: 'ACIER', keys: ['PHI1', 'PHI2', 'PHI3', 'FE1', 'FE2', 'FE3', 'ETA1', 'ETA2', 'ETA3', 'PSIS'] },
];
// Champs texte (non numériques)
const TEXT_FIELDS = new Set(['CHARG.AL', 'CHARG.BC', 'CHARG.BT', 'CHARG.MC', 'CHARG.ME', 'CHARG.EX', 'EC.EC', 'MAT.IFIS']);

function tokens(line) {
  const out = []; const re = /\S+/g; let m;
  while ((m = re.exec(line))) {
    const prev = out[out.length - 1];
    // un préfixe "=" ou "c" isolé (ex. "= 3") est rattaché à la valeur qui suit
    if (prev && (prev.s === '=' || prev.s === 'c')) { prev.s += m[0]; prev.sep = m.index - prev.col - 1; continue; }
    out.push({ s: m[0], col: m.index });
  }
  return out;
}
function headerMatches(line, keys) {
  const t = tokens(line).map(x => x.s);
  if (t.length !== keys.length) return false;
  return t.every((x, i) => x === keys[i]);
}
function decodeValue(raw, isText) {
  let flag = '';
  let s = raw;
  if (s[0] === '=' || s[0] === 'c') { flag = s[0]; s = s.slice(1); }
  if (isText) return { flag: '', value: raw, dec: 0 };
  const v = Number(s);
  const dot = s.indexOf('.');
  const dec = dot < 0 ? -1 : s.length - dot - 1; // -1 : entier sans point
  return { flag, value: isNaN(v) ? s : v, dec };
}
function fmtNum(v, dec) {
  if (typeof v !== 'number') return String(v);
  if (dec < 0) return String(Math.round(v));
  if (dec === 0) return Math.round(v) + '.';
  return v.toFixed(dec);
}

function parseBordereau(text) {
  const lines = text.replace(/\r/g, '').replace(/\f/g, '\n').split('\n');
  const model = { _layout: { lines: [], cards: {} }, flags: {}, dec: {} };
  let i = 0;
  // en-tête
  while (i < lines.length && !/BORDEREAU DES DONNE/.test(lines[i])) i++;
  if (i >= lines.length) throw new Error('bordereau PICF introuvable');
  const start = i;
  const h = lines[i].match(/NUMERO\s+(\S+)\s+DU\s+(.*)$/);
  model.numero = h ? h[1].replace(/-$/, '') : '';
  model.dateMachine = h ? h[2].trim() : '';
  // carte NUM
  for (; i < lines.length; i++) if (/^\s*NUM\s+S\s+DATE/.test(lines[i])) break;
  const numLine = lines[i + 1] || '';
  const nt = tokens(numLine);
  model.prog = nt[0] ? nt[0].s : 'PICF91';
  model.num = nt[1] ? nt[1].s : '';
  model.date = nt[2] ? nt[2].s : '';
  model.numExtra = nt.slice(3).map(x => x.s);
  i += 2;
  // titre
  for (; i < lines.length; i++) if (/^\s*TITRE\s*$/.test(lines[i])) break;
  i++;
  const titre = [];
  while (i < lines.length && lines[i].trim() !== '') { titre.push(lines[i].trim()); i++; }
  model.titre = titre;
  while (i < lines.length && lines[i].trim() === '') i++;
  // titre court (absent sur certains bordereaux : la ligne suivante est alors l'en-tête de la carte FIX)
  if (headerMatches(lines[i], CARDS[0].keys)) model.titreCourt = ''; else { model.titreCourt = lines[i].trim(); i++; }
  // cartes
  let ci = 0;
  for (; i < lines.length && ci < CARDS.length; i++) {
    const card = CARDS[ci];
    if (!headerMatches(lines[i], card.keys)) continue;
    const vt = tokens(lines[i + 1] || '');
    if (vt.length !== card.keys.length) throw new Error(`carte ${card.id} : ${vt.length} valeurs pour ${card.keys.length} variables`);
    model._layout.cards[card.id] = { header: lines[i], cols: vt.map(x => x.col), raw: vt.map(x => x.s), sep: vt.map(x => x.sep || 0) };
    card.keys.forEach((k, j) => {
      const key = card.id + '.' + k;
      const d = decodeValue(vt[j].s, TEXT_FIELDS.has(key));
      model[key] = d.value; model.flags[key] = d.flag; model.dec[key] = d.dec;
    });
    i++; ci++;
  }
  if (ci < CARDS.length) throw new Error('bordereau incomplet : carte ' + CARDS[ci].id + ' absente');
  // vérification des données
  for (; i < lines.length; i++) if (/VERIFICATION DES DONNEES/.test(lines[i])) break;
  const msgs = [];
  if (i < lines.length) {
    i += 2;
    while (i < lines.length && lines[i].trim() !== '' && !/PICF-EL NO|^\s*-{20,}/.test(lines[i])) { msgs.push(lines[i].trim()); i++; }
  }
  model.verification = msgs;
  model._layout.lines = lines.slice(start, i);
  return model;
}

// Mise en page standard (celle des passages 2550/2551)
const STD = {
  head: (num, date) => ' '.repeat(56) + `BORDEREAU DES DONNES DU PICF91   NUMERO ${num}- DU ${date}`,
  FIX: { header: 'FIXD DIRFER DES', cols: [1, 7, 13] },
  GEOM: { header: 'HAUTL HREMB OUVER BIAIS             E1     E2     E3    LDALT', cols: [0, 5, 11, 17, 35, 42, 49, 56] },
  PROF: { header: 'NVOI ETROTG     EGAU ESURCH       EDROI ETROTD    LARGE   HCHAU HSREM PTRAN', cols: [3, 7, 16, 21, 35, 40, 48, 56, 61, 66] },
  PERM: { header: 'MVBET MVSOL     RKGN     RKGX   RKDN     RKDX QSUPN QSUPX    RDTN    RDTX    QREMN QREMX   R', cols: [1, 6, 16, 25, 32, 41, 46, 51, 60, 68, 78, 84, 90] },
  CHARG: { header: 'CL AL    BC     BT    MC        ME        EX     PTRO TE+ TE- TER PSREM', cols: [1, 3, 9, 16, 22, 32, 42, 49, 54, 59, 65, 70] },
  K: { header: '  KAL    KBC    KBT    KMC    KME    KEX    KTR', cols: [0, 7, 14, 21, 28, 35, 42] },
  EC: { header: ' EC      EGAU ESURCH       HSREM    RDTN    RDTX    QREMN       QREMX    PSREM  KEC', cols: [0, 10, 15, 28, 36, 44, 52, 64, 73, 78] },
  MAT: { header: 'IFIS     FCJ  ENROBS        ENROB       ESOL', cols: [1, 8, 14, 28, 39] },
  ACIER: { header: 'PHI1    PHI2   PHI3        FE1     FE2     FE3           ETA1    ETA2     ETA3    PSIS', cols: [1, 9, 16, 25, 33, 41, 55, 63, 72, 80] },
};
function placeTokens(strs, cols) {
  let line = '';
  strs.forEach((s, j) => {
    let c = cols[j] !== undefined ? cols[j] : line.length + 1;
    if (line.length > 0 && c <= line.length) c = line.length + 1;
    line = line.padEnd(c) + s;
  });
  return line;
}
function valueString(model, card, k, rawOrig) {
  const key = card.id + '.' + k;
  const v = model[key];
  if (TEXT_FIELDS.has(key)) return String(v);
  const flag = model.flags && model.flags[key] !== undefined ? model.flags[key] : '';
  const dec = model.dec && model.dec[key] !== undefined ? model.dec[key] : 2;
  return flag + fmtNum(v, dec);
}

function formatBordereau(model) {
  const L = model._layout;
  const out = [];
  if (L && L.lines && L.lines.length) {
    // reconstitution sur la mise en page d'origine : seules les valeurs sont réécrites
    const lines = L.lines.slice();
    let ci = 0;
    for (let i = 0; i < lines.length && ci < CARDS.length; i++) {
      const card = CARDS[ci];
      if (!headerMatches(lines[i], card.keys)) continue;
      const lc = L.cards[card.id];
      const strs = card.keys.map((k, j) => {
        const s = valueString(model, card, k);
        return lc.sep[j] && /^[=c]/.test(s) ? s[0] + ' '.repeat(lc.sep[j]) + s.slice(1) : s;
      });
      const old = lines[i + 1];
      lines[i + 1] = placeTokens(strs, lc.cols) + (old.match(/\s*$/)[0]);
      i++; ci++;
    }
    return lines.join('\n');
  }
  out.push(STD.head(model.numero || model.num, model.dateMachine || ''));
  out.push(' '.repeat(56) + '-'.repeat(65));
  out.push('', '');
  out.push('              NUM    S    DATE     NIV    TEL       GESTIONNAIRE                     CLIENT');
  out.push(placeTokens([model.prog || 'PICF91', model.num, model.date, ...(model.numExtra || [])], [0, 14, 25]));
  out.push('', '  TITRE');
  for (const t of model.titre || []) out.push(' '.repeat(Math.max(0, 40 - Math.floor(t.length / 2))) + t);
  out.push('', model.titreCourt || '', '');
  for (const card of CARDS) {
    const st = STD[card.id];
    out.push(st.header);
    out.push(placeTokens(card.keys.map(k => valueString(model, card, k)), st.cols));
    out.push('');
  }
  out.push('VERIFICATION DES DONNEES', '------------------------');
  for (const m of model.verification || []) out.push('    ' + m);
  return out.join('\n');
}

// Accès commode aux données (noms SETRA)
function data(model) {
  const g = k => model[k];
  return {
    hautl: g('GEOM.HAUTL'), hremb: g('GEOM.HREMB'), ouver: g('GEOM.OUVER'), biais: g('GEOM.BIAIS'),
    e1: g('GEOM.E1'), e2: g('GEOM.E2'), e3: g('GEOM.E3'), ldalt: g('GEOM.LDALT'),
    nvoi: g('PROF.NVOI'), etrotg: g('PROF.ETROTG'), egau: g('PROF.EGAU'), esurch: g('PROF.ESURCH'),
    edroi: g('PROF.EDROI'), etrotd: g('PROF.ETROTD'), large: g('PROF.LARGE'), hchau: g('PROF.HCHAU'),
    hsrem: g('PROF.HSREM'), ptran: g('PROF.PTRAN'),
    mvbet: g('PERM.MVBET'), mvsol: g('PERM.MVSOL'), rkgn: g('PERM.RKGN'), rkgx: g('PERM.RKGX'),
    rkdn: g('PERM.RKDN'), rkdx: g('PERM.RKDX'), qsupn: g('PERM.QSUPN'), qsupx: g('PERM.QSUPX'),
    rdtn: g('PERM.RDTN'), rdtx: g('PERM.RDTX'), qremn: g('PERM.QREMN'), qremx: g('PERM.QREMX'), r: g('PERM.R'),
    cl: g('CHARG.CL'), al: g('CHARG.AL'), bc: g('CHARG.BC'), bt: g('CHARG.BT'), mc: g('CHARG.MC'),
    me: g('CHARG.ME'), ex: g('CHARG.EX'), ptro: g('CHARG.PTRO'), tep: g('CHARG.TE+'), tem: g('CHARG.TE-'),
    ter: g('CHARG.TER'), psrem: g('CHARG.PSREM'),
    k: { AL: g('K.KAL'), BC: g('K.KBC'), BT: g('K.KBT'), MC: g('K.KMC'), ME: g('K.KME'), EX: g('K.KEX'), TR: g('K.KTR') },
    ec: { nom: String(g('EC.EC')), egau: g('EC.EGAU'), esurch: g('EC.ESURCH'), hsrem: g('EC.HSREM'),
      rdtn: g('EC.RDTN'), rdtx: g('EC.RDTX'), qremn: g('EC.QREMN'), qremx: g('EC.QREMX'), psrem: g('EC.PSREM'), kec: g('EC.KEC') },
    ifis: g('MAT.IFIS'), fcj: g('MAT.FCJ'), enrobs: g('MAT.ENROBS'), enrob: g('MAT.ENROB'), esol: g('MAT.ESOL'),
    phi: [g('ACIER.PHI1'), g('ACIER.PHI2'), g('ACIER.PHI3')], fe: [g('ACIER.FE1'), g('ACIER.FE2'), g('ACIER.FE3')],
    eta: [g('ACIER.ETA1'), g('ACIER.ETA2'), g('ACIER.ETA3')], psis: g('ACIER.PSIS'),
  };
}

const PICF_PARSE = { parseBordereau, formatBordereau, data, CARDS, fmtNum };
if (typeof module !== 'undefined' && module.exports) module.exports = PICF_PARSE;
if (typeof globalThis !== 'undefined') globalThis.PICF_PARSE = PICF_PARSE;
