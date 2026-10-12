/* BridgeAI Studios — Plans de coffrage & ferraillage : interface. */
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
    { id: 'murT', name: 'Mur de soutènement en T', desc: 'Voile et semelle à patin et talon : U de semelle, attentes en L, filants, épingles et écarteurs.',
      svg: sv('<path d="M6 66H114" stroke-width="1" opacity=".5"/><path d="M30 60H92V50H66V8H56V50H30Z"/><path d="M66 20L98 50" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/>') },
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
  const STEP_NAMES = { murT: 'Mur en T', dalot: 'Dalot cadre' };
  const DESIGNATION = { murT: 'Mur de soutènement — bloc type', dalot: 'Dalot cadre fermé' };

  /* ───── État ───── */
  const S = {
    struct: null, geom: {}, valid: null, validKey: '', params: Object.assign({}, F.DEFAULT_PARAMS),
    designation: '', overrides: {}, res: null, step: 1, maxStep: 1,
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
    const top = $('#steps').getBoundingClientRect().top + window.scrollY - 80;
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b && !b.disabled) goStep(+b.dataset.go);
  });

  /* ───── Étape 1 ───── */
  function renderCatalog() {
    $('#catalog').innerHTML = CATALOG.map((c) => c.id
      ? `<button class="tile on" data-struct="${c.id}"><span class="status on">Disponible</span><span class="schema">${c.svg}</span><span class="name">${c.name}</span><span class="desc">${c.desc}</span><span class="go">Dessiner →</span></button>`
      : `<div class="tile dev" aria-disabled="true"><span class="status">Bientôt</span><span class="schema">${c.svg}</span><span class="name">${c.name}</span><span class="soon">En préparation</span></div>`).join('');
    $$('#catalog [data-struct]').forEach((b) => b.addEventListener('click', () => selectStruct(b.dataset.struct)));
  }

  function selectStruct(id) {
    if (S.struct !== id) {
      S.struct = id; S.geom = F.defaults(id); S.overrides = {}; S.valid = null; S.validKey = '';
      S.designation = DESIGNATION[id];
      S.maxStep = 2;
    }
    S.maxStep = Math.max(S.maxStep, 2);
    $('#st1').textContent = F.STRUCTURES[id].label;
    $('#c-name').textContent = F.STRUCTURES[id].label;
    renderForm();
    goStep(2);
  }

  /* ───── Étape 2 ───── */
  function renderForm() {
    const St = F.STRUCTURES[S.struct];
    $('#fields').innerHTML = St.fields.map((f) => `
      <div class="field"><label for="f-${f.k}">${f.label}${f.hint ? `<small>${f.hint}</small>` : ''}</label>
      <div class="num"><input id="f-${f.k}" type="number" inputmode="decimal" step="${f.step}" min="${f.min}" max="${f.max}" value="${S.geom[f.k]}" data-k="${f.k}"><span>m</span></div></div>`).join('');
    $('#v2-title').textContent = S.struct === 'dalot' ? 'Vue en plan' : 'Élévation du bloc';
  }

  function readForm() {
    $$('#fields input').forEach((i) => { const v = parseFloat(String(i.value).replace(',', '.')); S.geom[i.dataset.k] = isNaN(v) ? NaN : v; });
  }

  function viewWidth(el) { return Math.max(260, Math.floor(el.clientWidth - 24)); }

  function renderCoffrage() {
    if (!S.struct) return;
    const St = F.STRUCTURES[S.struct];
    const errs = St.validate(S.geom);
    $('#coffMsg').innerHTML = errs.map(esc).join('<br>');
    $('#btnValider').disabled = errs.length > 0;
    const g = St.derive(S.geom);
    $('#derived').innerHTML = S.struct === 'murT'
      ? `Talon : <b>${isNaN(g.talon) ? '—' : g.talon.toFixed(3)} m</b> · hauteur totale <b>${(g.H + g.hs).toFixed(2)} m</b><br>Béton : <b>${fr(volume(g), 2)} m³</b> par bloc de ${g.L} m`
      : `Largeur extérieure : <b>${g.Bext.toFixed(2)} m</b> · hauteur extérieure <b>${g.Hext.toFixed(2)} m</b><br>Béton : <b>${fr(volume(g), 2)} m³</b> pour ${g.L} m`;
    if (errs.length) return;
    const el = $('#v-coupe'), W = viewWidth(el);
    const ext = S.struct === 'murT' ? [g.B + 0.1, g.H + g.hs + g.bp] : [g.Bext, g.Hext];
    const s = F.fitScale(ext[0], ext[1], W, 150, W < 500 ? 900 : 440);
    el.innerHTML = F.toSVG(F.coffrageScene(S.struct, g, 1 / s), s, { label: 'Coupe transversale de coffrage cotée' });
    const el2 = $('#v-second'), W2 = viewWidth(el2);
    const ext2 = S.struct === 'murT' ? [g.L, g.H + g.hs] : [g.L, g.Bext];
    const s2 = F.fitScale(ext2[0], ext2[1], W2, 110, 200);
    el2.innerHTML = F.toSVG(F.secondScene(S.struct, g, 1 / s2), s2, { label: $('#v2-title').textContent });
  }

  function polyArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); }
  function volume(g) {
    const o = F.outline(S.struct, g);
    return (polyArea(o.outer) - o.holes.reduce((s, h) => s + polyArea(h), 0)) * g.L;
  }

  $('#fields').addEventListener('input', () => { readForm(); renderCoffrage(); });
  $('#btnReset').addEventListener('click', () => { S.geom = F.defaults(S.struct); renderForm(); renderCoffrage(); });
  $('#btnValider').addEventListener('click', () => {
    readForm();
    if (F.STRUCTURES[S.struct].validate(S.geom).length) return;
    const key = JSON.stringify(S.geom);
    if (key !== S.validKey) Object.values(S.overrides).forEach((o) => { delete o.segs; }); // la forme dépend de la géométrie
    S.valid = Object.assign({}, S.geom); S.validKey = key;
    $('#st2').textContent = S.struct === 'murT' ? `H ${S.geom.H} · B ${S.geom.B} · L ${S.geom.L} m` : `${S.geom.O} × ${S.geom.Hi} · L ${S.geom.L} m`;
    S.maxStep = 4;
    goStep(3);
  });

  /* ───── Étape 3 ───── */
  function compute() {
    S.res = F.compute(S.struct, S.valid, S.params, S.overrides);
    return S.res;
  }

  const PFIELDS = [
    { k: 'designation', label: 'Désignation de l’ouvrage', type: 'text' },
    { k: 'norme', label: 'Règlement (mandrins, crosses)', type: 'select', opts: [['EC2', 'Eurocode 2'], ['BAEL', 'BAEL 91']] },
    { k: 'cTerre', label: 'Enrobage fondation / terre', unit: 'cm', scale: 100, step: 0.5, min: 1 },
    { k: 'cAutre', label: 'Enrobage autres parements', unit: 'cm', scale: 100, step: 0.5, min: 1 },
    { k: 'lmax', label: 'Longueur maximale des barres', unit: 'm', step: 0.5, min: 3 },
    { k: 'recouv', label: 'Recouvrement', unit: 'Ø', step: 5, min: 20 },
    { k: 'blocs', label: 'Nombre d’éléments identiques', unit: 'u', step: 1, min: 1 },
  ];

  function renderParams() {
    $('#pfields').innerHTML = PFIELDS.map((f) => {
      const v = f.k === 'designation' ? S.designation : S.params[f.k];
      if (f.type === 'text') return `<div class="field" style="grid-template-columns:1fr"><label for="p-${f.k}">${f.label}</label><div class="num"><input id="p-${f.k}" type="text" value="${esc(v)}" data-p="${f.k}" style="padding-right:10px"></div></div>`;
      if (f.type === 'select') return `<div class="field"><label for="p-${f.k}">${f.label}</label><div class="num"><select id="p-${f.k}" data-p="${f.k}">${f.opts.map((o) => `<option value="${o[0]}"${o[0] === v ? ' selected' : ''}>${o[1]}</option>`).join('')}</select></div></div>`;
      return `<div class="field"><label for="p-${f.k}">${f.label}</label><div class="num"><input id="p-${f.k}" type="number" step="${f.step}" min="${f.min}" value="${+(v * (f.scale || 1)).toFixed(2)}" data-p="${f.k}"><span>${f.unit}</span></div></div>`;
    }).join('');
    renderHyp();
  }

  function renderHyp() {
    const p = S.params, ec2 = p.norme === 'EC2';
    $('#hyp').innerHTML = `<b>Hypothèses retenues</b> (simplifiées, à vérifier)
      <ul>
        <li>Mandrins : ${ec2 ? 'EC2 §8.3 — Ø ≤ 16 : 4Ø ; Ø > 16 : 7Ø' : 'BAEL — 5Ø pour les HA'}.</li>
        <li>Crosses : retour droit ${ec2 ? '10Ø ≥ 70 mm (90°, 135°) ; 5Ø ≥ 50 mm (180°) — EC2 fig. 8.5' : '10Ø quel que soit l’angle'}.</li>
        <li>Longueur développée = Σ cotes hors-tout − déductions de pliage 2(r+Ø)tan(θ/2) − θ(r+Ø/2) + crosses, arrondie à 5 mm.</li>
        <li>Nombre = ⌊longueur de répartition / espacement⌋ + 1 ; épingles et écarteurs : surface × densité.</li>
        <li>Au-delà de ${p.lmax} m : découpe en barres indicées avec recouvrement ${p.recouv}Ø.</li>
        <li>Diamètres proposés par règles forfaitaires : le ferraillage doit être justifié par une note de calcul.</li>
      </ul>`;
  }

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

  function renderFerraillage(keepParams) {
    if (!S.valid) return;
    const res = compute();
    if (!keepParams) renderParams();
    const g = res.geom;
    // coupe ferraillée
    const el = $('#v-ferr'), W = viewWidth(el);
    const ext = S.struct === 'murT' ? [g.B + 0.1, g.H + g.hs + g.bp] : [g.Bext, g.Hext];
    const s = F.fitScale(ext[0], ext[1], W, 120, W < 500 ? 900 : 560);
    el.innerHTML = F.toSVG(F.ferraillageScene(S.struct, g, res.bars, res.params, 1 / s), s, { label: 'Coupe transversale ferraillée' });
    renderKpis(); renderTable(); renderRecap();
    $('#st3').textContent = `${fr(res.recap.total, 1)} kg d’aciers`;
  }

  function renderKpis() {
    const r = S.res, vol = volume(r.geom) * Math.max(1, r.params.blocs);
    $('#kpis').innerHTML = `
      <div class="kpi wide"><small>Masse totale d’aciers</small><b>${fr(r.recap.total, 1)}<i>kg</i></b></div>
      <div class="kpi"><small>Béton</small><b>${fr(vol, 2)}<i>m³</i></b></div>
      <div class="kpi"><small>Ratio</small><b>${fr(r.recap.total / vol, 0)}<i>kg/m³</i></b></div>
      <div class="kpi"><small>Repères</small><b>${r.bars.length}</b></div>
      <div class="kpi"><small>Longueur</small><b>${fr(r.recap.longueur, 1)}<i>m</i></b></div>`;
  }

  function croquisFor(row, w, h) {
    const i = S.res.bars.findIndex((b) => b.id === row.barId);
    return F.croquisSVG(row.shape, F.COLORS[i % F.COLORS.length], w, h);
  }

  function renderTable() {
    const r = S.res;
    $('#nom-sub').textContent = `${r.rows.length} lignes · ${r.params.norme} · Ø et espacement modifiables`;
    const head = `<thead><tr><th>N°</th><th>Type</th><th>Ø</th><th>Nombre<br>par élément</th><th>Nombre<br>d’éléments</th><th>Total</th><th>Espacement</th><th>Longueur<br>unitaire (m)</th><th>Façonnage</th><th>Mandrin<br>(cm)</th><th>Longueur<br>totale (m)</th><th>Masse<br>(kg)</th></tr></thead>`;
    const body = r.rows.map((row) => {
      const i = r.bars.findIndex((b) => b.id === row.barId), col = F.COLORS[i % F.COLORS.length];
      const first = !row.suffix || row.suffix === 'a';
      const dSel = first
        ? `<div class="num"><select data-d="${row.barId}" aria-label="Diamètre repère ${row.barId}">${F.DIAMS.map((d) => `<option value="${d}"${d === row.d ? ' selected' : ''}>${d}</option>`).join('')}</select></div>`
        : `<span class="sub">${row.d}</span>`;
      const dens = row.kind === 'densite';
      const esp = first
        ? `<div class="num"><input type="number" data-esp="${row.barId}" value="${dens ? row.esp : row.esp.toFixed(2)}" step="${dens ? 1 : 0.01}" min="${dens ? 1 : 0.05}" aria-label="Espacement repère ${row.barId}"><span>${dens ? '/m²' : 'm'}</span></div>`
        : `<span class="sub">idem ${row.barId}a</span>`;
      return `<tr title="${esc(row.role)}">
        <td class="rep">${row.id}<i style="background:${col}"></i></td><td>${row.type}</td><td>${dSel}</td>
        <td>${row.parElem}${row.mult > 1 ? `<div class="sub">${row.n} × ${row.mult}</div>` : ''}</td><td>${row.nbElem}</td><td><b style="font-weight:500">${row.total}</b></td>
        <td>${esp}</td><td>${row.L.toFixed(3)}${row.tooLong ? '<div class="sub" style="color:var(--danger)">&gt; Lmax</div>' : ''}</td>
        <td class="fac">${croquisFor(row, 170, 62)}<span class="role">${esc(row.role)}${row.split ? ' — découpe avec recouvrement' : ''}</span>${first ? `<button class="btn ghost small" data-adj="${row.barId}">Ajuster la barre</button>` : ''}</td>
        <td>${(row.D * 100).toFixed(1)}</td><td>${row.Ltot.toFixed(2)}</td><td>${row.masse.toFixed(1)}</td></tr>`;
    }).join('');
    const foot = `<tfoot><tr><td colspan="10" style="text-align:right">Total</td><td>${r.recap.longueur.toFixed(2)}</td><td>${r.recap.total.toFixed(1)}</td></tr></tfoot>`;
    $('#nomenc').innerHTML = head + '<tbody>' + body + '</tbody>' + foot;
  }

  function renderRecap() {
    const r = S.res;
    $('#recap').innerHTML = `<thead><tr><th>Diamètre</th><th>Masse linéique (kg/m)</th><th>Longueur (m)</th><th>Masse (kg)</th></tr></thead><tbody>` +
      r.recap.lignes.map((l) => `<tr class="${l.masse ? '' : 'zero'}"><td>HA${l.d}</td><td>${l.ml.toFixed(3)}</td><td>${l.longueur ? fr(l.longueur, 1) : '—'}</td><td>${l.masse ? fr(l.masse, 1) : '—'}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td>Total</td><td></td><td>${fr(r.recap.longueur, 1)}</td><td>${fr(r.recap.total, 1)} kg</td></tr></tfoot>`;
    const split = r.rows.filter((x) => x.split).length;
    $('#recapNote').innerHTML = `<b style="font-weight:500;color:var(--white)">Lecture</b><br>Les longueurs sont développées à l’axe et arrondies à 5 mm ; les masses utilisent les masses linéiques nominales des HA.` +
      (split ? `<br><br>${split} ligne(s) découpée(s) au-delà de ${r.params.lmax} m, recouvrement ${r.params.recouv}Ø inclus dans les longueurs.` : '') +
      `<br><br>Masse par élément : <b style="font-weight:500;color:var(--white)">${fr(r.recap.total / Math.max(1, r.params.blocs), 1)} kg</b>.`;
  }

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

  /* ───── Panneau « Ajuster la barre » ───── */
  let dlgBar = null, dlgDraft = null;
  function openBar(id) {
    const bar = S.res.bars.find((b) => b.id === id);
    dlgBar = bar;
    dlgDraft = { segs: bar.segs.map((s) => s.l), hooks: (bar.hooks || [0, 0]).slice() };
    $('#dlgTitle').textContent = `Barre n° ${id} — HA${bar.d}`;
    const segF = bar.segs.map((s, i) => `<div class="field"><label for="dg-s${i}">${bar.segs.length > 1 ? (i === 0 || i === bar.segs.length - 1 ? 'Retour / segment ' : 'Segment ') + (i + 1) : 'Longueur droite'}</label><div class="num"><input id="dg-s${i}" type="number" step="0.005" min="0.02" value="${s.l}" data-seg="${i}"><span>m</span></div></div>`).join('');
    const hk = (k, lbl) => `<div class="field"><label for="dg-h${k}">${lbl}</label><div class="num"><select id="dg-h${k}" data-hook="${k}">${F.HOOKS.map((h) => `<option value="${h}"${h === dlgDraft.hooks[k] ? ' selected' : ''}>${h ? h + '°' : 'aucune (0°)'}</option>`).join('')}</select></div></div>`;
    $('#dlgFields').innerHTML = segF + hk(0, 'Crosse — extrémité de départ') + hk(1, 'Crosse — extrémité de fin');
    updateDlg();
    const d = $('#barDlg');
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  function updateDlg() {
    const b = dlgBar, shape = { segs: b.segs.map((s, i) => ({ l: dlgDraft.segs[i], a: s.a })), hooks: dlgDraft.hooks, sides: b.sides };
    const i = S.res.bars.findIndex((x) => x.id === b.id);
    $('#dlgPrev').innerHTML = F.croquisSVG(shape, F.COLORS[i % F.COLORS.length], 300, 110);
    const dev = F.devLength(shape, b.d, S.params);
    $('#dlgInfo').innerHTML = `Longueur développée : <b>${dev.L.toFixed(3)} m</b><br>Σ cotes ${dev.sumSegs.toFixed(3)} − pliages ${dev.deductions.toFixed(3)} + crosses ${dev.hooks.toFixed(3)} · mandrin ${(dev.D * 100).toFixed(1)} cm`;
  }
  $('#dlgFields').addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.seg != null) { const v = parseFloat(t.value); if (v > 0) dlgDraft.segs[+t.dataset.seg] = v; }
    if (t.dataset.hook != null) dlgDraft.hooks[+t.dataset.hook] = +t.value;
    updateDlg();
  });
  const closeDlg = () => { const d = $('#barDlg'); if (d.close) d.close(); else d.removeAttribute('open'); };
  $('#dlgClose').addEventListener('click', closeDlg);
  $('#dlgOk').addEventListener('click', () => {
    const o = ov(dlgBar.id); o.segs = dlgDraft.segs.slice(); o.hooks = dlgDraft.hooks.slice();
    closeDlg(); renderFerraillage(true);
  });
  $('#dlgReset').addEventListener('click', () => {
    const o = ov(dlgBar.id); delete o.segs; delete o.hooks;
    closeDlg(); renderFerraillage(true);
  });

  /* ───── Étape 4 ───── */
  function renderExport() {
    if (!S.res) compute();
    const r = S.res;
    $('#exp-sub').textContent = `${S.designation} — ${F.STRUCTURES[S.struct].label}`;
    $('#expSum').innerHTML = `<div class="kpis">
      <div class="kpi wide"><small>Masse totale</small><b>${fr(r.recap.total, 1)}<i>kg</i></b></div>
      ${r.recap.lignes.filter((l) => l.masse).map((l) => `<div class="kpi"><small>HA${l.d}</small><b>${fr(l.masse, 1)}<i>kg</i></b></div>`).join('')}
      </div><p class="note" style="margin-top:10px">${r.rows.length} lignes de nomenclature · règlement ${r.params.norme} · Lmax ${r.params.lmax} m.</p>`;
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
    const ext = S.struct === 'murT' ? [g.B + 0.1, g.H + g.hs + g.bp] : [g.Bext, g.Hext];
    const s = F.fitScale(ext[0], ext[1], 500, 150, 380);
    const sf = F.fitScale(ext[0], ext[1], 500, 120, 380);
    const ext2 = S.struct === 'murT' ? [g.L, g.H + g.hs] : [g.L, g.Bext];
    const s2 = F.fitScale(ext2[0], ext2[1], 560, 110, 150);
    const date = new Date().toLocaleDateString('fr-FR');
    const rows = r.rows.map((row) => `<tr><td><b>${row.id}</b></td><td>${row.type}</td><td>${row.d}</td><td>${row.parElem}${row.mult > 1 ? ` (${row.n}×${row.mult})` : ''}</td><td>${row.nbElem}</td><td>${row.total}</td><td>${row.kind === 'densite' ? row.esp + '/m²' : row.esp.toFixed(2)}</td><td>${row.L.toFixed(3)}</td><td>${croquisFor(row, 150, 46)}</td><td>${(row.D * 100).toFixed(1)}</td><td>${row.Ltot.toFixed(2)}</td><td>${row.masse.toFixed(1)}</td></tr>`).join('');
    $('#print').innerHTML = `
      <div class="p-cart">
        <div class="p-bet">BridgeAI Studios<small>Plans coffrage &amp; ferraillage · généré le ${date}</small></div>
        <div class="p-title"><div class="p-k">${esc(F.STRUCTURES[S.struct].label)}</div><div class="p-n">${esc(S.designation)}</div></div>
        <div class="p-meta"><b>Règlement</b> ${p.norme} · <b>Enrobages</b> ${Math.round(p.cTerre * 100)} / ${Math.round(p.cAutre * 100)} cm<br><b>Lmax</b> ${p.lmax} m · <b>Recouvrement</b> ${p.recouv}Ø<br><b>Masse totale</b> ${fr(r.recap.total, 1)} kg · ${p.blocs} élément(s)</div>
      </div>
      <div class="p-views">
        <figure><figcaption>Coupe de coffrage</figcaption>${F.toSVG(F.coffrageScene(S.struct, g, 1 / s), s)}</figure>
        <figure><figcaption>Coupe ferraillée</figcaption>${F.toSVG(F.ferraillageScene(S.struct, g, r.bars, p, 1 / sf), sf)}</figure>
      </div>
      <div class="p-bottom">
        <figure class="p-second"><figcaption>${S.struct === 'dalot' ? 'Vue en plan' : 'Élévation du bloc'}</figcaption>${F.toSVG(F.secondScene(S.struct, g, 1 / s2), s2)}</figure>
        <div><div class="p-h">Récapitulatif par diamètre</div>
          <table class="p-tab p-rc"><thead><tr><th>Ø</th><th>kg/m</th><th>Longueur (m)</th><th>Masse (kg)</th></tr></thead><tbody>${r.recap.lignes.map((l) => `<tr><td>HA${l.d}</td><td>${l.ml.toFixed(3)}</td><td>${l.longueur ? l.longueur.toFixed(1) : '—'}</td><td>${l.masse ? l.masse.toFixed(1) : '—'}</td></tr>`).join('')}<tr><td><b>Total</b></td><td></td><td><b>${r.recap.longueur.toFixed(1)}</b></td><td><b>${r.recap.total.toFixed(1)}</b></td></tr></tbody></table></div>
      </div>
      <div class="p-break"></div>
      <div class="p-h">Nomenclature des aciers — ${esc(S.designation)}</div>
      <table class="p-tab"><thead><tr><th>N°</th><th>Type</th><th>Ø</th><th>Nb / élément</th><th>Nb d’éléments</th><th>Total</th><th>Esp.</th><th>L unit. (m)</th><th>Façonnage</th><th>Mandrin (cm)</th><th>L totale (m)</th><th>Masse (kg)</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="p-hyp"><div class="p-h">Hypothèses</div>${$('#hyp') ? $('#hyp').innerHTML.replace('<b>Hypothèses retenues</b> (simplifiées, à vérifier)', '') : ''}</div>
      </div>`;
  }
  $('#btnPrint').addEventListener('click', () => { buildPrint(); window.print(); });
  window.addEventListener('beforeprint', buildPrint);

  /* ───── Redimensionnement ───── */
  let rz = 0, lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - lastW) < 8) return;
    lastW = window.innerWidth;
    clearTimeout(rz);
    rz = setTimeout(() => { if (S.step === 2) renderCoffrage(); if (S.step === 3) renderFerraillage(true); }, 150);
  });

  renderCatalog();
  // accès direct : plans-ferraillage.html#murT ou #dalot
  const h = location.hash.replace('#', '');
  if (F.STRUCTURES[h]) selectStruct(h);
})();
