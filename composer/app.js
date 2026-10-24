/* BridgeAI Studios — Bridge Composer : interface (composition par blocs, aperçu, résultats, exports). */
(function () {
  'use strict';
  const C = window.COMP, $ = (s, r) => (r || document).querySelector(s);
  const KEY = 'bas-composer-v1';
  const fr = C.fr;
  const f0 = (v) => Math.round(v).toLocaleString('fr-FR');
  const fx = (v, d) => (+v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const show = (v) => (v === 0 || v ? String(v).replace('.', ',') : '');

  let S = load() || C.normalize(C.defaults('route'));
  let M = null, view = 'elev', tab = 'predim';
  const open = new Set(['A', 'B', 'C']);

  function load() { try { const t = localStorage.getItem(KEY); return t ? C.normalize(JSON.parse(t)) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ } }

  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, p, v) {
    const ks = p.split('.');
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = v;
  }

  /* ───────── Icônes ───────── */
  const IC = {
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
  const svgIco = (k) => '<svg viewBox="0 0 60 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">' + IC[k] + '</svg>';

  /* ───────── Champs ───────── */
  const fld = (label, path, unit, o) => {
    o = o || {};
    const v = o.val !== undefined ? o.val : getPath(S, path);
    return `<div class="f${o.wide ? ' wide' : ''}"><label title="${esc(label)}">${label}</label><div class="num"><input type="text" ${o.txt ? 'class="txt"' : 'inputmode="decimal"'} data-k="${path}"${o.txt ? ' data-txt="1"' : ''} value="${esc(o.txt ? (v || '') : show(v))}" placeholder="${esc(o.ph || '')}"${o.aria ? ` aria-label="${esc(o.aria)}"` : ''}>${unit ? `<span>${unit}</span>` : ''}</div></div>`;
  };
  const sel = (label, path, opts, o) => {
    o = o || {};
    const v = String(getPath(S, path));
    return `<div class="f${o.wide ? ' wide' : ''}"><label>${label}</label><div class="num"><select data-k="${path}" data-sel="1">${opts.map(([val, t]) => `<option value="${esc(val)}"${String(val) === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div></div>`;
  };
  const chk = (label, path) => `<label class="chk"><input type="checkbox" data-k="${path}" data-chk="1"${getPath(S, path) ? ' checked' : ''}>${label}</label>`;
  const seg = (path, opts) => `<div class="seg full">${opts.map(([val, t]) => `<button type="button" data-set="${path}" data-val="${esc(val)}"${String(getPath(S, path)) === String(val) ? ' class="on"' : ''}>${t}</button>`).join('')}</div>`;
  const blk = (L, title, sub, body) => `<details class="blk" data-b="${L}"${open.has(L) ? ' open' : ''}><summary><span class="lt">${L}</span><span style="min-width:0"><span class="blk-t">${title}</span><br><span class="blk-s" data-dyn="s${L}">${sub}</span></span></summary><div class="blk-b">${body}</div></details>`;

  function summaries() {
    const u = S.usage, rail = u === 'rail', T = C.TYPES[S.tablier.type], m = M, n = S.travees.length;
    return {
      sA: (rail ? 'Pont-rail' : 'Pont-route') + ' · ' + (S.reglement === 'EC' ? 'Eurocodes' : (rail ? 'UIC 71' : 'Fasc. 61')) + ' · W ' + (m ? fr(m.W, 2) : '') + ' m',
      sB: T.nom + ' · h ' + (m ? fr(m.h, 2) : '') + ' m' + (m && !m.hAuto ? ' (imposée)' : ''),
      sC: n + ' travée' + (n > 1 ? 's' : '') + ' · ' + S.travees.map((v) => fr(+v || 0, 2).replace(/,00$/, '')).join(' + ') + ' m',
      sD: n > 1 ? (n - 1) + ' × ' + C.PILES[S.piles.type].nom.toLowerCase() : 'aucune',
      sE: C.CULEES[S.culees.type].nom + (S.culees.dalleTransition && !rail ? ' · dalles de transition' : ''),
      sF: (n > 1 ? 'Piles : ' + (S.fond.piles === 'pieux' ? 'pieux' : 'semelles') + ' · ' : '') + 'Culées : ' + (S.fond.culees === 'pieux' ? 'pieux' : 'semelles'),
      sG: rail ? 'Ballast · caniveaux · garde-corps' : ({ BN4: 'BN4', GBA: 'GBA', GC: 'Garde-corps' }[S.equip.retenue] + ' · enrobés ' + fr((+S.equip.revetement || 0) * 100, 0) + ' cm'),
      sH: S.projet.nom || '—',
      sI: 'Chiffrage en ' + (S.devise || 'MAD') + ' HT',
      W: m ? fr(m.W, 2) : '—',
      predim: m ? 'Prédimensionnement : <b>h = ' + fr(m.pd.h, 2) + ' m</b> — ' + esc(m.pd.regle) + '.<br>' + esc(T.ref) : '',
      L: m ? 'Longueur entre axes des culées <b>' + fr(m.Ltot, 2) + ' m</b> — surface utile <b>' + f0(m.surf) + ' m²</b>. Portées comptées entre axes d’appui.' : '',
    };
  }
  /* mise à jour des textes calculés sans reconstruire les champs (préserve la saisie en cours) */
  function updateDyn() {
    const D = summaries();
    document.querySelectorAll('#cfg [data-dyn]').forEach((el) => {
      const k = el.dataset.dyn;
      if (k === 'predim' || k === 'L') el.innerHTML = D[k]; else el.textContent = D[k];
    });
    document.querySelectorAll('#cfg [data-st]').forEach((el) => {
      const st = C.typeStatus(el.dataset.st, S.travees.map((v) => +v || 0), S.usage);
      el.className = 'st ' + st.k; el.textContent = st.k === 'ok' ? 'adapté' : st.k === 'lim' ? 'limite' : 'hors domaine';
    });
    const hi = document.querySelector('#cfg [data-k="tablier.h"]');
    if (hi && M) hi.placeholder = fr(M.pd.h, 2) + ' (auto)';
  }

  function renderCfg() {
    const D = summaries();
    const u = S.usage, rail = u === 'rail', Tk = S.tablier.type, T = C.TYPES[Tk], m = M;
    const n = S.travees.length;
    let h = '';

    // A — usage, règlement, profil
    let a = seg('usage', [['route', 'Pont-route'], ['rail', 'Pont-rail']]);
    a += seg('reglement', rail ? [['EC', 'EN 1991-2 (LM71)'], ['F61', 'UIC 71 / Livret 2.01']] : [['EC', 'Eurocodes (LM1)'], ['F61', 'Fascicule 61 titre II']]);
    if (rail) {
      a += '<div class="fg three">' + fld('Voies', 'profil.nbVoiesFer', '') + fld('Entraxe', 'profil.entraxe', 'm') + fld('Demi-largeur', 'profil.demiLarg', 'm') + '</div>';
      a += '<div class="fg">' + fld('Coefficient α (LM71)', 'alpha', '') + fld('Largeur imposée', 'profil.largeurForcee', 'm', { ph: 'auto', val: S.profil.largeurForcee || '' }) + '</div>';
    } else {
      a += '<div class="fg three">' + fld('Trottoir G', 'profil.trottoirG', 'm') + fld('Chaussée', 'profil.roulable', 'm') + fld('Trottoir D', 'profil.trottoirD', 'm') + '</div>';
      a += '<div class="fg">' + sel('Classe du pont', 'classe', [[1, '1re classe'], [2, '2e classe'], [3, '3e classe']]) + fld('Largeur imposée', 'profil.largeurForcee', 'm', { ph: 'auto', val: S.profil.largeurForcee || '' }) + '</div>';
    }
    a += `<p class="hint">Largeur du tablier <b>W = <span data-dyn="W">${D.W}</span> m</b>${rail ? ' — voie(s) ballastée(s), pistes et corniches-caniveaux compris.' : ' — chaussée = largeur roulable (bandes comprises).'}</p>`;
    h += blk('A', 'Usage & règlement', D.sA, a);

    // B — tablier
    let b = '<div class="tiles">' + C.TYPE_KEYS.map((k) => {
      const t = C.TYPES[k], st = C.typeStatus(k, S.travees, u);
      return `<button type="button" class="tile${k === Tk ? ' on' : ''}" data-set="tablier.type" data-val="${k}" title="${esc(t.titre)}">${svgIco(k)}<b>${t.nom}</b><small>${t.titre}</small><span class="st ${st.k}" data-st="${k}">${st.k === 'ok' ? 'adapté' : st.k === 'lim' ? 'limite' : 'hors domaine'}</span></button>`;
    }).join('') + '</div>';
    b += '<div class="fg">' + fld('Hauteur du tablier', 'tablier.h', 'm', { ph: m ? fr(m.pd.h, 2) + ' (auto)' : 'auto', val: S.tablier.h || '' });
    b += `<div class="f"><label>Domaine d’emploi</label><div class="hint" style="padding-top:7px">${T.dom[u].join(' – ')} m (${rail ? 'rail' : 'route'})</div></div></div>`;
    if (T.iso && T.cont && n > 1) b += chk('Travées continues', 'tablier.continu');
    if (T.famille === 'poutres' && n > 1) b += chk('Hourdis continu sur appuis (dalle de continuité)', 'tablier.dalleContinuite');
    b += `<p class="hint" data-dyn="predim">${D.predim}</p>`;
    h += blk('B', 'Tablier', D.sB, b);

    // C — travées
    let c = '<div class="spans">' + S.travees.map((L, i) => `<div class="f"><label>Travée ${i + 1}</label><div class="num"><input type="text" inputmode="decimal" data-k="travees.${i}" value="${show(L)}" aria-label="Portée de la travée ${i + 1}"><span>m</span></div></div>`).join('');
    c += `<button type="button" class="ico" data-act="delSpan" title="Retirer la dernière travée" ${n <= 1 ? 'disabled' : ''}>−</button><button type="button" class="ico" data-act="addSpan" title="Ajouter une travée" ${n >= 12 ? 'disabled' : ''}>+</button></div>`;
    c += '<div class="fg">' + fld('Biais', 'biais', 'gr') + '<div class="f"></div></div>';
    c += `<p class="hint" data-dyn="L">${D.L}</p>`;
    h += blk('C', 'Travées', D.sC, c);

    // D — piles
    let d;
    if (n > 1) {
      d = '<div class="tiles">' + Object.keys(C.PILES).map((k) => `<button type="button" class="tile${k === S.piles.type ? ' on' : ''}" data-set="piles.type" data-val="${k}">${svgIco(k)}<b>${C.PILES[k].nom}</b><small>${C.PILES[k].desc}</small></button>`).join('') + '</div>';
      d += '<div class="sub-t">Hauteur fondation → appui</div><div class="spans">' + S.piles.hauteurs.map((H, i) => `<div class="f"><label>P${i + 1}</label><div class="num"><input type="text" inputmode="decimal" data-k="piles.hauteurs.${i}" value="${show(H)}" aria-label="Hauteur de la pile P${i + 1}"><span>m</span></div></div>`).join('') + '</div>';
    } else d = '<p class="hint">Ouvrage à une travée : pas de pile.</p>';
    h += blk('D', 'Piles', D.sD, d);

    // E — culées
    let e = '<div class="tiles two">' + Object.keys(C.CULEES).map((k) => `<button type="button" class="tile${k === S.culees.type ? ' on' : ''}" data-set="culees.type" data-val="${k}">${svgIco(k)}<b>${C.CULEES[k].nom}</b><small>${C.CULEES[k].desc}</small></button>`).join('') + '</div>';
    e += '<div class="fg">' + fld('Hauteur C0', 'culees.hauteurs.0', 'm') + fld('Hauteur C' + n, 'culees.hauteurs.1', 'm') + '</div>';
    if (!rail) e += chk('Dalles de transition', 'culees.dalleTransition');
    e += '<p class="hint">Hauteur comptée du dessus de la fondation au sommier d’appui.</p>';
    h += blk('E', 'Culées', D.sE, e);

    // F — fondations
    const anySup = S.fond.piles === 'superficielle' || S.fond.culees === 'superficielle', anyP = S.fond.piles === 'pieux' || S.fond.culees === 'pieux';
    let f = '';
    if (n > 1) f += '<div class="sub-t">Piles</div>' + seg('fond.piles', [['superficielle', 'Semelles'], ['pieux', 'Pieux forés']]);
    f += '<div class="sub-t">Culées</div>' + seg('fond.culees', [['superficielle', 'Semelles'], ['pieux', 'Pieux forés']]);
    f += '<div class="fg">';
    if (anySup) f += fld('σ admissible du sol (ELS)', 'fond.sigma', 'MPa', { wide: true });
    if (anyP) f += sel('Diamètre des pieux', 'fond.diam', [[0.6, 'Ø 0,60 m'], [0.8, 'Ø 0,80 m'], [1, 'Ø 1,00 m'], [1.2, 'Ø 1,20 m'], [1.5, 'Ø 1,50 m']]) + fld('Longueur des pieux', 'fond.long', 'm') + fld('Charge admissible par pieu', 'fond.qadm', 'MN', { wide: true });
    f += '</div>';
    h += blk('F', 'Fondations', D.sF, f);

    // G — équipements
    let g = '';
    if (!rail) g += '<div class="fg">' + sel('Dispositif de retenue', 'equip.retenue', [['BN4', 'Barrière BN4'], ['GBA', 'GBA (béton)'], ['GC', 'Garde-corps seul']]) + fld('Enrobés', 'equip.revetement', 'm') + '</div>';
    g += chk('Corniches', 'equip.corniches') + chk('Étanchéité', 'equip.etancheite');
    if (!rail) g += chk('Gargouilles', 'equip.gargouilles');
    else g += '<p class="hint">Ballast 0,60 m, caniveaux à câbles et garde-corps comptés d’office.</p>';
    h += blk('G', 'Équipements', D.sG, g);

    // H — projet
    let p = '<div class="fg">' + fld('Nom de l’ouvrage', 'projet.nom', '', { txt: true, wide: true }) + fld('Repère', 'projet.ouvrage', '', { txt: true }) + fld('Référence', 'projet.ref', '', { txt: true }) + fld('Maître d’ouvrage', 'projet.moa', '', { txt: true }) + fld('Lieu', 'projet.lieu', '', { txt: true }) + '</div>';
    h += blk('H', 'Projet', esc(D.sH), p);

    // I — prix
    let q = '<div class="prix">' + Object.keys(C.PRIX).map((k) => `<label for="px-${k}">${esc(C.PRIX[k].des)} <small>(${C.PRIX[k].u === '%' ? '%' : (S.devise || 'MAD') + '/' + C.PRIX[k].u})</small></label><div class="num"><input id="px-${k}" type="text" inputmode="decimal" data-k="prix.${k}" value="${show(S.prix[k])}"></div>`).join('') + '</div>';
    q += '<div class="fg">' + fld('Devise', 'devise', '', { txt: true }) + '</div><p class="hint">Prix unitaires indicatifs (HT), à ajuster au marché et au projet. Joints : prix de base × coefficient selon le souffle ; pieux : prix de base pour Ø 1,00 m.</p>';
    h += blk('I', 'Prix unitaires', esc(D.sI), q);

    $('#cfg').innerHTML = h;
  }

  /* ───────── Calcul et rendu ───────── */
  function recompute(rebuild) {
    try { M = C.compute(S); } catch (err) { console.error(err); return; }
    if (rebuild) renderCfg(); else updateDyn();
    renderView(); renderKpis(); renderRes();
    save();
  }

  function renderView() {
    const box = $('#draw'), cw = Math.max(280, box.clientWidth - 20);
    let sc, svg;
    if (view === 'elev') {
      sc = C.elevScene(M);
      svg = C.toSVG(sc, { width: Math.max(cw, 640), id: 'pe', kp: 3.4 });
    } else {
      sc = C.secScene(M);
      let w = Math.min(cw, 760);
      svg = C.toSVG(sc, { width: w, id: 'ps', kp: 3.4 });
      const hh = +(svg.match(/height="(\d+)"/) || [0, 0])[1], maxH = window.innerWidth < 1000 ? cw * 1.35 : window.innerHeight * 0.66;
      if (hh > maxH) { w = Math.max(300, w * maxH / hh); svg = C.toSVG(sc, { width: w, id: 'ps', kp: 3.4 }); }
    }
    box.innerHTML = svg;
    $('#drawCap').textContent = sc.titre.replace(/ — échelle.*$/, '') + ' · plan DXF à l’échelle 1/' + sc.ech + (view === 'elev' && Math.max(cw, 640) > cw ? ' · faire défiler horizontalement' : '');
  }

  function renderKpis() {
    const k = M.kpi, dv = S.devise || 'MAD';
    const items = [
      ['Longueur', fx(k.Ltot, 2), 'm'], ['Largeur', fx(k.W, 2), 'm'], ['Surface', f0(k.surf), 'm²'], ['Hauteur tablier', fx(k.h, 2), 'm'],
      ['Béton', f0(k.beton), 'm³'], ['Aciers HA', fx(k.acier / 1000, 1), 't'],
    ];
    if (k.prec > 0) items.push(['Précontrainte', fx(k.prec / 1000, 1), 't']);
    if (k.metal > 0) items.push([M.T.famille === 'prp' ? 'Poutrelles' : 'Charpente', fx(k.metal / 1000, 0), 't']);
    items.push(['Coût HT', fx(k.total / 1e6, 2), 'M' + dv, 'big'], ['Ratio', f0(k.parM2), dv + '/m²', 'big']);
    $('#kp').innerHTML = items.map(([l, v, u, c]) => `<div class="kpi${c ? ' ' + c : ''}"><small>${l}</small><b>${v}<i>${u}</i></b></div>`).join('');
  }

  const kN = (v) => f0(v);
  function msgs() { return M.warn.length ? '<div class="msgs">' + M.warn.map((w) => `<div class="msg">${esc(w)}</div>`).join('') + '</div>' : ''; }

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
    let h = '<div class="h4">Tablier</div><div class="tw"><table class="t"><tbody>' + rows.map((r) => `<tr><td class="l" style="width:150px;color:var(--silver)">${r[0]}</td><td class="l">${r[1]}</td></tr>`).join('') + '</tbody></table></div>';
    const g = [['Poids propre de la structure', M.gStruct]];
    if (M.gEnt > 0) g.push(['Entretoises d’about (réparties)', M.gEnt]);
    M.sup.rows.forEach((r) => g.push([r[0], r[1]]));
    h += '<div class="h4">Charges permanentes <small>par mètre de tablier</small></div><div class="tw"><table class="t"><thead><tr><th>Désignation</th><th>kN/m</th></tr></thead><tbody>'
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
    h += '<div class="h4">Réactions par ligne d’appui <small>kN, toutes voies confondues</small></div><div class="tw"><table class="t"><thead><tr><th>Appui</th><th>Ligne</th><th>Portées</th><th>G</th><th>Q</th><th>Modèle</th><th>ELS</th><th>ELU</th></tr></thead><tbody>';
    M.lines.forEach((l) => {
      const id = M.supports[l.j].id, side = l.side === 'C' ? 'unique' : l.side === 'G' ? 'côté gauche' : 'côté droit';
      h += `<tr><td>${id}</td><td class="mute">${side}</td><td class="mute">${[l.Lg, l.Ld].filter((v) => v > 0).map((v) => fr(v, 2)).join(' + ')} m</td><td>${kN(l.G)}</td><td>${kN(l.Q)}</td><td class="mute">${esc(l.det.mod)}</td><td>${kN(l.els)}</td><td>${kN(l.elu)}</td></tr>`;
    });
    h += '</tbody></table></div>';
    h += '<div class="h4">Efforts en tête de fondation <small>kN</small></div><div class="tw"><table class="t"><thead><tr><th>Appui</th><th>G tablier</th><th>Q</th><th>ELS</th><th>ELU</th><th>Poids de l’appui</th><th>N (ELS car.)</th></tr></thead><tbody>';
    M.supports.forEach((s) => { h += `<tr><td>${s.id}</td><td>${kN(s.G)}</td><td>${kN(s.Q)}</td><td>${kN(s.els)}</td><td>${kN(s.elu)}</td><td>${kN(s.Gapp)}</td><td><b>${kN(s.N)}</b></td></tr>`; });
    h += '</tbody></table></div>';
    h += '<ul class="notes">' + M.notes.map((n) => `<li>${esc(n)}</li>`).join('') + '</ul>';
    return h;
  }

  function supCard(s) {
    const g = s.geo, f = s.fo, isC = s.kind === 'culee';
    const title = isC ? 'Culée ' + s.id + ' — ' + C.CULEES[g.type].nom.toLowerCase() : 'Pile ' + s.id + ' — ' + C.PILES[g.type].nom.toLowerCase();
    let h = `<div class="sup"><h5>${title}<span>H = ${fr(s.H, 2)} m</span></h5><ul>`;
    h += g.parts.map((p) => `<li><span>${esc(p.des)}</span><span>${fx(p.V, 1)} m³</span></li>`).join('');
    h += '</ul><ul>';
    if (f.mode === 'superficielle') {
      h += `<li><span>Semelle ${fr(f.B, 2)} × ${fr(f.L, 2)} × ${fr(f.e, 2)} m</span><span>${fx(f.V, 1)} m³</span></li>`;
      const ok = f.q / 1000 <= S.fond.sigma * 1.001;
      h += `<li><span>Contrainte moyenne (ELS, centrée)</span><span class="${ok ? 'ok' : 'ko'}">${fr(f.q / 1000, 3)} MPa ≤ ${fr(S.fond.sigma, 2)}</span></li>`;
    } else {
      h += `<li><span>${f.n} pieux Ø ${fr(f.D, 2)} m — ${f.nr} × ${f.m}, L = ${fr(f.Lp, 1)} m</span><span>${fx(f.mlPieux, 0)} ml</span></li>`;
      if (f.e > 0) h += `<li><span>Massif ${fr(f.Lx, 2)} × ${fr(f.Ly, 2)} × ${fr(f.e, 2)} m</span><span>${fx(f.V, 1)} m³</span></li>`;
      else h += '<li><span>Pieux encastrés directement dans le sommier</span><span></span></li>';
      h += `<li><span>Effort moyen par pieu (ELS)</span><span class="${f.Npieu <= f.Q * 1.001 ? 'ok' : 'ko'}">${fr(f.Npieu / 1000, 2)} MN ≤ ${fr(f.Q / 1000, 2)}</span></li>`;
    }
    h += '</ul><ul>';
    s.lines.forEach((l) => {
      const a = l.app;
      h += `<li><span>${s.lines.length > 1 ? (l.side === 'G' ? 'Ligne gauche' : 'Ligne droite') + ' : ' : ''}${l.nb} × ${esc(a.des)}</span><span>${a.sigma ? fr(a.sigma, 1) + ' MPa · ' : ''}ux ${fr(l.ux, 0)} mm</span></li>`;
    });
    return h + '</ul></div>';
  }

  function tAppuis() {
    let h = '<div class="grid2">' + M.supports.map(supCard).join('') + '</div>';
    h += '<div class="h4">Joints de dilatation</div><div class="tw"><table class="t"><thead><tr><th>Appui</th><th>Type</th><th>Souffle</th><th>Longueur</th></tr></thead><tbody>'
      + M.joints.map((j) => `<tr><td>${j.lab}</td><td class="l">${esc(j.des)}</td><td>${j.W} mm</td><td>${fr(M.W, 2)} m</td></tr>`).join('') + '</tbody></table></div>';
    h += '<p class="hint">Appareils d’appui : σ moyenne ≤ 15 MPa sous G + Q majoré pour l’excentrement ; épaisseur d’élastomère T ≥ 2 ux (distorsion ≤ 0,5). Souffle des joints : retrait, fluage et dilatation (±35 °C) depuis le point neutre. Fondations : effort centré, sans moment ; les culées remblayées sont majorées de 25 % pour la poussée des terres.</p>';
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
    h += `<p class="hint">Ratios : <b>${fr(k.beton / k.surf, 2)} m³</b> de béton et <b>${f0(k.acier / k.surf)} kg</b> d’aciers HA par m² de tablier ; tablier seul : épaisseur équivalente <b>${fr(k.epEq, 2)} m</b>. Coût <b>${f0(k.parM2)} ${esc(dv)}/m²</b> HT. Prix modifiables au bloc I.</p>`;
    return h;
  }

  function renderRes() {
    const f = { predim: tPredim, ddc: tDdc, appuis: tAppuis, metre: tMetre }[tab];
    $('#res').innerHTML = msgs() + f();
  }

  /* ───────── Événements ───────── */
  let tm = null;
  const cfg = $('#cfg');
  cfg.addEventListener('input', (ev) => {
    const el = ev.target;
    if (!el.dataset.k || el.dataset.sel || el.dataset.chk) return;
    let v = el.value;
    if (!el.dataset.txt) { v = v.replace(',', '.').trim(); v = v === '' ? 0 : parseFloat(v); if (!Number.isFinite(v)) return; }
    setPath(S, el.dataset.k, v);
    clearTimeout(tm);
    tm = setTimeout(() => recompute(false), 220);
  });
  cfg.addEventListener('change', (ev) => {
    const el = ev.target;
    if (!el.dataset.k) return;
    if (el.dataset.chk) setPath(S, el.dataset.k, el.checked);
    else if (el.dataset.sel) setPath(S, el.dataset.k, isNaN(+el.value) ? el.value : +el.value);
    else return;
    recompute(true);
  });
  cfg.addEventListener('focusout', (ev) => {
    const el = ev.target;
    if (!el.dataset || !el.dataset.k || el.dataset.txt || el.dataset.sel || el.dataset.chk) return;
    clearTimeout(tm);
    S = C.normalize(S);
    const v = getPath(S, el.dataset.k);
    if (el.dataset.k === 'tablier.h' || el.dataset.k === 'profil.largeurForcee') el.value = v ? show(v) : '';
    else el.value = show(v);
    recompute(false);
  });
  cfg.addEventListener('toggle', (ev) => {
    const d = ev.target; if (!d.dataset || !d.dataset.b) return;
    if (d.open) open.add(d.dataset.b); else open.delete(d.dataset.b);
  }, true);
  cfg.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-set],[data-act]');
    if (!b) return;
    if (b.dataset.act === 'addSpan') { const t = S.travees; t.push(t[t.length - 1] || 15); S.piles.hauteurs.push(S.piles.hauteurs[S.piles.hauteurs.length - 1] || 6); }
    else if (b.dataset.act === 'delSpan') { if (S.travees.length > 1) { S.travees.pop(); S.piles.hauteurs.pop(); } }
    else {
      const p = b.dataset.set, v = b.dataset.val;
      if (p === 'usage' && v !== S.usage) {
        const D = C.defaults(v);
        S.usage = v; S.equip.retenue = D.equip.retenue; S.culees.dalleTransition = D.culees.dalleTransition; S.equip.gargouilles = D.equip.gargouilles;
        if (C.typeStatus(S.tablier.type, S.travees, v).k === 'hors') S.tablier.type = D.tablier.type;
        if (S.projet.nom === C.defaults(v === 'rail' ? 'route' : 'rail').projet.nom) S.projet.nom = D.projet.nom;
      } else if (p === 'tablier.type') { S.tablier.type = v; S.tablier.continu = null; S.tablier.h = 0; }
      else setPath(S, p, v);
    }
    S = C.normalize(S);
    recompute(true);
  });
  $('#vSeg').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    view = b.dataset.v;
    $('#vSeg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    renderView();
  });
  $('#tabs').addEventListener('click', (ev) => {
    const b = ev.target.closest('.tab'); if (!b) return;
    tab = b.dataset.t;
    $('#tabs').querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === b));
    renderRes();
  });
  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(renderView, 150); });

  $('#bReset').addEventListener('click', () => {
    if (!confirm('Revenir à l’ouvrage par défaut ? La composition en cours sera remplacée.')) return;
    S = C.normalize(C.defaults(S.usage)); recompute(true);
  });

  /* ───────── Exports ───────── */
  const slug = () => (S.projet.nom || 'ouvrage').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'ouvrage';
  function download(name, data, type) {
    const blob = new Blob([data], { type }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  const today = () => new Date().toLocaleDateString('fr-FR');
  $('#bDxf').addEventListener('click', () => download('composer-' + slug() + '.dxf', C.buildDXF(M, { date: today() }), 'application/dxf'));
  $('#bSave').addEventListener('click', () => download('composer-' + slug() + '.json', JSON.stringify({ app: 'BridgeAI Studios — Bridge Composer', version: 1, projet: S }, null, 2), 'application/json'));
  $('#bOpen').addEventListener('click', () => $('#fOpen').click());
  $('#fOpen').addEventListener('change', (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try { const o = JSON.parse(r.result); S = C.normalize(o.projet || o); recompute(true); }
      catch (e) { alert('Fichier de projet illisible.'); }
      ev.target.value = '';
    };
    r.readAsText(file);
  });

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
  $('#bPdf').addEventListener('click', () => { buildPrint(); window.print(); });
  window.addEventListener('beforeprint', buildPrint);

  recompute(true);
})();
