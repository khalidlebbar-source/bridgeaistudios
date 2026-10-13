/* BridgeAI Studios — Plans de coffrage & ferraillage : interface (espace de travail). */
(function () {
  'use strict';
  const F = window.FERR;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fr = (v, n) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: n, maximumFractionDigits: n });
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ───── Catalogue ───── */
  const sv = (d) => `<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const CATALOG = [
    { id: 'murT', name: 'Mur de soutènement', desc: 'Cantilever paramétré comme la feuille de stabilité : fruits, talus amont, TN aval, bêche et semelle en biseau en option.',
      svg: sv('<path d="M6 66H114" stroke-width="1" opacity=".5"/><path d="M22 60H100V50H62L58 10H50V50H22Z"/><path d="M58 10L114 0" stroke-width="1" opacity=".6"/><path d="M6 42H50" stroke-width="1" opacity=".6"/>') },
    { id: 'dalot', name: 'Dalot cadre fermé', desc: 'Cadre 1 cellule avec goussets : U extérieurs, nappes intérieures, piédroits, goussets et filants.',
      svg: sv('<path d="M6 12H114" stroke-width="1" opacity=".5"/><path d="M28 16H92V64H28Z"/><path d="M42 26H78L82 30V50L78 54H42L38 50V30Z"/>') },
    { name: 'Culée', svg: sv('<path d="M6 66H114" stroke-width="1" opacity=".5"/><path d="M24 60H96V52H62V22H70V12H54V52H24Z"/>') },
    { name: 'Pile semelle + colonnes', svg: sv('<path d="M6 66H114" stroke-width="1" opacity=".5"/><path d="M22 60H98V50H22Z"/><path d="M38 50V18M48 50V18M72 50V18M82 50V18"/><path d="M26 18H94V10H26Z"/>') },
    { name: 'Chevêtre', svg: sv('<path d="M14 30H106V18H14Z"/><path d="M34 30V60M46 30V60M74 30V60M86 30V60" opacity=".6"/>') },
    { name: 'Dalle de transition', svg: sv('<path d="M6 20H40" stroke-width="1" opacity=".5"/><path d="M10 22H24V60H10Z"/><path d="M24 26L108 40V46L24 32Z"/>') },
    { name: 'Mur en retour', svg: sv('<path d="M6 66H114" stroke-width="1" opacity=".5"/><path d="M14 60H106V54H96L40 14H22V54H14Z"/>') },
    { name: 'Massif sur pieux', svg: sv('<path d="M20 30H100V12H20Z"/><path d="M32 30V66M38 30V66M57 30V66M63 30V66M82 30V66M88 30V66" opacity=".7"/>') },
    { name: 'Tablier PSIDN', svg: sv('<path d="M8 22H112V30H8Z"/><path d="M22 30V44H36V30M53 30V44H67V30M84 30V44H98V30"/>') },
    { name: 'Poutres VIPP', svg: sv('<path d="M30 12H90V18H66V50L80 54V60H40V54L54 50V18H30Z"/>') },
    { name: 'Hourdis', svg: sv('<path d="M8 24H112V32H8Z"/><path d="M18 32V56M30 32V56M54 32V56M66 32V56M90 32V56M102 32V56" opacity=".6"/>') },
    { name: 'Entretoises', svg: sv('<path d="M18 14H38V60H18ZM82 14H102V60H82Z" opacity=".6"/><path d="M38 22H82V50H38Z"/>') },
  ];
  const DESIGNATION = { murT: 'Mur de soutènement — plot type', dalot: 'Dalot cadre fermé' };

  /* ───── État ───── */
  const S = {
    struct: null, geom: {}, valid: null, validKey: '', params: Object.assign({}, F.DEFAULT_PARAMS),
    designation: '', overrides: {}, res: null, step: 1, maxStep: 1, view: 'coupe', sel: null,
  };

  /* ───── Navigation entre étapes ───── */
  function goStep(n) {
    if (n > S.maxStep) return;
    S.step = n;
    $$('.step').forEach((el, i) => el.classList.toggle('show', i + 1 === n));
    $$('#steps .step-btn').forEach((b) => {
      const k = +b.dataset.go;
      b.disabled = k > S.maxStep;
      b.classList.toggle('active', k === n);
      b.classList.toggle('done', k < n);
    });
    if (n === 2) renderCoffrage();
    if (n === 3) renderFerraillage();
    if (n === 4) renderExport();
    if (window.scrollY > 0 && window.innerWidth < 1000) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b && !b.disabled) goStep(+b.dataset.go);
  });

  /* ───── Étape 1 ───── */
  function renderCatalog() {
    $('#catalog').innerHTML = CATALOG.map((c) => c.id
      ? `<button class="tile on" data-struct="${c.id}"><span class="schema">${c.svg}</span><span class="tx"><span class="status on">Disponible</span><span class="name">${c.name}</span><span class="desc">${c.desc}</span><span class="go">Dessiner →</span></span></button>`
      : `<div class="tile dev" aria-disabled="true"><span class="status">Bientôt</span><span class="schema">${c.svg}</span><span class="name">${c.name}</span></div>`).join('');
    $$('#catalog [data-struct]').forEach((b) => b.addEventListener('click', () => selectStruct(b.dataset.struct)));
  }

  function selectStruct(id) {
    if (S.struct !== id) {
      S.struct = id; S.geom = F.defaults(id); S.overrides = {}; S.valid = null; S.validKey = '';
      S.designation = DESIGNATION[id]; S.view = 'coupe';
    }
    S.maxStep = Math.max(S.maxStep, 2);
    $('#st1').textContent = F.STRUCTURES[id].label;
    $('#c-name').textContent = F.STRUCTURES[id].label;
    $('#v2btn').textContent = id === 'dalot' ? 'Vue en plan' : 'Élévation';
    renderForm();
    goStep(2);
  }

  /* ───── Étape 2 : saisie ───── */
  const visible = (f, g) => (!f.when || g[f.when]) && (!f.whenVal || g[f.whenVal[0]] === f.whenVal[1]);
  const openGroups = { geo: true, ter: true, opt: false, dim: true };

  function fieldHTML(f) {
    const v = S.geom[f.k];
    if (f.type === 'check') return `<label class="chk"><input type="checkbox" data-k="${f.k}" ${v ? 'checked' : ''}> ${f.label}</label>`;
    const lab = `<label for="f-${f.k}" title="${esc(f.label + (f.hint ? ' — ' + f.hint : ''))}">${f.label}${f.hint ? ` <small>${f.hint}</small>` : ''}</label>`;
    if (f.type === 'select') return `<div class="f">${lab}<div class="num"><select id="f-${f.k}" data-k="${f.k}">${f.opts.map((o) => `<option value="${o[0]}"${o[0] === v ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></div></div>`;
    return `<div class="f">${lab}<div class="num"><input id="f-${f.k}" type="number" inputmode="decimal" step="${f.step || 0.005}" min="${f.min}" max="${f.max}" value="${v}" data-k="${f.k}"><span>${f.unit || 'm'}</span></div></div>`;
  }

  function renderForm() {
    const St = F.STRUCTURES[S.struct];
    const groups = St.groups || [['dim', 'Dimensions']];
    $('#fields').innerHTML = groups.map(([gk, gl]) => {
      const fs = St.fields.filter((f) => (f.g || 'dim') === gk && visible(f, S.geom));
      return `<details class="grp" data-g="${gk}"${openGroups[gk] ? ' open' : ''}><summary>${gl}</summary><div class="fg">${fs.map(fieldHTML).join('')}</div></details>`;
    }).join('');
    const P = St.presets;
    $('#presets').innerHTML = P ? `<div class="seg" role="group" aria-label="Exemples">${Object.entries(P).map(([k, p]) => `<button type="button" data-preset="${k}" title="${esc(p.label)}">${k}</button>`).join('')}<button type="button" data-preset="" title="Valeurs par défaut">↺</button></div>`
      : `<button type="button" class="btn ghost small" data-preset="">Valeurs par défaut</button>`;
  }

  function readForm() {
    const St = F.STRUCTURES[S.struct];
    $$('#fields [data-k]').forEach((i) => {
      const f = St.fields.find((x) => x.k === i.dataset.k);
      if (f.type === 'check') S.geom[f.k] = i.checked;
      else if (f.type === 'select') S.geom[f.k] = i.value;
      else { const v = parseFloat(String(i.value).replace(',', '.')); S.geom[f.k] = isNaN(v) ? NaN : v; }
    });
  }

  const boxOf = (el) => [Math.max(240, el.clientWidth - 16), Math.max(200, el.clientHeight - 16)];

  function renderCoffrage() {
    if (!S.struct) return;
    const St = F.STRUCTURES[S.struct];
    const errs = St.validate(S.geom);
    $('#coffMsg').innerHTML = errs.map(esc).join('<br>');
    $('#btnValider').disabled = errs.length > 0;
    const g = St.derive(S.geom);
    $('#derived').innerHTML = errs.length ? '<span>Corrigez la saisie pour voir les grandeurs déduites.</span>' : (S.struct === 'murT'
      ? `<span>Hv = H − hs <b>${g.Hv.toFixed(2)} m</b></span><span>eb <b>${g.eb.toFixed(4)} m</b></span><span>Talon <b>${g.talon.toFixed(4)} m</b></span><span>Hauteur de poussée <b>${g.Hp.toFixed(4)} m</b></span><span>q <b>${fr(g.q, 2)} t/m²</b></span><span>Béton <b>${fr(volume(g), 2)} m³</b> / ${fr(g.L, 2)} m</span>`
      : `<span>Largeur ext. <b>${g.Bext.toFixed(2)} m</b></span><span>Hauteur ext. <b>${g.Hext.toFixed(2)} m</b></span><span>Béton <b>${fr(volume(g), 2)} m³</b> / ${fr(g.L, 2)} m</span>`);
    $$('#viewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === S.view));
    $('#v-title').textContent = S.view === 'coupe' ? 'Coupe transversale — cotes en m' : (S.struct === 'dalot' ? 'Vue en plan' : 'Élévation du plot');
    if (errs.length) { $('#v-coupe').innerHTML = `<div class="msg" style="max-width:440px;font-size:13.5px"><b style="font-weight:500">Saisie incohérente</b><br>${errs.map(esc).join('<br>')}</div>`; return; }
    const el = $('#v-coupe'), [W, H] = boxOf(el);
    el.innerHTML = S.view === 'coupe'
      ? F.fitRender((u) => F.coffrageScene(S.struct, g, u), W, H, { label: 'Coupe transversale de coffrage cotée' })
      : F.fitRender((u) => F.secondScene(S.struct, g, u), W, Math.min(H, W * 0.45), { label: 'Seconde vue' });
  }

  function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); }
  function volume(g) {
    const o = F.outline(S.struct, g);
    return (polyArea(o.outer) - o.holes.reduce((s, h) => s + polyArea(h), 0)) * g.L;
  }

  $('#fields').addEventListener('input', (e) => {
    readForm();
    if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') { keepOpen(); renderForm(); }
    renderCoffrage();
  });
  $('#fields').addEventListener('toggle', (e) => { if (e.target.dataset.g) openGroups[e.target.dataset.g] = e.target.open; }, true);
  function keepOpen() { $$('#fields details').forEach((d) => { openGroups[d.dataset.g] = d.open; }); }
  $('#presets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]'); if (!b) return;
    S.geom = b.dataset.preset ? F.preset(S.struct, b.dataset.preset) : F.defaults(S.struct);
    S.overrides = {}; S.sel = null; // nouvel exemple : on repart de la proposition
    keepOpen(); renderForm(); renderCoffrage();
  });
  $('#viewSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { S.view = b.dataset.v; renderCoffrage(); } });
  $('#btnValider').addEventListener('click', () => {
    readForm();
    if (F.STRUCTURES[S.struct].validate(S.geom).length) return;
    const key = JSON.stringify(S.geom);
    if (key !== S.validKey) Object.values(S.overrides).forEach((o) => { delete o.segs; }); // la forme dépend de la géométrie
    S.valid = Object.assign({}, S.geom); S.validKey = key;
    const g = S.geom;
    $('#st2').textContent = S.struct === 'murT' ? `H ${g.H} · B ${g.B} · L ${g.L} m` : `${g.O} × ${g.Hi} · L ${g.L} m`;
    S.maxStep = 4;
    goStep(3);
  });

  /* ───── Étape 3 ───── */
  function compute() { S.res = F.compute(S.struct, S.valid, S.params, S.overrides); return S.res; }

  const PFIELDS = [
    { k: 'designation', label: 'Désignation de l’ouvrage', type: 'text' },
    { k: 'norme', label: 'Règlement', type: 'select', opts: [['EC2', 'Eurocode 2'], ['BAEL', 'BAEL 91']] },
    { k: 'blocs', label: 'Éléments identiques', unit: 'u', step: 1, min: 1 },
    { k: 'maintien', label: 'Maintien des nappes', type: 'select', opts: [['epingle', 'Épingles (3001)'], ['etrier', 'Étriers (boucle fermée)']] },
    { k: 'cTerre', label: 'Enrobage terre / fond.', unit: 'cm', scale: 100, step: 0.5, min: 1 },
    { k: 'cAutre', label: 'Enrobage autres', unit: 'cm', scale: 100, step: 0.5, min: 1 },
    { k: 'lmax', label: 'Longueur maxi barres', unit: 'm', step: 0.5, min: 3 },
    { k: 'recouv', label: 'Recouvrement', unit: 'Ø', step: 5, min: 20 },
  ];

  function renderParams() {
    $('#pfields').innerHTML = PFIELDS.map((f) => {
      const v = f.k === 'designation' ? S.designation : S.params[f.k];
      if (f.type === 'text') return `<div class="f wide"><label for="p-${f.k}">${f.label}</label><div class="num"><input id="p-${f.k}" type="text" value="${esc(v)}" data-p="${f.k}" style="padding-right:9px"></div></div>`;
      if (f.type === 'select') return `<div class="f"><label for="p-${f.k}">${f.label}</label><div class="num"><select id="p-${f.k}" data-p="${f.k}">${f.opts.map((o) => `<option value="${o[0]}"${o[0] === v ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></div></div>`;
      return `<div class="f"><label for="p-${f.k}">${f.label}</label><div class="num"><input id="p-${f.k}" type="number" step="${f.step}" min="${f.min}" value="${+(v * (f.scale || 1)).toFixed(2)}" data-p="${f.k}"><span>${f.unit}</span></div></div>`;
    }).join('');
    renderHyp();
  }

  function hypHTML() {
    const p = S.params, ec2 = p.norme === 'EC2';
    return `<b>Hypothèses retenues</b> (simplifiées, à vérifier)
      <ul>
        <li>Mandrins : ${ec2 ? 'EC2 §8.3 — Ø ≤ 16 : 4Ø ; Ø > 16 : 7Ø' : 'BAEL — 5Ø pour les HA'}.</li>
        <li>Crosses : retour droit ${ec2 ? '10Ø ≥ 70 mm (90°, 135°) ; 5Ø ≥ 50 mm (180°) — EC2 fig. 8.5' : '10Ø quel que soit l’angle'}.</li>
        <li>Longueur développée = Σ cotes hors-tout − déductions de pliage 2(r+Ø)tan(θ/2) − θ(r+Ø/2) + crosses, arrondie à 5 mm.</li>
        <li>Nombre = ⌊longueur de répartition / espacement⌋ + 1 ; épingles et écarteurs : surface × densité.</li>
        <li>Au-delà de ${p.lmax} m : découpe en barres indicées avec recouvrement ${p.recouv}Ø.</li>
        <li>Mur : H &lt; 3 m → HA12 (type M5) ; H ≥ 3 m → voile terres HA14 e15 + renfort de pied HA20 e15 sur ≈ 0,42·Hv, face avant HA12 e15, semelle sup. HA20 e15, inf. HA14 e15, maintien HA10 4/m² (principe M4).</li>
        <li>Maintien des nappes : ${p.maintien === 'etrier' ? 'étriers' : 'épingles'} par défaut (réglable barre par barre dans « Ajuster la barre », ce choix l’emporte). Épingle 3001 = barre droite à deux crosses (135° par défaut) ; étrier = boucle fermée étroite qui ceinture un filant de chaque nappe, extrémités en demi-cercle au mandrin, fermée par deux crosses 135°. Pas de chaises d’écartement dans la proposition.</li>
        <li>Diamètres proposés par règles forfaitaires : le ferraillage doit être justifié par une note de calcul.</li>
      </ul>`;
  }
  function renderHyp() { $('#hyp').innerHTML = hypHTML(); }

  $('#pfields').addEventListener('change', (e) => {
    const t = e.target, k = t.dataset.p; if (!k) return;
    const f = PFIELDS.find((x) => x.k === k);
    if (k === 'designation') { S.designation = t.value; return; }
    if (f.type === 'select') S.params[k] = t.value;
    else {
      let v = parseFloat(String(t.value).replace(',', '.'));
      if (isNaN(v) || v < f.min) v = f.min;
      if (k === 'blocs') v = Math.round(v);
      S.params[k] = v / (f.scale || 1);
      t.value = +(S.params[k] * (f.scale || 1)).toFixed(2);
    }
    renderHyp(); renderFerraillage(true);
  });

  /* tiroir des paramètres */
  const scrim = $('#scrim'), drawer = $('#paramsDrawer');
  function openParams(on) { drawer.classList.toggle('open', on); drawer.setAttribute('aria-hidden', on ? 'false' : 'true'); scrim.classList.toggle('on', on); }
  $('#btnParams').addEventListener('click', () => openParams(true));
  scrim.addEventListener('click', () => openParams(false));
  document.addEventListener('click', (e) => { if (e.target.closest('[data-close="params"]')) openParams(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') openParams(false); });

  function renderFerraillage(keepParams) {
    if (!S.valid) return;
    const res = compute();
    if (!keepParams) renderParams();
    const el = $('#v-ferr'), [W, H] = boxOf(el);
    el.innerHTML = F.fitRender((u) => F.ferraillageScene(S.struct, res.geom, res.bars, res.params, u), W, H, { label: 'Coupe transversale ferraillée' });
    renderKpis(); renderTable(); renderRecap();
    if (S.sel && !res.bars.some((b) => b.id === S.sel)) S.sel = null;
    applySel(false);
    $('#st3').textContent = `${fr(res.recap.total, 1)} kg`;
  }

  function renderKpis() {
    const r = S.res, vol = volume(r.geom) * Math.max(1, r.params.blocs);
    $('#kpis').innerHTML = `
      <div class="kpi"><small>Aciers</small><b>${fr(r.recap.total, 1)}<i>kg</i></b></div>
      <div class="kpi"><small>Béton</small><b>${fr(vol, 2)}<i>m³</i></b></div>
      <div class="kpi"><small>Ratio</small><b>${fr(r.recap.total / vol, 0)}<i>kg/m³</i></b></div>
      <div class="kpi"><small>Repères</small><b>${r.bars.length}<i>· ${fr(r.recap.longueur, 0)} m</i></b></div>`;
  }

  const colorOf = (barId) => { const i = S.res.bars.findIndex((b) => b.id === barId); return F.COLORS[i % F.COLORS.length]; };
  const croquisFor = (row, w, h) => F.croquisSVG(row.shape, colorOf(row.barId), w, h);

  function renderTable() {
    const r = S.res;
    $('#nom-sub').textContent = `${r.rows.length} lignes · ${r.params.norme}`;
    const head = `<thead><tr><th>N°</th><th>Type</th><th>Ø</th><th>Nb par<br>élément</th><th>Nb<br>élém.</th><th>Total</th><th>Espacement</th><th>L unit.<br>(m)</th><th>Façonnage</th><th>Mandrin<br>(cm)</th><th>L totale<br>(m)</th><th>Masse<br>(kg)</th></tr></thead>`;
    const body = r.rows.map((row) => {
      const first = !row.suffix || row.suffix === 'a', dens = row.kind === 'densite';
      const dSel = first
        ? `<div class="num"><select data-d="${row.barId}" aria-label="Diamètre repère ${row.barId}">${F.DIAMS.map((d) => `<option value="${d}"${d === row.d ? ' selected' : ''}>${d}</option>`).join('')}</select></div>`
        : `<span class="sub">${row.d}</span>`;
      const esp = first
        ? `<div class="num"><input type="number" data-esp="${row.barId}" value="${dens ? row.esp : row.esp.toFixed(2)}" step="${dens ? 1 : 0.01}" min="${dens ? 1 : 0.05}" aria-label="Espacement repère ${row.barId}"><span>${dens ? '/m²' : 'm'}</span></div>`
        : `<span class="sub">idem ${row.barId}a</span>`;
      return `<tr data-bar="${row.barId}" title="${esc(row.role + (row.split ? ' — découpe avec recouvrement' : ''))}">
        <td class="rep">${row.id}<i style="background:${colorOf(row.barId)}"></i></td><td>${row.type}</td><td>${dSel}</td>
        <td>${row.parElem}${row.mult > 1 ? `<span class="sub">${row.n}×${row.mult}</span>` : ''}</td><td>${row.nbElem}</td><td><b style="font-weight:500">${row.total}</b></td>
        <td>${esp}</td><td>${row.L.toFixed(3)}${row.tooLong ? '<span class="sub" style="color:var(--danger)">&gt; Lmax</span>' : ''}</td>
        <td class="fac"><div class="fac-in">${row.code ? `<span class="code" title="Code de façonnage">${row.code}</span>` : ''}${croquisFor(row, 124, 40)}${first ? `<button type="button" class="ico" data-adj="${row.barId}" title="Ajuster la barre ${row.barId}" aria-label="Ajuster la barre ${row.barId}">✎</button>` : '<span style="width:28px"></span>'}</div></td>
        <td>${(row.D * 100).toFixed(1)}</td><td>${row.Ltot.toFixed(2)}</td><td>${row.masse.toFixed(1)}</td></tr>`;
    }).join('');
    const foot = `<tfoot><tr><td colspan="10" style="text-align:right">Total</td><td>${r.recap.longueur.toFixed(2)}</td><td>${r.recap.total.toFixed(1)}</td></tr></tfoot>`;
    $('#nomenc').innerHTML = head + '<tbody>' + body + '</tbody>' + foot;
  }

  function renderRecap() {
    const L = S.res.recap.lignes, R = S.res.recap;
    const cell = (l, v) => `<td class="${l.masse ? '' : 'z'}">${l.masse ? v : '—'}</td>`;
    $('#recap').innerHTML = `<tr><th>Récapitulatif</th>${L.map((l) => `<th>HA${l.d}</th>`).join('')}<th class="tot">Total</th></tr>
      <tr><td>kg/m</td>${L.map((l) => `<td class="${l.masse ? '' : 'z'}">${l.ml.toFixed(3)}</td>`).join('')}<td class="tot"></td></tr>
      <tr><td>Longueur (m)</td>${L.map((l) => cell(l, fr(l.longueur, 1))).join('')}<td class="tot">${fr(R.longueur, 1)}</td></tr>
      <tr><td>Masse (kg)</td>${L.map((l) => cell(l, fr(l.masse, 1))).join('')}<td class="tot">${fr(R.total, 1)}</td></tr>`;
  }

  /* ───── Surbrillance d'une barre (coupe ⇄ nomenclature) ───── */
  function applySel(scroll) {
    const svg = $('#v-ferr svg');
    if (svg) {
      svg.classList.toggle('has-sel', !!S.sel);
      $$('[data-bar]', svg).forEach((e) => e.classList.toggle('on', e.getAttribute('data-bar') === S.sel));
    }
    $$('#nomenc tbody tr').forEach((tr) => tr.classList.toggle('sel', tr.dataset.bar === S.sel));
    $('#ferr-sub').textContent = S.sel ? 'repère ' + S.sel + ' — ' + S.res.bars.find((b) => b.id === S.sel).role : 'cliquez une barre pour la repérer';
    if (scroll && S.sel) {
      const tr = $(`#nomenc tbody tr[data-bar="${S.sel}"]`), w = tr && tr.closest('.tablewrap');
      if (w && w.scrollHeight > w.clientHeight + 2) {
        const rw = w.getBoundingClientRect(), rt = tr.getBoundingClientRect(), head = 40, foot = 34;
        if (rt.top < rw.top + head) w.scrollTop += rt.top - rw.top - head;
        else if (rt.bottom > rw.bottom - foot) w.scrollTop += rt.bottom - rw.bottom + foot;
      }
    }
  }
  function select(id, scroll) { S.sel = id && id !== S.sel ? id : null; applySel(scroll); }
  // Choix de la barre visée : parmi les éléments sous le doigt (zones de saisie élargies comprises),
  // on retient celui dont la géométrie réelle (axe de barre, centre de pastille) est la plus proche.
  function distTo(el, P) {
    if (el.tagName === 'g') el = el.lastElementChild;
    if (el.tagName === 'circle') return Math.hypot(el.cx.baseVal.value - P.x, el.cy.baseVal.value - P.y);
    if (el.tagName === 'text') return Math.hypot(el.x.baseVal[0].value - P.x, el.y.baseVal[0].value - P.y);
    if (el.getTotalLength) {
      const L = el.getTotalLength(), n = Math.min(400, Math.max(20, Math.ceil(L / 2)));
      let d = Infinity;
      for (let i = 0; i <= n; i++) { const q = el.getPointAtLength(L * i / n); d = Math.min(d, Math.hypot(q.x - P.x, q.y - P.y)); }
      return d;
    }
    return Infinity;
  }
  // coordonnées fractionnaires du pointeur (l'événement click les arrondit au pixel)
  let lastPt = null;
  $('#v-ferr').addEventListener('pointerdown', (e) => { lastPt = { x: e.clientX, y: e.clientY, t: Date.now() }; });
  $('#v-ferr').addEventListener('click', (e) => {
    const svg = $('#v-ferr svg');
    const cp = lastPt && Date.now() - lastPt.t < 1500 && Math.abs(lastPt.x - e.clientX) < 2 && Math.abs(lastPt.y - e.clientY) < 2 ? lastPt : { x: e.clientX, y: e.clientY };
    const stack = document.elementsFromPoint(cp.x, cp.y).map((el) => el.closest && el.closest('#v-ferr [data-bar]')).filter(Boolean);
    let best = null;
    if (svg && stack.length) {
      const P = new DOMPoint(cp.x, cp.y).matrixTransform(svg.getScreenCTM().inverse());
      let dmin = Infinity;
      new Set(stack).forEach((el) => { const d = distTo(el, P); if (d < dmin) { dmin = d; best = el; } });
    }
    select(best ? best.getAttribute('data-bar') : null, true);
  });
  $('#nomenc').addEventListener('click', (e) => {
    if (e.target.closest('input,select,button,option')) return;
    const tr = e.target.closest('tbody tr'); if (tr) select(tr.dataset.bar, false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.sel && !$('#barDlg').open) select(null); });

  const ov = (id) => (S.overrides[id] = S.overrides[id] || {});
  $('#nomenc').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.d) { ov(t.dataset.d).d = +t.value; renderFerraillage(true); }
    else if (t.dataset.esp) {
      const bar = S.res.bars.find((b) => b.id === t.dataset.esp);
      let v = parseFloat(String(t.value).replace(',', '.'));
      const min = bar.kind === 'densite' ? 0.5 : 0.05;
      if (isNaN(v) || v < min) v = min;
      ov(t.dataset.esp).esp = v; renderFerraillage(true);
    }
  });
  $('#nomenc').addEventListener('click', (e) => { const b = e.target.closest('[data-adj]'); if (b) openBar(b.dataset.adj); });

  /* ───── Panneau latéral « Ajuster la barre » ───── */
  let dlgBar = null, dlgDraft = null;
  function openBar(id, alt) {
    const bar = alt || S.res.bars.find((b) => b.id === id);
    dlgBar = bar;
    dlgDraft = { segs: bar.segs.map((s) => s.l), hooks: (bar.hooks || [0, 0]).slice(), maint: alt ? bar.maintien : null }; // type mémorisé seulement s'il a été changé ici
    $('#dlgTitle').textContent = `Barre n° ${id} — HA${bar.d}`;
    $('#dlgRole').textContent = bar.role + (bar.code ? ' — code de façonnage ' + bar.code : '');
    const n = bar.segs.length;
    const segF = bar.segs.map((s, i) => `<div class="f"><label for="dg-s${i}">${n > 1 ? 'Segment ' + (i + 1) : 'Longueur droite'}</label><div class="num"><input id="dg-s${i}" type="number" step="0.005" min="0.02" value="${s.l}" data-seg="${i}"><span>m</span></div></div>`).join('');
    const hk = (k, lbl) => `<div class="f"><label for="dg-h${k}">${lbl}</label><div class="num"><select id="dg-h${k}" data-hook="${k}">${F.HOOKS.map((h) => `<option value="${h}"${h === dlgDraft.hooks[k] ? ' selected' : ''}>${h ? h + '°' : 'aucune'}</option>`).join('')}</select></div></div>`;
    const typ = bar.maintien ? `<div class="f wide"><label for="dg-type">Type de maintien</label><div class="num"><select id="dg-type" data-type="1"><option value="epingle"${bar.maintien === 'epingle' ? ' selected' : ''}>Épingle — barre droite à deux crosses (code 3001)</option><option value="etrier"${bar.maintien === 'etrier' ? ' selected' : ''}>Étrier — boucle fermée étroite, 2 crosses 135°</option></select></div></div>` : '';
    $('#dlgFields').innerHTML = typ + segF + hk(0, 'Crosse départ') + hk(1, 'Crosse fin');
    updateDlg();
    const d = $('#barDlg');
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  function updateDlg() {
    const b = dlgBar, shape = { segs: b.segs.map((s, i) => ({ l: dlgDraft.segs[i], a: s.a })), hooks: dlgDraft.hooks, sides: b.sides };
    $('#dlgPrev').innerHTML = F.croquisSVG(shape, colorOf(b.id), 320, 120);
    const dev = F.devLength(shape, b.d, S.params);
    $('#dlgInfo').innerHTML = `${b.code ? `Code de façonnage <b>${b.code}</b> · ` : ''}Longueur développée : <b>${dev.L.toFixed(3)} m</b><br>Σ cotes ${dev.sumSegs.toFixed(3)} − pliages ${dev.deductions.toFixed(3)} + crosses ${dev.hooks.toFixed(3)} · mandrin ${(dev.D * 100).toFixed(1)} cm`;
  }
  $('#dlgFields').addEventListener('change', (e) => {
    if (!e.target.dataset.type) return;
    const id = dlgBar.id, tmp = Object.assign({}, S.overrides, { [id]: { d: (S.overrides[id] || {}).d, esp: (S.overrides[id] || {}).esp, maint: e.target.value } });
    const alt = F.compute(S.struct, S.valid, S.params, tmp).bars.find((b) => b.id === id);
    openBar(id, alt);
  });
  $('#dlgFields').addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.type) return;
    if (t.dataset.seg != null) { const v = parseFloat(t.value); if (v > 0) dlgDraft.segs[+t.dataset.seg] = v; }
    if (t.dataset.hook != null) dlgDraft.hooks[+t.dataset.hook] = +t.value;
    updateDlg();
  });
  const closeDlg = () => { const d = $('#barDlg'); if (d.close) d.close(); else d.removeAttribute('open'); };
  $('#dlgClose').addEventListener('click', closeDlg);
  $('#barDlg').addEventListener('click', (e) => { if (e.target.id === 'barDlg') closeDlg(); });
  $('#dlgOk').addEventListener('click', () => {
    const o = ov(dlgBar.id);
    if (dlgDraft.maint) o.maint = dlgDraft.maint; // choix par barre : prioritaire sur le réglage global
    o.segs = dlgDraft.segs.slice(); o.hooks = dlgDraft.hooks.slice();
    closeDlg(); renderFerraillage(true);
  });
  $('#dlgReset').addEventListener('click', () => { const o = ov(dlgBar.id); delete o.segs; delete o.hooks; delete o.maint; closeDlg(); renderFerraillage(true); });

  /* ───── Étape 4 ───── */
  function renderExport() {
    if (!S.res) compute();
    const r = S.res;
    $('#expSum').innerHTML = `<p style="margin-bottom:8px"><b style="font-weight:500;color:var(--white)">${esc(S.designation)}</b><br>${F.STRUCTURES[S.struct].label}</p><div class="kpis" style="grid-template-columns:repeat(2,1fr)">
      <div class="kpi"><small>Masse totale</small><b>${fr(r.recap.total, 1)}<i>kg</i></b></div>
      ${r.recap.lignes.filter((l) => l.masse).map((l) => `<div class="kpi"><small>HA${l.d}</small><b>${fr(l.masse, 1)}<i>kg</i></b></div>`).join('')}
      </div><p style="margin-top:8px;font-size:12px">${r.rows.length} lignes de nomenclature · ${r.params.norme} · Lmax ${r.params.lmax} m.</p>`;
  }

  function fileBase() {
    const base = (S.designation || S.struct).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return base || 'plan';
  }

  $('#btnDxf').addEventListener('click', () => {
    if (!S.res) return;
    const txt = F.buildDXF(S.struct, S.res.geom, S.res, { structureLabel: F.STRUCTURES[S.struct].label + ' — ' + S.designation, titre: 'BridgeAI Studios — ' + S.designation });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/dxf' }));
    a.download = fileBase() + '-coffrage-ferraillage.dxf';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  function buildPrint() {
    if (!S.res) return;
    const r = S.res, g = r.geom, p = r.params;
    const date = new Date().toLocaleDateString('fr-FR');
    const rows = r.rows.map((row) => `<tr><td><b>${row.id}</b></td><td>${row.type}</td><td>${row.d}</td><td>${row.parElem}${row.mult > 1 ? ` (${row.n}×${row.mult})` : ''}</td><td>${row.nbElem}</td><td>${row.total}</td><td>${row.kind === 'densite' ? row.esp + '/m²' : row.esp.toFixed(2)}</td><td>${row.L.toFixed(3)}</td><td>${croquisFor(row, 150, 40)}${row.code ? `<div style="font-size:6.5pt;color:#555">code ${row.code}</div>` : ''}</td><td>${(row.D * 100).toFixed(1)}</td><td>${row.Ltot.toFixed(2)}</td><td>${row.masse.toFixed(1)}</td></tr>`).join('');
    $('#print').innerHTML = `
      <div class="p-cart">
        <div class="p-bet">BridgeAI Studios<small>Plans coffrage &amp; ferraillage · généré le ${date}</small></div>
        <div class="p-title"><div class="p-k">${esc(F.STRUCTURES[S.struct].label)}</div><div class="p-n">${esc(S.designation)}</div></div>
        <div class="p-meta"><b>Règlement</b> ${p.norme} · <b>Enrobages</b> ${Math.round(p.cTerre * 100)} / ${Math.round(p.cAutre * 100)} cm<br><b>Lmax</b> ${p.lmax} m · <b>Recouvrement</b> ${p.recouv}Ø<br><b>Masse totale</b> ${fr(r.recap.total, 1)} kg · ${p.blocs} élément(s)</div>
      </div>
      <div class="p-views">
        <figure><figcaption>Coupe de coffrage</figcaption>${F.fitRender((u) => F.coffrageScene(S.struct, g, u), 520, 380)}</figure>
        <figure><figcaption>Coupe ferraillée</figcaption>${F.fitRender((u) => F.ferraillageScene(S.struct, g, r.bars, p, u), 520, 380)}</figure>
      </div>
      <div class="p-bottom">
        <figure class="p-second"><figcaption>${S.struct === 'dalot' ? 'Vue en plan' : 'Élévation du plot'}</figcaption>${F.fitRender((u) => F.secondScene(S.struct, g, u), 560, 150)}</figure>
        <div><div class="p-h">Récapitulatif par diamètre</div>
          <table class="p-tab p-rc"><thead><tr><th>Ø</th><th>kg/m</th><th>Longueur (m)</th><th>Masse (kg)</th></tr></thead><tbody>${r.recap.lignes.map((l) => `<tr><td>HA${l.d}</td><td>${l.ml.toFixed(3)}</td><td>${l.longueur ? l.longueur.toFixed(1) : '—'}</td><td>${l.masse ? l.masse.toFixed(1) : '—'}</td></tr>`).join('')}<tr><td><b>Total</b></td><td></td><td><b>${r.recap.longueur.toFixed(1)}</b></td><td><b>${r.recap.total.toFixed(1)}</b></td></tr></tbody></table></div>
      </div>
      <div class="p-break"></div>
      <div class="p-h">Nomenclature des aciers — ${esc(S.designation)}</div>
      <table class="p-tab"><thead><tr><th>N°</th><th>Type</th><th>Ø</th><th>Nb / élément</th><th>Nb d’éléments</th><th>Total</th><th>Esp.</th><th>L unit. (m)</th><th>Façonnage</th><th>Mandrin (cm)</th><th>L totale (m)</th><th>Masse (kg)</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="p-hyp"><div class="p-h">Hypothèses</div>${hypHTML().replace('<b>Hypothèses retenues</b> (simplifiées, à vérifier)', '')}</div>`;
  }
  $('#btnPrint').addEventListener('click', () => { buildPrint(); window.print(); });
  window.addEventListener('beforeprint', buildPrint);

  /* ───── Redimensionnement : les dessins suivent la taille de leur cadre ───── */
  let rz = 0, last = window.innerWidth + 'x' + window.innerHeight;
  window.addEventListener('resize', () => {
    const k = window.innerWidth + 'x' + window.innerHeight;
    if (k === last) return; last = k;
    clearTimeout(rz);
    rz = setTimeout(() => { if (S.step === 2) renderCoffrage(); if (S.step === 3) renderFerraillage(true); }, 150);
  });

  renderCatalog();
  // accès direct : plans-ferraillage.html#murT ou #dalot
  const h = location.hash.replace('#', '');
  if (F.STRUCTURES[h]) selectStruct(h);
})();
