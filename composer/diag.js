/* BridgeAI Studios — Bridge Composer : diagrammes de résultats (moments, efforts tranchants, contraintes, réactions).
 * diagSVG(M, kind, { width, height, id }) → SVG ; kind : 'M' | 'V' | 'S' | 'R'.
 * Convention : moments positifs (fibre inférieure tendue) dessinés sous l'axe, comme sur les notes françaises ;
 * contraintes de compression positives. Les attributs data-* du groupe de tracé permettent le curseur interactif.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.COMP = Object.assign(root.COMP || {}, api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const f0 = (v) => (Math.round(v) || 0).toLocaleString('fr-FR');
  const f1 = (v) => ((Math.abs(+v) < 0.05) ? 0 : +v).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function niceStep(span, n) {
    const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  }
  const C = { eluMax: '#1c5bd9', eluMin: '#d6336c', els: '#495057', g: '#111', fillP: 'rgba(28,91,217,.10)', fillN: 'rgba(214,51,108,.10)' };

  const DEF = {
    M: { t: 'Enveloppe des moments fléchissants', u: 'kN·m', down: true,
      series: [['MeluMax', 'ELU max', C.eluMax, 1.8], ['MeluMin', 'ELU min', C.eluMin, 1.8], ['MelsMax', 'ELS car. max', C.els, 1, '5 3'], ['MelsMin', 'ELS car. min', C.els, 1, '5 3'], ['MG', 'G', C.g, 1.1, '2 2']],
      fill: ['MeluMax', 'MeluMin'], note: 'M > 0 : fibre inférieure tendue (tracé sous l’axe)' },
    V: { t: 'Enveloppe des efforts tranchants', u: 'kN', down: false,
      series: [['VeluMax', 'ELU max', C.eluMax, 1.6], ['VeluMin', 'ELU min', C.eluMin, 1.6], ['VG', 'G', C.g, 1.1, '2 2']], fill: ['VeluMax', 'VeluMin'] },
    S: { t: 'Contraintes normales — ELS caractéristique, section brute sans précontrainte', u: 'MPa', down: false,
      series: [['sSupMax', 'σ sup max', '#2b8a3e', 1.6], ['sSupMin', 'σ sup min', '#2b8a3e', 1, '5 3'], ['sInfMax', 'σ inf max', '#e8590c', 1, '5 3'], ['sInfMin', 'σ inf min', '#e8590c', 1.6], ['sInfG', 'σ inf (G)', C.g, 1, '2 2']],
      fill: null, note: 'Compression positive' },
  };

  function diagSVG(M, kind, opt) {
    opt = opt || {};
    const W = opt.width || 900, H = opt.height || 420, id = opt.id || 'dg', an = M.an;
    if (!an) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><text x="20" y="30">Analyse indisponible</text></svg>`;
    const L = M.Ltot, xsSup = M.xs, padL = 70, padR = 24, padT = 58, padB = 54;
    const X = (x) => padL + (x / L) * (W - padL - padR);
    let out = '';
    if (kind === 'R') return reactions(M, W, H, opt);
    const D = DEF[kind], pts = an.pts;
    let lo = 0, hi = 0;
    D.series.forEach(([k]) => pts.forEach((p) => { lo = Math.min(lo, p[k]); hi = Math.max(hi, p[k]); }));
    if (hi - lo < 1e-9) hi = lo + 1;
    const padV = (hi - lo) * 0.10; lo -= padV; hi += padV;
    const Y = D.down ? (v) => padT + (v - lo) / (hi - lo) * (H - padT - padB) : (v) => H - padB - (v - lo) / (hi - lo) * (H - padT - padB);
    // grille et graduations
    const st = niceStep(hi - lo, 6);
    for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) {
      const y = Y(v);
      out += `<path d="M${padL} ${y.toFixed(1)}H${W - padR}" stroke="${Math.abs(v) < st / 1e3 ? '#333' : '#e6e8ec'}" stroke-width="${Math.abs(v) < st / 1e3 ? 1 : .8}"/>`
        + `<text x="${padL - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" class="ax">${f0(v)}</text>`;
    }
    // lignes d'appui
    xsSup.forEach((x, j) => {
      const s = M.supports[j], xx = X(x).toFixed(1), y0 = Y(0);
      out += `<path d="M${xx} ${padT - 8}V${H - padB}" stroke="#d6336c" stroke-width=".6" stroke-dasharray="8 3 2 3"/>`
        + `<path d="M${xx} ${y0.toFixed(1)}l-6 9h12z" fill="#fff" stroke="#333" stroke-width=".9"/>`
        + `<text x="${xx}" y="${H - padB + 16}" text-anchor="middle" class="sid">${s.id}</text>`;
    });
    // remplissage entre enveloppes ELU
    const groups = [...new Set(pts.map((p) => p.gi))];
    const path = (k, gi) => pts.filter((p) => p.gi === gi).map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p[k]).toFixed(1)).join('');
    if (D.fill) groups.forEach((gi) => {
      const ps = pts.filter((p) => p.gi === gi), y0 = Y(0).toFixed(1);
      [[D.fill[0], C.fillP], [D.fill[1], C.fillN]].forEach(([k, col]) => {
        out += `<path d="M${X(ps[0].x).toFixed(1)} ${y0}` + ps.map((p) => 'L' + X(p.x).toFixed(1) + ' ' + Y(p[k]).toFixed(1)).join('') + `L${X(ps[ps.length - 1].x).toFixed(1)} ${y0}Z" fill="${col}"/>`;
      });
    });
    D.series.forEach(([k, , col, w, da]) => groups.forEach((gi) => { out += `<path d="${path(k, gi)}" fill="none" stroke="${col}" stroke-width="${w}"${da ? ` stroke-dasharray="${da}"` : ''}/>`; }));
    // étiquettes des extremums (ELU) par travée et sur appuis
    const lab = (x, v, col, below) => {
      const y = Y(v), dy = (below ? 14 : -7);
      return `<circle cx="${X(x).toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${col}"/><text x="${X(x).toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="middle" class="vl" fill="${col}">${kind === 'S' ? f1(v) : f0(v)}</text>`;
    };
    const k1 = D.series[0][0], k2 = D.series[kind === 'S' ? 3 : 1][0];
    for (let i = 0; i < xsSup.length - 1; i++) {
      const ps = pts.filter((p) => p.x > xsSup[i] + 1e-6 && p.x < xsSup[i + 1] - 1e-6);
      if (!ps.length) continue;
      const pmx = ps.reduce((a, p) => (p[k1] > a[k1] ? p : a)), pmn = ps.reduce((a, p) => (p[k2] < a[k2] ? p : a));
      if (kind === 'M') out += lab(pmx.x, pmx[k1], C.eluMax, true);
      else if (kind === 'S') { out += lab(pmn.x, pmn[k2], '#e8590c', true); out += lab(pmx.x, pmx[k1], '#2b8a3e', false); }
    }
    if (kind === 'M' && M.cont) xsSup.slice(1, -1).forEach((x) => {
      const p = pts.find((q) => Math.abs(q.x - x) < 1e-6); if (p) out += lab(p.x, p.MeluMin, C.eluMin, false);
    });
    if (kind === 'V') xsSup.forEach((x) => {
      const ps = pts.filter((p) => Math.abs(p.x - x) < 1.0);
      if (!ps.length) return;
      const p = ps.reduce((a, q) => (Math.max(Math.abs(q.VeluMax), Math.abs(q.VeluMin)) > Math.max(Math.abs(a.VeluMax), Math.abs(a.VeluMin)) ? q : a));
      out += Math.abs(p.VeluMax) > Math.abs(p.VeluMin) ? lab(p.x, p.VeluMax, C.eluMax, false) : lab(p.x, p.VeluMin, C.eluMin, true);
    });
    // titre, unité, légende
    let leg = '', lx = padL;
    D.series.forEach(([, nm, col, w, da]) => {
      leg += `<path d="M${lx} ${padT - 30}h22" stroke="${col}" stroke-width="${w}"${da ? ` stroke-dasharray="${da}"` : ''}/><text x="${lx + 27}" y="${padT - 26}" class="lg">${esc(nm)}</text>`;
      lx += 34 + nm.length * 6.4;
    });
    const head = `<text x="${padL}" y="18" class="tt">${esc(D.t)}</text><text x="${W - padR}" y="18" text-anchor="end" class="un">${esc(D.u)}${D.note ? ' — ' + esc(D.note) : ''}</text>${leg}`;
    const x0 = X(0), kx = (W - padL - padR) / L;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-x0="${x0}" data-kx="${kx}" data-kind="${kind}"><style>text{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;fill:#333}.ax{font-size:10px;fill:#666}.sid{font-weight:700;fill:#c2255c}.vl{font-size:10.5px;font-weight:600}.tt{font-size:13px;font-weight:600;fill:#1b2230}.un{fill:#666}.lg{font-size:10.5px}</style>${head}<g>${out}</g><path d="M${padL} ${padT - 8}V${H - padB}" stroke="#333"/><text x="${W - padR}" y="${H - 10}" text-anchor="end" class="un">x (m) — L = ${(L).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} m</text></svg>`;
  }

  function reactions(M, W, H) {
    const an = M.an, padL = 70, padR = 24, padT = 58, padB = 54, n = an.reac.length;
    const vals = an.reac.map((r) => r.elu), hi = Math.max.apply(null, vals) * 1.15 || 1;
    const Y = (v) => H - padB - v / hi * (H - padT - padB), gw = (W - padL - padR) / n, bw = Math.min(26, gw / 6);
    const ser = [['G', 'G', '#868e96'], ['Qmax', 'Q', '#fab005'], ['els', 'ELS car.', '#495057'], ['elu', 'ELU', '#1c5bd9']];
    let out = '';
    const st = niceStep(hi, 6);
    for (let v = 0; v <= hi; v += st) out += `<path d="M${padL} ${Y(v).toFixed(1)}H${W - padR}" stroke="${v === 0 ? '#333' : '#e6e8ec'}"/><text x="${padL - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end" class="ax">${f0(v)}</text>`;
    an.reac.forEach((r, j) => {
      const cx = padL + gw * (j + 0.5);
      ser.forEach(([k, , col], i) => {
        const x = cx + (i - 1.5) * (bw + 3) - bw / 2, y = Y(r[k]);
        out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${(Y(0) - y).toFixed(1)}" fill="${col}"/>`;
        if (k === 'elu') out += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" class="vl" fill="${col}">${f0(r[k])}</text>`;
      });
      const est = M.supports[j].elu;
      out += `<path d="M${(cx - 2.2 * (bw + 3)).toFixed(1)} ${Y(est).toFixed(1)}h${(4.4 * (bw + 3)).toFixed(1)}" stroke="#d6336c" stroke-width="1.4" stroke-dasharray="4 2"/>`;
      out += `<text x="${cx.toFixed(1)}" y="${H - padB + 16}" text-anchor="middle" class="sid">${M.supports[j].id}</text>`;
    });
    let leg = '', lx = padL;
    ser.concat([[null, 'ELU (descente de charges forfaitaire)', '#d6336c']]).forEach(([k, nm, col]) => {
      leg += k ? `<rect x="${lx}" y="${padT - 36}" width="14" height="10" fill="${col}"/>` : `<path d="M${lx} ${padT - 31}h16" stroke="${col}" stroke-width="1.4" stroke-dasharray="4 2"/>`;
      leg += `<text x="${lx + 19}" y="${padT - 27}" class="lg">${esc(nm)}</text>`; lx += 30 + nm.length * 6.2;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" data-kind="R"><style>text{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;fill:#333}.ax{font-size:10px;fill:#666}.sid{font-weight:700;fill:#c2255c}.vl{font-size:10.5px;font-weight:600}.tt{font-size:13px;font-weight:600;fill:#1b2230}.un{fill:#666}.lg{font-size:10.5px}</style><text x="${padL}" y="18" class="tt">Réactions d’appui (analyse longitudinale)</text><text x="${W - padR}" y="18" text-anchor="end" class="un">kN — toutes voies</text>${leg}${out}</svg>`;
  }

  return { diagSVG };
});
