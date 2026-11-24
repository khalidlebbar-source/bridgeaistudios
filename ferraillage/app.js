/* BridgeAI Studios — Plans de coffrage & ferraillage : interface (espace de travail). */
(function () {
  'use strict';
  const F = window.FERR;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fr = (v, n) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: n, maximumFractionDigits: n });
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ───── Catalogue ───── */
  /* Croquis en perspective cavalière (inspirés des plans KLE) : face avant, dessus et côté en trois tons. */
  const sv = (d, dy) => { dy = dy || 0; const W = 160 * (100 + dy) / 100; return `<svg viewBox="${((160 - W) / 2).toFixed(1)} ${-dy} ${W.toFixed(1)} ${100 + dy}" fill="none" stroke="currentColor" stroke-width=".9" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${d}</svg>`; };
  const OX = .62, OY = -.42;                                   // direction de fuite (par unité de profondeur)
  const P = (pts) => pts.map((q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' L');
  const face = (pts, op) => `<path d="M${P(pts)}Z" fill="#10131b" stroke="none"/><path d="M${P(pts)}Z" fill="currentColor" fill-opacity="${op}"/>`;
  /* Extrusion d'un profil (liste de points, sens quelconque) sur une profondeur d ; trou optionnel. */
  function X(pts, d, hole, k) { k = k || 1;
    const ox = OX * d, oy = OY * d;
    let ar = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; ar += p[0] * q[1] - q[0] * p[1]; }
    const sg = ar > 0 ? 1 : -1; let out = '';
    const quads = (poly, inner) => { let r = []; for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length]; let nx = (q[1] - p[1]) * sg, ny = -(q[0] - p[0]) * sg; if (inner) { nx = -nx; ny = -ny; }
      const v = nx * ox + ny * oy; if (v <= 1e-6) continue;
      const L = Math.hypot(nx, ny) || 1, top = -ny / L > .5;
      r.push({ z: Math.min(p[1], q[1]), s: face([p, q, [q[0] + ox, q[1] + oy], [p[0] + ox, p[1] + oy]], (top ? .16 : .5) * k) }); }
      return r.sort((u, w) => w.z - u.z).map((u) => u.s).join(''); };
    if (hole) out += quads(hole, true);
    out += quads(pts, false);
    out += hole ? `<path d="M${P(pts)}Z M${P(hole)}Z" fill="#10131b" stroke="none" fill-rule="evenodd"/><path d="M${P(pts)}Z M${P(hole)}Z" fill="currentColor" fill-opacity="${.32 * k}" fill-rule="evenodd"/>` : face(pts, .32 * k);
    return out;
  };
  const B = (x, y, w, h, d, k) => X([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], d, null, k);  // boîte
  /* Cylindre vertical (fût, pieu) */
  const CY = (cx, y1, y2, r) => { const ry = r * .38;
    return `<path d="M${cx - r} ${y1}V${y2}A${r} ${ry} 0 0 0 ${cx + r} ${y2}V${y1}Z" fill="#10131b" stroke="none"/><path d="M${cx - r} ${y1}V${y2}A${r} ${ry} 0 0 0 ${cx + r} ${y2}V${y1}Z" fill="currentColor" fill-opacity=".36"/>`
      + `<path d="M${cx + r * .35} ${y1 + ry * .9}V${y2 + ry * .9}" stroke-width=".5" opacity=".35"/>`
      + `<ellipse cx="${cx}" cy="${y1}" rx="${r}" ry="${ry}" fill="#10131b"/><ellipse cx="${cx}" cy="${y1}" rx="${r}" ry="${ry}" fill="currentColor" fill-opacity=".16"/>`; };
  const G = (x1, x2, y) => { let h = ''; for (let x = x1 + 2; x <= x2; x += 5) h += `M${x} ${y}l-3 4`; return `<path d="M${x1} ${y}H${x2}" stroke-width=".7" opacity=".6"/><path d="${h}" stroke-width=".45" opacity=".4"/>`; };
  /* Poutre VIPP / PPBA (profil commun) et câbles de précontrainte vus sur la face de l'âme */
  const VP = [[22, 30], [82, 30], [82, 35], [58, 38], [54, 42], [54, 74], [62, 79], [62, 92], [42, 92], [42, 79], [50, 74], [50, 42], [46, 38], [22, 35]];
  const CAB = () => { let o = ''; const d = 60;
    [[48, 86], [58, 85], [68, 84]].forEach(([y0, ym], i) => {                     // ancrage (y0) relevé, point bas (ym) en travée
      let pts = []; for (let k = 0; k <= 40; k++) { const t = k / 40, u = t < .35 ? t / .35 : t > .65 ? (1 - t) / .35 : 1;
        pts.push([54 + OX * d * t, y0 + (ym - y0) * (1 - Math.pow(1 - u, 2)) + OY * d * t]); }
      o += `<path d="M${P(pts)}" stroke-width=".7" stroke-dasharray="2.5 1.5" opacity=".9"/>`; });
    [[52, 52], [52, 62], [52, 72], [47, 84], [52, 87], [57, 84]].forEach(([x, y]) => { o += `<circle cx="${x}" cy="${y}" r="1.6" fill="currentColor" fill-opacity=".85" stroke-width=".5"/>`; });
    return o; };
  /* Tête d'OH (d'après le plan OH09 : radier, mur de tête percé de 2 buses, murs en aile évasés à arase inclinée) */
  const TOH = () => {
    const Q = (x, y, z) => [18 + x + OX * z, 92 - y + OY * z];
    const F = (pts, op) => face(pts.map((q) => Q(q[0], q[1], q[2])), op);
    const ring = (cx, cy, r, z) => { const a = []; for (let k = 0; k < 28; k++) { const t = 2 * Math.PI * k / 28; a.push(Q(cx + r * Math.cos(t), cy + r * Math.sin(t), z)); } return a; };
    let o = '';
    // radier
    o += F([[-6, 10, -2], [116, 10, -2], [116, 10, 36], [-6, 10, 36]], .16) + F([[-6, 0, -2], [116, 0, -2], [116, 10, -2], [-6, 10, -2]], .32) + F([[116, 0, -2], [116, 0, 36], [116, 10, 36], [116, 10, -2]], .5);
    // mur de tête : dessus puis face avant percée
    o += F([[14, 48, 30], [96, 48, 30], [96, 48, 36], [14, 48, 36]], .16);
    const fr = [[20, 10, 30], [90, 10, 30], [90, 48, 30], [20, 48, 30]].map((q) => Q(q[0], q[1], q[2]));
    const h1 = ring(42, 27, 11, 30), h2 = ring(68, 27, 11, 30);
    o += `<path d="M${P(fr)}Z M${P(h1)}Z M${P(h2)}Z" fill="#10131b" stroke="none" fill-rule="evenodd"/><path d="M${P(fr)}Z M${P(h1)}Z M${P(h2)}Z" fill="currentColor" fill-opacity=".32" fill-rule="evenodd"/>`;
    [42, 68].forEach((cx) => { o += `<path d="M${P(ring(cx, 27, 11, 30))}Z" fill="currentColor" fill-opacity=".5"/><path d="M${P(ring(cx, 27, 8.6, 30))}Z" fill="#0b0d13" stroke-width=".6"/>`; });
    // murs en aile évasés (arase inclinée)
    o += F([[20, 10, 30], [2, 10, 4], [2, 22, 4], [20, 48, 30]], .5) + F([[20, 48, 30], [2, 22, 4], [-4, 22, 4], [14, 48, 30]], .16) + F([[2, 10, 4], [-4, 10, 4], [-4, 22, 4], [2, 22, 4]], .32);
    o += F([[90, 10, 30], [108, 10, 4], [108, 22, 4], [90, 48, 30]], .42) + F([[90, 48, 30], [108, 22, 4], [114, 22, 4], [96, 48, 30]], .16) + F([[108, 10, 4], [114, 10, 4], [114, 22, 4], [108, 22, 4]], .32);
    return o; };
  /* 4 poutres en I avec entretoises intermédiaires */
  const ENT = () => { const I = (x) => [[x, 34], [x + 18, 34], [x + 18, 37], [x + 11.5, 39], [x + 11.5, 72], [x + 16, 75], [x + 16, 82], [x + 2, 82], [x + 2, 75], [x + 6.5, 72], [x + 6.5, 39], [x, 37]];
    let o = ''; [2, 42, 82, 122].forEach((x, i) => { o += X(I(x), 34); if (i < 3) o += B(x + 11.5 + OX * 14, 44 + OY * 14, 29, 24, 6, 1.9); }); return o + X([[-2, 27], [144, 27], [144, 34], [-2, 34]], 34); };
  const CATALOG = [
    { id: 'murT', pct: 60, name: 'Mur de soutènement', desc: 'Cantilever paramétré comme la feuille de stabilité : fruits, talus amont, TN aval, bêche et semelle en biseau en option.',
      svg: sv(X([[18, 88], [102, 88], [102, 72], [62, 72], [58, 26], [50, 26], [50, 72], [18, 72]], 48) + G(4, 20, 88)) },
    { id: 'dalot', pct: 40, name: 'Dalot cadre fermé', desc: 'Cadre 1 cellule avec goussets : U extérieurs, nappes intérieures, piédroits, goussets et filants.',
      svg: sv(X([[20, 88], [100, 88], [100, 38], [20, 38]], 54, [[36, 78], [30, 72], [30, 54], [36, 48], [84, 48], [90, 54], [90, 72], [84, 78]].reverse()) + G(4, 20, 88)) },
    { name: 'Culée voile', svg: sv(B(16, 74, 72, 18, 56) + X([[38, 74], [38, 44], [32, 44], [32, 36], [52, 36], [52, 18], [57, 18], [57, 28], [62, 28], [62, 36], [56, 42], [48, 42], [48, 74]], 56) + G(2, 16, 92), 12) },
    { name: 'Culée à colonnes', svg: sv(B(14, 80, 76, 14, 40) + [34, 20, 6].map((t) => CY(46 + OX * t, 40 + OY * t, 80 + OY * t, 6)).join('') + X([[30, 40], [30, 30], [52, 30], [52, 12], [57, 12], [57, 22], [62, 22], [62, 30], [56, 40]], 40) + G(2, 14, 94), 14) },
    { name: 'Pile semelle + fûts', svg: sv(B(22, 76, 84, 18, 34) + CY(64 + OX * 17, 34 + OY * 11, 76 + OY * 17, 7) + X([[16, 12], [116, 12], [116, 18], [78, 34], [54, 34], [16, 18]], 22) + B(24, 8, 9, 4, 8) + B(99, 8, 9, 4, 8), 14) },
    { name: 'Chevêtre', svg: sv(CY(66 + OX * 13, 60 + OY * 13, 96 + OY * 13, 10) + X([[8, 22], [124, 22], [124, 40], [84, 62], [48, 62], [8, 40]], 26) + B(18, 18, 10, 4, 8) + B(61, 18, 10, 4, 8) + B(104, 18, 10, 4, 8), 6) },
    { name: 'Dalle de transition', svg: sv(X([[30, 30], [118, 42], [118, 48], [30, 36]], 52) + X([[10, 90], [10, 22], [20, 22], [20, 8], [25, 8], [25, 26], [30, 30], [30, 36], [20, 36], [20, 90]], 52) + G(2, 10, 90), 10) },
    { name: 'Mur en retour', svg: sv(B(14, 18, 18, 72, 44) + X([[32, 18], [122, 18], [122, 30], [58, 84], [32, 84]], 6) + G(2, 14, 90), 8) },
    { name: 'Mur en aile (cadres, portiques)', svg: sv(X([[40, 86], [84, 86], [84, 48], [40, 48]], 50, [[46, 80], [46, 54], [78, 54], [78, 80]].reverse()) + X([[8, 86], [40, 86], [40, 44], [30, 44], [8, 74]], 6) + X([[84, 86], [118, 86], [118, 74], [94, 44], [84, 44]], 6) + G(2, 124, 86), 6) },
    { name: 'Massif sur pieux', svg: sv([40, 66, 92].map((x) => CY(x + OX * 22, 50 + OY * 22, 92 + OY * 22, 4.5)).join('') + [40, 66, 92].map((x) => CY(x, 50, 94, 4.5)).join('') + B(26, 38, 80, 14, 30) + CY(66 + OX * 15, 10, 38 + OY * 15, 10), 4) },
    { name: 'Pieu', svg: sv(G(20, 58, 30) + G(102, 140, 30) + CY(80, 18, 92, 12) + `<path d="M68 30A12 4.6 0 0 0 92 30" stroke-width=".7" stroke-dasharray="2 1.5" opacity=".8"/>`, 4) },
    { name: 'Barrette', svg: sv(G(10, 50, 30) + G(98, 150, 30) + B(54, 22, 34, 70, 14), 4) },
    { name: 'Paroi moulée', svg: sv([12, 42, 72].map((x) => B(x, 30, 30, 62, 8)).join('') + B(12, 22, 90, 8, 12, 1.6), 6) },
    { name: 'Longrine sur file de pieux', svg: sv([22, 48, 74, 100].map((x) => CY(x + OX * 8, 50 + OY * 8, 94 + OY * 8, 5.5)).join('') + B(10, 36, 104, 16, 16), 4) },
    { name: 'Poutres VIPP', svg: sv(X(VP, 60) + CAB(), 8) },
    { name: 'Poutre PPBA', svg: sv(X(VP, 60), 8) },
    { name: 'Hourdis', svg: sv([10, 36, 62, 88].map((x) => X([[x - 2, 52], [x + 18, 52], [x + 18, 55], [x + 11, 58], [x + 11, 78], [x + 16, 83], [x + 16, 92], [x, 92], [x, 83], [x + 5, 78], [x + 5, 58], [x - 2, 55]], 52)).join('') + X([[4, 44], [110, 44], [110, 52], [4, 52]], 52), 4) },
    { name: 'Entretoises', svg: sv(ENT(), 22) },
    { name: 'Corniche', svg: sv(X([[52, 30], [42.0, 30.0], [37.7, 33.5], [34.2, 37.0], [31.4, 40.5], [29.3, 44.0], [28.0, 47.5], [27.5, 51.0], [27.7, 54.5], [28.7, 58.0], [30.4, 61.5], [32.8, 65.0], [36.0, 68.5], [40.0, 72.0], [43, 72], [43, 70], [45, 70], [45, 72], [52, 72]], 56) + X([[52, 40], [130, 40], [130, 54], [52, 54]], 56) + B(54, 30, 18, 10, 56), 4) },
    { name: 'Portique ouvert (PIPO)', svg: sv(B(6, 86, 28, 8, 50) + B(86, 86, 28, 8, 50) + X([[14, 86], [14, 30], [106, 30], [106, 86], [94, 86], [94, 48], [88, 42], [32, 42], [26, 48], [26, 86]], 50) + G(2, 118, 94), 6) },
    { name: 'Mur en U (trémies)', svg: sv(X([[14, 30], [26, 30], [26, 74], [94, 74], [94, 30], [106, 30], [106, 88], [14, 88]], 54) + G(2, 14, 88), 6) },
    { name: "Tête d'ouvrage hydraulique", svg: sv(TOH(), 6) },
  ];
  const DESIGNATION = { murT: 'Mur de soutènement — plot type', dalot: 'Dalot cadre fermé' };

  /* ───── État ───── */
  const S = {
    struct: null, geom: {}, valid: null, validKey: '', params: Object.assign({}, F.DEFAULT_PARAMS),
    designation: '', overrides: {}, res: null, step: 1, maxStep: 1, view: 'coupe', sel: null, fview: 'trans',
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
  /* Cercle d'avancement du développement (comme sur l'accueil) */
  const RING = (p) => `<span class="tile-prog" title="Avancement du développement : ${p} %"><svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true"><circle cx="20" cy="20" r="15" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="4"/>${p > 0 ? `<circle cx="20" cy="20" r="15" fill="none" stroke="#c9a84c" stroke-width="4" stroke-linecap="round" stroke-dasharray="94.25" stroke-dashoffset="${(94.25 * (1 - p / 100)).toFixed(2)}" transform="rotate(-90 20 20)"/>` : ''}<text x="20" y="24" text-anchor="middle" font-size="11" font-family="Inter,Arial,sans-serif" fill="#e8e4da">${p}%</text></svg></span>`;
  /* Rubriques → modèles de coffrage (ferraillage/coffrage-structs.js) */
  const CID = { 'Culée voile': 'culeeV', 'Culée à colonnes': 'culeeC', 'Pile semelle + fûts': 'pile', 'Chevêtre': 'chevetre', 'Dalle de transition': 'dalleT', 'Mur en retour': 'murRetour', 'Mur en aile (cadres, portiques)': 'murAile', 'Massif sur pieux': 'massif', 'Pieu': 'pieu', 'Barrette': 'barrette', 'Paroi moulée': 'paroi', 'Longrine sur file de pieux': 'longrine', 'Poutres VIPP': 'poutreVIPP', 'Poutre PPBA': 'poutrePPBA', 'Hourdis': 'hourdis', 'Entretoises': 'entretoises', 'Corniche': 'corniche', 'Portique ouvert (PIPO)': 'pipo', 'Mur en U (trémies)': 'murU', "Tête d'ouvrage hydraulique": 'teteOH' };
  function renderCatalog() {
    $('#catalog').innerHTML = CATALOG.map((c) => c.id
      ? `<button class="tile on" data-struct="${c.id}">${RING(c.pct || 0)}<span class="schema">${c.svg}</span><span class="tx"><span class="status on">Disponible</span><span class="name">${c.name}</span><span class="desc">${c.desc}</span><span class="go">Dessiner →</span></span></button>`
      : (CID[c.name] && window.COFFUI
        ? `<button class="tile on" data-coff="${CID[c.name]}">${RING(c.pct == null ? 55 : c.pct)}<span class="schema">${c.svg}</span><span class="tx"><span class="status on">Coffrage</span><span class="name">${c.name}</span><span class="go">Coffrage + ferraillage →</span></span></button>`
        : `<div class="tile dev" aria-disabled="true">${RING(c.pct || 0)}<span class="status">Bientôt</span><span class="schema">${c.svg}</span><span class="name">${c.name}</span></div>`)).join('');
    $$('#catalog [data-struct]').forEach((b) => b.addEventListener('click', () => selectStruct(b.dataset.struct)));
    $$('#catalog [data-coff]').forEach((b) => b.addEventListener('click', () => window.COFFUI.open(b.dataset.coff, { back: () => goStep(1) })));
  }
  /* Mur et dalot : plan de coffrage à partir de la géométrie saisie dans leur module */
  function openPlanCoffrage() {
    readForm();
    const g = {}; Object.keys(S.geom).forEach((k) => { if (typeof S.geom[k] === 'number' && isFinite(S.geom[k])) g[k] = S.geom[k]; });
    window.COFFUI.open(S.struct, { g, tab: 'plan', back: () => goStep(S.step || 2) });
  }
  document.addEventListener('click', (e) => { if (e.target.closest('#btnPlanC')) openPlanCoffrage(); });

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
    { k: 'fermeture', label: 'Fermeture de la semelle', type: 'select', opts: [['U', 'U de fermeture (5-8)'], ['retours', 'Nappes à retours']] },
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
        <li>Numérotation KLE (piles, culées) : semelle 1 à 9 — 1 nappe inférieure transversale, 2 filants inférieurs, 3 nappe supérieure transversale, 4 filants supérieurs, 5 U de fermeture des abouts (coupe transversale, ×2), 6 U de fermeture des joints du plot (coupe longitudinale, ×2), 7 répartition des 5, 8 répartition des 6, 9 maintien ; voile à partir de 10 ; bêche juste après le voile.</li>
        <li>Fermeture de la semelle : ${p.fermeture === 'retours' ? 'nappes à retours (1 et 3 en U, filants 2 et 4 à retours aux joints ; repères 5 à 8 non utilisés)' : 'U de fermeture — nappes 1, 3 et filants 2, 4 droits arrêtés contre l’âme des U 5 / U 6 ; branches des U en recouvrement ' + p.recouv + 'Ø (plafonné à la demi-largeur / demi-longueur) ; répartitions 7, 8 aux positions intermédiaires entre les branches, e ≤ 0,15 (aucune si la place manque)'}.</li>
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
    drawFerr();
    renderKpis(); renderTable(); renderRecap();
    if (S.sel && !res.bars.some((b) => b.id === S.sel)) S.sel = null;
    applySel(false);
    $('#st3').textContent = `${fr(res.recap.total, 1)} kg`;
  }

  /* Coupe transversale ou coupe longitudinale A-A (mur) dans le panneau de dessin. */
  const hasLongi = () => S.struct === 'murT' || S.struct === 'dalot';
  const inView = (id, v) => { const b = S.res.bars.find((x) => x.id === id); if (!b) return false; return v === 'longi' ? !!b.longi : !!(b.place && (b.place.items || b.place.dots)); };
  function drawFerr() {
    const res = S.res, el = $('#v-ferr'), [W, H] = boxOf(el);
    if (!hasLongi()) S.fview = 'trans';
    $('#fviewSeg').style.display = hasLongi() ? '' : 'none';
    $$('#fviewSeg button').forEach((b) => b.classList.toggle('on', b.dataset.fv === S.fview));
    el.innerHTML = S.fview === 'longi'
      ? F.fitRender((u) => F.longiScene(S.struct, res.geom, res.bars, res.params, u), W, Math.min(H, W * 0.55), { label: 'Coupe longitudinale A-A de la semelle' })
      : F.fitRender((u) => F.ferraillageScene(S.struct, res.geom, res.bars, res.params, u), W, H, { label: 'Coupe transversale ferraillée' });
  }
  $('#fviewSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-fv]'); if (!b) return; S.fview = b.dataset.fv; drawFerr(); applySel(false); });

  function renderKpis() {
    const r = S.res, vol = volume(r.geom) * Math.max(1, r.params.blocs);
    $('#kpis').innerHTML = `
      <div class="kpi"><small>Aciers</small><b>${fr(r.recap.total, 1)}<i>kg</i></b></div>
      <div class="kpi"><small>Béton</small><b>${fr(vol, 2)}<i>m³</i></b></div>
      <div class="kpi"><small>Ratio</small><b>${fr(r.recap.total / vol, 0)}<i>kg/m³</i></b></div>
      <div class="kpi"><small>Repères</small><b>${r.bars.length}<i>· ${fr(r.recap.longueur, 0)} m</i></b></div>`;
  }

  const colorOf = (barId) => { const i = S.res.bars.findIndex((b) => b.id === barId); return F.barColor(S.res.bars[i], i); };
  const croquisFor = (row, w, h) => F.croquisSVG(row.shape, colorOf(row.barId), w, h);

  /* Diamètre moyen ADFER : racine de la moyenne des Ø² pondérée par les longueurs */
  const dMoy = (rec) => { let L = 0, D2 = 0; rec.lignes.forEach((l) => { L += l.longueur; D2 += l.d * l.d * l.longueur; }); return L > 0 ? Math.sqrt(D2 / L) : 0; };

  /* Nomenclature au format des plans ADFER de KLE (colonnes, intitulés et pied identiques). */
  function renderTable() {
    const r = S.res;
    $('#nom-sub').textContent = `${r.rows.length} lignes · ${r.params.norme}`;
    const head = `<thead><tr><th colspan="12" class="nt">Nomenclature générale des aciers .</th></tr>
      <tr><th rowspan="2">N°</th><th rowspan="2" class="sm">TYPE</th><th rowspan="2">Ø</th><th colspan="3">Nombre</th><th rowspan="2">Esp</th><th rowspan="2">Long.<br>Unitaire</th><th rowspan="2" class="big">Façonnage</th><th rowspan="2" class="sm">Mandrin<br>(cm)</th><th rowspan="2">Long.<br>TOTALE</th><th rowspan="2" class="sm vt">Indice</th></tr>
      <tr><th class="xs">Par Elément</th><th class="xs">d'éléments</th><th class="xs">Total</th></tr></thead>`;
    const body = r.rows.map((row) => {
      const first = !row.suffix || row.suffix === 'a', dens = row.kind === 'densite';
      const bends = (row.shape.segs || []).length > 1 || (row.shape.hooks || []).some((k) => k);
      const dSel = first
        ? `<div class="num"><select data-d="${row.barId}" aria-label="Diamètre repère ${row.barId}">${F.DIAMS.map((d) => `<option value="${d}"${d === row.d ? ' selected' : ''}>${d}</option>`).join('')}</select></div>`
        : `<span>${row.d}</span>`;
      const esp = first
        ? `<div class="num"><input type="number" data-esp="${row.barId}" value="${dens ? row.esp : row.esp.toFixed(3)}" step="${dens ? 1 : 0.01}" min="${dens ? 1 : 0.05}" aria-label="${dens ? 'Densité' : 'Espacement'} repère ${row.barId}"><span>${dens ? '/m²' : 'm'}</span></div>`
        : `<span>${dens ? '' : row.esp.toFixed(3)}</span>`;
      return `<tr data-bar="${row.barId}" title="${esc(row.role + (row.split ? ' — découpe avec recouvrement' : ''))}">
        <td class="rep">${row.id}<i style="background:${colorOf(row.barId)}"></i></td><td>${row.type}</td><td>${dSel}</td>
        <td>${row.n}</td><td>${(row.mult || 1) * (row.nbElem || 1)}</td><td>${row.total}</td>
        <td>${esp}</td><td>${row.L.toFixed(3)}${dens ? '*' : ''}${row.tooLong ? '<span class="sub" style="color:var(--danger)">&gt; Lmax</span>' : ''}</td>
        <td class="fac"><div class="fac-in">${row.code ? `<span class="code" title="Code de façonnage">${row.code}</span>` : ''}${croquisFor(row, 124, 40)}${first ? `<button type="button" class="ico" data-adj="${row.barId}" title="Ajuster la barre ${row.barId}" aria-label="Ajuster la barre ${row.barId}">✎</button>` : '<span style="width:28px"></span>'}</div></td>
        <td class="sm">${bends ? (row.D * 100).toFixed(1) : ''}</td><td>${row.Ltot.toFixed(3)}</td><td class="sm">1</td></tr>`;
    }).join('');
    const foot = `<tfoot><tr><td colspan="6" class="lm">*&nbsp; : LONGUEUR MOYENNE</td><td colspan="6" class="dm">Diamètre moyen : ${dMoy(r.recap).toFixed(1)}</td></tr></tfoot>`;
    $('#nomenc').innerHTML = head + '<tbody>' + body + '</tbody>' + foot;
  }

  /* Récapitulatif des aciers au format ADFER : DIAMETRE / MASSE (kg/ml) / LONGUEUR / POIDS, D.MOY et TOTAL. */
  function renderRecap() {
    const L = S.res.recap.lignes, R = S.res.recap, v = (l, x) => (l.masse ? x : '-');
    $('#recap').innerHTML = `<tr><th colspan="${L.length + 3}" class="nt">RECAPITULATIF DES ACIERS</th></tr>
      <tr><th>DIAMETRE</th>${L.map((l) => `<th>HA${l.d}</th>`).join('')}<th>HA-</th><th class="tot">D.MOY(mm)</th></tr>
      <tr><td>MASSE<br>(kg/ml)</td>${L.map((l) => `<td>${l.ml.toFixed(3)}</td>`).join('')}<td>-</td><td class="tot">${dMoy(R).toFixed(2)}</td></tr>
      <tr><td>LONGUEUR<br>(m)</td>${L.map((l) => `<td class="${l.masse ? '' : 'z'}">${v(l, l.longueur.toFixed(1))}</td>`).join('')}<td class="z">-</td><td class="tot">TOTAL(kg)</td></tr>
      <tr><td>POIDS<br>(kg)</td>${L.map((l) => `<td class="${l.masse ? '' : 'z'}">${v(l, l.masse.toFixed(1))}</td>`).join('')}<td class="z">-</td><td class="tot">${R.total.toFixed(1)}</td></tr>`;
  }

  /* ───── Surbrillance d'une barre (coupe ⇄ nomenclature) ───── */
  function applySel(scroll) {
    // barre absente de la vue affichée (ex. 6, 8 en coupe transversale) : on bascule sur l'autre coupe
    if (S.sel && hasLongi() && !inView(S.sel, S.fview)) { const o = S.fview === 'longi' ? 'trans' : 'longi'; if (inView(S.sel, o)) { S.fview = o; drawFerr(); } }
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
      ${hasLongi() ? `<div class="p-views"><figure><figcaption>${S.struct === 'dalot' ? 'Coupe longitudinale A-A (radier et traverse)' : 'Coupe longitudinale A-A de la semelle'}</figcaption>${F.fitRender((u) => F.longiScene(S.struct, g, r.bars, p, u), 1000, S.struct === 'dalot' ? 330 : 150)}</figure></div>` : ''}
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
