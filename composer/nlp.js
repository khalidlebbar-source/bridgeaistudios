/* Bridge Composer — interpréteur de descriptions en français (local, sans IA externe)
 * COMP.interpret(texte, S) → { S, ok: [libellés compris], miss: [fragments non interprétés], hint }
 * Exemple : « pont dalle à trois travées de 12-16-12 m, piles colonnes de 6 m sur pieux Ø1,20, sol 0,3 MPa » */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('./calc.js') : root.COMP;
  const api = factory(C);
  if (isNode) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const fr = (v, d) => (+v).toLocaleString('fr-FR', { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 2 : d });
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const r05 = (v) => Math.round(v * 2) / 2;

  const MOTS = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12 };
  const NUMW = '(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)';
  const toN = (w) => (MOTS[w] != null ? MOTS[w] : +w);

  /* normalisation à longueur constante : minuscules, sans accents, virgule décimale → point */
  function norm(t) {
    let s = '';
    for (const ch of String(t)) {
      const b = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      s += (b.length === 1 ? b : (ch === 'œ' ? 'o' : ch.length === 1 ? ch : '?')).toLowerCase();
    }
    return s.replace(/(\d),(\d)/g, '$1.$2').replace(/[’`]/g, "'").replace(/[–—]/g, '-').replace(/×/g, 'x');
  }

  /* mots-clés qui ouvrent un segment (le sujet des nombres qui suivent) */
  const SUBJ = [
    ['travee', /\b(travees?|portees?|ouvertures?)\b/g],
    ['longueur', /\b(longueur|long de|ouvrage de|pont de|viaduc de)\b/g],
    ['pile', /\bpiles?\b/g],
    ['culee', /\bculees?\b/g],
    ['pieu', /\b(pieux|pieu|fondations? profondes?)\b/g],
    ['semelle', /\b(semelles?|fondations? superficielles?|fondations? directes?)\b/g],
    ['fondation', /\bfondations?\b(?! (profonde|superficielle|directe))/g],
    ['sol', /\b(sol|sigma|contrainte admissible|taux de travail|σ)\b/g],
    ['trottoir', /\btrottoirs?\b/g],
    ['voie', /\bvoies?\b/g],
    ['chaussee', /\b(chaussee|largeur roulable|roulable)\b/g],
    ['largeur', /\b(largeur|large)\b(?! roulable)/g],
    ['biais', /\bbiais\b/g],
    ['hauteur', /\b(hauteur du tablier|hauteur de tablier|epaisseur|elancement)\b/g],
    ['revet', /\b(enrobes?|revetement|couche de roulement)\b/g],
    ['entraxe', /\bentraxe\b/g],
  ];

  function interpret(text, S0) {
    const raw = String(text || ''), s = norm(raw);
    const S = clone(S0), ok = [], used = new Array(s.length).fill(false);
    const mark = (i, j) => { for (let k = Math.max(0, i); k < Math.min(s.length, j); k++) used[k] = true; };
    const say = (t) => { if (!ok.includes(t)) ok.push(t); };
    const find = (re) => { re.lastIndex = 0; const m = re.exec(s); if (m) { mark(m.index, m.index + m[0].length); if (re.global) { let x; while ((x = re.exec(s))) mark(x.index, x.index + x[0].length); } re.lastIndex = 0; } return m; };
    const has = (re) => !!find(re);
    let nSpans = null, typeHint = null, typeExplicit = null, Ltot = null, spansSet = false, contWanted = null;

    /* ── usage ── */
    if (has(/\b(pont[- ]rail|ferroviaire|voies? ferrees?|oncf|lgv|ligne ferroviaire|train|ballast)\b/g)) { if (S.usage !== 'rail') setUsage(S, 'rail'); say('Pont-rail'); }
    else if (has(/\b(pont[- ]route|routier|routiere|autoroute|autoroutier|passage (superieur|inferieur)|chemin|route)\b/g)) { if (S.usage !== 'route') setUsage(S, 'route'); say('Pont-route'); }
    const rail = () => S.usage === 'rail';

    /* ── règlement, classe ── */
    if (has(/\b(eurocodes?|en ?1991|lm ?1|lm ?71|en ?1990)\b/g)) { S.reglement = 'EC'; say('Eurocodes EN 1991-2'); }
    else if (has(/\b(fascicule ?61|fasc\.? ?61|f61|systeme b|bc\b|uic ?71)/g)) { S.reglement = 'F61'; say(rail() ? 'UIC 71' : 'Fascicule 61 titre II'); }
    let m = find(/\b(1re|1ere|premiere|1|2e|2eme|deuxieme|2|3e|3eme|troisieme|3) classe\b/g);
    if (m) { S.classe = /^(1|pre)/.test(m[1]) ? 1 : /^(2|deu)/.test(m[1]) ? 2 : 3; say('Pont de ' + S.classe + (S.classe === 1 ? 're' : 'e') + ' classe'); }

    /* ── type de tablier ── */
    const TY = [
      ['PSIDP', /\b(psi[- ]?dp|dalle (en beton )?precontrainte|dalle pp?|dalle post[- ]?contrainte)\b/g],
      ['PSIDA', /\b(psi[- ]?da|dalle (en )?(beton )?arme|dalle ba)\b/g],
      ['VIPP', /\b(vipp|poutres? (prefabriquees? )?(precontraintes? )?(par )?post[- ]?tension|poutres? post[- ]?contraintes?)\b/g],
      ['PRAD', /\b(prad|poutres? (precontraintes? )?(par )?(pre[- ]?tension|adherence)|poutres? pretendues?)\b/g],
      ['PRP', /\b(prp|poutrelles? (metalliques? )?enrobees?|poutrelles enrobees|heb|hea)\b/g],
      ['MIXTE', /\b(bipoutres?|bi[- ]poutres?|mixte|acier[- ]beton|ossature mixte)\b/g],
    ];
    for (const [k, re] of TY) if (has(re)) { typeExplicit = k; break; }
    if (!typeExplicit) {
      if (has(/\b(pont[- ]dalle|dalle)\b/g)) typeHint = 'dalle';
      else if (has(/\bpoutres?\b/g)) typeHint = 'poutres';
    }

    /* ── continuité ── */
    if (has(/\b(non continue?s?|isostatiques?|independantes?|travees? simples?)\b/g)) contWanted = false;
    else if (has(/\b(continue?s?|hyperstatiques?)\b/g)) contWanted = true;

    /* ── nombre de travées ── */
    m = find(new RegExp('\\b' + NUMW + '\\s+(travees?|portees?)\\b', 'g'));
    if (m) nSpans = toN(m[1]);
    if (has(/\b(travee unique|une seule travee|mono[- ]?travee|a une travee)\b/g)) nSpans = 1;
    if (nSpans != null) nSpans = Math.max(1, Math.min(12, nSpans));

    /* ── types d'appuis ── */
    if (has(/\bpiles?[- ](en )?(colonnes?|poteaux|futs? (circulaires?|multiples?))\b|\bcolonnes?\b/g)) { S.piles.type = 'colonnes'; say('Piles colonnes + chevêtre'); }
    else if (has(/\bpiles?[- ](en )?(voiles?|pleines?|murs?)\b|\bvoiles?\b/g)) { S.piles.type = 'voile'; say('Piles voiles'); }
    else if (has(/\b(piles?[- ])?(en )?marteaux?\b/g)) { S.piles.type = 'marteau'; say('Piles marteau'); }
    if (has(/\bculees?[- ](enterrees?|perchees?|noyees?|apparentes? enterrees?)\b|\bsommiers? (sur colonnes|enterres?)\b/g)) { S.culees.type = 'enterree'; say('Culées enterrées'); }
    else if (has(/\bculees?[- ](remblayees?|massives?|mur de front|a mur)\b|\bmurs? de front\b/g)) { S.culees.type = 'remblayee'; say('Culées remblayées'); }
    if (has(/\bsans dalles? de transition\b/g)) { S.culees.dalleTransition = false; say('Sans dalle de transition'); }
    else if (has(/\bdalles? de transition\b/g)) { S.culees.dalleTransition = true; say('Dalles de transition'); }

    /* ── équipements ── */
    if (has(/\bbn ?4\b/g)) { S.equip.retenue = 'BN4'; say('Barrières BN4'); }
    else if (has(/\b(gba|glissieres? (en )?beton)\b/g)) { S.equip.retenue = 'GBA'; say('GBA'); }
    else if (has(/\bgardes?[- ]corps( seuls?)?\b/g) && !/bn ?4|gba/.test(s)) { S.equip.retenue = 'GC'; say('Garde-corps'); }
    if (has(/\bsans corniches?\b/g)) { S.equip.corniches = false; say('Sans corniches'); }
    if (has(/\bsans etancheite\b/g)) { S.equip.etancheite = false; say('Sans étanchéité'); }
    if (has(/\bsans gargouilles?\b/g)) { S.equip.gargouilles = false; say('Sans gargouilles'); }

    /* ── bétons et aciers ── */
    const reB = /\bc ?(\d{2}) ?\/ ?(\d{2,3})\b/g; let mb, nb = 0;
    while ((mb = reB.exec(s))) {
      const cl = 'C' + mb[1] + '/' + mb[2]; if (!C.CLASSES_BETON.includes(cl)) continue;
      const ctx = s.slice(Math.max(0, mb.index - 30), mb.index);
      const k = /appui|pile|culee/.test(ctx) ? 'betonApp' : /fondation|semelle/.test(ctx) ? 'betonFond' : /pieu/.test(ctx) ? 'betonPieux' : nb ? 'betonApp' : 'betonTab';
      S.hyp[k] = cl; nb++; mark(mb.index, mb.index + mb[0].length);
      say({ betonTab: 'Béton du tablier ', betonApp: 'Béton des appuis ', betonFond: 'Béton des fondations ', betonPieux: 'Béton des pieux ' }[k] + cl);
    }
    m = find(/\bs ?(235|275|355|420|460)\b/g); if (m) { S.hyp.charpente = 'S' + m[1]; say('Charpente S' + m[1]); }

    /* ── nom de l'ouvrage : « … sur (l')oued X » ── */
    m = /\b(?:pont|viaduc|ouvrage|passage|franchissement|passerelle)\b[^,;.\n]{0,40}?\bsur (l'|le |la |les )?((oued|riviere|autoroute|route|voie ferree|canal|rn|rr|rp|chaabat|chaaba|ravin)\b ?([a-z0-9][\w'-]*(?: [a-z][\w'-]*)?)?)/.exec(s);
    if (m) {
      const i0 = m.index + m[0].lastIndexOf(m[2]);
      let nm = raw.slice(i0, i0 + m[2].length).trim();
      /* second mot du nom seulement s'il porte une majuscule (« oued Oum Rbia ») */
      const wd = nm.split(/\s+/); if (wd.length > 2 && !/^[A-ZÀ-Ý]/.test(wd[2])) nm = wd.slice(0, 2).join(' ');
      if (wd.length === 2 && /^(oued|rivière|riviere|autoroute|route|canal|ravin)$/i.test(wd[0]) === false && !/^[A-ZÀ-Ý0-9]/.test(wd[1])) nm = wd[0];
      nm = nm.replace(/^(\w)/, (c) => c.toLowerCase()).replace(/\b(oued|riviere|rivière) (\w)/i, (a, b, c) => b + ' ' + c.toUpperCase());
      S.projet.nom = (rail() ? 'Pont-rail sur ' : 'Pont-route sur ') + nm;
      mark(i0, i0 + m[2].length); say('Nom : ' + S.projet.nom);
    }

    /* ── segments numériques ── */
    const hits = [];
    SUBJ.forEach(([k, re]) => { re.lastIndex = 0; let h; while ((h = re.exec(s))) hits.push({ k, i: h.index, j: h.index + h[0].length }); });
    hits.sort((a, b) => a.i - b.i || b.j - a.j);
    const segs = [];
    hits.forEach((h) => { if (segs.length && h.i < segs[segs.length - 1].j) return; segs.push(h); });
    segs.forEach((g, n) => { g.end = n + 1 < segs.length ? segs[n + 1].i : s.length; g.txt = s.slice(g.j, g.end); mark(g.i, g.j); });
    /* nombres d'un segment : valeur, unité éventuelle, position absolue */
    const nums = (g) => {
      const out = [], re = /(\d+(?:\.\d+)?)\s*(m\b|mpa|bars?|kpa|gr\b|grades?|°|cm\b|mm\b|mn\b|t\b|kn\b)?/g; let x;
      while ((x = re.exec(g.txt))) if (!used[g.j + x.index] && !/^\s*(voies?|travees?|piles?|pieux|culees?|portees?)\b/.test(s.slice(g.j + x.index + x[1].length))) out.push({ v: +x[1], u: (x[2] || '').replace(/s$/, ''), i: g.j + x.index, j: g.j + x.index + x[0].length, pre: g.txt.slice(Math.max(0, x.index - 12), x.index) });
      return out;
    };
    const use = (x) => mark(x.i, x.j);
    const seq = (g) => { /* séquence a-b-c, a/b/c, a+b+c, « a, b et c » */
      const ns = nums(g).filter((x) => !x.u || x.u === 'm');
      if (ns.length < 2) return null;
      const between = (a, b) => s.slice(a.j, b.i);
      const out = [ns[0]];
      for (let q = 1; q < ns.length; q++) { if (/^\s*(-|\/|\+|;|,|et|x)?\s*$/.test(between(out[out.length - 1], ns[q])) && !/x/.test(between(out[out.length - 1], ns[q]))) out.push(ns[q]); else break; }
      /* la virgule n'est un séparateur que dans une énumération terminée par « et » (« 6, 8 et 6 m ») */
      const seps = out.slice(1).map((x, q) => between(out[q], x));
      if (seps.some((t) => /,/.test(t)) && !seps.some((t) => /\bet\b/.test(t))) { const q = seps.findIndex((t) => /,/.test(t)); out.length = q + 1; }
      return out.length >= 2 ? out : null;
    };
    let prev = null;
    let spansFrom = null;
    segs.forEach((g) => {
      const ns = nums(g), t = g.txt;
      const subjFond = (prev && (prev.k === 'pile' || prev.k === 'culee')) ? prev.k : null;
      switch (g.k) {
        case 'travee': {
          const rx = /(\d+)\s*x\s*(\d+(?:\.\d+)?)/.exec(t);
          const rive = /rives?\s*(?:de\s*)?(\d+(?:\.\d+)?)/.exec(t), cent = /(centrales?|intermediaires?|courantes?)\s*(?:de\s*)?(\d+(?:\.\d+)?)/.exec(t);
          const sq = seq(g);
          if (rx) { spansFrom = Array(Math.min(12, +rx[1])).fill(+rx[2]); mark(g.j + rx.index, g.j + rx.index + rx[0].length); }
          else if (sq) { spansFrom = sq.map((x) => x.v); sq.forEach(use); }
          else if (rive || cent) { spansFrom = { rive: rive ? +rive[1] : null, cent: cent ? +cent[2] : null }; ns.forEach(use); [rive, cent].forEach((q) => { if (q) mark(g.j + q.index, g.j + q.index + q[0].length); }); }
          else if (ns.length && (!ns[0].u || ns[0].u === 'm') && ns[0].v >= 3) { spansFrom = { all: ns[0].v }; use(ns[0]); }
          break;
        }
        case 'longueur': if (ns.length && ns[0].v >= 5 && (ns[0].u === 'm' || (!ns[0].u && /longueur/.test(s.slice(g.i, g.j))))) { Ltot = ns[0].v; use(ns[0]); } break;
        case 'pile': {
          const sq = seq(g), hs = ns.filter((x) => (x.u === 'm' || !x.u) && x.v >= 1 && x.v <= 60 && !/\b(o|ø|phi|diam)/.test(x.pre));
          if (sq) { S.piles.hauteurs = sq.map((x) => x.v); sq.forEach(use); say('Hauteurs des piles ' + sq.map((x) => fr(x.v)).join(' / ') + ' m'); }
          else if (hs.length) { S.piles._all = hs[0].v; use(hs[0]); say('Piles de ' + fr(hs[0].v) + ' m'); }
          break;
        }
        case 'culee': {
          const hs = ns.filter((x) => (x.u === 'm' || !x.u) && x.v >= 0.5 && x.v <= 15);
          if (hs.length >= 2 && seq(g)) { S.culees.hauteurs = [hs[0].v, hs[1].v]; use(hs[0]); use(hs[1]); say('Culées de ' + fr(hs[0].v) + ' et ' + fr(hs[1].v) + ' m'); }
          else if (hs.length) { S.culees.hauteurs = [hs[0].v, hs[0].v]; use(hs[0]); say('Culées de ' + fr(hs[0].v) + ' m'); }
          break;
        }
        case 'pieu': {
          const tgt = subjFond || (/\bpiles?\b/.test(s.slice(Math.max(0, g.i - 25), g.i)) ? 'pile' : null);
          if (tgt === 'pile' || !tgt) S.fond.piles = 'pieux';
          if (tgt === 'culee' || !tgt) S.fond.culees = 'pieux';
          say(tgt === 'pile' ? 'Piles sur pieux' : tgt === 'culee' ? 'Culées sur pieux' : 'Fondations sur pieux');
          ns.forEach((x) => {
            if (x.u === 'mn' || x.u === 't' || x.u === 'kn') { S.fond.qadm = x.u === 't' ? x.v / 100 : x.u === 'kn' ? x.v / 1000 : x.v; use(x); say('Charge admissible ' + fr(S.fond.qadm) + ' MN/pieu'); }
            else if (x.u === 'mm' || x.u === 'cm' || (x.v <= 2 && (!x.u || x.u === 'm'))) { const d = x.u === 'mm' ? x.v / 1000 : x.u === 'cm' ? x.v / 100 : x.v; S.fond.diam = [0.6, 0.8, 1.0, 1.2, 1.5].reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a)); use(x); say('Pieux Ø ' + fr(S.fond.diam, 2) + ' m'); }
            else if ((!x.u || x.u === 'm') && x.v >= 4 && x.v <= 60) { S.fond.long = x.v; use(x); say('Pieux de ' + fr(x.v) + ' m de long'); }
          });
          break;
        }
        case 'semelle': {
          const tgt = subjFond;
          if (tgt === 'pile' || !tgt) S.fond.piles = 'superficielle';
          if (tgt === 'culee' || !tgt) S.fond.culees = 'superficielle';
          say(tgt === 'pile' ? 'Piles sur semelles' : tgt === 'culee' ? 'Culées sur semelles' : 'Fondations superficielles');
          break;
        }
        case 'fondation': if (/profonde|pieu/.test(t)) { S.fond.piles = S.fond.culees = 'pieux'; say('Fondations sur pieux'); } else if (/superficielle|directe|semelle/.test(t)) { S.fond.piles = S.fond.culees = 'superficielle'; say('Fondations superficielles'); } break;
        case 'sol': break;
        case 'trottoir': {
          const rc = /^\s*(gauche|droit)/.exec(t);
          if (/\bsans\b/.test(s.slice(Math.max(0, g.i - 6), g.i))) { S.profil.trottoirG = S.profil.trottoirD = 0; mark(g.i - 6, g.i); say('Sans trottoirs'); break; }
          const x = ns.find((y) => y.v <= 5 && (!y.u || y.u === 'm' || y.u === 'cm'));
          if (x) { const v = x.u === 'cm' ? x.v / 100 : x.v; if (rc) S.profil[rc[1] === 'gauche' ? 'trottoirG' : 'trottoirD'] = v; else S.profil.trottoirG = S.profil.trottoirD = v; use(x); say((rc ? 'Trottoir ' + rc[1] : 'Trottoirs') + ' de ' + fr(v) + ' m'); }
          break;
        }
        case 'voie': {
          const mc = new RegExp('\\b' + NUMW + '\\s*$').exec(s.slice(Math.max(0, g.i - 10), g.i));
          if (/ferree/.test(t.slice(0, 8))) { /* « voie ferrée » : usage déjà traité */ if (mc && rail()) { S.profil.nbVoiesFer = Math.min(4, toN(mc[1])); mark(g.i - mc[0].length, g.i); say(S.profil.nbVoiesFer + ' voie(s) ferrée(s)'); } break; }
          if (mc) {
            const nv = toN(mc[1]); mark(g.i - mc[0].length, g.i);
            if (rail()) { S.profil.nbVoiesFer = Math.min(4, nv); say(S.profil.nbVoiesFer + ' voie(s)'); }
            else { const lv = ns.find((y) => y.v >= 2.5 && y.v <= 4.5 && /de|a/.test(y.pre)); const w = lv ? lv.v : 3.5; if (lv) use(lv); S.profil.roulable = Math.round(nv * w * 100) / 100; say(nv + ' voie(s) de ' + fr(w) + ' m — chaussée ' + fr(S.profil.roulable) + ' m'); }
          }
          break;
        }
        case 'chaussee': { const x = ns.find((y) => y.v >= 3 && y.v <= 30); if (x) { S.profil.roulable = x.v; use(x); say('Chaussée de ' + fr(x.v) + ' m'); } break; }
        case 'largeur': { const x = ns.find((y) => y.v >= 3 && y.v <= 40); if (x) { S.profil.largeurForcee = x.v; use(x); say('Largeur du tablier ' + fr(x.v) + ' m'); } break; }
        case 'biais': { const x = ns[0]; if (x) { S.biais = Math.round(x.u === '°' ? x.v / 0.9 : x.v); use(x); say('Biais ' + S.biais + ' gr'); } break; }
        case 'hauteur': { const x = ns.find((y) => y.v > 0.2 && y.v < 6); if (x) { S.tablier.h = x.v; use(x); say('Hauteur du tablier imposée ' + fr(x.v, 2) + ' m'); } break; }
        case 'revet': { const x = ns.find((y) => y.u === 'cm' || y.v < 0.3); if (x) { S.equip.revetement = x.u === 'cm' ? x.v / 100 : x.v; use(x); say('Revêtement ' + fr(S.equip.revetement * 100) + ' cm'); } break; }
        case 'entraxe': { const x = ns.find((y) => y.v >= 3.5 && y.v <= 6); if (x) { S.profil.entraxe = x.v; use(x); say('Entraxe des voies ' + fr(x.v) + ' m'); } break; }
      }
      prev = g;
    });
    /* contrainte du sol, où qu'elle soit écrite */
    { const re = /(\d+(?:\.\d+)?)\s*(mpa|bars?|kpa)\b/g; let x; while ((x = re.exec(s))) { const v = x[2] === 'mpa' ? +x[1] : x[2] === 'kpa' ? x[1] / 1000 : x[1] / 10; if (v > 0.03 && v < 3) { S.fond.sigma = v; mark(x.index, x.index + x[0].length); say('σ admissible ' + fr(v, 2) + ' MPa'); } } }

    /* portées écrites sans mot-clé : « VIPP 4 × 30 m », « 12-16-12 m », « PRP de 19,40 m » */
    if (!spansFrom && !Ltot) {
      const rx = /(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*m?\b/g; let x;
      while ((x = rx.exec(s))) if (!used[x.index]) { spansFrom = Array(Math.min(12, +x[1])).fill(+x[2]); mark(x.index, x.index + x[0].length); break; }
    }
    if (!spansFrom && !Ltot) {
      const rq = /\d+(?:\.\d+)?(?:\s*m)?(?:\s*[-+\/]\s*\d+(?:\.\d+)?(?:\s*m)?)+/g; let x;
      while ((x = rq.exec(s))) {
        if (used[x.index]) continue;
        const seg = segs.filter((g) => g.i < x.index).pop();
        if (seg && /pile|culee|pieu|trottoir|voie/.test(seg.k)) continue;
        spansFrom = x[0].split(/[-+\/]/).map((v) => parseFloat(v)).filter((v) => v >= 3); mark(x.index, x.index + x[0].length); break;
      }
    }
    if (!spansFrom && !Ltot) {
      const head = segs.length ? segs[0].i : s.length, rh = /(\d+(?:\.\d+)?)\s*m\b/g; let x;
      while ((x = rh.exec(s.slice(0, head)))) {
        if (used[x.index]) continue;
        const v = +x[1]; if (v < 3) continue;
        const kT = typeExplicit || (typeHint === 'dalle' ? 'PSIDA' : S.tablier.type);
        if ((nSpans && nSpans > 1) || v > C.TYPES[kT].dom[S.usage === 'rail' ? 'rail' : 'route'][1] * 1.15) Ltot = v;
        else { spansFrom = [v]; if (!nSpans) nSpans = 1; }
        mark(x.index, x.index + x[0].length); break;
      }
    }

    /* ── résolution des travées ── */
    const T0 = typeExplicit || (typeHint ? null : S.tablier.type);
    const dom = (k) => C.TYPES[k].dom[S.usage === 'rail' ? 'rail' : 'route'];
    const typical = (k) => { const [a, b] = dom(k); return r05(a + 0.55 * (b - a)); };
    const build = (n, c, ri) => (n === 1 ? [c] : n === 2 ? [ri || c, ri || c] : [ri || r05(0.8 * c)].concat(Array(n - 2).fill(c), [ri || r05(0.8 * c)]));
    if (Array.isArray(spansFrom)) { S.travees = spansFrom.slice(0, 12); spansSet = true; }
    else if (spansFrom && spansFrom.all) { S.travees = Array(nSpans || S.travees.length).fill(spansFrom.all); spansSet = true; }
    else if (spansFrom) { const n = nSpans || Math.max(3, S.travees.length); const c = spansFrom.cent || r05((spansFrom.rive || 10) / 0.8); S.travees = build(n, c, spansFrom.rive || null); spansSet = true; }
    else if (Ltot) {
      const kT = T0 || (typeHint === 'dalle' ? 'PSIDP' : 'VIPP');
      const n = nSpans || Math.max(1, Math.round(Ltot / typical(kT)));
      const cont = (contWanted != null ? contWanted : C.TYPES[kT].contDef) && n > 2, r = cont ? 0.8 : 1;
      const c = Ltot / (n > 2 ? n - 2 + 2 * r : n);
      let t = n > 2 ? [r * c].concat(Array(n - 2).fill(c), [r * c]) : Array(n).fill(Ltot / n);
      t = t.map((v) => Math.round(v * 20) / 20); t[n > 2 ? 1 : 0] = Math.round((t[n > 2 ? 1 : 0] + Ltot - t.reduce((a, b) => a + b, 0)) * 100) / 100;
      S.travees = t; spansSet = true;
    } else if (nSpans && nSpans !== S.travees.length) {
      const kT = T0 || (typeHint === 'dalle' ? 'PSIDA' : 'VIPP');
      S.travees = build(nSpans, typical(kT)); spansSet = true;
      ok.push('Portées types retenues pour ' + C.TYPES[kT].nom + ' (à préciser)');
    }
    if (spansSet || nSpans) {
      const L = S.travees.reduce((a, b) => a + b, 0);
      say(S.travees.length + ' travée' + (S.travees.length > 1 ? 's' : '') + ' : ' + S.travees.map((v) => fr(v)).join(' – ') + ' m (L = ' + fr(L) + ' m)');
    }
    /* hauteurs des piles cohérentes avec le nombre de travées */
    const np = S.travees.length - 1, hp = S.piles.hauteurs;
    if (S.piles._all != null) { S.piles.hauteurs = Array(np).fill(S.piles._all); delete S.piles._all; }
    else { while (hp.length < np) hp.push(hp.length ? hp[hp.length - 1] : (S.culees.hauteurs[0] || 6)); hp.length = Math.max(0, np); }

    /* ── type de tablier (après les portées) ── */
    const Lmax = Math.max.apply(null, S.travees);
    let kType = typeExplicit;
    if (!kType && typeHint === 'dalle') kType = Lmax <= dom('PSIDA')[1] ? 'PSIDA' : 'PSIDP';
    if (!kType && typeHint === 'poutres') kType = Lmax >= 30 ? 'VIPP' : 'PRAD';
    let auto = false;
    if (!kType && spansSet && C.typeStatus(S.tablier.type, S.travees, S.usage).k === 'hors') {
      const order = S.usage === 'rail' ? ['PRP', 'PSIDA', 'PSIDP', 'PRAD', 'VIPP', 'MIXTE'] : ['PSIDA', 'PSIDP', 'PRAD', 'VIPP', 'MIXTE', 'PRP'];
      kType = order.find((k) => C.typeStatus(k, S.travees, S.usage).k === 'ok') || order.find((k) => C.typeStatus(k, S.travees, S.usage).k === 'lim');
      auto = !!kType;
    }
    if (kType) {
      if (kType !== S.tablier.type) {
        const was = S.hyp && S.hyp.betonTab === C.hypDefaults(S.usage, S.tablier.type).betonTab;
        S.tablier.type = kType; S.tablier.continu = null; S.tablier.h = S.tablier.h && ok.some((o) => /Hauteur du tablier/.test(o)) ? S.tablier.h : 0;
        if (was && !ok.some((o) => /Béton du tablier/.test(o))) S.hyp.betonTab = C.hypDefaults(S.usage, kType).betonTab;
      }
      ok.unshift('Tablier ' + C.TYPES[kType].nom + ' — ' + C.TYPES[kType].titre.toLowerCase() + (typeExplicit ? '' : auto ? ' (proposé : ' + C.TYPES[S0.tablier.type].nom + ' hors domaine pour ces portées)' : ' (déduit des portées)'));
    }
    if (contWanted != null) { S.tablier.continu = contWanted; say(contWanted ? 'Tablier continu' : 'Travées isostatiques'); }

    /* ── ce qui n'a pas été interprété : nombres et mots significatifs restants ── */
    const STOP = /^(pont|ponts|viaduc|ouvrage|avec|sans|sur|sous|des|les|une|un|le|la|de|du|et|en|a|au|aux|par|pour|type|environ|chacun|chacune|chaque|metres?|m|mpa|tablier|dalle|appuis?|cote|droit|gauche|beton|precontraint|arme|haut|hauteur|totale|total|fondes?|fonde|reposant|portant|franchissant|franchir|donc|aussi|plus|tous|toutes|longueur|de la|mm|cm|gr|grades?|ses|son|sa|leur|leurs|est|sont|soit|sera|seront|oued|riviere|nouveau|nouvel|creer|cree|faire|fais|mettre|mets|stp|svp|fondes?|fondees?|fondee|reposant|appuye|appuyes?|appuyees?)$/;
    const miss = []; let cur = '', curHas = false;
    for (let k = 0; k <= s.length; k++) {
      if (k < s.length && !used[k] && !/[,;.\n()]/.test(s[k])) { cur += raw[k] || ''; continue; }
      const words = cur.trim().split(/\s+/).filter((w) => w && !STOP.test(norm(w).replace(/[^a-z0-9.']/g, '')) && (/\d/.test(w) || w.length > 3));
      if (words.length) miss.push(words.join(' '));
      cur = ''; curHas = false;
    }
    const out = C.normalize(S);
    return {
      S: out, ok, miss: miss.filter((w) => !/^['-]+$/.test(w)).slice(0, 8),
      hint: ok.length ? '' : 'Exemples : « pont dalle à 3 travées de 12-16-12 m », « VIPP 4 × 30 m sur piles colonnes de 8 m », « pont-rail PRP de 19,40 m, culées sur pieux Ø1,20 », « sol 0,25 MPa, C35/45 ».',
    };
  }

  function setUsage(S, v) {
    const D = C.defaults(v);
    if (S.projet.nom === C.defaults(v === 'rail' ? 'route' : 'rail').projet.nom) S.projet.nom = D.projet.nom;
    S.usage = v; S.equip.retenue = D.equip.retenue; S.culees.dalleTransition = D.culees.dalleTransition; S.equip.gargouilles = D.equip.gargouilles;
  }

  return { interpret };
});
