/* BridgeAI Studios — Bridge Composer : interface façon logiciel de calcul de structures
 * (barre de titre, menus + ruban de commandes, arborescence de l'ouvrage, grille de propriétés,
 *  vue graphique zoomable, fenêtre de tableaux, barre d'état). */
(function () {
  'use strict';
  const C = window.COMP, $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const KEY = 'bas-composer-v1', UIKEY = 'bas-composer-ui';
  const fr = C.fr;
  const f0 = (v) => Math.round(v).toLocaleString('fr-FR');
  const fx = (v, d) => (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const show = (v) => (v === 0 || v ? String(v).replace('.', ',') : '');

  let S = load() || C.normalize(C.defaults('route'));
  let M = null, view = 'elev', tab = 'predim', menu = 'ouvrage', selId = 'tablier', showDims = true, dockOpen = true;
  const expanded = new Set(['projet', 'tablier', 'travees', 'appuis', 'resultats']);
  try { const u = JSON.parse(localStorage.getItem(UIKEY) || '{}'); if (u.tw) document.documentElement.style.setProperty('--tree-w', u.tw + 'px'); if (u.dh) document.documentElement.style.setProperty('--dock-h', u.dh + 'px'); } catch (e) { /* préférences indisponibles */ }

  function load() { try { const t = localStorage.getItem(KEY); return t ? C.normalize(JSON.parse(t)) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ } }
  function saveUI(k, v) { try { const u = JSON.parse(localStorage.getItem(UIKEY) || '{}'); u[k] = v; localStorage.setItem(UIKEY, JSON.stringify(u)); } catch (e) { /* idem */ } }

  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const ks = p.split('.');
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }

  /* ───────── Icônes (24 × 24) ───────── */
  const I = {
    new: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 11v6M9 14h6"/>',
    open: '<path d="M3 6h6l2 2h10v11H3z"/><path d="M3 11h18"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h8V3M8 21v-7h8v7"/>',
    pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 15h6M9 18h4"/>',
    dxf: '<path d="M3 20h18"/><path d="M4 17V8l5-4 5 4v9M14 11h6v6"/><path d="M7 17v-4h4v4"/>',
    home: '<path d="M3 11l9-7 9 7M6 9v11h12V9"/>',
    reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 3v4h4"/>',
    route: '<path d="M2 9h20M4 9v11M20 9v11"/><path d="M4 20q8-9 16 0"/><path d="M5 6h3M10.5 6h3M16 6h3"/>',
    rail: '<path d="M2 9h20M4 9v11M20 9v11"/><path d="M4 20q8-9 16 0"/><path d="M4 6h16M7 4v4M12 4v4M17 4v4"/>',
    addSpan: '<path d="M2 9h13M4 9v10M13 9v10"/><path d="M19 6v8M15 10h8"/>',
    delSpan: '<path d="M2 9h13M4 9v10M13 9v10"/><path d="M15 10h8"/>',
    continu: '<path d="M2 8h20M4 8v11M12 8v11M20 8v11"/><path d="M4 12q4 5 8 0q4 5 8 0" stroke-dasharray="2 2"/>',
    dalleC: '<path d="M2 7h20"/><path d="M5 9v9M10 9v9M14 9v9M19 9v9"/><path d="M10 7l2-2 2 2"/>',
    EN: '<rect x="3" y="4" width="18" height="16" rx="2"/><text x="12" y="15.3" font-size="8" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700">EN</text>',
    F61: '<rect x="3" y="4" width="18" height="16" rx="2"/><text x="12" y="15.3" font-size="7.5" text-anchor="middle" fill="currentColor" stroke="none" font-weight="700">F61</text>',
    BN4: '<path d="M4 21V8M20 21V8M2 11h20M2 15h20"/>',
    GBA: '<path d="M6 21l2-4 1-9h6l1 9 2 4z"/>',
    GC: '<path d="M4 21V7M20 21V7M3 7h18M8 7v14M12 7v14M16 7v14"/>',
    corniche: '<path d="M3 9h14v3H3z"/><path d="M17 6h4v10h-4z"/>',
    etanch: '<path d="M3 14h18M3 18h18"/><path d="M12 3c3 4 4 6 4 7.5a4 4 0 0 1-8 0C8 9 9 7 12 3z"/>',
    garg: '<path d="M3 8h18M16 8v6l3 6"/><path d="M19 22v0"/>',
    semelle: '<path d="M10 3h4v11h-4z"/><path d="M4 14h16v4H4z"/>',
    pieux: '<path d="M10 3h4v7h-4z"/><path d="M4 10h16v3H4z"/><path d="M7 13v8M12 13v8M17 13v8" stroke-dasharray="2 1.5"/>',
    transition: '<path d="M3 7h7v13"/><path d="M10 10l11 3v2l-11-3"/>',
    predim: '<path d="M3 6h18v3l-5 2v6H8v-6L3 9z"/><path d="M21 13v6M19 13h4M19 19h4"/>',
    ddc: '<path d="M6 3v11M12 3v11M18 3v11"/><path d="M3 11l3 4 3-4M9 11l3 4 3-4M15 11l3 4 3-4"/><path d="M3 20h18"/>',
    appuis: '<path d="M3 4h18v3H3z"/><path d="M9 7v9h6V7"/><path d="M5 16h14v4H5z"/>',
    metre: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15v3M8 18h2M12 18h2"/>',
    msg: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.4"/>',
    elev: '<path d="M2 8h20M4 8v12M12 8v12M20 8v12"/><path d="M2 20h20"/>',
    sec: '<path d="M3 5h18v2l-4 2v4H7V9L3 7z"/><path d="M9 13v8h6v-8"/>',
    fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><rect x="8" y="8" width="8" height="8"/>',
    zin: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6M7 10h6M10 7v6"/>',
    zout: '<circle cx="10" cy="10" r="6"/><path d="M15 15l6 6M7 10h6"/>',
    dims: '<path d="M3 7v10M21 7v10M3 12h18M6 9.5L3 12l3 2.5M18 9.5l3 2.5-3 2.5"/>',
    dock: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 14h18M6 17h6"/>',
    tree: '<path d="M4 4h6v4H4zM10 6h4M14 4h6v4h-6zM7 8v8h7M14 14h6v4h-6z"/>',
  };
  const DECK = {
    PSIDA: '<path d="M3 6h54v2l-9 3v7H12v-7l-9-3z"/>',
    PSIDP: '<path d="M3 6h54v2l-9 3v7H12v-7l-9-3z"/><path d="M14 10q16 9 32 0" stroke-dasharray="2 2"/>',
    VIPP: '<path d="M3 5h54v3H3z"/><path d="M12 8v8m-4 0h8v3H8zM30 8v8m-4 0h8v3h-8zM48 8v8m-4 0h8v3h-8z"/>',
    PRAD: '<path d="M3 5h54v3H3z"/><path d="M9 8v7h-3v3h6v-3h-3M21 8v7h-3v3h6v-3h-3M33 8v7h-3v3h6v-3h-3M45 8v7h-3v3h6v-3h-3"/>',
    PRP: '<path d="M4 5h52v13H4z"/><path d="M9 9h4M11 9v9M9 18h4M21 9h4M23 9v9M21 18h4M35 9h4M37 9v9M35 18h4M47 9h4M49 9v9M47 18h4"/>',
    MIXTE: '<path d="M3 5h54v2l-8 2H11l-8-2z"/><path d="M15 9h6M18 9v10M14 19h8M39 9h6M42 9v10M38 19h8"/>',
    voile: '<path d="M18 3h24v4H18zM24 7h12v14H24zM18 21h24v2H18z"/>',
    colonnes: '<path d="M14 3h32v5H14zM19 8h4v13h-4zM37 8h4v13h-4zM14 21h32v2H14z"/>',
    marteau: '<path d="M10 3h40v3l-12 4H22L10 6zM25 10h10v11H25zM18 21h24v2H18z"/>',
    enterree: '<path d="M8 4h20v4H8zM14 8h4v12h-4zM28 4h28M22 8l20 14"/><path d="M10 20h12v3H10z"/>',
    remblayee: '<path d="M8 3h4v18H8zM4 21h12v2H4zM12 3h44M12 6l40 0v8l-40 5" stroke-dasharray="2 2"/>',
  };
  const ico = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
  const icoW = (k) => `<svg class="w" viewBox="0 0 60 24" aria-hidden="true">${DECK[k]}</svg>`;

  /* ───────── Ruban ───────── */
  const rb = (cmd, label, icon, o) => {
    o = o || {};
    return `<button type="button" class="rb${o.on ? ' on' : ''}" data-cmd="${cmd}"${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.dis ? ' disabled' : ''} title="${esc(o.tip || label.replace(/<br>/g, ' '))}"${o.on != null ? ` aria-pressed="${!!o.on}"` : ''}>${o.wide ? icoW(icon) : ico(icon)}<span>${label}</span></button>`;
  };
  const rs = (cmd, label, icon, o) => {
    o = o || {};
    return `<button type="button" class="rs${o.on ? ' on' : ''}" data-cmd="${cmd}"${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.dis ? ' disabled' : ''}${o.on != null ? ` aria-pressed="${!!o.on}"` : ''}>${icon === 'box' ? '<span class="box"></span>' : ico(icon)}${label}</button>`;
  };
  const grp = (label, inner) => `<div class="rgroup"><div class="rbtns">${inner}</div><div class="rlabel">${label}</div></div>`;
  const col = (inner) => `<div class="rcol">${inner}</div>`;

  function ribbonHTML() {
    const rail = S.usage === 'rail', T = C.TYPES[S.tablier.type], n = S.travees.length;
    if (menu === 'fichier') {
      return grp('Projet', rb('new', 'Nouveau', 'new') + rb('open', 'Ouvrir', 'open') + rb('save', 'Enregistrer', 'save', { tip: 'Enregistrer le projet (.json) — Ctrl+S' }))
        + grp('Exporter', rb('pdf', 'Note<br>PDF', 'pdf', { tip: 'Note de prédimensionnement (impression PDF)' }) + rb('dxf', 'Plan<br>DXF', 'dxf', { tip: 'Plan de coffrage d’ensemble (AutoCAD)' }))
        + grp('Site', rb('home', 'Accueil', 'home', { tip: 'Retour à BridgeAI Studios' }));
    }
    if (menu === 'ouvrage') {
      return grp('Usage', rb('usage', 'Pont-<br>route', 'route', { arg: 'route', on: !rail }) + rb('usage', 'Pont-<br>rail', 'rail', { arg: 'rail', on: rail }))
        + grp('Type de tablier', C.TYPE_KEYS.map((k) => {
          const st = C.typeStatus(k, S.travees, S.usage);
          return rb('deck', C.TYPES[k].nom, k, { arg: k, on: k === S.tablier.type, wide: true, tip: C.TYPES[k].titre + ' — ' + (st.k === 'ok' ? 'adapté aux portées' : st.k === 'lim' ? 'en limite de domaine' : 'hors domaine') });
        }).join(''))
        + grp('Travées', rb('addSpan', 'Ajouter<br>travée', 'addSpan', { dis: n >= 12 }) + rb('delSpan', 'Retirer<br>travée', 'delSpan', { dis: n <= 1 })
          + col(rs('continu', 'Continues', 'box', { on: M.cont, dis: !(T.iso && T.cont && n > 1) })
            + rs('dalleC', 'Hourdis continu', 'box', { on: S.tablier.dalleContinuite && T.famille === 'poutres' && n > 1, dis: !(T.famille === 'poutres' && n > 1) })))
        + grp('Piles', Object.keys(C.PILES).map((k) => rb('pile', C.PILES[k].nom, k, { arg: k, on: S.piles.type === k, wide: true, dis: n <= 1, tip: C.PILES[k].desc })).join(''))
        + grp('Culées', Object.keys(C.CULEES).map((k) => rb('culee', C.CULEES[k].nom, k, { arg: k, on: S.culees.type === k, wide: true, tip: C.CULEES[k].desc })).join(''));
    }
    if (menu === 'charges') {
      let h = grp('Règlement', rb('reg', rail ? 'EN 1991-2' : 'Eurocodes', 'EN', { arg: 'EC', on: S.reglement === 'EC' }) + rb('reg', rail ? 'UIC 71' : 'Fasc. 61', 'F61', { arg: 'F61', on: S.reglement === 'F61' }));
      h += grp(rail ? 'Trafic ferroviaire' : 'Trafic routier', col(rail
        ? `<label class="rfield">Coefficient α <input type="text" inputmode="decimal" data-k="alpha" value="${show(S.alpha)}"></label><label class="rfield">Voies <input type="text" inputmode="decimal" data-k="profil.nbVoiesFer" value="${show(S.profil.nbVoiesFer)}"></label>`
        : `<label class="rfield">Classe <select data-k="classe" data-sel="1">${[1, 2, 3].map((c) => `<option value="${c}"${S.classe === c ? ' selected' : ''}>${c === 1 ? '1re' : c + 'e'} classe</option>`).join('')}</select></label><label class="rfield">Chaussée (m) <input type="text" inputmode="decimal" data-k="profil.roulable" value="${show(S.profil.roulable)}"></label>`));
      if (!rail) h += grp('Retenue', ['BN4', 'GBA', 'GC'].map((k) => rb('retenue', { BN4: 'BN4', GBA: 'GBA', GC: 'Garde-<br>corps' }[k], k, { arg: k, on: S.equip.retenue === k })).join(''));
      h += grp('Superstructures', col(rs('toggle', 'Corniches', 'box', { arg: 'equip.corniches', on: S.equip.corniches }) + rs('toggle', 'Étanchéité', 'box', { arg: 'equip.etancheite', on: S.equip.etancheite })
        + (rail ? '' : rs('toggle', 'Gargouilles', 'box', { arg: 'equip.gargouilles', on: S.equip.gargouilles }))));
      return h;
    }
    if (menu === 'appuis') {
      return grp('Fondation des piles', rb('fondP', 'Semelles', 'semelle', { arg: 'superficielle', on: S.fond.piles === 'superficielle', dis: n <= 1 }) + rb('fondP', 'Pieux', 'pieux', { arg: 'pieux', on: S.fond.piles === 'pieux', dis: n <= 1 }))
        + grp('Fondation des culées', rb('fondC', 'Semelles', 'semelle', { arg: 'superficielle', on: S.fond.culees === 'superficielle' }) + rb('fondC', 'Pieux', 'pieux', { arg: 'pieux', on: S.fond.culees === 'pieux' }))
        + grp('Sol et pieux', col(`<label class="rfield">σ adm (MPa) <input type="text" inputmode="decimal" data-k="fond.sigma" value="${show(S.fond.sigma)}"></label>`
          + `<label class="rfield">Pieux Ø <select data-k="fond.diam" data-sel="1">${[0.6, 0.8, 1, 1.2, 1.5].map((d) => `<option value="${d}"${S.fond.diam === d ? ' selected' : ''}>${fr(d, 2)} m</option>`).join('')}</select></label>`
          + `<label class="rfield">L pieux (m) <input type="text" inputmode="decimal" data-k="fond.long" value="${show(S.fond.long)}"></label>`))
        + grp('Culées', rb('toggle', 'Dalles de<br>transition', 'transition', { arg: 'culees.dalleTransition', on: S.culees.dalleTransition && !rail, dis: rail }));
    }
    if (menu === 'resultats') {
      return grp('Tableaux', rb('tab', 'Prédimen-<br>sionnement', 'predim', { arg: 'predim', on: tab === 'predim' }) + rb('tab', 'Descente<br>de charges', 'ddc', { arg: 'ddc', on: tab === 'ddc' })
        + rb('tab', 'Appuis &amp;<br>fondations', 'appuis', { arg: 'appuis', on: tab === 'appuis' }) + rb('tab', 'Métrés<br>&amp; coût', 'metre', { arg: 'metre', on: tab === 'metre' })
        + rb('tab', 'Messages', 'msg', { arg: 'msg', on: tab === 'msg' }))
        + grp('Exporter', rb('pdf', 'Note<br>PDF', 'pdf') + rb('dxf', 'Plan<br>DXF', 'dxf'));
    }
    // affichage
    return grp('Vue', rb('view', 'Élévation', 'elev', { arg: 'elev', on: view === 'elev' }) + rb('view', 'Coupe<br>transversale', 'sec', { arg: 'sec', on: view === 'sec' }))
      + grp('Zoom', rb('fit', 'Ajuster', 'fit') + rb('zin', 'Zoom +', 'zin') + rb('zout', 'Zoom −', 'zout'))
      + grp('Afficher', rb('dims', 'Cotes', 'dims', { on: showDims }) + rb('dock', 'Tableaux', 'dock', { on: dockOpen }));
  }
  function renderRibbon() { $('#ribbon').innerHTML = ribbonHTML(); }

  /* ───────── Arborescence ───────── */
  const TI = {
    projet: ['#1f5fd1', '<path d="M3 2h7l3 3v9H3z"/><path d="M10 2v3h3"/>'],
    usage: ['#5d6676', '<circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>'],
    profil: ['#5d6676', '<path d="M1 5h14v2l-3 1.5v3H4v-3L1 7z"/>'],
    tablier: ['#1f5fd1', '<path d="M1 5h14v3H1z"/><path d="M4 8v5M12 8v5"/>'],
    section: ['#1f5fd1', '<path d="M1 4h14v2l-3 1.5v4H4v-4L1 6z"/>'],
    gperm: ['#1f5fd1', '<path d="M4 2v8M8 2v8M12 2v8M2 8l2 3 2-3M6 8l2 3 2-3M10 8l2 3 2-3"/><path d="M1 14h14"/>'],
    travees: ['#2f6f3e', '<path d="M1 6h14M2 6v7M8 6v7M14 6v7"/>'],
    travee: ['#2f6f3e', '<path d="M2 8h12M2 5v6M14 5v6"/>'],
    appuis: ['#7a4e12', '<path d="M3 3h10v2H3zM6 5v6h4V5M2 11h12v3H2z"/>'],
    culee: ['#7a4e12', '<path d="M3 2h3v11H3zM1 13h9v2H1zM6 4h9"/>'],
    pile: ['#7a4e12', '<path d="M3 2h10v2H3zM6 4v8h4V4M3 12h10v2H3z"/>'],
    fond: ['#6b4fa0', '<path d="M6 2h4v6H6zM2 8h12v3H2zM4 11v4M8 11v4M12 11v4"/>'],
    equip: ['#5d6676', '<path d="M2 14V4M14 14V4M1 7h14M1 10h14"/>'],
    prix: ['#5d6676', '<circle cx="8" cy="8" r="6"/><path d="M10 5.5H7a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H6M8 4v8"/>'],
    resultats: ['#c2410c', '<rect x="2" y="2" width="12" height="12"/><path d="M2 6h12M2 10h12M6 2v12"/>'],
    res: ['#c2410c', '<path d="M2 3h12M2 7h12M2 11h8"/>'],
  };
  const tico = (k) => `<span class="ti"><svg viewBox="0 0 16 16" stroke="${TI[k][0]}">${TI[k][1]}</svg></span>`;

  function treeModel() {
    const rail = S.usage === 'rail', T = C.TYPES[S.tablier.type], n = S.travees.length;
    const nW = M.warn.length;
    return [
      { id: 'projet', ic: 'projet', l: S.projet.nom || 'Ouvrage', v: S.projet.ouvrage, kids: [
        { id: 'usage', ic: 'usage', l: 'Usage & règlement', v: (rail ? 'Rail' : 'Route') + ' · ' + (S.reglement === 'EC' ? 'EC' : (rail ? 'UIC 71' : 'F61')) },
        { id: 'profil', ic: 'profil', l: 'Profil en travers', v: 'W = ' + fr(M.W, 2) + ' m' },
      ] },
      { id: 'tablier', ic: 'tablier', l: 'Tablier', v: T.nom + ' · h ' + fr(M.h, 2) + ' m', warn: M.st.k !== 'ok', kids: [
        { id: 'section', ic: 'section', l: 'Coupe transversale', v: fr(M.sec.Abet + M.sec.Aprefa, 2) + ' m²' },
        { id: 'gperm', ic: 'gperm', l: 'Charges permanentes', v: 'g = ' + fx(M.g, 1) + ' kN/m' },
      ] },
      { id: 'travees', ic: 'travees', l: 'Travées', v: n + ' · ' + fr(M.Ltot, 2) + ' m', kids: S.travees.map((L, i) => ({ id: 'T' + (i + 1), ic: 'travee', l: 'Travée ' + (i + 1), v: fr(L, 2) + ' m' })) },
      { id: 'appuis', ic: 'appuis', l: 'Appuis', v: String(M.supports.length), kids: M.supports.map((s) => ({
        id: s.id, ic: s.kind === 'culee' ? 'culee' : 'pile', l: s.id,
        v: (s.kind === 'culee' ? C.CULEES[s.geo.type].nom : C.PILES[s.geo.type].nom) + ' · H ' + fr(s.H, 2),
        warn: s.fo.mode === 'superficielle' ? s.fo.B > 10 : false,
      })) },
      { id: 'fond', ic: 'fond', l: 'Fondations', v: n > 1 ? (S.fond.piles === 'pieux' ? 'pieux' : 'semelles') + ' / ' + (S.fond.culees === 'pieux' ? 'pieux' : 'semelles') : (S.fond.culees === 'pieux' ? 'pieux' : 'semelles') },
      { id: 'equip', ic: 'equip', l: 'Équipements', v: rail ? 'ballast' : ({ BN4: 'BN4', GBA: 'GBA', GC: 'garde-corps' }[S.equip.retenue]) },
      { id: 'prix', ic: 'prix', l: 'Prix unitaires', v: S.devise || 'MAD' },
      { id: 'resultats', ic: 'resultats', l: 'Résultats', v: fx(M.total / 1e6, 2) + ' M' + (S.devise || 'MAD'), kids: [
        { id: 'r-predim', ic: 'res', l: 'Prédimensionnement' },
        { id: 'r-ddc', ic: 'res', l: 'Descente de charges' },
        { id: 'r-appuis', ic: 'res', l: 'Appuis & fondations' },
        { id: 'r-metre', ic: 'res', l: 'Métrés & coût', v: f0(M.kpi.parM2) + ' /m²' },
        { id: 'r-msg', ic: 'res', l: 'Messages', v: nW ? nW + ' alerte' + (nW > 1 ? 's' : '') : 'aucune alerte', warn: nW > 0 },
      ] },
    ];
  }
  const allIds = (nodes, out) => { nodes.forEach((x) => { out.push(x.id); if (x.kids) allIds(x.kids, out); }); return out; };
  function parentOf(id, nodes, p) {
    for (const x of nodes) { if (x.id === id) return p || null; if (x.kids) { const r = parentOf(id, x.kids, x.id); if (r !== undefined) return r; } }
    return undefined;
  }
  function renderTree() {
    const nodes = treeModel();
    if (!allIds(nodes, []).includes(selId)) selId = 'tablier';
    const li = (x) => {
      const hasK = x.kids && x.kids.length, open = hasK && expanded.has(x.id);
      return `<li role="treeitem"${hasK ? ` aria-expanded="${open}"` : ''} aria-selected="${x.id === selId}"><div class="tn${x.id === selId ? ' sel' : ''}" data-node="${x.id}" tabindex="${x.id === selId ? 0 : -1}">`
        + `<span class="tw${hasK ? (open ? ' o' : ' c') : ''}" data-tw="${hasK ? x.id : ''}"></span>${tico(x.ic)}<span class="tl">${esc(x.l)}${x.v ? `<span class="tv"> — ${esc(x.v)}</span>` : ''}</span>${x.warn ? '<span class="wb" title="Voir les messages">!</span>' : ''}</div>`
        + (open ? `<ul role="group">${x.kids.map(li).join('')}</ul>` : '') + '</li>';
    };
    $('#tree').innerHTML = `<ul>${nodes.map(li).join('')}</ul>`;
    $('#treeSub').textContent = '';
  }
  const visibleNodes = () => $$('#tree .tn');

  /* ───────── Grille de propriétés ───────── */
  const G = (t) => `<tr class="grp"><td colspan="2">${t}</td></tr>`;
  const pNum = (label, path, unit, o) => {
    o = o || {};
    const v = o.val !== undefined ? o.val : getPath(S, path);
    return `<tr><td title="${esc(label)}">${label}</td><td class="v"><div class="u"><input type="text" inputmode="decimal" data-k="${path}" value="${esc(show(v))}" placeholder="${esc(o.ph || '')}" aria-label="${esc(label)}"><span>${unit || ''}</span></div></td></tr>`;
  };
  const pTxt = (label, path) => `<tr><td>${label}</td><td class="v"><input type="text" class="txt" data-k="${path}" data-txt="1" value="${esc(getPath(S, path) || '')}" aria-label="${esc(label)}"></td></tr>`;
  const pSel = (label, path, opts) => {
    const v = String(getPath(S, path));
    return `<tr><td>${label}</td><td class="v"><select data-k="${path}" data-sel="1" aria-label="${esc(label)}">${opts.map(([val, t]) => `<option value="${esc(val)}"${String(val) === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td></tr>`;
  };
  const pChk = (label, path, dis) => `<tr><td>${label}</td><td class="v"><input type="checkbox" data-k="${path}" data-chk="1"${getPath(S, path) ? ' checked' : ''}${dis ? ' disabled' : ''} aria-label="${esc(label)}"></td></tr>`;
  const pRO = (label, val) => `<tr class="ro"><td title="${esc(label)}">${label}</td><td>${val}</td></tr>`;
  const pNote = (t) => `<tr class="note"><td colspan="2">${t}</td></tr>`;
  const pBtns = (b) => `<tr class="btns"><td colspan="2">${b}</td></tr>`;
  const OUINON = (b) => (b ? 'oui' : 'non');

  function supRO(s) {
    const f = s.fo;
    let h = G('Efforts (descente de charges)') + pRO('G tablier', f0(s.G) + ' kN') + pRO('Q exploitation', f0(s.Q) + ' kN') + pRO('ELS / ELU', f0(s.els) + ' / ' + f0(s.elu) + ' kN')
      + pRO('Poids de l’appui', f0(s.Gapp) + ' kN') + pRO('N en tête de fondation', '<b>' + f0(s.N) + ' kN</b>');
    h += G('Éléments') + s.geo.parts.map((p) => pRO(esc(p.des), fx(p.V, 1) + ' m³')).join('');
    h += G('Fondation');
    if (f.mode === 'superficielle') {
      h += pRO('Semelle B × L × e', fr(f.B, 2) + ' × ' + fr(f.L, 2) + ' × ' + fr(f.e, 2) + ' m');
      const ok = f.q / 1000 <= S.fond.sigma * 1.001;
      h += pRO('Contrainte moyenne', `<span style="color:${ok ? 'var(--ok)' : 'var(--danger)'}">${fr(f.q / 1000, 3)} MPa ≤ ${fr(S.fond.sigma, 2)}</span>`);
    } else {
      h += pRO('Pieux', f.n + ' × Ø ' + fr(f.D, 2) + ' m (' + f.nr + ' × ' + f.m + '), L = ' + fr(f.Lp, 1) + ' m');
      if (f.e > 0) h += pRO('Massif', fr(f.Lx, 2) + ' × ' + fr(f.Ly, 2) + ' × ' + fr(f.e, 2) + ' m');
      h += pRO('Effort par pieu', `<span style="color:${f.Npieu <= f.Q * 1.001 ? 'var(--ok)' : 'var(--danger)'}">${fr(f.Npieu / 1000, 2)} MN ≤ ${fr(f.Q / 1000, 2)}</span>`);
    }
    h += G('Appareils d’appui');
    s.lines.forEach((l) => { h += pRO((s.lines.length > 1 ? (l.side === 'G' ? 'Ligne gauche' : 'Ligne droite') : 'Ligne') + ' : ' + l.nb + ' u', esc(l.app.des)); h += pRO('σ moyenne · ux', (l.app.sigma ? fr(l.app.sigma, 1) + ' MPa · ' : '') + fr(l.ux, 0) + ' mm'); });
    return h;
  }

  function propsHTML() {
    const rail = S.usage === 'rail', T = C.TYPES[S.tablier.type], n = S.travees.length, id = selId, m = M;
    let h = '', sub = '';
    if (id === 'projet') {
      sub = 'Projet';
      h = G('Identification') + pTxt('Nom de l’ouvrage', 'projet.nom') + pTxt('Repère', 'projet.ouvrage') + pTxt('Référence', 'projet.ref') + pTxt('Maître d’ouvrage', 'projet.moa') + pTxt('Lieu', 'projet.lieu')
        + G('Synthèse') + pRO('Longueur', fr(m.Ltot, 2) + ' m') + pRO('Largeur', fr(m.W, 2) + ' m') + pRO('Surface de tablier', f0(m.surf) + ' m²') + pRO('Béton', f0(m.kpi.beton) + ' m³')
        + pRO('Aciers HA', fx(m.kpi.acier / 1000, 1) + ' t') + (m.kpi.prec > 0 ? pRO('Précontrainte', fx(m.kpi.prec / 1000, 1) + ' t') : '') + (m.kpi.metal > 0 ? pRO(T.famille === 'prp' ? 'Poutrelles' : 'Charpente', fx(m.kpi.metal / 1000, 0) + ' t') : '')
        + pRO('Coût HT', '<b>' + f0(m.total) + ' ' + esc(S.devise) + '</b>') + pRO('Ratio', f0(m.kpi.parM2) + ' ' + esc(S.devise) + '/m²');
    } else if (id === 'usage') {
      sub = 'Usage & règlement';
      h = G('Usage') + pSel('Type d’ouvrage', 'usage', [['route', 'Pont-route'], ['rail', 'Pont-rail']])
        + pSel('Règlement de charges', 'reglement', rail ? [['EC', 'EN 1991-2 (LM71, SW/2)'], ['F61', 'UIC 71 / Livret 2.01']] : [['EC', 'Eurocodes (LM1)'], ['F61', 'Fascicule 61 titre II']]);
      h += rail ? pNum('Coefficient α (LM71)', 'alpha', '') : pSel('Classe du pont', 'classe', [[1, '1re classe'], [2, '2e classe'], [3, '3e classe']]);
      h += G('Combinaisons') + pNote(esc(m.cb.lab)) + pNote(esc(trafLabel()));
    } else if (id === 'profil') {
      sub = 'Profil en travers';
      h = G('Profil en travers');
      if (rail) h += pNum('Nombre de voies', 'profil.nbVoiesFer', '') + pNum('Entraxe des voies', 'profil.entraxe', 'm') + pNum('Demi-largeur hors voie', 'profil.demiLarg', 'm');
      else h += pNum('Trottoir gauche', 'profil.trottoirG', 'm') + pNum('Chaussée (roulable)', 'profil.roulable', 'm') + pNum('Trottoir droit', 'profil.trottoirD', 'm');
      h += pNum('Largeur imposée', 'profil.largeurForcee', 'm', { val: S.profil.largeurForcee || '', ph: 'auto' }) + pRO('Largeur du tablier W', '<b>' + fr(m.W, 2) + ' m</b>');
    } else if (id === 'tablier') {
      sub = T.nom;
      h = G('Tablier') + pSel('Type', 'tablier.type', C.TYPE_KEYS.map((k) => { const st = C.typeStatus(k, S.travees, S.usage); return [k, C.TYPES[k].nom + ' — ' + (st.k === 'ok' ? 'adapté' : st.k === 'lim' ? 'limite' : 'hors domaine')]; }))
        + pRO('Désignation', esc(T.titre)) + pRO('Domaine d’emploi', T.dom[S.usage].join(' – ') + ' m')
        + pNum('Hauteur imposée', 'tablier.h', 'm', { val: S.tablier.h || '', ph: fr(m.pd.h, 2) + ' (auto)' })
        + pRO('Hauteur retenue', '<b>' + fr(m.h, 2) + ' m</b>' + (m.hAuto ? '' : ' (imposée)'))
        + pChk('Travées continues', 'tablier.continu', !(T.iso && T.cont && n > 1))
        + (T.famille === 'poutres' ? pChk('Hourdis continu sur appuis', 'tablier.dalleContinuite', n <= 1) : '')
        + G('Prédimensionnement') + pNote(esc(m.pd.regle) + '.<br>' + esc(T.ref));
    } else if (id === 'section') {
      sub = 'Coupe transversale';
      const tmp = document.createElement('div'); tmp.innerHTML = tPredim();
      const rows = [...tmp.querySelectorAll('table')[0].rows].slice(3);
      h = G('Coupe transversale') + rows.map((r) => pRO(r.cells[0].textContent, r.cells[1].innerHTML)).join('');
    } else if (id === 'gperm') {
      sub = 'Charges permanentes';
      h = G('Par mètre de tablier (kN/m)') + pRO('Poids propre de la structure', fx(m.gStruct, 1)) + (m.gEnt > 0 ? pRO('Entretoises d’about', fx(m.gEnt, 1)) : '')
        + m.sup.rows.map((r) => pRO(esc(r[0]), fx(r[1], 1))).join('') + pRO('<b>Total g</b>', '<b>' + fx(m.g, 1) + '</b>');
    } else if (id === 'travees') {
      sub = n + ' travée' + (n > 1 ? 's' : '');
      h = G('Travées') + S.travees.map((L, i) => pNum('Travée ' + (i + 1), 'travees.' + i, 'm')).join('') + pNum('Biais', 'biais', 'gr')
        + pRO('Longueur entre culées', '<b>' + fr(m.Ltot, 2) + ' m</b>') + pRO('Fonctionnement', m.cont ? 'continu' : 'travées indépendantes')
        + pBtns(`<button class="mini" data-cmd="addSpan"${n >= 12 ? ' disabled' : ''}>Ajouter une travée</button> <button class="mini" data-cmd="delSpan"${n <= 1 ? ' disabled' : ''}>Retirer la dernière</button>`);
    } else if (/^T\d+$/.test(id)) {
      const i = +id.slice(1) - 1;
      sub = 'Travée ' + (i + 1);
      h = G('Travée ' + (i + 1)) + pNum('Portée (entre axes d’appui)', 'travees.' + i, 'm') + pRO('Abscisse de début', fr(m.xs[i], 2) + ' m') + pRO('Abscisse de fin', fr(m.xs[i + 1], 2) + ' m')
        + pRO('Appuis', M.supports[i].id + ' → ' + M.supports[i + 1].id)
        + pBtns(`<button class="mini" data-cmd="insSpan" data-arg="${i}"${n >= 12 ? ' disabled' : ''}>Dupliquer la travée</button> <button class="mini" data-cmd="rmSpan" data-arg="${i}"${n <= 1 ? ' disabled' : ''}>Supprimer la travée</button>`);
    } else if (id === 'appuis') {
      sub = M.supports.length + ' lignes';
      h = G('Appuis') + M.supports.map((s) => pRO(s.id + ' — ' + (s.kind === 'culee' ? 'culée' : 'pile'), 'H ' + fr(s.H, 2) + ' m · N ' + f0(s.N) + ' kN')).join('')
        + G('Types') + (n > 1 ? pSel('Type de piles', 'piles.type', Object.keys(C.PILES).map((k) => [k, C.PILES[k].nom])) : '') + pSel('Type de culées', 'culees.type', Object.keys(C.CULEES).map((k) => [k, C.CULEES[k].nom]));
    } else if (/^[CP]\d+$/.test(id)) {
      const s = M.supports.find((x) => x.id === id);
      if (s.kind === 'culee') {
        const k = s.j === 0 ? 0 : 1;
        sub = 'Culée ' + id;
        h = G('Culée ' + id) + pSel('Type (les deux culées)', 'culees.type', Object.keys(C.CULEES).map((x) => [x, C.CULEES[x].nom]))
          + pNum('Hauteur H', 'culees.hauteurs.' + k, 'm') + (rail ? '' : pChk('Dalles de transition', 'culees.dalleTransition'))
          + pNote('H : du dessus de la fondation au sommier d’appui.') + pSel('Fondation des culées', 'fond.culees', [['superficielle', 'Semelle'], ['pieux', 'Pieux forés']]) + supRO(s);
      } else {
        sub = 'Pile ' + id;
        h = G('Pile ' + id) + pSel('Type (toutes les piles)', 'piles.type', Object.keys(C.PILES).map((x) => [x, C.PILES[x].nom]))
          + pNum('Hauteur H', 'piles.hauteurs.' + (s.j - 1), 'm')
          + pSel('Fondation des piles', 'fond.piles', [['superficielle', 'Semelle'], ['pieux', 'Pieux forés']]) + supRO(s);
      }
    } else if (id === 'fond') {
      sub = 'Fondations';
      h = G('Modes') + (n > 1 ? pSel('Piles', 'fond.piles', [['superficielle', 'Semelles'], ['pieux', 'Pieux forés']]) : '') + pSel('Culées', 'fond.culees', [['superficielle', 'Semelles'], ['pieux', 'Pieux forés']])
        + G('Sol') + pNum('σ admissible (ELS)', 'fond.sigma', 'MPa')
        + G('Pieux') + pSel('Diamètre', 'fond.diam', [[0.6, 'Ø 0,60 m'], [0.8, 'Ø 0,80 m'], [1, 'Ø 1,00 m'], [1.2, 'Ø 1,20 m'], [1.5, 'Ø 1,50 m']]) + pNum('Longueur', 'fond.long', 'm') + pNum('Charge admissible / pieu', 'fond.qadm', 'MN')
        + pNote('Effort centré, sans moment ; les culées remblayées sont majorées de 25 % pour la poussée des terres.');
    } else if (id === 'equip') {
      sub = 'Équipements';
      h = G('Équipements');
      if (!rail) h += pSel('Dispositif de retenue', 'equip.retenue', [['BN4', 'Barrière BN4'], ['GBA', 'GBA (béton)'], ['GC', 'Garde-corps seul']]) + pNum('Épaisseur d’enrobés', 'equip.revetement', 'm');
      h += pChk('Corniches', 'equip.corniches') + pChk('Étanchéité', 'equip.etancheite') + (rail ? '' : pChk('Gargouilles', 'equip.gargouilles'));
      if (rail) h += pNote('Ballast 0,60 m, caniveaux à câbles et garde-corps comptés d’office.');
    } else if (id === 'prix') {
      sub = 'Prix unitaires HT';
      h = G('Monnaie') + pTxt('Devise', 'devise') + G('Prix unitaires') + Object.keys(C.PRIX).map((k) => pNum(esc(C.PRIX[k].des), 'prix.' + k, C.PRIX[k].u === '%' ? '%' : '/' + C.PRIX[k].u)).join('')
        + pNote('Prix indicatifs, à ajuster au marché. Joints : prix de base × coefficient selon le souffle ; pieux : prix de base pour Ø 1,00 m.');
    } else if (id === 'resultats' || /^r-/.test(id)) {
      sub = 'Résultats';
      const k = m.kpi;
      h = G('Synthèse') + pRO('Béton', f0(k.beton) + ' m³ (' + fr(k.beton / k.surf, 2) + ' m³/m²)') + pRO('Aciers HA', fx(k.acier / 1000, 1) + ' t (' + f0(k.acier / k.surf) + ' kg/m²)')
        + (k.prec > 0 ? pRO('Précontrainte', fx(k.prec / 1000, 1) + ' t') : '') + (k.metal > 0 ? pRO(T.famille === 'prp' ? 'Poutrelles' : 'Charpente', fx(k.metal / 1000, 0) + ' t') : '')
        + pRO('Épaisseur équivalente', fr(k.epEq, 2) + ' m') + pRO('Coût HT', '<b>' + f0(m.total) + ' ' + esc(S.devise) + '</b>') + pRO('Ratio', f0(k.parM2) + ' ' + esc(S.devise) + '/m²')
        + G('Lots') + m.lots.map((L) => pRO(esc(L.lot), f0(L.mt))).join('')
        + pNote('Détail dans la fenêtre de tableaux, sous la vue graphique.');
    }
    return { h: `<table class="pg"><tbody>${h}</tbody></table>`, sub };
  }
  function renderProps() { const p = propsHTML(); $('#props').innerHTML = p.h; $('#propSub').textContent = p.sub; }

  /* conserve la saisie en cours (focus, texte brut, curseur) pendant un rendu */
  let rendering = false;
  function keepFocus(fn) {
    const a = document.activeElement, k = a && a.dataset ? a.dataset.k : null;
    const raw = k ? a.value : null, pos = k && a.type === 'text' ? a.selectionStart : null, inRib = a && a.closest && a.closest('#ribbon');
    rendering = true;
    try { fn(); } finally { rendering = false; }
    if (!k) return;
    const el = document.querySelector((inRib ? '#ribbon' : '#props') + ` [data-k="${k}"]`);
    if (!el) return;
    el.focus();
    if (el.type === 'text') { el.value = raw; try { el.setSelectionRange(pos, pos); } catch (e) { /* champ non textuel */ } }
  }

  /* ───────── Tableaux de résultats ───────── */
  const kN = (v) => f0(v);

  function tPredim() {
    const T = M.T, s = M.sec, i = s.info, u = S.usage, st = M.st;
    const rows = [
      ['Type', T.nom + ' — ' + T.titre],
      ['Domaine d’emploi', T.dom[u].join(' – ') + ' m — ' + (st.k === 'ok' ? 'portées adaptées' : st.k === 'lim' ? 'en limite' : 'hors domaine')],
      ['Travées', S.travees.length + ' × (' + S.travees.map((v) => fr(v, 2)).join(' ; ') + ') m — ' + (M.cont ? 'continues' : 'indépendantes' + (T.famille === 'poutres' && S.travees.length > 1 && S.tablier.dalleContinuite ? ', hourdis continu' : ''))],
      ['Largeur W', fr(M.W, 2) + ' m'],
      ['Hauteur h', fr(M.h, 2) + ' m ' + (M.hAuto ? '(prédimensionnée)' : '(imposée ; prédim. ' + fr(M.pd.h, 2) + ' m)') + '<br><small>' + esc(M.pd.regle) + ' — ' + esc(T.ref) + '</small>'],
    ];
    if (T.famille === 'dalle') rows.push(['Coupe', i.lc > 0 ? 'Nervure ' + fr(i.Bn, 2) + ' m, encorbellements ' + fr(i.lc, 2) + ' m (ép. ' + fr(i.er, 2) + ' → ' + fr(i.et, 2) + ' m)' : 'Dalle rectangulaire']);
    if (T.famille === 'poutres') rows.push(['Coupe', s.nbPoutres + ' poutres, entraxe ' + fr(s.entraxe, 2) + ' m, âme ' + fr(i.b0, 2) + ' m, talon ' + fr(i.bt, 2) + ' m ; hourdis ' + fr(i.eh, 2) + ' m']);
    if (T.famille === 'prp') rows.push(['Coupe', i.nbProfils + ' × ' + i.profil + ' espacés de ' + fr(i.espacement, 2) + ' m ; enrobage supérieur ' + fr(M.h - parseInt(i.profil.slice(4), 10) / 1000, 2) + ' m']);
    if (T.famille === 'mixte') rows.push(['Coupe', '2 poutres de ' + fr(i.hp, 2) + ' m à ' + fr(i.a, 2) + ' m d’entraxe ; hourdis ' + fr(i.hs, 2) + ' m (rives ' + fr(i.te, 2) + ' m) ; charpente ≈ ' + i.kgm2 + ' kg/m²']);
    rows.push(['Section de béton', fr(s.Abet + s.Aprefa, 3) + ' m²/ml — épaisseur équivalente ' + fr(M.kpi.epEq, 2) + ' m']);
    let h = '<h4>Tablier</h4><div class="tw"><table class="t"><tbody>' + rows.map((r) => `<tr><td class="l" style="width:150px;color:var(--mute)">${r[0]}</td><td class="l">${r[1]}</td></tr>`).join('') + '</tbody></table></div>';
    const g = [['Poids propre de la structure', M.gStruct]];
    if (M.gEnt > 0) g.push(['Entretoises d’about (réparties)', M.gEnt]);
    M.sup.rows.forEach((r) => g.push([r[0], r[1]]));
    h += '<h4>Charges permanentes <small>par mètre de tablier</small></h4><div class="tw"><table class="t"><thead><tr><th>Désignation</th><th>kN/m</th></tr></thead><tbody>'
      + g.map((r) => `<tr><td class="l">${esc(r[0])}</td><td>${fx(r[1], 1)}</td></tr>`).join('') + `<tr class="tot"><td>Total g</td><td>${fx(M.g, 1)}</td></tr></tbody></table></div>`;
    return h;
  }

  function trafLabel() {
    if (S.usage === 'rail') {
      const l = M.lines[0].det;
      return (S.reglement === 'EC' ? 'EN 1991-2 : LM71' : 'UIC 71 (Livret 2.01)') + ' × α = ' + fr(S.alpha, 2) + ' et SW/2, ' + l.voies + ' voie(s) chargée(s), coefficient dynamique Φ₂ = ' + fr(l.Phi, 2) + ' (LΦ = ' + fr(M.LPhi, 1) + ' m).';
    }
    if (S.reglement === 'EC') return 'EN 1991-2 : LM1 (TS + UDL), classe ' + S.classe + ' de l’annexe nationale française, ' + M.lines[0].det.voies + ' voie(s) de 3 m ; trottoirs 3 kN/m².';
    return 'Fascicule 61 titre II : A(l) et Bc (δ), pont de ' + S.classe + (S.classe === 1 ? 're' : 'e') + ' classe, ' + M.lines[0].det.voies + ' voie(s) ; trottoirs 1,5 kN/m².';
  }

  function tDdc() {
    let h = `<p class="hint">${esc(trafLabel())}<br>Combinaisons : ${esc(M.cb.lab)}.</p>`;
    h += '<h4>Réactions par ligne d’appui <small>kN, toutes voies confondues</small></h4><div class="tw"><table class="t"><thead><tr><th>Appui</th><th class="tx">Ligne</th><th>Portées</th><th>G</th><th>Q</th><th class="tx">Modèle</th><th>ELS</th><th>ELU</th></tr></thead><tbody>';
    M.lines.forEach((l) => {
      const id = M.supports[l.j].id, side = l.side === 'C' ? 'unique' : l.side === 'G' ? 'côté gauche' : 'côté droit';
      h += `<tr class="pick" data-pick="${id}"><td>${id}</td><td class="mute">${side}</td><td class="mute">${[l.Lg, l.Ld].filter((v) => v > 0).map((v) => fr(v, 2)).join(' + ')} m</td><td>${kN(l.G)}</td><td>${kN(l.Q)}</td><td class="mute">${esc(l.det.mod)}</td><td>${kN(l.els)}</td><td>${kN(l.elu)}</td></tr>`;
    });
    h += '</tbody></table></div>';
    h += '<h4>Efforts en tête de fondation <small>kN</small></h4><div class="tw"><table class="t"><thead><tr><th>Appui</th><th>G tablier</th><th>Q</th><th>ELS</th><th>ELU</th><th>Poids de l’appui</th><th>N (ELS car.)</th></tr></thead><tbody>';
    M.supports.forEach((s) => { h += `<tr class="pick" data-pick="${s.id}"><td>${s.id}</td><td>${kN(s.G)}</td><td>${kN(s.Q)}</td><td>${kN(s.els)}</td><td>${kN(s.elu)}</td><td>${kN(s.Gapp)}</td><td><b>${kN(s.N)}</b></td></tr>`; });
    h += '</tbody></table></div>';
    h += '<ul class="notes">' + M.notes.map((n) => `<li>${esc(n)}</li>`).join('') + '</ul>';
    return h;
  }
  function tMetre() {
    const dv = S.devise || 'MAD';
    let h = '<div class="tw"><table class="t"><thead><tr><th>Code</th><th class="l">Désignation</th><th>U</th><th>Quantité</th><th>P.U. ' + esc(dv) + '</th><th>Montant ' + esc(dv) + '</th></tr></thead><tbody>';
    M.lots.forEach((L) => {
      h += `<tr class="lot"><td colspan="6">${esc(L.lot)}</td></tr>`;
      M.metres.filter((m) => m.lot === L.lot).forEach((m) => {
        const pct = m.u === '%';
        h += `<tr><td class="mute">${m.code}</td><td class="l">${esc(m.des)}</td><td class="mute">${m.u}</td><td>${pct ? fx(m.q, 1) : fx(m.q, m.u === 'kg' ? 0 : 1)}</td><td>${pct ? '' : f0(m.pu)}</td><td>${f0(m.mt)}</td></tr>`;
      });
      h += `<tr class="tot"><td></td><td class="l">Sous-total ${esc(L.lot.replace(/^\d+\.\s*/, ''))}</td><td></td><td></td><td></td><td>${f0(L.mt)}</td></tr>`;
    });
    h += `<tr class="grand"><td></td><td class="l">Total HT</td><td></td><td></td><td></td><td>${f0(M.total)}</td></tr></tbody></table></div>`;
    const k = M.kpi;
    h += `<p class="hint">Ratios : <b>${fr(k.beton / k.surf, 2)} m³</b> de béton et <b>${f0(k.acier / k.surf)} kg</b> d’aciers HA par m² de tablier ; tablier seul : épaisseur équivalente <b>${fr(k.epEq, 2)} m</b>. Coût <b>${f0(k.parM2)} ${esc(dv)}/m²</b> HT. Prix modifiables dans l’arborescence (Prix unitaires).</p>`;
    return h;
  }

  /* ───────── Vue graphique : rendu, sélection, zoom et déplacement ───────── */
  const cv = $('#cv');
  let vbBase = null, vb = null, scene = null;
  const tagOf = (id) => (id === 'section' || id === 'gperm' ? 'tablier' : id);

  function renderView() {
    const cw = Math.max(260, cv.clientWidth), ch = Math.max(180, cv.clientHeight);
    scene = view === 'elev' ? C.elevScene(M) : C.secScene(M);
    const opt = { width: cw, id: view === 'elev' ? 've' : 'vs', kp: 3.3, pad: 18, dims: showDims };
    let svg = C.toSVG(scene, opt);
    const hh = +(svg.match(/height="(\d+)"/) || [0, ch])[1];
    if (hh > ch) { opt.width = Math.max(220, cw * ch / hh); svg = C.toSVG(scene, opt); }
    $('#svgHost').innerHTML = svg;
    const el = $('#svgHost svg');
    el.removeAttribute('width'); el.removeAttribute('height');
    vbBase = el.getAttribute('viewBox').split(/\s+/).map(Number);
    vb = vbBase.slice();
    applySel();
    $$('.dtab').forEach((b) => b.classList.toggle('on', b.dataset.v === view));
    $('#vinfo').textContent = (view === 'elev' ? 'Élévation' : 'Coupe transversale') + ' · plan DXF 1/' + scene.ech + ' · molette : zoom · glisser : déplacer';
  }
  function applyVB() { const el = $('#svgHost svg'); if (el) el.setAttribute('viewBox', vb.map((v) => v.toFixed(2)).join(' ')); }
  function applySel() {
    $$('#svgHost .sel').forEach((e) => e.classList.remove('sel'));
    const t = tagOf(selId);
    $$(`#svgHost [data-tag="${t}"]`).forEach((e) => e.classList.add('sel'));
  }
  function zoomAt(f, cx, cy) {
    const nw = Math.min(vbBase[2] * 4, Math.max(vbBase[2] / 40, vb[2] * f)), k = nw / vb[2];
    if (cx == null) { cx = vb[0] + vb[2] / 2; cy = vb[1] + vb[3] / 2; }
    vb = [cx - (cx - vb[0]) * k, cy - (cy - vb[1]) * k, vb[2] * k, vb[3] * k];
    applyVB();
  }
  function toSvgPt(ev) {
    const el = $('#svgHost svg'), p = el.createSVGPoint();
    p.x = ev.clientX; p.y = ev.clientY;
    return p.matrixTransform(el.getScreenCTM().inverse());
  }
  cv.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const p = toSvgPt(ev);
    zoomAt(ev.deltaY > 0 ? 1.15 : 1 / 1.15, p.x, p.y);
  }, { passive: false });
  let drag = null;
  cv.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const el = $('#svgHost svg'); if (!el) return;
    const m = el.getScreenCTM();
    drag = { x: ev.clientX, y: ev.clientY, vb: vb.slice(), k: 1 / m.a, moved: false, tag: ev.target.closest && ev.target.closest('[data-tag]') };
    cv.setPointerCapture(ev.pointerId);
  });
  cv.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true; cv.classList.add('drag');
    vb = [drag.vb[0] - dx * drag.k, drag.vb[1] - dy * drag.k, drag.vb[2], drag.vb[3]];
    applyVB();
  });
  const endDrag = () => {
    if (!drag) return;
    const d = drag; drag = null; cv.classList.remove('drag');
    if (!d.moved && d.tag) select(d.tag.dataset.tag, { reveal: true, keepView: true });
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', () => { drag = null; cv.classList.remove('drag'); });
  cv.addEventListener('dblclick', () => { vb = vbBase.slice(); applyVB(); });

  /* ───────── Fenêtre de tableaux ───────── */
  function tAppuis() {
    let h = '<h4>Appuis <small>éléments et volumes</small></h4><table class="t"><thead><tr><th>Appui</th><th class="tx">Type</th><th>H (m)</th><th class="l">Éléments</th><th>Béton (m³)</th><th>N fondation (kN)</th></tr></thead><tbody>';
    M.supports.forEach((s) => {
      h += `<tr class="pick" data-pick="${s.id}"><td>${s.id}</td><td class="tx">${s.kind === 'culee' ? 'Culée ' + C.CULEES[s.geo.type].nom.toLowerCase() : 'Pile ' + C.PILES[s.geo.type].nom.toLowerCase()}</td><td>${fr(s.H, 2)}</td><td class="l">${s.geo.parts.map((p) => esc(p.des)).join(' ; ')}</td><td>${fx(s.geo.V, 1)}</td><td>${f0(s.N)}</td></tr>`;
    });
    h += '</tbody></table><h4>Fondations</h4><table class="t"><thead><tr><th>Appui</th><th class="tx">Mode</th><th class="l">Dimensions</th><th>Béton (m³)</th><th>Vérification (ELS)</th></tr></thead><tbody>';
    M.supports.forEach((s) => {
      const f = s.fo;
      const dims = f.mode === 'superficielle' ? 'Semelle ' + fr(f.B, 2) + ' × ' + fr(f.L, 2) + ' × ' + fr(f.e, 2) + ' m'
        : f.n + ' pieux Ø ' + fr(f.D, 2) + ' m (' + f.nr + ' × ' + f.m + '), L = ' + fr(f.Lp, 1) + ' m' + (f.e > 0 ? ' ; massif ' + fr(f.Lx, 2) + ' × ' + fr(f.Ly, 2) + ' × ' + fr(f.e, 2) + ' m' : ' ; pieux sous sommier');
      const ok = f.mode === 'superficielle' ? f.q / 1000 <= S.fond.sigma * 1.001 : f.Npieu <= f.Q * 1.001;
      const ver = f.mode === 'superficielle' ? 'q = ' + fr(f.q / 1000, 3) + ' ≤ ' + fr(S.fond.sigma, 2) + ' MPa' : fr(f.Npieu / 1000, 2) + ' ≤ ' + fr(f.Q / 1000, 2) + ' MN/pieu';
      h += `<tr class="pick" data-pick="${s.id}"><td>${s.id}</td><td class="tx">${f.mode === 'superficielle' ? 'Superficielle' : 'Pieux forés'}</td><td class="l">${dims}</td><td>${fx(f.V, 1)}</td><td class="${ok ? 'ok' : 'ko'}">${ver}</td></tr>`;
    });
    h += '</tbody></table><h4>Appareils d’appui <small>élastomère fretté, σ ≤ 15 MPa, T ≥ 2 ux</small></h4><table class="t"><thead><tr><th>Appui</th><th class="tx">Ligne</th><th>Nombre</th><th class="l">Appareil a × b ; n(t + e)</th><th>σ (MPa)</th><th>ux (mm)</th></tr></thead><tbody>';
    M.lines.forEach((l) => {
      const id = M.supports[l.j].id;
      h += `<tr class="pick" data-pick="${id}"><td>${id}</td><td class="mute">${l.side === 'C' ? 'unique' : l.side === 'G' ? 'gauche' : 'droite'}</td><td>${l.nb}</td><td class="l">${esc(l.app.des)}</td><td>${l.app.sigma ? fr(l.app.sigma, 1) : '—'}</td><td>${fr(l.ux, 0)}</td></tr>`;
    });
    h += '</tbody></table><h4>Joints de dilatation</h4><table class="t"><thead><tr><th>Appui</th><th class="l">Type</th><th>Souffle (mm)</th><th>Longueur (m)</th></tr></thead><tbody>'
      + M.joints.map((j) => `<tr><td>${j.lab}</td><td class="l">${esc(j.des)}</td><td>${j.W}</td><td>${fr(M.W, 2)}</td></tr>`).join('') + '</tbody></table>';
    return h;
  }
  function tMsg() {
    let h = '<h4>Messages <small>vérifications de cohérence et hypothèses</small></h4><ul class="msgl">';
    if (!M.warn.length) h += '<li class="o">Aucune alerte : composition dans les domaines d’emploi usuels.</li>';
    h += M.warn.map((w) => `<li class="w">${esc(w)}</li>`).join('') + M.notes.map((n) => `<li class="i">${esc(n)}</li>`).join('');
    return h + '</ul>';
  }
  function renderDock() {
    const f = { predim: tPredim, ddc: tDdc, appuis: tAppuis, metre: tMetre, msg: tMsg }[tab];
    const box = $('#res'), st = box.scrollTop;
    box.innerHTML = f();
    box.scrollTop = st;
    $$('#dtabs .ktab').forEach((b) => {
      b.classList.toggle('on', b.dataset.t === tab);
      if (b.dataset.t === 'msg') b.innerHTML = 'Messages' + (M.warn.length ? `<span class="bd">${M.warn.length}</span>` : '');
    });
    $$('#res [data-pick]').forEach((r) => r.classList.toggle('selr', r.dataset.pick === selId));
  }

  /* ───────── Barre d'état ───────── */
  function renderStatus() {
    const k = M.kpi, rail = S.usage === 'rail', nW = M.warn.length;
    const reg = S.reglement === 'EC' ? (rail ? 'EN 1991-2 · LM71' : 'EN 1991-2 · LM1') : (rail ? 'UIC 71' : 'Fasc. 61 titre II');
    $('#status').innerHTML = `<span class="grow">${nW ? `<span class="w" data-cmd="tab" data-arg="msg" style="padding:0;border:none">⚠ ${nW} alerte${nW > 1 ? 's' : ''}</span>` : 'Prêt'}</span>`
      + `<span>Unités : <b>kN, m</b></span><span>${reg}</span><span>L <b>${fr(k.Ltot, 2)}</b> m</span><span>W <b>${fr(k.W, 2)}</b> m</span><span>h <b>${fr(k.h, 2)}</b> m</span>`
      + `<span>Béton <b>${f0(k.beton)}</b> m³</span><span>Aciers <b>${fx(k.acier / 1000, 1)}</b> t</span><span>Coût HT <b>${fx(k.total / 1e6, 2)}</b> M${esc(S.devise)} · ${f0(k.parM2)}/m²</span>`;
    $('#tbDoc').textContent = '— ' + (S.projet.nom || 'Ouvrage') + (S.projet.ouvrage ? ' (' + S.projet.ouvrage + ')' : '');
    document.title = (S.projet.nom ? S.projet.nom + ' — ' : '') + 'Bridge Composer — BridgeAI Studios';
  }

  /* ───────── Calcul et rendu d'ensemble ───────── */
  function recompute(full) {
    try { M = C.compute(S); } catch (err) { console.error(err); return; }
    keepFocus(() => { renderTree(); renderProps(); renderRibbon(); });
    renderView(); renderDock(); renderStatus();
    save();
    void full;
  }
  function select(id, o) {
    o = o || {};
    const v0 = view;
    if (/^r-/.test(id)) { tab = id.slice(2); if (!dockOpen) toggleDock(); }
    selId = id;
    const p = parentOf(id, treeModel());
    if (p) expanded.add(p);
    if (!o.keepView) {
      if (['section', 'profil', 'equip'].includes(id)) view = 'sec';
      else if (/^T\d+$/.test(id) || /^C\d+$/.test(id)) view = 'elev';
      else if (/^P\d+$/.test(id) && view === 'sec' && !$(`#svgHost [data-tag="${id}"]`)) view = 'elev';
    }
    renderTree(); renderProps(); renderRibbon(); renderDock();
    if (view !== v0) renderView(); else applySel();
    if (o.reveal) { const n = $(`#tree [data-node="${id}"]`); if (n) n.scrollIntoView({ block: 'nearest' }); }
  }

  /* ───────── Commandes ───────── */
  function setUsage(v) {
    if (v === S.usage) return;
    const D = C.defaults(v);
    S.usage = v; S.equip.retenue = D.equip.retenue; S.culees.dalleTransition = D.culees.dalleTransition; S.equip.gargouilles = D.equip.gargouilles;
    if (C.typeStatus(S.tablier.type, S.travees, v).k === 'hors') { S.tablier.type = D.tablier.type; S.tablier.continu = null; S.tablier.h = 0; }
    if (S.projet.nom === C.defaults(v === 'rail' ? 'route' : 'rail').projet.nom) S.projet.nom = D.projet.nom;
  }
  function setValue(k, v) {
    if (k === 'usage') return setUsage(v);
    if (k === 'tablier.type') { S.tablier.type = v; S.tablier.continu = null; S.tablier.h = 0; return; }
    setPath(S, k, v);
  }
  function toggleDock() {
    dockOpen = !dockOpen;
    const r = document.documentElement;
    if (dockOpen) r.style.setProperty('--dock-h', (toggleDock.h || 250) + 'px');
    else { toggleDock.h = parseFloat(getComputedStyle(r).getPropertyValue('--dock-h')) || 250; r.style.setProperty('--dock-h', '27px'); }
  }
  const slug = () => (S.projet.nom || 'ouvrage').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'ouvrage';
  function download(name, data, type) {
    const blob = new Blob([data], { type }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  const today = () => new Date().toLocaleDateString('fr-FR');
  const saveJSON = () => download('composer-' + slug() + '.json', JSON.stringify({ app: 'BridgeAI Studios — Bridge Composer', version: 1, projet: S }, null, 2), 'application/json');

  function run(cmd, arg) {
    const n = S.travees.length;
    switch (cmd) {
      case 'new':
        if (!confirm('Nouveau projet ? La composition en cours sera remplacée (enregistrez-la d’abord si besoin).')) return;
        S = C.normalize(C.defaults(S.usage)); selId = 'tablier'; break;
      case 'open': $('#fOpen').click(); return;
      case 'save': saveJSON(); return;
      case 'pdf': buildPrint(); window.print(); return;
      case 'dxf': download('composer-' + slug() + '.dxf', C.buildDXF(M, { date: today() }), 'application/dxf'); return;
      case 'home': location.href = 'index.html'; return;
      case 'usage': setUsage(arg); break;
      case 'deck': setValue('tablier.type', arg); break;
      case 'addSpan': if (n < 12) { S.travees.push(S.travees[n - 1] || 15); S.piles.hauteurs.push(S.piles.hauteurs[S.piles.hauteurs.length - 1] || 6); } break;
      case 'delSpan': if (n > 1) { S.travees.pop(); S.piles.hauteurs.pop(); } break;
      case 'insSpan': { const i = +arg; if (n < 12) { S.travees.splice(i + 1, 0, S.travees[i]); S.piles.hauteurs.splice(Math.min(i, S.piles.hauteurs.length), 0, S.piles.hauteurs[Math.min(i, S.piles.hauteurs.length - 1)] || 6); selId = 'T' + (i + 2); } break; }
      case 'rmSpan': { const i = +arg; if (n > 1) { S.travees.splice(i, 1); S.piles.hauteurs.splice(Math.min(i, S.piles.hauteurs.length - 1), 1); selId = 'travees'; } break; }
      case 'continu': S.tablier.continu = !S.tablier.continu; break;
      case 'dalleC': S.tablier.dalleContinuite = !S.tablier.dalleContinuite; break;
      case 'pile': S.piles.type = arg; break;
      case 'culee': S.culees.type = arg; break;
      case 'reg': S.reglement = arg; break;
      case 'retenue': S.equip.retenue = arg; break;
      case 'toggle': setPath(S, arg, !getPath(S, arg)); break;
      case 'fondP': S.fond.piles = arg; break;
      case 'fondC': S.fond.culees = arg; break;
      case 'tab': tab = arg; if (!dockOpen) toggleDock(); renderDock(); renderRibbon(); return;
      case 'view': view = arg; renderView(); renderRibbon(); return;
      case 'fit': vb = vbBase.slice(); applyVB(); return;
      case 'zin': zoomAt(1 / 1.25); return;
      case 'zout': zoomAt(1.25); return;
      case 'dims': showDims = !showDims; renderView(); renderRibbon(); renderVtools(); return;
      case 'dock': toggleDock(); renderRibbon(); renderVtools(); requestAnimationFrame(renderView); return;
      default: return;
    }
    S = C.normalize(S);
    recompute(true);
  }

  function renderVtools() {
    $('#vtools').innerHTML = [['fit', 'Ajuster la vue (double-clic)'], ['zin', 'Zoom +'], ['zout', 'Zoom −'], ['dims', 'Afficher les cotes'], ['dock', 'Fenêtre de tableaux']]
      .map(([c, t]) => `<button class="vt${(c === 'dims' && showDims) || (c === 'dock' && dockOpen) ? ' on' : ''}" data-cmd="${c}" title="${t}" aria-label="${t}">${ico(c)}</button>`).join('');
  }

  /* délégation des clics de commande (ruban, propriétés, outils de vue, barre d'état) */
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-cmd]');
    if (!b || b.disabled) return;
    run(b.dataset.cmd, b.dataset.arg);
  });
  $('#menubar').addEventListener('click', (ev) => {
    const b = ev.target.closest('.mtab'); if (!b) return;
    menu = b.dataset.m;
    $$('#menubar .mtab').forEach((x) => x.classList.toggle('on', x === b));
    renderRibbon();
  });
  $$('.dtab').forEach((b) => b.addEventListener('click', () => { view = b.dataset.v; renderView(); renderRibbon(); }));
  $('#dtabs').addEventListener('click', (ev) => { const b = ev.target.closest('.ktab'); if (b) run('tab', b.dataset.t); });
  $('#res').addEventListener('click', (ev) => { const r = ev.target.closest('[data-pick]'); if (r) select(r.dataset.pick, { reveal: true }); });

  /* arborescence : clic, double-clic, clavier */
  const tree = $('#tree');
  tree.addEventListener('click', (ev) => {
    const tw = ev.target.closest('[data-tw]');
    if (tw && tw.dataset.tw) { const id = tw.dataset.tw; if (expanded.has(id)) expanded.delete(id); else expanded.add(id); renderTree(); return; }
    const n = ev.target.closest('[data-node]'); if (n) select(n.dataset.node);
  });
  tree.addEventListener('dblclick', (ev) => {
    const n = ev.target.closest('[data-node]'); if (!n) return;
    const id = n.dataset.node; if (expanded.has(id)) expanded.delete(id); else expanded.add(id); renderTree();
  });
  tree.addEventListener('keydown', (ev) => {
    const list = visibleNodes(), i = list.findIndex((x) => x.dataset.node === selId);
    const go = (j) => { if (list[j]) { select(list[j].dataset.node); const e = $(`#tree [data-node="${selId}"]`); if (e) e.focus(); } };
    if (ev.key === 'ArrowDown') { ev.preventDefault(); go(i + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); go(i - 1); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); expanded.add(selId); renderTree(); const e = $(`#tree [data-node="${selId}"]`); if (e) e.focus(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); if (expanded.has(selId)) { expanded.delete(selId); renderTree(); } else { const p = parentOf(selId, treeModel()); if (p) select(p); } const e = $(`#tree [data-node="${selId}"]`); if (e) e.focus(); }
  });

  /* saisie : propriétés et champs du ruban */
  let tm = null;
  const onInput = (ev) => {
    const el = ev.target;
    if (!el.dataset.k || el.dataset.sel || el.dataset.chk) return;
    let v = el.value;
    if (!el.dataset.txt) { v = v.replace(',', '.').trim(); v = v === '' ? 0 : parseFloat(v); if (!Number.isFinite(v)) return; }
    setValue(el.dataset.k, v);
    clearTimeout(tm);
    tm = setTimeout(() => recompute(false), 250);
  };
  const onChange = (ev) => {
    const el = ev.target;
    if (!el.dataset.k) return;
    if (el.dataset.chk) setValue(el.dataset.k, el.checked);
    else if (el.dataset.sel) setValue(el.dataset.k, isNaN(+el.value) ? el.value : +el.value);
    else return;
    S = C.normalize(S);
    recompute(true);
  };
  const onBlur = (ev) => {
    if (rendering) return;
    const el = ev.target;
    if (!el.dataset || !el.dataset.k || el.dataset.txt || el.dataset.sel || el.dataset.chk) return;
    clearTimeout(tm);
    S = C.normalize(S);
    const v = getPath(S, el.dataset.k);
    el.value = (el.dataset.k === 'tablier.h' || el.dataset.k === 'profil.largeurForcee') ? (v ? show(v) : '') : show(v);
    recompute(false);
  };
  ['#props', '#ribbon'].forEach((s) => {
    const r = $(s);
    r.addEventListener('input', onInput); r.addEventListener('change', onChange); r.addEventListener('focusout', onBlur);
    r.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.k && !ev.target.dataset.sel) ev.target.blur(); });
  });
  $('#fOpen').addEventListener('change', (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try { const o = JSON.parse(r.result); S = C.normalize(o.projet || o); selId = 'projet'; recompute(true); }
      catch (e) { alert('Fichier de projet illisible.'); }
      ev.target.value = '';
    };
    r.readAsText(file);
  });
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); saveJSON(); }
  });

  /* séparateurs redimensionnables */
  function splitter(el, axis) {
    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); el.setPointerCapture(ev.pointerId);
      const r = document.documentElement, work = $('#work').getBoundingClientRect();
      const move = (e) => {
        if (axis === 'x') { const w = Math.min(560, Math.max(220, e.clientX - work.left)); r.style.setProperty('--tree-w', w + 'px'); }
        else { const h = Math.min(work.height - 140, Math.max(60, work.bottom - e.clientY)); r.style.setProperty('--dock-h', h + 'px'); dockOpen = true; }
      };
      const up = () => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up);
        const cs = getComputedStyle(r);
        saveUI('tw', parseFloat(cs.getPropertyValue('--tree-w'))); saveUI('dh', parseFloat(cs.getPropertyValue('--dock-h')));
        renderVtools(); renderView();
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up);
    });
  }
  splitter($('#vsplit'), 'x'); splitter($('#hsplit'), 'y');
  let rz = null;
  new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { if (M) renderView(); }, 120); }).observe(cv);

  /* ───────── Note de prédimensionnement (impression PDF) ───────── */
  /* ───────── Note de prédimensionnement (impression PDF) ───────── */
  function buildPrint() {
    const P = S.projet, T = M.T, dv = S.devise || 'MAD';
    const tab = (head, rows, cls) => `<table class="p-tab"><thead><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${(r.c || r).map((x, i) => `<td${i === 1 && cls ? ' class="l"' : ''}>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const E = C.elevScene(M), Sx = C.secScene(M);
    const svgE = C.toSVG(E, { width: 1000, id: 'qe', kp: 3.2 }), svgS = C.toSVG(Sx, { width: 620, id: 'qs', kp: 3.2 });
    let h = `<div class="p-cart"><div class="p-bet">Bridge<i>AI</i> Studios<small>Bridge Composer — configurateur</small></div>
      <div class="p-title"><div class="p-k">Note de prédimensionnement</div><div class="p-n">${esc(P.nom || 'Ouvrage')}${P.ouvrage ? ' — ' + esc(P.ouvrage) : ''}</div></div>
      <div class="p-meta">${P.moa ? 'MOA : ' + esc(P.moa) + '<br>' : ''}${P.lieu ? 'Lieu : ' + esc(P.lieu) + '<br>' : ''}${P.ref ? 'Réf. : ' + esc(P.ref) + '<br>' : ''}Date : ${today()}</div></div>`;
    h += '<h2 class="p-h">1. Objet</h2><p>Cette note présente la composition retenue pour l’ouvrage, son prédimensionnement selon les guides SETRA, une descente de charges estimée, le dimensionnement indicatif des appareils d’appui et des fondations, ainsi que les métrés et l’estimation du coût. Elle prépare la note de calcul d’exécution, qu’elle ne remplace pas.</p>';
    if (M.warn.length) h += '<div class="p-warn">' + M.warn.map(esc).join('<br>') + '</div>';
    h += '<h2 class="p-h">2. Composition</h2>' + tab(['Élément', 'Choix'], [
      ['Usage, règlement', (S.usage === 'rail' ? 'Pont-rail' : 'Pont-route') + ' — ' + esc(trafLabel())],
      ['Tablier', T.nom + ' — ' + T.titre + ', h = ' + fr(M.h, 2) + ' m'],
      ['Travées', S.travees.map((v) => fr(v, 2)).join(' + ') + ' = ' + fr(M.Ltot, 2) + ' m, ' + (M.cont ? 'continues' : 'indépendantes') + (S.biais < 100 ? ', biais ' + fr(S.biais, 0) + ' gr' : '')],
      ['Profil en travers', 'W = ' + fr(M.W, 2) + ' m' + (S.usage === 'rail' ? ', ' + S.profil.nbVoiesFer + ' voie(s) à ' + fr(S.profil.entraxe, 2) + ' m' : ', chaussée ' + fr(S.profil.roulable, 2) + ' m, trottoirs ' + fr(S.profil.trottoirG, 2) + ' / ' + fr(S.profil.trottoirD, 2) + ' m')],
      ['Piles', S.travees.length > 1 ? (S.travees.length - 1) + ' × ' + C.PILES[S.piles.type].nom.toLowerCase() + ', H = ' + S.piles.hauteurs.map((v) => fr(v, 2)).join(' ; ') + ' m' : '—'],
      ['Culées', C.CULEES[S.culees.type].nom + ', H = ' + S.culees.hauteurs.map((v) => fr(v, 2)).join(' ; ') + ' m' + (S.culees.dalleTransition && S.usage !== 'rail' ? ', dalles de transition' : '')],
      ['Fondations', 'Piles : ' + (S.fond.piles === 'pieux' ? 'pieux' : 'semelles') + ' ; culées : ' + (S.fond.culees === 'pieux' ? 'pieux' : 'semelles') + (S.fond.piles === 'pieux' || S.fond.culees === 'pieux' ? ' (Ø ' + fr(S.fond.diam, 2) + ' m, L = ' + fr(S.fond.long, 1) + ' m, Qadm = ' + fr(S.fond.qadm, 2) + ' MN)' : '') + (S.fond.piles === 'superficielle' || S.fond.culees === 'superficielle' ? ' ; σ adm = ' + fr(S.fond.sigma, 2) + ' MPa' : '')],
    ], true);
    h += `<figure class="p-fig">${svgE}<figcaption>${esc(E.titre.replace(/ — échelle.*$/, ''))}</figcaption></figure>`;
    h += `<figure class="p-fig p-break">${svgS}<figcaption>${esc(Sx.titre.replace(/ — échelle.*$/, ''))}</figcaption></figure>`;
    // prédim
    const tmp = document.createElement('div'); tmp.innerHTML = tPredim();
    const rowsP = [...tmp.querySelectorAll('table')[0].rows].map((r) => [r.cells[0].textContent, r.cells[1].innerHTML]);
    const rowsG = [...tmp.querySelectorAll('table')[1].tBodies[0].rows].map((r) => ({ c: [r.cells[0].textContent, r.cells[1].textContent], cls: r.className }));
    h += '<h2 class="p-h">3. Prédimensionnement du tablier</h2>' + tab(['Paramètre', 'Valeur'], rowsP, true);
    h += '<h3 class="p-h3">Charges permanentes (kN/m)</h3>' + tab(['Désignation', 'kN/m'], rowsG);
    h += '<h2 class="p-h p-break">4. Descente de charges estimée</h2><p>' + esc(trafLabel()) + ' Combinaisons : ' + esc(M.cb.lab) + '.</p>';
    h += tab(['Appui', 'Ligne', 'Portées (m)', 'G (kN)', 'Q (kN)', 'Modèle', 'ELS (kN)', 'ELU (kN)'], M.lines.map((l) => [M.supports[l.j].id, l.side === 'C' ? 'unique' : l.side === 'G' ? 'gauche' : 'droite', [l.Lg, l.Ld].filter((v) => v > 0).map((v) => fr(v, 2)).join(' + '), f0(l.G), f0(l.Q), esc(l.det.mod), f0(l.els), f0(l.elu)]));
    h += tab(['Appui', 'G tablier', 'Q', 'ELS', 'ELU', 'Poids appui', 'N fondation (ELS)'], M.supports.map((s) => [s.id, f0(s.G), f0(s.Q), f0(s.els), f0(s.elu), f0(s.Gapp), f0(s.N)]));
    // appuis
    h += '<h2 class="p-h">5. Appuis, appareils d’appui et fondations</h2>';
    h += tab(['Appui', 'Éléments', 'Fondation', 'Appareils d’appui'], M.supports.map((s) => {
      const f = s.fo;
      const fo = f.mode === 'superficielle' ? 'Semelle ' + fr(f.B, 2) + ' × ' + fr(f.L, 2) + ' × ' + fr(f.e, 2) + ' m ; q = ' + fr(f.q / 1000, 3) + ' MPa' : f.n + ' pieux Ø ' + fr(f.D, 2) + ' m, L = ' + fr(f.Lp, 1) + ' m ; ' + fr(f.Npieu / 1000, 2) + ' MN/pieu' + (f.e > 0 ? ' ; massif ' + fr(f.Lx, 2) + ' × ' + fr(f.Ly, 2) + ' × ' + fr(f.e, 2) + ' m' : '');
      return [s.id + ' (H = ' + fr(s.H, 2) + ' m)', s.geo.parts.map((p) => esc(p.des)).join('<br>'), fo, s.lines.map((l) => l.nb + ' × ' + esc(l.app.des)).join('<br>')];
    }), true);
    h += tab(['Joint', 'Type', 'Souffle'], M.joints.map((j) => [j.lab, esc(j.des), j.W + ' mm']), true);
    // métrés
    const rowsM = [];
    M.lots.forEach((L) => {
      rowsM.push({ c: [esc(L.lot), '', '', '', '', ''], cls: 'lot' });
      M.metres.filter((m) => m.lot === L.lot).forEach((m) => rowsM.push([m.code, esc(m.des), m.u, m.u === '%' ? fx(m.q, 1) : fx(m.q, m.u === 'kg' ? 0 : 1), m.u === '%' ? '' : f0(m.pu), f0(m.mt)]));
      rowsM.push({ c: ['', 'Sous-total', '', '', '', f0(L.mt)], cls: 'tot' });
    });
    rowsM.push({ c: ['', 'TOTAL HT', '', '', '', f0(M.total)], cls: 'tot' });
    h += '<h2 class="p-h p-break">6. Métrés et estimation</h2>' + tab(['Code', 'Désignation', 'U', 'Quantité', 'P.U. ' + esc(dv), 'Montant ' + esc(dv)], rowsM, true);
    h += `<p>Coût ${f0(M.kpi.parM2)} ${esc(dv)} HT/m² de tablier (${f0(M.surf)} m²) — béton ${fr(M.kpi.beton / M.surf, 2)} m³/m², aciers HA ${f0(M.kpi.acier / M.surf)} kg/m².</p>`;
    h += '<h2 class="p-h">7. Hypothèses et limites</h2><div class="p-small"><ul>' + M.notes.map((n) => `<li>${esc(n)}</li>`).join('')
      + '<li>Prédimensionnement par élancements usuels (guides SETRA) ; ratios d’aciers et de charpente statistiques.</li><li>Prix unitaires indicatifs, hors taxes, à ajuster au marché et au projet.</li><li>Document généré par BridgeAI Studios — Bridge Composer ; il ne constitue pas une note de calcul justificative.</li></ul></div>';
    $('#print').innerHTML = h;
  }
  window.addEventListener('beforeprint', buildPrint);

  renderVtools();
  recompute(true);
})();
