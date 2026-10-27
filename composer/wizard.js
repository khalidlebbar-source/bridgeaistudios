/* Bridge Composer — assistant « Nouveau pont » (création pas à pas)
 * COMP.wizard(S0, onDone) : ouvre l'assistant ; onDone(S) reçoit la composition normalisée.
 * Aperçu en direct : élévation, chiffres clés, comparaison des tabliers. */
(function (root) {
  'use strict';
  const C = root.COMP;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fx = (v, d) => ((Math.abs(+v) < 0.5 * 10 ** -d) ? 0 : +v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const f0 = (v) => (Math.round(v) || 0).toLocaleString('fr-FR');
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* Modèles de départ — valeurs courantes de bureau d'études */
  const PRESETS = [
    { k: 'vipp', t: 'Pont-route à poutres VIPP', d: '4 travées 30-40-40-30 m, piles colonnes', usage: 'route', p: {} },
    { k: 'psida', t: 'Passage inférieur dalle PSI-DA', d: '3 travées 10-14-10 m, continu', usage: 'route',
      p: { tablier: { type: 'PSIDA', h: 0, continu: true }, travees: [10, 14, 10], piles: { type: 'voile', hauteurs: [5.5, 5.5] }, culees: { type: 'remblayee', hauteurs: [6, 6], dalleTransition: true } } },
    { k: 'psidp', t: 'Pont dalle précontrainte PSI-DP', d: '3 travées 18-25-18 m, continu', usage: 'route',
      p: { tablier: { type: 'PSIDP', h: 0, continu: true }, travees: [18, 25, 18], piles: { type: 'colonnes', hauteurs: [7, 7] } } },
    { k: 'mixte', t: 'Viaduc bipoutre mixte', d: '5 travées 45-60-60-60-45 m', usage: 'route',
      p: { tablier: { type: 'Bipoutre', h: 0, continu: true }, travees: [45, 60, 60, 60, 45], piles: { type: 'voile', hauteurs: [14, 18, 18, 14] }, culees: { type: 'enterree', hauteurs: [8, 8], dalleTransition: true }, fond: { piles: 'pieux', culees: 'pieux' } } },
    { k: 'prp', t: 'Pont-rail PRP', d: '1 travée 19,40 m, 2 voies, culées sur pieux', usage: 'rail', p: {} },
    { k: 'blank', t: 'Ouvrage vierge', d: '1 travée de 20 m à compléter', usage: 'route',
      p: { travees: [20], piles: { hauteurs: [] }, culees: { type: 'enterree', hauteurs: [6, 6] } } },
  ];

  const STEPS = [
    ['projet', 'Projet', 'Modèle de départ et identification'],
    ['profil', 'Trafic & profil', 'Usage, règlement, largeurs'],
    ['travees', 'Travées', 'Portées et biais'],
    ['tablier', 'Tablier', 'Type et continuité'],
    ['appuis', 'Appuis', 'Piles et culées'],
    ['fond', 'Fondations & matériaux', 'Sol, fondations, bétons'],
    ['recap', 'Récapitulatif', 'Vérifier et créer'],
  ];

  function presetState(pr, keepProjet) {
    const D = C.defaults(pr.usage), p = clone(pr.p);
    ['projet', 'profil', 'tablier', 'piles', 'culees', 'fond', 'equip'].forEach((k) => { if (p[k]) p[k] = Object.assign({}, D[k], p[k]); });
    const S = Object.assign(D, p);
    if (keepProjet) S.projet = Object.assign({}, S.projet, keepProjet);
    S.hyp = C.hypDefaults(S.usage, S.tablier.type);
    return C.normalize(S);
  }

  function wizard(S0, onDone) {
    let step = 0, preset = 'vipp', S = presetState(PRESETS[0]), M = null, gen = { L: 140, n: 4, r: 0.75 };
    S.projet = Object.assign({}, S.projet, { nom: S0 && S0.projet ? S0.projet.nom : S.projet.nom });
    const back = document.createElement('div');
    back.className = 'wz-back';
    back.innerHTML = `<div class="wz" role="dialog" aria-modal="true" aria-labelledby="wzT">
      <header><div><h2 id="wzT">Nouveau pont</h2><p>Assistant de création — chaque étape met à jour l’aperçu et les quantités</p></div><button class="wz-x" data-w="cancel" aria-label="Fermer">×</button></header>
      <div class="wz-body"><nav class="wz-steps"></nav><section class="wz-form"></section><aside class="wz-prev"></aside></div>
      <footer><span class="wz-msg"></span><button data-w="cancel">Annuler</button><button data-w="prev">‹ Précédent</button><button data-w="next" class="pri">Suivant ›</button></footer></div>`;
    document.body.appendChild(back);
    const $ = (s) => back.querySelector(s);

    function calc() {
      S = C.normalize(S);
      try { M = C.compute(S); } catch (e) { console.error(e); M = null; }
    }
    /* ── petits constructeurs de champs ── */
    const val = (k) => k.split('.').reduce((o, p) => (o == null ? o : o[p]), S);
    const num = (lab, k, u, o) => { o = o || {}; const v = o.v != null ? o.v : val(k); return `<label class="wf"><span>${lab}</span><span class="wi"><input type="text" inputmode="decimal" data-k="${k}" value="${esc(typeof v === 'number' ? String(v).replace('.', ',') : v)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}>${u ? `<em>${u}</em>` : ''}</span>${o.help ? `<small>${o.help}</small>` : ''}</label>`; };
    const txt = (lab, k, ph) => `<label class="wf"><span>${lab}</span><span class="wi"><input type="text" data-k="${k}" data-t="s" value="${esc(val(k))}" placeholder="${esc(ph || '')}"></span></label>`;
    const sel = (lab, k, opts) => `<label class="wf"><span>${lab}</span><span class="wi"><select data-k="${k}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(val(k)) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></span></label>`;
    const chk = (lab, k) => `<label class="wc"><input type="checkbox" data-k="${k}"${val(k) ? ' checked' : ''}> ${lab}</label>`;
    const cards = (k, opts, cur, cls) => `<div class="wcards ${cls || ''}">${opts.map((o) => `<button type="button" class="wcard${String(cur) === String(o.v) ? ' on' : ''}${o.dis ? ' dis' : ''}" data-set="${k}" data-v="${esc(o.v)}"${o.dis ? ' disabled' : ''}>${o.ic ? `<span class="wic">${o.ic}</span>` : ''}<b>${o.t}</b><small>${o.d || ''}</small>${o.badge || ''}</button>`).join('')}</div>`;
    const h3 = (t, s) => `<h3>${t}</h3>${s ? `<p class="wsub">${s}</p>` : ''}`;

    /* pictogrammes simples (SVG) */
    const pic = {
      route: '<svg viewBox="0 0 60 30"><path d="M4 22h52M10 22v6M50 22v6M2 18h56" /><rect x="14" y="10" width="14" height="7" rx="2"/><rect x="34" y="8" width="18" height="9" rx="1"/><circle cx="18" cy="18" r="1.8"/><circle cx="25" cy="18" r="1.8"/></svg>',
      rail: '<svg viewBox="0 0 60 30"><path d="M2 24h56M6 21h48M2 27h56"/><rect x="8" y="6" width="40" height="12" rx="2"/><path d="M12 10h8M24 10h8M36 10h8"/></svg>',
      voile: '<svg viewBox="0 0 40 40"><path d="M6 6h28v4H6zM12 10h16v22H12zM6 32h28v5H6z"/></svg>',
      colonnes: '<svg viewBox="0 0 40 40"><path d="M4 6h32v5H4zM9 11h5v21H9zM26 11h5v21h-5zM4 32h32v5H4z"/></svg>',
      marteau: '<svg viewBox="0 0 40 40"><path d="M3 6h34v3l-9 4H12l-9-4zM15 13h10v19H15zM8 32h24v5H8z"/></svg>',
      enterree: '<svg viewBox="0 0 40 40"><path d="M2 36L22 14h16M8 10h18v6H8zM10 16h4v8h-4zM20 16h4v8h-4z"/></svg>',
      remblayee: '<svg viewBox="0 0 40 40"><path d="M6 6h8v26H6zM14 8h24M2 32h20v5H2zM14 14l22 0"/></svg>',
      superficielle: '<svg viewBox="0 0 40 40"><path d="M2 18h36M15 6h10v20H15zM6 26h28v6H6z"/></svg>',
      pieux: '<svg viewBox="0 0 40 40"><path d="M2 14h36M15 4h10v14H15zM6 18h28v5H6zM10 23v15M20 23v15M30 23v15"/></svg>',
    };

    function formHTML() {
      const k = STEPS[step][0], rail = S.usage === 'rail', n = S.travees.length;
      if (k === 'projet') {
        return h3('Modèle de départ', 'Choisissez l’ouvrage type le plus proche : toutes les valeurs restent modifiables aux étapes suivantes.')
          + cards('preset', PRESETS.map((p) => ({ v: p.k, t: p.t, d: p.d })), preset, 'c3')
          + h3('Identification') + `<div class="wgrid">${txt('Nom de l’ouvrage', 'projet.nom', 'Pont-route sur oued')}${txt('Repère', 'projet.ouvrage', 'OA 1')}${txt('Localisation', 'projet.lieu', 'PK, commune…')}${txt('Maître d’ouvrage', 'projet.moa', '')}${txt('Référence dossier', 'projet.ref', '')}</div>`;
      }
      if (k === 'profil') {
        let h = h3('Usage') + cards('usage', [{ v: 'route', t: 'Pont-route', d: 'LM1 / système A-B', ic: pic.route }, { v: 'rail', t: 'Pont-rail', d: 'LM71 · SW/2 / UIC 71', ic: pic.rail }], S.usage, 'c2')
          + h3('Règlement de charges') + cards('reglement', [{ v: 'EC', t: 'Eurocodes', d: rail ? 'EN 1991-2 — LM71 × α, SW/2' : 'EN 1991-2 — LM1 (TS + UDL)' }, { v: 'F61', t: rail ? 'UIC 71' : 'Fascicule 61 titre II', d: rail ? 'Train UIC 71 × Φ' : 'A(l), Bc, Bt, Mc120' }], S.reglement, 'c2');
        h += h3('Profil en travers') + '<div class="wgrid">';
        if (rail) h += num('Nombre de voies', 'profil.nbVoiesFer', '') + num('Entraxe des voies', 'profil.entraxe', 'm') + num('Demi-largeur hors voie', 'profil.demiLarg', 'm', { help: 'axe voie extrême → bord libre' }) + (S.reglement === 'EC' ? num('Coefficient α', 'alpha', '', { help: '1,33 courant en France' }) : '');
        else h += num('Largeur roulable', 'profil.roulable', 'm') + num('Trottoir gauche', 'profil.trottoirG', 'm') + num('Trottoir droit', 'profil.trottoirD', 'm') + sel('Classe du pont', 'classe', [[1, '1re classe'], [2, '2e classe'], [3, '3e classe']]);
        h += '</div>' + (M ? `<p class="wnote">Largeur utile du tablier : <b>${fx(M.kpi.W, 2)} m</b></p>` : '');
        return h + h3('Équipements') + '<div class="wgrid">' + sel('Dispositif de retenue', 'equip.retenue', rail ? [['GC', 'Garde-corps'], ['BN4', 'BN4'], ['GBA', 'GBA']] : [['BN4', 'Barrière BN4'], ['GBA', 'GBA béton'], ['GC', 'Garde-corps seul']]) + num('Revêtement', 'equip.revetement', 'm') + '</div>'
          + `<div class="wchk">${chk('Corniches', 'equip.corniches')}${chk('Étanchéité', 'equip.etancheite')}${chk('Gargouilles', 'equip.gargouilles')}</div>`;
      }
      if (k === 'travees') {
        const L = S.travees.reduce((a, b) => a + b, 0);
        return h3('Portées', 'Saisissez les portées séparées par des espaces, ou générez une distribution équilibrée.')
          + `<label class="wf wide"><span>Portées (m)</span><span class="wi"><input type="text" data-k="travees" data-t="list" value="${esc(S.travees.map((v) => String(v).replace('.', ',')).join('  '))}"></span><small>${n} travée${n > 1 ? 's' : ''} — longueur totale ${fx(L, 2)} m</small></label>`
          + `<div class="wgen"><b>Générateur</b>${num('Longueur totale', 'gen.L', 'm', { v: gen.L })}${num('Nombre de travées', 'gen.n', '', { v: gen.n })}${num('Rapport rive / centrale', 'gen.r', '', { v: gen.r, help: '0,6 à 0,8 en continu ; 1 en isostatique' })}<button type="button" data-w="gen" class="pri">Appliquer</button></div>`
          + `<div class="wspans">${S.travees.map((v, i) => `<span style="flex:${v}"><b>T${i + 1}</b>${fx(v, 2)}</span>`).join('')}</div>`
          + h3('Géométrie') + '<div class="wgrid">' + num('Biais', 'biais', 'gr', { help: '100 gr = droit' }) + '</div>';
      }
      if (k === 'tablier') {
        const rows = C.TYPE_KEYS.map((t) => {
          const T = C.TYPES[t], st = C.typeStatus(t, S.travees, S.usage);
          let h = null, cost = null;
          try { const Sx = C.normalize(Object.assign(clone(S), { tablier: Object.assign({}, S.tablier, { type: t, h: 0, continu: null }) })); Sx.hyp = C.hypDefaults(Sx.usage, t); const Mx = C.compute(Sx); h = Mx.kpi.h; cost = Mx.kpi.parM2; } catch (e) { /* ignore */ }
          return { t, T, st, h, cost };
        });
        const best = Math.min.apply(null, rows.filter((r) => r.st.k !== 'hors' && r.cost).map((r) => r.cost));
        const T = C.TYPES[S.tablier.type];
        return h3('Type de tablier', 'Domaine d’emploi SETRA, hauteur prédimensionnée et coût indicatif au m² pour vos portées.')
          + cards('tablier.type', rows.map((r) => ({
            v: r.t, t: r.T.nom, d: r.T.titre,
            badge: `<span class="wb ${r.st.k}">${r.st.k === 'ok' ? 'Domaine ' + r.st.txt : r.st.txt}</span><span class="wk">h ${r.h ? fx(r.h, 2) : '–'} m · ${r.cost ? f0(r.cost) : '–'} ${esc(S.devise)}/m²${r.cost && Math.abs(r.cost - best) < 1 ? ' <i>le plus économique</i>' : ''}</span>`,
          })), S.tablier.type, 'c2 tall')
          + h3('Continuité') + `<div class="wchk">${T.cont && T.iso ? chk('Tablier continu sur appuis', 'tablier.continu') : `<span class="wnote">${T.iso ? 'Travées isostatiques (type non continu)' : 'Tablier continu (imposé par le type)'}</span>`}${T.famille === 'poutres' ? chk('Dalle de continuité (hourdis continu)', 'tablier.dalleContinuite') : ''}</div>`
          + '<div class="wgrid">' + num('Hauteur imposée', 'tablier.h', 'm', { v: S.tablier.h || '', ph: M ? 'auto ' + fx(M.kpi.h, 2) : 'auto', help: 'vide = prédimensionnement' }) + '</div>';
      }
      if (k === 'appuis') {
        const hp = S.piles.hauteurs;
        return (n > 1 ? h3('Piles', n - 1 + ' pile' + (n > 2 ? 's' : '')) + cards('piles.type', Object.keys(C.PILES).map((v) => ({ v, t: C.PILES[v].nom, d: C.PILES[v].desc, ic: pic[v] })), S.piles.type, 'c3')
          + `<label class="wf wide"><span>Hauteurs des piles (m)</span><span class="wi"><input type="text" data-k="piles.hauteurs" data-t="list" value="${esc(hp.map((v) => String(v).replace('.', ',')).join('  '))}"></span><small>de P1 à P${n - 1}, fût sous chevêtre jusqu’au dessus de semelle</small></label>` : h3('Piles', 'Ouvrage à une travée : pas de pile.'))
          + h3('Culées') + cards('culees.type', Object.keys(C.CULEES).map((v) => ({ v, t: C.CULEES[v].nom, d: C.CULEES[v].desc, ic: pic[v] })), S.culees.type, 'c2')
          + '<div class="wgrid">' + num('Hauteur culée C0', 'culees.hauteurs.0', 'm') + num('Hauteur culée C' + n, 'culees.hauteurs.1', 'm') + '</div>'
          + `<div class="wchk">${chk('Dalles de transition', 'culees.dalleTransition')}</div>`;
      }
      if (k === 'fond') {
        const fopt = [{ v: 'superficielle', t: 'Superficielles', d: 'Semelles sur sol porteur', ic: pic.superficielle }, { v: 'pieux', t: 'Profondes', d: 'Pieux forés', ic: pic.pieux }];
        const B = C.CLASSES_BETON.map((c) => [c, c]);
        return (n > 1 ? h3('Fondations des piles') + cards('fond.piles', fopt, S.fond.piles, 'c2') : '')
          + h3('Fondations des culées') + cards('fond.culees', fopt, S.fond.culees, 'c2')
          + h3('Sol') + '<div class="wgrid">' + num('σ admissible (ELS)', 'fond.sigma', 'MPa')
          + ((S.fond.piles === 'pieux' || S.fond.culees === 'pieux') ? sel('Diamètre des pieux', 'fond.diam', [0.6, 0.8, 1.0, 1.2, 1.5].map((d) => [d, 'Ø ' + fx(d, 2) + ' m'])) + num('Longueur des pieux', 'fond.long', 'm') + num('Charge admissible / pieu', 'fond.qadm', 'MN') : '') + '</div>'
          + h3('Matériaux', 'Les autres hypothèses (poids volumiques, ΔT, séisme, prix) sont dans l’onglet Hypothèses.')
          + '<div class="wgrid">' + sel('Béton du tablier', 'hyp.betonTab', B) + sel('Béton des appuis', 'hyp.betonApp', B) + sel('Béton des fondations', 'hyp.betonFond', B) + sel('Acier de charpente', 'hyp.charpente', [['S355', 'S355'], ['S420', 'S420'], ['S460', 'S460']]) + '</div>';
      }
      /* récapitulatif */
      if (!M) return h3('Récapitulatif') + '<p class="wnote">Calcul impossible : vérifiez les saisies.</p>';
      const T = M.T, kp = M.kpi;
      const li = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`;
      return h3('Récapitulatif', 'Vérifiez la composition, puis créez l’ouvrage. Tout reste modifiable dans l’arborescence.')
        + `<table class="wrec">${li('Ouvrage', esc(S.projet.nom) + (S.projet.ouvrage ? ' (' + esc(S.projet.ouvrage) + ')' : ''))}${li('Usage / règlement', (rail ? 'Pont-rail' : 'Pont-route') + ' — ' + (S.reglement === 'EC' ? 'Eurocodes EN 1991-2' : rail ? 'UIC 71' : 'Fascicule 61'))}`
        + li('Travées', S.travees.length + ' × [' + S.travees.map((v) => fx(v, 2)).join(' ; ') + '] m — L = ' + fx(kp.Ltot, 2) + ' m' + (S.biais < 100 ? ' — biais ' + S.biais + ' gr' : ''))
        + li('Tablier', T.nom + ' — ' + T.titre.toLowerCase() + ', h = ' + fx(kp.h, 2) + ' m, ' + (S.tablier.continu && S.travees.length > 1 ? 'continu' : 'isostatique') + ', W = ' + fx(kp.W, 2) + ' m')
        + (S.travees.length > 1 ? li('Piles', C.PILES[S.piles.type].nom + ' — H ' + S.piles.hauteurs.map((v) => fx(v, 2)).join(' / ') + ' m — ' + (S.fond.piles === 'pieux' ? 'sur pieux' : 'semelles')) : '')
        + li('Culées', C.CULEES[S.culees.type].nom + ' — H ' + S.culees.hauteurs.map((v) => fx(v, 2)).join(' / ') + ' m — ' + (S.fond.culees === 'pieux' ? 'sur pieux Ø' + fx(S.fond.diam, 2) : 'semelles, σ = ' + fx(S.fond.sigma, 2) + ' MPa'))
        + li('Bétons', S.hyp.betonTab + ' (tablier) · ' + S.hyp.betonApp + ' (appuis)')
        + li('Quantités', f0(kp.beton) + ' m³ de béton · ' + fx(kp.acier / 1000, 1) + ' t d’aciers' + (kp.metal ? ' · ' + fx(kp.metal / 1000, 1) + ' t de charpente' : ''))
        + li('Estimation HT', '<b>' + fx(kp.total / 1e6, 2) + ' M' + esc(S.devise) + '</b> — ' + f0(kp.parM2) + ' ' + esc(S.devise) + '/m²')
        + '</table>'
        + (M.warn.length ? `<div class="wwarn"><b>${M.warn.length} point${M.warn.length > 1 ? 's' : ''} d’attention</b><ul>${M.warn.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>` : '<p class="wok">✓ Aucune alerte de prédimensionnement.</p>');
    }

    function prevHTML() {
      if (!M) return '';
      let svg = '';
      try {
        const k = STEPS[step][0];
        const sc = (k === 'profil' || k === 'tablier') ? C.secScene(M) : C.elevScene(M);
        svg = C.toSVG(sc, { width: 300, id: 'wz', kp: 2.4, pad: 6, dims: false });
      } catch (e) { console.error(e); }
      const kp = M.kpi;
      return `<div class="wpv">${svg}</div><dl class="wkp"><div><dt>Longueur</dt><dd>${fx(kp.Ltot, 2)} m</dd></div><div><dt>Largeur</dt><dd>${fx(kp.W, 2)} m</dd></div><div><dt>Hauteur tablier</dt><dd>${fx(kp.h, 2)} m</dd></div><div><dt>Béton</dt><dd>${f0(kp.beton)} m³</dd></div><div><dt>Aciers</dt><dd>${fx(kp.acier / 1000, 1)} t</dd></div><div><dt>Coût HT</dt><dd>${fx(kp.total / 1e6, 2)} M${esc(S.devise)}</dd></div><div class="w2"><dt>Ratio</dt><dd>${f0(kp.parM2)} ${esc(S.devise)}/m² de tablier</dd></div></dl>`
        + (M.warn.length ? `<p class="wpw">⚠ ${M.warn.length} alerte${M.warn.length > 1 ? 's' : ''}</p>` : '');
    }

    function render(keep) {
      calc();
      $('.wz-steps').innerHTML = STEPS.map(([, t, d], i) => `<button type="button" data-step="${i}" class="${i === step ? 'on' : ''}${i < step ? ' done' : ''}"><i>${i < step ? '✓' : i + 1}</i><span><b>${t}</b><small>${d}</small></span></button>`).join('');
      if (!keep) { $('.wz-form').innerHTML = formHTML(); $('.wz-form').scrollTop = 0; }
      $('.wz-prev').innerHTML = prevHTML();
      $('[data-w=prev]').disabled = step === 0;
      const last = step === STEPS.length - 1;
      $('[data-w=next]').textContent = last ? 'Créer le pont' : 'Suivant ›';
      $('.wz-msg').textContent = 'Étape ' + (step + 1) + ' / ' + STEPS.length;
    }
    /* recalcul + rafraîchissement du formulaire en conservant le champ actif */
    function refresh() {
      const a = document.activeElement, k = a && a.dataset ? a.dataset.k : null, pos = a && a.selectionStart;
      render();
      if (k) { const el = $(`.wz-form [data-k="${k}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* select */ } } }
    }
    const parseNum = (v) => { const x = parseFloat(String(v).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(x) ? x : null; };
    function setK(k, v, el) {
      if (k.startsWith('gen.')) { const x = parseNum(v); if (x != null) gen[k.slice(4)] = x; return false; }
      if (el && el.dataset.t === 'list') v = String(v).replace(/,/g, '.').split(/[;\s]+/).map(parseFloat).filter(Number.isFinite);
      else if (el && el.type === 'checkbox') v = el.checked;
      else if (el && el.dataset.t !== 's' && el.tagName === 'INPUT') { if (k === 'tablier.h' && String(v).trim() === '') v = 0; else { v = parseNum(v); if (v == null) return false; } }
      else if (el && el.tagName === 'SELECT' && /^(classe|fond\.diam)$/.test(k)) v = +v;
      const ps = k.split('.'); let o = S;
      for (let i = 0; i < ps.length - 1; i++) o = o[ps[i]];
      o[ps[ps.length - 1]] = v;
      if (k === 'travees') {
        const np = S.travees.length - 1, h = S.piles.hauteurs;
        while (h.length < np) h.push(h.length ? h[h.length - 1] : S.culees.hauteurs[0] + 1);
        h.length = Math.max(0, np);
      }
      return true;
    }
    function setCard(k, v) {
      if (k === 'preset') {
        const pr = PRESETS.find((p) => p.k === v), keep = { nom: S.projet.nom, ouvrage: S.projet.ouvrage, lieu: S.projet.lieu, moa: S.projet.moa, ref: S.projet.ref };
        const dflt = [C.defaults('route').projet.nom, C.defaults('rail').projet.nom];
        if (dflt.includes(keep.nom)) delete keep.nom;
        preset = v; S = presetState(pr, keep);
        gen = { L: S.travees.reduce((a, b) => a + b, 0), n: S.travees.length, r: S.travees.length > 2 ? Math.round(S.travees[0] / S.travees[1] * 100) / 100 : 1 };
        return;
      }
      if (k === 'usage') {
        if (v === S.usage) return;
        const D = C.defaults(v);
        S.usage = v; S.equip.retenue = D.equip.retenue; S.culees.dalleTransition = D.culees.dalleTransition; S.equip.gargouilles = D.equip.gargouilles;
        if (C.typeStatus(S.tablier.type, S.travees, v).k === 'hors') { S.tablier.type = D.tablier.type; S.tablier.continu = null; S.tablier.h = 0; }
        if (S.projet.nom === C.defaults(v === 'rail' ? 'route' : 'rail').projet.nom) S.projet.nom = D.projet.nom;
        S.hyp = Object.assign(S.hyp, { betonTab: C.hypDefaults(v, S.tablier.type).betonTab });
        return;
      }
      if (k === 'tablier.type') {
        S.tablier.type = v; S.tablier.continu = null; S.tablier.h = 0;
        S.hyp.betonTab = C.hypDefaults(S.usage, v).betonTab;
        return;
      }
      setK(k, v);
    }
    function generate() {
      const n = Math.max(1, Math.min(12, Math.round(gen.n))), L = Math.max(3, gen.L), r = Math.max(0.3, Math.min(1.5, gen.r || 1));
      let t;
      if (n === 1) t = [L];
      else if (n === 2) t = [L / 2, L / 2];
      else { const c = L / (n - 2 + 2 * r); t = [r * c].concat(Array(n - 2).fill(c), [r * c]); }
      t = t.map((v) => Math.round(v * 20) / 20);
      t[n > 2 ? 1 : 0] += Math.round((L - t.reduce((a, b) => a + b, 0)) * 100) / 100;
      setK('travees', t.join(' '), { dataset: { t: 'list' } });
    }
    function close() { back.remove(); document.removeEventListener('keydown', onKey, true); if (prevFocus && prevFocus.focus) prevFocus.focus(); }
    function finish() { calc(); close(); onDone(S); }
    function go(i) { step = Math.max(0, Math.min(STEPS.length - 1, i)); render(); const f = $('.wz-form input, .wz-form select, .wz-form .wcard'); if (f) f.focus(); }

    back.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-w],[data-step],[data-set]');
      if (ev.target === back) return; /* pas de fermeture accidentelle */
      if (!b) return;
      if (b.dataset.step) return go(+b.dataset.step);
      if (b.dataset.set) { setCard(b.dataset.set, b.dataset.v); return render(); }
      const w = b.dataset.w;
      if (w === 'cancel') close();
      else if (w === 'prev') go(step - 1);
      else if (w === 'next') step === STEPS.length - 1 ? finish() : go(step + 1);
      else if (w === 'gen') { generate(); render(); }
    });
    back.addEventListener('input', (ev) => {
      const el = ev.target; if (!el.dataset.k) return;
      if (el.type === 'checkbox' || el.tagName === 'SELECT') return;
      if (setK(el.dataset.k, el.value, el)) { calc(); $('.wz-prev').innerHTML = prevHTML(); }
    });
    back.addEventListener('change', (ev) => {
      const el = ev.target; if (!el.dataset.k) return;
      const k = el.dataset.k;
      if (el.tagName === 'SELECT' || el.type === 'checkbox') { setK(k, el.type === 'checkbox' ? el.checked : el.value, el); return refresh(); }
      if (k.startsWith('gen.')) return;
      /* champ texte : on ne reconstruit pas le formulaire (le clic suivant doit aboutir) */
      calc(); $('.wz-prev').innerHTML = prevHTML();
      if (k === 'travees' || k === 'piles.hauteurs') {
        const sm = el.closest('.wf').querySelector('small'), L = S.travees.reduce((a, b) => a + b, 0), n = S.travees.length;
        if (k === 'travees') {
          sm.textContent = n + ' travée' + (n > 1 ? 's' : '') + ' — longueur totale ' + fx(L, 2) + ' m';
          const sp = $('.wspans'); if (sp) sp.innerHTML = S.travees.map((v, i) => `<span style="flex:${v}"><b>T${i + 1}</b>${fx(v, 2)}</span>`).join('');
        }
        el.value = (k === 'travees' ? S.travees : S.piles.hauteurs).map((v) => String(v).replace('.', ',')).join('  ');
      }
    });
    const prevFocus = document.activeElement;
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(); }
      else if (ev.key === 'Enter' && ev.target.tagName === 'INPUT' && ev.target.type === 'text') {
        ev.preventDefault();
        if (ev.target.dataset.k && ev.target.dataset.k.startsWith('gen.')) { generate(); render(); } else ev.target.blur();
      }
      ev.stopPropagation();
    }
    document.addEventListener('keydown', onKey, true);
    render();
    const f = $('.wz-form .wcard.on'); if (f) f.focus();
    return { close, go, get state() { return S; } };
  }

  root.COMP = Object.assign(root.COMP || {}, { wizard, WZ_PRESETS: PRESETS });
})(typeof self !== 'undefined' ? self : this);
