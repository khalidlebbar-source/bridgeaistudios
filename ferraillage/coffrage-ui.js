/* BridgeAI Studios — Plans de coffrage : espace de travail (saisie cotée + dessin en direct, plan A3→A0, DXF, PDF). */
(function () {
  'use strict';
  const C = window.COFF, REG = window.COFF_REG;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } } };
  const today = () => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };

  const W = { id: null, s: null, g: {}, fp: { o: {} }, kind: 'coffrage', tab: 'saisie', sv: 0, focus: null, back: null, opt: LS.get('coff.opt', { format: '', scale: '', cart: 'V' }), meta: null, logos: LS.get('coff.logos', {}) };
  const META_DEF = { mo: '', projet: '', ouvrage: '', objet: '', bet: '', ent: '', num: 'C-01', ind: 'A', date: today(), etabli: '', verifie: '', approuve: '', rev: 'Première émission', nota: '1. Cotes en mètres, niveaux en m NGM.\n2. Béton : classe à préciser selon le CCTP.\n3. Enrobage : à préciser selon l\'exposition.\n4. Chanfreins 2 × 2 cm sur arêtes vues.' };

  const defaults = (s) => { const g = {}; s.fields.forEach((f) => { g[f.k] = f.def; }); return g; };

  /* ───── ouverture ───── */
  function open(id, o) {
    o = o || {};
    W.id = id; W.s = REG[id]; W.sv = 0; W.focus = null; W.back = o.back || null;
    W.g = Object.assign(defaults(W.s), LS.get('coff.g.' + id, {}), o.g || {});
    W.fp = LS.get('coff.f.' + id, { o: {} }); if (!W.fp.o) W.fp.o = {};
    W.meta = Object.assign({}, META_DEF, LS.get('coff.meta', {}));
    W.hasF = typeof W.s.ferr === 'function';
    W.kind = o.kind || 'coffrage'; if (!W.hasF) W.kind = 'coffrage';
    setObjet();
    $$('main > .step').forEach((el) => el.classList.remove('show'));
    const ws = $('#coff'); ws.hidden = false; document.body.classList.add('coff-open');
    $('#cName').textContent = W.s.name;
    $('#cTabs [data-t="saisie"]').hidden = !!W.s.ferr && !W.hasF && !!o.g;      // mur et dalot : la saisie reste dans leur module
    $('#cTabs [data-t="ferr"]').hidden = !W.hasF;
    $('#cToFerr').textContent = W.hasF ? 'Ferraillage →' : 'Plan de coffrage →';
    renderFields(); renderSchema(); setTab(o.tab || 'saisie');
    window.scrollTo(0, 0);
  }
  function close() { $('#coff').hidden = true; document.body.classList.remove('coff-open'); if (W.back) W.back(); }

  function setTab(t) {
    W.tab = t;
    $$('#cTabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    $('#cSaisie').hidden = t !== 'saisie'; $('#cPlan').hidden = t !== 'plan'; $('#cFerr').hidden = t !== 'ferr';
    $('#cAct').hidden = t !== 'plan';
    if (t === 'saisie') requestAnimationFrame(() => { renderSchema(); renderLive(); });
    else if (t === 'ferr') requestAnimationFrame(renderFerr);
    else { if (W.kind === 'ferraillage' && !W.hasF) W.kind = 'coffrage'; renderOpts(); requestAnimationFrame(renderSheet); }
  }
  function setObjet() { if (!W.meta.objetUser) W.meta.objet = (W.kind === 'ferraillage' ? 'PLAN DE FERRAILLAGE — ' : 'PLAN DE COFFRAGE — ') + W.s.name.toUpperCase(); }

  /* ───── ferraillage ───── */
  const DIAS = [6, 8, 10, 12, 14, 16, 20, 25, 32, 40];
  function ferrData() { try { return W.s.ferr(W.g, W.fp); } catch (e) { console.error(e); return null; } }
  function saveF() { LS.set('coff.f.' + W.id, W.fp); }
  function renderFerr() {
    if (!W.hasF) return;
    const F = ferrData(); if (!F) return;
    $('#cEnr').value = C.f2(F.c);
    let grp = null, h = '<table class="cnt"><thead><tr><th>Rep</th><th>Désignation</th><th>HA</th><th>Esp. / Nb</th><th>Total</th><th style="text-align:right">kg</th></tr></thead><tbody>';
    F.bars.forEach((b) => {
      if (b.grp !== grp) { grp = b.grp; h += `<tr class="g"><td colspan="6">${esc(grp)}</td></tr>`; }
      const ov = W.fp.o[b.rep] || {}, mod = ov.d || ov.esp || ov.n;
      h += `<tr${mod ? ' class="mod"' : ''}><td><span class="rp">${b.rep}</span></td><td class="des" title="${esc(b.des)}">${esc(b.des)}</td>`
        + `<td><select data-r="${b.rep}" data-f="d">${DIAS.map((d) => `<option${d === b.d ? ' selected' : ''}>${d}</option>`).join('')}</select></td>`
        + `<td>${b.esp ? `<input type="number" step="0.01" min="0.05" max="0.50" data-r="${b.rep}" data-f="esp" value="${C.f2(b.esp)}" title="Espacement (m)">` : `<input type="number" step="1" min="1" max="400" data-r="${b.rep}" data-f="n" value="${b.nu}" title="Nombre par élément">`}</td>`
        + `<td>${b.ne > 1 ? b.nu + '×' + b.ne : b.n}</td><td class="kg">${b.kg.toFixed(1)}</td></tr>`;
    });
    $('#cNom').innerHTML = h + '</tbody></table>';
    const tot = F.bars.reduce((a, b) => a + b.kg, 0), vol = F.vol || 0;
    $('#cFTot').innerHTML = `<span>Aciers <b>${C.fmt(tot)} kg</b></span><span>Béton <b>${C.fmt(vol)} m³</b></span><span>Ratio <b>${vol ? Math.round(tot / vol) : '-'} kg/m³</b></span>`;
    $$('#cNom [data-r]').forEach((el) => el.addEventListener('change', () => {
      const r = el.dataset.r, f = el.dataset.f, v = parseFloat(String(el.value).replace(',', '.'));
      W.fp.o[r] = W.fp.o[r] || {}; if (isFinite(v) && v > 0) W.fp.o[r][f] = v; else delete W.fp.o[r][f];
      saveF(); renderFerr();
    }));
    const box = $('#cFLive'), r = box.getBoundingClientRect();
    box.innerHTML = C.viewsSVG(F.views, Math.max(300, r.width - 8), Math.max(200, r.height - 8), 3.0);
  }

  /* ───── saisie ───── */
  function renderFields() {
    const groups = {}; W.s.fields.forEach((f) => { (groups[f.g] = groups[f.g] || []).push(f); });
    $('#cFields').innerHTML = Object.keys(groups).map((gname) => `<div class="cgrp"><div class="cgrp-t">${esc(gname)}</div><div class="cfg">${groups[gname].map((f) =>
      `<label class="cf" data-k="${f.k}" title="${esc(f.label)}${f.hint ? ' — ' + esc(f.hint) : ''}"><span class="cf-l"><b>${esc(f.k)}</b> ${esc(f.label.replace(new RegExp('\\s' + f.k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), ''))}</span><span class="num"><input type="number" inputmode="decimal" data-k="${f.k}" value="${W.g[f.k]}" min="${f.min}" max="${f.max}" step="${f.step}"><span>${esc(f.unit)}</span></span></label>`).join('')}</div></div>`).join('');
    $$('#cFields input').forEach((inp) => {
      inp.addEventListener('input', () => { const f = W.s.fields.find((x) => x.k === inp.dataset.k), v = parseFloat(String(inp.value).replace(',', '.')); if (isFinite(v)) { W.g[f.k] = f.int ? Math.round(v) : v; LS.set('coff.g.' + W.id, W.g); renderLive(); } });
      inp.addEventListener('focus', () => { W.focus = inp.dataset.k; renderSchema(); });
      inp.addEventListener('blur', () => { W.focus = null; renderSchema(); });
    });
  }
  function views() { try { return W.s.views(W.g); } catch (e) { console.error(e); return []; } }
  function renderSchema() {
    const box = $('#cSchema'); if (!box || !W.s) return;
    const vs = W.s.views(defaults(W.s)); if (W.sv >= vs.length) W.sv = 0;
    // vue où figure le paramètre en cours de saisie
    if (W.focus) { const i = vs.findIndex((v) => v.items.some((it) => it.t === 'dim' && it.k === W.focus)); if (i >= 0) W.sv = i; }
    $('#cSchemaTabs').innerHTML = vs.map((v, i) => `<button type="button" class="${i === W.sv ? 'on' : ''}" data-sv="${i}">${esc(v.title)}</button>`).join('');
    const r = box.getBoundingClientRect();
    box.innerHTML = C.viewSVG(vs[W.sv], Math.max(200, r.width), Math.max(140, r.height), 'schema', 3.6, W.focus);
  }
  function renderLive() {
    const box = $('#cLive'); if (!box || !W.s) return;
    const err = W.s.validate ? W.s.validate(W.g) : [];
    const r = box.getBoundingClientRect();
    box.innerHTML = C.viewsSVG(views(), Math.max(300, r.width - 8), Math.max(200, r.height - 8), 3.4);
    $('#cMsg').innerHTML = err.length ? `<span class="cerr">⚠ ${esc(err[0])}${err.length > 1 ? ` (+${err.length - 1})` : ''}</span>` : '<span class="cok">Géométrie cohérente</span>';
    const q = W.s.qty ? W.s.qty(W.g) : [];
    const tot = q.reduce((a, x) => a + x[1], 0);
    $('#cQty').innerHTML = q.map((x) => `<span>${esc(x[0])} <b>${C.fmt(x[1])} m³</b></span>`).join('') + (q.length > 1 ? `<span>Total béton <b>${C.fmt(tot)} m³</b></span>` : '');
  }

  /* ───── plan ───── */
  const FLD = [['mo', 'Maître d\'ouvrage'], ['projet', 'Projet'], ['ouvrage', 'Ouvrage'], ['objet', 'Objet'], ['bet', 'Bureau d\'études'], ['ent', 'Entreprise'], ['num', 'N° de plan'], ['ind', 'Indice'], ['date', 'Date'], ['rev', 'Modification (indice)'], ['etabli', 'Établi par'], ['verifie', 'Vérifié par'], ['approuve', 'Approuvé par']];
  function renderOpts() {
    const o = W.opt;
    const sel = (id, val, opts) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    $('#cOpts').innerHTML = `<div class="copts">`
      + (W.hasF ? `<div class="cseg" id="oKind"><button type="button" data-k="coffrage" class="${W.kind === 'coffrage' ? 'on' : ''}">Coffrage</button><button type="button" data-k="ferraillage" class="${W.kind === 'ferraillage' ? 'on' : ''}">Ferraillage</button></div>` : '')
      + `<label class="cf"><span class="cf-l">Format</span>${sel('oFmt', o.format, [['', 'Auto'], ['A3', 'A3'], ['A2', 'A2'], ['A1', 'A1'], ['A0', 'A0']])}</label>`
      + `<label class="cf"><span class="cf-l">Échelle</span>${sel('oSc', o.scale, [['', 'Auto']].concat(C.SCALES.map((x) => [x, '1/' + x])))}</label>`
      + `<label class="cf"><span class="cf-l">Cartouche A4</span>${sel('oCart', o.cart, [['V', 'Vertical'], ['H', 'Horizontal']])}</label>`
      + `<button type="button" class="btn ghost small" id="oCartB">Cartouche, logos et nota…</button><small class="cinfo" id="cSheetI"></small></div>`;
    const upd = () => { LS.set('coff.opt', W.opt); renderSheet(); };
    $('#oFmt').onchange = (e) => { W.opt.format = e.target.value; upd(); };
    $('#oSc').onchange = (e) => { W.opt.scale = e.target.value; upd(); };
    $('#oCart').onchange = (e) => { W.opt.cart = e.target.value; upd(); };
    $('#oCartB').onclick = openCart;
    $$('#oKind button').forEach((bt) => bt.addEventListener('click', () => { W.kind = bt.dataset.k; renderOpts(); renderSheet(); }));
  }
  function openCart() {
    const m = W.meta, dlg = $('#cCartDlg');
    $('#cCart').innerHTML = `<div class="cfg">${FLD.map(([k, l]) => `<label class="cf${['mo', 'projet', 'objet', 'bet'].includes(k) ? ' wide' : ''}"><span class="cf-l">${esc(l)}</span><input type="text" data-m="${k}" value="${esc(m[k] || '')}"></label>`).join('')}</div>`
      + `<div class="cgrp-t">Logos</div><div class="cfg"><label class="cf"><span class="cf-l">Maître d'ouvrage</span><span class="clogo"><input type="file" accept="image/*" data-logo="mo">${W.logos.mo ? '<button type="button" class="btn ghost small" data-rmlogo="mo">Retirer</button>' : ''}</span></label>`
      + `<label class="cf"><span class="cf-l">Bureau d'études</span><span class="clogo"><input type="file" accept="image/*" data-logo="bet">${W.logos.bet ? '<button type="button" class="btn ghost small" data-rmlogo="bet">Retirer</button>' : ''}</span></label></div>`
      + `<div class="cgrp-t">Nota</div><textarea id="oNota" rows="5">${esc(m.nota || '')}</textarea>`;
    let t = null;
    const saveMeta = () => { const keep = Object.assign({}, W.meta); if (!keep.objetUser) delete keep.objet; LS.set('coff.meta', keep); clearTimeout(t); t = setTimeout(renderSheet, 150); };
    $$('#cCart [data-m]').forEach((inp) => inp.addEventListener('input', () => { W.meta[inp.dataset.m] = inp.value; if (inp.dataset.m === 'objet') W.meta.objetUser = !!inp.value; saveMeta(); }));
    $('#oNota').addEventListener('input', (e) => { W.meta.nota = e.target.value; saveMeta(); });
    $$('#cCart [data-logo]').forEach((inp) => inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = () => { W.logos[inp.dataset.logo] = rd.result; LS.set('coff.logos', W.logos); openCart(); renderSheet(); }; rd.readAsDataURL(f);
    }));
    $$('#cCart [data-rmlogo]').forEach((bt) => bt.addEventListener('click', () => { delete W.logos[bt.dataset.rmlogo]; LS.set('coff.logos', W.logos); openCart(); renderSheet(); }));
    if (!dlg.open) dlg.showModal();
  }
  function sheet() {
    const o = { cart: W.opt.cart || 'V' }; if (W.opt.format) o.format = W.opt.format; if (W.opt.scale) o.scale = +W.opt.scale;
    setObjet();
    return C.sheetSVG(W.s, W.g, W.meta, o, W.logos, W.kind, W.fp);
  }
  function renderSheet() {
    const box = $('#cSheet'); if (!box || !W.s) return;
    const sh = sheet();
    box.innerHTML = sh.svg.replace(/width="[\d.]+mm" height="[\d.]+mm"/, 'width="100%" height="100%" preserveAspectRatio="xMidYMid meet"');
    $('#cSheetI').textContent = (sh.bars ? `${Math.round(sh.bars.reduce((a, b) => a + b.kg, 0))} kg d'aciers · ` : '') + `Échelle 1/${sh.layout.s} · Format ${sh.layout.f} (${sh.FW} × ${sh.FH} mm) · cartouche A4 ${W.opt.cart === 'H' ? 'horizontal' : 'vertical'}${sh.layout.forced ? ' · le contenu dépasse : choisissez un format plus grand ou une échelle plus petite' : ''}`;
  }
  const fileBase = () => ((W.kind === 'ferraillage' ? 'Ferraillage-' : 'Coffrage-') + W.s.name + (W.meta.num ? '-' + W.meta.num : '')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_');
  function exportDXF() {
    const bytes = C.toCP1252(C.dxf(sheet()));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/dxf' })); a.download = fileBase() + '.dxf';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function print() {
    const sh = sheet(), w = window.open('', '_blank');
    if (!w) { alertBox('Autorisez les fenêtres pour ce site afin d\'imprimer le plan.'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(fileBase())}</title><style>@page{size:${sh.FW}mm ${sh.FH}mm;margin:0}html,body{margin:0}svg{display:block;width:${sh.FW}mm;height:${sh.FH}mm}</style></head><body>${sh.svg}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
    w.document.close();
  }
  function alertBox(t) { const m = $('#cMsg'); if (m) m.innerHTML = `<span class="cerr">${esc(t)}</span>`; }

  /* ───── branchements ───── */
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
  let inited = false;
  function init() {
    if (inited || !$('#coff')) return; inited = true;
    $('#cBack').addEventListener('click', close);
    $$('#cTabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.t)));
    $('#cSchemaTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-sv]'); if (b) { W.sv = +b.dataset.sv; W.focus = null; renderSchema(); } });
    $('#cReset').addEventListener('click', () => { W.g = defaults(W.s); LS.set('coff.g.' + W.id, W.g); renderFields(); renderLive(); });
    $('#cToPlan').addEventListener('click', () => { W.kind = 'ferraillage'; setTab('plan'); });
    $('#cToFerr').addEventListener('click', () => setTab(W.hasF ? 'ferr' : 'plan'));
    $('#cFReset').addEventListener('click', () => { W.fp = { o: {} }; saveF(); renderFerr(); });
    $('#cEnr').addEventListener('change', (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (isFinite(v) && v >= 0.015 && v <= 0.15) W.fp.c = v; else delete W.fp.c; saveF(); renderFerr(); });
    $('#cCartX').addEventListener('click', () => $('#cCartDlg').close());
    $('#cDxf').addEventListener('click', exportDXF);
    $('#cPrint').addEventListener('click', print);
    let rt = null; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if ($('#coff').hidden) return; if (W.tab === 'saisie') { renderSchema(); renderLive(); } else if (W.tab === 'ferr') renderFerr(); else renderSheet(); }, 120); });
  }

  window.COFFUI = { open, close };
})();
