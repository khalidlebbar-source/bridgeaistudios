/* Outils de calculs des ponts — utilitaires communs (navigateur et node).
 * Chaque module de calcul est un fichier séparé exporté en CommonJS pour les tests
 * (node tools/test-outils.js) et attaché à window.BA.<module> dans le navigateur.
 * Ce fichier ne contient que de l'interface : saisie, tableaux, courbes, note PDF, sauvegarde. */
(function (root) {
  'use strict';
  const BA = root.BA || (root.BA = {});

  /* ── nombres ── */
  const fmt = (x, d = 2) => {
    if (x === null || x === undefined || x === '' || Number.isNaN(+x)) return '—';
    if (!Number.isFinite(+x)) return '∞';
    const v = +x, s = Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v;
    return s.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  const num = (v, def = 0) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : def; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  BA.fmt = fmt; BA.num = num; BA.esc = esc;

  if (typeof document === 'undefined') { if (typeof module !== 'undefined') module.exports = BA; return; }

  /* ── habillage : menu, en-tête, pied ── */
  const LOGO = '<svg viewBox="0 0 120 120" width="26" height="26" aria-hidden="true" style="display:inline-block;vertical-align:-5px;margin-right:9px;overflow:visible"><path d="M44 100 L60 14 L76 100" fill="none" stroke="#c9a84c" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="58" y1="28" x2="12" y2="76"/><line x1="57" y1="40" x2="28" y2="76"/><line x1="62" y1="28" x2="108" y2="76"/><line x1="63" y1="40" x2="92" y2="76"/></g><line x1="6" y1="78" x2="114" y2="78" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>';
  BA.chrome = function (o) {
    const base = o.base || '../';
    const nav = document.createElement('nav');
    nav.className = 'ba-nav';
    nav.innerHTML = `<div class="nav-inner"><a href="${base}index.html" class="nav-logo">${LOGO}Bridge<span>AI</span> Studios</a>
      <ul class="nav-links">
        <li><a href="${base}outils-ponts.html"${o.hub ? ' class="active"' : ''}>Outils de calculs des ponts</a></li>
        <li><a href="${base}ponts-types.html">Ponts types</a></li>
        <li><a href="${base}plans-ferraillage.html">Plans coffrage &amp; ferraillage</a></li>
        <li><a href="${base}handbag.html">HandBag</a></li>
        <li><a href="${base}bibliotheque.html">Bibliothèque</a></li>
      </ul>
      <a href="${base}${o.hub ? 'index.html' : 'outils-ponts.html'}" class="nav-back">← ${o.hub ? 'Accueil' : 'Tous les outils'}</a></div>`;
    document.body.prepend(nav);
    const foot = document.createElement('footer');
    foot.className = 'ba-foot';
    foot.innerHTML = `<div class="footer-bottom"><p>Bridge<span style="color:#c9a84c">AI</span> Studios · Outils de calculs des ponts · résultats à vérifier par un ingénieur qualifié avant tout usage contractuel</p>
      <p><a href="mailto:contact@bridgeaistudios.com">contact@bridgeaistudios.com</a> · <a href="${base}mentions-legales.html">Mentions légales</a> · © 2026 BridgeAI Studios</p></div>`;
    document.body.append(foot);
  };

  /* ── formulaires décrits par un schéma ──
   * champ : {id, label, unit, type:'num'|'sel'|'chk'|'txt'|'area', def, options:[[val,label]], help, wide, step}
   * Les valeurs sont relues par BA.read(schema, prefixe). */
  BA.form = function (el, fields, pre = '', values = {}) {
    el.innerHTML = fields.map((f) => {
      const id = pre + f.id, v = values[f.id] !== undefined ? values[f.id] : f.def;
      const lab = `<label for="${id}"><span>${f.label}</span>${f.unit ? `<span class="u">${f.unit}</span>` : ''}</label>`;
      const help = f.help ? `<div class="help">${f.help}</div>` : '';
      const cls = 'field' + (f.wide ? ' wide' : '') + (f.type === 'chk' ? ' chk' : '');
      if (f.type === 'sel') return `<div class="${cls}">${lab}<select id="${id}">${f.options.map(([k, t]) => `<option value="${k}"${String(k) === String(v) ? ' selected' : ''}>${t}</option>`).join('')}</select>${help}</div>`;
      if (f.type === 'chk') return `<div class="${cls}"><input type="checkbox" id="${id}"${v ? ' checked' : ''}><label for="${id}">${f.label}</label>${help}</div>`;
      if (f.type === 'area') return `<div class="field wide">${lab}<textarea id="${id}" spellcheck="false">${esc(v ?? '')}</textarea>${help}</div>`;
      if (f.type === 'txt') return `<div class="${cls}">${lab}<input type="text" id="${id}" value="${esc(v ?? '')}">${help}</div>`;
      return `<div class="${cls}">${lab}<input type="number" inputmode="decimal" step="${f.step || 'any'}" id="${id}" value="${v ?? ''}">${help}</div>`;
    }).join('');
  };
  BA.read = function (fields, pre = '') {
    const o = {};
    for (const f of fields) {
      const e = document.getElementById(pre + f.id);
      if (!e) continue;
      o[f.id] = f.type === 'chk' ? e.checked : f.type === 'sel' ? (isNaN(+e.value) || e.value === '' ? e.value : +e.value) : (f.type === 'txt' || f.type === 'area') ? e.value : num(e.value, NaN);
    }
    return o;
  };
  BA.write = function (fields, values, pre = '') {
    for (const f of fields) {
      const e = document.getElementById(pre + f.id);
      if (!e || values[f.id] === undefined) continue;
      if (f.type === 'chk') e.checked = !!values[f.id]; else e.value = values[f.id];
    }
  };

  /* ── lignes répétables (appuis, charges, nappes d'aciers…) ──
   * cols : [{id, label, def, type:'num'|'sel', options, w}] */
  BA.rows = function (el, cols, data, opts = {}) {
    const draw = () => {
      el.innerHTML = `<table class="grid-in"><thead><tr>${cols.map((c) => `<th style="${c.w ? 'width:' + c.w : ''}">${c.label}</th>`).join('')}<th></th></tr></thead><tbody>${data.map((r, i) => `<tr>${cols.map((c) => `<td>${c.type === 'sel'
        ? `<select data-i="${i}" data-c="${c.id}">${c.options.map(([k, t]) => `<option value="${k}"${String(k) === String(r[c.id]) ? ' selected' : ''}>${t}</option>`).join('')}</select>`
        : `<input type="${c.type === 'txt' ? 'text' : 'number'}" step="any" data-i="${i}" data-c="${c.id}" value="${r[c.id] ?? ''}">`}</td>`).join('')}<td><button class="del" data-del="${i}" title="Supprimer">×</button></td></tr>`).join('')}</tbody></table>
        <button class="btn sm" data-add style="margin-top:6px">+ ${opts.addLabel || 'Ajouter une ligne'}</button>`;
    };
    el.addEventListener('input', (e) => {
      const t = e.target, i = t.dataset.i, c = t.dataset.c;
      if (i === undefined) return;
      const col = cols.find((x) => x.id === c);
      data[+i][c] = col && col.type === 'txt' ? t.value : (col && col.type === 'sel' && isNaN(+t.value) ? t.value : num(t.value, NaN));
      opts.onChange && opts.onChange(data);
    });
    el.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') e.target.dispatchEvent(new Event('input', { bubbles: true })); });
    el.addEventListener('click', (e) => {
      if (e.target.dataset.del !== undefined) { data.splice(+e.target.dataset.del, 1); draw(); opts.onChange && opts.onChange(data); }
      if (e.target.dataset.add !== undefined) { const r = {}; cols.forEach((c) => (r[c.id] = c.def)); if (data.length) Object.assign(r, data[data.length - 1]); data.push(r); draw(); opts.onChange && opts.onChange(data); }
    });
    draw();
    return { data, redraw: draw, set: (d) => { data.length = 0; d.forEach((x) => data.push(x)); draw(); } };
  };

  /* ── sorties ── */
  BA.kpis = (items) => `<div class="kpis">${items.map((k) => `<div class="kpi${k.hi ? ' hi' : ''}"><div class="l">${k.l}</div><div class="v ${k.cls || ''}">${k.v}${k.u ? `<small>${k.u}</small>` : ''}</div>${k.n ? `<div class="n">${k.n}</div>` : ''}</div>`).join('')}</div>`;
  BA.table = (heads, rows, opts = {}) => `<div class="tbl-wrap"><table class="res">${opts.caption ? `<caption style="text-align:left;font-size:11px;color:var(--ink3);padding-bottom:4px">${opts.caption}</caption>` : ''}<thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td${typeof c === 'string' && /^[A-Za-zÀ-ÿ]/.test(c) && opts.leftText ? ' class="l"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  BA.verdict = (ok, txtOk = 'Vérifié', txtKo = 'Non vérifié') => `<span class="tag ${ok ? 'ok' : 'ko'}">${ok ? txtOk : txtKo}</span>`;
  BA.card = (title, html, sub = '') => `<div class="card"><div class="card-title"><span>${title}</span>${sub ? `<small>${sub}</small>` : ''}</div>${html}</div>`;

  /* ── courbe de sollicitation (M, V, flèche…) en SVG, sans dépendance ──
   * series : [{x:[], y:[], label, color, fill}] ; opts : {invert (moments positifs vers le bas), unit, xUnit, h} */
  BA.chart = function (series, opts = {}) {
    const W = opts.w || 760, H = opts.h || 220, L = 52, R = 14, T = 14, B = 26;
    const xs = series.flatMap((s) => s.x), ys = series.flatMap((s) => s.y).filter(Number.isFinite);
    if (!xs.length || !ys.length) return '';
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(0, ...ys), y1 = Math.max(0, ...ys);
    if (x1 === x0) x1 = x0 + 1; if (y1 === y0) { y1 += 1; y0 -= 1; }
    const pad = (y1 - y0) * 0.08; y0 -= pad; y1 += pad;
    const inv = !!opts.invert;
    const X = (x) => L + (x - x0) / (x1 - x0) * (W - L - R);
    const Y = (y) => inv ? T + (y - y0) / (y1 - y0) * (H - T - B) : H - B - (y - y0) / (y1 - y0) * (H - T - B);
    const ticks = (a, b, n) => { const st = Math.pow(10, Math.floor(Math.log10((b - a) / n))); const m = [1, 2, 5, 10].find((k) => (b - a) / (k * st) <= n) * st; const out = []; for (let v = Math.ceil(a / m) * m; v <= b + 1e-9; v += m) out.push(+v.toFixed(10)); return out; };
    const pal = ['#a8842a', '#0f8f7b', '#2d6be4', '#c0392b', '#7b5ea7'];
    let g = '';
    for (const t of ticks(y0, y1, 5)) g += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="rgba(20,23,31,.07)"/><text x="${L - 6}" y="${Y(t) + 3}" text-anchor="end">${fmt(t, Math.abs(t) < 10 && t % 1 ? 2 : 0)}</text>`;
    for (const t of ticks(x0, x1, 10)) g += `<text x="${X(t)}" y="${H - 8}" text-anchor="middle">${fmt(t, t % 1 ? 1 : 0)}</text>`;
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#14171f" stroke-width="1"/>`;
    series.forEach((s, i) => {
      const c = s.color || pal[i % pal.length];
      const pts = s.x.map((x, k) => `${X(x).toFixed(1)},${Y(s.y[k]).toFixed(1)}`).join(' ');
      if (s.fill !== false) g += `<polygon points="${X(s.x[0])},${Y(0)} ${pts} ${X(s.x[s.x.length - 1])},${Y(0)}" fill="${c}" opacity=".10"/>`;
      g += `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round"/>`;
    });
    const leg = series.filter((s) => s.label).map((s, i) => `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px"><i style="width:14px;height:2px;background:${s.color || pal[i % pal.length]};display:inline-block"></i>${s.label}</span>`).join('');
    return `<div style="font-size:11px;color:var(--ink3);margin-bottom:4px">${opts.title ? `<b style="font-weight:500;color:var(--ink2)">${opts.title}</b> ` : ''}${opts.unit ? `(${opts.unit})` : ''} ${leg}</div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
  };

  /* ── sauvegarde : localStorage + fichier JSON ── */
  BA.store = {
    save(key, obj) { try { localStorage.setItem('ba-outils-' + key, JSON.stringify(obj)); } catch (e) { /* stockage indisponible */ } },
    load(key) { try { const s = localStorage.getItem('ba-outils-' + key); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    download(name, obj) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
      a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    pick(accept, cb) {
      const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
      i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result, f.name); r.readAsText(f, accept.includes('.don') || accept.includes('.sps') ? 'windows-1252' : 'utf-8'); };
      i.click();
    },
  };

  /* ── note de calcul : ouvre une fenêtre imprimable (Enregistrer en PDF) ──
   * o : {titre, code, regl, projet, sections:[{titre, html}]} */
  BA.note = function (o) {
    const w = window.open('', '_blank');
    if (!w) { alert('Autorisez les fenêtres surgissantes pour générer la note de calcul.'); return; }
    const date = new Date().toLocaleDateString('fr-FR');
    w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Note de calcul — ${esc(o.titre)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Outfit:wght@300;400;500&display=swap" rel="stylesheet">
<style>@page{size:A4;margin:16mm 14mm 18mm}body{font-family:'Outfit',sans-serif;font-weight:300;color:#14171f;font-size:11px;line-height:1.5;margin:0}
header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5px solid #a8842a;padding-bottom:8px;margin-bottom:14px}
.brand{font-family:'Cormorant Garamond',serif;font-size:19px}.brand span{color:#a8842a}
.meta{text-align:right;font-size:10px;color:#6f7484}h1{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:24px;margin:0 0 2px}
h2{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#a8842a;border-bottom:1px solid #e8d5a0;padding-bottom:3px;margin:16px 0 8px;break-after:avoid}
table{width:100%;border-collapse:collapse;font-size:10px;font-variant-numeric:tabular-nums;margin:4px 0 8px}th{font-weight:500;text-align:right;border-bottom:1px solid #e8d5a0;padding:3px 5px;background:#fdfbf6}td{text-align:right;padding:2px 5px;border-bottom:1px solid #eee}th:first-child,td:first-child{text-align:left}
tr{break-inside:avoid}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.kpi{border:1px solid #ddd;border-radius:6px;padding:5px 7px}.kpi .l{font-size:8px;text-transform:uppercase;color:#6f7484;letter-spacing:.06em}.kpi .v{font-family:'Cormorant Garamond',serif;font-size:17px}.kpi .v small{font-size:9px;color:#6f7484}.kpi .n{font-size:8.5px;color:#6f7484}
.ok{color:#0f8f7b}.ko{color:#c0392b}.warn{color:#c27a12}.tag{border:1px solid currentColor;border-radius:8px;padding:0 6px;font-size:9px}
.formula{font-family:Consolas,monospace;font-size:9.5px;background:#fbfaf7;border:1px solid #eee;border-radius:5px;padding:5px 7px;white-space:pre-wrap}
svg{max-width:100%;height:auto}svg text{font-family:'Outfit',sans-serif;font-size:10px;fill:#6f7484}.tbl-wrap{overflow:visible}
footer{position:fixed;bottom:-12mm;left:0;right:0;font-size:8.5px;color:#9aa0ac;display:flex;justify-content:space-between}
.no-print{display:none}</style></head><body>
<header><div><div class="brand">Bridge<span>AI</span> Studios</div><h1>${esc(o.titre)}</h1><div style="font-size:10.5px;color:#6f7484">${esc(o.regl || '')}</div></div>
<div class="meta">${o.projet ? esc(o.projet) + '<br>' : ''}${esc(o.code || '')}<br>${date}</div></header>
${o.sections.map((s) => `<h2>${s.titre}</h2>${s.html}`).join('')}
<footer><span>BridgeAI Studios — Outils de calculs des ponts — ${esc(o.code || '')}</span><span>Note générée le ${date} · à vérifier par un ingénieur qualifié</span></footer>
<script>document.fonts&&document.fonts.ready.then(()=>setTimeout(()=>print(),250))<\/script></body></html>`);
    w.document.close();
  };
})(typeof window !== 'undefined' ? window : globalThis);
